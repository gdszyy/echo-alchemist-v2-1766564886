# 敌人奖励边框与词条特效迭代方案

> 2026-06-27 no-affix 原版补齐：1x1 精英魔像家族新增 `eliteGolemAffixCombo:1x1:` 空词条基准资源，文件为 `enemy_elite_golem_noaffix_1x1_pass13_idle`。完全无词条的 elite，以及只带 `shield`、`regen` 等 overlay-only 词条的 elite，都先读这个原版本体，再叠对应 overlay；它们不回退 `residue:1x1:`。

> 2026-06-26 当前收口结论：1x1 精英敌人只要携带 `armorSpore`、`jump`、`haste`、`berserk` 四个核心词条中的任意非空子集，就走整张精英魔像本体资产替换方案。额外携带 `shield`、`regen` 等非核心词条时，不参与这四个核心词条的本体资产键计算，也不得导致回退旧精英魔像素材。当前有效链路与下一步边界见 `docs/design/enemy_elite_golem_affix_current_state.md`；先不继续生产更多美术资产，下一步只定非核心词条的呈现形式。

> 2026-06-26 pass12 交叉组合素材更新：11 个多词条精英魔像组合资源切到 `enemy_elite_golem_<combo>_1x1_pass12_idle`。组合图以完整敌人本体承载词条，不使用标签、overlay 或程序叠色；`armorSpore` 保留绿色孢孔/独眼语言，`jump` 保留蓝色紧凑推进器，`haste` 沿用 pass11 圆肩流线肢体与黄色横条眼，`berserk` 保留单眼冒火和红色裂隙。单词条仍为 `armorSpore/jump/berserk=pass10`、`haste=pass11`。

> 2026-06-26 pass11 haste 单词条返工：`eliteGolemAffixCombo:1x1:haste` 切到 `enemy_elite_golem_haste_1x1_pass11_idle`。本轮专门拉开 haste 与 jump 的剪影差异：取消肩部尖角、侧翼、推进器和蓝色喷射语言，改用圆肩、黄色横条眼、流线前臂/腿部和导风能量线表现速度。`armorSpore`、`jump`、`berserk` 仍用 pass10，多词条组合已在 pass12 同步。

> 2026-06-26 pass10 基础素材重生成：四个单词条精英魔像基础素材切到 `enemy_elite_golem_<affix>_1x1_pass10_idle`，重新以完整敌人美术素材表现词条，不再依赖程序叠色草图。头部轮廓承担核心识别：`armorSpore` 是自然曲线孢孔头与绿色发光独眼，`jump` 是更轻的推进器/双蓝眼头，`haste` 是导风流线头与黄色横条眼，`berserk` 是破裂狂暴头且其中一只眼睛冒火。多词条组合暂保留 pass7，待基础头部语言确认后再同步组合资产。

> 2026-06-26 实装预览：`armorSpore`、`jump`、`haste`、`berserk` 四个精英魔像词条的 pass7 组合资产已接入 `eliteGolemAffixCombo:1x1:*` 资源键，共 15 个组合。运行时命中 `type='elite'`、1x1、且包含这四个核心词条中至少一个的敌人；资源键只按这四个词条的交集选择 pass7 本体，所以额外携带 `shield`、`regen` 等通用词条不会打回旧精英魔像素材。命中的精英魔像使用整张美术 sprite 承载核心词条语义，并跳过旧的词条印章、位图 overlay、目标 fallback 与状态小标签，保留 HP/防御 HUD 供实机预览读数。
> 2026-06-26 pass8 基础素材调整：四个单词条精英魔像基础素材切到 `enemy_elite_golem_<affix>_1x1_pass8_idle`，在 pass7 裁切和石质写实风格上放大头部/面罩读点，并给 `armorSpore`、`jump`、`haste` 补强绿色、蓝色、黄色发光材质；`berserk` 保留红色狂暴发光语言并同步放大头部。多词条组合仍保留 pass7，待基础方向确认后再批量同步。
> 2026-06-26 pass9 基础素材调整：四个单词条精英魔像基础素材切到 `enemy_elite_golem_<affix>_1x1_pass9_idle`，进一步放大头部，并把眼睛/头部剪影作为差异化识别点：`armorSpore` 为绿色发光独眼，`jump` 为蓝色发光双眼，`haste` 为黄色横条发光眼，`berserk` 为红色裂隙狂暴眼。多词条组合仍保留 pass7，待头部语言确认后再批量同步。

