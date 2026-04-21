"""
xView2 GeoTIFF to QuickDART Dataset Converter

Reads xView2 JSON labels and GeoTIFF satellite images, crops individual buildings,
and sorts them into the damage level dataset folder structure.

Targets:
  - dataset_damage_level/train/destroyed:  +535 images (half fire, half flood)
  - dataset_damage_level/train/major:      +30  images (half fire, half flood)
  - dataset_damage_level/train/minor:      +654 images (half fire, half flood)
  - dataset_damage_level/train/no_damage:  downsample from 1401 to 800
  - dataset_damage_level/val/*:            200 images each for all 4 classes

Usage:
    python ml_engine/xview2_to_dataset.py
"""

import json
import os
import re
import random
import shutil
import numpy as np
from pathlib import Path
from collections import defaultdict

try:
    import tifffile
except ImportError:
    print("Installing tifffile...")
    os.system("python -m pip install tifffile")
    import tifffile

from PIL import Image

# ============================================================
# CONFIG
# ============================================================

XVIEW2_BASE = r"D:\datasets\geotiffs"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = PROJECT_ROOT / "dataset_damage_level"

SEED = 42
MIN_CROP_SIZE = 32  # Skip buildings smaller than 32x32 pixels
OUTPUT_SIZE = 224   # Resize crops to 224x224 for training

# xView2 disaster events categorized as fire or flood
FIRE_EVENTS = {
    "santa-rosa-wildfire", "socal-fire", "woolsey-fire",
    "pinery-bushfire", "portugal-wildfire"
}
FLOOD_EVENTS = {
    "hurricane-florence", "hurricane-harvey", "hurricane-matthew",
    "hurricane-michael", "midwest-flooding", "nepal-flooding",
    "palu-tsunami", "sunda-tsunami"
}

# xView2 label -> QuickDART folder mapping
DAMAGE_MAP = {
    "destroyed": "destroyed",
    "major-damage": "major",
    "minor-damage": "minor",
    "no-damage": "no_damage",
}

# How many NEW images to add to train/ per class, split by disaster type
TRAIN_TARGETS = {
    # class_name: (fire_count, flood_count)
    "destroyed": (268, 267),   # ~535 total
    "major":     (15, 15),     # ~30 total
    "minor":     (327, 327),   # ~654 total
}

# Validation target: 200 images per class
VAL_TARGET_PER_CLASS = 200

# ============================================================
# HELPERS
# ============================================================

def parse_wkt_polygon(wkt_str):
    """Extract pixel coordinates from a WKT POLYGON string."""
    match = re.search(r"POLYGON \(\((.+)\)\)", wkt_str)
    if not match:
        return None
    coords_str = match.group(1)
    coords = []
    for pair in coords_str.split(","):
        parts = pair.strip().split()
        if len(parts) == 2:
            coords.append((float(parts[0]), float(parts[1])))
    return coords


def polygon_to_bbox(coords):
    """Convert polygon coordinates to a bounding box (x_min, y_min, x_max, y_max)."""
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return (int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1)


def load_geotiff_as_rgb(tif_path):
    """Load a GeoTIFF and convert to uint8 RGB numpy array."""
    img = tifffile.imread(tif_path)
    # Clip to valid range and convert to uint8
    img = np.clip(img, 0, 255).astype(np.uint8)
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    elif img.shape[2] > 3:
        img = img[:, :, :3]
    return img


def crop_building(img_array, bbox, output_size=224):
    """Crop a building from the image and resize to output_size."""
    x_min, y_min, x_max, y_max = bbox
    h, w = img_array.shape[:2]

    # Clamp to image bounds
    x_min = max(0, x_min)
    y_min = max(0, y_min)
    x_max = min(w, x_max)
    y_max = min(h, y_max)

    crop_w = x_max - x_min
    crop_h = y_max - y_min

    if crop_w < MIN_CROP_SIZE or crop_h < MIN_CROP_SIZE:
        return None

    # Add some context padding (20% on each side)
    pad_x = int(crop_w * 0.2)
    pad_y = int(crop_h * 0.2)
    x_min = max(0, x_min - pad_x)
    y_min = max(0, y_min - pad_y)
    x_max = min(w, x_max + pad_x)
    y_max = min(h, y_max + pad_y)

    crop = img_array[y_min:y_max, x_min:x_max]
    pil_img = Image.fromarray(crop)
    pil_img = pil_img.resize((output_size, output_size), Image.LANCZOS)
    return pil_img


