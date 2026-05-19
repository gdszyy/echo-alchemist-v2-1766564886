/**
 * promare_peg_draw.js - 普罗米亚风格钉子绘制
 *
 * 钉子统一形状 = 菱形（diamond），通过中心叠加的元素 glyph 区分类型。
 * 命中态用白色辐射环 + 内部反色；冷却用半透明黑色扇形遮罩（保留原有 UX）。
 *
 * 设计原则：
 * - 普通钉 = 半透明白菱形，不抢戏
 * - 特殊钉 = 主色硬切菱形 + 中心元素几何 glyph
 * - 命中瞬间 = 整体替换为 WHITE + 短暂尺寸放大
 * - 不用 shadowBlur，发光层用加法 fill 叠层
 *
 * @perf-impact: 单钉子每帧 1-3 个 fill + 0-1 stroke，无 shadowBlur。
 *               classic 路径每帧 createRadialGradient + shadowBlur 至少 1 次，本路径净省。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';
import {
    drawShape_cone3, drawShape_oct2, drawShape_zigzagZ, drawShape_lance4,
    drawShape_hex6, drawShape_star4, drawShape_diamond, drawShape_crescent,
    drawShape_triDown, drawShape_ringOuter, drawShape_ringInner
} from './promare_shapes.js';

// 元素 type → glyph 绘制函数 + 颜色
const TYPE_GLYPH = {
    pyro:         { fn: drawShape_cone3,    color: PROMARE_PALETTE.PINK   },
    cryo:         { fn: drawShape_oct2,     color: PROMARE_PALETTE.CYAN   },
    lightning:    { fn: drawShape_zigzagZ,  color: PROMARE_PALETTE.YELLOW },
    pierce:       { fn: drawShape_lance4,   color: PROMARE_PALETTE.WHITE  },
    bounce:       { fn: drawShape_hex6,     color: PROMARE_PALETTE.PINK   },
    scatter:      { fn: drawShape_star4,    color: PROMARE_PALETTE.YELLOW },
    damage:       { fn: drawShape_diamond,  color: PROMARE_PALETTE.WHITE  },
    wind:         { fn: drawShape_crescent, color: PROMARE_PALETTE.CYAN   },
    laser:        { fn: drawShape_ringOuter,color: PROMARE_PALETTE.CYAN   }, // 同心环
    venom:        { fn: drawShape_triDown,  color: PROMARE_PALETTE.YELLOW },
    resonance:    { fn: drawShape_ringInner,color: PROMARE_PALETTE.YELLOW },
    flying_sword: { fn: drawShape_lance4,   color: PROMARE_PALETTE.YELLOW },
    pink:         { fn: null,               color: PROMARE_PALETTE.PINK   }, // 无 glyph 纯色
};

/**
 * 主入口：peg 实例 + ctx + 基础半径。
 * 调用方契约：与 classic 的 Peg.draw(ctx, baseRadius, tilt) 一致。
 *
 * @param {Peg} peg
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} baseRadius
 */
export function drawPromarePeg(peg, ctx, baseRadius /*, tilt */) {
    const r = baseRadius * (peg.scale || 1);
    const x = peg.pos.x;
    const y = peg.pos.y;
    const type = peg.type || 'normal';
    const isSpecial = type !== 'normal';
    const isLit = !!peg.lit;
    const isFrozen = (peg.frozenTurns || 0) > 0;

    ctx.save();
    ctx.translate(x, y);

    // 击打瞬间小幅旋转
    if (peg.impactAngle) ctx.rotate(peg.impactAngle);

    // ===== 1. 基底菱形（容器）=====
    const diamondR = r * 1.4;

    // 主菱形
    drawShape_diamond(ctx, diamondR);
    if (isLit) {
        // 命中瞬间：实心白色 + 加法光圈
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.fill();
        // 外发光
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.scale(1.8, 1.8);
        drawShape_diamond(ctx, diamondR);
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.fill();
        ctx.restore();
    } else if (isSpecial) {
        // 特殊钉子：主色硬切填充
        const glyph = TYPE_GLYPH[type] || TYPE_GLYPH.damage;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = glyph.color;
        ctx.fill();
        ctx.restore();
        // 内描边
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.stroke();
    } else {
        // 普通钉子：半透明白菱形
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.fill();
        ctx.restore();
        // 描黑边强化几何感
        ctx.lineWidth = 1;
        ctx.strokeStyle = PROMARE_PALETTE.BLACK;
        ctx.stroke();
    }

    // ===== 2. 中心元素 glyph =====
    if (isSpecial && !isLit && TYPE_GLYPH[type] && TYPE_GLYPH[type].fn) {
        const glyph = TYPE_GLYPH[type];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glyphR = r * 0.7;
        glyph.fn(ctx, glyphR);
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.restore();
    }

    // ===== 3. 冷却扇形遮罩（保留原 UX）=====
    if (peg.cooldownTimer && peg.cooldownTimer > 0) {
        const progress = peg.cooldownTimer / (peg.dynamicCooldown || 12);
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, diamondR + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ===== 4. 等级 pip（黄色小菱形，3 级用 3 个）=====
    if (peg.level && peg.level > 1) {
        const pipCount = Math.min(3, peg.level);
        const pipR = r * 0.18;
        for (let i = 0; i < pipCount; i++) {
            ctx.save();
            ctx.translate((i - (pipCount - 1) / 2) * pipR * 2.2, -diamondR * 0.65);
            drawShape_diamond(ctx, pipR);
            ctx.fillStyle = PROMARE_PALETTE.YELLOW;
            ctx.fill();
            ctx.restore();
        }
    }

    // ===== 5. 冰冻状态（Glacies 狂暴）=====
    if (isFrozen) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        drawShape_oct2(ctx, diamondR * 1.2);
        ctx.fillStyle = PROMARE_PALETTE.CYAN;
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}
