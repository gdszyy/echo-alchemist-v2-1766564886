# Echo Alchemist · 3D 沉浸式视觉重构方案

> 状态：草案（Draft v1）  
> 范围：彻底重做游戏的视觉表现层。保留所有玩法规则、数值、概率、流程；推翻当前 2D Canvas + 位图 Sprite 的渲染层，重建为 WebGL/Three.js 的 3D 渲染管线，并在保持核心玩法（钉板+打砖块）"看得清"的前提下，赋予整体场景以电影感、张力与沉浸感。

---

## 0. TL;DR（一页纸方案）

- **技术栈**：`Three.js` (r160+) + `EffectComposer` 后处理 + WebGL2（WebGL1 降级）。
- **整体观感**：暗黑炼金（dark alchemical）+ 赛博（cyber）的 2.5D 视角——3D 场景中、**核心玩法面板（钉板/砖墙）以接近正交、轻度透视**呈现，前后景做大幅度景深虚化营造画框感。
- **镜头**：相机看向"玩法面板"，有 3°–8° 的轻俯角与轻偏转；轻度桶形畸变（barrel）+ 色散（chromatic aberration）+ DoF + Bloom + 颗粒；加上**呼吸式相机漂移**、**事件驱动的镜头推/拉/抖/扭**。
- **所有原 Sprite 全部抛弃**——钉子、弹珠、敌人、Boss、遗物、符文、UI 边框统统改为**程序化几何体 + Shader 材质 + 文本/图标符号**。资产目录最终可瘦身到 < 5 MB。
- **遗物**：仅显示**名称 + 描述 + 稀有度色带 + 程序化纹章（shader 生成的徽记圆纹）**，零图片。
- **渲染管线重构边界**：在 `entities` 与现有 `.draw(ctx)` 之间插入一层 **`SceneProxy`**——`.draw(ctx)` 改为 `sync(scene)`，逻辑层完全不感知 3D，便于回滚 & 渐进迁移。

---

## 1. 设计哲学

### 1.1 三个不可妥协的原则

| 原则 | 含义 | 反例 |
| :--- | :--- | :--- |
| **玩法清晰优先** | 钉板与砖墙永远是画面的"主体清晰区"；任何镜头/景深/畸变都不得让玩家看不清钉子位置、弹珠路径、敌人血量。 | 把钉板旋转 45°放到舞台远处导致钉间距视觉模糊。 |
| **3D 服务于氛围，不服务于"立体感"** | 我们要的是**电影画框感**，不是"看着像 3D"。立体感来源于：景深 + 光雾 + 反射 + 微动镜头，而不是物体本身的厚度。 | 钉子做成 1cm 厚的圆柱，光打上去反光过强，干扰判读。 |
| **零 Sprite，全程序化** | 不引入任何具象化人物/怪物/遗物贴图。所有形象用**几何 + 发光 + 抽象造型**来描绘。 | 给敌人贴一张 PNG。 |

### 1.2 视觉关键词

> 暗黑炼金 · 流体金属 · 玻璃光纤 · 体积光雾 · 神圣几何 · 余晖辉光 · 全息符文

### 1.3 调色板（统一色板，所有 Shader 内可直接 import）

```
深色基底:     #0A0E1A (近黑深空蓝) → #0F172A (现有 bg) → #1E293B (slate-800)
冷光主调:     #38BDF8 (cyan-400) / #60A5FA (blue-400) / #A78BFA (violet-400)
暖光主调:     #F59E0B (amber-500) / #EF4444 (red-500) / #FB923C (orange-400)
属性专色:
  pyro       → #EF4444 / #FB7185
  cryo       → #60A5FA / #A5F3FC
  lightning  → #FACC15 / #FDE68A
  bounce     → #A3E635 / #BEF264
  pierce     → #F97316 / #FDBA74
  scatter    → #C084FC / #DDD6FE
  laser      → #34D399 / #6EE7B7
  wind       → #14B8A6 / #5EEAD4
稀有度光环:
  common     → 暖白 #E2E8F0
  rare       → 蓝紫 #818CF8
  epic       → 紫粉 #D946EF
  legendary  → 金红 #F59E0B
  cursed     → 血紫 #9F1239
```

---

## 2. 整体场景架构

整个游戏运行在一个 Three.js Scene 内，由 5 层组成（从远到近）：

```
[Z = -200] L0 远景层    : SkyDome + 噪声雾 + 远处剪影（炼金塔/管道）
[Z = -50 ] L1 中后景层  : 体积光柱、漂浮粒子、慢速旋转的环形装饰几何
[Z = 0   ] L2 玩法面板  : 钉板 / 砖墙 / 弹珠 / 子弹（场景核心）
[Z = +30 ] L3 前景HUD层 : 发射器底座 3D 模型、弹药槽、能量管
[Z = +80 ] L4 装饰前景  : 散焦粒子、镜头脏污、UI 玻璃面板
```

