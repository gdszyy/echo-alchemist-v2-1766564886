/**
 * render3d/effects/lightning.js - 闪电链3D渲染器
 * 
 * 职责：
 * - 将2D闪电链效果转换为3D渲染
 * - 使用THREE.LineSegments实现高性能闪电渲染
 * - 同步game.lightningBolts数据
 * - 实现闪电生长动画和闪烁效果
 * - 支持主干和分支的视觉层次
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

/**
 * 单个闪电链的3D表示
 */
export class Lightning3D {
    /**
     * 构造函数：创建闪电链的3D表示
     * @param {object} lightning2D - 2D游戏逻辑中的闪电实体
     * @param {THREE.Scene} scene - three.js场景
     */
    constructor(lightning2D, scene) {
        this.lightning2D = lightning2D; // 引用2D逻辑实体
        this.scene = scene;
        
        // 创建THREE.Group容器，用于组合主干和分支
        this.group = new THREE.Group();
        
        // 创建闪电网格
        this.createLightningMesh();
        
        // 添加到场景
        this.scene.add(this.group);
    }
    
    /**
     * 创建闪电网格（使用LineSegments）
     */
    createLightningMesh() {
        const segments = this.lightning2D.segments;
        if (!segments || segments.length === 0) return;
        
        // 分离主干和分支
        const mainSegments = [];
        const branchSegments = [];
        
        segments.forEach(seg => {
            if (seg.width > 2) {
                mainSegments.push(seg);
            } else {
                branchSegments.push(seg);
            }
        });
        
        // 创建主干线段
        if (mainSegments.length > 0) {
            this.mainLine = this.createLineSegments(mainSegments, {
                color: 0xc084fc,      // 紫色
                glowColor: 0xc084fc,
                coreColor: 0xffffff,  // 白色核心
                lineWidth: 4,
                opacity: 1.0
            });
            this.group.add(this.mainLine);
        }
        
        // 创建分支线段
        if (branchSegments.length > 0) {
            this.branchLine = this.createLineSegments(branchSegments, {
                color: 0xc084fc,
                glowColor: 0xc084fc,
                coreColor: 0xffffff,
                lineWidth: 2,
                opacity: 0.6
            });
            this.group.add(this.branchLine);
        }
    }
    
    /**
     * 创建LineSegments对象
     * @param {Array} segments - 线段数组
     * @param {Object} style - 样式配置
     * @returns {THREE.Group} - 包含光晕和核心的组
     */
    createLineSegments(segments, style) {
        const group = new THREE.Group();
        
        // 准备顶点数据
        const positions = [];
        
        segments.forEach(seg => {
            // 2D坐标转3D坐标
            const x1 = (seg.p1.x - 400) / 50; // 假设游戏宽度800，转换为[-8, 8]
            const y1 = -(seg.p1.y - 300) / 50; // 假设游戏高度600，Y轴反转
            const z1 = 0;
            
            const x2 = (seg.p2.x - 400) / 50;
            const y2 = -(seg.p2.y - 300) / 50;
            const z2 = 0;
            
            positions.push(x1, y1, z1);
            positions.push(x2, y2, z2);
        });
        
        // 创建几何体
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        // === 1. 创建光晕层（粗线条，半透明）===
        const glowMaterial = new THREE.LineBasicMaterial({
            color: style.glowColor,
            transparent: true,
            opacity: style.opacity * 0.5,
            linewidth: style.lineWidth * 2, // 注意：WebGL限制，linewidth可能不生效
            blending: THREE.AdditiveBlending
        });
        
        const glowLine = new THREE.LineSegments(geometry, glowMaterial);
        group.add(glowLine);
        
        // === 2. 创建核心层（细线条，不透明）===
        const coreMaterial = new THREE.LineBasicMaterial({
            color: style.coreColor,
            transparent: true,
            opacity: style.opacity,
            linewidth: style.lineWidth,
            blending: THREE.AdditiveBlending
        });
        
        const coreLine = new THREE.LineSegments(geometry.clone(), coreMaterial);
        group.add(coreLine);
        
        // 保存材质引用，用于后续更新
        group.userData.glowMaterial = glowMaterial;
        group.userData.coreMaterial = coreMaterial;
        
        return group;
    }
    
    /**
     * 更新闪电状态
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime) {
        if (!this.lightning2D || this.lightning2D.life <= 0) {
            this.destroy();
            return;
        }
        
        // 同步生长进度和生命值
        const progress = this.lightning2D.progress;
        const life = this.lightning2D.life;
        
        // 闪烁效果（随机）
        const flicker = Math.random() > 0.5 ? 1.0 : 0.5;
        const opacity = life * flicker;
        
        // 更新主干透明度
        if (this.mainLine) {
            const glowMat = this.mainLine.userData.glowMaterial;
            const coreMat = this.mainLine.userData.coreMaterial;
            if (glowMat) glowMat.opacity = opacity * 0.5;
            if (coreMat) coreMat.opacity = opacity;
        }
        
        // 更新分支透明度
        if (this.branchLine) {
            const glowMat = this.branchLine.userData.glowMaterial;
            const coreMat = this.branchLine.userData.coreMaterial;
            if (glowMat) glowMat.opacity = opacity * 0.3;
            if (coreMat) coreMat.opacity = opacity * 0.6;
        }
        
        // 生长动画：通过缩放模拟（简化实现）
        if (progress < 1.0) {
            this.group.scale.set(progress, progress, progress);
        } else {
            this.group.scale.set(1, 1, 1);
        }
    }
    
    /**
     * 销毁闪电3D对象
     */
    destroy() {
        if (this.group) {
            // 清理几何体和材质
            this.group.traverse(child => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    child.material.dispose();
                }
            });
            
            // 从场景移除
            this.scene.remove(this.group);
            this.group = null;
        }
    }
}

/**
 * 闪电链渲染器（管理所有闪电链）
 */
export class LightningRenderer3D {
    /**
     * 构造函数
     * @param {THREE.Scene} scene - three.js场景
     * @param {Game} game - 游戏实例
     */
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        
        // 闪电3D实体映射表：key = lightning2D实例, value = Lightning3D实例
        this.lightnings3D = new Map();
        
    }
    
    /**
     * 同步2D闪电到3D场景
     */
    sync() {
        if (!this.game.lightningBolts) return;
        
        // 获取当前活跃的2D闪电
        const activeLightnings = new Set();
        
        // 遍历2D闪电列表
        this.game.lightningBolts.forEach(lightning2D => {
            if (lightning2D.life > 0) {
                activeLightnings.add(lightning2D);
                
                // 如果该闪电还没有3D实体，创建一个
                if (!this.lightnings3D.has(lightning2D)) {
                    const lightning3D = new Lightning3D(lightning2D, this.scene);
                    this.lightnings3D.set(lightning2D, lightning3D);
                }
            }
        });
        
        // 清理已失效的3D实体
        this.lightnings3D.forEach((lightning3D, lightning2D) => {
            if (!activeLightnings.has(lightning2D) || lightning2D.life <= 0) {
                lightning3D.destroy();
                this.lightnings3D.delete(lightning2D);
            }
        });
    }
    
    /**
     * 更新所有闪电3D实体
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime) {
        this.lightnings3D.forEach(lightning3D => {
            lightning3D.update(deltaTime);
        });
    }
    
    /**
     * 销毁所有闪电3D对象
     */
    dispose() {
        this.lightnings3D.forEach(lightning3D => {
            lightning3D.destroy();
        });
        this.lightnings3D.clear();
        
    }
}
