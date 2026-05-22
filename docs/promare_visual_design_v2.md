# Promare 视觉设计 v2 — 关键元素 × 状态 × 场景

> 这份文档替代 Tier 1（已 ship 在 PR #134）和零散 token 表，作为整套 Promare 视觉模式的**单一真理源**。
>
> 上一版的错误是「先做了 11 种形状，再去逐元素套配色」。本版反过来：**先确立"任何元素都要满足的 10 项原则"，再定义 5 个核心元素的体积构造，最后才落到状态 / 场景的具体呈现**。

---

## Part 1 · 设计原则（10 项 — 任何特效都要全部满足）

> Tier 1 已注入 F1-F7 到粒子引擎；这里把它扩成 10 项「视觉宪法」覆盖到非粒子的对象（弹珠 / 敌人 / UI）。**任一元素违反任一项就出戏**。

| # | 原则 | 落地准则 |
|---|---|---|
| **P1** | **几何阵营语义** | △ = 玩家 / Burnish / 火 / 突破；□ = 敌人 / 体制 / 秩序；○ = 收束 / 和解（只在剧情高潮用） |
| **P2** | **体积来自层叠多边形** | 不用 mesh / radial gradient 模拟体感；用 2-4 个错位多边形堆叠出"近大远小"假体积 |
| **P3** | **碎片 = 主体的几何分解** | 任何破碎都是把主形分解成更小的同形（玩家三角 → 小三角；敌人方块 → 三角，叙事关键帧） |
| **P4** | **抽帧贯穿所有运动** | 12fps step 不只是粒子：旋转 / 缩放 / 颜色切换都要 5 帧 snap，不 ease/bezier。例外：UI 输入反馈需即时 |
| **P5** | **平涂 + 暗描边 + 锐边** | source-over、不 lighter；描边用主色 × 0.4 的暗调版本；线宽 1-2px |
| **P6** | **Power-law 尺寸层级** | 1 huge / 3-5 mid / 30-80 tiny，每次戏剧时刻必有"巨型剪影"作构图骨架 |
| **P7** | **直线 + snap 旋转** | 物理碰撞除外；其他都是直线漂移 + 每 5 帧旋 30°/60°/90° |
| **P8** | **颜色家族 = 身份** | 元素的所有 touchpoint（弹药/burst/敌人词条/UI tag）用同色；色家族外露 = 身份外露 |
| **P9** | **深紫底是负空间** | `#1B0B2E` 不是"黑"是"色"；阴影也是 `#2A0A4A` 紫调 |
| **P10** | **故事性几何** | 击杀 = 切线劈开方块碎成三角 = "秩序被 Burnish 解构" → 这一帧是整个游戏的视觉母题 |

---

## Part 2 · 5 个核心元素的核心呈现

### 2.1 弹珠 Ball — ○ 主体 + △ 特效

> **设计决定**：弹珠本体 = **○ 圆形**（贴 Lio 召唤的"能源球"语义），但所有围绕弹珠的特效（trail / burst / 命中反馈 / 元素 overlay）= **△ 三角**。
> 这是 Imaishi 编码里被允许的"例外圆"之一 —— 因为弹珠不是"敌人秩序结构"，是"玩家本体"。

**体积构造（○ 主体 3 层 + △ 特效层）**

| 层 | 形状 | 尺寸 | 颜色 | 错位 |
|---|---|---|---|---|
| ① 阴影 | ○ 圆 | r=10px | 元素暗调 #660F40 / #003E5C | (+2,+2) |
| ② 主体 | ○ 圆 | r=8px | 元素主色 | (0,0) |
| ③ 高光弧 | 1/3 ○ 弧线 (12 到 2 点钟) | r=8 内描边 | 白 / 高光黄 | 左上偏 |
| ④ 元素 △ overlay | 小 △（1 个） | r=3px | 元素主色 | 中心上方 -2px |

不是 sphere mesh + radial gradient；是**3 层等心圆 + 1 个内部小 △ 标识元素身份**。

