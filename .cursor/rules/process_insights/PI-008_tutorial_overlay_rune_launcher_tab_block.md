---
id: "PI-008"
version: "v1.0"
last_updated: "2026-04-21"
author: "Manus Agent"
related_modules: ["tutorial_system", "ui/rune_launcher"]
status: "active"
---
# PI-008: 教程系统覆盖层遮挡符文发射器面板 Tab 的修复流程

## 流程概述

教程系统（`tutorial_system.js`）动态创建的 `#tutorial-card`（`z-index: 9002`）、`#tutorial-overlay`（`z-index: 9000`）等元素以 `position: fixed` 挂载在 `document.body` 最末尾，天然凌驾于所有游戏 UI 层（最高 z-index 仅 600）之上。当符文发射器面板（`z-index: 300`）在教程激活期间被打开时，教程卡片的 `pointer-events: auto` 会拦截落在其区域内的所有鼠标/触摸事件，导致面板内的 Tab 按钮（`#rune-tab-launcher`、`#rune-tab-codex`）无法被点击。

## 核心防坑指南

### 坑 1: 教程卡片 z-index 凌驾于所有游戏 UI 之上

**现象**：在教程进行中打开符文发射器面板，面板内的 Tab 按钮点击无响应。

**根因**：`#tutorial-card` 使用 `position: fixed; z-index: 9002; pointer-events: auto`，固定在屏幕底部 `bottom: 16px`。符文发射器面板的 `z-index: 300` 远低于教程卡片，导致点击事件被教程卡片拦截。

**正确做法**：在 `ui_openRuneLauncher()` 中检测 `this._tutorialActive`，若教程激活则临时隐藏 `#tutorial-card`、`#tutorial-overlay`、`#tutorial-highlight`（`display: none`）；在 `ui_closeRuneLauncher()` 中恢复显示（`display: block`）。高亮框的显示状态由 `_tutorial_updateHighlight` 控制，关闭时不强制恢复，避免覆盖 `noOverlay` 步骤的隐藏逻辑。

**关键位置**：`src/ui/rune_launcher.js` → `ui_openRuneLauncher()` 约第 101 行、`ui_closeRuneLauncher()` 约第 160 行

### 坑 2: 教程 DOM 元素挂载位置导致 z-index 竞争

**现象**：任何以 `position: fixed` + 低 z-index 打开的全屏面板，在教程激活期间都可能遭遇同样的点击拦截问题。

**根因**：教程 DOM 在 `_tutorial_createDOM()` 中通过 `document.body.appendChild()` 挂载，位于 DOM 树最末尾，且 z-index 为 9000+，设计上就是为了覆盖所有游戏 UI。

**正确做法**：凡是在教程激活期间可能被打开的全屏/覆盖层面板，其 `open` 函数都应检测 `this._tutorialActive` 并临时隐藏教程 DOM；对应的 `close` 函数应恢复显示。

## 关键耦合点

- `tutorial_system.js` 的 `_tutorialActive` 标志是唯一可靠的教程激活状态来源，通过 `this._tutorialActive` 在 Game 实例上访问。
- 教程 DOM 元素 ID：`tutorial-card`、`tutorial-overlay`、`tutorial-highlight`、`tutorial-launch-guide`。
- 教程卡片的 `display` 属性由 `_tutorial_createDOM()` 初始化为 `block`（隐式），`_tutorial_removeDOM()` 直接从 DOM 中移除，因此 `display: none` 的临时隐藏不会干扰教程的正常生命周期。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-21 | 初始记录：教程覆盖层遮挡符文发射器 Tab 的修复方案 | Manus Agent |
