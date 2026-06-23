# 自适应性能系统规范 (performance.md)

> **状态**：已实现（2026-04-16）  
> **涉及文件**：`src/config.js`、`src/core.js`、`src/game_system.js`、`src/render_system.js`、`src/spawn_system.js`、`src/combat_system.js`、`src/combat/damage_calc.js`、`src/entities.js`、`src/entities/enemy.js`

---

## 1. 设计目标

Echo Alchemist V2 以 Canvas 2D API 渲染，在中低端手机上粒子特效和混合模式叠加会造成严重掉帧。本系统通过**实时采样平均帧率**，在运行时自动调整特效等级，使游戏在所有设备上保持流畅，同时在高端设备上保留完整视觉效果。

---

## 2. 性能瓶颈分析（优先级由高到低）

| 排名 | 瓶颈来源 | 每帧开销原因 | 涉及文件 |
|------|---------|------------|---------|
| 1 | **粒子系统**（`mist`/`ember`/`shard`） | `createRadialGradient` + `shadowBlur` + `lighter`/`screen` 混合；全局上限 800 | `src/effects/particles.js`、`src/spawn_system.js` |
| 2 | **特效对象**（`Shockwave`/`FireWave`/`LightningBolt`/`HealWave`） | 多层 `shadowBlur` + `lighter` 叠加，无原始数量上限 | `src/effects/particles.js`、`src/combat_system.js`、`src/combat/damage_calc.js`、`src/spawn_system.js` |
| 3 | **Peg 软阴影 + 底部光晕** | 每帧对约 50 个 Peg 各执行 `createRadialGradient`（光晕）+ `ellipse`（阴影） | `src/entities.js`（`Peg.draw`） |
| 3a | **高密度模块化钉盘** | 细钉/小弹珠会提高可见 Peg 数量；必须继续依赖 `pegSoftShadow` / `pegGlowHalo` 在 medium/low 档关闭高开销层 | `src/pinboard_modules.js`、`src/game_phase.js`、`src/entities.js` |
| 4 | **敌人材质光泽** | `OffscreenCanvas` 上 `LinearGradient` 叠加，敌人构造时执行 | `src/entities/enemy.js`（`Enemy._initTexture`） |

> 2026-06-22：Ignis 温压与 Boss 入场专属敌人元数据不新增持续渲染对象。温压状态只增加一个 `压XX%` 状态短标签，温压触发流光时复用 `spawn_createShockwave()` 与既有流光护盾视觉，继续受 `shockwaveLimit` 和现有流光护盾 low/medium/high 分支约束。Tesla 导体网络新增 `电XX%` / `导N` 状态短标签和 2-4 条紫白短电弧，`shadowBlur` 通过 `_sb()` 门控；电击、导体召唤只复用现有 `spark`、`shockwave` 和 floating text 预算，不新增持续粒子池或 `CONFIG.performance` 字段。Glacies 霜缝新增 `缝N` 状态短标签、最多 5 条连接线和 3-4 条缝线，low 档关闭发光/混合；施加与切断只复用 `shard`、`shockwave` 与 floating text 预算，不新增持续粒子池或 `CONFIG.performance` 字段。Viridis 孢子活甲新增 `孢N` / `腐N` 状态短标签、2-3 条黄绿描边环和最多 6 个静态孢点，low 档关闭 `screen` / 发光；补甲与破甲反馈复用 `spark`、`shockwave` 与 floating text 预算，不新增持续粒子池或 `CONFIG.performance` 字段。Ouroboros 六附体新增 `附X` / `断N` 状态短标签、6 个轨道节点和一个短暂封印环，low 档关闭节点文字、发光和混合；裂群召唤复用普通敌人生成、`shockwave` 与 floating text 预算，不新增持续粒子池或 `CONFIG.performance` 字段。

---

## 3. 架构设计

### 3.1 状态字段（`core.js` → `Game` 实例）

```js
// 当前性能等级：'high' | 'medium' | 'low'
this.perfQualityLevel = 'high';

// FPS 采样窗口（循环缓冲区，长度 = CONFIG.performance.fpsSampleWindow）
this._fpsSamples = [];
this._fpsLastTime = 0;      // 上一帧 performance.now() 时间戳
this.avgFps = 60;           // 当前滑动平均帧率（整数，对外只读）

// 升降级保护计时器（单位：秒）
this._perfDownTimer = 0;    // 连续低帧累计时长，达到 downgradeHoldSec 后降级
this._perfUpTimer = 0;      // 连续高帧累计时长，达到 upgradeHoldSec 后升级
```

### 3.2 FPS 采样器（`game_system.js` → `sys_loop`）

每帧主循环开头执行：

```
1. dt = performance.now() - _fpsLastTime
2. 过滤异常帧（dt < 5ms 或 dt > 200ms）
3. 将 1000/dt 推入 _fpsSamples 滑动窗口（长度 fpsSampleWindow=60）
4. avgFps = round(sum(_fpsSamples) / length)
5. 升降级判断（见 3.3）
```

### 3.3 升降级逻辑

```
if avgFps < fpsThresholdDown (45):
    _perfDownTimer += dt_sec
    _perfUpTimer = 0
    if _perfDownTimer >= downgradeHoldSec (3s):
        perfQualityLevel 降一档（high→medium→low）
        _perfDownTimer = 0

if avgFps > fpsThresholdUp (55):
    _perfUpTimer += dt_sec
    _perfDownTimer = 0
    if _perfUpTimer >= upgradeHoldSec (10s):
        perfQualityLevel 升一档（low→medium→high）
        _perfUpTimer = 0
```

**设计意图**：降级阈值（3s）远小于升级阈值（10s），确保性能压力时快速响应，恢复时保守升级，防止频繁抖动。

---

## 4. 三档等级预算表（`CONFIG.performance`）

> 真理来源：`src/config.js` → `CONFIG.performance`

