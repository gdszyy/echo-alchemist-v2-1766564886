from pathlib import Path
from random import Random

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "sprites" / "enemies" / "overlays"
CONTACT_SHEET = ROOT / "docs" / "design" / "enemy_targeting_overlay_contact_sheet.png"
FOOTPRINT_SHEET = ROOT / "docs" / "design" / "enemy_targeting_overlay_footprints_contact_sheet.png"
SIZE = 128
SCALE = 4
CANVAS = SIZE * SCALE
FOOTPRINTS = [(1, 1), (2, 1), (1, 2), (2, 2), (3, 1), (1, 3), (2, 3), (3, 2), (3, 3)]


STONE = {
    "base": "#27313b",
    "base2": "#1f2933",
    "shadow": "#0b1220",
    "edge": "#64748b",
    "edge2": "#94a3b8",
    "warm_edge": "#a58a52",
}


def rgba(hex_color, alpha=255):
    if isinstance(hex_color, tuple):
        return hex_color[:3] + (alpha,)
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def sc(v):
    return int(round(v * SCALE))


def spt(pt):
    return (sc(pt[0]), sc(pt[1]))


def new_layer():
    return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))


_MATERIAL_SOURCES = None


def material_sources():
    global _MATERIAL_SOURCES
    if _MATERIAL_SOURCES is not None:
        return _MATERIAL_SOURCES

    rels = [
        "assets/sprites/enemies/frames/frame_residue_1x1.png",
        "assets/sprites/enemies/frames/frame_deflector_2x1.png",
        "assets/sprites/enemies/frames/frame_siege_3x2.png",
        "assets/sprites/enemies/frames/frame_bastion_3x1.png",
        "assets/sprites/enemies/composites/enemy_residue_1x1_native_hollow_idle.png",
        "assets/sprites/enemies/composites/enemy_siege_siege_3x2_native_hollow_idle.png",
    ]
    sources = []
    for rel in rels:
        path = ROOT / rel
        if not path.exists():
            continue
        img = Image.open(path).convert("RGBA")
        bbox = img.getchannel("A").getbbox()
        if bbox:
            sources.append(img.crop(bbox))
    if not sources:
        raise RuntimeError("No existing enemy material sources found")
    _MATERIAL_SOURCES = sources
    return sources


def colorize_material(texture, accent=None, strength=0.18):
    if not accent:
        return texture
    tint = Image.new("RGBA", texture.size, rgba(accent, int(255 * strength)))
    out = Image.alpha_composite(texture, tint)
    out.putalpha(texture.getchannel("A"))
    return out


