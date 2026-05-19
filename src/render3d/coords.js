/**
 * coords.js - 2D Canvas ↔ 3D World 坐标映射
 *
 * 2D Canvas (现状): origin=top-left, x→right, y→down, units=px (W × H)
 * 3D World (新版):  origin=center,   x→right, y→up,   units=world unit (1:1 映射)
 *
 * 所有玩法实体（钉子/弹珠/敌人）的坐标仍以 Canvas px 存在；渲染层调用 toWorld()
 * 转换到 z=0 平面。逆向 toCanvas() 用于将世界坐标投影回 UI 层（HUD 锚定等）。
 */

export class CoordsMapper {
    /**
     * @param {number} canvasWidth  Canvas internal pixel width (CSS-resolved)
     * @param {number} canvasHeight Canvas internal pixel height
     */
    constructor(canvasWidth, canvasHeight) {
        this.update(canvasWidth, canvasHeight);
    }

    update(canvasWidth, canvasHeight) {
        this.W = Math.max(1, canvasWidth | 0);
        this.H = Math.max(1, canvasHeight | 0);
        // 1 canvas px = 1 world unit；相机 FOV/距离已按此校准
        this.scale = 1;
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
