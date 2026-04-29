/**
 * perf.js - 渲染性能门控辅助
 *
 * 用法：
 *   import { sb } from './utils/perf.js';
 *   ctx.shadowBlur = sb(20);
 *
 * 当 game.shadowBlurEnabled === false（low 等级或被手动关闭）时返回 0，
 * 跳过 GPU 上昂贵的 shadowBlur 后处理 pass，是移动端降温的关键开关。
 */
export function sb(value) {
    const g = (typeof window !== 'undefined') ? window.game : null;
    return (g && g.shadowBlurEnabled === false) ? 0 : value;
}
