/**
 * coordinate.js - 坐标转换工具
 * 
 * 职责：
 * - 处理 2D Canvas 坐标到 3D 世界坐标的映射
 * - 定义高度层级常量
 */

/**
 * 高度层级常量
 * 定义了 3D 场景中不同类型物体所在的 Z 轴高度
 */
export const HEIGHT_LAYERS = {
    BACKGROUND: -5,
    FLOOR: 0,
    ENEMY: 1,
    PLAYER: 1,
    PROJECTILE: 2,
    EFFECT: 3,
    UI: 5
};

/**
 * 将 2D Canvas 坐标映射到 3D 世界坐标
 * 
 * 映射逻辑：
 * 1. 2D (x, y) 坐标通常以左上角为原点 (0, 0)
 * 2. 3D 世界坐标通常以中心为原点 (0, 0, 0)
 * 3. Y 轴在 2D 中向下增加，在 3D 中向上增加
 * 
 * @param {number} x2d - 2D Canvas 的 X 坐标
 * @param {number} y2d - 2D Canvas 的 Y 坐标
 * @param {number} height - 3D 世界的 Z 坐标（高度层级）
 * @param {number} canvasWidth - Canvas 的宽度
 * @param {number} canvasHeight - Canvas 的高度
 * @param {number} worldScale - 2D 到 3D 的缩放比例（默认为 0.1）
 * @returns {Object} 包含 x, y, z 的 3D 坐标对象
 */
export function mapTo3D(x2d, y2d, height = HEIGHT_LAYERS.FLOOR, canvasWidth = 800, canvasHeight = 600, worldScale = 0.05) {
    // 将 2D 坐标转换为以中心为原点的坐标
    // x: (x2d - width/2)
    // y: (height/2 - y2d) -> 因为 2D Y 向下，3D Y 向上
    
    const x3d = (x2d - canvasWidth / 2) * worldScale;
    const y3d = (canvasHeight / 2 - y2d) * worldScale;
    const z3d = height;

    return {
        x: x3d,
        y: y3d,
        z: z3d
    };
}
