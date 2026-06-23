# UI 系统规范文档

> 最后更新：2026-04-17（实现游戏容器宽高双向等比缩放）

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
| 2026-04-16 | `src/ui_system.js` + `src/game_system.js` | 符文发射器打开后立即消失：**真正根因是 canvas 输入穿透**——符文发射器面板层叠在 canvas 上方（z-index:300），但 canvas 的 `mousedown`/`touchstart` 监听器是直接绑定在 DOM 上的，不受 z-index 限制。玩家点击发射器面板时事件穿透到 canvas，导致 gathering 阶段弹珠被自动发射，所有弹珠打完后自动进入战斗阶段，`phase_switchPhase('combat')` 调用 `ui_updateUI()` 将发射器面板强制隐藏；同时 `.ui-overlay` 的 `transition: opacity 0.3s` 导致面板在 0.3s 内淡出消失而非立即关闭。 | 三处修复：① `game_system.js` 新增 `_isRuneLauncherOpen()` 辅助函数，兼容移动端（`style.display`）和 PC 模式（`dataset.pcMigrated`）两种判断方式；② `input_handleInputStart/Move/End` 开头统一改用 `_isRuneLauncherOpen()` 屏蔽 canvas 事件穿透；③ `ui_updateUI` 全局隐藏循环和 `phase_switchPhase` 的 DEBUG-LOG 也改用 `_isRuneLauncherOpen()`；④ `ui/rune_launcher.js` 的 `ui_openRuneLauncher` 在移动端模式下为面板添加 `touchmove` 的 `stopPropagation` 作为第二道防线，防止触摸滑动穿透到底层 Canvas。 |
| 2026-04-16 | `index.html`, `src/game_system.js`, `src/ui_system.js`, `src/ui/rune_launcher.js` | PC 横屏模式下游戏区域宽度占满全屏且无侧边栏，底部抽屉和符文发射器不能同时展示。 | 1. `index.html` 新增 `#app-wrapper`（flex 三栏容器）、`#pc-left-sidebar`、`#pc-right-sidebar` 结构和对应 CSS；2. `#game-container` 改为固定宽高比 `min(calc(100dvh*9/16), 480px)` 宽度；3. `sys_resize()` 移除强制覆盖宽度的代码，`defeatLineY` 在 PC 模式下缩小安全边距；4. `ui_system.js` 新增 `ui_updatePCLayout()`、`_ui_migrateRuneLauncherToSidebar()`、`_ui_migrateHUDToLeftSidebar()` 三个方法；5. `rune_launcher.js` 的 `ui_openRuneLauncher`/`ui_closeRuneLauncher` 在 PC 模式下不修改 display；6. `core.js` 的 resize 监听器和构造函数中调用 `ui_updatePCLayout()`。 |
| 2026-04-16 | `src/ui/rune_launcher.js` | 符文发射器内部引导教学（`ui_showRuneLauncherTour`）存在两个 Bug：① 教学期间 `highlight` 元素的 `box-shadow: 0 0 0 2000px rgba(0,0,0,0.45)` 溢出 `#phase-rune-launcher` panel 边界（panel 无 `overflow: hidden`），在整个屏幕上形成常驻黑色蒙版；② 教学完成时调用 `this.saveGame()`（该方法不存在），导致 `runeLauncherTourDone = true` 仅写入内存对象，从未持久化到 localStorage，每次游戏重启后教学都重复触发。 | ① 在 `ui_showRuneLauncherTour()` 中，创建 overlay 前保存 `panel.style.overflow` 原値，并临时设为 `hidden`；教学完成时恢复原値；`ui_closeRuneLauncher()` 中移除 tour overlay 时也同步恢复 overflow（防止用户未完成教学直接关闭面板）。② 将 `if (this.saveGame) this.saveGame()` 替换为 `this.sys_saveData()`，确保完成状态正确持久化。 |
| 2026-04-16 | `src/ui/rune_launcher.js` | 符文发射器内部引导教学（`ui_showRuneLauncherTour`）暂时归档。 | 将 `ui_openRuneLauncher` 中的教程触发调用和 `ui_showRuneLauncherTour` 函数体全部注释（`[ARCHIVED]` 标记）。如需恢复，取消 `rune_launcher.js` 第 114-117 行和第 1444-1604 行的注释即可。 |
| 2026-04-17 | `index.html`, `src/game_system.js`, `src/ui_system.js`, `src/spawn_system.js`, `src/ui/shop.js`, `src/config.js`, `src/core.js`, `src/entities.js`, `src/game_phase.js` | **命运时刻 / 纯净精华 UI 接入**：当前主仓补落地了 `selection-mode-label`、`selected-required-count`、`selection-mode-subtitle` 三个选择阶段底栏节点；新增 `ui_getSelectionRequirement()`、`ui_isSelectionConfirmReady()`、`ui_getPureEssenceLegalElements()`、`ui_getPureEssenceRuneOptions()`、`ui_selectPureEssenceRune()`、`ui_renderPureEssencePanel()`、`ui_refreshSelectionModeUI()` 等辅助函数；`spawn_showMarblePreview()` 负责刷新纯净精华注入面板；`ui_closeRelicSelection()` 改为按 `relicOverlayReturnState` 恢复原阶段；`ui_confirmSelection()` 在纯净精华模式下会校验合法符文并把结果写回 `MarbleDefinition.collected`。 |
| 2026-04-17 | `index.html`, `src/game_system.js` | 游戏容器宽高未同时适配屏幕宽度和高度：原 `height: 100dvh` 在竞屏手机上会超出屏幕宽度；`sys_resize` 中 `container.style.height = window.innerHeight` 会覆盖 CSS 高度计算。 | **完整等比缩放方案**：1. `#app-wrapper` 的 `align-items` 改为 `center`（防止 stretch 拉伸 game-container）；2. `#pc-left/right-sidebar` 加 `align-self: stretch`（PC 侧边栏仍填满高度）；3. `#game-container` 宽度改为 `min(100vw, calc(100dvh*9/16), 480px)`，移除 `height` 和 `min-width`，改用 `aspect-ratio: 9/16` + `max-height: 100dvh` 实现宽高双向等比缩放；4. `sys_resize()` 移除 `container.style.height` 覆盖，改用 `getBoundingClientRect()` 读取实际尺寸。 |

