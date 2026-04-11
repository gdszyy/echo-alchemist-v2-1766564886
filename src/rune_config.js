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
 * 变更记录 (稀有度层数加成)：
 * - 为每个符文增加 baseStatPerLevel 字段，表示每级提供的基础属性层数
 *   普通符文（baseDropWeight 7~8）：每级 1 层
 *   稀有符文（baseDropWeight 5~6）：每级 2 层
 *   史诗符文（baseDropWeight 3~4）：每级 3 层
 *   calcRuneBaseStats() 将使用此字段替代固定的 level 值进行累加
 */

// ==================== 符文基础数据库 ====================
/**
 * RUNE_DB - 符文基础数据库
 * 每个符文对象包含：
 *   id: 唯一字符串标识符
 *   name: 显示名称（中文）
 *   element: 对应属性类型
 *   baseStat: 基础属性层数对应的弹药属性键（与 element 相同，用于 calcRuneBaseStats 累加）
 *   baseStatPerLevel: 每级提供的基础属性层数（普通=1, 稀有=2, 史诗=3）
 *   icon: emoji 图标
 *   baseDropWeight: 基础掉落权重（1~10，越高越常见）
 *   affinity_tags: 亲和标签数组（与敌人词缀对应，用于智能掉落权重计算）
 */
const RUNE_DB = [
    // ---- 火焰系 (Pyro) ----
    {
        id: 'rune_pyro_1',
        name: '烈焰符文',
        element: 'pyro',
        baseStat: 'pyro',
        baseStatPerLevel: 1, // 普通（weight 8）
        icon: '🔥',
        baseDropWeight: 8,
        affinity_tags: ['shield', 'regen']
    },
    {
        id: 'rune_pyro_2',
        name: '炎核符文',
        element: 'pyro',
        baseStat: 'pyro',
        baseStatPerLevel: 2, // 稀有（weight 5）
        icon: '🌋',
        baseDropWeight: 5,
        affinity_tags: ['shield', 'healer']
    },

    // ---- 冰霜系 (Cryo) ----
    {
        id: 'rune_cryo_1',
        name: '寒冰符文',
        element: 'cryo',
        baseStat: 'cryo',
        baseStatPerLevel: 1, // 普通（weight 8）
        icon: '❄️',
        baseDropWeight: 8,
        affinity_tags: ['haste', 'jump']
    },
    {
        id: 'rune_cryo_2',
        name: '冰晶符文',
        element: 'cryo',
        baseStat: 'cryo',
        baseStatPerLevel: 2, // 稀有（weight 5）
        icon: '🧊',
        baseDropWeight: 5,
        affinity_tags: ['haste', 'regen']
    },

    // ---- 闪电系 (Lightning) ----
    {
        id: 'rune_lightning_1',
        name: '雷霆符文',
        element: 'lightning',
        baseStat: 'lightning',
        baseStatPerLevel: 1, // 普通（weight 7）
        icon: '⚡',
        baseDropWeight: 7,
        affinity_tags: ['clone', 'healer']
    },
    {
        id: 'rune_lightning_2',
        name: '电弧符文',
        element: 'lightning',
        baseStat: 'lightning',
        baseStatPerLevel: 3, // 史诗（weight 4）
        icon: '🌩️',
        baseDropWeight: 4,
        affinity_tags: ['clone', 'haste']
    },

    // ---- 弹射系 (Bounce) ----
    {
        id: 'rune_bounce_1',
        name: '弹跃符文',
        element: 'bounce',
        baseStat: 'bounce',
        baseStatPerLevel: 1, // 普通（weight 8）
        icon: '🔄',
        baseDropWeight: 8,
        affinity_tags: ['clone', 'jump']
    },
    {
        id: 'rune_bounce_2',
        name: '回响符文',
        element: 'bounce',
        baseStat: 'bounce',
        baseStatPerLevel: 2, // 稀有（weight 5）
        icon: '↩️',
        baseDropWeight: 5,
        affinity_tags: ['clone', 'devour']
    },

    // ---- 穿透系 (Pierce) ----
    {
        id: 'rune_pierce_1',
        name: '穿刺符文',
        element: 'pierce',
        baseStat: 'pierce',
        baseStatPerLevel: 1, // 普通（weight 7）
        icon: '↗️',
        baseDropWeight: 7,
        affinity_tags: ['shield', 'jump']
    },
    {
        id: 'rune_pierce_2',
        name: '破甲符文',
        element: 'pierce',
        baseStat: 'pierce',
        baseStatPerLevel: 3, // 史诗（weight 4）
        icon: '🗡️',
        baseDropWeight: 4,
        affinity_tags: ['shield', 'devour']
    },

    // ---- 散射系 (Scatter) ----
    {
        id: 'rune_scatter_1',
        name: '散裂符文',
        element: 'scatter',
        baseStat: 'scatter',
        baseStatPerLevel: 2, // 稀有（weight 6）
        icon: '🔱',
        baseDropWeight: 6,
        affinity_tags: ['clone', 'healer']
    },

    // ---- 激光系 (Laser) ----
    {
        id: 'rune_laser_1',
        name: '光束符文',
        element: 'laser',
        baseStat: 'laser',
        baseStatPerLevel: 3, // 史诗（weight 4）
        icon: '☄️',
        baseDropWeight: 4,
        affinity_tags: ['regen', 'devour']
    },
    {
        id: 'rune_laser_2',
        name: '聚焦符文',
        element: 'laser',
        baseStat: 'laser',
        baseStatPerLevel: 3, // 史诗（weight 3）
        icon: '🔦',
        baseDropWeight: 3,
        affinity_tags: ['shield', 'regen']
    }
];

