# Elite Golem Haste Base Pass 11

Pass 11 replaces only the single-affix `haste` elite golem. The goal is to separate haste from `jump`: haste should not use shoulder spikes, side fins, winglets, rockets, or blue propulsion cues.

## Haste Language

- Rounded shoulders with no pointed silhouette.
- Oversized smooth helmet with one yellow horizontal visor eye.
- Streamlined forearms and legs that read like guide vanes.
- Yellow flow grooves across the chest, arms, and legs.
- No thruster hardware; speed comes from body shape and airflow lines.

## Output

- Transparent exports: `elite_golem_haste_front_256_pass11.png`
- Gameplay readability export: `elite_golem_haste_front_128_pass11.png`
- Runtime composite: `assets/sprites/enemies/composites/enemy_elite_golem_haste_1x1_pass11_idle.png/.json`
- Source generated frame: `source_generated/haste_generated_pass11_source.png`
- Review comparison: `review_jump_vs_haste_pass11_contact_sheet.png`

## Runtime Scope

Only `eliteGolemAffixCombo:1x1:haste` points to pass11. `armorSpore`, `jump`, and `berserk` remain pass10; multi-affix combination assets now point to pass12.
