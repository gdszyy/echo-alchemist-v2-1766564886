# Echo Alchemist V2 - UI 与敌人位图化设计规格文档

本文档基于对 `echo-alchemist-v2` 现有代码库的深入分析，为后续的 UI 自动生成切图与敌人 Sprite 序列化提供精确的设计规格与实施指南。

## 1. 整体视觉风格定位

当前游戏采用了深色背景、高对比度发光（Glow/Neon）以及带有暗黑奇幻（Dark Fantasy）与炼金术（Alchemy）元素的视觉语言。代码中大量使用了 `slate-900`、`purple-500`、`emerald-400` 等 Tailwind 色彩，并配合 `Cinzel` 衬线字体与 `backdrop-blur` 毛玻璃效果。

**位图化风格建议：**
为了与现有的高对比度发光特效（如激光、爆炸、护盾网格）完美融合，建议采用 **「暗黑赛博炼金」** 或 **「高精度像素风（Hi-Res Pixel Art）」**。
- **UI 材质**：深色金属、黑曜石、暗紫/暗金镶边，带有微弱的自发光纹理。
- **敌人材质**：核心发光体外包覆着岩石、金属或晶体装甲，受击时装甲产生裂纹并透出内部光芒。

---

## 2. UI 位图化切图清单

当前 UI 主要由 HTML/CSS DOM 构成。为了在保留 DOM 灵活性的同时提升视觉表现，建议采用 **「九宫格背景图（9-Slice） + 装饰性 Sprite」** 的混合方案。

### 2.1 核心面板与背景（建议 9-Slice 切图）

| 组件名称 | 对应 DOM 元素 | 尺寸建议 | 视觉描述 |
|---------|-------------|---------|---------|
| **顶部状态栏** | `#unified-top-bar` | 高度 52px，横向拉伸 | 暗色半透明金属底板，底部带有微弱的科技感刻线。 |
| **底部弹药栏** | `.bottom-panel` | 高度 80px，横向拉伸 | 带有凹槽设计的炼金操作台边缘，两侧有金属铆钉。 |
| **通用弹窗面板** | `#phase-rune-launcher`, `#phase-shop` | 最小 300x400 | 黑曜石质感底板，四周有暗金色或紫色的繁复炼金阵纹理边框。 |
| **卡片底板** | `.rune-card`, `.relic-card` | 120x160 | 带有不同稀有度（铁、铜、银、金、炫彩）镶边的金属卡牌底座。 |

### 2.2 独立装饰性图标（建议固定尺寸 Sprite）

| 组件名称 | 对应 DOM 元素 | 尺寸建议 | 视觉描述 |
|---------|-------------|---------|---------|
| **SP 宝石（空/满）** | `.sp-gem` | 24x24 | 空状态为暗淡的晶体凹槽；满状态为散发翠绿光芒的菱形宝石。 |
| **回合数胶囊** | `.round-pill` | 64x24 | 带有金属边框的椭圆指示器，内部数字区域发光。 |
| **弹药图标** | `.ammo-icon` | 32x32 | 各种属性（火、冰、雷、穿透等）的炼金法球，带有对应的元素光晕。 |
| **功能按钮** | `#settings-btn`, `#speed-btn` | 40x40 | 带有机械齿轮或炼金符号的圆形金属按钮，包含按下（Active）状态。 |

---

## 3. 敌人 Sprite 序列设计方案

当前敌人完全由 Canvas 2D 矢量绘制（`ctx.fillRect`, `ctx.arc` 等），通过复杂的数学公式计算呼吸、浮动、受击形变和状态特效。转换为 Sprite 序列后，需要将这些数学动画烘焙为帧动画。

### 3.1 敌人基础规格

游戏中的敌人基于网格系统，基础尺寸由 `enemyWidth` 和 `enemyHeight` 决定（通常为屏幕宽度的 1/6）。
- **基础尺寸**：建议基准切图尺寸为 **128x128 像素**（可根据实际屏幕缩放）。
- **锚点（Anchor）**：中心点 `(0.5, 0.5)`，因为现有代码中的坐标变换（`ctx.translate`）都是基于中心点进行的。

### 3.2 敌人类型与变体

根据 `enemy.js` 和 `config.js`，敌人分为三个主要层级，需要不同的 Sprite 复杂度：

