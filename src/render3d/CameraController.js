/**
 * CameraController.js - 镜头状态机（M1 阶段 stub）
 *
 * 当前仅实现 IDLE 状态的呼吸式漂移（极弱位移）。
 * 后续 milestone 会扩展为完整状态机（AIM / SHOT / IMPACT / BOSS_INTRO / PHASE_TRANS / GAME_OVER），
 * 以及弹簧物理震动 + FOV 脉冲。
 */

export class CameraController {
    /**
     * @param {THREE.PerspectiveCamera} camera
     */
    constructor(camera) {
        this.camera = camera;
        // 记录"基准位置"，所有扰动都相对它叠加
        this.baseX = camera.position.x;
        this.baseY = camera.position.y;
        this.baseZ = camera.position.z;

        this.t = 0;
        this.state = 'IDLE';

        // 待 M4 接入：事件队列、弹簧状态、FOV 脉冲
        // this._impulses = [];
        // this._fovBase = camera.fov;
    }

    /**
     * @param {number} dt seconds
     */
    update(dt) {
        this.t += dt;
        // IDLE 呼吸：极小位移 + 极小旋转感（通过位移 + lookAt 体现）
        // 幅度刻意压低，避免与 DoF/畸变叠加后晕动。
        const px = this.baseX + Math.sin(this.t * 0.40) * 1.2;
        const py = this.baseY + Math.cos(this.t * 0.32) * 0.8;
        const pz = this.baseZ + Math.sin(this.t * 0.25) * 0.5;
        this.camera.position.set(px, py, pz);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * 重置到基准位置（阶段切换/调试用）。
     */
    reset() {
        this.t = 0;
        this.camera.position.set(this.baseX, this.baseY, this.baseZ);
        this.camera.lookAt(0, 0, 0);
    }
}
