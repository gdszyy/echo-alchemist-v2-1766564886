# UI 系统规范文档

> 最后更新：2026-04-16（PC 横屏三栏响应式布局实施）

## 1. 模块架构概述

UI 系统已按职责区域拆分为以下模块，均通过 `bind(this)` 组合模式作为实例方法注入到 `Game` 实例中：

| 模块文件 | 职责 | 主要函数 |
|---|---|---|
| `src/ui_system.js` | UI 核心协调层（飞行效果、货币更新、阶段切换、商店购买逻辑） | `ui_playResourceFlyEffect`、`ui_updateUI`、`meta_*`、`ui_onPhaseChange` |
| `src/ui/hud.js` | HUD 渲染（弹药、配方、伤害统计、收集队列） | `ui_updateAmmoUI`、`ui_renderRecipeHUD`、`ui_updateDamageStats` 等 |
| `src/ui/shop.js` | 商店/遗物选择界面渲染 | `ui_renderShop`、`ui_showRelicSelection`、`ui_selectRelic` 等 |
| `src/ui/rune_launcher.js` | 符文发射器界面（背包、网格、选择弹出层、合成重铸） | `ui_openRuneLauncher`、`ui_updateRuneGrid`、`ui_doRuneMerge` 等 |

## 2. 模块加载方式

所有 UI 子模块在 `src/core.js` 中统一 import，并在 `Game` 构造函数中通过 `bind(this)` 组合模式注入：

> **注意**：`systems.js` 中的全屏覆盖层类（`TruthBook`、`TrainingGround`）**不属于** `bind(this)` 注入的子系统，而是在 `Game` 构造函数中**显式实例化**并挂载到实例属性上：
> ```js
> this.ui = new UIManager();
> this.truthBook = new TruthBook(this);       // 真理之书覆盖层
> this.trainingGround = new TrainingGround(this); // 试炼场覆盖层
> ```
> 这三个对象均需要 `Game` 实例作为构造参数，且拥有独立的内部状态（如 `active`、`demoGame`），因此不适合通过 `bind(this)` 模式注入。

```js
import { ui_system } from './ui_system.js';
import { hud_system } from './ui/hud.js';
import { shop_system } from './ui/shop.js';
import { rune_launcher_system } from './ui/rune_launcher.js';

// 在 Game 构造函数中：
const _subsystems = [
    game_system, game_phase, combat_system, render_system, spawn_system,
    ui_system, hud_system, shop_system, rune_launcher_system,
    calc_utils
];
for (const subsystem of _subsystems) {
    for (const [key, val] of Object.entries(subsystem)) {
        if (typeof val === 'function') {
            this[key] = val.bind(this);
        } else if (typeof val !== 'undefined') {
            this[key] = Array.isArray(val) ? [...val] : val;
        }
    }
}
```

## 3. 函数命名约定

| 前缀 | 含义 | 示例 |
|---|---|---|
| `ui_` | 公开 UI 操作（可被外部调用） | `ui_updateAmmoUI()` |
| `_ui_` | 私有 UI 辅助函数（仅模块内部调用） | `_ui_renderRuneBackpackList()` |
| `meta_` | 局外层（Meta）操作（商店购买、升级、货币） | `meta_buyUpgrade()` |

## 4. EventBus 架构与状态读取规范（Task 3.2 确立）
在 Task 3.2 中，我们明确了 UI 层与业务层的解耦边界：

### 4.1 业务层 -> UI 层的通信（通过 EventBus）
业务模块（如 `combat_system.js`、`damage_calc.js`）**严禁直接操作 DOM**。所有的 UI 更新必须通过 `eventBus.emit` 派发事件，由 UI 模块（如 `ui_system.js`、`hud.js`）通过 `eventBus.on` 监听并执行 DOM 操作。

