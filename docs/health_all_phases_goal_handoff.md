# Echo Alchemist V2 后续全 Phase Goal 交接文档

最后更新：2026-06-27
适用对象：后续 Codex / Codex Agent
目标用途：把后续项目健康度治理、交互打磨、药剂炼成、位图资产、PixiJS 性能验证与元素视觉后续阶段纳入一个可持续执行的 `/goal`。

## 1. 当前基线

当前工作区在本交接文档创建前已经收口到干净状态：

- 最新基线提交：`1287345 chore: refresh generated code indexes`
- `git status --short`：为空
- Phase 1 goal 状态：`complete`
- Phase 2 已按 goal-like 约束手动完成，原因是旧 Phase 1 goal 虽已完成但仍占用当前线程 goal 槽位

最近关键提交：

| Commit | 内容 |
|---|---|
| `4858eed` | 定义健康度交付边界 |
| `9acd073` | 接入敌人视觉 runtime assets |
| `09512fd` | 调整敌人波次与词缀行为，含性能影响标记 |
| `f71dde0` | 接入药剂法术与技能 VFX，含性能影响标记 |
| `0d24af8` | 补齐遗物图标资产覆盖 |
| `0216227` | 更新 Agent 指南并归档过期计划 |
| `5e1c6a3` | 增加 Boss 音乐编排工具 |
| `ed21085` | 增加敌人视觉源资产 |
| `9cc3069` | 归档已废弃敌人美术迭代说明 |
| `a3a45bf` | 补齐遗物图标 raw 源图 |
| `1287345` | 刷新自动生成代码索引 |

## 2. 启动前注意

当前线程的 Goal 工具里仍保留一个已完成的 Phase 1 goal。若要把后续所有 Phase 放进一个新 goal，先执行其中一种方式：

1. 在当前线程清理已完成 goal 后，再粘贴本文第 8 节的 `/goal` 草案。
2. 开一个新线程，带上本交接文档路径，再粘贴第 8 节的 `/goal` 草案。

不要在旧 Phase 1 goal 仍占位时尝试创建新 goal；这会失败，并导致后续状态不好追踪。

## 3. 总体执行策略

这不是“把所有 TODO 盲目做完”。本 goal 的范围冻结在 2026-06-27 已记录的项目健康度后续阶段，所有新增想法默认进入文档 backlog，除非用户明确把它纳入当前 goal。

执行时坚持：

- 一个总 goal，多个检查点。
- 每个检查点只处理一个可验证主题。
- 每个检查点结束时提交小步 commit。
- 每次修改架构、API、状态、核心逻辑时同步更新对应 `.cursor/rules/` 或 `docs/` 文档。
- 修改已索引大文件后运行 `scripts/generate_index.py` 更新对应 auto index。
- 不把运行时代码、生成资产、归档材料、个人实验文件混成一个大提交。
- 不因为预算耗尽、部分通过或“看起来差不多”而标记完成。

## 4. 必读入口

每次恢复 goal 后，后续 Codex 必须先读：

- `AGENTS.md`
- `.cursor/rules/global.md`
- `TODO.md`
- `docs/p0_interaction_optimization_todo.md`
- `docs/plan_goal_collaboration_guidelines.md`
- `docs/health_phase2_delivery_boundaries.md`
- `.cursor/rules/auto_index/INDEX.md`

按当前检查点追加阅读：

