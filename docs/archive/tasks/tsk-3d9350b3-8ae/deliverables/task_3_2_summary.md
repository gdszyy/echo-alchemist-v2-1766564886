# Task 3.2 交付物摘要：消除 UI 层与业务层的强耦合

**完成时间：** 2026-04-11  
**分支：** `task-3.2-decouple`  
**Commit：** `bf8dbfc`

---

## 改造成果

### 1. 新增 EventBus 事件类型（`src/event_bus.js`）

新增 10 个 UI 类事件常量：

| 事件常量 | 字符串值 | 用途 |
|---|---|---|
| `UI_MULTICAST_UPDATE` | `ui:multicast_update` | 连射倍率显示更新 |
| `UI_MULTICAST_TRANSFER` | `ui:multicast_transfer` | 倍率转移飞行特效 |
| `UI_HIT_PROGRESS` | `ui:hit_progress` | 命中进度条更新 |
| `UI_AMMO_FIRED` | `ui:ammo_fired` | 弹药发射动画 |
| `UI_RUNE_CHARGE_INIT` | `ui:rune_charge_init` | 充能符文 UI 初始化 |
| `UI_RUNE_CHARGE_LEVEL_UP` | `ui:rune_charge_level_up` | 充能等级提升 |
| `UI_RUNE_CHARGE_UPDATE` | `ui:rune_charge_update` | 充能条进度更新 |
| `UI_RUNE_CHARGE_BADGE` | `ui:rune_charge_badge` | 翻倍徽章显示 |
| `UI_CHROMATIC_ABERRATION` | `ui:chromatic_aberration` | CRT 色差特效 |
| `UI_FLASH_EFFECT` | `ui:flash_effect` | 全屏闪光特效 |

### 2. 业务层改造（emit 端）

**`src/combat_system.js`** — 9 处 DOM 操作改为 `eventBus.emit`：

| 原函数 | 改造方式 |
|---|---|
| `combat_updateMulticastDisplay` | `emit(UI_MULTICAST_UPDATE, { total, bonusAmount })` |
| `combat_playMulticastTransferEffect` | `emit(UI_MULTICAST_TRANSFER, { multicastValue, activeMarbleIndex })` |
| `combat_updateHitProgress` | `emit(UI_HIT_PROGRESS, { val, target })` |
| `combat_fireAmmo`（动画部分） | `emit(UI_AMMO_FIRED, {})` |
| `combat_runeCharge_initUI` | `emit(UI_RUNE_CHARGE_INIT, { previewRunes })` |
| `combat_runeCharge_levelUp` | `emit(UI_RUNE_CHARGE_LEVEL_UP, { level })` |
| `combat_runeCharge_updateBar` | `emit(UI_RUNE_CHARGE_UPDATE, { value })` |
| `combat_runeCharge_showBadge` | `emit(UI_RUNE_CHARGE_BADGE, { canvasX, canvasY, text, extraClass, gameWidth, gameHeight })` |
| 全屏闪光（粒子特效触发） | `emit(UI_FLASH_EFFECT, { color, duration })` |

**`src/combat/damage_calc.js`** — 1 处 DOM 操作改为 `eventBus.emit`：

| 原函数 | 改造方式 |
|---|---|
| `combat_triggerChromaticAberration` | `emit(UI_CHROMATIC_ABERRATION, { effectClass, duration })` |

### 3. UI 层改造（on 端）

**`src/ui/hud.js`** — 新增 `hud_initEventListeners()` 方法，注册 8 个监听器：
- `UI_MULTICAST_UPDATE`：更新 `#multicast-ui` 和 `#multicast-num`
- `UI_MULTICAST_TRANSFER`：创建飞行徽章动画元素
- `UI_HIT_PROGRESS`：更新 `#hit-text` 和 `#hit-bar`
- `UI_AMMO_FIRED`：触发发射动画，调用 `ui_updateAmmoUI()`
- `UI_RUNE_CHARGE_INIT`：初始化 `#combat-rune-reward-row`
- `UI_RUNE_CHARGE_LEVEL_UP`：更新充能槽样式
- `UI_RUNE_CHARGE_UPDATE`：更新 `#combat-charge-bar-fill`
- `UI_RUNE_CHARGE_BADGE`：创建翻倍徽章 DOM 元素

**`src/ui_system.js`** — 新增 `ui_initEventListeners()` 方法，注册 2 个监听器：
- `UI_CHROMATIC_ABERRATION`：操作 `#crt-overlay` 色差 CSS 类
- `UI_FLASH_EFFECT`：操作 `#canvas-flash-overlay` 透明度

### 4. 初始化接入（`src/core.js`）

在 `_setupEventListeners()` 末尾添加：
```javascript
this.ui_initEventListeners();
this.hud_initEventListeners();
```

### 5. 注释清理（117 处 TODO 全部处理）

| 文件 | 原 TODO 数 | 处理方式 |
|---|---|---|
| `src/combat_system.js` | ~19 处 | 已替换为 eventBus.emit，TODO 清除 |
| `src/combat/damage_calc.js` | ~1 处 | 已替换为 eventBus.emit，TODO 清除 |
| `src/ui_system.js` | ~30 处 | Mixin 正常用法，替换为说明性注释 |
| `src/ui/shop.js` | ~7 处 | Mixin 正常用法，替换为说明性注释 |
| `src/ui/rune_launcher.js` | ~42 处 | Mixin 正常用法，替换为说明性注释 |
| `src/ui/hud.js` | ~19 处 | 已通过 hud_initEventListeners 处理 |

### 6. 文档更新

- `.cursor/rules/ui_system.md`：更新第4节，明确解耦边界和 Mixin 架构说明
- `src/combat/combat.md`：更新 UI 耦合问题章节，标记为已完成
- `AGENTS.md`：标记 Task 3.2 为已完成 `[x]`

---

## 架构决策说明

**关于 Mixin 模式下的 `this.xxx` 读取：**

在本项目中，UI 模块（`ui_system.js`、`hud.js`、`shop.js`、`rune_launcher.js`）通过 `Object.assign` 混入 `Game.prototype`，因此这些模块中的 `this.ammoQueue`、`this.runeInventory`、`this.saveData` 等读取是**合法的 Mixin 架构用法**，不属于强耦合。

真正需要解耦的是**业务模块（如 `combat_system.js`）直接操作 DOM**，这已在本任务中全部完成。

---

## 变更文件清单

- `src/event_bus.js`（新增 10 个事件类型）
- `src/combat_system.js`（9 处 DOM 操作 → eventBus.emit）
- `src/combat/damage_calc.js`（1 处 DOM 操作 → eventBus.emit，新增 EVENT_TYPES 导入）
- `src/ui/hud.js`（新增 hud_initEventListeners 方法）
- `src/ui_system.js`（新增 ui_initEventListeners 方法，EVENT_TYPES 导入）
- `src/core.js`（_setupEventListeners 中调用两个初始化方法）
- `src/ui/shop.js`（清理 TODO 注释）
- `src/ui/rune_launcher.js`（清理 TODO 注释）
- `.cursor/rules/ui_system.md`（更新规范文档）
- `src/combat/combat.md`（更新规范文档）
- `AGENTS.md`（标记完成）
