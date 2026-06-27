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
| 透明资产生成 | prompt 阶段使用纯绿幕/chroma key 背景，不要求模型直接生成透明底；运行时透明 PNG 由本地抠图脚本后处理得到 |

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
| 1.6 | `#phase-gathering` | 研磨阶段（弹珠台） | 🟡 | `bg_main_canvas.png`、`bg_emitter_zone.png`、`emitter_base.png`；三弹珠子弹面板 `gathering_ammo_panel_9s.png` + `gathering_charge_track/fill.png` 已通过 `src/styles/bitmap_ui.css` 接入 | 底部「钉盘外框」装饰 |
| 1.7 | `#phase-combat` | 战斗阶段（无 DOM 主面板） | ✅ | `bg_combat_table_v2.png`、`bg_combat_emitter_zone_v2.png`、`combat_wall_left/right/top_v2.png`、`combat_defeat_line_v2.png`、`emitter_base_v3.png`、`emitter_barrel_rotating_v4_runtime.png`、`emitter_charging_v3_0~5.png`、`ammo_queue_panel_9s.png`、`ammo_queue_slot.png`、`speed_btn_x1/x2/x3/xslow.png` | 底座保留 V3；后续仅替换缺口明确的 runtime 占位资产 |
| 1.8 | `#phase-truth-book` | 真理之书 / 图鉴 | 🟡 | `truth_book_bg_9s.png`（已接入背景） | 章节侧标 Tab、属性卡片底板、Boss 头像位 |
| 1.9 | `#phase-relic` | 遗物选择 overlay | ✅ | `relic_overlay_bg.png`、`skip_btn_metal.png` + 已有遗物图标/9-Slice 边框（**已移除**旋转圆形稀有度光环） | — |
| 1.10 | `#phase-gameover` | 游戏结束/结算 | 🟡 | `gameover_bg.png`（已接入） | 统计数据卡片 9-Slice、奖励发放动画图层 |
| 1.11 | `#phase-pause` | 暂停菜单 | ❌ | — | 半透明背景、菜单按钮 9-Slice |
| 1.12 | `#unified-top-bar` | 顶部状态栏 | ✅ | 9-Slice `top_bar_9s.png` | — |
| 1.13 | `.bottom-panel` | 底部弹药栏 | ✅ | 9-Slice `bottom_panel_9s.png` | — |
| 1.14 | `#settings-panel` | 设置弹窗 | 🟡 | `settings_modal_9s.png`、`toggle_on.png`、`toggle_off.png` | 滑条 Sprite、关闭按钮 |
| 1.15 | `#combat-rune-charge-ui` | 战斗中技能充能 UI | ✅ | `skill_charge_panel_9s.png`、`skill_charge_actual_fill.png`、`skill_charge_temp_fill.png`、`skill_charge_crystal_empty/full.png`、`skill_charge_burst.png` | — |
| 1.16 | `#multiplier-display` | 连击倍率显示 | ✅ | `multiplier_x2.png`、`multiplier_x3.png`、`multiplier_x5.png` | — |
| 1.17 | `#skill-bar` | 战斗技能栏 | 🟡 | 技能图标 PNG、`skill_bar_panel_9s.png`、`skill_button_frame_9s.png`、`skill_cooldown_overlay.png` | V2 技能栏底板需按绿幕流程重做 |
| 1.18 | `#round-start-banner` | 回合开始横幅 / 下一 Boss 威胁预告 | 🟡 | `round_title_panel_9s.png`（主标题牌）、`round_banner_1.png` ~ `round_banner_6.png`（旧通用帧，保留兼容）、`round_threat_plate_9s.png`、8 个 Boss 预告小像/顶栏小图标、未知 Boss 封印剪影 | 状态化 `round_toast_<state>_*.png` 横幅、危险威胁槽与高危边框待生成；契约见 [`docs/design/round_start_boss_toast_asset_contract.md`](design/round_start_boss_toast_asset_contract.md) |
| 1.19 | 数据统计页（与图鉴并入 truth-book） | 历次伤害/记录 | ❌ | — | 折线图背景、数据指标徽章、最佳记录 ribbon |
| 1.20 | `.ammo-icon` 弹药槽位 | 战斗 / 收集阶段 | ✅ | `assets/icons/ammo/*.png` 已覆盖原有 12 种及 `venom` / `overcharge` / `echo`（含 matryoshka、rainbow、resonance、flying_sword、wind） | - |
| 1.21 | 发射器属性球轨道（Canvas 渲染层） | 已退役；战斗发射器数据改写入 V3 底座贴图槽位，发射反馈改为炮管方向闪光 | 🟡 | 旧 `orbital_*` 资源保留为历史素材但不再预加载/绘制 | 若未来恢复，需按新发射器静态底座/旋转炮管分层重做 |

---

## 2. 缺失素材分级清单（优先级排序）

### 2.1 P0 — 立刻影响游戏可玩性 / 风格统一性

