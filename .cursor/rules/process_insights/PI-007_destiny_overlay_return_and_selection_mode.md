---
id: "PI-007"
version: "v1.4"
last_updated: "2026-07-18"
author: "agt-50c9e9de-077"
related_modules: ["ui/shop.js", "game_system.js", "ui_system.js", "spawn_system.js", "game_phase.js", "entities.js", "config.js", "core.js"]
status: "active"
---

# PI-007: 命运时刻 Overlay 返回流与纯净精华选择模式

## 流程概述

命运时刻相关改动横跨遗物 overlay、选择阶段运行态、预览 UI、实体注入链路与同化倍率结算。最容易出错的地方不是单个函数，而是“overlay 从哪里打开、关闭后应回到哪里”“当前选择阶段需要几枚弹珠”“纯净精华的注入结果何时真正进入实体数据”“同化率 x2 是否真的落到统一配置倍率”这四个耦合点。当前主动开局/局内商店研磨入口是 `marble_pack`；`chaos_essence` / `pure_essence` 只保留历史存档兼容与明确触发路径，不能反向污染主循环。

## 核心防坑指南

### 坑 1: 关闭遗物 / 命运 overlay 时默认重建 selection 流程

**现象**：玩家在选择阶段中途打开遗物 overlay，关闭后界面被强制重置到旧的 `sys_initSelectionPhase()`，导致纯净精华等特殊选择态丢失。

**根因**：旧实现只区分 `gathering` 与“其他”两类来源，把所有非 gathering 来源都视为“重新开始命运抉择”。

**正确做法**：打开 overlay 时记录 `relicOverlayReturnState`，关闭时严格按来源恢复：
1. 来源为 `gathering`：调用 `phase_gathering_attemptComplete()` 继续收尾；
2. 来源为 `selection`：调用 `phase_switchPhase('selection')`，随后执行 `ui_updateUI()` 与 `ui_refreshSelectionModeUI()` 恢复当前特殊选择态；
3. 来源为 `round_start_resolver`：调用 `sys_continueRoundStartResolver()` 继续结算剩余奖励；
4. 只有在没有来源信息时，才允许回落到 `sys_initSelectionPhase()` 作为兜底。

**关键位置**：`src/ui/shop.js` → `ui_showRelicSelection()` / `ui_closeRelicSelection()`

### 坑 2: 选择数量写死为 3，导致纯净精华模式 UI 和确认逻辑失真

**现象**：底栏仍显示 `0 / 3`，按钮启用条件也固定为 3 枚弹珠；玩家即使在纯净精华模式下选中 1 枚弹珠并完成注入，也无法确认。

**根因**：选择阶段的数量要求被分散硬编码在 `index.html`、`sys_toggleMarbleSelection()`、`ui_confirmSelection()` 等位置。

**正确做法**：集中引入 `selectionMode` 与 `selectionRequiredCount` 两个运行态字段，并统一通过 `ui_getSelectionRequirement()` / `ui_isSelectionConfirmReady()` 读取；任何新增 UI 或交互都不得再写死 `3`。

**关键位置**：`src/game_system.js` → `sys_initSelectionPhase()` / `sys_toggleMarbleSelection()`；`src/ui_system.js` → `ui_getSelectionRequirement()` / `ui_refreshSelectionModeUI()`；`index.html` → 选择阶段底栏结构

### 坑 3: 纯净精华注入只停留在 UI 层，没有进入实体会话

**现象**：预览面板里看起来已经注入了符文，但进入研磨阶段后弹珠并没有继承新增属性，或只有当前预览面板短暂生效。

**根因**：把注入结果停留在临时 UI 状态，没有写回 `MarbleDefinition.collected` 这一条被后续系统共同消费的标准数据链路。

**正确做法**：确认选择时先执行合法性校验，再把注入结果写入 `marble.collected`；随后由发射前的标准实体会话初始化逻辑继续消费 `marbleDef.collected`。这样实体层只读取标准结构，不依赖纯净精华 UI 自身。

**关键位置**：`src/ui_system.js` → `ui_confirmSelection()`；`src/entities.js` → `MarbleDefinition`；`src/game_phase.js` → 发射前 `currentSession` 初始化流程

### 坑 4: 同化率 x2 继续依赖匿名概率常数

