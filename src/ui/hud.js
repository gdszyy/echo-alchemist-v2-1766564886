/**
 * src/ui/hud.js - HUD 渲染模块
 * 
 * 职责：战斗/收集阶段的抬头显示（HUD）渲染
 * - 弹药槽位显示（当前弹药、下一发弹药）
 * - 配方 HUD（收集阶段横向滚动、战斗阶段浮动卡片）
 * - 回合伤害统计图表
 * - 收集队列 UI
 * - 分数乘数显示
 * - UI 缓存管理
 * 
 * 通信方式：通过 bind(this) 组合模式注入到 Game 实例
 * [Task 3.2 已完成] 通过 hud_initEventListeners() 注册 EventBus 监听器
 * 
 * @module ui/hud
 */

import { CONFIG } from '../config.js';
import { eventBus, EVENT_TYPES } from '../event_bus.js';
import { RUNE_DB, RARITY_DISPLAY, STAT_DISPLAY } from '../rune_config.js';
import { getAmmoIconSrc, getAttributeIconSrcByKey } from '../bitmap_icons.js';
import { getAmmoReadabilityProfile } from '../utils/ammo_readability.js';

/**
 * 构建符文图标 DOM 元素（hud.js 内部辅助函数）
 * 生成带黑底、稀有度边框、等级角标的 .rune-icon-frame span 元素。
 * @param {object} runeDef - RUNE_DB 中的符文定义对象
 * @param {number} runeLevel - 符文等级
 * @returns {HTMLElement} span 元素
 */
function _buildRuneIconEl(runeDef, runeLevel) {
    const rarity = (runeDef && runeDef.rarity) ? runeDef.rarity : 'common';
    const icon   = (runeDef && runeDef.icon)   ? runeDef.icon   : '🔮';
    const lv     = Math.min(runeLevel || 1, 3);
    const frame  = document.createElement('span');
    frame.className = `rune-icon-frame rarity-${rarity} lv-${lv}`;
    frame.textContent = icon;
    const badge = document.createElement('span');
    badge.className = 'rune-lv-badge';
    badge.textContent = `Lv.${runeLevel || 1}`;
    frame.appendChild(badge);
    return frame;
}

function _safeAttributeKey(key) {
    return String(key || 'empty').replace(/[^a-zA-Z0-9_-]/g, '');
}

function _attributeChipAssetUrl(key) {
    return `url("/assets/ui/sprites/attribute_chips/attribute_chip_${_safeAttributeKey(key)}.png")`;
}

function _attributeIconAssetUrl(key) {
    const src = getAttributeIconSrcByKey(_safeAttributeKey(key));
    return src ? `url("${src}")` : 'none';
}

function _buildAttributeChip(entry, className = '') {
    const key = _safeAttributeKey(entry && entry.key);
    const value = Math.max(0, Math.floor(Number(entry && entry.value) || 0));
    const chip = document.createElement('span');
    chip.className = `attribute-chip attr-chip-${key}${className ? ` ${className}` : ''}`;
    chip.dataset.attribute = key;
    chip.style.setProperty('--chip-color', (entry && entry.color) || '#cbd5e1');
    chip.style.setProperty('--attribute-chip-image', _attributeChipAssetUrl(key));
    chip.style.setProperty('--attribute-icon-image', _attributeIconAssetUrl(key));
    chip.title = `${(entry && entry.name) || key} ${value}`;

    const icon = document.createElement('span');
    icon.className = 'attribute-chip-icon';
    icon.setAttribute('aria-hidden', 'true');

    const count = document.createElement('span');
    count.className = 'attribute-chip-value';
    count.textContent = value > 0 ? String(value) : '';

    chip.append(icon, count);
    return chip;
}

function _buildCombatAttributePlaceholder(slotIndex) {
    const chip = _buildAttributeChip({
        key: 'empty',
        value: 0,
        name: `属性槽 ${slotIndex + 1}`,
        color: '#64748b',
    }, 'combat-ammo-attribute-chip is-empty');
    chip.title = `属性槽 ${slotIndex + 1}`;
    return chip;
}

function _buildCombatAttributeMoreSlot(hiddenEntries) {
    const chip = _buildAttributeChip({
        key: 'empty',
        value: 0,
        name: '更多属性',
        color: hiddenEntries[0] ? hiddenEntries[0].color : '#cbd5e1',
    }, 'combat-ammo-attribute-chip is-more');
    const valueEl = chip.querySelector('.attribute-chip-value');
    if (valueEl) valueEl.textContent = `+${hiddenEntries.length}`;
    chip.title = hiddenEntries.map(entry => `${entry.name} ${entry.value}`).join(' · ');
    return chip;
}

function _buildCombatAttributeSlots(profile, maxSlots = 4) {
    const entries = Array.isArray(profile && profile.entries) ? profile.entries : [];
    const damageDisplay = CONFIG.ui.attributeDisplay.damage || {};
    const sourceEntries = entries.length > 0 ? entries : [{
        key: 'damage',
        value: Math.max(0, Math.floor(Number(profile && profile.damage) || 0)),
        name: damageDisplay.name || '基础伤害',
        icon: damageDisplay.icon || '',
        color: damageDisplay.color || '#a855f7',
    }];
    const hiddenEntries = sourceEntries.length > maxSlots ? sourceEntries.slice(maxSlots - 1) : [];
    const visibleEntries = hiddenEntries.length > 0 ? sourceEntries.slice(0, maxSlots - 1) : sourceEntries.slice(0, maxSlots);
    const slots = visibleEntries.map(entry => _buildAttributeChip(entry, 'combat-ammo-attribute-chip'));
    if (hiddenEntries.length > 0) {
        slots.push(_buildCombatAttributeMoreSlot(hiddenEntries));
    }
    while (slots.length < maxSlots) {
        slots.push(_buildCombatAttributePlaceholder(slots.length));
    }
    return slots;
}

function _buildCombatQueueAttributeIcon(entry, className = '') {
    const key = _safeAttributeKey(entry && entry.key);
    const value = Math.max(0, Math.floor(Number(entry && entry.value) || 0));
    const icon = document.createElement('span');
    icon.className = `combat-ammo-queue-attr-icon attr-icon-${key}${className ? ` ${className}` : ''}`;
    icon.dataset.attribute = key;
    icon.style.setProperty('--chip-color', (entry && entry.color) || '#cbd5e1');
    icon.style.setProperty('--attribute-icon-image', _attributeIconAssetUrl(key));
    icon.title = `${(entry && entry.name) || key} ${value}`;

    const count = document.createElement('span');
    count.className = 'combat-ammo-queue-attr-value';
    count.textContent = value > 0 ? String(value) : '';

    icon.appendChild(count);
    return icon;
}

function _buildCombatQueueAttributeMoreIcon(hiddenEntries) {
    const icon = _buildCombatQueueAttributeIcon({
        key: 'empty',
        value: 0,
        name: 'More',
        color: hiddenEntries[0] ? hiddenEntries[0].color : '#cbd5e1',
    }, 'is-more');
    const count = icon.querySelector('.combat-ammo-queue-attr-value');
    if (count) count.textContent = `+${hiddenEntries.length}`;
    icon.title = hiddenEntries.map(entry => `${entry.name} ${entry.value}`).join(' / ');
    return icon;
}

function _buildCombatQueueAttributeIcons(profile, maxIcons = 4) {
    const entries = Array.isArray(profile && profile.entries) ? profile.entries : [];
    const damageDisplay = CONFIG.ui.attributeDisplay.damage || {};
    const sourceEntries = entries.length > 0 ? entries : [{
        key: 'damage',
        value: Math.max(0, Math.floor(Number(profile && profile.damage) || 0)),
        name: damageDisplay.name || 'Damage',
        icon: damageDisplay.icon || '',
        color: damageDisplay.color || '#a855f7',
    }];
    const hiddenEntries = sourceEntries.length > maxIcons ? sourceEntries.slice(maxIcons - 1) : [];
    const visibleEntries = hiddenEntries.length > 0 ? sourceEntries.slice(0, maxIcons - 1) : sourceEntries.slice(0, maxIcons);
    const icons = visibleEntries.map(entry => _buildCombatQueueAttributeIcon(entry));
    if (hiddenEntries.length > 0) {
        icons.push(_buildCombatQueueAttributeMoreIcon(hiddenEntries));
    }
    return icons;
}

function _playRuneAcquireReveal(runeDef, runeLevel, delay = 0) {
    if (typeof document === 'undefined' || !runeDef) return;
    setTimeout(() => {
        const reveal = document.createElement('div');
        reveal.className = `rune-acquire-reveal rarity-${runeDef.rarity || 'common'}`;
        const iconFrame = _buildRuneIconEl(runeDef, runeLevel || 1);
        const textWrap = document.createElement('div');
        textWrap.className = 'rune-acquire-copy';
        const label = document.createElement('div');
        label.className = 'rune-acquire-label';
        label.textContent = '符文获得';
        const name = document.createElement('div');
        name.className = 'rune-acquire-name';
        name.textContent = `${runeDef.name || runeDef.id || '未知符文'} Lv.${runeLevel || 1}`;
        textWrap.append(label, name);
        reveal.append(iconFrame, textWrap);
        document.body.appendChild(reveal);
        setTimeout(() => reveal.remove(), 1250);
    }, Math.max(0, delay || 0));
}

