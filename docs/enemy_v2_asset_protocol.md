# 敌人视觉 V2 资源接入协议

本文档定义 V2 基底敌人（占格 ≥ 2 的尺寸/词条联动敌人）的统一资源命名、
manifest、metadata 接入路径与回退策略。所有 V2 敌人必须遵守该协议，
后续替换为正式美术时**只需替换文件，无需修改其他代码**。

> **统一美术母题**：正式美术默认采用“几何磨石块基座 + 镶嵌核心”。PNG / Sprite Sheet / 图鉴头像都应保留磨损倒角、切削痕、石槽和嵌入式机制核心；不要求 GIF。完整风格规范见 [`docs/design/enemy_geometric_whetstone_style.md`](design/enemy_geometric_whetstone_style.md)，重生成批次见 [`docs/design/enemy_asset_regeneration_plan.md`](design/enemy_asset_regeneration_plan.md)。

> 配套实现：
> - 元数据：[`src/data/enemy_v2_metadata.js`](../src/data/enemy_v2_metadata.js)
> - 图标映射：[`src/bitmap_icons.js`](../src/bitmap_icons.js) → `ENEMY_V2_ICON_MAP`
> - Sprite 选择：[`src/render/sprite_renderer.js`](../src/render/sprite_renderer.js) → `createSpriteRenderer(type, bossType, baseArchetype)`
> - 渲染层级：[`src/entities/enemy.js`](../src/entities/enemy.js) → `Enemy.draw` Layer 3.95
> - 演示与图鉴：[`src/systems.js`](../src/systems.js) → `buildV2MatrixScenarios` / `buildV2BestiaryEntries`

## 1. 资源命名约定

| 类型 | 路径 | 命名规则 |
|---|---|---|
| Sprite Sheet PNG | `assets/sprites/enemies/v2/<resourceId>.png` | `enemy_<base>_<cols>x<rows>` |
| Sprite manifest  | `assets/sprites/enemies/v2/<resourceId>.json` | 同 PNG，扩展名 `.json` |
| Collision Frame PNG | `assets/sprites/enemies/frames/frame_<base>_<cols>x<rows>.png` | 与物理碰撞框同形，中心透明；作为顶层物理边界 |
| Collision Frame 绿幕源图 | `docs/archive/enemy_collision_frame_sources_2026-06-21/source_green/frame_<base>_<cols>x<rows>_green.png` | 已归档的纯绿底 + 同形描边源图，仅供后续美术重绘/去底参考；运行时目录只保留最新版透明 PNG |
| UI 头像/图鉴图标 | `assets/icons/enemies/<resourceId>.png`        | 64×64，与 PNG 同名 |

**当前已建立的 `resourceId`（P0–P3）**：

| 优先级 | resourceId | baseArchetype | footprint |
|---|---|---|---|
| P0 | `enemy_bastion_3x1`      | bastion     | 3×1 |
| P0 | `enemy_maw_2x2`          | maw         | 2×2 |
| P1 | `enemy_deflector_2x1`    | deflector   | 2×1 |
| P1 | `enemy_echo_spire_1x2`   | echoSpire   | 1×2 |
| P2 | `enemy_prism_1x3`        | prism       | 1×3 |
| P2 | `enemy_hive_2x3`         | hive        | 2×3 |
| P3 | `enemy_siege_3x2`        | siege       | 3×2 |
| P3 | `enemy_carrier_3x2`      | carrier     | 3×2（底部中格为空舱） |
| P3 | `enemy_gravity_core_3x3` | gravityWell | 3×3 |

> 普通 1×1 残渣使用 `residue:1x1` frame 键，V2 大型基底使用 `<baseArchetype>:<cols>x<rows>` frame 键。

## 2. Sprite Sheet manifest 规格

与既有 `golem_normal.json` 兼容：

```json
{
  "frameSize": 128,
  "placeholder": true,
  "animations": {
    "idle": { "row": 0, "frames": 4, "fps": 6 },
    "hit":  { "row": 1, "frames": 2, "fps": 12 }
  }
}
```

- `frameSize`：单帧像素，默认 128。
- `animations.idle.row`：常驻状态行号；必须存在。
- `animations.hit.row`：受击行号；可选，但建议提供。
- `animations.move/cast`：可选；如果未提供，渲染层会自动回退到 `idle`。
- `placeholder`：true 表示占位资源，后续美术替换时改为 false。

