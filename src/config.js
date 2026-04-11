/**
 * config.js - 游戏配置与数据层
 * 
 * 职责：
 * - 存放所有游戏常量、配置、平衡性数值
 * - 词缀字典、属性定义、商店商品列表
 * - NPC对话文本、大地图节点数据（未来扩展）
 * 
 * 优势：
 * - AI 可以在不破坏代码结构的情况下调整游戏平衡
 * - 数据与逻辑分离，便于维护和调试
 */

// ==================== 商店配置 ====================

const META_SHOP_CONFIG = {
    // 商店货币定义：每种元素类型的符文均可作为货币
    resources: {
        rune_fragments: { id: 'rune_fragments', name: '符文碎片', icon: '🔮', color: '#a855f7' },
        rune_pyro:      { id: 'rune_pyro',      name: '火焰符文', icon: '🔥', color: '#ef4444', element: 'pyro' },
        rune_cryo:      { id: 'rune_cryo',      name: '冰霜符文', icon: '❄️', color: '#60a5fa', element: 'cryo' },
        rune_lightning: { id: 'rune_lightning', name: '闪电符文', icon: '⚡',    color: '#facc15', element: 'lightning' },
        rune_bounce:    { id: 'rune_bounce',    name: '弹射符文', icon: '🔄', color: '#a3e635', element: 'bounce' },
        rune_pierce:    { id: 'rune_pierce',    name: '穿透符文', icon: '↗️', color: '#f97316', element: 'pierce' },
        rune_scatter:   { id: 'rune_scatter',   name: '散射符文', icon: '🔱', color: '#c084fc', element: 'scatter' },
        rune_laser:     { id: 'rune_laser',     name: '激光符文', icon: '☄️', color: '#34d399', element: 'laser' }
    },
    upgrades: [
        // ===== 通用升级（符文碎片） =====
        {
            id: 'defense_line',
            category: 'defense',
            name: '防线加固',
            desc: '減少初始生成的敌人行数。',
            icon: '🛡️',
            maxLevel: 2,
            cost: { resourceId: 'rune_fragments', values: [3, 8], type: 'fixed' },
            effect: { path: 'gameplay.startRows', valuePerLevel: -1, type: 'add' }
        },
        {
            id: 'relic_choice',
            category: 'resource',
            name: '博学多才',
            desc: '增加遗物选择时的可选数量。',
            icon: '📚',
            maxLevel: 2,
            cost: { resourceId: 'rune_fragments', values: [5, 15], type: 'fixed' },
            effect: { path: 'gameplay.relicChoiceNum', valuePerLevel: 1, type: 'add' }
        },
        {
            id: 'base_damage_up',
            category: 'attribute',
            name: '火药改良',
            desc: '所有子弹的初始基础伤害提升。',
            icon: '💥',
            maxLevel: 5,
            cost: { resourceId: 'rune_fragments', base: 4, growth: 1.5, type: 'exponential' },
            effect: { path: 'gameplay.baseDamage', valuePerLevel: 1, type: 'add' }
        },
        {
            id: 'sp_capacity',
            category: 'resource',
            name: '能量容器',
            desc: '插升技能点(SP)的最大存储上限。',
            icon: '⚡',
            maxLevel: 5,
            cost: { resourceId: 'rune_fragments', base: 6, growth: 2.0, type: 'exponential' },
            effect: { path: 'gameplay.maxSkillPoints', valuePerLevel: 1, type: 'add' }
        },
        {
            id: 'assimilation_boost',
            category: 'attribute',
            name: '同化共鸣',
            desc: '提升所有属性的基础同化概率。',
            icon: '🧪',
            maxLevel: 5,
            cost: { resourceId: 'rune_fragments', base: 3, growth: 2.0, type: 'exponential' },
            effect: { path: 'gameplay.assimilationChance', valuePerLevel: 0.02, type: 'add_all' }
        },

        // ===== 火焰系升级（火焰符文） =====
        {
            id: 'pyro_efficiency',
            category: 'attribute',
            name: '纯净燃油',
            desc: '提升 [火焰] 属性单层提供的热量値。',
            icon: '🔥',
            maxLevel: 5,
            cost: { resourceId: 'rune_pyro', base: 2, growth: 1.5, type: 'exponential' },
            effect: { path: 'balance.pyroAmount', valuePerLevel: 0.2, type: 'add' }
        },
        {
            id: 'init_weight_bounce',
            category: 'attribute',
            name: '弹性增幅',
            desc: '增加初始弹珠中 [反弹] 属性的权重。',
            icon: '🔄',
            maxLevel: 10,
            cost: { resourceId: 'rune_bounce', base: 1, growth: 1.4, type: 'exponential' },
            effect: { path: 'probabilities.bounce', valuePerLevel: 10, type: 'add' }
        },

        // ===== 冰霜系升级（冰霜符文） =====
        {
            id: 'cryo_efficiency',
            category: 'attribute',
            name: '极寒晶核',
            desc: '提升 [冰霜] 属性单层提供的冷冻値。',
            icon: '❄️',
            maxLevel: 5,
            cost: { resourceId: 'rune_cryo', base: 2, growth: 1.5, type: 'exponential' },
            effect: { path: 'balance.cryoAmount', valuePerLevel: 0.2, type: 'add' }
        },

        // ===== 闪电系升级（闪电符文） =====
        {
            id: 'sp_regen',
            category: 'resource',
            name: '雷光充能',
            desc: '提升每回合战斗开始时回复的技能点数量。',
            icon: '⚡',
            maxLevel: 3,
            cost: { resourceId: 'rune_lightning', base: 2, growth: 1.8, type: 'exponential' },
            effect: { path: 'gameplay.spRegenPerRound', valuePerLevel: 1, type: 'add' }
        },

        // ===== 穿透系升级（穿透符文） =====
        {
            id: 'init_weight_pierce',
            category: 'attribute',
            name: '穿透解鎖',
            desc: '解锁并增加初始 [穿透] 属性的权重。',
            icon: '↗️',
            maxLevel: 10,
            cost: { resourceId: 'rune_pierce', base: 2, growth: 1.5, type: 'exponential' },
            effect: { path: 'probabilities.pierce', valuePerLevel: 8, type: 'add' }
        },

        // ===== 激光系升级（激光符文） =====
        {
            id: 'laser_focus',
            category: 'attribute',
            name: '聚焦透镜',
            desc: '提升 [激光] 属性的初始射程/穿透深度。',
            icon: '🔦',
            maxLevel: 5,
            cost: { resourceId: 'rune_laser', base: 2, growth: 1.5, type: 'exponential' },
            effect: { path: 'gameplay.laserLengthBonus', valuePerLevel: 50, type: 'add' }
        },

        // ===== 临时增强（混合符文） =====
        {
            id: 'init_wind_peg',
            category: 'temporary',
            name: '风暴之眼',
            desc: '下一次游戏：收集阶段初始将 1 个普通钉子替换为 [风] 属性钉子。(每局可购买一次)',
            icon: '🌪️',
            maxLevel: 1,
            cost: { resourceId: 'rune_scatter', base: 2, growth: 1.0, type: 'exponential' },
            effect: { path: 'gameplay.initWindPegs', valuePerLevel: 1, type: 'add' },
            temporary: true
        },
        {
            id: 'init_sword_peg',
            category: 'temporary',
            name: '剑塚',
            desc: '下一次游戏：收集阶段初始将 1 个普通钉子替换为 [飞剑] 属性钉子。(每局可购买一次)',
            icon: '🗡️',
            maxLevel: 1,
            cost: { resourceId: 'rune_pierce', base: 3, growth: 1.0, type: 'exponential' },
            effect: { path: 'gameplay.initSwordPegs', valuePerLevel: 1, type: 'add' },
            temporary: true
        },
        {
            id: 'combo_mastery',
            category: 'resource',
            name: '充能加速',
            desc: '降低充能条的衰减速度，让充能持续更久。',
            icon: '🔋',
            maxLevel: 3,
            cost: { resourceId: 'rune_lightning', base: 3, growth: 2.0, type: 'exponential' },
            effect: { path: 'gameplay.initTriggerThreshold', valuePerLevel: -1, type: 'add' }
        }
    ],
    categories: {
        attribute: { name: '属性炼金', icon: '🧪' },
        defense: { name: '陣地防御', icon: '🏰' },
        resource: { name: '资源调度', icon: '📦' },
        temporary: { name: '临时增强', icon: '⏳' }
    }
};

