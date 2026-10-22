"""Shared helpers for the enemy batch (scripts/pixel_art/enemies/).

Same family rules as the approved samples (docs/art/samples, enemy_residue.py):
* palette ids only (pxlib), binary alpha, 1px 4-neighbour dark outline on the body,
  top-left light via pxlib.shade_body, focal core + eyes on every enemy.
* feedback pixels (flames, sparks, trails, auras) are drawn after the outline.

New here: the *shatter* damage language. HP stages keep the outer silhouette
envelope and remove material as jagged notches bitten in from the rim plus
punched holes; the break rims glow with the core colour and dark crack lines
run from each notch tip toward the core. Protected pixels (eyes, core, affix
feature) are never removed.
"""
from __future__ import annotations

import json
import math
import os
import sys
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from PIL import Image, ImageDraw  # noqa: E402

from pxlib import PAL, PREVIEW_BG, ROOT, Canvas, _font, offset_bands, ramp, seeded, shade_body, upscale  # noqa: E402

ASSET_DIR = os.path.join(ROOT, "assets", "pixel", "enemies")
PREVIEW_DIR = os.path.join(ROOT, "docs", "art", "batch_enemies")
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))

STD_FRAMES = ["idle_a", "idle_b", "hit_flash", "hp_75", "hp_50", "hp_25", "frozen", "burning", "death_1", "death_2"]
STAGE = {0.75: 1, 0.5: 2, 0.25: 3}


# ----------------------------------------------------------------------------- small utils
def dilate(s: set, r: int = 1, nb=N8) -> set:
    out = set(s)
    for _ in range(r):
        out |= {(x + dx, y + dy) for (x, y) in out for dx, dy in nb}
    return out


def erode(s: set) -> set:
    return {(x, y) for (x, y) in s if all((x + dx, y + dy) in s for dx, dy in N4)}


def poly_px(poly: Sequence[Tuple[float, float]], w: int, h: int) -> set:
    t = Canvas(w, h)
    t.polygon(poly, "white")
    return t.mask()


def finish(cv: Canvas, skip: Iterable[str] = ()) -> Canvas:
    out = cv.copy()
    out.outline("outline", skip=skip)
    return out


def hit_flash(cv: Canvas) -> Canvas:
    out = cv.copy()
    out.recolor(lambda x, y, c: c if c == "outline" else "white")
    return out


def ramp_of(cid: Optional[str]) -> Tuple[Optional[str], int]:
    if cid is None or "_" not in cid:
        return None, 0
    b, n = cid.rsplit("_", 1)
    return (b, int(n)) if n.isdigit() else (None, 0)


# ----------------------------------------------------------------------------- faces
# Same face vocabulary as enemy_residue.FACE (slanted eyes under brows, jagged mouth,
# diamond reactor core in a dark socket); three sizes so every shape can carry it.
# Chars: 1 socket/brow (body_1)  o outline  e eye hi  E eye lo  c/C/W core 3/4/5  w white
EYES = {
    "L": [".1..........1.", "1eeo......oee1", ".1EEo....oEE1.", "..11......11.."],
    "M": [".1......1.", "1eeo..oee1", ".1Eo..oE1.", "..1....1.."],
    "S": ["1eo..oe1", ".1....1."],
}
MOUTH = {
    "L": ["....o.oo.o....", ".....o..o.....", "......11......"],
    "M": ["..o.oo.o..", "...o..o..."],
    "S": ["..o..o..", "...oo..."],
}
CORE = {
    "L": ["......11......", ".....1cc1.....", "....1cCCc1....", "...1cCwWCc1...", "...1cCWWCc1...",
          "....1cCCc1....", ".....1cc1....."],
    "M": ["....11....", "...1cc1...", "..1cwWc1..", "..1cWCc1..", "...1cc1...", "....11...."],
    "S": ["..11..", ".1wC1.", ".1Cc1.", "..11.."],
}


class Theme:
    def __init__(self, body: str, core: str, eye=("pyro_5", "pyro_4"), body2: Optional[str] = None):
        self.body, self.core, self.eye, self.body2 = body, core, eye, body2

    def cmap(self, brow: Optional[str] = None) -> Dict[str, str]:
        return {"1": brow or ramp(self.body, 1), "o": "outline", "e": self.eye[0], "E": self.eye[1],
                "c": ramp(self.core, 3), "C": ramp(self.core, 4), "W": ramp(self.core, 5), "w": "white"}