当前普通敌人中心层资产来自 `docs/screenshots/enemy-layer-debug-2026-06-21/enemy_frontview_atlas_generated.png`，由 `scripts/build_enemy_frontview_assets_from_atlas.py` 切分为透明 PNG，并同步写入 `assets/sprites/enemies/v2/`、`assets/sprites/enemies/archetypes/`、`assets/sprites/enemies/composites/` 三条消费路径。后续重生图必须保持正视图、同一几何磨石/晶核风格、同一 footprint 比例，不得回退到旧斜视图或混合不同风格素材。

> 资源可以只提供 `idle` + `hit` 两行，后续 `move` / `cast` 为可选增强。若美术只交付静态 PNG，应仍按同名 manifest 包装为单帧或少帧 Sprite Sheet，避免绕开现有 `SpriteRenderer` 和 manifest 回退链路。

## 2.5 Collision Frame manifest 规格

`assets/sprites/enemies/enemy_sprite_manifest.json` 的 `frames` 段用于登记材质化物理碰撞框。键名为 `<baseArchetype>:<cols>x<rows>`，运行时由 `resolveEnemyVisualAsset(enemy)` 返回 `frameKey/framePath/frameShape`，再由 `Enemy._drawCollisionFrameBitmap()` 绘制。少数 Boss 专属 1×1 召唤物可使用显式 composite 键（例如 `orbitEcho:<slotId>`）选择主体 sprite，但顶层 frame 仍必须来自真实物理 hull。

```json
{
  "frames": {
    "bastion:3x1": {
      "spritePath": "assets/sprites/enemies/frames/frame_bastion_3x1.png",
      "shape": "aabb",
      "footprint": "3x1"
    }
  }
}
```

- Frame 必须匹配 `spawn_applyArchetypeShape()` 设定的真实 `collisionShape/collisionData`，不是独立装饰容器。
- Frame PNG 与绿幕源图必须按 footprint 比例出图：`3x1` 为宽图、`1x3` 为竖图、`2x3` 为竖向矩形；禁止把所有边框资产做成统一 1:1 方图再靠预览或运行时拉伸解释。
- PNG 必须只沿真实物理 hull 描边，中心保持透明，给 Layer 2 血条、HP 数字、状态短标和预警 UI 留出可读空间。
- 当前 frame 资源由 `scripts/generate_enemy_boundary_frames.py` 从真实物理边界生成；`maw/deflector/echoSpire/prism/siege/gravityWell` 逐点对应 `spawn_applyArchetypeShape()` 里的 polygon / circle 定义，`residue/bastion/hive` 使用 AABB 边界。Boss 历史转换出的 1×1 异型随从也必须使用 `frame_minion_<boss>_1x1.png` 系列，逐点对应 `spawn_applyMinionShape()` 的 triangle / diamond / hex / octagon 等物理 hull；最终 Boss `ouroboros` 主动召唤的 `orbit_echo` 也遵守同一条 octagon hull/frame 契约。
- 美术重绘时应先在绿幕源图上沿同一 hull 画描边：背景和中间挖空区域使用纯绿幕色，去底后导出透明 PNG。不得把 frame 画成徽章、外框、装饰面板或主体轮廓猜测。
- 绘制层在 Layer 4.9 内壁阴影之后。只要运行时已经命中 frame 资源路径，Layer 5 矢量描边、边框脉冲和 footprint cue 都不得再绘制，避免图片加载首帧或异型随从路径露出旧白线框；若完全没有 frame 资源路径，才允许使用 Layer 5 作为兜底。

## 3. metadata 字段（src/data/enemy_v2_metadata.js）

```ts
{
  id, resourceId, name, footprint,
  cols, rows, baseArchetype,
  affixes: string[],
  priority: 'P0'|'P1'|'P2'|'P3',
  stage, role, counter,
  spritePath, iconPath,
  hpMult, placeholder
}
```

`metadata` 是单一数据源，被三处消费：

1. `sprite_renderer.js` SPRITE_REGISTRY 自动注入；
2. `bitmap_icons.js` `ENEMY_V2_ICON_MAP` 自动注入；
3. `systems.js` 演示矩阵 `buildV2MatrixScenarios` 与图鉴
   `buildV2BestiaryEntries` 共用此份数据。

**新增 V2 基底**：在 `enemy_v2_metadata.js` 数组末尾追加一项即可，
sprite_renderer / icon map / 试炼场 / 图鉴会自动同步。

## 4. 渲染层级（Enemy.draw）

按以下顺序绘制（Layer ID 与代码注释一致）：

