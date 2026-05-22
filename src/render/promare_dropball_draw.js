/**
 * promare_dropball_draw.js - 普罗米亚风格收集阶段弹珠（T2.D ○ 主体 + △ 特效版）
 *
 * 设计契约：docs/promare_visual_design_v2.md §2.1 是真理源。
 *   弹珠 = "○ 主体 + △ 特效" —— 因为弹珠是 Lio 召唤的"能源球"语义（被允许的"例外圆"），
 *   但围绕它的所有动作（trail / 撞击 flash / 元素 overlay）都是 △。
 *
 * 视觉结构（从底到顶）：
 *   1. 加速 trail：2 个 △ afterimage（速度 > 4 时），stepped 切换位置 + alpha 0.5/0.25
 *   2. ○ 阴影圆（偏 +2,+2 暗调色）
 *   3. ○ 主体圆（元素色）
 *   4. ○ 高光弧（1/3 圆，左上 12 到 2 点钟方向，白/暖黄）
 *   5. △ 元素 overlay（中心稍上方 1 个小 △，颜色 = 元素主色，每 5 帧 snap +30°）
 *
 * F2 兑现：所有 fill 走 source-over，不再 lighter 加光晕环。
 * F4 兑现：圆描边用元素色暗调（不用白）。
 * F1 兑现：元素 △ 旋转用 12fps stepped（不连续 rot）。
 *
 * @perf-impact: 单弹珠每帧 4-6 fill + 1-2 stroke（trail △ 占 0-2），无 shadowBlur。
 */

import { PROMARE_PALETTE, PROMARE_OUTLINES } from './promare_tokens.js';

// Trail 触发阈值：vel 模 > 4 才显示 trail（避免静止时 trail 残留）
const TRAIL_VEL_THRESHOLD = 4;

/**
 * @param {DropBall} ball
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number}} [tilt] - 板子倾斜（保留接口兼容性）
 */
export function drawPromareDropBall(ball, ctx, tilt) {
    if (!ball.active) return;

    const x = ball.pos.x;
    const y = ball.pos.y;
    const r = ball.radius || 8;

    // 推断主导元素 → 主色 + 暗调描边色
    const elementColor = _pickElementColor(ball);
    const outlineColor = PROMARE_OUTLINES[elementColor] || '#1B0B2E';
    const coreColor = (elementColor === PROMARE_PALETTE.WHITE)
        ? PROMARE_PALETTE.YELLOW
        : PROMARE_PALETTE.WHITE;

    // 12fps stepped frame（元素 △ 旋转）
    const frame = Math.floor(Date.now() / 83);
    const elemTriRot = (frame % 12) * (Math.PI / 6);  // 12 个角度槽

    // ===== 1. 加速 trail △（在 ball.pos 之外画，先于本体）=====
    if (ball.vel) {
        const speed = Math.hypot(ball.vel.x, ball.vel.y);
        if (speed > TRAIL_VEL_THRESHOLD) {
            const dirA = Math.atan2(ball.vel.y, ball.vel.x);
            // 单位向量沿反方向
            const ux = -Math.cos(dirA);
            const uy = -Math.sin(dirA);
            // 2 个 afterimage △（offset 6px 和 12px）
            _drawTrailTri(ctx, x + ux * 6, y + uy * 6, r * 0.7, dirA, elementColor, 0.5);
            _drawTrailTri(ctx, x + ux * 12, y + uy * 12, r * 0.5, dirA, elementColor, 0.25);
        }
    }

    ctx.save();
    ctx.translate(x, y);

    // ===== 2. ○ 阴影圆 =====
    ctx.fillStyle = outlineColor;
    ctx.beginPath();
    ctx.arc(2, 2, r, 0, Math.PI * 2);
    ctx.fill();

    // ===== 3. ○ 主体圆 =====
    ctx.fillStyle = elementColor;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 整圈暗描边
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // ===== 4. ○ 高光弧（左上 1/3 圆，~10 到 2 点钟方向）=====
    ctx.lineWidth = 2;
    ctx.strokeStyle = coreColor;
    ctx.beginPath();
    // 角度：从 -150° (10 点钟) 到 -30° (2 点钟)
    ctx.arc(0, 0, r * 0.85, -Math.PI * 5 / 6, -Math.PI / 6);
    ctx.stroke();

    // ===== 5. △ 元素 overlay（中心稍上方）=====
    ctx.save();
    ctx.translate(0, -r * 0.15);
    ctx.rotate(elemTriRot);
    const triR = r * 0.45;
    // 三角顶点朝上
    ctx.beginPath();
    ctx.moveTo(0, -triR);
    ctx.lineTo(triR * 0.8, triR * 0.5);
    ctx.lineTo(-triR * 0.8, triR * 0.5);
    ctx.closePath();
    ctx.fillStyle = coreColor;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
}

// ==================== Trail △ helper ====================

function _drawTrailTri(ctx, x, y, size, angle, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);   // 三角顶端朝运动方向
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    // 长 △（顶尖朝 +x = 速度方向）
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.8, size * 0.5);
    ctx.lineTo(-size * 0.8, -size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ==================== 主导元素 → 色 ====================

function _pickElementColor(ball) {
    const def = ball.def || {};
    const t = def.type || '';
    if (t === 'pyro' || def.pyro) return PROMARE_PALETTE.PINK;
    if (t === 'cryo' || def.cryo) return PROMARE_PALETTE.CYAN;
    if (t === 'lightning' || def.lightning) return PROMARE_PALETTE.YELLOW;
    if (t === 'wind' || def.wind) return PROMARE_PALETTE.CYAN;
    if (t === 'pierce' || def.pierce) return PROMARE_PALETTE.WHITE;
    if (t === 'bounce' || def.bounce) return PROMARE_PALETTE.PINK;
    if (t === 'scatter' || def.scatter) return PROMARE_PALETTE.YELLOW;
    if (t === 'venom' || def.venom) return PROMARE_PALETTE.YELLOW;
    if (t === 'laser' || def.laser) return PROMARE_PALETTE.CYAN;
    if (t === 'rainbow') return PROMARE_PALETTE.PINK;
    return PROMARE_PALETTE.WHITE;
}
