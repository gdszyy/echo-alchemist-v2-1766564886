# Elite Golem Affix Bases Pass 7

Pass 7 is based on pass6, but changes the composition for actual in-game enemy tiles.
The goal is no longer a complete full-body character portrait. The golem is cropped by
the square physics boundary, with the top reserved for the HP bar.

## Composition Contract

- Top HP clearance: 128 px exports keep the top 22 px fully transparent.
- Visible body: roughly the upper two-thirds of the golem.
- Priority read: head, eyes, shoulders, chest core, forearms, and the affix-defining shape.
- Lower body: intentionally clipped by the bottom edge.
- Runtime status: not wired into code yet.

## Affix Direction

- `armorSpore`: larger face plus organic green spore armor curves.
- `jump`: enlarged head and upper body, visible blue propulsion and leap machinery within the cropped tile.
- `haste`: enlarged eyes with yellow-gold airflow channels and swept armor.
- `berserk`: red eyes, cracked rage core, asymmetric overcharged body, and unstable crystal gauntlet.

## Output

- Source chroma-key concepts: `elite_golem_<affix>_front_source_magenta_pass7.png`
- Transparent exports: `elite_golem_<affix>_front_256_pass7.png`
- Gameplay readability exports: `elite_golem_<affix>_front_128_pass7.png`
- Review sheet: `review_elite_golem_affix_bases_pass7_contact_sheet.png`

Runtime-ready copies live in:

`assets/sprites/enemies/elites/golem_affix_bases/pass7/`

## Validation

- Generated as front-facing elite golem body assets, not labels, overlays, UI badges, bases, or emblems.
- Exported from flat `#ff00ff` chroma-key sources.
- 128 px exports validated with `top22_opaque_px=0` for all four affixes.
- Bottom and side clipping is intentional for the in-game square boundary composition.
