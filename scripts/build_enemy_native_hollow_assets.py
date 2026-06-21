import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


SOURCE = Path("docs/design/concepts/enemy_native_hollow_concept_2026-06-21.png")
RUN_ID = "native_hollow_concept_2026_06_21"


ASSETS = [
    {
        "label": "residue",
        "crop": (58, 42, 560, 565),
        "size": (256, 256),
        "targets": [
            (
                Path("assets/sprites/enemies/composites/enemy_residue_1x1_native_hollow_idle.png"),
                Path("assets/sprites/enemies/composites/enemy_residue_1x1_native_hollow_idle.json"),
                Path("assets/sprites/enemies/composites/enemy_residue_1x1_idle.json"),
            ),
        ],
    },
    {
        "label": "maw",
        "crop": (638, 40, 1210, 585),
        "size": (256, 256),
        "targets": [
            (
                Path("assets/sprites/enemies/archetypes/enemy_maw_2x2_native_hollow.png"),
                Path("assets/sprites/enemies/archetypes/enemy_maw_2x2_native_hollow.json"),
                Path("assets/sprites/enemies/archetypes/enemy_maw_2x2.json"),
            ),
            (
                Path("assets/sprites/enemies/composites/enemy_maw_devour_2x2_native_hollow_idle.png"),
                Path("assets/sprites/enemies/composites/enemy_maw_devour_2x2_native_hollow_idle.json"),
                Path("assets/sprites/enemies/composites/enemy_maw_devour_2x2_idle.json"),
            ),
        ],
    },
    {
        "label": "siege",
        "crop": (42, 662, 625, 1216),
        "size": (384, 256),
        "targets": [
            (
                Path("assets/sprites/enemies/archetypes/enemy_siege_3x2_native_hollow.png"),
                Path("assets/sprites/enemies/archetypes/enemy_siege_3x2_native_hollow.json"),
                Path("assets/sprites/enemies/archetypes/enemy_siege_3x2.json"),
            ),
            (
                Path("assets/sprites/enemies/composites/enemy_siege_siege_3x2_native_hollow_idle.png"),
                Path("assets/sprites/enemies/composites/enemy_siege_siege_3x2_native_hollow_idle.json"),
                Path("assets/sprites/enemies/composites/enemy_siege_siege_3x2_idle.json"),
            ),
        ],
    },
    {
        "label": "hive",
        "crop": (706, 614, 1192, 1228),
        "size": (256, 384),
        "targets": [
            (
                Path("assets/sprites/enemies/archetypes/enemy_hive_2x3_native_hollow.png"),
                Path("assets/sprites/enemies/archetypes/enemy_hive_2x3_native_hollow.json"),
                Path("assets/sprites/enemies/archetypes/enemy_hive_2x3.json"),
            ),
        ],
    },
]


def _pixel_stats(rgb):
    r, g, b = rgb
    mx = max(rgb)
    mn = min(rgb)
    return mx, mx - mn, (r + g + b) / 3


def _is_background_like(rgb):
    mx, sat, lum = _pixel_stats(rgb)
    return (mx <= 31 and sat <= 12) or (mx <= 43 and sat <= 7 and lum <= 34)


def _build_alpha(crop):
    rgb = crop.convert("RGB")
    w, h = rgb.size
    pixels = rgb.load()
    flood = Image.new("L", (w, h), 0)
    flood_px = flood.load()
    q = deque()

    def enqueue(x, y):
        if x < 0 or y < 0 or x >= w or y >= h or flood_px[x, y]:
            return
        if _is_background_like(pixels[x, y]):
            flood_px[x, y] = 255
            q.append((x, y))

    for x in range(w):
        enqueue(x, 0)
        enqueue(x, h - 1)
    for y in range(h):
        enqueue(0, y)
        enqueue(w - 1, y)

    while q:
        x, y = q.popleft()
        enqueue(x + 1, y)
        enqueue(x - 1, y)
        enqueue(x, y + 1)
        enqueue(x, y - 1)

    alpha = Image.new("L", (w, h), 255)
    alpha_px = alpha.load()
    for y in range(h):
        for x in range(w):
            rgbv = pixels[x, y]
            mx, sat, lum = _pixel_stats(rgbv)
            bg = flood_px[x, y] > 0
            # Closed hollow cells use the same near-black background as the board.
            if bg or (mx <= 28 and sat <= 14) or (mx <= 40 and sat <= 8 and lum <= 34):
                alpha_px[x, y] = 0
    return alpha


