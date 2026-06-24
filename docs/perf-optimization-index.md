# Echo Alchemist V2 性能优化索引报告

> **生成时间**：2026-04-16 | **审计阶段**：TASK-A/B/C/D 全量汇总 | **执行者**：code_auditor (TASK-E)

---

## 1. 执行摘要

本次性能审计全面扫描了 Echo Alchemist V2 的视觉与战斗相关核心代码，覆盖 `particles.js`、`entities.js`、`enemy.js`、`render_system.js`、`combat_system.js`、`spawn_system.js`、`config.js` 共 7 个核心文件，由 TASK-A（粒子特效）、TASK-B（生成系统与配置）、TASK-C（实体与敌人）、TASK-D（渲染与战斗系统）四个子任务协同完成。经过合并去重，共识别出 **58 处**明确的性能瓶颈。

### 1.1 按文件统计瓶颈数量

| 文件 | 瓶颈数量 | 主要问题类型 |
|------|---------|------------|
| `src/effects/particles.js` | 17 | 混合模式/发光叠加、每帧重建渐变、缺少分级渲染逻辑 |
| `src/combat_system.js` | 15 | 特效实例无上限、渐变与阴影高开销、高频调用 |
| `src/entities/enemy.js` | 7 | 渐变创建、阴影渲染、画布创建开销 |
| `src/entities.js` | 7 | 阴影渲染、渐变创建、特效实例无上限 |
| `src/render_system.js` | 5 | 渐变重建、无门控渲染、发光叠加 |
| `src/spawn_system.js` | 4 | 特效实例无上限、O(n) 全量扫描、绕过性能门控 |
| `src/config.js` | 2 | 预算配置缺失、语义混用 |
| `src/game_phase.js`（跨文件） | 1 | 特效实例无上限 |

### 1.2 按优先级分布

| 优先级 | 数量 | 说明 |
|--------|------|------|
| **极高** | 24 | 直接导致帧率断崖式下跌，必须优先修复 |
| **高** | 21 | 在特定场景下造成显著性能损耗 |
| **中** | 11 | 累积效应明显，建议纳入优化计划 |
| **低** | 2 | 轻微浪费，可在后续迭代中处理 |

---

## 2. 完整瓶颈表格

> **[2026-06-25 PixiJS 迁移状态更新]**
> 阶段一～三已将 **26 项**瓶颈的渲染路径迁移至 PixiJS WebGL 管线（标记为 `[MIGRATED-TO-PIXI]`）。
> 这些项目的 Canvas 2D 高开销 API（`shadowBlur`、`createRadialGradient`、`lighter`/`screen` 混合）在 PixiJS 激活时被预烘焙纹理 + GPU 混合模式完全替代，Canvas 2D 路径作为 fallback 保留。
> 未迁移项目（Peg/弹珠/敌人/Boss 渲染、法阵、风锚等）仍需在 Canvas 2D 路径上逐项优化。

按优先级（极高 > 高 > 中 > 低）排序，同优先级内按文件分组。

