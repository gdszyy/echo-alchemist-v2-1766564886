"""contact_sheet.png: every sample sheet at x6 with frame labels, plus the mock screen at x2.

Labels use PIL's default font *outside* the art cells (the art itself stays palette-only).
"""
from __future__ import annotations

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pxlib import PAL, PREVIEW_BG, SAMPLES_DIR, _font, upscale  # noqa: E402

ORDER = ["enemy_residue_1x1", "enemy_residue_shield_1x1", "device_turret", "device_generator",
         "cannon_main", "ui_slot_frames", "ui_strip_9slice", "ui_topbar_9slice", "ui_icons_10", "ui_font_3x5"]


def main(scale: int = 6):
    font = _font()
    rows = []
    for name in ORDER:
        meta = json.load(open(os.path.join(SAMPLES_DIR, name + ".json"), encoding="utf-8"))
        sheet = Image.open(os.path.join(SAMPLES_DIR, name + ".png")).convert("RGBA")
        rows.append((name, meta, sheet))
    pad, title_h, lab_h = 8, 18, 16
    widths = [pad + len(m["frames"]) * (m["frame_w"] * scale + pad) for _, m, _ in rows]
    mock = Image.open(os.path.join(SAMPLES_DIR, "mock_defend_screen.png")).convert("RGBA")
    mock2 = upscale(mock, 2)
    left_w = max(widths)
    height = sum(title_h + m["frame_h"] * scale + lab_h + pad for _, m, _ in rows) + pad
    W = left_w + pad + mock2.width + pad
    H = max(height, title_h + mock2.height + 2 * pad)
    out = Image.new("RGBA", (W, H), PREVIEW_BG + (255,))
    d = ImageDraw.Draw(out)
    d.fontmode = "1"
    y = pad
    bd = PAL.rgb["bg_0"] + (255,)
    for name, meta, sheet in rows:
        d.text((pad, y), f"{name}  ({meta['frame_w']}x{meta['frame_h']} native, x{scale})", fill=(240, 220, 160, 255), font=font)
        y += title_h
        fw, fh = meta["frame_w"], meta["frame_h"]
        for i, fr in enumerate(meta["frames"]):
            x = pad + i * (fw * scale + pad)
            d.rectangle([x, y, x + fw * scale - 1, y + fh * scale - 1], fill=bd)
            crop = sheet.crop((fr["x"], 0, fr["x"] + fw, fh))
            out.alpha_composite(upscale(crop, scale), (x, y))
            d.text((x, y + fh * scale + 2), fr["label"], fill=(232, 230, 240, 255), font=font)
        y += fh * scale + lab_h + pad
    mx = left_w + pad
    d.text((mx, pad), "mock_defend_screen (187x333 native, x2)", fill=(240, 220, 160, 255), font=font)
    out.alpha_composite(mock2, (mx, pad + title_h))
    out.save(os.path.join(SAMPLES_DIR, "contact_sheet.png"))


if __name__ == "__main__":
    main()
    print("ok")
