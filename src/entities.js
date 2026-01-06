/**
 * entities.js - 游戏实体层
 * 
 * 职责：
 * - 游戏中"会动的东西"：敌人、弹珠、子弹、特效等
 * - 战斗逻辑最密集的地方
 * - 未来扩展：NPC 类（继承自基础实体）
 * 
 * 包含的类：
 * - Vec2: 二维向量工具类
 * - MarbleDefinition: 弹珠定义
 * - SpecialSlot: 特殊槽位
 * - FortuneWheel: 命运轮盘
 * - Peg: 钉子
 * - DropBall: 下落的弹珠
 * - Enemy: 敌人（包含 AI 行为树）
 * - SwordQi, SlashAnim, SonSword: 飞剑系统
 * - Projectile: 子弹
 * - CloneSpore: 分身孢子
 * - Particle, SlashEffect, CollectionBeam, Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave: 特效
 */

import { CONFIG } from './config.js';

// 注意：audio 实例在 core.js 中创建并挂载到 window 对象，避免循环依赖
// 使用 getter 函数懒加载，确保访问时 audio 已经初始化
const getAudio = () => window.audio;
// 为了代码兼容，创建一个 Proxy 对象
const audio = new Proxy({}, {
    get: (target, prop) => {
        const audioInstance = window.audio;
        if (!audioInstance) {
            console.warn('audio instance not yet initialized');
            return () => {}; // 返回空函数避免错误
        }
        return audioInstance[prop];
    }
});

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
function showToast(msg) {
    const el = document.getElementById('toast');
    el.innerText = msg;
    el.classList.add('toast-visible');
    setTimeout(() => el.classList.remove('toast-visible'), 1500);
}

// --- 游戏实体 ---
class MarbleDefinition {
    constructor(type) {
        this.type = type;
        this.collected = []; 
        this.compiled = false; 
        this.recipe = null; 
        this.session = null; 

        // [新增] 火焰和冰霜弹珠生成时自带一层属性
        if (type === 'pyro' || type === 'cryo') {
            this.collected.push(type);
        }
    }

    getName() {
        const display = CONFIG.ui.attributeDisplay[this.type];
        if (display) return `${display.name}彈珠`;

        return '未知彈珠';
    }

    getColor() {
        if (this.type === 'rainbow') return CONFIG.colors.marbleRainbow;
        const display = CONFIG.ui.attributeDisplay[this.type];
        if (display) return display.color;

        return CONFIG.colors.marbleWhite;
    }
}

