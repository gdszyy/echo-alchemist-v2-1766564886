# Normal Enemy Redo - 2026-06-20

This pass replaces the common 1x1 enemy body. The runtime collision boundary is now expressed by the separate `residue:1x1` collision frame asset.

## Files

| File | Purpose |
|---|---|
| `normal_whetstone_raw_magenta.png` | AI-generated source on magenta chroma key |
| `normal_whetstone_alpha.png` | Transparent high-resolution source |
| `normal_whetstone_128_preview.png` | 128px preview used for `golem_normal.png` |
| `assets/sprites/enemies/golem_normal.png` | Runtime normal fallback Sprite Sheet |
| `assets/sprites/enemies/composites/enemy_residue_1x1_idle.png` | Runtime `residue:1x1:` composite |

## Boundary Rule

The enemy body should not bake in an extra UI-like border. Runtime draws the physical boundary from `assets/sprites/enemies/frames/frame_residue_1x1.png`; that frame must remain aligned with the 1x1 collision hull.

## Prompt Summary

High-detail dark alchemical fantasy sprite, compact geometric whetstone ore block, chipped beveled black basalt, orange ember cracks, small embedded alchemical core, faint violet rune accents, orthographic front-facing slight top-down view, no UI, no health bar, no baked border frame, static source image.
