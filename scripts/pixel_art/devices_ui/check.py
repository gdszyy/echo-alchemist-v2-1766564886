"""Checker for the devices/UI/board batch (native assets under assets/pixel/{devices,ui,board}).

  1. every opaque pixel is a palette colour; alpha strictly binary (0/255)
  2. sheet size == frame_w * n_frames x frame_h; expected frame sizes per asset
  3. no empty frames; isolated (orphan) pixels counted for info (feedback sparks are intentional)
  4. layer == "background": only background-tagged colours, never the outline colour
  5. board pegs: no lightning peg
Writes docs/art/batch_devices_ui/check_report.txt; exit 1 on failure.
"""
from __future__ import annotations

import glob
import json
import os
import sys

from PIL import Image

from common import ASSET_DIR, PAL, PREVIEW_DIR

RGB2ID = {v: k for k, v in PAL.rgb.items()}
EXPECT = {
    "cannon_main": (32, 32), "cannon_ammo_pips": (32, 32), "ui_icons_10": (10, 10), "ui_icons_16": (16, 16),
    "ui_item_icons_16": (16, 16), "board_marble_collector": (6, 6), "board_marble_alchemy": (6, 6),
    "ui_slot_frames": (28, 28), "ui_cannon_bay": (36, 36), "ui_font_3x5": (3, 5), "board_bg_tile": (16, 16),
    "ui_blueprint_card": (32, 44), "ui_cost_chip": (22, 12), "ui_magazine_slot": (14, 14),
}


def expected(name):
    if name in EXPECT:
        return EXPECT[name]
    if name.startswith("device_"):
        return (24, 24)
    return None


def main():
    fails, lines = [], []

    def log(s):
        lines.append(s)
        print(s)
    metas = sorted(glob.glob(os.path.join(ASSET_DIR, "*", "*.json")))
    metas = [m for m in metas if os.path.basename(os.path.dirname(m)) in ("devices", "ui", "board")]
    log(f"assets: {len(metas)}")
    for jp in metas:
        meta = json.load(open(jp, encoding="utf-8"))
        name = meta["asset"]
        im = Image.open(jp[:-5] + ".png").convert("RGBA")
        data = list(im.getdata())
        bad_c = sum(1 for r, g, b, a in data if a == 255 and (r, g, b) not in RGB2ID)
        bad_a = sum(1 for px in data if px[3] not in (0, 255))
        fw, fh, n = meta["frame_w"], meta["frame_h"], len(meta["frames"])
        errs = []
        if bad_c:
            errs.append(f"off-palette={bad_c}")
        if bad_a:
            errs.append(f"non-binary-alpha={bad_a}")
        if im.size != (fw * n, fh):
            errs.append(f"sheet {im.size} != {(fw * n, fh)}")
        exp = expected(name)
        if exp and (fw, fh) != exp:
            errs.append(f"frame {fw}x{fh} != {exp[0]}x{exp[1]}")
        orph = 0
        for fr in meta["frames"]:
            pts = {(x, y) for y in range(fh) for x in range(fw) if im.getpixel((fr["x"] + x, y))[3] == 255}
            if not pts and meta["kind"] != "overlay":   # ammo_0 overlay is legitimately empty
                errs.append(f"{fr['label']} empty")
            orph += sum(1 for p in pts if not any((p[0] + dx, p[1] + dy) in pts
                                                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))
        if meta.get("layer") == "background":
            used = {RGB2ID.get(px[:3]) for px in data if px[3] == 255}
            nb = sorted(str(c) for c in used if c is None or "background" not in PAL.roles[c])
            if nb or PAL.outline_id in used:
                errs.append(f"background layer uses {nb} outline={PAL.outline_id in used}")
            else:
                log(f"    background-only colours OK: {sorted(used)}")
        if name == "board_pegs" and any("lightning" in f["label"] for f in meta["frames"]):
            errs.append("lightning peg present")
        log(f"  [{'OK' if not errs else 'FAIL'}] {name}: {n} x {fw}x{fh}  isolated-px={orph} " + "; ".join(errs))
        if errs:
            fails.append(name)
    log("RESULT: " + ("PASS" if not fails else "FAIL " + ", ".join(fails)))
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    open(os.path.join(PREVIEW_DIR, "check_report.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
