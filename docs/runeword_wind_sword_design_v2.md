# Echo Alchemist V2 飞剑与风属性符文词条设计方案 (V2)

## 1. 当前机制分析与调整目标

根据反馈，我们需要对飞剑（Flying Sword）和风属性（Wind）的符文词条设计进行修订，核心目标如下：

1.  **非全局转换**：Lv1 词条不应该将玩家的所有子弹都变成特殊子弹，而是应该“解锁单颗特殊子弹的发射”。
2.  **词条绑定变异**：没有对应词条时，完全移除收集阶段的钉子变异概率。只有装备了对应的词条，才会激活变异机制。
3.  **变异概率控制**：变异概率使用百分比（如 0.7 即 70%），受词条控制。
4.  **变异视觉强化**：由于每回合刷新，需要显著强化变异发生时和钉子本身的视觉表现，让玩家明确感知到特殊钉子的存在。

## 2. 符文词条设计方案

### 2.1 词条定义 (`RUNEWORD_DB`)

我们将引入两个新的词条：**剑意共鸣**（飞剑）和**风暴共鸣**（风属性）。

#### 1. 剑意共鸣 (Sword Resonance) - 飞剑解锁词条
- **Pattern**: `['rune_pierce_1', 'rune_pierce_1', 'rune_pierce_1']` (三个史诗级穿透符文)
- **Effect ID**: `flying_sword_unlock`
- **设计意图**: 穿透符文的高稀有度匹配飞剑的极高单体爆发。
- **效果描述**: 
  - Lv1: 【特殊系】本回合首发子弹转化为飞剑。收集阶段同色碰撞时，有概率使钉子变异为飞剑钉子。
  - Lv2: 飞剑获得自动索敌能力（isAutoHunting），剑痕共鸣附带 50% 元素效果。
  - Lv3: 飞剑化为全自动猎杀模式，母剑消失后依然存留战场，剑痕共鸣附带 100% 元素效果。
- **参数配置**:
  ```javascript
  {
      id: 'runeword_sword_resonance',
      name: '剑意共鸣',
      effectId: 'flying_sword_unlock',
      pattern: ['rune_pierce_1', 'rune_pierce_1', 'rune_pierce_1'],
      effect_desc: '【特殊系】首发子弹转化为飞剑，并解锁飞剑变异。词条等级提升时，飞剑将解锁自动索敌与全自动猎杀模式。',
      baseParams: { level: 1, mutationChance: 0.7 }, // 70% 变异概率
      perLevelParams: { level: 1, mutationChance: 0.1 }
  }
  ```

#### 2. 风暴共鸣 (Storm Resonance) - 风属性解锁词条
- **Pattern**: `['rune_bounce_1', 'rune_bounce_1', 'rune_bounce_1']` (三个普通级反弹符文)
- **Effect ID**: `wind_unlock`
- **设计意图**: 反弹符文的轨迹特性契合风属性复杂的法阵机制。
- **效果描述**:
  - Lv1: 【特殊系】本回合首发子弹附带风属性。收集阶段同色碰撞时，有概率使钉子变异为风属性钉子。
  - Lv2: 解锁蝴蝶法阵形态（交叉形拓扑触发）。
  - Lv3: 解锁风道形态（狭长拓扑触发）。
- **参数配置**:
  ```javascript
  {
      id: 'runeword_storm_resonance',
      name: '风暴共鸣',
      effectId: 'wind_unlock',
      pattern: ['rune_bounce_1', 'rune_bounce_1', 'rune_bounce_1'],
      effect_desc: '【特殊系】首发子弹附带风属性，并解锁风属性变异。词条等级提升时，解锁蝴蝶法阵与风道形态。',
      baseParams: { level: 1, mutationChance: 0.7 }, // 70% 变异概率
      perLevelParams: { level: 1, mutationChance: 0.1 }
  }
  ```

