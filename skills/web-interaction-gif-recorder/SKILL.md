---
name: web-interaction-gif-recorder
description: "Record scripted browser interactions as animated GIFs with a visible cursor overlay and click-ripple effects. Use this skill when asked to: record web UI interactions as GIF, create interaction demos for documentation, capture click/hover/scroll flows on a deployed website, or produce annotated screen recordings showing mouse movement and click feedback."
---

# Web Interaction GIF Recorder

Produces animated GIFs from scripted Playwright browser sessions. Each frame is composited with a white arrow cursor and optional orange click-ripple effects before being assembled by ffmpeg.

## Workflow

1. Install dependencies (first time only)
2. Copy the scenario template and implement `run()`
3. Run the recorder

### 1. Install dependencies

```bash
bash /home/ubuntu/skills/web-interaction-gif-recorder/scripts/ensure_deps.sh
```

### 2. Write a scenario file

Copy `templates/scenario_example.py`. Required top-level variables:

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

All coordinates are **page CSS pixels** (not clip-relative, not scaled). The recorder converts them to physical pixels internally.

```python
recorder.set_mouse(x, y)                     # set initial cursor position (no capture)
await recorder.hold(n)                        # capture n frames at current position
await recorder.move(x, y, steps=12)          # animate cursor movement, capture each step
await recorder.click(x, y, ripple_frames=8)  # click + capture expanding ripple
await recorder.snap()                         # capture a single frame (rarely needed directly)
```

## Coordinate Debugging

If the cursor appears in the wrong position:

```python
await page.screenshot(path="/tmp/debug.png")
bbox = await page.locator(".my-element").bounding_box()
print(bbox)  # {"x": ..., "y": ..., "width": ..., "height": ...}
```

The cursor hot-point is the **top-left corner** of the arrow glyph. Coordinates from `bounding_box()` are CSS pixels and can be passed directly to `recorder.move()` / `recorder.click()`.

## Tips

- **Popover / tooltip interactions**: Move the cursor slowly (`steps=15–20`) to give CSS transitions time to render before capturing.
- **Hover delays**: If the UI has a built-in hover delay, insert `await asyncio.sleep(0.3)` before `recorder.hold()`.
- **File size**: 15 fps × ~10 s ≈ 150 frames ≈ 0.2–0.5 MB at 680 px wide. Reduce `FPS` to 10 or `GIF_WIDTH` to 480 to shrink further.
- **Loop**: GIFs loop infinitely by default. End the scenario on a stable "result" state so the loop transition looks natural.
- **DEVICE_SCALE**: Increasing this value sharpens the output but does not affect coordinate inputs — always use CSS pixels in the scenario.
