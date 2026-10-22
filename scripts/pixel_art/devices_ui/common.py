"""Shared helpers for the devices/UI/board batch (imports pxlib, never modifies it).

Native sheets + JSON frame maps go to assets/pixel/<group>/, labelled x6 previews go to
docs/art/batch_devices_ui/. Material helpers mirror the approved scripts/pixel_art/devices.py
(copied, not imported, so the approved sample script stays untouched).
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from PIL import Image, ImageDraw  # noqa: E402

from pxlib import PAL, PREVIEW_BG, ROOT, Canvas, _font, offset_bands, ramp, upscale  # noqa: E402,F401

ASSET_DIR = os.path.join(ROOT, "assets", "pixel")
PREVIEW_DIR = os.path.join(ROOT, "docs", "art", "batch_devices_ui")
REGISTRY = []  # (group, name) in build order, used by the contact sheet


# ----------------------------------------------------------------------------- export
def export(group: str, name: str, frames, kind: str, layer: str = "interactable",
           meta_extra: dict = None, scale: int = 6) -> dict:
    """frames: list of (label, Canvas) of identical size.
    Writes assets/pixel/<group>/<name>.png (+ .json) and docs/art/batch_devices_ui/<name>_x6.png."""
    out_dir = os.path.join(ASSET_DIR, group)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    fw, fh = frames[0][1].w, frames[0][1].h
    for lab, f in frames:
        assert (f.w, f.h) == (fw, fh), (name, lab, f.w, f.h)
    sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, (_, f) in enumerate(frames):
        sheet.alpha_composite(f.to_image(), (i * fw, 0))
    sheet.save(os.path.join(out_dir, f"{name}.png"))
    meta = {
        "asset": name,
        "kind": kind,
        "layer": layer,
        "palette": "docs/art/pixel_pipeline/palette.json",
        "frame_w": fw,
        "frame_h": fh,
        "frames": [{"index": i, "label": lab, "x": i * fw, "y": 0} for i, (lab, _) in enumerate(frames)],
    }
    if meta_extra:
        meta.update(meta_extra)
    with open(os.path.join(out_dir, f"{name}.json"), "w", encoding="utf-8") as fh_:
        json.dump(meta, fh_, indent=2, ensure_ascii=False)
    preview(name, frames, scale)
    REGISTRY.append((group, name))
    return meta


def preview(name, frames, scale=6, per_row=10):
    fw, fh = frames[0][1].w, frames[0][1].h
    pad, lab_h = 6, 16
    cw, ch = fw * scale, fh * scale
    cols = min(per_row, len(frames))
    cell = max(cw, 60, max(len(l) for l, _ in frames) * 6 + 6)
    rows = (len(frames) + cols - 1) // cols
    W = pad + cols * (cell + pad)
    H = pad + rows * (ch + lab_h + pad)
    prev = Image.new("RGBA", (W, H), PREVIEW_BG + (255,))
    d = ImageDraw.Draw(prev)
    d.fontmode = "1"
    font = _font()
    bd = PAL.rgb["bg_0"] + (255,)
    for i, (lab, f) in enumerate(frames):
        x0 = pad + (i % cols) * (cell + pad)
        y0 = pad + (i // cols) * (ch + lab_h + pad)
        d.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], fill=bd)
        prev.alpha_composite(upscale(f.to_image(), scale), (x0, y0))
        d.text((x0, y0 + ch + 3), lab, fill=(232, 230, 240, 255), font=font)
    prev.save(os.path.join(PREVIEW_DIR, f"{name}_x{scale}.png"))


# ----------------------------------------------------------------------------- materials
def vcyl(cv, x0, x1, y0, y1, name, base=3):
    """Vertical cylinder lit from the left: hi | base... | shadow | deep."""
    for x in range(x0, x1 + 1):
        if x == x0:
            c = ramp(name, min(5, base + 1))
        elif x == x1:
            c = ramp(name, max(1, base - 2))
        elif x >= x1 - (1 if x1 - x0 < 5 else 2):
            c = ramp(name, max(1, base - 1))
        else:
            c = ramp(name, base)
        cv.vline(x, y0, y1, c)


def hband(cv, x0, x1, y, name, base=3):
    for x in range(x0, x1 + 1):
        c = ramp(name, base + 1) if x <= x0 + 1 else ramp(name, base - 1) if x >= x1 - 1 else ramp(name, base)
        cv.put(x, y, c)


def shade_mask(cv, m, name, base, hl=True):
    for p in m:
        cv.put(p[0], p[1], ramp(name, base))
    sh = offset_bands(m, 2, 1, 1)
    for p in sh:
        cv.put(p[0], p[1], ramp(name, base - 1))
    for p in offset_bands(m, 1, 1, 1):
        cv.put(p[0], p[1], ramp(name, max(1, base - 2)))
    if hl:
        for p in offset_bands(m, 1, -1, -1):
            if p not in sh:
                cv.put(p[0], p[1], ramp(name, min(5, base + 1)))


def mask_of(fn, w, h):
    t = Canvas(w, h)
    fn(t)
    return t.mask()


def darken(cv, keep=()):
    """Unpowered look: every ramp colour one step darker, brass -> dull stone, white removed."""
    out = cv.copy()

    def fn(x, y, c):
        if c in keep or c == "outline":
            return c
        if c == "white":
            return "steel_4"
        if c.startswith("lightning_"):
            return PAL.shift("stone_" + c.split("_")[1], -1)
        if c.startswith(("venom_", "cryo_", "pyro_", "echo_")):  # dead reagent / glass
            return PAL.shift(c, -2)
        return PAL.shift(c, -1)
    out.recolor(fn)
    return out


def base_plate(cv, y0, y1, x0, x1):
    """Iron mounting plate bolted into the slot (identical to the approved devices)."""
    cv.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "steel_3")
    cv.hline(x0, x1, y0, "steel_4")
    cv.hline(x0, x1, y1, "steel_1")
    cv.vline(x1, y0, y1, "steel_2")
    cv.vline(x0, y0, y1 - 1, "steel_4")
    for bx in (x0 + 1, x1 - 1):
        cv.put(bx, y0 + 1, "steel_5")


def lamp(cv, x, y, on: bool):
    """2x2 status lamp: green = powered, red = no power."""
    if on:
        cols = ("venom_4", "venom_3", "venom_3", "venom_2")
    else:
        cols = ("pyro_4", "pyro_3", "pyro_3", "pyro_2")
    for (dx, dy), c in zip(((0, 0), (1, 0), (0, 1), (1, 1)), cols):
        cv.put(x + dx, y + dy, c)


def stamp_rows(cv, rows, cmap, ox=0, oy=0):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in ". ":
                continue
            cv.put(ox + i, oy + j, cmap[ch])


def star(cv, cx, cy, big=False, cols=("white", "lightning_5", "pyro_5")):
    """Feedback flash, never outlined."""
    w, a, b = cols
    if big:
        rows = ["....a....", "..a.w.a..", "...www...", ".awwwwwa.", "...www...", "..b.a.b.."]
    else:
        rows = ["..a..", "a.w.a", ".www.", "b.w.b"]
    stamp_rows(cv, rows, {"w": w, "a": a, "b": b}, cx - len(rows[0]) // 2, cy)
