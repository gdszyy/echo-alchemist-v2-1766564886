# UI 系统规范文档

> 最后更新：2026-04-17（实现游戏容器宽高双向等比缩放）

## 1. 模块架构概述

UI 系统已按职责区域拆分为以下模块，均通过 `bind(this)` 组合模式作为实例方法注入到 `Game` 实例中：

| 模块文件 | 职责 | 主要函数 |
|---|---|---|
| `src/ui_system.js` | UI 核心协调层（飞行效果、货币更新、阶段切换、商店购买逻辑） | `ui_playResourceFlyEffect`、`ui_updateUI`、`meta_*`、`ui_onPhaseChange` |
| `src/ui/hud.js` | HUD 渲染（弹药、配方、伤害统计、收集队列） | `ui_updateAmmoUI`、`ui_renderRecipeHUD`、`ui_updateDamageStats` 等 |
| `src/ui/shop.js` | 商店/遗物选择界面渲染 | `ui_renderShop`、`ui_showRelicSelection`、`ui_selectRelic` 等 |
| `src/ui/run_shop.js` | 局内商店/商人到访入口与底部倒计时 | `ui_updateRunShopScheduleUI`、`ui_showRunShop`、`ui_buyRunShopItem` 等 |
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
| 2026-04-18 | `src/ui_system.js`, `.cursor/rules/ui_system.md` | **命运时刻阶段语义显示修复**：即便内部仍复用 `selection` overlay，`ui_onPhaseChange()` 也必须根据 `fateMomentContext.type` 把大标题和顶部阶段标签渲染为“命运时刻 / 混沌精华 / 纯净精华”，避免特殊流程在视觉上继续伪装成普通命运抉择。 |
| 2026-04-18 | `src/game_system.js`, `src/ui_system.js`, `src/ui/shop.js`, `.cursor/rules/ui_system.md` | **命运时刻 UI 语义闭环**：round-start resolver 现在会直接触发 `chaos_essence` / `pure_essence` 两种模式；`ui_refreshSelectionModeUI()` 需要显式区分“混沌精华 / 纯净精华 / 命运抉择”三种标签与按钮文案；`ui_showRelicSelection()` 不再把两种精华当作普通遗物候选；`ui_confirmSelection()` 在纯净精华模式下除了写回 `MarbleDefinition.collected` 以外，还必须写入 `doubleAssimilationBoostRounds` 以兑现同化率 x2。 |
| 2026-04-17 | `index.html`, `src/game_system.js`, `src/ui_system.js`, `src/spawn_system.js`, `src/ui/shop.js`, `src/config.js`, `src/core.js`, `src/entities.js`, `src/game_phase.js` | **命运时刻 / 纯净精华 UI 接入**：当前主仓补落地了 `selection-mode-label`、`selected-required-count`、`selection-mode-subtitle` 三个选择阶段底栏节点；新增 `ui_getSelectionRequirement()`、`ui_isSelectionConfirmReady()`、`ui_getPureEssenceLegalElements()`、`ui_getPureEssenceRuneOptions()`、`ui_selectPureEssenceRune()`、`ui_renderPureEssencePanel()`、`ui_refreshSelectionModeUI()` 等辅助函数；`spawn_showMarblePreview()` 负责刷新纯净精华注入面板；`ui_closeRelicSelection()` 改为按 `relicOverlayReturnState` 恢复原阶段；`ui_confirmSelection()` 在纯净精华模式下会校验合法符文并把结果写回 `MarbleDefinition.collected`。 |
| 2026-06-18 | `index.html`, `src/ui_system.js` | **交互可解释性增强**：替换子弹卡片必须支持焦点态、Enter/Space 选择与 `aria-pressed`；确认按钮禁用时必须通过提示条/标题说明阻塞原因；运行态护盾等生存资源必须在顶栏可见，避免只依赖 Toast 记忆。 |
| 2026-06-18 | `src/utils/ammo_readability.js`, `src/render_system.js`, `src/game_phase.js`, `src/ui/hud.js`, `src/ui_system.js`, `index.html` | **下一发弹药可读性增强**：新增统一弹药读数工具，战斗 HUD 与 Canvas 发射器共用弹药构成、伤害数字、散射弹数、连射次数与主属性摘要；发射器绘制层以扇形预览展示散射，以数字徽标展示伤害，以能量条展示连射，不改变伤害公式。 |
| 2026-06-19 | `index.html`, `src/ui/shop.js`, `.cursor/rules/ui_system.md` | **测试遗物库移动端布局修复**：`ui_showRelicSelection({ showAllRelics: true })` 必须进入 `relic-debug-picker` 专用布局，使用紧凑纵向列表 + 预览面板 + 返回商店按钮；普通遗物选择仍保持三选一横向卡片语法。 |
| 2026-06-21 | `index.html`, `src/ui_system.js`, `.cursor/rules/ui_system.md` | **战斗主界面 P0 布局落地**：`combat-status-panel` 迁入 `#unified-top-bar` 中心区，作为顶部战斗 HUD 的紧凑态势胶囊，不再独立占用第二条顶部空间；`#phase-combat` 新增左右沉浸装饰带和 `.combat-safe-frame` 战斗判定区边框；战斗阶段进入时会移除 `#module-editor-entry-layer`，避免「编辑钉板」入口残留在右上角。业务层不直接操作 DOM，仍由 UI 层读取 Game 状态并刷新视图。 |
| 2026-06-22 | `src/config.js`, `src/ui/shop.js`, `src/game_system.js`, `src/core.js`, `index.html` | **局外商店测试遗物多选**：`debug_pick_any_relic` 价格保持 0，开启全遗物列表后使用 `saveData.debugStartRelicIds` 保存多个开局遗物；`debugStartRelicId` 仅作为旧存档兼容单值保留；`sys_initGameStart()` 必须逐个应用数组内遗物并触发对应即时效果。 |
| 2026-04-17 | `index.html`, `src/game_system.js` | 游戏容器宽高未同时适配屏幕宽度和高度：原 `height: 100dvh` 在竞屏手机上会超出屏幕宽度；`sys_resize` 中 `container.style.height = window.innerHeight` 会覆盖 CSS 高度计算。 | **完整等比缩放方案**：1. `#app-wrapper` 的 `align-items` 改为 `center`（防止 stretch 拉伸 game-container）；2. `#pc-left/right-sidebar` 加 `align-self: stretch`（PC 侧边栏仍填满高度）；3. `#game-container` 宽度改为 `min(100vw, calc(100dvh*9/16), 480px)`，移除 `height` 和 `min-width`，改用 `aspect-ratio: 9/16` + `max-height: 100dvh` 实现宽高双向等比缩放；4. `sys_resize()` 移除 `container.style.height` 覆盖，改用 `getBoundingClientRect()` 读取实际尺寸。 |

