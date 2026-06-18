---
description: "ui 模块的设计规范与核心逻辑说明"
globs: ["src/ui/**/*", "src/ui_system.js"]
---

# ui 模块规范

## 1. 模块职责

`ui` 模块负责游戏中所有 **DOM 层 UI** 的渲染与交互，位于 `src/ui/` 目录下，包含四个子模块：

| 文件 | 导出对象 | 职责 |
|------|---------|------|
| `src/ui/hud.js` | `hud_system` | 战斗/收集阶段 HUD（弹药槽、伤害统计、充能符文条） |
| `src/ui/rune_launcher.js` | `rune_launcher_system` | 符文发射器面板（网格管理、符文选择、合成/重铸） |
| `src/ui/shop.js` | `shop_system` | 局外商店与遗物选择界面 |
| `src/ui/game_over.js` | `game_over_mixin` | 每局结束结算页面（回合节点图、统计、操作按钮） |

所有子模块均以 **Mixin 形式**通过 `bind(this)` 注入到 `Game` 实例，读取 `this.xxx` 是架构正常用法，不属于耦合问题。

**通信架构（Task 3.2 已完成）**：业务逻辑层通过 `EventBus` 事件驱动 UI 更新，UI 层不直接调用业务方法。

## 2. 核心数据模型 / API 接口

### 2.1 HUD 核心 API（`hud_system`）

| 方法 | 说明 |
|------|------|
| `hud_initEventListeners()` | 注册所有 EventBus 监听器（必须在 Game 初始化时调用一次） |
| `ui_updateAmmoUI()` | 更新当前弹药槽和下一发弹药显示 |
| `ui_renderRecipeHUD()` | 渲染收集阶段横向滚动配方 HUD |
| `ui_renderRecipeCard(container, item, isActive, statusClass)` | 渲染单张配方卡片 |
| `ui_updateRoundDamage()` | 更新回合伤害统计图表 |
| `ui_updateDamageStats()` | 更新实时伤害统计面板 |
| `ui_saveShotDamage()` | 保存当前子弹伤害统计到历史记录（最多 3 条） |
| `ui_updateGatheringQueueUI()` | 更新收集队列 UI |
| `ui_updateUICache()` | 刷新 UI 缓存（DOM 元素引用） |
| `ui_updateMultiplierUI()` | 更新分数乘数显示 |

### 2.2 HUD 订阅的 EventBus 事件

| 事件常量 | 触发时机 | HUD 响应 |
|---------|---------|---------|
| `UI_MULTICAST_UPDATE` | 连射倍率变化 | 更新 `#multicast-num`，触发弹出动画 |
| `UI_MULTICAST_TRANSFER` | 倍率转移到配方卡 | 创建飞行徽章 DOM 动画 |
| `UI_HIT_PROGRESS` | 命中进度更新 | 更新 `#hit-bar` 宽度和 `#hit-text` |
| `UI_AMMO_FIRED` | 弹药发射 | 触发射击动画，延迟 150ms 后更新弹药 UI |
| `UI_RUNE_CHARGE_INIT` | 充能符文初始化 | 清空 `#combat-rune-single-slot`，重置进度条 |
| `UI_RUNE_CHARGE_LEVEL_UP` | 充能等级提升 | 刷新符文预览，触发升级特效 |
| `UI_RUNE_CHARGE_UPDATE` | 充能条进度更新 | 更新 `#combat-charge-bar-fill` 宽度 |
| `UI_RUNE_CLAIM_AFTER_ENEMY` | 敌人动作后领取充能/掉落符文 | 触发多个符文飞入背包动画 |
| `UI_ROUND_NUM_UPDATE` | 回合数变化 | 更新回合数显示 |
| `UI_FLASH_EFFECT` | 全屏闪光 | 触发全屏颜色叠加层动画 |
| `UI_CHROMATIC_ABERRATION` | CRT 色差特效 | 添加 CSS class 到 body |

### 2.3 符文发射器核心 API（`rune_launcher_system`）

| 方法 | 说明 |
|------|------|
| `ui_openRuneLauncher()` | 打开符文发射器面板（含 PC/移动端适配） |
| `ui_closeRuneLauncher()` | 关闭面板 |
| `ui_initRuneGrid()` | 初始化符文网格（从 `this.runeGrid` 读取状态） |
| `ui_updateRuneGrid()` | 更新网格（词条解析、高亮激活格子） |
| `ui_openRunePicker(cellIndex)` | 打开符文选择弹出层（从库存选择符文放入指定格子） |
| `ui_doRuneMerge()` | 执行符文合成（调用 `rune_merge()`） |
| `ui_doRuneReforge()` | 执行符文重铸（调用 `rune_reforge()`） |
| `ui_autoArrangeRunes()` | 自动排列符文（最优词条组合） |
| `ui_switchRuneTab(tab)` | 切换符文面板标签（背包/图鉴） |
| `ui_renderRuneCodex()` | 渲染符文图鉴 |