| 资产 | 用途 | 建议尺寸 | 备注 |
|------|------|---------|------|
| ~~`assets/ui/backgrounds/bg_main_canvas.png`~~ | ✅ **已生成** | 720×1280 | 暗黑赛博炼金风，中部低对比区域 |
| ~~`assets/ui/backgrounds/bg_emitter_zone.png`~~ | ✅ **已生成** | 720×220 | 含炼金台基座、能量管路 |
| ~~`assets/ui/sprites/emitter_base.png`~~ | ✅ **已生成**（透明 PNG） | 96×96 | 静态贴图（带高光层） |
| ~~`assets/ui/sprites/emitter_charging_*.png`~~ | ✅ **已生成**（透明 PNG） | 96×96 | `_0.png` ~ `_5.png`，0%→100% 蓄力渐进，纯色底 + rembg 抠图 |
| ~~`assets/ui/sprites/emitter_base_v3.png`~~ | ✅ **已生成**（透明 PNG） | 256×256 | 战斗底部发射器 V3：内置显示屏、电容柱、中央弹丸舱、6 个弹仓 |
| ~~`assets/ui/sprites/emitter_charging_v3_*.png`~~ | ✅ **已生成**（透明 PNG） | 256×256 | `_0.png` ~ `_5.png`，与 V3 底图对齐的透明能量叠加层 |
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
| ~~`assets/ui/banners/round_banner_*.png`~~ | ✅ **已生成**（6 帧） | 600×200 | 通用回合横幅底图；只能作为 L0 临时底图，不能覆盖 Boss 预告小像需求 |
| ~~`assets/ui/banners/round_title_panel_9s.png`~~ | ✅ **已生成并接入** | 600×200 | 回合 Toast 主标题牌，承载 DOM 文本“第 X 回合开始”；`roundBannerBitmapPulse` 不再切回旧 `round_banner_*.png` |
| ~~`assets/ui/banners/round_threat_plate_9s.png`~~ | ✅ **已生成并接入** | 420×72，slice 18~24 | 暗金/黑曜石小牌，不烘焙文字；详见 [`round_start_boss_toast_asset_contract.md`](design/round_start_boss_toast_asset_contract.md) |
| `assets/ui/banners/round_toast_<state>_1.png` ~ `_6.png` | normal/countdown/soon/now 四类回合 Toast 状态横幅 | 600×200 | 可分批生成；首批可继续复用 `round_banner_*.png`，优先补威胁槽与 Boss 小像 |
| ~~`assets/ui/icons/boss_preview/boss_unknown_seal.png` / `_tiny.png`~~ | ✅ **已生成并接入** | 96×96 / 32×32 | 替换当前 CSS 几何剪影；未知状态不得泄露具体 Boss 外形 |
| ~~`assets/ui/icons/boss_preview/boss_<bossId>_preview.png` / `_tiny.png`~~ | ✅ **已生成并接入** | 96×96 / 32×32 | Boss ID：`ignis/glacies/mikro/devourer/viridis/tesla/chimera/ouroboros`；与 Boss 本体重绘风格一致 |
| ~~`assets/ui/icons/enemy_affixes/affix_energyArmor.png` / `affix_phaseShield.png` / `affix_livingArmor.png`~~ | ✅ 已生成：敌人头顶防御 HUD 图标 | 1248×1248 源图，HUD 缩放使用 | 蓄能甲、相位护盾、活体护甲的 HUD 专用高质位图；仅用于 `_drawDefenseHudBadges()`，不要复用大尺寸敌人 Overlay |
| ~~`assets/ui/icons/enemy_affixes/affix_berserk.png` / `affix_haste.png` / `affix_healer.png` / `affix_clone.png` / `affix_jump.png`~~ | ✅ 已低饱和返工并接入 | 256×256 透明 PNG，UI 缩放使用 | 高频行动/基础词条图标；暗金/黑曜石盘面 + 克制机制色，行动预告、图鉴、试炼场词缀 chip、敌人信息抽屉共用 |
| ~~`assets/ui/icons/enemy_affixes/affix_lowDamageImmune.png` / `affix_deflectShell.png` / `affix_armorSpore.png` / `affix_siegeBreaker.png` / `affix_overloadReactor.png`~~ | ✅ 已低饱和返工并接入 | 256×256 透明 PNG，UI 缩放使用 | 敌人针对词缀图标；从既有 overlay / 组合图提炼，已登记 `ENEMY_AFFIX_ICON_MAP` 与 manifest，避免高饱和大色块 |
| ~~`assets/ui/sprites/orbital_link_flow_*.png`~~ | ✅ **已生成**（透明 PNG） | 8×8 | `_0.png` ~ `_3.png`，循环 |
| ~~`assets/ui/sprites/orbital_intake_*.png`~~ | ✅ **已生成**（透明 PNG） | 32×32 | `_0.png` ~ `_3.png`；吸入轨迹粒子 |
| ~~`assets/ui/panels/replace_ammo_bg.png`~~ | ✅ **已生成** | 720×1280 | 炼金工坊促視构图，中部低对比区域 |
| ~~`assets/ui/sprites/replace_card_frame_<tier>_9s.png`~~ | ✅ **已生成**（透明 PNG） | 192×260，slice 24 | C/B/A/S 四档卡片边框 |
| ~~`assets/ui/sprites/replace_card_attr_slot.png`~~ | ✅ **已生成**（透明 PNG） | 56×56 | 属性 icon 圆形底座 |
| ~~`assets/ui/panels/gathering_ammo_panel_9s.png`~~ | ✅ **已生成并接入**：研磨阶段三弹珠子弹面板底板 | 180×140，slice 24 | 暗色炼金金属小面板，顶部预留横向充能槽，主体预留弹珠球与属性 chip；文字仍由 DOM 渲染 |
| ~~`assets/ui/sprites/gathering_charge_track.png` / `_fill.png`~~ | ✅ **已生成并接入**：研磨子弹面板顶部充能槽 | 128×12 | 轨道与填充可横向拉伸；通过 `src/styles/bitmap_ui.css` 覆盖 `.gathering-ammo-charge` 与 `.gathering-ammo-charge-fill` |
| ~~`assets/ui/panels/relic_overlay_bg.png`~~ | ✅ **已生成** | 720×1280 | 暗紫炼金阵纹理 |
| ~~`assets/ui/sprites/skip_btn_metal.png`~~ | ✅ **已生成**（透明 PNG） | 128×40 | 金属底板按钮 |
| ~~`assets/ui/panels/rune_grid_bg_9s.png`~~ | ✅ **已生成** | 320×320，slice 32 | 九宫格容器，含九格分隔线纹理 |
| ~~`assets/ui/sprites/rune_slot_hover.png` / `rune_slot_filled.png`~~ | ✅ **已生成**（透明 PNG） | 64×64 | 覆盖完整 4 态交互 |
| ~~`assets/ui/sprites/rune_slot_highlight.png`~~ | ✅ **已生成**（透明 PNG） | 96×96 | 放置确认光圈 |
| ~~`assets/icons/ammo/ammo_venom.png`~~ | ✅ 已生成 | 32×32 | 毒绿色液滴 + 骷髅纹，对应 `AMMO_ICON_MAP.venom` |
| ~~`assets/icons/ammo/ammo_overcharge.png`~~ | ✅ 已生成 | 32×32 | 金橙色能量弹 + 充能电弧纹，对应 `AMMO_ICON_MAP.overcharge` |
| ~~`assets/icons/ammo/ammo_echo.png`~~ | ✅ 已生成 | 32×32 | 蓝紫色残影环绕弹，对应 `AMMO_ICON_MAP.echo` |
| ~~`assets/icons/rune/rune_venom_1.png`~~ | ✅ 已生成 | 48×48 | 毒液纹路，rare 蓝色外框 |
| ~~`assets/icons/rune/rune_venom_2.png`~~ | ✅ 已生成 | 48×48 | 毒液纹路加强，epic 紫色外框 |
| ~~`assets/icons/rune/rune_overcharge_1.png`~~ | ✅ 已生成 | 48×48 | 充能纹路，epic 紫色外框 |
| ~~`assets/icons/rune/rune_echo_1.png`~~ | ✅ 已生成 | 48×48 | 残影环绕纹路，rare 蓝色外框 |