/**
 * HUD 渲染方法集合
 * 通过 bind(this) 组合模式作为实例方法注入到 Game 实例
 */
export const hud_system = {


/**
     * @method updateMultiplierUI
     * @description 更新分数乘数 UI。
     */
    ui_updateMultiplierUI() { 
        const el = document.getElementById('multiplier-val'); 
        if (!el) return; // 元素已被移除（技能充能系统替代了 combo 显示）
        el.innerText = `x${this.scoreMultiplier.toFixed(1)}`;  // [Mixin 正常用法：读取 Game 实例状态]
        const container = document.getElementById('multiplier-display'); 
        if (!container) return;
        container.classList.remove('opacity-0'); 
        container.classList.add('opacity-100'); 
        el.classList.remove('pop-anim'); 
        void el.offsetWidth; 
        el.classList.add('pop-anim'); 
    },


/**
     * @method saveShotDamage
     * @description 保存当前子弹的伤害统计到历史记录
     */
    ui_saveShotDamage() {
        if (this.currentShotDamage > 0) {
            // 保存到历史记录，最多保存3个
            this.shotDamageHistory.unshift({  // [Mixin 正常用法：读取 Game 实例状态]
                total: this.currentShotDamage,
                byAttr: JSON.parse(JSON.stringify(this.currentShotDamageByAttr))
            });
            if (this.shotDamageHistory.length > 3) {  // [Mixin 正常用法：读取 Game 实例状态]
                this.shotDamageHistory.pop();  // [Mixin 正常用法：读取 Game 实例状态]
            }
            // 更新显示
            this.ui_updateRoundDamage();
            // 子弹完成 → 主动刷新一次实时面板（rAF 节流）
            if (typeof this.ui_scheduleDamageStatsRefresh === 'function') {
                this.ui_scheduleDamageStatsRefresh();
            }
        }
    },


/**
     * @method updateRoundDamage
     * @description 更新当前子弹伤害显示（带滚动数字效果）
     */
    ui_updateRoundDamage() {
        const el = document.getElementById('round-damage-val');
        const container = document.getElementById('round-damage-display');
        if (!el || !container) return;

        // 使用本回合实时累计伤害 (roundDamage)
        const targetValue = Math.floor(this.roundDamage);  // [Mixin 正常用法：读取 Game 实例状态]
        const currentValue = parseInt((el.innerText || '0').replace(/,/g, '')) || 0;

        // 实时 DPS 副标签：单独的 #round-damage-dps 元素，在主数字旁显示
        let dpsEl = document.getElementById('round-damage-dps');
        if (!dpsEl) {
            dpsEl = document.createElement('span');
            dpsEl.id = 'round-damage-dps';
            dpsEl.className = 'ml-2 text-xs font-bold text-amber-300';
            el.parentNode && el.parentNode.appendChild(dpsEl);
        }
        const dps = Math.floor(this._dps || 0);
        dpsEl.innerText = dps > 0 ? `(${dps.toLocaleString()} DPS)` : '';

        if (targetValue > 0) {
            container.classList.remove('opacity-0');
            container.classList.add('opacity-100');

            // 如果差值较小，直接更新，避免频繁启动定时器
            if (Math.abs(targetValue - currentValue) < 5) {
                el.innerText = targetValue.toLocaleString();
                return;
            }

            // 滚动数字效果
            if (this._damageScrollInterval) clearInterval(this._damageScrollInterval);

            const duration = 300;
            const steps = 10;
            const stepValue = (targetValue - currentValue) / steps;
            let currentStep = 0;

            this._damageScrollInterval = setInterval(() => {
                currentStep++;
                const newValue = Math.floor(currentValue + stepValue * currentStep);
                el.innerText = newValue.toLocaleString();

                if (currentStep >= steps) {
                    el.innerText = targetValue.toLocaleString();
                    clearInterval(this._damageScrollInterval);
                }
            }, duration / steps);
        } else {
            container.classList.add('opacity-0');
            container.classList.remove('opacity-100');
            el.innerText = '0';
        }
    },

    /**
     * @method ui_scheduleDamageStatsRefresh
     * @description 实时伤害统计面板刷新 —— rAF 节流。
     *   每次 combat_recordDamage 调用都会请求刷新，但实际重建 DOM 的频率最高 60fps，
     *   且仅在「伤害面板可见 + 正在查看当前回合」时执行，避免无意义工作。
     */
    ui_scheduleDamageStatsRefresh() {
        if (this._damageStatsRafScheduled) return;
        // 仅当查看当前回合（实时数据）时才需要刷新
        if (this.currentViewingRound !== 0) return;
        // 仅当伤害 tab 实际可见时才刷新
        const tabEl = document.getElementById('tab-damage');
        if (!tabEl || tabEl.classList.contains('hidden')) return;

        this._damageStatsRafScheduled = true;
        const run = () => {
            this._damageStatsRafScheduled = false;
            // 再次确认仍处于实时查看模式，且面板仍可见（rAF 异步期间状态可能已变）
            if (this.currentViewingRound !== 0) return;
            const t = document.getElementById('tab-damage');
            if (!t || t.classList.contains('hidden')) return;
            this.ui_updateDamageStats();
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(run);
        } else {
            setTimeout(run, 16);
        }
    },


/**
     * @method updateDamageStats
     * @description 更新伤害统计图表显示
     */
    ui_updateDamageStats() {
        const container = document.getElementById('damage-stats-container');
        if (!container) return;
        container.innerHTML = '';
        // 修改容器样式：使用 flex-col 垂直排列不同的子弹数据
        container.className = 'flex flex-col gap-4 h-full w-full p-2 overflow-y-auto custom-scrollbar'; 

        // --- 1. 获取数据源 ---
        let shotsData = [];
        let roundNumber = this.round;  // [Mixin 正常用法：读取 Game 实例状态]

        if (this.currentViewingRound === 0) {
            // 查看当前回合（实时数据）
            shotsData = this.shotDamageHistory;  // [Mixin 正常用法：读取 Game 实例状态]
        } else {
            // 查看历史回合
            const historyIndex = this.roundDamageHistory.length - this.currentViewingRound;
            if (historyIndex >= 0 && historyIndex < this.roundDamageHistory.length) {
                shotsData = this.roundDamageHistory[historyIndex].shots;
                roundNumber = this.roundDamageHistory[historyIndex].round;
            }
        }

        // --- 2. 渲染顶部导航 ---
        const header = document.createElement('div');
        header.className = 'w-full flex justify-between items-center bg-slate-800 p-2 rounded shrink-0 sticky top-0 z-10 border border-slate-700 shadow-md';

        // [重构] 使用 createElement + addEventListener 替代 innerHTML 内联事件，移除 window.game 依赖
        const prevBtn = document.createElement('button');
        prevBtn.className = 'text-slate-400 hover:text-white px-3 py-1';
        prevBtn.textContent = '◀';
        prevBtn.addEventListener('click', () => this.ui_switchDamageRound(1));

        const roundLabel = document.createElement('span');
        roundLabel.className = 'text-xs font-bold text-amber-400 font-[Cinzel] flex items-center gap-2';
        const isLive = this.currentViewingRound === 0;
        if (isLive) {
            const dot = document.createElement('span');
            dot.className = 'inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse';
            dot.title = '实时';
            roundLabel.appendChild(dot);
            const liveText = document.createElement('span');
            liveText.textContent = `Round ${roundNumber} · LIVE`;
            roundLabel.appendChild(liveText);
            const dpsBadge = document.createElement('span');
            dpsBadge.className = 'text-[10px] font-normal text-amber-200 bg-slate-900/60 px-1.5 py-0.5 rounded';
            dpsBadge.textContent = `${Math.floor(this._dps || 0).toLocaleString()} DPS`;
            roundLabel.appendChild(dpsBadge);
        } else {
            roundLabel.textContent = `Round ${roundNumber}`;
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'text-slate-400 hover:text-white px-3 py-1';
        nextBtn.textContent = '▶';
        nextBtn.addEventListener('click', () => this.ui_switchDamageRound(-1));

        header.appendChild(prevBtn);
        header.appendChild(roundLabel);
        header.appendChild(nextBtn);
        container.appendChild(header);

        if (!shotsData || shotsData.length === 0) {
            container.innerHTML += `<div class="text-slate-500 text-center text-xs mt-10 italic">暂无伤害数据</div>`;
            return;
        }

        // --- 3. 遍历每一发子弹 (Shot) 分别渲染 ---
        shotsData.forEach((shot, index) => {
            const shotTotal = shot.total;
            if (shotTotal <= 0) return;

            // 子弹容器
            const shotContainer = document.createElement('div');
            shotContainer.className = 'bg-slate-900/60 p-3 rounded-lg border border-slate-700/50 relative';
            
            // 子弹标题
            const shotTitle = document.createElement('div');
            shotTitle.className = 'text-[10px] text-slate-400 font-bold mb-3 flex justify-between items-center border-b border-slate-700/50 pb-1';
            shotTitle.innerHTML = `
                <span class="bg-slate-800 px-2 py-0.5 rounded text-slate-300">Shot #${index + 1}</span> 
                <span class="text-amber-100">Total: ${Math.ceil(shotTotal).toLocaleString()}</span>
            `;
            shotContainer.appendChild(shotTitle);

            // --- 预计算：找出本发子弹中伤害最高的类型，用于归一化进度条宽度 ---
            let maxTypeTotal = 0;
            const typeTotals = {};
            
            for (const [dtype, sources] of Object.entries(shot.byAttr)) {
                let tTotal = 0;
                // 兼容旧数据格式 (number) 和新格式 (object)
                if (typeof sources === 'number') {
                    tTotal = sources;
                } else {
                    tTotal = Object.values(sources).reduce((a, b) => a + b, 0);
                }
                typeTotals[dtype] = tTotal;
                if (tTotal > maxTypeTotal) maxTypeTotal = tTotal;
            }

            // 按伤害量排序
            const sortedTypes = Object.keys(shot.byAttr).sort((a, b) => typeTotals[b] - typeTotals[a]);

            sortedTypes.forEach(dtype => {
                const sources = shot.byAttr[dtype];
                const typeTotal = typeTotals[dtype];
                
                // [修复3]：横轴坐标缩放
                // 进度条容器的宽度 = (当前类型总伤 / 本发子弹最大类型总伤) * 100%
                // 这样伤害低的类型条就会很短
                const rowWidthPercent = maxTypeTotal > 0 ? (typeTotal / maxTypeTotal) * 100 : 0;

                const row = document.createElement('div');
                row.className = 'flex flex-col gap-1 mb-2';

                // 类型标签与数值
                const label = document.createElement('div');
                label.className = 'flex justify-between text-[10px] px-1';
                
                // [修复1]：颜色定义优化
                // 将 bounce 改为绿色，避免与 scatter (黄色) 混淆
                const typeConfig = {
                    'bounce':   { name: '⤴️ 弹射', color: CONFIG.ui.damageStats.bounce }, // Green
                    'pierce':   { name: '➡️ 穿透', color: CONFIG.ui.damageStats.pierce }, // Red-ish
                    'scatter':  { name: '🔱 散射', color: CONFIG.ui.damageStats.scatter }, // Yellow
                    'damage':   { name: '⚔️ 基础', color: CONFIG.ui.damageStats.damage }, // White/Slate
                    'cryo':     { name: '❄️ 冰霜', color: CONFIG.ui.damageStats.cryo },
                    'pyro':     { name: '🔥 火焰', color: CONFIG.ui.damageStats.pyro },
                    'lightning':{ name: '⚡ 闪电', color: CONFIG.ui.damageStats.lightning },
                    'wind':     { name: '🌪️ 风暴', color: CONFIG.ui.damageStats.wind },
                    'flying_sword': { name: '🗡️ 飞剑', color: CONFIG.ui.damageStats.flying_sword },
                    'explosive': { name: '💥 爆炸', color: CONFIG.ui.damageStats.explosive },
                    'laser': { name: '☄️ 光束', color: CONFIG.ui.damageStats.laser },
                    'resonance': { name: '🔂 共鸣', color: CONFIG.ui.damageStats.resonance },
                    'venom': { name: '☠️ 剧毒', color: CONFIG.ui.damageStats.venom },
                    'overcharge': { name: '⚡ 超载', color: CONFIG.ui.damageStats.overcharge },
                    'echo': { name: '🔊 回响', color: CONFIG.ui.damageStats.echo },
                    'skill': { name: '✨ 技能', color: CONFIG.ui.damageStats.skill }
                };
                
                const conf = typeConfig[dtype] || { name: dtype, color: CONFIG.ui.damageStats.default };

                label.innerHTML = `
                    <span style="color:${conf.color}" class="font-bold shadow-black drop-shadow-sm">${conf.name}</span>
                    <span class="text-slate-400 text-[9px]">${Math.ceil(typeTotal).toLocaleString()}</span>
                `;
                row.appendChild(label);

                // 进度条轨道 (全长背景)
                const track = document.createElement('div');
                track.className = 'w-full h-2.5 bg-slate-800/50 rounded-r-md rounded-bl-md overflow-hidden relative';
                
                // 实际长度容器 (根据伤害比例缩放)
                const barWrapper = document.createElement('div');
                barWrapper.style.width = `${Math.max(1, rowWidthPercent)}%`; // 至少显示 1%
                barWrapper.className = 'h-full flex transition-all duration-500 relative';
                
                // 数据源细分 (Stacking Segments)
                let sourceEntries = [];
                if (typeof sources === 'number') {
                    sourceEntries = [['main', sources]];
                } else {
                    // 排序：主子弹(main)在左侧，其他在右侧
                    sourceEntries = Object.entries(sources).sort((a, b) => (a[0] === 'main' ? -1 : 1));
                }

                sourceEntries.forEach(([stype, amount]) => {
                    // 每一段的宽度相对于该类型的总长度
                    const segmentPercent = (amount / typeTotal) * 100;
                    const segment = document.createElement('div');
                    segment.style.width = `${segmentPercent}%`;
                    
                    // 颜色逻辑：
                    // 如果是散射产生的伤害，使用特定纹理或颜色，但在“弹射”条里，最好保持弹射的主色调，
                    // 只用透明度或高亮来区分来源，避免把“弹射”看成“散射”。
                    if (stype === 'scatter') {
                        segment.style.backgroundColor = conf.color; // 保持类型颜色
                        segment.style.backgroundImage = 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)';
                        segment.style.backgroundSize = '4px 4px'; // 加斜纹表示散射来源
                    } else {
                        segment.style.backgroundColor = conf.color;
                    }
                    
                    // 透明度区分：非主子弹稍微淡一点
                    segment.style.opacity = (stype === 'main') ? '1' : '0.8';
                    
                    // Tooltip
                    segment.title = `${stype === 'main' ? '主子弹' : (stype === 'scatter' ? '散射' : stype)}: ${Math.ceil(amount)}`;
                    
                    barWrapper.appendChild(segment);
                });

                track.appendChild(barWrapper);
                row.appendChild(track);
                shotContainer.appendChild(row);
            });
            
            container.appendChild(shotContainer);
        });

        // 底部图例
        const legend = document.createElement('div');
        legend.className = 'mt-2 pt-2 border-t border-slate-700 flex flex-wrap gap-3 justify-center text-[9px] text-slate-500';
        legend.innerHTML = `
            <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-sm bg-slate-400"></div> 主子弹</div>
            <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-sm bg-slate-400 opacity-80" style="background-image: linear-gradient(45deg, rgba(255,255,255,0.4) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.4) 75%, transparent 75%, transparent); background-size: 4px 4px;"></div> 散射来源</div>
        `;
        container.appendChild(legend);
    },


/**
     * @method switchDamageRound
     * @description 切换伤害统计查看的回合
     */
    ui_switchDamageRound(direction) {
        this.currentViewingRound += direction;
        if (this.currentViewingRound < 0) this.currentViewingRound = 0;
        if (this.currentViewingRound > this.roundDamageHistory.length) {
            this.currentViewingRound = this.roundDamageHistory.length;
        }
        this.ui_updateDamageStats();
    },


/**
     * @method toggleDamagePanel
     * @description 切换伤害统计面板的显示/隐藏
     */
    ui_toggleDamagePanel() {
        if (!this.ui) return;
        
        const drawer = document.getElementById('info-drawer');
        if (!drawer) return;
        
        // PC 模式下 drawer 常驻展开，直接切换到伤害统计 tab
        if (drawer.dataset.pcDrawerMigrated) {
            this.ui.switchTab('damage');
            return;
        }
        
        const isOpen = !drawer.classList.contains('translate-y-full');
        
        if (isOpen) {
            // 关闭面板
            this.ui.closeDrawer();
        } else {
            // 打开面板并切换到伤害统计标签
            drawer.classList.remove('translate-y-full');
            this.ui.switchTab('damage');
        }
    },


/**
     * @method renderRecipeHUD
     * @description 渲染配方 HUD (严格单例渲染)
     */
    /**
     * [UI] 渲染配方界面的抬头显示 (HUD)。
     * 负责展示当前收集的弹珠属性和配方预览。
     */
    ui_renderRecipeHUD() {
        // 获取两个容器
        const gatheringHud = document.getElementById('gathering-hud-mount'); 
        const combatHud = document.getElementById('recipe-hud-container');
        
        // --- 战斗阶段 ---
        if (this.phase === 'combat') {  // [Mixin 正常用法：读取 Game 实例状态]
            // 1. 确保收集阶段的容器为空 (尽管 updateUI 已经隐藏了它的父级，清空更保险)
            if (typeof this._hud_renderSessionChargeStack === 'function') {
                this._hud_renderSessionChargeStack();
            }
            if (gatheringHud) gatheringHud.innerHTML = '';

            // 2. 渲染战斗悬浮 HUD
            if (combatHud) {
                combatHud.classList.remove('hidden'); 
                combatHud.classList.add('recipe-hud-floating'); 
                combatHud.innerHTML = '';
                
                const recipes = this.ammoQueue || [];
                const upcomingRecipes = recipes.slice(1, 3);
                combatHud.classList.add('combat-ammo-console');
                combatHud.classList.toggle('is-empty', upcomingRecipes.length === 0);
                combatHud.classList.toggle('has-two-upcoming', upcomingRecipes.length > 1);
                combatHud.dataset.queueCount = String(upcomingRecipes.length);

                if (upcomingRecipes.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'combat-ammo-empty-state';
                    empty.textContent = 'NO QUEUE';
                    combatHud.appendChild(empty);
                } else {
                    const nextRecipe = upcomingRecipes[0];
                    const nextProfile = getAmmoReadabilityProfile(nextRecipe);
                    const nextIconSrc = getAmmoIconSrc(nextRecipe);

                    const nextSlot = document.createElement('div');
                    nextSlot.className = 'combat-ammo-next-slot';
                    nextSlot.dataset.ammoIndex = 'next-1';
                    nextSlot.style.setProperty('--ammo-accent', nextProfile.primary.color);
                    if (nextIconSrc) nextSlot.style.setProperty('--ammo-icon', `url("${nextIconSrc}")`);
                    nextSlot.title = nextProfile.summary;

                    const icon = document.createElement('span');
                    icon.className = 'combat-ammo-core-icon';
                    icon.setAttribute('aria-hidden', 'true');

                    const copy = document.createElement('span');
                    copy.className = 'combat-ammo-copy';
                    const label = document.createElement('span');
                    label.className = 'combat-ammo-label';
                    label.textContent = 'NEXT';
                    const name = document.createElement('span');
                    name.className = 'combat-ammo-name';
                    name.textContent = nextProfile.shapeLabel || '基础弹';
                    copy.append(label, name);

                    const damage = document.createElement('span');
                    damage.className = 'combat-ammo-damage';
                    damage.textContent = String(nextRecipe.damage || 0);
                    damage.title = 'damage';
                    nextSlot.append(icon, copy, damage);

                    const attributeRow = document.createElement('div');
                    attributeRow.className = 'combat-ammo-attribute-row';
                    _buildCombatAttributeSlots(nextProfile, 4).forEach(slot => {
                        attributeRow.appendChild(slot);
                    });

                    combatHud.append(nextSlot, attributeRow);

                    const queueStrip = document.createElement('div');
                    queueStrip.className = 'combat-ammo-queue-strip';
                    queueStrip.classList.toggle('is-empty', upcomingRecipes.length <= 1);
                    upcomingRecipes.slice(1, 2).forEach((recipe, idx) => {
                        const profile = getAmmoReadabilityProfile(recipe);
                        const iconSrc = getAmmoIconSrc(recipe);
                        const chip = document.createElement('div');
                        chip.className = 'combat-ammo-queue-chip';
                        chip.dataset.queueIndex = String(idx + 2);
                        chip.style.setProperty('--ammo-accent', profile.primary.color);
                        if (iconSrc) chip.style.setProperty('--ammo-icon', `url("${iconSrc}")`);
                        chip.title = profile.summary;

                        const chipIcon = document.createElement('span');
                        chipIcon.className = 'combat-ammo-queue-icon';
                        chipIcon.setAttribute('aria-hidden', 'true');
                        const chipDamage = document.createElement('b');
                        chipDamage.textContent = String(recipe.damage || 0);

                        const chipAttrs = document.createElement('span');
                        chipAttrs.className = 'combat-ammo-queue-attrs';
                        const maxQueueAttributeIcons = (
                            typeof window !== 'undefined'
                            && window.matchMedia?.('(max-width: 1024px)').matches
                        ) ? 2 : 4;
                        _buildCombatQueueAttributeIcons(profile, maxQueueAttributeIcons).forEach(attrIcon => {
                            chipAttrs.appendChild(attrIcon);
                        });

                        chip.append(chipIcon, chipDamage, chipAttrs);
                        queueStrip.appendChild(chip);
                    });
                    if (upcomingRecipes.length <= 1) {
                        const emptyQueue = document.createElement('span');
                        emptyQueue.className = 'combat-ammo-queue-empty';
                        emptyQueue.textContent = 'QUEUE EMPTY';
                        queueStrip.appendChild(emptyQueue);
                    }
                    const hiddenCount = Math.max(0, recipes.length - 3);
                    if (hiddenCount > 0) {
                        const more = document.createElement('div');
                        more.className = 'combat-ammo-queue-more';
                        more.textContent = `+${hiddenCount}`;
                        queueStrip.appendChild(more);
                    }
                    combatHud.appendChild(queueStrip);
                }

                // --- [继承加成] 显示符文基础属性、词条加成与全局额外伤害/击杀加成 ---
                const inheritCard = this._buildInheritanceCard();
                if (inheritCard) combatHud.appendChild(inheritCard);
            }
        }
        else {
            // --- 收集阶段 ---
            
            // 1. 隐藏战斗 HUD
            if (combatHud) {
                combatHud.classList.add('hidden'); 
                combatHud.classList.remove('recipe-hud-floating'); 
                combatHud.innerHTML = '';
            }

            // 2. 渲染收集阶段横向滚动条
            if (gatheringHud && this.phase === 'gathering') {  // [Mixin 正常用法：读取 Game 实例状态]
                gatheringHud.innerHTML = ''; 
                this.marbleQueue.forEach((item, idx) => {  // [Mixin 正常用法：读取 Game 实例状态]
                    const isActive = idx === this.activeMarbleIndex;  // [Mixin 正常用法：读取 Game 实例状态]
                    this.ui_renderRecipeCard(gatheringHud, item, isActive, isActive ? 'current' : 'queue'); 
                }); 
                if (typeof this._hud_renderSessionChargeStack === 'function') {
                    this._hud_renderSessionChargeStack();
                }
            }
        }
    },


/**
     * @method renderRecipeCard
     * @description 渲染单个配方/弹珠卡片。
     * @param {HTMLElement} container - **重要参数** 容器元素。
     * @param {object} item - **重要参数** 弹珠定义或配方对象。
     * @param {boolean} isActive - 是否为当前激活项。
     * @param {string} statusClass - 状态 CSS 类名。
     */
    ui_renderRecipeCard(container, item, isActive, statusClass) {
        const el = document.createElement('div'); 
        el.className = `recipe-card ${statusClass}`; 
        
        const head = document.createElement('div'); 
        // [优化]：
        // 1. mb-0.5 (2px) 替代 mb-1 (4px)
        // 2. pb-0.5 (2px) 替代 pb-1 (4px)
        // 3. text-[10px] 稍微减小标题字号，使其更精致
        head.className = 'flex items-center justify-between mb-0.5 border-b border-slate-600/50 pb-0.5'; 
        
        const name = document.createElement('span'); 
        name.innerText = item.getName ? item.getName() : (item.name || '光球');
        name.className = 'font-bold text-amber-100 mr-2 text-[11px]'; // 标题字号 11px
        head.appendChild(name); 
        
        const mats = document.createElement('div'); 
        mats.className = 'mats-grid'; // 确保使用了新的 grid 类

        const counts = {}; 
        if (item.collected) { 
            item.collected.forEach(type => { 
                counts[type] = (counts[type] || 0) + 1; 
            }); 
        }

        const colors = {
            'flying_sword': { c: CONFIG.colors.flying_sword, l: CONFIG.ui.attributeDisplay.flying_sword.icon, n: '劍' },
            'bounce': { c: CONFIG.colors.matBounce, l: CONFIG.ui.attributeDisplay.bounce.icon, n: '彈' },
            'pierce': { c: CONFIG.colors.matPierce, l: CONFIG.ui.attributeDisplay.pierce.icon, n: '穿' },
            'scatter': { c: CONFIG.colors.matScatter, l: CONFIG.ui.attributeDisplay.scatter.icon, n: '散' },
            'damage': { c: CONFIG.colors.matDamage, l: CONFIG.ui.attributeDisplay.damage.icon, n: '強' },
            'cryo': { c: CONFIG.colors.matCryo, l: CONFIG.ui.attributeDisplay.cryo.icon, n: '冷' },
            'pyro': { c: CONFIG.colors.matPyro, l: CONFIG.ui.attributeDisplay.pyro.icon, n: '熱' },
            'lightning': { c: CONFIG.colors.matLightning, l: CONFIG.ui.attributeDisplay.lightning.icon, n: '雷' },
            'laser': { c: CONFIG.colors.laser, l: CONFIG.ui.attributeDisplay.laser.icon, n: '光' },
            'wind': { c: CONFIG.colors.matWind, l: CONFIG.ui.attributeDisplay.wind.icon, n: '風' },
            'resonance': { c: CONFIG.colors.resonance, l: CONFIG.ui.attributeDisplay.resonance.icon, n: '鳴' },
            'venom': { c: CONFIG.colors.matVenom, l: CONFIG.ui.attributeDisplay.venom.icon, n: '毒' },
            'overcharge': { c: CONFIG.colors.matOvercharge, l: CONFIG.ui.attributeDisplay.overcharge.icon, n: '载' },
            'echo': { c: CONFIG.colors.matEcho, l: CONFIG.ui.attributeDisplay.echo.icon, n: '响' }
        };

        Object.keys(counts).forEach(type => { 
            const info = colors[type]; 
            if(!info) return; 
            const row = document.createElement('div'); 
            row.className = 'mat-row text-slate-300'; 
            // 图标和文字之间只留极小的间距
            row.innerHTML = `<span style="color:${info.c}; font-size:0.8em;">${info.l}</span> <span class="ml-0.5">${info.n}${counts[type]}</span>`; 
            mats.appendChild(row); 
        });
        
        if (item.lightning > 0) {
             const lightningBadge = document.createElement('div');
             lightningBadge.className = 'mat-row text-purple-300 font-bold';
             lightningBadge.innerHTML = `<span style="font-size:0.8em;">⚡</span> <span class="ml-0.5">反應: ${item.lightning}</span>`;
             mats.appendChild(lightningBadge);
        }
        
        if (Object.keys(counts).length === 0) { 
            mats.className = 'text-slate-500 text-[9px] mt-0.5'; // 无材料时也紧凑点
            mats.innerHTML = '<span>無材料</span>'; 
        } 
        
        if (item.multicast > 0) {
            const badge = document.createElement('div');
            // 样式：绝对定位在卡片右上角或醒目位置
            badge.className = 'absolute -top-2 -right-2 bg-slate-900 border border-slate-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10';
            
            // [BUGFIX #4] 修复连击徽章颜色条件顺序错误
            // 原 Bug: >= 5 在 >= 10 之前，导致金色徽章永远无法显示
            if (item.multicast >= 10) {
                badge.style.borderColor = '#facc15';
                badge.style.color = '#facc15';
                badge.style.boxShadow = '0 0 5px #facc15';
            } else if (item.multicast >= 5) {
                badge.style.borderColor = '#d8b4fe';
                badge.style.color = '#d8b4fe';
                badge.style.boxShadow = '0 0 5px #d8b4fe';
            }
            
            badge.innerText = `x${1+item.multicast}`;
            el.appendChild(badge); // 将徽章添加到卡片中
            
            // 确保父元素 el 有 relative 定位，以便 badge 绝对定位
            el.style.position = 'relative';
            // 确保 overflow 不是 hidden，否则徽章会被切掉
            el.style.overflow = 'visible'; 
        }

        el.append(head, mats); 
        container.appendChild(el);
    },

    _hud_getGatheringSessionViewModels() {
        const queue = Array.isArray(this.marbleQueue) ? this.marbleQueue : [];
        const sessions = Array.isArray(this.gatheringSessions) ? this.gatheringSessions : [];
        const count = Math.max(queue.length, sessions.length);
        const models = [];
        for (let i = 0; i < count; i++) {
            const session = sessions.find(s => s && Number.isInteger(s.marbleIndex) && s.marbleIndex === i) || sessions[i] || null;
            const marble = queue[i] || (session && session.marbleDef) || null;
            const currentHits = Math.max(0, Math.floor(session ? (session.currentHits || 0) : 0));
            const target = Math.max(1, Math.floor(session ? (session.nextTriggerThreshold || this.persistentThreshold || 1) : (this.persistentThreshold || 1)));
            const multicast = Math.max(0, Math.floor(session ? (session.multicast || 0) : ((marble && marble.multicast) || 0)));
            const active = !!(session && !session.isFinished && (session.activeBalls || 0) > 0);
            const collection = Array.isArray(session && session.collected)
                ? session.collected
                : (Array.isArray(marble && marble.collected) ? marble.collected : []);
            models.push({ index: i, marble, currentHits, target, multicast, active, collection, finished: !!(session && session.isFinished) });
        }
        return models;
    },

    _hud_renderSessionChargeStack() {
        const stack = document.getElementById('session-charge-stack');
        if (!stack) return false;

        const models = this._hud_getGatheringSessionViewModels ? this._hud_getGatheringSessionViewModels() : [];
        const shouldShow = this.phase === 'gathering' && models.length > 1;
        stack.classList.toggle('hidden', !shouldShow);
        stack.classList.toggle('gathering-ammo-panel-grid', shouldShow);

        const phaseEl = document.getElementById('phase-gathering');
        if (phaseEl) phaseEl.classList.toggle('has-ammo-panels', shouldShow);

        const gaugeEl = document.getElementById('hero-gauge-container');
        if (gaugeEl) gaugeEl.classList.toggle('has-session-panels', shouldShow);

        const legacyShell = document.getElementById('gauge-shell');
        const legacyMulticast = document.getElementById('multicast-ui');
        if (legacyShell) legacyShell.classList.toggle('hidden', shouldShow);
        if (legacyMulticast) legacyMulticast.classList.toggle('hidden', shouldShow);

        if (!shouldShow) {
            stack.innerHTML = '';
            return false;
        }

        stack.innerHTML = '';
        const fragment = document.createDocumentFragment();
        models.slice(0, 3).forEach(model => {
            const pct = model.target > 0 ? Math.max(0, Math.min(100, (model.currentHits / model.target) * 100)) : 0;
            const name = model.marble && model.marble.getName ? model.marble.getName() : `#${model.index + 1}`;
            const rawColor = model.marble && typeof model.marble.getColor === 'function'
                ? model.marble.getColor()
                : (model.marble && model.marble.color) || '#e2e8f0';
            const isGradient = typeof rawColor === 'string' && rawColor.includes('gradient');
            const accent = isGradient ? '#facc15' : rawColor;

            const panel = document.createElement('div');
            panel.className = `gathering-ammo-panel${model.active ? ' is-active' : ''}${pct >= 99 ? ' is-full' : ''}${model.finished ? ' is-finished' : ''}`;
            panel.dataset.marbleIndex = String(model.index);
            panel.title = `${name} · ${model.currentHits}/${model.target} · x${1 + model.multicast}`;
            panel.style.setProperty('--marble-accent', accent);
            panel.style.setProperty('--marble-bg', rawColor);

            const charge = document.createElement('div');
            charge.className = 'gathering-ammo-charge';
            const fill = document.createElement('span');
            fill.className = 'gathering-ammo-charge-fill';
            fill.style.width = `${pct}%`;
            const text = document.createElement('span');
            text.className = 'gathering-ammo-charge-text';
            text.textContent = `${model.currentHits}/${model.target}`;
            charge.append(fill, text);

            const main = document.createElement('div');
            main.className = 'gathering-ammo-main';
            const orb = document.createElement('span');
            orb.className = 'gathering-ammo-orb';
            const copy = document.createElement('span');
            copy.className = 'gathering-ammo-copy';
            const label = document.createElement('span');
            label.className = 'gathering-ammo-label';
            label.textContent = `弹 ${model.index + 1}`;
            const nameEl = document.createElement('span');
            nameEl.className = 'gathering-ammo-name';
            nameEl.textContent = name;
            copy.append(label, nameEl);
            main.append(orb, copy);

            const stats = document.createElement('div');
            stats.className = 'gathering-ammo-stats';
            const counts = new Map();
            for (const item of model.collection || []) {
                const type = typeof item === 'string' ? item : (item && item.type);
                if (!type || !CONFIG.ui.attributeDisplay[type]) continue;
                const amount = Math.max(1, Math.floor((item && typeof item === 'object' && item.level) ? item.level : 1));
                counts.set(type, (counts.get(type) || 0) + amount);
            }
            if (counts.size === 0) {
                const empty = document.createElement('span');
                empty.className = 'gathering-ammo-empty';
                empty.textContent = '待收集';
                stats.appendChild(empty);
            } else {
                Array.from(counts.entries()).slice(0, 4).forEach(([type, count]) => {
                    const display = CONFIG.ui.attributeDisplay[type];
                    const chip = _buildAttributeChip({
                        key: type,
                        value: count,
                        name: display.name || type,
                        icon: display.icon || '',
                        color: display.color || '#cbd5e1',
                    }, 'gathering-ammo-stat-chip');
                    stats.appendChild(chip);
                });
                if (counts.size > 4) {
                    const more = document.createElement('span');
                    more.className = 'gathering-ammo-stat-chip is-more';
                    more.textContent = `+${counts.size - 4}`;
                    stats.appendChild(more);
                }
            }

            const multi = document.createElement('span');
            multi.className = 'gathering-ammo-multicast session-charge-multicast';
            multi.textContent = `x${1 + model.multicast}`;

            panel.append(charge, main, stats, multi);
            fragment.appendChild(panel);
        });
        stack.appendChild(fragment);
        return true;
    },

    _hud_updateLegacyHitProgress(val, target) {
        const hitText = document.getElementById('hit-text');
        if (hitText) hitText.innerText = `${val}/${target}`;
        const pct = target > 0 ? Math.min(100, (val / target) * 100) : 0;
        const bar = document.getElementById('hit-bar');
        if (bar) {
            bar.style.width = `${pct}%`;
            if (pct >= 99) {
                bar.classList.add('bar-full');
            } else {
                bar.classList.remove('bar-full');
            }
        }
    },


/**
     * @method ui_getCanvasPointForElement
     * @description 将 DOM 元素中心点从视口坐标转换到当前游戏 canvas 坐标。
     * @param {HTMLElement} el - 目标 DOM 元素。
     * @param {object} options - anchorX / anchorY 控制取点，clamp 控制是否夹到画布内。
     */
    ui_getCanvasPointForElement(el, options = {}) {
        if (!el || typeof el.getBoundingClientRect !== 'function') return null;
        const canvasEl = this.canvas || document.getElementById('gameCanvas');
        const canvasRect = canvasEl && typeof canvasEl.getBoundingClientRect === 'function'
            ? canvasEl.getBoundingClientRect()
            : null;
        if (!canvasRect || !canvasRect.width || !canvasRect.height) return null;
        const canvasLeft = canvasRect.left;
        const canvasTop = canvasRect.top;
        const scaleX = (this.width || canvasRect.width) / canvasRect.width;
        const scaleY = (this.height || canvasRect.height) / canvasRect.height;

        const rect = el.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) return null;

        const anchorX = Number.isFinite(options.anchorX) ? options.anchorX : 0.5;
        const anchorY = Number.isFinite(options.anchorY) ? options.anchorY : 0.5;
        let x = (rect.left + rect.width * anchorX - canvasLeft) * scaleX;
        let y = (rect.top + rect.height * anchorY - canvasTop) * scaleY;

        if (options.clamp !== false) {
            x = Math.max(0, Math.min(this.width || canvasRect.width, x));
            y = Math.max(0, Math.min(this.height || canvasRect.height, y));
        }
        return { x, y, el, rect };
    },


