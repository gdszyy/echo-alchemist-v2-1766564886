# src/game_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1832 | 函数数: 42 | 语言: javascript
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
| _proceedToFateMomentSelection | method | L631 | L678 | 48 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L679 | L728 | 50 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L729 | L768 | 40 | `sys_queueRoundStartReward(reward = {})` |
| sys_tryQueueEnemyRoundReward | method | L769 | L825 | 57 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L826 | L901 | 76 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L902 | L913 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L914 | L1018 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1019 | L1054 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1055 | L1068 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1069 | L1078 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1079 | L1087 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1088 | L1100 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1101 | L1108 | 8 | `triggerScreenShake(amount)` |
| drawWindTunnelFlow | method | L1109 | L1137 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1138 | L1150 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1151 | L1161 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1162 | L1172 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1173 | L1184 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1185 | L1206 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1207 | L1221 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1222 | L1270 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1271 | L1314 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1315 | L1345 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1346 | L1364 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1365 | L1438 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1439 | L1582 | 144 | `sys_saveRunState()` |
| sys_clearRunState | method | L1583 | L1592 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1593 | L1601 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1602 | L1780 | 179 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1781 | L1806 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1807 | L1833 | 27 | `_calcDesperationMult()` |
