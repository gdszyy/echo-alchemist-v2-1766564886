# src\rune_system.js 函数索引

> 自动生成于 2026-06-27 | 总行数: 572 | 函数数: 13 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| getRuneId | function | `getRuneId(entry)` |  |
| parseRuneGrid | function | `parseRuneGrid(grid, runewordDb)` |  |
| calcRuneBaseStats | function | `calcRuneBaseStats(runeGrid, runeDb)` |  |
| findRunewordSpellMatches | function | `findRunewordSpellMatches(runeword, idGrid)` |  |
| findCoreAxisMatches | function | `findCoreAxisMatches(pattern, idGrid, formula = {})` |  |
| findLooseLineMatches | function | `findLooseLineMatches(pattern, idGrid)` |  |
| findPatternInSequence | function | `findPatternInSequence(pattern, indices, idGrid)` |  |
| sequenceMatchesPatternUnordered | function | `sequenceMatchesPatternUnordered(sliceRunes, pattern)` |  |
| _removeRuneFromInventory | function | `_removeRuneFromInventory(runeInventory, runeObj)` |  |
| rune_merge | function | `rune_merge(runeObjects, runeInventory)` |  |
| rune_reforge | function | `rune_reforge(runeObjects, runeInventory, game)` |  |
| getNewRunewordsOnPlacement | function | `getNewRunewordsOnPlacement(currentGrid, cellIndex, runeEntry, runewordDb)` |  |
| fuseRuneIntoBoard | function | `fuseRuneIntoBoard(game, runeEntry, runeDb)` |  |
