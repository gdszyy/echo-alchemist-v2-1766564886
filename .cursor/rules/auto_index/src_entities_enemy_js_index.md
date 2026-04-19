# src/entities/enemy.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 4418 | 函数数: 26 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 3 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| setEnemyAudioProvider | function | L27 | L45 | 19 | `setEnemyAudioProvider(provider)` |
| Enemy | class | L46 | L46 | 1 | `Enemy()` |
| constructor | method | L47 | L180 | 134 | `constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = [])` |
| _initTexture | method | L181 | L300 | 120 | `_initTexture(width, height)` |
| update | method | L301 | L462 | 162 | `update(timeScale, game)` |
| addSwordCrack | method | L463 | L477 | 15 | `addSwordCrack(relPos, angle)` |
| updateTempParticles | method | L478 | L587 | 110 | `updateTempParticles(timeScale)` |
| advance | method | L588 | L590 | 3 | `advance(amount)` |
| startTurnAction | method | L591 | L741 | 151 | `startTurnAction(game)` |
| executeTurnAction | method | L742 | L941 | 200 | `executeTurnAction(game)` |
| performTurnActionAndMove | method | L942 | L1078 | 137 | `performTurnActionAndMove(game)` |
| _getBossActionCount | method | L1079 | L1106 | 28 | `_getBossActionCount(baseCount)` |
| _performOuroborosRotation | method | L1107 | L1151 | 45 | `_performOuroborosRotation(game)` |
| _glaciesFreezePegsOnLanding | method | L1152 | L1177 | 26 | `_glaciesFreezePegsOnLanding(game)` |
| playFreezeBlockEffect | method | L1178 | L1206 | 29 | `playFreezeBlockEffect(game)` |
| triggerLaserHitShake | method | L1207 | L1211 | 5 | `triggerLaserHitShake()` |
| playBurnTickEffect | method | L1212 | L1219 | 8 | `playBurnTickEffect(game, dmg)` |
| playScanFeedback | method | L1220 | L1225 | 6 | `playScanFeedback()` |
| draw | method | L1226 | L3484 | **2259** | `draw(ctx)` |
| addSwordMark | method | L3485 | L3493 | 9 | `addSwordMark(amount = 1)` |
| takeDamage | method | L3494 | L3778 | **285** | `takeDamage(amount, source = null, bypassShield = false)` |
| applyTemp | method | L3779 | L3787 | 9 | `applyTemp(amount)` |
| getBounds | method | L3788 | L3796 | 9 | `getBounds()` |
| _drawEliteDecoration | method | L3797 | L3927 | 131 | `_drawEliteDecoration(ctx, w, h)` |
| _drawBossDecoration | method | L3928 | L4405 | **478** | `_drawBossDecoration(ctx, w, h)` |
| getAbsoluteVertices | method | L4406 | L4419 | 14 | `getAbsoluteVertices()` |

## 巨型函数内部节点 (@section 标记)

### draw (L1226-L3484, 2259行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:draw_shadow_and_base` | L1281 | 软阴影与敌人基础形体绘制 |
| `@section:draw_status_effects` | L1402 | 状态效果视觉（冻结/灼烧/眩晕等） |
| `@section:draw_boss_aura` | L1603 | Boss 专属光环与粒子特效 |
| `@section:draw_health_bar` | L1904 | 血条与护盾条绘制 |
| `@section:draw_affix_icons` | L2105 | 词缀图标与状态标记 |
| `@section:draw_boss_name_plate` | L2406 | Boss 名牌与阶段指示器 |
| `@section:draw_attack_indicators` | L2707 | 攻击预警指示器绘制 |
| `@section:draw_special_projectiles` | L3008 | 特殊投射物与技能特效绘制 |
| `@section:draw_death_animation` | L3209 | 死亡动画与消散特效 |

### takeDamage (L3494-L3778, 285行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:damage_element_reaction` | L3572 | 属性反应触发（克制/共鸣/温度系统） |
| `@section:damage_apply_and_feedback` | L3663 | 伤害应用、浮动文字与击退效果 |
| `@section:damage_death_trigger` | L3724 | 死亡判断与掉落物触发 |

### _drawBossDecoration (L3928-L4405, 478行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:boss_deco_crown_and_wings` | L4016 | 皇冠/翅膀/触手等 Boss 专属装饰 |
| `@section:boss_deco_aura_rings` | L4167 | 光环圆环动画绘制 |
| `@section:boss_deco_rune_symbols` | L4318 | 符文符号与能量纹路绘制 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:draw_entry_and_perf_check` | L1225 | 绘制入口与性能等级检查 |
| `@section:damage_shield_check` | L3493 | 护盾吸收与穿透判断 |
| `@section:boss_deco_phase_check` | L3927 | Boss 阶段检查与装饰基础参数 |