def build_material_texture(mask, seed, accent=None):
    rng = Random(seed)
    bbox = mask.getbbox() or (0, 0, CANVAS, CANVAS)
    texture = Image.new("RGBA", (CANVAS, CANVAS), rgba("#111827", 0))

    # Dark noisy underpaint, clipped by the final mask.
    noise = Image.effect_noise((CANVAS, CANVAS), rng.uniform(34, 58)).convert("L")
    base = Image.new("RGBA", (CANVAS, CANVAS), rgba("#1e2933", 235))
    hi = Image.new("RGBA", (CANVAS, CANVAS), rgba("#475569", 95))
    hi.putalpha(noise.point(lambda p: max(0, min(115, int((p - 104) * 1.45)))))
    base.alpha_composite(hi)
    texture.alpha_composite(base)

    sources = material_sources()
    for i in range(18):
        src = rng.choice(sources)
        sw, sh = src.size
        crop_w = rng.randint(max(8, sw // 5), max(10, sw))
        crop_h = rng.randint(max(8, sh // 5), max(10, sh))
        crop_w = min(crop_w, sw)
        crop_h = min(crop_h, sh)
        sx = rng.randint(0, max(0, sw - crop_w))
        sy = rng.randint(0, max(0, sh - crop_h))
        patch = src.crop((sx, sy, sx + crop_w, sy + crop_h))
        if rng.random() < 0.5:
            patch = patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if rng.random() < 0.5:
            patch = patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        if rng.random() < 0.35:
            patch = patch.rotate(rng.choice([90, 180, 270]), expand=True)
        scale = rng.uniform(1.4, 3.4)
        patch = patch.resize((max(8, int(patch.width * scale)), max(8, int(patch.height * scale))), Image.Resampling.BICUBIC)
        patch = ImageEnhance.Contrast(patch).enhance(rng.uniform(1.05, 1.45))
        patch = ImageEnhance.Brightness(patch).enhance(rng.uniform(0.72, 1.08))
        patch = colorize_material(patch, accent, rng.uniform(0.04, 0.12))
        alpha = patch.getchannel("A").point(lambda p: int(p * rng.uniform(0.34, 0.72)))
        patch.putalpha(alpha)
        x = rng.randint(bbox[0] - patch.width // 2, max(bbox[0], bbox[2] - patch.width // 3))
        y = rng.randint(bbox[1] - patch.height // 2, max(bbox[1], bbox[3] - patch.height // 3))
        texture.alpha_composite(patch, (x, y))

    # Clip texture to the exact plate mask.
    alpha = ImageChops.multiply(texture.getchannel("A"), mask)
    alpha = ImageChops.lighter(alpha, mask.point(lambda p: int(p * 0.66)))
    texture.putalpha(alpha)
    return texture


def add_bevel(img, mask, edge_color=STONE["edge"], accent=None):
    outer = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(sc(2) | 1)), mask.filter(ImageFilter.MinFilter(sc(2) | 1)))
    inner = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(sc(4) | 1)))

    shadow = Image.new("RGBA", img.size, rgba("#020617", 120))
    shadow.putalpha(ImageChops.offset(outer, sc(1.4), sc(1.8)).filter(ImageFilter.GaussianBlur(sc(0.5))))
    img.alpha_composite(shadow)

    highlight = Image.new("RGBA", img.size, rgba(edge_color, 135))
    highlight.putalpha(outer.point(lambda p: int(p * 0.58)))
    img.alpha_composite(highlight)

    inner_dark = Image.new("RGBA", img.size, rgba("#0f172a", 85))
    inner_dark.putalpha(inner.point(lambda p: int(p * 0.45)))
    img.alpha_composite(inner_dark)

    if accent:
        acc = Image.new("RGBA", img.size, rgba(accent, 42))
        acc.putalpha(inner.filter(ImageFilter.GaussianBlur(sc(0.7))).point(lambda p: int(p * 0.35)))
        img.alpha_composite(acc)


def add_glow(img, mask, color, blur=3, alpha=110):
    glow = Image.new("RGBA", img.size, rgba(color, alpha))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(sc(blur))))
    img.alpha_composite(glow)


def polygon_mask(points):
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(mask).polygon([spt(p) for p in points], fill=255)
    return mask


def draw_material_plate(img, points, seed, accent=None, fill=STONE["base"], edge=STONE["edge"]):
    rng = Random(seed)
    mask = polygon_mask(points)
    plate = build_material_texture(mask, seed, accent)
    add_bevel(plate, mask, edge_color=edge, accent=accent)
    img.alpha_composite(plate)

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)

    d = ImageDraw.Draw(img)
    pts = [spt(p) for p in points]
    d.line(pts + [pts[0]], fill=rgba(STONE["shadow"], 190), width=sc(2.4), joint="curve")
    d.line(pts[:2], fill=rgba(edge, 215), width=sc(1.5))
    if len(pts) > 3:
        d.line(pts[1:3], fill=rgba("#cbd5e1", 78), width=sc(0.9))

    # Hairline fractures.
    crack_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(crack_layer)
    for _ in range(4):
        if rng.random() < 0.82:
            x = rng.uniform(x0 + 4, x1 - 4)
            y = rng.uniform(y0 + 4, y1 - 4)
            length = rng.uniform(5, 16)
            ang = rng.uniform(-0.9, 0.9)
            p1 = (x - length * 0.5, y - length * 0.5 * ang)
            p2 = (x + length * 0.5, y + length * 0.5 * ang)
            cd.line([spt(p1), spt(p2)], fill=rgba("#020617", rng.randint(115, 185)), width=sc(0.8))
            if accent and rng.random() < 0.45:
                cd.line([spt(p1), spt(p2)], fill=rgba(accent, rng.randint(55, 120)), width=sc(0.55))
    crack_layer.putalpha(ImageChops.multiply(crack_layer.getchannel("A"), mask))
    img.alpha_composite(crack_layer)


