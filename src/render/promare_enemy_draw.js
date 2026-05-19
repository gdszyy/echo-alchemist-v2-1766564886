/**
 * promare_enemy_draw.js - 普罗米亚风格敌人体 + 词缀 overlay
 *
 * 敌人体：黑底 + 白边 + 加法外发光层；血条 = 底向上白矩形 + 延迟条。
 * 词缀 overlay：10 种几何 pattern，按 affix 名 dispatch；每个 affix 锚点正交不重叠。
 *
 * 设计原则（design plan §3.2 / §4.D1）：
 * - 跳过 _textureCanvas（offscreen noise） — promare 是 flat
 * - 跳过所有 createLinearGradient + shadowBlur
 * - 不改 collisionData（physics 用），仅改 fill/stroke
 *
 * @perf-impact: 单敌人每帧 1-3 fill + 1-2 stroke + 0-3 affix overlay
 *               classic 路径每帧 ≥6 个渐变 + 1 shadowBlur，本路径净省。
 */

import { PROMARE_PALETTE, AFFIX_CODEX } from './promare_tokens.js';
import { drawShape_oct2 } from './promare_shapes.js';
import { drawPromareBoss } from './promare_boss_draw.js';

// 调用契约：调用方已经 ctx.save() / translate / scale / rotate 到敌人本地坐标系。
// 我们只画本地坐标里的几何，画完不 restore（调用方负责）。
export function drawPromareEnemyBody(enemy, ctx, w, h) {
    // ===== 1. 容器轮廓 =====
    ctx.beginPath();
    const cs = enemy.collisionShape;
    if (cs === 'polygon' && enemy.collisionData && enemy.collisionData.vertices && enemy.collisionData.vertices.length >= 3) {
        const verts = enemy.collisionData.vertices;
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();
    } else if (cs === 'arc' && enemy.collisionData) {
        // 环形 Boss（如 Ouroboros）：渲染为厚环
        const cd = enemy.collisionData;
        const outerR = cd.radius + cd.thickness * 0.5;
        const innerR = Math.max(0, cd.radius - cd.thickness * 0.5);
        ctx.arc(0, 0, outerR, 0, Math.PI * 2);
        if (innerR > 0) {
            ctx.moveTo(innerR, 0);
            ctx.arc(0, 0, innerR, 0, Math.PI * 2, true);
        }
    } else {
        // 默认矩形（square-cut，不圆角）
        ctx.rect(-w / 2, -h / 2, w, h);
    }

    // ===== 2. BLACK 填充 + WHITE 描边（双层假发光）=====
    ctx.save();
    ctx.fillStyle = PROMARE_PALETTE.BLACK;
    ctx.fill();
    ctx.strokeStyle = PROMARE_PALETTE.WHITE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 加法外描边（伪外发光，无 shadowBlur）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 4;
    ctx.strokeStyle = PROMARE_PALETTE.WHITE;
    ctx.stroke();
    ctx.restore();

    // ===== 3. 状态 overlay（frozen / burning / venom）=====
    if (enemy.isFrozenCurrentTurn || (enemy.frozenCount && enemy.frozenCount > 0)) {
        _drawFrozenOverlay(ctx, w, h);
    }
    if (enemy.temp && enemy.temp > 30) {
        _drawBurnOverlay(ctx, w, h);
    }
    if (enemy.venomStacks && enemy.venomStacks > 0) {
        _drawVenomOverlay(ctx, w, h);
    }

    // ===== 4. HP 条（底向上 WHITE 矩形）=====
    if (enemy.maxHp && enemy.hp !== undefined) {
        const hpRatio = Math.max(0, Math.min(1, (enemy.displayHp != null ? enemy.displayHp : enemy.hp) / enemy.maxHp));
        const delayedRatio = Math.max(0, Math.min(1, (enemy.delayedHp != null ? enemy.delayedHp / enemy.maxHp : hpRatio)));

        // 延迟白条（hpRatio < delayedRatio 时显示差额，用于「掉血动画」）
        if (delayedRatio > hpRatio + 0.01) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = PROMARE_PALETTE.WHITE;
            const dh = h * delayedRatio;
            ctx.fillRect(-w / 2, h / 2 - dh, w, dh);
            ctx.restore();
        }
        // 主血条
        if (hpRatio > 0) {
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = PROMARE_PALETTE.WHITE;
            const hbH = h * hpRatio;
            ctx.fillRect(-w / 2, h / 2 - hbH, w, hbH);
            ctx.restore();
        }
        // 顶部 hp 分隔细线
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const hbY = h / 2 - h * hpRatio;
        ctx.moveTo(-w / 2, hbY);
        ctx.lineTo(w / 2, hbY);
        ctx.stroke();
        ctx.restore();
    }

    // ===== 5. Boss 专属 glyph（在 affix 之前，让 affix 覆盖在 glyph 之上）=====
    if (enemy.type === 'boss' && enemy.bossType) {
        drawPromareBoss(enemy, ctx, w, h);
    }

    // ===== 6. 词缀 overlay 派发 =====
    if (Array.isArray(enemy.affixes) && enemy.affixes.length > 0) {
        const t = Date.now() / 1000;
        for (let i = 0; i < enemy.affixes.length; i++) {
            const affix = enemy.affixes[i];
            const drawer = AFFIX_DRAWERS[affix];
            if (drawer) drawer(ctx, w, h, t, enemy);
        }
    }
}

