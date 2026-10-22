"""docs/art/batch_devices_ui/contact_sheet.png: cannon-vs-family comparison (native + x4), both mock
strips (x2), then every batch sheet at x4 with frame labels (labels sit outside the art cells)."""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw

from common import ASSET_DIR, PAL, PREVIEW_BG, PREVIEW_DIR, _font, upscale

ORDER = {
    "devices": ["device_turret", "device_frost_tower", "device_lightning_tower", "device_shield_generator",
                "device_generator", "device_battery", "device_lightning_synthesizer", "device_ammo_workshop",
                "device_expansion_platform", "device_level_badges", "cannon_main", "cannon_ammo_pips"],
    "ui": ["ui_strip_9slice", "ui_slot_frames", "ui_cannon_bay", "ui_conduit", "ui_hopper_intake",
           "ui_topbar_9slice", "ui_icons_10", "ui_icons_16", "ui_font_3x5", "ui_blueprint_card", "ui_cost_chip",
           "ui_power_bar", "ui_button_fight", "ui_modal_9slice", "ui_magazine_slot", "ui_item_icons_16",
           "ui_damage_frames"],
    "board": ["board_pegs", "board_marble_collector", "board_marble_alchemy", "board_special_slots",
              "board_hopper", "board_hopper_divider", "board_bg_tile", "board_defence_line", "board_defence_post"],
}


def main(scale=4):
    font = _font()
    pad, title_h, lab_h = 8, 16, 14
    blocks = []
    for group, names in ORDER.items():
        for name in names:
            meta = json.load(open(os.path.join(ASSET_DIR, group, name + ".json"), encoding="utf-8"))
            sheet = Image.open(os.path.join(ASSET_DIR, group, name + ".png")).convert("RGBA")
            fw, fh = meta["frame_w"], meta["frame_h"]
            cell = max(fw * scale, max(len(f["label"]) for f in meta["frames"]) * 6 + 4)
            w = pad + len(meta["frames"]) * (cell + pad)
            h = title_h + fh * scale + lab_h + pad
            blocks.append((f"{group}/{name}  ({fw}x{fh} native, x{scale})", meta, sheet, cell, w, h))
    col_w = max(b[4] for b in blocks)
    cols, colh = [[], []], [0, 0]
    for b in blocks:
        i = 0 if colh[0] <= colh[1] else 1
        cols[i].append(b)
        colh[i] += b[5]
    cmp_ = Image.open(os.path.join(PREVIEW_DIR, "compare_cannon_vs_devices.png")).convert("RGBA")
    c4 = upscale(cmp_, 4)
    ma = upscale(Image.open(os.path.join(PREVIEW_DIR, "mock_strip_a.png")).convert("RGBA"), 2)
    mb = upscale(Image.open(os.path.join(PREVIEW_DIR, "mock_strip_b.png")).convert("RGBA"), 2)
    top_h = pad + title_h + cmp_.height + pad + c4.height + pad + title_h + ma.height + pad
    W = max(2 * col_w + 3 * pad, c4.width + 2 * pad, ma.width * 2 + 3 * pad)
    H = top_h + max(colh) + pad
    out = Image.new("RGBA", (W, H), PREVIEW_BG + (255,))
    d = ImageDraw.Draw(out)
    d.fontmode = "1"
    hd = (240, 220, 160, 255)
    y = pad
    d.text((pad, y), "MAIN CANNON (hero, 32x32 in 36x36 bay) vs SLOT DEVICE FAMILY (24x24 in 28x28 slots)"
           " - native x1 and x4", fill=hd, font=font)
    y += title_h
    out.alpha_composite(cmp_, (pad, y))
    y += cmp_.height + pad
    out.alpha_composite(c4, (pad, y))
    y += c4.height + pad
    d.text((pad, y), "mock factory strip A / B (187 px native, x2): cannon in place among slot devices",
           fill=hd, font=font)
    y += title_h
    out.alpha_composite(ma, (pad, y))
    out.alpha_composite(mb, (pad * 2 + ma.width, y))
    bd = PAL.rgb["bg_0"] + (255,)
    for ci, col in enumerate(cols):
        x0 = pad + ci * (col_w + pad)
        y = top_h
        for title, meta, sheet, cell, w, h in col:
            d.text((x0, y), title, fill=hd, font=font)
            yy = y + title_h
            fw, fh = meta["frame_w"], meta["frame_h"]
            for i, fr in enumerate(meta["frames"]):
                x = x0 + i * (cell + pad)
                d.rectangle([x, yy, x + fw * scale - 1, yy + fh * scale - 1], fill=bd)
                out.alpha_composite(upscale(sheet.crop((fr["x"], 0, fr["x"] + fw, fh)), scale), (x, yy))
                d.text((x, yy + fh * scale + 2), fr["label"], fill=(232, 230, 240, 255), font=font)
            y += h
    out.save(os.path.join(PREVIEW_DIR, "contact_sheet.png"))
    print("contact sheet", out.size)


if __name__ == "__main__":
    main()
