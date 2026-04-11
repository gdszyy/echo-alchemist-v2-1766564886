/**
 * src/ui/rune_launcher.js - 符文发射器界面渲染模块
 * 
 * 职责：符文发射器面板的完整 UI 交互
 * - 符文背包面板（只读查看）
 * - 符文发射器面板（网格管理）
 * - 符文选择弹出层（从库存选择符文放入网格）
 * - 符文网格更新（词条解析、高亮激活格子）
 * - 符文库存显示（选中状态管理）
 * - 符文合成/重铸操作
 * 
 * 通信方式：通过 bind(this) 组合模式注入到 Game 实例
 * [Task 3.2 说明] 此模块作为实例方法注入 Game 实例，读取 this.xxx 是架构正常用法
 * 
 * @module ui/rune_launcher
 */

import { RUNE_DB, RUNEWORD_DB, STAT_DISPLAY } from '../rune_config.js';
import { parseRuneGrid, calcRuneBaseStats, getRuneId, rune_merge, rune_reforge } from '../rune_system.js';
import { audio } from '../audio.js';
import { showToast } from '../entities.js';

/**
 * 符文发射器 UI 方法集合
 * 通过 bind(this) 组合模式作为实例方法注入到 Game 实例
 */
export const rune_launcher_system = {


    // ==================== 符文发射器 UI ====================

    /**
     * 打开符文背包面板（只读查看，不支持合成/重铸）
     */
    ui_openRuneBackpack() {
        const panel = document.getElementById('rune-backpack-panel');
        if (!panel) return;
        panel.style.removeProperty('display');
        panel.style.display = 'flex';
        this._ui_renderRuneBackpackList();
    },


    /**
     * 关闭符文背包面板
     */
    ui_closeRuneBackpack() {
        const panel = document.getElementById('rune-backpack-panel');
        if (panel) panel.style.display = 'none';
    },


    /**
     * 渲染符文背包内容（只读）
     * @private
     */
    _ui_renderRuneBackpackList() {
        const list = document.getElementById('rune-backpack-list');
        const countEl = document.getElementById('rune-backpack-count');
        if (!list) return;

        const inventory = this.runeInventory || [];  // [Mixin 正常用法：读取 Game 实例状态]
        if (countEl) countEl.textContent = inventory.length;

        list.innerHTML = '';

        if (inventory.length === 0) {
            list.innerHTML = `<p class="text-center text-slate-500 text-xs py-4 italic">背包中没有符文</p>`;
            return;
        }

        inventory.forEach((runeEntry, idx) => {
            const runeId = typeof runeEntry === 'object' ? runeEntry.id : runeEntry;
            if (!runeId) return;
            const runeDef = RUNE_DB ? RUNE_DB.find(r => r.id === runeId) : null;
            if (!runeDef) return;
            const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;

            const item = document.createElement('div');
            item.className = 'flex items-center gap-3 bg-slate-800/60 border border-slate-700/40 rounded-xl p-2';
            item.innerHTML = `
                <div class="w-10 h-10 flex items-center justify-center bg-purple-950/50 rounded-lg border border-purple-500/30 text-xl shrink-0">
                    ${runeDef.icon || '🔮'}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-purple-200">${runeDef.name}</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400 font-mono">Lv.${runeLevel}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">${runeDef.desc || ''}</p>
                </div>
            `;
            list.appendChild(item);
        });
    },


    /**
     * 打开符文发射器面板
     */
    ui_openRuneLauncher() {
        const panel = document.getElementById('phase-rune-launcher');
        if (panel) {
            panel.style.display = 'flex';
        }
        this.ui_initRuneGrid();
        this.ui_updateRuneGrid();
    },


    /**
     * 关闭符文发射器面板
     */
    ui_closeRuneLauncher() {
        const panel = document.getElementById('phase-rune-launcher');
        if (panel) {
            panel.style.display = 'none';
        }
    },


    /**
     * 关闭符文选择弹出层
     */
    ui_closeRunePicker() {
        const overlay = document.getElementById('rune-picker-overlay');
        if (overlay) overlay.classList.add('hidden');
        this._pendingRuneGridIndex = null;
    },


    /**
     * ui_initRuneGrid - 初始化符文网格 DOM 并绑定点击事件
     * 生成 9 个格子，每格绑定点击逻辑：
     *   - 空格：打开符文选择器
     *   - 已有符文：将符文移除并放回库存
     */
    ui_initRuneGrid() {
        const container = document.getElementById('rune-grid-container');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.id = `rune-cell-${i}`;
            cell.dataset.index = i;
            cell.className = [
                'rune-grid-cell',
                'w-16 h-16 flex items-center justify-center',
                'bg-slate-900/60 border-2 border-slate-700/60 rounded-xl',
                'cursor-pointer select-none',
                'hover:border-purple-500/60 hover:bg-slate-800/60',
                'transition-all duration-200',
                'text-2xl',
            ].join(' ');

            cell.addEventListener('click', () => {
                const runeEntry = this.runeGrid[i];  // [Mixin 正常用法：读取 Game 实例状态]
                if (runeEntry) {
                    // 已有符文：移除并放回库存（保留对象格式）
                    this.runeGrid[i] = null;  // [Mixin 正常用法：读取 Game 实例状态]
                    this.runeInventory.push(runeEntry);  // [Mixin 正常用法：读取 Game 实例状态]
                    this.ui_updateRuneGrid();
                    audio.playTone(400, 'sine', 0.08, 0.15);
                } else {
                    // 空格：打开符文选择器
                    this._pendingRuneGridIndex = i;
                    this.ui_openRunePicker(i);
                }
            });

            container.appendChild(cell);
        }
    },


    /**
     * ui_openRunePicker - 打开符文选择弹出层
     * @param {number} cellIndex - 目标格子索引
     */
    ui_openRunePicker(cellIndex) {
        if (!this.runeInventory || this.runeInventory.length === 0) {  // [Mixin 正常用法：读取 Game 实例状态]
            if (window.showToast) showToast('库存中没有符文');
            return;
        }

        const overlay = document.getElementById('rune-picker-overlay');
        const list = document.getElementById('rune-picker-list');
        if (!overlay || !list) return;

        list.innerHTML = '';

        // 对库存中的符文去重显示（但保留多个实例的选择）
        this.runeInventory.forEach((runeEntry, invIdx) => {  // [Mixin 正常用法：读取 Game 实例状态]
            // 兼容新旧格式：提取符文 ID
            const runeId = getRuneId(runeEntry);
            if (!runeId) return;
            const runeDef = RUNE_DB.find(r => r.id === runeId);
            if (!runeDef) return;

            // 获取符文等级（新格式有 level，旧格式默认为 1）
            const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;

            const btn = document.createElement('button');
            btn.className = [
                'flex flex-col items-center gap-1 p-3',
                'bg-slate-800/80 border border-slate-600/50 rounded-xl',
                'hover:border-purple-400/60 hover:bg-slate-700/80',
                'transition-all duration-200 min-w-[72px]',
            ].join(' ');
            btn.innerHTML = `
                <span class="text-2xl">${runeDef.icon || '?'}</span>
                <span class="text-[10px] text-slate-300 text-center leading-tight">${runeDef.name}</span>
                <span class="text-[9px] text-purple-400/70">${runeDef.element}</span>
                <span class="text-[9px] text-amber-400/80">Lv.${runeLevel}</span>
            `;
            btn.addEventListener('click', () => {
                // 将该符文从库存中移除（取第一个匹配项）
                const removeIdx = this.runeInventory.indexOf(runeEntry);  // [Mixin 正常用法：读取 Game 实例状态]
                if (removeIdx !== -1) {
                    this.runeInventory.splice(removeIdx, 1);  // [Mixin 正常用法：读取 Game 实例状态]
                } else {
                    // 如果对象引用不同，则通过 ID 和等级匹配
                    const fallbackIdx = this.runeInventory.findIndex(e => getRuneId(e) === runeId &&  // [Mixin 正常用法：读取 Game 实例状态]
                        ((typeof e === 'object' && e.level === runeLevel) || typeof e === 'string'));
                    if (fallbackIdx !== -1) {
                        this.runeInventory.splice(fallbackIdx, 1);  // [Mixin 正常用法：读取 Game 实例状态]
                    }
                }
                // 将符文放入网格（保留原始对象格式）
                this.runeGrid[cellIndex] = runeEntry;  // [Mixin 正常用法：读取 Game 实例状态]
                this.ui_closeRunePicker();
                this.ui_updateRuneGrid();
                audio.playTone(600, 'sine', 0.1, 0.2);
            });
            list.appendChild(btn);
        });

        overlay.classList.remove('hidden');
    },


    /**
     * ui_updateRuneGrid - 更新网格 DOM 显示，重新解析词条，更新 activeRunewordStats
     * 每次网格内容变化时调用。
     */
    ui_updateRuneGrid() {
        // 1. 更新每个格子的显示
        for (let i = 0; i < 9; i++) {
            const cell = document.getElementById(`rune-cell-${i}`);
            if (!cell) continue;

            const runeEntry = this.runeGrid[i];  // [Mixin 正常用法：读取 Game 实例状态]
            // 兼容新旧格式：提取符文 ID
            const runeId = getRuneId(runeEntry);
            if (runeId) {
                const runeDef = RUNE_DB.find(r => r.id === runeId);
                // 获取符文等级（新格式有 level，旧格式默认为 1）
                const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;
                if (runeDef) {
                    cell.innerHTML = `<span title="${runeDef.name} Lv.${runeLevel}">${runeDef.icon || '?'}</span>${runeLevel > 1 ? `<span class="rune-level-badge">${runeLevel}</span>` : ''}`;
                } else {
                    cell.innerHTML = '?';
                }
                cell.classList.add('border-purple-500/60', 'bg-slate-800/60');
                cell.classList.remove('border-slate-700/60');
            } else {
                cell.innerHTML = '';
                cell.classList.remove('border-purple-500/60', 'bg-slate-800/60');
                cell.classList.add('border-slate-700/60');
            }
        }

        // 2. 解析词条，计算 activeRunewordStats
        const { activeStats, activatedRunewords, activatedCells } = parseRuneGrid(this.runeGrid, RUNEWORD_DB);  // [Mixin 正常用法：读取 Game 实例状态]
        this.activeRunewordStats = activeStats;
        // [词条 Hook] 构建 activeRunewordEffects: effectId -> { level, params } 映射
        // 供 damage_calc.js / projectile.js 在战斗层读取词条效果参数
        const newEffects = {};
        activatedRunewords.forEach(rw => {
            if (rw.effectId) {
                const level = rw.level || 1;
                const baseParams = rw.baseParams || {};
                const perLevelParams = rw.perLevelParams || {};
                // 计算最终参数：baseParams + (level - 1) * perLevelParams
                const params = {};
                for (const key of Object.keys(baseParams)) {
                    params[key] = (baseParams[key] || 0) + (level - 1) * (perLevelParams[key] || 0);
                }
                newEffects[rw.effectId] = { level, params };
            }
        });
        this.activeRunewordEffects = newEffects;

        // 3. 高亮激活词条对应的格子
        for (let i = 0; i < 9; i++) {
            const cell = document.getElementById(`rune-cell-${i}`);
            if (!cell) continue;
            if (activatedCells.has(i)) {
                cell.classList.add('shadow-[0_0_8px_rgba(168,85,247,0.6)]', 'border-purple-400/80');
            } else {
                cell.classList.remove('shadow-[0_0_8px_rgba(168,85,247,0.6)]', 'border-purple-400/80');
            }
        }

        // 4. 更新库存显示
        this._ui_updateRuneInventoryDisplay();

        // 5. 更新激活词条列表
        this._ui_updateActivatedRunewordsDisplay(activatedRunewords);

        // 6. 计算符文基础属性层数加成
        const baseStats = calcRuneBaseStats(this.runeGrid, RUNE_DB);  // [Mixin 正常用法：读取 Game 实例状态]

        // 7. 更新属性加成汇总（展示词条加成 + 基础加成）
        this._ui_updateRuneStatsDisplay(activeStats, baseStats);

        // 8. 更新 meta 页面的激活徽章
        const badge = document.getElementById('meta-rune-active-badge');
        if (badge) {
            if (activatedRunewords.length > 0) {
                badge.classList.remove('hidden');
                badge.textContent = `${activatedRunewords.length} 激活`;
            } else {
                badge.classList.add('hidden');
            }
        }
    },


    /**
     * 更新符文库存显示
     * @private
     */
    _ui_updateRuneInventoryDisplay() {
        const container = document.getElementById('rune-inventory-container');
        const countEl = document.getElementById('rune-inventory-count');
        const emptyEl = document.getElementById('rune-inventory-empty');
        if (!container) return;

        // 初始化选中状态
        if (!this._selectedRuneIndices) this._selectedRuneIndices = new Set();  // [Mixin 正常用法：读取 Game 实例状态]

        // 移除旧的符文按鈕（保留 empty 提示）
        Array.from(container.children).forEach(child => {
            if (child.id !== 'rune-inventory-empty') child.remove();
        });

        if (countEl) countEl.textContent = `(${this.runeInventory.length})`;  // [Mixin 正常用法：读取 Game 实例状态]

        if (!this.runeInventory || this.runeInventory.length === 0) {  // [Mixin 正常用法：读取 Game 实例状态]
            if (emptyEl) emptyEl.classList.remove('hidden');
            // 清空选中状态
            this._selectedRuneIndices.clear();  // [Mixin 正常用法：读取 Game 实例状态]
            this._ui_updateRuneActionButtons();
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        this.runeInventory.forEach((runeEntry, idx) => {  // [Mixin 正常用法：读取 Game 实例状态]
            // 兼容新旧格式：提取符文 ID
            const runeId = getRuneId(runeEntry);
            if (!runeId) return;
            const runeDef = RUNE_DB.find(r => r.id === runeId);
            if (!runeDef) return;
            // 获取符文等级（新格式有 level，旧格式默认为 1）
            const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;
            const isSelected = this._selectedRuneIndices.has(idx);  // [Mixin 正常用法：读取 Game 实例状态]

            const card = document.createElement('div');
            card.className = [
                'flex items-start gap-3 p-3',
                'bg-purple-900/20 border border-purple-700/40 rounded-xl',
            ].join(' ');
            // [Agent D] 根据 level 动态计算效果数值描述
            const level = rw.level || 1;
            const bp = rw.baseParams || {};
            const lp = rw.perLevelParams || {};
            const calcParam = (key) => (bp[key] || 0) + (lp[key] || 0) * (level - 1);
            let dynamicDesc = '';
            if (rw.effectId === 'meltdown') {
                const bonus = Math.round(calcParam('damageBonus') * 100);
                dynamicDesc = `火焰/过热伤害 +${bonus}%`;
            } else if (rw.effectId === 'irradiation') {
                const amp = Math.round(calcParam('damageAmp') * 100);
                dynamicDesc = `激光累积伤害加深 +${amp}%/次`;
            } else if (rw.effectId === 'blazing_beam') {
                const temp = calcParam('tempIncrease');
                dynamicDesc = `激光每次命中升温 +${temp}`;
            } else if (rw.effectId === 'flame_sword') {
                const chance = Math.round(calcParam('triggerChance') * 100);
                const ratio = Math.round(calcParam('damageRatio') * 100);
                dynamicDesc = `穿透触发率 ${chance}%，剑光伤害 ${ratio}%`;
            } else if (rw.effectId === 'lightning_shield') {
                const chance = Math.round(calcParam('triggerChance') * 100);
                const ratio = Math.round(calcParam('damageRatio') * 100);
                dynamicDesc = `弹跳触发率 ${chance}%，静电场伤害 ${ratio}%`;
            } else if (rw.effectId === 'blade_storm') {
                const radius = calcParam('radius');
                const ratio = Math.round(calcParam('damageRatio') * 100);
                const interval = Math.max(0.1, calcParam('interval')).toFixed(1);
                dynamicDesc = `范围 ${radius}px，伤害 ${ratio}%，间隔 ${interval}s`;
            }
            const statsText = rw.stats
                ? Object.entries(rw.stats).map(([k, v]) => `${k}+${v}`).join(', ')
                : '';
            card.innerHTML = `
                <div class="flex-1">
                    <div class="text-sm font-bold text-purple-200">${rw.name} <span class="text-xs text-amber-400 font-normal">Lv.${level}</span></div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${rw.effect_desc || ''}</div>
                    ${dynamicDesc ? `<div class="text-[10px] text-emerald-400 mt-1">${dynamicDesc}</div>` : ''}
                    ${statsText ? `<div class="text-[10px] text-amber-300 mt-1">${statsText}</div>` : ''}
                </div>
                <span class="text-green-400 text-xs font-bold whitespace-nowrap">激活</span>
            `;
            container.appendChild(card);
        });

        // 更新按鈕状态
        this._ui_updateRuneActionButtons();
    },


    /**
     * 更新已激活词条列表显示
     * @private
     */
    _ui_updateActivatedRunewordsDisplay(activatedRunewords) {
        const container = document.getElementById('rune-active-runewords');
        const noRunewordsEl = document.getElementById('rune-no-runewords');
        if (!container) return;

        Array.from(container.children).forEach(child => {
            if (child.id !== 'rune-no-runewords') child.remove();
        });

        if (!activatedRunewords || activatedRunewords.length === 0) {
            if (noRunewordsEl) noRunewordsEl.classList.remove('hidden');
            return;
        }
        if (noRunewordsEl) noRunewordsEl.classList.add('hidden');

        activatedRunewords.forEach(rw => {
            const card = document.createElement('div');
            card.className = [
                'flex items-start gap-3 p-3',
                'bg-purple-900/20 border border-purple-700/40 rounded-xl',
            ].join(' ');
            // [Agent D] 根据 level 动态计算效果数值描述
            const level = rw.level || 1;
            const bp = rw.baseParams || {};
            const lp = rw.perLevelParams || {};
            const calcParam = (key) => (bp[key] || 0) + (lp[key] || 0) * (level - 1);
            let dynamicDesc = '';
            if (rw.effectId === 'meltdown') {
                const bonus = Math.round(calcParam('damageBonus') * 100);
                dynamicDesc = `火焰/过热伤害 +${bonus}%`;
            } else if (rw.effectId === 'irradiation') {
                const amp = Math.round(calcParam('damageAmp') * 100);
                dynamicDesc = `激光累积伤害加深 +${amp}%/次`;
            } else if (rw.effectId === 'blazing_beam') {
                const temp = calcParam('tempIncrease');
                dynamicDesc = `激光每次命中升温 +${temp}`;
            } else if (rw.effectId === 'flame_sword') {
                const chance = Math.round(calcParam('triggerChance') * 100);
                const ratio = Math.round(calcParam('damageRatio') * 100);
                dynamicDesc = `穿透触发率 ${chance}%，剑光伤害 ${ratio}%`;
            } else if (rw.effectId === 'lightning_shield') {
                const chance = Math.round(calcParam('triggerChance') * 100);
                const ratio = Math.round(calcParam('damageRatio') * 100);
                dynamicDesc = `弹跳触发率 ${chance}%，静电场伤害 ${ratio}%`;
            } else if (rw.effectId === 'blade_storm') {
                const radius = calcParam('radius');
                const ratio = Math.round(calcParam('damageRatio') * 100);
                const interval = Math.max(0.1, calcParam('interval')).toFixed(1);
                dynamicDesc = `范围 ${radius}px，伤害 ${ratio}%，间隔 ${interval}s`;
            }
            const statsText = rw.stats
                ? Object.entries(rw.stats).map(([k, v]) => `${k}+${v}`).join(', ')
                : '';
            card.innerHTML = `
                <div class="flex-1">
                    <div class="text-sm font-bold text-purple-200">${rw.name} <span class="text-xs text-amber-400 font-normal">Lv.${level}</span></div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${rw.effect_desc || ''}</div>
                    ${dynamicDesc ? `<div class="text-[10px] text-emerald-400 mt-1">${dynamicDesc}</div>` : ''}
                    ${statsText ? `<div class="text-[10px] text-amber-300 mt-1">${statsText}</div>` : ''}
                </div>
                <span class="text-green-400 text-xs font-bold whitespace-nowrap">激活</span>
            `;
            container.appendChild(card);
        });
    },


    /**
     * 更新属性加成汇总显示
     * @param {Object} activeStats - 词条加成对象（来自 parseRuneGrid）
     * @param {Object} [baseStats={}] - 基础属性加成对象（来自 calcRuneBaseStats）
     * @private
     */
    _ui_updateRuneStatsDisplay(activeStats, baseStats = {}) {
        const summary = document.getElementById('rune-stats-summary');
        const list = document.getElementById('rune-stats-list');
        if (!summary || !list) return;

        list.innerHTML = '';

        const runewordEntries = Object.entries(activeStats || {});
        const baseEntries = Object.entries(baseStats || {});

        if (runewordEntries.length === 0 && baseEntries.length === 0) {
            summary.classList.add('hidden');
            return;
        }
        summary.classList.remove('hidden');

        // 展示基础属性加成（来自符文等级）
        if (baseEntries.length > 0) {
            const baseLabel = document.createElement('div');
            baseLabel.className = 'w-full text-[10px] text-slate-400/70 tracking-widest uppercase mb-1';
            baseLabel.textContent = '基础属性（符文等级加成）';
            list.appendChild(baseLabel);

            baseEntries.forEach(([key, val]) => {
                const statInfo = STAT_DISPLAY[key] || { name: key, icon: '' };
                const tag = document.createElement('div');
                tag.className = 'px-2 py-1 bg-blue-900/30 border border-blue-600/40 rounded-lg text-xs text-blue-200 font-bold';
                tag.textContent = `${statInfo.icon} ${statInfo.name} +${val}`;
                list.appendChild(tag);
            });
        }

        // 展示词条加成（来自符文词条共鸣）
        if (runewordEntries.length > 0) {
            const runewordLabel = document.createElement('div');
            runewordLabel.className = 'w-full text-[10px] text-slate-400/70 tracking-widest uppercase mb-1 mt-2';
            runewordLabel.textContent = '词条共鸣（词条共鸣加成）';
            list.appendChild(runewordLabel);

            runewordEntries.forEach(([key, val]) => {
                const statInfo = STAT_DISPLAY[key] || { name: key, icon: '' };
                const tag = document.createElement('div');
                tag.className = 'px-2 py-1 bg-amber-900/30 border border-amber-600/40 rounded-lg text-xs text-amber-200 font-bold';
                tag.textContent = `${statInfo.icon} ${statInfo.name} +${val}`;
                list.appendChild(tag);
            });
        }
    },

    /**
     * 更新合成/重铸按鈕状态
     * @private
     */
    _ui_updateRuneActionButtons() {
        if (!this._selectedRuneIndices) this._selectedRuneIndices = new Set();  // [Mixin 正常用法：读取 Game 实例状态]
        const selectedCount = this._selectedRuneIndices.size;  // [Mixin 正常用法：读取 Game 实例状态]

        // 更新选中计数显示
        const countEl = document.getElementById('rune-selected-count');
        if (countEl) {
            countEl.textContent = `已选中 ${selectedCount}/3`;
            countEl.className = selectedCount > 0
                ? 'text-xs text-purple-300 font-bold'
                : 'text-xs text-slate-500';
        }

        // 获取选中符文对象
        const selectedRunes = Array.from(this._selectedRuneIndices).map(idx => {  // [Mixin 正常用法：读取 Game 实例状态]
            const entry = this.runeInventory[idx];  // [Mixin 正常用法：读取 Game 实例状态]
            if (!entry) return null;
            return typeof entry === 'object' ? entry : { id: entry, level: 1 };
        }).filter(Boolean);

        // 判断合成条件：3 个同 ID 同等级
        const mergeBtn = document.getElementById('rune-merge-btn');
        if (mergeBtn) {
            const canMerge = selectedCount === 3 &&
                selectedRunes.length === 3 &&
                selectedRunes.every(r => r.id === selectedRunes[0].id && r.level === selectedRunes[0].level);

            if (canMerge) {
                mergeBtn.disabled = false;
                mergeBtn.className = [
                    'w-full py-2 px-3 rounded-xl text-sm font-bold',
                    'bg-amber-600/80 text-amber-100 border border-amber-400/60',
                    'hover:bg-amber-500/80 cursor-pointer transition-all duration-200',
                    'shadow-[0_0_8px_rgba(251,191,36,0.3)]',
                ].join(' ');
                mergeBtn.textContent = `⚗️ 合成 → ${selectedRunes[0].id.replace('rune_', '').replace(/_\d+$/, '')} Lv.${selectedRunes[0].level + 1}`;
            } else {
                mergeBtn.disabled = true;
                mergeBtn.className = [
                    'w-full py-2 px-3 rounded-xl text-sm font-bold',
                    'bg-slate-800/60 text-slate-600 border border-slate-700/40',
                    'cursor-not-allowed transition-all duration-200',
                ].join(' ');
                mergeBtn.textContent = '⚗️ 合成（需选中 3 个同 ID 同等级）';
            }
        }

        // 判断重铸条件：任意 3 个
        const reforgeBtn = document.getElementById('rune-reforge-btn');
        if (reforgeBtn) {
            const canReforge = selectedCount === 3;
            if (canReforge) {
                reforgeBtn.disabled = false;
                reforgeBtn.className = [
                    'w-full py-2 px-3 rounded-xl text-sm font-bold',
                    'bg-purple-600/80 text-purple-100 border border-purple-400/60',
                    'hover:bg-purple-500/80 cursor-pointer transition-all duration-200',
                    'shadow-[0_0_8px_rgba(168,85,247,0.3)]',
                ].join(' ');
                reforgeBtn.textContent = '🔮 重铸（消耗 3 个符文，获得全新符文）';
            } else {
                reforgeBtn.disabled = true;
                reforgeBtn.className = [
                    'w-full py-2 px-3 rounded-xl text-sm font-bold',
                    'bg-slate-800/60 text-slate-600 border border-slate-700/40',
                    'cursor-not-allowed transition-all duration-200',
                ].join(' ');
                reforgeBtn.textContent = '🔮 重铸（消耗 3 个符文，获得全新符文）';
            }
        }
    },


    /**
     * 执行符文合成
     */
    ui_doRuneMerge() {
        if (!this._selectedRuneIndices || this._selectedRuneIndices.size !== 3) return;  // [Mixin 正常用法：读取 Game 实例状态]

        const selectedRunes = Array.from(this._selectedRuneIndices).map(idx => {  // [Mixin 正常用法：读取 Game 实例状态]
            const entry = this.runeInventory[idx];  // [Mixin 正常用法：读取 Game 实例状态]
            return typeof entry === 'object' ? entry : { id: entry, level: 1 };
        }).filter(Boolean);

        const result = rune_merge(selectedRunes, this.runeInventory);  // [Mixin 正常用法：读取 Game 实例状态]

        if (result.success) {
            this._selectedRuneIndices = new Set();  // [Mixin 正常用法：读取 Game 实例状态]
            const runeDef = RUNE_DB.find(r => r.id === result.result.id);
            const runeName = runeDef ? `${runeDef.icon} ${runeDef.name}` : result.result.id;
            this._ui_showRuneActionResult(
                `⚗️ 合成成功！获得 ${runeName} Lv.${result.result.level}`,
                'success'
            );
            audio.playTone(880, 'sine', 0.15, 0.3);
            this.ui_updateRuneGrid();
        } else {
            this._ui_showRuneActionResult(`⚠️ 合成失败：${result.error}`, 'error');
        }
    },


    /**
     * 执行符文重铸
     */
    ui_doRuneReforge() {
        if (!this._selectedRuneIndices || this._selectedRuneIndices.size !== 3) return;  // [Mixin 正常用法：读取 Game 实例状态]

        const selectedRunes = Array.from(this._selectedRuneIndices).map(idx => {  // [Mixin 正常用法：读取 Game 实例状态]
            const entry = this.runeInventory[idx];  // [Mixin 正常用法：读取 Game 实例状态]
            return typeof entry === 'object' ? entry : { id: entry, level: 1 };
        }).filter(Boolean);

        const result = rune_reforge(selectedRunes, this.runeInventory, this);  // [Mixin 正常用法：读取 Game 实例状态]

        if (result.success) {
            this._selectedRuneIndices = new Set();  // [Mixin 正常用法：读取 Game 实例状态]
            const runeDef = RUNE_DB.find(r => r.id === result.result.id);
            const runeName = runeDef ? `${runeDef.icon} ${runeDef.name}` : result.result.id;
            this._ui_showRuneActionResult(
                `🔮 重铸完成！获得 ${runeName} Lv.${result.result.level}`,
                'success'
            );
            audio.playTone(660, 'triangle', 0.12, 0.4);
            this.ui_updateRuneGrid();
        } else {
            this._ui_showRuneActionResult(`⚠️ 重铸失败：${result.error}`, 'error');
        }
    },


    /**
     * 展示操作结果提示
     * @param {string} message - 提示文字
     * @param {'success'|'error'} type - 提示类型
     * @private
     */
    _ui_showRuneActionResult(message, type) {
        const el = document.getElementById('rune-action-result');
        if (!el) return;
        el.textContent = message;
        el.className = [
            'mb-4 text-sm font-bold text-center py-2 px-3 rounded-xl',
            type === 'success'
                ? 'bg-green-900/30 border border-green-500/50 text-green-300'
                : 'bg-red-900/30 border border-red-500/50 text-red-300',
        ].join(' ');
        el.classList.remove('hidden');
        // 3 秒后自动隐藏
        clearTimeout(this._runeActionResultTimer);
        this._runeActionResultTimer = setTimeout(() => {
            el.classList.add('hidden');
        }, 3000);
    },


};

// 暴露到全局，供向后兼容
window.rune_launcher_system = rune_launcher_system;
