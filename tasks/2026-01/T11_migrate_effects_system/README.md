# 任务说明书：迁移特效系统 (T11)

**任务 ID:** T11
**优先级:** 高
**创建日期:** 2026-01-11
**分支:** `feature/T11-migrate_effects_system`

## 1. 任务描述

将 JavaScript 特效类迁移到 Godot 4.x GDScript。

## 2. 源文件

`src/entities.js`

## 3. 需要迁移的类

| 类名 | 行号范围 | 描述 |
|:---|:---|:---|
| `Particle` | 4610-4822 | 粒子效果 |
| `SlashEffect` | 4823-4897 | 斩击特效 |
| `CollectionBeam` | 4898-4951 | 收集光束 |
| `Shockwave` | 4952-5002 | 冲击波 |
| `LaserBeam` | 5003-5056 | 激光束 |
| `FloatingText` | 5057-5099 | 浮动文字 |
| `EnergyOrb` | 5100-5231 | 能量球 |
| `FireWave` | 5326-5371 | 火焰波 |

**注意:** `LightningBolt` (5232-5325) 已在第一阶段迁移完成，位于 `godot_project/scripts/effects/lightning_bolt.gd`。

## 4. 技术要求

1. 每个特效类创建独立的 `.gd` 文件
2. 使用 Godot 4.x 的 `Node2D` 作为基类
3. 实现 `setup()` 方法初始化特效参数
4. 实现 `_process(delta)` 更新特效状态
5. 特效结束后自动调用 `queue_free()` 销毁自身
6. 使用 Godot 的 `_draw()` 方法替代 Canvas API 绑制

## 5. 输出目录

`godot_project/scripts/effects/`

## 6. 验收标准 (Acceptance Criteria)

- [ ] 所有 8 个特效类均已迁移为独立的 `.gd` 文件
- [ ] 每个脚本无语法错误，可在 Godot 编辑器中正常加载
- [ ] 特效的生命周期（创建、更新、销毁）与原 JS 版本行为一致
- [ ] 代码风格符合 GDScript 规范（snake_case 命名）

## 7. 相关文档

- 原始 JS 代码: `src/entities.js`
- 已迁移的闪电特效参考: `godot_project/scripts/effects/lightning_bolt.gd`
- 架构文档: `docs/architecture/`
