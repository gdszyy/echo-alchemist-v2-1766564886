/**
 * src/pixel/icons.js — 7×7 点阵图标（属性 / HUD / 敌人词条），字形即源码
 *
 * 字符：'.' 透明；'b' 暗部；'c' 主色；'d' 亮部。颜色来自调用方指定的色阶（palette.js），
 * 所以同一个图标可以按语义换色；描边由 Raster.outline 统一加 1px INK（结果 9×9）。
 * @module pixel/icons
 */
import { RAMPS } from './palette.js';
import { Raster } from './raster.js';

export const ICON_ROWS = Object.freeze({
    // ── 属性 ──
    flame: ['...b...', '..bb...', '..bcb..', '.bccb..', '.bcdcb.', '.bcdcb.', '..bbb..'],
    snow: ['b..c..b', '.b.c.b.', '..ccc..', 'cccdccc', '..ccc..', '.b.c.b.', 'b..c..b'],
    bolt: ['...ccc.', '..cc...', '.cccc..', '...dc..', '..cc...', '.cc....', 'c......'],
    drop: ['...c...', '..ccc..', '..ccc..', '.cdccc.', '.ccccc.', '.bcccb.', '..bbb..'],
    tornado: ['ccccccc', '.cdccc.', '..cdcc.', '..ccc..', '...cc..', '...c...', '..c....'],
    beam: ['.......', 'b.....b', 'ccccccc', 'ddddddd', 'ccccccc', 'b.....b', '.......'],
    arrow: ['...cccc', '.....cc', '....c.c', '...c..c', '..c....', '.c.....', 'c......'],
    bounce: ['..ccc..', '.cdddc.', '.cdddc.', '..ccc..', '.......', 'c.....c', '.ccccc.'],
    trident: ['c..c..c', '.c.c.c.', '..ccc..', '...c...', '...c...', '...c...', '...b...'],
    sword: ['...d...', '...c...', '...c...', '...c...', '.bcccb.', '...b...', '...b...'],
    burst: ['c..c..c', '.c.c.c.', '..ddd..', 'ccdddcc', '..ddd..', '.c.c.c.', 'c..c..c'],
    bell: ['...c...', '..ccc..', '.ccccc.', '.ccdcc.', 'ccccccc', '...b...', '.......'],
    rings: ['..ccc..', '.c...c.', 'c..d..c', 'c.ddd.c', 'c..d..c', '.c...c.', '..ccc..'],
    battery: ['...cc..', '..cccc.', '..c..c.', '..cddc.', '..cddc.', '..cddc.', '..cccc.'],
    flysword: ['......d', '.....c.', '....c..', '...c...', 'bbc....', '.b.....', 'b.b....'],
    nested: ['..ccc..', '.c...c.', 'c.ccc.c', 'c.c.c.c', 'c.ccc.c', '.c...c.', '..ccc..'],
    hollow: ['..ccc..', '.c...c.', 'c.....c', 'c.....c', 'c.....c', '.c...c.', '..ccc..'],
    // ── HUD ──
    shield: ['ccccccc', 'cdddddc', 'cdddddc', '.cdddc.', '.cdddc.', '..cdc..', '...c...'],
    crown: ['.......', 'c..c..c', 'cc.c.cc', 'ccccccc', 'cdcdcdc', 'ccccccc', '.......'],
    bag: ['..ccc..', '.c...c.', '.ccccc.', 'cccdccc', 'ccdddcc', 'cccdccc', '.ccccc.'],
    shard: ['...d...', '..cdc..', '.ccdcc.', 'ccccccc', '.ccbcc.', '..cbc..', '...b...'],
    runestone: ['.ccccc.', 'cc.d.cc', 'cc.d.cc', 'ccdddcc', 'cc.d.cc', 'cc.d.cc', '.ccccc.'],
    gem: ['...c...', '..cdc..', '.cddcc.', 'cddcccb', '.cccbb.', '..cbb..', '...b...'],
    gemEmpty: ['...b...', '..b.b..', '.b...b.', 'b.....b', '.b...b.', '..b.b..', '...b...'],
    pause: ['.......', '.cc.cc.', '.cc.cc.', '.cc.cc.', '.cc.cc.', '.cc.cc.', '.......'],
    speed: ['.......', 'c...c..', 'cc..cc.', 'ccc.ccc', 'cc..cc.', 'c...c..', '.......'],
    hourglass: ['ccccccc', '.c...c.', '..cdc..', '...d...', '..c.c..', '.cdddc.', 'ccccccc'],
    down: ['..ccc..', '..ccc..', '..ccc..', 'ccccccc', '.ccccc.', '..ccc..', '...c...'],
    up: ['...c...', '..ccc..', '.ccccc.', 'ccccccc', '..ccc..', '..ccc..', '..ccc..'],
    cross: ['..ccc..', '..cdc..', 'ccccccc', 'cdddddc', 'ccccccc', '..cdc..', '..ccc..'],
    hex: ['..ccc..', '.cdddc.', 'cdddddc', 'cdddddc', 'cdddddc', '.cdddc.', '..ccc..'],
    clone: ['cccc...', 'cddc...', 'cdcccc.', 'cccddc.', '..cddc.', '..cccc.', '.......'],
    maw: ['.ccccc.', 'cc.c.cc', 'c.....c', 'c.....c', 'cc.c.cc', '.ccccc.', '.......'],
    floor: ['ccccccc', 'c.....c', 'c.ddd.c', '.c...c.', '.c...c.', '..c.c..', '...c...'],
    slant: ['....ccc', '...cdc.', '..cdc..', '.cdc...', 'cdc....', 'cc.....', 'c......'],
    spores: ['.c...c.', 'cdc.cdc', '.c...c.', '...c...', '..cdc..', '...c...', '.......'],
    ram: ['...cc..', 'cccccc.', 'cddddcc', 'cddddcc', 'cccccc.', '...cc..', '.......'],
    eye: ['.......', '..ccc..', '.c.d.c.', 'c.ddd.c', '.c.d.c.', '..ccc..', '.......'],
    star: ['...c...', '...c...', '.ccdcc.', 'ccdddcc', '.ccdcc.', '...c...', '...c...'],
    chart: ['.......', '.....c.', '...c.c.', '...c.c.', '.c.c.c.', '.c.c.c.', 'ddddddd'],
    flask: ['..ccc..', '...c...', '...c...', '..cdc..', '.cdddc.', 'cdddddc', '.ccccc.'],
    // ── 通用（菜单文字里的 emoji 统一换成这些） ──
    skull: ['.ccccc.', 'cdddddc', 'cd.d.dc', 'cdddddc', '.cdbdc.', '.ccccc.', '..c.c..'],
    heart: ['.cc.cc.', 'cddcddc', 'cdddddc', '.cdddc.', '..cdc..', '...c...', '.......'],
    book: ['cc...cc', 'cdc.cdc', 'cddcddc', 'cddcddc', 'cddcddc', '.ccbcc.', '...b...'],
    gear: ['..c.c..', '.ccccc.', 'ccdddcc', '.cd.dc.', 'ccdddcc', '.ccccc.', '..c.c..'],
    box: ['ccccccc', 'cddcddc', 'cddcddc', 'ccccccc', 'cddcddc', 'cddcddc', 'ccccccc'],
    coin: ['..ccc..', '.cdddc.', 'cddcddc', 'cdcdcdc', 'cddcddc', '.cdddc.', '..ccc..'],
    warn: ['...c...', '..cdc..', '..cbc..', '.cdbdc.', '.cdddc.', 'cddbddc', 'ccccccc'],
    question: ['..ccc..', '.c...c.', '.....c.', '....c..', '...c...', '.......', '...c...'],
    dice: ['ccccccc', 'cbdddbc', 'cdddddc', 'cddbddc', 'cdddddc', 'cbdddbc', 'ccccccc'],
    target: ['..ccc..', '.c...c.', 'c..c..c', 'c.cdc.c', 'c..c..c', '.c...c.', '..ccc..'],
    loop: ['..ccc.d', '.c...cd', 'c...ddd', 'c.....c', 'ddd...c', 'dc...c.', 'd.ccc..'],
    key: ['.ccc...', 'cd.dc..', '.ccc...', '..c....', '..cc...', '..c....', '..cc...'],
    sound: ['....c..', '..cc.c.', 'ccdc..c', 'cddc..c', 'ccdc..c', '..cc.c.', '....c..'],
    mute: ['.......', '..cc...', 'ccdcb.b', 'cddc.b.', 'ccdcb.b', '..cc...', '.......'],
    trophy: ['ccccccc', 'cdddddc', '.cdddc.', '..cdc..', '...c...', '..ccc..', '.ccccc.'],
    leaf: ['.....cc', '...ccdc', '..cddc.', '.cddc..', '.cdc...', '.cc....', 'c......'],
    lamp: ['..ccc..', '.cdddc.', '.cdddc.', '.cdddc.', '..cdc..', '..bbb..', '..bbb..'],
    wave: ['.......', '.cc..cc', 'c..cc..', '.......', '.cc..cc', 'c..cc..', '.......'],
    moon: ['..ccc..', '.cc....', 'cc.....', 'cc.....', 'cc.....', '.cc....', '..ccc..'],
    house: ['...c...', '..ccc..', '.ccccc.', 'ccccccc', '.cd.dc.', '.cd.dc.', '.ccccc.'],
    check: ['.......', '......c', '.....cc', 'c...cc.', 'cc.cc..', '.ccc...', '..c....'],
    dot: ['.......', '..ccc..', '.cdddc.', '.cdddc.', '.cdddc.', '..ccc..', '.......'],
    left: ['...c...', '..cc...', '.cccccc', 'cccdddd', '.cccccc', '..cc...', '...c...'],
    right: ['...c...', '...cc..', 'cccccc.', 'ddddccc', 'cccccc.', '...cc..', '...c...'],
});