### 2.3 P2 — 锦上添花

| 资产 | 用途 | 建议尺寸 | 备注 |
|------|------|---------|------|
| ~~`assets/ui/sprites/multiplier_x2.png` ~ `x5.png`~~ | ✅ **已生成**（透明 PNG） | 96×48 | 三档稀有度配色 |
| ~~`assets/ui/panels/gameover_bg.png`~~ | ✅ **已生成** | 720×1280 | 双联画构图 |
| ~~`assets/ui/sprites/relic_aura_*.png`~~ | ✅ **已生成**（透明 PNG） | 200×200 | C/B/A/S 四档稀有度光环 |
| ~~`assets/ui/sprites/loot_relic_capsule.png`~~ / ~~`loot_essence_chaos_capsule.png`~~ / ~~`loot_essence_pure_capsule.png`~~ | ✅ **已生成**（透明 PNG） | 256×256 | 战场持久掉落物与飞卡动画共用外壳；中心继续复用 `RELIC_ICON_MAP` 图标，low 档不新增粒子预算 |
| ~~`assets/ui/sprites/skill_cooldown_overlay.png`~~ | ✅ **已生成** | 64×64 | 遮罩/扫光层 |
| ~~`assets/ui/sprites/skill_charge_panel_9s.png`~~ | ✅ **已生成** | 288×84，slice 32 | SP 充能仪表九宫格面板，替代旧符文充能框 |
| ~~`assets/ui/sprites/skill_charge_actual_fill.png`~~ | ✅ **已生成** | 192×12 | 单条总充能的青绿色底纹；实际段即未被衰减 overlay 覆盖的部分 |
| ~~`assets/ui/sprites/skill_charge_temp_fill.png`~~ | ✅ **已生成** | 192×12 | 条内临时衰减段的半透明琥珀 overlay，不作为第二根进度条 |
| ~~`assets/ui/sprites/skill_charge_crystal_empty.png`~~ / ~~`skill_charge_crystal_full.png`~~ | ✅ **已生成** | 64×64 | SP 晶体槽空/满状态 |
| ~~`assets/ui/sprites/skill_charge_burst.png`~~ | ✅ **已生成** | 320×108 | 满充发放 SP 时的位图光爆 overlay |

---

