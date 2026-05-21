/**
 * CameraController.js - 动态镜头状态机（M4.5）
 *
 * 设计：
 *   不用枚举式状态机（容易僵），而是用"加性扰动 + 弹簧物理"实现：
 *     基准位置(basePos) + 呼吸漂移(idle) + 弹簧震动(shake) + 瞄准位移(aim)
 *   事件触发（impact / boss intro / player hit）往弹簧上注入冲量，
 *   弹簧自然衰减回平衡位置，得到"被打了一下"的有机感。
 *
 *   同时把 FOV、镜头畸变、色散、bloom 的"瞬时增量"暴露给 PostFX，
 *   让 Renderer3D 每帧合并到后处理 uniform。
 *
 * 公开 API：
 *   triggerImpact(intensity, dirX, dirY)     —— 暴击 / 大命中
 *   triggerEnemyKilled(intensity, hitX, hitY) —— 清场反馈（柔和）
 *   triggerPlayerHit(intensity)              —— 玩家被击中（猛烈 + 色散）
 *   triggerBossIntro()                       —— Boss 入场（FOV 拉近 + 重击）
 *   triggerPhaseTransition()                 —— 阶段切换（柔性滑动）
 *   setAim(normX, normY)                     —— 瞄准位移（-1..+1 归一化）
 *   reset()                                  —— 完全归零（debug）
 *   getPostFXState()                         —— Renderer3D 读，合并到 PostFX uniforms
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

export class CameraController {
    /**
     * @param {THREE.PerspectiveCamera} camera
     */
    constructor(camera) {
        this.camera = camera;
        this.basePos = camera.position.clone();
        this.baseFov = camera.fov;

        // 时间
        this.t = 0;

        // ---- 弹簧式震动（位移 + 速度） ----
        this.shakeOffset = new THREE.Vector3();
        this.shakeVel    = new THREE.Vector3();
        this._impulsesQueued = [];   // 帧内累积的冲量

        // ---- FOV 弹簧（脉冲式 zoom-in/out） ----
        this.fovOffset = 0;
        this.fovVel    = 0;

        // ---- 瞄准位移（lerp） ----
        this.aimOffset = new THREE.Vector2();
        this.aimTarget = new THREE.Vector2();

        // ---- 给 PostFX 的瞬时 boost（自然衰减） ----
        this.distortionBoost = 0;   // 桶形 K 的增量
        this.chromaticBoost  = 0;   // 色散增量
        this.bloomBoost      = 0;   // bloom strength 增量
        this.exposureBoost   = 0;   // tonemap exposure 增量（罕用）
        this.flashBoost      = 0;   // [M4] 全屏白闪 0..1，每帧快速衰减

        // ---- 弹簧常数 ----
        this.K_SHAKE = 90;   // 越大恢复越快
        this.C_SHAKE = 9;    // 阻尼
        this.K_FOV   = 38;
        this.C_FOV   = 9;

        // ---- 衰减率（per sec） ----
        this.DECAY_DISTORTION = 4.0;
        this.DECAY_CHROMATIC  = 4.5;
        this.DECAY_BLOOM      = 2.2;
        this.DECAY_EXPOSURE   = 3.0;
        this.DECAY_FLASH      = 7.0;   // 白闪要快进快出（~140ms 触感）

        // ---- 状态读取（仅 debug 用） ----
        this.lastEvent = 'IDLE';
    }

    update(dt) {
        // 物理稳定性：限制 dt
        const h = Math.min(0.05, Math.max(0, dt));
        this.t += h;

        // ---- 1. 注入帧内冲量到速度 ----
        for (let i = 0; i < this._impulsesQueued.length; i++) {
            const imp = this._impulsesQueued[i];
            this.shakeVel.x += imp.x;
            this.shakeVel.y += imp.y;
            this.shakeVel.z += imp.z;
        }
        this._impulsesQueued.length = 0;

        // ---- 2. 位置弹簧物理 ----
        // a = -k*x - c*v
        const ax = -this.K_SHAKE * this.shakeOffset.x - this.C_SHAKE * this.shakeVel.x;
        const ay = -this.K_SHAKE * this.shakeOffset.y - this.C_SHAKE * this.shakeVel.y;
        const az = -this.K_SHAKE * this.shakeOffset.z - this.C_SHAKE * this.shakeVel.z;
        this.shakeVel.x += ax * h;
        this.shakeVel.y += ay * h;
        this.shakeVel.z += az * h;
        this.shakeOffset.x += this.shakeVel.x * h;
        this.shakeOffset.y += this.shakeVel.y * h;
        this.shakeOffset.z += this.shakeVel.z * h;

        // ---- 3. FOV 弹簧 ----
        const af = -this.K_FOV * this.fovOffset - this.C_FOV * this.fovVel;
        this.fovVel += af * h;
        this.fovOffset += this.fovVel * h;

        // ---- 4. 瞄准平滑 ----
        const aimAlpha = Math.min(1, h * 6);
        this.aimOffset.x += (this.aimTarget.x - this.aimOffset.x) * aimAlpha;
        this.aimOffset.y += (this.aimTarget.y - this.aimOffset.y) * aimAlpha;

        // ---- 5. 呼吸漂移（始终在线） ----
        const idleX = Math.sin(this.t * 0.40) * 1.2;
        const idleY = Math.cos(this.t * 0.32) * 0.8;
        const idleZ = Math.sin(this.t * 0.25) * 0.5;

        // ---- 6. 应用到相机 ----
        this.camera.position.set(
            this.basePos.x + idleX + this.shakeOffset.x + this.aimOffset.x * 5.0,
            this.basePos.y + idleY + this.shakeOffset.y + this.aimOffset.y * 5.0,
            this.basePos.z + idleZ + this.shakeOffset.z
        );
        this.camera.lookAt(0, 0, 0);

        // FOV 变化要重算 projection matrix（开销小）
        if (Math.abs(this.fovOffset) > 0.005) {
            this.camera.fov = this.baseFov + this.fovOffset;
            this.camera.updateProjectionMatrix();
        } else if (this.camera.fov !== this.baseFov) {
            this.camera.fov = this.baseFov;
            this.camera.updateProjectionMatrix();
        }

        // ---- 7. PostFX boost 衰减 ----
        this.distortionBoost = Math.max(0, this.distortionBoost - this.DECAY_DISTORTION * h);
        this.chromaticBoost  = Math.max(0, this.chromaticBoost  - this.DECAY_CHROMATIC  * h);
        this.bloomBoost      = Math.max(0, this.bloomBoost      - this.DECAY_BLOOM      * h);
        this.flashBoost      = Math.max(0, this.flashBoost      - this.DECAY_FLASH     * h);
        this.exposureBoost   = Math.max(0, this.exposureBoost   - this.DECAY_EXPOSURE   * h);
    }

    // ============================================================
    //   事件 API
    // ============================================================

    /**
     * 普通击中 / 暴击。强度 0.3 = 轻击，1.0 = 强击，2.0 = 终结。
     * @param {number} intensity
     * @param {number} [dirX=0]  冲量方向偏置（屏幕空间，可选）
     * @param {number} [dirY=0]
     */
    triggerImpact(intensity = 1.0, dirX = 0, dirY = 0) {
        this.lastEvent = 'IMPACT';
        const i = Math.max(0, intensity);
        // 随机方向 + 偏置方向叠加
        const a = Math.random() * TWO_PI;
        const rand = i * 7.0;
        this._impulsesQueued.push({
            x: Math.cos(a) * rand + dirX * i * 4.0,
            y: Math.sin(a) * rand + dirY * i * 4.0,
            z: (Math.random() - 0.5) * i * 2.0,
        });
        // 微 FOV 拉远（"被击中"压缩感）
        this.fovVel -= i * 6.0;
        // PostFX 短促波动
        this.distortionBoost = Math.max(this.distortionBoost, i * 0.035);
        this.chromaticBoost  = Math.max(this.chromaticBoost,  i * 0.010);
        this.bloomBoost      = Math.max(this.bloomBoost,      i * 0.30);
    }

    /**
     * 敌人被击杀 / 清场。比普通击中弱一档，更"庆祝"——bloom 多一点。
     */
    triggerEnemyKilled(intensity = 0.4) {
        this.lastEvent = 'KILLED';
        const i = Math.max(0, intensity);
        this._impulsesQueued.push({
            x: (Math.random() - 0.5) * i * 5.0,
            y: (Math.random() - 0.5) * i * 5.0,
            z: 0,
        });
        this.bloomBoost = Math.max(this.bloomBoost, i * 0.45);
        this.exposureBoost = Math.max(this.exposureBoost, i * 0.06);
    }

    /**
     * 玩家被攻击：强横向震动 + 显著色散（"被打蒙"）+ 瞬间 FOV 拉近。
     */
    triggerPlayerHit(intensity = 1.0) {
        this.lastEvent = 'HIT_PLAYER';
        const i = Math.max(0, intensity);
        this._impulsesQueued.push({
            x: (Math.random() - 0.5) * i * 18.0,
            y: -i * 5.0,
            z: 0,
        });
        this.fovVel += i * 5.0;  // 突然拉近 → 压迫
        this.chromaticBoost  = Math.max(this.chromaticBoost,  i * 0.022);
        this.distortionBoost = Math.max(this.distortionBoost, i * 0.05);
    }

    /**
     * Boss 入场：缓慢拉近 + 重低音震动 + bloom 浪漫化。
     */
    triggerBossIntro() {
        this.lastEvent = 'BOSS_INTRO';
        // FOV 缓慢拉近（fovVel 给正值，fovOffset 慢慢上升后被弹簧拉回）
        // 实际效果想要"持续拉近一段时间"，所以同时设置 offset
        this.fovOffset = -3.0;   // 立即拉近 3°
        this.fovVel = 0;
        this._impulsesQueued.push({ x: 0, y: 8, z: 0 });
        this.bloomBoost = Math.max(this.bloomBoost, 0.7);
        this.distortionBoost = Math.max(this.distortionBoost, 0.04);
    }

    /**
     * 阶段切换：柔和的位置滑动（不靠弹簧，靠 base 漂移）。
     * 这一版用最简单实现：触发轻微 z 弹簧（"摄影机退一步"），无 PostFX 干扰。
     */
    triggerPhaseTransition() {
        this.lastEvent = 'PHASE_TRANS';
        this._impulsesQueued.push({ x: 0, y: 0, z: -4 });
        this.bloomBoost = Math.max(this.bloomBoost, 0.15);
    }

    /**
     * [M4] 暴击/大伤害瞬时白闪。强度 0.3 = 轻闪，0.6 = 强闪。
     * 配合 IMPACT 一起触发能营造"punch"感。
     * @param {number} intensity 0..1
     */
    triggerFlash(intensity = 0.4) {
        this.lastEvent = 'FLASH';
        this.flashBoost = Math.max(this.flashBoost, Math.min(1, intensity));
    }

    /**
     * 瞄准位移目标。归一化坐标 [-1, +1]。 update 内 lerp。
     */
    setAim(normX, normY) {
        this.aimTarget.x = Math.max(-1, Math.min(1, normX));
        this.aimTarget.y = Math.max(-1, Math.min(1, normY));
    }

    /**
     * 给 PostFX 用：当前帧应叠加到后处理 uniform 的瞬时增量。
     * Renderer3D 在 render 前调一次，合并到 baseline。
     */
    getPostFXState() {
        return {
            distortion: this.distortionBoost,
            chromatic:  this.chromaticBoost,
            bloom:      this.bloomBoost,
            exposure:   this.exposureBoost,
            flash:      this.flashBoost,
        };
    }

    /** 完全归零（debug / 切场景用） */
    reset() {
        this.flashBoost = 0;
        this.shakeOffset.set(0, 0, 0);
        this.shakeVel.set(0, 0, 0);
        this.fovOffset = 0;
        this.fovVel = 0;
        this.aimOffset.set(0, 0);
        this.aimTarget.set(0, 0);
        this.distortionBoost = 0;
        this.chromaticBoost = 0;
        this.bloomBoost = 0;
        this.exposureBoost = 0;
        this.lastEvent = 'IDLE';
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
        this.camera.position.copy(this.basePos);
    }
}
