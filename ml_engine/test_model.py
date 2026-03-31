import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import sys
import os
import numpy as np

# Class names (must match training folder alphabetical order)
TYPE_CLASS_NAMES = ['Earthquake', 'Fire', 'Flood', 'No Disaster']
DAMAGE_CLASS_NAMES = ['Destroyed', 'Major', 'Minor', 'No Damage']

# Image preprocessing (same as training/inference)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])


def load_model(model_path, num_classes):
    """Load a ResNet50 model with the given number of output classes."""
    model = models.resnet50(weights=None)
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, num_classes)

    try:
        model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    except FileNotFoundError:
        print(f"Error: Could not find model at {model_path}")
        return None

    model.eval()
    return model


def predict_image(image_path, type_model, damage_models):
    """Run type model + routed damage model on a single image and print results."""
    if not os.path.exists(image_path):
        print(f"Error: Could not find image at {image_path}")
        return None, None

    image = Image.open(image_path).convert('RGB')
    input_tensor = transform(image).unsqueeze(0)

    with torch.no_grad():
        # Disaster Type prediction
        type_outputs = type_model(input_tensor)
        type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
        type_conf, type_pred = torch.max(type_probs, 1)

        detected_type = TYPE_CLASS_NAMES[type_pred.item()]
        type_confidence = type_conf.item() * 100

        # Damage prediction — route to matching damage model
        if detected_type == 'No Disaster':
            detected_damage = "N/A"
            damage_confidence = 0.0
        else:
            damage_model = damage_models.get(detected_type)
            if damage_model:
                damage_outputs = damage_model(input_tensor)
                damage_probs = torch.nn.functional.softmax(damage_outputs, dim=1)
                damage_conf, damage_pred = torch.max(damage_probs, 1)
                detected_damage = DAMAGE_CLASS_NAMES[damage_pred.item()]
                damage_confidence = damage_conf.item() * 100
            else:
                detected_damage = "N/A (no model)"
                damage_confidence = 0.0

    print(f"\n  Image: {image_path}")
    print(f"  Type: {detected_type} ({type_confidence:.1f}%)")
    print(f"  Damage: {detected_damage} ({damage_confidence:.1f}%)")

    # Print full type distribution
    print(f"  Type Distribution:")
    for idx, name in enumerate(TYPE_CLASS_NAMES):
        print(f"    {name}: {type_probs[0][idx].item() * 100:.1f}%")

    return detected_type, detected_damage


def evaluate_dataset(data_dir, model, class_names, label="Model"):
    """Evaluate a model on a validation dataset and print confusion matrix."""
    from torchvision import datasets
    from torch.utils.data import DataLoader

    val_dir = os.path.join(data_dir, 'val')
    if not os.path.exists(val_dir):
        print(f"Validation directory not found: {val_dir}")
        return

    val_data = datasets.ImageFolder(val_dir, transform)
    val_loader = DataLoader(val_data, batch_size=32, shuffle=False)

    print(f"\n{'='*50}")
    print(f"Evaluating {label} on {len(val_data)} validation images")
    print(f"Classes: {val_data.classes}")
    print(f"{'='*50}")

    num_classes = len(class_names)
    confusion = np.zeros((num_classes, num_classes), dtype=int)
    correct = 0
    total = 0

    with torch.no_grad():
        for inputs, labels in val_loader:
            outputs = model(inputs)
            _, predicted = torch.max(outputs, 1)
            for t, p in zip(labels, predicted):
                confusion[t.item()][p.item()] += 1
                if t.item() == p.item():
                    correct += 1
                total += 1

    # Print confusion matrix
    print(f"\nConfusion Matrix:")
    header = f"{'':>15}" + "".join(f"{name:>12}" for name in class_names)
    print(header)
    for i, name in enumerate(class_names):
        row = f"{name:>15}" + "".join(f"{confusion[i][j]:>12}" for j in range(num_classes))
        print(row)

    # Per-class accuracy, precision, recall, F1
    print(f"\nPer-Class Metrics:")
    print(f"  {'Class':>15} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1 Score':>10}")
    print(f"  {'-'*55}")

    f1_scores = []
    for i, name in enumerate(class_names):
        tp = confusion[i][i]
        fn = confusion[i].sum() - tp  # actual i, predicted not i
        fp = confusion[:, i].sum() - tp  # predicted i, actual not i
        class_total = confusion[i].sum()

        acc = (tp / class_total * 100) if class_total > 0 else 0
        precision = (tp / (tp + fp)) if (tp + fp) > 0 else 0
        recall = (tp / (tp + fn)) if (tp + fn) > 0 else 0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0
        f1_scores.append(f1)

        print(f"  {name:>15} {acc:>9.1f}% {precision:>9.1f}% {recall:>9.1f}% {f1:>10.3f}")

    macro_f1 = np.mean(f1_scores)
    overall_acc = correct / total * 100 if total > 0 else 0
    print(f"\n  Overall Accuracy: {correct}/{total} ({overall_acc:.1f}%)")
    print(f"  Macro F1 Score: {macro_f1:.3f}")
    return overall_acc


