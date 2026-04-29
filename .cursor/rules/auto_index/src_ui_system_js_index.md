# src/ui_system.js 函数索引

> 自动生成于 2026-04-26 | 总行数: 835 | 函数数: 42 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| _getFlyEffectNode | method | `_getFlyEffectNode()` |  |
| _releaseFlyEffectNode | method | `_releaseFlyEffectNode(node)` |  |
| ui_playResourceFlyEffect | method | `ui_playResourceFlyEffect(startX, startY, amount)` |  |
| ui_playLootToCardAnimation | method | `ui_playLootToCardAnimation(startX, startY, type, callback)` |  |
| ui_updateSlowMotion | method | `ui_updateSlowMotion()` |  |
| ui_updateMetaCurrency | method | `ui_updateMetaCurrency()` |  |
| ui_updateRuneCountDisplay | method | `ui_updateRuneCountDisplay()` |  |
| ui_getSelectionRequirement | method | `ui_getSelectionRequirement()` |  |
| ui_isSelectionConfirmReady | method | `ui_isSelectionConfirmReady()` |  |
| ui_getPureEssenceLegalElements | method | `ui_getPureEssenceLegalElements(marbleDef)` |  |
| ui_getPureEssenceRuneOptions | method | `ui_getPureEssenceRuneOptions(marbleDef)` |  |
| ui_selectPureEssenceRune | method | `ui_selectPureEssenceRune(selectionIndex, inventoryIndex)` |  |
| ui_renderPureEssencePanel | method | `ui_renderPureEssencePanel(marbleDef, selectionIndex)` |  |
| ui_isFateMomentPhase | method | `ui_isFateMomentPhase()` |  |
| ui_renderReplaceAmmoUI | method | `ui_renderReplaceAmmoUI()` | ⚠️ 巨型函数，见 @section 导航 |
| ui_toggleReplaceAmmoCard | method | `ui_toggleReplaceAmmoCard(globalIdx)` |  |
| ui_selectReplaceAmmoTarget | method | `ui_selectReplaceAmmoTarget(ammoIdx)` |  |
| ui_refreshSelectionModeUI | method | `ui_refreshSelectionModeUI()` |  |
| meta_getResourceCount | method | `meta_getResourceCount(resourceId)` |  |
| meta_spendResource | method | `meta_spendResource(resourceId, amount)` |  |
| ui_updateUI | method | `ui_updateUI()` |  |
| ui_updatePCLayout | method | `ui_updatePCLayout()` |  |
| _ui_updateLeftSidebarContent | method | `_ui_updateLeftSidebarContent(phase, wasPC)` |  |
| _ui_migrateDrawerToLeftSidebar | method | `_ui_migrateDrawerToLeftSidebar(toSidebar)` |  |
| _ui_migrateHUDToLeftSidebar | method | `_ui_migrateHUDToLeftSidebar(toSidebar)` |  |
| _ui_migrateRuneLauncherToSidebar | method | `_ui_migrateRuneLauncherToSidebar(toSidebar)` |  |
| ui_confirmSelection | method | `ui_confirmSelection()` |  |
| meta_applyUpgrades | method | `meta_applyUpgrades()` |  |
| meta_addCurrency | method | `meta_addCurrency(amount)` |  |
| meta_startRun | method | `meta_startRun()` |  |
| meta_continueRun | method | `meta_continueRun()` |  |
| meta_updateContinueButton | method | `meta_updateContinueButton()` |  |
| meta_openShop | method | `meta_openShop()` |  |
| meta_calculateUpgradeCost | method | `meta_calculateUpgradeCost(upgrade, level)` |  |
| meta_buyUpgrade | method | `meta_buyUpgrade(upgradeId)` |  |
| ui_onPhaseChange | method | `ui_onPhaseChange(newPhase)` |  |
| ui_triggerScreenShake | method | `ui_triggerScreenShake(duration = 200)` |  |
| ui_initEventListeners | method | `ui_initEventListeners()` |  |
| ui_openPause | method | `ui_openPause()` |  |
| ui_closePause | method | `ui_closePause()` |  |
| ui_syncPauseSettings | method | `ui_syncPauseSettings()` |  |
| ui_renderPauseRelics | method | `ui_renderPauseRelics()` |  |

## 巨型函数内部节点 (@section 标记)

### ui_renderReplaceAmmoUI

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:replace_ammo_init` | 初始化上下文、获取 DOM 元素并设置标题文字 |
| `@section:replace_ammo_tier_calc` | 子弹等级与主属性计算函数（_calcTier / _calcDominant） |
| `@section:replace_ammo_card_render` | 子弹卡片 DOM 渲染：renderCard + makeRow + 将卡片添加到网格 |
| `@section:replace_ammo_confirm_btn` | 确认按鈕与跳过按鈕状态同步 |

## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:ui_fly_effects` | 飞行特效池管理 |
