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
import { sb as _sb } from '../utils/perf.js';
import { eventBus } from '../event_bus.js';
import { createSpriteRenderer } from '../render/sprite_renderer.js'; // [Phase 5B Task 5.B3] Sprite 动画渲染器

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

        // [新属性] 毒素层数（venom stacks）：每次行动结算 DoT
        this.venomStacks = 0;

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

        // === D4: 激光照射抖动反馈 ===
        // 照射抖动计时器（帧数）
        this._laserHitTimer = 0;
        // 照射抖动当前强度（0-1）
        this._laserHitIntensity = 0;

        // === Layer 1.5: 预计算底层纹理 (OffscreenCanvas) ===
        // 基于 visualSeed 一次性生成静态纹理，每帧仅执行一次 drawImage
        this._textureCanvas = null;
        this._initTexture(width, height);

        // === [Phase 5B Task 5.B3] SpriteRenderer 初始化 ===
        // bossType 在构造时可能尚未赋值，由 spawn_system.js 调用 initSprite() 完成
        this._spriteRenderer = null;
        this._spriteLastMs = 0; // 上次 update 的时间戳（ms）
    }

    /**
     * [Phase 5B Task 5.B3] 初始化 SpriteRenderer（在 bossType 赋值后调用）
     * spawn_system.js 在设置 e.bossType 后应调用 e.initSprite()
     */
    initSprite() {
        this._spriteRenderer = createSpriteRenderer(this.type, this.bossType);
        if (this._spriteRenderer) {
            this._spriteRenderer.play('idle');
            this._spriteLastMs = performance.now();
        }
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

        // === [Phase 5B Task 5.B3] SpriteRenderer 动画状态更新 ===
        if (this._spriteRenderer) {
            const nowMs = performance.now();
            const dt = Math.min((nowMs - this._spriteLastMs) / 1000, 0.1); // 限制最大帧时间差
            this._spriteLastMs = nowMs;

            // 根据 actionPhase 和 hitTimer 映射到动画名称
            let targetAnim = 'idle';
            if (this.hitTimer > 0 && this._spriteRenderer.hasAnim('hit')) {
                targetAnim = 'hit';
            } else if (this.actionPhase === 'telegraphing' && this._spriteRenderer.hasAnim('cast')) {
                targetAnim = 'cast';
            } else if (this.actionPhase === 'telegraphing' && this._spriteRenderer.hasAnim('move')) {
                targetAnim = 'move';
            }
            this._spriteRenderer.play(targetAnim);
            this._spriteRenderer.update(dt * timeScale);
        }

        // --- [新增] 预警状态更新 ----
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
        // === D4: 激光照射抖动衰减 ===
        if (this._laserHitTimer > 0) {
            this._laserHitTimer -= timeScale;
            this._laserHitIntensity = Math.max(0, this._laserHitTimer / CONFIG.enemyRender.laserHitShakeDuration);
        } else {
            this._laserHitIntensity = 0;
        }
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
        // 血量低于 20% 时，从敌人身体随机位置持续迸射极小能量粒子，模拟濒死时的能量泄漏状态
        if (this.hp > 0 && this.maxHp > 0 && (this.hp / this.maxHp) < 0.2) {
            // 血量越低，触发概率越高（20%血量时约3%/帧，接近0时约8%/帧）
            const hpRatio = this.hp / (this.maxHp * 0.2);
            const leakChance = (0.03 + 0.05 * (1 - hpRatio)) * timeScale;
            if (Math.random() < leakChance) {
                // 能量泄漏粒子颜色：青白/电弧蓝/淡紫，与火属性橙红色系形成明显色相对比
                const LEAK_COLORS = ['#e0f2fe', '#7dd3fc', '#38bdf8', '#c4b5fd'];
                const leakColor = LEAK_COLORS[Math.floor(Math.random() * LEAK_COLORS.length)];
                const leakParticle = new Particle(
                    this.pos.x + (Math.random() - 0.5) * this.width * 0.9,
                    this.pos.y + (Math.random() - 0.5) * this.height * 0.6,
                    leakColor, 'spark'
                );
                // 向四周随机散射，轻微向上偏移，模拟能量从裂缝中迸出
                const leakAngle = Math.random() * Math.PI * 2;
                const leakSpeed = 0.8 + Math.random() * 1.2;
                leakParticle.vel.x = Math.cos(leakAngle) * leakSpeed;
                leakParticle.vel.y = Math.sin(leakAngle) * leakSpeed - 0.3;
                leakParticle.size = 1.0 + Math.random() * 1.5; // 极小尺寸
                leakParticle.decay = 0.04 + Math.random() * 0.03; // 快速消散
                game.spawn_pushParticleWithLimit(leakParticle);
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
            // @section:enemy_telegraph_audio - 敌人特殊动作预警蓄力音（低频 200Hz，区别于玩家蓄力 800Hz）
            audio.playTone(200, 'sine', 0.1, 0.1); 
        }
    }

    // --- [核心修改] 第二步：执行动作 (Execute Action) ---
    executeTurnAction(game) {
        // @section:enemy_action_audio - 敌人行动音效分发：regen/split/freeze 按词缀类型路由
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
        // @section:enemy_move_audio - 敌人移动时的状态音效（regen/split/devour 词缀）
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

            // --- 5. [V2 hive] 孵化巢：周期性孵化弱小幼体 ---
            if (this.affixes.includes('hive')) {
                if (this._hiveCooldown === undefined) this._hiveCooldown = afx.hiveSpawnInterval || 2;
                this._hiveCooldown--;
                if (this._hiveCooldown <= 0) {
                    this._hiveCooldown = afx.hiveSpawnInterval || 2;
                    Enemy._hiveSpawnLarva(this, game, afx);
                }
            }

            // --- 6. [V2 siege] 攻城履带：免疫冰冻；普通移动被前方敌人阻挡时改为推挤链条 ---
            // 具体推挤行为在下方 _doMoveP() 中处理，避免额外行动与普通移动节奏叠加。
            // --- 7. [V2 echoRelay] 共振尖塔：额外触发周围敌人的词条效果 ---
            if (this.affixes.includes('echoRelay')) {
                Enemy._echoRelayRetrigger(this, game, afx);
            }
        }

        // --- [改动] 移动与跳跃：移出循环，始终只执行一次 ---
        // haste 词条：额外触发一次移动
        const _doMoveP = () => {
            const moveAmount = game.enemyHeight;
            const targetY = this.dropTargetY + moveAmount;
            const isBlocked = game.calc_isAreaOccupied(this.pos.x, targetY, this.width * 0.8, this.height * 0.8, this);
            const _overlapsProjected = (ax, ay, aw, ah, other, otherY = null) => {
                const bx = other.pos.x;
                const by = otherY !== null ? otherY : other.dropTargetY;
                const bw = other.width * 0.8;
                const bh = other.height * 0.8;
                return Math.abs(ax - bx) < (aw + bw) * 0.5 && Math.abs(ay - by) < (ah + bh) * 0.5;
            };
            const _findProjectedBlockers = (mover, moverTargetY, pushedSet) => {
                const aw = mover.width * 0.8;
                const ah = mover.height * 0.8;
                return game.enemies.filter(other => {
                    if (!other || !other.active || other === mover || pushedSet.has(other)) return false;
                    return _overlapsProjected(mover.pos.x, moverTargetY, aw, ah, other);
                });
            };
            const _trySiegePushChain = () => {
                if (!this.affixes.includes('siege')) return false;
                const pushedSet = new Set([this]);
                const pushOrder = [];
                const canPush = (mover) => {
                    const nextY = mover.dropTargetY + moveAmount;
                    if (nextY + mover.height * 0.5 > game.height) return false;
                    const blockers = _findProjectedBlockers(mover, nextY, pushedSet);
                    for (const blocker of blockers) {
                        pushedSet.add(blocker);
                        if (!canPush(blocker)) return false;
                        pushOrder.push(blocker);
                    }
                    return true;
                };
                if (!canPush(this) || pushOrder.length === 0) return false;
                for (const pushed of pushOrder) {
                    pushed.advance(moveAmount);
                    pushed.bumpOffsetY = -6;
                    game.spawn_createParticle(pushed.pos.x, pushed.pos.y, '#facc15', 'spark');
                }
                this.advance(moveAmount);
                this.bumpOffsetY = -12;
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 45, `PUSH x${pushOrder.length}`, '#facc15');
                game.spawn_createShockwave(this.pos.x, this.pos.y, '#facc15');
                return true;
            };
            if (!isBlocked) {
                this.advance(moveAmount);
            } else if (_trySiegePushChain()) {
                // siege 推挤成功后不再执行 jump / blocked 分支。
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
        // [重装词条] 移动冷却：每 N 回合才移动一次，但其他行动照常执行
        let _heavyArmorCanMove = true;
        if (this.affixes.includes('heavyArmor') && this.type !== 'boss') {
            if (this._moveInterval === undefined) {
                this._moveInterval = (CONFIG.balance.affixes && CONFIG.balance.affixes.heavyArmorMoveInterval) || 2;
                this._moveCooldown = 0;
            }
            if (this._moveCooldown > 0) {
                _heavyArmorCanMove = false;
                this._moveCooldown--;
            } else {
                this._moveCooldown = this._moveInterval - 1;
            }
        }

        if (!this.isFrozenCurrentTurn && _heavyArmorCanMove) {
            _doMoveP();
            if (this.affixes.includes('haste')) {
                game.spawn_createFloatingText(this.pos.x, this.pos.y - 50, "⚡DASH!", "#facc15");
                _doMoveP();
            }
        } else if (!this.isFrozenCurrentTurn && !_heavyArmorCanMove) {
            // 重装等待动画（短暂上下抖动）
            this.bumpOffsetY = Math.sin(Date.now() / 200) * 2;
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

            // 狂暴词缀轮转时，触发全屏白色闪光计时器（_berserkedRotation 已开启）
            if (this._berserkedRotation) {
                this._rotationFlashTimer = 8; // 8 帧内快速衰减到 0
            }

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

    /**
     * @method triggerLaserHitShake
     * @description 激活激光照射抖动反馈
     */
    triggerLaserHitShake() {
        this._laserHitTimer = CONFIG.enemyRender.laserHitShakeDuration;
        this._laserHitIntensity = 1.0;
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
    // @section:draw_entry_and_perf_check - 绘制入口与性能等级检查
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); 
        ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);

        // === D1 & D2: 待机生动感（呼吸缩放 + 微浮动）===
        // 仅在 idle 状态且无受击/预警时生效，使用 visualSeed 作为相位偏移
        if (this.actionPhase === 'idle' && this._hitImpact <= 0.001 && this.hitTimer <= 0) {
            const now = Date.now();
            // D1: 呼吸缩放 — 使用 visualSeed * 2π 作为相位偏移，确保多敌人节奏各异
            // 升级：使用 Math.pow 非线性缓动曲线，增强极值停留感（breatheEasingPower 越大停留感越强）
            const breathePhase = (now / CONFIG.enemyRender.breathePeriod + this.visualSeed) * Math.PI * 2;
            const breatheIntensity = Math.pow((Math.sin(breathePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower);
            const breatheScale = 1 + (breatheIntensity * 2 - 1) * CONFIG.enemyRender.breatheAmplitude;
            ctx.scale(breatheScale, breatheScale);
            // D2: 待机微浮动 — 周期与呼吸错开，叠加额外相位偏移避免同步
            const floatPhase = (now / CONFIG.enemyRender.idleFloatPeriod + this.visualSeed * 1.3) * Math.PI * 2;
            const floatY = Math.sin(floatPhase) * CONFIG.enemyRender.idleFloatAmplitude;
            ctx.translate(0, floatY);
        }

        // === A3: 受击 Squash & Stretch 形变 ===
        // 受击瞬间变扁变宽，随后弹性恢复
        if (this._hitImpact > 0.001) {
            const sx = CONFIG.enemyRender.hitImpactScaleX;
            const sy = CONFIG.enemyRender.hitImpactScaleY;
            ctx.scale(1 + this._hitImpact * sx, 1 - this._hitImpact * sy);
        }
        
        // === D4: 激光照射抖动反馈 ===
        // 照射抖动：振幅随时间衰减
        if (this._laserHitIntensity > 0.001) {
            const amplitude = CONFIG.enemyRender.laserHitShakeAmplitude;
            const shakeX = (Math.random() - 0.5) * amplitude * this._laserHitIntensity * 2;
            const shakeY = (Math.random() - 0.5) * amplitude * this._laserHitIntensity * 2;
            ctx.translate(shakeX, shakeY);
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
        // @section:draw_shadow_and_base - 软阴影与敌人基础形体绘制
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
        // @perf-impact: 容器背景由实色改为线性渐变（每帧 1 个 LinearGradient/敌人）
        // [玻璃质感] 容器底色采用顶亮底深的微弱玻璃渐变，模拟环境光自上而下
        // 衰减；总体 alpha 降低，避免大面积纯色显得廉价，让 game-container 的
        // 径向背景充分透出，强化"半透明面板嵌在战场上"的高级质感。
        const _bgGrad = ctx.createLinearGradient(0, -h/2, 0, h/2);
        _bgGrad.addColorStop(0, 'rgba(30, 41, 59, 0.04)');
        _bgGrad.addColorStop(1, 'rgba(8, 14, 26, 0.12)');
        ctx.fillStyle = _bgGrad;
        ctx.fill();
        // [增强对比 #4] 在裁剪之前先给容器外缘绘制一圈柔光描边，
        // 让敌人在与背景同色的「液态」战场上仍能识别轮廓（精英/Boss 尤其关键）。
        // 由于 ctx.clip() 之后描边会被裁剪一半，这里预先绘制可保留完整外缘。
        ctx.save();
        ctx.shadowColor = (this.type === 'boss') ? 'rgba(239, 68, 68, 0.85)'
                         : (this.type === 'elite') ? 'rgba(168, 85, 247, 0.75)'
                         : 'rgba(148, 163, 184, 0.55)';
        ctx.shadowBlur = _sb((this.type === 'boss') ? 18 : (this.type === 'elite') ? 14 : 8);
        ctx.strokeStyle = (this.type === 'boss') ? 'rgba(239, 68, 68, 0.9)'
                         : (this.type === 'elite') ? 'rgba(196, 152, 255, 0.85)'
                         : 'rgba(203, 213, 225, 0.7)';
        ctx.lineWidth = (this.type === 'boss') ? 3 : 2;
        ctx.stroke();
        ctx.restore();
        ctx.clip();

         // === Layer 1.5: 底层纹理 (预计算 OffscreenCanvas) ===
        if (this._textureCanvas) {
            ctx.drawImage(this._textureCanvas, -w/2, -h/2);
        }

        // === Layer 1.6: 词缀组合身份色调叠加 ===
        // 每种词缀组合有唯一的微弱色调，让玩家能通过视觉氛围感知词缀类型
        if (this.affixes && this.affixes.length > 0 && this.type !== 'boss') {
            const _tintColor = this._getAffixTintColor();
            if (_tintColor) {
                ctx.save();
                ctx.globalAlpha = 0.16;
                const _tintGrad = ctx.createLinearGradient(0, -h/2, 0, h/2);
                _tintGrad.addColorStop(0, _tintColor);
                _tintGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = _tintGrad;
                ctx.fillRect(-w/2, -h/2, w, h);
                ctx.restore();
            }
        }

        // === Layer 2: 液体血条 (含延迟白条) ===
        // [修改] 血量从上往下扣除：满血时占满整个容器，血量减少时从顶部开始消失，
        // 残余血量沉在底部，类似液面下降的视觉。

        // A. 计算高度比例
        const hpRatio = Math.max(0, Math.min(1, this.displayHp / this.maxHp));
        const whiteRatio = Math.max(0, Math.min(1, this.delayedHp / this.maxHp)); // 白色条比例
        const greenRatio = Math.max(0, Math.min(1, this.greenHp / this.maxHp));   // 绿色条比例

        const _hpBarBottom = h/2; // 血条底部 Y（贴住容器底部）

        const fillHeight = h * hpRatio;
        const whiteHeight = h * whiteRatio; // 白色条高度
        const greenHeight = h * greenRatio; // 绿色条高度

        // 锚定底部：fillY = bottom - height，血量减少时顶部下沉
        const fillY = _hpBarBottom - fillHeight;
        const whiteY = _hpBarBottom - whiteHeight;
        const greenY = _hpBarBottom - greenHeight;

        // @perf-impact: 空槽改为线性渐变（每帧 1 个 LinearGradient/敌人）
        // [玻璃质感] 空槽保留类型色调（普通/精英/Boss）但改为顶浅底深的微弱渐变，
        // 进一步打散纯色面，提升透明感与体积感。alpha 进一步降低，让背景透出更多。
        let _slotTop, _slotBottom;
        if (this.type === 'elite') {
            _slotTop = 'rgba(76, 48, 122, 0.05)';
            _slotBottom = 'rgba(28, 14, 52, 0.12)';
        } else if (this.type === 'boss') {
            _slotTop = 'rgba(96, 28, 44, 0.06)';
            _slotBottom = 'rgba(40, 8, 16, 0.14)';
        } else {
            _slotTop = 'rgba(40, 52, 74, 0.04)';
            _slotBottom = 'rgba(12, 18, 30, 0.10)';
        }
        const _slotGrad = ctx.createLinearGradient(0, -h/2, 0, h/2);
        _slotGrad.addColorStop(0, _slotTop);
        _slotGrad.addColorStop(1, _slotBottom);
        ctx.fillStyle = _slotGrad;
        ctx.fillRect(-w/2, -h/2, w, h);

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
        // [增强对比] 加深基础血色，并与外部背景拉开差异。
        let baseColor = '#64748b';                  // 普通：石板蓝（更亮）
        if (this.type === 'elite') baseColor = '#7c3aed'; // 精英：饱和紫
        if (this.type === 'boss') baseColor = '#dc2626';  // Boss：饱和血红

        // 温度变色逻辑
        if (this.temp > 0) {
            const t = Math.min(1, this.temp / 34);
            baseColor = lerpColor(baseColor, '#ea580c', t);
        } else if (this.temp < 0) {
            const t = Math.min(1, Math.abs(this.temp) / 34);
            baseColor = lerpColor(baseColor, '#0891b2', t);
        }

        // @perf-impact: HP 填充由实色改为线性渐变（每帧 1 个 LinearGradient/敌人）
        // [液体质感] 沿垂直方向叠加：顶部偏亮（液面高光）→ 中段为本体色 → 底部偏暗
        // （暗示液体深度），使 HP 条不再是大面积纯色，呈现真正的"液体"层次。
        // alpha 略降至 0.78，让背景与温度光效更自然地透出。
        if (fillHeight > 0.5) {
            const _hpHighlight = lerpColor(baseColor, '#ffffff', 0.22);
            const _hpShadow = lerpColor(baseColor, '#000000', 0.32);
            const _hpGrad = ctx.createLinearGradient(0, fillY, 0, fillY + fillHeight);
            _hpGrad.addColorStop(0, _hpHighlight);
            _hpGrad.addColorStop(0.18, baseColor);
            _hpGrad.addColorStop(1, _hpShadow);
            ctx.globalAlpha = 0.48;
            ctx.fillStyle = _hpGrad;
            ctx.fillRect(-w/2, fillY, w, fillHeight);
            ctx.globalAlpha = 1.0;
        }

        // D. 液面顶部高光（双层 specular：上方亮线 + 下方淡渐隐，模拟液体表面张力）
        if (hpRatio > 0 && hpRatio < 1) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.fillRect(-w/2, fillY, w, 1);
            const _surfaceGrad = ctx.createLinearGradient(0, fillY, 0, fillY + 5);
            _surfaceGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
            _surfaceGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = _surfaceGrad;
            ctx.fillRect(-w/2, fillY, w, 5);
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
            // @section:draw_status_effects - 状态效果视觉（冻结/灼烧/眩晕等）
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

        // === Layer 3.4: 毒素状态视觉（venomStacks > 0 时显示）===
        // @perf-impact: 新增毒素叠加层 - high/medium 档用 screen 混合+渐变，low 档仅简单色块
        if ((this.venomStacks || 0) > 0) {
            const _vPerfLevel = (typeof game !== 'undefined' && game.perfQualityLevel) || 'high';
            const _vStacks = this.venomStacks;
            const _vIntensity = Math.min(1, _vStacks / 10); // 10 层满溢
            const _vTime = Date.now() / 1000;
            // 毒素层数越多，脉冲越快
            const _vPulse = (Math.sin(_vTime * (1.0 + _vIntensity * 1.5) + this.visualSeed * 4) + 1) * 0.5;
            const _vBaseAlpha = 0.15 + _vIntensity * 0.3;
            const _vPulseAlpha = _vBaseAlpha * (0.7 + _vPulse * 0.3);

            ctx.save();
            if (_vPerfLevel !== 'low') {
                // high / medium: screen 混合 + 径向渐变，模拟内部毒液发光
                ctx.globalCompositeOperation = 'screen';
                const _vGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.7);
                _vGrad.addColorStop(0, `rgba(134, 239, 172, ${_vPulseAlpha * 0.8})`);
                _vGrad.addColorStop(0.5, `rgba(74, 222, 128, ${_vPulseAlpha * 0.5})`);
                _vGrad.addColorStop(1, `rgba(22, 101, 52, 0)`);
                ctx.fillStyle = _vGrad;
                ctx.beginPath(); ctx.arc(0, 0, Math.max(w, h) * 0.7, 0, Math.PI * 2); ctx.fill();

                // 毒液滴动画：沿边缘流淌的绿色液滴点（高性能档额外绘制）
                if (_vPerfLevel === 'high') {
                    const _dropCount = Math.min(5, 2 + Math.floor(_vStacks / 3));
                    ctx.globalCompositeOperation = 'screen';
                    for (let _di = 0; _di < _dropCount; _di++) {
                        const _dSeed = this.visualSeed * 7 + _di * 1.618;
                        // 液滴沿敌人下边缘滴落
                        const _dX = (Math.sin(_dSeed) * 0.4) * w;
                        const _dRise = ((_vTime * 0.4 + _dSeed) % 1);
                        const _dY = h * 0.5 - _dRise * h * 1.2;
                        if (_dY < -h * 0.5 - 6) continue;
                        const _dAlpha = Math.sin(_dRise * Math.PI) * 0.7 * _vIntensity;
                        if (_dAlpha <= 0) continue;
                        ctx.globalAlpha = _dAlpha;
                        ctx.fillStyle = '#4ade80';
                        ctx.beginPath();
                        ctx.ellipse(_dX, _dY, 2.5, 3.5, 0, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else {
                // low: 简单半透明色块，无渐变
                ctx.globalAlpha = _vPulseAlpha * 0.4;
                ctx.fillStyle = '#4ade80';
                ctx.fillRect(-w/2, -h/2, w, h);
            }
            ctx.restore();

            // 粒子发射：低概率从敌人顶部漂出毒液粒子（省电模式 venomLimit=0 会自然截止）
            if (typeof game !== 'undefined' && typeof game.spawn_createParticle === 'function') {
                const _emitProb = _vPerfLevel === 'high' ? 0.08 : (_vPerfLevel === 'medium' ? 0.04 : 0);
                if (Math.random() < _emitProb * _vIntensity) {
                    const _px = this.pos.x + (Math.random() - 0.5) * w;
                    const _py = this.pos.y + this.bumpOffsetY - h * 0.3;
                    game.spawn_createParticle(_px, _py, '#4ade80', 'venom');
                }
            }
        }

        // === Layer 3.5: 内部词缀特效（严格裁剪在方块内，所有词缀统一处理）===
        if (this.affixes.length > 0) {
            const t35 = Date.now() / 1000;
            // 多词缀时各效果透明度衰减，防止视觉过曝
            const affixAlpha35 = this.affixes.length > 3 ? 0.65 : (this.affixes.length > 1 ? 0.8 : 1.0);

            // --- shield: 内壁蜂巢格纹（护盾=防御格栅）浅蓝色六边形网格 ---
            if (this.affixes.includes('shield') && this.shieldCharges > 0) {
                ctx.save();
                // @perf-impact: 护盾格纹透明度 - [降低护盾亮度] 基础值 0.35 → 0.22，防止格纹过亮遮盖敌人主体细节
                const shieldPulse = Math.sin(t35 * 1.2 + (this._spawnColIndex || 0) * 0.4) * 0.15 + 0.22;
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
                // --- shield 词缀核心过曝叠加（相位与格纹脉冲错开 π/2）---
                {
                    const coreX = 0, coreY = 0;
                    const coreR = Math.min(w, h) * 0.2;
                    const shieldOverglowPhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2 + 0.25) * Math.PI * 2;
                    const shieldOverglowIntensity = Math.pow((Math.sin(shieldOverglowPhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const shieldCoreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    shieldCoreGrad.addColorStop(0, `rgba(255, 255, 255, ${shieldOverglowIntensity * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    shieldCoreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = shieldCoreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
                // --- [ELITE+] shield 精英增强：六边形交点节点高光 + 网格颜色偏紫蓝融合 ---
                if (this.type === 'elite' || this.type === 'boss') {
                    const eliteSCfg = CONFIG.enemyRender;
                    const nodeR = eliteSCfg.eliteShieldNodeRadius;
                    const nodeAlpha = eliteSCfg.eliteShieldNodeAlpha * shieldPulse * affixAlpha35;
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    // 重绘六边形网格，在每个交点绘制高光节点
                    const hexR2 = 8;
                    const hexW2 = hexR2 * Math.sqrt(3);
                    const hexH2 = hexR2 * 2;
                    for (let row = -2; row <= 3; row++) {
                        for (let col = -3; col <= 3; col++) {
                            const hx = col * hexW2 + (row % 2 === 0 ? 0 : hexW2 / 2);
                            const hy = row * hexH2 * 0.75;
                            if (Math.abs(hx) > w / 2 + hexR2 || Math.abs(hy) > h / 2 + hexR2) continue;
                            // 在六边形的 6 个顶点绘制高光节点
                            for (let k = 0; k < 6; k++) {
                                const angle = Math.PI / 180 * (60 * k - 30);
                                const nx = hx + hexR2 * Math.cos(angle);
                                const ny = hy + hexR2 * Math.sin(angle);
                                if (Math.abs(nx) > w / 2 || Math.abs(ny) > h / 2) continue;
                                // 精英用紫蓝节点，Boss 用红色节点
                                const nodeColor = this.type === 'boss' ? '239, 68, 68' : '147, 197, 253';
                                const nodeGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR * 2);
                                nodeGrad.addColorStop(0, `rgba(255, 255, 255, ${nodeAlpha})`);
                                nodeGrad.addColorStop(0.5, `rgba(${nodeColor}, ${nodeAlpha * 0.6})`);
                                nodeGrad.addColorStop(1, `rgba(${nodeColor}, 0)`);
                                ctx.fillStyle = nodeGrad;
                                ctx.beginPath();
                                ctx.arc(nx, ny, nodeR * 2, 0, Math.PI * 2);
                                ctx.fill();
                            }
                        }
                    }
                    ctx.restore();
                }
                // --- [BOSS+] shield Boss 增强：实体化能量装甲片（带透明度的多边形填充）---
                if (this.type === 'boss') {
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    const armorAlpha = shieldPulse * 0.18 * affixAlpha35;
                    // 绘制 4 个不规则装甲片，使用 visualSeed 确定位置
                    for (let ai = 0; ai < 4; ai++) {
                        const aSeed = this.visualSeed * 4 + ai * 1.5;
                        const ax1 = (Math.sin(aSeed) * 0.45) * w;
                        const ay1 = (Math.cos(aSeed * 1.2) * 0.45) * h;
                        const ax2 = (Math.sin(aSeed + 1.0) * 0.45) * w;
                        const ay2 = (Math.cos(aSeed * 0.8 + 0.7) * 0.45) * h;
                        const ax3 = (Math.sin(aSeed + 2.0) * 0.45) * w;
                        const ay3 = (Math.cos(aSeed * 1.1 + 1.4) * 0.45) * h;
                        ctx.beginPath();
                        ctx.moveTo(ax1, ay1);
                        ctx.lineTo(ax2, ay2);
                        ctx.lineTo(ax3, ay3);
                        ctx.closePath();
                        ctx.fillStyle = `rgba(147, 197, 253, ${armorAlpha})`;
                        ctx.fill();
                        ctx.strokeStyle = `rgba(255, 255, 255, ${armorAlpha * 1.5})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                    ctx.restore();
                }
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
                // --- regen 词缀核心过曝叠加 ---
                {
                    const coreX = 0, coreY = h * 0.3;
                    const coreR = w * 0.15;
                    const affixPulsePhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2) * Math.PI * 2;
                    const affixPulseIntensity = Math.pow((Math.sin(affixPulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${affixPulseIntensity * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
                // --- [ELITE+] regen 精英增强：波纹中夹杂上升气泡 + 波纹边缘高光描边 ---
                if (this.type === 'elite' || this.type === 'boss') {
                    const regenEliteCfg = CONFIG.enemyRender;
                    const bubbleCount = regenEliteCfg.eliteRegenBubbleCount;
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    for (let bi = 0; bi < bubbleCount; bi++) {
                        const bSeed = this.visualSeed * 3 + bi * 1.4;
                        // 气泡水平位置基于 seed，垂直位置基于时间循环
                        const bubbleX = (Math.sin(bSeed) * 0.4) * w;
                        const bubbleRise = ((t35 * (0.3 + bi * 0.07) + bSeed) % 1);
                        const bubbleY = h / 2 - bubbleRise * h * 1.1;
                        if (bubbleY < -h / 2 - 5) continue;
                        const bubbleR = 2 + Math.sin(bSeed * 2) * 1.5;
                        const bubbleAlpha = (1 - Math.abs(bubbleRise - 0.5) * 1.8) * 0.6 * affixAlpha35;
                        if (bubbleAlpha <= 0) continue;
                        ctx.strokeStyle = `rgba(74, 222, 128, ${bubbleAlpha})`;
                        ctx.lineWidth = 1;
                        ctx.shadowColor = '#4ade80';
                        ctx.shadowBlur = _sb(3);
                        ctx.beginPath();
                        ctx.arc(bubbleX, bubbleY, Math.max(1, bubbleR), 0, Math.PI * 2);
                        ctx.stroke();
                    // @section:draw_boss_aura - Boss 专属光环与粒子特效
                    }
                    ctx.restore();
                }
                // --- [BOSS+] regen Boss 增强：生物脉络缠绕（脉络有节奏地搞动）---
                if (this.type === 'boss') {
                    const regenBossCfg = CONFIG.enemyRender;
                    const veinCount = regenBossCfg.bossRegenVeinCount;
                    const veinPulse = (Math.sin(t35 * 1.2 + this.visualSeed * 4) + 1) * 0.5;
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    for (let vi = 0; vi < veinCount; vi++) {
                        const vSeed = this.visualSeed * 6 + vi * 1.05;
                        const vAngle = (vi / veinCount) * Math.PI * 2 + t35 * 0.15;
                        const vR = Math.min(w, h) * (0.3 + Math.sin(vSeed) * 0.15);
                        const vx = Math.cos(vAngle) * vR;
                        const vy = Math.sin(vAngle) * vR;
                        const veinAlpha = (0.15 + veinPulse * 0.2) * affixAlpha35;
                        ctx.strokeStyle = `rgba(74, 222, 128, ${veinAlpha})`;
                        ctx.lineWidth = 1 + veinPulse * 0.8;
                        ctx.shadowColor = '#4ade80';
                        ctx.shadowBlur = _sb(3 + veinPulse * 3);
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        const midX = vx * 0.5 + Math.sin(vSeed * 2) * w * 0.12;
                        const midY = vy * 0.5 + Math.cos(vSeed * 1.5) * h * 0.12;
                        ctx.quadraticCurveTo(midX, midY, vx, vy);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
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
                // --- haste 词缀核心过曝叠加 ---
                {
                    const coreX = w * 0.1, coreY = 0;
                    const coreR = w * 0.15;
                    const affixPulsePhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2) * Math.PI * 2;
                    const affixPulseIntensity = Math.pow((Math.sin(affixPulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${affixPulseIntensity * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
                // --- [ELITE+] haste 精英增强：残影线带电弧（折线），颜色变为金紫色交织 ---
                if (this.type === 'elite' || this.type === 'boss') {
                    const hasteCfg = CONFIG.enemyRender;
                    const arcSegs = hasteCfg.eliteHasteArcSegments;
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    // 绘制 2 条电弧折线，跟随残影线的相位
                    for (let ai = 0; ai < 2; ai++) {
                        const arcPhase = (hastePhase + ai * 0.5) % 1;
                        const arcY = -h / 2 + arcPhase * h;
                        const arcAlpha = Math.sin(arcPhase * Math.PI) * 0.55 * affixAlpha35;
                        if (arcAlpha <= 0.01) continue;
                        // 电弧颜色：精英金紫交织，Boss 红金交织
                        const arcColor = this.type === 'boss' ? '239, 68, 68' : '192, 132, 252';
                        ctx.strokeStyle = `rgba(${arcColor}, ${arcAlpha})`;
                        ctx.lineWidth = 1.5;
                        ctx.shadowColor = this.type === 'boss' ? '#ef4444' : '#c084fc';
                        ctx.shadowBlur = _sb(4);
                        // 绘制折线电弧
                        ctx.beginPath();
                        ctx.moveTo(-w / 2, arcY);
                        for (let si = 0; si <= arcSegs; si++) {
                            const sx = -w / 2 + (si / arcSegs) * w;
                            const jitter = (Math.sin(this.visualSeed * 10 + si * 3.7 + arcPhase * 5) * 0.5) * (h * 0.08);
                            ctx.lineTo(sx, arcY + jitter);
                        }
                        ctx.stroke();
                    }
                    ctx.restore();
                }
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
                // --- devour 词缀核心过曝叠加 ---
                {
                    const coreX = 0, coreY = 0;
                    const coreR = Math.min(w, h) * 0.18;
                    const affixPulsePhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2) * Math.PI * 2;
                    const affixPulseIntensity = Math.pow((Math.sin(affixPulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${affixPulseIntensity * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
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
                // --- healer 词缀核心过曝叠加 ---
                {
                    const coreX = 0, coreY = 0;
                    const coreR = Math.min(w, h) * 0.15;
                    const affixPulsePhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2) * Math.PI * 2;
                    const affixPulseIntensity = Math.pow((Math.sin(affixPulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${affixPulseIntensity * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
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
                // --- jump 词缀核心过曝叠加 ---
                {
                    const coreX = 0, coreY = h * 0.35;
                    const coreR = w * 0.12;
                    const affixPulsePhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2) * Math.PI * 2;
                    const affixPulseIntensity = Math.pow((Math.sin(affixPulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${affixPulseIntensity * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
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
                // --- clone 词缀核心过曝叠加（淡紫色，与细胞颜色语言一致）---
                {
                    const coreX = 0, coreY = 0;
                    const coreR = Math.min(w, h) * 0.2;
                    const affixPulsePhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2) * Math.PI * 2;
                    const affixPulseIntensity = Math.pow((Math.sin(affixPulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    coreGrad.addColorStop(0, `rgba(192, 132, 252, ${affixPulseIntensity * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    coreGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
                // --- [ELITE+] clone 精英增强：身体内部出现重影（小型偶尔偶尔的山山山山）---
                if (this.type === 'elite' || this.type === 'boss') {
                    const cloneEliteCfg = CONFIG.enemyRender;
                    const ghostOffset = cloneEliteCfg.eliteCloneGhostOffset;
                    const ghostAlpha = 0.22 * affixAlpha35;
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    // 在小小偏移处绘制一个缩小版本的本体轮廓（重影）
                    const ghostColor = this.type === 'boss' ? '239, 68, 68' : '192, 132, 252';
                    const ghostDriftX = Math.sin(t35 * 0.4 + this.visualSeed * 3) * ghostOffset;
                    const ghostDriftY = Math.cos(t35 * 0.3 + this.visualSeed * 2) * ghostOffset * 0.6;
                    ctx.strokeStyle = `rgba(${ghostColor}, ${ghostAlpha})`;
                    ctx.lineWidth = 1.5;
                    ctx.shadowColor = `rgba(${ghostColor}, 0.5)`;
                    ctx.shadowBlur = _sb(5);
                    // 重影轮廓：缩小到 0.85 倍
                    ctx.save();
                    ctx.translate(ghostDriftX, ghostDriftY);
                    ctx.scale(0.85, 0.85);
                    if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                        const verts = this.collisionData.vertices;
                        ctx.beginPath();
                        ctx.moveTo(verts[0].x, verts[0].y);
                        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        ctx.strokeRect(-w/2, -h/2, w, h);
                    }
                    ctx.restore();
                    ctx.restore();
                }
                // --- [BOSS+] clone Boss 增强：周围环绕轨道卫星（小圆点按轨道旋转）---
                if (this.type === 'boss') {
                    const cloneBossCfg = CONFIG.enemyRender;
                    const satCount = cloneBossCfg.bossCloneSatelliteCount;
                    const satOrbitR = Math.max(w, h) * 0.55;
                    const satR = 3.5;
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    for (let si = 0; si < satCount; si++) {
                        const satAngle = (si / satCount) * Math.PI * 2 + t35 * 0.7 + this.visualSeed * Math.PI;
                        const sx = Math.cos(satAngle) * satOrbitR;
                        const sy = Math.sin(satAngle) * satOrbitR;
                        const satAlpha = 0.6 * affixAlpha35;
                        // @section:draw_health_bar - 血条与护盾条绘制
                        const satGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, satR * 2.5);
                        satGrad.addColorStop(0, `rgba(255, 255, 255, ${satAlpha})`);
                        satGrad.addColorStop(0.5, `rgba(192, 132, 252, ${satAlpha * 0.7})`);
                        satGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
                        ctx.fillStyle = satGrad;
                        ctx.beginPath();
                        ctx.arc(sx, sy, satR * 2.5, 0, Math.PI * 2);
                        ctx.fill();
                        // 小圆点本体
                        ctx.fillStyle = `rgba(216, 180, 254, ${satAlpha})`;
                        ctx.beginPath();
                        ctx.arc(sx, sy, satR, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
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
                // --- berserk 词缀核心过曝叠加 + 橙色火花点 ---
                if (this.temp > 0) {
                    const berserkIntensityOvg = Math.min(1, this.temp / 100);
                    const coreX = 0, coreY = h * 0.4;
                    const coreR = w * 0.2;
                    const affixPulsePhase = (Date.now() / CONFIG.enemyRender.breathePeriod + this.visualSeed * 2) * Math.PI * 2;
                    const affixPulseIntensity = Math.pow((Math.sin(affixPulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower || 1.5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
                    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${affixPulseIntensity * berserkIntensityOvg * CONFIG.enemyRender.affixCoreOverglowAlpha})`);
                    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath(); ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2); ctx.fill();
                    // 额外绘制 3-4 个橙色火花点，模拟火焰跳动
                    const sparkCount = 3 + Math.floor(this.visualSeed * 2) % 2;
                    for (let si = 0; si < sparkCount; si++) {
                        const sparkSeed = this.visualSeed * 7 + si * 3.7;
                        const sparkX = (Math.sin(sparkSeed + Date.now() / 400) * 0.4) * w;
                        const sparkY = h * 0.2 + Math.abs(Math.sin(sparkSeed * 1.3 + Date.now() / 300)) * h * 0.3;
                        const sparkR = 2 + Math.abs(Math.sin(sparkSeed * 2.1 + Date.now() / 250)) * 2;
                        const sparkAlpha = (0.5 + Math.abs(Math.sin(sparkSeed + Date.now() / 350)) * 0.5) * berserkIntensityOvg;
                        const sparkGrad = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, sparkR);
                        sparkGrad.addColorStop(0, `rgba(255, 200, 50, ${sparkAlpha})`);
                        sparkGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
                        ctx.fillStyle = sparkGrad;
                        ctx.beginPath(); ctx.arc(sparkX, sparkY, sparkR, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.restore();
                }
            }

            // --- heavyArmor: 重装钢板纹路 + 铆钉（体积感厚重装甲）---
            if (this.affixes.includes('heavyArmor')) {
                ctx.save();
                const _haBreath = (Math.sin(t35 * 0.6 + this.visualSeed * Math.PI) + 1) * 0.5;
                const _haAlpha = (0.20 + _haBreath * 0.08) * affixAlpha35;
                // 水平装甲板分割线
                ctx.strokeStyle = `rgba(148, 163, 184, ${_haAlpha * 1.4})`;
                ctx.lineWidth = 2;
                const _haPlates = Math.max(2, Math.floor(h / 18));
                for (let pi = 1; pi < _haPlates; pi++) {
                    const _py = -h / 2 + pi * (h / _haPlates);
                    ctx.beginPath();
                    ctx.moveTo(-w / 2 + 3, _py);
                    ctx.lineTo(w / 2 - 3, _py);
                    ctx.stroke();
                }
                // 铆钉（四角 + 板中央）
                const _rivetColor = `rgba(203, 213, 225, ${_haAlpha * 1.8})`;
                ctx.fillStyle = _rivetColor;
                const _rivetR = Math.max(2, w * 0.045);
                const _rx = w / 2 - _rivetR - 3, _ry = h / 2 - _rivetR - 3;
                for (const [rx, ry] of [[-_rx, -_ry], [_rx, -_ry], [-_rx, _ry], [_rx, _ry]]) {
                    ctx.beginPath(); ctx.arc(rx, ry, _rivetR, 0, Math.PI * 2); ctx.fill();
                }
                // 中央钢印纹路（X形加强筋）
                ctx.strokeStyle = `rgba(100, 116, 139, ${_haAlpha * 0.9})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-w * 0.3, -h * 0.25); ctx.lineTo(w * 0.3, h * 0.25);
                ctx.moveTo(w * 0.3, -h * 0.25); ctx.lineTo(-w * 0.3, h * 0.25);
                ctx.stroke();
                // 重装词条：若有_moveCooldown则显示等待回合数
                if (this._moveCooldown > 0 && this.type !== 'boss') {
                    ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.28)}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = `rgba(148, 163, 184, ${0.55 + _haBreath * 0.35})`;
                    ctx.shadowColor = '#475569';
                    ctx.shadowBlur = 4;
                    ctx.fillText(`⏳${this._moveCooldown}`, 0, h * 0.15);
                }
                ctx.restore();
            }
        }

        // === Layer 3.55: V2 基底敌人轮廓美术（尺寸 × 基底 × 词条）===
        // 在通用词缀特效之后、词缀印章之前绘制，让大型敌人的基底身份先于小图标被识别。
        if (this.baseArchetype && this.type !== 'boss') {
            this._drawArchetypeBody(ctx, w, h);
        }
        // === Layer 3.6: 词缀组合标识章（印章图标）===
        // 顶部绘制每个词缀对应的几何印章，让玩家能直观识别词缀组合
        if (this.affixes && this.affixes.length > 0 && this.type !== 'boss') {
            this._drawAffixSigil(ctx, w, h);
        }

        // === Layer 3.8: Boss 专属装饰 ===
        if (this.type === 'boss' && this.bossType) {
            this._drawBossDecoration(ctx, w, h);
        }
        // === Layer 3.9: 精英专属装饰（晶化变异）===
        if (this.type === 'elite') {
            this._drawEliteDecoration(ctx, w, h);
        }
        // === Layer 3.9b: 大BOSS（6+ 词条）炫彩流光边框补充 ===
        // 大BOSS 的 E4 炫彩流光边框需要单独调用，不依赖 _drawEliteDecoration 的其他精英装饰
        if (this.type === 'boss' && this.affixes && this.affixes.length >= 6) {
            const _bossE4Cfg = CONFIG.enemyRender;
            const _bossE4T = Date.now() / 1000;
            const _bossPerimeter = 2 * (w + h);
            const _bossFlowPos = ((_bossE4T * _bossE4Cfg.eliteBorderRainbowFlowSpeed) % 1) * _bossPerimeter;
            const _bossFlowHW = _bossPerimeter * _bossE4Cfg.eliteBorderRainbowFlowWidth * 0.5;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const _bossSegs = [
                { x1: -w/2, y1: -h/2, x2: w/2, y2: -h/2 },
                { x1: w/2,  y1: -h/2, x2: w/2, y2: h/2  },
                { x1: w/2,  y1: h/2,  x2: -w/2, y2: h/2 },
                { x1: -w/2, y1: h/2,  x2: -w/2, y2: -h/2 }
            ];
            const _bossSegLens = [w, h, w, h];
            let _bossCumLen = 0;
            for (let _bsi = 0; _bsi < 4; _bsi++) {
                const _bSeg = _bossSegs[_bsi];
                const _bSegLen = _bossSegLens[_bsi];
                const _bLo = _bossFlowPos - _bossFlowHW;
                const _bHi = _bossFlowPos + _bossFlowHW;
                if (_bHi > _bossCumLen && _bLo < _bossCumLen + _bSegLen) {
                    const _bLocalLo = Math.max(_bLo, _bossCumLen) - _bossCumLen;
                    const _bLocalHi = Math.min(_bHi, _bossCumLen + _bSegLen) - _bossCumLen;
                    const _bt0 = _bLocalLo / _bSegLen;
                    const _bt1 = _bLocalHi / _bSegLen;
                    const _bpx0 = _bSeg.x1 + (_bSeg.x2 - _bSeg.x1) * _bt0;
                    const _bpy0 = _bSeg.y1 + (_bSeg.y2 - _bSeg.y1) * _bt0;
                    const _bpx1 = _bSeg.x1 + (_bSeg.x2 - _bSeg.x1) * _bt1;
                    const _bpy1 = _bSeg.y1 + (_bSeg.y2 - _bSeg.y1) * _bt1;
                    const _bGrad = ctx.createLinearGradient(_bpx0, _bpy0, _bpx1, _bpy1);
                    const _bHue0 = (Date.now() / 20 + _bsi * 90) % 360;
                    const _bHue1 = (_bHue0 + 60) % 360;
                    _bGrad.addColorStop(0, `hsla(${_bHue0}, 100%, 70%, 0)`);
                    _bGrad.addColorStop(0.5, `hsla(${(_bHue0 + _bHue1) / 2}, 100%, 85%, 0.95)`);
                    _bGrad.addColorStop(1, `hsla(${_bHue1}, 100%, 70%, 0)`);
                    ctx.strokeStyle = _bGrad;
                    ctx.lineWidth = _bossE4Cfg.borderTierRainbowWidth + 1; // Boss 比精英稍宽
                    ctx.shadowColor = `hsl(${_bHue0}, 100%, 65%)`;
                    ctx.shadowBlur = _sb(_bossE4Cfg.borderTierRainbowGlowBlur + 4); // Boss 光晕更强
                    ctx.beginPath();
                    ctx.moveTo(_bpx0, _bpy0);
                    ctx.lineTo(_bpx1, _bpy1);
                    ctx.stroke();
                }
                _bossCumLen += _bSegLen;
            }
            ctx.restore();
        }

        // === [Phase 5B Task 5.B3] Layer 3.95: Sprite Sheet 覆盖层（在血条和内部特效之后）===
        // Arc Boss 的 sprite 需在 clip 区域外绘制（否则被圆环裁剪），此处跳过它们
        // 非 arc boss 的 sprite 在 clip 内正常绘制
        if (this._spriteRenderer && this._spriteRenderer.ready &&
            !(this.type === 'boss' && this.collisionShape === 'arc')) {
            // Sprite 保持正方形比例（取 min(w,h) 作为边长），居中偏下绘制
            // 偏下量 = h * 0.15，让贴图在方块内偏向下方（血量显示在顶部，贴图在中下方）
            const sprSize1 = Math.min(w, h);
            const sprOffsetY1 = h * 0.15; // 向下偏移量
            this._spriteRenderer.draw(ctx, -sprSize1/2, -sprSize1/2 + sprOffsetY1, sprSize1, sprSize1, 0.85);
        }
        // === Layer 4: 裂纹绘制 (Fissures) - [保持不变] ===

        // **过热 Stage 3**
        if (this.temp >= 67) {
            const crackAlpha = Math.min(1, (this.temp - 60) / 40);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; 
            ctx.strokeStyle = `rgba(255, 255, 255, ${crackAlpha * 0.9})`;
            ctx.shadowColor = '#f97316'; ctx.shadowBlur = _sb(10); ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
            ctx.shadowBlur = _sb(10);
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
        // === 边框分级样式（Border Tier）：根据词条数量 + Boss 类型决定边框颜色/线宽 ===
        // @perf-impact: 仅替换 strokeStyle/lineWidth，无额外 Canvas 操作，性能影响极低
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; // 默认：0 词条（无特殊边框）
        if (this.type === 'boss') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; } // Boss 保持红色基础边框
        if (this.type === 'elite' || this.type === 'boss') {
            const affixCount = this.affixes ? this.affixes.length : 0;
            const tierCfg = CONFIG.enemyRender;
            // 大BOSS（6+ 词条）或 boss 类型：炫彩流光边框（颜色在 D3/E4 流光中动态计算，此处用金色占位）
            const isLargeBoss = this.type === 'boss' && affixCount >= 6;
            // 小BOSS（boss 类型但词条 < 6）或 4-5 词条精英：金边框
            const isGoldTier = (this.type === 'boss' && affixCount < 6) || (this.type === 'elite' && affixCount >= 4);
            if (isLargeBoss) {
                // 炫彩流光：基础边框用金色，流光动态色彩由 E4 节渲染
                ctx.strokeStyle = tierCfg.borderTierGoldColor;
                ctx.lineWidth = tierCfg.borderTierRainbowWidth;
            } else if (isGoldTier) {
                ctx.strokeStyle = tierCfg.borderTierGoldColor;
                ctx.lineWidth = tierCfg.borderTierGoldWidth;
            } else if (affixCount === 3) {
                ctx.strokeStyle = tierCfg.borderTierSilverColor;
                ctx.lineWidth = tierCfg.borderTierSilverWidth;
            } else if (affixCount === 2) {
                ctx.strokeStyle = tierCfg.borderTierBronzeColor;
                ctx.lineWidth = tierCfg.borderTierBronzeWidth;
            } else if (affixCount === 1) {
                ctx.strokeStyle = tierCfg.borderTierIronColor;
                ctx.lineWidth = tierCfg.borderTierIronWidth;
            } else {
                // 0 词条精英：无特殊边框（保持默认灰色）
                ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
            }
        }

        // [新增] 预警时边框闪烁白色
        if (this.actionPhase === 'telegraphing') {
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = _sb(15);
        }

        // 根据形状类型选择边框绘制方式：polygon 用多边形，arc 用圆弧，其余用 strokeRect
        if (this.collisionShape === 'polygon' &&
            this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
            // 多边形边框—— Boss 和随从均适用
            ctx.beginPath();
            const verts = this.collisionData.vertices;
            // @section:draw_affix_icons - 词缀图标与状态标记
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
        // === D3: 边框脉冲光晕（Border Pulse Glow）===
        // 仅在 idle 状态下生效，为边框叠加一层缓慢脉冲的 shadowBlur 光晕
        // 升级：使用非线性缓动曲线 + elite/boss 差异化强度 + 峰値过曝高光叠加
        if (this.actionPhase === 'idle') {
            const now = Date.now();
            // boss 脉冲周期缩短（乘以 borderPulseBossPeriodMult），体现威压感
            const pulsePeriod = this.type === 'boss'
                ? CONFIG.enemyRender.borderPulsePeriod * CONFIG.enemyRender.borderPulseBossPeriodMult
                : CONFIG.enemyRender.borderPulsePeriod;
            const pulsePhase = (now / pulsePeriod + this.visualSeed * 0.7) * Math.PI * 2;
            // 升级：使用 Math.pow 非线性缓动曲线，增强极大値停留感
            const pulseIntensity = Math.pow((Math.sin(pulsePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower);
            // 根据词条数分级应用差异化光晕强度倍率
            let blurMultiplier = 1.0;
            if (this.type === 'boss') blurMultiplier = CONFIG.enemyRender.borderPulseBossMultiplier;
            else if (this.type === 'elite') {
                const _ac = this.affixes ? this.affixes.length : 0;
                // 光晕强度随词条数阶梯升高：铁(0.5) 铜(0.8) 银(1.1) 金(1.8) 炫彩(2.2)
                if (_ac >= 6) blurMultiplier = 2.2;
                else if (_ac >= 4) blurMultiplier = CONFIG.enemyRender.borderPulseEliteMultiplier; // 1.8
                else if (_ac === 3) blurMultiplier = 1.1;
                else if (_ac === 2) blurMultiplier = 0.8;
                else if (_ac === 1) blurMultiplier = 0.5;
                else blurMultiplier = 0.3; // 0 词条几乎无光晕
            }
            const pulseBlur = pulseIntensity * CONFIG.enemyRender.borderPulseBlurMax * blurMultiplier;
            // 边框分级光晕颜色：根据词条数和 Boss 类型匹配对应级别
            let pulseColor = CONFIG.enemyRender.borderPulseColorNormal;
            if (this.type === 'elite' || this.type === 'boss') {
                const _affixCount = this.affixes ? this.affixes.length : 0;
                const _isLargeBoss = this.type === 'boss' && _affixCount >= 6;
                const _isGoldTier = (this.type === 'boss' && _affixCount < 6) || (this.type === 'elite' && _affixCount >= 4);
                if (_isLargeBoss) {
                    // 炫彩流光：光晕颜色随时间循环彩虹渐变
                    const _hue = (Date.now() / 30) % 360;
                    pulseColor = `hsl(${_hue}, 100%, 65%)`;
                } else if (_isGoldTier) {
                    pulseColor = CONFIG.enemyRender.borderTierGoldGlow;
                } else if (_affixCount === 3) {
                    pulseColor = CONFIG.enemyRender.borderTierSilverGlow;
                } else if (_affixCount === 2) {
                    pulseColor = CONFIG.enemyRender.borderTierBronzeGlow;
                } else if (_affixCount === 1) {
                    pulseColor = CONFIG.enemyRender.borderTierIronGlow;
                } else {
                    // 0 词条：使用默认灰色
                    pulseColor = CONFIG.enemyRender.borderPulseColorNormal;
                }
            }
            ctx.shadowColor = pulseColor;
            ctx.shadowBlur = _sb(pulseBlur);
            // 重绘一次边框以应用光晕（不改变已有边框颜色）
            if (this.collisionShape === 'polygon' &&
                this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                ctx.beginPath();
                const verts = this.collisionData.vertices;
                ctx.moveTo(verts[0].x, verts[0].y);
                for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
                ctx.closePath();
                ctx.stroke();
            } else if (this.type === 'boss' && this.collisionShape === 'arc' && this.collisionData) {
                const cd = this.collisionData;
                const outerR = cd.radius + cd.thickness * 0.5;
                ctx.beginPath();
                ctx.arc(0, 0, outerR, 0, Math.PI * 2, false);
                ctx.stroke();
            } else {
                ctx.strokeRect(-w/2, -h/2, w, h);
            }
            // 在 pulseBlur 达到峰値时额外叠加一层 lighter 模式的高光描边，模拟 brightness 过曝效果
            const overglowAlpha = pulseIntensity * CONFIG.enemyRender.borderPulseOverglowAlpha;
            if (overglowAlpha > 0.01) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.shadowBlur = 0; // 过曝层不需要额外 shadowBlur
                ctx.strokeStyle = pulseColor.replace('#', 'rgba(').replace(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i,
                    (m, r, g, b) => `${parseInt(r,16)}, ${parseInt(g,16)}, ${parseInt(b,16)}, ${overglowAlpha.toFixed(3)})`);
                if (ctx.strokeStyle === pulseColor) {
                    // 如果替换失败，直接使用固定色并设置透明度
                    ctx.globalAlpha = overglowAlpha;
                    ctx.strokeStyle = pulseColor;
                }
                if (this.collisionShape === 'polygon' &&
                    this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                    ctx.beginPath();
                    const verts = this.collisionData.vertices;
                    ctx.moveTo(verts[0].x, verts[0].y);
                    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
                    ctx.closePath();
                    ctx.stroke();
                } else if (this.type === 'boss' && this.collisionShape === 'arc' && this.collisionData) {
                    const cd = this.collisionData;
                    const outerR = cd.radius + cd.thickness * 0.5;
                    ctx.beginPath();
                    ctx.arc(0, 0, outerR, 0, Math.PI * 2, false);
                    ctx.stroke();
                } else {
                    ctx.strokeRect(-w/2, -h/2, w, h);
                }
                ctx.restore();
            }
        }
        ctx.shadowBlur = 0; // 重置

        if (this.swordCracks.length > 0) {
            ctx.save();
            ctx.strokeStyle = '#0ea5e9'; // 飞剑的青色
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.shadowBlur = _sb(5);
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
            ctx.shadowBlur = _sb(15);
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

        // === Layer 3.95b: Arc Boss Sprite（裁剪区域外绘制，完整呈现美术资产）===
        // Arc boss 的圆环裁剪区域会遮挡中央 sprite，因此在 clip 恢复后单独绘制，
        // 使 sprite 完整显示在圆环内部及周围区域。
        if (this.type === 'boss' && this.collisionShape === 'arc' &&
            this._spriteRenderer && this._spriteRenderer.ready) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            // 对 arc boss 使用较大的 sprite 尺寸（直径约等于圆环直径），居中不偏移
            const _arcSprW = this.width - 4;
            const _arcSprH = this.height - 4;
            const _arcSprSize = Math.min(_arcSprW, _arcSprH) * 0.9;
            this._spriteRenderer.draw(ctx, -_arcSprSize / 2, -_arcSprSize / 2, _arcSprSize, _arcSprSize, 0.90);
            ctx.restore();
        }

        // === Layer 6: 外部特效 (光环/冰壳) ===

        // **Boss 深渊黑晕（Abyssal Aura）——吸光压迫感**
        if (this.type === 'boss') {
            const abyssalCfg = CONFIG.enemyRender;
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            ctx.shadowColor = abyssalCfg.bossAbyssalAuraColor;
            ctx.shadowBlur = _sb(abyssalCfg.bossAbyssalAuraBlur);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0)'; // 透明描边，仅依靠 shadowBlur 投射阴影
            ctx.lineWidth = 6;
            if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                const verts = this.collisionData.vertices;
                ctx.beginPath();
                ctx.moveTo(verts[0].x, verts[0].y);
                for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
                ctx.closePath();
                ctx.stroke();
            } else if (this.collisionShape === 'arc' && this.collisionData) {
                const cd = this.collisionData;
                ctx.beginPath();
                ctx.arc(0, 0, cd.radius + cd.thickness * 0.5, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeRect(-w/2 - 3, -h/2 - 3, w + 6, h + 6);
            }
            ctx.restore();
        }

        // **Boss 熔岩脉络（Magma Veins）——动态熔岩纹路呼吸**
        if (this.type === 'boss' && this.actionPhase === 'idle') {
            const magmaCfg = CONFIG.enemyRender;
            const magmaT = Date.now() / 1000;
            const magmaPhase = (magmaT / (magmaCfg.bossMagmaVeinPeriod / 1000) + this.visualSeed * 2) * Math.PI * 2;
            const magmaIntensity = Math.pow((Math.sin(magmaPhase) + 1) * 0.5, 1.5);
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
            ctx.globalCompositeOperation = 'screen';
            // 绘制 3 条熔岩纹路，使用 visualSeed 确定起点和方向
            const veinCount = 3;
            for (let vi = 0; vi < veinCount; vi++) {
                const vSeed = this.visualSeed * 5 + vi * 1.7;
                const startX = (Math.sin(vSeed) * 0.45) * w;
                const startY = (Math.cos(vSeed * 1.3) * 0.45) * h;
                const endX = (Math.sin(vSeed + Math.PI * 0.7) * 0.45) * w;
                const endY = (Math.cos(vSeed * 0.8 + 1.2) * 0.45) * h;
                const veinAlpha = magmaCfg.bossMagmaVeinAlpha * magmaIntensity * (0.5 + vi * 0.25);
                const veinGrad = ctx.createLinearGradient(startX, startY, endX, endY);
                veinGrad.addColorStop(0, `rgba(239, 68, 68, 0)`);
                veinGrad.addColorStop(0.3, `rgba(249, 115, 22, ${veinAlpha})`);
                veinGrad.addColorStop(0.7, `rgba(239, 68, 68, ${veinAlpha * 0.8})`);
                veinGrad.addColorStop(1, `rgba(239, 68, 68, 0)`);
                ctx.strokeStyle = veinGrad;
                ctx.lineWidth = 1.5 + magmaIntensity;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = _sb(4 + magmaIntensity * 4);
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                // 中间加一个微小弯曲点
                const midX = (startX + endX) / 2 + (Math.sin(vSeed * 3) * 0.2) * w;
                const midY = (startY + endY) / 2 + (Math.cos(vSeed * 2.5) * 0.2) * h;
                ctx.quadraticCurveTo(midX, midY, endX, endY);
                // @section:draw_boss_name_plate - Boss 名牌与阶段指示器
                ctx.stroke();
            }
            ctx.restore();
        }

        // **Boss 狂暴闪烁（Berserk Flicker）——狂暴后外壳层层剥落暴露白核**
        if (this.type === 'boss' && this.berserked) {
            const flickerCfg = CONFIG.enemyRender;
            const flickerT = Date.now() / 1000;
            // 高频闪烁：使用 sin 高频振荡模拟闪烁
            const flickerRaw = Math.sin(flickerT * flickerCfg.bossBerserkFlickerHz * Math.PI * 2 + this.visualSeed * 10);
            const flickerIntensity = Math.pow(Math.max(0, flickerRaw), 3); // 仅保留峰値阶段
            if (flickerIntensity > 0.05) {
                ctx.save();
                ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);
                ctx.globalCompositeOperation = 'lighter';
                const flickerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.6);
                flickerGrad.addColorStop(0, `rgba(255, 255, 255, ${flickerCfg.bossBerserkCoreAlpha * flickerIntensity})`);
                flickerGrad.addColorStop(0.4, `rgba(239, 68, 68, ${flickerCfg.bossBerserkCoreAlpha * flickerIntensity * 0.5})`);
                flickerGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                ctx.fillStyle = flickerGrad;
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(w, h) * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

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
            ctx.shadowBlur = _sb(20 + outerPulse * 15);
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
            ctx.shadowBlur = _sb(10 + innerPulse * 8);
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
            ctx.shadowBlur = _sb(15 + pulse * 10);
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
            ctx.shadowBlur = _sb(10);
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

        // === Layer 6.8: 奖励标记敌人专属光晕 (Pending Reward Halo) ===
        // @perf-impact: 新增 shadowBlur + createRadialGradient + 旋转符文/晶体 - 已通过 rewardHaloEnabled/rewardRuneCount/rewardCrystalCount 三档门控
        // [V2] 兼容新字段 rewardType 和旧字段 _pendingRewardType
        const _effectiveRewardType = this.rewardType !== undefined ? this.rewardType : this._pendingRewardType;
        if (_effectiveRewardType && this.actionPhase === 'idle') {
            const _perfBudget = (typeof game !== 'undefined' && game.perfQualityLevel)
                ? CONFIG.performance[game.perfQualityLevel]
                : CONFIG.performance.high;
            if (_perfBudget.rewardHaloEnabled) {
                const _rc = CONFIG.enemyRender;
                const _now = Date.now();

                if (_effectiveRewardType === 'relic') {
                    // --- 遗物（relic）：「宝藏封印」风格 ---
                    // 借用精英 E2 虚空晶核（金色版）+ E4 流光金边 + 双层脉冲环
                    const _relicPhase = (_now / _rc.relicHaloPeriod + this.visualSeed * 0.5) * Math.PI * 2;
                    const _relicIntensity = (Math.sin(_relicPhase) + 1) * 0.5;
                    const _relicT = _now / 1000;
                    ctx.save();
                    ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);

                    // --- R1: 外圈金色脉冲光晕（双层描边）---
                    ctx.shadowColor = _rc.relicHaloColor;
                    ctx.shadowBlur = _sb(_relicIntensity * _rc.relicHaloBlurMax);
                    ctx.strokeStyle = `rgba(250, 204, 21, ${_relicIntensity * _rc.relicHaloStrokeAlpha})`;
                    ctx.lineWidth = 2.5;
                    if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                        const _verts = this.collisionData.vertices;
                        ctx.beginPath();
                        ctx.moveTo(_verts[0].x * 1.14, _verts[0].y * 1.14);
                        for (let _i = 1; _i < _verts.length; _i++) ctx.lineTo(_verts[_i].x * 1.14, _verts[_i].y * 1.14);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.roundRect(-w/2 - 9, -h/2 - 9, w + 18, h + 18, r + 5);
                        ctx.stroke();
                    }
                    // 内圈琥珀色描边（偏移一层，体现双层封印）
                    ctx.shadowColor = _rc.relicHaloColorInner;
                    ctx.shadowBlur = _sb(_relicIntensity * _rc.relicHaloInnerBlurMax);
                    ctx.strokeStyle = `rgba(245, 158, 11, ${_relicIntensity * _rc.relicHaloStrokeAlpha * 0.7})`;
                    ctx.lineWidth = 1.5;
                    if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                        const _verts = this.collisionData.vertices;
                        ctx.beginPath();
                        ctx.moveTo(_verts[0].x * 1.07, _verts[0].y * 1.07);
                        for (let _i = 1; _i < _verts.length; _i++) ctx.lineTo(_verts[_i].x * 1.07, _verts[_i].y * 1.07);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.roundRect(-w/2 - 4, -h/2 - 4, w + 8, h + 8, r + 2);
                        ctx.stroke();
                    }

                    // --- R2: 金色旋转晶核（借用精英 E2 虚空晶核，金色版）---
                    const _relicCoreR = Math.min(w, h) * _rc.relicCoreRadiusRatio;
                    const _relicCoreAngle = _relicT * _rc.relicCoreRotateSpeed + this.visualSeed * Math.PI;
                    ctx.save();
                    ctx.rotate(_relicCoreAngle);
                    const _relicCoreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, _relicCoreR);
                    _relicCoreGrad.addColorStop(0, `rgba(255, 251, 180, ${0.95 * (0.6 + _relicIntensity * 0.4)})`);
                    _relicCoreGrad.addColorStop(0.5, `rgba(250, 204, 21, ${0.7 * (0.5 + _relicIntensity * 0.5)})`);
                    _relicCoreGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
                    ctx.fillStyle = _relicCoreGrad;
                    ctx.shadowColor = '#facc15';
                    ctx.shadowBlur = _sb(10 + _relicIntensity * 8);
                    // 菱形晶核路径（与精英 E2 一致）
                    ctx.beginPath();
                    ctx.moveTo(0, -_relicCoreR);
                    ctx.lineTo(_relicCoreR * 0.55, 0);
                    ctx.lineTo(0, _relicCoreR);
                    ctx.lineTo(-_relicCoreR * 0.55, 0);
                    ctx.closePath();
                    ctx.fill();
                    // 晶核描边（亮金色）
                    ctx.strokeStyle = `rgba(255, 255, 200, ${0.6 + _relicIntensity * 0.35})`;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                    ctx.restore();

                    // --- R3: 晶核过曝叠加（lighter 模式，金色能量溢出）---
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const _relicOverglowR = _relicCoreR * 1.8;
                    const _relicOverglowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, _relicOverglowR);
                    _relicOverglowGrad.addColorStop(0, `rgba(250, 204, 21, ${0.35 * _relicIntensity})`);
                    _relicOverglowGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                    ctx.fillStyle = _relicOverglowGrad;
                    ctx.beginPath();
                    ctx.arc(0, 0, _relicOverglowR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    // --- R4: 流光金边（借用精英 E4，高光点沿边框流动）---
                    const _relicPerimeter = 2 * (w + h);
                    const _relicFlowPos = ((_relicT * _rc.relicBorderFlowSpeed) % 1) * _relicPerimeter;
                    const _relicFlowHalfW = _relicPerimeter * _rc.relicBorderFlowWidth * 0.5;
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const _relicSegments = [
                        { x1: -w/2, y1: -h/2, x2: w/2, y2: -h/2 },
                        { x1: w/2,  y1: -h/2, x2: w/2, y2: h/2  },
                        { x1: w/2,  y1: h/2,  x2: -w/2, y2: h/2 },
                        { x1: -w/2, y1: h/2,  x2: -w/2, y2: -h/2 }
                    ];
                    const _relicSegLens = [w, h, w, h];
                    let _relicCumLen = 0;
                    for (let _si = 0; _si < 4; _si++) {
                        const _seg = _relicSegments[_si];
                        const _segLen = _relicSegLens[_si];
                        const _lo = _relicFlowPos - _relicFlowHalfW;
                        const _hi = _relicFlowPos + _relicFlowHalfW;
                        if (_hi > _relicCumLen && _lo < _relicCumLen + _segLen) {
                            const _localLo = Math.max(_lo, _relicCumLen) - _relicCumLen;
                            const _localHi = Math.min(_hi, _relicCumLen + _segLen) - _relicCumLen;
                            const _t0 = _localLo / _segLen;
                            const _t1 = _localHi / _segLen;
                            const _px0 = _seg.x1 + (_seg.x2 - _seg.x1) * _t0;
                            const _py0 = _seg.y1 + (_seg.y2 - _seg.y1) * _t0;
                            const _px1 = _seg.x1 + (_seg.x2 - _seg.x1) * _t1;
                            const _py1 = _seg.y1 + (_seg.y2 - _seg.y1) * _t1;
                            const _relicFlowGrad = ctx.createLinearGradient(_px0, _py0, _px1, _py1);
                            _relicFlowGrad.addColorStop(0, 'rgba(250, 204, 21, 0)');
                            _relicFlowGrad.addColorStop(0.5, 'rgba(255, 255, 180, 0.9)');
                            _relicFlowGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                            ctx.strokeStyle = _relicFlowGrad;
                            ctx.lineWidth = 3.5;
                            ctx.shadowColor = '#facc15';
                            ctx.shadowBlur = _sb(10);
                            ctx.beginPath();
                            ctx.moveTo(_px0, _py0);
                            ctx.lineTo(_px1, _py1);
                            ctx.stroke();
                        }
                        _relicCumLen += _segLen;
                    }
                    ctx.restore();

                    ctx.restore();
                    // 王冠图标浮动（替换宝箱，更符合遗物"珍贵宝物"语义）
                    const _relicFloatY = Math.sin((_now / _rc.relicIconFloatPeriod + this.visualSeed) * Math.PI * 2) * _rc.relicIconFloatAmplitude;
                    ctx.save();
                    ctx.font = `${_rc.relicIconFontSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = _rc.relicHaloColor;
                    ctx.shadowBlur = _sb(12);
                    ctx.fillText('👑', this.pos.x, this.pos.y + this.bumpOffsetY - h/2 + _rc.relicIconOffsetY + _relicFloatY);
                    ctx.restore();

                } else if (_effectiveRewardType === 'chaos_essence') {
                    // --- 混沌精华（chaos_essence）：「混沌侵蚀」风格 ---
                    // 借用精英 E1 晶化切面（紫/红混沌版）+ 快速旋转混沌晶核 + 六芒星符文
                    const _chaosPhase = (_now / _rc.chaosHaloPeriod + this.visualSeed * 0.8) * Math.PI * 2;
                    const _chaosIntensity = (Math.sin(_chaosPhase) + 1) * 0.5;
                    const _chaosT = _now / 1000;
                    ctx.save();
                    ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);

                    // --- C1: 混沌晶化切面（借用精英 E1，紫/红混沌色系）---
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    const _chaosFacetAlpha = _rc.chaosCrystalFacetAlpha * (0.7 + _chaosIntensity * 0.3);
                    const _chaosFacetColors = ['rgba(168, 85, 247, ', 'rgba(239, 68, 68, ', 'rgba(196, 80, 220, '];
                    for (let _fi = 0; _fi < 3; _fi++) {
                        const _fSeed = this.visualSeed * 7 + _fi * 2.3;
                        // 切面随时间缓慢变形（体现混沌不稳定性）
                        const _fDrift = _chaosT * 0.3 + _fi * 1.1;
                        const _fx1 = (Math.sin(_fSeed + _fDrift * 0.1) * 0.5) * w;
                        const _fy1 = (Math.cos(_fSeed * 1.3 + _fDrift * 0.08) * 0.5) * h;
                        const _fx2 = (Math.sin(_fSeed + 1.2 + _fDrift * 0.07) * 0.5) * w;
                        const _fy2 = (Math.cos(_fSeed * 0.9 + 0.8 + _fDrift * 0.09) * 0.5) * h;
                        const _fx3 = (Math.sin(_fSeed + 2.4 + _fDrift * 0.06) * 0.5) * w;
                        const _fy3 = (Math.cos(_fSeed * 1.1 + 1.6 + _fDrift * 0.11) * 0.5) * h;
                        ctx.beginPath();
                        ctx.moveTo(_fx1, _fy1);
                        ctx.lineTo(_fx2, _fy2);
                        ctx.lineTo(_fx3, _fy3);
                        ctx.closePath();
                        ctx.fillStyle = `${_chaosFacetColors[_fi % _chaosFacetColors.length]}${(_chaosFacetAlpha * (0.6 + _fi * 0.2)).toFixed(3)})`;
                        ctx.fill();
                    }
                    ctx.restore();

                    // --- C2: 混沌晶核（快速旋转，体现混沌不稳定）---
                    const _chaosCoreR = Math.min(w, h) * _rc.chaosCoreRadiusRatio;
                    const _chaosCoreAngle = _chaosT * _rc.chaosCoreRotateSpeed + this.visualSeed * Math.PI;
                    ctx.save();
                    ctx.rotate(_chaosCoreAngle);
                    const _chaosCoreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, _chaosCoreR);
                    _chaosCoreGrad.addColorStop(0, `rgba(255, 200, 255, ${0.9 * (0.5 + _chaosIntensity * 0.5)})`);
                    _chaosCoreGrad.addColorStop(0.4, `rgba(168, 85, 247, ${0.7 * (0.4 + _chaosIntensity * 0.6)})`);
                    _chaosCoreGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                    ctx.fillStyle = _chaosCoreGrad;
                    ctx.shadowColor = '#a855f7';
                    ctx.shadowBlur = _sb(8 + _chaosIntensity * 7);
                    // 不规则多边形晶核（5顶点，体现混沌不规则）
                    ctx.beginPath();
                    for (let _pi = 0; _pi < 5; _pi++) {
                        const _pAngle = (_pi / 5) * Math.PI * 2 - Math.PI / 2;
                        const _pR = _chaosCoreR * (0.7 + (_pi % 2) * 0.3);
                        const _px = Math.cos(_pAngle) * _pR;
                        const _py = Math.sin(_pAngle) * _pR;
                        if (_pi === 0) ctx.moveTo(_px, _py); else ctx.lineTo(_px, _py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    // 晶核描边（紫红交替）
                    ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + _chaosIntensity * 0.4})`;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                    ctx.restore();

                    // --- C3: 双圈混沌光晕描边 ---
                    ctx.shadowColor = _rc.chaosHaloColorInner;
                    ctx.shadowBlur = _sb(_chaosIntensity * _rc.chaosHaloBlurMax);
                    const _chaosAlpha = _chaosIntensity * _rc.chaosHaloStrokeAlpha;
                    ctx.strokeStyle = `rgba(168, 85, 247, ${_chaosAlpha})`;
                    ctx.lineWidth = 2;
                    if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                        const _verts = this.collisionData.vertices;
                        ctx.beginPath();
                        ctx.moveTo(_verts[0].x * 1.10, _verts[0].y * 1.10);
                        for (let _i = 1; _i < _verts.length; _i++) ctx.lineTo(_verts[_i].x * 1.10, _verts[_i].y * 1.10);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.roundRect(-w/2 - 6, -h/2 - 6, w + 12, h + 12, r + 3);
                        ctx.stroke();
                    }
                    ctx.shadowColor = _rc.chaosHaloColorOuter;
                    ctx.strokeStyle = `rgba(239, 68, 68, ${_chaosAlpha * 0.65})`;
                    ctx.lineWidth = 1.5;
                    if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                        const _verts = this.collisionData.vertices;
                        ctx.beginPath();
                        ctx.moveTo(_verts[0].x * 1.19, _verts[0].y * 1.19);
                        for (let _i = 1; _i < _verts.length; _i++) ctx.lineTo(_verts[_i].x * 1.19, _verts[_i].y * 1.19);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.roundRect(-w/2 - 13, -h/2 - 13, w + 26, h + 26, r + 7);
                        ctx.stroke();
                    }

                    // --- C4: 旋转六芒星符文粒子（替换原有符文，更具魔法感）---
                    const _chaosRuneCount = _perfBudget.rewardRuneCount;
                    if (_chaosRuneCount > 0) {
                        // 六芒星 ✡ 和混沌符文交替，颜色紫/红交替
                        const _chaosRunes = ['✡', '✦', '✡', '✦'];
                        const _orbitR = Math.max(w, h) * _rc.chaosRuneOrbitRadius;
                        const _baseAngle = _now * _rc.chaosRuneRotateSpeed;
                        ctx.font = `bold ${_rc.chaosRuneFontSize}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        for (let _ri = 0; _ri < _chaosRuneCount; _ri++) {
                            const _angle = _baseAngle + (_ri / _chaosRuneCount) * Math.PI * 2;
                            const _rx = Math.cos(_angle) * _orbitR;
                            const _ry = Math.sin(_angle) * _orbitR;
                            const _runeAlpha = 0.55 + _chaosIntensity * 0.45;
                            ctx.shadowColor = _ri % 2 === 0 ? _rc.chaosHaloColorInner : _rc.chaosHaloColorOuter;
                            ctx.shadowBlur = _sb(8);
                            ctx.fillStyle = _ri % 2 === 0
                                ? `rgba(168, 85, 247, ${_runeAlpha})`
                                : `rgba(239, 68, 68, ${_runeAlpha})`;
                            ctx.fillText(_chaosRunes[_ri % _chaosRunes.length], _rx, _ry);
                        }
                    }
                    ctx.restore();

                // @section:draw_attack_indicators - 攻击预警指示器绘制
                } else if (_effectiveRewardType === 'pure_essence') {
                    // --- 纯净精华（pure_essence）：「晶化净化」风格 ---
                    // 借用精英 E2 虚空晶核（冰晶版）+ E3 过曝叠加 + 六角雪花旋转
                    const _purePhase = (_now / _rc.pureHaloPeriod + this.visualSeed * 0.6) * Math.PI * 2;
                    const _pureIntensity = Math.pow((Math.sin(_purePhase) + 1) * 0.5, 1.5); // 非线性缓动
                    const _pureT = _now / 1000;
                    ctx.save();
                    ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY);

                    // --- P1: 冰晶切面（借用精英 E1，白/蓝冰晶色系）---
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    const _pureFacetAlpha = _rc.pureCrystalFacetAlpha * (0.6 + _pureIntensity * 0.4);
                    const _pureFacetColors = ['rgba(219, 234, 254, ', 'rgba(147, 197, 253, ', 'rgba(255, 255, 255, '];
                    for (let _fi = 0; _fi < 3; _fi++) {
                        const _fSeed = this.visualSeed * 7 + _fi * 2.3;
                        const _fx1 = (Math.sin(_fSeed) * 0.5) * w;
                        const _fy1 = (Math.cos(_fSeed * 1.3) * 0.5) * h;
                        const _fx2 = (Math.sin(_fSeed + 1.2) * 0.5) * w;
                        const _fy2 = (Math.cos(_fSeed * 0.9 + 0.8) * 0.5) * h;
                        const _fx3 = (Math.sin(_fSeed + 2.4) * 0.5) * w;
                        const _fy3 = (Math.cos(_fSeed * 1.1 + 1.6) * 0.5) * h;
                        ctx.beginPath();
                        ctx.moveTo(_fx1, _fy1);
                        ctx.lineTo(_fx2, _fy2);
                        ctx.lineTo(_fx3, _fy3);
                        ctx.closePath();
                        ctx.fillStyle = `${_pureFacetColors[_fi % _pureFacetColors.length]}${(_pureFacetAlpha * (0.5 + _fi * 0.25)).toFixed(3)})`;
                        ctx.fill();
                    }
                    ctx.restore();

                    // --- P2: 冰晶核心（借用精英 E2，白/蓝渐变，缓慢旋转）---
                    const _pureCoreR = Math.min(w, h) * _rc.pureCoreRadiusRatio;
                    const _pureCoreAngle = _pureT * _rc.pureCoreRotateSpeed + this.visualSeed * Math.PI;
                    ctx.save();
                    ctx.rotate(_pureCoreAngle);
                    const _pureCoreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, _pureCoreR);
                    _pureCoreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * (0.6 + _pureIntensity * 0.4)})`);
                    _pureCoreGrad.addColorStop(0.5, `rgba(191, 219, 254, ${0.7 * (0.5 + _pureIntensity * 0.5)})`);
                    _pureCoreGrad.addColorStop(1, 'rgba(96, 165, 250, 0)');
                    ctx.fillStyle = _pureCoreGrad;
                    ctx.shadowColor = '#bfdbfe';
                    ctx.shadowBlur = _sb(8 + _pureIntensity * 6);
                    // 六边形晶核（体现冰晶结构）
                    ctx.beginPath();
                    for (let _pi = 0; _pi < 6; _pi++) {
                        const _pAngle = (_pi / 6) * Math.PI * 2 - Math.PI / 6;
                        const _px = Math.cos(_pAngle) * _pureCoreR;
                        const _py = Math.sin(_pAngle) * _pureCoreR;
                        if (_pi === 0) ctx.moveTo(_px, _py); else ctx.lineTo(_px, _py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    // 晶核描边（冰蓝色）
                    ctx.strokeStyle = `rgba(147, 197, 253, ${0.5 + _pureIntensity * 0.4})`;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                    ctx.restore();

                    // --- P3: 晶核过曝叠加（借用精英 E3，lighter 模式白色能量溢出）---
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const _pureOverglowR = _pureCoreR * 1.8;
                    const _pureOverglowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, _pureOverglowR);
                    _pureOverglowGrad.addColorStop(0, `rgba(191, 219, 254, ${_rc.pureCoreOverglowAlpha * _pureIntensity})`);
                    _pureOverglowGrad.addColorStop(1, 'rgba(191, 219, 254, 0)');
                    ctx.fillStyle = _pureOverglowGrad;
                    ctx.beginPath();
                    ctx.arc(0, 0, _pureOverglowR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    // --- P4: 外圈蓝白光晕描边（双层）---
                    ctx.shadowColor = _rc.pureHaloColorOuter;
                    ctx.shadowBlur = _sb(_pureIntensity * _rc.pureHaloBlurMax);
                    const _pureAlpha = _pureIntensity * _rc.pureHaloStrokeAlpha;
                    ctx.strokeStyle = `rgba(191, 219, 254, ${_pureAlpha})`;
                    ctx.lineWidth = 2;
                    if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                        const _verts = this.collisionData.vertices;
                        ctx.beginPath();
                        ctx.moveTo(_verts[0].x * 1.12, _verts[0].y * 1.12);
                        for (let _i = 1; _i < _verts.length; _i++) ctx.lineTo(_verts[_i].x * 1.12, _verts[_i].y * 1.12);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.roundRect(-w/2 - 8, -h/2 - 8, w + 16, h + 16, r + 4);
                        ctx.stroke();
                    }
                    // 内圈纯白光晕（lighter 模式叠加）
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.shadowColor = _rc.pureHaloColorInner;
                    ctx.shadowBlur = _sb(_pureIntensity * _rc.pureHaloBlurMax * 0.5);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${_pureAlpha * 0.45})`;
                    ctx.lineWidth = 1.5;
                    if (this.collisionShape === 'polygon' && this.collisionData && this.collisionData.vertices && this.collisionData.vertices.length >= 3) {
                        const _verts = this.collisionData.vertices;
                        ctx.beginPath();
                        ctx.moveTo(_verts[0].x * 1.06, _verts[0].y * 1.06);
                        for (let _i = 1; _i < _verts.length; _i++) ctx.lineTo(_verts[_i].x * 1.06, _verts[_i].y * 1.06);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.roundRect(-w/2 - 3, -h/2 - 3, w + 6, h + 6, r + 2);
                        ctx.stroke();
                    }
                    ctx.restore();

                    // --- P5: 六角雪花形旋转晶体（替换原有菱形，更符合"纯净"语义）---
                    const _pureCrystalCount = _perfBudget.rewardCrystalCount;
                    if (_pureCrystalCount > 0) {
                        const _orbitR = Math.max(w, h) * _rc.pureCrystalOrbitRadius;
                        const _baseAngle = _now * _rc.pureCrystalRotateSpeed;
                        for (let _ci = 0; _ci < _pureCrystalCount; _ci++) {
                            const _angle = _baseAngle + (_ci / _pureCrystalCount) * Math.PI * 2;
                            const _cx = Math.cos(_angle) * _orbitR;
                            const _cy = Math.sin(_angle) * _orbitR;
                            const _cSize = _rc.pureCrystalSize;
                            const _crystalAlpha = 0.45 + _pureIntensity * 0.55;
                            ctx.shadowColor = _rc.pureHaloColorOuter;
                            ctx.shadowBlur = _sb(8);
                            // 绘制六角雪花形（6个顶点的星形）
                            ctx.beginPath();
                            for (let _si = 0; _si < 6; _si++) {
                                const _sAngle = (_si / 6) * Math.PI * 2 - Math.PI / 6;
                                // 外顶点
                                const _ox = _cx + Math.cos(_sAngle) * _cSize;
                                const _oy = _cy + Math.sin(_sAngle) * _cSize;
                                // 内顶点（星形凹入）
                                const _iAngle = _sAngle + Math.PI / 6;
                                const _ix = _cx + Math.cos(_iAngle) * _cSize * 0.4;
                                const _iy = _cy + Math.sin(_iAngle) * _cSize * 0.4;
                                if (_si === 0) ctx.moveTo(_ox, _oy);
                                else ctx.lineTo(_ox, _oy);
                                ctx.lineTo(_ix, _iy);
                            }
                            ctx.closePath();
                            ctx.fillStyle = `rgba(219, 234, 254, ${_crystalAlpha})`;
                            ctx.fill();
                            // 雪花描边（纯白）
                            ctx.strokeStyle = `rgba(255, 255, 255, ${_crystalAlpha * 0.7})`;
                            ctx.lineWidth = 0.8;
                            ctx.stroke();
                        }
                    }
                    ctx.restore();
                }

            }
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
            ctx.shadowBlur = _sb(10);
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
            ctx.shadowColor = '#fff'; ctx.shadowBlur = _sb(10);
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
                ctx.shadowBlur = _sb(8);
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
                ctx.shadowBlur = _sb(15 + openPulse * 10);
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

                // 内层深渊核心（高频微震颤）
                const shakeAmp = CONFIG.enemyRender.devourerCoreShakeAmplitude || 2;
                const shakePhase = devTime * 15;
                const shakeX = Math.sin(shakePhase * 1.7 + 0.3) * shakeAmp * (Math.random() * 0.5 + 0.5);
                const shakeY = Math.cos(shakePhase * 2.1 + 1.1) * shakeAmp * (Math.random() * 0.5 + 0.5);
                const voidGrad = ctx.createRadialGradient(shakeX, shakeY, 0, shakeX, shakeY, devRadius * 0.5);
                voidGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                voidGrad.addColorStop(0.5, 'rgba(20, 0, 40, 0.9)');
                voidGrad.addColorStop(1, 'rgba(75, 0, 130, 0)');
                ctx.fillStyle = voidGrad;
                ctx.beginPath();
                ctx.arc(shakeX, shakeY, devRadius * 0.5, 0, Math.PI * 2);
                ctx.fill();
                // 震颤时内圈向纯白过渡（lighter 模式叠加，模拟能量满溢白化）
                // 性能门控：low 档关闭（省去 createRadialGradient + lighter 叠加）
                const _arcPerfA = (typeof game !== 'undefined' && game.perfQualityLevel)
                    ? CONFIG.performance[game.perfQualityLevel] : CONFIG.performance.high;
                const _whiteGradEnabled = _arcPerfA.arcBossVfxWhiteGrad !== false;
                const whiteIntensity = devourPulse * 0.35;
                if (_whiteGradEnabled && whiteIntensity > 0.05) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const whiteGrad = ctx.createRadialGradient(shakeX, shakeY, 0, shakeX, shakeY, devRadius * 0.35);
                    whiteGrad.addColorStop(0, `rgba(255, 255, 255, ${whiteIntensity})`);
                    whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = whiteGrad;
                    ctx.beginPath();
                    ctx.arc(shakeX, shakeY, devRadius * 0.35, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // 脉冲光环
                ctx.strokeStyle = `rgba(180, 0, 255, ${0.6 + devourPulse * 0.4})`;
                ctx.lineWidth = 3 + devourPulse * 3;
                ctx.shadowColor = '#9400d3';
                ctx.shadowBlur = _sb(25 + devourPulse * 20);
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * (0.9 + devourPulse * 0.1), 0, Math.PI * 2);
                ctx.stroke();

                // 旋转能量线（靠近中心时过曝白化）
                // 性能门控：_arcPerfB 在此块内复用（吸入粒子块已定义 _arcPerf，此处单独定义以防上下文不共享）
                const _arcPerfB = (typeof game !== 'undefined' && game.perfQualityLevel)
                    ? CONFIG.performance[game.perfQualityLevel] : CONFIG.performance.high;
                const lineCount = _arcPerfB.arcBossVfxLineCount !== undefined ? _arcPerfB.arcBossVfxLineCount : 6;
                for (let li = 0; li < lineCount; li++) {
                    const lineAngle = devTime * 3 + (li / lineCount) * Math.PI * 2;
                    const outerX = Math.cos(lineAngle) * devRadius * 1.2;
                    const outerY = Math.sin(lineAngle) * devRadius * 1.2;
                    const lineGrad = ctx.createLinearGradient(outerX, outerY, 0, 0);
                    lineGrad.addColorStop(0, 'rgba(139, 0, 139, 0)');
                    // linePhase > 0.7 区尔强制向白色过渡（模拟极端能量密度下的过曝）
                    lineGrad.addColorStop(0.7, `rgba(200, 0, 255, ${0.5 + devourPulse * 0.3})`);
                    const overExposeAlpha = devourPulse * 0.8;
                    lineGrad.addColorStop(1, `rgba(255, 255, 255, ${overExposeAlpha})`);
                    ctx.strokeStyle = lineGrad;
                    ctx.lineWidth = 1.5 + devourPulse * 0.5;
                    ctx.shadowBlur = _sb(8 + devourPulse * 6);
                    ctx.beginPath();
                    ctx.moveTo(outerX, outerY);
                    ctx.lineTo(0, 0);
                    ctx.stroke();
                }
                ctx.restore();

                // 吸入粒子特效（高密度，靠近中心加速 + 尺寸抖动）
                // 性能门控：根据 performanceLevel 动态读取概率（high:0.7 / medium:0.5 / low:0.3）
                const _arcPerf = (typeof game !== 'undefined' && game.perfQualityLevel)
                    ? CONFIG.performance[game.perfQualityLevel] : CONFIG.performance.high;
                const _suckProb = _arcPerf.arcBossVfxSuckProb !== undefined ? _arcPerf.arcBossVfxSuckProb : 0.7;
                if (typeof game !== 'undefined' && Math.random() < _suckProb) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = devRadius * (1.5 + Math.random() * 1.0);
                    const px = this.pos.x + Math.cos(angle) * dist;
                    const py = this.pos.y + this.bumpOffsetY + Math.sin(angle) * dist;
                    const suckP = new Particle(px, py, Math.random() < 0.5 ? '#9333ea' : '#c084fc', 'spark');
                    // 向心加速：将初始速度提升 1.1 倍，模拟吸入引力加速
                    suckP.vel.x = (this.pos.x - px) * 0.12 * 1.1;
                    suckP.vel.y = (this.pos.y + this.bumpOffsetY - py) * 0.12 * 1.1;
                    suckP.drag = 0.93;
                    suckP.gravity = 0;
                    suckP.decay = 0.035;
                    // 尺寸随机抖动：在基础尺寸上叠加随机分量
                    suckP.size = Math.random() * 3 + 1 + Math.random() * 1.5;
                    game.spawn_pushParticleWithLimit(suckP);
                }
                // 额外的暗色烟雾粒子
                if (typeof game !== 'undefined' && Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    // @section:draw_special_projectiles - 特殊投射物与技能特效绘制
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
                ctx.shadowBlur = _sb(12 + coolPulse * 15);
                ctx.beginPath();
                ctx.arc(0, 0, devRadius * (0.85 + coolPulse * 0.1), 0, Math.PI * 2);
                ctx.stroke();

                // 闭合弧形（表示缺口正在收缩）
                ctx.strokeStyle = `rgba(255, 100, 100, ${0.4 + coolPulse * 0.3})`;
                ctx.lineWidth = devThickness * 0.5;
                ctx.lineCap = 'round';
                ctx.shadowBlur = _sb(8);
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
                    ctx.shadowBlur = _sb(8);
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
            ctx.shadowBlur = _sb(12 + ringPulse * 10);
            ctx.globalAlpha = 0.85 + ringPulse * 0.15;
            ctx.beginPath();
            ctx.arc(0, 0, ouroRadius, arcStart, arcEnd);
            ctx.stroke();

            // 内层高光
            ctx.strokeStyle = isBerserk ? 'rgba(233, 213, 255, 0.5)' : 'rgba(199, 210, 254, 0.35)';
            ctx.lineWidth = ouroThickness * 0.3;
            ctx.shadowBlur = _sb(5);
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
            ctx.shadowBlur = _sb(15 + corePulse * 15);
            ctx.beginPath();
            ctx.arc(coreX, coreY, coreRadius * 2, 0, Math.PI * 2);
            ctx.fill();

            // 核心闪烁光点
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.shadowBlur = _sb(8);
            ctx.beginPath();
            ctx.arc(coreX, coreY, coreRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // 狂暴时核心周围添加旋转光环
            if (isBerserk) {
                ctx.strokeStyle = `rgba(255, 100, 255, ${0.4 + corePulse * 0.5})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#ff00ff';
                ctx.shadowBlur = _sb(10);
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
                ctx.shadowBlur = _sb(10 + ringPulse * 8);
                ctx.beginPath();
                ctx.arc(ex, ey, ouroThickness * 0.8, 0, Math.PI * 2);
                ctx.fill();
            });

            // --- 5. 狂暴共鸣法阵（狂暴触发后）---
            if (this.berserked) {
                // 性能门控：读取 performanceLevel 对应的 arcBossVfxTriCount
                // high:6 / medium:3 / low:0（0=完全跳过三角形循环）
                const _ouroPerf = (typeof game !== 'undefined' && game.perfQualityLevel)
                    ? CONFIG.performance[game.perfQualityLevel] : CONFIG.performance.high;
                const resonanceCount = _ouroPerf.arcBossVfxTriCount !== undefined
                    ? _ouroPerf.arcBossVfxTriCount
                    : (CONFIG.enemyRender.ouroborosBerserkResonanceCount || 6);
                const resonanceRadius = ouroRadius + ouroThickness * 1.2;

                // 5a. 外圈旋转三角形符文标记（low 档 resonanceCount=0 时跳过）
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                for (let ri = 0; ri < resonanceCount; ri++) {
                    const triAngle = ouroTime * 1.5 + (ri / resonanceCount) * Math.PI * 2;
                    const tx = Math.cos(triAngle) * resonanceRadius;
                    const ty = Math.sin(triAngle) * resonanceRadius;
                    const triSize = ouroThickness * 0.5;
                    const triPulse = (Math.sin(ouroTime * 3 + ri * 1.1) + 1) * 0.5;
                    // 交替金色/紫色发光
                    const triColor = ri % 2 === 0 ? `rgba(250, 204, 21, ${0.5 + triPulse * 0.5})` : `rgba(168, 85, 247, ${0.5 + triPulse * 0.5})`;
                    const triGlow = ri % 2 === 0 ? '#facc15' : '#a855f7';
                    ctx.save();
                    ctx.translate(tx, ty);
                    ctx.rotate(triAngle + Math.PI / 2);
                    ctx.fillStyle = triColor;
                    ctx.shadowColor = triGlow;
                    ctx.shadowBlur = _sb(8 + triPulse * 12);
                    ctx.beginPath();
                    // @section:draw_death_animation - 死亡动画与消散特效
                    ctx.moveTo(0, -triSize);
                    ctx.lineTo(triSize * 0.866, triSize * 0.5);
                    ctx.lineTo(-triSize * 0.866, triSize * 0.5);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                ctx.restore();

                // 5b. 核心爆发脉冲（呈现能量满溢）
                ctx.save();
                const burstPulse = Math.pow((Math.sin(ouroTime * 2.5) + 1) * 0.5, 1.5);
                const burstRadius = ouroRadius * (0.3 + burstPulse * 0.25);
                const burstGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, burstRadius);
                burstGrad.addColorStop(0, `rgba(255, 255, 255, ${burstPulse * 0.6})`);
                burstGrad.addColorStop(0.4, `rgba(200, 100, 255, ${burstPulse * 0.4})`);
                burstGrad.addColorStop(0.7, `rgba(80, 0, 160, ${burstPulse * 0.2})`);
                burstGrad.addColorStop(1, 'rgba(40, 0, 80, 0)');
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = burstGrad;
                ctx.beginPath();
                ctx.arc(0, 0, burstRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 5c. 词缀轮转闪光（_berserkedRotation 且 _rotationFlashTimer > 0 时）
                if (this._rotationFlashTimer > 0) {
                    const flashAlpha = (this._rotationFlashTimer / 8) * 0.3; // 从 0.3 快速衰减
                    ctx.save();
                    // 在本地坐标系中绘制全屏盖盖（使用 ctx.canvas 尺寸）
                    const cw = ctx.canvas ? ctx.canvas.width : 400;
                    const ch = ctx.canvas ? ctx.canvas.height : 700;
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                    ctx.fillRect(-this.pos.x, -(this.pos.y + this.bumpOffsetY), cw, ch);
                    ctx.restore();
                    this._rotationFlashTimer--;
                }
            }

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
                ctx.shadowBlur = _sb(20);
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
                    ctx.shadowBlur = _sb(15);
                    ctx.stroke();
                }

                // 3. 地面裂纹辐射线（从中心向外放射）
                const crackCount = 8;
                ctx.save();
                ctx.globalAlpha = (1 - progress) * 0.7;
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = _sb(8);
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
                ctx.shadowBlur = _sb(20 * textAlpha);

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
            ctx.shadowBlur = _sb(30 * pulseAlpha * flashPulse);
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
                ctx.shadowBlur = _sb(8 + pulse * 6);
                ctx.beginPath();
                ctx.roundRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH, 4);
                ctx.fill();

                // 文字
                ctx.shadowBlur = _sb(6 + pulse * 4);
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
                ctx.shadowBlur = _sb(10 + pulse * 8);
                ctx.beginPath();
                ctx.roundRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH, 4);
                ctx.fill();

                ctx.shadowBlur = _sb(8 + pulse * 6);
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
                ctx.shadowBlur = _sb(5 + pulse * 3);
                ctx.beginPath();
                ctx.roundRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH, 4);
                ctx.fill();

                ctx.shadowBlur = _sb(4 + pulse * 2);
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
    // @section:damage_shield_check - 护盾吸收与穿透判断
    takeDamage(amount, source = null, bypassShield = false) {
        let actualDamage = amount;

        // 0. [V2 deflectionWard] 偏折屏障：仅吸收"反弹"和"穿透"类伤害
        //    - 直击伤害（无 pierce/bounce）、火焰持续伤害（bypassShield=true）、毒素 DoT 不受屏障影响
        //    - 屏障值 = maxHp × deflectionWardBarrierPct，每回合开始若未破则回满
        if (this.affixes && this.affixes.includes('deflectionWard') && (this.wardBarrier || 0) > 0 && !bypassShield) {
            const cfg = source && source.config;
            const isPierce = !!(cfg && cfg.pierce > 0);
            const isBounceHit = !!(cfg && cfg.bounce > 0
                && source.bouncesLeft !== undefined && source.bouncesLeft < cfg.bounce);
            // 即使是首次命中（未弹跳），bounce 配置仍代表"反弹流派"，按规范也应被屏障吸收
            const isBounceConfig = !!(cfg && cfg.bounce > 0);
            if (isPierce || isBounceHit || isBounceConfig) {
                const before = this.wardBarrier;
                const absorbed = Math.min(this.wardBarrier, actualDamage);
                this.wardBarrier -= absorbed;
                actualDamage -= absorbed;
                if (typeof game !== 'undefined') {
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 18, `🔷-${Math.ceil(absorbed)}`, '#67e8f9');
                }
                if (this.wardBarrier <= 0) {
                    this.wardBrokenThisTurn = true;
                    if (typeof game !== 'undefined') {
                        game.spawn_createParticle(this.pos.x, this.pos.y, '#67e8f9', 'shard');
                        game.spawn_createFloatingText(this.pos.x, this.pos.y - 36, '🔷BREAK', '#22d3ee');
                    }
                }
                if (actualDamage <= 0) return { actualDamage: Math.ceil(absorbed), killed: false, deflected: true };
            }
        }

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

// @section:damage_element_reaction - 属性反应触发（克制/共鸣/温度系统）

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
                    // 机械类：冷蓝/电弧色火星，模拟机械装甲受击时的能量放电感
                    // 颜色范围：冷蓝(#38bdf8) / 电弧白(#bae6fd) / 电弧蓝紫(#818cf8)
                    // 与火属性橙红(#fdba74/#f97316)在色相上形成对比，不易混淡
                    const MECH_SPARK_COLORS = ['#38bdf8', '#bae6fd', '#818cf8', '#67e8f9'];
                    const sparkCount = 4 + Math.floor(Math.random() * 3); // 4~6
                    for (let i = 0; i < sparkCount; i++) {
                        const mechColor = MECH_SPARK_COLORS[Math.floor(Math.random() * MECH_SPARK_COLORS.length)];
                        const ms = new Particle(
                            this.pos.x + (Math.random() - 0.5) * this.width * 0.8,
                            this.pos.y + (Math.random() - 0.5) * this.height * 0.5,
                            mechColor, 'spark'
                        );
                        // 向四周爆发，轻微向上偏移，模拟放电火花散射
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 2.0 + Math.random() * 2.5;
                        ms.vel.x = Math.cos(angle) * speed;
                        ms.vel.y = Math.sin(angle) * speed - 0.5;
                        ms.size = 1.5 + Math.random() * 2.0; // 小型火星
                        ms.decay = 0.05 + Math.random() * 0.04;
                        game.spawn_pushParticleWithLimit(ms);
                    }
                } else if (dominantAffix === 'regen' || dominantAffix === 'clone' || dominantAffix === 'devour') {
                    // 生物类：暗红/紫色 mist，带向下重力感
                    const mistCount = 2 + Math.floor(Math.random() * 2); // 2~3
                    const bioColors = { regen: '#dc2626', clone: '#c084fc', devour: '#dc2626' };
                    // @section:damage_apply_and_feedback - 伤害应用、浮动文字与击退效果
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
                    // @section:damage_death_trigger - 死亡判断与掉落物触发
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
    /**
     * [新属性] 累加毒素层数。
     * @param {number} stacks - 要累加的毒层数（向下取整）
     */
    applyVenom(stacks) {
        const s = Math.max(0, Math.floor(stacks || 0));
        if (s <= 0) return;
        this.venomStacks = (this.venomStacks || 0) + s;
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
     * 绘制精英专属装饰（Layer 3.9）——晶化变异设计
     * 通过虚空晶核、晶化切面和流光金边强化精英輨达度
     * @param {CanvasRenderingContext2D} ctx - 画布上下文（已 translate 到精英中心）
     * @param {number} w - 精英宽度（已减去边距）
     * @param {number} h - 精英高度（已减去边距）
     */
    _drawEliteDecoration(ctx, w, h) {
        const t = Date.now() / 1000;
        const cfg = CONFIG.enemyRender;
        const breathePhase = (t / (cfg.breathePeriod / 1000) + this.visualSeed * 2) * Math.PI * 2;
        const breatheIntensity = Math.pow((Math.sin(breathePhase) + 1) * 0.5, cfg.breatheEasingPower);

        // --- E1: 晶化切面（不规则多边形几何切面，模拟紫水晶折射）---
        // 使用 visualSeed 预计算 3 个切面多边形，叠加半透明紫色层
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const facetAlpha = cfg.eliteCrystalFacetAlpha * (0.7 + breatheIntensity * 0.3);
        const facetColors = ['rgba(124, 58, 237, ', 'rgba(167, 139, 250, ', 'rgba(196, 132, 252, '];
        for (let fi = 0; fi < 3; fi++) {
            const fSeed = this.visualSeed * 7 + fi * 2.3;
            const fx1 = (Math.sin(fSeed) * 0.5) * w;
            const fy1 = (Math.cos(fSeed * 1.3) * 0.5) * h;
            const fx2 = (Math.sin(fSeed + 1.2) * 0.5) * w;
            const fy2 = (Math.cos(fSeed * 0.9 + 0.8) * 0.5) * h;
            const fx3 = (Math.sin(fSeed + 2.4) * 0.5) * w;
            const fy3 = (Math.cos(fSeed * 1.1 + 1.6) * 0.5) * h;
            ctx.beginPath();
            ctx.moveTo(fx1, fy1);
            ctx.lineTo(fx2, fy2);
            ctx.lineTo(fx3, fy3);
            ctx.closePath();
            ctx.fillStyle = `${facetColors[fi % facetColors.length]}${(facetAlpha * (0.6 + fi * 0.2)).toFixed(3)})`;
            ctx.fill();
        }
        ctx.restore();

        // --- E2: 虚空晶核（缓慢旋转的菱形晶体，代表精英能量源泉）---
        const coreR = Math.min(w, h) * cfg.eliteCoreRadiusRatio;
        const coreAngle = t * cfg.eliteCoreRotateSpeed + this.visualSeed * Math.PI;
        ctx.save();
        ctx.rotate(coreAngle);
        // 菱形晶体：4 个顶点的菱形（上下左右各一个）
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
        coreGrad.addColorStop(0, `rgba(216, 180, 254, ${0.9 * (0.6 + breatheIntensity * 0.4)})`);
        coreGrad.addColorStop(0.5, `rgba(167, 139, 250, ${0.6 * (0.5 + breatheIntensity * 0.5)})`);
        coreGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');
        ctx.fillStyle = coreGrad;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = _sb(8 + breatheIntensity * 6);
        // 菱形路径
        ctx.beginPath();
        ctx.moveTo(0, -coreR);
        ctx.lineTo(coreR * 0.55, 0);
        ctx.lineTo(0, coreR);
        ctx.lineTo(-coreR * 0.55, 0);
        ctx.closePath();
        ctx.fill();
        // 菱形描边（金色）
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.5 + breatheIntensity * 0.4})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();

        // --- E3: 晶核过曝叠加（lighter 模式，展现能量溢出）---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const overglowR = coreR * 1.8;
        const overglowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, overglowR);
        overglowGrad.addColorStop(0, `rgba(192, 132, 252, ${cfg.eliteCoreOverglowAlpha * breatheIntensity})`);
        overglowGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
        ctx.fillStyle = overglowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, overglowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- E4: 流光边框（根据词条数分级：金色流光 / 炫彩流光）---
        // 仅在金边（4-5 词条）或炫彩流光（6+ 词条/大BOSS）时渲染
        // @perf-impact: 每帧 1-2 次 createLinearGradient，已通过条件判断限制调用次数
        {
            const e4AffixCount = this.affixes ? this.affixes.length : 0;
            const e4IsLargeBoss = this.type === 'boss' && e4AffixCount >= 6;
            const e4IsGoldTier = (this.type === 'boss' && e4AffixCount < 6) || (this.type === 'elite' && e4AffixCount >= 4);
            const e4IsRainbow = e4IsLargeBoss || (this.type === 'elite' && e4AffixCount >= 6);
            // 仅金边或炫彩流光级才绘制流光边框
            if (e4IsGoldTier || e4IsRainbow) {
                const flowSpeed = e4IsRainbow ? cfg.eliteBorderRainbowFlowSpeed : cfg.eliteBorderFlowSpeed;
                const flowWidthRatio = e4IsRainbow ? cfg.eliteBorderRainbowFlowWidth : cfg.eliteBorderFlowWidth;
                const perimeter = 2 * (w + h);
                const flowPos = ((t * flowSpeed) % 1) * perimeter;
                const flowHalfWidth = perimeter * flowWidthRatio * 0.5;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const segments = [
                    { x1: -w/2, y1: -h/2, x2: w/2, y2: -h/2 },  // 上边
                    { x1: w/2,  y1: -h/2, x2: w/2, y2: h/2  },  // 右边
                    { x1: w/2,  y1: h/2,  x2: -w/2, y2: h/2 },  // 下边
                    { x1: -w/2, y1: h/2,  x2: -w/2, y2: -h/2 }  // 左边
                ];
                const segLens = [w, h, w, h];
                let cumLen = 0;
                for (let si = 0; si < 4; si++) {
                    const seg = segments[si];
                    const segLen = segLens[si];
                    const segStart = cumLen;
                    const segEnd = cumLen + segLen;
                    const lo = flowPos - flowHalfWidth;
                    const hi = flowPos + flowHalfWidth;
                    if (hi > segStart && lo < segEnd) {
                        const localLo = Math.max(lo, segStart) - segStart;
                        const localHi = Math.min(hi, segEnd) - segStart;
                        const t0 = localLo / segLen;
                        const t1 = localHi / segLen;
                        const px0 = seg.x1 + (seg.x2 - seg.x1) * t0;
                        const py0 = seg.y1 + (seg.y2 - seg.y1) * t0;
                        const px1 = seg.x1 + (seg.x2 - seg.x1) * t1;
                        const py1 = seg.y1 + (seg.y2 - seg.y1) * t1;
                        const flowGrad = ctx.createLinearGradient(px0, py0, px1, py1);
                        if (e4IsRainbow) {
                            // 炫彩流光：彩虹渐变，中心点颜色随时间循环干色相
                            const hue0 = (Date.now() / 25 + si * 90) % 360;
                            const hue1 = (hue0 + 60) % 360;
                            flowGrad.addColorStop(0, `hsla(${hue0}, 100%, 70%, 0)`);
                            flowGrad.addColorStop(0.5, `hsla(${(hue0 + hue1) / 2}, 100%, 80%, 0.9)`);
                            flowGrad.addColorStop(1, `hsla(${hue1}, 100%, 70%, 0)`);
                            ctx.shadowColor = `hsl(${hue0}, 100%, 65%)`;
                            ctx.shadowBlur = _sb(cfg.borderTierRainbowGlowBlur);
                        } else {
                            // 金色流光
                            flowGrad.addColorStop(0, 'rgba(250, 204, 21, 0)');
                            flowGrad.addColorStop(0.5, 'rgba(255, 255, 200, 0.85)');
                            flowGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                            ctx.shadowColor = cfg.borderTierGoldGlow;
                            ctx.shadowBlur = _sb(cfg.borderTierGoldGlowBlur);
                        }
                        ctx.strokeStyle = flowGrad;
                        ctx.lineWidth = e4IsRainbow ? cfg.borderTierRainbowWidth : 3;
                        ctx.beginPath();
                        ctx.moveTo(px0, py0);
                        ctx.lineTo(px1, py1);
                        ctx.stroke();
                    }
                    cumLen += segLen;
                }
                ctx.restore();
            }
        }
    }

    /**
     * 绘制 Boss 专属装饰（Layer 3.8）
     * 每个 Boss 根据其 bossType 绘制独特的内部装饰
     * @param {CanvasRenderingContext2D} ctx - 画布上下文（已经 translate 到 Boss 中心）
     * @param {number} w - Boss 宽度（已减去边距）
     * @param {number} h - Boss 高度（已减去边距）
     */
    // @section:boss_deco_phase_check - Boss 阶段检查与装饰基础参数
     _drawBossDecoration(ctx, w, h) {
        // === [Phase C Task 5.C] Boss Sprite 优先绘制 ===
        // 如果 SpriteRenderer 已就绪，将 Sprite 以半透明度叠盖在矢量装饰之上
        // Sprite 不替换矢量装饰，而是与其叠加（矢量层提供动态效果，Sprite 层提供角色外观）
        // 这里的 SpriteRenderer.draw() 在 Layer 3.8 调用，已在 ctx.save()/restore() 块内
        if (this._spriteRenderer && this._spriteRenderer.ready) {
            // Boss Sprite 保持正方形比例（取 min(w,h) 作为边长），居中偏下绘制
            // Boss 贴图同样偏下，与普通/精英敌人保持视觉一致性
            const sprSize2 = Math.min(w, h);
            const sprOffsetY2 = h * 0.15; // 向下偏移量
            this._spriteRenderer.draw(ctx, -sprSize2/2, -sprSize2/2 + sprOffsetY2, sprSize2, sprSize2, 0.7);
        }

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
                ctx.shadowBlur = _sb(15);
                ctx.fill();
                ctx.restore();
                // [T2] 过曝白化叠加层（模拟 CSS brightness(1.4)）
                {
                    const pulseIntensity = (Math.sin(t * (isBerserk ? 5 : 2.5)) + 1) * 0.5;
                    const berserkMult = isBerserk ? CONFIG.enemyRender.bossOverglowBerserkMult : 1.0;
                    const overglowAlpha = pulseIntensity * CONFIG.enemyRender.bossOverglowAlpha * berserkMult;
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const overGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, heartR * 1.2);
                    overGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(overglowAlpha, 1)})`);
                    overGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = overGrad;
                    ctx.beginPath(); ctx.arc(0, 0, heartR * 1.2, 0, Math.PI * 2); ctx.fill();
                    // 狂暴时额外增加向外扩散的脉冲波纹
                    if (isBerserk) {
                        const ripplePhase = (t * 1.5) % 1;
                        const rippleR = heartR * (1.2 + ripplePhase * 1.5);
                        const rippleAlpha = (1 - ripplePhase) * 0.5 * CONFIG.enemyRender.bossOverglowAlpha;
                        ctx.strokeStyle = `rgba(255, 200, 100, ${rippleAlpha})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(0, 0, rippleR, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.restore();
                }
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
                // @section:boss_deco_crown_and_wings - 皇冠/翅膀/触手等 Boss 专属装饰
                // 冰尖突出效果（在形状内部画尖刺）
                ctx.strokeStyle = `rgba(180, 230, 255, ${0.6 + Math.sin(t * 2) * 0.2})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#a5f3fc';
                ctx.shadowBlur = _sb(8);
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
                // 六边形细胞网格（[T2] 能量液位效果：网格线 alpha 从底部向顶部线性增强）
                const hexR2 = Math.min(w, h) * 0.18;
                const hexW2 = hexR2 * Math.sqrt(3);
                const hexH2 = hexR2 * 2;
                ctx.lineWidth = 1;
                ctx.shadowColor = '#a855f7';
                ctx.shadowBlur = _sb(5);
                for (let row = -2; row <= 2; row++) {
                    for (let col = -2; col <= 2; col++) {
                        const hx = col * hexW2 + (row % 2 === 0 ? 0 : hexW2 / 2);
                        const hy = row * hexH2 * 0.75;
                        if (Math.abs(hx) > w * 0.45 || Math.abs(hy) > h * 0.45) continue;
                        // [T2] 能量液位：从底部(hy=h/2)到顶部(hy=-h/2)线性增强
                        const liquidLevel = 1.0 - (hy + h * 0.5) / h; // 0(底部) ~ 1(顶部)
                        const hexBaseAlpha = 0.25 + liquidLevel * 0.35 + Math.sin(t * 1.2) * 0.1;
                        ctx.strokeStyle = `rgba(192, 132, 252, ${hexBaseAlpha})`;
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
                    // [T2] 孢子过曝白色高光点（lighter 模式）
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = `rgba(255, 255, 255, ${pulse * CONFIG.enemyRender.bossOverglowAlpha * 0.8})`;
                    ctx.beginPath(); ctx.arc(sp.x, sp.y, spR * 0.4, 0, Math.PI * 2); ctx.fill();
                    ctx.globalCompositeOperation = 'screen';
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
                // 中心生命光晕（[T2] 呼吸峰値时内圈颜色向白色过渡）
                const viridisBreath = (Math.sin(t * 2) + 1) * 0.5; // 0~1 呼吸周期
                // 内圈颜色：呼吸峰値时向白色过渡
                const viridisInnerR = Math.floor(74 + viridisBreath * (255 - 74));
                const viridisInnerG = Math.floor(222 + viridisBreath * (255 - 222));
                const viridisInnerB = Math.floor(128 + viridisBreath * (255 - 128));
                const viridisInnerAlpha = 0.4 + viridisBreath * 0.2;
                const viridisGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, h) * 0.4);
                viridisGrad.addColorStop(0, `rgba(${viridisInnerR}, ${viridisInnerG}, ${viridisInnerB}, ${viridisInnerAlpha})`);
                viridisGrad.addColorStop(0.6, `rgba(34, 197, 94, 0.2)`);
                viridisGrad.addColorStop(1, 'rgba(21, 128, 61, 0)');
                ctx.fillStyle = viridisGrad;
                ctx.beginPath();
                ctx.arc(0, 0, Math.min(w, h) * 0.4, 0, Math.PI * 2);
                ctx.fill();
                // [T2] 中心过曝叠加层
                {
                    const berserkMult = isBerserk ? CONFIG.enemyRender.bossOverglowBerserkMult : 1.0;
                    const overglowAlpha = viridisBreath * CONFIG.enemyRender.bossOverglowAlpha * berserkMult;
                    ctx.globalCompositeOperation = 'lighter';
                    const overGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, h) * 0.25);
                    overGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(overglowAlpha, 1)})`);
                    overGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = overGrad;
                    ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * 0.25, 0, Math.PI * 2); ctx.fill();
                    ctx.globalCompositeOperation = 'screen';
                // @section:boss_deco_aura_rings - 光环圆环动画绘制
                }
                // 能量藤蔓
                const vineCount = isBerserk ? 5 : 3;
                ctx.strokeStyle = `rgba(74, 222, 128, ${0.6 + Math.sin(t * 1.5) * 0.2})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#22c55e';
                ctx.shadowBlur = _sb(6);
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
                    // [T2] 狂暴时藤蔓末端增加白色发光点（lighter 模式）
                    if (isBerserk) {
                        ctx.save();
                        ctx.globalCompositeOperation = 'lighter';
                        const glowAlpha = (Math.sin(t * 2 + i) * 0.3 + 0.5) * CONFIG.enemyRender.bossOverglowAlpha;
                        ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
                        ctx.beginPath(); ctx.arc(endX, endY, 3, 0, Math.PI * 2); ctx.fill();
                        ctx.restore();
                    }
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
                // [T2] teslaFlash 峰値时中心颜色叠加白色高光
                const teslaCenterR = Math.floor(250 + teslaFlash * (255 - 250));
                const teslaCenterG = Math.floor(204 + teslaFlash * (255 - 204));
                const teslaCenterB = Math.floor(21 + teslaFlash * (255 - 21));
                teslaGrad.addColorStop(0, `rgba(${teslaCenterR}, ${teslaCenterG}, ${teslaCenterB}, ${0.8 * teslaFlash})`);
                teslaGrad.addColorStop(0.3, `rgba(99, 102, 241, ${0.5 * teslaFlash})`);
                teslaGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
                ctx.fillStyle = teslaGrad;
                ctx.beginPath();
                ctx.arc(0, 0, Math.min(w, h) * 0.35, 0, Math.PI * 2);
                ctx.fill();
                // [T2] 电光核心过曝叠加层
                {
                    const berserkMult = isBerserk ? CONFIG.enemyRender.bossOverglowBerserkMult : 1.0;
                    const overglowAlpha = teslaFlash * CONFIG.enemyRender.bossOverglowAlpha * berserkMult;
                    ctx.globalCompositeOperation = 'lighter';
                    const tOverGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, h) * 0.2);
                    tOverGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(overglowAlpha, 1)})`);
                    tOverGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = tOverGrad;
                    ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * 0.2, 0, Math.PI * 2); ctx.fill();
                    ctx.globalCompositeOperation = 'screen';
                }
                // 电弧达到顶点（[T2] 靠近中心时颜色强制向白色过渡）
                const verts = this.collisionData && this.collisionData.vertices;
                if (verts && verts.length > 0) {
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = _sb(8);
                    verts.forEach(v => {
                        if (Math.random() < 0.4) {
                            ctx.lineWidth = 1;
                            const midX = v.x * 0.5 + (Math.random() - 0.5) * w * 0.2;
                            const midY = v.y * 0.5 + (Math.random() - 0.5) * h * 0.2;
                            // 中心段（起点到中点）：白色过渡（模拟极端能量密度）
                            const arcGrad1 = ctx.createLinearGradient(0, 0, midX, midY);
                            arcGrad1.addColorStop(0, `rgba(255, 255, 255, ${0.9 * teslaFlash})`);
                            arcGrad1.addColorStop(1, `rgba(250, 204, 21, ${0.6 * teslaFlash})`);
                            ctx.strokeStyle = arcGrad1;
                            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(midX, midY); ctx.stroke();
                            // 外段（中点到顶点）：正常黄色
                            ctx.strokeStyle = `rgba(250, 204, 21, ${0.6 * teslaFlash})`;
                            ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(v.x, v.y); ctx.stroke();
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
                // 缝合线（垂直分割线）（[T2] 中间段白色高光强度随呼吸周期动态变化）
                const chimeraShift = Math.sin(t * 0.8) * 3;
                const chimeraBreath = (Math.sin(t * 2) + 1) * 0.5; // 0~1 呼吸周期
                const berserkMult2 = isBerserk ? CONFIG.enemyRender.bossOverglowBerserkMult : 1.0;
                const chimeraWhiteAlpha = (0.5 + chimeraBreath * CONFIG.enemyRender.bossOverglowAlpha * berserkMult2);
                const lineGrad = ctx.createLinearGradient(chimeraShift, -h/2, chimeraShift, h/2);
                lineGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
                lineGrad.addColorStop(0.3, `rgba(239, 68, 68, ${0.5 + Math.sin(t * 2) * 0.2})`);
                lineGrad.addColorStop(0.5, `rgba(255, 255, 255, ${Math.min(chimeraWhiteAlpha, 1)})`);
                lineGrad.addColorStop(0.7, `rgba(99, 102, 241, ${0.5 + Math.sin(t * 2) * 0.2})`);
                lineGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
                ctx.strokeStyle = lineGrad;
                ctx.lineWidth = 2;
                ctx.shadowColor = '#a855f7';
                ctx.shadowBlur = _sb(10);
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
                // [T2] 左侧蓝色能量核心 lighter 过曝叠加
                ctx.globalCompositeOperation = 'lighter';
                const leftOverGrad = ctx.createRadialGradient(-w * 0.2, 0, 0, -w * 0.2, 0, w * 0.2);
                leftOverGrad.addColorStop(0, `rgba(255, 255, 255, ${chimeraBreath * CONFIG.enemyRender.bossOverglowAlpha * berserkMult2 * 0.8})`);
                leftOverGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = leftOverGrad;
                ctx.fillRect(-w/2, -h/2, w/2, h);
                ctx.globalCompositeOperation = 'screen';
                // 右侧生物能量（红色）
                const rightGrad = ctx.createRadialGradient(w * 0.2, 0, 0, w * 0.2, 0, w * 0.3);
                rightGrad.addColorStop(0, `rgba(239, 68, 68, ${0.3 + Math.sin(t * 1.8) * 0.1})`);
                rightGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                ctx.fillStyle = rightGrad;
                ctx.fillRect(0, -h/2, w/2, h);
                // [T2] 右侧红色能量核心 lighter 过曝叠加
                ctx.globalCompositeOperation = 'lighter';
                const rightOverGrad = ctx.createRadialGradient(w * 0.2, 0, 0, w * 0.2, 0, w * 0.2);
                rightOverGrad.addColorStop(0, `rgba(255, 255, 255, ${chimeraBreath * CONFIG.enemyRender.bossOverglowAlpha * berserkMult2 * 0.8})`);
                rightOverGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = rightOverGrad;
                ctx.fillRect(0, -h/2, w/2, h);
                ctx.globalCompositeOperation = 'screen';
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
                // @section:boss_deco_rune_symbols - 符文符号与能量纹路绘制
                // 符文光环：在环形上绘制旋转符文（呼吸发光）
                const runeCount = 8;
                const runePower = CONFIG.enemyRender.ouroborosRuneBreathePower || 1.5;
                ctx.font = `bold ${Math.floor(ouroR * 0.3)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const runeChars = ['\u16a0', '\u16b7', '\u16c9', '\u16da', '\u16e3', '\u16f1', '\u16a2', '\u16b9'];
                for (let i = 0; i < runeCount; i++) {
                    const angle = (i / runeCount) * Math.PI * 2 + gapAngle + t * 0.5;
                    const rx = Math.cos(angle) * ouroR;
                    const ry = Math.sin(angle) * ouroR;
                    // 呼吸发光：使用 Math.pow 引入缓动指数，增强停留感
                    const runeBreath = Math.pow((Math.sin(t * 2 + i) + 1) * 0.5, runePower);
                    ctx.save();
                    ctx.translate(rx, ry);
                    ctx.rotate(angle + Math.PI / 2);
                    ctx.globalAlpha = 0.5 + runeBreath * 0.45;
                    ctx.fillStyle = 'rgba(167, 139, 250, 1)';
                    ctx.shadowColor = '#7c3aed';
                    ctx.shadowBlur = _sb(8 + runeBreath * 15);
                    ctx.fillText(runeChars[i % runeChars.length], 0, 0);
                    ctx.restore();
                }
                // 缺口指示箭头（动态颜色：非狂暴金色 / 狂暴后红色）
                const gapMidAngle = gapAngle + Math.PI * 0.75; // 缺口中间角度
                const arrowDist = ouroR * 1.15;
                const arrowAlpha = 0.6 + Math.sin(t * 4) * 0.3;
                ctx.save();
                ctx.translate(Math.cos(gapMidAngle) * arrowDist, Math.sin(gapMidAngle) * arrowDist);
                ctx.rotate(gapMidAngle);
                if (isBerserk) {
                    // 狂暴后：红色箭头 + 更强 shadowBlur
                    ctx.fillStyle = `rgba(239, 68, 68, ${arrowAlpha})`;
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = _sb(35);
                } else {
                    // 非狂暴：金色箭头（保持现有）
                    ctx.fillStyle = `rgba(250, 204, 21, ${arrowAlpha})`;
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = _sb(20);
                }
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
     * 绘制 V2 基底敌人的轮廓美术。
     * 这里不依赖外部 Sprite Sheet，而是使用低成本 Canvas 几何图元表达「尺寸 × 基底 × 词条」身份，
     * 以便在最终像素资产完成前先把 gameplay-readable 的敌人样式落地。
     */
    _drawArchetypeBody(ctx, w, h) {
        const archetype = this.baseArchetype;
        if (!archetype) return;
        const t = Date.now() / 1000;
        const pulse = (Math.sin(t * 2.1 + this.visualSeed * 6.283) + 1) * 0.5;
        const minSide = Math.min(w, h);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'screen';

        switch (archetype) {
            case 'bastion': {
                const alpha = 0.34 + pulse * 0.08;
                ctx.strokeStyle = `rgba(203, 213, 225, ${alpha})`;
                ctx.fillStyle = `rgba(71, 85, 105, ${alpha * 0.35})`;
                ctx.lineWidth = Math.max(2, minSide * 0.035);
                for (let i = 0; i < 3; i++) {
                    const x = -w * 0.32 + i * w * 0.32;
                    ctx.beginPath();
                    ctx.roundRect(x - w * 0.11, -h * 0.28, w * 0.22, h * 0.56, 5);
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 1.25})`;
                ctx.beginPath();
                ctx.moveTo(-w * 0.44, 0); ctx.lineTo(w * 0.44, 0);
                ctx.moveTo(-w * 0.18, -h * 0.24); ctx.lineTo(w * 0.18, h * 0.24);
                ctx.moveTo(w * 0.18, -h * 0.24); ctx.lineTo(-w * 0.18, h * 0.24);
                ctx.stroke();
                break;
            }
            case 'maw': {
                const glow = 0.28 + pulse * 0.18;
                const mawGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, minSide * 0.48);
                mawGrad.addColorStop(0, `rgba(15, 23, 42, ${0.65 + pulse * 0.12})`);
                mawGrad.addColorStop(0.55, `rgba(88, 28, 135, ${glow})`);
                mawGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');
                ctx.fillStyle = mawGrad;
                ctx.beginPath(); ctx.ellipse(0, 0, w * 0.23, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(216, 180, 254, ${0.55 + pulse * 0.25})`;
                ctx.lineWidth = Math.max(1.5, minSide * 0.025);
                for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * Math.PI * 2 + pulse * 0.15;
                    const x1 = Math.cos(a) * w * 0.18, y1 = Math.sin(a) * h * 0.31;
                    const x2 = Math.cos(a) * w * 0.24, y2 = Math.sin(a) * h * 0.40;
                    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
                }
                ctx.strokeStyle = `rgba(167, 139, 250, ${0.42 + pulse * 0.22})`;
                ctx.beginPath(); ctx.arc(0, 0, minSide * 0.22, t % (Math.PI * 2), t % (Math.PI * 2) + Math.PI * 1.45); ctx.stroke();
                break;
            }
            case 'deflector': {
                const wardPct = Math.max(0, Math.min(1, (this.wardBarrier || 0) / Math.max(1, this.maxHp * 0.1)));
                const alpha = 0.30 + wardPct * 0.28 + pulse * 0.06;
                ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
                ctx.fillStyle = `rgba(14, 165, 233, ${alpha * 0.28})`;
                ctx.lineWidth = Math.max(2, minSide * 0.04);
                ctx.beginPath();
                ctx.moveTo(-w * 0.42, h * 0.18);
                ctx.lineTo(-w * 0.22, -h * 0.26);
                ctx.lineTo(w * 0.36, -h * 0.14);
                ctx.lineTo(w * 0.44, h * 0.22);
                ctx.closePath();
                ctx.fill(); ctx.stroke();
                ctx.strokeStyle = `rgba(224, 242, 254, ${alpha * 0.9})`;
                ctx.beginPath();
                ctx.moveTo(-w * 0.14, -h * 0.22); ctx.lineTo(w * 0.10, h * 0.20);
                ctx.moveTo(w * 0.12, -h * 0.18); ctx.lineTo(w * 0.32, h * 0.18);
                ctx.stroke();
                ctx.globalAlpha = 0.45 + wardPct * 0.45;
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(-w * 0.38, h * 0.32, w * 0.76 * wardPct, Math.max(2, h * 0.045));
                break;
            }
            case 'echoSpire': {
                const alpha = 0.32 + pulse * 0.18;
                ctx.strokeStyle = `rgba(240, 171, 252, ${alpha})`;
                ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.22})`;
                ctx.lineWidth = Math.max(1.5, minSide * 0.035);
                ctx.beginPath();
                ctx.moveTo(0, -h * 0.42);
                ctx.lineTo(w * 0.30, h * 0.25);
                ctx.lineTo(0, h * 0.42);
                ctx.lineTo(-w * 0.30, h * 0.25);
                ctx.closePath();
                ctx.fill(); ctx.stroke();
                ctx.strokeStyle = `rgba(250, 232, 255, ${alpha * 0.85})`;
                for (let i = 0; i < 3; i++) {
                    const rr = minSide * (0.20 + i * 0.14 + pulse * 0.03);
                    ctx.globalAlpha = (0.55 - i * 0.13) * alpha * 2;
                    ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.65, rr, 0, 0, Math.PI * 2); ctx.stroke();
                }
                break;
            }
            case 'prism': {
                const colors = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6'];
                ctx.lineWidth = Math.max(1.5, minSide * 0.025);
                for (let i = 0; i < colors.length; i++) {
                    ctx.strokeStyle = `${colors[i]}AA`;
                    const y = -h * 0.34 + i * h * 0.17;
                    ctx.beginPath(); ctx.moveTo(-w * 0.28, y); ctx.lineTo(w * 0.28, -y * 0.45); ctx.stroke();
                }
                ctx.strokeStyle = `rgba(224, 242, 254, ${0.55 + pulse * 0.25})`;
                ctx.beginPath();
                ctx.moveTo(0, -h * 0.44); ctx.lineTo(w * 0.30, -h * 0.12); ctx.lineTo(w * 0.18, h * 0.40);
                ctx.lineTo(-w * 0.18, h * 0.40); ctx.lineTo(-w * 0.30, -h * 0.12); ctx.closePath();
                ctx.stroke();
                break;
            }
            case 'hive': {
                const alpha = 0.30 + pulse * 0.14;
                ctx.strokeStyle = `rgba(190, 242, 100, ${alpha})`;
                ctx.fillStyle = `rgba(132, 204, 22, ${alpha * 0.25})`;
                ctx.lineWidth = Math.max(1.2, minSide * 0.022);
                const cols = 2, rows = 4;
                for (let iy = 0; iy < rows; iy++) {
                    for (let ix = 0; ix < cols; ix++) {
                        const cx = (ix - 0.5) * w * 0.26 + (iy % 2 ? w * 0.07 : -w * 0.07);
                        const cy = (iy - 1.5) * h * 0.18;
                        const rr = minSide * 0.095;
                        ctx.beginPath();
                        for (let k = 0; k < 6; k++) {
                            const a = Math.PI / 6 + k * Math.PI / 3;
                            const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
                            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                        }
                        ctx.closePath(); ctx.fill(); ctx.stroke();
                    }
                }
                ctx.fillStyle = `rgba(217, 249, 157, ${0.42 + pulse * 0.35})`;
                ctx.beginPath(); ctx.arc(w * 0.18, h * 0.28, minSide * 0.055, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'siege': {
                const alpha = 0.32 + pulse * 0.10;
                ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
                ctx.fillStyle = `rgba(120, 53, 15, ${alpha * 0.32})`;
                ctx.lineWidth = Math.max(2, minSide * 0.032);
                for (const y of [-h * 0.22, h * 0.22]) {
                    ctx.beginPath(); ctx.roundRect(-w * 0.40, y - h * 0.09, w * 0.72, h * 0.18, 6); ctx.fill(); ctx.stroke();
                    for (let i = 0; i < 5; i++) {
                        const x = -w * 0.31 + i * w * 0.15;
                        ctx.beginPath(); ctx.moveTo(x, y - h * 0.08); ctx.lineTo(x + w * 0.05, y + h * 0.08); ctx.stroke();
                    }
                }
                ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.9})`;
                ctx.beginPath();
                ctx.moveTo(w * 0.20, -h * 0.32); ctx.lineTo(w * 0.46, 0); ctx.lineTo(w * 0.20, h * 0.32); ctx.closePath(); ctx.fill();
                break;
            }
            case 'gravityWell': {
                const alpha = 0.36 + pulse * 0.18;
                const r0 = minSide * 0.18;
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, minSide * 0.45);
                g.addColorStop(0, 'rgba(2, 6, 23, 0.85)');
                g.addColorStop(0.45, `rgba(124, 58, 237, ${alpha})`);
                g.addColorStop(1, 'rgba(59, 7, 100, 0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(0, 0, minSide * 0.45, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(196, 181, 253, ${alpha})`;
                ctx.lineWidth = Math.max(1.5, minSide * 0.025);
                for (let i = 0; i < 3; i++) {
                    const a = t * 0.55 + i * Math.PI * 2 / 3;
                    ctx.beginPath();
                    ctx.ellipse(Math.cos(a) * r0 * 0.35, Math.sin(a) * r0 * 0.35, minSide * 0.34, minSide * 0.11, a, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
                ctx.beginPath(); ctx.arc(0, 0, r0, 0, Math.PI * 2); ctx.fill();
                break;
            }
            default:
                break;
        }
        ctx.restore();
    }

    /**
     * 根据词缀组合返回对应的身份色（用于 Layer 1.6 色调叠加）
     * 使得玩家能通过颜色氛围快速识别词缀组合。
     */
    _getAffixTintColor() {
        if (!this.affixes || this.affixes.length === 0) return null;
        const sorted = [...this.affixes].sort().join('+');
        const TINTS = {
            // 单词缀
            'shield':     '#3b82f6',
            'haste':      '#eab308',
            'regen':      '#22c55e',
            'clone':      '#a855f7',
            'healer':     '#ec4899',
            'devour':     '#7c3aed',
            'jump':       '#06b6d4',
            'berserk':    '#f97316',
            'heavyArmor': '#78716c',
            'deflectionWard': '#38bdf8',
            'echoRelay': '#f0abfc',
            'prism': '#67e8f9',
            'hive': '#a3e635',
            'siege': '#facc15',
            'gravityWell': '#7c3aed',
            // 双词缀组合
            'haste+shield':    '#60a5fa',  // 蓝黄 → 亮蓝
            'regen+shield':    '#34d399',  // 蓝绿 → 青绿
            'clone+shield':    '#818cf8',  // 蓝紫 → 靛蓝
            'healer+shield':   '#f472b6',  // 蓝粉 → 粉紫
            'devour+shield':   '#8b5cf6',  // 蓝靛 → 紫电
            'jump+shield':     '#22d3ee',  // 蓝青 → 天蓝
            'haste+regen':     '#a3e635',  // 黄绿 → 黄绿
            'clone+haste':     '#c084fc',  // 黄紫 → 浅紫
            'haste+healer':    '#fb7185',  // 黄粉 → 橙粉
            'clone+regen':     '#4ade80',  // 绿紫 → 翠绿
            'healer+regen':    '#86efac',  // 绿粉 → 薄荷
            'jump+regen':      '#2dd4bf',  // 绿青 → 宝青
            'berserk+regen':   '#fb923c',  // 绿橙 → 暖橙
            'clone+healer':    '#e879f9',  // 粉紫 → 洋红
            'berserk+clone':   '#f43f5e',  // 紫红 → 玫红
            'berserk+devour':  '#dc2626',  // 紫橙 → 血红
            'devour+jump':     '#0891b2',  // 靛青 → 深青
            'berserk+jump':    '#ea580c',  // 青橙 → 烈橙
            'heavyArmor+shield': '#64748b',
            'heavyArmor+regen':  '#4b7a5c',
            'heavyArmor+haste':  '#a16207',
            'heavyArmor+berserk':'#b91c1c',
        };
        return TINTS[sorted] || TINTS[this.affixes[0]] || null;
    }

    /**
     * 绘制词缀组合标识章（Layer 1.6）
     * 在敌人体内顶部偏左绘制一个小型几何印章，每种词缀都有独特图形。
     */
    _drawAffixSigil(ctx, w, h) {
        if (!this.affixes || this.affixes.length === 0) return;
        const r = Math.min(w, h) * 0.12; // 印章半径
        const spacing = r * 2.6;
        const count = Math.min(this.affixes.length, 3);
        const startX = -((count - 1) * spacing) / 2;
        const sigilY = -h / 2 + r + 4;

        const SIGIL_COLORS = {
            shield:     '#93c5fd',
            haste:      '#fde047',
            regen:      '#86efac',
            clone:      '#d8b4fe',
            healer:     '#f9a8d4',
            devour:     '#a78bfa',
            jump:       '#67e8f9',
            berserk:    '#fb923c',
            heavyArmor: '#94a3b8',
            deflectionWard: '#7dd3fc',
            echoRelay: '#f0abfc',
            prism: '#67e8f9',
            hive: '#bef264',
            siege: '#fde047',
            gravityWell: '#c4b5fd',
        };

        ctx.save();
        for (let i = 0; i < count; i++) {
            const affix = this.affixes[i];
            const cx = startX + i * spacing;
            const cy = sigilY;
            const color = SIGIL_COLORS[affix] || '#ffffff';
            const pulse = (Math.sin(Date.now() / 900 + i * 1.3 + this.visualSeed * 4) + 1) * 0.5;
            ctx.globalAlpha = 0.7 + pulse * 0.25;
            ctx.shadowColor = color;
            ctx.shadowBlur = 4 + pulse * 4;
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.2;
            ctx.beginPath();

            switch (affix) {
                case 'shield': {
                    // 六边形
                    for (let k = 0; k < 6; k++) {
                        const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
                        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
                        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }
                case 'haste': {
                    // 闪电折线
                    ctx.moveTo(cx - r * 0.3, cy - r);
                    ctx.lineTo(cx + r * 0.1, cy - r * 0.1);
                    ctx.lineTo(cx - r * 0.1, cy + r * 0.1);
                    ctx.lineTo(cx + r * 0.3, cy + r);
                    ctx.stroke();
                    break;
                }
                case 'regen': {
                    // 向上箭头（生长）
                    ctx.moveTo(cx, cy - r);
                    ctx.lineTo(cx + r * 0.5, cy - r * 0.2);
                    ctx.moveTo(cx, cy - r);
                    ctx.lineTo(cx - r * 0.5, cy - r * 0.2);
                    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r * 0.6);
                    ctx.stroke();
                    // 底部小圆点
                    ctx.beginPath(); ctx.arc(cx, cy + r * 0.6, r * 0.22, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'clone': {
                    // 两个重叠小圆
                    ctx.arc(cx - r * 0.3, cy, r * 0.55, 0, Math.PI * 2);
                    ctx.moveTo(cx + r * 0.3 + r * 0.55, cy);
                    ctx.arc(cx + r * 0.3, cy, r * 0.55, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                case 'healer': {
                    // 十字
                    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
                    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
                    ctx.stroke();
                    break;
                }
                case 'devour': {
                    // 螺旋（用圆弧近似）
                    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 1.6);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(cx, cy, r * 0.35, 0, Math.PI);
                    ctx.stroke();
                    break;
                }
                case 'jump': {
                    // 向上双箭头
                    const dy = r * 0.4;
                    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.5, cy - r + dy);
                    ctx.moveTo(cx, cy - r); ctx.lineTo(cx - r * 0.5, cy - r + dy);
                    ctx.moveTo(cx, cy - r * 0.2); ctx.lineTo(cx + r * 0.5, cy - r * 0.2 + dy);
                    ctx.moveTo(cx, cy - r * 0.2); ctx.lineTo(cx - r * 0.5, cy - r * 0.2 + dy);
                    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r * 0.5);
                    ctx.stroke();
                    break;
                }
                case 'berserk': {
                    // 火焰（三角形锯齿）
                    ctx.moveTo(cx, cy - r);
                    ctx.lineTo(cx + r * 0.45, cy + r * 0.5);
                    ctx.lineTo(cx, cy + r * 0.1);
                    ctx.lineTo(cx - r * 0.45, cy + r * 0.5);
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }
                case 'heavyArmor': {
                    // 装甲盾牌（宽矩形 + 底部弧）
                    ctx.rect(cx - r, cy - r * 0.7, r * 2, r * 1.1);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(cx, cy + r * 0.4, r * 0.5, 0, Math.PI);
                    ctx.stroke();
                    break;
                }
                default: {
                    // 默认：小菱形
                    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.7, cy);
                    ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.7, cy);
                    ctx.closePath(); ctx.stroke();
                }
            }
        }
        ctx.restore();
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

    // ==================== [V2 基底专属词条] 静态辅助 ====================

    /**
     * @static
     * @method _hiveSpawnLarva
     * @description [hive] 在孵化巢下方/侧方寻找空位生成一个低血量幼体（无词条）。
     *              幼体血量为 baseHP（按巢血量近似）的 hiveSpawnHpPct 比例。
     */
    static _hiveSpawnLarva(host, game, afx) {
        if (!game || !host || !host.active) return;
        const w = game.enemyWidth, h = game.enemyHeight;
        const candidatePositions = [
            new Vec2(host.pos.x,           host.pos.y + host.height / 2 + h / 2),
            new Vec2(host.pos.x - w,       host.pos.y + host.height / 2 + h / 2),
            new Vec2(host.pos.x + w,       host.pos.y + host.height / 2 + h / 2),
            new Vec2(host.pos.x - host.width / 2 - w / 2, host.pos.y),
            new Vec2(host.pos.x + host.width / 2 + w / 2, host.pos.y),
        ];
        for (const p of candidatePositions) {
            if (p.x < w / 2 || p.x > game.width - w / 2) continue;
            if (game.calc_isAreaOccupied(p.x, p.y, w * 0.8, h * 0.8)) continue;
            const pct = (afx && afx.hiveSpawnHpPct) || 0.15;
            const larvaHp = Math.max(1, Math.floor(host.maxHp * pct));
            const larva = new Enemy(p.x, p.y, w, h, larvaHp);
            larva.affixes = [];
            larva.type = 'normal';
            larva._isHiveLarva = true;
            larva.dropTargetY = p.y;
            larva.hasActedThisTurn = true;
            if (typeof game.sys_determineEnemyReward === 'function') {
                game.sys_determineEnemyReward(larva, false);
            }
            if (typeof larva.initSprite === 'function') larva.initSprite();
            game.enemies.push(larva);
            game.spawn_createParticle(p.x, p.y, '#a3e635', 'mist');
            game.spawn_createFloatingText(host.pos.x, host.pos.y - 50, '🥚HATCH', '#a3e635');
            return;
        }
    }

    /**
     * @static
     * @method _echoRelayRetrigger
     * @description [echoRelay] 额外触发一次周围敌人的词条效果。
     *              "周围"按尖塔占格外缘一圈计算（用 1.5 倍尖塔宽度作为半径）。
     *              触发的词条限制为 regen / healer / clone / devour / haste（位置相关词条不重复触发）。
     *              每个被触发的目标本回合最多被 echo 一次（_echoedThisTurn 标记），避免多塔叠加失控。
     */
    static _echoRelayRetrigger(spire, game, afx) {
        if (!game || !spire || !spire.active) return;
        const range = spire.width * (afx && afx.echoRelayRange ? afx.echoRelayRange : 1.5)
            + (spire.height * 0.5);
        let triggered = 0;
        for (const other of game.enemies) {
            if (!other || !other.active || other === spire) continue;
            if (other._echoedThisTurn) continue;
            if (spire.pos.dist(other.pos) > range) continue;
            const list = other.affixes || [];
            let didEcho = false;

            // regen：再生一次
            if (list.includes('regen') && other.hp < other.maxHp) {
                const heal = Math.floor(other.maxHp * (afx.regenPercent || 0.2)) || 1;
                other.hp = Math.min(other.maxHp, other.hp + heal);
                game.spawn_createFloatingText(other.pos.x, other.pos.y - 30, `+${heal}`, '#4ade80');
                didEcho = true;
            }
            // healer：对邻居再治疗一次（治疗本人不结算，仅周围）
            if (list.includes('healer')) {
                const range2 = other.width * (afx.healerRange || 2);
                game.enemies.forEach(t => {
                    if (t !== other && t.active && t.hp < t.maxHp && other.pos.dist(t.pos) < range2) {
                        const healAmt = Math.ceil(t.maxHp * (afx.healerPercent || 0.12));
                        if (t.hp > t.greenHp) t.greenHp = t.hp;
                        t.hp = Math.min(t.maxHp, t.hp + healAmt);
                        didEcho = true;
                    }
                });
            }
            // clone：额外触发一次分身（按 cloneChanceTurn 概率）
            if (list.includes('clone') && Math.random() < (afx.cloneChanceTurn || 0.5)) {
                if (typeof game.spawn_triggerCloneSpawn === 'function') {
                    game.spawn_triggerCloneSpawn(other);
                    didEcho = true;
                }
            }
            // haste：额外触发一次冲刺移动
            if (list.includes('haste')) {
                const moveAmount = game.enemyHeight;
                const targetY = other.dropTargetY + moveAmount;
                const isBlocked = game.calc_isAreaOccupied(other.pos.x, targetY, other.width * 0.8, other.height * 0.8, other);
                if (!isBlocked) {
                    other.advance(moveAmount);
                    game.spawn_createFloatingText(other.pos.x, other.pos.y - 50, '⚡ECHO!', '#f0abfc');
                    didEcho = true;
                }
            }

            if (didEcho) {
                other._echoedThisTurn = true;
                triggered++;
            }
        }

        if (triggered > 0) {
            game.spawn_createShockwave(spire.pos.x, spire.pos.y, '#f0abfc');
            game.spawn_createFloatingText(spire.pos.x, spire.pos.y - 30, `🔮ECHO ×${triggered}`, '#f0abfc');
        }
    }
}

// ==================== 导出 ====================
export { Enemy };
