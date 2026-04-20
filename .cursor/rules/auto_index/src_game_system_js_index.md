# src/game_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1881 | 函数数: 42 | 语言: javascript
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
| sys_tryQueueEnemyRoundReward | method | L792 | L848 | 57 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L849 | L934 | 86 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L940 | L951 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L952 | L1056 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1057 | L1092 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1093 | L1106 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1107 | L1116 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1117 | L1125 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1126 | L1138 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1139 | L1146 | 8 | `triggerScreenShake(amount)` |
| drawWindTunnelFlow | method | L1147 | L1175 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1176 | L1188 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1189 | L1199 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1200 | L1210 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1211 | L1222 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1223 | L1244 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1245 | L1259 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1260 | L1308 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1309 | L1352 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1353 | L1383 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1384 | L1402 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1403 | L1476 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1477 | L1621 | 145 | `sys_saveRunState()` |
| sys_clearRunState | method | L1622 | L1631 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L1632 | L1640 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L1641 | L1820 | 180 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L1821 | L1846 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L1798 | L1824 | 27 | `_calcDesperationMult()` |