本文档用于承接当前敌人美术迭代：奖励敌人的“金边”可读性、通用词条的差异化视觉设计，以及护盾拦截、偏折屏障、跳跃等需要事件反馈的特效层。它不替代 `enemy_visual_design_v2.md`，而是在既有“几何磨石块基座 + 镶嵌核心”母题上补齐奖励层、词条层和触发层的执行规则。

> 2026-06-23 迭代：遗物奖励层不再使用悬浮皇冠、中心晶核或单纯发光描边，改为嵌入敌人轮廓内侧的金属材质装饰框：暗金厚底、亮金细边、四角 L 形角标、铆钉与上下/侧边小凸起。`low` 档也保留同一材质轮廓，只关闭动态模糊和高光。
>
> 2026-06-22 首轮落地：`src/entities/enemy.js` 已将奖励视觉入口收束为 `rewardType='relic'` 金边；补齐 `shield` / `deflectionWard` 的拦截与破碎短计时反馈；`jump` 在真实越过阻挡时播放不改碰撞的伪 3D 起跳/腾空表现。后续位图 reward frame 与 Overlay PNG 仍按本方案继续推进。

> 2026-06-24 落地：`shield` 与 `radiantAegis` 已生成正式 footprint-aware PNG overlay，覆盖 1x1 到 3x3 资产族；Boss 默认按 3x2 取图。普通护盾层仍保留 `盾N` 状态徽记和命中/破碎 Canvas 反馈，但常驻美术层不再缺失。UI icon 侧同步接入：敌方护盾层数指标显示 `affix_shield.png`，`radiantAegis` 使用正式 `affix_radiantAegis.png`。
> 2026-06-25 落地：敌人行动预告从 emoji/文字小牌升级为位图词条仪表面板，复用 `ENEMY_AFFIX_ICON_MAP`、倒计时环、威胁刻度与指向箭头。补齐 `berserk`、`haste`、`healer`、`clone`、`jump`、`lowDamageImmune`、`deflectShell`、`armorSpore`、`siegeBreaker`、`overloadReactor` 的透明 PNG UI icon，并接入图鉴、试炼场词缀 chip、敌人信息抽屉与 manifest。
> 2026-06-25 返工：上述 10 个词条 UI icon 已降饱和重导出。图标底色改为黑曜石/暗金仪表盘，机制色只保留为低强度核心线、晶脉或刻度，避免回退到高饱和技能按钮风格。
> 2026-06-24 追补：敌人本体 HUD 的防御数值不再混入 `_drawStatusBadges()` 文字短标签。`shield` / `radiantAegis` 由 `_drawDefenseHudBadges()` 常驻绘制在 HP 数字旁，直接使用 `affix_shield.png` / `affix_radiantAegis.png` + 数值，受击浮字只保留瞬时反馈。
> 2026-06-24 追补：护盾挡伤反馈不再使用全身脉冲作为唯一表现。`Enemy.takeDamage()` 会记录防御层命中来源：有 `source.pos` / `source.vel` 的子弹或激光走“面向弹道方向的侧向抵挡”，无方向的属性结算、扩盾、补盾走“正面护面”。`shield`、`phaseShield`、`deflectionWard`、`radiantAegis`、`energyArmor`、`livingArmor`、`lowDamageImmune` 使用不同颜色语言和折射纹理；挡击版绘制更厚的弧形能量幕、层叠波前、压缩纹，并在 high/medium 叠加沿命中方向推进的线性渐变。`phaseShield` 额外使用错相断续波前，`livingArmor` 在弧幕内叠加黄绿生物甲脉络、甲结和分叉裂纹，`lowDamageImmune` 使用硬壳压痕，避免玩家把所有护盾读成同一种轻微波纹。

## 1. 分层原则

敌人最终画面按“身份先于状态、状态先于反馈”的顺序阅读：

| 层级 | 职责 | 示例 | 实现方式 |
|---|---|---|---|---|
| 基底主体 | 表达 footprint、碰撞边界、基底职责 | residue / bastion / maw / siege | Sprite / Canvas fallback |
| 碰撞材质框 | 强化真实物理边界 | 1x1 框、3x1 框、Boss 随从异形框 | `frames` manifest + `drawImage` |
| 奖励边框 | 表达击杀后掉落价值 | 遗物金属装饰框 | 独立 reward frame / Canvas 金属框 fallback |
| 词条常驻层 | 表达敌人会什么 | shield / regen / haste / jump | Overlay PNG + Canvas fallback |
| 词条触发层 | 表达机制刚发生 | 护盾拦截、跳跃落地、回响触发 | 事件计时字段 + 低成本 Canvas 特效 |
| UI 语义层 | 保底阅读 | 状态短标、威胁角标、命中反馈文字 | 现有短标签系统 |

