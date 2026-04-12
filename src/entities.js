/**
 * entities.js - 游戏实体层（聚合入口）
 * 
 * 职责：
 * - 作为实体系统的聚合入口，re-export 所有实体类
 * - 管理音频依赖注入（统一分发给各子模块）
 * 
 * 本文件包含的类（直接定义）：
 * - MarbleDefinition: 弹珠定义
 * - SpecialSlot: 特殊槽位
 * - FortuneWheel: 命运轮盘
 * - Peg: 钉子
 * - DropBall: 下落的弹珠
 * - SwordQi, SlashAnim, SonSword: 飞剑系统
 * - CloneSpore: 分身孢子
 * - Player: 玩家实体
 * - RuneLoot: 符文掉落
 * 
 * 已迁移到独立文件（通过 import 引入后 re-export）：
 * - Vec2 等工具函数 → src/utils/math_utils.js
 * - Particle 等特效类 → src/effects/particles.js
 * - Enemy → src/entities/enemy.js（Task 2.2）
 * - Projectile → src/entities/projectile.js（Task 2.2）
 * 
 * 重构历史：
 * - Task 2.1: 提取工具函数到 math_utils.js，提取视觉特效到 particles.js
 * - Task 2.2: 提取 Enemy 到 entities/enemy.js，提取 Projectile 到 entities/projectile.js
 */
import { CONFIG } from './config.js';
import { 
    adjustColorBrightness, lerpColor, lerp, hexToRgba, 
    Vec2, showToast, rotateTowards 
} from './utils/math_utils.js';
import { 
    Particle, SlashEffect, CollectionBeam, Shockwave, LaserBeam, 
    FloatingText, EnergyOrb, LightningBolt, FireWave 
} from './effects/particles.js';
import { Enemy, setEnemyAudioProvider } from './entities/enemy.js';
import { Projectile, setProjectileAudioProvider } from './entities/projectile.js';
import { RUNE_DB } from './rune_config.js';

// ==================== 音频依赖注入 (重构 v2) ====================
// 移除 Proxy 方案和 window.audio 依赖
// 改用依赖注入：由 core.js 在音频初始化后调用 setAudioProvider()
let _audioProvider = null;

/**
 * 设置音频提供者（由 core.js 调用）
 * @param {SoundManager} provider - SoundManager 实例
 */
function setAudioProvider(provider) {
    _audioProvider = provider;
    // [Task 2.2] 同步设置拆分出的子模块的音频提供者
    setEnemyAudioProvider(provider);
    setProjectileAudioProvider(provider);
}

/**
 * 安全的音频访问代理
 * 在 SoundManager 未初始化时，所有方法调用静默失败
 */
