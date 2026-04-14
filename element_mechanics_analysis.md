# Echo Alchemist V2 属性战斗机制分析

本文档基于 `combat_system.js`、`damage_calc.js`、`entities/projectile.js` 及相关配置文件，详细整理了 cryo（冰霜）、lightning（闪电）、bounce（弹跳）、pierce（穿透）、scatter（散射）、laser（激光）六种属性的战斗机制与共鸣增强点。

## 1. Cryo（冰霜）

### 触发条件与机制
- **触发条件**：子弹配置中 `cryo > 0` 时触发冰霜打击。
- **状态施加**：命中敌人时，降低敌人温度，降温量为 `CONFIG.balance.cryoAmount * config.cryo`（`cryoAmount` 默认为 1）。
- **冰冻判定**：当敌人温度 `temp <= -80`（或者有绝对零度等词条强制判定 `temp <= -34`）时，敌人进入冰冻状态。
- **死亡特效**：冰冻状态下死亡会触发冰晶碎片炸裂（Shatter）特效，产生冰波扩散环和冰晶碎片爆发。

### 关键配置参数
- `CONFIG.balance.cryoAmount`: 每次冰霜命中降低的温度基数（默认 1）。
- 词条相关配置：如 `frost_nova`（冰霜新星）、`absolute_zero`（绝对零度）等。

### 伤害/效果计算公式
- **基础降温**：`Δtemp = - (cryoAmount * cryo层数)`。
- **范围冰冻（如爆炸）**：爆炸波及的敌人承受 50% 的降温效果，即 `Δtemp = - (cryoAmount * cryo层数 * 0.5)`。

### 可供共鸣增强的「增强点」
参考 `ELEMENT_RESONANCE_DB.cryo` 的配置，可增强的点包括：
1. **freezeTempThreshold（冰冻触发温度）**：提高冰冻判定的温度阈值（如从 -80 提升至 -25、-15、-5）。
2. **baseCryoBonus（基础属性加成）**：直接增加子弹的 `cryo` 层数。
3. **cryoMultiplier（冰霜伤害倍率）**：整体提升冰霜属性造成的伤害或效果。
4. **frozenPhysDmgBonus（冰冻物理易伤）**：在敌人处于冰冻状态时，额外增加其受到的物理伤害（如 +30%）。

---

## 2. Lightning（闪电）

### 触发条件与机制
- **触发条件**：子弹配置中 `lightning > 0` 时，尝试触发连锁闪电。
- **目标选择**：在 150px 范围内，根据距离平方反比权重随机选择目标。若目标为上一个来源，权重减半以防来回跳跃。
- **状态施加**：成功触发闪电链时，提升敌人温度，升温量为 `config.lightning + chainCount / 3`。

### 关键配置参数
- `CONFIG.mechanics.lightning.baseChainChance`: 基础连锁概率（0.15）。
- `CONFIG.mechanics.lightning.tempChainMult`: 温度对连锁概率的加成系数（0.0085）。
- `CONFIG.mechanics.lightning.maxChainChance`: 最大连锁概率（1.0）。
- `CONFIG.mechanics.lightning.damageDecayBase`: 基础伤害衰减系数（0.45）。
- `CONFIG.mechanics.lightning.damageDecayPerLevel`: 每级闪电增加的伤害保持系数（0.05）。

### 伤害/效果计算公式
- **触发概率**：`P = baseChainChance`。若目标温度 < 0，则 `P = min(maxChainChance, baseChainChance + |temp| * tempChainMult)`。
- **伤害衰减**：`decayFactor = damageDecayBase + (damageDecayPerLevel * lightning层数)`。下一次弹跳伤害 `nextDmg = dmg * decayFactor`。

### 可供共鸣增强的「增强点」
参考 `ELEMENT_RESONANCE_DB.lightning` 的配置，可增强的点包括：
1. **chainChanceBonus（闪电链触发概率）**：提升基础触发概率（如 +15%、+30%、+50%）。
2. **baseLightningBonus（基础属性加成）**：直接增加子弹的 `lightning` 层数。
3. **lightningMultiplier（闪电伤害倍率）**：整体提升闪电造成的伤害。
4. **allowDoubleChain（允许重复连锁）**：允许闪电链对同一目标进行二次触发（或增加额外触发次数）。

---

## 3. Bounce（弹跳）

### 触发条件与机制
- **触发条件**：子弹配置中 `bounce > 0` 时，子弹具有弹跳能力，初始弹跳次数 `bouncesLeft = config.bounce`。
- **碰撞反弹**：命中敌人或墙壁时，根据碰撞法线计算反射向量，改变子弹速度方向。
- **属性交互**：每次弹跳消耗 1 层 `bouncesLeft`。激光折射也会消耗 bounce 层数。

### 关键配置参数
- 无特定 `CONFIG.mechanics.bounce`，主要依赖子弹自身的 `bounce` 属性值和物理引擎的反弹计算。

### 伤害/效果计算公式
- **速度反弹**：`v' = v - 2 * (v · n) * n`（基于碰撞法线 `n` 的镜像反射）。
- 每次弹跳伤害默认不衰减，但可通过词条（如 `kinetic_surge`）在弹跳后增加伤害。

### 可供共鸣增强的「增强点」
参考 `ELEMENT_RESONANCE_DB.bounce` 的配置，可增强的点包括：
1. **bounceDmgBonus（弹跳伤害加成）**：提升弹跳命中时的伤害（如 +15%、+30%、+50%）。
2. **baseBounceBonus（基础属性加成）**：直接增加子弹的 `bounce` 层数（即弹跳次数）。
3. **noBounceDecay（无伤害衰减）**：确保每次弹跳后伤害不衰减（如果系统有默认衰减机制）。
4. **extraBounces（额外弹跳次数）**：在基础层数外额外增加弹跳次数（如 +2）。

