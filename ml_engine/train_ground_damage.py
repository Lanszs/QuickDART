"""
Train per-disaster ground-level damage models.

Reuses train_disaster_model from train_classifier.py. Trains 3 specialist
damage models (one per disaster type), mirroring the aerial architecture:
  - damage_fire_model.pth        (4-class: destroyed/major/minor/no_damage)
  - damage_flood_model.pth       (4-class)
  - damage_earthquake_model.pth  (4-class)

Datasets that haven't been split into train/ and val/ yet are skipped with a
warning. To split a dataset, run:
    python ml_engine/label_damage_ground.py --disaster <type> --split --max-samples N

Usage:
    python ml_engine/train_ground_damage.py                   # train all available
    python ml_engine/train_ground_damage.py --disaster fire   # one specific disaster
"""

import argparse
import os
from pathlib import Path

from train_classifier import train_disaster_model

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DAMAGE_CONFIGS = {
    "fire": {
        "name": "Ground Fire Damage",
        "data_dir": str(PROJECT_ROOT / "dataset_damage_fire"),
        "save_path": str(PROJECT_ROOT / "ml_engine" / "damage_fire_model.pth"),
        "num_classes": 4,
        "satellite_mode": False,  # ground-level: aggressive augmentation
    },
    "flood": {
        "name": "Ground Flood Damage",
        "data_dir": str(PROJECT_ROOT / "dataset_damage_flood"),
        "save_path": str(PROJECT_ROOT / "ml_engine" / "damage_flood_model.pth"),
        "num_classes": 4,
        "satellite_mode": False,
    },
    "earthquake": {
        "name": "Ground Earthquake Damage",
        "data_dir": str(PROJECT_ROOT / "dataset_damage_earthquake"),
        "save_path": str(PROJECT_ROOT / "ml_engine" / "damage_earthquake_model.pth"),
        "num_classes": 4,
        "satellite_mode": False,
    },
}


def is_dataset_ready(data_dir):
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
        print(f"  -> Run: python ml_engine/label_damage_ground.py --disaster <name> --split --max-samples N")
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
    parser = argparse.ArgumentParser(description="Train ground-level damage models.")
    parser.add_argument(
        '--disaster', choices=list(DAMAGE_CONFIGS.keys()),
        help="Train only this disaster's damage model (default: all available)",
    )
    args = parser.parse_args()

    if args.disaster:
        configs_to_train = [DAMAGE_CONFIGS[args.disaster]]
    else:
        configs_to_train = list(DAMAGE_CONFIGS.values())

    trained = 0
    skipped = 0
    for config in configs_to_train:
        if train_one(config):
            trained += 1
        else:
            skipped += 1

    print(f"\n{'='*60}")
    print(f"  Done: {trained} trained, {skipped} skipped (waiting for labels)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
