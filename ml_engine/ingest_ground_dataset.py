"""
Consolidate ground-level disaster type training data into dataset_disaster_type/.

Pools all source folders for each disaster class (recovered + new + unclassified),
recursively collects every image, randomly samples a target count, and creates
80/20 train/val splits.

Multiple source folders per class are supported so recovered + new datasets can
be merged. Subfolders inside each source (e.g. Major / Minor / Undamaged in the
new datasets) are flattened — the disaster TYPE model only cares about which
disaster the image belongs to, not the damage level.

Usage:
    python ml_engine/ingest_ground_dataset.py \\
        --fire "E:\\Fire Dataset-20260503T151535Z-3-001\\Fire Dataset" \\
               "<recovered fire path>" \\
        --flood "E:\\Flood Dataset-20260503T152301Z-3-001\\Flood Dataset" \\
                "E:\\Flood Dataset-20260503T152301Z-3-002\\Flood Dataset" \\
                "<recovered flood path>" \\
        --earthquake "E:\\Earthquake Dataset-20260503T150425Z-3-001\\Earthquake Dataset" \\
                     "<recovered earthquake path>" \\
        --no-disaster raw_data/no_disaster \\
        --max-samples 3000

Run with --force to overwrite existing dataset_disaster_type/ folders.
"""

import argparse
import random
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TARGET_DIR = PROJECT_ROOT / "dataset_disaster_type"

CLASS_NAMES = ["earthquake", "fire", "flood", "no_disaster"]
DEFAULT_MAX_SAMPLES = 3000
DEFAULT_TRAIN_RATIO = 0.8
SEED = 42

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}


def collect_class_images(source_folders):
    """Pool images recursively from all source folders, deduplicating by resolved path."""
    pool = []
    seen = set()
    for folder_str in source_folders:
        folder = Path(folder_str)
        if not folder.exists():
            print(f"    WARNING: {folder} does not exist, skipping")
            continue
        images = sorted(
            p for p in folder.rglob("*")
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        )
        added = 0
        for img in images:
            resolved = img.resolve()
            if resolved not in seen:
                seen.add(resolved)
                pool.append(img)
                added += 1
        print(f"    {folder}: {added} images (after dedup)")
    return pool


def collision_safe_copy(src, dest_dir):
    dest = dest_dir / src.name
    if dest.exists():
        stem, suffix = src.stem, src.suffix
        i = 1
        while (dest_dir / f"{stem}_{i}{suffix}").exists():
            i += 1
        dest = dest_dir / f"{stem}_{i}{suffix}"
    shutil.copy2(src, dest)


def process_class(class_name, source_folders, max_samples, train_ratio, rng, force):
    print(f"\n{'='*55}")
    print(f"  Class: {class_name}")
    print(f"{'='*55}")

    if not source_folders:
        print(f"  WARNING: no source folders provided, skipping")
        return 0, 0, 0

    pool = collect_class_images(source_folders)
    if not pool:
        print(f"  WARNING: no images found, skipping")
        return 0, 0, 0

    total_in_pool = len(pool)
    print(f"  Total pool: {total_in_pool} images")

    shuffled = list(pool)
    rng.shuffle(shuffled)

    if len(shuffled) > max_samples:
        sampled = shuffled[:max_samples]
        print(f"  Sampled {max_samples} (capped from {total_in_pool})")
    else:
        sampled = shuffled
        print(f"  Using all {len(sampled)} (under max-samples cap)")

    cut = int(len(sampled) * train_ratio)
    train_imgs = sampled[:cut]
    val_imgs = sampled[cut:]

    train_dir = TARGET_DIR / "train" / class_name
    val_dir = TARGET_DIR / "val" / class_name

    if train_dir.exists():
        if force:
            shutil.rmtree(train_dir)
        else:
            print(f"  ERROR: {train_dir} already exists. Use --force to overwrite.")
            sys.exit(1)
    if val_dir.exists():
        if force:
            shutil.rmtree(val_dir)
        else:
            print(f"  ERROR: {val_dir} already exists. Use --force to overwrite.")
            sys.exit(1)

    train_dir.mkdir(parents=True, exist_ok=True)
    val_dir.mkdir(parents=True, exist_ok=True)

    print(f"  Copying {len(train_imgs)} -> train/{class_name}/")
    for src in train_imgs:
        collision_safe_copy(src, train_dir)
    print(f"  Copying {len(val_imgs)} -> val/{class_name}/")
    for src in val_imgs:
        collision_safe_copy(src, val_dir)

    return len(train_imgs), len(val_imgs), total_in_pool


def main():
    parser = argparse.ArgumentParser(
        description="Consolidate ground-level disaster type training data."
    )
    parser.add_argument('--fire', nargs='+', default=[],
                        help="One or more fire source folders")
    parser.add_argument('--flood', nargs='+', default=[],
                        help="One or more flood source folders")
    parser.add_argument('--earthquake', nargs='+', default=[],
                        help="One or more earthquake source folders")
    parser.add_argument('--no-disaster', nargs='+', default=[],
                        help="One or more no-disaster source folders "
                             "(e.g. raw_data/no_disaster)")
    parser.add_argument('--max-samples', type=int, default=DEFAULT_MAX_SAMPLES,
                        help=f"Max images per class (default: {DEFAULT_MAX_SAMPLES})")
    parser.add_argument('--train-ratio', type=float, default=DEFAULT_TRAIN_RATIO,
                        help=f"Train/val split ratio (default: {DEFAULT_TRAIN_RATIO})")
    parser.add_argument('--force', action='store_true',
                        help="Overwrite existing train/<class> and val/<class> folders")
    args = parser.parse_args()

    sources = {
        "earthquake": args.earthquake,
        "fire": args.fire,
        "flood": args.flood,
        "no_disaster": args.no_disaster,
    }

    rng = random.Random(SEED)

    print("=" * 55)
    print(f"  Ingesting ground-level disaster type dataset")
    print(f"  Target: {TARGET_DIR}")
    print(f"  Max samples per class: {args.max_samples}")
    print(f"  Train/val ratio:       {args.train_ratio}")
    print("=" * 55)

    summary = {}
    for class_name in CLASS_NAMES:
        train_count, val_count, pool_count = process_class(
            class_name,
            sources[class_name],
            args.max_samples,
            args.train_ratio,
            rng,
            args.force,
        )
        summary[class_name] = (train_count, val_count, pool_count)

    print(f"\n{'='*55}")
    print(f"  Summary")
    print(f"{'='*55}")
    print(f"  {'Class':<14} {'Pool':>8} {'Train':>8} {'Val':>8} {'Total':>8}")
    print(f"  {'-'*14} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
    for class_name in CLASS_NAMES:
        train_count, val_count, pool_count = summary[class_name]
        total = train_count + val_count
        print(f"  {class_name:<14} {pool_count:>8} {train_count:>8} {val_count:>8} {total:>8}")
    print()
    print(f"Done. Run `python ml_engine/train_classifier.py` to train.")


if __name__ == "__main__":
    main()
