# Echo Alchemist V2 — UI 页面与美术素材需求清单

> **目的**：作为美术对接的「权威清单」，集中索引所有 UI 页面、当前美术覆盖率、缺失素材，以及推荐的命名/尺寸/接入位置。
>
> **范围**：本文档只关注 UI 与界面美术（不含敌人/Boss Sprite，那部分见 [`design_spec_bitmap.md`](../design_spec_bitmap.md) §3）。
>
> **维护者**：UI/美术 Agent 在每次新增 UI 页面或新增/替换素材时同步更新本表。

---

## 0. 视觉风格统一约定

| 维度 | 约定 |
|------|------|
| 主色调 | `#0f172a` (slate-900) 深色底；`#581c87` (purple-800) 与 `#facc15` (gold) 用于强调 |
| 字体 | 标题 `Cinzel`（衬线，已通过 Google Fonts 引入）；正文 `Noto Sans SC` |
| 边框 | 9-Slice，统一 `border-image-slice: 32` 或 `48`，详见 [`design_spec_bitmap.md`](../design_spec_bitmap.md) §2 |
| 发光 | `box-shadow + filter: drop-shadow`；位图素材自带柔光层即可，不要重复堆 CSS |
| 命名规范 | `kebab-case.png`，对应 raw 源图加 `_raw` 后缀，9-Slice 切图加 `_9s` 后缀 |
| 目录结构 | `assets/ui/{panels,borders,sprites,icons}/` 与 `assets/icons/{ammo,relic,rune}/` |

接入约定：所有新增的位图样式必须写到 [`src/styles/bitmap_ui.css`](../src/styles/bitmap_ui.css)，**严禁**在 `index.html` 内嵌 `<style>` 中写位图样式（避免与 9-Slice 体系冲突）。

---

## 1. UI 页面索引（按 `#phase-*` 与功能模块划分）

下列每一项的 **「美术状态」** 含义：
- ✅ 已配齐（位图素材接入、风格一致）
- 🟡 部分覆盖（仅基础元素接入，需补背景/边框/装饰）
- ❌ 完全缺失（当前由原生 CSS 渲染，未接入位图）

| ID | DOM 节点 | 模块/职责 | 美术状态 | 现有素材 | 缺失素材 |
|----|---------|----------|----------|---------|---------|
| 1.1 | `#phase-title-container` | 启动标题 / 点击开始 | 🟡 | 文字 + Cinzel 字体（背景由 `#phase-meta` 承载） | 标题徽章 PNG、点击「开始按钮」金属底板 |
| 1.2 | `#phase-meta` | 局外元商店 / 升级树 | 🟡 | 顶部栏 9-Slice、卡片 9-Slice 边框、`relic_overlay_bg.png` 复用底纹 | **元商店分类标签 Tab Sprite**、**SP 货币图标**、升级卡片占位插画 |
| 1.3 | `#phase-rune-launcher` | 符文发射器主面板 | ✅ | `rune_launcher_9s.png`（已收缩到内层卡片宽度 384px）、`rune_grid_bg_9s.png`、`rune_slot_idle/hover/filled/highlight.png` | — |
| 1.4 | `#phase-shop` | 局外商店（货架） | 🟡 | 卡片 9-Slice、`replace_ammo_bg.png` 复用炼金工坊底图 | 商店物品分类图标、价格标签 |
| 1.5 | `#phase-selection` | 弹珠选择 / 子弹替换 / 命运时刻 | ✅ | `replace_ammo_bg.png`、`replace_card_frame_<C/B/A/S>_9s.png`、`replace_card_attr_slot.png`、`skip_btn_metal.png` | — |
| 1.6 | `#phase-gathering` | 研磨阶段（弹珠台） | 🟡 | `bg_main_canvas.png`、`bg_emitter_zone.png`、`emitter_base.png` | 底部「钉盘外框」装饰 |
| 1.7 | `#phase-combat` | 战斗阶段（无 DOM 主面板） | ✅ | `bg_main_canvas.png`、`emitter_base.png`、`emitter_charging_0~5.png`（蓄力 6 帧叠加） | — |
| 1.8 | `#phase-truth-book` | 真理之书 / 图鉴 | 🟡 | `truth_book_bg_9s.png`（已接入背景） | 章节侧标 Tab、属性卡片底板、Boss 头像位 |
| 1.9 | `#phase-relic` | 遗物选择 overlay | ✅ | `relic_overlay_bg.png`、`skip_btn_metal.png` + 已有遗物图标/9-Slice 边框（**已移除**旋转圆形稀有度光环） | — |
| 1.10 | `#phase-gameover` | 游戏结束/结算 | 🟡 | `gameover_bg.png`（已接入） | 统计数据卡片 9-Slice、奖励发放动画图层 |
| 1.11 | `#phase-pause` | 暂停菜单 | ❌ | — | 半透明背景、菜单按钮 9-Slice |
| 1.12 | `#unified-top-bar` | 顶部状态栏 | ✅ | 9-Slice `top_bar_9s.png` | — |
| 1.13 | `.bottom-panel` | 底部弹药栏 | ✅ | 9-Slice `bottom_panel_9s.png` | — |
| 1.14 | `#settings-panel` | 设置弹窗 | 🟡 | `settings_modal_9s.png`、`toggle_on.png`、`toggle_off.png` | 滑条 Sprite、关闭按钮 |
| 1.15 | `#combat-rune-charge-ui` | 战斗中符文充能 UI | 🟡 | 符文 PNG | 充能槽底板（液体/能量条）、充能完成「升级」帧动画 |
| 1.16 | `#multiplier-display` | 连击倍率显示 | ✅ | `multiplier_x2.png`、`multiplier_x3.png`、`multiplier_x5.png` | — |
| 1.17 | `#skill-bar` | 战斗技能栏 | 🟡 | 技能图标 PNG、`rune_slot_idle.png`、`rune_slot_active.png` | 冷却扫描帧 |
| 1.18 | `#round-start-banner` | 回合开始横幅 | ✅ | `round_banner_1.png` ~ `round_banner_6.png`（6 帧，600×200） | — |
| 1.19 | 数据统计页（与图鉴并入 truth-book） | 历次伤害/记录 | ❌ | — | 折线图背景、数据指标徽章、最佳记录 ribbon |
| 1.20 | `.ammo-icon` 弹药槽位 | 战斗 / 收集阶段 | 🟡 | `assets/icons/ammo/*.png` 已覆盖原有 12 种（含 matryoshka、rainbow、resonance、flying_sword、wind） | `ammo_venom.png`、`ammo_overcharge.png`、`ammo_echo.png`（新属性，待生成） |
| 1.21 | 发射器属性球轨道（Canvas 渲染层） | 战斗 / 装填时围绕发射器旋转的属性球 + 连线 | ✅ | `orbital_socket_<elem>.png`×7、`orbital_link_strip.png`、`orbital_link_cap.png`、`orbital_link_flow_0~3.png`、`orbital_intake_0~3.png` | — |

