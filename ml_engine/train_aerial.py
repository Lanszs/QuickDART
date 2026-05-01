"""
Train aerial models for QuickDART.

Reuses train_disaster_model from train_classifier.py. Trains:
  - Aerial disaster TYPE model      -> disaster_type_aerial_model.pth
  - Aerial damage models (per type) -> damage_<type>_aerial_model.pth

Damage datasets that haven't been split into train/ and val/ yet are
skipped with a warning. To split a dataset, run:
    python ml_engine/label_damage_aerial.py --disaster <type> --split

Usage:
    python ml_engine/train_aerial.py            # train all available
    python ml_engine/train_aerial.py --type     # type model only
    python ml_engine/train_aerial.py --damage   # damage models only
"""

import argparse
import os
from pathlib import Path

from train_classifier import train_disaster_model

PROJECT_ROOT = Path(__file__).resolve().parent.parent

TYPE_CONFIG = {
    "name": "Aerial Disaster Type",
    "data_dir": str(PROJECT_ROOT / "dataset_disaster_type_aerial"),
    "save_path": str(PROJECT_ROOT / "ml_engine" / "disaster_type_aerial_model.pth"),
    "num_classes": 4,
    "satellite_mode": True,  # aerial views: gentler augmentation
}

DAMAGE_CONFIGS = [
    {
        "name": "Aerial Fire Damage",
        "data_dir": str(PROJECT_ROOT / "dataset_damage_fire_aerial"),
        "save_path": str(PROJECT_ROOT / "ml_engine" / "damage_fire_aerial_model.pth"),
        "num_classes": 4,
        "satellite_mode": True,
    },
    {
        "name": "Aerial Flood Damage",
        "data_dir": str(PROJECT_ROOT / "dataset_damage_flood_aerial"),
        "save_path": str(PROJECT_ROOT / "ml_engine" / "damage_flood_aerial_model.pth"),
        "num_classes": 4,
        "satellite_mode": True,
    },
    {
        "name": "Aerial Earthquake Damage (binary)",
        "data_dir": str(PROJECT_ROOT / "dataset_damage_earthquake_aerial"),
        "save_path": str(PROJECT_ROOT / "ml_engine" / "damage_earthquake_aerial_model.pth"),
        "num_classes": 2,  # Destroyed vs No Damage only - aerial earthquake imagery rarely shows minor/major damage gradations
        "satellite_mode": True,
    },
]


def is_dataset_ready(data_dir):
    """A dataset is ready if both train/ and val/ exist with at least one class folder."""
    train_dir = os.path.join(data_dir, "train")
    val_dir = os.path.join(data_dir, "val")
    if not (os.path.isdir(train_dir) and os.path.isdir(val_dir)):
        return False
    train_classes = [
        d for d in os.listdir(train_dir)
        if os.path.isdir(os.path.join(train_dir, d))
    ]
    return len(train_classes) > 0


def train_one(config):
    print(f"\n{'='*60}")
    print(f"  Training: {config['name']}")
    print(f"  Dataset:  {config['data_dir']}")
    print(f"  Save to:  {config['save_path']}")
    print(f"{'='*60}\n")

    if not is_dataset_ready(config["data_dir"]):
        print(f"  SKIP: dataset not ready (missing train/ or val/ folders).")
        print(f"  -> Run: python ml_engine/label_damage_aerial.py --disaster <name> --split")
        return False

    train_disaster_model(
        config["data_dir"],
        config["save_path"],
        num_classes=config["num_classes"],
        satellite_mode=config["satellite_mode"],
    )
    print(f"\n  Finished {config['name']}.\n")
    return True


def main():
    parser = argparse.ArgumentParser(description="Train aerial QuickDART models.")
    parser.add_argument('--type', action='store_true',
                        help="Train aerial disaster type model only")
    parser.add_argument('--damage', action='store_true',
                        help="Train aerial damage models only")
    args = parser.parse_args()

    train_type = args.type or not args.damage
    train_damage = args.damage or not args.type

    if train_type:
        train_one(TYPE_CONFIG)

    if train_damage:
        trained = 0
        skipped = 0
        for config in DAMAGE_CONFIGS:
            if train_one(config):
                trained += 1
            else:
                skipped += 1
        print(f"\n{'='*60}")
        print(f"  Damage models: {trained} trained, {skipped} skipped (waiting for labels)")
        print(f"{'='*60}")


if __name__ == "__main__":
    main()
