/**
 * math_utils.js - 数学工具函数与通用工具类
 *
 * 职责：
 * - 颜色处理工具（adjustColorBrightness、lerpColor、hexToRgba）
 * - 线性插值（lerp）
 * - 二维向量类（Vec2）
 * - 平滑旋转辅助函数（rotateTowards）
 * - UI 提示工具（showToast）
 *
 * 注意：本文件从 entities.js 提取，不依赖任何游戏逻辑模块。
 * 提取时间：Task 2.1
 */

// ==================== 工具类 ====================
// ==================== 辅助函数 ====================

function adjustColorBrightness(hex, factor) {
    // 1. 移除可能存在的 '#'
    hex = hex.replace('#', '');

    // 2. 处理 3 位简写 (例如 "f00" -> "ff0000")
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    // 3. 验证是否为有效的 6 位 Hex
    if (hex.length !== 6) {
        console.warn("Invalid hex color:", hex);
        return "#000000"; // 返回黑色作为回退
    }

    // 4. 解析 RGB 分量
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // 5. 应用系数并钳制范围在 0 ~ 255
    r = Math.min(255, Math.max(0, Math.round(r * factor)));
    g = Math.min(255, Math.max(0, Math.round(g * factor)));
    b = Math.min(255, Math.max(0, Math.round(b * factor)));

    // 6. 转换回 Hex 字符串，并确保单位数时前面补 '0'
    const rr = r.toString(16).padStart(2, '0');
    const gg = g.toString(16).padStart(2, '0');
    const bb = b.toString(16).padStart(2, '0');

    return `#${rr}${gg}${bb}`;
}

/**
 * 颜色线性插值函数
 */
function lerpColor(a, b, amount) {
    const ah = parseInt(a.replace(/#/g, ''), 16),
          ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
          bh = parseInt(b.replace(/#/g, ''), 16),
          br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
          rr = ar + amount * (br - ar),
          rg = ag + amount * (bg - ag),
          rb = ab + amount * (bb - ab);
    return '#' + ((1 << 24) + (Math.round(rr) << 16) + (Math.round(rg) << 8) + Math.round(rb)).toString(16).slice(1);
}

/**
 * 線性插值函數 (Linear Interpolation)
 */
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function hexToRgba(hex, alpha) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c = hex.substring(1).split('');
        if(c.length === 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return hex;
}


class Vec2 {
    /**
     * 二维向量类 (用于位置和速度)
     * @param {number} x - **重要参数** x 坐标
     * @param {number} y - **重要参数** y 坐标
     */
    constructor(x, y) { this.x = x; this.y = y; }
    /** 向量加法 */
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    /** 向量减法 */
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    /** 向量乘标量 */
    mult(s) { return new Vec2(this.x * s, this.y * s); }
    /** 向量长度 */
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    /** 归一化向量 */
    norm() { const m = this.mag(); return m === 0 ? new Vec2(0,0) : new Vec2(this.x/m, this.y/m); }
    /**
     * 计算到另一个向量的距离
     * @param {Vec2} v - **重要参数** 另一个向量
     */
    dist(v) { return Math.sqrt(Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2)); }
    /**
     * 计算点积
     * @param {Vec2} v - **重要参数** 另一个向量
     */
    dot(v) { return this.x * v.x + this.y * v.y; }
    /**
     * 旋转向量
     * @param {number} angle - **重要参数** 旋转角度 (弧度)
     */
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
    }
    distSq(v) {
        return Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2);
    }
}

/**
 * 显示短暂的提示信息
 * @param {string} msg - **重要参数** 提示信息内容
 */
// [fix] 保存 showToast 的定时器引用，防止重复调用时泳出多个定时器
let _toastTimer = null;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.innerText = msg;
    el.classList.add('toast-visible');
    if (_toastTimer) clearTimeout(_toastTimer); // 清理上一个定时器
    _toastTimer = setTimeout(() => {
        el.classList.remove('toast-visible');
        _toastTimer = null;
    }, 1500);
}

// --- 游戏实体 ---

