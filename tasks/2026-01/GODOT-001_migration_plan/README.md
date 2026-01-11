# Echo Alchemist Godot 迁移计划

**任务 ID**: GODOT-001
**创建日期**: 2026-01-11
**状态**: 进行中

## 1. 项目概述

将 Echo Alchemist 从 HTML5 Canvas + JavaScript 架构迁移到 Godot 4.x 引擎。

### 1.1 原项目技术栈
- **渲染**: HTML5 Canvas 2D
- **语言**: JavaScript (ES6 Modules)
- **音频**: Web Audio API
- **存储**: LocalStorage

### 1.2 目标技术栈
- **引擎**: Godot 4.x
- **语言**: GDScript
- **渲染**: Godot 2D 渲染器
- **音频**: Godot AudioServer

## 2. 迁移模块分解

根据原项目架构，迁移工作分解为以下独立模块：

| 模块 ID | 模块名称 | 原文件 | 复杂度 | 优先级 |
|---------|----------|--------|--------|--------|
| M01 | 项目结构与配置 | config.js | 低 | P0 |
| M02 | 核心游戏循环 | core.js, game_system.js | 中 | P0 |
| M03 | 实体系统 | entities.js | 高 | P1 |
| M04 | 战斗系统 | combat_system.js | 高 | P1 |
| M05 | 游戏阶段管理 | game_phase.js | 中 | P1 |
| M06 | 渲染系统 | render_system.js | 中 | P2 |
| M07 | 生成系统 | spawn_system.js | 中 | P2 |
| M08 | UI 系统 | ui_system.js, systems.js | 高 | P2 |
| M09 | 音频系统 | audio.js | 中 | P3 |
| M10 | 工具函数 | calc_utils.js | 低 | P3 |

## 3. Godot 项目结构设计

```
echo_alchemist_godot/
├── project.godot           # Godot 项目配置
├── scenes/
│   ├── main.tscn           # 主场景
│   ├── game/
│   │   ├── game.tscn       # 游戏主场景
│   │   ├── gathering.tscn  # 研磨阶段场景
│   │   └── combat.tscn     # 战斗阶段场景
│   ├── entities/
│   │   ├── enemy.tscn      # 敌人场景
│   │   ├── projectile.tscn # 子弹场景
│   │   ├── drop_ball.tscn  # 弹珠场景
│   │   └── peg.tscn        # 钉子场景
│   ├── ui/
│   │   ├── hud.tscn        # HUD 界面
│   │   ├── meta_menu.tscn  # 首页菜单
│   │   └── shop.tscn       # 商店界面
│   └── effects/
│       ├── particle.tscn   # 粒子特效
│       └── laser.tscn      # 激光特效
├── scripts/
│   ├── autoload/
│   │   ├── game_manager.gd # 游戏管理器（单例）
│   │   ├── config.gd       # 配置数据
│   │   └── audio_manager.gd# 音频管理器
│   ├── entities/
│   │   ├── enemy.gd
│   │   ├── projectile.gd
│   │   ├── drop_ball.gd
│   │   └── peg.gd
│   ├── systems/
│   │   ├── combat_system.gd
│   │   ├── spawn_system.gd
│   │   └── phase_manager.gd
│   └── utils/
│       └── calc_utils.gd
├── resources/
│   ├── data/
│   │   ├── relics.tres     # 遗物数据
│   │   └── skills.tres     # 技能数据
│   └── themes/
│       └── game_theme.tres # UI 主题
└── assets/
    ├── sprites/
    ├── audio/
    └── fonts/
```

## 4. 核心映射关系

### 4.1 类映射

| JavaScript 类 | Godot 等效 |
|---------------|------------|
| `Game` | `GameManager` (Autoload 单例) |
| `Vec2` | `Vector2` (内置) |
| `Enemy` | `CharacterBody2D` + `enemy.gd` |
| `Projectile` | `Area2D` + `projectile.gd` |
| `DropBall` | `RigidBody2D` + `drop_ball.gd` |
| `Peg` | `StaticBody2D` + `peg.gd` |
| `Particle` | `GPUParticles2D` |
| `SoundManager` | `AudioManager` (Autoload) |