---

## 2. 缺失素材分级清单（优先级排序）

### 2.1 P0 — 立刻影响游戏可玩性 / 风格统一性

| 资产 | 用途 | 建议尺寸 | 备注 |
|------|------|---------|------|
| ~~`assets/ui/backgrounds/bg_main_canvas.png`~~ | ✅ **已生成** | 720×1280 | 暗黑赛博炼金风，中部低对比区域 |
| ~~`assets/ui/backgrounds/bg_emitter_zone.png`~~ | ✅ **已生成** | 720×220 | 含炼金台基座、能量管路 |
| ~~`assets/ui/sprites/emitter_base.png`~~ | ✅ **已生成**（透明 PNG） | 96×96 | 静态贴图（带高光层） |
| ~~`assets/ui/sprites/emitter_charging_*.png`~~ | ✅ **已生成**（透明 PNG） | 96×96 | `_0.png` ~ `_5.png`，0%→100% 蓄力渐进，纯色底 + rembg 抠图 |
| ~~`assets/icons/ammo/ammo_explosive.png`~~ | ✅ 已有 | 32×32 | 爆破弹药图标 |
| ~~`assets/icons/ammo/ammo_matryoshka.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 套娃弹药图标 |
| ~~`assets/icons/ammo/ammo_rainbow.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 七彩弹药图标 |
| ~~`assets/icons/ammo/ammo_resonance.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 共鸣弹药图标 |
| ~~`assets/icons/ammo/ammo_flying_sword.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 飞剑弹药图标 |
| ~~`assets/icons/ammo/ammo_wind.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 风弹药图标 |
| ~~`assets/ui/sprites/orbital_socket_<elem>.png`~~ | ✅ **已生成**（7 属性，透明 PNG） | 64×64，圆形对称 | 详见 §6.1 |
| ~~`assets/ui/sprites/orbital_link_strip.png`~~ | ✅ **已生成**（程序生成） | 24×6，水平可平铺 | UV 沿连线方向拉伸，结合 `screen` 合成 |
| ~~`assets/ui/sprites/orbital_link_cap.png`~~ | ✅ **已生成**（透明 PNG） | 16×16，中心对齐 | 覆盖连线两端硬边切口 |

### 2.2 P1 — 完整覆盖核心 UI 模块

| 资产 | 用途 | 建议尺寸 | 备注 |
|------|------|---------|------|
| ~~`assets/ui/panels/rune_launcher_9s.png`~~ | ✅ **已生成** | 512×768，`border-image-slice:48` | 含装弹槽视觉 |
| ~~`assets/ui/sprites/rune_slot_idle.png` / `_active.png`~~ | ✅ **已生成**（透明 PNG） | 64×64 | 两态切换 |
| ~~`assets/ui/panels/settings_modal_9s.png`~~ | ✅ **已生成** | 480×640，slice 32 | 暗紫炼金阵纹理 |
| ~~`assets/ui/sprites/toggle_on.png` / `toggle_off.png`~~ | ✅ **已生成**（透明 PNG） | 56×28 | 24×24 滑块 |
| `assets/ui/sprites/slider_track.png` / `slider_thumb.png` | 滑条（待生成） | 240×16 / 24×24 | 用于音量、速度 |
| ~~`assets/ui/panels/truth_book_bg_9s.png`~~ | ✅ **已生成** | 720×1280，slice 64 | 卷轴/书页质感 |
| `assets/ui/sprites/truth_book_tab_*.png` | 章节侧标（待生成） | 64×120 | 每章节一张 |
| ~~`assets/ui/banners/round_banner_*.png`~~ | ✅ **已生成**（6 帧） | 600×200 | 金属字 + 光晕动画 |
| ~~`assets/ui/sprites/orbital_link_flow_*.png`~~ | ✅ **已生成**（透明 PNG） | 8×8 | `_0.png` ~ `_3.png`，循环 |
| ~~`assets/ui/sprites/orbital_intake_*.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | `_0.png` ~ `_3.png`；吸入轨迹粒子 |
| ~~`assets/ui/panels/replace_ammo_bg.png`~~ | ✅ **已生成** | 720×1280 | 炼金工坊促視构图，中部低对比区域 |
| ~~`assets/ui/sprites/replace_card_frame_<tier>_9s.png`~~ | ✅ **已生成**（透明 PNG） | 192×260，slice 24 | C/B/A/S 四档卡片边框 |
| ~~`assets/ui/sprites/replace_card_attr_slot.png`~~ | ✅ **已生成**（透明 PNG） | 56×56 | 属性 icon 圆形底座 |
| ~~`assets/ui/panels/relic_overlay_bg.png`~~ | ✅ **已生成** | 720×1280 | 暗紫炼金阵纹理 |
| ~~`assets/ui/sprites/skip_btn_metal.png`~~ | ✅ **已生成**（透明 PNG） | 128×40 | 金属底板按钮 |
| ~~`assets/ui/panels/rune_grid_bg_9s.png`~~ | ✅ **已生成** | 320×320，slice 32 | 九宫格容器，含九格分隔线纹理 |
| ~~`assets/ui/sprites/rune_slot_hover.png` / `rune_slot_filled.png`~~ | ✅ **已生成**（透明 PNG） | 64×64 | 覆盖完整 4 态交互 |
| ~~`assets/ui/sprites/rune_slot_highlight.png`~~ | ✅ **已生成**（透明 PNG） | 96×96 | 放置确认光圈 |
| `assets/icons/ammo/ammo_venom.png` | 毒素弹药图标（待生成） | 32×32 | 毒绿色液滴 + 骷髅纹，对应 `AMMO_ICON_MAP.venom`；参考 `ammo_cryo.png` 风格 |
| `assets/icons/ammo/ammo_overcharge.png` | 超载弹药图标（待生成） | 32×32 | 金橙色能量弹 + 充能电弧纹，对应 `AMMO_ICON_MAP.overcharge` |
| `assets/icons/ammo/ammo_echo.png` | 回响弹药图标（待生成） | 32×32 | 蓝紫色残影环绕弹，对应 `AMMO_ICON_MAP.echo` |
| `assets/icons/rune/rune_venom_1.png` | 毒素符文 Lv1（待生成） | 48×48 | 毒液纹路，common 灰色外框 |
| `assets/icons/rune/rune_venom_2.png` | 毒素符文 Lv2（待生成） | 48×48 | 毒液纹路加强，epic 紫色外框 |
| `assets/icons/rune/rune_overcharge_1.png` | 超载符文 Lv1（待生成） | 48×48 | 充能纹路，epic 紫色外框 |
| `assets/icons/rune/rune_echo_1.png` | 回响符文 Lv1（待生成） | 48×48 | 残影环绕纹路，rare 蓝色外框 |

