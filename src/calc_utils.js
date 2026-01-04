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

export const calc_utils = {
/**
     * @method calc_getPeakAverageDamage
     * @description 计算最高三轮伤害的平均值，用于动态调整敌人血量。
     */
    calc_getPeakAverageDamage() {
        // 1. 从历史记录中提取每轮总伤害
        const damages = this.roundDamageHistory.map(r => {
            return r.shots.reduce((sum, s) => sum + (s.total || 0), 0);
        });
        
        // 2. 包含上一轮的实时伤害
        if (this.prevRoundDamage > 0) damages.push(this.prevRoundDamage);
        
        if (damages.length === 0) return 0;
        
        // 3. 降序排列并取前 3 名
        damages.sort((a, b) => b - a);
        const top3 = damages.slice(0, 3);
        const sum = top3.reduce((a, b) => a + b, 0);
        
        return sum / top3.length;
    },

/**
     * @method evaluateAndAdjustDifficulty
     * @description 对比玩家战力与敌人期望血量，动态调整难度系数
     */
    calc_evaluateAndAdjustDifficulty() {
        // 前 3 回合不调整，让系统预热
        if (this.round < 3) return;

        this.currentPlayerPower = this.combat_calculatePlayerExpectedDamage();

        // 1. 计算当前敌人的期望血量 (Weighted HP Expectation)
        const b = CONFIG.balance;
        // 这里的 enemyBaseHp 和 Growth 是基础配置
        const rawGrowthHp = b.enemyBaseHp + (this.round * b.enemyHpPerRound);
        
        // 计算加权期望倍率：普通怪(1) + 精英(7 * 5%) + BOSS(25 * 1% 估算)
        // 假设精英概率 0.05, Boss 概率在普通关卡视为 0 (或极低)
        const weightMultiplier = 1.0 * 0.95 + b.eliteHpMult * 0.05; 
        
        const expectedEnemyHp = rawGrowthHp * weightMultiplier;

        // 2. 判定逻辑
        // 如果玩家的 [单发平均期望伤害] 低于 [敌人加权平均血量] 的阈值
        // 说明玩家可能需要两发甚至三发子弹才能打死一个普通怪，处于劣势
        const ddaCfg = CONFIG.mechanics.dda;
        const threshold = expectedEnemyHp * ddaCfg.playerPowerThresholdMult;

        if (this.currentPlayerPower < threshold) {
            // 玩家太弱 -> 降低成长速度
            // 并不直接减半当前血量，而是减半“成长系数”
            // 这样难度曲线会变得平缓，给玩家喘息机会
            this.difficultyGrowthFactor = ddaCfg.difficultyGrowthFactorLow;
            showToast("检测到战力不足，敌人成长减缓...", 2000);
            console.log(`[DDA] 难度降低! 玩家战力 ${this.currentPlayerPower.toFixed(1)} < 阈值 ${threshold.toFixed(1)}`);
        } else {
            // 恢复正常成长
            this.difficultyGrowthFactor = 1.0;
        }
    },

// --- [新增] 动态阈值计算 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_calculateDynamicThreshold.
     */
    calc_calculateDynamicThreshold() {
        // 如果场上没敌人，设置一个极高值防止误触
        if (this.enemies.length === 0) return 999999;

        let totalCurrentHP = 0;
        let totalMaxHP = 0;
        let aliveCount = 0;

        // 1. 统计当前场上敌人的血量数据
        for (const enemy of this.enemies) {
            // 确保只统计活着的敌人
            if (!enemy.isDead && enemy.hp > 0) {
                totalCurrentHP += enemy.hp;
                totalMaxHP += enemy.maxHp;
                aliveCount++;
            }
        }
        
        if (aliveCount === 0) return 999999;

        // --- [配置参数区域] 可根据手感微调 ---
        const smCfg = CONFIG.mechanics.slow_motion;
        // 方案：阈值 = (当前总血量 * A%) * 权重1 + (最大总血量 * B%) * 权重2
        
        const percentCurrent = smCfg.percentCurrent; // 定义为：造成当前剩余总血量的 10% 伤害算“重击”
        const percentMax = smCfg.percentMax;     // 定义为：造成最大总血量的 5% 伤害算“重击”
        
        const wCurrent = smCfg.wCurrent;        // 权重：更看重“当前血量”的比例 (70%)
        const wMax = smCfg.wMax;            // 权重：最大血量的比例占 (30%)
        
        const minThreshold = smCfg.minThreshold;     // 【保底值】防止敌人剩1血时，打1血就慢放，太频繁会晕

        // 2. 计算两部分的基准
        const valBasedOnCurrent = totalCurrentHP * percentCurrent;
        const valBasedOnMax = totalMaxHP * percentMax;

        // 3. 加权混合
        let finalThreshold = (valBasedOnCurrent * wCurrent) + (valBasedOnMax * wMax);

        // 4. 应用保底值
        return Math.max(minThreshold, finalThreshold);
    },

/**
     * @method isAreaOccupied
     * @description 檢查指定區域是否被其他敵人佔用 (修正版：基于逻辑目标位置判断)
     */
    calc_isAreaOccupied(x, y, w, h, excludeEnemy = null) {
        // 定義检测区域的邊界
        const l1 = x - w / 2;
        const r1 = x + w / 2;
        const t1 = y - h / 2;
        const b1 = y + h / 2;

        for (let e of this.enemies) {
            if (!e.active || e === excludeEnemy) continue;

            // --- [核心修复] ---
            // 使用 dropTargetY (逻辑上的目标位置) 而不是 pos.y (当前的动画位置)
            // 这样当底部敌人决定移动后，上方敌人立刻就能知道该格子在逻辑上已经空出来了
            const enemyY = e.dropTargetY; 
            const enemyX = e.pos.x; // X轴通常不改变，用 pos.x 即可

            // 手动计算边界，代替 e.getBounds()
            const eLeft = enemyX - e.width / 2;
            const eRight = enemyX + e.width / 2;
            const eTop = enemyY - e.height / 2;
            const eBottom = enemyY + e.height / 2;

            // AABB 碰撞檢測 (保留 margin 防止边缘误触)
            const margin = 2;
            if (l1 < eRight - margin &&
                r1 > eLeft + margin &&
                t1 < eBottom - margin &&
                b1 > eTop + margin) {
                return true;
            }
        }
        return false;
    },

//  計算波浪的動態速度
    // [修正] 计算波浪的动态速度
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_calculateWaveSpeed.
     */
    calc_calculateWaveSpeed() {
        const maxSpeed = 25 * this.timeScale;
        const scanSpeed = 3 * this.timeScale;
        const clearSpeed = 12 * this.timeScale; //  清场时的展示速度 (适中)

        // 1. 如果有阻尼 (刚刚触发了事件)，强制慢速
        if (this.waveMomentumTimer > 0) {
            return scanSpeed;
        }

        // 2. 波浪已经跑出屏幕上方，加速销毁
        if (this.enemyWaveY < -50) return maxSpeed;

        // 3. 统计活着的敌人数量
        const activeEnemyCount = this.enemies.filter(e => e.active).length;

        // [核心修复] 如果场上没有敌人 (清场状态)，不要用 maxSpeed，
        // 而是用 clearSpeed，让玩家能看清波浪扫过空场，产生"安全确认"的视觉反馈。
        if (activeEnemyCount === 0) {
            return clearSpeed;
        }

        let nearestDist = Infinity;
        const defenseLineY = this.height - 100;
        
        // 刚开始还没进入防线区域时，快速进场
        if (this.enemyWaveY > defenseLineY) return maxSpeed;

        let hasEnemyAbove = false;
        this.enemies.forEach(e => {
            if (!e.active || e.hasActedThisTurn) return;
            
            const enemyBottom = e.pos.y + e.height/2;
            // 只检测波浪上方的敌人
            if (enemyBottom <= this.enemyWaveY + 50) { 
                const dist = this.enemyWaveY - enemyBottom;
                if (dist >= -20 && dist < nearestDist) {
                    nearestDist = dist;
                    hasEnemyAbove = true;
                }
            }
        });

        if (!hasEnemyAbove) {
            return maxSpeed; // 只有在有敌人但都不在波浪上方时，才全速追赶
        } else {
            const slowDownRange = 150; 
            const stopRange = 10;      
            if (nearestDist > slowDownRange) return maxSpeed;
            else if (nearestDist < stopRange) return scanSpeed;
            else {
                const t = nearestDist / slowDownRange;
                return scanSpeed + (maxSpeed - scanSpeed) * (t * t); 
            }
        }
    },

// 辅助：射线与矩形相交 (Slab Method) 返回距离 t
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_getLineRectIntersection.
     * @param {any} start - TODO: Describe this parameter.
     * @param {any} dir - TODO: Describe this parameter.
     * @param {any} rx - TODO: Describe this parameter.
     * @param {any} ry - TODO: Describe this parameter.
     * @param {any} rw - TODO: Describe this parameter.
     * @param {any} rh - TODO: Describe this parameter.
     */
    calc_getLineRectIntersection(start, dir, rx, ry, rw, rh) {
        let tmin = -Infinity;
        let tmax = Infinity;

        if (dir.x !== 0) {
            let tx1 = (rx - start.x) / dir.x;
            let tx2 = (rx + rw - start.x) / dir.x;
            tmin = Math.max(tmin, Math.min(tx1, tx2));
            tmax = Math.min(tmax, Math.max(tx1, tx2));
        } else if (start.x < rx || start.x > rx + rw) {
            return null;
        }

        if (dir.y !== 0) {
            let ty1 = (ry - start.y) / dir.y;
            let ty2 = (ry + rh - start.y) / dir.y;
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));
        } else if (start.y < ry || start.y > ry + rh) {
            return null;
        }

        if (tmax >= tmin && tmin >= 0) return tmin;
        return null;
    },

