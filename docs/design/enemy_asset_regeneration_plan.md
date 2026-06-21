# 敌人美术资产重构与重生成计划

本文档把“几何磨石块基座 + 镶嵌核心”的敌人统一风格落成可执行资产计划。目标是重新生成并替换敌人位图资产，同时保持现有 `SpriteRenderer`、`enemy_sprite_manifest.json`、试炼场 `enemy_v2` 验收入口和 Canvas fallback 链路不变。

## 1. 当前资产盘点

| 资产层 | 当前目录 | 当前状态 | 重生成策略 |
|---|---|---|---|
| V2 archetype Sprite | `assets/sprites/enemies/v2/` 与 `assets/sprites/enemies/archetypes/` | 8 个基底均已接入，manifest 为 `placeholder:false` | 第一批重生成，保持文件名、footprint、manifest 帧契约 |
| Composite Sprite | `assets/sprites/enemies/composites/` | 6 个高频组合已接入 | 第二批重生成，优先覆盖现有 6 个，再扩展高频组合 |
| 通用词条 Overlay | `assets/sprites/enemies/overlays/` | 6 个通用词条覆盖层 | 第三批统一为“刻线/薄膜/晶片覆层”，避免盖住主体 silhouette |
| 碰撞材质框 Collision Frame | `assets/sprites/enemies/frames/` | Pass 1 已接入运行时：4 个 frame 通过 manifest `frames` 段命中 | 必须匹配 `collisionShape/collisionData`，中心透明，用于提升物理边界质感并保留 HP/UI |
| V2 图鉴头像 | `assets/icons/enemies/` | 8 个 64x64 头像 | 跟随 V2 archetype 同步导出 |
| 基底 UI 图标 | `assets/ui/icons/enemy_archetypes/` | 8 个小图标 + 3 个高精图标 | 统一压成 64x64/128x128 两档源图，manifest 只登记运行时文件 |
| 词条 UI 图标 | `assets/ui/icons/enemy_affixes/` | 专属词条 + 通用词条图标 | 以“嵌槽符号”重画，不做完整敌人头像 |
| Normal / Elite golem fallback | `assets/sprites/enemies/golem_*.png` | `golem_normal.png` 已重做；`golem_elite.png` 待重做 | 第四批重生成，使普通/精英 fallback 也符合磨石母题 |

不在首轮处理：UI 9-Slice、弹药/符文/遗物图标、Boss 专属完整动画。它们应在敌人基底风格稳定后再进入下一阶段。

## 2. 风格总则

所有新资产必须遵守 [`enemy_geometric_whetstone_style.md`](enemy_geometric_whetstone_style.md)：

- 主体是可碰撞的几何磨石块，有倒角、磨损边、切削痕、矿脉和块体厚度。
- 专属机制核心嵌入石槽内部，不悬浮在外。
- 通用词条只作为薄膜、刻线、边缘晶片或局部发光覆层。
- 相机必须是正交游戏 Sprite 视角：正面为主，仅允许约 10 度轻微俯视，禁止侧视、强三分之二透视或插画式夸张透视。
- 光线必须是居中的前顶光 / 顶前棚拍光：主体左右明暗均衡，核心光只是辅助强调，禁止强侧光、地面投影或环境光烘进资产。
- 透明背景，不带文字、血条、UI 框、地面投影、完整背景或 Logo。
- 运行时不要求 GIF。正式交付以 PNG Sprite Sheet + JSON manifest 为准。

## 3. 重生成批次

### Batch A：8 个 V2 基底 Sprite

目标：重画现有 8 个 V2 基底，建立统一家族感。

