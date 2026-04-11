# Echo Alchemist V2 代码与文档差异分析报告

本文档基于 `echo-developer` 技能工作流，对 Echo Alchemist V2 项目当前的实际代码实现与规范文档（`AGENTS.md` 及 `.cursor/rules/` 下的各模块规范）进行了深度核对。检查结果表明，随着代码的持续重构，多处架构设计和实现细节已发生变更，但对应的“活文档”未能及时同步更新，存在显著的滞后与矛盾。

## 1. 核心架构与加载模式差异

项目架构在近期经历了从巨型 Mixin 模式向组合模式（Composition via bind）的演进，但部分文档和注释仍停留在旧的实现方式上。

| 模块/文档 | 文档描述的加载方式 | 实际代码实现 | 差异级别 |
| :--- | :--- | :--- | :--- |
| `global.md` 及 `core.js` | 第 5 节明确指出已完全移除 `Object.assign` Mixin 模式，改为通过 `bind(this)` 注入为实例方法。 | `core.js` 的构造函数中确实通过 `bind(this)` 遍历 `_subsystems` 数组进行注入，符合描述。 | 无差异 |
| `ui_system.md` | 第 1 节和第 2 节仍明确声称“UI 系统均通过 `Object.assign` 混入 `Game.prototype`”。 | 实际在 `core.js` 中与其他系统一样，通过 `bind(this)` 组合模式注入。 | **严重** |
| `src/ui/hud.js` | 文件头注释：“通过 Object.assign 混入 Game 实例”。 | 作为普通对象导出，由 `core.js` 进行 bind 绑定。 | **严重** |
| `src/ui_system.js` | 顶部注释：“这些模块通过 Object.assign 混入 Game 实例”。 | 同样由 `core.js` 统一 bind。 | **严重** |
| `src/combat/combat.md` | 第 2 节声称 `damage_calc.js` 和 `collision.js` 在 `combat_system.js` 末尾通过 `Object.assign` 注入。 | `combat_system.js` 末尾确实使用了 `Object.assign(combat_system, DamageCalc, CollisionSystem)`。 | 无差异（但与全局倡导的组合模式精神不符） |

**分析结论**：虽然 `core.js` 和 `global.md` 已完成了向组合模式的文档和代码更新，但下层的 UI 子系统文档（`ui_system.md`）和源文件注释未能同步，给后续开发者传达了错误的历史架构信息。

## 2. 事件总线 (EventBus) 命名与使用规范差异

事件驱动是项目解耦的核心，但文档中定义的事件字典与代码中实际派发、监听的字符串存在大量不一致，甚至存在直接违反“严禁使用魔法字符串”规范的行为。

### 2.1 魔法字符串泛滥
`events.md` 明确规定：“**严禁使用魔法字符串**：所有事件派发和监听必须使用 `EVENT_TYPES` 常量。”
然而，在核心业务模块中，大量事件派发直接使用了硬编码的字符串：

*   **`combat_system.js`**：
    *   派发了 `'damage:dealt'`、`'enemy:killed'`、`'boss:defeated'`、`'boss:phase_change'`。
*   **`game_phase.js`**：
    *   派发了 `'wave:advance'`、`'phase:change'`、`'ui:round_num_update'`。

### 2.2 事件名称与 Payload 不一致
文档中定义的事件名称与代码中实际使用的名称脱节。

| 事件场景 | `events.md` 定义 | 实际代码派发 (`combat_system.js` / `game_phase.js`) | Payload 差异 |
| :--- | :--- | :--- | :--- |
| 伤害造成 | `COMBAT_DAMAGE_DEALT` (值为 `damage:dealt`) | `'damage:dealt'` | 文档定义 payload 包含 `damage`, `attr`；实际代码派发的是 `amount`, `type`, `sourceType`, `shotId`。 |
| 敌人死亡 | `COMBAT_ENEMY_KILLED` (值为 `enemy:killed`) | `'enemy:killed'` | 文档定义 payload 包含 `hitX`, `hitY`；实际代码派发的是 `maxHp`, `shotId`。 |
| Boss 狂暴 | `BOSS_PHASE_CHANGE` (值为 `boss:phase_change`) | `'boss:phase_change'` | 字符串一致，但直接使用了魔法字符串而非 `EVENT_TYPES` 常量。 |

