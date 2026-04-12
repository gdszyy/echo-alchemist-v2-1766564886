# Glacies 狂暴阶段冻结 Peg 机制 - 实现报告

## 任务概述

实现了 Glacies（霜晶缝合怪·格拉西斯）Boss 在狂暴阶段跳跃落地后冻结周围钉子（Peg）的机制。

## 修改文件列表

| 文件 | 修改内容 |
|------|----------|
| `src/config.js` | 在 `bossConfigs.glacies` 中新增 `berserkedFreezePegRadius: 120` |
| `src/combat_system.js` | 在 `glacies` case 中添加 `boss._berserkedFreezePegs = true` |
| `src/entities/enemy.js` | 跳跃落地后调用 `_glaciesFreezePegsOnLanding`；新增该方法 |
| `src/entities.js` | Peg 构造函数新增 `frozenTurns`；draw 方法添加蓝色光晕；碰撞检测添加守卫 |
| `src/game_phase.js` | `phase_finalizeRound` 中递减所有 Peg 的 `frozenTurns` |
| `.cursor/rules/game_phase.md` | 更新 glacies Boss 特性描述 |
| `.cursor/rules/config.md` | 新增参数调整记录 |

## 实现细节

### 1. 配置参数 (config.js)
```js
glacies: {
    // ...已有参数...
    berserkedFreezePegRadius: 120, // 狂暴后跳跃落地冻结周围 Peg 的范围（像素）
}
```

### 2. 狂暴触发标志 (combat_system.js)
```js
case 'glacies':
    boss._berserkedJumpRows = bossCfg.berserkedJumpRows || 3;
    boss._berserkedFreezePegs = true; // 新增
    break;
```

### 3. 跳跃落地冻结逻辑 (enemy.js)
- 在 `startTurnAction` 和 `performTurnActionAndMove` 两处跳跃成功后均添加了调用
- 新增 `_glaciesFreezePegsOnLanding(game)` 方法：
  - 读取 `CONFIG.balance.bossConfigs.glacies.berserkedFreezePegRadius`（默认 120）
  - 遍历 `game.pegs`，对范围内的 Peg 设置 `frozenTurns = 2`
  - 播放冰冻音效 + 冲击波特效 + 浮动文字

### 4. Peg 冻结状态 (entities.js)
- 构造函数新增 `this.frozenTurns = 0`
- `draw` 方法：`frozenTurns > 0` 时绘制脉冲蓝色光晕 + 右上角回合数角标
- 碰撞检测：`peg.cooldownTimer <= 0 && peg.frozenTurns <= 0` 才可触发

### 5. 回合结算递减 (game_phase.js)
```js
// --- [Glacies 狂暴] Peg 冻结回合数递减 ---
if (this.pegs && Array.isArray(this.pegs)) {
    this.pegs.forEach(peg => {
        if (peg && peg.frozenTurns > 0) peg.frozenTurns--;
    });
}
```

## Git Commit

```
feat(boss): 实现 Glacies 狂暴阶段冻结周围 Peg 机制
```

Commit Hash: `0fbdaec`（已推送至 GitHub）