def draw_segmented_frame(img, seed, accent, sides=("top", "bottom", "left", "right"), thickness=11, inset=11, gap=5, heavy=False):
    rng = Random(seed)
    count_h = 5 if heavy else 4
    count_v = 4 if heavy else 3
    inner = inset + thickness
    outer = inset
    edge_col = "#9ca3af" if heavy else STONE["edge"]

    if "top" in sides:
        usable = SIZE - inset * 2
        seg = (usable - gap * (count_h - 1)) / count_h
        for i in range(count_h):
            x0 = inset + i * (seg + gap)
            x1 = x0 + seg
            pts = [(x0 + 3, outer), (x1 - 3, outer), (x1, inner - rng.uniform(1, 4)), (x0, inner)]
            draw_material_plate(img, pts, seed * 31 + i, accent, edge=edge_col)
    if "bottom" in sides:
        usable = SIZE - inset * 2
        seg = (usable - gap * (count_h - 1)) / count_h
        for i in range(count_h):
            x0 = inset + i * (seg + gap)
            x1 = x0 + seg
            pts = [(x0, SIZE - inner), (x1, SIZE - inner + rng.uniform(1, 4)), (x1 - 3, SIZE - outer), (x0 + 3, SIZE - outer)]
            draw_material_plate(img, pts, seed * 37 + i, accent, edge=edge_col)
    if "left" in sides:
        usable = SIZE - inset * 2
        seg = (usable - gap * (count_v - 1)) / count_v
        for i in range(count_v):
            y0 = inset + i * (seg + gap)
            y1 = y0 + seg
            pts = [(outer, y0 + 3), (inner, y0), (inner - rng.uniform(1, 4), y1), (outer, y1 - 3)]
            draw_material_plate(img, pts, seed * 41 + i, accent, edge=edge_col)
    if "right" in sides:
        usable = SIZE - inset * 2
        seg = (usable - gap * (count_v - 1)) / count_v
        for i in range(count_v):
            y0 = inset + i * (seg + gap)
            y1 = y0 + seg
            pts = [(SIZE - inner, y0), (SIZE - outer, y0 + 3), (SIZE - outer, y1 - 3), (SIZE - inner + rng.uniform(1, 4), y1)]
            draw_material_plate(img, pts, seed * 43 + i, accent, edge=edge_col)


def draw_energy_groove(img, points, color, width=2.0, glow=2.0, alpha=220):
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    md = ImageDraw.Draw(mask)
    md.line([spt(p) for p in points], fill=alpha, width=sc(width), joint="curve")
    add_glow(img, mask, color, blur=glow, alpha=85)
    d = ImageDraw.Draw(img)
    d.line([spt(p) for p in points], fill=rgba(color, alpha), width=sc(width), joint="curve")
    d.line([spt(p) for p in points], fill=rgba("#f8fafc", int(alpha * 0.28)), width=max(1, sc(width * 0.42)), joint="curve")


def draw_crystal_shard(img, pts, color, seed):
    draw_material_plate(img, pts, seed, accent=color, fill="#26323c", edge=color)
    d = ImageDraw.Draw(img)
    center = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    for p in pts[::2]:
        d.line([spt(center), spt(p)], fill=rgba(color, 125), width=sc(0.8))


def save(name, img):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    out.save(OUT_DIR / name)
    return out


def footprint_name(name, cols, rows):
    stem, suffix = name.rsplit(".", 1)
    return f"{stem}_{cols}x{rows}.{suffix}"


def tile_region(out, tile, box):
    x0, y0, x1, y1 = box
    if x1 <= x0 or y1 <= y0 or tile.width <= 0 or tile.height <= 0:
        return
    y = y0
    while y < y1:
        x = x0
        h = min(tile.height, y1 - y)
        while x < x1:
            w = min(tile.width, x1 - x)
            out.alpha_composite(tile.crop((0, 0, w, h)), (x, y))
            x += tile.width
        y += tile.height


