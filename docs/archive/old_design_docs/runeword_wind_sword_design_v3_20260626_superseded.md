# Echo Alchemist V2 飞剑与风属性符文词条设计方案 (V3)

## 1. 核心设计原则（根据反馈修订）

根据最新需求，飞剑（Flying Sword）和风属性（Wind）的获取机制将**完全回归收集阶段的钉子变异（Mutation）与收集（Collection）**，符文词条的作用是**解锁并控制变异概率**。

1.  **无词条不变异**：移除基础的变异概率。如果没有装备对应的符文词条，收集阶段绝对不会出现飞剑或风属性的变异钉子。
2.  **词条解锁变异**：装备对应词条后，解锁同色碰撞变异（如穿透撞穿透变飞剑，反弹撞反弹变风）。
3.  **概率由词条控制**：变异概率使用百分比直接控制（如 `0.7` 代表 70%）。词条等级越高，变异概率越大。
4.  **变异后收集生效**：玩家必须在收集阶段成功利用变异概率打出特殊钉子，并在后续弹珠中收集到该钉子，最终生成的子弹配方（Recipe）才会带有飞剑或风属性。
5.  **视觉表现强化**：由于特殊钉子每回合刷新，必须大幅强化变异瞬间和特殊钉子的常驻视觉效果，让玩家明确感知。

---

## 2. 符文词条定义 (`RUNEWORD_DB`)

引入两个新的词条：**剑意共鸣**（飞剑）和**风暴共鸣**（风属性）。

### 2.1 剑意共鸣 (Sword Resonance) - 飞剑变异解锁
- **Pattern**: `['rune_pierce_1', 'rune_pierce_1', 'rune_pierce_1']` (三个史诗级穿透符文)
- **Effect ID**: `flying_sword_unlock`
- **效果描述**: 
  - Lv1: 【特殊系】解锁飞剑变异。收集阶段穿透弹珠碰撞穿透钉子时，有 70% 概率使其变异为飞剑钉子。
  - Lv2: 飞剑获得自动索敌能力（isAutoHunting），剑痕共鸣附带 50% 元素效果。
  - Lv3: 飞剑化为全自动猎杀模式，母剑消失后依然存留战场，剑痕共鸣附带 100% 元素效果。
- **参数配置**:
  ```javascript
  {
      id: 'runeword_sword_resonance',
      name: '剑意共鸣',
      effectId: 'flying_sword_unlock',
      pattern: ['rune_pierce_1', 'rune_pierce_1', 'rune_pierce_1'],
      effect_desc: '【特殊系】解锁飞剑变异（穿透撞穿透）。词条等级提升时，飞剑将解锁自动索敌与全自动猎杀模式。',
      baseParams: { level: 1, mutationChance: 0.7 }, // 70% 变异概率
      perLevelParams: { level: 1, mutationChance: 0.1 }  // 每级增加 10%
  }
  ```

### 2.2 风暴共鸣 (Storm Resonance) - 风属性变异解锁
- **Pattern**: `['rune_bounce_1', 'rune_bounce_1', 'rune_bounce_1']` (三个普通级反弹符文)
- **Effect ID**: `wind_unlock`
- **效果描述**:
  - Lv1: 【特殊系】解锁风属性变异。收集阶段反弹弹珠碰撞反弹钉子时，有 70% 概率使其变异为风属性钉子。
  - Lv2: 解锁蝴蝶法阵形态（交叉形拓扑触发）。
  - Lv3: 解锁风道形态（狭长拓扑触发）。
- **参数配置**:
  ```javascript
  {
      id: 'runeword_storm_resonance',
      name: '风暴共鸣',
      effectId: 'wind_unlock',
      pattern: ['rune_bounce_1', 'rune_bounce_1', 'rune_bounce_1'],
      effect_desc: '【特殊系】解锁风属性变异（反弹撞反弹）。词条等级提升时，解锁蝴蝶法阵与风道形态。',
      baseParams: { level: 1, mutationChance: 0.7 }, // 70% 变异概率
      perLevelParams: { level: 1, mutationChance: 0.1 }  // 每级增加 10%
  }
  ```

---

## 3. 收集阶段变异机制改造 (`entities.js` & `config.js`)

