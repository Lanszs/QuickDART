"""
Keyboard-driven damage labeling tool for aerial AIDER photos.

Cycles through dataset_damage_<type>_aerial/raw_unlabeled/, displays each
image, and lets you assign a damage level via single keystroke. Files are
moved (not copied) into dataset_damage_<type>_aerial/labeled/<class>/ so
re-running the tool resumes where you left off.

After labeling, run with --split to partition labeled/<class>/ into
train/<class>/ and val/<class>/ (80/20 by default).

Hotkeys (label mode):
    1 = Destroyed    (collapsed, burnt to foundation, washed away)
    2 = Major        (partial collapse, severe burn, large cracks - unsafe)
    3 = Minor        (some burn, water around, broken windows - usable)
    4 = No Damage    (intact, normal appearance)
    S = Skip         (leave in raw_unlabeled, decide later)
    U = Undo last    (reverts the previous label, returns to that image)
    Q = Quit         (save progress, exit)

Usage:
    python ml_engine/label_damage_aerial.py --disaster fire
    python ml_engine/label_damage_aerial.py --disaster flood
    python ml_engine/label_damage_aerial.py --disaster earthquake

    # After labeling, finalize the train/val split:
    python ml_engine/label_damage_aerial.py --disaster fire --split
"""

import argparse
import random
import shutil
import sys
import tkinter as tk
from pathlib import Path

from PIL import Image, ImageTk

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DISASTER_TO_DIR = {
    "fire": PROJECT_ROOT / "dataset_damage_fire_aerial",
    "flood": PROJECT_ROOT / "dataset_damage_flood_aerial",
    "earthquake": PROJECT_ROOT / "dataset_damage_earthquake_aerial",
}

CLASS_NAMES = ["destroyed", "major", "minor", "no_damage"]
CLASS_HINTS = {
    "destroyed": "Collapsed, burnt to foundation, washed away",
    "major": "Partial collapse, severe burn, large cracks - unsafe",
    "minor": "Some damage, broken windows, partial burn - usable",
    "no_damage": "Intact building, normal appearance",
}
KEY_TO_CLASS = {"1": "destroyed", "2": "major", "3": "minor", "4": "no_damage"}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
DISPLAY_MAX = 800  # max pixel size for displayed image
TRAIN_RATIO = 0.8
SEED = 42


# ============================================================
# Labeling app
# ============================================================

class LabelingApp:
    def __init__(self, root, disaster, dataset_dir):
        self.root = root
        self.disaster = disaster
        self.dataset_dir = dataset_dir
        self.unlabeled_dir = dataset_dir / "raw_unlabeled"
        self.labeled_dir = dataset_dir / "labeled"

        # Pre-create label class folders
        for cls in CLASS_NAMES:
            (self.labeled_dir / cls).mkdir(parents=True, exist_ok=True)

        # Stack of (filename, target_class) for undo
        self.history = []

        # Load remaining files
        self.queue = self._load_queue()
        self.total_initial = len(self.queue) + self._count_already_labeled()
        self.current_image = None  # PhotoImage reference (must be kept alive)

        self._build_ui()
        self._bind_keys()
        self._show_next()

    def _load_queue(self):
        if not self.unlabeled_dir.exists():
            return []
        return sorted(
            p for p in self.unlabeled_dir.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        )

    def _count_already_labeled(self):
        count = 0
        for cls in CLASS_NAMES:
            d = self.labeled_dir / cls
            if d.exists():
                count += sum(
                    1 for p in d.iterdir()
                    if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
                )
        return count

    def _build_ui(self):
        self.root.title(f"QuickDART - Aerial Damage Labeler ({self.disaster})")
        self.root.configure(bg="#1e1e1e")

        # Top bar: progress + filename
        self.status_var = tk.StringVar()
        status = tk.Label(
            self.root, textvariable=self.status_var,
            bg="#1e1e1e", fg="#ffffff",
            font=("Segoe UI", 12), pady=8,
        )
        status.pack(fill=tk.X)

        # Image display
        self.image_label = tk.Label(self.root, bg="#1e1e1e")
        self.image_label.pack(padx=10, pady=10)

        # Hotkey legend
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

        path = self.queue[0]
        try:
            img = Image.open(path).convert("RGB")
        except Exception as e:
            print(f"  Skipping unreadable image {path.name}: {e}")
            self.queue.pop(0)
            self._show_next()
            return

        # Scale to fit DISPLAY_MAX while preserving aspect ratio
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

    def _render_done(self):
        self.image_label.config(image="")
        self.status_var.set(
            f"  All done! No more images in raw_unlabeled/. Press Q to quit."
        )

    def _assign(self, cls):
        if not self.queue:
            return
        path = self.queue.pop(0)
        dest = self.labeled_dir / cls / path.name
        # Avoid filename collision
        if dest.exists():
            stem, suffix = path.stem, path.suffix
            i = 1
            while (self.labeled_dir / cls / f"{stem}_{i}{suffix}").exists():
                i += 1
            dest = self.labeled_dir / cls / f"{stem}_{i}{suffix}"
        shutil.move(str(path), str(dest))
        self.history.append((dest, path))  # (current_location, original_location)
        self._show_next()

    def _skip(self):
        if not self.queue:
            return
        # Move skipped to the end of the queue so we can come back to it later
        self.queue.append(self.queue.pop(0))
        self._show_next()

    def _undo(self):
        if not self.history:
            return
        moved_to, original = self.history.pop()
        if moved_to.exists():
            shutil.move(str(moved_to), str(original))
            self.queue.insert(0, original)
            self._show_next()

    def _quit(self):
        labeled = self.total_initial - len(self.queue)
        print(f"\nQuit. Labeled {labeled} of {self.total_initial} images this session.")
        print(f"  Run again to resume from {len(self.queue)} remaining.")
        self.root.destroy()