**分析结论**：`events.md` 中的事件字典已严重过时，既未能约束代码中魔法字符串的使用，其描述的 Payload 结构也与实际业务逻辑（如子弹属性重构后的 `amount`/`type`）脱节。

## 3. UI 层与业务层解耦 (Task 3.2) 落地差异

项目目标是“业务逻辑模块严禁直接操作 DOM，必须通过 EventBus 派发事件”。文档与代码在这一目标的完成度上存在严重分歧。

### 3.1 战斗系统的 DOM 操作残留
*   **`combat.md`**：第 2 节标注 `[Task 3.2 已完成]`，声称所有 DOM 操作必须改为通过 `eventBus.emit` 派发事件。
*   **实际代码 (`combat_system.js`)**：虽然部分 UI 动画（如 `UI_AMMO_FIRED`、`UI_RUNE_CHARGE_UPDATE`）已改为事件派发，但代码中仍残留大量被标记为 `// [Task 3.2]` 的直接 DOM 操作。例如：
    *   直接调用 `this.ui_triggerScreenShake(200)`。
    *   直接调用 `this.ui_showRelicSelection()`。

### 3.2 阶段管理的 UI 强耦合
*   **`game_phase.js`**：阶段管理模块本应是纯业务逻辑，但代码中充斥着直接的 DOM 操作和 UI 方法调用。
    *   直接操作 DOM：`document.getElementById('combat-message').innerHTML = ...`，`document.getElementById("round-num").innerText = ...`。
    *   直接调用 UI 方法：`this.ui_updateUI()`、`this.ui_onPhaseChange()`、`this.ui_updateGatheringQueueUI()`、`this.ui_renderRecipeHUD()`。

**分析结论**：Task 3.2（消除 UI 层与业务层的强耦合）在文档中被过早地标记为“已完成”，但实际代码中，特别是在 `game_phase.js` 和部分战斗逻辑中，仍存在严重的 UI 强耦合和直接 DOM 操作。

## 4. 文件规模与拆分状态描述差异

`global.md` 中为了强调拆分的重要性，记录了各核心文件的行数，但这些数据未随代码演进而更新。

| 文件 | `global.md` 描述的行数 | 实际行数 | 差异说明 |
| :--- | :--- | :--- | :--- |
| `entities.js` | 约 6140 行 | 3245 行 | `entities.md` 中的描述（3245行）是准确的，但 `global.md` 未同步更新，仍保留拆分前的旧数据。 |
| `combat_system.js` | 约 2593 行 | 2263 行 | 随着部分逻辑拆分到 `damage_calc.js` 和 `collision.js`，实际行数已减少。 |

## 5. 总结与修复建议

Echo Alchemist V2 项目在向模块化和事件驱动架构的演进中取得了实质性进展，但**活文档机制失效**导致了代码与规范的严重脱节。

### 建议采取的修复行动：

1.  **修正架构描述**：全局搜索并移除所有 `ui_system.js`、`hud.js`、`shop.js`、`rune_launcher.js` 及其对应 Markdown 文档中关于 `Object.assign` Mixin 模式的过时描述，统一修改为 `core.js` 中的 `bind(this)` 组合模式说明。
2.  **统一事件总线规范**：
    *   更新 `events.md` 中的 `EVENT_TYPES` 字典，使其与实际业务（特别是 `combat_system.js` 中的 payload）完全一致。
    *   编写脚本或通过全局替换，将 `combat_system.js` 和 `game_phase.js` 中的魔法字符串（如 `'damage:dealt'`）替换为 `EVENT_TYPES.COMBAT_DAMAGE_DEALT` 等标准常量。
3.  **推进 Task 3.2 彻底落地**：将 `game_phase.js` 中直接的 `document.getElementById` 和 `this.ui_*` 调用重构为 EventBus 事件派发，由 `ui_system.js` 统一接管渲染，消除最后一块严重的 UI 耦合。
4.  **同步文件规模数据**：更新 `global.md` 第 4 节中关于巨型文件行数的描述，以反映当前的真实拆分进度。
