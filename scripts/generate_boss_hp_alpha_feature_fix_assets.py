"""Regenerate Boss runtime sheets with feature-based HP alpha windows.

This pass does not repaint the Boss body. It takes the current approved base
drafts, restores ordinary armor/body pixels to solid alpha, then lowers alpha
only where the sprite itself has emissive cracks, core windows, crystal/glass
panels, furnace vents, or real interior holes.
"""

from __future__ import annotations

import colorsys
import json
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


FRAME_W = 384
FRAME_H = 256
FRAMES = 6
VERSION = "v20260624alphafix"
REDRAW_DIR = Path("assets/sprites/bosses/redraw_drafts")

BOSSES = ["ignis", "glacies", "mikro", "devourer", "viridis", "tesla", "chimera", "ouroboros"]

SOURCE_SUFFIX = {
    "viridis": "v20260623painterly",
    "tesla": "v20260624redraw",
    "chimera": "v20260624redraw",
    "ouroboros": "v20260623painterly",
}

THEMES = {
    "ignis": {"hp": (238, 88, 36), "glow": (255, 111, 45), "target": 0.058},
    "glacies": {"hp": (88, 190, 255), "glow": (120, 220, 255), "target": 0.070},
    "mikro": {"hp": (52, 210, 126), "glow": (64, 240, 150), "target": 0.070},
    "devourer": {"hp": (155, 82, 222), "glow": (194, 98, 255), "target": 0.068},
    "viridis": {"hp": (95, 222, 72), "glow": (150, 255, 70), "target": 0.070},
    "tesla": {"hp": (70, 160, 255), "glow": (92, 202, 255), "target": 0.054},
    "chimera": {"hp": (225, 76, 178), "glow": (236, 94, 255), "target": 0.060},
    "ouroboros": {"hp": (244, 190, 75), "glow": (184, 92, 255), "target": 0.060},
}


def source_path_for(boss: str) -> Path:
    suffix = SOURCE_SUFFIX.get(boss)
    part = f"_{suffix}" if suffix else ""
    return REDRAW_DIR / f"boss_{boss}_base_draft_384x256{part}.png"


def out_path(boss: str, stem: str, ext: str = "png") -> Path:
    return REDRAW_DIR / f"boss_{boss}_{stem}_{VERSION}.{ext}"


def rgba(rgb: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*rgb, max(0, min(255, alpha)))


def subject_mask(img: Image.Image) -> Image.Image:
    return img.getchannel("A").point(lambda p: 255 if p > 12 else 0)


def restore_solid_body(base: Image.Image) -> Image.Image:
    """Undo earlier broad alpha windows while preserving exterior antialiasing."""
    img = base.convert("RGBA")
    subj = subject_mask(img)
    eroded = subj.filter(ImageFilter.MinFilter(5))
    edge = ImageChops.subtract(subj, eroded)
    px = img.load()
    ep = edge.load()
    sp = subj.load()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            r, g, b, a = px[x, y]
            if not sp[x, y]:
                px[x, y] = (r, g, b, 0)
                continue
            if ep[x, y]:
                px[x, y] = (r, g, b, max(a, 232))
            else:
                px[x, y] = (r, g, b, 255)
    return img


