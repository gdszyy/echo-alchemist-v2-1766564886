# Echo Alchemist 架构地图 (Architecture Map)

本文档旨在为 AI 和开发者提供项目代码结构的快速索引，明确每个核心类、函数的位置及其职责。

## 1. 核心引擎 (Core Engine) - `src/core.js`

| 类/函数 | 类型 | 职责描述 |
| :--- | :--- | :--- |
| `Game` | Class | 游戏核心控制器，管理所有子系统、阶段切换及主循环。 |
| `SoundManager` | Class | 音频管理器，处理音效播放、静音及主音量控制。 |
| `sys_loop()` | Method | 游戏主循环，负责每帧的渲染分发与逻辑更新。 |
| `phase_switchPhase()` | Method | 阶段切换核心函数，负责 UI 更新与标题显示。 |
| `phase_startCombatPhase()` | Method | 初始化战斗阶段，重置伤害记录、弹药队列及 UI。 |
| `phase_gathering_initPachinko()` | Method | 初始化研磨阶段（弹珠台），生成钉子、特殊槽位等。 |
| `calc_evaluateAndAdjustDifficulty()` | Method | DDA (动态难度调整) 核心算法，根据玩家表现调整敌人成长。 |

## 2. 实体与对象 (Entities) - `src/entities.js`

| 类名 | 职责描述 |
| :--- | :--- |
| `Projectile` | 基础弹丸类，处理物理移动、碰撞检测及属性触发。 |
| `Enemy` | 敌人基类，管理血量、移动、受击反馈及死亡逻辑。 |
| `Peg` | 钉子类，弹珠台的核心碰撞体，支持同化与变异逻辑。 |
| `DropBall` | 玩家发射的弹珠，在研磨阶段用于收集属性。 |
| `SonSword` | 子母剑系统中的子剑实体，具有自动追踪行为。 |
| `Vec2` | 基础向量类，提供数学运算支持。 |

## 3. 系统管理 (Systems) - `src/systems.js`

| 类名 | 职责描述 |
| :--- | :--- |
| `UIManager` | 负责游戏内所有 DOM 元素的交互、弹窗及 HUD 更新。 |
| `TruthBook` | 真理之书系统，管理图鉴、成就及静态数据展示。 |
| `TrainingGround` | 试炼场系统，提供独立的战斗测试环境。 |

## 4. 配置与数据 (Config) - `src/config.js`

- `CONFIG`: 全局平衡性参数、机制配置（DDA, 物理, 概率）。
- `RELIC_DB`: 遗物数据库，定义所有遗物的效果、稀有度及图标。
- `SKILL_DB`: 技能/属性数据库。

---
**注意**: 修改上述核心类或函数时，请务必同步更新此文档。
