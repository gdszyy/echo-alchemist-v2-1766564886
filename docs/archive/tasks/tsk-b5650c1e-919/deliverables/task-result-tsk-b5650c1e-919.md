# 任务结果：修正 Viridis 狂暴逻辑

**任务 ID**: tsk-b5650c1e-919  
**完成时间**: 2026-04-12  
**Git Commit**: f0fb222 (fix(viridis): 修正狂暴逻辑 - 放弃治疗他人+自身加速再生)

## 修改摘要

修正了翠绿共生体·维里迪斯（Viridis）Boss 的狂暴逻辑，使其符合设计文档的初衷：**狂暴后放弃治疗他人，集中治疗自身并加速再生**。

## 修改内容

### 1. `src/config.js`
- `bossConfigs.viridis.berserkedHealerRange`: `999` → `0`（狂暴后停止治疗其他敌人）
- 新增 `berserkedSelfRegenMult: 3.0`（狂暴后自身回血速度倍率）

### 2. `src/combat_system.js`
- `combat_triggerBossEnrage` 的 viridis case：
  - `boss._berserkedHealerRange = 0`（停止治疗其他敌人）
  - 新增 `boss._berserkedSelfRegenMult = bossCfg.berserkedSelfRegenMult || 3.0`（自身再生倍率）

### 3. `src/entities/enemy.js`
- **regen affix 处理**：Viridis 狂暴时，`heal` 量乘以 `_berserkedSelfRegenMult`（默认 3.0），自身回血速度提升 3 倍
- **healer affix 处理**：Viridis 狂暴时，`effectiveHealerRange` 强制为 0，停止治疗其他敌人
- **Layer 6 视觉效果**：新增 Viridis 狂暴绿色脉冲光晕（双层脉冲：外层 `#22c55e` 慢脉冲 + 内层 `#4ade80` 快脉冲）

### 4. `.cursor/rules/entities.md`
- 新增参数调整记录：Viridis 狂暴逻辑修正

### 5. `.cursor/rules/config.md`
- 新增参数调整记录：Viridis Boss 狂暴配置修正

## 验收标准验证

| 验收标准 | 状态 |
|---------|------|
| Viridis 狂暴后不再治疗其他敌人 | ✅ `_berserkedHealerRange = 0`，`effectiveHealerRange` 强制为 0 |
| Viridis 自身回血速度提升 3 倍 | ✅ `selfRegenMult = _berserkedSelfRegenMult = 3.0` |
| Git commit 包含代码修改 + 文档同步 | ✅ commit f0fb222，5 个文件同步更新 |
| 绿色脉冲光晕视觉反馈 | ✅ Layer 6 新增双层绿色脉冲光晕 |
