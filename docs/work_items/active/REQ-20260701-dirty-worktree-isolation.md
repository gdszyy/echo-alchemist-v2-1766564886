# REQ-20260701-dirty-worktree-isolation

Status: Done
Owner: Codex
Last updated: 2026-07-01
Current milestone: M4 clean checkout achieved

## Objective

Isolate the next implementation request from the existing historical and parallel dirty worktree, especially the 2026-07-01 art asset batch, before any code or asset changes are made.

## Baseline

- Branch: `main`, ahead of `origin/main` by 18 commits at intake.
- Cleanup branch: `codex/dirty-worktree-isolation`.
- Dirty summary at intake: 95 modified paths, 61 deleted paths, 141 untracked paths.
- Existing dirty areas include auto index files, UI/runtime assets, art handoff assets, source code, tests, active request cards, and generated concept/reference material.
- Existing 2026-07-01 art batch anchor paths include `docs/design/art_asset_batch_20260701_handoff.md`, `docs/design/concepts/art_batch_20260701/`, `assets/ui/archive/*20260701/`, and related UI/enemy/relic PNG assets.

## Scope

Allowed in this isolation request:

- Record the dirty-worktree baseline and ownership rules.
- Create a separate active request card for the next concrete requirement before implementation.
- Keep scratch notes under `tmp/codex/<REQ-ID>/` if needed.
- Report every newly dirty path as belonging either to the new request, an existing batch, or an unresolved prior change.

Out of scope:

- Do not clean, stash, delete, reset, or revert existing dirty files without explicit user approval.
- Do not stage or commit mixed batches.
- Do not hand-edit `.cursor/rules/auto_index/`.
- Do not fold new code/resource changes into `REQ-20260701-potion-tower-assets` or the 2026-07-01 art handoff batch.

2026-07-01 cleanup approval update:

- User explicitly approved沉淀规范、更新技能并清理工作区。
- Existing dirty state was protected with named stash `codex-clean-worktree-2026-07-01-before-governance`.
- Governance changes are intentionally separated from the stashed game/art/source batches and delivered as their own narrow commit on `codex/dirty-worktree-isolation`.
- Restore command after confirming the desired stash index:
  ```powershell
  git stash list
  git stash apply 'stash@{0}'
  ```

## Required Reading

- `AGENTS.md`
- `.cursor/rules/global.md`
- `TODO.md`
- `docs/p0_interaction_optimization_todo.md`
- `docs/design/art_asset_batch_20260701_handoff.md`
- `docs/work_items/active/REQ-20260701-potion-tower-assets.md`

## Isolation Rules For The Next Request

- Assign a new `REQ-20260701-<slug>` before changing files.
- Prefer creating a dedicated worktree before implementation:
  ```powershell
  git worktree add ..\echo-alchemist-REQ-20260701-<slug> -b codex/REQ-20260701-<slug>
  ```
- If a touched file is already dirty, inspect its diff first and record whether the new edit extends that same batch or creates a clearly separable change.
- Prefer narrow patches over broad formatting or line-ending churn.
- If generated/runtime assets are added, update the relevant manifest, asset gap index, UI requirement list, or request card in the same batch.
- If indexed large files are modified, regenerate the relevant auto index through `scripts/generate_index.py` only.
- End with `git status --short --branch` and `git diff --check`, and report whether dirty paths are historical, existing art-batch work, or current-request work.

## Milestones

- [x] M0 Baseline captured.
- [x] M1 Existing dirty state protected with a named stash after user approval.
- [x] M2 Worktree isolation rules promoted into AGENTS/global/TODO/PI-012.
- [x] M3 Feature governance skill updated with the same worktree/stash defaults.
- [x] M4 Final dirty-path ownership and clean checkout evidence recorded.

## Progress Log

| Date | Phase | Codex action | Result | Next step |
| :--- | :--- | :--- | :--- | :--- |
| 2026-07-01 | Intake | Read required entry docs and captured dirty summary. | Worktree is heavily dirty with existing art, UI, source, tests, docs, and auto index changes. | Create a separate request card when the next concrete requirement is provided. |
| 2026-07-01 | Cleanup | User approved governance update and cleanup; ran `git stash push -u -m "codex-clean-worktree-2026-07-01-before-governance"`. | Historical/parallel dirty state is preserved in stash; checkout returned to a clean baseline before governance edits. | Commit governance-only changes and keep future implementation in isolated worktrees. |
| 2026-07-01 | Governance | Updated AGENTS, global rules, TODO, PI-012, process insight index, this request card, and the local `feature-change-governance` skill. | Multi-Codex worktree isolation is now a durable rule instead of an ad hoc clean-up habit. | Final verification: `git diff --check`, `git status --short --branch`, stash list. |
