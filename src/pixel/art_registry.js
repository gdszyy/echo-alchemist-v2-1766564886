/**
 * src/pixel/art_registry.js — 像素模式的图标来源：资源路径 / 语义 id → 程序化像素图
 *
 * 像素模式不再使用任何旧位图（也不用旧位图的自动像素化件）：
 * - resolveArtSrc(path) 经 art_mode 的解析钩子到这里：认得的图标路径 → 程序化像素图的 data URL；
 *   画面上就是同一套色阶、光向、描边画出来的东西，不会带出旧图的绿幕残边、材质不统一等问题。
 * - 画布消费方拿到的是 data URL 图片；pixel_canvas 的 drawImage 补丁用 artCanvasForSrc() 换回
 *   美术分辨率的小画布，再整像素放大（不会被平滑缩放糊掉）。
 * - 语义入口：relic / skill / attribute / emoji —— 没有旧位图的遗物、技能也有像素图标。
 * - 九宫格框、面板底等「框体类」位图不在这里画：由 pixel_theme.css 的组件规则统一换成像素组件。
 *
 * 规格：docs/design/pixel_art_mode.md §6、§7
 * @module pixel/art_registry
 */
import { Raster } from './raster.js';
import { RAMPS } from './palette.js';
import { ATTRIBUTE_STYLE, AFFIX_STYLE, getIcon, ICON_ROWS } from './icons.js';
import * as A from './art_objects.js';
import { SKILL_GLYPH, skillRampOf, emojiIconSpec } from './art_registry_data.js';
import { buildEnemyRaster, BOSS_RAMP } from './enemy_sprites.js';
import { PIXEL_FONTS } from './pixel_font.js';

const _entries = new Map(); // key → { art: HTMLCanvasElement, url: string }
const _byUrl = new Map(); // data URL → art canvas

function rasterToCanvas(r) {
    const c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.px.buffer.slice(0)), r.w, r.h), 0, 0);
    return c;
}

function sourceToCanvas(src) {
    if (src instanceof Raster) return rasterToCanvas(src);
    if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) return src;
    // OffscreenCanvas（getIcon 的缓存）→ 普通画布，才能导出 data URL
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
}

function upscale(art, k) {
    if (k <= 1) return art;
    const c = document.createElement('canvas');
    c.width = art.width * k;
    c.height = art.height * k;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(art, 0, 0, c.width, c.height);
    return c;
}

/**
 * 取（并缓存）一个程序化图标。
 * @param {string} key 唯一键
 * @param {() => (Raster|HTMLCanvasElement|OffscreenCanvas|null)} make 画法
 * @param {number} scale 导出 data URL 时的整数放大倍数（让图片自然尺寸接近旧位图，布局不变）
 */
function entry(key, make, scale = 2) {
    let e = _entries.get(key);
    if (e) return e;
    if (typeof document === 'undefined') return null;
    const src = make();
    if (!src) return null;
    const art = sourceToCanvas(src);
    const url = upscale(art, scale).toDataURL('image/png');
    e = { art, url };
    _entries.set(key, e);
    _byUrl.set(url, art);
    return e;
}

/** drawImage 补丁用：这张图是不是程序化图标？是就返回美术分辨率画布 */
export function artCanvasForSrc(src) {
    if (!src || src.charCodeAt(0) !== 100 /* d */) return null;
    return _byUrl.get(src) || null;
}

// ─── 语义入口 ─────────────────────────────────────────────

export function relicArt(id, emoji) {
    return entry(`relic:${id}`, () => {
        if (A.hasRelicSpec(id)) return A.drawRelic(id);
        const spec = emojiIconSpec(emoji || '');
        // 未登记的遗物：按 emoji 的语义选元素色，画成通用宝箱（避免回落到系统彩色 emoji）
        return A.drawRelic(id, ['chest', spec ? spec[1] : 'brass']);
    }, 2);
}

export function skillArt(id) {
    return entry(`skill:${id}`, () => A.drawSkillSigil(SKILL_GLYPH[id] || 'star', skillRampOf(id)), 3);
}

export function attributeArt(key) {
    const s = ATTRIBUTE_STYLE[key];
    return entry(`attr:${key}`, () => (s ? A.drawAttributeBadge(s.icon, s.ramp) : A.drawAttributeBadge('hollow', 'slate', true)), 4);
}

