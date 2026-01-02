/**
 * camera.js - 游戏摄像机系统
 * 
 * 职责：
 * - 管理游戏视角的位置和缩放
 * - 提供平滑的摄像机移动和过渡
 * - 支持远距离视角切换查看敌人
 * 
 * 核心类：
 * - Camera: 摄像机类
 */

import { lerp } from './entities.js';

/**
 * Camera 类
 * 管理游戏视角，支持平滑移动和缩放
 */
class Camera {
    /**
     * @param {number} canvasWidth - Canvas 宽度
     * @param {number} canvasHeight - Canvas 高度
     */
    constructor(canvasWidth, canvasHeight) {
        // 摄像机当前位置 (世界坐标)
        this.x = 0;
        this.y = 0;
        
        // 摄像机目标位置
        this.targetX = 0;
        this.targetY = 0;
        
        // 摄像机缩放
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        
        // Canvas 尺寸
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // 平滑移动参数 (0-1, 越大越快)
        this.smoothness = 0.1;
        
        // 是否处于远距离视角模式
        this.isDistantView = false;
        
        // 是否正在移动（用于拖影效果）
        this.isMoving = false;
        
        // 移动阈值（小于此值认为静止）
        this.movementThreshold = 0.5;
        
        // 远距离视角的偏移量 (向上移动多少)
        this.distantViewOffset = 300;
        
        // 远距离视角的缩放
        this.distantViewZoom = 0.7;
        
        // 默认视角参数
        this.defaultY = 0;
        this.defaultZoom = 1.0;
    }
    
    /**
     * 更新摄像机尺寸 (当 Canvas 大小改变时调用)
     */
    resize(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }
    
    /**
     * 设置摄像机目标位置
     */
    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }
    
    /**
     * 设置摄像机缩放
     */
    setZoom(zoom) {
        this.targetZoom = Math.max(0.1, Math.min(2.0, zoom));
    }
    
    /**
     * 切换到远距离视角
     */
    enableDistantView() {
        if (this.isDistantView) return;
        this.isDistantView = true;
        
        // 设置目标为向上偏移
        this.targetY = -this.distantViewOffset;
        this.targetZoom = this.distantViewZoom;
    }
    
    /**
     * 切换回正常视角
     */
    disableDistantView() {
        if (!this.isDistantView) return;
        this.isDistantView = false;
        
        // 恢复默认视角
        this.targetY = this.defaultY;
        this.targetZoom = this.defaultZoom;
    }
    
    /**
     * 更新摄像机状态 (每帧调用)
     */
    update() {
        // 保存上一帧的位置
        const oldX = this.x;
        const oldY = this.y;
        const oldZoom = this.zoom;
        
        // 平滑插值到目标位置
        this.x = lerp(this.x, this.targetX, this.smoothness);
        this.y = lerp(this.y, this.targetY, this.smoothness);
        this.zoom = lerp(this.zoom, this.targetZoom, this.smoothness);
        
        // 检测是否正在移动
        const deltaX = Math.abs(this.x - oldX);
        const deltaY = Math.abs(this.y - oldY);
        const deltaZoom = Math.abs(this.zoom - oldZoom);
        
        // 如果位置或缩放变化超过阈值，认为正在移动
        this.isMoving = (deltaX > this.movementThreshold || 
                        deltaY > this.movementThreshold || 
                        deltaZoom > 0.001);
    }
    
    /**
     * 应用摄像机变换到 Canvas 上下文
     * @param {CanvasRenderingContext2D} ctx - Canvas 绘图上下文
     */
    apply(ctx) {
        // 先移动到画布中心
        ctx.translate(this.canvasWidth / 2, this.canvasHeight / 2);
        
        // 应用缩放
        ctx.scale(this.zoom, this.zoom);
        
        // 应用摄像机位置偏移 (注意是负值，因为摄像机向上移动时，世界向下移动)
        ctx.translate(-this.x, -this.y);
        
        // 再移回原点，使得 (0, 0) 在画布中心
        ctx.translate(-this.canvasWidth / 2, -this.canvasHeight / 2);
    }
    
    /**
     * 将屏幕坐标转换为世界坐标
     * @param {number} screenX - 屏幕 X 坐标
     * @param {number} screenY - 屏幕 Y 坐标
     * @returns {{x: number, y: number}} 世界坐标
     */
    screenToWorld(screenX, screenY) {
        // 考虑缩放和偏移的逆变换
        const worldX = (screenX - this.canvasWidth / 2) / this.zoom + this.x + this.canvasWidth / 2;
        const worldY = (screenY - this.canvasHeight / 2) / this.zoom + this.y + this.canvasHeight / 2;
        
        return { x: worldX, y: worldY };
    }
    
    /**
     * 将世界坐标转换为屏幕坐标
     * @param {number} worldX - 世界 X 坐标
     * @param {number} worldY - 世界 Y 坐标
     * @returns {{x: number, y: number}} 屏幕坐标
     */
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.canvasWidth / 2 - this.x) * this.zoom + this.canvasWidth / 2;
        const screenY = (worldY - this.canvasHeight / 2 - this.y) * this.zoom + this.canvasHeight / 2;
        
        return { x: screenX, y: screenY };
    }
}

export { Camera };