奖励边框和词条 Overlay 必须是两个不同层。带遗物的护盾敌人应先读出“这是有奖励的目标”，再读出“它有护盾”；不能让护盾蓝膜覆盖或替代奖励金边。

## 2. 奖励敌人：遗物金边

当前敌人掉落标记应只面向 `rewardType='relic'`。代码中仍存在历史 `chaos_essence` / `pure_essence` resolver 与表现分支，但它们不再作为本轮敌人奖励美术目标；后续若正式删除旧分支，应单独做机制清理任务。遗物敌人必须使用“奖励材质边框”，低性能档也不能退回单纯发光或平面双描边。

| rewardType | 主视觉 | high | medium | low |
|---|---|---|---|---|
| `relic` | 古金金属装饰框，细金边 + L 形角标 + 铆钉/小凸起 | 金属框 + 轻微材质高光 | 金属框 + 降低高光 | 金属框轮廓，关闭模糊 |

资产建议：

| 资产 | 路径建议 | 说明 |
|---|---|---|
| `reward_frame_relic.png` | `assets/sprites/enemies/rewards/` | 中心透明，边框不改变碰撞判定。 |

实现建议：新增 reward frame manifest 段，或先在 `enemy_sprite_manifest.json` 增加 `rewardFrames`。命中位图时只做 1 次 `drawImage`；缺失时使用 Canvas 金属框 fallback，不能退回皇冠、中心晶核或纯光晕提示。

## 2.5 符文奖励敌人：奖励词条层

带符文敌人需要特殊处理，但不要做成新基底或新敌人种族。首批只规划为两个奖励词条：`runeBearer` 表示通用符文掉落，额外携带一个每回合随机变化的临时词条；`adaptiveRune` 表示自适应符文，会记录最近受到的有效属性伤害或属性效果，切换成对应属性态，并在死亡时掉落该属性家族符文。

| 词条 | 常驻视觉 | 触发反馈 | 掉落读法 |
|---|---|---|---|---|
| `runeBearer` | 嵌入式紫金符文槽、轮换刻度、小型当前临时词条副徽记 | 敌方回合开始轮换临时词条时，播放 3-4 帧低成本刻度转动或副徽记替换反馈 | 通用智能符文掉落，仍走标准构筑权重 |
| `adaptiveRune` | 可变色符文核心、属性纹路、贴边短元素特效 | 有效属性命中或属性效果结算时，核心切到对应属性色并播放短促边缘脉冲 | 按当前记录的属性家族掉落符文；无记录时回退标准智能掉落 |

符文奖励层位于“奖励边框”和“词条常驻层”之间：它必须比普通 `rewardType='relic'` 更像构筑目标，但不能遮挡 `shield`、`phaseShield`、`livingArmor` 等生存机制。`runeBearer` 的临时词条只显示为副徽记，不应混入原始词条图标队列；`adaptiveRune` 只改变核心色、纹路和局部边缘特效，不改变敌人 silhouette。

资产登记规则（2026-06-23 更新）：首版已使用 SVG 占位资产登记到 `enemy_sprite_manifest.json` 与内嵌默认 manifest，避免运行时 404 并提供可验收兜底。正式美术仍需按同名语义替换为最终 PNG/SVG，且 `runeBearer` 保持静态奖励 overlay，`adaptiveRune` 保持静态 overlay + `adaptiveRune.<element>` 动态 overlay 分层。

## 3. 通用词条差异化视觉

通用词条不要只换颜色，应按“形状语言 + 材质覆层 + 触发反馈”三件套区分。每个词条最多提供一个常驻 Overlay，一类触发反馈，一个短标签兜底。

