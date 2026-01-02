# Echo Alchemist 开发索引 (AI Friendly)

本项目是一个基于 HTML5 Canvas 和 JavaScript 开发的模块化 Roguelike 游戏。

## 1. 核心文档 (Core Documentation)
- [README.md](README.md): 项目概览、架构说明及快速开始。
- [docs/architecture/architecture_design.md](docs/architecture/architecture_design.md): 详细的系统架构设计。
- [docs/data_structures/data_structures.md](docs/data_structures/data_structures.md): 核心数据结构与交互定义。

## 2. 模块详解 (Module Details)
- [拓扑生成 (Topology)](docs/modules/module_1_topology.md)
- [生物力学 (Biomechanics)](docs/modules/module_2_biomechanics.md)
- [肌肉系统 (Muscle)](docs/modules/module_3_muscle.md)
- [隐式表面 (SDF)](docs/modules/module_4_sdf.md)
- [低多边形风格化 (Lowpoly)](docs/modules/module_5_lowpoly.md)
- [动画系统 (Animation)](docs/modules/module_6_animation.md)
- [进化循环 (Evolution)](docs/modules/module_7_evolution.md)

## 3. 资源目录 (Assets)
- [图片资源 (Images)](assets/images/): 包含架构图、流程图等视觉文档。
- [图表源码 (Diagrams)](assets/diagrams/): 包含 Mermaid (.mmd) 格式的原始图表定义。

## 4. 归档文档 (Archive)
- [docs/archive/](docs/archive/): 包含旧版规则、特定系统设计等历史参考文档。

## 5. 源码导航 (Source Code)
- `src/core.js`: 游戏引擎核心逻辑。
- `src/config.js`: 全局配置与平衡性参数。
- `src/entities.js`: 游戏实体定义。
- `src/systems.js`: 游戏子系统实现。
