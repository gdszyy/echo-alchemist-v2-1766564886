# 敌人组合预设波次设计与代码修改方案

作者：**Manus AI**  
状态：阶段设计稿  
关联文档：[`docs/enemy_visual_design_v2.md`](enemy_visual_design_v2.md)、[`docs/enemy_art_implementation_impact.md`](enemy_art_implementation_impact.md)

## 1. 设计目标

预设波次系统用于解决 V2 大型敌人和新词条进入战斗后的教学、节奏与组合问题。现有导演系统已经能在 `spawn_spawnEnemyRowAt()` 中按权重选择 `phalanx`、`blitz`、`berserk_pack`、`jumper_pack`、`swarm_core`、`food_chain` 和 `thermal_bomb` 等模板，但这些模板主要服务 1×1 通用词条敌人，尚未围绕 `2×1` 到 `3×3` 的大型基底进行出场设计。[1] [2]

> 预设波次不是替代随机生成，而是在关键回合插入具有识别度的“导演镜头”。它应保证玩家第一次遇到新机制时能理解规则，之后再逐渐把大型敌人与通用词条组合起来制造压力。

| 目标 | 说明 | 约束 |
|---|---|---|
| 教学清晰 | 每种新基底第一次出现时只展示一个核心行为。 | 首次出现不叠加两个以上高噪音词条。 |
| 空间可读 | 大型敌人需要按 `gridCols/gridRows` 预留空位。 | 生成前必须做 footprint 占用检查。 |
| 节奏克制 | 大型敌人不能连续压场。 | 每个 preset 应有 `cooldownRounds` 和 `maxUses`。 |
| 可回退 | 预设放置失败时不应阻塞敌人生成。 | 失败时回退到当前随机导演系统。 |

## 2. 预设波次数据结构

建议先新增 `src/wave_presets.js`，用纯数据定义预设波次，再在 `src/spawn_system.js` 中加入一个轻量选择器。这样可以避免继续扩大 `spawn_spawnEnemyRowAt()` 的内联分支，同时为未来美术资产清单、剧情提示和调试工具提供统一入口。[1]

```javascript
export const ENEMY_WAVE_PRESETS = [
  {
    id: 'teach_deflection_ward',
    roundRange: [8, 14],
    weight: 12,
    maxUses: 1,
    cooldownRounds: 99,
    introText: '棱盾兽只会挡下反弹与穿透，火焰和毒会绕过屏障。',
    slots: [
      { archetype: 'deflector', affixes: ['deflectionWard'], cols: 2, rows: 1, lane: 'center', hpMult: 1.0 },
      { archetype: 'normal', affixes: [], cols: 1, rows: 1, lane: 'side', hpMult: 0.8 }
    ]
  }
];
```

| 字段 | 类型 | 用途 |
|---|---|---|
| `id` | string | 预设唯一 ID，用于计数、调试和复盘。 |
| `roundRange` | `[number, number]` | 允许出现的回合范围。 |
| `weight` | number | 在当前可用 preset 池中的抽取权重。 |
| `maxUses` | number | 单局最大出现次数。 |
| `cooldownRounds` | number | 同类 preset 出现后的冷却回合。 |
| `introText` | string | 可选的 UI 提示或浮字，用于首次教学。 |
| `slots` | array | 敌人槽位列表，描述大型基底、通用敌人和相对位置。 |

## 3. 首批预设波次组合

首批预设不应追求数量，而应覆盖 V2 设计中最需要教学的行为差异。建议先实现 8 个 preset，覆盖屏障、回响、孵化、破阵、折光、引力、吞噬和重装等核心语义。

| Preset ID | 推荐回合 | 敌人组合 | 出场意图 | 克制/学习点 |
|---|---:|---|---|---|
| `teach_deflection_ward` | R8-R14 | `deflector(2×1, deflectionWard)` + 1 个普通敌人 | 教学偏折屏障只阻挡反弹/穿透。 | 引导玩家改用火焰、毒或直击伤害。 |
| `teach_echo_relay` | R12-R18 | `echoSpire(1×2, echoRelay)` + `regen` 或 `shield` 小队 | 展示“额外触发周围词条”的威胁。 | 优先击杀尖塔或拉开周围敌人。 |
| `siege_push_line` | R16-R24 | `siege(3×2, siege)` + 前方 2 个低血盾兵 | 展示无法冰冻与阻挡推挤。 | 玩家需要提前清前排，不能依赖冰冻停住攻城履带。 |
| `maw_food_chain_v2` | R18-R26 | `maw(2×2, devour)` + 两侧低血普通敌人 | 强化吞噬基底与旧 `food_chain` 的关系。 | 先清喂食单位，避免吞噬滚雪球。 |
| `prism_refraction` | R22-R30 | `prism(1×3, prism)` + 边路普通敌人 | 展示纵向棱柱对激光/弹道路径的影响。 | 引导玩家调整发射角度或使用非激光方案。 |
| `hive_incubator` | R24-R34 | `hive(2×3, hive)` + 少量护卫 | 展示孵化倒计时与持续压力。 | 优先集火巢体，控制敌人数上限。 |
| `gravity_blackout` | R32-R42 | `gravityWell(3×3, gravityWell)` 单核心 + 稀疏护卫 | 展示大型场控单位改变弹道。 | 要求玩家在空间被占据时规划多回合输出。 |
| `bastion_wall` | R10-R20 | `bastion(3×1, heavyArmor)` + 后排治疗者 | 强化重装作为横向墙体的可读性。 | 穿透、闪电或绕开后排治疗者。 |

