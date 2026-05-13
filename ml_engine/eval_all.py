"""
Run validation-set evaluation for all 8 trained models in one go.
Produces per-model: confusion matrix, per-class precision/recall/F1,
overall accuracy, macro F1, weighted F1, top confusions, ordinal analysis (damage).

Output is written to ml_engine/eval_all_results.txt for paper inclusion.

Usage:
    python ml_engine/eval_all.py
"""
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ML_DIR = PROJECT_ROOT / "ml_engine"

TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# (label, model_path, data_dir, class_names, ordinal_mode)
EVAL_CONFIGS = [
    ("Disaster Type — Ground",
        ML_DIR / "disaster_type_model.pth",
        PROJECT_ROOT / "dataset_disaster_type",
        ['Earthquake', 'Fire', 'Flood', 'No Disaster'],
        False),
    ("Disaster Type — Aerial",
        ML_DIR / "disaster_type_aerial_model.pth",
        PROJECT_ROOT / "dataset_disaster_type_aerial",
        ['Earthquake', 'Fire', 'Flood', 'No Disaster'],
        False),
    ("Damage — Earthquake (Ground)",
        ML_DIR / "damage_earthquake_model.pth",
        PROJECT_ROOT / "dataset_damage_earthquake",
        ['Destroyed', 'Major', 'Minor', 'No Damage'],
        True),
    ("Damage — Earthquake (Aerial) [2-class]",
        ML_DIR / "damage_earthquake_aerial_model.pth",
        PROJECT_ROOT / "dataset_damage_earthquake_aerial",
        ['Destroyed', 'No Damage'],
        True),
    ("Damage — Fire (Ground)",
        ML_DIR / "damage_fire_model.pth",
        PROJECT_ROOT / "dataset_damage_fire",
        ['Destroyed', 'Major', 'Minor', 'No Damage'],
        True),
    ("Damage — Fire (Aerial)",
        ML_DIR / "damage_fire_aerial_model.pth",
        PROJECT_ROOT / "dataset_damage_fire_aerial",
        ['Destroyed', 'Major', 'Minor', 'No Damage'],
        True),
    ("Damage — Flood (Ground)",
        ML_DIR / "damage_flood_model.pth",
        PROJECT_ROOT / "dataset_damage_flood",
        ['Destroyed', 'Major', 'Minor', 'No Damage'],
        True),
    ("Damage — Flood (Aerial)",
        ML_DIR / "damage_flood_aerial_model.pth",
        PROJECT_ROOT / "dataset_damage_flood_aerial",
        ['Destroyed', 'Major', 'Minor', 'No Damage'],
        True),
]


def load_resnet50(model_path, num_classes, device):
    m = models.resnet50(weights=None)
    m.fc = nn.Linear(m.fc.in_features, num_classes)
    state = torch.load(str(model_path), map_location=device)
    m.load_state_dict(state)
    m.eval()
    return m.to(device)