# ============================================================
# STEP 1: Index all buildings from xView2
# ============================================================

def index_xview2_buildings():
    """
    Scan all xView2 post-disaster labels and index buildings by
    (disaster_category, damage_level).

    Returns dict: {('fire'|'flood', damage_class): [(tif_path, bbox), ...]}
    """
    print("Indexing xView2 buildings...")
    index = defaultdict(list)

    for tier in ["tier1", "tier3"]:
        label_dir = os.path.join(XVIEW2_BASE, tier, "labels")
        image_dir = os.path.join(XVIEW2_BASE, tier, "images")

        if not os.path.exists(label_dir):
            continue

        for label_file in os.listdir(label_dir):
            if not label_file.endswith("_post_disaster.json"):
                continue

            # Extract event name
            base_name = label_file.replace(".json", "")
            parts = base_name.replace("_post_disaster", "")
            idx = parts.rfind("_")
            event = parts[:idx]

            # Categorize disaster type
            if event in FIRE_EVENTS:
                disaster_cat = "fire"
            elif event in FLOOD_EVENTS:
                disaster_cat = "flood"
            else:
                continue

            tif_path = os.path.join(image_dir, base_name + ".tif")
            if not os.path.exists(tif_path):
                continue

            with open(os.path.join(label_dir, label_file)) as f:
                data = json.load(f)

            for bldg in data["features"]["xy"]:
                subtype = bldg["properties"].get("subtype", "")
                if subtype not in DAMAGE_MAP:
                    continue

                damage_class = DAMAGE_MAP[subtype]
                wkt = bldg.get("wkt", "")
                coords = parse_wkt_polygon(wkt)
                if not coords:
                    continue

                bbox = polygon_to_bbox(coords)
                index[(disaster_cat, damage_class)].append((tif_path, bbox))

    # Print summary
    print("\nAvailable buildings from xView2:")
    for (cat, dmg), items in sorted(index.items()):
        print(f"  {cat:>5} / {dmg:<12}: {len(items):>6} buildings")

    return index


# ============================================================
# STEP 2: Extract and save building crops
# ============================================================

def extract_crops(index, disaster_cat, damage_class, count, output_dir, prefix="xv2"):
    """
    Randomly sample `count` buildings from the index and save as JPEGs.
    Returns number of images actually saved.
    """
    key = (disaster_cat, damage_class)
    available = index.get(key, [])

    if not available:
        print(f"  WARNING: No {disaster_cat}/{damage_class} buildings available!")
        return 0

    random.shuffle(available)

    os.makedirs(output_dir, exist_ok=True)
    saved = 0
    # Cache loaded images to avoid re-reading the same TIF
    img_cache = {}

    for tif_path, bbox in available:
        if saved >= count:
            break

        if tif_path not in img_cache:
            try:
                img_cache[tif_path] = load_geotiff_as_rgb(tif_path)
            except Exception as e:
                print(f"  Error loading {tif_path}: {e}")
                continue

        img_array = img_cache[tif_path]
        crop = crop_building(img_array, bbox, OUTPUT_SIZE)
        if crop is None:
            continue

        filename = f"{prefix}_{disaster_cat}_{damage_class}_{saved:04d}.jpg"
        crop.save(os.path.join(output_dir, filename), "JPEG", quality=95)
        saved += 1

        if saved % 50 == 0:
            print(f"    Saved {saved}/{count} {disaster_cat}/{damage_class} crops...")

    # Clear cache
    img_cache.clear()
    return saved


# ============================================================
# STEP 3: Downsample no_damage in train/
# ============================================================

