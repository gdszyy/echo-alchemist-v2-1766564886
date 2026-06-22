/**
 * pinboard_modules.js - 钉板模块化（v2 养成深化）
 *
 * 钉板由 4×3 = 12 个模块槽组成。每个模块在自己的矩形区域内独立生成
 * 一组实体（普通钉子、特殊钉子、固定特殊槽等）。
 *
 * 主入口：buildModuleEntities(moduleEntry, originX, originY, w, h, ctx, slotIdx)
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
 *   - baffle 模块使用 barrier 形态的异形钉，避免用近距离圆钉拼挡板造成卡球
 *   - fixed_slot 模块复用 SpecialSlot 类（multicast/recall/split 轮换）
 */

import { CONFIG } from './config.js';
import { Peg, SpecialSlot } from './entities.js';

// 与 game_phase.phase_gathering_getRandomPegType 保持一致：
// 初始随机属性钉只保留纯净弹珠属性；wind 是变异属性，不参与初始化随机刷新。
const RANDOMIZABLE_PEG_TYPES = ['bounce', 'damage'];

const PEG_RADIUS = CONFIG.physics.pegRadius || 4;
const MARBLE_RADIUS = CONFIG.physics.marbleRadius || 5.8;
const MAX_MARBLE_RADIUS = MARBLE_RADIUS + (CONFIG.physics.maxMarbleSizeBonus || 0);
const PINBOARD_SPACING_BUFFER = CONFIG.physics.pinboardSpacingBuffer || 1;
// @perf-impact: Denser modules can raise Peg count; expensive Peg shadow/halo drawing remains gated by CONFIG.performance.
// Circle peg center spacing must pass size-up marbles; baffles should use barrier pegs, not tight circle pairs.
const MIN_PEG_SPACING = 2 * PEG_RADIUS + 2 * MAX_MARBLE_RADIUS + PINBOARD_SPACING_BUFFER;

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

export function normalizeModuleInventory(inventory) {
    if (!Array.isArray(inventory)) return [];
    return inventory
        .map(entry => normalizeModuleEntry(entry))
        .filter(entry => entry && !isModuleRef(entry) && getModuleIdFromEntry(entry));
}

export function addModuleComponentToInventory(inventory, moduleId) {
    const next = normalizeModuleInventory(inventory);
    if (MODULE_DEFS[moduleId]) next.push(createModuleInstance(moduleId));
    return next;
}

function getDefaultSlotOrder(totalSlots, cfg = CONFIG.gameplay || {}) {
    const count = Math.max(0, totalSlots || 0);
    const configured = Array.isArray(cfg.moduleUnlockOrder) ? cfg.moduleUnlockOrder : [];
    const out = [];
    const seen = new Set();
    for (const raw of configured) {
        const idx = Number(raw);
        if (!Number.isInteger(idx) || idx < 0 || idx >= count || seen.has(idx)) continue;
        seen.add(idx);
        out.push(idx);
    }
    for (let i = 0; i < count; i++) {
        if (!seen.has(i)) out.push(i);
    }
    return out;
}

export function getActiveModuleSlots(unlockedSlots, totalSlots, cfg = CONFIG.gameplay || {}) {
    const count = Math.max(0, totalSlots || 0);
    const activeCount = Math.max(0, Math.min(unlockedSlots || 0, count));
    return getDefaultSlotOrder(count, cfg).slice(0, activeCount);
}

export function getActiveModuleSlotSet(unlockedSlots, totalSlots, cfg = CONFIG.gameplay || {}) {
    return new Set(getActiveModuleSlots(unlockedSlots, totalSlots, cfg));
}

function migrateModuleLayoutToCurrentGrid(layout, totalSlots, defaultSlots) {
    const count = Math.max(0, totalSlots || 0);
    if (!Array.isArray(layout)) return createDefaultModuleLayout(count, defaultSlots);
    const normalized = layout.map(entry => normalizeModuleEntry(entry));
    if (normalized.length === count) return Array.from({ length: count }, (_, i) => normalized[i] || null);

    const next = Array.from({ length: count }, () => null);
    const order = getDefaultSlotOrder(count);
    const anchors = normalized.filter(entry => entry && !isModuleRef(entry) && getModuleIdFromEntry(entry));
    const occupied = new Set();
    for (const component of anchors) {
        const moduleId = getModuleIdFromEntry(component);
        const span = getModuleSpan(moduleId);
        let placed = false;
        for (const slotIdx of order) {
            const covered = getCoveredSlots(slotIdx, span, CONFIG.gameplay.moduleCols || 5, CONFIG.gameplay.moduleRows || 3);
            if (!covered || covered.some(ci => occupied.has(ci) || ci >= count)) continue;
            next[slotIdx] = component;
            for (const ci of covered) {
                occupied.add(ci);
                if (ci !== slotIdx) next[ci] = createModuleRef(slotIdx);
            }
            placed = true;
            break;
        }
        if (!placed) break;
    }
    if (anchors.length === 0) return createDefaultModuleLayout(count, defaultSlots);
    return next;
}

function shouldResetLegacyStarterLayout(layout, totalSlots, defaultSlots) {
    if (!Array.isArray(layout)) return false;
    const activeSlots = getActiveModuleSlots(defaultSlots, totalSlots);
    const isOldWideDefault = activeSlots.every(slotIdx => {
        const entry = normalizeModuleEntry(layout[slotIdx]);
        if (slotIdx === 0) return getModuleIdFromEntry(entry) === 'caret_wheel_field';
        return isModuleRef(entry) && entry.ref === 0;
    });
    if (isOldWideDefault) return true;
    const isStarterStitchDefault = activeSlots.every(slotIdx => {
        const entry = normalizeModuleEntry(layout[slotIdx]);
        const moduleId = getModuleIdFromEntry(entry);
        return typeof moduleId === 'string' && moduleId.startsWith('starter_');
    });
    if (isStarterStitchDefault) return true;

    const legacyBySlot = new Map([
        [0, 'guide_fin_left'],
        [1, 'split_lattice_bridge'],
        [3, 'multicast_gate_light'],
        [4, 'guide_fin_right'],
        [5, 'recall_loop_light'],
        [6, 'bounce_chamber'],
        [7, 'crucible_seed'],
        [8, 'catcher_cup'],
        [9, 'wheel_cup_light'],
    ]);
    return activeSlots.every(slotIdx => {
        const entry = normalizeModuleEntry(layout[slotIdx]);
        if (slotIdx === 2) return isModuleRef(entry) && entry.ref === 1;
        if (!legacyBySlot.has(slotIdx)) return !entry;
        return getModuleIdFromEntry(entry) === legacyBySlot.get(slotIdx);
    });
}

