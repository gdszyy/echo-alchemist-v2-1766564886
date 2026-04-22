# src/game_system.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 2288 | 函数数: 45 | 语言: javascript
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
| sys_initSelectionPhase | method | L550 | L605 | 56 | `sys_initSelectionPhase()` |
| sys_initReplaceAmmoPhase | method | L606 | L634 | 29 | `sys_initReplaceAmmoPhase()` |
| sys_confirmReplaceAmmo | method | L635 | L689 | 55 | `sys_confirmReplaceAmmo()` |
| sys_skipReplaceAmmo | method | L690 | L727 | 38 | `sys_skipReplaceAmmo()` |
| _proceedToFateMomentSelection | method | L728 | L775 | 48 | `_proceedToFateMomentSelection()` |
| sys_skipGrindGetRune | method | L776 | L843 | 68 | `sys_skipGrindGetRune()` |
| sys_queueRoundStartReward | method | L844 | L902 | 59 | `sys_queueRoundStartReward(reward = {})` |
| sys_determineEnemyReward | method | L903 | L1108 | **206** | `sys_determineEnemyReward(enemy, isRowRepresentative = false)` |
| sys_preCalcEnemyRewardType | method | L1109 | L1118 | 10 | `sys_preCalcEnemyRewardType(enemy)` |
| sys_tryQueueEnemyRoundReward | method | L1119 | L1203 | 85 | `sys_tryQueueEnemyRoundReward(enemy)` |
| sys_startRoundStartResolver | method | L1204 | L1321 | 118 | `sys_startRoundStartResolver()` |
| sys_continueRoundStartResolver | method | L1322 | L1333 | 12 | `sys_continueRoundStartResolver()` |
| sys_showRoundStartBanner | method | L1334 | L1438 | 105 | `sys_showRoundStartBanner()` |
| sys_toggleMarbleSelection | method | L1439 | L1474 | 36 | `sys_toggleMarbleSelection(idx, cardEl)` |
| sys_resetMultiplier | method | L1475 | L1488 | 14 | `sys_resetMultiplier()` |
| sys_initRecipeHUD | method | L1489 | L1498 | 10 | `sys_initRecipeHUD()` |
| sys_toggleHud | method | L1499 | L1507 | 9 | `sys_toggleHud()` |
| data_clearProjectiles | method | L1508 | L1520 | 13 | `data_clearProjectiles()` |
| triggerScreenShake | method | L1521 | L1532 | 12 | `triggerScreenShake(amount)` |
| triggerScreenShakeAdvanced | method | L1533 | L1542 | 10 | `triggerScreenShakeAdvanced(amplitude, duration)` |
| drawWindTunnelFlow | method | L1543 | L1571 | 29 | `drawWindTunnelFlow(rect, isHorizontal)` |
| checkLineIntersection | method | L1572 | L1584 | 13 | `checkLineIntersection(a, b, c, d)` |
| isBowtieShape | method | L1585 | L1595 | 11 | `isBowtieShape(anchors)` |
| getLineIntersectionPoint | method | L1596 | L1606 | 11 | `getLineIntersectionPoint(a, b, c, d)` |
| input_getTiltOffset | method | L1607 | L1618 | 12 | `input_getTiltOffset()` |
| input_handleOrientation | method | L1619 | L1640 | 22 | `input_handleOrientation(e)` |
| _isRuneLauncherOpen | method | L1641 | L1655 | 15 | `_isRuneLauncherOpen()` |
| input_handleInputStart | method | L1656 | L1704 | 49 | `input_handleInputStart(pos, e)` |
| input_handleInputMove | method | L1705 | L1748 | 44 | `input_handleInputMove(pos, e)` |
| input_handleInputEnd | method | L1749 | L1779 | 31 | `input_handleInputEnd(pos, e)` |
| input_checkDefeat | method | L1780 | L1798 | 19 | `input_checkDefeat()` |
| _triggerPityDrop | method | L1799 | L1872 | 74 | `_triggerPityDrop(bossEnemy)` |
| sys_saveRunState | method | L1873 | L2021 | 149 | `sys_saveRunState()` |
| sys_clearRunState | method | L2022 | L2031 | 10 | `sys_clearRunState()` |
| sys_hasRunState | method | L2032 | L2040 | 9 | `sys_hasRunState()` |
| sys_loadRunState | method | L2041 | L2236 | 196 | `sys_loadRunState()` |
| input_checkEnemyHover | method | L2237 | L2262 | 26 | `input_checkEnemyHover(pos)` |
| _calcDesperationMult | method | L2263 | L2289 | 27 | `_calcDesperationMult()` |
