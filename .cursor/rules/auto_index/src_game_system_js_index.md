# src/game_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 1788 | 函数数: 42 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| sys_loop | method | L29 | L164 | 136 | `sys_loop()` |
| sys_resize | method | L165 | L203 | 39 | `sys_resize()` |
| sys_initGameStart | method | L204 | L265 | 62 | `sys_initGameStart()` |
| sys_resetGame | method | L266 | L385 | 120 | `sys_resetGame()` |
| sys_loadSaveData | method | L386 | L412 | 27 | `sys_loadSaveData()` |
| sys_saveData | method | L413 | L424 | 12 | `sys_saveData()` |
| sys_setupInputs | method | L425 | L516 | 92 | `sys_setupInputs()` |
| sys_initSelectionPhase | method | L517 | L568 | 52 | `sys_initSelectionPhase()` |
| sys_initReplaceAmmoPhase | method | L569 | L594 | 26 | `sys_initReplaceAmmoPhase()` |
| sys_confirmReplaceAmmo | method | L595 | L615 | 21 | `sys_confirmReplaceAmmo()` |
| sys_skipReplaceAmmo | method | L616 | L627 | 12 | `sys_skipReplaceAmmo()` |
| _proceedToFateMomentSelection | method | L628 | L666 | 39 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L667 | L716 | 50 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L717 | L756 | 40 | `sys_queueRoundStartReward(reward = {})` |
| sys_tryQueueEnemyRoundReward | method | L757 | L813 | 57 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L814 | L889 | 76 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L890 | L901 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L902 | L976 | 75 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L977 | L1012 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1013 | L1026 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1027 | L1036 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1037 | L1045 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1046 | L1058 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1059 | L1066 | 8 | `triggerScreenShake(amount)` |
| drawWindTunnelFlow | method | L1067 | L1095 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1096 | L1108 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1109 | L1119 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1120 | L1130 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1131 | L1142 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1143 | L1164 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1165 | L1179 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1180 | L1228 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1229 | L1272 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1273 | L1303 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1304 | L1322 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1323 | L1396 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1397 | L1539 | 143 | `sys_saveRunState()` |
| sys_clearRunState | method | L1540 | L1549 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1550 | L1558 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1559 | L1736 | 178 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1737 | L1762 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1763 | L1789 | 27 | `_calcDesperationMult()` |