### 2.2 首发子弹转换机制 (`combat_system.js`)

在战斗阶段发射子弹时（`combat_fireNextShot`），仅对队列中的**第一颗子弹**应用词条转换效果，保留后续子弹（如多重施法 `multicast` 或队列中其他子弹）的原始属性。

```javascript
// 在 combat_system.js 的 combat_fireNextShot 逻辑中：
const isFirstShotOfRound = (this.shotIdCounter === 0); // 判断是否为本回合首发

if (isFirstShotOfRound && this.activeRunewordEffects) {
    // 拦截飞剑词条
    const swordEffect = this.activeRunewordEffects['flying_sword_unlock'];
    if (swordEffect) {
        finalRecipe.type = 'flying_sword';
        finalRecipe.level = Math.max(finalRecipe.level || 1, swordEffect.params.level || 1);
    }
    
    // 拦截风属性词条
    const windEffect = this.activeRunewordEffects['wind_unlock'];
    if (windEffect) {
        finalRecipe.wind = true;
        finalRecipe.level = Math.max(finalRecipe.level || 1, windEffect.params.level || 1);
    }
}
```

## 3. 收集阶段变异机制与视觉强化

### 3.1 变异概率控制 (`entities.js` & `config.js`)

在 `config.js` 中，将基础的 `specialMutationMult` 设为 0，彻底移除无词条时的变异概率。
在 `entities.js` 的同化逻辑中，读取当前激活的词条参数来决定变异概率：

```javascript
// entities.js - 碰撞同化逻辑
let mutationChance = 0;
const ballType = this.def.type;

if (typeof game !== 'undefined' && game.activeRunewordEffects) {
    if (ballType === 'pierce' && game.activeRunewordEffects['flying_sword_unlock']) {
        mutationChance = game.activeRunewordEffects['flying_sword_unlock'].params.mutationChance || 0.7;
    } else if (ballType === 'bounce' && game.activeRunewordEffects['wind_unlock']) {
        mutationChance = game.activeRunewordEffects['wind_unlock'].params.mutationChance || 0.7;
    }
}

// 使用 mutationChance 进行随机判定
if (mutationChance > 0 && Math.random() < mutationChance) {
    // 触发变异...
}
```

### 3.2 视觉表现强化方案

由于特殊钉子每回合刷新，我们需要让变异瞬间和钉子存在期间具有极强的视觉冲击力，确保玩家能清晰捕捉到这一“高光时刻”。

1.  **变异瞬间的震撼特效 (Mutation Impact)**
    *   **冲击波 (Shockwave)**：在变异坐标点生成强烈的元素色冲击波 (`spawn_createShockwave`)。
    *   **大型爆破 (Big Explosion)**：替换原有的普通粒子爆炸，生成更大范围、更多粒子的爆炸特效，颜色对应飞剑（青蓝）或风属性（翠绿）。
    *   **屏幕震动 (Screen Shake)**：触发轻微的屏幕震动，增强打击感。
    *   **高亮浮动文字**：使用更大的字号和发光边框显示 `"✨ MUTATION!"`。

2.  **特殊钉子的常驻视觉强化 (Persistent Aura)**
    *   **强烈脉冲发光 (Pulse Glow)**：在 `Peg.draw` 中，增加特殊钉子的 `shadowBlur` 强度，并让发光半径随时间进行更大幅度的正弦脉冲（Pulse）呼吸变化。
    *   **专属特效层 (Aura Layer)**：
        *   **飞剑钉子**：在钉子周围绘制环绕的微小剑气残影（光效线条），缓慢旋转。
        *   **风属性钉子**：除了原有的内部风刃，在钉子外圈增加一道半透明的旋转气旋环（Tornado Ring）。
    *   **光照穿透 (Rim Light)**：即使在没有全局光照的情况下，特殊钉子也始终保持高对比度的边缘反光，使其在普通钉子群中脱颖而出。
