# src\game_system.js 函数索引

> 自动生成于 2026-06-22 | 总行数: 3199 | 函数数: 58 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| sys_loop | method | `sys_loop()` |  |
| sys_setupVisibilityHandling | method | `sys_setupVisibilityHandling()` |  |
| sys_resize | method | `sys_resize()` |  |
| sys_getCombatBounds | method | `sys_getCombatBounds()` |  |
| sys_getCombatColumnCenterX | method | `sys_getCombatColumnCenterX(col, spanCols = 1)` |  |
| sys_initGameStart | method | `sys_initGameStart()` |  |
| sys_resetGame | method | `sys_resetGame()` |  |
| sys_loadSaveData | method | `sys_loadSaveData()` |  |
| sys_saveData | method | `sys_saveData()` |  |
| sys_setPerfQuality | method | `sys_setPerfQuality(level)` |  |
| sys_setupInputs | method | `sys_setupInputs()` |  |
| sys_initSelectionPhase | method | `sys_initSelectionPhase()` |  |
| sys_initReplaceAmmoPhase | method | `sys_initReplaceAmmoPhase()` |  |
| sys_confirmReplaceAmmo | method | `sys_confirmReplaceAmmo()` |  |
| sys_skipReplaceAmmo | method | `sys_skipReplaceAmmo()` |  |
| _proceedToFateMomentSelection | method | `_proceedToFateMomentSelection()` |  |
| sys_skipGrindGetRune | method | `sys_skipGrindGetRune()` |  |
| sys_skipChaosEssenceUpgrade | method | `sys_skipChaosEssenceUpgrade()` |  |
| sys_runInWallClearLottery | method | `sys_runInWallClearLottery(chargedSnapshot, bonusCount = 0, onComplete)` |  |
| sys_queueRoundStartReward | method | `sys_queueRoundStartReward(reward = {})` |  |
| sys_determineEnemyReward | method | `sys_determineEnemyReward(enemy, isRowRepresentative = false)` | ⚠️ 巨型函数，见 @section 导航 |
| sys_preCalcEnemyRewardType | method | `sys_preCalcEnemyRewardType(enemy)` |  |
| sys_tryQueueEnemyRoundReward | method | `sys_tryQueueEnemyRoundReward(enemy)` |  |
| sys_initRunShopSchedule | method | `sys_initRunShopSchedule()` |  |
| sys_rollNextRunShopRound | method | `sys_rollNextRunShopRound(fromRound = this.round || 1)` |  |
| sys_activateRunShopVisit | method | `sys_activateRunShopVisit(round = this.round || 1)` |  |
| sys_updateRunShopScheduleForRound | method | `sys_updateRunShopScheduleForRound()` |  |
| sys_isRunShopActive | method | `sys_isRunShopActive()` |  |
| sys_getRunShopScheduleState | method | `sys_getRunShopScheduleState()` |  |
| sys_maybeOfferRunShopBeforeRoundStart | method | `sys_maybeOfferRunShopBeforeRoundStart()` |  |
| sys_startRoundStartResolver | method | `sys_startRoundStartResolver()` |  |
| sys_continueRoundStartResolver | method | `sys_continueRoundStartResolver()` |  |
| sys_showRoundStartBanner | method | `sys_showRoundStartBanner()` |  |
| sys_toggleMarbleSelection | method | `sys_toggleMarbleSelection(idx, cardEl)` |  |
| sys_resetMultiplier | method | `sys_resetMultiplier()` |  |
| sys_initRecipeHUD | method | `sys_initRecipeHUD()` |  |
| sys_toggleHud | method | `sys_toggleHud()` |  |
| data_clearProjectiles | method | `data_clearProjectiles()` |  |
| triggerScreenShake | method | `triggerScreenShake(amount)` |  |
| triggerScreenShakeAdvanced | method | `triggerScreenShakeAdvanced(amplitude, duration)` |  |
| drawWindTunnelFlow | method | `drawWindTunnelFlow(rect, isHorizontal)` |  |
| checkLineIntersection | method | `checkLineIntersection(a, b, c, d)` |  |
| isBowtieShape | method | `isBowtieShape(anchors)` |  |
| getLineIntersectionPoint | method | `getLineIntersectionPoint(a, b, c, d)` |  |
| input_getTiltOffset | method | `input_getTiltOffset()` |  |
| input_handleOrientation | method | `input_handleOrientation(e)` |  |
| _isRuneLauncherOpen | method | `_isRuneLauncherOpen()` |  |
| input_handleInputStart | method | `input_handleInputStart(pos, e)` |  |
| input_handleInputMove | method | `input_handleInputMove(pos, e)` |  |
| input_handleInputEnd | method | `input_handleInputEnd(pos, e)` |  |
| input_checkDefeat | method | `input_checkDefeat()` |  |
| _triggerPityDrop | method | `_triggerPityDrop(bossEnemy)` |  |
| sys_saveRunState | method | `sys_saveRunState()` |  |
| sys_clearRunState | method | `sys_clearRunState()` |  |
| sys_hasRunState | method | `sys_hasRunState()` |  |
| sys_loadRunState | method | `sys_loadRunState()` | ⚠️ 巨型函数，见 @section 导航 |
| input_checkEnemyHover | method | `input_checkEnemyHover(pos)` |  |
| _calcDesperationMult | method | `_calcDesperationMult()` |  |

## 巨型函数内部节点 (@section 标记)

### sys_determineEnemyReward

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:field_reward_density` | 第一步：统计场上奖励数量，达硬上限时直接返回 |
| `@section:power_pressure_eval` | 第二步：计算玩家战力比和踪迹血量，评估生存压力 |
| `@section:emergency_relief` | 第三步：生存压力超阈时强制标记遗物线索（紧急救援） |
| `@section:base_drop_chance` | 第四步：基础概率 = 基础值 + 回合加成 + 词缀加成 |
| `@section:dynamic_multiplier` | 第五步：战力/血量/密度四维动态倍率修正 |
| `@section:pity_guarantee` | 第六步：三回合平均伤害 vs 威胁HP保底判定（V3算法） |
| `@section:final_reward_type` | 第七步：随机判定奖励类型（遗物线索） |

### sys_loadRunState

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。
