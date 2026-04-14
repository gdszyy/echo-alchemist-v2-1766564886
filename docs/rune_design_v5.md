# 符文词条优化设计方案：机制联动与成长型低级词条 (v5)

## 1. 修改说明（相对 v4）

- 所有词条的 `effect_desc` 去掉了 `【xx系】` 前缀标签。
- "镜像折射"改名为 **"回响射击"**，ID 改为 `runeword_echo_shot`，每级触发概率由 +15% 改为 **+7%**。

---

## 2. 词条设计详细方案（共 6 个）

### 2.1 嗜血初锋 (Bloodthirst Edge)

*   **ID**: `runeword_bloodthirst_edge`
*   **符文组合**: `['rune_pierce_1', 'rune_pyro_1', 'rune_pierce_1']`
*   **effectId**: `bloodthirst_growth`
*   **效果描述**: 每次击杀敌人，本局游戏的全局基础伤害永久 +1。但作为代价，你的冰霜与火焰属性层数降低 30%。
*   **参数配置**:

```javascript
{
    id: 'runeword_bloodthirst_edge',
    name: '嗜血初锋',
    effectId: 'bloodthirst_growth',
    pattern: ['rune_pierce_1', 'rune_pyro_1', 'rune_pierce_1'],
    effect_desc: '每次击杀敌人，本局全局基础伤害永久 +1。但你的冰霜与火焰属性层数降低 30%。',
    baseParams: { damagePerKill: 1, elementPenalty: 0.3 },
    perLevelParams: { damagePerKill: 1, elementPenalty: -0.1 }
}
```

| 等级 | 每次击杀 +伤害 | 冰/火层数惩罚 |
|------|------------|-----------|
| Lv.1 | +1 | -30% |
| Lv.2 | +2 | -20% |
| Lv.3 | +3 | -10% |
| Lv.4 | +4 | 0%（无惩罚）|

---

### 2.2 散射矩阵 (Scatter Matrix)

*   **ID**: `runeword_scatter_matrix`
*   **符文组合**: `['rune_bounce_1', 'rune_lightning_1', 'rune_bounce_1']`
*   **effectId**: `multicast_to_scatter`
*   **效果描述**: 改变发射形态：你的"连射(Multicast)"次数将被转化为等量的"散射(Scatter)"层数。只要该词条存在，你发射的所有子弹基础伤害降低 25%，但散射出的子弹夹角缩小 70%，形成密集的火力网。
*   **参数配置**:

```javascript
{
    id: 'runeword_scatter_matrix',
    name: '散射矩阵',
    effectId: 'multicast_to_scatter',
    pattern: ['rune_bounce_1', 'rune_lightning_1', 'rune_bounce_1'],
    effect_desc: '连射次数全部转化为散射层数。该词条存在时，基础伤害降低 25%，散射子弹的发射夹角缩小 70%。',
    baseParams: { damagePenalty: 0.25, angleMultiplier: 0.3 },
    perLevelParams: { damagePenalty: -0.05, angleMultiplier: -0.1 }
}
```

> `angleMultiplier` 为实际角度系数（原始角度 × 该值），0.3 = 缩小 70%，0.2 = 缩小 80%，以此类推。

| 等级 | 伤害惩罚 | 散射夹角（相对原始） |
|------|--------|--------------|
| Lv.1 | -25% | 30%（缩小 70%）|
| Lv.2 | -20% | 20%（缩小 80%）|
| Lv.3 | -15% | 10%（缩小 90%）|

---

### 2.3 动能衰变 (Kinetic Decay)

*   **ID**: `runeword_kinetic_decay`
*   **符文组合**: `['rune_bounce_1', 'rune_pierce_1', 'rune_bounce_1']`
*   **effectId**: `kinetic_decay`
*   **效果描述**: 子弹初始获得 25% 的伤害加成。但该子弹每次对敌人造成伤害后，此加成会衰减 7%（最低衰减至 0% 加成，不会变成负面）。
*   **参数配置**:

```javascript
{
    id: 'runeword_kinetic_decay',
    name: '动能衰变',
    effectId: 'kinetic_decay',
    pattern: ['rune_bounce_1', 'rune_pierce_1', 'rune_bounce_1'],
    effect_desc: '子弹初始获得 25% 的伤害加成。但该子弹每次对敌人造成伤害后，此加成会衰减 7%（最低衰减至 0% 加成）。',
    baseParams: { initialBonus: 0.25, decayPerHit: 0.07 },
    perLevelParams: { initialBonus: 0.10, decayPerHit: -0.02 }
}
```

| 等级 | 初始加成 | 每次命中衰减 | 归零所需命中次数 |
|------|--------|----------|------------|
| Lv.1 | +25% | -7% | 4 次 |
| Lv.2 | +35% | -5% | 7 次 |
| Lv.3 | +45% | -3% | 15 次 |
| Lv.4 | +55% | -1% | 55 次 |

---

### 2.4 专注射击 (Focused Fire)

*   **ID**: `runeword_focused_fire`
*   **符文组合**: `['rune_laser_1', 'rune_pierce_1', 'rune_laser_1']`
*   **effectId**: `focused_fire`
*   **效果描述**: 将你的所有弹跳属性（Bounce）和连射次数（Multicast）转化为等量的基础伤害。你的伤害有 20% 的概率产生暴击，造成 200% 的伤害。
*   **参数配置**:

```javascript
{
    id: 'runeword_focused_fire',
    name: '专注射击',
    effectId: 'focused_fire',
    pattern: ['rune_laser_1', 'rune_pierce_1', 'rune_laser_1'],
    effect_desc: '将所有弹跳和连射层数转化为基础伤害。伤害有 20% 概率暴击，造成 200% 伤害。',
    baseParams: { critChance: 0.20, critDamage: 2.0 },
    perLevelParams: { critChance: 0.10, critDamage: 0.5 }
}
```

| 等级 | 暴击概率 | 暴击伤害倍率 |
|------|--------|----------|
| Lv.1 | 20% | 200% |
| Lv.2 | 30% | 250% |
| Lv.3 | 40% | 300% |
| Lv.4 | 50% | 350% |

**暴击特效**：触发暴击时，在受击点生成红金色 `spark` 粒子爆发 + 小范围 `Shockwave`（金色，`maxRadius` 覆写为 60），并显示浮动文字 `CRIT! -XXX`（金色）。

---

### 2.5 回响射击 (Echo Shot)

*   **ID**: `runeword_echo_shot`
*   **符文组合**: `['rune_scatter_1', 'rune_bounce_1', 'rune_scatter_1']`
*   **effectId**: `echo_shot`
*   **效果描述**: 每颗子弹首次击中敌人时，有 25% 的概率按照原来的发射角度额外发射一颗相同的子弹（该额外子弹不继承发射次数属性，且每次触发仅限一次）。
*   **参数配置**:

```javascript
{
    id: 'runeword_echo_shot',
    name: '回响射击',
    effectId: 'echo_shot',
    pattern: ['rune_scatter_1', 'rune_bounce_1', 'rune_scatter_1'],
    effect_desc: '子弹首次击中敌人时，有 25% 概率按原角度额外发射一颗单发子弹。',
    baseParams: { triggerChance: 0.25 },
    perLevelParams: { triggerChance: 0.07 }
}
```

| 等级 | 触发概率 |
|------|--------|
| Lv.1 | 25% |
| Lv.2 | 32% |
| Lv.3 | 39% |
| Lv.4 | 46% |
| Lv.5 | 53% |

**实现锚点**：在 `Projectile` 上记录 `_echoShotFired = false`，首次命中时若判定成功，通过 `game.burstQueue` 推入一个 `delay: 0`、`multicast: 0`、`scatter: 0` 的新子弹任务，并将 `_echoShotFired` 标记为 `true`，防止回响子弹再次触发。

---

### 2.6 质量坍缩 (Mass Collapse)

*   **ID**: `runeword_mass_collapse`
*   **符文组合**: `['rune_bounce_1', 'rune_pyro_1', 'rune_bounce_1']`
*   **effectId**: `mass_collapse`
*   **效果描述**: 子弹强制获得爆炸属性，但基础爆炸范围仅为正常值的一半（若已有爆炸属性则在此基础上增加范围）。清空你所有的连射与散射层数，每清空一层，爆炸范围增加 10%。
*   **参数配置**:

```javascript
{
    id: 'runeword_mass_collapse',
    name: '质量坍缩',
    effectId: 'mass_collapse',
    pattern: ['rune_bounce_1', 'rune_pyro_1', 'rune_bounce_1'],
    effect_desc: '强制获得爆炸属性（范围减半）。清空连射与散射，每清空 1 层，爆炸范围 +10%。',
    baseParams: { baseRadiusRatio: 0.5, radiusBonusPerLayer: 0.10 },
    perLevelParams: { baseRadiusRatio: 0.2, radiusBonusPerLayer: 0.05 }
}
```

> 最终爆炸范围 = 标准半径（100）× `(baseRadiusRatio + 清空层数 × radiusBonusPerLayer)`

| 等级 | 基础范围比例 | 每层收益 | 清空 5 层时的范围 |
|------|----------|--------|-------------|
| Lv.1 | 50% | +10% | 100%（满额）|
| Lv.2 | 70% | +15% | 145% |
| Lv.3 | 90% | +20% | 190% |

**实现锚点**：在 `combat_fireNextAmmo` 中，计算 `layersCleared = (finalRecipe.multicast || 0) + (finalRecipe.scatter || 0)`，清零两者，设置 `finalRecipe.explosive = true`，并将 `finalRecipe._explosionRadiusMult = baseRadiusRatio + layersCleared * radiusBonusPerLayer` 存入配方。在爆炸 AOE 判定处（`combat_system.js` 第 2072 行附近），将硬编码的 `100` 改为 `100 * (config._explosionRadiusMult || 1.0)`。

---

## 3. 代码修改文件清单

| 文件 | 修改内容 |
|------|--------|
| `src/rune_config.js` | 新增 6 个词条到 `RUNEWORD_DB` |
| `src/combat_system.js` | 击杀时累加嗜血初锋计数；发射前拦截配方（散射矩阵、专注射击、质量坍缩）；暴击伤害与特效；爆炸范围覆盖 |
| `src/entities/projectile.js` | 首次命中判定（回响射击）；动能衰变逐次衰减；暴击判定 |
| `.cursor/rules/rune_system.md` | 同步更新规范文档 |
