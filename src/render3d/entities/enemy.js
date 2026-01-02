/**
 * render3d/entities/enemy.js - 敌人3D渲染器
 * 
 * 职责：
 * - 将2D敌人实体渲染为3D模型
 * - 使用"地板平面 + 立方体"结构
 * - 同步2D实体的位置、状态和动画
 * - 提供视觉反馈（受击、死亡等）
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

export class EnemyRenderer3D {
    /**
     * 构造函数：创建敌人的3D表示
     * @param {Enemy} enemy - 2D敌人实体引用
     * @param {THREE.Scene} scene - Three.js场景对象
     */
    constructor(enemy, scene) {
        this.enemy = enemy;
        this.scene = scene;
        
        // 创建THREE.Group容器，用于组合地板和立方体
        this.group = new THREE.Group();
        
        // 初始化几何体和材质
        this.initGeometry();
        
        // 添加到场景
        this.scene.add(this.group);
        
        // 动画相关
        this.hitAnimTimer = 0;
        this.deathAnimTimer = 0;
        this.isDying = false;
        
        console.log('[EnemyRenderer3D] 敌人3D渲染器创建完成');
    }
    
    /**
     * 初始化几何体和材质
     */
    initGeometry() {
        // === 1. 创建地板平面 ===
        const floorWidth = this.enemy.width / 50;  // 将2D像素转换为3D单位
        const floorDepth = this.enemy.height / 50;
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
        
        // === 2. 创建立方体（敌人主体）===
        const cubeSize = Math.min(floorWidth, floorDepth) * 0.8; // 立方体略小于地板
        const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        
        // 根据敌人类型选择颜色
        let cubeColor = 0xff4444; // 默认红色
        if (this.enemy.type === 'elite') {
            cubeColor = 0xffaa00; // 精英敌人 - 橙色
        } else if (this.enemy.type === 'boss') {
            cubeColor = 0xaa00ff; // Boss - 紫色
        }
        
        // 立方体材质 - 使用标准材质以支持光照
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: cubeColor,
            metalness: 0.3,
            roughness: 0.4,
            emissive: cubeColor,
            emissiveIntensity: 0.2
        });
        
        this.cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
        // 立方体位于地板上方
        this.cubeMesh.position.y = cubeSize / 2;
        
        this.group.add(this.cubeMesh);
        
        // === 3. 添加边缘线框（可选，增强视觉效果）===
        const edgesGeometry = new THREE.EdgesGeometry(cubeGeometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
        });
        this.edgesMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        this.edgesMesh.position.copy(this.cubeMesh.position);
        
        this.group.add(this.edgesMesh);
        
        // 保存原始颜色用于动画
        this.originalColor = cubeColor;
    }
    
    /**
     * 更新3D表示（每帧调用）
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime = 0.016) {
        if (!this.enemy.active && !this.isDying) {
            // 敌人死亡，开始死亡动画
            this.startDeathAnimation();
            return;
        }
        
        // === 1. 同步位置 ===
        // 将2D坐标转换为3D坐标（假设2D画布中心为原点）
        // 2D: (0,0)在左上角，3D: (0,0,0)在中心
        const x3d = (this.enemy.pos.x - 400) / 50; // 假设画布宽度800
        const z3d = (this.enemy.pos.y - 300) / 50; // 假设画布高度600，Z轴反向
        
        this.group.position.set(x3d, 0, z3d);
        
        // === 2. 同步血量变化（颜色渐变）===
        const hpRatio = this.enemy.hp / this.enemy.maxHp;
        const damageColor = new THREE.Color(0xff0000); // 红色
        const healthColor = new THREE.Color(this.originalColor);
        const currentColor = healthColor.clone().lerp(damageColor, 1 - hpRatio);
        this.cubeMesh.material.color.copy(currentColor);
        this.cubeMesh.material.emissive.copy(currentColor);
        
        // === 3. 受击动画 ===
        if (this.enemy.hitTimer > 0) {
            this.hitAnimTimer = 0.3; // 受击动画持续0.3秒
        }
        
        if (this.hitAnimTimer > 0) {
            this.hitAnimTimer -= deltaTime;
            // 闪烁效果
            const flash = Math.sin(this.hitAnimTimer * 50) > 0 ? 1.5 : 1.0;
            this.cubeMesh.material.emissiveIntensity = 0.2 * flash;
            
            // 轻微震动
            const shake = Math.sin(this.hitAnimTimer * 100) * 0.1;
            this.cubeMesh.position.x = shake;
        } else {
            this.cubeMesh.material.emissiveIntensity = 0.2;
            this.cubeMesh.position.x = 0;
        }
        
        // === 4. 旋转动画（轻微摇摆）===
        const time = Date.now() * 0.001;
        this.cubeMesh.rotation.y = Math.sin(time + this.enemy.visualSeed * 10) * 0.1;
        
        // === 5. 死亡动画 ===
        if (this.isDying) {
            this.updateDeathAnimation(deltaTime);
        }
    }
    
    /**
     * 开始死亡动画
     */
    startDeathAnimation() {
        this.isDying = true;
        this.deathAnimTimer = 1.0; // 死亡动画持续1秒
    }
    
    /**
     * 更新死亡动画
     * @param {number} deltaTime - 帧间隔时间
     */
    updateDeathAnimation(deltaTime) {
        this.deathAnimTimer -= deltaTime;
        
        if (this.deathAnimTimer <= 0) {
            // 动画结束，销毁3D对象
            this.dispose();
            return;
        }
        
        const progress = 1 - (this.deathAnimTimer / 1.0);
        
        // 下沉效果
        this.group.position.y = -progress * 2;
        
        // 旋转加速
        this.cubeMesh.rotation.y += deltaTime * 10;
        this.cubeMesh.rotation.x += deltaTime * 5;
        
        // 缩小
        const scale = 1 - progress;
        this.cubeMesh.scale.set(scale, scale, scale);
        
        // 淡出
        this.cubeMesh.material.opacity = 1 - progress;
        this.cubeMesh.material.transparent = true;
        this.floorMesh.material.opacity = (1 - progress) * 0.6;
    }
    
    /**
     * 销毁3D对象
     */
    dispose() {
        // 从场景中移除
        this.scene.remove(this.group);
        
        // 释放几何体
        this.floorMesh.geometry.dispose();
        this.cubeMesh.geometry.dispose();
        this.edgesMesh.geometry.dispose();
        
        // 释放材质
        this.floorMesh.material.dispose();
        this.cubeMesh.material.dispose();
        this.edgesMesh.material.dispose();
        
        console.log('[EnemyRenderer3D] 敌人3D渲染器已销毁');
    }
    
    /**
     * 获取3D位置
     * @returns {THREE.Vector3} 3D位置向量
     */
    getPosition() {
        return this.group.position.clone();
    }
    
    /**
     * 设置可见性
     * @param {boolean} visible - 是否可见
     */
    setVisible(visible) {
        this.group.visible = visible;
    }
}