### 2.4 符文图标构建辅助函数

```js
// hud.js 内部（返回 HTMLElement）
_buildRuneIconEl(runeDef, runeLevel)

// rune_launcher.js 内部（返回 HTML 字符串）
_ui_buildRuneIconHTML(runeDef, runeLevel, extraClass = '')
```

两个函数生成相同的视觉结构：`.rune-icon-frame.rarity-{rarity}.lv-{lv}` + `.rune-lv-badge`。

### 2.5 结算页 Boss 元数据（`game_over.js`）

```js
const BOSS_META = {
  ignis:    { name: '炎核',   icon: '🔥', color: '#f97316', isBig: false },
  glacies:  { name: '冰晶',   icon: '❄️', color: '#06b6d4', isBig: false },
  mikro:    { name: '微核',   icon: '⚡', color: '#c084fc', isBig: false },
  devourer: { name: '噬界',   icon: '🌑', color: '#6b7280', isBig: false },
  viridis:  { name: '翠毒',   icon: '☠️', color: '#22c55e', isBig: true  },
  tesla:    { name: '雷皇',   icon: '⚡', color: '#a855f7', isBig: true  },
  chimera:  { name: '奇美拉', icon: '🐉', color: '#ef4444', isBig: true  },
  ouroboros:{ name: '衔尾蛇', icon: '🐍', color: '#f59e0b', isBig: true  },
}
```

## 3. 状态流转 / 业务规则

### 3.1 Mixin 注入模式

所有 UI 子模块均通过以下模式注入到 `Game` 实例：

```js
// 在 Game 构造函数或 init() 中
Object.assign(this, hud_system);
Object.assign(this, rune_launcher_system);
Object.assign(this, shop_system);
Object.assign(this, game_over_mixin);
// 注册 EventBus 监听器（必须在 Object.assign 之后）
this.hud_initEventListeners();
```

### 3.2 符文图标稀有度 CSS 规范

符文图标的视觉样式由以下 CSS 类控制：

- 稀有度边框：`.rarity-common` / `.rarity-rare` / `.rarity-epic` / `.rarity-legendary`
- 等级角标：`.lv-1` / `.lv-2` / `.lv-3`
- 等级徽章：`.rune-lv-badge`（绝对定位于右下角）

### 3.3 弹药发射 UI 时序

```
业务层 emit(UI_AMMO_FIRED)
  → HUD 监听器触发
    → 当前弹药槽添加 .shoot-anim（CSS 射击动画）
      → 150ms 后调用 ui_updateAmmoUI()（更新弹药数据）
        → 新弹药槽添加 .slide-in-anim（滑入动画）
          → 400ms 后移除 .slide-in-anim
```

### 3.4 PC 模式适配

`ui_openRuneLauncher()` 通过检测 `document.body.classList.contains('pc-mode')` 决定面板布局。PC 模式下面板固定在右侧，移动模式下从底部弹出。

## 4. 禁止行为

- **严禁** UI 子模块直接调用 `combat_damageEnemy()`、`phase_*()` 等业务方法，所有业务触发必须通过用户交互事件（click/touch）或 EventBus 事件。
- **严禁**在 `hud_initEventListeners()` 之外注册 EventBus 监听器（防止重复注册），如需新增监听必须统一在该方法内添加。
- **严禁**在 `game_over_mixin` 中修改 `Game` 实例状态，该 mixin 为只读渲染，不允许写操作。
- **严禁**直接操作 `this.runeGrid` 数组（符文网格状态），必须通过 `ui_initRuneGrid()` / `ui_updateRuneGrid()` 的标准流程更新。
- **严禁**在 `rune_launcher.js` 中硬编码符文稀有度颜色，所有稀有度样式必须通过 `RARITY_DISPLAY` 配置和 CSS 类实现。

## 5. 详细设计文档索引

- HUD 函数级索引：[auto_index/src_ui_hud_js_index.md](auto_index/src_ui_hud_js_index.md)
- 符文发射器函数级索引：[auto_index/src_ui_rune_launcher_js_index.md](auto_index/src_ui_rune_launcher_js_index.md)
- UI 系统（Canvas 层）：[ui_system.md](ui_system.md)
- 符文系统：[rune_system.md](rune_system.md)
- 事件总线（EVENT_TYPES 完整列表）：`src/event_bus.js`
