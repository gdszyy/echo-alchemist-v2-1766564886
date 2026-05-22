/**
 * promare_peg_draw.js - 普罗米亚风格钉子（T3.C 中性 ◆ + 元素色 + 顶 △ 标识版）
 *
 * 设计契约：docs/promare_visual_design_v2.md §3.1 是真理源。
 *   钉子 = "中性结构"（非玩家非敌人，是世界结构）→ 小 ◆ 菱形（4 顶点 □ 旋 45°）。
 *   元素 peg 在菱形顶部贴 1 个超小 △ 作为元素标识（不再用 cone3/oct2/zigzagZ 等
 *   零散形状 —— 那会稀释 vocabulary）。元素身份由"主菱形颜色 + 顶部 △"传达。
 *
 * 视觉结构：
 *   1. ◆ 主菱形：normal 半透白 + 暗紫描；element 主色填 + 暗调描
 *   2. △ 顶部标识（仅 element peg）：颜色 = 元素主色，每 6 帧 stepped pulse
 *   3. 命中态：snap scale 1.5× + 白闪 overlay（1 帧）
 *   4. 冷却扇形遮罩（保留原 UX）
 *   5. 等级 pip（顶部小黄菱形）
 *   6. 冰冻 overlay
 *
 * F2 兑现：去 lighter，所有 fill source-over
 * F4 兑现：描边用元素暗调（PROMARE_OUTLINES 查表）
 * F1 兑现：顶 △ pulse 用 12fps stepped frame
 *
 * @perf-impact: 单钉每帧 1-3 fill + 1 stroke，无 shadowBlur、无 lighter。比旧版省。
 */

import { PROMARE_PALETTE, PROMARE_OUTLINES } from './promare_tokens.js';
import { drawShape_diamond, drawShape_oct2 } from './promare_shapes.js';

// 元素 type → 主色（菱形填充色）
const TYPE_COLOR = {
    pyro:         PROMARE_PALETTE.PINK,
    bounce:       PROMARE_PALETTE.PINK,
    resonance:    PROMARE_PALETTE.PINK,
    cryo:         PROMARE_PALETTE.CYAN,
    wind:         PROMARE_PALETTE.CYAN,
    laser:        PROMARE_PALETTE.CYAN,
    lightning:    PROMARE_PALETTE.YELLOW,
    scatter:      PROMARE_PALETTE.YELLOW,
    venom:        PROMARE_PALETTE.YELLOW,
    damage:       PROMARE_PALETTE.WHITE,
    pierce:       PROMARE_PALETTE.WHITE,
    flying_sword: PROMARE_PALETTE.WHITE,
    pink:         PROMARE_PALETTE.PINK,
};

/**
 * 主入口：peg 实例 + ctx + 基础半径。
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

    const elementColor = TYPE_COLOR[type] || PROMARE_PALETTE.WHITE;
    const outlineColor = PROMARE_OUTLINES[elementColor] || '#1B0B2E';

    const diamondR = r * 1.4;

    ctx.save();
    ctx.translate(x, y);
    if (peg.impactAngle) ctx.rotate(peg.impactAngle);

    // ===== 1. 主菱形 =====
    if (isLit) {
        // 命中瞬间：snap scale 1.5× + 白闪填充
        ctx.save();
        ctx.scale(1.5, 1.5);
        drawShape_diamond(ctx, diamondR);
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = elementColor;
        ctx.stroke();
        ctx.restore();
    } else if (isSpecial) {
        // 元素 peg：主色填充 + 暗调描边
        drawShape_diamond(ctx, diamondR);
        ctx.fillStyle = elementColor;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = outlineColor;
        ctx.stroke();
    } else {
        // 普通 peg：半透白 + 暗紫描边
        ctx.save();
        ctx.globalAlpha = 0.75;
        drawShape_diamond(ctx, diamondR);
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1B0B2E';
        ctx.stroke();
    }

    // ===== 2. 元素 peg 顶部 △ 标识（stepped pulse）=====
    if (isSpecial && !isLit && type !== 'pink') {
        // 12fps stepped pulse：每 6 帧切换尺寸
        const frame = Math.floor(Date.now() / 83);
        const pulseScale = (frame % 6 < 3) ? 1.0 : 0.85;
        const triR = r * 0.55 * pulseScale;

        ctx.save();
        ctx.translate(0, -diamondR - triR * 0.2);
        ctx.beginPath();
        ctx.moveTo(0, -triR);
        ctx.lineTo(triR * 0.85, triR * 0.45);
        ctx.lineTo(-triR * 0.85, triR * 0.45);
        ctx.closePath();
        ctx.fillStyle = elementColor;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = outlineColor;
        ctx.stroke();
        ctx.restore();
    }

    // ===== 3. 冷却扇形遮罩（保留原 UX）=====
    if (peg.cooldownTimer && peg.cooldownTimer > 0) {
        const progress = peg.cooldownTimer / (peg.dynamicCooldown || 12);
        ctx.save();
        ctx.fillStyle = 'rgba(10, 5, 24, 0.7)';   // 深紫半透，不再纯黑
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, diamondR + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ===== 4. 等级 pip（黄色小菱形排上方）=====
    if (peg.level && peg.level > 1) {
        const pipCount = Math.min(3, peg.level);
        const pipR = r * 0.18;
        for (let i = 0; i < pipCount; i++) {
            ctx.save();
            // 元素 peg 已有顶 △，pip 再上移到 △ 上方；normal peg 直接在 ◆ 上方
            const baseYOff = isSpecial ? diamondR * 1.5 : diamondR * 0.8;
            ctx.translate((i - (pipCount - 1) / 2) * pipR * 2.2, -baseYOff);
            drawShape_diamond(ctx, pipR);
            ctx.fillStyle = PROMARE_PALETTE.YELLOW;
            ctx.fill();
            ctx.restore();
        }
    }

    // ===== 5. 冰冻 overlay（Glacies 狂暴）=====
    if (isFrozen) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        drawShape_oct2(ctx, diamondR * 1.1);
        ctx.fillStyle = PROMARE_PALETTE.CYAN;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#003E5C';
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}
