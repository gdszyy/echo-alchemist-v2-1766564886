/**
 * render3d/effects/shockwave.js - 3D冲击波渲染器
 * 
 * 职责：
 * - 使用 THREE.RingGeometry 渲染冲击波特效
 * - 同步 game.shockwaves 数据
 * - 实现扩散动画和透明度渐变
 * - 支持自定义颜色和发光效果
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

/**
 * 冲击波3D渲染器
 * 使用 THREE.RingGeometry 实现环形扩散效果
 */
export class ShockwaveRenderer3D {
    /**
     * 构造函数
     * @param {THREE.Scene} scene - Three.js 场景对象
     * @param {number} maxShockwaves - 最大冲击波数量
     */
    constructor(scene, maxShockwaves = 100) {
        this.scene = scene;
        this.maxShockwaves = maxShockwaves;
        
        // 冲击波3D对象映射表 (key: shockwave2D实例, value: THREE.Mesh)
        this.shockwave3DMap = new Map();
        
    }
    
    /**
     * 同步冲击波数据
     * 从 entities.js 的 Shockwave 数组同步到 3D 场景
     * @param {Array} shockwaves - 来自 entities.js 的 Shockwave 对象数组
     * @param {Object} game - 游戏实例，用于坐标转换
     */
    syncShockwaves(shockwaves, game) {
        if (!shockwaves || shockwaves.length === 0) {
            // 清理所有现有的冲击波
            this.clearAllShockwaves();
            return;
        }
        
        // 记录当前活跃的冲击波
        const activeShockwaves = new Set();
        
        // 遍历2D冲击波，创建或更新对应的3D对象
        shockwaves.forEach(shockwave => {
            if (!shockwave || shockwave.alpha <= 0) return;
            
            activeShockwaves.add(shockwave);
            
            let mesh3D = this.shockwave3DMap.get(shockwave);
            
            // 如果3D对象不存在，创建新的
            if (!mesh3D) {
                mesh3D = this.createShockwaveMesh(shockwave);
                this.shockwave3DMap.set(shockwave, mesh3D);
                this.scene.add(mesh3D);
            }
            
            // 更新3D对象的属性
            this.updateShockwaveMesh(mesh3D, shockwave, game);
        });
        
        // 清理已失效的3D对象
        this.shockwave3DMap.forEach((mesh, shockwave) => {
            if (!activeShockwaves.has(shockwave)) {
                this.removeShockwaveMesh(mesh, shockwave);
            }
        });
    }
    
    /**
     * 创建冲击波网格对象
     * @param {Object} shockwave - 2D冲击波对象
     * @returns {THREE.Mesh} 冲击波网格
     */
    createShockwaveMesh(shockwave) {
        // 使用 RingGeometry 创建环形几何体
        // innerRadius: 内半径 (稍小于外半径，形成环形)
        // outerRadius: 外半径
        // thetaSegments: 圆周分段数 (越大越圆滑)
        const innerRadius = Math.max(0.1, shockwave.radius * 0.85);
        const outerRadius = shockwave.radius;
        const geometry = new THREE.RingGeometry(
            innerRadius / 50,  // 转换为3D坐标系
            outerRadius / 50,
            64  // 高质量圆形
        );
        
        // 解析颜色
        const color = this.parseColor(shockwave.color);
        
        // 创建材质 (双面渲染，透明，发光)
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: shockwave.alpha,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,  // 加法混合，产生发光效果
            depthWrite: false  // 禁用深度写入，避免透明度问题
        });
        
        // 创建网格
        const mesh = new THREE.Mesh(geometry, material);
        
        // 设置初始位置 (z轴稍微偏移，避免与地面重叠)
        mesh.position.z = 0.01;
        
        // 旋转到水平面 (RingGeometry 默认在 XY 平面)
        // 我们的游戏视角是俯视，所以冲击波应该在 XY 平面
        // 不需要额外旋转
        
        return mesh;
    }
    
    /**
     * 更新冲击波网格对象
     * @param {THREE.Mesh} mesh - 冲击波网格
     * @param {Object} shockwave - 2D冲击波对象
     * @param {Object} game - 游戏实例
     */
    updateShockwaveMesh(mesh, shockwave, game) {
        // 更新位置 (2D坐标转换为3D坐标)
        const x = (shockwave.x - game.width / 2) / 50;
        const y = -(shockwave.y - game.height / 2) / 50;
        mesh.position.x = x;
        mesh.position.y = y;
        
        // 更新几何体 (重新创建以适应新的半径)
        const innerRadius = Math.max(0.1, shockwave.radius * 0.85);
        const outerRadius = shockwave.radius;
        
        // 销毁旧几何体
        mesh.geometry.dispose();
        
        // 创建新几何体
        mesh.geometry = new THREE.RingGeometry(
            innerRadius / 50,
            outerRadius / 50,
            64
        );
        
        // 更新透明度
        mesh.material.opacity = shockwave.alpha;
        
        // 可选：添加脉动效果 (轻微的缩放动画)
        const pulseScale = 1.0 + Math.sin(Date.now() * 0.01) * 0.05;
        mesh.scale.set(pulseScale, pulseScale, 1);
    }
    
    /**
     * 移除冲击波网格对象
     * @param {THREE.Mesh} mesh - 冲击波网格
     * @param {Object} shockwave - 2D冲击波对象
     */
    removeShockwaveMesh(mesh, shockwave) {
        // 从场景中移除
        this.scene.remove(mesh);
        
        // 释放资源
        if (mesh.geometry) {
            mesh.geometry.dispose();
        }
        if (mesh.material) {
            mesh.material.dispose();
        }
        
        // 从映射表中删除
        this.shockwave3DMap.delete(shockwave);
    }
    
    /**
     * 清理所有冲击波
     */
    clearAllShockwaves() {
        this.shockwave3DMap.forEach((mesh, shockwave) => {
            this.removeShockwaveMesh(mesh, shockwave);
        });
        this.shockwave3DMap.clear();
    }
    
    /**
     * 解析颜色字符串为 THREE.Color
     * @param {string} colorStr - 颜色字符串 (hex 或 rgba)
     * @returns {THREE.Color} THREE.Color 对象
     */
    parseColor(colorStr) {
        if (!colorStr) return new THREE.Color(0xffffff);
        
        // 处理 hex 格式 (#RRGGBB 或 #RGB)
        if (colorStr.startsWith('#')) {
            return new THREE.Color(colorStr);
        }
        
        // 处理 rgba 格式 (rgba(r, g, b, a))
        if (colorStr.startsWith('rgba') || colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                const r = parseInt(match[1]) / 255;
                const g = parseInt(match[2]) / 255;
                const b = parseInt(match[3]) / 255;
                return new THREE.Color(r, g, b);
            }
        }
        
        // 默认白色
        return new THREE.Color(0xffffff);
    }
    
    /**
     * 更新冲击波系统 (每帧调用)
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime = 0.016) {
        // 冲击波的物理更新在 entities.js 中完成
        // 这里只需要同步数据到 3D 场景
        // 实际使用时，需要从游戏主循环传入冲击波数组
    }
    
    /**
     * 销毁冲击波渲染器
     */
    dispose() {
        this.clearAllShockwaves();
    }
}
