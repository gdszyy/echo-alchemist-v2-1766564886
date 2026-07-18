# src\game_system.js 函数索引

> 自动生成于 2026-07-18 | 总行数: 4599 | 函数数: 89 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 5 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| _encodeRoundBoostMap | function | `_encodeRoundBoostMap(source)` |  |
| _decodeRoundBoostMap | function | `_decodeRoundBoostMap(source)` |  |
| _isValidRoundBoostMap | function | `_isValidRoundBoostMap(source)` |  |
| _getRoundStartBossThreat | function | `_getRoundStartBossThreat(game)` |  |
| sys_captureLifecycleToken | method | `sys_captureLifecycleToken(options = {})` |  |
| sys_isLifecycleTokenCurrent | method | `sys_isLifecycleTokenCurrent(token)` |  |
| sys_scheduleLifecycleTimeout | method | `sys_scheduleLifecycleTimeout(callback, delayMs = 0, options = {})` |  |
| sys_scheduleLifecycleFrame | method | `sys_scheduleLifecycleFrame(callback, options = {})` |  |
| sys_cancelLifecycleTimeout | method | `sys_cancelLifecycleTimeout(timeoutId)` |  |
| sys_runOrDeferLifecycleContinuation | method | `sys_runOrDeferLifecycleContinuation(key, callback, options = {})` |  |
| cancel | function | `cancel()` |  |
| sys_flushDeferredLifecycleContinuations | method | `sys_flushDeferredLifecycleContinuations()` |  |
| sys_invalidateRunLifecycle | method | `sys_invalidateRunLifecycle(reason = 'reset')` |  |
| sys_acquirePauseLease | method | `sys_acquirePauseLease(ownerId)` |  |
| sys_releasePauseLease | method | `sys_releasePauseLease(token)` |  |
| sys_hasPendingPotionAlchemyDraft | method | `sys_hasPendingPotionAlchemyDraft()` |  |
| sys_deferPotionBlockedContinuation | method | `sys_deferPotionBlockedContinuation(key, callback, options = {})` |  |
| sys_retryPotionBlockedContinuation | method | `sys_retryPotionBlockedContinuation()` |  |
| sys_loop | method | `sys_loop()` |  |
| sys_setupVisibilityHandling | method | `sys_setupVisibilityHandling()` |  |
| sys_resize | method | `sys_resize()` |  |
| sys_getCombatBounds | method | `sys_getCombatBounds()` |  |
| sys_getCombatColumnCenterX | method | `sys_getCombatColumnCenterX(col, spanCols = 1)` |  |
| sys_initGameStart | method | `sys_initGameStart()` |  |
| sys_resetGame | method | `sys_resetGame()` | ⚠️ 巨型函数，见 @section 导航 |
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
| sys_completeRoundStartReward | method | `sys_completeRoundStartReward(rewardId)` |  |
| sys_rollMarblePackTypes | method | `sys_rollMarblePackTypes(packId = 'mixed', count = CONFIG.gameplay.selectionReq || 3)` |  |
| sys_startMarblePackGrind | method | `sys_startMarblePackGrind(reward = {})` |  |
| sys_grantRunResourcePack | method | `sys_grantRunResourcePack(reward = {})` |  |
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
| sys_startRoundStartResolver | method | `sys_startRoundStartResolver()` | ⚠️ 巨型函数，见 @section 导航 |
| sys_continueRoundStartResolver | method | `sys_continueRoundStartResolver(rewardId = null)` |  |
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
| input_getEventIdentity | method | `input_getEventIdentity(e)` |  |
| input_isMatchingActiveInteraction | method | `input_isMatchingActiveInteraction(e)` |  |
| input_finishActiveInteraction | method | `input_finishActiveInteraction(pos, e, options = {})` |  |
| input_cancelActiveInteraction | method | `input_cancelActiveInteraction(e, options = {})` |  |
| input_handleInputStart | method | `input_handleInputStart(pos, e)` |  |
| input_handleInputMove | method | `input_handleInputMove(pos, e)` |  |
| input_handleInputEnd | method | `input_handleInputEnd(pos, e)` |  |
| input_handleInputCancel | method | `input_handleInputCancel(e)` |  |
| input_checkDefeat | method | `input_checkDefeat()` |  |
| _triggerPityDrop | method | `_triggerPityDrop(bossEnemy)` |  |
| sys_getRunSavePoint | method | `sys_getRunSavePoint()` |  |
| sys_resumeCombatCheckpoint | method | `sys_resumeCombatCheckpoint()` |  |
| sys_validateRunStatePayload | method | `sys_validateRunStatePayload(state)` |  |
| sys_getRunStateSummary | method | `sys_getRunStateSummary(options = {})` |  |
| sys_saveRunState | method | `sys_saveRunState()` | ⚠️ 巨型函数，见 @section 导航 |
| sys_clearRunState | method | `sys_clearRunState()` |  |
| sys_hasRunState | method | `sys_hasRunState()` |  |
| sys_loadRunState | method | `sys_loadRunState()` | ⚠️ 巨型函数，见 @section 导航 |
| input_checkEnemyHover | method | `input_checkEnemyHover(pos)` |  |
| _calcDesperationMult | method | `_calcDesperationMult()` |  |

## 巨型函数内部节点 (@section 标记)

### sys_resetGame

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:reset_lifecycle_pause` | 生命周期与暂停清理 |
| `@section:reset_run_progression` | 局内进度与选择态重置 |
| `@section:reset_runtime_entities` | 实体与运行态清空 |
| `@section:reset_rune_skill_state` | 符文技能状态重置 |
| `@section:reset_boss_difficulty` | Boss与难度状态重置 |
| `@section:reset_stats_modules_shop` | 统计模块与商店重置 |

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

### sys_startRoundStartResolver

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:resolver_preflight` | 重入守卫与队列清理 |
| `@section:resolver_terminal_route` | 空队列终点与横幅 |
| `@section:resolver_reward_identity` | 奖励身份与进度上下文 |
| `@section:resolver_atomic_commit` | 生命周期守卫与原子消费 |
| `@section:resolver_reward_animation` | 奖励动画与延迟续接 |
| `@section:resolver_reward_routes` | 各奖励类型提交路由 |

### sys_saveRunState

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:save_checkpoint_guard` | 安全点与恢复写守卫 |
| `@section:save_enemy_snapshot` | 敌人与碰撞状态快照 |
| `@section:save_board_snapshot` | 确定性钉盘几何快照 |
| `@section:save_queue_snapshot` | 弹珠与弹药队列快照 |
| `@section:save_state_payload` | 版本化运行态载荷 |
| `@section:save_atomic_commit` | 原子写入与结果反馈 |

### sys_loadRunState

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:load_preflight_reset` | 校验与安全重置 |
| `@section:load_core_progression` | 基础遗物符文选择态 |
| `@section:load_reward_director` | 奖励队列与导演状态 |
| `@section:load_modules_economy` | 模块商店技能与统计 |
| `@section:load_enemy_hydration` | 敌人与碰撞对象重建 |
| `@section:load_board_hydration` | 弹珠与确定性钉盘重建 |
| `@section:load_resume_route` | 安全点分流与界面恢复 |
| `@section:load_failure_recovery` | 失败后二次重置清档 |
