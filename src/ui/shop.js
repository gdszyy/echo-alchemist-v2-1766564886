/**
 * src/ui/shop.js - 商店/选择界面渲染模块
 * 
 * 职责：局外商店和遗物选择界面的渲染
 * - 商店物品列表渲染（分类标签、升级卡片）
 * - 遗物选择界面（加权随机抽取、卡片渲染）
 * - 价格显示和购买反馈
 * - 遗物选择/跳过/关闭逻辑
 * 
 * 通信方式：通过 bind(this) 组合模式注入到 Game 实例
 * [Task 3.2 说明] 此模块作为实例方法注入 Game 实例，读取 this.xxx 是架构正常用法
 * 
 * @module ui/shop
 */

import { META_SHOP_CONFIG, CONFIG, RELIC_DB, BOARD_STRUCTURE_RELICS } from '../config.js';
import { RUNE_DB } from '../rune_config.js';
import { showToast } from '../entities.js';
import { eventBus } from '../event_bus.js';
import { getRelicIconSrc } from '../bitmap_icons.js'; // [Phase 5A Task 5.A7] 位图遗物图标
import { createModuleInstance, getActiveModuleSlots } from '../pinboard_modules.js';

// ==================== [v2 即时感重塑] 子弹评分与属性操作辅助函数 ====================
// 这些工具函数被 mirror_magazine / element_injector 调用以判定"最强/最弱"子弹与属性翻倍。
// 评分采用：基础伤害 + 各属性层数加权 + multicast 加成的简单线性叠加，足以稳定排序。

const _ATTR_KEYS = ['cryo', 'pyro', 'lightning', 'laser', 'overcharge', 'wind', 'bounce', 'pierce', 'scatter', 'flying_sword'];

function _scoreRecipeStrength(r) {
    if (!r) return -Infinity;
    let s = (r.damage || 0);
    for (const k of _ATTR_KEYS) s += (r[k] || 0);
    s += (r.multicast || 0) * 2;
    if (r.explosive) s += 3;
    if (r.isLaser) s += 2;
    return s;
}

function _doubleRecipeAttrs(r) {
    if (!r) return;
    for (const k of _ATTR_KEYS) {
        if (typeof r[k] === 'number' && r[k] > 0) r[k] *= 2;
    }
}

// 工具函数：统计 recipe 中实际持有的"属性种类数"（attribute_protocol 使用）
export function recipe_countAttributeKinds(r) {
    if (!r) return 0;
    let n = 0;
    for (const k of _ATTR_KEYS) if (r[k] && r[k] > 0) n++;
    return n;
}

