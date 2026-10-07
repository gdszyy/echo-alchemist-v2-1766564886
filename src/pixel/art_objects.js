/**
 * src/pixel/art_objects.js — 菜单/图鉴用的程序化像素物件（取代旧位图与其自动像素化件）
 *
 * 与场景同一套规则（docs/design/pixel_art_mode.md §2）：
 * - 颜色只来自 palette.js 色阶；光从左上来；统一 1px INK 描边（Raster.outline）。
 * - 材质：石（结构/容器）、黄铜（框、扣件、机械件）、晶体（能量、元素核心）、玻璃（瓶、透镜）。
 * - 每个物件是一个纯函数：在给定 Raster 上画，返回同一个 Raster；不读游戏状态。
 * 物件按「形」区分类别（瓶、晶、箱、币…），按「色阶」区分元素——同一元素在全游戏同色。
 * @module pixel/art_objects
 */
import { RAMPS, INK } from './palette.js';
import { Raster, hash2, bayer } from './raster.js';
import { ICON_ROWS } from './icons.js';
import { maskFromShapes, chamferRect, chipEdges, shadeStone, rivet } from './materials.js';

const R_ = (name) => RAMPS[name] || RAMPS.slate;
const at = (name, i) => {
    const r = R_(name);
    return r[Math.max(0, Math.min(r.length - 1, i))];
};
const top = (name) => R_(name).length - 1;

// ─── 基础着色 ─────────────────────────────────────────────

/**
 * 球体（弹珠、宝珠、核心）：按法线与左上光的点积分四档 + 有序抖动过渡 + 高光。
 * @param {Raster} r
 * @param {number} cx 圆心
 * @param {number} cy
 * @param {number} rad 半径（美术像素）
 * @param {string} rampName
 * @param {{lo?:number, hi?:number, spec?:boolean, glass?:boolean}} [o] lo/hi：使用的色阶区间
 */
export function sphere(r, cx, cy, rad, rampName, o = {}) {
    const R = R_(rampName);
    const lo = o.lo ?? 1;
    const hi = o.hi ?? Math.max(lo + 1, R.length - 2);
    const span = hi - lo;
    const rr = rad * rad + rad * 0.8;
    for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
            const d2 = x * x + y * y;
            if (d2 > rr) continue;
            const k = rad + 0.5;
            const nx = x / k;
            const ny = y / k;
            const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            const lum = -nx * 0.5 - ny * 0.62 + nz * 0.6; // ≈ [-0.8, 1]
            let t = Math.max(0, Math.min(0.999, (lum + 0.55) / 1.5)) * (span + 1);
            const f = t - Math.floor(t);
            let idx = lo + Math.floor(t);
            if (f > 0.75 && bayer(cx + x, cy + y) < (f - 0.75) * 4) idx += 1;
            // 下缘反光一圈（玻璃/宝珠更通透）
            if (o.glass && ny > 0.62 && nx > -0.2) idx = Math.max(idx, lo + 1);
            r.set(cx + x, cy + y, R[Math.min(hi, idx)]);
        }
    }
    if (o.spec !== false) {
        const sx = cx - Math.max(1, Math.round(rad * 0.42));
        const sy = cy - Math.max(1, Math.round(rad * 0.48));
        r.set(sx, sy, R[R.length - 1]);
        if (rad >= 4) { r.set(sx + 1, sy, R[R.length - 2]); r.set(sx, sy + 1, R[R.length - 2]); }
    }
    return r;
}

/** 平面材质（金属/晶体/木）：遮罩内按到边缘的距离分亮暗斜面，无噪点。base 为主体色阶级。 */
export function shadeFlat(out, mask, rampName, base = 2, bevel = 1) {
    const R = R_(rampName);
    const n = R.length;
    const c = (i) => R[Math.max(0, Math.min(n - 1, i))];
    for (let y = 0; y < mask.h; y++) {
        for (let x = 0; x < mask.w; x++) {
            if (!mask.solid(x, y)) continue;
            const up = !mask.solid(x, y - 1);
            const left = !mask.solid(x - 1, y);
            const down = !mask.solid(x, y + 1);
            const right = !mask.solid(x + 1, y);
            let i = base;
            if (up || left) i = base + 2;
            else if (down || right) i = base - 1;
            else if (bevel > 1) {
                const up2 = !mask.solid(x, y - 2) || !mask.solid(x - 2, y);
                const dn2 = !mask.solid(x, y + 2) || !mask.solid(x + 2, y);
                if (up2) i = base + 1;
                else if (dn2) i = base - 1;
            }
            if (up && left) i = base + 3;
            out.set(x, y, c(i));
        }
    }
    return out;
}

/** 7×7 字形印到画板（可放大 scale 倍）；ramp 指定色阶，dim 降两级。 */
export function stampGlyph(r, name, x, y, rampName, o = {}) {
    const rows = ICON_ROWS[name];
    if (!rows) return r;
    const R = R_(rampName);
    const n = R.length;
    const s = o.scale || 1;
    const idxOf = (ch) => {
        let i = ch === 'b' ? Math.floor(n * 0.3) : ch === 'c' ? Math.min(n - 2, Math.floor(n * 0.62)) : n - 1;
        if (o.dim) i = Math.max(0, i - 2);
        if (o.bright) i = Math.min(n - 1, i + 1);
        return i;
    };
    for (let j = 0; j < rows.length; j++) {
        for (let i = 0; i < rows[j].length; i++) {
            const ch = rows[j][i];
            if (ch === '.') continue;
            for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) r.set(x + i * s + b, y + j * s + a, R[idxOf(ch)]);
        }
    }
    return r;
}

/** 收尾：INK 外描边 */
export function ink(r) {
    r.outline(INK, false);
    return r;
}

function mask(w, h, shapes) {
    return maskFromShapes(w, h, shapes);
}

/** 由多边形填出遮罩后按平面材质上色 */
function flatPoly(r, pts, rampName, base = 2) {
    const m = mask(r.w, r.h, [{ poly: pts }]);
    shadeFlat(r, m, rampName, base);
    return m;
}

function flatRect(r, x, y, w, h, rampName, base = 2) {
    const m = mask(r.w, r.h, [{ rect: [x, y, w, h] }]);
    shadeFlat(r, m, rampName, base);
    return m;
}

/** 刻进实心像素的发光线（只改已有像素） */
function etch(r, pts, rampName, lvl) {
    for (let i = 0; i + 1 < pts.length; i++) r.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], at(rampName, lvl), 255, true);
}

// ─── 晶体 ─────────────────────────────────────────────────

/** 竖直晶簇：中脊分左亮右暗两面 + 顶尖高光 */
export function crystal(r, cx, topY, h, halfW, rampName) {
    const m = mask(r.w, r.h, [{ poly: [[cx, topY], [cx + halfW, topY + Math.round(h * 0.3)], [cx + halfW - 1, topY + h], [cx - halfW + 1, topY + h], [cx - halfW, topY + Math.round(h * 0.3)]] }]);
    const R = R_(rampName);
    const n = R.length;
    for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
            if (!m.solid(x, y)) continue;
            let i = x < cx ? n - 3 : (x === cx ? n - 2 : 2);
            if (y > topY + h * 0.72) i = Math.max(1, i - 1);
            if (!m.solid(x + 1, y) || !m.solid(x, y + 1)) i = 1;
            r.set(x, y, R[i]);
        }
    }
    r.set(cx, topY + 1, R[n - 1]);
    r.set(cx - 1, topY + 3, R[n - 1]);
    return r;
}

