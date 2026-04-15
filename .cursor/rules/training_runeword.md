# 试炼场符文词条场景扩展规范

## 1. 目标与背景
为了方便开发者和玩家在试炼场（TrainingGround）中测试和体验各种符文词条（Runeword）的效果，需要在现有的试炼场系统中新增一个分类：“符文词条”，并为其添加对应的测试场景。

## 2. 场景分类定义
在 `TRAINING_SCENARIOS.categories` 中新增分类：
```javascript
{ id: 'runeword', name: '符文词条' }
```

## 3. 核心机制处理 (systems.js)
试炼场加载符文词条场景时，需要模拟词条被激活的状态。
在 `loadScenario` 方法中，新增对 `runeword` 分类的特殊处理：
1. **清理旧状态**：在切换场景时，清空 `game.activeRunewordEffects`。
2. **注入词条效果**：如果 `scenario.categoryId === 'runeword'` 且配置了 `runewordId`，则从 `RUNEWORD_DB` 中查找对应词条，并构造模拟的 `activeRunewordEffects` 注入到 `game` 实例中。

```javascript
// 在 loadScenario 中处理
this.game.activeRunewordEffects = {}; // 重置
if (scenario.categoryId === 'runeword' && scenario.runewordId) {
    const rwDef = RUNEWORD_DB.find(rw => rw.id === scenario.runewordId);
    if (rwDef && rwDef.effectId) {
        const level = scenario.runewordLevel || 1;
        const baseParams = rwDef.baseParams || {};
        const perLevelParams = rwDef.perLevelParams || {};
        const params = {};
        for (const key of Object.keys(baseParams)) {
            params[key] = (baseParams[key] || 0) + (level - 1) * (perLevelParams[key] || 0);
        }
        this.game.activeRunewordEffects[rwDef.effectId] = { level, params };
    }
}
```

## 4. 场景用例设计
选择几个具有代表性的词条进行场景配置：

### 4.1 熔毁 (runeword_meltdown)
- **机制**：提升火焰燃烧伤害与爆炸最终伤害。
- **场景布置**：放置高血量敌人，赋予火焰属性子弹。
- **验证点**：观察燃烧和爆炸伤害的数值变化。

### 4.2 专注射击 (runeword_focused_fire)
- **机制**：弹跳和连射转化为基础伤害，概率暴击。
- **场景布置**：放置单个敌人，赋予弹跳和激光属性子弹。
- **验证点**：观察子弹不再弹跳，伤害增加，且出现暴击特效。

### 4.3 质量坍缩 (runeword_mass_collapse)
- **机制**：强制获得爆炸属性，连射/散射层数转爆炸范围。
- **场景布置**：密集敌人阵型，赋予高散射/弹跳子弹。
- **验证点**：子弹命中即爆炸，无散射/弹跳，爆炸范围极大。

### 4.4 动能衰变 (runeword_kinetic_decay)
- **机制**：初始伤害加成，每次命中后衰减。
- **场景布置**：纵列排布的敌人，赋予高穿透子弹。
- **验证点**：观察子弹穿透多个敌人时，伤害数字逐次降低。

### 4.5 嗜血初锋 (runeword_bloodthirst_edge)
- **机制**：击杀累计伤害加成，惩罚冰火属性。
- **场景布置**：放置大量低血量小怪和一个高血量精英怪。
- **验证点**：击杀小怪后，基础伤害逐渐提升。

## 5. 预期改动文件
- `src/systems.js`：修改 `TRAINING_SCENARIOS` 常量，修改 `TrainingGround.prototype.loadScenario`。
