# src\game_phase.js 函数索引

> 自动生成于 2026-06-22 | 总行数: 4133 | 函数数: 38 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 4 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| getCombatAimEnemyHit | function | `getCombatAimEnemyHit(game, start, dir, maxDist, radius)` |  |
| buildCombatAimGuide | function | `buildCombatAimGuide(game, start, dir, bounceCount = 3, options = {})` |  |
| buildCombatAimGuides | function | `buildCombatAimGuides(game, start, dir, recipe)` |  |
| buildCombatAimScatterOffsets | function | `buildCombatAimScatterOffsets(game, recipe)` |  |
| drawModuleFootprintOutline | function | `drawModuleFootprintOutline(ctx, rect, footprint, color, pulse = 0)` |  |
| pickBottomRewardType | function | `pickBottomRewardType(game)` |  |
| makeBottomRewardBarrier | function | `makeBottomRewardBarrier(x, y1, y2, rewardType)` |  |
| buildBottomRewardZones | function | `buildBottomRewardZones(game, maxPegY, canvasWidth, canvasHeight)` |  |
| drawBottomRewardZones | function | `drawBottomRewardZones(ctx, zones)` |  |
| buildFallbackMarbleQueue | function | `buildFallbackMarbleQueue(game)` |  |
| phase_advanceWave | method | `phase_advanceWave()` |  |
| phase_switchPhase | method | `phase_switchPhase(newPhase)` |  |
| phase_startGatheringPhase | method | `phase_startGatheringPhase()` |  |
| phase_gathering_initPachinko_v2 | method | `phase_gathering_initPachinko_v2(shouldInherit = false)` |  |
| phase_gathering_initPachinko | method | `phase_gathering_initPachinko(shouldInherit = false)` |  |
| render_moduleEditorOverlay | method | `render_moduleEditorOverlay()` |  |
| phase_gathering_initPachinko_legacy | method | `phase_gathering_initPachinko_legacy(shouldInherit = false)` | ⚠️ 巨型函数，见 @section 导航 |
| phase_gathering_getRandomPegType | method | `phase_gathering_getRandomPegType()` |  |
| phase_startCombatPhase | method | `phase_startCombatPhase()` |  |
| phase_gathering_createSession | method | `phase_gathering_createSession(marbleDef, marbleIndex)` |  |
| phase_gathering_launchMarbleBatch | method | `phase_gathering_launchMarbleBatch(pos)` |  |
| phase_handleInputStart | method | `phase_handleInputStart(pos)` |  |
| phase_enemy_processTurn | method | `phase_enemy_processTurn(e)` | ⚠️ 巨型函数，见 @section 导航 |
| phase_claimPendingRunes | method | `phase_claimPendingRunes()` |  |
| phase_inWallClearTrigger | method | `phase_inWallClearTrigger()` |  |
| phase_enemy_startLogic | method | `phase_enemy_startLogic()` |  |
| phase_finalizeRound | method | `phase_finalizeRound()` |  |
| phase_continueFinalizeRoundAfterRelicHooks | method | `phase_continueFinalizeRoundAfterRelicHooks()` |  |
| phase_playChargeUpgradeFX | method | `phase_playChargeUpgradeFX(leftoverCount = 1)` |  |
| smartScientific | method | `smartScientific(num, fractionDigits = 2)` |  |
| phase_queueGreedyWheelPrelude | method | `phase_queueGreedyWheelPrelude(shot, spawnX, spawnY)` |  |
| phase_handleGreedyWheelQueueEvent | method | `phase_handleGreedyWheelQueueEvent(shot)` |  |
| phase_combat_update | method | `phase_combat_update(timeScale)` | ⚠️ 巨型函数，见 @section 导航 |
| phase_gathering_attemptComplete | method | `phase_gathering_attemptComplete()` |  |
| phase_gathering_update | method | `phase_gathering_update(timeScale = 1)` | ⚠️ 巨型函数，见 @section 导航 |
| _updateDropDistribution | method | `_updateDropDistribution(entryX)` |  |
| _drawDropHeatmap | method | `_drawDropHeatmap(ctx)` |  |
| phase_isEnemyClearable | method | `phase_isEnemyClearable(e)` |  |

## 巨型函数内部节点 (@section 标记)

### phase_gathering_initPachinko_legacy

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:pachinko_slot_setup` | 底部槽位配置与属性分配 |
| `@section:pachinko_inherit_state` | 继承上局状态（符文/弹珠/加成） |
| `@section:pachinko_special_pegs` | 特殊钉子生成（布局角色分配） |
| `@section:pachinko_ui_init` | 弹珠台 UI 初始化与事件绑定 |

### phase_enemy_processTurn

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### phase_combat_update

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:combat_update_entities` | 实体批量更新（敌人/子弹/特效） |
| `@section:combat_update_collision` | 碰撞检测与伤害结算调度 |
| `@section:combat_update_wave_logic` | 波次推进与 Boss 生成判断 |
| `@section:combat_update_ui_sync` | 战斗 HUD 同步更新 |
| `@section:combat_update_phase_end` | 战斗结束条件检查与阶段切换 |

### phase_gathering_update

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:gathering_update_slots` | 槽位触发检测与属性收集 |
| `@section:gathering_update_complete` | 收集完成判断与结算触发 |
| `@section:gathering_update_ui` | 收集阶段 HUD 实时更新 |


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:pachinko_board_layout` | 弹珠台布局计算与钉子生成 |
| `@section:combat_update_timescale` | 时间缩放与暂停状态检查 |
| `@section:gathering_update_balls` | 弹珠物理更新与碰撞处理 |