def downsample_class(class_dir, target_count):
    """Randomly remove images from a class directory to reach target_count."""
    images = [f for f in os.listdir(class_dir)
              if os.path.isfile(os.path.join(class_dir, f))]

    current = len(images)
    if current <= target_count:
        print(f"  {class_dir}: already at {current} (target {target_count}), no downsampling needed")
        return

    random.shuffle(images)
    to_remove = images[target_count:]

    for f in to_remove:
        os.remove(os.path.join(class_dir, f))

    print(f"  Downsampled {class_dir}: {current} -> {target_count} (removed {len(to_remove)})")


# ============================================================
# STEP 4: Balance validation set to 200 per class
# ============================================================

def balance_val_set(index):
    """Ensure each val/ class has exactly VAL_TARGET_PER_CLASS images."""
    val_dir = DATASET_DIR / "val"

    for damage_class in ["destroyed", "major", "minor", "no_damage"]:
        class_dir = val_dir / damage_class
        os.makedirs(class_dir, exist_ok=True)

        existing = [f for f in os.listdir(class_dir)
                    if os.path.isfile(os.path.join(class_dir, f))]
        current = len(existing)

        if current >= VAL_TARGET_PER_CLASS:
            # Downsample if over target
            if current > VAL_TARGET_PER_CLASS:
                random.shuffle(existing)
                for f in existing[VAL_TARGET_PER_CLASS:]:
                    os.remove(os.path.join(class_dir, f))
                print(f"  val/{damage_class}: downsampled {current} -> {VAL_TARGET_PER_CLASS}")
            else:
                print(f"  val/{damage_class}: already at {current}")
            continue

        # Need more images — extract from xView2
        needed = VAL_TARGET_PER_CLASS - current
        print(f"  val/{damage_class}: have {current}, need {needed} more")

        # Split needed evenly between fire and flood
        fire_need = needed // 2
        flood_need = needed - fire_need

        saved_fire = extract_crops(index, "fire", damage_class, fire_need,
                                   str(class_dir), prefix="xv2_val")
        saved_flood = extract_crops(index, "flood", damage_class, flood_need,
                                    str(class_dir), prefix="xv2_val")

        total_added = saved_fire + saved_flood
        print(f"  val/{damage_class}: added {total_added} (fire={saved_fire}, flood={saved_flood})")


# ============================================================
# MAIN
# ============================================================

def print_dataset_summary(label=""):
    """Print current class distribution."""
    print(f"\n{'='*55}")
    print(f"  Dataset Summary {label}")
    print(f"{'='*55}")

    for split in ["train", "val"]:
        split_dir = DATASET_DIR / split
        if not split_dir.exists():
            continue
        print(f"\n  {split.upper()}:")
        total = 0
        for cls in sorted(os.listdir(split_dir)):
            cls_dir = split_dir / cls
            if cls_dir.is_dir():
                count = sum(1 for f in cls_dir.iterdir() if f.is_file())
                bar = "#" * min(count // 20, 40)
                print(f"    {cls:<15} {count:>6}  {bar}")
                total += count
        print(f"    {'TOTAL':<15} {total:>6}")
    print()


def main():
    random.seed(SEED)

    print("=" * 55)
    print("  xView2 -> QuickDART Dataset Converter")
    print("=" * 55)

    print_dataset_summary("(BEFORE)")

    # Index all xView2 buildings
    index = index_xview2_buildings()

    # --- Add new training images ---
    print("\n--- Adding training images ---")
    for damage_class, (fire_count, flood_count) in TRAIN_TARGETS.items():
        train_dir = str(DATASET_DIR / "train" / damage_class)
        print(f"\n  {damage_class}:")

        saved_fire = extract_crops(index, "fire", damage_class, fire_count,
                                   train_dir, prefix="xv2_train")
        saved_flood = extract_crops(index, "flood", damage_class, flood_count,
                                    train_dir, prefix="xv2_train")
        print(f"  -> Added {saved_fire + saved_flood} images (fire={saved_fire}, flood={saved_flood})")

    # --- Downsample no_damage train ---
    print("\n--- Downsampling no_damage in train/ ---")
    downsample_class(str(DATASET_DIR / "train" / "no_damage"), 800)

    # --- Balance validation set ---
    print("\n--- Balancing validation set (200 per class) ---")
    balance_val_set(index)

    print_dataset_summary("(AFTER)")
    print("Done!")


if __name__ == "__main__":
    main()
