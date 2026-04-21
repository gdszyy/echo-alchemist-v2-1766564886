# src/game_system.js 函数索引

> 自动生成于 2026-04-21 | 总行数: 1970 | 函数数: 44 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**
> [2026-04-21 手动更新] 新增 triggerScreenShakeAdvanced；sys_loop 新增高频持续震动消费逻辑

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| sys_loop | method | L29 | L164 | 136 | `sys_loop()` |
| sys_resize | method | L165 | L203 | 39 | `sys_resize()` |
| sys_initGameStart | method | L204 | L265 | 62 | `sys_initGameStart()` |
| sys_resetGame | method | L266 | L389 | 124 | `sys_resetGame()` |
| sys_loadSaveData | method | L390 | L416 | 27 | `sys_loadSaveData()` |
| sys_saveData | method | L417 | L428 | 12 | `sys_saveData()` |
| sys_setupInputs | method | L429 | L520 | 92 | `sys_setupInputs()` |
| sys_initSelectionPhase | method | L521 | L571 | 51 | `sys_initSelectionPhase()` |
| sys_initReplaceAmmoPhase | method | L572 | L600 | 29 | `sys_initReplaceAmmoPhase()` |
| sys_confirmReplaceAmmo | method | L601 | L646 | 46 | `sys_confirmReplaceAmmo()` |
| sys_skipReplaceAmmo | method | L647 | L676 | 30 | `sys_skipReplaceAmmo()` |
| _proceedToFateMomentSelection | method | L677 | L724 | 48 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L725 | L774 | 50 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L775 | L816 | 42 | `sys_queueRoundStartReward(reward = {})` |
| sys_preCalcEnemyRewardType | method | L817 | L846 | 30 | `sys_preCalcEnemyRewardType(enemy)` |
| sys_tryQueueEnemyRoundReward | method | L847 | L924 | 78 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L925 | L1015 | 91 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L1016 | L1027 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L1028 | L1132 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1133 | L1168 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1169 | L1182 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1183 | L1192 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1193 | L1201 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1202 | L1214 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1225 | L1228 | 4 | `triggerScreenShake(amount)` |
| triggerScreenShakeAdvanced | method | L1237 | L1241 | 5 | `triggerScreenShakeAdvanced(amplitude, duration)` |
| drawWindTunnelFlow | method | L1243 | L1271 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1252 | L1264 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1265 | L1275 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1276 | L1286 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1287 | L1298 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1299 | L1320 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1321 | L1335 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1336 | L1384 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1385 | L1428 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1429 | L1459 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1460 | L1478 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1479 | L1552 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1553 | L1697 | 145 | `sys_saveRunState()` |
| sys_clearRunState | method | L1698 | L1707 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1716 | L1724 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1717 | L1896 | 180 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1897 | L1922 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1923 | L1949 | 27 | `_calcDesperationMult()` |
