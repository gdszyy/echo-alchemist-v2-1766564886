# 实体系统规范 (entities.md)

本文档是 Echo Alchemist V2 项目中实体系统（`entities.js` 及相关拆分文件）的开发规范。

## 1. 模块职责
实体系统负责游戏中所有"会动的东西"的定义和更新，包括：
*   **核心实体**：弹珠（MarbleDefinition）、敌人（Enemy）、玩家（Player）、特殊槽位（SpecialSlot）、命运轮盘（FortuneWheel）、钉子（Peg）等。
*   **战斗实体**：子弹（Projectile）、飞剑系统（SwordQi, SlashAnim, SonSword）、分身孢子（CloneSpore）。
*   **视觉特效**：粒子（Particle）、光束（LaserBeam）、冲击波（Shockwave）等。
*   **掉落物**：符文掉落（RuneLoot）。

## 2. 架构拆分状态

随着 Task 2.1 和 Task 2.2 的完成，巨型的 `entities.js` 已完成主要拆分：

| 文件 | 职责 | 主要内容 |
|------|------|----------|
| `src/entities.js` | 入口聚合文件（约 3245 行） | 保留 DropBall、SwordQi、SlashAnim、SonSword、CloneSpore、Player、RuneLoot 等；通过 import/export 聚合所有拆分模块 |
| `src/entities/enemy.js` | 敌人实体（约 1322 行） | Enemy 类（含所有词缀逻辑、AI 行为、温度系统、视觉渲染） |
| `src/entities/projectile.js` | 子弹实体（约 737 行） | Projectile 类（含碰撞检测、伤害计算、视觉效果） |
| `src/utils/math_utils.js` | 纯数学工具函数 | Vec2、lerp、lerpColor、rotateTowards 等 |
| `src/effects/particles.js` | 纯视觉特效类 | Particle、SlashEffect、FireWave、LaserBeam 等 |

**拆分进度统计：**
- Task 2.1 前：entities.js 约 5249 行
- Task 2.1 后：entities.js 约 5249 行（提取了 math_utils.js 和 particles.js）
- Task 2.2 后：entities.js 约 3245 行（提取了 enemy.js 和 projectile.js，减少约 2004 行）

## 3. 音频注入机制

由于 `enemy.js` 和 `projectile.js` 是独立模块，它们各自维护独立的音频代理：

- `entities/enemy.js` 导出 `setEnemyAudioProvider(provider)` 函数
- `entities/projectile.js` 导出 `setProjectileAudioProvider(provider)` 函数
- `entities.js` 的 `setAudioProvider(provider)` 会同时调用上述两个函数，确保音频注入传播到所有子模块
- `core.js` 只需调用 `setAudioProvider`，无需感知子模块的存在

## 4. 温度系统与冰冻衰减机制 (Temperature & Freeze Decay)
*   **核心属性**：`temp` (当前温度), `frozenCount` (累计冰冻次数), `isFrozenCurrentTurn` (当前回合是否被冰冻)。
*   **降温衰减 (Freeze Decay)**：每次敌人被冰冻时（`temp <= -100` 或概率触发），`frozenCount` 会增加 1（逻辑在 `game_phase.js` 第 424 行）。后续该敌人受到的所有降温效果（`amount < 0`）都会乘以 `0.9 ^ frozenCount` 的衰减系数。即：被冰冻 1 次后降温效果为 90%，2 次为 81%，依此类推。
*   **统一入口**：所有温度修改必须通过 `applyTemp(amount)` 方法，衰减逻辑已在该方法内集中处理（`entities/enemy.js` 第 1698 行）。
*   **实现状态**：✅ 已完整实现（Task B1 确认，2026-04-11）。

## 5. 参数调整记录

