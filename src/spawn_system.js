import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, HealWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba 
} from './entities.js';
import { UIManager, TrainingGround, TruthBook, TRUTH_BOOK_DATA } from './systems.js';
import { audio } from './audio.js';
import { eventBus, EVENT_TYPES } from './event_bus.js';

export const spawn_system = {
/**
     * [SPAWN] 持续生成风属性技能粒子
     * @param {string} type - 法阵类型
     * @param {object} rect - 法阵区域
     * @param {number} progress - 激活进度 (0-1)
     */
    spawn_windSkillParticles(type, rect, progress) {
        // 生成频率随进度增加
        if (Math.random() > 0.3 + progress * 0.6) return;

        const isHorizontal = rect.w > rect.h;
        
        // 位置：随机分布在法阵内
        const px = rect.x + Math.random() * rect.w;
        const py = rect.y + Math.random() * rect.h;
        
        // 强制使用全屏延伸位置（如果是风道）
        const finalPx = type === 'tunnel' && isHorizontal ? (Math.random() * this.canvas.width) : px;
        const finalPy = type === 'tunnel' && !isHorizontal ? (Math.random() * this.canvas.height) : py;
        
        const p = this.spawn_createParticle(finalPx, finalPy, '#f0fdf4', 'line');
        if (!p) return;
        
        if (type === 'tunnel') {
            // === 风道粒子：像针一样的气流 ===
            const speed = 25 + Math.random() * 15; // 极快速度
            
            if (isHorizontal) {
                p.vel = new Vec2(speed, 0); 
                p.scale = { x: 40 + Math.random() * 40, y: 0.5 }; // 拉得很长且细
            } else {
                p.vel = new Vec2(0, speed);
                p.scale = { x: 0.5, y: 40 + Math.random() * 40 };
            }
            
        } else if (type === 'cyclone') {
            // === 旋风粒子：被离心力甩出的碎片 ===
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            
            // 从中心向外发射
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (Math.min(rect.w, rect.h) * 0.3);
            
            p.pos.x = cx + Math.cos(angle) * dist;
            p.pos.y = cy + Math.sin(angle) * dist;
            
            // 切线方向极速旋转
            const tanX = -Math.sin(angle);
            const tanY = Math.cos(angle);
            
            const speed = 15 + Math.random() * 10;
            p.vel = new Vec2(tanX * speed, tanY * speed);
            
            p.scale = { x: 2, y: 2 }; // 短而锐利的风刃
            p.color = '#a7f3d0';
        }
        
        p.life = 0.4; // 寿命极短，强调瞬时速度
        p.opacity = 0.8;
    },

/**
     * @method createFloatingText
     * @description 創建通用浮動文字 (修復報錯的關鍵)
     * @param {number} x - 位置 X
     * @param {number} y - 位置 Y
     * @param {string} text - 文字內容
     * @param {string} [color] - 文字顏色 (可選)
     */
    spawn_createFloatingText(x, y, text, color, fontSize) { 
        this.floatingTexts.push(new FloatingText(x, y, text, color, fontSize)); 
    },

// --- 敌人生成与词缀系统 ---
    /**
     */
    spawn_generateAffixes() {
        const affixes = [];
        let possible = [];
        const r = this.round || 0;

        // 1. 决定生成多少个词条 (数量限制)
        // 基础概率随回合提升，但有上限
        // 0个: 默认
        // 1个: 20% (r=1) -> 60% (r=20)
        // 2个: 0%  (r=1) -> 15% (r=20)
        let count = 0;
        const chance1 = Math.min(0.6, 0.05 + r * 0.025); // [难度调低] 初始概率 0.1 -> 0.05，前三关词缀触发概率降低约 5%
        const chance2 = r > 10 ? Math.min(0.15, (r - 10) * 0.01) : 0;
        
        // [难度平衡] Boss 战后，双词缀精英怪概率临时提升 25%
        const postBossBonus = (this.postBossMultiplier && this.postBossMultiplier > 1.0) ? 0.25 : 0;
        // 将 postBossBonus 叠加到 chance2（双词缀概率）
        const effectiveChance2 = Math.min(chance2 + postBossBonus, 0.40);

        const roll = Math.random();
        if (roll < effectiveChance2) count = 2;
        else if (roll < chance1 + effectiveChance2) count = 1;
        
        if (count === 0) return [];

        // 2. 定义词条权重池 (Weight Pool)
        // 格式: { id: 'affix_name', weight: function(round) }
        const poolDefinitions = [
            { id: 'shield',  weight: (r) => r < 3 ? 0 : (r < 8 ? 100 : 50) },  // 初期高频，后期变低
            { id: 'regen',   weight: (r) => r < 5 ? 0 : (r < 12 ? 80 : 40) },   // 中期高频
            { id: 'healer',  weight: (r) => r < 6 ? 0 : 60 },                   // 稳定出现
            { id: 'haste',   weight: (r) => r < 8 ? 0 : (r < 15 ? 70 : 50) },
            { id: 'jump',    weight: (r) => r < 9 ? 0 : 60 },
            { id: 'clone',   weight: (r) => r < 12 ? 0 : 50 },
            { id: 'devour',  weight: (r) => r < 12 ? 0 : 40 },
            { id: 'berserk', weight: (r) => r < 14 ? 0 : (r * 3) }              // 后期极其危险，权重随回合无限增加
        ];

        // 3. 计算当前回合的有效权重池
        let validPool = [];
        let totalWeight = 0;
        
        poolDefinitions.forEach(def => {
            const w = def.weight(r);
            if (w > 0) {
                validPool.push({ id: def.id, w: w });
                totalWeight += w;
            }
        });

        if (totalWeight <= 0) return [];

        // 4. 抽取词条
        for (let i = 0; i < count; i++) {
            let randomVal = Math.random() * totalWeight;
            for (let item of validPool) {
                if (randomVal < item.w) {
                    if (!affixes.includes(item.id)) {
                        affixes.push(item.id);
                    }
                    break;
                }
                randomVal -= item.w;
            }
        }

        return affixes;
    },

/**
     * @method spawnEnemyRowAt
     * @description [重构V3] 导演系统 + 机会生成器
     * 1. 导演系统：概率生成强力小队（增加难度/教学）。
     * 2. 机会生成器：概率生成布局破绽（降低难度/提供爽感）。
     * 3. 混合填充：智能填充剩余空位。
     */
    spawn_spawnEnemyRowAt(yPos) {
        const b = CONFIG.balance;
        
        // --- [优化] 动态血量修正逻辑 (V2: 指数膨胀) ---
        // [爽游模式] 新手教程局：始终按第 10 回合的强度生成敌人
        const effectiveRound = this._isTutorialRun ? 10 : this.round;
        // 1. [修改] 引入指数曲线
        // 设定一个基础膨胀率（从 config 读取，默认 1.12 即 12%），随回合数呈指数级放大
        // 前5回合保护期不膨胀，Math.max(0, ...) 确保前期不会变成小数
        const hpExponent = b.hpExponent || 1.12;
        const exponentialFactor = Math.pow(hpExponent, Math.max(0, effectiveRound - 5));
        
        // 2. 新公式：(基础 + 线性) * 指数 * 难度系数
        const linearHP = (b.enemyBaseHp + (effectiveRound * b.enemyHpPerRound)) * exponentialFactor * this.difficultyGrowthFactor;
        
        // 3. 计算基于近3回合滑动平均伤害的理想血量
        const peakAvg = this.calc_getRecentAverageDamage(3);
        const fullRowsCapacity = 2 * CONFIG.gameplay.enemyCols; // 以 2 行满员为对标
        
        let finalBaseHP = linearHP;
        let idealHP = 0;
        if (peakAvg > 0) {
            idealHP = peakAvg / fullRowsCapacity;
            // 混合：60% 指数线性增长 + 40% 动态调整，提高硬数値权重
            finalBaseHP = (linearHP * 0.6) + (idealHP * 0.4);
        }
        
        // [难度平衡] 战后高压因子（Post-Boss Surge）
        // Boss 击杀后 2-3 回合内，普通敌人血量 ×1.3，每回合递减 0.1
        if (this.postBossMultiplier && this.postBossMultiplier > 1.0) {
            finalBaseHP *= this.postBossMultiplier;
        }

        // 3. 应用最终倍率
        const baseHP = Math.floor(finalBaseHP * this.nextRoundHpMultiplier);
        
        // [日志] 记录血量计算过程
        // ----------------------------

        const w = this.enemyWidth;
        
        // 标记占用状态：true 表示该列已被"处理"（可能是生成了怪，也可能是强制留空）
        const occupiedCols = Array(CONFIG.gameplay.enemyCols).fill(false);
        const pendingSpawns = []; // 暂存导演生成的怪，最后统一实例化

        // =========================================
        // 1. 导演系统 (The Director) - 生成精英小队
        // =========================================
        const directorChance = Math.min(0.35, 0.15 + (this.round * 0.01));
        if (Math.random() < directorChance) {
            let playerHasCryo = false;
            let playerHasPyro = false;
            for(let i=0; i<Math.min(3, this.marbleQueue.length); i++) {
                const m = this.marbleQueue[i];
                if (m.collected.includes('cryo') || m.type === 'cryo') playerHasCryo = true;
                if (m.collected.includes('pyro') || m.type === 'pyro') playerHasPyro = true;
            }

            let squadType = null;
            const candidates = [];
            
            // 条件模板
            if (playerHasPyro && this.round >= 12) candidates.push('berserk_pack');
            if (playerHasCryo && this.round >= 8) candidates.push('jumper_pack');
            // 通用战术模板
            if (this.round >= 6) candidates.push('phalanx'); 
            if (this.round >= 10) candidates.push('blitz'); 

            if (candidates.length > 0) {
                squadType = candidates[Math.floor(Math.random() * candidates.length)];
            }

            const addPreset = (col, hpMult, forceAffixes) => {
                if (col >= 0 && col < CONFIG.gameplay.enemyCols && !occupiedCols[col]) {
                    pendingSpawns.push({ col, hp: Math.floor(baseHP * hpMult), affixes: forceAffixes });
                    occupiedCols[col] = true; // 导演占座
                }
            };

            if (squadType === 'phalanx') {
                const c = Math.floor(Math.random() * (CONFIG.gameplay.enemyCols - 1));
                addPreset(c, 1.4, ['shield']);
                addPreset(c+1, 0.8, ['healer']);
            } 
            else if (squadType === 'blitz') {
                const c1 = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
                let c2 = (c1 + 2) % CONFIG.gameplay.enemyCols;
                addPreset(c1, 0.6, ['haste']);
                addPreset(c2, 0.6, ['jump']);
            }
            else if (squadType === 'berserk_pack') {
                const c = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
                addPreset(c, 1.2, ['berserk']);
            }
            else if (squadType === 'jumper_pack') {
                const c = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
                addPreset(c, 0.8, ['jump']);
            }
        }

        // =========================================
        // 2. 机会生成器 (Opportunity Generator) - 设计关卡布局
        // =========================================
        // 仅在非 Boss 覆盖的区域生效（Boss战通常不生成普通行，这里作为防御性判断）
        // 概率：初期(前15关)极高，给玩家爽感
        let layoutType = 'random'; 
        const helpChance = Math.max(0.42, 0.99 - (this.round * 0.02)); 

        if (Math.random() < helpChance) {
            const types = ['gap', 'weak_spot', 'checkerboard'];
            layoutType = types[Math.floor(Math.random() * types.length)];
        }

        // 策略 A: [缺口] 强制留空一列
        if (layoutType === 'gap') {
            const gapCol = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
            // 只有当这一列没有被导演占用时，才将其标记为"留空"
            if (!occupiedCols[gapCol]) {
                occupiedCols[gapCol] = true; 
            }
        }
        
        // 策略 B: [弱点] 稍后在填充循环中生成一个 1 HP 的敌人
        let weakSpotCol = -1;
        if (layoutType === 'weak_spot') {
            // 找一个没被占用的空位
            const freeIndices = [];
            occupiedCols.forEach((occupied, idx) => { if(!occupied) freeIndices.push(idx); });
            
            if (freeIndices.length > 0) {
                weakSpotCol = freeIndices[Math.floor(Math.random() * freeIndices.length)];
                // 注意：这里不要把 occupiedCols 设为 true，因为我们需要在那个位置生成一个弱点怪
            }
        }

        // 策略 C: [棋盘] 强制隔一个生成一个
        if (layoutType === 'checkerboard') {
            const parity = Math.random() > 0.5 ? 0 : 1;
            for (let c = 0; c < CONFIG.gameplay.enemyCols; c++) {
                if (c % 2 === parity) {
                    // 同样，只有当这一列没被导演占用时，才强制留空
                    if (!occupiedCols[c]) {
                        occupiedCols[c] = true; 
                    }
                }
            }
        }

        // =========================================
        // 3. 填充剩余空位 (Fill Loop)
        // =========================================
        const minEnemies = Math.min(CONFIG.gameplay.enemyCols, CONFIG.gameplay.spawnMin + Math.floor(this.round / 4));
        
        // 计算当前已确定的敌人数量 (导演生成的)
        let currentCount = pendingSpawns.length; 
        
        // 获取所有未占用的列
        let freeCols = [];
        for(let c=0; c<CONFIG.gameplay.enemyCols; c++) {
            if(!occupiedCols[c]) freeCols.push(c);
        }
        
        // 洗牌
        for (let i = freeCols.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [freeCols[i], freeCols[j]] = [freeCols[j], freeCols[i]];
        }

        // 开始填充
        for (let c of freeCols) {
            const centerX = c * w + w / 2;
            
            // 基础生成判定
            let shouldSpawn = false;
            
            // 如果是弱点位置，强制生成
            if (c === weakSpotCol) shouldSpawn = true;
            // 否则按概率或最小数量生成 (注意：如果是Checkerboard布局，freeCols 已经很少了，这里的逻辑会自动适应)
            else if (currentCount < minEnemies || Math.random() < b.spawnProb) shouldSpawn = true;

            if (shouldSpawn && !this.calc_isAreaOccupied(centerX, yPos, w * 0.8, this.enemyHeight * 0.8)) {
                
                // 决定血量
                let hp = Math.floor(baseHP * (0.8 + Math.random() * 0.4));
                
                // [应用弱点策略]：如果是选定的弱点列，血量强制设为极低
                if (c === weakSpotCol) {
                    // 弱点怪血量约为基础血量的 10% ~ 20%，或者直接为 1
                    const variantRatio = (12 + (Math.random() * 14 - 7)) / 100;
                    const weakHP = Math.max(1, Math.floor(baseHP * variantRatio));
                    hp = weakHP;
                }
                const e = new Enemy(centerX, yPos, w, this.enemyHeight, hp);               
                // [新增 C2] 记录列索引，供 shield 词缀蜂巢脉冲相位偏移使用
                e._spawnColIndex = c;
                // 生成词条 (如果是弱点怪，不带词条)
                if (c === weakSpotCol) {
                    e.affixes = [];
                } else {
                    e.affixes = this.spawn_generateAffixes();
                }

                // [新增] 初始化护盾层数 (1 + 回合数)
                if (e.affixes.includes('shield')) {
                    e.shieldCharges = 1 + this.round;
                }

                // [新增] 根据 Boss 历史分配随从异型几何形状
                this.spawn_applyMinionShape(e);

                if (e.affixes.length > 0) {
                    e.type = 'elite';
                    // [C3] 精英敌人出场强调：金色冲击波 + spark 粒子
                    this.spawn_createShockwave(e.pos.x, e.pos.y, '#facc15');
                    const sparkCount = 4 + Math.floor(Math.random() * 3); // 4~6 个
                    for (let s = 0; s < sparkCount; s++) {
                        this.spawn_createParticle(e.pos.x, e.pos.y, '#facc15', 'spark');
                    }
                }
                
                this.enemies.push(e);
                currentCount++;
			}
        }
              // =========================================
        // 4. 最后实例化导演生成的精英 (Pending Spawns)
        // =========================================
        for (let cfg of pendingSpawns) {
            const centerX = cfg.col * w + w / 2;
            // 二次检查碰撞，虽然 occupiedCols 应该保证了位置
            if (!this.calc_isAreaOccupied(centerX, yPos, w * 0.8, this.enemyHeight * 0.8)) {
                const e = new Enemy(centerX, yPos, w, this.enemyHeight, cfg.hp);
                // [新增 C2] 记录列索引，供 shield 词缀蜂巢脉冲相位偏移使用
                e._spawnColIndex = cfg.col;
                e.affixes = cfg.affixes || [];
                
                // [新增] 初始化护盾层数
                if (e.affixes.includes('shield')) {
                    e.shieldCharges = 1 + this.round;
                }

                // [新增] 根据 Boss 历史分配随从异型几何形状
                this.spawn_applyMinionShape(e);

                if (e.affixes.length > 0) {
                    e.type = 'elite';
                    // [C3] 精英敌人出场强调：金色冲击波 + spark 粒子
                    this.spawn_createShockwave(e.pos.x, e.pos.y, '#facc15');
                    const sparkCount = 4 + Math.floor(Math.random() * 3); // 4~6 个
                    for (let s = 0; s < sparkCount; s++) {
                        this.spawn_createParticle(e.pos.x, e.pos.y, '#facc15', 'spark');
                    }
                }
                this.enemies.push(e);
            }
        }
    },

/**
     * @param {any} amount - TODO: Describe this parameter.
     */
    spawn_addSkillPoint(amount = 1) {
        this.skillPoints += amount;
        this.ui.updateSkillPoints(this.skillPoints);
        this.ui.updateSkillBar(this.skillPoints, this.activeSkills); // 更新技能杠状态
    },

/**
     * @method spawnEnemyRow
     * @description 生成指定数量的敌人行。
     * @param {number} [count=1] - **重要参数** 要生成的敌人行数。
     */
    spawn_spawnEnemyRow(count = 1) { for(let i=0; i<count; i++) { this.spawn_spawnEnemyRowAt(this.combatGridTopY - (i * this.enemyHeight)); } },

/**
     * @method triggerCloneSpawn
     * @description 触发分身生成的通用逻辑
     */
    spawn_triggerCloneSpawn(sourceEnemy) {
        const w = this.enemyWidth;
        const cloneHp = Math.max(1, Math.floor(sourceEnemy.maxHp * 0.2));
        
        // 寻找落点
        const validCols = [];
        for(let r = 0; r < 3; r++) {
             for(let c = 0; c < CONFIG.gameplay.enemyCols; c++) {
                 const tx = c * w + w/2;
                 const ty = this.combatGridTopY + r * this.enemyHeight;
                 if (!this.calc_isAreaOccupied(tx, ty, w * 0.9, this.enemyHeight * 0.9)) {
                     validCols.push({x: tx, y: ty});
                 }
             }
        }

        if (validCols.length > 0) {
            const pos = validCols[Math.floor(Math.random() * validCols.length)];
            // 发射孢子
            audio.playEffect('split');
            this.spores.push(new CloneSpore(sourceEnemy.pos.x, sourceEnemy.pos.y, pos.x, pos.y, () => {
                const clone = new Enemy(pos.x, pos.y, w, this.enemyHeight, cloneHp, cloneHp);
                clone.affixes = []; // 分身没有词缀
                clone.isClone = true; // [Mikro联动] 标记为分身，用于母体减伤计算
                this.enemies.push(clone);
                this.spawn_createFloatingText(pos.x, pos.y, "SPAWN", "#a855f7");
            }));
        }
    },

/**
     * [EFFECT] 生成小旋风特效 (消失时的反馈)
     */
    spawn_smallWhirlwind(x, y) {
        // 播放风声
        if (this.soundManager) this.soundManager.playEffect('split'); 

        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            // 创建青色粒子
            const p = this.spawn_createParticle(x, y, '#34d399', 'spark');
            if (!p) continue;
            
            // [数学魔法]：计算螺旋速度
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 4;
            
            // 基础向外速度
            const velocity = new Vec2(Math.cos(angle), Math.sin(angle));
            
            // 旋转 90 度得到切线方向，混合一点向外的分量
            // 这样粒子会以螺旋线飞出
            p.vel = velocity.rotate(Math.PI / 2).mult(speed); 
            p.vel.x += velocity.x * 1.5; // 稍微加一点离心力
            p.vel.y += velocity.y * 1.5;
            
            p.life = 0.6; // 短促
            p.size = Math.random() * 3 + 2;
        }
        
        // 中心加一个瞬间的淡出光圈
        this.spawn_createShockwave(x, y, '#34d399');
    },