### 2.3 P2 — 锦上添花

| 资产 | 用途 | 建议尺寸 | 备注 |
|------|------|---------|------|
| ~~`assets/ui/sprites/multiplier_x2.png` ~ `x5.png`~~ | ✅ **已生成**（透明 PNG） | 96×48 | 三档稀有度配色 |
| ~~`assets/ui/panels/gameover_bg.png`~~ | ✅ **已生成** | 720×1280 | 双联画构图 |
| ~~`assets/ui/sprites/relic_aura_*.png`~~ | ✅ **已生成**（透明 PNG） | 200×200 | C/B/A/S 四档稀有度光环 |
| `assets/ui/sprites/skill_cooldown_overlay.png` | 技能冷却扫描（待生成） | 64×64 | 遮罩/扫光层 |

---

## 3. 接入流程与 Agent 协作

1. **新增素材**：放到上表指定路径，提供 `_raw.png`（无切片源图）+ 成品（`.png` 或 `_9s.png`）。
2. **CSS 注入**：在 [`src/styles/bitmap_ui.css`](../src/styles/bitmap_ui.css) 新增对应规则（不要内嵌 `<style>`），保持每个 selector 与本文档表格 ID 一一对应注释（例如 `/* §1.14 settings_panel */`）。
3. **JS 接入**（如图标）：通过 [`src/bitmap_icons.js`](../src/bitmap_icons.js) 的 `getXxxIconSrc()` 函数集中映射，禁止散落 `new Image()`。
4. **同步更新本表**：每次替换素材，把对应行的「美术状态」列从 ❌ → 🟡 → ✅，并把缺失素材列勾掉。
5. **回写到设计规格**：本文档为「现状视图」，长期规格依然以 [`design_spec_bitmap.md`](../design_spec_bitmap.md) 为准；如新增页面，请同时更新该文档 §2。

---

## 4. 已知不一致项（需在 art pass 中解决）

- `#phase-selection` 卡片顶部的属性图标当前用 emoji，需要替换为 `assets/ui/sprites/attr_icon_*.png`（与 `assets/icons/ammo` 同源即可）。
- `#phase-rune-launcher` 当前完全无背景，导致与 `#phase-shop` / `#phase-selection` 视觉割裂；优先级 P0/P1。
- `#combat-rune-charge-ui` 充能条采用纯 CSS gradient，与符文 PNG 风格不统一；建议补充充能槽位图。
- `assets/icons/relic/` 已较完整（55+ 个），但 `assets/icons/rune/` 与新增符文同步滞后；新增符文时必须同时提供位图。
- 已生成的 `top_bar_panel.png` 与 `top_bar_9s.png` 同名混乱，建议归档 `top_bar_panel.png`（已被 9-Slice 替代）。

---

## 5. 文档索引

