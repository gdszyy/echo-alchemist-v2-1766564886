/**
 * render3d/index.js - 3D渲染系统
 * 
 * 职责：
 * - 管理three.js场景、渲染器、摄像机
 * - 提供2D/3D模式切换
 * - 在游戏主循环中更新3D场景
 * - 管理敌人3D实体
 * - 管理子弹和粒子的3D渲染
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CameraController, CameraPreset } from './camera.js';
import { Enemy3D, EnemyRenderer3D } from './entities/enemy.js';
import { ShockwaveRenderer3D } from './effects/shockwave.js';
import { LightningRenderer3D } from './effects/lightning.js';

export class RenderSystem3D {
    /**
     * 构造函数：初始化three.js场景和渲染器
     * @param {Game} game - 游戏主类实例的引用
     */
    constructor(game) {
        this.game = game;
        this.enabled = false; // 3D渲染是否启用
        
        // 敌人3D实体管理
        this.enemies3D = new Map(); // key: enemy2D实例, value: Enemy3D实例
        this.enemyRenderers = []; // 兼容旧代码
        
        // 冲击波渲染器
        this.shockwaveRenderer = null;
        
        // 创建3D Canvas容器
        this.container = document.createElement('div');
        this.container.id = 'render3d-container';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none'; // 不阻挡2D Canvas的交互
        this.container.style.display = 'none'; // 初始隐藏
        this.container.style.zIndex = '10'; // 在2D Canvas之上
        document.body.appendChild(this.container);
        
        // 初始化three.js核心组件
        this.initThreeJS();
        
        // 初始化冲击波渲染器
        this.initShockwaveRenderer();
        
        // 添加测试内容
        this.addTestContent();
        
        console.log('[RenderSystem3D] 初始化完成');
    }
    
    /**
     * 初始化three.js场景、渲染器、摄像机
     */
    initThreeJS() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e); // 深蓝色背景
        
        // 创建摄像机控制器
        const aspect = window.innerWidth / window.innerHeight;
        this.cameraController = new CameraController(aspect);
        this.camera = this.cameraController.getCamera();
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true // 支持透明背景
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        
        // 添加环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // 添加方向光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.onWindowResize());
        
        // 初始化闪电渲染器
        this.lightningRenderer = new LightningRenderer3D(this.scene, this.game);
    }
    
    /**
     * 初始化冲击波渲染器
     */
    initShockwaveRenderer() {
        this.shockwaveRenderer = new ShockwaveRenderer3D(this.scene, 100);
        console.log('[RenderSystem3D] 冲击波渲染器初始化完成');
    }
    
    /**
     * 添加测试内容（一个旋转的立方体）
     */
    addTestContent() {
        // 创建一个简单的立方体作为测试
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x00ff88,
            metalness: 0.3,
            roughness: 0.4
        });
        this.testCube = new THREE.Mesh(geometry, material);
        this.testCube.position.set(0, 0, 0);
        this.scene.add(this.testCube);
        
        // 添加网格辅助线
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.scene.add(gridHelper);
    }
    
    /**
     * 窗口大小变化处理
     */
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // 更新摄像机控制器
        if (this.cameraController) {
            this.cameraController.onWindowResize(width, height);
        }
        
        this.renderer.setSize(width, height);
    }
    
    /**
     * 同步2D敌人到3D场景
     */
    syncEnemies() {
        if (!this.game.enemies) return;
        
        // 遍历2D敌人列表
        for (const enemy2D of this.game.enemies) {
            if (enemy2D.active) {
                // 如果该敌人还没有3D实体，创建一个
                if (!this.enemies3D.has(enemy2D)) {
                    const enemy3D = new Enemy3D(enemy2D, this.scene);
                    this.enemies3D.set(enemy2D, enemy3D);
                    console.log('[RenderSystem3D] 创建新的敌人3D实体');
                }
            } else {
                // 如果2D敌人已经不活跃，触发3D实体的死亡动画
                const enemy3D = this.enemies3D.get(enemy2D);
                if (enemy3D && !enemy3D.isDying) {
                    enemy3D.triggerDeath();
                }
            }
        }
        
        // 清理已销毁的3D实体
        for (const [enemy2D, enemy3D] of this.enemies3D.entries()) {
            if (!enemy3D.group) {
                this.enemies3D.delete(enemy2D);
                console.log('[RenderSystem3D] 清理已销毁的敌人3D实体');
            }
        }
    }
    
    /**
     * 更新所有敌人3D实体
     * @param {number} deltaTime - 帧间隔时间
     */
    updateEnemies(deltaTime) {
        for (const enemy3D of this.enemies3D.values()) {
            enemy3D.update(deltaTime);
        }
    }
    
    /**
     * 同步子弹到3D场景
     * 从游戏的2D projectiles数组创建/更新3D表示
     */
    syncProjectiles() {
        if (!this.enabled || !this.game.projectiles) return;
        
        // 初始化3D子弹容器
        if (!this.projectile3DMap) {
            this.projectile3DMap = new Map();
        }
        
        // 获取当前活跃的2D子弹ID集合
        const activeIds = new Set();
        
        // 遍历2D子弹，创建或更新对应的3D对象
        this.game.projectiles.forEach(proj => {
            if (!proj || !proj.active) return;
            
            // 使用子弹对象作为唯一标识
            const id = proj;
            activeIds.add(id);
            
            let mesh3D = this.projectile3DMap.get(id);
            
            // 如果3D对象不存在，创建新的
            if (!mesh3D) {
                // 根据子弹配置选择几何体
                let geometry;
                if (proj.config.pierce > 0) {
                    // 穿透子弹：箭矢形状
                    geometry = new THREE.ConeGeometry(proj.radius * 0.5, proj.radius * 2, 8);
                } else if (proj.config.explosive) {
                    // 爆炸子弹：八面体
                    geometry = new THREE.OctahedronGeometry(proj.radius);
                } else {
                    // 普通子弹：球体
                    geometry = new THREE.SphereGeometry(proj.radius, 16, 16);
                }
                
                // 根据子弹属性选择颜色
                let color = 0x00ff88; // 默认绿色
                if (proj.config.pyro > 0) color = 0xff6b35; // 火焰橙
                else if (proj.config.cryo > 0) color = 0x06b6d4; // 冰霜青
                else if (proj.config.lightning > 0) color = 0xfbbf24; // 闪电黄
                else if (proj.config.wind > 0) color = 0x34d399; // 风绿
                else if (proj.config.laser > 0) color = 0xec4899; // 激光粉
                
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: proj.intensity || 0.5,
                    metalness: 0.3,
                    roughness: 0.4
                });
                
                mesh3D = new THREE.Mesh(geometry, material);
                this.scene.add(mesh3D);
                this.projectile3DMap.set(id, mesh3D);
            }
            
            // 更新3D位置（2D坐标转换为3D坐标）
            const x = (proj.pos.x - this.game.width / 2) / 50;
            const y = -(proj.pos.y - this.game.height / 2) / 50;
            const z = 0;
            
            mesh3D.position.set(x, y, z);
            
            // 更新旋转（根据速度方向）
            if (proj.vel) {
                const angle = Math.atan2(proj.vel.y, proj.vel.x);
                if (proj.config.pierce > 0) {
                    mesh3D.rotation.z = -angle + Math.PI / 2;
                } else {
                    mesh3D.rotation.x += 0.1;
                    mesh3D.rotation.y += 0.1;
                }
            }
        });
        
        // 清理已失效的3D对象
        this.projectile3DMap.forEach((mesh, id) => {
            if (!activeIds.has(id)) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                this.projectile3DMap.delete(id);
            }
        });
    }
    
    /**
     * 同步粒子到3D场景
     */
    syncParticles() {
        if (!this.enabled || !this.game.particles) return;
        
        if (!this.particle3DMap) {
            this.particle3DMap = new Map();
        }
        
        const activeIds = new Set();
        
        this.game.particles.forEach(particle => {
            if (!particle || particle.life <= 0) return;
            
            const id = particle;
            activeIds.add(id);
            
            let mesh3D = this.particle3DMap.get(id);
            
            if (!mesh3D) {
                let geometry;
                if (particle.mode === 'spark') {
                    geometry = new THREE.SphereGeometry(particle.size * 0.1, 4, 4);
                } else if (particle.mode === 'ember') {
                    geometry = new THREE.SphereGeometry(particle.size * 0.1, 6, 6);
                } else if (particle.mode === 'mist') {
                    geometry = new THREE.SphereGeometry(particle.size * 0.1, 8, 8);
                } else if (particle.mode === 'shard') {
                    geometry = new THREE.BoxGeometry(
                        particle.size * 0.1 * (particle.scaleX || 1),
                        particle.size * 0.1 * (particle.scaleY || 1),
                        particle.size * 0.1
                    );
                } else {
                    geometry = new THREE.SphereGeometry(particle.size * 0.1 || 0.2, 6, 6);
                }
                
                let color = 0xffffff;
                if (particle.color) {
                    const hexColor = particle.color.replace('#', '');
                    color = parseInt(hexColor, 16);
                }
                
                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: particle.life,
                    blending: THREE.AdditiveBlending
                });
                
                mesh3D = new THREE.Mesh(geometry, material);
                this.scene.add(mesh3D);
                this.particle3DMap.set(id, mesh3D);
            }
            
            const x = (particle.pos.x - this.game.width / 2) / 50;
            const y = -(particle.pos.y - this.game.height / 2) / 50;
            const z = 0;
            
            mesh3D.position.set(x, y, z);
            mesh3D.material.opacity = particle.life;
            
            if (particle.angle !== undefined) {
                mesh3D.rotation.z = particle.angle;
            }
            
            const scale = 0.5 + particle.life * 0.5;
            mesh3D.scale.set(scale, scale, scale);
        });
        
        this.particle3DMap.forEach((mesh, id) => {
            if (!activeIds.has(id)) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                this.particle3DMap.delete(id);
            }
        });
    }
    
    /**
     * 同步冲击波到3D场景
     * 从游戏的2D shockwaves数组创建/更新3D表示
     */
    syncShockwaves() {
        if (!this.enabled || !this.game.shockwaves || !this.shockwaveRenderer) return;
        
        // 调用冲击波渲染器的同步方法
        this.shockwaveRenderer.syncShockwaves(this.game.shockwaves, this.game);
    }
    
    /**
     * 更新3D场景（每帧调用）
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime = 0.016) {
        if (!this.enabled) return;
        
        // 同步敌人
        this.syncEnemies();
        
        // 更新敌人3D实体
        this.updateEnemies(deltaTime);
        
        // 同步子弹和粒子
        this.syncProjectiles();
        this.syncParticles();
        
        // 同步冲击波
        this.syncShockwaves();
        
        // 同步和更新闪电链
        if (this.lightningRenderer) {
            this.lightningRenderer.sync();
            this.lightningRenderer.update(deltaTime);
        }
        
        // 更新摄像机控制器
        if (this.cameraController) {
            this.cameraController.update(deltaTime);
        }
        
        // 旋转测试立方体
        if (this.testCube) {
            this.testCube.rotation.x += 0.01;
            this.testCube.rotation.y += 0.01;
        }
        
        // 渲染场景
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * 切换到3D模式
     */
    transitionTo3D() {
        console.log('[RenderSystem3D] 切换到3D模式');
        this.enabled = true;
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        // 隐藏2D Canvas
        if (this.game.canvas) {
            this.game.canvas.style.opacity = '0.3';
        }
    }
    
    /**
     * 切换到2D模式
     */
    transitionTo2D() {
        console.log('[RenderSystem3D] 切换到2D模式');
        this.enabled = false;
        if (this.container) {
            this.container.style.display = 'none';
        }
        
        // 恢复2D Canvas显示
        if (this.game.canvas) {
            this.game.canvas.style.opacity = '1';
        }
    }
    
    /**
     * 销毁3D渲染系统
     */
    dispose() {
        console.log('[RenderSystem3D] 销毁渲染系统');
        
        // 清理所有敌人3D实体
        for (const enemy3D of this.enemies3D.values()) {
            enemy3D.destroy();
        }
        this.enemies3D.clear();
        
        // 清理闪电渲染器
        if (this.lightningRenderer) {
            this.lightningRenderer.dispose();
            this.lightningRenderer = null;
        }
        
        // 清理three.js资源
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // 移除DOM元素
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // 移除事件监听
        window.removeEventListener('resize', () => this.onWindowResize());
    }
}