// ==================== 属性配置 ====================

const ATTRIBUTES_FOR_SHOP = [
    { id: 'scatter', icon: '🔱', name: '散射' },
    { id: 'cryo', icon: '❄️', name: '冰霜' },
    { id: 'pyro', icon: '🔥', name: '火焰' },
    { id: 'lightning', icon: '⚡', name: '闪电' },
    { id: 'laser', icon: '🔦', name: '激光' }
];

// 动态生成属性亲和升级（使用对应element的符文作为货币）
ATTRIBUTES_FOR_SHOP.forEach(attr => {
    // 尝试匹配对应的符文资源ID
    const runeResId = `rune_${attr.id}`;
    const hasRuneRes = META_SHOP_CONFIG.resources[runeResId];
    META_SHOP_CONFIG.upgrades.push({
        id: `prob_${attr.id}`,
        category: 'attribute',
        name: `${attr.name}亲和`,
        desc: `增加收集阶段 [${attr.name}] 属性出现的概率权重。`,
        icon: attr.icon,
        maxLevel: 5,
        // 如果有对应符文资源，使用对应符文；否则使用符文碎片
        cost: { resourceId: hasRuneRes ? runeResId : 'rune_fragments', base: 2, growth: 1.4, type: 'exponential' },
        effect: { path: `probabilities.${attr.id}`, valuePerLevel: 5, type: 'add' }
    });
});

