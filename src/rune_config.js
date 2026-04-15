/**
 * rune_config.js - 符文词条系统数据层
 *
 * 职责：
 * - 定义所有符文的基础属性（RUNE_DB）
 * - 定义词条组合词典（RUNEWORD_DB）
 * - 定义套路克制关系字典（COUNTER_MAP）
 *
 * 设计约束：
 * - 符文 element 与现有属性类型保持一致：pyro, cryo, lightning, bounce, pierce, scatter, laser
 * - affinity_tags 与敌人 affixes 对应：shield, regen, haste, clone, devour, healer, jump
 * - 词条 stats 键与现有弹药属性对应
 *
 * 变更记录 (Task 1: 数据结构升级)：
 * - 为每个符文增加 baseStat 字段，映射到对应的弹药属性
 *   baseStat 表示该符文放置在网格中时，每级提供的属性层数加成类型（与 element 相同）
 *   供 Task 3 的 calcRuneBaseStats() 函数使用
 *
 * 变更记录 (稀有度层数加成 + 传说级)：
 * - 新增 rarity 字段标注稀有度：普通 / 稀有 / 史诗 / 传说
 * - 新增 baseStatPerLevel 字段，表示每级提供的基础属性层数
 * - 新增传说级（rarity: 'legendary'），baseDropWeight = 0.5
 * - 掉落权重方案（方案H）：
 *     普通（common）   : baseDropWeight = 12，baseStatPerLevel 按元素设定
 *     稀有（rare）     : baseDropWeight = 5~6，baseStatPerLevel 按元素设定
 *     史诗（epic）     : baseDropWeight = 2，baseStatPerLevel 按元素设定
 *     传说（legendary）: baseDropWeight = 0.5，baseStatPerLevel 按元素设定
 * - 概率分布（总权重≈61）：普通≈59%，稀有≈27.9%，史诗≈9.8%，传说≈3.3%
 * - calcRuneBaseStats() 使用 level × baseStatPerLevel 计算层数
 */

// ==================== 符文基础数据库 ====================
/**
 * RUNE_DB - 符文基础数据库
 * 每个符文对象包含：
 *   id: 唯一字符串标识符
 *   name: 显示名称（中文）
 *   rarity: 稀有度（'common' | 'rare' | 'epic' | 'legendary'）
 *   element: 对应属性类型
 *   baseStat: 基础属性层数对应的弹药属性键（与 element 相同，用于 calcRuneBaseStats 累加）
 *   baseStatPerLevel: 每级提供的基础属性层数（按元素强度与稀有度设定）
 *   icon: emoji 图标
 *   baseDropWeight: 基础掉落权重（普通=12, 稀有=5~6, 史诗=2, 传说=0.5）
 *   affinity_tags: 亲和标签数组（与敌人词缀对应，用于智能掉落权重计算）
 */