/**
     */
    ui_updateUICache() {
        const gaugeEl = document.getElementById('hero-gauge-container');
        if (gaugeEl) {
            const panelStack = document.getElementById('session-charge-stack');
            const targetEl = panelStack && !panelStack.classList.contains('hidden') && panelStack.children.length > 0
                ? panelStack
                : gaugeEl;
            const targetPoint = this.ui_getCanvasPointForElement
                ? this.ui_getCanvasPointForElement(targetEl)
                : null;
            // 缓存中心坐标
            this.uiCache = {
                x: targetPoint ? targetPoint.x : this.width / 2,
                y: targetPoint ? targetPoint.y : this.height - 100,
                // 缓存 DOM 引用，避免重复查询
                el: targetEl,
                targetEl,
                pulseLayer: document.getElementById('gauge-pulse-layer'),
                gaugeShell: document.getElementById('gauge-shell')
            };
        } else {
            // 兜底坐标
            this.uiCache = { x: this.width / 2, y: this.height - 100, el: null };
        }
    },


/**
    /**
     * @method updateGatheringQueueUI
     * @description 更新收集阶段的弹珠队列UI。
     */
    ui_updateGatheringQueueUI() { 
        const q = document.getElementById('gathering-queue'); 
        const renderedPanels = typeof this._hud_renderSessionChargeStack === 'function'
            ? this._hud_renderSessionChargeStack()
            : false;
        if (!q) return;
        q.innerHTML = ''; 
        q.classList.toggle('hidden', renderedPanels);
        if (renderedPanels) return;
        for(let i = this.activeMarbleIndex; i < this.marbleQueue.length; i++) {  // [Mixin 正常用法：读取 Game 实例状态]
            const m = this.marbleQueue[i];  // [Mixin 正常用法：读取 Game 实例状态]
            const d = document.createElement('div'); 
            d.className = 'queue-dot flex-shrink-0'; 
            d.style.background = m.type === 'rainbow'
                ? CONFIG.colors.marbleRainbow
                : (typeof m.getColor === 'function' ? m.getColor() : (m.color || '#e2e8f0'));
            q.appendChild(d); 
        } 
    },