| 统一编号 | 原编号 | 文件 | 行号范围 | 瓶颈类型 | 高开销 API | 优化原因 | 优先级 |
|---|---|---|---|---|---|---|---|
| **P-001** | ENT-03 | `src/entities.js` | 1063-1075 | 阴影渲染 | `shadowBlur`, `Date.now()` | 风属性钉子和激光钉子的发光效果缺少 `perfQualityLevel` 门控，风属性每帧计算 `Math.sin(Date.now() / 300)` 并实时修改 `shadowBlur`，激光钉子固定 `shadowBlur = 10`，大量同类钉子会导致渲染卡顿 | 极高 |
| **P-002** | ENT-04 | `src/entities.js` | 1642-1800 | 频繁调用 | `Date.now()`, `shadowBlur` | `drawLayoutRoleStyle` 缺少性能门控，且在各种布局下每帧频繁调用 `Date.now()` 计算脉冲，并大量设置 `shadowBlur`，极大影响性能 | 极高 |
| **P-003** | ENT-06 | `src/entities.js` | 2864-3236 | 渐变创建 | `createRadialGradient` | `Ball` 的 `draw` 方法中大量调用 `createRadialGradient` 和 `shadowBlur`（如 `plasmaGrad`、`iceGrad`），完全没有 `perfQualityLevel` 门控，弹珠增多时性能急剧下降 | 极高 |
| **P-004** | ENE-01 | `src/entities/enemy.js` | 171-310 | 画布创建 | `new OffscreenCanvas` | `_initTexture` 在 `Enemy` 构造函数中直接调用并创建 `OffscreenCanvas`。在 `spawn_system.js` 批量生成敌人时，会引发瞬间的密集内存分配和上下文创建，导致帧卡顿。建议将基础纹理预计算并全局缓存 | 极高 |
| **P-005** | ENE-02 | `src/entities/enemy.js` | 1428-1800 | 渐变与阴影 | `createRadialGradient`, `shadowBlur` | 敌人 `affixes`（词缀）渲染逻辑缺少 `perfQualityLevel` 门控，每帧为每个带有词缀的敌人创建渐变并应用阴影，在后期多词缀精英怪群中引发严重性能瓶颈 | 极高 |
| **P-006** | ENE-04 | `src/entities/enemy.js` | 2335-2568 | 渐变创建 | `createRadialGradient`, `createLinearGradient` | `Devourer` Arc Boss 在 `draw` 方法中每帧执行高达 8 次以上的渐变创建（包含引力线循环），且多处无性能门控（如 `DEVOURING` 状态的外层和内层渐变），GC 开销极大 | 极高 |
| **P-007** | ENE-05 | `src/entities/enemy.js` | 2568-2800 | 渐变与阴影 | `createRadialGradient` | `Ouroboros` Arc Boss 在 `draw` 中同样频繁创建渐变（至少 3 次），且大量使用 `shadowBlur`，部分特效（如能量断口）无性能门控 | 极高 |
| **P-008** | ENE-07 | `src/entities/enemy.js` | 1225-2332 | 阴影渲染 | `shadowBlur` | 普通敌人 `draw` 方法中存在多处 `shadowBlur` 调用（共计超过 50 处），绝大部分没有 `perfQualityLevel` 门控，群体出现时严重拖慢渲染帧率 | 极高 |
| **P-009** `[MIGRATED-TO-PIXI]` | P-002 (TASK-B) | `src/combat_system.js` | 3162-3170 | 特效实例无上限 | `createRadialGradient`, `lighter` | 冰冻状态敌人死亡时创建 `IceWave`，未受 `waveLimit` 约束，直接推入数组。清场时会产生大量高开销实例。**PixiJS 迁移后渲染路径已替换为预烘焙冰环纹理 + BLEND_MODES.ADD，Canvas 2D 渐变/混合开销已消除** | 极高 |
| **P-010** `[MIGRATED-TO-PIXI]` | P-003 (TASK-B) | `src/combat_system.js` | 3233-3285 | 特效实例无上限 | `createRadialGradient`, `lighter` | `DeathExplosion` 在任何层级敌人死亡时均未做数量限制，清场时会触发同屏大量爆炸，内部使用多个径向渐变。**PixiJS 迁移后渲染路径已替换为 PIXI.Graphics 三级分支（boss/elite/normal），预烘焙纹理替代每帧渐变** | 极高 |
| **P-011** `[MIGRATED-TO-PIXI]` | P-D08 | `src/combat_system.js` | 3278-3288 | 特效实例无上限 | `new DeathExplosion`, `spawn_createParticle` | 普通敌人死亡时触发的 `DeathExplosion` 没有任何数量上限控制。在玩家使用大范围清场技能瞬间击杀大量普通敌人时，会同时创建几十个爆炸实例，引发严重掉帧。**PixiJS 迁移后渲染路径已替换为 PIXI.Graphics 坍缩环+虚空洞+灵魂粒子** | 极高 |
| **P-012** `[MIGRATED-TO-PIXI]` | P-D09 | `src/combat_system.js` | 3160-3170 | 特效实例无上限 | `new IceWave`, `spawn_createParticle` | 敌人冰冻状态死亡时，直接向 `iceWaves` 数组推入 `IceWave` 实例，缺乏 `CONFIG.performance` 预算检查。同时生成大量冰晶碎片粒子（Boss 20，Elite 12，普通 8）。**PixiJS 迁移后渲染路径已替换为双层冰环 Sprite + BLEND_MODES.ADD** | 极高 |
| **P-013** | P-D13 | `src/combat_system.js` | 1120-1145 | 渐变与阴影 | `createLinearGradient`, `shadowBlur` | `combat_wind_drawButterflyBlades` 中，遍历所有 `butterflyBlades` 时，每帧为每个风刃创建一个 `createLinearGradient`，并且使用 `shadowBlur = 15` 进行发光渲染，随着风刃数量增加，性能急剧下降 | 极高 |
| **P-014** `[MIGRATED-TO-PIXI]` | P-016 / P-017 (TASK-A) | `src/combat_system.js` / `src/game_phase.js` | 3235-3290 / 1616 | 特效实例无上限 | 无 | `DeathExplosion` 在敌人死亡时创建，无全局数量上限限制。清场（如炸弹或范围技能）导致同屏大量敌人同时死亡时，会瞬间产生大量实例。**PixiJS 迁移后渲染开销已由 WebGL 承担，实例上限问题仍待预算系统补充** | 极高 |
| **P-015** `[MIGRATED-TO-PIXI]` | P-018 / P-019 (TASK-A) | `src/combat_system.js` / `src/game_phase.js` | 3166 / 1598 | 特效实例无上限 | 无 | `IceWave` 在冰冻敌人死亡时直接推入数组，无预算检查和数量上限。**PixiJS 迁移后渲染开销已由 WebGL 承担，实例上限问题仍待预算系统补充** | 极高 |
| **P-016** `[MIGRATED-TO-PIXI]` | P-008 (TASK-A) | `src/effects/particles.js` | 730-745 | 混合模式/发光叠加 | `shadowBlur` | `LightningBolt` 在循环中对每个线段多次设置 `shadowBlur` (15, 0, 10) 触发大量 GPU 重绘。**PixiJS 迁移后替换为 PIXI.Graphics 3-pass 辉光 + 端点球，Canvas 2D shadowBlur 已消除** | 极高 |
| **P-017** `[MIGRATED-TO-PIXI]` | P-011 (TASK-A) | `src/effects/particles.js` | 1005-1086 | 混合模式/发光叠加 | `lighter`, `createRadialGradient` | `DeathExplosion` 在 Boss 膨胀、内爆收缩、灵魂粒子阶段多次调用 `lighter` 和 `source-over` 切换，并每帧重建多个径向渐变 (eGrad, vGrad)。**PixiJS 迁移后替换为 PIXI.Graphics 三级分支，BLEND_MODES.ADD 替代 lighter** | 极高 |
| **P-018** `[MIGRATED-TO-PIXI]` | P-012 (TASK-A) | `src/effects/particles.js` | 1144-1211 | 混合模式/发光叠加 | `lighter`, `createRadialGradient`, `shadowBlur`, `createLinearGradient` | `HealWave` 每帧调用 `lighter`，重建径向渐变 (gGrad, rGrad)，多次设置 `shadowBlur` (12, 0, 8, 0)，并在循环中重建线性渐变。**PixiJS 迁移后替换为 3 层预烘焙光晕/环 Sprite + BLEND_MODES.ADD** | 极高 |
| **P-019** `[MIGRATED-TO-PIXI]` | P-015 (TASK-A) | `src/effects/particles.js` | 全局 | 缺少分级渲染逻辑 | 无 | `particles.js` 中的所有特效类（`DeathExplosion`, `EnergyOrb`, `IceWave` 等）均未接入 `perfQualityLevel` 分级渲染逻辑，导致低端设备下无法降级特效细节。**PixiJS 迁移后所有已迁移特效在 draw() 入口通过 pixiIsActive() 门控，低端设备可回退 Canvas 2D 路径** | 极高 |
| **P-020** `[MIGRATED-TO-PIXI]` | P-D16 | `src/effects/particles.js` | 960-1060 | 混合模式/发光叠加 | `createRadialGradient`, `lighter`, `shadowBlur` | `DeathExplosion.draw` 内部在膨胀阶段和虚空阶段，每帧分别创建 `createRadialGradient`，并使用了 `lighter`。虚空孔洞绘制使用大面积径向渐变填充，叠加无上限创建问题，是导致清场卡顿的直接根源。**PixiJS 迁移后替换为 PIXI.Graphics 程序化渲染，所有渐变/混合已由 WebGL 管线替代** | 极高 |
| **P-021** | P-D01 | `src/render_system.js` | 44-132 | 无门控的每帧渲染开销 | `shadowBlur`, `Date.now()` | `render_windAnchors` 函数没有 `perfQualityLevel` 门控检查。每帧使用 `Date.now()` 计算 `Math.sin` 作为脉冲动画，并在连线和锚点绘制中高频调用 `shadowBlur`（最高可达25）。同时还在每帧以一定概率（10%或20%）生成新的火星粒子 | 极高 |
| **P-022** | P-D03 | `src/render_system.js` | retired | 发射器属性轨道已退役 | 已移除运行时调用/预加载 | `render_combat_launcherOrbitals` 原先绘制发射器周围的属性轨道球，并在循环内使用 `createLinearGradient`、`shadowBlur` 与 `screen` 混合。2026-06-23 发射器改为贴图槽位读数 + 炮管方向闪光，该路径不再运行。 | 已解决 |
| **P-023** `[MIGRATED-TO-PIXI]` | P-001 (TASK-B) | `src/spawn_system.js` | 1190-1244 | 特效实例无上限 | 无 | `spawn_createHitFeedback` 中创建 `EnergyOrb` 时没有数量上限检查和时间窗口聚合机制（防抖/节流）。高频命中（如弹珠在钉盘中快速反弹，尤其是共鸣类型）会导致同屏创建大量实例。**PixiJS 迁移后渲染开销已由 PIXI.Graphics 拖尾线+光晕+核心替代，实例上限问题仍待预算系统补充** | 极高 |
| **P-024** | P-B02 | `src/spawn_system.js` | 787-892 | O(n) 全量扫描 | `.filter()` | `spawn_createParticle` 在每帧大量调用时，内部多次执行 `.filter()` 遍历整个 `particles` 数组（如计算风属性数量等），产生显著的 CPU 瓶颈。每次调用最多执行 7 次 `Array.filter()` | 极高 |
| **P-025** | ENT-01 | `src/entities.js` | 1038-1052 | 阴影绘制 | `ellipse` | `pegSoftShadow` 在 `Peg.draw` 中每帧调用，约50个钉子同时执行，虽然有 `_perfBudgetPeg.pegSoftShadow` 门控，但在高端设备上大量绘制依然会导致性能开销，建议缓存为静态图片 | 高 |
| **P-026** | ENT-02 | `src/entities.js` | 1086-1105 | 渐变创建 | `createRadialGradient` | `pegGlowHalo` 每帧为特殊/发光钉子创建径向渐变并使用 `lighter` 模式叠加，虽有 `_perfBudgetPeg.pegGlowHalo` 门控，但在多发光钉子场景下 GC 压力大，建议缓存渐变对象 | 高 |
| **P-027** `[MIGRATED-TO-PIXI]` | ENT-05 | `src/entities.js` | 2380-2415 | 特效实例无上限 | `new EnergyOrb` | `EnergyOrb` 创建位置未做数量检查和限制（直接 `game.energyOrbs.push(orb)`），在多重触发时可能瞬间生成大量对象导致卡顿，建议添加最大数量限制或对象池。**PixiJS 迁移后渲染开销已由 PIXI.Graphics 替代，实例上限问题仍待预算系统补充** | 高 |
| **P-028** | ENE-03 | `src/entities/enemy.js` | 1917-1990 | 阴影渲染 | `shadowBlur`, `Date.now()` | Boss 边框脉冲光晕在 `idle` 状态下无门控，每帧调用 `Date.now()` 计算缓动曲线并修改 `shadowBlur`，甚至包含重绘逻辑，带来持续性能消耗 | 高 |
| **P-029** | ENE-06 | `src/entities/enemy.js` | 2090-2180 | 阴影渲染 | `shadowBlur`, `Date.now()` | `Viridis` Boss 的狂暴状态（绿色脉冲光晕）和过热 Stage 4 状态，完全没有性能门控，每帧实时计算并设置极高的 `shadowBlur`（如 `20 + outerPulse * 15`） | 高 |
| **P-030** `[MIGRATED-TO-PIXI]` | P-D07 | `src/combat_system.js` | 3258-3268 | 特效实例无上限 | `new DeathExplosion`, `spawn_createParticle` | 精英敌人死亡时触发的 `DeathExplosion` 没有数量上限控制，且附带生成多个紫烟粒子和屏幕震动。在清场时容易导致同屏大量触发。**PixiJS 迁移后渲染路径已替换为 PIXI.Graphics 紫晶裂隙+棱片碎落** | 高 |
| **P-031** `[MIGRATED-TO-PIXI]` | P-D10 | `src/combat_system.js` | 3195-3215 | 特效实例无门控 | `spawn_createParticle` | 敌人燃烧状态死亡时，虽然 `FireWave` 的创建有 `waveLimit` 检查，但随后生成的爆炸粒子（ember 和 smoke）缺乏 `CONFIG.performance` 中的 `emberLimit` 和 `smokeLimit` 门控检查，仍然会生成大量粒子。**PixiJS 迁移后 FireWave 渲染已替换为预烘焙火环 Sprite + BLEND_MODES.ADD，ember 粒子已使用预烘焙纹理** | 高 |
| **P-032** | P-D15 | `src/combat_system.js` | 2530-2840 | 高频调用 | `console.log` | 连续激光技能 `combat_continuousLaser_update` 和 `combat_laser_fire` 中存在多个未注释的 `console.log` 调用，在每一帧或每5帧高频触发。在移动端和生产环境中，高频的 I/O 写入会导致不可忽视的性能损耗和内存回收压力 | 高 |
| **P-033** `[MIGRATED-TO-PIXI]` | P-007 (TASK-B) | `src/config.js` | 870-940 | 缺失性能预算 | 无 | `CONFIG.performance` 三档预算中缺失对 `EnergyOrb`、`IceWave`、`DeathExplosion`、`CollectionBeam` 等高频/高开销特效的数量限制配置（无对应的 `limit` 字段）。**PixiJS 迁移后这些特效的渲染开销已由 WebGL 承担，但实例上限配置仍缺失** | 高 |
| **P-034** `[MIGRATED-TO-PIXI]` | P-001 (TASK-A) | `src/effects/particles.js` | 148-156 | 混合模式/发光叠加 | `createRadialGradient`, `screen`, `shadowBlur` | `Particle` (ember 模式) 每帧重建径向渐变，并叠加 `screen` 和 `shadowBlur`，开销极大。**PixiJS 迁移后 ember/mist/venom 粒子已使用预烘焙纹理 Sprite + BLEND_MODES.ADD/SCREEN，Canvas 2D 渐变/混合已消除** | 高 |
| **P-035** `[MIGRATED-TO-PIXI]` | P-003 (TASK-A) | `src/effects/particles.js` | 258-273 | 混合模式/发光叠加 | `lighter`, `shadowBlur` | `SlashEffect` 每帧调用 `lighter` 叠加，并多次设置 `shadowBlur` (10, 20) 触发重绘。**PixiJS 迁移后替换为双 Sprite（核心+辉光）+ BLEND_MODES.ADD** | 高 |
| **P-036** `[MIGRATED-TO-PIXI]` | P-004 (TASK-A) | `src/effects/particles.js` | 328-350 | 混合模式/发光叠加 | `lighter`, `createLinearGradient`, `createRadialGradient` | `CollectionBeam` 每帧调用 `lighter`，并同时重建线性渐变和径向渐变。**PixiJS 迁移后替换为 beam+glow 双 Sprite + BLEND_MODES.ADD** | 高 |
| **P-037** `[MIGRATED-TO-PIXI]` | P-006 (TASK-A) | `src/effects/particles.js` | 450-477 | 混合模式/发光叠加 | `lighter`, `shadowBlur` | `LaserBeam` 每帧调用 `lighter`，并多次设置 `shadowBlur` (20, 10) 触发重绘。**PixiJS 迁移后替换为 PIXI.Graphics 3-pass 辉光折线 + BLEND_MODES.ADD** | 高 |
| **P-038** `[MIGRATED-TO-PIXI]` | P-009 (TASK-A) | `src/effects/particles.js` | 772-774 | 混合模式/发光叠加 | `lighter`, `createRadialGradient` | `FireWave` 每帧调用 `lighter`，并重建径向渐变。**PixiJS 迁移后替换为预烘焙火环 Sprite + 9 焰弧 + BLEND_MODES.ADD** | 高 |
| **P-039** `[MIGRATED-TO-PIXI]` | P-010 (TASK-A) | `src/effects/particles.js` | 815-827 | 混合模式/发光叠加 | `lighter`, `createRadialGradient` | `IceWave` 每帧调用 `lighter`，并重建径向渐变。**PixiJS 迁移后替换为双层冰环 Sprite + BLEND_MODES.ADD** | 高 |
| **P-040** `[MIGRATED-TO-PIXI]` | P-013 (TASK-A) | `src/effects/particles.js` | 1263-1281 | 混合模式/发光叠加 | `lighter`, `shadowBlur` | `BladeStormRing` 每帧调用 `lighter`，并多次设置 `shadowBlur` (16, 6)。**PixiJS 迁移后替换为预烘焙环 Sprite + Graphics 内白环 + BLEND_MODES.ADD** | 高 |
| **P-041** `[MIGRATED-TO-PIXI]` | P-014 (TASK-A) | `src/effects/particles.js` | 1321-1336 | 混合模式/发光叠加 | `lighter`, `createLinearGradient`, `shadowBlur` | `SwordScar` 每帧调用 `lighter`，重建线性渐变，并设置 `shadowBlur` (8)。**PixiJS 迁移后替换为 PIXI.Graphics 3-pass 主痕+副痕 + BLEND_MODES.ADD** | 高 |
| **P-042** `[MIGRATED-TO-PIXI]` | P-019 (TASK-A) | `src/game_phase.js` | 2202, 2141 | 特效实例无上限 | 无 | `CollectionBeam` 在弹珠落底时创建，无预算检查和数量上限。**PixiJS 迁移后渲染开销已由 beam+glow 双 Sprite 替代，实例上限问题仍待预算系统补充** | 高 |
| **P-043** | P-D02 | `src/render_system.js` | 168-320 | 无缓存的高频发光与渐变计算 | `createLinearGradient`, `shadowBlur`, `lighter` | `render_singleWindMatrix` 函数中，每帧通过 `Date.now()` 计算进度和震动。对于 tunnel 法阵，每帧创建新的 `createLinearGradient`；对于 cyclone 旋风法阵，核心使用了 `shadowBlur = 30` 且在内外层都有高频的 `ctx.rotate` 和 `ctx.stroke` 操作。在多法阵同屏时开销极大 | 高 |
| **P-044** | P-004 (TASK-B) | `src/spawn_system.js` | 787-848 | O(n) 全量扫描 | `Array.prototype.filter` | `spawn_createParticle` 在每帧大量调用时，内部多次执行 `.filter()` 遍历整个 `particles` 数组（如计算风属性数量等），产生显著的 CPU 瓶颈 | 高 |
| **P-045** | P-005 (TASK-B) | `src/spawn_system.js` | 1864-1915 | 绕过性能门控 | `shadowBlur`, `createRadialGradient` | `spawn_triggerBossEntranceShockwave` 生成多圈 Boss 入场冲击波时，直接循环 `push` 进数组，绕过了 `spawn_createShockwave` 中的 `shockwaveLimit` 检查 | 高 |
| **P-046** `[MIGRATED-TO-PIXI]` | P-020 (TASK-A) | `src/combat_system.js` | 2767, 2780, 2783 | 潜在上限失效 | `spawn_pushParticleWithLimit` | `BladeStormRing`, `SlashEffect`, `SwordScar` 虽然调用了 `spawn_pushParticleWithLimit`，但该方法内部并未针对这些模式做特定限制，而是统一计入 `maxParticles`。若并发触发，可能瞬间占满全局粒子池。**PixiJS 迁移后这些特效的渲染已由 WebGL 适配器承担，渲染侧压力已大幅降低** | 中 |
| **P-047** `[MIGRATED-TO-PIXI]` | P-D06 | `src/combat_system.js` | 3235-3245 | 特效实例无上限 | `new DeathExplosion`, `spawn_createParticle` | Boss 死亡时触发的 `DeathExplosion` 没有数量上限控制，且附带生成多个 mist 粒子和触发屏幕震动。如果同屏多个 Boss 同时死亡，可能引起瞬间卡顿。**PixiJS 迁移后渲染路径已替换为 PIXI.Graphics boss 级膨胀+灵魂粒子** | 中 |
| **P-048** `[MIGRATED-TO-PIXI]` | P-D11 | `src/combat_system.js` | 140-155 | 闪电链预算检查遗漏 | `new LightningBolt` | `combat_lightning_triggerChain` 触发连锁闪电时，虽然初始打击有 `lightningLimit` 检查，但在密集怪群中，由于每帧的预算检查是基于总量的，瞬发的大量连锁可能在单帧内突破预算或者导致逻辑卡顿。**PixiJS 迁移后 LightningBolt 渲染已替换为 PIXI.Graphics 3-pass 辉光** | 中 |
| **P-049** `[MIGRATED-TO-PIXI]` | P-D12 | `src/combat_system.js` | 2195-2215 | 收集光柱无预算检查 | `new CollectionBeam` | 弹珠掉落收集触发点向 `collectionBeams` 推入新实例时，缺乏上限控制。**PixiJS 迁移后渲染已由 beam+glow 双 Sprite 替代，实例上限问题仍待预算系统补充** | 中 |
| **P-050** | P-D14 | `src/combat_system.js` | 1380-1430 | 风暴核心渲染高开销 | `shadowBlur`, `ctx.rotate` | `combat_wind_drawStormCores` 绘制风暴核心时，除了多次 `ctx.stroke` 画圆环，还使用了 `shadowBlur = 5`，并在循环内部执行了 `ctx.rotate` 来旋转图标，增加了计算开销 | 中 |
| **P-051** `[MIGRATED-TO-PIXI]` | P-002 (TASK-A) | `src/effects/particles.js` | 185-185 | 混合模式/发光叠加 | `createLinearGradient` | `Particle` (wind_slash 模式) 每帧重建线性渐变。**PixiJS 迁移后已使用预烘焙梭形纹理 Sprite + BLEND_MODES.SCREEN** | 中 |
| **P-052** `[MIGRATED-TO-PIXI]` | P-005 (TASK-A) | `src/effects/particles.js` | 384-384 | 混合模式/发光叠加 | `lighter` | `Shockwave` 每帧调用 `lighter` 叠加。**PixiJS 迁移后替换为预烘焙环 Sprite + 7 弧线 3-pass 辉光 + BLEND_MODES.ADD** | 中 |
| **P-053** `[MIGRATED-TO-PIXI]` | P-007 (TASK-A) | `src/effects/particles.js` | 607-630 | 渲染路径优化 | `lighter`, `shadowBlur`, `globalAlpha` | `EnergyOrb` 虽然去掉了 `shadowBlur`（改为0），但仍使用了 `lighter` 叠加和两次 `globalAlpha` 半透明绘制，可通过预渲染或离屏 Canvas 进一步优化。**PixiJS 迁移后替换为 PIXI.Graphics 拖尾线+光晕+核心，BLEND_MODES.ADD 替代 lighter** | 中 |
| **P-054** `[MIGRATED-TO-PIXI]` | P-009 (TASK-B) | `src/effects/particles.js` | 580-660 | 潜在高开销 | `globalCompositeOperation = 'lighter'` | `EnergyOrb.draw` 虽已移除 `shadowBlur` 优化为 `lighter` 模式和半透明圆，但高频大量存在时，每帧对数百个实例切换混合模式仍会带来可观的上下文切换开销。**PixiJS 迁移后由 WebGL BLEND_MODES.ADD 承担，GPU 原生混合无上下文切换开销** | 中 |
| **P-055** | P-006 (TASK-B) | `src/entities.js` | 2130-2145 | 绕过性能门控 | 无 | `smoke` 粒子在燃烧状态的伤害计算中，偶尔被直接 `push` 到 `game.particles` 数组，绕过了 `spawn_pushParticleWithLimit` 的限制 | 中 |
| **P-056** | P-D04 | `src/render_system.js` | 488-520 | 边缘泛光每帧渐变重建 | `createLinearGradient`, `screen` | `drawTiltVignette` 根据手机倾斜度绘制边缘泛光，当偏移量大于0.02时，每帧都会使用 `globalCompositeOperation = 'screen'` 模式，并创建新的 `createLinearGradient` 来填充半屏高度的矩形，造成大量的像素填充开销 | 中 |
| **P-057** | P-010 (TASK-B) | `src/config.js` | 884 | 语义混用 | 无 | `waveLimit` 字段同时被 `FireWave` 和 `HealWave` 共用（见 `combat_system.js:3201` 和 `spawn_system.js:1179`），可能导致这两种不同触发时机的波形特效互相挤占配额 | 低 |
| **P-058** | P-D05 | `src/render_system.js` | 585-615 | 重复发光渲染 | `shadowBlur` | `drawTiltIndicator` 绘制倾斜仪光标时，连续3次调用 `ctx.arc` 绘制同心圆，前两次分别使用了 `shadowBlur = 12` 和 `shadowBlur = 8`，叠加渲染浪费性能 | 低 |

