"""
Evaluate the ground-level disaster type model on the validation set.

Reports:
  - Per-class image counts (support)
  - Confusion matrix
  - Per-class accuracy, precision, recall, F1
  - Overall accuracy, macro F1, weighted F1
  - Top confusions (which classes get mistaken for which)
  - Best/worst F1 class

Usage:
    python ml_engine/eval_disaster_type.py
    python ml_engine/eval_disaster_type.py --model ml_engine/disaster_type_model.pth
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

TYPE_CLASS_NAMES = ['Earthquake', 'Fire', 'Flood', 'No Disaster']

TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def load_resnet50(model_path, num_classes, device):
    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    state = torch.load(model_path, map_location=device)
    model.load_state_dict(state)
    model.eval()
    return model.to(device)


def main():
    parser = argparse.ArgumentParser(description="Evaluate the disaster type model.")
    parser.add_argument('--model', default=str(PROJECT_ROOT / "ml_engine" / "disaster_type_model.pth"))
    parser.add_argument('--data-dir', default=str(PROJECT_ROOT / "dataset_disaster_type"))
    parser.add_argument('--batch-size', type=int, default=64)
    args = parser.parse_args()

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}")
    print(f"Model:  {args.model}")
    print(f"Data:   {args.data_dir}/val")

    val_dir = Path(args.data_dir) / "val"
    if not val_dir.exists():
        print(f"ERROR: {val_dir} does not exist.")
        sys.exit(1)

    val_data = datasets.ImageFolder(str(val_dir), TRANSFORM)
    val_loader = DataLoader(val_data, batch_size=args.batch_size, shuffle=False, num_workers=0)

    folder_classes = val_data.classes
    print(f"Folder classes: {folder_classes}")
    print(f"Display names:  {TYPE_CLASS_NAMES}")
    print(f"Total val images: {len(val_data)}")

    model = load_resnet50(args.model, len(TYPE_CLASS_NAMES), device)

    num_classes = len(TYPE_CLASS_NAMES)
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
    print("=" * 70)
    print("  Disaster Type Model - Validation Set Evaluation")
    print("=" * 70)

    print()
    print("Per-class support (val image counts):")
    for i, name in enumerate(TYPE_CLASS_NAMES):
        print(f"  {name:<15} {confusion[i].sum():>5}")
    print(f"  {'-'*22}")
    print(f"  {'Total':<15} {total:>5}")

    print()
    print("Confusion Matrix (rows = actual, columns = predicted):")
    print(f"  {'':<15}" + "".join(f"{n:>13}" for n in TYPE_CLASS_NAMES))
    for i, name in enumerate(TYPE_CLASS_NAMES):
        row = f"  {name:<15}" + "".join(f"{confusion[i][j]:>13}" for j in range(num_classes))
        print(row)

    print()
    print("Per-Class Metrics:")
    print(f"  {'Class':<15} {'Support':>8} {'Accuracy':>10} {'Precision':>11} {'Recall':>9} {'F1':>8}")
    print(f"  {'-'*15} {'-'*8} {'-'*10} {'-'*11} {'-'*9} {'-'*8}")

    f1_scores = []
    weighted_f1_sum = 0.0
    weighted_precision_sum = 0.0
    weighted_recall_sum = 0.0

    for i, name in enumerate(TYPE_CLASS_NAMES):
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
        print(f"  {name:<15} {support:>8} {acc:>9.1f}% {precision:>10.1f}% {recall:>8.1f}% {f1:>8.2f}")

    overall_acc = correct / total * 100
    macro_f1 = float(np.mean(f1_scores))
    weighted_f1 = weighted_f1_sum / total
    weighted_precision = weighted_precision_sum / total
    weighted_recall = weighted_recall_sum / total

    print()
    print("Overall:")
    print(f"  Overall Accuracy:    {correct}/{total} = {overall_acc:.2f}%")
    print(f"  Macro F1:            {macro_f1:.2f}  (unweighted average across classes)")
    print(f"  Weighted F1:         {weighted_f1:.2f}  (weighted by class support)")
    print(f"  Weighted Precision:  {weighted_precision:.2f}%")
    print(f"  Weighted Recall:     {weighted_recall:.2f}%")

    print()
    print("Top confusions (off-diagonal cells, sorted by count):")
    off_diagonal = []
    for i in range(num_classes):
        for j in range(num_classes):
            if i != j and confusion[i][j] > 0:
                off_diagonal.append((TYPE_CLASS_NAMES[i], TYPE_CLASS_NAMES[j], confusion[i][j], confusion[i].sum()))
    off_diagonal.sort(key=lambda x: -x[2])
    for actual, predicted, count, support in off_diagonal[:5]:
        pct = count / support * 100
        print(f"  {actual:<13} -> predicted as {predicted:<13}  {count:>5} times ({pct:>4.1f}% of {actual})")

    print()
    best_idx = int(np.argmax(f1_scores))
    worst_idx = int(np.argmin(f1_scores))
    print(f"Best  class: {TYPE_CLASS_NAMES[best_idx]:<15} (F1 = {f1_scores[best_idx]:.2f})")
    print(f"Worst class: {TYPE_CLASS_NAMES[worst_idx]:<15} (F1 = {f1_scores[worst_idx]:.2f})")


if __name__ == "__main__":
    main()
