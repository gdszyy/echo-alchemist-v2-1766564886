"""Generate remaining Boss redraw drafts with regional HP translucency masks.

This fills the four Bosses that did not yet have 384x256 redraw drafts:
Viridis, Tesla, Chimera, and Ouroboros. The output is intentionally a draft
asset set, not a final art replacement for the runtime Boss sheets.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


FRAME_W = 384
FRAME_H = 256
FRAMES = 6
OUT_DIR = Path("assets/sprites/bosses/redraw_drafts")

BOSS_THEME = {
    "ignis": {
        "hp": (249, 115, 22),
        "body": (86, 54, 38),
        "edge": (255, 172, 91),
        "glow": (255, 187, 112),
    },
    "glacies": {
        "hp": (6, 182, 212),
        "body": (40, 70, 92),
        "edge": (125, 221, 252),
        "glow": (178, 242, 255),
    },
    "mikro": {
        "hp": (34, 197, 94),
        "body": (42, 84, 65),
        "edge": (110, 231, 150),
        "glow": (134, 239, 172),
    },
    "devourer": {
        "hp": (139, 92, 246),
        "body": (62, 52, 78),
        "edge": (196, 181, 253),
        "glow": (216, 180, 254),
    },
    "viridis": {
        "hp": (97, 173, 34),
        "body": (50, 83, 50),
        "edge": (129, 203, 62),
        "glow": (144, 255, 118),
    },
    "tesla": {
        "hp": (86, 165, 255),
        "body": (36, 56, 88),
        "edge": (123, 207, 255),
        "glow": (164, 224, 255),
    },
    "chimera": {
        "hp": (217, 70, 239),
        "body": (70, 44, 74),
        "edge": (244, 114, 182),
        "glow": (255, 162, 95),
    },
    "ouroboros": {
        "hp": (245, 203, 52),
        "body": (82, 62, 38),
        "edge": (250, 226, 107),
        "glow": (255, 240, 145),
    },
}


def rgba(color: tuple[int, int, int], alpha: int = 255) -> tuple[int, int, int, int]:
    return (*color, alpha)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def scale_points(points: list[tuple[float, float]], scale: int) -> list[tuple[int, int]]:
    return [(int(x * scale), int(y * scale)) for x, y in points]


def ellipse(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], fill, outline=None, width=1, scale=1):
    x1, y1, x2, y2 = box
    draw.ellipse((x1 * scale, y1 * scale, x2 * scale, y2 * scale), fill=fill, outline=outline, width=width * scale)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, outline=None, width=1, scale=1):
    draw.polygon(scale_points(points, scale), fill=fill)
    if outline:
        draw.line(scale_points(points + [points[0]], scale), fill=outline, width=width * scale, joint="curve")


def soft_mask_from_shapes(size: tuple[int, int], draw_fn) -> Image.Image:
    scale = 4
    mask = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw_fn(draw, scale)
    return mask.filter(ImageFilter.GaussianBlur(1.6 * scale)).resize(size, Image.Resampling.LANCZOS)


def apply_hp_window_alpha(base: Image.Image, mask: Image.Image) -> Image.Image:
    out = base.convert("RGBA")
    px = out.load()
    mp = mask.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a <= 0:
                continue
            m = mp[x, y]
            if m <= 48:
                if a < 80:
                    px[x, y] = (r, g, b, 0)
                else:
                    px[x, y] = (r, g, b, max(a, 235))
                continue
            # Strong mask centers become readable translucent HP windows while
            # feathered edges retain enough opacity to feel like real material.
            target = int(184 - min(1, m / 255) * 92)
            px[x, y] = (r, g, b, min(a, max(88, target)))
    return out


def make_mask_asset(mask: Image.Image) -> Image.Image:
    out = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    src = mask.load()
    dst = out.load()
    for y in range(mask.height):
        for x in range(mask.width):
            alpha = src[x, y]
            if alpha <= 0:
                continue
            dst[x, y] = (32, min(255, 128 + alpha // 2), min(255, 160 + alpha // 3), min(232, max(48, alpha)))
    return out


def add_stone_texture(img: Image.Image, seed: int, subject: Image.Image) -> None:
    px = img.load()
    sp = subject.load()
    for y in range(img.height):
        for x in range(img.width):
            if sp[x, y] <= 0:
                continue
            r, g, b, a = px[x, y]
            grain = ((x * 17 + y * 31 + seed * 43) % 29) - 14
            vein = 16 if ((x * 5 - y * 3 + seed * 13) % 97) < 3 else 0
            px[x, y] = (
                max(0, min(255, r + grain + vein)),
                max(0, min(255, g + grain + vein)),
                max(0, min(255, b + grain + vein)),
                a,
            )


def render_viridis() -> tuple[Image.Image, Image.Image]:
    theme = BOSS_THEME["viridis"]
    scale = 4
    img = Image.new("RGBA", (FRAME_W * scale, FRAME_H * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    body = [(96, 224), (120, 128), (193, 72), (266, 128), (289, 224)]
    polygon(draw, body, rgba(theme["body"]), rgba(theme["edge"]), 4, scale)
    polygon(draw, [(114, 210), (132, 136), (193, 90), (250, 136), (270, 210), (193, 232)], rgba((37, 105, 58), 210), rgba((178, 239, 101), 130), 2, scale)
    for idx, (cx, cy, rx, ry) in enumerate([(164, 150, 28, 42), (214, 151, 30, 42), (190, 185, 42, 26)]):
        ellipse(draw, (cx - rx, cy - ry, cx + rx, cy + ry), rgba((84, 156, 74), 220), rgba(theme["glow"], 150), 2, scale)
    for x1, y1, x2, y2 in [(122, 130, 98, 224), (265, 132, 289, 224), (193, 76, 193, 220), (142, 170, 238, 170)]:
        draw.line((x1 * scale, y1 * scale, x2 * scale, y2 * scale), fill=rgba((184, 230, 95), 160), width=2 * scale)
    for cx, cy in [(119, 126), (266, 128), (193, 75), (111, 220), (276, 220)]:
        ellipse(draw, (cx - 7, cy - 7, cx + 7, cy + 7), rgba(theme["glow"], 220), None, scale=scale)
    img = img.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
    subject = img.getchannel("A").point(lambda a: 255 if a > 0 else 0)
    add_stone_texture(img, 7, subject)

    def draw_mask(d, s):
        for cx, cy, rx, ry in [(164, 150, 20, 31), (214, 151, 22, 32), (190, 185, 34, 17), (193, 120, 15, 28)]:
            ellipse(d, (cx - rx, cy - ry, cx + rx, cy + ry), 220, None, scale=s)

    mask = soft_mask_from_shapes((FRAME_W, FRAME_H), draw_mask)
    return apply_hp_window_alpha(img, mask), make_mask_asset(mask)


def render_tesla() -> tuple[Image.Image, Image.Image]:
    theme = BOSS_THEME["tesla"]
    scale = 4
    img = Image.new("RGBA", (FRAME_W * scale, FRAME_H * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    body = [(192, 58), (248, 128), (192, 224), (136, 128)]
    polygon(draw, body, rgba(theme["body"]), rgba(theme["edge"]), 5, scale)
    polygon(draw, [(192, 78), (230, 128), (192, 201), (154, 128)], rgba((48, 101, 143), 232), rgba((182, 228, 255), 150), 2, scale)
    for offset, alpha in [(-20, 115), (20, 115), (0, 180)]:
        draw.line((192 * scale, 68 * scale, (192 + offset) * scale, 128 * scale, 192 * scale, 214 * scale), fill=rgba(theme["glow"], alpha), width=3 * scale)
    for cx, cy in [(192, 59), (248, 128), (192, 224), (136, 128)]:
        ellipse(draw, (cx - 5, cy - 5, cx + 5, cy + 5), rgba((229, 246, 255), 230), None, scale=scale)
    img = img.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
    subject = img.getchannel("A").point(lambda a: 255 if a > 0 else 0)
    add_stone_texture(img, 13, subject)

    def draw_mask(d, s):
        polygon(d, [(192, 86), (222, 128), (192, 193), (162, 128)], 225, None, scale=s)
        d.line(scale_points([(192, 78), (192, 206)], s), fill=245, width=9 * s)

    mask = soft_mask_from_shapes((FRAME_W, FRAME_H), draw_mask)
    return apply_hp_window_alpha(img, mask), make_mask_asset(mask)


def render_chimera() -> tuple[Image.Image, Image.Image]:
    theme = BOSS_THEME["chimera"]
    scale = 4
    img = Image.new("RGBA", (FRAME_W * scale, FRAME_H * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    body = [(88, 88), (276, 88), (300, 168), (192, 224), (64, 168)]
    polygon(draw, body, rgba(theme["body"]), rgba(theme["edge"]), 4, scale)
    polygon(draw, [(104, 102), (174, 96), (190, 218), (84, 162)], rgba((70, 93, 59), 218), rgba((142, 240, 103), 120), 2, scale)
    polygon(draw, [(174, 96), (276, 102), (286, 160), (190, 218)], rgba((96, 45, 83), 224), rgba((240, 103, 223), 130), 2, scale)
    polygon(draw, [(120, 126), (240, 116), (262, 164), (192, 205), (108, 166)], rgba((82, 48, 54), 160), None, 1, scale)
    for cx, cy, col in [(138, 151, (123, 255, 116)), (220, 149, (248, 112, 236)), (188, 181, (255, 162, 91))]:
        ellipse(draw, (cx - 23, cy - 23, cx + 23, cy + 23), rgba(col, 210), rgba((255, 246, 220), 140), 2, scale)
    for x1, y1, x2, y2, col in [
        (90, 91, 138, 151, (123, 255, 116)),
        (276, 91, 220, 149, (248, 112, 236)),
        (190, 224, 188, 181, (255, 162, 91)),
    ]:
        draw.line((x1 * scale, y1 * scale, x2 * scale, y2 * scale), fill=rgba(col, 150), width=2 * scale)
    img = img.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
    subject = img.getchannel("A").point(lambda a: 255 if a > 0 else 0)
    add_stone_texture(img, 19, subject)

    def draw_mask(d, s):
        for cx, cy, r in [(138, 151, 21), (220, 149, 22), (188, 181, 23)]:
            ellipse(d, (cx - r, cy - r, cx + r, cy + r), 230, None, scale=s)
        polygon(d, [(154, 132), (205, 127), (215, 166), (184, 194), (150, 169)], 120, None, scale=s)

    mask = soft_mask_from_shapes((FRAME_W, FRAME_H), draw_mask)
    return apply_hp_window_alpha(img, mask), make_mask_asset(mask)


def render_ouroboros() -> tuple[Image.Image, Image.Image]:
    theme = BOSS_THEME["ouroboros"]
    scale = 4
    img = Image.new("RGBA", (FRAME_W * scale, FRAME_H * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = 192, 128
    outer = (cx - 108, cy - 108, cx + 108, cy + 108)
    inner = (cx - 72, cy - 72, cx + 72, cy + 72)
    ellipse(draw, outer, rgba((90, 56, 150), 255), rgba((219, 182, 255), 210), 5, scale)
    ellipse(draw, (cx - 94, cy - 94, cx + 94, cy + 94), rgba((159, 79, 232), 248), rgba((248, 220, 255), 100), 2, scale)
    ellipse(draw, inner, (0, 0, 0, 0), None, scale=scale)
    # Punch the inner hole back to transparent.
    alpha = img.getchannel("A")
    hole = Image.new("L", img.size, 0)
    hdraw = ImageDraw.Draw(hole)
    ellipse(hdraw, inner, 255, None, scale=scale)
    alpha = Image.composite(Image.new("L", img.size, 0), alpha, hole)
    img.putalpha(alpha)
    draw = ImageDraw.Draw(img)
    for i in range(6):
        angle = -math.pi / 2 + i * math.tau / 6
        sx = cx + math.cos(angle) * 126
        sy = cy + math.sin(angle) * 126
        ellipse(draw, (sx - 11, sy - 11, sx + 11, sy + 11), rgba(theme["hp"], 245), rgba((255, 249, 180), 210), 2, scale)
        draw.line((cx * scale, cy * scale, sx * scale, sy * scale), fill=rgba(theme["glow"], 48), width=1 * scale)
    for i in range(18):
        a1 = i * 20
        bbox = tuple(v * scale for v in (cx - 96, cy - 96, cx + 96, cy + 96))
        draw.arc(bbox, start=a1, end=a1 + 7, fill=rgba((255, 231, 127), 180), width=4 * scale)
    img = img.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
    subject = img.getchannel("A").point(lambda a: 255 if a > 0 else 0)
    add_stone_texture(img, 29, subject)

    def draw_mask(d, s):
        for i in range(6):
            angle = -math.pi / 2 + i * math.tau / 6
            mx = cx + math.cos(angle) * 90
            my = cy + math.sin(angle) * 90
            ellipse(d, (mx - 17, my - 17, mx + 17, my + 17), 220, None, scale=s)
        # Keep the ring readable with thin translucent channels.
        for i in range(12):
            angle = i * math.tau / 12
            x1 = cx + math.cos(angle) * 78
            y1 = cy + math.sin(angle) * 78
            x2 = cx + math.cos(angle) * 103
            y2 = cy + math.sin(angle) * 103
            d.line((x1 * s, y1 * s, x2 * s, y2 * s), fill=155, width=7 * s)

    mask = soft_mask_from_shapes((FRAME_W, FRAME_H), draw_mask)
    return apply_hp_window_alpha(img, mask), make_mask_asset(mask)


RENDERERS = {
    "viridis": render_viridis,
    "tesla": render_tesla,
    "chimera": render_chimera,
    "ouroboros": render_ouroboros,
}


def hp_background(theme: dict[str, tuple[int, int, int]]) -> Image.Image:
    bg = Image.new("RGBA", (FRAME_W, FRAME_H), (6, 10, 18, 255))
    draw = ImageDraw.Draw(bg)
    hp = theme["hp"]
    for y in range(FRAME_H):
        t = y / max(1, FRAME_H - 1)
        r = lerp(max(0, hp[0] - 52), min(255, hp[0] + 30), 1 - t)
        g = lerp(max(0, hp[1] - 56), min(255, hp[1] + 24), 1 - t)
        b = lerp(max(0, hp[2] - 58), min(255, hp[2] + 18), 1 - t)
        draw.line((0, y, FRAME_W, y), fill=(r, g, b, 255))
    for y in range(38, FRAME_H, 42):
        draw.line((0, y, FRAME_W, y), fill=(255, 255, 255, 58), width=1)
    for x in range(0, FRAME_W, 48):
        draw.line((x, 0, x, FRAME_H), fill=(255, 255, 255, 20), width=1)
    return bg


def make_preview(base: Image.Image, boss: str) -> Image.Image:
    preview = hp_background(BOSS_THEME[boss])
    preview.alpha_composite(base)
    return preview


def make_idle_sheet(base: Image.Image, mask_asset: Image.Image, boss: str) -> Image.Image:
    sheet = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    glow = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    gp = glow.load()
    mp = mask_asset.load()
    glow_color = BOSS_THEME[boss]["glow"]
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            a = mp[x, y][3]
            if a > 0:
                gp[x, y] = (*glow_color, min(135, a // 2))
    glow = glow.filter(ImageFilter.GaussianBlur(5))
    for frame in range(FRAMES):
        pulse = 0.42 + 0.22 * math.sin(frame * math.tau / FRAMES)
        layer = base.copy()
        frame_glow = glow.copy()
        alpha = frame_glow.getchannel("A").point(lambda a: int(a * pulse))
        frame_glow.putalpha(alpha)
        layer.alpha_composite(frame_glow)
        sheet.alpha_composite(layer, (FRAME_W * frame, 0))
    return sheet


def metrics(base: Image.Image, mask: Image.Image) -> dict[str, float | int]:
    bp = base.load()
    mp = mask.load()
    subject = window = outside = 0
    win_sum = out_sum = 0
    win_transparent = outside_low = 0
    for y in range(base.height):
        for x in range(base.width):
            a = bp[x, y][3]
            if a <= 0:
                continue
            subject += 1
            if mp[x, y][3] > 48:
                window += 1
                win_sum += a
                if a <= 170:
                    win_transparent += 1
            else:
                outside += 1
                out_sum += a
                if a < 220:
                    outside_low += 1
    return {
        "subject": subject,
        "windowCoverage": round(window / max(1, subject), 4),
        "windowMeanAlpha": round(win_sum / max(1, window), 1),
        "windowTransparentRatio": round(win_transparent / max(1, window), 4),
        "bodyMeanAlpha": round(out_sum / max(1, outside), 1),
        "outsideLowAlphaRatio": round(outside_low / max(1, outside), 4),
    }


def make_contact(items: list[tuple[str, Image.Image, str]], out_path: Path, cols: int = 2) -> None:
    label_h = 28
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGBA", (cols * FRAME_W, rows * (FRAME_H + label_h)), (11, 14, 20, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image, label) in enumerate(items):
        x = (index % cols) * FRAME_W
        y = (index // cols) * (FRAME_H + label_h)
        draw.rectangle((x, y, x + FRAME_W, y + label_h), fill=(7, 10, 16, 255))
        draw.text((x + 8, y + 8), f"{name} {label}", fill=(235, 240, 248, 255))
        sheet.alpha_composite(image.convert("RGBA"), (x, y + label_h))
    sheet.save(out_path)


def regenerate_contact_sheets() -> None:
    hp_items = []
    readability_items = []
    mask_items = []
    for boss in ("ignis", "glacies", "mikro", "devourer", "viridis", "tesla", "chimera", "ouroboros"):
        base_path = OUT_DIR / f"boss_{boss}_base_draft_384x256.png"
        mask_path = OUT_DIR / f"boss_{boss}_hp_translucency_mask.png"
        if not base_path.exists() or not mask_path.exists():
            continue
        base = Image.open(base_path).convert("RGBA")
        mask = Image.open(mask_path).convert("RGBA")
        result = metrics(base, mask)
        preview = make_preview(base, boss)
        label = f"window {result['windowCoverage'] * 100:.1f}% winA{result['windowMeanAlpha']} bodyA{result['bodyMeanAlpha']}"
        hp_items.append((boss, preview, label))
        readability_items.append((boss, preview, label))
        mask_bg = Image.new("RGBA", (FRAME_W, FRAME_H), (17, 22, 31, 255))
        mask_bg.alpha_composite(mask)
        mask_items.append((boss, mask_bg, "translucency mask"))
    make_contact(hp_items, OUT_DIR / "boss_base_draft_hp_window_contact_sheet.png")
    make_contact(readability_items, OUT_DIR / "boss_base_draft_hp_readability_contact_sheet.png")
    make_contact(mask_items, OUT_DIR / "boss_hp_translucency_mask_contact_sheet.png")


def write_json(path: Path, boss: str) -> None:
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
        "hpTranslucencyMask": f"boss_{boss}_hp_translucency_mask.png",
        "notes": "Draft idle sheet generated with regional HP translucency mask; non-mask body remains solid, only material windows reveal HP.",
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_metrics = {}
    for boss, renderer in RENDERERS.items():
        base, mask = renderer()
        base.save(OUT_DIR / f"boss_{boss}_base_draft_384x256.png")
        mask.save(OUT_DIR / f"boss_{boss}_hp_translucency_mask.png")
        preview = make_preview(base, boss)
        preview.save(OUT_DIR / f"boss_{boss}_base_draft_hp_window_preview.png")
        preview.save(OUT_DIR / f"boss_{boss}_base_draft_hp_readability_preview.png")
        make_idle_sheet(base, mask, boss).save(OUT_DIR / f"boss_{boss}_redraw_idle_draft_sheet.png")
        write_json(OUT_DIR / f"boss_{boss}_redraw_idle_draft_sheet.json", boss)
        all_metrics[boss] = metrics(base, mask)
    regenerate_contact_sheets()
    print(json.dumps(all_metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
