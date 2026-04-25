# src/entities/enemy.js 函数索引

> 自动生成于 2026-04-25 | 总行数: 4845 | 函数数: 27 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 3 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| setEnemyAudioProvider | function | `setEnemyAudioProvider(provider)` |  |
| Enemy | class | `Enemy()` |  |
| constructor | method | `constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = [])` |  |
| initSprite | method | `initSprite()` |  |
| _initTexture | method | `_initTexture(width, height)` |  |
| update | method | `update(timeScale, game)` |  |
| addSwordCrack | method | `addSwordCrack(relPos, angle)` |  |
| updateTempParticles | method | `updateTempParticles(timeScale)` |  |
| advance | method | `advance(amount)` |  |
| startTurnAction | method | `startTurnAction(game)` |  |
| executeTurnAction | method | `executeTurnAction(game)` |  |
| performTurnActionAndMove | method | `performTurnActionAndMove(game)` |  |
| _getBossActionCount | method | `_getBossActionCount(baseCount)` |  |
| _performOuroborosRotation | method | `_performOuroborosRotation(game)` |  |
| _glaciesFreezePegsOnLanding | method | `_glaciesFreezePegsOnLanding(game)` |  |
| playFreezeBlockEffect | method | `playFreezeBlockEffect(game)` |  |
| triggerLaserHitShake | method | `triggerLaserHitShake()` |  |
| playBurnTickEffect | method | `playBurnTickEffect(game, dmg)` |  |
| playScanFeedback | method | `playScanFeedback()` |  |
| draw | method | `draw(ctx)` | ⚠️ 巨型函数，见 @section 导航 |
| addSwordMark | method | `addSwordMark(amount = 1)` |  |
| takeDamage | method | `takeDamage(amount, source = null, bypassShield = false)` | ⚠️ 巨型函数，见 @section 导航 |
| applyTemp | method | `applyTemp(amount)` |  |
| getBounds | method | `getBounds()` |  |
| _drawEliteDecoration | method | `_drawEliteDecoration(ctx, w, h)` |  |
| _drawBossDecoration | method | `_drawBossDecoration(ctx, w, h)` | ⚠️ 巨型函数，见 @section 导航 |
| getAbsoluteVertices | method | `getAbsoluteVertices()` |  |

## 巨型函数内部节点 (@section 标记)

### draw

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:draw_shadow_and_base` | 软阴影与敌人基础形体绘制 |
| `@section:draw_status_effects` | 状态效果视觉（冻结/灼烧/眩晕等） |
| `@section:draw_boss_aura` | Boss 专属光环与粒子特效 |
| `@section:draw_health_bar` | 血条与护盾条绘制 |
| `@section:draw_affix_icons` | 词缀图标与状态标记 |
| `@section:draw_boss_name_plate` | Boss 名牌与阶段指示器 |
| `@section:draw_attack_indicators` | 攻击预警指示器绘制 |
| `@section:draw_special_projectiles` | 特殊投射物与技能特效绘制 |
| `@section:draw_death_animation` | 死亡动画与消散特效 |

### takeDamage

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:damage_element_reaction` | 属性反应触发（克制/共鸣/温度系统） |
| `@section:damage_apply_and_feedback` | 伤害应用、浮动文字与击退效果 |
| `@section:damage_death_trigger` | 死亡判断与掉落物触发 |

### _drawBossDecoration

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:boss_deco_crown_and_wings` | 皇冠/翅膀/触手等 Boss 专属装饰 |
| `@section:boss_deco_aura_rings` | 光环圆环动画绘制 |
| `@section:boss_deco_rune_symbols` | 符文符号与能量纹路绘制 |

## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:draw_entry_and_perf_check` | 绘制入口与性能等级检查 |
| `@section:damage_shield_check` | 护盾吸收与穿透判断 |
| `@section:boss_deco_phase_check` | Boss 阶段检查与装饰基础参数 |
