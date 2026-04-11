/**
 * @file collision.js
 * @description 碰撞检测模块 —— 从 combat_system.js 拆分出的碰撞检测函数。
 *
 * 包含：
 *  - 敌人移动碰撞检测（AABB + 边界检测）
 *  - 激光射线检测（墙壁反射面 + 护盾敌人）
 *  - 激光穿透伤害处理（线段与敌人的碰撞判定）
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
    // 3. 激光穿透伤害处理（线段与敌人碰撞）
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @method combat_laser_processPenetration
     * @description 处理激光线段路径上所有普通敌人的穿透伤害。
     *   使用点到线段距离公式判定碰撞，对命中的敌人调用 combat_damageEnemy。
     * @param {Vec2} p1 - 线段起点
     * @param {Vec2} p2 - 线段终点
     * @param {Object} recipe - 子弹配方（包含 laser、explosive 等属性）
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
            // 快速包围盒剔除
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
                // 造成伤害（通过 combat_damageEnemy 统一处理）
                this.combat_damageEnemy(e, { config: recipe, pos: new Vec2(projX, projY), isCopy: false });

                // 视觉：受击点特效
                if (Math.random() < 0.3) this.spawn_createParticle(projX, projY, '#fff', 'spark');
            }
        });
    },

};

// 暴露到全局，供非模块化脚本访问
window.CollisionSystem = CollisionSystem;
