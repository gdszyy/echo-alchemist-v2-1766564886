# 敌人美术与词条特效落地影响范围评估

作者：**Manus AI**  
状态：阶段评估稿  
关联文档：[`docs/enemy_visual_design_v2.md`](enemy_visual_design_v2.md)

## 1. 评估结论

本轮评估认为，敌人美术设计后续应从单纯的运行时矢量绘制，逐步升级为**资产键驱动的组合式敌人形象系统**。当前仓库已经具备敌人实体、词条行为、粒子系统、生成系统和部分 Sprite 渲染入口，因此不建议一次性为所有组合写死分支，而应先建立 `baseArchetype + affixSet + sizeFootprint` 的稳定资产命名规则，再将缺失资产回退到现有 Canvas 矢量绘制。这样可以同时支持“每一个词条组合生成一个美术资产敌人形象”的目标，并避免组合数量增长后破坏性能和维护性。[1] [2]

2026-06-19 追加风格约束：组合资产的视觉差异必须建立在同一套“几何磨石块基座 + 镶嵌核心”母题上。`baseArchetype` 决定磨石基座的 footprint 和块体轮廓，专属词条决定嵌入石槽的核心，通用词条只改覆层纹路或边缘薄膜。详见 [`docs/design/enemy_geometric_whetstone_style.md`](design/enemy_geometric_whetstone_style.md)。

> 建议的核心约定是：敌人最终美术身份由 `baseArchetype`、`gridCols/gridRows` 和排序后的 `affixes` 共同决定。代码优先查找精确组合资产，缺失时回退到“基底资产 + 词条叠层特效 + 现有矢量绘制”。

| 待修改点 | 影响范围 | 建议优先级 | 推荐落地方式 |
|---|---:|---:|---|
| `0. siege` 新机制 | 中 | P0 | 已修改设定与代码，仍需实机验证推挤链边界。 |
| `1. 每个词条组合的敌人美术资产` | 高 | P1 | 建立资产键、清单生成器和缺省回退，不一次性手写所有组合。 |
| `2. 非 1×1 敌人词条特效适配` | 高 | P1 | 将词条特效从固定半径改为基于 `width/height/grid footprint` 的锚点系统。 |
| `3. 新词条特效制作和适配` | 中高 | P1 | 为 V2 专属词条补齐触发特效、常驻特效和受击反馈。 |
| `4. 预设波次组合设计与出场设计` | 高 | P2 | 新增导演型 wave preset 层，控制大型敌人与通用词条的组合节奏。 |

## 2. `siege` 新机制影响范围

`3×2` 的 `siege` 已从旧的周期性重压推进改为**破阵推挤**。它无法被冰冻，且在执行普通移动时，如果目标区域被前方敌人阻挡，就尝试将阻挡链条整体向前推动一行。该机制会影响敌人行动顺序、碰撞预测、冰冻结算、UI 说明和生成系统中的移动间隔配置。[3] [4]

| 文件 | 已处理内容 | 后续验证点 |
|---|---|---|
| `src/entities/enemy.js` | 在敌人普通移动分支中加入 `siege` 推挤链。推挤成功时，阻挡敌人先移动，`siege` 再移动，并播放推挤反馈。 | 多个大型敌人互相阻挡、推到失败线、阻挡链过长时的行为是否公平。 |
| `src/game_phase.js` | 冰冻赋值时排除 `siege`，并给出 `FREEZE IMMUNE` 反馈。 | 旧状态残留、回合开始温度多次结算与 `berserk` 叠加时是否仍免疫冻结。 |
| `src/config.js` | 移除旧 `siegePushInterval/siegePushRows` 语义，保留 `siegeMoveInterval` 作为迟缓移动节奏。 | 数值上是否需要比 `heavyArmor` 更慢，当前建议仍为 2 回合。 |
| `src/spawn_system.js` | `siege` 仍作为 `3×2` 大型基底生成，维持高血量、低频出现。 | 与 wave preset 绑定后，避免同一波次出现过多推挤单位。 |
| `src/systems.js` | 敌人状态面板说明更新为破阵推挤机制。 | 需要在词条图标或说明中强调“冰冻无效”。 |
| `docs/enemy_visual_design_v2.md` | 视觉设定由攻城重压改为破阵履带，强调推铲、抗冻热管和推挤尘埃。 | 后续资产制作时应把“不可冻结”做成常驻识别特征。 |

## 3. 敌人组合美术资产设计

