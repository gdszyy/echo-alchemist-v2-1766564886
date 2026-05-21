/**
 * promare_tokens.js - 普罗米亚风格视觉令牌（Promare Visual Tokens）
 *
 * 单一真理源，所有 promare_* 渲染模块通过此模块读取配色、几何、运动签名。
 *
 * 设计原则：
 * - 颜色锁定 5 色硬切板（#FF0090 / #00E5FF / #FFD600 / #FFFFFF / #0a0a0a）
 * - 元素辨识由「形状 + 运动 + 尺寸」承担，颜色仅为家族编码
 * - 所有粒子使用 Triangle / Diamond / Cone / Hex / Star 等几何切片
 * - 不使用 shadowBlur / radialGradient，硬边 + 加法混合替代
 *
 * 引用：design plan §3 Codex / 原文档 §1.1 Geometric DNA
 */

// ==================== 5 色硬切板（核心 palette）====================

export const PROMARE_PALETTE = {
    PINK:   '#FF0090',   // 主色 1：火焰 / 弹射 / 穿透 accent / 危险
    CYAN:   '#00E5FF',   // 主色 2：冰霜 / 风 / 激光 / 工具
    YELLOW: '#FFD600',   // 主色 3：闪电 / 散射 / 警示
    WHITE:  '#FFFFFF',   // 中性高亮 / 核心 / 子弹白心
    BLACK:  '#0a0a0a',   // 背景 / 阴影 / 实体填充
};

// ==================== Element Codex（12 元素）====================
// 每元素的 shape / motion / 颜色映射；rendering 模块按 key 查表。
// motion key 由 promare_burst.js 内部分支消费。

export const ELEMENT_CODEX = {
    pyro: {
        shape: 'cone3',          // 3 棱锥
        primary: PROMARE_PALETTE.PINK,
        accent:  PROMARE_PALETTE.WHITE,
        motion:  'antigrav',     // vy -= 1.2dt 反重力
        burstCount: 14,          // 单次中位数
        sizeBias: 1.0,
    },
    cryo: {
        shape: 'oct2',           // 2× 拉长八面体
        primary: PROMARE_PALETTE.CYAN,
        accent:  PROMARE_PALETTE.WHITE,
        motion:  'slowfall',     // vy += 0.3dt 慢落
        burstCount: 9,
        sizeBias: 1.0,
    },
    lightning: {
        shape: 'zigzagZ',        // 6 顶点 Z 形
        primary: PROMARE_PALETTE.YELLOW,
        accent:  PROMARE_PALETTE.WHITE,
        motion:  'jitter',       // 抖动 + opacity strobe
        burstCount: 6,
        sizeBias: 0.9,
    },
    pierce: {
        shape: 'lance4',         // 4 棱长矛
        primary: PROMARE_PALETTE.WHITE,
        accent:  PROMARE_PALETTE.PINK,
        motion:  'straight',     // 几乎无重力，无旋，直线
        burstCount: 3,
        sizeBias: 1.6,           // 少而大
    },
    bounce: {
        shape: 'hex6',           // 6 边正六边形
        primary: PROMARE_PALETTE.PINK,
        accent:  PROMARE_PALETTE.YELLOW,
        motion:  'gravbounce',   // 强重力 + 单次反弹 *-0.55
        burstCount: 8,
        sizeBias: 1.0,
    },
    scatter: {
        shape: 'star4',          // 4 角星
        primary: PROMARE_PALETTE.YELLOW,
        accent:  PROMARE_PALETTE.PINK,
        motion:  'spin',         // 标重 + 中 drag + 快旋
        burstCount: 14,
        sizeBias: 0.85,
    },
    damage: {
        shape: 'diamond',        // 大菱形
        primary: PROMARE_PALETTE.WHITE,
        accent:  PROMARE_PALETTE.YELLOW,
        motion:  'sparklike',    // 类 spark + 慢衰 0.04
        burstCount: 4,
        sizeBias: 1.3,
    },
    wind: {
        shape: 'crescent',       // 月牙 / 弧形切片
        primary: PROMARE_PALETTE.CYAN,
        accent:  PROMARE_PALETTE.WHITE,
        motion:  'streak',       // 高速直线 + 无重力 + 快衰
        burstCount: 6,
        sizeBias: 1.0,
    },
    laser: {
        shape: 'ringSpoke',      // 同心环 + 辐射线
        primary: PROMARE_PALETTE.WHITE,
        accent:  PROMARE_PALETTE.CYAN,
        motion:  'static',       // 静态 + size pulse
        burstCount: 1,
        sizeBias: 2.0,
    },
    venom: {
        shape: 'triDown',        // 倒三角
        primary: PROMARE_PALETTE.YELLOW,
        accent:  PROMARE_PALETTE.PINK,
        motion:  'wobble',       // 反重力 + x-wobble
        burstCount: 5,
        sizeBias: 0.8,
    },
    echo: {
        shape: 'ringDouble',     // 双同心环
        primary: PROMARE_PALETTE.PINK,
        accent:  PROMARE_PALETTE.CYAN,
        motion:  'expand',       // 静止 + 半径 +4/帧 + alpha −0.04
        burstCount: 2,
        sizeBias: 1.5,
    },
    flying_sword: {
        shape: 'sword',          // 保留现有几何
        primary: PROMARE_PALETTE.WHITE,
        accent:  PROMARE_PALETTE.YELLOW,
        motion:  'autohunt',     // 现有 autohunt 物理
        burstCount: 1,
        sizeBias: 1.8,
    },
};

