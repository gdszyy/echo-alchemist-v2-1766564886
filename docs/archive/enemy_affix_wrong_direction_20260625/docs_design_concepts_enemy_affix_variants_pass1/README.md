# Enemy Affix Base Variants Pass 1

This pass explores the first controlled set of 1x1 residue base variants for affixes that should subtly modify the base material, parts, posture, or engraved details without replacing the enemy's core silhouette.

## Scope

- Base target: `residue:1x1`
- Variant affixes: `armorSpore`, `jump`, `haste`, `berserk`
- Not runtime-wired yet.
- Does not affect Boss assets.
- Does not replace existing V2 archetype assets or manifest entries.

## Files

Runtime-candidate exports live in:

`assets/sprites/enemies/variants/pass1/`

Review copies and the contact sheet live beside this note:

- `enemy_affix_variants_residue_1x1_contact_sheet_pass1.png`
- `enemy_variant_armorSpore_residue_1x1_256_pass1.png`
- `enemy_variant_jump_residue_1x1_256_pass1.png`
- `enemy_variant_haste_residue_1x1_256_pass1.png`
- `enemy_variant_berserk_residue_1x1_256_pass1.png`

## Layering Intent

- `armorSpore`: mineralized pale-green spore crystals, seed-vault corner nodules, branching alchemical veins.
- `jump`: compressed lower struts, folded stone-metal support legs, cyan elastic crystal pads.
- `haste`: sharper side bevels, diagonal guide fins, slanted speed engravings.
- `berserk`: red-orange heat cracks, lifted fractured plates, scorched bevels, controlled furnace core glow.

All variants should preserve the center core, collision-readable silhouette, and four-corner overlay anchor positions so defensive overlays and blood-bar effects can stack later.
