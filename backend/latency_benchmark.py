"""
Real latency benchmark for the QuickDART ML inference path.

Replicates the exact single-image '/api/v1/analyze' pipeline (preprocess ->
disaster-type inference -> damage inference -> Grad-CAM) using the real trained
models and real sample images from static/uploads. No Flask/DB/Supabase boot.

Run:  venv/Scripts/python.exe latency_benchmark.py [--view ground|aerial] [-n N]
"""
import os
import sys
import time
import glob
import argparse
import statistics

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)
ML_DIR = os.path.join(BASE_DIR, 'ml_engine')
sys.path.append(BACKEND_DIR)
sys.path.append(ML_DIR)
from gradcam import GradCAM, compute_gradcam_for_frame, heatmap_to_bbox  # noqa: E402

TYPE_CLASS_NAMES = ['Earthquake', 'Fire', 'Flood', 'No Disaster']
DAMAGE_CLASS_NAMES = ['Destroyed', 'Major', 'Minor', 'No Damage']

# Exact transform from app.py
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

MODEL_PATHS = {
    'ground': {
        'type': os.path.join(ML_DIR, 'disaster_type_model.pth'),
        'Earthquake': os.path.join(ML_DIR, 'damage_earthquake_model.pth'),
        'Fire': os.path.join(ML_DIR, 'damage_fire_model.pth'),
        'Flood': os.path.join(ML_DIR, 'damage_flood_model.pth'),
    },
    'aerial': {
        'type': os.path.join(ML_DIR, 'disaster_type_aerial_model.pth'),
        'Earthquake': os.path.join(ML_DIR, 'damage_earthquake_aerial_model.pth'),
        'Fire': os.path.join(ML_DIR, 'damage_fire_aerial_model.pth'),
        'Flood': os.path.join(ML_DIR, 'damage_flood_aerial_model.pth'),
    },
}


def load_model(path, num_classes):
    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    model.load_state_dict(torch.load(path, map_location=torch.device('cpu')))
    model.eval()
    return model


def ms(seconds):
    return seconds * 1000.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--view', default='ground', choices=['ground', 'aerial'])
    ap.add_argument('-n', type=int, default=30, help='max images to benchmark')
    args = ap.parse_args()

    print(f"PyTorch {torch.__version__} | threads={torch.get_num_threads()} | "
          f"device=CPU | view={args.view}\n")

    # ---- Model load latency ----
    paths = MODEL_PATHS[args.view]
    t0 = time.perf_counter()
    type_model = load_model(paths['type'], len(TYPE_CLASS_NAMES))
    damage_models = {d: load_model(paths[d], len(DAMAGE_CLASS_NAMES))
                     for d in ('Earthquake', 'Fire', 'Flood')}
    load_s = time.perf_counter() - t0
    print(f"Model load (4 ResNet50 models): {load_s:.2f} s\n")

    type_gradcam = GradCAM(type_model, "layer4")
    damage_gradcams = {d: GradCAM(m, "layer4") for d, m in damage_models.items()}

    # ---- Gather real sample images ----
    uploads = os.path.join(BACKEND_DIR, 'static', 'uploads')
    files = []
    for ext in ('*.jpg', '*.jpeg', '*.png'):
        files.extend(glob.glob(os.path.join(uploads, ext)))
    files = sorted(files)[:args.n]
    if not files:
        print("No sample images found in static/uploads.")
        return
    print(f"Benchmarking {len(files)} real sample images "
          f"(full /analyze pipeline incl. Grad-CAM)...\n")

    pre, typ, dmg, gcam, total = [], [], [], [], []
    warmed = False

    for path in files:
        try:
            image = Image.open(path).convert('RGB')
        except Exception:
            continue

        # preprocess
        t = time.perf_counter()
        tensor = transform(image).unsqueeze(0)
        t_pre = time.perf_counter() - t

        # type inference
        t = time.perf_counter()
        with torch.no_grad():
            type_outputs = type_model(tensor)
            type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
            type_conf, type_pred = torch.max(type_probs, 1)
        t_typ = time.perf_counter() - t
        detected_type = TYPE_CLASS_NAMES[type_pred.item()]
        is_no_disaster = (detected_type == 'No Disaster' or
                          type_conf.item() * 100 < 50.0)

        # damage inference
        t_dmg = 0.0
        if not is_no_disaster:
            dm = damage_models.get(detected_type)
            t = time.perf_counter()
            with torch.no_grad():
                damage_outputs = dm(tensor)
                torch.nn.functional.softmax(damage_outputs, dim=1)
            t_dmg = time.perf_counter() - t

        # grad-cam
        t = time.perf_counter()
        try:
            if is_no_disaster:
                type_gradcam.compute_heatmap(tensor)
            else:
                compute_gradcam_for_frame(
                    type_model, damage_models.get(detected_type), tensor,
                    type_gradcam, damage_gradcams.get(detected_type))
        except Exception as e:
            print(f"  grad-cam err: {e}")
        t_gcam = time.perf_counter() - t

        t_total = t_pre + t_typ + t_dmg + t_gcam

        # Discard the first image as warm-up (lazy CUDA/MKL/alloc init)
        if not warmed:
            warmed = True
            continue

        pre.append(t_pre); typ.append(t_typ); dmg.append(t_dmg)
        gcam.append(t_gcam); total.append(t_total)

    def report(name, xs):
        if not xs:
            print(f"  {name:<22} (no data)")
            return
        xs_ms = sorted(ms(x) for x in xs)
        p50 = statistics.median(xs_ms)
        p95 = xs_ms[min(len(xs_ms) - 1, int(round(0.95 * (len(xs_ms) - 1))))]
        print(f"  {name:<22} mean {statistics.mean(xs_ms):7.1f} ms | "
              f"p50 {p50:7.1f} | p95 {p95:7.1f} | "
              f"min {xs_ms[0]:7.1f} | max {xs_ms[-1]:7.1f}")

    print(f"Per-image latency over {len(total)} images (warm):\n")
    report("preprocess", pre)
    report("type inference", typ)
    report("damage inference", dmg)
    report("grad-cam", gcam)
    print("  " + "-" * 70)
    report("TOTAL (single image)", total)

    if total:
        thr = 1000.0 / statistics.mean([ms(x) for x in total])
        print(f"\n  Effective throughput: {thr:.1f} images/sec "
              f"(single-threaded, CPU)")
        print(f"  Est. video latency (10 frames): "
              f"~{statistics.mean([ms(x) for x in total]) * 10 / 1000:.1f} s")


if __name__ == '__main__':
    main()
