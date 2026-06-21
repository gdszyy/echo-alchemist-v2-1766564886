import json
from pathlib import Path

from PIL import Image


ATLAS_PATH = Path("docs/screenshots/enemy-layer-debug-2026-06-21/enemy_frontview_atlas_generated.png")

OUTPUTS = [
    {
        "label": "residue",
        "src_cell": (0, 0),
        "png": Path("assets/sprites/enemies/composites/enemy_residue_1x1_idle.png"),
        "json": Path("assets/sprites/enemies/composites/enemy_residue_1x1_idle.json"),
        "frame": (256, 256),
    },
    {
        "label": "bastion",
        "src_cell": (1, 0),
        "png": Path("assets/sprites/enemies/archetypes/enemy_bastion_3x1.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_bastion_3x1.json"),
        "frame": (384, 128),
    },
    {
        "label": "bastion_v2",
        "src_cell": (1, 0),
        "png": Path("assets/sprites/enemies/v2/enemy_bastion_3x1.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_bastion_3x1.json"),
        "frame": (384, 128),
    },
    {
        "label": "bastion_composite",
        "src_cell": (1, 0),
        "png": Path("assets/sprites/enemies/composites/enemy_bastion_heavyarmor_3x1_idle.png"),
        "json": Path("assets/sprites/enemies/composites/enemy_bastion_heavyarmor_3x1_idle.json"),
        "frame": (384, 128),
    },
    {
        "label": "maw",
        "src_cell": (2, 0),
        "png": Path("assets/sprites/enemies/archetypes/enemy_maw_2x2.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_maw_2x2.json"),
        "frame": (256, 256),
    },
    {
        "label": "maw_v2",
        "src_cell": (2, 0),
        "png": Path("assets/sprites/enemies/v2/enemy_maw_2x2.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_maw_2x2.json"),
        "frame": (256, 256),
    },
    {
        "label": "maw_composite",
        "src_cell": (2, 0),
        "png": Path("assets/sprites/enemies/composites/enemy_maw_devour_2x2_idle.png"),
        "json": Path("assets/sprites/enemies/composites/enemy_maw_devour_2x2_idle.json"),
        "frame": (256, 256),
    },
    {
        "label": "deflector",
        "src_cell": (0, 1),
        "png": Path("assets/sprites/enemies/archetypes/enemy_deflector_2x1.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_deflector_2x1.json"),
        "frame": (256, 128),
    },
    {
        "label": "deflector_v2",
        "src_cell": (0, 1),
        "png": Path("assets/sprites/enemies/v2/enemy_deflector_2x1.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_deflector_2x1.json"),
        "frame": (256, 128),
    },
    {
        "label": "deflector_composite",
        "src_cell": (0, 1),
        "png": Path("assets/sprites/enemies/composites/enemy_ward_deflection_2x1_idle.png"),
        "json": Path("assets/sprites/enemies/composites/enemy_ward_deflection_2x1_idle.json"),
        "frame": (256, 128),
    },
    {
        "label": "echo_spire",
        "src_cell": (1, 1),
        "png": Path("assets/sprites/enemies/archetypes/enemy_echo_spire_1x2.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_echo_spire_1x2.json"),
        "frame": (128, 256),
    },
    {
        "label": "echo_spire_v2",
        "src_cell": (1, 1),
        "png": Path("assets/sprites/enemies/v2/enemy_echo_spire_1x2.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_echo_spire_1x2.json"),
        "frame": (128, 256),
    },
    {
        "label": "echo_spire_composite",
        "src_cell": (1, 1),
        "png": Path("assets/sprites/enemies/composites/enemy_spire_echorelay_1x2_idle.png"),
        "json": Path("assets/sprites/enemies/composites/enemy_spire_echorelay_1x2_idle.json"),
        "frame": (128, 256),
    },
    {
        "label": "prism",
        "src_cell": (2, 1),
        "png": Path("assets/sprites/enemies/archetypes/enemy_prism_1x3.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_prism_1x3.json"),
        "frame": (128, 384),
    },
    {
        "label": "prism_v2",
        "src_cell": (2, 1),
        "png": Path("assets/sprites/enemies/v2/enemy_prism_1x3.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_prism_1x3.json"),
        "frame": (128, 384),
    },
    {
        "label": "hive",
        "src_cell": (0, 2),
        "png": Path("assets/sprites/enemies/archetypes/enemy_hive_2x3.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_hive_2x3.json"),
        "frame": (256, 384),
    },
    {
        "label": "hive_v2",
        "src_cell": (0, 2),
        "png": Path("assets/sprites/enemies/v2/enemy_hive_2x3.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_hive_2x3.json"),
        "frame": (256, 384),
    },
    {
        "label": "siege",
        "src_cell": (1, 2),
        "png": Path("assets/sprites/enemies/archetypes/enemy_siege_3x2.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_siege_3x2.json"),
        "frame": (384, 256),
    },
    {
        "label": "siege_v2",
        "src_cell": (1, 2),
        "png": Path("assets/sprites/enemies/v2/enemy_siege_3x2.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_siege_3x2.json"),
        "frame": (384, 256),
    },
    {
        "label": "siege_composite",
        "src_cell": (1, 2),
        "png": Path("assets/sprites/enemies/composites/enemy_siege_siege_3x2_idle.png"),
        "json": Path("assets/sprites/enemies/composites/enemy_siege_siege_3x2_idle.json"),
        "frame": (384, 256),
    },
    {
        "label": "gravity",
        "src_cell": (2, 2),
        "png": Path("assets/sprites/enemies/archetypes/enemy_gravity_core_3x3.png"),
        "json": Path("assets/sprites/enemies/archetypes/enemy_gravity_core_3x3.json"),
        "frame": (384, 384),
    },
    {
        "label": "gravity_v2",
        "src_cell": (2, 2),
        "png": Path("assets/sprites/enemies/v2/enemy_gravity_core_3x3.png"),
        "json": Path("assets/sprites/enemies/v2/enemy_gravity_core_3x3.json"),
        "frame": (384, 384),
    },
]


