# 新手教程系统规范 (tutorial_system.md)

## 1. 模块概述
`tutorial_system.js` 负责管理《回声炼金师》的新手引导流程。它通过「全屏遮罩 + 元素高亮 + 步骤卡片」的方式，引导首次进入游戏的玩家了解核心玩法。

## 2. 核心架构与设计原则
- **独立子系统**：遵循全局规范的组合模式，通过 `bind(this)` 注入到 `Game` 实例。
- **无侵入性**：教程逻辑完全独立，不修改任何现有业务代码的执行流程。
- **事件驱动同步**：通过监听 `EventBus` 的阶段切换（`PHASE_CHANGED`）等事件，实现跨阶段的自动步骤推进。
- **动态 DOM 生成**：教程所需的遮罩层、高亮框和提示卡片均在运行时动态创建，不污染原始的 `index.html` 结构。

## 3. 状态管理
- **全局状态**：`saveData.tutorialCompleted`（布尔值）。用于记录教程是否已完成。
  - 在 `sys_loadSaveData` 中做了向下兼容：若该字段不存在（老存档），默认设为 `true` 以避免打扰老玩家。
- **内部状态**：
  - `_tutorialActive`：当前是否处于教程进行中。
  - `_tutorialStepIndex`：当前进行的步骤索引。
  - `_tutorialUnsubscribers`：保存当前步骤注册的 `EventBus` 监听器清理函数。

## 4. 教程步骤配置 (TUTORIAL_STEPS)
所有教程步骤通过常量数组 `TUTORIAL_STEPS` 静态配置，每个步骤对象包含以下属性：
- `id` (string): 步骤唯一标识。
- `phase` (string|null): 触发该步骤所需的游戏阶段。
- `targetId` (string|null): 需要高亮的 DOM 元素 ID（为 `null` 时显示全屏半透明遮罩）。
- `highlightSelector` (string|null): 优先使用的高亮元素 CSS 选择器。
- `title` (string): 卡片标题。
- `content` (string): 卡片内容（支持 HTML 标签）。
- `position` (string): 卡片相对高亮元素的位置（`top`, `bottom`, `center`）。
- `waitForEvent` (string|null): 如果设置了事件名（如 `EVENT_TYPES.PHASE_CHANGED`），将隐藏「下一步」按钮，等待该事件触发。
- `waitForEventFilter` (Function|null): 过滤事件数据，返回 `true` 时才算满足条件。
- `autoAdvance` (boolean): 事件触发后是否自动进入下一步。

## 5. 对外接口 (API)
- `tutorial_checkAndStart()`：在游戏初始化（`sys_loadSaveData` 后）调用，检查是否需要启动教程。
- `tutorial_start()`：启动教程（从第一步开始）。**仅供游戏初始化时自动调用**，不应直接由 UI 按钮调用。
- `tutorial_restartFromHome()`：**主页「重新开始教程」按钮的专属入口**。先重置 `tutorialCompleted` 标志并切换到 `meta` 阶段，再延迟启动教程，确保整个流程从主页正确开始。
- `tutorial_end(markCompleted)`：结束教程，清理 DOM 和事件监听。
- `tutorial_nextStep()`：前进到下一步。
- `tutorial_skipAll()`：跳过教程并标记为已完成。

## 6. 注意事项与修改规范
- **重开教程入口唯一性**：重开教程的入口**仅在主页（`#phase-meta`）**提供，即主页底部的「重新开始教程」按钮。不在暂停菜单、设置面板或其他局内界面提供此入口，避免在局内状态下重开教程导致流程断裂。
- **主页按钮调用规范**：主页按钮应调用 `tutorial_restartFromHome()`，而非直接调用 `tutorial_start()`。
- **修改步骤文本**：直接修改 `tutorial_system.js` 顶部的 `TUTORIAL_STEPS` 数组即可，无需改动底层逻辑。
- **新增高亮目标**：确保目标元素在对应阶段是可见的（`display !== 'none'` 且 `opacity > 0`），否则高亮框可能定位失败。
- **清理监听器**：步骤切换或教程结束时，必须调用 `_tutorial_cleanupListeners()`，防止内存泄漏或多次触发。