| 词条 | 常驻视觉 | 触发/受击反馈 | 大型敌人适配 |
|---|---|---|---|
| `shield` | 外缘六边形薄膜、蓝白节点、局部装甲片 | 被拦截时命中点扩散一圈六边形裂波；护盾层数减少时节点熄灭 | 不画全身圆罩，沿 collision frame 分段包裹 |
| `regen` | 绿色细藤纹 / 液体回流线，贴在裂缝与石槽内 | 回血时从底部向核心回流一条细线，HP 数字旁出现短促绿色脉冲 | 多个小回流节点分布在 bodyNodes |
| `healer` | 粉金小星芒或医治印记，靠近核心槽 | 治疗别人时发出短连线到目标，目标上出现小十字闪烁 | 连接线从 archetypePorts 发出，不从中心硬连 |
| `haste` | 后缘短速度刻线、黄色斜向导流纹 | 额外移动时留下 2-3 帧残影线 | 以后缘锚点为准，避免穿过大型主体 |
| `jump` | 底部青色压缩弹簧线、下缘蓄力刻槽 | 跳跃时主体沿抛物线缩放/抬升；落地有椭圆冲击影 | 仅允许轻量伪 3D，不改变真实碰撞位置 |
| `clone` | 紫色镜像裂片、边缘双影 | 分裂时母体边缘剥离一张半透明复制剪影 | 对大型敌人默认只显示裂片，不鼓励大型 clone |
| `berserk` | 红橙热裂纹、核心不稳定闪烁 | 触发额外结算时裂纹瞬亮，短暂红色冲击线 | 不覆盖基底轮廓，重点放在裂缝与核心 |

差异化优先级：`shield`、`jump`、`regen`、`haste` 应先做，因为它们最常见且直接影响战斗判断；`healer`、`clone`、`berserk` 可第二批补齐。

## 4. 护盾与偏折屏障反馈

护盾类视觉需要区分两种机制：

| 机制 | 常驻层 | 有方向拦截反馈 | 无方向/属性反馈 | 破碎反馈 |
|---|---|---|---|---|
| `shield` | 全身或分段六边形护膜，表示通用减伤/激光偏折 | 沿子弹入射侧生成蓝白弧形能量幕，内部保留短六边形压缩纹 | 居中椭圆护面闪一下，表示非弹道结算被护住 | 最后一层耗尽时在命中侧或正面断成 3-5 段裂波 |
| `phaseShield` | 双层错相护膜，表示护盾层数翻倍但有失效窗口 | 入射侧生成紫色错相断续波前，和普通蓝盾明显区分 | 正面双层椭圆护面短闪，用于扩盾/补盾 | 最后一层耗尽时显示紫色错相裂线 |
| `deflectionWard` | 只在前缘/斜面显示青蓝偏折薄膜，表示只挡反弹和穿透 | 沿入射侧生成偏斜弧幕和切向折射波，不对普通直击播放 | 居中椭圆偏折薄膜，仅用于无方向的屏障刷新/回流 | `wardBarrier` 归零时播放晶片碎裂，回合刷新时薄膜回流 |
| `radiantAegis` | 流彩菱环和节点，表示可再生数值护盾 | 入射侧出现三层流彩波前，强调它是能量护盾而非普通层数盾 | 正面多色椭圆护面闪烁，用于回合自增、温压补盾或扩盾 | 破裂时命中侧/正面出现多色裂片线 |
| `energyArmor` | 金色蓄能甲/外缘甲片，表示高伤溢出转护盾 | 入射侧出现厚重金色弧幕和压缩波，强调“硬吃一发” | 正面厚能量罩短闪，用于无方向蓄盾结算 | 当前首版只做挡击反馈，破裂语义由数值归零和状态徽记消失表达 |
| `livingArmor` | 黄绿活体甲环/孢甲边缘，表示代承层 | 入射侧出现有机弧形能量幕、叶脉状脉络和小甲结，强调活甲代承 | 正面椭圆活甲护面，适合火毒反制等无清晰弹道来源 | 破甲时保留活甲浮字/现有粒子，并在同一方向绘制黄绿分叉裂线 |
| `lowDamageImmune` | 金属硬壳/厚边，表示低伤无效 | 入射侧显示灰白硬壳压痕和反震短线 | 正面硬壳凹痕短闪，与“过低”浮字同步 | 无破碎态，强调阈值未突破 |

代码接入建议：

- `Enemy.takeDamage()` 已有 `shieldHitTimer`，并新增 `_defenseImpactFx` 记录瞬时防御命中方向；`phaseShield` 使用 `_phaseShieldBlockTimer/_phaseShieldBreakTimer`，`lowDamageImmune` 使用 `_lowDamageImmuneBlockTimer`。后续若继续扩展，可再收束为更语义化的 `_affixFxTimers`。
- 有 `source.pos` / `source.vel` 的伤害必须优先使用入射侧/弹道方向；没有来源方向的属性结算、补盾、扩盾必须走正面护面反馈，禁止随机方向。
- `deflectionWard` 的拦截分支应设置 `wardBlockTimer`；破碎时设置 `wardBreakTimer`。
- 不新增粒子作为首版实现；优先用 `stroke`、`fill`、`ellipse`、`quadraticCurveTo` 绘制短生命周期能量弧幕、波前和折射纹。high/medium 可叠加 1 次与入射方向一致的 `createLinearGradient` 能量压缩层；low 档必须关闭该渐变，只保留平面弧幕和降数入射波。若加入碎片粒子，必须走 `CONFIG.performance` 上限。

