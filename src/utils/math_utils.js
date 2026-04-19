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
// ==================== 曲线插值与加权随机工具 ====================

/**
 * 根据当前回合数返回对应的主题段落配置对象
 * @param {number} round - 当前回合数
 * @param {Object} curveConfig - ENEMY_CURVE_CONFIG 配置对象
 * @returns {Object} 包含 startRound, endRound, label, bossId 的段落对象
 */
function getThemeSegment(round, curveConfig) {
    const segments = curveConfig.THEME_SEGMENTS;
    // 寻找包含当前回合的段落
    for (let i = 0; i < segments.length; i++) {
        if (round >= segments[i].startRound && round <= segments[i].endRound) {
            return segments[i];
        }
    }
    // 如果超出最大回合，返回最后一个段落
    return segments[segments.length - 1];
}

/**
 * 在相邻段落之间做线性插值，返回当前回合的各词缀权重 Map
 * @param {number} round - 当前回合数
 * @param {Object} curveConfig - ENEMY_CURVE_CONFIG 配置对象
 * @returns {Object} {affix: weight} 形式的权重对象
 */
function interpolateAffixWeights(round, curveConfig) {
    const segments = curveConfig.THEME_SEGMENTS;
    const curves = curveConfig.AFFIX_WEIGHT_CURVES;
    
    // 寻找当前段落索引
    let currentIndex = 0;
    for (let i = 0; i < segments.length; i++) {
        if (round >= segments[i].startRound && round <= segments[i].endRound) {
            currentIndex = i;
            break;
        }
        if (round > segments[i].endRound) {
            currentIndex = i; // 记录最后一个经过的段落
        }
    }
    
    // 如果是最后一个段落或超出，直接返回该段落的权重
    if (currentIndex >= segments.length - 1 || round >= segments[segments.length - 1].startRound) {
        return { ...curves[segments.length - 1] };
    }
    
    const currentSegment = segments[currentIndex];
    const nextSegment = segments[currentIndex + 1];
    
    // 计算插值进度 t (0 到 1)
    // 假设当前段落的中心点为权重峰值，下一个段落的中心点为下一个峰值
    const currentCenter = (currentSegment.startRound + currentSegment.endRound) / 2;
    const nextCenter = (nextSegment.startRound + nextSegment.endRound) / 2;
    
    let t = 0;
    if (round <= currentCenter) {
        // 在当前段落前半段，使用上一个段落到当前段落的插值
        if (currentIndex === 0) {
            t = 0; // 第一个段落前半段不插值
        } else {
            const prevSegment = segments[currentIndex - 1];
            const prevCenter = (prevSegment.startRound + prevSegment.endRound) / 2;
            t = (round - prevCenter) / (currentCenter - prevCenter);
            t = Math.max(0, Math.min(1, t));
            
            const prevWeights = curves[currentIndex - 1];
            const currentWeights = curves[currentIndex];
            const result = {};
            for (const key in currentWeights) {
                result[key] = lerp(prevWeights[key] || 0, currentWeights[key] || 0, t);
            }
            return result;
        }
    } else {
        // 在当前段落后半段，使用当前段落到下一个段落的插值
        t = (round - currentCenter) / (nextCenter - currentCenter);
        t = Math.max(0, Math.min(1, t));
    }
    
    const currentWeights = curves[currentIndex];
    const nextWeights = curves[currentIndex + 1];
    const result = {};
    
    for (const key in currentWeights) {
        result[key] = lerp(currentWeights[key] || 0, nextWeights[key] || 0, t);
    }
    
    return result;
}

/**
 * 接受一个 {key: weight} 对象，按权重随机返回一个 key
 * @param {Object} weightMap - 权重对象，例如 { shield: 80, regen: 30 }
 * @returns {string|null} 随机选中的 key，如果权重总和为 0 则返回 null
 */
function weightedRandom(weightMap) {
    let totalWeight = 0;
    for (const key in weightMap) {
        totalWeight += weightMap[key];
    }
    
    if (totalWeight <= 0) return null;
    
    let randomValue = Math.random() * totalWeight;
    for (const key in weightMap) {
        randomValue -= weightMap[key];
        if (randomValue <= 0) {
            return key;
        }
    }
    
    // 兜底返回最后一个 key
    const keys = Object.keys(weightMap);
    return keys.length > 0 ? keys[keys.length - 1] : null;
}

/**
 * 计算当前回合的双词缀精英出现概率（基础值 + 高压加成）
 * @param {number} round - 当前回合数
 * @param {number} postBossRoundsLeft - Boss 战后剩余的高压回合数
 * @param {Object} curveConfig - ENEMY_CURVE_CONFIG 配置对象
 * @returns {number} 双词缀精英概率 (0 到 1)
 */
function getEliteDualAffixChance(round, postBossRoundsLeft, curveConfig) {
    let chance = curveConfig.ELITE_DUAL_AFFIX_BASE || 0.15;
    
    if (postBossRoundsLeft > 0) {
        chance += (curveConfig.ELITE_DUAL_AFFIX_POST_BOSS_BOOST || 0.25);
    }
    
    return Math.min(1, Math.max(0, chance));
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