def score_pixel(boss: str, r: int, g: int, b: int, a: int) -> int:
    if a <= 12:
        return 0
    hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    score = 0.0

    if boss == "ignis":
        hot = (hue <= 0.12 or hue >= 0.97) and sat > 0.42 and val > 0.34 and r > b + 28 and lum > 78
        score = sat * 96 + max(0, r - 112) * 0.95 + max(0, lum - 82) * 0.55 if hot else 0
    elif boss == "glacies":
        ice = 0.48 <= hue <= 0.66 and sat > 0.26 and val > 0.36 and b > r + 24 and lum > 86
        score = sat * 90 + max(0, b - 112) * 0.76 + max(0, g - 105) * 0.44 if ice else 0
    elif boss in {"mikro", "viridis"}:
        green = 0.22 <= hue <= 0.45 and sat > 0.32 and val > 0.30 and g > max(r, b) + 16 and lum > 70
        score = sat * 98 + max(0, g - 96) * 0.80 + max(0, lum - 76) * 0.38 if green else 0
    elif boss == "devourer":
        abyss = 0.62 <= hue <= 0.98 and sat > 0.24 and val > 0.20 and lum > 45 and (b > g + 4 or r > g + 6)
        score = sat * 92 + max(0, b - 70) * 0.45 + max(0, r - 70) * 0.38 + max(0, lum - 45) * 0.40 if abyss else 0
    elif boss == "tesla":
        electric = 0.50 <= hue <= 0.70 and sat > 0.28 and val > 0.40 and (b > r + 30 or g > r + 34) and lum > 92
        score = sat * 98 + max(0, b - 120) * 0.74 + max(0, g - 112) * 0.52 if electric else 0
    elif boss == "chimera":
        violet = 0.70 <= hue <= 0.92 and sat > 0.34 and val > 0.34 and lum > 78
        ember = (hue <= 0.12 or hue >= 0.97) and sat > 0.44 and val > 0.32 and r > b + 18 and lum > 78
        glass = 0.48 <= hue <= 0.66 and sat > 0.28 and val > 0.34 and b > r + 24 and lum > 78
        score = sat * 96 + max(r, g, b) * 0.28 + max(0, lum - 78) * 0.52 if (violet or ember or glass) else 0
    elif boss == "ouroboros":
        violet = 0.70 <= hue <= 0.90 and sat > 0.34 and val > 0.30 and lum > 66
        gold = 0.09 <= hue <= 0.18 and sat > 0.34 and val > 0.34 and r > b + 26 and lum > 82
        score = sat * 88 + max(r, g, b) * 0.26 + max(0, lum - 76) * 0.40 if (violet or gold) else 0

    return max(0, min(255, int(score)))


def remove_tiny_components(mask: Image.Image, min_pixels: int = 10) -> Image.Image:
    w, h = mask.size
    src = mask.load()
    out = Image.new("L", (w, h), 0)
    dst = out.load()
    seen = bytearray(w * h)

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if seen[idx] or src[x, y] <= 0:
                continue
            seen[idx] = 1
            q: deque[tuple[int, int]] = deque([(x, y)])
            comp: list[tuple[int, int]] = []
            max_a = 0
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                max_a = max(max_a, src[cx, cy])
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if seen[nidx] or src[nx, ny] <= 0:
                        continue
                    seen[nidx] = 1
                    q.append((nx, ny))
            if len(comp) >= min_pixels or max_a >= 226:
                for cx, cy in comp:
                    dst[cx, cy] = src[cx, cy]
    return out


def limit_to_target(score: Image.Image, subject: Image.Image, target: float) -> Image.Image:
    sp = subject.load()
    sc = score.load()
    values: list[int] = []
    subject_count = 0
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            if sp[x, y] <= 0:
                continue
            subject_count += 1
            if sc[x, y] > 0:
                values.append(sc[x, y])
    if not values or subject_count <= 0:
        return Image.new("L", (FRAME_W, FRAME_H), 0)
    values.sort(reverse=True)
    keep = max(1, min(len(values), int(subject_count * target)))
    threshold = max(42, values[min(keep - 1, len(values) - 1)])
    return score.point(lambda p, t=threshold: p if p >= t else 0)


def make_feature_mask(base: Image.Image, boss: str) -> Image.Image:
    subject = subject_mask(base)
    body_core = subject.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    gray = ImageOps.grayscale(base)
    edges = ImageOps.autocontrast(gray.filter(ImageFilter.FIND_EDGES)).filter(ImageFilter.GaussianBlur(0.35))
    score = Image.new("L", (FRAME_W, FRAME_H), 0)
    bp = base.load()
    ep = edges.load()
    sp = body_core.load()
    out = score.load()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            if sp[x, y] <= 0:
                continue
            r, g, b, a = bp[x, y]
            raw = score_pixel(boss, r, g, b, a)
            if raw <= 0:
                continue
            edge_boost = 0.55 + (ep[x, y] / 255) * 0.95
            out[x, y] = max(0, min(255, int(raw * edge_boost)))

    selected = limit_to_target(score.filter(ImageFilter.GaussianBlur(0.45)), body_core, THEMES[boss]["target"])
    selected = remove_tiny_components(selected, min_pixels=8)
    selected = selected.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.55))
    return ImageChops.multiply(selected, body_core)


