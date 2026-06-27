---
id: "PI-011"
version: "v1.0"
last_updated: "2026-06-26"
author: "Codex"
related_modules: ["wave_presets", "spawn_system", "config", "enemy_index"]
status: "active"
---

# PI-011: Enemy Base Affix Compatibility

## 流程概述

敌人“基座词条”同时参与视觉身份、尺寸占格、机制逻辑和导演投放。它们不能再被当作普通随机词条处理；所有入口必须先区分“基座专属词条”和“常规 Overlay 词条”，再按基座相性表过滤。

## 核心防坑指南

### 坑 1: 只从随机池移除基座词条是不够的

**现象**：`spawn_generateAffixes()` 不再随机出 `heavyArmor` / `devour`，但预设波次、随机大型基座或 Boss 入场强化仍可能把冲突词条叠到大型敌人身上。

**根因**：词条有四条投放路径：普通随机池、`ENEMY_WAVE_PRESETS`、`spawn_trySpawnArchetypes()`、`spawn_triggerBossEntranceShockwave()`。只改其中一条会留下漏口。

**正确做法**：随机池调用 `filterRandomEnemyAffixWeights()`；任何已有 `baseArchetype` 的敌人获得或覆盖词条后，都调用 `normalizeEnemyAffixesForArchetype(baseArchetype, affixes)`。

**关键位置**：`src/wave_presets.js` → `ENEMY_BASE_AFFIX_COMPATIBILITY`；`src/spawn_system.js` → `spawn_generateAffixes()` / `spawn_spawnWavePresetSlot()` / `spawn_trySpawnArchetypes()` / `spawn_triggerBossEntranceShockwave()`

### 坑 2: 基座词条不是“更强的普通词条”

**现象**：重型横梁敌人如果叠 `haste` 或 `jump`，行为虽然能跑，但语义会崩：玩家看到的是重型单位，实际却高速移动。

**根因**：基座词条定义身体、占格和主机制；常规词条只应作为一个可读的轻量 Overlay。

**正确做法**：每个基座维护 `requiredAffixes`、`allowedExtraAffixes`、`blockedAffixes`、`maxExtraAffixes`。默认最多 1 个常规 Overlay；例如 `bastion/heavyArmor` 可叠 `shield`，但必须剔除 `haste`、`jump`、`clone`、`healer`。

### 坑 3: 配置曲线里的历史 key 不等于可随机投放

**现象**：`AFFIX_WEIGHT_CURVES` 中可能保留 `devour` 等历史权重，后续 Agent 容易误判它仍是普通随机词条。

**根因**：曲线配置承担历史兼容和调参记录，不再单独决定最终随机池。

**正确做法**：以 `filterRandomEnemyAffixWeights()` 的输出作为普通随机词条事实来源。新增基座词条时必须同步更新相性表、静态预设校验和运行时生成校验。

## 关键耦合点

- `ENEMY_WAVE_PRESET_ARCHETYPES[*].affix` 是基座专属词条来源，`ENEMY_BASE_EXCLUSIVE_AFFIXES` 从它自动收集。
- `ENEMY_BASE_AFFIX_COMPATIBILITY` 是相性规则唯一权威，不要在 `spawn_system.js` 分散写 if/else 黑名单。
- Boss 入场冲击波可以显式制造 Boss 主题随从；但如果命中已有大型基座，必须按该基座的相性规则规范化。
- 测试入口：`tests/validate_wave_presets.mjs` 负责静态规则和预设合法性；`tests/validate_enemy_spawn_runtime.mjs` 负责随机池、slot 生成、Boss 入场强化的运行时漏口。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-06-26 | 初始记录：基座专属词条随机池过滤与基座/常规词条相性规范 | Codex |
