# Echo Alchemist V2 核心机制解析文档

本文档详细解析了《Echo Alchemist V2》中的几项核心游戏机制，包括子弹充能与符文充能机制、遗物与精华的掉落保底机制、以及基于玩家套路的智能掉落算法。

## 1. 充能机制解析

游戏中的“充能”概念主要分为两类：**子弹充能（Ammo Charge）**与**符文充能（Rune Charge）**。

### 1.1 子弹充能（Ammo Charge）

子弹充能机制主要与“命运抉择（Fate Moment）”中的精华奖励相关。

当玩家在回合开始时触发了“混沌精华”或“纯净精华”奖励，游戏会进入命运抉择阶段。此时，如果玩家在上一回合的研磨阶段（Gathering Phase）已经收集并编译了弹珠配方（`marbleQueue`），系统会将这些配方转化为**充能子弹（Charged Ammo）**并保存在 `_chargedAmmoQueue` 中。

在随后的战斗阶段中，这些充能子弹会作为额外的弹药提供给玩家，通常显示在界面的右侧。充能子弹继承了原弹珠的属性和收集到的元素层数，但在生成时会重置其多重施法（multicast）和最终连击数（finalHits）。

### 1.2 符文充能（Rune Charge）

符文充能是一个在战斗阶段中持续进行的积累过程，旨在奖励玩家的高频击中和击杀。

**充能规则：**
- **基础充能：** 每次子弹击中敌人提供 3% 的充能值，如果造成击杀则提供 10% 的充能值。
- **暴击翻倍：** 每次击中都有概率触发充能翻倍。具体概率为：1% 概率获得 8 倍充能，4% 概率获得 4 倍充能，13% 概率获得 2 倍充能，剩余 82% 为基础 1 倍充能。
- **自动衰减：** 充能条在战斗中会以每帧 0.003 的速度自动衰减（约 5 秒内衰减完毕），要求玩家保持持续的攻击节奏。

**充能奖励抽取：**
当充能值达到 100%（1.0）时，充能等级（`runeChargeLevel`）加 1，并触发一次符文抽取（`_runeCharge_draw`）。
抽取算法基于当前的充能等级，设定了一个权重门槛（`RUNE_CHARGE_THRESHOLDS`）。只有基础掉落权重经过衰减计算后低于该门槛的符文才能进入候选池。充能等级越高，门槛越低，玩家越容易抽到高稀有度或高等级的符文。

战斗结束后，玩家可以领取当前预览的充能符文，该符文会自动加入玩家的背包。

## 2. 遗物与精华的掉落保底机制

为了保证玩家的游戏体验，防止长时间“脸黑”无法获得关键道具，游戏引入了严格的保底机制（Pity System）。该机制在 `config.js` 的 `dropPity` 配置中定义，并在 `game_system.js` 的 `sys_determineEnemyReward` 函数中执行。

### 2.1 基础掉落概率

在没有保底干预的情况下，敌人掉落奖励的基础概率如下：
- **基础掉落率：** 4%（`enemyDropBaseChance`）
- **回合加成：** 每回合增加 0.4%，上限为 20%
- **词缀加成：** 带有词缀的精英敌人额外增加 3%
- **最大掉落率上限：** 24%

当判定触发掉落后，系统会进一步决定掉落的具体类型：
- **纯净精华概率：** 35%（`enemyDropPureEssenceChance`）
- **遗物概率：** 基础 12%，精英敌人额外 12%，高血量敌人（>120 HP）额外 8%，最高不超过 45%。
- **混沌精华概率：** 剩余的概率份额。

### 2.2 保底阈值与强制掉落

系统通过追踪连续未掉落的行数来实现保底：
- **精华保底（Essence Pity）：** 连续 4 行敌人未掉落精华时，第 5 行强制触发精华掉落。
- **遗物保底（Relic Pity）：** 连续 12 行敌人未掉落遗物时，第 13 行强制触发遗物掉落。

### 2.3 动态概率修正与限制

除了硬性保底，系统还会根据当前战局动态调整掉落概率：
- **战力碾压限制：** 当玩家的预期伤害超过敌人血量的 2.0 倍（`powerCrushThreshold`）时，系统判定为“战力碾压”。此时将禁用保底机制，且保底计数器暂停累加，防止玩家在低难度下过度刷取资源。
- **场上奖励密度控制：** 为了防止场上堆积过多未拾取的奖励，当场上带有奖励的敌人超过 3 个（`fieldRewardLimit`）时，掉落概率开始衰减（每次乘以 0.4）。当达到 5 个（`fieldRewardHardCap`）时，强制将掉落概率归零，并暂停保底累加。
- **紧急救援机制：** 当玩家的生存压力超过 0.7（`emergencyReliefThreshold`）时，系统会触发紧急救援，提前送出奖励以帮助玩家度过难关。触发后有 3 回合的冷却时间。

## 3. 智能掉落算法（Smart Drop System）

《Echo Alchemist V2》的符文掉落并非完全随机，而是采用了一套基于玩家当前流派（Build）的智能掉落算法，定义在 `loot_system.js` 中。

该算法分为三个核心层次：

### 3.1 玩家套路成分识别

系统会记录玩家最近 5 个回合（`HISTORY_WINDOW`）的伤害数据。通过分析这些数据，系统提取出各属性（如火焰、冰霜、闪电、弹射等）造成的总伤害量，并将其转化为一个百分比向量（`buildVector`）。这代表了玩家当前主打的流派成分。

### 3.2 同属性构筑加权

全局属性克制关系表已移除。智能掉落不再把玩家属性映射到敌人词缀标签，而是直接使用玩家近期伤害构成向量（`buildVector`）提升同属性符文权重。

