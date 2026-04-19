# src/game_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 1799 | 函数数: 42 | 语言: javascript
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
| sys_showRoundStartBanner | method | L902 | L987 | 86 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L988 | L1023 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1024 | L1037 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1038 | L1047 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1048 | L1056 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1057 | L1069 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1070 | L1077 | 8 | `triggerScreenShake(amount)` |
| drawWindTunnelFlow | method | L1078 | L1106 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1107 | L1119 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1120 | L1130 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1131 | L1141 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1142 | L1153 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1154 | L1175 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1176 | L1190 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1191 | L1239 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1240 | L1283 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1284 | L1314 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1315 | L1333 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1334 | L1407 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1408 | L1550 | 143 | `sys_saveRunState()` |
| sys_clearRunState | method | L1551 | L1560 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1561 | L1569 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1570 | L1747 | 178 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1748 | L1773 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1774 | L1800 | 27 | `_calcDesperationMult()` |
