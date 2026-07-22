# REQ-20260627-health-all-phases

Status: Active
Owner: Codex
Started: 2026-06-27
Last updated: 2026-07-22

## Scope

Continue from `docs/health_all_phases_goal_handoff.md` and advance Echo Alchemist V2 health follow-up work one verifiable checkpoint at a time.

Current checkpoint focus:

- [x] Checkpoint 0: baseline verification.
- [x] Checkpoint 1: 2026-07-17 UI / interaction hardening（实现、A-D 集成与 Goal E 最终全量证据均已关闭）。
  - [x] Desktop、360×800、390×844、480×854 与代码合同的审计范围已冻结。
  - [x] P0/P1/P2 backlog 已登记到 `docs/p0_interaction_optimization_todo.md`。
  - [x] `REQ-20260717-first-run-tutorial` 已集成并关闭。
  - [x] `REQ-20260717-run-lifecycle-integrity` 已集成并关闭。
  - [x] `REQ-20260717-mobile-ui-accessibility` 已集成并关闭。
  - [x] `REQ-20260717-launcher-settlement-ux` 已集成并关闭。
  - [x] Pinboard fusion feedback is visible from the rune launcher configuration tab.
  - [x] `REQ-20260717-ui-polish-integration` 已完成代码合并、冲突修复、全量 T1、四视口 T3、索引与文档收口；最终代码/测试/索引提交为 `aecef4a`。
  - [x] 本 checkpoint 的遗留项已明确分流：`VIS-P2-01` 语言/版本、`VIS-P2-02` 正式位图、`VIS-P2-03` offline shell/CSS cleanup 继续作为 P2 debt，不冒充本轮完成。

Deferred checkpoints remain tracked in the handoff document:

- Potion alchemy closure.
  - [x] done: C1 interruption boundaries, C4 spellContent parsing, C6 multi-node nesting UI, Root Orb carrier without child spells, shared nesting legality, Tower foundation runtime, and C8 runtime fallback polish.
  - [x] contract-only: static potion metadata and VFX dispatcher coverage.
  - [ ] debt: Tower dedicated assets, long-term balance, deep child-spell scheduling, and formal PNG/chroma potion art replacement.
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
- Do not run the four implementation goals in the dirty root checkout. Each goal owns one `codex/<REQ-ID>` branch, one sibling worktree, one request card, and one temp directory.
- Shared TODOs, this umbrella card, `tests/ai_test_runner.js`, cross-workstream terminology, and final acceptance are integration-owned. Source owners regenerate only their own large-file indexes; integration performs the final generator-backed consistency pass.

## 2026-07-17 Parallel Goal Package

Goals A-D were executed in isolated worktrees and merged serially by Goal E. The frozen cross-workstream interface is `sys_acquirePauseLease(ownerId) -> opaque token` plus `sys_releasePauseLease(token)`: every overlay releases only its own token, and no close path may directly force `isPaused = false`.

| Goal | Request ID | Ownership / contract | Integration status |
| :--- | :--- | :--- | :--- |
| A | `REQ-20260717-first-run-tutorial` | Tutorial-only flow: `relic -> marble_pack -> gathering -> combat`, cancellable start, truthful device copy, one completion owner | Integrated / Closed：`d7ea424 -> 4d568c3` |
| B | `REQ-20260717-run-lifecycle-integrity` | Run/phase epoch, resolver/reward idempotence, safe save restore, input cancel, nested pause lease, shop/relic ARIA | Integrated / Closed：`1146b4b` / `8461cfb -> 7a97ce5` / `0dfb075` |
| C | `REQ-20260717-mobile-ui-accessibility` | HTML/CSS shell, pause/training/truth-book/shop scrolling, combat HUD visibility, mobile safe boundary | Integrated / Closed：`50e8532 -> f8d0055` |
| D | `REQ-20260717-launcher-settlement-ux` | Launcher touch/focus/lease, codex action states, alchemy CTA, currency scope, real 30% settlement display | Integrated / Closed：`4b27547 -> 56c1993` |
| E | `REQ-20260717-ui-polish-integration` | Shared docs/tests, terminology, ARIA/CSS/pause conflicts, runtime-semantic phase contract, full T1/T3 and Git closure | Goal Complete / Closed：integration fix `db5efa6`；optional boot `0767b3f`；最终实现 `aecef4a` |

