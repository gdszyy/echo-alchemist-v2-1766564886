import json
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
MATERIAL_PATH = ROOT / "docs/archive/enemy_collision_frame_sources_2026-06-21/materials/collision_frame_obsidian_texture.png"
SOURCE_ALPHA_PATH = ROOT / "docs/design/concepts/carrier_imagegen_pass1/carrier_imagegen_alpha.png"
SOURCE_RAW_PATH = ROOT / "docs/design/concepts/carrier_imagegen_pass1/carrier_imagegen_raw.png"
RUN_ID = "imagegen_carrier_native_hollow_2026_06_24"

BODY_SIZE = (384, 256)
FRAME_SIZE = (768, 512)

BODY_TARGETS = [
    ROOT / "assets/sprites/enemies/v2/enemy_carrier_3x2.png",
    ROOT / "assets/sprites/enemies/archetypes/enemy_carrier_3x2.png",
    ROOT / "assets/sprites/enemies/composites/enemy_carrier_carrier_3x2_idle.png",
]

BODY_META_TARGETS = [
    ROOT / "assets/sprites/enemies/v2/enemy_carrier_3x2.json",
    ROOT / "assets/sprites/enemies/archetypes/enemy_carrier_3x2.json",
    ROOT / "assets/sprites/enemies/composites/enemy_carrier_carrier_3x2_idle.json",
]

ICON_TARGETS = [
    ROOT / "assets/icons/enemies/enemy_carrier_3x2.png",
    ROOT / "assets/ui/icons/enemy_archetypes/enemy_carrier_3x2.png",
]

AFFIX_ICON_TARGET = ROOT / "assets/ui/icons/enemy_affixes/affix_carrier.png"
FRAME_TARGET = ROOT / "assets/sprites/enemies/frames/frame_carrier_3x2.png"
FRAME_SOURCE_TARGET = ROOT / "docs/archive/enemy_collision_frame_sources_2026-06-21/source_green/frame_carrier_3x2_green.png"
PREVIEW_TARGET = ROOT / "docs/design/enemy_carrier_asset_preview.png"


def _open_material(size, seed):
    if not MATERIAL_PATH.exists():
        base = Image.new("RGBA", size, (40, 45, 54, 255))
        return base

    material = Image.open(MATERIAL_PATH).convert("RGBA")
    rng = random.Random(seed)
    scale = rng.uniform(0.34, 0.42)
    scaled = material.resize(
        (max(size[0], int(material.width * scale)), max(size[1], int(material.height * scale))),
        Image.Resampling.LANCZOS,
    )
    max_x = max(0, scaled.width - size[0])
    max_y = max(0, scaled.height - size[1])
    x0 = rng.randint(0, max_x)
    y0 = rng.randint(0, max_y)
    crop = scaled.crop((x0, y0, x0 + size[0], y0 + size[1]))
    crop = ImageEnhance.Brightness(crop).enhance(1.18)
    crop = ImageEnhance.Contrast(crop).enhance(1.08)
    crop = ImageEnhance.Sharpness(crop).enhance(1.18)
    return crop


def _scaled_points(points, size):
    sx = size[0] / BODY_SIZE[0]
    sy = size[1] / BODY_SIZE[1]
    return [(x * sx, y * sy) for x, y in points]


def _carrier_outer_points():
    return [
        (22, 29),
        (361, 21),
        (371, 94),
        (348, 231),
        (250, 232),
        (250, 136),
        (134, 136),
        (134, 232),
        (36, 231),
        (13, 94),
    ]


def _carrier_inner_bay_points():
    return [
        (138, 132),
        (246, 132),
        (246, 238),
        (138, 238),
    ]


def _draw_polyline(draw, points, fill, width, close=True):
    if close:
        draw.line(points + [points[0]], fill=fill, width=width, joint="curve")
    else:
        draw.line(points, fill=fill, width=width, joint="curve")


def _body_mask(size):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(_scaled_points(_carrier_outer_points(), size), fill=255)
    draw.polygon(_scaled_points(_carrier_inner_bay_points(), size), fill=0)
    return mask


def _clip_to_alpha(layer, alpha):
    out = layer.copy()
    out.putalpha(ImageChops.multiply(out.getchannel("A"), alpha))
    return out


def _texture_fill(size, mask, seed, brightness=1.0):
    texture = _open_material(size, seed)
    texture = ImageEnhance.Brightness(texture).enhance(brightness)
    texture.putalpha(mask)
    return texture