---

## 3. 按优化类型分类的快速检索表

> **[2026-06-25]** 以下分类表中的条目如在 Section 2 主表中标记了 `[MIGRATED-TO-PIXI]`，表示其 Canvas 2D 渲染路径已被 PixiJS WebGL 替代。迁移详情参见主表。

### A. 混合模式/发光叠加（`shadowBlur`、`lighter`、`screen`）

此类问题是本次审计中数量最多的瓶颈类型，主要集中在特效类和渲染系统中。

| 编号 | 文件 | 说明 |
|------|------|------|
| P-001 | `entities.js` | 风属性/激光钉子缺少门控，高频修改 `shadowBlur` |
| P-002 | `entities.js` | `drawLayoutRoleStyle` 每帧大量设置 `shadowBlur` |
| P-003 | `entities.js` | `Ball.draw` 缺少门控，高频 `shadowBlur` 和渐变 |
| P-005 | `enemy.js` | 词缀渲染高频 `shadowBlur` |
| P-007 | `enemy.js` | Ouroboros Boss 大量使用 `shadowBlur` |
| P-008 | `enemy.js` | 普通敌人超 50 处无门控的 `shadowBlur` |
| P-013 | `combat_system.js` | 风刃每帧重建渐变并使用 `shadowBlur` |
| P-016 | `particles.js` | LightningBolt 多次设置 `shadowBlur` 触发大量重绘 |
| P-017 | `particles.js` | DeathExplosion 频繁调用 `lighter` 叠加 |
| P-018 | `particles.js` | HealWave 混合模式与发光开销 |
| P-020 | `particles.js` | DeathExplosion 虚空阶段大面积渐变与 `lighter` 叠加 |
| P-021 | `render_system.js` | `render_windAnchors` 无门控高频 `shadowBlur` |
| P-022 | `render_system.js` | 已退役：属性轨道球不再运行时绘制 |
| P-028 | `enemy.js` | Boss 边框脉冲光晕无门控，每帧修改 `shadowBlur` |
| P-029 | `enemy.js` | Viridis Boss 狂暴状态无门控，极高 `shadowBlur` |
| P-034 | `particles.js` | ember 每帧重建渐变并叠加 `screen` 和 `shadowBlur` |
| P-035 | `particles.js` | SlashEffect 每帧调用 `lighter`，多次设置 `shadowBlur` |
| P-036 | `particles.js` | CollectionBeam 每帧调用 `lighter`，重建渐变 |
| P-037 | `particles.js` | LaserBeam 每帧调用 `lighter`，多次设置 `shadowBlur` |
| P-038 | `particles.js` | FireWave 每帧调用 `lighter`，重建径向渐变 |
| P-039 | `particles.js` | IceWave 每帧调用 `lighter`，重建径向渐变 |
| P-040 | `particles.js` | BladeStormRing 每帧调用 `lighter`，多次设置 `shadowBlur` |
| P-041 | `particles.js` | SwordScar 每帧调用 `lighter`，重建线性渐变 |
| P-043 | `render_system.js` | 法阵每帧创建渐变并高频设置 `shadowBlur = 30` |
| P-051 | `particles.js` | wind_slash 每帧重建线性渐变 |
| P-052 | `particles.js` | Shockwave 每帧调用 `lighter` 叠加 |
| P-053 | `particles.js` | EnergyOrb 使用 `lighter` 和 `globalAlpha` 半透明绘制 |
| P-054 | `particles.js` | EnergyOrb 高频切换混合模式上下文开销 |
| P-056 | `render_system.js` | 边缘泛光每帧使用 `screen` 模式并重建渐变 |
| P-058 | `render_system.js` | 倾斜仪光标叠加使用 `shadowBlur` |