// ==================== Affix Codex（10 词缀，纯几何 overlay）====================
// 每词缀的几何 + 锚点区域；多 affix 同存时按 anchor 区分位置。

export const AFFIX_CODEX = {
    shield: {
        geometry: 'honeycomb',           // 六边蜂巢网格
        anchor:   'fullbody',
        color:    PROMARE_PALETTE.WHITE,
        alpha:    0.7,
    },
    regen: {
        geometry: 'chevronUpScroll',     // 向上滚动 chevron 条带
        anchor:   'bottomToTop',
        color:    PROMARE_PALETTE.WHITE,
        alpha:    0.65,
    },
    haste: {
        geometry: 'diagonalStripes',     // 双 45° 速度斜条
        anchor:   'centerCross',
        color:    PROMARE_PALETTE.YELLOW,
        alpha:    0.7,
    },
    clone: {
        geometry: 'mirrorDiamond5',      // 5 菱形 + ±2px 镜像
        anchor:   'distributed',
        color:    PROMARE_PALETTE.WHITE,
        alpha:    0.6,
    },
    healer: {
        geometry: 'starBurst8',          // 8 辐射线星爆
        anchor:   'center',
        color:    PROMARE_PALETTE.WHITE,
        alpha:    0.7,
    },
    devour: {
        geometry: 'cornerChevrons4',     // 4 角内向 chevron
        anchor:   'corners',
        color:    PROMARE_PALETTE.PINK,
        alpha:    0.7,
    },
    jump: {
        geometry: 'ladderUp3',           // 底部 3 行向上 chevron 梯
        anchor:   'bottom30',
        color:    PROMARE_PALETTE.YELLOW,
        alpha:    0.7,
    },
    berserk: {
        geometry: 'sawtoothTop',         // 顶边横滚锯齿牙
        anchor:   'top15',
        color:    PROMARE_PALETTE.PINK,
        alpha:    0.75,
    },
    heavyArmor: {
        geometry: 'crossHatch',          // 交叉 ×（已几何）
        anchor:   'fullbody',
        color:    PROMARE_PALETTE.WHITE,
        alpha:    0.55,
    },
    deflectionWard: {
        geometry: 'chevronHaloRing',     // 单 chevron + halo 环
        anchor:   'upperHalf',
        color:    PROMARE_PALETTE.CYAN,
        alpha:    0.7,
    },
};

// ==================== Boss Silhouette Grammar（8 boss）====================
// 每 boss 的主 glyph + 狂暴态变化；drawPromareBoss 按 bossType key 分派。

export const BOSS_GRAMMAR = {
    boss_ignis: {
        glyph: 'spire3',                 // 三尖塔
        anchor: 'topCenter',
        berserk: { extraCones: 6 },
    },
    boss_glacies: {
        glyph: 'octahedronShards',       // 体型八面体 + 3 上 shard
        anchor: 'center',
        berserk: { shardCount: 6, shardLengthMult: 1.5 },
    },
    boss_micro: {
        glyph: 'hexCluster3x3',          // 3×3 大六边形群
        anchor: 'fullbody',
        berserk: { flickerFrames: 3 },
    },
    boss_devourer: {
        glyph: 'invertedTriCut',         // 倒三角 destination-out 切口 + 8 内向 chevron
        anchor: 'center',
        berserk: { chevronCount: 12, spinMult: 1.6 },
    },
    boss_viridis: {
        glyph: 'asterisk6',              // 6 辐射线星号
        anchor: 'center',
        berserk: { pulseScale: 1.15 },
    },
    boss_tesla: {
        glyph: 'nestedPolygons',         // 三重嵌套反旋多边形
        anchor: 'center',
        berserk: { innerSpinMult: 4 },
    },
    boss_chimera: {
        glyph: 'bowtieChevrons',         // 双对开 chevron 蝴蝶结
        anchor: 'centerWide',
        berserk: { addTailZigzag: true },
    },
    boss_ouroboros: {
        glyph: 'thickRingNotch',         // 厚环切 1/4 缺口 + 小三角头
        anchor: 'center',
        berserk: { rotateSpeed: 2.0, notchWidenFactor: 1.5 },
    },
};

