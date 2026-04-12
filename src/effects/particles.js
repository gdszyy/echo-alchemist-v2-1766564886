/**
 * particles.js - 视觉特效类
 *
 * 职责：
 * - 粒子系统（Particle）
 * - 斩击特效（SlashEffect）
 * - 收集光柱特效（CollectionBeam）
 * - 冲击波（Shockwave）
 * - 激光光束（LaserBeam）
 * - 浮动文字（FloatingText）
 * - 能量球（EnergyOrb）
 * - 闪电链（LightningBolt）
 * - 火焰波（FireWave）
 *
 * 注意：本文件从 entities.js 提取，不依赖游戏逻辑（无 CONFIG、audio 依赖）。
 * 提取时间：Task 2.1
 */
import { Vec2, lerp } from '../utils/math_utils.js';

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


// ==================== 冰冻死亡波 ====================
/**
 * IceWave - 冰冻状态死亡时的冰晶爆炸波
 * 表现为蓝白色冰晶碎片扩散环 + 冰雾扩散
 */
class IceWave {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.maxRadius = 90;
        this.life = 1.0;
        // 内圈冰晶环
        this.innerRadius = 2;
        this.innerLife = 1.2;
    }

    update(timeScale) {
        this.radius += 6 * timeScale;
        this.life -= 0.045 * timeScale;
        this.innerRadius += 3.5 * timeScale;
        this.innerLife -= 0.06 * timeScale;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 外圈：蓝白冰晶爆炸环
        if (this.life > 0) {
            ctx.globalAlpha = Math.max(0, this.life);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(186, 230, 253, ${this.life})`; // 淡蓝
            ctx.lineWidth = 3;
            ctx.stroke();

            // 外圈填充（极淡）
            const grad = ctx.createRadialGradient(this.x, this.y, this.radius * 0.5, this.x, this.y, this.radius);
            grad.addColorStop(0, `rgba(224, 242, 254, 0)`);
            grad.addColorStop(0.6, `rgba(125, 211, 252, ${this.life * 0.25})`);
            grad.addColorStop(1, `rgba(56, 189, 248, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 内圈：更亮的冰核闪光
        if (this.innerLife > 0) {
            ctx.globalAlpha = Math.max(0, Math.min(1, this.innerLife));
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.innerRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.innerLife * 0.8})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }
}

// ==================== 分级死亡「消散」特效 ====================
/**
 * DeathExplosion - 敌人死亡时的分级「消散」特效
 *
 * 设计理念：不是向外爆炸，而是内爆收缩 + 粒子内吸 + 灵魂消散
 *   - 普通：小圆圈内缩消失 + 灰色烟尘向内漂散
 *   - 精英：能量环内缩收紧 + 紫色虚空孔洞残留 + 灵魂粒子内吸
 *   - Boss：先膨胀挥扎，再猛烈内爆塑陷 + 黑洞涡旋 + 缓慢消散
 *
 * tier: 'normal' | 'elite' | 'boss'
 * 内部自包含 update/draw，由 game_phase.js 的 deathExplosions 数组管理
 */
