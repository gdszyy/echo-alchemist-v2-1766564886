/**
 * promare_dropball_draw.js - 普罗米亚风格收集阶段弹珠绘制
 *
 * 6 顶点正多边形（icosahedron-projected）+ 平面光照感（交替三角填白）+
 * 外 1.4r billboard 光环（颜色按主导元素决定）。
 *
 * 设计原则：
 * - 弹珠是玩家化身，必须高辨识。6 边面化保留切面感（不是圆）。
 * - 颜色由 buff 主导元素决定（pyro=PINK, cryo=CYAN, lightning=YELLOW, 默认 WHITE）。
 * - 无 shadowBlur，光晕用加法叠层。
 *
 * @perf-impact: 单弹珠每帧 ≤4 个 fill + 1 stroke，无 shadowBlur。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';

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
    const rot = (ball.lifeTime || 0) * 0.02;

    // 推断主导元素 → 主色
    const accentColor = _pickAccent(ball);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // ===== 1. 外 billboard 光晕环（加法）=====
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ===== 2. 6 顶点正六边形 body（已 rotate）=====
    const verts = [];
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    // 主体填白
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.fillStyle = PROMARE_PALETTE.WHITE;
    ctx.fill();

    // 交替三角面用 BLACK 0.15α 模拟切面（从中心到每条边）
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = PROMARE_PALETTE.BLACK;
    for (let i = 0; i < 6; i += 2) {
        const a = verts[i];
        const b = verts[(i + 1) % 6];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    // 描边（accent 色）
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ===== 3. 中心小钻石（强调切面感）=====
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.35);
    ctx.lineTo(r * 0.35, 0);
    ctx.lineTo(0, r * 0.35);
    ctx.lineTo(-r * 0.35, 0);
    ctx.closePath();
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.restore();
}

// ==================== 主导元素 → 色 ====================

function _pickAccent(ball) {
    // 优先看 def.type / 主导 buff
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
    // 默认中性
    return PROMARE_PALETTE.WHITE;
}