// ─── 弹珠（弹药图标） ─────────────────────────────────────

const MARBLE_MARK = {
    // 每种弹珠的识别纹样（相对球心的像素偏移 + 亮度级 'd' 最亮 / 'b' 暗）
    pyro: [[0, -2, 'd'], [-1, -1, 'd'], [0, -1, 'd'], [-1, 0, 'd'], [0, 0, 'd'], [1, 0, 'c'], [0, 1, 'c']],
    explosive: [[-2, -1, 'b'], [-1, 0, 'b'], [0, 0, 'b'], [1, 1, 'b'], [2, 1, 'b'], [0, 1, 'b']],
    laser: [[-3, 0, 'd'], [-2, 0, 'd'], [-1, 0, 'd'], [0, 0, 'd'], [1, 0, 'd'], [2, 0, 'd'], [3, 0, 'd']],
    flying_sword: [[2, -2, 'd'], [1, -1, 'd'], [0, 0, 'd'], [-1, 1, 'd'], [-2, 2, 'c']],
    scatter: [[-2, -1, 'd'], [0, -2, 'd'], [2, -1, 'd'], [0, 1, 'c']],
    resonance: [[-2, 0, 'd'], [2, 0, 'd'], [0, -2, 'd'], [0, 2, 'd']],
    bounce: [[-2, 1, 'd'], [-1, 2, 'd'], [0, 2, 'd'], [1, 2, 'd'], [2, 1, 'd']],
    matryoshka: [[-1, -1, 'b'], [0, -1, 'b'], [1, -1, 'b'], [-1, 0, 'b'], [1, 0, 'b'], [-1, 1, 'b'], [0, 1, 'b'], [1, 1, 'b']],
    damage: [[0, -2, 'd'], [0, -1, 'd'], [-1, 0, 'd'], [0, 0, 'd'], [1, 0, 'd'], [0, 1, 'd'], [0, 2, 'c']],
    cryo: [[0, -2, 'd'], [0, 0, 'd'], [-2, 0, 'd'], [2, 0, 'd'], [0, 2, 'd'], [-1, -1, 'c'], [1, 1, 'c'], [1, -1, 'c'], [-1, 1, 'c']],
    echo: [[-2, -1, 'd'], [-2, 0, 'd'], [-2, 1, 'd'], [2, -1, 'c'], [2, 0, 'c'], [2, 1, 'c']],
    lightning: [[1, -3, 'd'], [0, -2, 'd'], [-1, -1, 'd'], [0, -1, 'd'], [1, 0, 'd'], [0, 1, 'd'], [-1, 2, 'd']],
    overcharge: [[0, -1, 'd'], [-1, 0, 'd'], [0, 0, 'd'], [1, 0, 'd'], [0, 1, 'd']],
    venom: [[-2, -1, 'b'], [1, -2, 'b'], [0, 1, 'b'], [2, 1, 'b'], [-1, 2, 'b']],
    wind: [[-2, -1, 'd'], [-1, -2, 'd'], [0, -2, 'd'], [1, -1, 'd'], [0, 0, 'd'], [-1, 1, 'c'], [0, 2, 'c'], [1, 2, 'c']],
    pierce: [[-3, 1, 'c'], [-2, 1, 'c'], [-1, 0, 'd'], [0, 0, 'd'], [1, -1, 'd'], [2, -2, 'd'], [2, -1, 'd'], [1, -2, 'd']],
};

const MARBLE_RAMP = {
    pyro: 'fire', explosive: 'fire', laser: 'cyan', flying_sword: 'cyan', scatter: 'brass', resonance: 'brass',
    bounce: 'rose', matryoshka: 'rose', damage: 'arcane', cryo: 'ice', echo: 'ice', lightning: 'volt',
    overcharge: 'volt', venom: 'venom', wind: 'mint', pierce: 'blood', white: 'slate', normal: 'slate', default: 'slate',
};

export function marbleRampOf(type) {
    return MARBLE_RAMP[type] || 'slate';
}

/** 弹珠图标 16×16：玻璃球（元素色阶）+ 识别纹样；七彩为分段彩带 */
export function drawMarble(type, size = 16) {
    const r = new Raster(size, size);
    const c = (size >> 1) - 1;
    const rad = Math.max(4, (size >> 1) - 2);
    if (type === 'rainbow') {
        const bands = ['blood', 'fire', 'volt', 'venom', 'cyan', 'arcane'];
        sphere(r, c, c, rad, 'slate', { lo: 3, hi: 8 });
        for (let y = 0; y < r.h; y++) {
            for (let x = 0; x < r.w; x++) {
                if (!r.solid(x, y)) continue;
                const b = bands[Math.max(0, Math.min(bands.length - 1, Math.floor(((x - y) + size) / (size * 2) * bands.length)))];
                const shade = (x + y) < c * 2 - 2 ? 4 : 3;
                r.set(x, y, at(b, shade));
            }
        }
        r.set(c - 2, c - 3, at('slate', 9));
        r.set(c - 1, c - 3, at('slate', 8));
        return ink(r);
    }
    const ramp = marbleRampOf(type);
    const plain = type === 'white' || type === 'normal' || type === 'default';
    sphere(r, c, c, rad, ramp, { lo: plain ? 4 : 1, hi: plain ? 8 : top(ramp) - 1, glass: true });
    const mark = MARBLE_MARK[type];
    if (mark) {
        const n = R_(ramp).length;
        for (const [dx, dy, ch] of mark) {
            const lvl = ch === 'd' ? n - 1 : ch === 'c' ? n - 2 : 0;
            r.paint(c + dx + 1, c + dy + 1, at(ramp, lvl));
        }
    }
    return ink(r);
}

// ─── 属性徽记 / 词条徽记 ──────────────────────────────────

/** 属性徽记 16×16：石质圆槽 + 元素字形 */
export function drawAttributeBadge(glyph, rampName, empty = false) {
    const r = new Raster(16, 16);
    const m = mask(16, 16, [{ disc: [7, 7, 6] }]);
    shadeStone(r, m, { ramp: 'stone', base: 2, bevel: 1, seed: 5, grit: 0 });
    // 内凹：中心一圈暗
    for (let y = 2; y < 13; y++) for (let x = 2; x < 13; x++) {
        const d = (x - 7) * (x - 7) + (y - 7) * (y - 7);
        if (d <= 22) r.paint(x, y, at('stone', 1));
    }
    if (!empty) stampGlyph(r, glyph, 4, 4, rampName, { bright: true });
    else r.ring(7, 7, 3, at('stone', 3));
    return ink(r);
}

/** 属性条签 24×10：石面签 + 左侧字形，右侧元素色条 */
export function drawAttributeChip(glyph, rampName, empty = false) {
    const r = new Raster(24, 10);
    const m = mask(24, 10, [{ poly: chamferRect(0, 0, 23, 9, 2) }]);
    shadeFlat(r, m, 'slate', 2);
    if (!empty) {
        stampGlyph(r, glyph, 2, 1, rampName, { bright: true });
        for (let x = 11; x < 21; x++) { r.paint(x, 4, at(rampName, 3)); r.paint(x, 5, at(rampName, 2)); }
    }
    return ink(r);
}

