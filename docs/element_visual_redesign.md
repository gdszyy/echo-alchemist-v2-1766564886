## 元素视觉重做方案 — PixiJS 优先渲染设计

> 版本: v1.0 | 日期: 2026-06-25 | 状态: 设计稿

本文档定义 Echo Alchemist V2 全部 11 种元素属性的视觉表现重做方案。核心目标：让每种元素在战斗中拥有**一眼可辨**的视觉身份，充分利用 PixiJS 7 WebGL 管线的 ADD 混合、预烘焙纹理和 GPU 批渲染能力，同时保留 Canvas 2D 回退路径。

---

## 1. 现状评估

### 1.1 元素视觉成熟度矩阵

| 元素 | 弹体视觉 | 命中反馈 | 持续状态 | 共鸣激活 | 成熟度 |
|------|----------|----------|----------|----------|--------|
| pyro | 熔核高光 + 暖弧描边 | Burn 浮动文字 + 火花 | BurnEffect 光环 + 热裂纹 + 余烬边框 | 火焰共鸣文字标记 | ★★★★☆ |
| cryo | 冰晶内核形状 | 冻结温度下降 | 冷雾 + 霜覆 + 冰裂纹 + 冰封壳 | 无独特视觉 | ★★★★☆ |
| lightning | 锯齿电弧环绕 | 闪电链 LightningBolt | 无 | 二阶双重闪电链 | ★★★☆☆ |
| venom | 径向绿色渐变体 | 毒粒子爆发 + 骷髅文字 | 无持续 DoT 视觉 | 毒素扩散粒子 | ★★☆☆☆ |
| wind | 月牙形轨道风刃 | wind_slash 梭形粒子 | 无 | 无 | ★★☆☆☆ |
| laser | 脉冲光环 + 明亮核心 | LaserBeam 光束 | 无 | 无独特视觉 | ★★☆☆☆ |
| bounce | 仅颜色区分（绿） | 无独特效果 | 无 | 无 | ★☆☆☆☆ |
| pierce | 箭头形状 | PierceCutEffect 边缘光 | 无 | 穿透赋热文字 | ★★☆☆☆ |
| scatter | 四角星形状 | 无独特效果 | 无 | 无 | ★☆☆☆☆ |
| overcharge | 琥珀色 | 红色冲击波 + 爆炸文字 | 无 | 无 | ★★☆☆☆ |
| echo | 紫色（与 lightning 近似） | 回响文字 + 幽灵弹 | 无 | 无 | ★☆☆☆☆ |

### 1.2 核心问题

**视觉辨识度不足**：bounce / scatter / echo 三种元素在战斗中几乎无法通过视觉区分。bounce 和 scatter 只有弹体形状差异（圆形 vs 星形），echo 和 lightning 共享紫蓝色调且无独特反馈。

**持续状态缺失**：除 pyro（BurnEffect）和 cryo（温度驱动全阶段视觉）外，其余 9 种元素命中敌人后没有任何持续视觉反馈。玩家无法从敌人外观判断其正在受到哪种元素的持续影响。

**共鸣激活无仪式感**：共鸣激活时仅显示浮动文字，缺乏视觉上的"升级感"。作为重要的战力里程碑，共鸣应当有醒目的全屏或全敌人视觉提示。

**PixiJS Filter 未启用**：当前全部"发光"效果通过多层 Graphics 线条模拟，未使用 PIXI.Filter（ColorMatrix / Blur / 自定义 shader）。这限制了色调变换、辉光后处理、扭曲等高级视觉能力。

---

## 2. 设计原则

**一元素一语言**：每种元素拥有独特的"视觉语言"——包含色彩基调、运动模式、粒子形态和音效节奏。玩家在混战中仅凭视觉运动模式就能判断当前主导元素。

**渐进式强度**：视觉强度随元素层数 / 温度 / 共鸣阶数递进。低层数 = 微妙暗示，高层数 = 全面覆盖。避免低层数就过度炫目导致高层数无处升级。

