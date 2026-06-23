"""Extract candidate Boss HP translucency masks from opaque redraw drafts.

The extractor is intentionally conservative: it looks for material signals that
already imply light or openings (high-saturation glow, local bright cracks, and
clear narrow edges), then writes preview-only assets under redraw_drafts/auto_extract.
It does not overwrite the active Boss draft masks.
"""

from __future__ import annotations

import argparse
import colorsys
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


FRAME_W = 384
FRAME_H = 256
BOSSES = ("ignis", "glacies", "mikro", "devourer")

BOSS_PROFILES = {
    "ignis": {
        "hue_ranges": [(0.00, 0.14), (0.92, 1.00)],
        "target_min": 0.08,
        "target_max": 0.22,
        "target_final": 0.16,
        "threshold": 92,
        "top_hat": 12,
    },
    "glacies": {
        "hue_ranges": [(0.44, 0.66)],
        "target_min": 0.08,
        "target_max": 0.24,
        "target_final": 0.18,
        "threshold": 104,
        "top_hat": 14,
    },
    "mikro": {
        "hue_ranges": [(0.25, 0.48)],
        "target_min": 0.08,
        "target_max": 0.34,
        "target_final": 0.26,
        "threshold": 86,
        "top_hat": 12,
    },
    "devourer": {
        "hue_ranges": [(0.66, 0.86), (0.42, 0.56)],
        "target_min": 0.08,
        "target_max": 0.30,
        "target_final": 0.22,
        "threshold": 82,
        "top_hat": 12,
    },
}


def hue_in_ranges(hue: float, ranges: list[tuple[float, float]]) -> bool:
    return any(lo <= hue <= hi for lo, hi in ranges)


def source_path(root: Path, boss: str) -> Path:
    archive = root / "assets/sprites/bosses/redraw_drafts/archive"
    opaque = archive / f"boss_{boss}_base_draft_384x256_2026-06-23_opaque_source.png"
    if opaque.exists():
        return opaque
    return root / "assets/sprites/bosses/redraw_drafts" / f"boss_{boss}_base_draft_384x256.png"


def subject_bbox(alpha: Image.Image) -> tuple[int, int, int, int]:
    pts = []
    px = alpha.load()
    for y in range(alpha.height):
        for x in range(alpha.width):
            if px[x, y] > 0:
                pts.append((x, y))
    if not pts:
        return (0, 0, alpha.width - 1, alpha.height - 1)
    xs = [x for x, _ in pts]
    ys = [y for _, y in pts]
    return min(xs), min(ys), max(xs), max(ys)


def build_luminance_image(image: Image.Image) -> Image.Image:
    lum = Image.new("L", image.size, 0)
    rgba = image.convert("RGBA").load()
    out = lum.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = rgba[x, y]
            if a <= 0:
                continue
            out[x, y] = int(0.299 * r + 0.587 * g + 0.114 * b)
    return lum


