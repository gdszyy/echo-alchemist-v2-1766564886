/**
 * pinboard_modules.js - 钉板模块化（v2 养成深化）
 *
 * 钉板由 4×3 = 12 个模块槽组成。每个模块在自己的矩形区域内独立生成
 * 一组实体（普通钉子、特殊钉子、固定特殊槽等）。
 *
 * 主入口：buildModuleEntities(moduleId, originX, originY, w, h, ctx, slotIdx)
 *   返回 { pegs: Peg[], specialSlots: SpecialSlot[] }
 *
 * 设计约束：
 *   - 模块内部仍然走"交错"逻辑（用户已确认）
 *   - 普通 peg 在模块构造完成后，会按当前钉盘属性生成权重随机获得已解锁属性
 *     （权重来源：game.unlockedWeights / CONFIG.probabilities 的运行态副本）
 *   - 模块自身预置的特殊钉子（如 pink、cryo、pyro）必须保留，不参与随机覆盖
 *
 * MVP 实现说明：
 *   - wheel_module 复用 SpecialSlot type='wheel'（已有的转盘触发机制）
 *   - baffle 模块用一排粉色高弹性钉子模拟"挡板反弹"，复用 pink peg 物理
 *   - fixed_slot 模块复用 SpecialSlot 类（multicast/recall/split 轮换）
 */

import { CONFIG } from './config.js';
import { Peg, SpecialSlot } from './entities.js';

// 与 game_phase.phase_gathering_getRandomPegType 保持一致：laser / lightning 不生成钉子。
const RANDOMIZABLE_PEG_TYPES = ['bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro', 'wind'];

const PEG_RADIUS = CONFIG.physics.pegRadius || 4;
const MARBLE_RADIUS = CONFIG.physics.marbleRadius || 5.8;
const PINBOARD_SPACING_BUFFER = CONFIG.physics.pinboardSpacingBuffer || 1;
// @perf-impact: Denser modules can raise Peg count; expensive Peg shadow/halo drawing remains gated by CONFIG.performance.
// Base passability spacing. Size-up marbles are intentionally a tradeoff, not the density baseline.
const MIN_PEG_SPACING = 2 * PEG_RADIUS + 2 * MARBLE_RADIUS + PINBOARD_SPACING_BUFFER;

let moduleInstanceSeq = 0;

function createModuleUid(moduleId) {
    moduleInstanceSeq += 1;
    return `${moduleId}_${Date.now().toString(36)}_${moduleInstanceSeq.toString(36)}`;
}

export function createModuleInstance(moduleId, seed = {}) {
    return {
        id: moduleId,
        uid: seed.uid || createModuleUid(moduleId),
        pegStates: { ...(seed.pegStates || {}) },
        pluginStates: { ...(seed.pluginStates || {}) },
    };
}

export function createModuleRef(anchorIdx) {
    return { ref: anchorIdx };
}

export function isModuleRef(entry) {
    return !!(entry && typeof entry === 'object' && entry.ref !== undefined);
}

export function getModuleIdFromEntry(entry) {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object' && entry.id) return entry.id;
    return null;
}

export function getModuleInstance(entry) {
    return entry && typeof entry === 'object' && entry.id ? entry : null;
}

export function normalizeModuleEntry(entry) {
    if (!entry) return null;
    if (isModuleRef(entry)) return entry;
    if (typeof entry === 'string') return createModuleInstance(entry);
    if (entry && typeof entry === 'object' && entry.id) {
        if (!entry.uid) entry.uid = createModuleUid(entry.id);
        if (!entry.pegStates) entry.pegStates = {};
        if (!entry.pluginStates) entry.pluginStates = {};
        return entry;
    }
    return null;
}

export function ensureModuleLayoutInstances(layout, totalSlots, defaultSlots = CONFIG.gameplay.moduleDefaultSlots || 3) {
    const count = Math.max(0, totalSlots || DEFAULT_MODULE_SEQUENCE.length);
    const source = Array.isArray(layout) ? layout : createDefaultModuleLayout(count, defaultSlots);
    const next = Array.from({ length: count }, (_, i) => normalizeModuleEntry(source[i]));
    return next;
}

/**
 * 按当前局内属性权重随机生成 peg 类型。
 * white 表示普通钉子权重，返回值使用 Peg 类实际类型 normal。
 */