def remove_green(img):
    img = img.convert("RGBA")
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            green_delta = g - max(r, b)
            if g > 150 and green_delta > 45:
                pixels[x, y] = (r, g, b, 0)
    return img


def alpha_bbox(img, threshold=8):
    alpha = img.getchannel("A")
    return alpha.point(lambda p: 255 if p > threshold else 0).getbbox()


def keep_largest_alpha_component(img, threshold=8):
    img = img.convert("RGBA")
    alpha = img.getchannel("A")
    width, height = img.size
    visited = bytearray(width * height)
    pixels = alpha.load()
    components = []

    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if visited[idx] or pixels[x, y] <= threshold:
                continue

            stack = [(x, y)]
            visited[idx] = 1
            points = []
            while stack:
                px, py = stack.pop()
                points.append((px, py))
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nidx = ny * width + nx
                    if visited[nidx] or pixels[nx, ny] <= threshold:
                        continue
                    visited[nidx] = 1
                    stack.append((nx, ny))
            components.append(points)

    if not components:
        return img

    keep = set(max(components, key=len))
    out = img.copy()
    out_pixels = out.load()
    for y in range(height):
        for x in range(width):
            if out_pixels[x, y][3] > threshold and (x, y) not in keep:
                r, g, b, _ = out_pixels[x, y]
                out_pixels[x, y] = (r, g, b, 0)
    return out


def fit_into_frame(subject, frame_size):
    frame_w, frame_h = frame_size
    bbox = alpha_bbox(subject)
    if not bbox:
        return Image.new("RGBA", frame_size, (0, 0, 0, 0))

    subject = subject.crop(bbox)
    pad = max(12, round(min(frame_w, frame_h) * 0.08))
    max_w = frame_w - pad * 2
    max_h = frame_h - pad * 2
    scale = min(max_w / subject.width, max_h / subject.height)
    new_size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(new_size, Image.Resampling.LANCZOS)

    out = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    out.alpha_composite(subject, ((frame_w - new_size[0]) // 2, (frame_h - new_size[1]) // 2))
    clean_key_fringe(out)
    return out


def clean_key_fringe(img):
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            green_delta = g - max(r, b)
            if a <= 4:
                pixels[x, y] = (r, g, b, 0)
            elif a <= 128 and g > 145 and green_delta > 35:
                pixels[x, y] = (r, g, b, 0)


def despill_non_hive_green(img):
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 0 and g > 145 and g - max(r, b) > 35:
                pixels[x, y] = (r, min(g, max(r, b) + 20), b, a)


def write_manifest(path, frame_size, label):
    frame_w, frame_h = frame_size
    manifest = {
        "frameSize": min(frame_w, frame_h),
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "placeholder": False,
        "single": True,
        "generated": "imagegen_frontview_atlas_2026_06_21",
        "sourceAtlas": str(ATLAS_PATH).replace("\\", "/"),
        "sourceCellLabel": label,
        "animations": {
            "idle": {
                "row": 0,
                "frames": 1,
                "fps": 1,
                "frameWidth": frame_w,
                "frameHeight": frame_h,
            }
        },
    }
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    atlas = Image.open(ATLAS_PATH).convert("RGBA")
    cell_w = atlas.width // 3
    cell_h = atlas.height // 3

    for spec in OUTPUTS:
        cx, cy = spec["src_cell"]
        crop = atlas.crop((cx * cell_w, cy * cell_h, (cx + 1) * cell_w, (cy + 1) * cell_h))
        transparent = remove_green(crop)
        transparent = keep_largest_alpha_component(transparent)
        frame = fit_into_frame(transparent, spec["frame"])
        if not spec["label"].startswith("hive"):
            despill_non_hive_green(frame)
        spec["png"].parent.mkdir(parents=True, exist_ok=True)
        spec["json"].parent.mkdir(parents=True, exist_ok=True)
        frame.save(spec["png"])
        write_manifest(spec["json"], spec["frame"], spec["label"])
        print(f"{spec['label']}: {spec['png']} {spec['frame'][0]}x{spec['frame'][1]}")


if __name__ == "__main__":
    main()
