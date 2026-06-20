// 引擎桥接层：本项目中唯一 import 引擎源码的文件。
// 通过 Vite 别名 @engine 实时引用 echo 仓库的 src/world_sim（见 vite.config.js）。
// 改引擎源码后刷新页面即生效，无需复制快照。

import { SimulationEngine } from '@engine/engine.js';
import { DEFAULT_PARAMS } from '@engine/params.js';
import { CELL_TYPE, createCell } from '@engine/cell.js';

export { SimulationEngine, DEFAULT_PARAMS, CELL_TYPE, createCell };

// ---------------------------------------------------------------------------
// 可复现随机种子
// 引擎及其各演化层的全部随机都走实例方法 this.random()（src/world_sim 中无任何全局
// Math.random 调用），并在构造时支持注入种子：new SimulationEngine(w, h, params, { seed })。
// 引擎内部用自带的 createSeededRandom（rng.js，「供研究脚本和测试注入 seed」）。
// 因此 lab 的「固定种子」直接透传给引擎原生种子源——同一 seed 在 lab 与任何研究脚本中
// 复现同一个世界，无需 monkeypatch 全局 Math.random。渲染/指标热路径不消耗引擎随机流，
// 故确定性与 UI 帧率无关。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 参数 & 引擎构造
// ---------------------------------------------------------------------------

/** 返回引擎默认参数的可变副本（lab 持有单一 params 对象，滑块直接改其字段）。 */
export function defaultParams() {
  return structuredClone(DEFAULT_PARAMS);
}

/** 引擎默认参数定义的全部 key（用于覆盖校验）。 */
export function engineParamKeys() {
  return Object.keys(DEFAULT_PARAMS);
}

/**
 * 用给定宽高与 params 构造引擎。
 * params 以引用方式传入引擎；之后修改 params 的字段即可逐帧生效（无需重建）。
 * @param {number} width
 * @param {number} height
 * @param {object} params
 * @param {number|string} [seed] 传入则启用引擎原生固定种子（可复现）；省略则用 Math.random。
 */
export function createEngine(width, height, params, seed) {
  const options = seed === undefined || seed === null ? {} : { seed };
  return new SimulationEngine(width, height, params, options);
}

/** 特性探测：引擎是否带有（仍在迭代中的）晶石灾变分析 API。 */
export function hasCrystalDisaster(engine) {
  return engine && typeof engine.analyzeCrystalDisaster === 'function';
}
