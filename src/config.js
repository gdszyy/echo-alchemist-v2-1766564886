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
    /** 调试日志总开关：玩家设备应保持 false，避免 console.* 在热路径产生开销 */
    debug: false,
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
            'multicast': { name: '连射', icon: '🔗', color: '#AAAAAA' },
            'echo': { name: '回响', icon: '🔊', color: '#60a5fa' },
            'venom': { name: '剧毒', icon: '☠️', color: '#4ade80' }
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
        matVenom: '#4ade80', // 剧毒绿
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

    // ==================== 普罗米亚视觉模式（Promare Visual Mode）====================
    // 设计方案见 docs/promare 系列与 src/render/promare_tokens.js
    // [P9] 已翻为默认。console: window.__promare(false) 可临时回退到经典模式。
    visualMode: 'promare',
    promare: {
        useGeometricEnemies:    true,  // 启用几何敌人（绕过 sprite）
        useGeometricPegs:       true,  // 启用钻石钉子
        useGeometricProjectiles:true,  // 启用元素形状子弹
        hideSprites:            true,  // 隐藏所有 sprite PNG（sprite_renderer 直接 return）
        hideBackgroundBitmap:   true,  // 跳过 BG_MAIN_CANVAS_SRC，用扫描线背景
        backgroundTiltFactor:   0.5,   // 扫描线随板子 tilt 联动倍率（0=不联动, 1=完全联动）
    },
    // colors.promareOverride 由渲染器读取替换 colors.*，gameplay 逻辑不受影响
    colorsPromareOverride: {
        // 元素子弹/钉子映射到 5 色家族
        matBounce:      '#FF0090',   // PINK 系
        matPierce:      '#FFFFFF',   // WHITE 主 + PINK accent
        matScatter:     '#FFD600',   // YELLOW
        matDamage:      '#FFFFFF',
        matCryo:        '#00E5FF',   // CYAN
        matPyro:        '#FF0090',   // PINK
        matLightning:   '#FFD600',   // YELLOW
        matWind:        '#00E5FF',   // CYAN
        matWind_lv2:    '#00E5FF',
        matWind_lv3:    '#00E5FF',
        matVenom:       '#FFD600',
        marbleWhite:    '#FFFFFF',
        matMatryoshka:  '#FF0090',
        marbleRedStripe:'#FF0090',

        flying_sword:   '#FFFFFF',
        flying_sword_lv2:'#FFFFFF',
        flying_sword_lv3:'#FF0090',
        laser:          '#00E5FF',
        resonance:      '#FFD600',
        resonanceRipple:'#00E5FF',

        // 背景/钉子
        bg:             '#0a0a0a',
        peg:            '#FFFFFF',   // 中性钉子（半透明 WHITE，由 promare_peg_draw 控）
        pegActive:      '#FFFFFF',
        pegPink:        '#FF0090',

        // 敌人状态色 → 全收敛到 WHITE，靠加法 alpha 区分强度
        enemy:          '#FFFFFF',
        enemyHit:       '#FFFFFF',
        enemyFrozen:    '#00E5FF',
        enemyOverheat:  '#FF0090',
        enemyShield:    '#FFFFFF',

        // 槽位 glyph 颜色 → 按语义收敛
        slotRecall:     '#FF0090',   // 撤回 = 危险
        slotMulticast:  '#00E5FF',   // 增益
        slotSplit:      '#00E5FF',
        slotGiant:      '#FF0090',
        slotSkill:      '#FFD600',
        slotWheel:      '#FFD600',
        wheelPointer:   '#FFD600',
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
            radiusMax: 80,        // 最大核心半径（合并上限）
            energyPerSecond: 1,   // 每秒充能值
            energyMax: 20,        // 最大能量上限（合并累加上限）
            decayPerRound: 1,     // 每回合能量衰减
            cycloneRadiusMult: 1.5, // 大旋风半径相对于核心的倍率
            // 合并机制参数
            mergeDistanceMult: 1.0, // 合并触发距离 = (r1 + r2) * mergeDistanceMult
            mergeRadiusGrowth: 10,  // 合并后半径增量
            bonusTickThreshold: 15, // 能量达到此值时触发 bonusTicks
            bonusTicksOnMax: 4,     // 达到上限时额外增加的打击次数
            bonusDurationOnMax: 3   // 达到上限时额外增加的持续时间（秒）
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
        },
        // 毒素属性 (Venom)
        venom: {
            dotPerStack: 0.8,         // 每层毒素每次结算的基础伤害系数
        },
        // 超载属性 (Overcharge)
        overcharge: {
            baseChargeMult: 0.3,      // 爆炸伤害基础系数: chargeCount × overcharge × baseDmg × baseChargeMult
            aoeBaseRadius: 60,        // AoE 基础半径
            aoeRadiusPerCharge: 4,    // 每点充能增加的 AoE 半径
        },
        // 回响属性 (Echo)
        echo: {
            baseTriggerChance: 0.25,  // 战斗阶段子弹弹跳触发回响的基础概率
            chancePerLevel: 0.05,     // 每层 echo 增加的触发概率
            inheritRatio: 0.5,        // 回响子弹继承属性比例
            phantomChance: 0.30,      // 弹珠碰 Peg 时生成虚影 Peg 的基础概率
            phantomChancePerLevel: 0.05, // 每层 echo 增加虚影概率
            phantomLifetimeMs: 1000,  // 虚影 Peg 存活时间 (ms)
            phantomChildChance: 0.25, // 虚影 Peg 被碰撞时再生成虚影的概率
            marbleSplitChance: 0.18,  // 钉盘阶段：回响弹珠撞击属性钉子的概率分裂（每球至多 1 次）
        }
    },
    /** 游戏平衡性：敌人与数值 */
    balance: {
        normalPegSecondEnergChancey:0.42,
        // [镜像同步] 中轴线特殊钉子：弹珠撞击后在对称位置复制弹珠的概率
        mirrorAxisCloneChance: 0.35,
        // 敌人血量 = (baseHp + 当前回合数 * hpPerRound) * 指数因子 * 难度系数
        // [修改] 提高基础血量，降低线性斜率，依靠指数在后期发力
        enemyBaseHp: 5,        // [难度调低] 原 6 -> 进一步降低基础血量
        enemyHpPerRound: 4,    // [难度调低] 原 5 -> 进一步降低线性斜率，减少每回合血量增加值
        // [新增] 指数膨胀系数，1.12 表示每回合血量额外膨胀 12%
        hpExponent: 1.08,      // [难度调低] 原 1.10 -> 进一步降低指数膨胀，减少后期血量增速
        
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
            jumpRows: 2,            // 跳跃距离 (行数)
            // [重装] 重装词条：血量翻倍，每2回合才移动一次
            heavyArmorHpMult: 2.0,      // 重装：血量倍率
            heavyArmorMoveInterval: 2,  // 重装：移动间隔（回合数）
            heavyArmorWideGridCols: 3,  // 重装变种：占3列宽

            // ============================================
            // [V2 基底专属词条] 详见 design_spec_bitmap.md / 敌人视觉重设计 V2 文档
            // 这些词条只通过 spawn_trySpawnArchetype 生成的大型基底敌人附带，
            // 不进入 ENEMY_CURVE_CONFIG.AFFIX_WEIGHT_CURVES 的随机词条池。
            // ============================================

            // [deflectionWard] 棱盾兽 2x1 偏折屏障
            deflectionWardBarrierPct: 0.10,   // 屏障值 = maxHp × 10%
            deflectionWardHpMult: 1.0,        // 棱盾兽血量倍率（基底 hp 系数）

            // [echoRelay] 共振尖塔 1x2 回响中继
            echoRelayHpPct: 0.5,              // 自身最大生命值为同回合标准精英的 50%
            echoRelayRange: 1.5,              // 触发周围敌人词条的范围（自身宽度倍数）
            echoRelayHpMult: 0.5,             // 与基底 hp 联动的最终倍率（与 echoRelayHpPct 等效）

            // [prism] 折光棱柱 1x3 折光（基础减伤 + 激光分束）
            prismLaserDeflect: 0.5,           // 激光命中时分束伤害衰减比
            prismHpMult: 1.4,                 // 折光棱柱血量倍率（高于普通敌人）

            // [hive] 孵化巢 2x3 周期生成弱小单位
            hiveSpawnInterval: 2,             // 每隔几回合孵化一次
            hiveSpawnHpPct: 0.15,             // 幼体血量为基底 baseHP 的比例
            hiveHpMult: 2.5,                  // 孵化巢自身血量倍率

            // [siege] 攻城履带 3x2 破阵推挤
            siegeHpMult: 3.5,                 // 攻城履带血量倍率
            siegeMoveInterval: 2,             // 普通回合移动间隔（迟缓）；移动被前方敌人阻挡时尝试将阻挡链条整体向前推 1 行

            // [gravityWell] 引力炉心 3x3 大型场控
            gravityWellPullStrength: 0.18,    // 弹道回拉强度（0~1，乘以方向矢量）
            gravityWellPullRadius: 220,       // 引力影响半径（像素）
            gravityWellHpMult: 6.0,           // 引力炉心血量倍率
            gravityWellMoveInterval: 3,       // 移动间隔（极慢）
        },

        // =========================================
        // Boss 系统配置
        // =========================================
        /** Boss 出现回合配置 */
        bossRounds: {
            firstBoss: 5,             // 第一个 Boss 固定在 Round 5
            intervalMin: 7,           // 后续 Boss 最小间隔回合数
            intervalMax: 9,           // 后续 Boss 最大间隔回合数
            // 延期机制：根据玩家击杀上个 Boss 的速度动态延期
            // 快速击杀（≤ 2 回合）：延期 2 回合；中速（3 回合）：延期 1 回合；慢速（≥ 4 回合）：不延期
            delayFastKillThreshold: 2,  // 快速击杀阈值（回合数）
            delayFastKillRounds: 2,     // 快速击杀时延期回合数
            delayMidKillThreshold: 3,   // 中速击杀阈值（回合数）
            delayMidKillRounds: 1,      // 中速击杀时延期回合数
            delayMaxBossIndex: 3,       // 第几个 Boss 之后不再延期（含）：第 3 个 Boss 之后（即第 4 个起）不延期
        },

        /** Boss 血量公式参数 */
        bossHpFormula: {
            templateWeight: 0.4,         // 模板血量权重（降低算式系数）
            dynamicWeight: 0.6,          // 动态血量权重（增加每回合伤害占比）
            miniBossKillRounds: 2.5,     // Mini-Boss 期望击杀回合数
            bigBossKillRounds: 4.0,      // 大 Boss 期望击杀回合数
            floorMultiplier: 0.7,        // 保底：模板血量的 70%（后期稳定值）
            miniBossMult: 12,            // Mini-Boss 血量倍率 (减少 Boss 血量)
            bigBossMult: 28,             // 大 Boss 血量倍率 (减少 Boss 血量)
            // ── 前期保护参数（Early-Game Protection）──
            // 越早期的 Boss，动态权重越高（更贴近玩家实时战力），模板权重越低
            // 线性插值区间：[earlyRound, lateRound]
            // round <= earlyRound 时：dynamicWeight = earlyDynamicWeight
            // round >= lateRound  时：dynamicWeight = dynamicWeight（后期稳定值）
            earlyRound: 5,               // 前期保护生效的最大回合数（第一个 Boss 所在回合）
            lateRound: 20,               // 过渡结束回合（完全切换为后期稳定权重）
            earlyDynamicWeight: 0.85,    // 前期动态权重（高度依赖玩家实时伤害）
            earlyFloorMultiplier: 0.45,  // 前期保底倍率（降低保底，避免卡死新手）
            // ── Boss 倍率梯度调整（Mult Gradient）──
            // 前期区间内，根据玩家实时战力动态缩放 bossMult，使前几个 Boss 血量更贴近玩家实际战力
            // 缩放比値下限：即使玩家战力极弱， bossMult 也不低于原始倍率的该比例
            bossMultGradientMin: 0.5     // Boss 倍率梯度下限（即最少为原始倍率的 50%）
        },

        /** 8 个 Boss 专属配置 */
        bossConfigs: {
            ignis: {
                name: '熔炉守卫·伊格尼斯',
                isBigBoss: false,
                affixes: ['shield', 'haste'],
                weakness: ['pierce', 'pyro'],
                shieldChargesBonus: 5,    // 额外护盾层数
                berserkedShieldMult: 2,   // 狂暴后护盾层数翻倍系数
                berserkedTempRisePerTurn: 30, // 狂暴后每回合温度上升值
                berserkedFireSplashRadius: 80, // 狂暴后火焰溅射半径（像素）
                berserkedFireSplashDamage: 5,  // 狂暴后火焰溅射伤害
                moveInterval: 2,          // 常规模式：每 2 回合移动一次（有 haste 词缀，移动较频繁）
                themeWeights: { pyro: 1.5, pierce: 1.5 }
            },
            glacies: {
                name: '霜晶缝合怪·格拉西斯',
                isBigBoss: false,
                affixes: ['jump', 'regen'],
                weakness: ['cryo', 'pierce'],
                jumpRowsBonus: 2,         // 额外跳跃行数
                berserkedJumpRows: 3,     // 狂暴后每回合跳跃行数
                berserkedFreezePegRadius: 120, // 狂暴后跳跃落地冻结周围 Peg 的范围（像素）
                moveInterval: 3,          // 常规模式：每 3 回合移动一次（有 regen 词缀，移动较慢）
                themeWeights: { cryo: 1.5, pierce: 1.3 }
            },
            mikro: {
                name: '裂变母体·米克罗',
                isBigBoss: false,
                affixes: ['clone', 'healer'],
                weakness: ['lightning', 'scatter'],
                cloneChanceHitBonus: 0.3, // 额外受击分身概率
                berserkedCloneChance: 1.0, // 狂暴后分身概率 100%
                cloneDamageReductionPerClone: 0.10, // 每个存活分身提供的减伤比例
                cloneDamageReductionMax: 0.50,       // 分身减伤上限（5个分身即达上限）
                moveInterval: 3,          // 常规模式：每 3 回合移动一次（专注分裂，移动较慢）
                themeWeights: { lightning: 1.5, scatter: 1.5 }
            },
            devourer: {
                name: '贪婪之渊·噬神者',
                isBigBoss: false,
                affixes: ['devour', 'shield'],
                weakness: ['bounce', 'laser'],
                devourRangeBonus: 2,      // 额外吞噬范围
                berserkedDevourRange: 99, // 狂暴后全屏吞噬
                moveInterval: 2,          // 常规模式：每 2 回合移动一次（吞噬后需要靠近）
                themeWeights: { bounce: 1.5, laser: 1.5 }
            },
            viridis: {
                name: '翠绿共生体·维里迪斯',
                isBigBoss: true,
                affixes: ['regen', 'healer'],
                weakness: ['laser', 'pyro'],
                regenPercentBonus: 0.2,   // 额外再生百分比
                berserkedHealerRange: 0,   // 狂暴后停止治疗其他敌人（放弃治疗他人）
                berserkedSelfRegenMult: 3.0, // 狂暴后自身回血速度倍率（集中治疗自身）
                moveInterval: 3,          // 常规模式：每 3 回合移动一次（专注治疗，移动缓慢）
                themeWeights: { laser: 1.5, pyro: 1.3 }
            },
            tesla: {
                name: '雷霆幻影·特斯拉',
                isBigBoss: true,
                affixes: ['haste', 'clone'],
                weakness: ['cryo', 'bounce'],
                hasteActionsBonus: 1,     // 额外行动次数（共3次）
                berserkedActionsBonus: 1, // 狂暴后再+1次行动
                moveInterval: 2,          // 常规模式：每 2 回合移动一次（有 haste 词缀，移动较快）
                themeWeights: { cryo: 1.5, bounce: 1.3 }
            },
            chimera: {
                name: '混沌融合体·奇美拉',
                isBigBoss: true,
                affixes: ['berserk', 'devour'],
                weakness: ['pierce', 'laser'],
                initTemp: 60,             // 初始温度（半狂暴状态）
                berserkedTempThreshold: 100, // 狂暴后温度阈值
                berserkedBlastOnHitChance: 0.25, // 狂暴后受击触发全场爆炸概率
                moveInterval: 2,          // 常规模式：每 2 回合移动一次（混沌体，移动较频繁）
                themeWeights: { pierce: 1.5, laser: 1.5 }
            },
            ouroboros: {
                name: '永恒回声·奥罗波罗斯',
                isBigBoss: true,
                affixes: ['shield', 'haste'], // 初始词缀组（轮转起点）
                weakness: ['dynamic'],        // 动态弱点
                rotationSets: [             // 词缀轮转组
                    ['shield', 'haste'],
                    ['regen', 'healer'],
                    ['clone', 'jump']
                ],
                rotationInterval: 3,        // 每 3 回合切换一次
                berserkedRotationInterval: 1, // 狂暴后每回合切换
                moveInterval: 3,          // 常规模式：每 3 回合移动一次（永恒回声，移动最慢）
                themeWeights: { pierce: 1.2, cryo: 1.2, lightning: 1.2 }
            }
        },
        /** Boss 进场冲击波效果配置 */
        bossEntranceShockwave: {
            waveCount: 3,           // 冲击波波数
            waveDelay: 120,         // 每圈延迟间隔（毫秒）
            shockwaveMaxRadius: 600, // 冲击波最大半径（像素）
            shakeDuration: 400,     // 屏幕震动持续时间（毫秒）
            affixChance: 0.35,      // 被冲击波命中后获得 Boss 特殊词条的概率
            minionChance: 0.05,     // 被冲击波命中后直接转化为 Boss 随从的概率（降低：减少异型敌人数量）
            bigBossBonus: 0.10      // 大 Boss 进场时概率加成
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
        rows: 5,           // 钉子行数
        spacingX: 35,      // 钉子水平间距
        spacingY: 32,      // 钉子垂直间距
        startRows: 3,       // [难度调低] 原 4 -> 初始生成3行敌人，减少第1关压力
        spawnMin: 2,        // [难度调低] 原 3 -> 每波最少生成2个，降低前期压力
        selectionCount: 6,  // 选卡阶段提供多少张卡
        selectionReq: 3,     // 需要选择多少张卡
        assimilationDoubleMultiplier: 2,
        enemyDropBaseChance: 0.04,
        enemyDropRoundBonus: 0.004,
        enemyDropRoundBonusCap: 20,
        enemyDropAffixBonus: 0.03,
        enemyDropMaxChance: 0.24,
        enemyDropRelicBaseChance: 0.12,
        enemyDropRelicAffixBonus: 0.12,
        enemyDropRelicHighHpThreshold: 120,
        enemyDropRelicHighHpBonus: 0.08,
        enemyDropRelicMaxChance: 0.45,
        enemyDropPureEssenceChance: 0.35,
        hitCooldowns: 17,    // 默认基础冷却时间
        pegCooldownAdd: 7,   // 每次触发增加的冷却帧数
        pegCooldownDecay: 2, // 每秒减少的冷却帧数
        relicChance: 0.1,
        initTriggerThreshold: 15,
        nextTriggerThresholdIncrease: 8,
        // ==================== [v2 钉板模块化] 模块网格 ====================
        moduleCols: 4,                 // 模块网格列数
        moduleRows: 3,                 // 模块网格行数（共 12 槽）
        moduleDefaultSlots: 12,        // 默认开放的模块槽位数（全部 4×3 = 12 槽）
        moduleAreaTopY: 60,            // 模块区域起始 Y 坐标（画布顶部留白）
        moduleAreaBottomMargin: 80,    // 模块区域底部留白
        moduleSpacingX: 4,             // 模块横向间距 px
        moduleSpacingY: 4,             // 模块纵向间距 px
        // 钉板左右两侧到画布墙的留白（每侧 1.5 个弹珠直径 = 1.5 × 2 × 7.7 ≈ 23 px）
        moduleAreaSideMargin: 23,
        // ==================== [v2 局内商店 + 符文碎片经济] ====================
        runShopInterval: 2,            // 每 N 场战斗弹出一次局内商店
        runShopRefreshCost: 10,        // 刷新一次商店消耗碎片
        runShopItemsPerOffer: 5,       // 每次刷新提供的商品数
        runShopRunesRatio: 0.6,        // 商品中符文占比
        runShopEndOfRunFragmentSettle: 0.3, // 局结束时未消费碎片转换为 saveData 的比例
        enemyDropFragmentChance: 0.30, // 普通敌人击杀掉落碎片基础概率
        enemyDropFragmentBaseAmount: 1,
        enemyDropFragmentRoundBonus: 0.02, // 每回合 +2% 慢爬升
        enemyDropFragmentChanceCap: 0.55,  // 普通敌人掉落概率上限
        eliteFragmentDrop: 3,           // 精英敌人击杀掉落（80% 概率）
        eliteFragmentDropChance: 0.80,
        bossFragmentDrop: 8,            // Boss 击杀必掉
        maxSkillPoints: 3,  // 技能点上限
        spSlotsStartRow:3,
        spSlotsEndRow:8,
        fireSpreadDamagePercent:0.25,
        fireSpreadTempIncrease:50,
        fireSpreadRadius:100,
        assimilationChance: {
            bounce: 0.13,
            pierce: 0.078,
            scatter: 0.078,
            damage: 0.13,
            cryo: 0.13,
            pyro: 0.13,
            echo: 0.10,
            venom: 0.10
        },
        // [新增] 特殊变体概率乘子
        // [重要] 设为 0 彻底关闭无词条时的默认变异；变异概率完全由符文词条控制
        specialMutationMult: 0, // 变异概率乘子 (基于同化概率)
        specialUpgradeMult: 0.42,   // 升级概率乘子 (基于同化概率)
        // [激光折射系统] 折射机制参数
        laserRefractionBaseChance: 0.30,  // 折射基础触发概率 (30%)
        laserRefractionBounceBonus: 0.05, // 每层 bounce 增加的触发概率 (+5%)
        laserRefractionMaxChance: 0.80,   // 折射触发概率上限 (80%)
        laserRefractionRadius: 150,       // 折射搜寻范围半径 (px)
        laserRefractionDamageDecay: 0.75, // 每次折射的伤害衰减系数 (75%)
        laserRefractionWidthDecay: 0.85,  // 每次折射的光线宽度衰减系数 (85%)
        laserRefractionMaxTotal: 50,      // 单次发射最大折射总次数 (防止极端情况)
        laserRefractionDepthDecay: 0.65,   // 每增加一层折射深度，概率乘以该系数 (65%)。第 1 层折射概率 × 0.65，第 2 层 × 0.65^2，以此类推
        
        // [动态掉落与保底系统 - V2 回合生成时判定]
        dropPity: {
            // 保底阈值：连续生成 N 行未命中掉落，下一行强制命中
            essenceSpawnMiss: 4,      // 精华保底：连续 4 行未掉落，第 5 行强制出精华
            relicSpawnMiss: 12,       // 遗物保底：连续 12 行未掉落遗物，第 13 行强制出遗物
            
            // 动态概率修正系数
            playerPowerWeight: 0.5,   // 玩家战力对掉率的影响权重（战力越低，掉率越高）
            enemyHpWeight: 0.3,       // 敌人血量对掉率的影响权重（血量越高，掉率越高）
            traceHpWeight: 0.4,       // 踪迹剩余血量对掉率的影响权重（踪迹血量越低，掉率越高）
            
            // 概率修正范围
            minChanceMult: 0.5,       // 最小概率倍率（战力极强时）
            maxChanceMult: 2.5,       // 最大概率倍率（战力极弱时）
            
            // 场上奖励密度控制
            fieldRewardLimit: 3,      // 场上带奖励敌人超过此数时开始衰减
            fieldRewardDecay: 0.4,    // 每多一个带奖励敌人，掉率乘以该系数
            fieldRewardHardCap: 5,    // 场上带奖励敌人达到此数时，强制将掉落概率归零且暂停保底累加
            
            // 战力碾压判定（禁用保底且暂停保底计数器累加）
            powerCrushThreshold: 2.0, // 玩家战力超过期望血量此倍数时禁用保底
            
            // 紧急救援机制（预测性提前送出）
            emergencyReliefThreshold: 0.7,  // 生存压力超过此阈值时触发紧急救援
            emergencyReliefCooldown: 3      // 紧急救援触发后的冷却回合数
        }
    },
    //  初始概率配置 (現在這些是基礎權重，解鎖後會增加)
    // [DESIGN] 初始状态只提供 bounce（反弹）属性。
    // 其余属性权重均为 0，需通过遗物解锁后才会按概率刷新对应属性钉子。
    probabilities: { 
        white: 100,       // 基礎
        bounce: 20,       // 初始解鎖（唯一初始可用属性）
        laser: 0,
        // 物理系 (初始鎖定，通過遺物解鎖)
        pierce: 0, 
        scatter: 0,
        damage: 3,
        
        // 元素系 (初始鎖定，通過遺物獨立解鎖)
        cryo: 0, 
        pyro: 0, 
        
        // 特殊系 (初始鎖定)
        explosive: 0,
        rainbow: 0,
        matryoshka: 0,
        resonance: 0,
        echo: 0,
        venom: 0,
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
    },

    // ==================== 敌人渲染管线增强参数 (Task A) ====================
    enemyRender: {
        // A1: Layer 1.5 材质光泽渐变
        // 顶部白色叠加 alpha（模拟凸起高光）
        glossTopAlpha: 0.08,
        // 底部黑色叠加 alpha（模拟底部阴影）
        glossBottomAlpha: 0.12,

        // A2: Layer 4 战损裂纹（血量联动）
        // 血量比例低于此阈値时显示战损裂纹
        battleDamageFissureThreshold: 0.3,
        // 裂纹最大 alpha（血量为 0 时达到）
        battleDamageFissureMaxAlpha: 0.6,

        // A3: 受击 Squash & Stretch 形变
        // 单次伤害占最大血量比例的上限（防止一次性大伤害导致过度形变）
        hitImpactMax: 0.15,
        // 每帧衰减系数（每帧 × hitImpactDecay）
        hitImpactDecay: 0.85,
        // X 轴拉伸系数（宽度放大倍率）
        hitImpactScaleX: 0.5,
        // Y 轴压缩系数（高度缩小倍率）
        hitImpactScaleY: 0.5,

        // E1: 随机静态倾斜（Static Tilt）
        // 最大静态倾斜弧度（约 ±2.5°），普通敌人使用，elite 乘 0.6，boss 为 0
        staticTiltMax: 0.044,

        // E2: 纹理色调随机偏移（Hue Shift Overlay）
        // 色调偏移最小透明度
        hueShiftAlphaMin: 0.04,
        // 色调偏移透明度随机范围
        hueShiftAlphaRange: 0.04,

        // E3: 边角随机磨损点（Corner Wear Dots）
        // 磨损点最少数量
        wearDotCountMin: 2,
        // 磨损点最多数量
        wearDotCountMax: 4,
        // 磨损点最小透明度
        wearDotAlphaMin: 0.25,
        // 磨损点最大透明度
        wearDotAlphaMax: 0.45,

        // D1: 呼吸缩放（Breathing Scale）
        // 呼吸缩放幅度（scale 偏移量，如 0.018 表示 ±1.8%）
        breatheAmplitude: 0.018,
        // 呼吸周期（毫秒），越小越快
        breathePeriod: 3200,

        // D2: 待机微浮动（Idle Float）
        // 垂直浮动幅度（像素），如 1.5 表示上下各 1.5px
        idleFloatAmplitude: 1.5,
        // 浮动周期（毫秒），与呼吸错开节奏
        idleFloatPeriod: 2600,

        // D1/D3 升级：呼吸缓动曲线升级（Breathe Curve Upgrade）
        // 呼吸缓动指数（1.0=线性正弦，越大停留感越强）
        breatheEasingPower: 1.5,
        // 边框脉冲过曝叠加层最大透明度（lighter 模式高光描边）
        borderPulseOverglowAlpha: 0.25,
        // elite 边框光晕强度倍率（体现精英感）
        borderPulseEliteMultiplier: 1.8,
        // boss 边框光晕强度倍率（体现威压感）
        borderPulseBossMultiplier: 2.5,
        // boss 边框脉冲周期倍率（越小越快）
        borderPulseBossPeriodMult: 0.75,

        // D3: 边框脉冲光晕（Border Pulse Glow）
        // 光晕最大 shadowBlur 値
        borderPulseBlurMax: 8,
        // 脉冲周期（毫秒）
        borderPulsePeriod: 2800,
        // normal 敌人光晕颜色（冷灰蓝，微弱存在感）
        borderPulseColorNormal: '#94a3b8',
        // elite 敌人光晕颜色（金色脉冲）
        borderPulseColorElite: '#facc15',
        // boss 敌人光晕颜色（红色脉冲）
        borderPulseColorBoss: '#ef4444',

        // D4: 激光照射抖动反馈（Laser Hit Shake）
        // 照射抖动持续时间（帧数）
        laserHitShakeDuration: 12,
        // 照射抖动最大幅度（像素）
        laserHitShakeAmplitude: 3.5,
        // 照射抖动衰减系数（每帧乘以该值）
        laserHitShakeDecay: 0.88,

        // Layer 3.5 Breathe: 词缀核心过曝叠加层最大透明度
        // 比 Boss 弱（Boss 约 0.4），避免普通/精英敌人词缀特效喜宾夺主
        // [降低护盾亮度] 0.2 → 0.12，减少 lighter 模式白色过曝对下层细节的遮盖
        affixCoreOverglowAlpha: 0.12,

        // T2: Boss 核心过曝模拟（Boss Core Overglow）
        // Boss 过曝叠加层最大透明度（0=关闭，1=最强），随呼吸周期动态变化
        bossOverglowAlpha: 0.35,
        // 狂暴状态下过曝强度倍率（叠加在 bossOverglowAlpha 上）
        bossOverglowBerserkMult: 1.5,

        // Arc Boss VFX 高阶视觉特效参数（Task T3）
        // Devourer 深渊核心震颤幅度（像素），DEVOURING 状态下核心的随机位移范围
        devourerCoreShakeAmplitude: 2,
        // Ouroboros 符文呼吸缓动指数，控制 Math.pow 的幂次，值越大呼吸越有停留感
        ouroborosRuneBreathePower: 1.5,
        // Ouroboros 狂暴共鸣光环三角形数量（均匀分布在环形外侧）
        ouroborosBerserkResonanceCount: 6,

        // ===== 精英（Elite）晶化变异装饰参数 =====
        // 虚空晶核旋转速度（弧度/秒）
        eliteCoreRotateSpeed: 0.8,
        // 虚空晶核半径（相对于 min(w,h) 的比例）
        eliteCoreRadiusRatio: 0.22,
        // 虚空晶核过曝叠加最大透明度（lighter 模式）
        eliteCoreOverglowAlpha: 0.45,
        // 流光金边：高光点沿边框移动的速度（0~1 循环，值越大越快）
        eliteBorderFlowSpeed: 0.4,
        // 流光金边：高光点宽度（0~1，相对于边框总周长）
        eliteBorderFlowWidth: 0.18,
        // 流光金边：炫彩流光速度（6+ 词条大BOSS 专用，比金边更快）
        eliteBorderRainbowFlowSpeed: 0.6,
        // 流光金边：炫彩流光宽度
        eliteBorderRainbowFlowWidth: 0.22,

        // ===== 精英/Boss 边框分级样式参数（Border Tier）=====
        // 根据词条数量决定边框颜色与线宽，共 6 档：
        //   0 词条 → 无特殊边框（normal 灰色）
        //   1 词条 → 铁边框
        //   2 词条 → 铜边框
        //   3 词条 → 银边框
        //   小BOSS / 4-5 词条 → 金边框（含流光）
        //   大BOSS / 6+ 词条 → 炫彩流光边框
        // 铁边框：哑光铁灰色
        borderTierIronColor: '#6b7280',
        borderTierIronWidth: 2.5,
        borderTierIronGlow: '#9ca3af',
        borderTierIronGlowBlur: 6,
        // 铜边框：暖铜橙色
        borderTierBronzeColor: '#b45309',
        borderTierBronzeWidth: 3,
        borderTierBronzeGlow: '#d97706',
        borderTierBronzeGlowBlur: 8,
        // 银边框：冷银白色
        borderTierSilverColor: '#94a3b8',
        borderTierSilverWidth: 3,
        borderTierSilverGlow: '#e2e8f0',
        borderTierSilverGlowBlur: 10,
        // 金边框：流光金色（与精英装饰 E4 共用流光逻辑）
        borderTierGoldColor: '#facc15',
        borderTierGoldWidth: 3.5,
        borderTierGoldGlow: '#fde68a',
        borderTierGoldGlowBlur: 14,
        // 炫彩流光边框：彩虹渐变循环（大BOSS / 6+ 词条）
        borderTierRainbowWidth: 4,
        borderTierRainbowGlowBlur: 18,

        // 晶化切面：叠加层最大透明度
        eliteCrystalFacetAlpha: 0.12,

        // ===== Boss（Boss）深渊熔炉装饰参数 =====
        // 深渊黑晕：紧贴身体的阴影 shadowBlur 值
        bossAbyssalAuraBlur: 28,
        // 深渊黑晕：阴影颜色（深红近黑）
        bossAbyssalAuraColor: '#450a0a',
        // 熔岩脉络：脉络呼吸周期（毫秒）
        bossMagmaVeinPeriod: 1800,
        // 熔岩脉络：脉络最大透明度（screen 模式）
        bossMagmaVeinAlpha: 0.22,
        // 狂暴闪烁：闪烁频率（Hz），值越大闪烁越快
        bossBerserkFlickerHz: 8,
        // 狂暴闪烁：过曝白核最大透明度（lighter 模式）
        bossBerserkCoreAlpha: 0.55,

        // ===== 词缀阶梯式渲染参数 =====
        // shield 精英：交点节点高光半径（像素）
        eliteShieldNodeRadius: 3.5,
        // shield 精英：交点节点高光最大透明度
        // [降低护盾亮度] 0.7 → 0.45，减少精英/Boss 节点高光对下层细节的遮盖
        eliteShieldNodeAlpha: 0.45,
        // regen 精英：上升气泡数量
        eliteRegenBubbleCount: 5,
        // regen Boss：生物脉络数量
        bossRegenVeinCount: 6,
        // haste 精英：电弧折线分段数
        eliteHasteArcSegments: 4,
        // clone 精英：重影偏移量（像素）
        eliteCloneGhostOffset: 4,
        // clone Boss：轨道卫星数量
        bossCloneSatelliteCount: 3,

        // ===== 奖励标记敌人专属光晕参数 (Pending Reward Halo) =====
        // 适用于 _pendingRewardType 不为空的敌人，在 idle 状态下显示专属光晕
        // 设计原则：借鉴精英晶化变异的视觉语言，三种类型必须一眼可辨

        // --- 遗物（relic）：「宝藏封印」风格 ---
        // 借用精英 E2 虚空晶核（金色版）+ E4 流光金边 + 双层脉冲环
        // 金色光晕：外圈 shadowBlur 最大值（像素）
        relicHaloBlurMax: 28,
        // 金色光晕：脉冲周期（毫秒）
        relicHaloPeriod: 1600,
        // 金色光晕：外圈描边颜色
        relicHaloColor: '#facc15',
        // 金色光晕：外圈描边最大透明度
        relicHaloStrokeAlpha: 0.9,
        // 金色内圈光晕颜色（琥珀色）
        relicHaloColorInner: '#f59e0b',
        // 内圈光晕 shadowBlur 最大值（像素）
        relicHaloInnerBlurMax: 16,
        // 王冠图标：浮动幅度（像素）
        relicIconFloatAmplitude: 5,
        // 王冠图标：浮动周期（毫秒）
        relicIconFloatPeriod: 1800,
        // 王冠图标：图标字体大小（像素）
        relicIconFontSize: 18,
        // 王冠图标：图标距敌人顶部的偏移（像素，负值为向上）
        relicIconOffsetY: -14,
        // 金色晶核：旋转速度（弧度/秒）
        relicCoreRotateSpeed: 0.6,
        // 金色晶核：半径（相对于 min(w,h) 的比例）
        relicCoreRadiusRatio: 0.20,
        // 流光金边：高光点移动速度（0~1 循环/秒）
        relicBorderFlowSpeed: 0.55,
        // 流光金边：高光点宽度（0~1，相对于边框总周长）
        relicBorderFlowWidth: 0.20,

        // --- 混沌精华（chaos_essence）：「混沌侵蚀」风格 ---
        // 借用精英 E1 晶化切面（紫/红混沌版）+ 快速旋转混沌晶核 + 六芒星符文
        // 混沌光晕：外圈 shadowBlur 最大值（像素）
        chaosHaloBlurMax: 24,
        // 混沌光晕：脉冲周期（毫秒，更快=更不稳定）
        chaosHaloPeriod: 900,
        // 混沌光晕：内圈颜色（紫色）
        chaosHaloColorInner: '#a855f7',
        // 混沌光晕：外圈颜色（红色）
        chaosHaloColorOuter: '#ef4444',
        // 混沌光晕：外圈描边最大透明度
        chaosHaloStrokeAlpha: 0.80,
        // 旋转符文粒子：数量（high 档）
        chaosRuneCount: 4,
        // 旋转符文粒子：轨道半径（相对于敌人宽度的倍率）
        chaosRuneOrbitRadius: 0.78,
        // 旋转符文粒子：旋转速度（弧度/毫秒，更快=更混沌）
        chaosRuneRotateSpeed: 0.0025,
        // 旋转符文粒子：字体大小（像素）
        chaosRuneFontSize: 12,
        // 混沌晶核：旋转速度（弧度/秒，快速旋转体现混沌）
        chaosCoreRotateSpeed: 2.2,
        // 混沌晶核：半径（相对于 min(w,h) 的比例）
        chaosCoreRadiusRatio: 0.18,
        // 混沌切面：叠加层最大透明度（E1 同款，紫/红色系）
        chaosCrystalFacetAlpha: 0.14,

        // --- 纯净精华（pure_essence）：「晶化净化」风格 ---
        // 借用精英 E2 虚空晶核（冰晶版）+ E3 过曝叠加 + 六角雪花旋转
        // 纯净光晕：外圈 shadowBlur 最大值（像素）
        pureHaloBlurMax: 22,
        // 纯净光晕：脉冲周期（毫秒，缓慢=纯净稳定）
        pureHaloPeriod: 2200,
        // 纯净光晕：内圈颜色（纯白）
        pureHaloColorInner: '#ffffff',
        // 纯净光晕：外圈颜色（冰蓝）
        pureHaloColorOuter: '#bfdbfe',
        // 纯净光晕：外圈描边最大透明度
        pureHaloStrokeAlpha: 0.85,
        // 晶化光效：晶体数量（high 档）
        pureCrystalCount: 5,
        // 晶化光效：晶体轨道半径（相对于敌人宽度的倍率）
        pureCrystalOrbitRadius: 0.72,
        // 晶化光效：旋转速度（弧度/毫秒，负值反向旋转）
        pureCrystalRotateSpeed: -0.0007,
        // 晶化光效：晶体大小（像素）
        pureCrystalSize: 5,
        // 冰晶核心：旋转速度（弧度/秒，缓慢旋转体现纯净）
        pureCoreRotateSpeed: 0.4,
        // 冰晶核心：半径（相对于 min(w,h) 的比例）
        pureCoreRadiusRatio: 0.22,
        // 冰晶切面：叠加层最大透明度（E1 同款，白/蓝冰晶色系）
        pureCrystalFacetAlpha: 0.10,
        // 纯净过曝叠加：lighter 模式白色过曝最大透明度（E3 同款）
        pureCoreOverglowAlpha: 0.30
    },

    // ==================== 自适应性能配置 (Adaptive Performance) ====================
    // 根据设备实时帧率动态调整特效等级，保障手机端流畅运行。
    // 等级共 3 档：HIGH（高画质）/ MEDIUM（均衡）/ LOW（省电/低端机）
    performance: {
        // --- FPS 采样参数 ---
        // 滑动平均窗口大小（帧数），用于平滑瞬时帧率波动
        fpsSampleWindow: 60,
        // 降级触发阈值：平均 FPS 低于此值持续 downgradeHoldSec 秒后降一档
        fpsThresholdDown: 45,
        // 升级触发阈值：平均 FPS 高于此值持续 upgradeHoldSec 秒后升一档
        fpsThresholdUp: 55,
        // 降级保护时间（秒）：连续低帧多久才真正降级，防止瞬时卡顿误触发
        downgradeHoldSec: 3,
        // 升级保护时间（秒）：连续高帧多久才真正升级，防止频繁抖动
        upgradeHoldSec: 10,

        // --- 各等级粒子预算 ---
        // HIGH：全效果，适合高端手机 / 桌面
        high: {
            maxParticles:    800,  // 全局粒子总上限
            windLimit:       120,  // wind_slash / line 风属性粒子上限
            emberLimit:       80,  // ember 火焰粒子上限（无风时）
            emberLimitWind:   30,  // ember 火焰粒子上限（风属性激活时）
            mistLimit:        80,  // mist 冰雾粒子上限（无风时）
            mistLimitWind:    30,  // mist 冰雾粒子上限（风属性激活时）
            shardLimit:       60,  // shard 冰渣粒子上限（无风时）
            shardLimitWind:   20,  // shard 冰渣粒子上限（风属性激活时）
            sparkLimit:      100,  // spark 通用火星粒子上限（含机械类受击电弧、能量泄漏等）
            smokeLimit:       60,  // smoke 烟雾粒子上限（含狂暴受击烟雾等）
            venomLimit:       60,  // venom 毒液粒子上限（中毒敌人漂浮毒液滴）
            // 特效对象上限（Shockwave / FireWave / HealWave / LightningBolt）
            shockwaveLimit:   20,
            waveLimit:        10,
            lightningLimit:   15,
            // Peg 软阴影与底部光晕开关（true = 开启）
            pegSoftShadow:    true,
            pegGlowHalo:      true,
            // 敌人材质光泽渐变开关
            enemyGloss:       true,
            // Arc Boss VFX 特效密度控制（high: 完整效果）
            arcBossVfxTriCount:  6,   // Ouroboros 狂暴共鸣三角形数量（0=关闭）
            arcBossVfxLineCount: 6,   // Devourer 旋转引力线数量
            arcBossVfxWhiteGrad: true, // Devourer 深渊核心 lighter 白化叠加开关
            arcBossVfxSuckProb:  0.7, // Devourer 吸入粒子每帧生成概率
            // 奖励标记敌人光晕门控（high: 完整效果）
            rewardHaloEnabled: true,   // 光晕效果开关（false 时完全跳过）
            rewardRuneCount: 4,        // 混沌精华旋转符文数量
            rewardCrystalCount: 5,     // 纯净精华晶体数量
            // 回合开始横幅充能特效（high: 完整光晕扩散动画）
            roundStartBannerGlow: true,
            // shadowBlur 全局开关（移动端 GPU 上 shadowBlur 是单帧最贵的 Canvas2D 操作）
            shadowBlurEnabled: true,
        },
        // MEDIUM：均衡模式，适合中端手机
        medium: {
            maxParticles:    400,
            windLimit:        60,
            emberLimit:       40,
            emberLimitWind:   15,
            mistLimit:        30,
            mistLimitWind:    12,
            shardLimit:       30,
            shardLimitWind:   10,
            sparkLimit:       50,  // spark 通用火星粒子上限（均衡模式）
            smokeLimit:       25,  // smoke 烟雾粒子上限（均衡模式）
            venomLimit:       30,  // venom 毒液粒子上限（均衡模式）
            shockwaveLimit:   12,
            waveLimit:         6,
            lightningLimit:    8,
            pegSoftShadow:    true,
            pegGlowHalo:      false,  // 关闭 Peg 底部光晕（每帧径向渐变）
            enemyGloss:       true,
            // Arc Boss VFX 特效密度控制（medium: 减半）
            arcBossVfxTriCount:  3,   // 三角形减半，降低 shadowBlur 调用次数
            arcBossVfxLineCount: 6,   // 引力线保持，但 shadowBlur 已随脉冲降低
            arcBossVfxWhiteGrad: true, // 保留白化叠加
            arcBossVfxSuckProb:  0.5, // 吸入粒子概率降至 50%
            // 奖励标记敌人光晕门控（medium: 减少旋转装饰）
            rewardHaloEnabled: true,   // 保留光晕效果（主要开销为 shadowBlur）
            rewardRuneCount: 2,        // 混沌精华旋转符文减半
            rewardCrystalCount: 3,     // 纯净精华晶体减少
            // 回合开始横幅充能特效（medium: 保留光晕）
            roundStartBannerGlow: true,
            shadowBlurEnabled: true,
        },
        // LOW：省电模式，适合低端手机 / 发热严重时
        low: {
            maxParticles:    150,
            windLimit:        30,
            emberLimit:       15,
            emberLimitWind:    6,
            mistLimit:        10,
            mistLimitWind:     4,
            shardLimit:       12,
            shardLimitWind:    4,
            sparkLimit:       20,  // spark 通用火星粒子上限（省电模式）
            smokeLimit:        8,  // smoke 烟雾粒子上限（省电模式）
            venomLimit:        0,  // venom 毒液粒子上限（省电模式：完全关闭，仅保留敌人叠加层）
            shockwaveLimit:    6,
            waveLimit:         3,
            lightningLimit:    4,
            pegSoftShadow:    false,  // 关闭 Peg 软阴影
            pegGlowHalo:      false,
            enemyGloss:       false,  // 关闭敌人材质光泽（省去 OffscreenCanvas 渐变叠加）
            // Arc Boss VFX 特效密度控制（low: 大幅削减）
            arcBossVfxTriCount:  0,   // 关闭三角形符文（6 次 shadowBlur/帧 → 0）
            arcBossVfxLineCount: 3,   // 引力线减半（6 次 createLinearGradient → 3）
            arcBossVfxWhiteGrad: false, // 关闭 lighter 白化叠加（createRadialGradient）
            arcBossVfxSuckProb:  0.3, // 吸入粒子概率降至 30%
            // 奖励标记敌人光晕门控（low: 关闭所有光晕和旋转装饰）
            rewardHaloEnabled: false,  // 关闭光晕（省去 shadowBlur + createRadialGradient）
            rewardRuneCount: 0,        // 关闭旋转符文
            rewardCrystalCount: 0,     // 关闭晶体装饰
            // 回合开始横幅充能特效（low: 降级为简单淡入，无光晕）
            roundStartBannerGlow: false,
            // shadowBlur 在 low 等级一律关闭，是降温的关键开关
            shadowBlurEnabled: false,
        }
    }
};


