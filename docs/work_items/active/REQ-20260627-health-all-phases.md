# REQ-20260627-health-all-phases

Status: debt
Owner: Codex
Started: 2026-06-27

## Scope

Continue from `docs/health_all_phases_goal_handoff.md` and advance Echo Alchemist V2 health follow-up work one verifiable checkpoint at a time.

Current checkpoint focus:

- [x] Checkpoint 0: baseline verification.
- [ ] Checkpoint 1: P1 interaction health.
  - [x] Pinboard fusion feedback is visible from the rune launcher configuration tab.
  - [ ] Remaining P1 items: full launcher information hierarchy, codex card states, mobile long-list safe-area review, reward/shop/truth-book card grammar.

Deferred checkpoints remain tracked in the handoff document:

- Potion alchemy closure.
  - [x] done: C1 interruption boundaries, Root Orb carrier without child spells, shared nesting legality, and Tower active/death basic runtime.
  - [x] contract-only: static potion metadata and VFX dispatcher coverage.
  - [ ] debt: RUNEWORD spellContent parsing, multi-node nesting UI, full Tower assets/balance.
- Bitmap UI and asset coverage.
- Enemy/Boss visual follow-up.
- PixiJS performance validation and remaining migration.
- Element visual follow-up.
- Final docs, generated indexes, and workspace cleanup.

## Boundaries

- Do not rewrite files over 500 lines wholesale.
- Do not manually edit `.cursor/rules/auto_index/`; update indexes only through `scripts/generate_index.py`.
- Keep runtime code, generated/runtime assets, archived material, and scratch files in separate commits.
- Do not leave a dev server running silently.
- Add `// @perf-impact` and performance assessment for new high-cost particles, glow, blend modes, or rendering work.

## Verification Log

- 2026-06-27 Checkpoint 0 baseline:
  - `git diff --check`: passed.
  - `node --check src/core.js`: passed.
  - `node --check src/game_system.js`: passed.
  - `node --check src/combat_system.js`: passed.
  - `node --check src/ui_system.js`: passed.
  - `node --check src/systems.js`: passed.
  - `node --check src/entities/enemy.js`: passed.
  - `node tests/validate_scenarios.js`: 128/128 passed.
  - `node tests/validate_phase_contracts.mjs`: 171/171 passed.
- 2026-06-27 Checkpoint 1 partial, pinboard fusion launcher feedback:
  - `git diff --check`: passed; Windows LF/CRLF warnings only.
  - `node --check src/ui/rune_launcher.js`: passed.
  - `node --check src/ui_system.js`: passed.
  - `node --check src/systems.js`: passed.
  - `node tests/validate_scenarios.js`: 128/128 passed.
  - `node tests/validate_phase_contracts.mjs`: 173/173 passed.
  - `node tests/validate_pinboard_mechanisms.mjs`: 15/15 passed.
  - `node tests/ai_test_runner.js --suite pinboard --url http://localhost:3002`: not run; repository has no `puppeteer` dependency installed.
  - Codex in-app browser check at `http://localhost:3002/`: page loaded, launcher DOM and `#rune-pinboard-fusion-summary` existed, no console error logs.
- 2026-06-30 Potion alchemy status-word sync:
  - Root Orb now creates `potion_orb_carrier` even when `spellTree.root.children` is empty, then ruptures at arrival.
  - Nesting legality is centralized in `src/potion_nesting.js` for UI selection, save validation, combat release, and tests.
  - Tower active/death basic runtime creates `potion_tower` entities with active periodic pulse and death-triggered release.
  - Static potion metadata and VFX dispatcher are contract-only, not gameplay completion.
  - `node --check src/potion_nesting.js`: passed.
  - `node --check src/ui/rune_launcher.js`: passed.
  - `node --check src/combat_system.js`: passed.
  - `node --check src/game_phase.js`: passed.
  - `node tests/validate_potion_nesting.mjs`: 10/10 passed.
  - `node tests/validate_potion_spell_tree_combat.mjs`: 15/15 passed.
  - `node tests/validate_potion_vfx_contract.mjs`: 66/66 passed.
  - `node tests/validate_spell_vfx_design.mjs`: 43/43 passed.
  - `node tests/validate_scenarios.js`: 128/128 passed.
  - `node tests/validate_phase_contracts.mjs`: 173/173 passed.
  - `node tests/validate_rune_spell_forms.mjs`: 8/8 passed.
  - `node -e "require.resolve('puppeteer')"`: failed; repository does not have `puppeteer` installed.
  - Local HTTP smoke: started `node node_modules/serve/build/main.js . -l 3002`, loaded `http://localhost:3002` with status 200 and confirmed `potion-form-controls`; stopped PID 6940. No service left running.

## Sync Gates

- Auto index: updated for `src/ui/rune_launcher.js` and `src/ui_system.js` through `scripts/generate_index.py`.
- Potion P0 slice auto index: updated for `src/ui/rune_launcher.js`, `src/combat_system.js`, and `src/game_phase.js` through `scripts/generate_index.py`.
- Module docs: `.cursor/rules/ui_system.md` updated with the pinboard-fusion launcher feedback contract.
- Potion P0 slice module docs: `docs/rune_potion_spell_contract.md`, `docs/potion_alchemy_development_plan.md`, `src/combat/combat.md`, `.cursor/rules/ui_system.md`, `.cursor/rules/performance.md`, and `tests/README.md` updated.
- Progress docs: `docs/p0_interaction_optimization_todo.md` updated for the completed feedback-chain item.
- Potion progress docs: `TODO.md`, `docs/p0_interaction_optimization_todo.md`, `docs/rune_potion_spell_contract.md`, and `docs/potion_alchemy_development_plan.md` use `done / placeholder / contract-only / debt` for potion status.
- Process insights: pending; add only if a non-obvious coupling or recurring trap is discovered.
- Temporary files: no scratch files added. Dev server was started for browser check and closed by PID.
- Verification: Checkpoint 0 baseline passed; Checkpoint 1 partial batch passed available static checks and in-app browser DOM check.