### 5.x 2026-06-18 新属性 UI 显示兜底记录

`venom` / `overcharge` / `echo` 必须同时进入 `CONFIG.ui.attributeDisplay`、伤害统计色板、HUD 队列属性格、配方卡材料格、当前/下一发弹药图标和替换子弹卡片属性列表。三项弹药 PNG 已落地到 `assets/icons/ammo/` 并由 `AMMO_ICON_MAP` 直接引用；UI 保留 emoji + CSS 颜色兜底，仅用于未来资产缺失或加载失败时避免空白。

## 6. 修改规范

### 6.1 新增 UI 功能

1. 判断功能属于哪个 UI 区域（HUD / 商店 / 符文发射器 / 核心协调）
2. 在对应模块文件中添加方法
3. 方法名遵循 `ui_` 或 `_ui_` 前缀约定
4. 如果方法直接读取 Game 状态，添加 `// TODO[Task 3.2]: 改为监听 EventBus 事件` 注释
5. 命运抉择相关 UI **禁止写死 `3`**；底栏计数、按钮启用条件和确认逻辑必须统一经由 `selectionMode` / `selectionRequiredCount` 与 `ui_getSelectionRequirement()` / `ui_isSelectionConfirmReady()`。
6. `ui_refreshSelectionModeUI()` 必须显式覆盖 `standard` / `chaos_essence` / `pure_essence` 三种文案，避免命运时刻进入后仍显示旧的“命运抉择”标签。
6.1 `ui_onPhaseChange()` 在 `selection` 阶段若检测到 `fateMomentContext.type`，必须把大标题和顶部阶段标签切换为“命运时刻”语义，而不是沿用普通选择阶段默认标题。
6.2 `ui_updateUI()`、顶部短标签与其他阶段显隐逻辑，必须优先复用统一的命运时刻语义判断（例如 `ui_isFateMomentPhase()`）；即使底层仍复用 `selection` overlay，也不能让命运时刻继续被普通 `selection` 的隐藏规则整体吞掉。
6.3 教程系统若通过 `PHASE_CHANGED -> selection` 作为推进条件，必须显式排除命运时刻场景，避免特殊流程误推进新手教程。
7. 任何从选择阶段或命运时刻中途打开的 overlay，在关闭时都必须优先依据 `relicOverlayReturnState` 恢复原阶段，禁止默认重跑 `sys_initSelectionPhase()` 覆盖当前特殊选择态。
8. `ui_confirmSelection()` 在纯净精华模式下不能只更新预览或文案，必须同时写回 `MarbleDefinition.collected`、注入元数据，并写入 `doubleAssimilationBoostRounds`，否则同化率 x2 只会停留在 UI 层。
9. 命运时刻中途若发生刷新、继续游戏或 overlay 往返，`selectionPreviewState`、`relicOverlayReturnState`、`fateMomentContext` 必须保持同源恢复；只有确认选珠并进入研磨阶段后，才允许统一清空。
10. `fate_reroll_token` / `relic_reroll_seal` 只允许提供当前选择机会内的一次刷新：弹珠刷新由 `ui_rerollMarbleSelection()` 清空已选弹珠后重跑 `spawn_generateMarbleOptions()`；遗物刷新由 `ui_rerollRelicSelection()` 重跑 `ui_showRelicSelection({ isReroll: true })`，不得额外推进 `relicSelectionCount`，debug 全遗物库不显示刷新按钮。

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
| `ui_openTruthBook(options)` / `ui_closeTruthBook()` | 真理之书面板开关；从 `selection` 等运行态打开时记录 `truthBookReturnState`，关闭后恢复原阶段和命运时刻语义 |
| `ui_updateSlowMotion()` | 慢动作逻辑更新（每帧调用） |
| `ui_updateMetaCurrency()` | 更新局外货币显示 |
| `ui_updateRuneCountDisplay()` | 更新符文数量显示 |
| `ui_getSelectionRequirement()` | 读取当前命运时刻所需的弹珠数量（标准 3 选、混沌精华 3 选或纯净精华 1 选） |
| `ui_isSelectionConfirmReady()` | 统一判断当前选择阶段是否允许确认 |
| `ui_getPureEssenceLegalElements(marbleDef)` | 计算纯净精华模式下某枚弹珠允许注入的合法属性集合 |
| `ui_getPureEssenceRuneOptions(marbleDef)` | 从符文库存中过滤出当前弹珠可注入的合法符文 |
| `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` | 为当前选中的弹珠绑定一个合法的注入符文 |
| `ui_renderPureEssencePanel(marbleDef, selectionIndex)` | 在弹珠预览面板中渲染纯净精华的合法属性和符文注入按钮 |
| `ui_refreshSelectionModeUI()` | 刷新命运抉择底栏标签、需求数量、副标题和确认按钮状态，并正确显示混沌精华 / 纯净精华文案 |
| `ui_rerollMarbleSelection()` | 消费当前命运抉择的弹珠刷新机会，清空已选弹珠并重建候选卡片 |
| `fateMomentContext`（运行态字段） | 记录当前命运时刻来源、类型与回合信息，用于刷新恢复和 overlay 返回后的语义保持 |
| `meta_getResourceCount(resourceId)` | 获取资源数量 |
| `meta_spendResource(resourceId, amount)` | 消耗资源 |
| `ui_updateUI()` | 主 UI 更新入口（每帧调用） |
| `ui_resetCombatPhaseHud()` | 阶段切换时清理战斗专属 HUD 残留；`training` 可保留态势面板但必须清掉配方、技能、伤害数字和符文充能 UI |
| `ui_clearTransientOverlays()` | 进入 meta/shop/truth_book/gameover 等终止或局外阶段时清理 Boss 入场、混沌轮盘、遗物层、符文选择器、模块编辑器和 Toast 等高层临时覆盖物 |
| `ui_confirmSelection()` | 确认弹珠选择；在纯净精华模式下完成合法性校验、符文写回与双倍同化率状态落地 |
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
| `ui_abandonRunToMeta()` | 暂停页放弃本局的统一出口：关闭暂停/符文发射器、清局内存档、重置运行态并返回 meta |
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
| `ui_rerollRelicSelection()` | 消费当前遗物选择的刷新机会并重抽候选遗物，不额外推进遗物选择计数 |
| `ui_selectRelic(relic)` | 选择并获取遗物（参数为遗物对象） |
| `ui_skipRelic()` | 跳过遗物选择 |
| `ui_closeRelicSelection()` | 关闭遗物选择界面 |