const RUNE_DB = [
    // ---- 火焰系 (Pyro) ----
    {
        id: 'rune_pyro_1',
        name: '烈焰符文',
        rarity: 'common',
        element: 'pyro',
        baseStat: 'pyro',
        baseStatPerLevel: 1,       // 普通，每级 1 层
        icon: '🔥',
        baseDropWeight: 12,
        affinity_tags: ['shield', 'regen']
    },
    {
        id: 'rune_pyro_2',
        name: '炎核符文',
        rarity: 'epic',
        element: 'pyro',
        baseStat: 'pyro',
        baseStatPerLevel: 2,       // 史诗，每级 2 层
        icon: '🌋',
        baseDropWeight: 2,
        affinity_tags: ['shield', 'healer']
    },

    // ---- 冰霜系 (Cryo) ----
    {
        id: 'rune_cryo_1',
        name: '寒冰符文',
        rarity: 'common',
        element: 'cryo',
        baseStat: 'cryo',
        baseStatPerLevel: 1,       // 普通，每级 1 层
        icon: '❄️',
        baseDropWeight: 12,
        affinity_tags: ['haste', 'jump']
    },
    {
        id: 'rune_cryo_2',
        name: '冰晶符文',
        rarity: 'epic',
        element: 'cryo',
        baseStat: 'cryo',
        baseStatPerLevel: 2,       // 史诗，每级 2 层
        icon: '🧊',
        baseDropWeight: 2,
        affinity_tags: ['haste', 'regen']
    },

    // ---- 闪电系 (Lightning) ----
    {
        id: 'rune_lightning_1',
        name: '雷霆符文',
        rarity: 'rare',
        element: 'lightning',
        baseStat: 'lightning',
        baseStatPerLevel: 1,       // 稀有，每级 1 层
        icon: '⚡',
        baseDropWeight: 6,
        affinity_tags: ['clone', 'healer']
    },
    {
        id: 'rune_lightning_2',
        name: '电弧符文',
        rarity: 'legendary',
        element: 'lightning',
        baseStat: 'lightning',
        baseStatPerLevel: 4,       // 传说，每级 4 层
        icon: '🌩️',
        baseDropWeight: 0.5,
        affinity_tags: ['clone', 'haste']
    },

    // ---- 弹射系 (Bounce) ----
    {
        id: 'rune_bounce_1',
        name: '弹跃符文',
        rarity: 'common',
        element: 'bounce',
        baseStat: 'bounce',
        baseStatPerLevel: 2,       // 普通，每级 2 层（弹射加量）
        icon: '🔄',
        baseDropWeight: 12,
        affinity_tags: ['clone', 'jump']
    },
    {
        id: 'rune_bounce_2',
        name: '回响符文',
        rarity: 'rare',
        element: 'bounce',
        baseStat: 'bounce',
        baseStatPerLevel: 4,       // 稀有，每级 4 层（弹射加量）
        icon: '↩️',
        baseDropWeight: 5,
        affinity_tags: ['clone', 'devour']
    },

    // ---- 穿透系 (Pierce) ----
    {
        id: 'rune_pierce_1',
        name: '穿刺符文',
        rarity: 'epic',
        element: 'pierce',
        baseStat: 'pierce',
        baseStatPerLevel: 1,       // 史诗，每级 1 层（穿透强力，层数克制）
        icon: '↗️',
        baseDropWeight: 2,
        affinity_tags: ['shield', 'jump']
    },
    {
        id: 'rune_pierce_2',
        name: '破甲符文',
        rarity: 'legendary',
        element: 'pierce',
        baseStat: 'pierce',
        baseStatPerLevel: 3,       // 传说，每级 3 层
        icon: '🗡️',
        baseDropWeight: 0.5,
        affinity_tags: ['shield', 'devour']
    },

    // ---- 散射系 (Scatter) ----
    {
        id: 'rune_scatter_1',
        name: '散裂符文',
        rarity: 'legendary',
        element: 'scatter',
        baseStat: 'scatter',
        baseStatPerLevel: 2,       // 传说，每级 2 层
        icon: '🔱',
        baseDropWeight: 0.5,
        affinity_tags: ['clone', 'healer']
    },

    // ---- 激光系 (Laser) ----
    {
        id: 'rune_laser_1',
        name: '光束符文',
        rarity: 'rare',
        element: 'laser',
        baseStat: 'laser',
        baseStatPerLevel: 1,       // 稀有，每级 1 层
        icon: '☄️',
        baseDropWeight: 6,
        affinity_tags: ['regen', 'devour']
    },
    {
        id: 'rune_laser_2',
        name: '聚焦符文',
        rarity: 'legendary',
        element: 'laser',
        baseStat: 'laser',
        baseStatPerLevel: 4,       // 传说，每级 4 层
        icon: '🔦',
        baseDropWeight: 0.5,
        affinity_tags: ['shield', 'regen']
    }
];

// ==================== 词条组合词典 ====================
/**
 * RUNEWORD_DB - 词条组合词典
 * 每个词条对象包含：
 *   id: 唯一字符串标识符
 *   name: 词条名称（中文）
 *   pattern: 符文 id 数组（2~4个符文，在网格同一路径中凑齐即可，不限顺序）
 *   effect_desc: 效果描述字符串
 *   stats: 属性加成对象（键与现有弹药属性对应）
 */
