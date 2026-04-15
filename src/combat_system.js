import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave,
    IceWave, DeathExplosion, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba, RuneLoot
} from './entities.js';
import { loot_calcRuneDrop } from './loot_system.js';
import { calcRuneBaseStats } from './rune_system.js';
import { RUNE_DB } from './rune_config.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';
import { eventBus, EVENT_TYPES } from './event_bus.js';
import { DamageCalc } from './combat/damage_calc.js';
import { CollisionSystem } from './combat/collision.js';

// ─────────────────────────────────────────────────────────────────────────────
// 充能符文系统常量（§8.5）
// ─────────────────────────────────────────────────────────────────────────────
const RUNE_CHARGE_THRESHOLDS = [999, 999, 6.1, 5.1, 2.6, 2.15, 0.9, 0.4];
const RUNE_CHARGE_DECAY      = 1.26 / 3;   // ≈ 0.42
const RUNE_CHARGE_MAX_LEVEL  = 3;

/**
 * 充能符文抽取算法（§8.5）
 * 按权重上限门槛筛选入池符文，加权随机抽取符文定义和等级。
 * @param {number} chargeLevel - 当前充能等级（充能条已满次数）
 * @returns {{ runeDef: object|null, runeLevel: number }}
 */
function _runeCharge_draw(chargeLevel) {
    const threshold = RUNE_CHARGE_THRESHOLDS[Math.min(chargeLevel, 7)];
    const maxRuneLv = Math.min(chargeLevel, RUNE_CHARGE_MAX_LEVEL);
    const pool = [];
    for (const rune of RUNE_DB) {
        for (let lv = 1; lv <= maxRuneLv; lv++) {
            const w = rune.baseDropWeight * Math.pow(RUNE_CHARGE_DECAY, lv - 1);
            if (w < threshold) pool.push({ runeDef: rune, runeLevel: lv, weight: w });
        }
    }
    if (!pool.length) return { runeDef: null, runeLevel: 1 };
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let rand = Math.random() * total;
    for (const c of pool) {
        rand -= c.weight;
        if (rand <= 0) return { runeDef: c.runeDef, runeLevel: c.runeLevel };
    }
    const last = pool[pool.length - 1];
    return { runeDef: last.runeDef, runeLevel: last.runeLevel };
}

export const combat_system = {
// [已迁移至 src/combat/damage_calc.js] combat_calculatePlayerExpectedDamage
    // DDA 核心算法 —— 通过文件底部的 Object.assign(combat_system, DamageCalc) 注入

// [已迁移至 src/combat/damage_calc.js] combat_reportDamage
    // 汇报伤害 —— 通过文件底部的 Object.assign(combat_system, DamageCalc) 注入

/**
     * @method combat_createFloatingText
     * @description 兼容旧代码的浮动文字方法
     */
    combat_createFloatingText(x, y, text, color) {
        this.spawn_createFloatingText(x, y, text, color);
    },

// --- [新增] 更新連射倍率 UI ---
    /**
     * @param {any} bonusAmount - TODO: Describe this parameter.
     */
    combat_updateMulticastDisplay(bonusAmount = 0) {
        // 基礎是 1，加上當前累積的 multicast
        const total = 1 + (this.currentSession ? this.currentSession.multicast : 0);
        // [Task 3.2] 改为 EventBus 事件，由 hud.js 监听并更新 DOM
        eventBus.emit(EVENT_TYPES.UI_MULTICAST_UPDATE, { total, bonusAmount });
    },

// --- [新增] 播放倍率轉移飛行特效 ---
    /**
     * @param {any} multicastValue - TODO: Describe this parameter.
     */
    combat_playMulticastTransferEffect(multicastValue) {
        // [Task 3.2] 改为 EventBus 事件，由 hud.js 监听并执行飞行特效 DOM 操作
        eventBus.emit(EVENT_TYPES.UI_MULTICAST_TRANSFER, {
            multicastValue,
            activeMarbleIndex: this.activeMarbleIndex
        });
    },
// 在 Game 类中
    /**
     * @param {any} skill - TODO: Describe this parameter.
     */
    combat_activateSkill(skill) {
        if (this.phase !== 'combat' || this.isEnemyTurn || this.skillPoints < skill.cost) return;

        // 1. 扣除消耗
        this.skillPoints -= skill.cost;
        this.ui.updateSkillPoints(this.skillPoints);
        this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
        
        audio.playPowerup(5); 
        showToast(`釋放: ${skill.name}!`);

        const p = skill.params;
        
        // [核心修改] 使用 methodId 进行逻辑分发
        const method = skill.methodId;

        if (method === 'repulsion') {
            // ... (重力反转逻辑保持不变) ...
            const pushDistance = this.enemyHeight * p.pushRows;
            let pushedCount = 0;
            this.enemies.forEach(e => {
                if (e.active) {
                    e.dropTargetY = Math.max(80, e.dropTargetY - pushDistance); 
                    e.pos.y = e.dropTargetY; 
                    e.bumpOffsetY = p.visualShake;
                    pushedCount++;
                    this.spawn_createParticle(e.pos.x, e.pos.y + e.height/2, p.particleColor, 'mist');
                }
            });
            this.spawn_createShockwave(this.width/2, this.height/2, p.shockwaveColor);
            if(pushedCount > 0) audio.playEffect('split');
            // [重构] 将直接 DOM 操作提取到 ui_system.js 的 ui_triggerScreenShake 方法
            this.ui_triggerScreenShake(200);
        } 
        else if (method === 'chain_lightning_all') {
            // === [新增] 全屏闪电链逻辑 ===
            const dmg = p.baseDmg + (this.round * p.roundMult);
            
            // [Task 3.2] 视觉：全屏微闪 - 改为 EventBus 事件，由 ui_system.js 监听
            eventBus.emit(EVENT_TYPES.UI_FLASH_EFFECT, { color: p.flashColor, duration: 200 });
            // [重构] 将直接 DOM 操作提取到 ui_system.js 的 ui_triggerScreenShake 方法
            this.ui_triggerScreenShake(200);
            // 倒序遍历（防止数组变动影响）
            // 策略：对每个敌人从天降下一道闪电，并以此为起点尝试触发连锁
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (e.active) {
                    // 1. 视觉：天雷 (从屏幕顶端打到敌人头顶)
                    const startX = e.pos.x + (Math.random() - 0.5) * 50;
                    this.lightningBolts.push(new LightningBolt(startX, 0, e.pos.x, e.pos.y));
                    
                    // 2. 造成主伤害
                    const killed = e.takeDamage(dmg);
                    this.combat_recordDamage(dmg, 'lightning', 'main', this._currentDamageShotId);
                    this.spawn_createFloatingText(e.pos.x, e.pos.y, `-${dmg}`, '#c084fc');
                    
                    // 3. 施加感电效果 (温度)
                    e.applyTemp(CONFIG.balance.lightningTempIncrease || 3); 

                    // 4. [关键] 触发连锁
                    // 我们调用已有的 triggerLightningChain，把当前敌人 e 作为源头
                    // 传递 [e] 作为历史记录，防止闪电瞬间弹回给自己
                    // 使用 p.chainLevel (如果配置了) 或者默认 15 级
                    const skillChainLevel = p.chainLevel || 15; 
                    this.combat_lightning_triggerChain(e, dmg, [e], skillChainLevel);

                    if (killed) this.spawn_addScore(e.maxHp);
                }
            }
            audio.playLightning();

        } 
        else if (method === 'enhance_ammo') {
            // === [修改] 强化弹药逻辑（支持光属性和散射） ===
            if (this.ammoQueue.length > 0) {
                const nextAmmo = this.ammoQueue[0];
                
                // 1. 遍历并应用 buffs (包含 scatter)
                for (const [key, val] of Object.entries(p.buffs)) {
                    // 如果是 damage, scatter, bounce 等数局属性，直接累加
                    if (typeof nextAmmo[key] === 'number' || nextAmmo[key] === undefined) {
                        nextAmmo[key] = (nextAmmo[key] || 0) + val;
                    }
                }

                // 2. 处理 [光属性] 开关
                if (p.forceLaser) {
                    // 激活激光逻辑标志
                    nextAmmo.isLaser = true; 
                    // 确保激光层数至少为 1 (如果 buffs 里没配 laser)
                    if (!nextAmmo.laser || nextAmmo.laser <= 0) {
                        nextAmmo.laser = 1;
                    }
                }

                // 3. 处理 [爆破属性] 开关
                if (p.forceExplosive) nextAmmo.explosive = true;
                
                // 4. 视觉反馈
                this.spawn_createExplosion(this.width/2, this.height - 80, p.explosionColor);
                this.ui_updateAmmoUI(); 
                this.spawn_createFloatingText(this.width/2, this.height - 120, p.floatText, p.explosionColor);
            } else {
                // 返还 SP
                this.skillPoints += skill.cost;
                this.ui.updateSkillPoints(this.skillPoints);
                this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
                showToast("無彈藥可強化");
            }
        }

        // ==================== [技能系统迭代] 新技能方法分发 ====================

        else if (method === 'skill_frost_prison') {
            // 冰牢封印：冻结所有敢人 + 冻结期伤害加成
            const freezeFrames = Math.round(p.freezeDuration * 60); // 秒 -> 帧
            eventBus.emit(EVENT_TYPES.UI_FLASH_EFFECT, { color: p.flashColor, duration: 300 });
            this.ui_triggerScreenShake(150);
            let frozenCount = 0;
            this.enemies.forEach(e => {
                if (e.active) {
                    // 利用现有温度机制：将温度拉满至冰结阈值 -100
                    e.temp = -100;
                    // 设置冻结计时（复用 frozenTurns 字段，单位为帧）
                    e.frozenTurns = Math.max(e.frozenTurns || 0, freezeFrames);
                    // 标记冻结期伤害加成
                    e._frostPrisonAmp = p.damageAmpBonus;
                    frozenCount++;
                    this.spawn_createParticle(e.pos.x, e.pos.y, p.particleColor, 'mist');
                    this.spawn_createFloatingText(e.pos.x, e.pos.y - 20, '❄️冻结!', '#67e8f9');
                }
            });
            if (frozenCount > 0) {
                try { audio.playEffect('cryo'); } catch(e2) {}
            }
        }

        else if (method === 'skill_thunder_call') {
            // 雷神降临：对所有敢人各落一道天雷 + 感电
            const dmg = p.baseDmg + (this.round * p.roundMult);
            eventBus.emit(EVENT_TYPES.UI_FLASH_EFFECT, { color: p.flashColor, duration: 200 });
            this.ui_triggerScreenShake(200);
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (e.active) {
                    const startX = e.pos.x + (Math.random() - 0.5) * 50;
                    this.lightningBolts.push(new LightningBolt(startX, 0, e.pos.x, e.pos.y));
                    const killed = e.takeDamage(dmg);
                    this.combat_recordDamage(dmg, 'lightning', 'main', this._currentDamageShotId);
                    this.spawn_createFloatingText(e.pos.x, e.pos.y, `-${dmg}`, p.boltColor);
                    e.applyTemp(CONFIG.balance.lightningTempIncrease || 3);
                    const skillChainLevel = p.chainLevel || 10;
                    this.combat_lightning_triggerChain(e, dmg, [e], skillChainLevel);
                    if (killed) this.spawn_addScore(e.maxHp);
                }
            }
            try { audio.playLightning(); } catch(e2) {}
        }

        else if (method === 'skill_kinetic_burst') {
            // 动能爆发：下一发弹珠弹跳次数上限 + 每次弹跳额外伤害
            if (this.ammoQueue.length > 0) {
                const nextAmmo = this.ammoQueue[0];
                nextAmmo.bounce = (nextAmmo.bounce || 0) + p.bounceBonus;
                // 将每次弹跳额外伤害存入弹珠定义，供 projectile.js 读取
                nextAmmo._kineticBurstDmg = (nextAmmo._kineticBurstDmg || 0) + p.flatDamagePerBounce;
                this.spawn_createExplosion(this.width/2, this.height - 80, p.particleColor);
                this.ui_updateAmmoUI();
                this.spawn_createFloatingText(this.width/2, this.height - 120, p.floatText, p.particleColor);
                try { audio.playPowerup(3); } catch(e2) {}
            } else {
                this.skillPoints += skill.cost;
                this.ui.updateSkillPoints(this.skillPoints);
                this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
                showToast('無彈藥可強化');
            }
        }

        else if (method === 'skill_meltdown_nova') {
            // 熔毀新星：对所有敢人施加过热状态
            const overheatThreshold = 100; // 爆炸阈值
            const targetTemp = Math.round(overheatThreshold * p.tempRatio);
            eventBus.emit(EVENT_TYPES.UI_FLASH_EFFECT, { color: p.flashColor, duration: 250 });
            this.ui_triggerScreenShake(180);
            let heatedCount = 0;
            this.enemies.forEach(e => {
                if (e.active) {
                    // 只向上拉温度，不降温
                    if (e.temp < targetTemp) {
                        e.temp = targetTemp;
                    }
                    heatedCount++;
                    this.spawn_createParticle(e.pos.x, e.pos.y, p.particleColor, 'spark');
                    this.spawn_createFloatingText(e.pos.x, e.pos.y - 20, '🔥过热!', '#fb923c');
                }
            });
            if (heatedCount > 0) {
                try { audio.playEffect('pyro'); } catch(e2) {}
            }
        }

        else if (method === 'skill_blade_rain') {
            // 剑刃雨：召唤多道飞剑斩击随机敢人
            const swordDmg = Math.round(this.round * p.roundMult);
            const activeEnemies = this.enemies.filter(e => e.active);
            if (activeEnemies.length === 0) {
                this.skillPoints += skill.cost;
                this.ui.updateSkillPoints(this.skillPoints);
                this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
                showToast('沒有敢人可攻擊');
                return;
            }
            for (let i = 0; i < p.swordCount; i++) {
                // 随机选择目标敢人
                const target = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
                const spawnX = target.pos.x + (Math.random() - 0.5) * 60;
                const spawnY = Math.max(30, target.pos.y - 80);
                const swordConfig = {
                    damage: swordDmg,
                    pyro: 0, cryo: 0, lightning: 0, wind: 0,
                    multicast: 0,
                    type: 'flying_sword'
                };
                const lvl = this.variantLevels ? (this.variantLevels.flying_sword || 1) : 1;
                this.combat_flyingSword_addSon(spawnX, spawnY, null, lvl, swordConfig, i * 5);
                this.combat_flyingSword_assignTarget(target);
            }
            this.spawn_createFloatingText(this.width/2, this.height/2, '剑刃雨!', p.particleColor);
            try { audio.playEffect('split'); } catch(e2) {}
        }

        else if (method === 'skill_prismatic_shot') {
            // 棱光炮：下一发弹珠同时携带火/冰/雷三种属性
            if (this.ammoQueue.length > 0) {
                const nextAmmo = this.ammoQueue[0];
                nextAmmo.pyro = (nextAmmo.pyro || 0) + p.pyroStacks;
                nextAmmo.cryo = (nextAmmo.cryo || 0) + p.cryoStacks;
                nextAmmo.lightning = (nextAmmo.lightning || 0) + p.lightningStacks;
                // 标记强制触发元素聚变判定
                nextAmmo._forceFusion = p.forceFusion;
                this.spawn_createExplosion(this.width/2, this.height - 80, p.explosionColor);
                this.ui_updateAmmoUI();
                this.spawn_createFloatingText(this.width/2, this.height - 120, p.floatText, p.explosionColor);
                try { audio.playPowerup(4); } catch(e2) {}
            } else {
                this.skillPoints += skill.cost;
                this.ui.updateSkillPoints(this.skillPoints);
                this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
                showToast('無彈藥可強化');
            }
        }
    },

/**
     * @param {any} enemy - TODO: Describe this parameter.
     */
    combat_flyingSword_assignTarget(enemy) {
        // 遍历所有存活的子剑 (不包括充当标记的母剑)
        this.sonSwords.forEach(sword => {
            if (sword.active && !sword.isMotherBlade) {
                sword.addTarget(enemy);
            }
        });
        // [修复] 剑刃风暴词条逻辑已移至 combat_bladeStorm_update，因为该效果应绑定在首个子弹存活期间周期性触发，而不是在飞剑索敌时触发。
    },

// --- 新增方法：添加子剑 ---
    /**
     * @param {any} x - TODO: Describe this parameter.
     * @param {any} y - TODO: Describe this parameter.
     * @param {any} mother - TODO: Describe this parameter.
     * @param {any} level - TODO: Describe this parameter.
     * @param {any} config - TODO: Describe this parameter.
     * @param {any} delay - TODO: Describe this parameter.
     */
    combat_flyingSword_addSon(x, y, mother, level, config, delay = 0) {
        if (this.sonSwords.length >= 80) return;
        if (isNaN(x) || isNaN(y)) return;
        const sword = new SonSword(x, y, mother, level, config, delay);
        
        // [修复] 子剑继承母剑的飞行方向，并加上小随机偏移
        if (mother && mother.vel) {
            // 获取母剑的单位方向向量
            const motherDir = mother.vel.norm();
            // 加上小随机偏移，避免子剑完全重叠
            const randomOffset = new Vec2(Math.random()-0.5, Math.random()-0.5).mult(2);
            sword.vel = motherDir.mult(8).add(randomOffset);
            // 设置初始角度
            sword.angle = Math.atan2(sword.vel.y, sword.vel.x);
        } else {
            // 如果没有母剑，使用随机方向
            sword.vel = new Vec2(Math.random()-0.5, Math.random()-0.5).mult(5);
            sword.angle = Math.atan2(sword.vel.y, sword.vel.x);
        }
        
        this.sonSwords.push(sword);
    },