export function ensureModuleLayoutInstances(layout, totalSlots, defaultSlots = CONFIG.gameplay.moduleDefaultSlots || 3) {
    const count = Math.max(0, totalSlots || DEFAULT_MODULE_SEQUENCE.length);
    let source = Array.isArray(layout)
        ? migrateModuleLayoutToCurrentGrid(layout, count, defaultSlots)
        : createDefaultModuleLayout(count, defaultSlots);
    if (shouldResetLegacyStarterLayout(source, count, defaultSlots)) {
        source = createDefaultModuleLayout(count, defaultSlots);
    }
    const next = Array.from({ length: count }, (_, i) => normalizeModuleEntry(source[i]));
    const defaultLayout = createDefaultModuleLayout(count, defaultSlots);
    for (const slotIdx of getActiveModuleSlots(defaultSlots, count)) {
        if (next[slotIdx]) continue;
        const fallback = normalizeModuleEntry(defaultLayout[slotIdx]);
        if (fallback && !isModuleRef(fallback)) next[slotIdx] = fallback;
    }
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

function makePegAt(ox, oy, w, h, px, py, type = 'normal', row = 0, col = 0) {
    const peg = new Peg(ox + w * px, oy + h * py, type);
    peg.row = row;
    peg.col = col;
    peg.level = 1;
    return peg;
}

function makeBarrierAt(ox, oy, w, h, ax, ay, bx, by, type = 'pink', row = 0, col = 0) {
    const x1 = ox + w * ax;
    const y1 = oy + h * ay;
    const x2 = ox + w * bx;
    const y2 = oy + h * by;
    const peg = new Peg((x1 + x2) / 2, (y1 + y2) / 2, type);
    peg.shape = 'barrier';
    peg.segment = { x1, y1, x2, y2 };
    peg.thickness = Math.max(PEG_RADIUS * 2.15, 8.5);
    peg.radius = peg.thickness / 2;
    peg.row = row;
    peg.col = col;
    peg.level = 1;
    return peg;
}

function hasNearbyPeg(pegs, x, y, minDistance) {
    return pegs.some(peg => peg && peg.shape !== 'barrier' && peg.pos && Math.hypot(peg.pos.x - x, peg.pos.y - y) < minDistance);
}

const SEAMED_STARTER_MODULES = new Set([
    'guide_fin_left',
    'guide_fin_right',
    'split_lattice_bridge',
    'multicast_gate_light',
    'recall_loop_light',
    'bounce_chamber',
    'crucible_seed',
    'catcher_cup',
    'wheel_cup_light',
]);

// @perf-impact: Seam pegs increase default Peg count to close gaps between adjacent modules; Peg shadow/halo remains CONFIG.performance gated.
function addModuleSeamPegs(pegs, ox, oy, w, h, moduleId) {
    if (!SEAMED_STARTER_MODULES.has(moduleId)) return pegs;
    const role = `${moduleId}_seam`;
    const seamPoints = [
        [0.12, 0.24], [0.88, 0.36], [0.12, 0.62], [0.88, 0.74],
        [0.32, 0.08], [0.68, 0.08], [0.32, 0.94], [0.68, 0.94],
    ];
    const minDistance = MIN_PEG_SPACING;
    seamPoints.forEach(([px, py], i) => {
        const x = ox + w * px;
        const y = oy + h * py;
        if (hasNearbyPeg(pegs, x, y, minDistance)) return;
        const peg = makePegAt(ox, oy, w, h, px, py, 'normal', 10 + Math.floor(i / 2), 10 + i);
        peg.layoutRole = role;
        pegs.push(peg);
    });
    return pegs;
}

function enforceCirclePegSpacing(pegs, minDistance = MIN_PEG_SPACING) {
    const kept = [];
    for (const peg of pegs || []) {
        if (!peg || peg.shape === 'barrier') {
            kept.push(peg);
            continue;
        }
        if (hasNearbyPeg(kept, peg.pos.x, peg.pos.y, minDistance)) continue;
        kept.push(peg);
    }
    return kept;
}

function buildGuideFin(ox, oy, w, h, mirror = false) {
    const pegs = [];
    const barrier = mirror
        ? makeBarrierAt(ox, oy, w, h, 0.78, 0.16, 0.20, 0.82, 'pink', 0, 0)
        : makeBarrierAt(ox, oy, w, h, 0.22, 0.16, 0.80, 0.82, 'pink', 0, 0);
    barrier.layoutRole = mirror ? 'guide_fin_right_barrier' : 'guide_fin_left_barrier';
    pegs.push(barrier);
    const rail = mirror
        ? [[0.88, 0.24], [0.58, 0.50], [0.24, 0.78]]
        : [[0.12, 0.24], [0.42, 0.50], [0.76, 0.78]];
    rail.forEach(([px, py], i) => {
        const peg = makePegAt(ox, oy, w, h, px, py, i === 1 || i === 3 ? 'pink' : 'normal', i, i);
        peg.layoutRole = mirror ? 'guide_fin_right' : 'guide_fin_left';
        pegs.push(peg);
    });
    const guardX = mirror ? 0.25 : 0.75;
    const guard = makePegAt(ox, oy, w, h, guardX, 0.32, 'wind', 0, 5);
    guard.layoutRole = mirror ? 'guide_fin_right' : 'guide_fin_left';
    pegs.push(guard);
    const weave = mirror
        ? [[0.78, 0.44], [0.58, 0.74], [0.34, 0.24]]
        : [[0.22, 0.44], [0.42, 0.74], [0.66, 0.24]];
    weave.forEach(([px, py], i) => {
        const peg = makePegAt(ox, oy, w, h, px, py, 'normal', i + 1, i + 6);
        peg.layoutRole = mirror ? 'guide_fin_right' : 'guide_fin_left';
        pegs.push(peg);
    });
    const fill = mirror
        ? [[0.86, 0.62], [0.54, 0.10], [0.18, 0.70]]
        : [[0.14, 0.62], [0.46, 0.10], [0.82, 0.70]];
    fill.forEach(([px, py], i) => {
        const peg = makePegAt(ox, oy, w, h, px, py, 'normal', i + 2, i + 9);
        peg.layoutRole = mirror ? 'guide_fin_right' : 'guide_fin_left';
        pegs.push(peg);
    });
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
            const pegs = generateStaggeredPegs(ox, oy, w, h, 4, 6, 'normal');
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
            const pegs = [];
            const barrier = makeBarrierAt(ox, oy, w, h, 0.16, 0.82, 0.84, 0.28, 'pink', 0, 0);
            barrier.layoutRole = 'baffle_barrier';
            pegs.push(barrier);
            // 顶部 2 颗普通钉子提供初始反弹
            for (let i = 0; i < 2; i++) {
                const x = ox + w * (0.25 + i * 0.5);
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
    guide_fin_left: {
        id: 'guide_fin_left',
        name: '左导流翼',
        icon: '↘',
        desc: '斜向弹钉翼，把左侧入口的弹珠导回中轴。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'fin-left', entry: 'top-left', exit: 'bottom-center' },
        build(ox, oy, w, h) {
            return { pegs: buildGuideFin(ox, oy, w, h, false), specialSlots: [] };
        },
    },
    guide_fin_right: {
        id: 'guide_fin_right',
        name: '右导流翼',
        icon: '↙',
        desc: '与左导流翼镜像，把右侧入口的弹珠导回中轴。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'fin-right', entry: 'top-right', exit: 'bottom-center' },
        build(ox, oy, w, h) {
            return { pegs: buildGuideFin(ox, oy, w, h, true), specialSlots: [] };
        },
    },
    split_lattice_bridge: {
        id: 'split_lattice_bridge',
        name: '分裂符文桥',
        icon: 'R⑂',
        desc: '2x1 宽幅异形桥，左侧分裂槽接右侧符文格，兼顾路线拆分与融合承载。',
        rarity: 'common',
        price: 0,
        span: { cols: 2, rows: 1 },
        shape: { footprint: 'bridge', entry: 'top', exit: 'split' },
        build(ox, oy, w, h) {
            const anchors = [
                [0.10, 0.18, 'normal'], [0.24, 0.12, 'normal'], [0.38, 0.18, 'normal'], [0.52, 0.12, 'normal'], [0.68, 0.18, 'normal'], [0.86, 0.16, 'normal'],
                [0.16, 0.36, 'pink'], [0.34, 0.42, 'pink'], [0.50, 0.36, 'normal'], [0.66, 0.42, 'normal'], [0.84, 0.36, 'normal'],
                [0.12, 0.58, 'normal'], [0.28, 0.64, 'normal'], [0.44, 0.58, 'normal'], [0.60, 0.64, 'normal'], [0.78, 0.58, 'normal'], [0.92, 0.64, 'normal'],
                [0.20, 0.84, 'normal'], [0.36, 0.90, 'normal'], [0.52, 0.84, 'normal'], [0.68, 0.90, 'normal'], [0.84, 0.84, 'normal'],
            ];
            const pegs = anchors.map(([px, py, type], i) => {
                const peg = makePegAt(ox, oy, w, h, px, py, type, Math.floor(i / 6), i % 6);
                peg.layoutRole = 'split_lattice_bridge';
                return peg;
            });
            [
                makeBarrierAt(ox, oy, w, h, 0.14, 0.34, 0.40, 0.54, 'pink', 1, 6),
                makeBarrierAt(ox, oy, w, h, 0.58, 0.34, 0.88, 0.58, 'pink', 1, 7),
            ].forEach(peg => {
                peg.layoutRole = 'split_lattice_bridge_barrier';
                pegs.push(peg);
            });
            markFusionFocus(pegs.filter(p => p.type === 'normal'), ox, oy, w, h, 3);
            const specialSlots = [new SpecialSlot(ox + w * 0.18, oy + h * 0.50, ox + w * 0.42, oy + h * 0.50, 'split')];
            return { pegs, specialSlots };
        },
    },
    rune_lattice_light: {
        id: 'rune_lattice_light',
        name: '轻符文格',
        icon: 'R',
        desc: '小菱格融合承载，中心钉优先接收符文注入。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'diamond', entry: 'top', exit: 'bottom' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.50, 0.18, 'normal', 0, 1),
                makePegAt(ox, oy, w, h, 0.36, 0.28, 'normal', 0, 0),
                makePegAt(ox, oy, w, h, 0.64, 0.28, 'normal', 0, 2),
                makePegAt(ox, oy, w, h, 0.30, 0.40, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.70, 0.40, 'normal', 1, 2),
                makePegAt(ox, oy, w, h, 0.50, 0.50, 'normal', 1, 1),
                makePegAt(ox, oy, w, h, 0.18, 0.58, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.42, 0.64, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.58, 0.64, 'normal', 2, 2),
                makePegAt(ox, oy, w, h, 0.82, 0.58, 'normal', 2, 3),
                makePegAt(ox, oy, w, h, 0.30, 0.76, 'normal', 3, 0),
                makePegAt(ox, oy, w, h, 0.70, 0.76, 'normal', 3, 2),
                makePegAt(ox, oy, w, h, 0.50, 0.84, 'normal', 3, 1),
            ];
            markFusionFocus(pegs, ox, oy, w, h, 3);
            return { pegs, specialSlots: [] };
        },
    },
    bounce_chamber: {
        id: 'bounce_chamber',
        name: '弹跳室',
        icon: '◇',
        desc: '低密度反弹腔，中心高弹钉制造清晰的第一次改向。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'chamber', entry: 'top', exit: 'split' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.28, 0.24, 'normal', 0, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.20, 'normal', 0, 1),
                makePegAt(ox, oy, w, h, 0.72, 0.24, 'normal', 0, 2),
                makePegAt(ox, oy, w, h, 0.24, 0.48, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.38, 0.38, 'pink', 1, 1),
                makePegAt(ox, oy, w, h, 0.50, 0.50, 'pink', 1, 1),
                makePegAt(ox, oy, w, h, 0.62, 0.38, 'pink', 1, 2),
                makePegAt(ox, oy, w, h, 0.76, 0.48, 'normal', 1, 2),
                makePegAt(ox, oy, w, h, 0.18, 0.70, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.30, 0.78, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.82, 'normal', 2, 1),
                makePegAt(ox, oy, w, h, 0.70, 0.78, 'normal', 2, 2),
                makePegAt(ox, oy, w, h, 0.82, 0.70, 'normal', 2, 3),
            ];
            [
                makeBarrierAt(ox, oy, w, h, 0.22, 0.34, 0.38, 0.68, 'pink', 3, 0),
                makeBarrierAt(ox, oy, w, h, 0.78, 0.34, 0.62, 0.68, 'pink', 3, 1),
            ].forEach(peg => {
                peg.layoutRole = 'bounce_chamber_barrier';
                pegs.push(peg);
            });
            pegs.forEach(p => { p.layoutRole = 'bounce_chamber'; });
            return { pegs, specialSlots: [] };
        },
    },
    crucible_seed: {
        id: 'crucible_seed',
        name: '炼金核',
        icon: '△',
        desc: '三角属性核，少量固定属性搭配中心融合落点。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'triangle-core', entry: 'top', exit: 'bottom' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.50, 0.20, 'cryo', 0, 1),
                makePegAt(ox, oy, w, h, 0.36, 0.34, 'normal', 0, 0),
                makePegAt(ox, oy, w, h, 0.64, 0.34, 'normal', 0, 2),
                makePegAt(ox, oy, w, h, 0.22, 0.46, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.32, 0.56, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.52, 'damage', 1, 1),
                makePegAt(ox, oy, w, h, 0.68, 0.56, 'normal', 1, 2),
                makePegAt(ox, oy, w, h, 0.78, 0.46, 'normal', 1, 3),
                makePegAt(ox, oy, w, h, 0.28, 0.76, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.38, 0.92, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.72, 'normal', 2, 1),
                makePegAt(ox, oy, w, h, 0.62, 0.94, 'pyro', 2, 2),
                makePegAt(ox, oy, w, h, 0.72, 0.76, 'normal', 2, 3),
            ];
            markFusionFocus(pegs.filter(p => p.type === 'normal'), ox, oy, w, h, 3);
            return { pegs, specialSlots: [] };
        },
    },
    catcher_cup: {
        id: 'catcher_cup',
        name: '接球杯',
        icon: '∪',
        desc: 'U 型缓冲杯，减少新手局弹珠从底部直落。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'cup', entry: 'top', exit: 'bottom-center' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.25, 0.30, 'normal', 0, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.24, 'normal', 0, 1),
                makePegAt(ox, oy, w, h, 0.75, 0.30, 'normal', 0, 2),
                makePegAt(ox, oy, w, h, 0.10, 0.38, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.34, 0.50, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.66, 0.50, 'normal', 1, 2),
                makePegAt(ox, oy, w, h, 0.90, 0.38, 'normal', 1, 3),
                makePegAt(ox, oy, w, h, 0.20, 0.64, 'pink', 1, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.66, 'normal', 1, 1),
                makePegAt(ox, oy, w, h, 0.80, 0.64, 'pink', 1, 2),
                makePegAt(ox, oy, w, h, 0.40, 0.82, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.60, 0.82, 'normal', 2, 2),
            ];
            const cupBarrier = makeBarrierAt(ox, oy, w, h, 0.18, 0.68, 0.82, 0.68, 'pink', 3, 0);
            cupBarrier.layoutRole = 'catcher_cup_barrier';
            pegs.push(cupBarrier);
            pegs.forEach(p => { p.layoutRole = 'catcher_cup'; });
            const specialSlots = [new SpecialSlot(ox + w * 0.30, oy + h * 0.72, ox + w * 0.70, oy + h * 0.72, 'recall')];
            return { pegs, specialSlots };
        },
    },
    split_gate_light: {
        id: 'split_gate_light',
        name: '轻分裂门',
        icon: '⑂',
        desc: '密集护栏夹住分裂槽，弹珠穿过中线时复制路线。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'split-gate', entry: 'top', exit: 'split' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.26, 0.18, 'normal', 0, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.18, 'normal', 0, 1),
                makePegAt(ox, oy, w, h, 0.74, 0.18, 'normal', 0, 2),
                makePegAt(ox, oy, w, h, 0.20, 0.38, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.38, 0.42, 'pink', 1, 1),
                makePegAt(ox, oy, w, h, 0.62, 0.42, 'pink', 1, 2),
                makePegAt(ox, oy, w, h, 0.80, 0.38, 'normal', 1, 3),
                makePegAt(ox, oy, w, h, 0.28, 0.64, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.66, 'normal', 2, 1),
                makePegAt(ox, oy, w, h, 0.72, 0.64, 'normal', 2, 2),
                makePegAt(ox, oy, w, h, 0.36, 0.84, 'normal', 3, 0),
                makePegAt(ox, oy, w, h, 0.64, 0.84, 'normal', 3, 2),
            ];
            pegs.forEach(p => { p.layoutRole = 'split_gate_light'; });
            const specialSlots = [new SpecialSlot(ox + w * 0.34, oy + h * 0.54, ox + w * 0.66, oy + h * 0.54, 'split')];
            return { pegs, specialSlots };
        },
    },
    multicast_gate_light: {
        id: 'multicast_gate_light',
        name: '连射门',
        icon: '+2',
        desc: '窄口连射槽，穿过后为当前弹珠追加连射次数。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'hourglass', entry: 'top', exit: 'bottom' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.22, 0.18, 'normal', 0, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.16, 'normal', 0, 1),
                makePegAt(ox, oy, w, h, 0.78, 0.18, 'normal', 0, 2),
                makePegAt(ox, oy, w, h, 0.34, 0.36, 'pink', 1, 0),
                makePegAt(ox, oy, w, h, 0.66, 0.36, 'pink', 1, 2),
                makePegAt(ox, oy, w, h, 0.24, 0.58, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.58, 'normal', 2, 1),
                makePegAt(ox, oy, w, h, 0.76, 0.58, 'normal', 2, 2),
                makePegAt(ox, oy, w, h, 0.32, 0.78, 'normal', 3, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.86, 'normal', 3, 1),
                makePegAt(ox, oy, w, h, 0.68, 0.78, 'normal', 3, 2),
            ];
            pegs.forEach(p => { p.layoutRole = 'multicast_gate_light'; });
            const specialSlots = [new SpecialSlot(ox + w * 0.35, oy + h * 0.48, ox + w * 0.65, oy + h * 0.48, 'multicast')];
            return { pegs, specialSlots };
        },
    },
    recall_loop_light: {
        id: 'recall_loop_light',
        name: '轻回环',
        icon: '↺',
        desc: '回溯槽被高弹钉包住，漏到底前给一次重新入场机会。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'cup', entry: 'top', exit: 'recall' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.24, 0.20, 'pink', 0, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.18, 'normal', 0, 1),
                makePegAt(ox, oy, w, h, 0.76, 0.20, 'pink', 0, 2),
                makePegAt(ox, oy, w, h, 0.18, 0.42, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.38, 0.46, 'normal', 1, 1),
                makePegAt(ox, oy, w, h, 0.62, 0.46, 'normal', 1, 2),
                makePegAt(ox, oy, w, h, 0.82, 0.42, 'normal', 1, 3),
                makePegAt(ox, oy, w, h, 0.24, 0.70, 'pink', 2, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.74, 'normal', 2, 1),
                makePegAt(ox, oy, w, h, 0.76, 0.70, 'pink', 2, 2),
                makePegAt(ox, oy, w, h, 0.36, 0.88, 'normal', 3, 0),
                makePegAt(ox, oy, w, h, 0.64, 0.88, 'normal', 3, 2),
            ];
            [
                makeBarrierAt(ox, oy, w, h, 0.22, 0.24, 0.38, 0.62, 'pink', 4, 0),
                makeBarrierAt(ox, oy, w, h, 0.78, 0.24, 0.62, 0.62, 'pink', 4, 1),
            ].forEach(peg => {
                peg.layoutRole = 'recall_loop_light_barrier';
                pegs.push(peg);
            });
            pegs.forEach(p => { p.layoutRole = 'recall_loop_light'; });
            const specialSlots = [new SpecialSlot(ox + w * 0.32, oy + h * 0.60, ox + w * 0.68, oy + h * 0.60, 'recall')];
            return { pegs, specialSlots };
        },
    },
    wheel_cup_light: {
        id: 'wheel_cup_light',
        name: '轻轮盘杯',
        icon: '🎡',
        desc: '底部轮盘槽复制已收集属性，杯形钉组提高触发机会。',
        rarity: 'common',
        price: 0,
        shape: { footprint: 'cup', entry: 'top', exit: 'wheel' },
        build(ox, oy, w, h) {
            const pegs = [
                makePegAt(ox, oy, w, h, 0.24, 0.22, 'normal', 0, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.18, 'normal', 0, 1),
                makePegAt(ox, oy, w, h, 0.76, 0.22, 'normal', 0, 2),
                makePegAt(ox, oy, w, h, 0.18, 0.44, 'normal', 1, 0),
                makePegAt(ox, oy, w, h, 0.38, 0.50, 'pink', 1, 1),
                makePegAt(ox, oy, w, h, 0.62, 0.50, 'pink', 1, 2),
                makePegAt(ox, oy, w, h, 0.82, 0.44, 'normal', 1, 3),
                makePegAt(ox, oy, w, h, 0.28, 0.76, 'normal', 2, 0),
                makePegAt(ox, oy, w, h, 0.50, 0.84, 'normal', 2, 1),
                makePegAt(ox, oy, w, h, 0.72, 0.76, 'normal', 2, 2),
            ];
            const cupBarrier = makeBarrierAt(ox, oy, w, h, 0.20, 0.64, 0.80, 0.64, 'pink', 3, 0);
            cupBarrier.layoutRole = 'wheel_cup_light_barrier';
            pegs.push(cupBarrier);
            pegs.forEach(p => { p.layoutRole = 'wheel_cup_light'; });
            const specialSlots = [new SpecialSlot(ox + w * 0.30, oy + h * 0.70, ox + w * 0.70, oy + h * 0.70, 'wheel')];
            return { pegs, specialSlots };
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

MODULE_DEFS.split_yoke_module = {
    id: 'split_yoke_module',
    name: '分叉轭',
    icon: 'Y',
    desc: '2x1 Y 字分流架，中心入口分成左右两路，并内置分裂槽。',
    rarity: 'rare',
    price: 85,
    span: { cols: 2, rows: 1 },
    shape: { footprint: 'yoke', entry: 'top-center', exit: 'split' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.50, 0.22, 'normal', 0, 2),
            makePegAt(ox, oy, w, h, 0.34, 0.30, 'normal', 0, 1),
            makePegAt(ox, oy, w, h, 0.66, 0.30, 'normal', 0, 3),
            makePegAt(ox, oy, w, h, 0.38, 0.46, 'pink', 1, 1),
            makePegAt(ox, oy, w, h, 0.62, 0.46, 'pink', 1, 3),
            makePegAt(ox, oy, w, h, 0.20, 0.58, 'normal', 1, 0),
            makePegAt(ox, oy, w, h, 0.80, 0.58, 'normal', 1, 4),
            makePegAt(ox, oy, w, h, 0.25, 0.78, 'normal', 2, 0),
            makePegAt(ox, oy, w, h, 0.75, 0.78, 'normal', 2, 4),
            makePegAt(ox, oy, w, h, 0.50, 0.76, 'normal', 2, 2),
        ];
        pegs.forEach(p => { p.layoutRole = 'split_yoke'; });
        const specialSlots = [new SpecialSlot(ox + w * 0.38, oy + h * 0.58, ox + w * 0.62, oy + h * 0.58, 'split')];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.hourglass_gate_module = {
    id: 'hourglass_gate_module',
    name: '沙漏门',
    icon: '⌛',
    desc: '1x2 上宽下窄再张开，先聚焦再分流，适合接奖励槽。',
    rarity: 'rare',
    price: 80,
    span: { cols: 1, rows: 2 },
    shape: { footprint: 'hourglass', entry: 'top', exit: 'split' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.25, 0.12, 'normal', 0, 0),
            makePegAt(ox, oy, w, h, 0.75, 0.12, 'normal', 0, 2),
            makePegAt(ox, oy, w, h, 0.50, 0.24, 'normal', 1, 1),
            makePegAt(ox, oy, w, h, 0.38, 0.32, 'pink', 1, 0),
            makePegAt(ox, oy, w, h, 0.62, 0.32, 'pink', 1, 2),
            makePegAt(ox, oy, w, h, 0.50, 0.50, 'normal', 2, 1),
            makePegAt(ox, oy, w, h, 0.34, 0.70, 'pink', 3, 0),
            makePegAt(ox, oy, w, h, 0.66, 0.70, 'pink', 3, 2),
            makePegAt(ox, oy, w, h, 0.50, 0.76, 'normal', 3, 1),
            makePegAt(ox, oy, w, h, 0.22, 0.88, 'normal', 4, 0),
            makePegAt(ox, oy, w, h, 0.78, 0.88, 'normal', 4, 2),
        ];
        pegs.forEach(p => { p.layoutRole = 'hourglass_gate'; });
        return { pegs, specialSlots: [] };
    },
};