## 3. 接入流程与 Agent 协作

1. **新增素材**：放到上表指定路径，提供 `_raw.png`（无切片源图）+ 成品（`.png` 或 `_9s.png`）。
2. **CSS 注入**：在 [`src/styles/bitmap_ui.css`](../src/styles/bitmap_ui.css) 新增对应规则（不要内嵌 `<style>`），保持每个 selector 与本文档表格 ID 一一对应注释（例如 `/* §1.14 settings_panel */`）。
3. **JS 接入**（如图标）：通过 [`src/bitmap_icons.js`](../src/bitmap_icons.js) 的 `getXxxIconSrc()` 函数集中映射，禁止散落 `new Image()`。
4. **同步更新本表**：每次替换素材，把对应行的「美术状态」列从 ❌ → 🟡 → ✅，并把缺失素材列勾掉。
5. **回写到设计规格**：本文档为「现状视图」，长期规格依然以 [`design_spec_bitmap.md`](../design_spec_bitmap.md) 为准；如新增页面，请同时更新该文档 §2。

---

## 4. 已知不一致项（需在 art pass 中解决）

- 2026-06-25 巡检：`#phase-selection` 卡片顶部属性图标已通过 `assets/ui/sprites/attribute_icons/*.png` 和 `replace_card_attr_slot.png` 接入；后续新增属性时只需同步补 `ATTRIBUTE_ICON_MAP` 与 `attribute_icons/`。
- 2026-06-25 巡检：`#phase-rune-launcher` 已通过 `rune_launcher_9s.png`、`rune_grid_bg_9s.png` 与符文槽位 Sprite 接入，不再视为“完全无背景”缺口。
- `#combat-rune-charge-ui` 已在 2026-06-23 改为技能充能仪表，旧 `combat_rune_charge_*` 仅作为历史素材保留；现行资源为 `skill_charge_*` 系列，并通过 `src/styles/bitmap_ui.css` 接入。
- 2026-06-25 巡检：`assets/icons/rune/` 已覆盖 `RUNE_DB` 17/17；遗物侧仍有 14 个 `RELIC_DB` ID 未进入 `RELIC_ICON_MAP`，本轮已补 `guardian_barrier` / `fate_reroll_token` / `relic_reroll_seal` / `hunter_instinct` / `rune_resonance_core` / `doomsday_timer`，并已覆盖遗物选择、商店、掉落飞卡和暂停页当前遗物列表，详见 [`asset_gap_index.md`](asset_gap_index.md) §3。
- 2026-06-25 巡检：`top_bar_panel.png` 已不存在，当前仅保留 `top_bar_9s.png`；该命名混乱项已收口。

---

## 5. 文档索引

- 视觉规格根：[`design_spec_bitmap.md`](../design_spec_bitmap.md)
- 美术资产生成规范：[`docs/art_asset_generation_guidelines.md`](art_asset_generation_guidelines.md)
- 当前资产缺口与生成排期：[`docs/asset_gap_index.md`](asset_gap_index.md)
- 位图样式接入：[`src/styles/bitmap_ui.css`](../src/styles/bitmap_ui.css)
- 图标映射模块：[`src/bitmap_icons.js`](../src/bitmap_icons.js)
- UI 系统模块：[`src/ui_system.js`](../src/ui_system.js)、[`src/ui/`](../src/ui/)
- 战斗场地与 UI 重绘设计：[`docs/design/combat_battlefield_ui_asset_redesign.md`](design/combat_battlefield_ui_asset_redesign.md)
- P0 交互优化 TODO：[`docs/p0_interaction_optimization_todo.md`](./p0_interaction_optimization_todo.md)
- 全局规范：[`AGENTS.md`](../AGENTS.md) §1

---

## 6. 深度模块拆解（高频重点 UI 的素材方案）

> 本节针对 §1 表中标 🟡/❌ 且属于战斗高频可见的模块，给出更细的素材结构、动画方案与「自然衔接」的实现路径。新增素材时按 §6.x 注明的接入函数对应。

### 6.1 发射器属性球轨道（对应 §1.21）

> 2026-06-23 状态：该运行时模块已退役。`render_combat_launcherOrbitals()` 不再绘制，`src/bitmap_icons.js` 也不再预加载 `orbital_*` 资源；下一发数据改由 `render_combat_launcherSignal()` 写入 V3 发射器底座贴图的左屏、中央弹仓、右侧电容柱和底部弹药槽。旧资产条目仅作为历史素材参考。

**当前实现**
- 渲染入口：已从战斗主渲染链路移除；发射器数据入口改为 [`src/render_system.js`](../src/render_system.js) `render_combat_launcherSignal(ctx, cx, cy, portX, portY, recipe, visual)`
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

> 设计来源：[`docs/relic_system_design.md`](relic_system_design.md) §5。本节列出 v2 新增/修改遗物及后续战斗构筑遗物对应的 UI 与美术资产需求，按 P0/P1/P2 优先级分级。
>
> **接入路径**：所有遗物图标统一放至 `assets/icons/relic/<id>.png`，并在 [`src/bitmap_icons.js`](../src/bitmap_icons.js) 的 `RELIC_ICON_MAP` 中注册映射，命中后自动取代 `RELIC_DB[i].icon` 的 emoji fallback。