/**
     * @method combat_wind_addAnchor
     * @description 添加风属性锚点
     */
    combat_wind_addAnchor(x, y, bulletDamage = 2, bulletConfig = { wind: 1 }) {
        if (this.windAnchors.length >= 4) {
            const old = this.windAnchors.shift();
            // 触发小旋风特效和伤害
            this.spawn_smallWhirlwind(old.x, old.y);
            this.combat_wind_triggerSmallWhirlwindDamage(old.x, old.y, bulletDamage, bulletConfig);
        }
        // [修复] 将 bulletConfig 存入锚点，确保等级信息不丢失
        this.windAnchors.push({ x, y, life: 1.0, bulletDamage: bulletDamage, bulletConfig: bulletConfig });
        this.spawn_createParticle(x, y, '#34d399', 'spark');
        if (this.windAnchors.length === 4) {
            this.combat_wind_triggerMagicCircle();
        }
    },

/**
     * [COMBAT] 触发锚点消失时的范围伤害
     */
    combat_wind_triggerSmallWhirlwindDamage(centerX, centerY, bulletDamage = 2, bulletConfig = { wind: true }) {
        const cfg = CONFIG.wind_system.base;
        const radius = 60; // 伤害半径

        // 遍历敌人检测碰撞
        this.enemies.forEach(e => {
            if (!e.active) return;

            // 计算距离
            const dist = e.pos.dist(new Vec2(centerX, centerY));
            
            // 判定命中 (考虑敌人体积)
            if (dist < radius + e.width / 2) {
                // 1. 造成伤害 - 统一走 damageEnemy
                // [优化] 伤害挂钩子弹伤害倍率 (使用配置参数)
                const dmg = Math.max(1, Math.floor(bulletDamage * cfg.anchorExplosionMult));
                this.combat_damageEnemy(e, { 
                    config: { ...bulletConfig, damage: dmg }, 
                    pos: e.pos, 
                    isCopy: false,
                    shotId: this._currentDamageShotId 
                });
                
                // [修改] 取消风属性造成的位移效果
                // const pushDir = new Vec2(e.pos.x - centerX, e.pos.y - centerY).norm();
                // this.combat_tryMoveEnemy(e, pushDir.mult(10));   
                
                // 3. 受击反馈
                e.hitTimer = 10;
            }
        });
    },

    combat_wind_triggerMagicCircle() {
        // 1. 数量检查
        if (this.windAnchors.length < 4) return;

        // [修复] 直接从锚点中获取触发时的风属性等级，不再从全局子弹列表中查找
        const lastAnchor = this.windAnchors[this.windAnchors.length - 1];
        const currentRecipe = lastAnchor.bulletConfig || { wind: 1, level: 1 };
        // [迁移] 优先使用 recipe.level (最高等级)，若无则回退到 wind 层数判定
        const windLevel = currentRecipe.level || currentRecipe.wind || 1;

        // 2. [重构] 几何拓扑检查：如果是蝴蝶形/交叉形，触发独立的蝴蝶法阵
        // [等级限制] Lv2 解锁蝴蝶法阵
        if (this.isBowtieShape(this.windAnchors)) {
            if (windLevel >= 2) {
                this.combat_wind_triggerButterflyCircle();
                return; 
            }
            // 等级不足，继续向下判定，通常会进入暴风绞杀
        }
        // --- 判定通过，开始锁定流程 ---
        // 3. 计算形状属性
        const anchors = [...this.windAnchors]; // 复制当前锚点，固化下来
        const xs = anchors.map(a => a.x);
        const ys = anchors.map(a => a.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        const area = rect.w * rect.h;
        const ratio = Math.max(rect.w / rect.h, rect.h / rect.w);
        
        // [优化]：计算平均子弹伤害作为法阵基础伤害
        const avgBulletDamage = anchors.reduce((sum, a) => sum + (a.bulletDamage || 2), 0) / anchors.length;
        let type = 'burst';
        // [重构] 优先级：风道 > 风暴核心 > 爆破
        // [等级限制] Lv3 解锁风道
        if (ratio >= 3.0 && windLevel >= 3) {
            type = 'tunnel';
        } else if (area < 6000) {
            // 面积较小触发风暴核心 (范围稍微放宽)
            type = 'storm_core';
        }

        // 获取当前元素类型和完整子弹配置 (已在方法开头获取)
        // [新增] 保存完整的子弹配置，用于法阵伤害套用属性效果
        const bulletConfig = { ...currentRecipe };
        let element = 'wind';
        if (currentRecipe.laser > 0) element = 'wind_light';

        // [优化]：为风道计算长轴中线矢量
        let tunnelVector = null;
        if (type === 'tunnel') {
            const isHorizontal = rect.w > rect.h;
            if (isHorizontal) {
                // 水平风道：从中线左侧指向右侧
                tunnelVector = { start: new Vec2(minX, minY + rect.h/2), end: new Vec2(maxX, minY + rect.h/2), dir: new Vec2(1, 0) };
            } else {
                // 垂直风道：从中线顶部指向底部
                tunnelVector = { start: new Vec2(minX + rect.w/2, minY), end: new Vec2(minX + rect.w/2, maxY), dir: new Vec2(0, 1) };
            }
        }

        // 4. 创建独立的法阵实例对象
        const newMatrix = {
            id: Date.now() + Math.random(),
            active: true,
            timer: this.windMatrixDuration,
            maxTimer: this.windMatrixDuration,
            type: type,
            rect: rect,
            anchors: anchors,
            element: element,
            tunnelVector: tunnelVector, // 存储矢量信息
            bulletDamage: avgBulletDamage, // 存储伤害系数
            bulletConfig: bulletConfig, // [新增] 存储完整子弹配置
            // 5. 伤害回调
            onComplete: () => {
                const windCfg = CONFIG.mechanics.wind;
                let sizeType = area < windCfg.stormAreaThreshold ? 'small' : 'large';
                let shapeType = ratio < 1.5 ? 'square' : 'rect';
                this.combat_wind_executeCircleEffect(minX, minY, rect.w, rect.h, sizeType, shapeType, element, tunnelVector, avgBulletDamage, bulletConfig, type);
            }
        };

        // 6. 推入活跃列表
        this.activeWindMatrices.push(newMatrix);
        
        // 7. [关键] 消耗掉当前的锚点，并触发它们的消失特效
        this.windAnchors.forEach(a => {
            this.spawn_smallWhirlwind(a.x, a.y);
            this.combat_wind_triggerSmallWhirlwindDamage(a.x, a.y);
        });
        this.windAnchors = []; 
        
        // 播放锁定音效 (如果已实现)
        // if (this.soundManager) this.soundManager.playEffect('lock');
    },

    combat_wind_executeCircleEffect(x, y, w, h, size, shape, element, tunnelVector = null, bulletDamage = 2, bulletConfig = null, type = 'burst') {
        const centerX = x + w/2;
        const centerY = y + h/2;

        // [修改 1] 如果没有传入bulletConfig，则使用默认配置
        if (!bulletConfig) {
            bulletConfig = { wind: 1, damage: bulletDamage };
        }

        // 1. 强烈的屏幕震动
        this.triggerScreenShake(size === 'large' ? 15 : 8);
        
        // 2. [优化]：移除爆炸感的冲击波
        // this.spawn_createShockwave(centerX, centerY, '#34d399', Math.max(w, h));
        
        // [优化]：旋风范围比法阵稍大 (1.2倍)
        const expandedW = w * 1.2;
        const expandedH = h * 1.2;
        const expandedX = centerX - expandedW / 2;
        const expandedY = centerY - expandedH / 2;

        if (size === 'small') {
            // [重构] 如果是极小面积法阵触发的'storm_core'类型，则生成风暴核心
            if (type === 'storm_core') {
                this.spawn_stormCore(centerX, centerY, Math.max(w, h) * 1.5, bulletDamage, bulletConfig);
                return; // 结束执行，不走原本的爆炸逻辑
            }

            if (element === 'wind') {
                // 原本的旋风逻辑已移除，此处保留为空或重定向

            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "🕳️黑洞", "#0ea5e9");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > expandedX && e.pos.x < expandedX + expandedW && e.pos.y > expandedY && e.pos.y < expandedY + expandedH) {
                        const dmg = 9999;
                        // [修改 1] 套用子弹完整属性配置
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                    }
                })
             }
        } else if (shape === 'square') {
            if (element === 'wind') {
                this.spawn_createFloatingText(centerX, centerY, "🌪️暴风绞杀", "#34d399");
                
                // [重构] 暴风绞杀：多段切割伤害逻辑
                const scatter = bulletConfig.scatter || 0;
                const multicast = bulletConfig.multicast || 0;
                const tickCount = 1 + scatter;
                const stormDamageMult = CONFIG.wind_system.base.stormDamageMult || 5.0;
                const totalDmg = stormDamageMult * bulletDamage * (1 + multicast);
                const tickDmg = Math.max(1, Math.floor(totalDmg / tickCount));
                const tickInterval = 240; // 每100ms切割一次

                // 1. 制造“暴风眼”视觉：大量风刃向中心旋转坍塌
                for(let i=0; i<100; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 150; 
                    const px = centerX + Math.cos(angle) * dist;
                    const py = centerY + Math.sin(angle) * dist;
                    
                    // 混合属性粒子
                    let pMode = 'wind_slash';
                    let color = '#34d399';
                    const rand = Math.random();
                    if (bulletConfig) {
                        if (bulletConfig.cryo > 0 && rand < 0.25) { pMode = 'shard'; color = '#cffafe'; }
                        else if (bulletConfig.pyro > 0 && rand < 0.25) { pMode = 'ember'; color = '#fdba74'; }
                    }

                    const p = this.spawn_createParticle(px, py, color, pMode);
                    if (p) {
                        const tangent = new Vec2(-Math.sin(angle), Math.cos(angle));
                        const inward = new Vec2(-Math.cos(angle), -Math.sin(angle));
                        p.vel = tangent.mult(12 + Math.random()*8).add(inward.mult(4 + Math.random()*4)); 
                        p.size = (pMode === 'wind_slash' ? 8 : 4) + Math.random() * 10;
                        p.life = 0.6 + Math.random() * 0.4;
                        
                        // 为旋风粒子添加湍流，增加混沌感
                        p.turbulence = 1 + Math.random() * 2;
                    }

                    // [新增] 弥散微风粒子
                    if (i % 2 === 0) {
                        const pWind = this.spawn_createParticle(px, py, '#f0fdf4', 'spark');
                        if (pWind) {
                            const tangent = new Vec2(-Math.sin(angle), Math.cos(angle));
                            pWind.vel = tangent.mult(5 + Math.random()*5);
                            pWind.turbulence = 4 + Math.random() * 4; // 强湍流
                            pWind.size = 1 + Math.random() * 2;
                            pWind.life = 0.5 + Math.random() * 0.5;
                            pWind.drag = 0.95;
                        }
                    }
                }

                // [重构] 将 setTimeout 改为基于 Tick 的同步伤害实体
                if (!this.activeStrangles) this.activeStrangles = [];
                this.activeStrangles.push({
                    centerX, centerY,
                    expandedX, expandedY, expandedW, expandedH,
                    bulletConfig: { ...bulletConfig },
                    tickDmg,
                    totalTicks: tickCount,
                    currentTick: 0,
                    tickInterval: Math.round(tickInterval / (1000 / 60)), // 转换为帧数
                    tickTimer: 0,
                    baseShotId: this._currentDamageShotId || `strangle_${Date.now()}`
                });
            } else if (element === 'wind_explosive') {
                this.spawn_createFloatingText(centerX, centerY, "💥内爆", "#fca5a5");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        // [优化] 伤害挂钩子弹伤害倍率 (使用配置参数)
                        const cfg = CONFIG.wind_system.base;
                        const dmg = Math.max(1, Math.floor(bulletDamage * cfg.shockwaveMult));
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        // [修改] 取消风属性造成的位移效果
                        // const dir = e.pos.sub(new Vec2(centerX, centerY)).norm();
                        // this.combat_tryMoveEnemy(e, dir.mult(40));
                    }
                });
            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "🛡️屏障", "#0ea5e9");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        // [优化] 伤害挂钩子弹伤害倍率 (使用配置参数)
                        const cfg = CONFIG.wind_system.base;
                        const dmg = Math.max(1, Math.floor(bulletDamage * cfg.shockwaveMult * 2)); // 屏障伤害通常更高
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                    }
                });
            }
        } else {
            const isHorizontal = w > h;
            // [优化]：使用计算出的矢量方向，如果没有则回退到默认
            const dir = tunnelVector ? tunnelVector.dir : (isHorizontal ? new Vec2(1, 0) : new Vec2(0, 1));
            
            if (element === 'wind') {
                this.spawn_createFloatingText(centerX, centerY, "🌪️风道", "#34d399");
                
                // 1. 绘制底色流光
                this.drawWindTunnelFlow({x, y, w, h}, isHorizontal);

                // 2. [重构] 风道：多段切割伤害逻辑
                const cfg = CONFIG.wind_system.base;
                const scatter = bulletConfig.scatter || 0;
                const multicast = bulletConfig.multicast || 0;
                const tickCount = 1 + scatter;
                const totalDmg = bulletDamage * cfg.tunnelDamageMult * (1 + multicast);
                const tickDmg = Math.max(1, Math.floor(totalDmg / tickCount));
                const tickInterval = 210; // 每100ms切割一次
                
                // [重构] 将 setTimeout 改为基于 Tick 的同步伤害实体
                if (!this.activeTunnels) this.activeTunnels = [];
                this.activeTunnels.push({
                    x, y, w, h,
                    isHorizontal,
                    bulletConfig: { ...bulletConfig },
                    tickDmg,
                    totalTicks: tickCount,
                    currentTick: 0,
                    tickInterval: Math.round(tickInterval / (1000 / 60)), // 转换为帧数
                    tickTimer: 0,
                    baseShotId: this._currentDamageShotId || `tunnel_${Date.now()}`
                });

                // 4. 生成贯穿全屏的【暴风粒子流】
                const particleCount = 150; // 加大密度
                for(let i=0; i<particleCount; i++) {
                    let px, py;
                    if (isHorizontal) {
                        px = Math.random() * -100; // 从屏幕外生成
                        py = y + Math.random() * h;
                    } else {
                        px = x + Math.random() * w;
                        py = Math.random() * -100;
                    }

                    // [修改] 根据属性混合真实粒子类型
                    let pMode = 'wind_slash';
                    let color = '#d1fae5';
                    const rand = Math.random();
                    
                    if (bulletConfig) {
                        if (bulletConfig.cryo > 0 && rand < 0.3) { pMode = 'shard'; color = '#cffafe'; }
                        else if (bulletConfig.pyro > 0 && rand < 0.3) { pMode = 'ember'; color = '#fdba74'; }
                        else if (bulletConfig.lightning > 0 && rand < 0.3) { pMode = 'spark'; color = '#d8b4fe'; }
                    }

                    const p = this.spawn_createParticle(px, py, color, pMode);
                    if (p && p.vel) {
                        const speed = 40 + Math.random() * 30; 
                        p.vel = dir.mult(speed);
                        p.drag = 1.0; 
                        
                        if (pMode === 'wind_slash') {
                            if (Math.random() < 0.3) {
                                p.size = 20 + Math.random() * 20; // 主风刃
                                p.color = '#ffffff';
                            } else {
                                p.size = 5 + Math.random() * 10; // 伴生气流
                            }
                        } else {
                            p.size = 4 + Math.random() * 6;
                        }

                        p.life = 1.0;
                        const distance = isHorizontal ? this.canvas.width : this.canvas.height;
                        const framesNeeded = (distance + 100) / speed;
                        p.decay = 1.0 / (framesNeeded * 1.2);
                    }

                    // [新增] 湍流微风粒子层：弥散、飘逸
                    if (Math.random() < 0.4) {
                        const pWind = this.spawn_createParticle(px, py, '#f0fdf4', 'spark');
                        if (pWind) {
                            const wSpeed = 15 + Math.random() * 15;
                            pWind.vel = dir.mult(wSpeed).add(new Vec2((Math.random()-0.5)*5, (Math.random()-0.5)*5));
                            pWind.turbulence = 2 + Math.random() * 3; // 湍流强度
                            pWind.size = 1 + Math.random() * 2;
                            pWind.life = 0.8 + Math.random() * 0.4;
                            pWind.decay = 0.02;
                            pWind.drag = 0.98; // 稍微有一点阻力，显得飘逸
                        }
                    }
                }
            } else if (element === 'wind_explosive') {
                this.spawn_createFloatingText(centerX, centerY, "🌊冲击波", "#fca5a5");
                this.enemies.forEach(e => {
                    const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                    if (e.active && inPath) {
                        const dmg = Math.max(1, Math.floor(bulletDamage * 10));
                        // [修改 1] 套用子弹完整属性配置
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        // [修改] 取消风属性造成的位移效果
                        // const pushDir = isHorizontal ? new Vec2(60, 0) : new Vec2(0, 60);
                        // this.combat_tryMoveEnemy(e, pushDir);
                    }
                });
            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "⚡离子风暴", "#0ea5e9");
                this.enemies.forEach(e => {
                    const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                    if (e.active && inPath) {
                        const dmg = Math.max(1, Math.floor(bulletDamage * 12));
                        // [修改 1] 套用子弹完整属性配置
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        this.spawn_createParticle(e.pos.x, e.pos.y, '#c084fc', 'spark');
                    }
                });
            }
        }
    },

