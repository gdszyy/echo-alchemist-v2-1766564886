# Echo Alchemist V2 美术资产缺口索引与生成 TODO

> 更新日期：2026-06-27
> 维护目的：把“当前有哪些素材已落地、哪些仍缺、下一批按什么优先级生成”固定成可持续维护的索引，避免资产状态只停留在聊天记录或分散文档里。

## 1. 当前扫描结论

本轮扫描范围：
- 运行时代码引用：`src/` 与 `index.html` 中的 `assets/*.png|svg|json` 静态引用。
- 生成规范入口：`docs/art_asset_generation_guidelines.md`。
- UI 资产清单：`docs/ui_asset_requirements.md`。
- Boss Toast 契约：`docs/design/round_start_boss_toast_asset_contract.md`。
- 敌人/Boss 资产契约：`docs/design/enemy_asset_regeneration_plan.md`、Boss 资产验证脚本。
- 图标映射：`src/bitmap_icons.js` 对 `RUNE_DB` / `RELIC_DB` 的覆盖情况。

扫描摘要：

| 项目 | 当前状态 |
|---|---|
| 静态运行时资源引用 | 224 个引用，0 个缺文件 |
| `assets/ui` | 281 个资源文件（278 PNG / 3 SVG） |
| `assets/icons` | 163 个 PNG |
| `assets/sprites/enemies` | 456 个资源文件（402 PNG / 14 SVG / 40 JSON） |
| `assets/sprites/bosses` | 236 个资源文件（198 PNG / 38 JSON） |
| 弹药图标 | 已覆盖 |
| 属性图标 | 已覆盖 |
| 符文图标 | `RUNE_DB` 17/17 已覆盖 |
| 遗物图标 | `RELIC_DB` 44 个中仍有 14 个走 emoji fallback；已生成并接入 6 个 P0 遗物图标 |
| Boss 本体重绘 | `validate_boss_sprite_assets.mjs` 25/25 通过 |
| Boss 破绽 Overlay | `validate_boss_vulnerability_assets.mjs` 92/92 通过 |

结论：当前没有“代码引用了不存在图片”的硬阻塞。下一步重点是补齐仍由 CSS/emoji 承载的高频 UI 与遗物图标，并生成状态化 Toast / 图鉴 / 结算等中频资产。

## 2. 维护规则

新增或替换任何运行时美术资产时，请同步更新：

1. `docs/art_asset_generation_guidelines.md`：生成前确认场景、材质、效果、透明管线和禁忌是否匹配。
2. `docs/asset_gap_index.md`：更新对应 TODO 状态、路径、备注。
3. `docs/ui_asset_requirements.md`：如果影响 UI 页面状态，从“缺失/部分覆盖”推进到“已配齐”。
4. `src/bitmap_icons.js`：图标类资产必须通过集中映射暴露，禁止散落 `new Image()` 或硬编码路径。
5. `src/styles/bitmap_ui.css`：9-Slice、背景、Sprite 样式只写在这里，不回写到 `index.html` 内联样式。
6. 对应设计契约文档：如果改变命名、尺寸、状态拆分或接入方式，同步更新 `docs/design/*` 或 `design_spec_bitmap.md`。

本轮实装记录：

- 2026-06-25：6 个 P0 遗物图标已生成透明 64x64 PNG，并接入 `RELIC_ICON_MAP`。
- 2026-06-25：暂停页“当前遗物”列表已改为优先读取 `getRelicIconSrc()`，与遗物选择、商店和掉落飞卡共用同一套位图入口。
- 2026-06-25：敌人行动/针对词条 UI 图标补齐 10 个透明 PNG，并接入 `ENEMY_AFFIX_ICON_MAP`、敌人 manifest、图鉴、试炼场词缀 chip、敌人信息抽屉和行动预告面板。
- 2026-06-27：敌人 V2 第一批精确 composite 补齐 `prism:1x3:prism`、`hive:2x3:hive`、`gravityWell:3x3:gravityWell`，源图保存在 `docs/design/concepts/enemy_exact_composites_pass1/`，运行时 PNG/JSON 接入 `assets/sprites/enemies/composites/` 与 `enemy_sprite_manifest.json`。

建议验证：

```powershell
node tests/validate_boss_sprite_assets.mjs
node tests/validate_boss_vulnerability_assets.mjs
node tests/validate_phase_contracts.mjs
```

说明：`validate_phase_contracts.mjs` 当前可能因路径正则期待 `assets/...` 而代码使用 `/assets/...` 报发射器两项失败。文件与运行时引用已存在，应单独修正验证脚本，不作为资产缺口处理。

