"""Generate versioned Tesla and Chimera Boss redraw assets from AI sources.

The previous Tesla/Chimera redraw drafts were geometric placeholders. This
script consumes the 2026-06-24 chroma-key source art, cuts it into 384x256
Boss frames, extracts HP translucency masks from transparent holes and emissive
cracks/windows, and writes versioned runtime sheets so old same-name placeholder
files cannot be reused by caches.
"""

from __future__ import annotations

import colorsys
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


FRAME_W = 384
FRAME_H = 256
FRAMES = 6
VERSION = "v20260624redraw"
REDRAW_DIR = Path("assets/sprites/bosses/redraw_drafts")
SOURCE_DIR = REDRAW_DIR / "source_ai"


BOSS_SPEC = {
    "tesla": {
        "source": SOURCE_DIR / "boss_tesla_redraw_source_2026-06-24.png",
        "key": (0, 255, 0),
        "fit": (198, 238),
        "center": (192, 128),
        "x_scale": 1.24,
        "theme": {
            "hp": (70, 160, 255),
            "glow": (92, 202, 255),
        },
    },
    "chimera": {
        "source": SOURCE_DIR / "boss_chimera_redraw_source_2026-06-24.png",
        "key": (0, 255, 255),
        "fit": (318, 238),
        "center": (192, 132),
        "x_scale": 1.42,
        "theme": {
            "hp": (225, 76, 178),
            "glow": (236, 94, 255),
        },
    },
}


def rgba(rgb: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*rgb, max(0, min(255, alpha)))


def key_distance(rgb: tuple[int, int, int], key: tuple[int, int, int]) -> float:
    return math.sqrt(sum((rgb[i] - key[i]) ** 2 for i in range(3)))


def is_key_like(rgb: tuple[int, int, int], key: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if key == (0, 255, 0):
        return 0.22 <= hue <= 0.42 and sat > 0.45 and val > 0.38 and g > max(r, b) + 34
    if key == (0, 255, 255):
        exact_cyan = key_distance(rgb, key) <= 56
        broad_cyan = 0.44 <= hue <= 0.56 and sat > 0.42 and val > 0.58 and r < 74 and g > 176 and b > 176
        return exact_cyan or broad_cyan
    return key_distance(rgb, key) <= 56


def key_to_alpha(src: Image.Image, key: tuple[int, int, int]) -> Image.Image:
    img = src.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            rgb = (r, g, b)
            dist = key_distance(rgb, key)
            if is_key_like(rgb, key) or dist <= 48:
                px[x, y] = (r, g, b, 0)
                continue
            if dist < 142:
                alpha = int(255 * ((dist - 48) / 94) ** 1.45)
                mix = 1 - alpha / 255
                if key == (0, 255, 0):
                    g = int(g * (1 - 0.78 * mix) + max(r, b) * 0.78 * mix)
                elif key == (0, 255, 255):
                    g = int(g * (1 - 0.58 * mix) + r * 0.28 * mix)
                    b = int(b * (1 - 0.58 * mix) + r * 0.28 * mix)
                px[x, y] = (r, g, b, min(a, max(0, alpha)))
                continue
            if key == (0, 255, 0) and g > max(r, b) + 18:
                px[x, y] = (r, max(r, b), b, a)
            elif key == (0, 255, 255) and g > r + 20 and b > r + 20:
                cool = min(g, b) - r
                px[x, y] = (r, max(r, g - int(cool * 0.30)), max(r, b - int(cool * 0.30)), a)
    return img


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    bbox = img.getchannel("A").point(lambda p: 255 if p > 12 else 0).getbbox()
    if not bbox:
        raise ValueError("source did not produce any foreground pixels")
    return bbox


def remove_pinholes(img: Image.Image) -> Image.Image:
    alpha = img.getchannel("A")
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    out = img.copy()
    out.putalpha(alpha)
    return out


def fit_to_frame(subject: Image.Image, boss: str) -> Image.Image:
    spec = BOSS_SPEC[boss]
    crop = subject.crop(alpha_bbox(subject))
    max_w, max_h = spec["fit"]
    x_scale = spec["x_scale"]
    scale = min(max_w / max(1, crop.width * x_scale), max_h / crop.height)
    new_w = max(1, int(round(crop.width * scale * x_scale)))
    new_h = max(1, int(round(crop.height * scale)))
    fitted = crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    cx, cy = spec["center"]
    x = int(round(cx - new_w / 2))
    y = int(round(cy - new_h / 2))
    out.alpha_composite(fitted, (x, y))
    alpha = out.getchannel("A").point(lambda p: 0 if p < 12 else p)
    out.putalpha(alpha)
    return ImageEnhanceLike.sharp(out)


class ImageEnhanceLike:
    @staticmethod
    def sharp(img: Image.Image) -> Image.Image:
        return img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=125, threshold=3))