- 视觉规格根：[`design_spec_bitmap.md`](../design_spec_bitmap.md)
- 位图样式接入：[`src/styles/bitmap_ui.css`](../src/styles/bitmap_ui.css)
- 图标映射模块：[`src/bitmap_icons.js`](../src/bitmap_icons.js)
- UI 系统模块：[`src/ui_system.js`](../src/ui_system.js)、[`src/ui/`](../src/ui/)
- 全局规范：[`AGENTS.md`](../AGENTS.md) §1

---

## 6. 深度模块拆解（高频重点 UI 的素材方案）

> 本节针对 §1 表中标 🟡/❌ 且属于战斗高频可见的模块，给出更细的素材结构、动画方案与「自然衔接」的实现路径。新增素材时按 §6.x 注明的接入函数对应。

### 6.1 发射器属性球轨道（对应 §1.21）

**当前实现**
- 渲染入口：[`src/render_system.js:344`](../src/render_system.js) `render_combat_launcherOrbitals(ctx, centerX, centerY, recipe)`，由 [`src/game_phase.js:1969`](../src/game_phase.js) 调用
- 物理：[`src/entities.js:4042`](../src/entities.js) `updateOrbitalPhysics(timeScale)`，基础角速度 `0.00012` rad/帧 + `spinBoost`（0.95 衰减）
- 轨道半径：基础 55px；蓄力时收缩；装填时从 450px 外吸入
- 连线：`render_system.js:464-479`，单段 `createLinearGradient(中心→属性球)`，`globalCompositeOperation = 'screen'`，alpha 0.3，仅在半径 10-120px 区间绘制
- 属性球本体：纯 `arc()` + 双层发光，无位图

**问题**
- 连线"单段渐变"在球高速旋转时视觉上像残影/抖线，缺乏方向感与"能量流动"的暗示
- 属性球与发射器之间缺少"承接点"——球凭空悬浮于发射器侧上方
- 装填吸入（450 → 55px）瞬间没有粒子轨迹，玩家容易"看不见"球被收回

**素材清单与自然衔接方案**

| 素材 | 用途 | 关键约束 |
|------|------|----------|
| `assets/ui/sprites/orbital_socket_<elem>.png` (64×64) | 属性球底座（pyro/hydro/cryo/electro/anemo/dendro/geo 各一） | **必须圆形对称**（球绕发射器旋转时角度持续变化，朝向性素材会穿帮）；底座绘制在轨道圆周上、球的下层 |
| `orbital_link_strip.png` (24×6) | 连线主体平铺纹理 | 替换当前 `createLinearGradient`；UV 沿连线方向拉伸，结合 `screen` 合成保持发光感；纹理本身做出"能量丝"的横向条纹 |
| `orbital_link_cap.png` (16×16) | 连线两端端帽 | 覆盖连线起止处的硬边切口，球侧 / 发射器侧通用，居中对齐 |
| `orbital_link_flow_*.png` (8×8, 4 帧) | 沿连线流动的光点 | 在连线 0%~100% 上以 `time % 1.0` 取插值位置绘制；建议 2~3 个光点错开 0.33 相位，制造"能量被吸向中心"的方向感 |
| `orbital_intake_*.png` (32×32, 4 帧) | 装填吸入轨迹粒子 | 在 `updateOrbitalPhysics` 检测到 `radius > 120` 时，每帧在球的拖尾位置 spawn 一个粒子（4 帧动画 + 渐隐） |

**接入位置**
- `render_system.js:344` 改写：在 `arc()` 绘制属性球前插入 `drawOrbitalSocket()`；在连线绘制（464-479 行）替换为 `drawOrbitalLink()`；`updateOrbitalPhysics()` 中加 `spawnIntakeParticle()`
- 因动画完全由 rAF 物理驱动，所有素材必须是**中性朝向**（不要带方向箭头），方向感通过流动光点的运动方向表达

---

### 6.2 子弹替换卡片与背景（对应 §1.5）

**当前实现**
- 渲染入口：[`src/ui_system.js:349`](../src/ui_system.js) `ui_renderReplaceAmmoUI()`，卡片工厂 `renderCard()`（行 456）
- 稀有度：`_calcTier()` 输出 C/B/A/S，对应 `TIER_STYLES` CSS gradient + border 颜色
- 主属性配色：`_calcDominant()` 计算 dominant theme，输出 7 套 CSS gradient（pyro/hydro/cryo 等）
- 顶部属性 icon：浮出卡片 -18px，emoji fallback（已在 PR #61 加入 idle/floating 两态动画）
- 背景：`#phase-selection` 容器为纯 CSS gradient（`index.html:1560+`），无位图

**问题**
- 卡片描边由 8 套 `_calcDominant` gradient + 4 档 `TIER_STYLES` 拼接，热路径计算每次 reflow 重算；位图 9-Slice 边框可一次性替代
- 顶部 icon 当前 emoji，属性辨识度低（红色辣椒 vs 红色火焰对色弱玩家几乎相同）
- 整面无背景，与 §1.4 商店、§1.9 遗物 overlay 视觉割裂

**素材清单**

| 素材 | 用途 | 备注 |
|------|------|------|
| `assets/ui/panels/replace_ammo_bg.png` (720×1280) | 整面背景 | 中部 480×800 留低对比区承载卡片网格；建议加炼金台俯视构图 |
| `assets/ui/sprites/replace_card_frame_<tier>_9s.png` (192×260, slice 24) | 4 档卡片边框 | 替代 `TIER_STYLES.borderIdle`；保留 hover 时 CSS `transform: scale(1.03)` |
| `assets/ui/sprites/replace_card_attr_slot.png` (56×56) | 卡片顶部 icon 底座 | 圆形带描边；放置 `attr_icon_<elem>.png`（与 §1.20 同源） |
| `assets/ui/sprites/attr_icon_<elem>.png` (40×40) | 7 大属性 icon | **复用** `assets/icons/ammo/ammo_<elem>.png` 即可，按需缩放 |