## 3. P0 资产生成 TODO

P0 定义：高频可见、当前仍明显回退到 CSS/emoji、或影响第一眼完整度的资产。

| 优先级 | 资产/页面 | 建议路径 | 规格 | 当前情况 | 完成标准 |
|---|---|---|---|---|---|
| P0-1 | 暂停菜单背景 | `assets/ui/panels/pause_menu_bg.png` | 720x1280 或可覆盖全屏 | `#phase-pause` 仍为完全缺失 | 暂停层拥有统一暗金/黑曜石背景，不遮挡菜单文字 |
| P0-2 | 暂停菜单按钮 9-Slice | `assets/ui/sprites/pause_menu_btn_9s.png` | 192x56，slice 18-24 | 当前按钮仍走 CSS | 继续/放弃/返回按钮统一位图底板 |
| P0-3 | 启动标题徽章 | `assets/ui/sprites/title_badge.png` | 480x180，透明 PNG | 首页只靠文字与字体 | 首屏标题拥有品牌化徽章，不烘焙动态文案 |
| P0-4 | 开始按钮金属底板 | `assets/ui/sprites/start_btn_metal.png` | 220x64，透明 PNG 或 9-Slice | 首页 CTA 仍缺位图底板 | 点击开始按钮与整体炼金 UI 一致 |
| P0-5 | 设置滑条轨道 | `assets/ui/sprites/slider_track.png` | 240x16，透明 PNG | 设置面板已有背景和 toggle，但滑条缺 Sprite | 音量/速度类滑条不再回退原生 CSS |
| P0-6 | 设置滑条滑块 | `assets/ui/sprites/slider_thumb.png` | 24x24，透明 PNG | 同上 | 滑块 hover/active 可读 |
| P0-7 | 设置关闭按钮 | `assets/ui/sprites/modal_close_btn.png` | 40x40，透明 PNG | 关闭按钮缺专属 Sprite | 设置弹窗关闭控件与面板风格一致 |
| P0-8 | 遗物图标缺口第一批 | `assets/icons/relic/<id>.png` | 64x64 PNG | 14 个 `RELIC_DB` ID 无映射；已补 6 个高频/推荐遗物 | 继续补第一批剩余关键项并写入 `RELIC_ICON_MAP` |
| P0-9 | 遗物图标缺口第二批 | `assets/icons/relic/<id>.png` | 64x64 PNG | 同上 | 后续批次补齐，`RELIC_DB` 44/44 覆盖 |

P0 遗物图标缺口清单：

| id | 建议文件 | 备注 |
|---|---|---|
| `pinboard_second_row` | `assets/icons/relic/pinboard_second_row.png` | 钉盘扩容 |
| `surge_echo` | `assets/icons/relic/surge_echo.png` | 回响弹珠解锁 |
| `surge_venom` | `assets/icons/relic/surge_venom.png` | 剧毒弹珠解锁 |
| ~~`guardian_barrier`~~ | `assets/icons/relic/guardian_barrier.png` | ✅ 已生成并接入 `RELIC_ICON_MAP` |
| ~~`fate_reroll_token`~~ | `assets/icons/relic/fate_reroll_token.png` | ✅ 已生成并接入 `RELIC_ICON_MAP` |
| ~~`relic_reroll_seal`~~ | `assets/icons/relic/relic_reroll_seal.png` | ✅ 已生成并接入 `RELIC_ICON_MAP` |
| `relic_gravity_core` | `assets/icons/relic/relic_gravity_core.png` | 重力核心 |
| `relic_chrono_shard` | `assets/icons/relic/relic_chrono_shard.png` | 时间/节奏主题 |
| `relic_phoenix_feather` | `assets/icons/relic/relic_phoenix_feather.png` | 复苏/保命主题 |
| ~~`hunter_instinct`~~ | `assets/icons/relic/hunter_instinct.png` | ✅ 已生成并接入 `RELIC_ICON_MAP` |
| ~~`rune_resonance_core`~~ | `assets/icons/relic/rune_resonance_core.png` | ✅ 已生成并接入 `RELIC_ICON_MAP` |
| `mirror_magazine` | `assets/icons/relic/mirror_magazine.png` | 复制弹夹 |
| ~~`doomsday_timer`~~ | `assets/icons/relic/doomsday_timer.png` | ✅ 已生成并接入 `RELIC_ICON_MAP` |
| `echo_reverberation` | `assets/icons/relic/echo_reverberation.png` | 钉板收集反馈 |
| `element_injector` | `assets/icons/relic/element_injector.png` | 弹药队列改造 |
| `attribute_protocol` | `assets/icons/relic/attribute_protocol.png` | 多元素协议 |
| `mortal_burst` | `assets/icons/relic/mortal_burst.png` | 击杀爆裂 |
| `corridor_arc` | `assets/icons/relic/corridor_arc.png` | 左右墙闪电 |
| `chaos_pact` | `assets/icons/relic/chaos_pact.png` | 诅咒遗物 |
| `greedy_wheel` | `assets/icons/relic/greedy_wheel.png` | 诅咒续转 |

