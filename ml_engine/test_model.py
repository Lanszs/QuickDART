import torch
from torchvision import models, transforms
from PIL import Image
import sys
import os

# 1. Setup the Class Names (Must match your training folders exactly!)
CLASS_NAMES = ['Earthquake', 'Fire', 'Flood']

def predict_image(image_path, model_path):
    # 2. Define Transforms (Same as training)
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # 3. Load the Model Structure
    print("Loading model...")
    model = models.resnet50(weights=None)
    num_ftrs = model.fc.in_features
    model.fc = torch.nn.Linear(num_ftrs, len(CLASS_NAMES))

    # 4. Load the Trained Weights
    # map_location='cpu' ensures it works even if you run this test on a CPU
    try:
        model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    except FileNotFoundError:
        print(f"Error: Could not find model at {model_path}")
        return

    model.eval() # Set to evaluation mode

    # 5. Load and Preprocess Image
    if not os.path.exists(image_path):
        print(f"Error: Could not find image at {image_path}")
        return

    image = Image.open(image_path).convert('RGB')
    input_tensor = transform(image).unsqueeze(0) # Add batch dimension

    # 6. Predict
    print(f"Analyzing {image_path}...")
    with torch.no_grad():
        outputs = model(input_tensor)
        _, predicted = torch.max(outputs, 1)
        
        # Get confidence
        probs = torch.nn.functional.softmax(outputs, dim=1)
        confidence = probs[0][predicted].item() * 100

    print(f"\nPrediction: {CLASS_NAMES[predicted.item()]}")
    print(f"Confidence: {confidence:.2f}%")

if __name__ == "__main__":
  
    TEST_IMAGE = "ml_engine/test_image.jpg" 
    
    MODEL_PATH = "ml_engine/disaster_type_model.pth"
    
    predict_image(TEST_IMAGE, MODEL_PATH)