| 检查点 | 追加必读 |
|---|---|
| P1 交互与符文发射器 | `.cursor/rules/ui_system.md`, `.cursor/rules/game_phase.md`, `.cursor/rules/events.md`, `docs/p0_interaction_optimization_todo.md` |
| 药剂炼成 | `docs/rune_potion_spell_contract.md`, `docs/potion_alchemy_development_plan.md`, `docs/spell_vfx_design.md`, `.cursor/rules/config.md`, `src/combat/combat.md` |
| 遗物 / 商店 / 真理之书 | `.cursor/rules/systems.md`, `.cursor/rules/config.md`, `docs/core_mechanics.md`, `docs/p0_interaction_optimization_todo.md` |
| 位图资产 | `design_spec_bitmap.md`, `docs/art_asset_generation_guidelines.md`, `docs/ui_asset_requirements.md`, `docs/asset_gap_index.md` |
| 敌人 / Boss 资产 | `docs/enemy_visual_design_v2.md`, `docs/enemy_art_implementation_impact.md`, `docs/enemy_wave_preset_design.md`, `docs/enemy_v2_asset_protocol.md` |
| PixiJS / 性能 | `docs/pixijs_migration_todo.md`, `.cursor/rules/performance.md`, `.cursor/rules/process_insights/PI-005_perf_impact_assessment.md`, `.cursor/rules/process_insights/PI-010_pixijs_webgl_rendering_migration.md` |
| 元素视觉 | `docs/element_visual_redesign.md`, `docs/shooting_vfx_pixijs_enhancement_plan.md`, `.cursor/rules/performance.md` |

## 5. 建议检查点顺序

### Checkpoint 0：基线复核

目标：确认当前基线没有未提交改动，测试入口可运行，旧 goal 状态不会污染新 goal。

验收：

- `git status --short` 为空，或任何新差异都有明确来源。
- 第 7 节的基础验证命令至少跑一轮。
- 若启动 dev server，必须按 `AGENTS.md` 记录端口、PID、关闭方式；默认端口 `3002`。

### Checkpoint 1：P1 交互健康度收口

目标：收口 `docs/p0_interaction_optimization_todo.md` 中后续 P1 / P2 清单的交互健康项，优先顺序为符文发射器信息架构、移动端长列表/安全区、遗物/商店/真理之书卡片语法。

验收：

- 符文发射器配置、管理、词条图鉴三类信息层级清楚。
- 钉板符文融合结果能明确反馈到发射器可用词条。
- 移动端长列表、Tab 切换、底部确认区不被安全区遮挡。
- 奖励、购买、图鉴卡片状态语法统一。
- 相关静态测试和必要浏览器脚本通过。

### Checkpoint 2：药剂炼成闭环

目标：按 `docs/potion_alchemy_development_plan.md` 推进 C1-C8，但每轮只做一个独立可验收批次。

推荐顺序：

1. C1：中断与覆盖边界。
2. C2-C3：法阵选择 MVP 与合法性表。
3. C4：从 `RUNEWORD_DB` 解析 `spellContent`（2026-06-30 已完成）。
4. C5-C6：`spellTree` 存档与嵌套 MVP。
5. C7：战斗层按 `spellTree` 释放。
6. C8：资产与体验 polish。

验收：

- 投料即消耗、黑箱不泄露、失败返还规则保持稳定。
- 旧 `potionId` 存档兼容路径保留。
- 禁用组合不能封装，查不到合法性即拒绝。
- 战斗释放不扣错装药，不绕过目标/弹药/阶段校验。
- 新增 VFX 或持续特效必须补 `// @perf-impact` 与性能自适应评估。

### Checkpoint 3：位图化 UI 与资产覆盖

目标：继续 Phase 5 / Phase A-B-C 中仍有价值的位图资产接入，但先处理静态装饰层和缺口清晰的图标，不同时改交互机制。

验收：

- `docs/ui_asset_requirements.md` 中被处理项状态同步更新。
- 新增 runtime PNG/JSON 必须有引用方或 manifest，不提交未引用的大批中间图。
- `docs/archive/**/*.png` 与 `docs/archive/**/*.json` 默认不强制入库，除非用户明确要求或需要代表性 contact sheet。
- 图标、9-Slice、Sprite 接入后不破坏现有 DOM 事件与 Canvas 逻辑。

### Checkpoint 4：敌人 / Boss 视觉后续

目标：基于已收口的敌人视觉 runtime assets，继续处理高价值 Boss、敌人组合、状态 overlay 与训练场验证入口。

验收：

- manifest 引用完整，缺失资源有 fallback。
- `tests/validate_enemy_spawn_runtime.mjs` 与 `tests/validate_wave_presets.mjs` 通过。
- Boss 或大型敌人新增视觉不破坏碰撞 footprint、HP 条、shield/affix overlay 层级。
- 修改敌人渲染、发光、粒子、混合模式时遵循性能标记规范。