**PixiJS 优先、Canvas 2D 兜底**：所有新增效果优先用 PixiJS Sprite / Graphics / Filter 实现，保留 Canvas 2D 简化版回退。回退版允许降低视觉复杂度但必须保留核心信息。

**性能预算门控**：每种新效果必须标注 high / medium / low 三档表现，接入 `CONFIG.performance` 预算系统。低档允许完全禁用非核心粒子层。

---

## 3. 逐元素重做方案

### 3.1 Pyro 火焰 — 已完成，微调建议

**当前状态**：BurnEffect 类已实现（热量光环 + 火焰弧线 + 余烬微粒），热裂纹 / 余烬边框 / 过热爆炸均已就位。Pyro 是视觉最成熟的元素。

**微调建议**：
- 共鸣激活时，BurnEffect 的火焰弧线数量从 6 增至 8，颜色从橙→红→白的色温升高
- 三阶共鸣在敌人脚下添加 `fireRing` 纹理的地面灼烧印记（缩放至敌人体宽 ×1.5，alpha 0.3）
- 过热爆炸（ember_fuse）增加 FireWave 小型扩散环（当前只有 Shockwave + 粒子）

**新增纹理**：无（复用 fireRing / ember / shockwaveRing）

### 3.2 Cryo 冰霜 — 微调建议

**当前状态**：冷雾粒子 + 霜覆 + 冰裂纹 + 冰封壳已形成完整阶段递进。IceWave 死亡效果已迁移 PixiJS。

**微调建议**：
- 冰封壳（temp ≤ -100）增加 PixiJS Filter 色调偏移：对敌人身体区域施加 ColorMatrixFilter 使颜色偏冷蓝（后续 PIXI Filter 基础设施就绪后实现）
- 共鸣激活时，冰裂纹从白色变为带棱角的六角雪花图案（Canvas 2D 路径变化）
- 三阶共鸣在敌人周围生成 2-3 个缓慢旋转的冰棱锥体（PIXI.Graphics 绘制三角形 + 白色高光）

**新增纹理**：`frostHex`（六角雪花模板纹理，64×64，白色线条）

### 3.3 Lightning 闪电 — 中等重做

**当前状态**：LightningBolt 链式闪电有 PixiJS 适配器，弹体有锯齿电弧。但命中后敌人身上无持续电击视觉。

**重做方案**：

**A. 新增 — 电弧缠绕效果（类似 BurnEffect 的持续效果类）**

创建 `ElectrocuteEffect` 类，在 lightning 命中时附加到敌人身上，持续 2-3 秒（每次 lightning 命中刷新计时器）：
- 3-5 条随机路径的锯齿电弧在敌人表面闪烁，每 100-200ms 重新随机路径
- 使用 PIXI.Graphics 绘制，2 层 glow（外层紫色 `#c084fc` alpha 0.3，内层白色 alpha 0.8）
- 电弧端点偶尔产生微小 spark 粒子（复用 spark 纹理）
- Canvas 2D 回退：用 `shadowBlur` + `strokeStyle` 画锯齿线段

**B. 弹体电弧增强**

当前弹体的闪电弧数量 `1 + floor(lightning/2)` 上限为 3。共鸣激活时弧数量 +2，且每隔 2 秒一次全白闪光（当前 20% 概率提升为 40%）。

**C. 共鸣视觉**

三阶共鸣：链式闪电的 LightningBolt 从单线变为分叉树状（主弧 + 2 条分支弧），颜色从紫色变为白紫色。

**新增纹理**：`electricArc`（预烘焙短弧段纹理，32×16，白色中心→紫色边缘，用于 ParticleContainer 批渲染微小电弧碎片）

### 3.4 Venom 剧毒 — 中等重做

**当前状态**：venom 粒子模式（绿色径向渐变上浮）已有，命中时有 1-4 粒子爆发。但 DoT 期间敌人身上完全无毒素视觉。

**重做方案**：

