/**
 * src/pixel/enemy_sprites.js — 敌人程序化像素精灵（几何磨石块基座 + 镶嵌核心）
 *
 * 继承 docs/design/enemy_geometric_whetstone_style.md 的三层母题，但不复刻旧位图：
 * 1. 基座：stone 色阶磨石块，轮廓按 baseArchetype 的形状语法生成，左上光、倒角、裂纹、缺口；
 * 2. 核心：嵌在石槽里的晶体，颜色 = 原型的机制色（见 CORE_RAMP），面积 ≤ 主体约 1/3；
 * 3. 词条覆层：不在这里画（由 enemy_render.js 按运行时状态叠加，不改写轮廓）。
 * 精英：黄铜扣带与铆钉；普通：纯石。每个实例用 seed 打散纹理，避免克隆感。
 * 生成结果按 (archetype, 尺寸, tier, seed%VARIANTS) 缓存。
 * @module pixel/enemy_sprites
 */
import { RAMPS } from './palette.js';
import { Raster, hash2 } from './raster.js';
import {
    maskFromShapes, chamferRect, chipEdges, shadeStone, crack, socket, roundSocket,
    gem, rivet, brassBar, glowLine, inkOutline,
} from './materials.js';

/** 原型 → 核心晶体色阶（机制色） */
export const CORE_RAMP = Object.freeze({
    residue: 'fire',
    eliteGolem: 'blood',
    bastion: 'ice',
    maw: 'blood',
    deflector: 'cyan',
    echoSpire: 'arcane',
    prism: 'volt',
    hive: 'venom',
    siege: 'fire',
    carrier: 'cyan',
    gravityWell: 'arcane',
});

const VARIANTS = 4;
const _cache = new Map();

function finish(r, mask, seed, base = 3) {
    shadeStone(r, mask, { ramp: 'stone', base, seed, bevel: 1, cluster: 7 });
}

function addCracks(r, w, h, seed, count) {
    for (let i = 0; i < count; i++) {
        const x = 2 + Math.floor(hash2(i, seed, 5) * (w - 6));
        const y = 2 + Math.floor(hash2(seed, i, 6) * (h - 6));
        crack(r, x, y, 3 + Math.floor(hash2(i, i, seed) * 5), seed + i);
    }
}

// ─── 各原型形状语法 ─────────────────────────────────────────

function residue(w, h, seed, elite) {
    const r = new Raster(w, h);
    const c = Math.max(3, Math.round(w * 0.16));
    const mask = maskFromShapes(w, h, [{ poly: chamferRect(1, 2, w - 3, h - 3, c) }]);
    chipEdges(mask, seed, 0.06);
    finish(r, mask, seed);
    // 研磨横纹
    for (let y = 6; y < h - 4; y += 5) {
        for (let x = 4; x < w - 4; x++) if (hash2(x, y, seed) > 0.35) r.paint(x, y, RAMPS.stone[2]);
    }
    const cx = (w / 2) | 0;
    const cy = (h / 2) | 0;
    const gr = Math.max(2, Math.round(w * 0.12));
    roundSocket(r, cx, cy, gr + 2);
    gem(r, cx, cy, gr, elite ? 'blood' : 'fire', 'diamond');
    addCracks(r, w, h, seed, 2);
    if (elite) {
        brassBar(r, 3, 5, w - 6, 2);
        rivet(r, 4, h - 7);
        rivet(r, w - 7, h - 7);
    }
    inkOutline(r);
    return r;
}

function eliteGolem(w, h, seed) {
    // 有肩甲的磨石魔像躯干：上宽下窄 + 头部凸块 + 胸口大核
    const r = new Raster(w, h);
    const hw = Math.round(w * 0.28);
    const shapes = [
        { poly: chamferRect(1, Math.round(h * 0.18), w - 3, Math.round(h * 0.5), 3) }, // 肩
        { poly: chamferRect(Math.round(w * 0.18), Math.round(h * 0.45), Math.round(w * 0.62), Math.round(h * 0.5), 3) }, // 腰
        { poly: chamferRect(((w - hw) / 2) | 0, 1, hw, Math.round(h * 0.28), 2) }, // 头
    ];
    const mask = maskFromShapes(w, h, shapes);
    chipEdges(mask, seed, 0.05);
    finish(r, mask, seed, 3);
    const cx = (w / 2) | 0;
    const cy = Math.round(h * 0.5);
    const gr = Math.max(3, Math.round(w * 0.14));
    roundSocket(r, cx, cy, gr + 2);
    gem(r, cx, cy, gr, 'blood', 'round');
    // 眼缝
    const ey = Math.round(h * 0.14);
    for (let x = cx - 2; x <= cx + 2; x++) r.paint(x, ey, RAMPS.fire[4]);
    brassBar(r, 2, Math.round(h * 0.2), w - 5, 2);
    rivet(r, 3, Math.round(h * 0.36));
    rivet(r, w - 6, Math.round(h * 0.36));
    addCracks(r, w, h, seed, 2);
    inkOutline(r);
    return r;
}

