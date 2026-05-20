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
import { SceneProxy } from './SceneProxy.js';
import { PostFX } from './PostFX.js';

export class Renderer3D {
    /**
     * @param {HTMLCanvasElement} canvas    WebGL canvas 元素
     * @param {number}            width     initial pixel width
     * @param {number}            height    initial pixel height
     */
    constructor(canvas, width, height, opts = {}) {
        if (!canvas) throw new Error('[Renderer3D] canvas element required');

        this.canvas = canvas;
        this.width = Math.max(1, width | 0);
        this.height = Math.max(1, height | 0);
        this.opts = opts;

        // 后处理 baseline（与 PostFX 默认值保持一致）—— 用于合并 cameraController 瞬时增量
        this._fxBaselineDistortion = 0.06;
        this._fxBaselineChromatic  = 0.005;
        this._fxBaselineBloom      = 0.85;

        this._initRenderer();
        this._initScene();
        this._initCamera();

        // CoordsMapper：根据相机 FOV/距离自动算 scale，画布高度占视域 94%
        const cameraDist = Math.abs(this.camera.position.z);
        const scale = CoordsMapper.autoScaleFromFov(this.camera.fov, cameraDist, this.height, 0.94);
        this.coords = new CoordsMapper(this.width, this.height, scale);

        this._initLayers();

        // SceneProxy：玩法 ↔ 3D 桥接（钉子 / 墙 / 后续敌人 / 子弹...）
        this.proxy = new SceneProxy(this.scene, this.coords);

        this.cameraController = new CameraController(this.camera);

        // [3D-Main M4] 后处理管线：bloom / 畸变 / 颗粒 / 暗角 / ACES tonemap
        // 失败时静默回退到直接 render（this.postfx = null）
        this.postfx = null;
        try {
            this.postfx = new PostFX(this.renderer, this.scene, this.camera, this.width, this.height);
            // 校准 baseline（避免与 PostFX 内部默认值不一致）
            if (this.postfx.usingHDR) {
                this._fxBaselineBloom = 0.85;
            } else {
                this._fxBaselineBloom = 0.70;
            }
            console.info(`[Renderer3D] PostFX enabled (HDR=${this.postfx.usingHDR})`);
        } catch (err) {
            console.warn('[Renderer3D] PostFX init failed, falling back to direct render:', err);
            this.postfx = null;
        }

        // [3D-Main M4.5] 订阅 eventBus（若传入），把游戏事件转发到镜头
        if (opts.eventBus && typeof opts.eventBus.on === 'function') {
            this._bindEventBus(opts.eventBus);
        }

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
        // 新 H → 重算 scale
        const cameraDist = Math.abs(this.camera.position.z);
        const scale = CoordsMapper.autoScaleFromFov(this.camera.fov, cameraDist, H, 0.94);
        this.coords.update(W, H, scale);
        if (this.proxy) this.proxy.onResize();
        if (this.postfx) {
            try { this.postfx.resize(W, H); } catch (e) {
                console.warn('[Renderer3D] PostFX resize error:', e);
            }
        }
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
        if (this.proxy) this.proxy.update(dt, this._tElapsed);
        if (this.cameraController) this.cameraController.update(dt);

        // [M4.5] 把镜头瞬时增量合并到后处理 uniform
        if (this.postfx && this.cameraController) {
            const fx = this.cameraController.getPostFXState();
            this.postfx.setDistortion(
                this._fxBaselineDistortion + fx.distortion,
                this._fxBaselineChromatic  + fx.chromatic
            );
            this.postfx.setBloomStrength(this._fxBaselineBloom + fx.bloom);
            // exposure 通过 renderer.toneMappingExposure 控制（OutputPass 读取）
            this.renderer.toneMappingExposure = 1.0 + fx.exposure;
        }

        if (this.postfx) {
            this.postfx.render(dt);
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        this.stats.frames++;
        this.stats.lastDtMs = dt * 1000;
    }

    /**
     * [M4.5] 触发镜头事件。语义类型由 CameraController 内部处理。
     * @param {string} type   'IMPACT' | 'KILLED' | 'HIT_PLAYER' | 'BOSS_INTRO' | 'PHASE_TRANS'
     * @param {Object} [payload]
     */
    cameraEvent(type, payload = {}) {
        if (!this.cameraController) return;
        try {
            switch (type) {
                case 'IMPACT':
                    this.cameraController.triggerImpact(
                        payload.intensity ?? 1.0,
                        payload.dirX ?? 0,
                        payload.dirY ?? 0
                    );
                    break;
                case 'KILLED':
                    this.cameraController.triggerEnemyKilled(payload.intensity ?? 0.4);
                    break;
                case 'HIT_PLAYER':
                    this.cameraController.triggerPlayerHit(payload.intensity ?? 1.0);
                    break;
                case 'BOSS_INTRO':
                    this.cameraController.triggerBossIntro();
                    break;
                case 'PHASE_TRANS':
                    this.cameraController.triggerPhaseTransition();
                    break;
                case 'AIM':
                    this.cameraController.setAim(payload.x ?? 0, payload.y ?? 0);
                    break;
                default:
                    // 未知类型不报错，便于上游平滑扩展
                    break;
            }
        } catch (e) {
            console.warn('[Renderer3D] cameraEvent error:', e);
        }
    }

    /**
     * [M4.5] 订阅 eventBus 把游戏事件转发到镜头。轻量，幂等。
     * @private
     */
    _bindEventBus(bus) {
        // 暴击 / 强击：使用 damage:dealt 事件，按 damage 量级映射强度
        const onDamage = (data) => {
            if (!data) return;
            const dmg = data.damage || data.amount || 0;
            if (dmg <= 0) return;
            // 阈值：< 30 微震，30..120 中震，>= 120 大震
            let intensity = 0.18;
            if (dmg >= 120) intensity = 0.85;
            else if (dmg >= 30) intensity = 0.42;
            if (data.killed) intensity *= 1.4;
            this.cameraEvent('IMPACT', { intensity });
        };
        const onKill = (data) => {
            this.cameraEvent('KILLED', { intensity: 0.5 });
        };
        const onBossDefeated = () => {
            this.cameraEvent('IMPACT', { intensity: 1.4 });
        };
        const onPhaseChange = (data) => {
            this.cameraEvent('PHASE_TRANS', {});
        };

        bus.on('damage:dealt', onDamage);
        bus.on('enemy:killed', onKill);
        bus.on('boss:defeated', onBossDefeated);
        bus.on('phase:change', onPhaseChange);

        // 记录引用以便 dispose 时取消（如果 eventBus 提供 off）
        this._busHandlers = { onDamage, onKill, onBossDefeated, onPhaseChange };
        this._bus = bus;
    }

    dispose() {
        try { if (this.postfx) this.postfx.dispose(); } catch (e) {}
        try { if (this.proxy) this.proxy.dispose(); } catch (e) {}
        try { if (this.background) this.background.dispose(); } catch (e) {}
        try {
            if (this._bus && this._busHandlers && typeof this._bus.off === 'function') {
                this._bus.off('damage:dealt',  this._busHandlers.onDamage);
                this._bus.off('enemy:killed',  this._busHandlers.onKill);
                this._bus.off('boss:defeated', this._busHandlers.onBossDefeated);
                this._bus.off('phase:change',  this._busHandlers.onPhaseChange);
            }
        } catch (e) {}
        try { this.renderer.dispose(); } catch (e) {}
        this.postfx = null;
        this.proxy = null;
        this.background = null;
        this.cameraController = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this._bus = null;
        this._busHandlers = null;
    }
}
