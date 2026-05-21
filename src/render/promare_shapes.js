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
 *   ctx.fillStyle = '#FF0090';
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

// ==================== Path 描边内发光辅助 ====================
// 调用约定：path 已绘制；本函数封装「主色填充 + 白色内描边」的双 fill+stroke 组合。

/**
 * 双层渲染：主色加法填充 + 白色内描边。模拟 Promare 内发光。
 * 假设 path 已 beginPath 并 closePath，调用方仅传入颜色与描边宽度。
 * @perf-impact: 单粒子 1 fill + 1 stroke + lighter composite。
 */
export function fillStroke_promare(ctx, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.restore();
}