**接入位置**
- `src/styles/bitmap_ui.css` 新增 `.replace-ammo-card[data-tier="S"] { border-image: url(...) 24 fill; }` 等 4 条规则
- `renderCard()` 中 emoji fallback 行（504-526）替换为 `<img>` 引用 `attr_icon_*.png`，emoji 仅作为图片加载失败的降级

---

### 6.3 命运选择 / 遗物选择 Overlay（对应 §1.5 / §1.9）

**当前实现**
- 容器：[`index.html:3215`](../index.html) `#phase-relic`（标题"古代遺物"），卡片容器 `#relic-container:3223`
- 命运时刻复用 `#phase-selection` + `fateMomentContext.active` 旗标（[`src/ui_system.js:346`](../src/ui_system.js)）
- 背景：纯 `rgba(2, 6, 23, 0.95)` 半透明深色，inline style，无位图
- 卡片：动态生成（图标 + 标题），不复用 §6.2 的 `renderCard()`
- 已接入：53 种遗物 PNG（`assets/icons/relic/`，[`bitmap_icons.js:53-99`](../src/bitmap_icons.js)）

**问题**
- 遗物 overlay 在战斗结算后高频弹出（每 Boss 一次），但背景无装饰，与卡片 PNG 风格脱节
- 「跳过」按钮纯 CSS，与遗物图标的位图质感不匹配
- 稀有度只靠遗物图标自身颜色暗示，传奇/史诗辨识度低

**素材清单**

| 素材 | 用途 | 备注 |
|------|------|------|
| `assets/ui/panels/relic_overlay_bg.png` (720×1280) | overlay 背景纹理 | 暗紫炼金阵；放在 `rgba(2,6,23,0.95)` 之上、卡片之下；可叠加 CSS `mix-blend-mode: screen` |
| `assets/ui/sprites/relic_aura_<tier>.png` (200×200) | 遗物稀有度光环 4 档 | 在卡片背后 absolute 居中；建议 CSS `animation: relic-aura-rotate 8s linear infinite` |
| `assets/ui/sprites/skip_btn_metal.png` (128×40) | 跳过按钮 | 复用到 §6.2 替换页右上角；hover 时 `filter: brightness(1.15)` |

**接入位置**
- `index.html:3215` 的 inline `style="background: rgba(...)"` 拆到 `bitmap_ui.css`，加 `background-image: url(relic_overlay_bg.png)`
- 遗物卡片渲染逻辑（搜索 `#relic-container` 的 children 注入处）外包一层 `<div class="relic-card-aura" data-tier="${tier}">`
- 命运时刻**复用** §6.2 的 `replace_ammo_bg.png`，不另起背景

---

### 6.4 符文发射器九宫格放置槽（对应 §1.3）

**当前实现**
- 主面板：[`src/ui/rune_launcher.js:62`](../src/ui/rune_launcher.js) `#phase-rune-launcher`
- 九宫格容器：`#rune-grid-container:208`，9 个 `.rune-grid-cell` 子节点（`#rune-cell-0` ~ `#rune-cell-8`）
- CSS 类：`rune-grid-cell w-16 h-16 flex items-center justify-center bg-slate-900/60 border-2 border-slate-700/60 hover:border-purple-500/60`
- 状态视觉：仅靠 border 颜色变化，**无空/满/高亮三态**区分
- 已接入：13 种符文 PNG（`assets/icons/rune/`，[`bitmap_icons.js:33-47`](../src/bitmap_icons.js)）
- 交互：`cell.addEventListener('click')`（行 226-239）→ `ui_openRunePicker(cellIndex)`（行 251）

**问题**
- 整个 §1.3 模块**完全无背景**——符文发射器是核心 meta 玩法但视觉最弱
- 九宫格是纯 Tailwind 边框，与符文 PNG 的精致质感形成强烈落差
- 玩家放置后没有"放置确认"反馈（仅 icon 立即出现），缺乏"咔哒一下"的满足感

**素材清单**

| 素材 | 用途 | 备注 |
|------|------|------|
| `assets/ui/panels/rune_launcher_9s.png` (512×768, slice 48) | 整面发射器面板背景 | 已列入 §2.2 P1；含装弹槽视觉 |
| `assets/ui/panels/rune_grid_bg_9s.png` (320×320, slice 32) | 九宫格容器 9-Slice | 含九格分隔线纹理；可省略 .rune-grid-cell 的 `border` |
| `assets/ui/sprites/rune_slot_idle.png` (64×64) | 空槽位 | 凹陷感金属底；浅灰色 |
| `assets/ui/sprites/rune_slot_hover.png` (64×64) | 鼠标悬停 | 紫色发光边 |
| `assets/ui/sprites/rune_slot_filled.png` (64×64) | 已放置 | 替代当前 `bg-slate-900/60`；底色加微暖色 |
| `assets/ui/sprites/rune_slot_highlight.png` (96×96) | 放置确认光圈 | 一次性，CSS `animation: 0.4s cubic-bezier(0.2,1,0.3,1)` |