function getRandomPegTypeFromWeights(weights) {
    const source = weights || {};
    const normalWeight = Math.max(0, source.white || 100);
    const weightedTypes = RANDOMIZABLE_PEG_TYPES
        .map(type => ({ type, weight: Math.max(0, source[type] || 0) }))
        .filter(item => item.weight > 0);

    let totalWeight = normalWeight;
    for (const item of weightedTypes) totalWeight += item.weight;
    if (totalWeight <= 0) return 'normal';

    let r = Math.random() * totalWeight;
    if (r < normalWeight) return 'normal';
    r -= normalWeight;

    for (const item of weightedTypes) {
        if (r < item.weight) return item.type;
        r -= item.weight;
    }
    return 'normal';
}

/**
 * 对模块生成出的普通钉子按权重随机赋予属性；模块预置特殊钉子不被覆盖。
 */
function applyWeightedPegTypes(pegs, ctx) {
    const weights = ctx && ctx.unlockedWeights;
    if (!Array.isArray(pegs) || !weights) return pegs;
    for (const peg of pegs) {
        if (peg && peg.type === 'normal') {
            peg.type = getRandomPegTypeFromWeights(weights);
            peg.level = peg.level || 1;
        }
    }
    return pegs;
}

/**
 * 在指定矩形内按交错模式生成普通钉子。
 */
function generateStaggeredPegs(originX, originY, w, h, cols, rows, type = 'normal') {
    const pegs = [];
    if (cols < 1 || rows < 1) return pegs;
    // 限制列数/行数，确保中心间距 >= MIN_PEG_SPACING（倍化弹珠直径）
    const effectiveCols = cols > 1 ? Math.min(cols, Math.max(1, Math.floor(w / MIN_PEG_SPACING))) : 1;
    const effectiveRows = rows > 1 ? Math.min(rows, Math.max(1, Math.floor(h / MIN_PEG_SPACING))) : 1;
    const spacingX = effectiveCols > 1 ? (w / effectiveCols) : w;
    const spacingY = effectiveRows > 1 ? (h / (effectiveRows + 0.5)) : h;
    for (let r = 0; r < effectiveRows; r++) {
        const isOdd = r % 2 !== 0;
        // 奇数行从左边缘起始（baseLeftPad=0），右边距=spacingX；
        // 偶数行居中（baseLeftPad=spacingX/2），两侧各 spacingX/2。
        // 两种情况下横向拼接缝隙均为 spacingX+moduleSpacingX，消除第2行空格。
        const colsThisRow = effectiveCols;
        const baseLeftPad = isOdd ? 0 : (w - (colsThisRow - 1) * spacingX) / 2;
        for (let c = 0; c < colsThisRow; c++) {
            const x = originX + baseLeftPad + c * spacingX;
            const y = originY + spacingY * 0.5 + r * spacingY;
            const p = new Peg(x, y, type);
            p.row = r;
            p.col = c;
            p.level = 1;
            pegs.push(p);
        }
    }
    return pegs;
}

/**
 * 在矩形内按"漏斗"形态生成（顶宽底窄）。
 */
function generateFunnelPegs(originX, originY, w, h, topCols, rows) {
    const pegs = [];
    if (rows < 1) return pegs;
    const spacingY = rows > 1 ? h / (rows + 0.5) : h;
    const maxColsForW = Math.max(1, Math.floor((w * 0.85) / MIN_PEG_SPACING));
    for (let r = 0; r < rows; r++) {
        const colsThisRow = Math.min(Math.max(1, topCols - r), maxColsForW);
        const spacingX = colsThisRow > 1 ? (w * 0.85) / colsThisRow : w * 0.85;
        const baseLeftPad = (w - (colsThisRow - 1) * spacingX) / 2;
        for (let c = 0; c < colsThisRow; c++) {
            const x = originX + baseLeftPad + c * spacingX;
            const y = originY + spacingY * 0.5 + r * spacingY;
            const p = new Peg(x, y, 'normal');
            p.row = r;
            p.col = c;
            p.level = 1;
            pegs.push(p);
        }
    }
    return pegs;
}

/**
 * 模块定义注册表
 */
function markFusionFocus(pegs, originX, originY, w, h, maxPriority = 3) {
    const cx = originX + w / 2;
    const cy = originY + h * 0.55;
    for (const peg of pegs) {
        const nx = Math.abs(peg.pos.x - cx) / Math.max(1, w / 2);
        const ny = Math.abs(peg.pos.y - cy) / Math.max(1, h / 2);
        const distance = nx + ny;
        peg.fusionPriority = Math.max(1, Math.round(maxPriority - distance));
        peg.layoutRole = peg.layoutRole || 'rune_focus';
    }
    return pegs;
}

