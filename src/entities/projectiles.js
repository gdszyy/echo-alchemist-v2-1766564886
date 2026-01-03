/**
 * projectiles.js - 弹射物和飞剑系统模块
 * 
 * 职责：
 * - 各种弹射物的实现（子弹、飞剑、孢子等）
 * - 飞剑系统的完整实现
 * 
 * 包含的类：
 * - SwordQi: 剑气
 * - SlashAnim: 斩击动画
 * - SonSword: 子母剑
 * - Projectile: 通用弹射物
 * - CloneSpore: 分身孢子
 * 
 * 包含的函数：
 * - rotateTowards: 角度旋转辅助函数
 */

import { Vec2 } from './mechanics.js';
import { CONFIG } from '../config.js';

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
        this.active = false; this.destroyed = true;
        if (this.config.nestedPayload && !this.isCopy) {
             let nextVel = this.vel.norm().mult(this.vel.mag() * 1.1); 
             if (nextVel.mag() < 2) nextVel = new Vec2(0, -5);
             spawnCallback({ x: this.pos.x, y: this.pos.y, vel: nextVel, config: this.config.nestedPayload });
        } else if (this.config.chainPayload && !this.isCopy) {
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


// ==================== 导出弹射物类和函数 ====================
export {
    SwordQi,
    SlashAnim,
    SonSword,
    Projectile,
    CloneSpore,
    rotateTowards
};