MODULE_DEFS.crescent_bank_module = {
    id: 'crescent_bank_module',
    name: '月牙坡',
    icon: ')',
    desc: '2x1 弧形弹钉坡，强制横移后回中，适合修正偏航弹珠。',
    rarity: 'rare',
    price: 75,
    span: { cols: 2, rows: 1 },
    shape: { footprint: 'crescent', entry: 'top-left', exit: 'bottom-center' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.18, 0.28, 'normal', 0, 0),
            makePegAt(ox, oy, w, h, 0.32, 0.18, 'pink', 0, 1),
            makePegAt(ox, oy, w, h, 0.50, 0.22, 'pink', 0, 2),
            makePegAt(ox, oy, w, h, 0.66, 0.38, 'pink', 1, 3),
            makePegAt(ox, oy, w, h, 0.24, 0.48, 'normal', 1, 1),
            makePegAt(ox, oy, w, h, 0.50, 0.52, 'normal', 2, 2),
            makePegAt(ox, oy, w, h, 0.76, 0.62, 'pink', 2, 4),
            makePegAt(ox, oy, w, h, 0.72, 0.78, 'normal', 3, 4),
            makePegAt(ox, oy, w, h, 0.62, 0.82, 'normal', 3, 3),
            makePegAt(ox, oy, w, h, 0.40, 0.78, 'normal', 3, 2),
        ];
        pegs.forEach(p => { p.layoutRole = 'crescent_bank'; });
        return { pegs, specialSlots: [] };
    },
};

