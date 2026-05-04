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
 *   - 所有 peg 默认 type='normal'，元素属性由"符文融合"步骤后置赋予
 *     （见 rune_system.fuseRuneIntoBoard / phase_gathering_initPachinko 的末尾步骤）
 *   - 例外：cryo_pyro_pair 模块固定预置 1 cryo + 1 pyro
 *
 * MVP 实现说明：
 *   - wheel_module 复用 SpecialSlot type='wheel'（已有的转盘触发机制）
 *   - baffle 模块用一排粉色高弹性钉子模拟"挡板反弹"，复用 pink peg 物理
 *   - fixed_slot 模块复用 SpecialSlot 类（multicast/recall/split 轮换）
 */

import { Peg, SpecialSlot } from './entities.js';

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

/**
 * 主入口：根据模块 ID 在指定矩形内构造实体集合
 */
export function buildModuleEntities(moduleId, originX, originY, width, height, ctx, slotIdx) {
    const def = MODULE_DEFS[moduleId];
    if (!def) {
        return { pegs: [], specialSlots: [] };
    }
    return def.build(originX, originY, width, height, ctx, slotIdx);
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
