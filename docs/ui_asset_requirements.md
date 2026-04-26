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
| 1.1 | `#phase-title-container` | 启动标题 / 点击开始 | 🟡 | 文字 + Cinzel 字体 | 标题徽章 PNG、点击「开始按钮」金属底板 |
| 1.2 | `#phase-meta` | 局外元商店 / 升级树 | 🟡 | 顶部栏 9-Slice、卡片 9-Slice 边框 | **元商店分类标签 Tab Sprite**、**SP 货币图标**、升级卡片占位插画 |
| 1.3 | `#phase-rune-launcher` | 符文发射器主面板 | 🟡 | `rune_launcher_9s.png`、`rune_slot_idle.png`、`rune_slot_active.png` | Tab 切换按钮 Active/Idle、装弹动画帧 |
| 1.4 | `#phase-shop` | 局外商店（货架） | 🟡 | 卡片 9-Slice | **背景插画（炼金工房内景）**、商店物品分类图标、价格标签 |
| 1.5 | `#phase-selection` | 弹珠选择 / 子弹替换 / 命运时刻 | 🟡 | 卡片 9-Slice、属性图标（Emoji） | **整面背景**、卡片顶部的属性图标位（目前用 Emoji，需替换为位图）、稀有度光环装饰 |
| 1.6 | `#phase-gathering` | 研磨阶段（弹珠台） | 🟡 | `bg_main_canvas.png`、`bg_emitter_zone.png`、`emitter_base.png` | 底部「钉盘外框」装饰 |
| 1.7 | `#phase-combat` | 战斗阶段（无 DOM 主面板） | 🟡 | `bg_main_canvas.png`、`emitter_base.png` | 战场背景（按 Boss 类型变化的专属背景）、发射器顶部蓄力指示位图 |
| 1.8 | `#phase-truth-book` | 真理之书 / 图鉴 | 🟡 | `truth_book_bg_9s.png` | 章节侧标 Tab、属性卡片底板、Boss 头像位 |
| 1.9 | `#phase-relic` | 遗物选择 overlay | 🟡 | 遗物图标 PNG（已较完整）+ 卡片 9-Slice 边框 | **覆层背景纹理**（暗紫炼金阵）、稀有度光环、「跳过」按钮金属感 |
| 1.10 | `#phase-gameover` | 游戏结束/结算 | 🟡 | `gameover_bg.png` | 统计数据卡片 9-Slice、奖励发放动画图层 |
| 1.11 | `#phase-pause` | 暂停菜单 | ❌ | — | 半透明背景、菜单按钮 9-Slice |
| 1.12 | `#unified-top-bar` | 顶部状态栏 | ✅ | 9-Slice `top_bar_9s.png` | — |
| 1.13 | `.bottom-panel` | 底部弹药栏 | ✅ | 9-Slice `bottom_panel_9s.png` | — |
| 1.14 | `#settings-panel` | 设置弹窗 | 🟡 | `settings_modal_9s.png`、`toggle_on.png`、`toggle_off.png` | 滑条 Sprite、关闭按钮 |
| 1.15 | `#combat-rune-charge-ui` | 战斗中符文充能 UI | 🟡 | 符文 PNG | 充能槽底板（液体/能量条）、充能完成「升级」帧动画 |
| 1.16 | `#multiplier-display` | 连击倍率显示 | ✅ | `multiplier_x2.png`、`multiplier_x3.png`、`multiplier_x5.png` | — |
| 1.17 | `#skill-bar` | 战斗技能栏 | 🟡 | 技能图标 PNG、`rune_slot_idle.png`、`rune_slot_active.png` | 冷却扫描帧 |
| 1.18 | `#round-start-banner` | 回合开始横幅 | ✅ | `round_banner_1.png` ~ `round_banner_6.png`（6 帧，600×200） | — |
| 1.19 | 数据统计页（与图鉴并入 truth-book） | 历次伤害/记录 | ❌ | — | 折线图背景、数据指标徽章、最佳记录 ribbon |
| 1.20 | `.ammo-icon` 弹药槽位 | 战斗 / 收集阶段 | ✅ | `assets/icons/ammo/*.png` 已覆盖全部 12 种（含 matryoshka、rainbow、resonance、flying_sword、wind） | — |

---

## 2. 缺失素材分级清单（优先级排序）

### 2.1 P0 — 立刻影响游戏可玩性 / 风格统一性

| 资产 | 用途 | 建议尺寸 | 备注 |
|------|------|---------|------|
| ~~`assets/ui/backgrounds/bg_main_canvas.png`~~ | ✅ **已生成** | 720×1280 | 暗黑赛博炼金风，中部低对比区域 |
| ~~`assets/ui/backgrounds/bg_emitter_zone.png`~~ | ✅ **已生成** | 720×220 | 含炼金台基座、能量管路 |
| ~~`assets/ui/sprites/emitter_base.png`~~ | ✅ **已生成**（透明 PNG） | 96×96 | 静态贴图（带高光层） |
| `assets/ui/sprites/emitter_charging_*.png` | 蓄力 6 帧动画（待生成） | 96×96 | `_0.png` ~ `_5.png` |
| ~~`assets/icons/ammo/ammo_explosive.png`~~ | ✅ 已有 | 32×32 | 爆破弹药图标 |
| ~~`assets/icons/ammo/ammo_matryoshka.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 套娃弹药图标 |
| ~~`assets/icons/ammo/ammo_rainbow.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 七彩弹药图标 |
| ~~`assets/icons/ammo/ammo_resonance.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 共鸣弹药图标 |
| ~~`assets/icons/ammo/ammo_flying_sword.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 飞剑弹药图标 |
| ~~`assets/icons/ammo/ammo_wind.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | 风弹药图标 |

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

### 2.3 P2 — 锦上添花

| 资产 | 用途 | 建议尺寸 | 备注 |
|------|------|---------|------|
| ~~`assets/ui/sprites/multiplier_x2.png` ~ `x5.png`~~ | ✅ **已生成**（透明 PNG） | 96×48 | 三档稀有度配色 |
| ~~`assets/ui/panels/gameover_bg.png`~~ | ✅ **已生成** | 720×1280 | 双联画构图 |
| `assets/ui/sprites/relic_aura_*.png` | 遗物稀有度光环（待生成） | 200×200 | 4 档稀有度 |
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
