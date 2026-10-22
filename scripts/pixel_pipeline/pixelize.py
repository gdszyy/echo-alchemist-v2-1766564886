#!/usr/bin/env python3
"""Pixelize concept art / legacy sprites to the Echo Alchemist pixel spec.

Spec: docs/design/art_vfx_ui_direction_v1.md section 2 (grid + palette) and 5.4 (steps).
Deps: Python 3 + Pillow (tested with Pillow 12.x). rembg is optional (--rembg).

Steps (in order, all deterministic):
  1. optional source rect crop (first frame of a sheet, etc.)
  2. background removal: --key-color chroma key (+ despill) | existing alpha |
     --rembg (optional dependency) | auto key from 4 uniform corners
  3. crop to content (alpha >= --content-alpha)
  4. area (BOX, premultiplied) downscale to the class grid minus margin:
       with outline : content box = grid - 4 (1px outline + 1px empty margin per side)
       without      : content box = grid - 2
  5. binary alpha: coverage >= 0.45 -> solid (protected pixels with any coverage -> solid)
  6. nearest-palette quantization, weighted (redmean) RGB distance; outline color is
     excluded from the interior unless --allow-outline-interior; no dithering below 32px
  7. drop isolated solid pixels (no solid 4-neighbour), optional despeckle,
     color-count cap (least-used colors merged into nearest kept color)
  8. auto 4-neighbour 1px outline
  9. write PNG (RGBA, alpha in {0,255}, no metadata) + JSON manifest

Usage:
  python scripts/pixel_pipeline/pixelize.py --in <dir|file> --out <dir> --class enemy_1x1 \
      [--key-color #00ff00] [--collision 22x22] [--protect mask.png|dir] [--src-rect x,y,w,h]
"""
from __future__ import annotations

import argparse
import platform
import sys
from collections import Counter
from pathlib import Path

import PIL
from PIL import Image, ImageEnhance

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp_common as pc  # noqa: E402

PIXELIZE_VERSION = "1.0.0"

BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


# ------------------------------------------------------------------ background

def _key_alpha(img: Image.Image, key_rgb, tol_lo: int, tol_hi: int, despill: bool):
    """Chroma key: alpha from weighted distance to key color, linear ramp lo..hi (in
    sqrt(weighted_dist2/256) units ~ RGB distance). Multiplies existing alpha."""
    data = pc.flat_data(img)
    lo2 = tol_lo * tol_lo * 256 * 3
    hi2 = tol_hi * tol_hi * 256 * 3
    span = max(1, tol_hi - tol_lo)
    hi_ch = [i for i in range(3) if key_rgb[i] >= 128]
    lo_ch = [i for i in range(3) if key_rgb[i] < 128]
    out = []
    keyed = 0
    for (r, g, b, a) in data:
        if a == 0:
            out.append((0, 0, 0, 0))
            continue
        d2 = pc.weighted_dist2((r, g, b), key_rgb)
        if d2 <= lo2:
            out.append((0, 0, 0, 0))
            keyed += 1
            continue
        if d2 >= hi2:
            na = a
        else:
            d = (d2 / (256 * 3)) ** 0.5
            na = int(a * (d - tol_lo) / span + 0.5)
        rgb = [r, g, b]
        # despill only the semi-transparent fringe; fully opaque subject colors are untouched
        if despill and hi_ch and lo_ch and na < a:
            spill = min(rgb[i] for i in hi_ch) - max(rgb[i] for i in lo_ch)
            if spill > 0:
                for i in hi_ch:
                    rgb[i] -= spill
        out.append((rgb[0], rgb[1], rgb[2], max(0, min(255, na))))
    res = Image.new("RGBA", img.size)
    res.putdata(out)
    return res, keyed


def _corner_key(img: Image.Image):
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    for c in corners:
        for d in corners:
            if pc.weighted_dist2(c[:3], d[:3]) > 30 * 30 * 256 * 3:
                return None
    n = len(corners)
    return tuple(int(round(sum(c[i] for c in corners) / n)) for i in range(3))


