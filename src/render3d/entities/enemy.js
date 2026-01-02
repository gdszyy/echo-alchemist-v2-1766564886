/**
 * render3d/entities/enemy.js - 敌人3D渲染实体
 * 
 * 职责：
 * - 管理敌人的3D立方体渲染
 * - 实现受击闪烁效果（透明度+震动）
 * - 实现温度变色效果
 * - 实现生成弹出动画
 * - 实现死亡下沉动画
 * - 使用"地板平面 + 立方体"结构（Task 3.3）
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

export class Enemy3D {
    /**
     * 构造函数：创建敌人的3D表示
     * @param {object} enemy2D - 2D游戏逻辑中的敌人实体
     * @param {THREE.Scene} scene - three.js场景
     */
    constructor(enemy2D, scene) {
        this.enemy2D = enemy2D; // 引用2D逻辑实体
        this.scene = scene;
        
        // === 视觉状态 ===
        this.hitFlashTimer = 0;          // 受击闪烁计时器
        this.hitFlashDuration = 0.3;     // 闪烁持续时间（秒）
        this.spawnAnimProgress = 0;      // 生成动画进度 (0 → 1)
        this.deathAnimProgress = 0;      // 死亡动画进度 (0 → 1)
        this.isSpawning = true;          // 是否正在生成
        this.isDying = false;            // 是否正在死亡
        
        // === 温度视觉 ===
        this.currentColor = new THREE.Color(0x475569); // 当前颜色（默认灰色）
        this.targetColor = new THREE.Color(0x475569);  // 目标颜色
        
        // === 震动效果 ===
        this.shakeOffset = new THREE.Vector3(0, 0, 0);
        
        // 创建THREE.Group容器，用于组合地板和立方体
        this.group = new THREE.Group();
        
        // 创建3D网格
        this.createMesh();
        
        console.log('[Enemy3D] 创建敌人3D实体', {
            hp: enemy2D.hp,
            maxHp: enemy2D.maxHp,
            type: enemy2D.type
        });
    }
    
    /**
     * 创建3D网格（地板平面 + 立方体）
     */
    createMesh() {
        // 根据2D敌人的尺寸创建立方体
        const width = this.enemy2D.width / 50; // 缩放到合适的3D尺寸
        const height = this.enemy2D.height / 50;
        const depth = Math.min(width, height); // 深度取宽高的较小值
        
        // === 1. 创建地板平面 ===
        const floorWidth = width;
        const floorDepth = depth;
        const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
        
        // 地板材质 - 使用深色半透明
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            metalness: 0.2,
            roughness: 0.8
        });
        
        this.floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        // 旋转地板使其水平
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.position.y = 0; // 地板在底部
        
        this.group.add(this.floorMesh);
        
        // === 2. 创建立方体几何体（敌人主体）===
        const cubeSize = Math.min(width, height) * 0.8; // 立方体略小于地板
        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        
        // 根据敌人类型选择初始颜色
        let cubeColor = 0x475569; // 默认灰色
        if (this.enemy2D.type === 'elite') {
            cubeColor = 0x581c87; // 精英敌人 - 紫色
        } else if (this.enemy2D.type === 'boss') {
            cubeColor = 0x7f1d1d; // Boss - 深红色
        }
        
        this.currentColor = new THREE.Color(cubeColor);
        this.targetColor = new THREE.Color(cubeColor);
        
        // 创建材质
        this.material = new THREE.MeshStandardMaterial({
            color: this.currentColor,
            metalness: 0.3,
            roughness: 0.4,
            transparent: true,
            opacity: 1.0,
            emissive: cubeColor,
            emissiveIntensity: 0.2
        });
        
        // 创建网格
        this.mesh = new THREE.Mesh(geometry, this.material);
        
        // 立方体位于地板上方
        this.mesh.position.y = cubeSize / 2;
        
        this.group.add(this.mesh);
        
        // === 3. 添加边缘线框（增强视觉效果）===
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
        });
        this.edgesMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        this.edgesMesh.position.y = cubeSize / 2;
        this.group.add(this.edgesMesh);
        
        // 设置初始位置（从2D位置转换）
        this.updatePosition();
        
        // 初始缩放为0（用于生成动画）
        this.group.scale.set(0, 0, 0);
        
        // 添加到场景
        this.scene.add(this.group);
    }
    
    /**
     * 更新3D位置（从2D位置同步）
     */
    updatePosition() {
        if (!this.group) return;
        
        // 将2D Canvas坐标转换为3D世界坐标
        // 假设Canvas中心对应3D世界原点
        const x = (this.enemy2D.pos.x - 400) / 50; // 400是Canvas宽度的一半，50是缩放因子
        const y = -(this.enemy2D.pos.y - 300) / 50; // Y轴翻转，300是Canvas高度的一半
        const z = 0;
        
        this.group.position.set(x, y, z);
    }
    
    /**
     * 触发受击闪烁效果
     */
    triggerHitFlash() {
        this.hitFlashTimer = this.hitFlashDuration;
        console.log('[Enemy3D] 触发受击闪烁');
    }
    
    /**
     * 更新受击闪烁效果
     * @param {number} deltaTime - 帧间隔时间
     */
    updateHitFlash(deltaTime) {
        if (this.hitFlashTimer <= 0) return;
        
        this.hitFlashTimer -= deltaTime;
        
        // 计算闪烁进度 (1 → 0)
        const progress = this.hitFlashTimer / this.hitFlashDuration;
        
        // === 透明度闪烁 ===
        // 使用正弦波实现快速闪烁
        const flashFrequency = 20; // 闪烁频率
        const opacity = 0.3 + 0.7 * Math.abs(Math.sin(progress * Math.PI * flashFrequency));
        this.material.opacity = opacity;
        
        // === 震动效果 ===
        // 震动强度随进度衰减
        const shakeIntensity = progress * 0.5;
        this.shakeOffset.x = (Math.random() - 0.5) * shakeIntensity;
        this.shakeOffset.y = (Math.random() - 0.5) * shakeIntensity;
        this.shakeOffset.z = (Math.random() - 0.5) * shakeIntensity;
        
        // 闪烁结束时恢复
        if (this.hitFlashTimer <= 0) {
            this.material.opacity = 1.0;
            this.shakeOffset.set(0, 0, 0);
        }
    }
    
    /**
     * 更新温度变色效果
     */
    updateTemperatureColor() {
        const temp = this.enemy2D.temp || 0;
        
        // 根据温度计算目标颜色
        let baseColor = 0x475569; // 默认灰色
        
        // 根据敌人类型调整基础颜色
        if (this.enemy2D.type === 'elite') {
            baseColor = 0x581c87; // 紫色
        } else if (this.enemy2D.type === 'boss') {
            baseColor = 0x7f1d1d; // 深红色
        }
        
        // 温度变色逻辑
        if (temp > 0) {
            // 高温 → 橙红色
            const t = Math.min(1, temp / 34);
            this.targetColor = this.lerpColor(
                new THREE.Color(baseColor),
                new THREE.Color(0xea580c), // 橙色
                t
            );
        } else if (temp < 0) {
            // 低温 → 青蓝色
            const t = Math.min(1, Math.abs(temp) / 34);
            this.targetColor = this.lerpColor(
                new THREE.Color(baseColor),
                new THREE.Color(0x0891b2), // 青色
                t
            );
        } else {
            // 常温
            this.targetColor = new THREE.Color(baseColor);
        }
        
        // 平滑过渡到目标颜色
        this.currentColor.lerp(this.targetColor, 0.1);
        this.material.color.copy(this.currentColor);
    }
    
    /**
     * 颜色线性插值辅助函数
     * @param {THREE.Color} color1 - 起始颜色
     * @param {THREE.Color} color2 - 目标颜色
     * @param {number} t - 插值系数 (0-1)
     * @returns {THREE.Color} 插值后的颜色
     */
    lerpColor(color1, color2, t) {
        const result = new THREE.Color();
        result.r = color1.r + (color2.r - color1.r) * t;
        result.g = color1.g + (color2.g - color1.g) * t;
        result.b = color1.b + (color2.b - color1.b) * t;
        return result;
    }
    
    /**
     * 更新生成弹出动画
     * @param {number} deltaTime - 帧间隔时间
     */
    updateSpawnAnimation(deltaTime) {
        if (!this.isSpawning) return;
        
        // 动画进度递增
        this.spawnAnimProgress += deltaTime * 2; // 0.5秒完成
        
        if (this.spawnAnimProgress >= 1.0) {
            this.spawnAnimProgress = 1.0;
            this.isSpawning = false;
        }
        
        // 使用缓动函数实现弹性效果
        const t = this.easeOutElastic(this.spawnAnimProgress);
        
        // 缩放动画：从0放大到1
        this.group.scale.set(t, t, t);
        
        // 位置动画：从上方弹出
        const baseY = -(this.enemy2D.pos.y - 300) / 50;
        const offsetY = (1 - this.spawnAnimProgress) * 5; // 从上方5个单位开始
        this.group.position.y = baseY + offsetY;
    }
    
    /**
     * 更新死亡下沉动画
     * @param {number} deltaTime - 帧间隔时间
     */
    updateDeathAnimation(deltaTime) {
        if (!this.isDying) return;
        
        // 动画进度递增
        this.deathAnimProgress += deltaTime * 1.5; // 约0.67秒完成
        
        if (this.deathAnimProgress >= 1.0) {
            this.deathAnimProgress = 1.0;
            // 动画完成后从场景中移除
            this.destroy();
            return;
        }
        
        // 使用缓动函数实现加速下沉
        const t = this.easeInCubic(this.deathAnimProgress);
        
        // 缩放动画：逐渐缩小
        const scale = 1 - t * 0.5; // 缩小到50%
        this.group.scale.set(scale, scale, scale);
        
        // 位置动画：向下沉降
        const baseY = -(this.enemy2D.pos.y - 300) / 50;
        const offsetY = -t * 8; // 下沉8个单位
        this.group.position.y = baseY + offsetY;
        
        // 透明度动画：逐渐消失
        this.material.opacity = 1 - t;
        
        // 旋转动画：旋转消失
        this.mesh.rotation.x += deltaTime * 2;
        this.mesh.rotation.y += deltaTime * 3;
    }
    
    /**
     * 缓动函数：弹性缓出
     * @param {number} t - 进度 (0-1)
     * @returns {number} 缓动后的值
     */
    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
            Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    
    /**
     * 缓动函数：立方缓入
     * @param {number} t - 进度 (0-1)
     * @returns {number} 缓动后的值
     */
    easeInCubic(t) {
        return t * t * t;
    }
    
    /**
     * 触发死亡动画
     */
    triggerDeath() {
        if (this.isDying) return;
        this.isDying = true;
        this.deathAnimProgress = 0;
        console.log('[Enemy3D] 触发死亡动画');
    }
    
    /**
     * 每帧更新
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime) {
        if (!this.group || !this.enemy2D.active) {
            // 如果2D敌人已经不活跃，触发死亡动画
            if (!this.isDying && this.group) {
                this.triggerDeath();
            }
        }
        
        // 更新生成动画
        if (this.isSpawning) {
            this.updateSpawnAnimation(deltaTime);
        }
        
        // 更新死亡动画
        if (this.isDying) {
            this.updateDeathAnimation(deltaTime);
            return; // 死亡动画期间不更新其他状态
        }
        
        // 更新位置（从2D同步）
        this.updatePosition();
        
        // 应用震动偏移
        if (this.shakeOffset.length() > 0.001) {
            this.group.position.add(this.shakeOffset);
        }
        
        // 更新受击闪烁
        this.updateHitFlash(deltaTime);
        
        // 更新温度变色
        this.updateTemperatureColor();
        
        // 检测受击（通过hitTimer）
        if (this.enemy2D.hitTimer > 0 && this.hitFlashTimer <= 0) {
            this.triggerHitFlash();
        }
    }
    
    /**
     * 销毁3D实体
     */
    destroy() {
        if (this.group) {
            // 清理所有子对象
            this.group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            
            this.scene.remove(this.group);
            this.group = null;
            this.mesh = null;
        }
        console.log('[Enemy3D] 销毁敌人3D实体');
    }
}


