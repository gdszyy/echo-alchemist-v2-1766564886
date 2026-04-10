#!/usr/bin/env python3
"""
Web Interaction GIF Recorder
=============================
Record a scripted browser interaction and export it as an animated GIF
with a visible cursor overlay and click-ripple effects.

Usage
-----
    python record_gif.py <scenario_file> [--output path/to/output.gif]

The scenario_file is a Python module that must expose:

    URL          : str   – page to load
    CLIP         : dict  – {"x", "y", "width", "height"} in page CSS pixels
    GIF_WIDTH    : int   – output GIF width in pixels (height auto-scaled)
    FPS          : int   – frames per second (default 15)
    VIEWPORT     : dict  – {"width", "height"} browser viewport
    DEVICE_SCALE : float – device pixel ratio (default 1.5)

    async def run(page, recorder) -> None
        Playwright page object + Recorder helper; call recorder methods to
        capture frames and annotate interactions.

Recorder API (available inside run())
--------------------------------------
    await recorder.snap()                    – capture one frame at current mouse pos
    await recorder.hold(n, fps_delay=None)   – capture n frames with optional delay
    await recorder.move(x, y, steps=12)      – animate mouse movement, capture each step
    await recorder.click(x, y, ripple_frames=8)
                                             – click + capture ripple animation frames
    recorder.set_mouse(x, y)                 – manually update tracked mouse position
"""

import asyncio
import importlib.util
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.async_api import async_playwright


# ─────────────────────────── cursor & ripple drawing ────────────────────────

def _draw_cursor(draw: ImageDraw.ImageDraw, cx: float, cy: float) -> None:
    """Draw a white arrow cursor with black outline at (cx, cy)."""
    pts_outer = [
        (cx,      cy),
        (cx,      cy + 22),
        (cx + 5.5, cy + 15.5),
        (cx + 11,  cy + 24),
        (cx + 14,  cy + 22.5),
        (cx + 8.5, cy + 14),
        (cx + 16.5, cy + 14),
    ]
    pts_inner = [
        (cx + 1,   cy + 2),
        (cx + 1,   cy + 20),
        (cx + 5.5, cy + 14.5),
        (cx + 10.5, cy + 22.5),
        (cx + 13,  cy + 21.5),
        (cx + 8,   cy + 13),
        (cx + 15.5, cy + 13),
    ]
    draw.polygon(pts_outer, fill=(0, 0, 0, 230))
    draw.polygon(pts_inner, fill=(255, 255, 255, 255))


def _draw_ripple(draw: ImageDraw.ImageDraw, cx: float, cy: float, progress: float) -> None:
    """Draw an expanding orange ripple ring at (cx, cy) with given progress (0–1)."""
    for ring_scale, alpha_base in [(1.0, 0.9), (0.6, 0.6)]:
        r = int(30 * ring_scale * progress)
        alpha = int(255 * alpha_base * (1 - progress))
        if r > 2 and alpha > 10:
            draw.ellipse(
                [cx - r, cy - r, cx + r, cy + r],
                outline=(255, 160, 0, alpha),
                width=3,
            )


def _composite_frame(
    raw_path: str,
    cx_physical: float,
    cy_physical: float,
    gif_width: int,
    click_progress: float | None,
    out_path: str,
) -> None:
    """Open a raw screenshot, overlay cursor (and optional ripple), save result.

    Parameters
    ----------
    cx_physical, cy_physical:
        Cursor position in **physical pixels** relative to the clip origin.
        (i.e. already multiplied by device_scale_factor)
    """
    img = Image.open(raw_path).convert("RGBA")
    orig_w, orig_h = img.size
    sf = gif_width / orig_w
    img = img.resize((gif_width, int(orig_h * sf)), Image.LANCZOS)

    # cx_physical is already in physical pixels, so sf maps it correctly to
    # the resized GIF coordinate space.
    cx = cx_physical * sf
    cy = cy_physical * sf

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if click_progress is not None:
        _draw_ripple(draw, cx, cy, click_progress)
    _draw_cursor(draw, cx, cy)

    Image.alpha_composite(img, overlay).convert("RGB").save(out_path, optimize=False)


# ─────────────────────────── Recorder helper ────────────────────────────────

