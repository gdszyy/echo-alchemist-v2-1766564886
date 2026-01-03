/**
 * Echo Alchemist 3D Rendering System
 * Camera management for the 3D scene.
 * 
 * 职责：
 * - 管理摄像机位置、FOV和视角
 * - 提供2D俯视和3D斜视两种预设
 * - 支持平滑的视角切换
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

/**
 * 缓动函数：EaseInOutCubic
 * 提供平滑的加速-减速效果
 * 
 * 数学原理：
 * - 前半段 (t < 0.5): 使用三次方加速 f(t) = 4t³
 * - 后半段 (t >= 0.5): 使用三次方减速 f(t) = 1 - (-2t + 2)³ / 2
 * 
 * 效果：开始和结束时速度较慢，中间速度较快，适合视角切换动画
 * 
 * @param {number} t - 进度值 (0-1)
 * @returns {number} 缓动后的值 (0-1)
 */
function easeInOutCubic(t) {
    return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 摄像机预设类型
 */
export const CameraPreset = {
    TOP_DOWN_2D: 'top_down_2d',    // 2D俯视视角
    ISOMETRIC_3D: 'isometric_3d'   // 3D斜视视角
};

/**
 * 摄像机控制器类
 * 管理3D场景中的摄像机位置、视角和FOV
 */
export class CameraController {
    /**
     * 构造函数
     * @param {number} aspect - 摄像机宽高比
     */
    constructor(aspect = window.innerWidth / window.innerHeight) {
        // 创建透视摄像机
        this.camera = new THREE.PerspectiveCamera(
            75,      // FOV
            aspect,  // 宽高比
            0.1,     // 近裁剪面
            1000     // 远裁剪面
        );
        
        // 当前预设
        this.currentPreset = null;
        
        // 预设配置
        this.presets = {
            [CameraPreset.TOP_DOWN_2D]: {
                position: { x: 0, y: 20, z: 0 },      // 正上方位置
                lookAt: { x: 0, y: 0, z: 0 },         // 看向原点
                fov: 60,                               // 较小的FOV以获得正交感
                description: '2D俯视视角 - 从正上方俯视游戏场景'
            },
            [CameraPreset.ISOMETRIC_3D]: {
                position: { x: 10, y: 10, z: 10 },    // 斜上方位置
                lookAt: { x: 0, y: 0, z: 0 },         // 看向原点
                fov: 75,                               // 标准FOV
                description: '3D斜视视角 - 类似等距视角的3D视图'
            }
        };
        
        // 平滑过渡参数
        this.transitionSpeed = 0.1; // 插值速度 (0-1)
        this.targetPosition = new THREE.Vector3();
        this.targetLookAt = new THREE.Vector3();
        this.targetFOV = 75;
        
        // 默认设置为3D斜视视角
        this.setPreset(CameraPreset.ISOMETRIC_3D, false);
        
        // 运镜动画状态 (Task 2.4)
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionDuration = 1.5; // 1.5秒过渡时长
        this.transitionStartTime = 0;
        this.transitionStartPosition = new THREE.Vector3();
        this.transitionStartRotation = new THREE.Euler();
        this.transitionStartFOV = 75;
        
        // Canvas引用 (用于淡入淡出)
        this.canvas2D = null;
        this.container3D = null;
        
    }
    
    /**
     * 设置摄像机预设
     * @param {string} presetName - 预设名称 (CameraPreset枚举值)
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setPreset(presetName, smooth = true) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.error(`[CameraController] 未知的预设: ${presetName}`);
            return;
        }
        
        this.currentPreset = presetName;
        
        // 设置目标位置和视角
        this.targetPosition.set(preset.position.x, preset.position.y, preset.position.z);
        this.targetLookAt.set(preset.lookAt.x, preset.lookAt.y, preset.lookAt.z);
        this.targetFOV = preset.fov;
        
        if (!smooth) {
            // 立即应用
            this.camera.position.copy(this.targetPosition);
            this.camera.lookAt(this.targetLookAt);
            this.camera.fov = this.targetFOV;
            this.camera.updateProjectionMatrix();
        }
        
    }
    
    /**
     * 切换到2D俯视视角
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setTopDownView(smooth = true) {
        this.setPreset(CameraPreset.TOP_DOWN_2D, smooth);
    }
    
    /**
     * 切换到3D斜视视角
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setIsometricView(smooth = true) {
        this.setPreset(CameraPreset.ISOMETRIC_3D, smooth);
    }
    
    /**
     * 获取当前预设名称
     * @returns {string} 当前预设名称
     */
    getCurrentPreset() {
        return this.currentPreset;
    }
    
    /**
     * 获取预设描述
     * @param {string} presetName - 预设名称
     * @returns {string} 预设描述
     */
    getPresetDescription(presetName) {
        const preset = this.presets[presetName];
        return preset ? preset.description : '未知预设';
    }
    
    /**
     * 更新摄像机状态 (每帧调用)
     * 实现平滑的位置和FOV过渡
     */
    update() {
        // 平滑插值位置
        this.camera.position.lerp(this.targetPosition, this.transitionSpeed);
        
        // 平滑插值FOV
        const fovDiff = this.targetFOV - this.camera.fov;
        if (Math.abs(fovDiff) > 0.01) {
            this.camera.fov += fovDiff * this.transitionSpeed;
            this.camera.updateProjectionMatrix();
        }
        
        // 更新摄像机朝向
        this.camera.lookAt(this.targetLookAt);
    }
    
    /**
     * 设置自定义位置
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} z - Z坐标
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setPosition(x, y, z, smooth = true) {
        this.targetPosition.set(x, y, z);
        if (!smooth) {
            this.camera.position.copy(this.targetPosition);
        }
    }
    
    /**
     * 设置摄像机注视点
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} z - Z坐标
     */
    setLookAt(x, y, z) {
        this.targetLookAt.set(x, y, z);
        this.camera.lookAt(this.targetLookAt);
    }
    
    /**
     * 设置FOV (视野角度)
     * @param {number} fov - FOV值 (度数)
     * @param {boolean} smooth - 是否平滑过渡 (默认true)
     */
    setFOV(fov, smooth = true) {
        this.targetFOV = fov;
        if (!smooth) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }
    
    /**
     * 获取摄像机对象
     * @returns {THREE.PerspectiveCamera} Three.js摄像机对象
     */
    getCamera() {
        return this.camera;
    }
    
    /**
     * 处理窗口大小变化
     * @param {number} width - 新的宽度
     * @param {number} height - 新的高度
     */
    onWindowResize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
    
    /**
     * 设置过渡速度
     * @param {number} speed - 速度值 (0-1)
     */
    setTransitionSpeed(speed) {
        this.transitionSpeed = Math.max(0, Math.min(1, speed));
    }
    
    /**
     * 设置Canvas引用 (用于Task 2.4运镜动画)
     * @param {HTMLCanvasElement} canvas2D - 2D Canvas元素
     * @param {HTMLElement} container3D - 3D容器元素
     */
    setCanvasReferences(canvas2D, container3D) {
        this.canvas2D = canvas2D;
        this.container3D = container3D;
    }
    
    /**
     * 切换到3D模式 (Task 2.4)
     * 启动平滑过渡动画，过渡时长1.5秒
     */
    transitionTo3D() {
        if (this.isTransitioning) {
            console.warn('[CameraController] 正在过渡中，忽略请求');
            return;
        }
        
        
        // 记录起始状态
        this.transitionStartPosition.copy(this.camera.position);
        this.transitionStartRotation.copy(this.camera.rotation);
        this.transitionStartFOV = this.camera.fov;
        
        // 设置目标为3D预设
        this.setPreset(CameraPreset.ISOMETRIC_3D, false);
        
        // 启动过渡
        this.isTransitioning = true;
        this.transitionProgress = 0;
        this.transitionStartTime = performance.now();
        
        // 显示3D容器（初始透明）
        if (this.container3D) {
            this.container3D.style.display = 'block';
            this.container3D.style.opacity = '0';
        }
        
        // 开始动画循环
        this._animateTransition();
    }
    
    /**
     * 切换到2D模式 (Task 2.4)
     * 启动平滑过渡动画，过渡时长1.5秒
     */
    transitionTo2D() {
        if (this.isTransitioning) {
            console.warn('[CameraController] 正在过渡中，忽略请求');
            return;
        }
        
        
        // 记录起始状态
        this.transitionStartPosition.copy(this.camera.position);
        this.transitionStartRotation.copy(this.camera.rotation);
        this.transitionStartFOV = this.camera.fov;
        
        // 设置目标为2D预设
        this.setPreset(CameraPreset.TOP_DOWN_2D, false);
        
        // 启动过渡
        this.isTransitioning = true;
        this.transitionProgress = 0;
        this.transitionStartTime = performance.now();
        
        // 开始动画循环
        this._animateTransition();
    }
    
    /**
     * 动画循环（内部方法）
     * 使用requestAnimationFrame实现平滑过渡
     */
    _animateTransition() {
        if (!this.isTransitioning) {
            return;
        }
        
        const currentTime = performance.now();
        const elapsed = (currentTime - this.transitionStartTime) / 1000; // 转换为秒
        this.transitionProgress = Math.min(elapsed / this.transitionDuration, 1.0);
        
        // 应用缓动函数
        const easedProgress = easeInOutCubic(this.transitionProgress);
        
        // 插值摄像机位置
        this.camera.position.lerpVectors(
            this.transitionStartPosition,
            this.targetPosition,
            easedProgress
        );
        
        // 插值摄像机FOV
        this.camera.fov = this.transitionStartFOV + 
            (this.targetFOV - this.transitionStartFOV) * easedProgress;
        this.camera.updateProjectionMatrix();
        
        // 更新摄像机朝向
        this.camera.lookAt(this.targetLookAt);
        
        // 同步Canvas淡入淡出效果
        this._updateCanvasOpacity(easedProgress);
        
        // 检查是否完成过渡
        if (this.transitionProgress >= 1.0) {
            this._finishTransition();
        } else {
            // 继续动画
            requestAnimationFrame(() => this._animateTransition());
        }
    }
    
    /**
     * 更新Canvas透明度（内部方法）
     * 根据过渡进度同步淡入淡出效果
     * @param {number} progress - 缓动后的进度值 (0-1)
     */
    _updateCanvasOpacity(progress) {
        const isTo3D = this.currentPreset === CameraPreset.ISOMETRIC_3D;
        
        if (isTo3D) {
            // 切换到3D：2D Canvas淡出，3D容器淡入
            if (this.canvas2D) {
                this.canvas2D.style.opacity = String(1 - progress * 0.7); // 淡出到0.3
            }
            if (this.container3D) {
                this.container3D.style.opacity = String(progress);
            }
        } else {
            // 切换到2D：3D容器淡出，2D Canvas淡入
            if (this.container3D) {
                this.container3D.style.opacity = String(1 - progress);
            }
            if (this.canvas2D) {
                this.canvas2D.style.opacity = String(0.3 + progress * 0.7); // 从0.3淡入到1
            }
        }
    }
    
    /**
     * 完成过渡（内部方法）
     * 清理过渡状态并设置最终样式
     */
    _finishTransition() {
        this.isTransitioning = false;
        this.transitionProgress = 0;
        
        // 确保摄像机精确到达目标位置
        this.camera.position.copy(this.targetPosition);
        this.camera.lookAt(this.targetLookAt);
        this.camera.fov = this.targetFOV;
        this.camera.updateProjectionMatrix();
        
        const isTo3D = this.currentPreset === CameraPreset.ISOMETRIC_3D;
        
        if (isTo3D) {
            // 3D模式：显示3D容器，半透明2D Canvas
            if (this.container3D) {
                this.container3D.style.opacity = '1';
            }
            if (this.canvas2D) {
                this.canvas2D.style.opacity = '0.3';
            }
        } else {
            // 2D模式：隐藏3D容器，完全显示2D Canvas
            if (this.container3D) {
                this.container3D.style.display = 'none';
                this.container3D.style.opacity = '0';
            }
            if (this.canvas2D) {
                this.canvas2D.style.opacity = '1';
            }
        }
    }
    
    /**
     * 检查是否正在过渡
     * @returns {boolean}
     */
    isInTransition() {
        return this.isTransitioning;
    }
}


