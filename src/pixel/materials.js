/**
 * src/pixel/materials.js — 统一材质的程序化像素画法
 *
 * 全游戏只有四类材质，光源统一在左上：
 * - 磨石（stone/slate）：块体 = 倒角亮边（左上）+ 暗边（右下）+ 低频成簇明暗 + 稀疏砂点 + 裂纹；
 * - 黄铜（brass）：只用于可交互或重要的框线、铆钉、扣环；
 * - 晶体（元素色阶）：嵌在石槽里的核心/宝石——暗缘、主体、左上亮面、1px 高光点；
 * - 能量（元素色阶亮端）：不描边，用于发光刻线、特效。
 * 所有函数都是确定性的（同 seed 同结果）。
 * @module pixel/materials
 */
import { RAMPS, INK } from './palette.js';
import { Raster, hash2, valueNoise } from './raster.js';

/** 由多边形/矩形集合生成形状遮罩（Raster 的实心区即遮罩） */
export function maskFromShapes(w, h, shapes) {
    const m = new Raster(w, h);
    for (const s of shapes) {
        if (s.rect) m.rect(s.rect[0], s.rect[1], s.rect[2], s.rect[3], '#ffffff');
        else if (s.poly) m.poly(s.poly, '#ffffff');
        else if (s.disc) m.disc(s.disc[0], s.disc[1], s.disc[2], '#ffffff');
        if (s.cut) {
            // 挖空：多边形或矩形
            const cut = new Raster(w, h);
            if (s.cut.rect) cut.rect(s.cut.rect[0], s.cut.rect[1], s.cut.rect[2], s.cut.rect[3], '#ffffff');
            if (s.cut.poly) cut.poly(s.cut.poly, '#ffffff');
            if (s.cut.disc) cut.disc(s.cut.disc[0], s.cut.disc[1], s.cut.disc[2], '#ffffff');
            for (let i = 0; i < cut.px.length; i++) if (cut.px[i]) m.px[i] = 0;
        }
    }
    return m;
}

/** 切角矩形多边形 */
export function chamferRect(x, y, w, h, c) {
    return [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
}

/** 在遮罩边缘随机啃出缺口（磨损） */
export function chipEdges(mask, seed, rate = 0.08) {
    const { w, h } = mask;
    const kill = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!mask.solid(x, y)) continue;
            const edge = !mask.solid(x - 1, y) || !mask.solid(x + 1, y) || !mask.solid(x, y - 1) || !mask.solid(x, y + 1);
            if (edge && hash2(x, y, seed + 17) < rate) kill.push([x, y]);
        }
    }
    for (const [x, y] of kill) mask.clear(x, y);
}

/**
 * 给遮罩内像素上磨石材质。
 * @param {Raster} out 输出画板
 * @param {Raster} mask 形状遮罩
 * @param {object} o { ramp:'stone', base:3, bevel:1, seed, cluster:4, grit:0.035 }
 */
export function shadeStone(out, mask, o = {}) {
    const rampName = o.ramp || 'stone';
    const R = RAMPS[rampName];
    const base = o.base ?? 3;
    const bevel = o.bevel ?? 1;
    const seed = o.seed || 0;
    const cell = o.cluster || 7;
    const grit = o.grit ?? 0.012;
    const { w, h } = mask;
    const at = (i) => R[Math.max(0, Math.min(R.length - 1, i))];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!mask.solid(x, y)) continue;
            // 距离左上/右下边界的像素数（光从左上来）
            let up = 0;
            let left = 0;
            let down = 0;
            let right = 0;
            while (up <= bevel && mask.solid(x, y - up - 1)) up++;
            while (left <= bevel && mask.solid(x - left - 1, y)) left++;
            while (down <= bevel && mask.solid(x, y + down + 1)) down++;
            while (right <= bevel && mask.solid(x + right + 1, y)) right++;
            let idx = base;
            // 大块面：只有两档低频明暗，避免迷彩式碎斑
            const n = valueNoise(x, y, cell, seed);
            if (n < 0.24) idx -= 1;
            else if (n > 0.8) idx += 1;
            if (up < bevel || left < bevel) idx = base + 2;
            else if (down < bevel || right < bevel) idx = base - 2;
            if (up === 0 && left === 0) idx = base + 3; // 左上角最亮点
            if (idx > base - 2 && idx < base + 2 && hash2(x, y, seed + 3) < grit) idx += 1; // 砂点
            out.set(x, y, at(idx));
        }
    }
}