| 优先级 | resourceId | baseArchetype | footprint | 画面重点 |
|---|---|---|---|---|
| A0 | `enemy_bastion_3x1` | `bastion` | 3x1 | 三段横向磨石梁、中央厚甲嵌核、铆钉槽 |
| A0 | `enemy_maw_2x2` | `maw` | 2x2 | 掏空圆角磨石胃囊、暗红吞噬腔、锯齿石槽 |
| A1 | `enemy_deflector_2x1` | `deflector` | 2x1 | 低矮楔形盾石、前缘偏折薄膜槽 |
| A1 | `enemy_echo_spire_1x2` | `echoSpire` | 1x2 | 细高空心石柱、顶部裂纹晶核、内嵌声纹 |
| A2 | `enemy_prism_1x3` | `prism` | 1x3 | 竖直折光磨石棱柱、白色折射线 |
| A2 | `enemy_hive_2x3` | `hive` | 2x3 | 多孔孵化石巢、半透明卵囊嵌孔 |
| A3 | `enemy_siege_3x2` | `siege` | 3x2 | 双层履带磨石车、推铲、抗冻热管 |
| A3 | `enemy_gravity_core_3x3` | `gravityWell` | 3x3 | 三层环形磨石炉心、中央黑核、向心网格 |

交付要求：

- 每个 Sprite Sheet 保持 128px frame contract。
- 最低交付：`idle` 4 帧 + `hit` 2 帧。
- 推荐交付：`idle` 4 帧、`hit` 2 帧、可选 `move` 4 帧、可选 `cast` 4 帧。
- 同步导出 `assets/icons/enemies/<resourceId>.png`。

### Batch B：现有 6 个 Composite Sprite

目标：优先重画 manifest 已登记的精确组合，保证高频战斗单位最先统一。

| assetKey | resourceId | 重画重点 |
|---|---|---|
| `residue:1x1:` | `enemy_residue_1x1` | 单格低威胁磨石残渣，小嵌核，不抢大型敌人权重 |
| `bastion:3x1:heavyArmor` | `enemy_bastion_heavyarmor_3x1` | 比 base bastion 更厚的外侧磨边与装甲槽 |
| `maw:2x2:devour` | `enemy_maw_devour_2x2` | 吞噬腔更明显，但主体仍是掏空磨石 |
| `siege:3x2:siege` | `enemy_siege_siege_3x2` | 推铲、履带、热管更明显，表现冰冻免疫 |
| `echoSpire:1x2:echoRelay` | `enemy_spire_echorelay_1x2` | 双层声纹嵌入柱体，不做外部大光环 |
| `deflector:2x1:deflectionWard` | `enemy_ward_deflection_2x1` | 前缘偏折膜和副屏障槽，不画全身护罩 |

2026-06-21 可读性评审：否决“在完整主体上硬开孔”的 `_readability_v2` 方案。后续重绘必须从概念阶段设计为原生镂空结构，例如环形石框、桥架、肋骨、蜂巢孔、履带拱架、悬浮核心等；镂空区域应是结构本身的一部分，用来露出 Layer 2 HP 液体，而不是后期从完整石块上切掉。第一批已接入 `*_native_hollow*` 运行时素材：`residue:1x1:`、`maw:2x2:devour`、`siege:3x2:siege`，并补充 `maw` / `siege` / `hive` archetype fallback。

### Batch C：Overlay 与图标统一

目标：让通用词条在任意体型上都像“覆层”，而不是另一套身体。

| 类型 | 目标资产 | 风格规则 |
|---|---|---|
| Overlay | `shield`、`regen`、`berserk`、`haste`、`healer`、`clone` | 透明 PNG，边缘化构图，中心留空，不遮挡嵌核 |
| 专属词条图标 | `devour`、`heavyArmor`、`deflectionWard`、`echoRelay`、`prism`、`hive`、`siege`、`gravityWell` | 只画符号或嵌槽，不画完整敌人 |
| 基底图标 | 8 个 baseArchetype | 从 Batch A 主体裁切/重绘为 64x64，保持 silhouette 可读 |

### Batch C2：碰撞材质框 Collision Frame

目标：让敌人的**物理碰撞框**拥有和基底一致的磨石质感，同时保留现有血条、数字、状态标签和预警 UI。Frame 不是装饰容器，必须沿 `spawn_applyArchetypeShape()` 中的 `collisionShape` / `collisionData` 绘制。

