# src/game_phase.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2470 | 函数数: 16 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 4 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| phase_advanceWave | method | L31 | L53 | 23 | `phase_advanceWave()` |
| phase_switchPhase | method | L54 | L84 | 31 | `phase_switchPhase(newPhase)` |
| phase_startGatheringPhase | method | L85 | L118 | 34 | `phase_startGatheringPhase()` |
| phase_gathering_initPachinko | method | L119 | L599 | **481** | `phase_gathering_initPachinko(shouldInherit = false)` |
| phase_startCombatPhase | method | L600 | L687 | 88 | `phase_startCombatPhase()` |
| phase_handleInputStart | method | L688 | L767 | 80 | `phase_handleInputStart(pos)` |
| phase_enemy_processTurn | method | L768 | L885 | 118 | `phase_enemy_processTurn(e)` |
| phase_claimPendingRunes | method | L886 | L937 | 52 | `phase_claimPendingRunes()` |
| phase_enemy_startLogic | method | L938 | L976 | 39 | `phase_enemy_startLogic()` |
| phase_finalizeRound | method | L977 | L1178 | **202** | `phase_finalizeRound()` |
| smartScientific | method | L1179 | L1213 | 35 | `smartScientific(num, fractionDigits = 2)` |
| phase_combat_update | method | L1214 | L1935 | **722** | `phase_combat_update(timeScale)` |
| phase_gathering_attemptComplete | method | L1936 | L2001 | 66 | `phase_gathering_attemptComplete()` |
| phase_gathering_update | method | L2002 | L2398 | **397** | `phase_gathering_update(timeScale = 1)` |
| _updateDropDistribution | method | L2399 | L2427 | 29 | `_updateDropDistribution(entryX)` |
| _drawDropHeatmap | method | L2428 | L2471 | 44 | `_drawDropHeatmap(ctx)` |

## 巨型函数内部节点 (@section 标记)

### phase_gathering_initPachinko (L119-L599, 481行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:pachinko_slot_setup` | L201 | 底部槽位配置与属性分配 |
| `@section:pachinko_inherit_state` | L302 | 继承上局状态（符文/弹珠/加成） |
| `@section:pachinko_special_pegs` | L403 | 特殊钉子生成（布局角色分配） |
| `@section:pachinko_ui_init` | L504 | 弹珠台 UI 初始化与事件绑定 |

### phase_finalizeRound (L977-L1178, 202行)

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### phase_combat_update (L1214-L1935, 722行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:combat_update_entities` | L1293 | 实体批量更新（敌人/子弹/特效） |
| `@section:combat_update_collision` | L1464 | 碰撞检测与伤害结算调度 |
| `@section:combat_update_wave_logic` | L1615 | 波次推进与 Boss 生成判断 |
| `@section:combat_update_ui_sync` | L1766 | 战斗 HUD 同步更新 |
| `@section:combat_update_phase_end` | L1869 | 战斗结束条件检查与阶段切换 |

### phase_gathering_update (L2002-L2398, 397行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:gathering_update_slots` | L2101 | 槽位触发检测与属性收集 |
| `@section:gathering_update_complete` | L2202 | 收集完成判断与结算触发 |
| `@section:gathering_update_ui` | L2303 | 收集阶段 HUD 实时更新 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:pachinko_board_layout` | L118 | 弹珠台布局计算与钉子生成 |
| `@section:combat_update_timescale` | L1213 | 时间缩放与暂停状态检查 |
| `@section:gathering_update_balls` | L2001 | 弹珠物理更新与碰撞处理 |