function bastion(w, h, seed, elite) {
    // 三段横向磨石梁
    const r = new Raster(w, h);
    const seg = Math.floor((w - 2) / 3);
    const shapes = [];
    for (let i = 0; i < 3; i++) {
        const x = 1 + i * seg;
        const inset = i === 1 ? 0 : 2;
        shapes.push({ poly: chamferRect(x, 1 + inset, seg - 2, h - 3 - inset * 2, 3) });
    }
    const mask = maskFromShapes(w, h, shapes);
    chipEdges(mask, seed, 0.05);
    finish(r, mask, seed);
    // 连接扣
    for (let i = 1; i < 3; i++) {
        const x = 1 + i * seg - 3;
        brassBar(r, x, ((h / 2) | 0) - 3, 4, 2);
        brassBar(r, x, ((h / 2) | 0) + 2, 4, 2);
    }
    // 中央重甲核
    const cx = 1 + seg + ((seg - 2) / 2 | 0);
    const cy = (h / 2) | 0;
    const sw = Math.round(seg * 0.5);
    const sh = Math.round(h * 0.55);
    socket(r, cx - (sw >> 1), cy - (sh >> 1), sw, sh);
    gem(r, cx, cy, Math.max(2, Math.min(sw, sh) / 2 - 2 | 0), 'ice', 'hex');
    // 两侧铆钉槽
    for (const sx of [1 + (seg >> 1), 1 + 2 * seg + (seg >> 1) - 2]) {
        rivet(r, sx - 2, 5);
        rivet(r, sx - 2, h - 8);
    }
    addCracks(r, w, h, seed, 3);
    if (elite) brassBar(r, 3, 3, w - 7, 1);
    inkOutline(r);
    return r;
}

function maw(w, h, seed) {
    // 被掏空的圆角磨石胃囊 + 内嵌暗红吞噬腔
    const r = new Raster(w, h);
    const c = Math.round(w * 0.22);
    const mr = Math.round(Math.min(w, h) * 0.26);
    const cx = (w / 2) | 0;
    const cy = (h / 2) | 0;
    const mask = maskFromShapes(w, h, [{ poly: chamferRect(1, 1, w - 3, h - 3, c), cut: { disc: [cx, cy, mr] } }]);
    chipEdges(mask, seed, 0.05);
    finish(r, mask, seed);
    // 吞噬腔：螺旋暗红
    const B = RAMPS.blood;
    for (let y = -mr; y <= mr; y++) {
        for (let x = -mr; x <= mr; x++) {
            const d = Math.sqrt(x * x + y * y);
            if (d > mr + 0.4) continue;
            const a = Math.atan2(y, x);
            const band = Math.floor((a / (Math.PI * 2) * 3 + d / mr * 2.2) * 2) & 1;
            const idx = d < mr * 0.35 ? 0 : (band ? 1 : 2);
            r.set(cx + x, cy + y, B[idx]);
        }
    }
    r.set(cx, cy, B[4]);
    // 锯齿石牙（向内）
    const teeth = 8;
    for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2 + 0.2;
        for (let k = 0; k < 3; k++) {
            const rr = mr - k;
            const x = Math.round(cx + Math.cos(a) * rr);
            const y = Math.round(cy + Math.sin(a) * rr);
            r.set(x, y, RAMPS.stone[k === 0 ? 5 : 6]);
        }
    }
    addCracks(r, w, h, seed, 3);
    inkOutline(r);
    return r;
}

