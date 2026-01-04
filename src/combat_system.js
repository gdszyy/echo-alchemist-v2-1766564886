import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba 
} from './entities.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';

export const combat_system = {
/**
     * @method calculatePlayerExpectedDamage
     * @description 计算玩家当前弹药队列的平均预期伤害 (DDA 核心算法)
     */
    combat_calculatePlayerExpectedDamage() {
        if (this.ammoQueue.length === 0) return 0;

        // 1. 计算每一发弹药的单发期望评分 (Raw Score)
        // 公式: 伤害 * (1 + 连射数 + 特效加成)
        const scores = this.ammoQueue.map(recipe => {
            let specialBonus = 0;
            if (recipe.explosive) specialBonus += 2; // 爆炸权重 +2
            if (recipe.cryo > 0 || recipe.pyro > 0 || recipe.isLaser) specialBonus += 1; // 元素权重 +1
            
            // 基础伤害 * (1 (本体) + 连射次数 + 特效系数)
            // 注意：multicast 是额外发射次数，所以总量是 1 + multicast
            return (recipe.damage || 2) * (1 + (recipe.multicast || 0) + specialBonus);
        });

        // 如果样本太少 (<3)，直接算平均值，不进行统计学剔除
        if (scores.length < 3) {
            return scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        // 2. 排序并去除最高/最低值 (Trimmed Mean)
        scores.sort((a, b) => a - b);
        // 去掉第一个(最低)和最后一个(最高)
        const trimmedScores = scores.slice(1, scores.length - 1);

        // 3. 计算方差和标准差 (Variance Method)
        const n = trimmedScores.length;
        if (n === 0) return 0; // 防止切空

        const mean = trimmedScores.reduce((a, b) => a + b, 0) / n;
        const variance = trimmedScores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        // 4. 剔除离群值 (排除落在 Mean ± 1.5倍标准差 之外的数值)
        // 1.5倍标准差通常能涵盖大多数正常波动，排除极端运气值
        const filteredScores = trimmedScores.filter(val => Math.abs(val - mean) <= (stdDev * 1.5 || 1)); // ||1 防止标准差为0

        // 5. 计算最终平均值
        if (filteredScores.length === 0) return mean; // 如果全被剔除了(极其罕见)，返回修剪后的平均值
        
        const finalAverage = filteredScores.reduce((a, b) => a + b, 0) / filteredScores.length;
        
        console.log(`[DDA] 战力评估 -> 原始: ${scores.length}, 过滤后: ${filteredScores.length}, 最终评分: ${finalAverage.toFixed(1)}`);
        return finalAverage;
    },

// 1. 汇报伤害（供敌人受伤时调用）
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_reportDamage.
     * @param {any} amount - TODO: Describe this parameter.
     */
    combat_reportDamage(amount) {
        this.frameDamageAccumulator += amount;
    },

/**
     * @method combat_createFloatingText
     * @description 兼容旧代码的浮动文字方法
     */
    combat_createFloatingText(x, y, text, color) {
        this.spawn_createFloatingText(x, y, text, color);
    },

// --- [新增] 更新連射倍率 UI ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_updateMulticastDisplay.
     * @param {any} bonusAmount - TODO: Describe this parameter.
     */
    combat_updateMulticastDisplay(bonusAmount = 0) {
        // 基礎是 1，加上當前累積的 multicast
        const total = 1 + (this.currentSession ? this.currentSession.multicast : 0);
        
        const ui = document.getElementById('multicast-ui');
        const num = document.getElementById('multicast-num');
        
        if (ui && num) {
            // 顯示 UI
            ui.classList.add('multicast-visible');
            
            // 更新數字
            num.innerText = `x${total}`;
            
            // 如果有增加 (bonusAmount > 0)，播放特效
            if (bonusAmount > 0) {
                // 1. 容器彈跳
                ui.classList.remove('multicast-pop');
                void ui.offsetWidth; // 重繪
                ui.classList.add('multicast-pop');
                
                // 2. 文字閃白
                num.classList.add('multicast-flash');
                setTimeout(() => num.classList.remove('multicast-flash'), 300);
            }
        }
    },

// --- [新增] 播放倍率轉移飛行特效 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_playMulticastTransferEffect.
     * @param {any} multicastValue - TODO: Describe this parameter.
     */
    combat_playMulticastTransferEffect(multicastValue) {
        // 1. 獲取起點 (右下角倍率 UI)
        const startEl = document.getElementById('multicast-ui');
        // 2. 獲取終點 (左側當前配方卡片)
        // 注意：activeMarbleIndex 對應的是 gathering-hud-mount 裡的第 N 個子元素
        const targetEl = document.querySelector(`#gathering-hud-mount .recipe-card:nth-child(${this.activeMarbleIndex + 1})`);

        if (!startEl || !targetEl) return;

        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // 3. 創建飛行元素
        const flyer = document.createElement('div');
        flyer.className = 'flying-badge';
        flyer.innerText = `x${multicastValue}`;
        
        // 初始位置 (設置在起點)
        // 計算中心點偏移
        const startX = startRect.left + startRect.width / 2 - 20; // 20是寬度的一半
        const startY = startRect.top + startRect.height / 2 - 20;
        
        flyer.style.left = `${startX}px`;
        flyer.style.top = `${startY}px`;
        flyer.style.transform = 'scale(1.2)'; // 起飛時稍微放大

        document.body.appendChild(flyer);

        // 4. 執行飛行 (下一幀設置終點位置以觸發 transition)
        requestAnimationFrame(() => {
            const targetX = targetRect.left + targetRect.width / 2 - 20;
            const targetY = targetRect.top + targetRect.height / 2 - 20;

            flyer.style.left = `${targetX}px`;
            flyer.style.top = `${targetY}px`;
            flyer.classList.add('arrived'); // 配合 CSS 變小變淡
        });

        // 5. 飛行結束後清理並觸發卡片高亮
        setTimeout(() => {
            flyer.remove();
            
            // 讓目標卡片閃一下，表示接收到了倍率
            targetEl.style.transition = 'none';
            targetEl.style.filter = 'brightness(2) drop-shadow(0 0 10px orange)';
            targetEl.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                targetEl.style.transition = 'all 0.3s';
                targetEl.style.filter = 'none';
                targetEl.style.transform = 'scale(1)';
            }, 100);

            // 播放音效
            audio.playCollect(); 
        }, 600); // 這裡的時間要和 CSS transition 匹配
    },