/** 敌人词条徽记 16×16：六角铁牌（元素色阶边）+ 字形 */
export function drawAffixBadge(glyph, rampName) {
    const r = new Raster(16, 16);
    const hex = [[7, 0], [14, 4], [14, 11], [7, 15], [0, 11], [0, 4]];
    const m = mask(16, 16, [{ poly: hex }]);
    shadeFlat(r, m, 'slate', 1);
    // 元素色内缘
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!m.solid(x, y)) continue;
        const edge = !m.solid(x - 1, y) || !m.solid(x + 1, y) || !m.solid(x, y - 1) || !m.solid(x, y + 1);
        if (edge) r.set(x, y, at(rampName, (x + y) < 15 ? 3 : 1));
    }
    stampGlyph(r, glyph, 4, 4, rampName, { bright: true });
    return ink(r);
}

// ─── 符文石 ───────────────────────────────────────────────

/** 符文石 24×24：切角石碑 + 发光刻字；level≥2 加黄铜包边与两颗铆钉 */
export function drawRune(glyph, rampName, level = 1, seed = 1) {
    const r = new Raster(24, 24);
    const m = mask(24, 24, [{ poly: chamferRect(3, 1, 17, 21, 4) }]);
    chipEdges(m, seed, 0.05);
    shadeStone(r, m, { ramp: 'stone', base: 3, bevel: 1, seed, grit: 0.01 });
    // 刻槽：字形放大 2 倍；先在右下刻 1px 暗槽，再按字形自身的明暗印上（不是一片最亮色）
    const g = new Raster(24, 24);
    stampGlyph(g, glyph, 5, 5, rampName, { scale: 2 });
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        if (g.solid(x, y) && !g.solid(x + 1, y + 1)) r.paint(x + 1, y + 1, at('stone', 0));
    }
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const v = g.px[y * 24 + x];
        if (v >>> 24 && r.solid(x, y)) r.px[y * 24 + x] = v;
    }
    if (level >= 2) {
        for (let x = 6; x < 18; x++) { r.paint(x, 2, at('brass', 4)); r.paint(x, 21, at('brass', 2)); }
        rivet(r, 5, 19);
        rivet(r, 17, 19);
    } else {
        r.paint(11, 19, at(rampName, top(rampName)));
    }
    return ink(r);
}

// ─── 遗物物件（32×32 画布，主体约 26px） ──────────────────

const S = 32;

function obj() {
    return new Raster(S, S);
}

/** 宝珠立在黄铜底座上 */
function oOrb(ramp) {
    const r = obj();
    flatPoly(r, [[9, 25], [23, 25], [21, 29], [11, 29]], 'brass', 3);
    flatRect(r, 12, 23, 8, 3, 'brass', 2);
    sphere(r, 16, 13, 10, ramp, { glass: true });
    etch(r, [[11, 15], [14, 12], [18, 16], [21, 12]], ramp, top(ramp));
    return ink(r);
}

/** 群星：三颗四角星（大中小） */
function oStars(ramp) {
    const r = obj();
    const star = (cx, cy, s) => {
        const pts = [];
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i - Math.PI / 2;
            const rad = i % 2 === 0 ? s : Math.max(1, Math.round(s * 0.34));
            pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
        }
        flatPoly(r, pts, ramp, 3);
        r.set(cx, cy, at(ramp, top(ramp)));
    };
    star(13, 14, 10);
    star(24, 8, 5);
    star(24, 24, 4);
    return ink(r);
}

/** 透镜：黄铜镜框 + 玻璃镜片 + 手柄 */
function oLens(ramp) {
    const r = obj();
    flatPoly(r, [[19, 20], [22, 18], [29, 26], [26, 29]], 'brass', 3);
    r.disc(13, 13, 10, at('brass', 3));
    const m = mask(S, S, [{ disc: [13, 13, 10] }]);
    shadeFlat(r, m, 'brass', 3);
    sphere(r, 13, 13, 7, ramp, { lo: 1, hi: 4, glass: true });
    r.line(9, 10, 11, 8, at(ramp, top(ramp)), 255, true);
    return ink(r);
}

/** 凝胶：一滴软团，两只高光 */
function oSlime(ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[16, 4], [20, 9], [26, 15], [28, 23], [24, 28], [8, 28], [4, 23], [6, 15], [12, 9]] }]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (!m.solid(x, y)) continue;
        const t = (y - 4) / 24;
        let i = t < 0.35 ? 4 : t < 0.7 ? 3 : 2;
        if (!m.solid(x + 1, y) || !m.solid(x, y + 1)) i = 1;
        if (!m.solid(x - 1, y) && y < 22) i = 4;
        r.set(x, y, at(ramp, i));
    }
    r.rect(11, 12, 2, 3, at(ramp, top(ramp)));
    r.set(14, 10, at(ramp, top(ramp)));
    r.rect(12, 20, 2, 2, INK);
    r.rect(18, 20, 2, 2, INK);
    return ink(r);
}

/** 盾：黄铜边 + 元素面 + 竖脊 */
function oShield(ramp, emblem) {
    const r = obj();
    const outer = [[4, 4], [28, 4], [28, 15], [16, 29], [4, 15]];
    flatPoly(r, outer, 'brass', 3);
    const inner = [[7, 7], [25, 7], [25, 14], [16, 25], [7, 14]];
    flatPoly(r, inner, ramp, 2);
    if (emblem) stampGlyph(r, emblem, 13, 10, ramp, { bright: true });
    else for (let y = 8; y < 24; y++) r.paint(16, y, at(ramp, top(ramp) - 1));
    return ink(r);
}

/** 元素石：粗糙岩块 + 嵌在中央的元素晶核 + 字形 */
function oElemStone(ramp, glyph, seed = 3) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[9, 6], [21, 4], [28, 12], [27, 23], [19, 29], [8, 27], [4, 17]] }]);
    chipEdges(m, seed, 0.12);
    shadeStone(r, m, { ramp: 'stone', base: 3, bevel: 1, seed, grit: 0.02 });
    // 晶核裂口
    r.disc(16, 16, 6, at(ramp, 2));
    for (let y = 10; y < 23; y++) for (let x = 10; x < 23; x++) {
        const d = (x - 16) * (x - 16) + (y - 16) * (y - 16);
        if (d <= 20) r.paint(x, y, at(ramp, d < 8 ? top(ramp) - 1 : 3));
    }
    if (glyph) stampGlyph(r, glyph, 13, 13, ramp, { bright: true });
    return ink(r);
}

/** 补给箱：木/石箱 + 黄铜包角 + 元素徽记 */
function oCrate(ramp, glyph) {
    const r = obj();
    flatRect(r, 4, 9, 24, 19, 'stone', 4);
    flatRect(r, 3, 6, 26, 5, 'stone', 5);
    for (let x = 4; x < 28; x++) { r.paint(x, 18, at('stone', 2)); }
    [[3, 6], [26, 6], [3, 25], [26, 25]].forEach(([x, y]) => { r.rect(x, y, 3, 3, at('brass', 4)); r.set(x + 2, y + 2, at('brass', 2)); });
    r.rect(11, 13, 11, 11, at(ramp, 1));
    stampGlyph(r, glyph || 'star', 13, 15, ramp, { bright: true });
    return ink(r);
}

