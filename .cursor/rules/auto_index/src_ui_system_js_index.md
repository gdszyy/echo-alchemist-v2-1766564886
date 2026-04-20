# src/ui_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1454 | 函数数: 41 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

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
| ui_isFateMomentPhase | method | L292 | L301 | 10 | `ui_isFateMomentPhase()` |
| ui_renderReplaceAmmoUI | method | L303 | L487 | 185 | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L493 | L515 | 23 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L519 | L521 | 3 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L523 | L650 | 128 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L652 | L671 | 20 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L672 | L697 | 26 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L653 | L940 | 288 | `ui_updateUI()` |
| ui_updatePCLayout | method | L787 | L955 | 169 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L956 | L982 | 27 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L983 | L1009 | 27 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L1010 | L1039 | 30 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L1040 | L1066 | 27 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L955 | L1050 | 96 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L1051 | L1075 | 25 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L1076 | L1087 | 12 | `meta_addCurrency(amount)` |
| meta_startRun | method | L1088 | L1101 | 14 | `meta_startRun()` |
| meta_continueRun | method | L1102 | L1111 | 10 | `meta_continueRun()` |
| meta_updateContinueButton | method | L1112 | L1133 | 22 | `meta_updateContinueButton()` |
| meta_openShop | method | L1134 | L1142 | 9 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L1143 | L1153 | 11 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L1154 | L1202 | 49 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L1159 | L1227 | 69 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L1228 | L1239 | 12 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L1240 | L1324 | 85 | `ui_initEventListeners()` |
| ui_openPause | method | L1325 | L1357 | 33 | `ui_openPause()` |
| ui_closePause | method | L1358 | L1372 | 15 | `ui_closePause()` |
| ui_syncPauseSettings | method | L1373 | L1399 | 27 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L1400 | L1454 | 55 | `ui_renderPauseRelics()` |