MODULE_DEFS.spiral_return_module = {
    id: 'spiral_return_module',
    name: '螺旋回廊',
    icon: 'S',
    desc: '2x2 高占位回收件，外圈弹钉包住回溯槽，给漏球第二次机会。',
    rarity: 'epic',
    price: 115,
    span: { cols: 2, rows: 2 },
    shape: { footprint: 'spiral', entry: 'top', exit: 'recall' },
    build(ox, oy, w, h) {
        const anchors = [
            [0.24, 0.18, 'pink'], [0.54, 0.16, 'normal'], [0.78, 0.28, 'pink'],
            [0.48, 0.30, 'normal'], [0.82, 0.56, 'pink'], [0.72, 0.62, 'normal'],
            [0.62, 0.78, 'normal'], [0.48, 0.66, 'normal'], [0.34, 0.78, 'pink'],
            [0.18, 0.58, 'pink'], [0.26, 0.48, 'normal'], [0.34, 0.40, 'normal'], [0.58, 0.44, 'normal'],
        ];
        const pegs = anchors.map(([px, py, type], i) => {
            const peg = makePegAt(ox, oy, w, h, px, py, type, Math.floor(i / 3), i % 3);
            peg.layoutRole = 'spiral_return';
            return peg;
        });
        const specialSlots = [new SpecialSlot(ox + w * 0.36, oy + h * 0.56, ox + w * 0.62, oy + h * 0.56, 'recall')];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.prism_splitter_module = {
    id: 'prism_splitter_module',
    name: '棱镜分光器',
    icon: 'P',
    desc: '三射线固定属性组件，少量属性钉配合分流路线。',
    rarity: 'epic',
    price: 90,
    shape: { footprint: 'prism', entry: 'top', exit: 'split' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.50, 0.18, 'scatter', 0, 1),
            makePegAt(ox, oy, w, h, 0.28, 0.44, 'cryo', 1, 0),
            makePegAt(ox, oy, w, h, 0.50, 0.42, 'normal', 1, 1),
            makePegAt(ox, oy, w, h, 0.72, 0.44, 'pyro', 1, 2),
            makePegAt(ox, oy, w, h, 0.24, 0.62, 'normal', 2, 0),
            makePegAt(ox, oy, w, h, 0.76, 0.62, 'normal', 2, 2),
            makePegAt(ox, oy, w, h, 0.38, 0.70, 'normal', 2, 0),
            makePegAt(ox, oy, w, h, 0.62, 0.70, 'normal', 2, 2),
            makePegAt(ox, oy, w, h, 0.50, 0.86, 'damage', 3, 1),
        ];
        markFusionFocus(pegs.filter(p => p.type === 'normal'), ox, oy, w, h, 2);
        return { pegs, specialSlots: [] };
    },
};

