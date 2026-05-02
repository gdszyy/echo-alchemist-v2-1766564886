/**
 * projectile.js - 子弹（弹珠）实体类
 * 
 * 职责：
 * - Projectile 类定义（包含完整的物理更新、碰撞检测、视觉渲染）
 * - 子弹的弹跳、穿透、各属性特效逻辑
 * - 子弹与敌人的碰撞检测和伤害触发
 * 
 * 依赖：
 * - CONFIG（来自 config.js）
 * - Vec2（来自 utils/math_utils.js）
 * - Particle、SlashEffect（来自 effects/particles.js）
 * - audio（来自 entities.js 的音频注入代理）
 * 
 * 注意：Projectile 使用 Enemy 作为参数类型，但不直接 import Enemy
 * （通过 game.combat_damageEnemy 间接交互，避免循环依赖）
 * 
 * 重构历史：
 * - Task 2.2: 从 entities.js 中提取
 */
import { CONFIG } from '../config.js';
import { Vec2 } from '../utils/math_utils.js';
import { Particle, SlashEffect } from '../effects/particles.js';
import { sb as _sb } from '../utils/perf.js';

// audio 代理由 entities.js 注入，通过模块级变量共享
let _audioProvider = null;
export function setProjectileAudioProvider(provider) {
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

import { calc_getCirclePolygonCollision, calc_getCircleArcCollision } from '../combat/collision_shapes.js';

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
        
        // [词条 Hook] 动能衰变 (kinetic_decay)
        this._kineticDecayCurrentBonus = config._kineticDecayBonus || 0;

        // [新属性] venom / overcharge / echo
        this.venom = config.venom || 0;
        this.overcharge = config.overcharge || 0;
        this.echo = config.echo || 0;
        // 超载充能计数（穿透 +3，弹跳 +1）
        this._chargeCount = 0;
        // scatter 副弹继承比例（默认 1.0，spawn_system 派生时按需设置 0.5）
        this._scatterInheritRatio = (typeof config._scatterInheritRatio === 'number') ? config._scatterInheritRatio : 1.0;
        // 防止 echo 子弹无限链式触发
        this._isEchoChild = config._isEchoChild || false;
        
        // [词条 Hook] 回响射击 (echo_shot)
        this._echoShotFired = config._echoShotFired || false;
        this.rotation = 0;
        this.windBladeAngle = 0; // 风属性环绕风刃的旋转角度
        this.lifeTime = 60 * 30; // [修改] 加倍子弹生命时间 (从15秒增加到30秒)
        this.chainHistory = [];
        this.trail = [];
        // [拖尾调优] 根据子弹强度（属性层数）和类型决定拖尾长度。
        // 用户反馈：拖尾过长且过实，需要更短更淡的视觉效果。
        const _tierStat = (config.damage || 0) + (config.bounce || 0) + (config.pierce || 0)
            + (config.scatter || 0) + (config.cryo || 0) + (config.pyro || 0)
            + (config.lightning || 0) + (config.laser || 0)
            + (config.flying_sword || 0) + (config.wind || 0);
        let _trailMax = 4 + Math.min(14, Math.floor(_tierStat * 0.3));
        if (config.isLaser) _trailMax += 4;
        if (config.type === 'flying_sword') _trailMax += 3;
        if (config.pierce > 0) _trailMax += 2;
        if (config.explosive) _trailMax += 1;
        this.maxTrailLength = _trailMax;
        this.tierStat = _tierStat;
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
        if (this.trail.length > (this.maxTrailLength || 8)) this.trail.shift();
        for (const [enemy, timer] of this.hitCooldowns) {
            if (timer > 0) this.hitCooldowns.set(enemy, timer - timeScale);
            else this.hitCooldowns.delete(enemy);
        }
        this.lifeTime -= timeScale;
        if (this.lifeTime <= 0) { this.destroy(spawnCallback); return; }
        // [优化 1] 增加空气阻力，防止无限加速导致的隧穿 (可选，这里设为 1.0 表示无阻力)
        this.vel = this.vel.mult(1.0);

        // [V2 gravityWell] 引力炉心：对附近的子弹施加微弱回拉，造成可预测的弹道偏折
        // 仅对带速度的常规子弹生效；激光/风刀等无 vel 主体不在此处理。
        if (this.vel && this.vel.mag() > 0.1) {
            const cfgAfx = (typeof CONFIG !== 'undefined' && CONFIG.balance) ? CONFIG.balance.affixes : null;
            if (cfgAfx) {
                const pullR = cfgAfx.gravityWellPullRadius || 220;
                const pullS = cfgAfx.gravityWellPullStrength || 0.18;
                for (const e of enemies) {
                    if (!e || !e.active || !e.affixes || !e.affixes.includes('gravityWell')) continue;
                    const dx = e.pos.x - this.pos.x;
                    const dy = e.pos.y - this.pos.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 1 && dist < pullR) {
                        const falloff = 1 - dist / pullR;
                        const accel = pullS * falloff * timeScale;
                        this.vel.x += (dx / dist) * accel;
                        this.vel.y += (dy / dist) * accel;
                    }
                }
            }
        }

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
                // 委托给 _handleCollision 处理单个敌人的碰撞逻辑
                const result = this._handleCollision(e, enemies, spawnCallback);
                if (result === 'destroyed') return;
            }
        }
        // 委托给 _spawnEffect 处理爆炸粒子特效
        this._spawnEffect();
    }

    /**
     * 处理与单个敌人的碰撞检测与响应（Circle vs AABB）
     * @param {Enemy} e - 目标敌人
     * @param {Enemy[]} enemies - 所有敌人列表（用于 onHit）
     * @param {Function} spawnCallback - 子弹销毁时的回调
     * @returns {'destroyed'|undefined} 若子弹被销毁则返回 'destroyed'
     */
    _handleCollision(e, enemies, spawnCallback) {
        let hitResult = null;
        const hitRadius = this.radius + 2;

        // 多态碰撞检测：根据敌人的 collisionShape 进行不同的检测
        if (e.collisionShape === 'polygon' && e.collisionData) {
            // 获取绝对坐标顶点（修复 Boss 移动后碰撞框不跟随的问题）
            const absoluteVertices = e.getAbsoluteVertices();
            hitResult = calc_getCirclePolygonCollision(this.pos, this.radius, absoluteVertices);
            if (hitResult) {
                hitResult.distVecX = this.pos.x - hitResult.closestX;
                hitResult.distVecY = this.pos.y - hitResult.closestY;
            }
        } else if (e.collisionShape === 'arc' && e.collisionData) {
            hitResult = calc_getCircleArcCollision(
                this.pos, this.radius, 
                e.pos, e.collisionData.radius, 
                e.collisionData.startAngle, e.collisionData.endAngle, 
                e.collisionData.thickness
            );
            if (hitResult) {
                hitResult.distVecX = this.pos.x - hitResult.closestX;
                hitResult.distVecY = this.pos.y - hitResult.closestY;
            }

            // ─────────────────────────────────────────────────────────────────────
            // [Devourer 吞噬逻辑] DEVOURING 状态：子弹进入缺口区域时直接消失
            // 条件：没有碰撞（hitResult=null）+ Devourer处于 DEVOURING 状态
            //       + 子弹到 Devourer 中心的距离在圆弧半径范围内（进入缺口）
            // ─────────────────────────────────────────────────────────────────────
            if (!hitResult && e.bossType === 'devourer' && e.devourState === 'DEVOURING') {
                const dx = this.pos.x - e.pos.x;
                const dy = this.pos.y - e.pos.y;
                const distToCenter = Math.sqrt(dx * dx + dy * dy);
                const halfThick = e.collisionData.thickness / 2;
                const innerRadius = e.collisionData.radius - halfThick - this.radius;
                const outerRadius = e.collisionData.radius + halfThick + this.radius;

                if (distToCenter >= innerRadius && distToCenter <= outerRadius) {
                    // 子弹进入缺口区域，触发吞噬效果
                    this.active = false;
                    if (typeof game !== 'undefined') {
                        // 吞噬特效：紫色冲击波 + 粒子散射
                        game.spawn_createShockwave(this.pos.x, this.pos.y, '#a855f7');
                        for (let i = 0; i < 6; i++) {
                            game.spawn_createParticle(
                                this.pos.x + (Math.random() - 0.5) * 20,
                                this.pos.y + (Math.random() - 0.5) * 20,
                                '#c084fc', 'mist'
                            );
                        }
                        game.spawn_createFloatingText(
                            this.pos.x, this.pos.y - 20,
                            'DEVOURED', '#a855f7'
                        );
                    }
                    return; // 子弹被吞噬，不造成伤害
                }
            }
        } else {
            // 默认 AABB 碰撞检测
            const halfW = e.width / 2;
            const halfH = e.height / 2;
            const closestX = Math.max(e.pos.x - halfW, Math.min(this.pos.x, e.pos.x + halfW));
            const closestY = Math.max(e.pos.y - halfH, Math.min(this.pos.y, e.pos.y + halfH));
            const distVecX = this.pos.x - closestX;
            const distVecY = this.pos.y - closestY;
            const distSq = distVecX * distVecX + distVecY * distVecY;
            
            if (distSq < hitRadius * hitRadius) {
                hitResult = { closestX, closestY, distSq, distVecX, distVecY };
            }
        }

        if (hitResult) {
            const { closestX, closestY, distSq, distVecX, distVecY, normal: shapeNormal } = hitResult;
            if (this.hitCooldowns.has(e)) return;
            this.hitCooldowns.set(e, CONFIG.gameplay.hitCooldowns);
            this.lastHitEnemy = e;
            this.onHit(e, enemies);

            // [词条 Hook] 回响射击 (echo_shot)
            // 首次命中时，有概率触发回响射击，按原角度额外发射一颗子弹
            if (!this._echoShotFired && this.config._echoShotChance && Math.random() < this.config._echoShotChance) {
                this._echoShotFired = true; // 标记已触发，防止重复触发
                if (typeof game !== 'undefined' && game.burstQueue) {
                    // 创建新的配方，继承原配方，但清空分裂属性并标记已回响
                    // [修复] 明确清除 _echoShotChance，防止潜在的无限循环（防御性编程）
                    const echoRecipe = {
                        ...this.config,
                        multicast: 0,
                        scatter: 0,
                        bounce: 0,
                        _echoShotFired: true,   // 传递标记给新子弹
                        _echoShotChance: 0      // 明确清除触发概率，防止无限循环
                    };
                    
                    // 速度方向：当前速度方向
                    const speed = this.vel.mag();
                    const dir = speed > 0 ? this.vel.mult(1 / speed) : new Vec2(0, 1);
                    const newVel = dir.mult(speed > 0 ? speed : 10);
                    
                    // 推入 burstQueue
                    game.burstQueue.push({
                        delay: 0,
                        vel: newVel,
                        recipe: echoRecipe,
                        shotId: this.shotId,
                        isLast: false
                    });
                    
                    // 视觉反馈
                    if (game.spawn_createFloatingText) {
                        game.spawn_createFloatingText(this.pos.x, this.pos.y - 20, 'ECHO!', '#facc15');
                    }
                }
            }

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
                // [新属性] 超载：穿透命中敌人 +3 充能
                if (this.overcharge > 0) {
                    this._chargeCount += 3;
                }
                return;
            }
            if (this.bouncesLeft > 0) {
                this.bouncesLeft--;

                // [新属性] 超载：弹跳（敌人）+1 充能
                if (this.overcharge > 0) {
                    this._chargeCount += 1;
                }

                // [新属性] 回响：弹跳点按概率生成回响子弹（向反方向镜像）
                if (this.echo > 0 && !this._isEchoChild && typeof game !== 'undefined') {
                    this._tryTriggerEchoBullet();
                }

                // ─────────────────────────────────────────────────────────────────────
                // [词条 Hook] 动能激增（kinetic_surge）
                // 效果：每次弹跳后，子弹伤害增加 damagePerBounce
                // 实现：直接修改 this.config.damage，后续命中将使用新伤害值
                // ─────────────────────────────────────────────────────────────────────
                if (typeof game !== 'undefined' && game.activeRunewordEffects) {
                    const kineticEffect = game.activeRunewordEffects['kinetic_surge'];
                    if (kineticEffect) {
                        // 参数字段：flatDamage（每次弹跳固定增加的伤害值）
                        const flatDamage = kineticEffect.params.flatDamage || 0;
                        if (flatDamage > 0) {
                            this.config.damage += flatDamage;
                        }
                    }
                }

                // ─────────────────────────────────────────────────────────────────────
                // [词条 Hook] 冰霜新星（frost_nova）
                // 效果：每经过 bounceInterval 次弹跳，触发一次冰霜新星（范围冰冻）
                // 加强：被新星命中的敌人按其当前冻结概率额外触发一次新星，链式触发概率每次减半。
                // 链式逻辑由 combat_triggerFrostNova 实现，确保与首次触发表现一致。
                // ─────────────────────────────────────────────────────────────────────
                if (typeof game !== 'undefined' && game.activeRunewordEffects) {
                    const frostNovaEffect = game.activeRunewordEffects['frost_nova'];
                    if (frostNovaEffect) {
                        if (!this._frostNovaBounceCount) this._frostNovaBounceCount = 0;
                        this._frostNovaBounceCount++;
                        const requiredBounces = Math.max(1, Math.floor(frostNovaEffect.params.requiredBounces || 5));
                        if (this._frostNovaBounceCount % requiredBounces === 0
                            && typeof game.combat_triggerFrostNova === 'function') {
                            game.combat_triggerFrostNova(
                                new Vec2(this.pos.x, this.pos.y),
                                this.config,
                                frostNovaEffect.params || {},
                                1.0,
                                0
                            );
                        }
                    }
                }

                // 风属性锤点逻辑
                if (this.config.wind && this.isLast && typeof game !== 'undefined') {
                    game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage);
                }

                // [核心修复] 基于最近点的精确物理反弹
                const dist = Math.sqrt(distSq);
                let normal;

                if (shapeNormal) {
                    // 1. 如果碰撞检测已经提供了法线（如 Polygon, Arc），优先使用
                    normal = shapeNormal;
                } else if (dist === 0) {
                    // 2. 特殊情况：圆心在矩形内部 (Deep Penetration) 且为 AABB
                    const halfW = e.width / 2;
                    const halfH = e.height / 2;
                    const dx = this.pos.x - e.pos.x;
                    const dy = this.pos.y - e.pos.y;
                    const overlapX = halfW - Math.abs(dx);
                    const overlapY = halfH - Math.abs(dy);

                    if (overlapX < overlapY) {
                        normal = new Vec2(Math.sign(dx) || 1, 0);
                    } else {
                        normal = new Vec2(0, Math.sign(dy) || 1);
                    }
                } else {
                    // 3. 正常情况：法线就是 "最近点 -> 圆心" 的单位向量
                    normal = new Vec2(distVecX / dist, distVecY / dist);
                }

                // 位置修正 (Push Out)：将子弹推离敌人表面
                const pushOutDist = this.radius + 0.1;
                this.pos.x = closestX + normal.x * pushOutDist;
                this.pos.y = closestY + normal.y * pushOutDist;

                // 速度反弹 (Reflection): v' = v - 2 * (v · n) * n
                const dot = this.vel.dot(normal);
                if (dot < 0) {
                    this.vel = this.vel.sub(normal.mult(2 * dot));
                }

                // 视觉挤压效果
                this.deformation = { x: 1.3, y: 0.7 };
            } else {
                this.destroy(spawnCallback);
                return 'destroyed';
            }
        }
    }

    /**
     * 生成子弹自身的粒子特效（如爆炸子弹的火花）
     */
    _spawnEffect() {
        if (this.config.explosive) {
            if (Math.random() < 0.7) {
                const spark = new Particle(this.pos.x, this.pos.y, '#fbbf24', 'spark');
                spark.vel = this.vel.mult(-0.2).add(new Vec2((Math.random()-0.5)*2, (Math.random()-0.5)*2));
                // [限制] 爆炸火花受全局粒子上限约束
                game.spawn_pushParticleWithLimit(spark);
            }
        }
    }

    _applyMove(vel, width, height, spawnCallback) {
        this.pos = this.pos.add(vel);

        // [优化] 在 Demo 模式下强制开启底墙
        const hasBottomWall = (this.game && this.game.isDemo) ? true : game.hasCombatWall;

        // [新属性] 超载/回响 墙壁碰撞钩子
        const _onWallBounce = () => {
            if (this.overcharge > 0) this._chargeCount += 1;
            if (this.echo > 0 && !this._isEchoChild && typeof this._tryTriggerEchoBullet === 'function') {
                this._tryTriggerEchoBullet();
            }
        };

        // --- [v2 即时感重塑] 遗物墙壁联动统一处理函数 ---
        // 1. 回廊电弧 (corridor_arc)：撞击左/右墙壁时 +1 层闪电属性（写入 this.config.lightning）
        // 2. 力场护盾诅咒 (energy_shield)：所有墙壁都消耗 1 次反弹或穿透；耗尽则销毁子弹
        // 返回 true 表示子弹被销毁（调用方应直接 return）
        const handleRelicWallHit = (side) => {
            const g = (typeof game !== 'undefined') ? game : null;
            if (!g || !g.ownedRelics) return false;
            if ((side === 'left' || side === 'right') && g.ownedRelics.includes('corridor_arc')) {
                this.config.lightning = (this.config.lightning || 0) + 1;
            }
            if (g.ownedRelics.includes('energy_shield')) {
                if ((this.bouncesLeft || 0) > 0) {
                    this.bouncesLeft--;
                } else if ((this.piercesLeft || 0) > 0) {
                    this.piercesLeft--;
                } else {
                    this.destroy(spawnCallback);
                    return true;
                }
            }
            return false;
        };

        if (this.pos.x < this.radius) {
            this.pos.x = this.radius; this.vel.x = Math.abs(this.vel.x);
            _onWallBounce();
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);
            const angle = Math.abs(Math.atan2(this.vel.x, this.vel.y));
            if (angle < (10 * Math.PI / 180)) {
                const speed = this.vel.mag();
                const newAngle = angle + (1 * Math.PI / 180);
                this.vel.x = speed * Math.sin(newAngle);
                this.vel.y = speed * Math.cos(newAngle) * (this.vel.y > 0 ? 1 : -1);
            }
            if(this.config.bounce > 0) this.deformation = { x: 0.7, y: 1.3 };
            // [打击感] 反弹左墙壁：低频大幅震动 (已降低 40%)
            if (typeof game !== 'undefined' && game.triggerScreenShake) {
                const wallShake = (2 + Math.min(1, this.config.damage / 20) * 5) * 0.6; // 1.2~4.2px
                game.triggerScreenShake(wallShake);
            }
            this.hitCooldowns.clear();
            if (handleRelicWallHit('left')) return;
        }
        if (this.pos.x > width - this.radius) {
            this.pos.x = width - this.radius; this.vel.x = -Math.abs(this.vel.x);
            _onWallBounce();
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);
            const angle = Math.abs(Math.atan2(this.vel.x, this.vel.y));
            if (angle < (10 * Math.PI / 180)) {
                const speed = this.vel.mag();
                const newAngle = angle + (1 * Math.PI / 180);
                this.vel.x = -speed * Math.sin(newAngle);
                this.vel.y = speed * Math.cos(newAngle) * (this.vel.y > 0 ? 1 : -1);
            }
            if(this.config.bounce > 0) this.deformation = { x: 0.7, y: 1.3 };
            // [打击感] 反弹右墙壁：低频大幅震动 (已降低 40%)
            if (typeof game !== 'undefined' && game.triggerScreenShake) {
                const wallShake = (2 + Math.min(1, this.config.damage / 20) * 5) * 0.6; // 1.2~4.2px
                game.triggerScreenShake(wallShake);
            }
            this.hitCooldowns.clear();
            if (handleRelicWallHit('right')) return;
        }
        // [修复] 顶部边界使用 combatGridTopY 计算真实反弹墙位置，与绘制位置保持一致
        // 绘制层：wallTopY = combatGridTopY - enemyHeight/2（见 game_phase.js）
        // 若 game 未就绪则回退到 y=0（this.radius）
        const topBound = (typeof game !== 'undefined' && game.combatGridTopY != null && game.enemyHeight != null)
            ? (game.combatGridTopY - game.enemyHeight / 2 + this.radius)
            : this.radius;
        if (this.pos.y < topBound) {
            this.pos.y = topBound; this.vel.y = Math.abs(this.vel.y);
            _onWallBounce();
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);
            if(this.config.bounce > 0) this.deformation = { x: 1.3, y: 0.7 };
            // [打击感] 反弹顶墙壁：低频大幅震动 (已降低 40%)
            if (typeof game !== 'undefined' && game.triggerScreenShake) {
                const wallShake = (2 + Math.min(1, this.config.damage / 20) * 5) * 0.6; // 1.2~4.2px
                game.triggerScreenShake(wallShake);
            }
            if (handleRelicWallHit('top')) return;
        }
        if (this.pos.y > height - this.radius) {
            if (hasBottomWall) {
                this.pos.y = height - this.radius; this.vel.y = -Math.abs(this.vel.y);
                _onWallBounce();
                if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y, this.config.damage, this.config);

                // [修复] 底部护盾反弹不消耗反弹次数（旧逻辑）；
                // [v2 力场护盾诅咒] 现在所有墙壁都会消耗 bounce/pierce，由 handleRelicWallHit 统一处理
                if(this.config.bounce > 0) this.deformation = { x: 1.3, y: 0.7 };
                // [打击感] 反弹底墙壁：低频大幅震动 (已降低 40%)
                if (typeof game !== 'undefined' && game.triggerScreenShake) {
                    const wallShake = (2 + Math.min(1, this.config.damage / 20) * 5) * 0.6; // 1.2~4.2px
                    game.triggerScreenShake(wallShake);
                }
                this.hitCooldowns.clear();
                if (handleRelicWallHit('bottom')) return;
            } else {
                this.destroy(spawnCallback);
            }
        }
    }

    onHit(enemy, allEnemies) {
        // ─────────────────────────────────────────────────────────────────────
        // [词条 Hook] 元素聚变（elemental_fusion）——火/冰状态标记
        // 在伤害结算前，标记该敌人本回合被火/冰属性命中
        // 雷状态标记在 damage_calc.js 的 combat_lightning_triggerChain 中设置
        // ─────────────────────────────────────────────────────────────────────
        if (this.config.pyro > 0) {
            enemy._pyroHitThisRound = true;
        }
        if (this.config.cryo > 0) {
            enemy._cryoHitThisRound = true;
        }
        // [技能系统迭代] 棱光炮技能的 _forceFusion 标记传递到敌人
        if (this.config._forceFusion) {
            enemy._forceFusionThisRound = true;
        }

        // ─────────────────────────────────────────────────────────────────────
        // [词条 Hook] 绝对零度（absolute_zero）
        // 效果：敌人处于冰冻状态时，每次受到物理伤害，令该敌人本回合受到的所有伤害加深
        // 实现：在 combat_damageEnemy 之前计算伤害加深系数，通过 damageOverride 传入
        // ─────────────────────────────────────────────────────────────────────
        let damageOverride = null;
        
        // 计算基础伤害（包含 isCopy 平衡）
        let baseDmg = this.isCopy ? this.config.damage * 0.5 : this.config.damage;
        
        // [词条 Hook] 动能衰变 (kinetic_decay)
        // 伤害值乘以 (1 + _kineticDecayCurrentBonus)，然后按乘法衰减
        // 衰减公式: bonus *= (1 - decayRate)，确保加成平滑递减而非线性递减
        if (this._kineticDecayCurrentBonus > 0) {
            baseDmg = baseDmg * (1 + this._kineticDecayCurrentBonus);
            this._kineticDecayCurrentBonus *= (1 - (this.config._kineticDecayRate || 0));
            if (this._kineticDecayCurrentBonus < 0) this._kineticDecayCurrentBonus = 0;
            damageOverride = baseDmg;
        }

        if (typeof game !== 'undefined' && game.combat_runeword_absoluteZero_calcAmp) {
            const amp = game.combat_runeword_absoluteZero_calcAmp(enemy);
            if (amp > 0) {
                damageOverride = baseDmg * (1 + amp);
            }
        }

        game.combat_damageEnemy(enemy, this, damageOverride);
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
            // [限制] SlashEffect 受全局粒子上限约束
            game.spawn_pushParticleWithLimit(new SlashEffect(center.x, center.y, angle, length, slashColor));
            audio.playSlash();
        }

        // [平衡] 三级子飞剑的剑痕仅对非主目标触发 20% 的伤害与属性效果
        const swordLevel = (this.config.level || 1);
        const isLevel3 = swordLevel >= 3;
        const markRatio = 0.20;

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
                const isMark = (other !== target);
                const ratio = (isLevel3 && isMark) ? markRatio : 1.0;
                const slashConfig = {
                    ...this.config,
                    damage: Math.max(1, Math.ceil(this.config.damage * fsCfg.dashDamageMult * ratio)),
                    pyro: Math.floor((this.config.pyro || 0) * ratio),
                    cryo: Math.floor((this.config.cryo || 0) * ratio),
                    lightning: Math.floor((this.config.lightning || 0) * ratio)
                };
                game.combat_damageEnemy(other, {
                    config: slashConfig,
                    pos: closest,
                    isCopy: true
                });
                if (isMark) {
                    other.addSwordMark(1);
                }
            }
        });
    }
    
    /**
     * [新属性] 回响：以镜像反方向生成一颗 echo 子弹（继承 50% 属性，向下取整）。
     * 仅在非 echo 子弹上触发；带 _isEchoChild 标记防止链式无限。
     * 二阶共鸣 allowOneRelay 时，echo 子弹也能再触发一次（通过 _echoRelayUsed 控制）。
     */
    _tryTriggerEchoBullet() {
        if (typeof game === 'undefined') return;
        const echoLevel = this.echo || 0;
        if (echoLevel <= 0) return;

        const echoRes = game.activeElementResonances && game.activeElementResonances['echo'];
        const echoResParams = echoRes ? echoRes.params : null;
        const baseChance = (CONFIG.balance && CONFIG.balance.echo && CONFIG.balance.echo.baseTriggerChance) || 0.25;
        const chancePerLevel = (CONFIG.balance && CONFIG.balance.echo && CONFIG.balance.echo.chancePerLevel) || 0.05;
        const triggerBonus = echoResParams ? (echoResParams.triggerChanceBonus || 0) : 0;
        const inheritRatio = echoResParams ? (echoResParams.inheritRatio || 0.5) : 0.5;
        const triggerChance = Math.min(1.0, baseChance + echoLevel * chancePerLevel + triggerBonus);

        if (Math.random() >= triggerChance) return;

        // 镜像方向（反方向）
        const mirrorVel = new Vec2(-this.vel.x, -this.vel.y);
        const _floor = (v) => Math.floor((v || 0) * inheritRatio);
        const echoRecipe = {
            ...this.config,
            damage: Math.max(1, _floor(this.config.damage)),
            cryo: _floor(this.config.cryo),
            pyro: _floor(this.config.pyro),
            lightning: _floor(this.config.lightning),
            bounce: _floor(this.config.bounce),
            pierce: _floor(this.config.pierce),
            scatter: _floor(this.config.scatter),
            laser: _floor(this.config.laser),
            venom: _floor(this.config.venom),
            overcharge: _floor(this.config.overcharge),
            echo: _floor(this.config.echo),
            _isEchoChild: true,
            // 防止再触发 echo_shot 词条无限循环
            _echoShotChance: 0,
        };
        if (game.burstQueue) {
            game.burstQueue.push({
                delay: 0,
                vel: mirrorVel,
                recipe: echoRecipe,
                shotId: this.shotId,
                isLast: false,
            });
        }
        if (game.spawn_createFloatingText) {
            game.spawn_createFloatingText(this.pos.x, this.pos.y - 16, '🔁ECHO', '#a78bfa');
        }
    }

    /**
     * [新属性] 超载：子弹销毁时结算一次 AoE 爆炸。
     * explosionDmg = chargeCount × overcharge × baseDmg × baseChargeMult × scatterInheritRatio × explosionMultiplier
     * AoE 半径 = aoeBaseRadius + chargeCount × aoeRadiusPerCharge
     */
    _detonateOvercharge() {
        if (typeof game === 'undefined') return;
        if (this.overcharge <= 0 || this._chargeCount <= 0) return;
        const ocRes = game.activeElementResonances && game.activeElementResonances['overcharge'];
        const ocResParams = ocRes ? ocRes.params : null;
        const explosionMultiplier = ocResParams ? (ocResParams.explosionMultiplier || 1.0) : 1.0;
        const aoeBonus = ocResParams ? (ocResParams.aoeBonus || false) : false;

        const ocCfg = (CONFIG.mechanics && CONFIG.mechanics.overcharge) || {};
        const baseChargeMult = ocCfg.baseChargeMult || 0.3;
        const aoeBaseRadius = ocCfg.aoeBaseRadius || 60;
        const aoeRadiusPerCharge = ocCfg.aoeRadiusPerCharge || 4;

        const baseDmg = this.config.damage || 1;
        const inherit = this._scatterInheritRatio || 1.0;
        let dmg = this._chargeCount * this.overcharge * baseDmg * baseChargeMult * inherit * explosionMultiplier;
        let radius = aoeBaseRadius + this._chargeCount * aoeRadiusPerCharge;
        if (aoeBonus) radius *= 1.4;
        dmg = Math.max(1, Math.ceil(dmg));

        const enemies = game.enemies || [];
        enemies.forEach(en => {
            if (!en.active) return;
            const dx = en.pos.x - this.pos.x;
            const dy = en.pos.y - this.pos.y;
            if (dx * dx + dy * dy <= radius * radius) {
                const r = en.takeDamage(dmg);
                if (typeof game.combat_recordDamage === 'function') {
                    game.combat_recordDamage(r.actualDamage, 'pyro', 'main', this.shotId);
                }
                if (r.killed && typeof game.spawn_addScore === 'function') game.spawn_addScore(en.maxHp);
            }
        });
        if (typeof game.spawn_createShockwave === 'function') {
            game.spawn_createShockwave(this.pos.x, this.pos.y, '#ef4444');
        }
        if (typeof game.spawn_createExplosion === 'function') {
            game.spawn_createExplosion(this.pos.x, this.pos.y, '#fbbf24');
        }
        if (typeof game.spawn_createFloatingText === 'function') {
            game.spawn_createFloatingText(this.pos.x, this.pos.y - 24, `💥${dmg}`, '#fbbf24');
        }
    }

    destroy(spawnCallback) {
        // [新属性] 超载爆炸（在标记 destroyed 之前以便其它系统可读 chargeCount）
        try { this._detonateOvercharge(); } catch (e) { /* 防御性：销毁路径不应抛错 */ }

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
                        // [修复-targeting] 与 handleFlyingSwordFinish 行为一致：lv3 子剑脱离母剑独立猎杀，
                        // 否则保留对已 destroyed 母剑的引用会让自动猎杀阶段读取到不一致的 mother 状态。
                        s.isAutoHunting = true;
                        s.mother = null;
                        s.state = 'flying';
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
        // [拖尾 #6] 在主体之前先绘制拖尾，主体覆盖在最前
        this._drawTrail(ctx);
        Projectile.drawVisuals(ctx, this.pos.x, this.pos.y, this.radius, this.config, this.rotation, this.intensity, this.deformation, integrity, this.crackSeed, this.windBladeAngle);
    }

    // @perf-impact: 子弹拖尾 - 每子弹每帧 1 条 lineTo + 渐变描边；高强度子弹 trail 长度可达 ~30 个点。
    _drawTrail(ctx) {
        const trail = this.trail;
        if (!trail || trail.length < 2) return;
        const cfg = this.config || {};
        // 根据属性决定主拖尾色
        let trailColor = '#94a3b8';
        if (cfg.isLaser) trailColor = '#7dd3fc';
        else if (cfg.type === 'flying_sword') trailColor = '#0ea5e9';
        else if (cfg.type === 'rainbow') trailColor = '#e9d5ff';
        else if (cfg.explosive) trailColor = '#ef4444';
        else if ((cfg.pyro || 0) > 0) trailColor = '#f97316';
        else if ((cfg.cryo || 0) > 0) trailColor = '#22d3ee';
        else if ((cfg.lightning || 0) > 0) trailColor = '#c084fc';
        else if ((cfg.wind || 0) > 0) trailColor = '#34d399';
        else if ((cfg.pierce || 0) > 0) trailColor = '#fca5a5';
        else if ((cfg.bounce || 0) > 0) trailColor = '#86efac';
        else if ((cfg.scatter || 0) > 0) trailColor = '#facc15';

        const tier = Math.min(3, Math.floor((this.tierStat || 0) / 8));
        // [拖尾调优] 用户反馈：拖尾过粗过亮，整体降一档。
        // 基础宽度随子弹半径联动；高强度子弹仅小幅加宽
        const baseWidth = Math.max(1.0, this.radius * (0.35 + tier * 0.10));
        const len = trail.length;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // S 级（含激光/飞剑）使用 lighter 增亮拖尾
        if (tier >= 2 || cfg.isLaser || cfg.type === 'flying_sword' || cfg.explosive) {
            ctx.globalCompositeOperation = 'lighter';
        }
        ctx.shadowColor = trailColor;
        ctx.shadowBlur = _sb(2 + tier * 2);

        // 段落式渐变描边：越靠近当前位置越亮、越粗，整体透明度更低更轻盈
        for (let i = 1; i < len; i++) {
            const a = trail[i - 1];
            const b = trail[i];
            const t = i / (len - 1);
            const alpha = Math.max(0.02, t * (0.30 + tier * 0.08));
            const width = Math.max(0.4, baseWidth * t);
            ctx.strokeStyle = `${trailColor}`;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        // S 级追加一层更细更亮的核心拖尾
        if (tier >= 3 || cfg.isLaser) {
            ctx.shadowBlur = _sb(6);
            for (let i = Math.max(1, len - 5); i < len; i++) {
                const a = trail[i - 1];
                const b = trail[i];
                const t = i / (len - 1);
                ctx.strokeStyle = '#ffffff';
                ctx.globalAlpha = 0.35 * t;
                ctx.lineWidth = Math.max(0.6, baseWidth * 0.30 * t);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    static drawVisuals(ctx, x, y, radius, config, rotation, intensity, deformation = {x:1, y:1}, integrity = 1.0, crackSeed = [], windBladeAngle = 0) {
        // @section:draw_entry_transform - 坐标变换入口（translate + rotate），确定绘制坐标系
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        // [fix] 重构为 if-else 结构，确保每条执行路径只有一个顶层 restore
        if (config.type === 'flying_sword') {
            // @section:draw_flying_sword - 飞剑完整绘制：剑身/剑格/剑柄/剑首/剑穗（独立 restore+return）
            // 修正角度：假設畫筆是朝右(0度)畫的，如果原圖是朝上則需旋轉
            // 這裡我們直接畫朝右的劍，與 velocity 方向一致
            const scale = radius / 6; // 根據半徑動態調整大小 (基礎半徑約7~10)
            // 1. 劍身發光 (Spirit Aura) - 隨耐久度減弱
            ctx.shadowBlur = _sb(15 * intensity * integrity);
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
            ctx.shadowBlur = _sb(5);
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
            ctx.shadowBlur = _sb(5);
            ctx.strokeStyle = '#ef4444'; // 紅色
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore(); // [bugfix] flying_sword 分支必须自行 restore，否则跳过 else 块时状态栈泄漏，导致后续 sonSwords/特效跟随大宝剑坐标系渲染
            return; // flying_sword 分支结束，直接返回
        } else {
        
        // @section:draw_shape_and_color_resolve - 形状类型与颜色决策（shapeType / mainColor / glowColor）
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
        // @section:draw_orb_special - 光球(orb)特殊渲染：脉冲光晕 + 纯白核心（独立 restore）
        // ---  光球的特殊渲染逻辑 (绑定特效) ---
        if (shapeType === 'orb') {  // [fix] 此 if 在 else 块内，与 flying_sword 互斥
            const time = Date.now() / 200;
            const pulse = Math.sin(time) * 0.1 + 1.0; 
            const laserPower = config.laser || 0;
            const sizeMod = 1 + (laserPower * 0.1); 
            ctx.shadowBlur = _sb(20 * intensity * sizeMod);
            ctx.shadowColor = glowColor;
            ctx.fillStyle = glowColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.2 * pulse * sizeMod, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = _sb(10);
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.8 * sizeMod, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore(); // [bugfix] orb 分支必须自行 restore，否则 else 块被跳过时状态栈泄漏
        } else {
        // @section:draw_shape_fill - 形状绘制与填色：arrow/star/crystal/matryoshka/circle 分支 + 渐变/发光
        // 3. 绘制形状 (orb 的 else 分支，即正常绘制路径)
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
        ctx.shadowBlur = _sb(CONFIG.visuals.glowBase * intensity * integrity); 
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
        // @section:draw_damage_cracks - 耐久度低于 0.6 时绘制裂纹贝塞尔曲线
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
            ctx.shadowBlur = _sb(8 + config.lightning);
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
        // @section:draw_wind_blades - 风属性环绕风刃特效：弯月形风刃按轨道旋转
        // 风属性环绕风刃特效
        if (config.wind && config.wind > 0) {
            ctx.save();
            ctx.shadowBlur = _sb(10);
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
        } // [fix] 关闭 orb else 块
        } // [fix] 关闭 flying_sword else 块
    } // drawVisuals 函数结束
}

// ==================== 导出 ====================
export { Projectile };
