# src\ui\rune_launcher.js 函数索引

> 自动生成于 2026-06-18 | 总行数: 2068 | 函数数: 29 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| _ui_buildRuneIconHTML | function | `_ui_buildRuneIconHTML(runeDef, runeLevel, extraClass = '')` |  |
| ui_openRuneLauncher | method | `ui_openRuneLauncher()` |  |
| _ui_updateLauncherShardCount | method | `_ui_updateLauncherShardCount()` |  |
| ui_closeRuneLauncher | method | `ui_closeRuneLauncher()` |  |
| ui_closeRunePicker | method | `ui_closeRunePicker()` |  |
| ui_initRuneGrid | method | `ui_initRuneGrid()` |  |
| ui_openRunePicker | method | `ui_openRunePicker(cellIndex)` |  |
| ui_updateRuneGrid | method | `ui_updateRuneGrid()` |  |
| _ui_updateRuneInventoryDisplay | method | `_ui_updateRuneInventoryDisplay()` |  |
| _ui_renderLauncherInventory | method | `_ui_renderLauncherInventory()` |  |
| _ui_renderManagementInventory | method | `_ui_renderManagementInventory()` |  |
| _ui_updateActivatedRunewordsDisplay | method | `_ui_updateActivatedRunewordsDisplay(activatedRunewords)` |  |
| _ui_updateRuneStatsDisplay | method | `_ui_updateRuneStatsDisplay(activeStats, baseStats = {})` |  |
| _ui_updateResonanceDisplay | method | `_ui_updateResonanceDisplay()` |  |
| _ui_updateRuneActionButtons | method | `_ui_updateRuneActionButtons()` |  |
| ui_doRuneMerge | method | `ui_doRuneMerge()` |  |
| ui_doRuneReforge | method | `ui_doRuneReforge()` |  |
| _ui_playMergeShardFlyEffect | method | `_ui_playMergeShardFlyEffect(startX, startY, amount)` |  |
| _ui_showRuneActionResult | method | `_ui_showRuneActionResult(message, type)` |  |
| ui_switchRuneTab | method | `ui_switchRuneTab(tab)` |  |
| ui_showRunewordDetail | method | `ui_showRunewordDetail(runewordId, level = 1)` |  |
| ui_renderRuneCodex | method | `ui_renderRuneCodex()` |  |
| _ui_renderCodexFilterBar | method | `_ui_renderCodexFilterBar()` |  |
| ui_switchRunewordCodexLevel | method | `ui_switchRunewordCodexLevel(runewordId, level)` |  |
| _ui_calcRunewordDynamicDesc | method | `_ui_calcRunewordDynamicDesc(rw, level)` |  |
| _ui_checkRunewordBubble | method | `_ui_checkRunewordBubble()` |  |
| _ui_showRunewordBubble | method | `_ui_showRunewordBubble(formableRunewords)` |  |
| _ui_hideRunewordBubble | method | `_ui_hideRunewordBubble()` |  |
| ui_autoArrangeRunes | method | `ui_autoArrangeRunes()` |  |

## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:rune_grid_remove_audio` | 符文格移除音效（400Hz，轻柔确认） |
| `@section:rune_picker_place_audio` | 符文从选择器放入格子的确认音效（600Hz） |
| `@section:rune_hover_audio` | 符文词条悬停预览音效（880Hz 极轻，仅提示） |
| `@section:rune_merge_audio` | 符文合成成功音效（880Hz 较响，强调成功感） |
| `@section:rune_reforge_audio` | 符文重铸完成音效（660Hz triangle，柔和质感） |
| `@section:rune_auto_arrange_audio` | 符文自动排布完成音效（660Hz sine） |