### Checkpoint 5：PixiJS 性能验证与剩余迁移

目标：按 `docs/pixijs_migration_todo.md` 处理未完成的 Phase 4 性能验证、T3.12 对象池优化，以及必要的 WebGL fallback 验证。

验收：

- 压测场景有可复现入口或脚本。
- high / medium / low 三档表现被记录。
- WebGL 不可用时 Canvas fallback 不崩。
- 相关 commit 使用 `[pixi-migration] [perf-impact]`，并在总结中包含性能自适应影响评估。

### Checkpoint 6：元素视觉后续阶段

目标：推进 `docs/element_visual_redesign.md` 与 `TODO.md` 阶段七中 Phase 2-4 的高价值项，优先做 Bounce、Lightning、Pyro/Cryo/Venom/Wind 等可复用增强。

验收：

- 新效果受 `CONFIG.performance` 或已有预算控制。
- PixiJS 与 Canvas fallback 路径一致。
- 不把元素视觉增强与药剂机制、UI 信息架构混在同一提交。
- 所有高开销视觉改动都有 `@perf-impact` 标记与三档评估。

### Checkpoint 7：文档、索引与最终清理

目标：所有被推进的阶段都有文档、测试、索引和提交证据。未完成项必须明确变为 backlog 或 deferred，不留“聊天里知道但仓库里找不到”的状态。

验收：

- `TODO.md` 与相关专题 docs 状态一致。
- `.cursor/rules/auto_index/` 与源码同步。
- `git status --short` 为空。
- 总结列出所有提交、验证命令、未验证项和剩余风险。

## 6. 禁止事项

- 禁止全量重写超过 500 行的大文件。
- 禁止手动编辑 `.cursor/rules/auto_index/`；只能运行索引脚本生成。
- 禁止回滚或删除非本轮 Codex 产生的用户改动。
- 禁止业务逻辑模块直接新增 DOM 操作；UI 更新应走 UI 层或 EventBus。
- 禁止把临时日志、个人实验脚本、未引用资源、旧 pass 大图混入正式提交。
- 禁止静默遗留 dev server。
- 禁止把预算耗尽、阶段中断或测试未跑当成完成。

## 7. 验证命令池

基础验证：

```powershell
git status --short
git diff --check
node --check src/core.js
node --check src/game_system.js
node --check src/combat_system.js
node --check src/ui_system.js
node --check src/systems.js
node --check src/entities/enemy.js
node tests/validate_scenarios.js
node tests/validate_phase_contracts.mjs
```

敌人、波次与 Boss：

```powershell
node tests/validate_enemy_spawn_runtime.mjs
node tests/validate_wave_presets.mjs
node tests/validate_boss_sprite_assets.mjs
node tests/validate_boss_vulnerability.mjs
node tests/validate_boss_vulnerability_assets.mjs
node tests/validate_boss_vulnerability_threshold_growth.mjs
```

药剂、符文与 VFX：

```powershell
node tests/validate_rune_spell_forms.mjs
node tests/validate_potion_vfx_contract.mjs
node tests/validate_spell_vfx_design.mjs
```

钉板与世界模拟：

```powershell
node tests/validate_pinboard_mechanisms.mjs
node tests/validate_world_sim.mjs
```

自动索引：

```powershell
python scripts/generate_index.py . --file src/ui_system.js
python scripts/generate_index.py . --file src/systems.js
python scripts/generate_index.py . --file src/spawn_system.js
python scripts/generate_index.py . --file src/entities/enemy.js
python scripts/generate_index.py . --file src/combat_system.js
python scripts/generate_index.py . --src-dirs src
```

只在做全量索引基线时运行 `--src-dirs src` 并提交全目录索引变化；日常修改优先单文件更新。

浏览器验证需要 dev server 时：

```powershell
netstat -ano | findstr :3002
npm start
```

验证后必须关闭自己启动的进程，或在总结中明确服务 URL、端口、PID 和关闭方式。

## 8. 可直接复制的 `/goal` 草案