**运动**

- **平移**：连续 60fps（物理需要，P4 例外）
- **旋转**：○ 本体无旋转（圆没朝向）；元素 △ overlay 每 5 帧 snap +30° 提示元素活性
- **加速 trail**（speed > 8）：身后 2 个 △ afterimage（**不是圆**，特效=△），size 0.7/0.5、alpha 0.5/0.25、位置后退 6px/12px、**stepped 切换**

**特殊元素 trail**

| 元素 | trail △ 形态 |
|---|---|
| pyro | 2 个粉 △ cone 顶尖朝弹道方向，颜色叠 0.3 alpha 粉雾 |
| cryo | 2 个拉长青菱形针 |
| lightning | 关 trail，每 8 帧随机弹出 1 条 Z 字 stepped overlay |
| damage / 普通 | 2 个白 △，半透 |

**关键叙事帧**：弹珠**撞钉 / 撞敌 1 帧**贴 1 个白 △ flash overlay（size 1.5×），这是"○ 喷射 △ 火"的具象化。

---

### 2.2 敌人 Enemy — 敌方身份的 □

> 敌人是 Imaishi 几何编码里"体制/秩序"的承载。所有敌人**底色都是方块**；元素 / 词条 / boss 个性化通过**几何 overlay 贴在方块上**，不替换主体。

**体积构造（P2 三层堆叠 + P3 词条 overlay）**

| 层 | 形状 | 颜色 | 备注 |
|---|---|---|---|
| ① 最底（阴影） | 方块 | 深紫描边色 #2A0A4A | 偏移 (+3,+3) |
| ② 主体 | 方块 | 敌人主色（按类型，默认 #5C4B7A 灰紫） | (0,0) |
| ③ 边缘 1px 高光 | 方块描边 | 主色 ×1.3 亮 | 顶部 + 左侧线段，模拟光从左上来 |
| ④ "目光" | 1-2 个微小三角 | 白 #FFFFFF | 主体方块上半部，朝玩家方向，**唯一三角元素** = 敌人也"看"玩家 |
| ⑤ 词条 overlay | 见下表 | 各异 | 多词条按 anchor 区分位置 |

**词条 overlay 速查（P3：几何贴在方块上不替换主体）**

| 词条 | overlay 几何 | 位置 anchor | 颜色 | 节奏 |
|---|---|---|---|---|
| pyro（燃烧） | 3-5 个小三角顶 | 方块上边 | 粉 + 黄核 | 每 5 帧 flicker 显隐 |
| cryo（冰冻） | 1 长菱形针穿对角 | 横贯 | 青 + 白核 | 静态 |
| lightning（电） | 1 Z 字横切 | 方块中部 | 黄 + 白核 | 每 3 帧抖动 ±2px stepped |
| shield（护盾） | 第二层方块外框 | 全身偏移 +4px | 白 1px 描边 | 静态 |
| regen（再生） | 3 行向上 chevron | 底→顶滚动 | 白 0.6 alpha | 每 10 帧滚动 4px |
| haste（极速） | 双 45° 斜条 | 中央叠加 | 黄 0.5 alpha | 每 5 帧位移 6px stepped |
| clone（增殖） | 1 个微小子方块 | 右下角伸出 | 主色 | 静态 |
| devour（吞噬） | 4 角内向 chevron | 四角 | 粉 | 每 8 帧抖动 |
| berserk（狂暴） | 顶边横滚锯齿三角 | 方块顶 | 粉 + 黄 | 每 5 帧切显隐 |
| heavyArmor | 第二层方块外框 + 双 X | 全身 | 白 0.6 alpha | 静态 |

**Boss = 复合方块**（不是单方块）：

