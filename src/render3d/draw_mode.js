/**
 * draw_mode.js - 2D 实体绘制抑制开关（M6.5+ 性能优化）
 *
 * sys_loop 每帧基于 body.render3d-debug 设置此标志。
 * 所有 2D entity 的 draw() 在方法首行查询本标志，true 即直接 return，
 * 节省 .draw() 内部的 JS 计算 + Canvas API 调用。
 *
 * FloatingText（伤害数字）是例外——属于 UI 反馈层，不属于"世界实体"，
 * 在 3D 模式下仍要可见。它自己的 draw() 不调用 isSuppressed2DEntities()。
 */

let _suppressed = false;

export function setSuppress2DEntities(v) {
    _suppressed = !!v;
}

export function isSuppressed2DEntities() {
    return _suppressed;
}
