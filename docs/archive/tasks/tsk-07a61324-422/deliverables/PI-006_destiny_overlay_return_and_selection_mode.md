---
id: "PI-006"
version: "v1.0"
last_updated: "2026-04-17"
author: "agt-b0017003-1ad"
related_modules: ["ui/shop.js", "game_system.js", "ui_system.js", "spawn_system.js", "game_phase.js"]
status: "active"
---

# PI-006: 命运时刻 Overlay 返回流与纯净精华选择模式

## 流程概述

命运时刻相关改动同时跨越了遗物 overlay、选择阶段状态、预览 UI 与发射前实体灌入链路。最容易出错的地方不在单个函数，而在「打开 overlay 时来自哪个阶段」「关闭 overlay 后应该回到哪里」「当前选择阶段要求多少枚弹珠」「纯净精华注入的结果何时真正进入实体会话」这四个耦合点。

## 核心防坑指南

### 坑 1: 关闭遗物 / 命运 overlay 时默认重建旧 selection 流程

**现象**：玩家在命运时刻或选择阶段中途打开遗物相关 overlay，关闭后界面被强制重置到旧的 `sys_initSelectionPhase()`，导致已经进入的特殊选择态丢失，纯净精华模式直接退化回普通 `3 选`。

**根因**：旧实现只区分 `gathering` 与“其他”两类来源，把所有非 gathering 来源都视为“重新开始选择阶段”。

**正确做法**：打开 overlay 时写入 `relicOverlayReturnState`，关闭时按来源阶段恢复：
1. 来源为 `gathering`：调用 `phase_gathering_attemptComplete()` 继续收尾；
2. 来源为 `selection`：调用 `phase_switchPhase('selection')`，随后执行 `ui_updateUI()` 与 `ui_refreshSelectionModeUI()` 恢复当前界面；
3. 只有在没有来源信息时，才允许回退到 `sys_initSelectionPhase()` 作为兜底。

**关键位置**：`src/ui/shop.js` → `ui_showRelicSelection()` / `ui_closeRelicSelection()`

### 坑 2: 选择数量写死为 3，导致纯净精华模式 UI 和确认逻辑失真

**现象**：底栏仍显示 `0 / 3`，按钮启用条件也固定为 3 枚弹珠，玩家即使在纯净精华模式下选中 1 枚弹珠并完成注入，也无法确认。

**根因**：选择阶段的数量要求被分散硬编码在 `index.html`、`sys_toggleMarbleSelection()`、`ui_confirmSelection()` 等位置。

**正确做法**：集中引入 `selectionMode` 与 `selectionRequiredCount` 两个运行态字段，并统一通过 `ui_getSelectionRequirement()` / `ui_isSelectionConfirmReady()` 读取；任何新增 UI 或交互都不得再写死 `3`。

**关键位置**：`src/game_system.js` → `sys_initSelectionPhase()` / `sys_toggleMarbleSelection()`；`src/ui_system.js` → `ui_getSelectionRequirement()` / `ui_refreshSelectionModeUI()`；`index.html` → 选择阶段底栏结构

### 坑 3: 纯净精华注入只改 UI，不进入实体会话

**现象**：预览面板里看起来已经注入了符文，但开始研磨后弹珠并没有继承新增属性，或只有当前选择面板短暂生效。

**根因**：把注入结果停留在临时 UI 状态，没有落到 `MarbleDefinition.collected`，也没有在发射时灌入 `currentSession.collected`。

**正确做法**：确认选择时先执行合法性校验，再把注入结果写入 `marble.collected`；随后由 `game_phase.js` 在发射该弹珠时，把 `marbleDef.collected` 全量灌入 `currentSession.collected`。这样实体层只消费标准结构，不依赖纯净精华 UI 本身。

**关键位置**：`src/ui_system.js` → `ui_confirmSelection()`；`src/game_phase.js` → 发射前 `currentSession` 初始化

### 坑 4: 双倍同化率继续依赖匿名概率常数

**现象**：界面显示“同化率 x2”，但底层仍是 `+0.195` 之类魔法常数，文案与真实效果脱节，后续调参也很难统一。

**根因**：旧版涌潮逻辑直接在 `entities.js` 中叠加固定数值，而不是读取显式倍率字段。

**正确做法**：新增 `CONFIG.gameplay.assimilationDoubleMultiplier` 与运行态 `doubleAssimilationBoostRounds`；同化判定阶段只做 `baseChance * multiplier`，并在阶段结算时统一递减与提示结束。

**关键位置**：`src/config.js`、`src/ui/shop.js`、`src/entities.js`、`src/game_phase.js`

## 关键耦合点

1. **状态初始化 / 重置 / 存档**：`selectionMode`、`selectionRequiredCount`、`pendingSelectionMode`、`selectionInjectedRune`、`doubleAssimilationBoostRounds` 这类字段必须同时出现在 `core.js` 构造初始化、`game_system.js` 的 `sys_resetGame()` 与 `sys_saveRunState()` / `sys_loadRunState()` 中，缺任一处都会造成刷新恢复异常或新局脏状态残留。
2. **预览 UI 与实际数据源**：预览面板读的是 `spawn_showMarblePreview()` 当前上下文，而真正的合法性校验和实体写回发生在 `ui_confirmSelection()`。两者必须共享同一套 `selectionInjectedRune` / `selectionPreviewState`。
3. **旧轮盘复用约束**：混沌精华只是命名与入口变化，不是新机制；必须继续沿用 `FortuneWheel` 与 `slotType='wheel'`，否则会把命运系统拆成两套并引入新的维护负担。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-17 | 初始记录命运时刻 overlay 返回流与纯净精华选择模式的防坑要点 | agt-b0017003-1ad |