- **boss_ignis（火 boss）**：基底方块 + 顶部 3 个粒度更大的三角顶（spire 暗示）
- **boss_glacies（冰 boss）**：基底方块 + 3 个长菱形针从顶部插出
- **boss_micro（增殖 boss）**：3×3 大方块网格组合
- **boss_devourer（吞噬 boss）**：基底方块顶部 destination-out 倒三角缺口（咬出来）+ 内 4 chevron
- **boss_tesla（电 boss）**：3 层嵌套方块旋转角度 0°/15°/-15° stepped
- **boss_chimera（混合 boss）**：左半方块 + 右半方块拼接，元素色不同
- **boss_ouroboros（环 boss）**：8 个小方块围成圈（注意：是排列成圆形，不是画圆）

---

### 2.3 元素特效 Element Effect — 10 元素的统一视觉语言

> 这张表是元素从「弹药 / 弹珠加成 / burst / 敌人词条 overlay / UI tag」**所有接触点**的视觉契约。
> 实现要点：每个元素只有 1 个 shape + 1 个色家族 + 1 个 motion signature，**不混用**。

| 元素 | shape | 色家族 | burst pattern | 残留状态 vfx | UI tag 形态 |
|---|---|---|---|---|---|
| **pyro** | △ cone（顶尖朝上） | 粉 #FF2EA6 → 黄 #FFE94A 核 → 暗粉 #660F40 描 | 1 巨大 cone + 3 中 + 12 小，全部直立朝上 | 受击物上贴 3 小三角，每 5 帧 flicker | 三角 chevron |
| **cryo** | ◆ 拉长菱形针 | 青 #00B4FF → 白 #FFFFFF 核 | 6-8 长菱形 360° 辐射，无核心剪影 | 受击物边缘 4 细针停留 | 长菱形 |
| **lightning** | Z 折线（厚 polygon） | 黄 #FFE94A → 白 #FFFFFF 核 | 3-5 大 Z 字随机姿态，每 2 帧 strobe 显隐 | 链式 Z 连接到下一目标，stepped angle | Z 字 |
| **damage** | ◆ 菱形 | 白 #FFFFFF → 黄边 | 1 巨菱形 1 帧硬切 + 6 小 360° | — | 实心菱形 |
| **pierce** | △ 长三角（lance） | 白 #FFFFFF → 粉描 | 1 长三角直线飞，无 burst 群，仅 trail | — | 极长三角 |
| **bounce** | △ 等边三角 | 粉 #FF2EA6 → 黄 #FFE94A 核 | 3 三角错位堆叠 + 5 小点 | — | 三角 stack |
| **scatter** | ★ 4 角星 | 黄 #FFE94A → 粉描 | 8 散射星 stepped spin | — | 4 角星 |
| **wind** | △ 极细长三角 | 青 #00B4FF → 白 | 3 风刃沿速度向延展 + 2 短月牙 | — | 倾斜长三角 |
| **laser** | ▭ 极长极细矩形 | 白 #FFFFFF → 青 | 1 大激光柱 4 帧硬切持续 + 起点 4 短三角 | — | 极细长条 |
| **venom** | ▽ 倒三角 | 黄 #FFE94A → 粉 | 4-6 倒三角 + 2 小绿圆点（**唯一允许的圆例外**：药水滴痕） | 受击物渗下 2-3 小绿点 stepped | 倒三角 |
| **echo** | △ + 双层 | 粉 #FF2EA6 + 青 #00B4FF | 1 大三角 + 2 错时小三角延迟 80ms / 160ms 出现 | — | 双层嵌套三角 |

**抽帧细则**（所有 burst 共通）：

- 第 0 帧（t=0）：超大剪影 + 大碎片同时 pop on（无 fade-in）
- 第 5 帧（t=83ms）：剪影 snap shrink + 小碎片接力出现
- 第 10 帧（t=166ms）：剪影消失，碎片继续直线漂
- 第 15 帧（t=250ms）：碎片开始进入 snap shrink 末段
- 第 25 帧（t=416ms）：全部消失
- 总时长：~0.4s

---

### 2.4 击杀瞬间 Kill Moment — 整套视觉的母题