---

## 4. Pierce（穿透）

### 触发条件与机制
- **触发条件**：子弹配置中 `pierce > 0` 时，子弹具有穿透能力，初始穿透次数 `piercesLeft = config.pierce`。
- **穿透逻辑**：命中敌人时，不销毁子弹，而是继续飞行并消耗 1 层 `piercesLeft`。同时对穿透的敌人造成伤害。
- **激光穿透**：激光属性会利用 `pierce` 层数计算穿透伤害衰减或伤害加深。

### 关键配置参数
- 无特定 `CONFIG.mechanics.pierce`，主要依赖子弹自身的 `pierce` 属性值。

### 伤害/效果计算公式
- 每次穿透消耗 1 层 `piercesLeft`。
- 激光穿透衰减：第 n 个目标受到的伤害 = `原始伤害 × (0.5)^n`。若有照射词条，穿透层数转为伤害加深：`1 + pierce * 0.01`。

### 可供共鸣增强的「增强点」
参考 `ELEMENT_RESONANCE_DB.pierce` 的配置，可增强的点包括：
1. **pierceDmgBonus（穿透伤害加成）**：提升穿透命中时的伤害（如 +15%、+30%、+50%）。
2. **basePierceBonus（基础属性加成）**：直接增加子弹的 `pierce` 层数（即穿透次数）。
3. **pierceApplyTemp（穿透附带升温）**：穿透命中后额外施加火焰温度（如 +5、+15）。
4. **extraPierces（额外穿透次数）**：在基础层数外额外增加穿透次数（如 +1）。

---

## 5. Scatter（散射）

### 触发条件与机制
- **触发条件**：子弹配置中 `scatter > 0` 时，在发射阶段（`spawn_system.js`）将主子弹分裂为多个散射子弹。
- **分裂逻辑**：生成 `scatterCount` 个额外副子弹。其中一半（向下取整）100% 继承主子弹属性，另一半 50% 继承主子弹属性（伤害、属性层数减半）。
- **角度偏移**：根据生成的索引，向主射击方向两侧交替偏移，每次偏移 `0.2 * multiplier` 弧度。

### 关键配置参数
- 无特定 `CONFIG.mechanics.scatter`，主要依赖子弹自身的 `scatter` 属性值。

### 伤害/效果计算公式
- **子弹数量**：总发射子弹数 = `1 (主子弹) + scatter层数`。
- **全继承副子弹**：数量 `floor(scatter / 2)`，伤害与属性 100% 继承。
- **半继承副子弹**：数量 `scatter % 2`，伤害与属性（包括 damage, cryo, pyro 等）乘以 0.5 并向下取整。

### 可供共鸣增强的「增强点」
参考 `ELEMENT_RESONANCE_DB.scatter` 的配置，可增强的点包括：
1. **extraScatterShots（额外散射数量）**：增加散射分裂出的子弹数量（如 +1、+2、+3）。
2. **baseScatterBonus（基础属性加成）**：直接增加子弹的 `scatter` 层数。
3. **scatterMultiplier（散射伤害倍率）**：整体提升散射子弹造成的伤害。
4. **scatterAngleReduction（散射角度收窄）**：减小散射子弹之间的夹角，使火力更集中（如缩小 20%）。

---

## 6. Laser（激光）

### 触发条件与机制
- **触发条件**：子弹配置中 `laser > 0` 时，发射瞬间穿透的激光束（非实体子弹），直接进行射线检测（Raycast）。
- **穿透与折射**：激光会穿透路径上的敌人。若 `bounce > pierce`，则在首个目标处触发折射；若 `pierce >= bounce`，则在最后一个目标处触发折射（如果 `bounce > 0`）。折射会消耗 `bounce` 层数。
- **状态施加**：激光本身不附带特殊状态，但可与其他属性（如火、冰）结合。

### 关键配置参数
- `CONFIG.gameplay.laserRefractionBaseChance`: 折射基础触发概率 (0.30)。
- `CONFIG.gameplay.laserRefractionBounceBonus`: 每层 bounce 增加的触发概率 (+0.05)。
- `CONFIG.gameplay.laserRefractionMaxChance`: 折射触发概率上限 (0.80)。
- `CONFIG.gameplay.laserRefractionDamageDecay`: 每次折射的伤害衰减系数 (0.75)。

### 伤害/效果计算公式
- **激光长度**：`maxLen = 500 * 1.35 + pierce * 250 + laserLengthBonus`。
- **激光宽度**：`mainWidth = 3 + laser * 4 + (explosive ? 10 : 0)`。
- **穿透衰减**：第 n 个目标受到的伤害 = `原始伤害 × (0.5)^n`。
- **折射概率**：`baseChance = min(maxChance, baseChance + bouncesLeft * bounceBonus)`。

### 可供共鸣增强的「增强点」
参考 `ELEMENT_RESONANCE_DB.laser` 的配置，可增强的点包括：
1. **laserTempBonus（激光命中升温）**：激光每次命中额外提升敌人温度（如 +3°、+8°、+15°）。
2. **baseLaserBonus（基础属性加成）**：直接增加子弹的 `laser` 层数（增加宽度）。
3. **laserMultiplier（激光伤害倍率）**：整体提升激光造成的伤害。
4. **extraLaserPierces（额外激光穿透）**：增加激光的穿透次数或延长激光长度。