// ==================== 词缀 overlay drawer ====================

function _drawFrozenOverlay(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    // 全身 cyan 菱形网格
    const step = Math.min(w, h) / 4;
    for (let yy = -h / 2; yy <= h / 2; yy += step) {
        for (let xx = -w / 2; xx <= w / 2; xx += step) {
            ctx.beginPath();
            ctx.moveTo(xx, yy - step / 3);
            ctx.lineTo(xx + step / 3, yy);
            ctx.lineTo(xx, yy + step / 3);
            ctx.lineTo(xx - step / 3, yy);
            ctx.closePath();
            ctx.fillStyle = PROMARE_PALETTE.CYAN;
            ctx.fill();
        }
    }
    ctx.restore();
}

function _drawBurnOverlay(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    // 顶边锯齿
    const teeth = 8;
    const tw = w / teeth;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    for (let i = 0; i < teeth; i++) {
        ctx.lineTo(-w / 2 + i * tw + tw / 2, -h / 2 - tw * 0.6);
        ctx.lineTo(-w / 2 + (i + 1) * tw, -h / 2);
    }
    ctx.lineTo(w / 2, -h / 2);
    ctx.closePath();
    ctx.fillStyle = PROMARE_PALETTE.PINK;
    ctx.fill();
    ctx.restore();
}

function _drawVenomOverlay(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    // 底部铺贴倒三角
    const cnt = 5;
    const tw = w / cnt;
    for (let i = 0; i < cnt; i++) {
        const cx = -w / 2 + i * tw + tw / 2;
        const cy = h / 2 - tw * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy + tw * 0.35);
        ctx.lineTo(cx + tw * 0.35, cy - tw * 0.2);
        ctx.lineTo(cx - tw * 0.35, cy - tw * 0.2);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.YELLOW;
        ctx.fill();
    }
    ctx.restore();
}

// ==================== 10 词缀 overlay drawer ====================

