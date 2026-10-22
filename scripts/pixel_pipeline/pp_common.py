"""Shared helpers for the Echo Alchemist pixel pipeline (Python 3 + Pillow only).

Spec source: docs/design/art_vfx_ui_direction_v1.md section 2 / 3 / 5.4.
Thresholds marked PROVISIONAL are starting values of this pipeline (method
conventions), not facts proven by any primary source.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PALETTE = REPO_ROOT / "docs" / "art" / "pixel_pipeline" / "palette.json"

# 1 art pixel per grid cell edge: 24 art px per combat cell (A1: enemy 24x24).
CELL_ART_PX = 24

# PROVISIONAL color caps (outline included). Method convention.
COLOR_CAP = {
    "icon_16": 6,
    "icon_24": 10,
    "enemy": 12,
    "elite": 12,
    "boss": 24,
    "px": 32,
}

# PROVISIONAL enemy contract (spec section 3.1).
FILL_MIN = 0.60
FILL_MAX = 0.90
MAX_OVERFLOW_PX = 1
ALPHA_SOLID_COVERAGE = 0.45  # spec section 5.4
NO_DITHER_BELOW = 32  # spec section 5.4

CLASS_RE = re.compile(r"^(enemy|elite|boss)_(\d+)x(\d+)$")
PX_RE = re.compile(r"^px_(\d+)x(\d+)$")


class ClassSpec:
    def __init__(self, name: str, kind: str, width: int, height: int, cells=None):
        self.name = name
        self.kind = kind  # enemy | elite | boss | icon | px
        self.width = width
        self.height = height
        self.cells = cells  # (cols, rows) for creatures, else None

    @property
    def is_creature(self) -> bool:
        return self.kind in ("enemy", "elite", "boss")

    @property
    def color_cap(self) -> int:
        if self.kind == "icon":
            return COLOR_CAP[self.name]
        return COLOR_CAP[self.kind]

    def default_collision(self):
        """Collision box in art px, centred: grid minus the 1px empty margin."""
        return (self.width - 2, self.height - 2)

    def to_dict(self):
        return {
            "name": self.name,
            "kind": self.kind,
            "width": self.width,
            "height": self.height,
            "cells": list(self.cells) if self.cells else None,
            "color_cap": self.color_cap,
        }


def parse_class(name: str) -> ClassSpec:
    """enemy_CxR / elite_CxR / boss_CxR -> 24*C x 24*R; icon_24; icon_16; px_WxH."""
    m = CLASS_RE.match(name)
    if m:
        kind, c, r = m.group(1), int(m.group(2)), int(m.group(3))
        if c < 1 or r < 1 or c > 6 or r > 6:
            raise ValueError(f"cells out of range in class {name!r}")
        return ClassSpec(name, kind, CELL_ART_PX * c, CELL_ART_PX * r, (c, r))
    if name in ("icon_24", "icon_16"):
        s = int(name.split("_")[1])
        return ClassSpec(name, "icon", s, s)
    m = PX_RE.match(name)
    if m:
        return ClassSpec(name, "px", int(m.group(1)), int(m.group(2)))
    raise ValueError(
        f"unknown class {name!r}; use enemy_CxR | elite_CxR | boss_CxR | icon_24 | icon_16 | px_WxH"
    )


def parse_wh(text: str):
    m = re.match(r"^(\d+)x(\d+)$", text.strip().lower())
    if not m:
        raise ValueError(f"expected WxH, got {text!r}")
    return int(m.group(1)), int(m.group(2))


def hex_to_rgb(h: str):
    h = h.strip().lstrip("#")
    if len(h) != 6:
        raise ValueError(f"bad hex color {h!r}")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb) -> str:
    return "#%02x%02x%02x" % tuple(rgb[:3])


class Palette:
    def __init__(self, path: Path):
        self.path = Path(path)
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.data = data
        self.colors = data["colors"]
        self.ids = [c["id"] for c in self.colors]
        self.rgb = [hex_to_rgb(c["hex"]) for c in self.colors]
        self.roles = [set(c.get("roles", [])) for c in self.colors]
        self.outline_index = self.ids.index(data.get("outline_id", "outline"))
        self.by_rgb = {rgb: i for i, rgb in enumerate(self.rgb)}
        if len(self.by_rgb) != len(self.rgb):
            raise ValueError("palette has duplicate colors")
        canon = ",".join(c["hex"].lower() for c in self.colors)
        self.hash = hashlib.sha256(canon.encode("ascii")).hexdigest()

    def indices_for_layer(self, layer: str, allow_outline_interior: bool = False):
        out = []
        for i, roles in enumerate(self.roles):
            if i == self.outline_index and not allow_outline_interior:
                continue
            if layer == "interactable" and "interactable" in roles:
                out.append(i)
            elif layer == "background" and "background" in roles:
                out.append(i)
            elif layer == "feedback" and "feedback" in roles:
                out.append(i)
        return out


def weighted_dist2(a, b) -> int:
    """'Redmean' weighted RGB distance (integer form, deterministic).

    d^2 = (512 + rbar) * dr^2 / 256 + 4 * dg^2 + (767 - rbar) * db^2 / 256, scaled by 256.
    """
    rbar = (a[0] + b[0]) // 2
    dr = a[0] - b[0]
    dg = a[1] - b[1]
    db = a[2] - b[2]
    return (512 + rbar) * dr * dr + 1024 * dg * dg + (767 - rbar) * db * db


def nearest_index(rgb, candidates, palette_rgb, cache=None) -> int:
    if cache is not None:
        hit = cache.get(rgb)
        if hit is not None:
            return hit
    best_i = candidates[0]
    best_d = None
    for i in candidates:  # candidates are in ascending palette order -> ties resolve to lowest index
        d = weighted_dist2(rgb, palette_rgb[i])
        if best_d is None or d < best_d:
            best_d = d
            best_i = i
    if cache is not None:
        cache[rgb] = best_i
    return best_i


def flat_data(img: Image.Image):
    """Pixel sequence; Pillow >= 12 deprecates getdata() in favour of get_flattened_data()."""
    fn = getattr(img, "get_flattened_data", None)
    return list(fn() if fn else img.getdata())


def sha256_file(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def save_png_deterministic(img: Image.Image, path) -> None:
    """Save without metadata so that identical pixels -> identical bytes (same Pillow build)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    img.save(tmp, format="PNG", optimize=False, compress_level=9)
    os.replace(tmp, path)