/** 属性键 → { 名称, 色阶, 图标 }（docs/design/pixel_art_mode.md §3.3，唯一来源） */
export const ATTRIBUTE_STYLE = Object.freeze({
    pyro: { name: '火焰', ramp: 'fire', icon: 'flame' },
    cryo: { name: '冰霜', ramp: 'ice', icon: 'snow' },
    lightning: { name: '闪电', ramp: 'volt', icon: 'bolt' },
    venom: { name: '剧毒', ramp: 'venom', icon: 'drop' },
    wind: { name: '风', ramp: 'mint', icon: 'tornado' },
    laser: { name: '激光', ramp: 'cyan', icon: 'beam' },
    pierce: { name: '穿透', ramp: 'blood', icon: 'arrow' },
    bounce: { name: '弹性', ramp: 'rose', icon: 'bounce' },
    scatter: { name: '散射', ramp: 'brass', icon: 'trident' },
    damage: { name: '增幅', ramp: 'arcane', icon: 'sword' },
    explosive: { name: '爆破', ramp: 'fire', icon: 'burst' },
    resonance: { name: '共鸣', ramp: 'brass', icon: 'bell' },
    echo: { name: '回响', ramp: 'ice', icon: 'rings' },
    overcharge: { name: '超载', ramp: 'volt', icon: 'battery' },
    flying_sword: { name: '飞剑', ramp: 'cyan', icon: 'flysword' },
    matryoshka: { name: '套娃', ramp: 'rose', icon: 'nested' },
    white: { name: '纯净', ramp: 'slate', icon: 'hollow' },
    rainbow: { name: '七彩', ramp: 'arcane', icon: 'star' },
    multicast: { name: '连射', ramp: 'slate', icon: 'speed' },
});

