/**
 * promare_projectile_draw.js - 普罗米亚风格子弹绘制
 *
 * 按 projectile.config 的元素字段分派到对应几何形状：
 *   pyro → cone3 / cryo → oct2 / lightning → zigzagZ / pierce → lance4 /
 *   bounce → hex6 / scatter → star4 / wind → crescent /
 *   laser → ringDouble / flying_sword → 简化剑形（保留几何但去流苏）/
 *   damage 默认 → diamond
 *
 * 所有几何沿 ctx.rotate(rotation) 已对齐速度方向（调用方在 drawVisuals 入口 rotate）。
 *
 * @perf-impact: 单子弹每帧 1-2 个 fill + 1 stroke，加法混合，<0.1ms。
 *               彻底跳过 shadowBlur（projectile.js classic 路径每帧 4-5 次 shadowBlur）。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';
import {
    drawShape_cone3, drawShape_oct2, drawShape_zigzagZ, drawShape_lance4,
    drawShape_hex6, drawShape_star4, drawShape_diamond, drawShape_crescent,
    drawShape_ringOuter, drawShape_ringInner, fillStroke_promare
} from './promare_shapes.js';

/**
 * Promare 风格子弹绘制。已假定调用方完成：
 *   ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} radius - 视觉半径
 * @param {object} config - projectile.config（包含 pyro/cryo/lightning/pierce/bounce/scatter/wind/isLaser/type 等字段）
 * @param {number} intensity - 强度（影响外发光与拖尾衔接）
 * @param {{x:number,y:number}} deformation - squash/stretch 形变倍率
 * @param {number} integrity - 耐久度 0..1（越低越脆）
 */
export function drawPromareProjectile(ctx, radius, config, intensity, deformation, integrity) {
    const cfg = config || {};
    const dx = (deformation && deformation.x) || 1;
    const dy = (deformation && deformation.y) || 1;

    // 形变缩放
    if (dx !== 1 || dy !== 1) ctx.scale(dx, dy);

    // 元素优先级（与 projectile classic 一致：飞剑/激光最优先，其次火/冰/雷，最后默认）
    if (cfg.type === 'flying_sword') {
        _drawFlyingSword(ctx, radius, intensity, integrity);
        return;
    }
    if (cfg.isLaser) {
        _drawLaser(ctx, radius, intensity);
        return;
    }
    if ((cfg.pyro || 0) > 0) {
        _drawElement(ctx, radius, drawShape_cone3, PROMARE_PALETTE.PINK, PROMARE_PALETTE.WHITE);
        return;
    }
    if ((cfg.cryo || 0) > 0) {
        _drawElement(ctx, radius, drawShape_oct2, PROMARE_PALETTE.CYAN, PROMARE_PALETTE.WHITE);
        return;
    }
    if ((cfg.lightning || 0) > 0) {
        _drawElement(ctx, radius, drawShape_zigzagZ, PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.WHITE);
        return;
    }
    if ((cfg.wind || 0) > 0) {
        _drawElement(ctx, radius, drawShape_crescent, PROMARE_PALETTE.CYAN, PROMARE_PALETTE.WHITE);
        return;
    }
    if ((cfg.pierce || 0) > 0) {
        _drawElement(ctx, radius, drawShape_lance4, PROMARE_PALETTE.WHITE, PROMARE_PALETTE.PINK, 1.5);
        return;
    }
    if ((cfg.bounce || 0) > 0) {
        _drawElement(ctx, radius, drawShape_hex6, PROMARE_PALETTE.PINK, PROMARE_PALETTE.YELLOW);
        return;
    }
    if ((cfg.scatter || 0) > 0) {
        _drawElement(ctx, radius, drawShape_star4, PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK);
        return;
    }
    if ((cfg.venom || 0) > 0) {
        _drawElement(ctx, radius, drawShape_diamond, PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK);
        return;
    }
    // 默认（纯白 / 多色 / matryoshka 等）：菱形
    _drawElement(ctx, radius, drawShape_diamond, PROMARE_PALETTE.WHITE, PROMARE_PALETTE.YELLOW);
}

// ==================== 单元素绘制（通用） ====================

function _drawElement(ctx, r, shapeFn, primary, accent, strokeWidth = 1) {
    // 外发光层：放大 1.4×，低 alpha
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.scale(1.4, 1.4);
    shapeFn(ctx, r);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = primary;
    ctx.fill();
    ctx.restore();

    // 主体：硬边 + 内描边
    shapeFn(ctx, r);
    fillStroke_promare(ctx, primary, accent, strokeWidth, 0.85);
}

// ==================== Laser：双同心环 ====================

function _drawLaser(ctx, r, intensity) {
    // 外环（CYAN halo）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawShape_ringOuter(ctx, r * 1.6);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = PROMARE_PALETTE.CYAN;
    ctx.fill();
    ctx.restore();

    // 内核（WHITE 实心圆）
    drawShape_ringInner(ctx, r * 1.2);
    ctx.fillStyle = PROMARE_PALETTE.WHITE;
    ctx.fill();

    // 描边
    drawShape_ringOuter(ctx, r);
    ctx.strokeStyle = PROMARE_PALETTE.WHITE;
    ctx.lineWidth = 2;
    ctx.stroke();
}

// ==================== Flying Sword：简化剑形 ====================

function _drawFlyingSword(ctx, r, intensity, integrity) {
    const scale = r / 6;
    // 剑身（WHITE 菱形长条，指向 +x）
    ctx.beginPath();
    ctx.moveTo(32 * scale, 0);
    ctx.lineTo(8 * scale, -3 * scale);
    ctx.lineTo(-12 * scale, -3 * scale);
    ctx.lineTo(-12 * scale, 3 * scale);
    ctx.lineTo(8 * scale, 3 * scale);
    ctx.closePath();
    ctx.fillStyle = PROMARE_PALETTE.WHITE;
    ctx.fill();
    ctx.strokeStyle = PROMARE_PALETTE.YELLOW;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 护手（YELLOW 短矩形）
    ctx.beginPath();
    ctx.rect(-14 * scale, -6 * scale, 4 * scale, 12 * scale);
    ctx.fillStyle = PROMARE_PALETTE.YELLOW;
    ctx.fill();

    // 剑柄（BLACK 短线）
    ctx.beginPath();
    ctx.moveTo(-14 * scale, 0);
    ctx.lineTo(-22 * scale, 0);
    ctx.strokeStyle = PROMARE_PALETTE.BLACK;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 剑首（PINK 小圆，仅完整耐久时显示）
    if (integrity > 0.5) {
        ctx.beginPath();
        ctx.arc(-22 * scale, 0, 1.8 * scale, 0, Math.PI * 2);
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        ctx.fill();
    }
}
