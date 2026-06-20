# Enemy Pass 1 Material Frames

Generated on 2026-06-19 after deciding that enemy borders should carry the same material language as the base art while preserving HP/UI readability.

> **Superseded**: This pass explored decorative hollow frames, but it does **not** reliably match the physical collision outlines. Use [`../enemy_pass1_collision_frames/`](../enemy_pass1_collision_frames/) as the production reference. Keep this folder only for material texture inspiration.

## Layer Intent

These are **material frame concepts**, not full enemy bodies. They are no longer the correct production shape reference unless their outer silhouette is adjusted to `collisionShape/collisionData`.

The frame layer should:

- Keep the center transparent so the existing liquid HP bar, damage trail, healing preview, HP number, status badges and telegraph UI remain runtime-controlled.
- Add beveled stone, carved sockets, mineral inlays and base-specific edge texture.
- Sit visually between the gameplay UI and the body art: it improves the container quality without baking UI values into PNGs.
- Reuse the same orthographic/front/top-light rules as the body concepts.

## Results

| Asset | Result | Production note |
|---|---|---|
| `enemy_bastion_3x1` | Good hollow 3-segment frame | Thicken the three stone segments for 128px readability |
| `enemy_maw_2x2` | Strongest material frame | Good candidate for production frame layer |
| `enemy_deflector_2x1` | Strong material frame | Good candidate for production frame layer |
| `enemy_echo_spire_1x2` | Good frame idea, still too tall | Compress to strict 1x2 ratio |

## Files

| Type | Path |
|---|---|
| Contact sheet | `enemy_pass1_frames_contact_sheet.png` |
| Raw chroma-key sources | `*_frame_raw.png` |
| Alpha cutouts | `*_frame_alpha.png` |

## Recommended Runtime Direction

Do not replace the HP bar with these images. Instead, add a separate collision-frame asset layer:

1. Draw base fill / slot / HP liquid exactly as today.
2. Draw material frame PNG or Canvas vector frame exactly along the physical collision outline.
3. Draw status badges, HP text and telegraph cues above it.

This preserves gameplay readability while raising the perceived material quality.
