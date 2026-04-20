// [Task 2.4] UI 渲染逻辑已按区域拆分到独立模块
// - src/ui/hud.js: HUD 渲染（弹药、配方、伤害统计等）
// - src/ui/shop.js: 商店/遗物选择界面渲染
// - src/ui/rune_launcher.js: 符文发射器界面渲染
// 这些模块通过 bind(this) 组合模式作为实例方法注入到 Game 实例，在 core.js 构造函数中完成

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
import { eventBus, EVENT_TYPES } from './event_bus.js';
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

        // 目标位置：局外货币显示（首页）
        let targetEl = document.getElementById('meta-currency-display');
        
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
        this.phase_switchPhase('truth_book');  // [Mixin 正常用法：读取 Game 实例状态]
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
        this.phase_switchPhase('meta');  // [Mixin 正常用法：读取 Game 实例状态]
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
        const runeFragments = this.saveData.runeFragments || 0;  // [Mixin 正常用法：读取 Game 实例状态]
        const el = document.getElementById('meta-currency-display');
        if (el) el.innerText = runeFragments.toLocaleString();
        const shopEl = document.getElementById('shop-currency-display');
        if (shopEl) shopEl.innerText = runeFragments.toLocaleString();
        // 同时更新顶部符文计数显示
        this.ui_updateRuneCountDisplay();
    },

    /**
     * [UI] 更新顶部符文数量显示
     */
    ui_updateRuneCountDisplay() {
        const el = document.getElementById('rune-count-display');
        if (el) el.innerText = (this.runeInventory ? this.runeInventory.length : 0);  // [Mixin 正常用法：读取 Game 实例状态]
    },

    ui_getSelectionRequirement() {
        return Math.max(1, this.selectionRequiredCount || CONFIG.gameplay.selectionReq || 3);
    },

    ui_isSelectionConfirmReady() {
        const required = this.ui_getSelectionRequirement();
        if ((this.selectedMarbles || []).length !== required) return false;
        if (this.selectionMode === 'pure_essence') {
            return !!(this.selectionInjectedRune && this.selectionInjectedRune.marbleIndex === this.selectedMarbles[0]);
        }
        return true;
    },

    ui_getPureEssenceLegalElements(marbleDef) {
        const validRuneElements = new Set((RUNE_DB || []).map(r => r.element));
        const legal = new Set();
        if (marbleDef?.type && validRuneElements.has(marbleDef.type)) legal.add(marbleDef.type);
        (marbleDef?.collected || []).forEach(item => {
            const type = typeof item === 'string' ? item : item?.type;
            if (validRuneElements.has(type)) legal.add(type);
        });
        return [...legal];
    },

    ui_getPureEssenceRuneOptions(marbleDef) {
        const legalElements = new Set(this.ui_getPureEssenceLegalElements(marbleDef));
        return (this.runeInventory || []).map((rune, inventoryIndex) => {
            const runeDef = (RUNE_DB || []).find(item => item.id === rune.id);
            if (!runeDef || !legalElements.has(runeDef.element)) return null;
            return { inventoryIndex, rune, runeDef };
        }).filter(Boolean);
    },

    ui_selectPureEssenceRune(selectionIndex, inventoryIndex) {
        if (this.selectionMode !== 'pure_essence') return;
        if (!(this.selectedMarbles || []).includes(selectionIndex)) {
            showToast('請先選中這枚彈珠，再注入符文。');
            return;
        }
        const marbleDef = this.marblesPool?.[selectionIndex];
        const option = this.ui_getPureEssenceRuneOptions(marbleDef).find(item => item.inventoryIndex === inventoryIndex);
        if (!option) {
            showToast('符文屬性不合法，無法注入。');
            return;
        }
        this.selectionInjectedRune = {
            marbleIndex: selectionIndex,
            inventoryIndex,
            runeId: option.rune.id,
            level: option.rune.level || 1,
            element: option.runeDef.element,
            icon: option.runeDef.icon,
            name: option.runeDef.name,
            baseStatPerLevel: option.runeDef.baseStatPerLevel || 1,
        };
        this.ui_refreshSelectionModeUI();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    ui_renderPureEssencePanel(marbleDef, selectionIndex) {
        const panel = document.getElementById('marble-preview-panel');
        if (!panel) return;
        let host = document.getElementById('selection-augment-panel');
        if (!host) {
            host = document.createElement('div');
            host.id = 'selection-augment-panel';
            host.className = 'mt-3';
            panel.appendChild(host);
        }
        if (this.selectionMode !== 'pure_essence' || !marbleDef || selectionIndex < 0) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
        }

        host.style.display = 'block';
        const legalElements = this.ui_getPureEssenceLegalElements(marbleDef);
        const options = this.ui_getPureEssenceRuneOptions(marbleDef);
        const selectedIndex = (this.selectedMarbles || [])[0];
        const isSelected = selectedIndex === selectionIndex;
        const selectedRune = (isSelected && this.selectionInjectedRune && this.selectionInjectedRune.marbleIndex === selectionIndex)
            ? this.selectionInjectedRune
            : null;
        const legalHtml = legalElements.length > 0
            ? legalElements.map(element => {
                const display = CONFIG.ui?.attributeDisplay?.[element] || {};
                return `<span class="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">${display.icon || '✦'} ${display.name || element}</span>`;
            }).join('')
            : '<span class="inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200">無合法屬性</span>';

        let optionsHtml = '';
        if (!isSelected) {
            optionsHtml = '<div class="text-xs text-slate-400">先選中這枚彈珠，再從下方合法符文中注入。</div>';
        } else if (options.length === 0) {
            optionsHtml = '<div class="text-xs text-rose-300">當前符文庫中沒有與此彈珠屬性匹配的合法符文。</div>';
        } else {
            optionsHtml = options.map(item => {
                const active = selectedRune && selectedRune.inventoryIndex === item.inventoryIndex;
                return `<button type="button" data-inventory-index="${item.inventoryIndex}" class="pure-essence-rune-btn px-2 py-1 rounded-lg border text-xs transition-all ${active ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:border-emerald-300 hover:text-white'}">${item.runeDef.icon || '✦'} ${item.runeDef.name} Lv.${item.rune.level || 1}</button>`;
            }).join('');
        }

        host.innerHTML = `
            <div class="preview-divider"></div>
            <div class="preview-peg-label">純淨精華 / 符文注入</div>
            <div class="text-xs text-slate-300 mb-2">只允許注入彈珠原本已具備的屬性；不合法屬性會被攔截。</div>
            <div class="flex flex-wrap gap-2 mb-2">${legalHtml}</div>
            <div class="flex flex-wrap gap-2">${optionsHtml}</div>
            <div class="text-xs ${selectedRune ? 'text-amber-200' : 'text-slate-500'} mt-2">${selectedRune ? `已選中注入符文：${selectedRune.icon || '✦'} ${selectedRune.name} → ${CONFIG.ui?.attributeDisplay?.[selectedRune.element]?.name || selectedRune.element}` : '尚未選中注入符文。'}</div>
        `;

        host.querySelectorAll('.pure-essence-rune-btn').forEach(btn => {
            btn.onclick = () => this.ui_selectPureEssenceRune(selectionIndex, Number(btn.dataset.inventoryIndex));
        });
    },

    ui_isFateMomentPhase() {
        return this.phase === 'selection' && !!this.fateMomentContext?.type;
    },

    /**
     * @method ui_renderReplaceAmmoUI
     * @description [ammo-replace] 渲染「研磨完成后子弹替换」阶段的 UI。
     * 展示 6 张卡片：左侧 3 张是新研磨的 recipe，右侧 3 张是充能子弹。
     * 默认选中右侧 3 张（保持充能子弹），玩家可切换选中。
     *
     * 卡片三层叠加视觉系统：
     *   Layer 1 — 稀有度边框（multicast + 属性总层数综合评级 C/B/A/S）
     *     - multicast: >=9→S, >=6→A, >=3→B, 0→C
     *     - 属性总层数: >=15→S, >=8→A, >=3→B, <3→C
     *     - 取两者较高等级
     *   Layer 2 — 主属性浮雕背景（主属性 >5 且占总层数 >=50%）
     *     - 卡片背景换为该属性的主题渐变 + 浮雕纹理感
     *   Layer 3 — 闪光扫光（总属性层数 >12）
     *     - 叠加 CSS 扫光动画 .ammo-card-shine
     * 卡片索引：0~(newRecipes.length-1) 为新研磨，newRecipes.length~ 为充能子弹。
     */
    ui_renderReplaceAmmoUI() {
        const ctx = this.replaceAmmoContext;
        console.log('[ammo-replace][ui_renderReplaceAmmoUI] 进入', {
            ctx: ctx ? { active: ctx.active, newCount: (ctx.newRecipes||[]).length, chargedCount: (ctx.chargedRecipes||[]).length, selectedIndices: ctx.selectedIndices } : null,
            phase: this.phase,
        });
        if (!ctx || !ctx.active) {
            console.warn('[ammo-replace][ui_renderReplaceAmmoUI] ctx不存在或未激活，提前返回');
            return;
        }

        const gridEl = document.getElementById('marble-selection-grid');
        const labelEl = document.getElementById('selection-mode-label');
        const subtitleEl = document.getElementById('selection-mode-subtitle');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const skipGrindBtn = document.getElementById('skip-grind-btn');
        const countEl = document.getElementById('selected-count');
        const requiredEl = document.getElementById('selected-required-count');
        const recipeHud = document.getElementById('recipe-hud-container');
        const previewPanel = document.getElementById('marble-preview-panel');

        // 隐藏不相关元素
        if (recipeHud) recipeHud.classList.add('hidden');
        if (skipGrindBtn) skipGrindBtn.style.display = 'none';
        if (previewPanel) previewPanel.className = 'marble-preview-hidden';

        const newRecipes = ctx.newRecipes || [];
        const chargedRecipes = ctx.chargedRecipes || [];
        const maxSelect = Math.max(newRecipes.length, chargedRecipes.length, 3);
        const selectedIndices = ctx.selectedIndices || [];

        // 更新底栏标签
        if (labelEl) labelEl.innerText = '子弹替换';
        if (subtitleEl) {
            subtitleEl.style.display = 'block';
            subtitleEl.classList.remove('hidden');
            subtitleEl.innerText = '选择最终进入战斗的 ' + maxSelect + ' 枚子弹（默认保留旧子弹）';
        }
        if (countEl) countEl.innerText = String(selectedIndices.length);
        if (requiredEl) requiredEl.innerText = String(maxSelect);

        // ─── Layer 1: 稀有度评级辅助函数 ──────────────────────────────────────
        // 返回 0=C / 1=B / 2=A / 3=S
        const _calcTier = (recipe) => {
            const mc = recipe.multicast || 0;
            const mcTier = mc >= 9 ? 3 : mc >= 6 ? 2 : mc >= 3 ? 1 : 0;
            const statKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
            let statSum = 0;
            statKeys.forEach(k => { if (recipe[k] > 0) statSum += recipe[k]; });
            if (recipe.explosive) statSum += 3;
            if (recipe.isLaser && !(recipe.laser > 0)) statSum += 3;
            const statTier = statSum >= 15 ? 3 : statSum >= 8 ? 2 : statSum >= 3 ? 1 : 0;
            return Math.max(mcTier, statTier);
        };

        // ─── Layer 2: 主属性浮雕识别 ──────────────────────────────────────
        // 返回 null 或 { key, val, theme } 对象
        const _calcDominant = (recipe) => {
            const statKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
            let statSum = 0;
            let maxKey = null, maxVal = 0;
            statKeys.forEach(k => {
                const v = recipe[k] || 0;
                if (v > 0) { statSum += v; if (v > maxVal) { maxVal = v; maxKey = k; } }
            });
            // 条件：主属性 >5 且占总层数 >=50%
            if (!maxKey || maxVal <= 5 || statSum === 0 || maxVal / statSum < 0.5) return null;
            // 属性主题配置：[ bgGrad, accentColor, embossLight, embossDark ]
            const ATTR_THEMES = {
                pyro:        ['linear-gradient(160deg,#7c2d12 0%,#431407 60%,#1c0a03 100%)', '#f97316', '#fdba74', '#7c2d12'],
                cryo:        ['linear-gradient(160deg,#0c4a6e 0%,#082f49 60%,#020f1a 100%)', '#06b6d4', '#bae6fd', '#0c4a6e'],
                lightning:   ['linear-gradient(160deg,#3b0764 0%,#1e0536 60%,#0a0118 100%)', '#c084fc', '#e9d5ff', '#3b0764'],
                laser:       ['linear-gradient(160deg,#0c2a4a 0%,#061525 60%,#020810 100%)', '#60a5fa', '#bfdbfe', '#0c2a4a'],
                bounce:      ['linear-gradient(160deg,#14532d 0%,#052e16 60%,#010f07 100%)', '#22c55e', '#bbf7d0', '#14532d'],
                pierce:      ['linear-gradient(160deg,#7f1d1d 0%,#450a0a 60%,#1a0303 100%)', '#ef4444', '#fecaca', '#7f1d1d'],
                scatter:     ['linear-gradient(160deg,#713f12 0%,#3b1f05 60%,#150b01 100%)', '#eab308', '#fef08a', '#713f12'],
                damage:      ['linear-gradient(160deg,#4a1d96 0%,#2e1065 60%,#0f0528 100%)', '#a855f7', '#e9d5ff', '#4a1d96'],
                wind:        ['linear-gradient(160deg,#064e3b 0%,#022c22 60%,#010f0a 100%)', '#34d399', '#a7f3d0', '#064e3b'],
                flying_sword:['linear-gradient(160deg,#0c4a6e 0%,#082f49 60%,#020f1a 100%)', '#0ea5e9', '#bae6fd', '#0c4a6e'],
            };
            const theme = ATTR_THEMES[maxKey] || null;
            return theme ? { key: maxKey, val: maxVal, theme } : null;
        };

        // ─── Layer 3: 闪光判断 ────────────────────────────────────────────────
        const _calcShine = (recipe) => {
            const statKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
            let statSum = 0;
            statKeys.forEach(k => { if (recipe[k] > 0) statSum += recipe[k]; });
            if (recipe.explosive) statSum += 3;
            if (recipe.isLaser && !(recipe.laser > 0)) statSum += 3;
            return statSum > 12;
        };

        // 各 tier 的边框视觉配置
        const TIER_STYLES = [
            // C — 灰色基础，无光晕
            { label: 'C', labelColor: '#94a3b8', borderIdle: '#475569', borderSelected: '#f59e0b',
              bgIdle: 'rgba(30,41,59,0.75)', bgSelected: 'rgba(245,158,11,0.12)',
              glow: 'none', iconSize: 26, nameFontSize: '12px' },
            // B — 蓝绿色，轻微光晕
            { label: 'B', labelColor: '#34d399', borderIdle: '#34d399', borderSelected: '#f59e0b',
              bgIdle: 'rgba(6,78,59,0.35)', bgSelected: 'rgba(245,158,11,0.15)',
              glow: '0 0 8px rgba(52,211,153,0.35)', iconSize: 30, nameFontSize: '12px' },
            // A — 紫色精英，明显光晕
            { label: 'A', labelColor: '#c084fc', borderIdle: '#c084fc', borderSelected: '#f59e0b',
              bgIdle: 'rgba(88,28,135,0.35)', bgSelected: 'rgba(245,158,11,0.15)',
              glow: '0 0 12px rgba(192,132,252,0.5)', iconSize: 34, nameFontSize: '13px' },
            // S — 金色传说，强烈光晕 + 顶部彩条
            { label: 'S', labelColor: '#facc15', borderIdle: '#facc15', borderSelected: '#facc15',
              bgIdle: 'rgba(120,53,15,0.40)', bgSelected: 'rgba(245,158,11,0.22)',
              glow: '0 0 18px rgba(250,204,21,0.65)', iconSize: 38, nameFontSize: '13px' },
        ];

        // 渲染卡片列表
        if (gridEl) {
            gridEl.style.gridTemplateColumns = '';
            gridEl.style.maxWidth = '';
            gridEl.innerHTML = '';

            // 外层容器：上下两行，每行三列
            const wrapper = document.createElement('div');
            wrapper.className = 'w-full flex flex-col gap-2';

            // ─── 辅助函数：渲染一张子弹卡片 ────────────────────────────────
            const renderCard = (recipe, globalIdx, label) => {
                const isSelected = selectedIndices.includes(globalIdx);
                const tier = _calcTier(recipe);
                const ts = TIER_STYLES[tier];
                const dominant = _calcDominant(recipe);
                const shine = _calcShine(recipe);

                // ─── 卡片外层容器（overflow:hidden 用于裁剪扫光）
                const cardWrap = document.createElement('div');
                cardWrap.style.cssText = 'position:relative;border-radius:10px;overflow:hidden;';

                // ─── Layer 1 边框 + Layer 2 浮雕背景
                const card = document.createElement('div');
                // 背景优先级：浮雕 > tier 默认
                let cardBg;
                if (dominant) {
                    const [bgGrad, accent, embossL, embossD] = dominant.theme;
                    // 浮雕效果：在属性主题渐变上叠加对角线亮面，模拟浮雕纹理
                    const embossOverlay = 'linear-gradient(135deg,' + embossL + '22 0%,transparent 40%,transparent 60%,' + embossD + '44 100%)';
                    cardBg = isSelected
                        ? bgGrad.replace('100%)', '100%), ' + embossOverlay)
                        : bgGrad + ', ' + embossOverlay;
                    // 实际实现：用 CSS 多背景叠加
                    card.style.background = bgGrad;
                    // 内嵌一层浮雕覆盖层
                    const embossLayer = document.createElement('div');
                    embossLayer.style.cssText = 'position:absolute;inset:0;border-radius:10px;pointer-events:none;background:' + embossOverlay + ';';
                    cardWrap.appendChild(embossLayer);
                } else {
                    card.style.background = isSelected ? ts.bgSelected : ts.bgIdle;
                }

                card.style.cssText += [
                    'position:relative',
                    'display:flex',
                    'flex-direction:column',
                    'align-items:center',
                    'padding:7px 5px 6px',
                    'border-radius:10px',
                    'cursor:pointer',
                    'user-select:none',
                    'transition:all 0.15s',
                    'overflow:visible',
                    'border:1.5px solid ' + (isSelected ? ts.borderSelected : (dominant ? dominant.theme[1] : ts.borderIdle)),
                    'box-shadow:' + (isSelected
                        ? '0 0 0 2px ' + ts.borderSelected + ', ' + (dominant ? '0 0 14px ' + dominant.theme[1] + '88' : ts.glow)
                        : (dominant ? '0 0 10px ' + dominant.theme[1] + '55' : ts.glow)),
                ].join(';');

                cardWrap.appendChild(card);

                // ─── Layer 3: 扫光覆盖层（overflow:hidden 已在 cardWrap 设置）
                if (shine) {
                    const shineEl = document.createElement('div');
                    shineEl.className = 'ammo-card-shine';
                    shineEl.style.cssText = 'position:absolute;inset:0;border-radius:10px;pointer-events:none;z-index:10;';
                    cardWrap.appendChild(shineEl);
                }

                // S 级顶部彩条
                if (tier === 3) {
                    const topBar = document.createElement('div');
                    topBar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:3px;border-radius:10px 10px 0 0;background:linear-gradient(90deg,#f59e0b,#facc15,#fde68a,#facc15,#f59e0b);z-index:11;pointer-events:none;';
                    cardWrap.appendChild(topBar);
                }

                // Tier 徽章（左上角，浮在 cardWrap 上方）
                const tierBadge = document.createElement('div');
                tierBadge.style.cssText = [
                    'position:absolute',
                    'top:-7px',
                    'left:6px',
                    'font-size:9px',
                    'font-weight:900',
                    'line-height:1',
                    'padding:2px 5px',
                    'border-radius:4px',
                    'letter-spacing:0.05em',
                    'z-index:12',
                    'color:' + (dominant ? dominant.theme[1] : ts.labelColor),
                    'background:rgba(15,23,42,0.92)',
                    'border:1px solid ' + (dominant ? dominant.theme[1] : ts.labelColor),
                    'box-shadow:0 0 6px ' + (dominant ? dominant.theme[1] : ts.labelColor) + '66',
                ].join(';');
                tierBadge.innerText = tier === 3 ? '✦ S' : tier === 2 ? 'A' : tier === 1 ? 'B' : 'C';
                cardWrap.appendChild(tierBadge);

                // 选中标识（右上角）
                const checkBadge = document.createElement('div');
                checkBadge.style.cssText = [
                    'position:absolute',
                    'top:-7px',
                    'right:6px',
                    'font-size:9px',
                    'font-weight:700',
                    'padding:2px 5px',
                    'border-radius:4px',
                    'z-index:12',
                    isSelected
                        ? 'background:#f59e0b;color:#1e293b;'
                        : 'background:rgba(30,41,59,0.9);color:#64748b;border:1px solid #334155;',
                ].join(';');
                checkBadge.innerText = isSelected ? '✓' : '○';
                cardWrap.appendChild(checkBadge);

                // ─── 卡片内容（均挂在 card 上）

                // 子弹类型图标（纯CSS球体）
                let iconBg = '#e2e8f0';
                let iconGlow = 'none';
                if (recipe.isLaser) { iconBg = 'radial-gradient(circle at 35% 35%, #ffffff, #93c5fd)'; iconGlow = '0 0 10px #60a5fa, 0 0 20px #3b82f680'; }
                else if (recipe.explosive) { iconBg = 'radial-gradient(circle at 35% 35%, #fecaca, #ef4444)'; iconGlow = '0 0 10px #ef4444, 0 0 20px #ef444460'; }
                else if (recipe.pyro > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #fed7aa, #f97316)'; iconGlow = '0 0 10px #f97316, 0 0 18px #f9731660'; }
                else if (recipe.cryo > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #e0f2fe, #06b6d4)'; iconGlow = '0 0 10px #06b6d4, 0 0 18px #06b6d460'; }
                else if (recipe.lightning > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #f3e8ff, #c084fc)'; iconGlow = '0 0 10px #c084fc, 0 0 18px #c084fc60'; }
                else if (recipe.pierce > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #fecaca, #ef4444)'; }
                else if (recipe.bounce > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #dcfce7, #22c55e)'; }
                else if (recipe.scatter > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #fef9c3, #eab308)'; }
                else if (recipe.wind > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #d1fae5, #34d399)'; }
                else if (recipe.flying_sword > 0) { iconBg = 'radial-gradient(circle at 35% 35%, #bae6fd, #0ea5e9)'; iconGlow = '0 0 8px #0ea5e9'; }

                // 弹珠图标已隐藏以节省空间（一行三列紧凑布局）

                // 子弹名称
                const marbleType = recipe._marbleType || recipe.type || 'normal';
                const typeNames = { normal: '普通', explosive: '爆炸', cryo: '冰霜', pyro: '火焰', lightning: '雷电', laser: '激光', bounce: '弹跳', pierce: '穿透', scatter: '散射', rainbow: '彩虹', matryoshka: '套娃', flying_sword: '飞剑' };
                // 浮雕卡片的名称用属性主题色
                const nameColor = dominant ? dominant.theme[2] : '#fef3c7';
                const nameEl = document.createElement('div');
                nameEl.style.cssText = 'font-size:' + ts.nameFontSize + ';font-weight:700;color:' + nameColor + ';margin-top:2px;text-align:center;line-height:1.2;';
                nameEl.innerText = typeNames[marbleType] || marbleType;
                card.appendChild(nameEl);

                // 连射数（multicast）显示
                const mc = recipe.multicast || 0;
                if (mc > 0) {
                    const mcEl = document.createElement('div');
                    let mcColor = '#94a3b8';
                    if (mc >= 9) mcColor = '#facc15';
                    else if (mc >= 6) mcColor = '#c084fc';
                    else if (mc >= 3) mcColor = '#34d399';
                    mcEl.style.cssText = [
                        'display:flex',
                        'align-items:center',
                        'gap:2px',
                        'margin-top:4px',
                        'font-size:11px',
                        'font-weight:800',
                        'color:' + mcColor,
                        'text-shadow:0 0 6px ' + mcColor + '99',
                    ].join(';');
                    mcEl.innerHTML = '<span style="font-size:9px;opacity:0.8;">🔗</span><span>×' + (1 + mc) + '</span>';
                    card.appendChild(mcEl);
                }

                // 属性行（带颜色图标）
                const attrKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
                const attrIcons = (CONFIG.ui && CONFIG.ui.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
                const attrsEl = document.createElement('div');
                attrsEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;justify-content:center;margin-top:3px;';
                let hasAttr = false;
                attrKeys.forEach(function(k) {
                    if (recipe[k] && recipe[k] > 0) {
                        hasAttr = true;
                        const info = attrIcons[k] || {};
                        const attrColor = info.color || '#94a3b8';
                        const attrIcon = info.icon || '◆';
                        const isDominantAttr = dominant && dominant.key === k;
                        const chip = document.createElement('span');
                        chip.style.cssText = [
                            'display:inline-flex',
                            'align-items:center',
                            'gap:1px',
                            'font-size:10px',
                            'font-weight:' + (isDominantAttr ? '800' : '600'),
                            'padding:1px 4px',
                            'border-radius:4px',
                            isDominantAttr
                                ? 'background:' + attrColor + '33;border:1px solid ' + attrColor + ';color:' + attrColor + ';box-shadow:0 0 5px ' + attrColor + '66;'
                                : 'background:rgba(15,23,42,0.7);border:1px solid ' + attrColor + '55;color:' + attrColor + ';',
                        ].join(';');
                        chip.innerHTML = '<span style="font-size:9px;">' + attrIcon + '</span><span>' + recipe[k] + '</span>';
                        attrsEl.appendChild(chip);
                    }
                });
                if (!hasAttr) {
                    const chip = document.createElement('span');
                    chip.style.cssText = 'font-size:10px;color:#475569;padding:1px 4px;';
                    chip.innerText = '基础';
                    attrsEl.appendChild(chip);
                }
                card.appendChild(attrsEl);

                // 来源标签（底部）
                const srcEl = document.createElement('div');
                srcEl.style.cssText = 'font-size:9px;font-weight:600;margin-top:3px;' +
                    (label === 'new' ? 'color:#38bdf8;' : 'color:#fbbf24;');
                srcEl.innerText = label === 'new' ? '✦ 新研磨' : '⚡ 充能';
                card.appendChild(srcEl);

                cardWrap.onclick = () => this.ui_toggleReplaceAmmoCard(globalIdx);
                return cardWrap;
            };

            // 上行：新研磨（一行三列）
            if (newRecipes.length > 0) {
                const newRow = document.createElement('div');
                newRow.className = 'flex flex-col gap-1';
                const newHeader = document.createElement('div');
                newHeader.className = 'text-[10px] text-sky-400 font-bold text-center border-b border-sky-400/30 pb-1';
                newHeader.innerText = '\u2728 新研磨';
                newRow.appendChild(newHeader);
                const newCards = document.createElement('div');
                newCards.className = 'grid gap-2 w-full';
                newCards.style.gridTemplateColumns = 'repeat(' + newRecipes.length + ', 1fr)';
                newRecipes.forEach((recipe, i) => {
                    newCards.appendChild(renderCard(recipe, i, 'new'));
                });
                newRow.appendChild(newCards);
                wrapper.appendChild(newRow);
            }

            // 下行：充能子弹（一行三列）
            if (chargedRecipes.length > 0) {
                const chargedRow = document.createElement('div');
                chargedRow.className = 'flex flex-col gap-1';
                const chargedHeader = document.createElement('div');
                chargedHeader.className = 'text-[10px] text-amber-400 font-bold text-center border-b border-amber-400/30 pb-1';
                chargedHeader.innerText = '\u26a1 充能子弹';
                chargedRow.appendChild(chargedHeader);
                const chargedCards = document.createElement('div');
                chargedCards.className = 'grid gap-2 w-full';
                chargedCards.style.gridTemplateColumns = 'repeat(' + chargedRecipes.length + ', 1fr)';
                chargedRecipes.forEach((recipe, i) => {
                    chargedCards.appendChild(renderCard(recipe, newRecipes.length + i, 'charged'));
                });
                chargedRow.appendChild(chargedCards);
                wrapper.appendChild(chargedRow);
            }

            gridEl.appendChild(wrapper);
        }

        // 更新确认按钮
        const isReady = selectedIndices.length === maxSelect;
        if (confirmBtn) {
            confirmBtn.disabled = !isReady;
            confirmBtn.innerText = '\u786e\u8a8d\uff08\u5df2\u9078 ' + selectedIndices.length + '/' + maxSelect + '\uff09';
            confirmBtn.onclick = () => {
                if (typeof this.sys_confirmReplaceAmmo === 'function') this.sys_confirmReplaceAmmo();
            };
        }

        // 跳过按钮：直接使用新研磨的子弹
        let skipBtn = document.getElementById('replace-ammo-skip-btn');
        if (!skipBtn) {
            skipBtn = document.createElement('button');
            skipBtn.id = 'replace-ammo-skip-btn';
            skipBtn.className = 'mt-2 flex items-center gap-1.5 px-4 py-2 bg-slate-800/80 border border-slate-600/60 rounded-lg text-xs text-slate-300 hover:bg-slate-700/80 hover:border-slate-400/80 hover:text-white transition-all duration-200';
            skipBtn.innerHTML = '<span>\u23e9</span><span>\u8df3\u904e\uff0c\u4f7f\u7528\u65b0\u7814\u78e8\u5b50\u5f39</span>';
            if (confirmBtn && confirmBtn.parentNode) {
                confirmBtn.parentNode.insertBefore(skipBtn, confirmBtn.nextSibling);
            }
        }
        skipBtn.style.display = 'flex';
        skipBtn.onclick = () => {
            if (typeof this.sys_skipReplaceAmmo === 'function') this.sys_skipReplaceAmmo();
        };
    },

    /**
     * @method ui_toggleReplaceAmmoCard
     * @description [ammo-replace] 切换子弹卡片的选中状态。
     * 卡片索引规则：0~(newRecipes.length-1) 为新研磨，newRecipes.length~ 为充能子弹。
     * 最多选中 maxSelect 张卡片。
     */
    ui_toggleReplaceAmmoCard(globalIdx) {
        if (!this.replaceAmmoContext || !this.replaceAmmoContext.active) return;
        const ctx = this.replaceAmmoContext;
        const newRecipes = ctx.newRecipes || [];
        const chargedRecipes = ctx.chargedRecipes || [];
        const maxSelect = Math.max(newRecipes.length, chargedRecipes.length, 3);
        let selectedIndices = ctx.selectedIndices ? [...ctx.selectedIndices] : [];

        const alreadySelected = selectedIndices.includes(globalIdx);
        if (alreadySelected) {
            // 取消选中
            selectedIndices = selectedIndices.filter(i => i !== globalIdx);
        } else {
            // 选中：如果已满则不允许
            if (selectedIndices.length >= maxSelect) return;
            selectedIndices.push(globalIdx);
        }
        ctx.selectedIndices = selectedIndices;
        // 重新渲染 UI
        this.ui_renderReplaceAmmoUI();
    },

    /**
     * @method ui_selectReplaceAmmoTarget
     * @description [ammo-replace] 已废弃，保留为兼容别名（调用 ui_toggleReplaceAmmoCard）。
     */
    ui_selectReplaceAmmoTarget(ammoIdx) {
        this.ui_toggleReplaceAmmoCard(ammoIdx);
    },

    ui_refreshSelectionModeUI() {
        // [ammo-replace] 如果当前处于替换阶段，跳过普通选择 UI 刷新，改由 ui_renderReplaceAmmoUI 控制
        if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
            this.ui_renderReplaceAmmoUI();
            return;
        }
        console.log('[DEBUG][ui_refreshSelectionModeUI] 进入', {
            selectionMode: this.selectionMode,
            replaceAmmoContext: JSON.stringify(this.replaceAmmoContext),
            marblesPoolLen: (this.marblesPool||[]).length,
            phase: this.phase,
        });
        const countEl = document.getElementById('selected-count');
        const requiredEl = document.getElementById('selected-required-count');
        const labelEl = document.getElementById('selection-mode-label');
        const subtitleEl = document.getElementById('selection-mode-subtitle');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const selectedCount = (this.selectedMarbles || []).length;
        const required = this.ui_getSelectionRequirement();
        // [pure_essence 修复] 纯净精华模式下展示单卡居中布局
        const gridEl = document.getElementById('marble-selection-grid');
        if (gridEl) {
            if (this.selectionMode === 'pure_essence') {
                gridEl.style.gridTemplateColumns = '1fr';
                gridEl.style.maxWidth = '160px';
            } else {
                gridEl.style.gridTemplateColumns = '';
                gridEl.style.maxWidth = '';
            }
        }
        // [pure_essence] 控制「跳过研磨」按鈕的显示/隐藏
        const skipGrindBtn = document.getElementById('skip-grind-btn');
        if (skipGrindBtn) {
            skipGrindBtn.style.display = (this.selectionMode === 'pure_essence') ? 'flex' : 'none';
        }
        // [tsk-668f3dba] 进入正常选择阶段时隐藏替换跳过按鈕
        const replaceSkipBtn = document.getElementById('replace-ammo-skip-btn');
        if (replaceSkipBtn) replaceSkipBtn.style.display = 'none';
        if (countEl) countEl.innerText = String(selectedCount);
        if (requiredEl) requiredEl.innerText = String(required);
        if (labelEl) {
            labelEl.innerText = this.selectionMode === 'pure_essence'
                ? '純淨精華'
                : this.selectionMode === 'chaos_essence'
                    ? '混沌精華'
                    : '命運抉擇';
        }
        if (subtitleEl) {
            if (this.selectionMode === 'pure_essence') {
                const injected = this.selectionInjectedRune
                    ? `已選：${this.selectionInjectedRune.icon || '✦'} ${this.selectionInjectedRune.name}`
                    : '尚未注入符文';
                subtitleEl.style.display = 'block';
                subtitleEl.classList.remove('hidden');
                subtitleEl.innerText = `選擇 1 枚彈珠並注入 1 個合法符文。${injected}`;
            } else if (this.selectionMode === 'chaos_essence') {
                subtitleEl.style.display = 'block';
                subtitleEl.classList.remove('hidden');
                subtitleEl.innerText = `命運時刻已開啟，請選擇 ${required} 枚彈珠後進入煉金。`;
            } else {
                subtitleEl.style.display = 'none';
                subtitleEl.classList.add('hidden');
                subtitleEl.innerText = '';
            }
        }
        if (confirmBtn) {
            confirmBtn.disabled = !this.ui_isSelectionConfirmReady();
            confirmBtn.innerText = this.selectionMode === 'pure_essence'
                ? '注入後開始煉金'
                : this.selectionMode === 'chaos_essence'
                    ? '接受命運後開始煉金'
                    : '開始煉金';
        }
        if (this.selectionPreviewState) {
            this.ui_renderPureEssencePanel(this.selectionPreviewState.marble, this.selectionPreviewState.selectionIndex);
        } else {
            this.ui_renderPureEssencePanel(null, -1);
        }
    },

/**
     * [META] 计算玩家拥有的某种资源符文数量
     * @param {string} resourceId - 资源ID（如 'rune_fragments', 'rune_pyro' 等）
     */
    meta_getResourceCount(resourceId) {
        if (resourceId === 'rune_fragments') {
            return this.saveData.runeFragments || 0;  // [Mixin 正常用法：读取 Game 实例状态]
        }
        // 其他资源是符文库存中对应element的符文数量
        const resDef = META_SHOP_CONFIG.resources[resourceId];
        if (!resDef || !resDef.element) return 0;
        const element = resDef.element;
        if (!this.saveData.runeInventory) return 0;  // [Mixin 正常用法：读取 Game 实例状态]
        return this.saveData.runeInventory.filter(r => {  // [Mixin 正常用法：读取 Game 实例状态]
            const runeDef = (typeof RUNE_DB !== 'undefined') ? RUNE_DB.find(rd => rd.id === r.id) : null;
            return runeDef && runeDef.element === element;
        }).length;
    },

    /**
     * [META] 消耗某种资源符文
     * @param {string} resourceId - 资源ID
     * @param {number} amount - 消耗数量
     */
    meta_spendResource(resourceId, amount) {
        if (resourceId === 'rune_fragments') {
            this.saveData.runeFragments = (this.saveData.runeFragments || 0) - amount;  // [Mixin 正常用法：读取 Game 实例状态]
            return;
        }
        const resDef = META_SHOP_CONFIG.resources[resourceId];
        if (!resDef || !resDef.element) return;
        const element = resDef.element;
        if (!this.saveData.runeInventory) return;  // [Mixin 正常用法：读取 Game 实例状态]
        let toRemove = amount;
        for (let i = this.saveData.runeInventory.length - 1; i >= 0 && toRemove > 0; i--) {  // [Mixin 正常用法：读取 Game 实例状态]
            const r = this.saveData.runeInventory[i];  // [Mixin 正常用法：读取 Game 实例状态]
            const runeDef = (typeof RUNE_DB !== 'undefined') ? RUNE_DB.find(rd => rd.id === r.id) : null;
            if (runeDef && runeDef.element === element) {
                this.saveData.runeInventory.splice(i, 1);  // [Mixin 正常用法：读取 Game 实例状态]
                toRemove--;
            }
        }
        // 同步到 runeInventory
        this.runeInventory = this.saveData.runeInventory.slice();  // [Mixin 正常用法：读取 Game 实例状态]
    },

/**
     * @method updateUI
     * @description 更新 UI 界面显示，强制管理各阶段元素的显隐
     */
     ui_updateUI() {
        // [DEBUG-LOG] 记录每次 ui_updateUI 调用时的 phase 和调用栈
        // [BUGFIX] 使用 _isRuneLauncherOpen() 兼容 PC 模式（dataset.pcMigrated）和移动端模式（style.display）
        const runeLauncherEl = document.getElementById('phase-rune-launcher');
        const launcherVisible = this._isRuneLauncherOpen ? this._isRuneLauncherOpen() 
            : (runeLauncherEl && runeLauncherEl.style.display !== 'none'); // 兜底兼容
        if (launcherVisible) {
            // 发射器打开时被调用：打印完整调用栈，帮助定位闪退来源
            console.warn('[ui_updateUI] ⚠️ 符文发射器打开期间被调用！phase=' + this.phase + '\n调用栈:', new Error().stack);
        } else {
            console.log('[ui_updateUI] phase=' + this.phase);
        }

        // [BUGFIX] 符文发射器打开期间 ui_updateUI 被调用时，不再强制清理内部蒙版；
        // 发射器面板将被保留，内部状态由发射器自身管理。

        // 1. 基础：隐藏所有阶段的主容器 (.ui-overlay)
        // [BUGFIX] 符文发射器是浮层覆盖层（不绑定任何 phase），若当前正在显示则跳过隐藏，
        //          防止每帧 ui_updateUI 调用将其强制关闭。
        // [PC 布局] PC 模式下符文发射器已迁移到右侧边栏并移除了 .ui-overlay 类，不会被这里隐藏。
        document.querySelectorAll('.ui-overlay').forEach(el => {
            if (el === runeLauncherEl && launcherVisible) return; // 保护：发射器打开时不隐藏（移动端模式）
            el.style.display = 'none'; 
            el.classList.add('hidden-phase'); 
            el.classList.remove('active-phase'); 
            // [BUGFIX] 隐藏阶段强制关闭 pointer-events，防止透明层遮挡 Canvas
            el.style.pointerEvents = 'none';
        });
        // 2. 显示当前阶段的主容器
        // [META] 兼容 phase-meta, shop, truth_book
        const activeEl = document.getElementById(`phase-${this.phase}`);  // [Mixin 正常用法：读取 Game 实例状态]
        if(activeEl) { 
            // gameover 阶段需要滚动，使用 block 布局
            activeEl.style.display = (this.phase === 'gameover') ? 'block' : 'flex';  // [Mixin 正常用法]
            // [BUGFIX] 激活阶段恢复 pointer-events (如果 HTML 中未显式设置 pointer-events: auto，则此处恢复默认)
            // 注意：.ui-overlay 默认是 pointer-events: none，子元素通过 pointer-events: auto 交互
            // 但某些全屏阶段（如 meta, shop）需要整体接收事件
            const needsAuto = ['meta', 'shop', 'truth_book', 'gameover', 'relic', 'pause'].includes(this.phase);
            activeEl.style.pointerEvents = needsAuto ? 'auto' : 'none';

            // 微小延迟以触发 CSS transition (如果有)
            setTimeout(() => { 
                activeEl.classList.remove('hidden-phase'); 
                activeEl.classList.add('active-phase'); 
            }, 10); 
        }
        
        // [META] 切换到主界面或商店时更新货币显示
        if (this.phase === 'meta' || this.phase === 'shop') {  // [Mixin 正常用法：读取 Game 实例状态]
            this.ui_updateMetaCurrency();
            // [局内存档] 进入 meta 页时同步更新“继续游戏”按鈕显隐
            if (this.phase === 'meta') this.meta_updateContinueButton();
        }

        // 1. 底部面板 (.bottom-panel) 只在收集阶段 (gathering) 且非 PC 模式下显示
        // PC 模式下收集队列和配方 HUD 已迁移到左侧边栏，底部面板始终隐藏
        const bottomPanel = document.querySelector('.bottom-panel');
        if (bottomPanel) {
            const isPCMode = document.body.classList.contains('pc-mode');
            if (this.phase === 'gathering' && !isPCMode) {  // [Mixin 正常用法：读取 Game 实例状态]
                bottomPanel.style.display = 'flex';
            } else {
                bottomPanel.style.display = 'none'; // 战斗阶段或 PC 模式隐藏底部面板
            }
        }

        // A. 技能杠 (Skill Bar) - 仅在战斗且有已解锁技能时显示
        const skillBar = document.getElementById('skill-bar');
        if (skillBar) {
            // [技能系统迭代] 必须在 combat 阶段且有已解锁技能才显示
            const hasSkills = this.activeSkills && this.activeSkills.length > 0;
            skillBar.style.display = (this.phase === 'combat' && hasSkills) ? 'flex' : 'none';  // [Mixin 正常用法：读取 Game 实例状态]
        }

        // B. 连击倍率显示 (Multiplier)
        const multiplierEl = document.getElementById('multiplier-display');
        if (multiplierEl) {
            multiplierEl.style.opacity = (this.phase === 'combat') ? '1' : '0';  // [Mixin 正常用法：读取 Game 实例状态]
        }

        // C. 技能点面板 (SP Panel)
        // [技能系统迭代] 仅当有已解锁技能时，在 gathering 和 combat 阶段显示
        const spPanel = document.getElementById('sp-panel');
        if (spPanel) {
            const hasSkillsForSP = this.activeSkills && this.activeSkills.length > 0;
            if ((this.phase === 'gathering' || this.phase === 'combat') && hasSkillsForSP) {  // [Mixin 正常用法：读取 Game 实例状态]
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
            if (this.phase === 'combat') {  // [Mixin 正常用法：读取 Game 实例状态]
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
        if (ammoSlots) ammoSlots.style.display = (this.phase === 'combat') ? 'block' : 'none';  // [Mixin 正常用法：读取 Game 实例状态]
        */

        // F. 统一顶部栏：在 meta/shop 全屏阶段隐藏，其他阶段显示
        const unifiedTopBar = document.getElementById('unified-top-bar');
        if (unifiedTopBar) {
            const hideInPhases = ['meta', 'shop', 'truth_book', 'training', 'relic', 'selection', 'gameover'];
            const shouldHideTopBar = hideInPhases.includes(this.phase) && !(typeof this.ui_isFateMomentPhase === 'function' && this.ui_isFateMomentPhase());
            unifiedTopBar.style.display = shouldHideTopBar ? 'none' : 'flex';  // [Mixin 正常用法：读取 Game 实例状态]
        }

        // G. 战斗充能符文 UI 显隐同步（已在 ui_onPhaseChange 处理，此处备用兼容）
        const runeChargeUi = document.getElementById('combat-rune-charge-ui');
        if (runeChargeUi) {
            runeChargeUi.style.display = (this.phase === 'combat') ? 'flex' : 'none';  // [Mixin 正常用法：读取 Game 实例状态]
        }
    },

    /**
     * @method ui_updatePCLayout
     * @description 检测当前视口是否为 PC 横屏模式，并切换三栏布局。
     * PC 模式条件：宽度 > 高度（横屏）且两侧剩余空间各 >= 240px。
     * 在 resize 事件、初始化和阶段切换时调用。
     * 侧边栏仅在 gathering / combat 阶段显示，其他阶段（meta/shop/gameover 等）隐藏。
     */
    ui_updatePCLayout() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isLandscape = vw > vh;

        // 游戏区域宽度：CSS 中 min(calc(100dvh * 9/16), 480px)
        const gameW = Math.min(Math.round(vh * 9 / 16), 480);
        const remainW = vw - gameW; // 两侧总剩余宽度
        const sideW = remainW / 2;  // 单侧可用宽度

        // PC 模式阈值：横屏 + 单侧 >= 240px（能容纳左右侧边栏）
        const shouldBePC = isLandscape && sideW >= 240;

        // 侧边栏仅在游戏进行中（gathering / combat）显示
        const gamePhases = ['gathering', 'combat'];
        const currentPhase = this.phase || 'meta'; // [Mixin 正常用法：读取 Game 实例状态]
        const shouldShowSidebars = shouldBePC && gamePhases.includes(currentPhase);

        const body = document.body;
        const leftSidebar = document.getElementById('pc-left-sidebar');
        const rightSidebar = document.getElementById('pc-right-sidebar');

        const wasPC = body.classList.contains('pc-mode');

        if (shouldBePC) {
            body.classList.add('pc-mode');
        } else {
            body.classList.remove('pc-mode');
        }

        if (shouldShowSidebars) {
            if (leftSidebar) leftSidebar.style.display = 'flex';
            if (rightSidebar) rightSidebar.style.display = 'flex';
            // 将符文发射器面板迁移到右侧边栏（如果尚未迁移）
            this._ui_migrateRuneLauncherToSidebar(true);
            // 根据当前阶段切换左侧边栏内容
            this._ui_updateLeftSidebarContent(currentPhase, wasPC);
        } else {
            if (leftSidebar) leftSidebar.style.display = 'none';
            if (rightSidebar) rightSidebar.style.display = 'none';
            if (!shouldBePC) {
                // 完全退出 PC 模式：迁移回原位
                this._ui_migrateRuneLauncherToSidebar(false);
                if (wasPC) this._ui_migrateHUDToLeftSidebar(false);
                if (wasPC) this._ui_migrateDrawerToLeftSidebar(false);
            }
        }
    },

    /**
     * @method _ui_updateLeftSidebarContent
     * @description 根据当前阶段切换左侧边栏内容区域。
     * - gathering：显示收集队列 + 配方 HUD
     * - combat：显示 info-drawer（敌人状态/特殊词条/配方图鉴/伤害统计）
     * @param {string} phase - 当前阶段
     * @param {boolean} wasPC - 上一帧是否为 PC 模式
     */
    _ui_updateLeftSidebarContent(phase, wasPC) {
        const gatheringPanel = document.getElementById('pc-left-gathering');
        const combatPanel = document.getElementById('pc-left-combat');

        if (phase === 'gathering') {
            if (gatheringPanel) gatheringPanel.style.display = 'flex';
            if (combatPanel) combatPanel.style.display = 'none';
            // 迁移收集队列和配方 HUD 到左侧边栏
            this._ui_migrateHUDToLeftSidebar(true);
            // 将 info-drawer 迁移回 game-container
            this._ui_migrateDrawerToLeftSidebar(false);
        } else if (phase === 'combat') {
            if (gatheringPanel) gatheringPanel.style.display = 'none';
            if (combatPanel) combatPanel.style.display = 'flex';
            // 将收集队列和配方 HUD 迁移回底部面板（战斗阶段底部面板隐藏，但节点需在原位）
            this._ui_migrateHUDToLeftSidebar(false);
            // 迁移 info-drawer 到左侧边栏
            this._ui_migrateDrawerToLeftSidebar(true);
        }
    },

    /**
     * @method _ui_migrateDrawerToLeftSidebar
     * @description 将 #info-drawer 在 game-container 和 pc-left-drawer-mount 之间迁移。
     * PC 战斗模式下 info-drawer 常驻展开在左侧边栏，不再滑入滑出。
     * @param {boolean} toSidebar - true: 迁移到左侧边栏; false: 迁移回 game-container
     */
    _ui_migrateDrawerToLeftSidebar(toSidebar) {
        const drawerEl = document.getElementById('info-drawer');
        const leftMount = document.getElementById('pc-left-drawer-mount');
        const gameContainer = document.getElementById('game-container');
        if (!drawerEl || !leftMount || !gameContainer) return;

        const isInSidebar = leftMount.contains(drawerEl);

        if (toSidebar && !isInSidebar) {
            leftMount.appendChild(drawerEl);
            // PC 模式下 info-drawer 始终展开，不受 translate-y-full 控制
            drawerEl.classList.remove('translate-y-full');
            drawerEl.dataset.pcDrawerMigrated = 'true';
        } else if (!toSidebar && isInSidebar) {
            gameContainer.appendChild(drawerEl);
            // 回到移动端：默认关闭状态
            drawerEl.classList.add('translate-y-full');
            delete drawerEl.dataset.pcDrawerMigrated;
        }
    },

    /**
     * @method _ui_migrateHUDToLeftSidebar
     * @description 将 #gathering-queue 和 #gathering-hud-mount 在底部面板和 PC 左侧边栏之间迁移。
     * 迁移的是 DOM 节点本身，所有 JS 渲染逻辑不需修改。
     * @param {boolean} toSidebar - true: 迁移到左侧边栏; false: 迁移回底部面板
     */
    _ui_migrateHUDToLeftSidebar(toSidebar) {
        const queueEl = document.getElementById('gathering-queue');
        const hudEl = document.getElementById('gathering-hud-mount');
        const leftQueueMount = document.getElementById('pc-left-queue-mount');
        const leftRecipeMount = document.getElementById('pc-left-recipe-mount');
        const bottomPanel = document.querySelector('.bottom-panel');
        if (!queueEl || !hudEl || !leftQueueMount || !leftRecipeMount || !bottomPanel) return;

        const isInSidebar = leftQueueMount.contains(queueEl);

        if (toSidebar && !isInSidebar) {
            // 迁移到左侧边栏
            leftQueueMount.appendChild(queueEl);
            leftRecipeMount.appendChild(hudEl);
        } else if (!toSidebar && isInSidebar) {
            // 迁移回底部面板的原始容器
            const queueContainer = bottomPanel.querySelector('.queue-container') || bottomPanel.firstElementChild;
            const hudWrapper = bottomPanel.querySelector('.flex-1.min-w-0.h-full') || bottomPanel.lastElementChild;
            if (queueContainer) queueContainer.appendChild(queueEl);
            else bottomPanel.insertBefore(queueEl, bottomPanel.firstChild);
            if (hudWrapper) hudWrapper.appendChild(hudEl);
            else bottomPanel.appendChild(hudEl);
        }
    },

    /**
     * @method _ui_migrateRuneLauncherToSidebar
     * @description 将 #phase-rune-launcher 在 game-container 和 pc-right-sidebar 之间迁移。
     * @param {boolean} toSidebar - true: 迁移到右侧边栏; false: 迁移回 game-container
     */
    _ui_migrateRuneLauncherToSidebar(toSidebar) {
        const launcherEl = document.getElementById('phase-rune-launcher');
        const rightMount = document.getElementById('pc-right-rune-mount');
        const gameContainer = document.getElementById('game-container');
        if (!launcherEl || !rightMount || !gameContainer) return;

        const isInSidebar = rightMount.contains(launcherEl);

        if (toSidebar && !isInSidebar) {
            // 迁移到右侧边栏
            rightMount.appendChild(launcherEl);
            // PC 模式下符文发射器始终可见，不受 ui_updateUI 的 .ui-overlay 隐藏逻辑影响
            launcherEl.classList.remove('ui-overlay');
            launcherEl.dataset.pcMigrated = 'true';
        } else if (!toSidebar && isInSidebar) {
            // 迁移回 game-container
            gameContainer.appendChild(launcherEl);
            launcherEl.classList.add('ui-overlay');
            launcherEl.style.display = 'none';
            delete launcherEl.dataset.pcMigrated;
        }
    },

/**
     * @method confirmSelection
     * @description 确认玩家选择的弹珠，并进入收集阶段。
     */
    ui_confirmSelection() { 
        const required = this.ui_getSelectionRequirement();
        if ((this.selectedMarbles || []).length !== required) {
            console.warn('[DEBUG] ui_confirmSelection: 选中的弹珠数量不符合要求，当前为:', this.selectedMarbles.length, '要求为:', required);
            return;
        }
        this.marbleQueue = this.selectedMarbles.map(i => this.marblesPool[i]);

        if (this.selectionMode === 'pure_essence') {
            const injected = this.selectionInjectedRune;
            const selectedIndex = this.selectedMarbles[0];
            const marble = this.marbleQueue[0];
            if (!injected || injected.marbleIndex !== selectedIndex) {
                showToast('純淨精華尚未完成符文注入。');
                return;
            }
            const legalElements = new Set(this.ui_getPureEssenceLegalElements(marble));
            if (!legalElements.has(injected.element)) {
                showToast('注入失敗：符文屬性與彈珠原有屬性不匹配。');
                return;
            }
            marble.collected = Array.isArray(marble.collected) ? marble.collected : [];
            const injectCount = Math.max(1, injected.level || 1) * Math.max(1, injected.baseStatPerLevel || 1);
            for (let i = 0; i < injectCount; i++) marble.collected.push(injected.element);
            marble.source = 'pure_essence';
            marble.infusedRuneId = injected.runeId;
            marble.infusedAttribute = injected.element;
            marble.assimilationMultiplier = Math.max(1, CONFIG.gameplay.assimilationDoubleMultiplier || 2);
            if (!this.doubleAssimilationBoostRounds) this.doubleAssimilationBoostRounds = {};
            this.doubleAssimilationBoostRounds[marble.type] = Math.max(this.doubleAssimilationBoostRounds[marble.type] || 0, 1);
            if (Array.isArray(this.runeInventory) && injected.inventoryIndex >= 0) {
                this.runeInventory.splice(injected.inventoryIndex, 1);
                if (this.saveData) this.saveData.runeInventory = (this.runeInventory || []).slice();
            }
            this.ui_updateRuneCountDisplay();
            showToast(`已為 ${marble.getName()} 注入 ${injected.icon || '✦'} ${injected.name}，本輪同化率 x${CONFIG.gameplay.assimilationDoubleMultiplier || 2}。`);
        }

        // [ammo-replace] 替换阶段已移至研磨完成后，此处仅清理上下文
        this.replaceAmmoContext = null;

        this.selectionMode = 'standard';
        this.selectionRequiredCount = CONFIG.gameplay.selectionReq || 3;
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        this.fateMomentContext = null;
        this.phase_startGatheringPhase();
    },

/**
     * [META] 应用局外升级到当前运行的 CONFIG
     */
    meta_applyUpgrades() {
        if (!this.saveData.upgrades) this.saveData.upgrades = {};  // [Mixin 正常用法：读取 Game 实例状态]
        if (!this.saveData.temporaryUpgrades) this.saveData.temporaryUpgrades = {};  // [Mixin 正常用法：读取 Game 实例状态]
        
        META_SHOP_CONFIG.upgrades.forEach(upgrade => {
            let level = 0;
            // 临时增强从 temporaryUpgrades 读取
            if (upgrade.temporary) {
                level = this.saveData.temporaryUpgrades[upgrade.id] || 0;  // [Mixin 正常用法：读取 Game 实例状态]
            } else {
                // 永久升级从 upgrades 读取
                level = this.saveData.upgrades[upgrade.id] || 0;  // [Mixin 正常用法：读取 Game 实例状态]
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
        // 局外货币改为符文碎片
        this.saveData.runeFragments = (this.saveData.runeFragments || 0) + amount;  // [Mixin 正常用法：读取 Game 实例状态]
        // [本局统计] 累计本局获得的符文碎片数
        this.runRuneFragmentsGained = (this.runRuneFragmentsGained || 0) + amount;
        this.sys_saveData();
        this.ui_updateMetaCurrency();
    },

/**
     * [META] 点击"开始炼成"按钮
     */
    meta_startRun() {
        // [BUGFIX] 如果当前正在主页教程（Step 0），点击“开始游戏”应该视为继续教程流程
        // 如果教程已经进入更深步骤或处于异常状态，这里确保逻辑一致性
        
        // [局内存档] 新开一局时清除旧存档
        this.sys_clearRunState();
        this.sys_resetGame(); 
        this.sys_initGameStart();
        // sys_initGameStart 内部已经调用了 ui_showRelicSelection
    },

/**
     * [META] 点击“继续上次游戏”按鈕
     */
    meta_continueRun() {
        const ok = this.sys_loadRunState();
        if (!ok) {
            showToast('⚠️ 存档读取失败，请开始新游戏');
        }
    },

/**
     * [META] 更新“继续游戏”按鈕的显隐状态
     */
    meta_updateContinueButton() {
        const btn = document.getElementById('meta-continue-btn');
        if (!btn) return;
        if (this.sys_hasRunState()) {
            btn.style.display = 'flex';
            // 读取存档中的回合数显示
            try {
                const raw = localStorage.getItem('echo_alchemist_run_state');
                if (raw) {
                    const s = JSON.parse(raw);
                    const roundEl = btn.querySelector('.continue-round');
                    if (roundEl) roundEl.textContent = `Round ${s.round || '?'}`;
                }
            } catch(e) { /* 忽略解析错误 */ }
        } else {
            btn.style.display = 'none';
        }
    },

/**
     * [META] 打开商店
     */
    meta_openShop() {
        this.phase_switchPhase('shop');  // [Mixin 正常用法：读取 Game 实例状态]
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
        const currentData = isTemporary ? this.saveData.temporaryUpgrades : this.saveData.upgrades;  // [Mixin 正常用法：读取 Game 实例状态]
        const level = currentData[upgradeId] || 0;
        
        if (level >= upgrade.maxLevel) return;
        
        const cost = this.meta_calculateUpgradeCost(upgrade, level);
        const resourceId = upgrade.cost.resourceId || 'rune_fragments';
        const resDef = META_SHOP_CONFIG.resources[resourceId] || META_SHOP_CONFIG.resources.rune_fragments;
        const playerHas = this.meta_getResourceCount(resourceId);

        if (playerHas >= cost) {
            // 消耗对应资源
            this.meta_spendResource(resourceId, cost);
            currentData[upgradeId] = level + 1;
            // 如果是符文库存货币，同步到saveData.runeInventory
            if (resourceId !== 'rune_fragments') {
                this.saveData.runeInventory = (this.runeInventory || []).slice();  // [Mixin 正常用法：读取 Game 实例状态]
            }
            this.sys_saveData();
            
            // [BUGFIX #2] 修复 setDeepValue 重复调用导致临时升级数値翻倍
            const effectValue = upgrade.effect.valuePerLevel * (level + 1);
            setDeepValue(CONFIG, upgrade.effect.path, effectValue, upgrade.effect.type);
            console.log(`[META] 立即应用升级: ${upgrade.id}, level: ${level + 1}, path: ${upgrade.effect.path}, value: ${effectValue}`);

            this.ui_updateMetaCurrency();
            this.ui_renderShop();
            audio.playTone(800, 'sine', 0.1, 0.3);
            const typeText = isTemporary ? '下一局生效' : `LV.${level + 1}`;
            if (window.showToast) showToast(`购买成功: ${upgrade.name} ${typeText}`);
        } else {
            const resName = resDef ? resDef.name : '资源';
            if (window.showToast) showToast(`${resName}不足 (${playerHas}/${cost})`);
            audio.playTone(200, 'sawtooth', 0.1, 0.2);
        }
    },

    /**
     * @method ui_onPhaseChange
     * @description [重构] 集中处理阶段切换时的所有 DOM 类名操作。
     * 由 phase_switchPhase 调用，负责阶段标题容器的显示/隐藏和文本更新。
     * 将原先分散在 game_phase.js 中的 DOM 操作集中到此处统一管理。
     * @param {string} newPhase - 新阶段名称
     */
    ui_onPhaseChange(newPhase) {
        // ===== A. 中央大标题：淡入后淡出（不再缩小到左上角） =====
        const titleContainer = document.getElementById('phase-title-container');
        const titleText = document.getElementById('phase-title');
        const subText = document.getElementById('phase-sub');

        const PHASE_TITLES = {
            'meta':       { text: '\u56de\u8072\u7149\u91d1\u5e2b', sub: 'Echo Alchemist' },
            'gathering':  { text: '\u7814\u78e8\u968e\u6bb5', sub: '\u6536\u96c6\u9b54\u529b' },
            'combat':     { text: '\u6230\u9b25\u968e\u6bb5', sub: '\u6297\u79a6\u9b54\u50cf' },
            'truth_book': { text: '\u771f\u7406\u4e4b\u66f8', sub: '\u6d1e\u6089\u842c\u7269\u4e4b\u7406' },
            'training':   { text: '\u8a66\u7149\u5834', sub: '\u6975\u9650\u6230\u9b25\u6e2c\u8a66' },
            'gameover':   { text: '\u9632\u7dda\u5931\u5b88', sub: 'Run Over' },
        };
        const fateMomentTitles = {
            'chaos_essence': { text: '\u547d\u904b\u6642\u523b', sub: '\u6df7\u6c8c\u7cbe\u83ef' },
            'pure_essence': { text: '\u547d\u904b\u6642\u523b', sub: '\u7d14\u6de8\u7cbe\u83ef' },
        };
        const titleData = (typeof this.ui_isFateMomentPhase === 'function' && this.ui_isFateMomentPhase())
            ? (fateMomentTitles[this.fateMomentContext.type] || { text: '\u547d\u904b\u6642\u523b', sub: '\u9078\u64c7\u4f60\u7684\u547d\u904b' })
            : (PHASE_TITLES[newPhase] || { text: '\u547d\u904b\u6289\u62e9', sub: '\u9078\u64c7\u4f60\u7684\u547d\u904b' });

        if (titleContainer && titleText && subText) {
            titleText.innerText = titleData.text;
            subText.innerText = titleData.sub;
            // 淡入
            titleContainer.style.opacity = '1';
            titleContainer.classList.remove('minimized');
            // 1.2秒后淡出（不再缩小）
            setTimeout(() => {
                titleContainer.style.opacity = '0';
            }, 1200);
        }

        // ===== B. 顶部栏左侧阶段标签同步更新 =====
        const topPhaseLabel = document.getElementById('top-phase-label');
        if (topPhaseLabel) {
            const SHORT_LABELS = {
                'meta':       '',
                'gathering':  '\u7814\u78e8',
                'combat':     '\u6230\u9b25',
                'truth_book': '\u5716\u9451',
                'training':   '\u8a66\u7149',
                'gameover':   '\u7ed3\u7b97',
            };
            if (typeof this.ui_isFateMomentPhase === 'function' && this.ui_isFateMomentPhase()) {
                topPhaseLabel.textContent = '\u547d\u904b\u6642\u523b';
            } else {
                topPhaseLabel.textContent = SHORT_LABELS[newPhase] || '';
            }
        }

        // ===== C. 战斗充能符文 UI 仅在战斗阶段显示 =====
        const runeChargeUi = document.getElementById('combat-rune-charge-ui');
        if (runeChargeUi) {
            runeChargeUi.style.display = (newPhase === 'combat') ? 'flex' : 'none';
        }

        // ===== D. PC 三栏布局同步：阶段切换时更新侧边栏内容和显隐 =====
        // 延迟一帧执行，确保 this.phase 已更新为 newPhase
        setTimeout(() => this.ui_updatePCLayout(), 0);
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

    /**
     * @method ui_initEventListeners
     * @description [Task 3.2] 注册 EventBus 监听器，响应业务层发出的全局 UI 事件。
     *   在游戏初始化时调用（sys_initGame 或 sys_resetGame 中）。
     */
    ui_initEventListeners() {
        // ── CRT 色差特效 ──────────────────────────────────────────────────
        // 监听来自 damage_calc.js 的色差事件，操作 CRT overlay DOM
        eventBus.on(EVENT_TYPES.UI_CHROMATIC_ABERRATION, ({ effectClass, duration }) => {
            const crtOverlay = document.getElementById('crt-overlay');
            if (!crtOverlay || !crtOverlay.classList.contains('active')) return;
            crtOverlay.classList.remove('chromatic-light', 'chromatic-medium', 'chromatic-heavy');
            crtOverlay.classList.add(effectClass);
            setTimeout(() => {
                crtOverlay.classList.remove(effectClass);
            }, duration || 500);
        });

         // ── 全屏闪光特效 ─────────────────────────────────────
        // 监听来自 combat_system.js 的闪光事件，操作 canvas 闪光层 DOM
        eventBus.on(EVENT_TYPES.UI_FLASH_EFFECT, ({ color, alpha, duration }) => {
            const flashEl = document.getElementById('canvas-flash-overlay');
            if (!flashEl) return;
            flashEl.style.backgroundColor = color || 'rgba(255,255,255,0.3)';
            flashEl.style.opacity = alpha || '0.3';
            flashEl.style.display = 'block';
            setTimeout(() => {
                flashEl.style.opacity = '0';
                setTimeout(() => { flashEl.style.display = 'none'; }, 200);
            }, duration || 100);
        });

        // ── Boss 入场全屏特效 ─────────────────────────────────
        // 监听 BOSS_SPAWNED 事件，触发：
        //   1. 全屏暗化遗罩（深红色闪烁）
        //   2. 屏幕震动
        //   3. Boss 入场音效（使用现有音效系统合成）
        eventBus.on(EVENT_TYPES.BOSS_SPAWNED, ({ bossName, isBigBoss }) => {
            const overlay = document.getElementById('boss-entrance-overlay');
            if (overlay) {
                // 深红色暗化遗罩：淡入 -> 保持 -> 淡出
                overlay.classList.remove('boss-entrance-active');
                // 强制重流
                void overlay.offsetWidth;
                overlay.classList.add('boss-entrance-active');
            }

            // 屏幕震动：大 Boss 更强烈
            if (typeof this.triggerScreenShake === 'function') {
                this.triggerScreenShake(isBigBoss ? 18 : 10);
            }

            // Boss 入场音效：利用现有音效工具合成威联感音效
            // 阶段 1：低频威联弦
            audio.playTone(60, 'sawtooth', 0.4, 0.8);
            // 阶段 2：延迟 0.3s 后叠加中频威联弦
            setTimeout(() => audio.playTone(90, 'sawtooth', 0.3, 0.6), 300);
            // 阶段 3：延迟 0.6s 后叠加高频威联弦
            setTimeout(() => audio.playTone(isBigBoss ? 150 : 120, 'square', 0.25, 0.5), 600);
        });

        // ── Boss 进场冲击波落地震动 ──────────────────────────────────────
        // 监听 Boss 落地冲击波事件，触发屏幕震动和属性色闪光
        eventBus.on(EVENT_TYPES.BOSS_ENTRANCE_SHOCKWAVE, ({ bossId, isBigBoss, bossColor, shakeDuration }) => {
            // 屏幕震动：落地冲击波比入场震动更强烈
            if (typeof this.ui_triggerScreenShake === 'function') {
                this.ui_triggerScreenShake(shakeDuration || 400);
            } else if (typeof this.triggerScreenShake === 'function') {
                this.triggerScreenShake(isBigBoss ? 22 : 15);
            }
            // 属性色全屏闪光：用 Boss 属性颜色闪烁屏幕
            const flashEl = document.getElementById('canvas-flash-overlay');
            if (flashEl && bossColor) {
                flashEl.style.backgroundColor = bossColor;
                flashEl.style.opacity = isBigBoss ? '0.35' : '0.25';
                flashEl.style.display = 'block';
                setTimeout(() => {
                    flashEl.style.opacity = '0';
                    setTimeout(() => { flashEl.style.display = 'none'; }, 300);
                }, isBigBoss ? 150 : 100);
            }
        });
    },

    /**
     * @method ui_openPause
     * @description 打开暂停页面。以 DOM-only overlay 方式叠加在当前阶段之上，
     *   不调用 phase_switchPhase，避免触发全局阶段切换副作用。
     *   同时设置 isPaused 标志位，让 sys_loop 跳过物理更新。
     */
    ui_openPause() {
        // 仅在游戏进行中的阶段允许暂停（不在 meta/shop/relic/selection 等全屏 UI 阶段）
        const pausablePhases = ['gathering', 'combat', 'training'];
        if (!pausablePhases.includes(this.phase)) return;

        // 记录暂停前的阶段，以便恢复
        this._pausedFromPhase = this.phase;
        this.isPaused = true;

        // 渲染遗物列表
        this.ui_renderPauseRelics();

        // 同步设置项状态
        this.ui_syncPauseSettings();

        // 显示暂停覆盖层
        const overlay = document.getElementById('phase-pause');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden-phase');
            overlay.classList.add('active-phase');
        }

        // 关闭底部信息抽屉（如果打开）
        if (this.ui && this.ui.isOpen) {
            this.ui.closeDrawer();
        }
    },

    /**
     * @method ui_closePause
     * @description 关闭暂停页面，恢复游戏运行。
     */
    ui_closePause() {
        this.isPaused = false;

        const overlay = document.getElementById('phase-pause');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active-phase');
            overlay.classList.add('hidden-phase');
        }
    },

    /**
     * @method ui_syncPauseSettings
     * @description 同步暂停页面中各设置项的视觉状态（开启/关闭徽章）。
     */
    ui_syncPauseSettings() {
        // 音效（audio.muted 属性直接读取）
        const muteRow = document.getElementById('pause-mute-row');
        const muteBadge = document.getElementById('pause-mute-badge');
        const isMuted = audio && audio.muted;
        if (muteRow) isMuted ? muteRow.classList.remove('active') : muteRow.classList.add('active');
        if (muteBadge) muteBadge.textContent = isMuted ? '关闭' : '开启';

        // 伤害数字
        const dmgRow = document.getElementById('pause-damage-numbers-row');
        const dmgBadge = document.getElementById('pause-damage-numbers-badge');
        const isDmgOn = this.showDamageNumbers;
        if (dmgRow) isDmgOn ? dmgRow.classList.add('active') : dmgRow.classList.remove('active');
        if (dmgBadge) dmgBadge.textContent = isDmgOn ? '开启' : '关闭';

        // CRT 特效（从 localStorage 读取）
        const crtRow = document.getElementById('pause-crt-row');
        const crtBadge = document.getElementById('pause-crt-badge');
        const isCrtOn = localStorage.getItem('ea_crt_enabled') !== 'false';
        if (crtRow) isCrtOn ? crtRow.classList.add('active') : crtRow.classList.remove('active');
        if (crtBadge) crtBadge.textContent = isCrtOn ? '开启' : '关闭';
    },

    /**
     * @method ui_renderPauseRelics
     * @description 渲染暂停页面中的遗物列表，展示玩家当前拥有的所有遗物及其效果。
     */
    ui_renderPauseRelics() {
        const container = document.getElementById('pause-relic-list');
        if (!container) return;

        const ownedRelics = this.ownedRelics || [];

        if (ownedRelics.length === 0) {
            container.innerHTML = '<div class="pause-empty-relics">尚未获得任何遗物</div>';
            return;
        }

        // 统计每种遗物的叠层数
        const stackCount = {};
        for (const id of ownedRelics) {
            stackCount[id] = (stackCount[id] || 0) + 1;
        }

        // 去重，保留唯一 ID
        const uniqueIds = [...new Set(ownedRelics)];

        const RARITY_LABELS = {
            common:    '普通',
            rare:      '稀有',
            legendary: '传说',
            cursed:    '诅咒',
        };

        const html = uniqueIds.map(id => {
            const def = RELIC_DB.find(r => r.id === id);
            if (!def) return '';

            const rarity = def.rarity || 'common';
            const stacks = stackCount[id];
            const maxStacks = def.maxStacks || 1;
            const rarityLabel = RARITY_LABELS[rarity] || rarity;
            const stackHtml = (maxStacks > 1)
                ? `<div class="pause-relic-stack">叠层：${stacks} / ${maxStacks}</div>`
                : '';

            return `
                <div class="pause-relic-card ${rarity}">
                    <div class="pause-relic-icon">${def.icon || '🔮'}</div>
                    <div class="pause-relic-info">
                        <div class="pause-relic-name">${def.name}</div>
                        <div class="pause-relic-desc">${def.desc || ''}</div>
                        ${stackHtml}
                    </div>
                    <div class="pause-relic-badge ${rarity}">${rarityLabel}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },
};
