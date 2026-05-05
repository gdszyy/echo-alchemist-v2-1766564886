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
import { getRuneIconSrc } from '../bitmap_icons.js'; // [Phase 5A Task 5.A6] 位图符文图标

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

    // [Phase 5A Task 5.A6] 位图符文图标：优先使用 48×48 位图，fallback 到 emoji
    const bitmapSrc = runeDef ? getRuneIconSrc(runeDef.id) : null;
    const iconContent = bitmapSrc
        ? `<img src="${bitmapSrc}" alt="${icon}" style="width:80%;height:80%;object-fit:contain;display:block;margin:auto;" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"><span style="display:none;">${icon}</span>`
        : icon;

    return `<span class="rune-icon-frame ${rarityClass} ${lvClass}${extraClass ? ' ' + extraClass : ''}">${iconContent}<span class="rune-lv-badge">${lvLabel}</span></span>`;
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
        // [DEBUG-LOG] 每次点击时记录 phase-rune-launcher 面板的完整状态快照
        {
            const _rect = panel ? panel.getBoundingClientRect() : null;
            const _cs   = panel ? window.getComputedStyle(panel) : null;
            console.group('[ui_openRuneLauncher] ▶ 符文发射器打开 — 状态快照');
            console.log('  game.phase         =', this.phase);
            console.log('  isPCMode           =', isPCMode);
            console.log('  panel 存在         =', !!panel);
            if (panel) {
                console.log('  panel.style.display=', panel.style.display);
                console.log('  computed display   =', _cs.display);
                console.log('  computed visibility=', _cs.visibility);
                console.log('  computed opacity   =', _cs.opacity);
                console.log('  computed z-index   =', _cs.zIndex);
                console.log('  classList          =', [...panel.classList].join(' '));
                console.log('  dataset            =', JSON.stringify(panel.dataset));
                console.log('  BoundingRect       =', _rect
                    ? `top:${_rect.top.toFixed(1)} left:${_rect.left.toFixed(1)} width:${_rect.width.toFixed(1)} height:${_rect.height.toFixed(1)}`
                    : 'N/A');
                console.log('  parentElement      =', panel.parentElement ? panel.parentElement.id || panel.parentElement.tagName : 'null');
            }
            console.log('  调用栈             =', new Error().stack.split('\n').slice(1, 4).join(' | '));
            console.groupEnd();
        }

        if (panel) {
            if (isPCMode) {
                // PC 模式：面板已常驻在右侧边栏，不需要修改 display
                // 仅刷新内容即可
            } else {
                // 移动端模式：弹出全屏覆盖层
                panel.style.display = 'flex';
                // [BUGFIX] ui_updateUI 在隐藏所有 .ui-overlay 时会将 pointer-events 设为 none（内联样式）。
                // 打开面板时必须显式恢复为 auto，否则面板内所有按钮和 Tab 均无法点击。
                panel.style.pointerEvents = 'auto';
                // [BUGFIX 第二道防线] 在面板上拦截 touchmove 事件，防止触摸滑动穿透到底层 Canvas。
                // 使用 capture 阶段监听，确保在任何子元素处理之前先执行拦截。
                // 仅在首次打开时绑定一次（通过 dataset 标记防止重复绑定）。
                if (!panel._touchMoveGuardBound) {
                    panel.addEventListener('touchmove', (e) => {
                        // 允许面板内部的滚动容器正常滚动（overflow-y: auto 的元素）
                        // 但阻止事件冒泡到 window，防止被 canvas 的 touchmove 处理器捕获
                        e.stopPropagation();
                    }, { passive: true, capture: true });
                    panel._touchMoveGuardBound = true;
                }
            }
        }
        // [BUGFIX] 符文发射器面板打开时，临时隐藏教程卡片和遮罩层，防止其以 z-index:9000+ 遮挡面板内的 Tab 按钮
        // 关闭面板时（ui_closeRuneLauncher）会恢复显示
        if (this._tutorialActive) {
            const tutCard = document.getElementById('tutorial-card');
            if (tutCard) tutCard.style.display = 'none';
            const tutOverlay = document.getElementById('tutorial-overlay');
            if (tutOverlay) tutOverlay.style.display = 'none';
            const tutHighlight = document.getElementById('tutorial-highlight');
            if (tutHighlight) tutHighlight.style.display = 'none';
        }
        // [BUGFIX] 确保 picker 蒙层在打开时是关闭状态（防止上次残留）
        const pickerOverlay = document.getElementById('rune-picker-overlay');
        if (pickerOverlay) pickerOverlay.classList.add('hidden');
        // [BUGFIX] 每次打开发射器时重置到「发射器」Tab，防止上次切换到「词条图鉴」Tab 后
        // #rune-launcher-content 仍带有 hidden 类，导致 3x3 Grid 不可见
        this.ui_switchRuneTab('launcher');
        // 初始化发射器内符文碎片计数显示
        this._ui_updateLauncherShardCount();
        this.ui_initRuneGrid();
        this.ui_updateRuneGrid();
        // 关闭气泡提示（玩家已进入发射器）
        this._ui_hideRunewordBubble();
        // 首次打开时显示内部引导教学（移动端不影响 PC 端常驻）
        // [ARCHIVED] 教程功能暂时禁用，如需恢复请取消下方注释
        // if (!isPCMode && this.saveData && !this.saveData.runeLauncherTourDone) {
        //     setTimeout(() => this.ui_showRuneLauncherTour(), 400);
        // }
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
        if (tourOverlay) {
            tourOverlay.remove();
            // [BUGFIX] 教学期间临时将 panel.overflow 设为 hidden，关闭时需恢复，防止用户未完成教学直接关闭面板时溢出效果残留
            const panel2 = document.getElementById('phase-rune-launcher');
            if (panel2) panel2.style.overflow = '';
        }
         this._pendingRuneGridIndex = null;
         this._pendingPlacementRuneIdx = null;
        // [BUGFIX] 关闭符文发射器面板时，恢复教程卡片和遮罩层的显示（与 ui_openRuneLauncher 中的隐藏操作对应）
        if (this._tutorialActive) {
            const tutCard = document.getElementById('tutorial-card');
            if (tutCard) tutCard.style.display = 'block';
            const tutOverlay = document.getElementById('tutorial-overlay');
            if (tutOverlay) tutOverlay.style.display = 'block';
            // 高亮框的显示状态由 _tutorial_updateHighlight 控制，此处不强制恢复，避免覆盖 noOverlay 步骤的隐藏逻辑
        }
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
            cell.dataset.state = 'idle'; // [bitmap-rune-grid] CSS 用 [data-state] 切换 idle/hover/filled 位图
            cell.className = [
                'rune-grid-cell',
                'w-16 h-16 flex items-center justify-center',
                'cursor-pointer select-none',
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
                    // @section:rune_grid_remove_audio - 符文格移除音效（400Hz，轻柔确认）
                    audio.playTone(400, 'sine', 0.08, 0.15);
                } else if (this._pendingPlacementRuneIdx != null) {
                    // 空格 + 已选中库存符文：直接放置
                    const pIdx = this._pendingPlacementRuneIdx;
                    const pEntry = this.runeInventory[pIdx];
                    if (pEntry) {
                        this.runeInventory.splice(pIdx, 1);
                        this.runeGrid[i] = pEntry;
                        this._pendingPlacementRuneIdx = null;
                        this.ui_updateRuneGrid();
                        audio.playTone(600, 'sine', 0.1, 0.2);
                    } else {
                        this._pendingPlacementRuneIdx = null;
                    }
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
        // 打开 picker 时取消「待放置」状态，避免索引错位
        this._pendingPlacementRuneIdx = null;

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
                // @section:rune_picker_place_audio - 符文从选择器放入格子的确认音效（600Hz）
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
                // @section:rune_hover_audio - 符文词条悬停预览音效（880Hz 极轻，仅提示）
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
            const prevState = cell.dataset.state || 'idle';
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
                cell.dataset.state = 'filled';
                // [bitmap-rune-grid] 从空→填的转换触发一次性 highlight 光圈动画
                if (prevState !== 'filled') {
                    cell.classList.remove('rune-slot-place');
                    // 强制 reflow 以重启动画
                    void cell.offsetWidth;
                    cell.classList.add('rune-slot-place');
                }
            } else {
                cell.innerHTML = '';
                cell.dataset.state = 'idle';
                cell.classList.remove('rune-slot-place');
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
            // [bitmap-rune-grid] 用 data-active 而非 Tailwind 类标记激活态，CSS 控制视觉
            if (activatedCells.has(i)) {
                cell.dataset.active = '1';
            } else {
                delete cell.dataset.active;
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

        // 6.6 更新属性共鸣状态显示
        this._ui_updateResonanceDisplay();

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
        // 初始化选中状态
        if (!this._selectedRuneIndices) this._selectedRuneIndices = new Set();
        // 校验 _selectedRuneIndices 中的索引仍在范围内
        const len = this.runeInventory ? this.runeInventory.length : 0;
        for (const idx of Array.from(this._selectedRuneIndices)) {
            if (idx >= len) this._selectedRuneIndices.delete(idx);
        }
        // 校验 pending 放置索引
        if (this._pendingPlacementRuneIdx != null && this._pendingPlacementRuneIdx >= len) {
            this._pendingPlacementRuneIdx = null;
        }

        this._ui_renderLauncherInventory();
        this._ui_renderManagementInventory();
        this._ui_updateRuneActionButtons();
    },


    /**
     * 渲染发射器（配置 Tab）的符文库存
     * 点击行为：选中符文进入「待放置」模式，再点 3×3 空格即放置
     * @private
     */
    _ui_renderLauncherInventory() {
        const container = document.getElementById('rune-inventory-container');
        const countEl = document.getElementById('rune-inventory-count');
        const emptyEl = document.getElementById('rune-inventory-empty');
        const hintEl = document.getElementById('rune-placement-hint');
        if (!container) return;

        Array.from(container.children).forEach(child => {
            if (child.id !== 'rune-inventory-empty') child.remove();
        });

        if (countEl) countEl.textContent = `(${this.runeInventory.length})`;

        if (!this.runeInventory || this.runeInventory.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            if (hintEl) {
                hintEl.textContent = '點擊符文選中，再點空格放置';
                hintEl.className = 'text-xs text-slate-500';
            }
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        // 更新提示
        if (hintEl) {
            if (this._pendingPlacementRuneIdx != null) {
                const pe = this.runeInventory[this._pendingPlacementRuneIdx];
                const pid = getRuneId(pe);
                const pdef = RUNE_DB.find(r => r.id === pid);
                hintEl.textContent = pdef ? `已選中 ${pdef.name}，請點擊 3×3 空格放置` : '已選中符文，請點擊 3×3 空格放置';
                hintEl.className = 'text-xs text-amber-300 font-bold';
            } else {
                hintEl.textContent = '點擊符文選中，再點空格放置';
                hintEl.className = 'text-xs text-slate-500';
            }
        }

        this.runeInventory.forEach((runeEntry, idx) => {
            const runeId = getRuneId(runeEntry);
            if (!runeId) return;
            const runeDef = RUNE_DB.find(r => r.id === runeId);
            if (!runeDef) return;
            const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;
            const isPending = this._pendingPlacementRuneIdx === idx;

            const card = document.createElement('div');
            card.className = [
                'flex items-center gap-2 p-2 rounded-xl cursor-pointer select-none transition-all duration-150',
                isPending
                    ? 'bg-amber-700/30 border-2 border-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                    : 'bg-slate-800/60 border-2 border-slate-700/40 hover:border-amber-500/50',
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
                ${isPending ? '<span class="text-amber-300 text-sm shrink-0">→</span>' : ''}
            `;
            card.addEventListener('click', () => {
                if (this._pendingPlacementRuneIdx === idx) {
                    this._pendingPlacementRuneIdx = null;
                } else {
                    this._pendingPlacementRuneIdx = idx;
                }
                this._ui_renderLauncherInventory();
                try { audio.playTone(700, 'sine', 0.06, 0.08); } catch(e) {}
            });
            container.appendChild(card);
        });
    },


    /**
     * 渲染管理 Tab 的符文仓库（带多选用于熔炼/重铸）
     * @private
     */
    _ui_renderManagementInventory() {
        const container = document.getElementById('rune-management-inventory');
        const countEl = document.getElementById('rune-management-inventory-count');
        const emptyEl = document.getElementById('rune-management-inventory-empty');
        if (!container) return;

        Array.from(container.children).forEach(child => {
            if (child.id !== 'rune-management-inventory-empty') child.remove();
        });

        if (countEl) countEl.textContent = `(${this.runeInventory.length})`;

        if (!this.runeInventory || this.runeInventory.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            this._selectedRuneIndices.clear();
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        this.runeInventory.forEach((runeEntry, idx) => {
            const runeId = getRuneId(runeEntry);
            if (!runeId) return;
            const runeDef = RUNE_DB.find(r => r.id === runeId);
            if (!runeDef) return;
            const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;
            const isSelected = this._selectedRuneIndices.has(idx);

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
                if (this._selectedRuneIndices.has(idx)) {
                    this._selectedRuneIndices.delete(idx);
                } else {
                    if (this._selectedRuneIndices.size >= 3) {
                        if (window.showToast) showToast('最多選中 3 個符文');
                        return;
                    }
                    this._selectedRuneIndices.add(idx);
                }
                this._ui_renderManagementInventory();
                this._ui_updateRuneActionButtons();
            });
            container.appendChild(card);
        });
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
                'cursor-pointer hover:bg-purple-900/40 hover:border-purple-500/60 transition-all duration-150',
            ].join(' ');
            card.title = '點擊查看詞條詳細效果';
            card.onclick = () => {
                if (typeof this.ui_showRunewordDetail === 'function') {
                    this.ui_showRunewordDetail(rw.id || rw.effectId, rw.level || 1);
                }
            };
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
     * 更新属性共鸣状态显示
     * 基于 this.activeElementResonances 渲染当前已激活的共鸣阶段卡片
     * @private
     */
    _ui_updateResonanceDisplay() {
        const summary = document.getElementById('rune-resonance-summary');
        const list    = document.getElementById('rune-resonance-list');
        if (!summary || !list) return;

        const resonances = this.activeElementResonances || {};
        const entries = Object.entries(resonances);

        if (entries.length === 0) {
            summary.classList.add('hidden');
            return;
        }
        summary.classList.remove('hidden');
        list.innerHTML = '';

        // 属性对应的渐变色配置（背景、边框、标题、进度条颜色）
        const ELEMENT_COLORS = {
            pyro:      { bg: 'bg-red-900/30',    border: 'border-red-600/50',    text: 'text-red-200',    bar: 'bg-red-500',    label: 'text-red-300' },
            cryo:      { bg: 'bg-cyan-900/30',   border: 'border-cyan-600/50',   text: 'text-cyan-200',   bar: 'bg-cyan-400',   label: 'text-cyan-300' },
            lightning: { bg: 'bg-yellow-900/30', border: 'border-yellow-600/50', text: 'text-yellow-200', bar: 'bg-yellow-400', label: 'text-yellow-300' },
            bounce:    { bg: 'bg-green-900/30',  border: 'border-green-600/50',  text: 'text-green-200',  bar: 'bg-green-500',  label: 'text-green-300' },
            pierce:    { bg: 'bg-blue-900/30',   border: 'border-blue-600/50',   text: 'text-blue-200',   bar: 'bg-blue-400',   label: 'text-blue-300' },
            scatter:   { bg: 'bg-pink-900/30',   border: 'border-pink-600/50',   text: 'text-pink-200',   bar: 'bg-pink-400',   label: 'text-pink-300' },
            laser:     { bg: 'bg-orange-900/30', border: 'border-orange-600/50', text: 'text-orange-200', bar: 'bg-orange-400', label: 'text-orange-300' },
        };

        // 阶段对应的展示文字
        const TIER_LABELS = { 3: '一阶', 6: '二阶', 9: '三阶' };

        entries.forEach(([element, res]) => {
            const c = ELEMENT_COLORS[element] || ELEMENT_COLORS.pyro;
            const statInfo = STAT_DISPLAY[element] || { name: element, icon: '' };
            const tierLabel = TIER_LABELS[res.threshold] || `${res.threshold}层`;

            // 计算进度条：当前层数 / 下一阶阈値（三阶已满则显示满格）
            const nextThreshold = res.threshold === 9 ? 9 : res.threshold + 3;
            const progressPct = res.threshold === 9
                ? 100
                : Math.min(100, Math.round((res.statCount / nextThreshold) * 100));

            const card = document.createElement('div');
            card.className = [
                'p-3 rounded-xl border',
                c.bg, c.border,
            ].join(' ');

            card.innerHTML = `
                <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1.5">
                        <span class="text-base">${statInfo.icon}</span>
                        <span class="text-xs font-bold ${c.text}">${statInfo.name}共鸣</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 ${c.label} font-bold">${tierLabel}</span>
                    </div>
                    <span class="text-[10px] ${c.label} font-bold">${res.statCount}层${res.threshold < 9 ? ` / ${nextThreshold}` : ' 满格'}</span>
                </div>
                <div class="text-[10px] text-slate-300/80 mb-2 leading-relaxed">${res.desc}</div>
                <div class="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
                    <div class="h-full ${c.bar} rounded-full transition-all duration-500" style="width: ${progressPct}%"></div>
                </div>
            `;
            list.appendChild(card);
        });
    },

    /**
     * 更新合成/重铸按鈕状态
     * @private
     */
    _ui_updateRuneActionButtons() {
        if (!this._selectedRuneIndices) this._selectedRuneIndices = new Set();  // [Mixin 正常用法：读取 Game 实例状态]
        const selectedCount = this._selectedRuneIndices.size;  // [Mixin 正常用法：读取 Game 实例状态]

        // 同步管理页选中计数
        const mgCountEl = document.getElementById('rune-management-selected-count');
        if (mgCountEl) {
            mgCountEl.textContent = `${selectedCount} / 3`;
            mgCountEl.style.color = selectedCount > 0 ? '#c4b5fd' : '#64748b';
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
            // @section:rune_merge_audio - 符文合成成功音效（880Hz 较响，强调成功感）
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
            // @section:rune_reforge_audio - 符文重铸完成音效（660Hz triangle，柔和质感）
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
        const managementPanel = document.getElementById('rune-management-panel');
        const codexPanel = document.getElementById('rune-codex-panel');
        const tabLauncher = document.getElementById('rune-tab-launcher');
        const tabManagement = document.getElementById('rune-tab-management');
        const tabCodex = document.getElementById('rune-tab-codex');
        if (!launcherContent || !codexPanel) return;

        const activeClass = ['bg-purple-700/60', 'text-purple-100', 'border-purple-500/60'];
        const inactiveClass = ['bg-slate-800/60', 'text-slate-400', 'border-slate-700/40'];

        const setActive = (btn, on) => {
            if (!btn) return;
            if (on) { btn.classList.add(...activeClass); btn.classList.remove(...inactiveClass); }
            else    { btn.classList.remove(...activeClass); btn.classList.add(...inactiveClass); }
        };

        // 默认隐藏全部内容
        launcherContent.classList.add('hidden');
        if (managementPanel) managementPanel.classList.add('hidden');
        codexPanel.classList.add('hidden');

        if (tab === 'launcher') {
            launcherContent.classList.remove('hidden');
            setActive(tabLauncher, true);
            setActive(tabManagement, false);
            setActive(tabCodex, false);
        } else if (tab === 'management') {
            if (managementPanel) managementPanel.classList.remove('hidden');
            setActive(tabLauncher, false);
            setActive(tabManagement, true);
            setActive(tabCodex, false);
            // 更新管理页选中计数
            if (typeof this._ui_updateRuneActionButtons === 'function') this._ui_updateRuneActionButtons();
            const sel = document.getElementById('rune-management-selected-count');
            if (sel) {
                const c = this._selectedRuneIndices ? this._selectedRuneIndices.size : 0;
                sel.textContent = `${c} / 3`;
            }
        } else {
            codexPanel.classList.remove('hidden');
            setActive(tabLauncher, false);
            setActive(tabManagement, false);
            setActive(tabCodex, true);
            this.ui_renderRuneCodex();
        }
    },


    /**
     * ui_showRunewordDetail - 弹出词条详细效果浮层
     * @param {string} runewordId
     * @param {number} [level=1]
     */
    ui_showRunewordDetail(runewordId, level = 1) {
        const rw = RUNEWORD_DB.find(r => r.id === runewordId);
        if (!rw) return;
        let overlay = document.getElementById('runeword-detail-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'runeword-detail-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:600;display:flex;align-items:center;justify-content:center;padding:16px;';
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            document.body.appendChild(overlay);
        } else {
            overlay.innerHTML = '';
            overlay.style.display = 'flex';
        }

        const patternIcons = rw.pattern.map(rid => {
            const rd = RUNE_DB.find(r => r.id === rid);
            return rd ? `<span title="${rd.name}">${_ui_buildRuneIconHTML(rd, 1)}</span>` : '?';
        }).join('<span style="color:#64748b;margin:0 2px;">→</span>');

        const dynamicDesc = (typeof this._ui_calcRunewordDynamicDesc === 'function')
            ? this._ui_calcRunewordDynamicDesc(rw, level) : '';

        const tabs = [1, 2, 3].map(lv => {
            const active = lv === level;
            return `<button data-lv="${lv}" style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;border:1px solid ${active ? '#fbbf24' : '#475569'};background:${active ? 'rgba(251,191,36,0.25)' : 'rgba(30,41,59,0.6)'};color:${active ? '#fde68a' : '#94a3b8'};">Lv.${lv}</button>`;
        }).join('');

        const card = document.createElement('div');
        card.style.cssText = 'max-width:380px;width:100%;background:#0f172a;border:1px solid rgba(168,85,247,0.5);border-radius:14px;padding:18px;box-shadow:0 0 40px rgba(168,85,247,0.3);';
        card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:22px;">✨</span>
                    <span style="font-size:16px;font-weight:bold;color:#e9d5ff;">${rw.name}</span>
                    <span style="font-size:10px;color:#94a3b8;background:rgba(30,41,59,0.7);padding:2px 6px;border-radius:4px;">${rw.effect_desc.match(/【(.+?)】/)?.[1] || ''}</span>
                </div>
                <button id="runeword-detail-close" style="width:28px;height:28px;border-radius:50%;background:#1e293b;color:#cbd5e1;border:1px solid #334155;cursor:pointer;font-size:14px;">✕</button>
            </div>
            <div style="font-size:11px;color:#cbd5e1;margin-bottom:8px;">符文組合：<span style="font-size:16px;">${patternIcons}</span></div>
            <div style="font-size:12px;color:#e2e8f0;line-height:1.6;margin-bottom:10px;">${rw.effect_desc}</div>
            <div id="runeword-detail-dynamic" style="font-size:12px;color:#34d399;font-weight:bold;min-height:18px;margin-bottom:12px;">${dynamicDesc}</div>
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;color:#94a3b8;">等級：</span>
                <div id="runeword-detail-tabs" style="display:flex;gap:6px;">${tabs}</div>
            </div>
        `;
        overlay.appendChild(card);

        card.querySelector('#runeword-detail-close').onclick = () => overlay.remove();
        card.querySelectorAll('#runeword-detail-tabs button').forEach(btn => {
            btn.onclick = () => {
                const lv = parseInt(btn.dataset.lv, 10);
                this.ui_showRunewordDetail(runewordId, lv);
            };
        });
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

        // 渲染按符文筛选条
        this._ui_renderCodexFilterBar();

        // 应用筛选
        const filterRune = this._codexRuneFilter || null;
        const filteredDB = filterRune
            ? RUNEWORD_DB.filter(rw => rw.pattern && rw.pattern.includes(filterRune))
            : RUNEWORD_DB;

        list.innerHTML = '';

        if (filteredDB.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-center text-slate-500 text-xs py-6';
            empty.textContent = '此符文暫無相關詞條';
            list.appendChild(empty);
            return;
        }

        filteredDB.forEach(rw => {
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
     * 渲染图鉴的「按符文筛选」条
     * 列出 RUNEWORD_DB pattern 中出现过的所有符文，每个一个芯片可切换筛选
     * @private
     */
    _ui_renderCodexFilterBar() {
        const bar = document.getElementById('rune-codex-filter-bar');
        if (!bar) return;
        bar.innerHTML = '';

        // 收集所有出现在词条 pattern 中的符文 id（去重，按 RUNE_DB 顺序）
        const usedIds = new Set();
        RUNEWORD_DB.forEach(rw => (rw.pattern || []).forEach(rid => usedIds.add(rid)));
        const orderedIds = RUNE_DB.filter(r => usedIds.has(r.id)).map(r => r.id);

        const current = this._codexRuneFilter || null;

        const makeChip = (label, runeId, iconHTML) => {
            const isActive = current === runeId;
            const btn = document.createElement('button');
            btn.className = [
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all duration-150 border',
                isActive
                    ? 'bg-amber-600/70 text-amber-100 border-amber-400/60'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/40 hover:bg-slate-700/60 hover:text-slate-200',
            ].join(' ');
            btn.innerHTML = (iconHTML ? iconHTML + ' ' : '') + `<span>${label}</span>`;
            btn.onclick = () => {
                this._codexRuneFilter = runeId;
                this.ui_renderRuneCodex();
            };
            return btn;
        };

        bar.appendChild(makeChip('全部', null, ''));
        orderedIds.forEach(rid => {
            const rd = RUNE_DB.find(r => r.id === rid);
            if (!rd) return;
            bar.appendChild(makeChip(rd.name, rid, _ui_buildRuneIconHTML(rd, 1)));
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
                return `每弹跳 ${bounces} 次释放冰霜新星，范围 ${radius}px，冰伤害 ${ratio}%，降温 ${tempDrop}；被命中敌人按当前冻结概率链式触发新星（每次链式概率减半）`;
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
                const radius = Math.round(calc('radius') || 110);
                return `子母剑穿透触发率 ${chance}%，剑光 AOE 范围 ${radius}px，伤害 ${ratio}%，附加升温 ${tempRatio}%`;
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
                return `弹跳触发率 ${chance}%，静电场伤害 ${ratio}%，附加 ${stacks} 层闪电；被静电场击中后必定触发闪电链`;
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
            case 'focused_fire': {
                const chance = Math.round(calc('critChance') * 100);
                const dmg = Math.round(calc('critDamage') * 100);
                return `所有弹跳/连射层数转化为基础伤害；${chance}% 暴击率，造成 ${dmg}% 伤害`;
            }
            case 'mass_collapse': {
                const baseRatio = Math.round(calc('baseRadiusRatio') * 100);
                const perLayer = Math.round(calc('radiusBonusPerLayer') * 100);
                return `强制爆炸（基础范围 ${baseRatio}%）；清空所有散射，每清空 1 层散射爆炸范围 +${perLayer}%`;
            }
            case 'son_sword_summon': {
                const chance = Math.round(calc('triggerChance') * 100);
                const lv = calc('swordLevel') || 3;
                const dmgBonus = Math.round((calc('damageMultiplier') - 1) * 100);
                return `命中触发率 ${chance}%，召唤一把 Lv${lv} 子飞剑（伤害继承 ${100 + dmgBonus}%）`;
            }
            case 'bullet_to_sword': {
                const lv = calc('swordLevel') || 1;
                const cap = Math.min(3, Math.max(1, lv));
                return `首轮发射的子弹替换为 Lv${cap} 子飞剑（取消连射），原连射层数转为子飞剑攻击次数`;
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
        // @section:rune_auto_arrange_audio - 符文自动排布完成音效（660Hz sine）
        audio.playTone(660, 'sine', 0.1, 0.3);
    },


    // ==================== 引导式教学（暂时归档，如需恢复请取消注释） ====================

    /*
     * [ARCHIVED] ui_showRuneLauncherTour
     * 展示符文发射器内部引导教学
     * 首次打开发射器时自动调用，也可通过帮助按鈕手动触发
     */
    // ui_showRuneLauncherTour() {
        // 如果发射器面板不在显示状态则不展示
        // const panel = document.getElementById('phase-rune-launcher');
        // if (!panel || panel.style.display === 'none') return;

//         // 移除旧教学层
        // const existingTour = document.getElementById('rune-launcher-tour-overlay');
        // if (existingTour) existingTour.remove();

//         // const tourSteps = [
            // {
                // targetId: 'rune-grid-container',
                // title: '① 符文网格',
                // desc: '将库存中的符文拖入这里。特定符文组合可触发强力「词条」！',
                // position: 'bottom',
            // },
            // {
                // targetId: 'rune-inventory-container',
                // title: '② 符文库存',
                // desc: '你拥有的所有符文在这里。点击符文可选中，选中 3 个可进行合成或重铸。',
                // position: 'top',
            // },
            // {
                // targetId: 'rune-merge-btn',
                // title: '③ 合成炉',
                // desc: '选中 3 个相同 ID 且相同等级的符文，合成为更高等级的同类符文。',
                // position: 'top',
            // },
            // {
                // targetId: 'rune-reforge-btn',
                // title: '④ 重铸炉',
                // desc: '选中任意 3 个符文消耗，随机获得一个全新符文。当库存符文不理想时可用。',
                // position: 'top',
            // },
            // {
                // targetId: 'rune-active-runewords',
                // title: '⑤ 已激活词条',
                // desc: '当网格中符文组合匹配词条时，词条将在这里展示并生效。',
                // position: 'top',
            // },
        // ];

//         // 创建教学层容器（不阔读背景，只展示高亮提示）
        // const overlay = document.createElement('div');
        // overlay.id = 'rune-launcher-tour-overlay';
        // overlay.style.cssText = [
            // 'position: absolute;',
            // 'inset: 0;',
            // 'z-index: 500;',
            // 'pointer-events: none;',
        // ].join(' ');
        // panel.style.position = 'relative';
        // [BUGFIX] 防止 highlight 的超大 box-shadow (2000px) 溢出 panel 边界，在屏幕外形成常驻黑色蒙版
        // const _prevOverflow = panel.style.overflow;
        // panel.style.overflow = 'hidden';
        // panel.appendChild(overlay);

//         // let currentStep = 0;

//         // const showStep = (stepIdx) => {
            // 清除当前提示卡
            // overlay.innerHTML = '';

//             // if (stepIdx >= tourSteps.length) {
                // 教学完成
                // overlay.remove();
                // [BUGFIX] 恢复 panel 的 overflow 属性（教学期间临时设为 hidden 防止 box-shadow 溢出）
                // panel.style.overflow = _prevOverflow;
                // if (this.saveData) this.saveData.runeLauncherTourDone = true;
                // this.sys_saveData(); // [BUGFIX] 原为 this.saveGame()，该方法不存在，导致存档从未持久化，教学每次都重复触发
                // return;
            // }

//             // const step = tourSteps[stepIdx];
            // const targetEl = document.getElementById(step.targetId);
            // if (!targetEl) {
                // 目标元素不存在，跳过
                // showStep(stepIdx + 1);
                // return;
            // }

//             // 计算目标元素相对于 panel 的位置
            // const panelRect = panel.getBoundingClientRect();
            // const targetRect = targetEl.getBoundingClientRect();
            // const relTop = targetRect.top - panelRect.top;
            // const relLeft = targetRect.left - panelRect.left;

//             // 创建高亮边框
            // const highlight = document.createElement('div');
            // highlight.style.cssText = [
                // 'position: absolute;',
                // `top: ${relTop - 4}px;`,
                // `left: ${relLeft - 4}px;`,
                // `width: ${targetRect.width + 8}px;`,
                // `height: ${targetRect.height + 8}px;`,
                // 'border: 2px solid rgba(245,158,11,0.8);',
                // 'border-radius: 12px;',
                // 'box-shadow: 0 0 0 2000px rgba(0,0,0,0.45);',
                // 'pointer-events: none;',
                // 'animation: tour-highlight-pulse 1.5s ease-in-out infinite;',
            // ].join(' ');
            // overlay.appendChild(highlight);

//             // 创建提示卡
            // const card = document.createElement('div');
            // card.style.cssText = [
                // 'position: absolute;',
                // 'pointer-events: auto;',
                // 'background: linear-gradient(135deg, rgba(15,23,42,0.97), rgba(30,27,75,0.97));',
                // 'border: 1px solid rgba(245,158,11,0.5);',
                // 'border-radius: 14px;',
                // 'padding: 12px 14px;',
                // 'width: 220px;',
                // 'box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(245,158,11,0.2);',
                // 'z-index: 10;',
            // ].join(' ');

//             // 卡片定位
            // const cardTop = step.position === 'bottom'
                // ? relTop + targetRect.height + 12
                // : relTop - 120;
            // const cardLeft = Math.max(4, Math.min(relLeft, panelRect.width - 230));
            // card.style.top = `${cardTop}px`;
            // card.style.left = `${cardLeft}px`;

//             // card.innerHTML = `
                // <div class="text-xs font-bold text-amber-300 mb-1">${step.title}</div>
                // <div class="text-[11px] text-slate-300 leading-relaxed mb-3">${step.desc}</div>
                // <div class="flex items-center justify-between">
                    // <span class="text-[10px] text-slate-500">${stepIdx + 1} / ${tourSteps.length}</span>
                    // <div class="flex gap-2">
                        // ${stepIdx > 0 ? `<button id="tour-skip-btn" style="font-size:10px;color:#94a3b8;background:none;border:none;cursor:pointer;">跳过</button>` : ''}
                        // <button id="tour-next-btn" style="font-size:11px;font-weight:bold;color:#fef3c7;background:rgba(120,53,15,0.8);border:1px solid rgba(245,158,11,0.5);border-radius:8px;padding:4px 10px;cursor:pointer;">${stepIdx < tourSteps.length - 1 ? '下一步 →' : '知道了 ✓'}</button>
                    // </div>
                // </div>
            // `;
            // overlay.appendChild(card);

//             // 事件绑定
            // const nextBtn = document.getElementById('tour-next-btn');
            // if (nextBtn) nextBtn.addEventListener('click', () => showStep(stepIdx + 1));

//             // const skipBtn = document.getElementById('tour-skip-btn');
            // if (skipBtn) skipBtn.addEventListener('click', () => showStep(tourSteps.length));
        // };

//         // 注入动画 CSS
        // if (!document.getElementById('rune-tour-style')) {
            // const style = document.createElement('style');
            // style.id = 'rune-tour-style';
            // style.textContent = `
                // @keyframes tour-highlight-pulse {
                    // 0%, 100% { box-shadow: 0 0 0 2000px rgba(0,0,0,0.45), 0 0 8px rgba(245,158,11,0.4); }
                    // 50%       { box-shadow: 0 0 0 2000px rgba(0,0,0,0.55), 0 0 16px rgba(245,158,11,0.8); }
                // }
            // `;
            // document.head.appendChild(style);
        // }

//         // showStep(0);
    // },


};

// 暴露到全局，供向后兼容
window.rune_launcher_system = rune_launcher_system;