### 6.3.1 src/ui/run_shop.js（局内商店）

| 函数 | 描述 |
|---|---|
| `ui_offerRunShop()` | 兼容旧的可选商人入口与遗物跳过流程；常规随机到访不再由它阻塞横幅 |
| `ui_showRunShop()` | 打开局内商店，使用 `runFragments` 购买本局构筑资源；从底部入口打开时临时暂停当前运行阶段 |
| `ui_renderRunShop()` | 渲染当前货架、持有碎片、可购买状态与刷新/离开按钮 |
| `ui_buyRunShopItem()` | 购买钉盘组件、符文、模块槽位或特殊槽，并写回本局状态 |
| `ui_updateRunShopScheduleUI()` | 渲染底部 `#run-shop-status-dock`，展示到访/离开倒计时、进度条与可打开商店按钮 |

局内商店不得作为永久升级入口；购买内容只影响当前 run。刷新、购买、离开时应调用 `sys_saveRunState()`，确保 `runFragments`、货架、商人调度与首访援助领取状态可恢复。常规到访由 `runShopNextOfferRound` / `runShopActiveUntilRound` 驱动，首访第 3 回合固定提供免费 `starter_boost` 占位援助包；该包的伤害部分必须通过 `runShopStarterBoostDamageRounds` 临时衰减，不得沉淀为永久 `flatDamageBonus`。同一次到访期内货架只生成一次，重开商店不得绕过刷新成本。遗物跳过进入商店时必须先发放 `CONFIG.gameplay.runShopSkipRelicBonus`，避免玩家用遗物换到无购买力商店。