当前敌人绘制管线已经存在 `initSprite()`、`_drawArchetypeBody()`、词条颜色映射和运行时 Canvas 特效层。后续若要做到每一个词条组合都有独立敌人形象，应新增一个**资产解析层**，不要直接让 `Enemy.draw()` 依赖大量 `if affixes.includes()` 的组合分支。[1]

建议资产键采用以下格式：

```text
enemy/{tier}/{cols}x{rows}/{base_archetype}/{affix_key}.png
```

其中 `affix_key` 应使用按稳定优先级排序的词条 ID，例如 `shield+regen`、`deflectionWard`、`siege+berserk`。对于只有通用词条的普通敌人，`base_archetype` 可以是 `normal`；对于 V2 大型基底，`base_archetype` 应使用 `bastion`、`maw`、`deflector`、`echoSpire`、`prism`、`hive`、`siege`、`gravityWell` 等生成系统已有字段。[3]

| 资产层级 | 资产数量控制 | 示例 | 说明 |
|---|---:|---|---|
| 基底资产 | 低 | `enemy/elite/3x2/siege/base.png` | 每种尺寸和基底至少一张，保证基础识别。 |
| 单词条组合资产 | 中 | `enemy/normal/1x1/normal/shield.png` | 通用词条在普通敌人上给完整形象，在大型敌人上优先用叠层。 |
| 双词条组合资产 | 高 | `enemy/normal/1x1/normal/shield+haste.png` | 只建议覆盖高频组合和预设波次组合，不建议完全穷举。 |
| V2 专属组合资产 | 中 | `enemy/elite/2x1/deflector/deflectionWard+berserk.png` | 专属词条必须保留基底轮廓，通用词条只改变材质和局部发光。 |
| 缺省回退资产 | 必需 | `enemy/elite/3x3/gravityWell/base.png` | 未命中组合资产时由“基底资产 + 词条特效叠层”兜底。 |

## 4. 非 `1×1` 敌人词条特效适配

现有词条特效大多以敌人中心、`radius` 或固定比例绘制。对于 `2×1`、`1×2`、`2×2`、`3×2` 和 `3×3` 敌人，这种方式会导致护盾不覆盖完整轮廓、治疗波与边界不贴合、速度线偏移、吞噬口过小或印章挤在中心。因此，需要把词条特效升级为**锚点驱动**。[1]

2026-06-22 补充：奖励敌人的边框、词条常驻 Overlay 和词条触发反馈必须拆成三层，详见 [`docs/design/enemy_affix_visual_iteration_plan.md`](design/enemy_affix_visual_iteration_plan.md)。其中带遗物敌人使用独立金色 reward frame，不应复用 `shield` 或 elite 边框；旧 `chaos_essence` / `pure_essence` 分支不进入本轮敌人奖励美术目标；`shield`、`deflectionWard` 和 `jump` 需要额外事件反馈，而不是只靠常驻纹理表达。

| 特效类型 | 当前风险 | 非 `1×1` 适配规则 |
|---|---|---|
| 常驻护盾 | 大体型只包住中心，无法表达完整屏障。 | 使用 `max(width, height)` 决定屏障外接尺寸，并根据碰撞形状裁剪。 |
| 速度线与拖尾 | `3×2` 或 `2×3` 会出现线条穿模。 | 以移动方向建立前缘、后缘锚点，尾迹从后缘发出。 |
| 再生气泡 | 气泡集中在中心，缺少体积感。 | 在轮廓内按 `gridCols × gridRows` 分布多个低密度节点。 |
| 吞噬/孵化 | 大型口器或卵囊不应只在中心缩放。 | 用基底局部锚点，例如 `maw.mouth`、`hive.eggPods`。 |
| 棱盾屏障 | 屏障只阻挡反弹与穿透，需要区别于普通 `shield`。 | 在前缘倾斜棱面绘制薄膜与副屏障条，不画全身护罩。 |
| 破阵推挤 | 推挤反馈需要表现阻挡链，而非只表现自身。 | 从 `siege` 推铲到被推动敌人之间生成尘埃、短震波和位移箭头。 |
| 奖励边框 | 奖励目标被词条膜层或大型基底边框淹没。 | 独立 reward frame 层：遗物=金边，低档保留平面双描边。 |
| 跳跃腾空 | 只有常驻弹簧线时，玩家看不出敌人越过了阻挡物。 | 使用 `_jumpFxTimer` 驱动视觉抬升、椭圆影子和落地短线，真实碰撞不跟随视觉偏移。 |