// 在 Game 类中
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_activateSkill.
     * @param {any} skill - TODO: Describe this parameter.
     */
    combat_activateSkill(skill) {
        if (this.phase !== 'combat' || this.isEnemyTurn || this.skillPoints < skill.cost) return;

        // 1. 扣除消耗
        this.skillPoints -= skill.cost;
        this.ui.updateSkillPoints(this.skillPoints);
        this.ui.updateSkillBar(this.skillPoints);
        
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
            document.getElementById('game-container').classList.add('shake-hard');
            setTimeout(() => document.getElementById('game-container').classList.remove('shake-hard'), 200);
        } 
        else if (method === 'chain_lightning_all') {
            // === [新增] 全屏闪电链逻辑 ===
            const dmg = p.baseDmg + (this.round * p.roundMult);
            
            // 视觉：全屏微闪
            const flash = document.createElement('div');
            flash.className = 'absolute inset-0 z-50 pointer-events-none transition-opacity duration-200';
            flash.style.backgroundColor = p.flashColor;
            document.body.appendChild(flash);
            setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 200); }, 50);
            document.getElementById('game-container').classList.add('shake-hard');
            setTimeout(() => document.getElementById('game-container').classList.remove('shake-hard'), 200);
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
                    // 如果是 damage, scatter, bounce 等数值属性，直接累加
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
                this.ui.updateSkillBar(this.skillPoints);
                showToast("無彈藥可強化");
            }
        }
    },

/**
     * [AUTO-GENERATED] TODO: Add a description for combat_assignSwordTarget.
     * @param {any} enemy - TODO: Describe this parameter.
     */
    combat_flyingSword_assignTarget(enemy) {
        // 遍历所有存活的子剑 (不包括充当标记的母剑)
        this.sonSwords.forEach(sword => {
            if (sword.active && !sword.isMotherBlade) {
                sword.addTarget(enemy);
            }
        });
    },