**接入位置**
- `src/ui/rune_launcher.js:212-242` 的 cell 模板：移除 Tailwind `bg-slate-900/60 border-2 border-slate-700/60`，加 class `.rune-slot[data-state="idle|hover|filled"]`
- `bitmap_ui.css` 新增 `.rune-slot[data-state="idle"] { background-image: url(rune_slot_idle.png); }` 三条
- `ui_updateRuneGrid()` 中放置后 `cell.classList.add('rune-slot-place')`，`animationend` 移除——该 CSS 类调用 `rune_slot_highlight.png` 的一次性动画

---

> **维护提示**：本节列出的所有素材若已接入，**必须**把 §1 表对应行的状态从 🟡/❌ 升到 ✅，并在 §2 表中划掉对应条目，避免双向漂移。

---

## 7. v2 即时感重塑遗物 UI 需求清单（2026-04-29）

> 设计来源：[`docs/relic_system_design.md`](relic_system_design.md) §5。本节列出 13 个新增/修改遗物对应的 UI 与美术资产需求，按 P0/P1/P2 优先级分级。
>
> **接入路径**：所有遗物图标统一放至 `assets/icons/relic/<id>.png`，并在 [`src/bitmap_icons.js`](../src/bitmap_icons.js) 的 `RELIC_ICON_MAP` 中注册映射，命中后自动取代 `RELIC_DB[i].icon` 的 emoji fallback。

### 7.1 P0 — 遗物图标位图（必须完成）

| 遗物 ID | 名称 | 占位 emoji | 图标尺寸 | 视觉建议 |
|---|---|---|---|---|
| `hunter_instinct` | 猎人本能 | 🎯 | 64×64 | 红色十字准星叠加血滴；冷色金属外框 |
| `rune_resonance_core` | 符文共鸣核 | 💠 | 64×64 | 紫色结晶核心 + 共鸣波纹环（与 `relic_aura_<tier>.png` 协调） |
| `mirror_magazine` | 镜像弹夹 | 🪞 | 64×64 | 双子弹折射镜面，左右对称构图 |
| `doomsday_timer` | 末日计时器 | ⏱️ | 64×64 | 黑金沙漏 + 红色秒针；刻度盘隐约可见骷髅 |
| `echo_reverberation` | 余韵回响 | 🔔 | 64×64 | 钟形 + 多重声波同心圆，淡金色 |
| `element_injector` | 元素注入器 | 💉 | 64×64 | 玻璃试管中三色液体（火/冰/雷）旋绕，**epic 紫边** |
| `chaos_burst` | 混沌爆发 | 💥 | 64×64 | 紫色裂纹球 + 边缘湍流，**cursed 红黑边** |
| `attribute_protocol` | 属性协议 | 🧬 | 64×64 | DNA 双螺旋，每节点带不同元素颜色 |
| `mortal_burst` | 殒命爆裂 | 🎆 | 64×64 | 橙色辐射状爆破图案，中心骷髅剪影 |
| `corridor_arc` | 回廊电弧 | ⚡ | 64×64 | 紫色雷电从左右两侧向中心汇聚，**epic 紫边** |
| `chaos_pact` | 混沌契约 | 🩸 | 64×64 | 血色羊皮纸卷轴 + 红色封蜡，**cursed 红黑边** |
| `greedy_wheel` | 贪婪轮盘 | 🎲 | 64×64 | 金色赌轮 + 暗黑齿轮镂空，**cursed 红黑边** |

### 7.2 P1 — 战斗内即时反馈（提升打击感）

这些资产用于让 v2 遗物的"即时生效"在战斗画面中可见，玩家能直接感知"刚拿到=立刻强"。

| 资产 | 用途 | 建议尺寸 | 接入位置 |
|---|---|---|---|
| `assets/ui/sprites/hunter_target_marker.png` | 猎人本能：场上 hp 最低敌人头顶的"狩猎目标"红色十字标记 | 32×32（透明 PNG） | `render_system.js` 敌人渲染层；逐帧由 `combat_damageEnemy` 中查到的 lowestHpEnemy 决定 |
| `assets/ui/sprites/doomsday_target_pulse.png` | 末日计时器：被命中的敌人头顶 1.0s 红色脉冲圈 | 96×96 | `relic_runRoundStartHooks` 触发后通过粒子系统播放 |
| `assets/ui/sprites/chaos_burst_shockwave.png` | 混沌爆发：全屏冲击波贴图（紫色环） | 720×720 | `sys_dropFieldLoot` 触发时全屏 0.4s 闪烁 |
| `assets/ui/sprites/corridor_arc_chain.png` | 回廊电弧：左右墙到敌人的电弧贴图（4 帧动画） | 64×128 | `relic_runRoundStartHooks` 触发时绘制 |
| `assets/ui/sprites/mortal_burst_aoe.png` | 殒命爆裂：击杀位置的橙色 AOE 圈（一次性扩散） | 128×128 | killed 块内调用 |
| `assets/ui/sprites/wall_lightning_charge.png` | 力場護盾 / 回廊电弧：墙撞瞬间火花 | 64×64 | `_applyMove` 内 `handleRelicWallHit` 触发 |
| `assets/ui/sprites/echo_reverb_ring.png` | 余韵回响：编译时单属性 ≥10 层的环形提示（3 帧扩散） | 96×96 | 在 `phase_finalizeRound` 编译完成后由 hud 层短暂显示 |

### 7.3 P2 — 提示与教程

| 资产 | 用途 | 备注 |
|---|---|---|
| `index.html` 内新增遗物的 `recommendTip` 文案 | 已写入 `RELIC_DB`，仅前 3 次遗物选择显示 | 已完成（hunter_instinct / rune_resonance_core / doomsday_timer / attribute_protocol / mortal_burst） |
| 真理之书新条目（13 个 v2 遗物） | 图鉴覆盖；自动从 `RELIC_DB` 读取 | 需检查 `truth-book` 是否自动同步 |
| `assets/ui/banners/relic_v2_intro_banner.png` | v2 遗物首次出现时的引导横幅（可选） | 600×200，与 `round_banner_*.png` 同风格 |

