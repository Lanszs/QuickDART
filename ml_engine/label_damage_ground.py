"""
Keyboard-driven damage labeling tool for ground-level photos.

Re-categorizes pre-labeled images from the user's downloaded ground-level
disaster datasets (Major / Minor / Undamaged subfolders) into the project's
4-class damage taxonomy (Destroyed / Major / Minor / No Damage).

Files are COPIED (not moved) into dataset_damage_<type>/labeled/<class>/
to preserve the originals on the source drive. A manifest at
dataset_damage_<type>/labeled.manifest.json tracks which source paths have
been processed, so re-running the tool resumes where you left off.

The UI shows the image's current source folder (e.g. "Source: Major") and
suggests the matching key. Press the suggested key to keep the existing
label, or another key to re-categorize.

After labeling, run with --split to partition labeled/<class>/ into
train/<class>/ and val/<class>/ (80/20 by default).

Hotkeys (label mode):
    1 = Destroyed    (collapsed, burnt to foundation, washed away)
    2 = Major        (severe burn, partial collapse, large cracks - unsafe)
    3 = Minor        (some damage, broken windows, partial burn - usable)
    4 = No Damage    (intact, normal appearance)
    S = Skip         (decide later, image stays in source)
    U = Undo last    (reverts the previous label, returns to that image)
    Q = Quit         (save progress, exit)

Usage:
    python ml_engine/label_damage_ground.py --disaster fire
    python ml_engine/label_damage_ground.py --disaster flood
    python ml_engine/label_damage_ground.py --disaster earthquake
    python ml_engine/label_damage_ground.py --disaster earthquake --include-unclassified

    # After labeling, finalize the train/val split:
    python ml_engine/label_damage_ground.py --disaster fire --split
"""

import argparse
import json
import random
import shutil
import sys
import tkinter as tk
from pathlib import Path

from PIL import Image, ImageTk

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Project destination folders (mirrors aerial naming, without "_aerial" suffix)
DISASTER_TO_DIR = {
    "fire": PROJECT_ROOT / "dataset_damage_fire",
    "flood": PROJECT_ROOT / "dataset_damage_flood",
    "earthquake": PROJECT_ROOT / "dataset_damage_earthquake",
}

# User's downloaded source paths (each entry contains Major/Minor/Undamaged subfolders)
DEFAULT_SOURCE_BASES = {
    "fire": [
        Path(r"E:\Fire Dataset-20260503T151535Z-3-001\Fire Dataset"),
    ],
    "flood": [
        Path(r"E:\Flood Dataset-20260503T152301Z-3-001\Flood Dataset"),
        Path(r"E:\Flood Dataset-20260503T152301Z-3-002\Flood Dataset"),
    ],
    "earthquake": [
        Path(r"E:\Earthquake Dataset-20260503T150425Z-3-001\Earthquake Dataset"),
    ],
}

# Source subfolders inside each base path, mapped to the suggested final class.
# Pressing the matching key confirms; pressing a different key re-categorizes.
SOURCE_SUBFOLDERS = {
    "Major": "major",
    "Minor": "minor",
    "Undamaged": "no_damage",
}

CLASS_NAMES = ["destroyed", "major", "minor", "no_damage"]
CLASS_HINTS = {
    "destroyed": "Collapsed, burnt to foundation, washed away",
    "major": "Severe burn, partial collapse, large cracks - unsafe",
    "minor": "Some damage, broken windows, partial burn - usable",
    "no_damage": "Intact building, normal appearance",
}
KEY_TO_CLASS = {"1": "destroyed", "2": "major", "3": "minor", "4": "no_damage"}
CLASS_TO_KEY = {v: k for k, v in KEY_TO_CLASS.items()}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
DISPLAY_MAX = 800
TRAIN_RATIO = 0.8
SEED = 42


# ============================================================
# Manifest: tracks which source paths have already been labeled
# ============================================================