已建立的 EventBus 监听器：
- **全局特效 (`ui_system.js`)**：`UI_CHROMATIC_ABERRATION` (色差特效), `UI_FLASH_EFFECT` (全屏闪光)
- **战斗 HUD (`hud.js`)**：`UI_MULTICAST_UPDATE`, `UI_MULTICAST_TRANSFER`, `UI_HIT_PROGRESS`, `UI_AMMO_FIRED`, `UI_RUNE_CHARGE_*`, `UI_RUNE_CLAIM_AFTER_ENEMY` 等

### 4.2 UI 层 -> 业务层的状态读取（通过组合模式的 `this`）
由于 UI 模块已通过 `bind(this)` 组合模式作为实例方法注入到 Game 实例中，**UI 模块直接读取 `this.xxx`（如 `this.ammoQueue`、`this.runeInventory`、`this.saveData`）是符合架构设计的正常用法**。
这不属于强耦合，因为 UI 模块的方法在运行时绑定到了 Game 实例上。在 Task 3.2 中，之前误标的 `TODO[Task 3.2]` 注释已被清理或替换为说明性注释。

## 5. 已知问题与修复记录

| 日期 | 文件 | 问题描述 | 修复方式 |
|---|---|---|---|
| 2026-04-11 | `src/ui_system.js` | `_ui_updateRuneStatsDisplay` 函数体（约 47 行）被错误地遗留在 `ui_system.js` 中，缺少方法名声明，导致 `Uncaught SyntaxError: Unexpected identifier 'summary'` | 从 `ui_system.js` 删除游离函数体，并将其填充至 `rune_launcher.js` 中已声明但为空的同名方法 |
| 2026-04-12 | `index.html` | 研磨阶段（`#phase-gathering`）两个符文词条系统浮动按鈕与底部面板（`.bottom-panel` 高度 115px）及英雄充能条（`#hero-gauge-container` bottom:145px）重叠：背包按鈕 `bottom-24`(96px) 低于底部面板被遮挡，发射器按鈕 `bottom-36`(144px) 与充能条几乎完全重叠 | 将背包按鈕改为 `bottom-32`(128px)，发射器按鈕改为 `bottom-44`(176px)，两者均高于各自遮挡元素，保持安全间距 |
| 2026-04-12 | `src/ui/rune_launcher.js`, `src/spawn_system.js`, `src/game_phase.js` | 符文碎片获取量过大：原来通过 `spawn_addScore`、能量球命中累积 `runCurrency`，结算时批量转换为符文碎片 | 移除两处 `runCurrency` 累积及结算转换逻辑；改为局内符文合成成功时自动发放碎片（Lv.1→1片，Lv.2→3片，Lv.3→6片），并添加符文碎片飞向局外货币区的动画及发射器内碎片计数显示 |
| 2026-04-12 | `src/core.js` | 点击"真理之术"按钮后报错 `Uncaught TypeError: Cannot read properties of undefined (reading 'update')`：`Game` 构造函数中只初始化了 `this.ui = new UIManager()`，但遗漏了 `this.truthBook` 和 `this.trainingGround` 的实例化，导致主循环 `sys_loop` 在 `truth_book` / `training` 阶段调用 `.update()` 时访问 `undefined` | 在 `core.js` 构造函数中 `this.ui = new UIManager()` 之后，补充 `this.truthBook = new TruthBook(this)` 和 `this.trainingGround = new TrainingGround(this)` 的显式实例化 |
| 2026-04-12 | `src/game_system.js`, `src/spawn_system.js`, `src/combat_system.js`, `src/core.js` | 战斗阶段顶部半透明栏（`#unified-top-bar`，高约 52px）遮挡最顶部 1-2 行敌人：所有敌人生成、Boss 生成、分身生成、斥力技能上限均硬编码 `startY = 80`，导致顶部敌人行与顶部栏重叠 | 引入 `this.combatGridTopY`（语义：第一行敌人中心 Y），在 `sys_resize()` 中动态计算为 `topBarH + 8 + enemyHeight/2`（顶部栏高度 + 8px 安全间距 + 半个敌人高度），确保第一行上边界恰好在顶部栏下方且与后续行网格对齐；将 `game_system.js`、`spawn_system.js`（×3 处）、`combat_system.js` 中所有硬编码 `80` 替换为 `this.combatGridTopY`；`core.js` 初始化默认值 90 |
| 2026-04-12 | `src/game_phase.js` | 顶部墙壁（左右墙渐变 + 发光边框）仍从 `y=-100/y=1` 开始绘制，导致墙壁在顶部栏区域内也有渲染，视觉上顶部栏依旧遮挡了墙壁展示区域 | 引入 `wallTopY = combatGridTopY - enemyHeight/2`（即第一行敌人上边界 = 顶部栏下边界），将左右墙 `fillRect` 和三条边线的起始 Y 均改为 `wallTopY`，确保墙壁只在顶部栏下方绘制 |
| 2026-04-12 | `src/core.js`, `src/game_system.js`, `src/game_phase.js` | 初始特殊槽为 `['skill_point','wheel']` 且 `slotCount=1`，每局只随机生成 1 个技能点或幸运轮盘槽 | 将 `unlockedSlots` 改为 `['skill_point', 'multicast']`，`slotCount` 改为 `2`；同时将 `game_phase.js` 中槽类型分配从随机改为按顺序（`slotTypes[createdCount % slotTypes.length]`），确保每局初始生成 1 个技能点槽 + 1 个加连击槽 |
| 2026-04-13 | `src/config.js`, `src/core.js`, `src/game_system.js`, `src/ui/rune_launcher.js`, `src/combat_system.js`, `src/game_phase.js`, `src/ui_system.js`, `src/systems.js`, `src/combat/damage_calc.js`, `src/entities/enemy.js`, `src/entities/projectile.js` | 技能系统重构 | 1. `SKILL_DB` 中的技能改为通过符文组合（`unlockRuneword`）解锁派生，新增 6 个新技能。2. `core.js` 和 `game_system.js` 初始 `unlockedSlots` 移除 `skill_point`，`slotCount` 改为 1，并新增 `activeSkills` 数组。3. `rune_launcher.js` 中激活符文时动态派生 `activeSkills`，有技能时才向 `unlockedSlots` 注入 `skill_point` 并增加 `slotCount`。4. `game_phase.js` 生成特殊槽时，若无技能则过滤掉 `skill_point` 槽。5. `ui_system.js` 中技能杠和 SP 面板仅在有已解锁技能时显示。6. `combat_system.js` 增加新技能逻辑，支持冻结加伤、全屏落雷、弹跳加伤、强制过热、剑刃雨和强制元素聚变。 |
| 2026-04-13 | `src/game_phase.js`, `src/combat_system.js`, `src/ui/hud.js`, `index.html` | 回合结算时领取的充能符文和掉落符文没有专门的领取时机，玩家不知道获得了哪些符文 | 新增 `phase_claimPendingRunes()` 方法，在敌人动作后（`enemyTurnTimer > 60`）先领取充能符文和掉落符文并触发 `UI_RUNE_CLAIM_AFTER_ENEMY` 事件，再延迟 600ms 进入 `phase_finalizeRound()`；`hud.js` 监听该事件，对每个符文创建飞入背包动画（充能符文从充能槽飞出，掉落符文从场地位置飞出，终点均为符文库存区域）；`index.html` 新增 `runeClaimFlyToBag` 动画支持任意 XY 方向飞行 |
| 2026-04-13 | `src/tutorial_system.js` | 战斗阶段引导窗口（`combat_intro` 步骤）居中全屏遗罩，完全挡住战斗界面，且未教学如何发射子弹 | 将 `position` 改为 `'bottom-fixed'`（固定在底部不遗挡战斗区域），`noOverlay` 改为 `true`（移除全屏遗罩），`waitForEvent` 改为 `EVENT_TYPES.UI_AMMO_FIRED`（等玩家实际发射后自动推进），并在内容中添加「按住并拖拽画布，瞄准后松手发射」的操作说明 |
| 2026-04-13 | `src/game_system.js`, `src/game_phase.js`, `src/ui_system.js`, `src/ui/game_over.js`, `index.html` | 刷新页面后局内进度全部丢失 | 新增局内存档系统：`game_system.js` 新增 `sys_saveRunState / sys_loadRunState / sys_clearRunState / sys_hasRunState` 四个方法，将全量局内状态（enemies、pegs、ownedRelics、runeGrid、Boss系统、难度字段等）序列化到 localStorage（key: `echo_alchemist_run_state`）；`game_phase.js` 的 `phase_finalizeRound` 在 ammoQueue 为空时自动调用 `sys_saveRunState()`；`game_over.js` 的 `_gameover_triggerPhase` 调用 `sys_clearRunState()` 游戏结束时清除存档；`ui_system.js` 的 `meta_startRun` 新开一局时清除旧存档，新增 `meta_continueRun`（继续游戏入口）和 `meta_updateContinueButton`（检测存档并更新按鈕显隐）；`ui_updateUI` 进入 meta 阶段时同步调用 `meta_updateContinueButton`；`index.html` 在「開始煉成」按鈕下方新增「继续上次游戲」按鈕（id: `meta-continue-btn`，默认隐藏） |
| 2026-04-12 | `src/systems.js`, `src/ui/shop.js` | 生产环境在缺失部分 UI 元素时启动崩溃或运行时报错：`UIManager`、`TruthBook`、`TrainingGround` 及 `shop_system` 在访问不存在的 DOM 节点（如 `#phase-training`、`#relic-container`）时未作空值保护，导致脚本中断。 | 为 `systems.js` 中的三个 UI 类及 `shop.js` 中的所有方法添加了全面的空值防御（null guards）；统一了 `shop.js` 的接口名为 `meta_buyUpgrade` 并修正参数传递。 |
| 2026-04-15 | `src/systems.js` | `spawn_system.js` 导入 `TRUTH_BOOK_DATA` 时报错 `Uncaught SyntaxError: The requested module './systems.js' does not provide an export named 'TRUTH_BOOK_DATA'`，原因是 `systems.js` 定义了该常量但未导出。 | 在 `src/systems.js` 的末尾 `export` 语句中添加了 `TRUTH_BOOK_DATA`。 |
| 2026-04-15 | `src/ui/shop.js` | 炼金工房（局外商店）所有商品描述显示为 `undefined`：`ui_renderShop` 中读取 `upgrade.description`，但 `META_SHOP_CONFIG.upgrades` 中的字段名为 `desc`，导致字段名不匹配。 | 将 `shop.js` 第 374 行的 `upgrade.description` 改为 `upgrade.desc`。 |
| 2026-04-16 | `src/ui_system.js` + `src/game_system.js` | 符文发射器打开后立即消失：**真正根因是 canvas 输入穿透**——符文发射器面板层叠在 canvas 上方（z-index:300），但 canvas 的 `mousedown`/`touchstart` 监听器是直接绑定在 DOM 上的，不受 z-index 限制。玩家点击发射器面板时事件穿透到 canvas，导致 gathering 阶段弹珠被自动发射，所有弹珠打完后自动进入战斗阶段，`phase_switchPhase('combat')` 调用 `ui_updateUI()` 将发射器面板强制隐藏；同时 `.ui-overlay` 的 `transition: opacity 0.3s` 导致面板在 0.3s 内淡出消失而非立即关闭。 | 两处修复：① `ui_updateUI` 全局隐藏循环中加入保护（发射器打开时跳过隐藏）；② `input_handleInputStart/Move/End` 开头加入发射器打开时的全局屏蔽，防止 canvas 事件穿透。 |
| 2026-04-16 | `index.html`, `src/game_system.js`, `src/ui_system.js`, `src/ui/rune_launcher.js` | PC 横屏模式下游戏区域宽度占满全屏且无侧边栏，底部抽屉和符文发射器不能同时展示。 | 1. `index.html` 新增 `#app-wrapper`（flex 三栏容器）、`#pc-left-sidebar`、`#pc-right-sidebar` 结构和对应 CSS；2. `#game-container` 改为固定宽高比 `min(calc(100dvh*9/16), 480px)` 宽度；3. `sys_resize()` 移除强制覆盖宽度的代码，`defeatLineY` 在 PC 模式下缩小安全边距；4. `ui_system.js` 新增 `ui_updatePCLayout()`、`_ui_migrateRuneLauncherToSidebar()`、`_ui_migrateHUDToLeftSidebar()` 三个方法；5. `rune_launcher.js` 的 `ui_openRuneLauncher`/`ui_closeRuneLauncher` 在 PC 模式下不修改 display；6. `core.js` 的 resize 监听器和构造函数中调用 `ui_updatePCLayout()`。 |