/**
     * [COMBAT] 尝试移动敌人，确保其不超出边界且不与其他敌人重叠
     * @param {Enemy} enemy - 要移动的敌人
     * @param {Vec2} delta - 移动向量
     * @returns {boolean} 是否成功移动
     */
    // === 🦋 蝴蝶法阵系统 ===
    combat_wind_triggerButterflyCircle() {
        // 1. 获取锁点和配置
        const anchors = [...this.windAnchors];
        if (anchors.length < 4) return;
        
        // 2. 计算交叉线的交点（沙漏中心）
        const p = anchors;
        const intersection = this.getLineIntersectionPoint(p[0], p[2], p[1], p[3]);
        if (!intersection) return;
        
        // 3. 获取子弹配置
        const currentRecipe = this.projectiles.find(proj => proj.config.wind)?.config || { wind: true };
        const bulletConfig = { ...currentRecipe };
        const avgBulletDamage = anchors.reduce((sum, a) => sum + (a.bulletDamage || 2), 0) / anchors.length;
        
        // 4. 计算 multicast（散射层数）
        const multicast = bulletConfig.multicast || 1;
        
        // 5. 计算伤害冷却（使用配置参数，根据multicast减少冷却）
        const cfg = CONFIG.wind_system.butterfly;
        // 冷却帧数随multicast增加而减少
        const cooldown = Math.max(cfg.minCooldown, Math.floor(cfg.baseCooldown-bulletConfig.scatter));
        
        // 6. 计算风刃数量（1 + multicast）
        const bladeCount = 1 + multicast;
        
        const butterflyCircle = {
            center: intersection,
            anchors: anchors,
            bulletConfig: bulletConfig,
            bulletDamage: avgBulletDamage,
            duration: cfg.duration,
            timer: 0,
            cooldown: cooldown,
            bladeCount: bladeCount,
            firedCount: 0, // [新增] 已发射次数计数
            maxFires: bladeCount, // [新增] 最大发射次数 (1 + multicast)
            active: true,
            startAnim: 60 // 启动阵图动画时长（帧）
        };
        
        // 8. 添加到游戏对象数组
        if (!this.butterflyCircles) this.butterflyCircles = [];
        this.butterflyCircles.push(butterflyCircle);
        
        // 9. 清空锁点
        this.windAnchors = [];
        
        // 10. 视觉反馈
        this.spawn_createFloatingText(intersection.x, intersection.y, "🦋蝴蝶法阵", "#34d399");
        
        // 11. 启动粒子爆发
        for (let i = 0; i < 30; i++) {
            const p = this.spawn_createParticle(intersection.x, intersection.y, '#34d399', 'wind_slash');
            if (p) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 5 + Math.random() * 10;
                p.vel = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
                p.life = 0.5 + Math.random() * 0.5;
            }
        }
    },

    combat_wind_updateButterflyCircles(timeScale) {
        if (!this.butterflyCircles) return;
        
        for (let i = this.butterflyCircles.length - 1; i >= 0; i--) {
            const bc = this.butterflyCircles[i];
            
            bc.timer += timeScale;
            bc.duration -= timeScale;
            if (bc.startAnim > 0) bc.startAnim -= timeScale;
            
            if (bc.timer >= bc.cooldown) {
                bc.timer = 0;
                this.combat_wind_fireButterflyBlades(bc);
                bc.firedCount++;
                // 如果发射次数达到上限，标记为结束
                if (bc.firedCount >= bc.maxFires) {
                    bc.duration = 0; 
                }
            }
            
            if (bc.duration <= 0) {
                bc.active = false;
                this.butterflyCircles.splice(i, 1);
            }
        }
    },

    combat_wind_fireButterflyBlades(bc) {
        const center = new Vec2(bc.center.x, bc.center.y);
        const directions = [
            new Vec2(bc.anchors[0].x, bc.anchors[0].y).sub(center).norm(),
            new Vec2(bc.anchors[1].x, bc.anchors[1].y).sub(center).norm(),
            new Vec2(bc.anchors[2].x, bc.anchors[2].y).sub(center).norm(),
            new Vec2(bc.anchors[3].x, bc.anchors[3].y).sub(center).norm()
        ];
        
        directions.forEach((dir, idx) => {
            for (let i = 0; i < Math.ceil(bc.bladeCount / 4); i++) {
                // [优化] 发射起点：从中心向外延伸至屏幕边缘，作为起点向内发射
                // 计算射线与屏幕边界的交点
                let startPos = new Vec2(center.x, center.y);
                const rayDir = dir;
                // [优化] 发射起点（使用配置参数）
                const cfg = CONFIG.wind_system.butterfly;
                const tX = rayDir.x > 0 ? (this.canvas.width + cfg.launchOffset - center.x) / rayDir.x : (-cfg.launchOffset - center.x) / rayDir.x;
                const tY = rayDir.y > 0 ? (this.canvas.height + cfg.launchOffset - center.y) / rayDir.y : (-cfg.launchOffset - center.y) / rayDir.y;
                const t = Math.min(tX, tY);
                startPos = center.add(rayDir.mult(t));

                const rotationPhase = (bc.timer / bc.cooldown) * Math.PI * 2;
                const bladeAngle = rotationPhase + (i / (bc.bladeCount / 4)) * Math.PI * 2;
                
                const blade = {
                    pos: startPos,
                    // 向内发射：速度方向取反
                    vel: dir.mult(-(cfg.bladeSpeedBase + Math.random() * cfg.bladeSpeedVar)), 
                    bulletConfig: bc.bulletConfig,
                    bulletDamage: bc.bulletDamage,
                    size: cfg.bladeSizeBase + Math.random() * cfg.bladeSizeVar, 
                    life: 1.0,
                    angle: bladeAngle,
                    rotationAxis: dir,
                    active: true,
                    cooldown: bc.cooldown, // [新增] 传递法阵计算出的伤害冷却
                    // [优化] 初始冷却设为足够大，确保第一次命中立即触发
                    damageTimer: 100 
                };
                
                if (!this.butterflyBlades) this.butterflyBlades = [];
                this.butterflyBlades.push(blade);
            }
        });
    },

    combat_wind_updateButterflyBlades(timeScale) {
        if (!this.butterflyBlades) return;
        
        for (let i = this.butterflyBlades.length - 1; i >= 0; i--) {
            const blade = this.butterflyBlades[i];
            
            // 更新位置
            blade.pos = blade.pos.add(blade.vel.mult(timeScale));
            blade.angle += 0.2 * timeScale; // 3D旋转
            blade.damageTimer += timeScale;
            
            // [优化] 检查是否飞出屏幕（使用配置参数）
            const cfg = CONFIG.wind_system.butterfly;
            if (blade.pos.x < -cfg.deleteOffset || blade.pos.x > this.canvas.width + cfg.deleteOffset ||
                blade.pos.y < -cfg.deleteOffset || blade.pos.y > this.canvas.height + cfg.deleteOffset) {
                this.butterflyBlades.splice(i, 1);
                continue;
            }
            
            // 伤害判定（使用法阵计算出的 cooldown）
            if (blade.damageTimer >= (blade.cooldown || cfg.baseCooldown)) {
                let hasHit = false;
                this.enemies.forEach(e => {
                    if (!e.active) return;
                    const dist = blade.pos.sub(e.pos).mag();
                    if (dist < 40) { // 判定范围稍微增大
                        hasHit = true;
                        // [优化] 伤害挂钩子弹伤害倍率
                        const dmg = Math.max(1, Math.floor(blade.bulletDamage * cfg.damageMult));
                        const windConfig = { ...blade.bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: blade.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        
                        // 受击特效
                        for(let k=0; k<3; k++) {
                            const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#34d399', 'wind_slash');
                            if (p) {
                                p.vel = new Vec2((Math.random()-0.5)*8, (Math.random()-0.5)*8);
                                p.size = 8 + Math.random() * 8;
                                p.life = 0.3;
                            }
                        }
                    }
                });
                if (hasHit) {
                    blade.damageTimer = 0; // 命中后重置计时器
                }
            }
        }
    },

    combat_wind_drawButterflyCircles(ctx) {
        if (!this.butterflyCircles) return;
        
        this.butterflyCircles.forEach(bc => {
            if (bc.startAnim > 0) {
                const progress = 1 - bc.startAnim / 60;
                const alpha = Math.sin(progress * Math.PI) * 0.6;
                
                ctx.save();
                ctx.translate(bc.center.x, bc.center.y);
                ctx.globalAlpha = alpha;
                
                // 1. 绘制核心光阵
                ctx.strokeStyle = '#34d399';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 40 + progress * 20, 0, Math.PI * 2);
                ctx.stroke();
                
                // 2. 绘制蝴蝶翅膀动效 (四个扇形)
                for (let i = 0; i < 4; i++) {
                    const angle = i * Math.PI / 2 + progress * Math.PI;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.arc(0, 0, 60 + progress * 40, angle - 0.4, angle + 0.4);
                    ctx.closePath();
                    ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
                    ctx.fill();
                    ctx.stroke();
                }
                
                // 3. 绘制交叉线
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(-100, -100); ctx.lineTo(100, 100);
                ctx.moveTo(100, -100); ctx.lineTo(-100, 100);
                ctx.stroke();
                
                ctx.restore();
            }
        });
    },

    combat_wind_drawButterflyBlades(ctx) {
        if (!this.butterflyBlades) return;
        
        this.butterflyBlades.forEach(blade => {
            // 1. 绘制辅助风粒子流（龙卷风气流感）
            const particleCount = 6;
            for (let i = 0; i < particleCount; i++) {
                const pOffset = (i / particleCount) * Math.PI * 2 + blade.angle * 1.5;
                const pScale = Math.cos(pOffset);
                const pY = pScale * blade.size * 1.2;
                const pAlpha = (0.2 + Math.abs(pScale) * 0.4) * (1 - blade.pos.dist(new Vec2(this.canvas.width/2, this.height/2)) / 1000);
                
                ctx.save();
                ctx.translate(blade.pos.x, blade.pos.y);
                const moveAngle = Math.atan2(blade.vel.y, blade.vel.x);
                ctx.rotate(moveAngle);
                
                ctx.globalAlpha = Math.max(0, pAlpha);
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                // 气流粒子随旋转在垂直方向偏移
                ctx.arc((Math.random()-0.5) * blade.size, pY, 1 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // 2. 绘制主风刃
            ctx.save();
            ctx.translate(blade.pos.x, blade.pos.y);
            
            const scale = Math.abs(Math.cos(blade.angle));
            const alpha = 0.4 + scale * 0.6;
            ctx.globalAlpha = alpha;
            
            let color = '#d1fae5';
            if (blade.bulletConfig) {
                if (blade.bulletConfig.cryo > 0) color = '#cffafe';
                else if (blade.bulletConfig.pyro > 0) color = '#fdba74';
                else if (blade.bulletConfig.lightning > 0) color = '#d8b4fe';
            }
            
            const angle = Math.atan2(blade.vel.y, blade.vel.x);
            ctx.rotate(angle);
            
            // [优化] 风刃变粗：增加垂直方向的缩放基础值
            ctx.scale(1.2, 0.3 + scale * 1.2); 
            
            const grad = ctx.createLinearGradient(-blade.size, 0, blade.size, 0);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.3, color);
            grad.addColorStop(0.5, '#ffffff');
            grad.addColorStop(0.7, color);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = grad;
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
            
            ctx.beginPath();
            // [优化] 形状更厚实
            ctx.moveTo(-blade.size * 1.8, 0);
            ctx.quadraticCurveTo(0, blade.size * 0.8, blade.size * 1.8, 0);
            ctx.quadraticCurveTo(0, -blade.size * 0.8, -blade.size * 1.8, 0);
            ctx.fill();
            
            ctx.restore();
        });
    },

/**
     * 更新风暴核心
     */
    combat_wind_updateStormCores(timeScale) {
        if (!this.stormCores) return;
        
        for (let i = this.stormCores.length - 1; i >= 0; i--) {
            const core = this.stormCores[i];
            core.pulsePhase += 0.05 * timeScale;
            
            let hasBulletInside = false;
            this.projectiles.forEach(proj => {
                const dist = proj.pos.dist(core.pos);
                if (dist < core.radius) hasBulletInside = true;
            });
            
            if (hasBulletInside) {
                const cfg = CONFIG.wind_system.storm_core;
                core.chargeTimer += timeScale;
                if (core.chargeTimer >= 60) {
                    core.chargeTimer = 0;
                    core.energy += cfg.energyPerSecond;
                    this.spawn_createParticle(core.pos.x, core.pos.y, '#34d399', 'spark');
                }
            }
            
            if (core.energy >= core.energyRequired) {
                this.combat_wind_releaseStormCoreCyclone(core);
                this.stormCores.splice(i, 1);
            }
        }
    },

/**
     * 释放风暴核心的大旋风
     * [重构] 将 setTimeout 改为基于 Tick 的同步机制，确保特效与伤害生命周期完全一致。
     * 读取 bonusTicks 属性，动态增加总 Tick 数和持续时间。
     */
    combat_wind_releaseStormCoreCyclone(core) {
        const cfg = CONFIG.wind_system.storm_core;
        const centerX = core.pos.x;
        const centerY = core.pos.y;
        const radius = core.radius * cfg.cycloneRadiusMult;

        this.spawn_createFloatingText(centerX, centerY, "🌀大旋风", "#10b981");
        this.spawn_createShockwave(centerX, centerY, '#10b981');

        // 读取 bonusTicks，动态增加总打击次数
        const baseTickCount = 12;
        const bonusTicks = core.bonusTicks || 0;
        const totalTickCount = baseTickCount + bonusTicks;

        // [重构] 基于 Tick 的同步伤害：将旋风作为持续性特效实体存入 activeCyclones 列表
        if (!this.activeCyclones) this.activeCyclones = [];
        this.activeCyclones.push({
            pos: { x: centerX, y: centerY },
            radius,
            bulletDamage: core.bulletDamage,
            bulletConfig: core.bulletConfig,
            totalTicks: totalTickCount,
            currentTick: 0,
            tickInterval: 6, // 每 6 帧触发一次（约60fps 下为 100ms）
            tickTimer: 0,
            damageMult: cfg.damageMult || 2.0
        });
    },

/**
     * 更新活跃大旋风列表（每帧调用）
     * 基于 Tick 计数同步伤害与粒子特效，确保两者生命周期一致。
     */
    combat_wind_updateActiveCyclones(timeScale) {
        if (!this.activeCyclones || this.activeCyclones.length === 0) return;
        for (let i = this.activeCyclones.length - 1; i >= 0; i--) {
            const cyclone = this.activeCyclones[i];
            cyclone.tickTimer += timeScale;
            if (cyclone.tickTimer < cyclone.tickInterval) continue;
            cyclone.tickTimer = 0;

            const { pos, radius, bulletDamage, bulletConfig, damageMult, currentTick, totalTicks } = cyclone;
            const intensity = 1.0 - (currentTick / totalTicks);

            // 1. 造成伤害
            const tickShotId = this._currentDamageShotId ? `${this._currentDamageShotId}_cyclone_${currentTick}` : `cyclone_${Date.now()}_${currentTick}`;
            this.enemies.forEach(e => {
                if (!e.active) return;
                const dist = Math.hypot(e.pos.x - pos.x, e.pos.y - pos.y);
                if (dist < radius) {
                    const dmg = Math.max(1, Math.floor(bulletDamage * damageMult * 0.25));
                    const windConfig = { ...bulletConfig, damage: dmg };
                    this.combat_damageEnemy(e, { config: windConfig, pos: e.pos, isCopy: false, shotId: tickShotId });
                    e.hitTimer = 10;
                }
            });

            // 2. 旋转粒子视觉（随时间减弱）
            const particleCount = Math.floor(20 * intensity) + 5;
            for (let j = 0; j < particleCount; j++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius;
                const px = pos.x + Math.cos(angle) * dist;
                const py = pos.y + Math.sin(angle) * dist;
                const p = this.spawn_createParticle(px, py, '#10b981', 'wind_slash');
                if (p) {
                    const tangent = new Vec2(-Math.sin(angle), Math.cos(angle));
                    p.vel = tangent.mult(15 + Math.random() * 10);
                    p.size = 8 + Math.random() * 8;
                    p.life = 0.6;
                    p.turbulence = 2 + Math.random() * 3;
                }
            }

            if (currentTick % 3 === 0) {
                this.slowMotionTimer = 5;
                this.timeScale = 0.2;
                this.triggerScreenShake(8);
            }

            cyclone.currentTick++;
            if (cyclone.currentTick >= cyclone.totalTicks) {
                this.activeCyclones.splice(i, 1);
            }
        }
    },

/**
     * 更新活跃暴风绞杀列表（每帧调用）
     * 基于 Tick 计数同步切割伤害与视觉特效。
     */
    combat_wind_updateActiveStrangles(timeScale) {
        if (!this.activeStrangles || this.activeStrangles.length === 0) return;
        const cfg = CONFIG.wind_system.base;
        for (let i = this.activeStrangles.length - 1; i >= 0; i--) {
            const s = this.activeStrangles[i];
            s.tickTimer += timeScale;
            if (s.tickTimer < s.tickInterval) continue;
            s.tickTimer = 0;

            const { centerX, centerY, expandedX, expandedY, expandedW, expandedH, bulletConfig, tickDmg, currentTick, baseShotId } = s;
            const currentTickShotId = `${baseShotId}_strangle_${currentTick}`;

            this.enemies.forEach(e => {
                if (!e.active) return;
                if (e.pos.x > expandedX && e.pos.x < expandedX + expandedW && e.pos.y > expandedY && e.pos.y < expandedY + expandedH) {
                    let dmg = tickDmg;
                    if (e.temp >= 100) {
                        dmg *= 2; e.applyTemp(-50);
                        this.spawn_createFloatingText(e.pos.x, e.pos.y, "🔥火旋风", "#f97316");
                        for (let k = 0; k < 30; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            this.spawn_createParticle(centerX + Math.cos(angle) * Math.random() * 100, centerY + Math.sin(angle) * Math.random() * 100, '#f97316', 'spark');
                        }
                    } else if (e.temp <= -100) {
                        dmg *= 2; e.applyTemp(50);
                        this.spawn_createFloatingText(e.pos.x, e.pos.y, "❄️冰旋风", "#06b6d4");
                        for (let k = 0; k < 30; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            this.spawn_createParticle(centerX + Math.cos(angle) * Math.random() * 100, centerY + Math.sin(angle) * Math.random() * 100, '#06b6d4', 'shard');
                        }
                    }
                    for (let k = 0; k < 3; k++) {
                        const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#fff', 'wind_slash');
                        if (p) { p.vel = new Vec2((Math.random()-0.5)*20, (Math.random()-0.5)*20); p.size = 15; p.life = 0.2; }
                    }
                    const windConfig = { ...bulletConfig, damage: dmg };
                    this.combat_damageEnemy(e, { config: windConfig, pos: e.pos, isCopy: false, shotId: currentTickShotId });
                }
            });

            s.currentTick++;
            if (s.currentTick >= s.totalTicks) {
                this.activeStrangles.splice(i, 1);
            }
        }
    },

/**
     * 更新活跃风道列表（每帧调用）
     * 基于 Tick 计数同步切割伤害与视觉特效。
     */
    combat_wind_updateActiveTunnels(timeScale) {
        if (!this.activeTunnels || this.activeTunnels.length === 0) return;
        const cfg = CONFIG.wind_system.base;
        for (let i = this.activeTunnels.length - 1; i >= 0; i--) {
            const t = this.activeTunnels[i];
            t.tickTimer += timeScale;
            if (t.tickTimer < t.tickInterval) continue;
            t.tickTimer = 0;

            const { x, y, w, h, isHorizontal, bulletConfig, tickDmg, currentTick, baseShotId } = t;
            const currentTickShotId = `${baseShotId}_tunnel_${currentTick}`;
            let hitCount = 0;

            this.enemies.forEach(e => {
                const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y + h) : (e.pos.x > x && e.pos.x < x + w);
                if (e.active && inPath) {
                    hitCount++;
                    const windConfig = { ...bulletConfig, damage: tickDmg, wind: 1 };
                    this.combat_damageEnemy(e, { config: windConfig, pos: e.pos, isCopy: false, shotId: currentTickShotId });
                    for (let k = 0; k < 3; k++) {
                        const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#34d399', 'wind_slash');
                        if (p) { p.vel = new Vec2((Math.random()-0.5)*15, (Math.random()-0.5)*15); p.size = 8 + Math.random() * 8; p.life = 0.3; }
                    }
                }
            });
            if (hitCount > 0) {
                this.slowMotionTimer = 5;
                this.timeScale = cfg.hitStopScale;
                this.triggerScreenShake(10);
            }

            t.currentTick++;
            if (t.currentTick >= t.totalTicks) {
                this.activeTunnels.splice(i, 1);
            }
        }
    },