| 日期 | 文件 | 修改内容 |
|------|------|----------|
| 2026-04-17 | `src/entities/enemy.js`, `src/config.js`, `.cursor/rules/entities.md`, `docs/enemy_design_refactor.md` | **精英紫色/Boss红色设计重构（Elite & Boss Visual Refactor）**：全面提升精英和 Boss 的视觉质感，并实现词缀阶梯式渲染。**精英（Elite）晶化变异（Layer 3.9 `_drawEliteDecoration`）**：新增三个层次的精英专属装饰——E1 晶化切面（不规则多边形几何切面，模拟紫水晶折射，screen 模式）、E2 虚空晶核（缓慢旋转的菱形晶体，带金色描边，呼吸强度联动）、E3 晶核过曝叠加（lighter 模式径向渐变，展现能量溢出）、E4 流光金边（高光点沿边框周长循环流动，lighter 模式）。**Boss 深渊熔炉（Layer 6 新增 3 段）**：深渊黑晕（Abyssal Aura，紧贴身体轮廓的深红近黑 shadowBlur，制造吸光压迫感）、熔岩脉络（Magma Veins，3 条动态弧形红橙纹路，screen 模式呼吸）、狂暴闪烁（Berserk Flicker，狂暴后高频 sin 震荡式白核闪烁，lighter 模式）。**词缀阶梯式渲染（Affix Escalation）**：在 Layer 3.5 的 4 个词缀中分别添加 elite/boss 分支——shield 精英增强：六边形交点节点高光（紫蓝色），Boss 层加实体化装甲片；regen 精英增强：波纹中夹杂上升气泡，Boss 层加生物脉络缠绕；haste 精英增强：残影线带金紫色电弧折线；clone 精英增强：身体内部漂移重影轮廓，Boss 层加轨道卫星旋转。`config.js` 新增 18 个参数字段（分三组：精英装饰、Boss 装饰、词缀阶梯）。设计方案详见 `docs/enemy_design_refactor.md`。 |
| 2026-04-16 | `src/entities/enemy.js`, `src/config.js`, `.cursor/rules/entities.md` | **T1 呼吸曲线升级（Breathe Curve Upgrade）**：将 D1 呼吸缩放和 D3 边框脉冲的线性正弦曲线升级为非线性缓动曲线。具体内容：（1）`config.js` 的 `CONFIG.enemyRender` 新增 5 个参数：`breatheEasingPower: 1.5`（呼吸缓动指数）、`borderPulseOverglowAlpha: 0.25`（边框脉冲过曝叠加层最大透明度）、`borderPulseEliteMultiplier: 1.8`（elite 边框光晕强度倍率）、`borderPulseBossMultiplier: 2.5`（boss 边框光晕强度倍率）、`borderPulseBossPeriodMult: 0.75`（boss 边框脉冲周期倍率）。（2）`enemy.js` D1 呼吸缩放：将 `Math.sin(breathePhase) * amplitude` 改为 `Math.pow((sin+1)*0.5, breatheEasingPower)` 非线性缓动，使呼吸在最大展开和最小收缩时停留感更强。（3）`enemy.js` D3 边框脉冲：同样升级缓动曲线；根据敌人类型应用差异化光晕强度倍率（elite ×1.8，boss ×2.5）；boss 脉冲周期缩短至 75%；在 `pulseIntensity` 峰値时额外叠加 `lighter` 模式高光描边（透明度随 `pulseIntensity` 变化），模拟 brightness 过曝效果。 |
| 2026-04-16 | `src/entities/enemy.js`, `src/config.js` | **Task T3 Arc Boss VFX 高阶视觉特效（Devourer & Ouroboros）**：(1) **config.js** 的 `CONFIG.enemyRender` 新增三个参数：`devourerCoreShakeAmplitude: 2`（Devourer DEVOURING 状态深渊核心震颤幅度，像素）、`ouroborosRuneBreathePower: 1.5`（Ouroboros 符文呼吸缓动`ouroborosBerserkResonanceCount: 6`（Ouroboros 狂暴共鸣法阵三角形数量）。(2) **Devourer DEVOURING 状态增强**：深渊核心改为高频微震颤（双轴 sin/cos 驱动，shakeX/shakeY 随机加权），并在 lighter 模式下叠加白色过渡渐变（模拟能量满溢白化）；旋转能量线在 0.7 位置后向纯白过渡（`overExposeAlpha = devourPulse * 0.8`），线宽和 shadowBlur 随脉冲动态变化；吸入粒子速度提升 1.1 倍并叠加随机尺寸抖动。(3) **Ouroboros Layer 6.5 狂暴共鸣法阵**：狂暴后新增 5a 外圈旋转三角形符文（6 个，交替金色/紫色，lighter 模式），5b 核心爆发脉冲（Math.pow 缓动，lighter 白色渐变），5c 词缀轮转白色闪光（`_rotationFlashTimer = 8` 帧快速衰减，在本地坐标系中 fillRect 全屏覆盖）。(4) **_drawBossDecoration ouroboros case 增强**：符文呼吸改用 `Math.pow((sin+1)*0.5, runePower)` 缓动，shadowBlur 动态范围 8~23；缺口指示箭头非狂暴保持金色（shadowBlur=20），狂暴后改为红色（`#ef4444`，shadowBlur=35）。(5) **_performOuroborosRotation 增强**：狂暴词缀轮转时若 `_berserkedRotation` 已激活则设置 `_rotationFlashTimer = 8`，触发渲染层的全屏白色闪光。 |
| 2026-04-16 | `src/entities/enemy.js`, `src/combat/collision.js`, `src/config.js` | **Task D4 激光照射抖动反馈（Laser Hit Shake）**：为被照射的敌人添加受击抖动效果。具体实现：（1）`config.js` 的 `CONFIG.enemyRender` 新增三个参数：`laserHitShakeDuration: 12` （抱动持续时间，帧数）、`laserHitShakeAmplitude: 3.5` （抱动最大幅度，像素）、`laserHitShakeDecay: 0.88` （抱动衰减系数）。（2）`enemy.js` 构造函数中新增 `_laserHitTimer` 和 `_laserHitIntensity` 状态字段。（3）`update()` 方法中每帧递减 `_laserHitTimer` 并根据时间比例计算 `_laserHitIntensity` （0-1 范围）。（4）`draw()` 方法中在 A3 受击形变之后新增 D4 抖动效果：当 `_laserHitIntensity > 0.001` 时，根据当前强度计算随机位移幅度（最大幅度 = `amplitude * intensity * 2`）并应用 `ctx.translate`。（5）`enemy.js` 新增 `triggerLaserHitShake()` 公开方法，设置 `_laserHitTimer` 为配置值、`_laserHitIntensity` 为 1.0。（6）`collision.js` 的照射模式激光命中位置新增调用 `hit.enemy.triggerLaserHitShake()`，每次照射命中都触发一次抖动。 |
| 2026-04-16 | `src/entities/enemy.js`, `src/config.js` | **T2 Boss 核心过曝模拟（Boss Core Overglow）**：在 `_drawBossDecoration` 方法中为 5 个 Boss 添加 `lighter` 混合模式白色过曝叠加层。**Ignis**：心核绘制后追加 `lighter` 模式径向渐变白色遮罩，透明度随 `pulseIntensity` 动态变化；狂暴时额外乘以 `bossOverglowBerserkMult` 并增加向外扩散的脉冲波纹描边。**Mikro**：六边形网格引入能量液位效果（网格线 alpha 从底部向顶部线性增强）；孢子循环中在每个孢子发光点后叠加 `lighter` 模式白色高光点。**Viridis**：中心光晕内圈颜色在呼吸峰値时向白色过渡（RGB 分量分别计算）；狂暴时藤蔓末端增加 `lighter` 模式白色发光点。**Tesla**：闪烁电光核心中心颜色在 `teslaFlash` 峰値时叠加白色高光；电弧线靠近中心段使用线性渐变强制向白色过渡。**Chimera**：缝合线中间段白色高光强度改为随呼吸周期动态变化；左侧蓝色和右侧红色能量核心各自增加 `lighter` 模式白色过曝叠加。`config.js` 新增 `bossOverglowAlpha: 0.35`（过曝最大透明度）和 `bossOverglowBerserkMult: 1.5`（狂暴强度倍率）两个配置项。 |
| 2026-04-16 | `src/entities/enemy.js`, `src/config.js` | **Task D 生动感增强：呼吸缩放 + 待机微浮动 + 边框脚冲光晕**：三项增强均通过 `CONFIG.enemyRender` 配置节管理魔法数字。**D1 呼吸缩放**：在 `draw()` 的 `ctx.translate` 之后、A3 Squash & Stretch 之前插入，仅在 `actionPhase === 'idle'` 且 `_hitImpact <= 0.001` 且 `hitTimer <= 0` 时生效，使用 `visualSeed` 作相位偏移实现 ±1.8% 呼吸缩放（周期 3200ms）。**D2 待机微浮动**：在 D1 同一 if 块内追加，使用不同周期（2600ms）和额外相位偏移实现 ±1.5px 竖直浮动，与呼吸错开节奏。**D3 边框脚冲光晕**：在 Layer 5 边框绘制之后、`shadowBlur` 重置之前插入，仅在 idle 状态下使用 `ctx.shadowBlur` 实现缓慢脚冲光晕（周期 2800ms），颜色与敌人类型对应（normal: `#94a3b8` / elite: `#facc15` / boss: `#ef4444`）。所有动态效果均使用 `Date.now()` 驱动，不引入新的 update() 状态字段。 |
| 2026-04-15 | `src/entities.js` | **T3 实体投影与环境光照（Peg 光晕 + 软阴影）**：在 `Peg.draw` 方法中新增两处纯视觉增强：(1) **软阴影**（第1036行）：在 `currentRadius` 计算后、旋转变换前，绘制压扁的黑色半透明椭圆（`globalAlpha=0.22`，`fillStyle='rgba(0,0,0,0.7)'`，椭圆 Y 偏移 `currentRadius+3`，半轴比 `0.85:0.22`），模拟钉子「浮」在场地上的感觉。(2) **发光底部光晕**（第1078行）：在基础圆形 `ctx.fill()` 之后，对 `isSpecial || isLit` 的钉子使用 `hexToRgba(glowColor, 0.18)` 创建径向渐变（半径 `currentRadius*3.5`），以 `lighter` 混合模式绘制彩色地面光晕，模拟全局光照映射效果。两处修改均不影响碰撞检测、属性触发和 UI 逻辑。 |
| 2026-04-15 | `src/spawn_system.js`, `src/entities/enemy.js` | **生成编排增强（Boss入场压迫感 + 随从阵型协同）**：(1) **Boss入场冲击波增强**：在 `spawn_triggerBossEntranceShockwave` 中新增气浪推力，根据距离对全场非 Boss 敌人施加垂直向上的 `bumpOffsetY`（最大 -20），形成波浪式避让弹跳效果。(2) **随从阵型呼吸协同**：在 `spawn_spawnEnemyRowAt` 中为每个敌人记录行内列索引 `_spawnColIndex`，并在 `enemy.js` 的 `shield` 词缀蜂巢格纹绘制中引入相位偏移 `+ (this._spawnColIndex || 0) * 0.4`，使同行护盾敌人的脉冲形成从左到右的波浪闪烁。(3) **精英敌人出场强调**：在 `spawn_spawnEnemyRowAt` 中生成 `elite` 敌人时，立即触发小型金色冲击波（`#facc15`）并生成 4~6 个金色 `spark` 粒子，增强精英敌人的存在感。 |
| 2026-04-15 | `src/entities/enemy.js`, `src/config.js` | **Task A 渲染管线增强：材质光泽 + 战损裂纹 + 受击形变**：三项增强均通过 `CONFIG.enemyRender` 配置节管理魔法数字。**A1 材质光泽**：在 `_initTexture()` 的 OffscreenCanvas 预计算阶段，完成基础纹理绘制后叠加顶→底 LinearGradient（顶部 `rgba(255,255,255,0.08)` → 底部 `rgba(0,0,0,0.12)`），使方块/多边形产生 3D 凸起物理厚度感。**A2 战损裂纹**：在 `draw()` 的 Layer 4 区域末尾（现有温度裂纹之后）新增血量联动战损裂纹：当 `hp/maxHp < 0.3` 时，使用已有 `this.fissures` 路径绘制深灰色 `rgba(15,23,42,alpha)` 裂纹，强度随血量比例线性变化，不影响现有温度裂纹逻辑。**A3 受击形变**：新增 `_hitImpact` 字段：`takeDamage()` 中记录受击强度（单次伤害/maxHp，clamp 至 0~0.15）；`update()` 中每帧对 `_hitImpact` 乘以 0.85 进行弹性衰减（已处理所有早期返回分支）；`draw()` 的 `ctx.save()` 后根据 `_hitImpact` 应用 `ctx.scale(1 + _hitImpact * 0.5, 1 - _hitImpact * 0.5)`，使受击瞬间变扁变宽，随后弹性恢复。 |
| 2026-04-15 | `src/entities/enemy.js` | **[Task B] 词缀/Boss 差异化受击粒子扩展**：在 `takeDamage()` 方法中新增 **B1 词缀差异化受击粒子**：根据主导词缀优先级（berserk > shield/haste > regen/clone/devour > jump）选择不同粒子组合——机械类（shield/haste）生成 4~6 个冷蓝/电弧色 `spark`（颜色池 `['#38bdf8', '#bae6fd', '#818cf8', '#67e8f9']`，向四周爆发散射，模拟机械装甲受击时的能量放电感，与火属性橙红色系在色相上形成明显对比）；生物类（regen/clone/devour）生成 2~3 个暗红 `#dc2626`/紫色 `#c084fc` 的 `mist`（vel.y 正値模拟下坠）；冰系/跳跃（jump/glacies Boss）生成 4~6 个 `#a5f3fc` 的 `shard`（均匀散射方向）；狂暴（berserk）生成 3~4 个橙红 `#f97316` 的 `ember` + 1 个小型 `smoke`。新增 **B2 Boss 专属死亡爆炸粒子**：Boss 死亡时（`killed=true`）生成 15~20 个与 `bossType` 颜色对应的 `spark`、3~5 个大型 `mist`（`size = width * 0.8`），并触发 2 次冲击波（第一次立即，第二次通过 `setTimeout(133ms)` 延迟约 8 帧）。在 `updateTempParticles()` 末尾新增 **B3 濒死状态持续粒子**：血量低于 20% 时，从敌人身体随机位置持续迸射极小能量泄漏粒子（`spark` 类型，颜色池 `['#e0f2fe', '#7dd3fc', '#38bdf8', '#c4b5fd']`），触发概率随血量降低而增大（20%血量时约3%/帧，接近0时约8%/帧），粒子尺寸极小（size 1.0~2.5）并向四周随机散射，模拟能量从裂缝中泄漏的状态，不受温度条件限制。所有粒子通过 `game.spawn_createParticle` 或 `game.spawn_pushParticleWithLimit` 生成。 |
| 2026-04-16 | `src/entities/enemy.js` | **[Task B 更新] 受击黑烟替换为能量粒子效果**：(1) **B1 机械类受击粒子更新**：将原深色 `smoke` + 亮白 `spark` 组合替换为纯冷蓝/电弧色系 `spark`（`['#38bdf8', '#bae6fd', '#818cf8', '#67e8f9']`），数量 4~6 个，尺寸小型（size 1.5~3.5），向四周爆发散射，设计语义为机械装甲被击穿时的能量放电感，与火属性橙红色系在色相上形成明显对比。(2) **B3 濒死粒子更新**：将原深色 `smoke`（`rgba(0,0,0,0.5)`）替换为极小能量泄漏 `spark`（青白/电弧蓝/淡紫色系），从敌人身体任意位置向四周散射，模拟能量从裂缝中泄漏。 |
| 2026-04-14 | `src/entities/enemy.js` | **Layer 6 温度状态 UI 修复（异形敌人形状适配）**：修复异形敌人（polygon 随从 / arc Boss）在过热（Stage 4 炙热发光边框）和过冷（Stage 4 冰封外壳）状态下始终显示为方形的 Bug。过热边框：移除了对 `this.type === 'boss'` 的限制，使所有 `collisionShape === 'polygon'` 的敌人（包括普通/elite 异形随从）均沿多边形轮廓绘制炙热光圈。冰封外壳：新增 `polygon` 分支（沿多边形轮廓绘制冰壳 + 第一条边方向反光）和 `arc` 分支（沿外圆绘制环形冰壳 + 圆弧反光），AABB 分支保持原有切角矩形冰块逻辑不变。 |
| 2026-04-14 | `src/entities.js`, `src/game_phase.js`, `src/config.js` | **镜像裂分（Mirror Clone）**：为镜像同步钉盘布局添加中轴线特殊钉子及弹珠复制机制。具体内容：① `game_phase.js` 的 `mirror_sync` 布局 layoutRole 标记阶段新增 `mirror_axis` 角色，每行取最靠近中轴的钉子（`midCol = Math.floor((rowLen-1)/2)`）标记为中轴裂分钉。② `entities.js` 的 `drawLayoutRoleStyle` 新增 `mirror_axis` 绘制逻辑：金色四芒星（✦）+ 外圈脉冲光晕，设计语言与镜像裂分的神秘力量对应。③ `DropBall` 构造函数新增 `_mirrorAxisCooldown = 0` 字段，`update` 方法新增冷却递减逻辑。④ `DropBall.update` 的 layoutRole 物理修正块新增 `mirror_axis` 分支：满足冷却为 0 且 `Math.random() < CONFIG.balance.mirrorAxisCloneChance`（默认 0.35）时，返回 `{action: 'mirror_clone', mirrorX, vel, originalBall}` 指令并设置 20 帧冷却。⑤ `game_phase.js` 的 `gathering_update` 新增 `mirror_clone` 结果处理：创建分身 `DropBall`，使用原弹珠的 `def` 和共享的 `currentSession`（实现属性归入原弹珠），分身弹珠设置 60 帧冷却、`isMirrorClone = true`、`canTriggerSplitSlot = false`。⑥ `DropBall.draw` 新增 LAYER 6：分身弹珠绘制金色虚线外圈脉冲标记。⑦ `config.js` 新增 `CONFIG.balance.mirrorAxisCloneChance = 0.35` 配置项及革新遗物描述。 |
| 2026-04-13 | `src/effects/particles.js`, `src/entities.js`, `src/spawn_system.js`, `src/core.js`, `src/game_phase.js`, `src/entities/enemy.js` | **范围治疗扩散波动画（HealWave）**：新增 `HealWave` 视觉特效类（`particles.js`），专为 `healer` 词缀的范围治疗行动设计。特效包含：中心柔光晕（粉绿渐变，先膨胀后消退）、主扩散环（粉色描边 + 淡填充，扩散速度约为 Shockwave 的一半，持续时间约两倍）、内圈绿色环（层次感）、十字脉冲光线（4 方向，随主环延伸）。`spawn_system.js` 新增 `spawn_createHealWave(x, y, range)` 方法，以治疗范围为参数确保波的大小与实际覆盖区域匹配。`core.js` 初始化 `this.healWaves = []` 数组。`game_phase.js` 在 IceWaves 之后新增 HealWaves 的 update/draw 循环。`enemy.js` 的两处 healer 治疗触发（Boss 行动 + 普通敌人行动）均改为调用 `spawn_createHealWave` + `spawn_createShockwave`（双层视觉），被治疗目标改为生成 4 个粉绿火花粒子 + `❤️+N` 浮动文字，普通敌人治疗同步补充 `greenHp` 修复。 |
| 2026-04-13 | `src/calc_utils.js`, `src/spawn_system.js`, `src/config.js` | **血量算法优化①：峰値伤害改为近3回合滑动平均**：在 `calc_utils.js` 中新增 `calc_getRecentAverageDamage(window=3)` 方法，取 `roundDamageHistory` 最近 N 条记录（加上 `prevRoundDamage`）的算术平均作为玩家战力基准。原 `calc_getPeakAverageDamage`（取历史最高3轮均值）保留为废弃层别名，内部委托给新函数。`spawn_spawnEnemyRowAt` 中的调用点从 `calc_getPeakAverageDamage()` 更新为 `calc_getRecentAverageDamage(3)`。改动背景：旧算法会将早期一次超强输出长期压制后续敌人血量，滑动平均能更及时反映玩家当前实力。 |
| 2026-04-13 | `src/spawn_system.js`, `src/config.js` | **血量算法优化②：Boss血量倍率前期梯度调整**：在 `spawn_calculateBossHP` 中新增「倍率梯度调整（Mult Gradient）」模块。前期区间（`round` 在 `[earlyRound, lateRound]` 内，`t < 1`）根据玩家实时战力与模板预期的比値动态缩放 `bossMult`：`multRatio = clamp(playerImpliedMult / rawBossMult, gradientMin, 1.0)`，`effectiveBossMult = rawBossMult * (multRatio + (1.0 - multRatio) * t)`。后期（`t = 1`）完全使用原始 `rawBossMult`。同时将 Boss 战力评估由 `calc_getPeakAverageDamage` 改为 `calc_getRecentAverageDamage(3)`。`config.js` 的 `bossHpFormula` 新增 `bossMultGradientMin: 0.5`（梯度下限，即 bossMult 最少为原始的 50%）。 |
| 2026-04-13 | `src/spawn_system.js`, `src/config.js` | **减少异型敌人数量**：两处修改减少异型敌人的数量。① `config.js` 的 `bossEntranceShockwave.minionChance` 从 `0.15` 降至 `0.05`，大幅降低 Boss 进场冲击波将普通敌人转化为异型随从的概率（包括大 Boss 加成后上限为 0.15，原为 0.25）。② `spawn_system.js` 的 `spawn_applyMinionShape` 头部新增 50% 概率控制：当无 Boss 历史或随机判断不通过时，直接返回默认 AABB，使普通行生成时异型敌人数量减少约 50%。 |
| 2026-04-13 | `src/entities/projectile.js` | **子弹碰撞反弹逻辑作用域修复**：修复战斗阶段偶发的 `halfW is not defined` 报错。该错误源于 `_handleCollision` 中 AABB 碰撞的局部变量 `halfW/halfH` 在 `if (dist === 0)` 深度穿透处理逻辑中被跨作用域引用。修复方案：重构反弹逻辑，优先使用多态碰撞检测（Polygon/Arc）返回的 `shapeNormal`；若为 AABB 且触发 `dist === 0`，则在当前作用域重新计算 `halfW/halfH`，确保变量定义完备且逻辑正确。 |
| 2026-04-13 | `src/entities/enemy.js`, `src/entities/projectile.js`, `src/spawn_system.js` | **Boss 移动后碰撞框偏移修复**：修复 Boss 移动（如入场或后续移动）后其多边形碰撞框留在原地导致子弹穿透的 Bug。修复方案：(1) 在 `Enemy` 类中新增 `getAbsoluteVertices()` 方法，将相对顶点偏移动态转换为基于当前 `pos` 的绝对坐标；(2) 在 `spawn_system.js` 中将 Boss 多边形顶点定义改为相对于中心点的偏移量；(3) 在 `projectile.js` 的 `_handleCollision` 中调用 `getAbsoluteVertices()` 进行实时碰撞检测。解决碰撞框脱离 Boss 身体及误伤 Boss 的问题。 |
| 2026-04-13 | `src/entities.js` | **SpecialSlot 端点钉子误触发修复**：修复特殊槽仅碰撞连线端点钉子就触发的 Bug。在 `DropBall.update` 的连线碰撞检测中，新增 `_onSegmentInterior` 判断：计算球在线段上的投影参数 `_t` 后，要求 `_t` 必须落在 `(_tMargin, 1 - _tMargin)` 的内部区间（`_tMargin = pegRadius / segLen = 6 / segLen`），排除两端钉子半径范围。只有当 `_onSegmentInterior === true` 且 `_distToLine < _triggerThreshold` 时才触发，确保球必须真正穿越两钉之间的连线区域。 |
| 2026-04-13 | `src/entities/projectile.js`, `src/systems.js` | **顶部反弹墙碰撞检测修复**：修复顶部反弹墙绘制位置与实际碰撞检测位置不一致的 Bug。绘制层（`game_phase.js`）使用 `wallTopY = combatGridTopY - enemyHeight/2` 作为顶部墙位置，而碰撞检测层（`projectile.js`）原使用 `this.pos.y < this.radius`（即 y≈0，画面顶部）。修复方案：在 `_applyMove` 中新增 `topBound` 计算，读取 `game.combatGridTopY - game.enemyHeight / 2 + this.radius`，若 `game` 未就绪则回退到 `this.radius`（y=0）。同时在 `systems.js` 的 `createCombatContext` 中补充 `combatGridTopY: 90` 字段，确保 Demo 模式下碰撞检测正常工作。 |
| 2026-04-12 | `src/entities/enemy.js` | **Mikro 分身减伤机制**：在 `takeDamage` 中新增逻辑，当当前敌人为 Mikro 母体时，根据场上存活的 clone 分身数量（通过 `e.isClone` 标记过滤）计算减伤。每个分身提供 10% 减伤，上限 50%，并显示 `🧬-XX%` 视觉反馈。同时在 `spawn_system.js` 和 `combat_system.js` 的 clone 生成逻辑中补充 `clone.isClone = true` 标记。 |
| 2026-04-12 | `src/entities.js` | **变异需要词条解锁**：`DropBall.handlePegInteraction` 中的突变（Mutation）分支新增前置条件检查 `hasActiveRunewords`（即 `game.activeRunewordEffects` 不为空）。没有激活词条时禁止变异，变异属于高级机制需要词条解锁。升级（Upgrade）分支不受影响。 |
| 2026-04-12 | `src/entities.js`, `src/game_phase.js` | **SpecialSlot 双钉子连线模式重设计**：`SpecialSlot` 类构造函数参数从 `(x, y, width, type)` 改为 `(x, y, x2, y2, type)`，代表两个钉子的坐标而非单个钉子的圆心+宽度。`draw()` 方法改为在两钉子间绘制流动虚线发光连线，并在中点显示符号背景圆。`DropBall.update` 中的碰撞检测从矩形包围盒改为圆心到线段的最短距离检测（阈值 = `ball.radius + slot.height`）。`game_phase.js` 的生成逻辑改为选取一对相邻钉子（距离 ≤ `spacingX * 1.6`）并存储 `slot.pegIndex2`。 |
| 2026-04-12 | `src/entities/enemy.js`, `src/game_phase.js` | **极速/狂暴词条重设计**：`haste` 不再增加行动次数，改为仅在移动阶段额外触发一次移动（显示 `⚡DASH!`）；`berserk` 改为触发时对非移动行动结算两次（不包含移动），并在温度结算阶段每回合 +20℃ 且温度结算执行两次。 |
| 2026-04-12 | `src/entities/enemy.js`, `src/combat_system.js`, `src/config.js` | **Chimera 狂暴阶段受击全场爆炸**：`config.js` 的 `bossConfigs.chimera` 中新增 `berserkedBlastOnHitChance: 0.25`（受击爆炸概率）。`combat_triggerBossEnrage` 的 chimera case 中新增 `boss._berserkedBlastOnHitChance` 标志。`enemy.js` 的 `takeDamage` 中，检测 Chimera 狂暴标志：若触发概率，调用 `game.spawn_createShockwave` 生成橙色冲击波，生成 20 个红橙色 ember 粒子，显示 `💥CHAOS BLAST!` 浮动文字，并随机禁用 3 个钉子（设置高额 cooldownTimer=1000）持续 1 回合。 |
| 2026-04-12 | `src/entities/enemy.js`, `src/combat_system.js`, `src/config.js` | **Viridis 狂暴逻辑修正**：狂暴后 Viridis 不再治疗其他敌人，改为集中治疗自身并加速再生。具体：（1）`config.js` 中 `bossConfigs.viridis.berserkedHealerRange` 从 `999` 改为 `0`，新增 `berserkedSelfRegenMult: 3.0`；（2）`combat_system.js` 的 `combat_triggerBossEnrage` viridis case 中设置 `boss._berserkedHealerRange = 0` 并新增 `boss._berserkedSelfRegenMult = bossCfg.berserkedSelfRegenMult || 3.0`；（3）`enemy.js` 的 regen affix 处理中，检测 Viridis 狂暴时应用 `_berserkedSelfRegenMult` 倍率加速自身回血；（4）Layer 6 新增 Viridis 狂暴绿色脉冲光晕视觉反馈（双层脉冲：外层 `#22c55e` 慢脉冲 + 内层 `#4ade80` 快脉冲）。 |
| 2026-04-12 | `src/spawn_system.js` | `spawn_spawnBoss`：修复 Boss 大小、位置与网格不对齐问题。`bossH` 从 `enemyHeight * 1.5`（非整数行）改为 `enemyHeight * 2`（占 2 整行）；`spawnY` 从硬编码 `80` 改为动态计算 `80 + enemyHeight / 2`，确保 Boss 上下边界与行网格边界完全对齐；`centerX` 从 `(enemyCols/2) * enemyWidth` 改为 `this.width / 2`（更健壮，不依赖 enemyCols 为偶数） |
| 2026-04-12 | `src/spawn_system.js` | **激光机制修复**：`spawn_spawnBullet` 中激光分支（`recipe.isLaser && !recipe.wind`）末尾新增 `return` 语句。修复前，激光分支在执行 `combat_laser_fire` 后缺少 `return`，导致代码继续向下执行实体子弹生成逻辑，额外创建了 `Projectile` 实体。修复后，所有激光属性（`isLaser=true`）仅发射激光束，不再生成实体子弹。 |
| 2026-04-12 | `src/systems.js` | **图鉴文案同步**：更新 `laser` 属性图鉴条目的描述文案，将旧文案"發射弹珠，命中时触发折射激光"改为"直接发射激光束"；同时为训练场激光演示的 `spawn_projectile` 配置添加 `isLaser: true` 标志位，确保训练场行为与主游戏逻辑一致。 |
| 2026-04-11 | `src/entities/enemy.js` | **B1 冰冻衰减确认**：确认 `applyTemp(amount)` 方法（第 1698 行）已正确实现冰冻衰减公式 `Math.pow(0.9, this.frozenCount)`。`frozenCount` 自增逻辑 in `game_phase.js` 第 424 行，每次冰冻触发时自增 1。无需修改。 |
| 2026-04-11 | `src/entities.js` | `DropBall.update`：当 `this.radius > CONFIG.physics.marbleRadius`（即处于倍化状态）时，使用 `friction + 0.005`（上限 0.998）替代默认摩擦力，减少卡墙概率 |
| 2026-04-11 | `src/ui/shop.js` | `permanent_size_up` 效果：`marbleSizeBonus` 从 `4.2` 调整为 `2.5`，防止倍化球在钉盘左右墙面间就少尺寸内将球夹住 |

