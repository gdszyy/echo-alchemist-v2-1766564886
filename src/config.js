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
    resources: {
        energy_essence: { id: 'energy_essence', name: '能量精粹', icon: '✨', color: '#fbbf24' }
    },
    upgrades: [
        {
            id: 'init_weight_bounce',
            category: 'attribute',
            name: '彈性增幅',
            desc: '增加初始彈珠中 [反彈] 屬性的權重。',
            icon: '🔄',
            maxLevel: 10,
            cost: { resourceId: 'energy_essence', base: 50, growth: 1.4, type: 'exponential' },
            effect: { path: 'probabilities.bounce', valuePerLevel: 10, type: 'add' }
        },
        {
            id: 'init_weight_pierce',
            category: 'attribute',
            name: '穿透解鎖',
            desc: '解鎖並增加初始 [穿透] 屬性的權重。',
            icon: '↗️',
            maxLevel: 10,
            cost: { resourceId: 'energy_essence', base: 100, growth: 1.5, type: 'exponential' },
            effect: { path: 'probabilities.pierce', valuePerLevel: 8, type: 'add' }
        },
        {
            id: 'assimilation_boost',
            category: 'attribute',
            name: '同化共鳴',
            desc: '提升所有屬性的基礎同化概率。',
            icon: '🧪',
            maxLevel: 5,
            cost: { resourceId: 'energy_essence', base: 200, growth: 2.0, type: 'exponential' },
            effect: { path: 'gameplay.assimilationChance', valuePerLevel: 0.02, type: 'add_all' }
        },
        {
            id: 'defense_line',
            category: 'defense',
            name: '防線加固',
            desc: '減少初始生成的敵人行數。',
            icon: '🛡️',
            maxLevel: 2,
            cost: { resourceId: 'energy_essence', values: [500, 2000], type: 'fixed' },
            effect: { path: 'gameplay.startRows', valuePerLevel: -1, type: 'add' }
        },
        {
            id: 'relic_choice',
            category: 'resource',
            name: '博學多才',
            desc: '增加遺物選擇時的可選數量。',
            icon: '📚',
            maxLevel: 2,
            cost: { resourceId: 'energy_essence', base: 1000, growth: 3000, type: 'linear' },
            effect: { path: 'gameplay.relicChoiceNum', valuePerLevel: 1, type: 'add' }
        }
    ,
        // (需求3) 初始解锁风属性钉子 - 改为临时增强
        {
            id: 'init_wind_peg',
            category: 'temporary',
            name: '风暴之眼',
            desc: '下一次游戏：收集阶段初始将 1 个普通钉子替换为 [风] 属性钉子。(每局可购买一次)',
            icon: '🌪️',
            maxLevel: 1,
            cost: { resourceId: 'energy_essence', base: 200, growth: 1.0, type: 'exponential' },
            effect: { path: 'gameplay.initWindPegs', valuePerLevel: 1, type: 'add' },
            temporary: true
        },
        // (需求4) 初始解锁子母剑钉子 - 改为临时增强
        {
            id: 'init_sword_peg',
            category: 'temporary',
            name: '剑冢',
            desc: '下一次游戏：收集阶段初始将 1 个普通钉子替换为 [飞剑] 属性钉子。(每局可购买一次)',
            icon: '🗡️',
            maxLevel: 1,
            cost: { resourceId: 'energy_essence', base: 300, growth: 1.0, type: 'exponential' },
            effect: { path: 'gameplay.initSwordPegs', valuePerLevel: 1, type: 'add' },
            temporary: true
        },
        // (需求6) 子弹初始伤害
        {
            id: 'base_damage_up',
            category: 'attribute',
            name: '火药改良',
            desc: '所有子弹的初始基础伤害提升。',
            icon: '💥',
            maxLevel: 5,
            cost: { resourceId: 'energy_essence', base: 500, growth: 1.5, type: 'exponential' },
            effect: { path: 'gameplay.baseDamage', valuePerLevel: 1, type: 'add' }
        },
        // (需求7) 冰火温度值升级
        {
            id: 'pyro_efficiency',
            category: 'attribute',
            name: '纯净燃油',
            desc: '提升 [火焰] 属性单层提供的热量值。',
            icon: '🔥',
            maxLevel: 5,
            cost: { resourceId: 'energy_essence', base: 150, growth: 1.5, type: 'exponential' },
            effect: { path: 'balance.pyroAmount', valuePerLevel: 0.2, type: 'add' }
        },
        {
            id: 'cryo_efficiency',
            category: 'attribute',
            name: '极寒晶核',
            desc: '提升 [冰霜] 属性单层提供的冷冻值。',
            icon: '❄️',
            maxLevel: 5,
            cost: { resourceId: 'energy_essence', base: 150, growth: 1.5, type: 'exponential' },
            effect: { path: 'balance.cryoAmount', valuePerLevel: 0.2, type: 'add' }
        },
        // (需求8) 激光长度升级
        {
            id: 'laser_focus',
            category: 'attribute',
            name: '聚焦透镜',
            desc: '提升 [激光] 属性的初始射程/穿透深度。',
            icon: '🔦',
            maxLevel: 5,
            cost: { resourceId: 'energy_essence', base: 200, growth: 1.5, type: 'exponential' },
            effect: { path: 'gameplay.laserLengthBonus', valuePerLevel: 50, type: 'add' }
        },
        // (需求9) 连击需求降低
        {
            id: 'combo_mastery',
            category: 'resource',
            name: '节奏大师',
            desc: '降低连击充能条的初始触发需求值。',
            icon: '🔋',
            maxLevel: 3,
            cost: { resourceId: 'energy_essence', base: 1000, growth: 2.0, type: 'exponential' },
            effect: { path: 'gameplay.initTriggerThreshold', valuePerLevel: -1, type: 'add' }
        },
        // (新增) SP上限提升
        {
            id: 'sp_capacity',
            category: 'resource',
            name: '能量容器',
            desc: '提升技能点(SP)的最大存储上限。',
            icon: '⚡',
            maxLevel: 5,
            cost: { resourceId: 'energy_essence', base: 800, growth: 2.0, type: 'exponential' },
            effect: { path: 'gameplay.maxSkillPoints', valuePerLevel: 1, type: 'add' }
        }],
    categories: {
        attribute: { name: '屬性煉金', icon: '🧪' },
        defense: { name: '陣地防御', icon: '🏰' },
        resource: { name: '資源調度', icon: '📦' },
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

// 动态生成属性亲和升级
ATTRIBUTES_FOR_SHOP.forEach(attr => {
    META_SHOP_CONFIG.upgrades.push({
        id: `prob_${attr.id}`,
        category: 'attribute',
        name: `${attr.name}亲和`,
        desc: `增加收集阶段 [${attr.name}] 属性出现的概率权重。`,
        icon: attr.icon,
        maxLevel: 5,
        cost: { resourceId: 'energy_essence', base: 100, growth: 1.3, type: 'exponential' },
        effect: { path: `probabilities.${attr.id}`, valuePerLevel: 5, type: 'add' }
    });
});

// ==================== 工具函数 ====================

/**
 * 深度设置对象值
 */
function setDeepValue(obj, path, value, type) {
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
}


// ==================== 游戏核心配置 ====================

const CONFIG = {
    /** 颜色配置 (保持不变) */
    ui: {
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
    /** 游戏平衡性：敌人与数值 */
    balance: {
        normalPegSecondEnergChancey:0.42,
        // 敌人血量 = baseHp + (当前回合数 * hpPerRound)
        enemyBaseHp: 5,
        enemyHpPerRound: 6,
        
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
        pyroAmount:1,
        lightningTempIncrease:3,
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
        hitCooldowns: 12,    // 默认基础冷却时间
        pegCooldownAdd: 5,   // 每次触发增加的冷却帧数
        pegCooldownDecay: 2, // 每秒减少的冷却帧数
        relicChance: 0.1,
        initTriggerThreshold: 7,
        nextTriggerThresholdIncrease: 8,
        maxSkillPoints: 5,  // 技能点上限
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
    { id: 'energy_shield', name: '力場護盾', icon: '🛡️', desc: '戰鬥階段：底部邊界可消耗彈性/穿透次數來反彈子彈。', rarity: 'rare', effect: 'combat_wall' ,maxStacks: 1},

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


// ==================== 真理之书数据 ====================

const TRUTH_BOOK_DATA = {
    enemies: [
        {
            id: 'normal',
            name: '普通魔像',
            icon: '🤖',
            tags: ['基礎', '測試對象'],
            desc: '標準的煉金生物。沒有特殊能力，是測試傷害的理想對象。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 200, 200));
            },
            loop: [
                { type: 'log', text: '生成測試彈幕...' },
                { type: 'spawn_projectile', config: { damage: 20, bounce: 2 } },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'shield',
            name: '護盾魔像',
            icon: '🛡️',
            tags: ['減傷', '激光反射'],
            desc: '擁有能量護盾，減少 50% 受到的傷害。護盾表面光滑，可以反射激光束。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['shield']));
            },
            loop: [
                { type: 'log', text: '護盾減傷測試' },
                { type: 'spawn_projectile', config: { damage: 20 } },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '激光反射測試' },
                { type: 'spawn_projectile', config: { damage: 10, isLaser: true, laser: 5 } },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'regen',
            name: '再生魔像',
            icon: '💚',
            tags: ['回血', '持久戰'],
            desc: '體內植入了生命水晶，每回合行動時會恢復最大生命值的 20%。',
            setup: (game) => {
                const e = new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['regen']);
                e.hp = 100; 
                game.enemies.push(e);
            },
            loop: [
                { type: 'log', text: '魔像受傷狀態...' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '觸發回合行動：再生' },
                { type: 'enemy_turn' },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'clone',
            name: '分身魔像',
            icon: '🦠',
            tags: ['受擊分裂', '人海戰術'],
            desc: '受到攻擊或每回合開始時，有概率分裂出較弱的複制體，迅速填滿戰場。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 300, 300, 'normal', ['clone']));
            },
            loop: [
                { type: 'log', text: '攻擊觸發分裂' },
                { type: 'spawn_projectile', config: { damage: 10 } },
                { type: 'wait', frames: 30 },
                { type: 'spawn_projectile', config: { damage: 10 } },
                { type: 'wait', frames: 150 },
                { type: 'reset' }
            ]
        },
        {
            id: 'haste',
            name: '極速魔像',
            icon: '⚡',
            tags: ['高速', '兩次行動'],
            desc: '神經反射極快，每回合可以進行兩次移動或攻擊。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['haste']));
            },
            loop: [
                { type: 'log', text: '極速行動 (2x)' },
                { type: 'enemy_turn' }, 
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'berserk',
            name: '狂暴魔像',
            icon: '😡',
            tags: ['熱能轉化', '升溫強化'],
            desc: '當前溫度：150°C (過熱)。當處於「過熱」狀態時，有高概率觸發狂暴，獲得額外行動機會。',
            setup: (game) => {
                const e = new Enemy(game.width/2, 150, 60, 60, 300, 300, 'normal', ['berserk']);
                e.temp = 150; 
                game.enemies.push(e);
            },
            loop: [
                { type: 'log', text: '當前溫度：150°C (過熱)' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '觸發狂暴判定...' },
                { type: 'enemy_turn' },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'healer',
            name: '治癒魔像',
            icon: '💖',
            tags: ['群體治療', '輔助'],
            desc: '戰場上的醫療兵。回合行動時會治療周圍的友軍單位。',
            setup: (game) => {
                const e1 = new Enemy(game.width/2 - 70, 150, 60, 60, 100, 200); 
                const healer = new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['healer']);
                const e2 = new Enemy(game.width/2 + 70, 150, 60, 60, 100, 200); 
                game.enemies.push(e1, healer, e2);
            },
            loop: [
                { type: 'log', text: '隊友生命危急...' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '施放群體治癒' },
                { type: 'enemy_turn', targetIdx: 1 }, 
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'devour',
            name: '貪食魔像',
            icon: '👅',
            tags: ['吞噬友軍', '成長'],
            desc: '殘忍的同類相食者。會吞噬相鄰的友軍以恢復自身生命並繼承其詞條。',
            setup: (game) => {
                const food = new Enemy(game.width/2 - 60, 150, 50, 50, 100, 100, 'normal', ['haste']); 
                const eater = new Enemy(game.width/2, 150, 70, 70, 200, 500, 'normal', ['devour']);
                game.enemies.push(food, eater);
            },
            loop: [
                { type: 'log', text: '發現獵物 (極速魔像)' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '吞噬！(繼承血量與詞條)' },
                { type: 'enemy_turn', targetIdx: 1 },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'jump',
            name: '跳躍魔像',
            icon: '🦘',
            tags: ['越過障礙', '突進'],
            desc: '腿部裝有彈簧裝置。當前方被阻擋時，可以直接跳過障礙物繼續前進。',
            setup: (game) => {
                const blocker = new Enemy(game.width/2, 210, 60, 60, 100, 100); 
                const jumper = new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['jump']);
                game.enemies.push(blocker, jumper);
            },
            loop: [
                { type: 'log', text: '前方道路被阻擋' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '發動跳躍！' },
                { type: 'enemy_turn', targetIdx: 1 },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        }
    ],
    attributes: [
        {
            id: 'bounce', name: '彈性', icon: '⤴️', tags: ['物理', '連擊'],
            desc: '增加彈珠在敵人之間彈射的次數，適合在密集怪群中製造混亂。',
            setup: (game) => {
                // 佈置一個三角形陣列，展示多次彈射
                game.enemies.push(
                    new Enemy(game.width/2 - 60, 220, 50, 50, 500),
                    new Enemy(game.width/2 + 60, 220, 50, 50, 500),
                    new Enemy(game.width/2, 140, 50, 50, 500),
                    new Enemy(game.width/2 - 100, 100, 40, 40, 300),
                    new Enemy(game.width/2 + 100, 100, 40, 40, 300)
                );
            },
            loop: [
                { type: 'log', text: '發射高彈性彈珠' },
                { type: 'spawn_projectile', config: { damage: 15, bounce: 8 }, vel: {x: 2, y: -18} },
                { type: 'wait', frames: 240 }, { type: 'reset' }
            ]
        },
        {
            id: 'pierce', name: '穿透', icon: '↗️', tags: ['物理', '貫穿'],
            desc: '使彈珠能夠穿透敵人的身體，直接打擊後排目標。',
            setup: (game) => {
                // 佈置一條直線上的敵人，展示一箭穿心
                for(let i=0; i<5; i++) {
                    game.enemies.push(new Enemy(game.width/2, 250 - i*50, 50, 40, 200));
                }
            },
            loop: [
                { type: 'log', text: '發射強力穿透彈' },
                { type: 'spawn_projectile', config: { damage: 20, pierce: 5 }, vel: {x: 0, y: -20} },
                { type: 'wait', frames: 120 }, { type: 'reset' }
            ]
        },
        {
            id: 'scatter', name: '散射', icon: '🔱', tags: ['物理', '分裂'],
            desc: '彈珠飛行時會向兩側分裂出小型子彈，擴大打擊覆蓋面。',
            setup: (game) => {
                // 佈置一個大目標和周圍的小目標，展示分裂彈的覆蓋力
                game.enemies.push(new Enemy(game.width/2, 120, 80, 80, 1000));
                for(let i=0; i<6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    game.enemies.push(new Enemy(
                        game.width/2 + Math.cos(angle) * 120,
                        120 + Math.sin(angle) * 120,
                        30, 30, 100
                    ));
                }
            },
            loop: [
                { type: 'log', text: '發射分裂散射彈' },
                { type: 'spawn_projectile', config: { damage: 12, scatter: 8 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 180 }, { type: 'reset' }
            ]
        },
        {
            id: 'cryo', name: '冰霜', icon: '❄️', tags: ['元素', '控制'],
            desc: '降低敵人溫度。溫度 < 0°C 時觸發【易傷】，每降低 1°C 增加 0.5% 受到的傷害。達到 -100°C 時觸發【凍結】，敵人將無法行動。',
            setup: (game) => { 
                const e = new Enemy(game.width/2, 180, 90, 90, 2000);
                e.temp = -100; // 預設凍結
                game.enemies.push(e); 
            },
            loop: [
                { type: 'log', text: '目標已處於【凍結】狀態' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '觸發【易傷】(傷害大幅提升)' },
                { type: 'spawn_projectile', config: { damage: 100, cryo: 0 }, vel: {x: 0, y: -15} }, 
                { type: 'wait', frames: 120 }, { type: 'reset' }
            ]
        },
        {
            id: 'pyro', name: '火焰', icon: '🔥', tags: ['元素', '範圍爆炸'],
            desc: '升高敵人溫度。溫度 >= 34°C 時觸发【燃燒】造成持續傷害（公式：温度/150）。溫度 > 200°C 時有概率觸发【過熱爆炸】，造成大範圍 AOE 傷害並消耗 10% 熱量。觸发概率隨溫度提升，600°C 時必爆。',
            setup: (game) => { 
                const boss = new Enemy(game.width/2, 180, 80, 80, 1500);
                game.enemies.push(boss); 
                for(let i=0; i<8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    game.enemies.push(new Enemy(
                        game.width/2 + Math.cos(angle) * 90,
                        180 + Math.sin(angle) * 90,
                        40, 40, 300
                    ));
                }
            },
            loop: [
                { type: 'log', text: '第一步：施加火屬性使其【燃燒】' },
                { type: 'spawn_projectile', config: { damage: 10, pyro: 600 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 100 },
                { type: 'log', text: '第二步：擊殺燃燒中的敵人觸發爆炸' },
                { type: 'spawn_projectile', config: { damage: 2000 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 150 }, { type: 'reset' }
            ]
        },
        {
            id: 'lightning', name: '閃電', icon: '⚡', tags: ['元素', '連鎖'],
            desc: '命中時觸發連鎖閃電，提升等同於本次傷害的溫度。閃電鏈可對重複敵人造成傷害，隨機在範圍內索敵且距離越近概率越高。基礎連鎖概率 15%，目標溫度越低概率越高（最高 100%）。',
            setup: (game) => {
                // 佈置密集的敵群，展示 100 次連鎖的壯觀效果
                for(let i=0; i<12; i++) {
                    const x = game.width/2 + (Math.random()-0.5) * 200;
                    const y = 150 + (Math.random()-0.5) * 150;
                    const e = new Enemy(x, y, 40, 40, 500);
                    e.temp = -100; // [修復] 讓所有敵人都冰凍，確保瘋狂連鎖
                    game.enemies.push(e);
                }
            },
            loop: [
                { type: 'log', text: '打擊凍結目標 (啟動無限連鎖)' },
                { type: 'spawn_projectile', config: { damage: 15, lightning: 10 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 300 }, { type: 'reset' }
            ]
        },
        {
            id: 'laser', name: '光球', icon: '🔦', tags: ['特殊', '瞬時'],
            desc: '發射彈珠，命中時觸發折射激光，瞬間對路徑上的敵人造成傷害。',
            setup: (game) => {
                for(let i=0; i<6; i++) {
                    game.enemies.push(new Enemy(
                        game.width/2 + (i%2 === 0 ? -80 : 80),
                        250 - i*40,
                        50, 50, 300
                    ));
                }
            },
            loop: [
                { type: 'log', text: '發射光學折射彈 (laser=true)' },
                { type: 'spawn_projectile', config: { damage: 40, laser: 10 }, vel: {x: 2, y: -15} },
                { type: 'wait', frames: 150 }, { type: 'reset' }
            ]
        },
        {
            id: 'wind', name: '風', icon: '🌪️', tags: ['特殊', '法陣'],
            desc: '在命中點生成風暴法陣，持續發射風刃攻擊附近的敵人。',
            setup: (game) => { game.enemies.push(new Enemy(game.width/2, 200, 80, 80, 1000)); },
            loop: [
                { type: 'spawn_projectile', config: { damage: 5, wind: 1, bounce: 4 }, vel: {x: 5, y: -15} },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '風暴法陣持續攻擊...' },
                { type: 'wait', frames: 180 }, { type: 'reset' }
            ]
        },
        {
            id: 'explosive', name: '爆破', icon: '🧨', tags: ['特殊', 'AOE'],
            desc: '接觸敵人時引發劇烈爆炸，造成大範圍傷害。',
            setup: (game) => {
                for(let i=0; i<5; i++) game.enemies.push(new Enemy(game.width/2 - 100 + i*50, 200, 40, 40, 100));
            },
            loop: [
                { type: 'spawn_projectile', config: { damage: 30, explosive: true }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 120 }, { type: 'reset' }
            ]
        },
        {
            id: 'matryoshka', name: '套娃', icon: '🪆', tags: ['特殊', '連鎖'],
            desc: '子彈消失時會分裂出下一顆子彈。演示：散射子彈分裂出散射火屬性子彈。',
            setup: (game) => { 
                game.enemies.push(new Enemy(game.width/2, 120, 80, 80, 1500)); 
                for(let i=0; i<4; i++) {
                    game.enemies.push(new Enemy(game.width/2 + (i-1.5)*80, 220, 40, 40, 300));
                }
            },
            loop: [
                { type: 'log', text: '發射套娃彈 (散射->火散射)' },
                { type: 'spawn_projectile', config: { 
                    damage: 10, 
                    scatter: 3,
                    nestedPayload: { damage: 10, scatter: 5, pyro: 100 }
                }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 240 }, { type: 'reset' }
            ]
        }
    ]
};

class TruthBook {
    constructor(mainGame) {
        this.mainGame = mainGame;
        this.canvas = document.getElementById('truth-demo-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.active = false;
        this.currentEntry = null;
        this.demoGame = null;
        
        // 演示控制
        this.instructionIdx = 0;
        this.waitTimer = 0;
        this.simFrame = 0;
        
        // 視覺特效
        this.scanLineY = 0;
        this.gridOffset = 0;

        this.initUI();
        window.addEventListener('resize', () => { if (this.active) this.resize(); });
    }

    initUI() {
        const enemyList = document.getElementById('truth-enemy-list');
        const attrList = document.getElementById('truth-attr-list');
        if(enemyList) enemyList.innerHTML = '';
        if(attrList) attrList.innerHTML = '';

        if (typeof TRUTH_BOOK_DATA !== 'undefined') {
            TRUTH_BOOK_DATA.enemies.forEach(entry => {
                enemyList.appendChild(this.createListButton(entry));
            });
            TRUTH_BOOK_DATA.attributes.forEach(entry => {
                attrList.appendChild(this.createListButton(entry));
            });
        }
    }

    createListButton(entry) {
        const btn = document.createElement('button');
        btn.className = 'truth-list-btn flex items-center gap-3 p-3 w-full bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all text-left group mb-2';
        btn.innerHTML = `
            <span class="text-2xl group-hover:scale-110 transition-transform filter drop-shadow-md">${entry.icon}</span>
            <div class="flex flex-col">
                <span class="text-sm font-bold text-slate-300 group-hover:text-cyan-100 transition-colors">${entry.name}</span>
                <span class="text-[9px] text-slate-500 uppercase tracking-wider group-hover:text-cyan-400/70">${entry.tags[0] || 'ENTITY'}</span>
            </div>
        `;
        btn.onclick = () => this.showEntry(entry, btn);
        return btn;
    }

    showEntry(entry, btnElement) {
        this.currentEntry = entry;
        document.getElementById('truth-empty-state').classList.add('hidden');
        document.getElementById('truth-content').classList.remove('hidden');
        document.getElementById('truth-item-icon').innerText = entry.icon;
        document.getElementById('truth-item-name').innerText = entry.name;
        document.getElementById('truth-item-desc').innerText = entry.desc;
        
        const tagsCont = document.getElementById('truth-item-tags');
        tagsCont.innerHTML = '';
        entry.tags.forEach(tag => {
            const s = document.createElement('span');
            s.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm tracking-wide';
            s.innerText = tag.toUpperCase();
            tagsCont.appendChild(s);
        });

        document.querySelectorAll('.truth-list-btn').forEach(b => {
            b.classList.remove('border-cyan-500', 'bg-cyan-900/30');
            b.classList.add('border-slate-700/50', 'bg-slate-800/40');
        });
        if (btnElement) {
            btnElement.classList.remove('border-slate-700/50', 'bg-slate-800/40');
            btnElement.classList.add('border-cyan-500', 'bg-cyan-900/30');
        }

        this.startDemo(entry);
    }

    resetDemo() { if (this.currentEntry) this.startDemo(this.currentEntry); }

    startDemo(entry) {
        // --- 核心修復：構建全功能 Mock Game ---
        this.demoGame = {
            width: 600, height: 800,
            enemies: [], projectiles: [], particles: [], floatingTexts: [], 
            shockwaves: [], spores: [], fireWaves: [], sonSwords: [], 
            sonSwordQueue: [], swordQis: [], lightningBolts: [],
            activeWindMatrices: [], windAnchors: [],
            enemyHeight: 60, enemyWidth: 60, timeScale: 1.0,
            hasCombatWall: true, isDemo: true,
            roundDamage: 0, currentShotDamage: 0, currentShotDamageByAttr: {},
            shotDamageMap: new Map(),
            
            // 粒子與特效
            spawn_createParticle: (x, y, color, mode) => {
                // 確保粒子生成在模擬器區域內
                const p = new Particle(x, y, color, mode);
                this.demoGame.particles.push(p);
                return p;
            },
            spawn_createShockwave: (x, y, color) => {
                const sw = new Shockwave(x, y, color);
                this.demoGame.shockwaves.push(sw);
            },
            spawn_createFloatingText: (x, y, text, color) => {
                this.demoGame.floatingTexts.push(new FloatingText(x, y, text, color));
            },
            spawn_createExplosion: (x, y, color) => {
                this.demoGame.spawn_createShockwave(x, y, color);
                for(let i=0; i<10; i++) this.demoGame.spawn_createParticle(x, y, color, 'spark');
            },
            
            // 子彈生成
            spawn_spawnBullet: (arg1, arg2, arg3, arg4, arg5, arg6) => {
                let x, y, vel, config, id, isLast;
                if (typeof arg1 === 'object' && arg1.config) {
                    x = arg1.x; y = arg1.y; vel = arg1.vel; config = arg1.config;
                    id = arg1.id || null; isLast = arg1.isLast || false;
                } else {
                    x = arg1; y = arg2; vel = arg3; config = arg4; id = arg5; isLast = arg6;
                }
                
                // [修復] 確保 vel 是 Vec2 實例，防止 .len() 等方法報錯
                if (!(vel instanceof Vec2)) {
                    vel = new Vec2(vel.x, vel.y);
                }
                
                // [修復] 處理散射邏輯：如果 config 中有 scatter，則生成多個子彈
                if (config.scatter && !config._isScatterSub) {
                    const count = config.scatter;
                    const baseAngle = Math.atan2(vel.y, vel.x);
                    const spread = Math.PI / 4;
                    const speed = vel.len();
                    for (let i = 0; i < count; i++) {
                        const angle = baseAngle + (i - (count - 1) / 2) * (spread / count);
                        const newVel = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
                        const newConfig = { ...config, scatter: 0, _isScatterSub: true };
                        const p = new Projectile(x, y, newVel, newConfig, false, id, i === count - 1);
                        p.game = this.demoGame;
                        this.demoGame.projectiles.push(p);
                    }
                    return;
                }

                const p = new Projectile(x, y, vel, config, false, id, isLast);
                p.game = this.demoGame; 
                this.demoGame.projectiles.push(p);
            },
            
            // [核心重構] 傷害與戰鬥：直接調用主遊戲的戰鬥邏輯
            combat_damageEnemy: (enemy, proj, multiplier = 1.0) => {
                // 將當前上下文切換為 demoGame 並調用主遊戲的戰鬥方法
                this.mainGame.combat_damageEnemy.call(this.demoGame, enemy, proj, multiplier);
            },
            
            // 補充主遊戲邏輯依賴的其他方法
            combat_lightning_triggerChain: (enemy, dmg, history, level) => {
                this.mainGame.combat_lightning_triggerChain.call(this.demoGame, enemy, dmg, history, level);
            },
            
            combat_wind_addAnchor: (x, y, dmg, config) => {
                this.mainGame.combat_wind_addAnchor.call(this.demoGame, x, y, dmg, config);
            },
            
            combat_recordDamage: (amount, attrType = 'damage') => {
                this.demoGame.roundDamage += amount;
                if (!this.demoGame.currentShotDamageByAttr[attrType]) this.demoGame.currentShotDamageByAttr[attrType] = 0;
                this.demoGame.currentShotDamageByAttr[attrType] += amount;
            },
            
            combat_lightning_triggerChain: (currentEnemy, dmg, history, level) => {
                if (level <= 0) return;
                const range = 150; // 縮小閃電跳躍範圍，要求敵人靠得近
                let closest = null;
                let minDist = Infinity;
                this.demoGame.enemies.forEach(e => {
                    if (e !== currentEnemy && e.active && !history.includes(e)) {
                        const d = currentEnemy.pos.dist(e.pos);
                        if (d < range && d < minDist) { minDist = d; closest = e; }
                    }
                });
                if (closest) {
                    this.demoGame.lightningBolts.push(new LightningBolt(currentEnemy.pos, closest.pos));
                    const nextDmg = Math.floor(dmg * 0.8);
                    closest.takeDamage(nextDmg);
                    this.demoGame.spawn_createFloatingText(closest.pos.x, closest.pos.y, `-${nextDmg}`, '#c084fc');
                    history.push(closest);
                    // 遞歸跳躍
                    setTimeout(() => {
                        this.demoGame.combat_lightning_triggerChain(closest, nextDmg, history, level - 1);
                    }, 60);
                }
            },
            
            combat_wind_addAnchor: (x, y, bulletDamage, bulletConfig) => {
                this.demoGame.windAnchors.push({ x, y, life: 1.0, bulletDamage, bulletConfig });
                this.demoGame.spawn_createParticle(x, y, '#34d399', 'spark');
                if (this.demoGame.windAnchors.length >= 4) {
                    this.demoGame.spawn_createShockwave(x, y, '#34d399');
                    this.demoGame.windAnchors = []; // 簡化：滿4個直接重置
                }
            },

            spawn_triggerCloneSpawn: (parent) => {
                const cloneHp = Math.floor(parent.maxHp * 0.2);
                const clone = new Enemy(parent.pos.x + 60, parent.pos.y, 50, 50, cloneHp, cloneHp);
                clone.affixes = [];
                this.demoGame.enemies.push(clone);
                this.demoGame.spawn_createFloatingText(parent.pos.x, parent.pos.y, "CLONE!", "#a855f7");
            },

            spawn_addScore: (amt) => {},
            ui_updateRoundDamage: () => {},
            calc_isAreaOccupied: (x, y, w, h, exclude) => {
                return this.demoGame.enemies.some(e => e !== exclude && e.active && 
                    Math.abs(e.pos.x - x) < (e.width + w)/2 && 
                    Math.abs(e.pos.y - y) < (e.height + h)/2);
            }
        };

        if (entry.setup) entry.setup(this.demoGame);
        this.instructionIdx = 0;
        this.waitTimer = 0;
        this.simFrame = 0;
        this.scanLineY = 0;
        document.getElementById('truth-demo-log').innerHTML = '';
        this.active = true;
        this.resize();
        this.addLog("SIMULATION_INIT... OK", "text-green-400");
    }

    resize() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (parent) {
            const rect = parent.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.ctx.scale(dpr, dpr);
            this.viewWidth = rect.width;
            this.viewHeight = rect.height;
        }
    }

    update() {
        if (!this.active || !this.demoGame) return;
        const _realGame = window.game;
        window.game = this.demoGame;
        try {
            this.simFrame++;
            const timeDisplay = document.getElementById('truth-sim-time');
            if (timeDisplay && this.simFrame % 5 === 0) {
                timeDisplay.innerText = `T: ${this.simFrame.toString().padStart(4, '0')}`;
            }
            if (this.waitTimer > 0) {
                this.waitTimer--;
            } else {
                const loop = this.currentEntry.loop;
                if (loop && loop.length > 0) {
                    const inst = loop[this.instructionIdx];
                    this.executeInstruction(inst);
                    this.instructionIdx = (this.instructionIdx + 1) % loop.length;
                }
            }
            const ts = 1.0;
            this.demoGame.enemies.forEach(e => e.update(ts, this.demoGame));
            this.demoGame.projectiles.forEach(p => {
                // [修復] 模擬器牆壁反彈邏輯：完全同步主遊戲
                const margin = 20;
                if (p.pos.x < margin || p.pos.x > this.demoGame.width - margin) {
                    p.vel.x *= -1;
                    p.pos.x = p.pos.x < margin ? margin : this.demoGame.width - margin;
                    if (p.config.bounce) p.config.bounce--;
                }
                if (p.pos.y < margin) {
                    p.vel.y *= -1;
                    p.pos.y = margin;
                    if (p.config.bounce) p.config.bounce--;
                }
                
                // [核心修復] 確保子彈更新時使用的是 demoGame 的上下文
                p.update(this.demoGame.width, this.demoGame.height, this.demoGame.enemies, this.demoGame.spawn_spawnBullet.bind(this.demoGame), ts);
            });
            this.demoGame.particles.forEach(p => p.update(ts));
            this.demoGame.floatingTexts.forEach(f => {
                f.update(ts);
                if (f instanceof FloatingText && f.life <= 0) f.active = false;
                else if (f.life !== undefined) { f.pos.y -= 0.5; f.life--; }
            });
            this.demoGame.shockwaves.forEach(s => s.update(ts));
            this.demoGame.lightningBolts.forEach(l => l.update(ts));
            this.demoGame.projectiles = this.demoGame.projectiles.filter(p => p.active);
            this.demoGame.particles = this.demoGame.particles.filter(p => p.active);
            this.demoGame.floatingTexts = this.demoGame.floatingTexts.filter(f => f.life > 0);
            this.demoGame.shockwaves = this.demoGame.shockwaves.filter(s => s.alpha > 0);
            this.demoGame.lightningBolts = this.demoGame.lightningBolts.filter(l => l.life > 0);
            this.draw();
        } finally {
            window.game = _realGame;
        }
    }

    executeInstruction(inst) {
        if (!inst) return;
        switch(inst.type) {
            case 'log': this.addLog(inst.text); break;
            case 'wait': this.waitTimer = inst.frames; break;
            case 'enemy_turn': 
                const actor = this.demoGame.enemies[inst.targetIdx || 0];
                if (actor) this.mainGame.phase_enemy_processTurn.call(this.demoGame, actor);
                break;
            case 'spawn_projectile':
                const px = inst.x || this.demoGame.width / 2;
                const py = inst.y || this.demoGame.height - 150;
                const angle = -Math.PI/2 + (Math.random()-0.5) * 0.1;
                const pvel = inst.vel ? new Vec2(inst.vel.x, inst.vel.y) : new Vec2(Math.cos(angle)*15, Math.sin(angle)*15);
                this.demoGame.spawn_spawnBullet(px, py, pvel, inst.config || {});
                break;
            case 'reset':
                this.waitTimer = inst.delay || 60;
                this.addLog("--- RESET ---", "text-slate-600");
                this.startDemo(this.currentEntry);
                break;
        }
    }

    addLog(text, colorClass = 'text-cyan-400') {
        const logCont = document.getElementById('truth-demo-log');
        const div = document.createElement('div');
        div.className = `flex items-center gap-2 ${colorClass}`;
        div.innerHTML = `<span class="text-slate-600 text-[8px]">[${this.simFrame}]</span> <span>${text}</span>`;
        logCont.appendChild(div);
        if (logCont.childNodes.length > 6) logCont.removeChild(logCont.firstChild);
        logCont.scrollTop = logCont.scrollHeight;
    }

    draw() {
        const ctx = this.ctx;
        const w = this.viewWidth;
        const h = this.viewHeight;
        const gameW = this.demoGame.width;
        const gameH = this.demoGame.height;
        ctx.clearRect(0, 0, w, h);
        this.gridOffset = (this.gridOffset + 0.5) % 40;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = this.gridOffset; y <= h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
        ctx.save();
        const padding = 20;
        const scale = Math.min((w - padding) / gameW, (h - padding) / gameH);
        const offsetX = (w - gameW * scale) / 2;
        const offsetY = (h - gameH * scale) / 2;
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, gameW, gameH);
        this.demoGame.enemies.forEach(e => e.draw(ctx));
        this.demoGame.projectiles.forEach(p => p.draw(ctx));
        this.demoGame.particles.forEach(p => p.draw ? p.draw(ctx) : null);
        this.demoGame.shockwaves.forEach(s => s.draw(ctx));
        this.demoGame.lightningBolts.forEach(l => l.draw(ctx));
        this.demoGame.floatingTexts.forEach(f => f.draw(ctx));
        this.scanLineY = (this.scanLineY + 2) % gameH;
        ctx.fillStyle = `rgba(6, 182, 212, 0.1)`;
        ctx.fillRect(0, this.scanLineY, gameW, 2);
        ctx.restore();
    }
}



// ==================== 导出配置 ====================

export {
    META_SHOP_CONFIG,
    ATTRIBUTES_FOR_SHOP,
    setDeepValue,
    CONFIG,
    RELIC_DB,
    SKILL_DB,
    TRUTH_BOOK_DATA
};