| 参数 | `high`（高画质） | `medium`（均衡） | `low`（省电） | 说明 |
|------|---------------|----------------|-------------|------|
| `maxParticles` | 800 | 400 | 150 | 全局粒子总上限 |
| `windLimit` | 120 | 60 | 30 | 风属性粒子上限 |
| `emberLimit` | 80 | 40 | 15 | 火焰粒子上限 |
| `mistLimit` | 80 | 30 | 10 | 冰雾粒子上限 |
| `shardLimit` | 60 | 30 | 12 | 碎片粒子上限 |
| `sparkLimit` | 100 | 50 | 20 | 通用火星粒子上限（机械类受击电弧、能量泄漏等） |
| `smokeLimit` | 60 | 25 | 8 | 烟雾粒子上限（狂暴受击烟雾、死亡爆炸等） |
| `venomLimit` | 60 | 30 | 0 | 毒液粒子上限（中毒敌人漂浮液滴 + 命中爆发；省电模式完全关闭） |
| `shockwaveLimit` | 20 | 12 | 6 | Shockwave 特效上限 |
| `waveLimit` | 10 | 6 | 3 | FireWave / HealWave 上限 |
| `lightningLimit` | 15 | 8 | 4 | LightningBolt 特效上限 |
| `deathExplosionLimit` | 14 | 8 | 4 | DeathExplosion 上限（精英/普通受限，Boss 不受限）；防清场卡顿 |
| `iceWaveLimit` | 10 | 6 | 3 | 冰冻死亡 IceWave 冰波环上限；防清场卡顿 |
| `greedyWheelEffectLimit` | 8 | 5 | 3 | 贪婪轮盘汇聚/成功/失败专用特效上限 |
| `pegSoftShadow` | `true` | `true` | `false` | Peg 渓圆软阴影开关 |
| `pegGlowHalo` | `true` | `false` | `false` | Peg 底部径向光晕开关 |
| `enemyGloss` | `true` | `true` | `false` | 敌人材质光泽渐变开关 |
| `ballAmbientGlow` | `true` | `true` | `false` | 弹珠 LAYER 0 环境光晕（每球每帧 r*30 大面积径向填充）开关；`low` 关闭降 fill-rate |

**FPS 采样参数**（同在 `CONFIG.performance` 根节点）：

| 参数 | 值 | 说明 |
|------|----|------|
| `fpsSampleWindow` | 60 | 滑动平均窗口帧数 |
| `fpsThresholdDown` | 45 | 触发降级的 FPS 下限 |
| `fpsThresholdUp` | 55 | 触发升级的 FPS 上限 |
| `downgradeHoldSec` | 3 | 降级所需连续低帧时长（秒） |
| `upgradeHoldSec` | 10 | 升级所需连续高帧时长（秒） |

---

## 5. 消费端关联索引

所有读取 `CONFIG.performance` 或 `this.perfQualityLevel` 的代码位置：

### 5.1 粒子系统（`src/spawn_system.js`）

| 函数 | 读取字段 | 行为 |
|------|---------|------|
| `spawn_createParticle(x, y, color, type)` | `maxParticles` / `windLimit` / `emberLimit` / `mistLimit` / `shardLimit` / `sparkLimit` / `smokeLimit` / `venomLimit` | 按粒子类型查询对应上限，超限时跳过创建 |
| `spawn_pushParticleWithLimit(particle)` | `maxParticles` / `sparkLimit` / `smokeLimit` / `venomLimit` | 通用粒子推入前检查全局上限及 spark/smoke/venom 独立限制 |
| `spawn_createShockwave(x, y, color)` | `shockwaveLimit` | 超限时跳过创建 |
| `spawn_createHealWave(x, y, range)` | `waveLimit` | 超限时跳过创建 |
| `spawn_createGreedyWheelEffect(x, y, mode)` | `greedyWheelEffectLimit` | 贪婪轮盘链式发射演出超限时跳过创建；low 档使用平面描边 |

### 5.2 战斗系统（`src/combat_system.js`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 天雷技能循环（约第 144 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |
| 闪电技能循环（约第 241 行） | `lightningLimit` | 同上 |
| 燃烧死亡爆炸（约第 3183 行） | `waveLimit` | 超限时跳过 FireWave 创建 |
| 静电场词条（约第 1802 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |
| 毒素命中粒子爆发（约第 1739 行） | `venomLimit`（经 spawn_createParticle 间接读取） | 叠加毒层时在命中点发射 1~4 颗毒液粒子 |
| 死亡特效 `_triggerDeathFX`（IceWave 创建） | `iceWaveLimit` | 冰冻死亡冰波环超限时跳过创建 |
| 死亡特效 `_triggerDeathFX`（DeathExplosion 创建） | `deathExplosionLimit` | 精英/普通死亡爆炸超限时跳过；Boss 死亡不受限（稀有且重要） |

### 5.3 伤害计算（`src/combat/damage_calc.js`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 闪电链 setTimeout 回调（约第 205 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |

### 5.3.1 弹珠渲染（`src/entities.js` → `Ball.draw` LAYER 0）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 环境光晕（LAYER 0 ambient spotlight，`spotR = r*30` 径向填充） | `ballAmbientGlow` | `false`（low 档）时跳过整段大面积径向填充。纯装饰性，球体本体（LAYER 2+）仍完整表达属性，可读性不受影响。 |

### 5.4 实体渲染（`src/entities.js` → `Peg.draw`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 软阴影绘制（约第 1036 行） | `pegSoftShadow` | `false` 时跳过 `ellipse` 软阴影 |
| 底部光晕绘制（约第 1084 行） | `pegGlowHalo` | `false` 时跳过 `createRadialGradient` 光晕 |

> **注意**：`Peg.draw` 通过 `game.perfQualityLevel` 读取等级（`typeof game !== 'undefined' && game.perfQualityLevel`），默认回退到 `'high'`。

### 5.5 敌人纹理（`src/entities/enemy.js` → `Enemy._initTexture`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 材质光泽叠加（约第 229 行） | `enemyGloss` | `false` 时跳过 OffscreenCanvas 光泽渐变 |

### 5.5.1 V2 基底轮廓（`src/entities/enemy.js` → `Enemy._drawArchetypeBody`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 基底内部结构绘制（Layer 3.55） | `perfQualityLevel` | `high/medium`：允许少量 `screen` 混合与 `maw` / `gravityWell` 径向渐变；`low`：改用 `source-over` 与纯色线面，保留基底可读性但关闭高开销层 |

### 5.5.2 词条位图覆盖层（`src/entities/enemy.js` → `Enemy._drawAffixBitmapOverlays`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 通用词条 Overlay 位图叠层（Layer 3.96） | `perfQualityLevel` | `high`：每敌最多 2 次 `drawImage`；`medium/low`：每敌最多 1 次 `drawImage`。不新增粒子、渐变、`shadowBlur` 或预算字段；缺失/未加载资源时静默跳过，语义由 Canvas 词条层与短标签兜底 |

