# Echo Alchemist V2 粒子特效性能评估报告

## 1. 评估背景与目标

随着 Echo Alchemist V2 战斗表现的不断丰富，大量新增的粒子特效对 Canvas 2D 渲染管线造成了显著的性能压力。特别是使用 `lighter` 或 `screen` 混合模式叠加 `shadowBlur` 的特效，在移动端设备上容易导致严重掉帧。根据 `.cursor/rules/performance.md` 自适应性能系统规范，系统已经为基础粒子（如 `ember`、`mist`、`shard`、`spark`、`smoke`）和部分高级特效（如 `Shockwave`、`FireWave`、`LightningBolt`、`HealWave`）建立了基于 FPS 采样的动态预算控制机制。

本次评估旨在全面排查 `src/effects/particles.js` 中的所有特效类，识别尚未接入自适应性能预算的特效，并分析其潜在的性能开销。这些发现将为后续的性能优化提供数据支持和改进建议，确保游戏在各类设备上都能保持流畅运行。

## 2. 已接入性能预算的特效分析

目前系统中已经受到 `CONFIG.performance` 动态限制的特效主要分为基础粒子和部分高级特效。基础粒子（Particle 类）通过 `spawn_createParticle` 和 `spawn_pushParticleWithLimit` 严格受控，包含 `maxParticles`、`windLimit`、`emberLimit`、`mistLimit`、`shardLimit`、`sparkLimit` 和 `smokeLimit` 等多个维度的限制。其性能开销主要集中在 `mist` 和 `ember` 的 `createRadialGradient` 渐变计算以及 `screen` 混合模式的应用上。

高级特效方面，`Shockwave`（冲击波）受 `shockwaveLimit` 限制，使用 `lighter` 混合和 `shadowBlur`，开销处于中等水平。`FireWave`（火焰波）受 `waveLimit` 限制，同样使用 `lighter` 混合并叠加 `createRadialGradient`，开销较高。`HealWave`（治疗波）受 `waveLimit` 限制，包含多层渐变和发光效果，渲染成本显著。此外，`LightningBolt`（闪电链）受 `lightningLimit` 限制，由于需要绘制大量带有 `shadowBlur` 的线段，属于典型的高开销特效。这些特效在低帧率时会自动降级（即降低同屏数量上限），这一机制有效防止了极端战斗场景下的性能雪崩。

## 3. 尚未接入性能预算的特效排查

通过对 `src/effects/particles.js` 和 `src/combat_system.js` 的深度代码扫描，我们发现了多个高级特效目前完全游离于性能预算控制之外。在多敌人同时死亡或高频触发机制的极端战斗场景下，这些特效的无限制生成将成为新的性能瓶颈。

| 特效类名 | 触发场景 | 渲染开销评估 | 性能风险分析 |
| :--- | :--- | :--- | :--- |
| **IceWave** (冰冻死亡波) | 处于冰冻状态（`temp <= -80`）的敌人死亡时触发 | 中等（`lighter` 混合 + `createRadialGradient`） | 当使用范围冰冻技能导致大量敌人同时死亡时，瞬间产生的大量波纹会导致帧率骤降。目前在 `_triggerDeathFX` 中直接推入数组，无上限检查。 |
| **DeathExplosion** (分级死亡消散) | 所有敌人死亡时必定触发（分 boss、elite、normal 三档） | 极高（多层向内收缩环 + 中心虚空渐变孔洞 + 灵魂粒子向心移动） | 每个敌人死亡都会生成且生命周期较长。在清场型技能触发时，会产生毁灭性的性能打击。目前无条件生成。 |
| **EnergyOrb** (能量球/打气反馈) | 子弹命中敌人或 Peg 时飞向 UI 槽的能量反馈 | 较高（发光核心绘制 + 贝塞尔曲线运动轨迹计算） | 在高频多段伤害（如剑刃风暴、激光持续照射）场景下，屏幕上会同时存在数百个能量球，是后期游戏最主要的卡顿来源之一。 |
| **LaserBeam** (激光光束) | 激光武器发射或折射时 | 极高（多层不同透明度线段绘制 + `shadowBlur` + `lighter` 混合） | 多重折射激光会导致屏幕被高亮线段填满，引发严重的 GPU 填充率瓶颈。目前缺乏针对其数量或复杂度的性能分级。 |
| **CollectionBeam** (收集光柱) | 特殊槽或收集机制触发时 | 中等（`lighter` 混合 + `createLinearGradient`） | 虽然数量通常不多，但在特定玩法下可能堆积，目前无预算限制。 |
| **专属技能特效** (BladeStormRing 等) | 剑刃风暴等特定技能触发时 | 中等至高（广泛使用混合模式、渐变和阴影） | 虽然通过 `spawn_pushParticleWithLimit` 受全局 `maxParticles` 限制，但单体开销远大于普通粒子，大量生成会挤占基础粒子预算，导致画面表现失衡。 |

## 4. 优化建议与整改方案

为了彻底解决上述性能隐患，保障游戏的稳定运行，建议在下一阶段采取以下四项整改措施：

首先，**扩展 CONFIG.performance 预算表**。建议在 `src/config.js` 的三档配置（`high`、`medium`、`low`）中新增控制参数。例如，添加 `iceWaveLimit`（如 10/6/3）和 `deathExplosionLimit`（如 15/8/4）来控制死亡特效数量。对于高频触发的反馈，添加 `energyOrbLimit` 严格限制同屏数量（如 40/20/10），超出时可采用数值累加但不渲染特效的策略。对于激光，可添加 `laserComplexity` 参数，在低配模式下限制最大折射次数或关闭边缘发光。

其次，**完善创建函数的拦截逻辑**。在 `combat_system.js` 和 `spawn_system.js` 中，对上述特效的创建逻辑增加类似 `HealWave` 的预算检查。例如，在生成 `IceWave` 前，先读取 `CONFIG.performance[this.perfQualityLevel || 'high'].iceWaveLimit`，若当前数量已达上限则跳过创建。

第三，**针对 DeathExplosion 实施分级渲染策略**。由于 `DeathExplosion` 是必定触发的死亡反馈，直接限制数量会导致部分敌人死亡时没有任何视觉表现。建议根据当前的性能等级动态调整特效的复杂度：在 `high` 模式下完整渲染内缩环、虚空渐变和灵魂粒子；在 `medium` 模式下关闭灵魂粒子，保留内缩环和简单的中心变暗；在 `low` 模式下仅保留最外层的一道内缩环，完全关闭耗时的渐变和混合模式计算。

最后，**针对 EnergyOrb 引入聚合优化机制**。在极高频受击时，与其生成 100 个价值为 1 的能量球，不如合并生成 10 个价值为 10 的大能量球。这需要在 `spawn_createHitFeedback` 中引入短时间窗口内的聚合机制，以在保证视觉反馈强度的同时，大幅削减实体数量和运动计算开销。

## 5. 结论

Echo Alchemist V2 的自适应性能系统架构设计优秀，但目前仍有部分高开销核心特效（如 `DeathExplosion` 和 `EnergyOrb`）未纳入管辖。尽快将这些遗漏的特效接入性能预算，并针对特定特效实施分级渲染和聚合策略，是保障游戏在各端设备上流畅运行的关键下一步。
