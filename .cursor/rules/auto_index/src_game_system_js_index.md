# src/game_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1921 | 函数数: 43 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| sys_loop | method | L29 | L164 | 136 | `sys_loop()` |
| sys_resize | method | L165 | L203 | 39 | `sys_resize()` |
| sys_initGameStart | method | L204 | L265 | 62 | `sys_initGameStart()` |
| sys_resetGame | method | L266 | L388 | 123 | `sys_resetGame()` |
| sys_loadSaveData | method | L389 | L415 | 27 | `sys_loadSaveData()` |
| sys_saveData | method | L416 | L427 | 12 | `sys_saveData()` |
| sys_setupInputs | method | L428 | L519 | 92 | `sys_setupInputs()` |
| sys_initSelectionPhase | method | L521 | L570 | 50 | `sys_initSelectionPhase()` |
| sys_initReplaceAmmoPhase | method | L572 | L600 | 29 | `sys_initReplaceAmmoPhase()` |
| sys_confirmReplaceAmmo | method | L601 | L639 | 39 | `sys_confirmReplaceAmmo()` |
| sys_skipReplaceAmmo | method | L640 | L662 | 23 | `sys_skipReplaceAmmo()` |
| _proceedToFateMomentSelection | method | L663 | L703 | 41 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L702 | L751 | 50 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L752 | L791 | 40 | `sys_queueRoundStartReward(reward = {})` |
| sys_preCalcEnemyRewardType | method | L803 | L825 | 23 | `sys_preCalcEnemyRewardType(enemy)` |
| sys_tryQueueEnemyRoundReward | method | L833 | L905 | 73 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L911 | L996 | 86 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L985 | L996 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L997 | L1101 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1102 | L1137 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1138 | L1151 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1152 | L1161 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1162 | L1170 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1171 | L1183 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1184 | L1191 | 8 | `triggerScreenShake(amount)` |
| drawWindTunnelFlow | method | L1192 | L1220 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1221 | L1233 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1234 | L1244 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1245 | L1255 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1256 | L1267 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1268 | L1289 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1290 | L1304 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1305 | L1353 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1354 | L1397 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1398 | L1428 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1429 | L1447 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1448 | L1521 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1522 | L1666 | 145 | `sys_saveRunState()` |
| sys_clearRunState | method | L1667 | L1676 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1677 | L1685 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1686 | L1865 | 180 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1866 | L1891 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1892 | L1921 | 30 | `_calcDesperationMult()` |