/**
 * 敌人词条 → 名称 / 图标 / 色阶。名称与玩家可见的词条说明（systems.js affixDict）逐字一致；
 * 菜单文字里「emoji + 词条名」在像素模式下换成这里的图标，所以画布读数与菜单是同一个图标。
 * 基底专属词条（重装…引力井）在战场上由精灵轮廓表达，这里的图标只用于图鉴与说明。
 */
export const AFFIX_STYLE = Object.freeze({
    shield: { name: '护盾', ramp: 'ice', icon: 'hex' },
    radiantAegis: { name: '流彩护盾', ramp: 'brass', icon: 'hex' },
    energyArmor: { name: '蓄能甲', ramp: 'volt', icon: 'shield' },
    phaseShield: { name: '相位护盾', ramp: 'arcane', icon: 'hex' },
    livingArmor: { name: '活体护甲', ramp: 'venom', icon: 'shield' },
    armorSpore: { name: '护甲孢子', ramp: 'venom', icon: 'spores' },
    lowDamageImmune: { name: '低伤免疫', ramp: 'slate', icon: 'floor' },
    deflectShell: { name: '偏折壳', ramp: 'cyan', icon: 'slant' },
    siegeBreaker: { name: '撞城者', ramp: 'blood', icon: 'ram' },
    overloadReactor: { name: '过量反应炉', ramp: 'fire', icon: 'battery' },
    regen: { name: '再生', ramp: 'venom', icon: 'cross' },
    haste: { name: '极速', ramp: 'volt', icon: 'speed' },
    devour: { name: '吞噬', ramp: 'blood', icon: 'maw' },
    healer: { name: '治愈', ramp: 'mint', icon: 'cross' },
    jump: { name: '跳跃', ramp: 'ice', icon: 'up' },
    clone: { name: '增殖', ramp: 'arcane', icon: 'clone' },
    berserk: { name: '狂暴', ramp: 'blood', icon: 'flame' },
    runeBearer: { name: '通用符文掉落', ramp: 'brass', icon: 'runestone' },
    adaptiveRune: { name: '自适应符文', ramp: 'arcane', icon: 'runestone' },
    heavyArmor: { name: '重装', ramp: 'slate', icon: 'shield' },
    deflectionWard: { name: '偏折屏障', ramp: 'cyan', icon: 'slant' },
    echoRelay: { name: '回响中继', ramp: 'ice', icon: 'rings' },
    prism: { name: '折光', ramp: 'arcane', icon: 'star' },
    hive: { name: '孵化', ramp: 'venom', icon: 'spores' },
    siege: { name: '破阵', ramp: 'blood', icon: 'ram' },
    gravityWell: { name: '引力井', ramp: 'arcane', icon: 'nested' },
    carrier: { name: '铸巢母架', ramp: 'brass', icon: 'box' },
});