const audio = new Proxy({}, {
    get: (target, prop) => {
        if (_audioProvider) {
            const val = _audioProvider[prop];
            if (typeof val === 'function') {
                return val.bind(_audioProvider);
            }
            return val;
        }
        // 未初始化时返回空函数，静默失败
        if (prop === 'ctx') return null;
        if (prop === 'muted') return false;
        return () => {};
    }
});

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
     * 特殊槽位类（双钉子连线触发模式）
     * 弹珠穿越两个相邻钉子之间的连线区域时触发效果。
     * @param {number} x  - 第一个钉子的 x 坐标
     * @param {number} y  - 第一个钉子的 y 坐标
     * @param {number} x2 - 第二个钉子的 x 坐标
     * @param {number} y2 - 第二个钉子的 y 坐标
     * @param {string} type - 槽位类型 ('recall' | 'multicast' | 'split' | 'relic' | 'giant' | 'skill_point' | 'wheel')
     */
    constructor(x, y, x2, y2, type) {
        this.x = x;   this.y = y;
        this.x2 = x2; this.y2 = y2;
        // 保留 width 以便旧代码兼容（取两点距离）
        this.width = Math.hypot(x2 - x, y2 - y);
        this.height = 12; // 触发带宽（点到线段距离阈值）
        this.type = type;
        this.animTimer = 0;
        this.hit = false;
    }

    /**
     * 绘制连线槽位：在两个钉子之间画发光连线，并在中点显示符号。
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (this.hit) return;

        this.animTimer += 0.05;
        let color = '#fff'; let text = '';
        if (this.type === 'recall')      { color = CONFIG.colors.slotRecall;    text = '↺'; }
        else if (this.type === 'multicast') { color = CONFIG.colors.slotMulticast; text = '+2'; }
        else if (this.type === 'split')     { color = CONFIG.colors.slotSplit;     text = '⑂'; }
        else if (this.type === 'relic')     { color = '#facc15';                   text = '🏆'; }
        else if (this.type === 'giant')     { color = CONFIG.colors.slotGiant;     text = '⬆️'; }
        else if (this.type === 'skill_point') { color = CONFIG.colors.slotSkill;   text = '★'; }
        else if (this.type === 'wheel')     { color = CONFIG.colors.slotWheel;     text = '🎡'; }

        const glow   = Math.sin(this.animTimer) * 4 + 8;   // 呼吸光晕幅度
        const pulse  = 0.5 + Math.sin(this.animTimer) * 0.25; // 透明度脉冲 0.25~0.75
        const midX   = (this.x + this.x2) / 2;
        const midY   = (this.y + this.y2) / 2;

        ctx.save();

        // --- 1. 绘制发光连线 ---
        ctx.shadowBlur  = glow;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2.5;
        ctx.globalAlpha = pulse;
        ctx.setLineDash([6, 4]); // 虚线样式，增加魔法感
        ctx.lineDashOffset = -(Date.now() / 60) % 10; // 流动动画

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        ctx.setLineDash([]); // 恢复实线

        // --- 2. 在两端钉子处绘制小圆点锚点 ---
        ctx.globalAlpha = pulse * 0.8;
        ctx.fillStyle   = color;
        ctx.shadowBlur  = glow * 0.6;
        [[this.x, this.y], [this.x2, this.y2]].forEach(([ax, ay]) => {
            ctx.beginPath();
            ctx.arc(ax, ay, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // --- 3. 在连线中点绘制符号背景圆 + 文字 ---
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur  = glow * 1.5;
        ctx.shadowColor = color;

        // 中点背景圆
        ctx.beginPath();
        ctx.arc(midX, midY, 12, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // 符号文字
        ctx.shadowBlur = 0;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = 'bold 12px sans-serif';
        ctx.fillStyle    = '#fff';
        ctx.fillText(text, midX, midY);

        ctx.restore();
    }
}

class FortuneWheel {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.spinning = false;
        this.stopping = false;
        this._deactivateTimer = null; // [fix] 保存定时器引用以便清理
        
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
        if (this._deactivateTimer) clearTimeout(this._deactivateTimer); // [fix] 防止重复调用
        this._deactivateTimer = setTimeout(() => { 
            this.active = false;
            this._deactivateTimer = null;
        }, 1500); // 稍微延長展示時間
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
            // --- Tilt Boost (偏移加速度加成衰减机制) ---
            this.tiltBoostMultiplier = 1.0;  // 当前加成倍率，1.0 = 无加成
            this.lastTiltDirection = 0;      // 上一帧的倾斜方向：-1（左）/ 0（平衡）/ 1（右）
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
                        
                        // [限制] 通过受限推送，风属性激活时自动压缩火焰配额
                        game.spawn_pushParticleWithLimit(ember);
                        
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
                        // [限制] 通过受限推送，风属性激活时自动压缩冰雾配额
                        game.spawn_pushParticleWithLimit(mist);
                        
                        // 3. 偶尔生成一点点晶莹的冰渣 (增加对比度)
                        if (Math.random() < 0.05) {
                            const shard = new Particle(spawnX, spawnY, '#a5f3fc', 'shard');
                            shard.size = 2; // 很小的冰晶
                            game.spawn_pushParticleWithLimit(shard);
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

            // --- 偏移加速度加成衰减机制 (Tilt Boost) ---
            // a. 计算当前帧的倾斜方向
            const newTiltDir = Math.sign(tilt.x);
            // b. 检测方向改变（越过平衡点）：新方向非零且与上一帧不同
            if (newTiltDir !== 0 && newTiltDir !== this.lastTiltDirection) {
                // 方向改变，重置加成为 25%
                this.tiltBoostMultiplier = 1.25;
            }
            // c. 更新上一帧方向
            this.lastTiltDirection = newTiltDir;
            // d. 若加成大于 1.0，每帧衰减
            if (this.tiltBoostMultiplier > 1.0) {
                this.tiltBoostMultiplier = Math.max(1.0, this.tiltBoostMultiplier - 0.04 * timeScale);
            }
            // e. 叠加倾斜影响（含加成倍率）
            // x轴倾斜直接产生横向重力
            gx += tilt.x * 0.05 * this.tiltBoostMultiplier; // 倾斜重力系数 * 加成倍率

            // 可选视觉反馈：当 tiltBoostMultiplier > 1.05 时，生成少量尾迹粒子
            if (this.tiltBoostMultiplier > 1.05 && Math.random() < 0.3 * timeScale) {
                // 在弹珠后方（与运动方向相反）生成尾迹粒子
                const trailColor = tilt.x > 0 ? '#fbbf24' : '#60a5fa'; // 向右黄色，向左蓝色
                game.spawn_createParticle(
                    this.pos.x - this.vel.x * 0.5,
                    this.pos.y - this.vel.y * 0.5,
                    trailColor,
                    'spark'
                );
            }
            
            // y轴倾斜微调垂直重力 (前倾加速，后倾减速)
            // gy += tilt.y * 0.1;

            let gravityStep = new Vec2(gx * timeScale, gy * timeScale);
            
            this.vel = this.vel.add(gravityStep);
            this.pos = this.pos.add(this.vel.mult(timeScale));
            // 当弹珠处于倍化状态（sizeBonus > 0）时，使用更低的摩擦力，防止卡墙
            const effectiveFriction = (this.radius > CONFIG.physics.marbleRadius)
                ? Math.min(CONFIG.physics.friction + 0.005, 0.998)
                : CONFIG.physics.friction;
            this.vel = this.vel.mult(Math.pow(effectiveFriction, timeScale));

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
                    // [连线触发] 计算弹珠圆心到连线线段的最短距离，替代旧的矩形包围盒检测
                    const _sx = slot.x2 - slot.x, _sy = slot.y2 - slot.y;
                    const _segLenSq = _sx * _sx + _sy * _sy;
                    let _t = 0;
                    if (_segLenSq > 0) {
                        _t = ((this.pos.x - slot.x) * _sx + (this.pos.y - slot.y) * _sy) / _segLenSq;
                        _t = Math.max(0, Math.min(1, _t));
                    }
                    const _closestX = slot.x + _t * _sx;
                    const _closestY = slot.y + _t * _sy;
                    const _distToLine = Math.hypot(this.pos.x - _closestX, this.pos.y - _closestY);
                    const _triggerThreshold = this.radius + slot.height; // slot.height = 12 为触发带宽
                    if (_distToLine < _triggerThreshold) {
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
								/*
                                if (game.marbleQueue[game.activeMarbleIndex]) {
                                    game.marbleQueue[game.activeMarbleIndex].collected = [...this.session.collected];
                                }
                                */
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
                const pulse = (Math.sin(this.lifeTime * 5) + 1) / 2; // [bugfix] 除数应为 2，使 pulse 范围为 [0,1]
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