/**
     * @method updateAmmoUI
     * @description 更新战斗阶段的双槽位弹药UI (Current & Next)
     */
    ui_updateAmmoUI() {
        const currentContainer = document.getElementById('current-ammo-render');
        const nextContainer = document.getElementById('next-ammo-render');
        const statsContainer = document.getElementById('current-bullet-stats');
        
        if (!currentContainer || !nextContainer) return;

        // 清空当前内容
        currentContainer.innerHTML = '';
        nextContainer.innerHTML = '';

        // 1. 渲染当前弹药 (Queue[0])
        if (this.ammoQueue.length > 0) {  // [Mixin 正常用法：读取 Game 实例状态]
            const currentRecipe = this.ammoQueue[0];  // [Mixin 正常用法：读取 Game 实例状态]
            const currentProfile = getAmmoReadabilityProfile(currentRecipe);
            this.ui_renderAmmoIcon(currentContainer, currentRecipe, true);
            
            // 更新底部属性文本
            let html = `<span style="color:${currentProfile.primary.color}" class="font-bold">${currentProfile.attributeSummary}</span>`;
            if (currentProfile.scatter > 0) html += `<span class="text-amber-200">散${currentProfile.scatterPelletCount}</span>`;
            if (currentProfile.multicast > 0) html += `<span class="text-cyan-200">x${currentProfile.multicastCount}</span>`;
            if (currentRecipe.damage > 2) html += `<span class="text-purple-300">⚔️${currentRecipe.damage}</span>`;
            else html += `<span class="text-slate-400">⚔️${currentRecipe.damage}</span>`;

            Object.keys(CONFIG.ui.attributeDisplay).forEach((_type) => {
                if (currentRecipe[_type]) html += `<span class="text-green-300">${CONFIG.ui.attributeDisplay[_type].icon}${currentRecipe[_type]}</span>`;
            })
            if(html === '') html = '<span class="text-slate-500">基础弹药</span>';
            statsContainer.innerHTML = html;
            
            // 移除发射动画类（如果是重新渲染）
            currentContainer.classList.remove('shoot-anim');
        } else {
            currentContainer.innerHTML = '<span class="text-slate-600 text-xs">EMPTY</span>';
            statsContainer.innerHTML = '<span class="text-slate-600">-- 弹药耗尽 --</span>';
        }

        // 2. 渲染下一发弹药 (Queue[1])
        if (this.ammoQueue.length > 1) {  // [Mixin 正常用法：读取 Game 实例状态]
            const nextRecipe = this.ammoQueue[1];  // [Mixin 正常用法：读取 Game 实例状态]
            this.ui_renderAmmoIcon(nextContainer, nextRecipe, false);
            nextContainer.title = getAmmoReadabilityProfile(nextRecipe).summary;
        } else {
            nextContainer.innerHTML = '<span class="text-slate-700 text-xs">--</span>';
            nextContainer.removeAttribute('title');
        }
    },