**现象**：界面显示“同化率 x2”，但底层仍是 `+0.195` 这类魔法常数，导致文案、配置和真实效果脱节。

**根因**：旧版涌潮逻辑直接在 `entities.js` 中叠加固定数值，而不是读取显式倍率字段。

**正确做法**：在 `CONFIG.gameplay` 中维护 `assimilationDoubleMultiplier`，并以 `doubleAssimilationBoostRounds` 作为显式运行态；同化判定阶段只做 `baseChance * multiplier`，阶段结算时统一递减并清理。

**关键位置**：`src/config.js`、`src/ui/shop.js`、`src/entities.js`、`src/game_phase.js`

## 关键耦合点

1. **状态初始化 / 重置 / 存档必须成组出现**：`selectionMode`、`selectionRequiredCount`、`pendingSelectionMode`、`selectionInjectedRune`、`selectionPreviewState`、`doubleAssimilationBoostRounds`、`relicOverlayReturnState` 必须同时出现在 `core.js` 初始化、`game_system.js` 的 `sys_resetGame()` 与 `sys_saveRunState()` / `sys_loadRunState()` 中，缺任一处都会造成刷新恢复异常或新局脏状态残留。
2. **预览 UI 与实际写回必须共享状态源**：预览面板读的是 `spawn_showMarblePreview()` 当前上下文，而真正的合法性校验和实体写回发生在 `ui_confirmSelection()`；两者必须共享同一套 `selectionInjectedRune` / `selectionPreviewState`。
3. **混沌精华只是旧轮盘语义迁移，不是新机制**：它必须继续沿用 `FortuneWheel` 与 `slotType='wheel'`，否则会把命运系统拆成两套并引入新的维护负担。

### 坑 5: phase_switchPhase 触发 ui_updateUI 时读取旧 selectionMode，渲染出上一次的命运选择卡片

**现象**：每次触发纯净精华 / 混沌精华 / 遗物选择时，界面会短暂闪出上一次的命运选择卡片（如上一轮的 chaos_essence 弹珠网格）。

**根因**：`sys_startRoundStartResolver` 先调用 `phase_switchPhase('selection')`（此时 `selectionMode` 仍为上一次的值），然后才在动画回调里（800ms 后）设置新的 `selectionMode`。`phase_switchPhase` 内部立即调用 `ui_updateUI()`，后者读到旧 `selectionMode` 并渲染旧界面。同理，`sys_initSelectionPhase` 也先 `phase_switchPhase` 再设置 `selectionMode`，导致同样问题。此外 `ui_onPhaseChange` 里多余的 `ui_updateUI()` 调用进一步加剧了双重渲染。

**正确做法**：
1. 在 `sys_startRoundStartResolver` 切换到 `selection` 阶段**之前**，先将 `selectionMode = 'standard'`、`fateMomentContext = null` 重置，确保 `phase_switchPhase` 触发的 `ui_updateUI` 渲染的是空白选择界面。
2. 在 `sys_initSelectionPhase` 中，先设置 `selectionMode`、`selectionRequiredCount`、`fateMomentContext`，再调用 `phase_switchPhase('selection')`。
3. 去掉 `ui_onPhaseChange` 中多余的 `ui_updateUI()` 调用（`phase_switchPhase` 内部已调用过）。
4. 去掉 `ui_closeRelicSelection` selection 分支中多余的 `ui_updateUI()` 调用。

**关键位置**：`src/game_system.js` → `sys_startRoundStartResolver()` / `sys_initSelectionPhase()`；`src/ui_system.js` → `ui_onPhaseChange()`；`src/ui/shop.js` → `ui_closeRelicSelection()`

### 坑 6: fateMomentContext 缺少 active 字段，导致 ui_isFateMomentPhase() 始终返回 false

**现象**：进入纯净精华后界面立刻变成混沌精华选择界面，且无法点击按钮进入研磨阶段。

**根因**：`ui_isFateMomentPhase()` 的判断条件是 `this.fateMomentContext && this.fateMomentContext.active`，但 `sys_startRoundStartResolver` 和 `sys_initSelectionPhase` 构建的 `fateMomentContext` 对象均缺少 `active: true` 字段，导致该函数始终返回 `false`。这影响了顶部栏显示逻辑、教程遮罩等多处依赖 `ui_isFateMomentPhase()` 的判断。

