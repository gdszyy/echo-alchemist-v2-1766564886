/**
 * enemy.js - 敌人类模块
 * 
 * 职责：
 * - 敌人实体的完整实现
 * - AI行为树系统
 * - 敌人技能和战斗逻辑
 * 
 * 包含的类：
 * - Enemy: 敌人类（包含18个方法）
 */

import { Vec2 } from './mechanics.js';
import { CONFIG } from '../config.js';

// 注意：audio 实例在 core.js 中创建并挂载到 window 对象，避免循环依赖
const getAudio = () => window.audio;
const audio = new Proxy({}, {
    get: (target, prop) => {
        const audioInstance = window.audio;
        if (!audioInstance) {
            console.warn('audio instance not yet initialized');
            return () => {};
        }
        return audioInstance[prop];
    }
});

class Enemy {
    constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = []) {
        this.pos = new Vec2(x, y); 
        this.width = width; 
        this.height = height; 
        this.hp = hp;       
        this.maxHp = maxHp; 

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
        
        // --- [新增] 长短距离方向系统 ---
        this.primaryAxis = null;    // 长距离方向：'horizontal' 或 'vertical'
        this.secondaryAxis = null;  // 短距离方向：'horizontal' 或 'vertical'
        this.spawnPos = new Vec2(x, y); // 记录生成位置，用于后续计算

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
        // 1. 真实血条平滑过渡 (保持原逻辑)
        // this.displayHp = lerp(this.displayHp, this.hp, 0.2);

        
        // 血量滚动
        if (this.displayHp > this.hp) {
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
            if (this.displayHp < this.hp) this.displayHp = this.hp;
        } else {
            this.displayHp = this.hp;
            this.hpDropTimer = 0;
        }

        // 2. 白色延迟血条逻辑
        if (this.whiteBarTimer > 0) {
            // 如果还在缓冲期（刚受过伤），白色血条不动，保持在旧的高位
            this.whiteBarTimer--;
        } else {
            // 缓冲结束，白色血条快速追赶当前血量
            // 追赶速度比 displayHp 快，产生"崩塌"感
            this.delayedHp = lerp(this.delayedHp, this.displayHp, 0.25);
            
            // 阈值修正，防止无限逼近
            if (Math.abs(this.delayedHp - this.displayHp) < 0.1) {
                this.delayedHp = this.displayHp;
            }
        }
        
        // 确保白色血条不会低于真实血条 (比如治疗时)
        if (this.delayedHp < this.displayHp) {
            this.delayedHp = this.displayHp;
        }

        // 3. [新增] 绿色回血血条逻辑
        if (this.hp > this.greenHp) {
            // 发生回血，greenHp 立即跳到新血量，displayHp 随后跟上
            this.greenHp = this.hp;
            this.greenBarTimer = 45; // 增加缓冲时间，约 0.75 秒
        }

        if (this.greenBarTimer > 0) {
            this.greenBarTimer -= timeScale;
            // 在缓冲期内，displayHp 保持不动，让绿色血块显现
        } else {
            // 缓冲结束，displayHp 开始追赶真实血量
            if (this.displayHp < this.hp) {
                // 回血时，displayHp 慢慢涨上去
                this.displayHp = lerp(this.displayHp, this.hp, 0.1 * timeScale);
                if (Math.abs(this.hp - this.displayHp) < 0.5) {
                    this.displayHp = this.hp;
                    this.greenHp = this.hp; // 追赶完成后同步 greenHp
                }
            } else {
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

        // 检测是否需要跳跃 (四个方向都被阻挡但跳跃可行)
        if (!this.actionIcon && this.affixes.includes('jump')) {
            const directions = [
                { dx: 0, dy: game.enemyHeight },
                { dx: 0, dy: -game.enemyHeight },
                { dx: -game.enemyWidth, dy: 0 },
                { dx: game.enemyWidth, dy: 0 }
            ];
            
            let allBlocked = true;
            let canJump = false;
            
            for (let dir of directions) {
                const targetX = this.pos.x + dir.dx;
                const targetY = this.dropTargetY + dir.dy;
                
                // 检查边界
                if (targetX < game.enemyWidth/2 || targetX > game.width - game.enemyWidth/2) continue;
                if (targetY < 0) continue;
                
                const isBlocked = game.calc_isAreaOccupied(targetX, targetY, this.width * 0.8, this.height * 0.8, this);
                
                if (!isBlocked) {
                    allBlocked = false;
                    break;
                } else {
                    // 检查跳跃是否可行
                    const jumpX = this.pos.x + dir.dx * 2;
                    const jumpY = this.dropTargetY + dir.dy * 2;
                    
                    if (jumpX >= game.enemyWidth/2 && jumpX <= game.width - game.enemyWidth/2 && jumpY >= 0) {
                        const isJumpBlocked = game.calc_isAreaOccupied(jumpX, jumpY, this.width * 0.8, this.height * 0.8, this);
                        if (!isJumpBlocked) {
                            canJump = true;
                        }
                    }
                }
            }
            
            if (allBlocked && canJump) {
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

            // --- 四向移动系统：总是向player移动 ---
            this.performOptimalMove(game, i === 0);
        }
        
        this.hasActedThisTurn = true;
    }

    /**
     * 初始化长短距离方向（第一次移动时调用）
     * @param {Game} game - 游戏实例
     */
    initializeMoveAxes(game) {
        if (!game.player || this.primaryAxis !== null) return;
        
        const playerPos = game.player.pos;
        const dx = Math.abs(this.spawnPos.x - playerPos.x);
        const dy = Math.abs(this.spawnPos.y - playerPos.y);
        
        if (dx > dy) {
            this.primaryAxis = 'horizontal';  // 横向为长距离方向
            this.secondaryAxis = 'vertical';   // 纵向为短距离方向
        } else {
            this.primaryAxis = 'vertical';     // 纵向为长距离方向
            this.secondaryAxis = 'horizontal';  // 横向为短距离方向
        }
    }
    
    /**
     * 执行最优移动：优先选择长距离方向
     * @param {Game} game - 游戏实例
     * @param {boolean} showFeedback - 是否显示视觉反馈
     */
    performOptimalMove(game, showFeedback = true) {
        if (!game.player) return;
        
        // 第一次移动时初始化长短距离方向
        this.initializeMoveAxes(game);
        
        const afx = CONFIG.balance.affixes;
        const playerPos = game.player.pos;
        
        // 定义四个方向
        const directions = {
            horizontal: [
                { name: 'left', dx: -game.enemyWidth, dy: 0, icon: '←', axis: 'horizontal' },
                { name: 'right', dx: game.enemyWidth, dy: 0, icon: '→', axis: 'horizontal' }
            ],
            vertical: [
                { name: 'down', dx: 0, dy: game.enemyHeight, icon: '↓', axis: 'vertical' },
                { name: 'up', dx: 0, dy: -game.enemyHeight, icon: '↑', axis: 'vertical' }
            ]
        };
        
        // 按优先级排序：先长距离方向，后短距离方向
        const primaryDirs = directions[this.primaryAxis];
        const secondaryDirs = directions[this.secondaryAxis];
        
        // 尝试移动的优先级列表
        const tryOrder = [
            { dirs: primaryDirs, distance: 1, isJump: false },      // 1. 长距离方向 1格
            { dirs: secondaryDirs, distance: 1, isJump: false },    // 2. 短距离方向 1格
            { dirs: primaryDirs, distance: 2, isJump: true },       // 3. 长距离方向跳跃 2格
            { dirs: secondaryDirs, distance: 2, isJump: true }      // 4. 短距离方向跳跃 2格
        ];
        
        let bestMove = null;
        
        // 按优先级尝试移动
        for (let attempt of tryOrder) {
            // 如果是跳跃但没有jump技能，跳过
            if (attempt.isJump && !this.affixes.includes('jump')) continue;
            
            for (let dir of attempt.dirs) {
                const targetX = this.pos.x + dir.dx * attempt.distance;
                const targetY = this.dropTargetY + dir.dy * attempt.distance;
                
                // 检查边界
                if (targetX < game.enemyWidth/2 || targetX > game.width - game.enemyWidth/2) continue;
                if (targetY < 0) continue;
                
                // 检查是否向player移动（距离减小）
                const currentDist = Math.abs(this.pos.x - playerPos.x) + Math.abs(this.dropTargetY - playerPos.y);
                const newDist = Math.abs(targetX - playerPos.x) + Math.abs(targetY - playerPos.y);
                
                if (newDist >= currentDist) continue; // 不接近player，跳过
                
                // 检查碰撞
                const isBlocked = game.calc_isAreaOccupied(targetX, targetY, this.width * 0.8, this.height * 0.8, this);
                
                if (!isBlocked) {
                    bestMove = { x: targetX, y: targetY, dir: dir, isJump: attempt.isJump };
                    break; // 找到可行移动，立即执行
                }
            }
            
            if (bestMove) break; // 已找到移动，退出循环
        }
        
        // 执行移动
        if (bestMove) {
            this.pos.x = bestMove.x;
            this.dropTargetY = bestMove.y;
            
            if (showFeedback) {
                if (bestMove.isJump) {
                    this.bumpOffsetY = -30;
                    game.spawn_createFloatingText(this.pos.x, this.pos.y, "JUMP!", "#38bdf8");
                    game.spawn_createParticle(this.pos.x, this.pos.y, '#38bdf8', 'mist');
                    audio.playEffect('split');
                } else {
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, bestMove.dir.icon, "#fbbf24");
                    game.spawn_createParticle(this.pos.x, this.pos.y, '#fbbf24', 'spark');
                }
            }
        } else {
            // 所有方向都被阻挡或不接近player
            if (showFeedback) {
                this.bumpOffsetY = -10;
                if (Math.random() < 0.3) {
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, "⛔ BLOCKED", "#ef4444");
                }
            }
        }
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
        // console.log("isMarked",isMarked)
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
        this.markTimer = CONFIG.flyingSword.markDuration;
    }

    takeDamage(amount) {
        let actualDamage = amount;
        
        // 1. 计算护盾减伤
        if (this.affixes.includes('shield')) {
            const reduction = CONFIG.balance.affixes.shieldReduction || 0.8;
            actualDamage *= reduction; // 护盾减少伤害
            
            // 触发护盾视觉反馈 (限制频率)
            if (this.shieldHitTimer <= 0) {
                this.shieldHitTimer = 15;
                if (typeof game !== 'undefined') {
                    game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, "🛡️Block", "#93c5fd");
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

// ==================== 导出敌人类 ====================
export { Enemy };
