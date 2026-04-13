# 战斗系统规范 (Combat System Architecture)

本文档定义了 `src/combat_system.js` 拆分后的战斗系统模块结构及职责边界。

## 1. 模块拆分与职责

战斗系统已按职责拆分为以下三个核心文件：

### 1.1 `combat_system.js`（核心战斗流程控制）
保留核心的战斗循环控制逻辑，主要包括：
- **战斗回合推进** (`combat_activateSkill`, `combat_updateHitProgress`)
- **弹药队列消耗与发射** (`combat_fireNextShot`, `combat_laser_fire`)
- **风系技能核心逻辑** (`combat_wind_triggerMagicCircle`, `combat_wind_executeCircleEffect`)
- **战斗状态管理**（符文充能状态初始化等）

### 1.2 `src/combat/damage_calc.js`（纯伤害计算与统计）
负责所有与数值计算、伤害评估相关的纯逻辑：
- **DDA 评估** (`combat_calculatePlayerExpectedDamage`)
- **伤害记录与统计汇总** (`combat_recordDamage`, `combat_reportDamage`)
- **闪电链触发与计算** (`combat_lightning_triggerChain`)
- **伤害特效触发计算**（如 `combat_triggerChromaticAberration`）

### 1.3 `src/combat/collision.js`（碰撞检测与物理判定）

负责所有的空间计算与碰撞判定逻辑：

- **敌人移动碰撞检测** (`combat_tryMoveEnemy`)：AABB 碰撞与边界检测。
- **激光射线检测** (`combat_laser_castRay`)：墙壁与护盾敌人的反射面检测。
- **激光穿透判定与折射任务生成** (`combat_laser_processPenetration`)：线段与敌人包围盒的相交判定。已实现穿透衰减机制（Task B2，2026-04-11）：按激光路径顺序排序命中敌人，第 n 个目标（从 0 计）受到的伤害 = 原始伤害 × 0.5^n。已新增折射机制（Task B3，2026-04-13）：击中敌人后独立判定折射概率，触发时消耗 1 层 bounce 属性，返回折射任务列表供主函数队列处理。

函数签名变更：`combat_laser_processPenetration(p1, p2, recipe, remainLen, bouncesLeft, hitEnemiesSet, currentWidth)` 返回 `{ refractionTasks, bouncesLeft }`。

## 2. 架构约定

1. **Mixin 模式注入**：
   - `damage_calc.js` 导出 `DamageCalc` 对象。
   - `collision.js` 导出 `CollisionSystem` 对象。
   - 这两个对象在 `combat_system.js` 的末尾通过 `Object.assign(combat_system, DamageCalc, CollisionSystem)` 注入，保持对外接口（挂载到 `Game` 实例上）不变。
   - 原有 `combat_system.js` 中的函数定义被替换为委托注释，指明其实际位置。

2. **事件驱动 ([Task 3.2 已完成])**：
   - 战斗系统及拆分出的模块中仍包含部分直接操作 DOM 的代码（如 `document.getElementById`）。
   - 这些代码已被标记为 `// [Task 3.2 已完成]: 改为 EventBus...`。
   - 在后续的 Task 3.2 中，所有 DOM 操作必须改为通过 `eventBus.emit` 派发事件，由 `ui_system.js` 监听并处理，实现业务逻辑与 UI 渲染的彻底解耦。

3. **依赖关系**：
   - 战斗计算模块可依赖 `config.js`（读取配置）、`entities.js`（读取实体类）、`calc_utils.js`（复用数学工具如 `calc_getLineRectIntersection`）。
   - 模块间通信应尽量通过 `Game` 实例（`this`）的状态或 `eventBus` 进行，避免强耦合。

## 3. 激光折射机制详解（Task B3，2026-04-13）

激光折射系统将原来仅用于墙壁/护盾镜面反射的 `bounce` 属性改造为更具战略性的敌间折射机制。

### 3.1 参数配置（`config.js` 中的 `gameplay` 对象）

| 参数名 | 默认値 | 说明 |
|---|---|---|
| `laserRefractionBaseChance` | `0.30` | 折射基础触发概率（30%） |
| `laserRefractionBounceBonus` | `0.05` | 每层 bounce 增加的触发概率（+5%） |
| `laserRefractionMaxChance` | `0.80` | 折射触发概率上限（80%） |
| `laserRefractionRadius` | `150` | 折射搜寻范围半径（px） |
| `laserRefractionDamageDecay` | `0.75` | 每次折射的伤害衰减系数 |
| `laserRefractionWidthDecay` | `0.85` | 每次折射的光线宽度衰减系数 |
| `laserRefractionMaxTotal` | `50` | 单次发射最大折射总次数 |
| `laserRefractionDepthDecay` | `0.65` | 每增加一层折射深度，概率乘以该系数 |

### 3.2 折射概率公式

```
baseChance = min(laserRefractionMaxChance, laserRefractionBaseChance + bouncesLeft × laserRefractionBounceBonus)
P(折射) = baseChance × laserRefractionDepthDecay ^ depth
```

其中 `depth` 为当前折射深度（主射线为 0，每折射一次 +1）。示例：拥有 4 层 bounce、depth=0 时，概率 = min(0.80, 0.50) × 0.65^0 = 50%；depth=1 时概率降为 50% × 0.65 = 32.5%；depth=2 时降为 21.1%，以此类推。

**折射触发位置**：根据 `pierce`（穿透）与 `bounce`（反弹/折射）的大小关系动态决定：

| 条件 | 折射行为 |
|---|---|
| `pierce > bounce` | 穿透主导，**完全不触发折射** |
| `bounce > pierce` | 折射主导，**第一个**命中的敌人即触发折射 |
| `bounce === pierce`（含两者均为 0） | 平衡模式，**最后一个**命中的敌人触发折射 |

### 3.3 折射链处理流程

`combat_laser_fire` 采用 **BFS 队列**而非递归处理折射链，避免栈溢出。整条折射链共享同一个 `hitEnemiesSet`，确保每个敌人在同一激光链中不会被重复折射。每次折射消耗 1 层 `bounce`，光线宽度和伤害逐次衰减。折射光线在视觉上颜色略微偏绿（混入 bounce 属性的绿色），以区分主射线。

### 3.4 与镜面反射的共存

折射和镜面反射（墙壁/护盾）共同消耗 `bounce` 层数。折射在穿透敌人时触发，镜面反射在射线到达墙壁/护盾时触发，两者共享同一个 `bouncesLeft` 计数器。

## 4. 维护指南

- **新增伤害公式**：请在 `damage_calc.js` 中添加，并在 `combat_system.js` 中调用。
- **新增弹道或碰撞逻辑**：请在 `collision.js` 中实现检测逻辑。
- **新增战斗阶段控制**：请在 `combat_system.js` 中添加。
- **调整折射参数**：请修改 `config.js` 中 `gameplay` 对象的 `laserRefraction*` 字段，无需修改战斗逻辑代码。
- **UI 表现修改**：禁止在战斗模块中直接修改 DOM，请抛出 `eventBus` 事件并在 UI 系统中处理。