## 6. 开发规范
*   **依赖管理**：
    *   `math_utils.js` 和 `particles.js` 作为底层模块，**严禁**引入 `entities.js`、`config.js` 或 `audio.js` 等高层业务模块，以避免循环依赖。
    *   `entities.js` 通过 ES Modules (`import`) 引入拆分出的工具和特效类，并对外重新导出 (`export`) 以保持对其他子系统（如 `combat_system.js`）的向后兼容性。
    *   新增实体类时，应在 `src/entities/` 目录下创建独立文件，并在 `entities.js` 中 import + re-export。
*   **性能要求**：实体类的 `update` 和 `draw` 方法会在每一帧高频调用，严禁在这些方法中执行高开销操作（如复杂的 DOM 操作或大规模对象创建）。
*   **音频注入**：`entities.js` 不再直接依赖 `window.audio`，而是通过 `setAudioProvider` 接收来自 `core.js` 的音频实例注入。子模块（`enemy.js`、`projectile.js`）各自维护独立的音频代理，由 `entities.js` 的 `setAudioProvider` 统一分发。
*   **状态同步**：实体状态的改变（如敌人死亡、玩家受伤）应通过事件总线 (`event_bus.js`) 广播，而不是直接修改全局状态。
*   **向后兼容**：`entities.js` 的 export 列表必须保持完整，确保 `core.js` 等上层模块无需修改即可使用。

