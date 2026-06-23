# Task 3.2 结果摘要：game_phase.js UI 彻底解耦

## 任务目标

将 `game_phase.js` 中所有直接 DOM 操作和 UI 方法调用，重构为通过 EventBus 派发事件，由 `ui_system.js` 监听处理。

## 完成情况

### 1. event_bus.js — 新增 10 个 UI 解耦事件常量

| 事件常量 | 字符串值 | 替代的旧调用 |
|---|---|---|
| `UI_UPDATE_REQUEST` | `ui:update_request` | `this.ui_updateUI()` |
| `UI_CACHE_UPDATE_REQUEST` | `ui:cache_update_request` | `this.ui_updateUICache()` |
| `UI_PHASE_CHANGE` | `ui:phase_change` | `this.ui_onPhaseChange(phase)` |
| `UI_GATHERING_QUEUE_UPDATE` | `ui:gathering_queue_update` | `this.ui_updateGatheringQueueUI()` |
| `UI_RECIPE_HUD_RENDER` | `ui:recipe_hud_render` | `this.ui_renderRecipeHUD()` |
| `UI_AMMO_UPDATE` | `ui:ammo_update` | `this.ui_updateAmmoUI()` |
| `UI_SHOW_RELIC_SELECTION` | `ui:show_relic_selection` | `this.ui_showRelicSelection()` |
| `UI_META_CURRENCY_UPDATE` | `ui:meta_currency_update` | `this.ui_updateMetaCurrency()` |
| `UI_CONTAINER_TRANSFORM_RESET` | `ui:container_transform_reset` | `document.getElementById('game-container')` 重置 |
| `UI_BOARD_TILT_UPDATE` | `ui:board_tilt_update` | `document.getElementById('game-container')` 倾斜 |

（另复用已有的 `UI_COMBAT_MESSAGE` 和 `UI_ROUND_NUM_UPDATE` 事件）

### 2. game_phase.js — 消除所有直接 DOM 操作和 UI 方法调用

**DOM 操作（8 处全部消除）：**
- 第 55 行：`game-container` 重置 → `UI_CONTAINER_TRANSFORM_RESET`
- 第 484-488 行：`combat-message` ENEMY TURN → `UI_COMBAT_MESSAGE`
- 第 595 行：`round-num` 更新（移除冗余 DOM 操作，保留事件）
- 第 605 行：`combat-message` 清空 → `UI_COMBAT_MESSAGE`
- 第 747-752 行：`game-container` 战斗阶段倾斜 → `UI_BOARD_TILT_UPDATE`
- 第 1133-1135 行：`combat-message` 防線失守 → `UI_COMBAT_MESSAGE`
- 第 1209-1214 行：`combat-message` 彈藥耗盡/清空 → `UI_COMBAT_MESSAGE`
- 第 1354-1360 行：`game-container` 研磨阶段倾斜 → `UI_BOARD_TILT_UPDATE`

**UI 方法调用（约 14 处全部消除）：**
- `this.ui_updateUI()` → `UI_UPDATE_REQUEST`（2 处）
- `this.ui_onPhaseChange()` → `UI_PHASE_CHANGE`（1 处）
- `this.ui_updateUICache()` → `UI_CACHE_UPDATE_REQUEST`（1 处）
- `this.ui_updateGatheringQueueUI()` → `UI_GATHERING_QUEUE_UPDATE`（4 处）
- `this.ui_renderRecipeHUD()` → `UI_RECIPE_HUD_RENDER`（6 处）
- `this.ui_showRelicSelection()` → `UI_SHOW_RELIC_SELECTION`（2 处）
- `this.ui_updateMetaCurrency()` → `UI_META_CURRENCY_UPDATE`（1 处）
- `this.ui_updateAmmoUI()` → `UI_AMMO_UPDATE`（1 处）

### 3. ui_system.js — 新增 12 个事件监听器

在 `ui_initEventListeners()` 中新增：
- `UI_CONTAINER_TRANSFORM_RESET` → 重置 game-container 样式
- `UI_BOARD_TILT_UPDATE` → 应用 3D 倾斜变换
- `UI_UPDATE_REQUEST` → 调用 `this.ui_updateUI()`
- `UI_PHASE_CHANGE` → 调用 `this.ui_onPhaseChange(phase)`
- `UI_CACHE_UPDATE_REQUEST` → 调用 `this.ui_updateUICache()`
- `UI_GATHERING_QUEUE_UPDATE` → 调用 `this.ui_updateGatheringQueueUI()`
- `UI_RECIPE_HUD_RENDER` → 调用 `this.ui_renderRecipeHUD()`
- `UI_AMMO_UPDATE` → 调用 `this.ui_updateAmmoUI()`
- `UI_SHOW_RELIC_SELECTION` → 调用 `this.ui_showRelicSelection()`
- `UI_META_CURRENCY_UPDATE` → 调用 `this.ui_updateMetaCurrency()`
- `UI_COMBAT_MESSAGE` → 更新 `combat-message` DOM（支持 addClasses/removeClasses）
- `UI_ROUND_NUM_UPDATE` → 更新 `round-num` DOM

### 4. 文档更新

- `events.md`：在 2.3 UI 类事件表格中补充 12 个新事件的完整描述
- `game_phase.md`：更新第 3 节，明确 UI 解耦规范（严禁直接 DOM 操作和 UI 方法调用）

## Git 提交

- 分支：`task/3.2-game-phase-ui-decouple`
- Commit：`9c6e35e` — `refactor(Task 3.2): game_phase.js UI 彻底解耦 — 消除直接 DOM 操作与 UI 方法调用`
- 修改文件：5 files changed, 198 insertions(+), 73 deletions(-)