def _extract(asset, source):
    crop = source.crop(asset["crop"]).convert("RGBA")
    alpha = _build_alpha(crop)
    crop.putalpha(alpha)

    bbox = crop.getbbox()
    if bbox:
        crop = crop.crop(bbox)

    target_w, target_h = asset["size"]
    pad = 18 if target_w == target_h else 14
    scale = min((target_w - pad * 2) / crop.width, (target_h - pad * 2) / crop.height)
    scaled = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    out.alpha_composite(scaled, ((target_w - scaled.width) // 2, (target_h - scaled.height) // 2))
    _harden_alpha(out)
    return out


def _harden_alpha(img):
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a >= 72:
                pixels[x, y] = (r, g, b, 255)
            elif a <= 28:
                pixels[x, y] = (r, g, b, 0)
            else:
                pixels[x, y] = (r, g, b, int(a * 1.35))


def _write_meta(target_json, source_json, target_size, label):
    data = json.loads(source_json.read_text(encoding="utf-8"))
    data["generated"] = RUN_ID
    data["sourceConcept"] = SOURCE.as_posix()
    data["sourceConceptLabel"] = label
    data["nativeHollowDesign"] = True
    data["readabilityDesign"] = "body is built from native hollow structures so runtime HP liquid can show through"
    data["frameSize"] = target_size[0] if target_size[0] == target_size[1] else max(target_size)
    data["frameWidth"] = target_size[0]
    data["frameHeight"] = target_size[1]
    for anim in data.get("animations", {}).values():
        anim["frameWidth"] = target_size[0]
        anim["frameHeight"] = target_size[1]
    target_json.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _coverage(path):
    img = Image.open(path).convert("RGBA")
    a = img.getchannel("A").load()
    w, h = img.size
    boxes = {
        "all": (0, 0, w, h),
        "bottom": (0, int(h * 0.65), w, h),
        "center": (int(w * 0.25), int(h * 0.25), int(w * 0.75), int(h * 0.75)),
    }
    out = {}
    for name, (x0, y0, x1, y1) in boxes.items():
        total = (x1 - x0) * (y1 - y0)
        solid = 0
        for y in range(y0, y1):
            for x in range(x0, x1):
                if a[x, y] > 20:
                    solid += 1
        out[name] = solid / total if total else 0
    return out


def _make_preview(generated):
    tile_w, tile_h = 230, 230
    preview = Image.new("RGBA", (tile_w * 4 + 50, tile_h + 74), (18, 22, 28, 255))
    draw = ImageDraw.Draw(preview)
    draw.text((18, 14), "Native hollow runtime sprites over simulated HP liquid", fill=(232, 238, 244, 255))
    for i, (label, png) in enumerate(generated):
        x = 18 + i * tile_w
        y = 44
        tile = Image.new("RGBA", (tile_w - 18, tile_h - 32), (28, 34, 42, 255))
        hp = Image.new("RGBA", (tile.width - 28, tile.height - 28), (49, 190, 230, 88))
        hp_draw = ImageDraw.Draw(hp)
        hp_draw.rectangle((0, int(hp.height * 0.58), hp.width, hp.height), fill=(83, 236, 255, 154))
        tile.alpha_composite(hp, (14, 14))
        im = Image.open(png).convert("RGBA")
        scale = min((tile.width - 20) / im.width, (tile.height - 20) / im.height)
        scaled = im.resize((int(im.width * scale), int(im.height * scale)), Image.Resampling.LANCZOS)
        tile.alpha_composite(scaled, ((tile.width - scaled.width) // 2, (tile.height - scaled.height) // 2))
        preview.alpha_composite(tile, (x, y))
        draw.rectangle((x, y, x + tile.width, y + tile.height), outline=(83, 96, 112, 255))
        cov = _coverage(png)
        draw.text((x, y + tile.height + 8), f"{label} btm {cov['bottom']:.2f} ctr {cov['center']:.2f}", fill=(230, 211, 150, 255))

    out = Path("docs/screenshots/enemy-native-hollow-runtime-preview.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(out, quality=92)
    return out


def main():
    source = Image.open(SOURCE)
    generated = []
    for asset in ASSETS:
        image = _extract(asset, source)
        for png, meta, meta_source in asset["targets"]:
            png.parent.mkdir(parents=True, exist_ok=True)
            image.save(png)
            _write_meta(meta, meta_source, asset["size"], asset["label"])
            generated.append((asset["label"], png))
            cov = _coverage(png)
            print(f"{asset['label']}: {png} bottom={cov['bottom']:.3f} center={cov['center']:.3f}")
    first_by_label = []
    seen = set()
    for item in generated:
        if item[0] in seen:
            continue
        seen.add(item[0])
        first_by_label.append(item)
    preview = _make_preview(first_by_label)
    print(f"preview: {preview}")


if __name__ == "__main__":
    main()
