/**
 * src/ui/rune_launcher.js - 符文发射器界面渲染模块
 * 
 * 职责：符文发射器面板的完整 UI 交互
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

import { RUNE_DB, RUNEWORD_DB, STAT_DISPLAY, RARITY_DISPLAY, ELEMENT_RESONANCE_DB } from '../rune_config.js';
import { parseRuneGrid, calcRuneBaseStats, getRuneId, rune_merge, rune_reforge, getNewRunewordsOnPlacement } from '../rune_system.js';
import { audio } from '../audio.js';
import { showToast } from '../entities.js';
import { SKILL_DB } from '../config.js'; // [技能系统迭代] 用于符文解锁技能派生

/**
 * 构建符文图标 HTML（统一的符文展示辅助函数）
 * 生成带黑底、稀有度边框、等级角标的 .rune-icon-frame 元素 HTML字符串。
 * @param {object} runeDef - RUNE_DB 中的符文定义对象（包含 icon, rarity 字段）
 * @param {number} runeLevel - 符文等级（1/2/3）
 * @param {string} [extraClass=''] - 额外的 CSS class（如尺寸类）
 * @returns {string} HTML 字符串
 */
function _ui_buildRuneIconHTML(runeDef, runeLevel, extraClass = '') {
    const rarity = (runeDef && runeDef.rarity) ? runeDef.rarity : 'common';
    const icon   = (runeDef && runeDef.icon)   ? runeDef.icon   : '🔮';
    const lv     = runeLevel || 1;
    const lvClass = `lv-${Math.min(lv, 3)}`;
    const rarityClass = `rarity-${rarity}`;
    const lvLabel = `Lv.${lv}`;
    return `<span class="rune-icon-frame ${rarityClass} ${lvClass}${extraClass ? ' ' + extraClass : ''}">${icon}<span class="rune-lv-badge">${lvLabel}</span></span>`;
}

/**
 * 符文发射器 UI 方法集合
 * 通过 bind(this) 组合模式作为实例方法注入到 Game 实例
 */
