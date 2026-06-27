# Elite Golem Affix Bases Pass 10

Pass 10 regenerates the four single-affix elite golem bases as full enemy art assets instead of programmatic recolors. The goal is small-size readability: each affix has a distinct oversized head silhouette and glowing eye material, while the top of the square keeps HP-bar clearance.

## Head Language

- `armorSpore`: natural curved spore-stone head, porous green glow, one green cyclops eye.
- `jump`: lighter aerodynamic head, blue thruster pieces, two bright blue eyes.
- `haste`: streamlined guide-vane head, yellow airflow channels, one horizontal visor eye.
- `berserk`: broken rage head, red cracks, one eye burning with a contained flame.

## Output

- Transparent exports: `elite_golem_<affix>_front_256_pass10.png`
- Gameplay readability exports: `elite_golem_<affix>_front_128_pass10.png`
- Runtime composites: `assets/sprites/enemies/composites/enemy_elite_golem_<affix>_1x1_pass10_idle.png/.json`
- Source generated frames: `source_generated/<affix>_generated_pass10_source.png`
- Review sheet: `review_elite_golem_affix_bases_pass10_contact_sheet.png`

## Runtime Scope

`armorSpore`, `jump`, and `berserk` still point to pass10. `haste` has been superseded by pass11 to remove the jump-like shoulder spikes and switch its speed identity to streamlined limbs. Multi-affix combination assets now point to pass12.
