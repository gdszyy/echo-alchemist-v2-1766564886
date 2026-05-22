/**
 * promare_background.js - 普罗米亚风格背景（T3.A 深紫底 + 剪影层叠版）
 *
 * 设计契约：docs/promare_visual_design_v2.md §2.5 是真理源。
 *   Tier 1 已经把"扫描线 + 透视网格"的合成波背景全删了；本版按设计落地：
 *   - 深紫底 #1B0B2E（不是黑）
 *   - 3 层剪影：远景超大 □ + 中景中等 △ + 前景气氛粒 △
 *   - 按 phase 切换密度 / 颜色 / 节奏
 *
 * 场景节奏（§2.5 表）：
 *   meta       1-2 远景 □ + 多中景 △ + 多气氛粒（神圣感）
 *   selection  1 远景 □ + 中景 △ 中等
 *   gathering  0 远景 □（让钉盘 punch out）+ 少 △ + 少粒
 *   combat     3 远景 □ + 少 △ + 中粒
 *   boss       1 个超大 □ 占屏 40%（"Kray 高塔"暗示）+ 0 △ + 多粉粒
 *   gameover   全部停止移动，灰阶 overlay
 *
 * F1 兑现：粒子上升是 12fps stepped；剪影漂移按 frameCount stepped 而非平滑。
 * F2 兑现：所有填色 source-over，不用 lighter。
 * F4 兑现：剪影描边用元素暗调，不用白。
 *
 * @perf-impact: 静态层（远景 □ + 中景 △）缓存到 OffscreenCanvas，每帧只 drawImage 一次；
 *               气氛粒 5-15 个，每帧 fill 一次。整体 <0.5ms。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';

// ==================== 模块级 cache ====================

const _bgCache = {
    canvas: null,    // OffscreenCanvas（静态层缓存）
    w: 0,
    h: 0,
    phase: null,
};

// 气氛粒池（按 phase 重新生成；每个粒子有自己的 x / baseY / size / phase / hue）
let _ambientParticles = null;
let _ambientPhase = null;

const SHADOW_COLOR = '#2A0A4A';        // 远景 □ 描边色
const TRI_OUTLINE  = '#1E5570';        // 中景 △ 描边（暗青）
const BASE_COLOR   = '#1B0B2E';        // 底色

// 按 phase 决定层密度 & 颜色（与 §2.5 表对齐）
function _phaseSpec(phase) {
    switch (phase) {
        case 'meta':
            return { bigSquares: 2, midTriangles: 8, ambientCount: 14, ambientMixed: true, isGameOver: false };
        case 'selection':
            return { bigSquares: 1, midTriangles: 6, ambientCount: 10, ambientMixed: true, isGameOver: false };
        case 'gathering':
            return { bigSquares: 0, midTriangles: 3, ambientCount: 6,  ambientMixed: true, isGameOver: false };
        case 'combat':
            return { bigSquares: 3, midTriangles: 4, ambientCount: 10, ambientMixed: true, isGameOver: false };
        case 'boss':
            // bigSquares=-1 → 单个超大方块（"Kray 高塔"暗示）
            return { bigSquares: -1, midTriangles: 0, ambientCount: 14, ambientMixed: false, isGameOver: false };
        case 'gameover':
            return { bigSquares: 2, midTriangles: 6, ambientCount: 0,  ambientMixed: false, isGameOver: true };
        default:
            return { bigSquares: 2, midTriangles: 5, ambientCount: 8,  ambientMixed: true, isGameOver: false };
    }
}

// ==================== 静态层 cache 构建 ====================

function _buildStaticLayer(w, h, phase) {
    const c = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = c.getContext('2d');

    const spec = _phaseSpec(phase);

    // 1. 底色：深紫
    ctx.fillStyle = BASE_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 2. 远景 □ 剪影
    _drawBigSquares(ctx, w, h, spec);

    // 3. 中景 △ 剪影
    _drawMidTriangles(ctx, w, h, spec.midTriangles);

    return c;
}

function _drawBigSquares(ctx, w, h, spec) {
    if (spec.bigSquares === 0) return;

    if (spec.bigSquares === -1) {
        // boss: 单个超大 □ 占屏 ~40%（"Kray 高塔"暗示），居中偏上
        const sw = w * 0.55;
        const sh = h * 0.7;
        const sx = (w - sw) / 2;
        const sy = h * 0.12;
        // 阴影偏移
        ctx.fillStyle = '#0E0517';
        ctx.fillRect(sx + 8, sy + 8, sw, sh);
        // 主体
        ctx.fillStyle = '#241038';
        ctx.fillRect(sx, sy, sw, sh);
        // 暗粉描边 + 顶部高光
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#5A1140';
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#7A1850';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + sw, sy);
        ctx.stroke();
        return;
    }

    // 普通 phase: N 个远景 □ 散布（确定性位置，rebuild 时位置一致）
    const N = spec.bigSquares;
    const positions = [
        { x: w * 0.15,  y: h * 0.10, sw: w * 0.30, sh: h * 0.45 },
        { x: w * 0.60,  y: h * 0.20, sw: w * 0.32, sh: h * 0.40 },
        { x: w * 0.40,  y: h * 0.05, sw: w * 0.25, sh: h * 0.30 },
        { x: w * -0.05, y: h * 0.35, sw: w * 0.22, sh: h * 0.28 },
    ];
    for (let i = 0; i < Math.min(N, positions.length); i++) {
        const p = positions[i];
        // 阴影
        ctx.fillStyle = '#0E0517';
        ctx.fillRect(p.x + 4, p.y + 4, p.sw, p.sh);
        // 主体
        ctx.fillStyle = SHADOW_COLOR;
        ctx.fillRect(p.x, p.y, p.sw, p.sh);
        // 暗紫黑描边
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#0A0418';
        ctx.strokeRect(p.x, p.y, p.sw, p.sh);
    }
}

function _drawMidTriangles(ctx, w, h, count) {
    if (count <= 0) return;

    ctx.save();
    for (let i = 0; i < count; i++) {
        const seed = i * 1.7;
        const cx = w * (0.5 + 0.42 * Math.sin(seed * 1.3));
        const cy = h * (0.5 + 0.42 * Math.cos(seed * 1.7));
        const size = Math.min(w, h) * (0.04 + 0.05 * ((Math.sin(seed * 0.9) + 1) / 2));
        const rot = seed * 0.4;
        // 主色家族交替
        const palette = (i % 3 === 0) ? PROMARE_PALETTE.PINK
                      : (i % 3 === 1) ? PROMARE_PALETTE.CYAN
                                       : PROMARE_PALETTE.YELLOW;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.globalAlpha = 0.3;

        // 等边 △
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.866, size * 0.5);
        ctx.lineTo(-size * 0.866, size * 0.5);
        ctx.closePath();
        ctx.fillStyle = palette;
        ctx.fill();
        // 暗描边
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = TRI_OUTLINE;
        ctx.stroke();

        ctx.restore();
    }
    ctx.restore();
}

// ==================== 前景气氛粒 △（动态层，每帧）====================

function _ensureAmbientParticles(w, h, phase) {
    const spec = _phaseSpec(phase);
    if (_ambientPhase === phase && _ambientParticles && _ambientParticles.length === spec.ambientCount) {
        return _ambientParticles;
    }

    _ambientParticles = [];
    for (let i = 0; i < spec.ambientCount; i++) {
        const ratio = i / Math.max(1, spec.ambientCount);
        _ambientParticles.push({
            x: w * (0.05 + ratio * 0.9 + 0.05 * Math.sin(i * 1.7)),
            baseY: h * (0.3 + 0.6 * ((Math.cos(i * 1.3) + 1) / 2)),
            size: 3 + Math.floor(((Math.sin(i * 0.9) + 1) / 2) * 5),  // 3-8px
            phaseOff: i * 17,
            color: (() => {
                if (!spec.ambientMixed) return PROMARE_PALETTE.PINK;  // boss: 全粉
                if (i % 3 === 0) return PROMARE_PALETTE.PINK;
                if (i % 3 === 1) return PROMARE_PALETTE.CYAN;
                return PROMARE_PALETTE.YELLOW;
            })(),
        });
    }
    _ambientPhase = phase;
    return _ambientParticles;
}

function _drawAmbientParticles(ctx, w, h, frameCount, phase) {
    if (phase === 'gameover') return;  // game over 时停止上升

    const particles = _ensureAmbientParticles(w, h, phase);

    // 12fps stepped 上升
    const stutterFrame = Math.floor(frameCount / 5);

    ctx.save();
    for (const p of particles) {
        // 上升轨迹：每 stutter 步 +3px y（向上）+ x 微移
        const yOff = (stutterFrame * 3 + p.phaseOff) % (h + 80);
        const py = (p.baseY - yOff + h) % h;
        const px = (p.x + ((stutterFrame * 1) % 11) - 5);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((p.phaseOff % 6) * (Math.PI / 6));
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = p.color;
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.866, s * 0.5);
        ctx.lineTo(-s * 0.866, s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

// ==================== 公共 API：渲染入口 ====================

/**
 * 渲染普罗米亚风格背景。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {{x:number,y:number}} tilt - boardTilt.current
 * @param {number} frameCount
 * @param {number} tiltFactor - tilt 联动倍率（0..1），默认 0.5
 * @param {string} [phase='combat'] - meta/selection/gathering/combat/boss/gameover
 */