### B. 特效实例无上限

此类问题是造成清场/高频触发时帧率断崖式下跌的主要原因。

| 编号 | 文件 | 说明 |
|------|------|------|
| P-009 | `combat_system.js` | IceWave 冰冻死亡无预算检查 |
| P-010 | `combat_system.js` | DeathExplosion 死亡爆炸无上限 |
| P-011 | `combat_system.js` | 普通敌人 DeathExplosion 无上限 |
| P-012 | `combat_system.js` | 冰冻死亡特效无预算检查 |
| P-014 | `combat_system.js` | DeathExplosion 全局无上限（含 game_phase.js） |
| P-015 | `combat_system.js` | IceWave 全局无上限（含 game_phase.js） |
| P-023 | `spawn_system.js` | EnergyOrb 收集反馈无上限 |
| P-027 | `entities.js` | EnergyOrb 创建未做数量检查 |
| P-030 | `combat_system.js` | 精英敌人 DeathExplosion 无上限 |
| P-042 | `game_phase.js` | CollectionBeam 无预算检查 |
| P-047 | `combat_system.js` | Boss 死亡 DeathExplosion 无上限 |
| P-049 | `combat_system.js` | 收集光柱无预算检查 |

### C. 每帧重建渐变（`createRadialGradient`、`createLinearGradient`）

