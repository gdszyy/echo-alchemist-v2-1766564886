/**
 * @file damage_calc.js
 * @description 伤害计算模块 —— 从 combat_system.js 拆分出的纯计算函数。
 *
 * 包含：
 *  - DDA（动态难度调整）期望伤害评估
 *  - 伤害记录与统计汇总
 *  - 闪电链触发逻辑（纯计算部分）
 *  - 色差特效触发（与伤害量挂钩的 DOM 操作，已标注 TODO[Task 3.2]）
 *
 * 使用方式：通过 window.DamageCalc 访问，或直接 import。
 * 所有方法均以 mixin 形式设计，需绑定到 Game 实例（this）上调用。
 */

import { CONFIG } from '../config.js';
import { LightningBolt } from '../entities.js';
import { audio } from '../audio.js';
import { eventBus } from '../event_bus.js';

/**
 * @namespace DamageCalc
 * @description 伤害计算 mixin，挂载到 Game 实例上使用。
 */
export const DamageCalc = {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DDA 评估
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_calculatePlayerExpectedDamage
     * @description 计算玩家当前弹药队列的平均预期伤害 (DDA 核心算法)。
     *   使用修剪均值 + 离群值过滤，避免极端弹药扭曲评估结果。
     * @returns {number} 平均预期伤害评分
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

        return finalAverage;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. 伤害记录与统计汇总
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_reportDamage
     * @description 汇报伤害（供敌人受伤时调用），累加到帧伤害累加器。
     * @param {number} amount - 伤害量
     */
    combat_reportDamage(amount) {
        this.frameDamageAccumulator += amount;
    },

    /**
     * @method combat_recordDamage
     * @description 记录本回合造成的伤害，更新实时统计和子弹历史统计。
     * @param {number} amount - 伤害量
     * @param {string} attrType - 属性类型（'damage'/'pyro'/'cryo'/'lightning'等）
     * @param {string} sourceType - 来源类型（'main'/'scatter'/'flying_sword'/'wind'）
     * @param {number|null} shotId - 子弹ID（用于按发统计）
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

    // ─────────────────────────────────────────────────────────────────────────
    // 3. 闪电链触发（纯计算 + 递归）
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_lightning_triggerChain
     * @description 触发连锁闪电效果（修复单体报错版）。
     *   使用距离加权随机选择目标，并递归触发连锁，最多 100 次。
     * @param {Enemy} sourceEnemy - 闪电来源敌人
     * @param {number} dmg - 当前段伤害
     * @param {Array} history - 已命中敌人历史（防止来回跳）
     * @param {number} level - 闪电属性层数（影响衰减和概率）
     * @param {number|null} shotId - 子弹ID
     * @returns {boolean} 是否成功触发了闪电链
     */
    combat_lightning_triggerChain(sourceEnemy, dmg, history, level = 1, shotId = null) {
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

                for (let i = 0; i < 5; i++) {
                    this.spawn_createParticle(selected.pos.x, selected.pos.y, '#c084fc', 'spark');
                }

                // 计算下一次伤害
                const decayFactor = lightCfg.damageDecayBase + (lightCfg.damageDecayPerLevel * level);
                const nextDmg = Math.max(1, Math.floor(dmg * decayFactor));
                // 伤害与状态：提升温度 (公式：闪电层数 + 连锁次数/3)
                const chainCountInner = history.length;
                selected.applyTemp(level + chainCountInner / 3);

                const result = selected.takeDamage(dmg);
                this.combat_recordDamage(result.actualDamage, 'lightning', 'main', shotId);

                if (result.killed) this.spawn_addScore(selected.maxHp);

                // 递归
                history.push(selected);
                // 限制最大连锁次数防止死循环 (增加到 100 次)
                if (history.length < 100) {
                    this.combat_lightning_triggerChain(selected, nextDmg, history, level, shotId);
                }
            }, delay);

            return true;
        }
        return false;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 4. 色差特效触发（DOM 操作，已标注 TODO[Task 3.2]）
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_triggerChromaticAberration
     * @description 根据伤害大小触发 CRT 色差效果，限制触发频率（每 100ms 最多一次）。
     * @param {number} damage - 造成的伤害
     */
    combat_triggerChromaticAberration(damage) {
        // TODO[Task 3.2]: 改为 EventBus 事件 eventBus.emit('ui:chromaticAberration', { damage })
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
        // TODO[Task 3.2]: 改为 EventBus 事件驱动，避免直接 setTimeout 操作 DOM
        setTimeout(() => {
            crtOverlay.classList.remove(effectClass);
        }, 500);
    },

};

// 暴露到全局，供非模块化脚本访问
window.DamageCalc = DamageCalc;