function _isCoarsePointerInput() {
    if (typeof window === 'undefined') return false;
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

function _grantRelicResourcePack(game, multiplier = 0.5) {
    const base = CONFIG.gameplay?.runResourcePackFragments || 48;
    const amount = Math.max(1, Math.round(base * multiplier));
    if (typeof game.spawn_dropRuneFragments === 'function') {
        const x = (game.width || 400) / 2;
        const y = Math.max(90, (game.height || 700) * 0.32);
        game.spawn_dropRuneFragments(x, y, amount, 'resource_pack');
    } else {
        if (typeof game.runFragments !== 'number') game.runFragments = 0;
        if (typeof game.runRuneFragmentsGained !== 'number') game.runRuneFragmentsGained = 0;
        game.runFragments += amount;
        game.runRuneFragmentsGained += amount;
    }
    return amount;
}

/**
 * 商店渲染方法集合
 * 通过 bind(this) 组合模式作为实例方法注入到 Game 实例
 */
export const shop_system = {

    /**
     * 显示遗物选择界面 (支持稀有度权重 + 防重复)
     */
    ui_showRelicSelection(options = {}) {
        // 1. 记录之前的状态 (用于关闭时恢复)
        this.stateBeforeRelic = options.resumeTarget || this.phase;
        const isReroll = options.isReroll === true;

        // --- 配置权重 ---
        const RARITY_WEIGHTS = CONFIG.balance.relicRarityWright;

        // 判断是否处于前三次遗物选择（计数器尚未超过3）
        const isEarlyGame = (this.relicSelectionCount || 0) < 3;

        // 2. 准备遗物池
        // 过滤掉玩家已经拥有的遗物 (this.ownedRelics)
        const fateMomentRewardIds = new Set(['chaos_essence', 'pure_essence']);
        // 开局义务选择（run_start）时排除需要现有弹药序列才能生效的遗物
        const isRunStart = options.source === 'run_start';
        const showAllRelics = options.showAllRelics === true;
        this._lastRelicSelectionOptions = {
            resumeTarget: options.resumeTarget || this.stateBeforeRelic,
            source: options.source || null,
            showAllRelics,
        };
        if (!isReroll) this.relicRerollUsed = false;
        this.relicSelectionContext = showAllRelics && options.source === 'debug_pick_any_relic'
            ? { mode: 'debug_start_relics' }
            : null;
        const ammoRequiredRelics = new Set(['mirror_magazine', 'element_injector']);
        let pool = RELIC_DB.filter(r => {
            if (showAllRelics) return true;
            if (r.deprecated) return false;
            if (fateMomentRewardIds.has(r.id)) return false;
            if (isRunStart && ammoRequiredRelics.has(r.id)) return false;
            const count = (this.ownedRelics || []).filter(id => id === r.id).length;
            const max = r.maxStacks || 1;
            return count < max;
        });

        // 钉盘结构遗物互斥规则：
        // - 布局遗物（triangle/diamond/sparse/mirror_sync/wide_narrow）内部互斥：选了一种布局就不能选其他布局
        // - 行数遗物（dimension_shard / dimension_crystal）内部互斥：两者不能同时拥有，但同种可叠加
        // - 布局遗物与行数遗物不互斥，可同时拥有
        const LAYOUT_RELICS = new Set(['triangle_formation','diamond_formation','sparse_interval','mirror_sync','wide_narrow']);
        const ROW_RELICS = new Set(['dimension_shard','dimension_crystal']);
        const ownedSet = new Set(this.ownedRelics || []);
        const hasLayoutRelic = [...ownedSet].some(id => LAYOUT_RELICS.has(id));
        const ownedRowRelic = [...ownedSet].find(id => ROW_RELICS.has(id));
        // 已选布局遗物：仅排除其他布局遗物（不影响行数遗物）
        if (!showAllRelics && hasLayoutRelic) {
            pool = pool.filter(r => !LAYOUT_RELICS.has(r.id));
        }
        // 已选行数遗物：仅排除另一种行数遗物（不影响布局遗物）
        if (!showAllRelics && ownedRowRelic) {
            pool = pool.filter(r => !(ROW_RELICS.has(r.id) && r.id !== ownedRowRelic));
        }
        
        // 如果池子空了（全收集了），就给一些保底的或者是空的
        if (pool.length === 0) {
            if (window.showToast) showToast("已收集所有遗物！");
            this.ui_closeRelicSelection();
            return;
        }

        const choices = [];
        const choiceNum = (CONFIG.gameplay && CONFIG.gameplay.relicChoiceNum) || 3;
        
        // 3. 抄取遗物 (加权随机 & 不放回)
        // 早期游戏：提高推荐遗物的权重，确保至少出现一个推荐遗物
        const RECOMMENDED_WEIGHT_BOOST = 3; // 推荐遗物权重倍数
        if (showAllRelics) {
            const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4, cursed: 5 };
            choices.push(...pool.slice().sort((a, b) => {
                const byRarity = (rarityOrder[a.rarity] || 99) - (rarityOrder[b.rarity] || 99);
                if (byRarity !== 0) return byRarity;
                return (a.name || a.id).localeCompare(b.name || b.id, 'zh-Hans-CN');
            }));
        } else {
            for(let i=0; i < choiceNum; i++) {
                if(pool.length === 0) break;

                // A. 计算当前临时池子的总权重
                let totalWeight = 0;
                pool.forEach(r => {
                    let w = RARITY_WEIGHTS[r.rarity] || 10;
                    // 早期游戏且该遗物标记为推荐，则提升权重
                    if (isEarlyGame && r.recommended) w *= RECOMMENDED_WEIGHT_BOOST;
                    totalWeight += w;
                });

                // B. 生成随机数 [0, totalWeight)
                let randomVal = Math.random() * totalWeight;
                let selectedIdx = -1;

                // C. 遍历寻找命中的遗物
                for (let j = 0; j < pool.length; j++) {
                    let w = RARITY_WEIGHTS[pool[j].rarity] || 10;
                    if (isEarlyGame && pool[j].recommended) w *= RECOMMENDED_WEIGHT_BOOST;
                    randomVal -= w;
                    if (randomVal <= 0) {
                        selectedIdx = j;
                        break;
                    }
                }

                if (selectedIdx === -1) selectedIdx = 0;

                choices.push(pool[selectedIdx]);
                pool.splice(selectedIdx, 1);
            }
        }

        // 计数器自增（每次打开遗物选择界面时计数）
        if (!showAllRelics && !isReroll) this.relicSelectionCount = (this.relicSelectionCount || 0) + 1;
        const showRecommendation = !showAllRelics && this.relicSelectionCount <= 3;
        const renderRelicPreview = (relic, cardEl) => {
            const preview = document.getElementById('relic-preview-panel');
            if (!preview || !relic) return;
            document.querySelectorAll('#relic-container .relic-card.previewing').forEach(el => el.classList.remove('previewing'));
            if (cardEl) cardEl.classList.add('previewing');

            const count = (this.ownedRelics || []).filter(id => id === relic.id).length;
            const max = relic.maxStacks || 1;
            const stackInfo = max > 1
                ? `<div class="relic-preview-stack">當前層數：${count} / ${max}</div>`
                : '';
            const tagsHtml = (showRecommendation && relic.recommended && Array.isArray(relic.tags))
                ? `<div class="relic-preview-tags">${relic.tags.map(tag => `<span class="relic-tag">${tag}</span>`).join('')}</div>`
                : '';
            const tipHtml = (showRecommendation && relic.recommended && relic.recommendTip)
                ? `<div class="relic-preview-tip">新手推薦：${relic.recommendTip}</div>`
                : '';
            const relicBitmapSrc = getRelicIconSrc(relic.id);
            const iconHtml = relicBitmapSrc
                ? `<img src="${relicBitmapSrc}" alt="${relic.icon}" style="width:100%;height:100%;object-fit:contain;" loading="lazy" onerror="this.style.display='none';this.insertAdjacentText('afterend','${relic.icon}');"/>`
                : relic.icon;

            preview.innerHTML = `
                <div class="relic-preview-header">
                    <div class="relic-preview-icon">${iconHtml}</div>
                    <div>
                        <div class="relic-preview-name">${relic.name}</div>
                        <div class="relic-preview-rarity">${relic.rarity || 'common'}</div>
                    </div>
                </div>
                <div class="relic-preview-desc">${relic.desc}</div>
                ${stackInfo}
                ${tagsHtml}
                ${tipHtml}
            `;
        };

        // 4. 生成 HTML
        const container = document.getElementById('relic-container');
        if (container) {
            container.innerHTML = '';
            
            choices.forEach(relic => {
                const el = document.createElement('div');
                el.className = `relic-card ${relic.rarity || 'common'}`; 
                el.tabIndex = 0;
                el.dataset.rarity = relic.rarity || 'common';
                const count = (this.ownedRelics || []).filter(id => id === relic.id).length;
                const max = relic.maxStacks || 1;
                const stackInfo = max > 1 ? `<div class="relic-stack text-xs text-amber-400 mt-1">当前层数: ${count} / ${max}</div>` : '';
                const debugStartRelicIds = Array.isArray(this.saveData?.debugStartRelicIds)
                    ? this.saveData.debugStartRelicIds
                    : (this.saveData?.debugStartRelicId ? [this.saveData.debugStartRelicId] : []);
                const debugSelected = this.relicSelectionContext?.mode === 'debug_start_relics'
                    && debugStartRelicIds.includes(relic.id);
                if (debugSelected) el.classList.add('selected');
                
                // 推荐标签和 Tip（仅前三次遗物选择且遗物标记为推荐时显示）
                let recommendHtml = '';
                if (showRecommendation && relic.recommended) {
                    const tagsHtml = (relic.tags || []).map(tag => `<span class="relic-tag">${tag}</span>`).join('');
                    recommendHtml = `
                        <div class="relic-recommend-badge">★ 新手推荐</div>
                        <div class="relic-tags">${tagsHtml}</div>
                        <div class="relic-tip">💡 ${relic.recommendTip}</div>
                    `;
                }
                
                // [Phase 5A Task 5.A7] 位图遗物图标：优先使用 64×64 位图，fallback 到 emoji
                const relicBitmapSrc = getRelicIconSrc(relic.id);
                const relicIconHtml = relicBitmapSrc
                    ? `<img src="${relicBitmapSrc}" alt="${relic.icon}" style="width:100%;height:100%;object-fit:contain;" loading="lazy" onerror="this.style.display='none';this.insertAdjacentText('afterend','${relic.icon}');"/>`
                    : relic.icon;
                el.innerHTML = `
                    <div class="relic-icon">${relicIconHtml}</div>
                    <div class="relic-name">${relic.name}</div>
                    <div class="relic-desc">${relic.desc}</div>
                    ${stackInfo}
                    ${recommendHtml}
                `;
                el.onclick = (e) => {
                    e.stopPropagation();
                    if (_isCoarsePointerInput() && el.dataset.touchReady !== 'true') {
                        container.querySelectorAll('.relic-card[data-touch-ready="true"]').forEach(card => {
                            card.dataset.touchReady = 'false';
                        });
                        el.dataset.touchReady = 'true';
                        renderRelicPreview(relic, el);
                        if (window.showToast) showToast('再次點擊以選擇該遺物');
                        return;
                    }
                    this.ui_selectRelic(relic);
                };
                el.onmouseenter = () => renderRelicPreview(relic, el);
                el.onfocus = () => renderRelicPreview(relic, el);
                el.addEventListener('touchstart', () => renderRelicPreview(relic, el), { passive: true });
                container.appendChild(el);
            });
            if (choices.length > 0) {
                renderRelicPreview(choices[0], container.querySelector('.relic-card'));
            } else {
                const preview = document.getElementById('relic-preview-panel');
                if (preview) preview.innerHTML = '';
            }
        }

        // 5. 显示界面
        const overlay = document.getElementById('phase-relic');
        if (overlay) {
            overlay.classList.toggle('relic-debug-picker', showAllRelics);
            const titleEl = overlay.querySelector('.relic-title-block h2');
            const subtitleEl = overlay.querySelector('.relic-title-block p');
            if (titleEl) titleEl.textContent = showAllRelics ? '测试遗物库' : '古代遺物';
            if (subtitleEl) subtitleEl.textContent = showAllRelics ? '点击切换多个开局遗物，返回商店后从首页开始下一局生效' : '命運的饋贈，選擇一種力量';
            const skipBtn = document.getElementById('relic-skip-to-shop-btn');
            if (skipBtn) {
                const skipBonus = ((CONFIG.gameplay || {}).runShopSkipRelicBonus || 0);
                skipBtn.textContent = showAllRelics ? '返回商店' : `放棄遺物 → +${skipBonus} 碎片并进商店`;
                skipBtn.onclick = showAllRelics ? () => this.ui_closeRelicSelection() : () => this.ui_skipRelic();
            }
            let rerollBtn = document.getElementById('relic-reroll-btn');
            if (!rerollBtn && skipBtn && skipBtn.parentNode) {
                rerollBtn = document.createElement('button');
                rerollBtn.id = 'relic-reroll-btn';
                rerollBtn.className = 'mt-3 text-cyan-300 hover:text-cyan-100 text-sm underline cursor-pointer transition-colors';
                skipBtn.parentNode.insertBefore(rerollBtn, skipBtn);
            }
            if (rerollBtn) {
                const hasRerollRelic = (this.ownedRelics || []).includes('relic_reroll_seal');
                const canReroll = !showAllRelics && hasRerollRelic && !this.relicRerollUsed;
                rerollBtn.style.display = canReroll ? 'inline-flex' : 'none';
                rerollBtn.textContent = '刷新遗物候选';
                rerollBtn.onclick = () => this.ui_rerollRelicSelection();
            }
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden-phase');
            overlay.classList.add('active-phase');
        }
        // 通知教程系统：遗物选择界面已打开
        eventBus.emit('tutorial:relic_shown');
    },

    /**
     * 刷新当前遗物候选（由鉴宝重掷印提供，每次遗物选择最多一次）
     */
    ui_rerollRelicSelection() {
        if (!(this.ownedRelics || []).includes('relic_reroll_seal')) {
            if (window.showToast) showToast('需要遗物「鉴宝重掷印」才能刷新遗物候选。');
            return;
        }
        if (this.relicRerollUsed) {
            if (window.showToast) showToast('本次遗物选择已经刷新过。');
            return;
        }
        const options = this._lastRelicSelectionOptions || { resumeTarget: this.stateBeforeRelic || this.phase };
        if (options.showAllRelics) return;
        this.relicRerollUsed = true;
        if (window.showToast) showToast('遗物候选已刷新。');
        this.ui_showRelicSelection({ ...options, isReroll: true });
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    /**
     * 玩家选择遗物
     */
    ui_selectRelic(relic, options = {}) {
        if (this.relicSelectionContext?.mode === 'debug_start_relics') {
            if (!this.saveData) this.saveData = {};
            const selected = Array.isArray(this.saveData.debugStartRelicIds)
                ? this.saveData.debugStartRelicIds.slice()
                : (this.saveData.debugStartRelicId ? [this.saveData.debugStartRelicId] : []);
            const selectedSet = new Set(selected);
            if (selectedSet.has(relic.id)) {
                selectedSet.delete(relic.id);
            } else {
                selectedSet.add(relic.id);
            }
            this.saveData.debugStartRelicIds = [...selectedSet];
            this.saveData.debugStartRelicId = this.saveData.debugStartRelicIds[0] || null;
            if (typeof this.sys_saveData === 'function') this.sys_saveData();
            if (window.showToast) {
                const action = selectedSet.has(relic.id) ? '已加入' : '已移除';
                showToast(`${action}开局遗物：${relic.name}（共 ${this.saveData.debugStartRelicIds.length} 个）`);
            }
            if (typeof this.ui_showRelicSelection === 'function') {
                this.ui_showRelicSelection({
                    ...(this._lastRelicSelectionOptions || {}),
                    resumeTarget: 'shop',
                    source: 'debug_pick_any_relic',
                    showAllRelics: true,
                    isReroll: true,
                });
            }
            return;
        }

        if (!this.ownedRelics) this.ownedRelics = [];
        this.ownedRelics.push(relic.id);
        if (window.showToast) showToast(`獲得遺物: ${relic.name}`);
        
        // 处理遗物效果
        if (relic.effect === 'pink_peg_up') {
            this.pinkPegCount = (this.pinkPegCount || 0) + 3;
        } 
        else if (relic.effect === 'combat_wall') {
            this.hasCombatWall = true;
        } else if (relic.effect === 'permanent_size_up') {
            this.marbleSizeBonus = (this.marbleSizeBonus || 0) + (CONFIG.physics.maxMarbleSizeBonus || 1.6);
        } else if (relic.effect === 'unlock_slot') {
            if (!this.unlockedSlots) this.unlockedSlots = [];
            if (!this.unlockedSlots.includes(relic.slotType)) {
                this.unlockedSlots.push(relic.slotType);
            }
            if (this.slotCount === 0) this.slotCount = 1;
        }
        else if (relic.effect === 'slot_count_up') {
            this.slotCount = (this.slotCount || 0) + 1;
        } else if (relic.effect === 'module_row_unlock') {
            const cfg = CONFIG.gameplay || {};
            const cols = cfg.moduleCols || 5;
            const rows = cfg.moduleRows || 3;
            const totalSlots = cols * rows;
            const beforeSlots = Math.max(0, Math.min(this.unlockedModuleSlots || cfg.moduleDefaultSlots || cols, totalSlots));
            const targetSlots = Math.max(beforeSlots, Math.min(totalSlots, relic.targetSlots || (cols * 2)));
            const beforeActive = new Set(getActiveModuleSlots(beforeSlots, totalSlots, cfg));
            const afterActive = getActiveModuleSlots(targetSlots, totalSlots, cfg);

            if (!Array.isArray(this.currentModuleLayout) || this.currentModuleLayout.length !== totalSlots) {
                const previous = Array.isArray(this.currentModuleLayout) ? this.currentModuleLayout : [];
                this.currentModuleLayout = Array.from({ length: totalSlots }, (_, i) => previous[i] || null);
            }

            this.unlockedModuleSlots = targetSlots;
            for (const slotIdx of afterActive) {
                if (beforeActive.has(slotIdx) || this.currentModuleLayout[slotIdx]) continue;
                this.currentModuleLayout[slotIdx] = createModuleInstance('dense_stagger');
            }

            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(false);
            if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
            if (window.showToast) showToast(`钉盘第二行已解锁：${beforeSlots} → ${targetSlots} 个槽位。`);
        }
        else if (relic.effect === 'bullet_cap_up') {
            this.bulletCapBonus = 0;
            this.selectionRequiredCount = CONFIG.gameplay.selectionReq || 3;
            if (window.showToast) showToast('Core slots fixed at 3. Old bandolier converted to calibration parts.');
        }
        else if (relic.effect === 'row_count_up') {
            this.currentRows = (this.currentRows || 0) + 2;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'row_count_up_1') {
            // 维度碎片（rare）：每次只加 1 行
            this.currentRows = (this.currentRows || 0) + 1;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'flat_damage_up') {
            // 炼金火药管：所有弹珠基础伤害 +N
            const val = relic.flatDamageValue || 2;
            this.flatDamageBonus = (this.flatDamageBonus || 0) + val;
            if (window.showToast) showToast(`炼金火药管已装填！基础伤害 +${val}。`);
        } else if (relic.effect === 'early_temp_shield') {
            const val = relic.shieldValue || 5;
            this.playerShield = (this.playerShield || 0) + val;
            if (window.showToast) showToast(`守护者结界展开！防线屏障 +${val}。`);
        } else if (relic.effect === 'grant_runes') {
            // 走私者系列：立即给予指定稀有度的符文
            this._grantRunesByRarity(relic.grantRarity || 'common', relic.grantCount || 2);
            if (window.showToast) showToast(`获得 ${relic.grantCount} 个${relic.grantRarity === 'common' ? '普通' : relic.grantRarity === 'rare' ? '稀有' : relic.grantRarity === 'epic' ? '史诗' : '传说'}符文！`);
        } else if (relic.effect === 'board_layout_triangle') {
            this.boardLayout = 'triangle';
            // [补偿] 三角形底部钉子极少，+3 行补偿漏斗深度
            this.currentRows = (this.currentRows || CONFIG.gameplay.rows) + 3;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            if (window.showToast) showToast('三角陣形啟動！釘盤 +3 行，漏斗共鳴激活。');
        } else if (relic.effect === 'board_layout_diamond') {
            this.boardLayout = 'diamond';
            // [补偿] 菱形顶底稀疏，+2 行让菱形更饱满
            this.currentRows = (this.currentRows || CONFIG.gameplay.rows) + 2;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            if (window.showToast) showToast('菱形陣形啟動！釘盤 +2 行，中段爆發激活。');
        } else if (relic.effect === 'board_layout_sparse') {
            this.boardLayout = 'sparse';
            // [补偿] 稀疏布局钉子总数约为 default 的 75%，+4 行补偿总量
            this.currentRows = (this.currentRows || CONFIG.gameplay.rows) + 4;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            if (window.showToast) showToast('稀疏間隔啟動！釘盤 +4 行，通道蓄力激活。');
        } else if (relic.effect === 'board_layout_mirror_sync') {
            this.boardLayout = 'mirror_sync';
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'board_layout_wide_narrow') {
            this.boardLayout = 'wide_narrow';
            // [补偿] 宽窄交替分布不均，+2 行轻度补偿
            this.currentRows = (this.currentRows || CONFIG.gameplay.rows) + 2;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            if (window.showToast) showToast('寬窄交替啟動！釘盤 +2 行，邊緣共振激活。');
        } else if (relic.effect === 'unlock_marble') {
            const mt = relic.marbleType;
            const boost = relic.boost || 10;
            const rewardOnlyTypes = new Set(CONFIG.gameplay?.bottomRewardOnlyTypes || []);
            // 1. 所有弹珠默认可出现；遗物只提高该弹珠后续出现权重。
            if (!this.unlockedWeights) this.unlockedWeights = {};
            const current = this.unlockedWeights[mt] || 0;
            this.unlockedWeights[mt] = Math.max(current, CONFIG.probabilities?.[mt] || 0) + Math.floor(boost * 1.5);
            const display = CONFIG.ui?.attributeDisplay?.[mt]?.name || mt;
            if (rewardOnlyTypes.has(mt)) {
                if (window.showToast) showToast(`${display}奖励区权重提升！只能通过底部奖励区获得。`);
                return;
            }
            // 2. 立即提供局内资源包，让玩家去商店消费。
            const packFragments = _grantRelicResourcePack(this, 0.5);
            // 3. 永久翻倍同化概率
            if (!this.assimilationBoostRounds) this.assimilationBoostRounds = {};
            if (!this.doubleAssimilationBoostRounds) this.doubleAssimilationBoostRounds = {};
            this.assimilationBoostRounds[mt] = Infinity;
            this.doubleAssimilationBoostRounds[mt] = Infinity;
            // 4. 提示
            if (window.showToast) showToast(`${display}权重提升！资源包 +${packFragments}，去局内商店换构筑。`);
        } else if (relic.effect === 'assimilation_surge') {
            // [兼容旧存档] 保留旧效果处理
            const mt = relic.marbleType;
            if (!this.guaranteedNextRound) this.guaranteedNextRound = [];
            this.guaranteedNextRound.push(mt);
            this.guaranteedNextRound.push(mt);
            if (!this.assimilationBoostRounds) this.assimilationBoostRounds = {};
            if (!this.doubleAssimilationBoostRounds) this.doubleAssimilationBoostRounds = {};
            this.assimilationBoostRounds[mt] = 2;
            this.doubleAssimilationBoostRounds[mt] = 2;
            const display = CONFIG.ui?.attributeDisplay?.[mt]?.name || mt;
            if (window.showToast) showToast(`${relic.name}已啟動！${display} 同化率 x${CONFIG.gameplay.assimilationDoubleMultiplier || 2}（持續 2 回合）。`);
            _grantRelicResourcePack(this, 0.5);
        } else if (relic.effect === 'pure_essence') {
            const packFragments = _grantRelicResourcePack(this, 0.5);
            if (window.showToast) showToast(`纯净精华已转化为资源包 +${packFragments}，去局内商店消费。`);
        }
        
        if (relic.unlocks) {
            const keys = Array.isArray(relic.unlocks) ? relic.unlocks : [relic.unlocks];
            const boost = relic.boost || 10;
            if (!this.unlockedWeights) this.unlockedWeights = {};
            if (!this.guaranteedNextRound) this.guaranteedNextRound = [];

            keys.forEach(key => {
                const current = this.unlockedWeights[key] || 0;
                this.unlockedWeights[key] = Math.max(current, CONFIG.probabilities?.[key] || 0) + Math.floor(boost * 1.5);
                _grantRelicResourcePack(this, 0.35);
            });
            if (window.showToast) showToast(`相关弹珠权重已提升，并获得局内资源补给。`);
        }

        // ==================== [v2 即时感重塑] 新遗物即时效果分支 ====================
        // 大部分被动遗物（猎人本能/符文共鸣核/末日计时器/余韵回响/混沌爆发/属性协议/殒命爆裂/回廊电弧/贪婪轮盘）
        // 只需要 ownedRelics 标记，运行时由 combat_system / projectile / round_start 钩子读取。
        // 这里仅处理需要"立即修改局内状态"的几个：mirror_magazine / element_injector / chaos_pact。
        if (relic.effect === 'mirror_magazine') {
            // 立即将当前子弹序列中"最强"那颗子弹复制一份加入末尾。
            // 优先操作 ammoQueue（战斗中已发射序列），回退到 _chargedAmmoQueue（命运选择后充能序列）。
            const liveQueue = (this.ammoQueue && this.ammoQueue.length > 0) ? this.ammoQueue : null;
            const chargedQueue = (this._chargedAmmoQueue && this._chargedAmmoQueue.length > 0) ? this._chargedAmmoQueue : null;
            const queue = liveQueue || chargedQueue;
            if (queue) {
                let bestIdx = 0;
                let bestScore = -Infinity;
                for (let i = 0; i < queue.length; i++) {
                    const s = _scoreRecipeStrength(queue[i]);
                    if (s > bestScore) { bestScore = s; bestIdx = i; }
                }
                const cloned = JSON.parse(JSON.stringify(queue[bestIdx]));
                queue.push(cloned);
                if (window.showToast) showToast(`镜像弹夹：复制了一颗强力子弹！`);
            } else {
                if (window.showToast) showToast(`镜像弹夹：当前无弹药可复制。`);
            }
        } else if (relic.effect === 'element_injector') {
            // 删除当前子弹序列中最强和最弱的子弹，剩下那颗的所有属性层数翻倍。
            // 优先操作 ammoQueue，回退到 _chargedAmmoQueue。
            const liveQueue = (this.ammoQueue && this.ammoQueue.length > 0) ? this.ammoQueue : null;
            const chargedQueue = (this._chargedAmmoQueue && this._chargedAmmoQueue.length > 0) ? this._chargedAmmoQueue : null;
            const usingCharged = !liveQueue && !!chargedQueue;
            const queue = liveQueue || chargedQueue || [];
            if (queue.length >= 3) {
                const scored = queue.map((r, i) => ({ i, score: _scoreRecipeStrength(r) }));
                scored.sort((a, b) => a.score - b.score);
                const minIdx = scored[0].i;
                const maxIdx = scored[scored.length - 1].i;
                const removeSet = new Set([minIdx, maxIdx]);
                const remaining = [];
                for (let i = 0; i < queue.length; i++) {
                    if (!removeSet.has(i)) remaining.push(queue[i]);
                }
                remaining.forEach(_doubleRecipeAttrs);
                if (usingCharged) { this._chargedAmmoQueue = remaining; }
                else { this.ammoQueue = remaining; }
                if (window.showToast) showToast(`元素注入器：剩余子弹属性层数翻倍！`);
            } else if (queue.length === 2) {
                // 边界：仅 2 颗，删除最弱，保留最强并翻倍
                const s0 = _scoreRecipeStrength(queue[0]);
                const s1 = _scoreRecipeStrength(queue[1]);
                const survivor = s0 >= s1 ? queue[0] : queue[1];
                _doubleRecipeAttrs(survivor);
                if (usingCharged) { this._chargedAmmoQueue = [survivor]; }
                else { this.ammoQueue = [survivor]; }
                if (window.showToast) showToast(`元素注入器：仅 2 颗子弹，强者属性翻倍！`);
            } else if (queue.length === 1) {
                _doubleRecipeAttrs(queue[0]);
                if (window.showToast) showToast(`元素注入器：唯一子弹属性翻倍！`);
            } else {
                if (window.showToast) showToast(`元素注入器：当前无弹药可注入。`);
            }
        } else if (relic.effect === 'chaos_pact') {
            // 立即获得 3 个随机稀有符文 + 设置永久伤害倍率
            this._grantRunesByRarity('rare', 3);
            this.chaosPactDamageMult = (this.chaosPactDamageMult || 1) * 2.0;
            if (window.showToast) showToast(`混沌契约已签订！子弹伤害 ×2，但研磨阶段被禁用。`);
        }
        // ============================================================================

        if (!options.skipClose) this.ui_closeRelicSelection();
    },

    /**
     * 跳过遗物选择 → 进入局内商店
     * [v2 调整] 不再奖励 500 score；改为打开局内商店，本回合丧失遗物。
     * 商店关闭后接续 round-start resolver，继续后续遗物/弹珠包流程。
     */
    ui_skipRelic() {
        const skipBonus = ((CONFIG.gameplay || {}).runShopSkipRelicBonus || 0);
        if (skipBonus > 0) {
            this.runFragments = (this.runFragments || 0) + skipBonus;
            if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        }
        if (window.showToast) showToast(skipBonus > 0 ? `放棄遗物，获得 ${skipBonus} 碎片` : "放棄遗物，进入局内商店");
        // 关闭遗物界面，但不进入下一阶段；改为打开商店
        const overlay = document.getElementById('phase-relic');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active-phase');
            overlay.classList.remove('relic-debug-picker');
            overlay.classList.add('hidden-phase');
        }
        this.relicSelectionContext = null;
        this._lastRelicSelectionOptions = null;
        this.relicRerollUsed = false;
        const returnState = this.relicOverlayReturnState || { phase: this.stateBeforeRelic };
        this.relicOverlayReturnState = null;
        // 标记本回合已弃权遗物，避免回到 resolver 时再次弹出（防止重复打开）
        this._relicSkippedThisRound = true;
        if (typeof this.ui_showRunShop === 'function') {
            this.ui_showRunShop(() => {
                // 商店关闭后回到原 resolver / phase，但本次的 relic 奖励已被消费，所以
                // sys_continueRoundStartResolver 会自然处理下一个奖励（如有）。
                if (returnState.phase === 'gathering') {
                    if (typeof this.phase_gathering_attemptComplete === 'function') this.phase_gathering_attemptComplete();
                    return;
                }
                if (returnState.phase === 'selection') {
                    if (typeof this.phase_switchPhase === 'function') this.phase_switchPhase('selection');
                    if (typeof this.ui_refreshSelectionModeUI === 'function') this.ui_refreshSelectionModeUI();
                    return;
                }
                if (returnState.phase === 'round_start_resolver') {
                    if (typeof this.sys_continueRoundStartResolver === 'function') this.sys_continueRoundStartResolver();
                    return;
                }
                if (typeof this.sys_initSelectionPhase === 'function') this.sys_initSelectionPhase();
            }, { reason: 'skip_relic' });
        } else {
            // 兜底：商店未挂载时退回原行为
            this.ui_closeRelicSelection();
        }
    },

    /**
     * 关闭界面并恢复
     */
    ui_closeRelicSelection() {
        const overlay = document.getElementById('phase-relic');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active-phase');
            overlay.classList.remove('relic-debug-picker');
            overlay.classList.add('hidden-phase');
        }
        this.relicSelectionContext = null;
        this._lastRelicSelectionOptions = null;
        this.relicRerollUsed = false;

        const returnState = this.relicOverlayReturnState || { phase: this.stateBeforeRelic };
        this.relicOverlayReturnState = null;

        if (returnState.phase === 'gathering') {
            if (typeof this.phase_gathering_attemptComplete === 'function') this.phase_gathering_attemptComplete();
            return;
        }

        if (returnState.phase === 'selection') {
            // [BUGFIX] 移除多余的 ui_updateUI() 调用：
            // phase_switchPhase 内部已调用 ui_updateUI()，再重复调用会用旧 selectionMode 覆盖界面。
            if (typeof this.phase_switchPhase === 'function') this.phase_switchPhase('selection');
            if (typeof this.ui_refreshSelectionModeUI === 'function') this.ui_refreshSelectionModeUI();
            return;
        }

        if (returnState.phase === 'round_start_resolver') {
            if (typeof this.sys_continueRoundStartResolver === 'function') this.sys_continueRoundStartResolver();
            return;
        }

        if (returnState.phase === 'shop') {
            if (typeof this.phase_switchPhase === 'function') this.phase_switchPhase('shop');
            if (typeof this.ui_renderShop === 'function') this.ui_renderShop();
            return;
        }

        if (typeof this.sys_initSelectionPhase === 'function') this.sys_initSelectionPhase(); 
    },

    /**
     * [UI] 渲染商店内容
     */
    ui_renderShop() {
        const categoryContainer = document.getElementById('shop-category-tabs');
        const itemsContainer = document.getElementById('shop-items-container');
        const currencyDisplay = document.getElementById('shop-currency-display');
        const resourceOverview = document.getElementById('shop-resource-overview');
        
        if (currencyDisplay) {
            const fragments = (typeof this.meta_getResourceCount === 'function')
                ? this.meta_getResourceCount('rune_fragments')
                : (this.saveData && this.saveData.runeFragments ? this.saveData.runeFragments : 0);
            currencyDisplay.innerText = fragments.toLocaleString();
        }

        if (resourceOverview) {
            resourceOverview.innerHTML = '';
            Object.values(META_SHOP_CONFIG.resources || {}).forEach(res => {
                const amount = (typeof this.meta_getResourceCount === 'function')
                    ? this.meta_getResourceCount(res.id)
                    : 0;
                const item = document.createElement('div');
                item.className = 'rounded-lg border border-slate-700/60 bg-slate-900/70 px-2 py-2 min-w-0';
                item.title = `${res.name}: ${amount.toLocaleString()}`;
                item.innerHTML = `
                    <div class="flex items-center gap-1 min-w-0">
                        <span class="text-sm shrink-0">${res.icon}</span>
                        <span class="text-[10px] text-slate-400 truncate">${res.name}</span>
                    </div>
                    <div class="mt-1 text-sm font-bold text-slate-100 tabular-nums">${amount.toLocaleString()}</div>
                `;
                resourceOverview.appendChild(item);
            });
        }
        
        const shopRuneCount = document.getElementById('shop-rune-count');
        if (shopRuneCount) {
            const total = (this.saveData && this.saveData.runeInventory ? this.saveData.runeInventory.length : 0);
            shopRuneCount.textContent = `${total}个符文`;
        }
        const debugShopDisabled = typeof localStorage !== 'undefined'
            && localStorage.getItem('echo_debug_shop') === '0';
        const debugShopEnabled = !debugShopDisabled && (
            CONFIG.debugShopDefaultEnabled === true
            || CONFIG.debug === true
            || this.debugMode === true
            || (typeof localStorage !== 'undefined' && localStorage.getItem('echo_debug_shop') === '1')
        );
        if (this.meta_currentShopCategory === 'debug' && !debugShopEnabled) {
            this.meta_currentShopCategory = 'attribute';
        }
        
        // 1. 渲染分类标签
        const renderShopPreview = (upgrade, state, cardEl) => {
            const preview = document.getElementById('shop-upgrade-preview');
            if (!preview || !upgrade || !state) return;
            document.querySelectorAll('#shop-items-container .shop-upgrade-card.previewing').forEach(el => el.classList.remove('previewing'));
            if (cardEl) cardEl.classList.add('previewing');
            const category = META_SHOP_CONFIG.categories[upgrade.category] || {};
            const resDef = state.resDef || META_SHOP_CONFIG.resources.rune_fragments;
            const levelText = state.isMax ? 'MAX' : `LV.${state.level}`;
            const costText = state.isMax
                ? '已達上限'
                : `${resDef.icon} ${state.cost.toLocaleString()}`;
            preview.innerHTML = `
                <div class="shop-preview-header">
                    <div class="shop-preview-icon">${upgrade.icon}</div>
                    <div class="min-w-0">
                        <div class="shop-preview-name">${upgrade.name}</div>
                        <div class="shop-preview-meta">
                            <span class="shop-preview-pill">${category.icon || ''} ${category.name || upgrade.category}</span>
                            <span class="shop-preview-pill">${upgrade.temporary ? '臨時強化' : '永久強化'}</span>
                            <span class="shop-preview-pill">${levelText}</span>
                            <span class="shop-preview-pill">${costText}</span>
                        </div>
                    </div>
                </div>
                <div class="shop-preview-desc">${upgrade.desc}</div>
            `;
        };

        if (categoryContainer) {
            categoryContainer.innerHTML = '';
            for (let catId in META_SHOP_CONFIG.categories) {
                if (catId === 'debug' && !debugShopEnabled) continue;
                const cat = META_SHOP_CONFIG.categories[catId];
                const isActive = this.meta_currentShopCategory === catId;
                const btn = document.createElement('button');
                btn.className = `px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${isActive ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`;
                btn.innerHTML = `${cat.icon} ${cat.name}`;
                btn.onclick = () => {
                    this.meta_currentShopCategory = catId;
                    this.ui_renderShop();
                };
                categoryContainer.appendChild(btn);
            }
        }

        // 2. 渲染升级项
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            const upgrades = META_SHOP_CONFIG.upgrades.filter(u =>
                u.category === this.meta_currentShopCategory && (!u.debugOnly || debugShopEnabled)
            );
            
            upgrades.forEach(upgrade => {
                const isTemporary = upgrade.temporary || false;
                const currentData = isTemporary ? (this.saveData.temporaryUpgrades || {}) : (this.saveData.upgrades || {});
                const level = currentData[upgrade.id] || 0;
                const isMax = level >= upgrade.maxLevel;
                const cost = (typeof this.meta_calculateUpgradeCost === 'function') ? this.meta_calculateUpgradeCost(upgrade, level) : 0;
                const resourceId = upgrade.cost.resourceId || 'rune_fragments';
                const resDef = META_SHOP_CONFIG.resources[resourceId] || META_SHOP_CONFIG.resources.rune_fragments;
                const playerHas = (typeof this.meta_getResourceCount === 'function') ? this.meta_getResourceCount(resourceId) : 0;
                const canAfford = playerHas >= cost;

                const card = document.createElement('div');
                card.className = `shop-upgrade-card bg-slate-900/60 border ${isMax ? 'border-slate-700 opacity-80' : 'border-slate-700/50'} p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden group`;
                card.tabIndex = 0;
                const previewState = { level, isMax, cost, resDef, canAfford };
                const isDebugRelicPicker = upgrade.effect && upgrade.effect.type === 'debug_pick_any_relic';
                const debugStartRelicIds = isDebugRelicPicker
                    ? (Array.isArray(this.saveData?.debugStartRelicIds)
                        ? this.saveData.debugStartRelicIds
                        : (this.saveData?.debugStartRelicId ? [this.saveData.debugStartRelicId] : []))
                    : [];
                const selectedDebugRelicNames = debugStartRelicIds
                    .map(id => RELIC_DB.find(r => r.id === id)?.name || id)
                    .join('、');

                const topRow = document.createElement('div');
                topRow.className = 'flex justify-between items-start';

                const iconGroup = document.createElement('div');
                iconGroup.className = 'flex items-center gap-3';
                
                const iconBg = document.createElement('div');
                iconBg.className = `w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-slate-800 border border-slate-700 group-hover:border-amber-500/50 transition-colors`;
                iconBg.innerText = upgrade.icon;
                
                const nameGroup = document.createElement('div');
                nameGroup.innerHTML = `<div class="text-sm font-bold text-slate-100">${upgrade.name}</div><div class="text-[10px] text-slate-500 uppercase tracking-tighter">${isTemporary ? '临时强化' : '永久强化'}</div>`;
                
                iconGroup.appendChild(iconBg);
                iconGroup.appendChild(nameGroup);
                
                const levelBadge = document.createElement('div');
                levelBadge.className = `px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono ${isMax ? 'text-amber-500' : 'text-slate-400'}`;
                levelBadge.innerText = isDebugRelicPicker
                    ? (debugStartRelicIds.length > 0 ? `已选 ${debugStartRelicIds.length}` : '未选')
                    : (isMax ? 'MAX' : `LV.${level}`);
                
                topRow.appendChild(iconGroup);
                topRow.appendChild(levelBadge);
                
                const desc = document.createElement('div');
                desc.className = 'shop-upgrade-desc text-xs text-slate-400 leading-relaxed min-h-[3em]';
                desc.innerText = selectedDebugRelicNames
                    ? `${upgrade.desc}\n当前开局遗物：${selectedDebugRelicNames}`
                    : upgrade.desc;
                
                const bottomRow = document.createElement('div');
                bottomRow.className = 'flex items-center justify-between mt-auto pt-2 border-t border-slate-800/50';
                
                if (isMax) {
                    bottomRow.innerHTML = `<div class="text-[10px] text-slate-600 uppercase font-bold">已达最高等级</div>`;
                } else {
                    const costGroup = document.createElement('div');
                    costGroup.className = 'flex items-center gap-1';
                    costGroup.innerHTML = `<span class="text-xs">${resDef.icon}</span><span class="text-sm font-bold ${canAfford ? 'text-slate-200' : 'text-red-400'}">${cost.toLocaleString()}</span>`;
                    
                    const buyBtn = document.createElement('button');
                    buyBtn.className = `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${canAfford ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`;
                    buyBtn.innerText = isDebugRelicPicker ? '选择' : '升级';
                    buyBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (typeof this.meta_buyUpgrade === 'function') this.meta_buyUpgrade(upgrade.id);
                    };
                    
                    bottomRow.appendChild(costGroup);
                    bottomRow.appendChild(buyBtn);
                }
                
                card.appendChild(topRow);
                card.appendChild(desc);
                card.appendChild(bottomRow);
                card.onmouseenter = () => renderShopPreview(upgrade, previewState, card);
                card.onfocus = () => renderShopPreview(upgrade, previewState, card);
                card.addEventListener('touchstart', () => renderShopPreview(upgrade, previewState, card), { passive: true });
                
                itemsContainer.appendChild(card);
            });
            const firstCard = itemsContainer.querySelector('.shop-upgrade-card');
            if (upgrades.length > 0 && firstCard) {
                const first = upgrades[0];
                const isTemporary = first.temporary || false;
                const currentData = isTemporary ? (this.saveData.temporaryUpgrades || {}) : (this.saveData.upgrades || {});
                const level = currentData[first.id] || 0;
                const isMax = level >= first.maxLevel;
                const cost = (typeof this.meta_calculateUpgradeCost === 'function') ? this.meta_calculateUpgradeCost(first, level) : 0;
                const resourceId = first.cost.resourceId || 'rune_fragments';
                const resDef = META_SHOP_CONFIG.resources[resourceId] || META_SHOP_CONFIG.resources.rune_fragments;
                const playerHas = (typeof this.meta_getResourceCount === 'function') ? this.meta_getResourceCount(resourceId) : 0;
                renderShopPreview(first, { level, isMax, cost, resDef, canAfford: playerHas >= cost }, firstCard);
            } else {
                const preview = document.getElementById('shop-upgrade-preview');
                if (preview) preview.innerHTML = '';
            }
        }
    },

    /**
     * 走私者系列辅助方法：按稀有度立即给予符文
     * @param {string} rarity - 'common' | 'rare' | 'epic' | 'legendary'
     * @param {number} count - 给予数量
     */
    _grantRunesByRarity(rarity, count) {
        try {
            // 直接使用模块级导入的 RUNE_DB
            const pool = RUNE_DB.filter(r => r.rarity === rarity);
            if (pool.length === 0) {
                console.warn('[_grantRunesByRarity] 没有匹配的符文：', rarity);
                return;
            }
            if (!this.runeInventory) this.runeInventory = [];
            if (!this.runeLootItems) this.runeLootItems = [];
            for (let i = 0; i < count; i++) {
                const picked = pool[Math.floor(Math.random() * pool.length)];
                // 直接添加到背包（跳过掉落动画）
                this.runeInventory.push({ id: picked.id, level: 1 });
            }
            // 触发 UI 更新
            if (typeof this.ui_updateRuneInventory === 'function') this.ui_updateRuneInventory();
        } catch(e) {
            console.error('[_grantRunesByRarity] 异常:', e);
        }
    },
};
