# REQ-20260630-potion-c4-c8-acceptance

Status: accepted
Owner: Codex
Accepted: 2026-06-30

## Scope

本验收文档汇总四个已跑完的药剂炼成 goal：

- C4 `spellContent` 解析：从 3 枚符文按 `RUNEWORD_DB.pattern` 生成隐藏法术节点。
- C5 兼容收口：`preparedPotionSpell` 保留旧 `potionId`，同时保存 root `spellTree`。
- C6 多节点嵌套 UI：继续投料、父子查表、非法整炉坍塌、不返还符文。
- Tower foundation + C8 polish：Root Orb / Tower 基础战斗运行时，以及炼金台 runtime fallback 资产表现层。

## Verdict

验收通过。当前药剂线可按以下状态词归档：

- `done`：C1 中断与覆盖边界、C4 `spellContent` 解析、C6 多节点嵌套 UI、root `spellTree` 保存、Root Orb carrier、Tower 基础系统、共享嵌套校验、C8 runtime fallback 资产 polish。
- `contract-only`：静态药剂 metadata、药瓶 VFX helper、通用法阵 VFX dispatcher。
- `debt`：Tower 专用资产、长期多塔平衡、深层子法术调度、正式 PNG/chroma 药剂美术替换。

没有把 C6 / Tower / C8 反写成 C4 范围；四个 goal 的交付边界已分别落到独立 work item、合同和测试入口。

## Acceptance Matrix

| 验收项 | 结论 | 证据 |
|---|---|---|
| 合法 `RUNEWORD_DB` 组合能生成隐藏 `spellContent` 节点 | pass | `src/potion_spell_content.js`、`tests/validate_potion_spell_content.mjs`，22/22 passed |
| 不合法/禁用组合进入失败或未成法路径，符文不返还规则不破坏 | pass | `tests/validate_potion_spell_content.mjs`、`tests/validate_potion_c6_nesting_ui.mjs`、`tests/validate_phase_contracts.mjs` |
| `preparedPotionSpell` 继续保留旧 `potionId` 并保存 root `spellTree` | pass | `src/ui/rune_launcher.js`、`.cursor/rules/ui_system.md`、`tests/validate_potion_spell_content.mjs` |
| 封装前 UI 只显示黑箱稳定性，不显示具体结果 | pass | `tests/validate_potion_spell_content.mjs`、`tests/validate_potion_c6_nesting_ui.mjs` 覆盖 `spellContentId` / `runewordId` / `spellType` / 药剂名不泄露 |
| C6 合法嵌套接入 `root.children` | pass | `tests/validate_potion_c6_nesting_ui.mjs`，29/29 passed |
| C6 非法嵌套整炉坍塌且不返还符文 | pass | `tests/validate_potion_c6_nesting_ui.mjs` |
| Tower 基础系统覆盖阻挡/承伤/范围/冷却/生命周期/互斥/非法树拒绝 | pass | `tests/validate_potion_spell_tree_combat.mjs`，26/26 passed |
| C8 只接表现层 fallback，不改投料、解析、嵌套、封装、返还或战斗规则 | pass | `src/styles/bitmap_ui.css`、`assets/ui/panels/potion/`、`assets/ui/sprites/potion/`、`.cursor/rules/ui_system.md` |
| 状态词边界清晰，无旧多节点遗留项或防御塔越界口径 | pass | 已同步 `TODO.md`、`docs/potion_alchemy_development_plan.md`、`docs/rune_potion_spell_contract.md`、`docs/p0_interaction_optimization_todo.md`、`docs/work_items/active/REQ-20260627-health-all-phases.md` |

## Verification

| 命令 | 结果 |
|---|---|
| `node --check src/ui/rune_launcher.js` | pass |
| `node --check src/potion_nesting.js` | pass |
| `node --check src/potion_spell_content.js` | pass |
| `node --check src/combat_system.js` | pass |
| `node tests/validate_rune_spell_forms.mjs` | 8/8 passed |
| `node tests/validate_potion_nesting.mjs` | 10/10 passed |
| `node tests/validate_potion_spell_content.mjs` | 22/22 passed |
| `node tests/validate_potion_c6_nesting_ui.mjs` | 29/29 passed |
| `node tests/validate_potion_spell_tree_combat.mjs` | 26/26 passed |
| `node tests/validate_potion_vfx_contract.mjs` | 66/66 passed |
| `node tests/validate_spell_vfx_design.mjs` | 43/43 passed |
| `node tests/validate_phase_contracts.mjs` | 174/174 passed |
| `node tests/validate_scenarios.js` | 128/128 passed |