if __name__ == "__main__":
    print("=" * 60)
    print("QuickDART Model Testing Suite")
    print("=" * 60)

    # Load type model
    type_model_path = "ml_engine/disaster_type_model.pth"
    print("\nLoading type model...")
    type_model = load_model(type_model_path, len(TYPE_CLASS_NAMES))

    if not type_model:
        print("Failed to load type model. Exiting.")
        sys.exit(1)

    # Load 3 damage models
    damage_model_configs = {
        'Earthquake': "ml_engine/damage_earthquake_model.pth",
        'Fire': "ml_engine/damage_fire_model.pth",
        'Flood': "ml_engine/damage_flood_model.pth",
    }

    print("Loading damage models...")
    damage_models = {}
    for dtype, path in damage_model_configs.items():
        m = load_model(path, len(DAMAGE_CLASS_NAMES))
        if m:
            damage_models[dtype] = m
            print(f"  Loaded {dtype} damage model")
        else:
            print(f"  Warning: Could not load {dtype} damage model at {path}")

    if not damage_models:
        print("No damage models loaded. Exiting.")
        sys.exit(1)

    # --- Test 1: Individual image predictions ---
    print("\n" + "=" * 60)
    print("TEST 1: Individual Image Predictions")
    print("=" * 60)

    test_images = [
        "ml_engine/test_image.jpg",
        "ml_engine/test_imagefire.jpg",
        "ml_engine/test_imageflood.jpg",
    ]

    for img_path in test_images:
        if os.path.exists(img_path):
            predict_image(img_path, type_model, damage_models)

    # --- Test 2: Validation set evaluation ---
    print("\n" + "=" * 60)
    print("TEST 2: Validation Set Evaluation")
    print("=" * 60)

    # Type model evaluation
    type_dataset_dir = "dataset_disaster_type"
    if os.path.exists(os.path.join(type_dataset_dir, 'val')):
        evaluate_dataset(type_dataset_dir, type_model, TYPE_CLASS_NAMES,
                         label="Disaster Type Model")
    else:
        print(f"Skipping type model eval: {type_dataset_dir}/val not found")

    # Per-disaster damage model evaluation
    damage_dataset_configs = {
        'Earthquake': "dataset_damage_earthquake",
        'Fire': "dataset_damage_fire",
        'Flood': "dataset_damage_flood",
    }

    for dtype, dataset_dir in damage_dataset_configs.items():
        if dtype in damage_models and os.path.exists(os.path.join(dataset_dir, 'val')):
            evaluate_dataset(dataset_dir, damage_models[dtype], DAMAGE_CLASS_NAMES,
                             label=f"{dtype} Damage Model")
        else:
            print(f"Skipping {dtype} damage eval: model or {dataset_dir}/val not found")

    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)
