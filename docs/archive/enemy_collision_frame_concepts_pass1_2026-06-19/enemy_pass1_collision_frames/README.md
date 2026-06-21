# Enemy Pass 1 Collision-Aligned Frames

Generated on 2026-06-19 after correcting the frame requirement: the material frame must match the **actual physical collision shape**, not a decorative container.

## Collision Rule

The frame layer is a materialized collision boundary:

- It must follow `Enemy.collisionShape` and `collisionData`.
- It must not extend beyond the collision outline.
- It must preserve the center so HP liquid, delayed damage trail, healing preview, HP number, status badges and telegraph UI remain runtime-controlled.
- It may add bevels, stone texture, grooves and inlays **inside the frame thickness only**.

## Current Shapes

Source: `src/spawn_system.js` → `spawn_applyArchetypeShape()`.

| Asset | Physical shape | Result | Production note |
|---|---|---|---|
| `enemy_bastion_3x1` | AABB rectangle | Good | Correct collision-aligned AABB material frame |
| `enemy_maw_2x2` | 6-point polygon | Good | Outer edge matches maw polygon; teeth stay inside border |
| `enemy_deflector_2x1` | 6-point low shield polygon | Strongest | Good candidate for first runtime frame test |
| `enemy_echo_spire_1x2` | 5-point spire polygon | Shape concept correct, ratio still too tall | Compress to actual 1x2 runtime frame |

## Files

| Type | Path |
|---|---|
| Contact sheet | `enemy_pass1_collision_frames_contact_sheet.png` |
| Raw chroma-key sources | `*_collision_frame_raw.png` |
| Alpha cutouts | `*_collision_frame_alpha.png` |

## Runtime Direction

Draw the material frame only where the current code already draws the collision border:

1. Build the same path as `collisionShape` (`aabb`, `polygon`, `arc`).
2. Draw existing HP liquid and slot fill inside that path.
3. Draw the material frame along the same path.
4. Draw HP text, status badges, telegraph and selection indicators above it.

Do not use the older decorative frame pass as production reference except for material texture inspiration.