### 7.1 P0 — 遗物图标位图（必须完成）

| 遗物 ID | 名称 | 占位 emoji | 图标尺寸 | 视觉建议 |
|---|---|---|---|---|
| `rune_siphon` | 技能虹吸管 | 〽️ | 64×64 | 细长玻璃虹吸管抽取青蓝技能能量，底部有小型炼金阀门 |
| `ammo_bandolier` | 炼金弹带 | 🎞️ | 64×64 | 皮革弹带挂满发光弹珠，金属扣环，legendary 金边 |
| `opening_salvo` | 开幕齐射管 | 📯 | 64×64 | 黄铜多管发射器向外齐射，带橙金 muzzle flash |
| `thunder_coil` | 雷暴线圈 | ⚡ | 64×64 | 铜制线圈缠绕蓝紫电弧，中心有可导流的闪电子弹 |
| `ember_fuse` | 余烬保险丝 | 🧨 | 64×64 | 半熔断保险丝与炽热余烬核心，边缘带小型火花 |
| `hunter_instinct` | 猎人本能 | 🎯 | 64×64 | ✅ 已生成：金色爪形准星 + 青色扫描环 + 橙色弱点核心 |
| `rune_resonance_core` | 技能共鸣核 | 💠 | 64×64 | ✅ 已生成：紫青技能结晶核心 + 金属外环 + 共鸣节点 |
| `mirror_magazine` | 镜像弹夹 | 🪞 | 64×64 | 双子弹折射镜面，左右对称构图 |
| `doomsday_timer` | 末日计时器 | ⏱️ | 64×64 | ✅ 已生成：黑金沙漏/爆弹轮廓 + 红色倒计时核心 |
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
## 7. 2026-06-19 Rune Launcher V2 Assets

- `#phase-rune-launcher` now has a V2 bitmap set designed for the denser configuration / management / codex UI:
  - `assets/ui/panels/rune_launcher_v2_raw.png`
  - `assets/ui/panels/rune_launcher_v2_9s.png`
  - `assets/ui/panels/rune_grid_v2_raw.png`
  - `assets/ui/panels/rune_grid_v2_9s.png`
  - `assets/ui/sprites/rune_info_plate_v2_raw.png`
  - `assets/ui/sprites/rune_info_plate_v2_9s.png`
- The V2 rules live in `src/styles/bitmap_ui.css` under `2026-06-19 Rune Launcher V2`; old rune slot sprites remain in use for the individual 3x3 cells.
## 8. 2026-06-19 Combat Bottom Emitter V2 Assets

- `#phase-combat` bottom bullet launcher now uses a V2 Canvas sprite set:
  - `assets/ui/sprites/emitter_base_v2_raw.png`
  - `assets/ui/sprites/emitter_base_v2_alpha_raw.png`
  - `assets/ui/sprites/emitter_base_v2.png`
  - `assets/ui/sprites/emitter_charge_v2_raw.png`
  - `assets/ui/sprites/emitter_charge_v2_alpha_raw.png`
  - `assets/ui/sprites/emitter_charge_v2.png`
  - `assets/ui/sprites/emitter_charging_v2_0.png` through `emitter_charging_v2_5.png`
- Runtime mapping lives in `src/bitmap_icons.js` via `EMITTER_BASE_SRC`, `EMITTER_CHARGING_SRCS`, `EMITTER_DRAW_SIZE`, and `EMITTER_PORT_OFFSET_Y`.
- Rendering remains a bitmap-sprite replacement path in `render_combat_launcherEmitterBase()`; no new particle system or gradient loop was added.
- 2026-06-19 V2.2 readout pass: `render_combat_launcherSignal()` now presents the next-shot preview as a centered launcher HUD: a visible bullet body with reused ammo icon core, `DMG` damage chip, scatter count (`S`), multicast count (`xN`) plus burst columns, and colored load cells. 2026-06-23 slot-alignment pass removes the top muzzle/fire-point overlay, places `S` inside the left display, retires the old rotating orbital/link layer, and keeps the projectile spawn anchor at the turret rotation center. No new bitmap asset is required; the core reuses `AMMO_ICON_MAP`.

## 9. 2026-06-19 Combat Bottom Emitter V3 Assets

- `#phase-combat` bottom bullet launcher now uses a regenerated V3 art base with the UI readout spaces painted into the device:
  - `assets/ui/sprites/emitter_base_v3_alpha_raw.png`
  - `assets/ui/sprites/emitter_base_v3.png`
  - `assets/ui/sprites/emitter_charging_v3_0.png` through `emitter_charging_v3_5.png`
- V3 art reserves a central projectile chamber, left electronic display frame, right capacitor stack, and six lower ammo sockets so runtime damage/scatter/multicast/load data can read as part of the launcher body; the upper muzzle/fire point is reserved for the actual projectile anchor and no longer carries extra readout UI.
- Runtime mapping remains in `src/bitmap_icons.js`; `render_combat_launcherSignal()` continues to draw fixed-count Canvas readouts over the bitmap with low-quality glow disabled. Current visible base UI: left damage/scatter screen, central projectile chamber, right multicast capacitor stack, and six bottom load sockets. Per-shot fire feedback is drawn by `render_queueLauncherBarrelFireEffect()` / `render_combat_launcherEmitterBase()` as a short barrel-direction flash.
## 10. 2026-06-23 Combat Bottom Emitter V4 Split Assets

