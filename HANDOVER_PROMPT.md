# Echo Alchemist → Godot 4.x 迁移交接文档

## 项目背景

将 **Echo Alchemist** 游戏从 HTML5 Canvas + JavaScript 迁移到 Godot 4.x 引擎。这是一个 Roguelike 弹珠游戏，包含复杂的战斗系统、属性系统、遗物系统等。

## GitHub 仓库

```
gh repo clone gdszyy/echo-alchemist-v2-1766564886
```

仓库结构：
- `src/` - 原始 JavaScript 源代码 (16,666 行)
- `godot_project/` - 已迁移的 Godot 项目 (~3,841 行)
- `docs/` - 项目文档

## 当前迁移状态

### ✅ 已完成模块 (第一阶段)

| 模块 | 文件路径 | 行数 | 状态 |
|------|----------|------|------|
| 战斗系统 | `scripts/systems/combat_system.gd` | 604 | 基础完成 |
| 敌人系统 | `scripts/entities/enemy.gd` | 461 | 完整 |
| 阶段管理 | `scripts/systems/phase_manager.gd` | 385 | 完整 |
| 渲染效果 | `scripts/systems/render_effects.gd` | 279 | 基础完成 |
| 配置系统 | `scripts/autoload/config.gd` | 243 | 基础完成 |
| UI 管理 | `scripts/ui/ui_manager.gd` | 231 | 框架完成 |
| 音频系统 | `scripts/autoload/audio_manager.gd` | 176 | 完整 |
| 弹丸系统 | `scripts/entities/projectile.gd` | 144 | 完整 |
| 弹珠系统 | `scripts/entities/drop_ball.gd` | 131 | 完整 |
| 闪电特效 | `scripts/effects/lightning_bolt.gd` | 123 | 基础完成 |

### ❌ 待迁移模块 (第二阶段)

| 任务ID | 模块 | 源文件 | 优先级 | 描述 |
|--------|------|--------|--------|------|
| T11 | 特效系统 | entities.js | 高 | Particle, Shockwave, LaserBeam, FloatingText 等 9 个特效类 |
| T12 | 飞剑系统 | entities.js | 高 | SwordQi, SlashAnim, SonSword |
| T13 | 生成系统 | spawn_system.js | 高 | 实体生成、对象池 |
| T14 | 命运轮盘 | entities.js | 中 | FortuneWheel 轮盘 UI |
| T15 | 遗物数据库 | config.js | 中 | RELIC_DB (~20 个遗物) |
| T16 | 技能数据库 | config.js | 中 | SKILL_DB |
| T17 | 真理之书 | systems.js | 中 | TruthBook 图鉴系统 |
| T18 | 完整 UI | ui_system.js | 中 | 主菜单、选卡、HUD、商店等 |

## 迁移指南

### Godot 项目结构

```
godot_project/
├── project.godot          # 项目配置
├── scenes/
│   ├── main.tscn          # 主场景
│   ├── game/              # 游戏场景
│   ├── entities/          # 实体场景 (enemy.tscn, projectile.tscn)
│   ├── effects/           # 特效场景
│   └── ui/                # UI 场景
├── scripts/
│   ├── autoload/          # 自动加载单例 (GameManager, Config, AudioManager)
│   ├── entities/          # 实体脚本
│   ├── systems/           # 系统脚本
│   ├── effects/           # 特效脚本
│   ├── ui/                # UI 脚本
│   └── data/              # 数据脚本 (待创建)
└── resources/             # 资源文件 (待添加)
```

### 自动加载配置 (project.godot)

```ini
[autoload]
GameManager="*res://scripts/autoload/game_manager.gd"
Config="*res://scripts/autoload/config.gd"
AudioManager="*res://scripts/autoload/audio_manager.gd"
```

### 迁移注意事项

1. **类名冲突** - 避免使用 Godot 内置类名 (Resource, Node, etc.)
2. **场景文件格式** - `.tscn` 文件的 `ext_resource` 需要正确的 `id` 字段
3. **类型系统** - GDScript 4.x 支持类型注解，但要注意动态类型兼容
4. **信号机制** - 使用 Godot 信号替代 JavaScript 事件
5. **向量运算** - 使用 `Vector2` 替代自定义 `Vec2` 类

### 关键配置参数

```gdscript
# 物理参数
const GRAVITY = 0.30
const FRICTION = 0.99
const ELASTICITY = 0.89
const MARBLE_RADIUS = 7.7
const BULLET_RADIUS = 11

# 游戏参数
const COLS = 10
const ROWS = 6
const SPACING_X = 35
const SPACING_Y = 32
```

## 具体任务 Prompt

