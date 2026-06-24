# 事件总线与通信规范 (EventBus Architecture)

> 最后更新：tsk-boss-entrance-shockwave（Boss 进场冲击波效果：新增 BOSS_ENTRANCE_SHOCKWAVE 事件类型及 2.6 Boss 系统事件表格）

## 1. 架构概述

本项目采用发布/订阅（Pub/Sub）模式进行跨模块通信。核心实现位于 `src/event_bus.js`。
引入 EventBus 的核心目的是**解耦业务逻辑与 UI 渲染**。业务模块（如 `combat_system.js`、`game_phase.js`）严禁直接操作 DOM，必须通过 `eventBus.emit` 派发事件；UI 模块（如 `ui_system.js`）通过 `eventBus.on` 监听事件并执行 DOM 更新。

## 2. 标准事件字典 (EVENT_TYPES)

所有事件名称必须遵循 `namespace:category:action` 的三段式命名规范（或 `namespace:action` 两段式）。事件名称已在 `src/event_bus.js` 的 `EVENT_TYPES` 常量中集中定义，严禁在代码中直接使用魔法字符串。

### 2.1 阶段类事件 (Phase Events)

| 事件名常量 | 字符串值 | 触发时机 | Payload 结构 | 监听方 |
| :--- | :--- | :--- | :--- | :--- |
| `PHASE_CHANGED` | `phase:change` | 游戏阶段发生切换时（如命运抉择 -> 研磨阶段） | `{ from: string, to: string }` | 核心引擎、UI 系统、音频系统 |
| `WAVE_ADVANCED` | `wave:advance` | 新波次（回合）开始时 | `{ round: number }` | 核心引擎、UI 系统 |

### 2.2 战斗类事件 (Combat Events)

| 事件名常量 | 字符串值 | 触发时机 | Payload 结构 | 监听方 |
| :--- | :--- | :--- | :--- | :--- |
| `COMBAT_DAMAGE_DEALT` | `damage:dealt` | 弹丸对敌人造成伤害时 | `{ enemy: object, amount: number, type: string, sourceType: string, shotId: number, hitX: number, hitY: number, killed: boolean }` | 核心引擎、UI 系统（伤害统计）、技能充能系统 |
| `COMBAT_ENEMY_KILLED` | `enemy:killed` | 敌人死亡时 | `{ enemy: object, maxHp: number, shotId: number }` | 核心引擎、UI 系统、掉落系统 |
| `COMBAT_AMMO_FIRED` | `combat:ammo_fired` | 玩家发射一发弹药时 | `{ recipe: object, shotId: number }` | UI 系统（更新弹药槽、播放动画） |
| `COMBAT_HIT_PROGRESS` | `combat:hit_progress` | 连击进度更新时 | `{ current: number, target: number }` | UI 系统（更新连击进度条） |
| `COMBAT_RUNE_CHARGE` | `combat:rune_charge` | 历史事件，旧符文充能等级提升时 | `{ level: number, value: number }` | 仅兼容旧调用；新代码使用 `UI_SKILL_CHARGE_*` |
| `COMBAT_EFFECT_TRIGGER` | `combat:effect_trigger` | 触发特殊视觉特效时（如色差特效） | `{ type: string, data: object }` | UI 系统（渲染特效） |

### 2.3 UI 类事件 (UI Events)

| 事件名常量 | 字符串值 | 触发时机 | Payload 结构 | 监听方 |
| :--- | :--- | :--- | :--- | :--- |
| `UI_HUD_UPDATE` | `ui:hud_update` | 需要刷新 HUD（如乘数、弹药队列）时 | `{ type: string, data: object }` | HUD 渲染模块 |
| `UI_SHOP_UPDATE` | `ui:shop_update` | 商店状态更新（如购买、刷新）时 | `{ type: string, item: object }` | 商店渲染模块 |
| `UI_RUNE_UPDATE` | `ui:rune_update` | 符文网格或背包发生变化时 | `{ type: string, source: string }` | 符文发射器渲染模块 |
| `UI_SKILL_CHARGE_INIT` | `ui:skill_charge_init` | 战斗开始初始化技能充能 UI 时 | `{ actualValue: number, tempValue: number, totalValue: number }` | HUD 渲染模块 |
| `UI_SKILL_CHARGE_UPDATE` | `ui:skill_charge_update` | 技能充能实际条或临时条变化时 | `{ value: number, actualValue: number, tempValue: number, totalValue: number }` | HUD 渲染模块 |
| `UI_SKILL_CHARGE_LEVEL_UP` | `ui:skill_charge_level_up` | 技能充能满条并成功发放 SP 时 | `{ awarded: number, skillPoints: number, maxSkillPoints: number }` | HUD 渲染模块 |

