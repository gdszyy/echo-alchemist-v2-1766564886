/**
 * render3d/entities/projectile.js - 子弹3D渲染器
 * 
 * 职责：
 * - 预渲染所有子弹类型的纹理到Canvas
 * - 使用THREE.Sprite实现Billboard效果
 * - 集成对象池管理，优化性能
 * - 与2D渲染逻辑保持视觉一致性
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CONFIG } from '../../config.js';
import { Projectile } from '../../entities.js';

/**
 * 子弹纹理预渲染器
 * 负责将2D Canvas渲染结果转换为THREE.js纹理
 */
class ProjectileTextureCache {
    constructor() {
        // 纹理缓存：key = 配置哈希, value = THREE.Texture
        this.cache = new Map();
        
        // 离屏Canvas用于预渲染
        this.canvas = document.createElement('canvas');
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.ctx = this.canvas.getContext('2d');
        
    }
    
    /**
     * 生成配置的哈希键
     * @param {Object} config - 子弹配置对象
     * @param {number} radius - 子弹半径
     * @param {number} integrity - 耐久度 (0-1)
     * @returns {string} 哈希键
     */
    generateKey(config, radius, integrity) {
        // 将配置转换为唯一字符串标识
        const keyParts = [
            config.type || 'normal',
            config.isLaser ? 'laser' : '',
            config.explosive ? 'explosive' : '',
            config.pyro || 0,
            config.cryo || 0,
            config.lightning || 0,
            config.wind || 0,
            config.pierce || 0,
            config.bounce || 0,
            config.scatter || 0,
            config.damage || 0,
            config.isMatryoshka ? 'matryoshka' : '',
            Math.round(radius),
            Math.round(integrity * 10) / 10 // 耐久度精确到0.1
        ];
        
        return keyParts.filter(p => p !== '' && p !== 0).join('_');
    }
    
    /**
     * 获取或创建纹理
     * @param {Object} config - 子弹配置
     * @param {number} radius - 子弹半径
     * @param {number} intensity - 光晕强度
     * @param {number} integrity - 耐久度
     * @param {number} rotation - 旋转角度
     * @returns {THREE.Texture} 纹理对象
     */
    getTexture(config, radius, intensity, integrity = 1.0, rotation = 0) {
        const key = this.generateKey(config, radius, integrity);
        
        // 检查缓存
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        // 预渲染纹理
        const texture = this.renderTexture(config, radius, intensity, integrity, rotation);
        this.cache.set(key, texture);
        
        return texture;
    }
    
    /**
     * 渲染子弹纹理到Canvas并转换为THREE.Texture
     * @param {Object} config - 子弹配置
     * @param {number} radius - 子弹半径
     * @param {number} intensity - 光晕强度
     * @param {number} integrity - 耐久度
     * @param {number} rotation - 旋转角度
     * @returns {THREE.Texture} 纹理对象
     */
    renderTexture(config, radius, intensity, integrity, rotation) {
        const ctx = this.ctx;
        const size = this.canvas.width;
        const center = size / 2;
        
        // 清空画布
        ctx.clearRect(0, 0, size, size);
        
        // 计算缩放比例（确保子弹适配纹理尺寸）
        const scale = Math.min(80 / radius, 4); // 最大80px，防止纹理溢出
        const scaledRadius = radius * scale;
        
        // 使用Projectile类的静态绘制方法
        // 注意：需要传递空的crackSeed和windBladeAngle，因为这些是动态效果
        Projectile.drawVisuals(
            ctx,
            center,
            center,
            scaledRadius,
            config,
            rotation,
            intensity,
            { x: 1, y: 1 }, // deformation
            integrity,
            [], // crackSeed - 裂纹效果在3D中暂不支持
            0   // windBladeAngle - 风刃效果在3D中需要单独处理
        );
        
        // 创建THREE.js纹理
        const texture = new THREE.CanvasTexture(this.canvas);
        texture.needsUpdate = true;
        
        // 纹理配置
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        return texture;
    }
    