| 敌人层级 | 视觉特征 | 动画帧需求 |
|---------|---------|-----------|
| **普通魔像 (Normal)** | 基础的几何体（方块/多边形），颜色偏灰暗（`#475569`）。 | 待机 (Idle): 4-6帧<br>移动 (Move): 4帧<br>受击 (Hit): 2帧 |
| **精英魔像 (Elite)** | 带有紫色基调（`#581c87`），外围有重影和晶化变异装饰。 | 待机 (Idle): 6-8帧<br>移动 (Move): 6帧<br>受击 (Hit): 3帧<br>施法 (Cast): 4帧 |
| **首领 (Boss)** | 红色基调（`#7f1d1d`），体积更大，带有专属的轨道卫星或装甲片。 | 待机 (Idle): 8-12帧<br>移动 (Move): 8帧<br>受击 (Hit): 4帧<br>特殊技能 (Skill): 8-10帧 |

### 3.3 Boss 专属形象清单

游戏内定义了 8 种独特的 Boss，需要为每种 Boss 设计专属的 Sprite 形象：

1. **伊格尼斯 (Ignis)**：熔炉守卫。特征：火焰、护盾、重型装甲。
2. **格拉西斯 (Glacies)**：霜晶缝合怪。特征：冰晶、跳跃、再生组织。
3. **米克罗 (Mikro)**：裂变母体。特征：雷电、多重分身、治疗光环。
4. **噬神者 (Devourer)**：贪婪之渊。特征：深渊巨口、吞噬、暗物质。
5. **维里迪斯 (Viridis)**：翠绿共生体（大 Boss）。特征：剧毒、植物藤蔓、强力再生。
6. **特斯拉 (Tesla)**：雷霆幻影（大 Boss）。特征：极速、雷电残影、机械核心。
7. **奇美拉 (Chimera)**：混沌融合体（大 Boss）。特征：多头/多核心、狂暴火焰、混沌能量。
8. **奥罗波罗斯 (Ouroboros)**：永恒回声（大 Boss）。特征：衔尾蛇形态、动态弱点、全属性轮转。

### 3.4 状态与特效叠加层 (Overlay)

为了保持灵活性，**不建议**将所有状态（如冰冻、燃烧）直接画死在基础 Sprite 中。建议采用 **「基础 Sprite + 状态特效层」** 的渲染方式：

- **血量显示**：保留现有的 Canvas 绘制逻辑（液体血条 + 绿色回血条 + 白色延迟条），将其作为 Overlay 盖在 Sprite 上方。
- **战损裂纹**：当血量低于 30% 时，在 Sprite 上方叠加一层半透明的「裂纹」PNG，或者使用 Shader/混合模式处理。
- **温度状态**：
  - **过热 (Temp > 60)**：叠加橙红色发光层（`globalCompositeOperation = 'lighter'`）。
  - **过冷 (Temp < -30)**：叠加冰霜雾气层（`globalCompositeOperation = 'screen'`）。
- **词缀特效**：如护盾的六边形网格、再生的绿色波纹，建议保留现有的 Canvas 矢量绘制，或者提供单独的特效 Sprite 序列进行叠加。

---

## 3.5 V2 基底敌人 Sprite 规格（尺寸 × 专属词条）

> **来源**：[`.cursor/rules/enemy_index.md`](.cursor/rules/enemy_index.md) §0 + 敌人视觉设计 V2 文档。
>
> **核心约束**：基底敌人占多格网格，**Sprite 必须基于 cols×rows 等比扩展**（每格 128×128），不能等比放大单格 sprite。所有基底以"先看尺寸，再看轮廓，最后看词条特效"的视觉顺序绘制——大体型敌人不应依赖外部光环表达威胁。

### 3.5.1 基底 Sprite 尺寸表

> **基准格**：1×1 = 128×128 像素；多格基底直接乘以 cols/rows。**所有基底锚点中心 (0.5, 0.5)**，与碰撞中心一致，便于位移与受击形变。

| 基底 ID | 词条 | 占格 (cols×rows) | Sprite 尺寸 | 文件命名 | 优先级 |
|---|---|---|---|---|---|
| `bastion`     | `heavyArmor`     | 3×1 | 384×128 | `enemy_bastion_<frame>.png`     | P0（已存在） |
| `deflector`   | `deflectionWard` | 2×1 | 256×128 | `enemy_deflector_<frame>.png`   | P1 |
| `echoSpire`   | `echoRelay`      | 1×2 | 128×256 | `enemy_echo_spire_<frame>.png`  | P1 |
| `maw`         | `devour`         | 2×2 | 256×256 | `enemy_maw_<frame>.png`         | P0 |
| `prism`       | `prism`          | 1×3 | 128×384 | `enemy_prism_<frame>.png`       | P2 |
| `hive`        | `hive`           | 2×3 | 256×384 | `enemy_hive_<frame>.png`        | P2 |
| `siege`       | `siege`          | 3×2 | 384×256 | `enemy_siege_<frame>.png`       | P2 |
| `gravityWell` | `gravityWell`    | 3×3 | 384×384 | `enemy_gravity_well_<frame>.png`| P3（稀有，可暂用矢量） |

