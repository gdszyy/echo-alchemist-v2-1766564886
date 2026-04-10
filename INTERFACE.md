# Echo Alchemist V2 架构重构与接口规范 (EventBus 篇)

本文档定义了 Echo Alchemist V2 在引入事件总线（EventBus）后的系统架构和通信规范。通过本次重构，我们解决了巨型 Mixin 架构带来的高耦合问题，并修复了音频系统初始化时序和模块循环依赖等核心缺陷。

## 一、 架构演进与核心改动

### 1.1 从直接调用到事件驱动
在旧版架构中，所有子系统（如 `game_phase.js`、`combat_system.js`、`ui_system.js`）通过 `Object.assign(Game.prototype, ...)` 合并到单一的 Game 类中，导致模块间通过 `this.xxx()` 直接调用，形成了极高的耦合度。

重构后，我们引入了轻量级的 **EventBus** 机制。子系统在关键节点不再直接调用其他模块的方法，而是向 EventBus 广播事件。其他模块（特别是 UI 和音频系统）通过监听这些事件来做出响应。这为后续将 UI 逻辑从业务逻辑中完全剥离奠定了基础。

### 1.2 音频系统延迟初始化与依赖注入
旧版 `audio.js` 在模块顶层直接实例化 `SoundManager`，导致在浏览器尚未获得用户交互权限时就创建 `AudioContext`，从而触发浏览器的静音策略警告。同时，`entities.js` 为了使用音频但避免循环依赖，采用了一个全局的 `window.audio` Proxy。

**修复方案：**
- **延迟初始化：** `audio.js` 现在仅导出 `SoundManager` 类和一个安全的代理对象。真实的实例由 `core.js` 监听首次用户交互（点击、触摸、按键）后，调用 `initAudio()` 延迟创建。
- **依赖注入：** 移除了 `window.audio` 的全局依赖。`core.js` 在初始化音频后，通过 `setAudioProvider(instance)` 将实例注入到 `entities.js`，并通过 `_setAudioInstance(instance)` 注入到 `audio.js` 的代理层，确保所有 `import { audio } from './audio.js'` 的模块都能无缝、安全地使用音频功能。

## 二、 事件总线 (EventBus) 接口规范

EventBus 实例挂载在 `Game` 类的 `this.eventBus` 属性上，并可通过 `import { eventBus } from './event_bus.js'` 全局访问。

### 2.1 核心方法
| 方法名 | 参数说明 | 描述 |
| :--- | :--- | :--- |
| `emit(event, data)` | `event` (String): 事件名称<br>`data` (Object): 传递的数据负载 | 触发指定名称的事件，并将数据传递给所有订阅者。 |
| `on(event, handler)` | `event` (String): 事件名称<br>`handler` (Function): 处理函数 | 订阅指定名称的事件。 |
| `off(event, handler)` | `event` (String): 事件名称<br>`handler` (Function): 处理函数 | 取消订阅指定名称的事件。 |

### 2.2 已定义的核心事件

以下是目前系统中已经实现并广播的核心事件，其他子系统可根据需要监听这些事件。

#### `phase:change` (阶段切换事件)
在游戏阶段发生改变时触发，由 `game_phase.js` 的 `phase_switchPhase` 方法广播。
- **Payload 数据结构:**
  - `from` (String): 切换前的阶段名称（如 'meta', 'combat'）。
  - `to` (String): 切换后的阶段名称。

#### `wave:advance` (波次推进事件)
在战斗阶段成功抵御一波敌人并进入下一波时触发，由 `game_phase.js` 的 `phase_advanceWave` 方法广播。
- **Payload 数据结构:**
  - `round` (Number): 当前即将开始的新回合/波次数。

#### `damage:dealt` (伤害造成事件)
当弹丸或其他伤害源对敌人造成实际伤害时触发，由 `combat_system.js` 的 `combat_damageEnemy` 方法广播。此事件可用于触发 UI 伤害数字显示或更新伤害统计面板。
- **Payload 数据结构:**
  - `enemy` (Object): 受击的敌人实例。
  - `amount` (Number): 实际造成的伤害数值。
  - `type` (String): 伤害的元素类型（如 'physical', 'pyro', 'cryo'）。
  - `sourceType` (String): 伤害来源类型。
  - `shotId` (Number): 关联的射击 ID，用于追踪单次射击的总伤害。
  - `hitX` (Number): 击中位置的 X 坐标。
  - `hitY` (Number): 击中位置的 Y 坐标。
  - `killed` (Boolean): 该次伤害是否导致敌人死亡。

#### `enemy:killed` (敌人死亡事件)
当敌人的生命值降至 0 及以下时触发，由 `combat_system.js` 的 `combat_damageEnemy` 方法广播。可用于触发死亡特效、得分计算或战利品掉落。
- **Payload 数据结构:**
  - `enemy` (Object): 死亡的敌人实例。
  - `maxHp` (Number): 敌人死亡前的最大生命值。
  - `shotId` (Number): 造成致命一击的射击 ID。

#### `audio:ready` (音频就绪事件)
在玩家首次与页面交互，`SoundManager` 成功初始化并创建 `AudioContext` 后触发，由 `core.js` 的 `initAudio` 方法广播。
- **Payload 数据结构:**
  - `audio` (Object): 初始化的 `SoundManager` 实例。

## 三、 模块化解耦指南

为了在未来的迭代中继续降低系统的耦合度，建议遵循以下开发规范：

1. **避免直接操作 DOM：** 业务逻辑层（如 `combat_system.js`）不应直接调用 `document.getElementById()`。应将数据通过 EventBus 广播，由专门的 UI 模块监听并更新视图。
2. **安全使用音频：** 所有模块应继续使用 `import { audio } from './audio.js'` 导入音频代理。该代理在音频系统未就绪前会安全地静默失败，避免了大量的 `if (window.audio)` 检查。
3. **状态隔离：** 尽量减少对 `this`（即 Game 实例）上全局变量的直接修改，逐步将状态封装到各自的子系统中。

---
*文档生成：Manus AI 架构重构任务*

---

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
