# 任务结果：Mikro 分身减伤联动机制实现

## 任务概述
实现了裂变母体·米克罗（Mikro）Boss 的分身减伤联动机制：场上存活的分身（clone 类型敌人）为 Mikro 母体提供伤害减免 buff，分身越多减伤越高。

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/config.js` | 新增参数 | `bossConfigs.mikro` 新增 `cloneDamageReductionPerClone: 0.10` 和 `cloneDamageReductionMax: 0.50` |
| `src/entities/enemy.js` | 核心逻辑 | `takeDamage` 方法新增 Mikro 减伤逻辑和 `🧬-XX%` 视觉反馈 |
| `src/spawn_system.js` | 标记补充 | clone 生成时添加 `clone.isClone = true` 标记 |
| `src/combat_system.js` | 标记补充 | clone 生成时添加 `clone.isClone = true` 标记 |
| `.cursor/rules/config.md` | 文档同步 | 新增 Boss 配置参数说明章节和 Mikro 参数调整记录 |
| `.cursor/rules/entities.md` | 文档同步 | 新增 Mikro 分身减伤机制的参数调整记录 |

## 核心实现逻辑

### 1. config.js 参数新增

```js
mikro: {
    // ...原有参数...
    cloneDamageReductionPerClone: 0.10, // 每个存活分身提供的减伤比例
    cloneDamageReductionMax: 0.50,       // 分身减伤上限（5个分身即达上限）
}
```

### 2. enemy.js takeDamage 减伤逻辑

```js
// [Mikro联动] 分身减伤：Mikro 母体受击时，根据场上存活分身数量减少伤害
if (this.type === 'boss' && this.bossType === 'mikro' && typeof game !== 'undefined') {
    const mikroCfg = CONFIG.balance.bossConfigs && CONFIG.balance.bossConfigs.mikro;
    const reductionPerClone = mikroCfg ? mikroCfg.cloneDamageReductionPerClone : 0.10;
    const reductionMax = mikroCfg ? mikroCfg.cloneDamageReductionMax : 0.50;
    const cloneCount = game.enemies.filter(e => e.active && e.isClone).length;
    if (cloneCount > 0) {
        const damageReduction = Math.min(cloneCount * reductionPerClone, reductionMax);
        actualDamage *= (1 - damageReduction);
        // 显示减伤视觉反馈（限制频率）
        if (!this._cloneReductionTimer || this._cloneReductionTimer <= 0) {
            this._cloneReductionTimer = 8;
            const pct = Math.round(damageReduction * 100);
            game.spawn_createFloatingText(this.pos.x, this.pos.y - 35, `🧬-${pct}%`, '#c084fc');
        } else {
            this._cloneReductionTimer--;
        }
    }
}
```

### 3. isClone 标记（spawn_system.js 和 combat_system.js）

```js
const clone = new Enemy(pos.x, pos.y, w, this.enemyHeight, cloneHp, cloneHp);
clone.affixes = [];
clone.isClone = true; // [Mikro联动] 标记为分身，用于母体减伤计算
```

## 验收标准验证

| 验收条件 | 实现方式 | 状态 |
|----------|----------|------|
| 场上有 3 个分身时，Mikro 受到的伤害减少 30% | `3 * 0.10 = 0.30`，`actualDamage *= 0.70` | ✅ |
| 分身全灭后减伤消失 | `cloneCount = 0` 时跳过减伤逻辑 | ✅ |
| 显示 `🧬-XX%` 浮动文字 | `spawn_createFloatingText` 显示紫色文字 | ✅ |
| Git commit 包含代码修改 + 文档同步 | commit `d33f643` | ✅ |

## Git Commit

- **Commit Hash**: `d33f643`
- **Message**: `feat(mikro): implement damage reduction mechanism for Mikro boss based on alive clone count`
