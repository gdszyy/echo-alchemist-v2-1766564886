import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba 
} from './entities.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';
import { eventBus } from './event_bus.js';
import { parseRuneGrid, calcRuneBaseStats, getRuneId, rune_merge, rune_reforge } from './rune_system.js';
import { RUNE_DB, RUNEWORD_DB, STAT_DISPLAY } from './rune_config.js';

export const ui_system = {
// (需求1 & 2) 通用资源飞入动画
// [fix] DOM 对象池：限制同时存在的飞行节点数量，防止内存泄漏
    _flyEffectPool: [],
    _flyEffectMaxNodes: 8, // 最多同时存在 8 个飞行节点

    _getFlyEffectNode() {
        // 从对象池中获取空闲节点，或创建新节点
        const pool = this._flyEffectPool;
        let node = pool.find(n => !n._inUse);
        if (!node) {
            if (pool.length >= this._flyEffectMaxNodes) {
                // 池已满：强制回收最早的节点
                node = pool[0];
                if (node._timer) { clearTimeout(node._timer); node._timer = null; }
                if (node.parentNode) node.parentNode.removeChild(node);
            } else {
                node = document.createElement('div');
                node.className = 'fixed font-bold text-amber-400 text-lg pointer-events-none z-[9999]';
                node.style.textShadow = '0 0 5px rgba(245,158,11,0.8), 0 2px 4px rgba(0,0,0,0.5)';
                node.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
                node._inUse = false;
                node._timer = null;
                pool.push(node);
            }
        }
        node._inUse = true;
        return node;
    },

    _releaseFlyEffectNode(node) {
        node._inUse = false;
        if (node.parentNode) node.parentNode.removeChild(node);
    },

    ui_playResourceFlyEffect(startX, startY, amount) {
        if (amount <= 0) return;
        
        const flyer = this._getFlyEffectNode();
        flyer.innerHTML = `🔮 +${amount}`;
        flyer.style.left = `${startX}px`;
        flyer.style.top = `${startY}px`;
        flyer.style.opacity = '1';
        flyer.style.transform = '';
        document.body.appendChild(flyer);

        // 目标位置：顶部的资源图标
        let targetEl = document.getElementById('run-currency-display');
        if (!targetEl || targetEl.offsetParent === null) {
            targetEl = document.getElementById('meta-currency-display');
        }
        
        const targetRect = targetEl 
            ? targetEl.getBoundingClientRect() 
            : { left: window.innerWidth - 60, top: 20, width: 0, height: 0 };

        void flyer.offsetWidth;

        flyer.style.transform = `translate(${targetRect.left - startX}px, ${targetRect.top - startY}px) scale(0.5)`;
        flyer.style.opacity = '0';

        if (flyer._timer) clearTimeout(flyer._timer); // [fix] 防止重复定时器
        flyer._timer = setTimeout(() => {
            flyer._timer = null;
            this._releaseFlyEffectNode(flyer);
            if (targetEl) {
                const parent = targetEl.parentElement;
                parent.style.transform = 'scale(1.2)';
                parent.style.filter = 'brightness(1.5)';
                setTimeout(() => {
                    parent.style.transform = 'scale(1)';
                    parent.style.filter = 'none';
                }, 150);
            }
        }, 800);
    },

ui_openTruthBook() {
        this.phase_switchPhase('truth_book');
        const overlay = document.getElementById('phase-truth-book');
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden-phase');
        overlay.classList.add('active-phase');
    },

ui_closeTruthBook() {
        const overlay = document.getElementById('phase-truth-book');
        overlay.style.display = 'none';
        overlay.classList.remove('active-phase');
        overlay.classList.add('hidden-phase');
        this.truthBook.active = false;
        this.phase_switchPhase('meta');
    },

// 2. 更新慢动作逻辑（放在 update 中调用）
    /**
     */
    ui_updateSlowMotion() {
        const smCfg = CONFIG.mechanics.slow_motion;
        const dynamicThreshold = this.calc_calculateDynamicThreshold();
        // 1. 触发逻辑
        if (this.frameDamageAccumulator > dynamicThreshold) {
            this.slowMotionTimer = smCfg.duration; // 慢动作持续约 0.6秒
            // 触发瞬间强制降速，这里可以用固定值 0.1，保证打击感
            this.timeScale = smCfg.timeScale; 
        }

        // 清空当帧累计
        this.frameDamageAccumulator = 0;

        // 2. 恢复逻辑
        if (this.slowMotionTimer > 0) {
            // 倒计时阶段
            this.slowMotionTimer--;
            // 保持慢速 (或者你也可以让它在这里就开始缓慢回升)
        } else {
            // 倒计时结束，开始恢复正常
            
            // 如果当前速度 不等于 玩家设定的基础速度
            if (Math.abs(this.timeScale - this.baseTimeScale) > 0.01) {
                
                // 使用插值慢慢恢复 (lerp)
                // 0.1 是恢复速率，越大恢复越快
                this.timeScale += (this.baseTimeScale - this.timeScale) * smCfg.recoveryRate;

                // 如果非常接近了，就直接归位，避免浮点数抖动
                if (Math.abs(this.timeScale - this.baseTimeScale) < 0.01) {
                    this.timeScale = this.baseTimeScale;
                }
            } else {
                // 确保完全对齐
                this.timeScale = this.baseTimeScale;
            }
        }
    },

/**
     * [UI] 更新主界面的货币显示
     */
    ui_updateMetaCurrency() {
        const el = document.getElementById('meta-currency-display');
        if (el) el.innerText = this.saveData.currency.toLocaleString();
        const runEl = document.getElementById('run-currency-display');
        if (runEl) runEl.innerText = this.runCurrency.toLocaleString();
    },

/**
     * [UI] 渲染商店内容
     */
    ui_renderShop() {
        const categoryContainer = document.getElementById('shop-category-tabs');
        const itemsContainer = document.getElementById('shop-items-container');
        const currencyDisplay = document.getElementById('shop-currency-display');
        
        if (currencyDisplay) currencyDisplay.innerText = this.saveData.currency.toLocaleString();
        
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
                const currentData = isTemporary ? this.saveData.temporaryUpgrades : this.saveData.upgrades;
                const level = currentData[upgrade.id] || 0;
                const isMax = level >= upgrade.maxLevel;
                const cost = this.meta_calculateUpgradeCost(upgrade, level);
                const canAfford = this.saveData.currency >= cost;

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

                // --- 底部区域：下一级信息 + 购买按钮 ---
                const bottomRow = document.createElement('div');
                bottomRow.className = 'flex justify-between items-center mt-2';

                const nextLevelEl = document.createElement('div');
                nextLevelEl.className = 'text-[10px] text-slate-500';
                if (!isMax) {
                    nextLevelEl.innerHTML = `下一級: <span class="text-amber-400/80">+${upgrade.effect.valuePerLevel}${upgrade.effect.type === 'multiply' ? 'x' : ''}</span>`;
                } else {
                    nextLevelEl.textContent = '已達最高等級';
                }
                bottomRow.appendChild(nextLevelEl);

                if (!isMax) {
                    const buyBtn = document.createElement('button');
                    buyBtn.className = `px-4 py-2 rounded-lg text-xs font-bold transition-all ${canAfford ? 'bg-amber-500 text-slate-900 hover:scale-105 active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`;
                    buyBtn.textContent = `✨ ${cost.toLocaleString()}`;
                    // [重构] 使用 addEventListener 替代内联 onclick="game.meta_buyUpgrade(...)"，移除 window.game 依赖
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

/**
     * @method updateMultiplierUI
     * @description 更新分数乘数 UI。
     */
    ui_updateMultiplierUI() { 
        const el = document.getElementById('multiplier-val'); 
        el.innerText = `x${this.scoreMultiplier.toFixed(1)}`; 
        const container = document.getElementById('multiplier-display'); 
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
            this.shotDamageHistory.unshift({
                total: this.currentShotDamage,
                byAttr: JSON.parse(JSON.stringify(this.currentShotDamageByAttr))
            });
            if (this.shotDamageHistory.length > 3) {
                this.shotDamageHistory.pop();
            }
            // 更新显示
            this.ui_updateRoundDamage();
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
        const targetValue = Math.floor(this.roundDamage);
        const currentValue = parseInt(el.innerText.replace(/,/g, '')) || 0;
        
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
        let roundNumber = this.round;

        if (this.currentViewingRound === 0) {
            // 查看当前回合（实时数据）
            shotsData = this.shotDamageHistory; 
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
        roundLabel.className = 'text-xs font-bold text-amber-400 font-[Cinzel]';
        roundLabel.textContent = `Round ${roundNumber}`;

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
                    'explosive': { name: '💥 爆炸', color: CONFIG.ui.damageStats.explosive }
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
     * @method updateUI
     * @description 更新 UI 界面显示，强制管理各阶段元素的显隐
     */
     ui_updateUI() {
        // 1. 基础：隐藏所有阶段的主容器 (.ui-overlay)
        document.querySelectorAll('.ui-overlay').forEach(el => { 
            el.style.display = 'none'; 
            el.classList.add('hidden-phase'); 
            el.classList.remove('active-phase'); 
        });
        // 2. 显示当前阶段的主容器
        // [META] 兼容 phase-meta, shop, truth_book
        const activeEl = document.getElementById(`phase-${this.phase}`); 
        if(activeEl) { 
            activeEl.style.display = 'flex'; 
            // 微小延迟以触发 CSS transition (如果有)
            setTimeout(() => { 
                activeEl.classList.remove('hidden-phase'); 
                activeEl.classList.add('active-phase'); 
            }, 10); 
        }
        
        // [META] 切换到主界面或商店时更新货币显示
        if (this.phase === 'meta' || this.phase === 'shop') {
            this.ui_updateMetaCurrency();
        }

        // 1. 底部面板 (.bottom-panel) 只在收集阶段 (gathering) 显示
        const bottomPanel = document.querySelector('.bottom-panel');
        if (bottomPanel) {
            if (this.phase === 'gathering') {
                bottomPanel.style.display = 'flex';
            } else {
                bottomPanel.style.display = 'none'; // 战斗阶段隐藏底部面板
            }
        }

        // A. 技能栏 (Skill Bar) - 仅在战斗且非敌人回合显示
        const skillBar = document.getElementById('skill-bar');
        if (skillBar) {
            // 只有在 combat 阶段才显示，其他阶段强制隐藏
            skillBar.style.display = (this.phase === 'combat') ? 'flex' : 'none';
        }

        // B. 连击倍率显示 (Multiplier)
        const multiplierEl = document.getElementById('multiplier-display');
        if (multiplierEl) {
            multiplierEl.style.opacity = (this.phase === 'combat') ? '1' : '0';
        }

        // C. 技能点面板 (SP Panel)
        // 逻辑：在 gathering 和 combat 显示，在选择阶段隐藏
        const spPanel = document.getElementById('sp-panel');
        if (spPanel) {
            if (this.phase === 'gathering' || this.phase === 'combat') {
                spPanel.style.opacity = '1';
                spPanel.style.pointerEvents = 'auto'; // 允许交互（查看提示等）
            } else {
                spPanel.style.opacity = '0';
                spPanel.style.pointerEvents = 'none';
            }
        }
        
        // D. 战斗 HUD (右侧小卡片)
        // 再次确保它在非战斗阶段隐藏 (虽然 renderRecipeHUD 也会处理)
        const combatHud = document.getElementById('recipe-hud-container');
        if (combatHud) {
            if (this.phase === 'combat') {
                combatHud.classList.remove('hidden'); // 确保进入战斗时可见
            } else {
                combatHud.classList.add('hidden');
            }
        }
        // E. 确保 HTML 结构中的弹药槽 (.ammo-stage) 不会泄露
        // 如果你的 current/next 弹药槽是独立元素且有 ID，可以在这里加类似的隐藏逻辑
        // 例如：
        /*
        const ammoSlots = document.getElementById('ammo-ui-container');
        if (ammoSlots) ammoSlots.style.display = (this.phase === 'combat') ? 'block' : 'none';
        */
    },

/**
     * 显示遗物选择界面
     */
    /**
     * 显示遗物选择界面 (支持稀有度权重 + 防重复)
     */
    ui_showRelicSelection() {
        // 1. 记录之前的状态 (用于关闭时恢复)
        this.stateBeforeRelic = this.phase; 

        // --- 配置权重 ---
        const RARITY_WEIGHTS = CONFIG.balance.relicRarityWright

        // 2. 准备遗物池
        // 过滤掉玩家已经拥有的遗物 (this.ownedRelics)
        let pool = RELIC_DB.filter(r => !this.ownedRelics.includes(r.id));
        
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
            el.innerHTML = `
                <div class="relic-icon">${relic.icon}</div>
                <div class="relic-name">${relic.name}</div>
                <div class="relic-desc">${relic.desc}</div>
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
        this.ownedRelics.push(relic.id);
        showToast(`獲得遺物: ${relic.name}`);
        //  处理新遗物效果
        if (relic.effect === 'pink_peg_up') {
            this.pinkPegCount += 3; // 叠加增加
        } 
        else if (relic.effect === 'combat_wall') {
            this.hasCombatWall = true;
        }else if (relic.effect === 'permanent_size_up') {
    this.marbleSizeBonus = 4.2; // 每次获得增加 4 像素半径
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
        showToast("獲得 500 分");
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
        
        // [核心修复] 根据打开前的状态决定去向
        if (this.stateBeforeRelic === 'gathering') {
            // 情况 A: 在收集阶段(打中遗物槽)打开的
            // 不需要跳转阶段，只需要尝试结算当前回合
            // (因为在 updateGathering 里，球已经被移除并 activeBalls-- 了，这里检查是否需要发射)
            this.phase_gathering_attemptComplete();
        } else {
            // 情况 B: 在回合结束(打完BOSS/固定回合事件)打开的
            // 正常进入下一轮的选弹珠阶段
            this.sys_initSelectionPhase(); 
        }
    },

/**
     * @method confirmSelection
     * @description 确认玩家选择的弹珠，并进入收集阶段。
     */
    ui_confirmSelection() { 
        if (this.selectedMarbles.length !== 3) {
            console.warn("[DEBUG] ui_confirmSelection: 选中的弹珠数量不足 3 个，当前为:", this.selectedMarbles.length);
            return;
        }
        this.marbleQueue = this.selectedMarbles.map(i => this.marblesPool[i]); // 将选中的弹珠放入队列
        this.phase_startGatheringPhase(); 
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
        if (this.phase === 'combat') { 
            // 1. 确保收集阶段的容器为空 (尽管 updateUI 已经隐藏了它的父级，清空更保险)
            if (gatheringHud) gatheringHud.innerHTML = '';

            // 2. 渲染战斗悬浮 HUD
            if (combatHud) {
                combatHud.classList.remove('hidden'); 
                combatHud.classList.add('recipe-hud-floating'); 
                combatHud.innerHTML = '';
                
                const previewLimit = 4;
                this.ammoQueue.slice(0, previewLimit).forEach((recipe, idx) => {
                    const isCurrent = (idx === 0);
                    const card = document.createElement('div');
                    card.className = `recipe-card ${isCurrent ? 'current' : 'queue'} mb-1 transition-all duration-300`;
                    
                    // --- 渲染 Header ---
                    const header = document.createElement('div');
                    header.className = 'flex justify-between items-center border-b border-white/10 pb-1 mb-1';
                    let nameStr = '普通魔藥';
                    if (recipe.explosive) nameStr = '爆破魔藥';
                    else if (recipe.isLaser) nameStr = '光束魔藥';
                    else if (recipe.isMatryoshka) nameStr = '套娃魔藥';
                    header.innerHTML = `<span class="font-bold text-amber-400 text-[11px]">${nameStr}</span><span class="text-[10px] text-slate-300 bg-slate-700/50 px-1 rounded">DMG ${recipe.damage || 0}</span>`;
                    
                    // --- 渲染 Grid ---
                    const grid = document.createElement('div');
                    grid.className = 'grid grid-cols-4 gap-0.5 text-[9px] leading-tight';
                    // ... (复制你原有的 stats 遍历逻辑) ...
                    const stats = [
                        { k: 'flying_sword', i: CONFIG.ui.attributeDisplay.flying_sword.icon },
                        { k: 'bounce', i: CONFIG.ui.attributeDisplay.bounce.icon },
                        { k: 'pierce', i: CONFIG.ui.attributeDisplay.pierce.icon },
                        { k: 'scatter', i: CONFIG.ui.attributeDisplay.scatter.icon },
                        { k: 'multicast', i: CONFIG.ui.attributeDisplay.multicast.icon },
                        { k: 'cryo', i: CONFIG.ui.attributeDisplay.cryo.icon },
                        { k: 'pyro', i: CONFIG.ui.attributeDisplay.pyro.icon },
                        { k: 'lightning', i: CONFIG.ui.attributeDisplay.lightning.icon },
                        { k: 'laser', i: CONFIG.ui.attributeDisplay.laser.icon },
                        { k: 'wind', i: CONFIG.ui.attributeDisplay.wind.icon }
                    ];
                    let hasStats = false;
                    stats.forEach(s => {
                        const val = recipe[s.k];
                        if (val > 0) {
                            hasStats = true;
                            const tag = document.createElement('div');
                            tag.innerHTML = `${s.i}<span class="text-white ml-px">${val}</span>`;
                            grid.appendChild(tag);
                        }
                    });
                    if (!hasStats) grid.innerHTML = '<span class="col-span-4 text-slate-500 italic text-center">基础属性</span>';

                    card.appendChild(header); // 挂载标题
                    card.appendChild(grid);   // 必须添加这一行，否则图标不显示！
                    if (isCurrent) {
                        const indicator = document.createElement('div');
                        indicator.className = 'absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-400 rounded-full shadow-[0_0_8px_#fbbf24]';
                        card.appendChild(indicator);
                    }
                    combatHud.appendChild(card);
                });
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
            if (gatheringHud && this.phase === 'gathering') {
                gatheringHud.innerHTML = ''; 
                this.marbleQueue.forEach((item, idx) => { 
                    const isActive = idx === this.activeMarbleIndex; 
                    this.ui_renderRecipeCard(gatheringHud, item, isActive, isActive ? 'current' : 'queue'); 
                }); 
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
            'wind': { c: CONFIG.colors.matWind, l: CONFIG.ui.attributeDisplay.wind.icon, n: '風' }
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

/**
     */
    ui_updateUICache() {
        const gaugeEl = document.getElementById('hero-gauge-container');
        if (gaugeEl) {
            const rect = gaugeEl.getBoundingClientRect();
            // 缓存中心坐标
            this.uiCache = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                // 缓存 DOM 引用，避免重复查询
                el: gaugeEl,
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
        q.innerHTML = ''; 
        for(let i = this.activeMarbleIndex; i < this.marbleQueue.length; i++) { 
            const m = this.marbleQueue[i]; 
            const d = document.createElement('div'); 
            d.className = 'queue-dot flex-shrink-0'; 
            d.style.background = m.type === 'rainbow' ? CONFIG.colors.marbleRainbow : m.getColor(); 
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
        if (this.ammoQueue.length > 0) {
            const currentRecipe = this.ammoQueue[0];
            this.ui_renderAmmoIcon(currentContainer, currentRecipe, true);
            
            // 更新底部属性文本
            let html = '';
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
        if (this.ammoQueue.length > 1) {
            const nextRecipe = this.ammoQueue[1];
            this.ui_renderAmmoIcon(nextContainer, nextRecipe, false);
        } else {
            nextContainer.innerHTML = '<span class="text-slate-700 text-xs">--</span>';
        }
    },

/**
     * 辅助方法：在UI中绘制一个纯CSS的子弹图标
     */
    ui_renderAmmoIcon(container, recipe, isCurrent) {
        const size = isCurrent ? 24 : 16;
        const div = document.createElement('div');
        
        // 基础球体
        div.style.width = `${size}px`;
        div.style.height = `${size}px`;
        div.style.borderRadius = '50%';
        
        // 颜色逻辑 (与 Projectile 一致)
        let bg = '#e2e8f0';
        let shadow = 'none';


        //  光球的 UI 样式 (高优先级)
        if (recipe.isLaser) { 
            // 核心白，外发光蓝，模拟“光球”质感
            bg = '#ffffff'; 
            // 动态阴影：激光层数越多，阴影扩散越大
            const glowSize = 10 + (recipe.laser || 0) * 2;
            shadow = `0 0 ${glowSize}px ${CONFIG.colors.laser}, inset 0 0 5px ${CONFIG.colors.laser}`;
        }else if (recipe.explosive) { bg = '#fca5a5'; shadow = '0 0 10px #ef4444'; }
        else if (recipe.pyro) { bg = '#fdba74'; shadow = '0 0 8px #f97316'; }
        else if (recipe.cryo) { bg = '#cffafe'; shadow = '0 0 8px #06b6d4'; }
        else if (recipe.lightning) { bg = '#e9d5ff'; shadow = '0 0 8px #c084fc'; }
        else if (recipe.pierce) { bg = '#fecaca'; }
        else if (recipe.bounce) { bg = '#bbf7d0'; }
        
        div.style.background = bg;
        div.style.boxShadow = shadow;
        div.style.position = 'relative';

        if (recipe.isLaser) {
             div.style.border = '2px solid #fff'; // 加个白圈
        }
        // 简单图标装饰
        if (recipe.scatter) {
            div.style.border = '2px solid #facc15'; // 黄框
        }
        if (recipe.multicast) {
            const badge = document.createElement('div');
            badge.innerText = `+${recipe.multicast}`;
            badge.className = 'absolute -top-2 -right-2 text-[10px] bg-orange-500 text-white rounded-full px-1 font-bold leading-tight';
            container.appendChild(badge);
        }
        
        container.appendChild(div);
    },

/**
     * [META] 应用局外升级到当前运行的 CONFIG
     */
    meta_applyUpgrades() {
        if (!this.saveData.upgrades) this.saveData.upgrades = {};
        if (!this.saveData.temporaryUpgrades) this.saveData.temporaryUpgrades = {};
        
        META_SHOP_CONFIG.upgrades.forEach(upgrade => {
            let level = 0;
            // 临时增强从 temporaryUpgrades 读取
            if (upgrade.temporary) {
                level = this.saveData.temporaryUpgrades[upgrade.id] || 0;
            } else {
                // 永久升级从 upgrades 读取
                level = this.saveData.upgrades[upgrade.id] || 0;
            }
            
            if (level > 0) {
                const effectValue = upgrade.effect.valuePerLevel * level;
                setDeepValue(CONFIG, upgrade.effect.path, effectValue, upgrade.effect.type);
            }
        });
        
    },

/**
     * [META] 增加货币并保存
     */
    meta_addCurrency(amount) {
        this.saveData.currency += amount;
        this.sys_saveData();
        this.ui_updateMetaCurrency();
    },

/**
     * [META] 点击"开始炼成"按钮
     */
    meta_startRun() {
        this.sys_resetGame(); 
        this.sys_initGameStart();
        // sys_initGameStart 内部已经调用了 ui_showRelicSelection
    },

/**
     * [META] 打开商店
     */
    meta_openShop() {
        this.phase_switchPhase('shop');
        this.meta_currentShopCategory = Object.keys(META_SHOP_CONFIG.categories)[0];
        this.ui_renderShop();
    },

/**
     * [META] 计算升级价格
     */
    meta_calculateUpgradeCost(upgrade, level) {
        const c = upgrade.cost;
        if (c.type === 'fixed') return c.values[level] || 0;
        if (c.type === 'linear') return c.base + level * c.growth;
        if (c.type === 'exponential') return Math.floor(c.base * Math.pow(c.growth, level));
        return 0;
    },

/**
     * [META] 购买升级
     */
    meta_buyUpgrade(upgradeId) {
        const upgrade = META_SHOP_CONFIG.upgrades.find(u => u.id === upgradeId);
        
        // 临时增强和永久升级分开处理
        const isTemporary = upgrade.temporary || false;
        const currentData = isTemporary ? this.saveData.temporaryUpgrades : this.saveData.upgrades;
        const level = currentData[upgradeId] || 0;
        
        if (level >= upgrade.maxLevel) return;
        
        const cost = this.meta_calculateUpgradeCost(upgrade, level);
        if (this.saveData.currency >= cost) {
            this.saveData.currency -= cost;
            currentData[upgradeId] = level + 1;
            this.sys_saveData();
            
            // [BUGFIX #2] 修复 setDeepValue 重复调用导致临时升级数值翻倍
            // 原 Bug: isTemporary 分支内外各调用了一次 setDeepValue，导致临时升级效果被应用两次
            // 修复：统一在分支外调用一次
            const effectValue = upgrade.effect.valuePerLevel * (level + 1);
            setDeepValue(CONFIG, upgrade.effect.path, effectValue, upgrade.effect.type);
            console.log(`[META] 立即应用升级: ${upgrade.id}, level: ${level + 1}, path: ${upgrade.effect.path}, value: ${effectValue}`);

            
            this.ui_updateMetaCurrency();
            this.ui_renderShop();
            audio.playTone(800, 'sine', 0.1, 0.3);
            const typeText = isTemporary ? '下一局生效' : `LV.${level + 1}`;
            if (window.showToast) showToast(`购买成功: ${upgrade.name} ${typeText}`);
        } else {
            if (window.showToast) showToast("能量精粹不足");
            audio.playTone(200, 'sawtooth', 0.1, 0.2);
        }
    },

    // ==================== 符文发射器 UI ====================

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
                const runeEntry = this.runeGrid[i];
                if (runeEntry) {
                    // 已有符文：移除并放回库存（保留对象格式）
                    this.runeGrid[i] = null;
                    this.runeInventory.push(runeEntry);
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
        if (!this.runeInventory || this.runeInventory.length === 0) {
            if (window.showToast) showToast('库存中没有符文');
            return;
        }

        const overlay = document.getElementById('rune-picker-overlay');
        const list = document.getElementById('rune-picker-list');
        if (!overlay || !list) return;

        list.innerHTML = '';

        // 对库存中的符文去重显示（但保留多个实例的选择）
        this.runeInventory.forEach((runeEntry, invIdx) => {
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
                const removeIdx = this.runeInventory.indexOf(runeEntry);
                if (removeIdx !== -1) {
                    this.runeInventory.splice(removeIdx, 1);
                } else {
                    // 如果对象引用不同，则通过 ID 和等级匹配
                    const fallbackIdx = this.runeInventory.findIndex(e => getRuneId(e) === runeId && 
                        ((typeof e === 'object' && e.level === runeLevel) || typeof e === 'string'));
                    if (fallbackIdx !== -1) {
                        this.runeInventory.splice(fallbackIdx, 1);
                    }
                }
                // 将符文放入网格（保留原始对象格式）
                this.runeGrid[cellIndex] = runeEntry;
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

            const runeEntry = this.runeGrid[i];
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
        const { activeStats, activatedRunewords, activatedCells } = parseRuneGrid(this.runeGrid, RUNEWORD_DB);
        this.activeRunewordStats = activeStats;

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
        const baseStats = calcRuneBaseStats(this.runeGrid, RUNE_DB);

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
        if (!this._selectedRuneIndices) this._selectedRuneIndices = new Set();

        // 移除旧的符文按鈕（保留 empty 提示）
        Array.from(container.children).forEach(child => {
            if (child.id !== 'rune-inventory-empty') child.remove();
        });

        if (countEl) countEl.textContent = `(${this.runeInventory.length})`;

        if (!this.runeInventory || this.runeInventory.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            // 清空选中状态
            this._selectedRuneIndices.clear();
            this._ui_updateRuneActionButtons();
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        this.runeInventory.forEach((runeEntry, idx) => {
            // 兼容新旧格式：提取符文 ID
            const runeId = getRuneId(runeEntry);
            if (!runeId) return;
            const runeDef = RUNE_DB.find(r => r.id === runeId);
            if (!runeDef) return;
            // 获取符文等级（新格式有 level，旧格式默认为 1）
            const runeLevel = (typeof runeEntry === 'object' && runeEntry.level) ? runeEntry.level : 1;
            const isSelected = this._selectedRuneIndices.has(idx);

            const card = document.createElement('div');
            card.className = [
                'relative flex flex-col items-center gap-0.5 p-2',
                'rounded-xl cursor-pointer select-none',
                'transition-all duration-200',
                isSelected
                    ? 'bg-purple-900/40 border-2 border-purple-400/80 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                    : 'bg-slate-800/60 border-2 border-slate-600/40 hover:border-purple-500/40',
            ].join(' ');

            card.innerHTML = `
                <span class="text-xl">${runeDef.icon || '?'}</span>
                <span class="text-[9px] text-slate-300 text-center leading-tight">${runeDef.name}</span>
                <span class="absolute top-0.5 right-0.5 text-[8px] font-bold px-1 rounded
                    ${runeLevel > 1 ? 'text-amber-400 bg-slate-900/60' : 'text-slate-500 bg-slate-900/40'}">
                    Lv.${runeLevel}
                </span>
                ${isSelected ? '<span class="absolute bottom-0.5 left-0.5 text-[8px] text-purple-300">✓</span>' : ''}
            `;

            card.addEventListener('click', () => {
                if (!this._selectedRuneIndices) this._selectedRuneIndices = new Set();
                if (this._selectedRuneIndices.has(idx)) {
                    // 取消选中
                    this._selectedRuneIndices.delete(idx);
                } else {
                    // 添加选中（最多 3 个）
                    if (this._selectedRuneIndices.size >= 3) {
                        // 移除最早选中的
                        const first = this._selectedRuneIndices.values().next().value;
                        this._selectedRuneIndices.delete(first);
                    }
                    this._selectedRuneIndices.add(idx);
                }
                // 刷新库存显示和按鈕状态
                this._ui_updateRuneInventoryDisplay();
                this._ui_updateRuneActionButtons();
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

            const statsText = rw.stats
                ? Object.entries(rw.stats).map(([k, v]) => `${k}+${v}`).join(', ')
                : '';

            card.innerHTML = `
                <div class="flex-1">
                    <div class="text-sm font-bold text-purple-200">${rw.name}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${rw.effect_desc || ''}</div>
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
        if (!this._selectedRuneIndices) this._selectedRuneIndices = new Set();
        const selectedCount = this._selectedRuneIndices.size;

        // 更新选中计数显示
        const countEl = document.getElementById('rune-selected-count');
        if (countEl) {
            countEl.textContent = `已选中 ${selectedCount}/3`;
            countEl.className = selectedCount > 0
                ? 'text-xs text-purple-300 font-bold'
                : 'text-xs text-slate-500';
        }

        // 获取选中符文对象
        const selectedRunes = Array.from(this._selectedRuneIndices).map(idx => {
            const entry = this.runeInventory[idx];
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
        if (!this._selectedRuneIndices || this._selectedRuneIndices.size !== 3) return;

        const selectedRunes = Array.from(this._selectedRuneIndices).map(idx => {
            const entry = this.runeInventory[idx];
            return typeof entry === 'object' ? entry : { id: entry, level: 1 };
        }).filter(Boolean);

        const result = rune_merge(selectedRunes, this.runeInventory);

        if (result.success) {
            this._selectedRuneIndices = new Set();
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
        if (!this._selectedRuneIndices || this._selectedRuneIndices.size !== 3) return;

        const selectedRunes = Array.from(this._selectedRuneIndices).map(idx => {
            const entry = this.runeInventory[idx];
            return typeof entry === 'object' ? entry : { id: entry, level: 1 };
        }).filter(Boolean);

        const result = rune_reforge(selectedRunes, this.runeInventory, this);

        if (result.success) {
            this._selectedRuneIndices = new Set();
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

    /**
     * @method ui_onPhaseChange
     * @description [重构] 集中处理阶段切换时的所有 DOM 类名操作。
     * 由 phase_switchPhase 调用，负责阶段标题容器的显示/隐藏和文本更新。
     * 将原先分散在 game_phase.js 中的 DOM 操作集中到此处统一管理。
     * @param {string} newPhase - 新阶段名称
     */
    ui_onPhaseChange(newPhase) {
        const titleContainer = document.getElementById('phase-title-container');
        const titleText = document.getElementById('phase-title');
        const subText = document.getElementById('phase-sub');
        if (!titleContainer || !titleText || !subText) return;

        // 显示阶段标题
        titleContainer.classList.remove('minimized');

        // 根据阶段设置标题文本
        // 注：此处文字与 game_phase.js 原始内容保持一致
        const PHASE_TITLES = {
            'meta':       { text: '\u56de\u8072\u7149\u91d1\u5e2b', sub: 'Echo Alchemist' },
            'gathering':  { text: '\u7814\u78e8\u968e\u6bb5', sub: '\u6536\u96c6\u9b54\u529b' },
            'combat':     { text: '\u6230\u9b25\u968e\u6bb5', sub: '\u6297\u79a6\u9b54\u50cf' },
            'truth_book': { text: '\u771f\u7406\u4e4b\u66f8', sub: '\u6d1e\u6089\u842c\u7269\u4e4b\u7406' },
            'training':   { text: '\u8a66\u7149\u5834', sub: '\u6975\u9650\u6230\u9b25\u6e2c\u8a66' },
        };
        const titleData = PHASE_TITLES[newPhase] || { text: '\u547d\u904b\u6289\u62e9', sub: '\u9078\u64c7\u4f60\u7684\u547d\u904b' };
        titleText.innerText = titleData.text;
        subText.innerText = titleData.sub;

        // 1.2秒后隐藏阶段标题
        setTimeout(() => { titleContainer.classList.add('minimized'); }, 1200);
    },

    /**
     * @method ui_triggerScreenShake
     * @description [重构] 触发屏幕震动效果（shake-hard CSS 动画）。
     * 将原先分散在 combat_system.js 中的直接 DOM 操作提取到 ui_system.js。
     * @param {number} [duration=200] - 震动持续时间（毫秒）
     */
    ui_triggerScreenShake(duration = 200) {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.classList.add('shake-hard');
        setTimeout(() => container.classList.remove('shake-hard'), duration);
    },
};