/**
     * 绘制风暴核心
     */
    combat_wind_drawStormCores(ctx) {
        if (!this.stormCores) return;
        this.stormCores.forEach(core => {
            ctx.save();
            ctx.translate(core.pos.x, core.pos.y);
            
            // 1. 背景脉冲区域
            const pulse = Math.sin(core.pulsePhase) * 0.15 + 1.0;
            ctx.globalAlpha = 0.15 * core.alpha;
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(0, 0, core.radius * pulse, 0, Math.PI * 2);
            ctx.fill();

            // 2. 平滑能量环反馈
            // [优化] 过程值反馈：当前能量 + 当前秒内的充能进度
            const smoothEnergy = core.energy + (core.chargeTimer / 60);
            const energyRatio = Math.min(1.0, smoothEnergy / core.energyRequired);
            
            // 底环
            ctx.globalAlpha = 0.2 * core.alpha;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(0, 0, core.radius * 0.85, 0, Math.PI * 2);
            ctx.stroke();

            // 进度环
            ctx.globalAlpha = 0.8 * core.alpha;
            ctx.strokeStyle = '#10b981';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, 0, core.radius * 0.85, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * energyRatio);
            ctx.stroke();

            // 3. 中心图标与数值
            ctx.globalAlpha = 0.9 * core.alpha;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 图标随充能速度旋转
            ctx.rotate(core.pulsePhase * 2);
            ctx.fillText('🌀', 0, 0);
            ctx.rotate(-core.pulsePhase * 2);

            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = '#10b981';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#000000';
            ctx.fillText(`${core.energy}/${core.energyRequired}`, 0, core.radius + 25);
            
            ctx.restore();
        });
    },

/**
     * 回合结束时合并相交的风暴核心
     * 两两检测距离，若 dist < (r1+r2)*mergeDistanceMult 则合并：
     * - 位置取加权中点（按能量加权）
     * - 半径和能量累加，受 radiusMax / energyMax 上限约束
     * - 达到上限时记录 bonusTicks，用于大旋风额外打击
     */
    combat_wind_mergeStormCores() {
        if (!this.stormCores || this.stormCores.length < 2) return;
        const cfg = CONFIG.wind_system.storm_core;
        let merged = true;
        // 迭代合并，直到没有可合并的对为止
        while (merged) {
            merged = false;
            for (let i = 0; i < this.stormCores.length; i++) {
                for (let j = i + 1; j < this.stormCores.length; j++) {
                    const a = this.stormCores[i];
                    const b = this.stormCores[j];
                    const dist = a.pos.dist(b.pos);
                    const mergeThreshold = (a.radius + b.radius) * (cfg.mergeDistanceMult || 1.0);
                    if (dist < mergeThreshold) {
                        // 按能量加权取中点
                        const totalEnergy = a.energy + b.energy || 1;
                        const wx = (a.pos.x * a.energy + b.pos.x * b.energy) / totalEnergy;
                        const wy = (a.pos.y * a.energy + b.pos.y * b.energy) / totalEnergy;

                        // 累加属性，受上限约束
                        const newRadius = Math.min(cfg.radiusMax || 80, a.radius + b.radius * 0.5 + (cfg.mergeRadiusGrowth || 10));
                        const newEnergy = a.energy + b.energy;
                        const newEnergyRequired = Math.max(a.energyRequired, b.energyRequired);
                        const cappedEnergy = Math.min(cfg.energyMax || 20, newEnergy);

                        // 溢出处理：超出上限时记录 bonusTicks
                        let bonusTicks = (a.bonusTicks || 0) + (b.bonusTicks || 0);
                        if (newEnergy >= (cfg.bonusTickThreshold || 15)) {
                            bonusTicks += cfg.bonusTicksOnMax || 4;
                        }

                        // 合并为 a，删除 b
                        a.pos.x = wx;
                        a.pos.y = wy;
                        a.radius = newRadius;
                        a.energy = cappedEnergy;
                        a.energyRequired = newEnergyRequired;
                        a.bonusTicks = bonusTicks;
                        // 取较大的 bulletDamage
                        a.bulletDamage = Math.max(a.bulletDamage || 1, b.bulletDamage || 1);

                        // 合并特效
                        this.spawn_createShockwave(wx, wy, '#10b981');
                        this.spawn_createFloatingText(wx, wy, '⚡ 风暴核合并!', '#34d399');

                        this.stormCores.splice(j, 1);
                        merged = true;
                        break;
                    }
                }
                if (merged) break;
            }
        }
    },

