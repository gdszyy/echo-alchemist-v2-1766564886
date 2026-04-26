# src/ui/hud.js 函数索引

> 自动生成于 2026-04-26 | 总行数: 1030 | 函数数: 14 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| _buildRuneIconEl | function | `_buildRuneIconEl(runeDef, runeLevel)` |  |
| ui_updateMultiplierUI | method | `ui_updateMultiplierUI()` |  |
| ui_saveShotDamage | method | `ui_saveShotDamage()` |  |
| ui_updateRoundDamage | method | `ui_updateRoundDamage()` |  |
| ui_updateDamageStats | method | `ui_updateDamageStats()` |  |
| ui_switchDamageRound | method | `ui_switchDamageRound(direction)` |  |
| ui_toggleDamagePanel | method | `ui_toggleDamagePanel()` |  |
| ui_renderRecipeHUD | method | `ui_renderRecipeHUD()` |  |
| ui_renderRecipeCard | method | `ui_renderRecipeCard(container, item, isActive, statusClass)` |  |
| ui_updateUICache | method | `ui_updateUICache()` |  |
| ui_updateGatheringQueueUI | method | `ui_updateGatheringQueueUI()` |  |
| ui_updateAmmoUI | method | `ui_updateAmmoUI()` |  |
| ui_renderAmmoIcon | method | `ui_renderAmmoIcon(container, recipe, isCurrent)` |  |
| hud_initEventListeners | method | `hud_initEventListeners()` | ⚠️ 巨型函数，见 @section 导航 |

## 巨型函数内部节点 (@section 标记)

### hud_initEventListeners

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:hud_multicast_listeners` | 连射倍率显示与飞行特效事件监听器 |
| `@section:hud_ammo_listeners` | 弹药发射动画与命中进度条事件监听器 |
| `@section:hud_rune_charge_listeners` | 充能符文初始化/升级/进度更新事件监听器 |
| `@section:hud_rune_claim_listeners` | 符文领取飞入背包动画事件监听器（回局结束与敌人动作后） |
