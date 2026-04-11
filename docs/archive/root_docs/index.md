# Echo Alchemist 开发索引 (AI Friendly)

本项目是一个基于 **HTML5 Canvas** 和 **JavaScript** 开发的模块化 **Roguelike** 游戏。为了方便 AI 代理和开发者快速理解项目结构，本索引提供了核心文档、开发守则、游戏规则及源码的详细导航。

## 1. 核心架构 (Core Architecture)

核心架构文档定义了项目的整体设计思路和逻辑流转。**AI 代理在进行大规模修改前应优先阅读架构地图和游戏主流程。**

| 文档名称 | 路径 | 核心内容 |
| :--- | :--- | :--- |
| **项目概览** | [README.md](README.md) | 项目简介、快速开始及核心功能说明。 |
| **架构地图** | [docs/architecture/architecture_map.md](docs/architecture/architecture_map.md) | **AI 必读**。详细列出类、函数的位置及其职责。 |
| **游戏主流程** | [docs/architecture/game_flow.md](docs/architecture/game_flow.md) | **AI 必读**。说明游戏各阶段的逻辑切换与核心函数。 |
| **架构设计** | [docs/architecture/architecture_design.md](docs/architecture/architecture_design.md) | 系统的深度设计方案与模块化思路。 |

## 2. 开发守则 (Development Rules)

项目使用特定的开发守则来确保代码质量和 AI 协作的顺畅。

*   **[.cursorrules](.cursorrules)**: 包含 AI 开发时的固定提示词、代码风格规范及维护守则。

## 3. 游戏规则与系统 (Game Rules & Systems)

本节列出了游戏内核心机制的详细规则定义，涵盖了属性进化、战斗行为及未来扩展提案。

| 系统名称 | 文档链接 | 关键机制 |
| :--- | :--- | :--- |
| **风属性系统** | [RULES_WIND_V2.md](RULES_WIND_V2.md) | 锚点生成、几何判定及法阵效果。 |
| **子母剑系统** | [RULES_FLYING_SWORD.md](RULES_FLYING_SWORD.md) | 飞剑获取、升级及战斗行为逻辑。 |
| **职业系统提案** | [docs/player_class_proposal.md](docs/player_class_proposal.md) | 关于玩家职业区分与技能树的初步设计。 |

## 4. 资源与归档 (Assets & Archive)

项目资源包括用于文档说明的图表及其原始源码。历史遗留文档已移至归档目录。

*   **[图片资源 (Images)](assets/images/)**: 包含架构图、流程图等视觉文档。
*   **[图表源码 (Diagrams)](assets/diagrams/)**: 包含 Mermaid (.mmd) 格式的原始图表定义。
*   **[归档文档 (Archive)](docs/archive/)**: 包含旧版规则、特定系统设计等历史参考文档。

## 5. 源码导航 (Source Code)

源码位于 `src/` 目录下，采用模块化设计。以下是核心文件的职责分布：

| 文件路径 | 职责描述 |
| :--- | :--- |
| `src/core.js` | 游戏引擎核心，管理 `Game` 类、主循环及全局状态。 |
| `src/config.js` | 全局配置中心，包含平衡性参数、UI 定义及进化规则。 |
| `src/entities.js` | 实体定义，涵盖敌人 (Enemy)、弹丸 (Projectile) 及粒子。 |
| `src/systems.js` | 业务子系统，如试炼场 (Training Ground) 和真理之书。 |
| `src/combat_system.js` | 战斗逻辑，处理伤害计算、碰撞反馈及属性效果。 |
| `src/ui_system.js` | UI 渲染引擎，负责游戏内各类面板与交互反馈。 |
| `src/game_phase.js` | 状态机管理，控制游戏在不同阶段（如战斗、商店）的切换。 |
| `src/audio.js` | 音频管理，基于 Web Audio API 的音效合成与播放。 |
| `src/calc_utils.js` | 数学工具库，提供几何判定、随机分布等通用函数。 |

---
*此索引旨在为开发者提供清晰的项目脉络，移除了一切与当前 Roguelike 游戏逻辑无关的冗余内容。*
