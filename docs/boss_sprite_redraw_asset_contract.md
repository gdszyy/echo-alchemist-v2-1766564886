# Boss 本体重绘资产契约

本文档定义 8 个 Boss 基础 Sprite 的重绘契约。它只约束 Boss 本体，不包含破绽 Overlay、血条、状态角标、行动预警、入场标题或粒子特效。

## 1. 分层原则

Boss 视觉拆成三层：

| 层 | 资产 | 职责 |
|---|---|---|
| 运行时基础本体 | `assets/sprites/bosses/redraw_drafts/boss_<bossId>_redraw_idle_draft_sheet.png/.json` | Boss 主轮廓、材质、核心结构、待机呼吸 |
| Legacy 对照 | `assets/sprites/bosses/boss_<bossId>.png/.json` | 旧 256×256 资源，仅保留为回退/对照，不再是运行时优先路径 |
| 破绽 Overlay | `assets/sprites/enemies/bosses/<bossId>/vulnerability/` | 破绽累积、爆开、易伤、恢复 |
| 程序化状态层 | `Enemy.draw()` / `_drawBossDecoration()` | 血条、温度、护盾、狂暴、行动预警、粒子和动态光效 |

重绘本体时不要把破绽、血条、飘字、UI 标签、行动范围提示或受击数字画进基础 Sprite。

## 2. 文件路径

现有 8 个 Boss 已经接入 SpriteRenderer，运行时优先读取 `redraw_drafts/` 下的 384×256 draft sheet；旧同名 `assets/sprites/bosses/boss_<bossId>.png/.json` 只作为 legacy 对照：

```text
assets/sprites/bosses/redraw_drafts/boss_<bossId>_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_<bossId>_redraw_idle_draft_sheet.json
assets/sprites/bosses/boss_<bossId>.png
assets/sprites/bosses/boss_<bossId>.json
assets/sprites/bosses/raw/<bossId>_idle_raw.png
```

Boss ID：

```text
ignis, glacies, mikro, devourer, viridis, tesla, chimera, ouroboros
```

## 3. 尺寸契约

当前旧资源是 `256 × 256` 方形帧，仍可运行；重绘目标改为横向帧：

| 项 | 旧资源 | 重绘目标 |
|---|---:|---:|
| 单帧尺寸 | `256 × 256` | `384 × 256` |
| 帧锚点 | `(128, 128)` | `(192, 128)` |
| Boss 占格 | 以方形贴在 3×2 中央 | 填满 3×2 主体区域 |
| idle 帧数 | 6 | 至少 6，推荐 8-12 |
| 背景 | 透明 RGBA PNG | 透明 RGBA PNG |

重绘 JSON 必须声明矩形帧，示例：

```json
{
  "frameWidth": 384,
  "frameHeight": 256,
  "animations": {
    "idle": { "row": 0, "frames": 8, "fps": 6 }
  }
}
```

`SpriteRenderer.getCurrentFrameAspect()` 会读取 `frameWidth/frameHeight`。当宽高比大于 `1.18` 时，Boss 会按完整 3×2 占格绘制；旧 256 方形资源保持原绘制方式。

## 4. 画面约束

- 透明背景，8-bit RGBA PNG。
- 主体保留 16-24 px 透明安全边距。
- 外轮廓必须能读出 Boss 的机制身份，而不是只靠颜色区分。
- 核心结构要和破绽弱点位置兼容，方便后续叠加 `boss_<id>_weak_mask.png`。
- 不要烘入大面积全屏光晕；动态光效仍由 Canvas 层控制。
- 不要把破绽、裂开、易伤姿态画进基础 idle；这些属于破绽 Overlay。

### 4.1 物理碰撞轮廓硬约束

Boss 重绘必须贴合运行时物理碰撞轮廓。当前 `spawn_spawnBoss()` 固定以 `3×2` 占格生成 Boss，并按 `bossId` 写入 `collisionShape/collisionData`；因此美术外轮廓不能只追求造型夸张，而要让玩家看到的主体边界和实际反弹/命中边界一致。

碰撞参考图：

```text
assets/sprites/bosses/redraw_drafts/boss_collision_guides_v2_no_three_rings_384x256.png
```

生成与验收规则：

- 旧同名图 `boss_collision_guides_384x256.png` 已归档到 `assets/sprites/bosses/redraw_drafts/archive/`，后续不要继续引用，避免预览缓存显示旧三环轮廓。
- 主体“实心读法”必须落在对应 Boss 的 guide 附近；允许冰刺、火花、雾气、碎片等非实体装饰轻微外扩，但不能形成像可碰撞实体的新肢体。
- 多边形 Boss 的肩、底边、尖顶或斜边要贴合 guide 的关键顶点；不要把 `tesla` 这种窄菱形画成宽重甲，也不要把 `glacies` 这种五边形画成满矩形。
- 只有 `ouroboros` 是圆弧 Boss，且必须画成完整闭合环，用于承载六个附体槽；`gapAngle` 只是轮转锚点，不再表示物理缺口。
- `mikro` 和 `devourer` 不得再画成空心环：`mikro` 是近圆/椭圆母核实体，`devourer` 是不规则巨口胃囊实体。
- 关键实体边缘与 guide 的视觉偏差建议控制在 16-24 px 内；超过该范围的内容只能是明显的半透明特效或背景式装饰。
- 每个正式替换候选都需要制作“base + collision guide”叠加验收图，确认血条、弱点、碰撞轮廓三者不互相矛盾。