/** 潮涌：晶簇 + 上扬箭头 */
function oSurge(ramp) {
    const r = obj();
    crystal(r, 13, 5, 23, 7, ramp);
    crystal(r, 22, 13, 15, 5, ramp);
    flatPoly(r, [[24, 2], [29, 7], [26, 7], [26, 11], [22, 11], [22, 7], [19, 7]], 'brass', 4);
    return ink(r);
}

/** 炸药：两根扎在一起的药筒 + 引信火星 */
function oDynamite(ramp) {
    const r = obj();
    flatRect(r, 7, 11, 8, 17, 'blood', 3);
    flatRect(r, 16, 11, 8, 17, 'blood', 3);
    flatRect(r, 6, 17, 19, 3, 'brass', 3);
    r.line(15, 11, 18, 5, at('slate', 6));
    r.line(16, 11, 19, 5, at('slate', 4));
    r.disc(20, 4, 2, at(ramp, 4));
    r.set(20, 4, at(ramp, top(ramp)));
    return ink(r);
}

/** 棱镜：三棱柱 + 七彩折射线 */
function oPrism() {
    const r = obj();
    const m = flatPoly(r, [[14, 3], [26, 26], [3, 26]], 'ice', 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (m.solid(x, y) && x > 14 + (y - 3) * 0.05) r.paint(x, y, at('ice', 2));
    const bands = ['blood', 'fire', 'volt', 'venom', 'cyan', 'arcane'];
    bands.forEach((b, i) => r.line(18, 16 + i, 30, 12 + i * 3, at(b, 4)));
    return ink(r);
}

/** 套娃：大娃身 + 头 + 腰线 + 内套小娃轮廓 */
function oDoll(ramp) {
    const r = obj();
    const m = mask(S, S, [{ disc: [16, 10, 6] }, { poly: [[9, 14], [23, 14], [26, 22], [24, 29], [8, 29], [6, 22]] }]);
    shadeFlat(r, m, ramp, 3);
    r.disc(16, 10, 4, at('slate', 8));
    r.set(14, 10, INK); r.set(18, 10, INK);
    r.set(15, 12, at('blood', 4)); r.set(16, 12, at('blood', 4));
    for (let x = 8; x < 25; x++) r.paint(x, 20, at('brass', 4));
    r.ring(16, 24, 3, at(ramp, top(ramp)));
    return ink(r);
}

/** 火药管：竖直黄铜管 + 粉末视窗 */
function oTube(ramp) {
    const r = obj();
    flatRect(r, 11, 4, 10, 25, 'brass', 3);
    flatRect(r, 9, 4, 14, 3, 'brass', 4);
    flatRect(r, 9, 26, 14, 3, 'brass', 2);
    r.rect(14, 9, 4, 14, at(ramp, 2));
    for (let y = 15; y < 23; y++) { r.set(14, y, at(ramp, 4)); r.set(15, y, at(ramp, top(ramp) - 1)); r.set(16, y, at(ramp, 4)); r.set(17, y, at(ramp, 3)); }
    return ink(r);
}

/** 屏障：盾 + 十字（守护） */
function oBarrier(ramp) {
    return oShield(ramp, 'cross');
}

/** 硬币：黄铜圆币 + 环形箭头 */
function oCoin() {
    const r = obj();
    sphere(r, 16, 16, 12, 'brass', { lo: 2, hi: 5 });
    r.ring(16, 16, 9, at('brass', 2));
    stampGlyph(r, 'rings', 13, 13, 'brass', { bright: true });
    return ink(r);
}

/** 封印票：卷边羊皮票 + 红蜡封 */
function oSeal(ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[5, 6], [27, 6], [27, 22], [5, 22]] }]);
    shadeFlat(r, m, 'brass', 4);
    for (let x = 7; x < 25; x += 1) if (x % 3) r.paint(x, 10, at('brass', 2));
    for (let x = 7; x < 20; x += 1) if (x % 4) r.paint(x, 13, at('brass', 2));
    sphere(r, 20, 21, 6, ramp, { lo: 1, hi: 4 });
    stampGlyph(r, 'star', 17, 18, ramp, { bright: true });
    return ink(r);
}

/** 虚空核心：暗球 + 吸积环 */
function oVoidCore(ramp) {
    const r = obj();
    for (let x = 2; x < 30; x++) {
        const y = 16 + Math.round(Math.sin((x - 2) / 28 * Math.PI) * 2) - 1;
        r.set(x, y, at(ramp, 4));
        r.set(x, y + 1, at(ramp, 3));
    }
    sphere(r, 16, 15, 8, ramp, { lo: 0, hi: 2, spec: false });
    r.ring(16, 15, 8, at(ramp, 5));
    for (let x = 6; x < 26; x++) {
        const y = 16 + Math.round(Math.sin((x - 2) / 28 * Math.PI) * 2) - 1;
        if (x < 9 || x > 23) continue;
        r.set(x, y + 2, at(ramp, top(ramp) - 1));
    }
    return ink(r);
}

/** 沙漏：黄铜上下盖 + 两只玻璃泡 + 流沙 */
function oHourglass(ramp) {
    const r = obj();
    flatRect(r, 6, 3, 20, 3, 'brass', 3);
    flatRect(r, 6, 26, 20, 3, 'brass', 3);
    const m = mask(S, S, [{ poly: [[8, 6], [24, 6], [17, 16], [24, 26], [8, 26], [15, 16]] }]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (m.solid(x, y)) r.set(x, y, at('slate', x < 14 ? 5 : 4));
    r.poly([[11, 20], [21, 20], [24, 26], [8, 26]], at(ramp, 4));
    r.poly([[12, 8], [20, 8], [17, 12], [15, 12]], at(ramp, 3));
    r.line(16, 12, 16, 20, at(ramp, top(ramp)));
    r.line(7, 6, 7, 26, at('brass', 2));
    r.line(25, 6, 25, 26, at('brass', 2));
    return ink(r);
}

/** 羽毛：斜置的羽片 + 羽轴 */
function oFeather(ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[25, 3], [28, 7], [20, 20], [11, 26], [7, 25], [9, 18], [18, 7]] }]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (!m.solid(x, y)) continue;
        const side = (x + y) - 32;
        let i = side < -2 ? 4 : side > 2 ? 2 : 3;
        if (hash2(x, y, 7) < 0.12) i -= 1;
        r.set(x, y, at(ramp, i));
    }
    r.line(27, 4, 6, 28, at(ramp, top(ramp)));
    r.line(5, 29, 7, 27, at('slate', 7));
    return ink(r);
}

