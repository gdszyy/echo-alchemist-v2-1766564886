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
- **激光穿透判定** (`combat_laser_processPenetration`)：线段与敌人包围盒的相交判定。

## 2. 架构约定

1. **Mixin 模式注入**：
   - `damage_calc.js` 导出 `DamageCalc` 对象。
   - `collision.js` 导出 `CollisionSystem` 对象。
   - 这两个对象在 `combat_system.js` 的末尾通过 `Object.assign(combat_system, DamageCalc, CollisionSystem)` 注入，保持对外接口（挂载到 `Game` 实例上）不变。
   - 原有 `combat_system.js` 中的函数定义被替换为委托注释，指明其实际位置。

2. **事件驱动 (TODO[Task 3.2])**：
   - 战斗系统及拆分出的模块中仍包含部分直接操作 DOM 的代码（如 `document.getElementById`）。
   - 这些代码已被标记为 `// TODO[Task 3.2]: 改为 EventBus...`。
   - 在后续的 Task 3.2 中，所有 DOM 操作必须改为通过 `eventBus.emit` 派发事件，由 `ui_system.js` 监听并处理，实现业务逻辑与 UI 渲染的彻底解耦。

3. **依赖关系**：
   - 战斗计算模块可依赖 `config.js`（读取配置）、`entities.js`（读取实体类）、`calc_utils.js`（复用数学工具如 `calc_getLineRectIntersection`）。
   - 模块间通信应尽量通过 `Game` 实例（`this`）的状态或 `eventBus` 进行，避免强耦合。

## 3. 维护指南

- **新增伤害公式**：请在 `damage_calc.js` 中添加，并在 `combat_system.js` 中调用。
- **新增弹道或碰撞逻辑**：请在 `collision.js` 中实现检测逻辑。
- **新增战斗阶段控制**：请在 `combat_system.js` 中添加。
- **UI 表现修改**：禁止在战斗模块中直接修改 DOM，请抛出 `eventBus` 事件并在 UI 系统中处理。
