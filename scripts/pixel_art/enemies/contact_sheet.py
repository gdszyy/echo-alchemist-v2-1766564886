"""docs/art/batch_enemies/contact_sheet.png + family_lineup.png.

* family_lineup.png: every enemy's idle_a at NATIVE size on a muted battlefield grid
  (26 art px cells, background-role colours only), packed by grid footprint -- the
  "do they look like one family" check. The contact sheet shows it again at x3 on top.
* below it: every sheet, all frames (1x1 at x4, multi-cell at x2), labelled outside the art.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ASSET_DIR, PAL, PREVIEW_BG, PREVIEW_DIR, _font, upscale  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

CELL = 26
COLS = 14


def load(name):
    m = json.load(open(os.path.join(ASSET_DIR, name + ".json"), encoding="utf-8"))
    return m, Image.open(os.path.join(ASSET_DIR, name + ".png")).convert("RGBA")


def frame(m, im, lab):
    r = m["frames"][lab]
    return im.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))


def order():
    names = sorted(f[:-5] for f in os.listdir(ASSET_DIR) if f.endswith(".json") and not f.endswith("_overlay.json"))
    first = ["enemy_residue_1x1"] + [n for n in names if n.startswith("enemy_minion_")]
    aff = [n for n in names if n.startswith("elite_residue_")]
    multi = [n for n in names if n not in first and n not in aff]
    multi.sort(key=lambda n: -(load(n)[0]["grid"][0] * load(n)[0]["grid"][1]))
    return first, aff, multi


def lineup():
    first, aff, multi = order()
    occ = set()
    place = []

    def put(name, cw, ch):
        r = 0
        while True:
            for c in range(COLS - cw + 1):
                cells = {(c + i, r + j) for i in range(cw) for j in range(ch)}
                if not cells & occ:
                    occ.update(cells)
                    place.append((name, c, r))
                    return
            r += 1
    for n in multi:
        g = load(n)[0]["grid"]
        put(n, g[0], g[1])
    for n in first + aff:
        put(n, 1, 1)
    rows = max(r for (_, r) in occ) + 1
    W, H = COLS * CELL, rows * CELL
    bg = Image.new("RGBA", (W, H), PAL.rgb["bg_0"] + (255,))
    d = ImageDraw.Draw(bg)
    for c in range(COLS + 1):
        d.line([(c * CELL, 0), (c * CELL, H)], fill=PAL.rgb["bg_1"] + (255,))
    for r in range(rows + 1):
        d.line([(0, r * CELL), (W, r * CELL)], fill=PAL.rgb["bg_1"] + (255,))
    for (name, c, r) in place:
        m, im = load(name)
        bg.alpha_composite(frame(m, im, "idle_a"), (c * CELL + 1, r * CELL + 1))
    bg.save(os.path.join(PREVIEW_DIR, "family_lineup.png"))
    return bg


def main():
    font = _font()
    lu = lineup()
    lu3 = upscale(lu, 3)
    first, aff, multi = order()
    rows = []
    for n in first + aff + multi:
        m, im = load(n)
        sc = 4 if m["frame_w"] <= 24 and m["frame_h"] <= 24 else 2
        rows.append((n, m, im, sc))
    pad, title_h, lab_h = 8, 18, 14
    widths = [pad + len(m["order"]) * (m["frame_w"] * sc + pad) for _, m, _, sc in rows]
    # overlay strip: idle_a of every affix overlay at x4
    ov = [(n, *load(n + "_overlay")) for n in aff]
    ov_w = pad + len(ov) * (24 * 4 + pad)
    W = max(max(widths), lu3.width + 2 * pad, ov_w)
    H = title_h + lu3.height + 2 * pad + title_h + 24 * 4 + lab_h + pad
    H += sum(title_h + m["frame_h"] * sc + lab_h + pad for _, m, _, sc in rows) + pad
    out = Image.new("RGBA", (W, H), PREVIEW_BG + (255,))
    d = ImageDraw.Draw(out)
    d.fontmode = "1"
    y = pad
    d.text((pad, y), "family lineup: every enemy idle_a, native size on the battlefield grid (shown x3; native file family_lineup.png)",
           fill=(240, 220, 160, 255), font=font)
    y += title_h
    out.alpha_composite(lu3, (pad, y))
    y += lu3.height + pad
    d.text((pad, y), "affix overlay-only layers (idle_a, x4) -- composite over enemy_residue_1x1", fill=(240, 220, 160, 255), font=font)
    y += title_h
    bd = PAL.rgb["bg_0"] + (255,)
    for i, (n, m, im) in enumerate(ov):
        x = pad + i * (24 * 4 + pad)
        d.rectangle([x, y, x + 24 * 4 - 1, y + 24 * 4 - 1], fill=bd)
        out.alpha_composite(upscale(frame(m, im, "idle_a"), 4), (x, y))
        d.text((x, y + 24 * 4 + 1), n.split("_")[2][:14], fill=(232, 230, 240, 255), font=font)
    y += 24 * 4 + lab_h + pad
    for n, m, im, sc in rows:
        d.text((pad, y), f"{n}  ({m['frame_w']}x{m['frame_h']} native, x{sc})", fill=(240, 220, 160, 255), font=font)
        y += title_h
        fw, fh = m["frame_w"], m["frame_h"]
        for i, lab in enumerate(m["order"]):
            x = pad + i * (fw * sc + pad)
            d.rectangle([x, y, x + fw * sc - 1, y + fh * sc - 1], fill=bd)
            out.alpha_composite(upscale(frame(m, im, lab), sc), (x, y))
            d.text((x, y + fh * sc + 1), lab, fill=(232, 230, 240, 255), font=font)
        y += fh * sc + lab_h + pad
    out.save(os.path.join(PREVIEW_DIR, "contact_sheet.png"))
    print("contact sheet", out.size, "lineup", lu.size)


if __name__ == "__main__":
    main()