### 5.5.2b 敌人针对边框 fallback（`src/entities/enemy.js` → `Enemy._drawEnemyTargetingFallback`）
| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 敌人针对词缀边框/外缘语义层（Layer 3.95a） | `perfQualityLevel` | `high/medium`：允许轻微 pulse 与虚线；`low`：关闭 pulse，保留边缘甲片、角标、窄条、空舱口、底部齿和外缘旋转弧。该层不绘制中心大图标或暗底块，不遮挡敌人主体；不新增粒子、渐变、`shadowBlur`、混合模式或 `CONFIG.performance` 字段。 |

### 5.5.3 碰撞框材质边框（`src/entities/enemy.js` → `Enemy._drawCollisionFrameBitmap`）
| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 非 Boss 敌人 Collision Frame 位图层（Layer 4.9b） | `perfQualityLevel` | `high/medium`：每个已登记 frame 的非 Boss 敌人 1 次缓存 `drawImage`，透明度 0.96；`low`：仍保留边框语义，透明度降为 0.84。不新增粒子、渐变、`shadowBlur`、混合模式或预算字段；绘制成功时接管顶层物理边界并跳过 Layer 5 矢量边框，缺失/未加载资源时由 Layer 5 矢量碰撞描边兜底 |

### 5.5.4 流彩护盾词条视觉（`src/entities/enemy.js` → `Enemy.draw` Layer 3.5 & feedback）
| 位置 | 读取字段 | 行为 |
|------|---------|------|
| `radiantAegis` 内部护罩纹理（Layer 3.5） | `perfQualityLevel` | `high`：3 层流彩菱环 + 节点 + `screen` 混合；`medium`：2 层菱环、无节点；`low`：平面描边，关闭 `screen` 混合与 `_sb()` 阴影，仍保留词条身份 |
| `radiantAegis` 命中/破盾反馈 | `perfQualityLevel` + 既有粒子/冲击波预算 | 破盾只通过 `spawn_createParticle(..., 'shard')` 和 `spawn_createShockwave()` 复用 `shardLimit` / `shockwaveLimit`；没有新增粒子类型或 `CONFIG.performance` 字段 |

### 5.5.5 Boss 破绽身体 Overlay（`src/entities/enemy.js` → `Enemy._drawBossVulnerabilityOverlay`）
| 位置 | 读取字段 | 行为 |
|------|---------|------|
| Boss 破绽进度、爆开、暴露、恢复视觉（Layer 3.8 后） | `perfQualityLevel` | `high/medium`：少量裂纹、切口、弱点环和 `_sb()` 门控发光，使用 `screen` 混合；`low`：改用 `source-over` 平面线条，关闭发光和混合。该层不新增粒子、渐变预算或新 `CONFIG.performance` 字段；破绽满格只触发一次既有 `spawn_createShockwave()` 作为停摆反馈。 |
| Boss 破绽 PNG Overlay（`src/data/boss_vulnerability_assets.js`） | 图片缓存状态 | 若 `boss_<bossId>_<state>.png` 已缓存加载，`_drawBossVulnerabilityAssetOverlay()` 每个 Boss 每帧最多绘制 1 张透明图；图片缺失、失败或加载中时继续走上方 Canvas fallback。PNG 路径与尺寸契约见 `docs/boss_vulnerability_asset_contract.md`；不新增粒子、渐变、`shadowBlur`、混合预算或 `CONFIG.performance` 字段。 |
| Boss 本体 Sprite 重绘（`src/data/boss_sprite_assets.js` + `SpriteRenderer`） | 图片/JSON 缓存状态 | 旧 `256 × 256` 方形帧和新 `384 × 256` 横向帧都只产生每个 Boss 每帧 1 次 `drawImage`；`getCurrentFrameAspect()` 仅改变目标绘制矩形，不新增粒子、渐变、混合或预算字段。资源失败时 `SpriteRenderer.failed`，Boss Canvas 装饰继续兜底。 |

### 5.6 Boss 专属 VFX（`src/entities/enemy.js` → Devourer Layer 6.5 & Ouroboros Layer 6.5）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| Devourer 深渊核心 lighter 白化叠加（DEVOURING 状态） | `arcBossVfxWhiteGrad` | `false` 时跳过 `createRadialGradient` + `lighter` 叠加（省电模式关闭） |
| Devourer 旋转引力线数量（DEVOURING 状态） | `arcBossVfxLineCount` | 控制 `createLinearGradient` 调用次数（high:6 / medium:6 / low:3） |
| Devourer 吸入粒子每帧生成概率（DEVOURING 状态） | `arcBossVfxSuckProb` | 控制每帧 spark 粒子生成概率（high:0.7 / medium:0.5 / low:0.3） |
| Ouroboros 狂暴共鸣三角形符文数量（狂暴状态） | `arcBossVfxTriCount` | 控制外圈旋转三角形数量（high:6 / medium:3 / low:0），0 时完全跳过循环 |

> **注意**：这些 VFX 通过 `game.perfQualityLevel` 动态读取等级，默认回退到 `'high'`。吸入粒子已通过 `spawn_pushParticleWithLimit` 接入全局 sparkLimit 预算检查。2026-06-23 起 Devourer 的物理碰撞改为不规则 polygon，Layer 6.5 仍使用同一组视觉半径 fallback 绘制口器/引力线，不新增预算字段；Ouroboros 是唯一完整环形 Boss。

> **注意**：`_initTexture` 在构造时调用，通过 `window.game` 读取等级（若 `window.game` 尚未初始化则默认开启光泽）。

### 5.7 渲染系统（`src/render_system.js`）

| 函数 | 行为 |
|------|------|
| `render_perfOverlay()` | 当 `perfQualityLevel !== 'high'` 时，在 Canvas 左上角绘制半透明 FPS 数值和等级标签（均衡/省电） |
| `render_combat_launcherSignal()` | 绘制下一发弹药可读性信号（左侧伤害/散射屏、中央弹仓、底部装填格、右侧连射能量条）。读数只写入 V3 发射器贴图现有槽位，不再绘制上方发射点叠层、额外面板、自动旋转属性球或连线。`high/medium` 档允许读数与连射条轻量发光，`low` 档关闭 `shadowBlur`，保留平面装填格、伤害数字、S 散射数和 xN 连射条，确保语义不消失。 |
| `render_queueLauncherBarrelFireEffect()` / `render_combat_launcherEmitterBase()` | 每次真实发射排队一次基于炮管方向的短生命周期闪光，由发射器美术层绘制固定椭圆/折线形状。该反馈不创建粒子、shockwave、渐变循环或新 `CONFIG.performance` 字段；`low` 档关闭 `shadowBlur`。 |