def stamp(cv: Canvas, rows: Sequence[str], axis_x: float, y: int, cmap: Dict[str, str]) -> Dict[Tuple[int, int], str]:
    """Stamp a symmetric grid centred on axis_x (e.g. 11.5 = between px 11 and 12)."""
    ox = int(round(axis_x + 0.5 - len(rows[0]) / 2))
    put = {}
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == ".":
                continue
            put[(ox + i, y + j)] = cmap[ch]
    for (x, yy), c in put.items():
        cv.put(x, yy, c)
    return put


def draw_face(cv: Canvas, theme: Theme, axis_x: float, eye_y: int, core_y: int, size: str = "L",
              mouth_y: Optional[int] = None, core_size: Optional[str] = None, brow: Optional[str] = None) -> set:
    """Returns the protected set (eyes + core + core socket)."""
    cm = theme.cmap(brow)
    eyes = stamp(cv, EYES[size], axis_x, eye_y, cm)
    if mouth_y is not None:
        stamp(cv, MOUTH[size], axis_x, mouth_y, cm)
    core = stamp(cv, CORE[core_size or size], axis_x, core_y, cm)
    prot = {p for p, c in eyes.items() if c in theme.eye or c == "outline"}
    prot |= set(core)
    return prot


# ----------------------------------------------------------------------------- shatter damage
def _edge_point(mask: set, cx: float, cy: float, ang: float, maxr: int):
    last = None
    for r10 in range(0, maxr * 10):
        r = r10 / 10.0
        p = (int(math.floor(cx + math.cos(ang) * r)), int(math.floor(cy - math.sin(ang) * r)))
        if p in mask:
            last = p
        elif last is not None and r > 2:
            break
    return last


def envelope_anchors(mask: set) -> set:
    """The middle 3 px of each extreme row/column (+1px) are never removed, so the
    silhouette's bounding envelope survives every damage stage."""
    xs = [p[0] for p in mask]
    ys = [p[1] for p in mask]
    out = set()
    for pts in ([p for p in mask if p[1] == min(ys)], [p for p in mask if p[1] == max(ys)],
                [p for p in mask if p[0] == min(xs)], [p for p in mask if p[0] == max(xs)]):
        pts.sort()
        mid = len(pts) // 2
        out |= set(pts[max(0, mid - 1): mid + 2])
    return dilate(out, 1) & mask