def expand_overlay_to_footprint(src, cols, rows):
    if cols == 1 and rows == 1:
        return src
    out_w = SIZE * cols
    out_h = SIZE * rows
    out = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    c = 32

    # 9-slice expansion keeps corners crisp and tiles materialized edge chunks
    # instead of stretching a 1x1 glyph over a larger enemy footprint.
    out.alpha_composite(src.crop((0, 0, c, c)), (0, 0))
    out.alpha_composite(src.crop((SIZE - c, 0, SIZE, c)), (out_w - c, 0))
    out.alpha_composite(src.crop((0, SIZE - c, c, SIZE)), (0, out_h - c))
    out.alpha_composite(src.crop((SIZE - c, SIZE - c, SIZE, SIZE)), (out_w - c, out_h - c))

    tile_region(out, src.crop((c, 0, SIZE - c, c)), (c, 0, out_w - c, c))
    tile_region(out, src.crop((c, SIZE - c, SIZE - c, SIZE)), (c, out_h - c, out_w - c, out_h))
    tile_region(out, src.crop((0, c, c, SIZE - c)), (0, c, c, out_h - c))
    tile_region(out, src.crop((SIZE - c, c, SIZE, SIZE - c)), (out_w - c, c, out_w, out_h - c))

    # Preserve small edge-adjacent mechanism anchors such as side capacitors,
    # spore pods and carrier rails; the transparent center stays empty.
    return out


def save_footprint_variants(name, base_img, footprints=FOOTPRINTS):
    outputs = {(1, 1): save(name, base_img)}
    for cols, rows in footprints:
        if cols == 1 and rows == 1:
            continue
        expanded = expand_overlay_to_footprint(outputs[(1, 1)], cols, rows)
        expanded.save(OUT_DIR / footprint_name(name, cols, rows))
        outputs[(cols, rows)] = expanded
    return outputs


def energy_armor(charged):
    img = new_layer()
    accent = "#fbbf24" if charged else "#92400e"
    draw_segmented_frame(img, 11, accent, sides=("left", "right"), thickness=13, inset=9, heavy=True)
    d = ImageDraw.Draw(img)
    for x in (18, 110):
        draw_material_plate(img, [(x - 5, 27), (x + 5, 25), (x + 7, 100), (x - 7, 102)], 300 + x, accent, fill="#29323a", edge="#d6a945" if charged else "#7c4a1d")
        for y in (42, 55, 68, 81):
            draw_energy_groove(img, [(x + (-7 if x > 64 else 7), y), (64, y - 7)], "#fde68a" if charged else "#b45309", width=1.5, glow=2 if charged else 0.8, alpha=210 if charged else 120)
    draw_energy_groove(img, [(45, 15), (83, 15)], "#fbbf24" if charged else "#7c2d12", width=4.2, glow=3 if charged else 1, alpha=240 if charged else 120)
    for x in (38, 90):
        d.rectangle((sc(x), sc(21), sc(x + 7), sc(26)), fill=rgba("#0f172a", 190))
        d.rectangle((sc(x + 1), sc(22), sc(x + 6), sc(25)), fill=rgba("#fef3c7" if charged else "#78350f", 210 if charged else 120))
    return save_footprint_variants(f"overlay_energy_armor_{'charged' if charged else 'empty'}.png", img)