def build_hsv_channel_images(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    sat_img = Image.new("L", image.size, 0)
    val_img = Image.new("L", image.size, 0)
    rgba = image.convert("RGBA").load()
    sp = sat_img.load()
    vp = val_img.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = rgba[x, y]
            if a <= 0:
                continue
            hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            sp[x, y] = int(sat * 255)
            vp[x, y] = int(val * 255)
    return sat_img, val_img


def normalize_score(score: Image.Image, subject: Image.Image) -> Image.Image:
    src = score.load()
    sub = subject.load()
    values = [src[x, y] for y in range(score.height) for x in range(score.width) if sub[x, y] > 0]
    if not values:
        return score
    lo = sorted(values)[int(len(values) * 0.08)]
    hi = sorted(values)[int(len(values) * 0.995)]
    if hi <= lo:
        return score
    out = Image.new("L", score.size, 0)
    dst = out.load()
    for y in range(score.height):
        for x in range(score.width):
            if sub[x, y] <= 0:
                continue
            v = max(0, min(255, int((src[x, y] - lo) * 255 / (hi - lo))))
            dst[x, y] = v
    return out


def luminance_quantiles(lum: Image.Image, subject: Image.Image) -> tuple[int, int]:
    lp = lum.load()
    sp = subject.load()
    values = sorted(lp[x, y] for y in range(lum.height) for x in range(lum.width) if sp[x, y] > 0)
    if not values:
        return 0, 0
    return values[int(len(values) * 0.82)], values[int(len(values) * 0.92)]


def build_score(image: Image.Image, boss: str) -> tuple[Image.Image, Image.Image]:
    profile = BOSS_PROFILES[boss]
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    subject = alpha.point(lambda a: 255 if a > 0 else 0)
    lum = build_luminance_image(rgba)
    sat_img, val_img = build_hsv_channel_images(rgba)
    opened = lum.filter(ImageFilter.MinFilter(17)).filter(ImageFilter.MaxFilter(17))
    top_hat = ImageChops.subtract(lum, opened)
    local_avg = lum.filter(ImageFilter.GaussianBlur(6))
    sat_avg = sat_img.filter(ImageFilter.GaussianBlur(7))
    val_avg = val_img.filter(ImageFilter.GaussianBlur(7))
    edge = lum.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    q82, q92 = luminance_quantiles(lum, subject)

    score = Image.new("L", rgba.size, 0)
    sp = score.load()
    rp = rgba.load()
    th = top_hat.load()
    lp = lum.load()
    ap = local_avg.load()
    satp = sat_img.load()
    satap = sat_avg.load()
    valp = val_img.load()
    valap = val_avg.load()
    ep = edge.load()
    sub = subject.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if sub[x, y] <= 0:
                continue
            r, g, b, a = rp[x, y]
            rf, gf, bf = r / 255, g / 255, b / 255
            hue, sat, val = colorsys.rgb_to_hsv(rf, gf, bf)
            lum_v = int(0.299 * r + 0.587 * g + 0.114 * b)
            local_delta = max(0, lp[x, y] - ap[x, y])
            sat_delta = max(0, satp[x, y] - satap[x, y])
            val_delta = max(0, valp[x, y] - valap[x, y])
            small_bright = th[x, y] > 34 or local_delta > 18 or val_delta > 18
            local_signal = max(0, th[x, y] - 28, local_delta - 14, sat_delta - 10, val_delta - 12)
            color_score = 0
            if (
                hue_in_ranges(hue, profile["hue_ranges"])
                and sat > 0.38
                and val > 0.26
                and local_signal > 0
            ):
                color_score = int(min(255, local_signal * 6 + (sat - 0.38) * 64 + (val - 0.26) * 38))
            white_hot = 0
            if lum_v >= q92 and sat > 0.10 and small_bright and (val_delta > 12 or local_delta > 18 or th[x, y] > 38):
                white_hot = int(min(255, (lum_v - q92) * 2.8 + local_delta * 2.0 + th[x, y] * 1.1))
            crack_score = 0
            if th[x, y] > 42 and (local_delta > 10 or val_delta > 8):
                crack_score = int(min(255, (th[x, y] - 34) * 6 + max(0, local_delta - 12) * 3))
            edge_score = 0
            if th[x, y] > 42 and ep[x, y] > 24 and (sat_delta > 8 or val_delta > 8 or local_delta > 14):
                edge_score = int(min(255, ep[x, y] * 0.7 + th[x, y] * 1.4))
            sp[x, y] = int(min(255, max(color_score, white_hot, crack_score, edge_score)))

    return score, subject


def coverage(mask: Image.Image, subject: Image.Image, threshold: int = 48) -> float:
    mp = mask.load()
    sp = subject.load()
    total = 0
    selected = 0
    for y in range(mask.height):
        for x in range(mask.width):
            if sp[x, y] <= 0:
                continue
            total += 1
            if mp[x, y] > threshold:
                selected += 1
    return selected / max(1, total)


def threshold_to_target(score: Image.Image, subject: Image.Image, boss: str) -> Image.Image:
    profile = BOSS_PROFILES[boss]
    best = score.point(lambda v: 255 if v >= 255 else 0)
    best_distance = float("inf")
    target_mid = (profile["target_min"] + profile["target_max"]) / 2
    for candidate in range(profile["threshold"], 236, 4):
        binary = score.point(lambda v, c=candidate: 255 if v >= c else 0)
        cov = coverage(binary, subject, threshold=1)
        distance = abs(cov - target_mid)
        if distance < best_distance:
            best = binary
            best_distance = distance
        if profile["target_min"] <= cov <= profile["target_max"]:
            return binary
    return best


def connected_cleanup(mask: Image.Image, min_area: int = 12) -> Image.Image:
    src = mask.load()
    out = Image.new("L", mask.size, 0)
    dst = out.load()
    seen = bytearray(mask.width * mask.height)
    for y0 in range(mask.height):
        for x0 in range(mask.width):
            idx = y0 * mask.width + x0
            if seen[idx] or src[x0, y0] <= 0:
                continue
            seen[idx] = 1
            q = deque([(x0, y0)])
            comp = []
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= mask.width or ny >= mask.height:
                        continue
                    nidx = ny * mask.width + nx
                    if seen[nidx] or src[nx, ny] <= 0:
                        continue
                    seen[nidx] = 1
                    q.append((nx, ny))
            xs = [x for x, _ in comp]
            ys = [y for _, y in comp]
            span = max(max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)
            if len(comp) >= min_area or span >= 12:
                for x, y in comp:
                    dst[x, y] = 255
    return out


def soften_mask(binary: Image.Image, score: Image.Image, subject: Image.Image) -> Image.Image:
    expanded = binary.filter(ImageFilter.MaxFilter(5))
    soft = expanded.filter(ImageFilter.GaussianBlur(2.3))
    score_soft = score.filter(ImageFilter.GaussianBlur(1.4))
    out = Image.new("L", binary.size, 0)
    op = out.load()
    softp = soft.load()
    scorep = score_soft.load()
    subp = subject.load()
    for y in range(binary.height):
        for x in range(binary.width):
            if subp[x, y] <= 0:
                continue
            # Binary candidate is the hard gate; score can only strengthen pixels
            # already near a candidate region. This prevents same-hue body plates
            # from becoming a global transparency wash.
            if softp[x, y] <= 0:
                continue
            v = int(min(255, softp[x, y] * 0.82 + min(scorep[x, y], softp[x, y]) * 0.28))
            op[x, y] = 0 if v < 18 else min(255, v)
    return out


def clamp_mask_to_strongest(mask: Image.Image, score: Image.Image, subject: Image.Image, boss: str) -> Image.Image:
    profile = BOSS_PROFILES[boss]
    mp = mask.load()
    scp = score.load()
    subp = subject.load()
    subject_count = 0
    candidates = []
    for y in range(mask.height):
        for x in range(mask.width):
            if subp[x, y] <= 0:
                continue
            subject_count += 1
            if mp[x, y] <= 18:
                continue
            value = int(mp[x, y] * 0.62 + scp[x, y] * 0.38)
            candidates.append((value, x, y, mp[x, y]))
    if not candidates:
        return mask
    limit = max(1, int(subject_count * profile["target_final"]))
    candidates.sort(reverse=True, key=lambda item: item[0])
    out = Image.new("L", mask.size, 0)
    op = out.load()
    for _, x, y, alpha in candidates[:limit]:
        op[x, y] = alpha
    return out


def make_mask_asset(mask: Image.Image) -> Image.Image:
    out = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    mp = mask.load()
    px = out.load()
    for y in range(mask.height):
        for x in range(mask.width):
            v = mp[x, y]
            if v <= 0:
                continue
            px[x, y] = (28, min(255, 110 + int(v * 0.58)), min(255, 145 + int(v * 0.42)), min(232, max(46, v)))
    return out


def apply_mask_alpha(source: Image.Image, mask: Image.Image) -> Image.Image:
    rgba = source.convert("RGBA")
    edge = mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    out = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    src = rgba.load()
    mp = mask.load()
    ep = edge.load()
    dst = out.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = src[x, y]
            if a <= 0:
                continue
            m = mp[x, y] / 255
            if m <= 0.08:
                dst[x, y] = (r, g, b, a)
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            chroma = max(r, g, b) - min(r, g, b)
            target = int(176 - 136 * m)
            if chroma > 68 or lum > 155:
                target += 10
            if ep[x, y] > 22:
                target = max(target, 154)
            target = max(34, min(204, target))
            dst[x, y] = (r, g, b, min(a, target))
    return out


def hp_background() -> Image.Image:
    bg = Image.new("RGBA", (FRAME_W, FRAME_H), (7, 12, 20, 255))
    draw = ImageDraw.Draw(bg)
    for y in range(FRAME_H):
        t = y / max(1, FRAME_H - 1)
        r = int(22 + 23 * (1 - t))
        g = int(116 + 84 * (1 - t))
        b = int(112 + 52 * (1 - t))
        draw.line((0, y, FRAME_W, y), fill=(r, g, b, 255))
    for y in range(38, FRAME_H, 42):
        draw.line((0, y, FRAME_W, y), fill=(255, 255, 255, 66), width=1)
    for x in range(0, FRAME_W, 48):
        draw.line((x, 0, x, FRAME_H), fill=(255, 255, 255, 18), width=1)
    return bg


def make_preview(base: Image.Image) -> Image.Image:
    preview = hp_background()
    preview.alpha_composite(base)
    return preview


def metrics(base: Image.Image, mask: Image.Image) -> dict[str, float | int]:
    subject = window = outside = 0
    win_sum = out_sum = 0
    bp = base.convert("RGBA").load()
    mp = mask.load()
    for y in range(base.height):
        for x in range(base.width):
            a = bp[x, y][3]
            if a <= 0:
                continue
            subject += 1
            if mp[x, y] > 48:
                window += 1
                win_sum += a
            else:
                outside += 1
                out_sum += a
    return {
        "subject": subject,
        "windowPixels": window,
        "windowCoverage": round(window / max(1, subject), 4),
        "windowMeanAlpha": round(win_sum / max(1, window), 1),
        "bodyMeanAlpha": round(out_sum / max(1, outside), 1),
    }


def make_contact(items: list[tuple[str, Image.Image, str]], out_path: Path) -> None:
    cols = 2
    rows = (len(items) + cols - 1) // cols
    label_h = 28
    sheet = Image.new("RGBA", (cols * FRAME_W, rows * (FRAME_H + label_h)), (12, 14, 20, 255))
    draw = ImageDraw.Draw(sheet)
    for idx, (name, image, label) in enumerate(items):
        x = (idx % cols) * FRAME_W
        y = (idx // cols) * (FRAME_H + label_h)
        draw.rectangle((x, y, x + FRAME_W, y + label_h), fill=(9, 12, 18, 255))
        draw.text((x + 10, y + 8), f"{name} {label}", fill=(235, 240, 248, 255))
        sheet.alpha_composite(image.convert("RGBA"), (x, y + label_h))
    sheet.save(out_path)


def extract(root: Path, boss: str, out_dir: Path) -> dict[str, float | int]:
    src = Image.open(source_path(root, boss)).convert("RGBA")
    if src.size != (FRAME_W, FRAME_H):
        raise ValueError(f"{boss} source must be {FRAME_W}x{FRAME_H}, got {src.size}")
    score, subject = build_score(src, boss)
    binary = threshold_to_target(score, subject, boss)
    binary = connected_cleanup(binary)
    mask = soften_mask(binary, score, subject)
    mask = clamp_mask_to_strongest(mask, score, subject, boss)
    mask_asset = make_mask_asset(mask)
    base = apply_mask_alpha(src, mask)
    preview = make_preview(base)

    mask_asset.save(out_dir / f"boss_{boss}_hp_translucency_mask_auto.png")
    base.save(out_dir / f"boss_{boss}_base_draft_auto_alpha.png")
    preview.save(out_dir / f"boss_{boss}_hp_window_auto_preview.png")
    score.save(out_dir / f"boss_{boss}_auto_extract_score.png")
    return metrics(base, mask)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--boss", action="append", choices=BOSSES, help="Boss id to extract; defaults to all current drafts")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    out_dir = root / "assets/sprites/bosses/redraw_drafts/auto_extract"
    out_dir.mkdir(parents=True, exist_ok=True)

    bosses = tuple(args.boss) if args.boss else BOSSES
    all_metrics = {}
    mask_items = []
    preview_items = []
    for boss in bosses:
        result = extract(root, boss, out_dir)
        all_metrics[boss] = result
        mask = Image.new("RGBA", (FRAME_W, FRAME_H), (20, 24, 32, 255))
        mask.alpha_composite(Image.open(out_dir / f"boss_{boss}_hp_translucency_mask_auto.png").convert("RGBA"))
        preview = Image.open(out_dir / f"boss_{boss}_hp_window_auto_preview.png").convert("RGBA")
        label = f"window {result['windowCoverage'] * 100:.1f}% winA {result['windowMeanAlpha']} bodyA {result['bodyMeanAlpha']}"
        mask_items.append((boss, mask, "auto mask"))
        preview_items.append((boss, preview, label))

    make_contact(mask_items, out_dir / "boss_auto_extracted_mask_contact_sheet.png")
    make_contact(preview_items, out_dir / "boss_auto_extracted_hp_window_contact_sheet.png")
    (out_dir / "boss_auto_extraction_metrics.json").write_text(
        json.dumps(all_metrics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(all_metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
