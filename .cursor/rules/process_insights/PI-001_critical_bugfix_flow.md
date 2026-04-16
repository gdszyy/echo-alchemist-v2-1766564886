---
id: "PI-001"
version: "v1.0"
last_updated: "2026-04-16"
author: "tsk-b1def027-9d1"
related_modules: ["game_phase", "ui_system", "game_system"]
status: "active"
---

# PI-001: 核心 Bug 修复流程与高频陷阱

## 流程概述

本洞察记录了在 `game_phase.js`、`ui_system.js`、`game_system.js` 三个核心文件中修复 Bug 时反复出现的隐蔽逻辑陷阱。这些问题在代码表面上看似独立，但实际上都源于同一类根因：**状态赋值的重复执行**或**条件判断的顺序依赖**。

## 核心防坑指南

### 坑 1: `phase_switchPhase` 内外的双重赋值

**现象**：修改游戏阶段切换逻辑后，`this.phase` 的值与预期不符，或某些阶段初始化逻辑被执行两次。

**根因**：`phase_switchPhase('combat')` 内部已执行 `this.phase = newPhase`，但历史代码中在调用处之后还有一行 `this.phase = 'combat'` 的冗余赋值。两次赋值在大多数情况下结果相同，但在阶段切换逻辑被重构后，可能导致状态不一致。

**正确做法**：所有阶段切换**必须且只能**通过调用 `phase_switchPhase(phaseName)` 完成，调用处不得再手动赋值 `this.phase`。

**关键位置**：`src/game_phase.js` → `phase_startCombatPhase` 约第 280 行

---

### 坑 2: `round++` 在两处执行导致回合计数翻倍

**现象**：游戏回合数异常跳跃（如从第 1 回合直接跳到第 3 回合），或某些依赖 `this.round` 的难度曲线计算出现偏差。

**根因**：`round++` 同时存在于 `phase_advanceWave` 和 `phase_finalizeRound` 中，导致每次波次推进时回合数被递增两次。

**正确做法**：`round++` 的**唯一执行位置**是 `phase_finalizeRound`。在 `phase_advanceWave` 中严禁出现 `round++` 或任何对 `this.round` 的递增操作。

**关键位置**：`src/game_phase.js` → `phase_advanceWave` 约第 26 行 / `phase_finalizeRound`

---

### 坑 3: `meta_buyUpgrade` 中 `setDeepValue` 的双重调用

**现象**：购买临时升级后，效果数值变为预期的 2 倍（如应加 10 点攻击力，实际加了 20 点）。

**根因**：`isTemporary` 分支内外各调用了一次 `setDeepValue`，导致临时升级的数值被应用两次。

**正确做法**：将 `effectValue` 的计算提取到 `if/else` 分支之外，确保 `setDeepValue` 只被调用一次，由 `if/else` 控制的仅是"是否记录到临时升级列表"的逻辑。

**关键位置**：`src/ui_system.js` → `meta_buyUpgrade` 约第 1173 行

---

### 坑 4: `multicast` 徽章颜色条件判断顺序

**现象**：多重射击数量达到 10 次及以上时，徽章仍显示紫色而非金色。

**根因**：条件判断顺序为 `if (item.multicast >= 5)` 在前，`>= 10` 在后，导致金色条件永远无法到达。

**正确做法**：多条件的阈值判断**必须从大到小排列**（先判断 `>= 10`，再判断 `>= 5`），确保高阈值优先匹配。这是一个通用的编程规范，在所有类似的分级显示逻辑中均须遵守。

**关键位置**：`src/ui_system.js` 约第 930 行

---

### 坑 5: `specialSlots` 初始化类型错误

**现象**：游戏重置后，调用 `specialSlots.forEach(s => s.draw())` 时抛出 `TypeError: s.draw is not a function`。

**根因**：`sys_resetGame` 中将 `this.specialSlots` 初始化为字符串数组 `["skill_point"]`，而非 `SpecialSlot` 实例数组。后续的 `forEach` 遍历到字符串时无法调用 `.draw()` 方法。

**正确做法**：`sys_resetGame` 中 `this.specialSlots` 必须初始化为**空数组 `[]`**。`SpecialSlot` 实例的创建和推入由 `phase_gathering_initPachinko` 在每次进入研磨阶段时动态完成。

**关键位置**：`src/game_system.js` → `sys_resetGame` 约第 253 行

## 关键耦合点

- `phase_advanceWave` 和 `phase_finalizeRound` 共同维护 `this.round`，修改任一函数时必须检查另一个。
- `meta_buyUpgrade` 依赖 `CONFIG` 中的升级配置结构，修改配置格式时需同步检查此函数。
- `specialSlots` 的生命周期横跨 `game_system.js`（重置）和 `game_phase.js`（初始化），两处必须保持一致。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-16 | 初始记录，整合 tsk-b1def027-9d1 的 5 个致命 Bug 修复经验 | repo-indexer |