## 4. P1 资产生成 TODO

P1 定义：中高频页面的完整度增强，当前已有临时素材或 CSS fallback，但视觉状态还不够完整。

| 优先级 | 资产/页面 | 建议路径 | 规格 | 当前情况 | 完成标准 |
|---|---|---|---|---|---|
| P1-1 | 回合 Toast 普通状态 6 帧 | `assets/ui/banners/round_toast_normal_1.png` ~ `_6.png` | 600x200 | 仍复用旧 `round_banner_*.png` | 普通回合横幅有独立状态底图 |
| P1-2 | 回合 Toast Boss 倒计时 6 帧 | `assets/ui/banners/round_toast_countdown_1.png` ~ `_6.png` | 600x200 | 缺状态化封印纹 | Boss 倒计时不再和普通回合同底 |
| P1-3 | 回合 Toast Boss 临近 6 帧 | `assets/ui/banners/round_toast_soon_1.png` ~ `_6.png` | 600x200 | 缺预警状态 | Boss 前一回合有红金边缘预警 |
| P1-4 | 回合 Toast Boss 登场 6 帧 | `assets/ui/banners/round_toast_now_1.png` ~ `_6.png` | 600x200 | 缺登场冲击状态 | 本回合 Boss 登场与普通回合明显区分 |
| P1-5 | 威胁槽高危版 | `assets/ui/banners/round_threat_plate_danger_9s.png` | 420x72，slice 18-24 | 仅有普通 `round_threat_plate_9s.png` | `soon/now` 状态可切换危险边框 |
| P1-6 | Boss 小像高危边框 | `assets/ui/icons/boss_preview/boss_preview_frame_danger.png` | 112x112，透明 PNG | 缺叠层 | Boss 预告图在高危状态有统一边框 |
| P1-7 | 元商店分类 Tab | `assets/ui/sprites/meta_tab_<category>.png` | 96x36 或 9-Slice | `#phase-meta` 部分覆盖 | 分类 Tab 不再纯 CSS |
| P1-8 | SP 货币图标 | `assets/ui/icons/sp_currency.png` | 32x32 PNG | 元商店货币缺图标 | SP/资源显示统一 |
| P1-9 | 升级卡片占位插画 | `assets/ui/sprites/meta_upgrade_placeholder_<category>.png` | 160x120 | 升级卡视觉空 | 元商店卡片有类别插画 |
| P1-10 | 商店物品分类图标 | `assets/ui/icons/shop_category_<type>.png` | 32x32 | 商店分类缺图标 | 局外商店货架分类可读 |
| P1-11 | 商店价格标签 | `assets/ui/sprites/shop_price_tag_9s.png` | 120x40，slice 12 | 价格标签缺位图 | 价格区与商店卡片统一 |
| P1-12 | 研磨钉盘外框 | `assets/ui/sprites/gathering_pinboard_frame_9s.png` | 720x820 或分段 9-Slice | `#phase-gathering` 底部外框仍缺 | 研磨阶段钉盘边界与背景融合 |

## 5. P2 资产生成 TODO

P2 定义：低频页面、数据展示、风格精修和后续重绘 pass，不阻塞当前运行。