// ==================== 工具函数 ====================

/**
 * 深度设置对象值
 */
function setDeepValue(obj, path, value, type) {
	console.log("setDeepValue")
    const keys = path.split('.');
    let current = obj;
    
    // 特殊处理：add_all (针对 assimilationChance 这种对象)
    if (type === 'add_all') {
        const target = keys.reduce((acc, key) => acc[key], obj);
        for (let k in target) {
            if (typeof target[k] === 'number') target[k] += value;
        }
        return;
    }

    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }
    const lastKey = keys[keys.length - 1];
    
    if (type === 'add') current[lastKey] = (current[lastKey] || 0) + value;
    else if (type === 'multiply') current[lastKey] = (current[lastKey] || 1) * value;
    else if (type === 'set') current[lastKey] = value;
	console.log(path,current[lastKey])
}


// ==================== 游戏核心配置 ====================

const CONFIG = {
    /** 颜色配置 (保持不变) */
    ui: {
        damageStats: {
            bounce: '#22c55e',
            pierce: '#fca5a5',
            scatter: '#facc15',
            damage: '#e2e8f0',
            cryo: '#06b6d4',
            pyro: '#f97316',
            lightning: '#c084fc',
            wind: '#34d399',
            flying_sword: '#0ea5e9',
            explosive: '#f87171',
            default: '#cbd5e1'
        },
        attributeDisplay: {
            'resonance': { name: '共鳴', icon: '🔔', color: '#f59e0b' },
            'white': { name: '純淨', icon: '⚪', color: '#f8fafc' },
            'explosive': { name: '爆破', icon: '🧨', color: '#fca5a5' },
            'rainbow': { name: '七彩', icon: '🌈', color: 'linear-gradient(135deg, #fca5a5, #facc15, #4ade80, #60a5fa)' },
            'matryoshka': { name: '套娃', icon: '🪆', color: '#d946ef' },
            'flying_sword': { name: '飛劍', icon: '🗡🗡', color: '#0ea5e9' },
            'bounce': { name: '彈性', icon: '⤴️', color: '#22c55e' },
            'pierce': { name: '穿透', icon: '↗️', color: '#ef4444' },
            'scatter': { name: '散射', icon: '🔱', color: '#facc15' },
            'damage': { name: '增幅', icon: '⚔️', color: '#a855f7' },
            'cryo': { name: '冰霜', icon: '❄️', color: '#06b6d4' },
            'pyro': { name: '火焰', icon: '🔥', color: '#f97316' },
            'lightning': { name: '閃電', icon: '⚡', color: '#c084fc' },
            'laser': { name: '光', icon: '☄️', color: '#0ea5e9' },
            'wind': { name: '風', icon: '🌪️', color: '#34d399' },
            'multicast': { name: '连射', icon: '🔗', color: '#AAAAAA' }
        }
    },
    colors: {
        flying_sword: '#0ea5e9', 
        flying_sword_lv2: '#6366f1', // 进阶紫色
        flying_sword_lv3: '#f43f5e', // 终极红色
        resonance: '#f59e0b', // 琥珀色
        resonanceRipple: '#99DFBA', // 青色波纹
        laser: '#0ea5e9', // 天蓝色.
        wheelPointer:'#ef4444',
        slotWheel:'rgba(230, 221, 155,0.42)',
        bg: '#0f172a',
        peg: '#475569',
        pegActive: '#cbd5e1',
        pegPink: '#f472b6',
        matBase: '#3b82f6',
        matBounce: '#22c55e',
        matPierce: '#ef4444',
        matScatter: '#facc15',
        matDamage: '#a855f7',
        matCryo: '#06b6d4',
        matPyro: '#f97316',
        matLightning: '#c084fc',
        matWind: '#34d399',
        matWind_lv2: '#10b981', // 进阶深绿
        matWind_lv3: '#059669', // 终极墨绿
        marbleWhite: '#f8fafc',
        matMatryoshka: '#d946ef',
        marbleRedStripe: '#fca5a5',
        marbleRainbow: 'linear-gradient(135deg, #fca5a5, #facc15, #4ade80, #60a5fa)',
        enemy: '#eeeeee',
        enemyHit: '#d8b4fe',
        enemyFrozen: '#06b6d4',
        enemyOverheat: '#f97316',
        enemyShield: '#3b82f6',
        slotRecall: '#a855f7',
        slotMulticast: '#f97316',
        slotSplit: '#3b82f6',
        // [新增]
        slotGiant: '#ef4444', // 紅色 (變大)
        slotSkill: '#10b981', // 綠色 (技能點)
    },
    evolutionRules: {
        'pierce': {
            'pierce': { result: 'flying_sword', type: 'mutation' }, // 穿透球撞穿透钉 -> 突变
            'flying_sword': { result: 'flying_sword', type: 'upgrade' } // 穿透球撞飞剑钉 -> 升级
        },
        'bounce': {
            'bounce': { result: 'wind', type: 'mutation' }, // 反弹球撞反弹钉 -> 突变风属性
            'wind': { result: 'wind', type: 'upgrade' }     // 反弹球撞风钉 -> 升级
        }
    },
    /** 物理与尺寸配置 */
    physics: { 
        gravity: 0.30,      // 重力加速度
        friction: 0.99,     // 空气阻力
        elasticity: 0.89,    // 墙壁/钉子反弹系数
        marbleRadius: 7.7,   // 【收集阶段】弹珠半径 (原为12)
        bulletRadius: 11,   // 【战斗阶段】弹丸半径 (原为11)
        bulletCopyRadius: 8, // 【战斗阶段】复制/散射弹丸半径
        pinkpegElasticityMuti:2.2
    },
    flyingSword : {
        sonSpeed: 5,
        sonTurnSpeed: 0.12,
        markDuration: 999999 // 标记持续帧数
    },
    /** 风属性系统配置 */
    wind_system: {
        // 蝴蝶法阵参数
        butterfly: {
            damageMult: 1.0,      // 风刃伤害倍率 (基于子弹伤害)
            baseCooldown: 27,     // 基础伤害冷却 (帧)
            minCooldown: 7,       // 最小伤害冷却 (帧)
            bladeSizeBase: 25,    // 风刃基础大小
            bladeSizeVar: 15,     // 风刃大小随机波动
            bladeSpeedBase: 25,   // 风刃基础速度
            bladeSpeedVar: 7,    // 风刃速度随机波动
            launchOffset: 150,    // 发射起点偏移 (屏幕外)
            deleteOffset: 200,    // 删除判定偏移 (屏幕外)
            duration: 5000        // 法阵持续时间 (ms)
        },
        // 风暴核心参数
        storm_core: {
            damageMult: 2.0,      // 大旋风伤害倍率
            radiusMax: 80,        // 最大核心半径
            energyPerSecond: 1,   // 每秒充能值
            decayPerRound: 1,     // 每回合能量衰减
            cycloneRadiusMult: 1.5 // 大旋风半径相对于核心的倍率
        },
        // 基础风属性参数
        base: {
            anchorExplosionMult: 2.0, // 锚点消失爆炸伤害倍率
            smallWhirlwindMult: 1.0,  // 小旋风伤害倍率
			stormDamageMult: 1.5,
            tunnelDamageMult: 2.0,    // 风道伤害倍率
            shockwaveMult: 8.0,       // 冲击波伤害倍率
            blackholeMult: 9999,      // 黑洞伤害 (即死级)
            hitStopScale: 0.02,       // 强力顿挫时间缩放
            hitStopDuration: 15       // 强力顿挫持续帧数
        }
    },
    /** 属性与机制阈值配置 */
    mechanics: {
        // DDA (动态难度调整)
        dda: {
            playerPowerThresholdMult: 0.5, // 玩家战力阈值倍率 (基于敌人期望血量)
            difficultyGrowthFactorLow: 0.65, // 战力不足时的成长系数
        },
        // 慢动作系统
        slow_motion: {
            percentCurrent: 0.10, // 造成当前剩余总血量的 10% 伤害算“重击”
            percentMax: 0.05,     // 造成最大总血量的 5% 伤害算“重击”
            wCurrent: 0.7,        // 权重：更看重“当前血量”的比例
            wMax: 0.3,            // 权重：最大血量的比例
            minThreshold: 25,     // 保底值
            duration: 12,         // 持续帧数
            timeScale: 0.1,       // 触发时的降速值
            recoveryRate: 0.1     // 恢复速率
        },
        // 风属性系统
        wind: {
            stormAreaThreshold: 15000, // 判定为大型风暴的面积阈值
        },
        // 火属性 (过热爆炸)
        pyro: {
            explodeThreshold: 200,    // 过热爆炸阈值
            baseExplodeChance: 0.15,   // 基础爆炸概率
            maxExplodeChance: 0.9,    // 最大爆炸概率
            tempForMaxChance: 800,    // 达到最大概率所需的温度
            heatConsumptionRate: 0.27, // 爆炸消耗热量比例
            damageMult: 0.5,          // 爆炸伤害倍率 (基于基础火伤)
            radius: 120,              // 爆炸半径
            aoeDamageMult: 0.5        // AOE伤害倍率
        },
        // 雷属性 (连锁闪电)
        lightning: {
            baseChainChance: 0.15,    // 基础连锁概率
            tempChainMult: 0.0085,    // 温度对连锁概率的加成系数
            maxChainChance: 1.0,      // 最大连锁概率
            chainDelayBase: 250,      // 基础连锁延迟 (ms)
            chainDelayMin: 50,        // 最小连锁延迟 (ms)
            chainDelayDecay: 10,      // 每次连锁减少的延迟
            damageDecayBase: 0.45,    // 基础伤害衰减系数
            damageDecayPerLevel: 0.05 // 每级闪电增加的伤害保持系数
        },
        // 飞剑属性
        flying_sword: {
            resonanceDamageMult: 0.5, // 共鸣额外伤害倍率
            recallDamageMult: 0.5,    // 回收伤害倍率
            dashDamageMult: 0.6,      // 穿透伤害倍率
            sonSwordDelayBase: 20,    // 子剑生成基础延迟
            sonSwordDelayMin: 2       // 子剑生成最小延迟
        }
    },
    /** 游戏平衡性：敌人与数值 */
    balance: {
        normalPegSecondEnergChancey:0.42,
        // 敌人血量 = (baseHp + 当前回合数 * hpPerRound) * 指数因子 * 难度系数
        // [修改] 提高基础血量，降低线性斜率，依靠指数在后期发力
        enemyBaseHp: 10,       // 原 5 -> 稍微提高基础，防止第1回合太脆
        enemyHpPerRound: 8,    // 原 12 -> 降低线性斜率，依靠指数在 15 回合后发力
        // [新增] 指数膨胀系数，1.12 表示每回合血量额外膨胀 12%
        hpExponent: 1.12,
        
        // 特殊敌人血量倍率
        eliteHpMult: 7,     // 精英怪是普通怪的多少倍
        bossHpMult: 25,     // Boss是普通怪的多少倍
        
        // 敌人生成概率
        spawnProb: 0.42,     // 普通格子生成敌人的概率
        eliteChance: 0.05,   // (回合>2时) 尝试生成精英的概率
        bossChance: 0.2,    // (回合>5且触发精英时) 升级为Boss的概率
        advanceWaveMuti:2, // 
        // 词缀概率
        affixBaseChance: 0.05, // 基础词缀概率
        affixRoundGrowth: 0.05, // 每回合增加的词缀概率
        
        // 伤害系数
        cloneSpawnRate: 0.2, // "分身"词缀触发概率
        shieldDmgReduct: 0.5, // "护盾"词缀受到的伤害倍率 (0.8 = 减伤20%)
        unusedAmmoScoreMult: 1.5,   // 剩余每颗子弹让分数乘多少 (当前是 *2)
        nextRoundDifficultyMult: 5, // 触发此机制后，下一轮敌人血量乘多少
        cryoAmount:1,
        pyroAmount:0.5,
        lightningTempIncrease:1,
        relicRarityWright:{
            'common': 60,    // 普通: 权重 60 (约 60%)
            'rare': 30,      // 稀有: 权重 30 (约 30%)
            'legendary': 10, // 传说: 权重 10 (约 10%)
            'cursed': 5     // 诅咒: 权重 10
        },
        affixes: {
            shieldReduction: 0.5,   // 护盾减伤 50%
            hasteActions: 2,        // 极速行动次数
            regenPercent: 0.2,      // 再生回血百分比
            cloneChanceHit: 0.2,    // 受击分身概率
            cloneChanceTurn: 0.5,   // 回合开始分身概率
            berserkChanceMult: 0.5, // 狂暴概率系数 (Temp * 0.5)
            healerPercent: 0.12,     // 治疗百分比
            healerRange: 2,       // 治疗范围 (自身宽度的倍数)
            devourChance: 1,      // 吞噬触发概率
            devourRange: 2,       // 吞噬范围
            jumpRows: 2             // 跳跃距离 (行数)
        }
    },
    /** 游戏玩法配置 */
    gameplay: {
        deviceTiltBaseAngle: 60,
	        initWindPegs: 0,
	        initSwordPegs: 0,
	        baseDamage: 1,
	        laserLengthBonus: 0,    
        enemyShowTimeFrames:72,
        relicChoiceNum:4,
        enemyCols:6,
        cols: 10,           // 网格列数 
        rows: 6,           // 钉子行数
        spacingX: 35,      // 钉子水平间距
        spacingY: 32,      // 钉子垂直间距
        startRows: 4,       // 初始生成的敌人行数
        spawnMin: 3,        // 每波最少生成的敌人数量
        selectionCount: 6,  // 选卡阶段提供多少张卡
        selectionReq: 3,     // 需要选择多少张卡
        hitCooldowns: 17,    // 默认基础冷却时间
        pegCooldownAdd: 7,   // 每次触发增加的冷却帧数
        pegCooldownDecay: 2, // 每秒减少的冷却帧数
        relicChance: 0.1,
        initTriggerThreshold: 15,
        nextTriggerThresholdIncrease: 8,
        maxSkillPoints: 3,  // 技能点上限
        spSlotsStartRow:3,
        spSlotsEndRow:8,
        fireSpreadDamagePercent:0.25,
        fireSpreadTempIncrease:50,
        fireSpreadRadius:100,
        //  固定回合遗物事件 (每多少回合触发一次)
        relicRoundInterval: 3,
        assimilationChance: {
            bounce: 0.2,
            pierce: 0.12,
            scatter: 0.12,
            damage: 0.2,
            cryo: 0.2,  
            pyro: 0.2
        },
        // [新增] 特殊变体概率乘子
        specialMutationMult: 0.1, // 变异概率乘子 (基于同化概率)
        specialUpgradeMult: 0.42   // 升级概率乘子 (基于同化概率)
    },
    //  初始概率配置 (現在這些是基礎權重，解鎖後會增加)
    probabilities: { 
        white: 100,       // 基礎
        bounce: 20,       // 初始解鎖
        laser: 0,
        // 物理系 (初始鎖定，通過遺物解鎖)
        pierce: 7, 
        scatter: 7,
        damage: 12, // 保持概率权重不变
        
        // 元素系 (初始鎖定，通過遺物獨立解鎖)
        cryo: 5, 
        pyro: 5, 
        
        // 特殊系 (初始鎖定)
        explosive: 2, 
        rainbow: 0, 
        matryoshka: 0,
        resonance: 0,
    },
    /** 视觉表现配置 (新增) */
    visuals: {
        baseRadius: 7,          // 基础半径 (原来是11，改小一点更精致)
        
        // --- 尺寸动态影响 ---
        damageGrowth: 0.4,      // 每 1 点伤害增加多少半径像素
        maxSizeBonus: 5,        // 伤害导致的半径增加上限 (防止子弹无限变大)
        
        // --- 类型缩放倍率 ---
        copyScale: 0.6,         // 复制/散射子弹的缩放比例 (0.6 = 60%大小)
        explosiveScale: 1.15,   // 爆炸子弹的放大倍率
        arrowScale: 0.9,        // 穿透(箭头)形状的视觉修正 (箭头显大，稍微缩一点)
        
        // --- 特效强度 ---
        glowBase: 10,           // 基础光晕模糊度
        glowPerDamage: 1.5,     // 每点伤害增加的光晕
        maxGlow: 30             // 最大光晕限制
    }
};