**正确做法**：所有构建 `fateMomentContext` 对象的地方都必须包含 `active: true` 字段。

**关键位置**：`src/game_system.js` → `sys_startRoundStartResolver()` / `sys_initSelectionPhase()`

**2026-06-19 补充**：`_proceedToFateMomentSelection()` 也是命运时刻上下文恢复入口。该函数通常在子弹替换流程完成后回到原命运时刻，如果这里缺少 `active: true`，顶部栏和教程过滤仍会把界面误判为普通 `selection`。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-18 | 初始记录命运时刻 overlay 返回流与纯净精华选择模式的防坑要点 | agt-50c9e9de-077 |
| v1.1 | 2026-04-24 | 补充坑 5：phase_switchPhase 触发 ui_updateUI 时读取旧 selectionMode 渲染旧卡片 | agt |
| v1.2 | 2026-04-24 | 补充坑 6：fateMomentContext 缺少 active 字段导致 ui_isFateMomentPhase() 失效 | agt |
| v1.3 | 2026-06-19 | 补充 `_proceedToFateMomentSelection()` 也必须写入 active 字段 | codex |
| v1.4 | 2026-07-18 | 补充 overlay session/pause lease、键盘焦点合同，以及 selection 完整存档恢复与回写守卫。 | Codex |

### 坑 7: Overlay 回调没有 session 所有权

**现象**：重复打开遗物、局内商店或模块编辑器后，旧 card/close/purchase handler 会关闭新 overlay、释放新 pause，或重复推进 resolver。

**根因**：只保存一个 close callback 或布尔 paused 状态；异步 handler 无法证明自己仍属于当前 overlay session。

**正确做法**：每次真实打开创建唯一 session ID，并独立持有 `sys_acquirePauseLease(ownerId)` 返回的 token。重复 open 只聚焦当前 session，不覆盖 callback 或再申请 lease。所有 card、购买、Escape、close 回调先核对 session ID；关闭时先把 session 标为 settled/closed、清理 handler，再释放自己的 lease。旧 token、重复 close 和过期 handler 必须无副作用。

**关键位置**：`src/ui/shop.js`、`src/ui/run_shop.js`、`src/ui_system.js`。

### 坑 8: JS Overlay 可点击但不可完整键盘操作

**现象**：Tab 焦点落到遮罩下方，Escape 无法关闭，重渲染后焦点丢失，余额不足按钮仍可误触或读屏只听到“不可用”而不知道原因。

**根因**：动态 overlay 只绑定 click，没有补齐 dialog 语义、focus trap、焦点恢复和 native disabled 状态。

**正确做法**：打开时设置 `role="dialog"` / `aria-modal="true"`，记录触发前焦点并把焦点移入 overlay；Tab/Shift+Tab 在当前可操作项内循环，Escape 走幂等 close；列表重渲染后恢复同一商品/卡片或第一个可用元素；按钮同时写 native `disabled`、`aria-disabled` 与可读原因。关闭后仅在元素仍可聚焦时恢复原焦点。

**关键位置**：`src/ui/shop.js`、`src/ui/run_shop.js`。

### 坑 9: Selection 恢复只保存类型或恢复期间反向覆盖存档

**现象**：双选存档刷新后退化为单选，弹珠 `collected` / `runeSlots` / `maxRuneSlots` / `persistentThreshold` 丢失；或者 UI 重建生成默认候选并把有效 checkpoint 覆盖掉。

**根因**：序列化只保留 type，validator 不检查 `selectionRequiredCount`、索引与 replace 上下文；恢复调用普通生成路径时没有禁止 reentrant save。

**正确做法**：selection checkpoint 保存完整 `MarbleDefinition`、选中索引、模式、required count、注入符文和预览态；每次普通选择或 replace-ammo 卡片 toggle 都要在状态变更后保存。校验要求 selected indices 在候选范围内，并验证 replace-ammo 两侧队列；恢复必须忠实保留玩家已验证的空/部分选择，不能自动补满。恢复在 `_runStateRestoreActive` 守卫下重建 DOM/预览，普通 save 在 hydration 结束前必须返回 `false`，随后只在完整状态就绪后写一次规范化 checkpoint。

**关键位置**：`src/game_system.js` → `sys_validateRunStatePayload()` / `sys_loadRunState()`；`src/ui_system.js` → selection 重建与确认路径。
