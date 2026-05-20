/**
 * relic_sigil.js - 遗物程序化徽记（2D Canvas 版本，shop UI / field loot 用）
 *
 * 将 M5 `render3d/RelicCard.js` 的 WebGL 徽记 shader 逻辑移植成 2D Canvas：
 *   - hash(relic.id) → 种子 → 花瓣数(3..8) + 相位 + 内圈频率
 *   - 由"星花+圆环+中央亮点"组合，颜色按 rarity 取
 *   - 输出 DataURL，配合 <img src> 直接挂到 HTML 卡片上
 *
 * 同一 relicId + 同一尺寸 → 永远生成同一张图。结果缓存在 Map 里，
 * 避免每次开商店都重渲染。
 */

// 与 RelicCard 的 RARITY_COLORS 保持一致
const RARITY_COLORS = {
    common:    { core: '#94a3b8', glow: '#e2e8f0' },
    rare:      { core: '#6366f1', glow: '#818cf8' },
    epic:      { core: '#c026d3', glow: '#d946ef' },
    legendary: { core: '#ea580c', glow: '#f59e0b' },
    cursed:    { core: '#be123c', glow: '#9f1239' },
};

function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
}

function _hexA(hex, alpha) {
    // hex: '#rrggbb', alpha: 0..1
    const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    return hex + a.toString(16).padStart(2, '0');
}

// 缓存：key = `${id}|${rarity}|${size}` → DataURL
const _cache = new Map();

/**
 * @param {Object} relic { id, rarity }
 * @param {number} [size=96]  输出 canvas 边长
 * @returns {string} dataURL（'data:image/png;base64,...'）
 */
export function getRelicSigilDataURL(relic, size = 96) {
    if (!relic || !relic.id) return '';
    const rarity = relic.rarity || 'common';
    const cacheKey = `${relic.id}|${rarity}|${size}`;
    const cached = _cache.get(cacheKey);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const seed = hashStr(relic.id);
    const colors = RARITY_COLORS[rarity] || RARITY_COLORS.common;
    _drawSigil(ctx, size, size, seed, colors);

    const dataURL = canvas.toDataURL('image/png');
    _cache.set(cacheKey, dataURL);
    return dataURL;
}

/**
 * 也支持就地绘制到现有 canvas / ctx（避免 dataURL 开销）
 * @param {Object} relic
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  绘制中心 x
 * @param {number} y  绘制中心 y
 * @param {number} size  外径 × 2（边长）
 */
export function drawRelicSigil(relic, ctx, x, y, size) {
    if (!relic || !ctx) return;
    const rarity = relic.rarity || 'common';
    const seed = hashStr(relic.id || '');
    const colors = RARITY_COLORS[rarity] || RARITY_COLORS.common;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    _drawSigil(ctx, size, size, seed, colors);
    ctx.restore();
}

function _drawSigil(ctx, w, h, seed, colors) {
    const cx = w / 2, cy = h / 2;
    const armCount = 3 + Math.floor(seed * 7919) % 6;      // 3..8
    const phase = (seed * 6.28 * 13) % (Math.PI * 2);
    const innerArms = 2 + Math.floor(seed * 7333) % 4;     // 2..5

    ctx.save();
    // 居中
    ctx.translate(cx, cy);

    // 1) 软光晕背景（径向渐变）
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
    glow.addColorStop(0,    _hexA(colors.glow, 0.45));
    glow.addColorStop(0.55, _hexA(colors.core, 0.20));
    glow.addColorStop(1,    _hexA(colors.core, 0.00));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 2) 外环
    ctx.strokeStyle = _hexA(colors.glow, 0.75);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    // 3) 内环（更细，距离更近）
    ctx.strokeStyle = _hexA(colors.glow, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.28, 0, Math.PI * 2);
    ctx.stroke();

    // 4) 花瓣（armCount 片）—— 主视觉
    const petalOuter = w * 0.40;
    const petalInner = w * 0.10;
    const halfAngle = (Math.PI * 2 / armCount) * 0.32;
    ctx.fillStyle = _hexA(colors.glow, 0.95);
    for (let i = 0; i < armCount; i++) {
        const a = phase + i * (Math.PI * 2 / armCount);
        ctx.beginPath();
        // 起点：内圈
        ctx.moveTo(Math.cos(a) * petalInner, Math.sin(a) * petalInner);
        // 左肩
        ctx.lineTo(Math.cos(a - halfAngle) * (petalOuter * 0.78), Math.sin(a - halfAngle) * (petalOuter * 0.78));
        // 尖端
        ctx.lineTo(Math.cos(a) * petalOuter, Math.sin(a) * petalOuter);
        // 右肩
        ctx.lineTo(Math.cos(a + halfAngle) * (petalOuter * 0.78), Math.sin(a + halfAngle) * (petalOuter * 0.78));
        ctx.closePath();
        ctx.fill();
    }

    // 5) 内部小尖刺（innerArms 片，错相位增加细节）
    const innerOuter = w * 0.20;
    const innerInner = w * 0.04;
    const innerHalf = (Math.PI * 2 / innerArms) * 0.30;
    ctx.fillStyle = _hexA(colors.core, 0.9);
    for (let i = 0; i < innerArms; i++) {
        const a = phase * 0.5 + i * (Math.PI * 2 / innerArms);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * innerInner, Math.sin(a) * innerInner);
        ctx.lineTo(Math.cos(a - innerHalf) * (innerOuter * 0.6), Math.sin(a - innerHalf) * (innerOuter * 0.6));
        ctx.lineTo(Math.cos(a) * innerOuter, Math.sin(a) * innerOuter);
        ctx.lineTo(Math.cos(a + innerHalf) * (innerOuter * 0.6), Math.sin(a + innerHalf) * (innerOuter * 0.6));
        ctx.closePath();
        ctx.fill();
    }

    // 6) 中央光点（双层）
    ctx.fillStyle = _hexA(colors.glow, 1.0);
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.025, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/** 清空缓存（debug 用） */
export function clearRelicSigilCache() {
    _cache.clear();
}