- 2026-06-23 correction: the first V4 split runtime files were removed from active runtime use because they were derived from non-chroma-key transparent/checkerboard prompts. They now live under `docs/design/concepts/combat_ui_pass1/rejected_chroma_key_required/` as rejection references.
- `#phase-combat` bottom bullet launcher currently uses the stable V3 Canvas sprite set again:
  - `assets/ui/sprites/emitter_base_v3.png`
  - `assets/ui/sprites/emitter_barrel_rotating_v4_runtime.png`（从 V4 炮管概念裁切出的窄炮管层；底座 UI 仍固定在 V3 贴图上）
  - `assets/ui/sprites/emitter_charging_v3_0.png` through `emitter_charging_v3_5.png`
- V4 still remains the target architecture, but the following files must be regenerated from green-screen/chroma-key source before returning to `assets/ui/sprites/`:
  - `assets/ui/sprites/emitter_base_stationary_v4_alpha_raw.png`
  - `assets/ui/sprites/emitter_base_stationary_v4.png`
  - `assets/ui/sprites/emitter_barrel_rotating_v4_alpha_raw.png`
  - `assets/ui/sprites/emitter_barrel_rotating_v4.png`
  - `assets/ui/sprites/emitter_charging_v4_0.png` through `emitter_charging_v4_5.png`
- Runtime split keeps the approved `emitter_base_v3.png` as the stationary base/readout body; only the current runtime barrel layer is drawn as an independent rotating layer.
- Runtime mapping in `src/bitmap_icons.js` uses `EMITTER_BASE_SRC = emitter_base_v3.png`, `EMITTER_BARREL_SRC = emitter_barrel_rotating_v5_runtime.png`, and V3 charging frames until full green-screen replacement assets are available.
- Rendering uses the optional split barrel path in `render_combat_launcherEmitterBase()` so only the narrow barrel layer rotates; the V3 base/readout UI remains fixed. The launcher holds the last shot angle briefly after a real projectile spawn before slowly returning to neutral.
- Split-layer runtime preview lives at `docs/design/concepts/combat_ui_pass1/emitter_v4_split_runtime_preview.png`; it verifies that the base/readout UI stays fixed while only the barrel rotates.

## 11. 2026-06-23 Combat Battlefield V2 Runtime Assets

- `#phase-combat` keeps the combat-specific Canvas background layers because they are full-frame backgrounds and do not depend on transparent generation:
  - `assets/ui/backgrounds/bg_combat_table_v2.png`
  - `assets/ui/backgrounds/bg_combat_emitter_zone_v2.png`
- 2026-06-24 correction: wall runtime files are active again and must be shipped with the current `src/bitmap_icons.js` mapping:
  - `assets/ui/sprites/combat_wall_left_v2.png`
  - `assets/ui/sprites/combat_wall_right_v2.png`
  - `assets/ui/sprites/combat_wall_top_v2.png`
- `combat_status_panel_v2_9s.png`、`skill_bar_panel_v2_9s.png`、`combat_rune_charge_frame_v2_9s.png` 仍不在当前运行时映射内，后续若重接入需走绿幕/chroma key 资产验收。
- Runtime mapping uses `BG_COMBAT_TABLE_SRC`、`BG_COMBAT_EMITTER_ZONE_SRC` and `COMBAT_WALL_*_SRC`; `render_combat_walls()` only falls back to the old gradient wall when these image assets are missing or not yet loaded.
- Runtime asset preview lives at `docs/design/concepts/combat_ui_pass1/combat_ui_runtime_v2_asset_preview.png`.
## 2026-06-22 新增属性符文素材状态

`rune_venom_1.png`、`rune_venom_2.png`、`rune_overcharge_1.png`、`rune_echo_1.png` 已存在于 `assets/icons/rune/`，并由 `src/bitmap_icons.js` 的 `RUNE_ICON_MAP` 引用。当前 `BITMAP_ASSET_VERSION` 为 `20260623-combat-v2`，覆盖本轮战斗场地与此前符文属性图标缓存刷新。

## 12. 2026-06-23 Combat Battlefield UI Redesign

战斗阶段进入新一轮美术重绘设计，目标不是补缺，而是统一 `#phase-combat` 的场地、墙体、HUD 面板和战斗常驻图标语言。权威设计案见 [`docs/design/combat_battlefield_ui_asset_redesign.md`](design/combat_battlefield_ui_asset_redesign.md)。

首轮只生成概念预览，正式接入前不得覆盖现有运行时资产：

