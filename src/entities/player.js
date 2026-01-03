/**
 * player.js - 玩家类模块
 * 
 * 职责：
 * - 玩家实体的完整实现
 * - 玩家状态管理
 * - 玩家技能和装备系统
 * 
 * 包含的类：
 * - Player: 玩家类（包含24个方法）
 */

import { Vec2 } from './mechanics.js';
import { CONFIG } from '../config.js';

class Player {
    /**
     * 玩家类构造函数
     * @param {Game} game - 游戏实例引用
     */
    constructor(game) {
        this.game = game;
        
        // === 位置 ===
        // 发射器固定在屏幕底部中央
        this.pos = new Vec2(game.width / 2, game.height - 80);
        
        // === 发射状态 ===
        this.isChargingShot = false;    // 蓄力吸收中
        this.chargeProgress = 0;        // 蓄力进度 (0 → 1)
        this.pendingFireVelocity = null; // 待发射的速度向量
        
        // === 装填状态 ===
        this.isReloading = false;       // 装填抓取中
        this.reloadProgress = 0;        // 装填进度 (0 → 1)
        
        // === 轨道状态 ===
        this.orbitalAngle = 0;          // 当前轨道旋转角度（弧度）
        this.spinBoost = 0;             // 额外旋转速度（受撞击增加）
        
        // === 瞄准状态 ===
        this.isDragging = false;        // 是否正在拖拽瞄准
        this.dragStart = new Vec2(0, 0); // 拖拽起始点
        this.dragCurrent = new Vec2(0, 0); // 当前拖拽位置
        this.lastMousePos = new Vec2(0, 0); // 最后鼠标位置
        
        // === 视觉参数 ===
        this.baseRadius = 22;           // 发射器基础半径
        this.previewRotation = -Math.PI / 2; // 预览旋转角度（默认朝上）
        this.deformation = { x: 1, y: 1 };   // 形变参数
        
        // === 警戒区 ===
        this.alertZoneRadius = 1;       // 警戒区半径（网格数），1 = 3x3
    }
    
    /**
     * 获取发射器当前位置
     * @returns {Vec2} 发射器位置
     */
    getPosition() {
        return new Vec2(this.pos.x, this.pos.y);
    }
    
    /**
     * 更新发射器位置（用于窗口大小变化时）
     */
    updatePosition() {
        this.pos.x = this.game.width / 2;
        this.pos.y = this.game.height - 80;
    }
    
    // ==================== 核心更新方法 ====================
    
    /**
     * 每帧更新发射器物理状态
     * @param {number} timeScale - 时间缩放系数
     */
    update(timeScale) {
        // 1. 蓄力进度更新
        this.updateCharging(timeScale);
        
        // 2. 装填进度更新
        this.updateReloading(timeScale);
        
        // 3. 轨道旋转物理
        this.updateOrbitalPhysics(timeScale);
    }
    
    /**
     * 更新蓄力状态
     * @param {number} timeScale - 时间缩放系数
     */
    updateCharging(timeScale) {
        if (!this.isChargingShot) return;
        
        // 吸收速度：0.08 大约需要 12 帧 (0.2秒)，手感比较干脆
        this.chargeProgress += 0.08 * timeScale;
        
        if (this.chargeProgress >= 1.0) {
            // 动画结束，真正发射
            this.isChargingShot = false;
            this.chargeProgress = 0;
            
            if (this.pendingFireVelocity) {
                this.game.combat_fireNextShot(this.pendingFireVelocity);
                this.pendingFireVelocity = null;
                
                // 发射后立即触发"能量注入"动画
                this.triggerReload();
            }
        }
    }
    
    /**
     * 更新装填状态
     * @param {number} timeScale - 时间缩放系数
     */
    updateReloading(timeScale) {
        if (!this.isReloading) return;
        
        // 速度 0.035，让过程持续约 0.5秒，更具重量感
        this.reloadProgress += 0.035 * timeScale;
        
        if (this.reloadProgress >= 1.0) {
            this.isReloading = false;
            this.reloadProgress = 1.0;
            
            // 撞击时刻！给予轨道一个巨大的旋转初速度
            // 就像能量球狠狠砸在了轨道上，带动它疑狂旋转
            this.spinBoost = 0.002;
        }
    }
    
