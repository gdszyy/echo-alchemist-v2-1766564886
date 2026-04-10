"""
Example scenario: record a button click on any webpage.

Copy this file, rename it, and implement the `run()` coroutine
to describe the interaction you want to capture.
"""
import asyncio

# ── Required configuration ──────────────────────────────────────────────────

URL = "https://example.com"

# Region of the page to capture (CSS pixels, before device_scale is applied)
CLIP = {"x": 0, "y": 0, "width": 800, "height": 600}

# ── Optional configuration (defaults shown) ─────────────────────────────────

GIF_WIDTH    = 680          # output pixel width (height auto-scaled)
FPS          = 15           # frames per second
VIEWPORT     = {"width": 1400, "height": 800}
DEVICE_SCALE = 1.5          # retina-style sharpness


# ── Interaction script ───────────────────────────────────────────────────────

async def run(page, recorder):
    """
    Describe the interaction here using the recorder API:

        await recorder.hold(n)          – pause for n frames
        await recorder.move(x, y)       – move cursor to (x, y)
        await recorder.click(x, y)      – click + ripple at (x, y)
        await recorder.snap()           – capture a single frame
        recorder.set_mouse(x, y)        – set initial cursor position
    """

    # Place cursor off-screen initially
    recorder.set_mouse(700, 50)
    await page.mouse.move(700, 50)

    # 1. Show initial state for 1.5 s
    await recorder.hold(22)

    # 2. Move cursor to a button (adjust coordinates to your page)
    await recorder.move(400, 300, steps=15)

    # 3. Pause on the button
    await recorder.hold(10)

    # 4. Click with ripple effect
    await recorder.click(400, 300)

    # 5. Show result for 2 s
    await recorder.hold(30)
