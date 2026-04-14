/**
 * @file collision.js
 * @description 碰撞检测模块 —— 从 combat_system.js 拆分出的碰撞检测函数。
 *
 * 包含：
 *  - 敌人移动碰撞检测（AABB + 边界检测）
 *  - 激光射线检测（墙壁反射面 + 护盾敌人）
 *  - 激光穿透伤害处理（线段与敌人的碰撞判定）
 *  - 激光折射任务生成（击中敌人后概率触发，消耗 bounce 层数）
 *
 * 使用方式：通过 window.CollisionSystem 访问，或直接 import。
 * 所有方法均以 mixin 形式设计，需绑定到 Game 实例（this）上调用。
 */

import { CONFIG } from '../config.js';
import { Vec2 } from '../entities.js';

/**
 * @namespace CollisionSystem
 * @description 碰撞检测 mixin，挂载到 Game 实例上使用。
 */
export const CollisionSystem = {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. 敌人移动碰撞检测
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_tryMoveEnemy
     * @description 尝试移动敌人，确保其不超出边界且不与其他敌人重叠。
     *   使用 AABB（轴对齐包围盒）碰撞检测。
     * @param {Enemy} enemy - 要移动的敌人
     * @param {Vec2} delta - 移动向量
     * @returns {boolean} 是否成功移动
     */
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

    // ─────────────────────────────────────────────────────────────────────────
    // 2. 激光射线检测（反射面检测）
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_laser_castRay
     * @description 寻找最近的反射面（墙壁或带盾敌人）。
     *   用于激光射线追踪，决定激光在哪里折射或终止。
     * @param {Vec2} start - 射线起点
     * @param {Vec2} dir - 射线方向（单位向量）
     * @param {number} maxDist - 最大检测距离
     * @returns {{ dist: number, hitType: string, normal: string|null, enemy: Enemy|null }}
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

            // 使用线段与矩形相交检测（Slab method 简化版）
            const halfW = e.width / 2 + 5;
            const halfH = e.height / 2 + 5;

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

    // ─────────────────────────────────────────────────────────────────────────
    // 3. 激光穿透伤害处理（线段与敌人碰撞）+ 折射任务生成
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_laser_processPenetration
     * @description 处理激光线段路径上所有普通敌人的穿透伤害，并在命中后尝试触发折射。
     *
     *   【照射词条激活时的特殊行为】：
     *     - 不穿透：激光命中第一个敌人后立即停止，不继续伤害后续敌人。
     *     - 强制随机折射：命中第一个敌人后，在折射搜寻半径内随机选取一个目标进行折射，
     *       不消耗 bounce 层数，折射方向每次重新计算（由持续照射状态机每 0.5s 重调本函数）。
     *     - 穿透层数改为伤害加深：每层 pierce 使该次命中伤害额外 +1%。
     *
     *   【普通模式（无照射词条）】：
     *     穿透衰减：第 n 个目标（0-indexed）受到的伤害 = 原始伤害 × (0.5)^n
     *     折射机制：每个被命中的敌人独立判定折射概率，触发时消耗 1 层 bounce。
     *
     * @param {Vec2} p1 - 线段起点
     * @param {Vec2} p2 - 线段终点
     * @param {Object} recipe - 子弹配方（包含 laser、explosive、pierce、bounce 等属性）
     * @param {number} remainLen - 当前射线的剩余长度（用于折射继承）
     * @param {number} bouncesLeft - 当前射线剩余的反弹次数
     * @param {Set<Enemy>} hitEnemiesSet - 本次激光（含所有折射链）已命中的敌人集合（防循环）
     * @param {number} currentWidth - 当前射线的视觉宽度（折射时衰减）
     * @param {number} refractionDepth - 当前折射深度（0 为主射线），用于概率衰减计算
     * @returns {{ refractionTasks: Array, bouncesLeft: number }}
     *   refractionTasks: 折射任务列表，每项为 { startPos, dir, remainLen, recipe, bouncesLeft, hitEnemiesSet, width, refractionDepth }
     *   bouncesLeft: 处理后剩余的反弹次数（已被折射消耗）
     */
    combat_laser_processPenetration(p1, p2, recipe, remainLen = 0, bouncesLeft = 0, hitEnemiesSet = null, currentWidth = null, refractionDepth = 0) {
        const laserVisualWidth = currentWidth !== null
            ? currentWidth
            : 3 + (recipe.laser * 4) + (recipe.explosive ? 10 : 0);
        const laserLogicRadius = laserVisualWidth / 2;

        // 初始化已命中集合（首次调用时创建）
        if (!hitEnemiesSet) hitEnemiesSet = new Set();

        // 构建线段包围盒用于快速剔除
        const minX = Math.min(p1.x, p2.x) - 20;
        const maxX = Math.max(p1.x, p2.x) + 20;
        const minY = Math.min(p1.y, p2.y) - 20;
        const maxY = Math.max(p1.y, p2.y) + 20;

        // 收集命中敌人及其在激光路径上的投影参数 t（0~1），按距离排序
        const hits = [];
        const l2 = p1.dist(p2) * p1.dist(p2);
        if (l2 === 0) return { refractionTasks: [], bouncesLeft };

        this.enemies.forEach(e => {
            if (!e.active) return;
            // 快速包围盒剔除
            if (e.pos.x < minX || e.pos.x > maxX || e.pos.y < minY || e.pos.y > maxY) return;
            // 点到线段距离公式
            let t = ((e.pos.x - p1.x) * (p2.x - p1.x) + (e.pos.y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * (p2.x - p1.x);
            const projY = p1.y + t * (p2.y - p1.y);
            const dist = Math.sqrt(Math.pow(e.pos.x - projX, 2) + Math.pow(e.pos.y - projY, 2));
            // 判定半径：敌人半径 + 激光粗细
            const enemyRadius = Math.min(e.width, e.height) / 2;
            const totalHitRadius = enemyRadius + laserLogicRadius;
            if (dist < totalHitRadius) {
                hits.push({ enemy: e, t, projX, projY });
            }
        });

        // 按激光路径顺序排序（t 值从小到大，即从激光起点到终点）
        hits.sort((a, b) => a.t - b.t);

        // 折射任务列表
        const refractionTasks = [];

        // 读取折射配置
        const rfCfg = CONFIG.gameplay;
        const rfBaseChance = rfCfg.laserRefractionBaseChance || 0.30;
        const rfBounceBonus = rfCfg.laserRefractionBounceBonus || 0.05;
        const rfMaxChance = rfCfg.laserRefractionMaxChance || 0.80;
        const rfRadius = rfCfg.laserRefractionRadius || 150;
        const rfDmgDecay = rfCfg.laserRefractionDamageDecay || 0.75;
        const rfWidthDecay = rfCfg.laserRefractionWidthDecay || 0.85;
        const rfDepthDecay = rfCfg.laserRefractionDepthDecay || 0.65;

        // ─────────────────────────────────────────────────────────────────────
        // [照射词条] 检查是否激活
        // ─────────────────────────────────────────────────────────────────────
        const irradiationFx = this.activeRunewordEffects && this.activeRunewordEffects['irradiation'];

        if (irradiationFx) {
            // ═════════════════════════════════════════════════════════════════
            // 【照射模式】：不穿透，命中第一个敌人后强制随机折射
            // ═════════════════════════════════════════════════════════════════
            if (hits.length === 0) return { refractionTasks: [], bouncesLeft };

            // 只取第一个命中的敌人
            const hit = hits[0];
            const amp = (irradiationFx.params && irradiationFx.params.damageAmp) || 0;

            // 穿透层数改为伤害加深：每层 pierce +1% 伤害
            const pierce = recipe.pierce || 0;
            const pierceBonus = 1 + pierce * 0.01;
            const finalDamage = recipe.damage * pierceBonus;
            const finalRecipe = { ...recipe, damage: finalDamage };

            // 对第一个敌人造成伤害
            this.combat_damageEnemy(hit.enemy, { config: finalRecipe, pos: new Vec2(hit.projX, hit.projY), isCopy: false });
            hitEnemiesSet.add(hit.enemy);

            // 视觉：受击点特效
            if (Math.random() < 0.3) this.spawn_createParticle(hit.projX, hit.projY, '#fff', 'spark');

            // 照射词条 Hook：累积照射同一敌人伤害加深
            if (!hit.enemy._irradiationStacks) hit.enemy._irradiationStacks = 0;
            hit.enemy._irradiationStacks++;
            const stackDmg = hit.enemy._irradiationStacks * amp * finalDamage;
            if (stackDmg >= 1) {
                const stackResult = hit.enemy.takeDamage(stackDmg);
                this.combat_recordDamage(stackResult.actualDamage, 'pyro', 'main', null);
                this.spawn_createFloatingText(hit.enemy.pos.x, hit.enemy.pos.y - 35, `照射+${Math.ceil(stackResult.actualDamage)}`, '#fbbf24');
            }

            // 炽热光线词条 Hook：激光命中敌人时额外升温
            const blazingBeamFx = this.activeRunewordEffects && this.activeRunewordEffects['blazing_beam'];
            if (blazingBeamFx) {
                const tempIncrease = (blazingBeamFx.params && blazingBeamFx.params.tempIncrease) || 0;
                hit.enemy.applyTemp(tempIncrease);
                if (Math.random() < 0.3) this.spawn_createParticle(hit.projX, hit.projY, '#f97316', 'spark');
            }

            // 强制随机折射：在折射半径内随机选取一个未被命中的敌人
            const rfSearchRadius = rfCfg.laserRefractionRadius || 150;
            const candidates = this.enemies.filter(e =>
                e.active &&
                e !== hit.enemy &&
                !hitEnemiesSet.has(e) &&
                e.pos.dist(hit.enemy.pos) <= rfSearchRadius
            );

            if (candidates.length > 0) {
                // 随机选取目标
                const target = candidates[Math.floor(Math.random() * candidates.length)];
                const rfDir = target.pos.sub(new Vec2(hit.projX, hit.projY)).norm();
                const rfRemainLen = remainLen * (1 - hit.t);
                // 折射伤害：继承当前伤害 × 折射衰减系数
                const rfDamage = finalDamage * rfDmgDecay;
                const rfWidth = Math.max(1, laserVisualWidth * rfWidthDecay);

                // 折射特效：金色火花（代表照射词条触发）
                this.spawn_createParticle(hit.projX, hit.projY, '#fbbf24', 'spark');
                this.spawn_createParticle(hit.projX, hit.projY, '#fde68a', 'spark');

                // 折射任务加入队列（不消耗 bounce，bouncesLeft 保持不变）
                refractionTasks.push({
                    startPos: new Vec2(hit.projX, hit.projY),
                    dir: rfDir,
                    remainLen: rfRemainLen,
                    recipe: { ...recipe, damage: rfDamage },
                    bouncesLeft,
                    hitEnemiesSet,
                    width: rfWidth,
                    refractionDepth: refractionDepth + 1
                });
            }

            return { refractionTasks, bouncesLeft };
        }

        // ═════════════════════════════════════════════════════════════════════
        // 【普通模式】：穿透衰减 + 概率折射（原有逻辑）
        // ═════════════════════════════════════════════════════════════════════

        // 按穿透顺序施加衰减伤害：第 n 个目标（0-indexed）受到 原始伤害 × 0.5^n
        hits.forEach((hit, index) => {
            const damageMultiplier = Math.pow(0.5, index);
            const attenuatedDamage = recipe.damage * damageMultiplier;
            // 构造衰减后的配方，仅覆盖 damage 字段，其余属性保持不变
            const attenuatedRecipe = { ...recipe, damage: attenuatedDamage };
            this.combat_damageEnemy(hit.enemy, { config: attenuatedRecipe, pos: new Vec2(hit.projX, hit.projY), isCopy: false });
            // 将此敌人加入已命中集合
            hitEnemiesSet.add(hit.enemy);
            // 视觉：受击点特效
            if (Math.random() < 0.3) this.spawn_createParticle(hit.projX, hit.projY, '#fff', 'spark');

            // [Agent D] 笼热光线词条 Hook：激光命中敌人时额外升温
            const blazingBeamFx = this.activeRunewordEffects && this.activeRunewordEffects['blazing_beam'];
            if (blazingBeamFx) {
                const tempIncrease = (blazingBeamFx.params && blazingBeamFx.params.tempIncrease) || 0;
                hit.enemy.applyTemp(tempIncrease);
                if (Math.random() < 0.3) this.spawn_createParticle(hit.projX, hit.projY, '#f97316', 'spark');
            }

            // ─────────────────────────────────────────────────────────────────
            // [激光折射] 根据 pierce 与 bounce 大小关系决定折射触发位置：
            //   pierce > bounce：穿透主导，不触发折射
            //   bounce > pierce：折射主导，第一个命中的敌人即触发
            //   bounce === pierce（含两者均为 0）：最后一个命中的敌人触发
            // ─────────────────────────────────────────────────────────────────
            const pierce = recipe.pierce || 0;
            const bounce = recipe.bounce || 0;
            // pierce > bounce：穿透主导，完全不折射
            const refractionAllowed = pierce <= bounce;
            // bounce > pierce：折射主导，第一个命中即触发；否则最后一个命中触发
            const isFirstHit = (index === 0);
            const isLastHit  = (index === hits.length - 1);
            const isRefractionTriggerHit = bounce > pierce ? isFirstHit : isLastHit;
            if (refractionAllowed && isRefractionTriggerHit && bouncesLeft > 0 && remainLen > 10) {
                // 折射概率：(基础 + 每层 bounce 加成) × 层级衰减系数^depth，上限 maxChance
                const baseChance = Math.min(rfMaxChance, rfBaseChance + bouncesLeft * rfBounceBonus);
                const triggerChance = baseChance * Math.pow(rfDepthDecay, refractionDepth);
                if (Math.random() < triggerChance) {
                    // 在折射半径内寻找合法目标（排除已命中的敌人）
                    const candidates = this.enemies.filter(e =>
                        e.active &&
                        e !== hit.enemy &&
                        !hitEnemiesSet.has(e) &&
                        e.pos.dist(hit.enemy.pos) <= rfRadius
                    );

                    if (candidates.length > 0) {
                        // 随机选取一个目标
                        const target = candidates[Math.floor(Math.random() * candidates.length)];
                        // 计算折射方向（从当前命中点指向目标中心）
                        const rfDir = target.pos.sub(new Vec2(hit.projX, hit.projY)).norm();
                        // 折射光线的剩余长度：当前射线剩余长度 × 命中点之后的比例
                        const rfRemainLen = remainLen * (1 - hit.t);
                        // 折射伤害：当前衰减后伤害 × 折射衰减系数
                        const rfDamage = attenuatedDamage * rfDmgDecay;
                        // 折射光线宽度：当前宽度 × 宽度衰减系数（最小 1px）
                        const rfWidth = Math.max(1, laserVisualWidth * rfWidthDecay);

                        // 消耗一层 bounce
                        bouncesLeft--;

                        // 折射特效：在折射点生成绿色火花（代表 Bounce 属性触发）
                        this.spawn_createParticle(hit.projX, hit.projY, '#a3e635', 'spark');
                        this.spawn_createParticle(hit.projX, hit.projY, '#22c55e', 'spark');

                        // 将折射任务加入队列，并传递折射深度 +1
                        refractionTasks.push({
                            startPos: new Vec2(hit.projX, hit.projY),
                            dir: rfDir,
                            remainLen: rfRemainLen,
                            recipe: { ...recipe, damage: rfDamage },
                            bouncesLeft,
                            hitEnemiesSet,
                            width: rfWidth,
                            refractionDepth: refractionDepth + 1
                        });
                    }
                }
            }
        });

        return { refractionTasks, bouncesLeft };
    },

};

// 暴露到全局，供非模块化脚本访问
window.CollisionSystem = CollisionSystem;