当前实装：`assets/sprites/enemies/enemy_sprite_manifest.json` 新增 `frames` 段，`resolveEnemyVisualAsset(enemy)` 返回 `frameKey/framePath/frameShape`，`Enemy._drawCollisionFrameBitmap()` 在 Layer 4.9 后、Layer 5 矢量描边前绘制材质框。该层复用敌人绘制开始时建立的碰撞 clip，因此实际可见区域与物理碰撞框一致。

| frameKey | footprint | 画面重点 |
|---|---|---|
| `frame_bastion_3x1` | 3x1 | 已接入；AABB 矩形碰撞框，直边直角，三段纹理只能在框内表达 |
| `frame_maw_2x2` | 2x2 | 已接入；六点 polygon：`(-.45,-.45) → (.45,-.45) → (.50,.10) → (.20,.50) → (-.20,.50) → (-.50,.10)` |
| `frame_deflector_2x1` | 2x1 | 已接入；六点低盾 polygon：`(-.50,.30) → (-.30,-.45) → (.30,-.45) → (.50,.30) → (.30,.50) → (-.30,.50)` |
| `frame_echo_spire_1x2` | 1x2 | 已接入；五点尖塔 polygon：`(0,-.50) → (.30,-.30) → (.40,.45) → (-.40,.45) → (-.30,-.30)` |
| `frame_prism_1x3` | 1x3 | 棱镜切面石框、白色折光内线 |
| `frame_hive_2x3` | 2x3 | 多孔孵化石框、卵囊小嵌孔但中心留空 |
| `frame_siege_3x2` | 3x2 | 履带磨石框、推铲边、热管槽 |
| `frame_gravity_core_3x3` | 3x3 | 环形炉心石框、向心网格边缘 |

Boss 历史转换出的 1×1 异型随从不走旧 Canvas 轮廓提示，运行时按 `collisionData.vertices` 识别并使用 `frame_minion_ignis/glacies/mikro/devourer/viridis/tesla/chimera/ouroboros_1x1.png`。这些 PNG 必须由 `spawn_applyMinionShape()` 的真实物理 hull 生成，主体 sprite 仍由 normal/elite 敌人图负责。

接入建议：

- manifest 可新增 `frames` 段，键使用 `<baseArchetype>:<cols>x<rows>`，并记录 `shape: 'aabb' | 'polygon' | 'arc'` 与归一化顶点。
- Frame PNG 必须中心透明，不能烘进 HP 液体、数字、状态短标或预警面板。
- Frame 外轮廓必须与物理碰撞框一致，所有倒角、齿槽、镶嵌线、裂纹只能落在框厚内部，不能向外扩展或改变玩家对碰撞范围的判断。
- 运行时绘制顺序建议：
  1. 当前 Layer 1/2：底层槽、血条、延迟白条、回血条保持不变；
  2. 新 Layer 2.8 或 Layer 5 前：绘制材质 Frame，作为容器边缘；
  3. 当前状态短标、HP 数字、telegraph、选中高亮继续在上层绘制。
- 若只使用 `drawImage` 叠加 PNG，不新增粒子、渐变或混合模式，可不增加 `CONFIG.performance` 预算；若增加动态发光或高开销混合，必须按性能规范补评估。

### Batch D：Normal / Elite fallback

目标：重画 `golem_normal.png` 与 `golem_elite.png`，让没有 V2 资源命中的敌人也符合新母题。

当前进度：`golem_normal.png` 已用高质量静态磨石主体重做，并按原 `golem_normal.json` 包装为 `idle(6) / move(4) / hit(2)` Sprite Sheet；`enemy_residue_1x1_idle.png` 同步替换为同一主体的高分辨率单帧 composite。常规 1×1 与 V2 大型敌人一样使用独立 collision frame；`frame_residue_1x1.png` 必须由 1×1 真实碰撞 hull 生成并接管运行时物理边界表达，主体 sprite 不得再烘焙额外 UI 式边框。2026-06-21 起 `residue:1x1:` manifest 改用 `enemy_residue_1x1_native_hollow_idle.png`，普通敌人读血优化走原生中空磨石环路线，不在现有完整石块上挖孔。

