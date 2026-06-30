# REQ-20260630-potion-c1-boundaries

Status: Done

## Scope

Execute the potion alchemy C1 batch: harden interruption and overwrite boundaries after runes have been consumed by the alchemy draft.

## Goals

- Closing the alchemy bench, switching away from the potion tab, entering combat, and restoring after refresh must make consumed-rune state explainable.
- Any abandoned draft must clearly state that consumed runes are not returned.
- Sealing over an existing charged potion must clearly state that the old potion and charges are discarded without refund.
- Keep the batch limited to C1. Do not implement spellContent parsing, multi-node nesting UI, Tower completion, asset replacement, or balance changes.

## Milestones

- [x] Audit existing potion UI, save/restore, and phase-transition entry points.
- [x] Implement interruption and overwrite copy/state guards.
- [x] Add or extend static contract tests for C1.
- [x] Update progress docs and generated auto index when required.
- [x] Run required validation commands and close cleanup gates.

## Verification

- `node --check src/ui/rune_launcher.js` — passed.
- `node --check src/game_phase.js` — passed.
- `node --check src/game_system.js` — passed.
- `node tests/validate_phase_contracts.mjs` — 174/174 passed.
- `node tests/validate_potion_nesting.mjs` — 10/10 passed.
- `node tests/validate_potion_spell_tree_combat.mjs` — 15/15 passed.
- `node tests/validate_scenarios.js` — 128/128 passed.
- `node tests/validate_potion_vfx_contract.mjs` — 66/66 passed.
- `git diff --check` — passed; Git reported LF-to-CRLF warnings only.

## Sync Gates

- Auto index: required if `src/ui/rune_launcher.js`, `src/ui_system.js`, `src/game_system.js`, or other indexed large files change.
- Module docs: update `.cursor/rules/ui_system.md` if UI/state contract changes.
- Progress docs: update `TODO.md` / `docs/p0_interaction_optimization_todo.md` / `docs/potion_alchemy_development_plan.md` when C1 status changes.
- Temporary artifacts: none planned; any scratch files go under `tmp/codex/REQ-20260630-potion-c1-boundaries/`.