### Goal A — First-run tutorial

- Exclusive write set was `src/tutorial_system.js`, its focused T1/rule/card, and generator-owned index.
- Acceptance required fresh desktop/mobile completion without manual skip, cancellable delayed start, real event-driven steps, truthful single-click/coarse-pointer copy, the 85% gathering threshold, and one idempotent completion point.

### Goal B — Run lifecycle integrity

- Exclusive source ownership covered run lifecycle, phase coordinator, run shop and relic/shop overlays.
- Acceptance required stale-callback cancellation after abandon/gameover/new run, atomic reward/resolver progression, versioned safe restore, nested pause leases, input-cancel cleanup, truthful Continue round, and keyboard/ARIA-safe overlays.

### Goal C — Mobile UI and system-page accessibility

- Exclusive source ownership covered `index.html`, `bitmap_ui.css`, `systems.js`, `ui/hud.js`, its focused T1/rule/card, and generator-owned indexes.
- Acceptance required real-coordinate reachability and single-axis scrolling at 360×800 / 390×844 / 480×854, desktop training layout integrity, visible combat status/disabled reasons, safe dock boundaries, and reduced-motion support.

### Goal D — Launcher, codex, and settlement UX

- Exclusive source ownership covered `src/ui/rune_launcher.js`, `src/ui/game_over.js`, its focused T1/rule/card, and generator-owned indexes.
- Acceptance required short-tap selection versus long-press explanation, `touchcancel` safety, launcher-owned pause lease, dialog/focus behavior, honest codex states, executable alchemy CTAs, distinct currency scopes, and display values sourced from the real 30% settlement write.

### Goal E — Serial integration and acceptance

```text
/goal 执行 REQ-20260717-ui-polish-integration：在干净集成 worktree 依次合并 A-D，解决 pause lease、术语、ARIA、CSS 状态和测试冲突，修正当前 phase-contract 顺序敏感红基线，完成全量 T1/T3、四档视口浏览器回归、索引/TODO/需求卡同步与 Git 收口。完整执行合同见主需求卡 Goal E。部分合并、红测或预算耗尽均不算完成。
```

- Merge order and audited mappings: A `d7ea424 -> 4d568c3`; B `1146b4b` / `8461cfb -> 7a97ce5` / `0dfb075`; C `50e8532 -> f8d0055`; D `4b27547 -> 56c1993`.
- Integration-owned fixes: `db5efa6` for pause lease/terminology/ARIA/CSS/lifecycle conflicts and `0767b3f` for optional clip-pack boot behavior.
- Final static verification: source/test syntax `89/89`; all `23/23 validate_*` suites passed `2774/2774`, including phase `175/175`, terminology `36/36`, mobile UI `60/60`, run lifecycle `109/109`, launcher/settlement `54/54`, and scenarios `128/128`.
- Required final order completed: all syntax checks -> every focused T1 -> scenarios + phase contracts -> T3 at 360×800, 390×844, 480×854 and 1440×900 -> generator-backed index review -> status-word scan -> `git diff --check` / clean Git closeout.
- Final cross-batch T3 passed `32/32` at actual 360×800, 390×844, 480×854 and 1440×900, producing 12 PNG files plus JSON with zero unclassified issues and zero horizontal overflow. Exact classified issues were optional-local-audio `256` and controlled-navigation-image-abort `97` initial-navigation images. Evidence: `D:/claude/echo-alchemist-v2-1766564886/tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/ui-polish-report.json`.

## Verification Log

