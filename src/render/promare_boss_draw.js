/**
 * promare_boss_draw.js - 8 个 Boss 的方块底 + 几何 glyph（T2.B 方块化版）
 *
 * 设计契约：docs/promare_visual_design_v2.md §2.2 Boss 复合方块表是真理源。
 *   "Boss = 复合方块"：每个 boss 是方块的特定变体（叠堆 / 切口 / 拼接 / 环列），
 *   而非完全脱离方块的自由形态。
 *
 * Boss 分两类：
 *
 * A) 基底方块 + 加 glyph（4 个）—— drawPromareEnemyBody 先画方块底，drawer 再贴 glyph：
 *    - boss_ignis    基底方块 + 顶部 3 大 △ 喷出
 *    - boss_glacies  基底方块 + 3 长菱形针从顶部插出
 *    - boss_devourer 基底方块 + 顶部 destination-out 倒三角"咬口" + 内 4 chevron
 *    - boss_viridis  基底方块 + 6 个外向 △ 散射
 *
 * B) Drawer 接管整体（4 个）—— BOSS_REPLACES_BASE in promare_enemy_draw.js 跳过底：
 *    - boss_micro      3×3 □ 网格
 *    - boss_tesla      3 层嵌套 □ 旋转角度 0°/15°/-15° stepped
 *    - boss_chimera    左 □ + 右 □ 拼接（左右色异）
 *    - boss_ouroboros  8 □ 围成圈（形式是 ○ 但语义是 □ 序列）
 *
 * F2/F4 兑现：去 lighter、用主色暗调描边。
 * F1 兑现：所有动画用 12fps stepped frame 而非 sin/cos 连续。
 *
 * @perf-impact: 单 boss 每帧 2-12 fill + stroke，无 shadowBlur，无 lighter。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';

// 配色常量（与 promare_enemy_draw.js 一致）
const SHADOW_COLOR = '#2A0A4A';
const OUTLINE_COLOR = '#1B0B2E';
const BOSS_BASE_COLOR = '#4A2B72';   // boss 主体色（更深更饱）

// 工具：亮化（用于 boss 高光边）
function _brighten(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, r * factor | 0)}, ${Math.min(255, g * factor | 0)}, ${Math.min(255, b * factor | 0)})`;
}

// 工具：12fps stepped frame（用于 stepped 动画 phase）
function _frame12(t) { return Math.floor(t * 12); }

// 工具：画带阴影 + 描边 + 高光边的"标准 promare 方块"
function _drawPromareSquare(ctx, x, y, w, h, fillColor) {
    // 阴影
    ctx.fillStyle = SHADOW_COLOR;
    ctx.fillRect(x + 3, y + 3, w, h);
    // 主体
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
    // 整圈描边
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.strokeRect(x, y, w, h);
    // 高光边（顶 + 左）
    ctx.lineWidth = 1;
    ctx.strokeStyle = _brighten(fillColor, 1.4);
    ctx.beginPath();
    ctx.moveTo(x + 1, y + h - 1);
    ctx.lineTo(x + 1, y + 1);
    ctx.lineTo(x + w - 1, y + 1);
    ctx.stroke();
}

/**
 * @param {Enemy} enemy
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 */
export function drawPromareBoss(enemy, ctx, w, h) {
    if (!enemy.bossType) return;
    const drawer = BOSS_DRAWERS[enemy.bossType];
    if (!drawer) return;

    const t = Date.now() / 1000;
    const frame = _frame12(t);
    const isBerserk = !!enemy.berserked;

    ctx.save();
    drawer(ctx, w, h, t, frame, isBerserk);
    ctx.restore();
}

// ==================== 8 Boss drawer ====================