def _draw_panel_lines(draw, size, alpha=190):
    sx = size[0] / BODY_SIZE[0]
    sy = size[1] / BODY_SIZE[1]

    def p(x, y):
        return x * sx, y * sy

    line = (123, 132, 148, alpha)
    shade = (8, 12, 18, max(80, alpha - 80))
    accent = (226, 151, 44, max(110, alpha - 40))
    cyan = (87, 215, 236, max(120, alpha - 30))

    panel_sets = [
        [(36, 56), (116, 50), (110, 104), (43, 113)],
        [(132, 48), (188, 40), (181, 118), (124, 108)],
        [(196, 40), (252, 48), (260, 108), (203, 118)],
        [(268, 50), (348, 56), (341, 113), (274, 104)],
        [(38, 133), (123, 126), (114, 222), (45, 225)],
        [(261, 126), (346, 133), (339, 225), (270, 222)],
    ]
    for points in panel_sets:
        scaled = [p(x, y) for x, y in points]
        _draw_polyline(draw, scaled, shade, max(1, round(3 * sx)))
        _draw_polyline(draw, scaled, line, max(1, round(1.35 * sx)))

    for x in (126, 191, 257):
        draw.line([p(x, 40), p(x - 13, 118)], fill=accent, width=max(1, round(2.0 * sx)))

    for x in (75, 309):
        draw.line([p(x - 21, 143), p(x - 15, 206)], fill=(147, 91, 28, 105), width=max(1, round(2.0 * sx)))
        draw.ellipse([p(x - 13, 166), p(x + 13, 192)], outline=cyan, width=max(2, round(2.5 * sx)))
        draw.ellipse([p(x - 6, 173), p(x + 6, 185)], fill=(7, 37, 45, 210), outline=(122, 245, 255, 210), width=max(1, round(1.5 * sx)))

    # Launch bay rails and latch.
    draw.line([p(146, 140), p(146, 230)], fill=(242, 167, 52, 190), width=max(2, round(2.2 * sx)))
    draw.line([p(238, 140), p(238, 230)], fill=(242, 167, 52, 190), width=max(2, round(2.2 * sx)))
    draw.line([p(156, 135), p(228, 135)], fill=(77, 211, 238, 185), width=max(2, round(2.0 * sx)))
    draw.line([p(158, 155), p(226, 155)], fill=(21, 94, 117, 140), width=max(1, round(1.4 * sx)))
    draw.polygon([p(192, 150), p(181, 169), p(203, 169)], fill=(103, 232, 249, 155), outline=(14, 116, 144, 190))

    # Top central control core.
    draw.ellipse([p(176, 66), p(208, 98)], fill=(10, 37, 44, 230), outline=(115, 244, 255, 210), width=max(2, round(2.0 * sx)))
    draw.arc([p(181, 71), p(203, 93)], start=300, end=75, fill=(165, 243, 252, 210), width=max(2, round(2.0 * sx)))
    draw.polygon([p(192, 75), p(199, 85), p(192, 95), p(185, 85)], fill=(45, 212, 191, 170))


def _draw_cracks(draw, mask, count, seed):
    rng = random.Random(seed)
    width, height = mask.size
    alpha = mask.load()
    for _ in range(count):
        for _attempt in range(80):
            x = rng.randint(18, width - 18)
            y = rng.randint(18, height - 18)
            if alpha[x, y] > 20:
                break
        else:
            continue
        length = rng.uniform(width * 0.025, width * 0.060)
        angle = rng.uniform(-1.1, 1.1) + (0 if rng.random() < 0.5 else 3.14)
        mid = (x, y)
        elbow = (
            x + math.cos(angle) * length * 0.45 + math.sin(angle) * rng.uniform(-5, 5),
            y + math.sin(angle) * length * 0.45 - math.cos(angle) * rng.uniform(-5, 5),
        )
        end = (x + math.cos(angle) * length, y + math.sin(angle) * length)
        draw.line([mid, elbow, end], fill=(5, 8, 13, 78), width=max(1, round(width * 0.0028)))
        draw.line([mid, elbow], fill=(189, 197, 211, 34), width=1)


