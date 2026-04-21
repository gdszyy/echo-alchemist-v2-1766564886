# src/ui_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1701 | 函数数: 41 | 语言: javascript
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
| ui_renderReplaceAmmoUI | method | L313 | L739 | **427** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L740 | L765 | 26 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L766 | L769 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L770 | L853 | 84 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L854 | L873 | 20 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L874 | L899 | 26 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L900 | L1033 | 134 | `ui_updateUI()` |
| ui_updatePCLayout | method | L1034 | L1090 | 57 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L1091 | L1117 | 27 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L1118 | L1144 | 27 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L1145 | L1174 | 30 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L1175 | L1201 | 27 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L1202 | L1253 | 52 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L1254 | L1278 | 25 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L1279 | L1290 | 12 | `meta_addCurrency(amount)` |
| meta_startRun | method | L1291 | L1304 | 14 | `meta_startRun()` |
| meta_continueRun | method | L1305 | L1314 | 10 | `meta_continueRun()` |
| meta_updateContinueButton | method | L1315 | L1336 | 22 | `meta_updateContinueButton()` |
| meta_openShop | method | L1337 | L1345 | 9 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L1346 | L1356 | 11 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L1357 | L1405 | 49 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L1406 | L1474 | 69 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L1475 | L1486 | 12 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L1487 | L1571 | 85 | `ui_initEventListeners()` |
| ui_openPause | method | L1572 | L1604 | 33 | `ui_openPause()` |
| ui_closePause | method | L1605 | L1619 | 15 | `ui_closePause()` |
| ui_syncPauseSettings | method | L1620 | L1646 | 27 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L1647 | L1702 | 56 | `ui_renderPauseRelics()` |
