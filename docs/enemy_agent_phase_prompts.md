# 敌人美术、词条特效与预设波次分阶段 Agent 提示词

作者：**Manus AI**  
状态：可执行提示词清单  
适用仓库：`gdszyy/echo-alchemist-v2-1766564886`  
前置提交：`9accb29 feat(enemy): update siege mechanic and impact plan`

本文档把后续敌人美术资产、非 `1×1` 词条特效、新词条特效、预设波次系统与 `siege` 实机验证拆成可顺序执行的 Agent 提示词。你可以把每一节中的提示词按顺序直接发给新的 Agent。每个 Agent 只负责当前阶段，不要求一次性完成全部内容；阶段之间通过 Git 提交和文档同步交接。

> 全部阶段默认要求先使用 `/repo-navigator` 了解当前实现，并优先阅读 `AGENTS.md`、`docs/enemy_visual_design_v2.md`、`docs/enemy_art_implementation_impact.md`、`docs/enemy_wave_preset_design.md`。若代码与文档冲突，以最新代码为准，但必须同步修正文档。

## 1. 阶段总览

当前仓库已经完成 V2 敌人视觉规范、运行时基底矢量美术、`siege` 破阵推挤机制、影响范围评估与预设波次设计稿。后续工作应先把机制闭环和基础设施打稳，再制作资产与特效，最后接入预设波次并扩展组合资产。

| 顺序 | 阶段 | 目标 | 主要产物 | 是否需要推送 |
|---:|---|---|---|---|
| 0 | 同步与基线核验 | 拉取最新代码，确认 `9accb29` 之后无未处理冲突。 | Git 状态、基线说明。 | 否，除非修复文档索引。 |
| 1 | `siege` 实机验证与边界修复 | 验证冰冻免疫、推挤链、越界和大型敌人阻挡。 | 最小修复、测试脚本或调试说明。 | 是。 |
| 2 | 视觉锚点系统 | 为所有尺寸敌人提供统一几何锚点。 | `getEnemyVisualAnchors()` 或等价模块。 | 是。 |
| 3 | 非 `1×1` 通用词条特效适配 | 让 `shield`、`regen`、`haste` 等特效适配大型 footprint。 | 通用词条特效改造。 | 是。 |
| 4 | 新专属词条特效补齐 | 为 `deflectionWard`、`echoRelay`、`prism`、`hive`、`siege`、`gravityWell` 做常驻、触发、受击反馈。 | 新词条特效与行为反馈。 | 是。 |
| 5 | 资产键解析与回退系统 | 建立 `baseArchetype + footprint + affixSet` 的资产查找。 | 资产 key 解析器、manifest、回退链。 | 是。 |
| 6 | 首批组合敌人资产设计 | 为所有首批 preset 和高频单词条组合生成独立形象资产或矢量规格。 | 资产清单、占位图或生成脚本。 | 是。 |
| 7 | 预设波次数据化与放置器 | 实现 `src/wave_presets.js` 和 footprint preset 放置逻辑。 | 8 个首批 preset，可安全回退。 | 是。 |
| 8 | 联调、平衡与文档收束 | 连续模拟、性能检查、文档索引与最终推送。 | 验收报告、最终文档更新。 | 是。 |

## 2. 阶段 0：同步与基线核验

这一阶段只做环境同步，不做功能开发。它的价值是确保后续 Agent 都站在同一个 Git 基线之上，避免对旧版本的 `siege` 或敌人视觉分支重复修改。

```text
使用技能 /repo-navigator 了解当前仓库实现，并拉取 GitHub 最新 main 分支。仓库是 gdszyy/echo-alchemist-v2-1766564886。请先检查当前分支、远端状态、未提交改动和最近 5 个提交，确认是否包含提交 9accb29 feat(enemy): update siege mechanic and impact plan。

请阅读并摘要以下文档：AGENTS.md、docs/enemy_visual_design_v2.md、docs/enemy_art_implementation_impact.md、docs/enemy_wave_preset_design.md。不要开始功能修改，只输出一份“当前基线核验报告”，说明当前代码里已经完成了什么、下一阶段应该从哪里开始。如果发现文档索引缺失或 Git 未同步，请只做最小修复并提交推送。

验收标准：git status 干净；报告中明确列出 src/entities/enemy.js、src/game_phase.js、src/spawn_system.js、src/config.js、src/systems.js 与敌人工作的关系；不要引入新的玩法代码。
```

## 3. 阶段 1：`siege` 实机验证与边界修复

`siege` 已经改为无法被冰冻，并在普通移动被阻挡时尝试推动前方阻挡链条。这个阶段的重点不是重新设计机制，而是验证边界条件，并在发现问题时做最小修复。