/** 药匣：黄铜包角木匣 + 三支药瓶 */
function oApothecary(ramp) {
    const r = obj();
    flatRect(r, 4, 16, 24, 12, 'stone', 4);
    flatRect(r, 3, 14, 26, 3, 'brass', 3);
    [[9, ramp], [16, 'arcane'], [23, 'fire']].forEach(([x, rp]) => {
        flatRect(r, x - 1, 5, 3, 3, 'slate', 6);
        sphere(r, x, 11, 3, rp, { lo: 2, hi: 5 });
    });
    rivet(r, 5, 25);
    rivet(r, 25, 25);
    return ink(r);
}

/** 行囊 */
function oBag() {
    const r = obj();
    const m = mask(S, S, [{ poly: [[10, 9], [22, 9], [27, 17], [26, 27], [6, 27], [5, 17]] }]);
    shadeStone(r, m, { ramp: 'brass', base: 2, bevel: 1, seed: 9, grit: 0.02 });
    flatPoly(r, [[11, 4], [21, 4], [22, 10], [10, 10]], 'brass', 1);
    for (let x = 9; x < 24; x++) r.paint(x, 11, at('brass', 4));
    r.rect(14, 14, 4, 4, at('brass', 5));
    return ink(r);
}

/** 宝箱：拱盖 + 黄铜带 + 锁扣 */
function oChest(ramp) {
    const r = obj();
    flatRect(r, 4, 15, 24, 13, 'stone', 4);
    const lid = mask(S, S, [{ poly: [[4, 15], [4, 10], [8, 6], [24, 6], [28, 10], [28, 15]] }]);
    shadeFlat(r, lid, 'stone', 5);
    for (let y = 6; y < 28; y++) { r.paint(9, y, at('brass', 4)); r.paint(22, y, at('brass', 3)); }
    for (let x = 4; x < 28; x++) r.paint(x, 15, at('brass', 2));
    flatRect(r, 14, 13, 5, 6, ramp, 3);
    r.set(16, 16, INK);
    return ink(r);
}

/** 密库：铁门 + 大钥匙 */
function oVault(ramp) {
    const r = obj();
    flatRect(r, 4, 4, 24, 24, 'slate', 3);
    r.ring(16, 16, 8, at('slate', 6), 255, 2);
    for (let a = 0; a < 6; a++) {
        const x = 16 + Math.round(Math.cos(a * Math.PI / 3) * 8);
        const y = 16 + Math.round(Math.sin(a * Math.PI / 3) * 8);
        rivet(r, x - 1, y - 1);
    }
    sphere(r, 16, 16, 4, ramp, { lo: 2, hi: 5 });
    return ink(r);
}

/** 圣所：小神龛（台阶 + 立柱 + 三角楣 + 中央光核） */
function oSanctum(ramp) {
    const r = obj();
    flatPoly(r, [[16, 3], [29, 11], [3, 11]], 'brass', 3);
    flatRect(r, 3, 26, 26, 3, 'stone', 5);
    flatRect(r, 5, 23, 22, 3, 'stone', 4);
    [6, 23].forEach((x) => flatRect(r, x, 11, 3, 12, 'stone', 5));
    flatRect(r, 10, 12, 12, 11, 'stone', 1);
    sphere(r, 16, 17, 4, ramp, { lo: 3, hi: top(ramp) - 1 });
    return ink(r);
}

/** 利刃：斜置刀身（血槽）+ 黄铜护手 */
function oBlade(ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[27, 2], [29, 4], [13, 21], [11, 19]] }]);
    shadeFlat(r, m, 'slate', 5);
    r.line(26, 4, 13, 18, at(ramp, 3), 255, true);
    flatPoly(r, [[7, 17], [10, 14], [17, 21], [14, 24]], 'brass', 3);
    flatPoly(r, [[9, 22], [11, 24], [6, 29], [4, 27]], 'stone', 3);
    r.set(5, 28, at('brass', 5));
    return ink(r);
}

/** 靶心 */
function oTarget(ramp) {
    const r = obj();
    r.disc(16, 16, 12, at('slate', 7));
    r.ring(16, 16, 12, at(ramp, 3), 255, 3);
    r.ring(16, 16, 6, at(ramp, 3), 255, 3);
    r.disc(16, 16, 2, at(ramp, 4));
    flatPoly(r, [[29, 2], [30, 3], [18, 15], [17, 14]], 'brass', 3);
    r.set(30, 2, at('slate', 8));
    return ink(r);
}

/** 共鸣核：笼中晶核（黄铜四柱 + 发光核） */
function oCore(ramp) {
    const r = obj();
    flatRect(r, 6, 3, 20, 3, 'brass', 3);
    flatRect(r, 6, 26, 20, 3, 'brass', 3);
    sphere(r, 16, 16, 7, ramp, { lo: 2 });
    [7, 12, 20, 25].forEach((x) => { for (let y = 6; y < 26; y++) r.set(x, y, at('brass', x < 16 ? 4 : 2)); });
    return ink(r);
}

/** 虹吸管：U 形管 + 液滴 */
function oSiphon(ramp) {
    const r = obj();
    const m = mask(S, S, [{ rect: [5, 4, 5, 18] }, { rect: [21, 10, 5, 12] }, { disc: [15, 21, 8] }]);
    const cut = mask(S, S, [{ rect: [10, 0, 11, 21] }, { disc: [15, 21, 3] }]);
    for (let i = 0; i < m.px.length; i++) if (cut.px[i]) m.px[i] = 0;
    shadeFlat(r, m, 'brass', 3);
    for (let y = 14; y < 27; y++) for (let x = 6; x < 26; x++) if (m.solid(x, y) && y > 18) r.set(x, y, at(ramp, 4));
    r.disc(23, 6, 2, at(ramp, 4));
    r.set(23, 4, at(ramp, top(ramp)));
    return ink(r);
}

/** 齐射管：三支并排炮管（黄铜箍） */
function oSalvo(ramp) {
    const r = obj();
    [[6, 12], [13, 6], [20, 12]].forEach(([x, y]) => {
        flatRect(r, x, y, 6, 22 - (y - 6), 'slate', 3);
        flatRect(r, x - 1, y, 8, 2, 'brass', 4);
        r.rect(x + 1, y - 2, 4, 2, at(ramp, 4));
    });
    flatRect(r, 4, 24, 24, 4, 'brass', 3);
    return ink(r);
}

/** 线圈：中轴 + 斜绕铜线 + 电弧 */
function oCoil(ramp) {
    const r = obj();
    flatRect(r, 13, 3, 6, 26, 'slate', 3);
    for (let y = 6; y < 26; y += 3) {
        r.line(10, y + 1, 22, y - 1, at('brass', 4));
        r.line(10, y + 2, 22, y, at('brass', 2));
    }
    r.line(25, 6, 28, 10, at(ramp, top(ramp)));
    r.line(28, 10, 25, 14, at(ramp, top(ramp)));
    r.line(4, 18, 7, 22, at(ramp, top(ramp) - 1));
    return ink(r);
}

/** 保险丝：两端黄铜帽 + 玻璃管内的发红熔丝 */
function oFuse(ramp) {
    const r = obj();
    flatRect(r, 4, 11, 6, 10, 'brass', 3);
    flatRect(r, 22, 11, 6, 10, 'brass', 3);
    for (let x = 10; x < 22; x++) for (let y = 12; y < 20; y++) r.set(x, y, at('slate', y < 14 ? 6 : 4));
    for (let x = 10; x < 22; x++) r.set(x, 16 + Math.round(Math.sin(x * 1.3)), at(ramp, top(ramp) - 1));
    r.disc(16, 7, 2, at(ramp, 4));
    r.set(16, 6, at(ramp, top(ramp)));
    return ink(r);
}