**A. 新增 — 毒液渗流效果**

创建 `VenomEffect` 类，在 venom 命中时附加，持续时间与 venom DoT 同步：
- 2-3 条绿色毒液沿敌人表面缓慢流淌（从顶部向下），使用 PIXI.Graphics 画不规则曲线路径
- 毒液路径上留下淡绿色残影（alpha 随时间衰减至 0）
- 毒液滴落时在敌人底部产生 1 个 venom 粒子
- 共鸣激活时毒液颜色从绿色变为荧光黄绿色（`#bef264`），且增加毒雾粒子（复用 mist 模式 + 绿色 tint）
- Canvas 2D 回退：用 `bezierCurveTo` + `shadowBlur` 画绿色曲线

**B. 命中爆发增强**

venom 命中粒子数从 1-4 提升为 2-6，粒子尺寸增大 20%。共鸣时粒子变为向上喷射的毒泡（圆形 + 内部高光点）。

**新增纹理**：`venomDrip`（预烘焙毒液滴形状纹理，32×48，绿色径向渐变泪滴形）

### 3.5 Wind 风 — 中等重做

**当前状态**：弹体有月牙形轨道风刃，wind_slash 粒子模式（梭形叶片）已有。但风元素缺少"持续风场"的视觉概念。

**重做方案**：

**A. 新增 — 旋风标记效果**

创建 `WindMarkEffect` 类，wind 命中时在敌人脚下生成旋转风场标记：
- 底层：bladeStormRing 纹理缩放至敌人体宽 ×1.2，缓慢旋转（`time * 0.5`），alpha 0.25
- 上层：2-3 条弧形风线（PIXI.Graphics 画弧线 + wind_slash 纹理采样色 `#34d399`），围绕敌人旋转
- 风线数量随 wind 层数增加（每 2 层 +1 条，最多 5 条）
- Canvas 2D 回退：`arc()` + `shadowBlur` 画旋转弧线

**B. 弹体风刃增强**

月牙轨道半径随 wind 层数扩大（当前固定 1.8× radius），共鸣时风刃变为双刃（两层月牙交错 60°）。

**新增纹理**：`windVortex`（预烘焙环形风纹纹理，128×128，翡翠色弧线辐射图案）

### 3.6 Laser 激光 — 轻量增强

**当前状态**：LaserBeam 有 PixiJS 适配器（3 层 glow 线条），弹体有脉冲光环。视觉基础良好，缺少命中持续反馈。

**增强方案**：

**A. 命中灼点**

laser 命中时在敌人身上留下短暂的灼烧光点（持续 0.5 秒）：
- 使用 PIXI.Sprite 复用 muzzleCore 纹理，缩放至 0.15，ADD 混合
- 光点 alpha 从 1.0 快速衰减至 0
- 共鸣激活时灼点变为中心十字准星形状（PIXI.Graphics 画 2 条垂直线）

**B. 共鸣视觉**

三阶共鸣：LaserBeam 光束宽度翻倍，颜色从白色变为天蓝色 `#0ea5e9`，光束周围产生 2-3 个折射分裂光束（偏移 ±15°，alpha 0.3）。

**新增纹理**：无（复用 muzzleCore / bulletGlow）

### 3.7 Bounce 弹跳 — 重做

**当前状态**：仅有绿色弹体和尾迹，命中后无任何独特视觉。是所有元素中视觉最弱的。

**重做方案**：

**A. 弹跳动能弧线**

弹跳命中时在敌人表面产生 1 条绿色动能弧线（从命中点沿表面弯曲延伸），持续 0.8 秒后衰减：
- PIXI.Graphics 画二次贝塞尔曲线，2 层 glow（外层 `#22c55e` alpha 0.3，内层白色 alpha 0.7）
- 弧线方向指示弹跳反弹方向
- 多次弹跳在同一敌人上时，弧线叠加（最多 3 条）

**B. 弹跳计数标记**

