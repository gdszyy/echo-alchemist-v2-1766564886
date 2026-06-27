# Elite Golem Affix Combos Pass 7

Pass 7 is the current visual direction for elite golem affix combo assets.
It follows the accepted pass7 tile composition: cropped upper body, enlarged face and
eyes, top HP-bar clearance, and strong affix shape language.

## Composition Contract

- Top HP clearance: every 128 px export keeps the top 22 px fully transparent.
- Visible body: roughly the upper two-thirds of the golem.
- Priority read: eyes, brow, shoulders, chest core, forearms, and affix-defining shapes.
- Bottom crop: intentional. The lower body is cut by the square physics boundary.
- Runtime status: not wired into code yet.

## Affix Color Language

- `armorSpore`: muted emerald natural spore armor growth.
- `jump`: cobalt-blue thrusters, launch struts, and leap hardware.
- `haste`: yellow-gold airflow channels, swept vanes, and speed cowls.
- `berserk`: dark crimson eyes, rage core, fissures, broken restraints, and crystal gauntlet.

## Delivered Set

15 total:

- Singles x4
- Two-affix combos x6
- Three-affix combos x4
- Four-affix combo x1

## Output

- Source chroma-key concepts: `elite_golem_<combo>_front_source_magenta_pass7.png`
- Transparent exports: `elite_golem_<combo>_front_256_pass7.png`
- Gameplay readability exports: `elite_golem_<combo>_front_128_pass7.png`
- Review sheets:
  - `review_elite_golem_affix_combos_pass7_128_contact_sheet.png`
  - `review_elite_golem_affix_combos_pass7_256_contact_sheet.png`

Runtime-ready copies live in:

`assets/sprites/enemies/elites/golem_affix_combos/pass7/`

## Validation

- Generated as front-facing elite golem body assets, not labels, overlays, UI badges, bases, or emblems.
- Exported from flat `#ff00ff` chroma-key sources.
- All 15 128 px exports validate with `top22_opaque_px=0`.
- One rejected `jump_haste_berserk` candidate accidentally included `armorSpore`; it was archived and excluded from this final set.