def make_mask_asset(mask: Image.Image, boss: str) -> Image.Image:
    glow = THEMES[boss]["glow"]
    out = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    px = out.load()
    mp = mask.load()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            a = mp[x, y]
            if a > 0:
                px[x, y] = rgba(glow, min(235, max(42, a)))
    return out


def apply_hp_alpha(base: Image.Image, mask: Image.Image) -> Image.Image:
    out = base.copy()
    px = out.load()
    mp = mask.load()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            r, g, b, a = px[x, y]
            if a <= 0:
                continue
            m = mp[x, y] / 255
            if m <= 0.03:
                px[x, y] = (r, g, b, a)
                continue
            target = int(168 - 105 * (m ** 0.72))
            px[x, y] = (r, g, b, min(a, max(58, target)))
    return out


def hp_background(boss: str) -> Image.Image:
    hp = THEMES[boss]["hp"]
    img = Image.new("RGBA", (FRAME_W, FRAME_H), (7, 10, 16, 255))
    draw = ImageDraw.Draw(img)
    for y in range(FRAME_H):
        t = y / max(1, FRAME_H - 1)
        r = int(max(0, hp[0] - 70) * t + min(255, hp[0] + 30) * (1 - t))
        g = int(max(0, hp[1] - 74) * t + min(255, hp[1] + 28) * (1 - t))
        b = int(max(0, hp[2] - 68) * t + min(255, hp[2] + 22) * (1 - t))
        draw.line((0, y, FRAME_W, y), fill=(r, g, b, 255))
    for y in range(38, FRAME_H, 44):
        draw.line((0, y, FRAME_W, y), fill=(255, 255, 255, 42))
    return img


def preview(base: Image.Image, boss: str) -> Image.Image:
    bg = hp_background(boss)
    bg.alpha_composite(base)
    return bg


def tint_frame(base: Image.Image, mask: Image.Image, boss: str, frame: int) -> Image.Image:
    out = base.copy()
    px = out.load()
    mp = mask.load()
    glow = THEMES[boss]["glow"]
    pulse = 0.18 + 0.12 * math.sin(frame * math.tau / FRAMES)
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            r, g, b, a = px[x, y]
            m = mp[x, y] / 255
            if a <= 0 or m <= 0:
                continue
            t = m * pulse
            px[x, y] = (
                min(255, int(r + glow[0] * t)),
                min(255, int(g + glow[1] * t)),
                min(255, int(b + glow[2] * t)),
                a,
            )
    return out


def idle_sheet(base: Image.Image, mask: Image.Image, boss: str) -> Image.Image:
    sheet = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    for frame in range(FRAMES):
        sheet.alpha_composite(tint_frame(base, mask, boss, frame), (FRAME_W * frame, 0))
    return sheet


def write_meta(boss: str) -> None:
    data = {
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "animations": {
            "idle": {
                "row": 0,
                "frames": FRAMES,
                "fps": 6,
                "frameWidth": FRAME_W,
                "frameHeight": FRAME_H,
            }
        },
        "hpTranslucencyMask": f"boss_{boss}_hp_translucency_mask_{VERSION}.png",
        "notes": "Alpha-fix pass: HP translucency is extracted from sprite-local glow, cracks, glass/core windows, furnace vents, crystals, and real gaps; ordinary body material is restored to solid alpha.",
    }
    out_path(boss, "redraw_idle_draft_sheet", "json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def save_boss(boss: str) -> None:
    src = source_path_for(boss)
    if not src.exists():
        raise FileNotFoundError(src)
    original = Image.open(src).convert("RGBA")
    solid = restore_solid_body(original)
    mask = make_feature_mask(solid, boss)
    base = apply_hp_alpha(solid, mask)
    mask_asset = make_mask_asset(mask, boss)

    base.save(out_path(boss, "base_draft_384x256"))
    mask_asset.save(out_path(boss, "hp_translucency_mask"))
    preview(base, boss).save(out_path(boss, "base_draft_hp_window_preview"))
    preview(base, boss).save(out_path(boss, "base_draft_hp_readability_preview"))
    idle_sheet(base, mask, boss).save(out_path(boss, "redraw_idle_draft_sheet"))
    write_meta(boss)
    print(f"generated {boss} {VERSION} from {src.name}")


def main() -> None:
    for boss in BOSSES:
        save_boss(boss)


if __name__ == "__main__":
    main()
