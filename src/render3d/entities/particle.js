/**
 * render3d/entities/particle.js - 3D粒子系统
 * 
 * 职责：
 * - 使用 THREE.Points 和自定义 Shader 渲染大量粒子
 * - 实现 GPU 加速的粒子效果
 * - 支持多种粒子模式 (spark, ember, mist, shard, wind_slash 等)
 * - 高性能批量渲染
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

/**
 * 粒子系统3D渲染器
 * 使用 THREE.Points 和自定义 Shader 实现 GPU 加速的粒子渲染
 */
export class ParticleSystem3D {
    /**
     * 构造函数
     * @param {THREE.Scene} scene - Three.js 场景对象
     * @param {number} maxParticles - 最大粒子数量
     */
    constructor(scene, maxParticles = 10000) {
        this.scene = scene;
        this.maxParticles = maxParticles;
        
        // 粒子数据数组 (从 entities.js 的 Particle 类同步)
        this.particles = [];
        
        // 创建 BufferGeometry 和材质
        this.initGeometry();
        this.initMaterial();
        
        // 创建 Points 对象
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false; // 禁用视锥剔除以提高性能
        this.scene.add(this.points);
        
    }
    
    /**
     * 初始化 BufferGeometry
     * 预分配所有粒子的顶点属性缓冲区
     */
    initGeometry() {
        this.geometry = new THREE.BufferGeometry();
        
        // 预分配缓冲区
        const positions = new Float32Array(this.maxParticles * 3); // x, y, z
        const colors = new Float32Array(this.maxParticles * 3);    // r, g, b
        const sizes = new Float32Array(this.maxParticles);         // size
        const alphas = new Float32Array(this.maxParticles);        // alpha
        const modes = new Float32Array(this.maxParticles);         // particle mode (encoded as float)
        const velocities = new Float32Array(this.maxParticles * 3); // vx, vy, vz
        const rotations = new Float32Array(this.maxParticles);     // rotation angle
        
        // 设置属性
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        this.geometry.setAttribute('mode', new THREE.BufferAttribute(modes, 1));
        this.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        this.geometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
        
        // 设置绘制范围 (初始为0)
        this.geometry.setDrawRange(0, 0);
    }
    
