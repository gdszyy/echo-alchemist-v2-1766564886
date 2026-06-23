# UI 层分离重构接口文档

**分支**: `refactor/ui-separation`  
**任务 ID**: `tsk-34f3bed9-90b`  
**生成日期**: 2026-04-10  

---

## 概述

本次重构将 UI 渲染逻辑从业务逻辑中分离出来，主要涉及以下三个方面：

1. **替换 innerHTML 字符串拼接** — 将 `ui_renderShop` 和 `ui_updateDamageStats` 中的超长 innerHTML 字符串拼接改为 `document.createElement` + `addEventListener` 方式。
2. **移除 window.game 全局依赖** — 商店卡片的 `onclick="game.meta_buyUpgrade('...')"` 和伤害统计导航的 `onclick="game.ui_switchDamageRound(...)"` 内联事件改为模块内部的 `addEventListener` 绑定。
3. **集中 DOM 类名操作** — 将 `combat_system.js` 中修改 `#game-container` class 的 DOM 操作和 `game_phase.js` 中的阶段标题 DOM 操作提取到 `ui_system.js` 的新增方法中。

---

## 新增公共接口

### `ui_onPhaseChange(newPhase: string): void`

**位置**: `src/ui_system.js`  
**调用方**: `game_phase.js` 中的 `phase_switchPhase`  

集中处理阶段切换时的所有 DOM 类名操作。负责阶段标题容器（`#phase-title-container`）的显示/隐藏和文本更新。

```javascript
// 调用示例（来自 game_phase.js）
phase_switchPhase(newPhase) {
    this.phase = newPhase;
    this.ui_updateUI();
    this.ui_onPhaseChange(newPhase); // [重构] 集中 DOM 操作
},
```

**支持的阶段**:

| 阶段 ID | 标题文本 | 副标题 |
|---------|---------|--------|
| `meta` | 回聲煉金師 | Echo Alchemist |
| `gathering` | 研磨階段 | 收集魔力 |
| `combat` | 戰鬥階段 | 抵禦魔像 |
| `truth_book` | 真理之書 | 洞悉萬物之理 |
| `training` | 試煉場 | 極限戰鬥測試 |
| *(其他)* | 命運抉择 | 選擇你的命運 |

---

### `ui_triggerScreenShake(duration?: number): void`

**位置**: `src/ui_system.js`  
**调用方**: `combat_system.js` 中的 `combat_activateSkill`  

触发屏幕震动效果（`shake-hard` CSS 动画）。将原先分散在 `combat_system.js` 中的直接 DOM 操作提取到 `ui_system.js`。

```javascript
// 调用示例（来自 combat_system.js）
this.ui_triggerScreenShake(200); // 200ms 震动
```

**参数**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `duration` | `number` | `200` | 震动持续时间（毫秒） |

---

## 修改详情

### `src/ui_system.js`

| 修改位置 | 修改内容 |
|---------|---------|
| `ui_renderShop` (升级卡片部分) | 将 `card.innerHTML` 超长字符串拼接改为 `document.createElement` 逐元素构建；购买按钮从 `onclick="game.meta_buyUpgrade('...')"` 改为 `addEventListener('click', () => this.meta_buyUpgrade(id))` |
| `ui_updateDamageStats` (顶部导航部分) | 将 `header.innerHTML` 内联事件改为 `createElement` + `addEventListener`；导航按钮从 `onclick="game.ui_switchDamageRound(...)"` 改为 `addEventListener` |
| 末尾新增 | 新增 `ui_onPhaseChange(newPhase)` 方法 |
| 末尾新增 | 新增 `ui_triggerScreenShake(duration)` 方法 |

### `src/game_phase.js`

| 修改位置 | 修改内容 |
|---------|---------|
| `phase_switchPhase` | 移除内联的 `#phase-title-container` DOM 操作（获取元素、修改 classList、设置文本、setTimeout）；改为调用 `this.ui_onPhaseChange(newPhase)` |

### `src/combat_system.js`

| 修改位置 | 修改内容 |
|---------|---------|
| `combat_activateSkill` (method === 'shockwave_push') | 将 `document.getElementById('game-container').classList.add/remove('shake-hard')` + `setTimeout` 替换为 `this.ui_triggerScreenShake(200)` |
| `combat_activateSkill` (method === 'chain_lightning_all') | 同上 |

---

## 与任务3（refactor/event-bus）的协作说明

本任务在任务3（架构解耦 - 事件总线与 Mixin 重构）尚未完成的情况下独立实施。当任务3完成后，可以考虑将以下调用改为事件总线方式：

- `phase_switchPhase` 中的 `this.ui_onPhaseChange(newPhase)` → 可改为 `this.emit('phase:changed', { phase: newPhase })`
- `combat_activateSkill` 中的 `this.ui_triggerScreenShake(200)` → 可改为 `this.emit('ui:screenShake', { duration: 200 })`

当前实现已将 DOM 操作集中到 `ui_system.js`，为后续事件总线改造奠定了基础，改动量最小。