export const MODULE_DEFS = {
    std_stagger: {
        id: 'std_stagger',
        name: '標準交錯',
        icon: '▦',
        desc: '3×3 普通釘子，標準交錯排列。',
        rarity: 'common',
        price: 0,
        build(ox, oy, w, h) {
            const pegs = generateStaggeredPegs(ox, oy, w, h, 3, 3, 'normal');
            return { pegs, specialSlots: [] };
        },
    },
    dense_stagger: {
        id: 'dense_stagger',
        name: '密集交錯',
        icon: '▩',
        desc: '4×3 密集普通釘子，弹珠碰撞次數多。',
        rarity: 'common',
        price: 0,
        build(ox, oy, w, h) {
            const pegs = generateStaggeredPegs(ox, oy, w, h, 4, 3, 'normal');
            return { pegs, specialSlots: [] };
        },
    },
    rune_lattice: {
        id: 'rune_lattice',
        name: 'Rune Lattice',
        icon: 'R',
        desc: '4x4 fusion-ready peg lattice. Rune fusion prefers its center pegs.',
        rarity: 'common',
        price: 0,
        build(ox, oy, w, h) {
            const pegs = generateStaggeredPegs(ox, oy, w, h, 4, 4, 'normal');
            markFusionFocus(pegs, ox, oy, w, h, 3);
            return { pegs, specialSlots: [] };
        },
    },
    bouncer: {
        id: 'bouncer',
        name: '反彈室',
        icon: '✦',
        desc: '中央 1 顆高彈性粉色釘子，弹珠在此區域劇烈反彈。',
        rarity: 'common',
        price: 0,
        build(ox, oy, w, h) {
            const pegs = generateStaggeredPegs(ox, oy, w, h, 3, 3, 'normal');
            if (pegs.length > 0) {
                let bestIdx = 0;
                let bestDist = Infinity;
                const cx = ox + w / 2;
                const cy = oy + h / 2;
                for (let i = 0; i < pegs.length; i++) {
                    const dx = pegs[i].pos.x - cx;
                    const dy = pegs[i].pos.y - cy;
                    const d = dx * dx + dy * dy;
                    if (d < bestDist) { bestDist = d; bestIdx = i; }
                }
                pegs[bestIdx].type = 'pink';
            }
            return { pegs, specialSlots: [] };
        },
    },
    funnel: {
        id: 'funnel',
        name: '漏斗',
        icon: '▽',
        desc: '頂寬底窄的三角形交錯，弹珠向中央匯集。占用 2×1 槽。',
        rarity: 'common',
        price: 0,
        span: { cols: 2, rows: 1 },
        build(ox, oy, w, h) {
            const pegs = generateFunnelPegs(ox, oy, w, h, 6, 3);
            return { pegs, specialSlots: [] };
        },
    },
    wheel_module: {
        id: 'wheel_module',
        name: '幸運轉盤',
        icon: '🎰',
        desc: '在底部生成一個 [輪盤槽]，弹珠穿越時觸發屬性翻倍輪盤。占用 1×2 槽。',
        rarity: 'rare',
        price: 60,
        span: { cols: 1, rows: 2 },
        build(ox, oy, w, h) {
            // 顶部 2 颗钉（原为3颗，间距w/4=21px导致弹珠卡死；改为2颗间距w/2≈43px）
            const pegs = [];
            for (let i = 0; i < 2; i++) {
                const p = new Peg(ox + w * (0.25 + i * 0.5), oy + h * 0.25, 'normal');
                p.level = 1; p.row = 0; p.col = i; pegs.push(p);
            }
            // 底部两颗钉子（用作 SpecialSlot 锚点）
            const pegA = new Peg(ox + w * 0.25, oy + h * 0.85, 'normal');
            pegA.row = 1; pegA.col = 0; pegA.level = 1;
            const pegB = new Peg(ox + w * 0.75, oy + h * 0.85, 'normal');
            pegB.row = 1; pegB.col = 1; pegB.level = 1;
            pegs.push(pegA, pegB);
            const slot = new SpecialSlot(pegA.pos.x, pegA.pos.y, pegB.pos.x, pegB.pos.y, 'wheel');
            return { pegs, specialSlots: [slot] };
        },
    },
    baffle: {
        id: 'baffle',
        name: '斜擋板',
        icon: '⫽',
        desc: '一排傾斜的粉色高彈性釘子，將弹珠導向側方。',
        rarity: 'rare',
        price: 50,
        build(ox, oy, w, h) {
            // 沿对角线排布 4 颗 pink 钉子模拟挡板
            const pegs = [];
            const steps = 4;
            for (let i = 0; i < steps; i++) {
                const t = i / (steps - 1);
                const x = ox + w * (0.15 + t * 0.7);
                const y = oy + h * (0.85 - t * 0.55);
                const p = new Peg(x, y, 'pink');
                p.row = 0; p.col = i; p.level = 1;
                pegs.push(p);
            }
            // 顶部 2 颗普通钉子提供初始反弹
            for (let i = 0; i < 2; i++) {
                const x = ox + w * (0.3 + i * 0.4);
                const y = oy + h * 0.15;
                const p = new Peg(x, y, 'normal');
                p.row = 1; p.col = i; p.level = 1;
                pegs.push(p);
            }
            return { pegs, specialSlots: [] };
        },
    },
    fixed_slot: {
        id: 'fixed_slot',
        name: '固定機關',
        icon: '◈',
        desc: '在固定位置生成一個特殊槽（連射/回溯/分裂依槽位輪換）。',
        rarity: 'epic',
        price: 80,
        build(ox, oy, w, h, ctx, slotIdx) {
            const pegs = generateStaggeredPegs(ox, oy, w, h, 3, 2, 'normal');
            let pegA = null, pegB = null;
            if (pegs.length >= 2) {
                const lastRow = pegs[pegs.length - 1].row;
                const bottomRowPegs = pegs.filter(p => p.row === lastRow).sort((a, b) => a.pos.x - b.pos.x);
                if (bottomRowPegs.length >= 2) {
                    // 取中间两颗钉作为特殊槽锚点，确保槽居中显示
                    const midIdx = Math.floor((bottomRowPegs.length - 1) / 2);
                    pegA = bottomRowPegs[midIdx];
                    pegB = bottomRowPegs[midIdx + 1];
                }
            }
            const specialSlots = [];
            if (pegA && pegB) {
                const types = ['multicast', 'recall', 'split'];
                const type = types[(slotIdx || 0) % types.length];
                specialSlots.push(new SpecialSlot(pegA.pos.x, pegA.pos.y, pegB.pos.x, pegB.pos.y, type));
            }
            return { pegs, specialSlots };
        },
    },
    cryo_pyro_pair: {
        id: 'cryo_pyro_pair',
        name: '冰火元素對',
        icon: '❄🔥',
        desc: '左 cryo + 右 pyro 固定釘子對，搭配普通釘子。無需融合。',
        rarity: 'rare',
        price: 70,
        build(ox, oy, w, h) {
            const pegs = generateStaggeredPegs(ox, oy, w, h, 3, 3, 'normal');
            const midRowPegs = pegs.filter(p => p.row === 1).sort((a, b) => a.pos.x - b.pos.x);
            if (midRowPegs.length >= 2) {
                midRowPegs[0].type = 'cryo';
                midRowPegs[midRowPegs.length - 1].type = 'pyro';
            }
            return { pegs, specialSlots: [] };
        },
    },
};

