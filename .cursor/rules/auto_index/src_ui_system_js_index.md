# src/ui_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1678 | 函数数: 41 | 语言: javascript
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
| ui_renderReplaceAmmoUI | method | L313 | L716 | **404** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L717 | L742 | 26 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L743 | L746 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L747 | L830 | 84 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L831 | L850 | 20 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L851 | L876 | 26 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L877 | L1010 | 134 | `ui_updateUI()` |
| ui_updatePCLayout | method | L1011 | L1067 | 57 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L1068 | L1094 | 27 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L1095 | L1121 | 27 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L1122 | L1151 | 30 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L1152 | L1178 | 27 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L1179 | L1230 | 52 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L1231 | L1255 | 25 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L1256 | L1267 | 12 | `meta_addCurrency(amount)` |
| meta_startRun | method | L1268 | L1281 | 14 | `meta_startRun()` |
| meta_continueRun | method | L1282 | L1291 | 10 | `meta_continueRun()` |
| meta_updateContinueButton | method | L1292 | L1313 | 22 | `meta_updateContinueButton()` |
| meta_openShop | method | L1314 | L1322 | 9 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L1323 | L1333 | 11 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L1334 | L1382 | 49 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L1383 | L1451 | 69 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L1452 | L1463 | 12 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L1464 | L1548 | 85 | `ui_initEventListeners()` |
| ui_openPause | method | L1549 | L1581 | 33 | `ui_openPause()` |
| ui_closePause | method | L1582 | L1596 | 15 | `ui_closePause()` |
| ui_syncPauseSettings | method | L1597 | L1623 | 27 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L1624 | L1679 | 56 | `ui_renderPauseRelics()` |
