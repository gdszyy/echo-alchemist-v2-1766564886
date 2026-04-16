/**
 * enemy.js - 敌人实体类
 * 
 * 职责：
 * - Enemy 类定义（包含所有词缀逻辑、AI 行为、视觉渲染）
 * - 敌人的血量管理、词缀效果、温度系统
 * - 敌人的绘制（血条、词缀特效、冻结/过热视觉）
 * 
 * 依赖：
 * - CONFIG（来自 config.js）
 * - Vec2（来自 utils/math_utils.js）
 * - Particle（来自 effects/particles.js）
 * - audio（来自 entities.js 的音频注入代理）
 * 
 * 重构历史：
 * - Task 2.2: 从 entities.js 中提取
 */
import { CONFIG } from '../config.js';
import { Vec2, lerp, lerpColor } from '../utils/math_utils.js';
import { Particle } from '../effects/particles.js';
import { eventBus } from '../event_bus.js';

// audio 代理由 entities.js 注入，通过模块级变量共享
// 注意：Enemy 类使用的 audio 对象来自 entities.js 的依赖注入机制
// 为避免循环依赖，这里重新创建一个独立的 audio 代理
let _audioProvider = null;
export function setEnemyAudioProvider(provider) {
    _audioProvider = provider;
}
const audio = new Proxy({}, {
    get: (target, prop) => {
        if (_audioProvider) {
            const val = _audioProvider[prop];
            if (typeof val === 'function') {
                return val.bind(_audioProvider);
            }
            return val;
        }
        if (prop === 'ctx') return null;
        if (prop === 'muted') return false;
        return () => {};
    }
});

