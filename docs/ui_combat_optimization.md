# 局内UI分析与优化设计方案

## 1. 现状分析：战斗阶段 UI 层叠与混乱的根源

在深入分析 Echo Alchemist V2 的代码库后，我们发现目前战斗阶段的局内 UI 存在严重的层叠和遮挡问题，尤其是顶部区域。这主要是由于 UI 元素的声明分散在不同的容器中，且多个模块通过绝对定位（`absolute` 或 `fixed`）将元素强行推入同一视觉区域，导致了空间冲突。

### 1.1 涉及的 UI 模块与职责

目前，局内 UI 的渲染和控制逻辑分布在以下几个核心文件中：

*   **`index.html` (DOM 结构定义)**：定义了所有的 UI 容器，包括顶部栏 (`.top-bar`)、技能点面板 (`#sp-panel`)、战斗充能符文 (`#combat-rune-charge-ui`) 等。这些容器大多使用了 `absolute` 定位。
*   **`src/ui_system.js` (UI 核心协调层)**：作为阶段切换的主控，负责通过 `ui_updateUI()` 强制显示或隐藏不同阶段的 UI 覆盖层（`.ui-overlay`）。它直接控制了 `.bottom-panel`、`#skill-bar`、`#multiplier-display`、`#sp-panel` 和 `#recipe-hud-container` 的可见性。
*   **`src/ui/hud.js` (HUD 渲染模块)**：负责战斗内高频变动的数值型 HUD 渲染，如回合伤害 (`ui_updateRoundDamage`)、分数乘数 (`ui_updateMultiplierUI`)、配方卡片 (`ui_renderRecipeHUD`) 和弹药槽位 (`ui_updateAmmoUI`)。它通过监听 `EventBus` 的事件（如 `UI_MULTICAST_UPDATE`、`UI_HIT_PROGRESS`）来更新 DOM。
*   **`src/systems.js` (`UIManager` 类)**：这是一个独立于核心 UI 系统的管理器，主要负责技能栏 (`updateSkillBar`)、技能点面板 (`updateSkillPoints`)、信息抽屉 (`info-drawer`) 以及标签页切换。它直接操作 DOM 元素，与 `ui_system.js` 存在一定的控制权交叉。

### 1.2 顶部栏层叠问题剖析

在战斗阶段（`phase-combat`），以下元素同时试图占据屏幕的顶部或上部区域，导致了严重的层叠和遮挡：

1.  **全局顶部栏 (`.top-bar`)**：位于 `max(10px, env(safe-area-inset-top))`，包含回合数 (`R 1`)、加速按钮 (`⏩`)、静音按钮 (`🔊`)、伤害数字切换 (`🔢`) 和 CRT 特效切换 (`📺`)。
2.  **技能点面板 (`#sp-panel`)**：位于 `top-16 left-4`（绝对定位），由 `UIManager.updateSkillPoints()` 动态生成宝石槽位。
3.  **战斗充能符文 UI (`#combat-rune-charge-ui`)**：位于 `top: 10px; left: 50%; transform: translateX(-50%)`，包含充能条和奖励行。
4.  **阶段标题动画 (`#phase-title-container.minimized`)**：阶段切换后，标题会缩小并移动到左上角 (`top: max(20px, env(safe-area-inset-top)); left: 20px`)。

**冲突表现**：
*   缩小后的阶段标题 (`#phase-title-container.minimized`) 直接与左上角的技能点面板 (`#sp-panel`) 重叠。
*   如果屏幕较窄，居中的战斗充能符文 (`#combat-rune-charge-ui`) 会与右侧的全局顶部栏 (`.top-bar`) 发生挤压。
*   这些元素统统悬浮在游戏画布 (`canvas`) 之上，由于缺乏统一的背景遮罩或布局规划，在敌人移动到屏幕顶部时，会严重遮挡玩家视线。

---

## 2. 优化设计方案

为了解决 UI 混乱和遮挡敌人的问题，我们需要从“各自为战的绝对定位”转向“统一规划的网格布局”，并明确各模块的职责边界。

### 2.1 布局重构：统一顶部信息栏 (Top Info Bar)

摒弃目前散落在各个角落的绝对定位元素，设计一个统一的、具有半透明背景的顶部信息栏，将所有关键的局内信息整合其中。

**设计思路**：
*   **背景遮罩**：为顶部栏添加一个高度固定的半透明背景（如 `bg-slate-900/80 backdrop-blur-sm`），将其与游戏画面物理隔离，避免文字直接悬浮在复杂的战斗背景上。
*   **三段式布局 (Flexbox)**：
    *   **左侧 (Left Area)**：放置当前阶段状态。将缩小后的阶段标题（如“战斗阶段”）固定在此处，不再使用悬浮动画。紧接其后放置技能点面板（SP 宝石）。
    *   **中间 (Center Area)**：放置核心战斗进度。将战斗充能符文 UI (`#combat-rune-charge-ui`) 嵌入其中，并优化其高度，使其更紧凑。
    *   **右侧 (Right Area)**：放置系统控制按钮和回合数。整合原 `.top-bar` 中的内容（回合数、加速、静音、CRT 等）。