## 4. 代码修改方案

代码上建议分四步推进。第一步创建 preset 数据文件和选择器，只让系统能选中并打印调试信息。第二步接入 footprint 放置器，复用 `spawn_trySpawnArchetype()` 的宽高、血量和形状初始化规则。第三步接入首次教学提示和冷却计数。第四步再把 preset 权重接入 `ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS` 或新增独立的 `WAVE_PRESET_WEIGHTS`。[1] [3]

| 步骤 | 修改文件 | 修改内容 | 风险 |
|---|---|---|---|
| Step 1 | `src/wave_presets.js` | 新增 preset 数据与 slot 结构。 | 低，纯数据。 |
| Step 2 | `src/spawn_system.js` | 新增 `spawn_trySpawnWavePreset()`、`spawn_pickWavePreset()` 和 `spawn_placePresetSlot()`。 | 中，需要处理大型 footprint 与当前占用检测。 |
| Step 3 | `src/config.js` | 新增 preset 总开关、权重曲线、冷却参数。 | 低，需要避免与旧模板权重混淆。 |
| Step 4 | `src/systems.js` 或 UI 提示层 | 显示 `introText` 或短浮字。 | 中，需避免战斗 UI 噪音。 |
| Step 5 | `.cursor/rules/spawn_system.md` | 登记新 preset 系统与首批组合表。 | 低，文档同步。 |

## 5. 放置规则

Preset 放置器必须比普通随机生成更严格，因为大型敌人的 footprint 会占多列多行。如果一个 slot 无法放置，不应强行挤压已有敌人，而应尝试备用 lane；所有 slot 都失败时，整个 preset 放弃并回退随机生成。

| Lane 语义 | 适用敌人 | 放置策略 |
|---|---|---|
| `center` | `2×1`、`2×2`、`3×2`、`3×3` | 优先居中，失败后左右偏移。 |
| `left` / `right` | 边路突袭或护卫 | 锁定边缘列，失败后向中间偏移。 |
| `front` | 被 `siege` 推挤的低血敌人 | 在大型敌人前方一行放置，失败则取消该 preset。 |
| `back` | 治疗者、回响受益单位 | 在大型敌人后方或同排远侧放置。 |
| `side` | 教学陪衬单位 | 选择不遮挡核心敌人的空位。 |

## 6. 与美术资产系统的关系

预设波次应直接输出美术资产系统所需的组合键。例如 `siege_push_line` 中的核心敌人资产键应解析为 `enemy/elite/3x2/siege/siege.png`，前方盾兵解析为 `enemy/normal/1x1/normal/shield.png`。这能让美术资源优先覆盖预设波次中的高频组合，而不是盲目穷举所有随机组合。[4]

> 资产制作优先级应与 preset 优先级绑定。凡是进入首批 preset 的组合，应优先制作完整独立形象；随机池中的低频组合可以先使用“基底资产 + 词条叠层特效”回退。

## 7. 验收标准

完成首批预设波次功能后，应至少验证三类场景。其一，所有 preset 在目标回合段内能按权重出现，超过 `maxUses` 后不再出现。其二，`siege_push_line` 中的推挤链不会把敌人推到非法区域，也不会造成敌人重叠。其三，预设失败时能回退到现有随机生成，不影响正常回合推进。

| 验收项 | 通过条件 |
|---|---|
| 生成稳定性 | 连续 50 次模拟生成无异常、无重叠、无越界。 |
| 教学节奏 | 首次出现的 V2 机制均有 `introText` 或等价视觉提示。 |
| 美术绑定 | 每个 preset 可生成稳定资产键，缺失资产能回退。 |
| 性能预算 | 大型敌人特效在中低性能档不会显著增加粒子峰值。 |
| 文档同步 | `spawn_system.md` 与 `enemy_art_implementation_impact.md` 均登记最新 preset。 |

## References

[1]: ../src/spawn_system.js "敌人生成系统与导演模板入口"
[2]: ../.cursor/rules/spawn_system.md "生成系统规范与现有导演模板"
[3]: ../src/config.js "敌人曲线与模板权重配置"
[4]: enemy_art_implementation_impact.md "敌人美术资产与词条特效影响范围评估"