def remove_background(img: Image.Image, opts, log):
    """Return RGBA with background alpha 0 and a description dict."""
    if opts.key_color:
        key = pc.hex_to_rgb(opts.key_color)
        res, keyed = _key_alpha(img, key, opts.key_tol[0], opts.key_tol[1], not opts.no_despill)
        return res, {"mode": "key_color", "key_color": pc.rgb_to_hex(key), "key_tol": list(opts.key_tol),
                     "despill": not opts.no_despill, "keyed_pixels": keyed}
    if opts.rembg:
        try:
            from rembg import remove  # type: ignore
        except Exception as exc:  # pragma: no cover - optional dependency
            raise SystemExit(f"--rembg requested but rembg is not importable: {exc}")
        res = remove(img).convert("RGBA")
        return res, {"mode": "rembg", "note": "rembg output is model-dependent; determinism not guaranteed"}
    amin, _ = img.getchannel("A").getextrema()
    if amin < 255:
        return img, {"mode": "source_alpha"}
    key = _corner_key(img)
    if key is None:
        raise SystemExit("source has no alpha and corners are not uniform: pass --key-color or --rembg")
    res, keyed = _key_alpha(img, key, opts.key_tol[0], opts.key_tol[1], not opts.no_despill)
    log(f"  auto key from corners {pc.rgb_to_hex(key)}")
    return res, {"mode": "auto_corner_key", "key_color": pc.rgb_to_hex(key), "key_tol": list(opts.key_tol),
                 "despill": not opts.no_despill, "keyed_pixels": keyed}


# ------------------------------------------------------------------ main transform

def _load_protect(protect_path, src_size, src_rect, content_box, fit_size, grid_size, offset):
    """Return set of protected (x, y) in output coordinates, or empty set."""
    if not protect_path:
        return set(), None
    m = Image.open(protect_path).convert("L")
    out = set()
    W, H = grid_size
    if m.size == (W, H):
        mp = m.load()
        for y in range(H):
            for x in range(W):
                if mp[x, y] >= 128:
                    out.add((x, y))
        return out, "output_grid"
    if m.size != src_size:
        raise SystemExit(f"protect mask {protect_path} size {m.size} must equal source {src_size} or output {grid_size}")
    if src_rect:
        x, y, w, h = src_rect
        m = m.crop((x, y, x + w, y + h))
    m = m.crop(content_box).resize(fit_size, Image.Resampling.BOX)
    mp = m.load()
    ox, oy = offset
    for y in range(fit_size[1]):
        for x in range(fit_size[0]):
            if mp[x, y] >= 64:  # >= 25% coverage
                out.add((x + ox, y + oy))
    return out, "source"