// ==================== [钉板形态遗物→模块] 由旧布局遗物迁移而来的模块 ====================
// 旧的钉板布局/行数遗物（dimension_shard / dimension_crystal / triangle_formation /
// diamond_formation / sparse_interval / mirror_sync / wide_narrow）在 v2 模块化下不再
// 通过 boardLayout / currentRows 整体改写钉盘，而是改造为可在单个模块槽位内放置的模块。
MODULE_DEFS.triangle_module = {
    id: 'triangle_module',
    name: '三角陣形',
    icon: '🔺',
    desc: '頂寬底窄的三角交錯，弹珠向中心聚焦。',
    rarity: 'rare',
    price: 60,
    build(ox, oy, w, h) {
        const pegs = generateFunnelPegs(ox, oy, w, h, 4, 4);
        return { pegs, specialSlots: [] };
    },
};
MODULE_DEFS.diamond_module = {
    id: 'diamond_module',
    name: '菱形陣形',
    icon: '🔷',
    desc: '上下窄、中段寬的菱形排布，中段碰撞密集。',
    rarity: 'epic',
    price: 80,
    build(ox, oy, w, h) {
        const pegs = [];
        const rows = 5;
        const spacingY = h / (rows + 0.5);
        const widths = [2, 3, 4, 3, 2];
        const maxColsForW = Math.max(1, Math.floor((w * 0.85) / MIN_PEG_SPACING));
        for (let r = 0; r < rows; r++) {
            const colsThisRow = Math.min(widths[r], maxColsForW);
            const spacingX = colsThisRow > 1 ? (w * 0.85) / colsThisRow : w * 0.85;
            const baseLeftPad = (w - (colsThisRow - 1) * spacingX) / 2;
            for (let c = 0; c < colsThisRow; c++) {
                const x = ox + baseLeftPad + c * spacingX;
                const y = oy + spacingY * 0.5 + r * spacingY;
                const p = new Peg(x, y, 'normal');
                p.row = r; p.col = c; p.level = 1;
                pegs.push(p);
            }
        }
        return { pegs, specialSlots: [] };
    },
};
MODULE_DEFS.sparse_module = {
    id: 'sparse_module',
    name: '稀疏間隔',
    icon: '〰️',
    desc: '寬窄行交替形成通道；底部一排粉色高彈性釘子。',
    rarity: 'rare',
    price: 60,
    build(ox, oy, w, h) {
        const rows = 4;
        const spacingY = h / (rows + 0.5);
        const maxCols = Math.max(1, Math.floor(w / MIN_PEG_SPACING));
        const pegs = [];
        for (let r = 0; r < rows; r++) {
            const cols = Math.min((r % 2 === 0) ? 4 : 2, maxCols);
            const spacingX = cols > 1 ? w / cols : w;
            const pad = (w - (cols - 1) * spacingX) / 2;
            const isLastRow = r === rows - 1;
            for (let c = 0; c < cols; c++) {
                const x = ox + pad + c * spacingX;
                const y = oy + spacingY * 0.5 + r * spacingY;
                const p = new Peg(x, y, isLastRow ? 'pink' : 'normal');
                p.row = r; p.col = c; p.level = 1;
                pegs.push(p);
            }
        }
        return { pegs, specialSlots: [] };
    },
};
MODULE_DEFS.mirror_module = {
    id: 'mirror_module',
    name: '鏡像同步',
    icon: '🪞',
    desc: '左右對稱排列。中軸高彈釘子使弹珠頻繁鏡像反彈。',
    rarity: 'epic',
    price: 80,
    build(ox, oy, w, h) {
        const pegs = generateStaggeredPegs(ox, oy, w, h, 3, 3, 'normal');
        // 中轴（col=1）的钉子改为粉色高弹，模拟"镜像裂分"近似效果
        for (const p of pegs) {
            if (p.col === 1) p.type = 'pink';
        }
        return { pegs, specialSlots: [] };
    },
};
MODULE_DEFS.wide_narrow_module = {
    id: 'wide_narrow_module',
    name: '寬窄交替',
    icon: '📐',
    desc: '偶數行寬、奇數行窄，邊緣捕獲偏離弹珠。',
    rarity: 'common',
    price: 40,
    build(ox, oy, w, h) {
        const rows = 4;
        const spacingY = h / (rows + 0.5);
        const maxCols = Math.max(1, Math.floor(w / MIN_PEG_SPACING));
        const pegs = [];
        for (let r = 0; r < rows; r++) {
            const cols = Math.min((r % 2 === 0) ? 5 : 2, maxCols);
            const spacingX = cols > 1 ? w / cols : w;
            const pad = (w - (cols - 1) * spacingX) / 2;
            for (let c = 0; c < cols; c++) {
                const x = ox + pad + c * spacingX;
                const y = oy + spacingY * 0.5 + r * spacingY;
                const p = new Peg(x, y, 'normal');
                p.row = r; p.col = c; p.level = 1;
                pegs.push(p);
            }
        }
        return { pegs, specialSlots: [] };
    },
};
MODULE_DEFS.dim_shard_module = {
    id: 'dim_shard_module',
    name: '維度碎片',
    icon: '🌌',
    desc: '更高密度的 4×4 交錯釘子，碰撞次數倍增。',
    rarity: 'rare',
    price: 60,
    build(ox, oy, w, h) {
        const pegs = generateStaggeredPegs(ox, oy, w, h, 4, 4, 'normal');
        return { pegs, specialSlots: [] };
    },
};
MODULE_DEFS.dim_crystal_module = {
    id: 'dim_crystal_module',
    name: '維度結晶',
    icon: '💠',
    desc: '極高密度 5×5 交錯釘子，弹珠路徑充滿碰撞。',
    rarity: 'legendary',
    price: 120,
    build(ox, oy, w, h) {
        const pegs = generateStaggeredPegs(ox, oy, w, h, 5, 5, 'normal');
        return { pegs, specialSlots: [] };
    },
};

