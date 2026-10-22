#!/usr/bin/env python3
"""Self-contained tests for the pixel pipeline (synthetic inputs; no repo assets needed).

Run: python scripts/pixel_pipeline/tests/test_pipeline.py
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import check  # noqa: E402
import pixelize  # noqa: E402
import pp_common as pc  # noqa: E402
import run_all  # noqa: E402

PALETTE = pc.Palette(pc.DEFAULT_PALETTE)


def synth_key_image(path: Path, size=(512, 512), key=(0, 255, 0)):
    im = Image.new("RGB", size, key)
    d = ImageDraw.Draw(im)
    w, h = size
    d.ellipse([w * 0.12, h * 0.12, w * 0.88, h * 0.88], fill=(110, 100, 90))
    d.ellipse([w * 0.40, h * 0.40, w * 0.60, h * 0.60], fill=(240, 150, 60))
    d.rectangle([w * 0.2, h * 0.45, w * 0.3, h * 0.55], fill=(60, 150, 210))
    im.save(path)


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="pp_test_"))
        self.src = self.tmp / "src.png"
        synth_key_image(self.src)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _run(self, out, cls="enemy_1x1", **over):
        opts = run_all.default_opts(dict({"key_color": "#00ff00"}, **over))
        return pixelize.run_one(self.src, out, pc.parse_class(cls), PALETTE, opts, asset_id="a", log=lambda s: None)

    def test_palette_shape(self):
        self.assertGreaterEqual(len(PALETTE.rgb), 44)
        self.assertLessEqual(len(PALETTE.rgb), 50)
        self.assertNotIn((0, 255, 0), PALETTE.by_rgb)
        self.assertNotIn((255, 0, 255), PALETTE.by_rgb)
        bg = PALETTE.indices_for_layer("background", allow_outline_interior=True)
        self.assertNotIn(PALETTE.outline_index, bg)
        for i in bg:
            self.assertLessEqual(PALETTE.colors[i]["step"], 4 if PALETTE.colors[i]["group"] == "background" else 3)

    def test_classes(self):
        self.assertEqual((pc.parse_class("enemy_2x1").width, pc.parse_class("enemy_2x1").height), (48, 24))
        self.assertEqual(pc.parse_class("boss_3x3").width, 72)
        self.assertEqual(pc.parse_class("icon_16").height, 16)
        with self.assertRaises(ValueError):
            pc.parse_class("enemy_big")

    def test_output_passes_checks_and_is_deterministic(self):
        m1 = self._run(self.tmp / "o1")
        m2 = self._run(self.tmp / "o2")
        b1 = (self.tmp / "o1" / "a.png").read_bytes()
        b2 = (self.tmp / "o2" / "a.png").read_bytes()
        self.assertEqual(b1, b2, "rerun must be byte-identical")
        self.assertEqual((self.tmp / "o1" / "a.json").read_bytes(), (self.tmp / "o2" / "a.json").read_bytes())
        self.assertEqual(m1["output"]["sha256"], m2["output"]["sha256"])
        rep = check.run([self.tmp / "o1" / "a.png"], PALETTE)
        statuses = {c["check"]: c["status"] for c in rep["reports"][0]["results"]}
        for k in ("size", "alpha", "palette", "border", "fill", "overflow", "colors", "manifest"):
            self.assertEqual(statuses[k], "PASS", f"{k}: {rep['reports'][0]['results']}")
        self.assertTrue(m1["frame_rects"])

    def test_no_dither_below_32(self):
        m = self._run(self.tmp / "o", dither="bayer4")
        self.assertEqual(m["params"]["dither"], "none")
        self.assertIn("refused", m["params"]["dither_note"])
        m = self._run(self.tmp / "ob", cls="boss_2x2", dither="bayer4")
        self.assertEqual(m["params"]["dither"], "bayer4")

    def test_outline_and_border(self):
        self._run(self.tmp / "o")
        im = Image.open(self.tmp / "o" / "a.png").convert("RGBA")
        grid, unknown = pc.index_grid(im, PALETTE)
        self.assertFalse(unknown)
        W, H = im.size
        for y in range(H):
            for x in range(W):
                if grid[y][x] >= 0 and grid[y][x] != PALETTE.outline_index:
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        self.assertNotEqual(grid[ny][nx], -1, f"interior pixel {x},{y} touches transparency")

    def test_check_catches_violations(self):
        self._run(self.tmp / "o")
        p = self.tmp / "o" / "a.png"
        im = Image.open(p).convert("RGBA")
        im.putpixel((0, 0), (1, 2, 3, 255))      # border + off-palette
        im.putpixel((12, 12), (255, 255, 255, 128))  # semi alpha
        im.save(p)
        rep = check.run([p], PALETTE)
        st = {c["check"]: c["status"] for c in rep["reports"][0]["results"]}
        self.assertEqual(st["border"], "FAIL")
        self.assertEqual(st["palette"], "FAIL")
        self.assertEqual(st["alpha"], "FAIL")
        self.assertEqual(st["manifest"], "WARN")  # sha changed after pixelize
        self.assertEqual(rep["summary"]["fail"], 1)

    def test_missing_manifest_is_not_deliverable(self):
        self._run(self.tmp / "o")
        (self.tmp / "o" / "a.json").unlink()
        rep = check.run([self.tmp / "o" / "a.png"], PALETTE, cls_override="enemy_1x1")
        st = {c["check"]: c["status"] for c in rep["reports"][0]["results"]}
        self.assertEqual(st["manifest"], "FAIL")

    def test_run_all_drop_folder(self):
        drop = self.tmp / "minimax"
        drop.mkdir()
        shutil.copyfile(self.src, drop / "enemy_residue_1x1.png")
        out = self.tmp / "out"
        code = run_all.main(["--src", str(drop), "--out", str(out), "--only", "enemy_residue_1x1"])
        self.assertEqual(code, 0)
        rep = json.loads((out / "check_report.json").read_text(encoding="utf-8"))
        self.assertEqual(rep["summary"]["files"], 1)
        self.assertTrue((out / "contact_sheet.png").exists())

    def test_run_all_refuses_assets_dir(self):
        with self.assertRaises(SystemExit):
            run_all.main(["--src", str(self.tmp), "--out", str(pc.REPO_ROOT / "assets" / "x")])

    def test_catalog_consistency(self):
        cat = json.loads((pc.REPO_ROOT / "docs/art/pixel_pipeline/asset_catalog.json").read_text(encoding="utf-8"))
        ids = [a["id"] for a in cat["assets"]]
        self.assertEqual(len(ids), len(set(ids)))
        for a in cat["assets"]:
            pc.parse_class(a["class"])
            if "venom" in a["ramps"]:
                self.assertEqual(a["key_color"], "#FF00FF")
        md = (pc.REPO_ROOT / "docs/art/pixel_pipeline/minimax_prompt_pack.md").read_text(encoding="utf-8")
        for i in ids:
            self.assertIn(f"`{i}`", md)


if __name__ == "__main__":
    unittest.main(verbosity=2)
