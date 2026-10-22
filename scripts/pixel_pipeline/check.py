#!/usr/bin/env python3
"""Machine checks for pixelized assets (art_vfx_ui_direction_v1.md section 5.4).

Checks per PNG (class from its sibling <id>.json manifest, or --class):
  palette      every solid pixel is a palette color (layer-restricted for background)   FAIL
  size         exact class grid size                                                     FAIL
  alpha        alpha in {0,255}                                                          FAIL
  border       no solid pixel on the 1px border                                          FAIL
  fill         creatures: fill ratio in collision box within [0.60, 0.90]                FAIL
  overflow     creatures: solid pixels outside collision box by <= 1px                   FAIL
  colors       color count (incl. outline) <= class cap                                  FAIL
  orphans      single-pixel color islands                                                WARN (flag)
  manifest     manifest + frame_rects present                                            FAIL
               output sha256 / palette hash match (manual cleanup changes sha)           WARN

Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = usage error.

Usage:
  python scripts/pixel_pipeline/check.py <dir|file> [--class icon_24] [--report out.json]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp_common as pc  # noqa: E402


def check_file(png: Path, palette: pc.Palette, cls_override=None, orphan_warn_ratio=0.0):
    results = []

    def add(name, status, detail):
        results.append({"check": name, "status": status, "detail": detail})

    man_path = png.with_suffix(".json")
    manifest = None
    if man_path.exists():
        try:
            manifest = json.loads(man_path.read_text(encoding="utf-8"))
        except Exception as exc:
            add("manifest", "FAIL", f"manifest unreadable: {exc}")
    cls_name = cls_override or (manifest or {}).get("class", {}).get("name")
    if not cls_name:
        add("manifest", "FAIL", "no manifest and no --class: cannot know the class")
        return {"file": str(png), "class": None, "results": results, "status": "FAIL"}
    cls = pc.parse_class(cls_name)

    img = Image.open(png)
    img.load()
    mode = img.mode
    rgba = img.convert("RGBA")
    W, H = rgba.size

    # size
    if (W, H) == (cls.width, cls.height):
        add("size", "PASS", f"{W}x{H}")
    else:
        add("size", "FAIL", f"{W}x{H} != {cls.width}x{cls.height}")

    # alpha
    alphas = set(pc.flat_data(rgba.getchannel("A")))
    bad_alpha = sorted(a for a in alphas if a not in (0, 255))
    if bad_alpha:
        add("alpha", "FAIL", f"semi-transparent alpha values {bad_alpha[:8]}{'...' if len(bad_alpha) > 8 else ''}")
    else:
        add("alpha", "PASS", f"mode {mode}, alpha values {sorted(alphas)}")

    grid, unknown = pc.index_grid(rgba, palette)

    # palette
    layer = (manifest or {}).get("params", {}).get("layer", "interactable")
    allowed = set(palette.indices_for_layer(layer, allow_outline_interior=True))
    if layer == "background":
        allowed.discard(palette.outline_index)
    off_layer = sorted({c for row in grid for c in row if c >= 0 and c not in allowed})
    if unknown:
        sample = ", ".join(f"({x},{y})={pc.rgb_to_hex(c)}" for x, y, c in unknown[:5])
        add("palette", "FAIL", f"{len(unknown)} pixels not in palette: {sample}")
    elif off_layer:
        add("palette", "FAIL", f"layer '{layer}' forbids {[palette.ids[i] for i in off_layer]}")
    else:
        add("palette", "PASS", f"all solid pixels in palette (layer {layer})")

    # border
    border = []
    for x in range(W):
        for y in (0, H - 1):
            if grid[y][x] != -1:
                border.append((x, y))
    for y in range(1, H - 1):
        for x in (0, W - 1):
            if grid[y][x] != -1:
                border.append((x, y))
    if border:
        add("border", "FAIL", f"{len(border)} solid border pixels, e.g. {border[:4]}")
    else:
        add("border", "PASS", "1px border empty")

    # fill / overflow
    params = (manifest or {}).get("params", {})
    collision = tuple(params.get("collision") or cls.default_collision())
    crect = pc.collision_rect((W, H), collision)
    fill, overflow = pc.fill_and_overflow(grid, crect)
    if cls.is_creature:
        if pc.FILL_MIN <= fill <= pc.FILL_MAX:
            add("fill", "PASS", f"fill {fill:.3f} in collision {collision[0]}x{collision[1]}")
        else:
            add("fill", "FAIL", f"fill {fill:.3f} outside [{pc.FILL_MIN}, {pc.FILL_MAX}] in collision {collision[0]}x{collision[1]}")
        if overflow <= pc.MAX_OVERFLOW_PX:
            add("overflow", "PASS", f"overflow {overflow}px")
        else:
            add("overflow", "FAIL", f"overflow {overflow}px > {pc.MAX_OVERFLOW_PX}")
    else:
        add("fill", "INFO", f"fill {fill:.3f} (not enforced for {cls.kind})")

    # colors
    used = {c for row in grid for c in row if c >= 0}
    if len(used) <= cls.color_cap:
        add("colors", "PASS", f"{len(used)} <= cap {cls.color_cap}")
    else:
        add("colors", "FAIL", f"{len(used)} > cap {cls.color_cap}")

    # orphans
    orphans = pc.orphan_pixels(grid, palette.outline_index)
    solid_n = sum(1 for row in grid for c in row if c >= 0 and c != palette.outline_index)
    ratio = len(orphans) / solid_n if solid_n else 0.0
    if orphans and ratio > orphan_warn_ratio:
        add("orphans", "WARN", f"{len(orphans)} orphan pixels ({ratio:.1%} of interior), e.g. {orphans[:6]}")
    else:
        add("orphans", "PASS", f"{len(orphans)} orphan pixels")

    # manifest consistency
    if manifest is not None:
        problems = []
        if manifest.get("output", {}).get("sha256") != pc.sha256_file(png):
            problems.append("output sha256 mismatch (PNG edited after pixelize? re-run or update manifest)")
        if manifest.get("palette", {}).get("hash") != palette.hash:
            problems.append("palette hash differs from current palette.json")
        if not manifest.get("frame_rects"):
            add("manifest", "FAIL", "frame_rects missing -> not deliverable")
        elif problems:
            # manual cleanup legitimately changes the PNG: report as WARN, palette drift too
            add("manifest", "WARN", "; ".join(problems))
        else:
            add("manifest", "PASS", "sha256 + palette hash + frame rects ok")
    else:
        add("manifest", "FAIL", "no manifest (frame rect list and params missing -> not deliverable)")

    status = "FAIL" if any(r["status"] == "FAIL" for r in results) else (
        "WARN" if any(r["status"] == "WARN" for r in results) else "PASS")
    return {"file": pc.rel_to_repo(png), "class": cls.name, "status": status, "results": results,
            "fill_ratio": round(fill, 4), "color_count": len(used), "orphan_pixels": len(orphans)}


def run(paths, palette, cls_override=None, orphan_warn_ratio=0.0):
    files = []
    for p in paths:
        p = Path(p)
        if p.is_dir():
            files.extend(sorted(f for f in p.iterdir() if f.suffix.lower() == ".png"))
        else:
            files.append(p)
    reports = [check_file(f, palette, cls_override, orphan_warn_ratio) for f in files]
    summary = {
        "files": len(reports),
        "pass": sum(1 for r in reports if r["status"] == "PASS"),
        "warn": sum(1 for r in reports if r["status"] == "WARN"),
        "fail": sum(1 for r in reports if r["status"] == "FAIL"),
    }
    fail_reasons = {}
    for r in reports:
        for c in r["results"]:
            if c["status"] == "FAIL":
                fail_reasons[c["check"]] = fail_reasons.get(c["check"], 0) + 1
    summary["fail_by_check"] = fail_reasons
    return {"schema": "echo-alchemist/pixel-check-report@1", "palette_hash": palette.hash,
            "summary": summary, "reports": reports}


def print_report(rep, out=sys.stdout):
    for r in rep["reports"]:
        out.write(f"{r['status']:4}  {r['file']}  [{r['class']}]\n")
        for c in r["results"]:
            if c["status"] in ("FAIL", "WARN"):
                out.write(f"        {c['status']:4} {c['check']}: {c['detail']}\n")
    s = rep["summary"]
    out.write(f"\nfiles {s['files']}  pass {s['pass']}  warn {s['warn']}  fail {s['fail']}  "
              f"fail_by_check {s['fail_by_check']}\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--class", dest="cls")
    ap.add_argument("--palette", default=str(pc.DEFAULT_PALETTE))
    ap.add_argument("--report", help="write JSON report here")
    ap.add_argument("--orphan-warn-ratio", type=float, default=0.0,
                    help="warn only when orphan pixels exceed this share of interior pixels (default 0 = any)")
    args = ap.parse_args(argv)
    palette = pc.Palette(Path(args.palette))
    rep = run(args.paths, palette, args.cls, args.orphan_warn_ratio)
    print_report(rep)
    if args.report:
        pc.write_json(args.report, rep)
    return 1 if rep["summary"]["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