// --- 新增方法：添加子剑 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_addSonSword.
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

                for(let i=0; i<tickCount; i++) {
                    setTimeout(() => {
                        // 每一段伤害使用独立的 shotId 确保不被过滤
                        const currentTickShotId = this._currentDamageShotId ? `${this._currentDamageShotId}_strangle_${i}` : `strangle_${Date.now()}_${i}`;
                        
                        this.enemies.forEach(e => {
                            if (e.active && e.pos.x > expandedX && e.pos.x < expandedX + expandedW && e.pos.y > expandedY && e.pos.y < expandedY + expandedH) {
                                let dmg = tickDmg;
                                // 属性联动逻辑保持
                                if (e.temp >= 100) { 
                                    dmg *= 2; 
                                    e.applyTemp(-50); 
                                    this.spawn_createFloatingText(e.pos.x, e.pos.y, "🔥火旋风", "#f97316"); 
                                    for(let k=0; k<30; k++) {
                                        const angle = Math.random() * Math.PI * 2;
                                        const radius = Math.random() * 100;
                                        const px = centerX + Math.cos(angle) * radius;
                                        const py = centerY + Math.sin(angle) * radius;
                                        this.spawn_createParticle(px, py, '#f97316', 'spark');
                                    }
                                }
                                else if (e.temp <= -100) { 
                                    dmg *= 2; 
                                    e.applyTemp(50); 
                                    this.spawn_createFloatingText(e.pos.x, e.pos.y, "❄️冰旋风", "#06b6d4"); 
                                    for(let k=0; k<30; k++) {
                                        const angle = Math.random() * Math.PI * 2;
                                        const radius = Math.random() * 100;
                                        const px = centerX + Math.cos(angle) * radius;
                                        const py = centerY + Math.sin(angle) * radius;
                                        this.spawn_createParticle(px, py, '#06b6d4', 'shard');
                                    }
                                }
                                
                                // 视觉：身上爆出逆向的风刃
                                for(let k=0; k<3; k++) {
                                    const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#fff', 'wind_slash');
                                    if (p) {
                                        p.vel = new Vec2((Math.random()-0.5)*20, (Math.random()-0.5)*20);
                                        p.size = 15;
                                        p.life = 0.2;
                                    }
                                }

                                // [修改 1] 套用子弹完整属性配置
                                const windConfig = { ...bulletConfig, damage: dmg };
                                this.combat_damageEnemy(e, { 
                                    config: windConfig, 
                                    pos: e.pos, 
                                    isCopy: false,
                                    shotId: currentTickShotId 
                                });
                            }
                        });
                    }, i * tickInterval);
                }
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
                
                for(let i=0; i<tickCount; i++) {
                    setTimeout(() => {
                        let hitCount = 0;
                        const currentTickShotId = this._currentDamageShotId ? `${this._currentDamageShotId}_tunnel_${i}` : `tunnel_${Date.now()}_${i}`;
                        
                        this.enemies.forEach(e => {
                            const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                            if (e.active && inPath) {
                                hitCount++;
                                // 伤害挂钩子弹伤害倍率与多段公式
                                const dmg = tickDmg;
                                
                                const windConfig = { ...bulletConfig, damage: dmg, wind: 1 };
                                this.combat_damageEnemy(e, { 
                                    config: windConfig, 
                                    pos: e.pos, 
                                    isCopy: false, 
                                    shotId: currentTickShotId 
                                });
                                
                                // 受击特效
                                for(let k=0; k<3; k++) {
                                    const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#34d399', 'wind_slash');
                                    if (p) {
                                        p.vel = new Vec2((Math.random()-0.5)*15, (Math.random()-0.5)*15);
                                        p.size = 8 + Math.random() * 8;
                                        p.life = 0.3;
                                    }
                                }
                            }
                        });

                        // 每次切割触发顿挫感
                        if (hitCount > 0) {
                            this.slowMotionTimer = 5; 
                            this.timeScale = cfg.hitStopScale;     
                            this.triggerScreenShake(10);
                        }
                    }, i * tickInterval);
                }

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
     */
    combat_wind_releaseStormCoreCyclone(core) {
        const cfg = CONFIG.wind_system.storm_core;
        const centerX = core.pos.x;
        const centerY = core.pos.y;
        const radius = core.radius * cfg.cycloneRadiusMult;
        
        this.spawn_createFloatingText(centerX, centerY, "🌀大旋风", "#10b981");
        this.spawn_createShockwave(centerX, centerY, '#10b981');
        
        // [重构] 大旋风爆发：多段高频伤害 + 疯狂旋转粒子
        const tickCount = 12;
        const tickInterval = 100;
        
        for(let i=0; i<tickCount; i++) {
            setTimeout(() => {
                // 1. 造成伤害
                this.enemies.forEach(e => {
                    if (!e.active) return;
                    const dist = e.pos.dist(core.pos);
                    if (dist < radius) {
                        // 每段伤害为总伤害的 1/4，总计 3 倍爆发伤害
                        const dmg = Math.max(1, Math.floor(core.bulletDamage * (CONFIG.wind_system.storm_core.damageMult || 4.0) * 0.25));
                        const windConfig = { ...core.bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        e.hitTimer = 10;
                    }
                });

                // 2. 疯狂旋转粒子视觉
                const intensity = 1.0 - (i / tickCount); // 随时间减弱
                const particleCount = 20;
                for(let j=0; j<particleCount; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * radius;
                    const px = centerX + Math.cos(angle) * dist;
                    const py = centerY + Math.sin(angle) * dist;
                    
                    const p = this.spawn_createParticle(px, py, '#10b981', 'wind_slash');
                    if (p) {
                        const tangent = new Vec2(-Math.sin(angle), Math.cos(angle));
                        p.vel = tangent.mult(15 + Math.random() * 10);
                        p.size = 8 + Math.random() * 8;
                        p.life = 0.6;
                        p.turbulence = 2 + Math.random() * 3;
                    }
                }
                
                if (i % 3 === 0) {
                    this.slowMotionTimer = 5;
                    this.timeScale = 0.2;
                    this.triggerScreenShake(8);
                }
            }, i * tickInterval);
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

combat_tryMoveEnemy(enemy, delta) {
        if (!enemy || !enemy.active) return false;

        const newPos = enemy.pos.add(delta);
        const halfW = enemy.width / 2;
        const halfH = enemy.height / 2;

        // 1. 边界检查 (确保不超出画布左右和上下边界)
        if (newPos.x - halfW < 0 || newPos.x + halfW > this.width) return false;
        if (newPos.y - halfH < 0 || newPos.y + halfH > this.height) return false;

        // 2. 碰撞检查 (确保不与其他活跃敌人重叠)
        // 使用简单的 AABB 碰撞检测
        const hasCollision = this.enemies.some(other => {
            if (other === enemy || !other.active) return false;
            
            return Math.abs(newPos.x - other.pos.x) < (enemy.width + other.width) * 0.45 &&
                   Math.abs(newPos.y - other.pos.y) < (enemy.height + other.height) * 0.45;
        });

        if (hasCollision) return false;

        // 3. 执行移动
        enemy.pos = newPos;
        return true;
    },

combat_damageEnemy(enemy, projectile, damageOverride = null) {
        if (!enemy || !enemy.active) return; 
        // --- [修復]：如果是光球/偽造子彈，補齊 chainHistory 防止報措 ---
        if (!projectile.chainHistory) projectile.chainHistory = [];

        const config = projectile.config;
        let dmg = damageOverride !== null ? damageOverride : (projectile.isCopy ? config.damage * 0.5 : config.damage);

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
                this.particles.push(shard);
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
                this.particles.push(mist);
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
        if (config.cryo > 0) enemy.applyTemp(-CONFIG.balance.cryoAmount * config.cryo); 
        if (config.pyro > 0) enemy.applyTemp(CONFIG.balance.pyroAmount * config.pyro); 
        if (config.lightning > 0) {
		             // 1. 尝试触发闪电链，并获取结果
		             // [修改] 传入当前闪电等级 (config.lightning)
		             const isChainTriggered = this.combat_lightning_triggerChain(enemy, dmg, projectile.chainHistory, config.lightning); 
		             
		             // 2. 只有在成功触发闪电链时，才提升当前敌人的温度 (公式：闪电层数 + 连锁次数/3)
		             if (isChainTriggered) {
                         const chainCount = projectile.chainHistory.length;
		                 enemy.applyTemp(config.lightning + chainCount / 3); 
		             }
		             
		             projectile.chainHistory.push(enemy); 
		        }
        // [修改] 调用 takeDamage 时传入 projectile 作为源，用于方向判定
        const damageResult = enemy.takeDamage(dmg, projectile);
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
        
        const shotId = projectile.shotId !== undefined ? projectile.shotId : null;
        this.combat_recordDamage(actualDmg, damageType, sourceType, shotId);

        // --- 2. [火属性核心逻辑] 燃烧与过热爆炸 ---
        if (config.pyro > 0 && enemy.temp >= 34) {
            
            // Step 1: 计算当前的基础额外火伤 (移除平方根以优化性能，改用线性比例 /150)
            const baseFireDmg = (config.pyro * enemy.temp) / 150;

            // Step 2: 造成基础燃烧伤害
            if (baseFireDmg >= 1) {
                const fireResult = enemy.takeDamage(baseFireDmg);
                this.combat_recordDamage(fireResult.actualDamage, 'pyro', sourceType, shotId);
                // 显示橙色燃烧字样
                this.spawn_createFloatingText(enemy.pos.x, enemy.pos.y - 25, `Burn ${Math.ceil(fireResult.actualDamage)}`, '#fb923c');
            }

            // Step 3: [新增] 过热爆炸机制 (Small Explosion)
            // 设定阈值 and 动态概率
            const pyroCfg = CONFIG.mechanics.pyro;
            const EXPLODE_THRESHOLD = pyroCfg.explodeThreshold; 
            let explodeChance = 0;
            if (enemy.temp > EXPLODE_THRESHOLD) {
                // 线性插值计算概率
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

                // C. 计算爆炸伤害
                const explodeDmg = baseFireDmg * pyroCfg.damageMult;
                
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
                            other.applyTemp(config.pyro * 5);
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
            this.spawn_createFloatingText(hitX, hitY, `-${Math.ceil(actualDmg)}`, damageColor);
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
                                this.combat_lightning_triggerChain(enemy, extraDmg, [], sword.config.lightning);
                            }
	                    }

                    // 3. [修复] 视觉特效：斩击动画，使用元素属性颜色
                    const angle = Math.random() * Math.PI * 2;
                    // 根据元素属性决定斩击颜色，优先级：雷 > 火/冰
                    let slashColor = '#0ea5e9'; // 默认飞剑颜色
                    if (sword.config.lightning > 0) slashColor = '#c084fc'; // 雷属性
                    else if (sword.config.pyro > 0) slashColor = '#f97316'; // 火属性
                    else if (sword.config.cryo > 0) slashColor = '#06b6d4'; // 冰属性
                    
                    this.particles.push(new SlashAnim(sword.pos.x, sword.pos.y, angle, 0.35, slashColor));
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
                    this.enemies.push(clone);
                }));
             }
        }

        if (killed) { 
            this.spawn_addScore(enemy.maxHp); 

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

            // 燃烧扩散逻辑 (保留)
            if (enemy.temp >= 100) {
                this.fireWaves.push(new FireWave(enemy.pos.x, enemy.pos.y));
                this.spawn_createFloatingText(enemy.pos.x, enemy.pos.y - 20, "🔥SPREAD!", "#f97316");
                audio.playExplosion();
                this.enemies.forEach(other => {
                    if (other.active && other !== enemy && enemy.pos.dist(other.pos) < CONFIG.gameplay.fireSpreadRadius) {
                        other.applyTemp(CONFIG.gameplay.fireSpreadTempIncrease);
                        const spreadDmg = enemy.maxHp*CONFIG.gameplay.fireSpreadDamagePercent;
                        other.takeDamage(spreadDmg);
                        // 记录火焰扩散伤害
                        this.combat_recordDamage(spreadDmg, 'pyro', 'main', shotId);
                    }
                });
            }
            const activeCount = this.enemies.filter(e => e.active && (e.pos.y > 0)).length;
            if(activeCount === 0) {
                console.log(">>> [LOG] 全场敌人已清除。正在清理子弹...");
                this.data_clearProjectiles(); 
                if (this.isEnemyTurn) {
                    console.error(">>> [BUG] 严重错误：在清理子弹时，isEnemyTurn 竟然是 TRUE！");
                }
            }
            if (enemy.type === 'boss') {
                setTimeout(() => {
                    this.stateBeforeRelic = this.phase; 
                    this.openRelicSelection(); 
                }, 500);
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
                if (other !== enemy && other.active && projectile.pos.dist(other.pos) < 100) { 
                    
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
    
    /**
     * @method combat_triggerChromaticAberration
     * @description 根据伤害大小触发CRT色差效果，限制触发频率
     * @param {number} damage - 造成的伤害
     */
    combat_triggerChromaticAberration(damage) {
        // 检查CRT效果是否开启
        const crtOverlay = document.getElementById('crt-overlay');
        if (!crtOverlay || !crtOverlay.classList.contains('active')) return;
        
        // 频率限制：每100ms最多触发一次
        const now = Date.now();
        if (!this._lastChromaticTime) this._lastChromaticTime = 0;
        if (now - this._lastChromaticTime < 100) return;
        this._lastChromaticTime = now;
        
        // 根据伤害大小决定效果强度
        let effectClass = '';
        if (damage >= 50) {
            effectClass = 'chromatic-heavy';
        } else if (damage >= 20) {
            effectClass = 'chromatic-medium';
        } else if (damage >= 5) {
            effectClass = 'chromatic-light';
        } else {
            return; // 伤害太小，不触发
        }
        
        // 移除旧的效果类
        crtOverlay.classList.remove('chromatic-light', 'chromatic-medium', 'chromatic-heavy');
        
        // 添加新效果类
        crtOverlay.classList.add(effectClass);
        
        // 动画结束后移除类
        setTimeout(() => {
            crtOverlay.classList.remove(effectClass);
        }, 500);
    },

/**
     * @method recordDamage
     * @description 记录本回合造成的伤害。
     * @param {number} amount - **重要参数** 伤害量。
     * @param {string} attrType - 属性类型
     * @param {string} sourceType - 来源类型
     * @param {number} shotId - 子弹ID
     */
    combat_recordDamage(amount, attrType = 'damage', sourceType = 'main', shotId = null) {
        if (amount <= 0) return;

        this.roundDamage += amount;
        this.currentShotDamage += amount;

        // --- 1. 更新实时显示的统计 (Game 实例级) ---
        if (!this.currentShotDamageByAttr[attrType]) {
            this.currentShotDamageByAttr[attrType] = {};
        }
        if (!this.currentShotDamageByAttr[attrType][sourceType]) {
            this.currentShotDamageByAttr[attrType][sourceType] = 0;
        }
        this.currentShotDamageByAttr[attrType][sourceType] += amount;

        // --- 2. 更新子弹历史统计 (Shot ID 级) ---
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            const shotStats = this.shotDamageMap.get(shotId);
            shotStats.total += amount;
            
            if (!shotStats.byAttr[attrType]) {
                shotStats.byAttr[attrType] = {};
            }
            if (!shotStats.byAttr[attrType][sourceType]) {
                shotStats.byAttr[attrType][sourceType] = 0;
            }
            shotStats.byAttr[attrType][sourceType] += amount;
        }

        this.ui_updateRoundDamage();
    },

/**
     * @method triggerLightningChain
     * @description 触发连锁闪电效果 (修复单体报错版)
     * @returns {boolean} 是否成功触发了闪电链
     */
    combat_lightning_triggerChain(sourceEnemy, dmg, history, level = 1) {
        // [修复1] 安全检查
        if (!sourceEnemy || !sourceEnemy.pos) return false;

        // [修复2] 容错处理
        history = history || [];

        // 查找范围内的所有有效敌人 (取消 !history.includes(e) 限制，允许重复命中)
        const RANGE = 150;
        let targets = this.enemies.filter(e => 
            e.active &&             
            e !== sourceEnemy &&
            sourceEnemy.pos.dist(e.pos) < RANGE
        ); 

        // 如果没有有效目标
        if (targets.length === 0) return false;

        // --- 核心逻辑：距离越近概率越高，且降低跳回来源的概率 ---
        // 获取上一个来源敌人 (history 的最后一个元素)
        const lastSource = history.length > 0 ? history[history.length - 1] : null;

        let totalWeight = 0;
        const weightedTargets = targets.map(t => {
            const dist = sourceEnemy.pos.dist(t.pos);
            let weight = 1 / (Math.pow(dist, 2) + 1); // 基础权重：距离平方反比
            
            // [优化] 如果目标是上一个来源敌人，权重减半，防止来回跳
            if (lastSource && t === lastSource) {
                weight *= 0.5;
            }
            
            totalWeight += weight;
            return { target: t, weight: weight, dist: dist };
        });

        // 随机选择一个目标
        let randomValue = Math.random() * totalWeight;
        let selected = null;
        for (const wt of weightedTargets) {
            randomValue -= wt.weight;
            if (randomValue <= 0) {
                selected = wt.target;
                break;
            }
        }
        if (!selected) selected = targets[0];

        // 判定连锁概率
        const lightCfg = CONFIG.mechanics.lightning;
        let p = lightCfg.baseChainChance; // 基础连锁概率
        if (selected.temp < 0) p = Math.min(lightCfg.maxChainChance, lightCfg.baseChainChance + Math.abs(selected.temp) * lightCfg.tempChainMult); 
        
        if (Math.random() < p) { 
            // [优化] 增加基础延迟，放慢连锁节奏，提升视觉快感
            const chainCount = history.length;
            // 基础延迟从 150ms 增加到 250ms，且减速曲线更平缓
            const delay = Math.max(lightCfg.chainDelayMin, lightCfg.chainDelayBase - chainCount * lightCfg.chainDelayDecay); 

            setTimeout(() => {
                if (!selected.active) return;

                // 视觉效果：闪电链
                this.lightningBolts.push(new LightningBolt(sourceEnemy.pos.x, sourceEnemy.pos.y, selected.pos.x, selected.pos.y)); 
                audio.playLightning(); 
                
                for(let i=0; i<5; i++) {
                    this.spawn_createParticle(selected.pos.x, selected.pos.y, '#c084fc', 'spark');
                }
                
                // 计算下一次伤害
                const decayFactor = lightCfg.damageDecayBase + (lightCfg.damageDecayPerLevel * level);
                const nextDmg = Math.max(1, Math.floor(dmg * decayFactor));

                // 伤害与状态：提升温度 (公式：闪电层数 + 连锁次数/3)
                const chainCount = history.length;
                selected.applyTemp(level + chainCount / 3); 
                
                const result = selected.takeDamage(dmg); 
                this.combat_recordDamage(result.actualDamage, 'lightning', 'main', this._currentDamageShotId); 
                
                if(result.killed) this.spawn_addScore(selected.maxHp);
                
                // 递归
                history.push(selected); 
                // 限制最大连锁次数防止死循环 (增加到 100 次)
                if (history.length < 100) {
                    this.combat_lightning_triggerChain(selected, nextDmg, history, level); 
                }
            }, delay);
            
            return true;
        } 
        return false;
    },

/**
    /**
     * @method fireNextShot
     * @description 发射下一发弹丸 (处理多重射击)。
     * @param {Vec2} vel - **重要参数** 初始速度向量。
     */
    combat_fireNextShot(vel) {
        if (this.ammoQueue.length === 0) return;

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
        
        // --- 新增：触发UI动画 ---
        const currentSlot = document.getElementById('current-ammo-render');
        if (currentSlot) {
            // 1. 播放飞出动画
            currentSlot.classList.add('shoot-anim');
            
            // 2. 延迟更新 UI (等待动画播放一部分，制造视觉连贯性)
            // 实际子弹已经生成，但UI滞后一点点更新，让玩家看到"发射"的过程
            setTimeout(() => {
                this.ui_updateAmmoUI();
                
                // 3. 为新上膛的子弹添加"滑入"动画
                const newCurrent = document.getElementById('current-ammo-render');
                if (newCurrent) {
                    newCurrent.classList.add('slide-in-anim');
                    setTimeout(() => newCurrent.classList.remove('slide-in-anim'), 400);
                }
            }, 150); 
        } else {
            this.ui_updateAmmoUI();
        }
        
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
     * [AUTO-GENERATED] TODO: Add a description for combat_fireLaser.his parameter.
     * @param {any} startY - TODO: Describe this parameter.
     * @param {any} vel - TODO: Describe this parameter.
     * @param {any} recipe - TODO: Describe this parameter.
     */
    combat_laser_fire(startX, startY, vel, recipe, shotId = null) {
        // [新增] 保存shotId供伤害记录使用
        // this._currentDamageShotId = shotId; // 移除：不再需要全局缓存 shotId
        
        // [新增] 激光统计处理：激光是即时的，手动增加计数并在完成后减少
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            this.shotDamageMap.get(shotId).projectileCount++;
        }
        
        // --- 1. 参数计算 ---
        this.isVisualEffectActive = true;
        // [射程] 基础 500 * 1.35 + 每层穿透 250 (决定光线能跑多远)
        let maxLen = (500 * 1.35) + (recipe.pierce * 250) + (CONFIG.gameplay.laserLengthBonus || 0); 
        
        // [粗细] 基础 3px + 每层激光 4px + 爆破加成 (决定光线视觉宽度)
        let width = 3 + (recipe.laser * 4) + (recipe.explosive ? 10 : 0);
        
        // [反弹] 直接读取配方中的 bounce 值 (决定折射次数)
        let bounces = recipe.bounce; 

        // [颜色] 优先级：爆破 > 元素 > 默认蓝
        let color = '#0ea5e9'; 
        if (recipe.pyro > 0) color = '#f97316';
        else if (recipe.cryo > 0) color = '#06b6d4';
        else if (recipe.lightning > 0) color = '#d8b4fe';
        else if (recipe.explosive) color = '#ef4444';

        // --- 2. 射线检测 (Raycasting Logic) ---
        let points = [new Vec2(startX, startY)]; 
        let currPos = new Vec2(startX, startY);
        let currDir = vel.norm(); 
        let remainLen = maxLen;
        
        // 循环条件：只要还有剩余长度 (remainLen > 0) 就继续
        // 内部会判断是否撞墙/次数耗尽来 break
        while (remainLen > 0) {
            // A. 寻找最近的反射面 (墙壁 或 护盾敌人)
            let hitResult = this.combat_laser_castRay(currPos, currDir, remainLen);
            
            // B. 结算这一段路径 (移动光标)
            let segmentLen = hitResult.dist;
            let nextPos = currPos.add(currDir.mult(segmentLen));
            
            // C. 伤害路径上的普通敌人 (穿透所有)
            this.combat_laser_processPenetration(currPos, nextPos, recipe);

            // 记录路径点用于绘制
            points.push(nextPos);
            
            // 扣除长度
            remainLen -= segmentLen;
            currPos = nextPos;

            // D. 处理撞击结果
            if (hitResult.hitType === 'none') {
                // 没撞到任何反射面，光线在空气中耗尽长度，结束
                break; 
            } else {
                // 撞到了反射面！检查是否有剩余反弹次数
                if (bounces <= 0) {
                    // 次数耗尽，光线在这里终止 (虽有长度但无法折射)
                    // 可以在末端加个小火花表示能量耗尽
                    this.spawn_createParticle(nextPos.x, nextPos.y, color, 'spark');
                    break;
                }

                // 消耗一次反弹次数
                bounces--;
                
                // 触发撞击反馈
                if (hitResult.hitType === 'wall') {
                    audio.playHit('bounce');
                    this.spawn_createParticle(nextPos.x, nextPos.y, color, 'spark');
                } else if (hitResult.hitType === 'shield') {
                    // 击中护盾敌人
                    this.combat_damageEnemy(hitResult.enemy, { config: recipe, pos: nextPos, isCopy: false }); 
                    audio.playHit('bounce'); // 听起来像打铁
                    this.spawn_createParticle(nextPos.x, nextPos.y, '#3b82f6', 'spark');
                }

                // 计算反射向量 (镜面反射)
                if (hitResult.normal === 'x') currDir.x *= -1;
                else currDir.y *= -1;
            }
        }

        // --- 3. 生成视觉与音效 ---
        this.particles.push(new LaserBeam(points, width, color));
        
        // 音效：越粗越低沉
        audio.playTone(Math.max(100, 800 - width * 20), 'sawtooth', 0.15, 0.2 + width * 0.01);
        setTimeout(() => {
            this.isVisualEffectActive = false;
        }, 600); 
        
        // [新增] 激光发射完成，增加销毁计数以触发统计保存
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            const shotStats = this.shotDamageMap.get(shotId);
            shotStats.destroyedCount++;
            // 检查是否所有子弹都已销毁
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

// 辅助：寻找最近的反射面（墙壁或带盾敌人）
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_castRayToReflectors.
     * @param {any} start - TODO: Describe this parameter.
     * @param {any} dir - TODO: Describe this parameter.
     * @param {any} maxDist - TODO: Describe this parameter.
     */
    combat_laser_castRay(start, dir, maxDist) {
        let closest = { dist: maxDist, hitType: 'none', normal: null, enemy: null };

        // 1. 检测墙壁
        // 左墙 (x=radius)
        if (dir.x < 0) {
            let d = (CONFIG.physics.bulletRadius - start.x) / dir.x;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'x' };
        }
        // 右墙 (x=width-radius)
        if (dir.x > 0) {
            let d = (this.width - CONFIG.physics.bulletRadius - start.x) / dir.x;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'x' };
        }
        // 顶墙 (y=radius)
        if (dir.y < 0) {
            let d = (CONFIG.physics.bulletRadius - start.y) / dir.y;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'y' };
        }
        // 底墙 (y=height-radius) - 只有在有 CombatWall 遗物时才反弹
        if (this.hasCombatWall && dir.y > 0) {
            let d = (this.height - CONFIG.physics.bulletRadius - start.y) / dir.y;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'y' };
        }

        // 2. 检测带盾敌人 (视为反射面)
        this.enemies.forEach(e => {
            if (!e.active || !e.affixes.includes('shield')) return;
            
            // 简单的 AABB 射线检测
            // 扩展一下边界作为碰撞箱
            const halfW = e.width / 2 + 5;
            const halfH = e.height / 2 + 5;
            
            // 为了简化，我们把敌人看作一个圆或者简单的矩形
            // 这里使用简化的矩形求交 (Slab method 的简化版)
            // 实际上，为了游戏手感，我们可以遍历所有敌人的边界线
            // 但最简单的方法是：检测射线是否穿过敌人中心附近
            
            // 使用线段与矩形相交检测
            const t = this.calc_getLineRectIntersection(start, dir, e.pos.x - halfW, e.pos.y - halfH, e.width, e.height);
            if (t !== null && t > 0 && t < closest.dist) {
                // 确定法线 (简化：看击中点的相对位置)
                const hitX = start.x + dir.x * t;
                const hitY = start.y + dir.y * t;
                const dx = Math.abs(hitX - e.pos.x);
                const dy = Math.abs(hitY - e.pos.y);
                // 如果 x 偏差比 y 偏差大，说明撞的是左右侧 (Normal X)，否则是上下侧
                // 需归一化比较 (宽高比)
                const nx = dx / halfW;
                const ny = dy / halfH;
                
                closest = { 
                    dist: t, 
                    hitType: 'shield', 
                    normal: nx > ny ? 'x' : 'y',
                    enemy: e 
                };
            }
        });

        return closest;
    },