class SpecialSlot {
    /**
     * 特殊槽位类 (底部收集槽)
     * @param {number} x - **重要参数** 中心 x 坐标
     * @param {number} y - **重要参数** 中心 y 坐标
     * @param {number} width - **重要参数** 槽位宽度
     * @param {string} type - **重要参数** 槽位类型 ('recall': 回溯, 'multicast': 多重发射, 'split': 分裂)
     */
    constructor(x, y, width, type) {
        this.x = x; this.y = y; this.width = width; this.height = 12; this.type = type; this.animTimer = 0;this.hit = false;
    }
    /**
     * 绘制槽位
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    draw(ctx) {
        if (this.hit) return;
        
        this.animTimer += 0.05;
        ctx.save();
        let color = '#fff'; let text = '';
        if (this.type === 'recall') { color = CONFIG.colors.slotRecall; text = "↺"; }
        else if (this.type === 'multicast') { color = CONFIG.colors.slotMulticast; text = "+2"; }
        else if (this.type === 'split') { color = CONFIG.colors.slotSplit; text = "⑂"; }
        else if (this.type === 'relic') { color = '#facc15'; text = '🏆'; }
        else if (this.type === 'giant') { color = CONFIG.colors.slotGiant; text = "⬆️"; }
        else if (this.type === 'skill_point') { color = CONFIG.colors.slotSkill; text = "★"; }
        else if (this.type === 'wheel') { color = CONFIG.colors.slotWheel; text = "🎡"; }

        const glow = Math.sin(this.animTimer) * 5 + 10;
        
        // [叠加视觉优化] 绘制一个环绕钉子的发光圈，而不是实心方块
        ctx.shadowBlur = glow; 
        ctx.shadowColor = color; 
        ctx.strokeStyle = color; 
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        
        // 绘制一个圆环，刚好包围钉子
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // 绘制半透明填充
        ctx.globalAlpha = 0.2;
        ctx.fill();
        
        ctx.globalAlpha = 1.0; 
        ctx.shadowBlur = 0; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px sans-serif'; 
        ctx.fillStyle = '#fff'; 
        ctx.fillText(text, this.x, this.y);
        ctx.restore();
    }
}

class FortuneWheel {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.spinning = false;
        this.stopping = false;
        
        this.pos = new Vec2(0, 0);
        this.radius = 120; // [修改] 加大半徑，讓它在屏幕中間更氣派
        this.angle = 0;
        this.velocity = 0;
        this.friction = 0.977;
        
        this.slices = [];
        this.onFinish = null;
        
        // [修复] 动态构建 iconMap，确保同步 CONFIG.ui.attributeDisplay 中的所有属性
        this.iconMap = {};
        Object.keys(CONFIG.ui.attributeDisplay).forEach(key => {
            this.iconMap[key] = CONFIG.ui.attributeDisplay[key].icon;
        });
    }

    spin(x, y, collectedAttributes, callback) {
        this.pos = new Vec2(x, y);
        this.active = true;
        this.spinning = true;
        this.stopping = false;
        this.onFinish = callback;
        this.velocity = 0.4 + Math.random() * 0.2;
        this.angle = 0;

        // 構建扇區
        this.slices = [];
        
        // [修改] 1. 过滤不可叠加属性 (如 pierce, bounce, scatter, flying_sword 等通常不适合转盘直接翻倍)
        // 我们只允许元素属性和增幅属性进入转盘
        const stackableTypes = ["bounce","pierce","scatter",'damage', 'cryo', 'pyro', 'lightning', 'laser', 'wind', 'resonance', 'explosive'];
        
        // 统计当前弹珠拥有的可叠加属性
        const counts = {};
        collectedAttributes.forEach(item => {
            // [修复] 兼容字符串和对象格式
            const type = (typeof item === 'string') ? item : item.type;
            // 必须是可叠加类型，且在配置中有定义
            if (type && stackableTypes.includes(type) && CONFIG.ui.attributeDisplay[type]) {
                counts[type] = (counts[type] || 0) + 1;
            }
        });

        const validTypes = Object.keys(counts);
        
        // [修改] 2. 重构概率算法：扇区大小 = (当前拥有层数 * 基础权重)
        const weights = {};
        let totalWeight = 0;
        
        validTypes.forEach(type => {
            // 获取基础权重 (从 CONFIG.probabilities 获取，如果没有则默认为 1)
            const baseProb = CONFIG.probabilities[type] || 1;
            // 最终权重 = 基础权重 * (1 + counts[type] * 0.5)
            const weight = baseProb * (1 + counts[type] * 0.5);
            weights[type] = weight;
            totalWeight += weight;
        });

        // 如果没有有效属性，尝试加入一个保底的 'damage' 属性
        if (totalWeight === 0) {
            const fallbackType = 'damage';
            weights[fallbackType] = 1;
            totalWeight = 1;
            validTypes.push(fallbackType);
            counts[fallbackType] = 0;
        }

        let currentAngle = 0;
        Object.keys(weights).forEach(type => {
            const arc = (weights[type] / totalWeight) * Math.PI * 2;
            const display = CONFIG.ui.attributeDisplay[type];
            
            // [修改] 3. 动态奖励算法：中奖后获得的层数
            const rewardCount = Math.max(1, Math.ceil(counts[type] * 0.5));

            this.slices.push({
                type: type,
                startAngle: currentAngle,
                endAngle: currentAngle + arc,
                color: display ? display.color : '#ccc',
                icon: display ? display.icon : '❓',
                rewardCount: rewardCount, // 存储奖励层数
                count: rewardCount        // [修复] 修复绘制时 s.count 为 undefined 的问题
            });
            currentAngle += arc;
        });
    }

    update(timeScale) {
        if (!this.active) return;
        if (this.spinning) {
            this.angle += this.velocity * timeScale;
            this.angle %= (Math.PI * 2);

            if (this.stopping) {
                this.velocity *= Math.pow(this.friction, timeScale);
                if (this.velocity < 0.001) {
                    this.velocity = 0;
                    this.spinning = false;
                    this.finalizeResult();
                }
            } else {
                this.stopping = true;
            }
        }
    }

    getCurrentSlice() {
        let relAngle = (-Math.PI / 2) - this.angle;
        relAngle = relAngle % (Math.PI * 2);
        if (relAngle < 0) relAngle += Math.PI * 2;
        return this.slices.find(s => relAngle >= s.startAngle && relAngle < s.endAngle);
    }

    finalizeResult() {
        const winner = this.getCurrentSlice();
        if (winner && this.onFinish) {
            // [修改] 传递中奖类型和奖励层数
            this.onFinish(winner.type, winner.rewardCount);
        }
        setTimeout(() => { this.active = false; }, 1500); // 稍微延長展示時間
    }

    draw(ctx) {
        if (!this.active) return;
        
        // 繪製半透明黑色背景遮罩，突出輪盤
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // --- 0. 繪製外發光 ---
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#fbbf24'; // 金色光暈

        // --- 1. 繪製豪華外框 (Rim) ---
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 12, 0, Math.PI * 2);
        const rimGrad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        rimGrad.addColorStop(0, '#f59e0b'); // Amber-500
        rimGrad.addColorStop(0.5, '#fef3c7'); // Amber-100 (高光)
        rimGrad.addColorStop(1, '#b45309'); // Amber-700
        ctx.fillStyle = rimGrad;
        ctx.fill();
        ctx.shadowBlur = 0; // 關閉光暈繪製細節

        // 外框內圈描邊
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#451a03'; // 深褐色底
        ctx.fill();

        // --- 2. 跑馬燈燈泡 (Lights) ---
        const lightCount = 12;
        const time = Date.now();
        for(let i=0; i<lightCount; i++) {
            const la = (i / lightCount) * Math.PI * 2;
            const lx = Math.cos(la) * (this.radius + 7);
            const ly = Math.sin(la) * (this.radius + 7);
            
            // 燈泡閃爍邏輯 (跑馬燈效果)
            const isOn = Math.floor(time / 100) % lightCount === i;
            
            ctx.beginPath();
            ctx.arc(lx, ly, 3, 0, Math.PI * 2);
            ctx.fillStyle = isOn ? '#ffffff' : '#78350f';
            if (isOn) {
                ctx.shadowBlur = 5; ctx.shadowColor = '#fff';
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // --- 3. 繪製盤面 (旋轉部分) ---
        ctx.save();
        ctx.rotate(this.angle);
        
        const activeSlice = this.stopping ? this.getCurrentSlice() : null;

        this.slices.forEach(s => {
            const isHighlighted = (activeSlice === s);

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.radius, s.startAngle, s.endAngle);
            ctx.closePath();
            
            // 顏色處理
            ctx.fillStyle = s.color;
            ctx.fill();
            
            // 高亮疊加層
            if (isHighlighted && this.velocity < 0.1) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fill();
            }

            // 分割線
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 繪製 ICON 和 文字
            const midAngle = s.startAngle + (s.endAngle - s.startAngle) / 2;
            const iconDist = this.radius * 0.65;
            const ix = Math.cos(midAngle) * iconDist;
            const iy = Math.sin(midAngle) * iconDist;

            ctx.save();
            ctx.translate(ix, iy);
            ctx.rotate(midAngle + Math.PI / 2); 
            
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(s.icon, 0, 5); // Icon
            
            // 如果該區域佔比很小，就不顯示文字
            if ((s.endAngle - s.startAngle) > 0.4) {
                 ctx.font = 'bold 12px sans-serif';
                 ctx.textBaseline = 'top';
                 ctx.fillText(`x${s.count}`, 0, 8); // 數量
            }
            
            ctx.restore();
        });

        ctx.restore(); // 結束盤面旋轉

        // --- 4. 繪製中心裝飾 (Center Hub) ---
        // 外圈
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fillStyle = rimGrad;
        ctx.fill();
        // 內圈
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        // 星星
        ctx.fillStyle = '#f59e0b';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 1);

        // --- 5. 繪製指針 (Pointer) ---
        ctx.restore(); // 回到無旋轉狀態
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y - this.radius - 5);
        
        // 指針陰影
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 5;
        
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(10, -5);
        ctx.lineTo(0, 15); // 向下指
        ctx.closePath();
        ctx.fillStyle = '#ef4444'; // 紅色指針
        ctx.fill();
        
        // 指針鉚釘
        ctx.beginPath();
        ctx.arc(0, -2, 4, 0, Math.PI*2);
        ctx.fillStyle = '#7f1d1d';
        ctx.fill();

        ctx.restore();
    }
}

class Peg {
    constructor(x, y, type = 'normal') {
        this.pos = new Vec2(x, y); 
        this.radius = 6; 
        this.type = type; 
        this.lit = false; 
        this.litTimer = 0; 
        this.cooldownTimer = 0; // 当前剩余冷却帧数
        this.dynamicCooldown = CONFIG.gameplay.hitCooldowns || 12; // 当前触发间隔（会累加和衰减）
        
        //  缩放动画属性
        this.scale = 1.0; 
        this.lightIntensity = 0; // 光照强度 (0~1)
        this.lightAngle = 0;     // 光源方向 (弧度)
        this.level = 1;
        this.maxLevel = 3;
    }
    getColor() {
        let color = CONFIG.colors.peg;

        if (this.type === 'flying_sword') {
            if (this.level === 3) return CONFIG.colors.flying_sword_lv3;
            if (this.level === 2) return CONFIG.colors.flying_sword_lv2;
            return CONFIG.colors.flying_sword;
        }
        if (this.type === 'wind') {
            if (this.level === 3) return CONFIG.colors.matWind_lv3;
            if (this.level === 2) return CONFIG.colors.matWind_lv2;
            return CONFIG.colors.matWind;
        }

        switch(this.type) {
            case 'bounce': color = CONFIG.colors.matBounce; break;
            case 'pierce': color = CONFIG.colors.matPierce; break;
            case 'scatter': color = CONFIG.colors.matScatter; break;
            case 'damage': color = CONFIG.colors.matDamage; break;
            case 'cryo': color = CONFIG.colors.matCryo; break;
            case 'pyro': color = CONFIG.colors.matPyro; break;
            case 'lightning': color = CONFIG.colors.matLightning; break;
            case 'wind': color = CONFIG.colors.matWind; break;
            case 'pink': color = CONFIG.colors.pegPink; break;
            case 'laser': color = CONFIG.colors.laser; break;
        }
        return color
    }
    // [新增] 升级方法
    upgrade() {
        if (this.level < this.maxLevel) {
            this.level++;
            // 升级特效 (视觉缩放 + 播放强力音效)
            this.scale = 2.5; 
            this.lit = true;
            this.litTimer = 30;
            return true; // 升级成功
        }
        return false; // 已满级
    }
    // 在 Peg 类中新增此方法
    /**
     * @method drawShadow
     * @description 绘制高级动态阴影 (距离衰减 + 形状透视)
     */
    // --- 在 Peg 类中替换此方法 ---
    // --- 在 Peg 类中替换此方法 ---
    drawShadow(ctx, lightPos, lightRadius) {
        const dx = this.pos.x - lightPos.x;
        const dy = this.pos.y - lightPos.y;
        const distSq = dx * dx + dy * dy;

        // 1. 基础剔除：超出光照范围不画
        if (distSq > lightRadius * lightRadius) return;

        const dist = Math.sqrt(distSq);

        // --- [核心修改]：透明度随距离衰减 ---
        
        let alpha = 0;
        const isGlobalLight = lightRadius > 2000; // 判断是否为全局环境光

        if (isGlobalLight) {
            // A. 全局光 (倾斜产生的)：
            // 保持淡淡的影子，随距离轻微衰减，模拟大气透视
            alpha = Math.max(0.05, 0.25 - (dist / 1500));
        } else {
            // B. 弹珠光 (Drop Ball)：
            // 这是一个点光源，光强衰减很快。
            // 计算归一化距离 t (0.0 = 光源中心, 1.0 = 光照边缘)
            const t = dist / lightRadius;
            
            // 使用非线性衰减 (1-t)^2，让阴影在边缘消失得更自然柔和
            // 基础浓度 0.5 -> 边缘 0
            alpha = 0.42 * Math.pow(1 - t, 2);
            
            // 如果太淡了就直接不画，节省性能
            if (alpha < 0.01) return;
        }

        // --- [参数]：阴影长度与形态 ---
        // 弹珠光的光源高度较低 (lightZ 小)，所以阴影会拉得比较长，但不应太离谱
        const lightZ = isGlobalLight ? 850 : 120; // 弹珠光 Z轴高度较低
        const pegZ = 5;     // 钉子高度
        
        // 透视公式
        let shadowLen = (dist * pegZ) / lightZ * 30; 
        
        // 长度限制
        shadowLen = Math.min(shadowLen, isGlobalLight ? 25 : 60); 

        // 扩散系数：离光源越远，阴影末端越散开
        const spreadFactor = 1.0 + (dist / 420); 

        // --- 以下绘制逻辑保持不变 ---
        const angle = Math.atan2(dy, dx);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const r = this.radius * 0.8; 
        const px = -sin * r; 
        const py = cos * r;
        const ax = this.pos.x + px;
        const ay = this.pos.y + py;
        const bx = this.pos.x - px;
        const by = this.pos.y - py;
        const tipX = this.pos.x + cos * shadowLen;
        const tipY = this.pos.y + sin * shadowLen;
        const endPx = px * spreadFactor;
        const endPy = py * spreadFactor;
        const cx = tipX - endPx; 
        const dx_end = tipX + endPx;
        const cy = tipY - endPy; 
        const dy_end = tipY + endPy;

        ctx.save();
        // 径向渐变：从钉子根部(深)到阴影末端(浅)
        const grad = ctx.createRadialGradient(
            this.pos.x, this.pos.y, r,
            this.pos.x, this.pos.y, shadowLen + r
        );
        // 颜色也随距离 alpha 变化
        grad.addColorStop(0, `rgba(15, 23, 42, ${alpha})`);
        grad.addColorStop(1, `rgba(15, 23, 42, 0)`);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(dx_end, dy_end);
        ctx.quadraticCurveTo(tipX + cos * 3, tipY + sin * 3, cx, cy);
        ctx.lineTo(bx, by);
        ctx.closePath();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fill();
        ctx.restore();
    }
    resetLight() {
        this.lightIntensity = 0;
    }
    // [新增] 重置冷却
    resetCooldown() {
        this.cooldownTimer = 0;
        this.dynamicCooldown = CONFIG.gameplay.hitCooldowns || 12;
        this.decayTimer = 0;
    }
    //  计算来自某个光源的影响
    calculateLight(sourcePos, lightRadius) {
        const dx = sourcePos.x - this.pos.x;
        const dy = sourcePos.y - this.pos.y;
        const distSq = dx*dx + dy*dy;
        const radiusSq = lightRadius * lightRadius;

        // 如果在光照范围内
        if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            // 计算强度：距离越近越亮 (线性衰减)
            const intensity = 1.0 - (dist / lightRadius);
            
            // 简单的光照叠加逻辑：取最大值，或者累加
            // 这里我们取最大值，保证光照方向明确
            if (intensity > this.lightIntensity) {
                this.lightIntensity = intensity;
                this.lightAngle = Math.atan2(dy, dx); // 计算指向光源的角度
            }
        }
    }
    /**
     * 钉子被击中
     * @param {number} impactSpeed - 撞击速度
     */
    hit(impactSpeed = 5) { 
        this.lit = true; 
        this.litTimer = 15; 
        
        // [修改] 动态冷却逻辑
        // 1. 设置当前冷却计时器为当前的动态冷却时间
        this.cooldownTimer = this.dynamicCooldown;
        
        // 2. 增加下次触发的冷却时间 (默认 +5 帧)
        const addAmount = CONFIG.gameplay.pegCooldownAdd || 5;
        this.dynamicCooldown += addAmount;
        
        // 速度越快，视觉缩放越大 (最大 1.8)
        this.scale = 1.6 + Math.min(impactSpeed / 20, 0.2); 
        
        // 将速度传递给音效管理器
        audio.playHit(this.type, impactSpeed); 
    }
    // --- 替换 Peg 类的 draw 方法 ---
    draw(ctx, baseRadius, tilt = {x:0, y:0}) {
        const currentRadius = baseRadius * this.scale;
        const isSpecial = this.type !== 'normal';
        const isLit = this.lit;
        const color = this.getColor();

        // 1. 绘制基础圆形钉子
        ctx.beginPath(); 
        ctx.arc(this.pos.x, this.pos.y, currentRadius, 0, Math.PI * 2);
        
        if (this.type === 'laser') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = CONFIG.colors.laser;
            ctx.fillStyle = isLit ? '#ffffff' : color;
        } else if (this.type === 'wind') {
            // 风属性钉子使用特殊的脉冲发光
            const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
            ctx.shadowBlur = 12 + pulse * 8;
            ctx.shadowColor = CONFIG.colors.matWind;
            ctx.fillStyle = isLit ? '#ffffff' : color;
        } else if (isLit) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffffff';
        } else {
            ctx.fillStyle = color;
            ctx.shadowBlur = 0; 
        }
        ctx.fill();

        // 恢复 Context 状态
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // [新增] 绘制冷却视觉反馈 (灰色圆弧 Slice)
        if (this.cooldownTimer > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            
            // 计算冷却比例 (当前剩余时间 / 总冷却时间)
            const cooldownProgress = this.cooldownTimer / this.dynamicCooldown;
            
            // 绘制半透明深灰色扇形 (Slice)
            // 从顶部开始，逆时针减少或顺时针增加
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.arc(this.pos.x, this.pos.y, currentRadius + 1, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * cooldownProgress));
            ctx.fill();
            
            // 添加一个细边框让它更明显
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.restore();
        }

        // 2. 特殊绘制：如果是飞剑钉子，在圆钉子上绘制剑纹
        if (this.type === 'flying_sword') {
            this.drawSwordPeg(ctx, currentRadius, isLit);
        }
        // 特殊绘制：如果是风属性钉子，绘制风旋图标
        if (this.type === 'wind') {
            this.drawWindPeg(ctx, currentRadius, isLit);
        }

        // --- 2. 绘制光照反光 (Rim Light) ---
        // 仅当光照强度足够时才绘制，且使用 globalAlpha 替代渐变
        if (this.lightIntensity > 0.1 && !isLit) {
            ctx.save();
            ctx.globalAlpha = this.lightIntensity * 0.6; // 使用透明度控制强弱
            ctx.fillStyle = '#ffffff';
            
            // 简单的偏心圆模拟反光
            const offsetDist = currentRadius * 0.4;
            const fx = this.pos.x + Math.cos(this.lightAngle) * offsetDist;
            const fy = this.pos.y + Math.sin(this.lightAngle) * offsetDist;
            
            ctx.beginPath();
            ctx.arc(fx, fy, currentRadius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // --- 3. 绘制特殊钉子边框 ---
        if (isSpecial) { 
            // 如果是升级过的钉子 (level > 1)，绘制带反光动画的金边
            if (this.level > 1) {
                const time = Date.now() / 1000;
                const goldColor = '#FFD700'; // 金色
                const shineColor = '#FFFFFF'; // 反光色
                
                ctx.save();
                // 绘制金边底色
                ctx.strokeStyle = goldColor;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(this.pos.x, this.pos.y, currentRadius + 2.5, 0, Math.PI * 2);
                ctx.stroke();
                
                // 绘制反光动画
                // 使用线性渐变模拟扫过的反光
                const angle = (time * 2) % (Math.PI * 2); // 旋转速度
                const grad = ctx.createLinearGradient(
                    this.pos.x - currentRadius * Math.cos(angle), 
                    this.pos.y - currentRadius * Math.sin(angle),
                    this.pos.x + currentRadius * Math.cos(angle), 
                    this.pos.y + currentRadius * Math.sin(angle)
                );
                grad.addColorStop(0, goldColor);
                grad.addColorStop(0.45, goldColor);
                grad.addColorStop(0.5, shineColor); // 中间高亮
                grad.addColorStop(0.55, goldColor);
                grad.addColorStop(1, goldColor);
                
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                
                // 添加金色外发光
                ctx.shadowBlur = 8;
                ctx.shadowColor = goldColor;
                ctx.stroke();
                ctx.restore();
            } else {
                // 普通特殊钉子边框
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1.5; 
                ctx.stroke(); 
            }
        }

        // 2. [新增] 绘制等级指示器 (Level Indicator)
        // 只有特殊且等级>1的钉子才显示
        if (this.level > 1 && this.type !== 'normal') {
            this.drawLevelPips(ctx, currentRadius);
        }
    }
    // [新增] 绘制剑形钉子
    drawSwordPeg(ctx, r, isLit) {
        // 剑纹颜色：如果是点亮状态用深色，否则用浅色/白色
        ctx.fillStyle = isLit ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)';
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // 缩小剑纹比例，使其待在圆钉子内部
        const sr = r * 0.6; 
        
        ctx.beginPath();
        // 剑刃 (指向下方或上方，这里保持原逻辑方向但缩小)
        ctx.moveTo(0, -sr * 1.2); // 剑尖
        ctx.lineTo(sr * 0.4, -sr * 0.2);
        ctx.lineTo(sr * 0.1, -sr * 0.2);
        // 剑柄
        ctx.lineTo(sr * 0.1, sr * 0.8); 
        ctx.lineTo(-sr * 0.1, sr * 0.8);
        ctx.lineTo(-sr * 0.1, -sr * 0.2);
        ctx.lineTo(-sr * 0.4, -sr * 0.2);
        ctx.closePath();
        
        ctx.fill();
        ctx.restore();
    }
    // [优化] 绘制风属性钉子图标 - 螺旋风刃纹章 (方案升级版)
    drawWindPeg(ctx, r, isLit) {
        const time = Date.now() / 1000;
        
        // 1. 底色：使用更清透的薄荷绿渐变
        const gradient = ctx.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, r);
        if (isLit) {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, '#6ee7b7');
        } else {
            gradient.addColorStop(0, '#6ee7b7'); // light green
            gradient.addColorStop(1, '#059669'); // emerald
        }
        ctx.fillStyle = gradient;
        
        // 绘制底圆
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, r, 0, Math.PI * 2);
        ctx.fill();

        // 2. 绘制动态旋转风刃 (与 Bounce 的纯圆区分)
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(time * 2.5); // 持续旋转
        
        const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
        ctx.shadowBlur = 8 + pulse * 10;
        ctx.shadowColor = '#34d399';
        
        ctx.strokeStyle = isLit ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = r * 0.15;
        ctx.lineCap = 'round';
        
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            // 三段圆弧模拟风刃
            const startAngle = i * (Math.PI * 2 / 3);
            ctx.arc(0, 0, r * 0.65, startAngle, startAngle + 1.2); 
            ctx.stroke();
        }
        
        // 绘制中心气旋
        ctx.rotate(-time * 4); // 反向旋转中心
        ctx.beginPath();
        for(let i=0; i<3; i++) {
            const a = i * (Math.PI * 2 / 3);
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(Math.cos(a)*r*0.4, Math.sin(a)*r*0.4, Math.cos(a+0.5)*r*0.3, Math.sin(a+0.5)*r*0.3);
        }
        ctx.stroke();
        
        ctx.restore();
    }
    // [新增] 绘制等级星级/点数
    drawLevelPips(ctx, r) {
        ctx.save();
        ctx.fillStyle = '#fbbf24'; // 金色星星
        
        const yOffset = -r * 1.8; // 显示在钉子上方
        const spacing = 5;
        // 居中排列星星
        const startX = this.pos.x - ((this.level - 1) * spacing) / 2;

        for (let i = 0; i < this.level; i++) {
            ctx.beginPath();
            ctx.arc(startX + i * spacing, this.pos.y + yOffset, 2, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }

    update() { 
        if (this.litTimer > 0) this.litTimer--; else this.lit = false; 
        
        // [修改] 冷却计时器递减 (每帧执行)
        if (this.cooldownTimer > 0) this.cooldownTimer--;

        // [修改] 动态冷却上限衰减 (每秒执行)
        if (!this.decayTimer) this.decayTimer = 0;
        this.decayTimer++;
        
        if (this.decayTimer >= 60) {
            const decayAmount = CONFIG.gameplay.pegCooldownDecay || 2;
            const minCooldown = CONFIG.gameplay.hitCooldowns || 12;
            
            if (this.dynamicCooldown > minCooldown) {
                this.dynamicCooldown = Math.max(minCooldown, this.dynamicCooldown - decayAmount);
            }
            this.decayTimer = 0;
        }

        //  弹性恢复动画 (Lerp back to 1.0)
        if (this.scale > 1.0) {
            this.scale -= 0.1; // 回弹速度
            if (this.scale < 1.0) this.scale = 1.0;
        }
    }
}

class DropBall {
	    /**
	     * 收集阶段的弹珠类
	     * @param {number} x - **重要参数** 初始 x 坐标
	     * @param {number} y - **重要参数** 初始 y 坐标
	     * @param {MarbleDefinition} marbleDef - **重要参数** 弹珠定义
	     * @param {object} session - **重要参数** 当前收集会话数据 (包含 collected, multicast, currentHits 等)
	     */
	    constructor(x, y, marbleDef, session) {
	        this.pos = new Vec2(x, y); this.vel = new Vec2((Math.random() - 0.5) * 2, 2); 
	        // 修正：game 引用错误，改为从 session 关联或使用默认值
	        const sizeBonus = (session && session.game) ? (session.game.marbleSizeBonus || 0) : 0;
	        this.radius = CONFIG.physics.marbleRadius + sizeBonus; 
	        this.active = true; this.def = marbleDef; this.session = session;
	        this.isRainbowShard = false; // 是否为彩虹弹珠分裂出的碎片
	        this.portalCooldown = 0; // 槽位冷却时间
	        this.hitCount = 0; // 撞击次数
	        this.canTriggerSplitSlot = true; // 是否可以触发分裂槽位
            this.rollingSound = audio.createRollingSound();
            // --- Visual State ---
            this.lifeTime = 0; // 用于驱动动画
            this.visualSeed = Math.random() * 1000; // 随机种子，用于闪电/噪点的不规则跳动
            this.windBladeAngle = 0; // 风属性环绕风刃的旋转角度
	    }
        /**
         * [核心方法] 获取当前所有属性的层数
         * 结合了“弹珠自带属性”和“收集到的属性”
         */
        /**
         * [核心方法] 获取当前所有属性的层数
         * 兼容：弹珠自带属性 + 收集到的属性 (支持 String 和 Object 混合格式)
         */
        getBuffState() {
            const stats = {
                cryo: 0,
                pyro: 0,
                lightning: 0,
                laser: 0,
                intensity: 0
            };

            // 1. 统计收集到的属性
            if (this.session && this.session.collected) {
                this.session.collected.forEach(item => {
                    // [修复]：同时支持字符串 'cryo' 和 对象 {type:'cryo', level:1}
                    const type = (typeof item === 'string') ? item : item.type;
                    
                    if (stats.hasOwnProperty(type)) {
                        stats[type]++;
                    }
                });
            }
            
            // 2. 统计弹珠自带属性 (如果 def.collected 也有数据)
            if (this.def && this.def.collected) {
                 this.def.collected.forEach(item => {
                    const type = (typeof item === 'string') ? item : item.type;
                    if (stats.hasOwnProperty(type)) stats[type]++;
                 });
            }

            // 限制最大层数
            stats.cryo = Math.min(12, stats.cryo);
            stats.pyro = Math.min(12, stats.pyro);
            stats.lightning = Math.min(12, stats.lightning);
            stats.laser = Math.min(12, stats.laser);
            
            stats.intensity = stats.cryo + stats.pyro + stats.lightning + stats.laser;

            return stats;
        }
        // [新增] 处理钉子交互（同化、突变、升级）

        handlePegInteraction(peg, game) {
            // 1. 获取当前弹珠的属性类型
            let ballType = this.def.type;


            // 2. 检查规则表
            const rules = CONFIG.evolutionRules[ballType];
            if (rules && rules[peg.type]) {
                const rule = rules[peg.type];
                
                // 概率设定：使用配置中的乘子
                const assimilationChance = CONFIG.gameplay.assimilationChance[ballType] || 0.2;
                const mutationMult = CONFIG.gameplay.specialMutationMult || 0.5;
                const upgradeMult = CONFIG.gameplay.specialUpgradeMult || 1.0;
                const chance = rule.type === 'upgrade' ? assimilationChance * upgradeMult : assimilationChance * mutationMult;

                if (Math.random() < chance) {
                    
                    // === 逻辑 A: 突变 (Mutation) ===
                    if (rule.type === 'mutation') {
                        // [全场唯一性检查]
                        // 只有 flying_sword 需要全场唯一性检查
                        const needsUniqueness = (rule.result === 'flying_sword' || rule.result === 'wind');
                        const alreadyExists = needsUniqueness && game.pegs.some(p => p.type === rule.result);

                        if (!alreadyExists) {
                            // 允许突变
                            peg.type = rule.result;
                            peg.level = 1; 
                            
                            // 特效
                            game.spawn_createExplosion(peg.pos.x, peg.pos.y, CONFIG.colors[rule.result]);
                            game.spawn_createFloatingText(peg.pos.x, peg.pos.y - 20, "Mutation!", CONFIG.colors[rule.result]);
                            audio.playMagic();
                        } else {
                            // 场上已有同类唯一实体 -> 禁止突变，退化为普通同化 (变成 Pierce)
                            if (peg.type === 'normal') {
                                peg.type = 'pierce';
                                game.spawn_createParticle(peg.pos.x, peg.pos.y, CONFIG.colors.matPierce);
                            }
                        }
                    } 
                    
                    // === 逻辑 B: 升级 (Upgrade) ===
                    else if (rule.type === 'upgrade') {
                        const success = peg.upgrade();
                        if (success) {
                            // 升级成功特效
                            game.spawn_createExplosion(peg.pos.x, peg.pos.y, '#fbbf24');
                            game.spawn_createFloatingText(peg.pos.x, peg.pos.y - 15, `Lv${peg.level} 剑意!`, '#fbbf24');
                            audio.playPowerup(peg.level + 3); // 音调更高
                        } else {
                            // 已满级特效 (可选)
                            game.spawn_createFloatingText(peg.pos.x, peg.pos.y - 15, "MAX!", '#ef4444');
                        }
                    }
                }
            } 
            // 3. 原有的普通同化逻辑 (Fallback)
            else if (peg.type === 'normal' && ballType) {
                // 这里保留原有的逻辑：普通弹珠同化普通钉子
                const assimilationChance = CONFIG.gameplay.assimilationChance[ballType] || 0;
                if (Math.random() < assimilationChance && assimilationChance>0) {
                    peg.type = ballType;
                    
                    // [新增] 同化钉子特效：爆炸 + 浮动文字
                    const attrColor = this.def.getColor();
                    const attrName = CONFIG.ui.attributeDisplay[ballType] ? CONFIG.ui.attributeDisplay[ballType].name : "Assimilation";
                    game.spawn_createExplosion(peg.pos.x, peg.pos.y, attrColor);
					game.spawn_createShockwave(peg.pos.x, peg.pos.y, attrColor);
                    game.spawn_createFloatingText(peg.pos.x, peg.pos.y - 20, attrName, attrColor);
                    
                    game.spawn_createParticle(peg.pos.x, peg.pos.y, attrColor);
                    audio.playMagic();
                }
            }
        }
	    /**
	     * @method update
	     * @description 更新弹珠位置和处理碰撞。
	     * @param {Peg[]} pegs - **重要参数** 所有钉子。
	     * @param {SpecialSlot[]} slots - **重要参数** 所有特殊槽位。
	     * @param {number} width - 游戏区域宽度。
	     * @param {number} height - 游戏区域高度。
	     * @param {number} timeScale - 时间缩放因子。
	     * @returns {string|object|null} 碰撞结果 ('finished' 或 {action: 'split', ...} 或 null)。
	     */
	    update(pegs, slots, width, height, timeScale, tilt = {x:0, y:0}) {
            if (!this.active) {
                this.stopSound(); // 确保非活跃时停止声音
                return null;
            }

            this.lifeTime += timeScale;
            const buffs = this.getBuffState(); // 获取实时属性
            
            // 更新风属性环绕风刃的旋转角度
            if (this.session && this.session.collected && this.session.collected.some(item => {
                const type = (typeof item === 'string') ? item : item.type;
                return type === 'wind';
            })) {
                this.windBladeAngle += 0.1 * timeScale;
            }

            // --- 粒子生成逻辑 (基于当前拥有的属性) ---
            // 只要带有某种属性，就会掉落对应粒子
            if (Math.random() < 0.4 * timeScale) { 
                const r = this.radius;

                // --- 🔥 Pyro (过热): 上升的余烬 (Rising Embers) ---
                if (buffs.pyro > 0) {
                    // 层数越高，余烬越密集
                    const burnChance = 0.3 + (buffs.pyro * 0.42); 
                    
                    if (Math.random() < burnChance) {
                        // 1. 生成位置：在球体上半部分随机生成 (模拟热气)
                        // 稍微宽一点，让余烬不仅从中心冒出来
                        const spawnX = this.pos.x + (Math.random() - 0.5) * r * 1.5;
                        const spawnY = this.pos.y - (Math.random() * r * 0.8); 

                        // 2. 调用新的 ember 模式
                        // 颜色参数在这里会被 ember 内部的动态颜色覆盖，所以传个占位符即可
                        const ember = new Particle(spawnX, spawnY, '#fbbf24', 'ember');
                        
                        // [微调] 根据层数，让火焰升腾得更快
                        ember.vel.y -= (buffs.pyro * 0.2);  
                        ember.size *= (0.42 + Math.random() * 4.2); // 大小随机
                        
                        game.particles.push(ember);
                        
                        // 3. 偶尔生成黑烟 (增加对比度，让亮色更亮)
                        if (Math.random() < 0.15) {
                            const smoke = new Particle(spawnX, spawnY, 'rgba(0,0,0,0.3)', 'smoke');
                            smoke.size = r * 0.6; // 较小的烟
                            smoke.vel.y *= 0.5;   // 慢速飘
                            game.particles.push(smoke);
                        }
                    }
                }

                // --- ❄️ Cryo (过冷): 下沉的冷气 - [优化版：模糊寒雾] ---
                if (buffs.cryo > 0) {
                    // 层数越高，冷气越浓，生成频率越高
                    const mistChance = 0.25 + (buffs.cryo * 0.15);

                    if (Math.random() < mistChance) {
                        // 1. 生成位置：球体下半部分 (冷气下沉)
                        const spawnX = this.pos.x + (Math.random() - 0.5) * r * 1.2;
                        const spawnY = this.pos.y + (Math.random() * r * 0.6); 
                        
                        // 2. 使用 'mist' 模式
                        // 颜色参数传空即可，Particle 类内部写死了冷色调渐变
                        const mist = new Particle(spawnX, spawnY, null, 'mist');
                        
                        // 微调：根据 Cryo 层数，雾气可以更大一点
                        mist.size *= (1 + buffs.cryo * 0.1);

                        game.particles.push(mist);
                        
                        // 3. 偶尔生成一点点晶莹的冰渣 (增加对比度)
                        if (Math.random() < 0.05) {
                            const shard = new Particle(spawnX, spawnY, '#a5f3fc', 'shard');
                            shard.size = 2; // 很小的冰晶
                            game.particles.push(shard);
                        }
                    }
                }
                
                // --- ⚡ Lightning (闪电): 偶尔残留电弧 ---
                // (既然做了就顺便加上)
                if (buffs.lightning > 0 && Math.random() < 0.02 * buffs.lightning) {
                     game.spawn_createParticle(this.pos.x, this.pos.y, '#d8b4fe', 'spark');
                }
            }
            if (this.portalCooldown > 0) this.portalCooldown -= timeScale;
            // 重力计算
            // 基础重力
            let gx = 0;
            let gy = CONFIG.physics.gravity;

            // 叠加倾斜影响
            // x轴倾斜直接产生横向重力
            gx += tilt.x * 0.05; // 0.25 是倾斜重力系数，可调整手感
            
            // y轴倾斜微调垂直重力 (前倾加速，后倾减速)
            // gy += tilt.y * 0.1;

            let gravityStep = new Vec2(gx * timeScale, gy * timeScale);
            
            this.vel = this.vel.add(gravityStep);
            this.pos = this.pos.add(this.vel.mult(timeScale));
            this.vel = this.vel.mult(Math.pow(CONFIG.physics.friction, timeScale));

            //  更新滚动音效
            // 计算当前速度的大小 (Magnitude)
            const currentSpeed = this.vel.mag();
            // 只有当球在向下滚动或者速度较快时才有声音 (防止卡在某处时还有声音)
            if (this.rollingSound) {
                this.rollingSound.update(currentSpeed);
            }

            // 边界碰撞
            if (this.pos.x < this.radius) { this.pos.x = this.radius; this.vel.x *= -0.6; }
            if (this.pos.x > width - this.radius) { this.pos.x = width - this.radius; this.vel.x *= -0.6; }
            
            // 底部退出
            if (this.pos.y > height + 150) { 
                this.active = false; 
                this.stopSound(); 
                return 'finished'; 
            }

            // ... (特殊槽位检测逻辑保持不变，只需注意 active=false 时调用 this.stopSound()) ...
            for (let slot of slots) {
                if (slot.hit) continue;
                if (this.portalCooldown <= 0) {
                    let dx = Math.abs(this.pos.x - slot.x);
                    let dy = Math.abs(this.pos.y - slot.y);
                    if (dy < 12 && dx < slot.width / 2) {
                        slot.hit = true;
                        this.portalCooldown = 40; 
                        if (slot.type === 'recall') {
                            this.pos.y = 80; this.vel.y = 2; this.portalCooldown = 60; audio.playPowerup(); game.spawn_createExplosion(slot.x, slot.y, CONFIG.colors.slotRecall); showToast("時空回溯！");
                        } else if (slot.type === 'multicast') {
                            if (this.session.multicastAdded.indexOf(slot) === -1) { 
                                this.session.multicast += 2; audio.playPowerup(); game.spawn_createExplosion(slot.x, slot.y, CONFIG.colors.slotMulticast); showToast("連續發射+2！");
                                    game.combat_updateMulticastDisplay(2);
                            }
                        } else if (slot.type === 'split') {
                            if (this.canTriggerSplitSlot) {
                                this.active = false; 
                                this.stopSound(); // 
                                audio.playPowerup(); game.spawn_createExplosion(slot.x, slot.y, CONFIG.colors.slotSplit); 
                                return { action: 'split', pos: this.pos, vel: this.vel, def: this.def };
                            }
                        } else if (slot.type === 'relic') {
                            this.active = false; 
                            this.stopSound(); // 
                            audio.playPowerup(); 
                            game.spawn_createExplosion(slot.x, slot.y, '#facc15'); 
                            return { type: 'slot', slotType: 'relic', pos: this.pos };
                        } else if (slot.type === 'skill_point') {
                            // 1. 標記槽位被擊中 (立即消失)
                            slot.hit = true;

                            // 2. 播放原地音效與爆炸 (立即反饋)
                            audio.playPowerup();
                            game.spawn_createExplosion(slot.x, slot.y, CONFIG.colors.slotSkill); 
                            showToast("技能點獲取!");

                            // --- [新增] 引導動畫邏輯 ---
                            
                            // A. 計算 UI 目標位置 (下一個空的技能槽)
                            // 獲取所有槽位 DOM
                            const uiSlots = document.querySelectorAll('.sp-slot');
                            // 當前點數即為下一個空槽的索引 (例如有0點，下一個是第0個)
                            const targetIndex = game.skillPoints; 
                            
                            let targetX = game.width / 2; // 默認兜底位置
                            let targetY = 80;

                            // 如果能找到對應的 DOM 元素，計算其中心坐標
                            if (uiSlots && uiSlots[targetIndex]) {
                                const rect = uiSlots[targetIndex].getBoundingClientRect();
                                targetX = rect.left + rect.width / 2;
                                targetY = rect.top + rect.height / 2;
                            }

                            // B. 創建飛行能量球
                            const orb = new EnergyOrb(
                                slot.x, slot.y,   // 起點：槽位位置
                                targetX, targetY, // 終點：UI 位置
                                CONFIG.colors.slotSkill, // 顏色：綠色
                                new Vec2(0, -8),  // 初速度：向上噴出
                                () => {
                                    // --- C. 到達回調 (On Arrive) ---
                                    // 只有當球飛到時，才真正增加點數
                                    game.spawn_addSkillPoint(1);

                                    // 觸發 UI 閃光特效
                                    // 重新獲取一次 DOM，因為 addSkillPoint 可能重繪了它們
                                    const updatedSlots = document.querySelectorAll('.sp-slot');
                                    // 剛剛加了1點，所以現在要閃爍的是 (總點數 - 1) 的位置
                                    const filledSlot = updatedSlots[game.skillPoints - 1];
                                    
                                    if (filledSlot) {
                                        filledSlot.classList.remove('flash');
                                        void filledSlot.offsetWidth; // 強制重繪
                                        filledSlot.classList.add('flash');
                                    }
                                    
                                    // 播放到達音效 (可選)
                                    audio.playCollect();
                                }
                            );

                            // 將光球加入遊戲循環
                            game.energyOrbs.push(orb);
                        }else if (slot.type === 'wheel') {
                            slot.hit = true;
                            this.stopSound();
                            
                            const currentAttrs = [...this.session.collected];
                            
                            if (currentAttrs.length === 0) {
                                audio.playEffect('bump');
                                game.spawn_createExplosion(slot.x, slot.y, '#ffffff');
                                showToast("无属性可复制");
                                game.phase_gathering_attemptComplete(); 
                                return { type: 'slot', slotType: 'wheel', pos: this.pos };
                            }

                            // [修改] 觸發轉盤
                            audio.playPowerup(); 
                            game.spawn_createExplosion(slot.x, slot.y, CONFIG.colors.slotWheel); 
                            showToast("命運輪盤啟動!");

                            // [修改] 使用屏幕中心坐標 (game.width/2, game.height/2)
                            // 稍微向上偏移一點 (-50) 視覺更平衡
                            const wheelX = game.width / 2;
                            const wheelY = game.height / 2 - 50; 
                            
                            game.isWheelSpinning = true;

                            game.fortuneWheel.spin(wheelX, wheelY, currentAttrs, (winningType, rewardCount) => {
                                // [修改] 使用转盘计算出的 rewardCount
                                const addCount = rewardCount || 1; 
                                
                                for(let k=0; k<addCount; k++) {
                                    this.session.collected.push(winningType);
                                    this.def.collected.push(winningType);
                                }
                                // 3. 同步给主队列中的弹珠定义，防止结算时丢失
                                if (game.marbleQueue[game.activeMarbleIndex]) {
                                    game.marbleQueue[game.activeMarbleIndex].collected = [...this.session.collected];
                                }
                                
                                // 获取属性名称
                                const attrName = CONFIG.ui.attributeDisplay[winningType] ? CONFIG.ui.attributeDisplay[winningType].name : winningType;
                                
                                // 文字提示位置也改為屏幕中間
                                game.spawn_createFloatingText(wheelX, wheelY + 80, `${attrName} +${addCount}!`, "#fff");
                                game.spawn_createExplosion(wheelX, wheelY, '#fff');
                                audio.playPowerup(5);
                                game.ui_renderRecipeHUD();
                                game.isWheelSpinning = false;
                                
                                if (game.dropBalls.length === 0) { 
                                    game.currentSession.activeBalls = 0; 
                                    game.phase_gathering_attemptComplete();
                                    game.currentSession = null; 
                                }
                            });

                            return { type: 'slot', slotType: 'wheel', pos: this.pos };
                        }
                    }
                }
            }

            // ... (钉子碰撞检测逻辑保持不变，注意 rainbow_split 返回前停止声音) ...
            for (let peg of pegs) {
                let dist = this.pos.dist(peg.pos); let minDist = this.radius + peg.radius;
                if (dist < minDist) {
                    // ... (反弹逻辑不变) ...
                    let n = this.pos.sub(peg.pos).norm();
                    this.pos = peg.pos.add(n.mult(minDist + 0.1));
                    const impactVel = new Vec2(this.vel.x, this.vel.y);

                    let d = this.vel.dot(n);
                    if (d < 0) {
                        let elasticity = CONFIG.physics.elasticity; 
                        if (peg.type === 'pink') elasticity *= CONFIG.physics.pinkpegElasticityMuti; 
                        this.vel = this.vel.sub(n.mult(2 * d)).mult(elasticity);
                        this.vel.x += (Math.random() - 0.5) * 0.5;
                    }

                    if (peg.cooldownTimer <= 0) {
                        // --- [关键修改：传递速度参数] ---
                        const impactSpeedVal = impactVel.mag(); 
                        peg.hit(impactSpeedVal);
                        this.hitCount++; 
                        // 如果是普通钉子 (normal)，触发两次能量球反馈
                        game.spawn_createHitFeedback(this.pos.x, this.pos.y, impactVel, peg.type);

                        if (peg.type === 'normal' && Math.random() < CONFIG.balance.normalPegSecondEnergChancey) {
                            game.spawn_createHitFeedback(this.pos.x, this.pos.y, impactVel.mult(0.65), 'normal');
                        }

                        if (this.def.type === 'resonance') {
                            if (Math.random() < CONFIG.balance.normalPegSecondEnergChancey){
                                game.spawn_createHitFeedback(this.pos.x, this.pos.y, impactVel.mult(0.21+0.42*Math.random()), 'resonance');
                            }
                            if (Math.random() < CONFIG.balance.normalPegSecondEnergChancey){
                                game.spawn_createHitFeedback(this.pos.x, this.pos.y, impactVel.mult(-0.21-0.72*Math.random()), 'resonance');
                            }
                            
                        }




                        if (this.session.currentHits >= this.session.nextTriggerThreshold) {
                            this.session.currentHits = 0;
                            this.session.multicast++;
                          // 增加阈值
                            this.session.nextTriggerThreshold = this.session.nextTriggerThreshold + CONFIG.gameplay.nextTriggerThresholdIncrease;
                            // 同步更新 Game 类的持久变量，确保下一颗球能继承这个数值
                            game.persistentThreshold = this.session.nextTriggerThreshold;
                              showToast(`充能！下一次: ${this.session.nextTriggerThreshold}`); audio.playPowerup();
                        }

                        if (peg.type !== 'pink') {
                            this.handlePegInteraction(peg, game); // 传入 game
                        }

                        if (peg.type !== 'normal' && peg.type !== 'pink') { 
                            // --- [新增/修改] 实时合成逻辑 ---
                            let finalType = peg.type;
                            let isSynthesized = false;
                            const collectedList = this.session.collected;

                            // 1. 元素合成逻辑 (冰 + 火 = 雷)
                            if (peg.type === 'pyro') {
                                const iceIdx = collectedList.findIndex(item => (typeof item === 'string' ? item : item.type) === 'cryo');
                                if (iceIdx !== -1) {
                                    collectedList.splice(iceIdx, 1);
                                    finalType = 'lightning';
                                    isSynthesized = true;
                                }
                            } else if (peg.type === 'cryo') {
                                const fireIdx = collectedList.findIndex(item => (typeof item === 'string' ? item : item.type) === 'pyro');
                                if (fireIdx !== -1) {
                                    collectedList.splice(fireIdx, 1);
                                    finalType = 'lightning';
                                    isSynthesized = true;
                                }
                            }

                            // 2. 进化属性唯一性检查 (飞剑、风)
                            const rules = CONFIG.evolutionRules;
                            let originalBaseType = null;
                            let isEvolutionResult = false;

                            for (const [baseType, ruleSet] of Object.entries(rules)) {
                                for (const [pegType, rule] of Object.entries(ruleSet)) {
                                    if (rule.result === peg.type) {
                                        isEvolutionResult = true;
                                        originalBaseType = baseType;
                                        break;
                                    }
                                }
                                if (isEvolutionResult) break;
                            }

                            if (isEvolutionResult) {
                                const alreadyInCurrent = this.session.collected.some(item => (typeof item === 'string' ? item : item.type) === peg.type);
                                const alreadyInQueue = game.marbleQueue.some(m => m.collected && m.collected.some(item => (typeof item === 'string' ? item : item.type) === peg.type));
                                
                                if (alreadyInCurrent || alreadyInQueue) {
                                    finalType = originalBaseType;
                                }
                            }

                            // [修复] 确保 finalType 在 attributeDisplay 中有定义，否则不加入收集列表
                            if (!CONFIG.ui.attributeDisplay[finalType]) {
                                console.warn(`Attempted to collect unknown attribute type: ${finalType}`);
                                return null;
                            }

                            // 将最终结果加入收集列表
                            const collectedItem = { type: finalType, level: peg.level || 1 };
                            this.session.collected.push(collectedItem); 
                            this.def.collected.push(finalType); 

                            // ---  合成反馈 ---
                            if (isSynthesized) {
                                game.spawn_createFloatingText(this.pos.x, this.pos.y, "⚡ SYNTHESIS!", "#c084fc");
                                audio.playLightning(); // 播放闪电音效
                            }

                            return { type: 'collected', material: finalType };
                        }
                        
                        if (this.def.type === 'rainbow' && !this.isRainbowShard) { 
                            this.active = false; 
                            this.stopSound(); // 
                            return { action: 'rainbow_split', pos: this.pos, vel: this.vel }; 
                        }
                    }
                }
            }
            return null;
        }
        stopSound() {
            if (this.rollingSound) {
                this.rollingSound.stop();
                this.rollingSound = null;
            }
        }


                /**
         * @method draw
         * @description 分层绘制弹珠 (更新：爆破弹珠专属视觉)
         */
        draw(ctx) {
            if (!this.active) return;
            
            const x = this.pos.x;
            const y = this.pos.y;
            const r = this.radius;
            const buffs = this.getBuffState();
            
            ctx.save();
            ctx.translate(x, y);

            // ==========================================
            //  🔥 混沌闪烁计算 (通用火焰与爆破)
            // ==========================================
            let fireFlicker = 0;
            if (buffs.pyro > 0 || this.def.type === 'explosive') {
                const slow = Math.sin(this.lifeTime * 0.1); 
                const fast = Math.sin(this.lifeTime * 0.8);
                const noise = Math.random() * 0.3;
                fireFlicker = 0.6 + (slow * 0.1) + (fast * 0.1) + noise;
            }

            // ==========================================
            //  LAYER 0: 🔦 Ambient Spotlight (环境光)
            // ==========================================
            let glowColor = '255, 255, 255'; 
            let maxStack = 0;

            if (buffs.pyro > maxStack) { maxStack = buffs.pyro; glowColor = '251, 146, 60'; } // Orange
            if (buffs.cryo > maxStack) { maxStack = buffs.cryo; glowColor = '103, 232, 249'; } // Cyan
            if (buffs.lightning > maxStack) { maxStack = buffs.lightning; glowColor = '216, 180, 254'; } // Purple
            if (buffs.laser > maxStack) { maxStack = buffs.laser; glowColor = '56, 189, 248'; } // Sky
            
            // [修改]：爆破弹珠的专属环境光 (危险的红色)
            if (this.def.type === 'explosive') {
                 glowColor = '239, 68, 68'; // Red-500
                 maxStack = 5; // 强制最大光晕
            } else if (maxStack === 0 && this.def.type === 'rainbow') {
                glowColor = '244, 114, 182'; 
            }

            let baseAlpha = 0.042 + (maxStack * 0.03); 
            let currentAlpha = baseAlpha;
            
            // [修改]：爆破弹珠的光晕会剧烈闪烁
            if (this.def.type === 'explosive') {
                 const strobe = (Math.sin(Date.now() / 50) + 1) / 2; // 高频闪烁
                 currentAlpha = baseAlpha * (0.5 + strobe); // 0.5 ~ 1.5 倍强度
            } else if (buffs.pyro > 0 && maxStack === buffs.pyro) {
                currentAlpha = baseAlpha * fireFlicker;
            } else {
                const breathSpeed = 0.05 + (maxStack * 0.05);
                const breath = (Math.sin(this.lifeTime * breathSpeed) + 1) / 2; 
                currentAlpha = baseAlpha + (breath * 0.04);
            }

            const spotR = r * 30; 
            const spot = ctx.createRadialGradient(0, 0, r, 0, 0, spotR);
            spot.addColorStop(0, `rgba(${glowColor}, ${currentAlpha})`);
            spot.addColorStop(1, `rgba(${glowColor}, 0)`);

            ctx.fillStyle = spot;
            ctx.beginPath(); ctx.arc(0, 0, spotR, 0, Math.PI * 2); ctx.fill();

            // ==========================================
            //  LAYER 1: 🔦 Laser Back Aura (激光背光)
            // ==========================================
            if (buffs.laser > 0) {
                // ... (保持原有的激光绘制逻辑不变) ...
                const laserColor = CONFIG.colors.laser || '#0ea5e9';
                const pulse = (Math.sin(this.lifeTime * 5) + 1) / 1; 
                const sizeMod = 1 + (buffs.laser * 0.15); 
                ctx.save();
                ctx.globalCompositeOperation = 'lighter'; 
                ctx.shadowBlur = (15 + pulse * 10) * sizeMod;
                ctx.shadowColor = laserColor;
                ctx.fillStyle = laserColor;
                ctx.globalAlpha = 0.5 + (pulse * 0.2); 
                ctx.beginPath(); ctx.arc(0, 0, r * (1.1 + pulse * 0.1) * sizeMod, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.9;
                ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI*2); ctx.fill();
                ctx.restore();
            }

            // ==========================================
            //  LAYER 2: Base Ball (球体本体)
            // ==========================================
            
            // [新增/修改]：爆破弹珠专属绘制逻辑 (RedStripe)
            // 它不再和 Pyro 共用逻辑，而是拥有独立的"不稳定核心"外观
            if (this.def.type === 'explosive') {
                // 1. 物理抖动 (Visual Jitter)
                const shake = 1.2;
                ctx.save();
                ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);

                // 2. 警报脉冲 (Strobe)
                const time = Date.now();
                const pulse = (Math.sin(time / 60) + 1) / 2; // 极快
                
                // 颜色循环：暗红 -> 鲜红 -> 纯白 (临界状态)
                let coreColor = '#b91c1c'; // base red
                let shellColor = '#7f1d1d'; // dark shell
                let glowIntensity = 10;
                
                if (pulse > 0.8) {
                    coreColor = '#ffffff'; // Flash White
                    shellColor = '#ef4444'; // Bright Red Shell
                    glowIntensity = 30;
                } else {
                    coreColor = '#ef4444';
                    glowIntensity = 15;
                }

                // 3. 绘制外壳 (Dark Containment)
                const shellGrad = ctx.createRadialGradient(-r*0.4, -r*0.4, 0, 0, 0, r);
                shellGrad.addColorStop(0, shellColor);
                shellGrad.addColorStop(1, '#450a0a'); // Almost black red
                ctx.fillStyle = shellGrad;
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();

                // 4. 绘制不稳定核心 (Unstable Core)
                ctx.shadowBlur = glowIntensity;
                ctx.shadowColor = '#ef4444';
                ctx.fillStyle = coreColor;
                
                // 核心是一个在呼吸的小圆
                const coreSize = r * (0.4 + pulse * 0.2);
                ctx.beginPath(); ctx.arc(0, 0, coreSize, 0, Math.PI*2); ctx.fill();

                // 5. 绘制表面的能量裂纹 (Cracks)
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + pulse * 0.6})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                // 画一个简单的十字裂纹或者 X 形
                ctx.moveTo(-r*0.6, 0); ctx.lineTo(r*0.6, 0);
                ctx.moveTo(0, -r*0.6); ctx.lineTo(0, r*0.6);
                ctx.stroke();

                ctx.restore(); // 结束抖动

            } 
            // [原有逻辑]：Pyro 火焰属性 (保持流体感)
            else if (buffs.pyro > 0) {
                 const bodyGrad = ctx.createRadialGradient(-r*0.3, -r*0.3, 0, 0, 0, r);
                 bodyGrad.addColorStop(0, '#f97316'); 
                 bodyGrad.addColorStop(1, '#9a3412'); 
                 ctx.fillStyle = bodyGrad;
                 ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();

                 // 内部流动的能量 (Internal Plasma)
                 ctx.save();
                 ctx.globalCompositeOperation = 'lighter'; 
                 ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip();
                 const time = this.lifeTime;
                 for(let i=0; i<2; i++) {
                    ctx.save();
                    const dir = i===0 ? 1 : -1;
                    const speed = i===0 ? 1.0 : 0.6;
                    ctx.rotate(time * speed * dir);
                    const plasmaGrad = ctx.createRadialGradient(r*0.4, 0, 0, r*0.4, 0, r*0.8);
                    if (i===0) {
                        plasmaGrad.addColorStop(0, 'rgba(253, 224, 71, 0.5)'); 
                        plasmaGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
                    } else {
                        plasmaGrad.addColorStop(0, 'rgba(251, 146, 60, 0.4)'); 
                        plasmaGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
                    }
                    ctx.fillStyle = plasmaGrad;
                    ctx.beginPath();
                    ctx.ellipse(r*0.2, 0, r*0.9, r*0.6, 0, 0, Math.PI*2);
                    ctx.fill();
                    ctx.restore();
                 }
                 ctx.restore();
                 
                 // 热浪边缘
                 const pulse = (Math.sin(this.lifeTime * 3) + 1) / 2;
                 const heatSize = 1.05 + (buffs.pyro * 0.05) + (pulse * 0.05);
                 const heatGrad = ctx.createRadialGradient(0, 0, r, 0, 0, r * heatSize);
                 heatGrad.addColorStop(0, 'rgba(249, 115, 22, 0.5)');
                 heatGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
                 ctx.fillStyle = heatGrad;
                 ctx.beginPath(); ctx.arc(0, 0, r * heatSize, 0, Math.PI*2); ctx.fill();

            }else if (this.def.type === 'resonance') {
                const pulse = (Math.sin(this.lifeTime * 0.2) + 1) / 2; // 呼吸节奏
                
                // 1. 绘制外部波纹 (Ripple)
                ctx.strokeStyle = CONFIG.colors.resonanceRipple;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.6 - pulse * 0.3;
                ctx.beginPath();
                // 波纹从小变大
                ctx.arc(0, 0, r * (1.0 + pulse * 0.4), 0, Math.PI * 2);
                ctx.stroke();
                
                // 2. 绘制核心 (Core)
                const grad = ctx.createRadialGradient(-r*0.3, -r*0.3, 0, 0, 0, r);
                grad.addColorStop(0, '#fcd34d'); // 亮黄
                grad.addColorStop(1, '#b45309'); // 深琥珀
                ctx.fillStyle = grad;
                ctx.globalAlpha = 1.0;
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

                // 3. 内部符号 (类似 wifi 信号或音叉)
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, r*0.5, -Math.PI/4, Math.PI/4); // 右括号
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, r*0.5, Math.PI*0.75, Math.PI*1.25); // 左括号
                ctx.stroke();
            } else {
                 // ... (其他普通/彩虹/套娃弹珠逻辑保持不变) ...
                 let baseLight = '#f8fafc';
                 let baseDark = '#334155';
                 
                 if (this.def.type === 'rainbow') {
                     const grad = ctx.createLinearGradient(-r, -r, r, r);
                     grad.addColorStop(0, '#fca5a5'); grad.addColorStop(0.5, '#facc15'); grad.addColorStop(1, '#60a5fa');
                     ctx.fillStyle = grad; 
                     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
                 } 
                 else if (this.def.type === 'matryoshka') {
                     baseLight = '#f5d0fe'; baseDark = '#86198f';
                     this._drawBaseBall(ctx, r, baseLight, baseDark);
                     ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
                     ctx.beginPath(); ctx.arc(0, 0, r-2, 0, Math.PI*2); ctx.stroke();
                 } 
                 else {
                    const map = {
                        'bounce': ['#dcfce7', '#15803d'],
                        'pierce': ['#fee2e2', '#b91c1c'],
                        'scatter': ['#fef9c3', '#a16207'],
                        'damage': ['#f3e8ff', '#7e22ce'],
                        'laser':  ['#e0f2fe', '#0369a1'],
                        'wind':   ['#d1fae5', '#047857'],
                        'lightning': ['#f3e8ff', '#7e22ce'],
                        'cryo': ['#e0f2fe', '#0369a1'],
                        'pyro': ['#ffedd5', '#ea580c'],
                        'resonance': ['#fef3c7', '#d97706'],
                    };
                     if (this.def.type && map[this.def.type]) {
                         baseLight = map[this.def.type][0];
                         baseDark = map[this.def.type][1];
                     }
                     this._drawBaseBall(ctx, r, baseLight, baseDark);
                 }
            }
            
            // 绘制顶部高光 (除了爆破弹，因为爆破弹已经有核心高光了)
            if (this.def.type !== 'explosive') {
                this._drawHighlight(ctx, r);
            }

            // ==========================================
            //  LAYER 3: ❄️ Cryo (Overlay)
            // ==========================================
            if (buffs.cryo > 0) {
                // ... (保持原有的冰霜绘制逻辑) ...
                const alpha = 0.2 + (buffs.cryo * 0.12);
                const iceGrad = ctx.createRadialGradient(-r*0.4, -r*0.4, r*0.1, 0, 0, r);
                iceGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
                iceGrad.addColorStop(1, `rgba(165, 243, 252, ${alpha * 1.2})`);
                ctx.fillStyle = iceGrad;
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
                ctx.globalCompositeOperation = 'overlay';
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.6, alpha)})`;
                for(let i=0; i<3; i++) {
                     const angle = (this.visualSeed + i * 2.5 + this.lifeTime * 0.02) % (Math.PI*2);
                     const dist = r * 0.6;
                     ctx.beginPath(); ctx.arc(Math.cos(angle)*dist, Math.sin(angle)*dist, r*0.25, 0, Math.PI*2); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
            }

            // ==========================================
            //  LAYER 4: ⚡ Lightning (Top Effect)
            // ==========================================
            if (buffs.lightning > 0) {
                 // ... (保持原有的闪电绘制逻辑) ...
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = 'lighter'; 
                const triggerChance = 0.2 + (buffs.lightning * 0.15);
                if (Math.random() < triggerChance) {
                    const arcCount = 1 + Math.floor(Math.random() * (buffs.lightning * 0.6));
                    ctx.shadowBlur = 10 + buffs.lightning * 3; 
                    ctx.shadowColor = '#a855f7'; 
                    ctx.strokeStyle = '#e9d5ff'; 
                    for (let k = 0; k < arcCount; k++) {
                        const startAngle = Math.random() * Math.PI * 2;
                        const arcLen = 0.8 + Math.random() * 0.8; 
                        ctx.beginPath();
                        const segments = 4 + Math.floor(Math.random() * 3);
                        for (let i = 0; i <= segments; i++) {
                            const t = i / segments;
                            const currentAngle = startAngle + t * arcLen;
                            const jitter = (Math.random() - 0.5) * (r * 0.4); 
                            const dist = r * 1.25 + jitter; 
                            const px = Math.cos(currentAngle) * dist;
                            const py = Math.sin(currentAngle) * dist;
                            if (i === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.lineWidth = 1.0 + Math.random() * 1.5;
                        ctx.stroke();
                    }
                    if (Math.random() < 0.3) {
                        ctx.fillStyle = 'rgba(216, 180, 254, 0.4)'; 
                        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
                    }
                }
                ctx.restore();
            }
            
            // ==========================================
            //  LAYER 5: 🌪️ Wind Blades (风刃环绕特效)
            // ==========================================
            // 检查是否有wind属性
            const hasWind = this.session && this.session.collected && this.session.collected.some(item => {
                const type = (typeof item === 'string') ? item : item.type;
                return type === 'wind';
            });
            
            if (hasWind) {
                ctx.save();
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#34d399';
                
                // 计算wind属性的数量
                let windCount = 0;
                if (this.session && this.session.collected) {
                    this.session.collected.forEach(item => {
                        const type = (typeof item === 'string') ? item : item.type;
                        if (type === 'wind') windCount++;
                    });
                }
                
                const bladeCount = Math.min(3 + windCount, 6);
                const orbitRadius = r * 1.5;
                
                for (let i = 0; i < bladeCount; i++) {
                    const angle = this.windBladeAngle + (i * Math.PI * 2 / bladeCount);
                    const bladeX = Math.cos(angle) * orbitRadius;
                    const bladeY = Math.sin(angle) * orbitRadius;
                    
                    ctx.save();
                    ctx.translate(bladeX, bladeY);
                    ctx.rotate(angle + Math.PI / 2);
                    
                    ctx.strokeStyle = '#d1fae5';
                    ctx.fillStyle = 'rgba(209, 250, 229, 0.3)';
                    ctx.lineWidth = 1.2;
                    ctx.lineCap = 'round';
                    
                    const bladeLength = r * 0.6;
                    const bladeCurve = r * 0.25;
                    
                    ctx.beginPath();
                    ctx.moveTo(-bladeLength/2, 0);
                    ctx.quadraticCurveTo(0, bladeCurve, bladeLength/2, 0);
                    ctx.quadraticCurveTo(0, bladeCurve * 0.5, -bladeLength/2, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.restore();
                }
                
                ctx.restore();
            }
            
            ctx.restore();
        }

   _drawBaseBall(ctx, r, cLight, cDark) {
            const grad = ctx.createRadialGradient(-r*0.3, -r*0.3, r*0.1, 0, 0, r);
            grad.addColorStop(0, cLight);
            grad.addColorStop(1, cDark);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        }

        _drawHighlight(ctx, r) {
            ctx.beginPath();
            ctx.ellipse(-r*0.35, -r*0.35, r*0.3, r*0.2, Math.PI/4, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fill();
        }
    }

// ==================== Enemy 类 ====================
class Enemy {
    constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = []) {
        this.pos = new Vec2(x, y); 
        this.width = width; 
        this.height = height; 
        this.hp = hp;       
        this.maxHp = maxHp; 

        // [新增] 护盾充能层数 (默认为0，生成时在core.js中赋值)
        this.shieldCharges = 0;

        // --- [新增/修改] 血条动画相关 ---
        this.displayHp = this.hp;      // 真实血条的显示值 (平滑过渡)
        this.delayedHp = this.hp;      // 白色延迟血条的值
        this.greenHp = this.hp;        // [新增] 绿色回血血条的值
        this.whiteBarTimer = 0;        // 延迟缓冲计时器
        this.greenBarTimer = 0;        // [新增] 绿色回血计时器

        this.hpDropTimer = 0;
        this.active = true; 
        this.type = type;
        this.affixes = affixes;
        // [修复] 如果词条中包含 elite，则将 type 设置为 elite 以触发对应的视觉效果
        if (this.affixes.includes('elite')) this.type = 'elite';
        this.hitTimer = 0; 
        this.dropTargetY = y; 
        this.justSpawned = true; 
        this.temp = 0; 
        this.bumpOffsetY = 0; 
        this.isFrozenCurrentTurn = false; 

        // 视觉种子
        this.visualSeed = Math.random(); 
        
        this.hasActedThisTurn = false;
        this.actionPhase = 'idle'; // 'idle', 'telegraphing', 'acting'
        this.telegraphTimer = 0;   // 预警倒计时
        this.actionIcon = '';      // 即将触发的动作图标
        this.actionName = '';      // 动作名称

        this.swordMarks = 0; // 剑痕标记层数
        this.markTimer = 0;  // 标记持续时间
        this.swordMarks = 0; 
        this.markTimer = 0;  
        this.stuckSwords = []; // [新增] 存储插在身上的子剑对象
        this.swordCracks = [];
        this.fissures = [];
        const crackCount = 3; // 裂纹数量
        
        if (this.markTimer > 0) {
            this.markTimer -= timeScale;
            if (this.markTimer <= 0) this.swordMarks = 0;
        }


        for(let i=0; i<crackCount; i++) {
            const points = [];
            // 1. 随机起点 (在边界上)
            const angle = Math.random() * Math.PI * 2;
            // 半径略小于宽的一半，保证在身体内部
            const startDist = (width/2) * 0.8; 
            const start = new Vec2(Math.cos(angle) * startDist, Math.sin(angle) * startDist);
            points.push(start);
            
            // 2. 随机终点 (在对面)
            // 角度偏移 120~240度，保证裂纹是横穿的
            const endAngle = angle + Math.PI + (Math.random() - 0.5); 
            const endDist = (width/2) * 0.8;
            const end = new Vec2(Math.cos(endAngle) * endDist, Math.sin(endAngle) * endDist);
            
            // 3. 生成 2-3 个中间断点 (Jitter Nodes)
            // 模拟岩石/冰层不规则的受力断裂
            const steps = 3;
            for(let j=1; j<steps; j++) {
                const t = j / steps;
                // 线性插值位置
                const lerpX = start.x + (end.x - start.x) * t;
                const lerpY = start.y + (end.y - start.y) * t;
                
                // 垂直于路径方向的随机扰动
                const jitter = (Math.random() - 0.5) * (width * 0.4); 
                
                points.push(new Vec2(lerpX + jitter, lerpY + jitter));
            }
            points.push(end);
            this.fissures.push(points);
        }

        this.hasActedThisTurn = false;
        this.scanFeedbackTimer = 0;
        this.shieldHitTimer = 0; // 护盾受击反馈计时器
    }
    
    update(timeScale, game) {
        if (!this.active) return;

        // --- [新增] 预警状态更新 ---
        if (this.actionPhase === 'telegraphing') {
            this.telegraphTimer -= timeScale;
            // 预警阶段剧烈震动
            this.bumpOffsetY = (Math.random() - 0.5) * 6; 
            
            if (this.telegraphTimer <= 0) {
                this.executeTurnAction(game);
                this.actionPhase = 'idle';
                this.bumpOffsetY = 0;
            }
            return; // 预警期间不处理其他移动逻辑
        }

        // 移动逻辑：吸附目标位置
        if (this.pos.y < this.dropTargetY) {
            this.pos.y += 3 * timeScale;
            if (this.pos.y > this.dropTargetY) this.pos.y = this.dropTargetY;
        }
        
        if (this.hitTimer > 0) this.hitTimer -= timeScale;
        if (this.shieldHitTimer > 0) this.shieldHitTimer -= timeScale;
        if (this.justSpawned) { this.justSpawned = false; }
        
        // 弹跳恢复
        if (this.bumpOffsetY < 0) {
            this.bumpOffsetY += 1 * timeScale;
            if (this.bumpOffsetY > 0) this.bumpOffsetY = 0;
        } else if (this.bumpOffsetY > 0) { // 增加向下回弹的逻辑(冰冻时)
            this.bumpOffsetY -= 1 * timeScale;
            if (this.bumpOffsetY < 0) this.bumpOffsetY = 0;
        }
        // 1. 真实血条更新逻辑 (Damage Scrolling vs Healing Animation)
        // [优化]：将伤害滚动与回血动画分离，防止回血时被强制 Snap 导致动画丢失
        
        if (this.displayHp > this.hp) {
            // Case A: 受到伤害 (Damage) -> 向下滚动
            const diff = this.displayHp - this.hp;
            if (diff > 20) {
                this.displayHp -= diff * 0.2 * timeScale;
                this.hpDropTimer = 0;
            } else {
                this.hpDropTimer += timeScale;
                if (this.hpDropTimer >= Math.max(1, 5 - Math.floor(diff / 5))) {
                    this.hpDropTimer = 0;
                    this.displayHp -= 1;
                }
            }
            // 防止过冲
            if (this.displayHp < this.hp) this.displayHp = this.hp;
            
        } else if (this.displayHp < this.hp) {
            // Case B: 正在回血 (Healing) -> 向上增长
            // [关键]：此处不做任何操作，也不重置 displayHp！
            // 具体的增长逻辑 (Lerp) 交给下方的 "绿色回血血条逻辑" 统一处理
            this.hpDropTimer = 0;
            
        } else {
            // Case C: 稳定状态 (Stable)
            this.displayHp = this.hp;
            this.hpDropTimer = 0;
        }

        // 2. 白色延迟血条逻辑 (White Bar)
        if (this.whiteBarTimer > 0) {
            this.whiteBarTimer--;
        } else {
            this.delayedHp = lerp(this.delayedHp, this.displayHp, 0.25);
            if (Math.abs(this.delayedHp - this.displayHp) < 0.1) {
                this.delayedHp = this.displayHp;
            }
        }
        // 治疗时，白条跟随真实血条上涨，不应滞后
        if (this.delayedHp < this.displayHp) {
            this.delayedHp = this.displayHp;
        }

        // 3. 绿色回血血条逻辑 (Green Bar & Healing Animation)
        
        // [新增]：如果受到伤害 (当前血量 < 预期绿条)，立即中断回血预览，防止绿条悬空
        if (this.hp < this.greenHp) {
            this.greenHp = this.hp;
            this.greenBarTimer = 0;
        }

        // 检测回血触发
        if (this.hp > this.greenHp) {
            this.greenHp = this.hp;
            this.greenBarTimer = 45; // 缓冲时间，展示绿条
        }

        if (this.greenBarTimer > 0) {
            this.greenBarTimer -= timeScale;
            // 缓冲期：displayHp 暂停增长，让玩家看清绿色的 "预期回血量"
        } else {
            // 缓冲结束：displayHp 追赶真实 hp
            if (this.displayHp < this.hp) {
                this.displayHp = lerp(this.displayHp, this.hp, 0.1 * timeScale);
                // 吸附
                if (Math.abs(this.hp - this.displayHp) < 0.5) {
                    this.displayHp = this.hp;
                    this.greenHp = this.hp;
                }
            } else {
                // 稳定后同步
                this.greenHp = this.hp;
            }
        }
        this.updateTempParticles(timeScale);
    }

    addSwordCrack(relPos, angle) {
        // 限制裂纹数量，防止过多导致性能问题
        if (this.swordCracks.length > 5) this.swordCracks.shift();
        
        this.swordCracks.push({
            x: relPos.x,
            y: relPos.y,
            angle: angle,
            scale: 0.8 + Math.random() * 0.4
        });
    }
    /**
     * @method updateTempParticles
     * @description 处理随温度产生的持续粒子 (Mist巨型化版)
     */
    updateTempParticles(timeScale) {
        const absTemp = Math.abs(this.temp);
        if (!this.active || this.pos.y > game.height) return;

        // === 🔥 高温特效 (Heat) ===
        if (this.temp >= 34) {
            
            // 1.  燃烧前的黑烟 -> 改为 Mist (模拟热浪/蒸汽)
            // 概率随温度升高
            if (Math.random() < (0.05 + (this.temp / 200)) * timeScale) {
                const spawnX = this.pos.x + (Math.random() - 0.5) * this.width * 0.8;
                const spawnY = this.pos.y - this.height * 0.4;
                
                // 颜色：使用纯黑色，带一点透明度
                // 必须包含 '0,0,0' 以便让 Particle.draw 识别并关闭混合模式
                const smokeColor = `rgba(0, 0, 0, ${0.4 + Math.random() * 0.3})`;
                
                const heatSmoke = new Particle(spawnX, spawnY, smokeColor, 'mist');
                heatSmoke.vel.y = -0.8 - Math.random() * 0.8; // 上升速度稍快
                heatSmoke.vel.x = (Math.random() - 0.5) * 0.5; // 稍微左右飘
                heatSmoke.size = this.width * 0.35; // 大团烟雾
                game.particles.push(heatSmoke);
            }

            // 2.  燃烧时的黑烟 -> 改为 Ember (燃烧的余烬/火星)
            if (this.temp >= 100) {
                const count = Math.ceil((this.temp - 90) / 20); 
                for(let i=0; i<count; i++) {
                    if(Math.random() < 0.4 * timeScale) {
                        // 位置：全身随机冒出
                        const px = this.pos.x + (Math.random() - 0.5) * this.width;
                        const py = this.pos.y + (Math.random() - 0.5) * this.height;
                        
                        // 颜色：亮橙色/金色
                        // 类型：'ember' (一种飘忽不定的火星)
                        // 注意：确保 Particle 类能处理 'ember'，通常 'ember' 和 'spark' 类似但更轻
                        // 这里我们直接用 'spark' 的物理逻辑，但颜色调得更亮
                        game.spawn_createParticle(px, py, '#fbbf24', 'spark'); 
                        
                        // 偶尔加一个颜色深一点的 'ember' 颗粒
                         if (Math.random() < 0.3) {
                            game.spawn_createParticle(px, py, '#f97316', 'ember');
                        }
                    }
                }
            }
        }

        // === ❄️ 低温特效 (Cold) - (保持之前的 Mist 优化逻辑) ===
        if (this.temp <= -34) {
            const freezeIntensity = (absTemp - 34) / 66; 
            const sizeFactor = this.width / 100; 
            const baseChance = 0.2 * sizeFactor;  
            const mistChance = (baseChance + freezeIntensity * 0.2);

            let chancePool = mistChance * timeScale;
            while(chancePool > 0) {
                if (Math.random() < chancePool) {
                    const spawnX = this.pos.x + (Math.random() - 0.5) * this.width * 0.9;
                    const spawnY = this.pos.y + (Math.random() - 0.2) * this.height; 
                    
                    // 这里的 mist 是白色的冷气
                    const mist = new Particle(spawnX, spawnY, null, 'mist');
                    mist.size = this.width * (0.15 + Math.random() * 0.1); 
                    mist.size *= (1 + freezeIntensity * 0.2);
                    mist.vel = new Vec2((Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.5); // 下沉
                    mist.decay *= 1.5; 
                    game.particles.push(mist);
                }
                chancePool -= 1.0; 
            }
            
            if (this.temp <= -80 && Math.random() < 0.08 * timeScale) {
                const shard = new Particle(this.pos.x + (Math.random() - 0.5) * this.width, this.pos.y, '#a5f3fc', 'shard');
                shard.size = 2.5; 
                game.particles.push(shard);
            }
        }
    }

    advance(amount) { this.dropTargetY += amount; }

    // --- [核心修改] 第一步：启动预警 (Trigger Telegraph) ---
    startTurnAction(game) {
        // 如果被冻结，直接跳过
        if (this.isFrozenCurrentTurn) {
            this.playFreezeBlockEffect(game);
            
            // ============================================================
            // [新增] 冰属性脆化机制 (Cryo Brittleness)
            // 机制：被冰冻时，根据温度强度永久削减血量上限
            // 公式：削减百分比 = 温度绝对值 / 10 (例如 -100度 -> 削减 10%)
            // ============================================================
            const freezePercent = Math.abs(this.temp) / 10;
            
            // 设置一个最小触发阈值 (例如 1% 即 -10度) 避免无意义的浮点数计算
            if (freezePercent >= 1.0) {
                const ratio = 1 - (freezePercent / 100);
                
                // 1. 削减最大血量 (Max HP Wither)
                const oldMax = this.maxHp;
                this.maxHp = Math.max(1, Math.floor(this.maxHp * ratio));
                
                // 2. 当前血量按同比例削减 (Proportional Reduction)
                // 这保证了敌人不会因为上限降低而导致当前血量看起来"变多"了
                this.hp = Math.max(1, Math.floor(this.hp * ratio));
                
                // 3. 同步缩放视觉血条 (Visual Bars Sync)
                // 确保动画平滑，不会出现血条突然跳满的情况
                this.displayHp *= ratio;
                this.delayedHp *= ratio; // 白条也同步
                this.greenHp *= ratio;   // 绿条也同步
                
                // 4. 视觉反馈 (Floating Text)
                const loss = oldMax - this.maxHp;
                if (loss > 0) {
                    // 显示 "脆弱 -10%" 这种提示
                    game.spawn_createFloatingText(
                        this.pos.x, 
                        this.pos.y - 50, 
                        `❄️脆弱 -${freezePercent.toFixed(1)}% HP`, 
                        "#a5f3fc" // 亮青色
                    );
                    
                    // 额外生成一点冰渣特效
                    for(let i=0; i<3; i++) {
                        const p = new Particle(this.pos.x, this.pos.y, '#a5f3fc', 'shard');
                        p.vel.y = -2; // 向上崩裂
                        if (typeof game.particles !== 'undefined') game.particles.push(p);
                    }
                }
            }
            // ============================================================

            this.hasActedThisTurn = true;
            return;
        }

        // 确定本回合要触发的主要动作 (用于显示图标)
        // 优先级：狂暴 > 治疗 > 吞噬 > 跳跃 > 移动
        this.actionIcon = '';
        this.actionName = '';
        const afx = CONFIG.balance.affixes;

        if (this.temp > 0 && this.affixes.includes('berserk')) {
             if (Math.random() < (this.temp / 100) * afx.berserkChanceMult) {
                 this.actionIcon = '😡'; this.actionName = '狂暴';
             }
        }
        
        if (!this.actionIcon && this.affixes.includes('healer')) {
             this.actionIcon = '💖'; this.actionName = '治癒';
        }
        
        if (!this.actionIcon && this.affixes.includes('devour')) {
             // 吞噬有概率
             if (Math.random() < afx.devourChance) {
                 this.actionIcon = '👅'; this.actionName = '吞噬';
             }
        }

        // 检测是否需要跳跃 (前方受阻)
        if (!this.actionIcon && this.affixes.includes('jump')) {
            let moveAmount = game.enemyHeight;
            const targetY = this.dropTargetY + moveAmount;
            const isBlocked = game.calc_isAreaOccupied(this.pos.x, targetY, this.width * 0.8, this.height * 0.8, this);
            if (isBlocked) {
                this.actionIcon = '🦘'; this.actionName = '跳躍';
            }
        }

        if (!this.actionIcon && this.affixes.includes('clone') && Math.random() < afx.cloneChanceTurn) {
             this.actionIcon = '🦠'; this.actionName = '增殖';
        }

        // 如果没有任何特殊动作，就是普通移动，不需要强调预警，或者给一个箭头
        if (!this.actionIcon) {
            // 普通移动不需要太长的延迟，直接行动
            this.executeTurnAction(game);
        } else {
            // 特殊动作：进入预警状态
            this.actionPhase = 'telegraphing';
            this.telegraphTimer = 35; // 约 0.6 秒的预警时间
            // 播放一个“蓄力”音效
            audio.playTone(200, 'sine', 0.1, 0.1); 
        }
    }

    // --- [核心修改] 第二步：执行动作 (Execute Action) ---
    executeTurnAction(game) {
        const afx = CONFIG.balance.affixes;
        let actionCount = 1;
        
        // 狂暴判定
        if (this.affixes.includes('haste')) actionCount = 2;
        else if (this.actionName === '狂暴') actionCount = 2;

        for (let i = 0; i < actionCount; i++) {
            const isSecondAction = (i === 1);

            // --- 1. 再生 ---
            if(this.affixes.includes('regen')) {
                const heal = Math.floor(this.maxHp * afx.regenPercent) || 1;
                if(this.hp < this.maxHp) {
                    this.hp = Math.min(this.maxHp, this.hp + heal);
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 30, `+${heal}`, '#4ade80');
                    game.spawn_createParticle(this.pos.x, this.pos.y, '#4ade80', 'spark');
                    audio.playEffect('regen');
                }
            }

            // --- 2. 治疗 ---
            if (this.affixes.includes('healer')) {
                const range = this.width * afx.healerRange;
                let healedCount = 0;
                game.enemies.forEach(other => {
                    if (other !== this && other.active && other.hp < other.maxHp && this.pos.dist(other.pos) < range) {
                        const healAmt = Math.ceil(other.maxHp * afx.healerPercent);
                        // [修复] 回血前同步 greenHp，确保动画正常触发
                        if (other.hp > other.greenHp) other.greenHp = other.hp;
                        other.hp = Math.min(other.maxHp, other.hp + healAmt);
                        game.spawn_createParticle(other.pos.x, other.pos.y, '#f472b6', 'spark');
                        game.spawn_createFloatingText(other.pos.x, other.pos.y - 20, `+${healAmt}`, '#f472b6');
                        healedCount++;
                    }
                });
                if (healedCount > 0) {
                     audio.playEffect('regen');
                     game.spawn_createShockwave(this.pos.x, this.pos.y, '#f472b6');
                }
            }

            // --- 3. 吞噬 ---
            if (this.actionName === '吞噬') {
                 const range = this.width * afx.devourRange;
                 const neighbors = game.enemies.filter(e => 
                     e !== this && e.active && e.type !== 'boss' && this.pos.dist(e.pos) < range
                 );
                 if (neighbors.length > 0) {
                     const victim = neighbors[Math.floor(Math.random() * neighbors.length)];
                     const absorbHp = victim.hp;
                     const absorbMax = victim.maxHp;
                     this.maxHp += absorbMax;
                     this.hp += absorbHp;
                     victim.affixes.forEach(af => { if (!this.affixes.includes(af)) this.affixes.push(af); });
                     const isDead = victim.takeDamage(99999); 
                     if (isDead) game.spawn_addScore(absorbMax); 
                     game.spawn_createFloatingText(this.pos.x, this.pos.y - 40, "DEVOUR!", "#ef4444");
                     game.spawn_createParticle(victim.pos.x, victim.pos.y, '#ef4444', 'mist'); 
                     game.spawn_createShockwave(this.pos.x, this.pos.y, '#ef4444');
                     audio.playEffect('split');
                 }
            }

            // --- 4. 增殖 ---
            if(this.actionName === '增殖') {
                game.spawn_triggerCloneSpawn(this);
            }

            if (isSecondAction) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, "⚡DOUBLE!", "#facc15");
            }

            // --- 移动与跳跃 ---
            let moveAmount = game.enemyHeight;
            const targetY = this.dropTargetY + moveAmount;
            const isBlocked = game.calc_isAreaOccupied(this.pos.x, targetY, this.width * 0.8, this.height * 0.8, this);

            if (!isBlocked) {
                this.advance(moveAmount);
            } else {
                if (this.affixes.includes('jump')) {
                    const jumpTargetY = this.dropTargetY + (moveAmount * afx.jumpRows);
                    const isJumpBlocked = game.calc_isAreaOccupied(this.pos.x, jumpTargetY, this.width * 0.8, this.height * 0.8, this);
                    if (!isJumpBlocked) {
                        this.advance(moveAmount * 2);
                        this.bumpOffsetY = -30; 
                        game.spawn_createFloatingText(this.pos.x, this.pos.y, "JUMP!", "#38bdf8");
                        game.spawn_createParticle(this.pos.x, this.pos.y, '#38bdf8', 'mist'); 
                        audio.playEffect('split');
                    } else {
                        if (i === 0) {
                            this.bumpOffsetY = -10;
                            if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, "⛔ BLOCKED", "#ef4444");
                        }
                    }
                } else {
                    if (i === 0) {
                        this.bumpOffsetY = -10;
                        if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, "⛔ BLOCKED", "#ef4444");
                    }
                }
            }
        }
        
        this.hasActedThisTurn = true;
    }

    performTurnActionAndMove(game) {
        const afx=CONFIG.balance.affixes
        let actionCount = 1;
        if (this.affixes.includes('haste')) actionCount = 2;
        else if (this.temp > 0 && this.temp < 100 && this.affixes.includes('berserk')) {
            if (Math.random() < (this.temp / 100) * afx.berserkChanceMult) actionCount = 2;
        }

        if (this.isFrozenCurrentTurn) {
            actionCount = 0;
            this.playFreezeBlockEffect(game);
        }

        for (let i = 0; i < actionCount; i++) {
            const isSecondAction = (i === 1);
            
            // --- 1. 再生 (Regen) ---
            if(this.affixes.includes('regen')) {
                const heal = Math.floor(this.maxHp * afx.regenPercent) || 1;
                if(this.hp < this.maxHp) {
                    this.hp = Math.min(this.maxHp, this.hp + heal);
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 30, `+${heal}`, '#4ade80');
                    game.spawn_createParticle(this.pos.x, this.pos.y, '#4ade80', 'spark');
                    audio.playEffect('regen');
                }
            }

            // --- 2. 範圍治療 (Healer) [新增] ---
            if (this.affixes.includes('healer')) {
                // 定義範圍：自身寬度的 1.5 倍 (大約覆蓋周圍 8 格)
                const range = this.width * afx.healerRange;
                let healedCount = 0;
                
                game.enemies.forEach(other => {
                    if (other !== this && other.active && other.hp < other.maxHp && this.pos.dist(other.pos) < range) {
                            const healAmt = Math.ceil(other.maxHp * afx.healerPercent); // [修改]
                    
                        other.hp = Math.min(other.maxHp, other.hp + healAmt);
                        
                        // 特效：發射治療粒子飛向隊友
                        game.spawn_createParticle(other.pos.x, other.pos.y, '#f472b6', 'spark'); // 粉色粒子
                        game.spawn_createFloatingText(other.pos.x, other.pos.y - 20, `+${healAmt}`, '#f472b6');
                        healedCount++;
                    }
                });
                
                if (healedCount > 0) {
                     audio.playEffect('regen'); // 復用治療音效
                     game.spawn_createShockwave(this.pos.x, this.pos.y, '#f472b6'); // 自身粉色波動
                }
            }

            // --- 3. 吞噬 (Devour) [新增] ---
            // 50% 概率觸發，且必須不是滿血或者想獲取詞條
            if (this.affixes.includes('devour') && Math.random() < afx.devourChance) {
                     const range = this.width * afx.devourRange;
                 // 尋找鄰居 (不能吞噬 Boss)
                 const neighbors = game.enemies.filter(e => 
                     e !== this && e.active && e.type !== 'boss' && this.pos.dist(e.pos) < range
                 );

                 if (neighbors.length > 0) {
                     const victim = neighbors[Math.floor(Math.random() * neighbors.length)];
                     
                     // 吞噬數值
                     const absorbHp = victim.hp;
                     const absorbMax = victim.maxHp;
                     
                     this.maxHp += absorbMax;
                     this.hp += absorbHp;
                     
                     victim.affixes.forEach(af => {
                        if (!this.affixes.includes(af)) this.affixes.push(af);
                    });

                    // 2. 【核心修正】：调用带逻辑的死亡
                    // 使用 victim.takeDamage 触发正常的死亡逻辑（加分、上报、特效）
                    // 传递一个极高的数值确保它死亡
                    const isDead = victim.takeDamage(99999); 
                    
                    if (isDead) {
                        game.spawn_addScore(absorbMax); // 补偿吞噬者的分数
                    }

                    // 3. 特效反馈
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 40, "DEVOUR!", "#ef4444");
                    game.spawn_createParticle(victim.pos.x, victim.pos.y, '#ef4444', 'mist'); 
                    game.spawn_createShockwave(this.pos.x, this.pos.y, '#ef4444');
                    audio.playEffect('split');
                 }
            }

            // --- 4. 增殖 (Clone) ---
            if(this.affixes.includes('clone') && Math.random() < afx.cloneChanceTurn) {
                    game.spawn_triggerCloneSpawn(this);
                }

            if (isSecondAction) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, "⚡DOUBLE!", "#facc15");
            }

            // --- 移動與跳躍邏輯 ---
            let moveAmount = game.enemyHeight;
            const targetY = this.dropTargetY + moveAmount;
            
            // 檢查前方是否被阻擋
            const isBlocked = game.calc_isAreaOccupied(this.pos.x, targetY, this.width * 0.8, this.height * 0.8, this);

            if (!isBlocked) {
                // 正常移動
                this.advance(moveAmount);
            } else {
                // --- 5. 跳躍 (Jump) [新增] ---
                // 如果被阻擋，且擁有 jump 詞條，檢查下下個格子
                if (this.affixes.includes('jump')) {
                    // [修改] 跳跃行数 (jumpRows)
                    const jumpTargetY = this.dropTargetY + (moveAmount * afx.jumpRows);
                    const isJumpBlocked = game.calc_isAreaOccupied(this.pos.x, jumpTargetY, this.width * 0.8, this.height * 0.8, this);
                    
                    if (!isJumpBlocked) {
                        // 執行跳躍
                        this.advance(moveAmount * 2);
                        this.bumpOffsetY = -30; // 視覺上跳得更高
                        game.spawn_createFloatingText(this.pos.x, this.pos.y, "JUMP!", "#38bdf8");
                        game.spawn_createParticle(this.pos.x, this.pos.y, '#38bdf8', 'mist'); // 殘影
                    } else {
                        // 跳躍也被阻擋，撞牆
                        if (i === 0) {
                            this.bumpOffsetY = -10;
                            if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, "⛔ BLOCKED", "#ef4444");
                        }
                    }
                } else {
                    // 沒有跳躍詞條，正常撞牆
                    if (i === 0) {
                        this.bumpOffsetY = -10;
                        if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, "⛔ BLOCKED", "#ef4444");
                    }
                }
            }
        }
    }

    playFreezeBlockEffect(game) {
        this.bumpOffsetY = 6; 
        game.spawn_createFloatingText(this.pos.x, this.pos.y, "❄️FROZEN", "#06b6d4");
        
        const mistCount = 4 + Math.floor(this.width / 15); 
        for(let i=0; i<mistCount; i++) {
            const spawnX = this.pos.x + (Math.random() - 0.5) * this.width * 0.8;
            const spawnY = this.pos.y + this.height * 0.4; 
            const mist = new Particle(spawnX, spawnY, null, 'mist');
            const dirX = (spawnX - this.pos.x) / (this.width/2); 
            mist.vel = new Vec2(dirX * 1.5, 1.0); 
            mist.size = this.width * 0.5; 
            mist.life = 1.5; 
            game.particles.push(mist);
        }
        for(let i=0; i<8; i++) {
            const p = new Particle(this.pos.x + (Math.random()-0.5) * this.width, this.pos.y, '#a5f3fc', 'shard');
            // 给予一个向下的初速度，增强撞击感
            p.vel = new Vec2((Math.random()-0.5) * 4, 2 + Math.random() * 3);
            game.particles.push(p);
        }
    }

    playBurnTickEffect(game, dmg) {
        this.hitTimer = 15;
        for(let i=0; i<8; i++) game.spawn_createParticle(this.pos.x, this.pos.y, '#f97316', 'spark');
        for(let i=0; i<3; i++) game.spawn_createParticle(this.pos.x, this.pos.y, 'rgba(0,0,0,0.6)', 'smoke');
        game.spawn_createFloatingText(this.pos.x, this.pos.y, `🔥-${dmg}`, '#fbbf24');
        audio.playEffect('burn_tick');
    }

    playScanFeedback() {
        this.scanFeedbackTimer = 1.0; 
    }

    // [核心修改] 绘制方法：修复冰冻视觉过大和边缘粗糙问题
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); 
        ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
        

        // 预警震动
        if (this.actionPhase === 'telegraphing') {
             const shake = 2.5; 
             ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); 
        }

        // 震动
        if (this.hitTimer > 0) { 
            const shake = this.hitTimer * 0.5; 
            ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); 
        }
        
        const w = this.width - 4; 
        const h = this.height - 4; 
        const r = 6;

        // === Layer 1: 容器裁剪 ===
        ctx.beginPath(); 
        ctx.roundRect(-w/2, -h/2, w, h, r);
        ctx.fillStyle = '#0f172a'; 
        ctx.fill(); 
        ctx.clip(); 

        // === Layer 2: 液体血条 (含延迟白条) ===
        
        // A. 计算高度比例
        const hpRatio = Math.max(0, Math.min(1, this.displayHp / this.maxHp));
        const whiteRatio = Math.max(0, Math.min(1, this.delayedHp / this.maxHp)); // 白色条比例
        const greenRatio = Math.max(0, Math.min(1, this.greenHp / this.maxHp));   // 绿色条比例
        
        const fillHeight = h * hpRatio;
        const whiteHeight = h * whiteRatio; // 白色条高度
        const greenHeight = h * greenRatio; // 绿色条高度
        
        const fillY = (h/2) - fillHeight;
        const whiteY = (h/2) - whiteHeight; // 白色条Y坐标
        const greenY = (h/2) - greenHeight; // 绿色条Y坐标
        
        // B. 绘制白色延迟条 (在彩色条底下)
        if (whiteRatio > hpRatio) {
            ctx.fillStyle = '#ffffff'; 
            ctx.globalAlpha = 0.8;
            ctx.fillRect(-w/2, whiteY, w, whiteHeight);
            ctx.globalAlpha = 1.0;
        }

        // [新增] B2. 绘制绿色回血条 (在彩色条底下)
        if (greenRatio > hpRatio) {
            ctx.fillStyle = '#4ade80'; // 亮绿色
            ctx.globalAlpha = 0.6;
            ctx.fillRect(-w/2, greenY, w, greenHeight);
            ctx.globalAlpha = 1.0;
        }

        // C. 绘制真实彩色条 (盖在白条上面)
        let baseColor = '#475569'; 
        if (this.type === 'elite') baseColor = '#581c87'; 
        if (this.type === 'boss') baseColor = '#7f1d1d';  
        


        // 温度变色逻辑
        if (this.temp > 0) {
            const t = Math.min(1, this.temp / 34);
            baseColor = lerpColor(baseColor, '#ea580c', t); 
        } else if (this.temp < 0) {
            const t = Math.min(1, Math.abs(this.temp) / 34);
            baseColor = lerpColor(baseColor, '#0891b2', t);
        }

        ctx.fillStyle = baseColor; 
        ctx.fillRect(-w/2, fillY, w, fillHeight);
        
        // D. 液面亮边 (保持不变)
        if (hpRatio > 0 && hpRatio < 1) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; 
            ctx.fillRect(-w/2, fillY, w, 2);
        }

        // === Layer 3: 内部覆盖层 (Glow & Mist) - [修改：降低浓度] ===

        // **过热 Stage 3: 内部炙热发光**
        if (this.temp >= 67) {
            const glowAlpha = Math.min(0.6, (this.temp - 60) / 60);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.8);
            grad.addColorStop(0, `rgba(251, 146, 60, ${glowAlpha})`); 
            grad.addColorStop(1, `rgba(251, 146, 60, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(-w/2, -h/2, w, h);
        }

        // **过冷 Stage 2~4: 动态雾化蒙层 (Mist Overlay) - [大幅优化]**
        if (this.temp <= -34) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen'; 
            
            // --- 修改点：大幅降低不透明度 ---
            let mistOpacity = 0;
            // 即使完全冻结，透明度最高也只有 0.5 (原来是 0.9)
            if (this.isFrozenCurrentTurn || this.temp <= -100) mistOpacity = 0.5;
            else mistOpacity = Math.min(0.4, (Math.abs(this.temp) - 30) / 70);

            const time = Date.now() / 2500; 

            // 绘制浮动雾团 (保持逻辑，但颜色更淡)
            const patchCount = 2; // 减少层数
            for(let i=0; i<patchCount; i++) {
                const seed = this.visualSeed * 100 + i;
                const offsetX = Math.sin(seed + time) * (w * 0.25);
                const offsetY = Math.cos(seed + time * 1.2) * (h * 0.25);
                // 稍微减小雾团尺寸
                const size = w * (0.5 + Math.sin(time * 2 + i) * 0.1);

                const grad = ctx.createRadialGradient(offsetX, offsetY, 0, offsetX, offsetY, size);
                // 颜色变得极淡
                grad.addColorStop(0, `rgba(207, 250, 254, ${mistOpacity * 0.4})`); 
                grad.addColorStop(1, `rgba(207, 250, 254, 0)`);
                
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(offsetX, offsetY, size, 0, Math.PI*2); ctx.fill();
            }

            // 全身薄霜 (降低浓度)
            ctx.fillStyle = `rgba(165, 243, 252, ${mistOpacity * 0.15})`;
            ctx.fillRect(-w/2, -h/2, w, h);
            ctx.restore();
        }

        // === Layer 4: 裂纹绘制 (Fissures) - [保持不变] ===

        // **过热 Stage 3**
        if (this.temp >= 67) {
            const crackAlpha = Math.min(1, (this.temp - 60) / 40);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; 
            ctx.strokeStyle = `rgba(255, 255, 255, ${crackAlpha * 0.9})`;
            ctx.shadowColor = '#f97316'; ctx.shadowBlur = 10; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            this.fissures.forEach(path => {
                if (path.length < 2) return;
                ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
                for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
                ctx.stroke();
            });
            ctx.restore();
        }

        
        
        // **过冷 Stage 4**
        if (this.temp <= -67 || this.isFrozenCurrentTurn) {
            const crackAlpha = this.isFrozenCurrentTurn ? 0.8 : Math.min(0.6, (Math.abs(this.temp) - 60) / 40);
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            ctx.strokeStyle = `rgba(255, 255, 255, ${crackAlpha})`;
            ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'bevel';
            this.fissures.forEach(path => {
                if (path.length < 2) return;
                ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
                for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
                ctx.stroke();
            });
            ctx.restore();
        }
        // 检查是否有任何子剑将该敌人作为当前目标 或 在队列中
        const isMarked = typeof game !== 'undefined' && game.sonSwords.some(s => 
            s.active && (s.currentTarget === this || s.targetQueue.includes(this))
        );
        if (isMarked) {
            ctx.save();
            const time = Date.now() / 1000;
            const pulse = Math.sin(time * 10) * 0.2 + 1; // 呼吸脉冲
            
            // 1. 顶部剑标
            ctx.save();
            ctx.translate(0, -this.height/2 - 30 - Math.sin(time * 5) * 5);
            ctx.fillStyle = '#0ea5e9';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#0ea5e9';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('▼', 0, 0); 
            ctx.restore();

            // 2. 身体准星光圈
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // 虚线
            ctx.beginPath();
            ctx.arc(0, 0, (Math.max(this.width, this.height) / 2 + 10) * pulse, 0, Math.PI * 2);
            ctx.stroke();
            
            // 3. 四角准星
            ctx.setLineDash([]); // 实线
            const size = Math.max(this.width, this.height) / 2 + 15;
            const len = 10;
            [[-1,-1], [1,-1], [-1,1], [1,1]].forEach(([sx, sy]) => {
                ctx.beginPath();
                ctx.moveTo(sx * size, sy * (size - len));
                ctx.lineTo(sx * size, sy * size);
                ctx.lineTo(sx * (size - len), sy * size);
                ctx.stroke();
            });
            
            ctx.restore();
        }
        // === Layer 5: 内部边框 (保持不变) ===
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
        if (this.type === 'elite') { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; }
        if (this.type === 'boss') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; }

        // [新增] 预警时边框闪烁白色
        if (this.actionPhase === 'telegraphing') {
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 15;
        }

        ctx.strokeRect(-w/2, -h/2, w, h);
        ctx.shadowBlur = 0; // 重置


        if (this.swordCracks.length > 0) {
            ctx.save();
            ctx.strokeStyle = '#0ea5e9'; // 飞剑的青色
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#0ea5e9';
            
            this.swordCracks.forEach(crack => {
                ctx.save();
                ctx.translate(crack.x, crack.y);
                ctx.rotate(crack.angle);
                ctx.scale(crack.scale, crack.scale);
                
                // 画一个 "X" 或 简单的 "一" 字裂痕
                ctx.beginPath();
                ctx.moveTo(-8, 0);
                ctx.lineTo(8, 0);
                // 稍微加一点分叉
                ctx.moveTo(2, 0); ctx.lineTo(6, -3);
                ctx.moveTo(-2, 0); ctx.lineTo(-5, 3);
                
                ctx.stroke();
                ctx.restore();
            });
            ctx.restore();
        }

        // 文字与图标
        if (this.affixes.length > 0) {
            ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
            let icons = '';
            if(this.affixes.includes('shield')) icons += '🛡️';
            if(this.affixes.includes('haste')) icons += '⚡';
            if(this.affixes.includes('regen')) icons += '💚';
            if(this.affixes.includes('clone')) icons += '🦠';
            if(this.affixes.includes('berserk')) icons += '😡';
            if(this.affixes.includes('healer')) icons += '💖';
            if(this.affixes.includes('devour')) icons += '👅';
            if(this.affixes.includes('jump')) icons += '🦘';
            if(this.affixes.includes('elite')) icons += '💀';
            ctx.textAlign = 'center'; ctx.fillText(icons, 0, -h/2 + 8);
        }
        // [修复] 即使被冻结也显示生命值数字，除非生命值为 0
        if (this.displayHp > 0) {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; 
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
            if (this.displayHp > this.hp + 1) ctx.fillStyle = '#fca5a5';
            ctx.fillText(Math.ceil(this.displayHp), 0, 2);
        }
        
        // 受击闪白
        if (this.hitTimer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.hitTimer / 10 * 0.6})`;
            ctx.fillRect(-w/2, -h/2, w, h);
        }

        // --- [新增] 护盾受击视觉反馈 (放大虚化的护盾) ---
        if (this.shieldHitTimer > 0) {
            ctx.save();
            const alpha = (this.shieldHitTimer / 15) * 0.5;
            const scale = 1.2 + (1 - this.shieldHitTimer / 15) * 0.2; // 逐渐放大
            ctx.scale(scale, scale);
            
            // 绘制一个圆角矩形虚化护盾
            ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`; // 浅蓝色
            ctx.lineWidth = 4;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#60a5fa';
            
            ctx.beginPath();
            ctx.roundRect(-w/2 - 5, -h/2 - 5, w + 10, h + 10, r + 2);
            ctx.stroke();
            
            // 内部填充一点淡蓝色
            ctx.fillStyle = `rgba(147, 197, 253, ${alpha * 0.3})`;
            ctx.fill();
            
            ctx.restore();
        }

        // === Layer 5.5: 插在身上的子剑 (Stuck Swords) ===
        if (this.stuckSwords && this.stuckSwords.length > 0) {
            this.stuckSwords.forEach(sword => {
                if (!sword.active) return;
                ctx.save();
                // 使用子剑记录的偏移量
                ctx.translate(sword.stuckOffset.x, sword.stuckOffset.y);
                ctx.rotate(sword.angle + Math.PI/2);
                
                const color = sword.level >= 3 ? '#f43f5e' : (sword.level >= 2 ? '#6366f1' : '#0ea5e9');
                
                // 深度模拟：只绘制剑柄和护手部分，隐藏剑刃（看上去插进去了）
                // 1. 护手 (Guard)
                ctx.fillStyle = color;
                ctx.fillRect(-6, 2, 12, 3);
                
                // 2. 剑柄 (Hilt)
                ctx.fillStyle = '#334155';
                ctx.fillRect(-2, 5, 4, 6);
                
                // 3. 剑首 (Pommel)
                ctx.beginPath();
                ctx.arc(0, 12, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                
                // 4. 剑刃根部 (露出一点点)
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(-3, 0, 6, 2);

                // 5. [新增] 母剑剑穗 (红色下垂)
                if (sword.isMotherBlade) {
                    ctx.restore(); // 暂时退出旋转坐标系，以实现垂直下垂
                    ctx.save();
                    // 重新计算剑首在全局坐标系中的位置
                    // 剑首在局部坐标系是 (0, 12)，旋转后需要变换
                    const pommelLocalY = 12;
                    const angle = sword.angle + Math.PI/2;
                    const pommelX = sword.stuckOffset.x + Math.cos(angle) * 0 - Math.sin(angle) * pommelLocalY;
                    const pommelY = sword.stuckOffset.y + Math.sin(angle) * 0 + Math.cos(angle) * pommelLocalY;
                    
                    ctx.translate(pommelX, pommelY);
                    
                    // 绘制红色剑穗
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    const time = Date.now() / 1000;
                    const swing = Math.sin(time * 3) * 2;
                    ctx.bezierCurveTo(swing, 5, swing * 2, 10, swing, 18);
                    ctx.strokeStyle = '#ef4444'; // 红色
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    
                    // 穗末端
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(swing, 18, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            });
        }

        ctx.restore(); // <--- 裁剪结束

        // === Layer 6: 外部特效 (光环/冰壳) ===

        // **过热 Stage 4: 炙热发光边框**
        if (this.temp >= 100) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            const pulse = (Math.sin(Date.now() / 200) + 1) * 0.5;
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 15 + pulse * 10;
            ctx.strokeStyle = `rgba(251, 146, 60, ${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4, r); ctx.stroke();
            ctx.restore();
        }

        // **过冷 Stage 4: 冰封外壳 - [核心修改：晶体冰块]**
        if (this.temp <= -100 || this.isFrozenCurrentTurn) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            
            // --- 1. 绘制冰块轮廓 (硬朗的多边形) ---
            const borderW = w + 8;
            const borderH = h + 8;
            
            // 使用 bevel 连接，产生硬角，不使用 spike 正弦波
            ctx.lineJoin = 'bevel'; 
            ctx.lineWidth = 2;
            
            // 冰的颜色：边框亮白/青，内部半透明
            ctx.strokeStyle = 'rgba(207, 250, 254, 0.9)'; // 亮青白
            ctx.fillStyle = 'rgba(165, 243, 252, 0.25)';  // 内部淡淡的冻结感
            
            // 给整个冰块加一点发光
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 10;

            ctx.beginPath();
            // 左上角 (切角)
            ctx.moveTo(-borderW/2 + 5, -borderH/2);
            // 右上角
            ctx.lineTo(borderW/2 - 2, -borderH/2);
            ctx.lineTo(borderW/2, -borderH/2 + 5);
            // 右下角
            ctx.lineTo(borderW/2, borderH/2 - 3);
            ctx.lineTo(borderW/2 - 5, borderH/2);
            // 左下角
            ctx.lineTo(-borderW/2 + 2, borderH/2);
            ctx.lineTo(-borderW/2, borderH/2 - 5);
            // 回到左上
            ctx.lineTo(-borderW/2, -borderH/2 + 5);
            ctx.closePath();
            
            ctx.fill();
            ctx.stroke();

            // --- 2. 绘制冰面反光 (Glossy Highlight) ---
            // 在冰块表面画两道斜着的亮光，增加质感
            ctx.shadowBlur = 0; // 反光不需要发光
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            // 斜线 1
            ctx.moveTo(-w/4, -h/2);
            ctx.lineTo(-w/2, -h/4);
            // 斜线 2
            ctx.moveTo(w/4, h/2);
            ctx.lineTo(w/2, h/4);
            ctx.stroke();

            ctx.restore();
        }

        // --- [新增] 绘制预警大图标 (Pop-up Icon) ---
        if (this.actionPhase === 'telegraphing' && this.actionIcon) {
            ctx.save();
            // 在头顶上方浮现
            const iconY = this.pos.y - this.height/2 - 30;
            const scale = 1.0 + Math.sin(this.telegraphTimer * 0.5) * 0.2; // 弹跳缩放
            
            ctx.translate(this.pos.x, iconY);
            ctx.scale(scale, scale);
            
            ctx.font = '30px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 绘制发光底板
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 10;
            ctx.fillText(this.actionIcon, 0, 0);
            
            ctx.restore();
        }

        // === Layer 7: 扫描反馈 (保持不变) ===
        if (this.scanFeedbackTimer > 0) {
            this.scanFeedbackTimer -= 0.05;
            const alpha = Math.max(0, this.scanFeedbackTimer);
            const expand = (1.0 - alpha) * 10;
            const bracketSize = 10;
            const hw = this.width / 2 + 4 + expand;
            const hh = this.height / 2 + 4 + expand;
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-hw, -hh + bracketSize); ctx.lineTo(-hw, -hh); ctx.lineTo(-hw + bracketSize, -hh);
            ctx.moveTo(hw - bracketSize, -hh); ctx.lineTo(hw, -hh); ctx.lineTo(hw, -hh + bracketSize);
            ctx.moveTo(hw, hh - bracketSize); ctx.lineTo(hw, hh); ctx.lineTo(hw - bracketSize, hh);
            ctx.moveTo(-hw + bracketSize, hh); ctx.lineTo(-hw, hh); ctx.lineTo(-hw, hh - bracketSize);
            ctx.stroke();
            ctx.restore();
        }
    }

    addSwordMark(amount = 1) {
        this.swordMarks += amount;
    }

    /**  * 受到伤害
     * @param {number} amount - 伤害数值
     * @param {object|null} source - 伤害来源 (通常是 projectile 或带有 pos 的对象)
     */
    takeDamage(amount, source = null) {
        let actualDamage = amount;
        
        // 1. 计算护盾逻辑 (优化版)
        if (this.affixes.includes('shield')) {
            // A. 方向判定：检查是否从后方 (上方) 攻击
            // 敌人坐标是中心点，如果子弹在敌人上方 (y < pos.y)，则视为绕后
            let isBackAttack = false;
            if (source && source.pos && source.pos.y < this.pos.y) {
                isBackAttack = true;
            }

            // B. 护盾生效判定：非绕后且有剩余次数
            if (!isBackAttack && this.shieldCharges > 0) {
                const reduction = CONFIG.balance.affixes.shieldReduction || 0.8;
                actualDamage *= reduction; // 护盾减少伤害 (只受20%伤害)
                this.shieldCharges--; // 消耗一层护盾

                // 触发护盾视觉反馈 (限制频率)
                if (this.shieldHitTimer <= 0) {
                    this.shieldHitTimer = 15;
                    if (typeof game !== 'undefined') {
                        // 显示剩余层数
                        game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, `🛡️${this.shieldCharges}`, "#93c5fd");
                    }
                }

                // C. 护盾破碎判定
                if (this.shieldCharges <= 0) {
                    // 移除护盾词条
                    this.affixes = this.affixes.filter(a => a !== 'shield');
                    if (typeof game !== 'undefined') {
                        game.spawn_createFloatingText(this.pos.x, this.pos.y - 40, "💔BROKEN!", "#ef4444");
                        game.spawn_createParticle(this.pos.x, this.pos.y, '#93c5fd', 'shard');
                        // 播放破碎音效 (如果支持)
                        // audio.playEffect('shatter'); 
                    }
                }
            } else if (isBackAttack) {
                // 绕后攻击反馈
                if (typeof game !== 'undefined') {
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, "🗡️BACKSTAB!", "#facc15");
                }
            }
        }
        
        // 2. 计算冰冻易伤
        if (this.temp < 0) {
            // 冰冻增加伤害 (根据温度线性增加)
            actualDamage *= (1 + Math.abs(this.temp) * 0.005);
            
            // 记录冰冻额外伤害视觉反馈
            if (typeof game !== 'undefined' && actualDamage > amount) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 30, `+${Math.ceil(actualDamage - amount)}`, '#06b6d4');
            }
        }

        // 3. 执行扣血
        this.hp -= actualDamage; 
        this.hitTimer = 10; 
        this.whiteBarTimer = 45; 

        if (typeof game !== 'undefined') {
            game.combat_reportDamage(actualDamage);
        }

        // 4. 返回详细结果
        const killed = this.hp <= 0;
        if (killed) this.active = false;

        return { 
            killed: killed, 
            actualDamage: actualDamage 
        };
    }
    applyTemp(amount) { this.temp += amount; }
    getBounds() { return { left: this.pos.x - this.width/2, right: this.pos.x + this.width/2, top: this.pos.y - this.height/2, bottom: this.pos.y + this.height/2 }; }
}
// --- 新增：剑气波 (光球联动) ---
class SwordQi {
    constructor(x, y, velocity, width) {
        this.pos = new Vec2(x, y);
        this.vel = velocity.norm().mult(15); // 剑气速度极快
        this.width = width * 3; // 宽度很宽
        this.life = 40; // 存活时间短
        this.active = true;
        this.trail = [];
    }

    update(timeScale, enemies, game) {
        if (!this.active) return;
        this.pos = this.pos.add(this.vel.mult(timeScale));
        this.life -= timeScale;

        // 拖尾记录
        this.trail.push({x: this.pos.x, y: this.pos.y});
        if(this.trail.length > 5) this.trail.shift();

        // 碰撞检测 (穿透所有敌人并标记)
        enemies.forEach(e => {
            if (e.active && Math.abs(e.pos.x - this.pos.x) < (this.width/2 + e.width/2) && Math.abs(e.pos.y - this.pos.y) < 30) {
                // 标记敌人
                e.addSwordMark(1);
                // 造成少量伤害
                game.combat_damageEnemy(e, { config: { damage: 1 }, pos: this.pos, isCopy: true });
                // 视觉反馈
                game.spawn_createParticle(e.pos.x, e.pos.y, '#0ea5e9', 'spark');
            }
        });

        if (this.life <= 0 || this.pos.y > game.height || this.pos.y < 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(Math.atan2(this.vel.y, this.vel.x));

        // 绘制月牙形剑气
        ctx.beginPath();
        ctx.arc(0, 0, this.width/2, Math.PI * 0.5, Math.PI * 1.5);
        ctx.bezierCurveTo(this.width/4, -this.width/2, this.width/4, this.width/2, 0, this.width/2);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0ea5e9';
        ctx.fill();
        ctx.restore();
    }
}


// --- [特效] 斩击光效 ---
class SlashAnim {
    constructor(x, y, angle, scale=1, color='#0ea5e9') {
        this.pos = new Vec2(x, y);
        this.angle = angle;
        this.life = 1.0;
        this.active = true;
        this.scale = scale;
        this.color = color; // [新增] 支持自定义颜色
    }
    update(timeScale) {
        this.life -= 0.08 * timeScale;
        this.pos.x += Math.cos(this.angle) * 2 * timeScale;
        this.pos.y += Math.sin(this.angle) * 2 * timeScale;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.scale(this.scale, this.scale * (0.5 + this.life * 0.5));
        ctx.globalAlpha = this.life;
        ctx.globalCompositeOperation = 'lighter';
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(20, 0, 60, 3, 0, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = this.color; // [修复] 使用自定义颜色
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.quadraticCurveTo(0, -25, 60, 0);
        ctx.quadraticCurveTo(0, 25, -40, 0);
        ctx.fill();
        ctx.restore();
    }
}

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

// --- 替換原有的 SonSword 類 ---
class SonSword {
    constructor(x, y, mother, level, config, startDelay = 0) {
        this.pos = new Vec2(x, y);
        // 初始速度稍微隨機化，避免重疊
        this.vel = new Vec2(Math.random()-0.5, Math.random()-0.5).mult(5);
        this.mother = mother;
        this.level = level;
        this.config = config;
        this.active = true;
        this.state = 'flying'; 
        
        this.maxAttacks = (config.multicast || 0) + 1;
        this.attacksLeft = this.maxAttacks;
        this.isAutoHunting = false; 

        this.targetQueue = [];     
        this.currentTarget = null; 

        this.stuckHost = null;
        this.stuckOffset = new Vec2(0, 0);
        this.isMotherBlade = false; 
        
        this.startDelay = startDelay + Math.random() * 20;
        this.speedRandomizer = 0.8 + Math.random() * 0.5;
        this.turnRandomizer = 0.7 + Math.random() * 0.6;
        this.dashSpeed = 22 + Math.random() * 10;
        this.dashOvershoot = Math.random() * 8;

        this.angle = 0;
        this.passingThroughEnemy = null;
        this.dashTimer = 0; 
        this.hitEnemiesInDash = new Set(); // [修复] 记录单次冲刺中已命中的敌人
        this.hitEnemiesInRecall = new Set(); // [新增] 记录回收阶段已命中的敌人
        this.trail = []; // [新增] 拖尾轨迹
        this.maxTrailLength = 8; // 拖尾长度

        // [性能優化]：索敵計時器
        // 初始化為隨機值，讓不同子劍錯開索敵時間，避免同一幀計算量過大
        this.searchTimer = Math.floor(Math.random() * 15);
    }

    addTarget(enemy) {
        if (enemy && enemy.active) this.targetQueue.push(enemy);
    }

    searchForTarget(enemies) {
        // [性能優化]：快速過濾，只找屏幕內的活躍敵人
        const candidates = enemies.filter(e => e.active && e.pos.y > 0 && e.pos.y < game.height && e !== this.passingThroughEnemy);
        if (candidates.length === 0) return;
        
        // 簡單距離權重算法 (尋找最近的)
        let best = null;
        let minD = 99999;
        
        // 使用普通 for 循環比 forEach 稍微快一點點
        for (let i = 0; i < candidates.length; i++) {
            const e = candidates[i];
            const d = this.pos.distSq(e.pos); // [優化] 使用距離平方 distSq 避免開根號
            if (d < minD) { minD = d; best = e; }
        }
        
        if (best) this.addTarget(best);
    }

    update(timeScale, enemies, game) {
        if (!this.active) return;

        // 1. 啟動延遲
        if (this.startDelay > 0) {
            this.startDelay -= timeScale;
            // 簡單的跟隨母劍邏輯，避免過多計算
            if (this.mother && this.mother.active) {
                this.pos.x += (this.mother.pos.x - this.pos.x) * 0.1 * timeScale;
                this.pos.y += (this.mother.pos.y - this.pos.y) * 0.1 * timeScale;
            }
            return;
        }
        
        // 2. 穿透衝刺邏輯 (保持不變)
        if (this.passingThroughEnemy) {
             const enemy = this.passingThroughEnemy;
             // 優化：簡單的距離檢查
             const dx = this.pos.x - enemy.pos.x;
             const dy = this.pos.y - enemy.pos.y;
             const distSq = dx*dx + dy*dy; // 距離平方
             const safeDist = (enemy.width + enemy.height)/4 + 40; 
             
             const isInside = enemy.active && distSq < safeDist * safeDist;

             if (isInside) {
                 this.dashTimer = this.dashOvershoot;
                 // [修复] 冲刺中持续检查碰撞，但每个敌人只造成一次伤害
                 for (let e of enemies) {
                     if (e.active && !this.hitEnemiesInDash.has(e)) {
                         const dx = this.pos.x - e.pos.x;
                         const dy = this.pos.y - e.pos.y;
                         const distSq = dx*dx + dy*dy;
                         const hitDist = (e.width/2 + 15);
                         if (distSq < hitDist * hitDist) {
                             this.hitEnemiesInDash.add(e);
                             game.combat_damageEnemy(e, { config: this.config, pos: this.pos, isCopy: true });
                             game.particles.push(new SlashAnim(this.pos.x, this.pos.y, this.angle, 0.4));
                             audio.playSlash();
                             
                             // [新增] 冲刺中击中敌人也消耗攻击次数
                             this.attacksLeft--;
                             if (this.attacksLeft <= 0) {
                                 // 攻击次数耗尽，插在当前敌人身上
                                 this.stickToEnemy(e, game);
                                 return; // 结束更新
                             }
                         }
                     }
                 }
             }
             else this.dashTimer -= timeScale;

             if (!isInside && this.dashTimer <= 0) {
                 this.passingThroughEnemy = null;
                 this.hitEnemiesInDash.clear(); // [修复] 结束冲刺，清空命中记录
                 const normalSpeed = (CONFIG.flyingSword.sonSpeed || 12) * this.speedRandomizer;
                 this.vel = this.vel.norm().mult(normalSpeed);
             } else {
                 this.pos = this.pos.add(this.vel.mult(timeScale));
                 this.angle = Math.atan2(this.vel.y, this.vel.x);
                 return; 
             }
        }

        // 3. 常規狀態機
        if (this.state === 'flying' || this.state === 'recalling') {
            
            // [性能優化]：節流自動尋敵 (Throttling)
            // 不需要每幀都尋找目標，每 15 幀找            // [性能優化]：節流自動尋敵 (Throttling)
            // [修复] 增强索敌逻辑：如果有标记的敌人，强制锁定标记敌人，即使当前已有目标
            if (this.state === 'flying') {
                // 1. 检查是否有被标记的敌人
                const markedEnemy = enemies.find(e => e.active && e.markTimer > 0);
                
                // 2. 如果有标记敌人，且当前目标不是它，则强制切换
                if (markedEnemy && this.currentTarget !== markedEnemy) {
                    this.currentTarget = markedEnemy;
                    this.targetQueue = []; // 清空普通队列，集火标记目标
                } 
                // 3. 如果没有标记敌人，且当前没有目标，则进行常规搜索
                else if (!this.currentTarget && this.targetQueue.length === 0) {
                    if (this.isAutoHunting) {
                        this.searchTimer -= timeScale;
                        if (this.searchTimer <= 0) {
                            this.searchForTarget(enemies);
                            this.searchTimer = 15;
                        }
                    }
                }
            }

            // [优化]：目标验证逻辑，确保队列中的敌人都是活跃的
            if (this.targetQueue.length > 0) {
                this.targetQueue = this.targetQueue.filter(e => e.active);
            }

            // 取目標
            if (this.state === 'flying' && !this.currentTarget && this.targetQueue.length > 0) {
                this.currentTarget = this.targetQueue.shift();
            }

            // [优化]：目标死亡、失效或被取消标记检测
            if (this.currentTarget) {
                const isOffScreen = this.currentTarget.pos.y < -100 || this.currentTarget.pos.y > game.height + 100;
                // 如果目标不活跃、超出屏幕，或者原本是标记目标但标记已消失（且不是自动寻敌模式）
                if (!this.currentTarget.active || isOffScreen) {
                    this.currentTarget = null;
                    // 目标丢失时，立即尝试从队列取下一个
                    if (this.targetQueue.length > 0) {
                        this.currentTarget = this.targetQueue.shift();
                    } else {
                        this.searchTimer = 0; // 强制下一帧进行搜索
                    }
                }
            }

            // --- [修改重点]：基于角度的转向逻辑 ---
            let targetPos = null;
            let currentSpeed = (CONFIG.flyingSword.sonSpeed || 12) * this.speedRandomizer;
            // 转弯速度：数值越小转弯越慢（弧度越大），数值越大越锐利
            let maxTurnRate = 0.15 * timeScale; 

            if (this.state === 'recalling') {
                currentSpeed *= 1.5; 
                maxTurnRate = 0.25 * timeScale; // 回收时转弯稍微快点
                // 如果没有特定目标，飞向屏幕底部中央 (玩家位置)
                targetPos = this.recallTarget ? this.recallTarget : {x: game.width/2, y: game.height - 80};
                
                // 距离检查：到达目标附近消失
                const dx = this.pos.x - targetPos.x;
                const dy = this.pos.y - targetPos.y;
                if ((dx*dx + dy*dy) < 600) { 
                    this.active = false; return;
                }
            } else {
                if (this.currentTarget) {
                    targetPos = this.currentTarget.pos;
                    currentSpeed *= 2.8;     
                    maxTurnRate = 0.12 * timeScale; // 索敌时弧度优美一点
                } else if (this.mother && this.mother.active) {
                    // 跟随母剑
                    const mx = this.mother.vel.x;
                    const my = this.mother.vel.y;
                    const len = Math.sqrt(mx*mx + my*my) || 1;
                    targetPos = { 
                        x: this.mother.pos.x - (mx/len) * 40,
                        y: this.mother.pos.y - (my/len) * 40
                    };
                    maxTurnRate = 0.2 * timeScale;
                } else {
                    // 没有目标且没有母剑，保持当前方向飞行
                    targetPos = { x: this.pos.x + this.vel.x, y: this.pos.y + this.vel.y };
                }
            }

            if (targetPos) {
                // 1. 计算目标角度
                const dx = targetPos.x - this.pos.x;
                const dy = targetPos.y - this.pos.y;
                const targetAngle = Math.atan2(dy, dx);
                
                // 2. 获取当前角度
                const currentAngle = Math.atan2(this.vel.y, this.vel.x);
                
                // 3. 平滑旋转
                const newAngle = rotateTowards(currentAngle, targetAngle, maxTurnRate);
                
                // 4. 应用新速度
                this.vel.x = Math.cos(newAngle) * currentSpeed;
                this.vel.y = Math.sin(newAngle) * currentSpeed;
            }
            
        this.pos.x += this.vel.x * timeScale;
        this.pos.y += this.vel.y * timeScale;
        this.angle = Math.atan2(this.vel.y, this.vel.x);

        // 更新拖尾
        this.trail.push({x: this.pos.x, y: this.pos.y});
        if (this.trail.length > this.maxTrailLength) this.trail.shift();

        // 碰撞检测
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (e.active) {
                    const hitDist = (e.width/2 + 15);
                    const ex = this.pos.x - e.pos.x;
                    const ey = this.pos.y - e.pos.y;
                    if ((ex*ex + ey*ey) < hitDist * hitDist) {
                        this.handleHit(e, game);
                        break; 
                    }
                }
            }
        }
        else if (this.state === 'stuck') {
            if (this.stuckHost && this.stuckHost.active) {
                this.pos = this.stuckHost.pos.add(this.stuckOffset);
            } else {
                this.active = false;
            }
        }
    }

    handleHit(enemy, game) {
        // [修改] 回收阶段造成一次性贯穿伤害
        if (this.state === 'recalling') {
            if (!this.hitEnemiesInRecall.has(enemy)) {
            this.hitEnemiesInRecall.add(enemy);
            // 回收伤害设定
            const fsCfg = CONFIG.mechanics.flying_sword;
            game.combat_damageEnemy(enemy, { config: this.config, pos: this.pos, isCopy: true }, fsCfg.recallDamageMult);
            game.particles.push(new SlashAnim(this.pos.x, this.pos.y, this.angle, 0.35));
                audio.playSlash();
            }
            return;
        }

        if (enemy === this.currentTarget && this.passingThroughEnemy !== enemy) {
            const fsCfg = CONFIG.mechanics.flying_sword;
            let dmg = this.config.damage * fsCfg.dashDamageMult;
            if (this.level >= 2) {
                game.combat_damageEnemy(enemy, { config: this.config, pos: this.pos, isCopy: true });
            } else {
                // Lv1子剑伤害，也通过combat_damageEnemy统一处理
                game.combat_damageEnemy(enemy, { config: { ...this.config, damage: dmg }, pos: this.pos, isCopy: true });
            }

            // 特效
            game.particles.push(new SlashAnim(this.pos.x, this.pos.y, this.angle, 0.5));
            game.spawn_createParticle(this.pos.x, this.pos.y, '#0ea5e9', 'spark');
            audio.playSlash();

            this.passingThroughEnemy = enemy;
            this.vel = this.vel.norm().mult(this.dashSpeed);
            this.currentTarget = null; 

            this.attacksLeft--;
            if (this.attacksLeft <= 0) {
                // [修改] 最后一次攻击插在敌人身上
                this.stickToEnemy(enemy, game);
            } else if (this.targetQueue.length === 0 && this.isAutoHunting) {
                // 立即搜索下一個，不等待計時器
                this.searchForTarget(game.enemies);
            }
        }
    }

    stickToEnemy(enemy, game) {
        this.state = 'stuck';
        this.stuckHost = enemy;
        this.stuckOffset = this.pos.sub(enemy.pos);
        // 限制偏移量在敌人范围内
        const maxOff = Math.min(enemy.width, enemy.height) * 0.4;
        if (this.stuckOffset.mag() > maxOff) {
            this.stuckOffset = this.stuckOffset.norm().mult(maxOff);
        }
        
        if (enemy.stuckSwords) {
            enemy.stuckSwords.push(this);
        }
        
        // [修复] 子剑插在敌人身上时也添加剑痕标记
        if (enemy.addSwordCrack) {
            enemy.addSwordCrack(this.stuckOffset, this.angle + Math.PI/2);
        }
        
        // 视觉反馈
        game.spawn_createFloatingText(this.pos.x, this.pos.y, "🗡️STUCK", "#0ea5e9");
        audio.playSlash();
    }

    triggerRecall(targetPos) {
        this.state = 'recalling';
        this.stuckHost = null;
        this.recallTarget = targetPos;
        this.targetQueue = [];
        this.currentTarget = null;
        this.passingThroughEnemy = null;
        this.hitEnemiesInRecall.clear(); // [新增] 开始回收时清空命中记录
    }

        draw(ctx) {
        if (!this.active || this.state === 'stuck') return; 

        const color = this.level >= 3 ? '#f43f5e' : (this.level >= 2 ? '#6366f1' : '#0ea5e9');

        // 1. 绘制拖尾 (Trail)
        if (this.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle + Math.PI/2); 
        
        // 2. 动态发光强度
        const attackRatio = 1 - (this.attacksLeft / this.maxAttacks);
        const glowIntensity = 5 + attackRatio * 15;
        
        if (game.sonSwords.length < 40 || this.passingThroughEnemy) {
            ctx.shadowBlur = this.passingThroughEnemy ? 20 : glowIntensity;
            ctx.shadowColor = color; 
        }

        // 3. 绘制实体小剑 (细化版)
        if (this.isMotherBlade) ctx.scale(1.4, 1.4);
        
        // 剑刃 (Blade)
        ctx.beginPath();
        ctx.moveTo(0, -15); 
        ctx.lineTo(2.5, -2); 
        ctx.lineTo(2.5, 2); 
        ctx.lineTo(-2.5, 2); 
        ctx.lineTo(-2.5, -2);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc'; 
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 剑脊线
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(0, 2);
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
        ctx.stroke();

        // 护手 (Guard)
        ctx.fillStyle = color;
        ctx.fillRect(-5, 2, 10, 2);
        
        // 剑柄 (Hilt)
        ctx.fillStyle = '#334155';
        ctx.fillRect(-1.25, 4, 2.5, 5);
        
        // 剑首 (Pommel)
        ctx.beginPath();
        ctx.arc(0, 10, 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 4. [新增] 母剑剑穗 (红色下垂)
        if (this.isMotherBlade) {
            ctx.restore(); // 退出旋转坐标系
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            
            // 计算剑首在当前旋转下的偏移
            const pommelLocalY = 10 * 1.4; // 考虑了 scale(1.4)
            const angle = this.angle + Math.PI/2;
            const pommelOffX = -Math.sin(angle) * pommelLocalY;
            const pommelOffY = Math.cos(angle) * pommelLocalY;
            
            ctx.translate(pommelOffX, pommelOffY);
            
            // 绘制红色剑穗
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const time = Date.now() / 1000;
            const swing = Math.sin(time * 3) * 2;
            ctx.bezierCurveTo(swing, 5, swing * 2, 10, swing, 18);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 穗末端
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(swing, 18, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
class Projectile {
    constructor(x, y, vel, config, isCopy = false, shotId = null, isLast = false) {
        this.pos = new Vec2(x, y);
        this.vel = new Vec2(vel.x, vel.y); // 创建vel的副本，避免共享引用
        this.config = config;
        this.shotId = shotId;
        this.isLast = isLast;
        this.maxBounces = config.bounce || 0;
        this.maxPierces = config.pierce || 0;
        const params = Projectile.calculateVisualParams(config, isCopy);
        this.radius = params.radius; 
        this.intensity = params.intensity;
        this.active = true;
        this.isCopy = isCopy;
        this.bouncesLeft = config.bounce || 0;
        this.piercesLeft = config.pierce || 0;
        this.hasAreaDamage = config.damage > 0;
        this.maxDurability = (this.maxBounces + this.maxPierces) || 1;
        this.hitCooldowns = new Map();
        this.rotation = 0;
        this.windBladeAngle = 0; // 风属性环绕风刃的旋转角度
        this.lifeTime = 60 * 30; // [修改] 加倍子弹生命时间 (从15秒增加到30秒)
        this.chainHistory = [];
        this.trail = [];      
        this.deformation = { x: 1, y: 1 }; 
        this.targetDeformation = { x: 1, y: 1 }; 
        this.elasticity = 0.2;
        this.crackSeed = [];
        this.lastHitEnemy = null;
        for(let i=0; i<3; i++) {
            this.crackSeed.push({
                angle: Math.random() * Math.PI * 2,
                len: 0.3 + Math.random() * 0.4,
                jagged: (Math.random() - 0.5) * 0.5
            });
        }
    }

    static calculateVisualParams(config, isCopy) {
        const v = CONFIG.visuals;
        let r = v.baseRadius + Math.min(v.maxSizeBonus, (config.damage - 2) * v.damageGrowth);
        if (isCopy) r *= v.copyScale;
        if (config.explosive) r *= v.explosiveScale;
        if (config.pierce > 0) r *= v.arrowScale;
        let glow = 1.0 + (config.damage * v.glowPerDamage) / 10;
        glow = Math.min(v.maxGlow / v.glowBase, glow);
        return { radius: r, intensity: glow };
    }

    update(width, height, enemies, spawnCallback, timeScale) {
        if (!this.active) return;
        // 更新风属性环绕风刃的旋转角度
        if (this.config.wind) {
            this.windBladeAngle += 0.15 * timeScale;
        }
        if (this.config.pierce > 0) {
            this.rotation = Math.atan2(this.vel.y, this.vel.x);
        } else if (this.config.scatter > 0) {
            this.rotation += 0.3 * timeScale; 
        } else {
            this.rotation += 0.1 * timeScale;
        }
        if (this.config.bounce > 0) {
            const speed = this.vel.mag();
            if (speed > 1) {
                const wobble = 1.0 + Math.sin(Date.now() / 100) * 0.1;
                this.targetDeformation = { x: 1/wobble, y: wobble };
            }
        }
        this.deformation.x += (this.targetDeformation.x - this.deformation.x) * this.elasticity * timeScale;
        this.deformation.y += (this.targetDeformation.y - this.deformation.y) * this.elasticity * timeScale;
        this.trail.push({x: this.pos.x, y: this.pos.y});
        if (this.trail.length > 8) this.trail.shift();
        for (const [enemy, timer] of this.hitCooldowns) {
            if (timer > 0) this.hitCooldowns.set(enemy, timer - timeScale);
            else this.hitCooldowns.delete(enemy);
        }
        this.lifeTime -= timeScale;
        if (this.lifeTime <= 0) { this.destroy(spawnCallback); return; }
        // [优化 1] 增加空气阻力，防止无限加速导致的隧穿 (可选，这里设为 1.0 表示无阻力)
        this.vel = this.vel.mult(1.0);

        // [优化 2] 动态子步进计算
        // 确保每一步移动距离不超过半径的 50%，大幅提升高速碰撞的稳定性
        const speed = this.vel.mag();
        const safeStep = this.radius * 0.5;
        const steps = Math.ceil(speed * timeScale / safeStep) || 1;
        const subStepVel = this.vel.mult(timeScale / steps);

        // 获取活跃敌人列表 (优化遍历性能)
        const activeEnemies = enemies.filter(e => e.active);

        for (let s = 0; s < steps; s++) {
            // 分步移动
            this._applyMove(subStepVel, width, height, spawnCallback);
            if (!this.active) return;

            for (let e of activeEnemies) {
                // [优化 3] 矩形碰撞检测 (Circle vs AABB)
                // 这能完美解决 "从两个斜对角敌人中间穿过" 的问题
                
                const halfW = e.width / 2;
                const halfH = e.height / 2;

                // 1. 寻找矩形上离圆心最近的点 (Closest Point)
                // 将圆心坐标限制在矩形边界内
                const closestX = Math.max(e.pos.x - halfW, Math.min(this.pos.x, e.pos.x + halfW));
                const closestY = Math.max(e.pos.y - halfH, Math.min(this.pos.y, e.pos.y + halfH));

                // 2. 计算距离向量 (圆心 到 最近点)
                const distVecX = this.pos.x - closestX;
                const distVecY = this.pos.y - closestY;
                const distSq = distVecX * distVecX + distVecY * distVecY;

                // 3. 判定碰撞 (距离平方 < 半径平方)
                // 注意：这里稍微加大了判定半径 (+2)，让碰撞手感更"实"，不容易漏
                const hitRadius = this.radius + 2;

                if (distSq < hitRadius * hitRadius) {
                    if (this.hitCooldowns.has(e)) continue;
                    this.hitCooldowns.set(e, CONFIG.gameplay.hitCooldowns);
                    this.lastHitEnemy = e;
                    this.onHit(e, enemies);
                    if (this.config.flying_sword) {
                        if (typeof game !== 'undefined') game.combat_flyingSword_assignTarget(e);
                    }
                    if (this.piercesLeft > 0) {
                        if (this.config.flying_sword) {
                            const pegLevel = this.config.level || 1;
                            if (this.hasAreaDamage) this.performSlashAttack(e, game.enemies);
                            if (typeof game !== 'undefined') {
                                const spawnX = e.pos.x + (Math.random()-0.5)*20;
                                const spawnY = e.pos.y + (Math.random()-0.5)*20;
                                game.combat_flyingSword_addSon(spawnX, spawnY, this, pegLevel, this.config);
                            }
                        }
                        this.piercesLeft--;
                        continue;
                    }
                    if (this.bouncesLeft > 0) {
                        this.bouncesLeft--;
                        
                        // 风属性锤点逻辑
                        if (this.config.wind && this.isLast && typeof game !== 'undefined') {
                            game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage);
                        }

                        // [核心修复] 基于最近点的精确物理反弹
                        const dist = Math.sqrt(distSq);
                        let normal;

                        if (dist === 0) {
                            // 特殊情况：圆心在矩形内部 (Deep Penetration)
                            // 策略：寻找最近的边界推出
                            const dx = this.pos.x - e.pos.x;
                            const dy = this.pos.y - e.pos.y;
                            // 判断是更靠近左右边还是上下边
                            const overlapX = halfW - Math.abs(dx);
                            const overlapY = halfH - Math.abs(dy);

                            if (overlapX < overlapY) {
                                normal = new Vec2(Math.sign(dx) || 1, 0);
                            } else {
                                normal = new Vec2(0, Math.sign(dy) || 1);
                            }
                        } else {
                            // 正常情况：撞击表面或角落
                            // 法线就是 "最近点 -> 圆心" 的单位向量
                            normal = new Vec2(distVecX / dist, distVecY / dist);
                        }

                        // 1. 位置修正 (Push Out)：将子弹推离敌人表面，防止下一帧卡住
                        const pushOutDist = this.radius + 0.1;
                        if (dist === 0) {
                            // 内部推出
                            this.pos.x = closestX + normal.x * pushOutDist;
                            this.pos.y = closestY + normal.y * pushOutDist;
                        } else {
                            // 外部推出 (从最近点往外推)
                            this.pos.x = closestX + normal.x * pushOutDist;
                            this.pos.y = closestY + normal.y * pushOutDist;
                        }

                        // 2. 速度反弹 (Reflection)
                        // v' = v - 2 * (v · n) * n
                        const dot = this.vel.dot(normal);
                        // 只有当速度朝向物体内部时才反弹 (防止已经离开时被错误反拉)
                        if (dot < 0) {
                            this.vel = this.vel.sub(normal.mult(2 * dot));
                        }

                        // 视觉挤压效果
                        this.deformation = { x: 1.3, y: 0.7 }; // 撞击变扁
                    } else {
                        this.destroy(spawnCallback);
                        return;
                    }
                }
            }
        }
        if (this.config.explosive) {
            if (Math.random() < 0.7) {
                const spark = new Particle(this.pos.x, this.pos.y, '#fbbf24', 'spark');
                spark.vel = this.vel.mult(-0.2).add(new Vec2((Math.random()-0.5)*2, (Math.random()-0.5)*2));
                game.particles.push(spark);
            }
        }
    }

    _applyMove(vel, width, height, spawnCallback) {
        this.pos = this.pos.add(vel);
        
        // [优化] 在 Demo 模式下强制开启底墙
        const hasBottomWall = (this.game && this.game.isDemo) ? true : game.hasCombatWall;

        if (this.pos.x < this.radius) { 
            this.pos.x = this.radius; this.vel.x = Math.abs(this.vel.x); 
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);
            const angle = Math.abs(Math.atan2(this.vel.x, this.vel.y));
            if (angle < (10 * Math.PI / 180)) {
                const speed = this.vel.mag();
                const newAngle = angle + (1 * Math.PI / 180);
                this.vel.x = speed * Math.sin(newAngle);
                this.vel.y = speed * Math.cos(newAngle) * (this.vel.y > 0 ? 1 : -1);
            }
            if(this.config.bounce > 0) this.deformation = { x: 0.7, y: 1.3 };
            this.hitCooldowns.clear();
        }
        if (this.pos.x > width - this.radius) { 
            this.pos.x = width - this.radius; this.vel.x = -Math.abs(this.vel.x); 
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);
            const angle = Math.abs(Math.atan2(this.vel.x, this.vel.y));
            if (angle < (10 * Math.PI / 180)) {
                const speed = this.vel.mag();
                const newAngle = angle + (1 * Math.PI / 180);
                this.vel.x = -speed * Math.sin(newAngle);
                this.vel.y = speed * Math.cos(newAngle) * (this.vel.y > 0 ? 1 : -1);
            }
            if(this.config.bounce > 0) this.deformation = { x: 0.7, y: 1.3 };
            this.hitCooldowns.clear();
        }
        if (this.pos.y < this.radius) { 
            this.pos.y = this.radius; this.vel.y = Math.abs(this.vel.y); 
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);
            if(this.config.bounce > 0) this.deformation = { x: 1.3, y: 0.7 };
        }
        if (this.pos.y > height - this.radius) {
            if (hasBottomWall) {
                this.pos.y = height - this.radius; this.vel.y = -Math.abs(this.vel.y);
                if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);
                
                // [修复] 底部护盾反弹不消耗反弹次数
                if(this.config.bounce > 0) this.deformation = { x: 1.3, y: 0.7 };
                this.hitCooldowns.clear();
            } else {
                this.destroy(spawnCallback);
            }
        }
    }

    onHit(enemy, allEnemies) {
        game.combat_damageEnemy(enemy, this);
    }

    performSlashAttack(target, enemies) {
        const angle = Math.random() * Math.PI * 2;
        const length = 160; 
        const width = 40;   
        const center = target.pos;
        const halfLen = length / 2;
        const dir = new Vec2(Math.cos(angle), Math.sin(angle));
        const p1 = center.add(dir.mult(-halfLen));
        const p2 = center.add(dir.mult(halfLen));

        if (typeof game !== 'undefined') {
            let slashColor = CONFIG.colors.flying_sword || '#0ea5e9';
            if (this.config.lightning > 0) slashColor = '#c084fc'; 
            else if (this.config.pyro > 0) slashColor = '#f97316';
            else if (this.config.cryo > 0) slashColor = '#06b6d4';
            game.particles.push(new SlashEffect(center.x, center.y, angle, length, slashColor));
            audio.playSlash();
        }

        enemies.forEach(other => {
            if (!other.active) return;
            const E = other.pos;
            const AB = p2.sub(p1);      
            const AE = E.sub(p1);       
            const lenSq = AB.dot(AB);
            let t = (lenSq === 0) ? -1 : AE.dot(AB) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const closest = p1.add(AB.mult(t));
            const dist = E.dist(closest); 
            const hitRadius = (other.width / 2) + (width / 2);
            if (dist < hitRadius) {
                const fsCfg = CONFIG.mechanics.flying_sword;
                const slashConfig = {
                    ...this.config,
                    damage: Math.ceil(this.config.damage * fsCfg.dashDamageMult)
                };
                game.combat_damageEnemy(other, {
                    config: slashConfig,
                    pos: closest, 
                    isCopy: true
                });
                if (other !== target) {
                    other.addSwordMark(1);
                }
            }
        });
    }
    
    destroy(spawnCallback) {
        this.active = false; 
        this.destroyed = true;

        // [修改重点]：允许套娃子弹触发嵌套逻辑，即使它是 Copy (散射出来的)
        // 之前的逻辑是 !this.isCopy，这会阻止散射子弹裂变
        // 现在放宽条件：如果是非 Copy，或者 虽然是 Copy 但是是套娃(isMatryoshka)
        const canSpawnNested = !this.isCopy || this.config.isMatryoshka;

        if (this.config.nestedPayload && canSpawnNested) {
             let nextVel = this.vel.norm().mult(this.vel.mag() * 1.1); 
             if (nextVel.mag() < 2) nextVel = new Vec2(0, -5);
             spawnCallback({ x: this.pos.x, y: this.pos.y, vel: nextVel, config: this.config.nestedPayload });
        } else if (this.config.chainPayload && !this.isCopy) {
            // 普通链式载荷依然禁止 Copy 触发，防止无限循环
            let nextVel = this.vel; if (nextVel.mag() < 1) nextVel = new Vec2(0, 5);
            spawnCallback({ x: this.pos.x, y: this.pos.y, vel: nextVel.norm().mult(10), config: this.config.chainPayload });
        }
        
        if (this.config.type === 'flying_sword') {
            if (this.lastHitEnemy && this.lastHitEnemy.active) this.stickToEnemy(this.lastHitEnemy);
            else this.handleFlyingSwordFinish(null, game);
        }
    }

    stickToEnemy(enemy) {
        if (typeof game !== 'undefined') {
            const pegLevel = this.config.level || 1;
            const hitAngle = Math.atan2(this.vel.y, this.vel.x);
            const randomAngle = hitAngle + (Math.random() - 0.5) * (Math.PI / 6);
            const randomOffsetX = (Math.random() - 0.5) * (enemy.width * 0.6);
            const randomOffsetY = (Math.random() - 0.5) * (enemy.height * 0.6);
            const stuckPos = enemy.pos.add(new Vec2(randomOffsetX, randomOffsetY));
            
            // 使用 game.combat_flyingSword_addSon 而不是直接 new SonSword，以保持逻辑一致性
            const stuckBlade = game.combat_flyingSword_addSon(stuckPos.x, stuckPos.y, this, pegLevel, this.config, true);
            
            this.performSlashAttack(enemy, game.enemies);

            game.sonSwords.forEach(s => {
                if (s.mother === this && s !== stuckBlade && s.active) {
                    if (pegLevel === 1) {
                        s.active = false;
                        game.spawn_createParticle(s.pos.x, s.pos.y, '#0ea5e9', 'mist');
                    } 
                    else if (pegLevel === 2) {
                        s.attacksLeft = s.maxAttacks; 
                        s.isAutoHunting = true;       
                        game.spawn_createFloatingText(s.pos.x, s.pos.y, "RESET", "#6366f1");
                    } 
                    else if (pegLevel >= 3) {
                        s.isAutoHunting = true; 
                    }
                }
            });
        }
    }

    handleFlyingSwordFinish(host, game, isBottomExit = false) {
        let targetPos = null;
        if (host) {
            targetPos = host.pos;
        } else if (!isBottomExit && this.lastHitEnemy && this.lastHitEnemy.active) {
            targetPos = this.lastHitEnemy.pos;
        } else {
            targetPos = { x: game.width / 2, y: game.height - 80 };
        }

        game.sonSwords.forEach(s => {
            const level = s.level || 1;
            if (s.mother === this && s.active) {
                if (level >= 3) {
                    s.state = 'flying'; 
                    s.isAutoHunting = true; 
                    s.mother = null; 
                    game.spawn_createFloatingText(s.pos.x, s.pos.y, "HUNT", "#f43f5e");
                } else if (level === 2) {
                    s.triggerRecall(targetPos);
                } else {
                    s.active = false; 
                    game.spawn_createParticle(s.pos.x, s.pos.y, '#0ea5e9', 'mist');
                }
            }
        });
    }

    draw(ctx) {
        if (!this.active && !this.destroyed) return;
        const integrity = (this.bouncesLeft + this.piercesLeft) / (this.maxDurability || 1);
        Projectile.drawVisuals(ctx, this.pos.x, this.pos.y, this.radius, this.config, this.rotation, this.intensity, this.deformation, integrity, this.crackSeed, this.windBladeAngle);
    }

    static drawVisuals(ctx, x, y, radius, config, rotation, intensity, deformation = {x:1, y:1}, integrity = 1.0, crackSeed = [], windBladeAngle = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        if (config.type === 'flying_sword') {
            // 修正角度：假設畫筆是朝右(0度)畫的，如果原圖是朝上則需旋轉
            // 這裡我們直接畫朝右的劍，與 velocity 方向一致
            const scale = radius / 6; // 根據半徑動態調整大小 (基礎半徑約7~10)
            // 1. 劍身發光 (Spirit Aura) - 隨耐久度減弱
            ctx.shadowBlur = 15 * intensity * integrity;
            ctx.shadowColor = '#0ea5e9'; // 青色光暈
            // 2. 劍身 (Blade) - 雙刃劍，指向右側
            ctx.beginPath();
            ctx.moveTo(32 * scale, 0);       // 劍尖 (最右)
            ctx.lineTo(8 * scale, -4 * scale); // 上刃
            ctx.lineTo(-12 * scale, -4 * scale); // 劍身後段
            ctx.lineTo(-12 * scale, 4 * scale);  // 劍身後段
            ctx.lineTo(8 * scale, 4 * scale);  // 下刃
            ctx.closePath();
            // 劍刃金屬漸變 (橫向)
            const bladeGrad = ctx.createLinearGradient(-10 * scale, -5*scale, -10 * scale, 5*scale);
            bladeGrad.addColorStop(0, '#e0f2fe');   // 亮白邊緣
            bladeGrad.addColorStop(0.5, '#0284c7'); // 深青中脊 (立體感)
            bladeGrad.addColorStop(1, '#e0f2fe');   // 亮白邊緣
            ctx.fillStyle = bladeGrad;
            ctx.fill();
            // 劍脊線 (Ridge)
            ctx.beginPath();
            ctx.moveTo(30 * scale, 0);
            ctx.lineTo(-12 * scale, 0);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // 3. 劍格 (Guard) - 祥雲/蝙蝠紋飾
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#f59e0b';
            ctx.fillStyle = '#fbbf24'; // 金色
            ctx.beginPath();
            // 畫一個橫向的菱形或雲紋
            ctx.moveTo(-10 * scale, 0);
            ctx.quadraticCurveTo(-10 * scale, -10 * scale, -14 * scale, -8 * scale); // 上翼
            ctx.lineTo(-14 * scale, 8 * scale); // 下翼
            ctx.quadraticCurveTo(-10 * scale, 10 * scale, -10 * scale, 0);
            ctx.fill();
            // 4. 劍柄 (Hilt)
            ctx.fillStyle = '#451a03'; // 深褐色木柄
            ctx.fillRect(-22 * scale, -2 * scale, 10 * scale, 4 * scale);
            // 5. 劍首 (Pommel)
            ctx.beginPath();
            ctx.arc(-24 * scale, 0, 3 * scale, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();
            // 6. 劍穗 (Tassel) - 隨時間飄動的紅穗
            // 使用 Math.sin 模擬風吹效果
            const time = Date.now() / 100;
            const swing = Math.sin(time) * 3 * scale;
            ctx.beginPath();
            ctx.moveTo(-26 * scale, 0); // 連接劍首
            // 貝塞爾曲線模擬向後飄動 (向左)
            ctx.bezierCurveTo(
                -35 * scale, swing,           // 控制點1
                -40 * scale, -swing,          // 控制點2
                -50 * scale, swing * 0.5      // 終點
            );
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 5;
            ctx.strokeStyle = '#ef4444'; // 紅色
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
            return; // *** 繪製完畢，直接返回，跳过原本的圆球繪製 ***
        }
        
        // 1. 确定形状
        let shapeType = 'circle';
        if (config.pierce > 0) shapeType = 'arrow';
        if (config.scatter > 0) shapeType = 'star';
        if (config.isLaser) shapeType = 'orb';
        if (config.isMatryoshka) shapeType = 'matryoshka';
        if (config.wind) shapeType = 'crystal'; // 风属性使用菱形

        // 2. 决定颜色
        let mainColors = [];
        let glowColors = [];
        
        if (config.isLaser) { 
            mainColors.push('#ffffff'); // 核心纯白
            glowColors.push(CONFIG.colors.laser); // 外圈天蓝
        }
        if (config.type === 'rainbow') { mainColors.push('rainbow'); glowColors.push('#ffffff'); }
        if (config.explosive) { mainColors.push('#fff'); glowColors.push('#ef4444'); }
        if (config.pyro > 0) { mainColors.push('#fdba74'); glowColors.push('#f97316'); }
        if (config.cryo > 0) { mainColors.push('#cffafe'); glowColors.push('#06b6d4'); }
        if (config.lightning > 0) { mainColors.push('#f3e8ff'); glowColors.push('#c084fc'); }
        if (config.wind) { mainColors.push('#d1fae5'); glowColors.push('#34d399'); } // 风属性颜色
        if (config.pierce > 0 && mainColors.length === 0) { mainColors.push('#fee2e2'); glowColors.push('#ef4444'); }
        if (mainColors.length === 0) {
            if (config.bounce > 0) { mainColors.push('#dcfce7'); glowColors.push('#22c55e'); }
            else { mainColors.push('#f1f5f9'); glowColors.push('#94a3b8'); }
        }
        const mainColor = mainColors[mainColors.length - 1];
        const glowColor = glowColors[glowColors.length - 1];
        if (config.explosive && integrity > 0.1) {
            const time = Date.now();
            const pulse = (Math.sin(time / 50) + 1) / 2; 
            if (pulse > 0.7) {
                mainColors[mainColors.length - 1] = '#ffffff'; 
                glowColors[glowColors.length - 1] = '#fca5a5'; 
                intensity *= 1.5; 
            }
            const scaleMod = 1.0 + pulse * 0.15;
            deformation.x *= scaleMod;
            deformation.y *= scaleMod;
            const shakeAmount = 1.5; 
            ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
        }
        // ---  光球的特殊渲染逻辑 (绑定特效) ---
        if (shapeType === 'orb') {
            const time = Date.now() / 200;
            const pulse = Math.sin(time) * 0.1 + 1.0; 
            const laserPower = config.laser || 0;
            const sizeMod = 1 + (laserPower * 0.1); 
            ctx.shadowBlur = 20 * intensity * sizeMod;
            ctx.shadowColor = glowColor;
            ctx.fillStyle = glowColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.2 * pulse * sizeMod, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.8 * sizeMod, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return; 
        }
        // 3. 绘制形状
        ctx.scale(deformation.x, deformation.y);
        ctx.beginPath();
        if (shapeType === 'arrow') {
            const arrowScale = 1.8; 
            ctx.moveTo(radius * arrowScale, 0); 
            ctx.lineTo(-radius * 0.8, radius * 0.7); 
            ctx.lineTo(-radius * 0.3, 0); 
            ctx.lineTo(-radius * 0.8, -radius * 0.7); 
        } else if (shapeType === 'star') {
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.lineTo(radius, 0);
                ctx.lineTo(radius * 0.4, radius * 0.4);
            }
        } else if (shapeType === 'crystal') { 
            ctx.moveTo(0, -radius * 1.3);
            ctx.lineTo(radius * 0.8, 0);
            ctx.lineTo(0, radius * 1.3);
            ctx.lineTo(-radius * 0.8, 0);
        } else if (shapeType === 'matryoshka') {
             ctx.arc(0, 0, radius, 0, Math.PI * 2);
        } else {
            if (config.pyro > 0) {
                const time = Date.now() / 50;
                for (let i = 0; i <= 30; i++) {
                    const angle = (i / 30) * Math.PI * 2;
                    const wave1 = Math.sin(time + angle * 3) * (radius * 0.15);
                    const wave2 = Math.sin(time * 1.5 + angle * 7) * (radius * 0.08);
                    const r = radius + wave1 + wave2;
                    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
            } else {
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
            }
        }
        ctx.closePath();
        ctx.shadowBlur = CONFIG.visuals.glowBase * intensity * integrity; 
        ctx.shadowColor = glowColor;
        if (mainColor === 'rainbow') {
            const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
            grad.addColorStop(0, '#fca5a5');
            grad.addColorStop(0.25, '#facc15');
            grad.addColorStop(0.5, '#4ade80');
            grad.addColorStop(0.75, '#60a5fa');
            grad.addColorStop(1, '#c084fc');
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = mainColor;
        }
        ctx.fill();
        if (integrity < 1.0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.6 - 0.6 * integrity})`; 
            ctx.fill();
        }
        if (config.cryo > 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            if (shapeType === 'arrow') {
                ctx.moveTo(0, -radius * 0.25); ctx.lineTo(radius*0.3, 0); ctx.lineTo(0, radius*0.25); ctx.lineTo(-radius*0.3, 0);
            } else if (shapeType === 'crystal') {
                ctx.moveTo(0, -radius * 0.6); 
                ctx.lineTo(radius * 0.3, 0); 
                ctx.lineTo(0, radius * 0.6); 
                ctx.lineTo(-radius * 0.3, 0);
            } else {
                for(let i=0; i<6; i++) {
                    const a = i * Math.PI / 3;
                    const r = radius * 0.5;
                    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
            }
            ctx.fill();
        }
        if (integrity < 0.6 && crackSeed && crackSeed.length > 0) {
            ctx.save();
            ctx.shadowBlur = 0; 
            ctx.lineWidth = 1.5; 
            ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)'; 
            ctx.clip(); 
            crackSeed.forEach(seed => {
                ctx.beginPath();
                ctx.moveTo(0, 0); 
                const r = radius * seed.len;
                const endX = Math.cos(seed.angle) * r;
                const endY = Math.sin(seed.angle) * r;
                const midX = endX * 0.5 + Math.cos(seed.angle + Math.PI/2) * (radius * seed.jagged);
                const midY = endY * 0.5 + Math.sin(seed.angle + Math.PI/2) * (radius * seed.jagged);
                ctx.lineTo(midX, midY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            });
            ctx.restore();
        }
        if (config.bounce > 0 && integrity < 0.2) {
            ctx.strokeStyle = '#475569'; 
            ctx.lineWidth = 2;
            ctx.stroke(); 
        }
        if (config.lightning > 0) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'lighter'; 
            const arcCount = 1 + Math.floor(config.lightning / 2);
            ctx.shadowBlur = 8 + config.lightning;
            ctx.shadowColor = '#a855f7'; 
            ctx.strokeStyle = '#e9d5ff'; 
            for (let k = 0; k < arcCount; k++) {
                ctx.beginPath();
                const startAngle = Math.random() * Math.PI * 2;
                const arcLen = 0.5 + Math.random() * 0.5; 
                const segments = 3 + Math.floor(Math.random() * 2);
                for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    const currentAngle = startAngle + t * arcLen;
                    const jitter = (Math.random() - 0.5) * (radius * 0.3);
                    const dist = radius * 1.2 + jitter;
                    const px = Math.cos(currentAngle) * dist;
                    const py = Math.sin(currentAngle) * dist;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.lineWidth = 0.8 + Math.random() * 1.2;
                ctx.stroke();
            }
            if (Math.random() < 0.2) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        if (config.isMatryoshka) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#d946ef'; 
            ctx.beginPath(); ctx.arc(0, -radius*0.2, radius*0.4, 0, Math.PI*2); ctx.fill(); 
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; 
            ctx.beginPath(); ctx.arc(0, 0, radius*0.8, 0, Math.PI*2); ctx.stroke();
        }
        // 风属性环绕风刃特效
        if (config.wind && config.wind > 0) {
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#34d399';
            const bladeCount = Math.min(3 + config.wind, 6); // 根据风属性等级决定风刃数量
            const orbitRadius = radius * 1.8; // 环绕轨道半径
            
            for (let i = 0; i < bladeCount; i++) {
                const angle = windBladeAngle + (i * Math.PI * 2 / bladeCount);
                const bladeX = Math.cos(angle) * orbitRadius;
                const bladeY = Math.sin(angle) * orbitRadius;
                
                ctx.save();
                ctx.translate(bladeX, bladeY);
                ctx.rotate(angle + Math.PI / 2); // 风刃沿切线方向
                
                // 绘制弯月形风刃
                ctx.strokeStyle = '#d1fae5';
                ctx.fillStyle = 'rgba(209, 250, 229, 0.3)';
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                
                const bladeLength = radius * 0.8;
                const bladeCurve = radius * 0.3;
                
                ctx.beginPath();
                ctx.moveTo(-bladeLength/2, 0);
                ctx.quadraticCurveTo(0, bladeCurve, bladeLength/2, 0);
                ctx.quadraticCurveTo(0, bladeCurve * 0.5, -bladeLength/2, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.restore();
            }
            
            ctx.restore();
        }
         ctx.restore();
    }
}
class CloneSpore {
    constructor(startX, startY, targetX, targetY, onLandCallback) {
        this.start = new Vec2(startX, startY);
        this.end = new Vec2(targetX, targetY);
        this.pos = new Vec2(startX, startY);
        this.onLand = onLandCallback;
        
        this.progress = 0;
        this.speed = 0.05; // 動畫速度
        this.arcHeight = 100; // 拋物線高度
        this.active = true;
    }

    update(timeScale) {
        this.progress += this.speed * timeScale;
        
        if (this.progress >= 1) {
            this.progress = 1;
            this.active = false;
            this.onLand(); // 落地，呼叫回調生成敵人
            game.spawn_createExplosion(this.end.x, this.end.y, '#a855f7'); // 落地特效
            audio.playPowerup();
        }

        // 線性插值計算水平位置
        const tx = this.start.x + (this.end.x - this.start.x) * this.progress;
        // 線性插值垂直位置
        const tyBase = this.start.y + (this.end.y - this.start.y) * this.progress;
        // 加上拋物線偏移 (sin(0~PI) * height)
        const arc = Math.sin(this.progress * Math.PI) * this.arcHeight;
        
        this.pos.x = tx;
        this.pos.y = tyBase - arc; // 向上拋
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.progress * Math.PI * 4); // 旋轉效果
        
        // 繪製孢子
        ctx.fillStyle = '#d8b4fe';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(2, -2, 2, 0, Math.PI * 2); // 高光
        ctx.stroke();
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, mode = 'normal') {
        this.pos = new Vec2(x, y);
        this.color = color;
        this.mode = mode;
        this.life = 1.0;
        this.maxLife = 1.0; 
        this.turbulence = 0; // 湍流强度
        this.wobble = Math.random() * Math.PI * 2; // 随机相位
        
        const angle = Math.random() * Math.PI * 2;
        
        // --- 初始化物理参数 ---
        if (mode === 'spark') {
            const speed = Math.random() * 5 + 2;
            this.vel = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
            this.drag = 0.85; this.gravity = 0.1; 
            this.decay = 0.05 + Math.random() * 0.05; 
            this.size = Math.random() * 2 + 1; 

        } else if (mode === 'ember') {
            // [优化] 火焰余烬：更小的体积，更强的向上漂浮感
            this.vel = new Vec2((Math.random() - 0.5) * 1.0, -Math.random() * 2.0 - 0.5);
            this.drag = 0.98; this.gravity = -0.08; 
            this.decay = 0.015 + Math.random() * 0.02; 
            this.size = Math.random() * 1.5 + 0.5; // 粒子变小
            this.wobble = Math.random() * 10; 

        } else if (mode === 'mist') {
            this.vel = new Vec2((Math.random() - 0.5) * 0.8, Math.random() * 0.5 + 0.5); 
            this.drag = 0.96; this.gravity = 0.02; 
            this.decay = 0.015 + Math.random() * 0.01; 
            this.size = Math.random() * 8 + 6; 
            this.angle = Math.random() * Math.PI * 2; 

        } else if (mode === 'shard') {
            // [优化] 冰渣：爆发速度
            const speed = Math.random() * 4 + 2; 
            // 移除向上偏移，使其向四周爆发并受重力下坠
            this.vel = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed); 
            this.drag = 0.96; // 稍微减小阻力，让轨迹更平滑
            this.gravity = 0.4; // 适中的重力，表现下坠感 (Canvas Y轴向下为正)
            this.decay = 0.02 + Math.random() * 0.02; // 寿命稍长一点点
            
            //  形状随机化：有的长有的短
            this.size = Math.random() * 4 + 2;
            this.scaleX = Math.random() * 0.5 + 0.5; // 宽度变异
            this.scaleY = Math.random() * 1.5 + 1.0; // 长度拉伸 (做成冰刺)
            
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() - 0.5) * 0.5; // 旋转
        } else if (mode === 'smoke') {
            this.vel = new Vec2((Math.random() - 0.5) * 0.5, -Math.random() * 1.5 - 0.5);
            this.drag = 0.98; this.gravity = -0.02; this.decay = 0.015;
            this.size = Math.random() * 6 + 4; this.life = 1.2; 
        } else if (mode === 'line') {
            this.vel = new Vec2(0, 0);
            this.drag = 0.98; this.gravity = 0; this.decay = 0.02;
            this.size = 2; this.life = 1.0;
            this.scale = { x: 1, y: 1 };
        } else if (mode === 'wind_slash') {
            // === 🌪️ 新增：风刃粒子的物理初始化 ===
            this.vel = new Vec2(0, 0); // 外部会设置 vel
            this.drag = 1.0; // 默认无阻力
            this.gravity = 0;
            this.decay = 0.05;
            this.size = 10;
            this.life = 1.0;
        } else {          this.vel = new Vec2((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
            this.drag = 0.92; this.gravity = 0; this.decay = 0.05; this.size = Math.random() * 2 + 1;
        }
        this.maxLife = this.life;
    }

    update(timeScale) {
        if (this.mode === 'ember') {
            this.pos.x += Math.sin(this.life * 10 + this.wobble) * 0.5 * timeScale;
        }
        // 湍流逻辑：在垂直于速度的方向上产生正弦波动
        if (this.turbulence > 0) {
            const speed = this.vel.mag();
            if (speed > 0.1) {
                const perp = new Vec2(-this.vel.y / speed, this.vel.x / speed);
                const wave = Math.sin(this.life * 15 + this.wobble) * this.turbulence;
                this.pos = this.pos.add(perp.mult(wave * timeScale));
            }
        }
        this.pos = this.pos.add(this.vel.mult(timeScale));
        this.vel = this.vel.mult(Math.pow(this.drag, timeScale));
        this.vel.y += this.gravity * timeScale;
        if (this.mode === 'shard' || this.mode === 'mist') {
            this.angle += this.spin * timeScale;
        }
        this.life -= this.decay * timeScale;
    }

    // --- Particle 类的 draw 方法 ---
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // 设置混合模式
        if (this.mode === 'mist' && this.color && this.color.includes('0,0,0')) {
             ctx.globalCompositeOperation = 'source-over'; // 黑烟
        } else if (this.mode === 'shard' || this.mode === 'spark' || this.mode === 'mist' || this.mode === 'wind_slash') {
             ctx.globalCompositeOperation = (this.mode === 'mist' || this.mode === 'wind_slash') ? 'screen' : 'lighter';
        }

        ctx.globalAlpha = Math.max(0, this.life);

        // --- 优化：根据模式简化绘制 ---
        if (this.mode === 'mist') {
            // 只有 Mist 这种大面积粒子才使用渐变
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            // 简化渐变颜色计算
            if (this.color) {
                grad.addColorStop(0, this.color); 
                grad.addColorStop(1, 'rgba(0,0,0,0)');
            } else {
                grad.addColorStop(0, `rgba(207, 250, 254, ${this.life * 0.4})`); 
                grad.addColorStop(1, `rgba(165, 243, 252, 0)`); 
            } 
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();

        } else if (this.mode === 'ember') {
            // [优化] 火焰余烬：增加模糊发光效果，使用 screen 混合模式
            ctx.globalCompositeOperation = 'screen';
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2.5);
            // 核心亮黄，边缘橙红，最外层透明
            grad.addColorStop(0, `rgba(255, 255, 200, ${this.life})`);
            grad.addColorStop(0.3, `rgba(251, 146, 60, ${this.life * 0.8})`);
            grad.addColorStop(1, `rgba(249, 115, 22, 0)`);
            
            ctx.fillStyle = grad;
            ctx.shadowBlur = 10 * this.life;
            ctx.shadowColor = '#f97316';
            ctx.beginPath(); ctx.arc(0, 0, this.size * 2.5, 0, Math.PI * 2); ctx.fill();

        } else if (this.mode === 'shard') {
            // 冰渣保持原样，因为它是纯色填充，开销不大
            ctx.rotate(this.angle);
            ctx.scale(this.scaleX, this.scaleY);
            ctx.fillStyle = this.color; 
            ctx.beginPath();
            ctx.moveTo(0, -this.size);
            ctx.lineTo(this.size * 0.6, 0);
            ctx.lineTo(0, this.size * 1.5);
            ctx.lineTo(-this.size * 0.6, 0);
            ctx.fill();

        } else if (this.mode === 'wind_slash') {
            // === 🌪️ 新增：风刃粒子 (锐利的弯月/线条) ===
            // 根据速度方向旋转
            const angle = Math.atan2(this.vel.y, this.vel.x);
            ctx.rotate(angle);
            
            // 拉伸感：速度越快，拉得越长
            const speed = this.vel.mag();
            const stretch = Math.min(3.0, 1.0 + speed * 0.1); 
            ctx.scale(stretch, 1.0);

            // 颜色：核心亮白，边缘青色
            // 使用线性渐变模拟“刀光”
            const grad = ctx.createLinearGradient(-this.size, 0, this.size, 0);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.2, 'rgba(52, 211, 153, 0.8)'); // 青色边缘
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');   // 核心亮白
            grad.addColorStop(0.8, 'rgba(52, 211, 153, 0.8)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = grad;
            
            // 绘制梭形/刀片形状
            ctx.beginPath();
            ctx.moveTo(-this.size * 1.5, 0);
            ctx.quadraticCurveTo(0, this.size * 0.4, this.size * 1.5, 0); // 上弧
            ctx.quadraticCurveTo(0, -this.size * 0.4, -this.size * 1.5, 0); // 下弧
            ctx.fill();

        } else if (this.mode === 'line') {
            const rot = Math.atan2(this.vel.y, this.vel.x);
            ctx.rotate(rot);
            ctx.scale(this.scale.x, this.scale.y);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-1, 0);
            ctx.lineTo(1, 0);
            ctx.stroke();

        } else {
            // 普通粒子 (spark/normal) 直接画圆，不用渐变
            ctx.fillStyle = this.color;
            if (this.mode === 'spark') {
                const rot = Math.atan2(this.vel.y, this.vel.x);
                ctx.rotate(rot);
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size * 2, this.size * 0.4, 0, 0, Math.PI * 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            }
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// --- [新增] 斩击特效类 ---
class SlashEffect {
    constructor(x, y, angle, length, color) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.length = length;
        this.color = color || '#0ea5e9'; // 默认青色
        this.width = 6;      // 斩击最大宽度
        this.life = 1.0;     // 生命周期 (1.0 -> 0.0)
        this.decay = 0.06;   // 消散速度 (约 16 帧)
        this.active = true;
    }

    update() {
        this.life -= this.decay;
        if (this.life <= 0) this.active = false;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 使用滤色模式，让光效叠加更亮
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, this.life);

        // --- 1. 核心光束 (亮白) ---
        ctx.beginPath();
        // 绘制两头尖、中间宽的梭形
        // 随时间变细 (this.width * this.life)
        const currentW = this.width * this.life;
        const halfL = this.length / 2;

        ctx.moveTo(-halfL, 0);
        ctx.quadraticCurveTo(0, -currentW, halfL, 0); // 上弧
        ctx.quadraticCurveTo(0, currentW, -halfL, 0); // 下弧

        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();

        // --- 2. 外部光晕 (彩色) ---
        ctx.beginPath();
        // 光晕比核心宽一点，长一点
        ctx.moveTo(-(halfL + 20), 0);
        const glowW = currentW * 2.5;
        ctx.quadraticCurveTo(0, -glowW, (halfL + 20), 0);
        ctx.quadraticCurveTo(0, glowW, -(halfL + 20), 0);

        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life * 0.6); // 光晕稍微淡一点
        ctx.shadowBlur = 20;
        ctx.fill();

        // --- 3. 横向闪光 (Impact Cross) ---
        // 在中心加一道垂直的小光束，模拟斩击爆发点
        if (this.life > 0.5) {
            ctx.globalAlpha = (this.life - 0.5) * 2;
            ctx.beginPath();
            ctx.moveTo(0, -30);
            ctx.lineTo(0, 30);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }
}


