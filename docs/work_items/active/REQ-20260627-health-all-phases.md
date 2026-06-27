# REQ-20260627-health-all-phases

Status: Verifying
Owner: Codex
Started: 2026-06-27

## Scope

Continue from `docs/health_all_phases_goal_handoff.md` and advance Echo Alchemist V2 health follow-up work one verifiable checkpoint at a time.

Current checkpoint focus:

- [ ] Checkpoint 0: baseline verification.
- [ ] Checkpoint 1: P1 interaction health, starting with rune launcher information architecture and pinboard fusion feedback.

Deferred checkpoints remain tracked in the handoff document:

- Potion alchemy closure.
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

## Sync Gates

- Auto index: not required for Checkpoint 0; no source files changed.
- Module docs: not required for Checkpoint 0; no state/API/architecture changed.
- Progress docs: request card created; TODO/P1 status unchanged.
- Process insights: pending; add only if a non-obvious coupling or recurring trap is discovered.
- Temporary files: pending; no scratch files should remain in active docs.
- Verification: Checkpoint 0 baseline passed.