// ==================== Enemy 类 ====================
class Enemy {
    constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = []) {
        this.pos = new Vec2(x, y); 
        this.width = width; 
        this.height = height;
        this.collisionShape = 'aabb'; // 默认碰撞形状为 AABB
        this.collisionData = null; // 碰撞形状数据
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
        // [架构] elite/boss 由 spawn_system.js 通过 e.type 直接赋值，不再从 affixes 隐式转换
        this.hitTimer = 0; 
        this.dropTargetY = y; 
        this.justSpawned = true; 
        this.temp = 0; 
        this.bumpOffsetY = 0; 
        this.isFrozenCurrentTurn = false; 
        this.frozenCount = 0; // [温度衰减] 该敌人累计被冰冻的次数，每次被冰冻后温度降低效果乘以 0.9^frozenCount

        // 视觉种子
        this.visualSeed = Math.random(); 

        // === E1: 静态倾斜角度（一次性预计算，不在 update/draw 中重算）===
        // 普通敌人：最大 ±2.5°（弧度约 ±0.044），elite ±1.5°，boss 不倾斜
        this._staticTilt = (this.visualSeed - 0.5) * CONFIG.enemyRender.staticTiltMax;
        if (this.type === 'boss') this._staticTilt = 0;
        else if (this.type === 'elite') this._staticTilt *= 0.6;
        
        this.hasActedThisTurn = false;
        this.actionPhase = 'idle'; // 'idle', 'telegraphing', 'acting'
        this.telegraphTimer = 0;   // 预警倒计时
        this.actionIcon = '';      // 即将触发的动作图标
        this.actionName = '';      // 动作名称

        // Boss 专属属性（普通敌人为 undefined）
        this.bossType = undefined;      // Boss 类型 ID（如 'ignis', 'glacies' 等）
        this.bossName = undefined;      // Boss 显示名称
        this.berserked = false;         // 是否已进入狂暴阶段
        this.rotationTurnCount = 0;     // 奥罗波罗斯词缀轮转计数器
        this.rotationIndex = 0;         // 奥罗波罗斯当前词缀组索引

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
        // === Boss 入场动画 ===
        // entranceTimer: 入场动画帧计数器，>0 时播放入场动画
        // 阶段 1 (90→60): Boss 从屏幕外高速坠入
        // 阶段 2 (60→30): 落地冲击波 + 红色光圈扩散
        // 阶段 3 (30→0):  Boss 名称文字放大淡出
        this.entranceTimer = 0;

        // === A3: 受击 Squash & Stretch 形变 ===
        // _hitImpact: 受击形变强度（单次伤害 / maxHp，clamp 到 0~hitImpactMax）
        this._hitImpact = 0;

        // === Layer 1.5: 预计算底层纹理 (OffscreenCanvas) ===
        // 基于 visualSeed 一次性生成静态纹理，每帧仅执行一次 drawImage
        this._textureCanvas = null;
        this._initTexture(width, height);
    }
    
    /**
     * Layer 1.5: 初始化底层纹理 (OffscreenCanvas 预计算)
     * 基于 visualSeed 决定纹理类型：
     *   seed < 0.3  → 金属拉丝纹理
     *   0.3-0.6    → 矿石斑点纹理
     *   >= 0.6     → 能量流线纹理
     */
    _initTexture(width, height) {
        const w = width - 4;
        const h = height - 4;
        // 尝试使用 OffscreenCanvas，不支持时回退到普通 Canvas
        let offscreen;
        try {
            offscreen = new OffscreenCanvas(w, h);
        } catch (e) {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            offscreen = c;
        }
        const oc = offscreen.getContext('2d');
        const seed = this.visualSeed;

        if (seed < 0.3) {
            // 金属拉丝纹理：垂直线条
            const lineCount = Math.floor(w / 3);
            for (let i = 0; i < lineCount; i++) {
                const x = (i / lineCount) * w;
                const alpha = 0.04 + (Math.sin(seed * 100 + i) * 0.5 + 0.5) * 0.08;
                oc.strokeStyle = `rgba(200, 200, 220, ${alpha})`;
                oc.lineWidth = 1;
                oc.beginPath();
                oc.moveTo(x, 0);
                oc.lineTo(x + (Math.sin(seed * 50 + i) * 3), h);
                oc.stroke();
            }
        } else if (seed < 0.6) {
            // 矿石斑点纹理：随机圆形斑点
            const spotCount = 8 + Math.floor(seed * 20);
            for (let i = 0; i < spotCount; i++) {
                const sx = (Math.sin(seed * 100 + i * 7.3) * 0.5 + 0.5) * w;
                const sy = (Math.cos(seed * 80 + i * 5.1) * 0.5 + 0.5) * h;
                const sr = 2 + Math.sin(seed * 30 + i) * 3;
                const alpha = 0.05 + Math.abs(Math.sin(seed * 60 + i)) * 0.08;
                oc.fillStyle = `rgba(100, 80, 60, ${alpha})`;
                oc.beginPath();
                oc.arc(sx, sy, Math.abs(sr), 0, Math.PI * 2);
                oc.fill();
            }
        } else {
            // 能量流线纹理：斜向流动线
            const lineCount = 5 + Math.floor(seed * 8);
            for (let i = 0; i < lineCount; i++) {
                const y = (i / lineCount) * h;
                const alpha = 0.04 + Math.abs(Math.sin(seed * 40 + i)) * 0.08;
                oc.strokeStyle = `rgba(80, 100, 160, ${alpha})`;
                oc.lineWidth = 1.5;
                oc.beginPath();
                oc.moveTo(0, y);
                // 波浪形流线
                for (let x = 0; x <= w; x += 4) {
                    oc.lineTo(x, y + Math.sin(seed * 10 + x * 0.1) * 3);
                }
                oc.stroke();
            }
        }
        // === A1: 材质光泽叠加（Layer 1.5 增强）===
        // 在基础纹理之上叠加顶→底 LinearGradient，模拟 3D 凸起物理厚度感
        // [自适应性能] enemyGloss 开关：低端模式跳过此段，省去 OffscreenCanvas 渐变叠加
        // 注意：_initTexture 在构造时调用，此时 game 实例可能尚未初始化，
        //        所以尝试读取 window.game ，若不存在则默认开启光泽。
        const _glossEnabled = (typeof window !== 'undefined' && window.game && window.game.perfQualityLevel)
            ? CONFIG.performance[window.game.perfQualityLevel].enemyGloss
            : true;
        if (_glossEnabled) {
            const glossGrad = oc.createLinearGradient(0, 0, 0, h);
            glossGrad.addColorStop(0, `rgba(255,255,255,${CONFIG.enemyRender.glossTopAlpha})`);
            glossGrad.addColorStop(1, `rgba(0,0,0,${CONFIG.enemyRender.glossBottomAlpha})`);
            oc.fillStyle = glossGrad;
            oc.fillRect(0, 0, w, h);
        }

        // === E2: 纹理色调随机偏移（Hue Shift Overlay）===
        // 基于 visualSeed 叠加一层极淡的彩色覆盖，使每个敌人颜色略有不同
        {
            const hueAlpha = CONFIG.enemyRender.hueShiftAlphaMin + seed * CONFIG.enemyRender.hueShiftAlphaRange;
            const hue = Math.floor(seed * 60) - 15; // -15° ~ +45° 色相偏移
            if (hue >= 0) {
                oc.fillStyle = `rgba(255, 180, 50, ${hueAlpha})`;
            } else {
                oc.fillStyle = `rgba(100, 150, 255, ${hueAlpha})`;
            }
            oc.globalCompositeOperation = 'overlay';
            oc.fillRect(0, 0, w, h);
            oc.globalCompositeOperation = 'source-over'; // 重置混合模式
        }

        // === E3: 边角随机磨损点（Corner Wear Dots）===
        // 在四个角落附近放置 2~4 个极小的深色磨损点，模拟金属/石材的边角磨损
        {
            // seeded 伪随机函数，保证每次重建纹理结果一致
            const seededRand = (s) => { let x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
            const dotCount = CONFIG.enemyRender.wearDotCountMin + Math.floor(seed * (CONFIG.enemyRender.wearDotCountMax - CONFIG.enemyRender.wearDotCountMin + 1));
            // 四个角落的基准坐标
            const corners = [
                [w * 0.15, h * 0.15],
                [w * 0.85, h * 0.15],
                [w * 0.15, h * 0.85],
                [w * 0.85, h * 0.85]
            ];
            for (let i = 0; i < dotCount; i++) {
                const cornerIdx = i % 4;
                const [cx, cy] = corners[cornerIdx];
                // 在角落附近随机偶动
                const dx = (seededRand(seed * 10 + i * 3.7) - 0.5) * w * 0.15;
                const dy = (seededRand(seed * 20 + i * 5.3) - 0.5) * h * 0.15;
                const radius = 1.5 + seededRand(seed * 30 + i * 7.1) * 1.5; // 1.5 ~ 3px
                const alpha = CONFIG.enemyRender.wearDotAlphaMin + seededRand(seed * 40 + i * 11.3) * (CONFIG.enemyRender.wearDotAlphaMax - CONFIG.enemyRender.wearDotAlphaMin);
                oc.fillStyle = `rgba(0, 0, 0, ${alpha})`;
                oc.beginPath();
                oc.arc(cx + dx, cy + dy, radius, 0, Math.PI * 2);
                oc.fill();
            }
        }

        this._textureCanvas = offscreen;
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

        // [演出时机修复] Boss 待机状态：_pendingEntrance 为 true 时，保持在屏幕外不移动，
        // 等待 phase_startCombatPhase() 进入战斗阶段后激活入场动画。
        if (this._pendingEntrance) {
            // 保持在入场起始位置（屏幕外），不执行任何移动逻辑
            this.pos.y = this._entranceStartY;
            if (this.hitTimer > 0) this.hitTimer -= timeScale;
            if (this.shieldHitTimer > 0) this.shieldHitTimer -= timeScale;
            if (this._hitImpact > 0) this._hitImpact *= Math.pow(CONFIG.enemyRender.hitImpactDecay, timeScale);
            return;
        }

        // Boss 入场动画期间：控制坐标，阶段 1 (90→60) 高速坠入
        if (this.entranceTimer > 0) {
            this.entranceTimer -= timeScale;
            if (this.entranceTimer > 60) {
                // 阶段 1：从屏幕外坠入 —— 利用 easeOutQuart 让落地有冲击感
                const t = (90 - this.entranceTimer) / 30; // 0→1
                const eased = 1 - Math.pow(1 - t, 4);   // easeOutQuart
                this.pos.y = this._entranceStartY + (this.dropTargetY - this._entranceStartY) * eased;
            } else if (this.entranceTimer > 30) {
                // 阶段 2：落地，保持在目标位置
                this.pos.y = this.dropTargetY;
                // 落地的第一帧：触发冲击波效果（一次性标志防止重复触发）
                if (!this._entranceShockwaveFired && game && typeof game.spawn_triggerBossEntranceShockwave === 'function') {
                    this._entranceShockwaveFired = true;
                    game.spawn_triggerBossEntranceShockwave(this);
                }
            } else {
                // 阶段 3：名称文字淡出，保持位置
                this.pos.y = this.dropTargetY;
            }
            if (this.entranceTimer <= 0) this.entranceTimer = 0;
            // 入场动画期间不进行其他移动逻辑
            if (this.hitTimer > 0) this.hitTimer -= timeScale;
            if (this.shieldHitTimer > 0) this.shieldHitTimer -= timeScale;
            if (this._hitImpact > 0) this._hitImpact *= Math.pow(CONFIG.enemyRender.hitImpactDecay, timeScale);
            return;
        }

        // 移动逻辑：吸附目标位置
        if (this.pos.y < this.dropTargetY) {
            this.pos.y += 3 * timeScale;
            if (this.pos.y > this.dropTargetY) this.pos.y = this.dropTargetY;
        }
        
        if (this.hitTimer > 0) this.hitTimer -= timeScale;
        if (this.shieldHitTimer > 0) this.shieldHitTimer -= timeScale;
        // === A3: 受击形变弹性衰减 ===
        if (this._hitImpact > 0) this._hitImpact *= Math.pow(CONFIG.enemyRender.hitImpactDecay, timeScale);
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
                // [限制] 热浪烟雾也受风属性压制
                game.spawn_pushParticleWithLimit(heatSmoke);
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
                    // [限制] 冰雾受风属性压制
                    game.spawn_pushParticleWithLimit(mist);
                }
                chancePool -= 1.0; 
            }
            
            if (this.temp <= -80 && Math.random() < 0.08 * timeScale) {
                const shard = new Particle(this.pos.x + (Math.random() - 0.5) * this.width, this.pos.y, '#a5f3fc', 'shard');
                shard.size = 2.5; 
                // [限制] 冰渣受风属性压制
                game.spawn_pushParticleWithLimit(shard);
            }
        }

        // === [B3] 濒死状态持续粒子增强 ===
        // 血量低于 20% 时，从敢人顶部随机位置冒出深色烟雾，模拟濒死时的焦灸/损毁状态
        if (this.hp > 0 && this.maxHp > 0 && (this.hp / this.maxHp) < 0.2) {
            if (Math.random() < 0.03 * timeScale) {
                const nearDeathSmoke = new Particle(
                    this.pos.x + (Math.random() - 0.5) * this.width * 0.8,
                    this.pos.y - this.height * 0.45, // 从敢人顶部冰出
                    'rgba(0,0,0,0.5)', 'smoke'
                );
                nearDeathSmoke.vel.y = -0.8 - Math.random() * 0.6; // 向上飘出
                nearDeathSmoke.vel.x = (Math.random() - 0.5) * 0.4;
                nearDeathSmoke.size = this.width * 0.18 + Math.random() * 3;
                game.spawn_pushParticleWithLimit(nearDeathSmoke);
            }
        }
        // === [B3 END] ===
    }

    advance(amount) { this.dropTargetY += amount; }

    // --- [核心修改] 第一步：启动预警 (Trigger Telegraph) ---
    startTurnAction(game) {
        // [新增] 更新 Boss 专属物理状态机
        if (this.type === 'boss') {
            if (this.bossType === 'devourer' && this.collisionShape === 'arc') {
                const isBerserk = (this.hp / this.maxHp) < 0.5;
                const cooldownTime = isBerserk ? 2 : 4;
                
                if (this.devourState === 'IDLE') {
                    this.devourTimer++;
                    if (this.devourTimer > 3) {
                        this.devourState = 'OPENING';
                        this.devourTimer = 0;
                    }
                } else if (this.devourState === 'OPENING') {
                    this.devourState = 'DEVOURING';
                    // [修复] 缺口扩大至 324°（圆弧实体 36°，在左方 162°-198°）
                    // 设计文档：DEVOURING 缺口324°，嘴巴大张，弹珠直接命中核心
                    this.collisionData.startAngle = Math.PI * 0.9;  // 162°
                    this.collisionData.endAngle = Math.PI * 1.1;    // 198°
                } else if (this.devourState === 'DEVOURING') {
                    this.devourState = 'COOLDOWN';
                    this.devourTimer = 0;
                    this.collisionData.startAngle = 0;
                    this.collisionData.endAngle = Math.PI * 2;
                } else if (this.devourState === 'COOLDOWN') {
                    this.devourTimer++;
                    if (this.devourTimer >= cooldownTime) {
                        this.devourState = 'IDLE';
                        this.devourTimer = 0;
                        this.collisionData.startAngle = Math.PI * 0.25;
                        this.collisionData.endAngle = Math.PI * 1.75;
                    }
                }
            } else if (this.bossType === 'ouroboros' && this.collisionShape === 'arc') {
                const isBerserk = (this.hp / this.maxHp) < 0.5;
                const rotationSpeed = isBerserk ? Math.PI * 0.5 : Math.PI * 0.25;
                
                this.gapAngle += rotationSpeed;
                if (this.gapAngle > Math.PI * 2) this.gapAngle -= Math.PI * 2;
                
                this.collisionData.startAngle = this.gapAngle;
                this.collisionData.endAngle = this.gapAngle + Math.PI * 1.5;
            }
        }

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
                        // [限制] 冰渣受风属性压制
                        if (typeof game.particles !== 'undefined') game.spawn_pushParticleWithLimit(p);
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
        
        // [改动] 狂暴词条：触发时行动两次（仅非移动行动）；haste 不再影响行动次数
        if (this.actionName === '狂暴') actionCount = 2;

        // Boss 行为差异化：根据 bossType 修改行动次数
        if (this.type === 'boss' && this.bossType) {
            actionCount = this._getBossActionCount(actionCount);
        }

        for (let i = 0; i < actionCount; i++) {
            const isSecondAction = (i === 1);

            // --- 1. 再生 ---
            if(this.affixes.includes('regen')) {
                // Boss 维里迪斯狂暴后自身回血速度加速（_berserkedSelfRegenMult 倍率）
                const selfRegenMult = (this.type === 'boss' && this.bossType === 'viridis' && this.berserked && this._berserkedSelfRegenMult)
                    ? this._berserkedSelfRegenMult
                    : 1;
                const heal = Math.floor(this.maxHp * afx.regenPercent * selfRegenMult) || 1;
                if(this.hp < this.maxHp) {
                    this.hp = Math.min(this.maxHp, this.hp + heal);
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 30, `+${heal}`, '#4ade80');
                    game.spawn_createParticle(this.pos.x, this.pos.y, '#4ade80', 'spark');
                    audio.playEffect('regen');
                }
            }

            // --- 2. 治疗 ---
            if (this.affixes.includes('healer')) {
                // Boss 维里迪斯特殊：狂暴后 _berserkedHealerRange = 0，停止治疗其他敌人
                let effectiveHealerRange = afx.healerRange;
                if (this.type === 'boss' && this.bossType === 'viridis' && this.berserked) {
                    effectiveHealerRange = this._berserkedHealerRange !== undefined ? this._berserkedHealerRange : 0;
                }
                const range = this.width * effectiveHealerRange;
                let healedCount = 0;
                game.enemies.forEach(other => {
                    if (other !== this && other.active && other.hp < other.maxHp && this.pos.dist(other.pos) < range) {
                        const healAmt = Math.ceil(other.maxHp * afx.healerPercent);
                        // [修复] 回血前同步 greenHp，确保动画正常触发
                        if (other.hp > other.greenHp) other.greenHp = other.hp;
                        other.hp = Math.min(other.maxHp, other.hp + healAmt);
                        // 被治疗目标：多个粉绿火花粒子 + 治疗数字
                        for (let _i = 0; _i < 4; _i++) {
                            game.spawn_createParticle(
                                other.pos.x + (Math.random() - 0.5) * other.width,
                                other.pos.y + (Math.random() - 0.5) * other.height * 0.5,
                                Math.random() < 0.5 ? '#f472b6' : '#86efac', 'spark'
                            );
                        }
                        game.spawn_createFloatingText(other.pos.x, other.pos.y - 20, `❤️+${healAmt}`, '#f472b6');
                        healedCount++;
                    }
                });
                if (healedCount > 0) {
                    audio.playEffect('regen');
                    // 扩散治疗波：以治疗范围为参数，明确展示治疗覆盖范围
                    game.spawn_createHealWave(this.pos.x, this.pos.y, range);
                    // 额外一圈粉色冲击波增强打击感
                    game.spawn_createShockwave(this.pos.x, this.pos.y, '#f472b6');
                }
            }

            // --- 3. 吞噬 ---
            if (this.actionName === '吞噬') {
                 // Boss 噬神者特殊行为：吞噬相邻敌人获得护盾层数
                 if (this.type === 'boss' && this.bossType === 'devourer') {
                     const bossDevourCfg = CONFIG.balance.bossConfigs && CONFIG.balance.bossConfigs.devourer;
                     const rangeBonus = bossDevourCfg ? (bossDevourCfg.devourRangeBonus || 0) : 0;
                     const devourRange = this._berserkedDevourRange || (afx.devourRange + rangeBonus);
                     const range = this.width * devourRange;
                     const neighbors = game.enemies.filter(e =>
                         e !== this && e.active && e.type !== 'boss' && this.pos.dist(e.pos) < range
                     );
                     if (neighbors.length > 0) {
                         const victim = neighbors[Math.floor(Math.random() * neighbors.length)];
                         // 吸收护盾层数（而非血量）
                         const absorbedShield = (victim.shieldCharges || 0) + 1;
                         if (!this.affixes.includes('shield')) {
                             this.affixes.push('shield');
                         }
                         this.shieldCharges = (this.shieldCharges || 0) + absorbedShield;
                         const isDead = victim.takeDamage(99999);
                         if (isDead) game.spawn_addScore(victim.maxHp);
                         game.spawn_createFloatingText(this.pos.x, this.pos.y - 40, 'DEVOUR! +Shield ' + absorbedShield, '#ef4444');
                         game.spawn_createParticle(victim.pos.x, victim.pos.y, '#ef4444', 'mist');
                         game.spawn_createShockwave(this.pos.x, this.pos.y, '#ef4444');
                         audio.playEffect('split');
                     }
                 } else {
                     // 普通吞噬行为
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
                         game.spawn_createFloatingText(this.pos.x, this.pos.y - 40, 'DEVOUR!', '#ef4444');
                         game.spawn_createParticle(victim.pos.x, victim.pos.y, '#ef4444', 'mist'); 
                         game.spawn_createShockwave(this.pos.x, this.pos.y, '#ef4444');
                         audio.playEffect('split');
                     }
                 }
            }

            // --- 4. 增殖 ---
            if(this.actionName === '增殖') {
                game.spawn_triggerCloneSpawn(this);
            }

            if (isSecondAction) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, "😡RAGE!", "#ef4444");
            }
        }

        // --- [改动] 移动与跳跃：移出循环，始终只执行一次 ---
        // [Boss 移动冷却逻辑]
        // 狂暴模式下：每回合必定移动（_moveCooldown 始终为 0）
        // 常规模式下：检查冷却计数器，未到间隔则跳过移动
        let _shouldMove = true;
        if (this.type === 'boss' && this.bossType) {
            if (this.berserked) {
                // 狂暴模式：每回合移动，重置冷却为 0
                this._moveCooldown = 0;
            } else {
                // 常规模式：检查冷却
                if (this._moveCooldown > 0) {
                    _shouldMove = false;
                    this._moveCooldown--;
                } else {
                    // 冷却到期，本回合移动，重置冷却计数器
                    const interval = this._moveInterval || 2;
                    this._moveCooldown = interval - 1; // 下次移动需要等待的回合数
                }
            }
        }
        // haste 词条：额外触发一次移动（速度加快，不重复结算其他词条）
        const _doMove = () => {
            const moveAmount = game.enemyHeight;
            const targetY = this.dropTargetY + moveAmount;
            const isBlocked = game.calc_isAreaOccupied(this.pos.x, targetY, this.width * 0.8, this.height * 0.8, this);
            if (!isBlocked) {
                this.advance(moveAmount);
            } else {
                if (this.affixes.includes('jump')) {
                    // Boss 格拉西斯特殊：狂暴后跳跃行数增加
                    let effectiveJumpRows = afx.jumpRows;
                    if (this.type === 'boss' && this.bossType === 'glacies') {
                        effectiveJumpRows = this._berserkedJumpRows || effectiveJumpRows;
                    }
                    const jumpTargetY = this.dropTargetY + (moveAmount * effectiveJumpRows);
                    const isJumpBlocked = game.calc_isAreaOccupied(this.pos.x, jumpTargetY, this.width * 0.8, this.height * 0.8, this);
                    if (!isJumpBlocked) {
                        this.advance(moveAmount * effectiveJumpRows);
                        this.bumpOffsetY = -30;
                        game.spawn_createFloatingText(this.pos.x, this.pos.y, 'JUMP!', '#38bdf8');
                        game.spawn_createParticle(this.pos.x, this.pos.y, '#38bdf8', 'mist');
                        audio.playEffect('split');
                        // [Glacies 狂暴] 落地后冻结周围 Peg
                        if (this.type === 'boss' && this.bossType === 'glacies' && this._berserkedFreezePegs) {
                            this._glaciesFreezePegsOnLanding(game);
                        }
                    } else {
                        this.bumpOffsetY = -10;
                        if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
                    }
                } else {
                    this.bumpOffsetY = -10;
                    if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
                }
            }
        };
        if (_shouldMove) {
            _doMove();
            // [改动] haste 词条：仅额外触发一次移动，不重复结算其他词条
            if (this.affixes.includes('haste')) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, "⚡DASH!", "#facc15");
                _doMove();
            }
        }

        // [Boss 移动提示] 执行完毕后重置预计算标志
        // 玩家回合期间显示的是下一次移动的倒计时，而不是当前回合的状态
        if (this.type === 'boss' && this.bossType) {
            this._willMoveThisTurn = false;
        }

        this.hasActedThisTurn = true;
    }

    performTurnActionAndMove(game) {
        const afx=CONFIG.balance.affixes
        // [改动] haste 不再增加行动次数，狂暴词条也不在此处判定（由 startTurnAction 处理）
        let actionCount = 1;

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

            // --- 2. 範圍治療 (Healer) ---
            if (this.affixes.includes('healer')) {
                const range = this.width * afx.healerRange;
                let healedCount = 0;
                
                game.enemies.forEach(other => {
                    if (other !== this && other.active && other.hp < other.maxHp && this.pos.dist(other.pos) < range) {
                        const healAmt = Math.ceil(other.maxHp * afx.healerPercent);
                        // [修复] 回血前同步 greenHp，确保动画正常触发
                        if (other.hp > other.greenHp) other.greenHp = other.hp;
                        other.hp = Math.min(other.maxHp, other.hp + healAmt);
                        // 被治疗目标：多个粉绿火花粒子 + 治疗数字
                        for (let _i = 0; _i < 4; _i++) {
                            game.spawn_createParticle(
                                other.pos.x + (Math.random() - 0.5) * other.width,
                                other.pos.y + (Math.random() - 0.5) * other.height * 0.5,
                                Math.random() < 0.5 ? '#f472b6' : '#86efac', 'spark'
                            );
                        }
                        game.spawn_createFloatingText(other.pos.x, other.pos.y - 20, `❤️+${healAmt}`, '#f472b6');
                        healedCount++;
                    }
                });
                
                if (healedCount > 0) {
                    audio.playEffect('regen');
                    // 扩散治疗波：以治疗范围为参数，明确展示治疗覆盖范围
                    game.spawn_createHealWave(this.pos.x, this.pos.y, range);
                    // 额外一圈粉色冲击波增强打击感
                    game.spawn_createShockwave(this.pos.x, this.pos.y, '#f472b6');
                }
            }

            // --- 3. 吞噬 (Devour) ---
            if (this.affixes.includes('devour') && Math.random() < afx.devourChance) {
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
                    victim.affixes.forEach(af => {
                        if (!this.affixes.includes(af)) this.affixes.push(af);
                    });
                    const isDead = victim.takeDamage(99999); 
                    if (isDead) game.spawn_addScore(absorbMax);
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
        }

        // --- [改动] 移动与跳跃：移出循环，始终只执行一次 ---
        // haste 词条：额外触发一次移动
        const _doMoveP = () => {
            const moveAmount = game.enemyHeight;
            const targetY = this.dropTargetY + moveAmount;
            const isBlocked = game.calc_isAreaOccupied(this.pos.x, targetY, this.width * 0.8, this.height * 0.8, this);
            if (!isBlocked) {
                this.advance(moveAmount);
            } else {
                if (this.affixes.includes('jump')) {
                    let effectiveJumpRows = afx.jumpRows;
                    if (this.type === 'boss' && this.bossType === 'glacies') {
                        effectiveJumpRows = this._berserkedJumpRows || effectiveJumpRows;
                    }
                    const jumpTargetY = this.dropTargetY + (moveAmount * effectiveJumpRows);
                    const isJumpBlocked = game.calc_isAreaOccupied(this.pos.x, jumpTargetY, this.width * 0.8, this.height * 0.8, this);
                    if (!isJumpBlocked) {
                        this.advance(moveAmount * effectiveJumpRows);
                        this.bumpOffsetY = -30;
                        game.spawn_createFloatingText(this.pos.x, this.pos.y, 'JUMP!', '#38bdf8');
                        game.spawn_createParticle(this.pos.x, this.pos.y, '#38bdf8', 'mist');
                        // [Glacies 狂暴] 落地后冻结周围 Peg
                        if (this.type === 'boss' && this.bossType === 'glacies' && this._berserkedFreezePegs) {
                            this._glaciesFreezePegsOnLanding(game);
                        }
                    } else {
                        this.bumpOffsetY = -10;
                        if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
                    }
                } else {
                    this.bumpOffsetY = -10;
                    if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
                }
            }
        };
        if (!this.isFrozenCurrentTurn) {
            _doMoveP();
            if (this.affixes.includes('haste')) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, "⚡DASH!", "#facc15");
                _doMoveP();
            }
        }
    }

    /**
     * @method _getBossActionCount
     * @description 根据 Boss 类型返回实际行动次数。
     * @param {number} baseCount - 基础行动次数
     * @returns {number} 最终行动次数
     */
    _getBossActionCount(baseCount) {
        if (!this.bossType) return baseCount;
        const bossConfigs = CONFIG.balance.bossConfigs;
        const bossCfg = bossConfigs ? bossConfigs[this.bossType] : null;

        switch (this.bossType) {
            case 'tesla': {
                // 特斯拉：行动次数 +1（狂暴后再+1）
                const baseBonus = bossCfg ? (bossCfg.hasteActionsBonus || 1) : 1;
                const berserkBonus = this.berserked ? (this._berserkedActionsBonus || 0) : 0;
                return baseCount + baseBonus + berserkBonus;
            }
            case 'glacies': {
                // 格拉西斯：狂暴后行动次数 +1
                const bonus = (this.berserked && this._berserkedJumpRows) ? 1 : 0;
                return baseCount + bonus;
            }
            default:
                return baseCount;
        }
    }

    /**
     * @method _performOuroborosRotation
     * @description 奥罗波罗斯词缀轮转逻辑。
     * 每 N 回合切换一次词缀组。
     * @param {object} game - 游戏实例
     */
    _performOuroborosRotation(game) {
        const bossConfigs = CONFIG.balance.bossConfigs;
        const bossCfg = bossConfigs ? bossConfigs.ouroboros : null;
        if (!bossCfg) return;

        this.rotationTurnCount = (this.rotationTurnCount || 0) + 1;
        const interval = this.berserked
            ? (bossCfg.berserkedRotationInterval || 1)
            : (bossCfg.rotationInterval || 3);

        if (this.rotationTurnCount >= interval) {
            this.rotationTurnCount = 0;
            const sets = bossCfg.rotationSets || [['shield', 'haste']];
            this.rotationIndex = ((this.rotationIndex || 0) + 1) % sets.length;
            this.affixes = [...sets[this.rotationIndex]];

            // 重置护盾层数
            if (this.affixes.includes('shield')) {
                this.shieldCharges = 1 + (game.round || 0);
            } else {
                this.shieldCharges = 0;
            }

            game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, 'ROTATION!', '#a855f7');
            game.spawn_createShockwave(this.pos.x, this.pos.y, '#a855f7');

            // 通过 EventBus 广播轮转事件
            eventBus.emit('boss:rotation', {
                boss: this,
                newAffixes: this.affixes,
                rotationIndex: this.rotationIndex
            });
        }
    }

    /**
     * @method _glaciesFreezePegsOnLanding
     * @description [Glacies 狂暴] 跳跃落地时，冻结周围一定范围内的 Peg，持续 2 回合。
     * @param {object} game - 游戏实例
     */
    _glaciesFreezePegsOnLanding(game) {
        const bossConfigs = CONFIG.balance.bossConfigs;
        const bossCfg = bossConfigs ? bossConfigs.glacies : null;
        const radius = (bossCfg && bossCfg.berserkedFreezePegRadius) ? bossCfg.berserkedFreezePegRadius : 120;
        const FREEZE_TURNS = 2;

        if (!game.pegs || !Array.isArray(game.pegs)) return;

        let frozenCount = 0;
        game.pegs.forEach(peg => {
            if (!peg || typeof peg.pos === 'undefined') return;
            const dx = peg.pos.x - this.pos.x;
            const dy = peg.pos.y - this.pos.y;
            if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                peg.frozenTurns = FREEZE_TURNS;
                frozenCount++;
            }
        });

        if (frozenCount > 0) {
            game.spawn_createShockwave(this.pos.x, this.pos.y, '#38bdf8');
            game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, `❄️FREEZE x${frozenCount}`, '#a5f3fc');
            audio.playEffect('freeze');
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
            // [限制] 冰冻雾气受风属性压制
            game.spawn_pushParticleWithLimit(mist);
        }
        for(let i=0; i<8; i++) {
            const p = new Particle(this.pos.x + (Math.random()-0.5) * this.width, this.pos.y, '#a5f3fc', 'shard');
            // 给予一个向下的初速度，增强撞击感
            p.vel = new Vec2((Math.random()-0.5) * 4, 2 + Math.random() * 3);
            // [限制] 冰冻冰渣受风属性压制
            game.spawn_pushParticleWithLimit(p);
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

        // === A3: 受击 Squash & Stretch 形变 ===
        // 受击瞬间变扁变宽，随后弹性恢复
        if (this._hitImpact > 0.001) {
            const sx = CONFIG.enemyRender.hitImpactScaleX;
            const sy = CONFIG.enemyRender.hitImpactScaleY;
            ctx.scale(1 + this._hitImpact * sx, 1 - this._hitImpact * sy);
        }
        
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

        // === E1: 静态倾斜（一次性预计算的 _staticTilt）===
        if (this._staticTilt !== 0) ctx.rotate(this._staticTilt);
        
        const w = this.width - 4; 
        const h = this.height - 4; 
        const r = 6;

        // === Layer 1: 容器裁剪 ===
        // 根据 collisionShape 选择裁剪路径：polygon 用多边形，arc 用环形，其余用 roundRect
        ctx.beginPath();
        if (this.collisionShape === 'polygon' &&
            this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
            // 多边形路径（顶点为相对中心的本地坐标）—— Boss 和随从均适用
            const verts = this.collisionData.vertices;
            ctx.moveTo(verts[0].x, verts[0].y);
            for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
            ctx.closePath();
        } else if (this.type === 'boss' && this.collisionShape === 'arc' && this.collisionData) {
            // 圆弧路径：绘制环形（外圆 + 内圆）
            const cd = this.collisionData;
            const outerR = cd.radius + cd.thickness * 0.5;
            const innerR = Math.max(0, cd.radius - cd.thickness * 0.5);
            if (cd.endAngle - cd.startAngle >= Math.PI * 1.99) {
                // 完整圆环：外圆顺时针 + 内圆逆时针（形成环形区域）
                ctx.arc(0, 0, outerR, 0, Math.PI * 2, false);
                if (innerR > 0) {
                    ctx.moveTo(innerR, 0);
                    ctx.arc(0, 0, innerR, 0, Math.PI * 2, true);
                }
            } else {
                // 缺口圆弧：用扇形近似（从圆心到弧线两端）
                const sa = cd.startAngle;
                const ea = cd.endAngle;
                ctx.moveTo(Math.cos(sa) * outerR, Math.sin(sa) * outerR);
                ctx.arc(0, 0, outerR, sa, ea, false);
                ctx.lineTo(Math.cos(ea) * innerR, Math.sin(ea) * innerR);
                ctx.arc(0, 0, innerR, ea, sa, true);
                ctx.closePath();
            }
        } else {
            ctx.roundRect(-w/2, -h/2, w, h, r);
        }
        ctx.fillStyle = '#0f172a'; 
        ctx.fill(); 
        ctx.clip();

        // === Layer 1.5: 底层纹理 (预计算 OffscreenCanvas) ===
        if (this._textureCanvas) {
            ctx.drawImage(this._textureCanvas, -w/2, -h/2);
        }

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

        // === Layer 3.5: 内部词缀特效（严格裁剪在方块内，所有词缀统一处理）===
        if (this.affixes.length > 0) {
            const t35 = Date.now() / 1000;
            // 多词缀时各效果透明度衰减，防止视觉过曝
            const affixAlpha35 = this.affixes.length > 3 ? 0.65 : (this.affixes.length > 1 ? 0.8 : 1.0);

            // --- shield: 内壁蜂巢格纹（护盾=防御格栅）浅蓝色六边形网格 ---
            if (this.affixes.includes('shield') && this.shieldCharges > 0) {
                ctx.save();
                const shieldPulse = Math.sin(t35 * 1.2 + (this._spawnColIndex || 0) * 0.4) * 0.15 + 0.35;
                ctx.globalAlpha = shieldPulse * affixAlpha35;
                ctx.strokeStyle = '#93c5fd';
                ctx.lineWidth = 1;
                const hexR = 8;
                const hexW = hexR * Math.sqrt(3);
                const hexH = hexR * 2;
                for (let row = -2; row <= 3; row++) {
                    for (let col = -3; col <= 3; col++) {
                        const hx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2);
                        const hy = row * hexH * 0.75;
                        if (Math.abs(hx) > w / 2 + hexR || Math.abs(hy) > h / 2 + hexR) continue;
                        ctx.beginPath();
                        for (let k = 0; k < 6; k++) {
                            const angle = Math.PI / 180 * (60 * k - 30);
                            const px = hx + hexR * Math.cos(angle);
                            const py = hy + hexR * Math.sin(angle);
                            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                        }
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }

            // --- regen: 从底部向上涌动的绿色液体波纹（回血=液体涌动）---
            if (this.affixes.includes('regen')) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const regenPhase = (t35 * 0.6) % 1;
                for (let wave = 0; wave < 3; wave++) {
                    const wavePhase = (regenPhase + wave / 3) % 1;
                    const waveY = h / 2 - wavePhase * h * 1.2;
                    const waveAlpha = (1 - Math.abs(wavePhase - 0.5) * 2) * 0.35 * affixAlpha35;
                    if (waveAlpha <= 0) continue;
                    const grad = ctx.createLinearGradient(0, waveY - 8, 0, waveY + 8);
                    grad.addColorStop(0, `rgba(74, 222, 128, 0)`);
                    grad.addColorStop(0.5, `rgba(74, 222, 128, ${waveAlpha})`);
                    grad.addColorStop(1, `rgba(74, 222, 128, 0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(-w / 2, waveY - 8, w, 16);
                }
                ctx.restore();
            }

            // --- haste: 横向扫过的速度残影线（极速=运动模糊）金黄色 ---
            if (this.affixes.includes('haste')) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const hastePhase = (t35 * 2.5 + this.visualSeed * 3) % 1;
                const lineAlpha = Math.sin(hastePhase * Math.PI) * 0.5 * affixAlpha35;
                ctx.globalAlpha = lineAlpha;
                const lineY = -h / 2 + hastePhase * h;
                const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
                grad.addColorStop(0, 'rgba(250, 204, 21, 0)');
                grad.addColorStop(0.3, 'rgba(250, 204, 21, 0.9)');
                grad.addColorStop(0.7, 'rgba(250, 204, 21, 0.9)');
                grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(-w / 2, lineY - 1.5, w, 3);
                const phase2 = (hastePhase + 0.4) % 1;
                const lineY2 = -h / 2 + phase2 * h;
                ctx.globalAlpha = Math.sin(phase2 * Math.PI) * 0.3 * affixAlpha35;
                ctx.fillRect(-w / 2, lineY2 - 1, w, 2);
                ctx.restore();
            }

            // --- devour: 从四周向中心收缩的暗红色漩涡（吞噬=向心力）---
            if (this.affixes.includes('devour')) {
                ctx.save();
                ctx.globalCompositeOperation = 'multiply';
                const devourAngle = t35 * 1.8 + this.visualSeed * Math.PI;
                ctx.globalAlpha = 0.55 * affixAlpha35;
                for (let arm = 0; arm < 4; arm++) {
                    const armAngle = devourAngle + arm * Math.PI / 2;
                    const startR = Math.max(w, h) * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(armAngle) * startR, Math.sin(armAngle) * startR);
                    ctx.quadraticCurveTo(
                        Math.cos(armAngle + 0.8) * startR * 0.4,
                        Math.sin(armAngle + 0.8) * startR * 0.4,
                        0, 0
                    );
                    const armGrad = ctx.createLinearGradient(
                        Math.cos(armAngle) * startR, Math.sin(armAngle) * startR, 0, 0
                    );
                    armGrad.addColorStop(0, 'rgba(153, 27, 27, 0)');
                    armGrad.addColorStop(1, 'rgba(220, 38, 38, 0.8)');
                    ctx.strokeStyle = armGrad;
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }
                ctx.restore();
            }

            // --- healer: 十字形脉冲扩散波（治疗=医疗脉冲）粉色，从中心向外 ---
            if (this.affixes.includes('healer')) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const healPhase = (t35 * 0.8 + this.visualSeed) % 1;
                const healAlpha = (1 - healPhase) * 0.5 * affixAlpha35;
                ctx.globalAlpha = healAlpha;
                const crossW = 6 * (1 - healPhase * 0.5);
                const crossGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.6 * healPhase + 1);
                crossGrad.addColorStop(0, 'rgba(244, 114, 182, 0.9)');
                crossGrad.addColorStop(1, 'rgba(244, 114, 182, 0)');
                ctx.fillStyle = crossGrad;
                ctx.fillRect(-crossW / 2, -h / 2, crossW, h);
                ctx.fillRect(-w / 2, -crossW / 2, w, crossW);
                ctx.restore();
            }

            // --- jump: 底部弹力压缩线（跳跃=弹簧压缩）青色，底部区域 ---
            if (this.affixes.includes('jump')) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const jumpBounce = Math.abs(Math.sin(t35 * 1.5 + this.visualSeed * 2));
                const lineCount = 4;
                for (let li = 0; li < lineCount; li++) {
                    const lineProgress = li / lineCount;
                    const lineY = h / 2 - lineProgress * h * 0.28 * (1 - jumpBounce * 0.4);
                    const lineW = w * (1 - lineProgress * 0.4);
                    const lineAlpha2 = (1 - lineProgress) * 0.7 * (jumpBounce * 0.4 + 0.15) * affixAlpha35;
                    ctx.globalAlpha = lineAlpha2;
                    ctx.strokeStyle = '#2dd4bf';
                    ctx.lineWidth = 1.5 - lineProgress * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(-lineW / 2, lineY);
                    ctx.lineTo(lineW / 2, lineY);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // --- clone: 细胞斑点（分身=细胞分裂），增强质感 ---
            if (this.affixes.includes('clone')) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const spotPositions = [
                    { x: -w * 0.28, y: -h * 0.18 },
                    { x:  w * 0.22, y:  h * 0.12 },
                    { x: -w * 0.08, y:  h * 0.28 },
                    { x:  w * 0.32, y: -h * 0.28 },
                    { x:  w * 0.05, y: -h * 0.05 }
                ];
                spotPositions.forEach((sp, i) => {
                    const pulse = Math.sin(t35 * 0.9 + i * 1.3 + this.visualSeed * 6) * 0.3 + 0.7;
                    const baseR = (4 + this.visualSeed * 4 + i * 1.8) * pulse;
                    const driftX = Math.sin(t35 * 0.7 + i * 2.1) * 2;
                    const driftY = Math.cos(t35 * 0.5 + i * 1.7) * 2;
                    const glowGrad = ctx.createRadialGradient(sp.x + driftX, sp.y + driftY, 0, sp.x + driftX, sp.y + driftY, baseR * 2);
                    glowGrad.addColorStop(0, `rgba(192, 132, 252, ${0.35 * affixAlpha35})`);
                    glowGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
                    ctx.fillStyle = glowGrad;
                    ctx.beginPath();
                    ctx.arc(sp.x + driftX, sp.y + driftY, baseR * 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(sp.x + driftX, sp.y + driftY, Math.max(1.5, baseR), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(216, 180, 254, ${0.5 * affixAlpha35})`;
                    ctx.fill();
                });
                ctx.restore();
            }

            // --- berserk: 橙红色燃烧纹路（狂暴=火焰），从底部蔓延 ---
            if (this.affixes.includes('berserk') && this.temp > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const berserkIntensity = Math.min(1, this.temp / 100);
                const berserkPhase = (t35 * 1.5 + this.visualSeed * 2) % 1;
                const flameH = h * (0.3 + berserkIntensity * 0.5);
                const grad = ctx.createLinearGradient(0, h / 2, 0, h / 2 - flameH);
                grad.addColorStop(0, `rgba(239, 68, 68, ${0.6 * berserkIntensity * affixAlpha35})`);
                grad.addColorStop(0.5, `rgba(249, 115, 22, ${0.3 * berserkIntensity * affixAlpha35})`);
                grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(-w / 2, h / 2);
                const steps = 12;
                for (let si = 0; si <= steps; si++) {
                    const sx = -w / 2 + (si / steps) * w;
                    const flameTop = h / 2 - flameH * (0.6 + Math.sin(berserkPhase * Math.PI * 2 + si * 0.8) * 0.4);
                    ctx.lineTo(sx, flameTop);
                }
                ctx.lineTo(w / 2, h / 2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        // === Layer 3.8: Boss 专属装饰 ===
        if (this.type === 'boss' && this.bossType) {
            this._drawBossDecoration(ctx, w, h);
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
        // === A2: 战损裂纹（血量联动，Layer 4 新增）===
        // 血量低于 battleDamageFissureThreshold(30%) 时显示深灰色战损裂纹
        // 强度随血量比例线性变化（血量越低，裂纹越明显）
        {
            const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
            const threshold = CONFIG.enemyRender.battleDamageFissureThreshold;
            if (hpRatio < threshold && this.fissures.length > 0) {
                // 线性插值：hp 从 threshold 降至 0，alpha 从 0 升至 battleDamageFissureMaxAlpha
                const intensity = (threshold - hpRatio) / threshold;
                const alpha = intensity * CONFIG.enemyRender.battleDamageFissureMaxAlpha;
                ctx.save();
                ctx.strokeStyle = `rgba(15, 23, 42, ${alpha})`;
                ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                this.fissures.forEach(path => {
                    if (path.length < 2) return;
                    ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
                    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
                    ctx.stroke();
                });
                ctx.restore();
            }
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
        // === Layer 5: 内部边框 ===
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
        if (this.type === 'elite') { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; }
        if (this.type === 'boss') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; }

        // [新增] 预警时边框闪烁白色
        if (this.actionPhase === 'telegraphing') {
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 15;
        }

        // 根据形状类型选择边框绘制方式：polygon 用多边形，arc 用圆弧，其余用 strokeRect
        if (this.collisionShape === 'polygon' &&
            this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
            // 多边形边框—— Boss 和随从均适用
            ctx.beginPath();
            const verts = this.collisionData.vertices;
            ctx.moveTo(verts[0].x, verts[0].y);
            for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
            ctx.closePath();
            ctx.stroke();
        } else if (this.type === 'boss' && this.collisionShape === 'arc' && this.collisionData) {
            const cd = this.collisionData;
            const outerR = cd.radius + cd.thickness * 0.5;
            const innerR = Math.max(0, cd.radius - cd.thickness * 0.5);
            ctx.beginPath();
            if (cd.endAngle - cd.startAngle >= Math.PI * 1.99) {
                ctx.arc(0, 0, outerR, 0, Math.PI * 2, false);
                ctx.stroke();
                if (innerR > 0) {
                    ctx.beginPath();
                    ctx.arc(0, 0, innerR, 0, Math.PI * 2, false);
                    ctx.stroke();
                }
            } else {
                const sa = cd.startAngle;
                const ea = cd.endAngle;
                ctx.moveTo(Math.cos(sa) * outerR, Math.sin(sa) * outerR);
                ctx.arc(0, 0, outerR, sa, ea, false);
                ctx.lineTo(Math.cos(ea) * innerR, Math.sin(ea) * innerR);
                ctx.arc(0, 0, innerR, ea, sa, true);
                ctx.closePath();
                ctx.stroke();
            }
        } else {
            ctx.strokeRect(-w/2, -h/2, w, h);
        }
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

        // 文字层：保留血量数字显示
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

        // **Viridis 狂暴状态: 绿色脉冲光晕**
        if (this.type === 'boss' && this.bossType === 'viridis' && this.berserked) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            const viridisTime = Date.now() / 1000;
            // 双层脉冲光晕：外层慢脉冲 + 内层快脉冲
            const outerPulse = (Math.sin(viridisTime * 1.8) + 1) * 0.5;  // 慢脉冲
            const innerPulse = (Math.sin(viridisTime * 3.5 + 1.2) + 1) * 0.5; // 快脉冲
            // 外层光晕（大圆，半透明）
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 20 + outerPulse * 15;
            ctx.strokeStyle = `rgba(34, 197, 94, ${0.4 + outerPulse * 0.35})`;
            ctx.lineWidth = 3;
            // 外层光晕：跟随 Boss 形状
            if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                const verts = this.collisionData.vertices;
                ctx.beginPath();
                ctx.moveTo(verts[0].x * 1.08, verts[0].y * 1.08);
                for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x * 1.08, verts[i].y * 1.08);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.beginPath(); ctx.roundRect(-w/2 - 5, -h/2 - 5, w + 10, h + 10, r + 3); ctx.stroke();
            }
            // 内层光晕（小圆，较亮）
            ctx.shadowBlur = 10 + innerPulse * 8;
            ctx.strokeStyle = `rgba(74, 222, 128, ${0.3 + innerPulse * 0.4})`;
            ctx.lineWidth = 1.5;
            if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                const verts = this.collisionData.vertices;
                ctx.beginPath();
                ctx.moveTo(verts[0].x * 1.03, verts[0].y * 1.03);
                for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x * 1.03, verts[i].y * 1.03);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.beginPath(); ctx.roundRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4, r + 1); ctx.stroke();
            }
            ctx.restore();
        }

        // **过热 Stage 4: 炙热发光边框**
        if (this.temp >= 100) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            const pulse = (Math.sin(Date.now() / 200) + 1) * 0.5;
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 15 + pulse * 10;
            ctx.strokeStyle = `rgba(251, 146, 60, ${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 3;
            if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                // 多边形敌人（Boss 或异形随从）：沿多边形轮廓绘制，略微放大
                const verts = this.collisionData.vertices;
                ctx.beginPath();
                ctx.moveTo(verts[0].x * 1.04, verts[0].y * 1.04);
                for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x * 1.04, verts[i].y * 1.04);
                ctx.closePath();
                ctx.stroke();
            } else if (this.collisionShape === 'arc' && this.collisionData) {
                // 圆弧形 Boss：沿外圆弧绘制
                const cd = this.collisionData;
                const outerR = (cd.radius + cd.thickness * 0.5) * 1.05;
                ctx.beginPath();
                ctx.arc(0, 0, outerR, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // 默认 AABB 矩形敌人
                ctx.beginPath(); ctx.roundRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4, r); ctx.stroke();
            }
            ctx.restore();
        }

        // **过冷 Stage 4: 冰封外壳 - [修复：贴合敌人形状绘制]**
        if (this.temp <= -100 || this.isFrozenCurrentTurn) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            
            // 冰的颜色：边框亮白/青，内部半透明
            ctx.strokeStyle = 'rgba(207, 250, 254, 0.9)'; // 亮青白
            ctx.fillStyle = 'rgba(165, 243, 252, 0.25)';  // 内部淡淡的冻结感
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 10;
            ctx.lineJoin = 'bevel';
            ctx.lineWidth = 2;

            if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                // --- 多边形敌人（Boss 或异形随从）：沿多边形轮廓绘制冰壳，略微放大 ---
                const verts = this.collisionData.vertices;
                const scale = 1.06; // 冰壳略大于本体
                ctx.beginPath();
                ctx.moveTo(verts[0].x * scale, verts[0].y * scale);
                for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x * scale, verts[i].y * scale);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // 冰面反光：沿多边形第一条边方向绘制斜光
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(verts[0].x * 0.5, verts[0].y * 0.5);
                ctx.lineTo(verts[1].x * 0.5, verts[1].y * 0.5);
                ctx.stroke();
            } else if (this.collisionShape === 'arc' && this.collisionData) {
                // --- 圆弧形 Boss：沿外圆绘制冰壳 ---
                const cd = this.collisionData;
                const outerR = (cd.radius + cd.thickness * 0.5) * 1.06;
                const innerR = Math.max(0, cd.radius - cd.thickness * 0.5) * 0.94;
                ctx.beginPath();
                ctx.arc(0, 0, outerR, 0, Math.PI * 2, false);
                if (innerR > 0) {
                    ctx.moveTo(innerR, 0);
                    ctx.arc(0, 0, innerR, 0, Math.PI * 2, true);
                }
                ctx.fill();
                ctx.stroke();

                // 冰面反光
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, outerR * 0.85, Math.PI * 1.1, Math.PI * 1.4);
                ctx.stroke();
            } else {
                // --- 默认 AABB 矩形敌人：切角冰块多边形 ---
                const borderW = w + 8;
                const borderH = h + 8;
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

                // 冰面反光
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-w/4, -h/2);
                ctx.lineTo(-w/2, -h/4);
                ctx.moveTo(w/4, h/2);
                ctx.lineTo(w/2, h/4);
                ctx.stroke();
            }

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

        // === Layer 6.5: Boss 专属视觉特效 (Devourer & Ouroboros) ===

        // **Devourer 噬神者: 漏斗缺口状态动画**
        if (this.type === 'boss' && this.bossType === 'devourer' && this.collisionShape === 'arc') {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            const devTime = Date.now() / 1000;
            const devRadius = this.collisionData ? this.collisionData.radius : (this.width * 0.35);
            const devThickness = this.collisionData ? this.collisionData.thickness : (this.height * 0.15);
            const devState = this.devourState || 'IDLE';
            const devTimer = this.devourTimer || 0;

            if (devState === 'IDLE') {
                // IDLE: 漏斗缺口闭合，绘制深色凹陷区域
                ctx.save();
                ctx.globalAlpha = 0.7;
                const idleGrad = ctx.createRadialGradient(0, 0, devRadius * 0.3, 0, 0, devRadius * 0.8);
                idleGrad.addColorStop(0, 'rgba(15, 5, 30, 0.9)');
                idleGrad.addColorStop(0.6, 'rgba(40, 10, 60, 0.5)');
                idleGrad.addColorStop(1, 'rgba(60, 20, 80, 0)');
                ctx.fillStyle = idleGrad;
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * 0.75, 0, Math.PI * 2);
                ctx.fill();
                // 绘制闭合缺口的深色封印线
                ctx.strokeStyle = 'rgba(80, 20, 120, 0.6)';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#4b0082';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(-devRadius * 0.3, -devRadius * 0.1);
                ctx.lineTo(0, devRadius * 0.15);
                ctx.lineTo(devRadius * 0.3, -devRadius * 0.1);
                ctx.stroke();
                ctx.restore();

            } else if (devState === 'OPENING') {
                // OPENING: 缺口逐渐扩张，周围出现引力粒子
                // devourTimer 在 OPENING 状态下为 0（立即转 DEVOURING），用时间做动画
                const openPulse = (Math.sin(devTime * 8) + 1) * 0.5;
                const openAngle = Math.PI * 0.25 + openPulse * Math.PI * 0.15; // 缺口角度扩张

                ctx.save();
                // 绘制扩张中的缺口弧形
                ctx.strokeStyle = `rgba(138, 43, 226, ${0.5 + openPulse * 0.4})`;
                ctx.lineWidth = devThickness * 0.6;
                ctx.shadowColor = '#8b00ff';
                ctx.shadowBlur = 15 + openPulse * 10;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(0, 0, devRadius, openAngle, Math.PI * 2 - openAngle);
                ctx.stroke();
                // 缺口处的扭曲光晕
                const gapGrad = ctx.createRadialGradient(0, devRadius * 0.1, 0, 0, devRadius * 0.1, devRadius * 0.5);
                gapGrad.addColorStop(0, `rgba(75, 0, 130, ${0.6 + openPulse * 0.3})`);
                gapGrad.addColorStop(1, 'rgba(75, 0, 130, 0)');
                ctx.fillStyle = gapGrad;
                ctx.beginPath();
                ctx.arc(0, devRadius * 0.1, devRadius * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 引力粒子（每帧随机生成）
                if (typeof game !== 'undefined' && Math.random() < 0.4) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = devRadius * (1.2 + Math.random() * 0.8);
                    const px = this.pos.x + Math.cos(angle) * dist;
                    const py = this.pos.y + this.bumpOffsetY + Math.sin(angle) * dist;
                    const gravP = new Particle(px, py, '#9333ea', 'spark');
                    gravP.vel.x = (this.pos.x - px) * 0.08;
                    gravP.vel.y = (this.pos.y + this.bumpOffsetY - py) * 0.08;
                    gravP.drag = 0.95;
                    gravP.gravity = 0;
                    gravP.decay = 0.04;
                    gravP.size = Math.random() * 2 + 1;
                    game.spawn_pushParticleWithLimit(gravP);
                }

            } else if (devState === 'DEVOURING') {
                // DEVOURING: 全口张开，绘制紫黑色光芒 + 吸入粒子特效
                const devourPulse = (Math.sin(devTime * 12) + 1) * 0.5;

                ctx.save();
                // 外层紫黑色 radialGradient 光芒
                const devourGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, devRadius * 1.4);
                devourGrad.addColorStop(0, `rgba(20, 0, 40, ${0.9 + devourPulse * 0.1})`);
                devourGrad.addColorStop(0.3, `rgba(75, 0, 130, ${0.7 + devourPulse * 0.2})`);
                devourGrad.addColorStop(0.7, `rgba(139, 0, 139, ${0.3 + devourPulse * 0.3})`);
                devourGrad.addColorStop(1, 'rgba(75, 0, 130, 0)');
                ctx.fillStyle = devourGrad;
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * 1.4, 0, Math.PI * 2);
                ctx.fill();

                // 内层深渊核心
                const voidGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, devRadius * 0.5);
                voidGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                voidGrad.addColorStop(0.5, 'rgba(20, 0, 40, 0.9)');
                voidGrad.addColorStop(1, 'rgba(75, 0, 130, 0)');
                ctx.fillStyle = voidGrad;
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * 0.5, 0, Math.PI * 2);
                ctx.fill();

                // 脉冲光环
                ctx.strokeStyle = `rgba(180, 0, 255, ${0.6 + devourPulse * 0.4})`;
                ctx.lineWidth = 3 + devourPulse * 3;
                ctx.shadowColor = '#9400d3';
                ctx.shadowBlur = 25 + devourPulse * 20;
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * (0.9 + devourPulse * 0.1), 0, Math.PI * 2);
                ctx.stroke();

                // 旋转能量线
                const lineCount = 6;
                for (let li = 0; li < lineCount; li++) {
                    const lineAngle = devTime * 3 + (li / lineCount) * Math.PI * 2;
                    const lineGrad = ctx.createLinearGradient(
                        Math.cos(lineAngle) * devRadius * 1.2, Math.sin(lineAngle) * devRadius * 1.2,
                        0, 0
                    );
                    lineGrad.addColorStop(0, 'rgba(139, 0, 139, 0)');
                    lineGrad.addColorStop(1, `rgba(200, 0, 255, ${0.5 + devourPulse * 0.3})`);
                    ctx.strokeStyle = lineGrad;
                    ctx.lineWidth = 1.5;
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(lineAngle) * devRadius * 1.2, Math.sin(lineAngle) * devRadius * 1.2);
                    ctx.lineTo(0, 0);
                    ctx.stroke();
                }
                ctx.restore();

                // 吸入粒子特效（高密度）
                if (typeof game !== 'undefined' && Math.random() < 0.7) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = devRadius * (1.5 + Math.random() * 1.0);
                    const px = this.pos.x + Math.cos(angle) * dist;
                    const py = this.pos.y + this.bumpOffsetY + Math.sin(angle) * dist;
                    const suckP = new Particle(px, py, Math.random() < 0.5 ? '#9333ea' : '#c084fc', 'spark');
                    suckP.vel.x = (this.pos.x - px) * 0.12;
                    suckP.vel.y = (this.pos.y + this.bumpOffsetY - py) * 0.12;
                    suckP.drag = 0.93;
                    suckP.gravity = 0;
                    suckP.decay = 0.035;
                    suckP.size = Math.random() * 3 + 1;
                    game.spawn_pushParticleWithLimit(suckP);
                }
                // 额外的暗色烟雾粒子
                if (typeof game !== 'undefined' && Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = devRadius * (0.6 + Math.random() * 0.4);
                    const px = this.pos.x + Math.cos(angle) * dist;
                    const py = this.pos.y + this.bumpOffsetY + Math.sin(angle) * dist;
                    const smokeP = new Particle(px, py, '#4b0082', 'mist');
                    smokeP.vel.x = (this.pos.x - px) * 0.05;
                    smokeP.vel.y = (this.pos.y + this.bumpOffsetY - py) * 0.05;
                    smokeP.drag = 0.97;
                    smokeP.gravity = -0.01;
                    smokeP.decay = 0.02;
                    smokeP.size = Math.random() * 10 + 6;
                    game.spawn_pushParticleWithLimit(smokeP);
                }

            } else if (devState === 'COOLDOWN') {
                // COOLDOWN: 缺口闭合，绘制红色警示光晕
                const coolPulse = (Math.sin(devTime * 6) + 1) * 0.5;

                ctx.save();
                // 红色警示光晕（外层）
                const coolGrad = ctx.createRadialGradient(0, 0, devRadius * 0.4, 0, 0, devRadius * 1.2);
                coolGrad.addColorStop(0, 'rgba(220, 20, 60, 0)');
                coolGrad.addColorStop(0.5, `rgba(220, 20, 60, ${0.2 + coolPulse * 0.3})`);
                coolGrad.addColorStop(1, 'rgba(220, 20, 60, 0)');
                ctx.fillStyle = coolGrad;
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * 1.2, 0, Math.PI * 2);
                ctx.fill();

                // 警示脉冲环
                ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + coolPulse * 0.5})`;
                ctx.lineWidth = 2 + coolPulse * 2;
                ctx.shadowColor = '#ff1a1a';
                ctx.shadowBlur = 12 + coolPulse * 15;
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * (0.85 + coolPulse * 0.1), 0, Math.PI * 2);
                ctx.stroke();

                // 闭合弧形（表示缺口正在收缩）
                ctx.strokeStyle = `rgba(255, 100, 100, ${0.4 + coolPulse * 0.3})`;
                ctx.lineWidth = devThickness * 0.5;
                ctx.lineCap = 'round';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(0, 0, devRadius, Math.PI * 0.15, Math.PI * 1.85);
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();
        }

        // **Ouroboros 永恒回声: 旋转环形缺口 + 狂暴残影 + 缺口核心**
        if (this.type === 'boss' && this.bossType === 'ouroboros' && this.collisionShape === 'arc') {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            const ouroTime = Date.now() / 1000;
            const ouroRadius = this.collisionData ? this.collisionData.radius : (this.width * 0.4);
            const ouroThickness = this.collisionData ? this.collisionData.thickness : (this.height * 0.2);
            const gapAngle = this.gapAngle || 0;
            const gapSize = Math.PI * 0.5; // 缺口角度（90度）
            const arcStart = gapAngle + gapSize; // 实体弧起始角
            const arcEnd = gapAngle + Math.PI * 2; // 实体弧结束角（绕回缺口前）
            const isBerserk = (this.hp / this.maxHp) < 0.5;
            const ringPulse = (Math.sin(ouroTime * (isBerserk ? 4 : 2)) + 1) * 0.5;

            // --- 1. 绘制旋转残影（狂暴时多层半透明历史弧）---
            if (isBerserk) {
                const trailCount = 5;
                for (let ti = 0; ti < trailCount; ti++) {
                    const trailOffset = (ti + 1) * (Math.PI * 0.12); // 每层残影偏移角度
                    const trailAlpha = (1 - (ti + 1) / (trailCount + 1)) * 0.35;
                    const trailStart = arcStart - trailOffset;
                    const trailEnd = arcEnd - trailOffset;

                    ctx.save();
                    ctx.globalAlpha = trailAlpha;
                    ctx.strokeStyle = '#a855f7'; // 紫色残影
                    ctx.lineWidth = ouroThickness * 0.7;
                    ctx.lineCap = 'butt';
                    ctx.shadowColor = '#7c3aed';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(0, 0, ouroRadius, trailStart, trailEnd);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // --- 2. 绘制主环形实体（带缺口）---
            ctx.save();
            // 主环颜色：狂暴时更亮更紫
            const ringColor = isBerserk ? '#c084fc' : '#818cf8';
            const ringGlowColor = isBerserk ? '#9333ea' : '#6366f1';
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = ouroThickness;
            ctx.lineCap = 'butt';
            ctx.shadowColor = ringGlowColor;
            ctx.shadowBlur = 12 + ringPulse * 10;
            ctx.globalAlpha = 0.85 + ringPulse * 0.15;
            ctx.beginPath();
            ctx.arc(0, 0, ouroRadius, arcStart, arcEnd);
            ctx.stroke();

            // 内层高光
            ctx.strokeStyle = isBerserk ? 'rgba(233, 213, 255, 0.5)' : 'rgba(199, 210, 254, 0.35)';
            ctx.lineWidth = ouroThickness * 0.3;
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.arc(0, 0, ouroRadius - ouroThickness * 0.15, arcStart, arcEnd);
            ctx.stroke();
            ctx.restore();

            // --- 3. 缺口处绘制发光核心（攻击目标提示）---
            // 缺口中心角度
            const gapCenterAngle = gapAngle + gapSize * 0.5;
            const coreX = Math.cos(gapCenterAngle) * ouroRadius;
            const coreY = Math.sin(gapCenterAngle) * ouroRadius;
            const corePulse = (Math.sin(ouroTime * (isBerserk ? 8 : 4)) + 1) * 0.5;
            const coreRadius = ouroThickness * (0.5 + corePulse * 0.3);

            ctx.save();
            // 核心发光球
            const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreRadius * 2);
            coreGrad.addColorStop(0, isBerserk ? 'rgba(255, 200, 255, 1)' : 'rgba(200, 220, 255, 1)');
            coreGrad.addColorStop(0.3, isBerserk ? 'rgba(200, 50, 255, 0.9)' : 'rgba(100, 130, 255, 0.8)');
            coreGrad.addColorStop(1, 'rgba(100, 50, 200, 0)');
            ctx.fillStyle = coreGrad;
            ctx.shadowColor = isBerserk ? '#ff00ff' : '#818cf8';
            ctx.shadowBlur = 15 + corePulse * 15;
            ctx.beginPath();
            ctx.arc(coreX, coreY, coreRadius * 2, 0, Math.PI * 2);
            ctx.fill();

            // 核心闪烁光点
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(coreX, coreY, coreRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // 狂暴时核心周围添加旋转光环
            if (isBerserk) {
                ctx.strokeStyle = `rgba(255, 100, 255, ${0.4 + corePulse * 0.5})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#ff00ff';
                ctx.shadowBlur = 10;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(coreX, coreY, coreRadius * 2.5, ouroTime * 3, ouroTime * 3 + Math.PI * 1.5);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();

            // --- 4. 缺口两端的能量断口特效 ---
            const endAngles = [arcStart, arcEnd];
            endAngles.forEach(endAngle => {
                const ex = Math.cos(endAngle) * ouroRadius;
                const ey = Math.sin(endAngle) * ouroRadius;
                const endGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, ouroThickness * 0.8);
                endGrad.addColorStop(0, isBerserk ? 'rgba(255, 150, 255, 0.8)' : 'rgba(150, 180, 255, 0.7)');
                endGrad.addColorStop(1, 'rgba(100, 50, 200, 0)');
                ctx.fillStyle = endGrad;
                ctx.shadowColor = isBerserk ? '#cc00cc' : '#6366f1';
                ctx.shadowBlur = 10 + ringPulse * 8;
                ctx.beginPath();
                ctx.arc(ex, ey, ouroThickness * 0.8, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
        }

        // === Layer 8: Boss 入场动画特效 ===
        if (this.type === 'boss' && this.entranceTimer > 0) {
            const t = this.entranceTimer;

            // —— 阶段 2 (60→30): 落地冲击波 + 红色光圈扩散 ——
            if (t <= 60 && t > 30) {
                const progress = (60 - t) / 30; // 0→1
                ctx.save();
                ctx.translate(this.pos.x, this.pos.y);

                // 1. 冲击波圈：从 Boss 中心向外扩散
                const maxRadius = this.width * 2.5;
                const waveRadius = maxRadius * progress;
                const waveAlpha = (1 - progress) * 0.8;
                ctx.beginPath();
                ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(239, 68, 68, ${waveAlpha})`;
                ctx.lineWidth = 4 * (1 - progress);
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 20;
                ctx.stroke();

                // 2. 第二圈（延迟半圈）
                if (progress > 0.2) {
                    const wave2Progress = (progress - 0.2) / 0.8;
                    const wave2Radius = maxRadius * 0.6 * wave2Progress;
                    const wave2Alpha = (1 - wave2Progress) * 0.6;
                    ctx.beginPath();
                    ctx.arc(0, 0, wave2Radius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(251, 191, 36, ${wave2Alpha})`;
                    ctx.lineWidth = 3 * (1 - wave2Progress);
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = 15;
                    ctx.stroke();
                }

                // 3. 地面裂纹辐射线（从中心向外放射）
                const crackCount = 8;
                ctx.save();
                ctx.globalAlpha = (1 - progress) * 0.7;
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 8;
                for (let i = 0; i < crackCount; i++) {
                    const angle = (i / crackCount) * Math.PI * 2 + this.visualSeed * Math.PI;
                    const crackLen = (this.width * 0.8 + waveRadius * 0.4) * (0.6 + this.visualSeed * 0.4);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    // 折线裂纹
                    const midX = Math.cos(angle + 0.15) * crackLen * 0.5;
                    const midY = Math.sin(angle + 0.15) * crackLen * 0.5;
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(Math.cos(angle) * crackLen, Math.sin(angle) * crackLen);
                    ctx.stroke();
                }
                ctx.restore();

                ctx.restore();
            }

            // —— 阶段 3 (30→0): Boss 名称文字放大淡出 ——
            if (t <= 30 && t > 0 && this.bossName) {
                const progress = (30 - t) / 30; // 0→1
                const textAlpha = 1 - progress;
                const textScale = 1.0 + progress * 0.8; // 从 1.0 放大到 1.8

                ctx.save();
                ctx.translate(this.pos.x, this.pos.y);
                ctx.scale(textScale, textScale);
                ctx.globalAlpha = textAlpha;

                // 文字外发光
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 20 * textAlpha;

                // 大字标题
                ctx.font = `bold ${Math.floor(this.width * 0.22)}px 'Cinzel', serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
                ctx.fillText(this.bossName, 0, 0);

                // 底部小字
                ctx.font = `bold ${Math.floor(this.width * 0.12)}px monospace`;
                ctx.fillStyle = `rgba(239, 68, 68, ${textAlpha})`;
                ctx.fillText(this.isBigBoss ? '\u2620 BOSS' : '\u2620 MINI-BOSS', 0, this.height * 0.22);

                ctx.restore();
            }

            // —— 全程光晕边框脉冲（入场期间 Boss 边框强化闪烁） ——
            const pulseAlpha = t > 60
                ? (90 - t) / 30 * 0.9          // 阶段 1：淡入
                : t > 30
                ? 0.9                            // 阶段 2：持续强亮
                : (t / 30) * 0.9;               // 阶段 3：淡出
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            const flashPulse = Math.sin(Date.now() / 60) * 0.3 + 0.7;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 30 * pulseAlpha * flashPulse;
            ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha * flashPulse})`;
            ctx.lineWidth = 5;
            // 入场动画边框跟随 Boss 形状
            if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                const verts = this.collisionData.vertices;
                ctx.beginPath();
                ctx.moveTo(verts[0].x * 1.06, verts[0].y * 1.06);
                for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x * 1.06, verts[i].y * 1.06);
                ctx.closePath();
                ctx.stroke();
            } else if (this.collisionShape === 'arc' && this.collisionData) {
                const cd = this.collisionData;
                const outerR = (cd.radius + cd.thickness * 0.5) * 1.08;
                const innerR = Math.max(0, cd.radius - cd.thickness * 0.5) * 0.92;
                ctx.beginPath();
                ctx.arc(0, 0, outerR, 0, Math.PI * 2);
                ctx.stroke();
                if (innerR > 0) {
                    ctx.beginPath();
                    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } else {
                ctx.beginPath();
                ctx.roundRect(-w/2 - 3, -h/2 - 3, w + 6, h + 6, r + 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // === Layer 9: Boss 移动提示标签 ===
        // 仅对 Boss 类型敌人且入场动画完成后显示
        if (this.type === 'boss' && this.bossType && this.entranceTimer <= 0 &&
            typeof this._moveCooldown !== 'undefined') {

            const now = Date.now();
            const pulse = (Math.sin(now / 400) + 1) * 0.5; // 0~1 脉冲动画

            // 标签显示在 Boss 底部下方
            const labelX = this.pos.x;
            const labelY = this.pos.y + this.bumpOffsetY + this.height / 2 + 22;

            ctx.save();

            if (this.berserked) {
                // 狂暴模式：每回合移动，显示橙红警告
                const alpha = 0.75 + pulse * 0.25;
                const bgColor = `rgba(239, 68, 68, ${0.25 + pulse * 0.15})`;
                const textColor = `rgba(255, 200, 100, ${alpha})`;
                const glowColor = '#ef4444';

                // 背景圆角矩形
                const labelW = 110;
                const labelH = 18;
                ctx.fillStyle = bgColor;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 8 + pulse * 6;
                ctx.beginPath();
                ctx.roundRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH, 4);
                ctx.fill();

                // 文字
                ctx.shadowBlur = 6 + pulse * 4;
                ctx.shadowColor = glowColor;
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = textColor;
                ctx.fillText('⚡ 狂暴：每回合移动', labelX, labelY);

            } else if (this._willMoveThisTurn === true) {
                // 本回合移动（回合开始时预计算）：红色警告
                const alpha = 0.85 + pulse * 0.15;
                const bgColor = `rgba(220, 38, 38, ${0.3 + pulse * 0.2})`;
                const textColor = `rgba(255, 220, 220, ${alpha})`;
                const glowColor = '#dc2626';

                const labelW = 100;
                const labelH = 18;
                ctx.fillStyle = bgColor;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 10 + pulse * 8;
                ctx.beginPath();
                ctx.roundRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH, 4);
                ctx.fill();

                ctx.shadowBlur = 8 + pulse * 6;
                ctx.shadowColor = glowColor;
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = textColor;
                ctx.fillText('➡ 本回合移动', labelX, labelY);

            } else {
                // 还需 N 回合才移动：蓝色提示
                // 使用 _moveCooldown 显示剩余回合数
                const alpha = 0.6 + pulse * 0.15;
                const bgColor = `rgba(30, 64, 175, ${0.2 + pulse * 0.1})`;
                const textColor = `rgba(147, 197, 253, ${alpha})`;
                const glowColor = '#3b82f6';

                // 回合开始前：_moveCooldown 还未被消耗，直接显示其值
                // 回合结束后：_moveCooldown 已被重置，显示新的剩余回合数
                const turnsLeft = this._moveCooldown;
                const labelText = turnsLeft === 1 ? '⏳ 下回合移动' : `⏳ ${turnsLeft}回合后移动`;
                const labelW = turnsLeft === 1 ? 100 : 110;
                const labelH = 18;

                ctx.fillStyle = bgColor;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 5 + pulse * 3;
                ctx.beginPath();
                ctx.roundRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH, 4);
                ctx.fill();

                ctx.shadowBlur = 4 + pulse * 2;
                ctx.shadowColor = glowColor;
                ctx.font = '11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = textColor;
                ctx.fillText(labelText, labelX, labelY);
            }

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
    takeDamage(amount, source = null, bypassShield = false) {
        let actualDamage = amount;
        
        // 1. 计算护盾逻辑 (优化版)
        if (this.affixes.includes('shield') && !bypassShield) {
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
        
        // 2. [Mikro联动] 分身减伤：Mikro 母体受击时，根据场上存活分身数量减少伤害
        if (this.type === 'boss' && this.bossType === 'mikro' && typeof game !== 'undefined') {
            const mikroCfg = CONFIG.balance.bossConfigs && CONFIG.balance.bossConfigs.mikro;
            const reductionPerClone = mikroCfg ? mikroCfg.cloneDamageReductionPerClone : 0.10;
            const reductionMax = mikroCfg ? mikroCfg.cloneDamageReductionMax : 0.50;
            // 统计场上存活的 clone 分身数量
            const cloneCount = game.enemies.filter(e => e.active && e.isClone).length;
            if (cloneCount > 0) {
                const damageReduction = Math.min(cloneCount * reductionPerClone, reductionMax);
                actualDamage *= (1 - damageReduction);
                // 显示减伤视觉反馈（限制频率）
                if (!this._cloneReductionTimer || this._cloneReductionTimer <= 0) {
                    this._cloneReductionTimer = 8; // 8帧内不重复显示
                    const pct = Math.round(damageReduction * 100);
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 35, `🧬-${pct}%`, '#c084fc');
                } else {
                    this._cloneReductionTimer--;
                }
            }
        }

        // 3. 计算冰冻易伤
        if (this.temp < 0) {
            // 冰冻增加伤害 (根据温度线性增加)
            actualDamage *= (1 + Math.abs(this.temp) * 0.005);
            
            // 记录冰冻额外伤害视觉反馈
            if (typeof game !== 'undefined' && actualDamage > amount) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 30, `+${Math.ceil(actualDamage - amount)}`, '#06b6d4');
            }
        }

        // 3b. [技能系统迭代] 冰牢封印技能的冻结期伤害加成
        if (this._frostPrisonAmp && this._frostPrisonAmp > 0 && (this.temp <= -100 || (this.frozenTurns && this.frozenTurns > 0))) {
            const beforeAmp = actualDamage;
            actualDamage *= (1 + this._frostPrisonAmp);
            if (typeof game !== 'undefined') {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 45, `❄️+${Math.round(this._frostPrisonAmp * 100)}%`, '#67e8f9');
            }
        }

          // 4. 执行扣血
        this.hp -= actualDamage; 
        this.hitTimer = 10; 
        this.whiteBarTimer = 45;
        // === A3: 记录受击形变强度 ===
        if (this.maxHp > 0) {
            const impact = actualDamage / this.maxHp;
            this._hitImpact = Math.min(CONFIG.enemyRender.hitImpactMax,
                (this._hitImpact || 0) + impact);
        } 
        if (typeof game !== 'undefined') {
            game.combat_reportDamage(actualDamage);
            
            // --- [新增] Chimera 狂暴受击全场爆炸逻辑 ---
            if (this.type === 'boss' && this.bossType === 'chimera' && this.berserked && this._berserkedBlastOnHitChance) {
                if (Math.random() < this._berserkedBlastOnHitChance) {
                    // 视觉反馈：冲击波和粒子
                    game.spawn_createShockwave(this.pos.x, this.pos.y, '#f97316'); // 橙色冲击波
                    for (let i = 0; i < 20; i++) {
                        game.spawn_createParticle(this.pos.x, this.pos.y, Math.random() > 0.5 ? '#ef4444' : '#f97316', 'ember');
                    }
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 60, '💥CHAOS BLAST!', '#f97316');
                    
                    // 逻辑反馈：随机禁用 3 个钉子持续 1 回合
                    if (game.pegs && game.pegs.length > 0) {
                        // 过滤出未被禁用的正常钉子
                        const activePegs = game.pegs.filter(p => p.cooldownTimer <= 0);
                        // 随机打乱并取前 3 个
                        activePegs.sort(() => Math.random() - 0.5);
                        const pegsToDisable = activePegs.slice(0, 3);
                        
                        pegsToDisable.forEach(peg => {
                            // 设置高额冷却时间，使其在本回合内无法被触发
                            peg.cooldownTimer = 1000; // 足够长的时间，或者可以考虑其他状态标志
                            peg.scale = 0.5; // 视觉上变小
                            game.spawn_createFloatingText(peg.pos.x, peg.pos.y, '🚫', '#ef4444');
                        });
                    }
                }
            }
            // ----------------------------------------

            // --- [B1] 词缀差异化受击粒子 ---
            // 根据主导词缀（affixes[0] 或优先级最高）选择不同粒子组合，增强打击感
            if (this.affixes && this.affixes.length > 0) {
                // 优先级：berserk > shield/haste > regen/clone/devour > jump
                const dominantAffix = (() => {
                    const priority = ['berserk', 'shield', 'haste', 'regen', 'clone', 'devour', 'jump'];
                    for (const a of priority) {
                        if (this.affixes.includes(a)) return a;
                    }
                    return this.affixes[0];
                })();

                if (dominantAffix === 'shield' || dominantAffix === 'haste') {
                    // 机械类：深色 smoke + 亮白 spark，模拟金属装甲破裂
                    const smokeCount = 2 + Math.floor(Math.random() * 2); // 2~3
                    for (let i = 0; i < smokeCount; i++) {
                        const sp = new Particle(
                            this.pos.x + (Math.random() - 0.5) * this.width * 0.8,
                            this.pos.y + (Math.random() - 0.5) * this.height * 0.5,
                            'rgba(30,30,30,0.7)', 'smoke'
                        );
                        sp.vel.y = -1.2 - Math.random() * 0.8;
                        sp.size = this.width * 0.2 + Math.random() * 4;
                        game.spawn_pushParticleWithLimit(sp);
                    }
                    const sparkCount = 3 + Math.floor(Math.random() * 2); // 3~4
                    for (let i = 0; i < sparkCount; i++) {
                        game.spawn_createParticle(
                            this.pos.x + (Math.random() - 0.5) * this.width * 0.6,
                            this.pos.y + (Math.random() - 0.5) * this.height * 0.5,
                            '#f8fafc', 'spark'
                        );
                    }
                } else if (dominantAffix === 'regen' || dominantAffix === 'clone' || dominantAffix === 'devour') {
                    // 生物类：暗红/紫色 mist，带向下重力感
                    const mistCount = 2 + Math.floor(Math.random() * 2); // 2~3
                    const bioColors = { regen: '#dc2626', clone: '#c084fc', devour: '#dc2626' };
                    const mistColor = bioColors[dominantAffix] || '#dc2626';
                    for (let i = 0; i < mistCount; i++) {
                        const bm = new Particle(
                            this.pos.x + (Math.random() - 0.5) * this.width * 0.7,
                            this.pos.y + (Math.random() - 0.5) * this.height * 0.4,
                            mistColor, 'mist'
                        );
                        bm.vel.y = 0.8 + Math.random() * 0.8; // 向下重力感
                        bm.vel.x = (Math.random() - 0.5) * 0.6;
                        bm.size = this.width * 0.25 + Math.random() * 4;
                        game.spawn_pushParticleWithLimit(bm);
                    }
                } else if (dominantAffix === 'jump' || this.bossType === 'glacies') {
                    // 冰系/跳跃：#a5f3fc shard，向四周散射
                    const shardCount = 4 + Math.floor(Math.random() * 3); // 4~6
                    for (let i = 0; i < shardCount; i++) {
                        const angle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.5;
                        const speed = 2.5 + Math.random() * 2.5;
                        const sh = new Particle(
                            this.pos.x + (Math.random() - 0.5) * this.width * 0.5,
                            this.pos.y + (Math.random() - 0.5) * this.height * 0.4,
                            '#a5f3fc', 'shard'
                        );
                        sh.vel.x = Math.cos(angle) * speed;
                        sh.vel.y = Math.sin(angle) * speed;
                        game.spawn_pushParticleWithLimit(sh);
                    }
                } else if (dominantAffix === 'berserk') {
                    // 狂暴：橙红 ember + 小型 smoke
                    const emberCount = 3 + Math.floor(Math.random() * 2); // 3~4
                    for (let i = 0; i < emberCount; i++) {
                        game.spawn_createParticle(
                            this.pos.x + (Math.random() - 0.5) * this.width * 0.7,
                            this.pos.y + (Math.random() - 0.5) * this.height * 0.5,
                            '#f97316', 'ember'
                        );
                    }
                    // 1 个小型 smoke
                    const bs = new Particle(
                        this.pos.x + (Math.random() - 0.5) * this.width * 0.4,
                        this.pos.y - this.height * 0.3,
                        'rgba(40,20,0,0.6)', 'smoke'
                    );
                    bs.size = this.width * 0.15 + 2;
                    game.spawn_pushParticleWithLimit(bs);
                }
            }
            // --- [B1 END] ---
        }
        // 5. 返回详细结果
        const killed = this.hp <= 0;
        if (killed) {
            this.active = false;

            // --- [B2] Boss 专属死亡爆炸粒子 ---
            if (this.type === 'boss' && this.bossType && typeof game !== 'undefined') {
                // Boss 颜色映射（与 spawn_system.js 保持一致）
                const BOSS_DEATH_COLORS = {
                    ignis:    '#f97316',
                    glacies:  '#06b6d4',
                    mikro:    '#c084fc',
                    devourer: '#22c55e',
                    viridis:  '#34d399',
                    tesla:    '#60a5fa',
                    chimera:  '#ef4444',
                    ouroboros:'#facc15',
                };
                const deathColor = BOSS_DEATH_COLORS[this.bossType] || '#ffffff';

                // 15~20 个随机方向 spark
                const sparkCount = 15 + Math.floor(Math.random() * 6);
                for (let i = 0; i < sparkCount; i++) {
                    game.spawn_createParticle(
                        this.pos.x + (Math.random() - 0.5) * this.width,
                        this.pos.y + (Math.random() - 0.5) * this.height,
                        deathColor, 'spark'
                    );
                }

                // 3~5 个大型 mist（size = width * 0.8）
                const mistCount = 3 + Math.floor(Math.random() * 3);
                for (let i = 0; i < mistCount; i++) {
                    const dm = new Particle(
                        this.pos.x + (Math.random() - 0.5) * this.width * 0.6,
                        this.pos.y + (Math.random() - 0.5) * this.height * 0.5,
                        deathColor, 'mist'
                    );
                    dm.size = this.width * 0.8;
                    dm.vel.x = (Math.random() - 0.5) * 1.5;
                    dm.vel.y = (Math.random() - 0.5) * 1.5;
                    game.spawn_pushParticleWithLimit(dm);
                }

                // 第一次冲击波（立即）
                game.spawn_createShockwave(this.pos.x, this.pos.y, deathColor);

                // 第二次冲击波（延迟约 8 帧 ≈ 133ms）
                const _bossX = this.pos.x;
                const _bossY = this.pos.y;
                const _deathColor = deathColor;
                setTimeout(() => {
                    if (typeof game !== 'undefined' && typeof game.spawn_createShockwave === 'function') {
                        game.spawn_createShockwave(_bossX, _bossY, _deathColor);
                    }
                }, 133);
            }
            // --- [B2 END] ---
        }

        return { 
            killed: killed, 
            actualDamage: actualDamage 
        };
    }
    applyTemp(amount) {
        if (amount < 0) {
            // [温度衰减机制] 每被冰冻一次，降温效果额外乘以 0.9，叠加计算（冰冻 n 次后系数为 0.9^n）
            const decayFactor = Math.pow(0.9, this.frozenCount);
            this.temp += amount * decayFactor;
        } else {
            this.temp += amount;
        }
    }
    getBounds() { return { left: this.pos.x - this.width/2, right: this.pos.x + this.width/2, top: this.pos.y - this.height/2, bottom: this.pos.y + this.height/2 }; }

    /**
     * 绘制 Boss 专属装饰（Layer 3.8）
     * 每个 Boss 根据其 bossType 绘制独特的内部装饰
     * @param {CanvasRenderingContext2D} ctx - 画布上下文（已经 translate 到 Boss 中心）
     * @param {number} w - Boss 宽度（已减去边距）
     * @param {number} h - Boss 高度（已减去边距）
     */
    _drawBossDecoration(ctx, w, h) {
        const t = Date.now() / 1000;
        const isBerserk = this.berserked || (this.hp / this.maxHp) < 0.5;

        switch (this.bossType) {
            case 'ignis': {
                // === Ignis: 燕火之心 + 火星喷射 ===
                const heartPulse = Math.sin(t * (isBerserk ? 5 : 2.5)) * 0.25 + 0.75;
                const heartR = Math.min(w, h) * 0.18 * heartPulse;
                // 外圈火焰光晕
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const ignisGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, heartR * 2.5);
                ignisGrad.addColorStop(0, `rgba(255, 200, 50, ${0.7 * heartPulse})`);
                ignisGrad.addColorStop(0.4, `rgba(255, 100, 20, ${0.5 * heartPulse})`);
                ignisGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
                ctx.fillStyle = ignisGrad;
                ctx.beginPath();
                ctx.arc(0, 0, heartR * 2.5, 0, Math.PI * 2);
                ctx.fill();
                // 心核实体
                ctx.globalCompositeOperation = 'source-over';
                ctx.beginPath();
                ctx.arc(0, 0, heartR, 0, Math.PI * 2);
                const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, heartR);
                coreGrad.addColorStop(0, '#fffde7');
                coreGrad.addColorStop(0.4, '#ffb300');
                coreGrad.addColorStop(1, '#e65100');
                ctx.fillStyle = coreGrad;
                ctx.shadowColor = '#ff6d00';
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.restore();
                // 火星喷射（狂暴时加强）
                if (isBerserk) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    const sparkCount = 6;
                    for (let i = 0; i < sparkCount; i++) {
                        const angle = (i / sparkCount) * Math.PI * 2 + t * 3;
                        const dist = heartR * (1.5 + Math.sin(t * 4 + i) * 0.5);
                        const sx = Math.cos(angle) * dist;
                        const sy = Math.sin(angle) * dist;
                        const sr = 2 + Math.random() * 2;
                        ctx.beginPath();
                        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255, ${150 + Math.floor(Math.random() * 100)}, 0, 0.9)`;
                        ctx.fill();
                    }
                    ctx.restore();
                }
                break;
            }

            case 'glacies': {
                // === Glacies: 冰尖突破 + 冰雾覆盖 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                // 内部冰晶反射光
                const glaciesGrad = ctx.createRadialGradient(w * 0.1, -h * 0.1, 0, 0, 0, Math.max(w, h) * 0.6);
                glaciesGrad.addColorStop(0, `rgba(200, 240, 255, ${0.3 + Math.sin(t * 1.5) * 0.1})`);
                glaciesGrad.addColorStop(0.5, `rgba(100, 180, 255, 0.15)`);
                glaciesGrad.addColorStop(1, 'rgba(50, 100, 200, 0)');
                ctx.fillStyle = glaciesGrad;
                ctx.fillRect(-w/2, -h/2, w, h);
                // 冰尖突出效果（在形状内部画尖刺）
                ctx.strokeStyle = `rgba(180, 230, 255, ${0.6 + Math.sin(t * 2) * 0.2})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#a5f3fc';
                ctx.shadowBlur = 8;
                const spikePositions = [
                    { x: 0, y: -h * 0.35, angle: -Math.PI / 2, len: h * 0.25 },
                    { x: w * 0.3, y: -h * 0.2, angle: -Math.PI / 4, len: h * 0.18 },
                    { x: -w * 0.3, y: -h * 0.2, angle: -Math.PI * 3/4, len: h * 0.18 },
                ];
                spikePositions.forEach(sp => {
                    ctx.beginPath();
                    ctx.moveTo(sp.x, sp.y);
                    ctx.lineTo(sp.x + Math.cos(sp.angle) * sp.len, sp.y + Math.sin(sp.angle) * sp.len);
                    ctx.stroke();
                });
                ctx.restore();
                break;
            }

            case 'mikro': {
                // === Mikro: 孢子囊 + 六边形细胞网格 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                // 六边形细胞网格
                const hexR2 = Math.min(w, h) * 0.18;
                const hexW2 = hexR2 * Math.sqrt(3);
                const hexH2 = hexR2 * 2;
                ctx.strokeStyle = `rgba(192, 132, 252, ${0.4 + Math.sin(t * 1.2) * 0.15})`;
                ctx.lineWidth = 1;
                ctx.shadowColor = '#a855f7';
                ctx.shadowBlur = 5;
                for (let row = -2; row <= 2; row++) {
                    for (let col = -2; col <= 2; col++) {
                        const hx = col * hexW2 + (row % 2 === 0 ? 0 : hexW2 / 2);
                        const hy = row * hexH2 * 0.75;
                        if (Math.abs(hx) > w * 0.45 || Math.abs(hy) > h * 0.45) continue;
                        ctx.beginPath();
                        for (let k = 0; k < 6; k++) {
                            const ang = Math.PI / 180 * (60 * k - 30);
                            const px2 = hx + hexR2 * Math.cos(ang);
                            const py2 = hy + hexR2 * Math.sin(ang);
                            k === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
                        }
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
                // 孢子囊发光点
                const sporeCount = isBerserk ? 6 : 4;
                const sporePositions = [
                    { x: -w * 0.25, y: -h * 0.15 }, { x: w * 0.2, y: h * 0.1 },
                    { x: -w * 0.05, y: h * 0.25 }, { x: w * 0.28, y: -h * 0.25 },
                    { x: w * 0.05, y: -h * 0.05 }, { x: -w * 0.3, y: h * 0.2 }
                ];
                for (let i = 0; i < sporeCount; i++) {
                    const sp = sporePositions[i];
                    const pulse = Math.sin(t * 1.5 + i * 1.2) * 0.3 + 0.7;
                    const spR = (4 + this.visualSeed * 3) * pulse;
                    const spGrad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, spR * 2);
                    spGrad.addColorStop(0, `rgba(216, 180, 254, ${0.8 * pulse})`);
                    spGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
                    ctx.fillStyle = spGrad;
                    ctx.beginPath();
                    ctx.arc(sp.x, sp.y, spR * 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                break;
            }

            case 'devourer': {
                // === Devourer: V型引力线 + 漩涡吸入特效 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const devourerPhase = (t * 0.8) % 1;
                // 引力线（从外圈向内圈流入）
                const cd = this.collisionData;
                const outerR2 = cd ? cd.radius + cd.thickness * 0.5 : w * 0.4;
                const lineCount = 8;
                for (let i = 0; i < lineCount; i++) {
                    const angle = (i / lineCount) * Math.PI * 2 + t * 0.5;
                    const linePhase = (devourerPhase + i / lineCount) % 1;
                    const startDist = outerR2 * (0.5 + linePhase * 0.5);
                    const endDist = outerR2 * 0.1;
                    const alpha = (1 - linePhase) * 0.4;
                    const grad = ctx.createLinearGradient(
                        Math.cos(angle) * startDist, Math.sin(angle) * startDist,
                        Math.cos(angle) * endDist, Math.sin(angle) * endDist
                    );
                    grad.addColorStop(0, `rgba(88, 28, 135, 0)`);
                    grad.addColorStop(1, `rgba(139, 92, 246, ${alpha})`);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * startDist, Math.sin(angle) * startDist);
                    ctx.lineTo(Math.cos(angle) * endDist, Math.sin(angle) * endDist);
                    ctx.stroke();
                }
                // 中心吸入点
                const devGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR2 * 0.3);
                devGrad.addColorStop(0, `rgba(0, 0, 0, ${0.8 + Math.sin(t * 2) * 0.1})`);
                devGrad.addColorStop(0.5, `rgba(88, 28, 135, 0.4)`);
                devGrad.addColorStop(1, 'rgba(88, 28, 135, 0)');
                ctx.fillStyle = devGrad;
                ctx.beginPath();
                ctx.arc(0, 0, outerR2 * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
            }

            case 'viridis': {
                // === Viridis: 能量藤蔓 + 生命光晕 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                // 中心生命光晕
                const viridisGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, h) * 0.4);
                viridisGrad.addColorStop(0, `rgba(74, 222, 128, ${0.4 + Math.sin(t * 2) * 0.15})`);
                viridisGrad.addColorStop(0.6, `rgba(34, 197, 94, 0.2)`);
                viridisGrad.addColorStop(1, 'rgba(21, 128, 61, 0)');
                ctx.fillStyle = viridisGrad;
                ctx.beginPath();
                ctx.arc(0, 0, Math.min(w, h) * 0.4, 0, Math.PI * 2);
                ctx.fill();
                // 能量藤蔓
                const vineCount = isBerserk ? 5 : 3;
                ctx.strokeStyle = `rgba(74, 222, 128, ${0.6 + Math.sin(t * 1.5) * 0.2})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#22c55e';
                ctx.shadowBlur = 6;
                for (let i = 0; i < vineCount; i++) {
                    const vineAngle = (i / vineCount) * Math.PI * 2 + t * 0.3;
                    const vineLen = Math.min(w, h) * (0.3 + Math.sin(t * 1.2 + i) * 0.1);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    const cp1x = Math.cos(vineAngle + 0.5) * vineLen * 0.5;
                    const cp1y = Math.sin(vineAngle + 0.5) * vineLen * 0.5;
                    const endX = Math.cos(vineAngle) * vineLen;
                    const endY = Math.sin(vineAngle) * vineLen;
                    ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
                    ctx.stroke();
                }
                ctx.restore();
                break;
            }

            case 'tesla': {
                // === Tesla: 电弧残影 + 等离子体闪烁 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                // 闪烁电光核心
                const teslaFlash = Math.random() < 0.3 ? 1 : (Math.sin(t * 8) * 0.5 + 0.5);
                const teslaGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, h) * 0.35);
                teslaGrad.addColorStop(0, `rgba(250, 204, 21, ${0.8 * teslaFlash})`);
                teslaGrad.addColorStop(0.3, `rgba(99, 102, 241, ${0.5 * teslaFlash})`);
                teslaGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
                ctx.fillStyle = teslaGrad;
                ctx.beginPath();
                ctx.arc(0, 0, Math.min(w, h) * 0.35, 0, Math.PI * 2);
                ctx.fill();
                // 电弧达到顶点
                const verts = this.collisionData && this.collisionData.vertices;
                if (verts && verts.length > 0) {
                    ctx.strokeStyle = `rgba(250, 204, 21, ${0.6 * teslaFlash})`;
                    ctx.lineWidth = 1;
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = 8;
                    verts.forEach(v => {
                        if (Math.random() < 0.4) {
                            ctx.beginPath();
                            ctx.moveTo(0, 0);
                            // 折线闪电
                            const midX = v.x * 0.5 + (Math.random() - 0.5) * w * 0.2;
                            const midY = v.y * 0.5 + (Math.random() - 0.5) * h * 0.2;
                            ctx.lineTo(midX, midY);
                            ctx.lineTo(v.x, v.y);
                            ctx.stroke();
                        }
                    });
                }
                ctx.restore();
                break;
            }

            case 'chimera': {
                // === Chimera: 缝合线 + 双色能量渗出 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                // 缝合线（垂直分割线）
                const chimeraShift = Math.sin(t * 0.8) * 3;
                const lineGrad = ctx.createLinearGradient(chimeraShift, -h/2, chimeraShift, h/2);
                lineGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
                lineGrad.addColorStop(0.3, `rgba(239, 68, 68, ${0.5 + Math.sin(t * 2) * 0.2})`);
                lineGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.7 + Math.sin(t * 3) * 0.2})`);
                lineGrad.addColorStop(0.7, `rgba(99, 102, 241, ${0.5 + Math.sin(t * 2) * 0.2})`);
                lineGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
                ctx.strokeStyle = lineGrad;
                ctx.lineWidth = 2;
                ctx.shadowColor = '#a855f7';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(chimeraShift, -h/2);
                ctx.lineTo(chimeraShift, h/2);
                ctx.stroke();
                // 左侧机械能量（蓝色）
                const leftGrad = ctx.createRadialGradient(-w * 0.2, 0, 0, -w * 0.2, 0, w * 0.3);
                leftGrad.addColorStop(0, `rgba(59, 130, 246, ${0.3 + Math.sin(t * 1.5) * 0.1})`);
                leftGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
                ctx.fillStyle = leftGrad;
                ctx.fillRect(-w/2, -h/2, w/2, h);
                // 右侧生物能量（红色）
                const rightGrad = ctx.createRadialGradient(w * 0.2, 0, 0, w * 0.2, 0, w * 0.3);
                rightGrad.addColorStop(0, `rgba(239, 68, 68, ${0.3 + Math.sin(t * 1.8) * 0.1})`);
                rightGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                ctx.fillStyle = rightGrad;
                ctx.fillRect(0, -h/2, w/2, h);
                ctx.restore();
                break;
            }

            case 'ouroboros': {
                // === Ouroboros: 符文光环 + 动态缺口指示 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const cd2 = this.collisionData;
                const ouroR = cd2 ? cd2.radius : Math.min(w, h) * 0.4;
                const gapAngle = this.gapAngle || 0;
                // 符文光环：在环形上绘制旋转符文
                const runeCount = 8;
                ctx.fillStyle = `rgba(167, 139, 250, ${0.7 + Math.sin(t * 2) * 0.2})`;
                ctx.font = `bold ${Math.floor(ouroR * 0.3)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const runeChars = ['ᚠ', 'ᚷ', 'ᛉ', 'ᛚ', 'ᛣ', 'ᛱ', 'ᚢ', 'ᚹ'];
                for (let i = 0; i < runeCount; i++) {
                    const angle = (i / runeCount) * Math.PI * 2 + gapAngle + t * 0.5;
                    const rx = Math.cos(angle) * ouroR;
                    const ry = Math.sin(angle) * ouroR;
                    ctx.save();
                    ctx.translate(rx, ry);
                    ctx.rotate(angle + Math.PI / 2);
                    ctx.globalAlpha = 0.6 + Math.sin(t * 3 + i) * 0.3;
                    ctx.shadowColor = '#7c3aed';
                    ctx.shadowBlur = 8;
                    ctx.fillText(runeChars[i % runeChars.length], 0, 0);
                    ctx.restore();
                }
                // 缺口指示箭头
                const gapMidAngle = gapAngle + Math.PI * 0.75; // 缺口中间角度
                const arrowDist = ouroR * 1.15;
                ctx.save();
                ctx.translate(Math.cos(gapMidAngle) * arrowDist, Math.sin(gapMidAngle) * arrowDist);
                ctx.rotate(gapMidAngle);
                ctx.fillStyle = `rgba(250, 204, 21, ${0.6 + Math.sin(t * 4) * 0.3})`;
                ctx.shadowColor = '#fbbf24';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(5, 5);
                ctx.lineTo(-5, 5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                ctx.restore();
                break;
            }

            case 'prism': {
                // === Prism Monarch: 彩虹光谱流转 ===
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const prismColors = [
                    '#ef4444', '#f97316', '#eab308', '#22c55e',
                    '#06b6d4', '#3b82f6', '#a855f7'
                ];
                const prismAngle = t * 0.5;
                for (let i = 0; i < 7; i++) {
                    const angle = prismAngle + (i / 7) * Math.PI * 2;
                    const r2 = Math.min(w, h) * 0.35;
                    const grad = ctx.createLinearGradient(
                        Math.cos(angle) * r2, Math.sin(angle) * r2,
                        Math.cos(angle + Math.PI) * r2, Math.sin(angle + Math.PI) * r2
                    );
                    grad.addColorStop(0, `${prismColors[i]}00`);
                    grad.addColorStop(0.5, `${prismColors[i]}66`);
                    grad.addColorStop(1, `${prismColors[i]}00`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(-w/2, -h/2, w, h);
                }
                ctx.restore();
                break;
            }

            default:
                break;
        }
    }

    /**
     * 获取多边形碰撞形状的绝对坐标顶点
     * 如果 collisionData.vertices 存储的是相对坐标，则加上当前位置
     */
    getAbsoluteVertices() {
        if (!this.collisionData || !this.collisionData.vertices) return [];
        // 如果顶点已经是绝对坐标（旧逻辑兼容），或者需要转换为绝对坐标
        return this.collisionData.vertices.map(v => {
            // 如果 vertices 存储的是相对于 (0,0) 的偏移量，则加上 this.pos
            // 我们约定新逻辑下 vertices 存储的是相对中心点的偏移
            return new Vec2(this.pos.x + v.x, this.pos.y + v.y);
        });
    }
}

// ==================== 导出 ====================
export { Enemy };
