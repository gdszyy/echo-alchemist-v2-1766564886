# src/ui_system.js 函数索引

> 自动生成于 2026-04-21 | 总行数: 577 | 函数数: 41 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| _getFlyEffectNode | method | L6 | L23 | 18 | `_getFlyEffectNode()` |
| _releaseFlyEffectNode | method | L24 | L28 | 5 | `_releaseFlyEffectNode(node)` |
| ui_playResourceFlyEffect | method | L29 | L49 | 21 | `ui_playResourceFlyEffect(startX, startY, amount)` |
| ui_updateSlowMotion | method | L50 | L61 | 12 | `ui_updateSlowMotion()` |
| ui_updateMetaCurrency | method | L62 | L66 | 5 | `ui_updateMetaCurrency()` |
| ui_updateRuneCountDisplay | method | L67 | L71 | 5 | `ui_updateRuneCountDisplay()` |
| ui_getSelectionRequirement | method | L72 | L75 | 4 | `ui_getSelectionRequirement()` |
| ui_isSelectionConfirmReady | method | L76 | L82 | 7 | `ui_isSelectionConfirmReady()` |
| ui_getPureEssenceLegalElements | method | L83 | L88 | 6 | `ui_getPureEssenceLegalElements(marbleDef)` |
| ui_getPureEssenceRuneOptions | method | L89 | L97 | 9 | `ui_getPureEssenceRuneOptions(marbleDef)` |
| ui_selectPureEssenceRune | method | L98 | L104 | 7 | `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` |
| ui_renderPureEssencePanel | method | L105 | L123 | 19 | `ui_renderPureEssencePanel(marbleDef, selectionIndex)` |
| ui_isFateMomentPhase | method | L124 | L127 | 4 | `ui_isFateMomentPhase()` |
| ui_renderReplaceAmmoUI | method | L128 | L344 | **217** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L345 | L359 | 15 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L360 | L363 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L364 | L386 | 23 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L387 | L390 | 4 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L391 | L402 | 12 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L403 | L483 | 81 | `ui_updateUI()` |
| ui_updatePCLayout | method | L484 | L492 | 9 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L493 | L493 | 1 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L494 | L494 | 1 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L495 | L495 | 1 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L496 | L497 | 2 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L498 | L502 | 5 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L503 | L506 | 4 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L507 | L512 | 6 | `meta_addCurrency(amount)` |
| meta_startRun | method | L513 | L520 | 8 | `meta_startRun()` |
| meta_continueRun | method | L521 | L524 | 4 | `meta_continueRun()` |
| meta_updateContinueButton | method | L525 | L529 | 5 | `meta_updateContinueButton()` |
| meta_openShop | method | L530 | L534 | 5 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L535 | L539 | 5 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L540 | L544 | 5 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L545 | L551 | 7 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L552 | L558 | 7 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L559 | L564 | 6 | `ui_initEventListeners()` |
| ui_openPause | method | L565 | L569 | 5 | `ui_openPause()` |
| ui_closePause | method | L570 | L574 | 5 | `ui_closePause()` |
| ui_syncPauseSettings | method | L575 | L575 | 1 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L576 | L578 | 3 | `ui_renderPauseRelics()` |

## 巨型函数内部节点 (@section 标记)

### ui_renderReplaceAmmoUI (L128-L344, 217行)

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:ui_fly_effects` | L4 | 飞行特效池管理 |