## 7. 敌人视觉重设计 (Layer 结构)

根据 Task 敌人视觉重设计，`Enemy` 类的 `draw` 方法已更新，采用全新的 Layer 分层结构以支持复杂的词缀特效和底层纹理。新的 Layer 结构如下：

| Layer 层级 | 绘制内容说明 | 备注 |
| :--- | :--- | :--- |
| **Layer 1** | 圆角矩形容器裁剪（`#0f172a` 深色背景） | 基础裁剪层 |
| **Layer 1.5** | 静态底层纹理（OffscreenCanvas）+ 材质光泽渐变 | **新增**，基于 `visualSeed` 预计算（金属拉丝/矿石斑点/能量流线）；**Task A 增强**：底部叠加顶→底 LinearGradient（白色高光 → 黑色阴影），模拟 3D 凸起物理厚度感 |
| **Layer 2** | 液体血条（含延迟白条、绿色回血条） | 真实血量与动画血量 |
| **Layer 3** | 内部覆盖层（过热橙色发光 / 过冷蓝色雾化） | 状态反馈 |
| **Layer 3.5** | 内部词缀特效（**所有词缀**，严格裁剪在方块内） | **重设计**，各词缀采用内部填充纹理，与实际效果强关联 |
| **Layer 4** | 裂纹绘制（过热岩浆裂纹 / 过冷冰晶裂纹 / **战损裂纹**） | 状态反馈；**Task A 增强**：血量 < 30% 时显示深灰色战损裂纹，强度随血量线性变化 |
| **D1/D2** | 呼吸缩放（Breathing Scale）+ 待机微浮动（Idle Float） | **Task D 新增**，仅在 `actionPhase === 'idle'` 且无受击/预警时生效；D1 使用 `ctx.scale` 实现 ±1.8% 呼吸缩放（周期 3200ms）；**T1 升级**：使用 `Math.pow((sin+1)*0.5, breatheEasingPower)` 非线性缓动曲线，增强极大値停留感（默认 `breatheEasingPower=1.5`）；D2 使用 `ctx.translate` 实现 ±1.5px 垂直浮动（周期 2600ms）；均使用 `this.visualSeed` 作为相位偏移，确保同屏多敌人节奏各异；位于 draw() 的 `ctx.translate` 之后、A3 Squash & Stretch 之前 |
| **Layer 5** | 内部边框（普通 / elite / boss） | 包含预警闪烁 |
| **D3** | 边框脉冲光晕（Border Pulse Glow） | **Task D 新增**，仅在 `actionPhase === 'idle'` 时生效；使用 `ctx.shadowBlur` 实现缓慢脉冲光晕（周期 2800ms）；颜色与敌人类型对应：normal：冷灰蓝 `#94a3b8`，elite：金色 `#facc15`，boss：红色 `#ef4444`；位于 Layer 5 边框绘制之后、`shadowBlur` 重置之前；**T1 升级**：同样使用 `Math.pow` 非线性缓动曲线；elite 光晕强度乘以 `borderPulseEliteMultiplier=1.8`，boss 光晕强度乘以 `borderPulseBossMultiplier=2.5` 且周期缩短至 75%；在峰値时额外叠加 `lighter` 模式高光描边（`borderPulseOverglowAlpha=0.25`），模拟 brightness 过曝效果 |
| **Layer 5.5** | 插在身上的子剑（Stuck Swords） | 包含母剑剑穗 |
| **Layer 6** | 外部特效（过热炙热光圈 / 过冷冰封外壳）—— **已适配 polygon/arc/AABB 三种形状** | 状态反馈 |
| **Layer 7** | 扫描反馈（准星动画） | 状态反馈 |
| **文字层** | 血量数字 | Layer 8 外部光环层已删除 |

