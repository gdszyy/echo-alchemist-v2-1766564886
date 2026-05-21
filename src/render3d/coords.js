/**
 * coords.js - 2D Canvas ↔ 3D World 坐标映射
 *
 * 2D Canvas (现状): origin=top-left, x→right, y→down, units=px (W × H)
 * 3D World (新版):  origin=center,   x→right, y→up,   units=world unit
 *
 * scale 由 Renderer3D 基于相机 FOV/距离计算并注入，让画布高度自动占满相机视域。
 * 所有玩法实体（钉子/弹珠/敌人）的坐标仍以 Canvas px 存在；渲染层调用 toWorld()
 * 转换到 z=0 平面。逆向 toCanvas() 用于将世界坐标投影回 UI 层（HUD 锚定等）。
 */

export class CoordsMapper {
    /**
     * @param {number} canvasWidth  Canvas internal pixel width (CSS-resolved)
     * @param {number} canvasHeight Canvas internal pixel height
     * @param {number} [scale=1]    World units per canvas px
     */
    constructor(canvasWidth, canvasHeight, scale = 1) {
        this.update(canvasWidth, canvasHeight, scale);
    }

    /**
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @param {number} [scale] if undefined, keeps previous scale
     */
    update(canvasWidth, canvasHeight, scale) {
        this.W = Math.max(1, canvasWidth | 0);
        this.H = Math.max(1, canvasHeight | 0);
        if (scale !== undefined && scale > 0) this.scale = scale;
        else if (this.scale === undefined) this.scale = 1;
    }

    /**
     * 给定相机 FOV（度）和距离，自动计算让画布完全填充视域的 scale。
     * @param {number} fovDeg vertical FOV in degrees
     * @param {number} cameraDist distance from camera to z=0 plane
     * @param {number} [fillRatio=0.94] 画布在视域内的占比（< 1 留一点边）
     */
    static autoScaleFromFov(fovDeg, cameraDist, H, fillRatio = 0.94) {
        const halfFov = fovDeg * 0.5 * Math.PI / 180;
        const visibleH = 2 * cameraDist * Math.tan(halfFov);
        return (visibleH * fillRatio) / Math.max(1, H);
    }

    /**
     * Canvas px → world position on z=0 plane.
     * @returns {{x:number, y:number, z:number}}
     */
    toWorld(x, y, z = 0) {
        return {
            x: (x - this.W * 0.5) * this.scale,
            y: -(y - this.H * 0.5) * this.scale,
            z,
        };
    }

    /**
     * World → canvas px（仅 x/y 维度，z 信息丢失）。
     * @returns {{x:number, y:number}}
     */
    toCanvas(x, y) {
        return {
            x: x / this.scale + this.W * 0.5,
            y: -y / this.scale + this.H * 0.5,
        };
    }
}