// ==================== 遗物数据库 ====================

const RELIC_DB = [
    { 
    id: 'gigantism_relic', 
    name: '倍化之术', 
    icon: '🔮', 
    desc: '永久提升弹珠体积，更容易击中钉子与槽位。', 
    rarity: 'rare', 
    effect: 'permanent_size_up',
    maxStacks: 1
},
    { 
    id: 'fortune_wheel_relic', 
    name: '命運輪盤', 
    icon: '🎡', 
    desc: '收集階段：解鎖 [輪盤槽]。進入後轉動輪盤，使選中的已擁有屬性數量翻倍！', 
    rarity: 'legendary', 
    effect: 'unlock_slot', 
    slotType: 'wheel',
    maxStacks: 1
    },
    { 
        id: 'dimension_shard', 
        name: '維度碎片', 
        icon: '🌌', 
        desc: '收集階段：釘板高度延伸，額外增加 2 行釘子。', 
        rarity: 'rare', 
        effect: 'row_count_up' ,maxStacks: 1
    },
    { id: 'stars_shines', name: '群星闪烁', icon: '✨', desc: '解鎖 [回响弹珠]：双倍获得连击充能。', rarity: 'rare', unlocks: 'resonance', boost: 8 ,maxStacks: 1},
    { id: 'optical_lens', name: '聚焦透鏡', icon: '🔭', desc: '解鎖 [光球]：發射瞬間穿透的折射光束。', rarity: 'legendary', unlocks: 'laser', boost: 10 ,maxStacks: 1},
    //  1. 粉色钉子遗物
    { id: 'pink_slime', name: '粉紅凝膠', icon: '💗', desc: '收集階段：出現 3 個高彈性粉色釘子 (可疊加)。', rarity: 'common', effect: 'pink_peg_up' ,maxStacks: 1},

    //  2. 战斗底部反弹墙
    { id: 'energy_shield', name: '力場護盾', icon: '🛡️', desc: '戰鬥階段：底部邊界可消耗彈性/穿透次數來反彈子彈。', rarity: 'cursed', effect: 'combat_wall' ,maxStacks: 1},

    //  3. 特殊槽解锁 (三种槽位)
    { id: 'unlock_recall', name: '時光沙漏', icon: '⏳', desc: '收集階段：解鎖 [回溯槽] 的出現 (若無槽位則+1)。', rarity: 'rare', effect: 'unlock_slot', slotType: 'recall' ,maxStacks: 1},
    { id: 'unlock_multicast', name: '雙子魔鏡', icon: '♊', desc: '收集階段：解鎖 [連射槽] 的出現 (若無槽位則+1)。', rarity: 'rare', effect: 'unlock_slot', slotType: 'multicast' ,maxStacks: 1},
    { id: 'unlock_split', name: '裂變核心', icon: '☢️', desc: '收集階段：解鎖 [分裂槽] 的出現 (若無槽位則+1)。', rarity: 'rare', effect: 'unlock_slot', slotType: 'split' ,maxStacks: 1},

    //  4. 增加特殊槽数量
    { id: 'slot_expander', name: '空間鑿子', icon: '🔨', desc: '收集階段：特殊槽出現數量 +1。', rarity: 'common', effect: 'slot_count_up' ,maxStacks: 1},
    //  獨立元素遺物
    { id: 'cryo_stone', name: '永恆凍土', icon: '❄️', desc: '解鎖 [冰霜] 屬性 (彈珠與釘子)。', rarity: 'rare', unlocks: 'cryo', boost: 15 ,maxStacks: 1},
    { id: 'pyro_stone', name: '不滅火種', icon: '🔥', desc: '解鎖 [火焰] 屬性 (彈珠與釘子)。', rarity: 'rare', unlocks: 'pyro', boost: 15 ,maxStacks: 1},
    // { id: 'lightning_stone', name: '雷霆之怒', icon: '⚡', desc: '解鎖 [閃電] 屬性 (彈珠與釘子)。', rarity: 'rare', unlocks: 'lightning', boost: 15 },
    
    //  物理套裝遺物 (一次解鎖三種，或者你可以拆開)
    { id: 'tactical_kit', name: '穿透補給', icon: '↗', desc: '解鎖 [穿透] 屬性。', rarity: 'common', unlocks: ['pierce'], boost: 5 ,maxStacks: 1},
    { id: 'tactical_kit', name: '散射補給', icon: '🔱', desc: '解鎖 [散射] 屬性。', rarity: 'common', unlocks: ['scatter'], boost: 5 ,maxStacks: 1},
    { id: 'tactical_kit', name: '增幅補給', icon: '⚔️', desc: '解鎖 [增幅] 屬性。', rarity: 'common', unlocks: ['damage'], boost: 5 ,maxStacks: 1},

    { id: 'explosive_ammo', name: '高爆火藥', icon: '🧨', desc: '解鎖 [爆破彈珠] 出現，且獲得一顆。', rarity: 'rare', unlocks: 'explosive', boost: 10 ,maxStacks: 1},
    { id: 'prism_shard', name: '七彩稜鏡', icon: '🌈', desc: '解鎖 [彩虹彈珠] 出現，且獲得一顆。', rarity: 'legendary', unlocks: 'rainbow', boost: 5 ,maxStacks: 1},
    { id: 'russian_doll', name: '俄羅斯套娃', icon: '🪆', desc: '解鎖 [套娃彈珠]，子彈消失時會發射下一顆子彈。', rarity: 'legendary', unlocks: 'matryoshka', boost: 5 ,maxStacks: 1}
];