## 7. 2026-06-18 Interaction Notes

- `#module-editor-layer` 的模块选择浮层必须在渲染阶段预先调用 `_moduleEditor_getModulePlacementStatus(slotIdx, moduleId)`；不合法的模块以禁用态展示，并在卡片描述或 `title` 中说明原因。
- 模块选择浮层的 `.me-picker-item` 需要保留 hover/focus 事件，即使不可放置也必须写入 `_moduleEditorPlacementPreview`，让 Canvas 同步显示合法/非法覆盖槽位。不可放置项使用 `aria-disabled="true"` 与点击拦截，不使用原生 `disabled` 阻断预览事件。
- ????????? UI ???????????????????????? `pegs` ?? `infusedRuneId` / `fusionSourceLevel`?????????? `pegStates[source="fusion"]`??????????????????????????? 3x3 ????????? `RUNEWORD_DB.pattern` ???????????????
- ???????????????????? `_moduleEditor_validateBeforeStart()`?????? ref?????????????????????????????????????????? `_moduleEditor_showNotice()` ??????????????
- 钉板编辑器必须由研磨常态下的「编辑钉板」入口显式进入；进入研磨阶段时不得自动打开编辑态。编辑态必须常驻显示 `ownedModuleComponents` 库存栏。
- 钉板编辑器的画布点击只负责选中槽位和展示预览；不得直接装备或卸下。装备必须先在库存栏选中组件，再通过「装备到槽位」确认；卸下必须选中已装备槽后点击「卸下」，并把组件放回 `ownedModuleComponents`。
- `_moduleEditor_applyModule()` 必须先完成放置校验，再清空旧模块或写入 `currentModuleLayout`，避免玩家误点一个不可放置的大模块时丢失原模块。
- 大模块校验需要同时检查：是否越过 `CONFIG.gameplay.moduleCols/moduleRows` 钉盘边界、是否超出 `getActiveModuleSlotSet()` 所定义的已解锁槽位、是否与其他模块锚点或 ref 覆盖格重叠。
- 模块编辑器写入 `currentModuleLayout` 时必须创建 `{ id, uid, pegStates, pluginStates }` 组件实例；多格占位使用 `{ ref: anchorIdx }`。不得重新写入裸字符串模块 ID，否则符文融合写入的 `pegStates` 会在替换/重建时丢失。
- 模块编辑器的 picker 必须读取 `ownedModuleComponents` 库存；装备组件时从库存移除该 `uid`，卸下组件时放回库存。不得读取 `unlockedModuleTypes` 作为可无限使用的模板列表。
- `#combat-status-panel` 是战斗态势聚合入口，由 `ui_updateCombatStatusPanel()` 节流刷新；只读 `enemies`、`defeatLineY`、`playerShield`、`ammoQueue` 等现有状态，不得在该函数内改变战斗逻辑。
- 战斗危险反馈统一使用“稳定 / 压线 / 危险 / 护盾待触发”语义，避免各处新增彼此冲突的临时文案。
- 下一发弹药的属性构成、散射弹数、连射次数和装填格必须统一走 `getAmmoReadabilityProfile()`；`ui_updateCombatStatusPanel()`、战斗 HUD 卡片和 `render_combat_launcherSignal()` 不得各自重新定义展示阈值或评价文案。
- `UIManager.updateSkillBar()` 负责战斗技能栏工具组：顶部显示当前 SP，技能按钮使用两列网格、`button` 语义、成本徽章、可用状态点和禁用原因；只调用 `game.combat_activateSkill(skill)`，不得在 UI 层扣 SP 或改技能效果。
- `ui_updateUI()` 必须在非 `combat` 阶段调用 `ui_resetCombatPhaseHud()`，集中隐藏/重置 `#recipe-hud-container`、`#skill-bar`、`#round-damage-display`、`#combat-rune-charge-ui` 和伤害统计抽屉；`training` 只允许保留 `#combat-status-panel`，不得继承 combat 专属浮层。
- `ui_updateUI()` 进入 `meta` / `shop` / `truth_book` / `gameover` 等局外或终止阶段时必须调用 `ui_clearTransientOverlays()`，清掉 Boss 入场、混沌老虎机、遗物 overlay、模块编辑器、符文选择弹层和终局 Toast。`gameover` 入口也应主动调用一次，避免失败发生在高 z-index 演出期间时遮挡结算页。
- 暂停页不得只显示 DOM overlay；`ui_openPause()` 必须设置 `isPaused=true` 和 `_pausedFromPhase`，`ui_closePause()` 必须恢复这两个字段并禁用 `#phase-pause` 的 pointer events。“放弃本局”不得直接 `phase_switchPhase('meta')`，必须走 `ui_abandonRunToMeta()` 统一清理局内存档和临时 UI。
- PC 侧栏只允许在 `gathering` / `combat` / `selection` / `training` 运行态显示；`meta`、`shop`、`gameover`、`truth_book`、`relic` 等全屏/局外阶段必须隐藏左右侧栏，避免常驻符文发射器或战斗 HUD 残留。
- 局外商店中的 `debugOnly` 商品默认必须隐藏，`meta_buyUpgrade()` 也必须校验 `CONFIG.debug` / `debugMode` / `localStorage.echo_debug_shop`，禁止通过普通商店或控制台直接购买测试遗物任选项。测试遗物任选项必须写入 `saveData.debugStartRelicIds` 多选数组并在下一次 `meta_startRun()` / `sys_initGameStart()` 中生效；旧的 `debugStartRelicId` 只能作为兼容字段同步首个选中项。

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

