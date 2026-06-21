from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "assets" / "ui"
BACKGROUNDS = UI / "backgrounds"
PANELS = UI / "panels"
SPRITES = UI / "sprites"
BANNERS = UI / "banners"

for directory in (BACKGROUNDS, PANELS, SPRITES, BANNERS):
    directory.mkdir(parents=True, exist_ok=True)


DEEP = (5, 8, 18, 255)
OBSIDIAN = (10, 15, 28, 255)
METAL = (18, 25, 40, 255)
CYAN = (63, 191, 220, 255)
BLUE = (67, 116, 204, 255)
GOLD = (222, 176, 80, 255)
PURPLE = (138, 82, 205, 255)
CRIMSON = (210, 54, 70, 255)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def blend(c1: tuple[int, int, int, int], c2: tuple[int, int, int, int], t: float) -> tuple[int, int, int, int]:
    return tuple(lerp(c1[i], c2[i], t) for i in range(4))


def save(img: Image.Image, path: Path) -> None:
    img.save(path)
    print(path.relative_to(ROOT).as_posix())


def add_noise(img: Image.Image, amount: int = 18) -> Image.Image:
    w, h = img.size
    px = img.load()
    seed = 0xA17A
    for y in range(h):
        for x in range(w):
            seed = (1103515245 * (seed + x * 13 + y * 17) + 12345) & 0x7FFFFFFF
            n = (seed % (amount * 2 + 1)) - amount
            r, g, b, a = px[x, y]
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)), a)
    return img


def glow_line(draw: ImageDraw.ImageDraw, points, fill, width=2, glow=7) -> None:
    r, g, b, a = fill
    for i in range(glow, 0, -1):
        draw.line(points, fill=(r, g, b, int(a * 0.05 * i)), width=width + i * 2)
    draw.line(points, fill=fill, width=width)


def draw_hex_grid(draw: ImageDraw.ImageDraw, box, color, alpha=30, step=42) -> None:
    x0, y0, x1, y1 = box
    r, g, b = color[:3]
    radius = step / 2
    for row, cy in enumerate(range(y0 - step, y1 + step, int(step * 0.86))):
        offset = 0 if row % 2 == 0 else int(step * 0.75)
        for cx in range(x0 - step + offset, x1 + step, int(step * 1.5)):
            pts = []
            for i in range(6):
                a = math.radians(60 * i + 30)
                pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
            draw.line(pts + [pts[0]], fill=(r, g, b, alpha), width=1)


def panel_base(w: int, h: int, border=(80, 150, 190), fill=(10, 15, 27), corner=14) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(body)
    for y in range(h):
        t = y / max(1, h - 1)
        c = blend((*fill, 238), (4, 7, 15, 246), t)
        draw.line([(0, y), (w, y)], fill=c)
    draw.rounded_rectangle([3, 3, w - 4, h - 4], radius=corner, fill=None, outline=(*border, 140), width=2)
    draw.rounded_rectangle([8, 8, w - 9, h - 9], radius=max(4, corner - 5), outline=(*GOLD[:3], 96), width=1)
    draw_hex_grid(draw, (18, 14, w - 18, h - 14), border, 22, 28)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([4, 4, w - 5, h - 5], radius=corner, outline=(*border, 155), width=3)
    glow = glow.filter(ImageFilter.GaussianBlur(5))
    img.alpha_composite(glow)
    img.alpha_composite(body)
    draw = ImageDraw.Draw(img)
    for sx, sy, fx, fy in ((12, 12, 1, 1), (w - 13, 12, -1, 1), (12, h - 13, 1, -1), (w - 13, h - 13, -1, -1)):
        pts = [(sx, sy), (sx + fx * 28, sy), (sx + fx * 28, sy + fy * 4), (sx + fx * 5, sy + fy * 5), (sx + fx * 5, sy + fy * 28), (sx, sy + fy * 28)]
        draw.line(pts, fill=(*GOLD[:3], 180), width=2)
    return img


def make_battlefield() -> None:
    w, h = 720, 1280
    img = Image.new("RGBA", (w, h), DEEP)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        c = blend((4, 7, 18, 255), (14, 18, 32, 255), min(1, t * 1.2))
        draw.line([(0, y), (w, y)], fill=c)
    draw_hex_grid(draw, (36, 90, w - 36, h - 190), CYAN, 22, 54)
    for i in range(20):
        y = 120 + i * 48
        alpha = max(6, 38 - i)
        glow_line(draw, [(72, y), (w - 72, y + math.sin(i) * 12)], (*BLUE[:3], alpha), 1, 3)
    for cx, cy, rad, color in (
        (106, 205, 190, CYAN),
        (610, 330, 155, PURPLE),
        (365, 1040, 245, GOLD),
    ):
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for r in range(rad, 0, -6):
            a = int(34 * (1 - r / rad) ** 2)
            ld.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color[:3], a))
        img.alpha_composite(layer)
    vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for i in range(170):
        a = int((i / 170) ** 2 * 150)
        vd.rectangle([i, i, w - i, h - i], outline=(0, 0, 0, a))
    img.alpha_composite(vignette)
    img = add_noise(img, 10)
    save(img, BACKGROUNDS / "bg_main_canvas.png")