```text
使用技能 /repo-navigator 了解当前实现。请基于最新 main 分支验证 3×2 siege 敌人的新机制：无法被冰冻；移动时如果被前方敌人阻挡，会将前方阻挡链条一起向前推动 1 行；如果链条不可推动、会越界或产生重叠，则回退到正常阻挡逻辑。

请重点阅读 src/entities/enemy.js 中敌人移动、碰撞检测、advance、_trySiegePushChain 相关代码，以及 src/game_phase.js 中冰冻结算逻辑。然后设计最小验证方案，可以是临时调试脚本、单元式模拟函数、或在现有运行路径上插入可回滚的调试方法。不要大改生成系统。

必须覆盖这些场景：1）普通 1×1 敌人挡在 siege 前方时成功推挤；2）多个敌人形成链条时按顺序推挤且不重叠；3）链条末端接近失败线或边界时推挤失败；4）siege 被低温命中时不进入 isFrozenCurrentTurn；5）前方是大型敌人时不产生错误重叠。

完成后清理所有临时调试代码，只保留必要修复和文档记录。运行 node --check src/entities/enemy.js src/game_phase.js src/spawn_system.js src/config.js src/systems.js，并执行 git diff --check。若有修改，请更新 docs/enemy_art_implementation_impact.md 中 siege 后续验证点并提交推送。
```

## 4. 阶段 2：视觉锚点系统

这一阶段为后续所有特效和资产叠层建立公共几何语言。不要在各个词条里继续写固定半径和固定中心点，否则大型敌人会持续出现特效错位。

```text
使用技能 /repo-navigator 了解当前实现。请实现敌人视觉锚点系统，让 1×1、2×1、1×2、2×2、3×1、1×3、2×3、3×2、3×3 敌人都能返回统一的视觉锚点。

请优先阅读 docs/enemy_art_implementation_impact.md 的“非 1×1 敌人词条特效适配”部分，以及 src/entities/enemy.js、src/effects/particles.js、src/render/sprite_renderer.js。建议新增 getEnemyVisualAnchors(enemy) 或等价函数，可以放在 src/entities/enemy.js 的辅助函数区，或新建 src/enemy_visual_anchors.js；如果新建文件，请确保导入关系清晰且不产生循环依赖。

锚点至少包含 center、frontEdge、rearEdge、leftEdge、rightEdge、corners、bodyNodes、affixBadgeSlots、archetypePorts。archetypePorts 需要为 maw.mouth、hive.eggPods、deflector.wardPlane、echoSpire.core、prism.refractionLine、siege.plow、gravityWell.core 提供可选锚点。所有坐标必须基于敌人的 pos、width、height、gridCols、gridRows 或现有 footprint 字段计算，不能只用 1×1 半径。

完成后只把少量现有绘制调用迁移到锚点系统，避免一次性重构全部特效。需要添加注释说明哪些词条仍待迁移。运行 node --check 相关 JS 文件和 git diff --check。更新 docs/enemy_art_implementation_impact.md 的锚点系统状态，并提交推送。
```

## 5. 阶段 3：非 `1×1` 通用词条特效适配

本阶段把常见通用词条从“中心点特效”改为“footprint 特效”。它直接影响玩家是否能正确识别大型敌人的词条组合。

```text
使用技能 /repo-navigator 了解当前实现，并接续上一阶段的视觉锚点系统。请改造通用词条特效，让它们在非 1×1 敌人上不再错位或只覆盖中心。

优先处理 shield、regen、haste、berserk、healer、jump、clone、devour、heavyArmor 等已有通用词条的常驻视觉和触发反馈。请不要改变词条数值和战斗规则，除非发现明显 bug。对于大型基底，通用词条应作为叠层材质或局部光效存在，不能覆盖基底身份。例如 shield 在 3×2 siege 上应表现为推铲或履带边缘的能量节点，而不是一个只包住中心的小圆；regen 在 2×3 hive 上应表现为多个卵囊回流，而不是中心气泡。

请在 src/entities/enemy.js 和相关粒子函数中复用 getEnemyVisualAnchors(enemy)。对每个改造词条至少验证 1×1 和一个大型敌人形态。若特效粒子数量随面积增加，请设置上限，避免 3×3 敌人造成粒子峰值过高。

完成后更新 docs/enemy_art_implementation_impact.md 中“非 1×1 敌人词条特效适配”的状态表，说明已迁移和未迁移词条。运行 node --check、git diff --check，并提交推送。
```

## 6. 阶段 4：新专属词条特效补齐

这一阶段专注 V2 新词条的常驻、触发、受击和死亡反馈，不应同时扩大生成池。每个词条都要让玩家不用读文字也能理解其危险点。

