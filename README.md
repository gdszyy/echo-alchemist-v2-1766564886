# Echo Alchemist (回聲煉金師) - 代码结构化索引文档

本项目是一个基于 HTML5 Canvas 和 JavaScript 开发的单文件 Roguelike 游戏。为了方便 AI Agent 和开发者理解、编辑这个超过 11,000 行的超长文件，特建立此结构化索引。

## 1. 核心架构 (Core Architecture)

游戏采用面向对象的设计，逻辑高度解耦。

| 类名 | 职责描述 | 关键方法 |
| :--- | :--- | :--- |
| **`Game`** | 游戏引擎核心，管理状态、循环、输入及全局逻辑。 | `switchPhase`, `loop`, `damageEnemy`, `spawnEnemyRow` |
| **`Enemy`** | 敌人逻辑，处理 AI、血量、词缀及受击反馈。 | `takeDamage`, `executeTurnAction`, `draw` |
| **`Projectile`** | 战斗弹丸，处理移动、碰撞及特殊攻击逻辑。 | `update`, `onHit`, `performSlashAttack` |
| **`DropBall`** | 收集阶段弹珠，处理物理模拟与钉板交互。 | `handlePegInteraction`, `update`, `draw` |
| **`SoundManager`** | 音频引擎，基于 Web Audio API 合成音效。 | `playEffect`, `playTone`, `playHit` |
| **`UIManager`** | UI 状态管理，处理 DOM 更新与交互。 | `updateSkillBar`, `showEnemyInfo`, `switchTab` |

## 2. 全局配置与数据库 (Global Config & DB)

所有的平衡性调整和视觉规范都集中在以下常量中：

*   **`CONFIG` (Line 1129)**: 
    *   `ui`: 颜色与图标定义。
    *   `physics`: 重力、摩擦力、弹珠半径等物理参数。
    *   `balance`: 敌人血量成长、词缀触发概率、伤害系数。
    *   `gameplay`: 网格大小、波次规则、遗物出现间隔。
*   **`RELIC_DB` (Line 1327)**: 遗物系统定义，包含 `id`, `name`, `effect`, `rarity` 等。
*   **`SKILL_DB` (Line 1384)**: 玩家主动技能定义，包含消耗、逻辑 ID (`methodId`) 及参数。

## 3. 关键逻辑流程 (Key Logic Flows)

### 3.1 阶段循环 (Phase Loop)
游戏在两个主要阶段间切换：
1.  **`GATHERING` (收集阶段)**: 玩家投放弹珠，通过碰撞钉子获得属性和能量。
2.  **`COMBAT` (战斗阶段)**: 玩家发射子弹攻击不断逼近的敌人。

### 3.2 进化与突变 (Evolution System)
位于 `CONFIG.evolutionRules`。当特定属性的弹珠碰撞到特定属性的钉子时，会触发：
*   **Mutation (突变)**: 产生全新的属性（如 `pierce` + `pierce` -> `flying_sword`）。
*   **Upgrade (升级)**: 提升现有属性的等级。

### 3.3 伤害系统 (Damage System)
核心方法：`Game.damageEnemy(enemy, projectile)`。
支持多种效果叠加：
*   **元素效果**: 冰冻 (Cryo)、燃烧 (Pyro)、连锁闪电 (Lightning)。
*   **特殊攻击**: 飞剑 (Flying Sword)、斩击 (Slash)、光束 (Laser)。

## 4. 开发与调试指南 (Dev & Debug)

*   **性能优化**: 游戏使用了 `requestAnimationFrame` 驱动主循环，并通过 `timeScale` 支持慢动作效果。
*   **视觉特效**: 结合了 CSS `@keyframes` (Line 43+) 和 Canvas 绘图。
*   **调试建议**: 
    *   修改 `CONFIG.balance` 可快速测试不同难度。
    *   搜索 `class Game` 下的 `setupInputs` 可调整交互逻辑。

---

*此文档由 AI Agent 自动生成，旨在作为大型代码库的“第二大脑”索引。*
