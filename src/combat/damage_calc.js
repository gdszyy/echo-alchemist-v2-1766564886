/**
 * @file damage_calc.js
 * @description 伤害计算模块 —— 从 combat_system.js 拆分出的纯计算函数。
 *
 * 包含：
 *  - DDA（动态难度调整）期望伤害评估
 *  - 伤害记录与统计汇总
 *  - 闪电链触发逻辑（纯计算部分）
 *  - 色差特效触发（通过 EventBus 事件驱动，Task 3.2 已完成）
 *  - [词条 Hook] 7 个词条效果 Hook（Agent C 实现）
 *    - thunderstorm（雷暴之语）：提升闪电链伤害衰减系数
 *    - thunder_scatter（雷霆散射）：成功触发闪电链后额外触发一次（isExtraChain 防循环保护）
 *    - absolute_zero（绝对零度）：冰冻状态下伤害加深
 *    - elemental_fusion（元素聚变）：三元素共存时触发爆炸
 *
 * 使用方式：通过 window.DamageCalc 访问，或直接 import。
 * 所有方法均以 mixin 形式设计，需绑定到 Game 实例（this）上调用。
 */

import { CONFIG } from '../config.js';
import { LightningBolt } from '../entities.js';
import { audio } from '../audio.js';
import { eventBus, EVENT_TYPES } from '../event_bus.js';

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
     *
     *   [词条 Hook] 已注入以下词条效果：
     *   - thunderstorm（雷暴之语）：提升 decayFactor，减少伤害衰减
     *   - thunder_scatter（雷霆散射）：成功触发后，按概率额外触发一次闪电链（isExtraChain=false 时才触发，防止无限循环）
     *
     * @param {Enemy} sourceEnemy - 闪电来源敌人
     * @param {number} dmg - 当前段伤害
     * @param {Array} history - 已命中敌人历史（防止来回跳）
     * @param {number} level - 闪电属性层数（影响衰减和概率）
     * @param {number|null} shotId - 子弹ID
     * @param {number} chainChanceBonus - 共鸣概率加成
     * @param {boolean} isExtraChain - 是否为 thunder_scatter 触发的额外链（额外链不再触发 thunder_scatter，防止无限循环）
     * @returns {boolean} 是否成功触发了闪电链
     */
    combat_lightning_triggerChain(sourceEnemy, dmg, history, level = 1, shotId = null, chainChanceBonus = 0, isExtraChain = false) {
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
        // [属性共鸣] 应用共鸣概率加成
        let p = lightCfg.baseChainChance + chainChanceBonus; // 基础连锁概率 + 共鸣加成
        if (selected.temp < 0) p = Math.min(lightCfg.maxChainChance, p + Math.abs(selected.temp) * lightCfg.tempChainMult);

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

                // ─────────────────────────────────────────────────────────────
                // [词条 Hook] 雷暴之语（thunderstorm）
                // 效果：提升闪电链的伤害衰减系数（decayBonus 越大，衰减越少）
                // 公式：decayFactor = base + perLevel * level + thunderstorm.params.decayBonus
                // ─────────────────────────────────────────────────────────────
                let decayFactor = lightCfg.damageDecayBase + (lightCfg.damageDecayPerLevel * level);
                const thunderstormEffect = this.activeRunewordEffects && this.activeRunewordEffects['thunderstorm'];
                if (thunderstormEffect) {
                    // decayBonus 增加衰减系数（越接近 1.0 衰减越少）
                    // 限制最大値为 0.95，防止无限伤害
                    decayFactor = Math.min(0.95, decayFactor + (thunderstormEffect.params.decayBonus || 0));
                }
                // --- [属性共鸣] 雷霆共鸣：读取 chainDecayReduction，降低闪电链伤害衰减 ---
                // 三阶共鸣：衰减系数额外 +0.2（默认 0.45 提升至 0.65）
                const _lightningRes = this.activeElementResonances && this.activeElementResonances['lightning'];
                const _lightningResParams = _lightningRes ? _lightningRes.params : null;
                const _chainDecayReduction = _lightningResParams ? (_lightningResParams.chainDecayReduction || 0) : 0;
                if (_chainDecayReduction > 0) {
                    decayFactor = Math.min(0.95, decayFactor + _chainDecayReduction);
                }

                const nextDmg = Math.max(1, Math.floor(dmg * decayFactor));
                // 伤害与状态：提升温度 (公式：闪电层数 + 连锁次数/3)
                const chainCountInner = history.length;
                selected.applyTemp(level + chainCountInner / 3);

                // [词条 Hook] 元素聚变（elemental_fusion）
                // 标记该敌人本回合被闪电命中（用于元素聚变的三元素判断）
                selected._lightningHitThisRound = true;

                const result = selected.takeDamage(dmg);
                this.combat_recordDamage(result.actualDamage, 'lightning', 'main', shotId);

                if (result.killed) this.spawn_addScore(selected.maxHp);

                // ─────────────────────────────────────────────────────────────
                // [词条 Hook] 元素聚变（elemental_fusion）
                // 效果：当敌人同时承受火、冰、雷三种状态时，引发元素聚变爆炸
                // 判断条件：
                //   - 火：enemy.temp > 34（达到燃烧阈值）
                //   - 冰：enemy.temp < -34（达到冰冻阈值）
                //   - 雷：enemy._lightningHitThisRound === true
                // 注意：火和冰的 temp 互斥，但闪电命中后会提升 temp，
                //       所以实际触发条件是：_lightningHitThisRound && (temp > 34 || temp < -34)
                //       即：闪电命中 + 火状态，或 闪电命中 + 冰状态（但冰会被闪电的温度提升抵消）
                //       更合理的判断：_lightningHitThisRound && _pyroHitThisRound && _cryoHitThisRound
                // ─────────────────────────────────────────────────────────────
                this.combat_runeword_elementalFusion_check(selected, dmg, shotId);

                // 递归
                history.push(selected);
                // 限制最大连锁次数防止死循环 (增加到 100 次)
                if (history.length < 100) {
                    this.combat_lightning_triggerChain(selected, nextDmg, history, level, shotId);
                }

                // ─────────────────────────────────────────────────────────────
                // [词条 Hook] 雷霆散射（thunder_scatter）
                // 效果：每次成功触发闪电链时，有概率额外释放一条同属性闪电链
                // 概率：extraChains 次额外触发（每次独立判定 50% 概率）
                // 防循环：isExtraChain=true 时跳过，确保额外链不会再次触发 thunder_scatter
                // ─────────────────────────────────────────────────────────────
                const thunderScatterEffect = this.activeRunewordEffects && this.activeRunewordEffects['thunder_scatter'];
                if (thunderScatterEffect && selected.active && !isExtraChain) {
                    const extraChains = Math.floor(thunderScatterEffect.params.extraChains || 0);
                    for (let i = 0; i < extraChains; i++) {
                        // 每次额外触发有 50% 概率实际触发，防止过于强力
                        if (Math.random() < 0.5) {
                            // 额外闪电链使用相同的 level，但独立的 history
                            // isExtraChain=true：额外链不会再次触发 thunder_scatter，防止无限循环
                            const extraHistory = [...history];
                            this.combat_lightning_triggerChain(selected, nextDmg, extraHistory, level, shotId, 0, true);
                        }
                    }
                }
            }, delay);

            return true;
        }
        return false;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 4. 色差特效触发（通过 EventBus 事件，由 ui_system.js 监听并操作 DOM）
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_triggerChromaticAberration
     * @description 根据伤害大小触发 CRT 色差效果，限制触发频率（每 100ms 最多一次）。
     * @param {number} damage - 造成的伤害
     */
    combat_triggerChromaticAberration(damage) {
        // 频率限制：每100ms最多触发一次
        const now = Date.now();
        if (!this._lastChromaticTime) this._lastChromaticTime = 0;
        if (now - this._lastChromaticTime < 100) return;
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
        this._lastChromaticTime = now;
        // [Task 3.2] 改为 EventBus 事件，由 ui_system.js 监听并操作 CRT overlay DOM
        eventBus.emit(EVENT_TYPES.UI_CHROMATIC_ABERRATION, { effectClass, duration: 500 });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 5. [词条 Hook] 绝对零度（absolute_zero）辅助方法
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_runeword_absoluteZero_calcAmp
     * @description [词条 Hook] 绝对零度（absolute_zero）
     *   计算敌人当前的伤害加深系数。
     *
     *   效果：敌人处于冰冻状态时（temp <= -34），每次受到物理伤害，
     *         令该敌人本回合受到的所有伤害加深。
     *   实现：维护 enemy._absoluteZeroHitCount 计数器，
     *         每次命中时累加，伤害加深 = hitCount * damageAmp。
     *
     * @param {Enemy} enemy - 目标敌人
     * @returns {number} 伤害加深系数（0 表示不加深）
     */
    combat_runeword_absoluteZero_calcAmp(enemy) {
        const effect = this.activeRunewordEffects && this.activeRunewordEffects['absolute_zero'];
        if (!effect) return 0;

        // 判断敌人是否处于冰冻状态（temp <= -34 或已被标记为本回合冰冻）
        const isFrozen = enemy.temp <= -34 || enemy.isFrozenCurrentTurn;
        if (!isFrozen) return 0;

        // 累加命中计数
        if (!enemy._absoluteZeroHitCount) enemy._absoluteZeroHitCount = 0;
        enemy._absoluteZeroHitCount++;

        // 计算伤害加深系数：hitCount * damageAmp
        const damageAmp = effect.params.damageAmp || 0;
        return enemy._absoluteZeroHitCount * damageAmp;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 6. [词条 Hook] 元素聚变（elemental_fusion）触发检查
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_runeword_elementalFusion_check
     * @description [词条 Hook] 元素聚变（elemental_fusion）
     *   当敌人同时承受火、冰、雷三种状态时，引发元素聚变爆炸。
     *
     *   触发条件：
     *   - 火状态：enemy._pyroHitThisRound === true（本回合被火属性命中）
     *   - 冰状态：enemy._cryoHitThisRound === true（本回合被冰属性命中）
     *   - 雷状态：enemy._lightningHitThisRound === true（本回合被闪电命中）
     *
     *   爆炸伤害：enemy.maxHp * trueDamageRatio（真实伤害，无视护盾）
     *
     * @param {Enemy} enemy - 目标敌人
     * @param {number} baseDmg - 触发伤害（用于计算爆炸伤害）
     * @param {number|null} shotId - 子弹ID
     */
    combat_runeword_elementalFusion_check(enemy, baseDmg, shotId) {
        const effect = this.activeRunewordEffects && this.activeRunewordEffects['elemental_fusion'];
        if (!effect) return;
        if (!enemy || !enemy.active) return;

        // 检查三元素状态是否同时存在
        const hasPyro = !!enemy._pyroHitThisRound;
        const hasCryo = !!enemy._cryoHitThisRound;
        const hasLightning = !!enemy._lightningHitThisRound;

        // [技能系统迭代] 棱光炮技能的 _forceFusion 标记强制触发元素聚变
        const isForceFusion = !!(enemy._forceFusionThisRound);
        if (!isForceFusion && (!hasPyro || !hasCryo || !hasLightning)) return;

        // 防止同一帧多次触发（冷却 500ms）
        const now = Date.now();
        if (enemy._elementalFusionLastTrigger && now - enemy._elementalFusionLastTrigger < 500) return;
        enemy._elementalFusionLastTrigger = now;

        // 计算聚变爆炸伤害（基于敌人最大血量的百分比）
        const trueDamageRatio = effect.params.trueDamageRatio || 0.10;
        const fusionDmg = Math.max(1, Math.floor(enemy.maxHp * trueDamageRatio));

        // ═══════════════════════════════════════════════════════
        // 视觉特效：三色元素聚变爆炸（大幅加强版）
        // ═══════════════════════════════════════════════════════
        const ex = enemy.pos.x, ey = enemy.pos.y;

        // 1. 三重冲击波（火/冰/雷 三色，半径递增）
        this.spawn_createShockwave(ex, ey, '#f97316'); // 橙色火焰冲击波（最内层）
        this.spawn_createShockwave(ex, ey, '#06b6d4'); // 青色冰霜冲击波（中层）
        this.spawn_createShockwave(ex, ey, '#f0abfc'); // 紫粉色聚变冲击波（最外层）

        // 2. 三属性粒子爆发（大幅增量：每色 16 颗，共 48 颗）
        for (let i = 0; i < 16; i++) this.spawn_createParticle(ex, ey, '#f97316', 'spark');  // 火焰火花
        for (let i = 0; i < 16; i++) this.spawn_createParticle(ex, ey, '#06b6d4', 'shard');  // 冰晶碎片
        for (let i = 0; i < 16; i++) this.spawn_createParticle(ex, ey, '#c084fc', 'spark');  // 雷电火花

        // 3. 额外的白色核心爆发（聚变核心闪光）
        for (let i = 0; i < 10; i++) this.spawn_createParticle(ex, ey, '#ffffff', 'spark');

        // 4. 烟雾残留（三色混合，增加厚重感）
        for (let i = 0; i < 6; i++) this.spawn_createParticle(ex, ey, '#fde68a', 'mist');  // 暖色烟雾
        for (let i = 0; i < 6; i++) this.spawn_createParticle(ex, ey, '#a5f3fc', 'mist');  // 冷色烟雾

        // 5. 敌人超强震动（hitTimer=40，震动幅度 20px，远超普通暴击的 14px）
        enemy.hitTimer = Math.max(enemy.hitTimer, 40);

        // 6. 全局屏幕震动
        if (typeof this.triggerScreenShake === 'function') this.triggerScreenShake(18);

        // 7. 全屏紫色闪光（通过 EventBus 触发 UI 层）
        if (typeof eventBus !== 'undefined' && typeof EVENT_TYPES !== 'undefined') {
            eventBus.emit(EVENT_TYPES.UI_FLASH_EFFECT, { color: '#f0abfc', alpha: 0.25, duration: 350 });
            eventBus.emit(EVENT_TYPES.UI_CHROMATIC_ABERRATION, { effectClass: 'chromatic-heavy', duration: 600 });
        }

        audio.playExplosion && audio.playExplosion();

        // 造成真实伤害（直接调用 takeDamage，不经过护盾）
        const fusionResult = enemy.takeDamage(fusionDmg, null, true);
        this.combat_recordDamage(fusionResult.actualDamage, 'lightning', 'main', shotId);

        // 8. 超大浮动文字（字号 28px，三行：标题 + 伤害数值）
        this.spawn_createFloatingText(ex, ey - 60, `⚗️ ELEMENTAL FUSION!`, '#f0abfc', 22);
        this.spawn_createFloatingText(ex, ey - 30, `${Math.ceil(fusionResult.actualDamage)}`, '#ffffff', 28);

        if (fusionResult.killed) this.spawn_addScore(enemy.maxHp);

        // 重置三元素状态标记（聚变后需要重新积累）
        enemy._pyroHitThisRound = false;
        enemy._cryoHitThisRound = false;
        enemy._lightningHitThisRound = false;
        enemy._forceFusionThisRound = false; // [技能系统迭代] 重置棱光炮强制聚变标记
    },

};

// 暴露到全局，供非模块化脚本访问
window.DamageCalc = DamageCalc;
