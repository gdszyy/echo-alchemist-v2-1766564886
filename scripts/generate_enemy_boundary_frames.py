from pathlib import Path
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


CELL_SIZE = 256
GREEN = (0, 255, 0, 255)
OUT_DIR = Path("assets/sprites/enemies/frames")
ARCHIVE_DIR = Path("docs/archive/enemy_collision_frame_sources_2026-06-21")
SOURCE_DIR = ARCHIVE_DIR / "source_green"
MATERIAL_PATH = ARCHIVE_DIR / "materials" / "collision_frame_obsidian_texture.png"
_MATERIAL_SOURCE = None


PALETTES = {
    "residue": ((148, 163, 184, 245), (226, 232, 240, 180), (15, 23, 42, 165)),
    "bastion": ((156, 163, 175, 245), (241, 245, 249, 175), (17, 24, 39, 165)),
    "maw": ((185, 80, 82, 245), (254, 202, 202, 170), (69, 10, 10, 170)),
    "deflector": ((34, 211, 238, 240), (224, 242, 254, 170), (14, 116, 144, 155)),
    "echo": ((168, 85, 247, 240), (233, 213, 255, 170), (76, 29, 149, 160)),
    "prism": ((125, 211, 252, 242), (255, 255, 255, 180), (14, 116, 144, 155)),
    "hive": ((74, 222, 128, 240), (220, 252, 231, 165), (21, 128, 61, 155)),
    "siege": ((245, 158, 11, 245), (254, 243, 199, 170), (120, 53, 15, 165)),
    "gravity": ((167, 139, 250, 245), (237, 233, 254, 175), (76, 29, 149, 165)),
}

FRAME_MAIN = (82, 88, 96, 245)
FRAME_HIGHLIGHT = (178, 184, 192, 170)
FRAME_SHADOW = (12, 15, 20, 165)


SHAPES = {
    # AABB enemies use the actual box boundary. This is intentionally not rounded:
    # the boundary art states physics, not decorative container shape.
    "residue:1x1": {
        "file": "frame_residue_1x1.png",
        "kind": "aabb",
        "palette": "residue",
        "footprint": (1, 1),
    },
    "minion:ignis:1x1": {
        "file": "frame_minion_ignis_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(0.00, -0.50), (0.50, 0.50), (-0.50, 0.50)],
    },
    "minion:glacies:1x1": {
        "file": "frame_minion_glacies_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(0.00, -0.50), (0.50, 0.00), (0.00, 0.50), (-0.50, 0.00)],
    },
    "minion:mikro:1x1": {
        "file": "frame_minion_mikro_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(0.00, -0.50), (0.50, -0.25), (0.50, 0.25), (0.00, 0.50), (-0.50, 0.25), (-0.50, -0.25)],
    },
    "minion:devourer:1x1": {
        "file": "frame_minion_devourer_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(-0.50, -0.50), (0.20, -0.50), (0.50, -0.20), (0.50, 0.50), (-0.50, 0.50)],
    },
    "minion:viridis:1x1": {
        "file": "frame_minion_viridis_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(0.00, -0.50), (0.40, -0.10), (0.50, 0.20), (0.30, 0.50), (-0.30, 0.50), (-0.50, 0.20), (-0.40, -0.10)],
    },
    "minion:tesla:1x1": {
        "file": "frame_minion_tesla_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(0.20, -0.50), (0.50, -0.50), (-0.20, 0.50), (-0.50, 0.50)],
    },
    "minion:chimera:1x1": {
        "file": "frame_minion_chimera_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(-0.50, -0.50), (0.30, -0.50), (0.50, 0.00), (0.20, 0.50), (-0.50, 0.50)],
    },
    "minion:ouroboros:1x1": {
        "file": "frame_minion_ouroboros_1x1.png",
        "kind": "polygon",
        "palette": "residue",
        "footprint": (1, 1),
        "vertices": [(-0.20, -0.50), (0.20, -0.50), (0.50, -0.20), (0.50, 0.20), (0.20, 0.50), (-0.20, 0.50), (-0.50, 0.20), (-0.50, -0.20)],
    },
    "bastion:3x1": {
        "file": "frame_bastion_3x1.png",
        "kind": "aabb",
        "palette": "bastion",
        "footprint": (3, 1),
    },
    "hive:2x3": {
        "file": "frame_hive_2x3.png",
        "kind": "aabb",
        "palette": "hive",
        "footprint": (2, 3),
    },
    "maw:2x2": {
        "file": "frame_maw_2x2.png",
        "kind": "polygon",
        "palette": "maw",
        "footprint": (2, 2),
        "vertices": [(-0.45, -0.45), (0.45, -0.45), (0.50, 0.10), (0.20, 0.50), (-0.20, 0.50), (-0.50, 0.10)],
    },
    "deflector:2x1": {
        "file": "frame_deflector_2x1.png",
        "kind": "polygon",
        "palette": "deflector",
        "footprint": (2, 1),
        "vertices": [(-0.50, 0.30), (-0.30, -0.45), (0.30, -0.45), (0.50, 0.30), (0.30, 0.50), (-0.30, 0.50)],
    },
    "echoSpire:1x2": {
        "file": "frame_echo_spire_1x2.png",
        "kind": "polygon",
        "palette": "echo",
        "footprint": (1, 2),
        "vertices": [(0.00, -0.50), (0.30, -0.30), (0.40, 0.45), (-0.40, 0.45), (-0.30, -0.30)],
    },
    "prism:1x3": {
        "file": "frame_prism_1x3.png",
        "kind": "polygon",
        "palette": "prism",
        "footprint": (1, 3),
        "vertices": [(0.00, -0.50), (0.45, 0.00), (0.00, 0.50), (-0.45, 0.00)],
    },
    "siege:3x2": {
        "file": "frame_siege_3x2.png",
        "kind": "polygon",
        "palette": "siege",
        "footprint": (3, 2),
        "vertices": [(-0.50, -0.20), (-0.30, -0.50), (0.30, -0.50), (0.50, -0.20), (0.50, 0.20), (0.30, 0.50), (-0.30, 0.50), (-0.50, 0.20)],
    },
    "gravityWell:3x3": {
        "file": "frame_gravity_core_3x3.png",
        "kind": "arc",
        "palette": "gravity",
        "footprint": (3, 3),
        "radius": 0.45,
    },
}