### 5.8 毒素状态视觉（`src/entities/enemy.js` → `Enemy.draw` Layer 3.4）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 毒素叠加层（Layer 3.4，`venomStacks > 0`） | `perfQualityLevel` | `high`：screen 混合径向渐变 + 液滴动画；`medium`：只渐变无液滴；`low`：简单色块无渐变 |
| 毒液粒子发射（Layer 3.4 末尾） | `venomLimit`（经 `spawn_createParticle` 间接读取） | `high` 档 8% 概率/帧发射漂浮毒液粒子，`medium` 4%，`low` 0%（venomLimit=0 兜底截止） |

> **注意**：Layer 3.4 在 `ctx.clip()` 之后执行，叠加层自动被裁剪到敌人形体内部，无需额外剪切。粒子发射使用世界坐标（`this.pos.x / this.pos.y`），与局部 ctx 变换无关。

### 5.9 奖励标记光晕（`src/entities/enemy.js` → `Enemy.draw` Layer 6.8）

携带遗物/精华的敌人（`rewardType` ∈ `relic` / `chaos_essence` / `pure_essence`）会绘制奖励标记。这是**玩法可读性关键特效**（告诉玩家「打这个敌人能掉落」），遵循「降级而非消失」原则。

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 完整光晕（`rewardHaloEnabled === true`） | `rewardHaloEnabled` / `rewardRuneCount` / `rewardCrystalCount` | `high`：完整光晕 + 旋转符文(4)/晶体(5) + shadowBlur + 渐变；`medium`：光晕 + 符文(2)/晶体(3) |
| **平面兜底（`rewardHaloEnabled === false`，即 low 档）** | `rewardHaloEnabled` | 走 `else` 分支，绘制纯色双层描边（遗物=金 / 混沌=紫红 / 纯净=蓝白），**无 shadowBlur / 无 createRadialGradient / 无旋转**，约 2 次 `stroke()`/敌，附带 1 次 `Math.sin` 廉价脉冲。**保证省电模式下标记仍可见。** |

> **重要约定**：奖励标记、敌人状态（中毒/冰冻/燃烧）、Boss 预警/狂暴等**语义类**特效，在 low 档必须**降级为廉价平面版**，严禁像装饰类特效（Peg 光晕、敌人光泽）那样 `enabled:false` 彻底关闭。

### 5.10 敌人意图预告（`src/entities/enemy.js` → `Enemy.draw`）

敌人进入 `telegraphing` 状态时，会根据 `telegraphIntent` 绘制行动预告面板。这是**玩法可读性关键提示**（告诉玩家敌人即将治疗、吞噬、跳跃、增殖、再生或冲刺），遵循「降级而非消失」原则。

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 完整预告（`enemyTelegraphGlow === true`） | `enemyTelegraphGlow` / `telegraphDuration` / `telegraphShake` | `high/medium`：显示类型色面板、图标、短标签、倒计时进度环和轻量 `shadowBlur` |
| 平面预告（`enemyTelegraphGlow === false`，即 low 档） | `enemyTelegraphGlow` | 保留面板、图标、短标签和倒计时环，关闭 `shadowBlur`；无粒子、无渐变、无混合模式 |

> **注意**：`telegraphIntent` 在 `Enemy.startTurnAction()` 中一次性计算，渲染层只读取结果，不在 `draw()` 中扫描敌人列表或重新判定行为。

---

## 6. 修改指南（Agent 防坑）

### 6.1 新增粒子类型时

1. 在 `CONFIG.performance.high/medium/low` 中为新类型添加对应上限字段（如 `newTypeLimit`）。
2. 在 `spawn_createParticle` 的 `switch` 分支中读取该字段。
3. 同步更新本文档第 4 节预算表。

### 6.2 新增特效对象时（如新的 Wave/Bolt 类）

1. 在 `CONFIG.performance` 三档中添加对应上限字段。
2. 在创建该特效对象的函数中加入上限检查：
   ```js
   const _budget = CONFIG.performance[this.perfQualityLevel || 'high'];
   if (this.myEffects.length >= _budget.myEffectLimit) return;
   this.myEffects.push(new MyEffect(...));
   ```
3. 同步更新本文档第 5 节消费端关联索引。

### 6.3 调整 FPS 阈值时

只修改 `CONFIG.performance` 中的 `fpsThresholdDown`、`fpsThresholdUp`、`downgradeHoldSec`、`upgradeHoldSec`，**不要直接修改 `game_system.js` 中的采样逻辑**。

### 6.4 禁止行为

- **禁止**在特效创建函数中硬编码数量上限（如 `if (this.particles.length >= 800)`），必须通过 `CONFIG.performance` 读取。
- **禁止**在 `Peg.draw` 中直接读取 `CONFIG.performance.high`，必须通过 `game.perfQualityLevel` 动态查询。
- **禁止**在 `_initTexture` 中使用 `this.perfQualityLevel`（构造时 `game` 尚未挂载），必须通过 `window.game` 读取。

---

## 7. 对外可观测接口

| 属性/方法 | 位置 | 说明 |
|---------|------|------|
| `game.avgFps` | `Game` 实例 | 当前 60 帧滑动平均帧率（整数） |
| `game.perfQualityLevel` | `Game` 实例 | 当前性能等级：`'high'`/`'medium'`/`'low'` |
| `render_perfOverlay()` | `render_system.js` | 在 Canvas 上绘制 FPS 指示层（降级时自动调用） |

---

## 8. 变更历史

