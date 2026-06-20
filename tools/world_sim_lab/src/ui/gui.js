// 用 lil-gui 从参数 schema 生成分组滑块面板，直接绑定到 lab 持有的 params 对象。
// 数值参数滑块改动 → onChange 回调；结构性参数（供给点数量/转速）改动会触发重建。
import GUI from 'lil-gui';
import { PARAM_GROUPS, STRUCTURAL_KEYS } from '../sim/params-schema.js';

export function buildGui(mountEl, params, { onLiveChange, onStructuralChange } = {}) {
  const gui = new GUI({ container: mountEl, title: '参数分组' });
  const folders = {};

  for (const group of PARAM_GROUPS) {
    const f = gui.addFolder(group.label);
    folders[group.id] = f;
    for (const p of group.params) {
      const controller = p.type === 'boolean'
        ? f.add(params, p.key)
        : f.add(params, p.key, p.min, p.max, p.step);
      controller.name(p.label).onChange(() => {
        if (STRUCTURAL_KEYS.has(p.key)) onStructuralChange?.(p.key);
        else onLiveChange?.(p.key);
      });
    }
    f.close();
  }
  // 默认展开两个最常调的分组
  folders.mantle?.open();
  folders.crystal?.open();

  return {
    gui,
    /** 外部改了 params（导入预设 / 恢复默认）后，刷新所有滑块显示值。 */
    refresh() {
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
    destroy() {
      gui.destroy();
    },
  };
}