**CSS 结构示意**：
```html
<div id="unified-top-bar" class="absolute top-0 left-0 w-full h-16 bg-slate-900/85 backdrop-blur-md border-b border-slate-700/50 flex justify-between items-center px-4 z-[500]">
    <!-- 左侧：阶段信息与 SP -->
    <div class="flex items-center gap-4 w-1/3">
        <div id="static-phase-title" class="text-sm font-bold text-amber-400 font-[Cinzel]">戰鬥階段</div>
        <div id="sp-panel" class="flex gap-2"></div>
    </div>
    
    <!-- 中间：战斗充能 -->
    <div class="flex justify-center w-1/3">
        <div id="combat-rune-charge-ui" class="scale-90 transform origin-top">...</div>
    </div>
    
    <!-- 右侧：系统控制 -->
    <div class="flex items-center justify-end gap-2 w-1/3">
        <div class="stat-pill">R <span id="round-num">1</span></div>
        <button class="btn-icon">⏩</button>
        <button class="btn-icon">📺</button>
    </div>
</div>
```

### 2.2 视觉优化：减少遮挡与冗余

1.  **移除阶段标题的缩放动画**：目前的 `#phase-title-container` 在阶段切换时会从屏幕中央缩小并飞到左上角，这个动画不仅冗长，而且最终停留的位置（`.minimized`）会破坏左上角的布局。建议改为：在屏幕中央显示大标题后直接淡出消失，顶部栏中的静态标题同步更新。
2.  **调整画布安全区 (Safe Area)**：既然顶部增加了一个固定高度（如 64px）的统一信息栏，我们需要在 `Game` 类的渲染逻辑中，将敌人的生成区域和移动限制区域向下偏移，确保敌人永远不会走到顶部栏的下方。
3.  **精简控制按钮**：评估顶部按钮的使用频率。例如，“伤害数字切换”按钮是否可以移入设置菜单？以腾出更多空间。

### 2.3 架构治理：收束 UIManager 权限

目前 `UIManager` (在 `systems.js` 中) 越权管理了属于基础 HUD 的技能点 (`#sp-panel`) 和技能栏 (`#skill-bar`)。这违反了项目中建立的 UI 模块划分原则。

**重构建议**：
1.  将 `UIManager.updateSkillPoints()` 的逻辑迁移到 `hud.js` 中，重命名为 `ui_updateSkillPointsUI()`，并让其通过监听 EventBus 事件（如 `UI_SP_UPDATE`）来触发更新。
2.  将 `UIManager.updateSkillBar()` 的逻辑同样迁移到 `hud.js`，通过事件驱动。
3.  `UIManager` 应专职负责管理复杂的、覆盖全屏的非战斗面板，如“敌人信息抽屉 (`info-drawer`)”、“真理之书 (`TruthBook`)”和“试炼场 (`TrainingGround`)”。

### 2.4 实施步骤计划

1.  **Step 1: HTML 结构清理**
    *   在 `index.html` 中删除旧的 `.top-bar`、独立悬浮的 `#sp-panel` 和 `#combat-rune-charge-ui`。
    *   引入新的 `#unified-top-bar` 三段式布局结构，将上述元素整合进去。
2.  **Step 2: CSS 样式调整**
    *   移除 `#phase-title-container.minimized` 的相关样式。
    *   调整充能符文 UI 的缩放比例，使其适应 64px 高度的顶部栏。
3.  **Step 3: 核心逻辑适配**
    *   修改 `ui_system.js` 中的 `ui_onPhaseChange`，使其只负责中央大标题的淡入淡出，并更新新顶部栏中的静态阶段文本。
    *   在 `core.js` 或 `spawn_system.js` 中，调整敌人的 Y 轴活动边界，避开顶部 64px 的 UI 遮挡区。
4.  **Step 4: 模块权限迁移 (可选，视重构深度而定)**
    *   将 `SP` 和 `SkillBar` 的渲染逻辑从 `systems.js` 转移到 `hud.js`。

---
*文档生成完毕。如需执行代码修改，请根据 Echo Developer 规范创建分支并提交。*

## 3. 实施记录 (Implementation Log)

根据优化方案，已完成以下代码重构与修改：

### 3.1 统一顶部信息栏 (`#unified-top-bar`)
- 在 `index.html` 中引入了 `#unified-top-bar` 容器，采用 Flexbox 三段式布局。
- 左侧：移入了阶段短标题和 SP 宝石面板。
- 中间：移入了 `#combat-rune-charge-ui`（充能符文 UI），使其在战斗阶段居中显示。
- 右侧：移入了回合数显示和加速按钮。

### 3.2 功能按钮收纳 (Settings Panel)
- 将原有的静音 (`🔊`)、伤害数字 (`🔢`)、CRT 特效 (`📺`) 按钮从顶部栏直接显示改为收纳至下拉设置面板。
- 在顶部栏右侧添加了设置按钮 (`⚙️`)，点击可展开 `#settings-panel`。
- 在 `index.html` 底部脚本中统一了设置面板的交互逻辑（点击展开/收起、点击外部关闭），并将对应的切换方法挂载到 `game` 实例上（`sys_toggleMute`, `sys_toggleDamageNumbers`, `sys_toggleCrt`）。

### 3.3 视觉与动效优化
- **SP 宝石缩小**：将 `.sp-slot` 的尺寸从 20px 缩小至 12px，并相应减小了激活时的阴影大小（`systems.js` 和 `index.html` CSS）。
- **阶段标题动效**：废弃了原有的缩小至左上角动画 (`.minimized`)。现在阶段大标题在中央淡入后，会在 1.2 秒后直接淡出，避免与左上角 UI 重叠（修改了 `ui_system.js` 中的 `ui_onPhaseChange` 方法）。
- **顶部栏显隐控制**：在 `ui_system.js` 的 `ui_updateUI` 中添加了逻辑，使得统一顶部栏在 `meta`、`shop` 等全屏阶段隐藏，在核心玩法阶段显示。