const BOSS_DRAWERS = {
    // A) 基底方块 + 顶部 3 大 △（"火焰冠"）
    boss_ignis: (ctx, w, h, t, frame, isBerserk) => {
        // 3 个粉色 △ 从方块顶边喷出，stepped flicker
        const flicker = (frame % 2 === 0) ? 1.0 : 0.7;
        ctx.globalAlpha = 0.95 * flicker;
        const triCount = 3;
        const tw = w / triCount;
        const triH = h * 0.4;  // △ 高度比方块小一点
        for (let i = 0; i < triCount; i++) {
            const cx = -w / 2 + i * tw + tw / 2;
            const ty = -h / 2;
            // 外圈粉 △
            ctx.beginPath();
            ctx.moveTo(cx, ty - triH);
            ctx.lineTo(cx + tw * 0.45, ty);
            ctx.lineTo(cx - tw * 0.45, ty);
            ctx.closePath();
            ctx.fillStyle = PROMARE_PALETTE.PINK;
            ctx.fill();
            ctx.strokeStyle = '#660F40';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // 内核黄 △
            ctx.beginPath();
            ctx.moveTo(cx, ty - triH * 0.6);
            ctx.lineTo(cx + tw * 0.25, ty - triH * 0.05);
            ctx.lineTo(cx - tw * 0.25, ty - triH * 0.05);
            ctx.closePath();
            ctx.fillStyle = PROMARE_PALETTE.YELLOW;
            ctx.fill();
        }
        // 狂暴：额外加更大的中心 △ 浮在最上
        if (isBerserk) {
            const big = (frame % 4 < 2) ? 1.0 : 0.85;
            ctx.globalAlpha = 0.85 * big;
            ctx.fillStyle = PROMARE_PALETTE.PINK;
            ctx.beginPath();
            ctx.moveTo(0, -h * 0.95);
            ctx.lineTo(w * 0.25, -h * 0.5);
            ctx.lineTo(-w * 0.25, -h * 0.5);
            ctx.closePath();
            ctx.fill();
        }
    },

    // A) 基底方块 + 3 长菱形针从顶部插出
    boss_glacies: (ctx, w, h, t, frame, isBerserk) => {
        const needleCount = isBerserk ? 5 : 3;
        const needleLen = h * (isBerserk ? 1.2 : 0.9);
        const needleW = Math.min(w, h) * 0.08;
        ctx.globalAlpha = 0.95;
        for (let i = 0; i < needleCount; i++) {
            const cx = (i - (needleCount - 1) / 2) * (w * 0.28);
            // 外圈青菱形针
            ctx.beginPath();
            ctx.moveTo(cx, -h / 2 - needleLen);
            ctx.lineTo(cx + needleW, -h / 2);
            ctx.lineTo(cx, -h / 2 + needleW * 0.6);
            ctx.lineTo(cx - needleW, -h / 2);
            ctx.closePath();
            ctx.fillStyle = PROMARE_PALETTE.CYAN;
            ctx.fill();
            ctx.strokeStyle = '#003E5C';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // 白核（内层）
            ctx.beginPath();
            ctx.moveTo(cx, -h / 2 - needleLen * 0.6);
            ctx.lineTo(cx + needleW * 0.5, -h / 2 - needleLen * 0.05);
            ctx.lineTo(cx, -h / 2 + needleW * 0.2);
            ctx.lineTo(cx - needleW * 0.5, -h / 2 - needleLen * 0.05);
            ctx.closePath();
            ctx.fillStyle = PROMARE_PALETTE.WHITE;
            ctx.fill();
        }
    },

    // B) 3×3 □ 网格（drawer 自己画整体；base 被跳过）
    boss_micro: (ctx, w, h, t, frame, isBerserk) => {
        const flickerColor = isBerserk
            ? ((frame % 3 === 0) ? PROMARE_PALETTE.PINK : PROMARE_PALETTE.YELLOW)
            : BOSS_BASE_COLOR;
        const cellW = w / 3 - 4;
        const cellH = h / 3 - 4;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const x = -w / 2 + col * (cellW + 4) + 2;
                const y = -h / 2 + row * (cellH + 4) + 2;
                _drawPromareSquare(ctx, x, y, cellW, cellH, flickerColor);
                // 中心格貼白 △ "目光"
                if (row === 1 && col === 1) {
                    const cx = x + cellW / 2;
                    const cy = y + cellH / 2;
                    const es = Math.min(cellW, cellH) * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy + es * 0.6);
                    ctx.lineTo(cx + es * 0.6, cy - es * 0.4);
                    ctx.lineTo(cx - es * 0.6, cy - es * 0.4);
                    ctx.closePath();
                    ctx.fillStyle = PROMARE_PALETTE.WHITE;
                    ctx.fill();
                }
            }
        }
    },

    // A) 基底方块 + 顶部"咬口"倒 △（destination-out）+ 内 4 chevron
    boss_devourer: (ctx, w, h, t, frame, isBerserk) => {
        // 顶部 destination-out 倒三角"咬出来"
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.05);
        ctx.lineTo(w * 0.35, -h * 0.55);
        ctx.lineTo(-w * 0.35, -h * 0.55);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();

        // 内 4 chevron stepped 旋转（狂暴时 8 chevron）
        const chCount = isBerserk ? 8 : 4;
        // 12 fps stepped 旋转（每 5 frame snap +30°）
        const spinSnap = Math.floor(frame / 5) * (Math.PI / 6);
        const r = Math.min(w, h) * 0.32;
        ctx.strokeStyle = PROMARE_PALETTE.PINK;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < chCount; i++) {
            const a = spinSnap + (i / chCount) * Math.PI * 2;
            const tipX = Math.cos(a) * r * 0.5;
            const tipY = Math.sin(a) * r * 0.5;
            const baseAngL = a + Math.PI / 10;
            const baseAngR = a - Math.PI / 10;
            ctx.beginPath();
            ctx.moveTo(Math.cos(baseAngL) * r, Math.sin(baseAngL) * r);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(Math.cos(baseAngR) * r, Math.sin(baseAngR) * r);
            ctx.stroke();
        }
    },

    // A) 基底方块 + 6 个外向 △（"散射光"语义）
    boss_viridis: (ctx, w, h, t, frame, isBerserk) => {
        const triCount = 6;
        const r = Math.min(w, h) * (isBerserk && (frame % 8 < 4) ? 0.5 : 0.42);
        const triLen = Math.min(w, h) * 0.18;
        ctx.globalAlpha = 0.95;
        for (let i = 0; i < triCount; i++) {
            const a = (i / triCount) * Math.PI * 2 - Math.PI / 2;
            const cx = Math.cos(a) * r;
            const cy = Math.sin(a) * r;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a + Math.PI / 2);
            // 外圈黄 △
            ctx.beginPath();
            ctx.moveTo(0, -triLen);
            ctx.lineTo(triLen * 0.4, triLen * 0.2);
            ctx.lineTo(-triLen * 0.4, triLen * 0.2);
            ctx.closePath();
            ctx.fillStyle = PROMARE_PALETTE.YELLOW;
            ctx.fill();
            ctx.strokeStyle = '#5C5008';
            ctx.lineWidth = 1;
            ctx.stroke();
            // 内核白
            ctx.beginPath();
            ctx.moveTo(0, -triLen * 0.55);
            ctx.lineTo(triLen * 0.2, triLen * 0.05);
            ctx.lineTo(-triLen * 0.2, triLen * 0.05);
            ctx.closePath();
            ctx.fillStyle = PROMARE_PALETTE.WHITE;
            ctx.fill();
            ctx.restore();
        }
    },

    // B) 3 层嵌套 □，stepped 旋转 0°/15°/-15°（drawer 接管）
    boss_tesla: (ctx, w, h, t, frame, isBerserk) => {
        // 旋转 stepped：12fps 节奏切换三个角度
        const phase = (Math.floor(frame / 8) % 3);  // 每 8 帧切一次角度
        const outerRot = (phase === 0 ? 0 : phase === 1 ? Math.PI / 12 : -Math.PI / 12);
        const midRot = -outerRot;
        const innerRot = outerRot * (isBerserk ? 4 : 2);

        // 外层 □
        ctx.save();
        ctx.rotate(outerRot);
        _drawPromareSquare(ctx, -w / 2, -h / 2, w, h, BOSS_BASE_COLOR);
        ctx.restore();
        // 中层 □（缩 0.7×）
        ctx.save();
        ctx.rotate(midRot);
        _drawPromareSquare(ctx, -w * 0.35, -h * 0.35, w * 0.7, h * 0.7, _brighten(BOSS_BASE_COLOR, 1.2));
        ctx.restore();
        // 内层 □（缩 0.4×）
        ctx.save();
        ctx.rotate(innerRot);
        _drawPromareSquare(ctx, -w * 0.2, -h * 0.2, w * 0.4, h * 0.4, PROMARE_PALETTE.YELLOW);
        ctx.restore();
    },

    // B) 左 □ + 右 □ 拼接（drawer 接管）
    boss_chimera: (ctx, w, h, t, frame, isBerserk) => {
        // 左半：粉色家族；右半：青色家族
        // 各自有阴影 + 描边 + 高光
        const halfW = w / 2;

        // 左半
        ctx.fillStyle = SHADOW_COLOR;
        ctx.fillRect(-w / 2 + 3, -h / 2 + 3, halfW, h);
        ctx.fillStyle = '#7A2854';  // 暗粉紫
        ctx.fillRect(-w / 2, -h / 2, halfW, h);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = OUTLINE_COLOR;
        ctx.strokeRect(-w / 2, -h / 2, halfW, h);

        // 右半
        ctx.fillStyle = SHADOW_COLOR;
        ctx.fillRect(0 + 3, -h / 2 + 3, halfW, h);
        ctx.fillStyle = '#1E3F66';  // 暗青紫
        ctx.fillRect(0, -h / 2, halfW, h);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = OUTLINE_COLOR;
        ctx.strokeRect(0, -h / 2, halfW, h);

        // 中缝高光：粉/青色 stepped 切换显示
        const flick = (frame % 4 < 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = flick ? PROMARE_PALETTE.PINK : PROMARE_PALETTE.CYAN;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(0, h / 2);
        ctx.stroke();

        // 双眼：左眼粉，右眼青
        const eyeSize = Math.min(w, h) * 0.08;
        const eyeY = -h * 0.18;
        // 左眼（粉）
        ctx.beginPath();
        ctx.moveTo(-w * 0.25, eyeY + eyeSize * 0.7);
        ctx.lineTo(-w * 0.25 + eyeSize * 0.7, eyeY - eyeSize * 0.4);
        ctx.lineTo(-w * 0.25 - eyeSize * 0.7, eyeY - eyeSize * 0.4);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        ctx.fill();
        ctx.strokeStyle = OUTLINE_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
        // 右眼（青）
        ctx.beginPath();
        ctx.moveTo(w * 0.25, eyeY + eyeSize * 0.7);
        ctx.lineTo(w * 0.25 + eyeSize * 0.7, eyeY - eyeSize * 0.4);
        ctx.lineTo(w * 0.25 - eyeSize * 0.7, eyeY - eyeSize * 0.4);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.CYAN;
        ctx.fill();
        ctx.stroke();

        // 狂暴：底部加 zigzag 尾（黄）
        if (isBerserk) {
            ctx.strokeStyle = PROMARE_PALETTE.YELLOW;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, h * 0.30);
            ctx.lineTo(w * 0.08, h * 0.36);
            ctx.lineTo(-w * 0.06, h * 0.42);
            ctx.lineTo(w * 0.06, h * 0.48);
            ctx.stroke();
        }
    },

    // B) 8 □ 围成环（drawer 接管）—— 形式是 ○，语义是 □ 序列
    boss_ouroboros: (ctx, w, h, t, frame, isBerserk) => {
        const cellCount = 8;
        const r = Math.min(w, h) * 0.42;
        const cellSize = r * 0.5;
        // 12fps stepped 旋转
        const baseRot = Math.floor(frame / 5) * (Math.PI / 12);
        const rotSpeed = isBerserk ? 2.0 : 1.0;
        ctx.rotate(baseRot * rotSpeed);

        for (let i = 0; i < cellCount; i++) {
            const a = (i / cellCount) * Math.PI * 2;
            const cx = Math.cos(a) * r;
            const cy = Math.sin(a) * r;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a);
            // 第一个方块（"头"）用粉色，其余暗紫
            const fill = (i === 0) ? PROMARE_PALETTE.PINK : BOSS_BASE_COLOR;
            _drawPromareSquare(ctx, -cellSize / 2, -cellSize / 2, cellSize, cellSize, fill);
            ctx.restore();
        }

        // 头方块内贴白 △（"咬"）
        const headA = baseRot * rotSpeed;
        const headX = Math.cos(headA) * r;
        const headY = Math.sin(headA) * r;
        ctx.save();
        ctx.translate(headX, headY);
        ctx.rotate(headA);
        const ts = cellSize * 0.35;
        ctx.beginPath();
        ctx.moveTo(-ts, 0);
        ctx.lineTo(ts * 0.5, ts * 0.5);
        ctx.lineTo(ts * 0.5, -ts * 0.5);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.fill();
        ctx.restore();
    },
};
