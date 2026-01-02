/**
 * render3d/index.js - 3D渲染系统
 * 
 * 职责：
 * - 管理three.js场景、渲染器、摄像机
 * - 提供2D/3D模式切换
 * - 在游戏主循环中更新3D场景
 * - 管理敌人3D实体
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { Enemy3D } from './entities/enemy.js';

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
        
        // 创建摄像机
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);
        
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
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
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
            if (!enemy3D.mesh) {
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
     * 更新3D场景（每帧调用）
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime = 0.016) {
        if (!this.enabled) return;
        
        // 同步敌人
        this.syncEnemies();
        
        // 更新敌人3D实体
        this.updateEnemies(deltaTime);
        
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
            this.game.canvas.style.opacity = '0.3'; // 半透明显示2D内容作为参考
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