export function renderPromareBackground(ctx, w, h, tilt, frameCount, tiltFactor = 0.5, phase = 'combat') {
    // 尺寸或 phase 变化时重建静态层
    if (!_bgCache.canvas || _bgCache.w !== w || _bgCache.h !== h || _bgCache.phase !== phase) {
        _bgCache.canvas = _buildStaticLayer(w, h, phase);
        _bgCache.w = w;
        _bgCache.h = h;
        _bgCache.phase = phase;
    }

    // tilt 视差（轻微 ±8px）
    const tx = (tilt && tilt.x ? tilt.x : 0) * 8 * tiltFactor;
    const ty = (tilt && tilt.y ? tilt.y : 0) * 6 * tiltFactor;

    // 1. 静态层（cache）
    ctx.drawImage(_bgCache.canvas, tx, ty);

    // 2. 动态气氛粒（每帧绘制，12fps stepped 运动）
    _drawAmbientParticles(ctx, w, h, frameCount || 0, phase);

    // 3. gameover 全屏灰阶 overlay
    if (phase === 'gameover') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}

/** 清 cache（resize / 主题切换调） */
export function clearPromareBackgroundCache() {
    _bgCache.canvas = null;
    _bgCache.w = 0;
    _bgCache.h = 0;
    _bgCache.phase = null;
    _ambientParticles = null;
    _ambientPhase = null;
}