class LabelManifest:
    """Persists the set of already-labeled source paths so re-runs can resume."""

    def __init__(self, path):
        self.path = path
        self.labeled = set()
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.labeled = set(data.get("labeled", []))
            except (json.JSONDecodeError, OSError):
                self.labeled = set()

    def is_labeled(self, source_path):
        return str(source_path) in self.labeled

    def mark(self, source_path):
        self.labeled.add(str(source_path))
        self._save()

    def unmark(self, source_path):
        self.labeled.discard(str(source_path))
        self._save()

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump({"labeled": sorted(self.labeled)}, f, indent=2)


# ============================================================
# Source pool collection
# ============================================================

def collect_source_pool(base_paths, include_unclassified):
    """
    Walk all source bases, yielding (path, source_label) tuples.

    source_label is one of: "Major", "Minor", "Undamaged", "Unclassified".
    The order is: all Major first, then Minor, then Undamaged, then Unclassified.
    Within each source, files are sorted for deterministic order.
    """
    pool = []

    # Pass 1: structured subfolders (Major / Minor / Undamaged)
    for source_label in SOURCE_SUBFOLDERS.keys():
        for base in base_paths:
            sub = base / source_label
            if not sub.exists():
                continue
            files = sorted(
                p for p in sub.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
            )
            for p in files:
                pool.append((p, source_label))

    # Pass 2: optionally pick up unclassified images sitting at the base level
    # (e.g. the 9,106 loose images in the earthquake dataset root)
    if include_unclassified:
        for base in base_paths:
            if not base.exists():
                continue
            files = sorted(
                p for p in base.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
            )
            for p in files:
                pool.append((p, "Unclassified"))

    return pool


# ============================================================
# Labeling app
# ============================================================

