/**
 * src/pixel/blit.js — 把美术像素分辨率的离屏画布按 1:1 贴到主画布的像素网格上
 *
 * 主画布在像素模式下用 setTransform(sx, sy) 把逻辑坐标映射到缓冲；这里取当前变换，
 * 把逻辑坐标换成缓冲像素坐标并取整，再在单位变换下绘制，保证每个美术像素正好落在一个缓冲像素上。
 * @module pixel/blit
 */

/** 当前上下文下 1 个逻辑单位 = 多少缓冲像素 */
export function artScale(ctx) {
    const m = ctx.getTransform();
    return Math.hypot(m.a, m.b) || 1;
}

/** 逻辑坐标 → 缓冲像素坐标（未取整） */
export function toBuffer(ctx, x, y) {
    const m = ctx.getTransform();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, s: Math.hypot(m.a, m.b) || 1 };
}

/**
 * 贴图。anchor: 'tl' | 'center' | 'bottom'（底边中点）| 'top'（顶边中点）
 * flipX 时水平镜像。alpha 乘到当前 globalAlpha 上。
 */
export function blit(ctx, img, x, y, o = {}) {
    if (!img) return;
    const p = toBuffer(ctx, x, y);
    const w = img.width;
    const h = img.height;
    let bx = p.x;
    let by = p.y;
    const anchor = o.anchor || 'tl';
    if (anchor === 'center') { bx -= w / 2; by -= h / 2; } else if (anchor === 'bottom') { bx -= w / 2; by -= h; } else if (anchor === 'top') { bx -= w / 2; }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.composite) ctx.globalCompositeOperation = o.composite;
    const rx = Math.round(bx);
    const ry = Math.round(by);
    if (o.flipX) {
        ctx.translate(rx + w, ry);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
    } else {
        ctx.drawImage(img, rx, ry);
    }
    ctx.restore();
}

/** 逻辑尺寸 → 美术像素尺寸（取整，至少 1） */
export function artSize(ctx, v) {
    return Math.max(1, Math.round(v * artScale(ctx)));
}

/** 在缓冲像素网格上画实心矩形（逻辑坐标输入），用于条、点、线段等 HUD 元素 */
export function artRect(ctx, x, y, w, h, color) {
    const p = toBuffer(ctx, x, y);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(w * p.s)), Math.max(1, Math.round(h * p.s)));
    ctx.restore();
}