def pixelize(src_path: Path, cls: pc.ClassSpec, palette: pc.Palette, opts, log=lambda s: None):
    src_path = Path(src_path)
    raw = Image.open(src_path)
    raw.load()
    src_size = raw.size
    img = raw.convert("RGBA")
    if opts.src_rect:
        x, y, w, h = opts.src_rect
        if x < 0 or y < 0 or x + w > img.width or y + h > img.height:
            raise SystemExit(f"--src-rect {opts.src_rect} outside source {img.size}")
        img = img.crop((x, y, x + w, y + h))

    img, bg = remove_background(img, opts, log)

    if opts.pre_contrast != 1.0 or opts.pre_saturation != 1.0:
        alpha = img.getchannel("A")
        rgb = img.convert("RGB")
        if opts.pre_saturation != 1.0:
            rgb = ImageEnhance.Color(rgb).enhance(opts.pre_saturation)
        if opts.pre_contrast != 1.0:
            rgb = ImageEnhance.Contrast(rgb).enhance(opts.pre_contrast)
        img = rgb.convert("RGBA")
        img.putalpha(alpha)

    a = img.getchannel("A")
    content_box = a.point(lambda v: 255 if v >= opts.content_alpha else 0).getbbox()
    if not content_box:
        raise SystemExit(f"{src_path}: nothing left after background removal")
    content = img.crop(content_box)

    W, H = cls.width, cls.height
    pad = 2 if opts.outline else 1
    inner_w, inner_h = W - 2 * pad, H - 2 * pad
    cw, ch = content.size
    if opts.fit == "stretch":
        tw, th = inner_w, inner_h
    else:
        scale = min(inner_w / cw, inner_h / ch)
        tw = max(1, min(inner_w, int(round(cw * scale))))
        th = max(1, min(inner_h, int(round(ch * scale))))
    small = content.convert("RGBa").resize((tw, th), Image.Resampling.BOX).convert("RGBA")
    ox = pad + (inner_w - tw) // 2
    if opts.anchor == "bottom":
        oy = pad + (inner_h - th)
    else:
        oy = pad + (inner_h - th) // 2

    protected, protect_mode = _load_protect(
        opts.protect, src_size, opts.src_rect, content_box, (tw, th), (W, H), (ox, oy))

    # --- binary alpha + quantization
    candidates = palette.indices_for_layer(opts.layer, opts.allow_outline_interior)
    if not candidates:
        raise SystemExit(f"no palette colors for layer {opts.layer}")
    solid_a = int(-(-pc.ALPHA_SOLID_COVERAGE * 255 // 1))  # ceil(0.45*255) = 115
    dither = opts.dither
    dither_note = None
    if dither != "none" and min(W, H) < pc.NO_DITHER_BELOW:
        dither_note = f"dither '{dither}' refused: grid {W}x{H} below {pc.NO_DITHER_BELOW}px"
        dither = "none"

    grid = [[-1] * W for _ in range(H)]
    sp = small.load()
    cache = {}
    for y in range(th):
        for x in range(tw):
            r, g, b, al = sp[x, y]
            gx, gy = x + ox, y + oy
            is_prot = (gx, gy) in protected
            if al < solid_a and not (is_prot and al > 0):
                continue
            rgb = (r, g, b)
            if dither == "bayer4":
                t = int((BAYER4[gy % 4][gx % 4] - 7.5) * opts.dither_strength)
                rgb = tuple(max(0, min(255, v + t)) for v in rgb)
                grid[gy][gx] = pc.nearest_index(rgb, candidates, palette.rgb, None)
            else:
                grid[gy][gx] = pc.nearest_index(rgb, candidates, palette.rgb, cache)

    def solid(x, y):
        return 0 <= x < W and 0 <= y < H and grid[y][x] >= 0

    # --- drop isolated solid pixels (would become 3x3 outline blobs)
    dropped = 0
    if not opts.keep_isolated:
        kill = []
        for y in range(H):
            for x in range(W):
                if grid[y][x] >= 0 and (x, y) not in protected:
                    if not (solid(x - 1, y) or solid(x + 1, y) or solid(x, y - 1) or solid(x, y + 1)):
                        kill.append((x, y))
        for x, y in kill:
            grid[y][x] = -1
        dropped = len(kill)

    # --- despeckle (optional): recolor single-pixel color islands to majority 4-neighbour color
    despeckled = 0
    if opts.despeckle:
        targets = [p for p in pc.orphan_pixels(grid, palette.outline_index) if p not in protected]
        new_vals = {}
        for x, y in targets:
            cnt = Counter()
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if solid(nx, ny):
                    cnt[grid[ny][nx]] += 1
            if cnt:
                best = sorted(cnt.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
                new_vals[(x, y)] = best
        for (x, y), v in new_vals.items():
            grid[y][x] = v
        despeckled = len(new_vals)

    # --- color cap
    cap = opts.max_colors or cls.color_cap
    interior_budget = cap - (1 if opts.outline else 0)
    merged = []
    while True:
        cnt = Counter(c for row in grid for c in row if c >= 0)
        if len(cnt) <= interior_budget or len(cnt) <= 1:
            break
        victim = sorted(cnt.items(), key=lambda kv: (kv[1], -kv[0]))[0][0]
        keep = sorted(k for k in cnt if k != victim)
        target = pc.nearest_index(palette.rgb[victim], keep, palette.rgb, None)
        for row in grid:
            for x, c in enumerate(row):
                if c == victim:
                    row[x] = target
        merged.append({"from": palette.ids[victim], "to": palette.ids[target], "pixels": cnt[victim]})

    # --- outline
    outline_px = 0
    if opts.outline:
        add = []
        for y in range(H):
            for x in range(W):
                if grid[y][x] == -1 and (solid(x - 1, y) or solid(x + 1, y) or solid(x, y - 1) or solid(x, y + 1)):
                    add.append((x, y))
        for x, y in add:
            grid[y][x] = palette.outline_index
        outline_px = len(add)

    # --- render
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load()
    for y in range(H):
        for x in range(W):
            c = grid[y][x]
            if c >= 0:
                r, g, b = palette.rgb[c]
                op[x, y] = (r, g, b, 255)

    # --- metrics
    collision = opts.collision or cls.default_collision()
    crect = pc.collision_rect((W, H), collision)
    fill, overflow = pc.fill_and_overflow(grid, crect)
    orphans = pc.orphan_pixels(grid, palette.outline_index)
    used = Counter(c for row in grid for c in row if c >= 0)
    bbox = pc.solid_bbox(grid)

    params = {
        "class": cls.name,
        "layer": opts.layer,
        "src_rect": list(opts.src_rect) if opts.src_rect else None,
        "background": bg,
        "content_alpha": opts.content_alpha,
        "pre_contrast": opts.pre_contrast,
        "pre_saturation": opts.pre_saturation,
        "fit": opts.fit,
        "anchor": opts.anchor,
        "resample": "BOX(premultiplied)",
        "fit_size": [tw, th],
        "fit_offset": [ox, oy],
        "alpha_solid_coverage": pc.ALPHA_SOLID_COVERAGE,
        "alpha_solid_threshold_u8": solid_a,
        "distance": "redmean-weighted-rgb",
        "allow_outline_interior": opts.allow_outline_interior,
        "dither": dither,
        "dither_strength": opts.dither_strength if dither != "none" else None,
        "dither_note": dither_note,
        "keep_isolated": opts.keep_isolated,
        "despeckle": opts.despeckle,
        "max_colors": cap,
        "outline": opts.outline,
        "collision": list(collision),
        "protect": pc.rel_to_repo(opts.protect) if opts.protect else None,
        "protect_mode": protect_mode,
    }
    metrics = {
        "solid_pixels": sum(used.values()),
        "outline_pixels": outline_px,
        "dropped_isolated": dropped,
        "despeckled": despeckled,
        "merged_colors": merged,
        "protected_pixels": len(protected),
        "collision_rect": list(crect),
        "fill_ratio": round(fill, 4),
        "overflow_px": overflow,
        "orphan_pixels": len(orphans),
        "orphan_coords": [list(p) for p in orphans],
        "color_count": len(used),
        "colors": {palette.ids[k]: v for k, v in sorted(used.items())},
        "content_bbox": list(bbox) if bbox else None,
    }
    source = {
        "path": pc.rel_to_repo(src_path),
        "sha256": pc.sha256_file(src_path),
        "size": list(src_size),
        "content_bbox": list(content_box),
    }
    return out, params, metrics, source


def build_manifest(asset_id, out_path, cls, palette, params, metrics, source):
    return {
        "schema": "echo-alchemist/pixel-asset-manifest@1",
        "asset_id": asset_id,
        "class": cls.to_dict(),
        "output": {
            "file": out_path.name,
            "sha256": pc.sha256_file(out_path),
            "width": cls.width,
            "height": cls.height,
            "format": "PNG RGBA8, alpha in {0,255}, no metadata",
        },
        "frame_rects": [
            {"frame": 0, "name": "idle_0", "x": 0, "y": 0, "w": cls.width, "h": cls.height,
             "content": metrics["content_bbox"]}
        ],
        "source": source,
        "palette": {"path": pc.rel_to_repo(palette.path), "hash": palette.hash, "size": len(palette.rgb)},
        "params": params,
        "metrics": metrics,
        "tool": {
            "pixelize": PIXELIZE_VERSION,
            "pillow": PIL.__version__,
            "python": platform.python_version(),
            "determinism": "byte-identical on rerun with the same inputs, params and Pillow build",
        },
    }


def run_one(src, out_dir, cls, palette, opts, asset_id=None, log=print):
    src = Path(src)
    asset_id = asset_id or src.stem
    log(f"[pixelize] {src} -> {asset_id} ({cls.name})")
    img, params, metrics, source = pixelize(src, cls, palette, opts, log)
    out_dir = Path(out_dir)
    out_png = out_dir / f"{asset_id}.png"
    pc.save_png_deterministic(img, out_png)
    manifest = build_manifest(asset_id, out_png, cls, palette, params, metrics, source)
    pc.write_json(out_dir / f"{asset_id}.json", manifest)
    log(f"  size {cls.width}x{cls.height} colors {metrics['color_count']} fill {metrics['fill_ratio']} "
        f"overflow {metrics['overflow_px']} orphans {metrics['orphan_pixels']}")
    return manifest


def _rect(text):
    parts = [int(p) for p in text.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("expected x,y,w,h")
    return tuple(parts)


def _tol(text):
    parts = [int(p) for p in text.split(",")]
    if len(parts) != 2 or parts[0] >= parts[1]:
        raise argparse.ArgumentTypeError("expected lo,hi with lo < hi")
    return tuple(parts)


def build_arg_parser():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--in", dest="inp", required=True, help="source PNG file or directory of PNGs")
    p.add_argument("--out", required=True, help="output directory (PNG + JSON manifest per asset)")
    p.add_argument("--class", dest="cls", required=True,
                   help="enemy_CxR | elite_CxR | boss_CxR | icon_24 | icon_16 | px_WxH")
    add_transform_args(p)
    p.add_argument("--id", help="asset id for single-file input (default: file stem)")
    p.add_argument("--palette", default=str(pc.DEFAULT_PALETTE))
    return p


def add_transform_args(p):
    p.add_argument("--key-color", help="chroma key background, e.g. #00ff00")
    p.add_argument("--key-tol", type=_tol, default=(60, 140), help="key distance ramp lo,hi (default 60,140)")
    p.add_argument("--no-despill", action="store_true")
    p.add_argument("--rembg", action="store_true", help="use rembg if installed (non-deterministic across models)")
    p.add_argument("--collision", type=pc.parse_wh, help="collision box WxH in art px (default grid-2)")
    p.add_argument("--protect", help="protect mask PNG (white = keep) in source or output coords; or a dir of <id>.png")
    p.add_argument("--src-rect", type=_rect, help="x,y,w,h source crop (e.g. first frame of a sheet)")
    p.add_argument("--layer", choices=["interactable", "background", "feedback"], default="interactable")
    p.add_argument("--content-alpha", type=int, default=32, help="alpha threshold for content crop (default 32)")
    p.add_argument("--pre-contrast", type=float, default=1.0)
    p.add_argument("--pre-saturation", type=float, default=1.0)
    p.add_argument("--fit", choices=["contain", "stretch"], default="contain")
    p.add_argument("--anchor", choices=["center", "bottom"], default="center")
    p.add_argument("--allow-outline-interior", action="store_true")
    p.add_argument("--dither", choices=["none", "bayer4"], default="none")
    p.add_argument("--dither-strength", type=float, default=2.0)
    p.add_argument("--keep-isolated", action="store_true")
    p.add_argument("--despeckle", action="store_true")
    p.add_argument("--max-colors", type=int, default=0, help="color cap incl. outline (default per class)")
    p.add_argument("--no-outline", dest="outline", action="store_false")
    return p


def main(argv=None):
    args = build_arg_parser().parse_args(argv)
    palette = pc.Palette(Path(args.palette))
    cls = pc.parse_class(args.cls)
    inp = Path(args.inp)
    if inp.is_dir():
        files = sorted(f for f in inp.iterdir()
                       if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and not f.stem.endswith(".protect"))
    else:
        files = [inp]
    if not files:
        raise SystemExit(f"no PNG found in {inp}")
    protect_dir = Path(args.protect) if args.protect and Path(args.protect).is_dir() else None
    for f in files:
        opts = argparse.Namespace(**vars(args))
        if protect_dir:
            m = protect_dir / f"{f.stem}.png"
            opts.protect = str(m) if m.exists() else None
        run_one(f, args.out, cls, palette, opts, asset_id=args.id if len(files) == 1 else None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