> `UI_RUNE_CHARGE_INIT` / `UI_RUNE_CHARGE_UPDATE` / `UI_RUNE_CHARGE_LEVEL_UP` 当前在 `EVENT_TYPES` 中保留为 `UI_SKILL_CHARGE_*` 的 deprecated alias，避免旧调用断裂；新代码必须使用 `UI_SKILL_CHARGE_*`。

### 2.4 元数据类事件 (Meta Events)

| 事件名常量 | 字符串值 | 触发时机 | Payload 结构 | 监听方 |
| :--- | :--- | :--- | :--- | :--- |
| `META_CURRENCY_CHANGED` | `meta:currency_changed` | 局外货币（如能量精粹、符文碎片）变化时 | `{ currencyType: string, oldValue: number, newValue: number, delta: number }` | UI 系统（更新货币显示） |
| `META_INVENTORY_CHANGED` | `meta:inventory_changed` | 玩家库存（如获得新符文、消耗符文）变化时 | `{ itemType: string, action: string, item: object }` | UI 系统（更新背包显示） |
| `META_RELIC_ACQUIRED` | `meta:relic_acquired` | 玩家获得新遗物时 | `{ relicId: string, relic: object }` | 核心引擎、UI 系统 |

### 2.5 系统类事件 (System Events)

| 事件名常量 | 字符串値 | 触发时机 | Payload 结构 | 监听方 |
| :--- | :--- | :--- | :--- | :--- |
| `SYSTEM_AUDIO_READY` | `system:audio_ready` | 音频系统初始化完成时 | `{ audio: object }` | 核心引擎 |
| `SYSTEM_ERROR` | `system:error` | 发生非致命系统错误时 | `{ error: Error, context: string }` | 错误收集/日志系统 |

### 2.6 Boss 系统事件 (Boss Events)

| 事件名常量 | 字符串値 | 触发时机 | Payload 结构 | 监听方 |
| :--- | :--- | :--- | :--- | :--- |
| `BOSS_SPAWNED` | `boss:spawned` | Boss 实体生成时 | `{ bossId: string, isBigBoss: boolean }` | UI 系统（入场音效、震动） |
| `BOSS_PHASE_CHANGE` | `boss:phase_change` | Boss 进入狂暴阶段时 | `{ bossId: string }` | UI 系统 |
| `BOSS_DEFEATED` | `boss:defeated` | Boss 被击杀时 | `{ bossId: string }` | 核心引擎、UI 系统 |
| `BOSS_ROTATION` | `boss:rotation` | 奥罗波罗斯词缀轮转时 | `{ bossId: string, affixes: string[] }` | UI 系统 |
| `BOSS_ENTRANCE_SHOCKWAVE` | `boss:entrance_shockwave` | Boss 落地冲击波扩散时（entranceTimer 从阶段 1 进入阶段 2 的第一帧） | `{ bossId: string, isBigBoss: boolean, bossColor: string, shakeDuration: number }` | UI 系统（屏幕震动、属性色闪光） |

## 3. EventBus 使用规范

### 3.1 引入与使用

在需要使用 EventBus 的文件中，统一导入单例实例和事件类型常量：

```javascript
import { eventBus, EVENT_TYPES } from './event_bus.js';

// 派发事件
eventBus.emit(EVENT_TYPES.COMBAT_DAMAGE_DEALT, {
    enemy: targetEnemy,
    amount: 100,
    type: 'pyro',
    sourceType: 'main',
    shotId: 12345,
    hitX: targetEnemy.pos.x,
    hitY: targetEnemy.pos.y,
    killed: false
});

// 监听事件
eventBus.on(EVENT_TYPES.COMBAT_DAMAGE_DEALT, (data) => {
    console.log(`Dealt ${data.amount} ${data.type} damage`);
});
```

### 3.2 调试模式

EventBus 内置了调试模式，可以在开发时开启，自动记录所有派发的事件历史，并输出到控制台。

```javascript
// 开启调试模式
eventBus.setDebug(true);

// 获取事件历史
const history = eventBus.getHistory();
```

### 3.3 错误处理

EventBus 内部已实现错误隔离机制。如果某个 listener 在执行时抛出异常，EventBus 会捕获该异常并打印错误日志，**不会中断其他 listener 的执行**。

## 4. 禁止行为

1. **严禁使用魔法字符串**：所有事件派发和监听必须使用 `EVENT_TYPES` 常量。
2. **严禁在业务模块操作 DOM**：如 `combat_system.js`、`game_phase.js` 中严禁出现 `document.getElementById` 等 DOM 操作代码。必须派发事件，由 `ui_system.js` 等 UI 模块处理。
3. **避免事件循环**：在 listener 中派发事件时，必须小心设计，避免引发无限循环。
4. **及时清理 Listener**：对于生命周期较短的对象，在销毁时必须调用 `eventBus.off` 取消订阅，防止内存泄漏。