每次弹跳命中在敌人头顶短暂闪烁一个绿色 `+1` 计数器（复用 FloatingText，颜色 `#22c55e`，字号缩小）。

**C. 共鸣视觉**

三阶共鸣：弹跳弧线变为双螺旋（2 条交错弧线），末端产生 1 个小型 Shockwave（绿色 tint，缩小 50%）。

**新增纹理**：无（复用 shockwaveRing + Graphics 绘制）

### 3.8 Pierce 穿透 — 轻量增强

**当前状态**：PierceCutEffect 有 PixiJS 适配器（边缘光 + 核心裂纹 + 碎片三角），箭头弹体形状有辨识度。

**增强方案**：

**A. 穿透轨迹残留**

穿透多个敌人时，在穿透路径上留下短暂的红色裂痕线（持续 1 秒），连接所有被穿透的敌人：
- PIXI.Graphics 画直线（3 层 glow，外层 `#ef4444`，内层白色）
- 线条 alpha 从 0.8 衰减至 0

**B. 共鸣视觉**

三阶共鸣：穿透命中时产生 PierceCutEffect 的放大版（尺寸 ×1.5），碎片三角数量从 3 增至 6。

**新增纹理**：无

### 3.9 Scatter 散射 — 重做

**当前状态**：四角星弹体形状，命中无独特视觉。

**重做方案**：

**A. 散射星爆标记**

scatter 命中时在敌人身上产生一个短暂的星爆图案（持续 0.6 秒）：
- 4-6 条从命中点辐射的金色光线（PIXI.Graphics 画放射线，`#facc15`）
- 光线末端产生微小 spark 粒子
- 共鸣激活时辐射线变为 8-12 条，且末端产生小型四角星闪烁（复用 scatter 弹体形状）

**B. 共鸣视觉**

三阶共鸣：散射弹体轨迹留下金色残影（trail 纹理 tint 为 `#facc15`，持续 0.3 秒）。

**新增纹理**：`starBurst`（预烘焙四角星爆纹理，64×64，金色辐射线图案）

### 3.10 Overcharge 超载 — 轻量增强

**当前状态**：弹体销毁时有红色冲击波 + 爆炸文字。基础视觉已有，需增强仪式感。

**增强方案**：

**A. 超载充能光环**

overcharge 弹体存在期间，周围有脉冲电场（每帧 5% 概率产生 1 条微小电弧，复用 electricArc 纹理或 Graphics 画短线段）。

**B. 爆炸增强**

超载爆炸时，Shockwave 外层增加一圈琥珀色 `#f59e0b` 的二级冲击波（延迟 100ms，尺寸 ×1.3），形成双环爆炸。

**C. 共鸣视觉**

三阶共鸣：爆炸中心增加 `overchargeFlash`（全屏白色闪光 alpha 0.15，200ms 衰减），给予"大招感"。

**新增纹理**：无（复用 shockwaveRing tint + Graphics）

### 3.11 Echo 回响 — 重做

**当前状态**：命中时仅有浮动文字 + 幽灵弹创建。与 lightning 色调重叠（均为紫色系），辨识度最低。

**重做方案**：

**A. 回响波纹效果**

echo 触发回响时，在原弹体位置产生扩散声波波纹（与 Shockwave 不同——多圈同心圆，而非单圈）：
- 3 圈同心圆依次扩散（间隔 80ms），颜色 `#60a5fa`（区别于 lightning 的 `#c084fc`）
- 每圈 alpha 递减（0.5 → 0.3 → 0.15）
- 使用 PIXI.Graphics 画 3 个同心 `arc()`，线宽递减

**B. 幽灵弹视觉增强**

回响产生的幽灵弹增加蓝色残影（trail 纹理 tint 为 `#60a5fa`），使其与原始弹体有明显区分。

**C. 共鸣视觉**

三阶共鸣：回响触发时敌人周围出现声波特效——4 条等距弧线从敌人身体向外扩散（颜色变为 `#93c5fd`），模拟"回声定位"视觉。

