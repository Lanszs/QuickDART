import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader
import os
import time

def train_disaster_model(data_dir, save_path, num_classes=3):
    # 1. Define Transforms
    # We resize everything to 224x224 so the AI doesn't get confused by resolution differences
    transforms_config = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(), # Data Augmentation
        transforms.RandomRotation(10),     # Helps with drone angles
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # 2. Load Data
    train_dir = os.path.join(data_dir, 'train')
    val_dir = os.path.join(data_dir, 'val')

    # Check if folders exist before crashing
    if not os.path.exists(train_dir) or not os.path.exists(val_dir):
        print(f"Error: Could not find {train_dir} or {val_dir}")
        return

    train_data = datasets.ImageFolder(train_dir, transforms_config)
    val_data = datasets.ImageFolder(val_dir, transforms_config)
    
    train_loader = DataLoader(train_data, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_data, batch_size=32, shuffle=False)

    print(f"Found {len(train_data)} training images and {len(val_data)} validation images.")
    print(f"Classes found: {train_data.classes}")

    # 3. Load Pre-trained Model (ResNet50)
    print("Loading ResNet50 model...")
    model = models.resnet50(weights='DEFAULT')
    
    # 4. Replace the "Head" of the model for our custom classes
    num_features = model.fc.in_features
    model.fc = nn.Linear(num_features, num_classes) 

    # 5. Setup Training
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.0001) # Low learning rate

    # 6. Training Loop
    print(f"Training on {device} for 10 epochs...")
    
    for epoch in range(10): # 10 Epochs
        model.train()
        running_loss = 0.0
        
        # Training Phase
        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
        
        avg_loss = running_loss / len(train_loader)
        print(f"Epoch {epoch+1}/10 - Loss: {avg_loss:.4f}")

    # 7. Save Model
    torch.save(model.state_dict(), save_path)
    print(f"Training Complete! Model saved to {save_path}")

if __name__ == "__main__":
    # Ensure you created the folders I described earlier!
    # 'dataset_disaster_type' should be in your root folder.
    train_disaster_model('dataset_disaster_type', 'ml_engine/disaster_type_model.pth', num_classes=3)