// 辅助：平滑旋转函数（已迁移至 src/utils/math_utils.js）
// rotateTowards 函数已通过顶部 import 语句引入

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
                             // [限制] SlashAnim 受全局粒子上限约束
                             game.spawn_pushParticleWithLimit(new SlashAnim(this.pos.x, this.pos.y, this.angle, 0.4));
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
             // [限制] SlashAnim 受全局粒子上限约束
            game.spawn_pushParticleWithLimit(new SlashAnim(this.pos.x, this.pos.y, this.angle, 0.35));
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
            // [限制] SlashAnim 受全局粒子上限约束
            game.spawn_pushParticleWithLimit(new SlashAnim(this.pos.x, this.pos.y, this.angle, 0.5));
            game.spawn_createParticle(this.pos.x, this.pos.y, '#0ea5e9', 'spark');
            audio.playSlash();
            this.passingThroughEnemy = enemy;;
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

// ==================== 符文掉落物实体 ====================
/**
 * RuneLoot - 场地上待拾取的符文掉落物
 *
 * 当敌人被击杀时，可能在其位置生成一个 RuneLoot 实体。
 * 玩家进入拾取范围后自动拾取，将符文加入 runeInventory。
 */
class RuneLoot {
    /**
     * @param {number} x - 掉落位置 X 坐标
     * @param {number} y - 掉落位置 Y 坐标
     * @param {string} runeId - 符文 ID（对应 RUNE_DB 中的 id）
     */
    constructor(x, y, runeId) {
        this.x = x;
        this.y = y;
        this.runeId = runeId;
        this.active = true;          // 是否仍在场地上（未被拾取）
        this._animTimer = 0;         // 动画计时器（用于悬浮/发光效果）
        this._glowRadius = 18;       // 发光圈半径
        this._floatOffset = 0;       // 悬浮偏移量
    }