// ==================== Burst 四规则常量（碎片张力）====================
// 引用：原文档 §5 / 设计方案 §4.B2

export const BURST = {
    // 方向锥半角（弧度）—— 大碎片更集中
    dirConeBig:   0.45,    // ±25°
    dirConeSmall: 1.15,    // ±66°

    // 数量范围 [min, range]（实际 = min + floor(rand*range)）
    bigN:   [2, 2],        // 2~3 大碎片
    smallN: [12, 5],       // 12~16 小碎片

    // 速度分布
    bigSpeedBase:  5,
    bigSpeedRange: 4.5,    // 大碎片：5~9.5
    smallSpeedPow: 1.7,    // pow(rand, 1.7) 幂律
    smallSpeedMax: 4.2,
    smallSpeedBase: 0.3,   // 小碎片：偏向 0.3~2，长尾到 4.5

    // 时序错落
    staggerMs:      90,     // 0~90ms 随机延迟
    immediateSmall: 4,      // 前 4 个小碎片立即出生

    // 尺寸双峰
    bigSize:   [1.6, 0.8],  // 1.6~2.4
    smallSize: [0.35, 0.6], // 0.35~0.95

    // 寿命
    bigLifeFrames:   96,    // 1.6s @60fps
    smallLifeFrames: [36, 36], // 0.6~1.2s

    // 辐射冲击（每次命中额外）
    radialSpokes: 8,        // 8 辐射 spoke
    radialSpokeSpeed: 3,
};

// ==================== Hit Feedback 三件套 ====================
// 引用：原文档 §7 / 设计方案 §A6

export const HIT_FEEDBACK = {
    hitstopFrames: {
        normal: 2,           // 普通命中 2 帧
        big:    3,           // 大伤害 / 元素强反应 3 帧
        kill:   4,           // 击杀 4 帧
    },
    shakeDecay:    0.6,      // 每秒衰减系数（与现有 0.9/帧 衔接）
    shakeAmount: {
        normal:  6,
        big:    12,
        kill:   18,
    },
    flashAlpha:  0.4,        // 白闪起始 alpha
    flashFrames: 4,          // 衰减帧数
    flashDecayPerFrame: 0.7, // 每帧 *0.7
};

// ==================== 性能预算（按 game.perfQualityLevel 缩放）====================

export const PROMARE_PERF = {
    high: {
        burstBigN:    3,
        burstSmallN: 16,
        radialSpokes: 8,
        hitstopMax:   4,
        flashFrames:  4,
        useStagger:   true,
    },
    medium: {
        burstBigN:    2,
        burstSmallN: 10,
        radialSpokes: 6,
        hitstopMax:   3,
        flashFrames:  4,
        useStagger:   true,
    },
    low: {
        burstBigN:    1,
        burstSmallN:  5,
        radialSpokes: 4,
        hitstopMax:   0,     // low 档跳过停帧
        flashFrames:  2,
        useStagger:   false, // low 档跳过 setTimeout 错落
    },
};

// ==================== 工具：按 game.perfQualityLevel 取预算 ====================

export function getPromarePerf(qualityLevel) {
    return PROMARE_PERF[qualityLevel] || PROMARE_PERF.high;
}

// ==================== 工具：把现有元素类型映射到 codex key ====================
// 现有代码用 type='pyro'|'cryo'|... 字符串；不存在的 type 退化到 'damage'。

export function resolveElementKey(type) {
    if (!type) return 'damage';
    if (ELEMENT_CODEX[type]) return type;
    // 别名处理
    const aliases = {
        fire:   'pyro',
        ice:    'cryo',
        thunder: 'lightning',
        bolt:   'lightning',
        light:  'laser',
        poison: 'venom',
    };
    return aliases[type] || 'damage';
}