| 优先级 | 资产/页面 | 建议路径 | 规格 | 当前情况 | 完成标准 |
|---|---|---|---|---|---|
| P2-1 | 真理之书章节侧标 | `assets/ui/sprites/truth_book_tab_<chapter>.png` | 64x120 | 背景已接入，侧标缺 | 图鉴章节切换有专属侧标 |
| P2-2 | 真理之书属性卡片底板 | `assets/ui/panels/truth_book_attr_card_9s.png` | 220x140，slice 24 | 属性卡片缺底板 | 图鉴信息卡与背景一致 |
| P2-3 | 真理之书 Boss 头像位 | `assets/ui/sprites/truth_book_boss_slot_9s.png` | 120x120，slice 18 | Boss 头像位缺装饰 | 复用 Boss preview 时有统一底座 |
| P2-4 | Gameover 统计卡片 | `assets/ui/panels/stat_card_9s.png` | 320x140，slice 24 | 只有 `gameover_bg.png` | 结算统计不再纯 CSS 卡 |
| P2-5 | Gameover 奖励发放图层 | `assets/ui/sprites/reward_payout_layer.png` | 720x360，透明 PNG | 缺奖励动画图层 | 结算奖励出现时有统一视觉承载 |
| P2-6 | 数据统计折线图背景 | `assets/ui/sprites/data_chart_bg.png` | 640x320 | 数据页仍缺 | 历史数据页可承载折线 |
| P2-7 | 数据指标徽章 | `assets/ui/sprites/data_metric_badge.png` | 96x32 | 数据页仍缺 | 指标标签有统一徽章 |
| P2-8 | 最佳记录 ribbon | `assets/ui/sprites/best_record_ribbon.png` | 180x48 | 数据页仍缺 | 最佳记录状态可读 |
| P2-9 | 技能栏 V2 底板重做 | `assets/ui/panels/skill_bar_panel_v2_9s.png` | 按当前 `#skill-bar` 实际宽高切图 | 当前有旧 `skill_bar_panel_9s.png` | 绿幕流程重做并替换旧底板 |
| P2-10 | Runeword 图标集 | `assets/icons/runeword/<runewordId>.png` | 64x64 | 当前图鉴仍可用锁/文本承载 | 已发现/未发现词条拥有专属图标 |

## 6. 敌人 / Boss 后续维护

当前 Boss 本体和破绽资源已通过验证，短期不列入缺口。敌人侧也已具备 V2 基底、composite、collision frame、overlay 与图标资源；常见行动词条和敌人针对词条的 UI icon 已覆盖到图鉴、试炼场、信息抽屉与行动预告。后续属于风格统一和重绘 pass。

| 优先级 | 内容 | 当前判断 | 完成标准 |
|---|---|---|---|
| E-P1 | 复核 `docs/design/enemy_asset_regeneration_plan.md` 与实际资源目录 | 文档仍有个别“待重做”表述可能落后于现状，如 `golem_elite.png` 已存在 | 文档状态与资产目录一致 |
| E-P2 | V2 基底风格统一重绘 | 运行时不缺文件，属于美术质量 pass；`prism` / `hive` / `gravityWell` 已补精确 composite | 9 个基底在试炼场视觉语言统一 |
| E-P2 | 通用词条 Overlay 风格统一 | 已有大量 footprint-aware overlay | 不遮挡主体 silhouette，low 档可读 |

## 7. 推荐执行顺序

1. P0-8/P0-9：先补遗物图标缺口。收益最高，接入路径清晰，只需 `assets/icons/relic/*.png` + `RELIC_ICON_MAP`。
2. P0-1/P0-2：补暂停菜单。当前是唯一完全缺失的核心 overlay 页面。
3. P0-3/P0-4：补首页标题与开始按钮，提升第一眼完成度。
4. P0-5/P0-7：补设置弹窗滑条与关闭按钮，完成 `#settings-panel`。
5. P1-1 到 P1-6：按 `round_start_boss_toast_asset_contract.md` 完成 Toast 状态化二批。
6. P1-7 到 P1-12：补 meta/shop/gathering 中频页面资产。
7. P2：图鉴、结算、数据页、Runeword 图标与技能栏 V2 精修。

## 8. 生成与接入注意事项

- 生成前优先引用 `docs/art_asset_generation_guidelines.md`，其中按首屏、暂停、设置、遗物图标、Toast、Meta/Shop/Gathering、图鉴/结算/数据页、敌人/Boss 分别定义了场景目标、效果要求和 prompt 模板。
- 透明 PNG 继续走绿幕/chroma key 管线：prompt 使用纯色背景，后处理得到 alpha，不要求模型直接透明。
- 不烘焙动态文字、数字、价格、回合数或 Boss 名称；这些继续由 DOM 文本渲染。
- 9-Slice 命名统一使用 `_9s.png`，源图可保留 `_raw.png`。
- 新增高开销 Canvas 特效、粒子、`shadowBlur`、`createRadialGradient`、混合模式时，必须按 `.cursor/rules/performance.md` 补 `// @perf-impact` 与三档影响评估。
- 仅新增静态图片和 CSS 背景时，不需要新增性能预算；但仍需确认移动端尺寸不遮挡交互。