// ==================== [属性钉板] 商店随机属性钉板 ====================
// 每个属性对应一个 attr_pin_<type> 模块，所有 normal 钉子被强制赋予该属性，
// 且不参与 unlockedWeights 随机覆盖（applyWeightedPegTypes 仅替换 type === 'normal'）。
MODULE_DEFS.rune_focus_module = {
    id: 'rune_focus_module',
    name: 'Rune Focus',
    icon: 'F',
    desc: 'A compact fusion chamber. Consumed runes strongly prefer the inner ring.',
    rarity: 'rare',
    price: 70,
    build(ox, oy, w, h) {
        const pegs = generateStaggeredPegs(ox, oy, w, h, 5, 4, 'normal');
        markFusionFocus(pegs, ox, oy, w, h, 4);
        for (const peg of pegs) {
            if (peg.fusionPriority >= 3) peg.level = 2;
        }
        return { pegs, specialSlots: [] };
    },
};

MODULE_DEFS.split_gate_module = {
    id: 'split_gate_module',
    name: 'Split Gate',
    icon: 'S',
    desc: 'A narrow center split slot framed by four guide pegs.',
    rarity: 'rare',
    price: 75,
    build(ox, oy, w, h) {
        const pegs = [
            new Peg(ox + w * 0.28, oy + h * 0.22, 'normal'),
            new Peg(ox + w * 0.72, oy + h * 0.22, 'normal'),
            new Peg(ox + w * 0.28, oy + h * 0.78, 'normal'),
            new Peg(ox + w * 0.72, oy + h * 0.78, 'normal'),
        ];
        pegs.forEach((p, i) => { p.row = Math.floor(i / 2); p.col = i % 2; p.level = 1; });
        const specialSlots = [new SpecialSlot(ox + w * 0.32, oy + h * 0.5, ox + w * 0.68, oy + h * 0.5, 'split')];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.recall_loop_module = {
    id: 'recall_loop_module',
    name: 'Recall Loop',
    icon: 'U',
    desc: 'Pink bumpers wrap a recall slot, giving lucky balls another pass.',
    rarity: 'epic',
    price: 90,
    build(ox, oy, w, h) {
        const pegs = [
            new Peg(ox + w * 0.22, oy + h * 0.25, 'pink'),
            new Peg(ox + w * 0.78, oy + h * 0.25, 'pink'),
            new Peg(ox + w * 0.34, oy + h * 0.72, 'normal'),
            new Peg(ox + w * 0.66, oy + h * 0.72, 'normal'),
        ];
        pegs.forEach((p, i) => { p.row = Math.floor(i / 2); p.col = i % 2; p.level = 1; });
        const specialSlots = [new SpecialSlot(ox + w * 0.34, oy + h * 0.55, ox + w * 0.66, oy + h * 0.55, 'recall')];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.cascade_bank_module = {
    id: 'cascade_bank_module',
    name: 'Cascade Bank',
    icon: 'K',
    desc: 'Alternating pink rails create a stair-step ricochet path.',
    rarity: 'rare',
    price: 65,
    build(ox, oy, w, h) {
        const pegs = [];
        for (let i = 0; i < 5; i++) {
            const t = i / 4;
            const p = new Peg(ox + w * (0.18 + t * 0.64), oy + h * (0.18 + t * 0.64), i % 2 === 0 ? 'pink' : 'normal');
            p.row = i;
            p.col = i;
            p.level = 1;
            pegs.push(p);
        }
        for (let i = 0; i < 3; i++) {
            const p = new Peg(ox + w * (0.72 - i * 0.18), oy + h * (0.24 + i * 0.24), 'normal');
            p.row = i;
            p.col = 5 - i;
            p.level = 1;
            pegs.push(p);
        }
        return { pegs, specialSlots: [] };
    },
};

MODULE_DEFS.crucible_core_module = {
    id: 'crucible_core_module',
    name: 'Crucible Core',
    icon: 'C',
    desc: 'A fixed cryo/pyro/damage triangle with fusion-friendly center pegs.',
    rarity: 'epic',
    price: 95,
    build(ox, oy, w, h) {
        const pegs = generateStaggeredPegs(ox, oy, w, h, 3, 3, 'normal');
        const byPos = [...pegs].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);
        if (byPos[1]) byPos[1].type = 'cryo';
        if (byPos[4]) byPos[4].type = 'damage';
        if (byPos[7]) byPos[7].type = 'pyro';
        markFusionFocus(pegs.filter(p => p.type === 'normal'), ox, oy, w, h, 3);
        return { pegs, specialSlots: [] };
    },
};

MODULE_DEFS.double_wheel_module = {
    id: 'double_wheel_module',
    name: 'Twin Wheel',
    icon: 'W',
    desc: 'Two wheel slots across a 2x1 chamber for swingy reward routing.',
    rarity: 'legendary',
    price: 130,
    span: { cols: 2, rows: 1 },
    build(ox, oy, w, h) {
        const pegs = [];
        const anchors = [
            [0.18, 0.78], [0.36, 0.78],
            [0.64, 0.78], [0.82, 0.78],
            [0.30, 0.28], [0.70, 0.28],
        ];
        anchors.forEach(([px, py], i) => {
            const p = new Peg(ox + w * px, oy + h * py, i < 4 ? 'normal' : 'pink');
            p.row = Math.floor(i / 2);
            p.col = i % 2;
            p.level = 1;
            pegs.push(p);
        });
        const specialSlots = [
            new SpecialSlot(ox + w * 0.18, oy + h * 0.78, ox + w * 0.36, oy + h * 0.78, 'wheel'),
            new SpecialSlot(ox + w * 0.64, oy + h * 0.78, ox + w * 0.82, oy + h * 0.78, 'wheel'),
        ];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.fusion_garden_module = {
    id: 'fusion_garden_module',
    name: 'Fusion Garden',
    icon: 'G',
    desc: 'A broad 2x1 lattice that gives rune fusion many high-value targets.',
    rarity: 'rare',
    price: 85,
    span: { cols: 2, rows: 1 },
    build(ox, oy, w, h) {
        const pegs = generateStaggeredPegs(ox, oy, w, h, 6, 3, 'normal');
        markFusionFocus(pegs, ox, oy, w, h, 4);
        return { pegs, specialSlots: [] };
    },
};

export const ATTR_PIN_TYPES = ['bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro', 'wind'];
const ATTR_PIN_META = {
    bounce: { name: '彈性釘板', icon: '🔵' },
    pierce: { name: '穿透釘板', icon: '↗' },
    scatter: { name: '散射釘板', icon: '🔱' },
    damage: { name: '增幅釘板', icon: '⚔️' },
    cryo:   { name: '冰霜釘板', icon: '❄️' },
    pyro:   { name: '火焰釘板', icon: '🔥' },
    wind:   { name: '疾風釘板', icon: '💨' },
};
ATTR_PIN_TYPES.forEach(type => {
    const meta = ATTR_PIN_META[type];
    MODULE_DEFS[`attr_pin_${type}`] = {
        id: `attr_pin_${type}`,
        name: meta.name,
        icon: meta.icon,
        desc: `3×3 釘板，全部釘子強制為「${type}」屬性。`,
        rarity: 'rare',
        price: 0, // 由商店动态定价；不通过通用 module 列表暴露
        attribute: type,
        isAttrPin: true,
        build(ox, oy, w, h) {
            const pegs = generateStaggeredPegs(ox, oy, w, h, 3, 3, type);
            return { pegs, specialSlots: [] };
        },
    };
});

const DEFAULT_MODULE_SEQUENCE = [
    'dense_stagger', 'rune_lattice', 'dense_stagger', 'bouncer',
    'std_stagger', 'dense_stagger', 'rune_lattice', 'dense_stagger',
    'bouncer', 'std_stagger', 'dense_stagger', 'rune_lattice',
];

export function createDefaultModuleLayout(totalSlots, activeSlots = CONFIG.gameplay.moduleDefaultSlots || 3) {
    const count = Math.max(0, totalSlots || DEFAULT_MODULE_SEQUENCE.length);
    const activeCount = Math.max(0, Math.min(activeSlots || 0, count));
    return Array.from({ length: count }, (_, i) => {
        if (i >= activeCount) return null;
        return createModuleInstance(DEFAULT_MODULE_SEQUENCE[i % DEFAULT_MODULE_SEQUENCE.length]);
    });
}

/**
 * 主入口：根据模块 ID 在指定矩形内构造实体集合
 */
export function selectFusionTargetPegs(pegs, fusion, canvasWidth, canvasHeight, randomize = false) {
    if (!Array.isArray(pegs) || !fusion || !fusion.count) return [];
    const blanks = pegs.filter(p => p && p.type === 'normal');
    const targetCount = Math.min(fusion.count, blanks.length);
    const boardCenterX = (canvasWidth || 400) / 2;
    const width = Math.max(1, canvasWidth || 400);
    const height = Math.max(1, canvasHeight || 600);
    const ranked = blanks.map(peg => ({ peg, tie: randomize ? Math.random() : 0 }));
    ranked.sort((a, b) => {
        const priorityDiff = (b.peg.fusionPriority || 0) - (a.peg.fusionPriority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        const ay = (a.peg.pos.y || 0) / height;
        const by = (b.peg.pos.y || 0) / height;
        const ax = Math.abs((a.peg.pos.x || 0) - boardCenterX) / width;
        const bx = Math.abs((b.peg.pos.x || 0) - boardCenterX) / width;
        const valueDiff = (by - bx * 0.35) - (ay - ax * 0.35);
        if (valueDiff !== 0) return valueDiff;
        return b.tie - a.tie;
    });
    return ranked.slice(0, targetCount).map(item => item.peg);
}

function applyModulePegStates(pegs, ctx, moduleInstance) {
    const states = moduleInstance ? (moduleInstance.pegStates || (moduleInstance.pegStates = {})) : null;
    for (let i = 0; i < (pegs || []).length; i++) {
        const peg = pegs[i];
        if (!peg) continue;
        peg.modulePegIdx = i;
        const key = String(i);
        const saved = states ? states[key] : null;
        if (saved && peg.type === 'normal') {
            peg.type = saved.type || peg.type;
            peg.level = saved.level || peg.level || 1;
            if (saved.infusedRuneId) peg.infusedRuneId = saved.infusedRuneId;
            if (saved.fusionSourceLevel) peg.fusionSourceLevel = saved.fusionSourceLevel;
            continue;
        }
        if (peg.type === 'normal') {
            peg.type = getRandomPegTypeFromWeights(ctx && ctx.unlockedWeights);
            peg.level = peg.level || 1;
            if (states) {
                states[key] = {
                    type: peg.type,
                    level: peg.level,
                    source: 'generated',
                };
            }
        } else {
            peg.level = peg.level || 1;
        }
    }
    return pegs;
}

export function setModulePegState(moduleEntry, peg, state) {
    const instance = getModuleInstance(moduleEntry);
    if (!instance || !peg || peg.modulePegIdx === undefined) return false;
    if (!instance.pegStates) instance.pegStates = {};
    instance.pegStates[String(peg.modulePegIdx)] = {
        ...(instance.pegStates[String(peg.modulePegIdx)] || {}),
        ...state,
    };
    return true;
}

export function buildModuleEntities(moduleEntry, originX, originY, width, height, ctx, slotIdx) {
    const moduleId = getModuleIdFromEntry(moduleEntry);
    const def = MODULE_DEFS[moduleId];
    if (!def) {
        return { pegs: [], specialSlots: [] };
    }
    const result = def.build(originX, originY, width, height, ctx, slotIdx);
    applyModulePegStates(result.pegs, ctx, getModuleInstance(moduleEntry));
    return result;
}

/**
 * 计算单个模块槽位的矩形（基于画布尺寸和 CONFIG.gameplay）
 * span: { cols, rows } 多格模块占位（默认 1×1）
 */
export function calcModuleSlotRect(slotIdx, canvasWidth, canvasHeight, cfg, span) {
    const cols = cfg.moduleCols || 4;
    const rows = cfg.moduleRows || 3;
    const topY = cfg.moduleAreaTopY || 60;
    const bottomMargin = cfg.moduleAreaBottomMargin || 80;
    const spacingX = cfg.moduleSpacingX || 4;
    const spacingY = cfg.moduleSpacingY || 4;
    // 左右两侧距墙 1.5 个弹珠直径，使倍化弹珠不会与墙完全贴死
    const sideMargin = (cfg.moduleAreaSideMargin != null) ? cfg.moduleAreaSideMargin : 23;
    const totalW = canvasWidth - 2 * sideMargin;
    const totalH = Math.max(120, canvasHeight - topY - bottomMargin);
    const cellW = (totalW - (cols - 1) * spacingX) / cols;
    const cellH = (totalH - (rows - 1) * spacingY) / rows;
    const r = Math.floor(slotIdx / cols);
    const c = slotIdx % cols;
    const sCols = (span && span.cols) ? span.cols : 1;
    const sRows = (span && span.rows) ? span.rows : 1;
    return {
        x: sideMargin + c * (cellW + spacingX),
        y: topY + r * (cellH + spacingY),
        w: cellW * sCols + spacingX * (sCols - 1),
        h: cellH * sRows + spacingY * (sRows - 1),
    };
}

/**
 * 获取模块的占位（多格）。默认 1×1。
 */
export function getModuleSpan(moduleId) {
    const def = MODULE_DEFS[moduleId];
    if (def && def.span) {
        return { cols: def.span.cols || 1, rows: def.span.rows || 1 };
    }
    return { cols: 1, rows: 1 };
}

/**
 * 给定锚点 slotIdx 和 span，返回所有覆盖到的 slot 索引（含锚点本身）。
 * 若超出网格边界则返回 null。
 */
export function getCoveredSlots(anchorIdx, span, totalCols, totalRows) {
    const sCols = (span && span.cols) ? span.cols : 1;
    const sRows = (span && span.rows) ? span.rows : 1;
    const ar = Math.floor(anchorIdx / totalCols);
    const ac = anchorIdx % totalCols;
    if (ar + sRows > totalRows || ac + sCols > totalCols) return null;
    const out = [];
    for (let r = 0; r < sRows; r++) {
        for (let c = 0; c < sCols; c++) {
            out.push((ar + r) * totalCols + (ac + c));
        }
    }
    return out;
}

/**
 * 列出所有可放置的模块 ID（受 unlockedModuleTypes 限制）
 */
export function listAvailableModules(unlockedModuleTypes) {
    return (unlockedModuleTypes || []).filter(id => MODULE_DEFS[id]);
}
