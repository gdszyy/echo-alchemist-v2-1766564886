# Echo Alchemist: Boss 出现时机与血量算法设计

## 1. 出现时机设计

### 1.1 核心节奏与回合划分
基于《Echo Alchemist》现有的回合推进（Round）和局外升级机制，我们采用**固定里程碑 + 随机区间**的混合设计，参考《Vampire Survivors》的固定分钟数 Boss 与《Brotato》的固定波数 Boss，结合本游戏的符文成长曲线，设计如下节奏：

- **前期（Round 1-5）**：教学与基础流派构建期，无 Boss。
- **中期（Round 6-14）**：流派成型期，开始引入 Mini-Boss。
- **后期（Round 15+）**：高压挑战期，大 Boss 登场，数值呈指数级膨胀。

### 1.2 Boss 出现时刻表

| 回合 (Round) | 遭遇类型 | 出现概率 | 设计目的与体验说明 |
| :--- | :--- | :--- | :--- |
| **Round 5** | **首个 Mini-Boss** | 100% (固定) | **初见杀与流派检验**：此时玩家刚好完成初步的符文积累（3x3网格初具规模），但组合词条（RuneWord）尚未完全成型。Mini-Boss 充当DPS检测机。 |
| **Round 9-11** | 随机 Mini-Boss | 每次 33% | **防疲劳突发事件**：在此区间内随机一回合出现，打破常规清杂兵的节奏，保持紧张感。 |
| **Round 15** | **首个大 Boss** | 100% (固定) | **阶段性高潮**：此时玩家的流派基本成型，大 Boss 拥有极高血量和多个词缀，是对玩家构建深度的终极考验。 |
| **Round 20+** | 循环大 Boss | 每 5 回合 | **无尽挑战**：游戏进入后期，每 5 回合出现一次数值大幅膨胀的 Boss，直至玩家战败。 |

**设计理由**：
1. **避免频繁与稀少**：固定里程碑（5, 15）确保了玩家有明确的短期目标，而随机区间（9-11）则增加了不可预测性，防止玩家完全背板。
2. **首个 Boss 定位**：Round 5 是一个绝佳的节点。根据 `config.js`，前 5 回合是血量指数膨胀的保护期，此时引入首个 Mini-Boss，能让玩家在难度陡增前体验到一次“小考”。

---

## 2. 血量算法设计

### 2.1 现有数值体系分析
当前游戏普通敌人的血量计算公式（见 `spawn_system.js`）：
`线性血量 = (基础血量 + 回合数 * 每回合成长) * 指数因子 * 难度系数`
其中：
- 基础血量 `enemyBaseHp` = 10
- 线性成长 `enemyHpPerRound` = 8
- 指数因子 = `Math.pow(1.12, Math.max(0, Round - 5))`
- DDA 动态难度系数 = `difficultyGrowthFactor` (1.0 或 0.65)
- 精英怪倍率 `eliteHpMult` = 7
- 预设 Boss 倍率 `bossHpMult` = 25

### 2.2 Boss 血量计算公式

为了让 Boss 既有压迫感又不至于无限拖延，我们采用**基础模板血量 + 动态玩家战力适配**的混合公式。

**核心公式**：
```javascript
BossHP = (BaseTemplateHP * 0.5) + (PlayerPeakDPS * ExpectedTurns * 0.5)
```

**参数说明**：
1. **BaseTemplateHP (基础模板血量)**：
   - 基于现有公式：`BaseTemplateHP = (10 + Round * 8) * Math.pow(1.12, Math.max(0, Round - 5)) * BossMultiplier`
   - **Mini-Boss 倍率**：`BossMultiplier = 15` (介于精英的 7 和大 Boss 的 25 之间)
   - **大 Boss 倍率**：`BossMultiplier = 35` (提升原有的 25，强化大 Boss 压迫感)

2. **PlayerPeakDPS (玩家巅峰战力)**：
   - 直接调用 `calc_utils.js` 中的 `calc_getPeakAverageDamage()`。该函数取玩家历史最高 3 轮伤害的平均值，能精准反映玩家当前的真实输出能力。

3. **ExpectedTurns (期望击杀回合数)**：
   - 设定我们希望玩家用多少个回合（弹药队列）击杀 Boss。
   - **Mini-Boss**：期望 `ExpectedTurns = 2.5` 回合击杀。
   - **大 Boss**：期望 `ExpectedTurns = 4.0` 回合击杀。

