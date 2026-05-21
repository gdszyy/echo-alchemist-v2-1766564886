/**
 * SceneProxy.js - 玩法逻辑 ↔ 3D 渲染层 的桥接（M2 起引入）
 *
 * 设计原则：
 *   - 玩法层（game_phase.js / entities.js）不感知 Three.js；只调 proxy 上的语义方法
 *   - proxy 内部把这些调用翻译成 InstancedMesh / 粒子池 / shader uniform 更新
 *   - 单帧调用契约：
 *       1. 物理 update 完成后
 *       2. 调用一次 syncPegs / syncWalls / syncBalls / ...
 *       3. Renderer3D 在 RAF 内 render() 时统一拉数据
 *
 * 当前 M2 范围：钉子 + 左右墙。后续 milestone 会扩 syncBalls / syncEnemies / spawn* 等。
 */

import { PegInstancedMesh } from './PegInstancedMesh.js';
import { WallMesh } from './WallMesh.js';
import { EnemyMeshPool } from './EnemyMeshPool.js';
import { GPUParticleSystem } from './GPUParticleSystem.js';
import { BallMesh } from './BallMesh.js';

export class SceneProxy {
    /**
     * @param {THREE.Scene} scene
     * @param {CoordsMapper} coords
     * @param {Object} [opts]
     * @param {number} [opts.particleCapacity=4096]
     */
    constructor(scene, coords, opts = {}) {
        this.scene = scene;
        this.coords = coords;

        this.pegs = new PegInstancedMesh();
        this.scene.add(this.pegs.mesh);

        this.walls = new WallMesh();
        this.walls.resize(coords);
        this.scene.add(this.walls.group);
        this.walls.setVisible(false); // 默认隐藏：阶段不是 gathering/combat/training 时不显示

        this.enemies = new EnemyMeshPool(this.scene);

        // [3D-Main 修复] 弹珠 + 子弹的 3D 球体（之前漏掉，2D 被 guard return 后玩家看不到任何弹丸）
        this.balls       = new BallMesh({ capacity: 32, name: 'BallMesh_DropBalls' });
        this.projectiles = new BallMesh({ capacity: 32, name: 'BallMesh_Projectiles' });
        this.scene.add(this.balls.mesh);
        this.scene.add(this.projectiles.mesh);

        // [3D-Main M6] GPU 粒子池：默认 4096，M6.5 由 QualityProfile 注入
        this.particles = new GPUParticleSystem(this.scene, {
            capacity: opts.particleCapacity ?? 4096,
        });

        // 当前阶段，决定可见性。null 让首次 setPhase 一定触发刷新（避免初始 'meta' early-out）
        this._phase = null;
    }

    /**
     * 同步整个 pegs 数组到 InstancedMesh。
     * @param {Array}  pegs2D
     * @param {number} pegRadiusPx
     */
    syncPegs(pegs2D, pegRadiusPx) {
        if (!pegs2D || pegs2D.length === 0) {
            this.pegs.clear();
            return;
        }
        this.pegs.sync(pegs2D, this.coords, pegRadiusPx);
    }

    /**
     * 触发某个钉子的击中表演。
     * @param {number} pegIndex
     * @param {number} [intensity=1.0]
     */
    pulsePeg(pegIndex, intensity = 1.0) {
        this.pegs.pulse(pegIndex, intensity);
    }

    /**
     * 同步整个 enemies 数组到 3D 池。
     * @param {Array} enemies game.enemies
     */
    syncEnemies(enemies) {
        if (!enemies || enemies.length === 0) {
            this.enemies.clear();
            return;
        }
        this.enemies.sync(enemies, this.coords);
    }

    /**
     * [3D-Main M6] 在画布像素坐标处发射粒子簇（自动转换到 3D 世界坐标）。
     * @param {Object} opts
     * @param {number} opts.x  canvas px
     * @param {number} opts.y  canvas px
     * @param {string|number} opts.color
     * @param {string|number} [opts.mode='spark']
     * @param {number} [opts.count=12]
     * @param {number} [opts.size=4]
     * @param {number} [opts.lifetime=0.8]
     * @param {number} [opts.spread=1.0]
     * @param {number} [opts.speed=8]
     */
    spawnParticles(opts) {
        if (!this.particles) return;
        const w = this.coords.toWorld(opts.x, opts.y, opts.z ?? 0);
        this.particles.spawn({
            x: w.x, y: w.y, z: w.z,
            color: opts.color,
            mode: opts.mode,
            count: opts.count,
            size: opts.size,
            lifetime: opts.lifetime,
            spread: opts.spread,
            speed: opts.speed,
            dirX: opts.dirX,
            dirY: opts.dirY,
        });
    }

    /**
     * 通知 proxy 当前阶段，控制墙/钉等的可见性。
     */
    /**
     * 同步 game.dropBalls 到 3D（研磨阶段下落弹珠）
     */
    syncDropBalls(dropBalls) {
        if (!this.balls) return;
        this.balls.sync(dropBalls || [], this.coords, { defaultRadiusPx: 8, colorKey: 'type' });
    }

    /**
     * 同步 game.projectiles 到 3D（战斗阶段子弹）
     */
    syncProjectiles(projectiles) {
        if (!this.projectiles) return;
        this.projectiles.sync(projectiles || [], this.coords, { defaultRadiusPx: 6, colorKey: 'type' });
    }

    setPhase(phase) {
        if (this._phase === phase) return;
        this._phase = phase;
        // 墙：研磨 + 战斗 + 试炼都显示；其他阶段隐藏
        const wallsOn = phase === 'gathering' || phase === 'combat' || phase === 'training';
        this.walls.setVisible(wallsOn);
        // 钉子：仅 gathering / training 显示
        if (phase !== 'gathering' && phase !== 'training') {
            this.pegs.clear();
        }
        // 敌人：仅 combat / training 显示
        if (phase !== 'combat' && phase !== 'training') {
            this.enemies.clear();
        }
        // 弹珠 / 子弹：阶段切换时立即清空（避免残留）
        if (this.balls) this.balls.clear();
        if (this.projectiles) this.projectiles.clear();
    }

    /** Canvas resize 时调用（来自 Renderer3D.resize） */
    onResize() {
        this.walls.resize(this.coords);
    }

    /**
     * Renderer3D 主循环每帧调用。
     * @param {number} dt seconds
     * @param {number} t  seconds elapsed total
     */
    update(dt, t) {
        this.pegs.update(dt, t);
        this.walls.update(t);
        this.enemies.update(dt, t);
        if (this.balls) this.balls.update(dt, t);
        if (this.projectiles) this.projectiles.update(dt, t);
        if (this.particles) this.particles.update(dt);
    }

    dispose() {
        try { this.pegs.dispose(); } catch (e) {}
        try { this.walls.dispose(); } catch (e) {}
        try { this.enemies.dispose(); } catch (e) {}
        try { if (this.balls) this.balls.dispose(); } catch (e) {}
        try { if (this.projectiles) this.projectiles.dispose(); } catch (e) {}
        try { if (this.particles) this.particles.dispose(); } catch (e) {}
        if (this.scene) {
            this.scene.remove(this.pegs.mesh);
            this.scene.remove(this.walls.group);
            if (this.balls)       this.scene.remove(this.balls.mesh);
            if (this.projectiles) this.scene.remove(this.projectiles.mesh);
        }
    }
}