/**
     * 每回合衰减风暴核心能量
     */
    combat_wind_decayStormCoresEnergy() {
        if (!this.stormCores) return;
        for (let i = this.stormCores.length - 1; i >= 0; i--) {
            const core = this.stormCores[i];
            core.energy = Math.max(0, core.energy - 1);
            if (core.energy > 0) this.spawn_createFloatingText(core.pos.x, core.pos.y, `-1能量`, "#fca5a5");
            if (core.energy === 0) {
                core.alpha -= 0.05;
                if (core.alpha <= 0) this.stormCores.splice(i, 1);
            }
        }
    },

    // [已迁移至 src/combat/collision.js] combat_tryMoveEnemy
    // 敌人移动碰撞检测 (AABB + 边界) —— 通过文件底部的 Object.assign(combat_system, CollisionSystem) 注入

    combat_damageEnemy(enemy, projectile, damageOverride = null) {
        if (!enemy || !enemy.active) return; 
        // --- [修復]：如果是光球/偽造子彈，補齊 chainHistory 防止報措 ---
        if (!projectile.chainHistory) projectile.chainHistory = [];

		const shotId = projectile.shotId !== undefined ? projectile.shotId : null;
        const config = projectile.config;
        let dmg = damageOverride !== null ? damageOverride : (projectile.isCopy ? config.damage * 0.5 : config.damage);

        // [技能系统迭代] 动能爆发技能：弹跳命中时额外加伤
        if (config._kineticBurstDmg && config._kineticBurstDmg > 0) {
            const isBounce = config.bounce > 0 && projectile.bouncesLeft !== undefined && projectile.bouncesLeft < config.bounce;
            if (isBounce) {
                dmg += config._kineticBurstDmg;
            }
        }

        // --- [新增] 确定伤害来源类型 (用于统计图表颜色) ---
        let sourceType = 'main';
        if (config.isScatterChild) sourceType = 'scatter';
        else if (config.type === 'flying_sword') sourceType = 'flying_sword'; // 飞剑
        else if (config.wind) sourceType = 'wind'; // 风
        
        // --- 1. 视觉特效生成逻辑 ---
        const hitX = projectile.pos.x;
        const hitY = projectile.pos.y;
        const afx = CONFIG.balance.affixes; // 获取配置引用
        
        // 根据子弹属性决定打击特效
        // 根据子弹属性决定打击特效
        if (config.cryo > 0) {
            // === ❄️ 冰霜打击 (Frost Impact) ===
            
            // 2. 冰刺爆发 (Ice Spikes)
            // 数量随层数增加
            const shardCount = 1 + Math.floor(config.cryo /3); 
            for(let i=0; i<shardCount; i++) {
                // 颜色：随机在 青色 和 白色 之间跳动
                const color = Math.random() > 0.5 ? '#cffafe' : '#ffffff';
                const shard = new Particle(hitX, hitY, color, 'shard');
                // [限制] 冰刺受风属性压制
                this.spawn_pushParticleWithLimit(shard);
            }
            // 3. 滞留寒雾 (Lingering Mist)
            // 在击中点生成一团慢慢扩散的雾气
            const mistCount = 3 + Math.floor(config.cryo / 2);
            for(let i=0; i<mistCount; i++) {
                // 随机分布在击中点周围
                const mx = hitX + (Math.random()-0.5) * 20;
                const my = hitY + (Math.random()-0.5) * 20;
                // 颜色传 null 即可，Mist 模式内部处理了颜色
                const mist = new Particle(mx, my, null, 'mist');
                // 初始给一个向外的扩散速度
                mist.vel = new Vec2((mx - hitX)*0.05, (my - hitY)*0.05);
                // [限制] 寒雾受风属性压制
                this.spawn_pushParticleWithLimit(mist);
            }

        } else if (config.pyro > 0) {
            // 火焰：生成橙色火星和上升烟雾 (降低单体粒子数量，原 5+3=8，现 2+1=3)
            for(let i=0; i<2; i++) this.spawn_createParticle(hitX, hitY, '#fdba74', 'spark');
            for(let i=0; i<1; i++) this.spawn_createParticle(hitX, hitY, '#7c2d12', 'smoke');
        } else if (config.lightning > 0) {
            // 闪电：生成紫色快速火花
            for(let i=0; i<8; i++) this.spawn_createParticle(hitX, hitY, '#d8b4fe', 'spark');
        } else if (config.pierce > 0) {
            // 穿透：红色锐利碎片
            for(let i=0; i<5; i++) this.spawn_createParticle(hitX, hitY, '#fca5a5', 'spark');
        } else if (config.wind > 0) {
            // 风：生成青绿色气流粒子
            for(let i=0; i<6; i++) {
                const p = this.spawn_createParticle(hitX, hitY, '#34d399', 'spark');
                if (p && p.vel) p.vel = p.vel.mult(1.5);
            }
        } else {
            // 普通：生成基础粒子
            const color = config.damage > 5 ? '#d8b4fe' : '#e2e8f0';
            for(let i=0; i<4; i++) this.spawn_createParticle(hitX, hitY, color, 'normal');
        }
        // --- ：判断伤害类型 ---
        let hitType = 'normal';
        if (config.cryo > 0) hitType = 'cryo';
        else if (config.pyro > 0) hitType = 'pyro';
        else if (config.lightning > 0) hitType = 'lightning';
        else if (config.pierce > 0) hitType = 'pierce';
        else if (config.wind > 0) hitType = 'wind';
        // --- 2. 伤害与状态逻辑 (保持原有逻辑) ---
        // --- [属性共鸣] 冰霜共鸣：读取共鸣参数，增强降温效果、基础属性加成和伤害倍率 ---
        const cryoResonance = this.activeElementResonances && this.activeElementResonances['cryo'];
        const cryoResParams = cryoResonance ? cryoResonance.params : null;
        // 冰冻触发温度：共鸣可提升至 -25/-15/-5，默认 -34（越高越容易触发冰冻）
        const freezeTempThreshold = cryoResParams ? (cryoResParams.freezeTempThreshold || -34) : -34;
        // 共鸣提供的基础冰霜属性加成（叠加到实际 cryo 层数上）
        const cryoBonus = cryoResParams ? (cryoResParams.baseCryoBonus || 0) : 0;
        const effectiveCryo = config.cryo + cryoBonus;
        // 共鸣整体冰霜伤害倍率：1.0/1.2/1.5
        const cryoResMult = cryoResParams ? (cryoResParams.cryoMultiplier || 1.0) : 1.0;
        // 三阶共鸣：冻结状态下物理伤害加深
        const frozenPhysDmgBonus = cryoResParams ? (cryoResParams.frozenPhysDmgBonus || 0) : 0;
        if (config.cryo > 0) {
            // 使用 effectiveCryo（含共鸣加成）计算降温量，并应用共鸣倍率
            enemy.applyTemp(-CONFIG.balance.cryoAmount * effectiveCryo * cryoResMult);
            // 标记本回合被冰属性命中（供元素聚变使用）
            enemy._cryoHitThisRound = true;
            // 三阶共鸣：冻结状态下物理伤害加深（在 takeDamage 前修改 dmg）
            if (frozenPhysDmgBonus > 0 && enemy.temp <= freezeTempThreshold) {
                dmg = dmg * (1 + frozenPhysDmgBonus);
            }
        }
        if (config.pyro > 0) {
            enemy.applyTemp(CONFIG.balance.pyroAmount * config.pyro);
            // 标记本回合被火属性命中（供元素聚变使用）
            enemy._pyroHitThisRound = true;
        }
        if (config.lightning > 0) {
            // --- [属性共鸣] 雷霖共鸣：读取共鸣参数，增强闪电链触发概率和伤害倍率 ---
            const lightningResonance = this.activeElementResonances && this.activeElementResonances['lightning'];
            const lightningResParams = lightningResonance ? lightningResonance.params : null;
            // 共鸣提供的基础闪电属性加成（叠加到实际 lightning 层数上）
            const lightningBonus = lightningResParams ? (lightningResParams.baseLightningBonus || 0) : 0;
            const effectiveLightning = config.lightning + lightningBonus;
            // 共鸣闪电链触发概率加成：0.15/0.30/0.50
            const chainChanceBonus = lightningResParams ? (lightningResParams.chainChanceBonus || 0) : 0;
            // 共鸣整体闪电伤害倍率：1.0/1.2/1.5
            const lightningResMult = lightningResParams ? (lightningResParams.lightningMultiplier || 1.0) : 1.0;
            // 三阶共鸣：闪电链可对同一目标二次触发
            const allowDoubleChain = lightningResParams ? (lightningResParams.allowDoubleChain || false) : false;
            // 将共鸣参数写入配方，供 combat_lightning_triggerChain 使用
            const lightningDmgWithMult = dmg * lightningResMult;
            // 1. 尝试触发闪电链，并获取结果
            // [修改] 传入当前闪电等级 (effectiveLightning)，传入共鸣加成的概率加成
            const isChainTriggered = this.combat_lightning_triggerChain(enemy, lightningDmgWithMult, projectile.chainHistory, effectiveLightning, shotId, chainChanceBonus);
            // 2. 只有在成功触发闪电链时，才提升当前敌人的温度 (公式：闪电层数 + 连锁次数/3)
            if (isChainTriggered) {
                const chainCount = projectile.chainHistory.length;
                enemy.applyTemp(effectiveLightning + chainCount / 3);
                // 三阶共鸣：闪电链可对同一目标二次触发
                if (allowDoubleChain && Math.random() < 0.5) {
                    this.combat_lightning_triggerChain(enemy, lightningDmgWithMult, [...projectile.chainHistory], effectiveLightning, shotId, chainChanceBonus);
                }
            }
            // 标记本回合被闪电命中（供元素聚变使用）
            enemy._lightningHitThisRound = true;
            projectile.chainHistory.push(enemy);
        }
        // --- [属性共鸣] 弹跳共鸣：读取共鸣参数，增强弹跳伤害加成 ---
        if (config.bounce > 0) {
            const bounceResonance = this.activeElementResonances && this.activeElementResonances['bounce'];
            const bounceResParams = bounceResonance ? bounceResonance.params : null;
            // 共鸣提供的弹跳伤害加成：+15%/+30%/+50%
            const bounceDmgBonus = bounceResParams ? (bounceResParams.bounceDmgBonus || 0) : 0;
            // 二/三阶共鸣：每次弹跳后伤害不衰减
            const noBounceDecay = bounceResParams ? (bounceResParams.noBounceDecay || false) : false;
            if (bounceDmgBonus > 0) {
                // 弹跳命中时应用共鸣伤害加成
                const isBounceHitNow = (projectile.bouncesLeft !== undefined && projectile.bouncesLeft < config.bounce);
                if (isBounceHitNow) {
                    dmg = dmg * (1 + bounceDmgBonus);
                }
            }
            // 二/三阶共鸣：弹跳伤害不衰减（将弹跳次数标记到配方中，供 projectile.js 使用）
            if (noBounceDecay) {
                config._noBounceDecay = true;
            }
        }
        // --- [属性共鸣] 穿透共鸣：读取共鸣参数，增强穿透伤害加成和额外升温 ---
        if (config.pierce > 0) {
            const pierceResonance = this.activeElementResonances && this.activeElementResonances['pierce'];
            const pierceResParams = pierceResonance ? pierceResonance.params : null;
            // 共鸣提供的穿透伤害加成：+15%/+30%/+50%
            const pierceDmgBonus = pierceResParams ? (pierceResParams.pierceDmgBonus || 0) : 0;
            // 二/三阶共鸣：穿透命中后额外施加火焰温度
            const pierceApplyTemp = pierceResParams ? (pierceResParams.pierceApplyTemp || 0) : 0;
            if (pierceDmgBonus > 0) {
                // 穿透命中时应用共鸣伤害加成
                const isPierceHitNow = (projectile.piercesLeft !== undefined && projectile.piercesLeft < config.pierce);
                if (isPierceHitNow) {
                    dmg = dmg * (1 + pierceDmgBonus);
                }
            }
            if (pierceApplyTemp > 0) {
                // 穿透命中后额外施加火焰温度（升温）
                const isPierceHitNow = (projectile.piercesLeft !== undefined && projectile.piercesLeft < config.pierce);
                if (isPierceHitNow) {
                    enemy.applyTemp(pierceApplyTemp);
                    if (pierceApplyTemp >= 10) {
                        this.spawn_createFloatingText(hitX, hitY - 20, `火焰穿透 +${pierceApplyTemp}°`, '#f97316');
                    }
                }
            }
        }
        // --- [符文词条 Hook] 专注射击 (focused_fire) - 暴击判定 ---
        // 读取配方中由任务 A 写入的 _critChance 和 _critDamage 字段
        let isCrit = false;
        const critChance = config._critChance || 0;
        const critDamage = config._critDamage || 1.0;
        if (critChance > 0 && Math.random() < critChance) {
            isCrit = true;
            dmg = dmg * critDamage;
        }
        // [修改] 调用 takeDamage 时传入 projectile 作为源，用于方向判定
        const damageResult = enemy.takeDamage(dmg, projectile);
        
        // [词条 Hook] 元素聚变（elemental_fusion）
        // 在实际造成伤害后，检查三元素状态，触发聚变爆炸
        if (typeof this.combat_runeword_elementalFusion_check === 'function') {
            this.combat_runeword_elementalFusion_check(enemy, dmg, shotId);
        }
        const killed = damageResult.killed;
        const actualDmg = damageResult.actualDamage; // --- [新增] 确定基础伤害类型 (用于统计图表行) ---
        // 需求2a: 火属性子弹的弹射/穿透伤害分别统计，只有额外火伤才算火属性
        let damageType = 'damage'; // 默认为物理/基础

        // 判定是否为弹射或穿透产生的击打
        const isBounceHit = (config.bounce > 0 && projectile.bouncesLeft < config.bounce);
        const isPierceHit = (config.pierce > 0 && projectile.piercesLeft < config.pierce);

        if (isBounceHit) {
            damageType = 'bounce';
        } else if (isPierceHit) {
            damageType = 'pierce';
        } else {
            if (config.pyro > 0) damageType = 'pyro';
            else if (config.cryo > 0) damageType = 'cryo';
            else if (config.lightning > 0) damageType = 'lightning';
            else if (config.wind > 0) damageType = 'wind';
            else if (config.type === 'flying_sword') damageType = 'flying_sword';
        }

        const colorMap = {
            'pyro': '#f97316', 'cryo': '#06b6d4', 'lightning': '#c084fc',
            'bounce': '#fbbf24', 'pierce': '#fca5a5', 'damage': '#ffffff',
            'wind': '#34d399', 'flying_sword': '#0ea5e9', 'scatter': '#facc15'
        };
        const damageColor = colorMap[damageType] || '#ffffff';

        // [Agent D] 炎光剑影词条 Hook：穿透命中时有概率召唤飞剑
        // [穿甲流星联动] 当穿甲流星激活时，散射子弹（isScatterChild=true）继承了穿透层数，
        // 因此也应该能触发炎光剑影效果，故此处放开 isCopy 限制（仅针对散射子弹）
        const armorPiercingActive = this.activeRunewordEffects && this.activeRunewordEffects['armor_piercing_meteor'];
        if (isPierceHit && (!projectile.isCopy || (config.isScatterChild && armorPiercingActive))) {
            const flameSwordFx = this.activeRunewordEffects && this.activeRunewordEffects['flame_sword'];
            if (flameSwordFx) {
                const triggerChance = (flameSwordFx.params && flameSwordFx.params.triggerChance) || 0;
                const damageRatio = (flameSwordFx.params && flameSwordFx.params.damageRatio) || 0.5;
                // [修复 检查点3] 读取 tempDamageRatio，用于穿透命中时对敌人额外升温
                const tempDamageRatio = (flameSwordFx.params && flameSwordFx.params.tempDamageRatio) || 0;
                if (Math.random() < triggerChance) {
                    // 生成一把火系飞剑，目标为当前被穿透的敌人
                    const swordConfig = {
                        damage: Math.ceil(config.damage * damageRatio),
                        pyro: Math.max(1, config.pyro || 1),
                        cryo: 0, lightning: 0, wind: 0,
                        multicast: 0
                    };
                    const flameSwordLvl = this.variantLevels ? (this.variantLevels.flying_sword || 1) : 1;
                    this.combat_flyingSword_addSon(hitX, hitY, null, flameSwordLvl, swordConfig, 0);
                    this.combat_flyingSword_assignTarget(enemy);
                    // [修复 检查点3] 额外升温：baseDamage * tempDamageRatio
                    if (tempDamageRatio > 0) {
                        const tempAmount = config.damage * tempDamageRatio;
                        enemy.applyTemp(tempAmount);
                    }
                    // [修复 检查点4] 添加 SlashAnim 视觉特效（火焰橙色），与其他飞剑命中特效保持一致
                    const slashAngle = Math.random() * Math.PI * 2;
                    this.spawn_pushParticleWithLimit(new SlashAnim(hitX, hitY, slashAngle, 0.5, '#f97316'));
                    this.spawn_createParticle(hitX, hitY, '#f97316', 'spark');
                    this.spawn_createFloatingText(hitX, hitY - 20, '剑光!', '#f97316');
                }
            }
        }

        // [Agent D] 雷电护盾词条 Hook：弹跳命中时有概率在命中位置生成静电场
        if (isBounceHit && config.lightning > 0 && !projectile.isCopy) {
            const lightningShieldFx = this.activeRunewordEffects && this.activeRunewordEffects['lightning_shield'];
            if (lightningShieldFx) {
                const triggerChance = (lightningShieldFx.params && lightningShieldFx.params.triggerChance) || 0;
                const damageRatio = (lightningShieldFx.params && lightningShieldFx.params.damageRatio) || 0.5;
                if (Math.random() < triggerChance) {
                    // 在命中位置生成静电场（复用 combat_wind_addAnchor，传入闪电属性）
                    const staticDmg = Math.ceil(config.damage * damageRatio);
                    const staticConfig = { lightning: Math.max(1, config.lightning), damage: staticDmg, wind: 0 };
                    this.combat_wind_addAnchor(hitX, hitY, staticDmg, staticConfig);
                    this.spawn_createFloatingText(hitX, hitY - 20, '静电场!', '#c084fc');
                }
            }
        }

        this.combat_recordDamage(actualDmg, damageType, sourceType, shotId);

        // [新增] Boss 狂暴阶段即时掉落：HP 首次降至 50% 时生成 1 个 Lv1 符文并立即自动拾取
        // 使用 enemy._bossEnrageDropped 标志确保每个 Boss 仅触发一次
        if (
            !killed &&
            enemy.type === 'boss' &&
            !enemy._bossEnrageDropped &&
            enemy.hp > 0 &&
            enemy.hp / enemy.maxHp < 0.5
        ) {
            enemy._bossEnrageDropped = true; // 标记已触发，防止重复掉落

            // 生成 1 个标准 Lv1 符文（无 overrideOptions）
            const enrageDropResult = loot_calcRuneDrop(this);
            if (enrageDropResult.runeId) {
                // 立即自动拾取：直接将符文推入库存，复用现有拾取逻辑
                const enrageRuneDef = RUNE_DB.find(r => r.id === enrageDropResult.runeId);
                if (enrageRuneDef) {
                    this.runeInventory.push({ id: enrageDropResult.runeId, level: enrageDropResult.level });
                    const runeName = enrageRuneDef.icon
                        ? `${enrageRuneDef.icon} ${enrageRuneDef.name}`
                        : enrageRuneDef.name;
                    // 视觉反馈：显示狂暴掉落提示
                    this.spawn_createFloatingText(
                        enemy.pos.x,
                        enemy.pos.y - 40,
                        `狂暴! +${runeName}`,
                        '#f59e0b'
                    );
                    showToast(`Boss 狂暴！获得符文：${runeName}`);
                }
            }
        }

        // 事件总线广播伤害事件
        eventBus.emit(EVENT_TYPES.COMBAT_DAMAGE_DEALT, {
            enemy: enemy,
            amount: actualDmg,
            type: damageType,
            sourceType: sourceType,
            shotId: shotId,
            hitX: hitX,
            hitY: hitY,
            killed: killed
        });

        // Boss 阶段变化检测：伤害结算后检测是否触发狂暴
        if (!killed && enemy.type === 'boss' && !enemy.berserked) {
            this.combat_checkBossPhaseChange();
        }

        // --- 2. [火属性核心逻辑] 燃烧与过热爆炸 ---
        // [属性共鸣] 读取火焰共鸣参数，动态调整触发阈值、基础属性和伤害倍率
        const pyroResonance = this.activeElementResonances && this.activeElementResonances['pyro'];
        const pyroResParams = pyroResonance ? pyroResonance.params : null;
        // 火焰额外伤害触发温度：共鸣可降至 30 或 0，默认 34
        const burnTempThreshold = pyroResParams ? pyroResParams.burnTempThreshold : 34;
        // 共鸣提供的基础火焰属性加成（叠加到实际 pyro 层数上）
        const pyroBonus = pyroResParams ? (pyroResParams.basePyroBonus || 0) : 0;
        const effectivePyro = config.pyro + pyroBonus;
        // 共鸣整体火焰伤害倍率：1.0/1.2/1.5
        const pyroResMult = pyroResParams ? (pyroResParams.pyroMultiplier || 1.0) : 1.0;

        if (config.pyro > 0 && enemy.temp >= burnTempThreshold) {
            // [Agent D] 熱毁词条 Hook：计算火焰伤害倍率
            let meltdownMult = 1.0;
            const meltdownFx = this.activeRunewordEffects && this.activeRunewordEffects['meltdown'];
            if (meltdownFx) {
                const bonus = (meltdownFx.params && meltdownFx.params.damageBonus) || 0;
                meltdownMult = 1.0 + bonus;
            }
            // Step 1: 计算当前的基础额外火伤（应用共鸣加成后的 effectivePyro）
            const baseFireDmg = (effectivePyro * enemy.temp) / 200;
            // Step 2: 造成基础燃烧伤害（应用熱毁倍率 × 共鸣倍率）
            if (baseFireDmg >= 1) {
                const fireResult = enemy.takeDamage(baseFireDmg * meltdownMult * pyroResMult);
                this.combat_recordDamage(fireResult.actualDamage, 'pyro', sourceType, shotId);
                // 显示橙色燃烧字样（共鸣激活时展示共鸣等级标记）
                const burnLabel = pyroResonance ? `🔥Burn ${Math.ceil(fireResult.actualDamage)}` : `Burn ${Math.ceil(fireResult.actualDamage)}`;
                this.spawn_createFloatingText(enemy.pos.x, enemy.pos.y - 25, burnLabel, '#fb923c');
            }
            // Step 3: [新增] 过热爆炸机制 (Small Explosion)
            // [属性共鸣] 三阶共鸣可将爆燃阈值从 200 降至 100
            const pyroCfg = CONFIG.mechanics.pyro;
            const EXPLODE_THRESHOLD = (pyroResParams && pyroResParams.explodeThreshold !== null && pyroResParams.explodeThreshold !== undefined)
                ? pyroResParams.explodeThreshold
                : pyroCfg.explodeThreshold;
            let explodeChance = 0;
            if (enemy.temp > EXPLODE_THRESHOLD) {
                // 线性插値计算概率
                const range = pyroCfg.tempForMaxChance - EXPLODE_THRESHOLD;
                const chanceRange = pyroCfg.maxExplodeChance - pyroCfg.baseExplodeChance;
                explodeChance = pyroCfg.baseExplodeChance + (enemy.temp - EXPLODE_THRESHOLD) * (chanceRange / range);
                explodeChance = Math.min(pyroCfg.maxExplodeChance, explodeChance); // 最高限制
            }

            if (explodeChance > 0 && Math.random() < explodeChance) {
                
                // A. 计算消耗量
                const consumedHeat = enemy.temp * pyroCfg.heatConsumptionRate;
                
                // B. 执行消耗：先扣除
                enemy.temp -= consumedHeat;

                // C. 计算爆炸伤害（应用熱毁倍率 × 共鸣倍率）
                const explodeDmg = baseFireDmg * pyroCfg.damageMult * meltdownMult * pyroResMult;
                
                if (explodeDmg >= 1) {
                    // --- 1. 视觉特效 (参考爆炸子弹) ---
                    this.spawn_createShockwave(enemy.pos.x, enemy.pos.y, '#f97316'); // 橙色冲击波
                    for(let i=0; i<10; i++) this.spawn_createParticle(enemy.pos.x, enemy.pos.y, '#fdba74', 'spark');
                    for(let i=0; i<5; i++) this.spawn_createParticle(enemy.pos.x, enemy.pos.y, 'rgba(0,0,0,0.5)', 'smoke');
                    audio.playExplosion();

                    // --- 2. 核心伤害 (对当前敌人) ---
                    const expResult = enemy.takeDamage(explodeDmg);
                    this.combat_recordDamage(expResult.actualDamage, 'pyro', sourceType, shotId);
                    this.spawn_createFloatingText(enemy.pos.x, enemy.pos.y - 50, `BOOM! ${Math.ceil(expResult.actualDamage)}`, '#dc2626');
                    
                    // --- 3. 范围伤害 (AOE) ---
                    const EXPLODE_RADIUS = pyroCfg.radius; // 爆炸半径
                    this.enemies.forEach(other => {
                        if (other !== enemy && other.active && enemy.pos.dist(other.pos) < EXPLODE_RADIUS) {
                            const aoeDmg = explodeDmg * pyroCfg.aoeDamageMult; // 范围伤害
                            const aoeResult = other.takeDamage(aoeDmg);
                            this.combat_recordDamage(aoeResult.actualDamage, 'pyro', sourceType, shotId);
                            
                            // 范围内的敌人也受到热量波及 (增加少量温度)
                            other.applyTemp(consumedHeat*0.25);
                        }
                    });
                }
            }    // D. 移除热量回填机制 (根据需求取消回填)
        }
        
        // --- [CRT效果] 根据伤害大小触发色差效果 ---
        this.combat_triggerChromaticAberration(actualDmg);
        
        // [新增] 保存当前shotId，供后续额外伤害使用
        // this._currentDamageShotId = shotId; // 移除：不再需要全局缓存 shotId
        
        // [新增] 统一显示伤害数字 (使用实际造成的伤害)
        if (this.showDamageNumbers && actualDmg > 0) {
            if (isCrit) {
                // 暴击时：显示金色 CRIT 文字，不再重复显示普通伤害数字
                this.spawn_createFloatingText(hitX, hitY - 10, `CRIT! -${Math.ceil(actualDmg)}`, '#FFD700');
            } else {
                this.spawn_createFloatingText(hitX, hitY, `-${Math.ceil(actualDmg)}`, damageColor);
            }
        }
        // --- [符文词条 Hook] 专注射击 (focused_fire) - 暴击视觉特效 ---
        if (isCrit) {
            // 1. 红金相间的 spark 粒子爆发（金色和红色交替）
            for (let i = 0; i < 12; i++) {
                const sparkColor = i % 2 === 0 ? '#FFD700' : '#FF4444';
                this.spawn_createParticle(hitX, hitY, sparkColor, 'spark');
            }
            // 2. 小范围金色冲击波（maxRadius 覆写为 60）
            const critSw = new Shockwave(hitX, hitY, '#FFD700');
            critSw.maxRadius = 60;
            this.shockwaves.push(critSw);
        }
        audio.playEnemyHit(hitType);

        // --- [新增] 剑痕共鸣机制 (Stuck Sword Resonance) ---
        if (!killed && enemy.stuckSwords && enemy.stuckSwords.length > 0) {
            enemy.stuckSwords.forEach(sword => {
                if (sword.active) {
                    const level = sword.level || 1;
                    let extraDmg = 0;
                    let resonanceColor = '#0ea5e9';
                    
                    // 1. 计算共鸣伤害 and 属性
                    const fsCfg = CONFIG.mechanics.flying_sword;
                    if (level === 1) {
                        extraDmg = sword.config.damage * fsCfg.resonanceDamageMult;
                    } else if (level === 2) {
                        extraDmg = sword.config.damage * fsCfg.resonanceDamageMult;
                        // 应用 50% 属性效果 (简化处理：直接应用 50% 的温度变化)
                        if (sword.config.cryo > 0) enemy.applyTemp(-CONFIG.balance.cryoAmount * sword.config.cryo * 0.5);
                        if (sword.config.pyro > 0) enemy.applyTemp(CONFIG.balance.pyroAmount * sword.config.pyro * 0.5);
                        resonanceColor = '#6366f1';
                    } else if (level >= 3) {
                        extraDmg = sword.config.damage;
                        // 应用 100% 属性效果
                        if (sword.config.cryo > 0) enemy.applyTemp(-CONFIG.balance.cryoAmount * sword.config.cryo);
                        if (sword.config.pyro > 0) enemy.applyTemp(CONFIG.balance.pyroAmount * sword.config.pyro);
                        resonanceColor = '#f43f5e';
                    }

	                    // 2. 造成额外伤害
	                    if (extraDmg > 0) {
	                        enemy.takeDamage(extraDmg);
	                        this.combat_recordDamage(extraDmg, 'flying_sword', 'flying_sword', shotId);
	                        this.spawn_createFloatingText(sword.pos.x, sword.pos.y, `+${Math.ceil(extraDmg)}`, resonanceColor);

                            // [新增] 电属性飞剑联动：触发连锁闪电
                            if (sword.config.lightning > 0) {
                                // 按照正常概率触发闪电链
                                this.combat_lightning_triggerChain(enemy, extraDmg, [], sword.config.lightning, shotId);
                            }
	                    }

                    // 3. [修复] 视觉特效：斩击动画，使用元素属性颜色
                    const angle = Math.random() * Math.PI * 2;
                    // 根据元素属性决定斩击颜色，优先级：雷 > 火/冰
                    let slashColor = '#0ea5e9'; // 默认飞剑颜色
                    if (sword.config.lightning > 0) slashColor = '#c084fc'; // 雷属性
                    else if (sword.config.pyro > 0) slashColor = '#f97316'; // 火属性
                    else if (sword.config.cryo > 0) slashColor = '#06b6d4'; // 冰属性
                    
                    // [限制] SlashAnim 受全局粒子上限约束
                    this.spawn_pushParticleWithLimit(new SlashAnim(sword.pos.x, sword.pos.y, angle, 0.35, slashColor));
                    this.spawn_createParticle(sword.pos.x, sword.pos.y, slashColor, 'spark');
                }
            });
            // 清理已失效的子剑
            enemy.stuckSwords = enemy.stuckSwords.filter(s => s.active);
        }

        // 克隆词缀逻辑: 如果敌人被伤害且有 'clone' 词缀，有概率生成克隆
        
        if (!killed && enemy.affixes.includes('clone') && Math.random() < afx.cloneChanceHit) {
             // ... (复制你原来的 clone 生成代码) ...
             const cloneHp = Math.max(1, Math.floor(enemy.maxHp * 0.2));
             const w = this.enemyWidth;
             // ... 寻找位置 ...
             // 简写：实际请保留原来的完整逻辑
             const validCols = [];
             for(let r = 0; r < 3; r++) { for(let c = 0; c < CONFIG.enemyCols; c++) { validCols.push({x: c*w+w/2, y: 80+r*50}); }} // 简单示意
             if (validCols.length > 0) {
                 const pos = validCols[Math.floor(Math.random() * validCols.length)];
                 this.spores.push(new CloneSpore(enemy.pos.x, enemy.pos.y, pos.x, pos.y, () => {
                    const clone = new Enemy(pos.x, pos.y, w, this.enemyHeight, cloneHp, cloneHp);
                    clone.affixes = [];
                    clone.isClone = true; // [Mikro联动] 标记为分身，用于母体减伤计算
                    this.enemies.push(clone);
                }));
             }
        }

        if (killed) { 
            this.spawn_addScore(enemy.maxHp);
            
            // [词条 Hook] 嗜血初锋 (bloodthirst_growth)
            // runewordKillCount 跨回合持久，仅在 sys_resetGame 中重置（每局一次）
            if (this.activeRunewordEffects && this.activeRunewordEffects['bloodthirst_growth']) {
                this.runewordKillCount = (this.runewordKillCount || 0) + 1;
            }
            
            // 事件总线广播敌人死亡
            eventBus.emit(EVENT_TYPES.COMBAT_ENEMY_KILLED, {
                enemy: enemy,
                maxHp: enemy.maxHp,
                shotId: shotId
            });

            // [新增] 子剑回收逻辑：如果敌人被杀，插在上面的子剑需要回收
            if (enemy.stuckSwords && enemy.stuckSwords.length > 0) {
                enemy.stuckSwords.forEach(sword => {
                    if (sword.active) {
                        // 寻找回收目标
                        let recallTarget = null;
                        // 寻找母剑是否还插在某个敌人身上
                        const motherBladeMarker = this.sonSwords.find(s => s.mother === sword.mother && s.isMotherBlade && s.state === 'stuck' && s.active);
                        if (motherBladeMarker) {
                            recallTarget = motherBladeMarker.pos;
                        } else {
                            // 母剑不存在或未插在敌人身上，回到玩家位置
                            recallTarget = { x: this.width / 2, y: this.height - 80 };
                        }
                        sword.triggerRecall(recallTarget);
                    }
                });
                enemy.stuckSwords = [];
            }

            // ============================================================
            // [分级死亡特效系统] v2 - 区分普通/精英/Boss，支持冰冻/燃烧状态
            // ============================================================
            this._triggerDeathFX(enemy, shotId);
            const activeCount = this.enemies.filter(e => e.active && (e.pos.y > 0)).length;
            if(activeCount === 0) {
                this.data_clearProjectiles(); 
                if (this.isEnemyTurn) {
                    console.error(">>> [BUG] 严重错误：在清理子弹时，isEnemyTurn 竟然是 TRUE！");
                }
            }
            if (enemy.type === 'boss') {
                // 广播 Boss 被击杀事件
                eventBus.emit(EVENT_TYPES.BOSS_DEFEATED, {
                    boss: enemy,
                    bossId: enemy.bossType,
                    bossName: enemy.bossName,
                    round: this.round
                });
                // [BUGFIX] 设置标志位：通知 phase_finalizeRound 本回合已有 Boss 遗物待领取，
                // 避免固定回合遗物事件同时触发导致双重弹窗。
                this._pendingBossRelic = true;
                setTimeout(() => {
                    // [fix] 修复命名不一致：openRelicSelection -> ui_showRelicSelection
                    // ui_showRelicSelection 内部已经会设置 stateBeforeRelic，无需在此重复设置
                    this.ui_showRelicSelection();
                }, 500);

                // [新增] Boss 死亡丰厚掉落：必定掉落 3 个符文
                // 读取当前 Boss 的主题权重配置（如果有）
                const bossThemeWeights = (enemy.bossConfig && enemy.bossConfig.themeWeights)
                    ? enemy.bossConfig.themeWeights
                    : {};

                // 掉落 1：必定 Lv2 + 主题权重（主题符文）
                const drop1 = loot_calcRuneDrop(this, { forcedLevel: 2, themeWeights: bossThemeWeights });
                if (drop1.runeId) {
                    const loot1 = new RuneLoot(enemy.pos.x - 20, enemy.pos.y, drop1.runeId);
                    loot1.level = drop1.level;
                    this.runeLootItems.push(loot1);
                }

                // 掉落 2：20% 概率 Lv2，否则 Lv1（智能掉落）
                const forcedLevel2 = Math.random() < 0.20 ? 2 : 1;
                const drop2 = loot_calcRuneDrop(this, { forcedLevel: forcedLevel2 });
                if (drop2.runeId) {
                    const loot2 = new RuneLoot(enemy.pos.x, enemy.pos.y, drop2.runeId);
                    loot2.level = drop2.level;
                    this.runeLootItems.push(loot2);
                }

                // 掉落 3：标准掉落（无 overrideOptions）
                const drop3 = loot_calcRuneDrop(this);
                if (drop3.runeId) {
                    const loot3 = new RuneLoot(enemy.pos.x + 20, enemy.pos.y, drop3.runeId);
                    loot3.level = drop3.level;
                    this.runeLootItems.push(loot3);
                }
            } else {
                // 普通敌人：[符文掉落] 三因子动态掉落率公式
                // 因子1：基础掉落率（随回合数线性增长，上限 40%）
                const BaseDropRate = Math.min(0.05 + (this.round / 10) * 0.05, 0.40);
                // 因子2：敌人数量修正（敌人越多，单个掉落率越低）
                const spawnedEnemiesInRound = this.spawnedEnemiesInRound || Math.max(1, this.enemies.length);
                const EnemyModifier = Math.max(0.3, 1.0 / Math.sqrt(spawnedEnemiesInRound));
                // 因子3：背包与网格占用率衰减（防溢出机制）
                const MAX_RUNE_CAPACITY = 20;
                const runesInGrid = (this.runeGrid || []).filter(r => r !== null).length;
                const OccupancyPenalty = Math.max(0.2, 1.0 - (this.runeInventory.length + runesInGrid) / MAX_RUNE_CAPACITY);
                // 最终掉落率
                const FinalDropRate = BaseDropRate * EnemyModifier * OccupancyPenalty;
                if (Math.random() < FinalDropRate) {
                    const dropResult = loot_calcRuneDrop(this);
                    if (dropResult.runeId) {
                        const loot = new RuneLoot(enemy.pos.x, enemy.pos.y, dropResult.runeId);
                        loot.level = dropResult.level;
                        this.runeLootItems.push(loot);
                    }
                }
            }
        }
        
        // 爆炸逻辑 (保留并增强视觉)
        if (config.explosive) {
            // --- 1. 解析爆炸主题 (Visual Theme Resolver) ---
            // 默认主题 (物理爆炸)
            let theme = {
                waveColor: '#ef4444',       // 冲击波颜色 (红)
                particleColor: '#f87171',   // 粒子颜色 (浅红)
                particleMode: 'spark',      // 粒子模式
                sound: 'explosion'          // (预留)
            };

            // 元素覆盖逻辑 (优先级：火 > 冰 > 电 > 毒/其他)
            if (config.pyro > 0) {
                theme.waveColor = '#f97316';      // 橙色冲击波
                theme.particleColor = '#fdba74';  // 橙黄火星
                theme.particleMode = 'spark';     // 火星四溅
            } else if (config.cryo > 0) {
                theme.waveColor = '#06b6d4';      // 青色冲击波 (寒气)
                theme.particleColor = '#a5f3fc';  // 冰蓝碎片
                theme.particleMode = 'shard';     // 冰渣飞溅
            } else if (config.lightning > 0) {
                theme.waveColor = '#c084fc';      // 紫色冲击波 (电磁脉冲)
                theme.particleColor = '#d8b4fe';  // 紫色电弧
                theme.particleMode = 'spark';     
            } else if (config.isMatryoshka) {
                theme.waveColor = '#d946ef';      // 粉色冲击波 (魔力)
                theme.particleColor = '#f5d0fe';
                theme.particleMode = 'normal';
            }

            // --- 2. 播放视觉特效 ---
            // 生成带有属性颜色的 Shockwave
            this.spawn_createShockwave(projectile.pos.x, projectile.pos.y, theme.waveColor); 
            
            // 生成对应的爆炸粒子群
            const particleCount = 12; // 爆炸产生的粒子数量
            for(let i=0; i < particleCount; i++) { 
                this.spawn_createParticle(projectile.pos.x, projectile.pos.y, theme.particleColor, theme.particleMode); 
            }

            // 如果是火焰爆炸，额外加一点黑烟，增加质感
            if (config.pyro > 0) {
                for(let i=0; i<5; i++) {
                    this.spawn_createParticle(projectile.pos.x, projectile.pos.y, 'rgba(0,0,0,0.5)', 'smoke');
                }
            }
            
            // 播放音效
            audio.playExplosion();

            // --- 3. 造成范围伤害与效果 ---
            this.enemies.forEach(other => {
                // 排除自身 & 距离检测 (爆炸半径 100)
                if (other !== enemy && other.active && projectile.pos.dist(other.pos) < 100 * (config._explosionRadiusMult || 1.0)) { 
                    
                    // 造成 AOE 伤害 (减半)
                    const aoeDmg = dmg * 0.5;
                    const k = other.takeDamage(aoeDmg); 
                    this.combat_recordDamage(aoeDmg, 'explosive', 'main', shotId); 
                    if (k) this.spawn_addScore(other.maxHp); 
                    
                    // --- 4. 关键：AOE 也要施加元素效果 ---
                    // 这样爆炸范围内的敌人也会被冰冻/点燃，符合直觉
                    if (config.cryo > 0) {
                        // 范围冰冻效果稍弱 (0.5倍)
                        other.applyTemp(-CONFIG.balance.cryoAmount * config.cryo * 0.5);
                        // 视觉反馈：给被波及的敌人也冒一点冷气
                        if (Math.random() < 0.3) this.spawn_createParticle(other.pos.x, other.pos.y, '#a5f3fc', 'smoke');
                    }
                    if (config.pyro > 0) {
                        other.applyTemp(CONFIG.balance.pyroAmount * config.pyro * 0.5);
                    }
                    if (config.lightning > 0) {
                        other.applyTemp(10 * config.lightning * 0.5);
                        // 闪电链通常只由直接击中触发，这里不触发链式，只加温度/易伤
                    }
                }
            });
        }
    },
    
    // [已迁移至 src/combat/damage_calc.js] combat_triggerChromaticAberration
    // CRT 色差效果触发 —— 通过文件底部的 Object.assign(combat_system, DamageCalc) 注入
    // [Task 3.2 已完成] combat_triggerChromaticAberration 已在 damage_calc.js 中改为 EventBus 事件
    // [已迁移至 src/combat/damage_calc.js] combat_recordDamage
    // 伤害记录与统计汇总 —— 通过文件底部的 Object.assign(combat_system, DamageCalc) 注入

    // [已迁移至 src/combat/damage_calc.js] combat_lightning_triggerChain
    // 闪电链触发逻辑 —— 通过文件底部的 Object.assign(combat_system, DamageCalc) 注入

    /**
     * @method fireNextShot
     * @description 发射下一发弹丸 (处理多重射击)。
     * @param {Vec2} vel - **重要参数** 初始速度向量。
     */
    combat_fireNextShot(vel) {
        if (this.ammoQueue.length === 0) return;
        
        // 标记首发子弹
        if (this._roundFirstShotId === null) {
            this._roundFirstShotId = this.shotIdCounter;
        }

        // [修复] 递归提取套娃配方，并确保使用深拷贝防止后续逻辑修改原始配方
        const pullNext = () => {
            if (this.ammoQueue.length === 0) return null;
            let r = this.ammoQueue.shift();
            // 深拷贝配方对象，防止引用污染
            const recipeCopy = JSON.parse(JSON.stringify(r));
            if (recipeCopy.isMatryoshka) {
                const nextR = pullNext();
                if (nextR) recipeCopy.nestedPayload = nextR;
            }
            return recipeCopy;
        };
        const finalRecipe = pullNext();
        if (!finalRecipe) return;

        // --- [符文词条系统] 将 activeRunewordStats 加成叠加到当前弹药配方 ---
        if (this.activeRunewordStats && typeof this.activeRunewordStats === 'object') {
            for (const [key, val] of Object.entries(this.activeRunewordStats)) {
                if (typeof val === 'number' && val !== 0) {
                    if (key === 'damage') {
                        // damage 直接加到基础伤害
                        finalRecipe.damage = (finalRecipe.damage || 0) + val;
                    } else if (key === 'bounce') {
                        finalRecipe.bounce = (finalRecipe.bounce || 0) + val;
                    } else if (key === 'pierce') {
                        finalRecipe.pierce = (finalRecipe.pierce || 0) + val;
                    } else if (key === 'scatter') {
                        finalRecipe.scatter = (finalRecipe.scatter || 0) + val;
                    } else if (key === 'pyro') {
                        finalRecipe.pyro = (finalRecipe.pyro || 0) + val;
                    } else if (key === 'cryo') {
                        finalRecipe.cryo = (finalRecipe.cryo || 0) + val;
                    } else if (key === 'lightning') {
                        finalRecipe.lightning = (finalRecipe.lightning || 0) + val;
                    } else if (key === 'laser') {
                        finalRecipe.laser = (finalRecipe.laser || 0) + val;
                        if (finalRecipe.laser > 0) finalRecipe.isLaser = true;
                    } else {
                        // 其他数値属性通用叠加
                        if (typeof finalRecipe[key] === 'number' || finalRecipe[key] === undefined) {
                            finalRecipe[key] = (finalRecipe[key] || 0) + val;
                        }
                    }
                }
            }
        }
        
        // --- [符文基础属性] 将 calcRuneBaseStats() 的基础属性层数叠加到当前弹药配方 ---
        if (this.runeGrid && Array.isArray(this.runeGrid)) {
            const baseStats = calcRuneBaseStats(this.runeGrid, RUNE_DB);
            for (const [key, val] of Object.entries(baseStats)) {
                if (typeof val === 'number' && val > 0) {
                    if (key === 'laser') {
                        finalRecipe.laser = (finalRecipe.laser || 0) + val;
                        if (finalRecipe.laser > 0) finalRecipe.isLaser = true;
                    } else {
                        finalRecipe[key] = (finalRecipe[key] || 0) + val;
                    }
                }
            }
        }

        // --- [炼金火药管] 平坦伤害加成 ---
        if (this.flatDamageBonus && this.flatDamageBonus > 0) {
            finalRecipe.damage = (finalRecipe.damage || 0) + this.flatDamageBonus;
        }

        // --- [符文词条-A] 核心战斗发射流拦截逻辑 ---
        if (this.activeRunewordEffects) {

            // 1. 嗜血初锋 (bloodthirst_growth)
            // 读取本局击杀累计数，将 damagePerKill * killCount 加到 flatDamageBonus
            // 同时将冰霜（cryo）和火焰（pyro）属性层数乘以 (1 - elementPenalty)
            const bloodthirstFx = this.activeRunewordEffects['bloodthirst_growth'];
            if (bloodthirstFx) {
                const { damagePerKill, elementPenalty } = bloodthirstFx.params;
                const killCount = this.runewordKillCount || 0;
                if (killCount > 0 && damagePerKill > 0) {
                    finalRecipe.damage = (finalRecipe.damage || 0) + damagePerKill * killCount;
                }
                if (elementPenalty > 0) {
                    if (finalRecipe.cryo > 0) {
                        finalRecipe.cryo = Math.max(0, Math.floor(finalRecipe.cryo * (1 - elementPenalty)));
                    }
                    if (finalRecipe.pyro > 0) {
                        finalRecipe.pyro = Math.max(0, Math.floor(finalRecipe.pyro * (1 - elementPenalty)));
                    }
                }
            }

            // 2. 散射矩阵 (multicast_to_scatter)
            // 将 finalRecipe.multicast 全部转移到 finalRecipe.scatter
            // 将 finalRecipe.damage 乘以 (1 - damagePenalty)
            // 将 _scatterAngleMultiplier = angleMultiplier 写入配方
            const scatterMatrixFx = this.activeRunewordEffects['multicast_to_scatter'];
            if (scatterMatrixFx) {
                const { damagePenalty, angleMultiplier } = scatterMatrixFx.params;
                const multicastToTransfer = finalRecipe.multicast || 0;
                if (multicastToTransfer > 0) {
                    finalRecipe.scatter = (finalRecipe.scatter || 0) + multicastToTransfer;
                    finalRecipe.multicast = 0;
                }
                if (damagePenalty > 0) {
                    finalRecipe.damage = Math.ceil((finalRecipe.damage || 1) * (1 - damagePenalty));
                }
                finalRecipe._scatterAngleMultiplier = angleMultiplier;
            }

            // 3. 专注射击 (focused_fire)
            // 将 finalRecipe.bounce 和 finalRecipe.multicast 累加到 finalRecipe.damage（每层 +1 伤害），然后清零
            // 将 critChance 和 critDamage 写入 finalRecipe._critChance 和 finalRecipe._critDamage
            const focusedFireFx = this.activeRunewordEffects['focused_fire'];
            if (focusedFireFx) {
                const { critChance, critDamage } = focusedFireFx.params;
                const bounceLayers = finalRecipe.bounce || 0;
                const multicastLayers = finalRecipe.multicast || 0;
                if (bounceLayers > 0 || multicastLayers > 0) {
                    finalRecipe.damage = (finalRecipe.damage || 0) + bounceLayers + multicastLayers;
                    finalRecipe.bounce = 0;
                    finalRecipe.multicast = 0;
                }
                finalRecipe._critChance = critChance;
                finalRecipe._critDamage = critDamage;
            }

            // 4. 质量坍缩 (mass_collapse)
            // 计算 layersCleared = multicast + scatter，清零两者
            // 设置 finalRecipe.explosive = true
            // 将 _explosionRadiusMult = baseRadiusRatio + layersCleared * radiusBonusPerLayer 写入配方
            const massCollapseFx = this.activeRunewordEffects['mass_collapse'];
            if (massCollapseFx) {
                const { baseRadiusRatio, radiusBonusPerLayer } = massCollapseFx.params;
                const layersCleared = (finalRecipe.multicast || 0) + (finalRecipe.scatter || 0);
                finalRecipe.multicast = 0;
                finalRecipe.scatter = 0;
                finalRecipe.explosive = true;
                finalRecipe._explosionRadiusMult = baseRadiusRatio + layersCleared * radiusBonusPerLayer;
            }

            // 5. 动能衰变 (kinetic_decay)
            // 将 initialBonus 和 decayPerHit 写入 finalRecipe._kineticDecayBonus 和 finalRecipe._kineticDecayRate
            const kineticDecayFx = this.activeRunewordEffects['kinetic_decay'];
            if (kineticDecayFx) {
                const { initialBonus, decayPerHit } = kineticDecayFx.params;
                finalRecipe._kineticDecayBonus = initialBonus;
                finalRecipe._kineticDecayRate = decayPerHit;
            }

            // 6. 回响射击 (echo_shot)
            // 将 triggerChance 写入 finalRecipe._echoShotChance
            const echoShotFx = this.activeRunewordEffects['echo_shot'];
            if (echoShotFx) {
                const { triggerChance } = echoShotFx.params;
                finalRecipe._echoShotChance = triggerChance;
            }
        }
        // --- [符文词条-A] 拦截逻辑结束 ---

        // --- [绝境之刃] 距离失败线越近，伤害加成越高 ---
        if (this.ownedRelics && this.ownedRelics.includes('desperation_blade')) {
            const desperationMult = this._calcDesperationMult();
            if (desperationMult > 1.0) {
                finalRecipe.damage = Math.ceil((finalRecipe.damage || 1) * desperationMult);
                finalRecipe._desperationMult = desperationMult; // 保存之前以供调试
            }
        }

        // --- [Task 3.2] 触发UI动画 - 改为 EventBus 事件，由 hud.js 监听 ---
        eventBus.emit(EVENT_TYPES.UI_AMMO_FIRED, {});
        this.ui_renderRecipeHUD();
        
        // [修复] 为这次发射创建独立的shotId
        const shotId = this.shotIdCounter++;
        this.shotDamageMap.set(shotId, { total: 0, byAttr: {}, projectileCount: 0, destroyedCount: 0 });
        
        // 基础射击
        // 如果没有多重射击，那么这第一发就是最后一发
        // [修改] 风属性子弹也强制单发，不受 multicast 影响
        const isOnlyOne = !(finalRecipe.multicast > 0 && finalRecipe.type != 'flying_sword' && !finalRecipe.wind);
        this.burstQueue.push({ delay: 0, vel: vel, recipe: finalRecipe, shotId: shotId, isLast: isOnlyOne }); 
        
        // 多重射击
        if (finalRecipe.multicast > 0 && finalRecipe.type != 'flying_sword' && !finalRecipe.wind) {
            for(let i=1; i<=finalRecipe.multicast; i++) { 
                const isLastInBurst = (i === finalRecipe.multicast);
                this.burstQueue.push({ delay: i * 20, vel: vel, recipe: finalRecipe, shotId: shotId, isLast: isLastInBurst }); 
            } 
        } 
    },

