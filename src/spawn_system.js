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
    spawn_createFloatingText(x, y, text, color) { 
        this.floatingTexts.push(new FloatingText(x, y, text, color)); 
    },

// --- 敌人生成与词缀系统 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_generateAffixes.
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
        const chance1 = Math.min(0.6, 0.1 + r * 0.025);
        const chance2 = r > 10 ? Math.min(0.15, (r - 10) * 0.01) : 0;
        
        const roll = Math.random();
        if (roll < chance2) count = 2;
        else if (roll < chance1 + chance2) count = 1;
        
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
        // 1. [修改] 引入指数曲线
        // 设定一个基础膨胀率（从 config 读取，默认 1.12 即 12%），随回合数呈指数级放大
        // 前5回合保护期不膨胀，Math.max(0, ...) 确保前期不会变成小数
        const hpExponent = b.hpExponent || 1.12;
        const exponentialFactor = Math.pow(hpExponent, Math.max(0, this.round - 5));
        
        // 2. 新公式：(基础 + 线性) * 指数 * 难度系数
        const linearHP = (b.enemyBaseHp + (this.round * b.enemyHpPerRound)) * exponentialFactor * this.difficultyGrowthFactor;
        
        // 3. 计算基于玩家峰值伤害的理想血量
        const peakAvg = this.calc_getPeakAverageDamage();
        const fullRowsCapacity = 2 * CONFIG.gameplay.enemyCols; // 以 2 行满员为对标
        
        let finalBaseHP = linearHP;
        let idealHP = 0;
        if (peakAvg > 0) {
            idealHP = peakAvg / fullRowsCapacity;
            // 混合：60% 指数线性增长 + 40% 动态调整，提高硬数值权重
            finalBaseHP = (linearHP * 0.6) + (idealHP * 0.4);
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

                if (e.affixes.length > 0) e.type = 'elite';
                
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
                e.affixes = cfg.affixes || [];
                
                // [新增] 初始化护盾层数
                if (e.affixes.includes('shield')) {
                    e.shieldCharges = 1 + this.round;
                }

                if (e.affixes.length > 0) e.type = 'elite';
                this.enemies.push(e);
            }
        }
    },

/**
     * [AUTO-GENERATED] TODO: Add a description for spawn_addSkillPoint.
     * @param {any} amount - TODO: Describe this parameter.
     */
    spawn_addSkillPoint(amount = 1) {
        this.skillPoints += amount;
        this.ui.updateSkillPoints(this.skillPoints);
        this.ui.updateSkillBar(this.skillPoints); // <--- [新增] 更新技能栏状态
    },

/**
     * @method spawnEnemyRow
     * @description 生成指定数量的敌人行。
     * @param {number} [count=1] - **重要参数** 要生成的敌人行数。
     */
    spawn_spawnEnemyRow(count = 1) { for(let i=0; i<count; i++) { this.spawn_spawnEnemyRowAt(80 - (i * this.enemyHeight)); } },

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
                 const ty = 80 + r * this.enemyHeight;
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
        const resourceGain = Math.floor(Math.sqrt(finalScore) / 2 + 2);
        if (resourceGain > 0) {
            this.runCurrency += resourceGain;
            this.meta_addCurrency(resourceGain);
            const scoreEl = document.getElementById('score-num');
            if (scoreEl) {
                const rect = scoreEl.getBoundingClientRect();
                this.ui_playResourceFlyEffect(rect.left + rect.width/2, rect.top + rect.height/2, resourceGain);
            }
        } 
        document.getElementById('score-num').innerText = smartScientific(this.score,3);
        this.scoreMultiplier = parseFloat((this.scoreMultiplier + 0.2).toFixed(1)); // 乘数增加 0.2
        this.ui_updateMultiplierUI(); 
    },

/**
     * [AUTO-GENERATED] TODO: Add a description for spawn_generateMarbleOptions.
     */
    spawn_generateMarbleOptions() { 
        const container = document.getElementById('marble-selection-grid'); 
        container.innerHTML = ''; 
        this.marblesPool = []; 
        
        // 定義屬性到彈珠定義的映射
        const typeMapping = {
            laser: () => new MarbleDefinition('laser'),
            white: () => new MarbleDefinition('white'),
            explosive: () => new MarbleDefinition('explosive'),
            rainbow: () => new MarbleDefinition('rainbow'),
            matryoshka: () => new MarbleDefinition('matryoshka'),
            resonance: () => new MarbleDefinition('resonance'),
            // 剩下的都是 colored 類型，但 subtype 不同
            bounce: () => new MarbleDefinition('bounce'),
            pierce: () => new MarbleDefinition('pierce'),
            scatter: () => new MarbleDefinition('scatter'),
            damage: () => new MarbleDefinition('damage'),
            cryo: () => new MarbleDefinition('cryo'),
            pyro: () => new MarbleDefinition('pyro')

        };

        for(let i=0; i < CONFIG.gameplay.selectionCount; i++) {
            let m;
            
            // 1. 保底機制
            if (this.guaranteedNextRound.length > 0) {
                const key = this.guaranteedNextRound.shift();
                if (typeMapping[key]) m = typeMapping[key]();
            } 
            
            // 2. 加權隨機機制
            if (!m) {
                // 計算總權重
                let total = 0;
                const keys = Object.keys(this.unlockedWeights);
                keys.forEach(k => total += this.unlockedWeights[k]);
                
                let r = Math.random() * total;
                for (const key of keys) {
                    r -= this.unlockedWeights[key];
                    if (r <= 0) {
                        if (typeMapping[key]) m = typeMapping[key]();
                        break;
                    }
                }
            }
            
            // 兜底防止出錯
            if (!m) m = new MarbleDefinition('white');
            
            this.marblesPool.push(m); 
            
            // ... (創建 UI 卡片代碼保持不變) ...
            const card = document.createElement('div'); 
            card.className = 'select-card'; 
            card.onclick = () => this.sys_toggleMarbleSelection(i, card); 
            const icon = document.createElement('div'); 
            icon.className = 'select-icon flex-shrink-0'; 
            icon.style.background = m.getColor(); 
            const name = document.createElement('div'); 
            name.className = 'text-xs font-bold text-center text-slate-200 mt-2'; 
            name.innerText = m.getName(); 
            card.append(icon, name); 
            container.appendChild(card); 
        } 
    },

