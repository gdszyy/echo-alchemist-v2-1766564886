import json
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
CONCEPT_DIR = ROOT / "docs/design/concepts/enemy_exact_composites_pass1"
COMPOSITE_DIR = ROOT / "assets/sprites/enemies/composites"
PREVIEW_PATH = ROOT / "docs/design/enemy_exact_composites_pass1_preview.png"

RUN_ID = "imagegen_exact_composites_pass1_2026_06_27"

ASSETS = [
    {
        "key": "prism:1x3:prism",
        "base": "prism",
        "affixes": ["prism"],
        "resource_id": "enemy_prism_prism_1x3_imagegen_pass1",
        "source": CONCEPT_DIR / "prism_alpha.png",
        "raw": CONCEPT_DIR / "prism_raw.png",
        "target_png": COMPOSITE_DIR / "enemy_prism_prism_1x3_imagegen_pass1_idle.png",
        "target_json": COMPOSITE_DIR / "enemy_prism_prism_1x3_imagegen_pass1_idle.json",
        "frame_size": 128,
        "size": (128, 384),
        "source_label": "prism exact composite",
        "readability": "tall 1x3 prism keeps a carved refraction line and dark stone silhouette",
    },
    {
        "key": "hive:2x3:hive",
        "base": "hive",
        "affixes": ["hive"],
        "resource_id": "enemy_hive_hive_2x3_imagegen_pass1",
        "source": CONCEPT_DIR / "hive_alpha.png",
        "raw": CONCEPT_DIR / "hive_raw.png",
        "target_png": COMPOSITE_DIR / "enemy_hive_hive_2x3_imagegen_pass1_idle.png",
        "target_json": COMPOSITE_DIR / "enemy_hive_hive_2x3_imagegen_pass1_idle.json",
        "frame_size": 384,
        "size": (256, 384),
        "source_label": "hive exact composite",
        "readability": "2x3 hive uses native chamber gaps and embedded alchemical egg pods",
    },
    {
        "key": "gravityWell:3x3:gravityWell",
        "base": "gravityWell",
        "affixes": ["gravityWell"],
        "resource_id": "enemy_gravity_well_gravitywell_3x3_imagegen_pass1",
        "source": CONCEPT_DIR / "gravity_well_alpha.png",
        "raw": CONCEPT_DIR / "gravity_well_raw.png",
        "target_png": COMPOSITE_DIR / "enemy_gravity_well_gravitywell_3x3_imagegen_pass1_idle.png",
        "target_json": COMPOSITE_DIR / "enemy_gravity_well_gravitywell_3x3_imagegen_pass1_idle.json",
        "frame_size": 384,
        "size": (384, 384),
        "source_label": "gravityWell exact composite",
        "readability": "3x3 gravity core preserves concentric ring gaps and a central black core",
    },
]


def fit_alpha_subject(source_path, target_size):
    image = Image.open(source_path).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"source has no visible pixels: {source_path}")

    crop = image.crop(bbox)
    max_w = int(target_size[0] * 0.92)
    max_h = int(target_size[1] * 0.92)
    scale = min(max_w / crop.width, max_h / crop.height)
    fitted_size = (
        max(1, round(crop.width * scale)),
        max(1, round(crop.height * scale)),
    )
    crop = crop.resize(fitted_size, Image.Resampling.LANCZOS)
    crop = ImageEnhance.Contrast(crop).enhance(1.04)
    crop = ImageEnhance.Sharpness(crop).enhance(1.12)

    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    offset = (
        (target_size[0] - fitted_size[0]) // 2,
        (target_size[1] - fitted_size[1]) // 2,
    )
    canvas.alpha_composite(crop, offset)
    return canvas


def write_sprite_manifest(asset):
    width, height = asset["size"]
    data = {
        "frameSize": asset["frame_size"],
        "frameWidth": width,
        "frameHeight": height,
        "placeholder": False,
        "single": True,
        "generated": RUN_ID,
        "sourceConcept": str(asset["source"].relative_to(ROOT)).replace("\\", "/"),
        "rawSource": str(asset["raw"].relative_to(ROOT)).replace("\\", "/"),
        "sourceConceptLabel": asset["source_label"],
        "postprocess": "built-in imagegen chroma-key source, alpha removal, fitted to runtime footprint",
        "nativeHollowDesign": True,
        "readabilityDesign": asset["readability"],
        "animations": {
            "idle": {
                "row": 0,
                "frames": 1,
                "fps": 1,
                "frameWidth": width,
                "frameHeight": height,
            }
        },
    }
    asset["target_json"].write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_preview(rendered):
    thumb_w = 220
    preview = Image.new("RGBA", (900, 360), (17, 22, 30, 255))

    x = 36
    for asset, image in rendered:
        tile = Image.new("RGBA", (thumb_w, 280), (12, 18, 26, 255))
        scale = min((thumb_w - 32) / image.width, 222 / image.height)
        size = (round(image.width * scale), round(image.height * scale))
        thumb = image.resize(size, Image.Resampling.LANCZOS)
        tile.alpha_composite(thumb, ((thumb_w - size[0]) // 2, 18 + (222 - size[1]) // 2))
        preview.alpha_composite(tile, (x, 42))
        x += thumb_w + 42

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(PREVIEW_PATH, quality=92)


def main():
    rendered = []
    COMPOSITE_DIR.mkdir(parents=True, exist_ok=True)

    for asset in ASSETS:
        body = fit_alpha_subject(asset["source"], asset["size"])
        body.save(asset["target_png"])
        write_sprite_manifest(asset)
        rendered.append((asset, body))
        print(f"wrote {asset['target_png'].relative_to(ROOT)}")
        print(f"wrote {asset['target_json'].relative_to(ROOT)}")

    write_preview(rendered)
    print(f"wrote {PREVIEW_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