## 5. 跳跃：伪 3D 行动表现

`jump` 的问题不是常驻标记，而是“发生跳跃时玩家需要看到它越过了谁”。建议把跳跃分为三帧语义：

| 阶段 | 视觉 | 数据 |
|---|---|---|
| 起跳 | 底部压缩线变亮，主体 Y 方向压扁 4%-8% | 设置 `_jumpFxTimer` 起始值 |
| 腾空 | 绘制位置仍跟随真实 `pos/dropTargetY`，但视觉主体向上偏移 `arcHeight * sin(progress*pi)`；底部椭圆影子留在原行 | 只影响 `draw()` 局部变换，不改碰撞 |
| 落地 | 椭圆影子扩散，底部青色冲击线一闪 | timer 结束后恢复普通绘制 |

伪 3D 强度建议：

| 档位 | 表现 |
|---|---|
| high | 抛物线视觉偏移 + 椭圆影子 + 2 条落地冲击线 |
| medium | 抛物线视觉偏移 + 椭圆影子 |
| low | 仅底部压缩线和落地短线 |

实现上应优先在 `Enemy.executeTurnAction()` 中真正发生跳跃分支时设置 `_jumpFxTimer` 和 `_jumpFxRows`。预告阶段仍用 `telegraphIntent` 表达“将要跳”，但不要播放完整腾空动画。

## 6. 专属词条后续补齐

V2 专属词条已具备基底身份，但还需要触发反馈：

| 词条 | 首要补齐 |
|---|---|
| `echoRelay` | 额外触发周围词条时，画一条短声波线到被触发目标。 |
| `prism` | 激光折射时显示白色折线路径和小折光片。 |
| `hive` | 生成幼体时卵囊收缩，幼体落点有低成本黏液环。 |
| `siege` | 推挤成功时从推铲到阻挡链画短箭头/尘线；冰冻免疫时热管闪一下。 |
| `gravityWell` | 牵引或偏折时画向心弧线；受击时黑核短暂塌缩。 |

这些都属于“语义类特效”：`low` 档也必须保留平面版本，不能完全关闭。

## 7. 验收顺序

1. 试炼场 `enemy_v2` 中确认遗物敌人在 high/medium/low 三档都有金边可读性。
2. 使用 `ev2_large_generic_affix` 验证 `shield` / `regen` 在大型基底上不会遮挡主体和 HP。
3. 增加或复用跳跃场景，确认 `jump` 发生时能看到起跳、腾空、落地，不改变真实碰撞。
4. 对 `deflectionWard` 分别用 bounce / pierce / normal / pyro / poison 验证只有正确伤害类型播放拦截反馈。
5. 若实现 `runeBearer` / `adaptiveRune`，新增试炼场用例分别验证每回合临时词条轮换、属性态切换、死亡掉落家族与 low 档视觉兜底。
6. 运行静态验证和浏览器试炼场回归；若改动 `src/entities/enemy.js`，同步更新自动索引。

## 8. 性能自适应影响评估

本方案推荐的首版实现以位图叠加、少量描边和计时器为主，不应新增默认粒子：

| 档位 | 预期表现 |
|---|---|
| high | 完整奖励边框、常驻 Overlay、护盾拦截波、跳跃伪 3D。 |
| medium | 减少旋转符片和局部高光，保留语义反馈。 |
| low | 全部语义保留为平面描边/短线；关闭 `shadowBlur`、旋转符片、大面积渐变和粒子。 |

符文奖励敌人的首版实现也应遵守同一预算：`runeBearer` 的轮换反馈优先使用副徽记替换和短刻度线，`adaptiveRune` 的属性切换优先使用核心填色、贴边线和 1 次短脉冲。不得默认新增持续粒子或高频 `shadowBlur`。

若后续实现新增粒子、`shadowBlur`、`createRadialGradient` 或 `screen/lighter` 混合，必须按 `.cursor/rules/performance.md` 补 `// @perf-impact`，并接入 `CONFIG.performance` 三档预算。