MODULE_DEFS.twin_wheel_bridge_module = {
    id: 'twin_wheel_bridge_module',
    name: '双轮桥',
    icon: 'B',
    desc: '3x1 大型横桥，两个轮盘槽夹住中央导流，峰值高但占位大。',
    rarity: 'legendary',
    price: 145,
    span: { cols: 3, rows: 1 },
    shape: { footprint: 'bridge', entry: 'top', exit: 'wheel' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.22, 0.46, 'normal', 1, 1),
            makePegAt(ox, oy, w, h, 0.14, 0.76, 'normal', 2, 0),
            makePegAt(ox, oy, w, h, 0.28, 0.76, 'normal', 2, 1),
            makePegAt(ox, oy, w, h, 0.72, 0.76, 'normal', 2, 4),
            makePegAt(ox, oy, w, h, 0.86, 0.76, 'normal', 2, 5),
            makePegAt(ox, oy, w, h, 0.38, 0.30, 'pink', 0, 2),
            makePegAt(ox, oy, w, h, 0.50, 0.24, 'normal', 0, 3),
            makePegAt(ox, oy, w, h, 0.50, 0.50, 'normal', 1, 3),
            makePegAt(ox, oy, w, h, 0.50, 0.74, 'normal', 2, 3),
            makePegAt(ox, oy, w, h, 0.62, 0.30, 'pink', 0, 4),
            makePegAt(ox, oy, w, h, 0.78, 0.46, 'normal', 1, 5),
        ];
        pegs.forEach(p => { p.layoutRole = 'twin_wheel_bridge'; });
        const specialSlots = [
            new SpecialSlot(ox + w * 0.14, oy + h * 0.76, ox + w * 0.28, oy + h * 0.76, 'wheel'),
            new SpecialSlot(ox + w * 0.72, oy + h * 0.76, ox + w * 0.86, oy + h * 0.76, 'wheel'),
        ];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.launcher_gate_module = {
    id: 'launcher_gate_module',
    name: '旋向发射槽',
    icon: '↪',
    desc: '2x1 入口槽接持续旋转发射器，弹珠穿过时按当前朝向高速射出。',
    rarity: 'rare',
    price: 95,
    tags: ['showcase'],
    span: { cols: 2, rows: 1 },
    shape: { footprint: 'launcher', entry: 'top-center', exit: 'rotating-shot' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.18, 0.24, 'normal', 0, 0),
            makePegAt(ox, oy, w, h, 0.50, 0.18, 'pink', 0, 2),
            makePegAt(ox, oy, w, h, 0.82, 0.24, 'normal', 0, 4),
            makePegAt(ox, oy, w, h, 0.26, 0.70, 'normal', 2, 1),
            makePegAt(ox, oy, w, h, 0.74, 0.70, 'normal', 2, 3),
        ];
        const leftRail = makeBarrierAt(ox, oy, w, h, 0.24, 0.38, 0.42, 0.58, 'pink', 1, 0);
        const rightRail = makeBarrierAt(ox, oy, w, h, 0.76, 0.38, 0.58, 0.58, 'pink', 1, 4);
        leftRail.layoutRole = 'launcher_gate_rail';
        rightRail.layoutRole = 'launcher_gate_rail';
        pegs.push(leftRail, rightRail);
        pegs.forEach(p => { p.layoutRole = p.layoutRole || 'launcher_gate'; });
        const specialSlots = [new SpecialSlot(
            ox + w * 0.42, oy + h * 0.56,
            ox + w * 0.58, oy + h * 0.56,
            'launcher',
            {
                persistent: true,
                maxCharges: 4,
                activationCooldown: 18,
                launchDirection: -Math.PI / 2,
                launchSpeed: 14.5,
                rotationSpeed: 0.085,
                spinRadius: Math.min(w, h) * 0.18,
            }
        )];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.pinwheel_capacitor_module = {
    id: 'pinwheel_capacitor_module',
    name: '蓄能杆轮',
    icon: '⚙',
    desc: '5 杆转轮，弹珠撞入后为最多 3 枚当前弹珠各储存 1 层连射能量。',
    rarity: 'epic',
    price: 110,
    tags: ['showcase'],
    shape: { footprint: 'pinwheel', entry: 'top', exit: 'multicast' },
    build(ox, oy, w, h) {
        const anchors = [
            [0.22, 0.26, 'normal'], [0.78, 0.26, 'normal'],
            [0.26, 0.76, 'normal'], [0.74, 0.76, 'normal'],
            [0.50, 0.14, 'pink'],
        ];
        const pegs = anchors.map(([px, py, type], i) => {
            const peg = makePegAt(ox, oy, w, h, px, py, type, Math.floor(i / 2), i % 2);
            peg.layoutRole = 'pinwheel_capacitor';
            return peg;
        });
        const specialSlots = [new SpecialSlot(
            ox + w * 0.32, oy + h * 0.52,
            ox + w * 0.68, oy + h * 0.52,
            'energy_wheel',
            {
                persistent: true,
                maxCharges: 3,
                activationCooldown: 20,
                rodCount: 5,
                spinRadius: Math.min(w, h) * 0.22,
                rotationSpeed: 0.095,
            }
        )];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.turbine_loop_module = {
    id: 'turbine_loop_module',
    name: '涡轮回路',
    icon: 'T',
    desc: '2x2 大型机关：上层杆轮充连射，下层旋向发射器把弹珠重新打回盘面。',
    rarity: 'legendary',
    price: 155,
    tags: ['showcase'],
    span: { cols: 2, rows: 2 },
    shape: { footprint: 'turbine', entry: 'top', exit: 'loop-shot' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.22, 0.16, 'normal', 0, 0),
            makePegAt(ox, oy, w, h, 0.50, 0.12, 'pink', 0, 2),
            makePegAt(ox, oy, w, h, 0.78, 0.16, 'normal', 0, 4),
            makePegAt(ox, oy, w, h, 0.18, 0.38, 'pink', 1, 0),
            makePegAt(ox, oy, w, h, 0.82, 0.38, 'pink', 1, 4),
            makePegAt(ox, oy, w, h, 0.30, 0.70, 'normal', 3, 1),
            makePegAt(ox, oy, w, h, 0.70, 0.70, 'normal', 3, 3),
            makePegAt(ox, oy, w, h, 0.50, 0.86, 'normal', 4, 2),
        ];
        const leftWall = makeBarrierAt(ox, oy, w, h, 0.18, 0.52, 0.34, 0.82, 'pink', 2, 0);
        const rightWall = makeBarrierAt(ox, oy, w, h, 0.82, 0.52, 0.66, 0.82, 'pink', 2, 4);
        leftWall.layoutRole = 'turbine_loop_wall';
        rightWall.layoutRole = 'turbine_loop_wall';
        pegs.push(leftWall, rightWall);
        pegs.forEach(p => { p.layoutRole = p.layoutRole || 'turbine_loop'; });
        const specialSlots = [
            new SpecialSlot(
                ox + w * 0.34, oy + h * 0.36,
                ox + w * 0.66, oy + h * 0.36,
                'energy_wheel',
                {
                    persistent: true,
                    maxCharges: 3,
                    activationCooldown: 22,
                    rodCount: 5,
                    spinRadius: Math.min(w, h) * 0.13,
                    rotationSpeed: 0.08,
                }
            ),
            new SpecialSlot(
                ox + w * 0.42, oy + h * 0.70,
                ox + w * 0.58, oy + h * 0.70,
                'launcher',
                {
                    persistent: true,
                    maxCharges: 3,
                    activationCooldown: 24,
                    launchDirection: -Math.PI / 2,
                    launchSpeed: 13.5,
                    rotationSpeed: 0.07,
                    spinRadius: Math.min(w, h) * 0.13,
                }
            ),
        ];
        return { pegs, specialSlots };
    },
};

