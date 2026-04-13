# 遗物系统与新手体验优化设计方案

## 1. 问题背景
目前玩家初始状态伤害过低，容易导致新手体验差。虽然游戏已经实现了根据玩家伤害动态计算敌人血量的机制（`spawn_system.js` 中 `spawn_spawnEnemyRowAt`），但仅靠降低敌人血量无法带给玩家足够的爽快感和成长正反馈。我们需要主动推送强力遗物供其选择，并对遗物的给予时机、推荐展示进行优化。

## 2. 优化目标
1. **调整遗物给予时机**：初始回合给予一次，然后从第 3 回合起每 5 回合给予一次。
2. **强力遗物推荐系统**：在遗物池中主动推荐强力遗物，打上核心关键词标签，并显示推荐 Tip。仅前三次遗物选择进行推荐。
3. **视觉增强**：选择遗物时，加强稀有遗物卡片的视觉效果。

## 3. 详细设计与修改点

### 3.1 遗物给予时机调整
- **涉及文件**：`src/game_phase.js`, `src/core.js`
- **修改逻辑**：
  - `sys_initGameStart` 已经包含了初始遗物选择 `this.ui_showRelicSelection()`，无需修改初始回合触发。
  - `game_phase.js` 中的 `phase_finalizeRound` 包含回合结束时的遗物触发逻辑。原逻辑为 `if (this.round % CONFIG.gameplay.relicRoundInterval == 0)`。
  - **新逻辑**：改为 `if (this.round >= 3 && (this.round - 3) % 5 === 0)`。这意味着在第 3, 8, 13, 18... 回合触发。

### 3.2 强力遗物推荐系统
- **涉及文件**：`src/ui/shop.js`, `src/config.js`, `src/core.js`, `index.html`
- **修改逻辑**：
  - **推荐计数**：在 `core.js` 的 `sys_resetGame` 中增加 `this.relicSelectionCount = 0;`。
  - **强力遗物定义**：在 `config.js` 的 `RELIC_DB` 中，为适合新手的强力遗物（如解锁强力属性、增加弹珠数量、增加特殊槽位等）添加 `recommended: true` 和 `tags: ['核心', '新手推荐']` 等字段。
  - **抽取逻辑**：在 `shop.js` 的 `ui_showRelicSelection` 中：
    - 如果 `this.relicSelectionCount < 3`，则在抽取时增加强力遗物的权重，或者强制保证至少出现 1 个 `recommended` 遗物。
    - 记录本次选择是第几次（`this.relicSelectionCount++`，在 `ui_selectRelic` 或 `ui_skipRelic` 时增加，或者在打开时增加）。
  - **UI 渲染**：
    - 如果该遗物被推荐且 `relicSelectionCount <= 3`（这里注意打开时的计数），在卡片 HTML 中添加推荐标签（Tag）和 Tip 提示。
    - 在 `index.html` 中添加对应的 CSS 样式（如 `.relic-tag`, `.relic-tip`）。

### 3.3 稀有遗物视觉增强
- **涉及文件**：`index.html`
- **修改逻辑**：
  - 修改 `.relic-card.rare`, `.relic-card.legendary` 的 CSS 样式。
  - 增加发光动画（如 `box-shadow` 动画，`@keyframes pulse-glow`）。
  - 增加边框高亮和更强的悬浮效果。

## 4. 实施步骤
1. **Phase 4**: 修改 `src/game_phase.js` 中的回合判断逻辑。
2. **Phase 5**: 修改 `src/config.js` 标记强力遗物；修改 `src/core.js` 添加计数器；修改 `src/ui/shop.js` 实现推荐逻辑和 UI 渲染。
3. **Phase 6**: 修改 `index.html` 添加标签、Tip 和稀有遗物的动画样式。
4. **Phase 7**: 提交代码并更新规范文档。
