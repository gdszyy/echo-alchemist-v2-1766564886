# REQ-20260717-first-run-tutorial

Status: Integrated / Closed
Owner: Codex
Started: 2026-07-18
Last updated: 2026-07-22

## Outcome

让全新存档的新手教程沿当前真实主流程“首个遗物 -> `marble_pack` -> gathering -> combat”完整完成，不再等待不会发生的普通 `selection`，并修复延迟启动竞态、错误交互文案、监听/定时器泄漏与重复完成点。

## Required reading

- [x] `AGENTS.md`
- [x] `.cursor/rules/global.md`
- [x] `TODO.md`
- [x] `docs/p0_interaction_optimization_todo.md`：`UX-P0-01` / `UX-P1-11`
- [x] `docs/work_items/active/REQ-20260627-health-all-phases.md`：Goal A 完整合同
- [x] `.cursor/rules/tutorial_system.md`
- [x] `.cursor/rules/testing.md`
- [x] `.cursor/rules/process_insights/PI-008_tutorial_overlay_rune_launcher_tab_block.md`

## Isolation and scope

- Branch: `codex/REQ-20260717-first-run-tutorial`
- Worktree: `D:\\claude\\echo-alchemist-REQ-20260717-first-run-tutorial`
- Base commit: `6f5a74e26858d92549a97ab2408769b02be3ad2c`
- Root checkout baseline was dirty with unrelated combat/docs/music work plus the umbrella planning edits. Those paths remain untouched; this REQ starts from the committed HEAD in a clean sibling worktree.

Write ownership is limited to:

- `src/tutorial_system.js`
- `tests/validate_tutorial_flow.mjs`
- `.cursor/rules/tutorial_system.md`
- `docs/work_items/active/REQ-20260717-first-run-tutorial.md`
- script-generated `.cursor/rules/auto_index/src_tutorial_system_js_index.md` and auto-index metadata changed by the required generator, if any

Do not modify `game_system.js`, `game_phase.js`, `index.html`, central TODOs, the umbrella card, shared runners, or other implementation batches. If the fix requires crossing this boundary, stop with evidence.

## Acceptance contract

- [x] The relic step follows the real `marble_pack -> gathering` transition and never waits for ordinary `selection`.
- [x] The delayed initial/restart start is cancellable and cannot create a stale tutorial after restart, skip, or phase invalidation.
- [x] Step listeners advance synchronously on the real event and are removed on step change/tutorial end; no missable 600ms delayed advance remains.
- [x] Relic-selection copy describes desktop single-click and coarse-pointer preview/second-tap behavior truthfully.
- [x] Gathering launch guidance uses the real 85% input region, not 40%.
- [x] Tutorial completion persistence has one idempotent owner; replay, skip, and old-save compatibility do not regress.
- [x] Fresh-save desktop browser flow reaches combat and completes the tutorial without a manual skip.
- [x] Fresh-save 390x844 browser flow reaches combat and completes the tutorial without a manual skip.
- [x] The `start_run` card stays above the highlighted button at desktop and 390x844 instead of intercepting the required click.

## Verification

- [x] `node --check src/tutorial_system.js`
- [x] `node tests/validate_tutorial_flow.mjs` — 36/36 passed
- [x] `node tests/validate_phase_contracts.mjs` — 173/174, identical to the documented pre-change baseline; the only red check is the integration-owned order-sensitive gathering-HUD regex
- [x] Desktop fresh-localStorage browser flow on `http://localhost:3002`
- [x] 390x844 fresh-localStorage browser flow on `http://localhost:3002`
- [x] Browser console checked and screenshots recorded outside the repository under the REQ visualization evidence directory
- [x] Auto index regenerated with `scripts/generate_index.py`
- [x] `git diff --check`
- [x] `git status --short --branch` contained only the five owned delivery paths before commit and is clean after the delivery commit
- [x] Locally started server stopped by exact PID/process tree; PID 23300 is gone and port 3002 is free

## Iteration and stop rules

- Any failed check must be diagnosed, fixed inside the owned write set, and rerun at the same layer before advancing.
- Partial implementation, a known red test, missing browser evidence, stale index, running service, or unattributed Git path is not completion.
- `Blocked` is allowed only after the same external blocker recurs for three consecutive goal turns; record attempts, evidence, and the smallest required user input first.

## Verification log