**Layer 3.5 词缀特效设计语言（重设计后）**：

| 词缀 | 视觉语言 | 颜色 | 关联逻辑 |
| :--- | :--- | :--- | :--- |
| `shield` | 内壁蜂巢六边形格纹，呼吸脉冲 | 浅蓝 `#93c5fd` | 护盾=防御格栅 |
| `regen` | 从底部向上涌动的液体波纹 | 绿 `#4ade80` | 回血=液体涌动 |
| `haste` | 横向扫过的速度残影线 | 金黄 `#facc15` | 极速=运动模糊（仅加速移动） |
| `devour` | 从四周向中心收缩的漩涡弧线 | 暗红 `#dc2626` | 吞噬=向心力 |
| `healer` | 十字形脉冲扩散波，从中心向外 | 粉 `#f472b6` | 治疗=医疗脉冲 |
| `jump` | 底部弹力压缩水平线组 | 青 `#2dd4bf` | 跳跃=弹簧压缩 |
| `clone` | 内部游离细胞斑点，带外层光晕 | 紫 `#c084fc` | 分身=细胞分裂 |
| `berserk` | 底部火焰形燃烧纹路 | 橙红 `#ef4444` | 狂拜=火焰（每回合+20℃，温度结算两次） |

**性能优化说明**：
*   **Layer 1.5**：使用 `OffscreenCanvas` 在 `Enemy` 构造函数中进行预计算，每帧仅执行一次 `drawImage`，性能开销极低。
*   **动态特效**：所有动态效果（如呼吸脉冲、微位移）均使用基于 `Date.now()` 的数学函数（如 `Math.sin`）计算，无需引入复杂的粒子系统。
*   **多词缀叠加**：当词缀数量 > 3 时透明度乘以 0.65，> 1 时乘以 0.8，防止视觉过曝。
*   **严格边界**：所有词缀特效均在 `ctx.clip()` 裁剪区内绘制（Layer 3.5 在 Layer 1 `clip()` 之后、`ctx.restore()` 裁剪结束之前），不会渗出方块边界。
*   **混合模式**：`regen`/`haste`/`healer`/`clone`/`berserk` 使用 `screen` 模式增强亮度而不遮盖血条；`devour` 使用 `multiply` 模式增强暗色漩涡感。