class DeathExplosion {
    /**
     * @param {number} x
     * @param {number} y
     * @param {'normal'|'elite'|'boss'} tier - 敌人等级
     */
    constructor(x, y, tier = 'normal') {
        this.x = x;
        this.y = y;
        this.tier = tier;
        this.life = 1.0;
        this.timer = 0;

        if (tier === 'boss') {
            // Boss：先膨胀挥扎，再猛烈内爆塑陷
            this.decay = 0.012;
            // 膨胀阶段：圆圈从 0 展开到 maxR，再内缩回 0
            this.expandR = 0;        // 当前膨胀半径
            this.expandMax = 80;     // 最大膨胀半径
            this.expandSpeed = 5;    // 膨胀速度
            this.expanding = true;   // 是否处于膨胀阶段
            // 内爆收缩环：从 maxR 向内收缩到 0
            this.collapseRings = [
                { r: 90,  color: '#fca5a5', lw: 4,   alpha: 0.9 },
                { r: 65,  color: '#f87171', lw: 2.5, alpha: 0.7 },
                { r: 40,  color: '#fbbf24', lw: 1.5, alpha: 0.5 },
            ];
            this.collapseSpeed = 4.5; // 收缩速度
            this.collapseStarted = false;
            // 虚空涡旋：内爆后中心残留的黑洞感
            this.voidLife = 0;       // 虚空孔洞生命（内爆后激活）
            this.voidRadius = 0;
            this.voidMaxRadius = 30;
            this.voidDecay = 0.022;
            // 灵魂粒子：小圆点向心漂移
            this.souls = Array.from({ length: 18 }, () => ({
                angle: Math.random() * Math.PI * 2,
                dist: 55 + Math.random() * 35,
                speed: 1.8 + Math.random() * 1.5,
                size: 1.5 + Math.random() * 2,
                alpha: 0.7 + Math.random() * 0.3,
                color: Math.random() < 0.5 ? '#fca5a5' : '#fbbf24',
            }));
        } else if (tier === 'elite') {
            // 精英：能量环内缩 + 紫色虚空孔洞
            this.decay = 0.02;
            this.collapseRings = [
                { r: 60,  color: '#c084fc', lw: 3,   alpha: 0.9 },
                { r: 38,  color: '#a78bfa', lw: 2,   alpha: 0.65 },
            ];
            this.collapseSpeed = 4.0;
            this.collapseStarted = true; // 精英直接内缩
            this.expanding = false;
            this.expandR = 0;
            this.voidLife = 0.85;
            this.voidRadius = 0;
            this.voidMaxRadius = 18;
            this.voidDecay = 0.03;
            this.souls = Array.from({ length: 10 }, () => ({
                angle: Math.random() * Math.PI * 2,
                dist: 40 + Math.random() * 20,
                speed: 1.5 + Math.random() * 1.2,
                size: 1.2 + Math.random() * 1.5,
                alpha: 0.6 + Math.random() * 0.3,
                color: Math.random() < 0.6 ? '#c084fc' : '#e9d5ff',
            }));
        } else {
            // 普通：小圆圈内缩消失 + 灰烟尘
            this.decay = 0.04;
            this.collapseRings = [
                { r: 28, color: '#94a3b8', lw: 2, alpha: 0.7 },
            ];
            this.collapseSpeed = 3.5;
            this.collapseStarted = true;
            this.expanding = false;
            this.expandR = 0;
            this.voidLife = 0.5;
            this.voidRadius = 0;
            this.voidMaxRadius = 8;
            this.voidDecay = 0.06;
            this.souls = Array.from({ length: 5 }, () => ({
                angle: Math.random() * Math.PI * 2,
                dist: 18 + Math.random() * 10,
                speed: 1.2 + Math.random() * 0.8,
                size: 0.8 + Math.random() * 1,
                alpha: 0.4 + Math.random() * 0.3,
                color: '#94a3b8',
            }));
        }
    }