def phase_shield(disabled=False):
    img = new_layer()
    accent = "#facc15" if disabled else "#93c5fd"
    draw_segmented_frame(img, 21 if disabled else 22, accent, sides=("top", "bottom", "left", "right"), thickness=8, inset=11)
    shield = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shield)
    for box, alpha, width in [((18, 17, 112, 112), 145, 4), ((27, 10, 121, 104), 90, 2)]:
        sd.rounded_rectangle(tuple(sc(v) for v in box), radius=sc(18), outline=rgba(accent, alpha), width=sc(width))
    add_glow(img, shield.getchannel("A"), accent, blur=4 if not disabled else 2, alpha=100)
    img.alpha_composite(shield)
    d = ImageDraw.Draw(img)
    if disabled:
        for pts in [
            [(30, 12), (42, 12), (34, 34)],
            [(51, 12), (62, 12), (55, 31)],
            [(76, 13), (90, 14), (82, 34)],
        ]:
            draw_crystal_shard(img, pts, "#fef3c7", 130 + len(pts))
        d.line([spt((88, 30)), spt((108, 50))], fill=rgba("#fef3c7", 235), width=sc(4))
        d.line([spt((108, 30)), spt((88, 50))], fill=rgba("#fef3c7", 235), width=sc(4))
        d.line([spt((88, 30)), spt((108, 50))], fill=rgba("#0f172a", 130), width=sc(1))
    else:
        draw_energy_groove(img, [(38, 25), (90, 25)], "#bfdbfe", width=1.6, glow=2.5, alpha=210)
        draw_energy_groove(img, [(36, 103), (88, 102)], "#bfdbfe", width=1.4, glow=2.0, alpha=160)
    return save_footprint_variants(f"overlay_phase_shield_{'disabled' if disabled else 'active'}.png", img)


def low_damage_immune():
    img = new_layer()
    draw_segmented_frame(img, 31, "#cbd5e1", sides=("top", "bottom", "left", "right"), thickness=13, inset=9, heavy=True)
    d = ImageDraw.Draw(img)
    for x, y in [(22, 22), (106, 22), (22, 106), (106, 106)]:
        d.ellipse((sc(x - 4), sc(y - 4), sc(x + 4), sc(y + 4)), fill=rgba("#e2e8f0", 225), outline=rgba("#0f172a", 170), width=sc(1.3))
    for i, x in enumerate([36, 49, 62, 75, 88]):
        draw_energy_groove(img, [(x, 112), (x + 5, 101)], "#94a3b8", width=1.7, glow=0.5, alpha=170 - i * 10)
    return save_footprint_variants("overlay_affix_lowDamageImmune.png", img)


def living_armor(name, color, strength=1.0, stacked=False):
    img = new_layer()
    draw_segmented_frame(img, 41 + int(strength * 10) + (30 if stacked else 0), color, sides=("top", "bottom") if strength < 0.85 else ("top", "bottom", "left", "right"), thickness=13 if stacked else 10, inset=10, heavy=stacked)
    d = ImageDraw.Draw(img)
    rows = [17, 102]
    if stacked:
        rows = [14, 28, 91, 105]
    count = 7 if stacked else 5
    for y in rows:
        for i in range(count):
            x = 22 + i * (84 / max(1, count - 1))
            shard = [(x - 7, y - 4), (x + 6, y - 5), (x + 8, y + 4), (x - 5, y + 6)]
            draw_crystal_shard(img, shard, color, 500 + i + int(y * 3))
    if strength <= 0.8:
        for x in (39, 87):
            d.line([spt((x - 8, 111)), spt((x + 5, 111))], fill=rgba("#fef08a", 200), width=sc(2))
            d.line([spt((x + 5, 111)), spt((x + 11, 106))], fill=rgba("#fef08a", 140), width=sc(1))
    return save_footprint_variants(name, img)


def armor_spore():
    img = new_layer()
    draw_segmented_frame(img, 61, "#84cc16", sides=("right",), thickness=15, inset=8, heavy=True)
    d = ImageDraw.Draw(img)
    for idx, (x, y, rx, ry) in enumerate([(110, 37, 10, 13), (115, 62, 8, 11), (109, 86, 7, 9)]):
        draw_material_plate(img, [(x - rx, y - 1), (x - 2, y - ry), (x + rx, y - 1), (x + 2, y + ry)], 610 + idx, "#bef264", fill="#3f4f35", edge="#a3e635")
        d.ellipse((sc(x - rx * 0.45), sc(y - ry * 0.45), sc(x + rx * 0.45), sc(y + ry * 0.45)), fill=rgba("#bef264", 105))
    draw_energy_groove(img, [(14, 100), (47, 64), (98, 40)], "#bef264", width=2.1, glow=2.2, alpha=190)
    return save_footprint_variants("overlay_affix_armorSpore.png", img)