### 4.2 血量可读性 Mask 契约

Boss 本体 Sprite 在运行时绘制在液体 HP 层之后，但不能靠“整张图整体降 alpha”解决可读性。正式资产和 draft 必须采用“正常本体 + 独立透光 mask”的管线：装甲、石壳、藤蔓、外轮廓等非窗口区域保持实体重量；只有材质上合理的炉门缝、冰晶腔、孢室膜、胃囊薄膜、电核罩等位置通过 mask 转成透光窗口，让玩家从这些结构里看到下方 HP 液体。

生成与验收规则：

- 每个 base draft 必须有 `boss_<id>_hp_translucency_mask.png`。mask 使用绿/蓝高饱和区域标记透光材质窗口，后处理脚本只根据 mask 改 alpha，不得扫描整张图做统一透明。
- 每个 base draft 必须有 `boss_<id>_base_draft_hp_window_preview.png`，把最终本体叠在模拟 HP 液体背景上，人工确认血量只从透光部件中读出。
- 运行时 Boss HP 槽底和真实 HP 液体会按 `bossType` 使用主题色：Ignis 橙红、Glacies 冰蓝、Mikro 绿核、Devourer 紫渊、Viridis 毒绿、Tesla 电蓝、Chimera 红紫、Ouroboros 金色；预览图也应尽量使用对应主题底色，避免 mask 在正式画面里读感偏色。
- 透光窗口建议覆盖主体面积约 `8%-35%`，特殊胃囊/孢室类 Boss 可略高但不得超过 `42%`；非 mask 区域应保持高 alpha 和实体重量。
- mask 内部允许透明渐变，边缘应保留纹路、裂缝、膜边或金属框，避免看起来像硬切 UI 窗口。
- `tests/validate_boss_sprite_assets.mjs` 会检查已有 draft 的 mask 尺寸、窗口覆盖率、窗口平均 alpha、非窗口主体平均 alpha 和预览图是否存在。
- 如果某个 Boss 必须有厚重外壳，优先在外壳内部开“材质上合理的透光腔/薄膜/晶体”，不要把整片外壳整体调淡。

可用自动初稿流程：

```bash
python scripts/extract_boss_hp_translucency_masks.py --root .
```

该脚本从 `_2026-06-23_opaque_source` 不透明源稿中用 HSV 局部对比、亮纹 top-hat、边缘过滤、连通域清理和覆盖率收缩提取候选 mask，并输出到 `assets/sprites/bosses/redraw_drafts/auto_extract/`。自动结果只能作为美术初稿，不得直接替换 active mask；需要人工检查是否抓到了真实裂纹/透光孔隙，是否误选普通材质纹理。当前实验表明它能较好提取 Ignis 炉栅裂纹、Glacies 冰晶高光、Mikro 孢室纹路和 Devourer 口器缝，但边缘较碎，正式使用前仍要合并主窗口、删除噪点并保持物理轮廓语义。

每个 Boss 的当前物理轮廓：

| Boss | 运行时碰撞 | 美术轮廓要求 |
|---|---|---|
| Ignis | 顶窄底宽梯形 polygon | 炉体两侧向下展开，顶部不要画成宽平墙 |
| Glacies | 顶尖五边形 polygon | 冰晶背脊对齐顶点，两侧肩部贴合斜面 |
| Mikro | 近圆/正圆 12 点 polygon | 当前美术 draft 按正圆母核读取；母核/孢室 mask 必须保持圆形，不要纵向压扁成椭圆，也不要横向铺满或画成空心环 |
| Devourer | 不规则 8 点巨口 polygon | 巨口、胃囊和齿槽要贴合实体轮廓；吞噬涡只能作为内部结构或特效，不得形成新碰撞环 |
| Viridis | 顶尖波浪五边形 polygon | 藤蔓攀附边缘，但主体仍保持尖顶/斜边 |
| Tesla | 窄菱形 polygon | 中央电核纵向窄身，外扩残影不能像实体 |
| Chimera | 不对称五边形 polygon | 左右异质核心可不对称，但底部尖落点要保留 |
| Ouroboros | 完整闭合圆弧 arc | 必须是一眼可读的完整环，外圈需要能放下 6 个附体槽；不要画成断环或缺口环 |

## 5. 每个 Boss 的重绘方向

