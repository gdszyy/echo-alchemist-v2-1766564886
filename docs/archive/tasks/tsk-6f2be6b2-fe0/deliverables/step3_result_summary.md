# Step3 实现总结：6种属性共鸣战斗效果

## 任务完成情况

基于 Step2 的设计方案，已在战斗代码中为 cryo、lightning、bounce、pierce、scatter、laser 六种属性实现属性共鸣效果。

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/combat_system.js` | cryo、lightning、bounce、pierce 共鸣效果 |
| `src/spawn_system.js` | scatter 共鸣效果（额外散射子弹数、伤害倍率、角度收窄） |
| `src/combat/collision.js` | laser 共鸣效果（命中额外升温、整体伤害倍率） |
| `src/combat/damage_calc.js` | `combat_lightning_triggerChain` 新增 `chainChanceBonus` 参数 |
| `.cursor/rules/rune_system.md` | 第11.4节更新，补充所有属性的战斗层消费规范 |

## 各属性实现细节

### Cryo（冰霜）- `src/combat_system.js`

读取 `activeElementResonances['cryo']`，在 `enemy.applyTemp(-cryoAmount * config.cryo)` 处：
- `effectiveCryo = config.cryo + baseCryoBonus`：叠加基础属性加成
- `cryoMultiplier`：整体冰霜伤害倍率（1.0/1.2/1.5）
- `freezeTempThreshold`：提升冻结触发温度（-34° → -25°/-15°/-5°）
- `frozenPhysDmgBonus`：三阶共鸣，冻结状态下物理伤害+30%

### Lightning（闪电）- `src/combat_system.js` + `src/combat/damage_calc.js`

读取 `activeElementResonances['lightning']`：
- `effectiveLightning = config.lightning + baseLightningBonus`：叠加基础属性加成
- `chainChanceBonus`：传入 `combat_lightning_triggerChain` 作为新参数，提升触发概率
- `lightningMultiplier`：整体闪电伤害倍率（1.0/1.2/1.5）
- `allowDoubleChain`：三阶共鸣，允许对同一目标二次触发闪电链

### Bounce（弹跳）- `src/combat_system.js`

读取 `activeElementResonances['bounce']`，在暴击判定之前：
- `bounceDmgBonus`：弹跳命中时伤害加成（+15%/+30%/+50%）
- `noBounceDecay`：二/三阶共鸣，弹跳后伤害不衰减（写入 `config._noBounceDecay`）

### Pierce（穿透）- `src/combat_system.js`

读取 `activeElementResonances['pierce']`，在暴击判定之前：
- `pierceDmgBonus`：穿透命中时伤害加成（+15%/+30%/+50%）
- `pierceApplyTemp`：二/三阶共鸣，穿透命中后额外施加火焰温度（+5°/+15°）

### Scatter（散射）- `src/spawn_system.js`

读取 `activeElementResonances['scatter']`，在 `spawn_spawnBullet` 的散射发射逻辑中：
- `extraScatterShots`：额外散射子弹数（+1/+2/+3），叠加到 `scatterCount`
- `scatterMultiplier`：整体伤害倍率（1.0/1.2/1.5），应用到 `resonanceRecipe.damage`
- `scatterAngleReduction`：三阶共鸣，散射角度收窄20%（写入 `_scatterAngleMultiplier`）

### Laser（激光）- `src/combat/collision.js`

读取 `activeElementResonances['laser']`，在 `combat_laser_processPenetration` 普通模式处理中：
- `laserTempBonus`：命中后额外升温（+3°/+8°/+15°）
- `laserMultiplier`：整体伤害倍率（1.0/1.2/1.5），叠加到 `attenuatedDamage` 计算

## 实现规范遵循

- 参数命名：`{element}Resonance`、`{element}ResParams`、`{element}ResMult`
- 安全访问：`this.activeElementResonances && this.activeElementResonances['{element}']`
- 不破坏现有词条效果（blazing_beam、thunderstorm 等）
- 所有参数使用 `|| 0` 或 `|| 1.0` 默认值，确保无共鸣时行为不变

## Git Commit

```
feat(resonance): 实现6种属性共鸣战斗效果 (Step3)
Commit: 0bb7664
```