    /**
     * 在画布上绘制发光的符文图标
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    draw(ctx) {
        if (!this.active) return;

        this._animTimer += 0.05;
        this._floatOffset = Math.sin(this._animTimer) * 4; // 上下悬浮 ±4px

        const drawY = this.y + this._floatOffset;

        // 从 RUNE_DB 获取符文定义（图标和稀有度）
        const runeDef = RUNE_DB ? RUNE_DB.find(r => r.id === this.runeId) : null;
        const icon    = (runeDef && runeDef.icon) ? runeDef.icon : '❆';
        const rarity  = (runeDef && runeDef.rarity) ? runeDef.rarity : 'common';
        const level   = this.level || 1;

        // 稀有度对应发光颜色
        const RARITY_GLOW = {
            common:    { r: 160, g: 160, b: 160 },
            rare:      { r: 74,  g: 144, b: 217 },
            epic:      { r: 155, g: 89,  b: 182 },
            legendary: { r: 243, g: 156, b: 18  },
        };
        const glow = RARITY_GLOW[rarity] || RARITY_GLOW.common;

        ctx.save();

        // 外圈发光效果（稀有度颜色）
        const glowPulse = 0.5 + 0.5 * Math.sin(this._animTimer * 1.5);
        const gradient = ctx.createRadialGradient(
            this.x, drawY, 0,
            this.x, drawY, this._glowRadius + glowPulse * 6
        );
        gradient.addColorStop(0, `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${0.55 + glowPulse * 0.3})`);
        gradient.addColorStop(0.5, `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${0.25 + glowPulse * 0.15})`);
        gradient.addColorStop(1, `rgba(${glow.r}, ${glow.g}, ${glow.b}, 0)`);

        ctx.beginPath();
        ctx.arc(this.x, drawY, this._glowRadius + glowPulse * 6, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 内圈黑底（黑底隔离 emoji）
        ctx.beginPath();
        ctx.arc(this.x, drawY, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        // 稀有度边框
        ctx.strokeStyle = `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${0.75 + glowPulse * 0.25})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Lv2/Lv3 内圈双线效果
        if (level >= 2) {
            ctx.beginPath();
            ctx.arc(this.x, drawY, 11, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${level >= 3 ? 0.25 : 0.12})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        // Lv3 外圈光晕
        if (level >= 3) {
            ctx.beginPath();
            ctx.arc(this.x, drawY, 17, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,0.08)`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 绘制符文图标（真实 emoji）
        ctx.font = '14px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(icon, this.x, drawY);

        // 等级角标（右下角小文字）
        if (level >= 1) {
            const LV_COLORS = ['', '#94a3b8', '#60a5fa', '#fbbf24'];
            const lvColor = LV_COLORS[Math.min(level, 3)] || '#94a3b8';
            ctx.font = 'bold 7px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#000';
            ctx.fillText(`L${level}`, this.x + 14.5, drawY + 14.5);
            ctx.fillStyle = lvColor;
            ctx.fillText(`L${level}`, this.x + 14, drawY + 14);
        }

        ctx.restore();
    }

    /**
     * 检测玩家是否进入拾取范围
     * @param {{ x: number, y: number }} playerPos - 玩家当前位置
     * @param {number} [radius=30] - 拾取判定半径（像素）
     * @returns {boolean} 是否在拾取范围内
     */
    checkPickup(playerPos, radius = 30) {
        if (!this.active) return false;
        const dx = playerPos.x - this.x;
        const dy = playerPos.y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    }
}

// ==================== 导出实体类 ====================
// 注意：工具函数和特效类已迁移到独立文件，通过 import 引入后在此重新导出

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
    RuneLoot,
    showToast,
    rotateTowards,
    adjustColorBrightness,
    lerpColor,
    lerp,
    hexToRgba,
    setAudioProvider,
    setEnemyAudioProvider,
    setProjectileAudioProvider
};
