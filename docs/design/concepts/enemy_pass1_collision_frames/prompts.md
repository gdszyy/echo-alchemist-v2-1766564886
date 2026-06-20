# Enemy Pass 1 Collision Frame Prompts

These prompts correct the earlier decorative frame pass. The frame must follow the actual physics/collision shape.

## Shared Rules

```text
Asset type: transparent game enemy collision-frame material concept
Camera/view: strict orthographic game sprite view, front-facing with slight top-down angle about 10 degrees, no perspective skew
Lighting: centered top-front studio light, even readable game lighting, no strong side light, no cast shadow
Subject: collision-aligned hollow whetstone border frame; center mostly empty for HP liquid UI
Shape constraints: exact outer silhouette follows the physical collision shape; no protrusions outside the shape; no decorative gaps that change collision readability
Constraints: perfectly flat solid #00ff00 chroma-key background visible through center and outside, no text, no UI numbers, no health bar, no logo, no floor plane
Avoid: decorative container unrelated to collision, filled creature body, side-view perspective, strong side lighting, solid opaque center
```

## Shape References

```text
bastion: AABB rectangle, 3x1.
maw: polygon points (-0.45,-0.45), (0.45,-0.45), (0.50,0.10), (0.20,0.50), (-0.20,0.50), (-0.50,0.10).
deflector: polygon points (-0.50,0.30), (-0.30,-0.45), (0.30,-0.45), (0.50,0.30), (0.30,0.50), (-0.30,0.50).
echoSpire: polygon points (0,-0.50), (0.30,-0.30), (0.40,0.45), (-0.40,0.45), (-0.30,-0.30).
```

## Production Notes

- `deflector` is the strongest collision-frame reference.
- `bastion` is acceptable as the AABB reference.
- `maw` is acceptable if inner teeth stay inside the collision outline.
- `echoSpire` needs a shorter, stricter 1x2 production pass.