class Recorder:
    """Stateful helper passed to the scenario's run() coroutine."""

    def __init__(self, page, clip: dict, gif_width: int, fps: int,
                 frames_dir: Path, device_scale: float = 1.0):
        self._page = page
        self._clip = clip
        self._gif_width = gif_width
        self._fps_delay = 1.0 / fps
        self._frames_dir = frames_dir
        self._device_scale = device_scale
        self._frames: list[tuple[str, float, float, float | None]] = []
        self._idx = 0
        self._mx: float = 0.0
        self._my: float = 0.0

    # ── public API ──────────────────────────────────────────────────────────

    def set_mouse(self, x: float, y: float) -> None:
        self._mx, self._my = x, y

    async def snap(self, click_progress: float | None = None) -> None:
        raw = self._frames_dir / f"raw_{self._idx:04d}.png"
        await self._page.screenshot(path=str(raw), clip=self._clip)
        # Convert CSS-pixel offset to physical pixels so that _composite_frame
        # can directly apply the single scale factor (gif_width / orig_w).
        cx = (self._mx - self._clip["x"]) * self._device_scale
        cy = (self._my - self._clip["y"]) * self._device_scale
        self._frames.append((str(raw), cx, cy, click_progress))
        self._idx += 1

    async def hold(self, n: int, fps_delay: float | None = None) -> None:
        delay = fps_delay if fps_delay is not None else self._fps_delay
        for _ in range(n):
            await self.snap()
            await asyncio.sleep(delay)

    async def move(self, tx: float, ty: float, steps: int = 12, fps_delay: float | None = None) -> None:
        delay = fps_delay if fps_delay is not None else self._fps_delay
        sx, sy = self._mx, self._my
        for i in range(1, steps + 1):
            nx = sx + (tx - sx) * i / steps
            ny = sy + (ty - sy) * i / steps
            await self._page.mouse.move(nx, ny)
            self._mx, self._my = nx, ny
            await asyncio.sleep(delay)
            await self.snap()

    async def click(self, x: float, y: float, ripple_frames: int = 8) -> None:
        await self._page.mouse.click(x, y)
        self._mx, self._my = x, y
        for i in range(ripple_frames):
            progress = (i + 1) / ripple_frames
            await asyncio.sleep(0.045)
            await self.snap(click_progress=progress)

    # ── internal ────────────────────────────────────────────────────────────

    def get_frames(self):
        return self._frames


# ─────────────────────────── GIF assembly ───────────────────────────────────

def _process_frames(frames, gif_width: int, proc_dir: Path) -> None:
    print(f"  Compositing {len(frames)} frames …", flush=True)
    for i, (raw, cx, cy, cp) in enumerate(frames):
        out = str(proc_dir / f"frame_{i:04d}.png")
        _composite_frame(raw, cx, cy, gif_width, cp, out)


def _build_gif(proc_dir: Path, fps: int, output_path: str) -> None:
    print("  Building GIF with ffmpeg …", flush=True)
    pal = str(proc_dir.parent / "palette.png")

    r = subprocess.run(
        ["ffmpeg", "-y", "-framerate", str(fps),
         "-i", str(proc_dir / "frame_%04d.png"),
         "-vf", "palettegen=stats_mode=diff", pal],
        capture_output=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"palettegen failed:\n{r.stderr.decode()[-400:]}")

    r = subprocess.run(
        ["ffmpeg", "-y", "-framerate", str(fps),
         "-i", str(proc_dir / "frame_%04d.png"),
         "-i", pal,
         "-lavfi", "[0:v][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
         output_path],
        capture_output=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"GIF assembly failed:\n{r.stderr.decode()[-400:]}")

    os.remove(pal)
    mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"  ✅ GIF saved → {output_path}  ({mb:.1f} MB, {len(list(proc_dir.glob('frame_*.png')))} frames)")


# ─────────────────────────── main entry point ───────────────────────────────

async def _run_scenario(scenario_path: str, output_path: str) -> None:
    # Load scenario module
    spec = importlib.util.spec_from_file_location("scenario", scenario_path)
    scenario = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scenario)

    url: str = scenario.URL
    clip: dict = scenario.CLIP
    gif_width: int = getattr(scenario, "GIF_WIDTH", 680)
    fps: int = getattr(scenario, "FPS", 15)
    viewport: dict = getattr(scenario, "VIEWPORT", {"width": 1400, "height": 800})
    device_scale: float = getattr(scenario, "DEVICE_SCALE", 1.5)

    # Temp directories
    work_dir = Path(output_path).parent / "_gif_work"
    frames_dir = work_dir / "raw"
    proc_dir = work_dir / "processed"
    frames_dir.mkdir(parents=True, exist_ok=True)
    proc_dir.mkdir(parents=True, exist_ok=True)

    print(f"▶ Loading {url} …", flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=viewport, device_scale_factor=device_scale)
        page = await ctx.new_page()
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(1.0)

        # Pass device_scale to Recorder so it can convert CSS→physical pixels
        recorder = Recorder(page, clip, gif_width, fps, frames_dir,
                            device_scale=device_scale)
        print("▶ Running scenario …", flush=True)
        await scenario.run(page, recorder)
        await browser.close()

    frames = recorder.get_frames()
    print(f"▶ Recorded {len(frames)} frames", flush=True)

    _process_frames(frames, gif_width, proc_dir)
    _build_gif(proc_dir, fps, output_path)

    # Cleanup
    import shutil
    shutil.rmtree(work_dir)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Record a web interaction as GIF")
    parser.add_argument("scenario", help="Path to scenario Python file")
    parser.add_argument("--output", "-o", default="interaction.gif", help="Output GIF path")
    args = parser.parse_args()
    asyncio.run(_run_scenario(args.scenario, args.output))


if __name__ == "__main__":
    main()
