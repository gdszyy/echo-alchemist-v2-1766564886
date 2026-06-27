# src\ui_system.js 函数索引

> 自动生成于 2026-06-27 | 总行数: 3413 | 函数数: 57 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| _isCoarsePointerInput | function | `_isCoarsePointerInput()` |  |
| _escapeHtml | function | `_escapeHtml(value)` | ⚠️ 巨型函数，见 @section 导航 |
| makeRow | function | `makeRow(recipes, startIdx, headerText, headerColor)` |  |
| ui_toggleReplaceAmmoCard | method | `ui_toggleReplaceAmmoCard(globalIdx)` |  |
| ui_selectReplaceAmmoTarget | method | `ui_selectReplaceAmmoTarget(ammoIdx)` |  |
| ui_rerollMarbleSelection | method | `ui_rerollMarbleSelection()` |  |
| ui_refreshSelectionModeUI | method | `ui_refreshSelectionModeUI()` |  |
| _meta_ensureResourceStore | method | `_meta_ensureResourceStore()` |  |
| _meta_getRuneInventoryResourceCount | method | `_meta_getRuneInventoryResourceCount(resourceId)` |  |
| meta_getResourceCount | method | `meta_getResourceCount(resourceId)` |  |
| meta_spendResource | method | `meta_spendResource(resourceId, amount)` |  |
| ui_updateUI | method | `ui_updateUI()` |  |
| ui_updatePCLayout | method | `ui_updatePCLayout()` |  |
| _ui_updateLeftSidebarContent | method | `_ui_updateLeftSidebarContent(phase /* , wasPC */)` |  |
| _ui_movePanelTo | method | `_ui_movePanelTo(elId, mountId, toSidebar)` |  |
| _ui_migrateDrawerToLeftSidebar | method | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |  |
| _ui_migrateHUDToLeftSidebar | method | `_ui_migrateHUDToLeftSidebar(toSidebar)` |  |
| _ui_migrateRuneLauncherToSidebar | method | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |  |
| ui_confirmSelection | method | `ui_confirmSelection()` |  |
| meta_applyUpgrades | method | `meta_applyUpgrades()` |  |
| meta_addCurrency | method | `meta_addCurrency(amount, resourceId = 'rune_fragments')` |  |
| meta_startRun | method | `meta_startRun()` |  |
| meta_continueRun | method | `meta_continueRun()` |  |
| meta_updateContinueButton | method | `meta_updateContinueButton()` |  |
| meta_openShop | method | `meta_openShop()` |  |
| meta_calculateUpgradeCost | method | `meta_calculateUpgradeCost(upgrade, level)` |  |
| meta_buyUpgrade | method | `meta_buyUpgrade(upgradeId)` |  |
| ui_onPhaseChange | method | `ui_onPhaseChange(newPhase)` |  |
| ui_triggerScreenShake | method | `ui_triggerScreenShake(duration = 200)` |  |
| ui_initEventListeners | method | `ui_initEventListeners()` |  |
| ui_openTruthBook | method | `ui_openTruthBook(options = {})` |  |
| ui_closeTruthBook | method | `ui_closeTruthBook()` |  |
| ui_openPause | method | `ui_openPause()` |  |
| ui_closePause | method | `ui_closePause()` |  |
| ui_abandonRunToMeta | method | `ui_abandonRunToMeta()` |  |
| ui_syncPauseSettings | method | `ui_syncPauseSettings()` |  |
| ui_renderPauseRelics | method | `ui_renderPauseRelics()` |  |
| _moduleEditor_ensureStyles | method | `_moduleEditor_ensureStyles()` |  |
| ui_showModuleEditorEntry | method | `ui_showModuleEditorEntry()` |  |
| ui_hideModuleEditorEntry | method | `ui_hideModuleEditorEntry()` |  |
| ui_showModuleEditor | method | `ui_showModuleEditor(onComplete)` |  |
| ui_renderModuleEditorControls | method | `ui_renderModuleEditorControls()` |  |
| _moduleEditor_showNotice | method | `_moduleEditor_showNotice(message, options = {})` |  |
| _moduleEditor_clearNotice | method | `_moduleEditor_clearNotice()` |  |
| _moduleEditor_validateBeforeStart | method | `_moduleEditor_validateBeforeStart()` |  |
| _moduleEditor_tryStartCollection | method | `_moduleEditor_tryStartCollection()` |  |
| ui_hideModuleEditor | method | `ui_hideModuleEditor()` |  |
| _moduleEditor_handleClick | method | `_moduleEditor_handleClick(logicPos)` |  |
| _moduleEditor_getSlotRects | method | `_moduleEditor_getSlotRects()` |  |
| _moduleEditor_getModulePlacementStatus | method | `_moduleEditor_getModulePlacementStatus(slotIdx, moduleId)` |  |
| _moduleEditor_closePicker | method | `_moduleEditor_closePicker()` |  |
| _moduleEditor_setPlacementPreview | method | `_moduleEditor_setPlacementPreview(slotIdx, moduleId = null, options = {})` |  |
| _moduleEditor_normalizeComponentInventory | method | `_moduleEditor_normalizeComponentInventory()` |  |
| _moduleEditor_takeInventoryComponent | method | `_moduleEditor_takeInventoryComponent(componentUid)` |  |
| _moduleEditor_detachComponent | method | `_moduleEditor_detachComponent(slotIdx, layout, cols, rows)` |  |
| _moduleEditor_unequipComponent | method | `_moduleEditor_unequipComponent(slotIdx)` |  |
| _moduleEditor_openPicker | method | `_moduleEditor_openPicker(slotIdx)` | ⚠️ 巨型函数，见 @section 导航 |

## 巨型函数内部节点 (@section 标记)

### _escapeHtml

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:ui_fly_effects` | 飞行特效池管理 |
| `@section:replace_ammo_init` | 初始化上下文、获取 DOM 元素并设置标题文字 |
| `@section:replace_ammo_tier_calc` | 子弹等级与主属性计算函数（_calcTier / _calcDominant） |
| `@section:replace_ammo_card_render` | 子弹卡片 DOM 渲染：renderCard + makeRow + 将卡片添加到网格 |

### _moduleEditor_openPicker

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:replace_ammo_confirm_btn` | 确认按鈕与跳过按鈕状态同步 |
