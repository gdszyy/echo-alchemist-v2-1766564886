/**
 * render3d/index.js - 3D渲染系统主入口
 * 
 * 职责：
 * - 管理three.js场景、渲染器、摄像机
 * - 提供2D/3D模式切换功能
 * - 在游戏主循环中更新3D场景
 * - 协调敌人、子弹、粒子、冲击波、闪电的3D渲染
 * 
 * 架构说明：
 * - 使用统一的坐标转换工具（coordinate.js）
 * - 敌人使用独立的Enemy3D类管理
 * - 子弹和粒子使用简化的Mesh管理（未来可扩展为独立渲染器）
 * - 冲击波和闪电使用专用渲染器
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CameraController, CameraPreset } from './camera.js';
import { Enemy3D } from './entities/enemy.js';
import { mapTo3D, HEIGHT_LAYERS } from './utils/coordinate.js';
import { ShockwaveRenderer3D } from './effects/shockwave.js';
import { LightningRenderer3D } from './effects/lightning.js';

/**
 * 3D渲染系统主类
 * 负责整个3D渲染管线的初始化和更新
 */
export class RenderSystem3D {
    /**
     * 构造函数：初始化three.js场景和渲染器
     * @param {Game} game - 游戏主类实例的引用
     */
    constructor(game) {
        this.game = game;
        this.enabled = false; // 3D渲染是否启用
        
        // === 实体管理 ===
        this.playerMesh = null; // Player的3D网格
        this.enemies3D = new Map(); // key: enemy2D实例, value: Enemy3D实例
        this.projectile3DMap = new Map(); // key: projectile2D实例, value: THREE.Mesh
        this.particle3DMap = new Map(); // key: particle2D实例, value: THREE.Mesh
        
        // === 特效渲染器 ===
        this.shockwaveRenderer = null; // 冲击波渲染器
        this.lightningRenderer = null; // 闪电渲染器
        
        // === 创建3D Canvas容器 ===
        this.container = this.createContainer();
        document.body.appendChild(this.container);
        
        // === 初始化three.js核心组件 ===
        this.initThreeJS();
        
        // === 初始化特效渲染器 ===
        this.initShockwaveRenderer();
        
        // === 开发模式：添加调试辅助 ===
        if (this.isDebugMode()) {
            this.addDebugHelpers();
        }
        
    }
    
    /**
     * 创建3D Canvas容器元素
     * @returns {HTMLDivElement} 容器元素
     */
    createContainer() {
        const container = document.createElement('div');
        container.id = 'render3d-container';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none'; // 不阻挡2D Canvas的交互
        container.style.display = 'none'; // 初始隐藏
        container.style.zIndex = '10'; // 在2D Canvas之上
        return container;
    }
    
    /**
     * 初始化three.js场景、渲染器、摄像机
     */
    initThreeJS() {
        // === 创建场景 ===
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e); // 深蓝色背景
        
        // === 创建摄像机控制器 ===
        const aspect = window.innerWidth / window.innerHeight;
        this.cameraController = new CameraController(aspect);
        this.camera = this.cameraController.getCamera();
        
        // === 创建渲染器 ===
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true // 支持透明背景
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        
        // === 添加光照系统 ===
        this.setupLighting();
        
        // === 初始化闪电渲染器 ===
        this.lightningRenderer = new LightningRenderer3D(this.scene, this.game);
        
        // === 监听窗口大小变化 ===
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    /**
     * 设置场景光照
     */
    setupLighting() {
        // 环境光 - 提供基础照明
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // 方向光 - 模拟太阳光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
    }
    
    /**
     * 初始化冲击波渲染器
     */
    initShockwaveRenderer() {
        this.shockwaveRenderer = new ShockwaveRenderer3D(this.scene, 100);
    }
    
    /**
     * 检查是否为调试模式
     * @returns {boolean} 是否为调试模式
     */
    isDebugMode() {
        // 可以通过URL参数或localStorage控制
        return window.location.search.includes('debug=true') || 
               localStorage.getItem('render3d_debug') === 'true';
    }
    
