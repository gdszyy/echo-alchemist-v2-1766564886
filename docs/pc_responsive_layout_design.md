# Echo Alchemist V2 — PC 响应式与固定宽高游戏区域设计规划

> **文档状态**：设计规划（待实施）  
> **最后更新**：2026-04-16  
> **作者**：Manus AI  
> **关联模块**：`index.html`、`src/game_system.js`、`src/ui_system.js`、`src/ui/hud.js`、`src/ui/rune_launcher.js`

---

## 1. 现状分析与问题诊断

### 1.1 当前布局架构

《Echo Alchemist V2》目前的渲染层次如下：

```
window (100vw × 100dvh)
└── #game-container (100% × 100dvh)  ← 全屏流式
    └── canvas#gameCanvas (100% × 100%)  ← 随容器拉伸
    └── .ui-overlay (position: absolute, 全屏覆盖)
        ├── #unified-top-bar
        ├── #phase-gathering (.bottom-panel 在底部)
        ├── #phase-combat
        └── #phase-rune-launcher (全屏覆盖层，z-index: 300)
```

`sys_resize()` 在 `game_system.js` 中强制将 `canvas.width = container.clientWidth`，即 Canvas 的**逻辑分辨率**等于屏幕宽度。这意味着：

| 场景 | Canvas 宽度 | 效果 |
|---|---|---|
| iPhone 14 (390px) | 390px | ✅ 正常，钉盘比例合适 |
| iPad (820px) | 820px | ⚠️ 偏宽，弹道扁平 |
| 1080p PC (1920px) | 1920px | ❌ 极度拉伸，游戏性严重受损 |

### 1.2 关键数值参考

- 钉盘列数：`CONFIG.gameplay.cols = 10`，水平间距 `spacingX = 35px`
- 钉盘最小逻辑宽度：`(10-1) × 35 + 左右边距 ≈ 350px`
- 钉盘最大合理宽度（保持游戏性）：`≈ 420px`
- 当前底部面板高度：`115px`（`.bottom-panel`）
- 当前符文发射器：`max-width: 448px`（`max-w-md`），全屏覆盖层

### 1.3 手机安全尺寸基准

以主流手机安全内容区为基准（参考 iPhone 14 Pro 的 393 × 852px 物理分辨率，逻辑分辨率约为 **390 × 844px**）：

- **安全宽度**：`390px`（含两侧 12px 内边距，有效内容区约 366px）
- **安全高度**：`844px`（含顶部状态栏约 47px 和底部 Home 条约 34px）
- **有效游戏区高宽比**：约 `(844 - 47 - 34) / 390 ≈ 1.95`，即接近 **9:17.5**，可简化为 **9:16** 作为保守基准

---

## 2. 固定宽高方案设计

### 2.1 核心策略：高度优先的等比缩放

**方案核心**：游戏区域的高度始终填满视口高度（`100dvh`），宽度按 `9:16` 比例计算，并设置绝对上限。

```
游戏区域宽度 = min(100dvh × (9/16), 480px)
游戏区域高度 = 100dvh
```

| 屏幕场景 | 视口高度 | 计算宽度 | 实际宽度（受上限约束） |
|---|---|---|---|
| iPhone 14 竖屏 | 844px | 474px | 474px（≤480px，不受限） |
| iPad 竖屏 | 1024px | 576px | 480px（受上限约束） |
| 1080p PC 横屏 | 1080px | 607px | 480px（受上限约束） |
| 1440p PC 横屏 | 900px | 506px | 480px（受上限约束） |

> **为何选择 480px 上限**：钉盘 10 列 × 35px 间距 = 315px，加上两侧边距后约 370px；符文发射器内容区 `max-w-md = 448px`；综合两者，480px 是能完整容纳所有 UI 元素同时保持游戏性的最大值。

### 2.2 CSS 实现