const RUNEWORD_DB = [
    // ---- 元素专属词条 (7个) ----
    {
        id: 'runeword_meltdown',
        name: '熔毁',
        effectId: 'meltdown',
        pattern: ['rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1'],
        effect_desc: '【火焰系】火焰燃烧伤害与过热爆炸的最终伤害提升。',
        baseParams: { damageBonus: 0.50 },
        perLevelParams: { damageBonus: 0.25 }
    },
    {
        id: 'runeword_absolute_zero',
        name: '绝对零度',
        effectId: 'absolute_zero',
        pattern: ['rune_cryo_1', 'rune_cryo_2', 'rune_cryo_1'],
        effect_desc: '【冰霜系】敌人处于冰冻状态时，每次受到物理伤害，都会令该敌人本回合受到的所有伤害加深。',
        baseParams: { damageAmp: 0.01 },
        perLevelParams: { damageAmp: 0.005 }
    },
    {
        id: 'runeword_frost_nova',
        name: '冰霜新星',
        effectId: 'frost_nova',
        pattern: ['rune_cryo_1', 'rune_bounce_1', 'rune_cryo_2'],
        effect_desc: '【冰霜系】弹珠每弹跳数次，释放一次冰霜新星，造成冰属性伤害并降温。',
        baseParams: { requiredBounces: 5, radius: 80, tempDrop: 10, damageRatio: 0.30 },
        perLevelParams: { requiredBounces: -1, radius: 0, tempDrop: 0, damageRatio: 0.10 }
    },
    {
        id: 'runeword_thunderstorm',
        name: '雷暴之语',
        effectId: 'thunderstorm',
        pattern: ['rune_lightning_1', 'rune_lightning_2', 'rune_lightning_1'],
        effect_desc: '【闪电系】闪电链的伤害衰减系数提升。',
        baseParams: { decayBonus: 0.50 },
        perLevelParams: { decayBonus: 0.10 }
    },
    {
        id: 'runeword_thunder_scatter',
        name: '雷霆散射',
        effectId: 'thunder_scatter',
        pattern: ['rune_lightning_1', 'rune_scatter_1', 'rune_lightning_2'],
        effect_desc: '【闪电系】每次成功触发闪电链时，有概率额外释放一条同属性闪电链。',
        baseParams: { extraChains: 1 },
        perLevelParams: { extraChains: 1 }
    },
    {
        id: 'runeword_kinetic_surge',
        name: '动能激增',
        effectId: 'kinetic_surge',
        pattern: ['rune_bounce_1', 'rune_bounce_2', 'rune_bounce_1'],
        effect_desc: '【弹射系】本次发射的弹珠，后续的每一次弹射伤害固定增加。',
        baseParams: { flatDamage: 1 },
        perLevelParams: { flatDamage: 1 }
    },
    {
        id: 'runeword_irradiation',
        name: '照射',
        effectId: 'irradiation',
        pattern: ['rune_laser_1', 'rune_laser_2', 'rune_laser_1'],
        effect_desc: '【激光系】激光变为持续照射。累积照射同一个敌人，受到的伤害加深。',
        baseParams: { damageAmp: 0.15 },
        perLevelParams: { damageAmp: 0.05 }
    },

    // ---- 复合机制词条 (6个) ----
    {
        id: 'runeword_flame_sword',
        name: '炎光剑影',
        effectId: 'flame_sword',
        pattern: ['rune_pyro_1', 'rune_pierce_1', 'rune_pyro_2'],
        effect_desc: '【穿透系】穿透敌人时，有概率召唤一道火焰剑光。',
        baseParams: { triggerChance: 0.30, damageRatio: 0.60, tempDamageRatio: 0.10 },
        perLevelParams: { triggerChance: 0.10, damageRatio: 0, tempDamageRatio: 0.05 }
    },
    {
        id: 'runeword_armor_piercing_meteor',
        name: '穿甲流星',
        effectId: 'armor_piercing_meteor',
        pattern: ['rune_pierce_2', 'rune_scatter_1', 'rune_pierce_1'],
        effect_desc: '【穿透系】散射出的子弹丸继承 100% 的穿透层数。',
        baseParams: { damageBonus: 0.15 },
        perLevelParams: { damageBonus: 0.15 }
    },
    {
        id: 'runeword_blazing_beam',
        name: '炽热光线',
        effectId: 'blazing_beam',
        pattern: ['rune_pyro_1', 'rune_laser_1', 'rune_laser_2'],
        effect_desc: '【复合系】激光照射敌人时，除了造成伤害，每 0.5 秒还会额外提升敌人温度。',
        baseParams: { tempIncrease: 5 },
        perLevelParams: { tempIncrease: 2 }
    },
    {
        id: 'runeword_lightning_shield',
        name: '雷电护盾',
        effectId: 'lightning_shield',
        pattern: ['rune_lightning_2', 'rune_bounce_2', 'rune_bounce_1'],
        effect_desc: '【复合系】弹珠弹射时有概率在自身周围生成静电场。',
        baseParams: { triggerChance: 0.15, damageRatio: 0.20, shockStacks: 1 },
        perLevelParams: { triggerChance: 0.05, damageRatio: 0.10, shockStacks: 0 }
    },
    {
        id: 'runeword_blade_storm',
        name: '剑刃风暴',
        effectId: 'blade_storm',
        pattern: ['rune_pierce_1', 'rune_pierce_2', 'rune_scatter_1'],
        effect_desc: '【复合系】首个子弹定期对范围内所有敌人生成一次剑光斩击。',
        baseParams: { radius: 120, damageRatio: 0.60, interval: 0.5 },
        perLevelParams: { radius: 0, damageRatio: 0.20, interval: -0.1 }
    },
    {
        id: 'runeword_elemental_fusion',
        name: '元素聚变',
        effectId: 'elemental_fusion',
        pattern: ['rune_pyro_2', 'rune_cryo_2', 'rune_lightning_2'],
        effect_desc: '【复合系】当敌人同时承受火、冰、雷三种状态时，引发元素聚变爆炸。',
        baseParams: { trueDamageRatio: 0.10 },
        perLevelParams: { trueDamageRatio: 0.05 }
    },
    {
        id: 'runeword_sword_resonance',
        name: '剑意共鸣',
        effectId: 'flying_sword_unlock',
        pattern: ['rune_pierce_1', 'rune_pierce_1', 'rune_pierce_1'],
        effect_desc: '【特殊系】解锁飞剑变异。收集阶段穿透弹珠碰撞穿透钉子时，有70%概率使其变异为飞剑钉子。词条等级提升时，飞剑将解锁自动索敌与全自动猎杀模式。',
        baseParams: { level: 1, mutationChance: 0.7 },
        perLevelParams: { level: 1, mutationChance: 0.1 }
    },
    {
        id: 'runeword_storm_resonance',
        name: '风暴共鸣',
        effectId: 'wind_unlock',
        pattern: ['rune_bounce_1', 'rune_bounce_1', 'rune_bounce_1'],
        effect_desc: '【特殊系】解锁风属性变异。收集阶段反弹弹珠碰撞反弹钉子时，有70%概率使其变异为风属性钉子。词条等级提升时，解锁蝶蝶法阵与风道形态。',
        baseParams: { level: 1, mutationChance: 0.7 },
        perLevelParams: { level: 1, mutationChance: 0.1 }
    },

    // ---- 成长型低级词条 (6个，Task A) ----
    {
        id: 'runeword_bloodthirst_edge',
        name: '嗜血初锋',
        effectId: 'bloodthirst_growth',
        pattern: ['rune_pierce_1', 'rune_pyro_1', 'rune_pierce_1'],
        effect_desc: '每次击杀敌人，本局全局基础伤害永久 +1。但你的冰霜与火焰属性层数降低 30%。',
        baseParams: { damagePerKill: 1, elementPenalty: 0.3 },
        perLevelParams: { damagePerKill: 1, elementPenalty: -0.1 }
    },
    {
        id: 'runeword_scatter_matrix',
        name: '散射矩阵',
        effectId: 'multicast_to_scatter',
        pattern: ['rune_bounce_1', 'rune_lightning_1', 'rune_bounce_1'],
        effect_desc: '连射次数全部转化为散射层数。该词条存在时，基础伤害降低 25%，散射子弹的发射夹角缩小 70%。',
        baseParams: { damagePenalty: 0.25, angleMultiplier: 0.3 },
        perLevelParams: { damagePenalty: -0.05, angleMultiplier: -0.1 }
    },
    {
        id: 'runeword_focused_fire',
        name: '专注射击',
        effectId: 'focused_fire',
        pattern: ['rune_laser_1', 'rune_pierce_1', 'rune_laser_1'],
        effect_desc: '将所有弹跳和连射层数转化为基础伤害。伤害有 20% 概率暴击，造成 200% 伤害。',
        baseParams: { critChance: 0.20, critDamage: 2.0 },
        perLevelParams: { critChance: 0.10, critDamage: 0.5 }
    },
    {
        id: 'runeword_mass_collapse',
        name: '质量坍缩',
        effectId: 'mass_collapse',
        pattern: ['rune_bounce_1', 'rune_pyro_1', 'rune_bounce_1'],
        effect_desc: '强制获得爆炸属性（范围减半）。清空连射与散射，每清空 1 层，爆炸范围 +10%。',
        baseParams: { baseRadiusRatio: 0.5, radiusBonusPerLayer: 0.10 },
        perLevelParams: { baseRadiusRatio: 0.2, radiusBonusPerLayer: 0.05 }
    },
    {
        id: 'runeword_kinetic_decay',
        name: '动能衰变',
        effectId: 'kinetic_decay',
        pattern: ['rune_bounce_1', 'rune_pierce_1', 'rune_bounce_1'],
        effect_desc: '子弹初始获得 25% 的伤害加成。但该子弹每次对敌人造成伤害后，此加成会衰减 7%（最低衰减至 0% 加成）。',
        baseParams: { initialBonus: 0.25, decayPerHit: 0.07 },
        perLevelParams: { initialBonus: 0.10, decayPerHit: -0.02 }
    },
    {
        id: 'runeword_echo_shot',
        name: '回响射击',
        effectId: 'echo_shot',
        pattern: ['rune_scatter_1', 'rune_bounce_1', 'rune_scatter_1'],
        effect_desc: '子弹首次击中敌人时，有 25% 概率按原角度额外发射一颗单发子弹。',
        baseParams: { triggerChance: 0.25 },
        perLevelParams: { triggerChance: 0.07 }
    },

    // ---- 特殊召唤词条 (Task: 召剑之语) ----
    {
        id: 'runeword_son_sword_summon',
        name: '召剑之语',
        effectId: 'son_sword_summon',
        pattern: ['rune_pierce_2', 'rune_pierce_1', 'rune_bounce_1'],
        effect_desc: '【特殊系】弹珠每次命中敌人时，有 30% 概率在命中位置召唤一把三级子飞剑。子飞剑遵循原有规则：自动索敌、全伤害共鸣（100%）、完整属性效果（火/冰/雷）。词条等级提升时，召唤概率额外 +15%。',
        baseParams: { triggerChance: 0.30, swordLevel: 3 },
        perLevelParams: { triggerChance: 0.15, swordLevel: 0 }
    }
];

