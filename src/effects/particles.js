/**
 * particles.js - 视觉特效类
 *
 * 职责：
 * - 粒子系统（Particle）
 * - 斩击特效（SlashEffect）
 * - 穿透切割特效（PierceCutEffect）
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
import { sb as _sb } from '../utils/perf.js';
import { pixiIsActive } from '../render/pixi_bridge.js';
import {
    iceWave_pixiCreate, iceWave_pixiSync, iceWave_pixiDestroy,
    collectionBeam_pixiCreate, collectionBeam_pixiSync, collectionBeam_pixiDestroy,
    healWave_pixiCreate, healWave_pixiSync, healWave_pixiDestroy,
    laserBeam_pixiCreate, laserBeam_pixiSync, laserBeam_pixiDestroy,
    lightningBolt_pixiCreate, lightningBolt_pixiSync, lightningBolt_pixiDestroy,
    shockwave_pixiCreate, shockwave_pixiSync, shockwave_pixiDestroy,
    fireWave_pixiCreate, fireWave_pixiSync, fireWave_pixiDestroy,
    deathExplosion_pixiCreate, deathExplosion_pixiSync, deathExplosion_pixiDestroy,
    slashEffect_pixiCreate, slashEffect_pixiSync, slashEffect_pixiDestroy,
    pierceCutEffect_pixiCreate, pierceCutEffect_pixiSync, pierceCutEffect_pixiDestroy,
    swordScar_pixiCreate, swordScar_pixiSync, swordScar_pixiDestroy,
    bladeStormRing_pixiCreate, bladeStormRing_pixiSync, bladeStormRing_pixiDestroy,
    bladeStormVortex_pixiCreate, bladeStormVortex_pixiSync, bladeStormVortex_pixiDestroy,
    greedyWheelEffect_pixiCreate, greedyWheelEffect_pixiSync, greedyWheelEffect_pixiDestroy,
    energyOrb_pixiCreate, energyOrb_pixiSync, energyOrb_pixiDestroy,
    floatingText_pixiCreate, floatingText_pixiSync, floatingText_pixiDestroy,
    rewardDropEffect_pixiCreate, rewardDropEffect_pixiSync, rewardDropEffect_pixiDestroy,
    muzzleFlashV2_pixiCreate, muzzleFlashV2_pixiSync, muzzleFlashV2_pixiDestroy,
    firingBurst_pixiCreate, firingBurst_pixiSync, firingBurst_pixiDestroy,
    burnEffect_pixiCreate, burnEffect_pixiSync, burnEffect_pixiDestroy,
    electrocuteEffect_pixiCreate, electrocuteEffect_pixiSync, electrocuteEffect_pixiDestroy,
    venomEffect_pixiCreate, venomEffect_pixiSync, venomEffect_pixiDestroy,
    windMarkEffect_pixiCreate, windMarkEffect_pixiSync, windMarkEffect_pixiDestroy,
    affixSkillVFX_pixiCreate, affixSkillVFX_pixiSync, affixSkillVFX_pixiDestroy,
} from '../render/pixi_effect_adapter.js';

function withAlpha(color, alpha) {
    const a = Math.max(0, Math.min(1, alpha));
    if (!color || typeof color !== 'string') return `rgba(255,255,255,${a})`;
    if (color.startsWith('#')) {
        let hex = color.slice(1);
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            if ([r, g, b].every(Number.isFinite)) return `rgba(${r},${g},${b},${a})`;
        }
    }
    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
    }
    return color;
}

class Particle {
    constructor(x, y, color, mode = 'normal') {
        this.pos = new Vec2(x, y);
        this.vel = new Vec2(0, 0);
        this._init(x, y, color, mode);
    }

    /**
     * 从对象池复用时调用 - 复用现有 Vec2 实例避免分配
     */
    reset(x, y, color, mode = 'normal') {
        this.pos.x = x; this.pos.y = y;
        this.vel.x = 0; this.vel.y = 0;
        this._init(x, y, color, mode);
    }

    _init(x, y, color, mode = 'normal') {
        this.pos.x = x; this.pos.y = y;
        this.color = color;
        this.mode = mode;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.turbulence = 0;
        this.wobble = Math.random() * Math.PI * 2;
        // 复用上次设置的字段缺省值（避免读到陈旧值）
        this.scale = null;
        this.scaleX = 1;
        this.scaleY = 1;
        this.spin = 0;
        this.angle = 0;
        // [PixiJS 迁移] WebGL Sprite 引用（由 pixiAcquireParticleSprite 注入）
        this._pixiSprite = null;

        const angle = Math.random() * Math.PI * 2;
        const vel = this.vel;

        if (mode === 'spark') {
            const speed = Math.random() * 5 + 2;
            vel.x = Math.cos(angle) * speed; vel.y = Math.sin(angle) * speed;
            this.drag = 0.85; this.gravity = 0.1;
            this.decay = 0.05 + Math.random() * 0.05;
            this.size = Math.random() * 2 + 1;
        } else if (mode === 'ember') {
            vel.x = (Math.random() - 0.5) * 1.0; vel.y = -Math.random() * 2.0 - 0.5;
            this.drag = 0.98; this.gravity = -0.08;
            this.decay = 0.015 + Math.random() * 0.02;
            this.size = Math.random() * 1.5 + 0.5;
            this.wobble = Math.random() * 10;
        } else if (mode === 'mist') {
            vel.x = (Math.random() - 0.5) * 0.8; vel.y = Math.random() * 0.5 + 0.5;
            this.drag = 0.96; this.gravity = 0.02;
            this.decay = 0.015 + Math.random() * 0.01;
            this.size = Math.random() * 5 + 4;
            this.angle = Math.random() * Math.PI * 2;
        } else if (mode === 'shard') {
            const speed = Math.random() * 4 + 2;
            vel.x = Math.cos(angle) * speed; vel.y = Math.sin(angle) * speed;
            this.drag = 0.96;
            this.gravity = 0.4;
            this.decay = 0.02 + Math.random() * 0.02;
            this.size = Math.random() * 4 + 2;
            this.scaleX = Math.random() * 0.5 + 0.5;
            this.scaleY = Math.random() * 1.5 + 1.0;
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() - 0.5) * 0.5;
        } else if (mode === 'smoke') {
            vel.x = (Math.random() - 0.5) * 0.5; vel.y = -Math.random() * 1.5 - 0.5;
            this.drag = 0.98; this.gravity = -0.02; this.decay = 0.015;
            this.size = Math.random() * 4 + 3; this.life = 1.2;
        } else if (mode === 'venom') {
            // 毒液滴：缓慢上浮，轻微横向摆动，半透明绿色液滴
            vel.x = (Math.random() - 0.5) * 0.6;
            vel.y = -(Math.random() * 1.2 + 0.4);
            this.drag = 0.97; this.gravity = -0.04; this.decay = 0.012 + Math.random() * 0.008;
            this.size = Math.random() * 2.5 + 1.5;
            this.wobble = Math.random() * Math.PI * 2;
        } else if (mode === 'line') {
            vel.x = 0; vel.y = 0;
            this.drag = 0.98; this.gravity = 0; this.decay = 0.02;
            this.size = 2; this.life = 1.0;
            this.scale = { x: 1, y: 1 };
        } else if (mode === 'wind_slash') {
            vel.x = 0; vel.y = 0;
            this.drag = 1.0;
            this.gravity = 0;
            this.decay = 0.05;
            this.size = 10;
            this.life = 1.0;
        } else {
            vel.x = (Math.random() - 0.5) * 4; vel.y = (Math.random() - 0.5) * 4;
            this.drag = 0.92; this.gravity = 0; this.decay = 0.05; this.size = Math.random() * 2 + 1;
        }
        this.maxLife = this.life;
    }

    update(timeScale) {
        if (this.mode === 'ember') {
            this.pos.x += Math.sin(this.life * 10 + this.wobble) * 0.5 * timeScale;
        }
        if (this.mode === 'venom') {
            // 毒液滴横向正弦摆动，模拟液体漂浮
            this.pos.x += Math.sin(this.life * 6 + this.wobble) * 0.4 * timeScale;
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
        // [PixiJS 迁移] 若已绑定 WebGL Sprite，跳过 Canvas 2D 绘制
        // Sprite 的 position/alpha/rotation 由 compaction 循环同步
        if (this._pixiSprite) return;
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
                grad.addColorStop(0, `rgba(207, 250, 254, ${this.life * 0.2})`); 
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
            ctx.shadowBlur = _sb(10 * this.life);
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

        } else if (this.mode === 'venom') {
            // @perf-impact: 毒液粒子渐变绘制 - 已通过 venomLimit 预算门控
            ctx.globalCompositeOperation = 'screen';
            const vg = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2.2);
            vg.addColorStop(0, `rgba(200, 255, 180, ${this.life * 0.9})`);
            vg.addColorStop(0.4, `rgba(74, 222, 128, ${this.life * 0.7})`);
            vg.addColorStop(1, `rgba(22, 101, 52, 0)`);
            ctx.fillStyle = vg;
            ctx.beginPath(); ctx.arc(0, 0, this.size * 2.2, 0, Math.PI * 2); ctx.fill();

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
        this._pixi = null; // [PixiJS 迁移]
    }

    update() {
        this.life -= this.decay;
        if (this.life <= 0) this.active = false;
    }

    draw(ctx) {
        if (!this.active) return;
        // [PixiJS 迁移 · 阶段三] SlashEffect
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = slashEffect_pixiCreate(this);
            if (this._pixi) { slashEffect_pixiSync(this, this._pixi); return; }
        }
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
        ctx.shadowBlur = _sb(10);
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
        ctx.shadowBlur = _sb(20);
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

// @perf-impact: 穿透命中切割特效 - 复用全局 maxParticles 入口，low 档关闭 shadowBlur 与高亮叠加。
class PierceCutEffect {
    constructor(x, y, angle, length = 92, color = '#fca5a5', quality = 'high') {
        this.x = x;
        this.y = y;
        this.angle = angle || 0;
        this.length = length;
        this.color = color || '#fca5a5';
        this.quality = quality || 'high';
        this.life = 1.0;
        this.age = 0;
        this.duration = this.quality === 'low' ? 14 : 18;
        this.active = true;
        this.cutWidth = 5 + Math.random() * 2;
        this.edgeSeed = Math.random() * Math.PI * 2;
        const chipCount = this.quality === 'low' ? 3 : (this.quality === 'medium' ? 5 : 7);
        this.chips = Array.from({ length: chipCount }, (_, i) => ({
            side: i % 2 === 0 ? 1 : -1,
            along: (Math.random() - 0.5) * this.length * 0.74,
            lift: 3 + Math.random() * 8,
            speed: 1.4 + Math.random() * 2.2,
            size: 2 + Math.random() * 2.5,
            alpha: 0.5 + Math.random() * 0.35,
        }));
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        this.age += timeScale;
        const t = this.age / this.duration;
        this.life = Math.max(0, 1 - t);
        if (this.life <= 0) this.active = false;
        for (const chip of this.chips) {
            chip.lift += chip.speed * timeScale;
        }
    }

    draw(ctx) {
        if (!this.active || this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] PierceCutEffect
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = pierceCutEffect_pixiCreate(this);
            if (this._pixi) { pierceCutEffect_pixiSync(this, this._pixi); return; }
        }
        const t = Math.min(1, this.age / this.duration);
        const isLow = this.quality === 'low';
        const open = Math.sin(t * Math.PI) * (isLow ? 4 : 8);
        const halfL = this.length / 2;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalCompositeOperation = isLow ? 'source-over' : 'lighter';
        ctx.lineCap = 'round';

        if (!isLow) {
            ctx.globalAlpha = this.life * 0.42;
            ctx.strokeStyle = withAlpha(this.color, 0.85);
            ctx.lineWidth = this.cutWidth * (1.8 + 0.4 * this.life);
            ctx.shadowColor = this.color;
            ctx.shadowBlur = _sb(14);
            ctx.beginPath();
            ctx.moveTo(-halfL - 6, -open * 0.35);
            ctx.quadraticCurveTo(-halfL * 0.18, -open * 1.25, halfL + 6, -open * 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-halfL - 6, open * 0.35);
            ctx.quadraticCurveTo(halfL * 0.18, open * 1.25, halfL + 6, open * 0.5);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        const slitAlpha = Math.min(1, this.life * 1.35);
        const slit = ctx.createLinearGradient(-halfL, 0, halfL, 0);
        slit.addColorStop(0, 'rgba(255,255,255,0)');
        slit.addColorStop(0.22, withAlpha(this.color, 0.78 * slitAlpha));
        slit.addColorStop(0.5, `rgba(255,255,255,${slitAlpha})`);
        slit.addColorStop(0.78, withAlpha(this.color, 0.78 * slitAlpha));
        slit.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = slit;
        ctx.lineWidth = Math.max(1.2, this.cutWidth * this.life);
        ctx.beginPath();
        ctx.moveTo(-halfL, 0);
        ctx.lineTo(halfL, 0);
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = this.life * 0.78;
        ctx.strokeStyle = withAlpha('#1f0f16', isLow ? 0.46 : 0.62);
        ctx.lineWidth = Math.max(1, this.cutWidth * 0.42);
        ctx.beginPath();
        ctx.moveTo(-halfL * 0.72, 0);
        ctx.lineTo(halfL * 0.72, 0);
        ctx.stroke();

        ctx.globalCompositeOperation = isLow ? 'source-over' : 'lighter';
        const tickCount = isLow ? 2 : 4;
        for (let i = 0; i < tickCount; i++) {
            const k = (i + 1) / (tickCount + 1);
            const x = -halfL + this.length * k;
            const wobble = Math.sin(this.edgeSeed + i * 1.7) * 4;
            ctx.globalAlpha = this.life * (0.32 + i * 0.08);
            ctx.strokeStyle = i % 2 ? '#ffffff' : this.color;
            ctx.lineWidth = isLow ? 1 : 1.4;
            ctx.beginPath();
            ctx.moveTo(x - 5, -open - wobble * 0.25);
            ctx.lineTo(x + 6, open + wobble * 0.25);
            ctx.stroke();
        }

        for (const chip of this.chips) {
            const chipAlpha = chip.alpha * this.life;
            ctx.globalAlpha = chipAlpha;
            ctx.fillStyle = this.color;
            const cx = chip.along;
            const cy = chip.side * chip.lift;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(chip.side * 0.65 + t * chip.side);
            ctx.beginPath();
            ctx.moveTo(-chip.size, 0);
            ctx.lineTo(chip.size * 0.8, -chip.size * 0.45);
            ctx.lineTo(chip.size * 0.35, chip.size * 0.85);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
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
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        this.life -= this.decay * timeScale;
        // 光柱快速冲高
        this.height = lerp(this.height, this.maxHeight, 0.2 * timeScale);
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] CollectionBeam → 预烘焙光柱 Sprite
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = collectionBeam_pixiCreate(this);
            if (this._pixi) { collectionBeam_pixiSync(this, this._pixi); return; }
        }
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
// @perf-impact: 通用范围冲击波 - 仍由 shockwaveLimit 控制，low 档关闭径向填充和阴影。
class Shockwave {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = 1;
        this.alpha = 1.0;
        this.color = color || '#ffffff';
        this.maxRadius = 120;
        this.seed = Math.random() * Math.PI * 2;
        this.arcJitter = Array.from({ length: 7 }, (_, i) => ({
            start: this.seed + i * (Math.PI * 2 / 7) + (Math.random() - 0.5) * 0.25,
            span: 0.42 + Math.random() * 0.34,
            weight: 0.6 + Math.random() * 0.7,
        }));
        this.spokes = Array.from({ length: 8 }, (_, i) => ({
            angle: this.seed + i * (Math.PI * 2 / 8) + (Math.random() - 0.5) * 0.28,
            reach: 0.58 + Math.random() * 0.38,
            width: 1 + Math.random() * 1.5,
        }));
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        const scale = Number.isFinite(timeScale) ? Math.max(0, timeScale) : 1;
        if (this.radius < this.maxRadius) {
            this.radius = Math.min(this.maxRadius, Math.max(0.1, this.radius + 4 * scale));
        }
        this.alpha = Math.max(0, this.alpha - 0.04 * scale);
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        // [PixiJS 迁移 · 阶段三] Shockwave
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = shockwave_pixiCreate(this);
            if (this._pixi) { shockwave_pixiSync(this, this._pixi); return; }
        }
        const quality = (typeof game !== 'undefined' && game.perfQualityLevel) || 'high';
        const isLow = quality === 'low';
        const radius = Number.isFinite(this.radius) ? Math.max(0.1, this.radius) : 0.1;
        const t = Math.min(1, radius / this.maxRadius);
        const band = 10 + 14 * (1 - t);