export const rune_launcher_system = {


    // ==================== 符文发射器 UI ====================

    /**
     * 打开符文发射器面板
     */
    ui_openRuneLauncher() {
        const panel = document.getElementById('phase-rune-launcher');
        const isPCMode = document.body.classList.contains('pc-mode');
        console.log('[ui_openRuneLauncher] 打开符文发射器，当前 phase=' + this.phase + '，PC模式=' + isPCMode);

        if (panel) {
            if (isPCMode) {
                // PC 模式：面板已常驻在右侧边栏，不需要修改 display
                // 仅刷新内容即可
            } else {
                // 移动端模式：弹出全屏覆盖层
                panel.style.display = 'flex';
            }
        }
        // [BUGFIX] 确保 picker 蒙层在打开时是关闭状态（防止上次残留）
        const pickerOverlay = document.getElementById('rune-picker-overlay');
        if (pickerOverlay) pickerOverlay.classList.add('hidden');
        // 初始化发射器内符文碎片计数显示
        this._ui_updateLauncherShardCount();
        this.ui_initRuneGrid();
        this.ui_updateRuneGrid();
        // 关闭气泡提示（玩家已进入发射器）
        this._ui_hideRunewordBubble();
        // 首次打开时显示内部引导教学（移动端不影响 PC 端常驻）
        if (!isPCMode && this.saveData && !this.saveData.runeLauncherTourDone) {
            setTimeout(() => this.ui_showRuneLauncherTour(), 400);
        }
    },


    /**
     * 更新符文发射器面板顶部的符文碎片计数显示
     * @private
     */
    _ui_updateLauncherShardCount() {
        const el = document.getElementById('launcher-shard-count');
        if (el) {
            el.textContent = (this.saveData && this.saveData.runeFragments) ? this.saveData.runeFragments.toLocaleString() : '0';  // [Mixin 正常用法：读取 Game 实例状态]
        }
    },


    /**
     * 关闭符文发射器面板
     */
    ui_closeRuneLauncher() {
        // [DEBUG-LOG] 记录关闭时的调用栈
        console.log('[ui_closeRuneLauncher] 关闭符文发射器，调用栈:', new Error().stack);
        // [BUGFIX] 关闭时先清理内部蒙层和教学层，防止残留
        const pickerOverlay = document.getElementById('rune-picker-overlay');
        if (pickerOverlay) pickerOverlay.classList.add('hidden');
        const tourOverlay = document.getElementById('rune-launcher-tour-overlay');
        if (tourOverlay) tourOverlay.remove();
        this._pendingRuneGridIndex = null;

        const panel = document.getElementById('phase-rune-launcher');
        if (panel) {
            const isPCMode = document.body.classList.contains('pc-mode');
            if (!isPCMode) {
                // 移动端模式：隐藏全屏覆盖层
                panel.style.display = 'none';
            }
            // PC 模式：面板常驻在右侧边栏，不隐藏
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
     * [优化]：增加触发预测、前置显示、闪烁特效、长按预览功能
     * @param {number} cellIndex - 目标格子索引
     */
    ui_openRunePicker(cellIndex) {
        if (!this.runeInventory || this.runeInventory.length === 0) {
            if (window.showToast) showToast('库存中没有符文');
            return;
        }

        const overlay = document.getElementById('rune-picker-overlay');
        const list = document.getElementById('rune-picker-list');
        const tooltip = document.getElementById('runeword-preview-tooltip');
        const tooltipContent = document.getElementById('runeword-preview-content');
        if (!overlay || !list) return;

        list.innerHTML = '';
        if (tooltip) tooltip.classList.add('hidden');

        // 1. 预处理库存：计算每个符文放入该格子后能触发的新词条
        const analyzedInventory = this.runeInventory.map((runeEntry, originalIdx) => {
            const newRunewords = getNewRunewordsOnPlacement(this.runeGrid, cellIndex, runeEntry, RUNEWORD_DB);
            return {
                runeEntry,
                originalIdx,
                newRunewords,
                isTrigger: newRunewords.length > 0
            };
        });

        // 2. 排序：能触发新词条的符文排在前面
        analyzedInventory.sort((a, b) => {
            if (a.isTrigger && !b.isTrigger) return -1;
            if (!a.isTrigger && b.isTrigger) return 1;
            return 0;
        });

        // 3. 渲染列表
        analyzedInventory.forEach(({ runeEntry, newRunewords, isTrigger }) => {
            const runeId = getRuneId(runeEntry);
            if (!runeId) return;
            const runeDef = RUNE_DB.find(r => r.id === runeId);
            if (!runeDef) return;
            const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;

            const btn = document.createElement('button');
            btn.className = [
                'flex flex-col items-center gap-1 p-3 relative',
                'bg-slate-800/80 border border-slate-600/50 rounded-xl',
                'hover:border-purple-400/60 hover:bg-slate-700/80',
                'transition-all duration-200 min-w-[72px]',
                isTrigger ? 'rune-glow-active' : ''
            ].join(' ');

            btn.innerHTML = `
                <span style="font-size:24px;">${_ui_buildRuneIconHTML(runeDef, runeLevel)}</span>
                <span class="text-[10px] text-slate-300 text-center leading-tight">${runeDef.name}</span>
                ${isTrigger ? `<span class="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] font-bold px-1 rounded-full shadow-sm">NEW</span>` : ''}
            `;

            // --- 交互逻辑 ---
            let longPressTimer = null;

            const handleSelect = () => {
                const removeIdx = this.runeInventory.indexOf(runeEntry);
                if (removeIdx !== -1) {
                    this.runeInventory.splice(removeIdx, 1);
                }
                this.runeGrid[cellIndex] = runeEntry;
                this.ui_closeRunePicker();
                this.ui_updateRuneGrid();
                audio.playTone(600, 'sine', 0.1, 0.2);
            };

            const showPreview = () => {
                if (!isTrigger || !tooltip || !tooltipContent) return;
                tooltipContent.innerHTML = newRunewords.map(rw => `
                    <div class="bg-slate-900/60 p-2 rounded-lg border border-amber-500/30">
                        <div class="text-amber-200 text-xs font-bold">${rw.name} <span class="text-amber-500/70 font-normal">Lv.${rw.level}</span></div>
                        <div class="text-[10px] text-slate-400 mt-1">${rw.effect_desc}</div>
                    </div>
                `).join('');
                tooltip.classList.remove('hidden');
                try { if (audio?.playTone) audio.playTone(880, 'sine', 0.05, 0.1); } catch(e) {}
            };

            const hidePreview = () => {
                if (tooltip) tooltip.classList.add('hidden');
            };

            // 鼠标/触摸事件处理
            const startPress = (e) => {
                longPressTimer = setTimeout(showPreview, 500);
            };
            const endPress = (e) => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                hidePreview();
            };

            btn.addEventListener('mousedown', startPress);
            btn.addEventListener('mouseup', endPress);
            btn.addEventListener('mouseleave', endPress);
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // 防止触发 click
                startPress(e);
            }, { passive: false });
            btn.addEventListener('touchend', (e) => {
                endPress(e);
                // 如果没有触发长按（tooltip 还是隐藏的），则视为点击
                if (tooltip && tooltip.classList.contains('hidden')) {
                    handleSelect();
                }
            });

            btn.addEventListener('click', (e) => {
                // 只有非触摸设备才在这里处理点击
                if (e.pointerType !== 'touch') {
                    handleSelect();
                }
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
                    // 使用统一的符文图标框架，黑底+稀有度边框+等级角标
                    cell.innerHTML = `<span title="${runeDef.name} Lv.${runeLevel}" style="font-size:26px;">${_ui_buildRuneIconHTML(runeDef, runeLevel)}</span>`;
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

        // 2.5 记录已发现词条（写入存档）
        if (activatedRunewords.length > 0 && this.saveData) {
            if (!this.saveData.discoveredRunewords) this.saveData.discoveredRunewords = [];
            let newDiscovery = false;
            activatedRunewords.forEach(rw => {
                if (rw.id && !this.saveData.discoveredRunewords.includes(rw.id)) {
                    this.saveData.discoveredRunewords.push(rw.id);
                    newDiscovery = true;
                }
            });
            if (newDiscovery) this.sys_saveData();
        }

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

        // 6.5 计算属性共鸣等级并写入 activeElementResonances
        // 供战斗层（combat_system.js）读取共鸣参数
        const newResonances = {};
        for (const [element, resonanceDef] of Object.entries(ELEMENT_RESONANCE_DB)) {
            const statCount = baseStats[element] || 0;
            // 从高阶到低阶逐一检查，取满足阈值的最高阶
            let activeTier = null;
            for (let i = resonanceDef.tiers.length - 1; i >= 0; i--) {
                if (statCount >= resonanceDef.tiers[i].threshold) {
                    activeTier = resonanceDef.tiers[i];
                    break;
                }
            }
            if (activeTier) {
                newResonances[element] = {
                    label: activeTier.label,
                    desc: activeTier.desc,
                    threshold: activeTier.threshold,
                    statCount,
                    params: activeTier.params,
                };
            }
        }
        // 检测共鸣变化并弹出 Toast 提示
        const prevResonances = this.activeElementResonances || {};
        for (const [element, res] of Object.entries(newResonances)) {
            const prev = prevResonances[element];
            if (!prev || prev.threshold !== res.threshold) {
                const def = ELEMENT_RESONANCE_DB[element];
                showToast(`✨ ${def ? def.icon : ''} ${res.label}已激活！`);
            }
        }
        this.activeElementResonances = newResonances;

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

        // 9. [技能系统迭代] 根据激活的符文词条派生已解锁技能列表
        //    SKILL_DB 中每个技能的 unlockRuneword 字段指向一个 RUNEWORD_DB 的 id
        //    当该词条被激活时，对应技能自动解锁
        const prevSkillCount = this.activeSkills ? this.activeSkills.length : 0;
        const activatedRunewordIds = new Set(activatedRunewords.map(rw => rw.id));
        const newActiveSkills = SKILL_DB.filter(sk => sk.unlockRuneword && activatedRunewordIds.has(sk.unlockRuneword));
        this.activeSkills = newActiveSkills;

        // 如果技能列表发生变化，同步更新技能杠和 SP 面板显隐
        if (newActiveSkills.length !== prevSkillCount) {
            // 如果有新解锁的技能，确保 skill_point 槽在下一回合中生成
            if (newActiveSkills.length > 0 && !this.unlockedSlots.includes('skill_point')) {
                this.unlockedSlots.push('skill_point');
                // 增加槽位数量以容纳技能点槽
                if (this.slotCount < this.unlockedSlots.length) {
                    this.slotCount = this.unlockedSlots.length;
                }
                showToast('✨ 符文解锁技能！下一回合将出现技能点槽');
            } else if (newActiveSkills.length === 0 && this.unlockedSlots.includes('skill_point')) {
                this.unlockedSlots = this.unlockedSlots.filter(t => t !== 'skill_point');
                this.slotCount = Math.max(1, this.unlockedSlots.length);
            }
            // 同步更新技能杠显示
            if (this.ui) {
                this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
            }
            // [fix] 精确更新技能杠和 SP 面板的显隐，避免调用 ui_updateUI() 导致
            // 所有 .ui-overlay 被全局隐藏，从而意外关闭符文发射器面板。
            const hasSkills = this.activeSkills && this.activeSkills.length > 0;
            const skillBar = document.getElementById('skill-bar');
            if (skillBar) {
                skillBar.style.display = (this.phase === 'combat' && hasSkills) ? 'flex' : 'none';
            }
            const spPanel = document.getElementById('sp-panel');
            if (spPanel) {
                if ((this.phase === 'gathering' || this.phase === 'combat') && hasSkills) {
                    spPanel.style.opacity = '1';
                    spPanel.style.pointerEvents = 'auto';
                } else {
                    spPanel.style.opacity = '0';
                    spPanel.style.pointerEvents = 'none';
                }
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
                'flex items-center gap-2 p-2 rounded-xl cursor-pointer select-none transition-all duration-150',
                isSelected
                    ? 'bg-purple-700/40 border-2 border-purple-400/80 shadow-[0_0_6px_rgba(168,85,247,0.5)]'
                    : 'bg-slate-800/60 border-2 border-slate-700/40 hover:border-purple-600/50',
            ].join(' ');
            card.innerHTML = `
                <div class="w-10 h-10 flex items-center justify-center shrink-0" style="font-size:22px;">
                    ${_ui_buildRuneIconHTML(runeDef, runeLevel)}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-purple-200 truncate">${runeDef.name}</span>
                    </div>
                    <div class="text-[9px] text-slate-500 truncate">${runeDef.element}</div>
                </div>
                ${isSelected ? '<span class="text-purple-300 text-sm shrink-0">✓</span>' : ''}
            `;
            card.addEventListener('click', () => {
                if (this._selectedRuneIndices.has(idx)) {  // [Mixin 正常用法：读取 Game 实例状态]
                    this._selectedRuneIndices.delete(idx);  // [Mixin 正常用法：读取 Game 实例状态]
                } else {
                    this._selectedRuneIndices.add(idx);  // [Mixin 正常用法：读取 Game 实例状态]
                }
                this._ui_updateRuneInventoryDisplay();
            });
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
                dynamicDesc = `持续升温模式：每 0.5s 升温 +${temp}`;
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

            // [局内合成 -> 局外符文碎片奖励]
            // 奖励公式：Lv.1 得 1 片，Lv.2 得 3 片，Lv.3 得 6 片
            const mergedLevel = result.result.level;
            const MERGE_SHARD_REWARDS = [0, 1, 3, 6]; // 索引即符文等级
            const shardReward = MERGE_SHARD_REWARDS[Math.min(mergedLevel, 3)] || 1;
            this.meta_addCurrency(shardReward);

            // 合成动画：符文碎片从合成按鈕飞向局外货币显示区
            const mergeBtn = document.getElementById('rune-merge-btn');
            if (mergeBtn) {
                const rect = mergeBtn.getBoundingClientRect();
                const startX = rect.left + rect.width / 2;
                const startY = rect.top + rect.height / 2;
                // 多片碎片错开飞出，增强视觉层次感
                for (let i = 0; i < shardReward; i++) {
                    const offsetX = (Math.random() - 0.5) * 40;
                    const offsetY = (Math.random() - 0.5) * 20;
                    setTimeout(() => {
                        this._ui_playMergeShardFlyEffect(
                            startX + offsetX,
                            startY + offsetY,
                            1
                        );
                    }, i * 80); // 每片间隔 80ms 错开飞出
                }
            }

            this._ui_showRuneActionResult(
                `⚗️ 合成成功！获得 ${runeName} Lv.${mergedLevel}，+${shardReward} 🔮 符文碎片`,
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
     * 局内符文合成成功时，符文碎片飞向局外货币显示区的动画
     * 与 ui_playResourceFlyEffect 的区别：这里使用独立的 DOM 节点，
     * 并应用合成主题的紫色光晓特效，以区分普通资源飞行动画。
     * @param {number} startX - 起始 X 坐标（页面坐标）
     * @param {number} startY - 起始 Y 坐标（页面坐标）
     * @param {number} amount - 碎片数量（显示用）
     * @private
     */
    _ui_playMergeShardFlyEffect(startX, startY, amount) {
        const node = document.createElement('div');
        node.textContent = '🔮';
        node.style.cssText = [
            'position: fixed;',
            `left: ${startX}px;`,
            `top: ${startY}px;`,
            'font-size: 18px;',
            'pointer-events: none;',
            'z-index: 9999;',
            'opacity: 1;',
            'transform: translate(-50%, -50%) scale(1.2);',
            'transition: all 0.75s cubic-bezier(0.16, 1, 0.3, 1);',
            'filter: drop-shadow(0 0 6px rgba(168,85,247,0.9)) drop-shadow(0 0 12px rgba(168,85,247,0.5));',
            'will-change: transform, opacity;',
        ].join(' ');
        document.body.appendChild(node);

        // 目标元素：优先飞向发射器面板内的碎片计数显示，其次才是局外货币显示区
        const launcherShardEl = document.getElementById('launcher-shard-count');
        const metaCurrencyEl = document.getElementById('meta-currency-display');
        const targetEl = launcherShardEl || metaCurrencyEl;
        const targetRect = targetEl
            ? targetEl.getBoundingClientRect()
            : { left: window.innerWidth - 80, top: 30, width: 0, height: 0 };
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        // 强制重排以触发过渡
        void node.offsetWidth;

        // 开始飞行动画
        node.style.left = `${targetX}px`;
        node.style.top = `${targetY}px`;
        node.style.opacity = '0';
        node.style.transform = 'translate(-50%, -50%) scale(0.4)';

        // 动画结束后清理 DOM 并播放货币闪烁反馈
        setTimeout(() => {
            if (node.parentNode) node.parentNode.removeChild(node);
            // 更新发射器内碎片计数显示
            this._ui_updateLauncherShardCount();
            // 货币显示区闪烁反馈
            if (targetEl) {
                const parent = targetEl.parentElement;
                if (parent) {
                    parent.style.transition = 'transform 0.1s ease, filter 0.1s ease';
                    parent.style.transform = 'scale(1.25)';
                    parent.style.filter = 'brightness(1.8) drop-shadow(0 0 8px rgba(168,85,247,0.9))';
                    setTimeout(() => {
                        parent.style.transform = 'scale(1)';
                        parent.style.filter = 'none';
                    }, 160);
                }
            }
        }, 750);
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


    // ==================== 词条图鉴 ====================

    /**
     * ui_switchRuneTab - 切换符文发射器面板的 Tab
     * @param {'launcher'|'codex'} tab - 目标 Tab
     */
    ui_switchRuneTab(tab) {
        const launcherContent = document.getElementById('rune-launcher-content');
        const codexPanel = document.getElementById('rune-codex-panel');
        const tabLauncher = document.getElementById('rune-tab-launcher');
        const tabCodex = document.getElementById('rune-tab-codex');
        if (!launcherContent || !codexPanel) return;

        const activeClass = ['bg-purple-700/60', 'text-purple-100', 'border-purple-500/60'];
        const inactiveClass = ['bg-slate-800/60', 'text-slate-400', 'border-slate-700/40'];

        if (tab === 'launcher') {
            launcherContent.classList.remove('hidden');
            codexPanel.classList.add('hidden');
            if (tabLauncher) { tabLauncher.classList.add(...activeClass); tabLauncher.classList.remove(...inactiveClass); }
            if (tabCodex) { tabCodex.classList.remove(...activeClass); tabCodex.classList.add(...inactiveClass); }
        } else {
            launcherContent.classList.add('hidden');
            codexPanel.classList.remove('hidden');
            if (tabCodex) { tabCodex.classList.add(...activeClass); tabCodex.classList.remove(...inactiveClass); }
            if (tabLauncher) { tabLauncher.classList.remove(...activeClass); tabLauncher.classList.add(...inactiveClass); }
            this.ui_renderRuneCodex();
        }
    },


    /**
     * ui_renderRuneCodex - 渲染词条图鉴面板
     * 已发现的词条显示完整信息，未发现的显示隐藏卡片
     */
    ui_renderRuneCodex() {
        const list = document.getElementById('rune-codex-list');
        const discoveredCountEl = document.getElementById('rune-codex-discovered-count');
        const totalCountEl = document.getElementById('rune-codex-total-count');
        if (!list) return;

        const discovered = (this.saveData && this.saveData.discoveredRunewords) ? this.saveData.discoveredRunewords : [];  // [Mixin 正常用法：读取 Game 实例状态]
        const total = RUNEWORD_DB.length;
        const discoveredCount = RUNEWORD_DB.filter(rw => discovered.includes(rw.id)).length;

        if (discoveredCountEl) discoveredCountEl.textContent = discoveredCount;
        if (totalCountEl) totalCountEl.textContent = total;

        list.innerHTML = '';

        RUNEWORD_DB.forEach(rw => {
            const isDiscovered = discovered.includes(rw.id);
            const card = document.createElement('div');

            if (!isDiscovered) {
                // 未发现：显示隐藏卡片
                card.className = 'bg-slate-900/60 border border-slate-700/30 rounded-xl p-4 opacity-60';
                // 显示 pattern 中符文的元素类型作为提示
                const patternHint = rw.pattern.map(runeId => {
                    const rd = RUNE_DB.find(r => r.id === runeId);
                    return rd ? rd.icon : '?';
                }).join(' ');
                card.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 flex items-center justify-center bg-slate-800/80 rounded-lg border border-slate-600/30 text-xl">
                            <span class="text-slate-500">🔒</span>
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-bold text-slate-500 tracking-wider">??? 未发现</div>
                            <div class="text-[10px] text-slate-600 mt-1">符文组合提示: ${patternHint}</div>
                        </div>
                        <span class="text-[10px] text-slate-600 bg-slate-800/60 px-2 py-1 rounded-lg">尚未解锁</span>
                    </div>
                `;
            } else {
                // 已发现：显示完整信息，默认展示 Lv.1 效果
                const defaultLevel = 1;
                card.className = 'bg-purple-900/20 border border-purple-700/40 rounded-xl p-4';
                card.dataset.runewordId = rw.id;

                const patternIcons = rw.pattern.map(runeId => {
                    const rd = RUNE_DB.find(r => r.id === runeId);
                    return rd ? `<span title="${rd.name}" style="font-size:18px;">${_ui_buildRuneIconHTML(rd, 1)}</span>` : '?';
                }).join('<span class="text-slate-600 mx-0.5">→</span>');

                const dynamicDesc = this._ui_calcRunewordDynamicDesc(rw, defaultLevel);

                // 构建等级 Tab 按鈕区域
                const maxLevel = 3;
                const tabBtns = Array.from({ length: maxLevel }, (_, i) => {
                    const lv = i + 1;
                    const isActive = lv === defaultLevel;
                    return `<button
                        class="codex-lv-tab px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-150 ${
                            isActive
                                ? 'bg-amber-600/70 text-amber-100 border border-amber-400/60'
                                : 'bg-slate-800/60 text-slate-500 border border-slate-700/40 hover:bg-slate-700/60 hover:text-slate-300'
                        }"
                        data-runeword-id="${rw.id}"
                        data-level="${lv}"
                        onclick="game.ui_switchRunewordCodexLevel('${rw.id}', ${lv})"
                    >Lv.${lv}</button>`;
                }).join('');

                card.innerHTML = `
                    <div class="flex items-start gap-3 mb-3">
                        <div class="w-10 h-10 flex items-center justify-center bg-purple-950/60 rounded-lg border border-purple-500/40 text-xl shrink-0">
                            ✨
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-sm font-bold text-purple-100">${rw.name}</span>
                                <span class="text-[10px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">${rw.effect_desc.match(/【(.+?)】/)?.[1] || ''}</span>
                            </div>
                            <div class="text-[10px] text-slate-400 mt-1">符文组合: ${patternIcons}</div>
                        </div>
                    </div>
                    <div class="text-[10px] text-slate-300 leading-relaxed mb-3">${rw.effect_desc}</div>
                    <div id="codex-desc-${rw.id}" class="text-[10px] text-emerald-400 font-bold mb-3 min-h-[16px]">${dynamicDesc}</div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-slate-500 mr-1">等级:</span>
                        ${tabBtns}
                    </div>
                `;
            }

            list.appendChild(card);
        });
    },


    /**
     * ui_switchRunewordCodexLevel - 切换图鉴中某个词条的展示等级
     * @param {string} runewordId - 词条 ID
     * @param {number} level - 目标等级 (1-3)
     */
    ui_switchRunewordCodexLevel(runewordId, level) {
        const rw = RUNEWORD_DB.find(r => r.id === runewordId);
        if (!rw) return;

        // 更新动态效果描述
        const descEl = document.getElementById(`codex-desc-${runewordId}`);
        if (descEl) {
            descEl.textContent = this._ui_calcRunewordDynamicDesc(rw, level);
        }

        // 更新 Tab 按鈕样式
        const allTabs = document.querySelectorAll(`.codex-lv-tab[data-runeword-id="${runewordId}"]`);
        allTabs.forEach(btn => {
            const btnLevel = parseInt(btn.dataset.level);
            if (btnLevel === level) {
                btn.className = btn.className
                    .replace(/bg-slate-800\/60|text-slate-500|border-slate-700\/40|hover:bg-slate-700\/60|hover:text-slate-300/g, '')
                    .trim();
                btn.classList.add('bg-amber-600/70', 'text-amber-100', 'border-amber-400/60');
            } else {
                btn.classList.remove('bg-amber-600/70', 'text-amber-100', 'border-amber-400/60');
                btn.classList.add('bg-slate-800/60', 'text-slate-500', 'border-slate-700/40');
            }
        });
    },


    /**
     * _ui_calcRunewordDynamicDesc - 根据词条和等级计算动态效果描述
     * @param {Object} rw - RUNEWORD_DB 中的词条对象
     * @param {number} level - 目标等级 (1-3)
     * @returns {string} 动态效果描述文本
     * @private
     */
    _ui_calcRunewordDynamicDesc(rw, level) {
        const bp = rw.baseParams || {};
        const lp = rw.perLevelParams || {};
        const calc = (key) => (bp[key] || 0) + (level - 1) * (lp[key] || 0);

        switch (rw.effectId) {
            case 'meltdown': {
                const bonus = Math.round(calc('damageBonus') * 100);
                return `火焰燃烧 / 过热爆炸最终伤害 +${bonus}%`;
            }
            case 'absolute_zero': {
                const amp = (calc('damageAmp') * 100).toFixed(1);
                return `冰冻状态下，每次物理伤害使本回全部伤害加深 +${amp}%`;
            }
            case 'frost_nova': {
                const bounces = calc('requiredBounces');
                const radius = calc('radius');
                const ratio = Math.round(calc('damageRatio') * 100);
                const tempDrop = calc('tempDrop');
                return `每弹跳 ${bounces} 次释放冰霜新星，范围 ${radius}px，冒冰伤害 ${ratio}%，降温 ${tempDrop}`;
            }
            case 'thunderstorm': {
                const decay = Math.round(calc('decayBonus') * 100);
                return `闪电链伤害衰减系数提升 +${decay}%`;
            }
            case 'thunder_scatter': {
                const chains = calc('extraChains');
                return `闪电链触发时，额外释放 ${chains} 条闪电链`;
            }
            case 'kinetic_surge': {
                const flat = calc('flatDamage');
                return `每次弹跳伤害固定增加 +${flat}`;
            }
            case 'irradiation': {
                const amp = Math.round(calc('damageAmp') * 100);
                return `激光累积照射同一敌人，受到的伤害加深 +${amp}%/次`;
            }
            case 'flame_sword': {
                const chance = Math.round(calc('triggerChance') * 100);
                const ratio = Math.round(calc('damageRatio') * 100);
                const tempRatio = Math.round(calc('tempDamageRatio') * 100);
                return `穿透触发率 ${chance}%，剑光伤害 ${ratio}%，附加火焰伤害 ${tempRatio}%`;
            }
            case 'armor_piercing_meteor': {
                const bonus = Math.round(calc('damageBonus') * 100);
                return bonus > 0
                    ? `散射子弹丸继承 100% 穿透层数，额外伤害 +${bonus}%`
                    : `散射子弹丸继承 100% 穿透层数`;
            }
            case 'blazing_beam': {
                const temp = calc('tempIncrease');
                return `激光变为持续升温模式：每 0.5s 额外提升敌人温度 +${temp}`;
            }
            case 'lightning_shield': {
                const chance = Math.round(calc('triggerChance') * 100);
                const ratio = Math.round(calc('damageRatio') * 100);
                const stacks = calc('shockStacks');
                return `弹跳触发率 ${chance}%，静电场伤害 ${ratio}%，附加 ${stacks} 层闪电`;
            }
            case 'blade_storm': {
                const radius = calc('radius');
                const ratio = Math.round(calc('damageRatio') * 100);
                const interval = Math.max(0.1, calc('interval')).toFixed(1);
                return `范围 ${radius}px，剑光斩击伤害 ${ratio}%，间隔 ${interval}s`;
            }
            case 'elemental_fusion': {
                const ratio = Math.round(calc('trueDamageRatio') * 100);
                return `元素聚变爆炸，真实伤害 = 敌人最大血量 × ${ratio}%`;
            }
            default:
                return '';
        }
    },


    // ==================== 气泡提示：可以组成词条时弹出 ====================

    /**
     * 检测当前库存中是否可以组成任意词条，如可以则展示气泡提示
     * 应在每次获得新符文后调用（如 phase_claimPendingRunes 后）
     */
    _ui_checkRunewordBubble() {
        if (!this.runeInventory || this.runeInventory.length === 0) return;

        // 检测库存中是否有任意词条可以组成
        const emptyGrid = new Array(9).fill(null);
        let formableRunewords = [];

        // 对每个网格位置，尝试每个库存符文
        for (let cellIdx = 0; cellIdx < 9; cellIdx++) {
            for (const runeEntry of this.runeInventory) {
                const newWords = getNewRunewordsOnPlacement(emptyGrid, cellIdx, runeEntry, RUNEWORD_DB);
                newWords.forEach(rw => {
                    if (!formableRunewords.find(r => r.id === rw.id)) {
                        formableRunewords.push(rw);
                    }
                });
            }
        }

        if (formableRunewords.length === 0) {
            this._ui_hideRunewordBubble();
            return;
        }

        // 如果气泡已被手动关闭则不再展示
        if (this._runewordBubbleDismissed) return;

        this._ui_showRunewordBubble(formableRunewords);
    },

    /**
     * 展示词条气泡提示
     * @param {Array} formableRunewords - 可组成的词条列表
     * @private
     */
    _ui_showRunewordBubble(formableRunewords) {
        // 寻找所有符文发射器按鈕（可能在多个阶段）
        const launcherBtns = document.querySelectorAll('[onclick="game.ui_openRuneLauncher()"]');
        if (launcherBtns.length === 0) return;

        // 找到当前可见的按鈕
        let targetBtn = null;
        for (const btn of launcherBtns) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                targetBtn = btn;
                break;
            }
        }
        if (!targetBtn) return;

        // 移除旧气泡
        const existingBubble = document.getElementById('runeword-formable-bubble');
        if (existingBubble) existingBubble.remove();

        // 创建气泡元素
        const bubble = document.createElement('div');
        bubble.id = 'runeword-formable-bubble';
        const names = formableRunewords.slice(0, 2).map(rw => rw.name).join('、');
        const moreText = formableRunewords.length > 2 ? ` 等${formableRunewords.length}个` : '';
        bubble.innerHTML = `
            <div class="flex items-center gap-1.5">
                <span class="text-amber-300 text-sm animate-pulse">✨</span>
                <span class="text-xs font-bold text-amber-100">可组成词条！</span>
                <span class="text-[10px] text-amber-300/80">${names}${moreText}</span>
                <button id="runeword-bubble-close" class="ml-1 text-slate-400 hover:text-white text-xs leading-none">×</button>
            </div>
        `;
        bubble.style.cssText = [
            'position: fixed;',
            'z-index: 9000;',
            'background: linear-gradient(135deg, rgba(120,53,15,0.95), rgba(92,38,10,0.95));',
            'border: 1px solid rgba(245,158,11,0.6);',
            'border-radius: 20px;',
            'padding: 6px 12px;',
            'box-shadow: 0 0 16px rgba(245,158,11,0.4), 0 2px 8px rgba(0,0,0,0.6);',
            'pointer-events: auto;',
            'cursor: pointer;',
            'animation: runeword-bubble-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;',
        ].join(' ');

        // 定位到按鈕附近
        document.body.appendChild(bubble);
        const btnRect = targetBtn.getBoundingClientRect();
        bubble.style.bottom = (window.innerHeight - btnRect.top + 8) + 'px';
        bubble.style.right = (window.innerWidth - btnRect.right - 4) + 'px';

        // 点击气泡主体→打开发射器
        bubble.addEventListener('click', (e) => {
            if (e.target.id === 'runeword-bubble-close') return;
            this.ui_openRuneLauncher();
        });

        // 关闭按鈕
        const closeBtn = document.getElementById('runeword-bubble-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._runewordBubbleDismissed = true;
                bubble.style.animation = 'runeword-bubble-out 0.25s ease forwards';
                setTimeout(() => bubble.remove(), 260);
            });
        }

        // 注入动画 CSS（只注入一次）
        if (!document.getElementById('runeword-bubble-style')) {
            const style = document.createElement('style');
            style.id = 'runeword-bubble-style';
            style.textContent = `
                @keyframes runeword-bubble-in {
                    from { opacity: 0; transform: scale(0.7) translateY(10px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes runeword-bubble-out {
                    from { opacity: 1; transform: scale(1); }
                    to   { opacity: 0; transform: scale(0.7) translateY(6px); }
                }
            `;
            document.head.appendChild(style);
        }
    },

    /**
     * 隐藏词条气泡提示
     * @private
     */
    _ui_hideRunewordBubble() {
        const bubble = document.getElementById('runeword-formable-bubble');
        if (bubble) {
            bubble.style.animation = 'runeword-bubble-out 0.2s ease forwards';
            setTimeout(() => bubble.remove(), 220);
        }
    },


    // ==================== 一键快速排布 ====================

    /**
     * 一键快速排布：自动将库存中符文填入网格以触发最多词条
     * 算法：贪心策略 — 优先放置能触发新词条的符文
     */
    ui_autoArrangeRunes() {
        if (!this.runeInventory || this.runeInventory.length === 0) {
            showToast('库存中没有符文');
            return;
        }

        // 将当前网格中的符文全部放回库存
        for (let i = 0; i < 9; i++) {
            if (this.runeGrid[i]) {
                this.runeInventory.push(this.runeGrid[i]);
                this.runeGrid[i] = null;
            }
        }

        // 贪心排布：每次选择能触发最多新词条的（符文，格子）组合
        const MAX_CELLS = 9;
        let placed = 0;

        while (placed < MAX_CELLS && this.runeInventory.length > 0) {
            let bestScore = -1;
            let bestRuneIdx = -1;
            let bestCellIdx = -1;

            for (let cellIdx = 0; cellIdx < MAX_CELLS; cellIdx++) {
                if (this.runeGrid[cellIdx]) continue; // 已占用
                for (let runeIdx = 0; runeIdx < this.runeInventory.length; runeIdx++) {
                    const newWords = getNewRunewordsOnPlacement(
                        this.runeGrid, cellIdx, this.runeInventory[runeIdx], RUNEWORD_DB
                    );
                    const score = newWords.length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestRuneIdx = runeIdx;
                        bestCellIdx = cellIdx;
                    }
                }
            }

            if (bestRuneIdx === -1) break; // 没有可放置的格子

            // 如果没有任何词条可触发，就只填入第一个符文到第一个空格
            if (bestScore === 0) {
                // 找第一个空格和第一个符文
                const firstEmpty = this.runeGrid.findIndex(c => !c);
                if (firstEmpty === -1) break;
                this.runeGrid[firstEmpty] = this.runeInventory.splice(0, 1)[0];
            } else {
                this.runeGrid[bestCellIdx] = this.runeInventory.splice(bestRuneIdx, 1)[0];
            }
            placed++;
        }

        this.ui_updateRuneGrid();
        showToast('✨ 已自动排布符文');
        audio.playTone(660, 'sine', 0.1, 0.3);
    },


    // ==================== 引导式教学 ====================

    /**
     * 展示符文发射器内部引导教学
     * 首次打开发射器时自动调用，也可通过帮助按鈕手动触发
     */
    ui_showRuneLauncherTour() {
        // 如果发射器面板不在显示状态则不展示
        const panel = document.getElementById('phase-rune-launcher');
        if (!panel || panel.style.display === 'none') return;

        // 移除旧教学层
        const existingTour = document.getElementById('rune-launcher-tour-overlay');
        if (existingTour) existingTour.remove();

        const tourSteps = [
            {
                targetId: 'rune-grid-container',
                title: '① 符文网格',
                desc: '将库存中的符文拖入这里。特定符文组合可触发强力「词条」！',
                position: 'bottom',
            },
            {
                targetId: 'rune-inventory-container',
                title: '② 符文库存',
                desc: '你拥有的所有符文在这里。点击符文可选中，选中 3 个可进行合成或重铸。',
                position: 'top',
            },
            {
                targetId: 'rune-merge-btn',
                title: '③ 合成炉',
                desc: '选中 3 个相同 ID 且相同等级的符文，合成为更高等级的同类符文。',
                position: 'top',
            },
            {
                targetId: 'rune-reforge-btn',
                title: '④ 重铸炉',
                desc: '选中任意 3 个符文消耗，随机获得一个全新符文。当库存符文不理想时可用。',
                position: 'top',
            },
            {
                targetId: 'rune-active-runewords',
                title: '⑤ 已激活词条',
                desc: '当网格中符文组合匹配词条时，词条将在这里展示并生效。',
                position: 'top',
            },
        ];

        // 创建教学层容器（不阔读背景，只展示高亮提示）
        const overlay = document.createElement('div');
        overlay.id = 'rune-launcher-tour-overlay';
        overlay.style.cssText = [
            'position: absolute;',
            'inset: 0;',
            'z-index: 500;',
            'pointer-events: none;',
        ].join(' ');
        panel.style.position = 'relative';
        panel.appendChild(overlay);

        let currentStep = 0;

        const showStep = (stepIdx) => {
            // 清除当前提示卡
            overlay.innerHTML = '';

            if (stepIdx >= tourSteps.length) {
                // 教学完成
                overlay.remove();
                if (this.saveData) this.saveData.runeLauncherTourDone = true;
                if (this.saveGame) this.saveGame();
                return;
            }

            const step = tourSteps[stepIdx];
            const targetEl = document.getElementById(step.targetId);
            if (!targetEl) {
                // 目标元素不存在，跳过
                showStep(stepIdx + 1);
                return;
            }

            // 计算目标元素相对于 panel 的位置
            const panelRect = panel.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const relTop = targetRect.top - panelRect.top;
            const relLeft = targetRect.left - panelRect.left;

            // 创建高亮边框
            const highlight = document.createElement('div');
            highlight.style.cssText = [
                'position: absolute;',
                `top: ${relTop - 4}px;`,
                `left: ${relLeft - 4}px;`,
                `width: ${targetRect.width + 8}px;`,
                `height: ${targetRect.height + 8}px;`,
                'border: 2px solid rgba(245,158,11,0.8);',
                'border-radius: 12px;',
                'box-shadow: 0 0 0 2000px rgba(0,0,0,0.45);',
                'pointer-events: none;',
                'animation: tour-highlight-pulse 1.5s ease-in-out infinite;',
            ].join(' ');
            overlay.appendChild(highlight);

            // 创建提示卡
            const card = document.createElement('div');
            card.style.cssText = [
                'position: absolute;',
                'pointer-events: auto;',
                'background: linear-gradient(135deg, rgba(15,23,42,0.97), rgba(30,27,75,0.97));',
                'border: 1px solid rgba(245,158,11,0.5);',
                'border-radius: 14px;',
                'padding: 12px 14px;',
                'width: 220px;',
                'box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(245,158,11,0.2);',
                'z-index: 10;',
            ].join(' ');

            // 卡片定位
            const cardTop = step.position === 'bottom'
                ? relTop + targetRect.height + 12
                : relTop - 120;
            const cardLeft = Math.max(4, Math.min(relLeft, panelRect.width - 230));
            card.style.top = `${cardTop}px`;
            card.style.left = `${cardLeft}px`;

            card.innerHTML = `
                <div class="text-xs font-bold text-amber-300 mb-1">${step.title}</div>
                <div class="text-[11px] text-slate-300 leading-relaxed mb-3">${step.desc}</div>
                <div class="flex items-center justify-between">
                    <span class="text-[10px] text-slate-500">${stepIdx + 1} / ${tourSteps.length}</span>
                    <div class="flex gap-2">
                        ${stepIdx > 0 ? `<button id="tour-skip-btn" style="font-size:10px;color:#94a3b8;background:none;border:none;cursor:pointer;">跳过</button>` : ''}
                        <button id="tour-next-btn" style="font-size:11px;font-weight:bold;color:#fef3c7;background:rgba(120,53,15,0.8);border:1px solid rgba(245,158,11,0.5);border-radius:8px;padding:4px 10px;cursor:pointer;">${stepIdx < tourSteps.length - 1 ? '下一步 →' : '知道了 ✓'}</button>
                    </div>
                </div>
            `;
            overlay.appendChild(card);

            // 事件绑定
            const nextBtn = document.getElementById('tour-next-btn');
            if (nextBtn) nextBtn.addEventListener('click', () => showStep(stepIdx + 1));

            const skipBtn = document.getElementById('tour-skip-btn');
            if (skipBtn) skipBtn.addEventListener('click', () => showStep(tourSteps.length));
        };

        // 注入动画 CSS
        if (!document.getElementById('rune-tour-style')) {
            const style = document.createElement('style');
            style.id = 'rune-tour-style';
            style.textContent = `
                @keyframes tour-highlight-pulse {
                    0%, 100% { box-shadow: 0 0 0 2000px rgba(0,0,0,0.45), 0 0 8px rgba(245,158,11,0.4); }
                    50%       { box-shadow: 0 0 0 2000px rgba(0,0,0,0.55), 0 0 16px rgba(245,158,11,0.8); }
                }
            `;
            document.head.appendChild(style);
        }

        showStep(0);
    },


};

// 暴露到全局，供向后兼容
window.rune_launcher_system = rune_launcher_system;
