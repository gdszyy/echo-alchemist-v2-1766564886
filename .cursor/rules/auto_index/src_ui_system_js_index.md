# src/ui_system.js 函数索引

> 自动生成于 2026-04-21 | 总行数: 581 | 函数数: 41 | 语言: javascript
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
| ui_isSelectionConfirmReady | method | L76 | L84 | 9 | `ui_isSelectionConfirmReady()` |
| ui_getPureEssenceLegalElements | method | L85 | L90 | 6 | `ui_getPureEssenceLegalElements(marbleDef)` |
| ui_getPureEssenceRuneOptions | method | L91 | L99 | 9 | `ui_getPureEssenceRuneOptions(marbleDef)` |
| ui_selectPureEssenceRune | method | L100 | L106 | 7 | `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` |
| ui_renderPureEssencePanel | method | L107 | L125 | 19 | `ui_renderPureEssencePanel(marbleDef, selectionIndex)` |
| ui_isFateMomentPhase | method | L126 | L129 | 4 | `ui_isFateMomentPhase()` |
| ui_renderReplaceAmmoUI | method | L130 | L346 | **217** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L347 | L361 | 15 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L362 | L365 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L366 | L390 | 25 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L391 | L394 | 4 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L395 | L406 | 12 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L407 | L487 | 81 | `ui_updateUI()` |
| ui_updatePCLayout | method | L488 | L496 | 9 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L497 | L497 | 1 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L498 | L498 | 1 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L499 | L499 | 1 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L500 | L501 | 2 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L502 | L506 | 5 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L507 | L510 | 4 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L511 | L516 | 6 | `meta_addCurrency(amount)` |
| meta_startRun | method | L517 | L524 | 8 | `meta_startRun()` |
| meta_continueRun | method | L525 | L528 | 4 | `meta_continueRun()` |
| meta_updateContinueButton | method | L529 | L533 | 5 | `meta_updateContinueButton()` |
| meta_openShop | method | L534 | L538 | 5 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L539 | L543 | 5 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L544 | L548 | 5 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L549 | L555 | 7 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L556 | L562 | 7 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L563 | L568 | 6 | `ui_initEventListeners()` |
| ui_openPause | method | L569 | L573 | 5 | `ui_openPause()` |
| ui_closePause | method | L574 | L578 | 5 | `ui_closePause()` |
| ui_syncPauseSettings | method | L579 | L579 | 1 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L580 | L582 | 3 | `ui_renderPauseRelics()` |

## 巨型函数内部节点 (@section 标记)

### ui_renderReplaceAmmoUI (L130-L346, 217行)

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:ui_fly_effects` | L4 | 飞行特效池管理 |
