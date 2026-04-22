# src/game_system.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 2248 | 函数数: 45 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| sys_loop | method | L29 | L187 | 159 | `sys_loop()` |
| sys_resize | method | L188 | L226 | 39 | `sys_resize()` |
| sys_initGameStart | method | L227 | L288 | 62 | `sys_initGameStart()` |
| sys_resetGame | method | L289 | L418 | 130 | `sys_resetGame()` |
| sys_loadSaveData | method | L419 | L445 | 27 | `sys_loadSaveData()` |
| sys_saveData | method | L446 | L457 | 12 | `sys_saveData()` |
| sys_setupInputs | method | L458 | L549 | 92 | `sys_setupInputs()` |
| sys_initSelectionPhase | method | L550 | L600 | 51 | `sys_initSelectionPhase()` |
| sys_initReplaceAmmoPhase | method | L601 | L629 | 29 | `sys_initReplaceAmmoPhase()` |
| sys_confirmReplaceAmmo | method | L630 | L679 | 50 | `sys_confirmReplaceAmmo()` |
| sys_skipReplaceAmmo | method | L680 | L713 | 34 | `sys_skipReplaceAmmo()` |
| _proceedToFateMomentSelection | method | L714 | L761 | 48 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L762 | L811 | 50 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L812 | L862 | 51 | `sys_queueRoundStartReward(reward = {})` |
| sys_determineEnemyReward | method | L863 | L1068 | **206** | `sys_determineEnemyReward(enemy, isRowRepresentative = false)` |
| sys_preCalcEnemyRewardType | method | L1069 | L1078 | 10 | `sys_preCalcEnemyRewardType(enemy)` |
| sys_tryQueueEnemyRoundReward | method | L1079 | L1163 | 85 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L1164 | L1281 | 118 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L1282 | L1293 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L1294 | L1398 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1399 | L1434 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1435 | L1448 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1449 | L1458 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1459 | L1467 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1468 | L1480 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1481 | L1492 | 12 | `triggerScreenShake(amount)` |
| triggerScreenShakeAdvanced | method | L1493 | L1502 | 10 | `triggerScreenShakeAdvanced(amplitude, duration)` |
| drawWindTunnelFlow | method | L1503 | L1531 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1532 | L1544 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1545 | L1555 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1556 | L1566 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1567 | L1578 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1579 | L1600 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1601 | L1615 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1616 | L1664 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1665 | L1708 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1709 | L1739 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1740 | L1758 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1759 | L1832 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1833 | L1981 | 149 | `sys_saveRunState()` |
| sys_clearRunState | method | L1982 | L1991 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1992 | L2000 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L2001 | L2196 | 196 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L2197 | L2222 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L2223 | L2249 | 27 | `_calcDesperationMult()` |