### 3.5.2 各基底视觉关键词与动画帧需求

> 帧数延续 §3.2 elite 标准（idle 6-8 / move 6 / hit 3 / cast 4），但部分基底有专属帧组。

#### 3.5.2.1 `bastion`（3×1 装甲横梁）— 既有

| 项目 | 规范 |
|---|---|
| 视觉关键词 | 三段铆接装甲、横向厚甲核心、暗铁磨损边缘、低频金属高光 |
| 材质语言 | 暗铁 (`#475569`) + 锈蚀边缘 (`#92400e`)，中央能量核心暗紫 (`#581c87`) |
| 帧组 | idle 6 / move 4（迟缓）/ hit 3 |
| 备注 | 移动间隔 2 回合，移动帧只播放一次后 freeze 在末帧；不要做"正在跨步"的循环动画 |

#### 3.5.2.2 `deflector`（2×1 棱盾兽）— 新增

| 项目 | 规范 |
|---|---|
| 视觉关键词 | 低矮盾壳、左右倾斜棱面、青蓝薄膜、副屏障条、碎裂晶片 |
| 材质语言 | 主体哑光金属 (`#1e293b`) + 棱面亚光晶体 (`#0e7490`)；屏障层独立绘制 |
| 帧组 | idle 6 / move 4 / hit 3 / **barrier_break 4**（屏障击碎一次性帧组） |
| 关键 Overlay | `enemy_deflector_barrier_overlay.png`（256×128，独立透明 PNG，覆盖在 Sprite 上层），按 `wardBarrier / wardBarrierMax` 的比例调节 alpha 0.3 → 0.95；屏障击破瞬间播放 `barrier_break` 4 帧 |
| 副屏障条 | Canvas 绘制：`(pos.x - width/2, pos.y - height/2 - 6)` 起 6px 高的青蓝条，宽度 = `width × wardBarrier/wardBarrierMax`，颜色 `#67e8f9` |

#### 3.5.2.3 `echoSpire`（1×2 共振尖塔）— 新增

| 项目 | 规范 |
|---|---|
| 视觉关键词 | 空心尖塔、裂纹晶核、双重环形波、细长能量柱、脆弱玻璃质感 |
| 材质语言 | 主体半透明 (`#f0abfc` 内、`#7c3aed` 外)，顶部晶核高频闪烁；可见**网状裂纹**强调"脆弱中继"语义 |
| 帧组 | idle 8（顶部晶核呼吸）/ hit 3 / **resonate 6**（触发回响时双重环形波） |
| 关键 Overlay | `enemy_echo_relay_ring.png`（160×160，4 帧扩散环），仅在 `_echoedThisTurn` 标记新增时由触发逻辑生成，最多 2 圈错峰播放 |

#### 3.5.2.4 `maw`（2×2 深渊胃囊）— 新增 / 升级

| 项目 | 规范 |
|---|---|
| 视觉关键词 | 缺口圆角矩形、内凹嘴部、底部锯齿阴影、暗红吞噬旋涡 |
| 材质语言 | 主体黑红有机质 (`#7f1d1d`)、嘴部内壁血色光感 (`#dc2626`)、底部锯齿暗影 (`#0c0a09`) |
| 帧组 | idle 8（嘴部缓慢张合）/ move 6 / hit 3 / **devour 8**（吞噬动作专属） |
| 与 `shield` 叠加 | 当 `devour + shield` 时，护盾必须表现为**包裹胃囊外层的半透明膜**（不是六边形网格），用 `enemy_maw_membrane_overlay.png` (256×256) 覆盖；与单格敌人的 shield 网格视觉明显区分 |

#### 3.5.2.5 `prism`（1×3 折光棱柱）— 新增

| 项目 | 规范 |
|---|---|
| 视觉关键词 | 长棱镜、透明切面、白色折射线、青蓝边缘光、纵向折射条纹 |
| 材质语言 | 半透明白色基底，左右两侧切面带 7 色衍射；中心一道纵向白色折射线 |
| 帧组 | idle 6（折射线缓慢偏移）/ hit 3 / **refract 4**（命中激光时七色粒子爆发） |
| 关键 Overlay | `enemy_prism_refract_burst.png` (128×128, 4 帧)，于 `combat_system.js` 的 `hitType === 'prism'` 分支触发 |

