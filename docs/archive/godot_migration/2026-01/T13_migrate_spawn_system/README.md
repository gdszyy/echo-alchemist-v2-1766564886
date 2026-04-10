# 任务说明书：迁移生成系统 (T13)

**任务 ID:** T13
**优先级:** 高
**创建日期:** 2026-01-11
**分支:** `feature/T13-migrate_spawn_system`

## 1. 任务描述

将 JavaScript 生成系统 (spawn_system.js) 迁移到 Godot 4.x GDScript。

## 2. 源文件

`src/spawn_system.js` (约 955 行)

## 3. 需要迁移的功能

| 函数名 | 行号范围 | 描述 |
|:---|:---|:---|
| `spawn_windSkillParticles` | 20-74 | 风属性技能粒子生成 |
| `spawn_createFloatingText` | 84-86 | 创建浮动文字 |
| `spawn_generateAffixes` | 92-154 | 敌人词缀生成系统 |
| `spawn_spawnEnemyRowAt` | 163-385 | 敌人行生成（导演系统+机会生成器） |
| `spawn_addSkillPoint` | 391-395 | 添加技能点 |
| `spawn_spawnEnemyRow` | 402 | 生成敌人行 |
| `spawn_triggerCloneSpawn` | 408-435 | 触发分身生成 |
| `spawn_smallWhirlwind` | 440-469 | 小旋风特效 |
| `spawn_stormCore` | 475-498 | 风暴核心生成 |
| `spawn_addScore` | 505-521 | 添加分数 |
| `spawn_generateMarbleOptions` | 526-593 | 生成弹珠选项 |
| `spawn_createParticle` | 609-624 | 创建粒子 |
| `spawn_spawnBullet` | 636-794 | 生成弹丸（含飞剑、激光、散射） |
| `spawn_createExplosion` | 803-807 | 创建爆炸 |
| `spawn_createShockwave` | 815-817 | 创建冲击波 |
| `spawn_createHitFeedback` | 827-918 | 创建命中反馈 |
| `spawn_triggerLevelUpEvent` | 925-954 | 触发升级事件 |

## 4. 系统架构

生成系统是游戏的核心系统之一，负责：

1. **敌人生成**：导演系统 + 机会生成器
2. **弹丸生成**：主弹丸、散射、飞剑、激光
3. **特效生成**：粒子、冲击波、浮动文字
4. **词缀系统**：敌人词缀权重池

## 5. 技术要求

1. 使用 Godot 4.x 的 `Node` 或 `RefCounted` 作为基类
2. 使用信号机制替代回调函数
3. 使用 `PackedScene` 预加载实体场景
4. 实现对象池优化性能

## 6. 输出目录

- `godot_project/scripts/systems/spawn_system.gd` - 主生成系统脚本

## 7. 验收标准 (Acceptance Criteria)

- [ ] 敌人生成系统已迁移（导演系统+机会生成器）
- [ ] 弹丸生成系统已迁移（含飞剑、激光、散射）
- [ ] 特效生成系统已迁移
- [ ] 词缀系统已迁移
- [ ] 代码风格符合 GDScript 规范

## 8. 相关文档

- 原始 JS 代码: `src/spawn_system.js`
- 已迁移的特效: `godot_project/scripts/effects/`
- 已迁移的实体: `godot_project/scripts/entities/`