// ==================== 套路克制关系字典 ====================
/**
 * COUNTER_MAP - 套路克制关系字典
 * 定义每种套路对应的敌人标签权重
 * 用于第二层：克制关系映射（玩家套路 → 敌人标签权重）
 *
 * 格式：{ [element]: { [affix_tag]: weight } }
 * weight 表示该套路对该标签敌人的克制强度（0~1.0）
 *
 * 设计逻辑：
 * - pyro（火焰）：克制护盾（shield）和再生（regen）类敌人
 * - cryo（冰霜）：克制极速（haste）和跳跃（jump）类敌人
 * - lightning（闪电）：克制分身（clone）和治疗者（healer）类敌人
 * - bounce（弹射）：克制分身（clone）和吞噬（devour）类敌人
 * - pierce（穿透）：克制护盾（shield）和跳跃（jump）类敌人
 * - scatter（散射）：克制分身（clone）和治疗者（healer）类敌人
 * - laser（激光）：克制再生（regen）和吞噬（devour）类敌人
 */
const COUNTER_MAP = {
    pyro: {
        shield: 1.0,   // 火焰最克制护盾（熔化护盾）
        regen: 0.8,    // 火焰持续伤害克制再生
        healer: 0.4,   // 火焰对治疗者有一定效果
        devour: 0.2    // 火焰对吞噬者效果较弱
    },
    cryo: {
        haste: 1.0,    // 冰霜最克制极速（减速效果）
        jump: 0.8,     // 冰霜冻结克制跳跃
        regen: 0.4,    // 冰霜减缓再生速度
        shield: 0.2    // 冰霜对护盾效果较弱
    },
    lightning: {
        clone: 1.0,    // 闪电链最克制分身（连锁伤害）
        healer: 0.8,   // 闪电克制治疗者（中断治疗）
        haste: 0.4,    // 闪电对极速有一定效果
        jump: 0.2      // 闪电对跳跃效果较弱
    },
    bounce: {
        clone: 1.0,    // 弹射最克制分身（多目标弹跳）
        devour: 0.8,   // 弹射克制吞噬（弹开吞噬）
        jump: 0.5,     // 弹射对跳跃有一定效果
        healer: 0.3    // 弹射对治疗者效果较弱
    },
    pierce: {
        shield: 1.0,   // 穿透最克制护盾（直接穿透）
        jump: 0.8,     // 穿透克制跳跃（精准打击）
        devour: 0.5,   // 穿透对吞噬有一定效果
        regen: 0.2     // 穿透对再生效果较弱
    },
    scatter: {
        clone: 1.0,    // 散射最克制分身（范围覆盖）
        healer: 0.8,   // 散射克制治疗者（多目标覆盖）
        haste: 0.4,    // 散射对极速有一定效果
        shield: 0.2    // 散射对护盾效果较弱
    },
    laser: {
        regen: 1.0,    // 激光最克制再生（持续伤害压制）
        devour: 0.8,   // 激光克制吞噬（精准击杀）
        shield: 0.5,   // 激光对护盾有一定效果
        healer: 0.3    // 激光对治疗者效果较弱
    }
};

