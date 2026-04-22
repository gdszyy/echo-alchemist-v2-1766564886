# src/ui_system.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 813 | 函数数: 42 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| _getFlyEffectNode | method | L8 | L25 | 18 | `_getFlyEffectNode()` |
| _releaseFlyEffectNode | method | L26 | L30 | 5 | `_releaseFlyEffectNode(node)` |
| ui_playResourceFlyEffect | method | L31 | L55 | 25 | `ui_playResourceFlyEffect(startX, startY, amount)` |
| ui_playLootToCardAnimation | method | L56 | L101 | 46 | `ui_playLootToCardAnimation(startX, startY, type, callback)` |
| ui_updateSlowMotion | method | L102 | L113 | 12 | `ui_updateSlowMotion()` |
| ui_updateMetaCurrency | method | L114 | L118 | 5 | `ui_updateMetaCurrency()` |
| ui_updateRuneCountDisplay | method | L119 | L123 | 5 | `ui_updateRuneCountDisplay()` |
| ui_getSelectionRequirement | method | L124 | L127 | 4 | `ui_getSelectionRequirement()` |
| ui_isSelectionConfirmReady | method | L128 | L136 | 9 | `ui_isSelectionConfirmReady()` |
| ui_getPureEssenceLegalElements | method | L137 | L147 | 11 | `ui_getPureEssenceLegalElements(marbleDef)` |
| ui_getPureEssenceRuneOptions | method | L148 | L156 | 9 | `ui_getPureEssenceRuneOptions(marbleDef)` |
| ui_selectPureEssenceRune | method | L157 | L182 | 26 | `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` |
| ui_renderPureEssencePanel | method | L183 | L239 | 57 | `ui_renderPureEssencePanel(marbleDef, selectionIndex)` |
| ui_isFateMomentPhase | method | L240 | L243 | 4 | `ui_isFateMomentPhase()` |
| ui_renderReplaceAmmoUI | method | L244 | L468 | **225** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L469 | L483 | 15 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L484 | L487 | 4 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L488 | L561 | 74 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L562 | L565 | 4 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L566 | L577 | 12 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L578 | L661 | 84 | `ui_updateUI()` |
| ui_updatePCLayout | method | L662 | L670 | 9 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L671 | L671 | 1 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L672 | L672 | 1 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L673 | L673 | 1 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L674 | L681 | 8 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L682 | L738 | 57 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L739 | L742 | 4 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L743 | L748 | 6 | `meta_addCurrency(amount)` |
| meta_startRun | method | L749 | L756 | 8 | `meta_startRun()` |
| meta_continueRun | method | L757 | L760 | 4 | `meta_continueRun()` |
| meta_updateContinueButton | method | L761 | L765 | 5 | `meta_updateContinueButton()` |
| meta_openShop | method | L766 | L770 | 5 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L771 | L775 | 5 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L776 | L780 | 5 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L781 | L787 | 7 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L788 | L794 | 7 | `ui_triggerScreenShake(duration = 200)` |
| ui_initEventListeners | method | L795 | L800 | 6 | `ui_initEventListeners()` |
| ui_openPause | method | L801 | L805 | 5 | `ui_openPause()` |
| ui_closePause | method | L806 | L810 | 5 | `ui_closePause()` |
| ui_syncPauseSettings | method | L811 | L811 | 1 | `ui_syncPauseSettings()` |
| ui_renderPauseRelics | method | L812 | L814 | 3 | `ui_renderPauseRelics()` |

## 巨型函数内部节点 (@section 标记)

### ui_renderReplaceAmmoUI (L244-L468, 225行)

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:ui_fly_effects` | L6 | 飞行特效池管理 |
