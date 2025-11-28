from train_classifier import train_disaster_model
import os

if __name__ == "__main__":
    # 1. Point to the DAMAGE dataset
    data_dir = 'dataset_damage_level'
    
    # 2. Save as a NEW model file
    save_path = 'ml_engine/damage_assessment_model.pth'
    
    # 3. Set classes to 4 (No Damage, Minor, Major, Destroyed)
    num_classes = 4
    
    print("Starting training for Damage Assessment Model...")
    
    if not os.path.exists(data_dir):
        print(f"Error: Folder '{data_dir}' not found.")
    else:
        train_disaster_model(data_dir, save_path, num_classes)