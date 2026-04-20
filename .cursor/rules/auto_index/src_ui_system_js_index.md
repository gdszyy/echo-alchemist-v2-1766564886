# src/ui_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1659 | 函数数: 41 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| _getFlyEffectNode | method | L28 | L51 | 24 | `_getFlyEffectNode()` |
| _releaseFlyEffectNode | method | L52 | L56 | 5 | `_releaseFlyEffectNode(node)` |
| ui_playResourceFlyEffect | method | L57 | L115 | 59 | `ui_playResourceFlyEffect(startX, startY, amount)` |
| ui_updateSlowMotion | method | L116 | L157 | 42 | `ui_updateSlowMotion()` |
| ui_updateMetaCurrency | method | L158 | L170 | 13 | `ui_updateMetaCurrency()` |
| ui_updateRuneCountDisplay | method | L171 | L175 | 5 | `ui_updateRuneCountDisplay()` |
| ui_getSelectionRequirement | method | L176 | L179 | 4 | `ui_getSelectionRequirement()` |
| ui_isSelectionConfirmReady | method | L180 | L188 | 9 | `ui_isSelectionConfirmReady()` |
| ui_getPureEssenceLegalElements | method | L189 | L199 | 11 | `ui_getPureEssenceLegalElements(marbleDef)` |
| ui_getPureEssenceRuneOptions | method | L200 | L208 | 9 | `ui_getPureEssenceRuneOptions(marbleDef)` |
| ui_selectPureEssenceRune | method | L209 | L234 | 26 | `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` |
| ui_renderPureEssencePanel | method | L235 | L291 | 57 | `ui_renderPureEssencePanel(marbleDef, selectionIndex)` |
| ui_isFateMomentPhase | method | L292 | L312 | 21 | `ui_isFateMomentPhase()` |
| ui_renderReplaceAmmoUI | method | L313 | L697 | **385** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L698 | L723 | 26 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L724 | L727 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L728 | L811 | 84 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L812 | L831 | 20 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L832 | L857 | 26 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L858 | L991 | 134 | `ui_updateUI()` |
| ui_updatePCLayout | method | L992 | L1048 | 57 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L1049 | L1075 | 27 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L1076 | L1102 | 27 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L1103 | L1132 | 30 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L1133 | L1159 | 27 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L1160 | L1211 | 52 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L1212 | L1236 | 25 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L1237 | L1248 | 12 | `meta_addCurrency(amount)` |
| meta_startRun | method | L1249 | L1262 | 14 | `meta_startRun()` |
| meta_continueRun | method | L1263 | L1272 | 10 | `meta_continueRun()` |
| meta_updateContinueButton | method | L1273 | L1294 | 22 | `meta_updateContinueButton()` |
| meta_openShop | method | L1295 | L1303 | 9 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L1304 | L1314 | 11 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L1315 | L1363 | 49 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L1364 | L1432 | 69 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L1433 | L1444 | 12 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L1445 | L1529 | 85 | `ui_initEventListeners()` |
| ui_openPause | method | L1530 | L1562 | 33 | `ui_openPause()` |
| ui_closePause | method | L1563 | L1577 | 15 | `ui_closePause()` |
| ui_syncPauseSettings | method | L1578 | L1604 | 27 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L1605 | L1660 | 56 | `ui_renderPauseRelics()` |