MODULE_DEFS.swerve_cannon_module = {
    id: 'swerve_cannon_module',
    name: '偏航斜炮',
    icon: '↗',
    desc: '1x2 定向加速器，把落入侧槽的弹珠高速斜射回中上区。',
    rarity: 'rare',
    price: 85,
    tags: ['showcase'],
    span: { cols: 1, rows: 2 },
    shape: { footprint: 'cannon', entry: 'side', exit: 'up-right' },
    build(ox, oy, w, h) {
        const pegs = [
            makePegAt(ox, oy, w, h, 0.28, 0.18, 'normal', 0, 0),
            makePegAt(ox, oy, w, h, 0.72, 0.28, 'pink', 0, 1),
            makePegAt(ox, oy, w, h, 0.28, 0.52, 'pink', 1, 0),
            makePegAt(ox, oy, w, h, 0.72, 0.76, 'normal', 2, 1),
        ];
        const rail = makeBarrierAt(ox, oy, w, h, 0.20, 0.72, 0.72, 0.48, 'pink', 3, 0);
        rail.layoutRole = 'swerve_cannon_rail';
        pegs.push(rail);
        pegs.forEach(p => { p.layoutRole = p.layoutRole || 'swerve_cannon'; });
        const specialSlots = [new SpecialSlot(
            ox + w * 0.28, oy + h * 0.58,
            ox + w * 0.70, oy + h * 0.46,
            'launcher',
            {
                persistent: true,
                maxCharges: 3,
                activationCooldown: 20,
                launchDirection: { x: 0.75, y: -1 },
                launchSpeed: 13,
                spinVisual: false,
                spinRadius: Math.min(w, h) * 0.20,
            }
        )];
        return { pegs, specialSlots };
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

// @perf-impact: Default 2x5 starter returns to plain dense staggered modules; Peg shadow/halo cost remains gated by CONFIG.performance.
const DEFAULT_MODULE_SEQUENCE = [
    'dense_stagger',
];

export function createDefaultModuleLayout(totalSlots, activeSlots = CONFIG.gameplay.moduleDefaultSlots || 3) {
    const count = Math.max(0, totalSlots || DEFAULT_MODULE_SEQUENCE.length);
    const activeCount = Math.max(0, Math.min(activeSlots || 0, count));
    const layout = Array.from({ length: count }, () => null);
    const activeSlotIds = getActiveModuleSlots(activeCount, count);
    const activeSet = new Set(activeSlotIds);
    const occupied = new Set();
    let orderIdx = 0;
    for (const slotIdx of activeSlotIds) {
        if (occupied.has(slotIdx)) continue;
        let placed = false;
        for (let attempts = 0; attempts < DEFAULT_MODULE_SEQUENCE.length; attempts++) {
            const moduleId = DEFAULT_MODULE_SEQUENCE[orderIdx % DEFAULT_MODULE_SEQUENCE.length];
            orderIdx++;
            const span = getModuleSpan(moduleId);
            const covered = getCoveredSlots(
                slotIdx,
                span,
                CONFIG.gameplay.moduleCols || 5,
                CONFIG.gameplay.moduleRows || 3
            );
            if (!covered || covered.some(ci => !activeSet.has(ci) || occupied.has(ci) || ci >= count)) continue;
            layout[slotIdx] = createModuleInstance(moduleId);
            for (const ci of covered) {
                occupied.add(ci);
                if (ci !== slotIdx) layout[ci] = createModuleRef(slotIdx);
            }
            placed = true;
            break;
        }
        if (!placed) {
            layout[slotIdx] = createModuleInstance('dense_stagger');
            occupied.add(slotIdx);
        }
    }
    return layout;
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
    addModuleSeamPegs(result.pegs, originX, originY, width, height, moduleId);
    result.pegs = enforceCirclePegSpacing(result.pegs);
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

export function getModuleMetaSummary(moduleId) {
    const def = MODULE_DEFS[moduleId];
    if (!def) return '';
    const span = getModuleSpan(moduleId);
    const parts = [];
    if (span.cols > 1 || span.rows > 1) parts.push(`${span.cols}x${span.rows}`);
    if (def.shape) {
        const entry = def.shape.entry ? `入口:${def.shape.entry}` : '';
        const exit = def.shape.exit ? `出口:${def.shape.exit}` : '';
        if (entry || exit) parts.push([entry, exit].filter(Boolean).join(' / '));
    }
    if (def.rarity) parts.push(def.rarity);
    return parts.join(' · ');
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