- 相机位置约 `(0, -10, 180)`，看向 `(0, 0, 0)`，FOV ≈ 28°（窄 FOV → 接近正交，玩法面板畸变小）。
- **玩法面板 L2 严格 2D 化**：所有 peg/brick/ball 都"贴"在 z=0 的平面上，z 方向只允许极小的浮动（±2 单位用于景深分离/碰撞挤压表演）。
- **前景层 L3/L4 可大胆 3D 化**：发射器、弹药管道可以斜放、转动、有明显厚度。
- **后景层 L0/L1 强景深虚化**：玩家看到的是"氛围"，不需要分辨细节。

```
   ┌───────────── 相机视角示意 ─────────────┐
   │                                        │
   │     L0 远景剪影 + 雾 (高斯模糊)        │
   │  ────────────────────────────────      │
   │     L1 体积光柱 / 漂浮粒子 (DoF外)    │
   │  ════════════════════════════════      │
   │     L2 钉板/砖墙 (清晰对焦核心区)      │
   │  ════════════════════════════════      │
   │     L3 发射器 3D + 弹药槽              │
   │     L4 玻璃HUD / 镜头粒子 (DoF外)     │
   └────────────────────────────────────────┘
```

---

## 3. 模块化视觉设计

### 3.1 背景环境（L0 + L1）

**当前**：`getUiBitmap(BG_MAIN_CANVAS_SRC)` 加载一张暗色 720×1280 位图全屏铺底。

**新设计**：
- **远天幕**：一个反向法线 SkyDome，使用 **Fragment Shader 程序化生成**——深空蓝 → 紫调径向渐变 + 低频 simplex noise 形成的"星云"。
- **远处剪影**：低多边形几何（炼金塔、管道、齿轮）排成 3 排做视差，每排不同移动速度，由相机轻微位移驱动。
- **体积光柱**：4–6 根固定位置的 cone（圆锥），开 `additive blending` + Fresnel + 顶点噪声扰动，慢速旋转。
- **环境粒子**：~150 颗 GPU 粒子，缓慢上升 + 摆动，色相基于当前局势（战斗压力高 → 偏红，研磨顺利 → 偏蓝）。

**实现要点**：
- 单 `BackgroundLayer` 类，封装所有远/中景对象。
- 暴露 `setMood(stressLevel: 0..1)` 接口，由游戏状态驱动色调倾斜。

---

### 3.2 钉板（研磨阶段）— L2 核心面板

**当前**：`Peg.draw(ctx, radius)` 绘制带阴影的圆 + 颜色编码 + 光照计算 + ghost peg 半透明圆。

**新设计**：
- **钉子主体**：使用 **InstancedMesh<SphereGeometry>**（半径 4–6，分段 12）。所有钉子一次性提交 GPU。
  - 材质：自定义 ShaderMaterial。基础色 = `#475569`（slate）；按类型叠加 emissive：
    - normal：弱蓝白 emission
    - pink（高反弹）：粉色 emission + 1.2 倍体积脉动
    - wind（风系锚点）：青绿 emission + 浮动小箭头（billboard 小符号）
    - flying_sword（剑系锚点）：橙红 emission + 周身十字刃花纹（环带 shader）
  - **Rim Light**：边缘高光 dot(N,V)^p；让钉子在暗背景下边缘呈"金属包边"。
  - **击中表演**：单帧 emission 飙至 4×，材质 `vertexDisplacement` 沿法线推 +30%（"被弹珠撞到鼓出来"的弹性形变），1 帧内回弹。
- **钉子位置**：完全等价于当前 2D 坐标（直接复用 `pegs[].pos.x, pegs[].pos.y` 映射到 `(x-W/2, -(y-H/2), 0)`）。
- **特殊槽位（SpecialSlot）**：当前是两钉子之间的发光虚线。新版用 **TubeGeometry 沿两钉子连线挤出**，shader 流光 + 颜色按 type 编码：
  - 连射 (multicast)：蓝色脉冲流光
  - 召回 (recall)：紫色反向流光
  - 分裂 (split)：橙色对开流光
  - 遗物槽 (relic)：金色缓慢呼吸
  - 技能槽 (skill)：青绿粒子沿管流动
  - 命运轮盘 (wheel)：彩虹色快速循环
- **Ghost Peg（裂变回响虚影）**：使用 `MeshBasicMaterial` + `transparent: true` + 顶点 alpha 渐变，呈半透明波纹圆环效果，配合粒子拖尾。
- **钉板平面参考**：不画"背板"——保持深空感；可选地加一层**网格地板贴附在 z = -2**，方格 0.15 alpha，用作空间参考但不打断视觉。
- **倾斜**：当前 `boardTilt` 仅做网格 offset。新版直接驱动**相机做 ±2° 的偏摆**而不是旋转面板（面板永远正面对玩家保证可读）。