此类问题造成大量 GC 压力，应通过缓存渐变对象解决。

| 编号 | 文件 | 说明 |
|------|------|------|
| P-003 | `entities.js` | Ball.draw 每帧重建渐变 |
| P-005 | `enemy.js` | 词缀渲染每帧创建渐变 |
| P-006 | `enemy.js` | Devourer Boss 每帧执行 8 次以上渐变创建 |
| P-017 | `particles.js` | DeathExplosion 每帧重建多个径向渐变 |
| P-018 | `particles.js` | HealWave 每帧重建线性与径向渐变 |
| P-022 | `render_system.js` | 已退役：属性轨道球不再运行时绘制 |
| P-026 | `entities.js` | pegGlowHalo 每帧创建径向渐变，GC 压力大 |

### D. 初始化开销与计算冗余

| 编号 | 文件 | 说明 |
|------|------|------|
| P-004 | `enemy.js` | `_initTexture` 构造时同步创建 `OffscreenCanvas` |
| P-024 | `spawn_system.js` | 粒子创建高频执行多达 7 次 `Array.filter()` |
| P-032 | `combat_system.js` | 激光技能高频 `console.log` |
| P-044 | `spawn_system.js` | `spawn_createParticle` O(n) 全量扫描 |
| P-045 | `spawn_system.js` | Boss 入场冲击波绕过 `shockwaveLimit` 门控 |

