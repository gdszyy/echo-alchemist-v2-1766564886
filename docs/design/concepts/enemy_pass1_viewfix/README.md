# Enemy Pass 1 View-Fix Preview

Generated on 2026-06-19 after reviewing the first concept pass for camera and lighting issues.

## View-Fix Rule

All production enemy assets should use:

- Orthographic game sprite view.
- Front-facing composition with only a slight top-down angle, about 10 degrees.
- No strong side-view silhouette, no dramatic three-quarter perspective.
- Centered top-front studio light.
- Core glow is secondary; it must not become the main light source.
- No floor plane, cast shadow, or environmental lighting baked into the sprite.

## Results

| Asset | Result | Production note |
|---|---|---|
| `enemy_bastion_3x1` | View and lighting improved; strong production reference | Use this as the standard for frontal 3x1 staging |
| `enemy_maw_2x2` | View and lighting improved; still too Boss-like | Reduce limbs/supports and embed maw deeper into a square stone block |
| `enemy_deflector_2x1` | Best view-fix result | Strong candidate for first production Sprite Sheet |
| `enemy_echo_spire_1x2` | View and lighting improved; too tall | Compress to about 2:1 height ratio and widen base slightly |

## Files

| Type | Path |
|---|---|
| Contact sheet | `enemy_pass1_viewfix_contact_sheet.png` |
| Raw chroma-key sources | `*_viewfix_raw.png` |
| Alpha cutouts | `*_viewfix_alpha.png` |

## Next Step

Use `enemy_bastion_3x1_viewfix_alpha.png` and `enemy_deflector_2x1_viewfix_alpha.png` as references for the first production Sprite Sheet generation pass. For `maw` and `echoSpire`, revise the prompt before production.