// === 🌀 风暴核心系统 ===
    /**
     * 生成风暴核心区域
     */
    spawn_stormCore(x, y, radius, bulletDamage, bulletConfig) {
        const cfg = CONFIG.wind_system.storm_core;
        // 计算能量需求（基于半径）
        const energyRequired = Math.max(1, Math.floor(radius / 10)); 
        
        const stormCore = {
            pos: new Vec2(x, y),
            radius: Math.min(cfg.radiusMax, radius),
            bulletDamage: bulletDamage,
            bulletConfig: bulletConfig || { wind: true },
            energy: 0,
            energyRequired: energyRequired,
            chargeTimer: 0,
            active: true,
            alpha: 0.8,
            pulsePhase: Math.random() * Math.PI * 2
        };
        
        if (!this.stormCores) this.stormCores = [];
        this.stormCores.push(stormCore);
        
        this.spawn_createFloatingText(x, y, "🌀风暴核心", "#34d399");
        this.spawn_createShockwave(x, y, '#34d399');
    },

/**
     * @method addScore
     * @description 增加分数并提高分数乘数。
     * @param {number} amount - **重要参数** 基础分数。
     */
    spawn_addScore(amount) { 
        const finalScore = Math.floor(amount * this.scoreMultiplier);
        this.score += finalScore;
        const resourceGain = Math.floor(0.523 * Math.pow(finalScore, 0.63));
        // [已移除] runCurrency 累积：符文碎片改为合成时直接获取，不再通过局内货币结算
        this.scoreMultiplier = parseFloat((this.scoreMultiplier + 0.2).toFixed(1)); // 乘数增加 0.2
        this.ui_updateMultiplierUI(); 
    },

