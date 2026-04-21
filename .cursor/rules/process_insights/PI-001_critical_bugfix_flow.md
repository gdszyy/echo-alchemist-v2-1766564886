---
id: "PI-001"
version: "v1.3"
last_updated: "2026-04-20"
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

### 坑 6: `phase_handleInputStart` 研磨阶段点击区域阈值过小

**现象**：研磨阶段点击钉盘中下部区域时，没有弹珠发射出来。

**根因**：`phase_handleInputStart` 中的点击区域判断为 `pos.y < this.height * 0.4`，仅覆盖屏幕上方 40%。钉盘分布在屏幕 20%~70% 高度，点击钉盘中下部区域时 `pos.y >= this.height * 0.4`，被错误路由到"倾斜模式"（`isTiltingGrip = true`）而非发射弹珠。

**正确做法**：将阈值改为 `pos.y < this.height * 0.85`，覆盖屏幕上方 85% 的区域。底部手柄区域已在 `game_system.js` 的 `input_handleInputStart` 中提前拦截，无需在 `phase_handleInputStart` 中重复判断。

**关键位置**：`src/game_phase.js` → `phase_handleInputStart` 第 723 行（修复后）

### 坑 7: `_isRuneLauncherOpen` PC 模式下永远返回 `true`，屏蔽所有 PC 端输入

**现象**：移动端可以正常释放弹珠，PC 端（横屏宽屏布局）点击 canvas 完全无响应。

**根因**：`_isRuneLauncherOpen()` 函数中，PC 模式下符文发射器被迁移到右侧边栏后，`panel.dataset.pcMigrated` 被设置为 `'true'`，函数直接 `return true`。这导致 `input_handleInputStart`、`input_handleInputMove`、`input_handleInputEnd` 三个函数的第一行 `if (this._isRuneLauncherOpen()) return;` 在 PC 端**永远提前 return**，所有鼠标事件被完全屏蔽。

**正确做法**：PC 模式下符文发射器常驻在 `#pc-right-sidebar`（canvas 之外的独立容器），不会遮挡 canvas，不应视为"发射器打开"状态，应返回 `false`。将 `return true` 改为 `return false`。

**关键位置**：`src/game_system.js` → `_isRuneLauncherOpen` 函数（修复后第 699 行）

### 坑 8: 替换子弹阶段跳过后 `confirmBtn.onclick` 未恢复，导致无法发射子弹

**现象**：纯净精华（`pure_essence`）命运时刻触发且 `ammoQueue` 非空时，玩家在「替换当前子弹」阶段点击「跳過」后，进入正常的纯净精华弹珠选择界面。选好弹珠并注入符文后，点击「注入後開始煉金」按钮无响应，游戏直接以空 `ammoQueue` 进入战斗阶段，触发「彈藥耗盡」→ 敌人回合无限循环。

**根因**：`ui_renderReplaceAmmoUI()` 在渲染替换阶段 UI 时，将 `confirmBtn.onclick` 覆盖为 `sys_confirmReplaceAmmo`。玩家跳过后，`sys_skipReplaceAmmo()` 调用 `_proceedToFateMomentSelection()` 进入正常选择界面，但该函数**没有恢复 `confirmBtn.onclick` 为 `ui_confirmSelection`**。`sys_confirmReplaceAmmo` 在 `replaceAmmoContext.active === false` 时直接 `return`，导致 `marbleQueue` 始终为空，`phase_startGatheringPhase()` 从未被调用。

**正确做法**：在 `_proceedToFateMomentSelection()` 中，设置 `confirmBtn.disabled = true` 的同时，**必须恢复** `confirmBtn.onclick = () => this.ui_confirmSelection()`，确保后续正常选择确认流程能正确执行。

**关键位置**：`src/game_system.js` → `_proceedToFateMomentSelection` → `confirmBtn` 处理块

---

### 坑 9: `ui_confirmSelection` 调用不存在的 `sys_confirmSelection`，导致"开始炼金"按钮完全无响应

**现象**：选中三个弹珠后，点击"开始炼金"（`#confirm-selection-btn`）按钮没有任何反应，游戏停留在弹珠选择界面，无法进入研磨阶段。

**根因**：`ui_confirmSelection()` 函数体只有一行 `if (typeof this.sys_confirmSelection === 'function') this.sys_confirmSelection()`，而 `sys_confirmSelection` 在整个代码库中**从未被定义**。`typeof` 检查为 `false`，函数直接返回，`marbleQueue` 永远不会被填充，`phase_startGatheringPhase()` 永远不会被调用。

**正确做法**：`ui_confirmSelection()` 必须自行完成完整的确认逻辑：
1. 检查 `selectedMarbles.length === ui_getSelectionRequirement()`
2. `this.marbleQueue = this.selectedMarbles.map(i => this.marblesPool[i])`
3. 处理 `pure_essence` 分支（符文注入、`doubleAssimilationBoostRounds` 写入）
4. 清理 `selectionMode`、`selectionInjectedRune`、`selectionPreviewState`、`fateMomentContext`、`replaceAmmoContext`
5. 调用 `this.phase_startGatheringPhase()`

**关键位置**：`src/ui_system.js` → `ui_confirmSelection`

---

## 关键耦合点

- `phase_advanceWave` 和 `phase_finalizeRound` 共同维护 `this.round`，修改任一函数时必须检查另一个。
- `meta_buyUpgrade` 依赖 `CONFIG` 中的升级配置结构，修改配置格式时需同步检查此函数。
- `specialSlots` 的生命周期横跨 `game_system.js`（重置）和 `game_phase.js`（初始化），两处必须保持一致。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-16 | 初始记录，整合 tsk-b1def027-9d1 的 5 个致命 Bug 修复经验 | repo-indexer |
| v1.1 | 2026-04-16 | 新增坑 6：研磨阶段点击区域阈值过小（`phase_handleInputStart` `pos.y < height * 0.4` 导致弹珠无法发射） | echo-developer |
| v1.2 | 2026-04-16 | 新增坑 7：PC 端 `_isRuneLauncherOpen` 返回 `true` 屏蔽所有 PC 端鼠标输入 | echo-developer |
| v1.3 | 2026-04-20 | 新增坑 8：替换子弹阶段跳过后 `confirmBtn.onclick` 未恢复，导致纯净精华选择后无法发射子弹、直接循环敌人回合 | echo-developer |
| v1.4 | 2026-04-21 | 新增坑 9：`ui_confirmSelection` 调用不存在的 `sys_confirmSelection`，导致"开始炼金"按钮完全无响应 | echo-developer |