- Normal：单格切角磨石块，小暗核，低饱和。
- Elite：同 silhouette，但裂缝更亮、嵌核更清晰、边缘有紫色晶化纹。
- 保持 `golem_normal.json` / `golem_elite.json` 的动画契约，避免改代码。
- 普通敌人的“框”必须走 `residue:1x1` collision frame 资产层；主体 sprite 只负责内部磨石/晶核，不得把边框烘焙进主体图，也不得回退到旧矢量圆角描边。
- 本轮源图记录在 `docs/design/concepts/enemy_normal_redo/`，后续若调整普通敌人，优先从该高分辨率透明源图重新裁切，而不是添加额外边框层。

### Batch E：Boss 专属资产预研

目标：先出概念与头像，不立刻接入完整 Boss Sprite。

| Boss | 磨石母题方向 |
|---|---|
| Ignis | 熔炉磨石装甲，火焰核心嵌在炉口 |
| Glacies | 霜晶缝合磨石，冰晶从裂缝生长 |
| Mikro | 雷电裂变磨石，多触点晶核 |
| Devourer | 巨型掏空磨石深渊口 |
| Viridis | 剧毒藤蔓侵蚀的多孔磨石 |
| Tesla | 机械线圈嵌入磨石核心 |
| Chimera | 多核心拼接磨石融合体 |
| Ouroboros | 环形磨石蛇炉，首尾嵌合 |

## 4. Prompt 模板

### 4.1 Sprite Sheet 主模板

```text
Use case: stylized-concept
Asset type: transparent game enemy sprite sheet
Primary request: <resourceId>, <Chinese name>, <footprint>, <role>
Style/medium: dark alchemical fantasy game sprite, high-detail painted bitmap, readable at 128x128
Camera/view: strict orthographic game sprite view, front-facing with slight top-down angle about 10 degrees, no perspective skew, no dramatic side view, centered symmetrical silhouette
Lighting: centered top-front studio light, even readable game lighting, no strong side light, no long cast shadow, core glow is secondary
Subject: geometric whetstone block base with an embedded mechanism core, not a soft creature
Materials/textures: beveled worn stone, chipped mineral surface, carved socket, ground edges, subtle cracks, dark metal-mineral accents
Composition/framing: centered full-body sprite, generous transparent padding, clear silhouette matching <footprint>
Animation rows: idle 4 frames, hit 2 frames; keep shape consistent between frames
Color palette: low-saturation dark stone body, mechanism accent color based on <affix/archetype>
Constraints: transparent or flat chroma-key background for removal, no text, no UI, no health bar, no logo, no floor plane, no floor shadow, no background scene
Avoid: side-view perspective, three-quarter dramatic render, strong side lighting, pure flame body, pure mist, soft organic blob, sci-fi vehicle without stone base, oversized glow covering silhouette
```

### 4.2 Overlay 模板

```text
Use case: stylized-concept
Asset type: transparent scalable game affix overlay
Primary request: <affix> overlay for enemy sprites
Subject: thin edge overlay made of etched alchemical lines, small crystal chips, or translucent membrane
Composition/framing: border-weighted design with mostly empty center, usable over many enemy sizes
Camera/view: flat orthographic overlay, no perspective skew
Lighting: neutral centered light, glow only as a small accent
Constraints: transparent background, no complete creature body, no text, no health bar, do not obscure embedded cores
```

### 4.2.5 碰撞材质框 Frame 模板

