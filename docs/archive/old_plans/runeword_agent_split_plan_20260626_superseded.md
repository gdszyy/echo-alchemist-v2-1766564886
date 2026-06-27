# Echo Alchemist V2 - 词条效果开发细粒度子 Agent 拆分与并行规划报告（修订版）

> 本报告在初步规划的基础上，深入分析了 13 个词条效果的实现触点，重点评估了任务依赖、并行可行性与模块冲突风险，并据此将原 Agent 3 进一步拆分为两个独立子 Agent。

---

## 1. 词条效果实现触点分析

通过对 `combat_system.js`、`damage_calc.js`、`projectile.js`、`enemy.js`、`collision.js` 和 `rune_launcher.js` 的深度阅读，可以将 13 个词条效果按照其实现所在的代码层次归类如下：

| 词条名称 | 所属类型 | 主要 Hook 文件 | 次要涉及文件 |
| :--- | :--- | :--- | :--- |
| **熔毁** | 元素专属 | `combat_system.js`（`combat_fireNextShot` 构建 recipe 时注入倍率） | — |
| **绝对零度** | 元素专属 | `damage_calc.js`（`combat_recordDamage` 后检查冰冻状态） | `enemy.js`（需要新增 `roundDamageDepth` 状态） |
| **冰霜新星** | 元素专属 | `entities/projectile.js`（`_handleCollision` 弹跳计数 Hook） | — |
| **雷暴之语** | 元素专属 | `damage_calc.js`（修改 `combat_lightning_triggerChain` 的 `decayFactor`） | — |
| **雷霆散射** | 元素专属 | `damage_calc.js`（闪电链触发后按概率额外调用一次 `triggerChain`） | — |
| **动能激增** | 元素专属 | `entities/projectile.js`（`_handleCollision` 弹跳时附加固定伤害） | — |
| **照射** | 元素专属 | `combat_system.js`（`combat_laser_fire` 改为持续伤害模式） | — |
| **炎光剑影** | 复合机制 | `combat_system.js`（`combat_damageEnemy` 穿透时按概率召唤飞剑） | — |
| **穿甲流星** | 复合机制 | `entities/projectile.js`（散裂子弹生成时继承 `piercesLeft`） | — |
| **炽热光线** | 复合机制 | `combat_system.js`（激光持续照射时每 0.5 秒提升温度） | — |
| **雷电护盾** | 复合机制 | `entities/projectile.js`（`_handleCollision` 弹跳时按概率生成静电场） | `damage_calc.js`（调用闪电伤害计算） |
| **剑刃风暴** | 复合机制 | `combat_system.js`（首个子弹每 0.5 秒对范围内敌人触发剑光斩击） | — |
| **元素聚变** | 复合机制 | `damage_calc.js`（伤害结算后检查三元素状态，触发真实伤害爆炸） | `enemy.js`（需要读取火/冰/雷三种状态标记） |

---

## 2. 冲突风险与依赖关系评估

### 2.1 文件级冲突风险

原方案中"Agent 3 (Effect & UI Agent)"将 `damage_calc.js`、`projectile.js`、`combat_system.js` 和 `rune_launcher.js` 全部交由一个 Agent 处理。但这四个文件之间存在明显的逻辑边界：`damage_calc.js` 和 `projectile.js` 属于**纯计算与弹道物理层**，而 `combat_system.js` 属于**战斗流程控制层**。将它们合并给同一个 Agent 会导致单个 Agent 的上下文过重，且在复杂词条（如"雷电护盾"）的实现中，`projectile.js` 需要调用 `damage_calc.js` 中的闪电计算，若同一 Agent 同时修改两个文件，则需要在单次任务中管理两个大文件的 Diff，风险较高。

更关键的是，`combat_system.js`（2216 行）与 `damage_calc.js`（258 行）的规模差异悬殊。将它们分配给不同 Agent 处理，可以让每个 Agent 专注于更小的修改范围，降低出错概率。

### 2.2 依赖关系链

```
Agent A (数据与解析层)
    └─ 输出：新 RUNEWORD_DB 结构 + parseRuneGrid 返回 level 字段
           ├─ Agent C 依赖：读取词条 level 注入计算 Hook
           └─ Agent D 依赖：读取词条 level 渲染 UI 和注入流程 Hook

Agent B (实体与物理底层)
    └─ 输出：冰冻衰减机制 + 激光穿透衰减机制
           └─ Agent C 间接依赖：绝对零度、元素聚变依赖 enemy 状态
```

