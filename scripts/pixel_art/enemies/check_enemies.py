"""Self-check for assets/pixel/enemies (native sheets only).

Checks (FAIL -> exit 1)
  1. palette membership + binary alpha on every native sheet
  2. sheet size == frame_w * n x frame_h; canvas size by grid: 1x1 = 24x24, CxR = (26C-2) x (26R-2)
  3. required frames present (10 standard + listed mechanic states)
  4. 1x1 AABB enemies: idle frames fit 22x22 inside the 24x24 (1px clear ring), fill vs 24x24 in 0.6-0.9
  5. polygon / arc collision: every opaque pixel centre inside the shape or <= 1.0 px outside, on
     the frames listed in polygon_check_frames (feedback frames like burning / link / aura excluded)
  6. overlay sheets: base frame + overlay frame == combined frame, pixel-exact
  7. shatter envelope: hp_75/50/25 keep >= 0.9 of the idle bbox width & height ("shattered, not smaller")
Reported only: orphan pixels, colour count per frame vs the pipeline cap (12 for 1x1, 24 for multi),
rim retention (share of the idle silhouette's outer ring still opaque) and area kept per hp stage.
"""
from __future__ import annotations

import glob
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from PIL import Image  # noqa: E402

from pxlib import PAL, ROOT  # noqa: E402

ASSET_DIR = os.path.join(ROOT, "assets", "pixel", "enemies")
REPORT = os.path.join(ROOT, "docs", "art", "batch_enemies", "check_report.txt")
RGB2ID = {v: k for k, v in PAL.rgb.items()}
STD = ["idle_a", "idle_b", "hit_flash", "hp_75", "hp_50", "hp_25", "frozen", "burning", "death_1", "death_2"]
fails, lines = [], []


def log(s):
    lines.append(s)
    print(s)


def frame_px(im, r):
    pts = {}
    for y in range(r["h"]):
        for x in range(r["w"]):
            px = im.getpixel((r["x"] + x, r["y"] + y))
            if px[3] == 255:
                pts[(x, y)] = px[:3]
    return pts


def bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def inside_poly(px, py, vs):
    c = False
    n = len(vs)
    for i in range(n):
        (x0, y0), (x1, y1) = vs[i], vs[(i + 1) % n]
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


def overflow(px, py, col):
    if col["shape"] == "polygon":
        vs = col["vertices_canvas"]
        if inside_poly(px, py, vs):
            return 0.0
        return min(seg_dist(px, py, *vs[i], *vs[(i + 1) % len(vs)]) for i in range(len(vs)))
    if col["shape"] == "arc":
        cx, cy = col["center_canvas"]
        return max(0.0, math.hypot(px - cx, py - cy) - col["radius"])
    return 0.0


def poly_area(vs):
    return abs(sum(vs[i][0] * vs[(i + 1) % len(vs)][1] - vs[(i + 1) % len(vs)][0] * vs[i][1] for i in range(len(vs)))) / 2


def orphans(pts):
    return sum(1 for p in pts if not any((p[0] + dx, p[1] + dy) in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))