### 7.4 已知 UI 联动改造点

1. **稀有度光环**：`mirror_magazine`、`element_injector`、`corridor_arc` 三档稀有度（rare / epic / epic）需要确保 `relic_aura_<tier>.png` 已正确按 rarity 字段分配。
2. **诅咒系遗物边框**：`chaos_burst` / `chaos_pact` / `greedy_wheel` 的 `rarity: 'cursed'` 需要走 `relic_aura_cursed.png`；如果当前 RELIC_AURA 仅有 C/B/A/S 四档，需补充 cursed 配色（建议黑红血纹）。
3. **存档兼容**：`chaosPactDamageMult` 已加入 `sys_saveRunState` / `sys_loadRunState`；旧存档读档时默认为 `1`，无破坏性。
4. **图标 emoji fallback**：所有 v2 遗物的 emoji 均已在 `RELIC_DB` 内定义，位图缺失时不会阻塞 UI。

---

## 8. V2 敌人基底 + 专属词条美术清单（2026-05-02）

> **来源**：[`design_spec_bitmap.md`](../design_spec_bitmap.md) §3.5 / §3.6、[`.cursor/rules/enemy_index.md`](../.cursor/rules/enemy_index.md) §0、敌人视觉设计 V2 文档。
>
> **范围**：本节集中**战斗内即时反馈**与**词条 UI Overlay**，敌人基底本体的 Sprite 帧规格请见 [`design_spec_bitmap.md`](../design_spec_bitmap.md) §3.5。
>
> **接入约定**：
> - V2 战斗反馈素材统一放至 `assets/ui/sprites/v2/`，命名 `kebab-case`，与 §7.2 风格一致。
> - 透明 PNG，`screen` / `lighter` 合成模式由调用方决定。
> - 落地时同步更新本表与 `design_spec_bitmap.md` §3.6。

### 8.1 P0 — 必备战斗反馈（影响词条可读性）

| 资产 | 用途 | 建议尺寸 | 接入位置 | 优先级原因 |
|---|---|---|---|---|
| `assets/ui/sprites/v2/ward_barrier_idle.png` | `deflectionWard` 屏障静态薄膜 | 256×128 | `Enemy.draw()` 屏障 alpha = `wardBarrier / wardBarrierMax × 0.85 + 0.1` | 玩家必须能看到屏障是否还在 |
| `assets/ui/sprites/v2/ward_barrier_break_0.png` ~ `_3.png` | 屏障击碎 4 帧 | 256×128 | `takeDamage` deflectionWard 分支击破时一次性播放 | 屏障被打破是关键打击反馈 |
| `assets/ui/sprites/v2/prism_refract_burst_0.png` ~ `_3.png` | 折光棱柱七色折射爆发 4 帧 | 128×128 | `combat_system.js` `hitType === 'prism'` 分支 | 表达激光被折射 |
| `assets/ui/sprites/v2/echo_relay_ring_0.png` ~ `_3.png` | 共振尖塔双重环形波 4 帧 | 160×160 | `Enemy._echoRelayRetrigger` 命中 ≥1 个目标时替代 `spawn_createShockwave` | 玩家需要识别哪个尖塔触发了 echo |
| `assets/ui/sprites/v2/gravity_field_0.png` ~ `_5.png` | 引力炉心扭曲场 6 帧 | 440×440 | 持续渲染于 sprite 下层，按 `gravityWellPullRadius/220` 缩放 alpha | 玩家必须看到引力影响范围才能预判弹道 |

### 8.2 P1 — 强化词条辨识与即时感

| 资产 | 用途 | 建议尺寸 | 接入位置 | 备注 |
|---|---|---|---|---|
| `assets/ui/sprites/v2/ward_barrier_label.png` | 屏障数字浮字"🔷-N"底板 | 64×24 | `spawn_createFloatingText` 屏障吸收数字时叠加 | 与 shield 浮字风格区分 |
| `assets/ui/sprites/v2/echo_relay_link.png` | 尖塔→被触发敌人脉冲连线 | 8×4，水平可平铺 | 对每个 echo 命中目标绘制 1 段，`screen` 合成 | 让玩家直观看到中继传导路径 |
| `assets/ui/sprites/v2/hive_larva_hatch_0.png` ~ `_5.png` | 孵化破壳光环 6 帧 | 96×96 | `Enemy._hiveSpawnLarva` 末尾、幼体生成位置 | 当前是简单粒子，升级为光环更直观 |
| `assets/ui/sprites/v2/siege_warning_strip.png` | 攻城重压前的黄黑警戒条 | 384×16，可平铺 | `_siegeCooldown <= 1` 时持续显示在履带前侧 | 给玩家"还有 1 回合就推进"的预警 |
| `assets/ui/sprites/v2/siege_push_dust_0.png` ~ `_2.png` | 攻城推进尘暴 3 帧 | 384×64 | `siege_push` 触发瞬间于履带底部 | 强调重压的物理冲击感 |
| `assets/ui/sprites/v2/gravity_bullet_pulled.png` | 子弹被引力捕获时的拖尾 | 16×16，4 帧 | `projectile.js` 引力分支检测到 `dist < pullR` 时按帧 spawn | 让玩家直观感受弹道偏折 |