/**
     * [SPAWN] 生成弹珠选择界面的候选弹珠卡片，并初始化预览面板。
     */
    spawn_generateMarbleOptions() { 
        const container = document.getElementById('marble-selection-grid'); 
        container.innerHTML = ''; 
        this.marblesPool = []; 

        // 构建真理之书属性说明的快速查找表
        const truthBookMap = {};
        if (TRUTH_BOOK_DATA && TRUTH_BOOK_DATA.attributes) {
            TRUTH_BOOK_DATA.attributes.forEach(entry => {
                truthBookMap[entry.id] = entry;
            });
        }

        // 各弹珠类型的补充说明（真理之书中未收录的类型）
        const supplementDesc = {
            'white':     { icon: '⚪', tags: ['基础', '通用'], desc: '純淨彈珠，不帶任何屬性。本身不具備同化能力，無法將鉤釘轉化為屬性鉤釘。其價値在於展開彈珠選擇機會，適合在屬性彈珠稀缺時作為備用。' },
            'damage':    { icon: '⚔️', tags: ['增幅', '強化'], desc: '增幅彈珠，直接提升子彈的基礎傷害數值。每層增幅屬性為戰鬥階段的子彈增加固定傷害加成。' },
            'rainbow':   { icon: '🌈', tags: ['特殊', '分裂'], desc: '七彩彈珠，碰到鉤釘時立即消失並分裂為三顆子彈（彈性、穿透、散射），同時將三種屬性全部加入收集列表。分裂出的子彈不會再次觸發分裂。' },
            'resonance': { icon: '🔔', tags: ['特殊', '共鳴'], desc: '共鳴彈珠，每次碰撞普通鉤釘時有概率額外觸發能量球，加速連擊充能。飛劍命中時觸發共鳴追加傷害。' },
            'matryoshka':{ icon: '🧆', tags: ['特殊', '連鎖'], desc: '套娃彈珠，在戰鬥階段發射時，將彈藥隊列中的下一發嵌套為內層載荷。外層子彈消失時，內層子彈從原位置繼續發射，形成連鎖效果。' },
            'explosive': { icon: '🧨', tags: ['特殊', 'AOE'], desc: '爆破彈珠，子彈接觸敵人時引發劇烈爆炸，對周圍所有敵人造成大範圍傷害。' },
        };

        // 定義屬性到彈珠定義的映射
        const typeMapping = {
            laser: () => new MarbleDefinition('laser'),
            white: () => new MarbleDefinition('white'),
            explosive: () => new MarbleDefinition('explosive'),
            rainbow: () => new MarbleDefinition('rainbow'),
            matryoshka: () => new MarbleDefinition('matryoshka'),
            resonance: () => new MarbleDefinition('resonance'),
            bounce: () => new MarbleDefinition('bounce'),
            pierce: () => new MarbleDefinition('pierce'),
            scatter: () => new MarbleDefinition('scatter'),
            damage: () => new MarbleDefinition('damage'),
            cryo: () => new MarbleDefinition('cryo'),
            pyro: () => new MarbleDefinition('pyro')
        };

        // [爽游模式] 新手教程局：只展示爆炸/激光/彩虹/回响弹珠
        const tutorialOnlyTypes = ['explosive', 'laser', 'rainbow', 'resonance'];
        const tutorialWeights = {};
        if (this._isTutorialRun) {
            tutorialOnlyTypes.forEach(type => { tutorialWeights[type] = 25; });
        }

        for(let i=0; i < CONFIG.gameplay.selectionCount; i++) {
            let m;
            
            // 1. 保底機制
            if (this.guaranteedNextRound.length > 0) {
                const key = this.guaranteedNextRound.shift();
                // [爽游模式] 教程局中保底弹珠也限制在允许的类型内
                if (typeMapping[key] && (!this._isTutorialRun || tutorialOnlyTypes.includes(key))) {
                    m = typeMapping[key]();
                }
            } 
            
            // 2. 加權隨機機制
            if (!m) {
                // [爽游模式] 教程局使用限定权重表
                const activeWeights = this._isTutorialRun ? tutorialWeights : this.unlockedWeights;
                let total = 0;
                const keys = Object.keys(activeWeights);
                keys.forEach(k => total += activeWeights[k]);
                let r = Math.random() * total;
                for (const key of keys) {
                    r -= activeWeights[key];
                    if (r <= 0) {
                        if (typeMapping[key]) m = typeMapping[key]();
                        break;
                    }
                }
            }
            
            // 屌底防止出錯
            if (!m) m = new MarbleDefinition('white');
            
            this.marblesPool.push(m); 

            // 获取该弹珠的说明数据（优先真理之书，其次补充说明）
            const tbEntry = truthBookMap[m.type] || supplementDesc[m.type] || null;
            const attrDisplay = CONFIG.ui.attributeDisplay[m.type] || {};
            const marbleIcon = attrDisplay.icon || (tbEntry && tbEntry.icon) || '🔮';

            // --- 创建升级版弹珠卡片 ---
            const card = document.createElement('div');
            card.className = 'select-card';
            card.dataset.marbleIndex = i;

            // 弹珠球体（带光泽效果）
            const iconWrap = document.createElement('div');
            iconWrap.className = 'select-icon-wrap';
            const iconEl = document.createElement('div');
            iconEl.className = `select-icon marble-fx-${m.type}`;
            iconEl.style.background = m.getColor();
            // 光泽高光层
            const shine = document.createElement('div');
            shine.className = 'select-icon-shine';
            iconEl.appendChild(shine);
            // 属性 emoji 覆盖在球体上
            const emojiEl = document.createElement('div');
            emojiEl.className = 'select-icon-emoji';
            emojiEl.textContent = marbleIcon;
            iconWrap.append(iconEl, emojiEl);

            // 弹珠名称
            const nameEl = document.createElement('div');
            nameEl.className = 'select-card-name';
            nameEl.textContent = m.getName();

            // 属性标签（取前2个 tag）
            const tagsEl = document.createElement('div');
            tagsEl.className = 'select-card-tags';
            if (tbEntry && tbEntry.tags) {
                tbEntry.tags.slice(0, 2).forEach(tag => {
                    const t = document.createElement('span');
                    t.className = 'select-card-tag';
                    t.textContent = tag;
                    tagsEl.appendChild(t);
                });
            }

            card.append(iconWrap, nameEl, tagsEl);

            // 点击：切换选中 + 锁定预览
            card.onclick = () => {
                this.sys_toggleMarbleSelection(i, card);
                this.spawn_showMarblePreview(m, tbEntry, supplementDesc);
            };

            // hover：预览（不锁定）
            card.addEventListener('mouseenter', () => {
                this.spawn_showMarblePreview(m, tbEntry, supplementDesc);
            });
            card.addEventListener('touchstart', () => {
                this.spawn_showMarblePreview(m, tbEntry, supplementDesc);
            }, { passive: true });

            container.appendChild(card);
        }

        // 初始化时显示第一个弹珠的预览
        if (this.marblesPool.length > 0) {
            const firstM = this.marblesPool[0];
            const firstTbEntry = truthBookMap[firstM.type] || supplementDesc[firstM.type] || null;
            this.spawn_showMarblePreview(firstM, firstTbEntry, supplementDesc);
        }
    },

    /**
     * [SPAWN] 在选择阶段下方的预览面板中展示弹珠的详细说明。
     * @param {MarbleDefinition} m - 弹珠定义对象
     * @param {object|null} tbEntry - 真理之书中的对应条目
     * @param {object} supplementDesc - 补充说明字典
     */
    spawn_showMarblePreview(m, tbEntry, supplementDesc) {
        const panel = document.getElementById('marble-preview-panel');
        if (!panel) return;

        const attrDisplay = CONFIG.ui.attributeDisplay[m.type] || {};
        const marbleColor = m.getColor();
        const marbleName = m.getName();
        const marbleIcon = attrDisplay.icon || (tbEntry && tbEntry.icon) || '🔮';

        // 获取说明文字（优先真理之书）
        const desc = (tbEntry && tbEntry.desc) || (supplementDesc && supplementDesc[m.type] && supplementDesc[m.type].desc) || '暫無說明。';
        const tags = (tbEntry && tbEntry.tags) || (supplementDesc && supplementDesc[m.type] && supplementDesc[m.type].tags) || [];

        // 同步钉子/子弹效果说明
        const pegEffects = {
            'bounce':    '同化鉤釘：使普通鉤釘轉化為【彈性鉤釘】。兩顆彈性球相撞彈性鉤釘可突變為【風屬性】。',
            'pierce':    '同化鉤釘：使普通鉤釘轉化為【穿透鉤釘】。兩顆穿透球相撞穿透鉤釘可突變為【飛劍鉤釘】。',
            'scatter':   '同化鉤釘：使普通鉤釘轉化為【散射鉤釘】。子彈命中後向兩側分裂出小型散射彈。',
            'cryo':      '同化鉤釘：使普通鉤釘轉化為【冰霜鉤釘】。子彈命中時降低敵人溫度，觸發易傷或凍結狀態。',
            'pyro':      '同化鉤釘：使普通鉤釘轉化為【火焰鉤釘】。子彈命中時升高敵人溫度，觸發燃燒或過熱爆炸。',
            'lightning': '特殊屬性：由【冰】與【火】屬性抵消產生（合成）。子彈命中時觸發連鎖閃電。',
            'laser':     '激光属性由弹珠本身提供，不能同化鉤釘。子彈命中時發射激光束，可被護盾反射。',
            'wind':      '同化鉤釘：使普通鉤釘轉化為【風屬性鉤釘】（彈性突變）。命中後生成風暴法陣持續攻擊。',
            'explosive': '同化鉤釘：使普通鉤釘轉化為【爆破鉤釘】。子彈命中時引發大範圍爆炸傷害。',
            'damage':    '同化鉤釘：使普通鉤釘轉化為【增幅鉤釘】。子彈命中後增加基礎傷害加成。',
            'matryoshka':'同化鉤釘：使普通鉤釘轉化為【套娃鉤釘】。子彈消失時分裂出下一顆子彈。',
            'white':     '純淨彈珠可同化任意普通鉤釘，使其轉化為對應屬性鉤釘。同化概率受局外升級影響。',
            'rainbow':   '七彩彈珠不同化鉤釘，而是在碰到鉤釘時直接分裂為三顆屬性子彈（彈性/穿透/散射）。',
            'resonance': '共鳴彈珠碰撞普通鉤釘時有概率額外觸發能量球，加速連擊充能閾值達成。',
        };
        const pegEffect = pegEffects[m.type] || '可同化普通鉤釘，使其轉化為對應屬性。';

        // 更新预览面板内容
        const previewIcon = panel.querySelector('#preview-marble-icon');
        const previewName = panel.querySelector('#preview-marble-name');
        const previewTags = panel.querySelector('#preview-marble-tags');
        const previewDesc = panel.querySelector('#preview-marble-desc');
        const previewPeg = panel.querySelector('#preview-marble-peg');
        const previewBall = panel.querySelector('#preview-marble-ball');

        if (previewBall) {
            previewBall.style.background = marbleColor;
        }
        if (previewIcon) previewIcon.textContent = marbleIcon;
        if (previewName) previewName.textContent = marbleName;
        if (previewTags) {
            previewTags.innerHTML = '';
            tags.forEach(tag => {
                const t = document.createElement('span');
                t.className = 'preview-tag';
                t.textContent = tag;
                previewTags.appendChild(t);
            });
        }
        if (previewDesc) previewDesc.textContent = desc;
        if (previewPeg) previewPeg.textContent = pegEffect;

        // 显示面板（如果之前是隐藏的）
        panel.classList.remove('marble-preview-hidden');
        panel.classList.add('marble-preview-visible');
    },

