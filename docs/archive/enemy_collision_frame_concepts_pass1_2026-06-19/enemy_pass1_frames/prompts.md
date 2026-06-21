# Enemy Pass 1 Material Frame Prompts

These prompts generate hollow material frames intended to preserve runtime HP/UI layers.

## Shared Rules

```text
Asset type: transparent game enemy material frame concept, hollow border overlay
Camera/view: strict orthographic game sprite view, front-facing with slight top-down angle about 10 degrees, no perspective skew, centered symmetrical silhouette
Lighting: centered top-front studio light, even readable game lighting, no strong side light, no cast shadow
Subject: hollow geometric whetstone frame with base-specific material sockets; center mostly empty for HP bar visibility
Constraints: perfectly flat solid #00ff00 chroma-key background visible through center and outside for removal, no text, no UI numbers, no health bar, no logo, no floor plane, no background scene
Avoid: filled creature body, side-view perspective, strong side lighting, oversized glow, solid opaque center
```

## Follow-Up Notes

- `maw` and `deflector` are the strongest references.
- `bastion` should keep the three-segment concept but use thicker stone rails.
- `echoSpire` should keep the vertical frame idea but compress height to gameplay 1x2.
- Production frame assets should likely live under a new manifest section such as `frames`, separate from body sprites and affix overlays.
