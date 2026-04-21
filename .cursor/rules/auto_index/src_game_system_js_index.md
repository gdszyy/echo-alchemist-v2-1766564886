# src/game_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1956 | 函数数: 43 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

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
| sys_confirmReplaceAmmo | method | L601 | L650 | 50 | `sys_confirmReplaceAmmo()` |
| sys_skipReplaceAmmo | method | L651 | L684 | 34 | `sys_skipReplaceAmmo()` |
| _proceedToFateMomentSelection | method | L685 | L732 | 48 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L733 | L782 | 50 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L783 | L824 | 42 | `sys_queueRoundStartReward(reward = {})` |
| sys_preCalcEnemyRewardType | method | L825 | L854 | 30 | `sys_preCalcEnemyRewardType(enemy)` |
| sys_tryQueueEnemyRoundReward | method | L855 | L932 | 78 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L933 | L1023 | 91 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L1024 | L1035 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L1036 | L1140 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1141 | L1176 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1177 | L1190 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1191 | L1200 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1201 | L1209 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1210 | L1222 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1223 | L1230 | 8 | `triggerScreenShake(amount)` |
| drawWindTunnelFlow | method | L1231 | L1259 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1260 | L1272 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1273 | L1283 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1284 | L1294 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1295 | L1306 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1307 | L1328 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1329 | L1343 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1344 | L1392 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1393 | L1436 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1437 | L1467 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1468 | L1486 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1487 | L1560 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1561 | L1705 | 145 | `sys_saveRunState()` |
| sys_clearRunState | method | L1706 | L1715 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1716 | L1724 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1725 | L1904 | 180 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1905 | L1930 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1931 | L1957 | 27 | `_calcDesperationMult()` |