/**
     * [AUTO-GENERATED] TODO: Add a description for spawn_createParticle.
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
        // [优化] 限制粒子总数，防止高频触发（如火焰）导致卡顿
        const MAX_PARTICLES = 800; // 粒子上限翻倍 (原 400)
        const EMBER_LIMIT = 150; // 针对性能开销大的火焰粒子设置更严格的限制
        
        if (this.particles.length > MAX_PARTICLES) return null;
        
        if (mode === 'ember') {
            const currentEmbers = this.particles.filter(p => p.mode === 'ember').length;
            if (currentEmbers > EMBER_LIMIT) return null;
        }

        const p = new Particle(x, y, color, mode);
        this.particles.push(p);
        return p;
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
                
                let currentScatterIdx = 1;
                // 生成 100% 继承的副子弹
                for (let i = 0; i < fullInheritCount; i++) {
                    const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                    const multiplier = Math.ceil(currentScatterIdx / 2);
                    const angleOffset = 0.2 * multiplier * sign;
                    const newVel = vel.rotate(angleOffset);
                    const copyRecipe = { ...recipe, scatter: 0 };
                    this.combat_laser_fire(x, y, newVel, copyRecipe, shotId);
                    currentScatterIdx++;
                }
                // 生成 50% 继承的副子弹
                for (let i = 0; i < halfInheritCount; i++) {
                    const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                    const multiplier = Math.ceil(currentScatterIdx / 2);
                    const angleOffset = 0.2 * multiplier * sign;
                    const newVel = vel.rotate(angleOffset);
                    const copyRecipe = { ...recipe, scatter: 0, damage: Math.max(1, Math.floor(recipe.damage * 0.5)) };
                    this.combat_laser_fire(x, y, newVel, copyRecipe, shotId);
                    currentScatterIdx++;
                }
            }
		}
            // === [修改重点] 散射 (Scatter) 实体子弹优化 ===
        // 风属性子弹强制单发，不受 scatter 影响
        if (recipe.scatter > 0 && !recipe.wind) { 
            const scatterCount = recipe.scatter;
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
                
                // 批量缩放属性
                scalableAttrs.forEach(attr => {
                    if (typeof r[attr] === 'number') {
                        if (attr === 'damage') {
                            // 伤害至少为 1
                            r[attr] = Math.max(1, Math.floor(r[attr] * factor));
                        } else {
                            // 其他层数向下取整
                            r[attr] = Math.floor(r[attr] * factor);
                        }
                    }
                });
                return r;
            };
            
            let currentScatterIdx = 1;

            // 1. 生成 100% 继承的副子弹
            for (let i = 0; i < fullInheritCount; i++) {
                const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                const multiplier = Math.ceil(currentScatterIdx / 2);
                const angleOffset = 0.2 * multiplier * sign;
                const newVel = vel.rotate(angleOffset);           
                // 全继承：因子为 1.0
                const copyRecipe = createScatterRecipe(recipe, 1.0);
                
                this.projectiles.push(new Projectile(x, y, newVel, copyRecipe, true, shotId));
                shotStats.projectileCount++;
                currentScatterIdx++;
            }

            // 2. 生成 50% 继承的副子弹 (属性层数也减半)
            for (let i = 0; i < halfInheritCount; i++) {
                const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                const multiplier = Math.ceil(currentScatterIdx /2);
				const angleOffset = 0.2 * multiplier * sign;
                const newVel = vel.rotate(angleOffset);                
                // 半继承：因子为 0.5
                const copyRecipe = createScatterRecipe(recipe, 0.5);
                this.projectiles.push(new Projectile(x, y, newVel, copyRecipe, true, shotId));
                shotStats.projectileCount++;
                currentScatterIdx++;
            }
        }
        
        // 生成主子弹
        shotStats.projectileCount++;
        const mainRecipe = { ...recipe, isScatterChild: false };
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
            this.particles.push(new Particle(x, y, color || '#f87171')); 
        } 
    },

/**
     * @method createShockwave
     * @description 创建冲击波特效。
     * @param {number} x - **重要参数** 位置 X。
     * @param {number} y - **重要参数** 位置 Y。
     */
    spawn_createShockwave(x, y, color = null) { 
        this.shockwaves.push(new Shockwave(x, y, color)); 
    },

// ---  createHitFeedback ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_createHitFeedback.
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
                
                // [META] 获得货币
                this.runCurrency += 1;
                this.meta_addCurrency(1);
                this.ui_playResourceFlyEffect(targetX, targetY, 1);
                
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
                    this.particles.push(p);
                }

                if (this.currentSession.currentHits >= this.currentSession.nextTriggerThreshold) {
                    this.spawn_triggerLevelUpEvent(targetX, targetY); 
                } 
            }
            this.phase_gathering_attemptComplete();
        }));
    },

/**
     * [AUTO-GENERATED] TODO: Add a description for spawn_triggerLevelUpEvent.
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
};