// 辅助：平滑旋转函数
function rotateTowards(currentAngle, targetAngle, maxStep) {
    let diff = targetAngle - currentAngle;
    // 处理 -PI 到 PI 的突变，确保走最近的弧线
    while (diff <= -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    // 限制单帧最大转弯角度
    if (Math.abs(diff) < maxStep) {
        return targetAngle;
    } else {
        return currentAngle + (diff > 0 ? maxStep : -maxStep);
    }

}
/**
 * 根据当前回合数，从 ENEMY_CURVE_CONFIG.THEME_SEGMENTS 中查找对应的段落索引。
 * 若回合数超出所有段落范围，则返回最后一个段落的索引。
 *
 * @param {number} round - 当前回合数
 * @param {object} enemyCurveConfig - ENEMY_CURVE_CONFIG 配置对象
 * @returns {number} 段落索引（0-based），对应 THEME_SEGMENTS 和 AFFIX_WEIGHT_CURVES 的下标
 */
function getThemeSegment(round, enemyCurveConfig) {
    const segments = enemyCurveConfig && enemyCurveConfig.THEME_SEGMENTS;
    if (!segments || segments.length === 0) return 0;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (round >= seg.startRound && round <= seg.endRound) {
            return i;
        }
    }
    // 超出范围：返回最后一个段落
    return segments.length - 1;
}

/**
 * 在相邻主题段落之间做线性插值，返回当前回合的各词缀权重对象。
 * 若回合恰好在某段落内，则在该段落与下一段落的 AFFIX_WEIGHT_CURVES 之间按进度插值。
 * 最后一个段落直接返回其权重，不再插值。
 *
 * @param {number} round - 当前回合数
 * @param {object} enemyCurveConfig - ENEMY_CURVE_CONFIG 配置对象
 * @returns {{ [affix: string]: number }} 各词缀的插值权重对象
 */
function interpolateAffixWeights(round, enemyCurveConfig) {
    const segments = enemyCurveConfig && enemyCurveConfig.THEME_SEGMENTS;
    const curves = enemyCurveConfig && enemyCurveConfig.AFFIX_WEIGHT_CURVES;
    if (!segments || !curves || segments.length === 0) return {};

    const segIdx = getThemeSegment(round, enemyCurveConfig);
    const curCurve = curves[segIdx] || {};

    // 最后一段落，直接返回
    if (segIdx >= segments.length - 1) return Object.assign({}, curCurve);

    const seg = segments[segIdx];
    const segLen = seg.endRound - seg.startRound;
    const progress = segLen > 0 ? (round - seg.startRound) / segLen : 0;
    const nextCurve = curves[segIdx + 1] || {};

    const result = {};
    const affixes = new Set([...Object.keys(curCurve), ...Object.keys(nextCurve)]);
    for (const affix of affixes) {
        const a = curCurve[affix] || 0;
        const b = nextCurve[affix] || 0;
        result[affix] = a + (b - a) * progress;
    }
    return result;
}

/**
 * 按权重随机从权重 Map 中返回一个 key。
 * 权重为 0 或负数的 key 不参与抽取。
 *
 * @param {{ [key: string]: number }} weightMap - 键值对，值为权重（非负数）
 * @returns {string|null} 随机选中的 key，若 weightMap 为空则返回 null
 */
function weightedRandom(weightMap) {
    if (!weightMap) return null;
    const entries = Object.entries(weightMap).filter(([, w]) => w > 0);
    if (entries.length === 0) return null;
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return null;
    let rand = Math.random() * total;
    for (const [key, w] of entries) {
        rand -= w;
        if (rand <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

/**
 * 计算当前回合的双词缀精英出现概率。
 * 基础概率来自 ENEMY_CURVE_CONFIG.ELITE_DUAL_AFFIX_BASE，
 * Boss 战后高压期（postBossRoundsLeft > 0）额外叠加 ELITE_DUAL_AFFIX_POST_BOSS_BOOST。
 *
 * @param {number} round - 当前回合数（暂未使用，预留扩展）
 * @param {number} postBossRoundsLeft - Boss 战后剩余高压回合数（0 表示无高压）
 * @param {object} enemyCurveConfig - ENEMY_CURVE_CONFIG 配置对象
 * @returns {number} 双词缀精英出现概率（0~1）
 */
function getEliteDualAffixChance(round, postBossRoundsLeft, enemyCurveConfig) {
    const base = (enemyCurveConfig && enemyCurveConfig.ELITE_DUAL_AFFIX_BASE) || 0.15;
    const boost = (enemyCurveConfig && enemyCurveConfig.ELITE_DUAL_AFFIX_POST_BOSS_BOOST) || 0.25;
    return postBossRoundsLeft > 0 ? base + boost : base;
}

// ==================== 导出 ====================
export {
    adjustColorBrightness,
    lerpColor,
    lerp,
    hexToRgba,
    Vec2,
    showToast,
    rotateTowards,
    getThemeSegment,
    interpolateAffixWeights,
    weightedRandom,
    getEliteDualAffixChance
};