def overload(level):
    img = new_layer()
    accent = ["#fb923c", "#fdba74", "#fed7aa"][level - 1]
    draw_segmented_frame(img, 71 + level, accent, sides=("bottom",), thickness=16, inset=8, heavy=True)
    d = ImageDraw.Draw(img)
    for i in range(8):
        x = 24 + i * 11.5
        draw_energy_groove(img, [(x, 116), (x + 4, 101)], accent, width=1.4 + level * 0.25, glow=level * 0.8, alpha=155 + level * 28)
    for i in range(3):
        h = 10 + i * 5
        alpha = 225 if i < level else 70
        d.rectangle((sc(49 + i * 11), sc(115 - h), sc(56 + i * 11), sc(115)), fill=rgba(accent, alpha))
        d.rectangle((sc(49 + i * 11), sc(115 - h), sc(56 + i * 11), sc(115)), outline=rgba("#0f172a", 120), width=sc(1))
    return save_footprint_variants(f"overlay_overload_reactor_{level}.png", img)


def siege_breaker():
    img = new_layer()
    draw_segmented_frame(img, 81, "#fb923c", sides=("bottom",), thickness=16, inset=8, heavy=True)
    for i, x in enumerate([40, 64, 88]):
        draw_material_plate(img, [(x, 113), (x - 16, 88), (x + 16, 88)], 810 + i, "#fb923c", fill="#34302b", edge="#fed7aa")
        draw_energy_groove(img, [(x - 8, 95), (x + 8, 95)], "#fb923c", width=1.2, glow=1.0, alpha=150)
    return save_footprint_variants("overlay_affix_siegeBreaker.png", img)


def carrier():
    img = new_layer()
    draw_segmented_frame(img, 91, "#67e8f9", sides=("top", "left", "right"), thickness=11, inset=11, heavy=True)
    draw_material_plate(img, [(43, 27), (53, 25), (53, 95), (43, 98)], 911, "#67e8f9", fill="#26343d", edge="#67e8f9")
    draw_material_plate(img, [(75, 25), (85, 27), (85, 98), (75, 95)], 912, "#67e8f9", fill="#26343d", edge="#67e8f9")
    draw_material_plate(img, [(48, 23), (80, 23), (85, 35), (43, 35)], 913, "#67e8f9", fill="#26343d", edge="#67e8f9")
    for y in (42, 59, 76):
        draw_energy_groove(img, [(33, y), (43, y - 5)], "#a5f3fc", width=1.3, glow=1.2, alpha=145)
        draw_energy_groove(img, [(95, y), (85, y - 5)], "#a5f3fc", width=1.3, glow=1.2, alpha=145)
    draw_energy_groove(img, [(64, 39), (64, 78)], "#67e8f9", width=2.2, glow=2, alpha=170)
    return save_footprint_variants("overlay_affix_carrier.png", img)


def deflect_shell():
    img = new_layer()
    accent = "#67e8f9"
    for pts, seed in [
        ([(28, 15), (50, 12), (43, 24), (30, 29)], 1001),
        ([(100, 28), (112, 47), (99, 44), (91, 34)], 1002),
        ([(30, 101), (47, 113), (43, 99), (31, 91)], 1003),
    ]:
        draw_crystal_shard(img, pts, accent, seed)
    arc = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    d = ImageDraw.Draw(arc)
    for start in (14, 138, 258):
        d.arc((sc(13), sc(13), sc(115), sc(115)), start=start, end=start + 64, fill=rgba(accent, 220), width=sc(4.3))
    add_glow(img, arc.getchannel("A"), accent, blur=3, alpha=115)
    img.alpha_composite(arc)
    draw_energy_groove(img, [(39, 18), (54, 17)], "#a5f3fc", width=1.4, glow=1.2, alpha=160)
    draw_energy_groove(img, [(77, 110), (94, 108)], "#a5f3fc", width=1.4, glow=1.2, alpha=160)
    return save_footprint_variants("overlay_affix_deflectShell.png", img)


