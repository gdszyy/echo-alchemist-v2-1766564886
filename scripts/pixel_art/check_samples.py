"""Self-check for docs/art/samples (native assets only; *_x4 / *_x6 / contact_sheet are previews).

Checks
  1. every opaque pixel is a palette colour; alpha is binary (0 or 255)
  2. sheet size == frame_w * n_frames x frame_h (sprites fit their canvases)
  3. enemies: idle silhouettes fit 22x22 (bbox incl. outline), fill ratio vs the 24x24
     collision AABB within 0.6-0.9 (also reported vs the silhouette's own bbox)
  4. orphan pixels (no 4-neighbour) per frame -- reported; must be <= the allowance
     listed for intentional highlights / sparks
  5. background layer of the mock: only colours tagged "background", never the outline colour
Exit code 1 on any failure.
"""
from __future__ import annotations

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image  # noqa: E402

from pxlib import PAL, SAMPLES_DIR  # noqa: E402

RGB2ID = {v: k for k, v in PAL.rgb.items()}
PREVIEW_SUFFIXES = ("_x4.png", "_x6.png", "contact_sheet.png")
fails = []
lines = []


def log(s):
    lines.append(s)
    print(s)


def palette_alpha(path):
    im = Image.open(path).convert("RGBA")
    bad_c, bad_a = 0, 0
    for r, g, b, a in im.get_flattened_data():
        if a not in (0, 255):
            bad_a += 1
        elif a == 255 and (r, g, b) not in RGB2ID:
            bad_c += 1
    return im, bad_c, bad_a


def frame_stats(im, x0, fw, fh):
    pts = set()
    for y in range(fh):
        for x in range(fw):
            if im.getpixel((x0 + x, y))[3] == 255:
                pts.add((x, y))
    if not pts:
        return pts, None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return pts, (min(xs), min(ys), max(xs), max(ys))


def orphans(pts):
    return [p for p in pts if not any((p[0] + dx, p[1] + dy) in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]


ORPHAN_ALLOW = {"death_2": 12, "burning": 4, "death_1": 4, "firing": 4, "running_a": 2, "running_b": 2, "loaded": 4}


def main():
    pngs = sorted(glob.glob(os.path.join(SAMPLES_DIR, "*.png")))
    natives = [p for p in pngs if not p.endswith(PREVIEW_SUFFIXES)]
    log(f"native PNGs: {len(natives)}")
    for p in natives:
        im, bc, ba = palette_alpha(p)
        name = os.path.basename(p)
        ok = bc == 0 and ba == 0
        log(f"  [{'OK' if ok else 'FAIL'}] {name}: {im.width}x{im.height} off-palette={bc} non-binary-alpha={ba}")
        if not ok:
            fails.append(name)

    for jp in sorted(glob.glob(os.path.join(SAMPLES_DIR, "*.json"))):
        meta = json.load(open(jp, encoding="utf-8"))
        im = Image.open(jp[:-5] + ".png").convert("RGBA")
        fw, fh, n = meta["frame_w"], meta["frame_h"], len(meta["frames"])
        if (im.width, im.height) != (fw * n, fh):
            fails.append(meta["asset"] + " size")
            log(f"  [FAIL] {meta['asset']} sheet size {im.size} != {(fw * n, fh)}")
        for fr in meta["frames"]:
            pts, bb = frame_stats(im, fr["x"], fw, fh)
            if not pts:
                fails.append(f"{meta['asset']}:{fr['label']} empty")
                continue
            orph = orphans(pts) if meta["kind"] in ("enemy", "device", "icon") else []
            allow = ORPHAN_ALLOW.get(fr["label"], 0)
            msg = f"    {meta['asset']}:{fr['label']:<14} bbox={bb[2]-bb[0]+1}x{bb[3]-bb[1]+1} orphans={len(orph)}/{allow}"
            if len(orph) > allow:
                fails.append(f"{meta['asset']}:{fr['label']} orphans")
                msg += " FAIL"
            if meta["kind"] == "enemy" and fr["label"] in meta.get("fill_ratio_frames", []):
                bw, bh = bb[2] - bb[0] + 1, bb[3] - bb[1] + 1
                fill_aabb = len(pts) / float(fw * fh)
                fill_bb = len(pts) / float(bw * bh)
                good = 0.6 <= fill_aabb <= 0.9 and bw <= 22 and bh <= 22 and bb[0] >= 1 and bb[1] >= 0
                msg += f" fill(24x24 AABB)={fill_aabb:.2f} fill(own bbox)={fill_bb:.2f} {'OK' if good else 'FAIL'}"
                if not good:
                    fails.append(f"{meta['asset']}:{fr['label']} fill/fit")
            log(msg)

    bgp = os.path.join(SAMPLES_DIR, "mock_defend_screen_bg_layer.png")
    if os.path.exists(bgp):
        im = Image.open(bgp).convert("RGBA")
        used = {RGB2ID.get(px[:3]) for px in im.get_flattened_data() if px[3] == 255}
        not_bg = sorted(c for c in used if c is None or "background" not in PAL.roles[c])
        has_outline = PAL.outline_id in used
        ok = not not_bg and not has_outline
        log(f"  [{'OK' if ok else 'FAIL'}] background layer colours={sorted(used)} non-background={not_bg} outline_used={has_outline}")
        if not ok:
            fails.append("bg layer")
    mk = os.path.join(SAMPLES_DIR, "mock_defend_screen.png")
    if os.path.exists(mk):
        im = Image.open(mk)
        ok = im.size == (187, 333)
        log(f"  [{'OK' if ok else 'FAIL'}] mock size {im.size}")
        if not ok:
            fails.append("mock size")

    log("RESULT: " + ("PASS" if not fails else "FAIL " + ", ".join(fails)))
    out = os.path.join(SAMPLES_DIR, "..", "..", "..", "tmp", "codex", "REQ-20261022-wave-loop", "pixel_art_check.txt")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
