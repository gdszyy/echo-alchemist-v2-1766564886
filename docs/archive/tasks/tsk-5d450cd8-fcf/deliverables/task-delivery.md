# 任务交付物：Chimera 狂暴阶段受击触发全场爆炸

## 任务 ID
tsk-5d450cd8-fcf

## Git Commit
`c945fe5` - feat(chimera): 实现狂暴阶段受击触发全场爆炸

## 修改文件清单

### 代码文件
1. **`src/config.js`** - `bossConfigs.chimera` 新增 `berserkedBlastOnHitChance: 0.25`
2. **`src/combat_system.js`** - `combat_triggerBossEnrage` chimera case 新增 `boss._berserkedBlastOnHitChance` 标志赋值
3. **`src/entities/enemy.js`** - `takeDamage` 方法新增 Chimera 狂暴爆炸逻辑

### 规范文档
4. **`.cursor/rules/entities.md`** - 同步更新参数调整记录
5. **`.cursor/rules/config.md`** - 同步更新参数调整记录

## 功能实现说明

### 1. 配置层（config.js）
```js
chimera: {
    // ...
    berserkedBlastOnHitChance: 0.25, // 狂暴后受击触发全场爆炸概率
}
```

### 2. 狂暴触发层（combat_system.js）
```js
case 'chimera':
    boss.temp = bossCfg.berserkedTempThreshold || 100;
    // 记录受击触发全场爆炸概率
    boss._berserkedBlastOnHitChance = bossCfg.berserkedBlastOnHitChance || 0.25;
    break;
```

### 3. 受击逻辑层（enemy.js takeDamage）
- 检测条件：`type === 'boss' && bossType === 'chimera' && berserked && _berserkedBlastOnHitChance`
- 触发概率：25%（`Math.random() < this._berserkedBlastOnHitChance`）
- 视觉效果：
  - 橙色冲击波（`spawn_createShockwave`，颜色 `#f97316`）
  - 20 个红橙色 ember 粒子（颜色 `#ef4444` / `#f97316`）
  - 浮动文字 `💥CHAOS BLAST!`（橙色 `#f97316`）
- 逻辑效果：
  - 随机禁用 3 个未冷却的 Peg（`cooldownTimer = 1000`）
  - 被禁用的 Peg 视觉缩小（`scale = 0.5`）
  - 显示 `🚫` 浮动文字标记

## 验收标准达成情况
- ✅ Chimera 狂暴后受击时，约 25% 概率触发全场冲击波
- ✅ 爆炸有明显视觉反馈（红橙色粒子 + 冲击波）
- ✅ Git commit 包含代码修改 + 文档同步
- ✅ 爆炸效果不直接伤害玩家血量，而是随机禁用 3 个 Peg 持续 1 回合