**关键 Shader 草案（钉子）**：
```glsl
// 顶点
vDispl = sin(uTime * 6.0 + aOffset) * 0.02 * uHitImpulse;
vec3 pos = position + normal * vDispl;
// 片元
float rim = pow(1.0 - dot(N, V), 2.5);
vec3 col = mix(baseColor, rimColor, rim);
col += emissiveColor * (0.6 + 0.4 * sin(uTime*2.0 + aOffset)) * emissiveStrength;
gl_FragColor = vec4(col, 1.0);
```

---

### 3.3 弹珠（DropBall）— L2

**当前**：实心圆 + 简单光晕。

**新设计**：
- **主体**：低多边形八面体 (`OctahedronGeometry`) 或小球，半径 5–8。
- **材质**：根据 `marbleType` 切换：
  - `damage`：金属拉丝 + 红色芯
  - `pyro`：内部高 emission 红 + 表面火焰扭曲（noise displacement）+ 后面拖一条火焰尾迹（受运动方向影响的 ribbon）
  - `cryo`：内含冰晶（多面体内嵌）+ 半透明外壳 + 冷蓝雾尾
  - `lightning`：核心金黄 + 周身随机闪电分支（动态 line geometry）
  - `bounce`：表面有"弹性涟漪"shader，撞击瞬间整球 squash & stretch
  - `pierce`：尖端流线型形状（拉长椭球）+ 速度方向上的拖影
  - `scatter`：本体小 + 周身环绕三个小卫星（轨道）
  - `laser`：极亮纯色芯 + 透明玻璃壳，移动时拖一道激光残影
  - `rainbow`：HSV 随时间循环 emission
  - `matryoshka`：半透明同心壳，能看到内部更小的自己
  - `echo`：本体后面跟着 3 个延迟 5/10/15 帧的残影
  - `venom`：暗紫芯 + 滴落毒滴粒子
  - `resonance`：双层旋转壳，撞击时整体频率震动可视化
- **运动模糊**：弹珠速度向量驱动 motion-blur ribbon——velocity * delta 转成 trail mesh。

---

### 3.4 砖墙 / 敌人（战斗阶段）— L2

> 这是视觉重构最重要的部分。当前游戏使用 ~30+ 张 sprite 图（archetypes/composites/bosses/golems），全部要弃用。

**总思路**：把"敌人 sprite"转换为**程序化几何造型 + 词缀化 shader 与饰物**——一种"会动的怪物砖块"。

#### 3.4.1 敌人主体造型规则

按敌人类型映射到不同的**基础几何原型**（统一为低多边形、硬边、有金属质感）：

| 当前 archetype | 几何原型 | 形象描述 |
| :--- | :--- | :--- |
| bastion (3x1) | 长条棱柱（六边截面） | 横向"碉堡"——城墙段 |
| deflector (2x1) | 斜面盾形（楔形） | 一面斜立的护盾 |
| echo_spire (1x2) | 双层尖塔（金字塔堆叠） | 竖立的"音柱" |
| gravity_core (3x3) | 大球嵌入笼状框架 | 引力核心 |
| hive (2x3) | 蜂巢蜂窝多面体 | 六边形蜂巢 |
| maw (2x2) | 张口的双锥体 | 咆哮的口 |
| prism (1x3) | 三棱柱 | 高棱镜 |
| siege (3x2) | 重型矩形带炮塔小球 | 攻城器 |
| boss_* | 多部件组合 + 中央核心 | 见 3.4.4 |