建议新增轻量函数 `getEnemyVisualAnchors(enemy)`，统一返回 `center`、`frontEdge`、`rearEdge`、`corners`、`bodyNodes`、`affixBadgeSlots` 和 `archetypePorts`。这样 `src/entities/enemy.js`、`src/effects/particles.js` 和未来资产叠层可以共用同一套几何语义。[1] [5]

## 5. 新词条特效制作与适配

V2 专属词条已经具备基础绘制识别，但还需要补齐“常驻、触发、受击、死亡”四类反馈，才能与通用词条处于同等完成度。新词条特效不应只依赖颜色图标，而应让玩家在不看文字时也能判断行为风险。

| 词条 | 常驻特效 | 触发特效 | 受击/结算反馈 | 备注 |
|---|---|---|---|---|
| `deflectionWard` | 前缘青蓝薄膜、副屏障条。 | 反弹或穿透伤害被屏障抵挡时产生棱面闪烁。 | 屏障破碎时出现晶片散射；未破碎回合开始回满时出现薄膜回流。 | 火焰和毒结算应绕过屏障，不播放阻挡反馈。 |
| `echoRelay` | 空心尖塔的双层环形波。 | 周围敌人词条被额外触发时，连接一条短暂声波线。 | 自身血量低，应避免过厚护盾视觉。 | 需要明确“触发了谁”的反馈。 |
| `prism` | 纵向折射线和棱镜边。 | 激光折射或分束时出现二级光路。 | 受击处生成白色折光片。 | 与 `laser` 相关代码耦合高。 |
| `hive` | 卵囊呼吸、幼体剪影。 | 孵化时生成黏液波和幼体落地粒子。 | 卵囊受击收缩。 | 需要避免幼体生成过多造成性能压力。 |
| `siege` | 推铲警戒线、抗冻热管。 | 推挤成功时显示链式尘埃与前推震波。 | 冰冻免疫时显示热管闪烁。 | 本轮已接入基础文本与震波，仍需美术化。 |
| `gravityWell` | 黑核与向心网格。 | 牵引或偏折时显示弧形轨迹。 | 受击时内核短暂塌缩。 | 与弹道系统耦合高。 |
| `siphon` | 坩埚液面和上升气泡。 | 吸收死亡或温度变化时绘制能量流。 | 护盾/回血时液面升高。 | 当前是备用基底，需先决定是否进入生成池。 |

## 6. 预设波次组合与出场设计影响范围

当前生成系统已经有大型基底生成、Boss 配置和词条曲线，但缺少一层明确的“导演型预设波次”。如果要设计敌人组合出现的功能，应新增独立的 wave preset 数据结构，由回合、难度、Boss 前后节奏和可用基底池共同决定。预设波次不应完全替代随机生成，而应作为关键教学、强压和复盘记忆点出现。[3] [6]

| 预设类型 | 设计目标 | 示例组合 | 代码影响 |
|---|---|---|---|
| 教学预设 | 首次展示新机制，降低叠加噪音。 | `deflector(2×1)` 单独出现，周围只放普通敌人。 | 生成系统需要支持按 footprint 锁定位置。 |
| 协同预设 | 让玩家理解敌人之间的组合关系。 | `echoSpire(1×2)` + `regen/healer` 小队。 | `echoRelay` 需要清晰标记额外触发对象。 |
| 空间压迫预设 | 强调大体型与阵线控制。 | `siege(3×2)` 前方带 1×1 盾兵，被推动形成压力墙。 | 需要验证推挤链和失败线判定。 |
| 弹道改造预设 | 让玩家调整射击路径。 | `prism(1×3)` + `gravityWell(3×3)` 分开放置。 | 激光、弹道偏折和大体型碰撞需要统一视觉语言。 |
| 经济/产卵预设 | 制造持续压力但避免失控。 | `hive(2×3)` 后排 + 低血幼体前排。 | 需要敌人数上限和粒子预算保护。 |

建议新增 `src/wave_presets.js` 或在 `src/spawn_system.js` 内先建立 `SPAWN_PRESETS` 常量。每个 preset 至少应包含 `id`、`roundRange`、`weight`、`slots`、`introText`、`maxUses` 与 `cooldownRounds`。当 preset 无法放置时，应安全回退到现有随机生成逻辑。[6]

## 7. 分阶段执行建议