def score_pixel(boss: str, r: int, g: int, b: int, a: int) -> int:
    if a <= 0:
        return 0
    hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    score = 0
    if boss == "tesla":
        electric = 0.50 <= hue <= 0.68 and sat > 0.40 and val > 0.38
        bright_core = b > 150 and g > 112 and b > r + 24
        if electric or bright_core:
            score = int(min(255, sat * 100 + val * 82 + max(0, lum - 60) * 1.05))
    else:
        violet = 0.70 <= hue <= 0.88 and sat > 0.36 and val > 0.42
        orange = (hue <= 0.10 or 0.10 <= hue <= 0.16) and sat > 0.46 and val > 0.40
        cyan_glass = 0.48 <= hue <= 0.62 and sat > 0.34 and val > 0.38 and b > r + 18
        if violet or orange or cyan_glass:
            score = int(min(255, sat * 92 + val * 84 + max(0, lum - 55) * 0.94))
    return score


def get_interior_transparent_mask(base: Image.Image) -> Image.Image:
    alpha = base.getchannel("A")
    low_alpha = alpha.point(lambda p: 255 if p <= 18 else 0)
    low = low_alpha.load()
    outside = Image.new("L", (FRAME_W, FRAME_H), 0)
    out = outside.load()
    queue = []

    for x in range(FRAME_W):
        if low[x, 0]:
            queue.append((x, 0))
        if low[x, FRAME_H - 1]:
            queue.append((x, FRAME_H - 1))
    for y in range(FRAME_H):
        if low[0, y]:
            queue.append((0, y))
        if low[FRAME_W - 1, y]:
            queue.append((FRAME_W - 1, y))

    head = 0
    while head < len(queue):
        x, y = queue[head]
        head += 1
        if out[x, y] or not low[x, y]:
            continue
        out[x, y] = 255
        if x > 0:
            queue.append((x - 1, y))
        if x < FRAME_W - 1:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y < FRAME_H - 1:
            queue.append((x, y + 1))

    holes = ImageChops.subtract(low_alpha, outside)
    return holes.filter(ImageFilter.MaxFilter(3))


def make_emissive_score(base: Image.Image, boss: str) -> Image.Image:
    score = Image.new("L", (FRAME_W, FRAME_H), 0)
    spx = score.load()
    bpx = base.load()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            r, g, b, a = bpx[x, y]
            spx[x, y] = score_pixel(boss, r, g, b, a)

    score = score.filter(ImageFilter.GaussianBlur(0.75))
    edges = ImageOps.grayscale(base).filter(ImageFilter.FIND_EDGES)
    edges = ImageOps.autocontrast(edges).filter(ImageFilter.GaussianBlur(0.45))
    edge_emissive = ImageChops.multiply(score, edges.point(lambda p: min(255, int(p * 1.10))))
    return ImageChops.lighter(score.point(lambda p: int(p * 0.58)), edge_emissive)


def limit_mask_coverage(mask: Image.Image, subject: Image.Image, target: float) -> Image.Image:
    values = []
    mp = mask.load()
    sp = subject.load()
    for y in range(mask.height):
        for x in range(mask.width):
            if sp[x, y] > 0 and mp[x, y] > 0:
                values.append(mp[x, y])
    if not values:
        return mask
    values.sort(reverse=True)
    keep = max(1, min(len(values), int(sum(1 for y in range(mask.height) for x in range(mask.width) if sp[x, y] > 0) * target)))
    threshold = values[min(keep - 1, len(values) - 1)]
    return mask.point(lambda p, t=threshold: p if p >= t else 0)


def make_hp_mask(base: Image.Image, boss: str) -> Image.Image:
    subject = base.getchannel("A").point(lambda p: 255 if p > 12 else 0)
    body_core = subject.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    holes = get_interior_transparent_mask(base)
    hole_edges = holes.filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(1.0))
    hole_edges = ImageChops.multiply(hole_edges, subject)

    alpha = base.getchannel("A")
    partial_alpha = ImageChops.invert(alpha).point(lambda p: min(255, max(0, int((p - 16) * 1.25))))
    partial_alpha = ImageChops.multiply(partial_alpha, body_core)

    emissive = make_emissive_score(base, boss)
    mask = ImageChops.lighter(emissive, hole_edges.point(lambda p: min(255, int(p * 0.92))))
    mask = ImageChops.lighter(mask, partial_alpha)
    mask = mask.point(lambda p: p if p >= 54 else 0)

    target = 0.14 if boss == "tesla" else 0.15
    mask = limit_mask_coverage(mask, subject, target)
    mask = mask.filter(ImageFilter.GaussianBlur(0.45))
    return ImageChops.multiply(mask, subject)