## 8. 随从异型几何化 (Minion Polygon Shapes)

根据 Task tsk-bbd1ce26-997，`spawn_system.js` 新增 `spawn_applyMinionShape(e)` 方法，在 `spawn_spawnEnemyRowAt` 中为每个普通随从分配与当前 Boss 历史对应的几何形状。

### 形状分配规则

| 最后一个 Boss | 随从形状 | 顶点数 | 说明 |
| :--- | :--- | :--- | :--- |
| `ignis` | 等腰三角形 | 3 | 顶点居中，底边对称 |
| `glacies` | 菱形 | 4 | 4顶点菱形冰晶 |
| `mikro` | 正六边形 | 6 | 6顶点小六边形 |
| `devourer` | 残缺矩形 | 5 | 右上角被切掉 |
| `viridis` | 水滴形 | 7 | 多边形近似水滴（顶尖+圆底） |
| `tesla` | 平行四边形 | 4 | 倒斜刀片形 |
| `chimera` | 不规则五边形 | 5 | 不对称碎片 |
| `ouroboros` | 八角形 | 8 | 标准八角形 |
| 无历史 | 默认 AABB | - | `collisionShape='aabb'`, `collisionData=null` |

### 实现细节

*   **`spawn_system.js`**：`spawn_applyMinionShape(e)` 读取 `this.bossHistory` 最后一个元素，使用 `e.width`/`e.height` 计算相对坐标顶点（范围 `[-w/2, w/2]` × `[-h/2, h/2]`），写入 `e.collisionShape = 'polygon'` 和 `e.collisionData.vertices`（`Vec2` 数组）。
*   **`entities/enemy.js`**：`draw()` 方法的 **Layer 1 裁剪** 和 **Layer 5 边框** 均已升级：当 `type` 为 `'normal'` 或 `'elite'` 且 `collisionShape === 'polygon'` 时，使用 `moveTo/lineTo/closePath` 多边形路径替代 `roundRect`/`strokeRect`。
*   **碰撞检测**：`projectile.js` 的 `_handleCollision` 已有 `polygon` 分支（调用 `calc_getCirclePolygonCollision`），无需修改。
*   **顶点坐标约定**：均为相对中心点 `(0,0)` 的偏移量，由 `Enemy.getAbsoluteVertices()` 转换为绝对坐标供碰撞检测使用。