// ==================== 属性显示名称映射 ====================
/**
 * STAT_DISPLAY - 属性显示名称与图标映射
 * 用于 UI 展示属性加成时的友好名称
 */
const STAT_DISPLAY = {
    pyro:      { name: '火焰', icon: '🔥' },
    cryo:      { name: '冰霜', icon: '❄️' },
    lightning: { name: '闪电', icon: '⚡' },
    bounce:    { name: '弹跳', icon: '🔄' },
    pierce:    { name: '穿透', icon: '💠' },
    scatter:   { name: '散射', icon: '🌟' },
    laser:     { name: '激光', icon: '🔦' },
    damage:    { name: '伤害', icon: '⚔️' },
};

// ==================== 稀有度显示映射 ====================
/**
 * RARITY_DISPLAY - 稀有度显示名称与颜色映射
 * 用于 UI 展示符文稀有度
 */
const RARITY_DISPLAY = {
    common:    { name: '普通',   color: '#aaaaaa' },
    rare:      { name: '稀有',   color: '#4a90d9' },
    epic:      { name: '史诗',   color: '#9b59b6' },
    legendary: { name: '传说',   color: '#f39c12' },
};

// ==================== 属性共鸣数据库 ====================
/**
 * ELEMENT_RESONANCE_DB - 属性共鸣效果数据库
 *
 * 当玩家在 3x3 网格中放置同属性符文，累计属性层数（由 calcRuneBaseStats 计算）
 * 达到 3/6/9 时，分别激活 Tier1/Tier2/Tier3 共鸣效果。
 *
 * params 字段说明（以 pyro 为例）：
 *   burnTempThreshold  {number}  触发火焰额外伤害所需的最低温度（默认 34）
 *   basePyroBonus      {number}  基础火焰属性层数加成（叠加到 config.pyro 上）
 *   pyroMultiplier     {number}  整体火焰伤害倍率（1.0 = 无加成）
 *   explodeThreshold   {number}  爆燃触发温度阈值（null = 使用全局默认值 200）
 */