```text
/goal 以 2026-06-27 当前仓库基线为起点，完成 Echo Alchemist V2 后续项目健康度全 Phase 收口：P1 交互健康度、药剂炼成闭环、位图化 UI/敌人/Boss 资产后续、PixiJS 性能验证与剩余迁移、元素视觉后续阶段、最终文档/索引/工作区清理。完成标准是相关代码、资产、文档和测试都以小步提交落地，TODO 与专题文档状态同步，自动索引与源码一致，最终 git status --short 为空，并用验证命令和提交列表证明完成。

开始前必须阅读 AGENTS.md、.cursor/rules/global.md、TODO.md、docs/p0_interaction_optimization_todo.md、docs/plan_goal_collaboration_guidelines.md、docs/health_phase2_delivery_boundaries.md、docs/health_all_phases_goal_handoff.md、.cursor/rules/auto_index/INDEX.md；进入具体检查点时，再阅读该检查点对应的专项规范，例如药剂炼成读 docs/rune_potion_spell_contract.md、docs/potion_alchemy_development_plan.md、docs/spell_vfx_design.md，位图资产读 design_spec_bitmap.md、docs/art_asset_generation_guidelines.md、docs/ui_asset_requirements.md，PixiJS/性能读 docs/pixijs_migration_todo.md、.cursor/rules/performance.md 和相关 process insights。

按检查点推进并在每个检查点结束时提交：0 基线复核；1 P1 交互健康度收口；2 药剂炼成 C1-C8 分批闭环；3 位图化 UI 与资产覆盖；4 敌人/Boss 视觉后续；5 PixiJS 性能验证与剩余迁移；6 元素视觉 Phase 2-4；7 文档、自动索引与最终清理。每个检查点必须先限定影响文件和编辑策略，再实施、验证、提交、记录剩余风险；验证失败必须先修复再进入下一个检查点。

约束：不得全量重写超过 500 行的大文件；不得手动编辑 .cursor/rules/auto_index/；不得回滚或删除用户已有改动；不得把运行时代码、生成资产、归档材料和个人实验文件混成一个大提交；不得静默启动或遗留 dev server；业务逻辑模块不得直接新增 DOM 操作；新增粒子、特效、发光、混合模式、PixiJS 迁移或敌人渲染高开销改动必须添加 // @perf-impact，commit message 加 [perf-impact]，PixiJS 迁移同时加 [pixi-migration]，并在总结中说明 high/medium/low 三档表现和 CONFIG.performance 预算接入情况。

基础验证命令池包括 git diff --check、node --check src/core.js、node --check src/game_system.js、node --check src/combat_system.js、node --check src/ui_system.js、node --check src/systems.js、node --check src/entities/enemy.js、node tests/validate_scenarios.js、node tests/validate_phase_contracts.mjs、node tests/validate_enemy_spawn_runtime.mjs、node tests/validate_wave_presets.mjs、node tests/validate_rune_spell_forms.mjs、node tests/validate_potion_vfx_contract.mjs、node tests/validate_spell_vfx_design.mjs，并按实际影响追加 boss、pinboard、world_sim 或浏览器验证。修改已索引大文件后按 AGENTS.md 运行 scripts/generate_index.py 更新对应索引。

只有当所有检查点均完成或被明确记录为 deferred 且有原因、所有相关测试通过或未跑原因清楚、文档状态一致、自动索引同步、工作区干净时，才能把 goal 标记为 complete。若同一外部阻塞连续三轮无法突破，报告已尝试路径、证据、阻塞原因和需要用户提供的最小决策，再按 goal 规则标记 blocked。
```

## 9. 完成汇报模板

```markdown
完成状态：
- Goal 状态：
- 当前 HEAD：
- git status：

本轮提交：
- `<hash>` `<message>`

完成的检查点：
- Checkpoint N：

验证：
- `<command>`：通过/失败/未运行原因

性能自适应影响评估：
- high：
- medium：
- low：
- CONFIG.performance 接入：

未完成 / Deferred：
- 项目：
- 原因：
- 后续入口：

服务状态：
- 是否启动 dev server：
- URL / 端口 / PID：
- 是否已关闭：
```