// --- 新增：收集完成的光柱特效 ---
class CollectionBeam {
    constructor(x, bottomY) {
        this.x = x;
        this.bottomY = bottomY;
        this.width = 60; // 光柱宽度
        this.life = 1.0;
        this.decay = 0.04;
        this.height = 0;
        this.maxHeight = bottomY + 100; // 向上延伸的高度
    }

    update(timeScale) {
        this.life -= this.decay * timeScale;
        // 光柱快速冲高
        this.height = lerp(this.height, this.maxHeight, 0.2 * timeScale);
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 1. 核心光柱 (向上渐变消失)
        const grad = ctx.createLinearGradient(this.x, this.bottomY, this.x, this.bottomY - this.height);
        grad.addColorStop(0, `rgba(255, 255, 255, ${this.life})`);
        grad.addColorStop(0.4, `rgba(14, 165, 233, ${this.life * 0.5})`); // Sky Blue
        grad.addColorStop(1, `rgba(14, 165, 233, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        // 梯形光柱 (底部窄，上部宽)
        const wBottom = this.width * 0.4;
        const wTop = this.width;
        
        ctx.moveTo(this.x - wBottom, this.bottomY);
        ctx.lineTo(this.x + wBottom, this.bottomY);
        ctx.lineTo(this.x + wTop, this.bottomY - this.height);
        ctx.lineTo(this.x - wTop, this.bottomY - this.height);
        ctx.fill();

        // 2. 底部爆发光晕
        const glowSize = 40 * this.life;
        const radial = ctx.createRadialGradient(this.x, this.bottomY, 0, this.x, this.bottomY, glowSize);
        radial.addColorStop(0, `rgba(255, 255, 255, ${this.life})`);
        radial.addColorStop(1, `rgba(14, 165, 233, 0)`);
        
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(this.x, this.bottomY, glowSize, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}
class Shockwave {
    constructor(x, y, color) { 
        this.x = x; 
        this.y = y; 
        this.radius = 1; 
        this.alpha = 1.0; 
        this.color = color || '#ffffff'; 
        this.maxRadius = 120; // 稍微加大一点爆炸范围视觉
    }

    update(timeScale) { 
        this.radius += 4 * timeScale; // 扩散速度
        this.alpha -= 0.04 * timeScale; // 消失速度
    }

    draw(ctx) { 
        if(this.alpha <= 0) return; 
        ctx.save(); 
        
        // --- 核心修改：让波纹发光 ---
        ctx.globalCompositeOperation = 'lighter'; 
        ctx.globalAlpha = this.alpha;
        
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); 
        
        // 1. 填充部 (很淡)
        ctx.fillStyle = this.color; 
        ctx.globalAlpha = this.alpha * 0.2; 
        ctx.fill();

        // 2. 高亮边缘 (冲击波本体)
        ctx.globalAlpha = this.alpha; 
        ctx.strokeStyle = this.color; 
        ctx.lineWidth = 4; // 稍微加粗
        ctx.stroke(); 
        
        // 3. 内部的一圈细线 (增加层次感)
        if (this.radius > 10) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI*2);
            ctx.lineWidth = 1;
            ctx.globalAlpha = this.alpha * 0.5;
            ctx.stroke();
        }
        
        ctx.restore(); 
    }
}

// --- 新增：激光光束特效 ---
class LaserBeam {
    constructor(segments, width, color) {
        this.segments = segments; // Array of Vec2 points [start, p1, p2, end]
        this.width = width;
        this.initialWidth = width;
        this.color = color;
        this.life = 1.0; 
        this.decay = 0.04; // 消失速度
    }

    update(timeScale) {
        this.life -= this.decay * timeScale;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // 使用 lighter 让叠加部分更亮
        ctx.globalCompositeOperation = 'lighter';
        
        const currentWidth = this.initialWidth * this.life;
        const opacity = Math.pow(this.life, 0.5); // 非线性透明度

        // 1. 外发光 (宽且淡)
        ctx.beginPath();
        ctx.moveTo(this.segments[0].x, this.segments[0].y);
        for (let i = 1; i < this.segments.length; i++) {
            ctx.lineTo(this.segments[i].x, this.segments[i].y);
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = currentWidth * 2.5;
        ctx.globalAlpha = opacity * 0.3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.stroke();

        // 2. 核心光束 (窄且亮)
        ctx.beginPath();
        ctx.moveTo(this.segments[0].x, this.segments[0].y);
        for (let i = 1; i < this.segments.length; i++) {
            ctx.lineTo(this.segments[i].x, this.segments[i].y);
        }
        ctx.strokeStyle = '#ffffff'; // 核心总是白色
        ctx.lineWidth = currentWidth;
        ctx.globalAlpha = opacity;
        ctx.shadowBlur = 10;
        ctx.stroke();

        ctx.restore();
    }
}

class FloatingText {
    /**
     * 浮动文字特效类
     * @param {number} x - x 坐标
     * @param {number} y - y 坐标
     * @param {string} text - 文本
     * @param {string} [color='#fbbf24'] - 颜色 (默认为金色)
     */
    constructor(x, y, text, color = '#fbbf24') { 
        this.pos = new Vec2(x, y); 
        this.vel = new Vec2(0, -1); // 向上飄
        this.life = 1.0; 
        this.text = text; 
        this.color = color; 
    }

    update(timeScale) { 
        this.pos = this.pos.add(this.vel.mult(timeScale)); 
        this.life -= 0.02 * timeScale; 
    }

    draw(ctx) { 
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life); 
        ctx.font = 'bold 16px sans-serif'; 
        ctx.textAlign = 'center';
        
        // 繪製描邊讓文字更清楚
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(this.text, this.pos.x, this.pos.y);
        
        // 繪製填充
        ctx.fillStyle = this.color; 
        ctx.fillText(this.text, this.pos.x, this.pos.y); 
        ctx.restore();
    }
}
// --- 新增：能量球特效 (带拖尾的贝塞尔曲线运动) ---

// --- 修改后的 EnergyOrb 类：物理爆发 + 磁力吸附 ---
// --- 物理优化版 EnergyOrb：溅射 -> 滞空上浮 -> 强力吸附 ---
class EnergyOrb {
    /**
     * @param {number} x 起始X
     * @param {number} y 起始Y
     * @param {number} targetX 目标UI X
     * @param {number} targetY 目标UI Y
     * @param {string} color 颜色
     * @param {Vec2} initialVel 弹珠碰撞时的初速度
     * @param {Function} onArrive 到达回调
     */
    constructor(x, y, targetX, targetY, color, initialVel, onArrive) {
        this.pos = new Vec2(x, y);
        this.target = new Vec2(targetX, targetY);
        this.onArrive = onArrive;
        this.color = color || '#fbbf24';

        // 物理参数
        let burstVel = new Vec2(initialVel.x *3.2, initialVel.y * 0.72);
        const spreadAngle = (Math.random() - 0.5) * 0.6;
        this.vel = burstVel.rotate(spreadAngle);
        
        if (this.vel.mag() < 3) {
            this.vel = this.vel.norm().mult(3);
        }

        this.active = true;
        
        // --- 优化：减少拖尾长度 ---
        this.trail = []; 
        this.maxTrailLen = 8; // 原来是12，减少到8，降低绘制循环次数

        this.baseSize = 2.5; 
        this.timer = 0;
        this.seed = Math.random() * 100;

        this.hoverTime = 20;     
        this.friction = 0.88;    
        this.floatForce = 0.21;  
        this.suctionAcc = 0.07;  
        this.currentSuction = 0; 
    }

    update(timeScale) {
        if (!this.active) return;
        this.timer += timeScale;

        // 1. 滞空阻力
        this.vel = this.vel.mult(Math.pow(this.friction, timeScale));
        // 2. 上浮力
        this.vel.y -= this.floatForce * timeScale;

        // 3. 吸附逻辑
        if (this.timer > this.hoverTime) {
            let dir = this.target.sub(this.pos);
            const dist = dir.mag();

            if (dist < 20) { 
                this.active = false;
                if (this.onArrive) this.onArrive();
                return;
            }

            dir = dir.norm();
            this.currentSuction += this.suctionAcc * timeScale;
            this.vel = this.vel.add(dir.mult(this.currentSuction * timeScale));
        }

        this.pos = this.pos.add(this.vel.mult(timeScale));

        // 更新拖尾 (只存简单的 x,y 对象，减少 Vec2 开销)
        this.trail.push({x: this.pos.x, y: this.pos.y});
        if (this.trail.length > this.maxTrailLen) this.trail.shift(); 
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        
        // 关键优化：使用 lighter 混合模式代替阴影来实现发光
        // 这比 shadowBlur 快得多
        ctx.globalCompositeOperation = 'lighter'; 

        // ------------------------------------
        // 1. 绘制极简拖尾
        // ------------------------------------
        if (this.trail.length > 2) {
            // 优化：不再分段绘制不同宽度，而是画一条连贯的线
            ctx.beginPath();
            const len = this.trail.length;
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            
            // 使用二次贝塞尔曲线让拖尾更平滑（可选，这里用直线够快了）
            for (let i = 1; i < len; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }

            ctx.lineCap = 'round';
            ctx.lineWidth = this.baseSize; 
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = 0.3; // 低透明度
            
            // 彻底移除循环内的 shadow 设置
            ctx.shadowBlur = 0; 
            ctx.stroke();
        }

        // ------------------------------------
        // 2. 绘制核心 (无渐变优化版)
        // ------------------------------------
        
        // 计算闪烁
        const flicker = 0.8 + Math.sin(this.timer * 0.5 + this.seed) * 0.2;
        
        // 绘制外发光 (用半透明实心圆代替渐变)
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.4; // 降低透明度模拟光晕
        // 大小随闪烁变化
        ctx.arc(this.pos.x, this.pos.y, this.baseSize * 2.5 * flicker, 0, Math.PI * 2);
        ctx.fill();

        // 绘制核心亮点
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1.0;
        ctx.arc(this.pos.x, this.pos.y, this.baseSize * 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class LightningBolt {
    constructor(x1, y1, x2, y2) {
        this.start = new Vec2(x1, y1);
        this.end = new Vec2(x2, y2);
        this.life = 1.0; 
        this.progress = 0; // [新增] 生长进度 (0.0 -> 1.0)
        this.segments = [];
        this.generateSegments();
    }

    generateSegments() {
        const dist = this.start.dist(this.end);
        const steps = Math.floor(dist / 10); // 每10像素一個節點
        let current = this.start;
        const tangent = this.end.sub(this.start).norm();
        const normal = new Vec2(-tangent.y, tangent.x); // 法向量

        for (let i = 0; i < steps; i++) {
            const t = (i + 1) / steps;
            // 線性插值位置
            const basePos = this.start.add(this.end.sub(this.start).mult(t));
            // 隨機偏移 (中間偏移大，兩端小)
            const offsetAmount = Math.sin(t * Math.PI) * 30; 
            const jitter = normal.mult((Math.random() - 0.5) * offsetAmount);
            
            const nextPos = (i === steps - 1) ? this.end : basePos.add(jitter);
            
            // 主幹
            this.segments.push({ p1: current, p2: nextPos, width: 3, alpha: 1.0 });

            // 隨機生成分支
            if (Math.random() < 0.3) {
                const branchEnd = nextPos.add(new Vec2((Math.random()-0.5)*40, (Math.random()-0.5)*40));
                this.segments.push({ p1: nextPos, p2: branchEnd, width: 1, alpha: 0.6 });
            }
            current = nextPos;
        }
    }
    update(timeScale) {
        // [优化] 闪电链生长动画：先快速生长，再缓慢消失 (放慢消失速度以提升视觉快感)
        if (this.progress < 1.0) {
            this.progress += 0.12 * timeScale; // 生长速度稍微放慢 (原 0.15)
        } else {
            this.life -= 0.04 * timeScale; // 消失速度大幅放慢 (原 0.08)，让闪电在屏幕上停留更久
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // 閃爍效果
        const flicker = Math.random() > 0.5 ? 1 : 0.5;
        const opacity = this.life * flicker;

        // [优化] 根据 progress 决定绘制哪些线段 (添加边界检查防止 undefined)
        const visibleCount = Math.min(this.segments.length, Math.floor(this.segments.length * this.progress));

        for (let i = 0; i < visibleCount; i++) {
            const seg = this.segments[i];
            if (!seg) continue;
            ctx.beginPath();
            ctx.moveTo(seg.p1.x, seg.p1.y);
            ctx.lineTo(seg.p2.x, seg.p2.y);

            // 1. 繪製紫色光暈 (寬線條)
            ctx.strokeStyle = `rgba(192, 132, 252, ${opacity * seg.alpha * 0.5})`; // Purple-400
            ctx.lineWidth = seg.width * 4;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#c084fc';
            ctx.stroke();

            // 2. 繪製白色核心 (細線條)
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * seg.alpha})`;
            ctx.lineWidth = seg.width;
            ctx.shadowBlur = 0;
            ctx.stroke();
        }

        // [优化] 只有当生长完成或接近完成时才绘制终点光球
        if (this.progress > 0.8) {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(this.start.x, this.start.y, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(this.end.x, this.end.y, 4, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore();
    }
}

class FireWave {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.maxRadius = 80; // 擴散範圍
        this.life = 1.0;
    }

    update(timeScale) {
        this.radius += 5 * timeScale; // 擴散速度
        this.life -= 0.05 * timeScale;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        // 使用 lighter 混合模式讓火焰看起來更亮
        ctx.globalCompositeOperation = 'lighter'; 
        
        const grad = ctx.createRadialGradient(this.x, this.y, this.radius * 0.6, this.x, this.y, this.radius);
        grad.addColorStop(0, `rgba(255, 200, 0, 0)`); // 中心透明
        grad.addColorStop(0.5, `rgba(249, 115, 22, ${this.life * 0.8})`); // 橙色火焰
        grad.addColorStop(1, `rgba(255, 0, 0, 0)`); // 邊緣透明

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ==================== 玩家实体类 ====================

/**
 * Player 类 - 管理发射器（炮台）、属性轨道、瞄准线
 * 
 * 职责：
 * - 管理发射器的状态和渲染
 * - 管理属性轨道（Orbitals）的动画和渲染
 * - 管理瞄准线的绘制
 * - 处理玩家输入（瞄准、发射）
 * 
 * 整合自 core.js 中分散的发射器相关代码
 */
class Player {
    /**
     * 玩家类构造函数
     * @param {Game} game - 游戏实例引用
     */
    constructor(game) {
        this.game = game;
        
        // === 位置 ===
        // 发射器固定在屏幕底部中央
        this.pos = new Vec2(game.width / 2, game.height - 80);
        
        // === 发射状态 ===
        this.isChargingShot = false;    // 蓄力吸收中
        this.chargeProgress = 0;        // 蓄力进度 (0 → 1)
        this.pendingFireVelocity = null; // 待发射的速度向量
        
        // === 装填状态 ===
        this.isReloading = false;       // 装填抓取中
        this.reloadProgress = 0;        // 装填进度 (0 → 1)
        
        // === 轨道状态 ===
        this.orbitalAngle = 0;          // 当前轨道旋转角度（弧度）
        this.spinBoost = 0;             // 额外旋转速度（受撞击增加）
        
        // === 瞄准状态 ===
        this.isDragging = false;        // 是否正在拖拽瞄准
        this.dragStart = new Vec2(0, 0); // 拖拽起始点
        this.dragCurrent = new Vec2(0, 0); // 当前拖拽位置
        this.lastMousePos = new Vec2(0, 0); // 最后鼠标位置
        
        // === 视觉参数 ===
        this.baseRadius = 22;           // 发射器基础半径
        this.previewRotation = -Math.PI / 2; // 预览旋转角度（默认朝上）
        this.deformation = { x: 1, y: 1 };   // 形变参数
    }
    
    /**
     * 获取发射器当前位置
     * @returns {Vec2} 发射器位置
     */
    getPosition() {
        return new Vec2(this.pos.x, this.pos.y);
    }
    
    /**
     * 更新发射器位置（用于窗口大小变化时）
     */
    updatePosition() {
        this.pos.x = this.game.width / 2;
        this.pos.y = this.game.height - 80;
    }
    
    // ==================== 核心更新方法 ====================
    
    /**
     * 每帧更新发射器物理状态
     * @param {number} timeScale - 时间缩放系数
     */
    update(timeScale) {
        // 1. 蓄力进度更新
        this.updateCharging(timeScale);
        
        // 2. 装填进度更新
        this.updateReloading(timeScale);
        
        // 3. 轨道旋转物理
        this.updateOrbitalPhysics(timeScale);
    }
    
    /**
     * 更新蓄力状态
     * @param {number} timeScale - 时间缩放系数
     */
    updateCharging(timeScale) {
        if (!this.isChargingShot) return;
        
        // 吸收速度：0.08 大约需要 12 帧 (0.2秒)，手感比较干脆
        this.chargeProgress += 0.08 * timeScale;
        
        if (this.chargeProgress >= 1.0) {
            // 动画结束，真正发射
            this.isChargingShot = false;
            this.chargeProgress = 0;
            
            if (this.pendingFireVelocity) {
                this.game.combat_fireNextShot(this.pendingFireVelocity);
                this.pendingFireVelocity = null;
                
                // 发射后立即触发"能量注入"动画
                this.triggerReload();
            }
        }
    }
    
    /**
     * 更新装填状态
     * @param {number} timeScale - 时间缩放系数
     */
    updateReloading(timeScale) {
        if (!this.isReloading) return;
        
        // 速度 0.035，让过程持续约 0.5秒，更具重量感
        this.reloadProgress += 0.035 * timeScale;
        
        if (this.reloadProgress >= 1.0) {
            this.isReloading = false;
            this.reloadProgress = 1.0;
            
            // 撞击时刻！给予轨道一个巨大的旋转初速度
            // 就像能量球狠狠砸在了轨道上，带动它疑狂旋转
            this.spinBoost = 0.002;
        }
    }
    
    /**
     * 更新轨道旋转物理
     * @param {number} timeScale - 时间缩放系数
     */
    updateOrbitalPhysics(timeScale) {
        // 基础旋转速度
        const baseSpeed = 0.00012;
        
        // 阻力衰减：每一帧速度乘以 0.95，快速慢下来
        this.spinBoost *= 0.95;
        if (this.spinBoost < 0.0001) this.spinBoost = 0;
        
        // 最终角度累加：基础速度 + 爆发速度
        let currentFrameSpeed = baseSpeed + this.spinBoost;
        this.orbitalAngle += currentFrameSpeed * timeScale * 60;
    }
    
    /**
     * 触发装填动画
     */
    triggerReload() {
        this.isReloading = true;
        this.reloadProgress = 0;
    }
    
    // ==================== 输入处理方法 ====================
    
    /**
     * 开始瞄准
     * @param {Vec2} mousePos - 鼠标位置
     * @returns {boolean} 是否成功开始瞄准
     */
    startAiming(mousePos) {
        // 检查是否可以开始瞄准
        if (this.game.ammoQueue.length === 0) return false;
        if (this.game.projectiles.length > 0) return false;
        if (this.game.burstQueue.length > 0) return false;
        
        this.isDragging = true;
        this.dragStart = this.getPosition();
        this.dragCurrent = mousePos;
        this.lastMousePos = mousePos;
        
        return true;
    }
    
    /**
     * 更新瞄准方向
     * @param {Vec2} mousePos - 鼠标位置
     */
    updateAiming(mousePos) {
        if (!this.isDragging) return;
        this.dragCurrent = mousePos;
        this.lastMousePos = mousePos;
    }
    
    /**
     * 结束瞄准并尝试发射
     * @returns {boolean} 是否触发了发射
     */
    endAiming() {
        if (!this.isDragging) return false;
        
        this.isDragging = false;
        const aimVector = this.lastMousePos.sub(this.pos);
        
        // 只有向上拖拽才发射
        if (aimVector.y < -20) {
            this.game.sys_resetMultiplier();
            
            // 保存计算好的力度，开启蓄力
            this.pendingFireVelocity = aimVector.norm().mult(12);
            this.isChargingShot = true;
            this.chargeProgress = 0;
            
            // 播放蓄力开始音效
            if (audio) audio.playTone(800, 'sine', 0.1, 0.1);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * 检查是否可以发射
     * @returns {boolean}
     */
    canFire() {
        return this.game.ammoQueue.length > 0 && 
               this.game.projectiles.length === 0 && 
               this.game.burstQueue.length === 0;
    }
    
    // ==================== 渲染方法 ====================
    
    /**
     * 绘制玩家（发射器 + 轨道 + 瞄准线）
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    draw(ctx) {
        const nextAmmo = this.game.ammoQueue.length > 0 ? this.game.ammoQueue[0] : null;
        
        // 计算当前绘制位置（可能有抖动）
        const drawPos = this.calculateDrawPosition();
        
        // 1. 绘制瞄准线（如果正在瞄准）
        if (this.isDragging && this.canFire()) {
            this.drawAimLine(ctx);
        }
        
        // 2. 绘制发射器底座
        this.drawBase(ctx, drawPos);
        
        // 3. 绘制属性轨道（在炮台核心下面）
        if (nextAmmo) {
            this.drawOrbitals(ctx, drawPos, nextAmmo);
        }
        
        // 4. 绘制炮台核心
        this.drawCore(ctx, drawPos, nextAmmo);
    }
    
    /**
     * 计算绘制位置（含抖动效果）
     * @returns {Vec2} 绘制位置
     */
    calculateDrawPosition() {
        const drawPos = this.getPosition();
        
        // 蓄力时的抖动效果
        if (this.isChargingShot) {
            const shake = Math.random() * 2;
            drawPos.x += (Math.random() - 0.5) * shake;
            drawPos.y += (Math.random() - 0.5) * shake;
        }
        
        return drawPos;
    }
    
    /**
     * 计算形变参数
     * @returns {object} 形变参数 {x, y}
     */
    calculateDeformation() {
        let deformation = { x: 1, y: 1 };
        
        // 拖拽时的形变
        if (this.isDragging) {
            const force = this.dragStart.sub(this.dragCurrent);
            if (force.mag() > 10) {
                deformation = { x: 1.15, y: 0.85 };
            }
        }
        
        // 蓄力时的放大
        if (this.isChargingShot) {
            const absorbScale = 1.0 + this.chargeProgress * 0.3;
            deformation.x *= absorbScale;
            deformation.y *= absorbScale;
        }
        
        return deformation;
    }
    
    /**
     * 计算预览旋转角度
     * @returns {number} 旋转角度（弧度）
     */
    calculatePreviewRotation() {
        if (this.isDragging) {
            const force = this.dragStart.sub(this.dragCurrent);
            if (force.mag() > 10) {
                return Math.atan2(force.y, force.x);
            }
        }
        return -Math.PI / 2; // 默认朝上
    }
    
    /**
     * 绘制发射器底座
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     * @param {Vec2} pos - 绘制位置
     */
    drawBase(ctx, pos) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // 深色半透明底 (Slate-900 80%)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.baseRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    /**
     * 绘制炮台核心
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     * @param {Vec2} pos - 绘制位置
     * @param {object|null} nextAmmo - 下一发弹药配方
     */
    drawCore(ctx, pos, nextAmmo) {
        if (nextAmmo) {
            const params = Projectile.calculateVisualParams(nextAmmo, false);
            const previewRotation = this.calculatePreviewRotation();
            const deformation = this.calculateDeformation();
            
            Projectile.drawVisuals(
                ctx, 
                pos.x, 
                pos.y, 
                params.radius, 
                nextAmmo, 
                previewRotation, 
                params.intensity, 
                deformation
            );
        } else {
            // 空仓状态
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#475569';
            ctx.stroke();
        }
    }
    
    /**
     * 绘制属性轨道
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     * @param {Vec2} pos - 中心位置
     * @param {object} recipe - 弹药配方
     */
    drawOrbitals(ctx, pos, recipe) {
        if (!recipe) return;
        
        // 收集属性统计
        const stats = [];
        const mapping = {
            damage:    { val: recipe.damage > 2 ? recipe.damage : 0 },
            bounce:    { val: recipe.bounce },
            pierce:    { val: recipe.pierce },
            scatter:   { val: recipe.scatter },
            cryo:      { val: recipe.cryo },
            multicast: { val: recipe.multicast },
            pyro:      { val: recipe.pyro },
            lightning: { val: recipe.lightning },
            laser:     { val: recipe.laser },
            explosive: { val: recipe.explosive ? 1 : 0 },
            flying_sword: { val: recipe.flying_sword || 0 }
        };
        
        Object.keys(mapping).forEach(key => {
            mapping[key].color = CONFIG.ui.attributeDisplay[key].color;
            mapping[key].icon = CONFIG.ui.attributeDisplay[key].icon;
            if (mapping[key].val > 0) stats.push(mapping[key]);
        });
        
        if (stats.length === 0) return;
        
        // === 动画数值计算 ===
        let currentRotation = this.orbitalAngle;
        let baseRadius = 55;
        let globalAlpha = 1.0;
        let orbScale = 1.0;
        
        if (this.isChargingShot) {
            const t = this.chargeProgress;
            baseRadius = 55 * (1 - t * t);
            currentRotation += t * 2; // 吸收时稍微加速旋转
            if (t > 0.8) globalAlpha = 1.0 - (t - 0.8) * 5;
            orbScale = 1 - t * 0.6;
        } else if (this.isReloading) {
            const t = this.reloadProgress;
            // 使用 EaseInCubic，能量球会从远处缓缓启动，快撞击时猛地加速
            const easeVal = t * t * t;
            const startDist = 450; // 从更远的地方（屏幕外）抓取回来
            const endDist = 55;
            baseRadius = startDist + (endDist - startDist) * easeVal;
            globalAlpha = easeVal;
            orbScale = 0.3 + 0.7 * easeVal;
            // 抓取时由于还没"合体"，产生轻微的抖动感
            const shake = (1 - t) * 5;
            baseRadius += (Math.random() - 0.5) * shake;
        }
        
        const radius = baseRadius;
        const stepAngle = (Math.PI * 2) / stats.length;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.globalAlpha = Math.max(0, globalAlpha);
        
        // 绘制轨道线（仅在非吸收状态画）
        if (radius > 15 && radius < 150) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * globalAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // 绘制每个属性球
        stats.forEach((stat, index) => {
            const angle = stepAngle * index + currentRotation;
            const ox = Math.cos(angle) * radius;
            const oy = Math.sin(angle) * radius;
            
            // 防御性检查：如果计算出的位置不是有效的数字，跳过绘制
            if (!isFinite(ox) || !isFinite(oy)) return;
            
            const speedGlow = Math.min(1, this.spinBoost * 2); // 撞击后的高光
            ctx.shadowBlur = (10 + speedGlow * 20) * orbScale;
            ctx.shadowColor = stat.color;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            
            const baseSize = Math.min(22, 14 + stat.val * 0.5);
            const currentSize = Math.max(0, baseSize * orbScale);
            
            // 绘制属性球
            ctx.beginPath();
            ctx.arc(ox, oy, currentSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = stat.color;
            ctx.lineWidth = (2 + speedGlow * 2) * orbScale;
            ctx.stroke();
            
            // 拖尾特效（增强撞击爆发感）
            const totalTrail = this.spinBoost * 3 + (this.isReloading ? (1 - this.reloadProgress) * 0.5 : 0);
            if (totalTrail > 0.05) {
                ctx.beginPath();
                ctx.strokeStyle = stat.color;
                ctx.lineWidth = 2 * orbScale;
                const dir = this.isReloading ? 1 : -1;
                ctx.arc(0, 0, radius, angle, angle + totalTrail * dir, this.isReloading);
                ctx.stroke();
            }
            
            // 绘制文字（仅在大小合适时）
            if (radius < 200 && currentSize > 8) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                if (stat.isMulticast) {
                    ctx.font = `bold ${12 * orbScale}px monospace`;
                    ctx.fillText(`x${1 + stat.val}`, ox, oy);
                } else {
                    ctx.font = `${10 * orbScale}px sans-serif`;
                    if (stat.val > 1) {
                        ctx.fillText(stat.icon, ox, oy - 5 * orbScale);
                        ctx.font = `bold ${9 * orbScale}px sans-serif`;
                        ctx.fillStyle = stat.color;
                        ctx.fillText(`${stat.val}`, ox, oy + 6 * orbScale);
                    } else {
                        ctx.font = `${14 * orbScale}px sans-serif`;
                        ctx.fillText(stat.icon, ox, oy);
                    }
                }
            }
        });
        
        ctx.restore();
    }
    
    /**
     * 绘制瞄准线
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    drawAimLine(ctx) {
        const start = this.getPosition();
        let force = this.lastMousePos.sub(start);
        
        // 只有向上拖拽才绘制
        if (force.y >= -20) return;
        
        const maxLen = 800;
        const radius = CONFIG.physics.bulletRadius;
        let dir = force.norm();
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        
        // 计算与边界的交点
        let distToX = Infinity;
        let distToY = Infinity;
        
        if (dir.x > 0) distToX = (this.game.width - radius - start.x) / dir.x;
        else if (dir.x < 0) distToX = (radius - start.x) / dir.x;
        if (dir.y < 0) distToY = (radius - start.y) / dir.y;
        
        let hitDist = Math.min(distToX, distToY);
        
        if (hitDist < maxLen) {
            // 绘制到碰撞点
            const hitPoint = start.add(dir.mult(hitDist));
            ctx.lineTo(hitPoint.x, hitPoint.y);
            
            // 计算反射方向
            const remainLen = maxLen - hitDist;
            let reflectDir = new Vec2(dir.x, dir.y);
            if (distToX < distToY) reflectDir.x *= -1;
            else reflectDir.y *= -1;
            
            // 绘制反射线
            const endPoint = hitPoint.add(reflectDir.mult(remainLen));
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.stroke();
            
            // 绘制终点标记
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.arc(endPoint.x, endPoint.y, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 直接绘制到最大长度
            const end = start.add(dir.mult(maxLen));
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // 绘制瞄准指示器（炮台方向）
        ctx.save();
        ctx.translate(start.x, start.y);
        ctx.rotate(Math.atan2(force.y, force.x));
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#818cf8';
        ctx.fillRect(10, -6, 12, 12);
        ctx.restore();
    }
    
    /**
     * 绘制空闲状态的炮台（无弹药时）
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    drawIdleCannon(ctx) {
        const start = this.getPosition();
        
        ctx.save();
        ctx.translate(start.x, start.y);
        ctx.rotate(-Math.PI / 2); // 朝上
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(8, -4, 8, 8);
        ctx.restore();
    }
}


// ==================== 导出实体类 ====================
// 注意：showToast 和 rotateTowards 已经在文件中间声明，不需要重复声明

export {
    Vec2,
    MarbleDefinition,
    SpecialSlot,
    FortuneWheel,
    Peg,
    DropBall,
    Enemy,
    SwordQi,
    SlashAnim,
    SonSword,
    Projectile,
    CloneSpore,
    Particle,
    SlashEffect,
    CollectionBeam,
    Shockwave,
    LaserBeam,
    FloatingText,
    EnergyOrb,
    LightningBolt,
    FireWave,
    Player,
    showToast,
    rotateTowards,
    adjustColorBrightness,
    lerpColor,
    lerp,
    hexToRgba
};