/**
     * @param {any} x - TODO: Describe this parameter.
     * @param {any} y - TODO: Describe this parameter.
     * @param {any} color - TODO: Describe this parameter.
     * @param {any} mode - TODO: Describe this parameter.
     */
    /**
     * [SPAWN] 创建一个粒子效果。
     * @param {number} x - 粒子的 x 坐标。
     * @param {number} y - 粒子的 y 坐标。
     * @param {string} color - 粒子的颜色。
     * @param {string} [mode='normal'] - 粒子的行为模式 (e.g., 'normal', 'confetti')。
     */
    spawn_createParticle(x, y, color, mode = 'normal') {
        // ============================================================
        // [粒子数量限制系统] v3 - 自适应性能等级驱动
        // 预算数值来自 CONFIG.performance[this.perfQualityLevel]，
        // 随帧率变化自动调整，无需手动修改魔法数字。
        // ============================================================
        const _budget = CONFIG.performance[this.perfQualityLevel || 'high'];

        // --- 1. 全局上限检查 ---
        if (this.particles.length >= _budget.maxParticles) return null;

        // --- 2. 风属性粒子：有限供给 ---
        // wind_slash（风刃）和 line（风道气流）为风属性专属粒子，设置独立配额
        if (mode === 'wind_slash' || mode === 'line') {
            const currentWind = this.particles.filter(p => p.mode === 'wind_slash' || p.mode === 'line').length;
            if (currentWind >= _budget.windLimit) return null;
        }

        // --- 3. 检测场上是否存在活跃的风属性粒子 ---
        // 当风属性粒子存在时，动态压缩火/冰粒子的可用配额
        const activeWindCount = this.particles.filter(p => p.mode === 'wind_slash' || p.mode === 'line').length;
        const windIsActive = activeWindCount > 0;

        // --- 4. 火焰粒子（ember）限制 ---
        if (mode === 'ember') {
            const limit = windIsActive ? _budget.emberLimitWind : _budget.emberLimit;
            const currentEmbers = this.particles.filter(p => p.mode === 'ember').length;
            if (currentEmbers >= limit) return null;
        }

        // --- 5. 冰霜粒子（mist / shard）限制 ---
        if (mode === 'mist') {
            const limit = windIsActive ? _budget.mistLimitWind : _budget.mistLimit;
            const currentMist = this.particles.filter(p => p.mode === 'mist').length;
            if (currentMist >= limit) return null;
        }
        if (mode === 'shard') {
            const limit = windIsActive ? _budget.shardLimitWind : _budget.shardLimit;
            const currentShard = this.particles.filter(p => p.mode === 'shard').length;
            if (currentShard >= limit) return null;
        }

        // --- 6. 通用火星粒子（spark）限制 ---
        // spark 用于机械类受击电弧、能量泄漏、属性火星等多种场景，需独立限制防止大量占用全局预算
        if (mode === 'spark') {
            const currentSpark = this.particles.filter(p => p.mode === 'spark').length;
            if (currentSpark >= (_budget.sparkLimit ?? 100)) return null;
        }

        // --- 7. 烟雾粒子（smoke）限制 ---
        // smoke 用于狂暴受击烟雾、死亡爆炸等场景
        if (mode === 'smoke') {
            const currentSmoke = this.particles.filter(p => p.mode === 'smoke').length;
            if (currentSmoke >= (_budget.smokeLimit ?? 60)) return null;
        }

        const p = new Particle(x, y, color, mode);
        this.particles.push(p);
        return p;
    },

    /**
     * [SPAWN] 受限粒子推送 - 供 entities.js 中直接 push 的场景使用。
     * 对 ember / mist / shard 执行与 spawn_createParticle 相同的风属性压制检查，
     * 返回 true 表示允许推送，返回 false 表示被限制。
     * @param {Particle} p - 已构造好的粒子实例
     */
    spawn_pushParticleWithLimit(p) {
        // [粒子数量限制系统] v3 - 自适应性能等级驱动（与 spawn_createParticle 保持同步）
        const _budget = CONFIG.performance[this.perfQualityLevel || 'high'];
        if (this.particles.length >= _budget.maxParticles) return false;

        const mode = p.mode;
        const activeWindCount = this.particles.filter(q => q.mode === 'wind_slash' || q.mode === 'line').length;
        const windIsActive = activeWindCount > 0;

        if (mode === 'ember') {
            const limit = windIsActive ? _budget.emberLimitWind : _budget.emberLimit;
            const current = this.particles.filter(q => q.mode === 'ember').length;
            if (current >= limit) return false;
        }
        if (mode === 'mist') {
            const limit = windIsActive ? _budget.mistLimitWind : _budget.mistLimit;
            const current = this.particles.filter(q => q.mode === 'mist').length;
            if (current >= limit) return false;
        }
        if (mode === 'shard') {
            const limit = windIsActive ? _budget.shardLimitWind : _budget.shardLimit;
            const current = this.particles.filter(q => q.mode === 'shard').length;
            if (current >= limit) return false;
        }
        // --- spark 限制（与 spawn_createParticle 保持同步）---
        if (mode === 'spark') {
            const current = this.particles.filter(q => q.mode === 'spark').length;
            if (current >= (_budget.sparkLimit ?? 100)) return false;
        }
        // --- smoke 限制（与 spawn_createParticle 保持同步）---
        if (mode === 'smoke') {
            const current = this.particles.filter(q => q.mode === 'smoke').length;
            if (current >= (_budget.smokeLimit ?? 60)) return false;
        }

        this.particles.push(p);
        return true;
    },

