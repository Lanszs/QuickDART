"""
Evaluate per-disaster ground-level damage models on their validation sets.

Reports per model:
  - Per-class image counts (support)
  - Confusion matrix
  - Per-class accuracy, precision, recall, F1
  - Overall accuracy, macro F1, weighted F1
  - Top confusions
  - Best/worst F1 class

Usage:
    python ml_engine/eval_damage.py --disaster earthquake
    python ml_engine/eval_damage.py --disaster fire
    python ml_engine/eval_damage.py --disaster flood
    python ml_engine/eval_damage.py --disaster all   # eval all available
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DAMAGE_CLASS_NAMES = ['Destroyed', 'Major', 'Minor', 'No Damage']

DAMAGE_CONFIGS = {
    "fire": {
        "model": PROJECT_ROOT / "ml_engine" / "damage_fire_model.pth",
        "data_dir": PROJECT_ROOT / "dataset_damage_fire",
    },
    "flood": {
        "model": PROJECT_ROOT / "ml_engine" / "damage_flood_model.pth",
        "data_dir": PROJECT_ROOT / "dataset_damage_flood",
    },
    "earthquake": {
        "model": PROJECT_ROOT / "ml_engine" / "damage_earthquake_model.pth",
        "data_dir": PROJECT_ROOT / "dataset_damage_earthquake",
    },
}

TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def load_resnet50(model_path, num_classes, device):
    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    state = torch.load(str(model_path), map_location=device)
    model.load_state_dict(state)
    model.eval()
    return model.to(device)


def evaluate_one(disaster, model_path, data_dir, batch_size, device):
    val_dir = Path(data_dir) / "val"
    if not val_dir.exists():
        print(f"\n[SKIP] {disaster}: {val_dir} does not exist.")
        return
    if not Path(model_path).exists():
        print(f"\n[SKIP] {disaster}: {model_path} does not exist.")
        return

    val_data = datasets.ImageFolder(str(val_dir), TRANSFORM)
    val_loader = DataLoader(val_data, batch_size=batch_size, shuffle=False, num_workers=0)

    class_names = DAMAGE_CLASS_NAMES
    folder_classes = val_data.classes

    print()
    print("=" * 70)
    print(f"  Damage Model - {disaster.upper()} - Validation Set Evaluation")
    print("=" * 70)
    print(f"Device:        {device}")
    print(f"Model:         {model_path}")
    print(f"Folder classes:{folder_classes}")
    print(f"Display names: {class_names}")
    print(f"Total val:     {len(val_data)}")

    model = load_resnet50(model_path, len(class_names), device)

    num_classes = len(class_names)
    confusion = np.zeros((num_classes, num_classes), dtype=int)
    correct = 0
    total = 0

    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            _, predicted = torch.max(outputs, 1)
            for t, p in zip(labels.cpu(), predicted.cpu()):
                confusion[t.item()][p.item()] += 1
                if t.item() == p.item():
                    correct += 1
                total += 1

    print()
    print("Per-class support (val image counts):")
    for i, name in enumerate(class_names):
        print(f"  {name:<13} {confusion[i].sum():>5}")
    print(f"  {'-'*20}")
    print(f"  {'Total':<13} {total:>5}")

    print()
    print("Confusion Matrix (rows = actual, columns = predicted):")
    print(f"  {'':<13}" + "".join(f"{n:>12}" for n in class_names))
    for i, name in enumerate(class_names):
        row = f"  {name:<13}" + "".join(f"{confusion[i][j]:>12}" for j in range(num_classes))
        print(row)

    print()
    print("Per-Class Metrics:")
    print(f"  {'Class':<13} {'Support':>8} {'Accuracy':>10} {'Precision':>11} {'Recall':>9} {'F1':>8}")
    print(f"  {'-'*13} {'-'*8} {'-'*10} {'-'*11} {'-'*9} {'-'*8}")

    f1_scores = []
    weighted_f1_sum = 0.0
    weighted_precision_sum = 0.0
    weighted_recall_sum = 0.0

    for i, name in enumerate(class_names):
        tp = confusion[i][i]
        fn = confusion[i].sum() - tp
        fp = confusion[:, i].sum() - tp
        support = confusion[i].sum()
        acc = (tp / support * 100) if support > 0 else 0
        precision = (tp / (tp + fp) * 100) if (tp + fp) > 0 else 0
        recall = (tp / (tp + fn) * 100) if (tp + fn) > 0 else 0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0
        f1_scores.append(f1)
        weighted_f1_sum += f1 * support
        weighted_precision_sum += precision * support
        weighted_recall_sum += recall * support
        print(f"  {name:<13} {support:>8} {acc:>9.1f}% {precision:>10.1f}% {recall:>8.1f}% {f1:>8.2f}")

    overall_acc = correct / total * 100
    macro_f1 = float(np.mean(f1_scores))
    weighted_f1 = weighted_f1_sum / total
    weighted_precision = weighted_precision_sum / total
    weighted_recall = weighted_recall_sum / total

    print()
    print("Overall:")
    print(f"  Overall Accuracy:    {correct}/{total} = {overall_acc:.2f}%")
    print(f"  Macro F1:            {macro_f1:.2f}")
    print(f"  Weighted F1:         {weighted_f1:.2f}")
    print(f"  Weighted Precision:  {weighted_precision:.2f}%")
    print(f"  Weighted Recall:     {weighted_recall:.2f}%")

    print()
    print("Top confusions (off-diagonal cells, sorted by count):")
    off_diagonal = []
    for i in range(num_classes):
        for j in range(num_classes):
            if i != j and confusion[i][j] > 0:
                off_diagonal.append((class_names[i], class_names[j], confusion[i][j], confusion[i].sum()))
    off_diagonal.sort(key=lambda x: -x[2])
    for actual, predicted, count, support in off_diagonal[:6]:
        pct = count / support * 100
        print(f"  {actual:<11} -> predicted as {predicted:<12} {count:>5} times ({pct:>4.1f}% of {actual})")

    # Adjacent-class accuracy: counts a "Destroyed predicted as Major" as a near miss
    # Damage is ordinal, so being off by one level matters less than off by two.
    print()
    print("Ordinal analysis (damage levels are inherently ordered):")
    exact = correct
    off_by_one = 0
    off_by_two_plus = 0
    for i in range(num_classes):
        for j in range(num_classes):
            if i == j:
                continue
            distance = abs(i - j)
            if distance == 1:
                off_by_one += confusion[i][j]
            else:
                off_by_two_plus += confusion[i][j]
    print(f"  Exact match:        {exact:>5} / {total}  ({exact/total*100:.1f}%)")
    print(f"  Off by 1 level:     {off_by_one:>5} / {total}  ({off_by_one/total*100:.1f}%)")
    print(f"  Off by 2+ levels:   {off_by_two_plus:>5} / {total}  ({off_by_two_plus/total*100:.1f}%)")
    print(f"  Within 1 level:     {exact + off_by_one:>5} / {total}  ({(exact+off_by_one)/total*100:.1f}%)  <- forgiving accuracy")

    print()
    best_idx = int(np.argmax(f1_scores))
    worst_idx = int(np.argmin(f1_scores))
    print(f"Best  class: {class_names[best_idx]:<13} (F1 = {f1_scores[best_idx]:.2f})")
    print(f"Worst class: {class_names[worst_idx]:<13} (F1 = {f1_scores[worst_idx]:.2f})")


def main():
    parser = argparse.ArgumentParser(description="Evaluate ground-level damage models.")
    parser.add_argument(
        '--disaster', choices=list(DAMAGE_CONFIGS.keys()) + ['all'], default='all',
        help="Which disaster's damage model to evaluate (default: all available)",
    )
    parser.add_argument('--batch-size', type=int, default=64)
    args = parser.parse_args()

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    targets = DAMAGE_CONFIGS.keys() if args.disaster == 'all' else [args.disaster]
    for disaster in targets:
        cfg = DAMAGE_CONFIGS[disaster]
        evaluate_one(disaster, cfg["model"], cfg["data_dir"], args.batch_size, device)


if __name__ == "__main__":
    main()