/** 镜：椭圆镜面 + 黄铜框 + 反光斜线 */
function oMirror(ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[16, 2], [25, 6], [27, 16], [25, 26], [16, 30], [7, 26], [5, 16], [7, 6]] }]);
    shadeFlat(r, m, 'brass', 3);
    const glass = mask(S, S, [{ poly: [[16, 5], [23, 8], [24, 16], [23, 24], [16, 27], [9, 24], [8, 16], [9, 8]] }]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (glass.solid(x, y)) r.set(x, y, at(ramp, (x + y) < 26 ? 4 : 2));
    r.line(11, 12, 15, 8, at(ramp, top(ramp)));
    r.line(13, 15, 18, 10, at(ramp, top(ramp) - 1));
    return ink(r);
}

/** 时钟：表盘 + 红色指针 + 顶部按钮 */
function oClock(ramp) {
    const r = obj();
    flatRect(r, 14, 2, 4, 4, 'brass', 3);
    r.disc(16, 17, 12, at('brass', 3));
    const m = mask(S, S, [{ disc: [16, 17, 12] }]);
    shadeFlat(r, m, 'brass', 3);
    r.disc(16, 17, 9, at('slate', 8));
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        r.set(16 + Math.round(Math.cos(a) * 8), 17 + Math.round(Math.sin(a) * 8), at('slate', 4));
    }
    r.line(16, 17, 16, 10, INK);
    r.line(16, 17, 21, 20, at(ramp, 3));
    r.set(16, 17, at(ramp, 4));
    return ink(r);
}

/** 铃 */
function oBell(ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[16, 4], [21, 7], [23, 15], [27, 24], [5, 24], [9, 15], [11, 7]] }]);
    shadeFlat(r, m, 'brass', 3);
    flatRect(r, 4, 24, 24, 3, 'brass', 2);
    r.disc(16, 28, 2, at('brass', 4));
    r.line(28, 8, 30, 14, at(ramp, top(ramp)));
    r.line(2, 14, 4, 8, at(ramp, top(ramp)));
    return ink(r);
}

/** 注射器 */
function oSyringe(ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: [[21, 4], [28, 11], [13, 26], [6, 19]] }]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (m.solid(x, y)) r.set(x, y, at('slate', (x - y) > 14 ? 7 : 5));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (m.solid(x, y) && x + y > 31) r.paint(x, y, at(ramp, (x - y) > 13 ? 4 : 3));
    r.line(6, 26, 2, 30, at('slate', 7));
    flatPoly(r, [[22, 2], [30, 10], [28, 12], [20, 4]], 'brass', 3);
    return ink(r);
}

/** 协议芯片：电路板 + 引脚 + 发光走线 */
function oChip(ramp) {
    const r = obj();
    for (let i = 7; i < 26; i += 3) { r.rect(i, 3, 1, 3, at('brass', 4)); r.rect(i, 26, 1, 3, at('brass', 3)); r.rect(3, i, 3, 1, at('brass', 4)); r.rect(26, i, 3, 1, at('brass', 3)); }
    flatRect(r, 6, 6, 20, 20, 'slate', 2);
    etch(r, [[9, 10], [14, 10], [14, 16], [22, 16]], ramp, top(ramp) - 1);
    etch(r, [[9, 21], [18, 21], [18, 12], [22, 12]], ramp, top(ramp) - 1);
    r.rect(14, 14, 4, 4, at(ramp, top(ramp)));
    return ink(r);
}

/** 爆裂：烟花放射 */
function oBurst(ramp) {
    const r = obj();
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const len = i % 2 ? 9 : 13;
        r.line(16, 16, 16 + Math.round(Math.cos(a) * len), 16 + Math.round(Math.sin(a) * len), at(ramp, i % 2 ? 3 : 4));
        r.set(16 + Math.round(Math.cos(a) * (len + 1)), 16 + Math.round(Math.sin(a) * (len + 1)), at(ramp, top(ramp)));
    }
    sphere(r, 16, 16, 4, ramp, { lo: 3, hi: top(ramp) });
    return ink(r);
}

/** 电弧回廊：两根导电柱 + 之字电弧 */
function oArc(ramp) {
    const r = obj();
    flatRect(r, 4, 10, 5, 19, 'slate', 3);
    flatRect(r, 23, 10, 5, 19, 'slate', 3);
    sphere(r, 6, 8, 3, ramp, { lo: 3 });
    sphere(r, 25, 8, 3, ramp, { lo: 3 });
    const pts = [[8, 9], [12, 13], [15, 7], [18, 14], [21, 8], [24, 10]];
    etchFree(r, pts, at(ramp, top(ramp)));
    return ink(r);
}

function etchFree(r, pts, color) {
    for (let i = 0; i + 1 < pts.length; i++) r.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color);
}

/** 契约：卷轴 + 血印 */
function oPact(ramp) {
    const r = obj();
    flatRect(r, 7, 5, 18, 22, 'brass', 4);
    flatRect(r, 5, 3, 22, 4, 'brass', 3);
    flatRect(r, 5, 25, 22, 4, 'brass', 3);
    for (let y = 9; y < 22; y += 3) for (let x = 9; x < 23; x++) if ((x + y) % 4) r.paint(x, y, at('brass', 2));
    r.disc(20, 20, 4, at(ramp, 3));
    r.set(19, 19, at(ramp, 5));
    r.line(20, 24, 21, 28, at(ramp, 2));
    return ink(r);
}