def ring(pts):
    return {p for p in pts if any((p[0] + dx, p[1] + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}


def main():
    metas = {}
    for jp in sorted(glob.glob(os.path.join(ASSET_DIR, "*.json"))):
        m = json.load(open(jp, encoding="utf-8"))
        metas[m["asset"]] = (m, Image.open(jp[:-5] + ".png").convert("RGBA"))
    log(f"sheets: {len(metas)}  ({sum(1 for k in metas if k.endswith('_overlay'))} overlay)")
    for name, (m, im) in metas.items():
        bad_c = bad_a = 0
        for r, g, b, a in im.get_flattened_data():
            if a not in (0, 255):
                bad_a += 1
            elif a == 255 and (r, g, b) not in RGB2ID:
                bad_c += 1
        fw, fh, n = m["frame_w"], m["frame_h"], len(m["order"])
        msgs = []
        ok = bad_c == 0 and bad_a == 0
        if not ok:
            msgs.append(f"off-palette={bad_c} non-binary-alpha={bad_a}")
        if (im.width, im.height) != (fw * n, fh):
            ok = False
            msgs.append(f"sheet {im.size} != {(fw * n, fh)}")
        grid = m.get("grid")
        if grid is None and name.endswith("_overlay"):
            grid = [1, 1]
        exp = (24, 24) if grid == [1, 1] else (grid[0] * 26 - 2, grid[1] * 26 - 2)
        if (fw, fh) != exp:
            ok = False
            msgs.append(f"canvas {fw}x{fh} != {exp}")
        need = STD + m.get("mechanic_states", [])
        missing = [f for f in need if f not in m["frames"]]
        if missing:
            ok = False
            msgs.append(f"missing {missing}")
        cap = 12 if grid == [1, 1] else 24
        ncol = max(len({c for c in frame_px(im, m["frames"][lab]).values()}) for lab in ("idle_a",))
        info = [f"colours(idle_a)={ncol}/{cap}{'(over cap: info)' if ncol > cap else ''}"]
        col = m.get("collision", {})
        # 4. fill / fit for 1x1 AABB
        if grid == [1, 1] and col.get("shape") == "aabb":
            for lab in m.get("fill_ratio_frames", []):
                pts = frame_px(im, m["frames"][lab])
                bb = bbox(pts)
                bw, bh = bb[2] - bb[0] + 1, bb[3] - bb[1] + 1
                fill = len(pts) / 576.0
                good = 0.6 <= fill <= 0.9 and bw <= 22 and bh <= 22 and bb[0] >= 1 and bb[1] >= 1 and bb[2] <= 22 and bb[3] <= 22
                info.append(f"{lab}: fill={fill:.2f} bbox={bw}x{bh}")
                if not good:
                    ok = False
                    msgs.append(f"{lab} fill/fit fail (fill={fill:.2f}, bbox={bb})")
        # 5. polygon / arc containment
        if col.get("shape") in ("polygon", "arc"):
            worst, n_over = 0.0, 0
            for lab in m.get("polygon_check_frames", []):
                for (x, y) in frame_px(im, m["frames"][lab]):
                    d = overflow(x + 0.5, y + 0.5, col)
                    worst = max(worst, d)
                    if d > 1.0:
                        n_over += 1
            idle = frame_px(im, m["frames"]["idle_a"])
            area = poly_area(col["vertices_canvas"]) if col["shape"] == "polygon" else math.pi * col["radius"] ** 2
            info.append(f"shape-overflow max={worst:.2f}px (>1px: {n_over}) silhouette/shape-area={len(idle) / area:.2f}")
            if n_over:
                ok = False
                msgs.append(f"{n_over} px overflow the collision shape by >1px")
        # 6. overlay exactness
        if name.endswith("_overlay"):
            base_m, base_im = metas[m["base_sheet"][:-4]]
            comb_m, comb_im = metas[name[: -len("_overlay")]]
            bad = 0
            for lab in m["order"]:
                bl = lab if lab in base_m["frames"] else "idle_a"
                b = frame_px(base_im, base_m["frames"][bl])
                o = frame_px(im, m["frames"][lab])
                c = frame_px(comb_im, comb_m["frames"][lab])
                comp = dict(b)
                comp.update(o)
                bad += sum(1 for k in set(comp) | set(c) if comp.get(k) != c.get(k))
            info.append(f"base+overlay==combined mismatches={bad}")
            if bad:
                ok = False
                msgs.append(f"overlay composite mismatch {bad}px")
        # 7. shatter envelope
        if all(k in m["frames"] for k in ("idle_a", "hp_25")) and not name.endswith("_overlay"):
            idle = frame_px(im, m["frames"]["idle_a"])
            ib = bbox(idle)
            rg = ring(idle)
            parts = []
            for lab in ("hp_75", "hp_50", "hp_25"):
                pts = frame_px(im, m["frames"][lab])
                hb = bbox(pts)
                rw = (hb[2] - hb[0] + 1) / (ib[2] - ib[0] + 1)
                rh = (hb[3] - hb[1] + 1) / (ib[3] - ib[1] + 1)
                keep = len(rg & set(pts)) / len(rg)
                parts.append(f"{lab}: bbox {min(rw, rh):.2f} rim {keep:.2f} area {len(pts) / len(idle):.2f}")
                if min(rw, rh) < 0.9:
                    ok = False
                    msgs.append(f"{lab} envelope shrank (bbox ratio {min(rw, rh):.2f})")
            info.append("; ".join(parts))
        orph = {lab: orphans(frame_px(im, r)) for lab, r in m["frames"].items()}
        orph = {k: v for k, v in orph.items() if v}
        if orph:
            info.append(f"orphans(info) {orph}")
        log(f"[{'OK' if ok else 'FAIL'}] {name} {fw}x{fh} x{n}  " + " | ".join(info) + ("  !! " + "; ".join(msgs) if msgs else ""))
        if not ok:
            fails.append(name)
    log("RESULT: " + ("PASS" if not fails else "FAIL " + ", ".join(fails)))
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, "w", encoding="utf-8") as fh_:
        fh_.write("\n".join(lines) + "\n")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