/** 随机游走裂纹（只画在已有像素上），下侧补 1px 亮边做出刻痕立体感 */
export function crack(out, x, y, len, seed, rampName = 'stone', dark = 1) {
    const R = RAMPS[rampName];
    let cx = x;
    let cy = y;
    for (let i = 0; i < len; i++) {
        out.paint(cx, cy, R[dark]);
        out.paint(cx + 1, cy + 1, R[Math.min(R.length - 1, dark + 3)]);
        const r = hash2(i, seed, 91);
        if (r < 0.45) cx += 1;
        else if (r < 0.7) cy += 1;
        else if (r < 0.85) { cx += 1; cy += 1; }
        else cy -= 1;
    }
}

/** 石槽（内凹）：暗槽 + 右下内缘亮（与凸起相反的光照） */
export function socket(out, x, y, w, h, rampName = 'stone', o = {}) {
    const R = RAMPS[rampName];
    const deep = o.deep ?? 0;
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            let c = R[deep + 1];
            if (j === 0 || i === 0) c = R[deep];
            else if (j === h - 1 || i === w - 1) c = R[deep + 3];
            out.set(x + i, y + j, c);
        }
    }
}

/** 圆形石槽 */
export function roundSocket(out, cx, cy, r, rampName = 'stone') {
    const R = RAMPS[rampName];
    out.disc(cx, cy, r, R[1]);
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            const d = x * x + y * y;
            if (d <= r * r + r * 0.8 && d > (r - 1) * (r - 1) + (r - 1) * 0.8) {
                out.set(cx + x, cy + y, (x + y) > 0 ? R[4] : R[0]);
            }
        }
    }
}

/**
 * 晶体核心：shape 'round' | 'diamond' | 'hex'；size 为半径（美术像素）。
 * 暗缘 → 主体 → 左上亮面 → 高光点；元素色阶决定颜色。
 */
export function gem(out, cx, cy, size, rampName = 'cyan', shape = 'round') {
    const R = RAMPS[rampName] || RAMPS.cyan;
    const n = R.length;
    const inside = (x, y) => {
        if (shape === 'diamond') return Math.abs(x) + Math.abs(y) <= size;
        if (shape === 'hex') return Math.abs(y) <= size * 0.87 && Math.abs(x) + Math.abs(y) * 0.58 <= size;
        return x * x + y * y <= size * size + size * 0.8;
    };
    for (let y = -size; y <= size; y++) {
        for (let x = -size; x <= size; x++) {
            if (!inside(x, y)) continue;
            const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
            let c;
            if (edge) c = (x + y) < 0 ? R[Math.min(n - 1, 3)] : R[1];
            else if (x + y < -size * 0.35) c = R[Math.min(n - 1, 4)];
            else if (x + y > size * 0.5) c = R[2];
            else c = R[3];
            out.set(cx + x, cy + y, c);
        }
    }
    // 高光点
    const hx = cx - Math.max(1, Math.round(size * 0.4));
    const hy = cy - Math.max(1, Math.round(size * 0.4));
    out.set(hx, hy, R[n - 1]);
    if (size >= 4) out.set(hx + 1, hy, R[n - 2]);
}

/** 黄铜铆钉 2×2（左上亮） */
export function rivet(out, x, y) {
    const B = RAMPS.brass;
    out.set(x, y, B[5]);
    out.set(x + 1, y, B[3]);
    out.set(x, y + 1, B[3]);
    out.set(x + 1, y + 1, B[1]);
}

/** 黄铜条：水平或竖直，宽度 t，带上亮下暗 */
export function brassBar(out, x, y, len, t = 2, vertical = false) {
    const B = RAMPS.brass;
    for (let i = 0; i < len; i++) {
        for (let k = 0; k < t; k++) {
            const c = k === 0 ? B[5] : (k === t - 1 ? B[2] : B[4]);
            vertical ? out.set(x + k, y + i, c) : out.set(x + i, y + k, c);
        }
    }
}

/** 发光刻线（不描边、只画在已有像素上） */
export function glowLine(out, x0, y0, x1, y1, rampName = 'cyan', bright = 4) {
    const R = RAMPS[rampName];
    out.line(x0, y0, x1, y1, R[Math.min(R.length - 1, bright)], 255, true);
}

/** 统一收尾：INK 描边 */
export function inkOutline(out) {
    return out.outline(INK, false);
}
