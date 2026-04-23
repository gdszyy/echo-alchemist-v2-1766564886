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

        // --- 配置权重 ---
        const RARITY_WEIGHTS = CONFIG.balance.relicRarityWright;

        // 判断是否处于前三次遗物选择（计数器尚未超过3）
        const isEarlyGame = (this.relicSelectionCount || 0) < 3;

        // 2. 准备遗物池
        // 过滤掉玩家已经拥有的遗物 (this.ownedRelics)
        const fateMomentRewardIds = new Set(['chaos_essence', 'pure_essence']);
        let pool = RELIC_DB.filter(r => {
            if (fateMomentRewardIds.has(r.id)) return false;
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
        if (hasLayoutRelic) {
            pool = pool.filter(r => !LAYOUT_RELICS.has(r.id));
        }
        // 已选行数遗物：仅排除另一种行数遗物（不影响布局遗物）
        if (ownedRowRelic) {
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

        // 计数器自增（每次打开遗物选择界面时计数）
        this.relicSelectionCount = (this.relicSelectionCount || 0) + 1;
        const showRecommendation = this.relicSelectionCount <= 3;

        // 4. 生成 HTML
        const container = document.getElementById('relic-container');
        if (container) {
            container.innerHTML = '';
            
            choices.forEach(relic => {
                const el = document.createElement('div');
                el.className = `relic-card ${relic.rarity || 'common'}`; 
                const count = (this.ownedRelics || []).filter(id => id === relic.id).length;
                const max = relic.maxStacks || 1;
                const stackInfo = max > 1 ? `<div class="relic-stack text-xs text-amber-400 mt-1">当前层数: ${count} / ${max}</div>` : '';
                
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
                
                el.innerHTML = `
                    <div class="relic-icon">${relic.icon}</div>
                    <div class="relic-name">${relic.name}</div>
                    <div class="relic-desc">${relic.desc}</div>
                    ${stackInfo}
                    ${recommendHtml}
                `;
                el.onclick = (e) => { 
                    e.stopPropagation(); 
                    this.ui_selectRelic(relic);
                };
                container.appendChild(el);
            });
        }

        // 5. 显示界面
        const overlay = document.getElementById('phase-relic');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden-phase');
            overlay.classList.add('active-phase');
        }
        // 通知教程系统：遗物选择界面已打开
        eventBus.emit('tutorial:relic_shown');
    },

    /**
     * 玩家选择遗物
     */
    ui_selectRelic(relic) {
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
            this.marbleSizeBonus = (this.marbleSizeBonus || 0) + 2.5;
        } else if (relic.effect === 'unlock_slot') {
            if (!this.unlockedSlots) this.unlockedSlots = [];
            if (!this.unlockedSlots.includes(relic.slotType)) {
                this.unlockedSlots.push(relic.slotType);
            }
            if (this.slotCount === 0) this.slotCount = 1;
        }
        else if (relic.effect === 'slot_count_up') {
            this.slotCount = (this.slotCount || 0) + 1;
        } else if (relic.effect === 'row_count_up') {
            this.currentRows = (this.currentRows || 0) + 2;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            // [钉盘遗物] 立刻触发一次混沌精华
            if (typeof this.sys_queueRoundStartReward === 'function') {
                this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'relic', sourceRelicId: relic.id, sourceRelicName: relic.name, round: this.round });
            }
        } else if (relic.effect === 'row_count_up_1') {
            // 维度碎片（rare）：每次只加 1 行
            this.currentRows = (this.currentRows || 0) + 1;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            // [钉盘遗物] 立刻触发一次混沌精华
            if (typeof this.sys_queueRoundStartReward === 'function') {
                this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'relic', sourceRelicId: relic.id, sourceRelicName: relic.name, round: this.round });
            }
        } else if (relic.effect === 'flat_damage_up') {
            // 炼金火药管：所有弹珠基础伤害 +N
            const val = relic.flatDamageValue || 2;
            this.flatDamageBonus = (this.flatDamageBonus || 0) + val;
            if (window.showToast) showToast(`炼金火药管已装填！基础伤害 +${val}。`);
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
            // [钉盘遗物] 立刻触发一次混沌精华
            if (typeof this.sys_queueRoundStartReward === 'function') {
                this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'relic', sourceRelicId: relic.id, sourceRelicName: relic.name, round: this.round });
            }
        } else if (relic.effect === 'board_layout_diamond') {
            this.boardLayout = 'diamond';
            // [补偿] 菱形顶底稀疏，+2 行让菱形更饱满
            this.currentRows = (this.currentRows || CONFIG.gameplay.rows) + 2;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            if (window.showToast) showToast('菱形陣形啟動！釘盤 +2 行，中段爆發激活。');
            // [钉盘遗物] 立刻触发一次混沌精华
            if (typeof this.sys_queueRoundStartReward === 'function') {
                this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'relic', sourceRelicId: relic.id, sourceRelicName: relic.name, round: this.round });
            }
        } else if (relic.effect === 'board_layout_sparse') {
            this.boardLayout = 'sparse';
            // [补偿] 稀疏布局钉子总数约为 default 的 75%，+4 行补偿总量
            this.currentRows = (this.currentRows || CONFIG.gameplay.rows) + 4;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            if (window.showToast) showToast('稀疏間隔啟動！釘盤 +4 行，通道蓄力激活。');
            // [钉盘遗物] 立刻触发一次混沌精华
            if (typeof this.sys_queueRoundStartReward === 'function') {
                this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'relic', sourceRelicId: relic.id, sourceRelicName: relic.name, round: this.round });
            }
        } else if (relic.effect === 'board_layout_mirror_sync') {
            this.boardLayout = 'mirror_sync';
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            // [钉盘遗物] 立刻触发一次混沌精华
            if (typeof this.sys_queueRoundStartReward === 'function') {
                this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'relic', sourceRelicId: relic.id, sourceRelicName: relic.name, round: this.round });
            }
        } else if (relic.effect === 'board_layout_wide_narrow') {
            this.boardLayout = 'wide_narrow';
            // [补偿] 宽窄交替分布不均，+2 行轻度补偿
            this.currentRows = (this.currentRows || CONFIG.gameplay.rows) + 2;
            if (typeof this.phase_gathering_initPachinko === 'function') this.phase_gathering_initPachinko(true);
            if (window.showToast) showToast('寬窄交替啟動！釘盤 +2 行，邊緣共振激活。');
            // [钉盘遗物] 立刻触发一次混沌精华
            if (typeof this.sys_queueRoundStartReward === 'function') {
                this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'relic', sourceRelicId: relic.id, sourceRelicName: relic.name, round: this.round });
            }
        } else if (relic.effect === 'assimilation_surge') {
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
        } else if (relic.effect === 'pure_essence') {
            this.pendingSelectionMode = {
                mode: 'pure_essence',
                requiredCount: 1,
                sourceRelicId: relic.id,
                sourceRelicName: relic.name,
            };
            if (window.showToast) showToast('純淨精華已就緒！下次命運抉擇可選擇 1 枚彈珠並注入 1 個合法符文。');
        }
        
        if (relic.unlocks) {
            const keys = Array.isArray(relic.unlocks) ? relic.unlocks : [relic.unlocks];
            const boost = relic.boost || 10;
            if (!this.unlockedWeights) this.unlockedWeights = {};
            if (!this.guaranteedNextRound) this.guaranteedNextRound = [];
            
            keys.forEach(key => {
                const current = this.unlockedWeights[key] || 0;
                this.unlockedWeights[key] = current === 0 ? boost : current + Math.floor(boost * 1.5);
                this.guaranteedNextRound.push(key);
            });
            if (window.showToast) showToast(`已解鎖相關屬性!`);
        }

        this.ui_closeRelicSelection();
    },

    /**
     * 跳过选择
     */
    ui_skipRelic() {
        if (typeof this.spawn_addScore === 'function') this.spawn_addScore(500);
        if (window.showToast) showToast("放棄遗物，获得局内货币");
        this.ui_closeRelicSelection();
    },

    /**
     * 关闭界面并恢复
     */
    ui_closeRelicSelection() {
        const overlay = document.getElementById('phase-relic');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active-phase');
            overlay.classList.add('hidden-phase');
        }

        const returnState = this.relicOverlayReturnState || { phase: this.stateBeforeRelic };
        this.relicOverlayReturnState = null;

        if (returnState.phase === 'gathering') {
            if (typeof this.phase_gathering_attemptComplete === 'function') this.phase_gathering_attemptComplete();
            return;
        }

        if (returnState.phase === 'selection') {
            if (typeof this.phase_switchPhase === 'function') this.phase_switchPhase('selection');
            if (typeof this.ui_updateUI === 'function') this.ui_updateUI();
            if (typeof this.ui_refreshSelectionModeUI === 'function') this.ui_refreshSelectionModeUI();
            return;
        }

        if (returnState.phase === 'round_start_resolver') {
            if (typeof this.sys_continueRoundStartResolver === 'function') this.sys_continueRoundStartResolver();
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
        
        if (currencyDisplay) {
            currencyDisplay.innerText = (this.saveData && this.saveData.runeFragments ? this.saveData.runeFragments : 0).toLocaleString();
        }
        
        const shopRuneCount = document.getElementById('shop-rune-count');
        if (shopRuneCount) {
            const total = (this.saveData && this.saveData.runeInventory ? this.saveData.runeInventory.length : 0);
            shopRuneCount.textContent = `${total}个符文`;
        }
        
        // 1. 渲染分类标签
        if (categoryContainer) {
            categoryContainer.innerHTML = '';
            for (let catId in META_SHOP_CONFIG.categories) {
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
            const upgrades = META_SHOP_CONFIG.upgrades.filter(u => u.category === this.meta_currentShopCategory);
            
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
                card.className = `bg-slate-900/60 border ${isMax ? 'border-slate-700 opacity-80' : 'border-slate-700/50'} p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden group`;

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
                levelBadge.innerText = isMax ? 'MAX' : `LV.${level}`;
                
                topRow.appendChild(iconGroup);
                topRow.appendChild(levelBadge);
                
                const desc = document.createElement('div');
                desc.className = 'text-xs text-slate-400 leading-relaxed min-h-[3em]';
                desc.innerText = upgrade.desc;
                
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
                    buyBtn.innerText = '升级';
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
                
                itemsContainer.appendChild(card);
            });
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