#### 3.5.2.6 `hive`（2×3 孵化巢）— 新增

| 项目 | 规范 |
|---|---|
| 视觉关键词 | 卵囊、半透明膜、纵向肉质隔膜、底部黏液阴影、内部幼体轮廓 |
| 材质语言 | 主体黄绿膜 (`#a3e635`)、内部多个椭圆卵 (`#84cc16`)、底部黏液 (`#365314`) |
| 帧组 | idle 8（卵囊缓慢蠕动）/ hit 3 / **hatch 6**（幼体破壳一次性） |
| 幼体 Sprite | 复用 `enemy_normal_<frame>.png`（128×128），但 `_isHiveLarva` 标记的幼体需要叠加 `larva_outline_tint.png`（淡黄绿描边）以区分母体来源 |

#### 3.5.2.7 `siege`（3×2 攻城履带）— 新增

| 项目 | 规范 |
|---|---|
| 战斗机制 | **免疫冰冻**（不会进入 `isFrozenCurrentTurn`）；**移动时推开前方敌人**：被横向重叠的非 Boss 敌人阻挡时，把这些敌人一起向下推 1 行（支持级联：A 推 B，B 再推 C），自身不会被"BLOCKED"卡住 |
| 视觉关键词 | 双排履带、前置撞角、黄色警戒线、推动时的尘暴与火星、撞角与被推敌人之间的金属碰撞痕 |
| 材质语言 | 主体钢铁 (`#334155`) + 履带橡胶黑 (`#0c0a09`)、警戒条纹黄黑 (`#facc15`/`#000`)、撞角金属高光（不再画"低频脉冲"，因为推进改为持续动作） |
| 帧组 | idle 6 / **move 6**（推进时撞角抖动）/ hit 3 / **frost_immune_flash 2**（被冰属性命中时的灰蓝盾光，0.2s 一次性）/ **push_impact 4**（推动前方敌人时撞角向前的碰撞帧） |
| 关键 Overlay | `enemy_siege_dust.png`（128×64，3 帧），推进时在履带底部连续喷溅；`enemy_siege_warning_strip.png`（384×16）当 `_siegePushBlockers` 检测到将会推动 ≥1 个敌人时**在 telegraphing 阶段**闪烁警告（替代原"低频重压前 1 回合"逻辑）；新增 `enemy_siege_push_chain.png`（128×64）画在被推敌人与攻城履带之间，强调"推动力传递"的方向感 |
| 不再使用 | ~~`siegePushInterval` / `siegePushRows`~~（已从 config 中移除）；攻城履带不再有"周期重压"独立帧组 |

#### 3.5.2.8 `gravityWell`（3×3 引力炉心）— 新增稀有

| 项目 | 规范 |
|---|---|
| 视觉关键词 | 黑色核心、三层环形炉壁、向内塌缩网格线、紫黑空间扭曲 |
| 材质语言 | 中心黑核 (`#000`)，三层炉环 (`#7c3aed` → `#a855f7` → `#c084fc`)，背景紫黑径向渐变 |
| 帧组 | idle 12（环形持续旋转）/ hit 4 / **gravity_pulse 8**（脉冲扩散） |
| 关键 Overlay | `enemy_gravity_pull_field.png`（440×440，6 帧扩散场），按 `gravityWellPullRadius / 220` 缩放 alpha；建议 `globalCompositeOperation = 'screen'`；该 sprite 是 V2 体系内唯一允许在 sprite 之外画大场域光晕的特例 |

### 3.5.3 V2 渲染层叠规则

> 严格按照"基底优先、词条后置"的层叠顺序，避免大型敌人被通用词条特效掩盖。详见敌人视觉设计 V2 文档 §7。

| 顺序 | 内容 | 备注 |
|---|---|---|
| 1 | 占格阴影与碰撞轮廓 | `spawn_applyArchetypeShape` 注入的 polygon/arc/aabb |
| 2 | 基底 Sprite | §3.5.2 各基底的 idle/move/hit 等基础帧 |
| 3 | 血量、延迟、温度反馈 | 复用现有 Canvas 绘制 |
| 4 | 专属词条结构（必绘） | 屏障副条、回响双环、吞噬腔、棱镜折射线、卵囊、攻城警戒、引力网格 |
| 5 | 通用词条特效 | 护盾网格 / 再生藤蔓 / 极速残影 / 治疗星芒；**多格基底要按 cols×rows 缩放**，不能等比放大单格特效 |
| 6 | Elite 边框与强调 | 紫色描边 + spark 粒子 |