export function marbleArt(type) {
    return entry(`marble:${type}`, () => A.drawMarble(type), 2);
}

const RARITY_RAMP = { common: 'slate', rare: 'ice', epic: 'arcane', legendary: 'brass', cursed: 'blood' };
const PEG_PATTERN_KEYS = ['rows', 'triangle', 'diamond', 'sparse', 'mirror', 'widenarrow'];

/** 钉盘模块：石板钉阵（阵型按模块 id 固定选取，色阶按稀有度） */
export function moduleArt(moduleId, rarity) {
    let h = 0;
    for (const ch of String(moduleId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pattern = PEG_PATTERN_KEYS[h % PEG_PATTERN_KEYS.length];
    return entry(`module:${moduleId}:${rarity || ''}`, () => A.drawObject('pegtile', RARITY_RAMP[rarity] || 'brass', pattern), 2);
}

/** 符文石（按元素与等级），与 RUNE_ICON_MAP 的路径图标同一画法 */
export function runeArt(element, level = 1) {
    const s = ATTRIBUTE_STYLE[element] || ATTRIBUTE_STYLE.white;
    return entry(`rune:${element}:${level}`, () => A.drawRune(s.icon, s.ramp, Number(level) || 1, String(element).length + (Number(level) || 1)), 2);
}

/** 通用物件（遗物物件库里的形） */
export function objectArt(kind, ramp = 'brass', extra = undefined) {
    return entry(`obj:${kind}:${ramp}:${extra || ''}`, () => A.drawObject(kind, ramp, extra), 2);
}

/** emoji → 7×7 点阵图标（含描边 9×9）；不在映射表内返回 null */
export function emojiArt(seq) {
    const spec = emojiIconSpec(seq);
    if (!spec) return null;
    return entry(`emoji:${spec[0]}:${spec[1]}`, () => getIcon(spec[0], spec[1]), 4);
}

/** 命名实体（词条 / 属性）的图标：用于「emoji + 名称」时让菜单与画布同一个图标 */
export function namedGlyphArt(glyph, ramp) {
    if (!ICON_ROWS[glyph]) return null;
    return entry(`emoji:${glyph}:${ramp}`, () => getIcon(glyph, ramp), 4);
}

// ─── 路径解析 ─────────────────────────────────────────────

const ENEMY_FILE_ARCH = {
    bastion: ['bastion', 3, 1], carrier: ['carrier', 3, 2], deflector: ['deflector', 2, 1], echo_spire: ['echoSpire', 1, 2],
    gravity_core: ['gravityWell', 3, 3], hive: ['hive', 2, 3], maw: ['maw', 2, 2], prism: ['prism', 1, 3], siege: ['siege', 3, 2],
};

function enemyPortrait(file) {
    const m = /^(?:enemy|archetype)_([a-z_]+?)(?:_(\d)x(\d))?$/.exec(file);
    if (!m) return null;
    const base = ENEMY_FILE_ARCH[m[1]];
    if (!base) return null;
    const cols = Number(m[2] || base[1]);
    const rows = Number(m[3] || base[2]);
    const k = Math.floor(28 / Math.max(cols, rows));
    const w = Math.max(10, cols * k);
    const h = Math.max(10, rows * k);
    const er = buildEnemyRaster(base[0], w, h, 3, false);
    const out = new Raster(32, 32);
    out.blit(er, (32 - er.w) >> 1, (32 - er.h) >> 1);
    return out;
}

function bossPortrait(id, tiny) {
    const theme = BOSS_RAMP[id] || 'blood';
    const W = tiny ? 16 : 32;
    const br = buildEnemyRaster('boss', tiny ? 16 : 30, tiny ? 12 : 22, 5, false, theme);
    const out = new Raster(W, W);
    out.blit(br, (W - br.w) >> 1, (W - br.h) >> 1);
    return out;
}

function plaque(n) {
    const r = A.drawPlaque('brass');
    const font = PIXEL_FONTS['5x7'];
    const text = `×${n}`;
    let x = 6;
    for (const ch of text) {
        const g = font.glyphs[ch];
        if (!g) continue;
        for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
            if (g[j][i] === '#') r.set(x + i, 3 + j - 1, RAMPS.brass[6]);
        }
        x += g[0].length + 1;
    }
    return r;
}

const CAPSULE_RAMP = { essence_chaos: 'arcane', essence_pure: 'slate', relic: 'brass' };

const PATH_RULES = [
    [/^icons\/ammo\/ammo_(\w+)\.png$/, (m) => marbleArt(m[1] === 'normal' ? 'white' : m[1])],
    [/^icons\/relic\/(\w+)\.png$/, (m) => relicArt(m[1])],
    [/^icons\/rune\/rune_([a-z_]+)_(\d)\.png$/, (m) => {
        const s = ATTRIBUTE_STYLE[m[1]] || ATTRIBUTE_STYLE.white;
        return entry(`rune:${m[1]}:${m[2]}`, () => A.drawRune(s.icon, s.ramp, Number(m[2]), m[1].length + Number(m[2])), 2);
    }],
    [/^(?:icons\/enemies|ui\/icons\/enemy_archetypes)\/([a-z_0-9]+)\.png$/, (m) => entry(`enemy:${m[1]}`, () => enemyPortrait(m[1]), 2)],
    [/^ui\/icons\/boss_preview\/boss_unknown_seal(_tiny)?\.png$/, (m) => entry(`boss:?${m[1] || ''}`, () => A.drawUnknownSeal(), m[1] ? 1 : 3)],
    [/^ui\/icons\/boss_preview\/boss_([a-z]+)_(preview|tiny)\.png$/, (m) => entry(`boss:${m[1]}:${m[2]}`, () => bossPortrait(m[1], m[2] === 'tiny'), m[2] === 'tiny' ? 2 : 3)],
    [/^ui\/icons\/enemy_affixes\/affix_(\w+)\.(?:png|svg)$/, (m) => {
        const id = m[1] === 'rune_bearer' ? 'runeBearer' : m[1];
        const s = AFFIX_STYLE[id];
        return s ? entry(`affix:${id}`, () => A.drawAffixBadge(s.icon, s.ramp), 4) : null;
    }],
    [/^ui\/sprites\/attribute_icons\/attribute_icon_(\w+)\.png$/, (m) => attributeArt(m[1])],
    [/^ui\/sprites\/attribute_chips\/attribute_chip_(\w+)\.png$/, (m) => {
        const s = ATTRIBUTE_STYLE[m[1]];
        return entry(`chip:${m[1]}`, () => (s ? A.drawAttributeChip(s.icon, s.ramp) : A.drawAttributeChip('hollow', 'slate', true)), 4);
    }],
    [/^ui\/sprites\/loot_(\w+)_capsule\.png$/, (m) => entry(`capsule:${m[1]}`, () => A.drawCapsule(CAPSULE_RAMP[m[1]] || 'brass'), 2)],
    [/^ui\/sprites\/multiplier_x(\d)\.png$/, (m) => entry(`plaque:${m[1]}`, () => plaque(m[1]), 4)],
    [/^ui\/sprites\/(?:sp_gem_full_32|skill_sp_gem_hex_full_runtime_candidate|skill_charge_crystal_full)\.png$/, () => entry('gem:full', () => getIcon('gem', 'cyan'), 4)],
    [/^ui\/sprites\/(?:sp_gem_empty_32|skill_sp_gem_hex_empty_runtime_candidate|skill_charge_crystal_empty)\.png$/, () => entry('gem:empty', () => getIcon('gemEmpty', 'slate'), 4)],
];

/** assets/ 之后的相对路径；不是资源引用返回 null */
function relOf(path) {
    if (typeof path !== 'string' || path.startsWith('data:')) return null;
    const i = path.indexOf('assets/');
    if (i < 0) return null;
    return path.slice(i + 7).split('?')[0].split('#')[0];
}

/** 纯匹配（不画图）：该路径是否由程序化图标接管。测试用来核对覆盖面。 */
export function isArtPath(path) {
    const rel = relOf(path);
    return !!rel && PATH_RULES.some(([re]) => re.test(rel));
}

/** 资源路径 → 程序化图标 data URL；认不出返回 null */
export function artUrlForPath(path) {
    const rel = relOf(path);
    if (!rel) return null;
    for (const [re, fn] of PATH_RULES) {
        const m = re.exec(rel);
        if (m) {
            const e = fn(m);
            return e ? e.url : null;
        }
    }
    return null;
}

/** 测试/诊断：已生成的图标数 */
export function getArtRegistryStats() {
    return { entries: _entries.size };
}
