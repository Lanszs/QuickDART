from train_classifier import train_disaster_model
import os

if __name__ == "__main__":
    # Train 3 specialized damage models — one per disaster type
    # Each model classifies: Destroyed / Major / Minor / No Damage

    models_to_train = [
        {
            "name": "Earthquake Damage",
            "data_dir": "dataset_damage_earthquake",
            "save_path": "ml_engine/damage_earthquake_model.pth",
            "satellite_mode": False,  # Ground-level photos
        },
        {
            "name": "Fire Damage",
            "data_dir": "dataset_damage_fire",
            "save_path": "ml_engine/damage_fire_model.pth",
            "satellite_mode": False,  # Mixed: xView2 satellite + ground-level/drone footage
        },
        {
            "name": "Flood Damage",
            "data_dir": "dataset_damage_flood",
            "save_path": "ml_engine/damage_flood_model.pth",
            "satellite_mode": True,  # xView2 satellite crops
        },
    ]

    num_classes = 4  # Destroyed, Major, Minor, No Damage

    for config in models_to_train:
        print(f"\n{'='*60}")
        print(f"  Training: {config['name']} Model")
        print(f"  Dataset:  {config['data_dir']}")
        print(f"  Satellite mode: {config['satellite_mode']}")
        print(f"{'='*60}\n")

        if not os.path.exists(config["data_dir"]):
            print(f"Error: Folder '{config['data_dir']}' not found. Skipping.")
            continue

        train_disaster_model(
            config["data_dir"],
            config["save_path"],
            num_classes,
            satellite_mode=config["satellite_mode"],
        )

        print(f"\nFinished training {config['name']} Model.\n")