class LabelingApp:
    def __init__(self, root, disaster, dataset_dir, source_pool, manifest):
        self.root = root
        self.disaster = disaster
        self.dataset_dir = dataset_dir
        self.labeled_dir = dataset_dir / "labeled"
        self.manifest = manifest

        # Pre-create label class folders
        for cls in CLASS_NAMES:
            (self.labeled_dir / cls).mkdir(parents=True, exist_ok=True)

        # Stack of (source_path, dest_path) for undo
        self.history = []

        # Filter pool against manifest (skip already-labeled)
        self.queue = [
            (path, source_label) for path, source_label in source_pool
            if not manifest.is_labeled(path)
        ]
        self.total_initial = len(self.queue) + len(manifest.labeled)
        self.current_image = None

        self._build_ui()
        self._bind_keys()
        self._show_next()

    def _build_ui(self):
        self.root.title(f"QuickDART - Ground Damage Labeler ({self.disaster})")
        self.root.configure(bg="#1e1e1e")

        self.status_var = tk.StringVar()
        tk.Label(
            self.root, textvariable=self.status_var,
            bg="#1e1e1e", fg="#ffffff",
            font=("Segoe UI", 12), pady=8,
        ).pack(fill=tk.X)

        self.suggestion_var = tk.StringVar()
        tk.Label(
            self.root, textvariable=self.suggestion_var,
            bg="#1e1e1e", fg="#4ade80",
            font=("Segoe UI", 11, "bold"), pady=2,
        ).pack(fill=tk.X)

        self.image_label = tk.Label(self.root, bg="#1e1e1e")
        self.image_label.pack(padx=10, pady=10)

        legend = tk.Frame(self.root, bg="#1e1e1e")
        legend.pack(fill=tk.X, padx=10, pady=(0, 10))

        legend_text = (
            "  [1] Destroyed   |   [2] Major   |   [3] Minor   |   [4] No Damage   "
            "|   [S] Skip   |   [U] Undo   |   [Q] Quit"
        )
        tk.Label(
            legend, text=legend_text,
            bg="#1e1e1e", fg="#cccccc", font=("Consolas", 10),
        ).pack()

        hint_text = "  ".join(f"{k}={CLASS_HINTS[v]}" for k, v in KEY_TO_CLASS.items())
        tk.Label(
            legend, text=hint_text,
            bg="#1e1e1e", fg="#888888", font=("Consolas", 9),
            justify=tk.LEFT,
        ).pack(pady=(4, 0))

    def _bind_keys(self):
        self.root.bind("<Key>", self._on_key)

    def _on_key(self, event):
        key = event.char.lower()
        if key in KEY_TO_CLASS:
            self._assign(KEY_TO_CLASS[key])
        elif key == "s":
            self._skip()
        elif key == "u":
            self._undo()
        elif key == "q":
            self._quit()

    def _show_next(self):
        if not self.queue:
            self._render_done()
            return

        path, source_label = self.queue[0]
        try:
            img = Image.open(path).convert("RGB")
        except Exception as e:
            print(f"  Skipping unreadable image {path.name}: {e}")
            self.queue.pop(0)
            self._show_next()
            return

        w, h = img.size
        scale = min(DISPLAY_MAX / w, DISPLAY_MAX / h, 1.0)
        if scale < 1.0:
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        self.current_image = ImageTk.PhotoImage(img)
        self.image_label.config(image=self.current_image)

        labeled_so_far = self.total_initial - len(self.queue)
        self.status_var.set(
            f"  [{self.disaster.upper()}]  "
            f"{labeled_so_far + 1} / {self.total_initial}    "
            f"file: {path.name}"
        )

        # Suggestion line: which key matches the source folder
        suggested_class = SOURCE_SUBFOLDERS.get(source_label)
        if suggested_class:
            suggested_key = CLASS_TO_KEY[suggested_class]
            self.suggestion_var.set(
                f"  Source: {source_label}  ->  Suggested: [{suggested_key}] "
                f"{suggested_class.replace('_', ' ').title()}  "
                f"(press [1] if it's actually Destroyed)"
            )
        else:
            self.suggestion_var.set(
                f"  Source: {source_label}  ->  No suggestion - assign any class"
            )

    def _render_done(self):
        self.image_label.config(image="")
        self.status_var.set(
            "  All done! No more images to label. Press Q to quit."
        )
        self.suggestion_var.set("")

    def _assign(self, cls):
        if not self.queue:
            return
        path, _ = self.queue.pop(0)
        dest = self.labeled_dir / cls / path.name
        if dest.exists():
            stem, suffix = path.stem, path.suffix
            i = 1
            while (self.labeled_dir / cls / f"{stem}_{i}{suffix}").exists():
                i += 1
            dest = self.labeled_dir / cls / f"{stem}_{i}{suffix}"
        shutil.copy2(str(path), str(dest))
        self.manifest.mark(path)
        self.history.append((path, dest))
        self._show_next()

    def _skip(self):
        if not self.queue:
            return
        # Cycle skipped image to the end of the queue
        self.queue.append(self.queue.pop(0))
        self._show_next()

    def _undo(self):
        if not self.history:
            return
        source_path, dest_path = self.history.pop()
        if dest_path.exists():
            dest_path.unlink()
        self.manifest.unmark(source_path)
        # Find the original source_label by re-scanning (simpler than tracking it).
        # Default to "Unclassified" if not found - mostly cosmetic.
        source_label = source_path.parent.name if source_path.parent.name in SOURCE_SUBFOLDERS else "Unclassified"
        self.queue.insert(0, (source_path, source_label))
        self._show_next()

    def _quit(self):
        labeled = self.total_initial - len(self.queue)
        print(f"\nQuit. Labeled {labeled} of {self.total_initial} images this session.")
        print(f"  Run again to resume from {len(self.queue)} remaining.")
        self.root.destroy()


# ============================================================
# Train/val split mode
# ============================================================