def shatter(raw: Canvas, hp: float, protected: set, glow: str, center: Tuple[float, float],
            seed: int = 1, n_sites: Sequence[int] = (2, 4, 6), depth_k: Sequence[float] = (0.30, 0.42, 0.55),
            holes: Sequence[int] = (0, 1, 2), angles: Optional[Sequence[float]] = None,
            keep: Optional[set] = None) -> Tuple[Canvas, set]:
    """Shatter the body: jagged notches from the rim + punched holes, glowing break rims,
    dark crack lines toward the core. Cumulative and deterministic across stages.
    Returns (damaged raw canvas, removed pixel set)."""
    st = STAGE[hp]
    out = raw.copy()
    mask = raw.mask()
    if not mask:
        return out, set()
    xs = [p[0] for p in mask]
    ys = [p[1] for p in mask]
    w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
    rad = min(w, h) / 2.0
    cx, cy = center
    prot = dilate(protected, 1) | (keep or set()) | envelope_anchors(mask)
    rnd = seeded(seed)
    if angles is None:
        a0 = rnd.uniform(0, 360)
        angles = [(a0 + i * 137.5 + rnd.uniform(-15, 15)) % 360 for i in range(8)]
    sites = []
    for i, a in enumerate(angles[: n_sites[st - 1]]):
        org = (cx, cy)
        if isinstance(a, (tuple, list)):
            a, org = a[0], (a[1], a[2])
        stage_in = next(k for k in range(3) if i < n_sites[k]) + 1
        grow = st - stage_in  # 0,1,2 extra stages of growth
        depth = rad * depth_k[min(2, grow)] * (1.0 if i % 2 == 0 else 0.8)
        sites.append((math.radians(a), depth, i, org))
    removed: set = set()
    tips = []
    for ang, depth, i, (ox, oy) in sites:
        e = _edge_point(mask, ox + 0.5, oy + 0.5, ang, int(max(w, h)))
        if e is None:
            continue
        ux, uy = -math.cos(ang), math.sin(ang)   # inward = against the ray direction
        half = max(1.5, depth * 0.8)
        jr = seeded(seed * 31 + i)
        jag = [jr.choice((-1, 0, 0, 1)) for _ in range(64)]
        for (x, y) in mask:
            dx, dy = x - e[0], y - e[1]
            t = dx * ux + dy * uy
            s = -dx * uy + dy * ux
            if -2 <= t <= depth:
                k = int(t + 2)
                lim = half * (1 - max(0.0, t) / depth) + 0.5 * jag[k % 64] + (0.6 if s > 0 else 0)
                if abs(s) <= lim and (x, y) not in prot:
                    removed.add((x, y))
        tips.append((e[0] + ux * depth, e[1] + uy * depth, ux, uy, depth, i))
    # punched holes (interior) at later stages: a dark cavity, lit on its lower-right wall
    hr = seeded(seed * 7 + 3)
    inner = [p for p in sorted(mask) if p not in dilate(prot, 2)
             and all((p[0] + dx, p[1] + dy) in mask for dx in range(-4, 5) for dy in range(-4, 5))]
    hole_cent = []
    if inner:
        cand = inner[:]
        hr.shuffle(cand)
        for p in cand:
            if len(hole_cent) >= holes[st - 1]:
                break
            if all(math.hypot(p[0] - q[0], p[1] - q[1]) > rad * 0.6 for q in hole_cent):
                hole_cent.append(p)
    hrad = max(1.6, rad * 0.12)
    cavity = set()
    for (hx, hy) in hole_cent:
        for (x, y) in mask:
            if math.hypot(x - hx, (y - hy) * 1.15) <= hrad and (x, y) not in prot:
                cavity.add((x, y))
    for p in removed:
        out.put(p[0], p[1], None)
    out.remove_orphans(min_neighbours=1)
    removed = mask - out.mask()
    # break rim: dark broken edge (body step 1) with core glow leaking only near each notch tip
    rim = {(x + dx, y + dy) for (x, y) in removed for dx, dy in N4} & out.mask()
    rim -= prot
    tip_zone = set()
    for (tx, ty, ux, uy, depth, i) in tips:
        for (x, y) in rim:
            if math.hypot(x - tx, y - ty) <= 1.6 + 0.4 * st:
                tip_zone.add((x, y))
    for (x, y) in rim:
        if (x, y) in tip_zone:
            continue
        b, n = ramp_of(out.get(x, y))
        if b and b != glow and b != "bg":
            out.put(x, y, f"{b}_{max(1, min(n, 2))}")
    for (x, y) in tip_zone:
        out.put(x, y, ramp(glow, 4))
    for (x, y) in cavity:
        if out.get(x, y) is None:
            continue
        out.put(x, y, "outline")
    for (hx, hy) in hole_cent:
        for (x, y) in ((hx + 1, hy + 1), (hx, hy + 1), (hx + 1, hy)):
            if (x, y) in cavity:
                out.put(x, y, ramp(glow, 4 if (x, y) == (hx + 1, hy + 1) else 3))
    # crack lines from each notch tip toward the core (dark, short, glow at the far end)
    for (tx, ty, ux, uy, depth, i) in tips:
        jr = seeded(seed * 97 + i)
        length = int(max(2, depth * (0.35 + 0.15 * st)))
        x, y = tx + ux, ty + uy
        prev = None
        drawn = []
        for k in range(length):
            p = (int(round(x)), int(round(y)))
            if p in prot or out.get(*p) is None:
                break
            if p != prev:
                out.put(p[0], p[1], "outline")
                drawn.append(p)
                prev = p
            x += ux + jr.uniform(-0.5, 0.5)
            y += uy + jr.uniform(-0.5, 0.5)
    return out, removed


# ----------------------------------------------------------------------------- frozen / burning / death (generic)
FREEZE_BODY = {"echo": "steel", "pyro": "steel", "lightning": "steel", "venom": "steel", "laser": "steel",
               "stone": "steel", "cryo": "steel", "steel": "steel", "bg": "bg"}


