# UI 系统规范文档

> 最后更新：Task 2.4（UI 渲染模块化）

## 1. 模块架构概述

UI 系统已按职责区域拆分为以下模块，均通过 `Object.assign` 混入 `Game.prototype`：

| 模块文件 | 职责 | 主要函数 |
|---|---|---|
| `src/ui_system.js` | UI 核心协调层（飞行效果、货币更新、阶段切换、商店购买逻辑） | `ui_playResourceFlyEffect`、`ui_updateUI`、`meta_*`、`ui_onPhaseChange` |
| `src/ui/hud.js` | HUD 渲染（弹药、配方、伤害统计、收集队列） | `ui_updateAmmoUI`、`ui_renderRecipeHUD`、`ui_updateDamageStats` 等 |
| `src/ui/shop.js` | 商店/遗物选择界面渲染 | `ui_renderShop`、`ui_showRelicSelection`、`ui_selectRelic` 等 |
| `src/ui/rune_launcher.js` | 符文发射器界面（背包、网格、选择弹出层、合成重铸） | `ui_openRuneLauncher`、`ui_updateRuneGrid`、`ui_doRuneMerge` 等 |

## 2. 模块加载方式

所有 UI 子模块在 `src/core.js` 中统一 import 并混入：

```js
import { ui_system } from './ui_system.js';
import { hud_system } from './ui/hud.js';
import { shop_system } from './ui/shop.js';
import { rune_launcher_system } from './ui/rune_launcher.js';

Object.assign(Game.prototype, 
    game_system, game_phase, combat_system, render_system, spawn_system,
    ui_system, hud_system, shop_system, rune_launcher_system,
    calc_utils
);
```

## 3. 函数命名约定

| 前缀 | 含义 | 示例 |
|---|---|---|
| `ui_` | 公开 UI 操作（可被外部调用） | `ui_updateAmmoUI()` |
| `_ui_` | 私有 UI 辅助函数（仅模块内部调用） | `_ui_renderRuneBackpackList()` |
| `meta_` | 局外层（Meta）操作（商店购买、升级、货币） | `meta_buyUpgrade()` |

## 4. 业务逻辑耦合点（TODO[Task 3.2]）

当前 UI 模块通过 `this.xxx` 直接读取 Game 实例状态。所有此类访问均已标记 `// TODO[Task 3.2]: 改为监听 EventBus 事件`，待 Task 3.2 完成后统一改造。

**主要耦合点统计：**

| 文件 | TODO 标记数 | 主要耦合属性 |
|---|---|---|
| `ui_system.js` | ~30 处 | `this.phase`、`this.saveData`、`this.runeInventory` |
| `ui/hud.js` | ~19 处 | `this.ammoQueue`、`this.marbleQueue`、`this.roundDamage`、`this.shotDamageHistory` |
| `ui/shop.js` | ~7 处 | `this.saveData`、`this.ownedRelics`、`this.phase` |
| `ui/rune_launcher.js` | ~42 处 | `this.runeInventory`、`this.runeGrid`、`this._selectedRuneIndices` |

## 5. 修改规范

### 5.1 新增 UI 功能

1. 判断功能属于哪个 UI 区域（HUD / 商店 / 符文发射器 / 核心协调）
2. 在对应模块文件中添加方法
3. 方法名遵循 `ui_` 或 `_ui_` 前缀约定
4. 如果方法直接读取 Game 状态，添加 `// TODO[Task 3.2]: 改为监听 EventBus 事件` 注释

### 5.2 修改现有 UI 函数

- **微型修改（< 20 行）**：使用 `file edit` 工具的搜索替换
- **中型修改（20-200 行）**：生成 diff 补丁
- **禁止全量重写** `hud.js`（690行）、`rune_launcher.js`（615行）等大文件

### 5.3 禁止行为

- 禁止在 `combat_system.js`、`game_phase.js` 等业务逻辑模块中直接操作 DOM
- 禁止在 UI 模块中直接修改 `this.phase` 等核心状态（应通过 `phase_switchPhase` 或 EventBus）
- 禁止在 `ui/hud.js`、`ui/shop.js`、`ui/rune_launcher.js` 中 import `core.js`（会造成循环依赖）

## 6. 各子模块函数索引

### 6.1 src/ui_system.js（核心协调层）