例如，近期火焰伤害占比越高，火焰符文在候选池中的额外权重越高；激光、剧毒、超载、回响等属性同理。Boss 仍可通过显式 `themeWeights` 注入主题符文权重，但这属于 Boss 独立配置，不再依赖通用克制表。

### 3.3 符文关联与加权抽取

每个符文在数据库（`RUNE_DB`）中都有一个基础掉落权重（`baseDropWeight`）和一组亲和标签（`affinity_tags`）。
系统遍历所有符文，计算其最终权重：
**最终权重 = 基础掉落权重 + (同属性伤害占比 × 智能掉落乘数 3.0) + Boss 主题额外权重**

最后，系统使用加权随机算法（Weighted Random Choice）从候选池中抽取一个符文。这种机制确保玩家更容易获得与当前流派相契合的符文，从而提升构筑（Build）的连贯性。

## 4. 子弹替换机制（Ammo Replace）

子弹替换机制是“命运抉择”与“研磨阶段”之间的一个重要衔接环节，旨在让玩家在获得精华奖励后，能够灵活管理自己的弹药库。

### 4.1 触发条件与充能子弹生成

当玩家在回合开始时触发了“混沌精华”或“纯净精华”奖励，系统会进入命运抉择阶段。此时，如果玩家在上一回合的研磨阶段已经收集并编译了弹珠配方（`marbleQueue`），系统会执行以下操作：
1. 将这些配方转化为**充能子弹（Charged Ammo）**。
2. 重置这些子弹的多重施法（`multicast`）和最终连击数（`finalHits`）。
3. 将它们保存在临时队列 `_chargedAmmoQueue` 中。

### 4.2 替换阶段（Replace Ammo Phase）

在玩家完成命运抉择并结束本回合的研磨阶段后，如果 `_chargedAmmoQueue` 中存在充能子弹，系统将不会直接进入战斗，而是触发**子弹替换阶段（`sys_initReplaceAmmoPhase`）**。

在该阶段，界面会展示两组卡片：
- **左侧（New Grind）：** 本回合新研磨生成的子弹配方（`ammoQueue`）。
- **右侧（Charged）：** 上回合保留下来的充能子弹（`_chargedAmmoQueue`）。

**选择规则：**
- 系统默认选中右侧的充能子弹。
- 玩家可以自由点击卡片进行切换，但最多只能选择与最大子弹数（通常为 3）相等的卡片数量。
- 玩家也可以选择直接点击“跳过”按钮（`sys_skipReplaceAmmo`），此时系统会丢弃充能子弹，完全使用本回合新研磨的子弹进入战斗。

### 4.3 纯净精华的特殊分支：跳过研磨（Skip Grind）

纯净精华（Pure Essence）与混沌精华（Chaos Essence）在命运抉择阶段有一个核心区别：**纯净精华允许玩家直接跳过研磨阶段**。

当玩家在纯净精华界面点击“跳过研磨”按钮（`sys_skipGrindGetRune`）时：
1. **获取补偿符文：** 系统会根据当前回合数（Round 1-5 给 Lv1，6-15 给 Lv2，16+ 给 Lv3）随机生成一个符文直接放入背包。
2. **弹药来源准备：** 由于跳过了研磨，本回合没有新研磨子弹。系统会**优先使用上回合保留的充能子弹（`_chargedAmmoQueue`）**；若 `_chargedAmmoQueue` 为空，则把当前 `marbleQueue` 编译进 `_chargedAmmoQueue`。
3. **进入「单个子弹替换」阶段：** 当存在可保留的充能子弹时，系统会进入子弹替换阶段（`sys_initReplaceAmmoPhase`），界面只展示右侧充能子弹，让玩家自主决定保留哪几枚后再进入战斗。若没有任何可用充能子弹，系统会回到标准弹珠选择，避免空弹药进入战斗造成死循环。
4. **跳过按钮屏蔽：** 此场景下没有新研磨子弹可回退，替换界面会自动隐藏「跳过」按钮，避免玩家误把 `ammoQueue` 清空导致死循环。
5. **选择数量上限：** 替换阶段要求选择 `min(子弹上限, 当前可选卡片数)` 枚子弹；因此纯净精华跳过研磨后即使只有 1-2 枚充能子弹，也可以正常确认进入战斗。

### 4.4 确认与状态流转

当玩家在替换界面确认选择后（`sys_confirmReplaceAmmo`），系统会将选中的卡片合并为最终的 `ammoQueue`，并清空临时队列 `_chargedAmmoQueue` 和替换上下文 `replaceAmmoContext`。随后，游戏正式进入战斗阶段。

这一机制赋予了玩家在获得精华奖励时“保留上回合强力子弹”的策略选择权，同时通过纯净精华的“跳过研磨”分支，为玩家提供了更灵活的节奏控制。
## 2026-06-21 Marble Rune Slot Update

- Essence rewards are no longer a new-run reward source. The standard pre-grind entry is now `marble_pack`.
- Each `MarbleDefinition` can hold up to 3 fused rune slots through `runeSlots`.
- Fusing a rune in the marble selection preview consumes the rune immediately and adds temporary recipe stats through `source: 'rune_slot'`.
- Gathering settlement must not persist `source: 'rune_slot'` entries inside `marble.collected`; the durable source of truth is the marble's `runeSlots` array.
## 2026-06-21 Charge Batch Gathering

- A round charge launches up to 3 selected marbles at once. Each marble keeps an independent gathering session and becomes one ammo recipe when the board settles.
- The final bullet list is produced only after all marbles, split clones, energy orbs, and roulette callbacks have completed.
- Peg trigger cooldown is per ball: repeated contact with the same peg does not add energy or attributes until that ball hits a different peg.
- Rune slots remain durable marble equipment. Their `source: 'rune_slot'` stats are injected into the session for compilation and are not copied into persistent `marble.collected`.