> "□（秩序）被 △（Burnish）切开 → 碎成 △（自由）" —— Promare 整部片子的母题在这一帧上演。
> 这不是普通爆炸，是**单帧叙事**。每一帧都要可识别。

**时间线（每 5 帧 = 83ms = 一个 12fps step）**

```
t=0      [Frame 0]   全屏 white flash overlay alpha 0.4，敌人方块本体保留
                     hitstop 4 帧（玩家球暂停，给眼睛追上）

t=83ms   [Frame 5]   切线 △（粉色，超长极细 lance，alpha 1.0）从入射方向硬切显现
                     angle = atan2(-impactVel.y, -impactVel.x)
                     长度 = 敌人方块对角线 × 1.6
                     hitstop 解除

t=166ms  [Frame 10]  切线消失（snap，无 fade）
                     敌人方块视觉上被切成 2-4 块（clip-path 分块绘制）
                     每块向外位移 +6px stepped

t=250ms  [Frame 15]  方块块完全消失
                     生成 16-24 个 △ 碎片（power-law: 2 大 + 5 中 + 15 小）
                     碎片色：保留敌人暗紫描边 + 内核闪烁玩家阵营色（粉/青/黄按元素）
                     入射反方向锥形 ±60° 散

t=333ms  [Frame 20]  生成 2-3 "金田光斑"（白色 △，1 帧硬切显现）
                     位置：碎片云中心 ±10px 随机

t=416ms  [Frame 25]  金田光斑消失（snap）
                     碎片继续 stepped 漂移，pop-hold-snap 生命周期消亡

t=500ms+ [Frame 30+] 碎片逐渐 snap shrink + alpha²
t=~1.5s             全部清场
```

**Boss 击杀**：

- 所有时长 × 2（节奏减缓 → 给情绪铺垫）
- 切线变 3 道（劈方块两次 → 4 块）
- 碎片数量 × 2
- **最后追加 1 个 ○**：直径约屏幕 1/3 的圆，1 帧硬切显现，0.3s 内 snap 消失 → 这是 Imaishi 编码里 "和解 / 收束" 的圆，整局游戏唯一合法的圆使用之一

---

### 2.5 背景 Background — 深紫底 + 静态剪影

> Tier 1 已替换扫描线 / 透视网格的合成波背景为深紫底；本节定义层叠剪影。

**3 层结构（远→近）**

| 层 | 内容 | 数量 | 颜色 | 动画 |
|---|---|---|---|---|
| 远景剪影 | 静态超大 □ | 1-3 个 | 暗紫描深紫 (主色 0.4) | 不动 或 0.1px/frame stepped 漂 |
| 中景剪影 | 静态中等 △ | 5-8 个 | 主色家族 × 0.3 alpha | 每 30 帧 +1px stepped |
| 前景气氛粒 | 小 △ 缓慢上升 | 5-15 个 | 元素色 0.2-0.4 alpha | stepped 上升 |

**场景差异**

| 场景 | 远景 □ | 中景 △ | 气氛粒 | 整体饱和度 |
|---|---|---|---|---|
| Meta（主菜单） | 1-2 个（神圣感） | 多 | 多（粉+青混） | 1.0 |
| Selection（命运抉择） | 1 个 | 中 | 中 | 1.0 |
| Gathering（研磨） | 0（让钉盘 punch out） | 少 | 少 | 1.0 |
| Combat（战斗） | 3 个，stepped 微震 ±1px | 少 | 中 | 1.0 |
| Boss | 1 个超大占屏 40%（"Kray 高塔" 暗示） | 0 | 多（粉） | 1.1 |
| Game Over | 不变 | 不变 | 停止 | 0.3 灰阶 |

---

## Part 3 · 5 个次级元素（更快地说）

### 3.1 钉子 Peg

- Shape: 小 ◆ 菱形（4 顶点 □ 旋 45°）= "中性结构"（非玩家非敌人，是世界结构）
- 大小：直径 ~12px
- 颜色：元素 peg 用元素色；normal peg 用白 + 暗紫描边
- 元素 peg 顶部贴 1 个超小 △（识别符），每 30 帧 stepped pulse