### 4.2 系统映射

| JavaScript 系统 | Godot 实现方式 |
|-----------------|----------------|
| `requestAnimationFrame` | `_process(delta)` / `_physics_process(delta)` |
| Canvas 2D 绑定 | `CanvasItem._draw()` 或 Sprite2D |
| LocalStorage | `ConfigFile` / `FileAccess` |
| Web Audio API | `AudioStreamPlayer` + `AudioServer` |
| DOM UI | Godot Control 节点 |

## 5. 子任务定义

### 任务 T01: 创建 Godot 项目骨架
- **描述**: 初始化 Godot 4.x 项目，创建目录结构和基础场景
- **输入**: 项目结构设计文档
- **输出**: 可运行的空白 Godot 项目
- **模型**: manus-1.6-lite

### 任务 T02: 迁移配置系统
- **描述**: 将 config.js 转换为 GDScript 资源文件
- **输入**: src/config.js
- **输出**: scripts/autoload/config.gd, resources/data/*.tres
- **模型**: manus-1.6

### 任务 T03: 迁移实体基类
- **描述**: 迁移 Vec2、基础实体类到 GDScript
- **输入**: src/entities.js (前 500 行)
- **输出**: scripts/entities/*.gd 基础类
- **模型**: manus-1.6

### 任务 T04: 迁移敌人系统
- **描述**: 迁移 Enemy 类及其 AI 行为
- **输入**: src/entities.js (Enemy 类部分)
- **输出**: scenes/entities/enemy.tscn, scripts/entities/enemy.gd
- **模型**: manus-1.6-max

### 任务 T05: 迁移弹丸系统
- **描述**: 迁移 Projectile、DropBall 等弹丸类
- **输入**: src/entities.js (弹丸类部分)
- **输出**: scenes/entities/projectile.tscn, drop_ball.tscn 等
- **模型**: manus-1.6

### 任务 T06: 迁移战斗系统
- **描述**: 迁移 combat_system.js 的战斗逻辑
- **输入**: src/combat_system.js
- **输出**: scripts/systems/combat_system.gd
- **模型**: manus-1.6-max

### 任务 T07: 迁移游戏阶段管理
- **描述**: 迁移 game_phase.js 的阶段切换逻辑
- **输入**: src/game_phase.js
- **输出**: scripts/systems/phase_manager.gd
- **模型**: manus-1.6

### 任务 T08: 迁移渲染系统
- **描述**: 将 Canvas 渲染转换为 Godot 2D 渲染
- **输入**: src/render_system.js
- **输出**: 各场景的视觉表现
- **模型**: manus-1.6

### 任务 T09: 迁移 UI 系统
- **描述**: 将 DOM UI 转换为 Godot Control 节点
- **输入**: src/ui_system.js, index.html
- **输出**: scenes/ui/*.tscn
- **模型**: manus-1.6

### 任务 T10: 迁移音频系统
- **描述**: 将 Web Audio API 转换为 Godot 音频系统
- **输入**: src/audio.js
- **输出**: scripts/autoload/audio_manager.gd
- **模型**: manus-1.6-lite

## 6. 验收标准

1. **项目可运行**: Godot 项目能够正常启动
2. **核心循环完整**: 游戏能够完成 meta → selection → gathering → combat 的完整流程
3. **实体行为正确**: 敌人、子弹、弹珠的行为与原版一致
4. **UI 功能完整**: 所有 UI 元素可交互
5. **存档功能正常**: 局外升级数据可正确保存和读取

## 7. 风险与注意事项

1. **物理引擎差异**: Godot 的物理引擎与 Canvas 手写物理有差异，需要调参
2. **性能优化**: 大量粒子和敌人时需要注意性能
3. **音频合成**: Web Audio API 的程序化音效需要在 Godot 中重新实现
4. **UI 适配**: DOM 布局与 Godot Control 布局逻辑不同

---

*此文档由管理者 Agent 自动生成*
