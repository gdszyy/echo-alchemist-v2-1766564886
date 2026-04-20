# src/game_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 1823 | 函数数: 42 | 语言: javascript
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
| sys_initSelectionPhase | method | L520 | L571 | 52 | `sys_initSelectionPhase()` |
| sys_initReplaceAmmoPhase | method | L572 | L597 | 26 | `sys_initReplaceAmmoPhase()` |
| sys_confirmReplaceAmmo | method | L598 | L618 | 21 | `sys_confirmReplaceAmmo()` |
| sys_skipReplaceAmmo | method | L619 | L630 | 12 | `sys_skipReplaceAmmo()` |
| _proceedToFateMomentSelection | method | L631 | L669 | 39 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L670 | L719 | 50 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L720 | L759 | 40 | `sys_queueRoundStartReward(reward = {})` |
| sys_tryQueueEnemyRoundReward | method | L760 | L816 | 57 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L817 | L892 | 76 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L893 | L904 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L905 | L1009 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1010 | L1045 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1046 | L1059 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1060 | L1069 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1070 | L1078 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1079 | L1091 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1092 | L1099 | 8 | `triggerScreenShake(amount)` |
| drawWindTunnelFlow | method | L1100 | L1128 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1129 | L1141 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1142 | L1152 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1153 | L1163 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1164 | L1175 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1176 | L1197 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1198 | L1212 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1213 | L1261 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1262 | L1305 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1306 | L1336 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1337 | L1355 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1356 | L1429 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1430 | L1573 | 144 | `sys_saveRunState()` |
| sys_clearRunState | method | L1574 | L1583 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1584 | L1592 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1593 | L1771 | 179 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1772 | L1797 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1798 | L1824 | 27 | `_calcDesperationMult()` |
