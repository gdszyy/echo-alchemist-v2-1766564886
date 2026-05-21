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
import { detectProfile, getProfileConfig } from './QualityProfile.js';

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

        // [M6.5] 自适应画质（auto / 或 localStorage 强制锁定）
        this.profileName = detectProfile(this.renderer);
        this.profile = getProfileConfig(this.profileName);
        // pixelRatio cap：低端设备别用 ratio 2
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        this.renderer.setPixelRatio(Math.min(dpr, this.profile.pixelRatioCap));

        this._initScene();
        this._initCamera();

        // CoordsMapper：根据相机 FOV/距离自动算 scale，画布高度占视域 94%
        const cameraDist = Math.abs(this.camera.position.z);
        const scale = CoordsMapper.autoScaleFromFov(this.camera.fov, cameraDist, this.height, 0.94);
        this.coords = new CoordsMapper(this.width, this.height, scale);

        this._initLayers();

        // SceneProxy：玩法 ↔ 3D 桥接（钉子 / 墙 / 后续敌人 / 子弹...）
        this.proxy = new SceneProxy(this.scene, this.coords, {
            particleCapacity: this.profile.particleCapacity,
        });

        this.cameraController = new CameraController(this.camera);

        // [3D-Main M4] 后处理管线：bloom / 畸变 / 颗粒 / 暗角 / ACES tonemap
        // [M6.5] low profile 完全跳过 postFX，直接走 renderer.render
        this.postfx = null;
        if (this.profile.postFX) {
            try {
                this.postfx = new PostFX(this.renderer, this.scene, this.camera, this.width, this.height, {
                    hdr: this.profile.hdr,
                });
                // baseline bloom 跟随 profile
                this._fxBaselineBloom = this.profile.bloomStrength;
                // 如果 profile 关闭 lens 畸变，把基线设为 0
                if (!this.profile.lensDistortion) {
                    this._fxBaselineDistortion = 0;
                    this._fxBaselineChromatic = 0;
                    this.postfx.setDistortion(0, 0);
                }
                // 关 grain：把对应 uniform 强制清零
                if (!this.profile.filmGrain && this.postfx.vignettePass) {
                    this.postfx.vignettePass.uniforms.uGrainAmount.value = 0;
                }
                console.info(`[Renderer3D] PostFX enabled (profile=${this.profileName}, HDR=${this.postfx.usingHDR})`);
            } catch (err) {
                console.warn('[Renderer3D] PostFX init failed, falling back to direct render:', err);
                this.postfx = null;
            }
        } else {
            console.info(`[Renderer3D] PostFX skipped (profile=${this.profileName})`);
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
            // [M4] 全屏白闪
            if (typeof this.postfx.setFlash === 'function') {
                this.postfx.setFlash(fx.flash || 0);
            }
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
                case 'FLASH':
                    this.cameraController.triggerFlash(payload.intensity ?? 0.4);
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
        // [视觉调优] 子弹打击的「图形 + 颜色」必须按元素绑定（与 promare codex 对齐），
        // 不能所有元素都是同一坨橙黄小爆炸。下面这张表把 damage:dealt.type 映射成：
        //   - GPU 粒子的 color（5 色硬切板 + 几个辅色）
        //   - 粒子的 mode（spark/ember/shard/smoke/mist，匹配元素气质）
        //   - 数量倍率（穿透/激光偏少而尖；爆破/火焰偏多而散）
        const ELEMENT_FX = {
            pyro:         { color: 0xFF0090, mode: 'ember', countMul: 1.0,  sizeMul: 1.05 }, // PINK 余烬
            cryo:         { color: 0x00E5FF, mode: 'shard', countMul: 0.9,  sizeMul: 1.0  }, // CYAN 冰碎
            lightning:    { color: 0xFFD600, mode: 'spark', countMul: 1.15, sizeMul: 0.9  }, // YELLOW 锐花
            bounce:       { color: 0xFF0090, mode: 'spark', countMul: 0.9,  sizeMul: 1.05 }, // PINK 弹射
            pierce:       { color: 0xFFFFFF, mode: 'shard', countMul: 0.7,  sizeMul: 1.1  }, // WHITE 锐碎
            wind:         { color: 0x00E5FF, mode: 'mist',  countMul: 0.85, sizeMul: 1.2  }, // CYAN 风雾
            scatter:      { color: 0xFFD600, mode: 'spark', countMul: 1.3,  sizeMul: 0.85 }, // YELLOW 散射
            venom:        { color: 0xFFD600, mode: 'smoke', countMul: 0.9,  sizeMul: 1.0  },
            echo:         { color: 0xFF0090, mode: 'spark', countMul: 0.9,  sizeMul: 1.0  },
            laser:        { color: 0x00E5FF, mode: 'spark', countMul: 0.8,  sizeMul: 0.9  },
            flying_sword: { color: 0xFFFFFF, mode: 'shard', countMul: 0.85, sizeMul: 1.0  },
            damage:       { color: 0xFFFFFF, mode: 'spark', countMul: 1.0,  sizeMul: 1.0  },
        };

        const onDamage = (data) => {
            if (!data) return;
            const dmg = data.damage || data.amount || 0;
            if (dmg <= 0) return;

            // [视觉调优] 用户反馈"第一回合那个小破子弹打上去闪的厉害"：
            // 微伤害（< 10）单独划档，只给极弱镜头扰动 + 几颗粒子，不触发任何全屏闪。
            // 强击（>= 60）+ 暴击（>= 150）才有 punch。
            const isKill = !!data.killed;
            let bucket = 'tiny';
            if      (dmg >= 120) bucket = 'huge';
            else if (dmg >= 60)  bucket = 'big';
            else if (dmg >= 18)  bucket = 'normal';
            else                 bucket = 'tiny';
            const BUCKET_INTENSITY = { tiny: 0.07, normal: 0.20, big: 0.48, huge: 0.85 };
            let intensity = BUCKET_INTENSITY[bucket];
            if (isKill) intensity = Math.min(1.0, intensity * 1.35);
            this.cameraEvent('IMPACT', { intensity });

            // 全屏白闪：tiny / normal 完全不闪；big 轻闪；huge / 击杀大伤害大闪。
            if (bucket === 'huge' || (isKill && dmg >= 60)) {
                const flashAmt = Math.min(0.6, 0.25 + dmg / 600);
                this.cameraEvent('FLASH', { intensity: flashAmt });
            } else if (bucket === 'big' && isKill) {
                this.cameraEvent('FLASH', { intensity: 0.18 });
            }

            // [视觉调优] 击中处撒粒子：颜色 / 形状按元素绑定，数量随档位收紧。
            // tiny 4 颗，normal 8 颗，big 16 颗，huge 28 颗，再乘元素 countMul。
            const proxy = this.proxy;
            if (proxy && proxy.spawnParticles) {
                const hx = data.hitX ?? (data.enemy && data.enemy.pos && data.enemy.pos.x);
                const hy = data.hitY ?? (data.enemy && data.enemy.pos && data.enemy.pos.y);
                if (hx !== undefined && hy !== undefined) {
                    const fx = ELEMENT_FX[data.type] || ELEMENT_FX.damage;
                    const BASE_COUNT = { tiny: 4, normal: 8, big: 16, huge: 28 };
                    const baseCnt = BASE_COUNT[bucket];
                    const cnt = Math.max(2, Math.round(baseCnt * fx.countMul));
                    proxy.spawnParticles({
                        x: hx, y: hy,
                        color: fx.color,
                        mode: fx.mode,
                        count: cnt,
                        size: (2.4 + intensity * 3.5) * fx.sizeMul,
                        lifetime: 0.30 + intensity * 0.55,
                        spread: 0.85 + intensity * 0.55,
                        speed: 4 + intensity * 14,
                    });
                }
            }
        };
        const onKill = (data) => {
            this.cameraEvent('KILLED', { intensity: 0.5 });
            // [M6] 击杀位置撒 ember + shard 爆开
            const proxy = this.proxy;
            if (proxy && proxy.spawnParticles && data && data.enemy && data.enemy.pos) {
                proxy.spawnParticles({
                    x: data.enemy.pos.x, y: data.enemy.pos.y,
                    color: 0xfb923c, mode: 'ember',
                    count: 24, size: 5, lifetime: 0.9, spread: 1.6, speed: 14,
                });
                proxy.spawnParticles({
                    x: data.enemy.pos.x, y: data.enemy.pos.y,
                    color: 0xfde047, mode: 'shard',
                    count: 12, size: 6, lifetime: 0.5, spread: 1.8, speed: 18,
                });
            }
        };
        const onBossDefeated = (data) => {
            this.cameraEvent('IMPACT', { intensity: 1.4 });
            // [M4] Boss 倒下：强白闪
            this.cameraEvent('FLASH', { intensity: 0.55 });
            // [M6] Boss 击败：大规模 smoke + ember 爆开
            const proxy = this.proxy;
            if (proxy && proxy.spawnParticles && data && data.boss && data.boss.pos) {
                proxy.spawnParticles({
                    x: data.boss.pos.x, y: data.boss.pos.y,
                    color: 0xf59e0b, mode: 'ember',
                    count: 80, size: 7, lifetime: 1.3, spread: 2.0, speed: 22,
                });
                proxy.spawnParticles({
                    x: data.boss.pos.x, y: data.boss.pos.y,
                    color: 0x7f1d1d, mode: 'smoke',
                    count: 40, size: 12, lifetime: 2.0, spread: 1.5, speed: 6,
                });
            }
        };
        const onPhaseChange = (data) => {
            this.cameraEvent('PHASE_TRANS', {});
            // [M4 阶段感知 grading] 切预设
            if (this.postfx && typeof this.postfx.setGradingPreset === 'function') {
                const to = (data && data.to) || 'combat';
                // 阶段 → 预设映射
                const preset = (
                    to === 'meta'      ? 'meta'      :
                    to === 'gathering' ? 'gathering' :
                    to === 'training'  ? 'combat'    :  // 试炼场视觉同战斗
                    to === 'combat'    ? 'combat'    :
                    to === 'gameover'  ? 'gameover'  :
                    to === 'selection' ? 'gathering' :  // 选择阶段沿用研磨色
                    'combat'
                );
                this.postfx.setGradingPreset(preset);
            }
        };

        // [M4 阶段感知 grading] Boss 在场时切到 boss 预设
        const onBossSpawn = (data) => {
            if (this.postfx && typeof this.postfx.setGradingPreset === 'function') {
                this.postfx.setGradingPreset('boss');
            }
        };
        // Boss 击败后回到普通战斗调色
        const onBossDefeatedGrading = (data) => {
            if (this.postfx && typeof this.postfx.setGradingPreset === 'function') {
                // 战斗仍在继续（其他敌人）→ 回 combat；否则保持 boss 过渡
                this.postfx.setGradingPreset('combat');
            }
        };

        bus.on('damage:dealt', onDamage);
        bus.on('enemy:killed', onKill);
        bus.on('boss:defeated', onBossDefeated);
        bus.on('boss:defeated', onBossDefeatedGrading);  // 第二个 listener，专负责 grading
        bus.on('phase:change', onPhaseChange);
        bus.on('boss:spawned', onBossSpawn);   // 可能事件名不同，下一行也尝试
        bus.on('boss:appear', onBossSpawn);

        // 记录引用以便 dispose 时取消（如果 eventBus 提供 off）
        this._busHandlers = { onDamage, onKill, onBossDefeated, onBossDefeatedGrading, onPhaseChange, onBossSpawn };
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