def frozen_generic(raw: Canvas, body_ramps: Iterable[str], core: str, eye: Sequence[str], keep: set = frozenset(),
                   inside: Optional[set] = None) -> Canvas:
    """Body ramp -> steel, core dims one step, eyes go icy; frost crust on the lit (top/left)
    rim and icicle glints. Grows nothing outside ``inside`` (collision shape) when given."""
    out = raw.copy()
    body_ramps = set(body_ramps)
    eye_map = {eye[0]: "cryo_5", eye[1]: "cryo_4"}

    def fn(x, y, c):
        if (x, y) in keep:
            return c
        if c in eye_map:
            return eye_map[c]
        b, n = ramp_of(c)
        if b == core:
            return c if c == "white" else f"{core}_{max(1, n - 1)}"
        if b in body_ramps:
            return f"steel_{n}"
        return c
    out.recolor(fn)
    m = raw.mask()
    tops: Dict[int, int] = {}
    lefts: Dict[int, int] = {}
    rights: Dict[int, int] = {}
    for (x, y) in m:
        tops[x] = min(tops.get(x, 9999), y)
        lefts[y] = min(lefts.get(y, 9999), x)
        rights[y] = max(rights.get(y, -1), x)
    W = raw.w
    for x, t in tops.items():
        if inside is None or (x, t - 1) in inside:
            out.put(x, t - 1, "cryo_4")
        out.put(x, t, "cryo_4" if x < W / 2 else "cryo_3")
        if x < W / 2 and (x, t + 1) in m and (x, t + 1) not in keep:
            out.put(x, t + 1, "cryo_3")
    H = raw.h
    for y, x in lefts.items():
        if y < H * 0.75 and (x, y) not in keep:
            out.put(x, y, "cryo_4" if y < H / 2 else "cryo_3")
    for y, x in rights.items():
        if y < H * 0.75 and (x, y) not in keep:
            out.put(x, y, "cryo_3")
    # icicles: lowest pixel of a few columns becomes ice (inside the shape)
    bottoms: Dict[int, int] = {}
    for (x, y) in m:
        bottoms[x] = max(bottoms.get(x, -1), y)
    cols = sorted(bottoms)
    for x in cols[2::max(3, len(cols) // 5)]:
        out.put(x, bottoms[x], "cryo_4")
        if (x, bottoms[x] - 1) in m:
            out.put(x, bottoms[x] - 1, "cryo_3")
    # glints near top-left
    tl = sorted(m, key=lambda p: p[0] + p[1])[:6]
    for p in tl[2:5:2]:
        out.put(p[0], p[1], "cryo_5")
    return out


def heat_rim(raw: Canvas, body_ramps: Iterable[str]) -> Canvas:
    out = raw.copy()
    body_ramps = set(body_ramps)
    tops: Dict[int, int] = {}
    for (x, y) in raw.mask():
        tops[x] = min(tops.get(x, 9999), y)
    for x, y in tops.items():
        for dy, col in ((0, "pyro_3"), (1, "pyro_2")):
            b, _ = ramp_of(out.get(x, y + dy))
            if b in body_ramps:
                out.put(x, y + dy, col)
    return out


FLAME = ["..5..", ".545.", ".343.", "34443"]
FLAME_S = [".5.", "545", "343"]


def flames_fx(out: Canvas, mask: set, xs: Sequence[Tuple[int, bool]], embers: Sequence[Tuple[int, int]], phase: int = 0):
    cmap = {"3": "pyro_3", "4": "pyro_4", "5": "pyro_5"}
    tops: Dict[int, int] = {}
    for (x, y) in mask:
        tops[x] = min(tops.get(x, 9999), y)
    for fx, small in xs:
        g = FLAME_S if small else FLAME
        gw = len(g[0])
        base = tops.get(fx + gw // 2, tops.get(fx, 10))
        oy = base - len(g) + 1 - (1 if phase else 0)
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch != ".":
                    out.put(fx + i, oy + j, cmap[ch])
    for p in embers:
        out.put(p[0], p[1], "pyro_5")


def death_generic(idle: Canvas, core_c: Tuple[int, int], core_ramp: str, k: int = 4) -> List[Canvas]:
    """Same language as enemy_residue.death_frames: crack into quadrants + core rupture,
    then pieces fly / fall and only sparks remain. Scaled block size for big bodies."""
    frames = []
    W, H = idle.w, idle.h
    cxc, cyc = core_c
    s = max(1, k // 4)
    for stage in (1, 2):
        out = Canvas(W, H)
        for by in range(0, H, k):
            for bx in range(0, W, k):
                cells = [(bx + i, by + j) for i in range(k) for j in range(k) if idle.get(bx + i, by + j) is not None]
                if len(cells) < k:
                    continue
                vx, vy = bx + k / 2 - cxc, by + k / 2 - cyc
                sx = (vx > 0) - (vx < 0)
                sy = (vy > 0) - (vy < 0)
                if stage == 1:
                    ox, oy = sx * s, sy * s
                else:
                    ox, oy = sx * 3 * s, sy * 2 * s + 2 * s
                if stage == 2 and ((bx // k + by // k) % 2 == 1):
                    continue
                for (x, y) in cells:
                    if stage == 2 and not (bx + 1 <= x <= bx + k - 2 and by + 1 <= y <= by + k - 2):
                        continue
                    out.put(x + ox, y + oy, idle.get(x, y))
        r = 2 * s
        if stage == 1:
            for y in range(cyc - r - 2, cyc + r + 3):
                for x in range(cxc - r - 2, cxc + r + 3):
                    d = abs(x - cxc) + abs(y - cyc)
                    if d <= r:
                        out.put(x, y, "white")
                    elif d == r + 1 and (x + y) % 2 == 0:
                        out.put(x, y, ramp(core_ramp, 5))
        else:
            R = 4 * s + 2
            for i in range(8):
                a = i * math.pi / 4
                for rr, col in ((R, ramp(core_ramp, 4)), (R - 1, ramp(core_ramp, 5))):
                    out.put(int(round(cxc + math.cos(a) * rr)), int(round(cyc + math.sin(a) * rr)), col)
        out.remove_orphans(keep=(ramp(core_ramp, 4), ramp(core_ramp, 5), "white"), min_neighbours=1)
        frames.append(out)
    return frames


# ----------------------------------------------------------------------------- export
def frame_map(frames: Sequence[Tuple[str, Canvas]]) -> dict:
    fw, fh = frames[0][1].w, frames[0][1].h
    return {lab: {"x": i * fw, "y": 0, "w": fw, "h": fh} for i, (lab, _) in enumerate(frames)}


def export(name: str, frames: Sequence[Tuple[str, Canvas]], meta_extra: Optional[dict] = None,
           scale: int = 6, preview: bool = True, per_row: int = 0) -> dict:
    os.makedirs(ASSET_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    fw, fh = frames[0][1].w, frames[0][1].h
    for lab, f in frames:
        assert (f.w, f.h) == (fw, fh), (name, lab)
    sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, (_, f) in enumerate(frames):
        sheet.alpha_composite(f.to_image(), (i * fw, 0))
    sheet.save(os.path.join(ASSET_DIR, f"{name}.png"))
    meta = {
        "asset": name,
        "schema": "echo-alchemist/pixel-sheet@1",
        "palette": "docs/art/pixel_pipeline/palette.json",
        "frame_w": fw,
        "frame_h": fh,
        "order": [lab for lab, _ in frames],
        "frames": frame_map(frames),
    }
    if meta_extra:
        meta.update(meta_extra)
    with open(os.path.join(ASSET_DIR, f"{name}.json"), "w", encoding="utf-8") as fh_:
        json.dump(meta, fh_, indent=2, ensure_ascii=False)
    if preview:
        save_preview(os.path.join(PREVIEW_DIR, f"{name}_x{scale}.png"), frames, scale, per_row)
    return meta


def save_preview(path: str, frames: Sequence[Tuple[str, Canvas]], scale: int, per_row: int = 0) -> None:
    fw, fh = frames[0][1].w, frames[0][1].h
    per_row = per_row or len(frames)
    rows = (len(frames) + per_row - 1) // per_row
    pad, lab_h = 6, 16
    cw, ch = fw * scale, fh * scale
    ncol = min(per_row, len(frames))
    prev = Image.new("RGBA", (pad + ncol * (cw + pad), pad + rows * (ch + lab_h + pad)), PREVIEW_BG + (255,))
    d = ImageDraw.Draw(prev)
    d.fontmode = "1"
    font = _font()
    bd = PAL.rgb["bg_0"]
    for i, (lab, f) in enumerate(frames):
        r, c = divmod(i, per_row)
        x0 = pad + c * (cw + pad)
        y0 = pad + r * (ch + lab_h + pad)
        d.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], fill=bd + (255,))
        prev.alpha_composite(upscale(f.to_image(), scale), (x0, y0))
        d.text((x0, y0 + ch + 3), lab, fill=(232, 230, 240, 255), font=font)
    prev.save(path)