1. Layer 1.x：占格阴影 / 容器裁剪 / 底层纹理
2. Layer 2  ：血条 / 延迟白条 / 回血绿条
3. Layer 3.x：状态效果（冻结/灼烧/眩晕/温度）
4. Layer 3.55：**V2 基底专属词条结构**（`_drawArchetypeBody`）
5. Layer 3.6 ：通用词缀印章
6. Layer 3.8/3.9：Boss / Elite 装饰光环
7. Layer 3.95：**V2 Sprite 覆盖层**
   - 当 `baseArchetype` 存在且 `cols>=2 || rows>=2` 时，Sprite 占满整个占格（仅留 6px 边距）；
   - 否则回到默认 `min(w,h)` 居中偏下绘制。
8. Layer 4+：裂纹 / 过载 / 选中高亮
9. Layer 4.9b：**Collision Frame 材质边框**
   - 对普通 `1×1 residue` 与所有登记 frame 的非 Boss V2 敌人生效；
   - 读取 manifest `frames[<baseArchetype>:<cols>x<rows>]`；
   - 绘制成功后接管物理边界表达，Layer 5 矢量描边只作为资源未 ready / 加载失败时的兜底。

当前目标图层收束为：底层 Canvas 血量容器，中层中心敌人 Sprite，顶层中空 Collision Frame。状态和词条特效暂时沿用既有 Layer 3.x / overlay 管线，后续再单独拆分为可控特效层。

### 4.1 Ouroboros Orbit Echo 变体

`ouroboros` 的六附体槽会主动召唤 `orbit_echo` 伴生敌人。它们不走普通 `residue:1x1:` 主体图，而是通过 `bossOwnerId='ouroboros'`、`bossMinionRole='orbit_echo'` 与 `bossMechanicTags` 中的 `orbit:<slotId>` 解析到显式 composite：

```text
orbitEcho:aegis
orbitEcho:graft
orbitEcho:brood
orbitEcho:stride
orbitEcho:maw
orbitEcho:surge
```

这些主体资源位于 `assets/sprites/enemies/composites/enemy_ouroboros_orbit_echo_<slotId>_1x1_idle.png/.json`。2026-06-24 起，这 6 张 PNG 必须从当前 Ouroboros Boss 成稿 sheet `boss_ouroboros_redraw_idle_draft_sheet_v20260624alphafix.png` 提炼同材质壳体，JSON 需保留 `bossMatched: true`、`styleFamily: "ouroboros_boss_matched"` 与 `sourceAtlas`，由 `tests/validate_boss_sprite_assets.mjs` 锁定。运行时仍强制使用 `frame_minion_ouroboros_1x1.png` 表达八角物理边界，避免伴生敌看成普通方形残渣。

注意：这些 `orbit_echo` 主体 PNG 同时用于两处：实际可移动的伴生敌，以及 Boss 环上的六个附体槽。`Enemy._drawOuroborosOrbitAttachments()` 必须直接挂载这批 `enemy_ouroboros_orbit_echo_<slotId>_1x1_idle.png`，不得回退到普通敌人、文本符号或旧 `assets/sprites/bosses/ouroboros_slots/` 图标。试炼场 `boss_ouroboros_attachment_slots` 只切换真实 Boss 的 `_applyOuroborosAttachment()` 以预览同一套槽位贴图，不调用 `_ouroborosSpawnEchoes()`，避免生成会每回合移动的预览敌人。

## 5. 回退策略（防止敌人消失）

`createSpriteRenderer(type, bossType, baseArchetype)` 选择优先级：

```
baseArchetype ∈ V2  →  V2 专属 Sprite
boss + bossType     →  boss_<bossType>
elite               →  golem_elite
normal              →  golem_normal
```

- Boss 本体 Sprite 的路径与重绘尺寸不进入 `enemy_sprite_manifest.json`，由 `src/data/boss_sprite_assets.js` 与 [`docs/boss_sprite_redraw_asset_contract.md`](boss_sprite_redraw_asset_contract.md) 约束。当前 `256 × 256` 方形帧为 legacy 可运行资源；重绘目标为 `384 × 256` 横向帧，并通过 JSON 的 `frameWidth/frameHeight` 让渲染器按 3×2 Boss 占格绘制。
- 任何 PNG/JSON 加载失败：`SpriteRenderer.failed = true`，
  `Enemy.draw` 中 `_spriteRenderer.ready` 为 false，自动跳过 Sprite 绘制，
  **`_drawArchetypeBody` 仍会以矢量形式画出基底轮廓**，敌人不会白屏 / 消失。