def evaluate_one(label, model_path, data_dir, class_names, ordinal_mode, device, out):
    val_dir = Path(data_dir) / "val"
    section = lambda c='=': out.write(f"{c * 78}\n")

    section()
    out.write(f"  {label}\n")
    section()

    if not val_dir.exists():
        out.write(f"[SKIP] missing val/: {val_dir}\n\n")
        return None
    if not Path(model_path).exists():
        out.write(f"[SKIP] missing model: {model_path}\n\n")
        return None

    val_data = datasets.ImageFolder(str(val_dir), TRANSFORM)
    val_loader = DataLoader(val_data, batch_size=64, shuffle=False, num_workers=0)

    out.write(f"Model:           {model_path.name}\n")
    out.write(f"Data:            {val_dir.relative_to(PROJECT_ROOT)}\n")
    out.write(f"Folder classes:  {val_data.classes}\n")
    out.write(f"Display names:   {class_names}\n")
    out.write(f"Total val:       {len(val_data)}\n\n")

    n = len(class_names)
    if len(val_data.classes) != n:
        out.write(f"WARNING: dataset has {len(val_data.classes)} folder classes but display has {n}.\n")
        out.write("  Confusion matrix will be sized for display class count; folder labels assumed to align.\n\n")

    try:
        model = load_resnet50(model_path, n, device)
    except Exception as e:
        out.write(f"[FAIL] could not load model with {n} classes: {e}\n\n")
        return None

    confusion = np.zeros((n, n), dtype=int)
    correct = 0
    total = 0
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            _, predicted = torch.max(outputs, 1)
            for t, p in zip(labels.cpu(), predicted.cpu()):
                if t.item() < n and p.item() < n:
                    confusion[t.item()][p.item()] += 1
                    if t.item() == p.item():
                        correct += 1
                    total += 1

    out.write("Per-class support (val image counts):\n")
    for i, name in enumerate(class_names):
        out.write(f"  {name:<13} {confusion[i].sum():>6}\n")
    out.write(f"  {'-'*22}\n")
    out.write(f"  {'Total':<13} {total:>6}\n\n")

    out.write("Confusion Matrix (rows = actual, columns = predicted):\n")
    out.write(f"  {'':<13}" + "".join(f"{c:>13}" for c in class_names) + "\n")
    for i, name in enumerate(class_names):
        out.write(f"  {name:<13}" + "".join(f"{confusion[i][j]:>13}" for j in range(n)) + "\n")
    out.write("\n")

    out.write("Per-Class Metrics:\n")
    out.write(f"  {'Class':<13} {'Support':>8} {'Accuracy':>10} {'Precision':>11} {'Recall':>9} {'F1':>8}\n")
    out.write(f"  {'-'*13} {'-'*8} {'-'*10} {'-'*11} {'-'*9} {'-'*8}\n")
    f1_scores = []
    wf1, wp, wr = 0.0, 0.0, 0.0
    for i, name in enumerate(class_names):
        tp = confusion[i][i]
        fn = confusion[i].sum() - tp
        fp = confusion[:, i].sum() - tp
        sup = confusion[i].sum()
        acc = (tp / sup * 100) if sup > 0 else 0.0
        p = (tp / (tp + fp) * 100) if (tp + fp) > 0 else 0.0
        r = (tp / (tp + fn) * 100) if (tp + fn) > 0 else 0.0
        f1 = (2 * p * r / (p + r)) if (p + r) > 0 else 0.0
        f1_scores.append(f1)
        wf1 += f1 * sup; wp += p * sup; wr += r * sup
        out.write(f"  {name:<13} {sup:>8} {acc:>9.1f}% {p:>10.1f}% {r:>8.1f}% {f1:>8.2f}\n")

    overall_acc = (correct / total * 100) if total > 0 else 0.0
    macro_f1 = float(np.mean(f1_scores)) if f1_scores else 0.0
    weighted_f1 = (wf1 / total) if total > 0 else 0.0
    weighted_p = (wp / total) if total > 0 else 0.0
    weighted_r = (wr / total) if total > 0 else 0.0

    out.write("\nOverall:\n")
    out.write(f"  Accuracy:           {correct}/{total} = {overall_acc:.2f}%\n")
    out.write(f"  Macro F1:           {macro_f1:.2f}\n")
    out.write(f"  Weighted F1:        {weighted_f1:.2f}\n")
    out.write(f"  Weighted Precision: {weighted_p:.2f}%\n")
    out.write(f"  Weighted Recall:    {weighted_r:.2f}%\n\n")

    out.write("Top confusions:\n")
    off = []
    for i in range(n):
        for j in range(n):
            if i != j and confusion[i][j] > 0:
                off.append((class_names[i], class_names[j], confusion[i][j], confusion[i].sum()))
    off.sort(key=lambda x: -x[2])
    for actual, predicted, count, sup in off[:6]:
        pct = (count / sup * 100) if sup > 0 else 0.0
        out.write(f"  {actual:<13} -> {predicted:<13}  {count:>5} ({pct:>4.1f}% of {actual})\n")
    if not off:
        out.write("  (no off-diagonal — perfect on val)\n")

    if ordinal_mode and n >= 3:
        # Damage levels are ordered; off-by-one is a near miss.
        eb1 = sum(confusion[i][j] for i in range(n) for j in range(n) if abs(i - j) == 1)
        eb2 = sum(confusion[i][j] for i in range(n) for j in range(n) if abs(i - j) >= 2)
        out.write("\nOrdinal analysis (damage levels):\n")
        out.write(f"  Exact:           {correct:>5}/{total} ({correct/total*100:.1f}%)\n")
        out.write(f"  Off by 1:        {eb1:>5}/{total} ({eb1/total*100:.1f}%)\n")
        out.write(f"  Off by 2+:       {eb2:>5}/{total} ({eb2/total*100:.1f}%)\n")
        out.write(f"  Within 1 level:  {correct + eb1:>5}/{total} ({(correct+eb1)/total*100:.1f}%)\n")

    if f1_scores:
        bi, wi = int(np.argmax(f1_scores)), int(np.argmin(f1_scores))
        out.write(f"\nBest class:  {class_names[bi]:<13} (F1 = {f1_scores[bi]:.2f})\n")
        out.write(f"Worst class: {class_names[wi]:<13} (F1 = {f1_scores[wi]:.2f})\n")

    out.write("\n")
    return {
        "label": label,
        "n_val": total,
        "accuracy": overall_acc,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "weighted_p": weighted_p,
        "weighted_r": weighted_r,
        "f1_per_class": list(zip(class_names, f1_scores)),
    }


def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    output_path = ML_DIR / "eval_all_results.txt"

    summaries = []
    with output_path.open("w", encoding="utf-8") as out:
        out.write(f"Device: {device}\n")
        if torch.cuda.is_available():
            out.write(f"GPU:    {torch.cuda.get_device_name(0)}\n")
        out.write("\n")
        for cfg in EVAL_CONFIGS:
            print(f"Evaluating: {cfg[0]} ...", flush=True)
            s = evaluate_one(*cfg, device=device, out=out)
            if s is not None:
                summaries.append(s)

        # Cross-model summary table
        out.write("=" * 78 + "\n")
        out.write("  SUMMARY ACROSS ALL MODELS\n")
        out.write("=" * 78 + "\n\n")
        out.write(f"  {'Model':<42} {'N':>6} {'Acc%':>7} {'MacroF1':>9} {'WtdF1':>7}\n")
        out.write(f"  {'-'*42} {'-'*6} {'-'*7} {'-'*9} {'-'*7}\n")
        for s in summaries:
            out.write(f"  {s['label']:<42} {s['n_val']:>6} {s['accuracy']:>6.1f}% {s['macro_f1']:>9.2f} {s['weighted_f1']:>7.2f}\n")

    print(f"\nWritten to: {output_path}")
    print("\n--- SUMMARY ---")
    for s in summaries:
        print(f"  {s['label']:<42} N={s['n_val']:<5} acc={s['accuracy']:.1f}% macroF1={s['macro_f1']:.2f} wtdF1={s['weighted_f1']:.2f}")


if __name__ == "__main__":
    main()
