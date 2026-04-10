# 任务说明书：迁移技能数据库 (T16)

**任务 ID:** T16
**优先级:** 中
**创建日期:** 2026-01-11
**分支:** `feature/T16-migrate_skill_database`

## 1. 任务描述

将 JavaScript 技能数据库 (SKILL_DB) 迁移到 Godot 4.x GDScript。

## 2. 源文件

`src/config.js` (597-673 行)

## 3. 技能列表

| ID | 名称 | 消耗 | 效果 |
|:---|:---|:---|:---|
| repulsion | 重力反轉 | 2 | 将敌人向上推回2行 |
| storm | 以太風暴 | 3 | 全屏闪电链攻击 |
| enhance_normal | 賢者充能 | 2 | 强化下一发子弹 |
| enhance_laser | 光之充能 | 1 | 转化为高能激光 |

## 4. 数据结构

```gdscript
var skill = {
    "id": String,           # 唯一标识符
    "method_id": String,    # 逻辑方法ID
    "name": String,         # 显示名称
    "icon": String,         # 图标 emoji
    "cost": int,            # 技能点消耗
    "color": Color,         # 技能颜色
    "desc": String,         # 描述文本
    "params": Dictionary    # 技能参数
}
```

## 5. 技术要求

1. 使用 Godot 4.x 的 `Resource` 或静态字典
2. 提供技能查询方法
3. 支持技能参数配置

## 6. 输出目录

- `godot_project/scripts/data/skill_database.gd` - 技能数据库脚本

## 7. 验收标准 (Acceptance Criteria)

- [ ] 所有技能数据已迁移
- [ ] 提供按 ID 查询方法
- [ ] 技能参数完整迁移
- [ ] 代码风格符合 GDScript 规范

## 8. 相关文档

- 原始 JS 代码: `src/config.js` (597-673 行)
