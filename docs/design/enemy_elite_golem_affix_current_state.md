# Elite Golem Core Affix Asset State

Date: 2026-06-27

This document records the current accepted state for the 1x1 elite golem family: the no-affix original body plus art replacement when any of the four core elite golem affixes are present:

- `armorSpore`
- `jump`
- `haste`
- `berserk`

## Current Conclusion

The replacement path is validated for normal 1x1 elite enemies. A 1x1 elite enemy with no core visual affix resolves to the no-affix elite golem original body. When it contains any non-empty subset of the four core affixes above, it should resolve to an integrated elite golem body sprite instead of using small labels, badges, generic overlays, target fallback marks, or programmatic recolor sketches.

The asset key is based on the intersection of the enemy affixes with the four core affixes. Empty intersection means the no-affix original body. Other affixes on the same enemy, such as `shield` or `regen`, do not participate in the body asset key and must not cause fallback to the old elite golem art.

In practical terms:

- `[]` resolves to the no-affix elite golem body asset.
- `['shield']` still resolves to the no-affix elite golem body asset, with shield as a separate overlay.
- `['haste']` resolves to the single haste elite golem body asset.
- `['shield', 'haste']` still resolves to the same haste body asset.
- `['armorSpore', 'jump', 'haste']` resolves to the three-core-affix combo body asset.
- `['shield', 'armorSpore', 'jump', 'haste']` still resolves to that same three-core-affix combo body asset.

## Active Asset Versions

| Scope | Active version | Notes |
|---|---:|---|
| No affix original | pass13 | Neutral dark stone and aged metal elite golem parent body; no speed, jump, spore, rage, shield, or regen signals. |
| Single `armorSpore` | pass10 | Green organic spore curves and cyclops glow. |
| Single `jump` | pass10 | Blue compact propulsion and blue twin-eye read. |
| Single `haste` | pass11 | Yellow visor, rounded shoulders, streamlined limbs; no jump-like shoulder spikes. |
| Single `berserk` | pass10 | Red cracks and one burning eye. |
| Two to four of the four core affixes | pass12 | Integrated cross-affix body sprites. |

Active review folders:

- `docs/design/concepts/enemy_elite_golem_noaffix_pass13/`
- `docs/design/concepts/enemy_elite_golem_affix_bases_pass10/`
- `docs/design/concepts/enemy_elite_golem_affix_bases_pass11/`
- `docs/design/concepts/enemy_elite_golem_affix_combos_pass12/`

Runtime entry points:

- `src/data/enemy_visual_assets.js`: `_DEFAULT_COMPOSITES` maps the no-affix original and core affix subsets to pass13/pass10/pass11/pass12 resources.
- `assets/sprites/enemies/enemy_sprite_manifest.json`: `eliteGolemAffixCombo:1x1:*` composite entries point to the active PNG/JSON resources.
- Training ground acceptance scene: `P12 精英魔像交叉素材`.

## Locked Art Direction

These assets are full enemy body sprites, not UI labels, square blocks, bases, emblems, state overlays, or small badges.

All active assets must preserve:

- Front-facing view.
- 1x1 elite golem identity.
- Cropped upper-body composition with top HP-bar clearance.
- Hand-painted realistic dark cyber-alchemy stone and aged metal material.
- Affix identity carried by the body, head shape, eye form, glow material, and silhouette.

Core affix language:

- No affix: neutral sealed stone helm, muted amber core, no special mechanic silhouette or color signal.
- `armorSpore`: green, natural curves, porous spore material, cyclops/spore glow.
- `jump`: blue, lighter agile body language, compact propulsion, twin-eye/lens read.
- `haste`: yellow, speed from streamlined limbs and guide-flow lines, not shoulder spikes or thrusters.
- `berserk`: red, one burning eye, broken head, molten cracks, unstable rage.

## What Is Not Decided Yet

After the pass13 no-affix baseline, do not generate more art assets yet.

The next design task is to decide how non-core affixes should be presented when they appear with or without these four core affixes. This includes common or additional affixes outside the four-core set. Their expression may use another visual layer, a separate body treatment, local effects, HUD treatment, or another scheme, but that decision is intentionally not locked in this pass.

Important boundary:

- The four-core-affix body replacement path is accepted and should remain the default for any 1x1 elite enemy containing at least one of the four core affixes.
- Non-core affixes should not silently break that replacement path.
- Non-core affix art should not reintroduce enemy-top labels as the main read.
- Non-core affix art should not be produced until its presentation model is decided.

## Archived Superseded Material

Superseded pass6/pass7/pass8/pass9 base explorations and pass3/pass7 combo explorations were moved to:

`docs/archive/enemy_affix_superseded_elite_golem_iterations_20260626/`

Earlier wrong directions remain archived under:

- `docs/archive/enemy_affix_wrong_direction_20260625/`
- `docs/archive/enemy_affix_wrong_direction_20260626_pass2_programmatic_overlay/`
- `docs/archive/enemy_affix_wrong_direction_20260626_pass4_too_cartoon/`
- `docs/archive/enemy_affix_iteration_20260626_pass5_feedback_shape_language/`
- `docs/archive/enemy_affix_previous_generated_20260626_pass3_13_candidates/`
- `docs/archive/enemy_affix_combo_pass7_rejected_extra_armorSpore_jump_haste_berserk/`

## Verification State

Last verified during the pass12 integration:

- `node --check src/data/enemy_visual_assets.js`
- `node --check src/systems.js`
- `node --check sw.js`
- Manifest JSON parse
- Core single/combo asset resolution probe
- Extra-affix probe such as `shield + armorSpore + jump + haste`
- `node tests/validate_enemy_spawn_runtime.mjs` passed `1007/1007`
- `node tests/validate_wave_presets.mjs` passed `364/364`
- `node tests/validate_phase_contracts.mjs` passed `171/171`

For local browser review, use `http://localhost:3002/?nosw` if stale Service Worker or asset cache behavior is suspected.
