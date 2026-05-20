/**
 * promare_boss_draw.js - 8 个 Boss 的普罗米亚几何 silhouette
 *
 * 每个 boss 一个独特的 glyph 叠加在敌人体上方。狂暴态用 2× 脉冲 + 加速 + 加 spoke 表达，
 * 不换色（见 design plan §3.3 / §7.4）。
 *
 * 调用约定：调用方已在敌人本地坐标系内（中心 (0,0)）。
 * @perf-impact: 单 boss 每帧 1-10 个 fill + stroke 几何，无 shadowBlur。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';
import { drawShape_oct2, drawShape_hex6 } from './promare_shapes.js';

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
    const pulse = Math.sin(t * 2) * 0.25 + 0.75;
    const isBerserk = !!enemy.berserked;

    ctx.save();
    drawer(ctx, w, h, t, pulse, isBerserk);
    ctx.restore();
}

// ==================== 8 Boss drawer ====================

const BOSS_DRAWERS = {
    /** 伊格尼斯：三尖塔（向上等腰三角 + 3 内嵌同心三角）+ 狂暴喷射 cone */
    boss_ignis: (ctx, w, h, t, pulse, isBerserk) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.85;
        // 主三尖塔
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.40);
        ctx.lineTo(w * 0.3, h * 0.30);
        ctx.lineTo(-w * 0.3, h * 0.30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 内嵌 2 个同心三角
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = PROMARE_PALETTE.YELLOW;
        for (let i = 1; i <= 2; i++) {
            const s = 1 - i * 0.32;
            ctx.beginPath();
            ctx.moveTo(0, -h * 0.40 * s);
            ctx.lineTo(w * 0.3 * s, h * 0.30 * s);
            ctx.lineTo(-w * 0.3 * s, h * 0.30 * s);
            ctx.closePath();
            ctx.fill();
        }
        // 狂暴：每尖角额外喷 cone
        if (isBerserk) {
            ctx.globalAlpha = 0.55 * pulse;
            ctx.fillStyle = PROMARE_PALETTE.PINK;
            const corners = [{ x: 0, y: -h * 0.40 }, { x: w * 0.3, y: h * 0.30 }, { x: -w * 0.3, y: h * 0.30 }];
            for (const c of corners) {
                ctx.beginPath();
                ctx.moveTo(c.x, c.y);
                ctx.lineTo(c.x * 1.6, c.y * 1.6);
                ctx.lineTo(c.x * 1.6 + w * 0.05, c.y * 1.6 + h * 0.05);
                ctx.lineTo(c.x * 1.6 - w * 0.05, c.y * 1.6 - h * 0.05);
                ctx.closePath();
                ctx.fill();
            }
        }
    },

    /** 格拉西斯：体型八面体 + 向上 shard，狂暴时 shard 数翻倍 */
    boss_glacies: (ctx, w, h, t, pulse, isBerserk) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.85;
        const r = Math.min(w, h) * 0.4;
        // 主八面体
        ctx.fillStyle = PROMARE_PALETTE.CYAN;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 2;
        drawShape_oct2(ctx, r);
        ctx.fill();
        ctx.stroke();
        // 上方 shard 群
        const shardCount = isBerserk ? 6 : 3;
        const lenMult = isBerserk ? 1.5 : 1.0;
        const shardLen = r * 0.7 * lenMult;
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        for (let i = 0; i < shardCount; i++) {
            const ang = -Math.PI / 2 + (i - (shardCount - 1) / 2) * 0.3;
            const cx = Math.cos(ang) * r * 1.1;
            const cy = Math.sin(ang) * r * 1.1;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang + Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, -shardLen);
            ctx.lineTo(r * 0.12, 0);
            ctx.lineTo(0, r * 0.1);
            ctx.lineTo(-r * 0.12, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    },

    /** 米克罗：3×3 大六边形群，狂暴时三帧色相 flicker */
    boss_micro: (ctx, w, h, t, pulse, isBerserk) => {
        ctx.globalCompositeOperation = 'lighter';
        const hx = Math.min(w, h) * 0.15;
        const cols = 3, rows = 3;
        const flickerColor = isBerserk
            ? ((Math.floor(t * 6) % 3 === 0) ? PROMARE_PALETTE.PINK : PROMARE_PALETTE.YELLOW)
            : PROMARE_PALETTE.YELLOW;
        ctx.fillStyle = flickerColor;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.7;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = (c - 1) * hx * 1.8 + ((r % 2) * hx * 0.9);
                const cy = (r - 1) * hx * 1.6;
                ctx.save();
                ctx.translate(cx, cy);
                drawShape_hex6(ctx, hx);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }
    },

    /** 噬神者：倒三角切口（destination-out）+ 8 内向 chevron */
    boss_devourer: (ctx, w, h, t, pulse, isBerserk) => {
        // 倒三角切口（暗示「口」）
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.30);
        ctx.lineTo(w * 0.40, -h * 0.30);
        ctx.lineTo(-w * 0.40, -h * 0.30);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
        // 8 个内向 chevron（狂暴 12 个，加速）
        ctx.globalCompositeOperation = 'lighter';
        const chCount = isBerserk ? 12 : 8;
        const spin = (t * (isBerserk ? 1.6 : 1.0)) % (Math.PI * 2);
        const r = Math.min(w, h) * 0.42;
        ctx.strokeStyle = PROMARE_PALETTE.PINK;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < chCount; i++) {
            const a = spin + (i / chCount) * Math.PI * 2;
            const tipX = Math.cos(a) * r * 0.55;
            const tipY = Math.sin(a) * r * 0.55;
            const baseAng = a + Math.PI / 8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(baseAng) * r, Math.sin(baseAng) * r);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(Math.cos(a - Math.PI / 8) * r, Math.sin(a - Math.PI / 8) * r);
            ctx.stroke();
        }
    },

    /** 维里迪斯：6 辐射线星号，狂暴时 pulse scale */
    boss_viridis: (ctx, w, h, t, pulse, isBerserk) => {
        const r = Math.min(w, h) * 0.45;
        const scale = isBerserk ? (1.0 + Math.sin(t * 4) * 0.15) : 1.0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = PROMARE_PALETTE.YELLOW;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const xe = Math.cos(a) * r * scale;
            const ye = Math.sin(a) * r * scale;
            ctx.moveTo(-xe * 0.1, -ye * 0.1);
            ctx.lineTo(xe, ye);
        }
        ctx.stroke();
        // 中心圆点
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
    },

    /** 特斯拉：三重嵌套反旋多边形（△ 内 / ⬠ 中 / ⬡ 外）*/
    boss_tesla: (ctx, w, h, t, pulse, isBerserk) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = PROMARE_PALETTE.YELLOW;
        ctx.lineWidth = 2;
        const baseR = Math.min(w, h);
        const innerMult = isBerserk ? 4 : 1;
        // 外 ⬡ - 顺时针
        _drawNGon(ctx, baseR * 0.45, 7, t * 0.4);
        ctx.stroke();
        // 中 ⬠ - 逆时针
        _drawNGon(ctx, baseR * 0.35, 5, -t * 0.7);
        ctx.stroke();
        // 内 △ - 顺时针更快
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 2.5;
        _drawNGon(ctx, baseR * 0.22, 3, t * 1.2 * innerMult);
        ctx.stroke();
    },

    /** 奇美拉：双对开 chevron 蝴蝶结 */
    boss_chimera: (ctx, w, h, t, pulse, isBerserk) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 2;
        // 左 chevron
        ctx.beginPath();
        ctx.moveTo(-w * 0.45, -h * 0.25);
        ctx.lineTo(0, 0);
        ctx.lineTo(-w * 0.45, h * 0.25);
        ctx.lineTo(-w * 0.30, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 右 chevron
        ctx.beginPath();
        ctx.moveTo(w * 0.45, -h * 0.25);
        ctx.lineTo(0, 0);
        ctx.lineTo(w * 0.45, h * 0.25);
        ctx.lineTo(w * 0.30, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 狂暴：底部加垂直 zigzag 尾
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

    /** 奥罗波罗斯：厚环切 1/4 缺口 + 小三角头咬入 */
    boss_ouroboros: (ctx, w, h, t, pulse, isBerserk) => {
        const r = Math.min(w, h) * 0.45;
        const thickness = r * 0.18;
        const outerR = r;
        const innerR = r - thickness;
        const notchHalf = isBerserk ? Math.PI / 3 : Math.PI / 4; // 狂暴时缺口扩大
        const rotSpeed = isBerserk ? 2.0 : 1.0;
        const baseRot = t * 0.4 * rotSpeed;
        ctx.rotate(baseRot);
        // 厚环
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.strokeStyle = PROMARE_PALETTE.PINK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, outerR, notchHalf, Math.PI * 2 - notchHalf);
        ctx.arc(0, 0, innerR, Math.PI * 2 - notchHalf, notchHalf, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 小三角头咬入缺口
        const headX = Math.cos(notchHalf) * (outerR - thickness / 2);
        const headY = Math.sin(notchHalf) * (outerR - thickness / 2);
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - thickness, headY + thickness * 0.6);
        ctx.lineTo(headX - thickness, headY - thickness * 0.6);
        ctx.closePath();
        ctx.fill();
    },
};

// ==================== 工具：画 N 边正多边形 ====================

function _drawNGon(ctx, r, n, rotation) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rotation - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}