def make_mask_asset(mask: Image.Image, boss: str) -> Image.Image:
    out = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    px = out.load()
    mp = mask.load()
    glow = BOSS_SPEC[boss]["theme"]["glow"]
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            a = mp[x, y]
            if a > 0:
                px[x, y] = rgba(glow, min(232, max(40, a)))
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
            if m <= 0.04:
                px[x, y] = (r, g, b, max(a, 242))
                continue
            target = int(164 - 88 * min(1, m))
            px[x, y] = (r, g, b, min(a, max(74, target)))
    return out


def hp_background(boss: str) -> Image.Image:
    hp = BOSS_SPEC[boss]["theme"]["hp"]
    img = Image.new("RGBA", (FRAME_W, FRAME_H), (7, 10, 16, 255))
    d = ImageDraw.Draw(img)
    for y in range(FRAME_H):
        t = y / max(1, FRAME_H - 1)
        r = int(max(0, hp[0] - 70) * t + min(255, hp[0] + 30) * (1 - t))
        g = int(max(0, hp[1] - 74) * t + min(255, hp[1] + 28) * (1 - t))
        b = int(max(0, hp[2] - 68) * t + min(255, hp[2] + 22) * (1 - t))
        d.line((0, y, FRAME_W, y), fill=(r, g, b, 255))
    for y in range(38, FRAME_H, 44):
        d.line((0, y, FRAME_W, y), fill=(255, 255, 255, 48))
    for x in range(0, FRAME_W, 50):
        d.line((x, 0, x, FRAME_H), fill=(255, 255, 255, 15))
    return img


def preview(base: Image.Image, boss: str) -> Image.Image:
    bg = hp_background(boss)
    bg.alpha_composite(base)
    return bg


def idle_sheet(base: Image.Image, mask_asset: Image.Image, boss: str) -> Image.Image:
    sheet = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    glow = Image.new("RGBA", (FRAME_W, FRAME_H), (*BOSS_SPEC[boss]["theme"]["glow"], 0))
    glow.putalpha(mask_asset.getchannel("A").filter(ImageFilter.GaussianBlur(4)))
    for frame in range(FRAMES):
        pulse = 0.38 + 0.22 * math.sin(frame * math.tau / FRAMES)
        layer = base.copy()
        pulse_glow = glow.copy()
        pulse_glow.putalpha(pulse_glow.getchannel("A").point(lambda a, p=pulse: int(a * p)))
        layer.alpha_composite(pulse_glow)
        sheet.alpha_composite(layer, (FRAME_W * frame, 0))
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
        "notes": "Versioned painterly redraw from 2026-06-24 AI source; HP translucency is extracted from transparent holes, emissive cracks, and glass/core windows.",
    }
    (REDRAW_DIR / f"boss_{boss}_redraw_idle_draft_sheet_{VERSION}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def save_assets(boss: str) -> None:
    spec = BOSS_SPEC[boss]
    source = Image.open(spec["source"])
    cutout = key_to_alpha(source, spec["key"])
    fitted = remove_pinholes(fit_to_frame(cutout, boss))
    hp_mask = make_hp_mask(fitted, boss)
    mask_asset = make_mask_asset(hp_mask, boss)
    base = apply_hp_alpha(fitted, hp_mask)

    base.save(REDRAW_DIR / f"boss_{boss}_base_draft_384x256_{VERSION}.png")
    mask_asset.save(REDRAW_DIR / f"boss_{boss}_hp_translucency_mask_{VERSION}.png")
    preview(base, boss).save(REDRAW_DIR / f"boss_{boss}_base_draft_hp_window_preview_{VERSION}.png")
    preview(base, boss).save(REDRAW_DIR / f"boss_{boss}_base_draft_hp_readability_preview_{VERSION}.png")
    idle_sheet(base, mask_asset, boss).save(REDRAW_DIR / f"boss_{boss}_redraw_idle_draft_sheet_{VERSION}.png")
    write_meta(boss)
    print(f"generated {boss} {VERSION}")


def main() -> None:
    for boss in ("tesla", "chimera"):
        save_assets(boss)


if __name__ == "__main__":
    main()