    /**
     * 更新轨道旋转物理
     * @param {number} timeScale - 时间缩放系数
     */
    updateOrbitalPhysics(timeScale) {
        // 基础旋转速度
        const baseSpeed = 0.00012;
        
        // 阻力衰减：每一帧速度乘以 0.95，快速慢下来
        this.spinBoost *= 0.95;
        if (this.spinBoost < 0.0001) this.spinBoost = 0;
        
        // 最终角度累加：基础速度 + 爆发速度
        let currentFrameSpeed = baseSpeed + this.spinBoost;
        this.orbitalAngle += currentFrameSpeed * timeScale * 60;
    }
    
    /**
     * 触发装填动画
     */
    triggerReload() {
        this.isReloading = true;
        this.reloadProgress = 0;
    }
    
    // ==================== 输入处理方法 ====================
    
    /**
     * 开始瞄准
     * @param {Vec2} mousePos - 鼠标位置
     * @returns {boolean} 是否成功开始瞄准
     */
    startAiming(mousePos) {
        // 检查是否可以开始瞄准
        if (this.game.ammoQueue.length === 0) return false;
        if (this.game.projectiles.length > 0) return false;
        if (this.game.burstQueue.length > 0) return false;
        
        this.isDragging = true;
        this.dragStart = this.getPosition();
        this.dragCurrent = mousePos;
        this.lastMousePos = mousePos;
        
        return true;
    }
    
    /**
     * 更新瞄准方向
     * @param {Vec2} mousePos - 鼠标位置
     */
    updateAiming(mousePos) {
        if (!this.isDragging) return;
        this.dragCurrent = mousePos;
        this.lastMousePos = mousePos;
    }
    
