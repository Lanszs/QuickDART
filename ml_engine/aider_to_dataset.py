"""
AIDER -> QuickDART Dataset Converter (Aerial).

Reads the extracted AIDER dataset and produces:

  1. dataset_disaster_type_aerial/{train,val}/{Earthquake,Fire,Flood,No Disaster}/
     Used to train the aerial disaster TYPE classifier. 80/20 train/val split.
     Normal class is downsampled to match disaster classes for balance.

  2. dataset_damage_{fire,flood,earthquake}_aerial/raw_unlabeled/
     Staging folders. User labels these by damage level using
     label_damage_aerial.py before training the aerial damage models.

The raw AIDER folder under raw_data/aider/extracted/ is NOT modified.

Usage:
    python ml_engine/aider_to_dataset.py
    python ml_engine/aider_to_dataset.py --force   # overwrite existing dataset folders
"""

import argparse
import random
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
AIDER_ROOT = PROJECT_ROOT / "raw_data" / "aider" / "extracted" / "AIDER"

TYPE_DATASET_DIR = PROJECT_ROOT / "dataset_disaster_type_aerial"
DAMAGE_DATASET_DIRS = {
    "Fire": PROJECT_ROOT / "dataset_damage_fire_aerial",
    "Flood": PROJECT_ROOT / "dataset_damage_flood_aerial",
    "Earthquake": PROJECT_ROOT / "dataset_damage_earthquake_aerial",
}

