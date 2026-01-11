# 任务说明书：迁移遗物数据库 (T15)

**任务 ID:** T15
**优先级:** 中
**创建日期:** 2026-01-11
**分支:** `feature/T15-migrate_relic_database`

## 1. 任务描述

将 JavaScript 遗物数据库 (RELIC_DB) 迁移到 Godot 4.x GDScript。

## 2. 源文件

`src/config.js` (537-593 行)

## 3. 遗物列表

| ID | 名称 | 稀有度 | 效果 |
|:---|:---|:---|:---|
| gigantism_relic | 倍化之术 | rare | 永久提升弹珠体积 |
| fortune_wheel_relic | 命運輪盤 | legendary | 解锁轮盘槽 |
| dimension_shard | 維度碎片 | rare | 钉板高度延伸+2行 |
| stars_shines | 群星闪烁 | rare | 解锁回响弹珠 |
| optical_lens | 聚焦透鏡 | legendary | 解锁光球 |
| pink_slime | 粉紅凝膠 | common | 出现3个粉色钉子 |
| energy_shield | 力場護盾 | cursed | 底部边界反弹 |
| unlock_recall | 時光沙漏 | rare | 解锁回溯槽 |
| unlock_multicast | 雙子魔鏡 | rare | 解锁连射槽 |
| unlock_split | 裂變核心 | rare | 解锁分裂槽 |
| slot_expander | 空間鑿子 | common | 特殊槽+1 |
| cryo_stone | 永恆凍土 | rare | 解锁冰霜属性 |
| pyro_stone | 不滅火種 | rare | 解锁火焰属性 |
| tactical_kit (pierce) | 穿透補給 | common | 解锁穿透属性 |
| tactical_kit (scatter) | 散射補給 | common | 解锁散射属性 |
| tactical_kit (damage) | 增幅補給 | common | 解锁增幅属性 |
| explosive_ammo | 高爆火藥 | rare | 解锁爆破弹珠 |
| prism_shard | 七彩稜鏡 | legendary | 解锁彩虹弹珠 |
| russian_doll | 俄羅斯套娃 | legendary | 解锁套娃弹珠 |

## 4. 数据结构

```gdscript
var relic = {
    "id": String,           # 唯一标识符
    "name": String,         # 显示名称
    "icon": String,         # 图标 emoji
    "desc": String,         # 描述文本
    "rarity": String,       # 稀有度: common/rare/legendary/cursed
    "effect": String,       # 效果类型（可选）
    "unlocks": Variant,     # 解锁内容（可选）
    "boost": int,           # 权重提升（可选）
    "max_stacks": int,      # 最大叠加数
    "slot_type": String     # 槽位类型（可选）
}
```

## 5. 技术要求

1. 使用 Godot 4.x 的 `Resource` 或静态字典
2. 提供遗物查询和过滤方法
3. 支持按稀有度筛选
4. 支持按效果类型筛选

## 6. 输出目录

- `godot_project/scripts/data/relic_database.gd` - 遗物数据库脚本

## 7. 验收标准 (Acceptance Criteria)

- [ ] 所有遗物数据已迁移
- [ ] 提供按 ID 查询方法
- [ ] 提供按稀有度筛选方法
- [ ] 代码风格符合 GDScript 规范

## 8. 相关文档

- 原始 JS 代码: `src/config.js` (537-593 行)