- 2026-07-22 Checkpoint 1 integration closeout complete:
  - A-D delivery mappings are recorded above and all four child cards are `Integrated / Closed`.
  - Integration fixes: `db5efa6`; optional clip-pack boot fix: `0767b3f`.
  - Runtime-semantic `validate_phase_contracts.mjs`: `175/175`; `validate_ui_terminology.mjs`: `36/36`; mobile UI contract: `60/60`.
  - Final syntax `89/89`; all validators `23/23`, `2774/2774`; four-viewport T3 `32/32`, 12 PNG + JSON, zero unclassified issues and zero horizontal overflow.
  - The test adapter forces exact Google Fonts and Pixi 7.4.2 CDN responses so this UI T3 exercises the documented Canvas2D fallback; it does not claim WebGL coverage.
  - Full index scan indexed `36` and skipped `27`, generating central `INDEX.md`, `_meta.json`, and the `src_ui_system` index.
  - The umbrella remains `Active` because potion/assets/enemy/PixiJS/element follow-up checkpoints remain deferred; closing UI Checkpoint 1 does not close the umbrella request.

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
  - Tower foundation runtime creates `potion_tower` entities with AABB blocking/contact damage, deterministic targeting, active periodic pulse, death-triggered release, lifecycle cleanup, and invalid-tree runtime rejection.
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
- 2026-06-30 Potion C4 spellContent parsing:
  - `src/potion_spell_content.js` parses one 3-rune `RUNEWORD_DB` formula into hidden `spellContentId` / `spellType` and maps to a static compatibility `potionId`.
  - `src/ui/rune_launcher.js` no longer uses element-loose recipe mapping for new alchemy results; pre-seal UI remains black-box.
  - `preparedPotionSpell.potionId` remains the combat/HUD compatibility key while `spellTree.root.spellContentId` stores the hidden runeword content.
  - `node --check src/potion_spell_content.js`: passed.
  - `node --check src/ui/rune_launcher.js`: passed.
  - `node tests/validate_potion_spell_content.mjs`: 22/22 passed.

## Sync Gates

- 2026-07-22 UI integration progress docs: `TODO.md`, `docs/p0_interaction_optimization_todo.md`, this umbrella card, and child cards A-D now carry the merge mappings and integrated/closed status; the integration card remains the sole owner of final evidence.
- 2026-07-22 UI integration rules/tests: integration-owned rule/test/index changes are tracked by Goal E and must be generated/verified before its final commit; no generated auto index was manually edited by this documentation pass.
- 2026-07-22 retained debt: language/version unification, formal bitmap replacement, and offline shell/CSS cleanup remain explicit P2 work; only reduced-motion coverage from the mobile batch is done.
- 2026-07-22 verification/index closeout: syntax `89/89`, validators `2774/2774`, T3 `32/32`, and full index scan (`36` indexed / `27` skipped) passed; final code/test/index delivery belongs to the current implementation commit.

- Auto index: updated for `src/ui/rune_launcher.js` and `src/ui_system.js` through `scripts/generate_index.py`.
- Potion P0 slice auto index: updated for `src/ui/rune_launcher.js`, `src/combat_system.js`, and `src/game_phase.js` through `scripts/generate_index.py`.
- Module docs: `.cursor/rules/ui_system.md` updated with the pinboard-fusion launcher feedback contract.
- Potion P0 slice module docs: `docs/rune_potion_spell_contract.md`, `docs/potion_alchemy_development_plan.md`, `src/combat/combat.md`, `.cursor/rules/ui_system.md`, `.cursor/rules/performance.md`, and `tests/README.md` updated.
- Progress docs: `docs/p0_interaction_optimization_todo.md` updated for the completed feedback-chain item.
- Potion progress docs: `TODO.md`, `docs/p0_interaction_optimization_todo.md`, `docs/rune_potion_spell_contract.md`, and `docs/potion_alchemy_development_plan.md` use `done / placeholder / contract-only / debt` for potion status.
- Potion C4 docs: `TODO.md`, `docs/p0_interaction_optimization_todo.md`, `docs/rune_potion_spell_contract.md`, `docs/potion_alchemy_development_plan.md`, `.cursor/rules/ui_system.md`, `.cursor/rules/runeword_index.md`, and `docs/work_items/active/REQ-20260630-potion-c4-spell-content.md` updated.
- Process insights: pending; add only if a non-obvious coupling or recurring trap is discovered.
- Temporary files: no scratch files added. Dev server was started for browser check and closed by PID.
- Verification: Checkpoint 0 baseline passed; Checkpoint 1 partial batch passed available static checks and in-app browser DOM check.