/**
    /**
     * @method spawnBullet
     * @description 生成弹丸 (处理散射)。
     * @param {number} x - **重要参数** 初始位置 X。
     * @param {number} y - **重要参数** 初始位置 Y。
     * @param {Vec2} vel - **重要参数** 初始速度向量。
     * @param {object} recipe - **重要参数** 弹药配方。
     * @param {number} shotId - 发射ID，用于统计伤害
     */
    spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false) {
        if (!shotId) shotId = Date.now() + Math.random();

        // 初始化伤害统计结构 (支持二维统计: 伤害类型 -> 来源类型)
        if (!this.shotDamageMap.has(shotId)) {
            this.shotDamageMap.set(shotId, { 
                total: 0, 
                projectileCount: 0, 
                destroyedCount: 0, 
                // 修改：byAttr 存储为二维对象 { 'pyro': { 'main': 0, 'scatter': 0 }, ... }
                byAttr: {} 
            });
            
            // 绑定到当前 Game 实例的临时变量，供 UI 实时显示
            this.currentShotDamage = 0;
            this.currentShotDamageByAttr = {}; 
        }
        
        const shotStats = this.shotDamageMap.get(shotId);

        // [关键] 属性优先级：飞剑 > 激光
        // 如果是飞剑，优先处理飞剑逻辑
        if (recipe.type === 'flying_sword') {
            // 1. 生成【唯一的母劍】 (Mother Sword)
            // 母劍強制只有一把，不受 scatter/multicast 影響而分裂
            const motherSword = new Projectile(x, y, vel, recipe, false, shotId, isLast);
            this.projectiles.push(motherSword);

            // 2. 處理散射 -> 生成【初始護衛子劍】
            // 規則：散射數 = 初始攜帶的子劍數
            const initialSonCount = recipe.scatter || 0;
            const pegLevel = recipe.level || 1;

            for (let i = 0; i < initialSonCount; i++) {
                this.sonSwordQueue.push({
                    mother: motherSword,
                    level: pegLevel,
                    config: recipe,
                    // 初始位置稍微随机一点，避免重叠
                    x: x + (Math.random() - 0.5) * 20,
                    y: y + (Math.random() - 0.5) * 20
                });
            }

            // 3. 處理光球效果 -> 劍氣
            if (recipe.lightOrb || recipe.laser > 0) {
                // 假設 laser 屬性代表光球/劍氣等級
                // 這裡可以複用你的 SwordQi 邏輯
                if (typeof SwordQi !== 'undefined') {
                    this.swordQis = this.swordQis || [];
                    this.swordQis.push(new SwordQi(x, y, vel, 30));
                    audio.playEffect('split');
                }
            }

            return; // <--- 飛劍邏輯結束，直接返回
        }

        // 如果是激光且不是风属性，发射光束后直接 return，不生成 Projectile
        // [修改] 优先级：风属性 > 激光。如果同时拥有，则发射风属性实体子弹。
        if (recipe.isLaser && !recipe.wind) {
            this.combat_laser_fire(x, y, vel, recipe, shotId);
            
            // 处理散射激光 (如果激光带有散射属性，比如吃了黄色钉子)
            if (recipe.scatter > 0) {
                const scatterCount = recipe.scatter;
                const fullInheritCount = Math.floor(scatterCount / 2);
                const halfInheritCount = scatterCount % 2;
                // [符文词条 Hook] 散射矩阵 (scatter_matrix) - 激光散射夹角缩小
                const laserScatterAngleMult = recipe._scatterAngleMultiplier !== undefined ? recipe._scatterAngleMultiplier : 1.0;
                
                let currentScatterIdx = 1;
                // 生成 100% 继承的副子弹
                for (let i = 0; i < fullInheritCount; i++) {
                    const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                    const multiplier = Math.ceil(currentScatterIdx / 2);
                    const angleOffset = 0.2 * multiplier * sign * laserScatterAngleMult;
                    const newVel = vel.rotate(angleOffset);
                    const copyRecipe = { ...recipe, scatter: 0 };
                    this.combat_laser_fire(x, y, newVel, copyRecipe, shotId);
                    currentScatterIdx++;
                }
                // 生成 50% 继承的副子弹
                for (let i = 0; i < halfInheritCount; i++) {
                    const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                    const multiplier = Math.ceil(currentScatterIdx / 2);
                    const angleOffset = 0.2 * multiplier * sign * laserScatterAngleMult;
                    const newVel = vel.rotate(angleOffset);
                    const copyRecipe = { ...recipe, scatter: 0, damage: Math.max(1, Math.floor(recipe.damage * 0.5)) };
                    this.combat_laser_fire(x, y, newVel, copyRecipe, shotId);
                    currentScatterIdx++;
                }
            }
            return; // [激光分支] 激光发射完毕，直接返回，不生成实体 Projectile
        }
            // === [修改重点] 散射 (Scatter) 实体子弹优化 ===
        // 风属性子弹强制单发，不受 scatter 影响
        if (recipe.scatter > 0 && !recipe.wind) { 
            // --- [属性共鸣] 散射共鸣：读取共鸣参数，增加额外散射子弹数和伤害倍率 ---
            const scatterResonance = this.activeElementResonances && this.activeElementResonances['scatter'];
            const scatterResParams = scatterResonance ? scatterResonance.params : null;
            // 共鸣提供的额外散射子弹数：+1/+2/+3
            const extraScatterShots = scatterResParams ? (scatterResParams.extraScatterShots || 0) : 0;
            // 共鸣整体散射伤害倍率：1.0/1.2/1.5
            const scatterMultiplier = scatterResParams ? (scatterResParams.scatterMultiplier || 1.0) : 1.0;
            // 三阶共鸣：散射角度收窄 20%
            const scatterAngleReduction = scatterResParams ? (scatterResParams.scatterAngleReduction || 0) : 0;
            // 将共鸣伤害倍率应用到配方中（影响所有散射子弹伤害）
            const resonanceRecipe = scatterMultiplier !== 1.0 ? { ...recipe, damage: Math.max(1, Math.floor(recipe.damage * scatterMultiplier)) } : recipe;
            // 将共鸣角度收窄应用到 _scatterAngleMultiplier（与现有的 scatter_matrix 词条叠加）
            if (scatterAngleReduction > 0) {
                const existingMult = resonanceRecipe._scatterAngleMultiplier !== undefined ? resonanceRecipe._scatterAngleMultiplier : 1.0;
                if (resonanceRecipe === recipe) {
                    recipe = { ...recipe, _scatterAngleMultiplier: existingMult * (1 - scatterAngleReduction) };
                } else {
                    resonanceRecipe._scatterAngleMultiplier = existingMult * (1 - scatterAngleReduction);
                }
            }
            // 应用共鸣配方（包含伤害倍率和角度收窄）
            const effectiveRecipe = scatterAngleReduction > 0 && resonanceRecipe === recipe ? recipe : resonanceRecipe;
            const scatterCount = effectiveRecipe.scatter + extraScatterShots;
            const fullInheritCount = Math.floor(scatterCount / 2);
            const halfInheritCount = scatterCount % 2;
            
            // 定义需要缩放的属性列表
            const scalableAttrs = ['damage', 'cryo', 'pyro', 'lightning', 'laser', 'wind', 'pierce', 'bounce'];

            // 辅助函数：创建散射副本配方
            const createScatterRecipe = (base, factor) => {
                const r = { ...base }; // 浅拷贝，保留 nestedPayload (套娃)
                r.scatter = 0;         // 清除散射，防止无限递归
                r.chainPayload = null; // 清除普通连锁，防止无限循环 (套娃逻辑由 nestedPayload 负责)
                r.isScatterChild = true; // 标记为散射子弹
                
                // ─────────────────────────────────────────────────────────────────────
                // [词条 Hook] 穿甲流星（armor_piercing_meteor）
                // 效果：散射子弹继承 100% 的穿透层数（默认缩放为 0）
                // 实现：在 createScatterRecipe 中，如果激活了穿甲流星词条，
                //         则将 pierce 属性从缩放改为完全继承（factor = 1.0）
                // ─────────────────────────────────────────────────────────────────────
                const armorPiercingEffect = this.activeRunewordEffects && this.activeRunewordEffects['armor_piercing_meteor'];
                
                // 批量缩放属性
                scalableAttrs.forEach(attr => {
                    if (typeof r[attr] === 'number') {
                        if (attr === 'damage') {
                            // 伤害至少为 1
                            let scaledDamage = Math.max(1, Math.floor(r[attr] * factor));
                            // [词条 Hook] 穿甲流星：散射子弹额外伤害加成（damageBonus）
                            if (armorPiercingEffect) {
                                const damageBonus = armorPiercingEffect.params.damageBonus || 0;
                                if (damageBonus > 0) {
                                    scaledDamage = Math.max(1, Math.floor(scaledDamage * (1 + damageBonus)));
                                }
                            }
                            r[attr] = scaledDamage;
                        } else if (attr === 'pierce' && armorPiercingEffect) {
                            // [词条 Hook] 穿甲流星：穿透层数完全继承（不缩放）
                            r[attr] = base[attr]; // 保持原始穿透层数
                        } else {
                            // 其他层数向下取整
                            r[attr] = Math.floor(r[attr] * factor);
                        }
                    }
                });
                return r;
            };
            
            let currentScatterIdx = 1;
            // [符文词条 Hook] 散射矩阵 (scatter_matrix) - 散射夹角缩小
            // [属性共鸣] 将共鸣角度收窄与现有词条叠加
            // 读取 effectiveRecipe 中的 _scatterAngleMultiplier，默认为 1.0（不缩小）
            const scatterAngleMult = effectiveRecipe._scatterAngleMultiplier !== undefined ? effectiveRecipe._scatterAngleMultiplier : 1.0;
            // 1. 生成 100% 继承的副子弹
            for (let i = 0; i < fullInheritCount; i++) {
                const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                const multiplier = Math.ceil(currentScatterIdx / 2);
                const angleOffset = 0.2 * multiplier * sign * scatterAngleMult;
                const newVel = vel.rotate(angleOffset);           
                // 全继承：因子为 1.0（使用 effectiveRecipe 包含共鸣伤害加成）
                const copyRecipe = createScatterRecipe(effectiveRecipe, 1.0);
                
                this.projectiles.push(new Projectile(x, y, newVel, copyRecipe, true, shotId));
                shotStats.projectileCount++;
                currentScatterIdx++;
            }
            // 2. 生成 50% 继承的副子弹 (属性层数也减半)
            for (let i = 0; i < halfInheritCount; i++) {
                const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                const multiplier = Math.ceil(currentScatterIdx /2);
                const angleOffset = 0.2 * multiplier * sign * scatterAngleMult;
                const newVel = vel.rotate(angleOffset);                
                // 半继承：因子为 0.5（使用 effectiveRecipe 包含共鸣伤害加成）
                const copyRecipe = createScatterRecipe(effectiveRecipe, 0.5);
                this.projectiles.push(new Projectile(x, y, newVel, copyRecipe, true, shotId));
                shotStats.projectileCount++;
                currentScatterIdx++;
            }
        }
        
        // 生成主子弹
        // 注意：散射共鸣的 effectiveRecipe 定义在 if(recipe.scatter > 0) 块内，此处不可访问。
        // 主子弹直接使用原始 recipe，属性共鸣伤害加成已在副子弹中应用。
        shotStats.projectileCount++;
        let mainRecipe = { ...recipe, isScatterChild: false };
        // --- [属性共鸣] 弹跳/穿透共鸣：注入 baseBounceBonus / extraBounces / basePierceBonus / extraPierces ---
        // bounceDecayReduction 通过 _bounceDecayReduction 字段传递给 Projectile，在 combat_system.js 中消费
        if (mainRecipe.bounce > 0) {
            const _bounceRes = this.activeElementResonances && this.activeElementResonances['bounce'];
            const _bounceResP = _bounceRes ? _bounceRes.params : null;
            if (_bounceResP) {
                const baseBounceBonus = _bounceResP.baseBounceBonus || 0;
                const extraBounces = _bounceResP.extraBounces || 0;
                const bounceDecayReduction = _bounceResP.bounceDecayReduction || 0;
                mainRecipe = {
                    ...mainRecipe,
                    bounce: mainRecipe.bounce + baseBounceBonus + extraBounces,
                    _bounceDecayReduction: bounceDecayReduction,
                };
            }
        }
        if (mainRecipe.pierce > 0) {
            const _pierceRes = this.activeElementResonances && this.activeElementResonances['pierce'];
            const _pierceResP = _pierceRes ? _pierceRes.params : null;
            if (_pierceResP) {
                const basePierceBonus = _pierceResP.basePierceBonus || 0;
                const extraPierces = _pierceResP.extraPierces || 0;
                const pierceDecayReduction = _pierceResP.pierceDecayReduction || 0;
                mainRecipe = {
                    ...mainRecipe,
                    pierce: mainRecipe.pierce + basePierceBonus + extraPierces,
                    _pierceDecayReduction: pierceDecayReduction,
                };
            }
        }
        this.projectiles.push(new Projectile(x, y, vel, mainRecipe, false, shotId, isLast)); 
    },

/**
     * @method createExplosion
     * @description 创建爆炸特效 (粒子群)。
     * @param {number} x - **重要参数** 位置 X。
     * @param {number} y - **重要参数** 位置 Y。
     * @param {string} color - 颜色。
     */
    spawn_createExplosion(x, y, color) { 
        for(let i=0; i<10; i++) { 
            // [限制] 爆炸粒子受全局粒子上限约束
            this.spawn_pushParticleWithLimit(new Particle(x, y, color || '#f87171')); 
        } 
    },

/**
     * @method createShockwave
     * @description 创建冲击波特效。
     * @param {number} x - **重要参数** 位置 X。
     * @param {number} y - **重要参数** 位置 Y。
     */
    spawn_createShockwave(x, y, color = null) {
        // [自适应性能] 冲击波数量上限
        const _budget = CONFIG.performance[this.perfQualityLevel || 'high'];
        if (this.shockwaves.length >= _budget.shockwaveLimit) return;
        this.shockwaves.push(new Shockwave(x, y, color)); 
    },

    /**
     * @method spawn_createHealWave
     * @description 创建扩散治疗波特效（专用于 healer 词缀的范围治疗动画）。
     * @param {number} x - 施法者中心 X 坐标
     * @param {number} y - 施法者中心 Y 坐标
     * @param {number} range - 治疗范围（像素），决定波的最大扩散半径
     */
    spawn_createHealWave(x, y, range = 120) {
        if (!this.healWaves) this.healWaves = [];
        // [自适应性能] 治疗波数量上限
        const _budget = CONFIG.performance[this.perfQualityLevel || 'high'];
        if (this.healWaves.length >= _budget.waveLimit) return;
        this.healWaves.push(new HealWave(x, y, range));
    },

// ---  createHitFeedback ---
    /**
     * @param {any} x - TODO: Describe this parameter.
     * @param {any} y - TODO: Describe this parameter.
     * @param {any} velocity - TODO: Describe this parameter.
     * @param {any} type - TODO: Describe this parameter.
     */
    spawn_createHitFeedback(x, y, velocity, type = 'normal') {
        // 1. 获取目标坐标
        if (!this.uiCache) this.ui_updateUICache();
        
        let targetX = this.uiCache.x;
        let targetY = this.uiCache.y;

        // [核心修复]：兜底检测
        // 如果缓存坐标是 0 (说明上次获取时 UI 可能被隐藏了)，强制重算
        if (targetX === 0 && targetY === 0) {
            this.ui_updateUICache();
            targetX = this.uiCache.x;
            targetY = this.uiCache.y;
            
            // 如果还是 0 (极罕见)，就手动指定一个大概位置 (屏幕中下方)
            if (targetX === 0) {
                targetX = this.width / 2;
                targetY = this.height - 100;
            }
        }

        // --- 以下保持之前的优化逻辑不变 ---
        
        let color = '#fbbf24'; 
        if (type === 'cryo') {
            color = CONFIG.colors.cryo;
        } else if (type == 'pyro') {
            color = CONFIG.colors.pyro;
        } else if (type == 'lightning') {
            color = CONFIG.colors.lightning;
        } else if (type == 'bounce') {
            color = CONFIG.colors.bounce;
        } else if (type == 'resonance') {
            color = CONFIG.colors.resonanceRipple;

        } else if (type == 'damage') {
            color = CONFIG.colors.damage;
        } 
        const initVel = velocity ? velocity : new Vec2((Math.random()-0.5)*5, -5);

        this.energyOrbs.push(new EnergyOrb(x, y, targetX, targetY, color, initVel, () => {
            if(this.currentSession) { 
                this.currentSession.currentHits++;
                this.currentSession.totalHits++; 
                
                // [已移除] runCurrency 累积：符文碎片改为合成时直接获取，不再通过局内货币结算
                
                // 音效
                const progress = Math.min(1, this.currentSession.currentHits / this.currentSession.nextTriggerThreshold);
                if (this.currentSession.currentHits < this.currentSession.nextTriggerThreshold) {
                    if (Math.random() < 0.5) audio.playTone(500 * (1.0 + progress * 0.5), 'triangle', 0.05, 0.2); 
                }

                // 更新 UI
                this.combat_updateHitProgress(this.currentSession.currentHits, this.currentSession.nextTriggerThreshold); 
                
                const pulseLayer = this.uiCache.pulseLayer; // 使用缓存 DOM
                if (pulseLayer) {
                    pulseLayer.style.setProperty('--pulse-color', color);
                    if (!pulseLayer.classList.contains('pulse-active')) {
                        pulseLayer.classList.add('pulse-active');
                        setTimeout(() => pulseLayer.classList.remove('pulse-active'), 700);
                    }
                }

                // 震动节流
                const now = Date.now();
                if (this.uiCache.el && (!this.lastUiShakeTime || now - this.lastUiShakeTime > 100)) {
                    this.lastUiShakeTime = now;
                    const el = this.uiCache.el;
                    el.classList.remove('gauge-shake');
                    void el.offsetWidth; 
                    el.classList.add('gauge-shake');
                }
                
                // 粒子
                for(let i=0; i<3; i++) {
                    const p = new Particle(targetX, targetY, color, 'spark');
                    p.vel = new Vec2((Math.random()-0.5)*3, (Math.random()-0.5)*3);
                    // [限制] 收集粒子受全局粒子上限约束
                    this.spawn_pushParticleWithLimit(p);
                }

                if (this.currentSession.currentHits >= this.currentSession.nextTriggerThreshold) {
                    this.spawn_triggerLevelUpEvent(targetX, targetY); 
                } 
            }
            this.phase_gathering_attemptComplete();
        }));
    },