| 日期 | 内容 |
|------|------|
| 2026-06-23 | **Boss 物理轮廓收口**：Mikro 与 Devourer 从环形/缺口 arc 语义改为实体 polygon，只有 Ouroboros 保留完整闭合环形 arc 以承载 6 个附体槽。Devourer Layer 6.5 继续复用既有 `arcBossVfx*` 三档门控和 sparkLimit，Ouroboros 轮转锚点只改变视觉指示，不新增粒子、渐变预算、混合模式或 `CONFIG.performance` 字段。 |
| 2026-06-21 | **敌人 HP 与碰撞框可读性修正**：第一轮运行时前景 HP 视窗、液面亮线、侧边液位尺与 Sprite clip 已撤销；当前由 `*_native_hollow*` 敌人素材的原生镂空结构露出 Layer 2 HP 液体，避免把血量 UI 拉到敌人左侧或在完整主体上硬切窗口。保留 collision frame alpha 内容框测量与透明 padding 裁剪，让边框贴合当前碰撞区域。该方案减少 `fillRect` / `strokeRect` / clip 路径，不新增粒子、`shadowBlur`、渐变、混合模式或 `CONFIG.performance` 预算字段；`low` 档完整保留 HP 与物理边界语义。 |
| 2026-06-21 | **研磨视觉重心调整**：`Peg.hit()` 缩短点亮/缩放反馈，`Peg.draw()` 改为廉价菱形铆钉板轮廓、内倒角、短高光/暗部笔触和中心槽位，以区别圆形玻璃弹珠，并在 `pegGlowHalo` 预算下压低 Peg 光晕半径/透明度；`DropBall.draw()` 增加玻璃边缘高光/暗部弧线强化球体质感；`EnergyOrb` 默认改为更小的 `source-over` 低透明度短拖尾，`spawn_createHitFeedback()` 为普通/二次反馈传入更克制的视觉参数。未新增粒子、`CONFIG.performance` 字段、渐变循环或无预算高开销效果；`high` 保留 Peg halo 但更低调，`medium`/`low` 继续按既有门控关闭 Peg halo / 软阴影。 |
| 2026-06-23 | **发射器贴图槽位与炮管闪光**：战斗发射器 `port` 改为炮台旋转圆心，`muzzle` 仅作为美术端点；`render_combat_launcherSignal()` 只写入 V3 底座现有读数屏、电容柱、弹仓和底部弹药槽。旧自动旋转属性球/连线运行时退役并停止预加载，旧 `spawn_createLauncherFireEffect()` 粒子/shockwave 路径删除；每次真实发射改由 `render_queueLauncherBarrelFireEffect()` 在炮管方向绘制短生命周期固定形状闪光。三档影响：`high/medium` 只保留轻量 `shadowBlur`，`low` 关闭发光；不新增粒子、渐变循环、shockwave 或 `CONFIG.performance` 预算字段。 |
| 2026-06-19 | **默认钉盘回归纯交错钉板**：默认前两行由 10 个 `dense_stagger` 1x1 模块组成，120 个普通圆钉、0 个 barrier、0 个 SpecialSlot；未新增粒子、渐变或额外 `shadowBlur`，Peg 绘制继续受 `pegSoftShadow` / `pegGlowHalo` 三档预算控制。三档影响：`high`/`medium` 维持原 Peg 视觉门控，`low` 继续关闭高开销 Peg halo。 |
| 2026-06-19 | **底部奖励分栏与初始 5 钉板**：默认开放槽位回调为首行 5 个 `dense_stagger` 模块；研磨底部小概率生成 1 个奖励分栏，宽度按 `1.5` 个倍化弹珠直径计算，两侧新增最多 2 条 `shape='barrier'` 竖直挡板。分栏绘制只使用 `fillRect` / `strokeRect` / 文本，挡板复用 `Peg.drawBarrierPeg()`，软阴影继续由 `pegSoftShadow` 门控；不新增粒子、渐变、混合模式、额外 `shadowBlur` 或 `CONFIG.performance` 预算字段。 |
| 2026-06-19 | **战斗发射器信号 V2.2**：`render_combat_launcherSignal()` 改为居中的下一发 HUD，集中展示弹体轮廓、弹药位图核心、`DMG` 伤害、`S` 散射弹数、`xN` 连射数、连射柱和装填格。2026-06-23 发射点/炮口叠层被移除，散射数并入左侧屏幕，避免占用上方发射槽。该层复用现有弹药位图，绘制数量固定；`shadowBlur` 继续由 `perfQualityLevel !== 'low'` 门控，不新增粒子、渐变循环或 `CONFIG.performance` 预算字段。 |
| 2026-06-22 | **流彩护盾超级词条**：`enemy.js` 新增 `radiantAegis` 护罩纹理、命中反馈与破盾反馈；high 绘制 3 层流彩菱环和节点，medium 降为 2 层无节点，low 关闭 `screen` 混合与 `_sb()` 阴影并保留平面语义描边。扩盾冲击波和破盾碎片复用既有 `shockwaveLimit` / `shardLimit`，未新增 `CONFIG.performance` 预算字段。 |
| 2026-06-19 | **钉盘编辑器放置预览**：模块 picker 在 hover/focus 候选组件时写入 `_moduleEditorPlacementPreview`，`render_moduleEditorOverlay()` 用平面填充和描边标记当前槽、可放置覆盖槽、不可放置覆盖槽。该反馈不新增粒子、渐变、混合模式或 `shadowBlur`，无需新增 `CONFIG.performance` 预算字段。 |
| 2026-06-19 | **钉盘编辑器异形轮廓**：`render_moduleEditorOverlay()` 根据组件 `shape.footprint` 绘制导流翼、杯形、沙漏、螺旋等平面轮廓，帮助玩家在编辑态识别组件身份。该层只使用 `stroke`、`lineTo`、`quadraticCurveTo`、`arc/ellipse` 等廉价路径绘制，不新增粒子、渐变、混合模式或额外 `shadowBlur`。 |
| 2026-06-19 | **异形挡板钉与倍化弹珠安全间距**：圆钉中心距统一按 `marbleRadius + maxMarbleSizeBonus` 计算，默认盘圆钉最小中心距审计为 `24.04px`，大于当前阈值 `23.8px`；导流翼、杯口、回环、挡板改用 `shape='barrier'` 的异形 Peg，以线段胶囊碰撞实现，不再用近距离圆钉拼挡板。`Peg.drawBarrierPeg()` 只绘制圆角线段，软阴影仍受 `pegSoftShadow` 门控；不新增粒子、渐变、混合模式或新预算字段。 |
| 2026-06-19 | **钉盘模块接缝加密**：`moduleSpacingX/Y` 调整为 `0`，首发模块通过安全圆钉与 `barrier` 异形钉补齐左右/上下模块之间的空白通道，并将顶部中段升级为 `2x1` 分裂符文桥。默认盘约 75 圆钉 + 10 barrier / 5 SpecialSlot，圆钉带倍化弹珠近距保护。该修改仍复用现有 `Peg` / `SpecialSlot` 框架，不新增粒子、`shadowBlur`、渐变、混合模式或新预算字段；Peg 阴影/光晕继续由 `pegSoftShadow` / `pegGlowHalo` 三档门控。 |
| 2026-06-19 | **初始钉盘 2x5 铺满与异形机关化**：默认开放前两行 10 个槽，首发组件提升到约 120 Peg / 5 SpecialSlot，并新增轻分裂门、连射门、轻回环、轻轮盘杯等真实机关模块。该修改复用现有 `Peg` / `SpecialSlot`、既有 `split` / `multicast` / `recall` / `wheel` 触发逻辑，不新增粒子、`shadowBlur`、渐变、混合模式或新预算字段；高开销 Peg 阴影/光晕仍由 `pegSoftShadow` / `pegGlowHalo` 三档门控。 |
| 2026-06-19 | **钉盘钉子密度加密**：初始 6 个异形组件从约 35 颗 Peg 提升到约 58 颗 Peg，商店路线型组件同步补齐入口、转折和出口空洞。该修改只增加普通 Peg/少量既有类型 Peg，未新增粒子、`shadowBlur`、渐变、混合模式或新预算字段；高开销 Peg 阴影/光晕仍由 `pegSoftShadow` / `pegGlowHalo` 三档门控。 |
| 2026-06-19 | **商店异形钉盘组件池扩展**：新增 6 个路线型商店组件（Y 字分流、沙漏门、月牙坡、螺旋回廊、棱镜分光、双轮桥），全部复用现有 `Peg` 与 `SpecialSlot` 绘制和触发逻辑，不新增粒子、`shadowBlur`、渐变或混合模式。性能影响仍主要来自同屏 Peg/Slot 数量，继续归入高密度模块化钉盘预算。 |
| 2026-06-22 | **钉盘机关槽扩展**：`SpecialSlot` 新增可重复触发的 `launcher` 与 `energy_wheel` 玩法分支，商店新增 `launcher_gate_module`、`pinwheel_capacitor_module`、`turbine_loop_module`、`swerve_cannon_module`。机关视觉复用 `SpecialSlot.draw()` 的固定数量路径、文字和 `_sb()` 门控阴影，不新增粒子、渐变循环、混合模式或 `CONFIG.performance` 预算字段；额外开销主要来自少量可见 `SpecialSlot` 与 Peg/barrier 数量，仍归入高密度模块化钉盘预算。 |
| 2026-06-19 | **钉盘居中 3+3 初始布局与异形组件**：`moduleCols` 调整为 5，默认激活槽从 3 个提升到居中 `3+3` 两行共 6 个组件，并新增 6 个首发异形组件（导流翼、轻符文格、弹跳室、炼金核、接球杯）。该调整会提高初始 Peg 数量，但不新增粒子、`shadowBlur`、`createRadialGradient` 或混合模式；Peg 软阴影/光晕继续由 `pegSoftShadow` / `pegGlowHalo` 三档门控。 |
| 2026-04-16 | 初始实现：FPS 采样器、三档等级预算、粒子/特效/Peg/敌人全面接入、FPS 指示层 |
| 2026-04-16 | 新增 `sparkLimit`（high:100/medium:50/low:20）和 `smokeLimit`（high:60/medium:25/low:8）两个预算字段；在 `spawn_createParticle` 和 `spawn_pushParticleWithLimit` 中同步接入 spark/smoke 上限检查，防止能量泄漏、机械类受击等高频 spark 场景占用全局粒子预算 |
| 2026-04-16 | **Arc Boss VFX 性能门控（Task T3 补丁）**：在三档预算表中新增 4 个字段：`arcBossVfxTriCount`（Ouroboros 狂暴三角形数量，high:6/medium:3/low:0）、`arcBossVfxLineCount`（Devourer 引力线数量，high:6/medium:6/low:3）、`arcBossVfxWhiteGrad`（Devourer 深渊核心 lighter 白化叠加开关，high/medium:true/low:false）、`arcBossVfxSuckProb`（Devourer 吸入粒子生成概率，high:0.7/medium:0.5/low:0.3）。在 `enemy.js` Devourer/Ouroboros Layer 6.5 中通过 `game.perfQualityLevel` 动态读取对应字段实施门控。同步更新消费端关联索引（第 5.6 节）。 |
| 2026-06-18 | **Enemy.draw 静态渐变按实例缓存（P-005 相关）**：`Enemy.draw` 此前每帧每敌创建容器背景渐变（`_bgGrad`）与空槽渐变（`_slotGrad`）两个 LinearGradient，色标静态（仅依赖 `h` / `type`，敌人生命周期内恒定）。改为按实例缓存（`_cachedBgGrad`/`_cachedSlotGrad`，h/type 变化时自动重建），**零视觉变化**，消除每帧每敌 2 个渐变分配（20 敌@60fps ≈ 2400 次/秒），降低 GC 压力与 CPU。HP 条等动态渐变（随血量变化）不缓存。 |
| 2026-06-18 | **弹珠环境光晕 low 档门控（P-003）**：`Ball.draw` LAYER 0 环境光晕此前无 `perfQualityLevel` 门控，每球每帧执行 `r*30` 半径大面积径向填充（移动端 fill-rate 高开销，且在所有档位包括 low 都运行）。该层渐变色标每帧动态（呼吸/频闪/buff 染色）不可缓存，故采用分级门控：新增 `ballAmbientGlow`(true/true/false) 预算字段，`low` 档跳过整段填充。纯装饰性，球体本体属性表达不受影响。 |
| 2026-06-18 | **收尾：shadowBlur 门控补全**：补全 `enemy.js` 最后 2 处未走 `_sb()` 的 `shadowBlur`（移动冷却指示器、词缀印记），全 `src/` 现已无未门控 shadowBlur（除 `perf.js` 文档注释）。`low` 档 `shadowBlurEnabled:false` 现可彻底关闭所有 GPU 模糊 pass。审计 P-032（激光高频 console.log）经核查已由 `if (CONFIG.debug)` 包裹，生产环境无 I/O 开销，无需额外处理。 |
| 2026-06-18 | **抗卡顿：特效预算上限 + 纹理缓存**：(1) 新增 `deathExplosionLimit`(14/8/4) 与 `iceWaveLimit`(10/6/3) 预算字段，在 `combat_system.js` `_triggerDeathFX` 的 IceWave/DeathExplosion 创建处接入上限检查（Boss 死亡爆炸不受限），消除清场/范围秒杀时同屏数十个多渐变特效的帧率断崖（修复 P-009~015）。(2) `enemy.js` `_initTexture` 新增模块级 OffscreenCanvas 纹理缓存（按 类型\|尺寸\|seed桶(16)\|gloss 共享只读静态纹理，FIFO 容量 160），消除批量刷怪时密集同步分配的进场卡顿（修复 P-004）。 |
| 2026-06-18 | **主循环省电控制**：新增 (1) 静态阶段降帧节流——非 combat/training/gathering 的菜单阶段及暂停态按 `CONFIG.performance.idleFrameInterval`(66ms≈15fps) 节流渲染，活跃阶段仍满帧；FPS 采样器仅在活跃阶段运行，避免菜单降帧误触发降级。(2) `visibilitychange` 后台硬停——页面隐藏时 `cancelAnimationFrame` 中断 rAF 链并 `audio.suspend()` 挂起音频上下文，恢复时重启循环并 `audio.resume()`。涉及 `game_system.js`(sys_loop/sys_setupVisibilityHandling)、`core.js`(状态初始化+注册)、`audio.js`(新增 suspend())、`config.js`(idleFrameInterval)。详见第 10 节。 |
| 2026-06-18 | **敌人语义可读性提示**：`enemy.js` 新增足迹描边/占格分隔线、威胁等级角标与状态短标签（护盾、屏障、狂暴、毒素、温度）。该层只使用少量 `stroke` / `fillRect` / `fillText`，无渐变、无 `shadowBlur`、无混合模式、无粒子；语义提示在 `low` 档保留。 |
| 2026-06-18 | **V2 基底轮廓降级**：`enemy.js` 的 `_drawArchetypeBody()` 按 `game.perfQualityLevel` 降级。high/medium 保留少量 `screen` 混合与 `maw` / `gravityWell` 径向渐变；low 关闭混合模式并改用纯色线面，保留基底身份但降低 fill-rate 与渐变开销。 |
| 2026-06-19 | **词条位图 Overlay 试点**：`enemy.js` 新增 `_drawAffixBitmapOverlays()`，从 `enemy_sprite_manifest.json` 的 `overlays` 段读取通用词条覆盖层并叠加到非 Boss 敌人。`high` 每敌最多 2 次 `drawImage`，`medium/low` 最多 1 次；不新增粒子、渐变、`shadowBlur` 或预算字段，资源未就绪时直接跳过并由既有 Canvas 词条视觉/短标签兜底。 |
| 2026-06-18 | **奖励标记低档平面兜底**：修复 `low` 档 `rewardHaloEnabled:false` 导致携带遗物/精华的敌人无任何视觉标记的玩法可读性回归。在 `enemy.js` Layer 6.8 的 `if (rewardHaloEnabled)` 增加 `else` 分支，绘制纯色双层描边平面版（遗物=金/混沌=紫红/纯净=蓝白），无 shadowBlur/渐变/旋转。新增消费端关联索引第 5.9 节并确立「语义类特效降级而非消失」约定。 |
| 2026-04-30 | **毒素敌人专属特效**：新增 `venomLimit`（high:60/medium:30/low:0）预算字段；新增 `venom` 粒子模式（上浮液滴 + screen 渐变绘制）；在 `enemy.js` Layer 3.4 新增毒素状态视觉（径向渐变叠加 + 液滴流淌动画，三档门控）；在 `combat_system.js` 命中毒素时发射 1~4 颗毒液粒子。消费端关联索引见第 5.1/5.2/5.8 节。 |
| 2026-06-18 | **高密度钉盘尺寸调整**：收集阶段 `marbleRadius` 下调，Peg 半径改读 `CONFIG.physics.pegRadius`，模块最小钉距改读配置化基础通行半径。该调整会提高 Peg 数量，但不新增粒子、混合模式或渐变层；高开销 Peg 阴影/光晕仍由 `pegSoftShadow` / `pegGlowHalo` 分档控制。 |
| 2026-06-18 | **符文融合承载模块**：新增默认 `rune_lattice` 与商店 `rune_focus_module`，通过 `fusionPriority` 改变符文注入目标。该调整增加部分高密度普通 Peg，但不新增粒子、混合模式、shadowBlur 或渐变创建；继续复用 Peg 绘制的 `pegSoftShadow` / `pegGlowHalo` 分档门控。 |
| 2026-06-18 | **钉板模块池扩展**：新增分裂门、召回环、弹钉斜坡、属性坩埚、双轮盘与融合花园模块。全部复用现有 `Peg` / `SpecialSlot` 绘制与触发逻辑，不新增粒子、渐变、混合模式或 shadowBlur；额外开销主要来自同屏 Peg/Slot 数量，继续归入高密度模块化钉盘预算。 |
| 2026-06-18 | **敌人意图预告升级**：`Enemy.startTurnAction()` 新增 `telegraphIntent`，在行动前显示图标、短标签和倒计时环；`Enemy.draw` 中 high/medium 使用 `enemyTelegraphGlow:true` 保留轻量 `shadowBlur`，low 档以 `enemyTelegraphGlow:false` 降级为平面面板与描边。该提示属于语义类玩法信息，low 档不得完全关闭。 |

