# Lowpoly PGC 生物生成项目 (120x120 像素空间适配版)

## 项目简介
本项目是一个基于功能性生物力学与隐式曲面的低多边形（Lowpoly）生物过程化生成系统。专门针对 120x120 像素空间、面向屏幕视角、仅向前移动以及精简动画（待机、受击、移动）的特定需求进行了深度优化。

## 项目结构
```text
docs/
├── architecture/
│   └── architecture_design.md    # 整体架构设计总览 (v2.0)
├── data_structures/
│   └── data_structures.md        # 模块间交互数据结构定义
└── modules/
    ├── module_1_topology.md      # 拓扑生成模块 (空间约束版)
    ├── module_2_biomechanics.md  # 生物力学与物理验证模块 (正面视角版)
    ├── module_3_muscle.md        # 功能性肌肉发生模块 (视觉特征版)
    ├── module_4_sdf.md           # 隐式表面融合模块 (低分辨率优化版)
    ├── module_5_lowpoly.md       # Lowpoly 离散化与风格化模块 (像素美学版)
    ├── module_6_animation.md     # 运动学与动画配置模块 (精简动画版)
    └── module_7_evolution.md     # 进化与反馈循环模块 (场景适配版)
```

## 核心设计原则
1. **形态跟随功能**：生物的外观由环境参数（重力、流体密度）和动力学需求（向前移动）驱动生成。
2. **空间与分辨率适配**：所有生成逻辑均在 120x120 像素空间内进行，并针对低分辨率显示优化了几何特征。
3. **视角优先**：强化正面视觉特征，压缩深度复杂度，确保在屏幕正前方有最佳视觉表现。
4. **精简动画管线**：针对待机、受击、移动三种核心状态进行骨骼和蒙皮优化。

## 快速索引
- 想要了解整体流程？请查看 [架构设计总览](./docs/architecture/architecture_design.md)。
- 想要了解数据如何流动？请查看 [数据结构定义](./docs/data_structures/data_structures.md)。
- 想要深入了解特定模块？请查看 [模块文档目录](./docs/modules/)。