def build_contact_sheet(images):
    cols = 5
    cell = 160
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (12, 18, 28, 255))
    d = ImageDraw.Draw(sheet)
    for idx, (name, img) in enumerate(images):
        x = (idx % cols) * cell
        y = (idx // cols) * cell
        bg = Image.new("RGBA", (SIZE, SIZE), (22, 30, 44, 255))
        bd = ImageDraw.Draw(bg)
        for yy in range(0, SIZE, 16):
            for xx in range(0, SIZE, 16):
                if (xx // 16 + yy // 16) % 2 == 0:
                    bd.rectangle((xx, yy, xx + 15, yy + 15), fill=(30, 41, 59, 255))
        bg.alpha_composite(img)
        sheet.alpha_composite(bg, (x + 16, y + 8))
        d.text((x + 10, y + 140), name[:24], fill=(226, 232, 240, 255))
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(CONTACT_SHEET)


def build_footprint_contact_sheet(variant_sets):
    samples = [
        ("phase active", "phase active", [(1, 1), (2, 1), (1, 2), (3, 2)]),
        ("living high", "living high", [(1, 1), (2, 2), (3, 1), (2, 3)]),
        ("carrier", "carrier", [(1, 1), (3, 2), (3, 3)]),
        ("low immune", "low immune", [(1, 1), (3, 1), (1, 3), (3, 3)]),
    ]
    cell_w = 170
    cell_h = 170
    rows = sum(len(item[2]) for item in samples)
    sheet = Image.new("RGBA", (cell_w * 4, cell_h * max(1, rows // 4 + 1)), (12, 18, 28, 255))
    d = ImageDraw.Draw(sheet)
    idx = 0
    for label, key, footprints in samples:
        variants = variant_sets[key]
        for cols, rows_ in footprints:
            img = variants[(cols, rows_)]
            thumb = img.copy()
            thumb.thumbnail((150, 118), Image.Resampling.LANCZOS)
            x = (idx % 4) * cell_w
            y = (idx // 4) * cell_h
            bg = Image.new("RGBA", (150, 118), (22, 30, 44, 255))
            bd = ImageDraw.Draw(bg)
            for yy in range(0, 118, 16):
                for xx in range(0, 150, 16):
                    if (xx // 16 + yy // 16) % 2 == 0:
                        bd.rectangle((xx, yy, min(xx + 15, 149), min(yy + 15, 117)), fill=(30, 41, 59, 255))
            bg.alpha_composite(thumb, ((150 - thumb.width) // 2, (118 - thumb.height) // 2))
            sheet.alpha_composite(bg, (x + 10, y + 10))
            d.text((x + 10, y + 135), f"{label} {cols}x{rows_}", fill=(226, 232, 240, 255))
            idx += 1
    used_h = ((idx + 3) // 4) * cell_h
    FOOTPRINT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.crop((0, 0, cell_w * 4, used_h)).convert("RGB").save(FOOTPRINT_SHEET)


def main():
    variant_sets = {
        "energy charged": energy_armor(True),
        "energy empty": energy_armor(False),
        "phase active": phase_shield(False),
        "phase disabled": phase_shield(True),
        "low immune": low_damage_immune(),
        "living high": living_armor("overlay_living_armor_high.png", "#8cc63f", 2.0),
        "living mid": living_armor("overlay_living_armor_mid.png", "#78a833", 1.3),
        "living low": living_armor("overlay_living_armor_low.png", "#d6b333", 0.7),
        "stack high": living_armor("overlay_living_armor_stack_high.png", "#c7d6bd", 2.2, True),
        "stack mid": living_armor("overlay_living_armor_stack_mid.png", "#9bbf6d", 1.5, True),
        "stack low": living_armor("overlay_living_armor_stack_low.png", "#caa43a", 0.8, True),
        "armor spore": armor_spore(),
        "overload 1": overload(1),
        "overload 2": overload(2),
        "overload 3": overload(3),
        "siege breaker": siege_breaker(),
        "carrier": carrier(),
        "deflect shell": deflect_shell(),
    }
    build_contact_sheet([(name, variants[(1, 1)]) for name, variants in variant_sets.items()])
    build_footprint_contact_sheet(variant_sets)
    print(f"generated {len(variant_sets) * len(FOOTPRINTS)} materialized footprint overlays in {OUT_DIR}")
    print(f"contact sheet: {CONTACT_SHEET}")
    print(f"footprint sheet: {FOOTPRINT_SHEET}")


if __name__ == "__main__":
    main()