    /**
     * 初始化自定义 Shader 材质
     */
    initMaterial() {
        // 顶点着色器
        // 职责：处理每个粒子的顶点变换，计算屏幕位置和大小
        const vertexShader = `
            // 自定义属性
            attribute float size;       // 粒子大小
            attribute float alpha;      // 透明度
            attribute float mode;       // 粒子模式（编码为浮点数）
            attribute vec3 velocity;    // 速度向量
            attribute float rotation;   // 旋转角度
            
            // 传递给片段着色器的变量
            varying vec3 vColor;
            varying float vAlpha;
            varying float vMode;
            varying vec3 vVelocity;
            varying float vRotation;
            
            void main() {
                // 将属性传递给片段着色器
                vColor = color;
                vAlpha = alpha;
                vMode = mode;
                vVelocity = velocity;
                vRotation = rotation;
                
                // 计算视图空间位置
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                
                // 计算粒子大小（带透视缩放）
                // 300.0 / -mvPosition.z 实现距离衰减效果
                gl_PointSize = size * (300.0 / -mvPosition.z);
                
                // 计算最终屏幕位置
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
        
        // 片段着色器
        // 职责：根据粒子模式绘制不同的形状和效果
        const fragmentShader = `
            // 从顶点着色器传入的变量
            varying vec3 vColor;
            varying float vAlpha;
            varying float vMode;
            varying vec3 vVelocity;
            varying float vRotation;
            
            void main() {
                // 计算当前像素到粒子中心的距离
                // gl_PointCoord: 当前像素在粒子中的归一化坐标 (0-1)
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                // 初始化颜色和透明度
                float alpha = vAlpha;
                vec3 finalColor = vColor;
                
                // 粒子模式编码映射表：
                // 0: normal      - 普通圆形粒子
                // 1: spark       - 火花，拉伸的椭圆形
                // 2: ember       - 余烬，径向渐变发光
                // 3: mist        - 雾气，大面积柔和边缘
                // 4: shard       - 冰渣，菱形/多边形
                // 5: smoke       - 烟雾效果
                // 6: line        - 线条粒子
                // 7: wind_slash  - 风刃，梭形
                
                if (vMode < 0.5) {
                    // normal: 简单圆形粒子
                    if (dist > 0.5) discard;
                    alpha *= (1.0 - dist * 2.0);
                    
                } else if (vMode < 1.5) {
                    // spark: 拉伸的椭圆形 (根据速度方向)
                    float angle = atan(vVelocity.y, vVelocity.x) + vRotation;
                    vec2 rotated = vec2(
                        center.x * cos(angle) - center.y * sin(angle),
                        center.x * sin(angle) + center.y * cos(angle)
                    );
                    float ellipseDist = length(vec2(rotated.x * 0.25, rotated.y));
                    if (ellipseDist > 0.5) discard;
                    alpha *= (1.0 - ellipseDist * 2.0);
                    
                } else if (vMode < 2.5) {
                    // ember: 火焰余烬，径向渐变发光
                    if (dist > 0.5) discard;
                    float glow = 1.0 - dist * 2.0;
                    finalColor = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 0.8), glow);
                    alpha *= glow * glow;
                    
                } else if (vMode < 3.5) {
                    // mist: 大面积雾气，柔和边缘
                    if (dist > 0.5) discard;
                    alpha *= (1.0 - dist * 2.0) * 0.4;
                    
                } else if (vMode < 4.5) {
                    // shard: 冰渣，菱形/多边形
                    vec2 rotated = vec2(
                        center.x * cos(vRotation) - center.y * sin(vRotation),
                        center.x * sin(vRotation) + center.y * cos(vRotation)
                    );
                    // 菱形判断
                    if (abs(rotated.x) + abs(rotated.y) > 0.5) discard;
                    
                } else if (vMode < 5.5) {
                    // smoke: 烟雾效果
                    if (dist > 0.5) discard;
                    alpha *= (1.0 - dist * 2.0) * 0.6;
                    
                } else if (vMode < 6.5) {
                    // line: 线条粒子
                    if (abs(center.y) > 0.1 || abs(center.x) > 0.5) discard;
                    
                } else {
                    // wind_slash: 风刃，梭形
                    float angle = atan(vVelocity.y, vVelocity.x);
                    vec2 rotated = vec2(
                        center.x * cos(angle) - center.y * sin(angle),
                        center.x * sin(angle) + center.y * cos(angle)
                    );
                    // 梭形判断
                    float shape = abs(rotated.y) + abs(rotated.x) * 0.5;
                    if (shape > 0.5) discard;
                    // 渐变色：中心亮白，边缘青色
                    finalColor = mix(vec3(0.2, 0.83, 0.6), vec3(1.0), 1.0 - abs(rotated.x) * 2.0);
                }
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `;
        
        this.material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending, // 加法混合，适合发光粒子
            vertexColors: true
        });
    }
    
    /**
     * 同步粒子数据
     * 从 entities.js 的 Particle 数组同步到 GPU 缓冲区
     * @param {Array} particles - 来自 entities.js 的 Particle 对象数组
     */
    syncParticles(particles) {
        if (!particles || particles.length === 0) {
            this.geometry.setDrawRange(0, 0);
            return;
        }
        
        // 限制粒子数量
        const count = Math.min(particles.length, this.maxParticles);
        
        // 获取属性缓冲区
        const positions = this.geometry.attributes.position.array;
        const colors = this.geometry.attributes.color.array;
        const sizes = this.geometry.attributes.size.array;
        const alphas = this.geometry.attributes.alpha.array;
        const modes = this.geometry.attributes.mode.array;
        const velocities = this.geometry.attributes.velocity.array;
        const rotations = this.geometry.attributes.rotation.array;
        
        // 更新每个粒子的属性
        for (let i = 0; i < count; i++) {
            const particle = particles[i];
            
            // 位置 (2D -> 3D: x, y, 0)
            positions[i * 3] = particle.pos.x;
            positions[i * 3 + 1] = particle.pos.y;
            positions[i * 3 + 2] = 0;
            
            // 颜色 (解析 hex 或 rgba 字符串)
            const rgb = this.parseColor(particle.color);
            colors[i * 3] = rgb.r;
            colors[i * 3 + 1] = rgb.g;
            colors[i * 3 + 2] = rgb.b;
            
            // 大小
            sizes[i] = particle.size || 1.0;
            
            // 透明度
            alphas[i] = Math.max(0, particle.life || 0);
            
            // 模式编码
            modes[i] = this.encodeMode(particle.mode);
            
            // 速度
            velocities[i * 3] = particle.vel ? particle.vel.x : 0;
            velocities[i * 3 + 1] = particle.vel ? particle.vel.y : 0;
            velocities[i * 3 + 2] = 0;
            
            // 旋转角度
            rotations[i] = particle.angle || 0;
        }
        
        // 标记属性需要更新
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
        this.geometry.attributes.mode.needsUpdate = true;
        this.geometry.attributes.velocity.needsUpdate = true;
        this.geometry.attributes.rotation.needsUpdate = true;
        
        // 更新绘制范围
        this.geometry.setDrawRange(0, count);
    }
    
    /**
     * 解析颜色字符串为 RGB 值 (0-1 范围)
     * @param {string} colorStr - 颜色字符串 (hex 或 rgba)
     * @returns {Object} { r, g, b }
     */
    parseColor(colorStr) {
        if (!colorStr) return { r: 1, g: 1, b: 1 };
        
        // 处理 hex 格式 (#RRGGBB 或 #RGB)
        if (colorStr.startsWith('#')) {
            let hex = colorStr.substring(1);
            
            // 处理简写形式 (#RGB -> #RRGGBB)
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            
            return { r, g, b };
        }
        
        // 处理 rgba 格式 (rgba(r, g, b, a))
        if (colorStr.startsWith('rgba')) {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                return {
                    r: parseInt(match[1]) / 255,
                    g: parseInt(match[2]) / 255,
                    b: parseInt(match[3]) / 255
                };
            }
        }
        
        // 默认白色
        return { r: 1, g: 1, b: 1 };
    }
    
    /**
     * 将粒子模式编码为浮点数
     * @param {string} mode - 粒子模式
     * @returns {number} 编码后的数值
     */
    encodeMode(mode) {
        const modeMap = {
            'normal': 0,
            'spark': 1,
            'ember': 2,
            'mist': 3,
            'shard': 4,
            'smoke': 5,
            'line': 6,
            'wind_slash': 7
        };
        
        return modeMap[mode] !== undefined ? modeMap[mode] : 0;
    }
    
    /**
     * 更新粒子系统 (每帧调用)
     * @param {number} deltaTime - 帧间隔时间
     */
    update(deltaTime = 0.016) {
        // 粒子的物理更新在 entities.js 中完成
        // 这里只需要同步数据到 GPU
        // 实际使用时，需要从游戏主循环传入粒子数组
    }
    
    /**
     * 设置混合模式
     * @param {number} blending - THREE.js 混合模式常量
     */
    setBlending(blending) {
        this.material.blending = blending;
    }
    
    /**
     * 销毁粒子系统
     */
    dispose() {
        if (this.geometry) {
            this.geometry.dispose();
        }
        
        if (this.material) {
            this.material.dispose();
        }
        
        if (this.points && this.scene) {
            this.scene.remove(this.points);
        }
        
    }
}
