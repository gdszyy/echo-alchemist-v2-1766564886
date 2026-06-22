# 敌人奖励边框与词条特效迭代方案

本文档用于承接当前敌人美术迭代：奖励敌人的“金边”可读性、通用词条的差异化视觉设计，以及护盾拦截、偏折屏障、跳跃等需要事件反馈的特效层。它不替代 `enemy_visual_design_v2.md`，而是在既有“几何磨石块基座 + 镶嵌核心”母题上补齐奖励层、词条层和触发层的执行规则。

> 2026-06-22 首轮落地：`src/entities/enemy.js` 已将奖励视觉入口收束为 `rewardType='relic'` 金边；补齐 `shield` / `deflectionWard` 的拦截与破碎短计时反馈；`jump` 在真实越过阻挡时播放不改碰撞的伪 3D 起跳/腾空表现。后续位图 reward frame 与 Overlay PNG 仍按本方案继续推进。

## 1. 分层原则

敌人最终画面按“身份先于状态、状态先于反馈”的顺序阅读：

| 层级 | 职责 | 示例 | 实现方式 |
|---|---|---|---|
| 基底主体 | 表达 footprint、碰撞边界、基底职责 | residue / bastion / maw / siege | Sprite / Canvas fallback |
| 碰撞材质框 | 强化真实物理边界 | 1x1 框、3x1 框、Boss 随从异形框 | `frames` manifest + `drawImage` |
| 奖励边框 | 表达击杀后掉落价值 | 遗物金边 | 独立 reward frame / 当前 halo 降级 |
| 词条常驻层 | 表达敌人会什么 | shield / regen / haste / jump | Overlay PNG + Canvas fallback |
| 词条触发层 | 表达机制刚发生 | 护盾拦截、跳跃落地、回响触发 | 事件计时字段 + 低成本 Canvas 特效 |
| UI 语义层 | 保底阅读 | 状态短标、威胁角标、命中反馈文字 | 现有短标签系统 |

奖励边框和词条 Overlay 必须是两个不同层。带遗物的护盾敌人应先读出“这是有奖励的目标”，再读出“它有护盾”；不能让护盾蓝膜覆盖或替代奖励金边。

## 2. 奖励敌人：遗物金边

当前敌人掉落标记应只面向 `rewardType='relic'`。代码中仍存在历史 `chaos_essence` / `pure_essence` resolver 与表现分支，但它们不再作为本轮敌人奖励美术目标；后续若正式删除旧分支，应单独做机制清理任务。下一轮美术应把遗物敌人的“光晕”升级为“奖励材质边框”，让低性能档也清楚可见。

| rewardType | 主视觉 | high | medium | low |
|---|---|---|---|---|
| `relic` | 古金双层边框，角落有炼金铆钉或小符片 | 金边 + 轻微符文旋转 + 暖金脉冲 | 金边 + 2 个符片 | 平面金色双描边 |

资产建议：

| 资产 | 路径建议 | 说明 |
|---|---|---|
| `reward_frame_relic.png` | `assets/sprites/enemies/rewards/` | 中心透明，边框不改变碰撞判定。 |

实现建议：新增 reward frame manifest 段，或先在 `enemy_sprite_manifest.json` 增加 `rewardFrames`。命中位图时只做 1 次 `drawImage`；缺失时继续使用当前 Canvas relic halo / 平面金边兜底。

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

| 机制 | 常驻层 | 拦截反馈 | 破碎反馈 |
|---|---|---|---|
| `shield` | 全身或分段六边形护膜，表示通用减伤/激光偏折 | 命中点六边形波纹；显示剩余 `盾N` | 最后一层耗尽时外膜断成 3-5 段短线 |
| `deflectionWard` | 只在前缘/斜面显示青蓝偏折薄膜，表示只挡反弹和穿透 | 反弹/穿透被挡时前缘棱面闪烁，不对普通直击播放 | `wardBarrier` 归零时播放晶片碎裂，回合刷新时薄膜回流 |

代码接入建议：

- `Enemy.takeDamage()` 已有 `shieldHitTimer`，可扩展为更语义化的 `_affixFxTimers`，例如 `{ shieldBlock, shieldBreak, wardBlock, wardBreak }`。
- `deflectionWard` 的拦截分支应设置 `wardBlockTimer`；破碎时设置 `wardBreakTimer`。
- 不新增粒子作为首版实现；优先用 `stroke`、`fill`、`lineTo` 和 1-2 次低成本局部渐变。若加入碎片粒子，必须走 `CONFIG.performance` 上限。

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
5. 运行静态验证和浏览器试炼场回归；若改动 `src/entities/enemy.js`，同步更新自动索引。

## 8. 性能自适应影响评估

本方案推荐的首版实现以位图叠加、少量描边和计时器为主，不应新增默认粒子：

| 档位 | 预期表现 |
|---|---|
| high | 完整奖励边框、常驻 Overlay、护盾拦截波、跳跃伪 3D。 |
| medium | 减少旋转符片和局部高光，保留语义反馈。 |
| low | 全部语义保留为平面描边/短线；关闭 `shadowBlur`、旋转符片、大面积渐变和粒子。 |

若后续实现新增粒子、`shadowBlur`、`createRadialGradient` 或 `screen/lighter` 混合，必须按 `.cursor/rules/performance.md` 补 `// @perf-impact`，并接入 `CONFIG.performance` 三档预算。