// ==================== 词条组合词典 ====================
/**
 * RUNEWORD_DB - 词条组合词典
 * 每个词条对象包含：
 *   id: 唯一字符串标识符
 *   name: 词条名称（中文）
 *   pattern: 符文 id 数组（2~4个符文，按顺序排列在网格中）
 *   effect_desc: 效果描述字符串
 *   stats: 属性加成对象（键与现有弹药属性对应）
 */
const RUNEWORD_DB = [
    // ---- 火焰套路词条 ----
    {
        id: 'runeword_inferno',
        name: '烈焰之语',
        pattern: ['rune_pyro_1', 'rune_pyro_2'],
        effect_desc: '双火共鸣，火焰伤害大幅提升，附加灼烧持续效果。',
        stats: { pyro: 3, damage: 5 }
    },
    {
        id: 'runeword_blazing_pierce',
        name: '炎刃之语',
        pattern: ['rune_pyro_1', 'rune_pierce_1'],
        effect_desc: '烈焰附着于穿刺之上，穿透敌人时留下灼烧痕迹。',
        stats: { pyro: 2, pierce: 1 }
    },

    // ---- 冰霜套路词条 ----
    {
        id: 'runeword_glacial',
        name: '冰封之语',
        pattern: ['rune_cryo_1', 'rune_cryo_2'],
        effect_desc: '双冰共鸣，冰霜效果增强，敌人减速效果延长。',
        stats: { cryo: 3, damage: 3 }
    },
    {
        id: 'runeword_frozen_bounce',
        name: '冰弹之语',
        pattern: ['rune_cryo_1', 'rune_bounce_1'],
        effect_desc: '冰霜弹珠每次弹跳时释放冰晶碎片，对周围敌人造成减速。',
        stats: { cryo: 2, bounce: 1 }
    },

    // ---- 闪电套路词条 ----
    {
        id: 'runeword_thunderstorm',
        name: '雷暴之语',
        pattern: ['rune_lightning_1', 'rune_lightning_2'],
        effect_desc: '双雷共鸣，闪电链效果增强，可在更多敌人间跳跃。',
        stats: { lightning: 3, scatter: 1 }
    },
    {
        id: 'runeword_chain_scatter',
        name: '雷散之语',
        pattern: ['rune_lightning_1', 'rune_scatter_1'],
        effect_desc: '闪电与散射融合，散射弹丸携带电弧效果。',
        stats: { lightning: 2, scatter: 2 }
    },

    // ---- 弹射套路词条 ----
    {
        id: 'runeword_echo_bounce',
        name: '回响之语',
        pattern: ['rune_bounce_1', 'rune_bounce_2'],
        effect_desc: '双弹共鸣，弹跳次数增加，每次弹跳伤害递增。',
        stats: { bounce: 4, damage: 2 }
    },
    {
        id: 'runeword_laser_focus',
        name: '聚光之语',
        pattern: ['rune_laser_1', 'rune_laser_2'],
        effect_desc: '双激光共鸣，光束穿透力增强，持续时间延长。',
        stats: { laser: 3, pierce: 1 }
    },

    // ---- 复合套路词条 ----
    {
        id: 'runeword_elemental_surge',
        name: '元素涌动之语',
        pattern: ['rune_pyro_1', 'rune_cryo_1', 'rune_lightning_1'],
        effect_desc: '三元素共鸣，触发元素爆发，造成范围性混合元素伤害。',
        stats: { pyro: 1, cryo: 1, lightning: 1, damage: 8 }
    },
    {
        id: 'runeword_piercing_storm',
        name: '穿刺风暴之语',
        pattern: ['rune_pierce_1', 'rune_pierce_2', 'rune_scatter_1'],
        effect_desc: '穿透与散射融合，弹丸穿透后分裂成多个散射弹。',
        stats: { pierce: 2, scatter: 3, damage: 4 }
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

// ==================== 导出 ====================
export { RUNE_DB, RUNEWORD_DB, COUNTER_MAP, STAT_DISPLAY };