**最终实现代码示例**：
```javascript
function calculateBossHP(round, isBigBoss) {
    const baseHp = 10;
    const hpPerRound = 8;
    const hpExponent = 1.12;
    const exponentialFactor = Math.pow(hpExponent, Math.max(0, round - 5));
    
    // 1. 计算模板血量
    const bossMult = isBigBoss ? 35 : 15;
    const templateHP = (baseHp + round * hpPerRound) * exponentialFactor * bossMult;
    
    // 2. 获取玩家巅峰战力
    const peakDPS = this.calc_getPeakAverageDamage();
    
    // 3. 计算期望承伤
    const expectedTurns = isBigBoss ? 4.0 : 2.5;
    const dynamicHP = peakDPS * expectedTurns;
    
    // 4. 混合计算 (50% 模板 + 50% 动态)
    // 如果玩家太弱 (peakDPS极低)，保底使用模板血量的 70%
    const finalHP = Math.max(templateHP * 0.7, (templateHP * 0.5) + (dynamicHP * 0.5));
    
    return Math.floor(finalHP);
}
```

### 2.3 数值示例

| 场景 | Round | 模板血量 | 玩家 DPS | 动态血量 | 最终 Boss HP | 实际击杀所需回合 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Round 5 (普通玩家)** | 5 | (10+40)*1*15 = 750 | 200 | 200*2.5 = 500 | (750*0.5)+(500*0.5) = **625** | ~3.1 回合 |
| **Round 5 (天胡玩家)** | 5 | 750 | 500 | 500*2.5 = 1250 | (750*0.5)+(1250*0.5) = **1000** | ~2.0 回合 |
| **Round 15 (大Boss)** | 15 | (10+120)*3.1*35 = 14105 | 3000 | 3000*4 = 12000 | (14105*0.5)+(12000*0.5) = **13052** | ~4.3 回合 |

---

## 3. 玩家体验差异分析与应对

### 3.1 「天胡玩家」体验
**特征**：前期获得强力符文组合（如极早凑出烈焰之语），或局外炼金工坊升满（初始属性高）。
**体验痛点**：如果 Boss 血量完全固定，天胡玩家会一回合秒杀 Boss，导致 Boss 失去威严，游戏变得枯燥。
**应对方案**：
- 我们的公式引入了 50% 的 `PlayerPeakDPS` 权重。天胡玩家的高伤害会直接拉高 Boss 的最终血量（如上表 Round 5，血量从 625 涨到 1000）。
- **结果**：天胡玩家依然能比普通玩家更快击杀 Boss（2回合 vs 3回合），保留了“我很强”的爽感，但 Boss 依然能撑过第一轮爆发，展现出一定的压迫感。

### 3.2 「普通/非酋玩家」体验
**特征**：符文掉落不佳，流派未成形，或局外升级较低。
**体验痛点**：Boss 血量过高导致完全打不动，被 Boss 的高伤害或机制劝退，产生强烈的挫败感。
**应对方案**：
- 公式同样保护了非酋玩家。当 `PlayerPeakDPS` 很低时，动态部分会拉低 Boss 总血量。
- **保底机制**：代码中加入了 `Math.max(templateHP * 0.7, ...)`。即使玩家再弱，Boss 血量也不会低于模板的 70%，确保 Boss 的基本尊严，同时结合现有的 DDA 系统（`difficultyGrowthFactorLow = 0.65`），给予玩家挣扎的空间。

### 3.3 局外升级（Meta Progression）的影响
局外升级（如初始基础伤害提升、属性权重增加）会在游戏开局就提高玩家的战力基数。
- 由于我们的 Boss 血量是**动态读取局内实时 DPS**，局外升级带来的强度提升会被自然捕捉并融入 `PlayerPeakDPS` 中。
- 这意味着局外升满的玩家在 Round 5 遇到的 Boss 会比白板玩家遇到的更肉，从而在整个游戏生命周期中保持挑战性，符合 Roguelike 游戏长线游玩的难度自适应原则。

---

## 4. 总结
本设计方案在不引入任何新系统的前提下，巧妙利用了游戏已有的 `calc_getPeakAverageDamage()` 历史伤害统计算法。通过“固定+随机”的出现时机控制心流节奏，通过“模板+动态适配”的血量公式平衡了各类玩家的体验，完美契合《Echo Alchemist》作为策略 Roguelike 的核心诉求。
