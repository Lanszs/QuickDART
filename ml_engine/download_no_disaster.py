"""
Download non-disaster ground-level scene images from Google Open Images V7.

These images serve double duty:
  - The 'no_disaster' class for the ground-level disaster type model
  - Padding for the 'no_damage' class in the 3 ground damage models (later)

Categories chosen to represent normal, ground-level scenes that contain no
disaster imagery (no fire, smoke, flood, collapsed buildings, etc.).

Usage:
    pip install fiftyone
    python ml_engine/download_no_disaster.py
    python ml_engine/download_no_disaster.py --count 3000   # default
    python ml_engine/download_no_disaster.py --force        # re-download
"""

import argparse
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TARGET_DIR = PROJECT_ROOT / "raw_data" / "no_disaster"

# Open Images V7 categories that represent non-disaster ground-level scenes.
# Picked to be diverse (urban / nature / indoor / people) and disaster-free.
NO_DISASTER_CATEGORIES = [
    "Street",
    "Building",
    "Tree",
    "Mountain",
    "Sea",
    "Food",
    "Person",
    "Clothing",
]

DEFAULT_COUNT = 3000
SEED = 42

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}


def count_existing(folder):
    if not folder.exists():
        return 0
    return sum(
        1 for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def main():
    parser = argparse.ArgumentParser(
        description="Download non-disaster scene images from Open Images V7."
    )
    parser.add_argument('--count', type=int, default=DEFAULT_COUNT,
                        help=f"Total images to download (default: {DEFAULT_COUNT})")
    parser.add_argument('--force', action='store_true',
                        help="Re-download even if target folder already has images")
    args = parser.parse_args()

    print("=" * 55)
    print(f"  Downloading {args.count} non-disaster images")
    print(f"  from Open Images V7 ({len(NO_DISASTER_CATEGORIES)} categories)")
    print("=" * 55)
    print(f"  Categories: {', '.join(NO_DISASTER_CATEGORIES)}")
    print(f"  Target:     {TARGET_DIR}")
    print()

    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    existing = count_existing(TARGET_DIR)
    if existing > 0 and not args.force:
        print(f"  Already have {existing} images in {TARGET_DIR}.")
        print(f"  Use --force to re-download.")
        return

    if args.force and existing > 0:
        for p in list(TARGET_DIR.iterdir()):
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS:
                p.unlink()
        print(f"  Removed {existing} previously-downloaded images.")

    try:
        import fiftyone.zoo as foz
    except ImportError:
        print("ERROR: fiftyone is not installed in this environment.")
        print("  Install with:  pip install fiftyone")
        print("  Note: fiftyone may not support Python 3.13 yet. If install fails,")
        print("  create a Python 3.11 venv just for this download step.")
        sys.exit(1)

    print("  Loading Open Images V7 (validation split, classifications only).")
    print("  First run downloads ~200-400 MB of metadata; subsequent runs are fast.")
    print()

    try:
        dataset = foz.load_zoo_dataset(
            "open-images-v7",
            split="validation",
            label_types=["classifications"],
            classes=NO_DISASTER_CATEGORIES,
            max_samples=args.count,
            seed=SEED,
            shuffle=True,
        )
    except Exception as e:
        print(f"\nERROR while loading dataset from fiftyone zoo:")
        print(f"  {e}")
        print("\n  Common fixes:")
        print("    - Check internet connection")
        print("    - Run: pip install --upgrade fiftyone")
        print("    - Check available disk space (Open Images metadata is large)")
        sys.exit(1)

    print(f"\n  fiftyone returned {len(dataset)} samples. Copying to {TARGET_DIR}...")

    copied = 0
    skipped = 0
    for sample in dataset:
        src = Path(sample.filepath)
        if not src.exists():
            skipped += 1
            continue
        dest = TARGET_DIR / src.name
        if dest.exists():
            stem, suffix = src.stem, src.suffix
            i = 1
            while (TARGET_DIR / f"{stem}_{i}{suffix}").exists():
                i += 1
            dest = TARGET_DIR / f"{stem}_{i}{suffix}"
        try:
            shutil.copy2(src, dest)
            copied += 1
        except OSError as e:
            print(f"    WARNING: failed to copy {src.name}: {e}")
            skipped += 1

        if copied > 0 and copied % 200 == 0:
            print(f"    {copied} / {len(dataset)} copied")

    print(f"\nDone. {copied} images saved to {TARGET_DIR}")
    if skipped > 0:
        print(f"  ({skipped} samples skipped due to missing files or errors)")
    print(f"\nNext step: run `python ml_engine/ingest_ground_dataset.py ...`")


if __name__ == "__main__":
    main()