---

## 3.6 V2 战斗内即时反馈 Overlay 清单

> 这些 Overlay 不属于敌人 Sprite 本身，而是 V2 词条触发时的瞬时视觉反馈。所有素材建议放至 `assets/ui/sprites/`，与遗物 v2 即时反馈（`docs/ui_asset_requirements.md` §7.2）共享命名风格。

| 资产路径 | 用途 | 建议尺寸 | 接入位置 |
|---|---|---|---|
| `assets/ui/sprites/v2/ward_barrier_idle.png` | `deflectionWard` 屏障静态薄膜 | 256×128 | `Enemy.draw()` 受击之后绘制层；alpha = `wardBarrier / wardBarrierMax × 0.85 + 0.1` |
| `assets/ui/sprites/v2/ward_barrier_break_*.png` | 屏障击碎 4 帧 | 256×128 | `takeDamage` deflectionWard 分支 `wardBarrier <= 0` 时触发 |
| `assets/ui/sprites/v2/ward_barrier_label.png` | 屏障数字背板（🔷-N） | 64×24 | `spawn_createFloatingText` 文字"🔷-N"出现时作为浮字底板 |
| `assets/ui/sprites/v2/echo_relay_ring_*.png` | 共振尖塔双重环形波 4 帧 | 160×160 | `Enemy._echoRelayRetrigger` 中 `triggered > 0` 时由 `spawn_createShockwave` 替代为图片 |
| `assets/ui/sprites/v2/echo_relay_link.png` | 尖塔→被触发敌人之间的脉冲连线 | 8×4，水平可平铺 | 对每个 echo 命中目标绘制 1 段；建议 `screen` 合成 |
| `assets/ui/sprites/v2/prism_refract_burst_*.png` | 折光棱柱七色折射爆发 4 帧 | 128×128 | `combat_system.js` `hitType === 'prism'` 分支 |
| `assets/ui/sprites/v2/hive_larva_hatch_*.png` | 孵化破壳光环 6 帧 | 96×96 | `Enemy._hiveSpawnLarva` 末尾 |
| `assets/ui/sprites/v2/siege_warning_strip.png` | 攻城重压前的黄黑警戒条 | 384×16，可平铺 | `_siegeCooldown <= 1` 时持续显示 |
| `assets/ui/sprites/v2/siege_push_dust_*.png` | 攻城推进尘暴 3 帧 | 384×64 | `siege_push` 帧组触发瞬间 |
| `assets/ui/sprites/v2/gravity_field_*.png` | 引力炉心扭曲场 6 帧 | 440×440 | 持续渲染于 sprite 下层；按 `gravityWellPullRadius/220` 缩放 |
| `assets/ui/sprites/v2/gravity_bullet_pulled.png` | 子弹被引力捕获时的拖尾 | 16×16，4 帧 | `projectile.js` 引力分支检测到 `dist < pullR` 时按帧 spawn |
| `assets/ui/sprites/v2/archetype_spawn_shockwave_<color>.png` | 各基底入场冲击波（色按 `chosen.color`） | 256×256 | `spawn_trySpawnArchetypes` 末尾的 `spawn_createShockwave` 替代 |

---

## 4. 实施路径建议

1. **UI 改造**：先从静态 UI（如卡片底板、顶部状态栏）开始，使用 CSS `border-image` 或 `background-image` 替换现有的纯色背景。
2. **敌人框架**：在 `enemy.js` 中引入 `SpriteRenderer` 类，接管 `draw()` 函数中的基础形体绘制部分（Layer 1），但保留血条（Layer 2）和特效（Layer 3/4）的绘制逻辑。
3. **资源生产**：根据上述清单，使用 AI 图像生成工具（或美术手绘）批量生成 128x128 的基础魔像 Sprite Sheet，并进行测试。
4. **Boss 定制**：最后为 8 个 Boss 逐一替换专属的高精度 Sprite 序列。
5. **V2 基底敌人**：按 §3.5.1 的优先级顺序生产 P0 → P1 → P2 → P3，**每个基底的 Sprite 必须以 cols×128, rows×128 出图**，配套的 §3.6 Overlay 与基底同步交付，不要分离上线。
