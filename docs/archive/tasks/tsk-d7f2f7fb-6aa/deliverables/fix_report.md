# 词条「质量坍缩 (mass_collapse)」检查与修复报告

## 任务信息
- **任务 ID**: tsk-d7f2f7fb-6aa
- **词条**: 质量坍缩 (`mass_collapse`)
- **执行日期**: 2026-04-15

## 词条描述
> 强制获得爆炸属性（范围减半）。清空连射与散射，每清空 1 层，爆炸范围 +10%。

来源：`src/rune_config.js`，`effectId: 'mass_collapse'`，`baseParams: { baseRadiusRatio: 0.5, radiusBonusPerLayer: 0.10 }`

---

## 检查结果

### 检查点 1：multicast + scatter 清零并计算 _explosionRadiusMult
**状态：✅ 正确实现**

代码位置：`src/combat_system.js` 第 2379–2387 行

```js
const massCollapseFx = this.activeRunewordEffects['mass_collapse'];
if (massCollapseFx) {
    const { baseRadiusRatio, radiusBonusPerLayer } = massCollapseFx.params;
    const layersCleared = (finalRecipe.multicast || 0) + (finalRecipe.scatter || 0);
    finalRecipe.multicast = 0;
    finalRecipe.scatter = 0;
    finalRecipe.explosive = true;
    finalRecipe._explosionRadiusMult = baseRadiusRatio + layersCleared * radiusBonusPerLayer;
}
```

`layersCleared` 正确累加了 `multicast` 和 `scatter` 两者，并将两者清零。

---

### 检查点 2：爆炸属性强制注入 finalRecipe
**状态：✅ 正确实现**

`finalRecipe.explosive = true` 在 `massCollapseFx` 激活时无条件设置，即使玩家没有爆炸符文也会强制获得爆炸属性。

---

### 检查点 3：基础范围减半（baseRadiusRatio = 0.5）
**状态：✅ 正确实现**

- `rune_config.js` 中：`baseParams: { baseRadiusRatio: 0.5 }`
- 消费方（`combat_system.js` 第 2205 行）：`projectile.pos.dist(other.pos) < 100 * (config._explosionRadiusMult || 1.0)`
- 当 `layersCleared = 0` 时：`_explosionRadiusMult = 0.5`，实际 AOE 半径 = `100 * 0.5 = 50`（减半）

---

### 检查点 4：每层 +10% 的累加逻辑
**状态：✅ 正确实现**

- `rune_config.js` 中：`baseParams: { radiusBonusPerLayer: 0.10 }`
- 计算公式：`_explosionRadiusMult = 0.5 + layersCleared * 0.1`
- 每清空 1 层，AOE 半径增加 `100 * 0.1 = 10`（即原始爆炸范围的 10%）

---

## 发现的问题与修复

### 问题：`.cursor/rules/rune_system.md` 中词条名称错误

**问题描述**：文档第 341 行将词条名称写成了「**质量崩塌**」，与正确名称「**质量坍缩**」不一致。

**修复内容**：将 `.cursor/rules/rune_system.md` 第 341 行的 `**质量崩塌 (`mass_collapse`)**` 修正为 `**质量坍缩 (`mass_collapse`)**`。

**修复文件**：`.cursor/rules/rune_system.md`

**修复前**：
```
**质量崩塌 (`mass_collapse`)**:
```

**修复后**：
```
**质量坍缩 (`mass_collapse`)**:
```

---

## 总结

| 检查点 | 状态 |
|---|---|
| multicast + scatter 清零并计算 `_explosionRadiusMult` | ✅ 正确 |
| 爆炸属性强制注入 `finalRecipe` | ✅ 正确 |
| 基础范围减半（`baseRadiusRatio = 0.5`） | ✅ 正确 |
| 每层 +10% 累加逻辑 | ✅ 正确 |
| 文档名称一致性 | ✅ 已修复（`质量崩塌` → `质量坍缩`） |

**结论**：词条「质量坍缩」的代码实现与描述完全一致，4 个检查点均正确。唯一问题为 `.cursor/rules/rune_system.md` 中的词条名称拼写错误，已完成修复。