后续执行可以分三步推进。第一步，先完成 `siege` 机制实机验证，并把 V2 专属词条的状态面板、常驻特效和触发反馈补齐。第二步，建立资产键解析与清单生成器，优先覆盖所有基底资产、所有单词条资产和 10 到 15 个高频双词条组合。第三步，再引入预设波次系统，用少量高质量组合验证大型敌人与词条组合的节奏。

| 阶段 | 目标 | 完成标准 |
|---|---|---|
| P0 | `siege` 新机制闭环。 | 冰冻免疫、阻挡推挤、UI 说明、设计文档和语法检查全部通过。 |
| P1 | 词条特效与资产键基础设施。 | 非 `1×1` 敌人特效不再明显错位；缺失组合资产有稳定回退。 |
| P2 | 新词条触发特效。 | 每个 V2 专属词条至少有常驻、触发、受击三类反馈。 |
| P3 | 预设波次系统。 | 至少 5 类 preset 可按回合权重出现，并能安全回退随机生成。 |
| P4 | 组合资产扩展。 | 通过脚本生成资产清单，逐步填充高频组合。 |

## 7.5 资源目录与 manifest（V2 美术接入）

为了把外部生成的敌人美术接入运行时，仓库现在固化了以下统一目录约定。所有解析逻辑由 `resolveEnemyVisualAsset(enemy)`（位于 `src/data/enemy_visual_assets.js`）统一处理，SpriteRenderer 与试炼场 UI 共享同一组资源键，**不再允许在多处重复硬编码命名**。

| 资源类型 | 目录 | 命名规范 | 当前已接入 |
|---|---|---|---|
| 基底 Sprite Sheet（多帧 idle/hit） | `assets/sprites/enemies/archetypes/` | `enemy_<base>_<cols>x<rows>.png` + 同名 `.json` | bastion / maw / deflector / echoSpire / prism / hive / siege / gravityCore（占位） |
| 组合 Sprite（baseArchetype + 主词条 + 占格） | `assets/sprites/enemies/composites/` | `enemy_<base>_<affix>_<cols>x<rows>_idle.png` + 同名 `.json` | residue 1×1 / bastion+heavyArmor 3×1 / maw+devour 2×2 / siege+siege 3×2 / spire+echoRelay 1×2 / ward+deflectionWard 2×1 |
| 通用词条覆盖层 | `assets/sprites/enemies/overlays/` | `overlay_affix_<affix>.png` | shield / regen / berserk / haste / healer / clone |
| 基底 UI 图标 | `assets/ui/icons/enemy_archetypes/` | `archetype_<base>.png`（保留旧名 `enemy_<base>_<...>.png` 兼容） | bastion / maw / siege（专属图标） + V2 全 8 基底 64×64 头像 |
| 词条 UI 图标 | `assets/ui/icons/enemy_affixes/` | `affix_<affix>.png` | devour / heavyArmor / siege / shield / regen |

> 中央索引文件：[`assets/sprites/enemies/enemy_sprite_manifest.json`](../assets/sprites/enemies/enemy_sprite_manifest.json)。
> 每条 composite 条目都使用 `<baseArchetype>:<cols>x<rows>:<sortedAffixSet>` 作为键，例如 `bastion:3x1:heavyArmor`、`siege:3x2:siege`、`residue:1x1:`（空 affixSet 末尾留冒号）。

2026-06-22 补充：敌人针对词缀的生成前清单独立记录在 [`docs/enemy_targeting_asset_todo.md`](enemy_targeting_asset_todo.md)。其中 `carrier` 使用显示名“铸巢母架”，第 5 格空舱需要在本体、collision frame 与图标中同时保留；`livingArmor` / `armorSpore` / `phaseShield` 等状态型资产走 `dynamicOverlays`，由 `resolveDynamicEnemyOverlayPaths(enemy)` 按当前状态选择。不存在的 PNG 不应提前写入 `enemy_sprite_manifest.json`，避免资源命中状态误报。

### 7.5.1 manifest 字段

```json
{
  "directories":     { "archetypes": "...", "composites": "...", "overlays": "...", "archetypeIcons": "...", "affixIcons": "..." },
  "archetypeIcons":  { "<baseArchetype>": "<archetype_xxx.png>" },
  "affixIcons":      { "<affix>":         "<affix_xxx.png>" },
  "overlays":        { "<affix>":         "<overlay_affix_xxx.png>" },
  "dynamicOverlays": { "<affix>":         { "<state>": "<overlay_state_xxx.png>" } },
  "archetypes":      { "<baseArchetype>": { "spritePath", "manifestPath", "footprint", "placeholder" } },
  "composites":      { "<assetKey>":      { "resourceId", "spritePath", "manifestPath", "baseArchetype", "footprint", "affixes[]", "placeholder" } }
}
```

