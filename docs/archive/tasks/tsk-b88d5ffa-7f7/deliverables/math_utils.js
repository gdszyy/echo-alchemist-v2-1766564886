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
// ==================== 导出 ====================
export {
    adjustColorBrightness,
    lerpColor,
    lerp,
    hexToRgba,
    Vec2,
    showToast,
    rotateTowards
};