# AIDER folder name -> QuickDART type class name
AIDER_TO_TYPE = {
    "fire": "Fire",
    "flooded_areas": "Flood",
    "collapsed_building": "Earthquake",
    "normal": "No Disaster",
    # "traffic_incident" intentionally dropped
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
TRAIN_RATIO = 0.8
SEED = 42


def collect_images(folder):
    """Return sorted list of image Paths in a folder (non-recursive)."""
    return sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def split_train_val(images, train_ratio=TRAIN_RATIO, seed=SEED):
    """Deterministic 80/20 split."""
    rng = random.Random(seed)
    shuffled = list(images)
    rng.shuffle(shuffled)
    cut = int(len(shuffled) * train_ratio)
    return shuffled[:cut], shuffled[cut:]


def copy_images(images, dest_dir, prefix="aider"):
    """Copy images into dest_dir, prefixing filenames to avoid collisions."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for src in images:
        dest_name = f"{prefix}_{src.name}"
        shutil.copy2(src, dest_dir / dest_name)
        copied += 1
    return copied


def clear_dir(path):
    """Remove a directory if it exists."""
    if path.exists():
        shutil.rmtree(path)


def build_type_dataset(force=False):
    """
    Populate dataset_disaster_type_aerial/{train,val}/<class>/.
    Caps each class at the smallest disaster-class count for balance.
    """
    print(f"\n{'='*55}")
    print(f"  Building disaster TYPE dataset (aerial)")
    print(f"{'='*55}")

    if TYPE_DATASET_DIR.exists() and not force:
        print(f"  {TYPE_DATASET_DIR} already exists. Use --force to overwrite.")
        return
    if force:
        clear_dir(TYPE_DATASET_DIR)

    # First pass: collect images per class and figure out the cap
    per_class = {}
    for aider_name, type_class in AIDER_TO_TYPE.items():
        src = AIDER_ROOT / aider_name
        if not src.exists():
            print(f"  WARNING: missing AIDER folder {src}, skipping")
            continue
        per_class[type_class] = collect_images(src)
        print(f"  {type_class:<15} (from {aider_name}): {len(per_class[type_class])} images")

    # Cap = smallest count among disaster classes (excludes No Disaster)
    disaster_counts = [
        len(v) for k, v in per_class.items() if k != "No Disaster"
    ]
    if not disaster_counts:
        print("  ERROR: no disaster-class images found")
        sys.exit(1)
    cap = min(disaster_counts)
    print(f"\n  Balancing: capping each class at {cap} images")

    # Apply cap (deterministic via seed) and split
    rng = random.Random(SEED)
    total_train = total_val = 0

    for type_class, imgs in per_class.items():
        if len(imgs) > cap:
            sampled = list(imgs)
            rng.shuffle(sampled)
            sampled = sampled[:cap]
        else:
            sampled = imgs

        train_imgs, val_imgs = split_train_val(sampled)

        n_train = copy_images(train_imgs, TYPE_DATASET_DIR / "train" / type_class)
        n_val = copy_images(val_imgs, TYPE_DATASET_DIR / "val" / type_class)

        print(f"  {type_class:<15}: train={n_train}, val={n_val}")
        total_train += n_train
        total_val += n_val

    print(f"\n  Total: train={total_train}, val={total_val}")


def build_damage_staging(force=False):
    """
    Stage disaster-only images into dataset_damage_<type>_aerial/raw_unlabeled/
    for the user to label by damage level.
    """
    print(f"\n{'='*55}")
    print(f"  Staging damage-labeling folders (aerial)")
    print(f"{'='*55}")

    aider_to_type_filtered = {
        "fire": "Fire",
        "flooded_areas": "Flood",
        "collapsed_building": "Earthquake",
    }

    for aider_name, type_class in aider_to_type_filtered.items():
        src = AIDER_ROOT / aider_name
        dest = DAMAGE_DATASET_DIRS[type_class] / "raw_unlabeled"

        if dest.exists() and not force:
            existing_count = len(collect_images(dest))
            print(f"  {dest} already exists ({existing_count} images). Use --force to overwrite.")
            continue
        if force:
            clear_dir(dest)

        if not src.exists():
            print(f"  WARNING: missing AIDER folder {src}, skipping")
            continue

        images = collect_images(src)
        n_copied = copy_images(images, dest)
        print(f"  {type_class:<11} -> {dest.relative_to(PROJECT_ROOT)}: {n_copied} images")


def print_summary():
    """Print final dataset summary."""
    print(f"\n{'='*55}")
    print(f"  Final Summary")
    print(f"{'='*55}")

    if TYPE_DATASET_DIR.exists():
        print(f"\n  {TYPE_DATASET_DIR.name}/")
        for split in ["train", "val"]:
            split_dir = TYPE_DATASET_DIR / split
            if not split_dir.exists():
                continue
            print(f"    {split}/")
            for cls_dir in sorted(split_dir.iterdir()):
                if cls_dir.is_dir():
                    n = len(collect_images(cls_dir))
                    print(f"      {cls_dir.name:<15} {n:>4}")

    for type_class, dataset_dir in DAMAGE_DATASET_DIRS.items():
        unlabeled = dataset_dir / "raw_unlabeled"
        if unlabeled.exists():
            n = len(collect_images(unlabeled))
            print(f"\n  {dataset_dir.name}/raw_unlabeled/  {n} images (waiting for damage labels)")


def main():
    parser = argparse.ArgumentParser(
        description="Convert AIDER raw folders into QuickDART aerial datasets."
    )
    parser.add_argument('--force', action='store_true',
                        help="Overwrite existing dataset folders")
    args = parser.parse_args()

    print("=" * 55)
    print("  AIDER -> QuickDART Aerial Dataset Converter")
    print("=" * 55)

    if not AIDER_ROOT.exists():
        print(f"\nERROR: AIDER folder not found at {AIDER_ROOT}")
        print("  Run `python ml_engine/download_aerial.py` first.")
        sys.exit(1)

    build_type_dataset(force=args.force)
    build_damage_staging(force=args.force)
    print_summary()

    print("\nNext steps:")
    print("  1. (Optional) Inspect dataset_disaster_type_aerial/ to spot-check labels")
    print("  2. Run `python ml_engine/label_damage_aerial.py` to label damage levels")


if __name__ == "__main__":
    main()