def _fit_imagegen_body(size):
    if not SOURCE_ALPHA_PATH.exists():
        return None

    source = Image.open(SOURCE_ALPHA_PATH).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        return None

    crop = source.crop(bbox)
    scale = min(size[0] / crop.width, size[1] / crop.height)
    fitted_size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(fitted_size, Image.Resampling.LANCZOS)
    crop = ImageEnhance.Contrast(crop).enhance(1.04)
    crop = ImageEnhance.Sharpness(crop).enhance(1.12)

    body = Image.new("RGBA", size, (0, 0, 0, 0))
    offset = ((size[0] - fitted_size[0]) // 2, (size[1] - fitted_size[1]) // 2)
    body.alpha_composite(crop, offset)

    # Keep the carrier-specific lower-center launch bay readable after downscaling.
    alpha = body.getchannel("A")
    bay_clear = Image.new("L", size, 255)
    ImageDraw.Draw(bay_clear).polygon(_scaled_points(_carrier_inner_bay_points(), size), fill=0)
    softened_bay = bay_clear.filter(ImageFilter.GaussianBlur(0.35))
    body.putalpha(ImageChops.multiply(alpha, softened_bay))
    return body


def _generate_procedural_body():
    size = BODY_SIZE
    mask = _body_mask(size)
    body = Image.new("RGBA", size, (0, 0, 0, 0))
    body.alpha_composite(_texture_fill(size, mask, "carrier-body", 1.10))

    # Darken lower side legs to separate the open launch bay.
    shade = Image.new("RGBA", size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sd.rectangle((0, 128, size[0], size[1]), fill=(0, 0, 0, 38))
    body.alpha_composite(_clip_to_alpha(shade, mask))

    detail = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(detail)
    _draw_panel_lines(draw, size)
    _draw_cracks(draw, mask, 54, "carrier-cracks")

    outer = _scaled_points(_carrier_outer_points(), size)
    bay = _scaled_points(_carrier_inner_bay_points(), size)
    _draw_polyline(draw, outer, (6, 10, 16, 220), 5)
    _draw_polyline(draw, outer, (188, 198, 216, 205), 2)
    _draw_polyline(draw, bay, (4, 8, 14, 230), 5)
    _draw_polyline(draw, bay, (226, 171, 77, 210), 2)

    body.alpha_composite(_clip_to_alpha(detail, mask))

    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line([(146, 142), (146, 231)], fill=(14, 165, 233, 95), width=8)
    gd.line([(238, 142), (238, 231)], fill=(14, 165, 233, 95), width=8)
    gd.arc((134, 119, 250, 184), start=180, end=360, fill=(14, 165, 233, 80), width=7)
    glow = glow.filter(ImageFilter.GaussianBlur(4))
    body.alpha_composite(_clip_to_alpha(glow, mask))
    return body


def generate_body():
    imagegen_body = _fit_imagegen_body(BODY_SIZE)
    if imagegen_body is not None:
        return imagegen_body
    return _generate_procedural_body()


def generate_frame(body=None):
    size = FRAME_SIZE
    mask = _body_mask(size)
    eroded = mask.filter(ImageFilter.MinFilter(35))
    band = ImageChops.subtract(mask, eroded)
    frame = Image.new("RGBA", size, (0, 0, 0, 0))
    if body is not None and SOURCE_ALPHA_PATH.exists():
        painted_frame = body.resize(size, Image.Resampling.LANCZOS)
        painted_frame.putalpha(band)
        frame.alpha_composite(ImageEnhance.Contrast(painted_frame).enhance(1.08))
    else:
        frame.alpha_composite(_texture_fill(size, band, "carrier-frame", 1.12))

    draw = ImageDraw.Draw(frame)
    outer = _scaled_points(_carrier_outer_points(), size)
    bay = _scaled_points(_carrier_inner_bay_points(), size)
    _draw_polyline(draw, outer, (8, 12, 18, 232), 10)
    _draw_polyline(draw, outer, (173, 184, 202, 210), 4)
    _draw_polyline(draw, bay, (6, 9, 14, 232), 10)
    _draw_polyline(draw, bay, (235, 171, 73, 215), 4)

    rng = random.Random("carrier-frame-nodes")
    for x, y in outer + bay:
        r = rng.randint(7, 11)
        pts = [(x, y - r), (x + r, y), (x, y + r), (x - r, y)]
        draw.polygon(pts, fill=(62, 72, 88, 238), outline=(163, 174, 191, 190))
        draw.polygon([(x, y - r * 0.42), (x + r * 0.42, y), (x, y + r * 0.42), (x - r * 0.42, y)], fill=(139, 162, 183, 145))

    source = Image.new("RGBA", size, (0, 255, 0, 255))
    source.alpha_composite(frame)
    return frame, source


def generate_affix_icon():
    size = (256, 256)
    mask = _body_mask(size)
    eroded = mask.filter(ImageFilter.MinFilter(31))
    band = ImageChops.subtract(mask, eroded)
    icon = Image.new("RGBA", size, (0, 0, 0, 0))
    icon.alpha_composite(_texture_fill(size, band, "carrier-affix", 1.15))
    draw = ImageDraw.Draw(icon)
    outer = _scaled_points(_carrier_outer_points(), size)
    bay = _scaled_points(_carrier_inner_bay_points(), size)
    _draw_polyline(draw, outer, (221, 161, 52, 230), 9)
    _draw_polyline(draw, bay, (55, 213, 236, 230), 8)
    draw.polygon([(128, 102), (108, 130), (148, 130)], fill=(103, 232, 249, 170))
    return icon.resize((64, 64), Image.Resampling.LANCZOS)


def write_manifest(path):
    data = {
        "frameSize": 256,
        "frameWidth": BODY_SIZE[0],
        "frameHeight": BODY_SIZE[1],
        "placeholder": False,
        "single": True,
        "generated": RUN_ID,
        "source": str(SOURCE_ALPHA_PATH.relative_to(ROOT)).replace("\\", "/")
        if SOURCE_ALPHA_PATH.exists()
        else "procedural fallback",
        "rawSource": str(SOURCE_RAW_PATH.relative_to(ROOT)).replace("\\", "/")
        if SOURCE_RAW_PATH.exists()
        else None,
        "postprocess": "chroma-key alpha removal, subject fit to 384x256, launch bay alpha validation",
        "nativeHollowDesign": True,
        "readabilityDesign": "3x2 U-shaped carrier body leaves the fifth lower-center cell transparent for the launch bay",
        "animations": {
            "idle": {
                "row": 0,
                "frames": 1,
                "fps": 1,
                "frameWidth": BODY_SIZE[0],
                "frameHeight": BODY_SIZE[1],
            }
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_preview(body, frame, affix_icon):
    preview = Image.new("RGBA", (900, 360), (18, 22, 28, 255))
    draw = ImageDraw.Draw(preview)
    draw.text((22, 20), "Carrier runtime assets - imagegen-painted source", fill=(232, 238, 244, 255))

    hp = Image.new("RGBA", BODY_SIZE, (12, 18, 28, 255))
    hp_draw = ImageDraw.Draw(hp)
    hp_draw.rectangle((0, 148, BODY_SIZE[0], BODY_SIZE[1]), fill=(45, 190, 220, 110))
    hp.alpha_composite(body)
    preview.alpha_composite(hp, (28, 58))
    draw.rectangle((28, 58, 28 + BODY_SIZE[0], 58 + BODY_SIZE[1]), outline=(83, 96, 112, 255))
    draw.text((28, 322), "body sprite: painted obsidian carrier, launch bay transparent", fill=(203, 213, 225, 255))

    frame_thumb = frame.resize((384, 256), Image.Resampling.LANCZOS)
    frame_tile = Image.new("RGBA", BODY_SIZE, (12, 18, 28, 255))
    frame_tile.alpha_composite(frame_thumb)
    preview.alpha_composite(frame_tile, (482, 58))
    draw.rectangle((482, 58, 482 + BODY_SIZE[0], 58 + BODY_SIZE[1]), outline=(83, 96, 112, 255))
    draw.text((482, 322), "collision frame: fifth cell stays hollow", fill=(203, 213, 225, 255))

    preview.alpha_composite(affix_icon.resize((96, 96), Image.Resampling.NEAREST), (438, 224))
    PREVIEW_TARGET.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(PREVIEW_TARGET, quality=92)


def main():
    body = generate_body()
    frame, frame_source = generate_frame(body)
    affix_icon = generate_affix_icon()

    for target in BODY_TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        body.save(target)
        print(f"wrote {target.relative_to(ROOT)}")

    for target in BODY_META_TARGETS:
        write_manifest(target)
        print(f"wrote {target.relative_to(ROOT)}")

    icon = body.resize((64, 43), Image.Resampling.LANCZOS)
    icon_canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    icon_canvas.alpha_composite(icon, (0, 10))
    for target in ICON_TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        icon_canvas.save(target)
        print(f"wrote {target.relative_to(ROOT)}")

    AFFIX_ICON_TARGET.parent.mkdir(parents=True, exist_ok=True)
    affix_icon.save(AFFIX_ICON_TARGET)
    print(f"wrote {AFFIX_ICON_TARGET.relative_to(ROOT)}")

    FRAME_TARGET.parent.mkdir(parents=True, exist_ok=True)
    frame.save(FRAME_TARGET)
    print(f"wrote {FRAME_TARGET.relative_to(ROOT)}")

    FRAME_SOURCE_TARGET.parent.mkdir(parents=True, exist_ok=True)
    frame_source.save(FRAME_SOURCE_TARGET)
    print(f"wrote {FRAME_SOURCE_TARGET.relative_to(ROOT)}")

    write_preview(body, frame, affix_icon)
    print(f"wrote {PREVIEW_TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