```css
/* ===== 新增：最外层 App Wrapper ===== */
#app-wrapper {
    display: flex;
    justify-content: center;
    align-items: stretch;
    width: 100%;
    height: 100dvh;
    background-color: #020617; /* 侧边区域的背景色 */
    overflow: hidden;
}

/* ===== 修改：核心游戏容器 ===== */
#game-container {
    position: relative;
    /* 高度优先：始终填满视口 */
    height: 100dvh;
    /* 宽度：按比例计算，但不超过上限 */
    width: min(calc(100dvh * 9 / 16), 480px);
    /* 移动端兜底：不小于屏幕宽度（防止手机端出现空白侧边栏） */
    min-width: min(100vw, 480px);
    flex-shrink: 0;
    background: #0f172a;
    /* ... 原有渐变背景保持不变 ... */
    overflow: hidden;
}

/* ===== 新增：PC 左侧边栏 ===== */
#pc-left-sidebar {
    display: none; /* 默认隐藏，由 JS 控制 */
    flex-direction: column;
    flex: 1;
    min-width: 260px;
    max-width: 360px;
    height: 100dvh;
    background: rgba(15, 23, 42, 0.98);
    border-right: 1px solid #334155;
    overflow-y: auto;
    padding: 16px 12px;
}

/* ===== 新增：PC 右侧边栏 ===== */
#pc-right-sidebar {
    display: none; /* 默认隐藏，由 JS 控制 */
    flex-direction: column;
    flex: 1;
    min-width: 300px;
    max-width: 420px;
    height: 100dvh;
    background: rgba(15, 23, 42, 0.98);
    border-left: 1px solid #334155;
    overflow-y: auto;
    padding: 16px 12px;
}
```

---

## 3. PC 模式响应式侧边栏方案

### 3.1 断点定义

PC 模式的触发条件为：**视口宽度 > 视口高度**（即横屏模式）。在此基础上，根据可用宽度决定展开哪些侧边栏：

| 条件 | 布局模式 | 左侧边栏 | 右侧边栏 |
|---|---|---|---|
| `innerWidth ≤ innerHeight`（竖屏） | 移动端模式 | 隐藏 | 隐藏（覆盖层弹出） |
| `innerWidth > innerHeight` 且总宽 `< 900px` | 宽屏单侧 | 隐藏 | 展开（右侧符文发射器） |
| `innerWidth > innerHeight` 且总宽 `≥ 900px` | 宽屏双侧 | 展开（左侧抽屉） | 展开（右侧符文发射器） |

> **注意**：PC 横屏模式下，游戏区域高度 = 视口高度，宽度约为 `480px`，两侧各有 `(innerWidth - 480) / 2` 的剩余空间。当 `innerWidth = 900px` 时，两侧各约 `210px`，已足够展开一个侧边栏。

### 3.2 HTML 结构改造

```html
<body>
<!-- 最外层 Wrapper -->
<div id="app-wrapper">

    <!-- [PC 端] 左侧边栏 -->
    <aside id="pc-left-sidebar">
        <!-- 阶段标题 -->
        <div id="pc-left-title" class="text-xs font-bold text-amber-400/60 tracking-widest uppercase mb-4 font-[Cinzel]">
            收集阶段
        </div>
        <!-- 收集队列（从 .bottom-panel 迁移） -->
        <div id="pc-left-queue-mount" class="mb-4"></div>
        <!-- 配方 HUD（从 .bottom-panel 迁移） -->
        <div id="pc-left-recipe-mount" class="flex-1 overflow-y-auto"></div>
    </aside>

    <!-- 核心游戏区域（原 #game-container，保持不变） -->
    <main id="game-container">
        <canvas id="gameCanvas"></canvas>
        <!-- ... 所有原有 UI 覆盖层 ... -->
        
        <!-- 移动端底部面板（PC 端隐藏） -->
        <div class="bottom-panel" id="mobile-bottom-panel">
            <div class="flex items-center w-full h-full">
                <div class="queue-container" id="gathering-queue"></div>
                <div class="flex-1 min-w-0 h-full">
                    <div id="gathering-hud-mount" class="recipe-scroll"></div>
                </div>
            </div>
        </div>
    </main>

    <!-- [PC 端] 右侧边栏 -->
    <aside id="pc-right-sidebar">
        <!-- 符文发射器内容（从 #phase-rune-launcher 迁移） -->
        <div id="pc-right-rune-mount" class="flex flex-col h-full"></div>
    </aside>

</div>
</body>
```

### 3.3 JS 响应式控制逻辑

在 `src/ui_system.js` 中新增 `ui_updatePCLayout()` 方法，并在 `sys_resize()` 中调用：