function deflector(w, h, seed) {
    // 低矮楔形盾石，前缘（上沿）青蓝偏折薄膜
    const r = new Raster(w, h);
    const top = Math.round(h * 0.3);
    const mask = maskFromShapes(w, h, [{ poly: [[2, h - 2], [2, top + 4], [Math.round(w * 0.3), top], [w - Math.round(w * 0.3), top], [w - 3, top + 4], [w - 3, h - 2]] }]);
    chipEdges(mask, seed, 0.05);
    finish(r, mask, seed);
    // 薄膜槽
    for (let x = Math.round(w * 0.3); x < w - Math.round(w * 0.3); x++) {
        r.set(x, top - 1, RAMPS.cyan[5]);
        r.set(x, top - 2, RAMPS.cyan[3]);
    }
    for (let x = 4; x < w - 5; x += 6) socket(r, x, Math.round(h * 0.6), 3, 4);
    gem(r, (w / 2) | 0, Math.round(h * 0.62), Math.max(2, Math.round(h * 0.16)), 'cyan', 'diamond');
    addCracks(r, w, h, seed, 2);
    inkOutline(r);
    return r;
}

function echoSpire(w, h, seed) {
    // 细高共振石柱：纵向槽 + 顶部裂纹晶核 + 环形箍
    const r = new Raster(w, h);
    const cw = Math.round(w * 0.62);
    const x0 = ((w - cw) / 2) | 0;
    const mask = maskFromShapes(w, h, [
        { poly: chamferRect(x0, Math.round(h * 0.12), cw, Math.round(h * 0.86), 3) },
        { poly: chamferRect(x0 - 2, h - Math.round(h * 0.14) - 2, cw + 4, Math.round(h * 0.14), 2) },
    ]);
    chipEdges(mask, seed, 0.05);
    finish(r, mask, seed);
    for (let y = Math.round(h * 0.3); y < h - Math.round(h * 0.2); y++) {
        r.paint(x0 + 3, y, RAMPS.stone[1]);
        r.paint(x0 + cw - 4, y, RAMPS.stone[1]);
    }
    for (const yy of [0.38, 0.6, 0.8]) brassBar(r, x0, Math.round(h * yy), cw, 1);
    const cx = (w / 2) | 0;
    const cy = Math.round(h * 0.2);
    gem(r, cx, cy, Math.max(3, Math.round(cw * 0.3)), 'arcane', 'diamond');
    glowLine(r, cx, cy + 4, cx, Math.round(h * 0.75), 'arcane', 4);
    addCracks(r, w, h, seed, 2);
    inkOutline(r);
    return r;
}

function prism(w, h, seed) {
    // 竖直折光棱柱：左右切面明暗分开，中线白色折射
    const r = new Raster(w, h);
    const cx = (w / 2) | 0;
    const pw = Math.round(w * 0.42);
    const pts = [[cx, 1], [cx + pw, Math.round(h * 0.1)], [cx + pw, h - Math.round(h * 0.1)], [cx, h - 2], [cx - pw, h - Math.round(h * 0.1)], [cx - pw, Math.round(h * 0.1)]];
    const mask = maskFromShapes(w, h, [{ poly: pts }]);
    finish(r, mask, seed, 3);
    // 右切面压暗一级
    for (let y = 0; y < h; y++) for (let x = cx + 1; x < w; x++) if (r.solid(x, y) && hash2(x, y, seed) > 0.25) r.paint(x, y, RAMPS.stone[2]);
    const V = RAMPS.volt;
    for (let y = Math.round(h * 0.12); y < h - Math.round(h * 0.12); y++) {
        r.paint(cx, y, V[5]);
        if (y % 7 < 3) r.paint(cx - 1, y, V[3]);
    }
    gem(r, cx, (h / 2) | 0, Math.max(2, Math.round(pw * 0.45)), 'volt', 'diamond');
    inkOutline(r);
    return r;
}

function hive(w, h, seed) {
    // 多孔孵化石巢：孔洞里嵌卵囊
    const r = new Raster(w, h);
    const mask = maskFromShapes(w, h, [{ poly: chamferRect(1, 2, w - 3, h - 4, Math.round(w * 0.2)) }]);
    chipEdges(mask, seed, 0.06);
    finish(r, mask, seed);
    const holes = [[0.3, 0.22], [0.7, 0.3], [0.45, 0.5], [0.28, 0.75], [0.7, 0.72]];
    const hr = Math.max(3, Math.round(w * 0.11));
    holes.forEach(([fx, fy], i) => {
        const x = Math.round(w * fx);
        const y = Math.round(h * fy);
        roundSocket(r, x, y, hr + 1);
        gem(r, x, y + 1, hr - 1, i % 2 ? 'rose' : 'venom', 'round');
    });
    addCracks(r, w, h, seed, 2);
    inkOutline(r);
    return r;
}