## 9. 随机微差异细节 (Task E: Random Micro-Variation Details)

根据 Task tsk-c4db9f72-873，`enemy.js` 新增三项基于 `visualSeed` 的静态微差异细节，使同类型敌人之间产生个体辨识度，避免「复制粘贴感」。所有计算均在构造时一次性完成，不影响每帧性能。

### E1. 初始化随机静态倾斜（Static Tilt）

*   **字段**：`this._staticTilt`（在 `constructor` 中 `this.visualSeed` 赋値之后一次性计算）
*   **逻辑**：`(this.visualSeed - 0.5) * CONFIG.enemyRender.staticTiltMax`
    *   `boss` 类型：强制为 `0`（不倾斜）
    *   `elite` 类型：乘以 `0.6`（最大 ±1.5°）
    *   `normal` 类型：最大 ±2.5°（弧度约 ±0.044）
*   **渲染**：在 `draw()` 方法的震动 `ctx.translate` 之后、Layer 1 容器裁剪之前插入 `if (this._staticTilt !== 0) ctx.rotate(this._staticTilt);`
*   **配置**：`CONFIG.enemyRender.staticTiltMax = 0.044`

### E2. 纹理色调随机偏移（Hue Shift Overlay）

*   **位置**：`_initTexture()` 的 A1 光泽渐变之后追加
*   **逻辑**：基于 `visualSeed` 叠加一层极淡的彩色 `overlay` 覆盖
    *   `hueAlpha = hueShiftAlphaMin + seed * hueShiftAlphaRange`（0.04 ~ 0.08）
    *   `hue = Math.floor(seed * 60) - 15`（-15° ~ +45°）
    *   `hue >= 0`：暖色调 `rgba(255, 180, 50, hueAlpha)`；`hue < 0`：冷色调 `rgba(100, 150, 255, hueAlpha)`
    *   使用 `globalCompositeOperation = 'overlay'`，完成后重置为 `'source-over'`
