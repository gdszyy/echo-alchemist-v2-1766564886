# 新手教程系统规范 (tutorial_system.md)

## 1. 模块概述
`tutorial_system.js` 负责管理《回声炼金师》的新手引导流程。它通过「全屏遮罩 + 元素高亮 + 步骤卡片」的方式，引导首次进入游戏的玩家了解核心玩法。

## 2. 核心架构与设计原则
- **独立子系统**：遵循全局规范的组合模式，通过 `bind(this)` 注入到 `Game` 实例。
- **无侵入性**：教程逻辑完全独立，不修改任何现有业务代码的执行流程。
- **事件驱动同步**：通过监听 `EventBus` 的阶段切换（`PHASE_CHANGED`）等事件，实现跨阶段的自动步骤推进。
- **真实首局链路**：当前首局 resolver 固定为“遗物 overlay → `marble_pack` → `gathering` → `combat`”；遗物 overlay 不会把 `game.phase` 切成 `relic`，`marble_pack` 也不会进入普通 `selection`。
- **无漏事件延迟**：等待事件命中后同步切换到下一教程步骤，使下一步监听在后续 phase 事件发生前就位；禁止重新引入固定 600ms 步骤延迟。
- **动态 DOM 生成**：教程所需的遮罩层、高亮框和提示卡片均在运行时动态创建，不污染原始的 `index.html` 结构。

## 3. 状态管理
- **全局状态**：`saveData.tutorialCompleted`（布尔值）。用于记录教程是否已完成。
  - 在 `sys_loadSaveData` 中做了向下兼容：若该字段不存在（老存档），默认设为 `true` 以避免打扰老玩家。
- **内部状态**：
  - `_tutorialActive`：当前是否处于教程进行中。
  - `_tutorialStepIndex`：当前进行的步骤索引。
  - `_tutorialUnsubscribers`：保存当前步骤注册的 `EventBus` 监听器清理函数。
  - `_tutorialStartCancel` / `_tutorialPendingStartUnsubscribe`：下一绘制启动句柄与 pending phase 监听；重排启动、跳过、结束或离开 `meta` 时必须成对取消。
  - `_tutorialStartEpoch` / `_tutorialStepEpoch`：隔离旧启动调度与旧步骤监听，防止重开后的旧回调推进新会话。

`tutorialCompleted = true` 只能由 `tutorial_complete()` 写入；`tutorial_end()` 只负责清理。跳过与正常完成都调用同一个幂等完成入口，重复调用不得重复保存。

## 4. 教程步骤配置 (TUTORIAL_STEPS)
所有教程步骤通过常量数组 `TUTORIAL_STEPS` 静态配置，每个步骤对象包含以下属性：
- `id` (string): 步骤唯一标识。
- `phase` (string|null): 触发该步骤所需的游戏阶段。
- `targetId` (string|null): 需要高亮的 DOM 元素 ID（为 `null` 时显示全屏半透明遮罩）。
- `highlightSelector` (string|null): 优先使用的高亮元素 CSS 选择器。
- `title` (string): 卡片标题。
- `content` (string|Function): 卡片内容（支持 HTML 标签），或接收 `{ coarsePointer }` 后返回 HTML 的函数。
- `position` (string): 卡片相对高亮元素的位置（`top`, `bottom`, `center`），或无高亮操作步骤使用的 `bottom-fixed`。
- `waitForEvent` (string|null): 如果设置了事件名（如 `EVENT_TYPES.PHASE_CHANGED`），将隐藏「下一步」按钮，等待该事件触发。
- `waitForEventFilter` (Function|null): 过滤事件数据，返回 `true` 时才算满足条件。
- `autoAdvance` (boolean): 事件触发后是否自动进入下一步。

当前有效步骤顺序只有六步：

