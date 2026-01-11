# 任务说明书：迁移飞剑系统 (T12)

**任务 ID:** T12
**优先级:** 高
**创建日期:** 2026-01-11
**分支:** `feature/T12-migrate_sword_system`

## 1. 任务描述

将 JavaScript 飞剑系统迁移到 Godot 4.x GDScript。

## 2. 源文件

`src/entities.js`

## 3. 需要迁移的类

| 类名 | 行号范围 | 描述 |
|:---|:---|:---|
| `SwordQi` | 3263-3315 | 剑气 - 快速穿透的月牙形剑气 |
| `SlashAnim` | 3319-3354 | 斩击动画 - 梭形光效 |
| `SonSword` | 3372-3822 | 子母剑 - 追踪、冲刺、插入敌人的飞剑 |

## 4. 飞剑系统特点

1. **穿透属性升级后变为飞剑**
2. **飞剑可以标记敌人**
3. **子剑会追踪被标记的敌人**
4. **支持多段攻击和回收**

## 5. 配置参数

```gdscript
# 飞剑配置
const SON_SPEED = 12.0
const SON_TURN_SPEED = 0.12
const MARK_DURATION = 999999
const DASH_SPEED = 22.0
```

## 6. 技术要求

1. 使用 Godot 4.x 的 `Node2D` 作为基类
2. 实现 `setup()` 方法初始化飞剑参数
3. 实现 `_process(delta)` 更新飞剑状态和追踪逻辑
4. 实现 `_draw()` 绘制飞剑外观和拖尾
5. 使用信号机制处理命中事件
6. 实现状态机：flying -> stuck -> recalling

## 7. 输出目录

- `godot_project/scripts/entities/` - 飞剑实体脚本
- `godot_project/scripts/effects/` - 斩击动画脚本（如需要）

## 8. 验收标准 (Acceptance Criteria)

- [ ] SwordQi 剑气类已迁移，支持穿透和标记
- [ ] SlashAnim 斩击动画已迁移
- [ ] SonSword 子母剑已迁移，支持追踪、冲刺、插入状态
- [ ] 飞剑拖尾效果正常显示
- [ ] 代码风格符合 GDScript 规范

## 9. 相关文档

- 原始 JS 代码: `src/entities.js` (3263-3822 行)
- 已迁移的特效参考: `godot_project/scripts/effects/`