/**
     * @method combat_laser_fire
     * @description 发射激光束，进行射线检测、穿透伤害和折射处理。
     *
     *   折射机制（Refraction）：
     *     - 激光击中普通敌人后，有概率触发折射，消耗 1 层 bounce 属性。
     *     - 折射光线从命中点出发，指向折射搜寻半径内的随机敌人。
     *     - 折射光线继承剩余长度，伤害和宽度按配置系数衰减。
     *     - 采用队列（BFS）而非递归，避免栈溢出，并受最大折射总次数限制。
     *
     * @param {number} startX - 激光起点 X
     * @param {number} startY - 激光起点 Y
     * @param {Vec2} vel - 初始速度向量（用于确定方向）
     * @param {Object} recipe - 子弹配方
     * @param {string|null} shotId - 本次发射的统计 ID
     */
    combat_laser_fire(startX, startY, vel, recipe, shotId = null) {
        // [统计] 激光是即时的，手动增加计数并在完成后减少
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            this.shotDamageMap.get(shotId).projectileCount++;
        }

        // ─────────────────────────────────────────────────────────────────
        // [照射词条 / 炽热光线词条] 持续照射模式：启动状态机，每 0.5s 重新计算一次激光
        // 只在「首次发射」时启动（非持续照射内部的重算调用）
        // irradiation：激光变为持续照射，累积伤害加深
        // blazing_beam：激光变为持续升温模式，每 0.5s 额外提升敌人温度
        // ─────────────────────────────────────────────────────────────────
        const irradiationFx = this.activeRunewordEffects && this.activeRunewordEffects['irradiation'];
        const blazingBeamFxForLaser = this.activeRunewordEffects && this.activeRunewordEffects['blazing_beam'];
        if ((irradiationFx || blazingBeamFxForLaser) && !this._continuousLaserFiring) {
            this._continuousLaserFiring = true;
            this._continuousLaserState = {
                startX, startY, vel, recipe,
                tickFrames: 0,
                tickInterval: Math.round(0.5 * 60), // 0.5s = 30帧
                totalDuration: Math.round(3.0 * 60), // 持续 3s = 180帧
                elapsedFrames: 0,
                shotId,
                lastHitEnemy: null  // [照射词条] 记录上一次命中的敌人，用于检测目标切换时重置 _irradiationStacks
            };
            // isVisualEffectActive 由持续照射状态机维持，不再用 setTimeout 清除
        }

        // --- 1. 参数计算 ---
        this.isVisualEffectActive = true;
        // [射程] 基础 500 * 1.35 + 每层穿透 250 (决定光线能跑多远)
        const maxLen = (500 * 1.35) + (recipe.pierce * 250) + (CONFIG.gameplay.laserLengthBonus || 0);

        // [粗细] 基础 3px + 每层激光 4px + 爆破加成 (决定光线视觉宽度)
        const mainWidth = 3 + (recipe.laser * 4) + (recipe.explosive ? 10 : 0);

        // [颜色] 优先级：爆破 > 元素 > 默认蓝
        let color = '#0ea5e9';
        if (recipe.pyro > 0) color = '#f97316';
        else if (recipe.cryo > 0) color = '#06b6d4';
        else if (recipe.lightning > 0) color = '#d8b4fe';
        else if (recipe.explosive) color = '#ef4444';

        // --- 2. 队列式射线处理（主射线 + 折射链）---
        // 已命中敌人集合：整条折射链共享，防止同一敌人被重复折射
        const hitEnemiesSet = new Set();
        // 最大折射总次数限制（防止极端情况导致性能问题）
        const maxRefractionTotal = CONFIG.gameplay.laserRefractionMaxTotal || 50;
        let refractionCount = 0;

        // 所有射线的路径点集合，用于批量绘制
        // 每条折射光线单独绘制，以支持不同宽度
        const beamsToRender = [];

        // 初始化任务队列：主射线
        const laserQueue = [{
            startPos: new Vec2(startX, startY),
            dir: vel.norm(),
            remainLen: maxLen,
            recipe: recipe,
            bouncesLeft: recipe.bounce || 0,
            width: mainWidth,
            isMain: true,
            refractionDepth: 0   // 主射线深度为 0
        }];

        while (laserQueue.length > 0) {
            const task = laserQueue.shift();
            let { startPos, dir, remainLen, recipe: taskRecipe, bouncesLeft, width, isMain, refractionDepth = 0 } = task;

            let points = [startPos];
            let currPos = startPos;
            let currDir = dir;

            // 单条射线的射线追踪循环
            while (remainLen > 0) {
                // A. 寻找最近的反射面（墙壁或护盾敌人）
                const hitResult = this.combat_laser_castRay(currPos, currDir, remainLen);

                // B. 结算这一段路径
                const segmentLen = hitResult.dist;
                const nextPos = currPos.add(currDir.mult(segmentLen));

                // C. 伤害路径上的普通敌人，并尝试触发折射
                if (refractionCount < maxRefractionTotal) {
                    const penetrationResult = this.combat_laser_processPenetration(
                        currPos, nextPos, taskRecipe,
                        remainLen, bouncesLeft, hitEnemiesSet, width, refractionDepth
                    );
                    // 接收折射任务并加入队列
                    if (penetrationResult.refractionTasks && penetrationResult.refractionTasks.length > 0) {
                        for (const rfTask of penetrationResult.refractionTasks) {
                            if (refractionCount < maxRefractionTotal) {
                                laserQueue.push(rfTask);
                                refractionCount++;
                            }
                        }
                        // 同步更新当前射线的剩余反弹次数
                        bouncesLeft = penetrationResult.bouncesLeft;
                    }
                } else {
                    // 已达折射上限，仅处理穿透伤害，不再生成折射
                    this.combat_laser_processPenetration(
                        currPos, nextPos, taskRecipe,
                        0, 0, hitEnemiesSet, width, refractionDepth
                    );
                }

                // 记录路径点
                points.push(nextPos);
                remainLen -= segmentLen;
                currPos = nextPos;

                // D. 处理撞击结果（墙壁/护盾镜面反射，仍消耗 bounce）
                if (hitResult.hitType === 'none') {
                    break;
                } else {
                    if (bouncesLeft <= 0) {
                        // 反弹次数耗尽，光线终止
                        this.spawn_createParticle(nextPos.x, nextPos.y, color, 'spark');
                        break;
                    }
                    bouncesLeft--;

                    if (hitResult.hitType === 'wall') {
                        audio.playHit('bounce');
                        this.spawn_createParticle(nextPos.x, nextPos.y, color, 'spark');
                    } else if (hitResult.hitType === 'shield') {
                        this.combat_damageEnemy(hitResult.enemy, { config: taskRecipe, pos: nextPos, isCopy: false });
                        audio.playHit('bounce');
                        this.spawn_createParticle(nextPos.x, nextPos.y, '#3b82f6', 'spark');
                    }

                    // 镜面反射方向
                    if (hitResult.normal === 'x') currDir = new Vec2(-currDir.x, currDir.y);
                    else currDir = new Vec2(currDir.x, -currDir.y);
                }
            }

            // 收集本条射线的绘制信息
            beamsToRender.push({ points, width, isMain });
        }

        // --- 3. 生成视觉与音效 ---
        // 绘制所有射线（主射线 + 折射链）
        for (const beam of beamsToRender) {
            // 折射光线颜色略微偏绿（混入 bounce 属性的绿色），主射线保持原色
            const beamColor = beam.isMain ? color : this._laser_blendRefractionColor(color);
            this.spawn_pushParticleWithLimit(new LaserBeam(beam.points, beam.width, beamColor));
        }

        // 音效：越粗越低沉
        audio.playTone(Math.max(100, 800 - mainWidth * 20), 'sawtooth', 0.15, 0.2 + mainWidth * 0.01);
        // [照射词条] 持续照射模式下，isVisualEffectActive 由状态机维持，不在此清除
        if (!this._continuousLaserFiring) {
            setTimeout(() => {
                this.isVisualEffectActive = false;
            }, 600);
        }

        // [统计] 激光发射完成，增加销毁计数以触发统计保存
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            const shotStats = this.shotDamageMap.get(shotId);
            shotStats.destroyedCount++;
            if (shotStats.destroyedCount >= shotStats.projectileCount && shotStats.total > 0) {
                this.shotDamageHistory.push({
                    total: shotStats.total,
                    byAttr: JSON.parse(JSON.stringify(shotStats.byAttr))
                });
                if (this.shotDamageHistory.length > 10) this.shotDamageHistory.shift();
                this.ui_updateDamageStats();
                this.shotDamageMap.delete(shotId);
            }
        }
    },

    /**
     * @method combat_continuousLaser_update
     * @description 持续照射状态机的每帧驱动函数。
     *   由 game_phase.js 的 combat update 循环调用。
     *   每 0.5s（30帧）重新执行一次 combat_laser_fire 进行伤害计算和视觉刷新。
     *   持续 3s 后自动结束，清理状态并释放 isVisualEffectActive。
     *   触发条件：irradiation 词条（持续照射累积伤害）或 blazing_beam 词条（持续升温）激活时启动。
     * @param {number} timeScale - 当前帧时间缩放（通常为 1）
     */
    // --- [修复] 剑刃风暴定期更新逻辑 ---
    combat_bladeStorm_update(timeScale) {
        const bladeStormFx = this.activeRunewordEffects && this.activeRunewordEffects['blade_storm'];
        if (!bladeStormFx) return;

        // 寻找首个子弹：在 projectiles 中查找 shotId 等于 _roundFirstShotId 且不是分裂副子弹的主子弹
        let targetProj = this._bladeStormProjectile;
        if (!targetProj || !targetProj.active || targetProj.destroyed) {
            targetProj = this.projectiles.find(p => p.shotId === this._roundFirstShotId && !p.isCopy);
            if (targetProj) {
                this._bladeStormProjectile = targetProj;
            } else {
                return; // 首个子弹已消失或未生成
            }
        }

        const radius = (bladeStormFx.params && bladeStormFx.params.radius) || 120;
        const damageRatio = (bladeStormFx.params && bladeStormFx.params.damageRatio) || 0.6;
        const interval = Math.max(0.1, (bladeStormFx.params && bladeStormFx.params.interval) || 0.5);

        this._bladeStormTimer = (this._bladeStormTimer || 0) + timeScale;
        // 60帧 = 1秒
        if (this._bladeStormTimer >= interval * 60) {
            this._bladeStormTimer = 0;

            const baseDmg = targetProj.config ? targetProj.config.damage : 2;
            const slashDmg = Math.ceil(baseDmg * damageRatio);

            let hitAny = false;
            this.enemies.forEach(e => {
                if (!e.active) return;
                if (targetProj.pos.dist(e.pos) < radius) {
                    const slashResult = e.takeDamage(slashDmg);
                    this.combat_recordDamage(slashResult.actualDamage, 'wind', 'main', targetProj.shotId);
                    this.spawn_createFloatingText(e.pos.x, e.pos.y - 20, `风斩+${Math.ceil(slashResult.actualDamage)}`, '#34d399');
                    hitAny = true;
                }
            });

            // 视觉特效：如果有敌人被斩击，或者只要触发就显示
            if (hitAny) {
                const angle = Math.random() * Math.PI * 2;
                if (typeof SlashAnim !== 'undefined') {
                    this.spawn_pushParticleWithLimit(new SlashAnim(targetProj.pos.x, targetProj.pos.y, angle, 0.35, '#34d399'));
                }
            }
        }
    }

    combat_continuousLaser_update(timeScale = 1) {
        if (!this._continuousLaserFiring || !this._continuousLaserState) return;

        const state = this._continuousLaserState;
        state.elapsedFrames += timeScale;
        state.tickFrames += timeScale;

        // 维持 isVisualEffectActive 为 true（阻止回合结束判定）
        this.isVisualEffectActive = true;

        // 每 tickInterval 帧重新计算一次激光（伤害 + 视觉）
        if (state.tickFrames >= state.tickInterval) {
            state.tickFrames = 0;
            // 重新执行激光射线计算（_continuousLaserFiring 已为 true，不会再次启动状态机）
            this.combat_laser_fire(state.startX, state.startY, state.vel, state.recipe, state.shotId);
        }

        // 持续时间结束，清理状态
        if (state.elapsedFrames >= state.totalDuration) {
            this._continuousLaserFiring = false;
            this._continuousLaserState = null;
            // 重置所有敌人的照射叠加层数
            this.enemies.forEach(e => { if (e._irradiationStacks) e._irradiationStacks = 0; });
            // 延迟 600ms 释放 isVisualEffectActive（等待最后一帧激光视觉消失）
            setTimeout(() => {
                this.isVisualEffectActive = false;
            }, 600);
        }
    },

    /**
     * @method _laser_blendRefractionColor
     * @description 将激光颜色与折射绿色（bounce 属性色）混合，用于区分折射光线。
     *   混合比例：原色 70% + 绿色 30%，保持视觉辨识度的同时体现折射特性。
     * @param {string} baseColor - 原始激光颜色（hex 格式）
     * @returns {string} 混合后的颜色（hex 格式）
     */
    _laser_blendRefractionColor(baseColor) {
        // 将 hex 颜色解析为 RGB
        const parseHex = (hex) => {
            const h = hex.replace('#', '');
            return [
                parseInt(h.substring(0, 2), 16),
                parseInt(h.substring(2, 4), 16),
                parseInt(h.substring(4, 6), 16)
            ];
        };
        const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
        try {
            const [r1, g1, b1] = parseHex(baseColor);
            // 折射绿色（bounce 属性颜色 #22c55e）
            const [r2, g2, b2] = [34, 197, 94];
            return toHex(r1 * 0.7 + r2 * 0.3, g1 * 0.7 + g2 * 0.3, b1 * 0.7 + b2 * 0.3);
        } catch (e) {
            return baseColor;
        }
    },

    // [已迁移至 src/combat/collision.js] combat_laser_castRay
    // 激光射线检测（墙壁反射面 + 护盾敌人）—— 通过文件底部的 Object.assign(combat_system, CollisionSystem) 注入

    // [已迁移至 src/combat/collision.js] combat_laser_processPenetration
    // 激光穿透伤害处理（线段与敌人碰撞）—— 通过文件底部的 Object.assign(combat_system, CollisionSystem) 注入

