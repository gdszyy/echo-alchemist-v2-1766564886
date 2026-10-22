#!/usr/bin/env python3
"""Comparison sheet: original vs pixelized at A1 scale (1 art px = 2 CSS px) x2 preview.

Each pixelized art pixel is drawn as a (2 * preview) x (2 * preview) block with nearest
neighbour only (default 4x4 screen px), i.e. what a DPR-2 phone shows at k = 4. The
original is shown at the same on-screen box size, LANCZOS-reduced, for reference only:
it is NOT pixel-perfect evidence.

Usage:
  python scripts/pixel_pipeline/contact_sheet.py --in <dir> --out sheet.png
      [--variant label=<dir> ...] [--report check_report.json] [--css-per-art 2] [--preview 2]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp_common as pc  # noqa: E402

BG = (42, 40, 51, 255)
PANEL = (58, 56, 72, 255)
TEXT = (230, 228, 240, 255)
STATUS_COL = {"PASS": (138, 222, 74, 255), "WARN": (240, 216, 64, 255), "FAIL": (244, 106, 160, 255)}


def _font(size=12):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow
        return ImageFont.load_default()


def _load_original(manifest):
    src = manifest["source"]["path"]
    p = Path(src)
    if not p.is_absolute():
        p = pc.REPO_ROOT / p
    if not p.exists():
        return None
    im = Image.open(p).convert("RGBA")
    rect = manifest["params"].get("src_rect")
    if rect:
        x, y, w, h = rect
        im = im.crop((x, y, x + w, y + h))
    return im


def _fit(im, box_w, box_h):
    w, h = im.size
    s = min(box_w / w, box_h / h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def build(in_dir, out_path, variants=(), report=None, css_per_art=2, preview=2):
    scale = css_per_art * preview
    font = _font(12)
    small = _font(10)
    status = {}
    if report:
        rep = json.loads(Path(report).read_text(encoding="utf-8"))
        for r in rep.get("reports", []):
            status[Path(r["file"]).stem] = r
    dirs = [("pixelized", Path(in_dir))] + [(lbl, Path(d)) for lbl, d in variants]
    manifests = sorted(Path(in_dir).glob("*.json"))
    rows = []
    for mp in manifests:
        try:
            m = json.loads(mp.read_text(encoding="utf-8"))
        except Exception:
            continue
        if m.get("schema") != "echo-alchemist/pixel-asset-manifest@1":
            continue
        rows.append(m)
    if not rows:
        raise SystemExit(f"no pixel manifests in {in_dir}")

    label_w = 210
    col_w = max(m["output"]["width"] for m in rows) * scale + 16
    header_h = 40
    row_hs = [max(m["output"]["height"] * scale, 64) + 16 for m in rows]
    W = label_w + col_w * (1 + len(dirs))
    H = header_h + sum(row_hs)
    sheet = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(sheet)
    d.text((8, 6), f"original (LANCZOS ref) | pixelized @ {css_per_art} CSS px/art px x{preview} preview "
                   f"= {scale} screen px per art px, nearest", fill=TEXT, font=font)
    x = label_w
    for title in ["original"] + [lbl for lbl, _ in dirs]:
        d.text((x + 4, 22), title, fill=TEXT, font=small)
        x += col_w

    y = header_h
    for m, rh in zip(rows, row_hs):
        aid = m["asset_id"]
        W_art, H_art = m["output"]["width"], m["output"]["height"]
        bw, bh = W_art * scale, H_art * scale
        d.rectangle([0, y, W - 1, y + rh - 2], fill=PANEL)
        met = m["metrics"]
        d.text((6, y + 4), aid, fill=TEXT, font=font)
        d.text((6, y + 20), f"{m['class']['name']}  {W_art}x{H_art}", fill=TEXT, font=small)
        d.text((6, y + 34), f"fill {met['fill_ratio']}  colors {met['color_count']}  orphans {met['orphan_pixels']}",
               fill=TEXT, font=small)
        st = status.get(aid)
        if st:
            d.text((6, y + 48), st["status"], fill=STATUS_COL.get(st["status"], TEXT), font=font)
            fails = [c["check"] for c in st["results"] if c["status"] == "FAIL"]
            if fails:
                d.text((48, y + 50), ",".join(fails), fill=STATUS_COL["FAIL"], font=small)
        x = label_w + 8
        orig = _load_original(m)
        if orig is not None:
            o = _fit(orig, bw, bh)
            sheet.alpha_composite(o, (x + (bw - o.width) // 2, y + 8 + (bh - o.height) // 2))
        for _, ddir in dirs:
            x += col_w
            p = ddir / f"{aid}.png"
            if p.exists():
                im = Image.open(p).convert("RGBA")
                big = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
                sheet.alpha_composite(big, (x, y + 8))
            else:
                d.text((x, y + 8), "(missing)", fill=TEXT, font=small)
        y += rh
    pc.save_png_deterministic(sheet.convert("RGB"), out_path)
    return out_path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--variant", action="append", default=[], help="label=dir, extra pixelized column")
    ap.add_argument("--report", help="check.py JSON report for status labels")
    ap.add_argument("--css-per-art", type=int, default=2)
    ap.add_argument("--preview", type=int, default=2)
    args = ap.parse_args(argv)
    variants = []
    for v in args.variant:
        lbl, _, path = v.partition("=")
        if not path:
            raise SystemExit("--variant expects label=dir")
        variants.append((lbl, path))
    out = build(args.inp, args.out, variants, args.report, args.css_per_art, args.preview)
    print(f"[contact_sheet] wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
