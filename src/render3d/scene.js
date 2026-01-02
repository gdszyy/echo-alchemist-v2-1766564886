/**
 * Echo Alchemist 3D Rendering System
 * Scene management for the 3D renderer.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

/**
 * SceneManager - 场景管理器
 * 负责初始化和管理three.js场景，包括光照、地板、网格辅助线和雾效果
 */
export class SceneManager {
    /**
     * 构造函数：初始化场景管理器
     */
    constructor() {
        this.scene = null;
        this.lights = {};
        this.helpers = {};
        this.floor = null;
        
        this.init();
    }
    
    /**
     * 初始化场景及所有组件
     */
    init() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e); // 深蓝色背景
        
        // 添加光照
        this.addLights();
        
        // 添加网格辅助线
        this.addGridHelper();
        
        // 添加反光地板
        this.addReflectiveFloor();
        
        // 配置雾效果
        this.addFog();
        
        console.log('[SceneManager] 场景初始化完成');
    }
    
    /**
     * 添加光照系统
     * 包括环境光和平行光
     */
    addLights() {
        // 环境光 - 提供基础照明
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        ambientLight.name = 'AmbientLight';
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;
        
        // 平行光 - 模拟太阳光，产生阴影效果
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        directionalLight.name = 'DirectionalLight';
        
        // 配置阴影参数
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        
        this.scene.add(directionalLight);
        this.lights.directional = directionalLight;
        
        console.log('[SceneManager] 光照系统已添加');
    }
    
    /**
     * 添加网格辅助线
     * 帮助开发者理解3D空间的尺度和方向
     */
    addGridHelper() {
        // 创建网格辅助线 (大小: 20x20, 分割数: 20)
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        gridHelper.name = 'GridHelper';
        gridHelper.position.y = 0.01; // 略微抬高，避免与地板重叠
        this.scene.add(gridHelper);
        this.helpers.grid = gridHelper;
        
        console.log('[SceneManager] 网格辅助线已添加');
    }
    
    /**
     * 添加反光地板
     * 使用带有金属度和粗糙度的材质创建反光效果
     */
    addReflectiveFloor() {
        // 创建地板几何体
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        
        // 创建反光材质
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a3e,
            metalness: 0.6,    // 金属度
            roughness: 0.4,    // 粗糙度
            side: THREE.DoubleSide
        });
        
        // 创建地板网格
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2; // 旋转到水平面
        this.floor.position.y = 0;
        this.floor.receiveShadow = true; // 接收阴影
        this.floor.name = 'ReflectiveFloor';
        
        this.scene.add(this.floor);
        
        console.log('[SceneManager] 反光地板已添加');
    }
    
    /**
     * 配置雾效果
     * 增强场景的深度感和氛围
     */
    addFog() {
        // 线性雾效果 (颜色, 起始距离, 结束距离)
        this.scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);
        
        console.log('[SceneManager] 雾效果已配置');
    }
    
    /**
     * 获取场景实例
     * @returns {THREE.Scene} 场景对象
     */
    getScene() {
        return this.scene;
    }
    
    /**
     * 更新场景（每帧调用）
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime) {
        // 预留给未来的场景动画或动态效果
        // 例如：动态光照、移动的云层等
    }
    
    /**
     * 切换网格辅助线的可见性
     * @param {boolean} visible - 是否可见
     */
    setGridHelperVisible(visible) {
        if (this.helpers.grid) {
            this.helpers.grid.visible = visible;
        }
    }
    
    /**
     * 切换地板的可见性
     * @param {boolean} visible - 是否可见
     */
    setFloorVisible(visible) {
        if (this.floor) {
            this.floor.visible = visible;
        }
    }
    
    /**
     * 更新光照强度
     * @param {string} lightType - 光照类型 ('ambient' 或 'directional')
     * @param {number} intensity - 强度值
     */
    setLightIntensity(lightType, intensity) {
        if (this.lights[lightType]) {
            this.lights[lightType].intensity = intensity;
            console.log(`[SceneManager] ${lightType}光照强度已更新为: ${intensity}`);
        }
    }
    
    /**
     * 更新雾效果参数
     * @param {number} near - 起始距离
     * @param {number} far - 结束距离
     */
    updateFog(near, far) {
        if (this.scene.fog) {
            this.scene.fog.near = near;
            this.scene.fog.far = far;
            console.log(`[SceneManager] 雾效果已更新: near=${near}, far=${far}`);
        }
    }
    
    /**
     * 清理场景资源
     */
    dispose() {
        console.log('[SceneManager] 清理场景资源');
        
        // 清理地板
        if (this.floor) {
            this.floor.geometry.dispose();
            this.floor.material.dispose();
        }
        
        // 清理网格辅助线
        if (this.helpers.grid) {
            this.helpers.grid.geometry.dispose();
            this.helpers.grid.material.dispose();
        }
        
        // 清空场景
        if (this.scene) {
            this.scene.clear();
        }
    }
}

/**
 * 创建场景（兼容旧版API）
 * @returns {THREE.Scene} 场景对象
 * @deprecated 请使用 SceneManager 类
 */
export function createScene() {
    const manager = new SceneManager();
    return manager.getScene();
}
