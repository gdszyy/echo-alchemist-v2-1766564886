# 敌人视觉 V2 资源接入协议

本文档定义 V2 基底敌人（占格 ≥ 2 的尺寸/词条联动敌人）的统一资源命名、
manifest、metadata 接入路径与回退策略。所有 V2 敌人必须遵守该协议，
后续替换为正式美术时**只需替换文件，无需修改其他代码**。

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
| P3 | `enemy_gravity_core_3x3` | gravityWell | 3×3 |

> 当前所有 PNG 均为 **placeholder**（由
> `scripts/gen_enemy_v2_placeholders.py` 生成），manifest 中带
> `"placeholder": true`。命名/manifest/接入协议为正式版。

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

## 5. 回退策略（防止敌人消失）

`createSpriteRenderer(type, bossType, baseArchetype)` 选择优先级：

```
baseArchetype ∈ V2  →  V2 专属 Sprite
boss + bossType     →  boss_<bossType>
elite               →  golem_elite
normal              →  golem_normal
```

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

## 6.5 2026-06-19 asset update

- The 8 V2 base enemies now use procedural bitmap sprite sheets instead of the original line/block placeholders.
- Updated folders: `assets/sprites/enemies/v2/`, `assets/sprites/enemies/archetypes/`, and `assets/icons/enemies/`.
- Each V2 sheet keeps the 128 px frame contract with 4 idle frames and 2 hit frames.
- Related manifests and `src/data/enemy_v2_metadata.js` now use `placeholder: false`.
- Later hand-painted art can still replace the same file names in place.

## 7. 验收清单

- [x] `assets/sprites/enemies/v2/` 包含 8 个 P0–P3 PNG + manifest
- [x] `assets/icons/enemies/` 包含 8 个 64×64 头像
- [x] `sprite_renderer.createSpriteRenderer` 支持 baseArchetype 选择并回退
- [x] `bitmap_icons.ENEMY_V2_ICON_MAP` 8 个 baseArchetype 全覆盖
- [x] 试炼场 V2 矩阵 / 真理之书图鉴共用 `ENEMY_V2_METADATA`
- [x] 每个 V2 敌人具备：中文名、footprint、baseArchetype、affix、战术职责、克制提示
- [x] 资源加载失败时回退到矢量绘制 + 元素轮廓，敌人保持可见
