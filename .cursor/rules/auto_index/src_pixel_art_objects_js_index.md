# src\pixel\art_objects.js 函数索引

> 自动生成于 2026-10-07 | 总行数: 1097 | 函数数: 72 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| R_ | function | `R_(name)` |  |
| top | function | `top(name)` |  |
| sphere | function | `sphere(r, cx, cy, rad, rampName, o = {})` |  |
| shadeFlat | function | `shadeFlat(out, mask, rampName, base = 2, bevel = 1)` |  |
| stampGlyph | function | `stampGlyph(r, name, x, y, rampName, o = {})` |  |
| idxOf | function | `idxOf(ch)` |  |
| ink | function | `ink(r)` |  |
| mask | function | `mask(w, h, shapes)` |  |
| flatPoly | function | `flatPoly(r, pts, rampName, base = 2)` |  |
| flatRect | function | `flatRect(r, x, y, w, h, rampName, base = 2)` |  |
| etch | function | `etch(r, pts, rampName, lvl)` |  |
| crystal | function | `crystal(r, cx, topY, h, halfW, rampName)` |  |
| marbleRampOf | function | `marbleRampOf(type)` |  |
| drawMarble | function | `drawMarble(type, size = 16)` |  |
| drawAttributeBadge | function | `drawAttributeBadge(glyph, rampName, empty = false)` |  |
| drawAttributeChip | function | `drawAttributeChip(glyph, rampName, empty = false)` |  |
| drawAffixBadge | function | `drawAffixBadge(glyph, rampName)` |  |
| drawRune | function | `drawRune(glyph, rampName, level = 1, seed = 1)` |  |
| obj | function | `obj()` |  |
| oOrb | function | `oOrb(ramp)` |  |
| oStars | function | `oStars(ramp)` |  |
| oLens | function | `oLens(ramp)` |  |
| oSlime | function | `oSlime(ramp)` |  |
| oShield | function | `oShield(ramp, emblem)` |  |
| oElemStone | function | `oElemStone(ramp, glyph, seed = 3)` |  |
| oCrate | function | `oCrate(ramp, glyph)` |  |
| oSurge | function | `oSurge(ramp)` |  |
| oDynamite | function | `oDynamite(ramp)` |  |
| oPrism | function | `oPrism()` |  |
| oDoll | function | `oDoll(ramp)` |  |
| oTube | function | `oTube(ramp)` |  |
| oBarrier | function | `oBarrier(ramp)` |  |
| oCoin | function | `oCoin()` |  |
| oSeal | function | `oSeal(ramp)` |  |
| oVoidCore | function | `oVoidCore(ramp)` |  |
| oHourglass | function | `oHourglass(ramp)` |  |
| oFeather | function | `oFeather(ramp)` |  |
| oApothecary | function | `oApothecary(ramp)` |  |
| oBag | function | `oBag()` |  |
| oChest | function | `oChest(ramp)` |  |
| oVault | function | `oVault(ramp)` |  |
| oSanctum | function | `oSanctum(ramp)` |  |
| oBlade | function | `oBlade(ramp)` |  |
| oTarget | function | `oTarget(ramp)` |  |
| oCore | function | `oCore(ramp)` |  |
| oSiphon | function | `oSiphon(ramp)` |  |
| oSalvo | function | `oSalvo(ramp)` |  |
| oCoil | function | `oCoil(ramp)` |  |
| oFuse | function | `oFuse(ramp)` |  |
| oMirror | function | `oMirror(ramp)` |  |
| oClock | function | `oClock(ramp)` |  |
| oBell | function | `oBell(ramp)` |  |
| oSyringe | function | `oSyringe(ramp)` |  |
| oChip | function | `oChip(ramp)` |  |
| oBurst | function | `oBurst(ramp)` |  |
| oArc | function | `oArc(ramp)` |  |
| etchFree | function | `etchFree(r, pts, color)` |  |
| oPact | function | `oPact(ramp)` |  |
| oWheel | function | `oWheel(ramp)` |  |
| oPegTile | function | `oPegTile(pattern, ramp)` |  |
| oKey | function | `oKey(ramp, glyph)` |  |
| oBandolier | function | `oBandolier()` |  |
| oSlots | function | `oSlots(ramp)` |  |
| oFlask | function | `oFlask(ramp, glyph)` |  |
| oCrystalCluster | function | `oCrystalCluster(ramp, big = false)` |  |
| drawSkillSigil | function | `drawSkillSigil(glyph, rampName)` |  |
| drawCapsule | function | `drawCapsule(rampName)` |  |
| drawPlaque | function | `drawPlaque(rampName = 'brass')` |  |
| drawUnknownSeal | function | `drawUnknownSeal()` |  |
| hasRelicSpec | function | `hasRelicSpec(id)` |  |
| drawRelic | function | `drawRelic(id, fallback = null)` |  |
| drawObject | function | `drawObject(kind, rampName = 'brass', extra = undefined)` |  |