### E. 未接入性能预算（`CONFIG.performance`）

| 编号 | 文件 | 说明 |
|------|------|------|
| P-001 | `entities.js` | 风属性/激光钉子缺少 `perfQualityLevel` 门控 |
| P-002 | `entities.js` | `drawLayoutRoleStyle` 缺少门控 |
| P-003 | `entities.js` | `Ball.draw` 缺少 `perfQualityLevel` 门控 |
| P-019 | `particles.js` | 全局所有特效类均未接入 `perfQualityLevel` 门控 |
| P-031 | `combat_system.js` | 燃烧爆炸粒子缺乏门控 |
| P-033 | `config.js` | 预算配置本身缺少多种核心特效的 `limit` 字段 |
| P-055 | `entities.js` | smoke 粒子绕过 `spawn_pushParticleWithLimit` |
| P-057 | `config.js` | `waveLimit` 语义混用，FireWave 与 HealWave 共用同一配额字段 |

---

## 4. 下一步行动建议

为迅速提升游戏的帧率稳定性，建议按以下四个阶段推进修复工作：

### 第一阶段：紧急修复（极高优先级，预计 1-2 天）

**目标**：消除清场卡顿和高频触发导致的帧率断崖

1. **建立全局特效预算管理池**：在 `config.js` 中补全限制字段（`energyOrbLimit`、`deathExplosionLimit`、`iceWaveLimit`、`collectionBeamLimit`），并在 `combat_system.js` 和 `spawn_system.js` 中的特效创建入口强制拦截超出预算的实例创建（解决 P-009、P-010、P-011、P-012、P-014、P-015、P-023、P-027）。

