/**
 * cooldown_cells.js - 设施冷却格：共 total 格，还需 remaining 回合时点亮前 (total - remaining) 格；
 * remaining ≤ 0 = 就绪（全部点亮 + .is-ready）。靠格子数量表达状态，不单靠颜色。
 * @param {{ total:number, remaining:number }} props
 */
import { el, append } from './_dom.js';

export function createCooldownCells({ total = 1, remaining = 0 } = {}) {
    const n = Math.max(1, Math.floor(total));
    const rem = Math.max(0, Math.min(n, Math.floor(remaining)));
    const ready = rem <= 0;
    const wrap = el('span', `ui-cd${ready ? ' is-ready' : ''}`, {
        title: ready ? '就绪：下个敌人回合前触发' : `冷却中：还需 ${rem} 回合`,
        'aria-label': ready ? '就绪' : `冷却 ${rem}`,
    });
    for (let i = 0; i < n; i++) append(wrap, el('i', `ui-cd__cell${i < n - rem ? ' is-on' : ''}`));
    return wrap;
}