/**
     * @param {any} uiX - TODO: Describe this parameter.
     * @param {any} uiY - TODO: Describe this parameter.
     */
    spawn_triggerLevelUpEvent(uiX, uiY) {
    this.currentSession.currentHits = 0;
    this.currentSession.multicast++; 
    this.combat_updateMulticastDisplay(1);
    
    // 1. 音效爆發
    audio.playPowerup(this.currentSession.multicast); 
    
    // 2. UI 容器进入“满能量”状态动画
    const gaugeShell = this.uiCache ? this.uiCache.gaugeShell : document.getElementById('gauge-shell');
    if (gaugeShell) {
        // 添加针对圆角优化的发光类
        gaugeShell.classList.add('gauge-full');
        
        // 0.8秒后移除
        setTimeout(() => gaugeShell.classList.remove('gauge-full'), 800);
    }
    // 3. 强力冲击波
    this.spawn_createShockwave(uiX, uiY, '#facc15');
    
    // 4. 生成大量粒子
    for(let i=0; i<20; i++) {
        const px = uiX + (Math.random()-0.5) * 80;
        const py = uiY + (Math.random()-0.5) * 30;
        this.spawn_createParticle(px, py, '#fcd34d', 'spark');
    }

    this.spawn_createFloatingText(uiX, uiY - 50, "LEVEL UP!", "#fff");
    this.combat_updateHitProgress(0, this.currentSession.nextTriggerThreshold);
},

    // =========================================
    // Boss 生成系统
    // =========================================

    /**
     * @method spawn_scheduleNextBoss
     * @description 预计算下一个 Boss 应在哪个回合出现，并将结果存入 this._nextBossRound。
     *   - 第一个 Boss：固定在 Round firstBoss（默认 5）
     *   - 后续 Boss：基础间隔为 [intervalMin, intervalMax] 随机回合，加上延期回合数
     *   - 延期规则：第三个 Boss 之后（bossSpawnCount >= delayMaxBossIndex）不再延期
     * @param {number} [extraDelay=0] - 额外延期回合数（由 boss:defeated 事件根据击杀速度计算后传入）
     */
    spawn_scheduleNextBoss(extraDelay = 0) {
        const cfg = CONFIG.balance.bossRounds;
        if (!cfg) return;

        // [爽游模式] 新手教程局：第一个 Boss 固定在第 2 回合，后续不再调度（局只有 5 回合）
        if (this._isTutorialRun) {
            if (!this._bossSpawnCount || this._bossSpawnCount === 0) {
                this._nextBossRound = 2;
                console.log('[TutorialRun][BossSchedule] 最终 Boss 预定在 Round 2');
            } else {
                // 已经出现过 Boss，不再调度（局内只有一个 Boss）
                this._nextBossRound = 9999;
            }
            return;
        }

        // 第一个 Boss 固定回合
        if (!this._bossSpawnCount || this._bossSpawnCount === 0) {
            this._nextBossRound = cfg.firstBoss || 5;
            console.log(`[BossSchedule] 第一个 Boss 预定在 Round ${this._nextBossRound}`);
            return;
        }

        // 后续 Boss：基础间隔随机，加上延期
        const intervalMin = cfg.intervalMin || 7;
        const intervalMax = cfg.intervalMax || 9;
        const baseInterval = intervalMin + Math.floor(Math.random() * (intervalMax - intervalMin + 1));
        const lastSpawnRound = this._lastBossSpawnRound || this.round;
        this._nextBossRound = lastSpawnRound + baseInterval + extraDelay;
        console.log(`[BossSchedule] 下一个 Boss 预定在 Round ${this._nextBossRound}（基础间隔=${baseInterval}, 延期=${extraDelay}, 上次生成回合=${lastSpawnRound}）`);
    },

    /**
     * @method spawn_checkBossRoundFor
     * @description 检测指定回合数是否应触发 Boss（供 game_phase.js 使用）。
     *   采用预计算的 _nextBossRound 进行匹配。
     * @param {number} round - 要检测的回合数
     * @returns {{ shouldSpawn: boolean, isBigBoss: boolean }}
     */
    spawn_checkBossRoundFor(round) {
        // 如果 _nextBossRound 尚未初始化（游戏开始第一次），先调度
        if (this._nextBossRound === undefined || this._nextBossRound === null) {
            this.spawn_scheduleNextBoss(0);
        }
        if (round === this._nextBossRound) {
            // [爽游模式] 新手教程局：强制为大 Boss（ouroboros）
            if (this._isTutorialRun) {
                return { shouldSpawn: true, isBigBoss: true };
            }
            // 第四个 Boss 起为大 Boss（第 1-3 个为 Mini-Boss）
            const isBigBoss = (this._bossSpawnCount || 0) >= 3;
            return { shouldSpawn: true, isBigBoss };
        }
        return { shouldSpawn: false, isBigBoss: false };
    },

    /**
     * @method spawn_checkBossRound
     * @description 检测当前回合是否应触发 Boss（直接使用 this.round）。
     * @returns {{ shouldSpawn: boolean, isBigBoss: boolean }}
     */
    spawn_checkBossRound() {
        return this.spawn_checkBossRoundFor(this.round);
    },

    /**
     * @method spawn_calculateBossHP
     * @description 计算 Boss 血量。
     *
     * 后期公式: BossHP = (templateHP * 0.5) + (recentDPS * expectedKillRounds * 0.5)
     * 前期公式: BossHP = (templateHP * 0.15) + (recentDPS * expectedKillRounds * 0.85)
     * 保底: Math.max(BossHP, templateHP * floorMultiplier)
     *
     * 前期保护机制（Early-Game Protection）:
     * - 在 [earlyRound, lateRound] 区间内，动态权重和保底倍率均进行线性插展
     * - 前期高动态权重：血量更贴近玩家实时战力，避免模板血量过高卡死新手
     * - 前期低保底倍率：降低保底下限，使血量更自由地跟随玩家战力浮动
     *
     * Boss 倍率梯度调整（Mult Gradient）:
     * - 在 [earlyRound, lateRound] 前期区间，根据玩家实时战力与模板预期的比値动态缩放 bossMult
     * - 当玩家战力偏弱时，前期模板血量自动降低，避免前几个 Boss 血量就已远超玩家战力
     * - 缩放上限为 1.0（不超过原倍率），下限为 bossMultGradientMin（默认 0.5）
     *
     * @param {boolean} isBigBoss - 是否为大 Boss
     * @returns {number} 最终 Boss 血量
     */
    spawn_calculateBossHP(isBigBoss) {
        const b = CONFIG.balance;
        const f = b.bossHpFormula;
        // [爽游模式] 新手教程局：始终按第 10 回合强度计算 Boss 血量
        const r = this._isTutorialRun ? 10 : this.round;

        // 1. 计算基础模板血量（使用原始 bossMult，后续梯度调整）
        const hpExponent = b.hpExponent || 1.12;
        const exponentialFactor = Math.pow(hpExponent, Math.max(0, r - 5));
        const rawBossMult = isBigBoss ? f.bigBossMult : f.miniBossMult;
        const templateHP = (b.enemyBaseHp + r * b.enemyHpPerRound) * exponentialFactor * rawBossMult;

        // 2. 获取玩家战力：使用近3回合滑动平均，无历史时回落到实时期望伤害
        const recentDPS = this.calc_getRecentAverageDamage(3);
        const currentDPS = this.combat_calculatePlayerExpectedDamage();
        const effectiveDPS = recentDPS > 0 ? recentDPS : currentDPS;

        // 3. 计算动态血量
        const expectedTurns = isBigBoss ? f.bigBossKillRounds : f.miniBossKillRounds;
        const dynamicHP = effectiveDPS * expectedTurns;

        // 4. 前期保护：根据回合数对动态权重和保底倍率进行线性插展
        const earlyRound = f.earlyRound || 5;
        const lateRound  = f.lateRound  || 20;
        // t = 0 表示完全前期，t = 1 表示完全后期
        const t = Math.max(0, Math.min(1, (r - earlyRound) / (lateRound - earlyRound)));

        const earlyDynW  = f.earlyDynamicWeight  || 0.85;
        const lateDynW   = f.dynamicWeight        || 0.5;
        const earlyFloor = f.earlyFloorMultiplier || 0.45;
        const lateFloor  = f.floorMultiplier       || 0.7;

        // 线性插展得到当前回合的实际权重
        const effectiveDynW   = earlyDynW  + (lateDynW  - earlyDynW)  * t;
        const effectiveTplW   = 1 - effectiveDynW;
        const effectiveFloor  = earlyFloor + (lateFloor - earlyFloor)  * t;

        // 5. Boss 倍率梯度调整（Mult Gradient）
        //    前期区间（t < 1）根据玩家实时战力与模板预期的比値，动态缩放 bossMult
        //    比値 ratio = effectiveDPS / (templateHP / rawBossMult)
        //      ratio 越小表示玩家远弱于模板预期，应降低 bossMult
        //      ratio 越大表示玩家超过预期，不超过原始倍率
        //    后期（t = 1）完全使用原始 rawBossMult，不做梯度调整
        let effectiveBossMult = rawBossMult;
        if (t < 1 && effectiveDPS > 0) {
            // 模板单位血量：去掉 bossMult 后的每单位血量（即普通指数线性血量）
            const unitHP = (b.enemyBaseHp + r * b.enemyHpPerRound) * exponentialFactor;
            // 玩家战力对应的「应当能打多少倍率的 Boss」
            const playerImpliedMult = (effectiveDPS * expectedTurns) / unitHP;
            // 将比値限制在 [gradientMin, 1.0] 区间，再与 rawBossMult 相乘
            const gradientMin = f.bossMultGradientMin || 0.5;
            const multRatio = Math.max(gradientMin, Math.min(1.0, playerImpliedMult / rawBossMult));
            // 前期梯度与后期原始倍率线性插展
            effectiveBossMult = rawBossMult * (multRatio + (1.0 - multRatio) * t);
        }

        // 用梯度调整后的 effectiveBossMult 重新计算模板血量
        const adjustedTemplateHP = (b.enemyBaseHp + r * b.enemyHpPerRound) * exponentialFactor * effectiveBossMult;

        // 6. 混合计算 + 保底
        const mixedHP = (adjustedTemplateHP * effectiveTplW) + (dynamicHP * effectiveDynW);
        const finalHP = Math.max(adjustedTemplateHP * effectiveFloor, mixedHP);

        return Math.floor(finalHP);
    },

    /**
     * @method spawn_spawnBoss
     * @description 在战场中心列生成一个 Boss。
     * Boss 占据全宽，生成在最顶部行。
     * @param {string} bossId - Boss 配置 ID（如 'ignis', 'glacies' 等）
     * @param {boolean} isBigBoss - 是否为大 Boss
     */
    spawn_spawnBoss(bossId, isBigBoss) {
        const bossConfigs = CONFIG.balance.bossConfigs;
        const bossCfg = bossConfigs[bossId];
        if (!bossCfg) {
            console.warn(`[BossSystem] Unknown bossId: ${bossId}`);
            return;
        }

        const bossW = this.enemyWidth * 3;                        // 实际宽度：3列宽（固定）
        const bossH = this.enemyHeight * 2;                        // 高度为 2 行（整数行，与网格对齐）
        const centerX = this.width / 2;                            // 画布水平中心（更健壮，不依赖 enemyCols 为偶数）
        // spawnY 数学推导：
        //   combatGridTopY = 第一行中心 Y
        //   第一行上边界 = combatGridTopY - enemyHeight/2
        //   Boss 上边界 = spawnY - bossH/2 = spawnY - enemyHeight
        //   令 Boss 上边界 = 第一行上边界： spawnY - enemyHeight = combatGridTopY - enemyHeight/2
        //   得 spawnY = combatGridTopY + enemyHeight/2，Boss 占满第 0、1 行完整网格
        const spawnY = this.combatGridTopY + this.enemyHeight / 2; // Boss 上边界与第一行上边界对齐

        const bossHP = this.spawn_calculateBossHP(isBigBoss);

        // ===== 问题 1 修复：Boss 入场动画初始化 =====
        // Boss 从屏幕顶部外坠入，_entranceStartY 为屏幕外上方
        const entranceStartY = this.combatGridTopY - bossH * 2; // 屏幕外上方（Boss 高度的 2 倍）
        const boss = new Enemy(centerX, entranceStartY, bossW, bossH, bossHP);
        boss.type = 'boss';
        boss.bossType = bossId;
        boss.bossName = bossCfg.name;
        boss.isBigBoss = isBigBoss;
        boss.berserked = false; // 狂暴阶段标志
        
        // 分配异型碰撞形状
        switch(bossId) {
            case 'ignis':
                boss.collisionShape = 'polygon';
                boss.collisionData = {
                    vertices: [
                        new Vec2(-bossW * 0.4,  bossH * 0.5), // 左下
                        new Vec2(-bossW * 0.2, -bossH * 0.5), // 左上
                        new Vec2( bossW * 0.2, -bossH * 0.5), // 右上
                        new Vec2( bossW * 0.4,  bossH * 0.5)  // 右下
                    ]
                };
                break;
            case 'glacies':
                boss.collisionShape = 'polygon';
                boss.collisionData = {
                    vertices: [
                        new Vec2( 0,          -bossH * 0.5), // 顶
                        new Vec2( bossW * 0.4, -bossH * 0.1), // 右上
                        new Vec2( bossW * 0.3,  bossH * 0.5), // 右下
                        new Vec2(-bossW * 0.3,  bossH * 0.5), // 左下
                        new Vec2(-bossW * 0.4, -bossH * 0.1)  // 左上
                    ]
                };
                break;
            case 'mikro':
                boss.collisionShape = 'arc';
                boss.collisionData = {
                    radius: bossW * 0.3,
                    startAngle: 0,
                    endAngle: Math.PI * 2,
                    thickness: bossH * 0.1
                };
                break;
            case 'devourer':
                boss.collisionShape = 'arc';
                boss.collisionData = {
                    radius: bossW * 0.35,
                    startAngle: Math.PI * 0.25, // 下方缺口
                    endAngle: Math.PI * 1.75,
                    thickness: bossH * 0.15
                };
                boss.devourState = 'IDLE';
                boss.devourTimer = 0;
                break;
            case 'viridis':
                boss.collisionShape = 'polygon';
                boss.collisionData = {
                    vertices: [
                        new Vec2(-bossW * 0.4,  bossH * 0.5), // 左底
                        new Vec2(-bossW * 0.3,  0),           // 左中
                        new Vec2( 0,          -bossH * 0.4), // 顶
                        new Vec2( bossW * 0.3,  0),           // 右中
                        new Vec2( bossW * 0.4,  bossH * 0.5)  // 右底
                    ]
                };
                break;
            case 'tesla':
                boss.collisionShape = 'polygon';
                boss.collisionData = {
                    vertices: [
                        new Vec2( 0,          -bossH * 0.5), // 顶
                        new Vec2( bossW * 0.2,  0),           // 右
                        new Vec2( 0,           bossH * 0.5), // 底
                        new Vec2(-bossW * 0.2,  0)            // 左
                    ]
                };
                break;
            case 'chimera':
                boss.collisionShape = 'polygon';
                boss.collisionData = {
                    vertices: [
                        new Vec2(-bossW * 0.3, -bossH * 0.3),
                        new Vec2( bossW * 0.3, -bossH * 0.3),
                        new Vec2( bossW * 0.4,  bossH * 0.3),
                        new Vec2( 0,           bossH * 0.5),
                        new Vec2(-bossW * 0.4,  bossH * 0.3)
                    ]
                };
                break;
            case 'ouroboros':
                boss.collisionShape = 'arc';
                boss.collisionData = {
                    radius: bossW * 0.4,
                    startAngle: 0,
                    endAngle: Math.PI * 1.5, // 缺口 90 度
                    thickness: bossH * 0.2
                };
                boss.gapAngle = 0; // 缺口旋转角度
                break;
            default:
                boss.collisionShape = 'aabb';
                break;
        }

        // 赋予词缀
        boss.affixes = [...bossCfg.affixes];

        // 初始化护盾层数
        if (boss.affixes.includes('shield')) {
            const baseShield = 1 + this.round;
            const bonus = bossCfg.shieldChargesBonus || 0;
            boss.shieldCharges = baseShield + bonus;
        }

        // 奇美拉特殊：初始温度
        if (bossId === 'chimera' && bossCfg.initTemp) {
            boss.temp = bossCfg.initTemp;
        }

        // 奥罗波罗斯特殊：词缀轮转状态
        if (bossId === 'ouroboros') {
            boss.rotationIndex = 0;
            boss.rotationTurnCount = 0;
        }

        // Boss 移动冷却计数器初始化
        // _moveCooldown: 当前剩余冷却回合数（0 = 本回合可以移动）
        // _moveInterval: 当前生效的移动间隔（从 bossCfg.moveInterval 读取，默认 2）
        const defaultMoveInterval = bossCfg.moveInterval || 2;
        boss._moveInterval = defaultMoveInterval;
        boss._moveCooldown = 0; // 首回合直接可以移动

        // 设置入场动画状态
        boss.dropTargetY = spawnY;       // 目标位置：网格对齐的顶部
        boss._entranceStartY = entranceStartY; // 入场起始 Y

        // ===== Boss 出场：仅清除与 Boss 最终落点区域重叠的敌人 =====
        // 直接使用 boss 对象自身的真实尺寸（boss.width/height）和最终落点（boss.dropTargetY）进行 AABB 相交检测
        // 敌人则使用 e.getBounds()（基于 e.pos 和 e.width/height）获取当前实际占据范围
        if (this.enemies.length > 0) {
            const bL = boss.pos.x     - boss.width  / 2;
            const bR = boss.pos.x     + boss.width  / 2;
            const bT = boss.dropTargetY - boss.height / 2;
            const bB = boss.dropTargetY + boss.height / 2;
            this.enemies = this.enemies.filter(e => {
                const eb = e.getBounds();
                const overlaps = eb.right > bL && eb.left < bR &&
                                 eb.bottom > bT && eb.top  < bB;
                if (overlaps) { e.active = false; }
                return !overlaps;
            });
        }
        // [演出时机修复] entranceTimer 初始为 0，不在生成时立即开始动画。
        // 动画将在 phase_startCombatPhase() 进入战斗阶段时才激活，确保演出完整可见。
        boss.entranceTimer = 0;
        // 标记此 Boss 有待播放的入场演出（事件、音效、动画），等待战斗阶段开始时触发
        boss._pendingEntrance = true;

        this.enemies.push(boss);

        // [演出时机修复] 不在此处发射 boss:spawned 事件和 showToast。
        // 这些演出将在 phase_startCombatPhase() 中检测到 _pendingEntrance 后统一触发。
        // 原代码（已移至 game_phase.js）：
        //   eventBus.emit('boss:spawned', { boss, bossId, bossName, isBigBoss, round })
        //   showToast(`☠️ ${bossCfg.name} 出现！`)

        return boss;
    },

    /**
     * @method spawn_selectBossForRound
     * @description 根据回合数和是否大 Boss 选择对应的 Boss ID。
     * Mini-Boss 顺序: ignis -> glacies -> mikro -> devourer
     * 大 Boss 顺序: viridis -> tesla -> chimera -> ouroboros
     * @param {boolean} isBigBoss
     * @returns {string} Boss ID
     */
    spawn_selectBossForRound(isBigBoss) {
        const miniBossOrder = ['ignis', 'glacies', 'mikro', 'devourer'];
        const bigBossOrder  = ['viridis', 'tesla', 'chimera', 'ouroboros'];
        const order = isBigBoss ? bigBossOrder : miniBossOrder;

        // 记录已出现的 Boss
        if (!this.bossHistory) this.bossHistory = [];
        const appeared = this.bossHistory.filter(id => order.includes(id));
        const remaining = order.filter(id => !appeared.includes(id));

        let selectedId;
        if (remaining.length > 0) {
            selectedId = remaining[0]; // 按顺序选取下一个
        } else {
            // 循环：重新从头
            selectedId = order[appeared.length % order.length];
        }

        this.bossHistory.push(selectedId);
        return selectedId;
    },

    /**
     * @method spawn_applyMinionShape
     * @description 根据 bossHistory 最后一个 Boss 类型，为普通随从分配对应的异型几何形状。
     * 形状均基于敌人中心点 (0,0) 的相对坐标，由 getAbsoluteVertices() 转换为绝对坐标。
     * @param {Enemy} e - 要分配形状的随从实体
     */
    spawn_applyMinionShape(e) {
        // 获取最后一个 Boss 类型
        const lastBoss = (this.bossHistory && this.bossHistory.length > 0)
            ? this.bossHistory[this.bossHistory.length - 1]
            : null;

        // [减少异型敌人] 概率控制：只有 50% 的概率应用异型形状，其余保持默认 AABB
        if (!lastBoss || Math.random() > 0.5) {
            e.collisionShape = 'aabb';
            e.collisionData = null;
            return;
        }

        const w = e.width;
        const h = e.height;

        switch (lastBoss) {
            case 'ignis':
                // 三角形随从：等腰三角形（顶点居中，底边对称）
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2(0,       -h * 0.5), // 顶
                        new Vec2( w * 0.5, h * 0.5), // 右下
                        new Vec2(-w * 0.5, h * 0.5)  // 左下
                    ]
                };
                break;

            case 'glacies':
                // 菱形随从：4顶点菱形冰晶
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2(0,       -h * 0.5), // 顶
                        new Vec2( w * 0.5, 0),       // 右
                        new Vec2(0,        h * 0.5), // 底
                        new Vec2(-w * 0.5, 0)        // 左
                    ]
                };
                break;

            case 'mikro':
                // 正六边形随从：6顶点小六边形
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2(0,        -h * 0.5),                                    // 顶
                        new Vec2( w * 0.5, -h * 0.25),                                   // 右上
                        new Vec2( w * 0.5,  h * 0.25),                                   // 右下
                        new Vec2(0,         h * 0.5),                                    // 底
                        new Vec2(-w * 0.5,  h * 0.25),                                   // 左下
                        new Vec2(-w * 0.5, -h * 0.25)                                    // 左上
                    ]
                };
                break;

            case 'devourer':
                // 残缺矩形随从：5顶点，一角被切掉
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2(-w * 0.5, -h * 0.5), // 左上
                        new Vec2( w * 0.2, -h * 0.5), // 右上（切角左侧）
                        new Vec2( w * 0.5, -h * 0.2), // 右上（切角下侧）
                        new Vec2( w * 0.5,  h * 0.5), // 右下
                        new Vec2(-w * 0.5,  h * 0.5)  // 左下
                    ]
                };
                break;

            case 'viridis':
                // 水滴形随从：用 arc 近似水滴（圆形 + 尖顶）
                // 用多边形近似水滴：上半圆形，下半尖顶
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2(0,        -h * 0.5),  // 顶尖
                        new Vec2( w * 0.4, -h * 0.1),  // 右上
                        new Vec2( w * 0.5,  h * 0.2),  // 右中
                        new Vec2( w * 0.3,  h * 0.5),  // 右下
                        new Vec2(-w * 0.3,  h * 0.5),  // 左下
                        new Vec2(-w * 0.5,  h * 0.2),  // 左中
                        new Vec2(-w * 0.4, -h * 0.1)   // 左上
                    ]
                };
                break;

            case 'tesla':
                // 平行四边形随从：4顶点倒斜平行四边形（刀片形）
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2( w * 0.2, -h * 0.5), // 右上
                        new Vec2( w * 0.5, -h * 0.5), // 右上角
                        new Vec2(-w * 0.2,  h * 0.5), // 左下
                        new Vec2(-w * 0.5,  h * 0.5)  // 左下角
                    ]
                };
                break;

            case 'chimera':
                // 不规则五边形随从：不对称锟齿状碎片
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2(-w * 0.5, -h * 0.5), // 左上
                        new Vec2( w * 0.3, -h * 0.5), // 右上
                        new Vec2( w * 0.5,  0),        // 右中
                        new Vec2( w * 0.2,  h * 0.5), // 右下
                        new Vec2(-w * 0.5,  h * 0.5)  // 左下
                    ]
                };
                break;

            case 'ouroboros':
                // 小八角形随从：8顶点八角形
                e.collisionShape = 'polygon';
                e.collisionData = {
                    vertices: [
                        new Vec2(-w * 0.2, -h * 0.5), // 上左
                        new Vec2( w * 0.2, -h * 0.5), // 上右
                        new Vec2( w * 0.5, -h * 0.2), // 右上
                        new Vec2( w * 0.5,  h * 0.2), // 右下
                        new Vec2( w * 0.2,  h * 0.5), // 下右
                        new Vec2(-w * 0.2,  h * 0.5), // 下左
                        new Vec2(-w * 0.5,  h * 0.2), // 左下
                        new Vec2(-w * 0.5, -h * 0.2)  // 左上
                    ]
                };
                break;

            default:
                // 无 Boss 历史或未知 Boss：默认 AABB
                e.collisionShape = 'aabb';
                e.collisionData = null;
                break;
        }
    },

    /**
     * @method spawn_triggerBossEntranceShockwave
     * @description Boss 进场落地时触发冲击波效果。
     *   1. 生成多圈属性色冲击波，视觉上覆盖整个战场
     *   2. 通过 EventBus 触发屏幕震动
     *   3. 遇到冲击波的普通敌人：
     *      - 有概率获得与 Boss 属性匹配的特殊词条
     *      - 有概率直接转化为该 Boss 的随从（形状、词条均匹配）
     * @param {Enemy} boss - 进场的 Boss 实体
     */
    spawn_triggerBossEntranceShockwave(boss) {
        if (!boss || boss.type !== 'boss') return;

        const cfg = CONFIG.balance.bossEntranceShockwave;
        const bossId = boss.bossType;
        const isBigBoss = boss.isBigBoss;

        // === Boss 属性颜色映射 ===
        const BOSS_ELEMENT_COLORS = {
            ignis:    '#f97316', // 火焰橙
            glacies:  '#06b6d4', // 冰霜青
            mikro:    '#c084fc', // 闪电紫
            devourer: '#22c55e', // 弹射绿
            viridis:  '#34d399', // 激光绿
            tesla:    '#60a5fa', // 冰霜蓝
            chimera:  '#ef4444', // 穿透红
            ouroboros:'#facc15', // 散射金
        };
        const bossColor = BOSS_ELEMENT_COLORS[bossId] || '#ffffff';

        // === Boss 词条池（符合 Boss 主题的特殊词条）===
        const BOSS_AFFIX_POOLS = {
            ignis:    ['shield', 'berserk'],
            glacies:  ['regen', 'jump'],
            mikro:    ['clone', 'healer'],
            devourer: ['devour', 'shield'],
            viridis:  ['regen', 'healer'],
            tesla:    ['haste', 'clone'],
            chimera:  ['berserk', 'devour'],
            ouroboros:['shield', 'haste', 'regen'],
        };
        const affixPool = BOSS_AFFIX_POOLS[bossId] || ['shield'];

        // === 概率加成 ===
        const bonus = isBigBoss ? cfg.bigBossBonus : 0;
        const affixChance = Math.min(0.9, cfg.affixChance + bonus);
        const minionChance = Math.min(0.5, cfg.minionChance + bonus);

        // === 生成多圈冲击波 ===
        const bossX = boss.pos.x;
        const bossY = boss.pos.y;
        for (let i = 0; i < cfg.waveCount; i++) {
            setTimeout(() => {
                // 创建冲击波对象，并覆盖其 maxRadius
                const sw = new Shockwave(bossX, bossY, bossColor);
                sw.maxRadius = cfg.shockwaveMaxRadius;
                // 每圈冲击波稍微小一些，形成层次感
                sw.alpha = 1.0 - i * 0.2;
                this.shockwaves.push(sw);
            }, i * cfg.waveDelay);
        }

        // === 触发屏幕震动事件 ===
        eventBus.emit(EVENT_TYPES.BOSS_ENTRANCE_SHOCKWAVE, {
            bossId,
            isBigBoss,
            bossColor,
            shakeDuration: cfg.shakeDuration
        });

        // === 处理被冲击波命中的普通敌人 ===
        // 延迟一圈冲击波扩散时间后再判断（让冲击波视觉先打到）
        setTimeout(() => {
            const affixNames = {
                shield: '护盾', haste: '极速', regen: '再生',
                healer: '治疗', jump: '跳跃', clone: '分身',
                devour: '吞噬', berserk: '狂暴'
            };

            this.enemies.forEach(e => {
                // 跳过 Boss 自身、已死亡、已处于屏幕外的敌人
                if (!e.active || e.type === 'boss' || e.pos.y <= 0) return;

                // 判断是否在冲击波覆盖范围内（冲击波从 Boss 中心出发，全场全覆盖）
                const dx = e.pos.x - bossX;
                const dy = e.pos.y - bossY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > cfg.shockwaveMaxRadius) return;

                const roll = Math.random();

                if (roll < minionChance) {
                    // === 转化为 Boss 随从 ===
                    // 保留位置和尺寸，重置词条为 Boss 属性词条
                    e.affixes = [...affixPool];
                    e.type = 'elite';
                    // 应用 Boss 对应的随从形状（修改 bossHistory 临时指向当前 Boss）
                    const savedHistory = this.bossHistory ? [...this.bossHistory] : [];
                    if (!this.bossHistory) this.bossHistory = [];
                    // 确保 bossHistory 最后一个是当前 Boss
                    const tempHistory = [...savedHistory.filter(id => id !== bossId), bossId];
                    this.bossHistory = tempHistory;
                    this.spawn_applyMinionShape(e);
                    this.bossHistory = savedHistory; // 恢复原始 bossHistory
                    // 初始化护盾层数
                    if (e.affixes.includes('shield')) {
                        e.shieldCharges = Math.max(1, Math.floor((1 + this.round) * 0.5));
                    }
                    // 浮动文字提示
                    this.spawn_createFloatingText(
                        e.pos.x, e.pos.y - e.height / 2 - 10,
                        '随从!', bossColor
                    );
                } else if (roll < minionChance + affixChance) {
                    // === 赋予 Boss 特殊词条 ===
                    const newAffix = affixPool[Math.floor(Math.random() * affixPool.length)];
                    if (!e.affixes.includes(newAffix)) {
                        e.affixes.push(newAffix);
                        if (e.affixes.length > 0) e.type = 'elite';
                        // 初始化护盾层数
                        if (newAffix === 'shield') {
                            e.shieldCharges = Math.max(1, 1 + Math.floor(this.round * 0.5));
                        }
                        // 浮动文字提示
                        const affixLabel = affixNames[newAffix] || newAffix;
                        this.spawn_createFloatingText(
                            e.pos.x, e.pos.y - e.height / 2 - 10,
                            `「${affixLabel}」`, bossColor
                        );
                    }
                }
            });
        }, cfg.waveDelay * 1.5); // 在第一圈冲击波扩散到中场后处理

        // === [C1] Boss 入场气浪推力：周围小怪被震开 ===
        // 延迟与冲击波第一圈同步，让视觉与物理反馈对齐
        setTimeout(() => {
            const MAX_BUMP = 20;        // 最大垂直推力（像素）
            const BUMP_RADIUS = cfg.shockwaveMaxRadius; // 推力有效半径（与冲击波一致）
            this.enemies.forEach(e => {
                if (!e.active || e.type === 'boss') return;
                const dx = e.pos.x - bossX;
                const dy = e.pos.y - bossY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= BUMP_RADIUS) return;
                // 距离越近推力越大，线性衰减
                const ratio = 1 - dist / BUMP_RADIUS;
                e.bumpOffsetY = -(MAX_BUMP * ratio);
            });
        }, cfg.waveDelay * 0.5); // 冲击波刚开始扩散时同步触发推力
    },
};
