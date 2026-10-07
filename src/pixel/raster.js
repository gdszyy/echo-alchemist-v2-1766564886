/**
 * src/pixel/raster.js — 美术像素分辨率下的栅格画板（程序化像素精灵的底层）
 *
 * 所有程序化精灵都在 Raster 上逐像素生成（整数坐标、无抗锯齿），再一次性转成画布缓存。
 * 颜色一律来自 palette.js 的色阶；描边由 outline() 统一生成（四邻域，PSS auto-outline）。
 * @module pixel/raster
 */
import { hexToRgb, INK } from './palette.js';

const _packCache = new Map();
function pack(hex, a = 255) {
    const key = a === 255 ? hex : `${hex}/${a}`;
    let v = _packCache.get(key);
    if (v === undefined) {
        const [r, g, b] = hexToRgb(hex);
        v = ((a & 255) << 24 | b << 16 | g << 8 | r) >>> 0;
        _packCache.set(key, v);
    }
    return v;
}

/** 确定性哈希噪声：同一 (x, y, seed) 永远同值，范围 [0, 1) */
export function hash2(x, y, seed = 0) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2147483647;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
}

/** 低频值噪声（双线性插值的格点哈希），用于成簇的石面明暗 */
export function valueNoise(x, y, cell, seed = 0) {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const fx = x / cell - gx;
    const fy = y / cell - gy;
    const a = hash2(gx, gy, seed);
    const b = hash2(gx + 1, gy, seed);
    const c = hash2(gx, gy + 1, seed);
    const d = hash2(gx + 1, gy + 1, seed);
    const top = a + (b - a) * fx;
    const bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
}

/** 4×4 Bayer 阈值（0..1），用于有序抖动的过渡带 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x, y) {
    return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

export class Raster {
    constructor(w, h) {
        this.w = Math.max(1, w | 0);
        this.h = Math.max(1, h | 0);
        this.px = new Uint32Array(this.w * this.h);
    }

    inside(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }

    set(x, y, hex, a = 255) {
        x |= 0; y |= 0;
        if (!this.inside(x, y) || !hex) return;
        this.px[y * this.w + x] = pack(hex, a);
    }

    /** 只在已有实心像素上着色（用于刻线、高光不越出轮廓） */
    paint(x, y, hex, a = 255) {
        x |= 0; y |= 0;
        if (!this.inside(x, y) || !this.px[y * this.w + x]) return;
        this.px[y * this.w + x] = pack(hex, a);
    }

    clear(x, y) {
        x |= 0; y |= 0;
        if (this.inside(x, y)) this.px[y * this.w + x] = 0;
    }

    solid(x, y) {
        return this.inside(x, y) && (this.px[y * this.w + x] >>> 24) > 0;
    }

    rect(x, y, w, h, hex, a = 255) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex, a);
    }

    line(x0, y0, x1, y1, hex, a = 255, paintOnly = false) {
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            paintOnly ? this.paint(x0, y0, hex, a) : this.set(x0, y0, hex, a);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }

    /** 实心圆（中点法，像素圆而不是抗锯齿圆） */
    disc(cx, cy, r, hex, a = 255) {
        const rr = r * r + r * 0.8;
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                if (x * x + y * y <= rr) this.set(cx + x, cy + y, hex, a);
            }
        }
    }

    ring(cx, cy, r, hex, a = 255, thickness = 1) {
        const outer = r * r + r * 0.8;
        const ir = r - thickness;
        const inner = ir * ir + ir * 0.8;
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                const d = x * x + y * y;
                if (d <= outer && d > inner) this.set(cx + x, cy + y, hex, a);
            }
        }
    }

    /** 凸/凹多边形扫描线填充；pts 为 [[x,y],...] */
    poly(pts, hex, a = 255) {
        let minY = Infinity;
        let maxY = -Infinity;
        for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            const xs = [];
            for (let i = 0; i < pts.length; i++) {
                const [x0, y0] = pts[i];
                const [x1, y1] = pts[(i + 1) % pts.length];
                if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) {
                    xs.push(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0));
                }
            }
            xs.sort((m, n) => m - n);
            for (let k = 0; k + 1 < xs.length; k += 2) {
                for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, hex, a);
            }
        }
    }

    /** 四邻域 1px 描边：透明像素上下左右挨着实心像素 → 描边色 */
    outline(hex = INK, diagonal = false) {
        const w = this.w;
        const h = this.h;
        const out = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (this.solid(x, y)) continue;
                let near = this.solid(x - 1, y) || this.solid(x + 1, y) || this.solid(x, y - 1) || this.solid(x, y + 1);
                if (!near && diagonal) near = this.solid(x - 1, y - 1) || this.solid(x + 1, y - 1) || this.solid(x - 1, y + 1) || this.solid(x + 1, y + 1);
                if (near) out.push(y * w + x);
            }
        }
        const v = pack(hex);
        for (const i of out) this.px[i] = v;
        return out.length;
    }

    /** 把另一张 Raster 叠到 (ox, oy)（只覆盖实心像素） */
    blit(src, ox, oy) {
        for (let y = 0; y < src.h; y++) {
            for (let x = 0; x < src.w; x++) {
                const v = src.px[y * src.w + x];
                if ((v >>> 24) && this.inside(ox + x, oy + y)) this.px[(oy + y) * this.w + ox + x] = v;
            }
        }
    }

    toCanvas() {
        let c;
        if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(this.w, this.h);
        else { c = document.createElement('canvas'); c.width = this.w; c.height = this.h; }
        const g = c.getContext('2d');
        const id = new ImageData(new Uint8ClampedArray(this.px.buffer.slice(0)), this.w, this.h);
        g.putImageData(id, 0, 0);
        return c;
    }
}