新增组合时**只需要**：
1. 把新 PNG 放进 `composites/`（带 idle 后缀）或 `archetypes/`；
2. 在 `enemy_sprite_manifest.json` 的 `composites` / `archetypes` 段追加新键；
3. 如该词条还没有 UI 图标 / Overlay，按目录约定补充对应 PNG，并在 `affixIcons` / `overlays` 段登记文件名。

### 7.5.2 resolveEnemyVisualAsset(enemy) 返回值

```ts
{
  assetKey:        string,                                  // <baseArchetype>:<cols>x<rows>:<sortedAffixSet>
  spritePath:      string|null,                             // PNG 绝对路径（项目根相对）
  manifestPath:    string|null,                             // Sprite Sheet manifest（含 frameSize / animations）
  fallbackLevel:   'composite' | 'archetype' | 'vector',
  missingReasons:  string[],                                // 缺失原因（用于 UI 调试 / 自动巡检）
  archetypeIcon:   string|null,                             // UI 图鉴/卡片使用的基底图标
  affixIcons:      Array<{ affix: string, path: string|null }>,
  overlayPaths:    Array<{ affix: string, path: string }>,  // 通用词条覆盖层（可叠加在基底之上）
}
```

解析顺序：composite 命中 → archetype 命中 → vector fallback（程序化 Canvas 绘制）。任意一步缺失都不会抛错或留白，调用方按 `fallbackLevel` 决定如何渲染；`missingReasons` 记录每一步的缺失原因，用于试炼场 UI 上的状态徽章。

### 7.5.3 共享资源键：SpriteRenderer / 试炼场 / 图鉴

- `src/render/sprite_renderer.js` 的 `createSpriteRenderer({ type, baseArchetype, gridCols, gridRows, affixes, ... })` 现在第一步就调用 `resolveEnemyVisualAsset`，命中 composite/archetype 时直接使用 manifest 给出的路径；命中失败再回退到既有 V2 metadata，再回退到 `golem_elite` / `golem_normal`，最后由 SpriteRenderer 自身的 failed 状态触发 Canvas 矢量绘制。
- `src/entities/enemy.js` 的 `Enemy.initSprite()` 已传入完整 `gridCols / gridRows / affixes`，让组合 Sprite 能被命中。
- `src/entities/enemy.js` 的 `_drawAffixBitmapOverlays()` 会读取 `resolveEnemyVisualAsset(enemy).overlayPaths`，把通用词条覆盖层叠加在非 Boss 敌人的 Sprite/基底之上；资源缺失或未加载时静默跳过，继续保留既有 Canvas 词条视觉与短标签兜底。
- 2026-06-23 补充：敌人针对词缀的资产前读法由 `_drawEnemyTargetingFallback()` 兜底，但该 fallback 已收束为边框/外缘效果，避免遮挡敌人主体美术。它通过活体护甲边缘甲片、护甲孢子边缘种荚与飞线、相位护盾断窗边框、过量反应炉底部刻度、低伤硬壳角标、蓄能甲侧边电容、撞城者底部齿、铸巢母架空舱口与 1×1 偏折壳外缘旋转弧表达机制。正式 PNG / VFX 接入后应优先覆盖 frame / collision frame / 边缘 overlay 的同一语义点，不要删除 fallback。
- `src/systems.js` 的 `buildEnemyV2Scenarios` 不再硬编码 `placeholder` 字段，而是调用 `resolveEnemyVisualAsset` + `describeAssetHitStatus`，把 `Sprite / Composite Sprite / Overlay / Vector fallback / Missing asset` 标签同时显示在场景卡片的徽标和说明面板中。

## 8. 试炼场验收说明（enemy_v2 分类）

在 `src/systems.js` 的 `TRAINING_SCENARIOS` 中新增了 `enemy_v2`（显示名「敌人 V2 / 美术验收」）分类，入口为右侧边栏「驗收」Tab。该分类提供 7 个可点击场景，专门用于对每种 V2 基底进行独立的视觉验收，与 V2 矩陣（一次展示全部 9 种）互为补充。

### 8.1 场景列表