function carrier(w, h, seed) {
    // 拱门形载具：中下挖空，柱身与拱顶嵌青色核
    const r = new Raster(w, h);
    const ox = Math.round(w * 0.3);
    const oh = Math.round(h * 0.55);
    const mask = maskFromShapes(w, h, [{ poly: chamferRect(1, 1, w - 3, h - 2, 4), cut: { poly: chamferRect(ox, h - oh, w - ox * 2 - 1, oh + 2, 3) } }]);
    chipEdges(mask, seed, 0.05);
    finish(r, mask, seed);
    // 黄铜拱线
    brassBar(r, ox - 2, h - oh - 3, w - ox * 2 + 3, 1);
    const gr = Math.max(2, Math.round(h * 0.09));
    gem(r, (w / 2) | 0, Math.round(h * 0.2), gr + 1, 'cyan', 'hex');
    gem(r, Math.round(ox * 0.5), Math.round(h * 0.7), gr, 'cyan', 'round');
    gem(r, w - Math.round(ox * 0.5) - 1, Math.round(h * 0.7), gr, 'cyan', 'round');
    for (let y = Math.round(h * 0.35); y < h - 4; y++) {
        r.paint(Math.round(ox * 0.5), y, RAMPS.cyan[3]);
        r.paint(w - Math.round(ox * 0.5) - 1, y, RAMPS.cyan[3]);
    }
    addCracks(r, w, h, seed, 3);
    inkOutline(r);
    return r;
}

function siege(w, h, seed) {
    // 履带磨石车：上部车身 + 下部履带 + 前铲 + 热管
    const r = new Raster(w, h);
    const th = Math.round(h * 0.28);
    const mask = maskFromShapes(w, h, [
        { poly: chamferRect(Math.round(w * 0.1), 2, Math.round(w * 0.78), h - th - 2, 4) },
        { poly: chamferRect(1, h - th - 1, w - 3, th, Math.round(th / 2)) },
    ]);
    chipEdges(mask, seed, 0.04);
    finish(r, mask, seed);
    // 履带：深色 + 节点
    const S = RAMPS.slate;
    for (let y = h - th; y < h - 2; y++) {
        for (let x = 2; x < w - 3; x++) {
            if (!r.solid(x, y)) continue;
            r.set(x, y, ((x + (y === h - th ? 0 : 1)) % 4 === 0) ? S[5] : S[2]);
        }
    }
    for (let x = 6; x < w - 6; x += Math.round(th * 0.9)) roundSocket(r, x, h - (th >> 1) - 1, Math.max(2, (th >> 1) - 2), 'slate');
    // 前铲（左侧黄铜楔）
    for (let y = 4; y < h - th; y++) {
        const span = Math.round((y / (h - th)) * w * 0.12);
        for (let x = 0; x < span; x++) r.set(1 + x, y, RAMPS.brass[x === 0 ? 5 : 3]);
    }
    // 热管
    for (let x = Math.round(w * 0.3); x < Math.round(w * 0.8); x++) {
        r.paint(x, Math.round(h * 0.22), RAMPS.fire[4]);
        r.paint(x, Math.round(h * 0.22) + 1, RAMPS.fire[2]);
    }
    gem(r, Math.round(w * 0.6), Math.round((h - th) * 0.55), Math.max(2, Math.round(h * 0.1)), 'fire', 'hex');
    addCracks(r, w, h - th, seed, 2);
    inkOutline(r);
    return r;
}

function gravityWell(w, h, seed) {
    // 三层环形炉心：外环 / 中环 / 黑核 + 向心刻线
    const r = new Raster(w, h);
    const cx = (w / 2) | 0;
    const cy = (h / 2) | 0;
    const R0 = Math.min(cx, cy) - 2;
    const R1 = Math.round(R0 * 0.68);
    const R2 = Math.round(R0 * 0.36);
    const outer = maskFromShapes(w, h, [{ poly: chamferRect(cx - R0, cy - R0, R0 * 2, R0 * 2, Math.round(R0 * 0.55)), cut: { disc: [cx, cy, R1 + 1] } }]);
    chipEdges(outer, seed, 0.04);
    finish(r, outer, seed, 3);
    const mid = maskFromShapes(w, h, [{ disc: [cx, cy, R1 - 1], cut: { disc: [cx, cy, R2 + 1] } }]);
    shadeStone(r, mid, { ramp: 'stone', base: 4, seed: seed + 1, bevel: 1 });
    const A = RAMPS.arcane;
    r.disc(cx, cy, R2, A[0]);
    r.ring(cx, cy, R2, A[3]);
    r.set(cx, cy, A[6]);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        r.line(Math.round(cx + Math.cos(a) * (R1 - 2)), Math.round(cy + Math.sin(a) * (R1 - 2)),
            Math.round(cx + Math.cos(a) * (R2 + 2)), Math.round(cy + Math.sin(a) * (R2 + 2)), A[4], 255, true);
    }
    inkOutline(r);
    return r;
}