    update(timeScale) {
        this.timer += timeScale;
        this.life -= this.decay * timeScale;

        // Boss 膨胀阶段
        if (this.expanding) {
            this.expandR += this.expandSpeed * timeScale;
            if (this.expandR >= this.expandMax) {
                this.expanding = false;
                this.collapseStarted = true;
                // 膨胀结束后激活虚空孔洞
                this.voidLife = 1.0;
                this.voidRadius = 0;
            }
        }

        // 内爆收缩环
        if (this.collapseStarted) {
            for (const ring of this.collapseRings) {
                ring.r -= this.collapseSpeed * timeScale;
                if (ring.r < 0) ring.r = 0;
            }
            // 精英/普通内缩开始后激活虚空
            if (this.voidLife <= 0 && !this.expanding && this.tier !== 'boss') {
                this.voidLife = this.tier === 'elite' ? 0.85 : 0.5;
                this.voidRadius = 0;
            }
        }

        // 虚空孔洞生长并消退
        if (this.voidLife > 0) {
            this.voidLife -= this.voidDecay * timeScale;
            // 先展开到 maxRadius，再缓慢收缩
            if (this.voidRadius < this.voidMaxRadius) {
                this.voidRadius += (this.voidMaxRadius / 8) * timeScale;
            }
        }

        // 灵魂粒子向心移动
        for (const s of this.souls) {
            s.dist -= s.speed * timeScale;
            if (s.dist < 0) s.dist = 0;
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();

        // ---- 1. Boss 膨胀阶段：向外的气带圆圈（最后挥扎）----
        if (this.expanding && this.expandR > 0) {
            ctx.globalCompositeOperation = 'lighter';
            const t = this.expandR / this.expandMax; // 0~1
            const ringAlpha = (1 - t) * 0.7;
            ctx.globalAlpha = ringAlpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.expandR, 0, Math.PI * 2);
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 5 * (1 - t * 0.5);
            ctx.stroke();
            // 内充光晕
            const eGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.expandR);
            eGrad.addColorStop(0, `rgba(255,200,150,${ringAlpha * 0.4})`);
            eGrad.addColorStop(0.6, `rgba(251,146,60,${ringAlpha * 0.15})`);
            eGrad.addColorStop(1, 'rgba(251,146,60,0)');
            ctx.fillStyle = eGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.expandR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }

        // ---- 2. 内爆收缩环（从外向内收紧）----
        if (this.collapseStarted) {
            ctx.globalCompositeOperation = 'lighter';
            for (const ring of this.collapseRings) {
                if (ring.r <= 0) continue;
                // 越小越亮（内爆收紧感）
                const progress = 1 - ring.r / (this.tier === 'boss' ? 90 : (this.tier === 'elite' ? 60 : 28));
                const ringAlpha = ring.alpha * Math.min(1, progress * 2) * Math.max(0, this.life);
                ctx.globalAlpha = ringAlpha;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ring.r, 0, Math.PI * 2);
                ctx.strokeStyle = ring.color;
                ctx.lineWidth = ring.lw * (0.5 + progress * 0.5);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        // ---- 3. 虚空孔洞（中心暗色消失感）----
        if (this.voidLife > 0 && this.voidRadius > 0) {
            const vl = Math.max(0, this.voidLife);
            const vColor = this.tier === 'boss' ? '120,40,40' : (this.tier === 'elite' ? '88,28,135' : '30,30,40');
            // 外圈暗色渐变圈（表现被吸入虚空的感觉）
            ctx.globalCompositeOperation = 'source-over';
            const vGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.voidRadius * 2.5);
            vGrad.addColorStop(0,   `rgba(${vColor},${vl * 0.85})`);
            vGrad.addColorStop(0.4, `rgba(${vColor},${vl * 0.45})`);
            vGrad.addColorStop(1,   `rgba(${vColor},0)`);
            ctx.fillStyle = vGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.voidRadius * 2.5, 0, Math.PI * 2);
            ctx.fill();
            // 内圈最暗心
            ctx.globalAlpha = vl * 0.9;
            ctx.fillStyle = `rgba(${vColor},1)`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.voidRadius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // ---- 4. 灵魂粒子（小圆点向心漂移）----
        ctx.globalCompositeOperation = 'lighter';
        for (const s of this.souls) {
            if (s.dist <= 0) continue;
            const sx = this.x + Math.cos(s.angle) * s.dist;
            const sy = this.y + Math.sin(s.angle) * s.dist;
            // 越靠近中心越透明（消失感）
            const distRatio = s.dist / (this.tier === 'boss' ? 90 : (this.tier === 'elite' ? 60 : 28));
            const sAlpha = s.alpha * distRatio * Math.max(0, this.life);
            ctx.globalAlpha = Math.max(0, sAlpha);
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

// ==================== 导出 ====================
export {
    Particle,
    SlashEffect,
    CollectionBeam,
    Shockwave,
    LaserBeam,
    FloatingText,
    EnergyOrb,
    LightningBolt,
    FireWave,
    IceWave,
    DeathExplosion
};
