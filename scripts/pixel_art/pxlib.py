"""pxlib -- a tiny deterministic pixel-art drawing library (Python 3 + Pillow only).

Everything is drawn in palette *ids* (see docs/art/pixel_pipeline/palette.json);
RGB values only appear at export time, so every exported pixel is in the palette
by construction. ``None`` means fully transparent.

Conventions
-----------
* Canvas coordinates: (x, y), origin top-left, integer pixels.
* Light comes from the top-left; shadows fall to the bottom-right.
* ``outline()`` adds the 1px 4-neighbour dark outline used by the interactable layer.
* Feedback-layer pixels (glow, muzzle flash) are drawn *after* outlining so they
  never receive an outline.
"""
from __future__ import annotations

import json
import os
import random
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PALETTE_PATH = os.path.join(ROOT, "docs", "art", "pixel_pipeline", "palette.json")
SAMPLES_DIR = os.path.join(ROOT, "docs", "art", "samples")
PREVIEW_BG = (38, 34, 47)  # preview backdrop only (never inside an asset)


# --------------------------------------------------------------------------- palette
class Palette:
    def __init__(self, path: str = PALETTE_PATH):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        self.data = data
        self.rgb: Dict[str, Tuple[int, int, int]] = {}
        self.roles: Dict[str, List[str]] = {}
        self.group: Dict[str, str] = {}
        self.step: Dict[str, int] = {}
        for c in data["colors"]:
            h = c["hex"].lstrip("#")
            self.rgb[c["id"]] = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
            self.roles[c["id"]] = list(c["roles"])
            self.group[c["id"]] = c["group"]
            self.step[c["id"]] = int(c["step"])
        self.outline_id = data["outline_id"]

    def __contains__(self, cid: str) -> bool:
        return cid in self.rgb

    def ids_with_role(self, role: str) -> List[str]:
        return [k for k, v in self.roles.items() if role in v]

    def shift(self, cid: Optional[str], d: int) -> Optional[str]:
        """Move a ramp colour d steps brighter (+) / darker (-), clamped to 1..5."""
        if cid is None or "_" not in cid:
            return cid
        base, n = cid.rsplit("_", 1)
        if not n.isdigit():
            return cid
        lo = 0 if base == "bg" else 1
        hi = 3 if base == "bg" else 5
        k = max(lo, min(hi, int(n) + d))
        return f"{base}_{k}"


PAL = Palette()


def ramp(name: str, step: int) -> str:
    cid = f"{name}_{step}"
    assert cid in PAL, cid
    return cid