def write_json(path, obj) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)
    # read-back assertion (see truncation-root-cause-analysis.md section 8)
    if Path(path).read_text(encoding="utf-8") != text:
        raise IOError(f"read-back mismatch writing {path}")


def rel_to_repo(path) -> str:
    p = Path(path).resolve()
    try:
        return p.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return p.as_posix()


# ---------------------------------------------------------------- grid analysis

def index_grid(img: Image.Image, palette: Palette):
    """Return (grid, unknown) where grid[y][x] = palette index or -1 (transparent)
    and unknown = list of (x, y, rgba) for solid pixels outside the palette."""
    w, h = img.size
    px = img.convert("RGBA").load()
    grid = [[-1] * w for _ in range(h)]
    unknown = []
    for y in range(h):
        row = grid[y]
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            i = palette.by_rgb.get((r, g, b))
            if i is None:
                unknown.append((x, y, (r, g, b, a)))
                row[x] = -2
            else:
                row[x] = i
    return grid, unknown


def orphan_pixels(grid, outline_index: int):
    """Orphan = non-outline solid pixel whose palette index differs from all of its
    solid 8-neighbours (a single-pixel color island). PROVISIONAL definition."""
    h = len(grid)
    w = len(grid[0]) if h else 0
    out = []
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c < 0 or c == outline_index:
                continue
            same = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and grid[ny][nx] == c:
                        same = True
                        break
                if same:
                    break
            if not same:
                out.append((x, y))
    return out


def solid_bbox(grid):
    xs, ys = [], []
    for y, row in enumerate(grid):
        for x, c in enumerate(row):
            if c != -1:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


def collision_rect(size, collision_wh):
    w, h = size
    cw, ch = collision_wh
    return ((w - cw) // 2, (h - ch) // 2, cw, ch)


def fill_and_overflow(grid, rect):
    """Fill ratio of solid pixels inside rect, and max overflow distance (px) outside rect."""
    rx, ry, rw, rh = rect
    inside = 0
    overflow = 0
    for y, row in enumerate(grid):
        for x, c in enumerate(row):
            if c == -1:
                continue
            if rx <= x < rx + rw and ry <= y < ry + rh:
                inside += 1
            else:
                dx = (rx - x) if x < rx else (x - (rx + rw - 1)) if x >= rx + rw else 0
                dy = (ry - y) if y < ry else (y - (ry + rh - 1)) if y >= ry + rh else 0
                overflow = max(overflow, dx, dy)
    area = rw * rh
    return (inside / area if area else 0.0), overflow