- 2026-07-18: Required reading completed; clean isolated worktree created from committed HEAD `6f5a74e26858d92549a97ab2408769b02be3ad2c`.
- 2026-07-18: Pre-change `validate_phase_contracts.mjs` baseline was 173/174. Its sole failure, `gathering HUD converts DOM target centers into canvas coordinates`, is already assigned by the umbrella Goal E to the integration batch; this tutorial-only batch introduced no additional failure.
- 2026-07-18: Red-first tutorial T1 produced 10/28 before the implementation. After lifecycle/flow fixes it passed 35/35; browser verification then exposed a real 720px-height blocker where the bottom-fixed tutorial card intercepted the highlighted start button. The card was moved above its target, a regression assertion was added, and T1 passed 36/36.
- 2026-07-18: Final static verification: `node --check src/tutorial_system.js` passed; `node tests/validate_tutorial_flow.mjs` passed 36/36; `node tests/validate_phase_contracts.mjs` remained at the same 173/174 baseline.
- 2026-07-18: Desktop used fresh origin `desktop2-req20260717-0718.localhost:3002`; 390x844 used fresh origin `mobile-req20260717-0718.localhost:3002`. Both completed welcome -> start run -> first relic -> automatic `marble_pack` -> gathering -> combat fire -> completion CTA. Reloading each same origin did not relaunch the tutorial, proving completion persistence. The in-app browser exposes a fine pointer at both viewport sizes, so the live copy correctly used single-click; the coarse-pointer copy branch is locked by T1.
- 2026-07-18: Browser console reported zero errors. Existing non-blocking warnings were the Tailwind CDN production notice and unavailable optional audio samples; neither originates in the owned tutorial paths.
- 2026-07-18: Browser evidence is stored outside Git at `C:/Users/Administrator/.codex/visualizations/2026/07/17/019f70e6-ce1b-7892-a314-c67dc2d52612/REQ-20260717-first-run-tutorial/` (desktop/mobile welcome, unblocked start, relic/gathering/combat, and completion screenshots).
- 2026-07-18: The committed worktree lacks integration-owned untracked `src/music_clip_packs.js` while committed `core.js` imports it. Browser verification therefore served that single dependency read-only from the dirty root checkout without copying or editing it; every tutorial/runtime file under test came from this isolated worktree.
- 2026-07-18: Auto index regenerated through `scripts/generate_index.py`; `git diff --check` passed. Temporary server command was an in-memory Node static server on port 3002, PID 23300; it was stopped exactly, has no remaining child, and port 3002 is free.
- 2026-07-18: Final status-word search found historical ordinary-`selection` tutorial claims in integration-owned central TODOs. Goal A correctly left them for Goal E; the 2026-07-22 integration sync has now superseded those claims with the real `marble_pack -> gathering -> combat` flow.

## Sync gates

- Auto index: required because `src/tutorial_system.js` is an indexed large file; generator only, never manual edits.
- Module docs: `.cursor/rules/tutorial_system.md` is owned and must describe the final lifecycle/step contract.
- Progress docs: this child branch only wrote its own card; central TODO/P0 TODO/umbrella were integration-owned and have now been synchronized on the integration branch.
- Process insights: PI-008 read as context; no PI write is authorized in this batch.
- Assets/performance: not applicable; no visual asset or rendering-budget change is planned.
- Temporary evidence: screenshots stay outside the repository in the Codex visualization evidence directory and do not enter the commit.

## Integration closure (2026-07-22)

- Delivery commit `d7ea424` was integrated as `4d568c3` on `codex/REQ-20260717-ui-polish-integration`.
- Goal E retained the real tutorial sequence `relic -> marble_pack -> gathering -> combat`; the old ordinary-`selection` wording in central progress documents is superseded.
- The historical `173/174` phase-contract result above belongs to this isolated delivery's pre-integration baseline. The integration branch now passes the runtime-semantic phase contract at `175/175` and terminology validation at `36/36`.
- Goal E final acceptance passed: source/test syntax `89/89`; all `23/23 validate_*` suites `2774/2774`; four actual viewports T3 `32/32` with 12 PNG + JSON, zero unclassified issues and zero horizontal overflow. Evidence: `D:/claude/echo-alchemist-v2-1766564886/tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/ui-polish-report.json`.
- This child request is closed as integrated; any remaining final evidence work belongs to `REQ-20260717-ui-polish-integration`.
