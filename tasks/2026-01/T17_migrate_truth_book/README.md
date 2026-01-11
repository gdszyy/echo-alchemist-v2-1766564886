# 任务说明书：迁移真理之书系统 (T17)

**任务 ID:** T17
**优先级:** 中（最后处理，原代码有问题）
**创建日期:** 2026-01-11
**分支:** `feature/T17-migrate_truth_book`

## 1. 任务描述

将 JavaScript 真理之书系统 (TruthBook) 和试炼场系统 (TrainingGround) 迁移到 Godot 4.x GDScript。

**注意：** 用户指出原代码存在问题，需要在迁移过程中进行修复和重构。

## 2. 源文件

`src/systems.js` 中的以下部分：
- `TRUTH_BOOK_DATA` (行 20-368): 真理之书数据配置
- `TrainingGround` (行 644-1101): 试炼场类
- `TruthBook` (行 1106-1479): 真理之书类

## 3. 需要迁移的功能模块

### 3.1 真理之书数据 (TRUTH_BOOK_DATA)

| 数据类型 | 数量 | 描述 |
|:---|:---|:---|
| `enemies` | 9 | 敌人词条演示配置（普通、护盾、再生、分身等） |
| `attributes` | 11 | 属性演示配置（弹射、穿透、散射、冰火雷等） |

### 3.2 试炼场 (TrainingGround)

| 功能 | 描述 |
|:---|:---|
| 子弹编辑器 | 可调整伤害、弹射、穿透、散射、元素属性等 |
| 敌人配置 | 可设置血量、词缀 |
| 实时DPS统计 | 显示总伤害和每秒伤害 |
| 发射测试 | 从底部发射配置好的子弹 |

### 3.3 真理之书 (TruthBook)

| 功能 | 描述 |
|:---|:---|
| 条目列表 | 敌人和属性的可点击列表 |
| 详情面板 | 显示图标、名称、描述、标签 |
| 演示模拟器 | 独立的 Canvas 演示区域 |
| 脚本执行 | 按 loop 配置执行演示脚本 |

## 4. 已知问题（需修复）

1. **Mock Game 上下文问题**：演示模拟器中的 `demoGame` 对象需要正确模拟主游戏的所有方法
2. **闪电链递归**：可能导致性能问题或无限循环
3. **Canvas 缩放**：在不同分辨率下可能显示异常
4. **UI 耦合**：大量 DOM 操作与游戏逻辑混合

## 5. 技术要求

1. 使用 Godot 4.x 的 `Control` 节点作为UI基类
2. 使用 `SubViewport` 实现独立的演示区域
3. 使用 `Resource` 存储真理之书数据
4. 使用信号机制解耦UI和逻辑

## 6. 输出目录

- `godot_project/scripts/systems/truth_book.gd` - 真理之书主系统
- `godot_project/scripts/systems/training_ground.gd` - 试炼场系统
- `godot_project/scripts/data/truth_book_data.gd` - 真理之书数据

## 7. 验收标准 (Acceptance Criteria)

- [ ] 真理之书数据已迁移
- [ ] 试炼场子弹编辑器已迁移
- [ ] 试炼场敌人配置已迁移
- [ ] 真理之书条目列表已迁移
- [ ] 演示模拟器已迁移
- [ ] 已知问题已修复
- [ ] 代码风格符合 GDScript 规范

## 8. 相关文档

- 原始 JS 代码: `src/systems.js`