## 6. 修改规范

### 6.1 新增 UI 功能

1. 判断功能属于哪个 UI 区域（HUD / 商店 / 符文发射器 / 核心协调）
2. 在对应模块文件中添加方法
3. 方法名遵循 `ui_` 或 `_ui_` 前缀约定
4. 如果方法直接读取 Game 状态，添加 `// TODO[Task 3.2]: 改为监听 EventBus 事件` 注释
5. 命运抉择相关 UI **禁止写死 `3`**；底栏计数、按钮启用条件和确认逻辑必须统一经由 `selectionMode` / `selectionRequiredCount` 与 `ui_getSelectionRequirement()` / `ui_isSelectionConfirmReady()`。
6. 任何从选择阶段或命运时刻中途打开的 overlay，在关闭时都必须优先依据 `relicOverlayReturnState` 恢复原阶段，禁止默认重跑 `sys_initSelectionPhase()` 覆盖当前特殊选择态。

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
| `ui_getSelectionRequirement()` | 读取当前命运抉择所需的弹珠数量（标准 3 选或纯净精华 1 选） |
| `ui_isSelectionConfirmReady()` | 统一判断当前选择阶段是否允许确认 |
| `ui_getPureEssenceLegalElements(marbleDef)` | 计算纯净精华模式下某枚弹珠允许注入的合法属性集合 |
| `ui_getPureEssenceRuneOptions(marbleDef)` | 从符文库存中过滤出当前弹珠可注入的合法符文 |
| `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` | 为当前选中的弹珠绑定一个合法的注入符文 |
| `ui_renderPureEssencePanel(marbleDef, selectionIndex)` | 在弹珠预览面板中渲染纯净精华的合法属性和符文注入按钮 |
| `ui_refreshSelectionModeUI()` | 刷新命运抉择底栏标签、需求数量、副标题和确认按钮状态 |
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
| `_isRuneLauncherOpen()` | 判断符文发射器面板当前是否处于打开状态。兼容移动端（`style.display`）和 PC 模式（`dataset.pcMigrated`）两种判断方式，由 `input_handleInputStart/Move/End` 和 `ui_updateUI` 共同使用 |
| `_ui_migrateRuneLauncherToSidebar(toSidebar)` | 将 `#phase-rune-launcher` 在 `game-container` 和 `pc-right-sidebar` 之间迁移，PC 模式下移除 `.ui-overlay` 类，并设置 `dataset.pcMigrated = 'true'` 标记 |
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
| `ui_openRuneLauncher()` / `ui_closeRuneLauncher()` | 符文发射器面板开关。`ui_openRuneLauncher` 在函数入口处包含 **[DEBUG-LOG]** 块，每次调用时通过 `console.group` 输出 `#phase-rune-launcher` 面板的完整状态快照（`game.phase`、`isPCMode`、`style.display`、computed display/visibility/opacity/z-index、classList、dataset、BoundingRect、parentElement、调用栈前 3 帧） |
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
| `_ui_updateResonanceDisplay()` | 更新属性共鸣状态显示（基于 `this.activeElementResonances` 渲染已激活共鸣阶段卡片，包含属性图标、阶段标签、效果描述及层数进度条） |