/** 轮盘：八格转盘 + 黄铜指针 */
function oWheel(ramp) {
    const r = obj();
    for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) {
        if (x * x + y * y > 12 * 12 + 9) continue;
        const sector = Math.floor(((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * 8) % 8;
        r.set(16 + x, 17 + y, sector % 2 ? at(ramp, 3) : at('slate', 2));
    }
    r.ring(16, 17, 12, at('brass', 4), 255, 2);
    sphere(r, 16, 17, 3, 'brass', { lo: 2, hi: 5 });
    flatPoly(r, [[13, 1], [19, 1], [16, 7]], 'brass', 4);
    return ink(r);
}

/** 钉盘砖：石板 + 按阵型排布的钉子 */
const PEG_PATTERNS = {
    rows: [[0, 0], [1, 0], [2, 0], [3, 0], [0.5, 1], [1.5, 1], [2.5, 1], [0, 2], [1, 2], [2, 2], [3, 2]],
    triangle: [[1.5, 0], [1, 1], [2, 1], [0.5, 2], [1.5, 2], [2.5, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
    diamond: [[1.5, 0], [1, 1], [2, 1], [0.5, 2], [2.5, 2], [1, 3], [2, 3], [1.5, 4]],
    sparse: [[0, 0], [2, 0], [1, 1.5], [3, 1.5], [0, 3], [2, 3]],
    mirror: [[0, 0], [3, 0], [0.7, 1], [2.3, 1], [1.2, 2], [1.8, 2], [0.7, 3], [2.3, 3]],
    widenarrow: [[0, 0], [1, 0], [2, 0], [3, 0], [0.5, 1.2], [1.5, 1.2], [2.5, 1.2], [1, 2.4], [2, 2.4], [1.5, 3.4]],
};

function oPegTile(pattern, ramp) {
    const r = obj();
    const m = mask(S, S, [{ poly: chamferRect(2, 2, 27, 27, 3) }]);
    shadeStone(r, m, { ramp: 'stone', base: 2, bevel: 1, seed: 11, grit: 0.01 });
    const pts = PEG_PATTERNS[pattern] || PEG_PATTERNS.rows;
    const maxX = Math.max(...pts.map((p) => p[0]));
    const maxY = Math.max(...pts.map((p) => p[1]));
    // 钉子：3×3 菱形 + 1px 落影，比石板亮得多，阵型一眼可读
    pts.forEach(([px, py], i) => {
        const x = Math.round(8 + (maxX ? px / maxX : 0.5) * 15);
        const y = Math.round(8 + (maxY ? py / maxY : 0.5) * 15);
        const rp = i % 3 === 0 ? ramp : 'slate';
        const hi = top(rp);
        r.set(x + 1, y + 2, at('stone', 0));
        r.set(x + 2, y + 1, at('stone', 0));
        r.set(x, y - 1, at(rp, hi));
        r.set(x - 1, y, at(rp, hi - 1));
        r.set(x, y, at(rp, hi));
        r.set(x + 1, y, at(rp, hi - 2));
        r.set(x, y + 1, at(rp, hi - 3));
    });
    return ink(r);
}

/** 钥匙 + 元素字形（解锁类） */
function oKey(ramp, glyph) {
    const r = obj();
    r.ring(10, 10, 6, at('brass', 4), 255, 3);
    flatPoly(r, [[13, 13], [15, 11], [29, 25], [27, 27]], 'brass', 3);
    r.rect(22, 22, 3, 5, at('brass', 3));
    r.rect(25, 25, 3, 4, at('brass', 3));
    if (glyph) {
        r.rect(17, 2, 13, 11, at(ramp, 1));
        stampGlyph(r, glyph, 20, 4, ramp, { bright: true });
    }
    return ink(r);
}

/** 弹药带：斜挎皮带 + 一排弹珠弹仓 + 黄铜扣 */
function oBandolier() {
    const r = obj();
    const m = mask(S, S, [{ poly: [[2, 8], [7, 3], [30, 24], [25, 29]] }]);
    shadeStone(r, m, { ramp: 'brass', base: 1, bevel: 1, seed: 21, grit: 0.02 });
    ['fire', 'ice', 'volt', 'venom'].forEach((rp, i) => sphere(r, 9 + i * 5, 11 + i * 4, 3, rp, { lo: 2, hi: 5 }));
    flatRect(r, 21, 20, 6, 6, 'brass', 4);
    r.set(23, 22, INK);
    return ink(r);
}

/** 扩槽：三个石槽，最右一个是新亮起的 */
function oSlots(ramp) {
    const r = obj();
    [[3, 11], [12, 11], [21, 11]].forEach(([x, y], i) => {
        flatRect(r, x, y, 8, 10, 'stone', 4);
        r.rect(x + 2, y + 2, 4, 6, i === 2 ? at(ramp, 4) : at('stone', 1));
    });
    flatPoly(r, [[24, 3], [29, 8], [26, 8], [26, 10], [22, 10], [22, 8], [19, 8]], 'brass', 4);
    return ink(r);
}

/** 精华瓶：圆底瓶 + 液体 + 软木塞 */
function oFlask(ramp, glyph) {
    const r = obj();
    flatRect(r, 13, 3, 6, 4, 'brass', 2);
    flatRect(r, 14, 7, 4, 5, 'slate', 6);
    sphere(r, 16, 20, 9, 'slate', { lo: 5, hi: 8 });
    for (let y = 18; y < 30; y++) for (let x = 6; x < 27; x++) {
        if (!r.solid(x, y)) continue;
        const d = (x - 16) * (x - 16) + (y - 20) * (y - 20);
        if (d <= 64) r.set(x, y, at(ramp, y < 21 ? 4 : 3));
    }
    if (glyph) stampGlyph(r, glyph, 13, 18, ramp, { bright: true });
    r.set(11, 15, at('slate', 9));
    r.set(11, 16, at('slate', 8));
    return ink(r);
}

/** 维度晶体：大晶簇（三根） */
function oCrystalCluster(ramp, big = false) {
    const r = obj();
    crystal(r, 16, big ? 2 : 6, big ? 26 : 22, 6, ramp);
    crystal(r, 8, 13, 15, 4, ramp);
    crystal(r, 24, 11, 17, 4, ramp);
    return ink(r);
}

/** 技能印记：黄铜六角框 + 元素面 + 字形 */
export function drawSkillSigil(glyph, rampName) {
    const r = new Raster(24, 24);
    const hex = [[12, 1], [22, 6], [22, 17], [12, 22], [2, 17], [2, 6]];
    flatPoly(r, hex, 'brass', 3);
    const inner = [[12, 4], [19, 8], [19, 15], [12, 19], [5, 15], [5, 8]];
    const m = mask(24, 24, [{ poly: inner }]);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        if (!m.solid(x, y)) continue;
        r.set(x, y, at(rampName, (x + y) < 22 ? 2 : 1));
    }
    stampGlyph(r, glyph, 9, 8, rampName, { bright: true });
    return ink(r);
}

/** 掉落胶囊 20×24：玻璃胶囊 + 黄铜箍 + 色阶内芯 */
export function drawCapsule(rampName) {
    const r = new Raster(20, 24);
    const m = mask(20, 24, [{ disc: [9, 7, 6] }, { rect: [3, 7, 13, 10] }, { disc: [9, 16, 6] }]);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) if (m.solid(x, y)) r.set(x, y, at('slate', x < 8 ? 6 : 4));
    for (let y = 9; y < 22; y++) for (let x = 4; x < 16; x++) if (m.solid(x, y) && y > 11) r.paint(x, y, at(rampName, x < 8 ? 4 : 3));
    for (let x = 3; x < 16; x++) { r.paint(x, 10, at('brass', 4)); r.paint(x, 11, at('brass', 2)); }
    r.set(6, 4, at('slate', 9));
    r.set(5, 5, at('slate', 8));
    return ink(r);
}

/** 倍率牌 24×12：黄铜牌 + ×N（点阵数字由调用方印） */
export function drawPlaque(rampName = 'brass') {
    const r = new Raster(24, 12);
    const m = mask(24, 12, [{ poly: chamferRect(0, 0, 23, 11, 2) }]);
    shadeFlat(r, m, rampName, 3);
    r.rect(3, 3, 18, 6, at(rampName, 1));
    return ink(r);
}

/** 未知首领封印 32×32：石盘 + 锁孔 */
export function drawUnknownSeal() {
    const r = new Raster(32, 32);
    const m = mask(32, 32, [{ disc: [16, 16, 13] }]);
    shadeStone(r, m, { ramp: 'stone', base: 3, bevel: 1, seed: 13, grit: 0.015 });
    r.ring(16, 16, 10, at('stone', 1));
    r.disc(16, 13, 3, INK);
    r.poly([[15, 14], [17, 14], [19, 22], [13, 22]], INK);
    r.set(15, 12, at('blood', 3));
    return ink(r);
}

// ─── 遗物表：id → 物件 ───────────────────────────────────

const RELIC_SPEC = {
    gigantism_relic: ['orb', 'arcane'],
    stars_shines: ['stars', 'volt'],
    optical_lens: ['lens', 'cyan'],
    pink_slime: ['slime', 'rose'],
    energy_shield: ['shield', 'cyan', 'hex'],
    guardian_barrier: ['barrier', 'ice'],
    pinboard_second_row: ['pegtile', 'brass', 'rows'],
    triangle_formation: ['pegtile', 'brass', 'triangle'],
    diamond_formation: ['pegtile', 'arcane', 'diamond'],
    sparse_interval: ['pegtile', 'mint', 'sparse'],
    mirror_sync: ['pegtile', 'ice', 'mirror'],
    wide_narrow: ['pegtile', 'fire', 'widenarrow'],
    cryo_stone: ['elemstone', 'ice', 'snow'],
    pyro_stone: ['elemstone', 'fire', 'flame'],
    lightning_stone: ['elemstone', 'volt', 'bolt'],
    tactical_kit_pierce: ['crate', 'blood', 'arrow'],
    tactical_kit_scatter: ['crate', 'brass', 'trident'],
    tactical_kit_damage: ['crate', 'arcane', 'sword'],
    explosive_ammo: ['dynamite', 'fire'],
    prism_shard: ['prism'],
    russian_doll: ['doll', 'rose'],
    surge_bounce: ['surge', 'rose'],
    surge_echo: ['surge', 'ice'],
    surge_venom: ['surge', 'venom'],
    surge_pierce: ['surge', 'blood'],
    surge_scatter: ['surge', 'brass'],
    surge_damage: ['surge', 'arcane'],
    surge_cryo: ['surge', 'ice'],
    surge_pyro: ['surge', 'fire'],
    alchemist_powder_tube: ['tube', 'fire'],
    fate_reroll_token: ['coin'],
    relic_reroll_seal: ['seal', 'blood'],
    relic_gravity_core: ['voidcore', 'arcane'],
    relic_chrono_shard: ['hourglass', 'mint'],
    relic_phoenix_feather: ['feather', 'fire'],
    relic_sage_apothecary: ['apothecary', 'venom'],
    smuggler_pouch_common: ['bag'],
    smuggler_chest_rare: ['chest', 'ice'],
    smuggler_vault_epic: ['vault', 'arcane'],
    smuggler_sanctum_legendary: ['sanctum', 'brass'],
    relic: ['chest', 'brass'],
    desperation_blade: ['blade', 'blood'],
    hunter_instinct: ['target', 'blood'],
    rune_resonance_core: ['core', 'cyan'],
    rune_siphon: ['siphon', 'cyan'],
    opening_salvo: ['salvo', 'fire'],
    thunder_coil: ['coil', 'volt'],
    ember_fuse: ['fuse', 'fire'],
    mirror_magazine: ['mirror', 'ice'],
    doomsday_timer: ['clock', 'blood'],
    echo_reverberation: ['bell', 'ice'],
    element_injector: ['syringe', 'mint'],
    attribute_protocol: ['chip', 'cyan'],
    mortal_burst: ['burst', 'fire'],
    corridor_arc: ['arc', 'volt'],
    chaos_pact: ['pact', 'blood'],
    greedy_wheel: ['wheel', 'blood'],
    chaos_essence: ['flask', 'arcane', 'rings'],
    pure_essence: ['flask', 'slate'],
    dimension_shard: ['crystals', 'arcane'],
    dimension_crystal: ['crystalsBig', 'arcane'],
    unlock_recall: ['key', 'cyan', 'rings'],
    unlock_multicast: ['key', 'volt', 'speed'],
    unlock_split: ['key', 'brass', 'trident'],
    slot_expander: ['slots', 'cyan'],
    ammo_bandolier: ['bandolier'],
};

const OBJECTS = {
    orb: (s) => oOrb(s[1]),
    stars: (s) => oStars(s[1]),
    lens: (s) => oLens(s[1]),
    slime: (s) => oSlime(s[1]),
    shield: (s) => oShield(s[1], s[2]),
    barrier: (s) => oBarrier(s[1]),
    pegtile: (s) => oPegTile(s[2], s[1]),
    elemstone: (s) => oElemStone(s[1], s[2]),
    crate: (s) => oCrate(s[1], s[2]),
    dynamite: (s) => oDynamite(s[1]),
    prism: () => oPrism(),
    doll: (s) => oDoll(s[1]),
    surge: (s) => oSurge(s[1]),
    tube: (s) => oTube(s[1]),
    coin: () => oCoin(),
    seal: (s) => oSeal(s[1]),
    voidcore: (s) => oVoidCore(s[1]),
    hourglass: (s) => oHourglass(s[1]),
    feather: (s) => oFeather(s[1]),
    apothecary: (s) => oApothecary(s[1]),
    bag: () => oBag(),
    chest: (s) => oChest(s[1]),
    vault: (s) => oVault(s[1]),
    sanctum: (s) => oSanctum(s[1]),
    blade: (s) => oBlade(s[1]),
    target: (s) => oTarget(s[1]),
    core: (s) => oCore(s[1]),
    siphon: (s) => oSiphon(s[1]),
    salvo: (s) => oSalvo(s[1]),
    coil: (s) => oCoil(s[1]),
    fuse: (s) => oFuse(s[1]),
    mirror: (s) => oMirror(s[1]),
    clock: (s) => oClock(s[1]),
    bell: (s) => oBell(s[1]),
    syringe: (s) => oSyringe(s[1]),
    chip: (s) => oChip(s[1]),
    burst: (s) => oBurst(s[1]),
    arc: (s) => oArc(s[1]),
    pact: (s) => oPact(s[1]),
    wheel: (s) => oWheel(s[1]),
    flask: (s) => oFlask(s[1], s[2]),
    crystals: (s) => oCrystalCluster(s[1], false),
    crystalsBig: (s) => oCrystalCluster(s[1], true),
    key: (s) => oKey(s[1], s[2]),
    slots: (s) => oSlots(s[1]),
    bandolier: () => oBandolier(),
};

export const RELIC_OBJECT_IDS = Object.freeze(Object.keys(RELIC_SPEC));
export const OBJECT_KINDS = Object.freeze(Object.keys(OBJECTS));

export function hasRelicSpec(id) {
    return !!RELIC_SPEC[id];
}

/** 遗物图标 32×32；未登记的遗物按 fallback 规格画（调用方可传 emoji 映射出的规格） */
export function drawRelic(id, fallback = null) {
    const spec = RELIC_SPEC[id] || fallback || ['chest', 'brass'];
    const make = OBJECTS[spec[0]] || OBJECTS.chest;
    return make(spec);
}

/** 直接按物件名画（emoji 映射 / 商品等复用） */
export function drawObject(kind, rampName = 'brass', extra = undefined) {
    const make = OBJECTS[kind];
    if (!make) return null;
    return make([kind, rampName, extra]);
}
