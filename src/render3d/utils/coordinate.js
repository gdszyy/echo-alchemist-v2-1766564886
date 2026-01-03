/**
 * coordinate.js - 坐标转换工具
 * 
 * 职责：
 * - 处理 2D Canvas 坐标到 3D 世界坐标的映射
 * - 提供统一的坐标转换接口
 * 
 * 设计原则：
 * - 2D Canvas以左上角为原点 (0, 0)，Y轴向下
 * - 3D世界以中心为原点 (0, 0, 0)，Y轴向上
 * - 通过缩放因子将像素单位转换为3D世界单位
 */

/**
 * 高度层级常量
 * 定义了 3D 场景中不同类型物体所在的 Z 轴高度
 * 
 * 使用示例：
 * ```javascript
 * const pos3D = mapTo3D(x2d, y2d, HEIGHT_LAYERS.PROJECTILE);
 * ```
 */
export const HEIGHT_LAYERS = {
    BACKGROUND: -5,  // 背景层
    FLOOR: 0,        // 地板层
    ENEMY: 1,        // 敌人层
    PLAYER: 1,       // 玩家层
    PROJECTILE: 2,   // 子弹层
    EFFECT: 3,       // 特效层
    UI: 5            // UI层
};

/**
 * 将 2D Canvas 坐标映射到 3D 世界坐标
 * 
 * 映射逻辑：
 * 1. 2D (x, y) 坐标以左上角为原点 (0, 0)，Y轴向下
 * 2. 3D 世界坐标以中心为原点 (0, 0, 0)，Y轴向上
 * 3. 通过worldScale将像素单位转换为3D世界单位
 * 
 * 计算公式：
 * - x3d = (x2d - canvasWidth/2) * worldScale
 * - y3d = (canvasHeight/2 - y2d) * worldScale  // 注意Y轴翻转
 * - z3d = height
 * 
 * 使用示例：
 * ```javascript
 * // 将子弹位置转换为3D坐标
 * const pos3D = mapTo3D(
 *     projectile.pos.x, 
 *     projectile.pos.y, 
 *     HEIGHT_LAYERS.PROJECTILE,
 *     gameWidth,
 *     gameHeight
 * );
 * mesh.position.set(pos3D.x, pos3D.y, pos3D.z);
 * ```
 * 
 * @param {number} x2d - 2D Canvas 的 X 坐标（像素）
 * @param {number} y2d - 2D Canvas 的 Y 坐标（像素）
 * @param {number} height - 3D 世界的 Z 坐标（高度层级，使用HEIGHT_LAYERS常量）
 * @param {number} canvasWidth - Canvas 的宽度（像素）
 * @param {number} canvasHeight - Canvas 的高度（像素）
 * @param {number} worldScale - 2D 到 3D 的缩放比例（默认 0.05）
 * @returns {Object} 包含 x, y, z 属性的 3D 坐标对象
 */
export function mapTo3D(
    x2d, 
    y2d, 
    height = HEIGHT_LAYERS.FLOOR, 
    canvasWidth = 800, 
    canvasHeight = 600, 
    worldScale = 0.05
) {
    // 将 2D 坐标转换为以中心为原点的坐标
    const x3d = (x2d - canvasWidth / 2) * worldScale;
    
    // Y轴翻转：2D的Y向下，3D的Y向上
    const y3d = (canvasHeight / 2 - y2d) * worldScale;
    
    // Z轴即高度层级
    const z3d = height;

    return { x: x3d, y: y3d, z: z3d };
}