*   **配置**：`CONFIG.enemyRender.hueShiftAlphaMin = 0.04`，`hueShiftAlphaRange = 0.04`

### E3. 边角随机磨损点（Corner Wear Dots）

*   **位置**：`_initTexture()` 的 E2 之后追加
*   **逻辑**：在四个角落附近放置 2~4 个极小的深色磨损点
    *   数量：`wearDotCountMin + Math.floor(seed * (wearDotCountMax - wearDotCountMin + 1))`（2~4 个）
    *   角落基准坐标：`[w*0.15, h*0.15]`、`[w*0.85, h*0.15]`、`[w*0.15, h*0.85]`、`[w*0.85, h*0.85]`
    *   每个点在角落附近随机偏移 `±w*0.15 / ±h*0.15`
    *   半径：1.5 ~ 3px；颜色：`rgba(0, 0, 0, 0.25 ~ 0.45)`
    *   使用 `seededRand(s)` 伪随机函数（`Math.sin` 哈希）保证纹理重建结果一致
*   **配置**：`CONFIG.enemyRender.wearDotCountMin = 2`，`wearDotCountMax = 4`，`wearDotAlphaMin = 0.25`，`wearDotAlphaMax = 0.45`

### 变更日志（Task E）

| 日期 | 文件 | 变更说明 |
| :--- | :--- | :--- |
| 2026-04-16 | `src/entities/enemy.js` | **Task E**：constructor 新增 `_staticTilt` 一次性预计算；`_initTexture` 末尾追加 E2 色调偏移和 E3 磨损点；`draw()` 震动之后插入 E1 静态倾斜旋转 |
| 2026-04-16 | `src/config.js` | **Task E**：`CONFIG.enemyRender` 新增 `staticTiltMax`、`hueShiftAlphaMin`、`hueShiftAlphaRange`、`wearDotCountMin`、`wearDotCountMax`、`wearDotAlphaMin`、`wearDotAlphaMax` 七个参数 |

## 10. 性能相关渲染开关（自适应性能系统）

> 详细规范见 [`.cursor/rules/performance.md`](performance.md)

`entities.js`（`Peg.draw`）和 `entities/enemy.js`（`Enemy._initTexture`）均已接入自适应性能系统，通过 `game.perfQualityLevel` 动态控制高开销渲染步骤：

| 文件 | 受控渲染步骤 | 控制字段 | 关闭等级 |
|------|------------|---------|----------|
| `entities.js` → `Peg.draw` | 椭圆软阴影（`ellipse`） | `pegSoftShadow` | `low` |
| `entities.js` → `Peg.draw` | 底部径向光晕（`createRadialGradient` + `lighter`） | `pegGlowHalo` | `medium` / `low` |
| `entities/enemy.js` → `Enemy._initTexture` | 材质光泽渐变（OffscreenCanvas `LinearGradient`） | `enemyGloss` | `low` |

**修改注意事项：**

- `Peg.draw` 通过 `typeof game !== 'undefined' && game.perfQualityLevel` 读取等级，默认回退 `'high'`。
- `Enemy._initTexture` 在构造时调用，通过 `window.game` 读取等级（若 `window.game` 尚未挂载则默认开启光泽）。
- 新增 Peg 或 Enemy 的高开销渲染步骤时，**必须**在 `CONFIG.performance` 中添加对应开关，并在 `performance.md` 第 5 节更新消费端关联索引。