    /**
     * 清空缓存
     */
    clear() {
        // 释放所有纹理
        for (const texture of this.cache.values()) {
            texture.dispose();
        }
        this.cache.clear();
    }
    
    /**
     * 获取缓存统计信息
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            memoryEstimate: this.cache.size * 256 * 256 * 4 // 粗略估算（RGBA）
        };
    }
}

/**
 * 子弹Sprite对象池
 * 复用THREE.Sprite对象，减少GC压力
 */
class ProjectileSpritePool {
    constructor(initialSize = 50) {
        this.pool = [];
        this.active = new Set();
        
        // 预创建对象
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createSprite());
        }
        
    }
    
    /**
     * 创建新的Sprite对象
     */
    createSprite() {
        const material = new THREE.SpriteMaterial({
            map: null,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            blending: THREE.AdditiveBlending // 使用加法混合实现发光效果
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.userData.pooled = true;
        
        return sprite;
    }
    
    /**
     * 从池中获取Sprite
     */
    acquire() {
        let sprite;
        
        if (this.pool.length > 0) {
            sprite = this.pool.pop();
        } else {
            // 池已空，创建新对象
            sprite = this.createSprite();
            console.warn('[ProjectileSpritePool] 池已空，动态创建新对象');
        }
        
        this.active.add(sprite);
        sprite.visible = true;
        
        return sprite;
    }
    
    /**
     * 归还Sprite到池中
     */
    release(sprite) {
        if (!sprite || !sprite.userData.pooled) return;
        
        // 重置状态
        sprite.visible = false;
        sprite.material.map = null;
        sprite.material.opacity = 1.0;
        sprite.position.set(0, 0, 0);
        sprite.scale.set(1, 1, 1);
        
        this.active.delete(sprite);
        this.pool.push(sprite);
    }
    
    /**
     * 批量归还所有活跃对象
     */
    releaseAll() {
        for (const sprite of this.active) {
            this.release(sprite);
        }
    }
    
    /**
     * 获取池统计信息
     */
    getStats() {
        return {
            poolSize: this.pool.length,
            activeCount: this.active.size,
            totalCount: this.pool.length + this.active.size
        };
    }
    
    /**
     * 销毁对象池
     */
    dispose() {
        // 释放所有Sprite的材质和纹理
        const allSprites = [...this.pool, ...this.active];
        for (const sprite of allSprites) {
            if (sprite.material) {
                sprite.material.dispose();
            }
        }
        
        this.pool = [];
        this.active.clear();
    }
}

/**
 * 子弹3D渲染器
 * 主类，负责协调纹理缓存和对象池
 */
export class ProjectileRenderer3D {
    constructor(scene) {
        this.scene = scene;
        
        // 初始化纹理缓存
        this.textureCache = new ProjectileTextureCache();
        
        // 初始化对象池
        this.spritePool = new ProjectileSpritePool(100);
        
        // 子弹映射表：projectile -> sprite
        this.projectileMap = new Map();
        
        // 性能统计
        this.stats = {
            renderCount: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
    }
    
    /**
     * 添加子弹到3D场景
     * @param {Projectile} projectile - 2D子弹实例
     */
    addProjectile(projectile) {
        if (this.projectileMap.has(projectile)) {
            console.warn('[ProjectileRenderer3D] 子弹已存在，跳过添加');
            return;
        }
        
        // 从对象池获取Sprite
        const sprite = this.spritePool.acquire();
        
        // 获取纹理
        const texture = this.textureCache.getTexture(
            projectile.config,
            projectile.radius,
            projectile.intensity,
            1.0, // 初始耐久度
            projectile.rotation
        );
        
        // 配置Sprite
        sprite.material.map = texture;
        sprite.material.needsUpdate = true;
        
        // 设置尺寸（根据2D半径映射到3D空间）
        const scale = projectile.radius * 0.1; // 调整比例以适配3D场景
        sprite.scale.set(scale, scale, 1);
        
        // 设置初始位置（2D坐标转3D坐标）
        this.updateSpritePosition(sprite, projectile);
        
        // 添加到场景
        this.scene.add(sprite);
        
        // 建立映射关系
        this.projectileMap.set(projectile, sprite);
        
        this.stats.renderCount++;
    }
    
    /**
     * 更新子弹位置和状态
     * @param {Projectile} projectile - 2D子弹实例
     */
    updateProjectile(projectile) {
        const sprite = this.projectileMap.get(projectile);
        if (!sprite) return;
        
        // 更新位置
        this.updateSpritePosition(sprite, projectile);
        
        // 更新耐久度（透明度）
        const integrity = (projectile.bouncesLeft + projectile.piercesLeft) / (projectile.maxDurability || 1);
        sprite.material.opacity = Math.max(0.3, integrity); // 最低30%透明度
        
        // 更新旋转（仅对特定类型）
        if (projectile.config.pierce > 0 || projectile.config.scatter > 0) {
            sprite.material.rotation = projectile.rotation;
        }
        
        // 更新形变（弹性效果）
        if (projectile.deformation) {
            sprite.scale.x = projectile.radius * 0.1 * projectile.deformation.x;
            sprite.scale.y = projectile.radius * 0.1 * projectile.deformation.y;
        }
    }
    
    /**
     * 移除子弹
     * @param {Projectile} projectile - 2D子弹实例
     */
    removeProjectile(projectile) {
        const sprite = this.projectileMap.get(projectile);
        if (!sprite) return;
        
        // 从场景移除
        this.scene.remove(sprite);
        
        // 归还到对象池
        this.spritePool.release(sprite);
        
        // 删除映射关系
        this.projectileMap.delete(projectile);
    }
    
    /**
     * 更新Sprite的3D位置
     * @param {THREE.Sprite} sprite - Sprite对象
     * @param {Projectile} projectile - 子弹实例
     */
    updateSpritePosition(sprite, projectile) {
        // 2D坐标转3D坐标
        // 假设：2D画布中心为(0, 0)，需要根据实际游戏坐标系调整
        // 这里使用简单的映射：x不变，y翻转（Canvas的y向下，3D的y向上）
        sprite.position.set(
            (projectile.pos.x - 400) * 0.01, // 假设画布宽800，中心在400
            -(projectile.pos.y - 300) * 0.01, // 假设画布高600，中心在300
            0 // z轴固定在0（所有子弹在同一平面）
        );
    }
    
    /**
     * 批量更新所有子弹
     * @param {Array<Projectile>} projectiles - 子弹数组
     */
    updateAll(projectiles) {
        // 更新现有子弹
        for (const projectile of projectiles) {
            if (!projectile.active) {
                this.removeProjectile(projectile);
                continue;
            }
            
            if (!this.projectileMap.has(projectile)) {
                this.addProjectile(projectile);
            } else {
                this.updateProjectile(projectile);
            }
        }
        
        // 清理已销毁的子弹
        for (const [projectile, sprite] of this.projectileMap.entries()) {
            if (!projectiles.includes(projectile) || !projectile.active) {
                this.removeProjectile(projectile);
            }
        }
    }
    
    /**
     * 清空所有子弹
     */
    clear() {
        for (const [projectile, sprite] of this.projectileMap.entries()) {
            this.scene.remove(sprite);
            this.spritePool.release(sprite);
        }
        this.projectileMap.clear();
    }
    
    /**
     * 获取性能统计
     */
    getStats() {
        return {
            ...this.stats,
            projectileCount: this.projectileMap.size,
            textureCache: this.textureCache.getStats(),
            spritePool: this.spritePool.getStats()
        };
    }
    
    /**
     * 销毁渲染器
     */
    dispose() {
        
        // 清空子弹
        this.clear();
        
        // 销毁对象池
        this.spritePool.dispose();
        
        // 清空纹理缓存
        this.textureCache.clear();
        
    }
}