        ctx.save();
        ctx.globalCompositeOperation = isLow ? 'source-over' : 'lighter';

        if (!isLow) {
            ctx.globalAlpha = this.alpha * 0.18;
            const pressure = ctx.createRadialGradient(
                this.x, this.y, Math.max(0, radius - band * 1.6),
                this.x, this.y, radius + band
            );
            pressure.addColorStop(0, 'rgba(255,255,255,0)');
            pressure.addColorStop(0.45, withAlpha(this.color, 0.18 * this.alpha));
            pressure.addColorStop(0.68, withAlpha('#ffffff', 0.10 * this.alpha));
            pressure.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = pressure;
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius + band, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.shadowColor = this.color;
        ctx.shadowBlur = isLow ? 0 : _sb(8);
        for (const arc of this.arcJitter) {
            const r = Math.max(0.1, radius + Math.sin(this.seed + arc.start + t * 5) * 3);
            ctx.globalAlpha = this.alpha * arc.weight;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = (isLow ? 2 : 4.5) * arc.weight * (1 - t * 0.35);
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, arc.start, arc.start + arc.span);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = this.alpha * (isLow ? 0.45 : 0.58);
        ctx.strokeStyle = withAlpha('#ffffff', isLow ? 0.45 : 0.8);
        ctx.lineWidth = isLow ? 1 : 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.1, radius - band * 0.45), 0, Math.PI * 2);
        ctx.stroke();

        const spokeCount = isLow ? 4 : this.spokes.length;
        for (let i = 0; i < spokeCount; i++) {
            const spoke = this.spokes[i];
            const inner = radius * 0.45;
            const outer = radius * spoke.reach;
            const fade = this.alpha * (1 - t * 0.45);
            const grad = ctx.createLinearGradient(
                this.x + Math.cos(spoke.angle) * inner,
                this.y + Math.sin(spoke.angle) * inner,
                this.x + Math.cos(spoke.angle) * outer,
                this.y + Math.sin(spoke.angle) * outer
            );
            grad.addColorStop(0, withAlpha(this.color, 0));
            grad.addColorStop(0.55, withAlpha(this.color, fade * 0.42));
            grad.addColorStop(1, withAlpha('#ffffff', 0));
            ctx.globalAlpha = 1;
            ctx.strokeStyle = grad;
            ctx.lineWidth = spoke.width;
            ctx.beginPath();
            ctx.moveTo(
                this.x + Math.cos(spoke.angle) * inner,
                this.y + Math.sin(spoke.angle) * inner
            );
            ctx.lineTo(
                this.x + Math.cos(spoke.angle) * outer,
                this.y + Math.sin(spoke.angle) * outer
            );
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

// @perf-impact: Greedy wheel radial glow and shadowBlur - gated by quality and greedyWheelEffectLimit
// --- 贪婪轮盘链式发射特效 ---
class GreedyWheelEffect {
    constructor(x, y, mode = 'prelude', quality = 'high') {
        this.x = x;
        this.y = y;
        this.mode = mode;
        this.quality = quality || 'high';
        this.age = 0;
        this.duration = mode === 'prelude' ? 28 : (mode === 'success' ? 34 : 24);
        this.life = 1.0;
        this.seed = Math.random() * Math.PI * 2;
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        this.age += timeScale;
        this.life = Math.max(0, 1 - this.age / this.duration);
    }

    draw(ctx) {
        if (this.life <= 0) return;

        // [PixiJS 迁移 · 阶段三] GreedyWheelEffect
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = greedyWheelEffect_pixiCreate(this);
            if (this._pixi) { greedyWheelEffect_pixiSync(this, this._pixi); return; }
        }

        const t = Math.min(1, this.age / this.duration);
        const isLow = this.quality === 'low';
        const isFail = this.mode === 'fail';
        const isSuccess = this.mode === 'success';
        const gold = isFail ? '#ef4444' : '#fbbf24';
        const dark = isFail ? '#450a0a' : '#451a03';
        const radius = this.mode === 'prelude'
            ? 40 - t * 18
            : 18 + t * (isSuccess ? 58 : 42);
        const alpha = this.life;
        const spin = this.seed + (isFail ? -1 : 1) * t * Math.PI * 1.8;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = isLow ? 'source-over' : 'lighter';

        if (!isLow) {
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.25);
            glow.addColorStop(0, isFail ? `rgba(239,68,68,${0.25 * alpha})` : `rgba(255,255,220,${0.28 * alpha})`);
            glow.addColorStop(0.45, isFail ? `rgba(127,29,29,${0.22 * alpha})` : `rgba(251,191,36,${0.22 * alpha})`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = gold;
            ctx.shadowBlur = _sb(isSuccess ? 18 : 10);
        }

        ctx.rotate(spin);
        ctx.lineWidth = isLow ? 2 : 3;
        ctx.strokeStyle = gold;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            const inner = Math.max(6, radius * 0.45);
            const outer = radius * (this.mode === 'prelude' ? (1.15 - t * 0.25) : 1);
            ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
            ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, Math.max(8, radius * 0.58), 0, Math.PI * 2);
        ctx.strokeStyle = isFail ? '#fca5a5' : '#fde68a';
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a0 = i * Math.PI / 2 + (isFail ? t * 0.8 : 0);
            ctx.arc(0, 0, radius, a0, a0 + Math.PI * 0.32);
        }
        ctx.strokeStyle = isFail ? '#991b1b' : '#f59e0b';
        ctx.stroke();

        if (isFail) {
            ctx.strokeStyle = '#fecaca';
            ctx.lineWidth = isLow ? 1.5 : 2.5;
            for (let i = 0; i < 5; i++) {
                const a = this.seed + i * 1.7;
                const start = radius * 0.25;
                const end = radius * (0.8 + (i % 2) * 0.2);
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * start, Math.sin(a) * start);
                ctx.lineTo(Math.cos(a + 0.18) * end, Math.sin(a + 0.18) * end);
                ctx.stroke();
            }
        } else {
            ctx.fillStyle = isSuccess ? '#fff7ed' : dark;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(4, radius * 0.16), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// --- 新增：激光光束特效 ---
class LaserBeam {
    /**
     * @param {Vec2[]} segments - 路径点数组
     * @param {number} width - 光束宽度
     * @param {string} color - 光束颜色
     * @param {boolean} [isContinuous=false] - 持续模式：decay=0，由外部调用 startFadeOut() 触发淡出
     */
    constructor(segments, width, color, isContinuous = false) {
        this.segments = segments; // Array of Vec2 points [start, p1, p2, end]
        this.width = width;
        this.initialWidth = width;
        this.color = color;
        this.isContinuous = isContinuous;
        this.life = 1.0;
        this.decay = isContinuous ? 0 : 0.04; // 持续模式下不自动衰减
        this._pixi = null; // [PixiJS 迁移]
    }

    /**
     * 触发淡出：将 decay 恢复为正常值，激光开始消退。
     * 由持续照射状态机在 tick 切换或结束时主动调用，确保动画与伤害同步消退。
     */
    startFadeOut() {
        this.decay = 0.04;
    }

    update(timeScale) {
        this.life -= this.decay * timeScale;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] LaserBeam → PIXI.Graphics 多层辉光（消除 shadowBlur + lighter）
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = laserBeam_pixiCreate();
            if (this._pixi) { laserBeam_pixiSync(this, this._pixi); return; }
        }
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
        ctx.shadowBlur = _sb(20);
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
        ctx.shadowBlur = _sb(10);
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
     * @param {number} [fontSize=16] - 字号
     * @param {HTMLImageElement|null} [iconImg=null] - 可选图标图片（渲染在文字左侧）
     */
    constructor(x, y, text, color = '#fbbf24', fontSize = 16, iconImg = null) { 
        this.pos = new Vec2(x, y); 
        this.vel = new Vec2(0, -1); // 向上飄
        this.life = 1.0; 
        this.text = text; 
        this.color = color;
        this.fontSize = fontSize;
        this.iconImg = iconImg;
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        this.pos = this.pos.add(this.vel.mult(timeScale)); 
        this.life -= 0.02 * timeScale; 
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] FloatingText
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = floatingText_pixiCreate(this);
            if (this._pixi) { floatingText_pixiSync(this, this._pixi); return; }
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life); 
        ctx.font = `bold ${this.fontSize}px sans-serif`; 
        ctx.textAlign = 'center';

        let textOffsetX = 0;

        // 绘制图标（如果有）
        if (this.iconImg && this.iconImg.complete && this.iconImg.naturalWidth > 0) {
            const iconSize = this.fontSize * 1.2;
            const textWidth = ctx.measureText(this.text).width;
            const totalWidth = iconSize + 3 + textWidth;
            const startX = this.pos.x - totalWidth / 2;
            const iconX = startX;
            const iconY = this.pos.y - this.fontSize * 0.8;

            ctx.drawImage(this.iconImg, iconX, iconY, iconSize, iconSize);
            // 文字偏移到图标右侧
            textOffsetX = (iconSize + 3 + textWidth) / 2 - textWidth / 2;
        }
        
        const drawX = this.pos.x + textOffsetX;

        // 繪製描邊讓文字更清楚
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = Math.max(3, this.fontSize / 5);
        ctx.strokeText(this.text, drawX, this.pos.y);
        
        // 繪製填充
        ctx.fillStyle = this.color; 
        ctx.fillText(this.text, drawX, this.pos.y); 
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
    constructor(x, y, targetX, targetY, color, initialVel, onArrive, options = {}) {
        this.pos = new Vec2(x, y);
        this.target = new Vec2(targetX, targetY);
        this.onArrive = onArrive;
        this.color = color || '#fbbf24';

        // 物理参数
        const burstXMult = options.burstXMult ?? 1.85;
        const burstYMult = options.burstYMult ?? 0.42;
        let burstVel = new Vec2(initialVel.x * burstXMult, initialVel.y * burstYMult);
        const spreadAngle = (Math.random() - 0.5) * 0.6;
        this.vel = burstVel.rotate(spreadAngle);
        
        const minSpeed = options.minSpeed ?? 1.8;
        if (this.vel.mag() < minSpeed) {
            this.vel = this.vel.norm().mult(minSpeed);
        }

        this.active = true;
        
        // --- 优化：减少拖尾长度 ---
        this.trail = []; 
        this.maxTrailLen = options.maxTrailLen ?? 4;

        this.baseSize = options.baseSize ?? 1.45; 
        this.trailAlpha = options.trailAlpha ?? 0.16;
        this.haloAlpha = options.haloAlpha ?? 0.18;
        this.coreAlpha = options.coreAlpha ?? 0.82;
        this.compositeOperation = options.compositeOperation || 'source-over';
        this.arriveRadius = options.arriveRadius ?? 24;
        this.timer = 0;
        this.seed = Math.random() * 100;

        this.hoverTime = options.hoverTime ?? 14;     
        this.friction = options.friction ?? 0.9;    
        this.floatForce = options.floatForce ?? 0.12;  
        this.suctionAcc = options.suctionAcc ?? 0.08;  
        this.currentSuction = 0;
        this._pixi = null; // [PixiJS 迁移]
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

            if (dist < this.arriveRadius) { 
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
        // [PixiJS 迁移 · 阶段三] EnergyOrb
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = energyOrb_pixiCreate(this);
            if (this._pixi) { energyOrb_pixiSync(this, this._pixi); return; }
        }
        ctx.save();

        // @perf-impact: Gathering hit orbs use source-over by default; no shadowBlur or gradients.
        ctx.globalCompositeOperation = this.compositeOperation; 

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
            ctx.globalAlpha = this.trailAlpha;
            
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
        ctx.globalAlpha = this.haloAlpha;
        // 大小随闪烁变化
        ctx.arc(this.pos.x, this.pos.y, this.baseSize * 2.0 * flicker, 0, Math.PI * 2);
        ctx.fill();

        // 绘制核心亮点
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = this.coreAlpha;
        ctx.arc(this.pos.x, this.pos.y, this.baseSize * 0.62, 0, Math.PI * 2);
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
        this._pixi = null; // [PixiJS 迁移]
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
        // [PixiJS 迁移 · 阶段三] LightningBolt → PIXI.Graphics 批量线段（消除 N×shadowBlur）
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = lightningBolt_pixiCreate();
            if (this._pixi) { lightningBolt_pixiSync(this, this._pixi); return; }
        }
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
            ctx.shadowBlur = _sb(15);
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
            ctx.shadowBlur = _sb(10);
            ctx.beginPath(); ctx.arc(this.start.x, this.start.y, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(this.end.x, this.end.y, 4, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore();
    }
}