### T11: 迁移特效系统

```
将 JavaScript 特效类迁移到 Godot 4.x GDScript。

源文件: src/entities.js
需要迁移的类:
- Particle (粒子效果)
- SlashEffect (斩击特效)
- CollectionBeam (收集光束)
- Shockwave (冲击波)
- LaserBeam (激光束)
- FloatingText (浮动文字)
- EnergyOrb (能量球)
- FireWave (火焰波)

要求:
1. 每个特效类创建独立的 .gd 文件
2. 使用 Godot 4.x 的 Node2D
3. 实现 setup() 方法初始化特效参数
4. 实现 _process() 更新特效状态
5. 特效结束后自动 queue_free()

输出到: godot_project/scripts/effects/
```

### T12: 迁移飞剑系统

```
将 JavaScript 飞剑系统迁移到 Godot 4.x GDScript。

源文件: src/entities.js
需要迁移的类:
- SwordQi (剑气)
- SlashAnim (斩击动画)
- SonSword (子母剑)

飞剑系统特点:
1. 穿透属性升级后变为飞剑
2. 飞剑可以标记敌人
3. 子剑会追踪被标记的敌人

配置参数:
- sonSpeed: 5
- sonTurnSpeed: 0.12
- markDuration: 999999

输出到: godot_project/scripts/systems/ 和 godot_project/scripts/entities/
```

### T13: 迁移生成系统

```
将 JavaScript spawn_system.js 迁移到 Godot 4.x GDScript。

源文件: src/spawn_system.js (955 行)

主要功能:
1. spawn_windSkillParticles - 风属性技能粒子
2. createFloatingText - 浮动文字
3. spawn_createParticle - 通用粒子创建
4. 敌人生成逻辑
5. 钉子生成逻辑
6. 特殊槽位生成

要求:
1. 创建 spawn_system.gd 单例
2. 使用 PackedScene 预加载场景
3. 实现对象池模式

输出到: godot_project/scripts/systems/spawn_system.gd
```

### T14: 迁移命运轮盘

```
将 JavaScript FortuneWheel 类迁移到 Godot 4.x GDScript。

源文件: src/entities.js 中的 FortuneWheel 类

功能:
1. 显示可选属性的轮盘
2. 旋转动画
3. 停止时选中属性翻倍

要求:
1. 创建 fortune_wheel.gd 继承 Control
2. 使用 _draw() 绘制轮盘
3. 使用 Tween 实现平滑动画
4. 发出 wheel_stopped(result) 信号

输出到: godot_project/scripts/ui/fortune_wheel.gd
```

### T15: 迁移遗物数据库

```
将 JavaScript RELIC_DB 迁移到 Godot 4.x GDScript。

源文件: src/config.js 中的 RELIC_DB 数组

遗物数据结构:
- id, name, icon, desc, rarity, effect, unlocks, boost, maxStacks

要求:
1. 创建 relic_database.gd
2. 实现 get_relic_by_id(id)
3. 实现 get_relics_by_rarity(rarity)
4. 实现 get_random_relics(count, exclude)

输出到: godot_project/scripts/data/relic_database.gd
```

### T16: 迁移技能数据库

```
将 JavaScript SKILL_DB 迁移到 Godot 4.x GDScript。

源文件: src/config.js 中的 SKILL_DB 数组

技能数据结构:
- id, methodId, name, icon, desc, cost, cooldown

输出到: godot_project/scripts/data/skill_database.gd
```

### T17: 迁移真理之书

```
将 JavaScript TruthBook 系统迁移到 Godot 4.x GDScript。

源文件: src/systems.js 中的 TruthBook 类和 TRUTH_BOOK_DATA

功能:
1. 敌人图鉴
2. 测试场景
3. 循环演示脚本

输出到: godot_project/scripts/ui/truth_book.gd
```

### T18: 迁移完整 UI 系统

```
将 JavaScript ui_system.js 完整迁移到 Godot 4.x GDScript。

源文件: src/ui_system.js (1180 行)

UI 组件:
1. 主菜单
2. 选卡界面
3. 战斗 HUD
4. 暂停菜单
5. 游戏结束界面
6. 遗物选择界面
7. 商店界面

输出到: godot_project/scripts/ui/ 和 godot_project/scenes/ui/
```

## 验证方法

完成迁移后，在 Godot 中：

1. 打开 `godot_project/project.godot`
2. 按 F5 运行项目
3. 检查控制台是否有错误
4. 测试各个游戏阶段

## 联系方式

如有问题，请参考：
- 原始 JS 代码: `src/` 目录
- 架构文档: `docs/architecture/`
- 已迁移代码: `godot_project/scripts/`