// 在 Game 类中
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_compileCollectionToRecipe.
     * @param {any} marbleDef - TODO: Describe this parameter.
     * @param {any} collectedTypes - TODO: Describe this parameter.
     * @param {any} totalMulticast - TODO: Describe this parameter.
     */
    calc_compileCollectionToRecipe(marbleDef, collectedTypes, totalMulticast) {
        const recipe = { 
            damage: CONFIG.gameplay.baseDamage || 1, 
            bounce: 0, pierce: 0, scatter: 0, 
            explosive: marbleDef.type === 'explosive', 
            isMatryoshka: marbleDef.type === 'matryoshka', 
            isLaser: marbleDef.type === 'laser', // 默认为 false，由 collected 决定
            nestedPayload: null, chainPayload: null, 
            multicast: totalMulticast,
            flying_sword: 0,
            cryo: 0, pyro: 0, lightning: 0, laser: marbleDef.type === 'laser' ? 1 : 0,
            wind: 0,
            level: 1, 
            type: 'normal'
        };


        // --- 2. 收集属性 (Collected Stats) ---
        collectedTypes.forEach(t => { 
            // [修复] 支持混合格式：字符串或对象 {type, level}
            const itemType = (typeof t === 'string') ? t : t.type;
            const itemLevel = (typeof t === 'string') ? 1 : (t.level || 1);
            
            // 收集到弹性钉子 -> 增加反弹次数
            if (itemType === 'bounce') recipe.bounce += 1; 
            if (itemType === 'pierce') recipe.pierce += 1; 
            if (itemType === 'scatter') recipe.scatter += 1; 
            if (itemType === 'damage') recipe.damage += itemLevel; 
            
            // [修复] 确保元素属性正确累加，并支持层数 (itemLevel)
            if (itemType === 'cryo') recipe.cryo = (recipe.cryo || 0) + itemLevel; 
            if (itemType === 'pyro') recipe.pyro = (recipe.pyro || 0) + itemLevel;       
            if (itemType === 'lightning') recipe.lightning = (recipe.lightning || 0) + itemLevel;      
            
            // 收集到激光钉子 -> 增加激光层数
            if (itemType === 'laser') {
                recipe.laser = (recipe.laser || 0) + itemLevel; 
            }
            
            if (itemType === 'flying_sword') {
                recipe.flying_sword = 1;
                recipe.type = 'flying_sword'; 
                recipe.level = Math.max(recipe.level, itemLevel);
            }
            
            // [新增] 处理风属性
            if (itemType === 'wind') {
                recipe.wind = (recipe.wind || 0) + itemLevel;
                recipe.level = Math.max(recipe.level, itemLevel); // [迁移] 记录最高等级
            }
            
            // [已移除] 彩虹属性不再同步增加元素层数，仅保留分裂机制逻辑
        });
        if (recipe.laser > 0) {
            recipe.isLaser = true;
        }
        return recipe;
    },
};