// @perf-impact: 火焰范围波细化 - 仍由 waveLimit 控制，low 档关闭径向填充和 shadowBlur。
class FireWave {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.maxRadius = 80; // 擴散範圍
        this.life = 1.0;
        this.seed = Math.random() * Math.PI * 2;
        this.flameArcs = Array.from({ length: 9 }, (_, i) => ({
            start: this.seed + i * Math.PI * 2 / 9 + (Math.random() - 0.5) * 0.28,
            span: 0.32 + Math.random() * 0.38,
            lift: 0.85 + Math.random() * 0.28,
        }));
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        this.radius += 5 * timeScale; // 擴散速度
        this.life -= 0.05 * timeScale;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] FireWave
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = fireWave_pixiCreate(this);
            if (this._pixi) { fireWave_pixiSync(this, this._pixi); return; }
        }
        const quality = (typeof game !== 'undefined' && game.perfQualityLevel) || 'high';
        const isLow = quality === 'low';
        const t = Math.min(1, this.radius / this.maxRadius);
        ctx.save();
        ctx.globalCompositeOperation = isLow ? 'source-over' : 'lighter';

        if (!isLow) {
            const heat = ctx.createRadialGradient(this.x, this.y, this.radius * 0.38, this.x, this.y, this.radius * 1.05);
            heat.addColorStop(0, 'rgba(255, 200, 0, 0)');
            heat.addColorStop(0.52, `rgba(249, 115, 22, ${this.life * 0.22})`);
            heat.addColorStop(0.82, `rgba(220, 38, 38, ${this.life * 0.18})`);
            heat.addColorStop(1, 'rgba(127, 29, 29, 0)');
            ctx.fillStyle = heat;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 1.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = _sb(10);
        }

        for (const arc of this.flameArcs) {
            const r = this.radius * arc.lift;
            ctx.globalAlpha = this.life * (0.72 + 0.28 * arc.lift);
            ctx.strokeStyle = arc.lift > 1 ? '#ef4444' : '#f97316';
            ctx.lineWidth = (isLow ? 2.2 : 4.2) * (1 - t * 0.25);
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, arc.start, arc.start + arc.span);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        const spokeCount = isLow ? 4 : 8;
        for (let i = 0; i < spokeCount; i++) {
            const a = this.seed + i * Math.PI * 2 / spokeCount + t * 0.25;
            const inner = this.radius * 0.32;
            const outer = this.radius * (0.72 + (i % 3) * 0.08);
            const grad = ctx.createLinearGradient(
                this.x + Math.cos(a) * inner,
                this.y + Math.sin(a) * inner,
                this.x + Math.cos(a) * outer,
                this.y + Math.sin(a) * outer
            );
            grad.addColorStop(0, 'rgba(253,186,116,0)');
            grad.addColorStop(0.55, `rgba(253,186,116,${this.life * 0.45})`);
            grad.addColorStop(1, 'rgba(239,68,68,0)');
            ctx.globalAlpha = 1;
            ctx.strokeStyle = grad;
            ctx.lineWidth = isLow ? 1 : 1.7;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(a) * inner, this.y + Math.sin(a) * inner);
            ctx.lineTo(this.x + Math.cos(a) * outer, this.y + Math.sin(a) * outer);
            ctx.stroke();
        }

        ctx.globalAlpha = this.life * 0.55;
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = isLow ? 1 : 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.55, this.seed + t, this.seed + t + Math.PI * 1.35);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}


// ==================== 持续燃烧特效 ====================
/**
 * BurnEffect - 敌人持续燃烧的持久视觉特效
 *
 * 附着在 temp >= 34 的敌人身上，强度随温度平滑缩放。
 * 三层视觉：热光环脉冲 + 体焰弧 + 火星飘升
 *
 * 由 enemy.js 管理生命周期（创建/更新/销毁），不在全局数组中。
 *
 * @perf-impact: 持续燃烧特效 - 每敌人 1 Sprite + 1 Graphics + 4 ember Sprite（WebGL 批处理）
 */
class BurnEffect {
    /**
     * @param {object} enemy - 敌人实例引用
     */
    constructor(enemy) {
        this.enemy = enemy;
        this.x = enemy.pos.x;
        this.y = enemy.pos.y;
        this.width = enemy.width;
        this.height = enemy.height;
        this.intensity = 0;           // 0-1，平滑渐变
        this.time = Math.random() * 100; // 相位偏移，避免多敌人同步
        this._pixi = null;

        // 火星飘升池（最多 4 个，内部循环复用）
        this._embers = Array.from({ length: 4 }, (_, i) => ({
            x: 0, y: 0, vy: 0, vx: 0,
            life: 0, maxLife: 0.8 + Math.random() * 0.4,
            size: 2 + Math.random() * 2,
            phase: i * Math.PI * 0.5,
            active: false,
        }));
        this._emberTimer = 0;

        // 焰弧种子（6 段，固定随机偏移确保有机感）
        this._flameSeeds = Array.from({ length: 6 }, () => ({
            angle: Math.random() * Math.PI * 2,
            span: 0.25 + Math.random() * 0.35,
            lift: 0.7 + Math.random() * 0.35,
            speed: 0.8 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2,
        }));
    }

    /**
     * 每帧更新：跟踪位置、平滑强度、更新火星
     */
    update(pos, temp, timeScale) {
        this.x = pos.x;
        this.y = pos.y;
        this.width = this.enemy.width;
        this.height = this.enemy.height;
        this.time += 0.05 * timeScale;

        // 平滑强度渐变：temp 25→125 映射到 0→1
        const target = Math.max(0, Math.min(1, (temp - 25) / 100));
        this.intensity += (target - this.intensity) * 0.08 * timeScale;

        this._updateEmbers(timeScale);
    }

    /**
     * 火星飘升池更新：循环发射 + 上升衰减 + 自动回收
     */
    _updateEmbers(timeScale) {
        this._emberTimer += timeScale;
        const spawnInterval = 0.6 / Math.max(0.15, this.intensity);

        for (const e of this._embers) {
            if (e.active) {
                e.x += e.vx * timeScale;
                e.y += e.vy * timeScale;
                e.vy -= 0.02 * timeScale; // 减速上升
                e.life -= 0.025 * timeScale;
                if (e.life <= 0) e.active = false;
            } else if (this._emberTimer >= spawnInterval && this.intensity > 0.1) {
                // 重新发射
                e.x = this.x + (Math.random() - 0.5) * this.width * 0.6;
                e.y = this.y - this.height * (0.2 + Math.random() * 0.3);
                e.vx = (Math.random() - 0.5) * 0.4;
                e.vy = -(0.6 + Math.random() * 0.8);
                e.life = e.maxLife;
                e.active = true;
                this._emberTimer = 0;
            }
        }
    }

    draw(ctx) {
        if (this.intensity < 0.01) return;

        // [PixiJS 迁移] WebGL 路径
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = burnEffect_pixiCreate(this);
            if (this._pixi) { burnEffect_pixiSync(this, this._pixi); return; }
        }