## 7. 阶段五：UI 位图化接入计划（待实施）

> 详细规格见 [`design_spec_bitmap.md`](../../design_spec_bitmap.md)

阶段五 Phase A 计划用位图替换纯色/纯 CSS 的装饰性背景与图标。**所有 DOM 结构、JS 事件逻辑、状态切换逻辑均不改动**，仅替换 CSS `background`、`background-image` 和图标内容。

### 受影响的函数与 DOM 节点

| 任务 | 目标 DOM / 函数 | 替换内容 |
| :--- | :--- | :--- |
| 5.A2 | `#unified-top-bar` CSS `background` | 纯色背景 → 9-Slice PNG |
| 5.A3 | `.rune-card`、`.relic-card`、`#phase-rune-launcher` CSS `border` | 纯色边框 → 稀有度 9-Slice 边框图 |
| 5.A4 | `.sp-gem` DOM 内容、`#settings-btn`/`#speed-btn` 图标 | 纯色圆点/文字 → 固定尺寸 Sprite |
| 5.A5 | `hud.js → ui_renderAmmoIcon()` | 纯色圆形 → 32×32 炼金法球位图 |
| 5.A6 | `rune_launcher.js → _ui_buildRuneIconHTML()` | emoji → 48×48 符文专属位图 |
| 5.A7 | `shop.js → relic-icon` div 内容 | emoji → 64×64 遗物专属位图 |
| 5.A8 | `rune_launcher.js → 图鉴已发现卡片图标区` | 🔒 占位 → 64×64 词条专属位图（需同步在 RUNEWORD_DB 添加 `icon` 字段） |

**开发注意事项**：

