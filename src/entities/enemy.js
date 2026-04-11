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

        // 视觉种子
        this.visualSeed = Math.random(); 
        
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
        
        // 狂暴判定
        if (this.affixes.includes('haste')) actionCount = 2;
        else if (this.actionName === '狂暴') actionCount = 2;

        // Boss 行为差异化：根据 bossType 修改行动次数
        if (this.type === 'boss' && this.bossType) {
            actionCount = this._getBossActionCount(actionCount);
        }

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
                // Boss 维里迪斯特殊：狂暴后治疗范围扩大到全场
                let effectiveHealerRange = afx.healerRange;
                if (this.type === 'boss' && this.bossType === 'viridis' && this._berserkedHealerRange) {
                    effectiveHealerRange = this._berserkedHealerRange;
                }
                const range = this.width * effectiveHealerRange;
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
                    } else {
                        if (i === 0) {
                            this.bumpOffsetY = -10;
                            if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
                        }
                    }
                } else {
                    if (i === 0) {
                        this.bumpOffsetY = -10;
                        if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
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
                    } else {
                        if (i === 0) {
                            this.bumpOffsetY = -10;
                            if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
                        }
                    }
                } else {
                    if (i === 0) {
                        this.bumpOffsetY = -10;
                        if (Math.random() < 0.3) game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'BLOCKED', '#ef4444');
                    }
                }
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

        // === Layer 3.5: 内部词缀特效 (clone 细胞斑点) ===
        if (this.affixes.includes('clone')) {
            const t35 = Date.now() / 1000;
            const affixAlpha35 = this.affixes.length > 3 ? 0.8 : 1.0;
            ctx.save();
            // 使用 visualSeed 确定斑点位置，保证每个敌人的斑点布局固定
            const spotPositions = [
                { x: -w * 0.25, y: -h * 0.15 },
                { x:  w * 0.20, y:  h * 0.10 },
                { x: -w * 0.10, y:  h * 0.25 },
                { x:  w * 0.30, y: -h * 0.25 }
            ];
            spotPositions.forEach((sp, i) => {
                // 收缩/膨胀动态：每个斑点相位不同
                const pulse = Math.sin(t35 + i * 1.3 + this.visualSeed * 6) * 0.3 + 0.7;
                const baseR = (3 + this.visualSeed * 3 + i * 1.5) * pulse;
                // 轻微游离
                const driftX = Math.sin(t35 * 0.7 + i * 2.1) * 2;
                const driftY = Math.cos(t35 * 0.5 + i * 1.7) * 2;
                ctx.beginPath();
                ctx.arc(sp.x + driftX, sp.y + driftY, Math.max(1, baseR), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(192, 132, 252, ${0.25 * affixAlpha35})`; // #c084fc 紫色
                ctx.fill();
                // 边缘微光
                ctx.strokeStyle = `rgba(216, 180, 254, ${0.4 * affixAlpha35})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            });
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

        // 文字层：移除 emoji 角标，保留血量数字显示（emoji 角标已由 Layer 8 词缀光环替代）
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

        // === Layer 8: 外部词缀光环层 ===
        // 绘制在 Layer 7 扫描反馈之后，常驻可见
        if (this.affixes.length > 0) {
            const t8 = Date.now() / 1000;
            // 多词缀叠加透明度衰减规则
            const affixAlpha = this.affixes.length > 3 ? 0.8 : 1.0;
            const ex = this.pos.x;
            const ey = this.pos.y + this.bumpOffsetY;

            // --- shield: 外围六边形虚线框，浅蓝 #93c5fd，呼吸脉冲 (透明度 0.6-0.9) ---
            if (this.affixes.includes('shield') && this.shieldCharges > 0) {
                ctx.save();
                ctx.translate(ex, ey);
                const shieldPulse = Math.sin(t8) * 0.15 + 0.75;
                ctx.globalAlpha = shieldPulse * affixAlpha;
                ctx.strokeStyle = '#93c5fd';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#93c5fd';
                ctx.shadowBlur = 8;
                ctx.setLineDash([5, 4]);
                const sx = w / 2 + 8, sy = h / 2 + 8;
                const cut = 10;
                ctx.beginPath();
                ctx.moveTo(-sx + cut, -sy);
                ctx.lineTo(sx - cut, -sy);
                ctx.lineTo(sx, -sy + cut);
                ctx.lineTo(sx, sy - cut);
                ctx.lineTo(sx - cut, sy);
                ctx.lineTo(-sx + cut, sy);
                ctx.lineTo(-sx, sy - cut);
                ctx.lineTo(-sx, -sy + cut);
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }

            // --- regen: 底部四角藤蔓折线，绿色 #4ade80，末端闪烁 ---
            if (this.affixes.includes('regen')) {
                ctx.save();
                ctx.translate(ex, ey);
                const regenFlicker = Math.sin(t8 * 2.5 + this.visualSeed * 5) * 0.3 + 0.7;
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                const corners = [
                    { ox: -w/2, oy: h/2, dx: -1, dy: 1 },
                    { ox:  w/2, oy: h/2, dx:  1, dy: 1 },
                    { ox: -w/2, oy: h/2 - 10, dx: -1, dy: 1 },
                    { ox:  w/2, oy: h/2 - 10, dx:  1, dy: 1 }
                ];
                corners.forEach((c, i) => {
                    const alpha = (i < 2 ? 0.7 : 0.4) * affixAlpha;
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.moveTo(c.ox, c.oy);
                    ctx.lineTo(c.ox + c.dx * 8, c.oy + c.dy * 5);
                    ctx.lineTo(c.ox + c.dx * 12, c.oy + c.dy * 12);
                    ctx.stroke();
                    ctx.globalAlpha = regenFlicker * alpha;
                    ctx.fillStyle = '#4ade80';
                    ctx.beginPath();
                    ctx.arc(c.ox + c.dx * 12, c.oy + c.dy * 12, 2, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.restore();
            }

            // --- haste: 左右两侧速度线，黄色 #facc15，快速微位移 ---
            if (this.affixes.includes('haste')) {
                ctx.save();
                ctx.translate(ex, ey);
                const hasteShift = Math.sin(Date.now() / 300) * 3;
                const lineAlpha = (Math.sin(t8 * 0.8) * 0.2 + 0.6) * affixAlpha;
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                ctx.globalAlpha = lineAlpha;
                [-1, 1].forEach(side => {
                    const bx = side * (w / 2 + 6 + hasteShift * side);
                    [-h * 0.2, h * 0.1].forEach(ly => {
                        ctx.beginPath();
                        ctx.moveTo(bx, ly - 8);
                        ctx.lineTo(bx + side * 6, ly);
                        ctx.lineTo(bx, ly + 8);
                        ctx.stroke();
                    });
                });
                ctx.restore();
            }

            // --- devour: 底部边缘锯齿阴影，暗红 #991b1b，蠕动变化 ---
            if (this.affixes.includes('devour')) {
                ctx.save();
                ctx.translate(ex, ey);
                ctx.globalAlpha = 0.7 * affixAlpha;
                ctx.fillStyle = '#991b1b';
                ctx.beginPath();
                const toothCount = 7;
                const toothW = w / toothCount;
                ctx.moveTo(-w / 2, h / 2);
                for (let i = 0; i < toothCount; i++) {
                    const tx = -w / 2 + i * toothW;
                    const toothH = 6 + Math.sin(t8 * 1.5 + i * 0.9 + this.visualSeed * 4) * 3;
                    ctx.lineTo(tx + toothW * 0.5, h / 2 + toothH);
                    ctx.lineTo(tx + toothW, h / 2);
                }
                ctx.lineTo(w / 2, h / 2 + 14);
                ctx.lineTo(-w / 2, h / 2 + 14);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // --- healer: 顶部中心十字星，粉色 #f472b6，缓慢旋转 ---
            if (this.affixes.includes('healer')) {
                ctx.save();
                ctx.translate(ex, ey - h / 2 - 14);
                const healRot = t8 * 0.5;
                ctx.rotate(healRot);
                const healPulse = Math.sin(t8) * 0.2 + 0.7;
                ctx.globalAlpha = healPulse * affixAlpha;
                ctx.strokeStyle = '#f472b6';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.shadowColor = '#f472b6';
                ctx.shadowBlur = 6;
                [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(angle => {
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
                    ctx.stroke();
                });
                ctx.beginPath();
                ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#f472b6';
                ctx.fill();
                ctx.restore();
            }

            // --- jump: 正下方弧线弹簧，青色 #2dd4bf，曲率周期变化 ---
            if (this.affixes.includes('jump')) {
                ctx.save();
                ctx.translate(ex, ey + h / 2 + 4);
                const jumpCurve = Math.sin(t8) * 8 + 12;
                const jumpAlpha = (Math.sin(t8 * 0.7) * 0.2 + 0.6) * affixAlpha;
                ctx.globalAlpha = jumpAlpha;
                ctx.strokeStyle = '#2dd4bf';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.shadowColor = '#2dd4bf';
                ctx.shadowBlur = 5;
                [-1, 1].forEach(side => {
                    ctx.beginPath();
                    ctx.moveTo(side * w * 0.1, 0);
                    ctx.quadraticCurveTo(
                        side * w * 0.3, jumpCurve,
                        side * w * 0.45, jumpCurve * 0.6
                    );
                    ctx.stroke();
                });
                ctx.restore();
            }
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

// ==================== 导出 ====================
export { Enemy };