### 3.1 移除默认变异概率
在 `src/config.js` 中，将 `gameplay.specialMutationMult` 设置为 `0`，确保在没有词条的情况下，绝对不会发生特殊变异。

### 3.2 词条控制变异判定
在 `src/entities.js` 的 `handlePegInteraction` 方法中，重写变异概率的计算逻辑。不再使用默认的乘子，而是直接读取 `game.activeRunewordEffects` 中的 `mutationChance`。

```javascript
// entities.js - handlePegInteraction 逻辑片段
let chance = 0;

if (rule.type === 'mutation') {
    // 检查词条提供的变异概率
    if (typeof game !== 'undefined' && game.activeRunewordEffects) {
        if (rule.result === 'flying_sword' && game.activeRunewordEffects['flying_sword_unlock']) {
            chance = game.activeRunewordEffects['flying_sword_unlock'].params.mutationChance || 0.7;
        } else if (rule.result === 'wind' && game.activeRunewordEffects['wind_unlock']) {
            chance = game.activeRunewordEffects['wind_unlock'].params.mutationChance || 0.7;
        }
    }
} else if (rule.type === 'upgrade') {
    // 升级概率保持原逻辑（基于同化概率 * 升级乘子）
    chance = assimilationChance * (CONFIG.gameplay.specialUpgradeMult || 1.0);
}

if (chance > 0 && Math.random() < chance) {
    // 执行变异或升级逻辑...
}
```

### 3.3 词条等级注入到收集项
当玩家成功打出变异钉子并收集时，在 `entities.js` 的收集逻辑中，我们需要将当前词条的 `level` 注入到收集项中，以便后续 `calc_compileCollectionToRecipe` 能正确解析出 Lv2/Lv3 的飞剑和风属性。

```javascript
// entities.js - 收集逻辑片段
let finalLevel = peg.level || 1;

// 覆盖特殊子弹的等级为词条等级
if (finalType === 'flying_sword' && game.activeRunewordEffects['flying_sword_unlock']) {
    finalLevel = Math.max(finalLevel, game.activeRunewordEffects['flying_sword_unlock'].params.level || 1);
} else if (finalType === 'wind' && game.activeRunewordEffects['wind_unlock']) {
    finalLevel = Math.max(finalLevel, game.activeRunewordEffects['wind_unlock'].params.level || 1);
}

const collectedItem = { type: finalType, level: finalLevel };
this.session.collected.push(collectedItem); 
```

---

## 4. 视觉表现强化方案 (`entities.js` & `spawn_system.js`)

由于特殊钉子每回合刷新，我们必须让变异瞬间和钉子存在期间具有极强的视觉冲击力。

### 4.1 变异瞬间的震撼特效 (Mutation Impact)
修改 `entities.js` 中的变异触发代码：
1.  **冲击波 (Shockwave)**：调用 `game.spawn_createShockwave(peg.pos.x, peg.pos.y, CONFIG.colors[rule.result])`。
2.  **大型爆破**：调用 `game.spawn_createExplosion`。
3.  **高亮浮动文字**：显示 `"✨ MUTATION!"`，并使用对应的元素颜色。

### 4.2 特殊钉子的常驻视觉强化 (Persistent Aura)
修改 `entities.js` 中的 `Peg.draw` 及其子方法：
1.  **强烈脉冲发光 (Pulse Glow)**：
    *   增加风属性 (`drawWindPeg`) 和飞剑 (`drawSwordPeg`) 的 `shadowBlur` 基础值。
    *   使用正弦函数 `(Math.sin(Date.now() / 200) + 1) / 2` 让发光产生明显的呼吸闪烁效果。
2.  **专属特效层 (Aura Layer)**：
    *   **风属性钉子**：在 `drawWindPeg` 中，除了内部的风刃，在钉子外围绘制一个半透明的、快速旋转的动态气旋环。
    *   **飞剑钉子**：在 `drawSwordPeg` 中，增加剑纹的对比度，并在外围添加锐利的十字星芒闪光效果。
3.  **高亮边框**：即使在没有全局光照的情况下，特殊钉子也始终保持高对比度的白色边缘反光。