    /**
     * 结束瞄准并尝试发射
     * @returns {boolean} 是否触发了发射
     */
    endAiming() {
        if (!this.isDragging) return false;
        
        this.isDragging = false;
        const aimVector = this.lastMousePos.sub(this.pos);
        
        // 只有向上拖拽才发射
        if (aimVector.y < -20) {
            this.game.sys_resetMultiplier();
            
            // 保存计算好的力度，开启蓄力
            this.pendingFireVelocity = aimVector.norm().mult(12);
            this.isChargingShot = true;
            this.chargeProgress = 0;
            
            // 播放蓄力开始音效
            if (audio) audio.playTone(800, 'sine', 0.1, 0.1);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * 检查是否可以发射
     * @returns {boolean}
     */
    canFire() {
        return this.game.ammoQueue.length > 0 && 
               this.game.projectiles.length === 0 && 
               this.game.burstQueue.length === 0;
    }
    
    // ==================== 渲染方法 ====================
    
    /**
     * 绘制玩家（发射器 + 轨道 + 瞄准线）
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    draw(ctx) {
        const nextAmmo = this.game.ammoQueue.length > 0 ? this.game.ammoQueue[0] : null;
        
        // 计算当前绘制位置（可能有抖动）
        const drawPos = this.calculateDrawPosition();
        
        // 1. 绘制瞄准线（如果正在瞄准）
        if (this.isDragging && this.canFire()) {
            this.drawAimLine(ctx);
        }
        
        // 2. 绘制发射器底座
        this.drawBase(ctx, drawPos);
        
        // 3. 绘制属性轨道（在炮台核心下面）
        if (nextAmmo) {
            this.drawOrbitals(ctx, drawPos, nextAmmo);
        }
        
        // 4. 绘制炮台核心
        this.drawCore(ctx, drawPos, nextAmmo);
    }
    
    /**
     * 计算绘制位置（含抖动效果）
     * @returns {Vec2} 绘制位置
     */
    calculateDrawPosition() {
        const drawPos = this.getPosition();
        
        // 蓄力时的抖动效果
        if (this.isChargingShot) {
            const shake = Math.random() * 2;
            drawPos.x += (Math.random() - 0.5) * shake;
            drawPos.y += (Math.random() - 0.5) * shake;
        }
        
        return drawPos;
    }
    
    /**
     * 计算形变参数
     * @returns {object} 形变参数 {x, y}
     */
    calculateDeformation() {
        let deformation = { x: 1, y: 1 };
        
        // 拖拽时的形变
        if (this.isDragging) {
            const force = this.dragStart.sub(this.dragCurrent);
            if (force.mag() > 10) {
                deformation = { x: 1.15, y: 0.85 };
            }
        }
        
        // 蓄力时的放大
        if (this.isChargingShot) {
            const absorbScale = 1.0 + this.chargeProgress * 0.3;
            deformation.x *= absorbScale;
            deformation.y *= absorbScale;
        }
        
        return deformation;
    }
    
    /**
     * 计算预览旋转角度
     * @returns {number} 旋转角度（弧度）
     */
    calculatePreviewRotation() {
        if (this.isDragging) {
            const force = this.dragStart.sub(this.dragCurrent);
            if (force.mag() > 10) {
                return Math.atan2(force.y, force.x);
            }
        }
        return -Math.PI / 2; // 默认朝上
    }
    
    /**
     * 绘制发射器底座
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     * @param {Vec2} pos - 绘制位置
     */
    drawBase(ctx, pos) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // 深色半透明底 (Slate-900 80%)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.baseRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    /**
     * 绘制炮台核心
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     * @param {Vec2} pos - 绘制位置
     * @param {object|null} nextAmmo - 下一发弹药配方
     */
    drawCore(ctx, pos, nextAmmo) {
        if (nextAmmo) {
            const params = Projectile.calculateVisualParams(nextAmmo, false);
            const previewRotation = this.calculatePreviewRotation();
            const deformation = this.calculateDeformation();
            
            Projectile.drawVisuals(
                ctx, 
                pos.x, 
                pos.y, 
                params.radius, 
                nextAmmo, 
                previewRotation, 
                params.intensity, 
                deformation
            );
        } else {
            // 空仓状态
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#475569';
            ctx.stroke();
        }
    }
    
    /**
     * 绘制属性轨道
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     * @param {Vec2} pos - 中心位置
     * @param {object} recipe - 弹药配方
     */
    drawOrbitals(ctx, pos, recipe) {
        if (!recipe) return;
        
        // 收集属性统计
        const stats = [];
        const mapping = {
            damage:    { val: recipe.damage > 2 ? recipe.damage : 0 },
            bounce:    { val: recipe.bounce },
            pierce:    { val: recipe.pierce },
            scatter:   { val: recipe.scatter },
            cryo:      { val: recipe.cryo },
            multicast: { val: recipe.multicast },
            pyro:      { val: recipe.pyro },
            lightning: { val: recipe.lightning },
            laser:     { val: recipe.laser },
            explosive: { val: recipe.explosive ? 1 : 0 },
            flying_sword: { val: recipe.flying_sword || 0 }
        };
        
        Object.keys(mapping).forEach(key => {
            mapping[key].color = CONFIG.ui.attributeDisplay[key].color;
            mapping[key].icon = CONFIG.ui.attributeDisplay[key].icon;
            if (mapping[key].val > 0) stats.push(mapping[key]);
        });
        
        if (stats.length === 0) return;
        
        // === 动画数值计算 ===
        let currentRotation = this.orbitalAngle;
        let baseRadius = 55;
        let globalAlpha = 1.0;
        let orbScale = 1.0;
        
        if (this.isChargingShot) {
            const t = this.chargeProgress;
            baseRadius = 55 * (1 - t * t);
            currentRotation += t * 2; // 吸收时稍微加速旋转
            if (t > 0.8) globalAlpha = 1.0 - (t - 0.8) * 5;
            orbScale = 1 - t * 0.6;
        } else if (this.isReloading) {
            const t = this.reloadProgress;
            // 使用 EaseInCubic，能量球会从远处缓缓启动，快撞击时猛地加速
            const easeVal = t * t * t;
            const startDist = 450; // 从更远的地方（屏幕外）抓取回来
            const endDist = 55;
            baseRadius = startDist + (endDist - startDist) * easeVal;
            globalAlpha = easeVal;
            orbScale = 0.3 + 0.7 * easeVal;
            // 抓取时由于还没"合体"，产生轻微的抖动感
            const shake = (1 - t) * 5;
            baseRadius += (Math.random() - 0.5) * shake;
        }
        
        const radius = baseRadius;
        const stepAngle = (Math.PI * 2) / stats.length;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.globalAlpha = Math.max(0, globalAlpha);
        
        // 绘制轨道线（仅在非吸收状态画）
        if (radius > 15 && radius < 150) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * globalAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // 绘制每个属性球
        stats.forEach((stat, index) => {
            const angle = stepAngle * index + currentRotation;
            const ox = Math.cos(angle) * radius;
            const oy = Math.sin(angle) * radius;
            
            // 防御性检查：如果计算出的位置不是有效的数字，跳过绘制
            if (!isFinite(ox) || !isFinite(oy)) return;
            
            const speedGlow = Math.min(1, this.spinBoost * 2); // 撞击后的高光
            ctx.shadowBlur = (10 + speedGlow * 20) * orbScale;
            ctx.shadowColor = stat.color;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            
            const baseSize = Math.min(22, 14 + stat.val * 0.5);
            const currentSize = Math.max(0, baseSize * orbScale);
            
            // 绘制属性球
            ctx.beginPath();
            ctx.arc(ox, oy, currentSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = stat.color;
            ctx.lineWidth = (2 + speedGlow * 2) * orbScale;
            ctx.stroke();
            
            // 拖尾特效（增强撞击爆发感）
            const totalTrail = this.spinBoost * 3 + (this.isReloading ? (1 - this.reloadProgress) * 0.5 : 0);
            if (totalTrail > 0.05) {
                ctx.beginPath();
                ctx.strokeStyle = stat.color;
                ctx.lineWidth = 2 * orbScale;
                const dir = this.isReloading ? 1 : -1;
                ctx.arc(0, 0, radius, angle, angle + totalTrail * dir, this.isReloading);
                ctx.stroke();
            }
            
            // 绘制文字（仅在大小合适时）
            if (radius < 200 && currentSize > 8) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                if (stat.isMulticast) {
                    ctx.font = `bold ${12 * orbScale}px monospace`;
                    ctx.fillText(`x${1 + stat.val}`, ox, oy);
                } else {
                    ctx.font = `${10 * orbScale}px sans-serif`;
                    if (stat.val > 1) {
                        ctx.fillText(stat.icon, ox, oy - 5 * orbScale);
                        ctx.font = `bold ${9 * orbScale}px sans-serif`;
                        ctx.fillStyle = stat.color;
                        ctx.fillText(`${stat.val}`, ox, oy + 6 * orbScale);
                    } else {
                        ctx.font = `${14 * orbScale}px sans-serif`;
                        ctx.fillText(stat.icon, ox, oy);
                    }
                }
            }
        });
        
        ctx.restore();
    }
    
    /**
     * 绘制瞄准线
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    drawAimLine(ctx) {
        const start = this.getPosition();
        let force = this.lastMousePos.sub(start);
        
        // 只有向上拖拽才绘制
        if (force.y >= -20) return;
        
        const maxLen = 800;
        const radius = CONFIG.physics.bulletRadius;
        let dir = force.norm();
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        
        // 计算与边界的交点
        let distToX = Infinity;
        let distToY = Infinity;
        
        if (dir.x > 0) distToX = (this.game.width - radius - start.x) / dir.x;
        else if (dir.x < 0) distToX = (radius - start.x) / dir.x;
        if (dir.y < 0) distToY = (radius - start.y) / dir.y;
        
        let hitDist = Math.min(distToX, distToY);
        
        if (hitDist < maxLen) {
            // 绘制到碰撞点
            const hitPoint = start.add(dir.mult(hitDist));
            ctx.lineTo(hitPoint.x, hitPoint.y);
            
            // 计算反射方向
            const remainLen = maxLen - hitDist;
            let reflectDir = new Vec2(dir.x, dir.y);
            if (distToX < distToY) reflectDir.x *= -1;
            else reflectDir.y *= -1;
            
            // 绘制反射线
            const endPoint = hitPoint.add(reflectDir.mult(remainLen));
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.stroke();
            
            // 绘制终点标记
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.arc(endPoint.x, endPoint.y, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 直接绘制到最大长度
            const end = start.add(dir.mult(maxLen));
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // 绘制瞄准指示器（炮台方向）
        ctx.save();
        ctx.translate(start.x, start.y);
        ctx.rotate(Math.atan2(force.y, force.x));
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#818cf8';
        ctx.fillRect(10, -6, 12, 12);
        ctx.restore();
    }
    
    /**
     * 绘制空闲状态的炮台（无弹药时）
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    drawIdleCannon(ctx) {
        const start = this.getPosition();
        
        ctx.save();
        ctx.translate(start.x, start.y);
        ctx.rotate(-Math.PI / 2); // 朝上
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(8, -4, 8, 8);
        ctx.restore();
    }
    
    // ==================== 警戒区系统 ====================
    
    /**
     * 获取玩家所在的网格坐标
     * @returns {{col: number, row: number}} 网格坐标
     */
    getGridPosition() {
        const enemyWidth = this.game.enemyWidth;
        const enemyHeight = this.game.enemyHeight;
        
        return {
            col: Math.floor(this.pos.x / enemyWidth),
            row: Math.floor(this.pos.y / enemyHeight)
        };
    }
    
    /**
     * 检查敌人是否在警戒区内
     * @param {Enemy} enemy - 敌人实体
     * @param {number} viewShiftY - Y轴视差偏移
     * @returns {boolean} 是否在警戒区内
     */
    isEnemyInAlertZone(enemy, viewShiftY = 0) {
        if (!enemy.active) return false;
        
        const playerGrid = this.getGridPosition();
        
        // 计算敌人的实际位置（包含视差偏移）
        const enemyY = enemy.pos.y + viewShiftY;
        const enemyX = enemy.pos.x;
        
        // 计算敌人所在的网格位置
        const enemyCol = Math.floor(enemyX / this.game.enemyWidth);
        const enemyRow = Math.floor(enemyY / this.game.enemyHeight);
        
        // 检查是否在警戒区内
        const inAlertCol = Math.abs(enemyCol - playerGrid.col) <= this.alertZoneRadius;
        const inAlertRow = Math.abs(enemyRow - playerGrid.row) <= this.alertZoneRadius;
        
        return inAlertCol && inAlertRow;
    }
    
    /**
     * 绘制警戒区（应该在实体层绘制，在玩家下方）
     * @param {CanvasRenderingContext2D} ctx - 绘图上下文
     */
    drawAlertZone(ctx) {
        // 防御性检查
        if (!this.game.enemyWidth || !this.game.enemyHeight) {
            console.warn('enemyWidth or enemyHeight not initialized');
            return;
        }
        
        const enemyWidth = this.game.enemyWidth;
        const enemyHeight = this.game.enemyHeight;
        
        ctx.save();
        
        // 计算警戒区尺寸（3x3 网格）
        const alertWidth = enemyWidth * (this.alertZoneRadius * 2 + 1);
        const alertHeight = enemyHeight * (this.alertZoneRadius * 2 + 1);
        
        // 以玩家位置为中心计算警戒区左上角
        const alertX = this.pos.x - alertWidth / 2;
        const alertY = this.pos.y - alertHeight / 2;
        
        // 绘制警戒区背景高亮
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(alertX, alertY, alertWidth, alertHeight);
        
        // 绘制警戒区外边框（不绘制内部网格）
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(alertX, alertY, alertWidth, alertHeight);
        
        // 绘制警告文本
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.font = 'bold 12px monospace';
        ctx.fillText("⚠️ ALERT ZONE", alertX + 5, alertY + 18);
        
        ctx.restore();
    }
}



// ==================== 导出玩家类 ====================
export { Player };
