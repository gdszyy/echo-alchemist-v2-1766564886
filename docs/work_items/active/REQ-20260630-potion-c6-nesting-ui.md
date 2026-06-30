# REQ-20260630-potion-c6-nesting-ui

Status: Done
Owner: Codex
Started: 2026-06-30
Completed: 2026-06-30

## Scope

Complete potion alchemy C6 multi-node nesting UI on top of the C4 single-root spellContent flow.

- [x] Continue feeding after a stable root to create a new hidden spellContent node.
- [x] Validate parent and child through `validatePotionSpellTree()` / `validatePotionNesting()` before attaching to `root.children`.
- [x] Collapse the whole furnace on illegal nesting; consumed runes are not returned and only failure refund applies.
- [x] Keep pre-seal UI black-box only: unknown stable nodes, stable/rejected/collapse status, and no hidden ids or final potion details.
- [x] Avoid Tower expansion, formal asset replacement, combat balance changes, and C8 polish.

## Verification Plan

- [x] `node --check src/ui/rune_launcher.js`
- [x] `node --check src/potion_spell_content.js`
- [x] `node --check src/potion_nesting.js`
- [x] `node tests/validate_potion_spell_content.mjs` - 22/22 passed.
- [x] `node tests/validate_potion_nesting.mjs` - 10/10 passed.
- [x] `node tests/validate_potion_c6_nesting_ui.mjs` - 29/29 passed.
- [x] `node tests/validate_potion_spell_tree_combat.mjs` - 26/26 passed.
- [x] `node tests/validate_phase_contracts.mjs` - 174/174 passed.
- [x] `node tests/validate_scenarios.js` - 128/128 passed.
- [x] Auto index regenerated for `src/ui/rune_launcher.js`.
- [x] `git diff --check` - passed; only Windows LF-to-CRLF warnings were printed.
- [x] `git status --short --branch` - working tree remains dirty with this C6 batch plus pre-existing parallel changes.

## Implementation Notes

- `src/ui/rune_launcher.js` now keeps `consumedRunes` as the whole-furnace ledger, `pendingRunes` as the current node input, and `root.children` as the committed stable tree.
- Legal child candidates are validated through `validatePotionNesting()` and `validatePotionSpellTree()` before being attached.
- Illegal child candidates return `status: 'collapse'`; confirmation grants only failure fragments and does not restore consumed runes.
- Pre-seal preview remains black-box: anonymous stable nodes plus structural stable/rejected/collapse states only.
