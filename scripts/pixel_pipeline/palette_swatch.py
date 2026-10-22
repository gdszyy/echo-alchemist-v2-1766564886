#!/usr/bin/env python3
"""Render docs/art/pixel_pipeline/palette.png from palette.json (one row per group, labelled).

Usage: python scripts/pixel_pipeline/palette_swatch.py [--out docs/art/pixel_pipeline/palette.png]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp_common as pc  # noqa: E402

CELL = 56
LABEL_W = 130


def build(palette: pc.Palette, out: Path):
    groups = []
    for i, c in enumerate(palette.colors):
        g = c["group"]
        if not groups or groups[-1][0] != g:
            groups.append((g, []))
        groups[-1][1].append(i)
    # outline + white share the first row with background neutrals
    rows = []
    head = [g for g in groups if g[0] in ("outline", "background", "white")]
    rows.append(("outline / bg / white", [i for _, idx in head for i in idx]))
    rows += [(g, idx) for g, idx in groups if g not in ("outline", "background", "white")]
    width = max(520, LABEL_W + CELL * max(len(r[1]) for r in rows) + 8)
    height = 24 + len(rows) * (CELL + 14) + 8
    img = Image.new("RGB", (width, height), (24, 22, 30))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=11)
        tiny = ImageFont.load_default(size=9)
    except TypeError:
        font = tiny = ImageFont.load_default()
    d.text((6, 4), f"{palette.data['name']}  {len(palette.rgb)} colors  hash {palette.hash[:12]}  "
                   f"B=background F=feedback", fill=(230, 228, 240), font=font)
    y = 24
    for label, idx in rows:
        d.text((6, y + 10), label, fill=(230, 228, 240), font=font)
        x = LABEL_W
        for i in idx:
            d.rectangle([x, y, x + CELL - 2, y + CELL - 2], fill=palette.rgb[i])
            tags = ("B" if "background" in palette.roles[i] else "") + ("F" if "feedback" in palette.roles[i] else "")
            d.text((x, y + CELL - 1), f"{palette.colors[i]['hex'][1:]}{(' ' + tags) if tags else ''}",
                   fill=(200, 198, 210), font=tiny)
            x += CELL
        y += CELL + 14
    pc.save_png_deterministic(img, out)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--palette", default=str(pc.DEFAULT_PALETTE))
    ap.add_argument("--out", default=str(pc.DEFAULT_PALETTE.with_name("palette.png")))
    args = ap.parse_args(argv)
    out = build(pc.Palette(Path(args.palette)), Path(args.out))
    print(f"[palette_swatch] wrote {pc.rel_to_repo(out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
