# src/ui_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1703 | 函数数: 41 | 语言: javascript
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
| ui_renderReplaceAmmoUI | method | L313 | L741 | **429** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L742 | L767 | 26 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L768 | L771 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L772 | L855 | 84 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L856 | L875 | 20 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L876 | L901 | 26 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L902 | L1035 | 134 | `ui_updateUI()` |
| ui_updatePCLayout | method | L1036 | L1092 | 57 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L1093 | L1119 | 27 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L1120 | L1146 | 27 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L1147 | L1176 | 30 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L1177 | L1203 | 27 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L1204 | L1255 | 52 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L1256 | L1280 | 25 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L1281 | L1292 | 12 | `meta_addCurrency(amount)` |
| meta_startRun | method | L1293 | L1306 | 14 | `meta_startRun()` |
| meta_continueRun | method | L1307 | L1316 | 10 | `meta_continueRun()` |
| meta_updateContinueButton | method | L1317 | L1338 | 22 | `meta_updateContinueButton()` |
| meta_openShop | method | L1339 | L1347 | 9 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L1348 | L1358 | 11 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L1359 | L1407 | 49 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L1408 | L1476 | 69 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L1477 | L1488 | 12 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L1489 | L1573 | 85 | `ui_initEventListeners()` |
| ui_openPause | method | L1574 | L1606 | 33 | `ui_openPause()` |
| ui_closePause | method | L1607 | L1621 | 15 | `ui_closePause()` |
| ui_syncPauseSettings | method | L1622 | L1648 | 27 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L1649 | L1704 | 56 | `ui_renderPauseRelics()` |
