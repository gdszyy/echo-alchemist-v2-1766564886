# tsk-09240493-d43 交付摘要

## 结论

本轮先对近期提交、当前主仓代码与前序任务 `tsk-07a61324-422` 的交付物做了对比，结论是：**此前已有同类 Agent 执行过相同任务，但其改动并未真正落入当前主仓**。因此本轮选择**基于当前主仓增量开发**，而不是回滚后重做。原因在于当前主仓已经包含后续的 round-start resolver、回合开始奖励与选择流程重构；若直接回滚，会破坏这些较新的有效主线变更。

## 已完成的代码落地

| 模块 | 已落地内容 |
|------|------------|
| `src/config.js` | 将旧 `fortune_wheel_relic` 语义迁移为 `chaos_essence`，新增 `pure_essence` 遗物，新增 `CONFIG.gameplay.assimilationDoubleMultiplier = 2`，并把同化涌潮文案改为显式 `x2`。 |
| `src/core.js` | 补齐 `pendingSelectionMode`、`selectionMode`、`selectionRequiredCount`、`selectionInjectedRune`、`selectionPreviewState`、`relicOverlayReturnState`、`doubleAssimilationBoostRounds` 等运行态。 |
| `src/game_system.js` | 在初始化/重置/存档/恢复中同步维护上述运行态；`sys_initSelectionPhase()` 改为消费 `pendingSelectionMode`；`sys_toggleMarbleSelection()` 支持纯净精华的单选模式。 |
| `src/ui_system.js` | 新增纯净精华相关辅助函数：合法属性计算、合法符文过滤、注入选择、注入面板渲染、底栏刷新；`ui_confirmSelection()` 在纯净精华模式下会校验合法性、写回 `MarbleDefinition.collected`、扣除符文库存。 |
| `src/spawn_system.js` | `spawn_showMarblePreview()` 新增 `selectionPreviewState` 更新，并在预览面板中联动渲染纯净精华注入 UI。 |
| `src/ui/shop.js` | `assimilation_surge` 改为同时写入 `assimilationBoostRounds` 和 `doubleAssimilationBoostRounds`；新增 `pure_essence` 效果写入 `pendingSelectionMode`；`ui_closeRelicSelection()` 改为按 `relicOverlayReturnState` / `round_start_resolver` 正确恢复。 |
| `src/entities.js` | 普通钉子同化判定改为读取显式倍率：只要旧字段或新字段任一有效，就按 `baseChance * assimilationDoubleMultiplier` 处理，移除对匿名 `+0.195` 逻辑的依赖。 |
| `src/game_phase.js` | 回合结束时同步递减 `doubleAssimilationBoostRounds`，保持与旧字段兼容。 |
| `index.html` | 为命运抉择底栏补充 `selection-mode-label`、`selected-required-count`、`selection-mode-subtitle` 三个动态节点。 |

## 已完成的文档与洞察同步

| 文档 | 更新内容 |
|------|----------|
| `.cursor/rules/config.md` | 记录混沌精华 / 纯净精华 / 显式双倍同化率倍率的数据契约。 |
| `.cursor/rules/ui_system.md` | 记录命运抉择底栏动态节点、纯净精华辅助函数与 overlay 返回恢复约束。 |
| `.cursor/rules/entities.md` | 记录 `MarbleDefinition.collected` 的标准写回约束与显式双倍同化率判定。 |
| `.cursor/rules/game_phase.md` | 记录纯净精华单选模式、overlay 恢复分支、选择态存档与双倍同化率衰减。 |
| `.cursor/rules/process_insights/PI-007_destiny_overlay_return_and_selection_mode.md` | 新增本次专题流程洞察，沉淀 overlay 返回、动态选择数量、注入写回与显式倍率四个核心防坑点。 |
| `.cursor/rules/process_insights/index.md` | 注册 PI-007 并更新模块索引。 |

## 验证

已对以下核心源码执行语法检查并通过：

- `src/ui_system.js`
- `src/game_system.js`
- `src/ui/shop.js`
- `src/spawn_system.js`
- `src/entities.js`
- `src/game_phase.js`

## 交付文件清单

- `src/config.js`
- `src/core.js`
- `src/game_system.js`
- `src/ui_system.js`
- `src/spawn_system.js`
- `src/ui/shop.js`
- `src/entities.js`
- `src/game_phase.js`
- `index.html`
- `.cursor/rules/config.md`
- `.cursor/rules/ui_system.md`
- `.cursor/rules/entities.md`
- `.cursor/rules/game_phase.md`
- `.cursor/rules/process_insights/index.md`
- `.cursor/rules/process_insights/PI-007_destiny_overlay_return_and_selection_mode.md`