**新增纹理**：`echoRipple`（预烘焙同心圆波纹纹理，128×128，蓝色 3 圈同心线）

---

## 4. 新增 PixiJS 纹理清单

| 纹理名 | 尺寸 | 描述 | 服务于 |
|--------|------|------|--------|
| `frostHex` | 64×64 | 六角雪花线条模板，白色 | Cryo 共鸣 |
| `electricArc` | 32×16 | 短弧段，白色中心→紫色边缘 | Lightning 持续效果 |
| `venomDrip` | 32×48 | 泪滴形绿色径向渐变 | Venom 持续效果 |
| `windVortex` | 128×128 | 环形翡翠弧线辐射 | Wind 持续效果 |
| `starBurst` | 64×64 | 四角金色辐射线 | Scatter 命中 |
| `echoRipple` | 128×128 | 3 圈蓝色同心圆 | Echo 回响 |

合计 6 张新纹理，全部可用 OffscreenCanvas 在启动时预烘焙（与现有 `_initEffectTextures()` 模式一致）。

---

## 5. 新增效果类清单

| 类名 | 位置 | 触发条件 | 生命周期 | 视觉层 |
|------|------|----------|----------|--------|
| `ElectrocuteEffect` | particles.js | lightning 命中 | 2-3 秒计时器，命中刷新 | 3-5 条锯齿电弧 + spark 粒子 |
| `VenomEffect` | particles.js | venom 命中 | 与 DoT 同步 | 2-3 条毒液曲线 + 滴落粒子 |
| `WindMarkEffect` | particles.js | wind 命中 | 1.5 秒计时器 | 旋转风场标记 + 弧形风线 |

每个类遵循现有适配器模式：`_pixiCreate` → `_pixiSync` → `_pixiDestroy`，挂在 `enemy._electrocuteEffect` / `enemy._venomEffect` / `enemy._windMarkEffect`。

---

## 6. 共鸣激活全局视觉

共鸣是重要的战力里程碑，需要超越"浮动文字"的仪式感。

**方案**：共鸣激活瞬间（tier 1/2/3 首次达成时），在全局渲染层叠加一次元素专属脉冲：

| 共鸣元素 | 全局脉冲视觉 | 颜色 | 持续时间 |
|----------|-------------|------|----------|
| pyro | 屏幕边缘橙色热浪内缩 | `#f97316` | 800ms |
| cryo | 屏幕边缘冰霜结晶扩散 | `#06b6d4` | 800ms |
| lightning | 全屏白色闪光 + 紫色电弧 | `#c084fc` | 400ms |
| venom | 屏幕边缘绿色毒雾渗入 | `#4ade80` | 1000ms |
| wind | 全屏翡翠风线旋转 | `#34d399` | 600ms |
| laser | 天蓝色十字准星闪烁 | `#0ea5e9` | 300ms |

实现方式：在 `_effectContainer` 顶层创建一个全屏 Sprite / Graphics，使用 `pixiIsActive()` 路径 + Canvas 2D 回退。通过 EventBus 事件 `resonance:activated` 触发。

---

## 7. 性能预算影响

### 7.1 每敌人最大视觉负载

| 元素效果 | Sprite 数 | Graphics 数 | 粒子数 | 备注 |
|----------|-----------|-------------|--------|------|
| BurnEffect | 1 aura + 4 ember | 1 | 0 | 已完成 |
| ElectrocuteEffect | 0 | 1 | 2-3 spark | 电弧重绘频率 5-10Hz |
| VenomEffect | 0 | 1 | 1-2 venom | 曲线路径重绘频率 2Hz |
| WindMarkEffect | 1 ring | 1 | 0 | 仅旋转同步 |

最坏情况（一个敌人同时受 pyro + lightning + venom 影响）：2 Sprite + 3 Graphics + 5 粒子。在 10 个敌人同时受元素影响时：20 Sprite + 30 Graphics + 50 粒子，在现有预算范围内。