- 9-Slice 图片通过 CSS `border-image` 属性接入，无需修改 JS
- 位图图标通过 `<img src="assets/icons/...">` 或 CSS `background-image` 接入，替换现有 emoji 文本节点
- Task 5.A8 需在 `RUNEWORD_DB`（`src/config.js`）中为每个词条对象新增 `icon: 'assets/icons/runeword/xxx.png'` 字段，并在图鉴渲染函数中读取该字段

## 8. 2026-06-19 Mobile Selection Safety

- On coarse-pointer devices, cards that can permanently choose or apply a reward/configuration must not confirm on the first tap.
- Current covered surfaces: `#phase-relic .relic-card` and `.me-picker-item` in the pinboard module picker. `#phase-selection .select-card` remains single-tap because players select several marbles in one flow.
- First tap previews/highlights the item; the second tap on the same item confirms. Desktop mouse and keyboard behavior may remain direct where existing flows expect it.

## 9. 2026-06-19 Meta Resource Save Contract

- `saveData.resources` is the canonical store for meta-shop resources. `rune_fragments` must be mirrored to legacy `saveData.runeFragments` and `saveData.currency` for older UI and saves.
- All rune-fragment reads in meta shop, rune launcher, and top-level currency UI must go through `meta_getResourceCount('rune_fragments')`.
- All rune-fragment gains and spends must go through `meta_addCurrency()` / `meta_spendResource()`. Do not write `saveData.runeFragments += ...` directly.
- `sys_loadSaveData()` must call `_meta_ensureResourceStore()` after merging legacy saves so old `currency` / `runeFragments` data is migrated into `resources.rune_fragments`.
- The meta shop must render `#shop-resource-overview` from `META_SHOP_CONFIG.resources`, not only the headline shard counter, so players can inspect every spendable meta resource.

## 10. 2026-06-19 Combat Top Safe Area

- `#combat-status-panel` must sit below `#unified-top-bar`, not overlap it. Keep its CSS `top` in sync with the top bar height expression plus the 6px visual gap.
- `sys_resize()` must calculate `combatGridTopY` from the bottom of the full combat top UI stack: unified top bar + status strip + 8px battlefield gap + half an enemy cell.
- Do not spawn combat enemies, Bosses, training combat dummies, or draw the top wall from a hard-coded `80px` top row. Use `combatGridTopY` so the visible battlefield never sits under the top HUD.

## 11. 2026-06-21 Run Shop And Rune Claim Feedback

- `#run-shop-status-dock` must remain a compact top-right status capsule in gathering/combat phases. Do not move it back to the bottom firing area, because that overlaps the launcher/crystal-core interaction space.
- Rune acquisition must use a two-step feedback pattern: `.rune-acquire-reveal` central reveal for name/level recognition, followed by the existing `.rune-claim-fly--to-bag` travel animation.
- The reveal animation is DOM/CSS only and should not add Canvas particles or `shadowBlur` render work.

## 12. 2026-06-21 Marble Rune Slot Selection UI

- The marble preview panel owns the in-run rune fusion entry. It renders three slots per marble and uses `ui_fuseRuneIntoMarble()` to consume a rune immediately.
- Fused runes are stored on the marble as `runeSlots`; do not write them directly into `marble.collected` from UI code.
- Once a selected marble has fused rune slots, selection toggling must keep it locked for the current charge sequence to prevent accidental rune loss.

## 2026-06-21 Combat HUD Stack Fix

- `#combat-status-panel` is now a compact left-side numeric strip inside `#unified-top-bar`; it must not share the centered lane with `#combat-rune-charge-ui`.
- Combat status copy must not surface pressure-line / defense-line wording. Keep this panel focused on enemy, elite, Boss, shield, and ammo counts.
- `src/game_phase.js` no longer draws the red defense-line art layer. `defeatLineY` remains gameplay state for lose checks only.
- `sys_resize()` should reserve only the unified top bar for `combatGridTopY`, because the status strip no longer occupies a second top row.
- Follow-up: the combat top bar is a three-column grid: left status, center rune charge, right round/settings. Do not place floating labels, shop countdown docks, or stretched 9-slice combat frames over the first viewport.
- Phase switching must restore `#unified-top-bar` with `display: grid`, never `display: flex`, or the three lanes collapse on narrow combat views.
- Combat recipe HUD cards must stay narrow, left-aligned, and clear of the bottom launcher/core interaction area.
- Gathering uses `#unified-top-bar.is-gathering`: keep it compact, keep the run-shop schedule in `.run-shop-status-dock.is-gathering-top`, and do not let the merchant/status strip drop into the first peg rows.
