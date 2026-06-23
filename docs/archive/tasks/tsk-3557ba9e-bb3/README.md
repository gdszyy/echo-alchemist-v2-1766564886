# 任务结果: tsk-3557ba9e-bb3

**提交时间**: 2026-04-10 15:24

## 结果摘要

实现三因子动态掉落率公式和回合结束自动拾取逻辑：1) combat_system.js 用 FinalDropRate=BaseDropRate×EnemyModifier×OccupancyPenalty 替换固定30%掉落率；2) game_phase.js 在 phase_finalizeRound 中遍历 runeLootItems，转化为 {id,level:1} 对象推入 runeInventory，清空列表；3) 添加金色 FloatingText 视觉反馈

## 交付物

- [`combat_system.js`](deliverables/combat_system.js)
- [`game_phase.js`](deliverables/game_phase.js)
- [`CHANGES.md`](deliverables/CHANGES.md)
