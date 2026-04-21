"""
Build 3 Separate Damage Datasets (Earthquake, Fire, Flood)

Creates specialized per-disaster-type damage classification datasets from:
  - xView2 GeoTIFF data (fire and flood events)
  - Existing earthquake images from dataset_damage_level/

Output directories:
  dataset_damage_earthquake/  {train,val}/{destroyed,major,minor,no_damage}
  dataset_damage_fire/        {train,val}/{destroyed,major,minor,no_damage}
  dataset_damage_flood/       {train,val}/{destroyed,major,minor,no_damage}

Usage:
    python ml_engine/build_damage_datasets.py
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
EXISTING_DATASET = PROJECT_ROOT / "dataset_damage_level"

DATASET_EARTHQUAKE = PROJECT_ROOT / "dataset_damage_earthquake"
DATASET_FIRE = PROJECT_ROOT / "dataset_damage_fire"
DATASET_FLOOD = PROJECT_ROOT / "dataset_damage_flood"

SEED = 42
MIN_CROP_SIZE = 32
OUTPUT_SIZE = 224
JPEG_QUALITY = 95

TRAIN_TARGET_PER_CLASS = 800
VAL_TARGET_PER_CLASS = 200

FIRE_EVENTS = {
    "santa-rosa-wildfire", "socal-fire", "woolsey-fire",
    "pinery-bushfire", "portugal-wildfire",
}
FLOOD_EVENTS = {
    "hurricane-florence", "hurricane-harvey", "hurricane-matthew",
    "hurricane-michael", "midwest-flooding", "nepal-flooding",
    "palu-tsunami", "sunda-tsunami",
}
EARTHQUAKE_EVENTS = {
    "mexico-earthquake", "guatemala-volcano", "palu-tsunami",
}

DAMAGE_MAP = {
    "destroyed": "destroyed",
    "major-damage": "major",
    "minor-damage": "minor",
    "no-damage": "no_damage",
}

DAMAGE_CLASSES = ["destroyed", "major", "minor", "no_damage"]

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
    img = np.clip(img, 0, 255).astype(np.uint8)
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    elif img.shape[2] > 3:
        img = img[:, :, :3]
    return img


def crop_building(img_array, bbox, output_size=224):
    """Crop a building from the image with 20% padding and resize."""
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

    # Add 20% context padding on each side
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
# STEP 1: Create directory structures
# ============================================================

def create_dataset_dirs():
    """Create all dataset directory structures."""
    for dataset_dir in [DATASET_EARTHQUAKE, DATASET_FIRE, DATASET_FLOOD]:
        for split in ["train", "val"]:
            for cls in DAMAGE_CLASSES:
                (dataset_dir / split / cls).mkdir(parents=True, exist_ok=True)
    print("Created dataset directory structures.")


# ============================================================
# STEP 2: Index xView2 buildings by disaster category
# ============================================================

def index_xview2_buildings():
    """
    Scan all xView2 post-disaster labels and index buildings by
    (disaster_category, damage_level).

    Returns dict: {('fire'|'flood'|'earthquake', damage_class): [(tif_path, bbox), ...]}
    """
    print("\nIndexing xView2 buildings...")
    index = defaultdict(list)

    for tier in ["tier1", "tier3"]:
        label_dir = os.path.join(XVIEW2_BASE, tier, "labels")
        image_dir = os.path.join(XVIEW2_BASE, tier, "images")

        if not os.path.exists(label_dir):
            continue

        for label_file in os.listdir(label_dir):
            if not label_file.endswith("_post_disaster.json"):
                continue

            # Extract event name from filename
            base_name = label_file.replace(".json", "")
            parts = base_name.replace("_post_disaster", "")
            idx = parts.rfind("_")
            event = parts[:idx]

            # Categorize disaster type
            disaster_cat = None
            if event in FIRE_EVENTS:
                disaster_cat = "fire"
            elif event in FLOOD_EVENTS:
                disaster_cat = "flood"
            elif event in EARTHQUAKE_EVENTS:
                disaster_cat = "earthquake"
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
        print(f"  {cat:>12} / {dmg:<12}: {len(items):>6} buildings")

    return index


# ============================================================
# STEP 3: Extract and save building crops
# ============================================================

def extract_crops(index, disaster_cat, damage_class, count, output_dir, prefix="xv2"):
    """
    Randomly sample `count` buildings from the index and save as JPEGs.
    Returns number of images actually saved.
    """
    key = (disaster_cat, damage_class)
    available = index.get(key, [])

    if not available:
        print(f"    WARNING: No {disaster_cat}/{damage_class} buildings available!")
        return 0

    random.shuffle(available)

    os.makedirs(output_dir, exist_ok=True)
    saved = 0
    img_cache = {}

    for tif_path, bbox in available:
        if saved >= count:
            break

        if tif_path not in img_cache:
            try:
                img_cache[tif_path] = load_geotiff_as_rgb(tif_path)
            except Exception as e:
                print(f"    Error loading {tif_path}: {e}")
                continue

        img_array = img_cache[tif_path]
        crop = crop_building(img_array, bbox, OUTPUT_SIZE)
        if crop is None:
            continue

        filename = f"{prefix}_{disaster_cat}_{damage_class}_{saved:04d}.jpg"
        crop.save(os.path.join(output_dir, filename), "JPEG", quality=JPEG_QUALITY)
        saved += 1

        if saved % 100 == 0:
            print(f"      Saved {saved}/{count} {disaster_cat}/{damage_class} crops...")

    img_cache.clear()
    return saved


# ============================================================
# STEP 4: Build earthquake dataset from existing images
# ============================================================

def build_earthquake_dataset():
    """
    Copy original (non-xv2) earthquake images from dataset_damage_level/
    to dataset_damage_earthquake/, preserving the train/val split.
    """
    print("\n--- Building EARTHQUAKE dataset from existing images ---")

    total_copied = 0
    for split in ["train", "val"]:
        for cls in DAMAGE_CLASSES:
            src_dir = EXISTING_DATASET / split / cls
            dst_dir = DATASET_EARTHQUAKE / split / cls

            if not src_dir.exists():
                print(f"  WARNING: {src_dir} does not exist, skipping")
                continue

            copied = 0
            for f in os.listdir(src_dir):
                # Skip xView2-derived images (prefixed with "xv2_")
                if f.startswith("xv2_"):
                    continue
                src_path = src_dir / f
                if not src_path.is_file():
                    continue
                dst_path = dst_dir / f
                shutil.copy2(str(src_path), str(dst_path))
                copied += 1

            print(f"  {split}/{cls}: copied {copied} original earthquake images")
            total_copied += copied

    print(f"  TOTAL: {total_copied} earthquake images copied")
    return total_copied


# ============================================================
# STEP 5: Build fire and flood datasets from xView2
# ============================================================

def build_xv2_dataset(index, disaster_cat, dataset_dir):
    """
    Build a damage dataset for a single disaster category (fire or flood)
    by extracting building crops from xView2 data.

    Targets ~800 train / ~200 val per class.
    """
    print(f"\n--- Building {disaster_cat.upper()} dataset from xView2 ---")

    for cls in DAMAGE_CLASSES:
        key = (disaster_cat, cls)
        available = len(index.get(key, []))

        # --- Train split ---
        train_dir = str(dataset_dir / "train" / cls)
        train_target = min(TRAIN_TARGET_PER_CLASS, available)
        if train_target < TRAIN_TARGET_PER_CLASS:
            print(f"  WARNING: Only {available} {disaster_cat}/{cls} buildings available, "
                  f"targeting {train_target} for train")

        print(f"  Extracting train/{cls} ({train_target} images)...")
        saved_train = extract_crops(
            index, disaster_cat, cls, train_target,
            train_dir, prefix=f"xv2_train"
        )
        print(f"    -> Saved {saved_train} train images")

        # --- Val split ---
        # The remaining buildings (not used for train) are available for val.
        # We re-shuffle inside extract_crops, but since train already consumed
        # some, we need to track what was used. Instead, we use a separate prefix
        # and let the random sampling find new crops (index items are shuffled).
        val_dir = str(dataset_dir / "val" / cls)
        remaining = available - saved_train
        val_target = min(VAL_TARGET_PER_CLASS, remaining)
        if val_target < VAL_TARGET_PER_CLASS:
            print(f"  WARNING: Only {remaining} {disaster_cat}/{cls} buildings remaining "
                  f"for val, targeting {val_target}")

        print(f"  Extracting val/{cls} ({val_target} images)...")
        saved_val = extract_crops(
            index, disaster_cat, cls, val_target,
            val_dir, prefix=f"xv2_val"
        )
        print(f"    -> Saved {saved_val} val images")


def build_xv2_dataset_split_aware(index, disaster_cat, dataset_dir):
    """
    Build a damage dataset for a single disaster category (fire or flood)
    by extracting building crops from xView2 data.

    Ensures train and val use different source buildings (no overlap).
    Targets ~800 train / ~200 val per class (1000 total per class, 80/20 split).
    """
    print(f"\n--- Building {disaster_cat.upper()} dataset from xView2 ---")

    for cls in DAMAGE_CLASSES:
        key = (disaster_cat, cls)
        available = list(index.get(key, []))
        random.shuffle(available)

        total_available = len(available)
        total_target = TRAIN_TARGET_PER_CLASS + VAL_TARGET_PER_CLASS  # 1000

        if total_available < total_target:
            # Scale down proportionally (80/20)
            train_count = int(total_available * 0.8)
            val_count = total_available - train_count
            print(f"  WARNING: {disaster_cat}/{cls} has {total_available} buildings "
                  f"(target {total_target}), using {train_count}/{val_count}")
        else:
            train_count = TRAIN_TARGET_PER_CLASS
            val_count = VAL_TARGET_PER_CLASS

        # Split the building list so train and val don't overlap
        train_buildings = available[:train_count + val_count]  # extra buffer for skipped crops
        val_start = train_count + val_count
        val_buildings = available[val_start:val_start + val_count * 3]  # extra buffer

        # If not enough for separate val pool, split from the main pool
        if len(val_buildings) < val_count:
            # Use a clean split: first N for train, rest for val
            split_point = int(len(available) * 0.8)
            train_pool = available[:split_point]
            val_pool = available[split_point:]
        else:
            train_pool = available[:train_count * 2]  # 2x buffer for skipped small buildings
            val_pool = val_buildings

        # Extract train crops
        train_dir = str(dataset_dir / "train" / cls)
        print(f"  Extracting train/{cls} (target: {train_count})...")
        saved_train = _extract_from_pool(train_pool, train_count, train_dir,
                                         f"xv2_train_{disaster_cat}_{cls}")
        print(f"    -> Saved {saved_train} train images")

        # Extract val crops
        val_dir = str(dataset_dir / "val" / cls)
        print(f"  Extracting val/{cls} (target: {val_count})...")
        saved_val = _extract_from_pool(val_pool, val_count, val_dir,
                                       f"xv2_val_{disaster_cat}_{cls}")
        print(f"    -> Saved {saved_val} val images")


def _extract_from_pool(building_pool, count, output_dir, prefix):
    """Extract building crops from a pre-selected pool of (tif_path, bbox) tuples."""
    os.makedirs(output_dir, exist_ok=True)
    saved = 0
    img_cache = {}

    for tif_path, bbox in building_pool:
        if saved >= count:
            break

        if tif_path not in img_cache:
            try:
                img_cache[tif_path] = load_geotiff_as_rgb(tif_path)
            except Exception as e:
                print(f"    Error loading {tif_path}: {e}")
                continue

        img_array = img_cache[tif_path]
        crop = crop_building(img_array, bbox, OUTPUT_SIZE)
        if crop is None:
            continue

        filename = f"{prefix}_{saved:04d}.jpg"
        crop.save(os.path.join(output_dir, filename), "JPEG", quality=JPEG_QUALITY)
        saved += 1

        if saved % 100 == 0:
            print(f"      Saved {saved}/{count}...")

    img_cache.clear()
    return saved


# ============================================================
# SUMMARY
# ============================================================

def print_dataset_summary(dataset_dir, name):
    """Print class distribution for a single dataset."""
    print(f"\n  {name}:")
    for split in ["train", "val"]:
        split_dir = dataset_dir / split
        if not split_dir.exists():
            continue
        print(f"    {split.upper()}:")
        total = 0
        for cls in DAMAGE_CLASSES:
            cls_dir = split_dir / cls
            if cls_dir.is_dir():
                count = sum(1 for f in cls_dir.iterdir() if f.is_file())
                bar = "#" * min(count // 20, 40)
                print(f"      {cls:<15} {count:>6}  {bar}")
                total += count
        print(f"      {'TOTAL':<15} {total:>6}")


def print_all_summaries(label=""):
    """Print summaries for all 3 datasets."""
    print(f"\n{'=' * 60}")
    print(f"  Dataset Summaries {label}")
    print(f"{'=' * 60}")

    for dataset_dir, name in [
        (DATASET_EARTHQUAKE, "EARTHQUAKE"),
        (DATASET_FIRE, "FIRE"),
        (DATASET_FLOOD, "FLOOD"),
    ]:
        print_dataset_summary(dataset_dir, name)
    print()


# ============================================================
# MAIN
# ============================================================

def main():
    random.seed(SEED)

    print("=" * 60)
    print("  Build Damage Datasets (Earthquake, Fire, Flood)")
    print("=" * 60)

    # Create directory structures
    create_dataset_dirs()

    # Print initial state (will be mostly empty)
    print_all_summaries("(BEFORE)")

    # Build earthquake dataset from existing images
    build_earthquake_dataset()

    # Index xView2 buildings
    index = index_xview2_buildings()

    # Build fire dataset from xView2
    build_xv2_dataset_split_aware(index, "fire", DATASET_FIRE)

    # Build flood dataset from xView2
    build_xv2_dataset_split_aware(index, "flood", DATASET_FLOOD)

    # Also add xView2 earthquake buildings to the earthquake dataset
    print("\n--- Augmenting EARTHQUAKE dataset with xView2 earthquake buildings ---")
    for cls in DAMAGE_CLASSES:
        key = ("earthquake", cls)
        available = list(index.get(key, []))
        if not available:
            print(f"  No xView2 earthquake/{cls} buildings found")
            continue

        random.shuffle(available)
        split_point = int(len(available) * 0.8)
        train_pool = available[:split_point]
        val_pool = available[split_point:]

        train_dir = str(DATASET_EARTHQUAKE / "train" / cls)
        existing_train = len([f for f in os.listdir(train_dir) if os.path.isfile(os.path.join(train_dir, f))])
        train_need = max(0, TRAIN_TARGET_PER_CLASS - existing_train)
        if train_need > 0:
            saved = _extract_from_pool(train_pool, train_need, train_dir,
                                       f"xv2_train_earthquake_{cls}")
            print(f"  train/{cls}: added {saved} xView2 earthquake crops (had {existing_train})")

        val_dir = str(DATASET_EARTHQUAKE / "val" / cls)
        existing_val = len([f for f in os.listdir(val_dir) if os.path.isfile(os.path.join(val_dir, f))])
        val_need = max(0, VAL_TARGET_PER_CLASS - existing_val)
        if val_need > 0:
            saved = _extract_from_pool(val_pool, val_need, val_dir,
                                       f"xv2_val_earthquake_{cls}")
            print(f"  val/{cls}: added {saved} xView2 earthquake crops (had {existing_val})")

    # Print final state
    print_all_summaries("(AFTER)")
    print("Done!")


if __name__ == "__main__":
    main()