| 2026-06-19 | **碰撞框材质边框**：`enemy.js` 新增 `_drawCollisionFrameBitmap()`，从 `enemy_sprite_manifest.json` 的 `frames` 段读取大型 V2 敌人的同形材质边框，并在 Layer 4.9 后、Layer 5 矢量描边前绘制。每敌最多 1 次缓存 `drawImage`，`low` 档降低透明度但保留物理边界语义；不新增粒子、渐变、`shadowBlur`、混合模式或新预算字段，资源未就绪时由既有矢量描边兜底。 |

### 8.1 Battle Relic Cinematic Budget (2026-06-18)

新增 `relicCinematicDelayMs`、`relicCinematicSparkCount`、`relicCinematicBoltCount` 三档预算字段，用于战斗内遗物的短演出：

- `doomsday_timer`: 回合开始锁定、冲击波、倒计时读数、钟面碎片和粒子爆发；若击杀成功会补触发，补触发上限从 1 开始，并随主触发累计每 5 次 +1。每段演出仍复用同一组预算和既有效果上限，单轮最多受当前存活敌人数约束。
- `corridor_arc`: 回合开始墙体电弧、墙撞火花。
- `mortal_burst`: 击杀爆裂的 FireWave、冲击波和碎片粒子。
- `greedy_wheel`: 发射后进入汇聚、成功续射或失败震动；每段只创建 `GreedyWheelEffect`，数量受 `greedyWheelEffectLimit` 限制，low 档关闭发光/径向渐变。