const ELEMENT_RESONANCE_DB = {
    pyro: {
        name: '炎焰共鸣',
        icon: '🔥',
        tiers: [
            {
                threshold: 3,
                label: '炎焰共鸣·一阶',
                desc: '火焰额外伤害触发温度降至 30°，基础火焰属性 +5',
                params: {
                    burnTempThreshold: 30,   // 原 34，降低为 30
                    basePyroBonus: 5,        // 基础火焰属性层数 +5
                    pyroMultiplier: 1.0,     // 整体火焰伤害倍率（无额外加成）
                    explodeThreshold: null,  // 使用全局默认值 200
                }
            },
            {
                threshold: 6,
                label: '炎焰共鸣·二阶',
                desc: '火焰额外伤害触发温度降至 0°，基础火焰属性 +10，火焰伤害整体 +20%',
                params: {
                    burnTempThreshold: 0,    // 温度 >= 0 即触发
                    basePyroBonus: 10,       // 基础火焰属性层数 +10
                    pyroMultiplier: 1.2,     // 整体火焰伤害 +20%
                    explodeThreshold: null,  // 使用全局默认值 200
                }
            },
            {
                threshold: 9,
                label: '炎焰共鸣·三阶',
                desc: '火焰额外伤害触发温度降至 0°，爆燃阈值降至 100°，基础火焰属性 +25，火焰伤害整体 +50%',
                params: {
                    burnTempThreshold: 0,    // 温度 >= 0 即触发
                    basePyroBonus: 25,       // 基础火焰属性层数 +25
                    pyroMultiplier: 1.5,     // 整体火焰伤害 +50%
                    explodeThreshold: 100,   // 爆燃阈值降至 100
                }
            },
        ]
    },
    cryo: {
        name: '冰霜共鸣',
        icon: '❄️',
        tiers: [
            {
                threshold: 3,
                label: '冰霜共鸣·一阶',
                desc: '冰冻触发温度提升至 -60°，基础冰霜属性 +5',
                params: {
                    freezeTempThreshold: -60,  // 默认冰冻阈值 -80，提升至 -60 更容易触发
                    baseCryoBonus: 5,          // 基础冰霜属性层数 +5
                    cryoMultiplier: 1.0,       // 整体冰霜伤害倍率（无额外加成）
                }
            },
            {
                threshold: 6,
                label: '冰霜共鸣·二阶',
                desc: '冰冻触发温度提升至 -40°，基础冰霜属性 +10，冰霜伤害整体 +20%',
                params: {
                    freezeTempThreshold: -40,  // 进一步提升至 -40
                    baseCryoBonus: 10,         // 基础冰霜属性层数 +10
                    cryoMultiplier: 1.2,       // 整体冰霜伤害 +20%
                }
            },
            {
                threshold: 9,
                label: '冰霜共鸣·三阶',
                desc: '冰冻触发温度提升至 -20°，基础冰霜属性 +25，冰霜伤害整体 +50%，冰冻状态下受到伤害额外 +30%',
                params: {
                    freezeTempThreshold: -20,  // 最大化提升至 -20，极易触发冰冻
                    baseCryoBonus: 25,         // 基础冰霜属性层数 +25
                    cryoMultiplier: 1.5,       // 整体冰霜伤害 +50%
                    frozenDmgAmp: 0.3,         // 冰冻状态下受到伤害额外加深 30%（供 Step3 在 takeDamage 中读取）
                }
            },
        ]
    },
    lightning: {
        name: '雷霆共鸣',
        icon: '⚡',
        tiers: [
            {
                threshold: 3,
                label: '雷霆共鸣·一阶',
                desc: '闪电链基础触发概率 +15%，基础闪电属性 +5',
                params: {
                    chainChanceBonus: 0.15,
                    baseLightningBonus: 5,
                    lightningMultiplier: 1.0,
                }
            },
            {
                threshold: 6,
                label: '雷霆共鸣·二阶',
                desc: '闪电链基础触发概率 +30%，基础闪电属性 +10，闪电伤害整体 +20%',
                params: {
                    chainChanceBonus: 0.30,
                    baseLightningBonus: 10,
                    lightningMultiplier: 1.2,
                }
            },
            {
                threshold: 9,
                label: '雷霆共鸣·三阶',
                desc: '闪电链基础触发概率 +50%，基础闪电属性 +25，闪电伤害整体 +50%，闪电链伤害衰减降低 20%',
                params: {
                    chainChanceBonus: 0.50,    // 闪电链基础触发概率 +50%（叠加到 CONFIG.mechanics.lightning.baseChainChance 上）
                    baseLightningBonus: 25,    // 基础闪电属性层数 +25
                    lightningMultiplier: 1.5,  // 整体闪电伤害 +50%
                    chainDecayReduction: 0.2,  // 闪电链伤害衰减降低 20%（decayFactor 提升 0.2，供 Step3 在 combat_lightning_triggerChain 中读取）
                }
            },
        ]
    },
    bounce: {
        name: '弹跳共鸣',
        icon: '🔄',
        tiers: [
            {
                threshold: 3,
                label: '弹跳共鸣·一阶',
                desc: '弹跳伤害加成 +15%，基础弹跳属性 +5',
                params: {
                    bounceDmgBonus: 0.15,  // 弹跳伤害加成 +15%（供 Step3 在弹跳伤害计算中读取）
                    baseBounceBonus: 5,    // 基础弹跳属性层数 +5
                }
            },
            {
                threshold: 6,
                label: '弹跳共鸣·二阶',
                desc: '弹跳伤害加成 +30%，基础弹跳属性 +10，弹跳伤害衰减降低 50%',
                params: {
                    bounceDmgBonus: 0.30,      // 弹跳伤害加成 +30%
                    baseBounceBonus: 10,       // 基础弹跳属性层数 +10
                    bounceDecayReduction: 0.5, // 弹跳伤害衰减降低 50%（即 0.5^n 衰减系数的指数 n 减半）
                }
            },
            {
                threshold: 9,
                label: '弹跳共鸣·三阶',
                desc: '弹跳伤害加成 +50%，基础弹跳属性 +25，弹跳次数额外 +2，弹跳后伤害不衰减',
                params: {
                    bounceDmgBonus: 0.50,  // 弹跳伤害加成 +50%
                    baseBounceBonus: 25,   // 基础弹跳属性层数 +25
                    extraBounces: 2,       // 弹跳次数额外 +2（叠加到 recipe.bounce 上）
                    noBounceDecay: true,   // 弹跳后伤害不衰减（覆盖 0.5^n 衰减机制）
                }
            },
        ]
    },
    pierce: {
        name: '穿透共鸣',
        icon: '💠',
        tiers: [
            {
                threshold: 3,
                label: '穿透共鸣·一阶',
                desc: '穿透伤害加成 +15%，基础穿透属性 +5',
                params: {
                    pierceDmgBonus: 0.15,  // 穿透伤害加成 +15%（供 Step3 在穿透伤害计算中读取）
                    basePierceBonus: 5,    // 基础穿透属性层数 +5
                }
            },
            {
                threshold: 6,
                label: '穿透共鸣·二阶',
                desc: '穿透伤害加成 +30%，基础穿透属性 +10，穿透伤害衰减降低 20%（原为 50%）',
                params: {
                    pierceDmgBonus: 0.30,      // 穿透伤害加成 +30%
                    basePierceBonus: 10,       // 基础穿透属性层数 +10
                    pierceDecayReduction: 0.2, // 穿透伤害衰减降低 20%（即 0.5^n 中的衰减系数从 0.5 提升至 0.7）
                }
            },
            {
                threshold: 9,
                label: '穿透共鸣·三阶',
                desc: '穿透伤害加成 +50%，基础穿透属性 +25，穿透次数额外 +1，穿透伤害衰减降低 40%（原为 50%）',
                params: {
                    pierceDmgBonus: 0.50,      // 穿透伤害加成 +50%
                    basePierceBonus: 25,       // 基础穿透属性层数 +25
                    extraPierces: 1,           // 穿透次数额外 +1（叠加到 recipe.pierce 上）
                    pierceDecayReduction: 0.4, // 穿透伤害衰减降低 40%（衰减系数从 0.5 提升至 0.9）
                }
            },
        ]
    },
    scatter: {
        name: '散射共鸣',
        icon: '🌟',
        tiers: [
            {
                threshold: 3,
                label: '散射共鸣·一阶',
                desc: '散射子弹数量额外 +1，基础散射属性 +5',
                params: {
                    extraScatterShots: 1,      // 额外散射子弹 +1（叠加到 recipe.scatter 上）
                    baseScatterBonus: 5,       // 基础散射属性层数 +5
                    scatterMultiplier: 1.0,    // 散射伤害倍率（无额外加成）
                }
            },
            {
                threshold: 6,
                label: '散射共鸣·二阶',
                desc: '散射子弹数量额外 +2，基础散射属性 +10，散射伤害整体 +20%',
                params: {
                    extraScatterShots: 2,      // 额外散射子弹 +2
                    baseScatterBonus: 10,      // 基础散射属性层数 +10
                    scatterMultiplier: 1.2,    // 散射伤害 +20%
                }
            },
            {
                threshold: 9,
                label: '散射共鸣·三阶',
                desc: '散射子弹数量额外 +3，基础散射属性 +25，散射伤害整体 +50%，散射角度收窄 30%',
                params: {
                    extraScatterShots: 3,         // 额外散射子弹 +3
                    baseScatterBonus: 25,         // 基础散射属性层数 +25
                    scatterMultiplier: 1.5,       // 散射伤害 +50%
                    scatterAngleReduction: 0.3,   // 散射角度收窄 30%（即 _scatterAngleMultiplier = 0.7，供 Step3 在 spawn_system.js 中读取）
                }
            },
        ]
    },
    laser: {
        name: '激光共鸣',
        icon: '🔦',
        tiers: [
            {
                threshold: 3,
                label: '激光共鸣·一阶',
                desc: '激光每次命中额外升温 +5°，基础激光属性 +5',
                params: {
                    laserTempBonus: 5,         // 激光命中额外升温 +5°（供 Step3 在 collision.js 中读取，类似 blazing_beam 机制）
                    baseLaserBonus: 5,         // 基础激光属性层数 +5
                    laserMultiplier: 1.0,      // 激光伤害倍率（无额外加成）
                }
            },
            {
                threshold: 6,
                label: '激光共鸣·二阶',
                desc: '激光每次命中额外升温 +10°，基础激光属性 +10，激光伤害整体 +20%',
                params: {
                    laserTempBonus: 10,        // 激光命中额外升温 +10°
                    baseLaserBonus: 10,        // 基础激光属性层数 +10
                    laserMultiplier: 1.2,      // 激光伤害 +20%
                }
            },
            {
                threshold: 9,
                label: '激光共鸣·三阶',
                desc: '激光每次命中额外升温 +20°，基础激光属性 +25，激光伤害整体 +50%，激光折射基础概率 +20%',
                params: {
                    laserTempBonus: 20,           // 激光命中额外升温 +20°
                    baseLaserBonus: 25,           // 基础激光属性层数 +25
                    laserMultiplier: 1.5,         // 激光伤害 +50%
                    laserRefractionBonus: 0.2,    // 激光折射基础概率 +20%（叠加到 laserRefractionBaseChance 上，供 Step3 在 collision.js 中读取）
                }
            },
        ]
    },
};

// ==================== 导出 ====================
export { RUNE_DB, RUNEWORD_DB, COUNTER_MAP, STAT_DISPLAY, RARITY_DISPLAY, ELEMENT_RESONANCE_DB };
