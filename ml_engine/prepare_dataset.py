"""
Dataset Preparation Helper for QuickDART ML Models.

Organizes downloaded images into the correct folder structure for training.
Supports adding new classes (e.g., no_disaster) and balancing existing ones.

Usage examples:
    # Add "No Disaster" images to disaster type dataset
    python prepare_dataset.py --source ./raw_data/no_disaster_images --target disaster_type --class-name no_disaster

    # Add fire damage "destroyed" images to damage level dataset
    python prepare_dataset.py --source ./raw_data/fire_destroyed --target damage_level --class-name destroyed

    # Dry run to see what would happen
    python prepare_dataset.py --source ./raw_data/images --target disaster_type --class-name no_disaster --dry-run
"""

import os
import sys
import shutil
import random
import argparse
from pathlib import Path
from collections import Counter

# Supported image extensions
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'}

# Project root (one level up from ml_engine/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATASET_DIRS = {
    'disaster_type': PROJECT_ROOT / 'dataset_disaster_type',
    'damage_level': PROJECT_ROOT / 'dataset_damage_level',
    'damage_fire': PROJECT_ROOT / 'dataset_damage_fire',
}


def collect_images(source_dir):
    """Recursively collect all image files from a directory."""
    source = Path(source_dir)
    if not source.exists():
        print(f"Error: Source directory does not exist: {source}")
        sys.exit(1)

    images = []
    for f in source.rglob('*'):
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(f)

    return sorted(images)


def get_dataset_summary(dataset_dir):
    """Print class distribution for a dataset directory."""
    dataset = Path(dataset_dir)
    summary = {}

    for split in ['train', 'val']:
        split_dir = dataset / split
        if not split_dir.exists():
            continue
        summary[split] = {}
        for class_dir in sorted(split_dir.iterdir()):
            if class_dir.is_dir():
                count = sum(1 for f in class_dir.iterdir()
                            if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS)
                summary[split][class_dir.name] = count

    return summary


def print_summary(summary, title="Dataset Summary"):
    """Pretty-print a dataset summary."""
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}")

    for split, classes in summary.items():
        total = sum(classes.values())
        print(f"\n  {split.upper()} ({total} total):")
        for cls, count in classes.items():
            bar = '#' * min(count // 20, 40)
            print(f"    {cls:<15} {count:>6}  {bar}")

    print()


def copy_images_to_dataset(images, dataset_dir, class_name, train_ratio=0.8,
                           seed=42, dry_run=False):
    """
    Split images into train/val and copy to the dataset folder structure.

    Args:
        images: list of Path objects to image files
        dataset_dir: Path to dataset root (e.g., dataset_disaster_type/)
        class_name: target class folder name (e.g., 'no_disaster')
        train_ratio: fraction for training set (default 0.8)
        seed: random seed for reproducible splits
        dry_run: if True, only print what would happen
    """
    random.seed(seed)
    shuffled = list(images)
    random.shuffle(shuffled)

    split_idx = int(len(shuffled) * train_ratio)
    train_images = shuffled[:split_idx]
    val_images = shuffled[split_idx:]

    train_dir = Path(dataset_dir) / 'train' / class_name
    val_dir = Path(dataset_dir) / 'val' / class_name

    if dry_run:
        print(f"\n[DRY RUN] Would copy {len(train_images)} images to {train_dir}")
        print(f"[DRY RUN] Would copy {len(val_images)} images to {val_dir}")
        return

    train_dir.mkdir(parents=True, exist_ok=True)
    val_dir.mkdir(parents=True, exist_ok=True)

    def copy_batch(file_list, dest_dir):
        existing = set(f.name for f in dest_dir.iterdir() if f.is_file())
        copied = 0
        for src in file_list:
            dest_name = src.name
            # Handle filename collisions
            counter = 1
            while dest_name in existing:
                stem = src.stem
                dest_name = f"{stem}_{counter}{src.suffix}"
                counter += 1
            existing.add(dest_name)
            shutil.copy2(src, dest_dir / dest_name)
            copied += 1
        return copied

    n_train = copy_batch(train_images, train_dir)
    n_val = copy_batch(val_images, val_dir)

    print(f"  Copied {n_train} images to {train_dir}")
    print(f"  Copied {n_val} images to {val_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Organize downloaded images into QuickDART dataset folders."
    )
    parser.add_argument('--source', required=True,
                        help='Directory containing downloaded images')
    parser.add_argument('--target', required=True, choices=['disaster_type', 'damage_level', 'damage_fire'],
                        help='Which dataset to add images to')
    parser.add_argument('--class-name', required=True,
                        help='Target class folder name (e.g., no_disaster, destroyed, fire)')
    parser.add_argument('--train-ratio', type=float, default=0.8,
                        help='Fraction of images for training (default: 0.8)')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed for train/val split (default: 42)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would happen without copying files')

    args = parser.parse_args()

    dataset_dir = DATASET_DIRS[args.target]

    # Show current state
    print("BEFORE:")
    before = get_dataset_summary(dataset_dir)
    print_summary(before, f"Current {args.target} Dataset")

    # Collect source images
    images = collect_images(args.source)
    print(f"Found {len(images)} images in {args.source}")

    if not images:
        print("No images found. Exiting.")
        sys.exit(1)

    # Copy to dataset
    print(f"\nAdding to class '{args.class_name}'...")
    copy_images_to_dataset(
        images, dataset_dir, args.class_name,
        train_ratio=args.train_ratio,
        seed=args.seed,
        dry_run=args.dry_run
    )

    # Show updated state
    if not args.dry_run:
        print("\nAFTER:")
        after = get_dataset_summary(dataset_dir)
        print_summary(after, f"Updated {args.target} Dataset")


if __name__ == '__main__':
    main()