- `docs/design/concepts/combat_ui_pass1/combat_ui_pass1_contact_sheet.png`
- `docs/design/concepts/combat_ui_pass1/bg_combat_table_v2_concept.png`
- `docs/design/concepts/combat_ui_pass1/bg_combat_emitter_zone_v2_concept.png`
- `docs/design/concepts/combat_ui_pass1/combat_wall_left_v2_concept.png`
- `docs/design/concepts/combat_ui_pass1/combat_wall_top_v2_concept.png`
- `docs/design/concepts/combat_ui_pass1/combat_status_panel_v2_concept.png`
- `docs/design/concepts/combat_ui_pass1/skill_bar_panel_v2_concept.png`
- `docs/design/concepts/combat_ui_pass1/combat_rune_charge_frame_v2_concept.png`
- `docs/design/concepts/combat_ui_pass1/emitter_v4_concept.png`
- `docs/design/concepts/combat_ui_pass1/emitter_base_stationary_v4_concept.png`
- `docs/design/concepts/combat_ui_pass1/emitter_barrel_rotating_v4_concept.png`
- `docs/design/concepts/combat_ui_pass1/emitter_v4_split_runtime_preview.png`

正式资源若进入运行时目录，建议使用 `_v2` / `_v4` 后缀非破坏式接入，并同步更新本清单、`src/bitmap_icons.js` 或 `src/styles/bitmap_ui.css` 中的集中映射。
当前概念图仅用于风格评审，部分透明区域为烘焙棋盘格而非真实 alpha；后续正式生成不得在 prompt 中要求透明底，必须使用纯绿幕/chroma key 背景，再做本地抠图处理。
发射器后续正式重绘若替换底座，必须先证明 128px 运行尺寸下优于 `emitter_base_v3.png`；运行时当前只要求炮管独立为 `emitter_barrel_rotating_v4_runtime.png` 并随发射方向旋转，数据 UI、弹仓和读数框继续保留在 V3 底座上。

## 13. 2026-06-24 Combat Console V2 Operation Table Plan

战斗底部 UI 已进入“操作台资产”设计阶段，权威拆分见 [`docs/design/combat_console_v2_asset_plan.md`](design/combat_console_v2_asset_plan.md)，移动端蓝图见 [`docs/design/concepts/combat_console_v2_asset_blueprint.svg`](design/concepts/combat_console_v2_asset_blueprint.svg)。

首批待生成资产：

- `assets/ui/panels/combat_console_left_wing_9s.png`
- `assets/ui/panels/combat_console_right_wing_9s.png`
- `assets/ui/panels/merchant_journey_topbar_9s.png`
- `assets/ui/sprites/skill_sp_gem_empty.png`
- `assets/ui/sprites/skill_sp_gem_full.png`
- `assets/ui/panels/combat_current_ammo_slot_9s.png`
- `assets/ui/sprites/combat_ammo_queue_chip.png`
- `assets/ui/panels/combat_skill_button_frame_9s.png`
- `assets/ui/sprites/rune_config_socket_button.png`

接入前约束：

- 390px 宽下左翼和右翼不得进入 132px 中央发射器井。
- 运行时仍以 `#combat-bottom-dock` 的 96px 高度为上限，不能抬高到底部警戒线可视带之上。
- 顶部商人旅程只能作为 `#unified-top-bar` 内的紧凑状态，不得遮挡敌人出生区。
- 正式透明 PNG 进入运行目录前必须来自绿幕/chroma key 源图；概念图不得直接覆盖运行时资产。

Pass 1 概念图已生成，全部仅作评审参考：

- `docs/design/concepts/combat_console_v2_pass1/combat_console_v2_contact_sheet_concept.png`
- `docs/design/concepts/combat_console_v2_pass1/combat_console_side_wings_raw_concept.png`
- `docs/design/concepts/combat_console_v2_pass1/merchant_journey_topbar_raw_concept.png`
- `docs/design/concepts/combat_console_v2_pass1/skill_sp_gem_states_raw_concept.png`

2026-06-24 选型更新：技能点宝石锁定为 `skill_sp_gem_states_raw_concept.png` 第 2 列狭长六边形，已裁出透明候选：

- `docs/design/concepts/combat_console_v2_pass1/extracted/skill_sp_gem_hex_empty_candidate.png`
- `docs/design/concepts/combat_console_v2_pass1/extracted/skill_sp_gem_hex_full_candidate.png`
- `docs/design/concepts/combat_console_v2_pass1/extracted/skill_sp_gem_hex_readability_sheet.png`

Pass 2 综合概念图：

- `docs/design/concepts/combat_console_v2_pass2/combat_console_v2_integrated_mockup_hex_gems.png`
- `docs/design/concepts/combat_console_v2_pass2/combat_console_v2_390_candidate_preview.png`

390px 拆件预览结论：中间发射器井未被覆盖，SP 狭长六边形宝石可读；但 Pass 1/Pass 3 侧翼源图偏横条，非等比压入 119x88 后会产生明显压缩感，因此旧预览仅作为反例，不得作为正式切图依据。正式左右翼源尺寸从 360x192 修正为 360x264，以贴近 119x88 运行时比例。

移动端触控修正：所有可点击目标最小热区为 40x40。右侧技能区最多展示 2x2 个 40x40 技能按钮；SP 宝石和技能充能均为非点击边框信息。符文配置不得继续使用 20x18 小按钮，需要移到左翼或另设 40x40 热区。

Pass 4 触控/比例修正版：

