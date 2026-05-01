"""
AIDER Aerial Dataset Downloader for QuickDART.

Downloads the AIDER (Aerial Image Dataset for Emergency Response) dataset
from Zenodo and extracts it to a local raw folder for further processing
by aider_to_dataset.py.

AIDER classes (~500 each, except Normal which has 4000+):
  - fire     -> Fire disaster type
  - flood    -> Flood disaster type
  - collapsed_building -> Earthquake disaster type (proxy)
  - normal   -> No Disaster
  - traffic_incident   -> dropped (not used)

Source: https://zenodo.org/records/3888300
License: CC BY 4.0
Citation: Kyrkou & Theocharides, 2019.

Usage:
    python ml_engine/download_aerial.py
    python ml_engine/download_aerial.py --skip-download  # if AIDER.zip already exists
    python ml_engine/download_aerial.py --skip-extract   # download only, no unzip
"""

import argparse
import hashlib
import os
import shutil
import sys
import zipfile
from pathlib import Path
from urllib.request import urlopen, Request

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "raw_data" / "aider"
ZIP_PATH = RAW_DIR / "AIDER.zip"
EXTRACT_DIR = RAW_DIR / "extracted"

AIDER_URL = "https://zenodo.org/records/3888300/files/AIDER.zip?download=1"
EXPECTED_SIZE_MB = 275.7
CHUNK_SIZE = 1024 * 1024  # 1 MB

EXPECTED_CLASSES = {"fire", "flood", "collapsed_building", "normal", "traffic_incident"}


def human_size(num_bytes):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if num_bytes < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} TB"


def download_file(url, dest_path):
    """Stream download with progress."""
    print(f"Downloading from: {url}")
    print(f"Saving to: {dest_path}")

    req = Request(url, headers={'User-Agent': 'QuickDART/1.0'})

    with urlopen(req) as response:
        total_size = int(response.headers.get('Content-Length', 0))
        print(f"Total size: {human_size(total_size)}")

        downloaded = 0
        last_pct = -1

        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, 'wb') as f:
            while True:
                chunk = response.read(CHUNK_SIZE)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)

                if total_size > 0:
                    pct = int(downloaded * 100 / total_size)
                    if pct != last_pct and pct % 5 == 0:
                        print(f"  {pct}% ({human_size(downloaded)} / {human_size(total_size)})")
                        last_pct = pct

    print(f"Download complete: {human_size(dest_path.stat().st_size)}")


def extract_zip(zip_path, extract_dir):
    """Extract zip and return path to AIDER root folder."""
    print(f"\nExtracting {zip_path.name}...")
    extract_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, 'r') as zf:
        members = zf.namelist()
        print(f"  Archive contains {len(members)} entries")
        zf.extractall(extract_dir)

    print(f"Extracted to: {extract_dir}")


def find_aider_root(extract_dir):
    """
    Locate the directory containing the class folders.
    AIDER may extract as extract_dir/AIDER/<class>/ or extract_dir/<class>/.
    """
    candidates = [extract_dir] + [p for p in extract_dir.iterdir() if p.is_dir()]
    for candidate in candidates:
        subdirs = {p.name.lower() for p in candidate.iterdir() if p.is_dir()}
        # Match if any expected class folder is present (case-insensitive, lenient on naming)
        if any(c in name or name in c for c in EXPECTED_CLASSES for name in subdirs):
            return candidate
    return None


def report_class_counts(aider_root):
    """Print image counts for each class folder found."""
    print(f"\n{'='*55}")
    print(f"  AIDER Class Counts ({aider_root})")
    print(f"{'='*55}")

    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp'}
    total = 0

    for class_dir in sorted(aider_root.iterdir()):
        if not class_dir.is_dir():
            continue
        count = sum(
            1 for f in class_dir.rglob('*')
            if f.is_file() and f.suffix.lower() in image_extensions
        )
        bar = '#' * min(count // 100, 50)
        print(f"  {class_dir.name:<25} {count:>6}  {bar}")
        total += count

    print(f"  {'TOTAL':<25} {total:>6}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Download and extract the AIDER aerial disaster dataset."
    )
    parser.add_argument('--skip-download', action='store_true',
                        help="Skip download (use existing AIDER.zip)")
    parser.add_argument('--skip-extract', action='store_true',
                        help="Skip extraction (download only)")
    parser.add_argument('--force', action='store_true',
                        help="Re-download/re-extract even if files exist")
    args = parser.parse_args()

    print("=" * 55)
    print("  AIDER Aerial Dataset Downloader")
    print("=" * 55)
    print(f"Target raw folder: {RAW_DIR}")
    print()

    # --- Download ---
    if args.skip_download:
        if not ZIP_PATH.exists():
            print(f"ERROR: --skip-download set but {ZIP_PATH} does not exist.")
            sys.exit(1)
        print(f"Skipping download. Using existing zip: {ZIP_PATH}")
    elif ZIP_PATH.exists() and not args.force:
        size_mb = ZIP_PATH.stat().st_size / (1024 * 1024)
        print(f"Zip already exists: {ZIP_PATH} ({size_mb:.1f} MB)")
        print(f"  Skipping download. Use --force to re-download.")
    else:
        try:
            download_file(AIDER_URL, ZIP_PATH)
        except Exception as e:
            print(f"\nERROR during download: {e}")
            print(f"You can manually download from: {AIDER_URL}")
            print(f"  and place the file at: {ZIP_PATH}")
            sys.exit(1)

    if args.skip_extract:
        print("\nSkipping extraction (--skip-extract).")
        return

    # --- Extract ---
    if EXTRACT_DIR.exists() and not args.force:
        print(f"\nExtraction folder already exists: {EXTRACT_DIR}")
        print(f"  Skipping extract. Use --force to re-extract.")
    else:
        if EXTRACT_DIR.exists() and args.force:
            print(f"Removing existing extract folder: {EXTRACT_DIR}")
            shutil.rmtree(EXTRACT_DIR)
        try:
            extract_zip(ZIP_PATH, EXTRACT_DIR)
        except Exception as e:
            print(f"\nERROR during extraction: {e}")
            sys.exit(1)

    # --- Verify ---
    aider_root = find_aider_root(EXTRACT_DIR)
    if aider_root is None:
        print(f"\nWARNING: Could not locate AIDER class folders inside {EXTRACT_DIR}.")
        print(f"  Inspect the folder manually and update aider_to_dataset.py paths.")
        sys.exit(1)

    report_class_counts(aider_root)

    print(f"AIDER root path: {aider_root}")
    print("Next step: run `python ml_engine/aider_to_dataset.py`")


if __name__ == "__main__":
    main()
