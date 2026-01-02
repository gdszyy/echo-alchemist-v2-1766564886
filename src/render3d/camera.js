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
        
        console.log('[CameraController] 初始化完成');
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
        
        console.log(`[CameraController] 切换到预设: ${presetName} - ${preset.description}`);
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
}

/**
 * 创建摄像机控制器 (工厂函数)
 * @param {number} aspect - 摄像机宽高比
 * @returns {CameraController} 摄像机控制器实例
 */
export function createCameraController(aspect) {
    return new CameraController(aspect);
}

/**
 * 创建摄像机 (向后兼容的简单工厂函数)
 * @returns {THREE.PerspectiveCamera} Three.js摄像机对象
 */
export function createCamera() {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    return camera;
}
