/**
 * render3d/index.js - 3D渲染系统
 * 
 * 职责：
 * - 管理three.js场景、渲染器、摄像机
 * - 提供2D/3D模式切换
 * - 在游戏主循环中更新3D场景
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CameraController, CameraPreset } from './camera.js';
import { EnemyRenderer3D } from './entities/enemy.js';

export class RenderSystem3D {
    /**
     * 构造函数：初始化three.js场景和渲染器
     * @param {Game} game - 游戏主类实例的引用
     */
    constructor(game) {
        this.game = game;
        this.enabled = false; // 3D渲染是否启用
        
        // 敌人3D渲染器数组
        this.enemyRenderers = [];
        
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
            // Canvas坐标系：原点在左上角，Y向下
            // Three.js坐标系：原点在中心，Y向上
            const x = (proj.pos.x - this.game.width / 2) / 50; // 缩放因子
            const y = -(proj.pos.y - this.game.height / 2) / 50; // Y轴反转
            const z = 0;
            
            mesh3D.position.set(x, y, z);
            
            // 更新旋转（根据速度方向）
            if (proj.vel) {
                const angle = Math.atan2(proj.vel.y, proj.vel.x);
                if (proj.config.pierce > 0) {
                    // 箭矢朝向飞行方向
                    mesh3D.rotation.z = -angle + Math.PI / 2;
                } else {
                    // 其他子弹自旋
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
     * 从游戏的2D particles数组创建/更新3D表示
     */
    syncParticles() {
        if (!this.enabled || !this.game.particles) return;
        
        // 初始化3D粒子容器
        if (!this.particle3DMap) {
            this.particle3DMap = new Map();
        }
        
        // 获取当前活跃的2D粒子ID集合
        const activeIds = new Set();
        
        // 遍历2D粒子，创建或更新对应的3D对象
        this.game.particles.forEach(particle => {
            if (!particle || particle.life <= 0) return;
            
            // 使用粒子对象作为唯一标识
            const id = particle;
            activeIds.add(id);
            
            let mesh3D = this.particle3DMap.get(id);
            
            // 如果3D对象不存在，创建新的
            if (!mesh3D) {
                // 根据粒子模式选择几何体
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
                
                // 解析颜色
                let color = 0xffffff;
                if (particle.color) {
                    // 移除#号并转换为十六进制数
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
            
            // 更新3D位置
            const x = (particle.pos.x - this.game.width / 2) / 50;
            const y = -(particle.pos.y - this.game.height / 2) / 50;
            const z = 0;
            
            mesh3D.position.set(x, y, z);
            
            // 更新透明度
            mesh3D.material.opacity = particle.life;
            
            // 更新旋转（如果有角度属性）
            if (particle.angle !== undefined) {
                mesh3D.rotation.z = particle.angle;
            }
            
            // 更新缩放（根据生命值）
            const scale = 0.5 + particle.life * 0.5;
            mesh3D.scale.set(scale, scale, scale);
        });
        
        // 清理已失效的3D对象
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
     * 更新3D场景（每帧调用）
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime = 0.016) {
        if (!this.enabled) return;
        
        // 更新摄像机控制器
        if (this.cameraController) {
            this.cameraController.update();
        }
        
        // 同步游戏实体到3D场景
        this.syncProjectiles();
        this.syncParticles();
        
        // 旋转测试立方体
        if (this.testCube) {
            this.testCube.rotation.x += 0.01;
            this.testCube.rotation.y += 0.01;
        }
        
        // 更新所有敌人渲染器
        this.enemyRenderers.forEach(renderer => {
            renderer.update(deltaTime);
        });
        
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
     * 为敌人创建3D渲染器
     * @param {Enemy} enemy - 2D敌人实体
     * @returns {EnemyRenderer3D} 创建的渲染器
     */
    createEnemyRenderer(enemy) {
        const renderer = new EnemyRenderer3D(enemy, this.scene);
        this.enemyRenderers.push(renderer);
        console.log(`[RenderSystem3D] 为敌人创建3D渲染器，当前总数: ${this.enemyRenderers.length}`);
        return renderer;
    }
    
    /**
     * 移除敌人3D渲染器
     * @param {EnemyRenderer3D} renderer - 要移除的渲染器
     */
    removeEnemyRenderer(renderer) {
        const index = this.enemyRenderers.indexOf(renderer);
        if (index !== -1) {
            this.enemyRenderers.splice(index, 1);
            renderer.dispose();
            console.log(`[RenderSystem3D] 移除敌人3D渲染器，当前总数: ${this.enemyRenderers.length}`);
        }
    }
    
    /**
     * 清除所有敌人3D渲染器
     */
    clearEnemyRenderers() {
        this.enemyRenderers.forEach(renderer => renderer.dispose());
        this.enemyRenderers = [];
        console.log('[RenderSystem3D] 已清除所有敌人3D渲染器');
    }
    
    /**
     * 同步敌人数据（从2D敌人列表创建/更新3D渲染器）
     * @param {Array<Enemy>} enemies - 2D敌人实体数组
     */
    syncEnemies(enemies) {
        // 清除已死亡的敌人渲染器
        this.enemyRenderers = this.enemyRenderers.filter(renderer => {
            if (!renderer.enemy.active && !renderer.isDying) {
                renderer.dispose();
                return false;
            }
            return true;
        });
        
        // 为新敌人创建渲染器
        enemies.forEach(enemy => {
            const hasRenderer = this.enemyRenderers.some(r => r.enemy === enemy);
            if (!hasRenderer && enemy.active) {
                this.createEnemyRenderer(enemy);
            }
        });
    }
    
    /**
     * 切换摄像机预设
     * @param {string} presetName - 预设名称 (CameraPreset枚举值)
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setCameraPreset(presetName, smooth = true) {
        if (this.cameraController) {
            this.cameraController.setPreset(presetName, smooth);
        }
    }
    
    /**
     * 切换到2D俯视视角
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setCameraTopDownView(smooth = true) {
        if (this.cameraController) {
            this.cameraController.setTopDownView(smooth);
        }
    }
    
    /**
     * 切换到3D斜视视角
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setCameraIsometricView(smooth = true) {
        if (this.cameraController) {
            this.cameraController.setIsometricView(smooth);
        }
    }
    
    /**
     * 获取当前摄像机预设
     * @returns {string} 当前预设名称
     */
    getCurrentCameraPreset() {
        return this.cameraController ? this.cameraController.getCurrentPreset() : null;
    }
    
    /**
     * 销毁3D渲染系统
     */
    dispose() {
        console.log('[RenderSystem3D] 销毁渲染系统');
        
        // 清理所有敌人渲染器
        this.clearEnemyRenderers();
        
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

// 导出CameraPreset枚举供外部使用
export { CameraPreset };