这些演出仍叠加既有 `shockwaveLimit` / `waveLimit` / `lightningLimit` / `sparkLimit` 检查；其中 `doomsday_timer` 不再创建 `LightningBolt`，但仍复用 `relicCinematicBoltCount` 作为钟面碎片数量预算。`phase_finalizeRound()` 会按遗物 Hook 返回的演出时长延后 Boss 生成、奖励解析和下一阶段横幅，避免动画被阶段切换吞掉。

## 9. 性能影响标记规范

为了在持续迭代中保护自适应性能系统，所有 AI Agent 在修改或新增可能影响渲染性能的代码时，**必须**执行以下标记与评估流程：

### 9.1 触发条件

当你的代码修改涉及以下任何一项时，即触发本规范：
- 新增或修改 `Particle`、`Shockwave`、`LightningBolt` 等特效类的实例创建逻辑
- 在 Canvas 渲染上下文中使用或修改高开销 API：
  - `createRadialGradient` / `createLinearGradient`
  - `shadowBlur` / `shadowColor`
  - `globalCompositeOperation`（特别是 `lighter`、`screen` 等加法混合模式）
- 在主循环（`update` / `draw`）中新增复杂的遍历逻辑（如 `Array.filter`）

### 9.2 标记格式

1. **代码注释标记**：在受影响的代码块（如函数定义、循环体）上方添加标准注释标记：
   ```javascript
   // @perf-impact: [影响简述] - [处理方式]
   // 例如：
   // @perf-impact: 新增高频渐变创建 - 已通过 perfQualityLevel 降级处理
   ```

