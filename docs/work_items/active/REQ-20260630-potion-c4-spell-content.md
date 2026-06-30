# REQ-20260630-potion-c4-spell-content

Status: Done
Owner: Codex
Started: 2026-06-30
Completed: 2026-06-30

## Scope

Complete potion alchemy C4 spellContent parsing in `D:\claude\echo-alchemist-v2-1766564886`.

- [x] Replace `_ui_resolvePotionRecipe()` element-loose matching with `RUNEWORD_DB` formula parsing.
- [x] Generate hidden root `spellContentId` / `spellType` and keep old static `potionId` for combat compatibility.
- [x] Keep pre-seal UI black-box only: stable / continue / rejected / collapse.
- [x] Preserve failed and interrupted draft behavior: consumed runes are not returned, only failure refund applies.
- [x] Avoid C6 multi-node UI, Tower behavior/balance/assets, and C8 asset work.

## Implementation

- Added `src/potion_spell_content.js`.
  - C4 parses exactly 3 consumed runes into one root spellContent node.
  - Formula matching preserves `RUNEWORD_DB.pattern[1]` as the center core and allows outer reagents to reverse.
  - Disabled chain, special unlock, pure numeric, projectile transform, and projectile spawn runewords enter a rejected black-box path.
- Updated `src/ui/rune_launcher.js`.
  - `_ui_resolvePotionRecipe()` now calls `resolvePotionSpellContent(runes, RUNEWORD_DB)`.
  - `preparedPotionSpell.potionId` still points at a static `POTION_SPELL_DB` entry.
  - `spellTree.root` stores the hidden `spellContentId` and `spellType`.
  - Form controls validate against hidden `spellType` without displaying it.
- Added `tests/validate_potion_spell_content.mjs`.
  - Covers legal parsing, illegal unformed parsing, forbidden chain parsing, static `potionId` compatibility, root `spellTree`, and black-box preview non-leakage.

## Verification

Completed during the C4 batch:

- `node --check src/potion_spell_content.js`: passed.
- `node --check src/ui/rune_launcher.js`: passed.
- `node --check tests/validate_potion_spell_content.mjs`: passed.
- `node tests/validate_potion_spell_content.mjs`: 22/22 passed.

Full closeout verification is recorded in the final Codex summary for this batch.

Closeout verification for independent C4 commit prep:

- `node --check src/ui/rune_launcher.js`: passed.
- `node --check src/potion_spell_content.js`: passed.
- `node --check tests/validate_potion_spell_content.mjs`: passed.
- `node tests/validate_potion_spell_content.mjs`: 22/22 passed.
- `node tests/validate_phase_contracts.mjs`: 174/174 passed.
- `git diff --check`: passed; only Windows LF-to-CRLF warnings were printed.

## Sync Gates

- Auto index: required for `src/ui/rune_launcher.js`; update through `scripts/generate_index.py`.
- Module docs: `.cursor/rules/ui_system.md` and `.cursor/rules/runeword_index.md` updated.
- Progress docs: `TODO.md`, `docs/p0_interaction_optimization_todo.md`, `docs/potion_alchemy_development_plan.md`, and `docs/rune_potion_spell_contract.md` updated.
- Process insights: not required; no new cross-module trap beyond the documented center-core formula distinction.
- Temporary files: none planned.
