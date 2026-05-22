/**
 * promare_background.js - 普罗米亚风格背景渲染
 *
 * 职责：
 * - 提供 BLACK 底 + 45° 扫描线（离屏 cache）+ 底部梯形网格 + 流光带
 * - 跟随板子 tilt 做 50% 视差，保留输入意义
 *
 * 设计原则（design plan §4.A4 / 原文档 §1.3）：
 * - 扫描线：rgba(255,255,255,0.05) 45° 平行，spacing 40px，一次绘到离屏 canvas 后 cache
 * - 网格地面：底部 40% 透视梯形，cyan 0.04α 细线，向远端收敛
 * - 流光带：每帧 +0.5px scroll，制造「赛车向前」的进入感
 *
 * @perf-impact: 离屏 canvas 一次 rasterize，每帧仅一次 drawImage，<0.2ms。
 *               relevant：CONFIG.performance.{high|medium|low}.shadowBlurEnabled 不影响本模块。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';

// ==================== 模块级 cache ====================

let _scanlineCanvas = null;     // 离屏 45° 扫描线 cache
let _gridCanvas     = null;     // 离屏底部梯形网格 cache
let _cachedW        = 0;
let _cachedH        = 0;

// ==================== 构建：45° 扫描线 ====================

function _buildScanlineCanvas(w, h) {
    const c = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // 45° 平行斜线：从右上到左下扫，spacing 40px
    // 通过 translate + rotate 后画水平线，再 unrotate 即可。
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 4); // -45° = 右上到左下
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    // 对角线长度 = sqrt(w² + h²) 作为绘制范围保险
    const diag = Math.ceil(Math.sqrt(w * w + h * h)) + 40;
    for (let y = -diag; y <= diag; y += 40) {
        ctx.beginPath();
        ctx.moveTo(-diag, y);
        ctx.lineTo(diag, y);
        ctx.stroke();
    }
    ctx.restore();

    // 再叠一层粗一点的 cyan 加法线（每 160px 一根，对角构图强调）
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(0, 180, 255,0.04)';
    ctx.lineWidth = 2;
    for (let y = -diag; y <= diag; y += 160) {
        ctx.beginPath();
        ctx.moveTo(-diag, y);
        ctx.lineTo(diag, y);
        ctx.stroke();
    }
    ctx.restore();

    return c;
}

// ==================== 构建：底部梯形透视网格 ====================

function _buildGridCanvas(w, h) {
    const c = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // 底部 40% 区域做透视网格，向上收敛到一个虚拟消失点（屏顶中心）
    const gridTop = h * 0.60;
    const gridBottom = h;
    const vanishX = w / 2;
    const vanishY = h * 0.45;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 180, 255,0.06)';
    ctx.lineWidth = 1;

    // 1) 纵向「轨道」：从屏底等距分布的点连线到消失点
    const railCount = 9;
    for (let i = 0; i <= railCount; i++) {
        const x = (i / railCount) * w;
        ctx.beginPath();
        ctx.moveTo(x, gridBottom);
        ctx.lineTo(vanishX, vanishY);
        ctx.stroke();
    }

    // 2) 横向「枕木」：在透视梯形内画 6 条水平线，越靠近消失点越短越透明
    const sleeperCount = 6;
    for (let i = 0; i < sleeperCount; i++) {
        const t = (i + 1) / (sleeperCount + 1); // 0..1
        // 沿 gridBottom→vanishY 插值，做近大远小
        const y = gridBottom + (vanishY - gridBottom) * Math.pow(t, 0.6);
        const halfW = (1 - t) * (w / 2);
        const xL = vanishX - halfW;
        const xR = vanishX + halfW;
        ctx.globalAlpha = 0.06 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.moveTo(xL, y);
        ctx.lineTo(xR, y);
        ctx.stroke();
    }

    ctx.restore();
    return c;
}

// ==================== 公共 API：渲染入口 ====================

/**
 * 渲染普罗米亚风格背景（黑底 + 扫描线 + 底部网格 + 滚动）
 *
 * @param {CanvasRenderingContext2D} ctx - 主画布 ctx
 * @param {number} w - canvas 宽
 * @param {number} h - canvas 高
 * @param {{x:number,y:number}} tilt - boardTilt.current（-1..1 范围）
 * @param {number} frameCount - 当前帧号（用于流光带滚动；不传则用 Date.now()/16）
 * @param {number} tiltFactor - tilt 联动倍率（0..1），默认 0.5
 */
export function renderPromareBackground(ctx, w, h, tilt, frameCount, tiltFactor = 0.5) {
    // 尺寸变化或首次调用时重建 cache
    if (!_scanlineCanvas || _cachedW !== w || _cachedH !== h) {
        _scanlineCanvas = _buildScanlineCanvas(w, h);
        _gridCanvas     = _buildGridCanvas(w, h);
        _cachedW = w;
        _cachedH = h;
    }

    // 1. BLACK 底色
    ctx.fillStyle = PROMARE_PALETTE.BLACK;
    ctx.fillRect(0, 0, w, h);

    // 2. 流光带 scroll：frameCount 决定纵向偏移，让扫描线慢慢滑过去
    const scrollY = ((frameCount || 0) * 0.5) % 80; // 模 80（spacing 40 × 2）
    // tilt 联动偏移
    const tx = (tilt && tilt.x ? tilt.x : 0) * 15 * tiltFactor;
    const ty = (tilt && tilt.y ? tilt.y : 0) * 10 * tiltFactor;

    // 3. 扫描线（两份错位 tile，制造无缝滚动）
    ctx.save();
    ctx.drawImage(_scanlineCanvas, tx,       scrollY + ty - h);
    ctx.drawImage(_scanlineCanvas, tx,       scrollY + ty);
    ctx.restore();

    // 4. 底部梯形网格（不滚动，但 tilt 联动一点点）
    ctx.save();
    ctx.drawImage(_gridCanvas, tx * 0.5, ty * 0.5);
    ctx.restore();
}

/**
 * 清空 cache（窗口尺寸变化或主题切换时手动调用）
 */
export function clearPromareBackgroundCache() {
    _scanlineCanvas = null;
    _gridCanvas = null;
    _cachedW = 0;
    _cachedH = 0;
}