// ==================== 技能数据库 ====================

const SKILL_DB = [
    { 
        id: 'repulsion', 
        methodId: 'repulsion', // 逻辑ID
        name: '重力反轉', 
        icon: '🌬️', 
        cost: 2, 
        color: '#60a5fa',
        desc: '將所有敵人強制向上推回 2 行。',
        params: {
            pushRows: 2,
            visualShake: -20,
            particleColor: '#60a5fa',
            shockwaveColor: '#60a5fa'
        }
    },
    { 
        id: 'storm', 
        methodId: 'chain_lightning_all', // 逻辑ID：全屏闪电链
        name: '以太風暴', 
        icon: '⚡', 
        cost: 3, 
        color: '#c084fc',
        desc: '召喚雷擊命中所有敵人，並觸發連鎖閃電。',
        params: {
            baseDmg: 10,
            roundMult: 5,
            // 闪电相关参数
            boltColor: '#c084fc', // 闪电颜色
            flashColor: 'rgba(192, 132, 252, 0.2)',
            chainLevel: 15 // [新增] 技能自带的闪电等级 (15级 = 每次弹跳伤害+20%)
        }
    },
    { 
        id: 'enhance_normal', // 技能ID：普通强化
        methodId: 'enhance_ammo', // 逻辑ID：强化逻辑
        name: '賢者充能', 
        icon: '💎', 
        cost: 2, 
        color: '#facc15',
        desc: '下一發子彈強化：散射、連射與全屬性提升。',
        params: {
            buffs: {
                damage: 5,
                bounce: 3,
                pierce: 2,
                multicast: 1,
                scatter: 4 
            },
            forceExplosive: true,
            forceLaser: false, // [新增] 是否开启光属性
            explosionColor: '#facc15',
            floatText: "ENHANCED!"
        }
    },
    { 
        id: 'enhance_laser', 
        methodId: 'enhance_ammo', 
        name: '光之充能', 
        icon: '🔦', 
        cost: 1, 
        color: '#0ea5e9', 
        desc: '下一發子彈轉化為高能激光。',
        params: {
            buffs: { 
                damage: 5,
                pierce: 8,
                multicast: 2,
                laser: 5
             }, // 加激光层数
            forceLaser: true, // [新增] 强制开启激光
            forceExplosive: false,
            explosionColor: '#0ea5e9',
            floatText: "LASER READY!"
        }
    }
];


// ==================== 导出配置 ====================
// 注意：TRUTH_BOOK_DATA 已移动到 systems.js，因为它需要使用 Enemy 类

export {
    META_SHOP_CONFIG,
    ATTRIBUTES_FOR_SHOP,
    setDeepValue,
    CONFIG,
    RELIC_DB,
    SKILL_DB,
};
