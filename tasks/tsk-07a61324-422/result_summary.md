# tsk-07a61324-422 交付摘要

## 任务概述

本次任务聚焦“命运时刻与纯净精华 UI/数据”。本轮实现覆盖了命运时刻文案、混沌精华复用旧命运轮盘逻辑、纯净精华单弹珠符文注入、属性合法性校验、双倍同化率字段与提示 UI，以及遗物 overlay 关闭后的正确返回流。

## 代码修改范围

| 文件 | 关键改动 |
|---|---|
| `src/config.js` | 新增 `assimilationDoubleMultiplier`；将旧 `fortune_wheel_relic` 文案改为“混沌精华”；新增 `pure_essence` 遗物；将涌潮描述改为“同化率 x2”。 |
| `src/core.js` | 新增 `doubleAssimilationBoostRounds`、`pendingSelectionMode`、`selectionMode`、`selectionRequiredCount`、`selectionInjectedRune`、`selectionPreviewState`、`relicOverlayReturnState` 等运行态字段。 |
| `src/game_system.js` | 在重置、选择阶段初始化、选择切换、存档/读档中接入纯净精华模式与双倍同化率字段。 |
| `src/ui_system.js` | 新增动态选择数量、确认可用性、纯净精华合法属性/符文过滤、注入 UI 渲染、确认注入写回与符文消耗逻辑。 |
| `src/spawn_system.js` | 让弹珠预览绑定当前选择索引，并在预览中挂载纯净精华注入面板与双倍同化率提示。 |
| `src/game_phase.js` | 发射前将 `MarbleDefinition.collected` 注入 `currentSession.collected`；统一递减双倍同化率回合；遗物事件提示统一为“命运时刻”。 |
| `src/entities.js` | 普通钉子同化判定改读 `doubleAssimilationBoostRounds * assimilationDoubleMultiplier`。 |
| `src/ui/shop.js` | 纯净精华遗物接入 `pendingSelectionMode`；同化涌潮接入 `doubleAssimilationBoostRounds`；关闭遗物 overlay 时按 `relicOverlayReturnState` 返回原阶段。 |
| `index.html` | 选择阶段底栏改为动态模式标题、动态数量和纯净精华副标题结构。 |

## 文档同步范围

| 文件 | 更新内容 |
|---|---|
| `.cursor/rules/game_phase.md` | 记录纯净精华单弹珠模式、命运时刻命名与 overlay 返回约束。 |
| `.cursor/rules/ui_system.md` | 记录动态选择数量、纯净精华 UI、合法性校验与关闭恢复流。 |
| `.cursor/rules/entities.md` | 记录混沌精华继续复用 `FortuneWheel`、双倍同化率显式字段、注入结果写回 `MarbleDefinition.collected`。 |
| `.cursor/rules/process_insights/index.md` | 注册新增流程洞察 PI-006。 |
| `.cursor/rules/process_insights/PI-006_destiny_overlay_return_and_selection_mode.md` | 新增命运时刻 overlay 返回流与纯净精华选择模式的防坑总结。 |

## 验证

已执行以下语法检查命令并通过：

```bash
node --check src/ui_system.js && \
node --check src/spawn_system.js && \
node --check src/game_system.js && \
node --check src/game_phase.js && \
node --check src/entities.js && \
node --check src/ui/shop.js && \
node --check src/config.js
```

## 风险与后续建议

当前完成的是代码与活文档层接入，尚未进行浏览器内完整手测。建议协调者重点验证以下场景：

1. 在命运时刻拿到“纯净精华”后，下一次选择阶段是否正确显示 `1 / 1`，且未注入符文前确认按钮保持禁用。
2. 对已有单属性/多属性弹珠分别注入合法与不合法符文时，UI 是否正确筛选并阻止非法注入。
3. 在选择阶段或命运时刻关闭 overlay 后，是否仍停留在当前 selection 上下文，而不是被重置为旧的普通三选流程。
4. 获取各类“涌潮”后，预览面板中的同化率 x2 提示与实际同化表现是否一致。
