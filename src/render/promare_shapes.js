/**
 * promare_shapes.js - 普罗米亚几何原语
 *
 * 11 种硬边多边形 path drawer。每个函数都假定调用前已 ctx.translate(x,y) 到中心点、
 * ctx.rotate(angle)（如有方向需求）。函数只描述 path，不做 fill/stroke——由调用方决定。
 *
 * 设计原则：
 * - 不使用 shadowBlur 或径向渐变
 * - 全部由直线段组成（除 ring 类需要 arc），保留 Promare 「切片感」
 * - 顶点坐标以单位半径 r 为基准，调用方控制 scale
 *
 * 调用范例：
 *   ctx.save();
 *   ctx.translate(p.x, p.y);
 *   ctx.rotate(p.angle);
 *   drawShape_cone3(ctx, p.size);
 *   ctx.fillStyle = '#FF2EA6';
 *   ctx.fill();
 *   ctx.restore();
 */

// ==================== Element 形状 ====================

/** 3 棱锥火苗：顶尖朝上。半径 r 时高 ≈ 1.6r。 */
export function drawShape_cone3(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.6);
    ctx.lineTo(r * 0.5, r * 0.4);
    ctx.lineTo(-r * 0.5, r * 0.4);
    ctx.closePath();
}

/** 2× 拉长八面体（冰晶针）：垂直拉伸 4 顶点菱形。 */
export function drawShape_oct2(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 2.0);
    ctx.lineTo(r * 0.5, 0);
    ctx.lineTo(0, r * 2.0);
    ctx.lineTo(-r * 0.5, 0);
    ctx.closePath();
}

/** Z 形闪电字形：6 顶点折线，闭合路径形成厚 Z。 */
export function drawShape_zigzagZ(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(-r * 1.0, -r * 1.2);
    ctx.lineTo(r * 0.3, -r * 0.2);
    ctx.lineTo(-r * 0.3, r * 0.0);
    ctx.lineTo(r * 1.0, r * 1.2);
    ctx.lineTo(-r * 0.3, r * 0.2);
    ctx.lineTo(r * 0.3, r * 0.0);
    ctx.closePath();
}

/** 4 棱长矛：尖端朝 +x。调用方应 ctx.rotate(angleOfVelocity) 后绘制。 */
export function drawShape_lance4(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(r * 1.8, 0);
    ctx.lineTo(-r * 0.5, r * 0.5);
    ctx.lineTo(-r * 1.2, 0);
    ctx.lineTo(-r * 0.5, -r * 0.5);
    ctx.closePath();
}

/** 6 边正六边形。 */
export function drawShape_hex6(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

/** 4 角星：外径 r，内径 r*0.4，4 尖角。 */
export function drawShape_star4(ctx, r) {
    const inner = r * 0.4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rad = (i % 2 === 0) ? r : inner;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

/** 规则菱形：4 顶点。 */
export function drawShape_diamond(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
}

/** 月牙 / 弧形切片（风元素）：用 5 个折线点拼出尖角月牙，沿 +x 方向延展。 */
export function drawShape_crescent(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, 0);
    ctx.lineTo(-r * 0.5, -r * 0.6);
    ctx.lineTo(r * 1.4, 0);
    ctx.lineTo(-r * 0.5, r * 0.6);
    ctx.closePath();
}

/** 倒三角（毒）。 */
export function drawShape_triDown(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(r * 0.85, -r * 0.5);
    ctx.lineTo(-r * 0.85, -r * 0.5);
    ctx.closePath();
}

/** 双同心环（echo / laser）：调用方需分别 fill / stroke 两次。
 *  返回外环 path（已 closePath）；内环需要调用 drawShape_ringInner。 */
export function drawShape_ringOuter(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
}

export function drawShape_ringInner(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
}

/** 辐射 spoke 单条：从中心 r*0.3 到 r*1.2 的线段，调用方 rotate 决定角度。
 *  不闭合 path，调用方应 stroke。 */
export function drawShape_radialSpoke(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(r * 0.3, 0);
    ctx.lineTo(r * 1.2, 0);
}

// ==================== 组合：辐射冲击 8 条 spoke + 同心圆 ====================

/**
 * 在 (0,0) 处一次性 stroke 出 8 条放射线 + 1 圈白环，用于冲击瞬间帧。
 * @param {number} r - 半径
 * @param {number} spokeCount - 默认 8
 */
export function drawRadialImpact(ctx, r, spokeCount = 8) {
    ctx.beginPath();
    for (let i = 0; i < spokeCount; i++) {
        const a = (i / spokeCount) * Math.PI * 2;
        const x0 = Math.cos(a) * r * 0.3;
        const y0 = Math.sin(a) * r * 0.3;
        const x1 = Math.cos(a) * r * 1.2;
        const y1 = Math.sin(a) * r * 1.2;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
    }
    // 描完 spokes 再加同心圆
    ctx.moveTo(r, 0);
    ctx.arc(0, 0, r, 0, Math.PI * 2);
}

// ==================== Path 双层渲染：F2 + F4 ====================
// 调用约定：path 已绘制；本函数完成「不透明主色填充 + 暗调描边」的双 fill+stroke 组合。
//
// [v2 改造] 反"加法发光"路线：
//   - F2 改 source-over（不再 lighter）—— 多粒子重叠不再产生白雾 whitewash
//   - F4 改暗调描边（不再统一白）—— 描边查 PROMARE_OUTLINES，没查到回退到调用方传入
//   - fillAlpha 默认从 0.5 提到 0.95 —— Promare 是平涂色块，不是半透叠加
//
// 历史调用方继续传 strokeColor='#FFFFFF' 时，函数会忽略它并自动查暗调表。
// 想强制走主色 stroke 时可以传非白色。
//
// @perf-impact: 单粒子 1 fill + 1 stroke + source-over；性能与原版基本持平。

import { PROMARE_OUTLINES, PROMARE_PALETTE } from './promare_tokens.js';

export function fillStroke_promare(ctx, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 0.95) {
    // F4: 描边色 = 主色暗调；白色描边请求被忽略
    let outline = PROMARE_OUTLINES[fillColor];
    if (!outline) {
        // strokeColor 是显式覆盖（如 pierce_lance 传 PINK 描白主体），但白色描白色没意义 → 走默认
        outline = (strokeColor && strokeColor !== PROMARE_PALETTE.WHITE) ? strokeColor : PROMARE_PALETTE.BLACK;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';  // F2: 平涂色块，不要加法
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.restore();
}

// ==================== F2: posterized 多段同心填充 ====================
// 一次 path → 主色填充 + 内核更亮色（白/黄）二段同心；模拟两段硬切色块。
// 调用前 path 必须未 fill。调用后会 fill 两次：外圈（fillColor）+ 内圈（coreColor, 0.55× scale）。
//
// @perf-impact: 单粒子 2 fill + 1 stroke；比单层多 1 fill。
//   为了控制开销，只在"主体粒子"用 posterized；signature 装饰（drip / kanada）仍可单层。

export function fillPosterized_promare(ctx, shapeDrawerFn, size, fillColor, coreColor, strokeWidth = 1) {
    const outline = PROMARE_OUTLINES[fillColor] || PROMARE_PALETTE.BLACK;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // 外圈：主色平涂 + 暗描边
    shapeDrawerFn(ctx, size);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = outline;
    ctx.stroke();

    // 内核：0.55× 尺寸 + 高亮色
    if (coreColor) {
        ctx.save();
        ctx.scale(0.55, 0.55);
        shapeDrawerFn(ctx, size);
        ctx.fillStyle = coreColor;
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}
