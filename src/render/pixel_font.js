/**
 * src/render/pixel_font.js — R1 伤害数字像素位图字体
 *
 * 规格来源：docs/design/art_vfx_ui_direction_v1.md §4.3（数字档位 T1–T4）与 §5.3 路线 B（代码手写点阵）。
 *
 * - 两套点阵：small 3×5、medium 5×7；字符集 0-9 + - % x k . 与空格。
 * - 文本先在「美术像素 = 1 画布像素」的小画布上画好（含 1px 暗色描边），按 key 缓存；
 *   Canvas 路径：drawImage 到低清缓冲（1:1 美术像素，落在整数格）；
 *   Pixi 路径：同一张缓存画布做 NEAREST 纹理（见 pixi_effect_adapter.floatingText_pixiCreate）。
 * - 非数字浮动文字（中文提示等）不走本字体，保持原渲染。
 *
 * Node 可 import（画布由调用方注入或惰性创建，测试只验数据表与档位）。
 *
 * @module render/pixel_font
 * @perf-impact: 伤害数字改为缓存位图（每个 文本×颜色×档位 只栅格化一次，LRU 上限 PIXEL_TEXT_CACHE_LIMIT）
 */

/** 3×5 小号点阵（T1） */
export const PIXEL_GLYPHS_3x5 = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '001', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    '+': ['000', '010', '111', '010', '000'],
    '-': ['000', '000', '111', '000', '000'],
    '%': ['101', '001', '010', '100', '101'],
    'x': ['000', '101', '010', '101', '000'],
    'k': ['100', '101', '110', '101', '101'],
    '.': ['000', '000', '000', '000', '010'],
    ' ': ['00', '00', '00', '00', '00'],
};

/** 5×7 中号点阵（T2–T4） */
export const PIXEL_GLYPHS_5x7 = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '%': ['11000', '11001', '00010', '00100', '01000', '10011', '00011'],
    'x': ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
    'k': ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
    '.': ['000', '000', '000', '000', '000', '011', '011'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
};

/** 字体必须覆盖的字符（测试用） */
export const PIXEL_FONT_REQUIRED_CHARS = '0123456789+-%xk';

export const PIXEL_FONTS = {
    small: { glyphs: PIXEL_GLYPHS_3x5, height: 5 },
    medium: { glyphs: PIXEL_GLYPHS_5x7, height: 7 },
};

/** 描边色（调色板「描边暗色」，§2.3） */
export const PIXEL_OUTLINE_COLOR = '#0b0f16';

/**
 * §4.3 伤害档位：T1 <15 小；T2 15–44 中；T3 45–99 大 + 描边；T4 ≥100 大 + 弹跳。
 * 返回渲染规格：font（点阵）、scale（整数美术像素倍数）、outline8（8 邻域粗描边）、bump（弹跳）。
 */
export function getDamageTier(dmg) {
    const v = Math.abs(Number(dmg));
    if (!Number.isFinite(v) || v < 15) return { tier: 1, font: 'small', scale: 1, outline8: false, bump: false };
    if (v < 45) return { tier: 2, font: 'medium', scale: 1, outline8: false, bump: false };
    if (v < 100) return { tier: 3, font: 'small', scale: 2, outline8: true, bump: false };
    return { tier: 4, font: 'small', scale: 2, outline8: true, bump: true };
}

/** 统一伤害文本里可映射的字符（全角减号、大写 X/K）。 */
export function normalizePixelText(text) {
    return String(text ?? '').trim().replace(/[−–—]/g, '-').replace(/X/g, 'x').replace(/K/g, 'k');
}

/** 文本能否完全由像素字体渲染（两套点阵字符集相同）。 */
export function canRenderPixelText(text) {
    const s = normalizePixelText(text);
    if (!s || s.length > 12) return false;
    for (const ch of s) {
        if (!PIXEL_GLYPHS_5x7[ch] || !PIXEL_GLYPHS_3x5[ch]) return false;
    }
    return true;
}

/** 从伤害文本解析数值：'-37' → 37，'1.2k' → 1200。解析失败返回 NaN。 */
export function parseDamageValue(text) {
    const m = /(\d+(?:\.\d+)?)\s*(k?)/i.exec(normalizePixelText(text));
    if (!m) return NaN;
    const n = parseFloat(m[1]);
    return m[2] ? n * 1000 : n;
}