# --------------------------------------------------------------------------- canvas
class Canvas:
    def __init__(self, w: int, h: int, fill: Optional[str] = None):
        self.w, self.h = w, h
        self.px: List[List[Optional[str]]] = [[fill] * w for _ in range(h)]

    # -- basic access
    def inb(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x: int, y: int) -> Optional[str]:
        return self.px[y][x] if self.inb(x, y) else None

    def put(self, x: int, y: int, c: Optional[str]) -> None:
        if c is not None and c not in PAL:
            raise ValueError(f"colour {c!r} not in palette")
        if self.inb(x, y):
            self.px[y][x] = c

    def copy(self) -> "Canvas":
        o = Canvas(self.w, self.h)
        o.px = [row[:] for row in self.px]
        return o

    def pixels(self) -> Iterable[Tuple[int, int, str]]:
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c is not None:
                    yield x, y, c

    def mask(self) -> set:
        return {(x, y) for x, y, _ in self.pixels()}

    def bbox(self) -> Optional[Tuple[int, int, int, int]]:
        m = self.mask()
        if not m:
            return None
        xs = [p[0] for p in m]
        ys = [p[1] for p in m]
        return min(xs), min(ys), max(xs), max(ys)

    # -- primitives
    def rect(self, x: int, y: int, w: int, h: int, c: Optional[str], fill: bool = True) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if fill or yy in (y, y + h - 1) or xx in (x, x + w - 1):
                    self.put(xx, yy, c)

    def hline(self, x0: int, x1: int, y: int, c: Optional[str]) -> None:
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.put(x, y, c)

    def vline(self, x: int, y0: int, y1: int, c: Optional[str]) -> None:
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.put(x, y, c)

    def line(self, x0: int, y0: int, x1: int, y1: int, c: Optional[str]) -> None:
        """Bresenham line (pixel-perfect, no doubles at 45 degrees)."""
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.put(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, c: Optional[str]) -> None:
        """Filled ellipse sampled at pixel centres."""
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    self.put(x, y, c)

    def polygon(self, pts: Sequence[Tuple[float, float]], c: Optional[str]) -> None:
        """Even-odd scanline fill sampled at pixel centres."""
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
            sy = y + 0.5
            xs = []
            n = len(pts)
            for i in range(n):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
                if (y0 <= sy < y1) or (y1 <= sy < y0):
                    xs.append(x0 + (sy - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[0::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))):
                    self.put(x, y, c)

    def grid(self, rows: Sequence[str], cmap: Dict[str, Optional[str]], ox: int = 0, oy: int = 0) -> None:
        """Stamp a string grid. '.' and ' ' are skipped; map a char to None to erase."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in ".  ":
                    continue
                self.put(ox + i, oy + j, cmap[ch])

    def blit(self, other: "Canvas", ox: int, oy: int) -> None:
        for x, y, c in other.pixels():
            self.put(ox + x, oy + y, c)

    def shifted(self, dx: int, dy: int) -> "Canvas":
        o = Canvas(self.w, self.h)
        o.blit(self, dx, dy)
        return o

    def recolor(self, fn) -> None:
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c is not None:
                    self.px[y][x] = fn(x, y, c)

    # -- outline / cleanup
    def outline(self, c: str = "outline", skip: Iterable[str] = (), diagonal: bool = False) -> None:
        """Add a 1px outline on transparent pixels touching opaque pixels.

        Pixels whose colour is listed in ``skip`` do not cast an outline.
        """
        skip = set(skip)
        src = [(x, y) for x, y, cc in self.pixels() if cc not in skip and cc != c]
        nb = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        if diagonal:
            nb += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        add = set()
        for x, y in src:
            for dx, dy in nb:
                if self.inb(x + dx, y + dy) and self.px[y + dy][x + dx] is None:
                    add.add((x + dx, y + dy))
        for x, y in add:
            self.px[y][x] = c

    def remove_orphans(self, keep: Iterable[str] = (), min_neighbours: int = 1) -> int:
        """Delete opaque pixels with fewer than ``min_neighbours`` opaque 4-neighbours."""
        keep = set(keep)
        removed = 0
        changed = True
        while changed:
            changed = False
            for x, y, c in list(self.pixels()):
                if c in keep:
                    continue
                n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if self.get(x + dx, y + dy) is not None)
                if n < min_neighbours:
                    self.px[y][x] = None
                    removed += 1
                    changed = True
        return removed

    # -- export
    def to_image(self) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        put = im.putpixel
        for x, y, c in self.pixels():
            r, g, b = PAL.rgb[c]
            put((x, y), (r, g, b, 255))
        return im

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.to_image().save(path)


# --------------------------------------------------------------------------- shading
def offset_bands(mask: set, k: int, dx: int, dy: int) -> set:
    """Pixels of mask whose neighbour k steps along (dx,dy) is outside mask (= the rim facing that way)."""
    return {(x, y) for (x, y) in mask if (x + k * dx, y + k * dy) not in mask}


def shade_body(cv: Canvas, mask: set, name: str, base: int = 3, rim_light: bool = True,
               deep: int = 3, spec: Optional[Sequence[Tuple[int, int]]] = None) -> None:
    """Fill mask with a 4-step ramp lit from the top-left.

    base = mid step; bottom-right rim gets base-1 (``deep`` px wide) and base-2 (1px);
    top-left rim gets base+1. ``spec`` lists explicit highlight pixels (base+2).
    """
    for p in mask:
        cv.put(p[0], p[1], ramp(name, base))
    mid_shadow = offset_bands(mask, deep, 1, 1)
    for p in mid_shadow:
        cv.put(p[0], p[1], ramp(name, base - 1))
    for p in offset_bands(mask, 1, 1, 1):
        cv.put(p[0], p[1], ramp(name, max(1, base - 2)))
    if rim_light:
        for p in offset_bands(mask, 1, -1, -1):
            if p not in mid_shadow:
                cv.put(p[0], p[1], ramp(name, base + 1))
    for p in spec or ():
        cv.put(p[0], p[1], ramp(name, min(5, base + 2)))


def mask_from(cv_or_fn) -> set:
    return cv_or_fn.mask()


def shape_mask(w: int, h: int, draw) -> set:
    """Build a mask by drawing with an arbitrary colour onto a scratch canvas."""
    tmp = Canvas(w, h)
    draw(tmp)
    return tmp.mask()


# --------------------------------------------------------------------------- tiny fonts
DIGITS_3x5 = {
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["##.", "..#", ".#.", "#..", "###"],
    "3": ["##.", "..#", ".#.", "..#", "##."],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "##.", "..#", "##."],
    "6": [".##", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", ".#.", ".#.", ".#."],
    "8": ["###", "#.#", ".#.", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "##."],
    "/": ["..#", "..#", ".#.", "#..", "#.."],
    "W": ["#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
    "x": ["...", "#.#", ".#.", "#.#", "..."],
    "+": ["...", ".#.", "###", ".#.", "..."],
    " ": ["...", "...", "...", "...", "..."],
}


def text3x5(cv: Canvas, x: int, y: int, s: str, c: str, shadow: Optional[str] = None) -> int:
    """Draw with the 3x5 font (glyphs may be wider, e.g. W); 1px tracking. Returns next x.
    ``shadow`` draws a 1px drop shadow to the bottom-right first."""
    for ch in s:
        g = DIGITS_3x5[ch]
        for layer, col, d in ((0, shadow, 1), (1, c, 0)):
            if col is None:
                continue
            for j, row in enumerate(g):
                for i, ch2 in enumerate(row):
                    if ch2 == "#":
                        cv.put(x + i + d, y + j + d, col)
        x += len(g[0]) + 1
    return x


def text_width(s: str) -> int:
    return sum(len(DIGITS_3x5[ch][0]) + 1 for ch in s) - 1 if s else 0


# --------------------------------------------------------------------------- export helpers
def upscale(im: Image.Image, k: int) -> Image.Image:
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def _font():
    try:
        return ImageFont.load_default(size=11)
    except TypeError:  # very old Pillow
        return ImageFont.load_default()


def export_sheet(name: str, frames: Sequence[Tuple[str, Canvas]], kind: str, scale: int = 6,
                 out_dir: str = SAMPLES_DIR, backdrop=None, meta_extra: Optional[dict] = None) -> dict:
    """Write <name>.png (native strip, frames left->right, no gaps), <name>.json (frame map)
    and <name>_x6.png (labelled NEAREST preview)."""
    os.makedirs(out_dir, exist_ok=True)
    fw, fh = frames[0][1].w, frames[0][1].h
    for lab, f in frames:
        assert (f.w, f.h) == (fw, fh), (name, lab)
    sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, (_, f) in enumerate(frames):
        sheet.alpha_composite(f.to_image(), (i * fw, 0))
    sheet.save(os.path.join(out_dir, f"{name}.png"))
    meta = {
        "asset": name,
        "kind": kind,
        "palette": "docs/art/pixel_pipeline/palette.json",
        "frame_w": fw,
        "frame_h": fh,
        "frames": [{"index": i, "label": lab, "x": i * fw, "y": 0} for i, (lab, _) in enumerate(frames)],
    }
    if meta_extra:
        meta.update(meta_extra)
    with open(os.path.join(out_dir, f"{name}.json"), "w", encoding="utf-8") as fh_:
        json.dump(meta, fh_, indent=2, ensure_ascii=False)
    # preview
    pad, lab_h = 6, 16
    cw, ch = fw * scale, fh * scale
    prev = Image.new("RGBA", (pad + len(frames) * (cw + pad), pad + ch + lab_h + pad), PREVIEW_BG + (255,))
    d = ImageDraw.Draw(prev)
    d.fontmode = "1"
    font = _font()
    bd = backdrop or PAL.rgb["bg_0"]
    for i, (lab, f) in enumerate(frames):
        x0 = pad + i * (cw + pad)
        d.rectangle([x0, pad, x0 + cw - 1, pad + ch - 1], fill=bd + (255,))
        prev.alpha_composite(upscale(f.to_image(), scale), (x0, pad))
        d.text((x0, pad + ch + 3), lab, fill=(232, 230, 240, 255), font=font)
    prev.save(os.path.join(out_dir, f"{name}_x{scale}.png"))
    return meta


def seeded(seed: int) -> random.Random:
    return random.Random(seed)