2. **为 `particles.js` 全局接入 `perfQualityLevel` 门控**：在所有特效类的 `draw` 方法入口处增加基于性能等级的判断，在 `low` 档直接跳过 `shadowBlur` 和 `lighter` 的调用（解决 P-019）。

3. **修复 `spawn_createParticle` 的 O(n) 遍历**：将 7 次 `Array.filter()` 替换为分类计数器变量（`count_ember`、`count_spark` 等），在粒子增删时同步更新（解决 P-024、P-044）。

### 第二阶段：高优先级优化（预计 3-5 天）

**目标**：减少常规游戏过程中的渲染开销

4. **缓存渐变对象与预渲染**：将 `Enemy` 的 `_initTexture` 改为异步预渲染或全局缓存池（解决 P-004）。对高频创建的渐变（如 Boss 技能、Peg 光晕），在构造函数或尺寸变化时生成并缓存为 `CanvasGradient` 对象或 `OffscreenCanvas`（解决 P-003、P-006、P-017、P-018、P-026）。P-022 已通过退役发射器属性轨道运行时绘制解决。

5. **为实体渲染添加 `perfQualityLevel` 门控**：为 `entities.js` 中的 `drawLayoutRoleStyle`、`Ball.draw` 以及 `enemy.js` 中的词缀渲染、Boss 光晕渲染添加性能等级检查（解决 P-001、P-002、P-003、P-005、P-008）。