### 8.3 P2 — 入场仪式感与图鉴美化

| 资产 | 用途 | 建议尺寸 | 接入位置 | 备注 |
|---|---|---|---|---|
| `assets/ui/sprites/v2/archetype_spawn_shockwave_blue.png` | 棱盾兽 / 重装入场冲击波（蓝灰系） | 256×256 | `spawn_trySpawnArchetypes` 末尾替代 `spawn_createShockwave('#94a3b8' / '#38bdf8')` | 颜色按 `chosen.color` 选 |
| `assets/ui/sprites/v2/archetype_spawn_shockwave_red.png` | 深渊胃囊入场（暗红系） | 256×256 | 同上，色 `#7f1d1d` | |
| `assets/ui/sprites/v2/archetype_spawn_shockwave_pink.png` | 共振尖塔入场（粉紫系） | 256×256 | 同上，色 `#f0abfc` | |
| `assets/ui/sprites/v2/archetype_spawn_shockwave_cyan.png` | 折光棱柱入场（青蓝系） | 256×256 | 同上，色 `#67e8f9` | |
| `assets/ui/sprites/v2/archetype_spawn_shockwave_lime.png` | 孵化巢入场（黄绿系） | 256×256 | 同上，色 `#a3e635` | |
| `assets/ui/sprites/v2/archetype_spawn_shockwave_gold.png` | 攻城履带入场（金黄系） | 256×256 | 同上，色 `#facc15` | |
| `assets/ui/sprites/v2/archetype_spawn_shockwave_purple.png` | 引力炉心入场（暗紫系） | 256×256 | 同上，色 `#7c3aed` | |
| `assets/ui/sprites/v2/codex_<archetype>_portrait.png` | 真理之书 V2 基底图鉴肖像（8 张） | 256×256 | 真理之书 enemies 分类，新增条目 | 与 §1.8 truth-book 联动 |

### 8.4 V2 基底 Sprite 本体（汇总，不在 P0/P1/P2 中重复）

> 本节给出快速汇总，**详细规格见 [`design_spec_bitmap.md`](../design_spec_bitmap.md) §3.5.1 / §3.5.2**。每个基底的 Sprite 必须按 `cols×128 × rows×128` 出图，**禁止等比缩放 1×1 sprite**。

| 基底 ID | 词条 | 占格 | Sprite 尺寸 | 文件命名前缀 | 状态 |
|---|---|---|---|---|---|
| `bastion`     | `heavyArmor`     | 3×1 | 384×128 | `enemy_bastion_*`     | 🟡 已有矢量、未出位图 |
| `deflector`   | `deflectionWard` | 2×1 | 256×128 | `enemy_deflector_*`   | ❌ 待生成 |
| `echoSpire`   | `echoRelay`      | 1×2 | 128×256 | `enemy_echo_spire_*`  | ❌ 待生成 |
| `maw`         | `devour`         | 2×2 | 256×256 | `enemy_maw_*`         | ❌ 待生成（既有 1×1 devour 矢量需重做） |
| `prism`       | `prism`          | 1×3 | 128×384 | `enemy_prism_*`       | ❌ 待生成 |
| `hive`        | `hive`           | 2×3 | 256×384 | `enemy_hive_*`        | ❌ 待生成 |
| `siege`       | `siege`          | 3×2 | 384×256 | `enemy_siege_*`       | ❌ 待生成 |
| `gravityWell` | `gravityWell`    | 3×3 | 384×384 | `enemy_gravity_well_*`| ❌ 待生成（稀有，可暂用矢量） |

### 8.5 与既有特效系统的复用关系

| 既有素材 | 在 V2 中的复用方式 | 备注 |
|---|---|---|
| `shield` 六边形护盾网格 | 在 `maw + shield` 组合下**禁用**，改用 `enemy_maw_membrane_overlay.png` | 避免胃囊外层出现冷色蜂窝感破坏有机质 |
| 现有 `regen` 绿色波纹 | 在多格基底上**按 cols×rows 缩放半径**，不能等比放大 | 防止视觉噪声扎堆 |
| 现有 `clone` 紫色分裂粒子 | `gravityWell` / `maw` / `hive` 不允许同时挂 `clone` | 已在 `spawn_trySpawnArchetypes` 候选表中限制；视觉无需特殊处理 |
| 现有 `haste` 残影 | 多格基底原则上不挂 `haste`，若被 `echoRelay` 触发，残影长度按基底尺寸 0.5× 缩短 | 避免大型敌人快速冲刺的不公平观感 |
| `assets/ui/sprites/wall_lightning_charge.png`（§7.2） | 引力炉心被远程子弹切入时可复用 | `gravityWell` 半径与墙撞击同色系 |

### 8.6 接入流程

1. **P0 优先**：先生成 §8.1 的 5 类反馈 PNG，**无需等基底 sprite 完成**——这些反馈即使叠在矢量基底上也能补足玩家可读性。
2. **P1 推进**：生成 §8.2，配合 [`src/render_system.js`](../src/render_system.js) 接入；同步勾掉本表对应行。
3. **P2 收尾**：基底入场冲击波 + 图鉴肖像。
4. **V2 基底 Sprite**：按 §8.4 优先级顺序出图，每完成一项，把行的 ❌ → 🟡 → ✅，并同步更新 [`design_spec_bitmap.md`](../design_spec_bitmap.md) §3.5.1 的对应行。
5. **维护责任**：本节由「敌人 / 战斗 Agent」与「美术 Agent」共同维护；**新增 V2 基底或词条时必须先在此处登记，再开始美术生产**，避免素材命名漂移。