```javascript
// src/ui_system.js 新增方法
ui_updatePCLayout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isLandscape = vw > vh;
    const leftSidebar = document.getElementById('pc-left-sidebar');
    const rightSidebar = document.getElementById('pc-right-sidebar');
    const mobileBtmPanel = document.getElementById('mobile-bottom-panel');

    if (!isLandscape) {
        // === 竖屏/移动端模式 ===
        leftSidebar && (leftSidebar.style.display = 'none');
        rightSidebar && (rightSidebar.style.display = 'none');
        mobileBtmPanel && (mobileBtmPanel.style.display = 'flex');
        this._pcMode = false;
        return;
    }

    // === PC 横屏模式 ===
    const gameW = Math.min(vh * 9 / 16, 480);
    const sideW = (vw - gameW) / 2;

    // 右侧：符文发射器（≥ 300px 空间才展开）
    const showRight = sideW >= 300;
    rightSidebar && (rightSidebar.style.display = showRight ? 'flex' : 'none');

    // 左侧：底部抽屉（≥ 260px 空间才展开）
    const showLeft = sideW >= 260;
    leftSidebar && (leftSidebar.style.display = showLeft ? 'flex' : 'none');

    // 移动端底部面板：PC 模式下隐藏
    mobileBtmPanel && (mobileBtmPanel.style.display = 'none');

    this._pcMode = isLandscape;
    this._pcShowLeft = showLeft;
    this._pcShowRight = showRight;
},
```

### 3.4 左侧边栏：底部抽屉内容迁移

**原始位置**：`#phase-gathering` 内的 `.bottom-panel`，包含：
- `#gathering-queue`：收集队列（弹珠小圆点）
- `#gathering-hud-mount`：配方 HUD（横向滚动卡片）

**PC 端适配**：在左侧边栏中，配方卡片改为**纵向排列**（`flex-col`），无需横向滚动。

```javascript
// src/ui/hud.js 中调整挂载逻辑
ui_updateGatheringQueueUI() {
    const isPC = this._pcMode && this._pcShowLeft;
    const queueTarget = isPC
        ? document.getElementById('pc-left-queue-mount')
        : document.getElementById('gathering-queue');
    const recipeTarget = isPC
        ? document.getElementById('pc-left-recipe-mount')
        : document.getElementById('gathering-hud-mount');
    
    // 动态迁移 DOM 节点（若挂载点变化）
    const queueEl = document.getElementById('gathering-queue');
    const recipeEl = document.getElementById('gathering-hud-mount');
    if (queueTarget && queueEl.parentElement !== queueTarget) {
        queueTarget.appendChild(queueEl);
    }
    if (recipeTarget && recipeEl.parentElement !== recipeTarget) {
        recipeTarget.appendChild(recipeEl);
        // PC 端改为纵向布局
        recipeEl.style.flexDirection = isPC ? 'column' : 'row';
        recipeEl.style.overflowX = isPC ? 'hidden' : 'auto';
        recipeEl.style.overflowY = isPC ? 'auto' : 'hidden';
    }
    // ... 原有渲染逻辑 ...
},
```

### 3.5 右侧边栏：符文发射器常驻化

**原始位置**：`#phase-rune-launcher`，`position: absolute`，全屏覆盖层，通过按鈕呼出/关闭。

**PC 端适配**：
- 右侧边栏常驻展示符文发射器内容，不需要呼出/关闭。
- 移动端的「⚡ 符文发射器」按鈕在 PC 模式下隐藏。
- 符文发射器的内容区（`#rune-launcher-content` 和 `#rune-codex-panel`）通过 DOM 迁移到 `#pc-right-rune-mount`。

```javascript
// src/ui/rune_launcher.js 修改 open/close 逻辑
ui_openRuneLauncher() {
    if (this._pcMode && this._pcShowRight) {
        // PC 端：右侧边栏已常驻，仅刷新内容
        this.ui_updateRuneGrid();
        this._ui_updateRuneInventoryDisplay();
        return;
    }
    // 移动端：原有覆盖层弹出逻辑
    const panel = document.getElementById('phase-rune-launcher');
    if (panel) panel.style.display = 'flex';
    this.launcherVisible = true;
    // ...
},

ui_closeRuneLauncher() {
    if (this._pcMode && this._pcShowRight) {
        // PC 端：右侧边栏不关闭
        return;
    }
    // 移动端：原有关闭逻辑
    const panel = document.getElementById('phase-rune-launcher');
    if (panel) panel.style.display = 'none';
    this.launcherVisible = false;
    // ...
},
```