/** 首领主题色阶（P4 再换专属造型；先用统一的大型磨石 + 主题核心 + 冠饰） */
export const BOSS_RAMP = Object.freeze({
    ignis: 'fire', glacies: 'ice', mikro: 'cyan', devourer: 'blood',
    viridis: 'venom', tesla: 'volt', chimera: 'arcane', ouroboros: 'rose',
});

function boss(w, h, seed, _elite, theme = 'blood') {
    const r = new Raster(w, h);
    const crownH = Math.max(4, Math.round(h * 0.14));
    const body = chamferRect(1, crownH, w - 3, h - crownH - 2, Math.round(Math.min(w, h) * 0.18));
    // 冠饰：三根尖角
    const horns = [0.2, 0.5, 0.8].map((fx, i) => {
        const cx = Math.round(w * fx);
        const hw = i === 1 ? 5 : 4;
        return { poly: [[cx - hw, crownH + 2], [cx, 1 + (i === 1 ? 0 : 2)], [cx + hw, crownH + 2]] };
    });
    const mask = maskFromShapes(w, h, [{ poly: body }, ...horns]);
    chipEdges(mask, seed, 0.04);
    shadeStone(r, mask, { ramp: 'stone', base: 2, seed, bevel: 1, cluster: 8 });
    // 主题刻线 + 黄铜冠带
    const T = RAMPS[theme] || RAMPS.blood;
    brassBar(r, 3, crownH + 2, w - 7, 2);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const cx = w >> 1;
        const cy = Math.round(h * 0.56);
        const rr = Math.round(Math.min(w, h) * 0.34);
        r.line(cx, cy, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), T[3], 255, true);
    }
    const gr = Math.max(4, Math.round(Math.min(w, h) * 0.17));
    roundSocket(r, w >> 1, Math.round(h * 0.56), gr + 2);
    gem(r, w >> 1, Math.round(h * 0.56), gr, theme, 'round');
    for (const fx of [0.18, 0.82]) {
        gem(r, Math.round(w * fx), Math.round(h * 0.62), Math.max(2, Math.round(gr * 0.45)), theme, 'diamond');
        rivet(r, Math.round(w * fx) - 1, Math.round(h * 0.84));
    }
    addCracks(r, w, h, seed, 4);
    inkOutline(r);
    return r;
}

const BUILDERS = { residue, eliteGolem, bastion, maw, deflector, echoSpire, prism, hive, carrier, siege, gravityWell, boss };

export function hasEnemyArchetype(id) {
    return !!BUILDERS[id];
}

export const ENEMY_ARCHETYPE_IDS = Object.freeze(Object.keys(BUILDERS));

/** 纯栅格构建（不依赖 DOM），供测试与离线检查使用 */
export function buildEnemyRaster(archetype, w, h, seed = 1, elite = false, theme = undefined) {
    const fn = BUILDERS[archetype];
    if (!fn) throw new Error(`unknown archetype ${archetype}`);
    return fn(Math.max(8, w | 0), Math.max(8, h | 0), seed, elite, theme);
}

/**
 * 取敌人精灵（缓存）。
 * @param {{archetype:string, w:number, h:number, elite?:boolean, seed?:number}} o w/h 为美术像素
 */
export function getEnemySprite(o) {
    const arch = BUILDERS[o.archetype] ? o.archetype : 'residue';
    const w = Math.max(8, o.w | 0);
    const h = Math.max(8, o.h | 0);
    const v = Math.abs(o.seed | 0) % VARIANTS;
    const key = `${arch}|${w}x${h}|${o.elite ? 'e' : 'n'}|${v}|${o.theme || ''}`;
    let c = _cache.get(key);
    if (!c) {
        const seed = 1013 + v * 7919 + w * 31 + h;
        const r = BUILDERS[arch](w, h, seed, !!o.elite, o.theme);
        c = r.toCanvas();
        _cache.set(key, c);
        if (_cache.size > 256) _cache.delete(_cache.keys().next().value);
    }
    return c;
}
