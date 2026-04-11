# 实体系统规范 (entities.md)

本文档是 Echo Alchemist V2 项目中实体系统（`entities.js` 及相关拆分文件）的开发规范。

## 1. 模块职责
实体系统负责游戏中所有"会动的东西"的定义和更新，包括：
*   **核心实体**：弹珠（MarbleDefinition）、敌人（Enemy）、玩家（Player）、特殊槽位（SpecialSlot）、命运轮盘（FortuneWheel）、钉子（Peg）等。
*   **战斗实体**：子弹（Projectile）、飞剑系统（SwordQi, SlashAnim, SonSword）、分身孢子（CloneSpore）。
*   **视觉特效**：粒子（Particle）、光束（LaserBeam）、冲击波（Shockwave）等。
*   **掉落物**：符文掉落（RuneLoot）。

## 2. 架构拆分状态

随着 Task 2.1 和 Task 2.2 的完成，巨型的 `entities.js` 已完成主要拆分：

| 文件 | 职责 | 主要内容 |
|------|------|----------|
| `src/entities.js` | 入口聚合文件（约 3245 行） | 保留 DropBall、SwordQi、SlashAnim、SonSword、CloneSpore、Player、RuneLoot 等；通过 import/export 聚合所有拆分模块 |
| `src/entities/enemy.js` | 敌人实体（约 1322 行） | Enemy 类（含所有词缀逻辑、AI 行为、温度系统、视觉渲染） |
| `src/entities/projectile.js` | 子弹实体（约 737 行） | Projectile 类（含碰撞检测、伤害计算、视觉效果） |
| `src/utils/math_utils.js` | 纯数学工具函数 | Vec2、lerp、lerpColor、rotateTowards 等 |
| `src/effects/particles.js` | 纯视觉特效类 | Particle、SlashEffect、FireWave、LaserBeam 等 |

**拆分进度统计：**
- Task 2.1 前：entities.js 约 5249 行
- Task 2.1 后：entities.js 约 5249 行（提取了 math_utils.js 和 particles.js）
- Task 2.2 后：entities.js 约 3245 行（提取了 enemy.js 和 projectile.js，减少约 2004 行）

## 3. 音频注入机制

由于 `enemy.js` 和 `projectile.js` 是独立模块，它们各自维护独立的音频代理：

- `entities/enemy.js` 导出 `setEnemyAudioProvider(provider)` 函数
- `entities/projectile.js` 导出 `setProjectileAudioProvider(provider)` 函数
- `entities.js` 的 `setAudioProvider(provider)` 会同时调用上述两个函数，确保音频注入传播到所有子模块
- `core.js` 只需调用 `setAudioProvider`，无需感知子模块的存在

## 4. 开发规范
*   **依赖管理**：
    *   `math_utils.js` 和 `particles.js` 作为底层模块，**严禁**引入 `entities.js`、`config.js` 或 `audio.js` 等高层业务模块，以避免循环依赖。
    *   `entities.js` 通过 ES Modules (`import`) 引入拆分出的工具和特效类，并对外重新导出 (`export`) 以保持对其他子系统（如 `combat_system.js`）的向后兼容性。
    *   新增实体类时，应在 `src/entities/` 目录下创建独立文件，并在 `entities.js` 中 import + re-export。
*   **性能要求**：实体类的 `update` 和 `draw` 方法会在每一帧高频调用，严禁在这些方法中执行高开销操作（如复杂的 DOM 操作或大规模对象创建）。
*   **音频注入**：`entities.js` 不再直接依赖 `window.audio`，而是通过 `setAudioProvider` 接收来自 `core.js` 的音频实例注入。子模块（`enemy.js`、`projectile.js`）各自维护独立的音频代理，由 `entities.js` 的 `setAudioProvider` 统一分发。
*   **状态同步**：实体状态的改变（如敌人死亡、玩家受伤）应通过事件总线 (`event_bus.js`) 广播，而不是直接修改全局状态。
*   **向后兼容**：`entities.js` 的 export 列表必须保持完整，确保 `core.js` 等上层模块无需修改即可使用。