---

## 4. 坐标系修正

由于 `#game-container` 不再是全屏宽度，而是居中的固定宽度容器，鼠标/触摸坐标的计算需要验证。

当前 `game_system.js` 中的坐标获取逻辑：
```javascript
const getPos = (e) => {
    const rect = this.canvas.getBoundingClientRect();
    // ...
};
```

`canvas.getBoundingClientRect()` 返回的是 Canvas 相对于视口的绝对位置，因此 `e.clientX - rect.left` 已经正确处理了 Canvas 偏移。**此处无需修改**，但需要在实施后进行回归测试。

---

## 5. 实施路线图

| 步骤 | 任务描述 | 涉及文件 | 预估改动规模 |
|---|---|---|---|
| **Step 1** | HTML 结构改造：增加 `#app-wrapper`、左右侧边栏占位符 | `index.html` | 中型（~50行） |
| **Step 2** | CSS 改造：`#game-container` 固定宽高比，侧边栏基础样式 | `index.html` (style块) | 中型（~40行） |
| **Step 3** | JS 核心：`sys_resize` 去除硬编码宽度，新增 `ui_updatePCLayout` | `game_system.js`、`ui_system.js` | 中型（~60行） |
| **Step 4** | 左侧边栏：HUD 挂载点动态切换，配方卡片纵向布局 | `ui/hud.js` | 中型（~40行） |
| **Step 5** | 右侧边栏：符文发射器内容迁移，open/close 逻辑适配 | `ui/rune_launcher.js` | 中型（~50行） |
| **Step 6** | 移动端按鈕隐藏：PC 模式下隐藏「⚡」浮动按鈕 | `index.html` | 微型（~5行） |
| **Step 7** | 全面回归测试：坐标系、特效、存档、各阶段 UI | 全部 | 测试 |

---

## 6. 风险与注意事项

### 6.1 `sys_resize` 中的硬编码覆盖

当前 `sys_resize` 中有：
```javascript
container.style.height = `${window.innerHeight}px`;
container.style.width = `${window.innerWidth}px`;
```
这两行会**强制覆盖** CSS 的 `max-width` 限制，必须在 Step 3 中移除或修改为：
```javascript
container.style.height = `${window.innerHeight}px`;
// 宽度由 CSS 的 max-width 和 min-width 自动计算，无需 JS 干预
// container.style.width = `${window.innerWidth}px`;  ← 删除此行
```

### 6.2 `defeatLineY` 和 `combatGridTopY` 的计算

这两个值依赖 `this.height`（Canvas 高度），在固定宽高方案下，`this.height` 仍然等于视口高度，因此**无需修改**。

### 6.3 屏幕震动特效 (`ui_triggerScreenShake`)

当前震动特效通过 CSS `transform: translate` 作用于 `#game-container`。在新布局中，`#game-container` 是居中的子元素，震动不会影响侧边栏，**行为正确，无需修改**。

### 6.4 全屏覆盖层的 z-index

`#phase-rune-launcher`（z-index: 300）、`#phase-truth-book`（z-index: 300）等全屏覆盖层在移动端仍需覆盖整个 `#game-container`。由于它们是 `#game-container` 的子元素（`position: absolute`），其覆盖范围已被限制在游戏容器内，**行为正确**。

### 6.5 `.bottom-panel` 在 PC 模式下的残留空间

当 `.bottom-panel` 在 PC 模式下隐藏后，`defeatLineY = this.height - 120` 的计算仍然有效（因为 Canvas 高度未变）。但视觉上底部 120px 区域将变为空白的 Canvas 背景，可以考虑在 PC 模式下将 `defeatLineY` 调整为 `this.height - 20`（因为底部面板不再占用空间）。这属于 Step 3 的可选优化项。

---

## 7. 文档同步要求

本次改造完成后，需同步更新以下规范文档：
- `.cursor/rules/ui_system.md`：新增 PC 响应式布局章节，记录 `_pcMode`、`_pcShowLeft`、`_pcShowRight` 状态字段。
- `.cursor/rules/global.md`：在架构概述中补充「PC 双侧边栏布局」说明。