const AFFIX_DRAWERS = {
    shield: (ctx, w, h /*, t */) => {
        // 六边蜂巢网格全身
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 1;
        const hx = w / 6;
        const hy = h / 6;
        for (let row = -2; row <= 2; row++) {
            for (let col = -2; col <= 2; col++) {
                const cx = col * hx * 2 + (row % 2 === 0 ? 0 : hx);
                const cy = row * hy * 1.6;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    const px = cx + Math.cos(a) * hx;
                    const py = cy + Math.sin(a) * hy;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
        ctx.restore();
    },

    regen: (ctx, w, h, t) => {
        // 向上滚动 chevron 条带：3 层 ^ 形
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 2;
        const scroll = (t * 0.6) % 1;
        const bandH = h * 0.18;
        for (let i = 0; i < 4; i++) {
            const yy = h / 2 - bandH * (i + scroll);
            ctx.beginPath();
            ctx.moveTo(-w / 2, yy);
            ctx.lineTo(0, yy - bandH * 0.4);
            ctx.lineTo(w / 2, yy);
            ctx.stroke();
        }
        ctx.restore();
    },

    haste: (ctx, w, h, t) => {
        // 双 45° 速度斜条
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = PROMARE_PALETTE.YELLOW;
        const phase = (t * 8) % w;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
        ctx.clip();
        ctx.translate(-phase, 0);
        for (let i = -1; i < 3; i++) {
            ctx.beginPath();
            const x0 = i * w * 0.45;
            ctx.moveTo(x0, -h / 2);
            ctx.lineTo(x0 + 8, -h / 2);
            ctx.lineTo(x0 + h + 8, h / 2);
            ctx.lineTo(x0 + h, h / 2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        ctx.restore();
    },

    clone: (ctx, w, h) => {
        // 5 个硬边菱形 + ±2px 镜像偏移
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        const positions = [
            { x: 0, y: 0 },
            { x: w * 0.28, y: -h * 0.22 },
            { x: -w * 0.28, y: -h * 0.22 },
            { x: w * 0.28, y: h * 0.22 },
            { x: -w * 0.28, y: h * 0.22 },
        ];
        const dr = Math.min(w, h) * 0.08;
        for (const p of positions) {
            for (let off = -2; off <= 2; off += 2) {
                ctx.beginPath();
                ctx.moveTo(p.x + off, p.y - dr);
                ctx.lineTo(p.x + dr + off, p.y);
                ctx.lineTo(p.x + off, p.y + dr);
                ctx.lineTo(p.x - dr + off, p.y);
                ctx.closePath();
                ctx.globalAlpha = (off === 0) ? 0.7 : 0.25;
                ctx.fill();
            }
        }
        ctx.restore();
    },

    healer: (ctx, w, h) => {
        // 8 辐射线星爆
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 2;
        const r = Math.min(w, h) * 0.35;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
        ctx.restore();
    },

    devour: (ctx, w, h) => {
        // 4 角内向 chevron 指中心
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = PROMARE_PALETTE.PINK;
        ctx.lineWidth = 2;
        const corners = [
            { x: -w * 0.45, y: -h * 0.45, ax: 1, ay: 1 },
            { x:  w * 0.45, y: -h * 0.45, ax: -1, ay: 1 },
            { x:  w * 0.45, y:  h * 0.45, ax: -1, ay: -1 },
            { x: -w * 0.45, y:  h * 0.45, ax: 1, ay: -1 },
        ];
        const len = Math.min(w, h) * 0.15;
        for (const c of corners) {
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(c.x + c.ax * len, c.y);
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(c.x, c.y + c.ay * len);
            ctx.stroke();
        }
        ctx.restore();
    },

    jump: (ctx, w, h, t) => {
        // 底部 3 行向上 chevron 梯 + bounce 脉冲
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(t * 6) * 0.15;
        ctx.strokeStyle = PROMARE_PALETTE.YELLOW;
        ctx.lineWidth = 2;
        const stepY = h * 0.1;
        for (let i = 0; i < 3; i++) {
            const yy = h * 0.45 - i * stepY;
            ctx.beginPath();
            ctx.moveTo(-w * 0.25, yy);
            ctx.lineTo(0, yy - stepY * 0.4);
            ctx.lineTo(w * 0.25, yy);
            ctx.stroke();
        }
        ctx.restore();
    },

    berserk: (ctx, w, h, t) => {
        // 顶边横滚锯齿牙
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        const teeth = 10;
        const tw = w / teeth;
        const scroll = (t * 12) % tw;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h * 0.45);
        for (let i = -1; i <= teeth; i++) {
            const x0 = -w / 2 + i * tw - scroll;
            ctx.lineTo(x0 + tw / 2, -h * 0.45 - tw * 0.4);
            ctx.lineTo(x0 + tw, -h * 0.45);
        }
        ctx.lineTo(w / 2, -h * 0.45);
        ctx.lineTo(w / 2, -h / 2);
        ctx.lineTo(-w / 2, -h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    heavyArmor: (ctx, w, h) => {
        // 交叉 × 全身
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-w * 0.4, -h * 0.4);
        ctx.lineTo(w * 0.4, h * 0.4);
        ctx.moveTo(w * 0.4, -h * 0.4);
        ctx.lineTo(-w * 0.4, h * 0.4);
        ctx.stroke();
        ctx.restore();
    },

    deflectionWard: (ctx, w, h) => {
        // 单 chevron + halo 环
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = PROMARE_PALETTE.CYAN;
        ctx.lineWidth = 2;
        // 上部 chevron
        ctx.beginPath();
        ctx.moveTo(-w * 0.25, -h * 0.15);
        ctx.lineTo(0, -h * 0.32);
        ctx.lineTo(w * 0.25, -h * 0.15);
        ctx.stroke();
        // halo 环
        ctx.beginPath();
        ctx.arc(0, -h * 0.05, Math.min(w, h) * 0.32, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
        ctx.restore();
    },
};
