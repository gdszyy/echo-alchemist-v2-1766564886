# Enemy Pass 1 View-Fix Prompts

These prompts corrected the first pass by forcing orthographic game view and centered top-front lighting.

## Shared Additions

```text
Camera/view: strict orthographic game sprite view, front-facing with slight top-down angle about 10 degrees, no perspective skew, no dramatic side view, centered symmetrical silhouette
Lighting: centered top-front studio light, even readable game lighting, no strong side light, no long cast shadow, core glow is secondary
Constraints: perfectly flat solid #00ff00 chroma-key background for background removal, no text, no UI, no health bar, no logo, no floor plane, no background scene
Avoid: side-view perspective, three-quarter dramatic render, strong side lighting
```

## Production Follow-Up Notes

- `bastion`: keep the view-fix camera and lighting. Convert the wide concept into a fixed 3x1 frame contract.
- `deflector`: use as the strongest production reference.
- `maw`: revise to “mouth embedded in a square 2x2 stone block, minimal legs/supports.”
- `echoSpire`: revise to “about 2:1 height ratio, slightly wider base, less UI-obelisk height.”
