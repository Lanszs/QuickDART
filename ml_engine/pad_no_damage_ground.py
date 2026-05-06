"""
Pad the no_damage class for ground-level damage models with Open Images photos.

The new ground-level disaster datasets have very few "Undamaged" examples
per disaster (Fire: 16, Flood: 19, Earthquake: 5). Even after combining with
recovered data, the no_damage class is severely undersized. This script
samples disjoint subsets of raw_data/no_disaster/ (downloaded by
download_no_disaster.py) into each damage model's labeled/no_damage/ folder.

Disjoint sets ensure that fire/flood/earthquake damage models don't share
no_damage examples — useful for evaluation independence.

Files added by this script are prefixed with 'oi_pad_' so they're identifiable
and removable on subsequent runs.

Usage:
    python ml_engine/pad_no_damage_ground.py
    python ml_engine/pad_no_damage_ground.py --count 1500   # per disaster
    python ml_engine/pad_no_damage_ground.py --force        # re-sample
"""

import argparse
import random
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NORMAL_SRC = PROJECT_ROOT / "raw_data" / "no_disaster"

DISASTER_TARGETS = {
    "fire": PROJECT_ROOT / "dataset_damage_fire" / "labeled" / "no_damage",
    "flood": PROJECT_ROOT / "dataset_damage_flood" / "labeled" / "no_damage",
    "earthquake": PROJECT_ROOT / "dataset_damage_earthquake" / "labeled" / "no_damage",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
DEFAULT_COUNT = 1500
SEED = 42
FILE_PREFIX = "oi_pad"  # marks files added by this script


def collect_images(folder):
    return sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def count_existing_pad(target_dir):
    """Count files in target_dir that were added by a previous run of this script."""
    if not target_dir.exists():
        return 0
    return sum(
        1 for p in target_dir.iterdir()
        if p.is_file() and p.name.startswith(FILE_PREFIX)
    )


def remove_existing_pad(target_dir):
    """Remove only the files this script added, leaving any user-labeled images intact."""
    if not target_dir.exists():
        return 0
    removed = 0
    for p in target_dir.iterdir():
        if p.is_file() and p.name.startswith(FILE_PREFIX):
            p.unlink()
            removed += 1
    return removed


def main():
    parser = argparse.ArgumentParser(
        description="Sample disjoint Open Images photos into each damage model's no_damage folder."
    )
    parser.add_argument('--count', type=int, default=DEFAULT_COUNT,
                        help=f"Images per disaster (default: {DEFAULT_COUNT})")
    parser.add_argument('--force', action='store_true',
                        help="Re-sample even if pads already exist")
    args = parser.parse_args()

    print("=" * 55)
    print("  Padding no_damage class with Open Images photos")
    print("=" * 55)

    if not NORMAL_SRC.exists():
        print(f"ERROR: {NORMAL_SRC} not found.")
        print("  Run download_no_disaster.py first.")
        sys.exit(1)

    all_normal = collect_images(NORMAL_SRC)
    print(f"  Open Images pool: {len(all_normal)} images")

    needed = args.count * len(DISASTER_TARGETS)
    if len(all_normal) < needed:
        print(f"ERROR: need {needed} images ({args.count} x 3), only {len(all_normal)} available.")
        print(f"  Run: python ml_engine/download_no_disaster.py --count {needed} --force")
        sys.exit(1)

    rng = random.Random(SEED)
    shuffled = list(all_normal)
    rng.shuffle(shuffled)

    slices = {}
    for i, disaster in enumerate(DISASTER_TARGETS.keys()):
        start = i * args.count
        slices[disaster] = shuffled[start:start + args.count]

    for disaster, target_dir in DISASTER_TARGETS.items():
        print(f"\n  {disaster}:")

        existing_pad = count_existing_pad(target_dir)
        if existing_pad > 0 and not args.force:
            print(f"    Already padded ({existing_pad} files starting with '{FILE_PREFIX}_'). Use --force to re-do.")
            continue

        target_dir.mkdir(parents=True, exist_ok=True)

        if args.force and existing_pad > 0:
            removed = remove_existing_pad(target_dir)
            print(f"    Removed {removed} previously-padded files")

        existing_user_labeled = sum(
            1 for p in target_dir.iterdir()
            if p.is_file() and not p.name.startswith(FILE_PREFIX)
        )

        copied = 0
        for src in slices[disaster]:
            dest_name = f"{FILE_PREFIX}_{src.name}"
            dest = target_dir / dest_name
            if dest.exists():
                continue
            shutil.copy2(src, dest)
            copied += 1

        print(f"    user-labeled + recovered no_damage: {existing_user_labeled}")
        print(f"    + padded from Open Images:          {copied}")
        print(f"    total no_damage:                    {existing_user_labeled + copied}")

    print("\nDone. Re-run with --force to re-sample, or pass --count N to change pad size.")


if __name__ == "__main__":
    main()