/**
 * 计算文本点阵掩码（未含描边、未放大）。
 * @returns {{w:number, h:number, mask:Uint8Array}}
 */
export function layoutPixelText(text, fontName = 'medium') {
    const font = PIXEL_FONTS[fontName] || PIXEL_FONTS.medium;
    const s = normalizePixelText(text);
    const glyphs = [];
    let w = 0;
    for (const ch of s) {
        const g = font.glyphs[ch];
        if (!g) continue;
        if (glyphs.length) w += 1; // 字间距 1 美术像素
        glyphs.push({ g, x: w });
        w += g[0].length;
    }
    const h = font.height;
    const mask = new Uint8Array(Math.max(1, w) * h);
    for (const { g, x } of glyphs) {
        for (let r = 0; r < h; r++) {
            const row = g[r] || '';
            for (let c = 0; c < row.length; c++) {
                if (row[c] === '1') mask[r * w + x + c] = 1;
            }
        }
    }
    return { w: Math.max(1, w), h, mask };
}

const PIXEL_TEXT_CACHE_LIMIT = 160;
const _cache = new Map();

function _createCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    }
    return null;
}

/**
 * 获取（或栅格化）像素文字位图：1 画布像素 = 1 美术像素，四周各留 1px 描边。
 * @returns {{canvas:any, w:number, h:number, key:string, tier:object}|null}
 */
export function getPixelTextBitmap(text, color = '#ffffff', tierSpec = getDamageTier(parseDamageValue(text))) {
    const s = normalizePixelText(text);
    const key = `${s}|${color}|${tierSpec.tier}`;
    const hit = _cache.get(key);
    if (hit) {
        _cache.delete(key); _cache.set(key, hit); // LRU 触碰
        return hit;
    }
    const { w, h, mask } = layoutPixelText(s, tierSpec.font);
    const sc = tierSpec.scale || 1;
    const W = w * sc + 2, H = h * sc + 2;
    const canvas = _createCanvas(W, H);
    if (!canvas) return null;
    const g = canvas.getContext('2d');
    // 放大后的掩码
    const big = new Uint8Array(W * H);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        if (!mask[r * w + c]) continue;
        for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) {
            big[(r * sc + dy + 1) * W + (c * sc + dx + 1)] = 1;
        }
    }
    // 描边：4 邻域（T1/T2）或 8 邻域（T3/T4）
    const nb = tierSpec.outline8
        ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
        : [[0, -1], [-1, 0], [1, 0], [0, 1]];
    g.fillStyle = PIXEL_OUTLINE_COLOR;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (big[y * W + x]) continue;
        for (const [dx, dy] of nb) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < W && ny < H && big[ny * W + nx]) { g.fillRect(x, y, 1, 1); break; }
        }
    }
    g.fillStyle = color;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (big[y * W + x]) g.fillRect(x, y, 1, 1);
    }
    const entry = { canvas, w: W, h: H, key, tier: tierSpec, texture: null };
    _cache.set(key, entry);
    if (_cache.size > PIXEL_TEXT_CACHE_LIMIT) {
        const oldestKey = _cache.keys().next().value;
        const old = _cache.get(oldestKey);
        _cache.delete(oldestKey);
        // Pixi 纹理可能仍被存活精灵引用：仅在无引用计数时释放（由适配器维护 refCount）
        if (old && old.texture && !(old.refCount > 0)) {
            try { old.texture.destroy(true); } catch (e) { /* ignore */ }
            old.texture = null;
        }
    }
    return entry;
}

/** 位图是否仍在缓存中（被 LRU 淘汰后，最后一个引用释放时由调用方销毁其 Pixi 纹理）。 */
export function isPixelTextCached(entry) {
    return !!entry && _cache.get(entry.key) === entry;
}

/** T4 弹跳：返回当前帧向上偏移（美术像素，整数）。age 0→1 为生命进度。 */
export function getPixelBumpOffset(tierSpec, age) {
    if (!tierSpec || !tierSpec.bump) return 0;
    if (age < 0.06) return 2;
    if (age < 0.12) return 3;
    if (age < 0.18) return 1;
    return 0;
}