/**
    /**
     * @method updateHitProgress
     * @description 更新命中进度条UI。
     * @param {number} val - **重要参数** 当前命中次数。
     * @param {number} target - **重要参数** 目标命中次数。
     */
    combat_updateHitProgress(val, target) { 
        // [Task 3.2] 改为 EventBus 事件，由 hud.js 监听并更新命中进度条 DOM
        eventBus.emit(EVENT_TYPES.UI_HIT_PROGRESS, { val, target });
    },

    // ==================== 充能符文系统 ====================

    /**
     * @method combat_runeCharge_init
     * @description 初始化充能符文系统状态（战斗阶段开始时调用）
     */
    combat_runeCharge_init() {
        this.runeChargeValue        = 0;    // 充能值 0~1，自动衰减
        this.runeChargeLevel        = 0;    // 当前充能满次数（每满一次+1，无上限）
        this.runeChargeCurrentRune  = null; // 当前预览符文（单个）
        this.runeChargeCurrentLevel = 1;    // 当前预览符文等级（新增，§8.5）
        this.combat_runeCharge_initUI();
    },

    /**
     * @method combat_runeCharge_initUI
     * @description 初始化充能符文UI（单符文槽，初始为空）
     */
    combat_runeCharge_initUI() {
        this.runeChargeCurrentRune = null; // 初始为空，不预生成
        // 通知 hud.js 初始化 UI（空状态）
        eventBus.emit(EVENT_TYPES.UI_RUNE_CHARGE_INIT, {
            runeDef: null
        });
    },

    /**
     * @method combat_runeCharge_onHit
     * @description 子弹击中敌人时调用，充能并概率翻倍
     * @param {number} hitX - 击中X坐标（保留参数，徽章已移除）
     * @param {number} hitY - 击中Y坐标
     * @param {boolean} isKill - 是否为击杀
     */
    combat_runeCharge_onHit(hitX, hitY, isKill = false) {
        // 基础充能量（击杀给更多充能）
        // 降低基数：击中 3%，击杀 10%（原来 6%/18%）
        const BASE_CHARGE = isKill ? 0.10 : 0.03;

        // 概率翻倍机制：x1/x2/x4/x8，概率降低
        // x1: 82%，x2: 13%，x4: 4%，x8: 1%（原来 65%/25%/8%/2%）
        const roll = Math.random();
        let multiplier = 1;
        if (roll < 0.01) {
            multiplier = 8;
        } else if (roll < 0.05) {
            multiplier = 4;
        } else if (roll < 0.18) {
            multiplier = 2;
        }

        const chargeAmount = BASE_CHARGE * multiplier;

        // 累加充能值
        this.runeChargeValue = Math.min(1.0, (this.runeChargeValue || 0) + chargeAmount);

        // 检查是否充能满 → 刷新符文预览
        if (this.runeChargeValue >= 1.0) {
            this.runeChargeValue = 0;
            this.combat_runeCharge_levelUp();
        }

        // 更新UI
        this.combat_runeCharge_updateUI();
    },

    /**
     * @method combat_runeCharge_levelUp
     * @description 充能条满，刷新当前预览符文（每次充满都会刷新一次符文）
     */
    combat_runeCharge_levelUp() {
        this.runeChargeLevel = (this.runeChargeLevel || 0) + 1;
        // 使用新充能抽取算法（修复 Bug：原调用 loot_calcRuneDrop 返回字符串，新接口返回对象）
        const { runeDef, runeLevel } = _runeCharge_draw(this.runeChargeLevel);
        this.runeChargeCurrentRune  = runeDef  || null;
        this.runeChargeCurrentLevel = runeLevel || 1;
        // 通知 hud.js 刷新符文槽（带特效）
        eventBus.emit(EVENT_TYPES.UI_RUNE_CHARGE_LEVEL_UP, {
            runeDef:   this.runeChargeCurrentRune,
            runeLevel: this.runeChargeCurrentLevel
        });
        // 音效反馈
        try { if (audio?.playTone) audio.playTone(520, 'sine', 0.1, 0.25); } catch(e) {}
    },

    /**
     * @method combat_runeCharge_decay
     * @description 充能条自动衰减（每帧调用）
     * @param {number} timeScale - 时间缩放
     */
    combat_runeCharge_decay(timeScale) {
        if (!this.runeChargeValue) return;
        // 衰减速度：每帧减少 0.003（约5秒内衰减完）
        const DECAY_RATE = 0.003;
        this.runeChargeValue = Math.max(0, this.runeChargeValue - DECAY_RATE * (timeScale || 1));
        this.combat_runeCharge_updateUI();
    },

    /**
     * @method combat_runeCharge_updateUI
     * @description 更新充能条UI
     */
    combat_runeCharge_updateUI() {
        // [Task 3.2] 改为 EventBus 事件，由 hud.js 监听并更新充能条宽度
        eventBus.emit(EVENT_TYPES.UI_RUNE_CHARGE_UPDATE, {
            value: this.runeChargeValue || 0
        });
    },

    // combat_runeCharge_showMultiplierBadge 已移除（翻倍徽章功能已废弃）

    /**
     * @method combat_runeCharge_claimReward
     * @description 战斗结束后领取当前预览符文（若有），并触发入背包动画
     */
    combat_runeCharge_claimReward() {
        const runeDef = this.runeChargeCurrentRune;
        if (!runeDef) return; // 未充能满过，无奖励

        // 使用动态等级入库（修复原硬编码 level: 1 的 Bug）
        const level = this.runeChargeCurrentLevel || 1;
        this.runeInventory.push({ id: runeDef.id, level });

        // 触发入背包动画事件（由 hud.js 处理 DOM 动画）
        eventBus.emit(EVENT_TYPES.UI_RUNE_CHARGE_CLAIM, {
            runeDef,
            level
        });

        // 音效
        try { if (audio?.playPowerup) audio.playPowerup(); } catch(e) {}

        // 重置充能状态
        this.runeChargeValue        = 0;
        this.runeChargeLevel        = 0;
        this.runeChargeCurrentRune  = null;
        this.runeChargeCurrentLevel = 1;
    },

    // =========================================
    // Boss 阶段变化系统
    // =========================================

    /**
     * @method combat_checkBossPhaseChange
     * @description 检测所有活跃 Boss 的阶段变化。
     * 当 Boss HP < 50% 且未狂暴时，触发狂暴阶段。
     * 应在每次伤害结算后调用。
     */
    combat_checkBossPhaseChange() {
        const bosses = this.enemies.filter(e => e.active && e.type === 'boss' && !e.berserked);
        for (const boss of bosses) {
            if (boss.hp <= boss.maxHp * 0.5) {
                this.combat_triggerBossEnrage(boss);
            }
        }
    },

    /**
     * @method combat_triggerBossEnrage
     * @description 触发 Boss 狂暴阶段。
     * 根据 Boss 类型应用不同的狂暴效果。
     * @param {Enemy} boss - 要狂暴的 Boss 实例
     */
    combat_triggerBossEnrage(boss) {
        if (boss.berserked) return; // 防止重复触发
        boss.berserked = true;

        const bossId = boss.bossType;
        const bossConfigs = CONFIG.balance.bossConfigs;
        const bossCfg = bossConfigs ? bossConfigs[bossId] : null;

        // 广播狂暴事件
        eventBus.emit(EVENT_TYPES.BOSS_PHASE_CHANGE, {
            boss: boss,
            bossId: bossId,
            bossName: boss.bossName,
            phase: 'berserk',
            round: this.round
        });

        // 视觉反馈
        this.spawn_createShockwave(boss.pos.x, boss.pos.y, '#ff0000');
        for (let i = 0; i < 15; i++) {
            this.spawn_createParticle(boss.pos.x, boss.pos.y, '#ff4444', 'spark');
        }
        this.spawn_createFloatingText(boss.pos.x, boss.pos.y - 40, '❗ENRAGE!', '#ff0000');
        showToast(`☠️ ${boss.bossName || 'Boss'} 进入狂暴阶段！`);

        if (!bossCfg) return;

        // 根据 Boss 类型应用狂暴效果
        switch (bossId) {
            case 'ignis':
                // 狂暴后护盾层数翻倍
                if (boss.affixes.includes('shield')) {
                    boss.shieldCharges = Math.floor(boss.shieldCharges * (bossCfg.berserkedShieldMult || 2));
                }
                // 狂暴后每回合温度急升标志
                boss._berserkedTempRise = bossCfg.berserkedTempRisePerTurn || 30;
                // 狂暴后火焰溅射标志（存储半径和伤害）
                boss._berserkedFireSplash = {
                    radius: bossCfg.berserkedFireSplashRadius || 80,
                    damage: bossCfg.berserkedFireSplashDamage || 5
                };
                break;

            case 'glacies':
                // 狂暴后每回合跳跃 3 行
                boss._berserkedJumpRows = bossCfg.berserkedJumpRows || 3;
                // 狂暴后跳跃落地时冻结周围 Peg
                boss._berserkedFreezePegs = true;
                break;

            case 'mikro':
                // 狂暴后分身概率 100%
                boss._berserkedCloneChance = bossCfg.berserkedCloneChance || 1.0;
                break;

            case 'devourer':
                // 狂暴后全屏吞噬
                boss._berserkedDevourRange = bossCfg.berserkedDevourRange || 99;
                break;

            case 'viridis':
                // 狂暴后放弃治疗他人，集中治疗自身并加速再生
                boss._berserkedHealerRange = 0; // 治疗范围设为 0，停止治疗其他敌人
                boss._berserkedSelfRegenMult = bossCfg.berserkedSelfRegenMult || 3.0; // 自身再生倍率
                break;

            case 'tesla':
                // 狂暴后行动次数再+1
                boss._berserkedActionsBonus = bossCfg.berserkedActionsBonus || 1;
                break;

            case 'chimera':
                // 狂暴后温度直接达到阈值
                boss.temp = bossCfg.berserkedTempThreshold || 100;
                // 记录受击触发全场爆炸概率
                boss._berserkedBlastOnHitChance = bossCfg.berserkedBlastOnHitChance || 0.25;
                break;

            case 'ouroboros':
                // 狂暴后词缀轮转加速：每回合切换
                boss._berserkedRotation = true;
                break;
        }
    },

    // ============================================================
    // [分级死亡特效系统] v2
    // 内部辅助方法，由 killed 分支调用
    // ============================================================
    /**
     * 触发敌人死亡特效
     * @param {Enemy} enemy - 死亡的敌人实例
     * @param {string} shotId - 弹丸射击 ID
     */
    _triggerDeathFX(enemy, shotId) {
        const x = enemy.pos.x;
        const y = enemy.pos.y;
        const tier = enemy.type; // 'normal' | 'elite' | 'boss'
        const isFrozen = enemy.temp <= -80;  // 冰冻状态门槛
        const isBurning = enemy.temp >= 100; // 燃烧状态门槛

        // --- 1. 冰冻状态死亡：冰晶碎片炸裂 ---
        if (isFrozen) {
            // 冰波扩散环
            if (!this.iceWaves) this.iceWaves = [];
            this.iceWaves.push(new IceWave(x, y));
            // 冰晶碎片爆发
            const shardCount = tier === 'boss' ? 20 : (tier === 'elite' ? 12 : 8);
            for (let i = 0; i < shardCount; i++) {
                const p = this.spawn_createParticle(x, y, '#bae6fd', 'shard');
                if (p) {
                    const angle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.4;
                    const speed = 3 + Math.random() * 4;
                    p.vel = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    p.size = 2 + Math.random() * 3;
                    p.scaleX = 0.4 + Math.random() * 0.6;
                    p.scaleY = 1.2 + Math.random() * 1.5;
                    p.decay = 0.018 + Math.random() * 0.015;
                }
            }
            // 冰雾扩散
            const mistCount = tier === 'boss' ? 10 : (tier === 'elite' ? 6 : 4);
            for (let i = 0; i < mistCount; i++) {
                this.spawn_createParticle(
                    x + (Math.random() - 0.5) * 20,
                    y + (Math.random() - 0.5) * 20,
                    'rgba(186,230,253,0.6)', 'mist'
                );
            }
            // 冰冻冲击波
            this.spawn_createShockwave(x, y, '#7dd3fc');
            // 冰冻音效
            audio.playEffect('shatter');
            this.spawn_createFloatingText(x, y - 24, '❄️SHATTER!', '#7dd3fc');
        }

        // --- 2. 燃烧状态死亡：火焰爆炸扩散 ---
        if (isBurning) {
            this.fireWaves.push(new FireWave(x, y));
            // 火焰燃烧爆炸粒子
            const emberCount = tier === 'boss' ? 25 : (tier === 'elite' ? 15 : 8);
            for (let i = 0; i < emberCount; i++) {
                this.spawn_createParticle(
                    x + (Math.random() - 0.5) * 15,
                    y + (Math.random() - 0.5) * 15,
                    '#f97316', 'ember'
                );
            }
            // 黑烟
            const smokeCount = tier === 'boss' ? 8 : (tier === 'elite' ? 5 : 3);
            for (let i = 0; i < smokeCount; i++) {
                this.spawn_createParticle(
                    x + (Math.random() - 0.5) * 20,
                    y - 10,
                    'rgba(0,0,0,0.5)', 'mist'
                );
            }
            // 燃烧扩散伤害
            audio.playExplosion();
            this.spawn_createFloatingText(x, y - 24, '🔥SPREAD!', '#f97316');
            this.enemies.forEach(other => {
                if (other.active && other !== enemy && enemy.pos.dist(other.pos) < CONFIG.gameplay.fireSpreadRadius) {
                    other.applyTemp(CONFIG.gameplay.fireSpreadTempIncrease);
                    const spreadDmg = enemy.maxHp * CONFIG.gameplay.fireSpreadDamagePercent;
                    other.takeDamage(spreadDmg);
                    this.combat_recordDamage(spreadDmg, 'pyro', 'main', shotId);
                }
            });
        }

        // --- 3. 分级死亡爆炸特效（在冰冻/燃烧特效之外叠加）---
        if (!this.deathExplosions) this.deathExplosions = [];

        if (tier === 'boss') {
            // Boss：内爆消散，先膨胀挥扎再塑陷
            this.deathExplosions.push(new DeathExplosion(x, y, 'boss'));
            // 少量向外漂出的灵魂烟雾（不是爆炸，而是最后挥扎时的气息）
            for (let i = 0; i < 8; i++) {
                const p = this.spawn_createParticle(
                    x + (Math.random() - 0.5) * 20,
                    y + (Math.random() - 0.5) * 20,
                    'rgba(252,165,165,0.6)', 'mist'
                );
                if (p) {
                    // 慢慢向外漂移，不是爆炸
                    const angle = Math.random() * Math.PI * 2;
                    p.vel = new Vec2(Math.cos(angle) * 0.6, Math.sin(angle) * 0.6 - 0.3);
                    p.decay = 0.012;
                    p.size = 10 + Math.random() * 8;
                }
            }
            // 屏幕震动（内爆感）
            this.triggerScreenShake(12);
            audio.playExplosion();

        } else if (tier === 'elite') {
            // 精英：能量环内缩 + 紫色灵魂烟雾
            this.deathExplosions.push(new DeathExplosion(x, y, 'elite'));
            // 紫色灵魂烟雾（向内漂移）
            for (let i = 0; i < 5; i++) {
                const p = this.spawn_createParticle(
                    x + (Math.random() - 0.5) * 30,
                    y + (Math.random() - 0.5) * 30,
                    'rgba(192,132,252,0.55)', 'mist'
                );
                if (p) {
                    const angle = Math.random() * Math.PI * 2;
                    p.vel = new Vec2(Math.cos(angle) * 0.4, Math.sin(angle) * 0.4 - 0.2);
                    p.decay = 0.018;
                    p.size = 8 + Math.random() * 6;
                }
            }
            this.triggerScreenShake(5);

        } else {
            // 普通敌人：内缩消散，极少的烟尘
            this.deathExplosions.push(new DeathExplosion(x, y, 'normal'));
            // 1~2 缕烟尘（不向外爆，而是小幅漂移）
            const dustCount = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < dustCount; i++) {
                const p = this.spawn_createParticle(
                    x + (Math.random() - 0.5) * 10,
                    y + (Math.random() - 0.5) * 10,
                    'rgba(148,163,184,0.4)', 'mist'
                );
                if (p) {
                    p.vel = new Vec2((Math.random() - 0.5) * 0.3, -0.2 - Math.random() * 0.3);
                    p.decay = 0.025;
                    p.size = 5 + Math.random() * 4;
                }
            }
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mixin 合并：将 DamageCalc 和 CollisionSystem 的方法注入到 combat_system
// 这样 Game 实例通过 Object.assign(this, combat_system) 后，
// 可以直接调用 this.combat_recordDamage / this.combat_tryMoveEnemy 等方法。
// ─────────────────────────────────────────────────────────────────────────────
Object.assign(combat_system, DamageCalc, CollisionSystem);