- V2 基底配置但资源缺失：`createSpriteRenderer` 会强制回退到 `golem_elite`，
  保留可见的精英外观。

## 6. 后续正式美术替换流程

1. 把美术交付的 PNG 放到 `assets/sprites/enemies/v2/<resourceId>.png`，
   覆盖占位资源（保持文件名一致）。
2. 更新对应的 `<resourceId>.json`：
   - 改 `placeholder` 为 `false`；
   - 根据交付帧数调整 `animations.idle.frames` / `fps` 等字段；
   - 若新增 `move` / `cast` 动画，按 manifest 规范添加新行。
3. 更新 64×64 头像 `assets/icons/enemies/<resourceId>.png`。
4. 在 `src/data/enemy_v2_metadata.js` 中将该项的 `placeholder: true`
   改为 `false`。**无需修改其他文件。**
5. 运行 `python3 scripts/gen_enemy_v2_placeholders.py`
   仅会重新生成 placeholder，不会覆盖正式美术（除非主动恢复占位）。

正式美术验收时额外检查：主体是否仍是几何磨石块基座，专属机制是否嵌在石槽内部，通用词条是否只作为覆层存在。若资源看起来像纯发光云、纯软体器官、独立机械载具或 UI 徽章，应退回重画。

## 6.5 2026-06-19 / 2026-06-21 asset updates

- The 9 V2 base enemies now use formal bitmap sprite sheets instead of the original line/block placeholders. The 2026-06-24 `carrier` pass uses an imagegen-painted source; older V2 bases still come from the procedural/material pass until their own repaint.
- Updated folders: `assets/sprites/enemies/v2/`, `assets/sprites/enemies/archetypes/`, and `assets/icons/enemies/`.
- Each V2 sheet keeps the 128 px frame contract with 4 idle frames and 2 hit frames.
- Related manifests and `src/data/enemy_v2_metadata.js` now use `placeholder: false`.
- Later hand-painted art can still replace the same file names in place.
- 2026-06-21: the V2 metadata sprites, runtime archetype/composite enemy body PNGs, and material collision frames were regenerated from the same front-view asset pass; non-runtime source_green/material files are archived under `docs/archive/enemy_collision_frame_sources_2026-06-21/` so `assets/sprites/enemies/frames/` contains only the latest runtime frame PNGs.
- 2026-06-21 frame iteration: collision frames now clip the generated obsidian/metal material texture to the exact physics hull, with fractured armor plates, beveled seams, cracks, and sparse colored crystal fissures. Keep the frame itself dark neutral; do not tint the whole border by enemy attribute, and do not add black ruler stripes, heavy black outlines, or rivet-node borders.
- 2026-06-24 carrier follow-up: `enemy_carrier_3x2` is now a formal imagegen-painted runtime asset generated from `docs/design/concepts/carrier_imagegen_pass1/carrier_imagegen_alpha.png` by `scripts/generate_carrier_enemy_assets.py`; V2 sprite, archetype sprite, exact composite, collision frame, UI archetype icon, bestiary icon, and `affix_carrier.png` all preserve the lower-center launch bay as transparent space and are marked `placeholder:false`.
- 2026-06-27 exact composite pass: `prism:1x3:prism`、`hive:2x3:hive`、`gravityWell:3x3:gravityWell` now have formal imagegen-painted composite PNG/JSON entries generated by `scripts/generate_enemy_exact_composites_pass1.py`; the archetype fallback remains available, but resource resolution now reports `Composite Sprite` for these exact base-affix keys.

## 7. 验收清单

- [x] `assets/sprites/enemies/v2/` 包含 9 个 P0–P3 PNG + manifest
- [x] `assets/icons/enemies/` 包含 9 个 64×64 头像
- [x] `sprite_renderer.createSpriteRenderer` 支持 baseArchetype 选择并回退
- [x] `bitmap_icons.ENEMY_V2_ICON_MAP` 9 个 baseArchetype 全覆盖
- [x] 试炼场 V2 矩阵 / 真理之书图鉴共用 `ENEMY_V2_METADATA`
- [x] 每个 V2 敌人具备：中文名、footprint、baseArchetype、affix、战术职责、针对提示
- [x] 资源加载失败时回退到矢量绘制 + 元素轮廓，敌人保持可见
- [x] Collision Frame 已覆盖普通 `residue:1x1`、9 个 V2 基底，以及 8 个 Boss 历史转换 1×1 异型随从，命中资源路径后接管顶层物理边界