6. **清理高频 `console.log`**：注释或删除 `combat_system.js` 中激光技能相关的调试日志（解决 P-032）。

### 第三阶段：中优先级优化（预计 1 周内）

**目标**：消除累积性能损耗和边界情况

7. **修复绕过门控的特效创建**：为 `spawn_triggerBossEntranceShockwave` 添加 `shockwaveLimit` 检查（解决 P-045）；修复 `smoke` 粒子直接 `push` 绕过限制的问题（解决 P-055）。

8. **拆分 `waveLimit` 语义**：将 `config.js` 中的 `waveLimit` 拆分为 `fireWaveLimit` 和 `healWaveLimit`，避免两种特效互相挤占配额（解决 P-057）。

9. **优化 `render_system.js` 的渐变缓存**：为 `render_singleWindMatrix` 和 `drawTiltVignette` 添加渐变缓存机制（解决 P-043、P-056）。

### 第四阶段：低优先级收尾（可纳入常规迭代）

10. **合并同心圆绘制**：将 `drawTiltIndicator` 的三次同心圆绘制合并为一次，消除重复 `shadowBlur` 调用（解决 P-058）。

11. **完善 `BladeStormRing` 等特效的独立计数**：为 `spawn_pushParticleWithLimit` 中的特定模式添加独立限制，防止并发触发占满全局粒子池（解决 P-046）。

---

## 5. PixiJS 迁移覆盖摘要

> 2026-06-25 阶段一～三完成，共迁移 26 项瓶颈的渲染路径。

### 5.1 已迁移特效清单

| 特效类 | 迁移方式 | 解决瓶颈编号 |
|--------|---------|-------------|
| `Particle`（ember/mist/venom） | 预烘焙纹理 Sprite + BLEND_MODES.ADD | P-034 |
| `Particle`（wind_slash） | 预烘焙梭形纹理 Sprite + BLEND_MODES.SCREEN | P-051 |
| `Particle`（line） | 预烘焙线形纹理 Sprite + BLEND_MODES.ADD | — |
| `SlashEffect` | 双 Sprite（核心+辉光） | P-035, P-046 |
| `PierceCutEffect` | PIXI.Graphics 3-pass 辉光 | — |
| `CollectionBeam` | beam+glow 双 Sprite | P-036, P-042, P-049 |
| `LaserBeam` | PIXI.Graphics 3-pass 辉光折线 | P-037 |
| `LightningBolt` | PIXI.Graphics 3-pass 辉光 + 端点球 | P-016, P-048 |
| `FireWave` | 预烘焙火环 Sprite + 9 焰弧 + 8 辐条 | P-038 |
| `IceWave` | 双层冰环 Sprite | P-009, P-012, P-015, P-039 |
| `HealWave` | 3 层预烘焙光晕/环 Sprite | P-018 |
| `DeathExplosion` | PIXI.Graphics 三级分支（boss/elite/normal） | P-010, P-011, P-014, P-017, P-020, P-030, P-047 |
| `Shockwave` | 预烘焙环 Sprite + 7 弧线 3-pass 辉光 + 8 辐条 | P-052 |
| `EnergyOrb` | PIXI.Graphics 拖尾线+光晕+核心 | P-023, P-027, P-053, P-054 |
| `BladeStormRing` | 预烘焙环 Sprite + Graphics 内白环 | P-040 |
| `BladeStormVortex` | 预烘焙涡心 + Graphics 4 螺旋丝 + 3 环 blade | — |
| `SwordScar` | PIXI.Graphics 3-pass 主痕+副痕 | P-041, P-046 |
| `GreedyWheelEffect` | PIXI.Graphics 8 辐条+内圆+4 外弧 | — |
| `FloatingText` | PIXI.Text + TextStyle 描边 + 可选图标 Sprite | — |
| `RewardDropEffect` | PIXI.Graphics 3 子渲染器 | — |

### 5.2 未迁移瓶颈（仍需 Canvas 2D 优化）

| 编号 | 说明 |
|------|------|
| P-001 ~ P-003 | Peg / Ball / 布局角色样式 shadowBlur |
| P-004 ~ P-008 | Enemy / Boss shadowBlur + 渐变 |
| P-013 | butterflyBlades 渐变 + shadowBlur |
| P-021 | render_windAnchors shadowBlur |
| P-024, P-044 | spawn_createParticle O(n) filter |
| P-025, P-026 | Peg pegSoftShadow / pegGlowHalo |
| P-028, P-029 | Boss 边框/Viridis 脉冲 |
| P-032 | console.log 高频调用 |
| P-043 | render_singleWindMatrix 渐变 |
| P-045 | Boss 入场冲击波绕过硬编码限制 |
| P-050 | 风暴核心 shadowBlur |
| P-055 ~ P-058 | 其余未迁移项 |

---

## 6. 变更历史

| 日期 | 内容 |
|------|------|
| 2026-04-16 | 初始审计：TASK-A/B/C/D 全量汇总，58 处瓶颈识别 |
| 2026-06-23 | P-022 标记为已解决：发射器属性轨道已退役 |
| 2026-06-25 | **PixiJS 迁移标记**：26 项瓶颈标记为 `[MIGRATED-TO-PIXI]`，涵盖全部 particles.js 特效类和 5 种粒子模式的 Canvas 2D 渲染路径。新增 Section 5 迁移覆盖摘要。 |

---

*本报告由 TASK-E（code_auditor）汇总 TASK-A、TASK-B、TASK-C、TASK-D 四阶段审计结果生成。*