| 场景 ID | 名称 | 尺寸 | baseArchetype | affixes | 验收重点 |
|---|---|---|---|---|---|
| `ev2_ref_1x1` | 1×1 基准对照 | 1×1 | 无 | 无 / shield | 单格基线尺寸与精英变体对比 |
| `ev2_maw_2x2` | 2×2 深渊胃囊 | 2×2 | maw | devour | maw 胃囊形体 + devour 吞噬行为；旁边有 1×1 供吞噬测试 |
| `ev2_bastion_3x1` | 3×1 装甲横梁 | 3×1 | bastion | heavyArmor | 横向 3 格轮廓 + 迟缓移动节奏（2 回合/次） |
| `ev2_siege_3x2` | 3×2 攻城履带 | 3×2 | siege | siege | 冰冻免疫 + 静态展示履带形体 |
| `ev2_siege_push` | Siege 阻挡推挤 | 3×2 + 1×1×3 | siege | siege | 前排 3 个阻挡兵 + 后排 siege 推挤链；触发演示验证链推挤逻辑 |
| `ev2_large_generic_affix` | 大型 + 通用词条 | 2×2 + 1×1 | maw | devour+shield / regen | 通用词条（shield/regen）在大型基底上的视觉覆盖范围验收 |
| `ev2_fallback_large` | 资源 Fallback（3×3） | 3×3 | gravityWell | gravityWell | 验证未接入正式资源时程序化矢量回退是否正常渲染 |

### 8.2 实现约定

- 每个场景 `setup(game)` 显式创建 `Enemy` 实例并赋值：`baseArchetype`、`gridCols`、`gridRows`、`isWideEnemy`（cols≥2）、`affixes`、`width`、`height`、`maxHp/hp`，与 `spawn_trySpawnArchetypes` 字段命名一致。
- 调用 `game.spawn_applyArchetypeShape(e, archetypeId)` 为大型基底设置碰撞轮廓（polygon / arc / aabb）。
- 场景 `desc` 固定显示：`📐 footprint` / `基底` / `词条` / `⚙️ 行为摘要` / `📦 资源状态`。资源状态从 `ENEMY_V2_BY_ID[id].placeholder` 读取：`🟡 占位资源` 或 `✅ 已接入正式美术资源`。
- 不改变正式战斗默认刷怪概率、战斗平衡或存档逻辑；场景中敌人 `_moveInterval` 设置均为试炼场内部控制，不影响 `spawn_trySpawnArchetypes` 的生成逻辑。

### 8.3 后续验收流程

1. 打开试炼场 → 右侧边栏切换到「驗收」Tab。每个场景按钮右侧会出现资源命中状态徽章（绿 `Composite Sprite` / 蓝 `Sprite` / 黄 `Vector fallback` / 红 `Missing asset`），徽章颜色与 `describeAssetHitStatus(resolved).tag` 对齐。
2. 逐一点击 7 个场景，观察敌人形体与词条特效是否符合 `docs/enemy_visual_design_v2.md` 规范。说明面板的 `📦 资源` 行会展开 `[<tag>] <详细命中说明>　key=<assetKey>`，方便确认是哪一层资源被命中。
3. 对 `placeholder=true` 的基底，确认回退矢量绘制正常显示；有正式资源后，把 PNG 放入 `assets/sprites/enemies/composites/` 或 `assets/sprites/enemies/archetypes/`（按 §7.5 命名约定），在 `enemy_sprite_manifest.json` 中把对应键的 `placeholder` 改为 `false`（也可同时改 `ENEMY_V2_METADATA` 的 `placeholder`），**无需修改试炼场或 Enemy.draw 代码**。
4. 点击「触发演示」按钮，验证各基底的行为（吞噬、迟缓移动、推挤链、冰冻免疫）在试炼场环境中正常触发。
5. 资源缺失或路径写错时，徽章会显示 `Vector fallback` 或 `Missing asset`，说明面板会列出 `missingReasons`，敌人不会消失或报错——这是有意的兜底，符合「不允许报错或空白，必须回退到现有 Canvas 程序化绘制」的要求。

## References

[1]: ../src/entities/enemy.js "敌人实体绘制、行动与词条视觉实现"
[2]: ../src/render/sprite_renderer.js "Sprite 渲染管线"
[3]: ../src/spawn_system.js "敌人生成系统与大型基底生成"
[4]: ../src/game_phase.js "回合结算、温度与冰冻处理"
[5]: ../src/effects/particles.js "粒子与死亡特效系统"
[6]: ../src/config.js "词条数值、Boss 配置与敌人组合配置"