| Boss | 本体关键词 | 必须保留的结构信号 |
|---|---|---|
| Ignis | 炉门、重盾铰链、熔炉核心 | 胸口炉门与两侧铰链，给破绽 Overlay 留弱点位置 |
| Glacies | 冰晶缝合、冻结关节、跳跃腿架 | 背部/下腹核心、可冻结的关节结构 |
| Mikro | 母核、孢室、分裂节点 | 中央母核与四周子节点 |
| Devourer | 深渊巨口、实体胃囊、吞噬涡 | 可张开的口器、内部黑洞感和不规则胃壁 |
| Viridis | 藤蔓共生、再生核心、毒液管束 | 绿色核心不能淹没主轮廓，藤蔓沿边缘攀附 |
| Tesla | 线圈、导体尖塔、残影轨 | 中心电核与两侧导体结构 |
| Chimera | 双/多核心缝合、反应炉、异质装甲 | 左右异质核心和缝合线 |
| Ouroboros | 完整环形回声、六附体槽、衔尾结构 | 六个可轮转附体槽和完整闭合环形方向感 |

## 6. 验收

运行：

```bash
node tests/validate_boss_sprite_assets.mjs
```

当前旧资源会显示为 `legacy`；重绘完成后应显示为 `redraw`。若存在 PNG/JSON 不匹配、尺寸错误、非 RGBA PNG 或 idle 帧不足，脚本会失败。

同一脚本还会执行 HP 透光窗口验收，并确认运行时 sheet path 已指向 `redraw_drafts/` 的 384×256 sheet；若路径退回旧 `assets/sprites/bosses/boss_<bossId>.png`，测试必须失败。

## 7. 当前 Draft 状态

2026-06-22：已生成 Ignis 与 Glacies 的基础重绘 draft；2026-06-23 追加 Mikro、Devourer、Viridis、Tesla、Chimera 与 Ouroboros 基础重绘 draft。2026-06-23 运行时已通过 `src/data/boss_sprite_assets.js` 切换到 `redraw_drafts/boss_<bossId>_redraw_idle_draft_sheet.png/.json`。2026-06-23 返工：Viridis 与 Ouroboros 的低质几何占位 draft 已替换为 `source_ai/` 厚涂源图管线，重新生成本体、HP 透光 mask、idle sheet 与对应破绽 Overlay；Ouroboros 保持完整闭合环和 6 个附体槽。

2026-06-23：8 个 Boss base draft 均已具备区域式 HP 透光窗口方案：只让炉芯、冰腔、孢室、胃囊、电核罩、混合核心、衔尾蛇环槽等 mask 标记区域变为透光；此前前四个整体半透明版本已归档为 `_2026-06-23_overall-alpha-superseded`，原不透明源稿归档为 `_2026-06-23_opaque_source`。后四个由 `scripts/generate_remaining_boss_hp_drafts.py` 生成碰撞轮廓优先的 draft，用于补齐验收与后续美术重绘参考。

```text
assets/sprites/bosses/redraw_drafts/boss_ignis_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_ignis_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_ignis_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_ignis_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_ignis_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_ignis_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_glacies_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_glacies_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_glacies_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_glacies_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_glacies_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_glacies_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_mikro_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_mikro_base_draft_collision_overlay.png
assets/sprites/bosses/redraw_drafts/boss_mikro_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_mikro_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_mikro_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_mikro_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_mikro_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_devourer_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_devourer_base_draft_collision_overlay.png
assets/sprites/bosses/redraw_drafts/boss_devourer_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_devourer_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_devourer_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_devourer_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_devourer_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_viridis_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/source_ai/boss_viridis_redraw_source_2026-06-23.png
assets/sprites/bosses/redraw_drafts/boss_viridis_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_viridis_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_viridis_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_viridis_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_viridis_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_tesla_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_tesla_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_tesla_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_tesla_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_tesla_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_tesla_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_chimera_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_chimera_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_chimera_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_chimera_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_chimera_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_chimera_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_ouroboros_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/source_ai/boss_ouroboros_redraw_source_2026-06-23.png
assets/sprites/bosses/redraw_drafts/boss_ouroboros_hp_translucency_mask.png
assets/sprites/bosses/redraw_drafts/boss_ouroboros_base_draft_hp_window_preview.png
assets/sprites/bosses/redraw_drafts/boss_ouroboros_base_draft_hp_readability_preview.png
assets/sprites/bosses/redraw_drafts/boss_ouroboros_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_ouroboros_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_base_draft_hp_window_contact_sheet.png
assets/sprites/bosses/redraw_drafts/boss_base_draft_hp_readability_contact_sheet.png
assets/sprites/bosses/redraw_drafts/boss_hp_translucency_mask_contact_sheet.png
```

正式美术终稿前仍需人工验收：确认 384×256 单帧主体不会遮挡血条、主体实心轮廓贴合 `boss_collision_guides_v2_no_three_rings_384x256.png`、弱点位置与 `vulnerability/weak_mask` 对齐，并决定是否把当前 6 帧 draft idle 扩展到 8-12 帧终稿 sheet。