def canvas_size(spec):
    cols, rows = spec["footprint"]
    return cols * CELL_SIZE, rows * CELL_SIZE


def map_point(point, inset, width, height):
    x, y = point
    usable_w = width - inset * 2
    usable_h = height - inset * 2
    return (width / 2 + x * usable_w, height / 2 + y * usable_h)


def draw_polyline(draw, points, fill, width):
    draw.line(points + [points[0]], fill=fill, width=width, joint="curve")


def lerp_point(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def edge_length(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def clamp(value, lo=0, hi=255):
    return max(lo, min(hi, int(value)))


def tint(color, dr=0, dg=0, db=0, alpha=None):
    r, g, b, a = color
    return (clamp(r + dr), clamp(g + dg), clamp(b + db), a if alpha is None else alpha)


def pull_toward_center(point, center, amount):
    return (point[0] + (center[0] - point[0]) * amount, point[1] + (center[1] - point[1]) * amount)


def inset_quad(quad, center, amount):
    return [pull_toward_center(point, center, amount) for point in quad]


def jitter_point(point, rng, amount):
    return (point[0] + rng.uniform(-amount, amount), point[1] + rng.uniform(-amount, amount))


def polygon_band_mask(size, outer_points, inner_points):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(outer_points, fill=255)
    draw.polygon(inner_points, fill=0)
    return mask


def circle_band_mask(size, center, outer_r, inner_r):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = center
    draw.ellipse((cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r), fill=255)
    draw.ellipse((cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r), fill=0)
    return mask


def get_material_source():
    global _MATERIAL_SOURCE
    if _MATERIAL_SOURCE is None and MATERIAL_PATH.exists():
        _MATERIAL_SOURCE = Image.open(MATERIAL_PATH).convert("RGBA")
    return _MATERIAL_SOURCE


def crop_material(size, seed):
    source = get_material_source()
    if source is None:
        return None

    width, height = size
    rng = random.Random(seed + ":material")
    tile_edge = rng.uniform(360, 520)
    scale = tile_edge / max(source.width, source.height)
    scaled = source.resize(
        (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (width + scaled.width, height + scaled.height), (0, 0, 0, 0))
    x0 = -rng.randint(0, max(0, scaled.width - 1))
    y0 = -rng.randint(0, max(0, scaled.height - 1))
    for y in range(y0, canvas.height, scaled.height):
        for x in range(x0, canvas.width, scaled.width):
            canvas.alpha_composite(scaled, (x, y))

    crop = canvas.crop((0, 0, width, height))
    crop = ImageEnhance.Brightness(crop).enhance(1.95)
    crop = ImageEnhance.Contrast(crop).enhance(1.18)
    crop = ImageEnhance.Sharpness(crop).enhance(1.34)
    return crop


def apply_material_finish(texture, mask, base):
    return texture


def material_layer(size, mask, palette, base):
    main, highlight, shadow = palette
    textured = crop_material(size, f"{size[0]}x{size[1]}:{palette[0]}")
    if textured is not None:
        textured = apply_material_finish(textured, mask, base)
        alpha = mask.point(lambda p: int(p * 0.96))
        textured.putalpha(alpha)
        return textured

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    base_color = (28, 32, 40, 238)
    d.rectangle((0, 0, size[0], size[1]), fill=base_color)

    tile = max(18, round(base * 0.16))
    for y in range(-tile, size[1] + tile, tile):
        for x in range(-tile, size[0] + tile, tile):
            phase = ((x // tile) * 7 + (y // tile) * 11) % 9
            shade = -13 + phase * 3
            color = tint(base_color, shade, shade, shade + 3, 210)
            d.polygon(
                [
                    (x + tile * 0.04, y + tile * 0.28),
                    (x + tile * 0.52, y + tile * 0.04),
                    (x + tile * 0.96, y + tile * 0.32),
                    (x + tile * 0.78, y + tile * 0.92),
                    (x + tile * 0.20, y + tile * 0.98),
                ],
                fill=color,
            )

    chip = max(2, round(base * 0.012))
    for i in range(max(18, round((size[0] * size[1]) / (base * base) * 26))):
        x = (i * 73 + size[0] * 0.17) % size[0]
        y = (i * 41 + size[1] * 0.29) % size[1]
        shade = 34 + (i % 5) * 9
        d.line((x - chip, y, x + chip * 0.7, y - chip * 0.6), fill=(shade, shade + 6, shade + 12, 38), width=1)

    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rectangle((0, 0, size[0], size[1]), fill=tint(main, -20, -20, -20, 16))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(max(2, round(base * 0.018)))))
    layer.alpha_composite(glow)
    layer.putalpha(mask)
    return layer


def detail_overlay(size, mask):
    detail = Image.new("RGBA", size, (0, 0, 0, 0))
    return detail


def clip_detail_to_mask(detail, mask):
    alpha = ImageChops.multiply(detail.getchannel("A"), mask)
    detail.putalpha(alpha)
    return detail


def draw_segmented_panels(image, mask, outer_points, inner_points, palette, base, seed):
    rng = random.Random(seed)
    main, highlight, _shadow = FRAME_MAIN, FRAME_HIGHLIGHT, FRAME_SHADOW
    detail = detail_overlay(image.size, mask)
    draw = ImageDraw.Draw(detail)

    for edge_index, (outer_a, outer_b, inner_a, inner_b) in enumerate(zip(
        outer_points,
        outer_points[1:] + [outer_points[0]],
        inner_points,
        inner_points[1:] + [inner_points[0]],
    )):
        length = edge_length(outer_a, outer_b)
        count = max(1, min(7, round(length / max(46, base * 0.34))))
        weights = [rng.uniform(0.65, 1.45) for _ in range(count)]
        total = sum(weights)
        cursor = 0.0
        jitter = max(1.5, base * 0.010)

        for segment, weight in enumerate(weights):
            t0 = cursor / total
            cursor += weight
            t1 = cursor / total
            gap = min(0.030, rng.uniform(3.0, 7.0) / max(length, 1))
            t0 += gap
            t1 -= gap
            if t1 <= t0:
                continue
            oa = lerp_point(outer_a, outer_b, t0)
            ob = lerp_point(outer_a, outer_b, t1)
            ib = lerp_point(inner_a, inner_b, t1)
            ia = lerp_point(inner_a, inner_b, t0)
            quad = [
                jitter_point(oa, rng, jitter),
                jitter_point(ob, rng, jitter),
                jitter_point(ib, rng, jitter),
                jitter_point(ia, rng, jitter),
            ]
            center = (
                sum(point[0] for point in quad) / 4,
                sum(point[1] for point in quad) / 4,
            )
            plate = inset_quad(quad, center, rng.uniform(0.035, 0.070))
            shade = rng.randint(-4, 6)
            draw.polygon(plate, fill=(35 + shade, 40 + shade, 49 + shade, 16))
            draw.line(plate + [plate[0]], fill=(102, 114, 130, 18), width=1, joint="curve")
            if rng.random() < 0.35:
                draw.line((plate[0], plate[1]), fill=(160, 170, 188, 28), width=1)

            groove_mid_outer = lerp_point(oa, ob, 0.50)
            groove_mid_inner = lerp_point(ia, ib, 0.50)
            if rng.random() < 0.62:
                groove_a = lerp_point(groove_mid_outer, groove_mid_inner, rng.uniform(0.22, 0.38))
                groove_b = lerp_point(groove_mid_outer, groove_mid_inner, rng.uniform(0.62, 0.82))
                draw.line((groove_a, groove_b), fill=tint(main, -42, -42, -34, 40), width=max(1, round(base * 0.003)))

            if rng.random() < 0.56:
                crack_center = lerp_point(groove_mid_outer, groove_mid_inner, rng.uniform(0.30, 0.70))
                angle = math.atan2(outer_b[1] - outer_a[1], outer_b[0] - outer_a[0]) + rng.uniform(-0.9, 0.9)
                crack_len = rng.uniform(base * 0.030, base * 0.090)
                mid = (crack_center[0], crack_center[1])
                end = (mid[0] + math.cos(angle) * crack_len, mid[1] + math.sin(angle) * crack_len)
                elbow = lerp_point(mid, end, 0.55)
                elbow = (elbow[0] + math.sin(angle) * crack_len * 0.20, elbow[1] - math.cos(angle) * crack_len * 0.20)
                draw.line((mid, elbow, end), fill=(24, 29, 38, 78), width=max(1, round(base * 0.004)))
                draw.line((mid, elbow), fill=(144, 156, 174, 34), width=1)

            if rng.random() < 0.26:
                slot_center = lerp_point(groove_mid_outer, groove_mid_inner, rng.uniform(0.38, 0.62))
                r = max(2, round(base * rng.uniform(0.008, 0.014)))
                diamond = [
                    (slot_center[0], slot_center[1] - r * 1.3),
                    (slot_center[0] + r, slot_center[1]),
                    (slot_center[0], slot_center[1] + r * 1.3),
                    (slot_center[0] - r, slot_center[1]),
                ]
                draw.polygon(diamond, fill=tint(highlight, -34, -34, -26, 58))
                draw.line(diamond + [diamond[0]], fill=tint(main, -42, -42, -34, 42), width=1)

    image.alpha_composite(clip_detail_to_mask(detail, mask))


def draw_radial_panels(image, mask, center, outer_r, inner_r, palette, base, seed):
    rng = random.Random(seed)
    main, highlight, _shadow = FRAME_MAIN, FRAME_HIGHLIGHT, FRAME_SHADOW
    detail = detail_overlay(image.size, mask)
    draw = ImageDraw.Draw(detail)
    cx, cy = center
    count = 20
    gap = math.radians(1.5)

    for i in range(count):
        a0 = math.tau * i / count + gap
        a1 = math.tau * (i + 1) / count - gap
        quad = [
            (cx + math.cos(a0) * outer_r, cy + math.sin(a0) * outer_r),
            (cx + math.cos(a1) * outer_r, cy + math.sin(a1) * outer_r),
            (cx + math.cos(a1) * inner_r, cy + math.sin(a1) * inner_r),
            (cx + math.cos(a0) * inner_r, cy + math.sin(a0) * inner_r),
        ]
        center_quad = (sum(p[0] for p in quad) / 4, sum(p[1] for p in quad) / 4)
        quad = [jitter_point(p, rng, base * 0.006) for p in inset_quad(quad, center_quad, rng.uniform(0.025, 0.055))]
        shade = rng.randint(-4, 6)
        draw.polygon(quad, fill=(35 + shade, 40 + shade, 49 + shade, 16))
        draw.line(quad + [quad[0]], fill=(102, 114, 130, 18), width=1)

        mid_angle = (a0 + a1) / 2
        if i % 3 == 0:
            p0 = (cx + math.cos(mid_angle) * (inner_r + (outer_r - inner_r) * 0.22), cy + math.sin(mid_angle) * (inner_r + (outer_r - inner_r) * 0.22))
            p1 = (cx + math.cos(mid_angle) * (inner_r + (outer_r - inner_r) * 0.78), cy + math.sin(mid_angle) * (inner_r + (outer_r - inner_r) * 0.78))
            draw.line((p0, p1), fill=tint(main, -42, -42, -34, 40), width=max(1, round(base * 0.003)))

        if rng.random() < 0.32:
            rr = rng.uniform(inner_r + (outer_r - inner_r) * 0.25, outer_r - (outer_r - inner_r) * 0.24)
            cc = (cx + math.cos(mid_angle) * rr, cy + math.sin(mid_angle) * rr)
            r = max(2, round(base * rng.uniform(0.010, 0.016)))
            diamond = [(cc[0], cc[1] - r), (cc[0] + r, cc[1]), (cc[0], cc[1] + r), (cc[0] - r, cc[1])]
            draw.polygon(diamond, fill=tint(highlight, -34, -34, -26, 58))
            draw.line(diamond + [diamond[0]], fill=tint(main, -42, -42, -34, 42), width=1)

    image.alpha_composite(clip_detail_to_mask(detail, mask))


def draw_band_bevel(draw, outer_points, inner_points, palette, base):
    main, highlight, shadow = FRAME_MAIN, FRAME_HIGHLIGHT, FRAME_SHADOW
    outer_w = max(3, round(base * 0.016))
    inner_w = max(2, round(base * 0.012))
    seam_w = max(1, round(base * 0.006))

    draw_polyline(draw, outer_points, tint(main, -54, -54, -46, 92), outer_w)
    draw_polyline(draw, outer_points, tint(highlight, -42, -42, -34, 70), max(1, seam_w))
    draw_polyline(draw, inner_points, tint(shadow, 18, 18, 22, 88), inner_w)
    draw_polyline(draw, inner_points, tint(main, -38, -38, -30, 48), seam_w)
    draw_polyline(draw, inner_points, tint(highlight, -46, -46, -36, 34), max(1, seam_w // 2))


def draw_node(draw, point, palette, base, square=False):
    main, highlight, shadow = FRAME_MAIN, FRAME_HIGHLIGHT, FRAME_SHADOW
    r = max(4, round(base * 0.019))
    x, y = point
    if square:
        chip = [
            (x - r * 0.95, y - r * 0.66),
            (x - r * 0.22, y - r * 0.92),
            (x + r * 0.88, y - r * 0.42),
            (x + r * 0.66, y + r * 0.82),
            (x - r * 0.64, y + r * 0.86),
        ]
        draw.polygon(chip, fill=tint(main, -30, -30, -24, 82))
        draw.line(chip + [chip[0]], fill=tint(highlight, -38, -38, -30, 92), width=1)
        gem = [
            (x, y - r * 0.35),
            (x + r * 0.32, y),
            (x, y + r * 0.35),
            (x - r * 0.32, y),
        ]
        draw.polygon(gem, fill=tint(highlight, -18, -18, -12, 92))
    else:
        chip = [
            (x - r * 0.76, y - r * 0.16),
            (x - r * 0.26, y - r * 0.76),
            (x + r * 0.62, y - r * 0.58),
            (x + r * 0.78, y + r * 0.22),
            (x + r * 0.14, y + r * 0.74),
            (x - r * 0.66, y + r * 0.50),
        ]
        draw.polygon(chip, fill=tint(main, -34, -34, -26, 70))
        draw.line(chip + [chip[0]], fill=tint(highlight, -42, -42, -32, 76), width=1)
        draw.line((x - r * 0.32, y + r * 0.08, x + r * 0.40, y - r * 0.16), fill=tint(highlight, -24, -24, -16, 70), width=1)


def draw_edge_nodes(draw, points, palette, base):
    for index, point in enumerate(points):
        draw_node(draw, point, palette, base, square=index % 2 == 0)
    for a, b in zip(points, points[1:] + [points[0]]):
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        count = max(0, min(1, int(length // (base * 1.10))))
        for i in range(count):
            t = (i + 1) / (count + 1)
            draw_node(draw, lerp_point(a, b, t), palette, base, square=False)


def draw_boundary(image, spec, asset_key):
    width, height = canvas_size(spec)
    base = min(width, height)
    palette = PALETTES[spec["palette"]]
    inset = max(10, round(base * 0.050))
    center = (width / 2, height / 2)
    thickness_pull = 0.125

    if spec["kind"] == "aabb":
        box = (inset, inset, width - inset, height - inset)
        points = [(box[0], box[1]), (box[2], box[1]), (box[2], box[3]), (box[0], box[3])]
        inner_margin = max(20, round(base * 0.112))
        inner = [
            (box[0] + inner_margin, box[1] + inner_margin),
            (box[2] - inner_margin, box[1] + inner_margin),
            (box[2] - inner_margin, box[3] - inner_margin),
            (box[0] + inner_margin, box[3] - inner_margin),
        ]
        mask = polygon_band_mask((width, height), points, inner)
        image.alpha_composite(material_layer((width, height), mask, palette, base))
        draw_segmented_panels(image, mask, points, inner, palette, base, asset_key)
        draw = ImageDraw.Draw(image)
        draw_band_bevel(draw, points, inner, palette, base)
        draw_edge_nodes(draw, points, palette, base)
        return

    if spec["kind"] == "arc":
        r = spec["radius"] * (min(width, height) - inset * 2)
        cx = width / 2
        cy = height / 2
        inner_r = max(1, r - max(26, round(base * 0.115)))
        mask = circle_band_mask((width, height), (cx, cy), r, inner_r)
        image.alpha_composite(material_layer((width, height), mask, palette, base))
        draw_radial_panels(image, mask, (cx, cy), r, inner_r, palette, base, asset_key)
        draw = ImageDraw.Draw(image)
        outer_w = max(3, round(base * 0.016))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=tint(FRAME_MAIN, -32, -32, -28, 92), width=outer_w)
        draw.ellipse((cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r), outline=tint(FRAME_SHADOW, 18, 18, 22, 88), width=max(2, outer_w))
        draw.ellipse((cx - r + outer_w, cy - r + outer_w, cx + r - outer_w, cy + r - outer_w), outline=tint(FRAME_HIGHLIGHT, -62, -62, -54, 58), width=max(1, outer_w // 2))
        for angle in (0, 90, 180, 270):
            rad = math.radians(angle)
            draw_node(draw, (cx + math.cos(rad) * r, cy + math.sin(rad) * r), palette, base, square=True)
        return

    points = [map_point(p, inset, width, height) for p in spec["vertices"]]
    inner = [pull_toward_center(point, center, thickness_pull) for point in points]
    mask = polygon_band_mask((width, height), points, inner)
    image.alpha_composite(material_layer((width, height), mask, palette, base))
    draw_segmented_panels(image, mask, points, inner, palette, base, asset_key)
    draw = ImageDraw.Draw(image)
    draw_band_bevel(draw, points, inner, palette, base)
    draw_edge_nodes(draw, points, palette, base)


def generate():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)

    for key, spec in SHAPES.items():
        size = canvas_size(spec)
        transparent = Image.new("RGBA", size, (0, 0, 0, 0))
        draw_boundary(transparent, spec, key)

        green_source = Image.new("RGBA", size, GREEN)
        green_source.alpha_composite(transparent)

        green_source.save(SOURCE_DIR / spec["file"].replace(".png", "_green.png"))
        transparent.save(OUT_DIR / spec["file"])
        print(f"{key}: {spec['file']} {size[0]}x{size[1]}")


if __name__ == "__main__":
    generate()
