---
id: "PI-008"
version: "v1.1"
last_updated: "2026-04-21"
author: "Manus Agent"
related_modules: ["tutorial_system", "ui/rune_launcher", "ui_system"]
status: "active"
---
# PI-008: 符文发射器面板 Tab 被底层阶段面板遮挡的修复流程

## 流程概述

符文发射器面板（`#phase-rune-launcher`，`z-index: 300`）作为浮层覆盖整个游戏区域，但 `ui_updateUI()` 在每次阶段切换时会重新激活当前阶段面板（如 `#phase-selection`）。被激活的底层面板虽然自身 `pointer-events: none`，但其子元素（如 `#marble-selection-grid`，`pointer-events: auto`，尺寸 400×290px）会覆盖在发射器面板的 Tab 按钮区域之上，拦截所有点击事件，导致 Tab 无法响应。

## 核心防坑指南

### 坑 1: ui_updateUI 在发射器打开期间被调用时重新激活底层阶段面板

**现象**：符文发射器面板打开后，Tab 按钮（`#rune-tab-launcher`、`#rune-tab-codex`）点击无响应。通过 `document.elementsFromPoint()` 检查，发现 Tab 坐标上方覆盖着 `#marble-selection-grid`（来自 `#phase-selection`）。

**根因**：`ui_updateUI()` 的第 2 步会调用 `document.getElementById('phase-' + this.phase)` 重新激活当前阶段面板（`display: flex`，`classList: active-phase`）。当 `this.phase === 'selection'` 时，`#phase-selection` 被重新激活，其子元素 `#marble-selection-grid`（`pointer-events: auto`）浮在发射器面板之上，拦截 Tab 点击。

**正确做法**：在 `ui_updateUI()` 的第 2 步（激活当前阶段面板）前，检测 `launcherVisible`，若发射器打开则跳过整个激活逻辑。发射器作为浮层覆盖整个游戏区域，底层阶段面板无需显示。

**关键位置**：`src/ui_system.js` → `ui_updateUI()` 约第 902 行（第 2 步激活逻辑用 `if (!launcherVisible)` 包裹）

### 坑 2: 教程卡片 z-index 凌驾于所有游戏 UI 之上（次要问题）

**现象**：在教程进行中打开符文发射器面板，教程卡片（`z-index: 9002`，`pointer-events: auto`）也会拦截点击。

**根因**：`#tutorial-card` 使用 `position: fixed; z-index: 9002; pointer-events: auto`，固定在屏幕底部 `bottom: 16px`。

**正确做法**：在 `ui_openRuneLauncher()` 中临时隐藏教程 DOM（`display: none`）；在 `ui_closeRuneLauncher()` 中恢复显示。

**关键位置**：`src/ui/rune_launcher.js` → `ui_openRuneLauncher()` 约第 101 行、`ui_closeRuneLauncher()` 约第 160 行

### 坑 3: elementsFromPoint 是定位遮挡问题的最快工具

**现象**：点击某元素无响应，但视觉上看起来没有遮挡。

**正确做法**：在浏览器控制台执行 `document.elementsFromPoint(x, y)`，获取该坐标上所有层叠元素（从顶层到底层），逐一检查 `pointer-events` 和 `z-index`。

## 关键耦合点

- `ui_updateUI()` 每次阶段切换都会被 `phase_switchPhase()` 调用，因此发射器打开期间任何触发阶段切换的操作都会导致底层面板被重新激活。
- `_isRuneLauncherOpen()` 是判断发射器状态的唯一可靠方法，兼容 PC 模式（`dataset.pcMigrated`）和移动端模式（`style.display`）。
- 教程 DOM 元素 ID：`tutorial-card`、`tutorial-overlay`、`tutorial-highlight`。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-21 | 初始记录：教程覆盖层遮挡 Tab（后发现为次要问题） | Manus Agent |
| v1.1 | 2026-04-21 | 更新根因：ui_updateUI 重新激活底层阶段面板才是主要问题；补充 elementsFromPoint 调试技巧 | Manus Agent |
