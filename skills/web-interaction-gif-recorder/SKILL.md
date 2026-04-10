---
name: web-interaction-gif-recorder
description: "Record scripted browser interactions as animated GIFs with a visible cursor overlay and click-ripple effects. Use this skill when asked to: record web UI interactions as GIF, create interaction demos for documentation, capture click/hover/scroll flows on a deployed website, or produce annotated screen recordings showing mouse movement and click feedback."
---

# Web Interaction GIF Recorder

Produces animated GIFs from scripted Playwright browser sessions. Each frame is composited with a white arrow cursor and optional orange click-ripple effects before being assembled by ffmpeg.

## Quick Start

### 1. Install dependencies (first time only)

```bash
bash /home/ubuntu/skills/web-interaction-gif-recorder/scripts/ensure_deps.sh
```

### 2. Write a scenario file

Copy `templates/scenario_example.py` and implement the `run()` coroutine. Required top-level variables:

| Variable | Type | Description |
|---|---|---|
| `URL` | str | Page to load |
| `CLIP` | dict | `{"x", "y", "width", "height"}` in CSS pixels |
| `GIF_WIDTH` | int | Output width in pixels (default 680) |
| `FPS` | int | Frames per second (default 15) |
| `VIEWPORT` | dict | `{"width", "height"}` (default 1400×800) |
| `DEVICE_SCALE` | float | Device pixel ratio for sharpness (default 1.5) |

### 3. Run the recorder

```bash
python3 /home/ubuntu/skills/web-interaction-gif-recorder/scripts/record_gif.py \
    my_scenario.py --output output.gif
```

## Recorder API

Inside `run(page, recorder)`:

```python
recorder.set_mouse(x, y)                     # set initial cursor position (no capture)
await recorder.hold(n)                        # capture n frames at current position
await recorder.move(x, y, steps=12)          # animate cursor movement, capture each step
await recorder.click(x, y, ripple_frames=8)  # click + capture expanding ripple
await recorder.snap()                         # capture a single frame (rarely needed directly)
```

All coordinates are **page CSS pixels** (not clip-relative, not scaled).

## Workflow for Documenting a Web Project

1. Visit the deployed site in the browser to identify interaction regions.
2. Use browser DevTools or Playwright's `page.locator().bounding_box()` to get exact element coordinates.
3. Set `CLIP` to frame the relevant UI area with ~200 px margin on the side where popovers appear.
4. Write one scenario file per interaction flow.
5. Run the recorder and verify key frames before embedding in docs.

## Coordinate Debugging

If the cursor appears in the wrong position, add a debug screenshot inside `run()`:

```python
await page.screenshot(path="/tmp/debug.png")
bbox = await page.locator(".my-element").bounding_box()
print(bbox)  # {"x": ..., "y": ..., "width": ..., "height": ...}
```

The cursor hot-point is the **top-left corner** of the arrow glyph.

## Tips

- **Popover / tooltip interactions**: Move the cursor slowly (`steps=15–20`) to give CSS transitions time to render before capturing.
- **Hover delays**: If the UI has a built-in hover delay, insert `await asyncio.sleep(0.3)` before `recorder.hold()`.
- **File size**: 15 fps × ~10 s ≈ 150 frames ≈ 0.2–0.5 MB at 680 px wide. Reduce `FPS` to 10 or `GIF_WIDTH` to 480 to shrink further.
- **Loop**: GIFs loop infinitely by default. End the scenario on a stable "result" state so the loop transition looks natural.

## Scenario Template

See `templates/scenario_example.py` for a minimal annotated starting point.