// 辅助：处理线段上的普通穿透
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_processLaserPenetration.
     * @param {any} p1 - TODO: Describe this parameter.
     * @param {any} p2 - TODO: Describe this parameter.
     * @param {any} recipe - TODO: Describe this parameter.
     */
    combat_laser_processPenetration(p1, p2, recipe) {
        const laserVisualWidth = 3 + (recipe.laser * 4) + (recipe.explosive ? 10 : 0);
    const laserLogicRadius = laserVisualWidth / 2;
        // 构建线段包围盒用于快速剔除
        const minX = Math.min(p1.x, p2.x) - 20;
        const maxX = Math.max(p1.x, p2.x) + 20;
        const minY = Math.min(p1.y, p2.y) - 20;
        const maxY = Math.max(p1.y, p2.y) + 20;

        this.enemies.forEach(e => {
            if (!e.active) return;
            // 如果是护盾怪，之前在反射逻辑里已经处理过了，这里跳过？
            // 不，反射逻辑只处理了“最近”的一个。
            // 激光原理是：它会穿透所有普通怪，直到遇到反射面。
            // 所以这里要排除掉那个充当反射面的护盾怪（如果这束光正好终结于它）。
            // 简单处理：全部检测一遍，伤害频率不高。
            
            if (e.pos.x < minX || e.pos.x > maxX || e.pos.y < minY || e.pos.y > maxY) return;

            // 点到线段距离公式
            const l2 = p1.dist(p2) * p1.dist(p2);
            if (l2 == 0) return;
            let t = ((e.pos.x - p1.x) * (p2.x - p1.x) + (e.pos.y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * (p2.x - p1.x);
            const projY = p1.y + t * (p2.y - p1.y);
            const dist = Math.sqrt(Math.pow(e.pos.x - projX, 2) + Math.pow(e.pos.y - projY, 2));

            // 判定半径：敌人半径 + 激光粗细
            const enemyRadius = Math.min(e.width, e.height) / 2;
            const totalHitRadius = enemyRadius + laserLogicRadius;
            if (dist < totalHitRadius) {
                // 造成伤害
                // 为了避免多重判定问题，我们可以在这里直接伤害
                // 伪造一个 projectile 对象传给 damageEnemy
                this.combat_damageEnemy(e, { config: recipe, pos: new Vec2(projX, projY), isCopy: false });
                
                // 视觉：受击点特效
                if (Math.random() < 0.3) this.spawn_createParticle(projX, projY, '#fff', 'spark');
            }
        });
    },

/**
    /**
     * @method updateHitProgress
     * @description 更新命中进度条UI。
     * @param {number} val - **重要参数** 当前命中次数。
     * @param {number} target - **重要参数** 目标命中次数。
     */
    combat_updateHitProgress(val, target) { 
        // 更新数字
        document.getElementById('hit-text').innerText = `${val}/${target}`; 
        
        // 计算百分比
        const pct = target > 0 ? Math.min(100, (val/target)*100) : 0; 
        const bar = document.getElementById('hit-bar');
        
        if(bar) {
            // 更新宽度
            bar.style.width = `${pct}%`;
            
            // 状态切换：满能量 vs 普通
            if (pct >= 99) {
                bar.classList.add('bar-full');
            } else {
                bar.classList.remove('bar-full');
            }
        }
    },
};
