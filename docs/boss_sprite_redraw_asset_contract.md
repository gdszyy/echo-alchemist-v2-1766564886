# Boss 本体重绘资产契约

本文档定义 8 个 Boss 基础 Sprite 的重绘契约。它只约束 Boss 本体，不包含破绽 Overlay、血条、状态角标、行动预警、入场标题或粒子特效。

## 1. 分层原则

Boss 视觉拆成三层：

| 层 | 资产 | 职责 |
|---|---|---|
| 基础本体 | `assets/sprites/bosses/boss_<bossId>.png/.json` | Boss 主轮廓、材质、核心结构、待机呼吸 |
| 破绽 Overlay | `assets/sprites/enemies/bosses/<bossId>/vulnerability/` | 破绽累积、爆开、易伤、恢复 |
| 程序化状态层 | `Enemy.draw()` / `_drawBossDecoration()` | 血条、温度、护盾、狂暴、行动预警、粒子和动态光效 |

重绘本体时不要把破绽、血条、飘字、UI 标签、行动范围提示或受击数字画进基础 Sprite。

## 2. 文件路径

现有 8 个 Boss 已经接入 SpriteRenderer，重绘时覆盖同名文件即可：

```text
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

每个 Boss 的当前物理轮廓：

| Boss | 运行时碰撞 | 美术轮廓要求 |
|---|---|---|
| Ignis | 顶窄底宽梯形 polygon | 炉体两侧向下展开，顶部不要画成宽平墙 |
| Glacies | 顶尖五边形 polygon | 冰晶背脊对齐顶点，两侧肩部贴合斜面 |
| Mikro | 近圆/椭圆 12 点 polygon | 母核/孢室读成实心近圆或厚壳实体，不要画成空心环，也不要横向铺满 |
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

## 7. 当前 Draft 状态

2026-06-22：已生成 Ignis 与 Glacies 的基础重绘 draft；2026-06-23 追加 Mikro 与 Devourer 基础重绘 draft。当前均尚未覆盖正式运行时 `assets/sprites/bosses/boss_<bossId>.png/.json`。

```text
assets/sprites/bosses/redraw_drafts/boss_ignis_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_ignis_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_ignis_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_glacies_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_glacies_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_glacies_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_mikro_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_mikro_base_draft_collision_overlay.png
assets/sprites/bosses/redraw_drafts/boss_mikro_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_mikro_redraw_idle_draft_sheet.json
assets/sprites/bosses/redraw_drafts/boss_devourer_base_draft_384x256.png
assets/sprites/bosses/redraw_drafts/boss_devourer_base_draft_collision_overlay.png
assets/sprites/bosses/redraw_drafts/boss_devourer_redraw_idle_draft_sheet.png
assets/sprites/bosses/redraw_drafts/boss_devourer_redraw_idle_draft_sheet.json
```

正式替换前仍需人工美术验收：确认 384×256 单帧主体不会遮挡血条、主体实心轮廓贴合 `boss_collision_guides_v2_no_three_rings_384x256.png`、弱点位置与 `vulnerability/weak_mask` 对齐，并决定是否把 6 帧 draft idle 扩展到 8-12 帧正式 sheet。