/**
     * 辅助方法：在UI中绘制一个纯CSS的子弹图标
     */
    ui_renderAmmoIcon(container, recipe, isCurrent) {
        const size = isCurrent ? 24 : 16;
        const div = document.createElement('div');
        const profile = getAmmoReadabilityProfile(recipe);
        container.title = profile.summary;

        // [Phase 5A Task 5.A5] 位图法球图标
        const iconSrc = getAmmoIconSrc(recipe);
        const recipeType = recipe.type || recipe._marbleType;
        if (iconSrc) {
            // 位图模式：使用 32×32 炼金法球位图
            div.style.width = `${size}px`;
            div.style.height = `${size}px`;
            div.style.backgroundImage = `url('${iconSrc}')`;
            div.style.backgroundSize = 'contain';
            div.style.backgroundRepeat = 'no-repeat';
            div.style.backgroundPosition = 'center';
            div.style.position = 'relative';
            div.style.filter = `${div.style.filter || ''} drop-shadow(0 0 ${Math.round(2 + profile.signalRatio * 5)}px ${profile.primary.color})`.trim();
            // 激光特效：保留发光 filter
            if (recipe.isLaser) {
                const glowSize = 10 + (recipe.laser || 0) * 2;
                div.style.filter = `drop-shadow(0 0 ${Math.round(glowSize/3)}px ${CONFIG.colors.laser})`;
            }
        } else {
            // Fallback：原有纯色圆形（无位图时保持可用）
            div.style.width = `${size}px`;
            div.style.height = `${size}px`;
            div.style.borderRadius = '50%';
            let bg = '#e2e8f0';
            let shadow = 'none';
            if (recipe.isLaser) {
                bg = '#ffffff';
                const glowSize = 10 + (recipe.laser || 0) * 2;
                shadow = `0 0 ${glowSize}px ${CONFIG.colors.laser}, inset 0 0 5px ${CONFIG.colors.laser}`;
            } else if (recipe.explosive) { bg = '#fca5a5'; shadow = '0 0 10px #ef4444'; }
            else if (recipe.pyro)       { bg = '#fdba74'; shadow = '0 0 8px #f97316'; }
            else if (recipe.cryo)       { bg = '#cffafe'; shadow = '0 0 8px #06b6d4'; }
            else if (recipe.lightning)  { bg = '#e9d5ff'; shadow = '0 0 8px #c084fc'; }
            else if (recipe.pierce)     { bg = '#fecaca'; }
            else if (recipe.bounce)     { bg = '#bbf7d0'; }
            else if (recipe.venom || recipeType === 'venom') { bg = '#bbf7d0'; shadow = '0 0 8px #4ade80'; }
            else if (recipe.overcharge || recipeType === 'overcharge') { bg = '#fde68a'; shadow = '0 0 8px #f59e0b'; }
            else if (recipe.echo || recipeType === 'echo') { bg = '#bfdbfe'; shadow = '0 0 8px #60a5fa'; }
            div.style.background = bg;
            div.style.boxShadow = shadow;
            div.style.position = 'relative';
            if (recipe.isLaser)  div.style.border = '2px solid #fff';
            if (recipe.scatter)  div.style.border = '2px solid #facc15';
            if (recipe.venom || recipeType === 'venom') div.style.border = '2px solid #4ade80';
            if (recipe.overcharge || recipeType === 'overcharge') div.style.border = '2px solid #f59e0b';
            if (recipe.echo || recipeType === 'echo') div.style.border = '2px solid #60a5fa';
        }

        // multicast 角标（位图/fallback 均保留）
        if (recipe.multicast) {
            const badge = document.createElement('div');
            badge.innerText = `x${profile.multicastCount}`;
            badge.className = 'absolute -top-2 -right-2 text-[10px] bg-orange-500 text-white rounded-full px-1 font-bold leading-tight';
            container.appendChild(badge);
        }

        container.appendChild(div);
    },

    /**
     * @method hud_initEventListeners
     * @description [Task 3.2] 注册 EventBus 监听器，响应业务层发出的 UI 更新事件。
     *   在游戏初始化时调用（sys_initGame 或 sys_resetGame 中）。
     */
      hud_initEventListeners() {
        // @section:hud_multicast_listeners - 连射倍率显示与飞行特效事件监听器
        // ── 连射倍率显示 ────────────────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_MULTICAST_UPDATE, ({ total, bonusAmount }) => {
            if (typeof this._hud_renderSessionChargeStack === 'function') {
                this._hud_renderSessionChargeStack();
            }
            const ui = document.getElementById('multicast-ui');
            const num = document.getElementById('multicast-num');
            if (ui && num) {
                ui.classList.add('multicast-visible');
                num.innerText = `x${total}`;
                if (bonusAmount > 0) {
                    ui.classList.remove('multicast-pop');
                    void ui.offsetWidth;
                    ui.classList.add('multicast-pop');
                    num.classList.add('multicast-flash');
                    setTimeout(() => num.classList.remove('multicast-flash'), 300);
                }
            }
        });

        // ── 倍率转移飞行特效 ──────────────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_MULTICAST_TRANSFER, ({ multicastValue, activeMarbleIndex }) => {
            const startEl = document.querySelector(`.gathering-ammo-panel[data-marble-index="${activeMarbleIndex}"] .gathering-ammo-multicast`)
                || document.querySelector(`.session-charge-row[data-marble-index="${activeMarbleIndex}"] .session-charge-multicast`)
                || document.getElementById('multicast-ui');
            const targetEl = document.querySelector(`#gathering-hud-mount .recipe-card:nth-child(${activeMarbleIndex + 1})`);
            if (!startEl || !targetEl) return;
            const startRect = startEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const flyer = document.createElement('div');
            flyer.className = 'flying-badge';
            flyer.innerText = `x${multicastValue}`;
            const startX = startRect.left + startRect.width / 2 - 20;
            const startY = startRect.top + startRect.height / 2 - 20;
            flyer.style.left = `${startX}px`;
            flyer.style.top = `${startY}px`;
            flyer.style.transform = 'scale(1.2)';
            document.body.appendChild(flyer);
            requestAnimationFrame(() => {
                const targetX = targetRect.left + targetRect.width / 2 - 20;
                const targetY = targetRect.top + targetRect.height / 2 - 20;
                flyer.style.left = `${targetX}px`;
                flyer.style.top = `${targetY}px`;
                flyer.classList.add('arrived');
            });
            setTimeout(() => {
                flyer.remove();
                targetEl.style.transition = 'none';
                targetEl.style.filter = 'brightness(2) drop-shadow(0 0 10px orange)';
                targetEl.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    targetEl.style.transition = 'all 0.3s';
                    targetEl.style.filter = 'none';
                    targetEl.style.transform = 'scale(1)';
                }, 100);
            }, 600);
        });

        // ── 命中进度条 ────────────────────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_HIT_PROGRESS, ({ val, target }) => {
            const renderedStack = typeof this._hud_renderSessionChargeStack === 'function'
                ? this._hud_renderSessionChargeStack()
                : false;
            if (renderedStack) return;
            const hitText = document.getElementById('hit-text');
            if (hitText) hitText.innerText = `${val}/${target}`;
            const pct = target > 0 ? Math.min(100, (val / target) * 100) : 0;
            const bar = document.getElementById('hit-bar');
            if (bar) {
                bar.style.width = `${pct}%`;
                if (pct >= 99) {
                    bar.classList.add('bar-full');
                } else {
                    bar.classList.remove('bar-full');
                }
            }
        });

        // @section:hud_ammo_listeners - 弹药发射动画与命中进度条事件监听器
        // ── 弹药发射动画 ────────────────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_AMMO_FIRED, () => {
            const currentSlot = document.getElementById('current-ammo-render');
            if (currentSlot) {
                currentSlot.classList.add('shoot-anim');
                setTimeout(() => {
                    this.ui_updateAmmoUI();
                    const newCurrent = document.getElementById('current-ammo-render');
                    if (newCurrent) {
                        newCurrent.classList.add('slide-in-anim');
                        setTimeout(() => newCurrent.classList.remove('slide-in-anim'), 400);
                    }
                }, 150);
            } else {
                this.ui_updateAmmoUI();
            }
        });

        // @section:hud_rune_charge_listeners - 技能充能初始化/升级/进度更新事件监听器
        // ── 技能充能 UI 初始化 ──────────────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_SKILL_CHARGE_INIT, ({ actualValue = 0, tempValue = 0, totalValue } = {}) => {
            // 持久条跨回合保留：回合开始时按当前持久条数值渲染，而非强制清零。
            const actual = Math.max(0, Math.min(1, actualValue));
            const total = Math.max(0, Math.min(1, totalValue ?? (actual + tempValue)));
            const temporary = Math.max(0, Math.min(1 - actual, total - actual));
            const meter = document.getElementById('combat-rune-charge-ui');
            if (meter) {
                meter.classList.remove('skill-charge-bursting');
                meter.style.setProperty('--skill-charge-actual', `${actual * 100}%`);
                meter.style.setProperty('--skill-charge-temp', `${temporary * 100}%`);
                meter.style.setProperty('--skill-charge-total', `${total * 100}%`);
            }
            const slot = document.getElementById('combat-rune-single-slot');
            if (slot) {
                // 保留 glow-overlay，清除其他内容
                const glowOverlay = slot.querySelector('.rune-slot-glow-overlay');
                slot.innerHTML = '';
                if (glowOverlay) slot.appendChild(glowOverlay);
                const mark = document.createElement('span');
                mark.className = 'skill-charge-slot-mark';
                mark.textContent = 'SP';
                slot.appendChild(mark);
                slot.className = 'empty skill-charge-slot';
            }
            const fill = document.getElementById('combat-charge-bar-fill');
            if (fill) {
                fill.classList.remove('charge-burst');
                fill.style.width = `${total * 100}%`;
            }
            const tempFill = document.getElementById('combat-charge-bar-temp-fill');
            if (tempFill) {
                tempFill.style.left = `${actual * 100}%`;
                tempFill.style.width = `${temporary * 100}%`;
            }
        });

        // ── 充能满 → 发放技能点反馈（带闪光特效）────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_SKILL_CHARGE_LEVEL_UP, ({ awarded = 1 }) => {
            const meter = document.getElementById('combat-rune-charge-ui');
            const slot = document.getElementById('combat-rune-single-slot');
            const shell = document.getElementById('combat-charge-bar-shell');
            const fill = document.getElementById('combat-charge-bar-fill');
            const tempFill = document.getElementById('combat-charge-bar-temp-fill');

            if (meter) {
                meter.classList.remove('skill-charge-bursting');
                void meter.offsetWidth;
                meter.classList.add('skill-charge-bursting');
                setTimeout(() => meter.classList.remove('skill-charge-bursting'), 560);
                setTimeout(() => {
                    meter.style.setProperty('--skill-charge-actual', '0%');
                    meter.style.setProperty('--skill-charge-temp', '0%');
                    meter.style.setProperty('--skill-charge-total', '0%');
                }, 400);
            }

            // 充能条闪光脱去动画
            if (fill) {
                fill.classList.remove('charge-burst');
                void fill.offsetWidth; // 重流
                fill.classList.add('charge-burst');
                setTimeout(() => {
                    fill.classList.remove('charge-burst');
                    fill.style.width = '0%';
                }, 400);
            }
            if (tempFill) {
                tempFill.style.left = '0%';
                tempFill.style.width = '0%';
            }

            // 外壳发光
            if (shell) {
                shell.classList.add('charge-full-flash');
                setTimeout(() => shell.classList.remove('charge-full-flash'), 450);
            }

            // 技能点槽刷新
            if (slot) {
                slot.classList.remove('rune-refresh');
                void slot.offsetWidth; // 重流
                const glowOverlay = slot.querySelector('.rune-slot-glow-overlay');
                slot.innerHTML = '';
                if (glowOverlay) slot.appendChild(glowOverlay);
                const mark = document.createElement('span');
                mark.className = 'skill-charge-slot-mark skill-charge-slot-mark--gain';
                mark.textContent = `+${awarded} SP`;
                slot.appendChild(mark);
                slot.className = 'has-rune rune-refresh skill-charge-slot skill-charge-awarding';
                setTimeout(() => {
                    slot.classList.remove('rune-refresh');
                    const currentGlow = slot.querySelector('.rune-slot-glow-overlay');
                    slot.innerHTML = '';
                    if (currentGlow) slot.appendChild(currentGlow);
                    const steadyMark = document.createElement('span');
                    steadyMark.className = 'skill-charge-slot-mark';
                    steadyMark.textContent = 'SP';
                    slot.appendChild(steadyMark);
                    slot.className = 'empty skill-charge-slot';
                }, 650);
            }
        });

        // ── 充能条进度更新 ────────────────────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_SKILL_CHARGE_UPDATE, ({ value, actualValue, tempValue, totalValue }) => {
            const meter = document.getElementById('combat-rune-charge-ui');
            const fill = document.getElementById('combat-charge-bar-fill');
            const tempFill = document.getElementById('combat-charge-bar-temp-fill');
            const actual = Math.max(0, Math.min(1, actualValue ?? value ?? 0));
            const total = Math.max(0, Math.min(1, totalValue ?? value ?? actual));
            const temporary = Math.max(0, Math.min(1 - actual, tempValue ?? (total - actual)));
            if (meter) {
                meter.style.setProperty('--skill-charge-actual', `${actual * 100}%`);
                meter.style.setProperty('--skill-charge-temp', `${temporary * 100}%`);
                meter.style.setProperty('--skill-charge-total', `${total * 100}%`);
            }
            // One visual bar: the base fill is total charge; temp fill is a decaying overlay zone.
            if (fill && !fill.classList.contains('charge-burst')) {
                fill.style.width = `${total * 100}%`;
            }
            if (tempFill) {
                tempFill.style.left = `${actual * 100}%`;
                tempFill.style.width = `${temporary * 100}%`;
            }
        });

         // @section:hud_rune_claim_listeners - 符文领取飞入背包动画事件监听器（回局结束与敌人动作后）
        // ── 回局结束领取符文 → 入背包动画 ────────────────────────────────────
        eventBus.on(EVENT_TYPES.UI_RUNE_CHARGE_CLAIM, ({ runeDef, level }) => {
            const slot = document.getElementById('combat-rune-single-slot');
            if (!slot || !runeDef) return;
            _playRuneAcquireReveal(runeDef, level, 0);

            // 获取符文槽屏幕位置
            const slotRect = slot.getBoundingClientRect();
            const startX = slotRect.left + slotRect.width / 2;
            const startY = slotRect.top + slotRect.height / 2;

             // 创建飞行符文元素（使用新的 rune-icon-frame 系统）
            const flyEl = document.createElement('div');
            flyEl.className = 'rune-claim-fly';
            flyEl.style.left = `${startX - 18}px`;
            flyEl.style.top  = `${startY - 18}px`;
            // 水平偏移量：小幅左右随机浮动
            flyEl.style.setProperty('--fly-dx', `${(Math.random() - 0.5) * 30}px`);
            // 飞行元素内容：带稀有度边框和等级角标的符文图标
            flyEl.style.fontSize = '22px';
            const flyIconFrame = _buildRuneIconEl(runeDef, level);
            flyEl.appendChild(flyIconFrame);
            document.body.appendChild(flyEl);
            // 符文槽消失动画
            slot.classList.remove('rune-refresh');
            void slot.offsetWidth;
            slot.classList.add('rune-claim-out');
            // 动画结束后清理
            setTimeout(() => {
                flyEl.remove();
                // 保留 glow-overlay，清除其他内容
                const glowOverlay = slot.querySelector('.rune-slot-glow-overlay');
                slot.innerHTML = '';
                if (glowOverlay) slot.appendChild(glowOverlay);
                slot.className = 'empty';
            }, 900);
        });

        // ── 敌人动作后领取符文 → 多个符文依次飞入背包动画 ────────────────
        eventBus.on(EVENT_TYPES.UI_RUNE_CLAIM_AFTER_ENEMY, ({ runes }) => {
            if (!runes || runes.length === 0) return;

            // 获取目标区域：符文库存计数显示元素（飞入背包的终点）
            const targetEl = document.getElementById('rune-inventory-count') 
                          || document.getElementById('rune-inventory-container');

            runes.forEach((runeInfo, index) => {
                const { runeDef, level, source, x: lootX, y: lootY } = runeInfo;
                if (!runeDef) return;
                _playRuneAcquireReveal(runeDef, level, index * 150);

                // 延迟播放，多个符文依次错开（每个间隔 150ms）
                setTimeout(() => {
                    // 确定起始位置
                    let startX, startY;
                    if (source === 'charge') {
                        // 旧充能符文兼容路径：从充能槽位置出发
                        const chargeSlot = document.getElementById('combat-rune-single-slot');
                        if (chargeSlot) {
                            const rect = chargeSlot.getBoundingClientRect();
                            startX = rect.left + rect.width / 2;
                            startY = rect.top + rect.height / 2;
                        } else {
                            startX = window.innerWidth / 2;
                            startY = window.innerHeight / 2;
                        }
                    } else {
                        // 掉落符文：从 canvas 坐标转换为屏幕坐标
                        const canvas = document.getElementById('gameCanvas');
                        if (canvas && lootX != null && lootY != null) {
                            const canvasRect = canvas.getBoundingClientRect();
                            const scaleX = canvasRect.width  / (canvas.width  || canvasRect.width);
                            const scaleY = canvasRect.height / (canvas.height || canvasRect.height);
                            startX = canvasRect.left + lootX * scaleX;
                            startY = canvasRect.top  + lootY * scaleY;
                        } else {
                            startX = window.innerWidth / 2;
                            startY = window.innerHeight / 3;
                        }
                    }

                    // 确定终点位置：符文库存区域
                    let endX = window.innerWidth - 60;
                    let endY = window.innerHeight - 60;
                    if (targetEl) {
                        const targetRect = targetEl.getBoundingClientRect();
                        endX = targetRect.left + targetRect.width / 2;
                        endY = targetRect.top  + targetRect.height / 2;
                    }

                    // 创建飞行符文元素
                    const flyEl = document.createElement('div');
                    flyEl.className = 'rune-claim-fly rune-claim-fly--to-bag';
                    flyEl.style.left = `${startX - 18}px`;
                    flyEl.style.top  = `${startY - 18}px`;
                    // 设置飞入背包的终点偏移量
                    flyEl.style.setProperty('--fly-to-x', `${endX - startX}px`);
                    flyEl.style.setProperty('--fly-to-y', `${endY - startY}px`);
                    flyEl.style.fontSize = '22px';

                    // 符文图标（带稀有度边框和等级角标）
                    const flyIconFrame = _buildRuneIconEl(runeDef, level);
                    flyEl.appendChild(flyIconFrame);
                    document.body.appendChild(flyEl);

                    // 旧充能符文兼容路径的消失动画
                    if (source === 'charge') {
                        const slot = document.getElementById('combat-rune-single-slot');
                        if (slot) {
                            slot.classList.remove('rune-refresh');
                            void slot.offsetWidth;
                            slot.classList.add('rune-claim-out');
                        }
                    }

                    // 动画结束后清理，并刷新背包显示
                    setTimeout(() => {
                        flyEl.remove();
                        if (source === 'charge') {
                            const slot = document.getElementById('combat-rune-single-slot');
                            if (slot) {
                                const glowOverlay = slot.querySelector('.rune-slot-glow-overlay');
                                slot.innerHTML = '';
                                if (glowOverlay) slot.appendChild(glowOverlay);
                                slot.className = 'empty';
                            }
                        }
                        // 最后一个符文飞入后刷新背包显示
                        if (index === runes.length - 1) {
                            this.ui_updateRuneGrid && this.ui_updateRuneGrid();
                        }
                    }, 900);
                }, index * 150);
            });
        });
    },

    /**
     * 构建继承加成卡片：展示当前所有附加属性、伤害继承
     * - 全局基础伤害加成（flatDamageBonus 来自 alchemist_powder_tube 等遗物）
     * - 嗜血初锋累计击杀加成（runewordKillCount，三角阈值）
     * - 词条共鸣属性加成（runewordStats）
     * @returns {HTMLElement|null}
     * @private
     */
    _buildInheritanceCard() {
        const flatDmg = this.flatDamageBonus || 0;
        const killCount = this.runewordKillCount || 0;
        const bloodthirstFx = this.activeRunewordEffects && this.activeRunewordEffects['bloodthirst_growth'];
        let bloodthirstBonus = 0;
        if (bloodthirstFx && killCount > 0) {
            const damagePerKill = (bloodthirstFx.params && bloodthirstFx.params.damagePerKill) || 0;
            const bonusTier = Math.floor((-1 + Math.sqrt(1 + 8 * killCount)) / 2);
            bloodthirstBonus = damagePerKill * bonusTier;
        }

        let runewordStats = {};
        if (this.runewordStats && typeof this.runewordStats === 'object') runewordStats = this.runewordStats;

        const runewordEntries = Object.entries(runewordStats).filter(([, v]) => v > 0);

        if (flatDmg <= 0 && bloodthirstBonus <= 0 && runewordEntries.length === 0) {
            return null;
        }

        const card = document.createElement('div');
        card.className = 'recipe-card mb-1';
        card.style.cssText = 'background:rgba(15,23,42,0.85);border:1px solid rgba(168,85,247,0.4);border-radius:6px;padding:4px 6px;';

        const header = document.createElement('div');
        header.className = 'border-b border-purple-500/20 pb-0.5 mb-1';
        header.innerHTML = '<span class="font-bold text-purple-300 text-[10px] tracking-wider">✨ 继承加成</span>';
        card.appendChild(header);

        const lines = [];
        if (flatDmg > 0) lines.push(`<span class="text-amber-300">⚔️ 基础伤害 +${flatDmg}</span>`);
        if (bloodthirstBonus > 0) lines.push(`<span class="text-red-300">🩸 嗜血 +${bloodthirstBonus} (${killCount}杀)</span>`);
        runewordEntries.forEach(([k, v]) => {
            const info = STAT_DISPLAY[k] || { name: k, icon: '' };
            lines.push(`<span class="text-amber-300">${info.icon} ${info.name} +${v}</span>`);
        });

        const grid = document.createElement('div');
        grid.className = 'flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] leading-tight';
        grid.innerHTML = lines.join('');
        card.appendChild(grid);
        return card;
    },

};

// 暴露到全局，供向后兼容
window.hud_system = hud_system;
