# 流程洞察注册表 (Process Insights Index)

本文档是 `.cursor/rules/process_insights/` 目录下所有洞察文档的注册表。
每次新增、更新或废弃洞察时，**必须同步更新本文件**。

> **使用指南**：当你的任务涉及复杂的跨模块流程或历史上曾出现过 Bug 的逻辑区域时，
> 请先查阅本索引，找到相关洞察文档并读取，以避免重复踩坑。

---

## 活跃洞察 (Active Insights)

当前共有 **7** 条活跃洞察。

| ID | 标题 | 版本 | 关联模块 | 最后更新 | 文档链接 |
|----|------|------|---------|---------|---------|
| PI-001 | 核心 Bug 修复流程与高频陷阱 | v1.2 | game_phase, ui_system, game_system | 2026-04-16 | [PI-001_critical_bugfix_flow.md](PI-001_critical_bugfix_flow.md) |
| PI-002 | 符文词条 Hook 注入流程 | v1.0 | rune_system, combat_system, ui_system, rune_launcher | 2026-04-16 | [PI-002_runeword_hook_injection.md](PI-002_runeword_hook_injection.md) |
| PI-003 | 子系统扩展与组合模式注入流程 | v1.0 | core, game_system, combat_system, ui_system | 2026-04-16 | [PI-003_subsystem_composition_pattern.md](PI-003_subsystem_composition_pattern.md) |
| PI-004 | 性能预算扩展与新特效接入流程 | v1.0 | performance, spawn_system, combat_system, entities | 2026-04-16 | [PI-004_performance_budget_extension.md](PI-004_performance_budget_extension.md) |
| PI-005 | 性能自适应影响评估流程 | v1.0 | performance, combat_system, effects, entities, render_system, spawn_system | 2026-04-16 | [PI-005_perf_impact_assessment.md](PI-005_perf_impact_assessment.md) |
| PI-006 | Round-Start 延迟奖励结算流程 | v1.0 | game_phase, game_system, core, ui/shop | 2026-04-17 | [PI-006_round_start_reward_resolver.md](PI-006_round_start_reward_resolver.md) |
| PI-007 | 命运时刻 Overlay 返回流与纯净精华选择模式 | v1.0 | ui/shop, game_system, ui_system, spawn_system, game_phase, entities, config, core | 2026-04-18 | [PI-007_destiny_overlay_return_and_selection_mode.md](PI-007_destiny_overlay_return_and_selection_mode.md) |

### 按模块快速检索

| 模块 | 相关洞察 |
|------|---------|
| `game_phase.js` | PI-001（阶段切换双重赋值、round++ 重复执行）、PI-006（回合结束后必须进入 round-start resolver）、PI-007（纯净精华注入后的标准实体链路与同化倍率衰减） |
| `ui_system.js` | PI-001（multicast 颜色顺序、setDeepValue 双重调用）、PI-007（命运抉择动态数量与纯净精华注入 UI） |
| `game_system.js` | PI-001（specialSlots 初始化类型）、PI-003（sys_resetGame 新属性重置）、PI-006（pendingRoundStartRewards 存档/恢复）、PI-007（selectionMode / pendingSelectionMode / 选择态持久化） |
| `combat_system.js` | PI-002（词条 Hook 注入位置）、PI-003（组合模式）、PI-004（性能预算） |
| `rune_config.js` | PI-002（effectId 一致性） |
| `rune_launcher.js` | PI-002（activeRunewordEffects 数据结构） |
| `core.js` | PI-003（_subsystems 数组、组合模式）、PI-006（enemy:killed 只登记延迟奖励）、PI-007（选择态与双倍同化率运行态初始化） |
| `config.js` | PI-004（CONFIG.performance 三档配置）、PI-007（混沌精华 / 纯净精华 / 同化倍率显式配置） |
| `spawn_system.js` | PI-004（EnergyOrb 聚合优化）、PI-007（预览状态与纯净精华注入面板联动） |
| `effects/particles.js` | PI-004（未接入预算的高风险特效清单）、PI-005（性能自适应影响评估） |
| `render_system.js` | PI-005（性能自适应影响评估） |

---

## 已废弃洞察 (Deprecated Insights)

*（暂无废弃洞察。）*

| ID | 标题 | 废弃版本 | 废弃原因 | 废弃日期 |
|----|------|---------|---------|---------|
| — | — | — | — | — |

---

## 新增洞察指南

当你需要创建新的流程洞察时，请遵循以下步骤：

1. 在本目录下创建新文件，命名格式：`PI-{编号:03d}_{slug}.md`（如 `PI-005_audio_init_flow.md`）。
2. 按照以下模板填写内容：

```markdown
---
id: "PI-{编号}"
version: "v1.0"
last_updated: "YYYY-MM-DD"
author: "{Agent ID 或 Task ID}"
related_modules: ["{模块1}", "{模块2}"]
status: "active"
---

# PI-{编号}: {流程标题}

## 流程概述

（一段话描述该流程的核心目标）

## 核心防坑指南

### 坑 1: {坑位名称}

**现象**：（描述触发该问题的操作或场景）
**根因**：（解释为什么会发生）
**正确做法**：（给出明确的操作步骤或代码示例）
**关键位置**：`{文件路径}` → `{函数名}` 约第 {N} 行

## 关键耦合点

（描述该流程与其他模块的隐性依赖关系）

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | YYYY-MM-DD | 初始记录 | {Agent ID} |
```

3. 在本文件的"活跃洞察"表格中添加一行注册记录，并更新"按模块快速检索"表。
4. 将新增洞察的创建包含在当前任务的 Git Commit 中。

### 版本号管理规则

| 场景 | 操作 |
|------|------|
| 新增洞察 | 从 `v1.0` 开始 |
| 小幅修正（修正错误、补充细节） | 次版本号 +1（如 `v1.0 → v1.1`） |
| 重大更新（流程因重构发生根本变化） | 主版本号 +1（如 `v1.1 → v2.0`），并在 Changelog 中说明原因 |
| 废弃洞察 | 将 `status` 改为 `deprecated`，文档顶部添加废弃警告，并迁移到本文件的废弃区 |