// ==================== 钉盘结构遗物互斥集合 ====================
// 所有影响钉盘结构（行数、布局形态）的遗物 ID，单局内只能选择其中一个
// [v2 模块化] 行数/布局遗物保留作为 boardLayout 兼容入口（映射为预设模块组合），
// 不影响新增的 module_slot_up / unlock_module_type 系列遗物（这些可叠加）。
// [v2 模块化] 钉盘结构遗物已全部迁移为 pinboard_modules.js 中的模块；保留空集合以维持导出兼容。
const BOARD_STRUCTURE_RELICS = new Set();

// ==================== 遗物数据库 ====================

const RELIC_DB = [
    { 
    id: 'gigantism_relic', 
    name: '倍化之术', 
    icon: '🔮', 
    desc: '永久提升弹珠体积，更容易击中钉子与槽位。', 
    rarity: 'rare', 
    effect: 'permanent_size_up',
    maxStacks: 1,
    recommended: true,
    tags: ['伤害提升', '新手友好'],
    recommendTip: '弹珠变大后更容易命中钉子，大幅提升每回合伤害输出！'
},
    { 
    id: 'chaos_essence', 
    name: '混沌精華', 
    icon: '🎡', 
    desc: '收集階段：沿用舊版命運輪盤入口，轉動後使選中的已擁有屬性數量翻倍。', 
    rarity: 'legendary', 
    effect: 'unlock_slot', 
    slotType: 'wheel',
    maxStacks: 1
    },
    {
    id: 'pure_essence',
    name: '純淨精華',
    icon: '🕊️',
    desc: '下一次命運抉擇改為只選 1 枚彈珠，並額外注入 1 個合法符文。',
    rarity: 'legendary',
    effect: 'pure_essence',
    maxStacks: 1
    },
    // [v2 模块化] 旧 dimension_shard / dimension_crystal 行数遗物已移除，迁移为
    // pinboard_modules.js 中的 dim_shard_module / dim_crystal_module（高密度釘板模块），
    // 通过商店购买后挂载到模块槽位。
    { id: 'stars_shines', name: '群星闪烁', icon: '✨', desc: '解鎖 [回响彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆回响彈珠。', rarity: 'rare', effect: 'unlock_marble', marbleType: 'resonance', boost: 8, maxStacks: 1 },
    { id: 'optical_lens', name: '聚焦透鏡', icon: '🔭', desc: '解鎖 [光球彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆光球彈珠。', rarity: 'legendary', effect: 'unlock_marble', marbleType: 'laser', boost: 10, maxStacks: 1 },
    //  1. 粉色钉子遗物
    { id: 'pink_slime', name: '粉紅凝膠', icon: '💗', desc: '收集階段：出現 3 個高彈性粉色釘子 (可疊加)。立刻觸發一次混沌精華。', rarity: 'common', effect: 'pink_peg_up', maxStacks: 5},

    //  2. 战斗底部反弹墙（诅咒：所有墙体都消耗反弹/穿透）
    { id: 'energy_shield', name: '力場護盾', icon: '🛡️', desc: '戰鬥階段：底部邊界可反彈子彈。但子彈觸碰任何墻體（左/右/頂/底）都會額外消耗一次反彈或穿透次數。', rarity: 'cursed', effect: 'combat_wall' ,maxStacks: 1},

    // [v2 模块化] 特殊槽解锁 (unlock_recall / unlock_multicast / unlock_split) 和
    // 槽数 +1 (slot_expander) 已从遗物池移除，迁移到局内商店出售
    // （详见 src/ui/run_shop.js 中 slot_unlock / slot_count 商品）。
    //  獨立元素遺物
    { id: 'cryo_stone', name: '永恆凍土', icon: '❄️', desc: '解鎖 [冰霜彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆冰霜彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'rare', effect: 'unlock_marble', marbleType: 'cryo', boost: 15, maxStacks: 1 },
    { id: 'pyro_stone', name: '不滅火種', icon: '🔥', desc: '解鎖 [火焰彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆火焰彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'rare', effect: 'unlock_marble', marbleType: 'pyro', boost: 15, maxStacks: 1 },
    // { id: 'lightning_stone', name: '雷霆之怒', icon: '⚡', desc: '解鎖 [閃電] 屬性 (彈珠與釘子)。', rarity: 'rare', unlocks: 'lightning', boost: 15 },

    //  物理套裝遺物
    { id: 'tactical_kit_pierce', name: '穿透補給', icon: '↗', desc: '解鎖 [穿透彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆穿透彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'legendary', effect: 'unlock_marble', marbleType: 'pierce', boost: 5, maxStacks: 1 },
    { id: 'tactical_kit_scatter', name: '散射補給', icon: '🔱', desc: '解鎖 [散射彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆散射彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'legendary', effect: 'unlock_marble', marbleType: 'scatter', boost: 5, maxStacks: 1 },
    { id: 'tactical_kit_damage', name: '增幅補給', icon: '⚔️', desc: '解鎖 [增幅彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆增幅彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'common', effect: 'unlock_marble', marbleType: 'damage', boost: 5, maxStacks: 1, recommended: true, tags: ['伤害核心', '新手友好'], recommendTip: '解锁增幅属性并立即获得2颗增幅弹珠，同化概率永久翻倍！' },

    { id: 'explosive_ammo', name: '高爆火藥', icon: '🧨', desc: '解鎖 [爆破彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆爆破彈珠。', rarity: 'rare', effect: 'unlock_marble', marbleType: 'explosive', boost: 10, maxStacks: 1 },
    { id: 'prism_shard', name: '七彩稜鏡', icon: '🌈', desc: '解鎖 [彩虹彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆彩虹彈珠。', rarity: 'legendary', effect: 'unlock_marble', marbleType: 'rainbow', boost: 5, maxStacks: 1 },
    { id: 'russian_doll', name: '俄羅斯套娃', icon: '🪆', desc: '解鎖 [套娃彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆套娃彈珠。', rarity: 'legendary', effect: 'unlock_marble', marbleType: 'matryoshka', boost: 5, maxStacks: 1 },

    // [v2 模块化] 旧的钉盘布局遗物（triangle_formation / diamond_formation /
    // sparse_interval / mirror_sync / wide_narrow）已从遗物池移除，迁移为
    // pinboard_modules.js 中的 triangle_module / diamond_module / sparse_module /
    // mirror_module / wide_narrow_module，通过商店购买后挂载到模块槽位。
    // ==================== 属性弹珠解锁遗物 ====================
    // 效果：解锁该属性弹珠，立即触发一次混沌精华，并保证带有 2 颗该属性弹珠；同化概率永久翻倍
    { id: 'surge_bounce', name: '彈性潮涌', icon: '🔵', desc: '解鎖 [彈性彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆彈性彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'rare', effect: 'unlock_marble', marbleType: 'bounce', boost: 10, maxStacks: 1 },
    { id: 'surge_echo',   name: '回响潮涌', icon: '🔊', desc: '解鎖 [回响彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆回响彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'rare', effect: 'unlock_marble', marbleType: 'echo',   boost: 10, maxStacks: 1 },
    { id: 'surge_venom',  name: '劇毒潮涌', icon: '☠️', desc: '解鎖 [劇毒彈珠]。立刻觸發一次混沌精華，並保證帶有 2 顆劇毒彈珠；此 2 顆彈珠同化概率永久翻倍。', rarity: 'rare', effect: 'unlock_marble', marbleType: 'venom',  boost: 10, maxStacks: 1 },

    // ==================== 新手前期过渡遗物 ====================
    // 炼金火药管：所有弹珠基础伤害 +2（可叠加3次），后期自然稀释
    {
        id: 'alchemist_powder_tube',
        name: '炼金火药管',
        icon: '⚗️',
        desc: '你的所有弹珠基础伤害 +2。（最多疊加 3 次）',
        rarity: 'common',
        effect: 'flat_damage_up',
        flatDamageValue: 2,
        maxStacks: 3,
        recommended: true,
        tags: ['伤害提升', '新手友好'],
        recommendTip: '立即提升所有弹珠的基础伤害，前期最稳定的输出加成！'
    },

    // 走私者系列：立即给予符文（按稀有度分为4个版本）
    {
        id: 'smuggler_pouch_common',
        name: '走私者的行囊',
        icon: '🎒',
        desc: '立即获得 2 个随机普通符文。',
        rarity: 'common',
        effect: 'grant_runes',
        grantRarity: 'common',
        grantCount: 2,
        maxStacks: 3,
        recommended: true,
        tags: ['符文加速', '新手友好'],
        recommendTip: '立即获得符文，快速激活符文词条，大幅提升战斗力！'
    },
    {
        id: 'smuggler_chest_rare',
        name: '走私者的宝箱',
        icon: '📦',
        desc: '立即获得 2 个随机稀有符文。',
        rarity: 'rare',
        effect: 'grant_runes',
        grantRarity: 'rare',
        grantCount: 2,
        maxStacks: 2
    },
    {
        id: 'smuggler_vault_epic',
        name: '走私者的密库',
        icon: '🗝️',
        desc: '立即获得 2 个随机史诗符文。',
        rarity: 'epic',
        effect: 'grant_runes',
        grantRarity: 'epic',
        grantCount: 2,
        maxStacks: 1
    },
    {
        id: 'smuggler_sanctum_legendary',
        name: '走私者的圣所',
        icon: '🏛️',
        desc: '立即获得 2 个随机传说符文。',
        rarity: 'legendary',
        effect: 'grant_runes',
        grantRarity: 'legendary',
        grantCount: 2,
        maxStacks: 1
    },

    // 绝境之刃：距离失败线越近，伤害加成越高（距离3格内才有明显加成）
    {
        id: 'desperation_blade',
        name: '绝境之刃',
        icon: '🩸',
        desc: '战斗阶段：距离失败线越近，所有子弹伤害加成越高。距离 0 格 +50%，1 格 +25%，2 格 +12.5%，3 格以上无加成。',
        rarity: 'cursed',
        effect: 'desperation_damage',
        maxStacks: 1
    },

    // ==================== 即时战斗强化遗物（v2 即时感重塑）====================
    // 设计目标：摆脱"立刻触发混沌精华"的钉板依赖，将"拿到=立刻强"的体感转移到战斗/弹药/掉落维度。

    // 猎人本能：血量最低的敌人始终被标记为"狩猎目标"，命中时伤害 +25%
    {
        id: 'hunter_instinct',
        name: '猎人本能',
        icon: '🎯',
        desc: '战斗阶段：场上血量最低的敌人始终被标记为「狩猎目标」，子弹命中该目标时伤害 +25%。',
        rarity: 'rare',
        effect: 'hunter_instinct',
        maxStacks: 1,
        recommended: true,
        tags: ['伤害提升', '集火'],
        recommendTip: '聚焦残血敌人，单点击杀效率大幅提升！'
    },
    // 符文共鸣核：每次击杀，符文充能条额外 +8%
    {
        id: 'rune_resonance_core',
        name: '符文共鸣核',
        icon: '💠',
        desc: '战斗阶段：子弹每次击杀敌人，符文充能条额外 +8%。',
        rarity: 'rare',
        effect: 'rune_resonance_core',
        maxStacks: 1,
        recommended: true,
        tags: ['符文加速', '击杀奖励'],
        recommendTip: '击杀越多，符文充能越快，构筑成型速度暴增！'
    },
    // 镜像弹夹：获得后立即将当前 ammoQueue 中伤害最高的子弹复制一份加入队列末尾
    {
        id: 'mirror_magazine',
        name: '镜像弹夹',
        icon: '🪞',
        desc: '获得后立刻将本回合弹药队列中伤害最高的子弹复制一份，加入队列末尾。',
        rarity: 'rare',
        effect: 'mirror_magazine',
        maxStacks: 2
    },
    // 末日计时器：每回合开始时，场上随机一个敌人受到 round×5 的固定伤害
    {
        id: 'doomsday_timer',
        name: '末日计时器',
        icon: '⏱️',
        desc: '每回合开始时，对场上随机一个敌人造成 (回合数 × 5) 的固定真实伤害。',
        rarity: 'rare',
        effect: 'doomsday_timer',
        maxStacks: 1,
        recommended: true,
        tags: ['持续伤害', '回合奖励'],
        recommendTip: '每回合自动削血，越打到后面伤害越夸张！'
    },
    // 余韵回响：触发钉板时，单一属性收集到 10 层以上时，额外再收集 1 层
    {
        id: 'echo_reverberation',
        name: '余韵回响',
        icon: '🔔',
        desc: '触发钉板时，若单一属性收集到 10 层以上，自动额外再收集 1 层（每种属性每次钉板仅触发一次）。',
        rarity: 'rare',
        effect: 'echo_reverberation',
        maxStacks: 1
    },
    // 元素注入器：获得后立即删除当前 ammoQueue 中最强和最弱的子弹，剩下那颗属性翻倍
    {
        id: 'element_injector',
        name: '元素注入器',
        icon: '💉',
        desc: '获得后立刻删除本回合弹药队列中最强和最弱的两颗子弹，剩下那颗子弹的所有属性层数翻倍。',
        rarity: 'epic',
        effect: 'element_injector',
        maxStacks: 1
    },
    // 混沌爆发：掉落混沌精华时，立刻全屏伤害 round×2
    {
        id: 'chaos_burst',
        name: '混沌爆发',
        icon: '💥',
        desc: '战斗阶段：每次敌人掉落混沌精华时，立刻对全场所有敌人造成 (回合数 × 2) 的固定真实伤害。',
        rarity: 'cursed',
        effect: 'chaos_burst',
        maxStacks: 1
    },
    // 属性协议：弹药配方含 4 种以上不同属性时，所有子弹基础伤害 +{该子弹携带属性种类数}
    {
        id: 'attribute_protocol',
        name: '属性协议',
        icon: '🧬',
        desc: '若本回合弹药配方包含 4 种以上不同属性，每颗子弹的基础伤害 + 该子弹自身携带的属性种类数。',
        rarity: 'rare',
        effect: 'attribute_protocol',
        maxStacks: 1,
        recommended: true,
        tags: ['多元素', '伤害提升'],
        recommendTip: '属性越杂越强，鼓励混搭流派！'
    },
    // 殒命爆裂：击杀敌人时，对附近敌人造成被杀敌人最大血量 10%（最小 2）的固定伤害
    {
        id: 'mortal_burst',
        name: '殒命爆裂',
        icon: '🎆',
        desc: '战斗阶段：每当敌人被击杀，在死亡位置爆炸，对附近敌人造成该敌人最大血量 10%（最小 2）的固定真实伤害。',
        rarity: 'rare',
        effect: 'mortal_burst',
        maxStacks: 1,
        recommended: true,
        tags: ['连锁清场', '群伤'],
        recommendTip: '击杀越凶，连锁爆炸越强！高血量精英死亡时清场尤为爽快。'
    },
    // 回廊电弧：撞击左右墙壁获得闪电属性；每回合开始对靠墙敌人发动闪电链
    {
        id: 'corridor_arc',
        name: '回廊电弧',
        icon: '⚡',
        desc: '子弹每次撞击左/右墙壁，获得 +1 层闪电属性。每回合开始时，紧贴左右墙壁的敌人各有 50% 概率被闪电链击中（层数 = 回合数，伤害 = 当前弹药中三颗子弹的最高基础伤害）。',
        rarity: 'epic',
        effect: 'corridor_arc',
        maxStacks: 1
    },
    // 混沌契约（诅咒）：无法研磨弹珠（精华只能跳过），但所有子弹伤害 ×2，立即获得 3 个稀有符文
    {
        id: 'chaos_pact',
        name: '混沌契约',
        icon: '🩸',
        desc: '【诅咒】无法进行研磨阶段，获得精华只能选择跳过。【收益】立刻获得 3 个随机稀有符文，所有子弹伤害永久 ×2。',
        rarity: 'cursed',
        effect: 'chaos_pact',
        maxStacks: 1
    },
    // 贪婪轮盘（诅咒）：发射时 multicast 折算为伤害（每层 +damage×0.5），每发 75% 概率再发射一次
    {
        id: 'greedy_wheel',
        name: '贪婪轮盘',
        icon: '🎲',
        desc: '【诅咒】子弹发射时，所有连射 (multicast) 层数清零并按每层 +(基础伤害 × 0.5) 折算为固定伤害。【收益】每次发射后有 75% 概率自动再发射一次（再发射不会再触发本效果）。',
        rarity: 'cursed',
        effect: 'greedy_wheel',
        maxStacks: 1
    },
    // ==================== [v2 钉板模块化] 新增遗物 ====================
    // 模块槽位扩张
    {
        id: 'module_slot_expander',
        name: '模塊擴張器',
        icon: '⊞',
        desc: '釘板模塊槽位 +1。槽位按 row-major 順序解鎖（從第 1 行向下展開）。',
        rarity: 'rare',
        effect: 'module_slot_up',
        amount: 1,
        maxStacks: 9
    },
    {
        id: 'module_row_unlock',
        name: '模塊整行解鎖',
        icon: '═',
        desc: '釘板模塊槽位一次性 +4（解鎖一整行）。',
        rarity: 'legendary',
        effect: 'module_slot_up',
        amount: 4,
        maxStacks: 2
    },
    // 模块类型解锁
    {
        id: 'unlock_module_wheel',
        name: '機械轉盤',
        icon: '🎰',
        desc: '解鎖 [轉盤模塊]：可放置在釘板上，弹珠落入後觸發屬性翻倍輪盤。',
        rarity: 'rare',
        effect: 'unlock_module_type',
        moduleId: 'wheel_module',
        maxStacks: 1
    },
    {
        id: 'unlock_module_baffle',
        name: '能量擋板',
        icon: '⫽',
        desc: '解鎖 [擋板模塊]：傾斜的高彈性平面，將弹珠導向特定方向。',
        rarity: 'rare',
        effect: 'unlock_module_type',
        moduleId: 'baffle',
        maxStacks: 1
    },
    {
        id: 'unlock_module_fixed_slot',
        name: '固定機關槽',
        icon: '◈',
        desc: '解鎖 [固定特殊槽模塊]：在固定位置生成回溯/連射/分裂槽。',
        rarity: 'epic',
        effect: 'unlock_module_type',
        moduleId: 'fixed_slot',
        maxStacks: 1
    },
    {
        id: 'unlock_module_element_pair',
        name: '冰火元素對',
        icon: '❄🔥',
        desc: '解鎖 [元素對模塊]：固定生成 1 顆冰霜釘 + 1 顆火焰釘，無需融合。',
        rarity: 'rare',
        effect: 'unlock_module_type',
        moduleId: 'cryo_pyro_pair',
        maxStacks: 1
    },
];

// ==================== 技能数据库 ====================

const SKILL_DB = [
    {
        id: 'skill_frost_prison',
        methodId: 'skill_frost_prison',
        unlockRuneword: 'runeword_absolute_zero', // 解锁词条：绝对零度
        name: '冰牢封印',
        icon: '🧊',
        cost: 2,
        color: '#67e8f9',
        desc: '冻结所有敌人 3 秒，冻结期间受到的伤害提升 30%。',
        params: {
            freezeDuration: 3,
            damageAmpBonus: 0.30,
            particleColor: '#67e8f9',
            flashColor: 'rgba(103, 232, 249, 0.15)'
        }
    },
    {
        id: 'skill_thunder_call',
        methodId: 'skill_thunder_call',
        unlockRuneword: 'runeword_thunderstorm', // 解锁词条：雷暴之语
        name: '雷神降臨',
        icon: '🌩️',
        cost: 3,
        color: '#a78bfa',
        desc: '对所有敌人各落一道天雷，伤害基于回合数 × 8，并施加感电。',
        params: {
            baseDmg: 8,
            roundMult: 8,
            boltColor: '#a78bfa',
            flashColor: 'rgba(167, 139, 250, 0.2)',
            chainLevel: 10
        }
    },
    {
        id: 'skill_kinetic_burst',
        methodId: 'skill_kinetic_burst',
        unlockRuneword: 'runeword_kinetic_surge', // 解锁词条：动能激增
        name: '動能爆發',
        icon: '🔄',
        cost: 1,
        color: '#34d399',
        desc: '下一发弹珠弹跳次数上限 +15，且每次弹跳伤害额外 +3。',
        params: {
            bounceBonus: 15,
            flatDamagePerBounce: 3,
            particleColor: '#34d399',
            floatText: 'KINETIC!'
        }
    },
    {
        id: 'skill_meltdown_nova',
        methodId: 'skill_meltdown_nova',
        unlockRuneword: 'runeword_meltdown', // 解锁词条：熔毁
        name: '熔毀新星',
        icon: '🌋',
        cost: 2,
        color: '#fb923c',
        desc: '对所有敌人施加过热状态，温度直接拉至爆炸阈值的 80%。',
        params: {
            tempRatio: 0.80,
            particleColor: '#fb923c',
            flashColor: 'rgba(251, 146, 60, 0.15)'
        }
    },
    {
        id: 'skill_blade_rain',
        methodId: 'skill_blade_rain',
        unlockRuneword: 'runeword_blade_storm', // 解锁词条：剑刃风暴
        name: '劍刃雨',
        icon: '⚔️',
        cost: 2,
        color: '#e2e8f0',
        desc: '召唤 5 道飞剑同时斩击随机敌人，每道伤害为回合数 × 4。',
        params: {
            swordCount: 5,
            roundMult: 4,
            particleColor: '#e2e8f0'
        }
    },
    {
        id: 'skill_prismatic_shot',
        methodId: 'skill_prismatic_shot',
        unlockRuneword: 'runeword_elemental_fusion', // 解锁词条：元素聚变
        name: '棱光炮',
        icon: '🌈',
        cost: 3,
        color: '#f0abfc',
        desc: '下一发弹珠同时携带火/冰/雷三种属性，强制触发元素聚变判定。',
        params: {
            pyroStacks: 5,
            cryoStacks: 5,
            lightningStacks: 5,
            forceFusion: true,
            floatText: 'PRISMATIC!',
            explosionColor: '#f0abfc'
        }
    }
];


// ==================== Boss 配置数据库 ====================
/**
 * BOSS_DB - Boss 配置数据库
 *
 * 每个 Boss 对象包含：
 *   id: 唯一标识符
 *   name: 显示名称（中文）
 *   affixes: 初始词缀数组（对应 Enemy.affixes）
 *   themeWeights: Boss 主题符文掉落权重加成（按符文 element 字段匹配）
 *     键为 RUNE_DB 中的 element 字段，值为额外权重加成量
 *     在 loot_calcRuneDrop 的第三层抽取中，与 BOSS_THEME_MULTIPLIER 相乘后叠加到符文权重
 *
 * 弹点属性来源：docs/boss_system_design.md
 * 对应 COUNTER_MAP 中的克制关系：
 *   pyro.shield=1.0, pierce.shield=1.0 → 伊格尼斯（护盾+极速）
 *   cryo.jump=0.8, pierce.jump=0.8   → 格拉西斯（跳跃+再生）
 *   lightning.clone=1.0, scatter.clone=1.0 → 米克罗（分身+治疗）
 *   bounce.devour=0.8, laser.devour=0.8  → 噬神者（吞噬+护盾）
 *   laser.regen=1.0, pyro.regen=0.8      → 维里迪斯（再生+治疗）
 *   cryo.haste=1.0, bounce.haste=0.4     → 特斯拉（极速+分身）
 *   pierce.shield=1.0, laser.shield=0.5  → 奇美拉（狂暴+吞噬）
 *   动态弹点                            → 奥罗波罗斯（全词缀轮转）
 */
const BOSS_DB = [
    {
        id: 'boss_ignis',
        name: '燕炉守卫·伊格尼斯',
        affixes: ['shield', 'haste'],
        // 弹点：穿透 (Pierce) 与 火焰 (Pyro) —— 克制护盾
        themeWeights: { pierce: 3.0, pyro: 3.0 }
    },
    {
        id: 'boss_glacies',
        name: '霜晶缝合怪·格拉西斯',
        affixes: ['jump', 'regen'],
        // 弹点：冰霜 (Cryo) 与 穿透 (Pierce) —— 克制跳跃与再生
        themeWeights: { cryo: 3.0, pierce: 3.0 }
    },
    {
        id: 'boss_micro',
        name: '裂变母体·米克罗',
        affixes: ['clone', 'healer'],
        // 弹点：闪电 (Lightning) 与 散射 (Scatter) —— 克制分身与治疗
        themeWeights: { lightning: 3.0, scatter: 3.0 }
    },
    {
        id: 'boss_devourer',
        name: '贪婪之渊·噬神者',
        affixes: ['devour', 'shield'],
        // 弹点：弹射 (Bounce) 与 激光 (Laser) —— 克制吞噬
        themeWeights: { bounce: 3.0, laser: 3.0 }
    },
    {
        id: 'boss_viridis',
        name: '翠绳共生体·维里迪斯',
        affixes: ['regen', 'healer'],
        // 弹点：激光 (Laser) 与 火焰 (Pyro) —— 克制再生与治疗
        themeWeights: { laser: 3.0, pyro: 3.0 }
    },
    {
        id: 'boss_tesla',
        name: '雷霆幻影·特斯拉',
        affixes: ['haste', 'clone'],
        // 弹点：冰霜 (Cryo) 与 弹射 (Bounce) —— 克制极速与分身
        themeWeights: { cryo: 3.0, bounce: 3.0 }
    },
    {
        id: 'boss_chimera',
        name: '混沌融合体·奇美拉',
        affixes: ['berserk', 'devour'],
        // 弹点：穿透 (Pierce) 与 激光 (Laser) —— 克制狂暴与吞噬
        themeWeights: { pierce: 3.0, laser: 3.0 }
    },
    {
        id: 'boss_ouroboros',
        name: '永恒回声·奥罗波罗斯',
        affixes: ['shield', 'haste'], // 初始词缀，将按回合轮转
        // 动态弹点，暂时配置均衡权重（待导演系统实现后可根据当前词缀动态调整）
        themeWeights: { pierce: 1.5, pyro: 1.5, cryo: 1.5, lightning: 1.5, laser: 1.5, scatter: 1.5, bounce: 1.5 }
    }
];

// ==================== 敌人词缀教学曲线配置 ====================

/**

 * ENEMY_CURVE_CONFIG - 敌人词缀教学曲线配置字典

 * 

 * 用于驱动 spawn_system.js 中的词缀生成概率，控制游戏节奏和难度曲线。

 * 包含八大主题段落，每个段落有核心词缀权重峰值。

 */

const ENEMY_CURVE_CONFIG = {

    // 双词缀精英基础概率

    ELITE_DUAL_AFFIX_BASE: 0.15,

    // Boss 战后高压提升值（持续 3 回合）

    ELITE_DUAL_AFFIX_POST_BOSS_BOOST: 0.25,

    

    // 八大段落的回合区间定义

    THEME_SEGMENTS: [

        { startRound: 1, endRound: 5, label: "基础教学段", bossId: "boss_ignis" },

        { startRound: 6, endRound: 12, label: "持续压力段", bossId: "boss_glacies" },

        { startRound: 13, endRound: 19, label: "群体控制段", bossId: "boss_micro" },

        { startRound: 20, endRound: 26, label: "机制复合段", bossId: "boss_devourer" },

        { startRound: 27, endRound: 33, label: "进阶测试段", bossId: "boss_viridis" },

        { startRound: 34, endRound: 40, label: "速度地狱段", bossId: "boss_tesla" },

        { startRound: 41, endRound: 47, label: "混沌段", bossId: "boss_chimera" },

        { startRound: 48, endRound: 54, label: "终极考验段", bossId: "boss_ouroboros" }

    ],

    // 导演系统模板权重调度表（与 THEME_SEGMENTS 一一对应）
    // 格式：{ phalanx, blitz, berserk_pack, jumper_pack, thermal_bomb }（权重为 0 表示不出现）
    // 权重设计原则：各模板权重之和为 100，权重 0 表示禁用，剩余权重按比例随机选择
    TEMPLATE_WEIGHTS: [

        // R1-R5 基础教学段：引入 phalanx（教学流穿和治愈的配合）
        { phalanx: 60, blitz: 0, berserk_pack: 0, jumper_pack: 0, thermal_bomb: 0 },

        // R6-R12 持续压力段：引入 blitz（教学极速和跳跃的应对）
        { phalanx: 40, blitz: 40, berserk_pack: 0, jumper_pack: 20, thermal_bomb: 0 },

        // R13-R19 群体控制段：引入 berserk_pack（教学冰霜降温控制）
        { phalanx: 20, blitz: 30, berserk_pack: 30, jumper_pack: 20, thermal_bomb: 0 },

        // R20-R26 机制复合段：引入 thermal_bomb（教学紧急降温）
        { phalanx: 15, blitz: 25, berserk_pack: 25, jumper_pack: 20, thermal_bomb: 15 },

        // R27-R33 进阶测试段：强化 berserk 和 thermal_bomb
        { phalanx: 10, blitz: 20, berserk_pack: 30, jumper_pack: 15, thermal_bomb: 25 },

        // R34-R40 速度地狱段：极速为主， thermal_bomb 开始高频出现
        { phalanx: 5, blitz: 35, berserk_pack: 20, jumper_pack: 20, thermal_bomb: 20 },

        // R41-R47 混沌段： thermal_bomb 最高频，考验玩家全面应对能力
        { phalanx: 5, blitz: 20, berserk_pack: 20, jumper_pack: 15, thermal_bomb: 40 },

        // R48-R54 终极考验段：全模板高压，均衡分布
        { phalanx: 10, blitz: 20, berserk_pack: 25, jumper_pack: 15, thermal_bomb: 30 }

    ],

    

    // 每个段落内各词缀的权重值（0-100）

    // 权重设计原则：核心词缀 80-100，引入词缀 30-50，背景词缀 10-20，未引入词缀 0-5

    AFFIX_WEIGHT_CURVES: [

        // R1-R5 基础教学段：引入 shield (R3), regen (R5)

        { shield: 80, regen: 30, healer: 0, haste: 0, jump: 0, clone: 0, devour: 0, berserk: 0 },

        // R6-R12 持续压力段：引入 healer (R6), haste (R8), jump (R9)

        { shield: 40, regen: 80, healer: 50, haste: 30, jump: 30, clone: 0, devour: 0, berserk: 0 },

        // R13-R19 群体控制段：引入 clone (R12), devour (R12), berserk (R14)

        { shield: 20, regen: 40, healer: 80, haste: 50, jump: 50, clone: 80, devour: 40, berserk: 30 },

        // R20-R26 机制复合段：强化 haste, jump, devour

        { shield: 20, regen: 20, healer: 40, haste: 80, jump: 80, clone: 50, devour: 80, berserk: 50 },

        // R27-R33 进阶测试段：强化 regen, healer, berserk

        { shield: 30, regen: 80, healer: 80, haste: 40, jump: 40, clone: 40, devour: 50, berserk: 80 },

        // R34-R40 速度地狱段：极速与跳跃的极致

        { shield: 20, regen: 20, healer: 20, haste: 100, jump: 100, clone: 60, devour: 40, berserk: 60 },

        // R41-R47 混沌段：分身与吞噬的狂欢

        { shield: 40, regen: 40, healer: 40, haste: 40, jump: 40, clone: 100, devour: 100, berserk: 80 },

        // R48-R54 终极考验段：全词缀高压

        { shield: 80, regen: 80, healer: 80, haste: 80, jump: 80, clone: 80, devour: 80, berserk: 100 }

    ]

};


// ==================== 导出配置 ====================
// 注意：TRUTH_BOOK_DATA 已移动到 systems.js，因为它需要使用 Enemy 类

export {
    META_SHOP_CONFIG,
    ATTRIBUTES_FOR_SHOP,
    setDeepValue,
    CONFIG,
    RELIC_DB,
    BOARD_STRUCTURE_RELICS,
    SKILL_DB,
    BOSS_DB,
    ENEMY_CURVE_CONFIG,
};