2. **Commit Message 标记**：在 Git 提交信息的末尾添加 `[perf-impact]` 标签：
   ```text
   feat(effects): 新增冰霜爆裂特效 [perf-impact]
   ```

### 9.3 强制评估模板

在任务总结或 PR 描述中，必须包含以下“性能自适应影响评估”说明：

```markdown
### 性能自适应影响评估

- **修改内容**：简述新增或修改了什么视觉效果。
- **高开销 API**：列出使用的 `shadowBlur`、`createRadialGradient` 等。
- **预算接入情况**：
  - [x] 已在 `CONFIG.performance` 中添加对应上限字段（如 `newEffectLimit`）
  - [x] 已在特效创建入口处添加 `CONFIG.performance[game.perfQualityLevel]` 检查
- **三档表现说明**：
  - `high` 档：完整效果表现
  - `medium` 档：降级策略说明（如减少粒子数量、关闭某些渐变）
  - `low` 档：极致降级策略说明（如关闭所有发光和混合模式）
```

---

## 10. 主循环省电控制（节流与后台暂停）

> **状态**：已实现（2026-06-18）｜**涉及文件**：`src/game_system.js`、`src/core.js`、`src/audio.js`、`src/config.js`

第 4 节的三档质量预算解决的是**卡顿（帧时间尖峰）**；本节解决的是**耗电（持续功耗/发热）**——即使帧率稳定，满帧重绘静止画面仍会持续占用 GPU 发热掉电。

### 10.1 静态阶段降帧节流

`sys_loop` 开头按阶段决定是否满帧：

```
_activePhase = !isPaused && phase ∈ { combat, training, gathering }
若 !_activePhase 且 (now - _lastRenderTime) < idleFrameInterval:
    仅 requestAnimationFrame 续帧，跳过本帧渲染与采样
```

- **活跃阶段**（战斗/试炼/研磨）：不受限，满帧 rAF，保证手感与动画流畅。
- **静态阶段**（抉择/商店/图鉴/结算等菜单）及**暂停态**：节流到 `CONFIG.performance.idleFrameInterval`（默认 66ms≈15fps）。
- **关键**：rAF 链本身仍每帧（~16ms）tick，只是**跳过渲染**；因此阶段切换（如菜单→战斗）在下一物理帧即恢复满帧，无输入延迟。DOM 菜单交互走独立事件，不受 canvas 节流影响。
- FPS 采样器（升降级判断）**仅在 `_activePhase` 运行**，否则菜单的 15fps 会被误判为卡顿而错误降级特效等级。

### 10.2 后台硬停（visibilitychange）

`sys_setupVisibilityHandling()`（由 `core.js` 构造时注册一次）：

| 事件 | 行为 |
|------|------|
| `document.hidden`（切后台/锁屏） | `this._loopStopped = true` + `cancelAnimationFrame(_rafId)` 中断 rAF 链 + `audio.suspend()` 挂起 AudioContext |
| 恢复可见 | `audio.resume()`；若循环已停则重置采样起点并 `requestAnimationFrame` 重启 |

> 浏览器虽会把隐藏标签页的 rAF 限到 ~1Hz，但音频处理与定时器仍在跑；主动 suspend + 中断 rAF 可彻底归零后台功耗。

### 10.3 相关状态字段（`Game` 实例，`core.js` 初始化）

| 字段 | 含义 |
|------|------|
| `_lastRenderTime` | 上一**渲染**帧时间戳（节流判断用，区别于采样用的 `_lastFrameTime`） |
| `_loopStopped` | 循环是否被后台硬停；`sys_loop` 开头 `if (_loopStopped) return` |
| `_rafId` | 当前 rAF 句柄，用于 `cancelAnimationFrame` |
| `_visibilityBound` | 防止重复注册可见性监听 |

### 10.4 修改指南

- **新增动画活跃阶段**时，须将其阶段名加入 `sys_loop` 的 `_activePhase` 判断，否则会被降帧到 15fps。
- **依赖逐帧计时的菜单逻辑**（如按帧倒计时）在静态阶段会因降帧而变慢（墙钟时间拉长约 4 倍）。此类逻辑应改用 `performance.now()` 墙钟时间差，而非帧计数。