def make_emitter_zone() -> None:
    w, h = 720, 220
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        draw.line([(0, y), (w, y)], fill=blend((8, 12, 22, 238), (3, 5, 10, 248), t))
    draw_hex_grid(draw, (30, 16, w - 30, h - 18), CYAN, 30, 36)
    draw.rounded_rectangle([24, 70, w - 24, h + 42], radius=34, fill=(9, 14, 24, 218), outline=(*GOLD[:3], 90), width=2)
    for x in range(58, w, 82):
        glow_line(draw, [(x, 132), (x + 42, 190)], (*CYAN[:3], 72), 2, 5)
        draw.ellipse([x - 5, 126, x + 5, 136], fill=(*GOLD[:3], 150))
    save(add_noise(img, 8), BACKGROUNDS / "bg_emitter_zone.png")


def make_panel_assets() -> None:
    top = panel_base(512, 128, border=CYAN[:3], fill=(11, 17, 30), corner=12)
    save(top, PANELS / "top_bar_9s.png")
    bottom = panel_base(512, 160, border=BLUE[:3], fill=(12, 16, 27), corner=16)
    save(bottom, PANELS / "bottom_panel_9s.png")
    save(panel_base(360, 152, border=CYAN[:3], fill=(10, 14, 25), corner=14), SPRITES / "skill_bar_panel_9s.png")
    save(panel_base(96, 96, border=BLUE[:3], fill=(12, 16, 27), corner=12), SPRITES / "skill_button_frame_9s.png")
    save(panel_base(220, 64, border=CYAN[:3], fill=(10, 15, 24), corner=14), SPRITES / "combat_rune_charge_frame_9s.png")


def make_transparent_badge(text: str, path: Path, color) -> None:
    w, h = 96, 48
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for i in range(9, 0, -1):
        draw.rounded_rectangle([8 - i, 8 - i, w - 8 + i, h - 8 + i], radius=13 + i, fill=(*color[:3], int(10 * i)))
    draw.rounded_rectangle([8, 8, w - 8, h - 8], radius=12, fill=(9, 13, 24, 235), outline=(*color[:3], 210), width=2)
    draw.rounded_rectangle([14, 14, w - 14, h - 14], radius=8, outline=(*GOLD[:3], 90), width=1)
    font = ImageFont.truetype("arialbd.ttf", 24) if os.name == "nt" else ImageFont.load_default()
    box = draw.textbbox((0, 0), text, font=font)
    tx = (w - (box[2] - box[0])) / 2
    ty = (h - (box[3] - box[1])) / 2 - 2
    draw.text((tx + 1, ty + 1), text, font=font, fill=(0, 0, 0, 180))
    draw.text((tx, ty), text, font=font, fill=(246, 244, 222, 255))
    save(img, path)


def make_round_banners() -> None:
    for idx in range(6):
        w, h = 600, 200
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        t = idx / 5
        accent = blend(CYAN, GOLD, t)
        panel = panel_base(w, h, border=accent[:3], fill=(8, 12, 22), corner=20)
        img.alpha_composite(panel)
        sweep_x = int(90 + t * 420)
        glow_line(draw, [(sweep_x - 130, 42), (sweep_x + 130, h - 42)], (*accent[:3], 150), 4, 12)
        draw.polygon([(92, 100), (132, 60), (468, 60), (508, 100), (468, 140), (132, 140)], outline=(*GOLD[:3], 150), fill=(2, 6, 16, 82))
        save(img, BANNERS / f"round_banner_{idx + 1}.png")


def make_combat_sprites() -> None:
    make_transparent_badge("x2", SPRITES / "multiplier_x2.png", CYAN)
    make_transparent_badge("x3", SPRITES / "multiplier_x3.png", PURPLE)
    make_transparent_badge("x5", SPRITES / "multiplier_x5.png", GOLD)

    w, h = 64, 64
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.pieslice([3, 3, w - 4, h - 4], 270, 360, fill=(5, 8, 18, 172))
    draw.pieslice([9, 9, w - 10, h - 10], 270, 360, fill=(69, 188, 220, 78))
    draw.ellipse([4, 4, w - 5, h - 5], outline=(*CYAN[:3], 170), width=2)
    glow_line(draw, [(32, 32), (32, 4)], (*CYAN[:3], 160), 2, 5)
    save(overlay, SPRITES / "skill_cooldown_overlay.png")

    fill = Image.new("RGBA", (196, 28), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fill)
    for x in range(196):
        t = x / 195
        fd.line([(x, 3), (x, 24)], fill=blend(CYAN, GOLD, t))
    fill = fill.filter(ImageFilter.GaussianBlur(0.4))
    fd = ImageDraw.Draw(fill)
    fd.rounded_rectangle([0, 0, 195, 27], radius=10, outline=(240, 252, 255, 110), width=1)
    save(fill, SPRITES / "combat_rune_charge_fill.png")


def assert_launcher_assets_unchanged(before: dict[Path, bytes]) -> None:
    changed = []
    for path, digest in before.items():
        if path.exists() and path.read_bytes() != digest:
            changed.append(path.relative_to(ROOT).as_posix())
    if changed:
        raise RuntimeError("Launcher assets changed unexpectedly: " + ", ".join(changed))


def main() -> None:
    protected = {}
    for pattern in ("emitter_*.png", "orbital_*.png"):
        for path in SPRITES.glob(pattern):
            protected[path] = path.read_bytes()

    make_battlefield()
    make_emitter_zone()
    make_panel_assets()
    make_combat_sprites()
    make_round_banners()
    assert_launcher_assets_unchanged(protected)


if __name__ == "__main__":
    main()