## 6. 修改规范

### 6.1 新增 UI 功能

1. 判断功能属于哪个 UI 区域（HUD / 商店 / 符文发射器 / 核心协调）
2. 在对应模块文件中添加方法
3. 方法名遵循 `ui_` 或 `_ui_` 前缀约定
4. 如果方法直接读取 Game 状态，添加 `// TODO[Task 3.2]: 改为监听 EventBus 事件` 注释

### 6.2 修改现有 UI 函数

- **微型修改（< 20 行）**：使用 `file edit` 工具的搜索替换
- **中型修改（20-200 行）**：生成 diff 补丁
- **禁止全量重写** `hud.js`（690行）、`rune_launcher.js`（615行）等大文件

### 6.3 禁止行为

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
| `meta_startRun()` | 开始新一局游戏（同时清除旧存档） |
| `meta_continueRun()` | 继续上次游戏（读取 localStorage 存档并恢复状态） |
| `meta_updateContinueButton()` | 检测存档并更新「继续游戏」按鈕显隐及回合数显示 |
| `meta_openShop()` | 打开商店 |
| `meta_calculateUpgradeCost(upgrade, level)` | 计算升级费用 |
| `meta_buyUpgrade(upgradeId)` | 购买升级 |
| `ui_onPhaseChange(newPhase)` | 阶段切换时的 UI 响应 |
| `ui_triggerScreenShake(duration)` | 触发屏幕震动效果 |
| `ui_openPause()` | 打开暂停页面（仅在 gathering/combat/training 阶段有效），设置 `isPaused=true` 冻结物理更新 |
| `ui_closePause()` | 关闭暂停页面，恢复游戏运行 |
| `ui_syncPauseSettings()` | 同步暂停页面中各设置项的开关状态（音效、伤害数字、CRT） |
| `ui_renderPauseRelics()` | 渲染暂停页面中的遗物列表，展示当前遗物及其效果、稀有度、叠层数 |
| `ui_updatePCLayout()` | 检测视口宽高并切换 PC 三栏布局（横屏且单侧剩余 ≥ 240px 时激活），在 resize 和初始化时调用 |
| `_ui_migrateRuneLauncherToSidebar(toSidebar)` | 将 `#phase-rune-launcher` 在 `game-container` 和 `pc-right-sidebar` 之间迁移，PC 模式下移除 `.ui-overlay` 类 |
| `_ui_migrateHUDToLeftSidebar(toSidebar)` | 将 `#gathering-queue` 和 `#gathering-hud-mount` DOM 节点在底部面板和 `pc-left-sidebar` 之间迁移 |

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
| `ui_showRelicSelection()` | 显示遗物选择界面（前三次自动提升推荐遗物权重并展示推荐标签/Tip） |
| `ui_selectRelic(relic)` | 选择并获取遗物（参数为遗物对象） |
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
| `_ui_updateRuneActionButtons()` | 更新合成/重铸按鈕状态 |
| `ui_doRuneMerge()` | 执行符文合成（合成成功后自动发放符文碎片并触发飞行动画） |
| `ui_doRuneReforge()` | 执行符文重铸 |
| `_ui_showRuneActionResult(msg, type)` | 显示操作结果提示 |
| `_ui_playMergeShardFlyEffect(startX, startY, amount)` | 合成时符文碎片飞向局外货币显示区的动画 |
| `_ui_updateLauncherShardCount()` | 更新发射器面板内符文碎片计数显示 |