- `docs/design/concepts/combat_console_v2_pass4/combat_console_left_touch_target_candidate.png`
- `docs/design/concepts/combat_console_v2_pass4/combat_console_right_touch_target_wide_candidate.png`
- `docs/design/concepts/combat_console_v2_pass4/combat_console_v2_390_touch_target_art_preview.png`
- `docs/design/concepts/combat_console_v2_pass4/combat_console_v2_info_annotation.svg`

比例验收：左翼 alpha bbox 1.231，右翼宽版 alpha bbox 1.489，均可等比进入 119x88 目标区域。旧的 `combat_console_v2_390_candidate_preview.png` 与 `combat_console_v2_390_pass3_compact_preview.png` 存在非等比压缩或候选比例不匹配，仅保留为反例。

信息标注已锁定：左翼放下一发弹药、子弹属性、弹药序列、伤害分析 40x40、符文配置 40x40；中间发射器井不放 DOM 面板；右翼放 SP 宝石、2x2 技能按钮与底部横向技能充能轨。

Pass 5 叠加小件候选：

- `docs/design/concepts/combat_console_v2_pass5/combat_current_ammo_core_socket_candidate.png`
- `docs/design/concepts/combat_console_v2_pass5/combat_damage_analysis_button_candidate.png`
- `docs/design/concepts/combat_console_v2_pass5/combat_rune_config_button_candidate.png`
- `docs/design/concepts/combat_console_v2_pass5/combat_skill_charge_endpoint_candidate.png`
- `docs/design/concepts/combat_console_v2_pass5/combat_console_overlay_sprites_size_check.png`
- `docs/design/concepts/combat_console_v2_pass5/combat_console_v2_overlay_sprites_applied_preview.png`

这些候选对应左上当前弹药核心槽、左下/左侧操作区的伤害分析与符文配置、右下技能充能端点；正式接入前需复制到 `assets/ui/sprites/` 并重新命名为运行时资源。

Pass 6 贴边放大预览：

- `docs/design/concepts/combat_console_v2_pass6/combat_console_v2_390_edge_attached_overlay_preview.png`

布局更新：左右面板直接贴屏幕边缘，目标框改为左翼 `x=0 y=589 w=128 h=104`、中间发射器井 `x=128 y=589 w=134 h=104`、右翼 `x=262 y=589 w=128 h=104`。该版本优先级高于旧 6px 外边距预览。

Runtime shell 状态：2026-06-24 已先接入 DOM/CSS 布局验证，随后接入 Pass4/Pass5/Pass1 的 runtime candidate PNG。`#combat-bottom-dock` 采用 Pass6 三段式贴边网格；左翼承载下一发弹药、独立属性芯片、短队列、伤害分析 40x40、符文配置 40x40；右翼固定 2x2 技能按钮，每个热区 40x40，技能点以横向狭长六边形 PNG 宝石嵌在上边框，技能充能回到底部横向轨道。

已进入运行时预览的候选资产：

- `assets/ui/panels/combat_console_left_wing_runtime_candidate.png`
- `assets/ui/panels/combat_console_right_selected_runtime_candidate.png`
- `assets/ui/panels/merchant_journey_topbar_runtime_candidate.png`
- `assets/ui/sprites/combat_current_ammo_core_socket_runtime_candidate.png`
- `assets/ui/sprites/combat_damage_analysis_button_runtime_candidate.png`
- `assets/ui/sprites/combat_rune_config_button_runtime_candidate.png`
- `assets/ui/sprites/skill_editor_button_raw.png`
- `assets/ui/sprites/skill_editor_button.png`
- `assets/ui/sprites/skill_sp_gem_hex_empty_runtime_candidate.png`
- `assets/ui/sprites/skill_sp_gem_hex_full_runtime_candidate.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_*.png`
- `assets/ui/sprites/attribute_icons/attribute_icon_*.png`

这些文件仍按 `_runtime_candidate` 或运行时候选小件管理，不标记为最终已配齐。正式左右翼、宝石、按钮框、属性芯片和属性 ICON 仍需按绿幕/chroma key 与 9-slice 流程进入最终命名后再登记为已配齐。属性 ICON 已先作为透明 PNG 符号层接入研磨属性 chip、战斗左翼属性 chip 与发射器底部属性孔。

2026-06-24 Pass10 更新：用户选中的右翼面板已接入为 `combat_console_right_selected_runtime_candidate.png`，顶部最多 5 个技能点、中央 2x2 技能槽、底部横向技能充能轨均按该素材槽位定位。旧宽版右翼、旧右下端点、旧横向 SP 宝石已移至 `assets/ui/archive/combat_console_v2_replaced_pass10/`，避免继续误用。底部技能充能条不再叠加 `skill_charge_panel_9s.png` 外壳，DOM 仅叠加 actual/temp fill。

2026-06-26 技能装配入口更新：`#skill-editor-open-btn` 已从顶部栏左侧移入 `#combat-bottom-dock .combat-skill-pane` 右下角专用按钮位。新按钮使用 `assets/ui/sprites/skill_editor_button.png`，绿幕源图保留为 `skill_editor_button_raw.png`；该按钮不烘焙文字，运行时仍通过 `title` / `aria-label` 表达“技能装配”。