**通用规则**：
- 所有敌人为 **InstancedMesh + 自定义着色器** 实现，每个实例携带 `affixBits`（位图 = 哪些词缀激活）与 `damage_recv_uv`（受击点 UV，用于热点闪烁）。
- 表面材质：暗灰金属 (#1F2937) 基色 + 边缘 Fresnel 蓝光 + 顶面微反射（fake env map）。
- **血量条**：浮在敌人正上方 8 个单位，使用 `Sprite` 或 `Mesh + Plane`，shader 控制填充比例 + 受伤瞬间白闪。
- **重要：保持"砖墙感"**——所有敌人必须挂在网格上，z 位置只能在 [-1, +1] 抖动。

#### 3.4.2 词缀（Affix）的可视化

词缀通过**敌人身体周围的装饰几何**呈现，而不是改变敌人本身造型，避免可读性混乱。

| 词缀 | 视觉呈现 |
| :--- | :--- |
| **护盾 (shield)** | 敌人前方悬浮一片六边形蜂巢盾，半透明发光，命中时短暂闪烁；护盾耗尽 → 蜂巢碎裂掉落粒子 |
| **极速 (haste)** | 敌人脚下 3 道朝下的青色光波，节奏快 |
| **再生 (regen)** | 敌人头顶悬浮 3 颗绿色螺旋上升的细胞 |
| **增殖 (multiply)** | 敌人内部嵌套半透明小型副本，"将要分裂"暗示 |
| **狂暴 (rage)** | 敌人外圈一圈红色冲突线条，hp 越低越亮 |
| **治愈 (heal)** | 持续柔光绿色 aura |
| **吞噬 (devour)** | 周身漩涡粒子向内吸 |
| **跳跃 (jump)** | 周身有 4 条向上箭头光纹 |

#### 3.4.3 敌人受击表演

- 受击瞬间：**全身 emission 全白 1 帧**，紧接 200ms 内 emission 退至 0；
- 同时：身体向被击中方向 `squash`（缩 8%）+ 反向回弹（spring 阻尼），1.5 个周期；
- 飞出粒子：尖锐金属碎片向击中反方向 cone 喷射；
- 配合**镜头微推**（详见 §5）。

#### 3.4.4 Boss 设计

Boss 改为**多部件 group**：中央核心 + 2–6 个浮动部件（盾片、炮塔、能量环）。
- 中央核心：根据 boss_type 切换造型（`boss_ignis` 火焰心、`boss_glacies` 冰晶柱、`boss_tesla` 等离子环、`boss_chimera` 多面体复合、`boss_ouroboros` 衔尾蛇环 etc.）。
- 部件围绕核心**做轨道运动**（不同半径/相位），受击时单独抖动。
- 入场动画：从屏幕上方"被吊下来"，伴随顶光锁定 + 屏幕震动 + 短暂景深极度浅化（聚焦特写 1.5s）。

---

### 3.5 子弹（Projectile）— L2

**当前**：圆 + 拖尾粒子。

**新设计**：
- 主体：发光胶囊（Capsule 几何），按 marbleType 上色。
- 拖尾：使用 `MeshLine` 或自实现 ribbon——速度向量延伸 0.2s 历史，alpha 衰减。
- 暴击/穿透：拖尾粗细 × 1.5，外层加发光环。
- 反弹瞬间：在反弹点产生一次径向 shockwave（圆形片元 expanding，受击中颜色染色）。
- 激光/飞剑/套娃：保留各自专用造型——激光为长亮线 + 残光，飞剑为旋转长刃 mesh，套娃为半透明嵌套球。

---

### 3.6 发射器与符文展示（L3）

**当前**：底部一张位图 + 旋转 orbital 小球。

**新设计**：
- **发射器底座**：低多边形几何模型——一个"炼金引擎"，由：
  - 圆形底盘（旋转大盘 + 暗能纹）
  - 中央炮管（向上指向，根据"瞄准角度"做微转）
  - 4–6 根能量管（侧面伸出，发光流体材质，与符文网格连动）
- **充能动画**：能量管内的流体加速、emissive 增强、底盘旋转加速。
- **符文展示**（环绕发射器的"轨道"）：
  - 取代当前 `render_combat_launcherOrbitals` 的 2D 圆球队列；
  - 改为 **3D 水晶**（Icosahedron + 折射 shader），按符文属性着色，轨道运动（不同半径、不同相位）；
  - 数量按子弹属性层数动态增减；
  - 弹珠发射瞬间：所有轨道水晶向炮管收拢 → 闪光 → 复位（约 300ms）。

---

### 3.7 粒子与特效（全场景）

**当前**：`effects/particles.js` 1866 行，各种 mode（spark/ember/mist/shard/smoke/venom/line/wind_slash）。

**新设计**：
- 全部迁移至 **GPU 粒子系统**（`THREE.Points` + 自定义 BufferGeometry + ShaderMaterial）。
- 单 mesh 内承载 2000+ 粒子，使用 instanced 属性传 `life/velocity/mode`。
- 模式枚举不变（spark/ember/mist…），改为 GPU shader 内的分支（uniform 选取色板）。
- **爆炸 / 冲击波 (Shockwave / FireWave / IceWave / HealWave)**：
  - 改为**单 quad + radial gradient shader**，按 `life` uniform 推进半径与 alpha；
  - 比当前 `arc + stroke` 高效十倍。
- **闪电 (LightningBolt)**：
  - 用 **noise displacement 折线**（一条 zigzag mesh，顶点位置基于 simplex noise 跳变）+ 后处理 bloom 强化；
  - 比当前手绘 zigzag 更具张力。
- **风暴法阵（butterfly circles）**：保留几何排布，但用**辉光线条 + 旋转粒子云**替代实心填色；
- **剑气、刀光**：使用 trail ribbon，半透明渐变 + bloom。

---

### 3.8 遗物（无 Sprite，纯描述化）

按用户明确要求："遗物就是直接描述，不用给 sprite"。

**新设计**：
- 遗物在选择阶段以 **3D 卡片** 形式出现（前景 L3 层，与玩法面板分离）：
  - 卡片本体：低多边形矩形板（厚度 1 单位，圆角），边框颜色 = 稀有度色。
  - 卡片正面渲染**文本**（使用 `troika-three-text` 或 `Text2D`）：
    - 顶部：稀有度色带 + 中文名（如 "倍化之术"）
    - 中央：**程序化生成的徽记**——一个 shader 圆形纹章，根据 `relic.id` 的字符串哈希生成对称图案（类似"identicon"概念，但用神圣几何风格）；
    - 下方：描述文本（自动换行）；
    - 底部：tags 与 maxStacks 信息。
- **零图片资源**，全部用 Canvas 文本 → texture，或者 troika 直接渲染 SDF 文本。
- 选中动画：卡片向相机推近，DoF 焦点切换到该卡片，背景模糊。
- 已拥有的遗物图鉴：HUD 内列表展示**纹章 + 名称**，点击展开描述（HTML 层即可）。

> **资产删除计划**：`assets/icons/relic/` 全部 (~30+ PNG 对) 可删除，不再加载。

---

### 3.9 符文（Rune）系统

**当前**：emoji icon（🔥❄️⚡…）+ 在符文网格中显示位图。

**新设计**：
- **符文外观**：六边形薄片几何 + shader（每种属性专属的"纹饰" shader——火焰用扭曲噪声、冰用裂纹纹理、雷用闪电分支等，**全部 GPU 程序化**）；
- **符文网格 UI**：保留 3×3 网格，但用 HTML 层（CSS 3D transform 给一点透视）+ 内嵌的小 WebGL 缩略图（每个符文 50×50 离屏渲染）。
- **符文之语激活**：达成形状时，整网格发出脉冲光波 + 中央升起一道光柱 + 全屏轻微震动。

---

### 3.10 HUD / UI

**当前**：HTML（Tailwind + 自定义 CSS）+ 位图 9-slice 边框。

**新设计**：
- HUD 整体保留 HTML（操作便捷、可访问性高），但风格升级为"全息玻璃"：
  - 背景：`backdrop-filter: blur(12px) saturate(1.4)` + 半透明深色；
  - 边框：1px 渐变光带（CSS gradient），稀有度色定义统一变量；
  - 文字：单色 + emissive 阴影（`text-shadow: 0 0 8px <color>`）；
  - **抛弃当前 9-slice 位图边框** (`top_bar_9s.png` 等 ~83MB UI assets 可删除)。
- 与 3D 场景的联动：
  - HUD 上的属性图标改为**小 WebGL 缩略图**（共享主 renderer 的离屏 buffer）；
  - 受击/获得遗物时，HUD 元素做"震动 + 闪光"反馈，与 3D 场景节奏同步。
- 移动端/PC 布局保留现有方案（PC 三栏 + 移动底部抽屉）。

---

## 4. 镜头（Camera）系统

> 这是营造"沉浸感与视觉张力"的核心。

### 4.1 相机基本配置

```js
camera = new PerspectiveCamera(28, aspect=9/16, near=10, far=600);
camera.position.set(0, -10, 180);   // 略低于面板中心，仰视感
camera.lookAt(0, 0, 0);
```

- 窄 FOV（28°）→ 透视变形极小，玩法面板近似正交可读。
- 略仰视 → 让发射器（L3）有"近大远小"的存在感。

### 4.2 状态机：CameraController

```
States:
  IDLE          → 呼吸式漂移 (±2px 平移, ±0.3° 偏转, 5s 周期)
  AIM           → 玩家拖动瞄准时，朝瞄准方向偏移 4°
  SHOT_RELEASE  → 弹珠/子弹发射瞬间，相机 dolly-in (推近 5%) 50ms 后回弹
  IMPACT        → 大击中（暴击/穿透/Boss命中）触发屏幕震动 + 短暂景深极浅
  HIT_PLAYER    → 玩家受击：相机后退 + 红色 vignette 闪一下
  BOSS_INTRO    → Boss 入场：1.5s 镜头特写 + 极浅景深 + 仰角拉到 -15°
  PHASE_TRANS   → 阶段切换：镜头滑动 + 模糊推拉
  GAME_OVER     → 镜头缓慢拉远 + FOV 渐变到 45°（"灵魂出窍"）
```

### 4.3 镜头扰动模型

- **基础呼吸 (Idle Drift)**：`pos += sin(t * 0.2) * 0.5px`（极弱）；
- **倾斜驱动（device gyro / 鼠标视差）**：`pos.x += mouseX * 5`；移动端读取 `deviceorientation`，弱阈值（避免晕动症）；
- **冲击 (Impact Shake)**：弹簧物理：`a = -k*x - c*v + impulse`；持续 200–500ms，强度由伤害值/事件级别决定；
- **FOV 脉冲**：大爆炸 / 临界血量时 FOV 短暂 +2°（"心跳缩张感"）。

### 4.4 动态聚焦（DoF Focus Tracking）

- 默认对焦平面 z = 0（玩法面板）；
- BOSS_INTRO：对焦平面切换到 boss z 位置；
- 选择阶段：对焦切到 L3 卡片 z = 30；
- 切换使用 cubic-bezier 0.25, 0.1, 0.25, 1，600ms。

---

## 5. 后处理（Post-Processing）管线

使用 `THREE.EffectComposer` 串联：

```
1. RenderPass           主场景渲染
2. UnrealBloomPass      threshold=0.7, strength=0.6, radius=0.4 (强调 emissive)
3. BokehPass / DepthOfFieldPass  focus=玩法面板, aperture=0.02, maxblur=0.012
4. LensDistortionPass   自定义 shader：barrel = 0.06, chromatic = 0.004
5. FilmGrainPass        自定义：noise = 0.04, scanlineIntensity = 0.0 (无扫描线)
6. VignettePass         offset=0.7, darkness=0.6
7. ToneMappingPass      ACES Filmic
8. SMAAPass / FXAAPass  抗锯齿（移动端用 FXAA 省性能）
```

### 5.1 桶形畸变 + 色散（核心 shader 草案）

```glsl
// LensDistortionPass.frag
uniform sampler2D tDiffuse;
uniform float uDistortion;   // 0.06
uniform float uChromatic;    // 0.004
uniform vec2  uResolution;
varying vec2  vUv;

vec2 barrelDistort(vec2 uv, float k) {
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    return uv + c * k * r2;
}

void main() {
    vec2 uvR = barrelDistort(vUv, uDistortion + uChromatic);
    vec2 uvG = barrelDistort(vUv, uDistortion);
    vec2 uvB = barrelDistort(vUv, uDistortion - uChromatic);

    float r = texture2D(tDiffuse, uvR).r;
    float g = texture2D(tDiffuse, uvG).g;
    float b = texture2D(tDiffuse, uvB).b;

    gl_FragColor = vec4(r, g, b, 1.0);
}
```

### 5.2 强度自适应

- 战斗压力低 → 畸变 0.04 / 颗粒 0.02；
- 战斗压力高 / 暴击连续 → 畸变 0.10 / 颗粒 0.06 / chromatic 0.008（短暂）；
- 玩家受击 → 1 帧 chromatic 飙至 0.02（"被打懵"），300ms 内回归。

---

## 6. 技术栈选型

| 维度 | 选型 | 理由 |
| :--- | :--- | :--- |
| 渲染引擎 | **Three.js r160+** | 生态最成熟、文档全、EffectComposer 现成、可 tree-shake |
| 加载方式 | ESM import via CDN（开发期） → 后续打包到 `vendor/three.module.js` 本地 | 当前项目没 build 系统，先 CDN |
| 后处理 | three/examples/jsm/postprocessing/* | 已含 Bloom/Bokeh/SMAA；LensDistortion 自写 ShaderPass |
| 几何 | `BufferGeometry` + `InstancedMesh` | 钉子/敌人/粒子全部 instanced |
| 文本 | `troika-three-text`（SDF 文本） | 描述类文本清晰，2D HUD 仍用 HTML |
| 物理 | **不替换**——继续用现有 `plinko_physics.js` | 物理只是 2D 坐标计算，不依赖渲染 |
| 资产瘦身 | 删除 sprites/icons 大目录（仅保留必要 sfx 与 ui 字体） | 减包 ~280MB |

**为什么不选 Babylon.js**：体积更大、API 偏 OOP 重型，team 学习成本与小项目收益不匹配。  
**为什么不选 PixiJS**：PixiJS 主打 2D + WebGL 加速，无原生 3D scene / DoF / 透视相机管线。  
**为什么不选 PlayCanvas / Godot Web**：需要重做编辑器流程，与现有原生 JS 架构不兼容。

---

## 7. 渲染管线重构方案（代码侧）

### 7.1 总体思路：插入"渲染代理"层，不动游戏逻辑

```
[现状]
game_phase.js  →  entity.draw(ctx)                ← Canvas 2D
                  particle.draw(ctx)
                  enemy.draw(ctx)

[新版]
game_phase.js  →  entity.sync(scene_proxy)         ← 仅同步状态
scene_proxy    →  three.js Scene 更新 Instanced Mesh / Particles
renderer3d     →  EffectComposer → WebGL Canvas
```

### 7.2 新增模块清单

```
src/render3d/
  ├── Renderer3D.js            主入口：renderer、scene、camera、composer 初始化与主循环
  ├── SceneProxy.js            桥接层：暴露 syncPeg/syncBall/syncEnemy/... 的 API
  ├── CameraController.js      镜头状态机 + 弹簧物理
  ├── PostFX.js                EffectComposer 装配
  ├── shaders/
  │     ├── lens_distortion.frag
  │     ├── peg.vert / peg.frag
  │     ├── enemy.vert / enemy.frag
  │     ├── particle_gpu.vert / .frag
  │     ├── volumetric_light.frag
  │     └── runic_glyph.frag    (遗物徽记 procedural 生成)
  ├── meshes/
  │     ├── PegInstancedMesh.js
  │     ├── EnemyInstancedMesh.js
  │     ├── BallMesh.js
  │     ├── ProjectileMesh.js
  │     ├── LauncherMesh.js
  │     └── SpecialSlotTube.js
  ├── particles/
  │     └── GPUParticleSystem.js
  ├── ui3d/
  │     ├── RelicCard.js        程序化卡片 + 文本
  │     └── HUDGlassMaterial.js (可选：HUD 玻璃材质，若用 WebGL 而非 CSS)
  └── BackgroundLayer.js       L0/L1 远景
```

### 7.3 与现有代码的对接点

| 文件 | 现状 | 改动 |
| :--- | :--- | :--- |
| `core.js` | 初始化 2D ctx，主循环 RAF | 增加 WebGL canvas 与 `Renderer3D` 初始化；保留 2D ctx 仅用于 fallback / debug overlay |
| `render_system.js` | 813 行，绘制背景/钉板/敌人/粒子 | **整体废弃**——内容迁移到 `SceneProxy` |
| `entities.js` | 每个类有 `.draw(ctx)` 与状态 | 增加 `.syncToProxy(proxy)`；`.draw(ctx)` 保留为空函数（兼容期）或删除 |
| `effects/particles.js` | CPU 粒子 | 改为 `GPUParticleSystem.spawn(mode, x, y, color, count)` 接口 |
| `render/sprite_renderer.js` | 加载/绘制 sprite | **整体废弃**——3D 化后不再需要 |
| `bitmap_icons.js` | 加载 ui 9-slice 位图 | **废弃**（HUD 改纯 CSS） |
| `game_phase.js` | 内联 30+ 个 `entity.draw(ctx)` 调用 | 改成单次 `sceneProxy.syncAll(this)`，由 proxy 内部 diff & 更新 |
| `index.html` | 1 个 canvas | 增加第二个 `<canvas id="gl-canvas">` 在底层；原 2D canvas 提升为 debug overlay 可关闭 |
| `package.json` | 仅 serve | 加 dev dep `three`（CDN 期间可不加） |

### 7.4 关键 API 设计

```ts
// SceneProxy API（伪 TS 接口）
interface SceneProxy {
  // 钉板
  syncPegs(pegs: Peg[]): void;             // 全量 diff 更新 InstancedMesh
  pulsePeg(pegIndex: number, intensity: number): void;  // 触发击中表演
  
  // 弹珠
  syncBalls(balls: DropBall[]): void;
  
  // 敌人
  syncEnemies(enemies: Enemy[]): void;
  hitEnemy(enemyId: string, dir: Vec2, amount: number): void;
  
  // 子弹
  syncProjectiles(projectiles: Projectile[]): void;
  
  // 特效
  spawnParticles(mode: string, x: number, y: number, color: string, count: number): void;
  spawnShockwave(x: number, y: number, color: string, radius: number): void;
  spawnLightning(x1, y1, x2, y2, color): void;
  
  // 槽位
  syncSpecialSlots(slots: SpecialSlot[]): void;
  
  // 相机事件
  cameraEvent(type: 'IMPACT'|'AIM'|'BOSS_INTRO'|'PHASE_TRANS'|..., payload?: any): void;
  
  // 单帧推进
  render(deltaTime: number): void;
}
```

### 7.5 坐标系映射

```
2D Canvas (现状):  origin = top-left, x→right, y→down, units = px (480 × 853)
3D World (新版):   origin = center,    x→right, y→up,   units = "game unit" (映射 1:1)

worldX = canvasX - W/2
worldY = -(canvasY - H/2)
worldZ = 0  // 玩法面板
```

封装为 `src/render3d/coords.js`，提供 `toWorld(x,y) / toCanvas(x,y) / projectToScreen(worldPos)` 三个函数。

---

## 8. 性能策略

| 项 | 策略 |
| :--- | :--- |
| 钉子数量 | 单次 InstancedMesh，最多 ~500 个，零 draw call 增长 |
| 敌人数量 | 同上，按 archetype 分 4–6 个 InstancedMesh |
| 粒子上限 | GPU 粒子池 4096，超过即覆盖最老 |
| 后处理分辨率 | DoF + Bloom 渲染在 1/2 分辨率 render target，最终合成回主目标 |
| 自适应质量 | 启动时 benchmark 一帧，<30fps 自动降级：关闭 DoF、降低粒子池、关闭 chromatic |
| 移动端 | 默认 FXAA、关闭 Bokeh（用便宜的高斯模糊近似 DoF） |
| WebGL2 | 优先；不可用时用 WebGL1 + ANGLE_instanced_arrays |
| 文本渲染 | troika SDF 缓存复用，相同文本不重复创建 |
| 纹理 | 无 sprite 后，纹理仅剩 LUT、noise、可选环境贴图——总量 < 1 MB |
| 几何 | 共享 BufferGeometry，所有钉子/敌人 = 共享几何 + 实例参数 |
| 主循环 | 维持现有 RAF 循环；新增 deltaTime 参数传给 `composer.render(dt)` |

**目标**：
- 桌面：1080p @ 60fps；
- 移动（中端，2022 款）：1280×720（实际 480×853 上采样）@ 60fps；
- 低端移动：30fps 兜底，自动降级方案触发。

---

## 9. 迁移路线图（Milestones）

> 不一次性 big-bang。分 6 个里程碑渐进迁移，每个里程碑都可独立测试与回滚。

### M1：3D 容器与背景（1–2 天）
- 引入 Three.js，建立 WebGL canvas（覆盖在原 2D canvas 之下）；
- 实现 `Renderer3D` + 空场景 + 远景层 + 相机；
- 启动后能看到带 fog/远景的"舞台"，原 2D 内容仍在上面（叠加调试）；
- **可玩性不受影响**。

### M2：钉板 3D 化（2–3 天）
- 实现 `PegInstancedMesh` 与 peg shader；
- `SceneProxy.syncPegs` 接入；
- 把 `Peg.draw(ctx)` 改为空函数（保留 2D 调试开关）；
- 引入弹珠 3D mesh + 拖尾；
- 钉板研磨阶段视觉切换完成；
- **手感测试**：弹珠是否能清晰看到与钉子碰撞。

### M3：战斗阶段敌人 3D 化（3–5 天）
- 实现 8 种 archetype 的程序化几何（统一 `EnemyMeshFactory`）；
- 程序化词缀装饰（盾、再生、增殖、狂暴等）；
- Boss 多部件组合 + 入场动画；
- 子弹 / 特效 / Shockwave 3D 化；
- **删除** `assets/sprites/` 与 `render/sprite_renderer.js`。

### M4：后处理 + 镜头系统（2–3 天）
- EffectComposer 接入 Bloom / Bokeh / Lens / Grain / Vignette；
- `CameraController` 状态机；
- 事件钩子：在 `combat_system.js` 内击中/暴击/受击点接入 `sceneProxy.cameraEvent`；
- 自适应质量 benchmark。

### M5：遗物 / 符文 / HUD 视觉重做（2–3 天）
- `RelicCard` 3D 卡片 + 程序化徽记；
- 符文六边形薄片 + 元素 shader；
- HUD 全息玻璃风（CSS）；
- **删除** `assets/icons/`、`assets/ui/`、`bitmap_icons.js`、`bitmap_ui.css`。

### M6：粒子 GPU 化 + 性能压测 + 移动端打磨（2–3 天）
- 全部粒子迁到 GPU 池；
- 移动端低质量分支；
- 真机测试与 fps profile；
- 设置面板增加"画质 高/中/低"开关。

**总工期估算**：单人 ~12–19 个工作日，可并行进一步压缩。

---

## 10. 风险评估与权衡

| 风险 | 严重度 | 应对 |
| :--- | :--- | :--- |
| WebGL 在低端手机崩溃 / 渲染异常 | 高 | 强制降级到 WebGL1 + 简化 shader；保留 2D fallback canvas（隐藏式开关） |
| 视觉张力 vs 玩法可读性失衡 | 高 | 玩法面板坚守 §1.1 原则；每个 milestone 做 5 分钟"看清测试" |
| 包体增加（three.js ~600KB gzipped）| 中 | 删除 sprite 资产后净减 ~280MB，包体反而大幅缩小 |
| 程序化敌人造型表达力不足，玩家无法识别词缀 | 中 | 词缀装饰使用"约定俗成的图形语言"（盾=六边形、再生=向上箭头）+ 第一次出现时弹 tip |
| 文本渲染（troika）首屏开销 | 低 | 预热常用文本缓存；HUD 仍用 HTML |
| 移动端 deviceorientation 晕动 | 中 | 默认关闭 gyro，提供设置项让玩家开启 |
| 现有玩法逻辑代码与渲染耦合处难拆 | 中 | 兼容期保留 `.draw(ctx)` 为空函数；分模块迁移，每次只迁一类 entity |
| 美术风格主观偏好 | 高 | 关键 milestone 出 3 张参考图给团队 review，色板/材质先确认 |

---

## 11. 验收标准（Done = ?）

- [ ] 启动游戏，进入研磨阶段，能清晰看到所有钉子与弹珠运动；
- [ ] 战斗阶段能清晰区分敌人类型与词缀（盲测：3 个新玩家能说出"这是带护盾的"）；
- [ ] 大暴击 / Boss 入场 / 受击 4 类事件触发的镜头反馈感觉"爽"；
- [ ] 桌面端 60fps 稳定；中端手机 60fps，低端手机 ≥30fps；
- [ ] `assets/sprites/` `assets/icons/` `assets/ui/` 全部删除，仓库瘦身 ≥ 250MB；
- [ ] 遗物显示完全无图片，描述清晰；
- [ ] 关闭 3D 模式（debug flag）后游戏仍能运行（2D fallback 保底）；
- [ ] 移动端无晕动症投诉（默认 gyro 关闭）。

---

## 12. 下一步

完成本方案 review 后，建议从 **M1** 开始动工：
1. 引入 Three.js，把空 3D 容器铺到游戏底层；
2. 不动任何玩法逻辑，仅在场景里放一个旋转的占位 cube 验证管线；
3. 把 `boardTilt` 接到相机的微抖动，先体验"动态镜头"的感觉；
4. 通过后再开 M2。

**任何模块如果在迁移中发现读不清，回退该模块到 2D 兼容层并标记 issue。**
玩法清晰永远是第一优先级。