```text
使用技能 /repo-navigator 了解当前实现。请为 V2 专属词条补齐视觉特效：deflectionWard、echoRelay、prism、hive、siege、gravityWell，以及可选的 siphon 如果当前文档仍保留它。

请阅读 docs/enemy_visual_design_v2.md 的第 5、6、7 节，以及 docs/enemy_art_implementation_impact.md 的“新词条特效制作与适配”。实现范围包括常驻特效、触发特效、受击或结算反馈。deflectionWard 需要偏折薄膜、副屏障条、屏障破碎晶片和回合回满回流；echoRelay 需要双环波和指向被额外触发敌人的声波线；prism 需要纵向折射线和分束反馈；hive 需要卵囊呼吸、孵化落地粒子和受击收缩；siege 需要抗冻热管、推铲警戒线、推挤尘埃；gravityWell 需要黑核、向心网格、牵引或偏折弧线。

不要在本阶段完整实现 prism 或 gravityWell 的复杂弹道物理，除非现有代码已经有明确入口。可以先做视觉反馈和接口占位，但必须在文档中标明行为是否已实现。所有新特效必须适配非 1×1 footprint，并复用视觉锚点系统。

完成后运行 node --check 和 git diff --check。更新 docs/enemy_visual_design_v2.md 与 docs/enemy_art_implementation_impact.md，把每个词条标记为“常驻完成 / 触发完成 / 行为待实现”等状态，并提交推送。
```

## 7. 阶段 5：资产键解析与回退系统

资产系统的目标是支持“每一个词条组合的敌人生成一个美术资产敌人形象”，但实现上必须允许缺失资产回退，避免被资产数量阻塞。

```text
使用技能 /repo-navigator 了解当前实现。请建立敌人组合美术资产的解析和回退系统，支持按 baseArchetype、gridCols/gridRows、tier、affixes 生成稳定资产键。

建议资产键格式沿用 docs/enemy_art_implementation_impact.md：enemy/{tier}/{cols}x{rows}/{base_archetype}/{affix_key}.png。affix_key 必须按稳定优先级排序，例如 shield+regen、deflectionWard、siege+berserk。请检查 src/render/sprite_renderer.js、src/entities/enemy.js、现有 assets 目录和 initSprite() 流程，新增 resolveEnemyAssetKey(enemy) 或等价函数。

回退链必须明确：精确组合资产 -> 单专属词条资产 -> 基底 base 资产 -> 现有 Canvas 矢量绘制。不要因为找不到 PNG 就报错或阻止敌人生成。请新增一个 manifest 或配置文件，用于声明已存在资产和待制作资产；如果当前没有真实 PNG，可以先用占位路径和回退测试，但必须保证运行时安全。

完成后为普通 1×1、3×1 heavyArmor、2×2 devour、2×1 deflectionWard、3×2 siege、3×3 gravityWell 至少生成可解析的资产键，并在文档中列出示例。运行 node --check 和 git diff --check，更新 docs/enemy_art_implementation_impact.md，并提交推送。
```

## 8. 阶段 6：首批组合敌人资产设计

本阶段可以选择生成占位 PNG、矢量规格或资产清单脚本。重点是让高优先级组合具备明确形象，不要求穷举所有随机组合。

```text
使用技能 /repo-navigator 了解当前实现，并基于上一阶段资产键系统开始设计首批组合敌人美术资产。请优先覆盖 docs/enemy_wave_preset_design.md 中 8 个首批 preset 涉及的组合，以及所有 V2 基底的 base 资产。

请建立资产清单，至少包含：normal/1x1 的 shield、regen、haste、healer、berserk、jump、clone；elite/3x1/bastion/heavyArmor；elite/2x2/maw/devour；elite/2x1/deflector/deflectionWard；elite/1x2/echoSpire/echoRelay；elite/1x3/prism/prism；elite/2x3/hive/hive；elite/3x2/siege/siege；elite/3x3/gravityWell/gravityWell。对于 preset 中出现的 shield+regen、siege+shield、hive+regen 等高频组合，可以制作独立组合形象或明确回退到基底资产加叠层。

如果生成 PNG，请遵守仓库位图化视觉规格，保持低分辨率、清晰轮廓和可读色块；如果暂不生成 PNG，请输出详尽的资产规格表，包含尺寸、主色、轮廓、材质、动画建议、触发特效关联和 assetKey。不要把所有组合塞进代码分支，资产应由 manifest 驱动。

完成后更新或新增 docs/enemy_asset_manifest.md，并在 AGENTS.md 登记。运行必要的资源检查或至少确认路径不会被运行时代码误读。提交推送。
```

## 9. 阶段 7：预设波次数据化与放置器