### 7.2 性能档位门控

| 效果层 | high | medium | low |
|--------|------|--------|-----|
| BurnEffect 全层 | ✓ | ✓ 仅 aura | ✗ |
| ElectrocuteEffect | 5 弧 + spark | 3 弧 | 1 弧 |
| VenomEffect | 3 曲线 + 滴落 | 2 曲线 | 1 曲线 |
| WindMarkEffect | 5 风线 + ring | 3 风线 | 仅 ring |
| 共鸣全局脉冲 | ✓ | ✓ 简化 | ✗ |

---

## 8. 实施阶段

### Phase 1 — 持续效果类基础（2-3 轮） ✅ 已完成 (2026-06-25)
1. ~~`ElectrocuteEffect` 类 + 适配器 + enemy.js 集成~~
2. ~~`VenomEffect` 类 + 适配器 + enemy.js 集成~~
3. ~~`WindMarkEffect` 类 + 适配器 + enemy.js 集成~~
4. ~~新增 6 张预烘焙纹理到 pixi_bridge.js~~
5. 性能预算配置更新

**实现细节**:
- `particles.js` 新增 ElectrocuteEffect (~165行)、VenomEffect (~140行)、WindMarkEffect (~120行)
- `pixi_effect_adapter.js` 新增 3 组适配器 (create/sync/destroy)
- `pixi_bridge.js` 新增 6 张元素纹理: frostHex, electricArc, venomDrip, windVortex, starBurst, echoRipple
- `enemy.js` 完成 import/update/draw/death 全生命周期接入
- `combat_system.js` 完成 3 个元素命中 Hook (lightning→Electrocute, venom→Venom, wind→WindMark)
- `entities.js` 完成 re-export 桥接 (BurnEffect + 3 新类)
- 7 个修改文件全部通过 `node --check` 语法验证

### Phase 2 — 弹体与命中增强（1-2 轮）
1. 各元素弹体装饰增强（共鸣层级联动）
2. 命中反馈粒子数量 / 形态按元素调整
3. Bounce / Scatter / Echo 的命中特效补齐
4. Overcharge 双环爆炸

### Phase 3 — 共鸣全局视觉（1 轮）
1. 共鸣激活全局脉冲效果
2. EventBus 事件 `resonance:activated` 接入
3. 各元素共鸣层级视觉升级

### Phase 4 — PIXI Filter 引入（需 Filter 基础设施就绪）
1. Cryo ColorMatrixFilter 冷蓝色偏移
2. 全局 Bloom / Glow 后处理（可选）
3. 自定义扭曲 shader（Heat haze / Wind distortion）

---

## 9. 文件修改影响范围

| 文件 | 修改类型 | 预估行数 |
|------|----------|----------|
| `src/effects/particles.js` | 新增 3 个效果类 | +350 |
| `src/render/pixi_effect_adapter.js` | 新增 3 组适配器 | +300 |
| `src/render/pixi_bridge.js` | 新增 6 张纹理烘焙 + Filter 生命周期集成 | +80 |
| `src/render/pixi_filter_manager.js` | **新建** Filter 管理器模块 | +350 |
| `src/entities/enemy.js` | 3 个效果的生命周期 + 渲染 | +60 |
| `src/config.js` | 性能预算新增条目 | +20 |
| `src/combat_system.js` | 元素命中时附加效果 | +30 |
| `src/entities/projectile.js` | 弹体装饰增强 | +40 |

---

## 10. PIXI Filter 基础设施（已实现）

> 状态: ✅ 已完成 | 文件: `src/render/pixi_filter_manager.js`

### 10.1 架构概览

滤镜管理器作为独立模块 `pixi_filter_manager.js` 实现，避免与 `pixi_bridge.js` 产生循环依赖（使用本地 `_pixiReady()` 检查代替导入 `pixiIsActive`）。

**核心 API**：

