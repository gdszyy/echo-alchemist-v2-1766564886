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

import { META_SHOP_CONFIG, CONFIG, RELIC_DB } from '../config.js';
import { showToast } from '../entities.js';

/**
 * 商店渲染方法集合
 * 通过 bind(this) 组合模式作为实例方法注入到 Game 实例
 */
export const shop_system = {


/**
     * 显示遗物选择界面
     */
    /**
     * 显示遗物选择界面 (支持稀有度权重 + 防重复)
     */
    ui_showRelicSelection() {
        // 1. 记录之前的状态 (用于关闭时恢复)
        this.stateBeforeRelic = this.phase;  // [Mixin 正常用法：读取 Game 实例状态]

        // --- 配置权重 ---
        const RARITY_WEIGHTS = CONFIG.balance.relicRarityWright

        // 2. 准备遗物池
        // 过滤掉玩家已经拥有的遗物 (this.ownedRelics)
        let pool = RELIC_DB.filter(r => {
            const count = this.ownedRelics.filter(id => id === r.id).length;
            const max = r.maxStacks || 1;
            return count < max;
        });  // [Mixin 正常用法：读取 Game 实例状态]
        
        // 如果池子空了（全收集了），就给一些保底的或者是空的
        if (pool.length === 0) {
            showToast("已收集所有遗物！");
            this.ui_closeRelicSelection(); // 或者给个分数奖励
            return;
        }

        const choices = [];
        
        // 3. 抽取 3 个遗物 (加权随机 & 不放回)
        for(let i=0; i<CONFIG.gameplay.relicChoiceNum; i++) {
            if(pool.length === 0) break;

            // A. 计算当前临时池子的总权重
            let totalWeight = 0;
            pool.forEach(r => {
                totalWeight += (RARITY_WEIGHTS[r.rarity] || 10); // 默认权重10
            });

            // B. 生成随机数 [0, totalWeight)
            let randomVal = Math.random() * totalWeight;
            let selectedIdx = -1;

            // C. 遍历寻找命中的遗物
            for (let j = 0; j < pool.length; j++) {
                const weight = RARITY_WEIGHTS[pool[j].rarity] || 10;
                randomVal -= weight;
                if (randomVal <= 0) {
                    selectedIdx = j;
                    break;
                }
            }

            // D. 兜底 (防止浮点数误差导致没选中，默认选第一个)
            if (selectedIdx === -1) selectedIdx = 0;

            // E. 加入结果 并 从临时池中移除 (防止同一次选卡出现两个一样的)
            choices.push(pool[selectedIdx]);
            pool.splice(selectedIdx, 1);
        }

        // 4. 生成 HTML (保持原有逻辑)
        const container = document.getElementById('relic-container');
        container.innerHTML = '';
        
        choices.forEach(relic => {
            const el = document.createElement('div');
            // 加上 rarity 类名以便 CSS 显示不同边框颜色
            el.className = `relic-card ${relic.rarity || 'common'}`; 
            const count = this.ownedRelics.filter(id => id === relic.id).length;
            const max = relic.maxStacks || 1;
            const stackInfo = max > 1 ? `<div class="relic-stack text-xs text-amber-400 mt-1">当前层数: ${count} / ${max}</div>` : '';
            el.innerHTML = `
                <div class="relic-icon">${relic.icon}</div>
                <div class="relic-name">${relic.name}</div>
                <div class="relic-desc">${relic.desc}</div>
                ${stackInfo}
            `;
            el.onclick = (e) => { 
                e.stopPropagation(); 
                this.ui_selectRelic(relic);
            };
            container.appendChild(el);
        });

        // 5. 显示界面
        const overlay = document.getElementById('phase-relic');
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden-phase');
        overlay.classList.add('active-phase');
    },


/**
     * 玩家选择遗物
     */
    ui_selectRelic(relic) {
        this.ownedRelics.push(relic.id);  // [Mixin 正常用法：读取 Game 实例状态]
        showToast(`獲得遺物: ${relic.name}`);
        //  处理新遗物效果
        if (relic.effect === 'pink_peg_up') {
            this.pinkPegCount += 3; // 叠加增加
        } 
        else if (relic.effect === 'combat_wall') {
            this.hasCombatWall = true;
        }else if (relic.effect === 'permanent_size_up') {
    this.marbleSizeBonus += 2.5; // 每次获得增加 2.5 像素半径（缩小以防卡墙）
}else if (relic.effect === 'unlock_slot') {
            if (!this.unlockedSlots.includes(relic.slotType)) {
                this.unlockedSlots.push(relic.slotType);
            }
            // 规则：解锁任意一种，特殊槽出现数量从 0 -> 1
            if (this.slotCount === 0) this.slotCount = 1;
        }
        else if (relic.effect === 'slot_count_up') {
            this.slotCount += 1;
        } else if (relic.effect === 'row_count_up') {
            this.currentRows += 2;
            this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'board_layout_triangle') {
            // 三角阵形：切换到三角形布局
            this.boardLayout = 'triangle';
            this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'board_layout_diamond') {
            // 菱形阵形：切换到菱形布局
            this.boardLayout = 'diamond';
            this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'board_layout_sparse') {
            // 稀疏间隔：切换到稀疏间隔布局
            this.boardLayout = 'sparse';
            this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'board_layout_mirror_sync') {
            // 镜像同步：切换到镜像同步布局
            this.boardLayout = 'mirror_sync';
            this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'board_layout_wide_narrow') {
            // 宽窄交替：切换到宽窄交替布局
            this.boardLayout = 'wide_narrow';
            this.phase_gathering_initPachinko(true);
        } else if (relic.effect === 'assimilation_surge') {
            // 同化涌潮：下两回合保底该弹珠类型 + 该类型同化概率提升
            const mt = relic.marbleType;
            this.guaranteedNextRound.push(mt);
            this.guaranteedNextRound.push(mt);
            // assimilationBoostRounds 是一个对象，记录每种弹珠类型的副加回合数
            if (!this.assimilationBoostRounds) this.assimilationBoostRounds = {};
            this.assimilationBoostRounds[mt] = 2;
            showToast(`${relic.name}已啟動！${mt} 同化概率大幅提升。`);
        }
        //  支持單個字串或數組的解鎖邏輯
        if (relic.unlocks) {
            const keys = Array.isArray(relic.unlocks) ? relic.unlocks : [relic.unlocks];
            const boost = relic.boost || 10;
            
            keys.forEach(key => {
                const current = this.unlockedWeights[key] || 0;
                // 如果是第一次解鎖，設為 boost；如果是重複獲取，增加權重
                this.unlockedWeights[key] = current === 0 ? boost : current + Math.floor(boost * 1.5);
                
                // 加入保底列表
                this.guaranteedNextRound.push(key);
            });
            
            showToast(`已解鎖相關屬性!`);
        }


        this.ui_closeRelicSelection();
    },


/**
     * 跳过选择
     */
    ui_skipRelic() {
        this.spawn_addScore(500);
        showToast("放棄遗物，获得局内货币");
        this.ui_closeRelicSelection();
    },


/**
     * 关闭界面并恢复
     */
    ui_closeRelicSelection() {
        const overlay = document.getElementById('phase-relic');
        overlay.style.display = 'none';
        overlay.classList.remove('active-phase');
        overlay.classList.add('hidden-phase');
        
        // [修改] 遗物界面关闭时，检查是否有固定回合遗物事件待串行触发
        const hadPendingBossRelic = this._pendingBossRelic;
        this._pendingBossRelic = false;
        
        // [核心修复] 根据打开前的状态决定去向
        if (this.stateBeforeRelic === 'gathering') {
            // 情况 A: 在收集阶段(打中遗物槽)打开的
            // 不需要跳转阶段，只需要尝试结算当前回合
            this.phase_gathering_attemptComplete();
        } else if (hadPendingBossRelic && this._pendingRelicEvent) {
            // 情况 C: 刚刚关闭的是 Boss 遗物，且本回合恢好是固定遗物事件回合
            // 串行弹出固定遗物事件，让玩家两个都能领取
            this._pendingRelicEvent = false;
            showToast("✨ 命魔的馈赠 ✨");
            this.phase = 'relic_event';
            setTimeout(() => { this.ui_showRelicSelection(); }, 300);
        } else {
            // 情况 B: 在回合结束(固定回合事件)打开的
            // 正常进入下一轮的选弹珠阶段
            this.sys_initSelectionPhase(); 
        }
    },


/**
     * [UI] 渲染商店内容
     */
    ui_renderShop() {
        const categoryContainer = document.getElementById('shop-category-tabs');
        const itemsContainer = document.getElementById('shop-items-container');
        const currencyDisplay = document.getElementById('shop-currency-display');
        
        if (currencyDisplay) currencyDisplay.innerText = (this.saveData.runeFragments || 0).toLocaleString();  // [Mixin 正常用法：读取 Game 实例状态]
        // 更新符文数量显示
        const shopRuneCount = document.getElementById('shop-rune-count');
        if (shopRuneCount) {
            const total = (this.saveData.runeInventory || []).length;  // [Mixin 正常用法：读取 Game 实例状态]
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
                const currentData = isTemporary ? this.saveData.temporaryUpgrades : this.saveData.upgrades;  // [Mixin 正常用法：读取 Game 实例状态]
                const level = currentData[upgrade.id] || 0;
                const isMax = level >= upgrade.maxLevel;
                const cost = this.meta_calculateUpgradeCost(upgrade, level);
                // 支持多种货币类型
                const resourceId = upgrade.cost.resourceId || 'rune_fragments';
                const resDef = META_SHOP_CONFIG.resources[resourceId] || META_SHOP_CONFIG.resources.rune_fragments;
                const playerHas = this.meta_getResourceCount(resourceId);
                const canAfford = playerHas >= cost;

                const card = document.createElement('div');
                card.className = `bg-slate-900/60 border ${isMax ? 'border-slate-700 opacity-80' : 'border-slate-700/50'} p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden group`;

                // --- 顶部区域：图标 + 名称 + 等级 ---
                const topRow = document.createElement('div');
                topRow.className = 'flex justify-between items-start';

                const iconGroup = document.createElement('div');
                iconGroup.className = 'flex gap-3';

                const iconEl = document.createElement('div');
                iconEl.className = 'w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl shadow-inner';
                iconEl.textContent = upgrade.icon;

                const nameGroup = document.createElement('div');
                const nameEl = document.createElement('h3');
                nameEl.className = 'font-bold text-slate-100';
                nameEl.textContent = upgrade.name;
                const levelEl = document.createElement('p');
                levelEl.className = 'text-[10px] text-slate-500 uppercase tracking-wider';
                levelEl.textContent = `LV. ${level} / ${upgrade.maxLevel}`;
                nameGroup.appendChild(nameEl);
                nameGroup.appendChild(levelEl);

                iconGroup.appendChild(iconEl);
                iconGroup.appendChild(nameGroup);
                topRow.appendChild(iconGroup);

                if (isMax) {
                    const maxBadge = document.createElement('span');
                    maxBadge.className = 'text-[10px] bg-slate-800 text-slate-500 px-2 py-1 rounded';
                    maxBadge.textContent = 'MAX';
                    topRow.appendChild(maxBadge);
                }
                card.appendChild(topRow);

                // --- 描述 ---
                const descEl = document.createElement('p');
                descEl.className = 'text-xs text-slate-400 leading-relaxed';
                descEl.textContent = upgrade.desc;
                card.appendChild(descEl);

                // --- 底部区域：下一级信息 + 购买按鈕 ---
                const bottomRow = document.createElement('div');
                bottomRow.className = 'flex justify-between items-center mt-2';

                // 左侧：显示玩家拥有的对应货币数量
                const nextLevelEl = document.createElement('div');
                nextLevelEl.className = 'text-[10px] text-slate-500';
                if (!isMax) {
                    const hasColor = canAfford ? 'text-green-400' : 'text-red-400';
                    nextLevelEl.innerHTML = `下一级: <span class="text-amber-400/80">+${upgrade.effect.valuePerLevel}${upgrade.effect.type === 'multiply' ? 'x' : ''}</span> &nbsp; <span class="${hasColor}">${resDef.icon}${playerHas}</span>`;
                } else {
                    nextLevelEl.textContent = '已達最高等级';
                }
                bottomRow.appendChild(nextLevelEl);

                if (!isMax) {
                    const buyBtn = document.createElement('button');
                    // 按鈕颜色根据资源类型变化
                    const btnColor = canAfford
                        ? (resourceId === 'rune_fragments' ? 'bg-purple-600' : `bg-opacity-90 bg-[${resDef.color}]`)
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed';
                    buyBtn.className = `px-4 py-2 rounded-lg text-xs font-bold transition-all ${canAfford ? 'text-white hover:scale-105 active:scale-95 bg-purple-600' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`;
                    if (canAfford && resourceId !== 'rune_fragments') {
                        buyBtn.style.background = resDef.color;
                    }
                    buyBtn.innerHTML = `${resDef.icon} ${cost}`;
                    buyBtn.addEventListener('click', () => {
                        this.meta_buyUpgrade(upgrade.id);
                    });
                    bottomRow.appendChild(buyBtn);
                }
                card.appendChild(bottomRow);

                itemsContainer.appendChild(card);
            });
        }
    },


};

// 暴露到全局，供向后兼容
window.shop_system = shop_system;