def split_labeled(dataset_dir, train_ratio=TRAIN_RATIO, force=False, max_samples=None):
    """
    Split labeled/<class>/ into train/<class>/ and val/<class>/ (80/20).

    If max_samples is set, each class is randomly capped at that count BEFORE
    splitting. The labeled/ folder is left untouched (originals preserved).
    """
    labeled = dataset_dir / "labeled"
    if not labeled.exists():
        print(f"ERROR: {labeled} does not exist. Label some images first.")
        sys.exit(1)

    train_dir = dataset_dir / "train"
    val_dir = dataset_dir / "val"

    if (train_dir.exists() or val_dir.exists()) and not force:
        print(f"  {dataset_dir.name}/train or /val already exists. Use --force to overwrite.")
        sys.exit(1)
    if force:
        if train_dir.exists():
            shutil.rmtree(train_dir)
        if val_dir.exists():
            shutil.rmtree(val_dir)

    rng = random.Random(SEED)

    print(f"\n{'='*55}")
    cap_str = f", cap={max_samples}/class" if max_samples else ""
    print(f"  Splitting labeled/ into train/ and val/ (ratio={train_ratio}{cap_str})")
    print(f"{'='*55}")

    for cls in CLASS_NAMES:
        src = labeled / cls
        if not src.exists():
            continue
        images = sorted(
            p for p in src.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        )
        if not images:
            print(f"  {cls:<11}: empty, skipping")
            continue

        shuffled = list(images)
        rng.shuffle(shuffled)

        original_count = len(shuffled)
        if max_samples is not None and len(shuffled) > max_samples:
            shuffled = shuffled[:max_samples]

        cut = int(len(shuffled) * train_ratio)
        train_imgs, val_imgs = shuffled[:cut], shuffled[cut:]

        (train_dir / cls).mkdir(parents=True, exist_ok=True)
        (val_dir / cls).mkdir(parents=True, exist_ok=True)

        for p in train_imgs:
            shutil.copy2(p, train_dir / cls / p.name)
        for p in val_imgs:
            shutil.copy2(p, val_dir / cls / p.name)

        capped_str = f" (capped from {original_count})" if original_count > len(shuffled) else ""
        print(f"  {cls:<11}: train={len(train_imgs)}, val={len(val_imgs)}{capped_str}")

    print(f"\nDone. Labeled originals are preserved in {labeled}.")


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Re-categorize ground-level disaster photos by damage level."
    )
    parser.add_argument(
        '--disaster', required=True, choices=list(DISASTER_TO_DIR.keys()),
        help="Which disaster type's photos to label",
    )
    parser.add_argument(
        '--include-unclassified', action='store_true',
        help="Include any images sitting at the base of the source folder "
             "(e.g. the 9,106 loose images in the earthquake dataset root).",
    )
    parser.add_argument(
        '--split', action='store_true',
        help="Skip labeling; instead split labeled/ into train/ and val/",
    )
    parser.add_argument(
        '--force', action='store_true',
        help="With --split: overwrite existing train/ and val/ folders",
    )
    parser.add_argument(
        '--max-samples', type=int, default=None,
        help="With --split: cap each class to this many images before splitting "
             "(e.g. 2000 for earthquake to manage class imbalance)",
    )
    args = parser.parse_args()

    dataset_dir = DISASTER_TO_DIR[args.disaster]
    dataset_dir.mkdir(parents=True, exist_ok=True)

    if args.split:
        split_labeled(dataset_dir, force=args.force, max_samples=args.max_samples)
        return

    source_bases = DEFAULT_SOURCE_BASES[args.disaster]
    missing = [b for b in source_bases if not b.exists()]
    if missing:
        print("ERROR: source folder(s) not found:")
        for b in missing:
            print(f"  {b}")
        print("  Update DEFAULT_SOURCE_BASES in this script if your paths differ.")
        sys.exit(1)

    pool = collect_source_pool(source_bases, args.include_unclassified)
    if not pool:
        print(f"ERROR: no images found in source folders for '{args.disaster}'.")
        sys.exit(1)

    manifest = LabelManifest(dataset_dir / "labeled.manifest.json")

    print(f"  {args.disaster}: {len(pool)} images in source pool, "
          f"{len(manifest.labeled)} already labeled, "
          f"{len(pool) - sum(1 for p, _ in pool if manifest.is_labeled(p))} remaining")

    root = tk.Tk()
    LabelingApp(root, args.disaster, dataset_dir, pool, manifest)
    root.mainloop()


if __name__ == "__main__":
    main()
