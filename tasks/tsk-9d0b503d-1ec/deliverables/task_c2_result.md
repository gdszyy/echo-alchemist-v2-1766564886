# Task C.2 完成报告：战后高压因子联动

## 任务概述

监听 `BOSS_DEFEATED` 事件，实现 Boss 击杀后 3 回合内双词缀精英概率临时提升 25% 的战后高压期机制。

## 实现内容

### 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/core.js` | 在 `boss:defeated` 监听器中新增 `this.postBossRoundsLeft = 3` |
| `src/game_phase.js` | 在 `phase_finalizeRound` 末尾新增 `postBossRoundsLeft` 递减逻辑 |
| `src/game_system.js` | `sys_resetGame`/存档/读档均支持 `postBossRoundsLeft` 字段 |
| `src/spawn_system.js` | `spawn_generateAffixes` 改用 `postBossRoundsLeft` 判断双词缀精英概率提升 |
| `.cursor/rules/spawn_system.md` | 新增规范文档，记录高压因子联动机制（合并了远程已有的导演系统内容） |
| `.cursor/rules/auto_index/src_spawn_system_js_index.md` | 更新函数索引 |
| `.cursor/rules/auto_index/src_game_phase_js_index.md` | 更新函数索引 |

### 核心逻辑

```
BOSS_DEFEATED 事件触发
    ↓
core.js: boss:defeated 监听器
    this.postBossRoundsLeft = 3
    ↓
每回合结算: game_phase.js: phase_finalizeRound()
    if (this.postBossRoundsLeft > 0) this.postBossRoundsLeft--
    ↓
敌人生成: spawn_system.js: spawn_generateAffixes()
    const postBossBonus = (this.postBossRoundsLeft > 0) ? 0.25 : 0;
    const effectiveChance2 = Math.min(chance2 + postBossBonus, 0.40);
```

### 关键决策

1. **监听位置选择**：将 `postBossRoundsLeft = 3` 的设置合并到 `core.js` 的现有 `boss:defeated` 监听器中，而非在 `spawn_system.js` 中新增重复监听，避免逻辑分散。

2. **概率判断升级**：将原有的 `postBossMultiplier > 1.0` 判断替换为 `postBossRoundsLeft > 0`，使双词缀精英概率提升有明确的回合计数控制，与 `postBossMultiplier`（HP 倍率）解耦。

3. **存档完整性**：在 `game_system.js` 的重置/存档/读档三处均同步支持 `postBossRoundsLeft`，确保刷新恢复后状态一致。

## Git Commit

```
feat(spawn): add post-boss pressure factor via BOSS_DEFEATED event

- core.js: 在 boss:defeated 监听器中设置 postBossRoundsLeft = 3
- game_phase.js: phase_finalizeRound 末尾新增 postBossRoundsLeft 递减逻辑
- game_system.js: sys_resetGame/存档/读档均支持 postBossRoundsLeft 字段
- spawn_system.js: spawn_generateAffixes 改用 postBossRoundsLeft 判断双词缀精英概率提升
- .cursor/rules/spawn_system.md: 新增规范文档，记录高压因子联动机制
- auto_index: 更新 spawn_system.js 和 game_phase.js 的函数索引

Task C.2: Boss 击杀后 3 回合内双词缀精英概率临时提升 25%
```
