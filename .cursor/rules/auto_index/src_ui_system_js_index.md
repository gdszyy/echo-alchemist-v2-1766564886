# src/ui_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1679 | 函数数: 41 | 语言: javascript
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
| ui_renderReplaceAmmoUI | method | L313 | L717 | **405** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L718 | L743 | 26 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L744 | L747 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L748 | L831 | 84 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L832 | L851 | 20 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L852 | L877 | 26 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L878 | L1011 | 134 | `ui_updateUI()` |
| ui_updatePCLayout | method | L1012 | L1068 | 57 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L1069 | L1095 | 27 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L1096 | L1122 | 27 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L1123 | L1152 | 30 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L1153 | L1179 | 27 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L1180 | L1231 | 52 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L1232 | L1256 | 25 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L1257 | L1268 | 12 | `meta_addCurrency(amount)` |
| meta_startRun | method | L1269 | L1282 | 14 | `meta_startRun()` |
| meta_continueRun | method | L1283 | L1292 | 10 | `meta_continueRun()` |
| meta_updateContinueButton | method | L1293 | L1314 | 22 | `meta_updateContinueButton()` |
| meta_openShop | method | L1315 | L1323 | 9 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L1324 | L1334 | 11 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L1335 | L1383 | 49 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L1384 | L1452 | 69 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L1453 | L1464 | 12 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L1465 | L1549 | 85 | `ui_initEventListeners()` |
| ui_openPause | method | L1550 | L1582 | 33 | `ui_openPause()` |
| ui_closePause | method | L1583 | L1597 | 15 | `ui_closePause()` |
| ui_syncPauseSettings | method | L1598 | L1624 | 27 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L1625 | L1680 | 56 | `ui_renderPauseRelics()` |
