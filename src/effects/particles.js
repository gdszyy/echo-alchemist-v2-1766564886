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
import { sb as _sb } from '../utils/perf.js';
import { CONFIG } from '../config.js'; // [Promare] visualMode gate（小幅突破原模块独立性，仅读取 visualMode）
import { PROMARE_PALETTE } from '../render/promare_tokens.js';
import {
    drawShape_cone3, drawShape_oct2, drawShape_zigzagZ, drawShape_lance4,
    drawShape_hex6, drawShape_star4, drawShape_diamond, drawShape_crescent,
    drawShape_triDown, drawShape_ringOuter, drawShape_ringInner,
    drawShape_radialSpoke, fillStroke_promare
} from '../render/promare_shapes.js';

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
            this.size = Math.random() * 8 + 6;
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
            this.size = Math.random() * 6 + 4; this.life = 1.2;
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

        // ========== [Promare] 10 个新粒子 mode ==========
        // @perf-impact: promare particle modes — additive blend + 2 fills per draw；
        //   按 particleCounts[mode] 计预算（沿用 spawn_system 的 spark/ember 等限额）。

        } else if (mode === 'pyro_cone') {
            // 3 棱锥火苗，反重力上升 (vy -= 1.2dt)，xdrag 0.94
            const a = (Math.random() - 0.5) * Math.PI * 0.6;
            const sp = Math.random() * 2 + 1;
            vel.x = Math.sin(a) * sp;
            vel.y = -Math.abs(Math.cos(a) * sp) - 0.5;
            this.drag = 0.94; this.gravity = -1.2;
            this.decay = 0.022 + Math.random() * 0.015;
            this.size = Math.random() * 3 + 2;
            this.angle = (Math.random() - 0.5) * 0.4; // 微旋
            this.spin = (Math.random() - 0.5) * 0.04;
        } else if (mode === 'cryo_oct') {
            // 拉长八面体，慢落 (vy += 0.3dt)，drag 0.97
            const a = Math.random() * Math.PI * 2;
            const sp = Math.random() * 1.5 + 0.3;
            vel.x = Math.cos(a) * sp;
            vel.y = Math.sin(a) * sp;
            this.drag = 0.97; this.gravity = 0.3;
            this.decay = 0.018 + Math.random() * 0.012;
            this.size = Math.random() * 2.5 + 1.5;
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() - 0.5) * 0.02;
        } else if (mode === 'thunder_z') {
            // Z 字闪电粒子，高频抖动 + opacity strobe（draw 时实现）
            const a = Math.random() * Math.PI * 2;
            const sp = Math.random() * 3 + 1;
            vel.x = Math.cos(a) * sp;
            vel.y = Math.sin(a) * sp;
            this.drag = 0.92; this.gravity = 0.05;
            this.decay = 0.04 + Math.random() * 0.02;
            this.size = Math.random() * 3 + 2.5;
            this.angle = Math.random() * Math.PI * 2;
            this.spin = 0;
        } else if (mode === 'pierce_lance') {
            // 4 棱长矛，几乎无重力，无旋，直线
            const a = (this.angle || 0) || Math.random() * Math.PI * 2;
            const sp = Math.random() * 3 + 4;
            vel.x = Math.cos(a) * sp;
            vel.y = Math.sin(a) * sp;
            this.drag = 0.99; this.gravity = 0.05;
            this.decay = 0.018 + Math.random() * 0.01;
            this.size = Math.random() * 3 + 3;
            this.angle = a; // 锁定朝速度方向
            this.spin = 0;
        } else if (mode === 'bounce_hex') {
            // 6 边形，强重力 + 单次反弹 *-0.55
            const a = Math.random() * Math.PI * 2;
            const sp = Math.random() * 3 + 2;
            vel.x = Math.cos(a) * sp;
            vel.y = -Math.abs(Math.sin(a) * sp); // 初速向上一些以利反弹
            this.drag = 0.95; this.gravity = 3.0;
            this.decay = 0.02 + Math.random() * 0.015;
            this.size = Math.random() * 2.5 + 1.8;
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() - 0.5) * 0.08;
            this._bounced = false;
            this._bounceY = y + (Math.random() * 80 + 40); // 落地虚拟线
        } else if (mode === 'scatter_star') {
            // 4 角星，标重 + 中 drag + 快旋；signature: 中点二次爆裂（生成子粒子）
            const a = Math.random() * Math.PI * 2;
            const sp = Math.random() * 5 + 2.5;
            vel.x = Math.cos(a) * sp;
            vel.y = Math.sin(a) * sp;
            this.drag = 0.94; this.gravity = 0.18;
            this.decay = 0.022 + Math.random() * 0.012;
            this.size = Math.random() * 3 + 2.2;
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.14);
            this._splitFired = false;     // 二次爆裂 flag
            this._sizeStart = this.size;   // 记录初始尺寸，draw 时按 life 缩放
        } else if (mode === 'damage_diamond') {
            // 大菱形，类 spark 但更大；signature: 白心 + 黄圈双层 + 快脉冲
            const a = Math.random() * Math.PI * 2;
            const sp = Math.random() * 4.5 + 2.5;
            vel.x = Math.cos(a) * sp;
            vel.y = Math.sin(a) * sp;
            this.drag = 0.89; this.gravity = 0.08;
            this.decay = 0.045 + Math.random() * 0.018;   // 寿命更短（瞬间冲击感）
            this.size = Math.random() * 3.5 + 3.5;          // 尺寸更大
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() - 0.5) * 0.04;
        } else if (mode === 'venom_tri') {
            // 倒三角毒滴，反重力 + x-wobble；signature: 留腐蚀印记（drip）
            vel.x = (Math.random() - 0.5) * 0.8;
            vel.y = -Math.random() * 1.2 - 0.4;
            this.drag = 0.97; this.gravity = -0.04;
            this.decay = 0.014 + Math.random() * 0.008;
            this.size = Math.random() * 2 + 1.4;
            this.angle = 0;
            this.wobble = Math.random() * Math.PI * 2;
            this._dripTimer = 0.3;          // 每 0.3 life 留一个印记
            this._dripPositions = [];        // 历史印记位置
        } else if (mode === 'echo_ring') {
            // 同心环，静止 + 半径扩张 + alpha 衰减；signature: 多层错时涟漪
            vel.x = 0; vel.y = 0;
            this.drag = 1.0; this.gravity = 0;
            this.decay = 0.035;
            this.size = Math.random() * 2 + 3;
            this.angle = 0;
            this._expandRate = 0.6 + Math.random() * 0.4;
        } else if (mode === 'laser_beam') {
            // [新] 激光光柱：从中心向 angle 方向飞出，长度即可见光柱长度
            const a = (this.angle != null) ? this.angle : Math.random() * Math.PI * 2;
            vel.x = Math.cos(a) * 3.0;          // 飞得更远
            vel.y = Math.sin(a) * 3.0;
            this.drag = 0.92; this.gravity = 0;
            this.decay = 0.06;
            this.size = 10 + Math.random() * 6; // 光柱长度 20-32px
            this.angle = a;
            this.spin = 0;
        } else if (mode === 'radial_spoke') {
            // 辐射 spoke：从中心向 angle 方向射出，无重力，快衰
            const a = (this.angle != null) ? this.angle : Math.random() * Math.PI * 2;
            vel.x = Math.cos(a) * 0.8;
            vel.y = Math.sin(a) * 0.8;
            this.drag = 0.95; this.gravity = 0;
            this.decay = 0.06;
            this.size = Math.random() * 3 + 4;
            this.angle = a;
            this.spin = 0;

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
        // [Promare] thunder_z 高频抖动（每帧 ±0.04 单位）
        if (this.mode === 'thunder_z') {
            this.pos.x += (Math.random() - 0.5) * 0.4 * timeScale;
            this.pos.y += (Math.random() - 0.5) * 0.4 * timeScale;
        }
        // [Promare] venom_tri x-wobble
        if (this.mode === 'venom_tri') {
            this.pos.x += Math.sin(this.life * 6 + this.wobble) * 0.4 * timeScale;
        }
        // [Promare] bounce_hex 落地反弹（仅一次）
        if (this.mode === 'bounce_hex' && !this._bounced && this.vel.y > 0 && this.pos.y >= this._bounceY) {
            this.vel.y *= -0.55;
            this._bounced = true;
        }
        // [Promare] echo_ring 半径扩张（用 size 当当前 radius）
        if (this.mode === 'echo_ring') {
            this.size += this._expandRate * timeScale * 4;
        }
        // [Promare] scatter_star 中点二次爆裂：当 life 跨过 0.5 时生成 3 子粒子
        // (子粒子在 draw 时已无法 spawn 新粒子，需在 update 期间访问 global game)
        if (this.mode === 'scatter_star' && !this._splitFired && this.life < 0.5 && this.life > 0.3) {
            this._splitFired = true;
            // 子粒子用同 mode 但更小、更快、向外散
            if (typeof globalThis !== 'undefined' && globalThis._promareScatterSubSpawn) {
                globalThis._promareScatterSubSpawn(this.pos.x, this.pos.y, this.color);
            }
        }
        // [Promare] cryo_oct 落地结晶分裂：寿命接近 0 时生成 2 个微小晶体
        if (this.mode === 'cryo_oct' && !this._splitFired && this.life < 0.15 && this.life > 0.05) {
            this._splitFired = true;
            if (typeof globalThis !== 'undefined' && globalThis._promareCryoSubSpawn) {
                globalThis._promareCryoSubSpawn(this.pos.x, this.pos.y, this.color);
            }
        }
        // [Promare] venom_tri 留腐蚀印记：每 0.3 life 记录一次位置
        if (this.mode === 'venom_tri') {
            this._dripTimer -= timeScale * 0.05;
            if (this._dripTimer <= 0) {
                this._dripTimer = 0.3;
                this._dripPositions.push({ x: this.pos.x, y: this.pos.y, life: 0.5 });
                if (this._dripPositions.length > 4) this._dripPositions.shift();
            }
            // 印记自身衰减
            for (const d of this._dripPositions) d.life -= timeScale * 0.025;
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
        // [Promare] 旋转更新
        if (this.mode === 'pyro_cone' || this.mode === 'cryo_oct' || this.mode === 'bounce_hex'
            || this.mode === 'scatter_star' || this.mode === 'damage_diamond') {
            this.angle += (this.spin || 0) * timeScale;
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

        // ========== [Promare] 10 个新 mode 渲染 ==========
        // @perf-impact: 单粒子 1 fill + 1 stroke，加法混合无 shadowBlur，<0.05ms。

        } else if (this.mode === 'pyro_cone') {
            // signature: 主体外 + 内核高亮小三角（双层灼烧感）
            ctx.rotate(this.angle || 0);
            drawShape_cone3(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.PINK, PROMARE_PALETTE.WHITE, 1, 0.55);
            // 内核 YELLOW 0.5× cone
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.scale(0.5, 0.5);
            drawShape_cone3(ctx, this.size);
            ctx.fillStyle = PROMARE_PALETTE.YELLOW;
            ctx.globalAlpha = Math.max(0, this.life) * 0.9;
            ctx.fill();
            ctx.restore();
        } else if (this.mode === 'cryo_oct') {
            // signature: 主体 + 内部白色十字闪光（晶体反光）
            ctx.rotate(this.angle || 0);
            drawShape_oct2(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.CYAN, PROMARE_PALETTE.WHITE, 1, 0.55);
            // 白色十字内饰
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = PROMARE_PALETTE.WHITE;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -this.size * 1.6);
            ctx.lineTo(0,  this.size * 1.6);
            ctx.moveTo(-this.size * 0.4, 0);
            ctx.lineTo( this.size * 0.4, 0);
            ctx.stroke();
            ctx.restore();
        } else if (this.mode === 'thunder_z') {
            // signature: 主体 strobe + 随机分支闪电
            const strobe = (Math.random() > 0.35) ? 1.0 : 0.25;
            ctx.globalAlpha *= strobe;
            ctx.rotate(this.angle || 0);
            drawShape_zigzagZ(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.WHITE, 1, 0.6);
            // 30% 概率每帧画一条短随机分支
            if (Math.random() < 0.3) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = PROMARE_PALETTE.WHITE;
                ctx.lineWidth = 1;
                const bx = (Math.random() - 0.5) * this.size * 2.5;
                const by = (Math.random() - 0.5) * this.size * 2.5;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(bx * 0.4, by * 0.4);
                ctx.lineTo(bx * 0.6, by * 0.7);
                ctx.lineTo(bx, by);
                ctx.stroke();
                ctx.restore();
            }
        } else if (this.mode === 'pierce_lance') {
            // signature: 主体 + 身后白色尾迹线（穿透痕迹）
            ctx.save();
            // 尾迹：沿 -x 方向画一条 4× size 的渐变细线（已 rotate 到 angle）
            ctx.rotate(this.angle || 0);
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = PROMARE_PALETTE.WHITE;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha *= 0.45;
            ctx.beginPath();
            ctx.moveTo(-this.size * 0.5, 0);
            ctx.lineTo(-this.size * 4, 0);
            ctx.stroke();
            ctx.restore();
            // 主体
            ctx.rotate(this.angle || 0);
            drawShape_lance4(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.WHITE, PROMARE_PALETTE.PINK, 1.5, 0.75);
        } else if (this.mode === 'bounce_hex') {
            // signature: 反弹瞬间 scaleY 压扁（_bounced flag 刚翻 true 时压最扁）
            const recentBounce = this._bounced && this.vel && this.vel.y < 0 && Math.abs(this.vel.y) > 1;
            const sy = recentBounce ? 0.4 : 1.0;
            const sx = recentBounce ? 1.4 : 1.0;
            ctx.rotate(this.angle || 0);
            ctx.scale(sx, sy);
            drawShape_hex6(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.PINK, PROMARE_PALETTE.YELLOW, 1, 0.6);
        } else if (this.mode === 'scatter_star') {
            // signature: 形变缩放（life 0~0.5 增大，0.5~0 缩小）+ 快旋
            const lifeShape = this.life > 0.5 ? (1 - this.life) * 2 : this.life * 2;
            const scaleFactor = 0.7 + lifeShape * 0.6;
            ctx.rotate(this.angle || 0);
            ctx.scale(scaleFactor, scaleFactor);
            drawShape_star4(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK, 1.5, 0.6);
        } else if (this.mode === 'damage_diamond') {
            // signature: 白心黄圈双层 + 脉冲 alpha
            const pulse = (Math.sin(this.life * 30) + 1) * 0.5;
            ctx.rotate(this.angle || 0);
            // 外圈 YELLOW 1.5× scale
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= 0.5 + pulse * 0.3;
            ctx.scale(1.5, 1.5);
            drawShape_diamond(ctx, this.size);
            ctx.fillStyle = PROMARE_PALETTE.YELLOW;
            ctx.fill();
            ctx.restore();
            // 内核 WHITE 主体
            drawShape_diamond(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.WHITE, PROMARE_PALETTE.WHITE, 1.5, 0.95);
        } else if (this.mode === 'venom_tri') {
            // signature: 留腐蚀印记（小绿圆点）
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            if (this._dripPositions && this._dripPositions.length > 0) {
                // 印记画在世界坐标（已 translate 到 this.pos），需要相对偏移
                for (const d of this._dripPositions) {
                    if (d.life <= 0) continue;
                    const dx = d.x - this.pos.x;
                    const dy = d.y - this.pos.y;
                    ctx.globalAlpha = Math.max(0, d.life) * 0.55;
                    ctx.fillStyle = PROMARE_PALETTE.YELLOW;
                    ctx.beginPath();
                    ctx.arc(dx, dy, 2 + d.life * 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
            drawShape_triDown(ctx, this.size);
            fillStroke_promare(ctx, PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK, 1, 0.6);
        } else if (this.mode === 'laser_beam') {
            // [signature] 激光光柱：从粒子位置向 +x 射出长光柱（双层 CYAN+WHITE） + 末端三角光斑
            ctx.rotate(this.angle || 0);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            // 外发光（CYAN 厚条带）
            ctx.strokeStyle = PROMARE_PALETTE.CYAN;
            ctx.lineWidth = 6;
            ctx.globalAlpha *= 0.5;
            ctx.beginPath();
            ctx.moveTo(-this.size * 0.5, 0);
            ctx.lineTo(this.size * 1.5, 0);
            ctx.stroke();

            // 主光柱（白色细中线）
            ctx.globalAlpha = Math.max(0, this.life);
            ctx.strokeStyle = PROMARE_PALETTE.WHITE;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-this.size * 0.5, 0);
            ctx.lineTo(this.size * 1.5, 0);
            ctx.stroke();

            // 末端爆破三角（白色尖头）
            ctx.fillStyle = PROMARE_PALETTE.WHITE;
            ctx.beginPath();
            ctx.moveTo(this.size * 1.5 + 5, 0);
            ctx.lineTo(this.size * 1.3, -3);
            ctx.lineTo(this.size * 1.3, 3);
            ctx.closePath();
            ctx.fill();

            // 起点小圆斑（核心）
            ctx.beginPath();
            ctx.arc(-this.size * 0.5, 0, 3, 0, Math.PI * 2);
            ctx.fillStyle = PROMARE_PALETTE.YELLOW;
            ctx.fill();
            ctx.restore();
        } else if (this.mode === 'echo_ring') {
            // 双同心环：外环填充 PINK，内环填充 CYAN（差值制造环）
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= 0.4;
            drawShape_ringOuter(ctx, this.size);
            ctx.fillStyle = PROMARE_PALETTE.PINK;
            ctx.fill();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
            drawShape_ringInner(ctx, this.size);
            ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.max(0, this.life) * 0.8;
            drawShape_ringOuter(ctx, this.size);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = PROMARE_PALETTE.CYAN;
            ctx.stroke();
            ctx.restore();
        } else if (this.mode === 'radial_spoke') {
            // 短线段从中心射出，调用方未必 rotate；用 this.angle 绑定方向
            ctx.rotate(this.angle || 0);
            ctx.globalCompositeOperation = 'lighter';
            drawShape_radialSpoke(ctx, this.size);
            ctx.strokeStyle = PROMARE_PALETTE.WHITE;
            ctx.lineWidth = 2;
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
        if (this.radius < this.maxRadius) {
            this.radius += 4 * timeScale; // 扩散速度
        }
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
     */
    constructor(x, y, text, color = '#fbbf24', fontSize = 16) { 
        this.pos = new Vec2(x, y); 
        this.vel = new Vec2(0, -1); // 向上飄
        this.life = 1.0; 
        this.text = text; 
        this.color = color;
        this.fontSize = fontSize;
    }

    update(timeScale) { 
        this.pos = this.pos.add(this.vel.mult(timeScale)); 
        this.life -= 0.02 * timeScale; 
    }

    draw(ctx) {
        if (this.life <= 0) return;

        // [Promare] 等宽 Inter Mono + 黑色 3 偏移 stamp + 白色顶层
        // 离散 scale 阶梯 [1.5, 1.0, 0.7] snap，营造硬感
        if (typeof CONFIG !== 'undefined' && CONFIG.visualMode === 'promare') {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.life);
            // 离散 scale snap
            const scale = this.life > 0.66 ? 1.5 : (this.life > 0.33 ? 1.0 : 0.7);
            const fz = Math.round(this.fontSize * scale);
            ctx.font = `bold ${fz}px 'Inter Mono', 'Roboto Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 黑色 stamp 3 个偏移（替代 shadowBlur）
            ctx.fillStyle = '#0a0a0a';
            const offs = [[2, 0], [0, 2], [-2, 0], [0, -2]];
            for (const [ox, oy] of offs) {
                ctx.fillText(this.text, this.pos.x + ox, this.pos.y + oy);
            }
            // 顶层主色（pyro→PINK / cryo→CYAN / lightning→YELLOW / 其他→WHITE）
            let mainColor = '#FFFFFF';
            const c = (this.color || '').toLowerCase();
            if (c.includes('f97316') || c.includes('ef4444') || c.includes('fca5a5')) mainColor = '#FF0090';
            else if (c.includes('06b6d4') || c.includes('22d3ee') || c.includes('06b6')) mainColor = '#00E5FF';
            else if (c.includes('facc15') || c.includes('c084fc') || c.includes('fbbf24') || c.includes('ffd600')) mainColor = '#FFD600';
            ctx.fillStyle = mainColor;
            ctx.fillText(this.text, this.pos.x, this.pos.y);
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = `bold ${this.fontSize}px sans-serif`;
        ctx.textAlign = 'center';

        // 繪製描邊讓文字更清楚
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = Math.max(3, this.fontSize / 5);
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
 * SwordScar - 剑痕残留特效
 * 在敌人位置绘制一道短暂的斜线剑痕，模拟被斩击后的刀痕
 */
class SwordScar {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // 随机斜向角度（偏向斜线感）
        this.angle = (Math.random() - 0.5) * Math.PI * 0.5 + Math.PI * 0.25;
        this.length = 20 + Math.random() * 20;
        this.life = 1.0;
        this.active = true;
        // 随机偏移，避免所有剑痕重叠
        this.offsetX = (Math.random() - 0.5) * 20;
        this.offsetY = (Math.random() - 0.5) * 20;
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
        ctx.save();
        ctx.translate(this.x + this.offsetX, this.y + this.offsetY);
        ctx.rotate(this.angle);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.life * 0.8;

        const halfL = this.length / 2;
        // 主剑痕线
        const grad = ctx.createLinearGradient(-halfL, 0, halfL, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.3, 'rgba(52, 211, 153, 0.9)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.7, 'rgba(52, 211, 153, 0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5 * this.life;
        ctx.lineCap = 'round';
        ctx.shadowBlur = _sb(8);
        ctx.shadowColor = '#34d399';
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
    DeathExplosion,
    HealWave,
    BladeStormRing,
    SwordScar,
    RewardDropEffect
};