| 函数 | 描述 |
|---|---|
| `ui_playResourceFlyEffect(x, y, amount)` | 资源飞入动画（🔮 货币飞向显示区） |
| `ui_openTruthBook()` / `ui_closeTruthBook()` | 真理之书面板开关 |
| `ui_updateSlowMotion()` | 慢动作逻辑更新（每帧调用） |
| `ui_updateMetaCurrency()` | 更新局外货币显示 |
| `ui_updateRuneCountDisplay()` | 更新符文数量显示 |
| `meta_getResourceCount(resourceId)` | 获取资源数量 |
| `meta_spendResource(resourceId, amount)` | 消耗资源 |
| `ui_updateUI()` | 主 UI 更新入口（每帧调用） |
| `ui_confirmSelection()` | 确认弹珠选择 |
| `meta_applyUpgrades()` | 应用升级效果 |
| `meta_addCurrency(amount)` | 增加局外货币 |
| `meta_startRun()` | 开始新一局游戏 |
| `meta_openShop()` | 打开商店 |
| `meta_calculateUpgradeCost(upgrade, level)` | 计算升级费用 |
| `meta_buyUpgrade(upgradeId)` | 购买升级 |
| `ui_onPhaseChange(newPhase)` | 阶段切换时的 UI 响应 |
| `ui_triggerScreenShake(duration)` | 触发屏幕震动效果 |

### 6.2 src/ui/hud.js（HUD 渲染）

| 函数 | 描述 |
|---|---|
| `ui_updateMultiplierUI()` | 更新分数乘数显示 |
| `ui_saveShotDamage(shotId, damage, attr)` | 记录单次射击伤害 |
| `ui_updateRoundDamage()` | 更新回合伤害显示 |
| `ui_updateDamageStats()` | 更新伤害统计图表 |
| `ui_switchDamageRound(delta)` | 切换查看的伤害统计回合 |
| `ui_toggleDamagePanel()` | 展开/收起伤害统计面板 |
| `ui_renderRecipeHUD()` | 渲染配方 HUD（收集/战斗阶段） |
| `ui_renderRecipeCard(recipe, container)` | 渲染单个配方卡片 |
| `ui_updateUICache()` | 更新 UI 元素缓存引用 |
| `ui_updateGatheringQueueUI()` | 更新收集队列显示 |
| `ui_updateAmmoUI()` | 更新弹药槽位显示 |
| `ui_renderAmmoIcon(ammoEntry, container)` | 渲染单个弹药图标 |

### 6.3 src/ui/shop.js（商店渲染）

| 函数 | 描述 |
|---|---|
| `ui_renderShop()` | 渲染商店物品列表 |
| `ui_showRelicSelection()` | 显示遗物选择界面 |
| `ui_selectRelic(relicId)` | 选择并获取遗物 |
| `ui_skipRelic()` | 跳过遗物选择 |
| `ui_closeRelicSelection()` | 关闭遗物选择界面 |

### 6.4 src/ui/rune_launcher.js（符文发射器）

| 函数 | 描述 |
|---|---|
| `ui_openRuneBackpack()` / `ui_closeRuneBackpack()` | 符文背包面板开关 |
| `_ui_renderRuneBackpackList()` | 渲染符文背包列表 |
| `ui_openRuneLauncher()` / `ui_closeRuneLauncher()` | 符文发射器面板开关 |
| `ui_closeRunePicker()` | 关闭符文选择弹出层 |
| `ui_initRuneGrid()` | 初始化符文网格 |
| `ui_openRunePicker(cellIndex)` | 打开符文选择弹出层 |
| `ui_updateRuneGrid()` | 更新符文网格显示 |
| `_ui_updateRuneInventoryDisplay()` | 更新符文库存显示 |
| `_ui_updateActivatedRunewordsDisplay(rws)` | 更新已激活词条列表 |
| `_ui_updateRuneStatsDisplay(stats, base)` | 更新属性加成汇总显示 |
| `_ui_updateRuneActionButtons()` | 更新合成/重铸按钮状态 |
| `ui_doRuneMerge()` | 执行符文合成 |
| `ui_doRuneReforge()` | 执行符文重铸 |
| `_ui_showRuneActionResult(msg, type)` | 显示操作结果提示 |
