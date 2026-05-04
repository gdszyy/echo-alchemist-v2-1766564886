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

import { Peg, SpecialSlot } from './entities.js';

// 与 game_phase.phase_gathering_getRandomPegType 保持一致：laser / lightning 不生成钉子。
const RANDOMIZABLE_PEG_TYPES = ['bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro', 'wind'];

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
    const spacingX = cols > 1 ? (w / cols) : w;
    const spacingY = rows > 1 ? (h / (rows + 0.5)) : h;
    for (let r = 0; r < rows; r++) {
        const isOdd = r % 2 !== 0;
        const colsThisRow = isOdd ? Math.max(1, cols - 1) : cols;
        const baseLeftPad = (w - (colsThisRow - 1) * spacingX) / 2;
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
    const spacingY = h / (rows + 0.5);
    for (let r = 0; r < rows; r++) {
        const colsThisRow = Math.max(1, topCols - r);
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
        desc: '頂寬底窄的三角形交錯，弹珠向中央匯集。',
        rarity: 'common',
        price: 0,
        build(ox, oy, w, h) {
            const pegs = generateFunnelPegs(ox, oy, w, h, 4, 3);
            return { pegs, specialSlots: [] };
        },
    },
    wheel_module: {
        id: 'wheel_module',
        name: '幸運轉盤',
        icon: '🎰',
        desc: '在底部生成一個 [輪盤槽]，弹珠穿越時觸發屬性翻倍輪盤。',
        rarity: 'rare',
        price: 60,
        build(ox, oy, w, h) {
            // 顶部一排普通钉子 + 底部两颗钉子之间夹一个 wheel slot
            const pegs = [];
            const sx = w / 4;
            for (let i = 0; i < 3; i++) {
                const p = new Peg(ox + sx + i * sx, oy + h * 0.25, 'normal');
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
                    pegA = bottomRowPegs[0];
                    pegB = bottomRowPegs[1];
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
        for (let r = 0; r < rows; r++) {
            const colsThisRow = widths[r];
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
        const pegs = [];
        for (let r = 0; r < rows; r++) {
            const cols = (r % 2 === 0) ? 4 : 2;
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
        const pegs = [];
        for (let r = 0; r < rows; r++) {
            const cols = (r % 2 === 0) ? 5 : 2;
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

/**
 * 主入口：根据模块 ID 在指定矩形内构造实体集合
 */
export function buildModuleEntities(moduleId, originX, originY, width, height, ctx, slotIdx) {
    const def = MODULE_DEFS[moduleId];
    if (!def) {
        return { pegs: [], specialSlots: [] };
    }
    const result = def.build(originX, originY, width, height, ctx, slotIdx);
    applyWeightedPegTypes(result.pegs, ctx);
    return result;
}

/**
 * 计算单个模块槽位的矩形（基于画布尺寸和 CONFIG.gameplay）
 */
export function calcModuleSlotRect(slotIdx, canvasWidth, canvasHeight, cfg) {
    const cols = cfg.moduleCols || 4;
    const rows = cfg.moduleRows || 3;
    const topY = cfg.moduleAreaTopY || 60;
    const bottomMargin = cfg.moduleAreaBottomMargin || 80;
    const spacingX = cfg.moduleSpacingX || 4;
    const spacingY = cfg.moduleSpacingY || 4;
    const totalW = canvasWidth - 20;
    const totalH = Math.max(120, canvasHeight - topY - bottomMargin);
    const cellW = (totalW - (cols - 1) * spacingX) / cols;
    const cellH = (totalH - (rows - 1) * spacingY) / rows;
    const r = Math.floor(slotIdx / cols);
    const c = slotIdx % cols;
    return {
        x: 10 + c * (cellW + spacingX),
        y: topY + r * (cellH + spacingY),
        w: cellW,
        h: cellH,
    };
}

/**
 * 列出所有可放置的模块 ID（受 unlockedModuleTypes 限制）
 */
export function listAvailableModules(unlockedModuleTypes) {
    return (unlockedModuleTypes || []).filter(id => MODULE_DEFS[id]);
}