| 函数 | 用途 |
|------|------|
| `filterApply(key, target, filters, opts)` | 将滤镜组施加到目标 PIXI 对象 |
| `filterRemove(key)` | 移除并销毁指定滤镜 |
| `filterUpdateAll(dt)` | 每帧更新所有活跃滤镜（由 pixiTick 调用） |
| `filterRemoveByTag(prefix)` | 批量移除（如阶段转换时清除 'element_*'） |
| `filterDestroyAll()` | 销毁全部滤镜（由 pixiDestroy 调用） |
| `filterSetEnabled(key, enabled)` | 切换启用/禁用（不移除） |

### 10.2 预设滤镜工厂

**PixiJS 内置滤镜封装**：

| 工厂函数 | 底层滤镜 | 用途 |
|----------|----------|------|
| `createColorMatrixFilter(opts)` | PIXI.filters.ColorMatrixFilter | 亮度/对比度/饱和度/色相 |
| `createBlurFilter(opts)` | PIXI.filters.BlurFilter | 高斯模糊 |
| `createNoiseFilter(noise, seed)` | PIXI.filters.NoiseFilter | 噪点覆盖 |

**元素专属预设**：

| 预设函数 | 效果 | 应用场景 |
|----------|------|----------|
| `presetCryoTint()` | 冷蓝色偏移 + 去饱和 | 冰冻效果 Sprite |
| `presetPyroTint()` | 暖红增强 + 亮度提升 | 燃烧效果 Sprite |
| `presetLightningPulse()` | 高频亮度振荡 + 紫色偏移 | 电弧效果 Sprite |
| `presetResonancePulse(element)` | 全屏元素色调闪烁 + 衰减 | 共鸣激活仪式感 |

**自定义 Fragment Shader 滤镜**：

| 工厂函数 | 效果 | uniform 参数 |
|----------|------|-------------|
| `createHeatHazeFilter(opts)` | 正弦波位移热浪扭曲 | uTime, uIntensity, uFrequency |
| `createFrostOverlayFilter(opts)` | 冷蓝色调 + 边缘光晕 + 冰晶噪声 | uTime, uIntensity |
| `createVenomSeepFilter(opts)` | 绿色通道增强 + 有机脉动 | uTime, uIntensity |
| `createElectricFlickerFilter(opts)` | 多层正弦闪烁 + 紫色偏移 | uTime, uIntensity |

### 10.3 性能门控

所有滤镜受三档性能门控：
- `opts.minTier` 参数指定最低允许档位（'high' / 'medium' / 'low'）
- low 档位下自动跳过所有滤镜施加（`filterApply` 返回 false）
- 自定义 shader 滤镜建议 minTier = 'medium'（每帧 GPU 纹理采样开销较高）

### 10.4 接入方式

```js
// 示例 1：对 BurnEffect auraSprite 施加暖调滤镜
import { filterApply, presetPyroTint } from '../render/pixi_filter_manager.js';

const tint = presetPyroTint();
if (tint) {
    filterApply(`pyro_tint_${enemyId}`, auraSprite, [tint], {
        tag: 'element_pyro',
        minTier: 'medium',
    });
}

// 示例 2：共鸣激活时全屏脉冲
import { filterApply, presetResonancePulse } from '../render/pixi_filter_manager.js';
import { pixiGetGameContainer } from '../render/pixi_bridge.js';

const pulse = presetResonancePulse('pyro', 800);
if (pulse) {
    const gc = pixiGetGameContainer();
    filterApply(pulse.key, gc, [pulse.filter], {
        updateFn: pulse.updateFn,
        tag: 'resonance_pulse',
        minTier: 'low',
    });
}
```

### 10.5 生命周期集成

| 事件 | 调用 | 位置 |
|------|------|------|
| 每帧渲染前 | `filterUpdateAll(16)` | pixi_bridge.js → pixiTick() |
| 游戏销毁 | `filterDestroyAll()` | pixi_bridge.js → pixiDestroy() |
| 阶段转换 | `filterRemoveByTag('element_')` | game_phase.js（待接入） |