这个阶段把设计稿落成代码，但必须保持可回退。不要让 preset 放置失败影响普通生成。

```text
使用技能 /repo-navigator 了解当前实现。请实现敌人组合预设波次系统，目标是将 docs/enemy_wave_preset_design.md 中的 8 个首批 preset 数据化，并接入现有 spawn_system 的导演生成流程。

建议新增 src/wave_presets.js，导出 ENEMY_WAVE_PRESETS，字段包括 id、roundRange、weight、maxUses、cooldownRounds、introText、slots。slots 至少支持 archetype、affixes、cols、rows、lane、hpMult。然后在 src/spawn_system.js 中新增 spawn_pickWavePreset()、spawn_trySpawnWavePreset()、spawn_placePresetSlot() 或等价函数。

放置器必须做 footprint 占用检查，支持 center、left、right、front、back、side 等 lane 语义。对于 siege_push_line，必须能把 3×2 siege 放在后方，并在其前方放置低血盾兵用于教学推挤。若任意关键 slot 无法放置，应放弃该 preset 并回退当前随机生成，不得产生重叠、越界或空引用。

请新增配置开关，例如 ENEMY_CURVE_CONFIG 或独立 WAVE_PRESET_CONFIG，允许关闭 preset 以便调试。首次出现 preset 时可以显示 introText 或浮字，但不要造成 UI 噪音。完成后更新 .cursor/rules/spawn_system.md、docs/enemy_wave_preset_design.md 和 docs/enemy_art_implementation_impact.md。运行 node --check、git diff --check；如果能做模拟，请连续模拟至少 50 次生成，确认无重叠、无越界、可回退。提交推送。
```

## 10. 阶段 8：联调、平衡与最终收束

最后阶段把前面所有改动放到一起检查，包括性能、文档、索引、生成节奏和玩家可读性。这个阶段不应再引入大规模新系统。

```text
使用技能 /repo-navigator 了解当前实现。请对敌人 V2 美术、词条特效、资产键系统和预设波次系统做一次最终联调与收束。

请检查以下内容：1）所有 V2 基底敌人都能生成且不会越界；2）所有专属词条在状态面板、常驻视觉、触发反馈中有一致命名；3）非 1×1 敌人的通用词条特效不再明显错位；4）资产键解析缺失时稳定回退；5）8 个首批 preset 在对应回合段有机会出现且不会连续刷屏；6）siege 冰冻免疫和推挤链在 preset 场景中仍成立；7）低性能档粒子数量不会明显爆炸。

请运行 node --check 覆盖所有修改过的 JS 文件，执行 git diff --check。如果项目有可用构建或测试命令，请运行最小构建或测试。请更新 AGENTS.md、docs/enemy_visual_design_v2.md、docs/enemy_art_implementation_impact.md、docs/enemy_wave_preset_design.md，以及新增资产清单文档中的最终状态。最后输出一份 docs/enemy_v2_implementation_report.md，总结已完成、未完成、风险和后续建议，并提交推送。
```

## 11. 通用执行约束

所有阶段都应遵守同一套交接约束。每个 Agent 在开始前必须确认 Git 状态，在结束前必须提交可回滚的小步提交。不要把临时脚本、调试日志、未使用资源或大体积生成文件混入提交；如果必须保留脚本，应放在合适的 `scripts/` 目录并写清用途。

| 约束 | 要求 |
|---|---|
| 仓库导航 | 每阶段先读 `/repo-navigator`，再读 `AGENTS.md` 和相关文档。 |
| 文档同步 | 修改代码时同步修改对应 `docs/` 或 `.cursor/rules/` 文档。 |
| 验证 | 至少运行相关 `node --check` 和 `git diff --check`。 |
| 提交粒度 | 每阶段一个或少数几个清晰提交，不要混合无关改动。 |
| 资产回退 | 缺失 PNG 或组合资产时必须安全回退，不得阻塞战斗。 |
| 性能预算 | 大型敌人的粒子和叠层不能按面积无限增长，必须设置上限。 |
| 兼容性 | 新系统必须保留旧随机生成路径作为回退。 |

## References

[1]: enemy_visual_design_v2.md "敌人视觉设计 V2：尺寸基底、专属词条与 3×3 敌人类型规范"  
[2]: enemy_art_implementation_impact.md "敌人美术与词条特效落地影响范围评估"  
[3]: enemy_wave_preset_design.md "敌人组合预设波次设计与代码修改方案"  
[4]: ../src/entities/enemy.js "敌人实体绘制、行动与词条视觉实现"  
[5]: ../src/spawn_system.js "敌人生成系统与大型基底生成"  
[6]: ../src/config.js "词条数值、Boss 配置与敌人组合配置"
