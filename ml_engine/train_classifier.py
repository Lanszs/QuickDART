import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader, WeightedRandomSampler
import os
import time
import numpy as np


def train_disaster_model(data_dir, save_path, num_classes=3, satellite_mode=False):
    # 1. Define Transforms
    if satellite_mode:
        # Satellite imagery: gentle augmentation (top-down building crops)
        print("Using SATELLITE augmentation mode (gentle transforms)")
        train_transforms = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomVerticalFlip(),
            transforms.RandomRotation(5),
            transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
    else:
        # Ground-level photos: aggressive augmentation for better generalization
        print("Using GROUND-LEVEL augmentation mode (aggressive transforms)")
        train_transforms = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.RandomAffine(degrees=15, translate=(0.1, 0.1), scale=(0.9, 1.1)),
            transforms.RandomPerspective(distortion_scale=0.2, p=0.3),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    # Validation: no augmentation, just resize and normalize
    val_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # 2. Load Data
    train_dir = os.path.join(data_dir, 'train')
    val_dir = os.path.join(data_dir, 'val')

    if not os.path.exists(train_dir) or not os.path.exists(val_dir):
        print(f"Error: Could not find {train_dir} or {val_dir}")
        return

    train_data = datasets.ImageFolder(train_dir, train_transforms)
    val_data = datasets.ImageFolder(val_dir, val_transforms)

    # 3. Compute class weights for balanced sampling
    class_counts = np.array([0] * num_classes)
    for _, label in train_data.samples:
        class_counts[label] += 1

    print(f"Found {len(train_data)} training images and {len(val_data)} validation images.")
    print(f"Classes found: {train_data.classes}")
    print(f"Class counts: {dict(zip(train_data.classes, class_counts))}")

    # WeightedRandomSampler: oversample minority classes
    class_weights = 1.0 / torch.tensor(class_counts, dtype=torch.float)
    sample_weights = torch.tensor([class_weights[label] for _, label in train_data.samples])
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(train_data, batch_size=32, sampler=sampler)
    val_loader = DataLoader(val_data, batch_size=32, shuffle=False)

    # 4. Load Pre-trained Model (ResNet50)
    print("Loading ResNet50 model...")
    model = models.resnet50(weights='DEFAULT')

    # Replace the "Head" for our custom classes
    num_features = model.fc.in_features
    model.fc = nn.Linear(num_features, num_classes)

    # 5. Setup Training
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    # Weighted loss to handle class imbalance
    loss_weights = class_weights / class_weights.sum() * num_classes
    criterion = nn.CrossEntropyLoss(weight=loss_weights.to(device))

    # Phase 1: Freeze early layers, only train layer4 + fc
    print("Phase 1: Freezing early layers (training layer4 + fc only)...")
    for param in model.parameters():
        param.requires_grad = False
    for param in model.layer4.parameters():
        param.requires_grad = True
    for param in model.fc.parameters():
        param.requires_grad = True

    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=0.0001)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=5, factor=0.5)

    # 6. Training Loop
    num_epochs = 30
    unfreeze_epoch = 8
    patience = 8
    best_val_acc = 0.0
    epochs_without_improvement = 0

    print(f"Training on {device} for up to {num_epochs} epochs (early stopping patience={patience})...")

    for epoch in range(num_epochs):
        # Unfreeze all layers after the warm-up phase
        if epoch == unfreeze_epoch:
            print(f"\nPhase 2: Unfreezing all layers with lower learning rate...")
            for param in model.parameters():
                param.requires_grad = True
            optimizer = optim.Adam(model.parameters(), lr=0.00003)
            scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=5, factor=0.5)

        # --- Training Phase ---
        model.train()
        running_loss = 0.0
        train_correct = 0
        train_total = 0

        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            _, predicted = torch.max(outputs, 1)
            train_correct += (predicted == labels).sum().item()
            train_total += labels.size(0)

        avg_train_loss = running_loss / len(train_loader)
        train_acc = train_correct / train_total * 100

        # --- Validation Phase ---
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                val_correct += (predicted == labels).sum().item()
                val_total += labels.size(0)

        avg_val_loss = val_loss / len(val_loader)
        val_acc = val_correct / val_total * 100

        scheduler.step(avg_val_loss)
        current_lr = optimizer.param_groups[0]['lr']

        phase = "frozen" if epoch < unfreeze_epoch else "unfrozen"
        print(f"Epoch {epoch+1}/{num_epochs} [{phase}] - "
              f"Train Loss: {avg_train_loss:.4f}, Train Acc: {train_acc:.1f}% | "
              f"Val Loss: {avg_val_loss:.4f}, Val Acc: {val_acc:.1f}% | "
              f"LR: {current_lr:.6f}")

        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), save_path)
            print(f"  -> New best model saved! (Val Acc: {val_acc:.1f}%)")
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        # Early stopping
        if epochs_without_improvement >= patience:
            print(f"\nEarly stopping: No improvement for {patience} epochs.")
            break

    print(f"\nTraining Complete! Best Val Accuracy: {best_val_acc:.1f}%")
    print(f"Model saved to {save_path}")


if __name__ == "__main__":
    # Train disaster type model (4 classes: Earthquake, Fire, Flood, No Disaster)
    train_disaster_model('dataset_disaster_type', 'ml_engine/disaster_type_model.pth', num_classes=4)