```text
Use case: stylized-concept
Asset type: transparent game enemy collision-frame material concept
Primary request: <frameKey>, <footprint>, materialized physical collision frame for preserving internal HP liquid UI
Camera/view: strict orthographic game sprite view, front-facing with slight top-down angle about 10 degrees, no perspective skew, centered symmetrical silhouette
Lighting: centered top-front studio light, even readable game lighting, no strong side light, no cast shadow
Subject: collision-aligned hollow geometric whetstone border frame; center mostly empty for HP bar visibility
Shape constraints: exact outer silhouette follows <collisionShape/collisionData>; no protrusions outside the physical shape; no decorative gaps that change collision readability
Materials/textures: chipped mineral stone, beveled worn edges, carved grooves, restrained embedded core accents
Composition/framing: centered hollow frame matching <footprint>; green or transparent center and outside; border only
Constraints: transparent or flat chroma-key background visible through center and outside, no text, no UI numbers, no health bar, no logo, no floor plane
Avoid: decorative container unrelated to collision, filled creature body, side-view perspective, strong side lighting, solid opaque center, oversized glow covering the inner HP area
```

### 4.3 图标模板

```text
Use case: stylized-concept
Asset type: 64x64 game UI icon
Primary request: <baseArchetype or affix> icon
Subject: compact emblem derived from geometric whetstone block sockets and embedded core symbol
Composition/framing: centered, readable at 32x32 and 64x64
Camera/view: orthographic frontal icon view
Lighting: centered top-front light, no side-lit illustration
Constraints: transparent background, no text, no numbers, no full enemy scene
```

## 5. 生成与接入流程

1. 为 Batch A 每个 `resourceId` 先生成 1 张高质量概念图或 1 行 idle 帧预览。
2. 选定风格后，再扩展为 128px frame contract 的 Sprite Sheet。
3. 把最终 PNG 放入对应目录：
   - `assets/sprites/enemies/v2/<resourceId>.png`
   - `assets/sprites/enemies/archetypes/<resourceId>.png`
   - 或 `assets/sprites/enemies/composites/<resourceId>_idle.png`
4. 更新同名 JSON manifest 的 `animations` 与 `placeholder:false`。
5. 若新增组合，更新 `assets/sprites/enemies/enemy_sprite_manifest.json`。
6. 若替换已有资源但文件名不变，优先不改代码；只验证 manifest 命中。
7. 运行试炼场 `enemy_v2` 分类逐个验收。

## 6. 验收清单

每个资产必须通过以下检查：

- Silhouette：在 128px 下能读出 footprint 和 baseArchetype。
- View：必须是正交正面轻俯视；禁止明显侧面、三分之二透视或插画构图。
- Light：主体使用居中前顶光；禁止强侧光和烘进地面的投影。
- Family：看起来属于几何磨石块家族，而不是独立怪物种族。
- Core：专属机制核心嵌在石槽内部。
- Overlay：通用词条不会遮挡主体轮廓和专属核心。
- Runtime：`describeAssetHitStatus()` 显示 Composite Sprite 或 Sprite 命中，不出现 Missing asset。
- Frame：材质边框必须匹配物理碰撞框，中心必须透明，不能挡住 HP 液体、HP 数字、状态短标或预警 UI。
- Fallback：删除或故意改错资源时，敌人仍能回退到矢量基底，不白屏。
- Performance：纯位图替换不新增预算；若新增运行时粒子/混合/渐变，按 `.cursor/rules/performance.md` 补评估。

## 7. 执行优先级

| 周期 | 内容 | 完成标准 |
|---|---|---|
| Pass 1 | Batch A0/A1：bastion、maw、deflector、echoSpire | 4 个基底在试炼场可读，图标同步 |
| Pass 2 | Batch A2/A3：prism、hive、siege、gravityWell | 8 个 V2 基底全部统一 |
| Pass 3 | Batch B：6 个 composite | 高频组合命中 composite，fallback 未破坏 |
| Pass 4 | Batch C2：material frame | 边框质感提升，HP/UI 可读性不下降 |
| Pass 5 | Batch C：overlay + icon | 通用词条覆层不遮挡主体 |
| Pass 6 | Batch D：normal / elite fallback | 普通/精英旧魔像也统一为磨石母题 |
| Pass 7 | Batch E：Boss 概念 | 8 个 Boss 头像/概念方向通过审美验收 |