function rampIndex(n, ch) {
    if (ch === 'b') return Math.max(0, Math.floor(n * 0.3));
    if (ch === 'c') return Math.min(n - 2, Math.floor(n * 0.62));
    return n - 1;
}

const _cache = new Map();

/**
 * 取图标画布（含 1px INK 描边时为 9×9）。
 * @param {string} name ICON_ROWS 键
 * @param {string} rampName 色阶
 * @param {{outline?:boolean, dim?:boolean}} [o] dim：整体降两级（禁用 / 空态）
 */
export function getIcon(name, rampName = 'slate', o = {}) {
    const rows = ICON_ROWS[name] || ICON_ROWS.hollow;
    const outline = o.outline !== false;
    const key = `${name}|${rampName}|${outline ? 1 : 0}|${o.dim ? 1 : 0}`;
    let c = _cache.get(key);
    if (c) return c;
    const R = RAMPS[rampName] || RAMPS.slate;
    const n = R.length;
    const pad = outline ? 1 : 0;
    const r = new Raster(rows[0].length + pad * 2, rows.length + pad * 2);
    for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
            const ch = rows[y][x];
            if (ch === '.') continue;
            let idx = rampIndex(n, ch);
            if (o.dim) idx = Math.max(0, idx - 2);
            r.set(x + pad, y + pad, R[idx]);
        }
    }
    if (outline) r.outline();
    c = r.toCanvas();
    _cache.set(key, c);
    return c;
}

export function getAttributeIcon(key, o = {}) {
    const s = ATTRIBUTE_STYLE[key] || ATTRIBUTE_STYLE.white;
    return getIcon(s.icon, s.ramp, o);
}

export function getAffixIcon(key, o = {}) {
    const s = AFFIX_STYLE[key];
    if (!s) return null;
    return getIcon(s.icon, s.ramp, o);
}

/** 属性的代表色（色阶第 4 级附近），给子弹、尾迹、条带用 */
export function attributeColor(key, level = 'main') {
    const s = ATTRIBUTE_STYLE[key] || ATTRIBUTE_STYLE.white;
    const R = RAMPS[s.ramp];
    const n = R.length;
    if (level === 'dark') return R[Math.max(0, Math.floor(n * 0.3))];
    if (level === 'light') return R[n - 1];
    return R[Math.min(n - 2, Math.floor(n * 0.62))];
}