        // Canvas 2D 回退
        this._drawCanvas2D(ctx);
    }

    /**
     * Canvas 2D 回退绘制：热光环 + 焰弧 + 火星
     */
    _drawCanvas2D(ctx) {
        const w = this.width, h = this.height;
        const intensity = this.intensity;
        const t = this.time;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'lighter';

        // 层 1：热光环脉冲
        const pulse = (Math.sin(t * 2.5) + 1) * 0.5; // 0-1 脉冲
        const auraAlpha = intensity * (0.12 + pulse * 0.08);
        const auraR = Math.max(w, h) * (0.6 + pulse * 0.08);
        const auraGrad = ctx.createRadialGradient(0, 0, auraR * 0.2, 0, 0, auraR);
        auraGrad.addColorStop(0, `rgba(251, 146, 60, ${auraAlpha})`);
        auraGrad.addColorStop(0.5, `rgba(239, 68, 68, ${auraAlpha * 0.5})`);
        auraGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();

        // 层 2：体焰弧（6 段跳动的火焰弧）
        for (const seed of this._flameSeeds) {
            const flicker = Math.sin(t * seed.speed + seed.phase);
            const r = Math.max(w, h) * 0.45 * seed.lift;
            const arcAlpha = intensity * (0.4 + flicker * 0.2);
            const lw = 2.5 + flicker * 0.8;
            const startAngle = seed.angle + t * 0.3 * seed.speed;
            ctx.globalAlpha = Math.max(0, arcAlpha);
            ctx.strokeStyle = seed.lift > 0.85 ? '#fbbf24' : '#f97316';
            ctx.lineWidth = lw;
            ctx.shadowBlur = _sb(6 * intensity);
            ctx.shadowColor = '#f97316';
            ctx.beginPath();
            ctx.arc(0, 0, r, startAngle, startAngle + seed.span);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // 层 3：火星（Canvas 2D 简化版 - 小圆点）
        ctx.globalCompositeOperation = 'lighter';
        for (const e of this._embers) {
            if (!e.active) continue;
            const ea = (e.life / e.maxLife) * intensity;
            ctx.globalAlpha = Math.max(0, ea);
            ctx.fillStyle = ea > 0.5 ? '#fbbf24' : '#f97316';
            ctx.beginPath();
            ctx.arc(e.x - this.x, e.y - this.y, e.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    destroy() {
        if (this._pixi) { burnEffect_pixiDestroy(this._pixi); this._pixi = null; }
        for (const e of this._embers) e.active = false;
    }
}

// ==================== 持续电弧特效 ====================
/**
 * ElectrocuteEffect - 敌人被闪电命中后的持续电弧视觉特效
 *
 * 附着在 lightning 命中的敌人身上，持续 2-3 秒（每次命中刷新计时器）。
 * 3-5 条随机锯齿电弧在敌人表面闪烁，每 100-200ms 重新随机路径。
 *
 * @perf-impact: 持续电弧特效 - 每敌人 1 Graphics（电弧路径重绘频率 5-10Hz）
 */
class ElectrocuteEffect {
    /**
     * @param {object} enemy - 敌人实例引用
     * @param {number} [duration=2500] - 持续时间（毫秒）
     */
    constructor(enemy, duration = 2500) {
        this.enemy = enemy;
        this.x = enemy.pos.x;
        this.y = enemy.pos.y;
        this.width = enemy.width;
        this.height = enemy.height;
        this._pixi = null;

        this.timer = duration;       // 剩余时间（毫秒）
        this.maxTimer = duration;
        this.intensity = 1.0;

        // 电弧路径池（最多 5 条）
        this._arcs = Array.from({ length: 5 }, () => ({
            points: [],
            life: 0,
            maxLife: 0,
            active: false,
        }));
        this._arcTimer = 0;          // 下次生成电弧的倒计时（毫秒）
        this._arcInterval = 120;     // 电弧重绘间隔（毫秒）
    }

    /** 刷新持续时间（每次 lightning 命中调用） */
    refresh(duration = 2500) {
        this.timer = Math.max(this.timer, duration);
        this.maxTimer = Math.max(this.maxTimer, duration);
    }

    update(pos, timeScale) {
        this.x = pos.x;
        this.y = pos.y;
        this.width = this.enemy.width;
        this.height = this.enemy.height;

        const dtMs = timeScale * 16.67; // 近似毫秒
        this.timer -= dtMs;
        this.intensity = Math.max(0, Math.min(1, this.timer / (this.maxTimer * 0.3)));

        // 电弧生命周期
        this._arcTimer -= dtMs;
        for (const arc of this._arcs) {
            if (arc.active) {
                arc.life -= dtMs;
                if (arc.life <= 0) arc.active = false;
            }
        }

        // 生成新电弧
        if (this._arcTimer <= 0 && this.intensity > 0.05) {
            this._spawnArc();
            this._arcTimer = this._arcInterval + Math.random() * 80;
        }
    }

    _spawnArc() {
        const arc = this._arcs.find(a => !a.active);
        if (!arc) return;

        const w = this.width, h = this.height;
        const segments = 3 + Math.floor(Math.random() * 3); // 3-5 段
        const points = [];

        // 起点：敌人表面随机位置
        let px = (Math.random() - 0.5) * w * 0.8;
        let py = (Math.random() - 0.5) * h * 0.8;
        points.push({ x: px, y: py });

        for (let i = 0; i < segments; i++) {
            px += (Math.random() - 0.5) * w * 0.4;
            py += (Math.random() - 0.5) * h * 0.4;
            points.push({ x: px, y: py });
        }

        arc.points = points;
        arc.life = 80 + Math.random() * 120; // 80-200ms
        arc.maxLife = arc.life;
        arc.active = true;
    }

    draw(ctx) {
        if (this.intensity < 0.01) return;

        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = electrocuteEffect_pixiCreate(this);
            if (this._pixi) { electrocuteEffect_pixiSync(this, this._pixi); return; }
        }

        this._drawCanvas2D(ctx);
    }

    _drawCanvas2D(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'lighter';

        for (const arc of this._arcs) {
            if (!arc.active || arc.points.length < 2) continue;
            const alpha = (arc.life / arc.maxLife) * this.intensity;

            // 外辉光
            ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.4})`;
            ctx.lineWidth = 4;
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = _sb(8 * this.intensity);
            ctx.beginPath();
            ctx.moveTo(arc.points[0].x, arc.points[0].y);
            for (let i = 1; i < arc.points.length; i++) {
                ctx.lineTo(arc.points[i].x, arc.points[i].y);
            }
            ctx.stroke();

            // 核心白线
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(arc.points[0].x, arc.points[0].y);
            for (let i = 1; i < arc.points.length; i++) {
                ctx.lineTo(arc.points[i].x, arc.points[i].y);
            }
            ctx.stroke();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    destroy() {
        if (this._pixi) { electrocuteEffect_pixiDestroy(this._pixi); this._pixi = null; }
        for (const a of this._arcs) a.active = false;
    }

    get active() { return this.timer > 0; }
}

// ==================== 持续毒液特效 ====================
/**
 * VenomEffect - 敌人被毒液命中后的持续渗流视觉特效
 *
 * 附着在 venom 命中的敌人身上，持续时间与 venom DoT 同步。
 * 2-3 条绿色毒液沿敌人表面缓慢流淌 + 底部滴落粒子。
 *
 * @perf-impact: 持续毒液特效 - 每敌人 1 Graphics + 1-2 venom 粒子
 */
class VenomEffect {
    /**
     * @param {object} enemy - 敌人实例引用
     * @param {number} [stacks=1] - 毒素层数（影响视觉密度）
     */
    constructor(enemy, stacks = 1) {
        this.enemy = enemy;
        this.x = enemy.pos.x;
        this.y = enemy.pos.y;
        this.width = enemy.width;
        this.height = enemy.height;
        this._pixi = null;

        this.stacks = Math.min(10, stacks);
        this.timer = 3000 + stacks * 500; // 持续时间随层数增加
        this.maxTimer = this.timer;
        this.intensity = 1.0;
        this.time = Math.random() * 100;

        // 毒液路径池（最多 3 条）
        this._drips = Array.from({ length: 3 }, (_, i) => ({
            startX: (Math.random() - 0.5) * 0.6,
            progress: Math.random() * 0.3,
            speed: 0.15 + Math.random() * 0.1,
            wobble: Math.random() * Math.PI * 2,
            active: i < Math.min(3, 1 + Math.floor(stacks / 2)),
        }));
    }

    /** 追加毒素层数（每次 venom 命中调用） */
    addStacks(stacks) {
        this.stacks = Math.min(10, this.stacks + stacks);
        this.timer = Math.max(this.timer, 3000 + this.stacks * 500);
        this.maxTimer = this.timer;
        // 激活更多滴流
        const activeCount = Math.min(3, 1 + Math.floor(this.stacks / 2));
        for (let i = 0; i < this._drips.length; i++) {
            if (i < activeCount) this._drips[i].active = true;
        }
    }

    update(pos, timeScale) {
        this.x = pos.x;
        this.y = pos.y;
        this.width = this.enemy.width;
        this.height = this.enemy.height;
        this.time += 0.03 * timeScale;

        const dtMs = timeScale * 16.67;
        this.timer -= dtMs;
        this.intensity = Math.max(0, Math.min(1, this.timer / (this.maxTimer * 0.25)));

        // 毒液路径流动
        for (const drip of this._drips) {
            if (!drip.active) continue;
            drip.progress += drip.speed * timeScale * 0.02;
            if (drip.progress > 1.0) {
                drip.progress = 0;
                drip.startX = (Math.random() - 0.5) * 0.6;
                drip.wobble = Math.random() * Math.PI * 2;
            }
        }
    }

    draw(ctx) {
        if (this.intensity < 0.01) return;

        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = venomEffect_pixiCreate(this);
            if (this._pixi) { venomEffect_pixiSync(this, this._pixi); return; }
        }

        this._drawCanvas2D(ctx);
    }

    _drawCanvas2D(ctx) {
        const w = this.width, h = this.height;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'lighter';

        for (const drip of this._drips) {
            if (!drip.active) continue;

            const alpha = this.intensity * 0.6;
            const pathLen = h * 0.7;
            const sx = drip.startX * w;
            const sy = -h * 0.35;
            const ey = sy + pathLen * drip.progress;
            const wobX = Math.sin(this.time * 2 + drip.wobble) * w * 0.05;

            // 毒液路径
            ctx.strokeStyle = `rgba(132, 204, 22, ${alpha})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#84cc16';
            ctx.shadowBlur = _sb(4 * this.intensity);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(
                sx + wobX, sy + pathLen * 0.3,
                sx - wobX, sy + pathLen * 0.6,
                sx + wobX * 0.5, ey
            );
            ctx.stroke();

            // 毒液滴落点
            if (drip.progress > 0.7) {
                const dotAlpha = (drip.progress - 0.7) / 0.3 * alpha;
                ctx.fillStyle = `rgba(200, 255, 180, ${dotAlpha})`;
                ctx.beginPath();
                ctx.arc(sx + wobX * 0.5, ey, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    destroy() {
        if (this._pixi) { venomEffect_pixiDestroy(this._pixi); this._pixi = null; }
        for (const d of this._drips) d.active = false;
    }

    get active() { return this.timer > 0; }
}

// ==================== 持续风场特效 ====================
/**
 * WindMarkEffect - 敌人被风属性命中后的旋转风场标记
 *
 * 附着在 wind 命中的敌人身上，持续 1.5 秒（每次命中刷新）。
 * 底层旋转风环 + 上层弧形风线围绕敌人旋转。
 *
 * @perf-impact: 持续风场特效 - 每敌人 1 Sprite（windVortex 纹理）+ 1 Graphics（风线）
 */
class WindMarkEffect {
    /**
     * @param {object} enemy - 敌人实例引用
     * @param {number} [windLevel=1] - 风属性层数（影响风线数量）
     */
    constructor(enemy, windLevel = 1) {
        this.enemy = enemy;
        this.x = enemy.pos.x;
        this.y = enemy.pos.y;
        this.width = enemy.width;
        this.height = enemy.height;
        this._pixi = null;

        this.timer = 1500;           // 持续时间（毫秒）
        this.maxTimer = 1500;
        this.intensity = 1.0;
        this.rotation = Math.random() * Math.PI * 2;
        this.windLevel = windLevel;

        // 风线数量：每 2 层 +1，最多 5 条
        this._bladeCount = Math.min(5, 2 + Math.floor(windLevel / 2));
        this._bladeSeeds = Array.from({ length: 5 }, () => ({
            offset: Math.random() * Math.PI * 2,
            radius: 0.5 + Math.random() * 0.2,
            span: 0.3 + Math.random() * 0.25,
            speed: 0.8 + Math.random() * 0.4,
        }));
    }

    /** 刷新持续时间 + 更新风属性层数 */
    refresh(windLevel = 1) {
        this.timer = 1500;
        this.maxTimer = 1500;
        this.windLevel = Math.max(this.windLevel, windLevel);
        this._bladeCount = Math.min(5, 2 + Math.floor(this.windLevel / 2));
    }

    update(pos, timeScale) {
        this.x = pos.x;
        this.y = pos.y;
        this.width = this.enemy.width;
        this.height = this.enemy.height;

        const dtMs = timeScale * 16.67;
        this.timer -= dtMs;
        this.intensity = Math.max(0, Math.min(1, this.timer / (this.maxTimer * 0.3)));
        this.rotation += 1.8 * timeScale * 0.05; // 旋转速度
    }

    draw(ctx) {
        if (this.intensity < 0.01) return;

        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = windMarkEffect_pixiCreate(this);
            if (this._pixi) { windMarkEffect_pixiSync(this, this._pixi); return; }
        }

        this._drawCanvas2D(ctx);
    }

    _drawCanvas2D(ctx) {
        const w = this.width, h = this.height;
        const baseR = Math.max(w, h) * 0.55;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'lighter';

        // 底层：旋转风环（微弱）
        const ringAlpha = this.intensity * 0.2;
        ctx.strokeStyle = `rgba(52, 211, 153, ${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, baseR, this.rotation, this.rotation + Math.PI * 1.5);
        ctx.stroke();

        // 上层：弧形风线
        for (let i = 0; i < this._bladeCount; i++) {
            const seed = this._bladeSeeds[i];
            const angle = this.rotation * seed.speed + seed.offset;
            const r = baseR * seed.radius;
            const alpha = this.intensity * 0.5;

            ctx.strokeStyle = `rgba(209, 250, 229, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = _sb(4 * this.intensity);
            ctx.beginPath();
            ctx.arc(0, 0, r, angle, angle + seed.span);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    destroy() {
        if (this._pixi) { windMarkEffect_pixiDestroy(this._pixi); this._pixi = null; }
    }

    get active() { return this.timer > 0; }
}

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
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        this.radius += 6 * timeScale;
        this.life -= 0.045 * timeScale;
        this.innerRadius += 3.5 * timeScale;
        this.innerLife -= 0.06 * timeScale;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] IceWave → 预烘焙冰晶环 Sprite
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = iceWave_pixiCreate(this);
            if (this._pixi) { iceWave_pixiSync(this, this._pixi); return; }
        }
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
 * 设计理念：不是向外爆炸，而是按敌人层级拆解材质
 *   - 普通：小圆圈内缩消失 + 灰色烟尘向内漂散
 *   - 精英：紫晶裂隙切开 + 碎片分离 + 暗芯熄灭
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
            this.voidEnabled = true;
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
            // 精英：紫晶裂隙，不再使用圆形光圈。
            this.decay = 0.024;
            this.collapseRings = [];
            this.collapseSpeed = 4.0;
            this.collapseStarted = true; // 精英直接内缩
            this.expanding = false;
            this.expandR = 0;
            this.voidLife = 0;
            this.voidRadius = 0;
            this.voidMaxRadius = 0;
            this.voidDecay = 0.03;
            this.voidEnabled = false;
            this.eliteFractureAngle = Math.random() * Math.PI * 2;
            this.eliteCuts = Array.from({ length: 5 }, (_, i) => ({
                angle: this.eliteFractureAngle + (i - 2) * 0.34 + (Math.random() - 0.5) * 0.2,
                offset: (i - 2) * 7 + (Math.random() - 0.5) * 5,
                length: 32 + Math.random() * 34,
                alpha: 0.55 + Math.random() * 0.35,
            }));
            this.eliteShards = Array.from({ length: 12 }, (_, i) => ({
                angle: this.eliteFractureAngle + Math.PI * (i % 2 ? 0.5 : -0.5) + (Math.random() - 0.5) * 1.1,
                along: (Math.random() - 0.5) * 54,
                dist: 4 + Math.random() * 8,
                speed: 1.2 + Math.random() * 2.4,
                size: 3 + Math.random() * 4,
                spin: (Math.random() - 0.5) * 0.18,
                spinAngle: Math.random() * Math.PI * 2,
                alpha: 0.58 + Math.random() * 0.35,
                color: Math.random() < 0.58 ? '#c084fc' : '#e9d5ff',
            }));
            this.souls = [];
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
            this.voidEnabled = true;
            this.souls = Array.from({ length: 5 }, () => ({
                angle: Math.random() * Math.PI * 2,
                dist: 18 + Math.random() * 10,
                speed: 1.2 + Math.random() * 0.8,
                size: 0.8 + Math.random() * 1,
                alpha: 0.4 + Math.random() * 0.3,
                color: '#94a3b8',
            }));
        }
        this._pixi = null; // [PixiJS 迁移]
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
            if (this.voidEnabled && this.voidLife <= 0 && !this.expanding && this.tier !== 'boss') {
                this.voidLife = 0.5;
                this.voidRadius = 0;
            }
        }

        if (this.tier === 'elite') {
            for (const shard of this.eliteShards) {
                shard.dist += shard.speed * timeScale;
                shard.spinAngle += shard.spin * timeScale;
            }
        }

        // 虚空孔洞生长并消退
        if (this.voidEnabled && this.voidLife > 0) {
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
        // [PixiJS 迁移 · 阶段三] DeathExplosion
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = deathExplosion_pixiCreate(this);
            if (this._pixi) { deathExplosion_pixiSync(this, this._pixi); return; }
        }
        ctx.save();
        const quality = (typeof game !== 'undefined' && game.perfQualityLevel) || 'high';
        const isLow = quality === 'low';
        const t = Math.min(1, this.timer / (1 / this.decay));

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

        // ---- 1b. 精英死亡：紫晶裂解，不绘制圆形光圈 ----
        if (this.tier === 'elite') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.eliteFractureAngle);
            ctx.globalCompositeOperation = isLow ? 'source-over' : 'lighter';

            if (!isLow) {
                ctx.globalAlpha = this.life * 0.28;
                const core = ctx.createLinearGradient(-42, 0, 42, 0);
                core.addColorStop(0, 'rgba(192,132,252,0)');
                core.addColorStop(0.48, withAlpha('#c084fc', 0.62 * this.life));
                core.addColorStop(0.52, withAlpha('#ffffff', 0.7 * this.life));
                core.addColorStop(1, 'rgba(192,132,252,0)');
                ctx.fillStyle = core;
                ctx.beginPath();
                ctx.moveTo(-42, -5 - t * 5);
                ctx.lineTo(42, -2 - t * 8);
                ctx.lineTo(36, 6 + t * 8);
                ctx.lineTo(-38, 4 + t * 5);
                ctx.closePath();
                ctx.fill();
            }

            ctx.lineCap = 'round';
            for (const cut of this.eliteCuts) {
                const localT = Math.min(1, t * 1.25);
                const half = cut.length * (0.35 + localT * 0.65) / 2;
                ctx.save();
                ctx.rotate(cut.angle - this.eliteFractureAngle);
                ctx.translate(0, cut.offset);
                ctx.globalAlpha = cut.alpha * this.life;
                ctx.strokeStyle = cut.alpha > 0.72 ? '#ffffff' : '#c084fc';
                ctx.lineWidth = isLow ? 1.4 : 2.2;
                if (!isLow) {
                    ctx.shadowColor = '#c084fc';
                    ctx.shadowBlur = _sb(8);
                }
                ctx.beginPath();
                ctx.moveTo(-half, 0);
                ctx.lineTo(half, 0);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = cut.alpha * this.life * 0.42;
                ctx.strokeStyle = '#2e1065';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-half * 0.75, 2.5);
                ctx.lineTo(half * 0.75, -2.5);
                ctx.stroke();
                ctx.restore();
            }

            for (const shard of this.eliteShards) {
                const sx = shard.along;
                const sy = Math.sin(shard.angle - this.eliteFractureAngle) * shard.dist;
                const side = sy >= 0 ? 1 : -1;
                ctx.save();
                ctx.translate(sx, sy + side * t * 10);
                ctx.rotate(shard.spinAngle);
                ctx.globalAlpha = shard.alpha * this.life;
                ctx.fillStyle = shard.color;
                ctx.beginPath();
                ctx.moveTo(-shard.size, 0);
                ctx.lineTo(shard.size * 0.95, -shard.size * 0.58);
                ctx.lineTo(shard.size * 0.35, shard.size * 1.05);
                ctx.closePath();
                ctx.fill();
                if (!isLow) {
                    ctx.globalAlpha = shard.alpha * this.life * 0.5;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
                ctx.restore();
            }

            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = this.life * 0.55;
            ctx.fillStyle = 'rgba(24, 12, 36, 0.78)';
            ctx.beginPath();
            ctx.moveTo(-18, -6 - t * 4);
            ctx.lineTo(18, -3 - t * 6);
            ctx.lineTo(14, 5 + t * 5);
            ctx.lineTo(-16, 4 + t * 4);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
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
        if (this.voidEnabled && this.voidLife > 0 && this.voidRadius > 0) {
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

// ==================== 扩散治疗波 ====================
/**
 * HealWave - 范围治疗技能触发时的扩散治疗波特效
 *
 * 设计理念：柔和的粉绿色治疗能量从施法者中心向外扩散，
 * 包含多圈同心扩散环 + 中心光晕 + 十字脉冲光线，
 * 视觉上比普通冲击波更「治愈」，扩散更慢、持续更久。
 *
 * 参数：
 *   x, y   - 施法者中心坐标
 *   range  - 治疗范围（像素），决定最大扩散半径
 */
class HealWave {
    constructor(x, y, range = 120) {
        this.x = x;
        this.y = y;
        this.maxRadius = range * 1.1; // 略超出治疗范围，给玩家清晰的视觉反馈
        // 主扩散环
        this.radius = 8;
        this.life = 1.0;
        this.decay = 0.022; // 比 Shockwave(0.04) 慢一倍，持续更久
        // 内圈（稍慢，形成层次感）
        this.innerRadius = 4;
        this.innerLife = 1.2;
        // 中心光晕（先膨胀后消退）
        this.glowRadius = 0;
        this.glowMaxRadius = range * 0.35;
        this.glowLife = 1.0;
        // 十字脉冲光线（4 条，向外延伸）
        this.crossLife = 1.0;
        this.crossLen = 0;
        this.crossMaxLen = range * 0.5;
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        const speed = (this.maxRadius / 28) * timeScale; // 约 28 帧扩散到最大半径
        this.radius += speed;
        this.life -= this.decay * timeScale;
        this.innerRadius += speed * 0.6;
        this.innerLife -= this.decay * 1.3 * timeScale;
        // 中心光晕：先快速膨胀，再随 life 消退
        if (this.glowRadius < this.glowMaxRadius) {
            this.glowRadius += (this.glowMaxRadius / 10) * timeScale;
        }
        this.glowLife -= this.decay * 1.1 * timeScale;
        // 十字光线：随主环同步延伸
        this.crossLen = this.radius * 0.55;
        this.crossLife = this.life * 1.1;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] HealWave → 预烘焙辉光/环 Sprite（消除 6 渐变 + 2 shadowBlur）
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = healWave_pixiCreate(this);
            if (this._pixi) { healWave_pixiSync(this, this._pixi); return; }
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // ---- 1. 中心柔光晕 ----
        if (this.glowLife > 0 && this.glowRadius > 0) {
            const gAlpha = Math.max(0, this.glowLife * 0.45);
            ctx.globalAlpha = gAlpha;
            const gGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.glowRadius);
            gGrad.addColorStop(0, 'rgba(134, 239, 172, 0.9)');  // 绿白核心
            gGrad.addColorStop(0.4, 'rgba(244, 114, 182, 0.6)'); // 粉色中间
            gGrad.addColorStop(1, 'rgba(244, 114, 182, 0)');     // 边缘透明
            ctx.fillStyle = gGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // ---- 2. 主扩散环（粉绿渐变描边 + 淡填充） ----
        if (this.life > 0 && this.radius > 0) {
            const rAlpha = Math.max(0, this.life);
            // 淡填充（环形渐变，仅边缘有色）
            const rGrad = ctx.createRadialGradient(
                this.x, this.y, this.radius * 0.55,
                this.x, this.y, this.radius
            );
            rGrad.addColorStop(0, 'rgba(134, 239, 172, 0)');
            rGrad.addColorStop(0.5, `rgba(134, 239, 172, ${rAlpha * 0.18})`);
            rGrad.addColorStop(0.8, `rgba(244, 114, 182, ${rAlpha * 0.22})`);
            rGrad.addColorStop(1, 'rgba(244, 114, 182, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = rGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            // 主环描边（粉色，较粗）
            ctx.globalAlpha = rAlpha * 0.9;
            ctx.strokeStyle = `rgba(244, 114, 182, ${rAlpha})`;
            ctx.lineWidth = 3.5;
            ctx.shadowBlur = _sb(12);
            ctx.shadowColor = '#f472b6';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // ---- 3. 内圈（绿色，稍慢，层次感） ----
        if (this.innerLife > 0 && this.innerRadius > 0) {
            const iAlpha = Math.max(0, Math.min(1, this.innerLife * 0.75));
            ctx.globalAlpha = iAlpha;
            ctx.strokeStyle = `rgba(134, 239, 172, ${iAlpha})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = _sb(8);
            ctx.shadowColor = '#86efac';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.innerRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // ---- 4. 十字脉冲光线（4 方向，随主环延伸） ----
        if (this.crossLife > 0 && this.crossLen > 0) {
            const cAlpha = Math.max(0, this.crossLife * 0.6);
            ctx.globalAlpha = cAlpha;
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of dirs) {
                const startR = this.radius * 0.3;
                const endR = this.radius * 0.3 + this.crossLen;
                const grad = ctx.createLinearGradient(
                    this.x + dx * startR, this.y + dy * startR,
                    this.x + dx * endR,   this.y + dy * endR
                );
                grad.addColorStop(0, `rgba(134, 239, 172, ${cAlpha})`);
                grad.addColorStop(1, 'rgba(244, 114, 182, 0)');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(this.x + dx * startR, this.y + dy * startR);
                ctx.lineTo(this.x + dx * endR,   this.y + dy * endR);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

// ==================== [剑刃风暴] 专属特效类 ====================

/**
 * BladeStormRing - 剑刃风暴范围扩散圆环特效
 * 以子弹为圆心，快速扩散到 radius 后消失，绿色风刃感
 */
class BladeStormRing {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.radius = radius * 0.3; // 从 30% 半径开始扩散
        this.life = 1.0;
        this.active = true;
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        if (!this.active) return;
        // 快速扩散到 maxRadius
        const expandSpeed = (this.maxRadius - this.radius) * 0.25;
        this.radius += expandSpeed * timeScale;
        this.life -= 0.12 * timeScale;
        if (this.life <= 0) {
            this.life = 0;
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active || this.life <= 0) return;

        // [PixiJS 迁移 · 阶段三] BladeStormRing
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = bladeStormRing_pixiCreate(this);
            if (this._pixi) { bladeStormRing_pixiSync(this, this._pixi); return; }
        }

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.life * 0.7;

        // 外圈：宽而淡的绿色光晕
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 8 * this.life;
        ctx.shadowBlur = _sb(16);
        ctx.shadowColor = '#34d399';
        ctx.stroke();

        // 内圈：细而亮的白色核心
        ctx.globalAlpha = this.life * 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.85, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * this.life;
        ctx.shadowBlur = _sb(6);
        ctx.shadowColor = '#ffffff';
        ctx.stroke();

        ctx.restore();
    }
}

/**
 * BladeStormVortex - 剑刃风暴：环绕中心持续旋转的「流光剑群」
 *
 * 设计要点（刻意区别于风属性的翠绿旋风）：
 *  - 配色走「钢冷青白」(#7dd3fc / #38bdf8 / #eaf6ff)，而非风属性的 #34d399，避免与风混淆；
 *  - 形态是「一直围绕中心旋转」的飞剑群（持续环绕，而非一波波甩出去）；
 *  - 每把剑是细长流光剑：尖锐光刃 + 身后沿轨道拖一条更长的渐隐流光尾迹；
 *  - 双层剑环（外层 / 内层方向相反、速度不同）制造层次与风暴混沌感；
 *  - 中心一团冷青涡心微光 + 几缕内卷螺旋，凝聚出「风暴」但不画成绿色实心环。
 *
 * 生命周期：持续型。中心点由外部每帧 setCenter() 跟随首个子弹；
 *   入场约 12 帧「召剑」（半径从外向内收束 + 强度渐显）；
 *   外部调用 fadeOut() 后剑群外扩飞散并淡出（约 16 帧），life<=0 时被主循环回收。
 */
class BladeStormVortex {
    constructor(x, y, radius = 120) {
        this.x = x;
        this.y = y;
        this.targetRadius = Math.max(40, radius);
        this.radius = this.targetRadius * 1.55;   // 入场：从外向内收束
        this.phase = Math.random() * 100;          // 旋转相位累加（帧）
        this.age = 0;
        this.life = 1.0;        // 主循环按 life>0 保活 / 回收
        this.active = true;
        this.fading = false;
        this.intensity = 0;     // 0→1 入场强度
        this.fadeT = 1.0;       // 1→0 淡出系数

        // 三层剑环：外层剑多、内层剑少，方向交替、速度更快
        const outerCount = Math.min(16, Math.max(8, Math.round(this.targetRadius / 12)));
        const midCount   = Math.max(6, Math.round(outerCount * 0.7));
        const innerCount = Math.max(4, Math.round(outerCount * 0.45));
        this.rings = [
            { count: outerCount, rFactor: 1.0,  speed:  0.15, len: 1.05, width: 1.0  },
            { count: midCount,   rFactor: 0.74, speed: -0.22, len: 0.9,  width: 0.9  },
            { count: innerCount, rFactor: 0.46, speed:  0.29, len: 0.72, width: 0.78 },
        ];
        // 每把剑加随机扰动：角度/半径/长度/转速/闪烁相位，打破完全均匀
        for (const ring of this.rings) {
            ring.jit = [];
            const step = (Math.PI * 2) / ring.count;
            for (let k = 0; k < ring.count; k++) {
                ring.jit.push({
                    a: (Math.random() - 0.5) * step * 0.6,   // 角度抖动
                    r: (Math.random() - 0.5) * 0.18,          // 半径抖动
                    l: 0.8 + Math.random() * 0.5,             // 长度缩放
                    s: 0.85 + Math.random() * 0.3,            // 转速微差
                    f: Math.random() * Math.PI * 2,           // 闪烁相位
                });
            }
        }
        this._pixi = null; // [PixiJS 迁移]
    }

    setCenter(x, y) { this.x = x; this.y = y; }
    fadeOut() { this.fading = true; }

    update(timeScale = 1) {
        const ts = timeScale || 1;
        this.age += ts;
        this.phase += ts;
        this.intensity = Math.min(1, this.intensity + 0.1 * ts);
        this.radius += (this.targetRadius - this.radius) * 0.16 * ts;
        if (this.fading) {
            this.fadeT -= 0.06 * ts;
            this.radius += 3.2 * ts;   // 淡出时向外飞散
            if (this.fadeT <= 0) {
                this.fadeT = 0;
                this.life = 0;
                this.active = false;
            }
        }
    }

    // 画一把流光剑：ang=当前轨道角，r=轨道半径，dirSign=旋转方向(+1/-1)
    _drawBlade(ctx, ang, r, dirSign, lenScale, widScale, alpha) {
        const cx = this.x, cy = this.y;
        const bx = cx + Math.cos(ang) * r;
        const by = cy + Math.sin(ang) * r;
        const tang = ang + dirSign * Math.PI / 2;   // 切向 = 运动方向

        // 1) 流光尾迹：沿轨道在身后拖一条更长的渐隐光带
        const trailSpan = 0.6 * lenScale;
        const segs = 8;
        ctx.lineCap = 'round';
        for (let s = 0; s < segs; s++) {
            const t0 = s / segs, t1 = (s + 1) / segs;
            const a0 = ang - dirSign * trailSpan * t0;
            const a1 = ang - dirSign * trailSpan * t1;
            const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
            const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
            const fade = 1 - t1;
            ctx.globalAlpha = alpha * fade * 0.7;
            ctx.strokeStyle = s < 2 ? '#eaf6ff' : '#7dd3fc';
            ctx.lineWidth = 3.4 * widScale * fade;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }

        // 2) 剑身：细长光刃（尖锐菱形），指向切向
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(tang);
        const L = 21 * lenScale;
        const W = 3.2 * widScale;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = _sb(10);
        ctx.shadowColor = '#38bdf8';
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.moveTo(L, 0);
        ctx.lineTo(0, -W);
        ctx.lineTo(-L * 0.36, 0);
        ctx.lineTo(0, W);
        ctx.closePath();
        ctx.fill();
        // 白热核心
        ctx.shadowBlur = _sb(4);
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#eaf6ff';
        ctx.beginPath();
        ctx.moveTo(L * 0.9, 0);
        ctx.lineTo(0, -W * 0.42);
        ctx.lineTo(-L * 0.28, 0);
        ctx.lineTo(0, W * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] BladeStormVortex
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = bladeStormVortex_pixiCreate(this);
            if (this._pixi) { bladeStormVortex_pixiSync(this, this._pixi); return; }
        }
        const alphaBase = this.intensity * this.fadeT;
        if (alphaBase <= 0.01) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 中心涡心微光（冷青，低调，不画成绿色实心环）
        const coreR = this.radius * 0.95;
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, coreR);
        g.addColorStop(0,   withAlpha('#bfe9ff', 0.22 * alphaBase));
        g.addColorStop(0.5, withAlpha('#38bdf8', 0.10 * alphaBase));
        g.addColorStop(1,   'rgba(56,189,248,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, coreR, 0, Math.PI * 2);
        ctx.fill();

        // 几缕内卷螺旋（凝聚“风暴”感）：反向拖尾 + 高分辨率成曲线
        ctx.lineCap = 'round';
        const wisps = 4;
        for (let i = 0; i < wisps; i++) {
            const base = this.phase * 0.11 + (i / wisps) * Math.PI * 2;
            ctx.globalAlpha = 0.14 * alphaBase;
            ctx.strokeStyle = '#7dd3fc';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            let firstPt = true;
            for (let t = 0; t <= 1.0001; t += 0.035) {
                const a = base - t * Math.PI * 2 * 1.15;   // 外端落后于旋转 → 拖尾螺旋
                const rr = this.radius * (0.18 + 0.74 * t);
                const px = this.x + Math.cos(a) * rr;
                const py = this.y + Math.sin(a) * rr;
                if (firstPt) { ctx.moveTo(px, py); firstPt = false; } else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // 多层剑环：持续围绕中心旋转的飞剑群（带随机扰动，不再完全均匀）
        for (const ring of this.rings) {
            const r0 = this.radius * ring.rFactor;
            const dirSign = ring.speed >= 0 ? 1 : -1;
            for (let k = 0; k < ring.count; k++) {
                const j = ring.jit[k];
                const ang = ring.speed * this.phase * j.s + (k / ring.count) * Math.PI * 2 + j.a;
                const r = r0 * (1 + j.r);
                const flick = 0.7 + 0.3 * Math.sin(this.age * 0.35 + j.f);
                this._drawBlade(ctx, ang, r, dirSign, ring.len * j.l, ring.width, alphaBase * flick);
            }
        }

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
}

/**
 * SwordScar - 剑痕残留特效
 * 在敌人位置绘制一道短暂的斜线剑痕，模拟被斩击后的刀痕
 */
class SwordScar {
    constructor(x, y, color = '#34d399') {
        this.x = x;
        this.y = y;
        this.color = color;
        // 随机斜向角度（偏向斜线感）
        this.angle = (Math.random() - 0.5) * Math.PI * 0.5 + Math.PI * 0.25;
        this.length = 20 + Math.random() * 20;
        this.life = 1.0;
        this.active = true;
        // 随机偏移，避免所有剑痕重叠
        this.offsetX = (Math.random() - 0.5) * 20;
        this.offsetY = (Math.random() - 0.5) * 20;
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        if (!this.active) return;
        this.life -= 0.04 * timeScale; // 慢慢消逝，约 25 帧
        if (this.life <= 0) {
            this.life = 0;
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active || this.life <= 0) return;

        // [PixiJS 迁移 · 阶段三] SwordScar
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = swordScar_pixiCreate(this);
            if (this._pixi) { swordScar_pixiSync(this, this._pixi); return; }
        }

        ctx.save();
        ctx.translate(this.x + this.offsetX, this.y + this.offsetY);
        ctx.rotate(this.angle);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.life * 0.8;

        const halfL = this.length / 2;
        // 主剑痕线
        const c = this.color || '#34d399';
        const grad = ctx.createLinearGradient(-halfL, 0, halfL, 0);
        grad.addColorStop(0, withAlpha(c, 0));
        grad.addColorStop(0.3, withAlpha(c, 0.9));
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.7, withAlpha(c, 0.9));
        grad.addColorStop(1, withAlpha(c, 0));

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5 * this.life;
        ctx.lineCap = 'round';
        ctx.shadowBlur = _sb(8);
        ctx.shadowColor = c;
        ctx.beginPath();
        ctx.moveTo(-halfL, 0);
        ctx.lineTo(halfL, 0);
        ctx.stroke();

        // 副剑痕（平行细线，增加层次感）
        ctx.lineWidth = 1 * this.life;
        ctx.globalAlpha = this.life * 0.4;
        ctx.beginPath();
        ctx.moveTo(-halfL * 0.6, -4);
        ctx.lineTo(halfL * 0.6, -4);
        ctx.stroke();

        ctx.restore();
    }
}

// ==================== 奖励掉落特效 ====================
/**
 * RewardDropEffect - 敌人死亡掉落遗物/精华时的爆发特效
 *
 * 设计理念：三种类型各有独特视觉语言，均以“死亡位置向上爆发”为核心动作：
 *   relic       → 金色光柱冲天 + 旋转金币粒子向外爆散 + 双层扩散冲击波
 *   chaos       → 紫红双色漩涡爆炸 + 不规则碎片四散 + 快速收缩再扩张冲击波
 *   pure        → 白蓝冰晶向上绳放 + 六角雪花粒子缓慢飘散 + 柔和扩散光环
 *
 * 生命周期： relic ~1.8s | chaos ~1.2s | pure ~1.5s
 */
class RewardDropEffect {
    /**
     * @param {number} x - 敌人中心 X 坐标
     * @param {number} y - 敌人中心 Y 坐标
     * @param {'relic'|'chaos_essence'|'pure_essence'} rewardType - 奖励类型
     */
    constructor(x, y, rewardType) {
        this.x = x;
        this.y = y;
        this.type = rewardType;
        this.life = 1.0;
        this.timer = 0;

        if (rewardType === 'relic') {
            // 遗物：金色光柱冲天，持续时间最长
            this.decay = 0.018;   // ~1.8s @ 60fps
            // 光柱参数
            this.beamH = 0;       // 当前光柱高度
            this.beamMaxH = 180;  // 最大高度
            this.beamW = 28;      // 光柱宽度
            this.beamAlpha = 0;
            // 冲击波：双层
            this.rings = [
                { r: 0, maxR: 90,  color: '#facc15', lw: 3.5, alpha: 0.9, speed: 3.5 },
                { r: 0, maxR: 130, color: '#f59e0b', lw: 2,   alpha: 0.6, speed: 2.5 },
            ];
            // 金币粒子（向外爆散，带旋转）
            this.coins = Array.from({ length: 10 }, (_, i) => ({
                angle: (i / 10) * Math.PI * 2 + Math.random() * 0.4,
                speed: 2.5 + Math.random() * 2.5,
                dist: 0,
                size: 3.5 + Math.random() * 2,
                spin: (Math.random() - 0.5) * 0.3,
                spinAngle: Math.random() * Math.PI * 2,
                alpha: 0.8 + Math.random() * 0.2,
                color: Math.random() < 0.5 ? '#facc15' : '#fde68a',
            }));

        } else if (rewardType === 'chaos_essence') {
            // 混沌精华：紫红双色漩涡爆炸，最短暂但最强烈
            this.decay = 0.028;   // ~1.2s @ 60fps
            // 冲击波：先快速扩张再收缩
            this.rings = [
                { r: 0, maxR: 80,  color: '#a855f7', lw: 4,   alpha: 1.0, speed: 5.5, phase: 'expand' },
                { r: 0, maxR: 110, color: '#ef4444', lw: 2.5, alpha: 0.7, speed: 4.0, phase: 'expand' },
            ];
            this.ringPulse = 0;   // 收缩再扩张的脑动相位
            // 混沌碎片（不规则向外爆散）
            this.shards = Array.from({ length: 14 }, (_, i) => ({
                angle: (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.6,
                speed: 3.0 + Math.random() * 3.5,
                dist: 0,
                size: 2.5 + Math.random() * 3,
                spin: (Math.random() - 0.5) * 0.5,
                spinAngle: Math.random() * Math.PI * 2,
                alpha: 0.7 + Math.random() * 0.3,
                color: Math.random() < 0.5 ? '#c084fc' : '#f87171',
            }));
            // 漩涡层：中心旋转漩涡
            this.vortexAngle = 0;
            this.vortexR = 0;
            this.vortexMaxR = 45;

        } else {
            // 纯净精华：白蓝冰晶绳放，最柔和
            this.decay = 0.022;   // ~1.5s @ 60fps
            // 光环：柔和扩散
            this.rings = [
                { r: 0, maxR: 75,  color: '#bfdbfe', lw: 2.5, alpha: 0.8, speed: 2.0 },
                { r: 0, maxR: 110, color: '#ffffff', lw: 1.5, alpha: 0.5, speed: 1.4 },
            ];
            // 冰晶光柱（细而高）
            this.beamH = 0;
            this.beamMaxH = 140;
            this.beamW = 16;
            this.beamAlpha = 0;
            // 六角雪花粒子（缓慢飘散）
            this.snowflakes = Array.from({ length: 8 }, (_, i) => ({
                angle: (i / 8) * Math.PI * 2 + Math.random() * 0.3,
                speed: 1.2 + Math.random() * 1.5,
                dist: 0,
                size: 4 + Math.random() * 3,
                spinAngle: Math.random() * Math.PI * 2,
                spinSpeed: (Math.random() - 0.5) * 0.08,
                alpha: 0.7 + Math.random() * 0.3,
            }));
        }
        this._pixi = null; // [PixiJS 迁移]
    }

    update(timeScale) {
        this.timer += timeScale;
        this.life -= this.decay * timeScale;

        if (this.type === 'relic') {
            // 光柱快速冲高
            if (this.beamH < this.beamMaxH) {
                this.beamH = Math.min(this.beamMaxH, this.beamH + 18 * timeScale);
                this.beamAlpha = Math.min(1, this.beamAlpha + 0.12 * timeScale);
            } else {
                // 光柱冲到顶后慢慢消退
                this.beamAlpha = Math.max(0, this.beamAlpha - 0.025 * timeScale);
            }
            // 冲击波扩散
            for (const ring of this.rings) {
                if (ring.r < ring.maxR) ring.r = Math.min(ring.maxR, ring.r + ring.speed * timeScale);
            }
            // 金币粒子向外飞散
            for (const c of this.coins) {
                c.dist += c.speed * timeScale;
                c.spinAngle += c.spin * timeScale;
            }

        } else if (this.type === 'chaos_essence') {
            // 混沌冲击波：展开到最大后脑动收缩再扩张
            this.ringPulse += 0.18 * timeScale;
            for (const ring of this.rings) {
                if (ring.phase === 'expand') {
                    ring.r = Math.min(ring.maxR, ring.r + ring.speed * timeScale);
                    if (ring.r >= ring.maxR) ring.phase = 'pulse';
                } else {
                    // 到达最大带脑动效果
                    ring.r = ring.maxR + Math.sin(this.ringPulse * 3) * 8;
                }
            }
            // 混沌碎片向外爆散
            for (const s of this.shards) {
                s.dist += s.speed * timeScale;
                s.spinAngle += s.spin * timeScale;
            }
            // 漩涡生长
            this.vortexAngle += 0.12 * timeScale;
            if (this.vortexR < this.vortexMaxR) this.vortexR = Math.min(this.vortexMaxR, this.vortexR + 3 * timeScale);

        } else {
            // 纯净冰晶光柱与光环
            if (this.beamH < this.beamMaxH) {
                this.beamH = Math.min(this.beamMaxH, this.beamH + 12 * timeScale);
                this.beamAlpha = Math.min(0.85, this.beamAlpha + 0.08 * timeScale);
            } else {
                this.beamAlpha = Math.max(0, this.beamAlpha - 0.018 * timeScale);
            }
            for (const ring of this.rings) {
                if (ring.r < ring.maxR) ring.r = Math.min(ring.maxR, ring.r + ring.speed * timeScale);
            }
            // 雪花粒子缓慢飘散
            for (const sf of this.snowflakes) {
                sf.dist += sf.speed * timeScale;
                sf.spinAngle += sf.spinSpeed * timeScale;
            }
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // [PixiJS 迁移 · 阶段三] RewardDropEffect
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = rewardDropEffect_pixiCreate(this);
            if (this._pixi) { rewardDropEffect_pixiSync(this, this._pixi); return; }
        }
        const alpha = Math.max(0, this.life);
        ctx.save();

        if (this.type === 'relic') {
            // @section:draw_relic_beam - 遗物奖励：金色光柱 + 金币粒子 + 双层冲击波
            // ---- 遗物：金色光柱 + 金币粒子 + 双层冲击波 ----

            // 1. 冲击波（先画，在光柱下方）
            ctx.globalCompositeOperation = 'lighter';
            for (const ring of this.rings) {
                if (ring.r <= 0) continue;
                const t = ring.r / ring.maxR;
                ctx.globalAlpha = ring.alpha * (1 - t) * alpha;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ring.r, 0, Math.PI * 2);
                ctx.strokeStyle = ring.color;
                ctx.lineWidth = ring.lw * (1 - t * 0.5);
                ctx.stroke();
            }

            // 2. 金色光柱（梯形，底部亮白向上渐变透明）
            if (this.beamH > 0 && this.beamAlpha > 0) {
                ctx.globalCompositeOperation = 'lighter';
                const bx = this.x;
                const by = this.y;
                const bh = this.beamH;
                const bw = this.beamW;
                const ba = this.beamAlpha * alpha;
                const beamGrad = ctx.createLinearGradient(bx, by, bx, by - bh);
                beamGrad.addColorStop(0, `rgba(255, 255, 200, ${ba})`);
                beamGrad.addColorStop(0.3, `rgba(250, 204, 21, ${ba * 0.7})`);
                beamGrad.addColorStop(0.7, `rgba(245, 158, 11, ${ba * 0.3})`);
                beamGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
                ctx.fillStyle = beamGrad;
                ctx.beginPath();
                ctx.moveTo(bx - bw * 0.25, by);
                ctx.lineTo(bx + bw * 0.25, by);
                ctx.lineTo(bx + bw, by - bh);
                ctx.lineTo(bx - bw, by - bh);
                ctx.closePath();
                ctx.fill();
                // 光柱中心亮线
                ctx.strokeStyle = `rgba(255, 255, 255, ${ba * 0.8})`;
                ctx.lineWidth = 2;
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = _sb(12);
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx, by - bh);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 3. 金币粒子（旋转菱形）
            ctx.globalCompositeOperation = 'lighter';
            for (const c of this.coins) {
                const cx = this.x + Math.cos(c.angle) * c.dist;
                const cy = this.y + Math.sin(c.angle) * c.dist - c.dist * 0.3; // 微向上偶发
                const ca = c.alpha * alpha * Math.max(0, 1 - c.dist / 80);
                if (ca <= 0) continue;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(c.spinAngle);
                ctx.globalAlpha = ca;
                ctx.fillStyle = c.color;
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = _sb(6);
                // 菱形金币
                ctx.beginPath();
                ctx.moveTo(0, -c.size);
                ctx.lineTo(c.size * 0.6, 0);
                ctx.lineTo(0, c.size);
                ctx.lineTo(-c.size * 0.6, 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // 4. 中心爆发光晕（开始时的亮点）
            if (this.timer < 8) {
                ctx.globalCompositeOperation = 'lighter';
                const flashAlpha = (1 - this.timer / 8) * alpha;
                const flashGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 40);
                flashGrad.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha})`);
                flashGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                ctx.fillStyle = flashGrad;
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
                ctx.fill();
            }

        } else if (this.type === 'chaos_essence') {
            // @section:draw_chaos_essence - 混沌精华奖励：漩涡爆炸 + 碎片四散 + 冲击波
            // ---- 混沌精华：漩涡爆炸 + 碎片四散 + 脑动冲击波 ----

            // 1. 漩涡层（中心旋转的紫红渗变圆）
            if (this.vortexR > 0) {
                ctx.globalCompositeOperation = 'lighter';
                const vAlpha = alpha * 0.6;
                const vGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.vortexR);
                vGrad.addColorStop(0, `rgba(255, 200, 255, ${vAlpha * 0.8})`);
                vGrad.addColorStop(0.4, `rgba(168, 85, 247, ${vAlpha * 0.5})`);
                vGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                ctx.fillStyle = vGrad;
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.vortexR, 0, Math.PI * 2);
                ctx.fill();
                // 漩涡旋转光边
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.vortexAngle);
                for (let vi = 0; vi < 4; vi++) {
                    const vAngle = (vi / 4) * Math.PI * 2;
                    const vx = Math.cos(vAngle) * this.vortexR * 0.7;
                    const vy = Math.sin(vAngle) * this.vortexR * 0.7;
                    ctx.globalAlpha = vAlpha * 0.7;
                    ctx.fillStyle = vi % 2 === 0 ? '#a855f7' : '#ef4444';
                    ctx.shadowColor = vi % 2 === 0 ? '#a855f7' : '#ef4444';
                    ctx.shadowBlur = _sb(8);
                    ctx.beginPath();
                    ctx.arc(vx, vy, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            // 2. 脑动冲击波
            ctx.globalCompositeOperation = 'lighter';
            for (const ring of this.rings) {
                if (ring.r <= 0) continue;
                const t = ring.r / ring.maxR;
                const pulseAlpha = ring.phase === 'pulse'
                    ? ring.alpha * (0.4 + Math.abs(Math.sin(this.ringPulse * 3)) * 0.6) * alpha
                    : ring.alpha * (1 - t * 0.6) * alpha;
                ctx.globalAlpha = pulseAlpha;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ring.r, 0, Math.PI * 2);
                ctx.strokeStyle = ring.color;
                ctx.lineWidth = ring.lw;
                ctx.shadowColor = ring.color;
                ctx.shadowBlur = _sb(10);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 3. 混沌碎片（不规则向外爆散）
            ctx.globalCompositeOperation = 'lighter';
            for (const s of this.shards) {
                const sx = this.x + Math.cos(s.angle) * s.dist;
                const sy = this.y + Math.sin(s.angle) * s.dist;
                const sa = s.alpha * alpha * Math.max(0, 1 - s.dist / 90);
                if (sa <= 0) continue;
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(s.spinAngle);
                ctx.globalAlpha = sa;
                ctx.fillStyle = s.color;
                ctx.shadowColor = s.color;
                ctx.shadowBlur = _sb(5);
                // 不规则尖锐碎片
                ctx.beginPath();
                ctx.moveTo(0, -s.size);
                ctx.lineTo(s.size * 0.45, s.size * 0.3);
                ctx.lineTo(0, s.size * 0.7);
                ctx.lineTo(-s.size * 0.45, s.size * 0.3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // 4. 开始时紫红双色爆闪
            if (this.timer < 6) {
                ctx.globalCompositeOperation = 'lighter';
                const flashT = 1 - this.timer / 6;
                const flashGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 50);
                flashGrad.addColorStop(0, `rgba(255, 200, 255, ${flashT * alpha})`);
                flashGrad.addColorStop(0.5, `rgba(168, 85, 247, ${flashT * alpha * 0.5})`);
                flashGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                ctx.fillStyle = flashGrad;
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 50, 0, Math.PI * 2);
                ctx.fill();
            }

        } else {
            // @section:draw_pure_essence - 纯净精华奖励：冰晶光柱 + 六角雪花粒子 + 柔和光环
            // ---- 纯净精华：冰晶光柱 + 雪花粒子 + 柔和光环 ----

            // 1. 柔和光环
            ctx.globalCompositeOperation = 'lighter';
            for (const ring of this.rings) {
                if (ring.r <= 0) continue;
                const t = ring.r / ring.maxR;
                ctx.globalAlpha = ring.alpha * (1 - t) * alpha;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ring.r, 0, Math.PI * 2);
                ctx.strokeStyle = ring.color;
                ctx.lineWidth = ring.lw;
                ctx.shadowColor = ring.color;
                ctx.shadowBlur = _sb(8);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 2. 冰晶光柱（细而高，白蓝渐变）
            if (this.beamH > 0 && this.beamAlpha > 0) {
                ctx.globalCompositeOperation = 'lighter';
                const bx = this.x;
                const by = this.y;
                const bh = this.beamH;
                const bw = this.beamW;
                const ba = this.beamAlpha * alpha;
                const beamGrad = ctx.createLinearGradient(bx, by, bx, by - bh);
                beamGrad.addColorStop(0, `rgba(255, 255, 255, ${ba})`);
                beamGrad.addColorStop(0.35, `rgba(191, 219, 254, ${ba * 0.65})`);
                beamGrad.addColorStop(0.7, `rgba(147, 197, 253, ${ba * 0.3})`);
                beamGrad.addColorStop(1, 'rgba(96, 165, 250, 0)');
                ctx.fillStyle = beamGrad;
                ctx.beginPath();
                ctx.moveTo(bx - bw * 0.2, by);
                ctx.lineTo(bx + bw * 0.2, by);
                ctx.lineTo(bx + bw, by - bh);
                ctx.lineTo(bx - bw, by - bh);
                ctx.closePath();
                ctx.fill();
                // 光柱中心纯白亮线
                ctx.strokeStyle = `rgba(255, 255, 255, ${ba * 0.9})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#bfdbfe';
                ctx.shadowBlur = _sb(10);
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx, by - bh);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 3. 六角雪花粒子（缓慢飘散）
            ctx.globalCompositeOperation = 'lighter';
            for (const sf of this.snowflakes) {
                const sfx = this.x + Math.cos(sf.angle) * sf.dist;
                const sfy = this.y + Math.sin(sf.angle) * sf.dist - sf.dist * 0.5; // 强向上浮动
                const sfa = sf.alpha * alpha * Math.max(0, 1 - sf.dist / 70);
                if (sfa <= 0) continue;
                ctx.save();
                ctx.translate(sfx, sfy);
                ctx.rotate(sf.spinAngle);
                ctx.globalAlpha = sfa;
                ctx.fillStyle = '#dbeafe';
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 0.8;
                ctx.shadowColor = '#bfdbfe';
                ctx.shadowBlur = _sb(6);
                // 六角雪花形（与敌人光晕中的雪花一致）
                ctx.beginPath();
                for (let si = 0; si < 6; si++) {
                    const sAngle = (si / 6) * Math.PI * 2 - Math.PI / 6;
                    const ox = Math.cos(sAngle) * sf.size;
                    const oy = Math.sin(sAngle) * sf.size;
                    const iAngle = sAngle + Math.PI / 6;
                    const ix = Math.cos(iAngle) * sf.size * 0.4;
                    const iy = Math.sin(iAngle) * sf.size * 0.4;
                    if (si === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
                    ctx.lineTo(ix, iy);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }

            // 4. 开始时白蓝闪光
            if (this.timer < 10) {
                ctx.globalCompositeOperation = 'lighter';
                const flashT = 1 - this.timer / 10;
                const flashGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 35);
                flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashT * alpha * 0.9})`);
                flashGrad.addColorStop(1, 'rgba(191, 219, 254, 0)');
                ctx.fillStyle = flashGrad;
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 35, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

// ==================== 开炮视觉增强 (Shooting VFX Enhancement) ====================

/**
 * [开炮 VFX 增强 · 阶段 A] MuzzleFlashV2 — 多层枪口火光
 *
 * 替代 Canvas 2D 的三层渐变 + 美术帧，升级为：
 *   - 核心光球（白热 → 元素色 → 暗红，膨胀 → 衰减）
 *   - 方向光锥（沿炮管方向喷射的锥形光焰）
 *   - 火星飞溅（带物理模拟的碎片粒子）
 *   - 冷却热辉（flash 阶段结束后的缓慢余烬）
 *
 * 开幕齐射（intensity > 1.3）效果更强烈、持续更久。
 * 当 pixiIsActive() 为 false 时，draw(ctx) 直接返回（由 render_system.js Canvas 2D 路径接管）。
 */
class MuzzleFlashV2 {
    constructor(x, y, angle, elementColor, intensity = 1.0) {
        this.x = x;
        this.y = y;
        this.angle = angle;          // 炮管朝向角度（弧度，-Y 方向 = -π/2）
        this.elementColor = elementColor || '#fef3c7';
        this.intensity = Math.max(0.5, intensity);
        this.charged = intensity > 1.3;

        // 生命周期（秒）— 克制化，缩短余烬拖尾
        this.maxLife = this.charged ? 0.65 : 0.5;
        this.life = this.maxLife;
        this.flashPhase = this.charged ? 0.16 : 0.12;  // 高光持续时间（秒）

        // 火星粒子数据（物理模拟）— 克制：减少火星数量与初速
        const sparkCount = Math.round(5 * this.intensity);
        this.sparks = [];
        for (let i = 0; i < sparkCount; i++) {
            const spread = (Math.random() - 0.5) * 0.9;  // ±25°
            const speed = 70 + Math.random() * 130;
            this.sparks.push({
                x: 0, y: 0,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                life: 0.3 + Math.random() * 0.3,
                size: 2 + Math.random() * 3,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 8,
            });
        }

        this._pixi = null;
        this._pixiCreate();
    }

    _pixiCreate() {
        if (pixiIsActive()) {
            this._pixi = muzzleFlashV2_pixiCreate(this);
        }
    }

    update(dtSec) {
        this.life -= dtSec;
        // 更新火星物理
        for (const s of this.sparks) {
            s.x += s.vx * dtSec;
            s.y += s.vy * dtSec;
            s.vy += 400 * dtSec;  // 重力
            s.vx *= 0.97;
            s.vy *= 0.97;
            s.life -= dtSec;
            s.rot += s.rotSpeed * dtSec;
        }
        // PixiJS 同步
        if (this._pixi) {
            muzzleFlashV2_pixiSync(this, this._pixi);
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;
        // PixiJS 激活时跳过 Canvas 2D（由 render_system.js Canvas 2D 路径独立绘制旧版火光）
        if (pixiIsActive() && this._pixi) return;

        // Canvas 2D fallback（仅在 PixiJS 不可用时启用）
        const progress = 1 - this.life / this.maxLife;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);
        ctx.globalCompositeOperation = 'screen';

        // 核心光球
        const coreR = (20 + 20 * this.intensity) * (0.5 + 0.5 * Math.sin(progress * Math.PI));
        if (coreR > 1) {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
            grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
            grad.addColorStop(0.5, `rgba(255,255,200,${alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
        }

        // 方向光锥（仅 flashPhase 内）
        if (progress < this.flashPhase / this.maxLife) {
            const coneLen = 60 * this.intensity * (1 - progress * 2);
            const coneW = 16 * this.intensity;
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = '#fff7e0';
            ctx.beginPath();
            ctx.moveTo(0, -coneLen);
            ctx.quadraticCurveTo(coneW, -coneLen * 0.3, 0, 10);
            ctx.quadraticCurveTo(-coneW, -coneLen * 0.3, 0, -coneLen);
            ctx.fill();
        }

        // 火星
        for (const s of this.sparks) {
            if (s.life <= 0) continue;
            ctx.globalAlpha = Math.max(0, s.life * 2) * alpha;
            ctx.fillStyle = this.elementColor;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    get dead() { return this.life <= 0; }
}

/**
 * [开炮 VFX 增强 · 阶段 C] FiringBurst — 开炮冲击波与爆发感
 *
 * 新增开炮瞬间的：
 *   - 径向扩散环（从 muzzle 点向外扩散）
 *   - 方向性冲击锥（沿炮管方向的扇形气流）
 *   - 碎片飞溅（带重力下落的粒子）
 *
 * 生命周期很短（0.4s），视觉上提供"后坐力冲击"的即时反馈。
 */
class FiringBurst {
    constructor(x, y, angle, elementColor, intensity = 1.0) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.elementColor = elementColor || '#fef3c7';
        this.intensity = Math.max(0.5, intensity);

        this.maxLife = 0.3;
        this.life = this.maxLife;

        // 扩散环参数 — 克制：收小最大半径
        this.ringRadius = 10;
        this.ringMaxRadius = 52 * this.intensity;
        this.ringWidth = 4;

        // 碎片粒子 — 克制：减少碎片数量与初速
        const debrisCount = Math.round(4 * this.intensity);
        this.debris = [];
        for (let i = 0; i < debrisCount; i++) {
            const spread = (Math.random() - 0.5) * 1.4;  // ±40°
            const speed = 140 + Math.random() * 180;
            this.debris.push({
                x: 0, y: 0,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                life: 0.25 + Math.random() * 0.15,
                size: 1.5 + Math.random() * 2.5,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 12,
            });
        }

        this._pixi = null;
        this._pixiCreate();
    }

    _pixiCreate() {
        if (pixiIsActive()) {
            this._pixi = firingBurst_pixiCreate(this);
        }
    }

    update(dtSec) {
        this.life -= dtSec;
        const progress = 1 - this.life / this.maxLife;

        // 扩散环
        this.ringRadius = 10 + (this.ringMaxRadius - 10) * progress;
        this.ringWidth = 4 * (1 - progress * 0.8);

        // 碎片物理
        for (const d of this.debris) {
            d.x += d.vx * dtSec;
            d.y += d.vy * dtSec;
            d.vy += 400 * dtSec;
            d.vx *= 0.95;
            d.vy *= 0.95;
            d.life -= dtSec;
            d.rot += d.rotSpeed * dtSec;
        }

        if (this._pixi) {
            firingBurst_pixiSync(this, this._pixi);
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;
        if (pixiIsActive() && this._pixi) return;

        const progress = 1 - this.life / this.maxLife;
        const alpha = Math.max(0, 1 - progress);

        ctx.save();
        ctx.translate(this.x, this.y);

        // 径向扩散环
        if (this.ringWidth > 0.5) {
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = alpha * 0.7;
            ctx.strokeStyle = this.elementColor;
            ctx.lineWidth = this.ringWidth;
            ctx.beginPath();
            ctx.arc(0, 0, this.ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 方向冲击锥（前 30% 生命周期）
        if (progress < 0.3) {
            const coneAlpha = alpha * (1 - progress / 0.3);
            ctx.save();
            ctx.rotate(this.angle);
            ctx.globalAlpha = coneAlpha * 0.5;
            ctx.fillStyle = this.elementColor;
            const dist = 60 * this.intensity * (progress / 0.3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(-0.26) * dist, Math.sin(-0.26) * dist);
            ctx.lineTo(Math.cos(0.26) * dist, Math.sin(0.26) * dist);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 碎片
        ctx.globalCompositeOperation = 'source-over';
        for (const d of this.debris) {
            if (d.life <= 0) continue;
            ctx.globalAlpha = Math.max(0, d.life * 3) * alpha;
            ctx.fillStyle = this.elementColor;
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rot);
            ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
            ctx.restore();
        }

        ctx.restore();
    }

    get dead() { return this.life <= 0; }
}

// ==================== AffixSkillVFX - 词条技能释放特效 ====================
/**
 * 敌人词条 Skill 阶段行动特效
 * 三幕式生命周期：telegraph(预兆) → burst(爆发) → decay(余韵)
 * 使用现有粒子纹理 + PIXI.Graphics 程序化绘制
 * @perf-impact: 新增词条技能特效，复用现有粒子预算，无新增 CONFIG 字段
 */
class AffixSkillVFX {
    static SKILL_TYPES = {
        berserk: { duration: 42, telegraph: 10, burst: 10, colors: ['#ef4444', '#f97316', '#fbbf24'] },
        shield:  { duration: 38, telegraph: 10, burst: 8,  colors: ['#93c5fd', '#a78bfa', '#f87171'] },
        // 定向能量帷幕辉光：复刻护盾「抵挡伤害」的 traceEnergyCurtain，用新引擎(PixiJS)
        // 加色叠加增强辉光。纯 Graphics 绘制（不挂粒子），几何/朝向/配色由 opts 传入。
        shieldCurtain: { duration: 22, telegraph: 3, burst: 7, colors: ['#bfdbfe', '#93c5fd', '#60a5fa'] },
        regen:   { duration: 46, telegraph: 12, burst: 10, colors: ['#4ade80', '#86efac'] },
        haste:   { duration: 30, telegraph: 6,  burst: 8,  colors: ['#facc15', '#fde047'] },
        jump:    { duration: 44, telegraph: 14, burst: 10, colors: ['#2dd4bf', '#38bdf8'] },
        clone:   { duration: 48, telegraph: 12, burst: 10, colors: ['#c084fc', '#d8b4fe'] },
        devour:  { duration: 46, telegraph: 12, burst: 12, colors: ['#dc2626', '#991b1b'] },
    };

    constructor(x, y, skillType, opts = {}) {
        this.x = x;
        this.y = y;
        this.skillType = skillType;
        this.cfg = AffixSkillVFX.SKILL_TYPES[skillType] || AffixSkillVFX.SKILL_TYPES.berserk;
        this.perfTier = opts.perfTier || 'high';

        this.frame = 0;
        this.life = 1.0;
        this.phase = 'telegraph';
        this.phaseFrame = 0;
        this.duration = this.cfg.duration;
        this._pixi = null;

        // Intensity modifier (e.g. berserk temp/100)
        this.intensity = opts.intensity || 1.0;
        // Boss/elite scaling
        this.isBoss = opts.isBoss || false;
        this.isElite = opts.isElite || false;

        // [shieldCurtain] 定向能量帷幕复刻所需：受击侧朝向、敌人尺寸、配色（hex 整数对象）
        this.sideAngle = Number.isFinite(opts.sideAngle) ? opts.sideAngle : null;
        this.fxW = opts.w || 0;
        this.fxH = opts.h || 0;
        this.curtainColors = opts.colors && typeof opts.colors === 'object' && !Array.isArray(opts.colors)
            ? opts.colors : null;

        // Particle multiplier by perf tier
        const pmul = this.perfTier === 'high' ? 1.0 : (this.perfTier === 'medium' ? 0.6 : 0.3);

        // Pre-compute particle configs (spawned lazily in _updatePhase)
        this._particles = [];
        this._gfxData = { rotation: 0, alpha: 0, scale: 0 };
        this._burstSpawned = false;
        this._decaySpawned = false;

        // Per-type setup
        this._setupType(pmul);
    }

    _setupType(pmul) {
        switch (this.skillType) {
        case 'shieldCurtain':
            // 定向能量帷幕辉光：全部由 PixiJS Graphics 程序化绘制，不挂任何粒子。
            // （Pixi 关闭时本特效不绘制额外内容，回退到 enemy 自身的 Canvas 帷幕。）
            break;
        case 'berserk': {
            const count = Math.ceil(12 * pmul * this.intensity);
            for (let i = 0; i < count; i++) {
                this._particles.push({
                    mode: 'ember', ox: (Math.random() - 0.5) * 20, oy: 0,
                    vx: (Math.random() - 0.5) * 2, vy: -(2 + Math.random() * 3),
                    scale: 0.6 + Math.random() * 0.4, life: 1.0,
                    color: this.cfg.colors[Math.floor(Math.random() * 3)],
                    spawnPhase: 'burst', gravity: -0.05,
                });
            }
            // Spark embers at top
            const sparkCount = Math.ceil(6 * pmul * this.intensity);
            for (let i = 0; i < sparkCount; i++) {
                this._particles.push({
                    mode: 'spark', ox: (Math.random() - 0.5) * 30, oy: -20,
                    vx: (Math.random() - 0.5) * 4, vy: -(3 + Math.random() * 2),
                    scale: 0.4 + Math.random() * 0.3, life: 1.0,
                    color: '#fbbf24', spawnPhase: 'burst', gravity: 0.02,
                });
            }
            this._gfxData.flameSegments = Math.ceil(8 * this.intensity);
            break;
        }
        case 'shield': {
            const count = Math.ceil(8 * pmul);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this._particles.push({
                    mode: 'shard', ox: 0, oy: 0,
                    vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5,
                    scale: 0.6, life: 1.0, color: this.cfg.colors[0],
                    spawnPhase: 'burst', gravity: 0,
                });
            }
            // Telegraph particles (slow upward drift)
            for (let i = 0; i < 3; i++) {
                this._particles.push({
                    mode: 'shard', ox: (Math.random() - 0.5) * 16, oy: 10,
                    vx: 0, vy: -0.5,
                    scale: 0.3, life: 1.0, color: this.cfg.colors[0],
                    spawnPhase: 'telegraph', gravity: 0,
                });
            }
            break;
        }
        case 'regen': {
            const count = Math.ceil(10 * pmul);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this._particles.push({
                    mode: 'venom', ox: Math.cos(angle) * 8, oy: 15,
                    vx: Math.cos(angle) * 0.5, vy: -(1.5 + Math.random() * 2),
                    scale: 0.4 + Math.random() * 0.2, life: 1.0,
                    color: '#4ade80', spawnPhase: 'burst', gravity: -0.02,
                    spiral: true, spiralSpeed: 0.1 + Math.random() * 0.05,
                });
            }
            break;
        }
        case 'haste': {
            const count = Math.ceil(5 * pmul);
            for (let i = 0; i < count; i++) {
                this._particles.push({
                    mode: 'wind_slash', ox: -(8 + i * 8), oy: (Math.random() - 0.5) * 10,
                    vx: -1.5, vy: 0,
                    scale: 0.7 - i * 0.1, life: 1.0 - i * 0.12,
                    color: '#facc15', spawnPhase: 'burst', gravity: 0,
                });
            }
            // Spark burst at origin
            const sparkCount = Math.ceil(4 * pmul);
            for (let i = 0; i < sparkCount; i++) {
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
                this._particles.push({
                    mode: 'spark', ox: 0, oy: 0,
                    vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3,
                    scale: 0.5, life: 1.0, color: '#facc15',
                    spawnPhase: 'burst', gravity: 0.03,
                });
            }
            break;
        }
        case 'jump': {
            // Spring compression lines (telegraph)
            for (let i = 0; i < 4; i++) {
                this._particles.push({
                    mode: 'line', ox: (i - 1.5) * 8, oy: 20,
                    vx: 0, vy: 0,
                    scale: 0.5, life: 1.0, color: '#2dd4bf',
                    spawnPhase: 'telegraph', gravity: 0,
                    scaleY_anim: true, // compressed -> extended
                });
            }
            // Ground burst particles (burst phase)
            const count = Math.ceil(8 * pmul);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this._particles.push({
                    mode: 'mist', ox: 0, oy: 0,
                    vx: Math.cos(angle) * 2.5, vy: Math.sin(angle) * 1.5 - 1,
                    scale: 0.4, life: 1.0, color: '#38bdf8',
                    spawnPhase: 'burst', gravity: 0.04,
                });
            }
            break;
        }
        case 'clone': {
            // Division burst particles
            const count = Math.ceil(8 * pmul);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this._particles.push({
                    mode: 'spark', ox: 0, oy: 0,
                    vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3,
                    scale: 0.6, life: 1.0, color: '#d8b4fe',
                    spawnPhase: 'burst', gravity: 0,
                });
            }
            break;
        }
        case 'devour': {
            // Inward-spiraling smoke particles
            const count = Math.ceil(8 * pmul);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const dist = 40 + Math.random() * 20;
                this._particles.push({
                    mode: 'smoke', ox: Math.cos(angle) * dist, oy: Math.sin(angle) * dist,
                    vx: 0, vy: 0, // computed dynamically (inward pull)
                    scale: 0.5, life: 1.0, color: '#991b1b',
                    spawnPhase: 'burst', gravity: 0,
                    inward: true, inwardSpeed: 3 + Math.random(),
                });
            }
            // Red mist at victim
            for (let i = 0; i < Math.ceil(4 * pmul); i++) {
                this._particles.push({
                    mode: 'mist', ox: (Math.random() - 0.5) * 20, oy: (Math.random() - 0.5) * 20,
                    vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
                    scale: 0.5, life: 1.0, color: '#dc2626',
                    spawnPhase: 'burst', gravity: 0,
                });
            }
            break;
        }
        }
    }

    update(timeScale) {
        const s = Number.isFinite(timeScale) ? Math.max(0, timeScale) : 1;
        this.frame += s;
        this.phaseFrame += s;

        // Phase transitions
        if (this.phase === 'telegraph' && this.phaseFrame >= this.cfg.telegraph) {
            this.phase = 'burst';
            this.phaseFrame = 0;
        } else if (this.phase === 'burst' && this.phaseFrame >= this.cfg.burst) {
            this.phase = 'decay';
            this.phaseFrame = 0;
        }

        // Overall life
        this.life = Math.max(0, 1.0 - this.frame / this.duration);

        // Phase-specific progress
        if (this.phase === 'telegraph') {
            this._telegraphProgress = Math.min(1, this.phaseFrame / this.cfg.telegraph);
        } else if (this.phase === 'burst') {
            this._burstProgress = Math.min(1, this.phaseFrame / this.cfg.burst);
        } else {
            this._decayProgress = Math.min(1, this.phaseFrame / (this.duration - this.cfg.telegraph - this.cfg.burst));
        }

        // Update graphics rotation
        this._gfxData.rotation += 0.08 * s;
        if (this.phase === 'telegraph') {
            this._gfxData.alpha = this._telegraphProgress * 0.4;
            this._gfxData.scale = 0.3 + this._telegraphProgress * 0.2;
        } else if (this.phase === 'burst') {
            this._gfxData.alpha = 0.8 - this._burstProgress * 0.3;
            this._gfxData.scale = 0.5 + this._burstProgress * 0.5;
            if (this.skillType === 'berserk') this._gfxData.rotation += 0.15 * s;
        } else {
            this._gfxData.alpha = Math.max(0, 0.5 * (1 - this._decayProgress));
            this._gfxData.scale = 1.0 - this._decayProgress * 0.3;
        }

        // Update particle positions
        for (const p of this._particles) {
            // Only update particles that match current phase or are already spawned
            if (p.spawnPhase === this.phase || (this.phase === 'decay' && p.spawnPhase === 'burst')) {
                // Inward spiral (devour)
                if (p.inward) {
                    const dx = -p.ox;
                    const dy = -p.oy;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 2) {
                        const speed = p.inwardSpeed * (1 + this._burstProgress * 2);
                        p.ox += (dx / dist) * speed * s;
                        p.oy += (dy / dist) * speed * s;
                    }
                } else {
                    p.ox += p.vx * s;
                    p.oy += p.vy * s;
                }
                if (p.gravity) p.vy += p.gravity * s;
                // Spiral motion (regen)
                if (p.spiral) {
                    const angle = (p.spiralAngle = (p.spiralAngle || 0) + p.spiralSpeed * s);
                    p.ox += Math.cos(angle) * 0.5 * s;
                }
                // Life decay
                if (this.phase === 'burst') {
                    p.life = Math.max(0, 1 - this._burstProgress * 0.8);
                } else if (this.phase === 'decay') {
                    p.life = Math.max(0, 0.2 * (1 - this._decayProgress));
                }
            }
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;

        // PixiJS path
        if (pixiIsActive()) {
            if (!this._pixi) this._pixi = affixSkillVFX_pixiCreate(this);
            if (this._pixi) { affixSkillVFX_pixiSync(this, this._pixi); return; }
        }

        // Canvas 2D fallback — draw particles as filled circles
        ctx.save();
        for (const p of this._particles) {
            if (p.life <= 0) continue;
            const shouldShow = (p.spawnPhase === this.phase) ||
                (this.phase === 'decay' && p.spawnPhase === 'burst');
            if (!shouldShow) continue;
            ctx.globalAlpha = Math.max(0, p.life * 0.7);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(this.x + p.ox, this.y + p.oy, Math.max(1, p.scale * 5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    get dead() { return this.life <= 0; }
}

// ==================== 导出 ====================
export {
    Particle,
    SlashEffect,
    PierceCutEffect,
    CollectionBeam,
    Shockwave,
    LaserBeam,
    FloatingText,
    EnergyOrb,
    LightningBolt,
    FireWave,
    BurnEffect,
    ElectrocuteEffect,
    VenomEffect,
    WindMarkEffect,
    IceWave,
    DeathExplosion,
    HealWave,
    GreedyWheelEffect,
    BladeStormRing,
    BladeStormVortex,
    SwordScar,
    RewardDropEffect,
    MuzzleFlashV2,
    FiringBurst,
    AffixSkillVFX
};