    /**
     * 添加调试辅助工具（仅在开发模式下）
     */
    addDebugHelpers() {
        // 添加网格辅助线
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.scene.add(gridHelper);
        
        // 添加坐标轴辅助
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
        
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
     * 
     * 同步策略：
     * 1. 遍历所有2D敌人，为活跃敌人创建3D实体
     * 2. 为不活跃的敌人触发死亡动画
     * 3. 清理已完成动画的3D实体
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
            }
        }
    }
    
    /**
     * 更新所有敌人3D实体
     * @param {number} deltaTime - 帧间隔时间（秒）
     */
    updateEnemies(deltaTime) {
        for (const enemy3D of this.enemies3D.values()) {
            enemy3D.update(deltaTime, this.camera);
        }
    }
    
    /**
     * 同步子弹到3D场景
     * 从游戏的2D projectiles数组创建/更新3D表示
     * 
     * 注意：当前使用简化的Mesh实现，未来可扩展为ProjectileRenderer3D
     */
    syncProjectiles() {
        if (!this.enabled || !this.game.projectiles) return;
        
        // 获取当前活跃的2D子弹ID集合
        const activeIds = new Set();
        
        // 遍历2D子弹，创建或更新对应的3D对象
        this.game.projectiles.forEach(proj => {
            if (!proj || !proj.active) return;
            
            const id = proj;
            activeIds.add(id);
            
            let mesh3D = this.projectile3DMap.get(id);
            
            // 如果3D对象不存在，创建新的
            if (!mesh3D) {
                mesh3D = this.createProjectileMesh(proj);
                this.scene.add(mesh3D);
                this.projectile3DMap.set(id, mesh3D);
            }
            
            // 更新3D位置和旋转
            this.updateProjectileMesh(mesh3D, proj);
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
     * 创建子弹的3D网格
     * @param {Projectile} proj - 2D子弹实例
     * @returns {THREE.Mesh} 3D网格对象
     */
    createProjectileMesh(proj) {
        // 根据子弹配置选择几何体
        let geometry;
        if (proj.config.pierce > 0) {
            // 穿透子弹：箭矢形状（圆锥体）
            geometry = new THREE.ConeGeometry(proj.radius * 0.5, proj.radius * 2, 8);
        } else if (proj.config.explosive) {
            // 爆炸子弹：八面体
            geometry = new THREE.OctahedronGeometry(proj.radius);
        } else {
            // 普通子弹：球体
            geometry = new THREE.SphereGeometry(proj.radius, 16, 16);
        }
        
        // 根据子弹元素属性选择颜色
        const color = this.getProjectileColor(proj.config);
        
        // 创建材质（带发光效果）
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: proj.intensity || 0.5,
            metalness: 0.3,
            roughness: 0.4
        });
        
        return new THREE.Mesh(geometry, material);
    }
    
    /**
     * 根据子弹配置获取颜色
     * @param {Object} config - 子弹配置对象
     * @returns {number} 十六进制颜色值
     */
    getProjectileColor(config) {
        // 元素颜色映射表
        if (config.pyro > 0) return 0xff6b35;      // 火焰橙
        if (config.cryo > 0) return 0x06b6d4;      // 冰霜青
        if (config.lightning > 0) return 0xfbbf24; // 闪电黄
        if (config.wind > 0) return 0x34d399;      // 风绿
        if (config.laser > 0) return 0xec4899;     // 激光粉
        return 0x00ff88; // 默认绿色
    }
    
    /**
     * 更新子弹网格的位置和旋转
     * @param {THREE.Mesh} mesh3D - 3D网格对象
     * @param {Projectile} proj - 2D子弹实例
     */
    updateProjectileMesh(mesh3D, proj) {
        // 使用统一的坐标转换工具
        const pos3D = mapTo3D(
            proj.pos.x, 
            proj.pos.y, 
            HEIGHT_LAYERS.PROJECTILE,
            this.game.width,
            this.game.height
        );
        
        mesh3D.position.set(pos3D.x, pos3D.y, pos3D.z);
        
        // 更新旋转（根据速度方向）
        if (proj.vel) {
            const angle = Math.atan2(proj.vel.y, proj.vel.x);
            if (proj.config.pierce > 0) {
                // 穿透子弹：朝向运动方向
                mesh3D.rotation.z = -angle + Math.PI / 2;
            } else {
                // 普通子弹：自旋效果
                mesh3D.rotation.x += 0.1;
                mesh3D.rotation.y += 0.1;
            }
        }
    }
    
    /**
     * 同步粒子到3D场景
     * 
     * 注意：当前使用简化的Mesh实现，未来可扩展为ParticleSystem3D
     */
    syncParticles() {
        if (!this.enabled || !this.game.particles) return;
        
        const activeIds = new Set();
        
        this.game.particles.forEach(particle => {
            if (!particle || particle.life <= 0) return;
            
            const id = particle;
            activeIds.add(id);
            
            let mesh3D = this.particle3DMap.get(id);
            
            if (!mesh3D) {
                mesh3D = this.createParticleMesh(particle);
                this.scene.add(mesh3D);
                this.particle3DMap.set(id, mesh3D);
            }
            
            // 更新位置和透明度
            this.updateParticleMesh(mesh3D, particle);
        });
        
        // 清理已失效的粒子
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
     * 创建粒子的3D网格
     * @param {Particle} particle - 2D粒子实例
     * @returns {THREE.Mesh} 3D网格对象
     */
    createParticleMesh(particle) {
        // 根据粒子模式选择几何体
        let geometry;
        const size = particle.size * 0.1;
        
        switch (particle.mode) {
            case 'spark':
                geometry = new THREE.SphereGeometry(size, 4, 4);
                break;
            case 'ember':
                geometry = new THREE.SphereGeometry(size, 6, 6);
                break;
            case 'mist':
                geometry = new THREE.SphereGeometry(size, 8, 8);
                break;
            case 'shard':
                geometry = new THREE.BoxGeometry(
                    size * (particle.scaleX || 1),
                    size * (particle.scaleY || 1),
                    size
                );
                break;
            default:
                geometry = new THREE.SphereGeometry(size || 0.2, 6, 6);
        }
        
        // 解析颜色
        let color = 0xffffff;
        if (particle.color) {
            const hexColor = particle.color.replace('#', '');
            color = parseInt(hexColor, 16);
        }
        
        // 创建材质（使用加法混合实现发光效果）
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: particle.life,
            blending: THREE.AdditiveBlending
        });
        
        return new THREE.Mesh(geometry, material);
    }
    
    /**
     * 更新粒子网格的位置和状态
     * @param {THREE.Mesh} mesh3D - 3D网格对象
     * @param {Particle} particle - 2D粒子实例
     */
    updateParticleMesh(mesh3D, particle) {
        // 使用统一的坐标转换工具
        const pos3D = mapTo3D(
            particle.pos.x,
            particle.pos.y,
            HEIGHT_LAYERS.EFFECT,
            this.game.width,
            this.game.height
        );
        
        mesh3D.position.set(pos3D.x, pos3D.y, pos3D.z);
        mesh3D.material.opacity = particle.life;
        
        // 更新旋转角度
        if (particle.angle !== undefined) {
            mesh3D.rotation.z = particle.angle;
        }
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
     * 同步Player到3D场景
     * 从游戏的player实例创建/更新3D表示
     */
    syncPlayer() {
        if (!this.enabled || !this.game.player) return;
        
        // 如果Player 3D网格不存在，创建一个
        if (!this.playerMesh) {
            this.playerMesh = this.createPlayerMesh();
            this.scene.add(this.playerMesh);
        }
        
        // 更新Player位置
        this.updatePlayerMesh();
    }
    
    /**
     * 创建Player的3D网格（简单的立方体占位符）
     * @returns {THREE.Mesh} 3D网格对象
     */
    createPlayerMesh() {
        // 创建立方体几何体（使用Player的baseRadius作为尺寸参考）
        const size = (this.game.player.baseRadius || 22) / 25; // 缩放到合适的3D尺寸
        const geometry = new THREE.BoxGeometry(size, size, size);
        
        // 创建材质（青绿色，带发光效果）
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.5,
            metalness: 0.3,
            roughness: 0.4
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // 添加边缘线框（增强视觉效果）
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.5
        });
        const edgesMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        mesh.add(edgesMesh);
        
        return mesh;
    }
    
    /**
     * 更新Player网格的位置
     */
    updatePlayerMesh() {
        if (!this.playerMesh || !this.game.player) return;
        
        // 将从2D Canvas坐标转换为3D世界坐标
        // Player位于屏幕底部中央
        const x = (this.game.player.pos.x - this.game.width / 2) / 50;
        const y = -(this.game.player.pos.y - this.game.height / 2) / 50;
        const z = 0;
        
        this.playerMesh.position.set(x, y, z);
        
        // 添加轻微的旋转动画
        this.playerMesh.rotation.y += 0.02;
    }
    
    /**
     * 启用3D渲染
     */
    enable() {
        this.enabled = true;
        this.container.style.display = 'block';
    }
    
    /**
     * 禁用3D渲染
     */
    disable() {
        this.enabled = false;
        this.container.style.display = 'none';
    }
    
    /**
     * 切换2D/3D模式
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }
    
    /**
     * 主更新循环（每帧调用）
     * @param {number} deltaTime - 帧间隔时间（秒）
     */
    update(deltaTime) {
        if (!this.enabled) return;
        
        // 同步所有实体
        this.syncPlayer();
        this.syncEnemies();
        this.syncProjectiles();
        this.syncParticles();
        this.syncShockwaves();
        
        // 同步和更新闪电链
        if (this.lightningRenderer) {
            this.lightningRenderer.sync();
            this.lightningRenderer.update(deltaTime);
        }
        
        // 更新敌人动画
        this.updateEnemies(deltaTime);
        
        // 更新摄像机控制器
        if (this.cameraController) {
            this.cameraController.update(deltaTime);
        }
        
        // 渲染场景
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * 清理资源
     */
    dispose() {
        // 清理所有敌人
        for (const enemy3D of this.enemies3D.values()) {
            enemy3D.destroy();
        }
        this.enemies3D.clear();
        
        // 清理所有子弹
        this.projectile3DMap.forEach((mesh) => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.projectile3DMap.clear();
        
        // 清理所有粒子
        this.particle3DMap.forEach((mesh) => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.particle3DMap.clear();
        
        // 清理渲染器
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // 移除容器
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
    }
}
