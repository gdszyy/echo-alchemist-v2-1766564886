# src/ui_system.js 函数索引
> 自动生成于 2026-04-22 | 总行数: 794 | 函数数: 45 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| _getFlyEffectNode | method | L7 | L24 | 18 | `_getFlyEffectNode()` |
| _releaseFlyEffectNode | method | L25 | L29 | 5 | `_releaseFlyEffectNode(node)` |
| ui_playResourceFlyEffect | method | L30 | L54 | 25 | `ui_playResourceFlyEffect(startX, startY, amount)` |
| ui_playLootToCardAnimation | method | L55 | L98 | 44 | `ui_playLootToCardAnimation(startX, startY, type, callback)` |
| ui_updateSlowMotion | method | L101 | L110 | 10 | `ui_updateSlowMotion()` |
| ui_updateMetaCurrency | method | L113 | L115 | 3 | `ui_updateMetaCurrency()` |
| ui_updateRuneCountDisplay | method | L118 | L120 | 3 | `ui_updateRuneCountDisplay()` |
| ui_getSelectionRequirement | method | L123 | L125 | 3 | `ui_getSelectionRequirement()` |
| ui_isSelectionConfirmReady | method | L127 | L134 | 8 | `ui_isSelectionConfirmReady()` |
| ui_getPureEssenceLegalElements | method | L136 | L145 | 10 | `ui_getPureEssenceLegalElements(marbleDef)` |
| ui_getPureEssenceRuneOptions | method | L147 | L154 | 8 | `ui_getPureEssenceRuneOptions(marbleDef)` |
| ui_selectPureEssenceRune | method | L156 | L180 | 25 | `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` |
| ui_renderPureEssencePanel | method | L182 | L237 | 56 | `ui_renderPureEssencePanel(marbleDef, selectionIndex)` |
| ui_isFateMomentPhase | method | L239 | L241 | 3 | `ui_isFateMomentPhase()` |
| ui_renderReplaceAmmoUI | method | L243 | L459 | **217** | `ui_renderReplaceAmmoUI()` |
| ui_toggleReplaceAmmoCard | method | L460 | L474 | 15 | `ui_toggleReplaceAmmoCard(globalIdx)` |
| ui_selectReplaceAmmoTarget | method | L475 | L477 | 3 | `ui_selectReplaceAmmoTarget(ammoIdx)` |
| ui_refreshSelectionModeUI | method | L479 | L551 | 73 | `ui_refreshSelectionModeUI()` |
| meta_getResourceCount | method | L553 | L555 | 3 | `meta_getResourceCount(resourceId)` |
| meta_spendResource | method | L557 | L567 | 11 | `meta_spendResource(resourceId, amount)` |
| ui_updateUI | method | L569 | L648 | 80 | `ui_updateUI()` |
| ui_updatePCLayout | method | L650 | L658 | 9 | `ui_updatePCLayout()` |
| _ui_updateLeftSidebarContent | method | L659 | L659 | 1 | `_ui_updateLeftSidebarContent(phase, wasPC)` |
| _ui_migrateDrawerToLeftSidebar | method | L660 | L660 | 1 | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |
| _ui_migrateHUDToLeftSidebar | method | L661 | L661 | 1 | `_ui_migrateHUDToLeftSidebar(toSidebar)` |
| _ui_migrateRuneLauncherToSidebar | method | L662 | L662 | 1 | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |
| ui_confirmSelection | method | L670 | L718 | 49 | `ui_confirmSelection()` |
| meta_applyUpgrades | method | L720 | L722 | 3 | `meta_applyUpgrades()` |
| meta_addCurrency | method | L724 | L728 | 5 | `meta_addCurrency(amount)` |
| meta_startRun | method | L730 | L736 | 7 | `meta_startRun()` |
| meta_continueRun | method | L738 | L740 | 3 | `meta_continueRun()` |
| meta_updateContinueButton | method | L742 | L745 | 4 | `meta_updateContinueButton()` |
| meta_openShop | method | L747 | L750 | 4 | `meta_openShop()` |
| meta_calculateUpgradeCost | method | L752 | L755 | 4 | `meta_calculateUpgradeCost(upgrade, level)` |
| meta_buyUpgrade | method | L757 | L760 | 4 | `meta_buyUpgrade(upgradeId)` |
| ui_onPhaseChange | method | L762 | L767 | 6 | `ui_onPhaseChange(newPhase)` |
| ui_triggerScreenShake | method | L769 | L774 | 6 | `ui_triggerScreenShake(duration)` |
| ui_initEventListeners | method | L776 | L780 | 5 | `ui_initEventListeners()` |
| ui_openPause | method | L782 | L794 | 13 | `ui_openPause()` |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:ui_fly_effects` | L4 | 飞行特效池管理 |