1. `welcome`
2. `start_run`（卡片按高亮按钮上方定位，等待 `tutorial:relic_shown`）
3. `relic_selection`（等待 `PHASE_CHANGED -> gathering`）
4. `gathering_intro`（等待 `PHASE_CHANGED -> combat`）
5. `combat_intro`（等待 `UI_AMMO_FIRED`）
6. `tutorial_complete`

不得恢复已失效的 `marble_selection` / `confirm_selection` 步骤；首局 `marble_pack` 已自动生成三枚弹珠并直接进入研磨。

## 5. 对外接口 (API)
- `tutorial_checkAndStart()`：在游戏初始化（`sys_loadSaveData` 后）调用，检查是否需要启动教程。
- `tutorial_start()`：启动教程（从第一步开始）。**仅供可取消的初始化调度调用**，不应直接由 UI 按钮调用；非 `meta` 或已完成状态必须拒绝启动。
- `tutorial_restartFromHome()`：**主页「重新开始教程」按钮的专属入口**。先清理当前会话、重置 `tutorialCompleted`、切换到 `meta`，再在下一次绘制启动；重复点击只保留最后一次调度。
- `tutorial_end()`：只结束会话并清理 pending 启动、步骤监听与 DOM，不写完成状态。
- `tutorial_complete()`：正常完成和跳过共用的唯一幂等持久化入口。
- `tutorial_nextStep()`：前进到下一步。
- `tutorial_skipAll()`：通过 `tutorial_complete()` 跳过教程并标记为已完成。

## 6. 注意事项与修改规范
- **重开教程入口唯一性**：重开教程的入口**仅在主页（`#phase-meta`）**提供，即主页底部的「重新开始教程」按钮。不在暂停菜单、设置面板或其他局内界面提供此入口，避免在局内状态下重开教程导致流程断裂。
- **主页按钮调用规范**：主页按钮应调用 `tutorial_restartFromHome()`，而非直接调用 `tutorial_start()`。
- **开始按钮不得被遮挡**：`start_run` 必须相对高亮按钮放在上方并保留点击间隙；不得使用会在 720px 高度覆盖按钮中心的底部固定卡片。
- **启动竞态**：禁止使用未持有句柄的固定 800ms/400ms `setTimeout`。初始化与重开均由 `_tutorial_scheduleStart()` 安排到下一次绘制，并由 `_tutorial_cancelPendingStart()` 统一取消。
- **设备文案**：遗物卡在桌面是单击确认；`(pointer: coarse)` 设备是首次轻触预览、再次轻触确认。步骤内容允许使用函数按设备生成 HTML，不得用同一条“两次点击”文案覆盖桌面。
- **采集区域**：`game_phase.js` 的真实 gathering 输入阈值为画布高度的 85%；`tutorial-launch-guide` 与文案必须同为 85%，不得回退到旧 40%。
- **修改步骤文本**：修改 `tutorial_system.js` 顶部的 `TUTORIAL_STEPS` 数组；动态内容由 `_tutorial_resolveContent()` 解析。
- **新增高亮目标**：确保目标元素在对应阶段是可见的（`display !== 'none'` 且 `opacity > 0`），否则高亮框可能定位失败。
- **清理监听器**：步骤切换或教程结束时，必须调用 `_tutorial_cleanupListeners()`，防止内存泄漏或多次触发。
- **旧存档兼容**：已有存档缺少 `tutorialCompleted` 时，`sys_loadSaveData()` 会补为 `true`；全新无存档实例保持未完成并启动教程。教程模块不得自行把旧存档回退成未完成。

## 7. 验证

修改教程子系统后至少运行：

```bash
node --check src/tutorial_system.js
node tests/validate_tutorial_flow.mjs
node tests/validate_phase_contracts.mjs
```

专项 T1 必须覆盖启动取消、phase 失效、重复重开、跳过、真实步骤序列、监听幂等清理、设备文案、85% 采集区与单一完成写入。浏览器验收必须分别用桌面与 390×844 的全新 localStorage 完成到首次战斗发射，并点击最终完成按钮确认持久化。