### 3.2 子弹 Projectile

- Shape: △（元素 shape，pierce 长 / pyro cone / scatter 星）
- Trail: 2-3 个 afterimage △ 错位 + alpha 0.5/0.25 + stepped angle
- Spawn: 1 帧硬切显现，无 fade-in，无"枪口闪光"额外特效（枪口闪光已经是弹药 UI 的事）

### 3.3 符文 Rune

- Shape: △ badge with 元素色
- 稀有度 = 嵌套 △ 层数（common 1 / rare 2 / epic 3 / legendary 4）
- Idle: 每 30 帧 stepped pulse +5%/-5%
- 使用消耗: 4-6 小 △ 向外散，stepped 飞 + pop-hold-snap

### 3.4 UI 卡牌 Selection Card

- Shape: 梯形 trapezoid（slight angle 暗示运动 → 非静止矩形）
- Icon: 元素的 burst 关键 shape 缩放版（pyro = 三角云，cryo = 菱形针）
- Hover: snap scale 1.05（**1 帧硬切**，不 lerp transition）
- Selected: 4px hard-shadow offset（X 方向）+ 元素色
- 稀有度边框颜色 = 元素色家族（不再用 indigo/amber/emerald）

### 3.5 HUD（HP 条 / 弹药槽）

- **HP 条**：12-15 段小 ◆（菱形），不是连续 bar。1 段 = 5-10% HP。掉血 = 段 1 帧 snap 消失（非渐变）
- **弹药槽**：梯形 cell + 内部元素 △ icon
  - 当前发射槽：黄色描边硬切 + 每 30 帧 1 帧 blink white overlay
  - 下一槽：青色描边 + 0.85 alpha
- **SP gauge**：8 个 ◆ 小菱形排列 + 满时 1 帧 blink white overlay

---

## Part 4 · 状态矩阵（5 核心元素 × 5 状态）

| 元素 \ 状态 | Idle | Active / Hover | Damaged / 冷却 | Destroyed / 消耗 | Spawn |
|---|---|---|---|---|---|
| **Ball** | ○ 三层 + △ 元素标识 | 加速时 2 △ trail | 撞击时贴 1 帧 △ white flash | snap shrink (3 帧到 0) | 1 帧硬切显现 |
| **Enemy** | 静止 + 每 30 帧 ±2px 微抖 stepped | 攻击 pulse +10% size（4-4-4 帧） | 1 帧 flash + overlay jitter ±3px | 切线 + 碎成 △ 流程 | 中心 1 □ snap 扩展到全尺寸（3 帧） |
| **Element FX** | — | — | — | burst 完整流程 | 超大剪影 1 帧 pop on |
| **Kill Moment** | — | — | — | 见 §2.4 时间线 | — |
| **Background** | 远景 □ + 中景 △ 漂浮 | — | — | — | 1 帧硬切显现（场景切换） |
| **Peg** | 静止 ◆ | — | 1 帧 white flash + 冷却期 grayscale 50% | — | 1 帧硬切显现 |
| **Projectile** | 单色 △ + trail | — | — | snap shrink | 1 帧硬切，无 fade-in |
| **Rune** | stepped pulse | snap scale 1.1 | — | 4-6 △ 散 | 4 △ 合拢成型 stepped |
| **Card** | 静止梯形 | snap scale 1.05 | — | snap scale 0.3 + alpha 0（4 帧） | snap 横向滑入（每 2 帧 +30px） |

---

## Part 5 · 场景节奏（每个场景的视觉密度）

> 不是所有场景都要"满"。Promare 的厉害在**密度对比**：战斗段塞满 burst，但 Lio 内心独白时整屏只有 2 个色块。

