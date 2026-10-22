/**
 * src/render/pixel_scale.js — R1 像素渲染底座：整数放大比例模型
 *
 * 规格来源：docs/design/art_vfx_ui_direction_v1.md §2.1（A1：1 美术像素 ≈ 2 CSS px）
 *
 *   k          = max(2, round(2 × DPR))      每个美术像素占 k×k 设备像素（整数）
 *   artPerCss  = DPR / k                     1 CSS px 对应多少美术像素（≈ 0.5）
 *   logicalW/H = floor(CSS × DPR / k)        低清缓冲（美术像素）尺寸
 *   backingW/H = logical × k                 主画布 backing（设备像素）尺寸
 *   cssW/H     = backing / DPR               主画布实际 CSS 尺寸（≤ 容器，留边 ≤ k-1 设备像素）
 *
 * 游戏逻辑坐标仍是 CSS px：世界绘制时对低清缓冲 ctx.setTransform(artPerCss, 0, 0, artPerCss, 0, 0)，
 * 再一次性 drawImage 放大 ×k 到主画布。Node 可直接 import（无 DOM 依赖）。
 *
 * @module render/pixel_scale
 * @perf-impact: 决定低清缓冲尺寸（每帧一次全屏最近邻 blit）
 */

/** 美术像素对应的目标 CSS 像素数（A1 = ①） */
export const ART_PIXEL_CSS = 2;

/**
 * 计算像素放大模型。
 * @param {{cssW:number, cssH:number, dpr?:number}} input
 * @returns {{k:number, dpr:number, artPerCss:number, logicalW:number, logicalH:number,
 *            backingW:number, backingH:number, cssW:number, cssH:number}}
 */
export function computePixelScale({ cssW, cssH, dpr = 1 } = {}) {
    const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const w = Number.isFinite(cssW) && cssW > 0 ? cssW : 1;
    const h = Number.isFinite(cssH) && cssH > 0 ? cssH : 1;
    const k = Math.max(2, Math.round(ART_PIXEL_CSS * safeDpr));
    const artPerCss = safeDpr / k;
    const logicalW = Math.max(1, Math.floor(w * safeDpr / k));
    const logicalH = Math.max(1, Math.floor(h * safeDpr / k));
    const backingW = logicalW * k;
    const backingH = logicalH * k;
    return {
        k,
        dpr: safeDpr,
        artPerCss,
        logicalW,
        logicalH,
        backingW,
        backingH,
        cssW: backingW / safeDpr,
        cssH: backingH / safeDpr,
    };
}

/** 当前生效的像素模型（由 sys_resize 写入，供浮动文字 / Pixi 层读取）。 */
let _activeScale = computePixelScale({ cssW: 480, cssH: 854, dpr: 1 });

export function setActivePixelScale(scale) {
    if (scale && Number.isFinite(scale.artPerCss) && scale.artPerCss > 0) _activeScale = scale;
}

export function getActivePixelScale() {
    return _activeScale;
}

/** 把 CSS 坐标吸附到美术像素格（返回 CSS 坐标）。 */
export function snapCssToArtGrid(v, scale = _activeScale) {
    const a = scale.artPerCss;
    return Math.round(v * a) / a;
}