# ============================================================
# Train/val split mode
# ============================================================

def split_labeled(dataset_dir, train_ratio=TRAIN_RATIO, force=False, binary=False):
    """
    Move images from labeled/<class>/ into train/<class>/ and val/<class>/
    using an 80/20 split per class.

    If binary=True, only the 'destroyed' and 'no_damage' classes are split;
    'major' and 'minor' folders are preserved on disk but skipped. This is
    used for the earthquake aerial dataset where AIDER's "Collapsed Building"
    images are predominantly destroyed, with too few major/minor examples
    to learn from.
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

    classes_to_split = ["destroyed", "no_damage"] if binary else CLASS_NAMES

    print(f"\n{'='*55}")
    mode = "BINARY (destroyed vs no_damage)" if binary else "4-class"
    print(f"  Splitting labeled/ into train/ and val/ (ratio={train_ratio}, mode={mode})")
    print(f"{'='*55}")

    for cls in classes_to_split:
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
        cut = int(len(shuffled) * train_ratio)
        train_imgs, val_imgs = shuffled[:cut], shuffled[cut:]

        (train_dir / cls).mkdir(parents=True, exist_ok=True)
        (val_dir / cls).mkdir(parents=True, exist_ok=True)

        for p in train_imgs:
            shutil.copy2(p, train_dir / cls / p.name)
        for p in val_imgs:
            shutil.copy2(p, val_dir / cls / p.name)

        print(f"  {cls:<11}: train={len(train_imgs)}, val={len(val_imgs)}")

    print(f"\nDone. Labeled originals are preserved in {labeled}.")


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Label aerial AIDER photos by damage level."
    )
    parser.add_argument(
        '--disaster', required=True, choices=list(DISASTER_TO_DIR.keys()),
        help="Which disaster type's photos to label",
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
        '--binary', action='store_true',
        help="With --split: use only destroyed/no_damage (for earthquake aerial)",
    )
    args = parser.parse_args()

    dataset_dir = DISASTER_TO_DIR[args.disaster]

    if args.split:
        split_labeled(dataset_dir, force=args.force, binary=args.binary)
        return

    if not (dataset_dir / "raw_unlabeled").exists():
        print(f"ERROR: {dataset_dir / 'raw_unlabeled'} does not exist.")
        print("  Run `python ml_engine/aider_to_dataset.py` first.")
        sys.exit(1)

    root = tk.Tk()
    LabelingApp(root, args.disaster, dataset_dir)
    root.mainloop()


if __name__ == "__main__":
    main()