Agent A 与 Agent B 之间**无任何依赖关系**，可以完全并行。Agent C 与 Agent D 之间**无文件交集**，可以在 Agent A 完成后并行启动。

---

## 3. 最终拆分方案：4 个子 Agent

经过细粒度评估，原方案中的 Agent 3 应进一步拆分为两个独立子 Agent（Agent C 和 Agent D），最终形成 4 个子 Agent 的协作方案。

### Agent A：数据与解析核心 (Data & Parser Agent)

Agent A 负责整个词条系统的数据地基，其输出是后续所有 Agent 的契约依据。核心工作是将 `rune_config.js` 中的 `RUNEWORD_DB` 从扁平的 `stats` 结构升级为包含 `effectId`、`baseParams`、`perLevelParams` 的结构化对象，并重构 `rune_system.js` 中的 `parseRuneGrid`，使其在多路径匹配时累加词条 `level` 而非仅激活一次。

### Agent B：实体与物理底层 (Entity & Physics Agent)

Agent B 负责两项前置基础机制，与其他 Agent 的修改文件完全无交集。在 `enemy.js` 中，`applyTemp` 已有 `frozenCount` 字段的初始化，但衰减逻辑尚未实现，需补充 `Math.pow(0.9, this.frozenCount)` 的乘法；`frozenCount` 的自增逻辑已在 `game_phase.js` 第 424 行实现，无需重复修改。在 `collision.js` 中，`combat_laser_processPenetration` 目前对所有穿透目标施加等量伤害，需引入衰减变量，每穿透一个敌人后将后续伤害乘以 `0.5 * pierce层数`。

### Agent C：战斗计算与弹道 Hook (Combat Math & Projectile Hook Agent)

Agent C 是效果层中工作量最大的 Agent，但其修改文件（`damage_calc.js` 和 `projectile.js`）规模相对可控（258 行和约 800 行），均可使用 Unified Diff 策略安全修改。该 Agent 需要在 `damage_calc.js` 中为雷电系（雷暴之语、雷霆散射）、冰霜系（绝对零度）和复合系（元素聚变）注入伤害计算 Hook；在 `projectile.js` 中为弹射系（动能激增、冰霜新星）、穿透系（穿甲流星）和复合系（雷电护盾）注入弹道生命周期 Hook。

### Agent D：流程控制与 UI 适配 (Flow Control & UI Agent)

Agent D 专注于 `combat_system.js` 中的战斗流程控制层和 `rune_launcher.js` 的 UI 渲染层。在流程层，需要修改 `combat_laser_fire` 实现激光持续伤害模式（照射、炽热光线），修改 `combat_damageEnemy` 在穿透时按概率召唤飞剑（炎光剑影），以及在首个子弹的更新循环中注入剑刃风暴的定时斩击逻辑。在 UI 层，需要更新 `_ui_updateActivatedRunewordsDisplay` 函数，使其能够读取词条的 `level` 字段并动态渲染等级标识和效果数值。

---

## 4. 并行工作流与时序规划

```
Phase 1 (可立即并行)
├── Agent A: rune_config.js + rune_system.js
└── Agent B: enemy.js + collision.js

Phase 2 (等待 Agent A 合并后并行)
├── Agent C: damage_calc.js + projectile.js
└── Agent D: combat_system.js + rune_launcher.js
```

| Agent | 可并行对象 | 共享文件 | 冲突风险 |
| :--- | :--- | :--- | :--- |
| A ↔ B | 完全并行 | 无 | **无** |
| A ↔ C | 不可并行（C 依赖 A 的输出） | 无 | — |
| A ↔ D | 不可并行（D 依赖 A 的输出） | 无 | — |
| B ↔ C | 可并行（若 A 已完成） | 无 | **无** |
| B ↔ D | 可并行（若 A 已完成） | 无 | **无** |
| C ↔ D | 完全并行 | 无 | **无** |

所有 4 个 Agent 的修改文件之间**不存在任何重叠**，这是本拆分方案的核心优势。每个 Agent 在完成后，均须在同一 Commit 中同步更新对应的 `.cursor/rules/*.md` 规范文档，并严格遵守 `global.md` 中对超大文件（`combat_system.js`、`enemy.js`）禁止全量重写的约束。