| 场景 | 屏粒子数上限 | 主色块占比 | 节奏频率（每秒事件） | 关键视觉锚点 |
|---|---|---|---|---|
| Meta | 100 | 30% | <1 | 标题 + "开始炼成" 按钮 |
| Selection | 150 | 40% | 2（卡牌入场 / hover） | 3 张卡牌 |
| Gathering | 400 | 60% | 5-15（peg 命中 / 弹珠 trail） | 钉盘整屏 |
| Combat (normal) | 600 | 70% | 8-20（burst / projectile） | 敌人 + 弹幕 |
| Combat (boss) | 800 | 85% | 20+（boss 攻击 / hitstop） | 巨型 boss + 切线时刻 |
| Game Over | 50 | 20% | 0（静止收束） | 几何标题 |

---

## Part 6 · 实施路径（基于 Tier 1 已完成）

> Tier 1（粒子引擎 F1-F7 + 后期管线 + 调色板）已 ship 在 PR #134 + bcbf068 + 65c67f8。本设计是 Tier 2 + Tier 3 的设计基础。

### Tier 2 — 阵营语义落地（按本设计 Part 2.2 + 2.4）

按性价比排序：

1. **T2.A 击杀瞬间**（§2.4 时间线）— 改写 `promare_explosion.js`，移除现有 echo_ring 圆 + Shockwave 圆 + 菱形碎片，按时间线落地切线 + 方块切片 + 三角碎片。这是单一最高 ROI 改动。
2. **T2.B 敌人方块底**（§2.2）— 改写 `promare_enemy_draw.js`、`promare_boss_draw.js`，把现有 spire/asterisk/hexCluster 替换为方块基底 + 词条 overlay
3. **T2.C 词条 overlay 系统**（§2.2 词条速查表）— 改写 `promare_tokens.js` AFFIX_CODEX，让 enemy draw 按 anchor 贴几何
4. **T2.D 弹珠三角化**（§2.1）— 改 ball 渲染（在 `entities.js` 的 Ball.draw 或 3D 球 Mesh），改为三角剪影 + trail

### Tier 3 — 场景与 UI 收尾（按本设计 Part 2.5 + Part 3）

5. **T3.A 背景重写**（§2.5）— 改写 `promare_background.js`，删扫描线 + 透视网格，按场景差异铺远景 □ + 中景 △
6. **T3.B UI 卡片梯形 + 元素图标**（§3.4）— 改写 `promare_ui.css` 卡片样式 + 弹药槽 trapezoid
7. **T3.C 钉子菱形**（§3.1）— 改 `promare_peg_draw.js`
8. **T3.D HP 条段化**（§3.5）— 改 hud.js / hp 渲染

---

## Part 7 · 实施约束与验收

**实施约束**：

- 任何新增/改写代码必须满足 P1-P10
- 每个 PR 限定一个 Tier 任务（T2.A / T2.B / ...）
- 每个 Tier 落地后跑一次 Part 4 状态矩阵 checklist

**验收 checklist**（每个 Tier 完成后逐项目测）：

- [ ] 整屏取色：3 大主色 + 深紫底占 80%+，无意外色
- [ ] 玩家相关视觉 = △，敌人相关视觉 = □，**普通战斗中没有任何 ○**
- [ ] 任意运动 60fps 录屏 → 慢放看是否是 12fps stepped
- [ ] 击杀瞬间放慢 10× 播放：能识别"切线 → 切片 → 碎成三角 → 金田光斑"4 个阶段
- [ ] Boss 击杀末段：1 个圆出现 0.3s 然后消失（唯一合法 ○）

---

## Part 8 · 开放问题（已敲定）

1. **弹珠形态** → **○ 主体 + △ 特效**。Ball.draw 维持圆形（这是被允许的"例外圆"，贴 Lio 能源球语义），但所有特效（trail / burst / 命中 flash）走 △。已更新到 §2.1。
2. **boss_ouroboros 排成 ○** → **可以**。形式上是 ○，但语义是 8 个 □ 围成结构 → 不破坏"普通战斗无 ○"原则。
3. **UI 菱形 clip-path** → **保留不改**。本轮 Tier 2 / Tier 3 不动 UI 菱形；后续如有空再讨论。
