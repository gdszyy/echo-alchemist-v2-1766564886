/**
 * Renderer3D.js - 3D 渲染管线主入口（M1：仅背景层）
 *
 * 职责：
 *   - 初始化 Three.js WebGLRenderer / Scene / PerspectiveCamera
 *   - 装配 BackgroundLayer（远景剪影/光柱/星云）
 *   - 装配 CameraController（M1 仅 IDLE 呼吸漂移）
 *   - 暴露 resize(w,h) / render(now) / dispose()
 *   - 暴露 CoordsMapper 供后续 milestone 用于 2D→3D 坐标转换
 *
 * 与游戏循环的对接：
 *   - core.js 构造 Game 时 try/catch 初始化此渲染器；任何失败 → 静默降级到 2D-only
 *   - sys_loop 每帧首调 this.renderer3d?.render(performance.now())
 *   - sys_resize 每次画布尺寸变化调 this.renderer3d?.resize(w, h)
 */

import * as THREE from 'three';
import { BackgroundLayer } from './BackgroundLayer.js';
import { CameraController } from './CameraController.js';
import { CoordsMapper } from './coords.js';

export class Renderer3D {
    /**
     * @param {HTMLCanvasElement} canvas    WebGL canvas 元素
     * @param {number}            width     initial pixel width
     * @param {number}            height    initial pixel height
     */
    constructor(canvas, width, height) {
        if (!canvas) throw new Error('[Renderer3D] canvas element required');

        this.canvas = canvas;
        this.width = Math.max(1, width | 0);
        this.height = Math.max(1, height | 0);

        this._initRenderer();
        this._initScene();
        this._initCamera();
        this._initLayers();

        this.coords = new CoordsMapper(this.width, this.height);
        this.cameraController = new CameraController(this.camera);

        // 帧计时（秒）
        this._tElapsed = 0;
        this._lastNow = 0;

        // 调试统计（可被外部读取）
        this.stats = { frames: 0, lastDtMs: 0 };
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,                 // 让背景颜色由 setClearColor 决定，便于后续 HUD 合成
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        // 第三个参数 false → 不修改 canvas 的 CSS 尺寸（CSS 由 index.html 全局规则控制）
        this.renderer.setSize(this.width, this.height, false);
        this.renderer.setClearColor(0x05060d, 1);
        // r152+ 用 outputColorSpace 替代 outputEncoding
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    _initScene() {
        this.scene = new THREE.Scene();
        // 体积雾 ≈ 远景柔化 & 景深前奏；M4 接入后处理 DoF 时会进一步加强
        this.scene.fog = new THREE.FogExp2(0x05060d, 0.0025);
    }

    _initCamera() {
        const aspect = this.width / this.height;
        // 窄 FOV：玩法面板（z=0）接近正交，畸变小，便于读图
        this.camera = new THREE.PerspectiveCamera(28, aspect, 10, 600);
        this.camera.position.set(0, -10, 180);
        this.camera.lookAt(0, 0, 0);
    }

    _initLayers() {
        this.background = new BackgroundLayer(this.scene);
        // M2 接入：玩法面板钉子；M3：敌人；M4：后处理；M5：遗物 3D 卡片；M6：GPU 粒子
    }

    /**
     * 同步画布尺寸。调用方负责保证传入的就是 2D Canvas 的 width/height。
     */
    resize(width, height) {
        const W = Math.max(1, width | 0);
        const H = Math.max(1, height | 0);
        if (W === this.width && H === this.height) return;
        this.width = W;
        this.height = H;
        this.renderer.setSize(W, H, false);
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.coords.update(W, H);
    }

    /**
     * 每帧调用一次。
     * @param {number} nowMs performance.now() 时间戳
     */
    render(nowMs) {
        if (this._lastNow === 0) this._lastNow = nowMs;
        // 限制 dt 上限避免标签页切回时的大跳变
        const dt = Math.min(0.1, Math.max(0, (nowMs - this._lastNow) / 1000));
        this._lastNow = nowMs;
        this._tElapsed += dt;

        if (this.background) this.background.update(dt, this._tElapsed);
        if (this.cameraController) this.cameraController.update(dt);

        this.renderer.render(this.scene, this.camera);

        this.stats.frames++;
        this.stats.lastDtMs = dt * 1000;
    }

    dispose() {
        try { if (this.background) this.background.dispose(); } catch (e) {}
        try { this.renderer.dispose(); } catch (e) {}
        this.background = null;
        this.cameraController = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
}
