# src\ui\shop.js 函数索引

> 自动生成于 2026-07-22 | 总行数: 1128 | 函数数: 19 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| _scoreRecipeStrength | function | `_scoreRecipeStrength(r)` |  |
| _doubleRecipeAttrs | function | `_doubleRecipeAttrs(r)` |  |
| recipe_countAttributeKinds | function | `recipe_countAttributeKinds(r)` |  |
| _isCoarsePointerInput | function | `_isCoarsePointerInput()` |  |
| _getDialogFocusable | function | `_getDialogFocusable(container)` |  |
| _trapDialogFocus | function | `_trapDialogFocus(event, container, onEscape)` |  |
| _isVisibleFocusTarget | function | `_isVisibleFocusTarget(target)` |  |
| _resolveOverlayCloseFocusTarget | function | `_resolveOverlayCloseFocusTarget(target)` |  |
| _restoreFocusAfterOverlayClose | function | `_restoreFocusAfterOverlayClose(game, target)` |  |
| _grantRelicResourcePack | function | `_grantRelicResourcePack(game, multiplier = 0.5)` |  |
| ui_showRelicSelection | method | `ui_showRelicSelection(options = {})` |  |
| renderRelicPreview | function | `renderRelicPreview(relic, cardEl)` |  |
| ui_rerollRelicSelection | method | `ui_rerollRelicSelection()` |  |
| ui_selectRelic | method | `ui_selectRelic(relic, options = {})` |  |
| ui_resumeRelicReturnState | method | `ui_resumeRelicReturnState(returnState = {}, options = {})` |  |
| ui_skipRelic | method | `ui_skipRelic(options = {})` |  |
| ui_closeRelicSelection | method | `ui_closeRelicSelection(options = {})` |  |
| ui_renderShop | method | `ui_renderShop()` | ⚠️ 巨型函数，见 @section 导航 |
| _grantRunesByRarity | method | `_grantRunesByRarity(rarity, count)` |  |

## 巨型函数内部节点 (@section 标记)

### ui_renderShop

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:shop_resource_summary` | 刷新商店资源摘要 |
| `@section:shop_category_navigation` | 渲染分类与预览 |
| `@section:shop_upgrade_cards` | 渲染升级商品卡 |
| `@section:shop_initial_preview` | 初始化首项预览 |