运行提示：

- Node 对未声明 `type: module` 的 ES module 文件给出 `MODULE_TYPELESS_PACKAGE_JSON` 警告；本轮未改 package 类型。
- `enemy_visual_assets` 在 Node 静态测试环境下无法按 URL 读取 manifest，走内嵌默认值；不影响药剂验收。

## Synced Files

代码与测试：

- `src/potion_spell_content.js`
- `src/ui/rune_launcher.js`
- `src/combat_system.js`
- `src/core.js`
- `src/styles/bitmap_ui.css`
- `tests/validate_potion_spell_content.mjs`
- `tests/validate_potion_c6_nesting_ui.mjs`
- `tests/validate_potion_spell_tree_combat.mjs`
- `tests/validate_phase_contracts.mjs`

资产与资产清单：

- `assets/ui/panels/potion/potion_alchemy_furnace_runtime.svg`
- `assets/ui/sprites/potion/potion_circle_stable_runtime.svg`
- `assets/ui/sprites/potion/potion_circle_rejected_runtime.svg`
- `assets/ui/sprites/potion/potion_collapse_smoke_runtime.svg`
- `assets/ui/sprites/potion/potion_bottle_slot_runtime.svg`
- `assets/ui/sprites/potion/potion_unknown_core_runtime.svg`
- `assets/ui/sprites/potion/potion_unknown_link_runtime.svg`
- `docs/asset_gap_index.md`
- `docs/ui_asset_requirements.md`
- `design_spec_bitmap.md`
- `docs/art_asset_generation_guidelines.md`

规范、计划与索引：

- `TODO.md`
- `.cursor/rules/ui_system.md`
- `.cursor/rules/runeword_index.md`
- `.cursor/rules/auto_index/src_ui_rune_launcher_js_index.md`
- `.cursor/rules/auto_index/src_combat_system_js_index.md`
- `.cursor/rules/auto_index/src_core_js_index.md`
- `docs/potion_alchemy_development_plan.md`
- `docs/rune_potion_spell_contract.md`
- `docs/p0_interaction_optimization_todo.md`
- `src/combat/combat.md`
- `tests/README.md`
- `docs/work_items/active/REQ-20260630-potion-c4-spell-content.md`
- `docs/work_items/active/REQ-20260630-potion-c6-nesting-ui.md`
- `docs/work_items/active/REQ-20260630-potion-tower-foundation.md`
- `docs/work_items/active/REQ-20260630-potion-c8-polish.md`
- `docs/work_items/active/REQ-20260627-health-all-phases.md`

## Worktree Ownership

随本验收包提交：

- 药剂运行时代码、测试、药剂 runtime fallback SVG、药剂合同/计划/TODO/测试 README、自动函数索引。

状态/收尾同步，可随同一批次或单独提交：

- `docs/work_items/active/REQ-20260630-task-closeout-git-hygiene.md`
- `docs/health_all_phases_goal_handoff.md`

并行改动，不属于本验收包：

- `docs/architecture/music_processing/clip_pack.*.json`
- `src/music_clip_packs.js`

当前分支在验收时为 `main...origin/main [ahead 16]`，工作区仍有未提交/未跟踪文件；本验收轮未执行 commit、stash 或 push。

## Remaining Work

后续推荐只开 debt 批次，不回改已验收的 C4-C8 基础合同：

- Tower 后续 polish：专用视觉资产、长期多塔平衡、深层子法术调度和专项训练/静态验证。
- 正式 PNG/chroma 药剂美术替换：以现有 runtime SVG 语义等价替换，不改机制。
- 浏览器实机回归：仅在需要交互体验复核时启动 `http://localhost:3002`，并按 AGENTS 记录 PID 与关闭方式。
