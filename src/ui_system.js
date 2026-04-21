import { eventBus, EVENT_TYPES } from './event_bus.js';

export const ui_system = {
    // @section:ui_fly_effects - 飞行特效池管理
    _flyEffectPool: [],
    _getFlyEffectNode() {
        if (this._flyEffectPool.length > 0) return this._flyEffectPool.pop();
        const node = document.createElement('div');
        node.className = 'resource-fly-effect';
        node.style.cssText = `
            position: absolute;
            pointer-events: none;
            z-index: 1000;
            font-weight: bold;
            font-family: 'Cinzel', serif;
            text-shadow: 0 0 10px rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.8s cubic-bezier(0.19, 1, 0.22, 1);
        `;
        return node;
    },
    _releaseFlyEffectNode(node) {
        if (node.parentNode) node.parentNode.removeChild(node);
        this._flyEffectPool.push(node);
    },

    ui_playResourceFlyEffect(startX, startY, amount) {
        const container = document.getElementById('game-container');
        if (!container) return;
        const node = this._getFlyEffectNode();
        node.innerHTML = `<span>+${amount}</span><span style="color:#a855f7">🔮</span>`;
        node.style.left = startX + 'px';
        node.style.top = startY + 'px';
        node.style.opacity = '1';
        node.style.transform = 'translate(-50%, -50%) scale(0.5)';
        container.appendChild(node);

        requestAnimationFrame(() => {
            node.style.transform = 'translate(-50%, -150%) scale(1.2)';
            setTimeout(() => {
                node.style.opacity = '0';
                node.style.transform = 'translate(-50%, -250%) scale(0.8)';
                setTimeout(() => this._releaseFlyEffectNode(node), 800);
            }, 600);
        });
    },

    ui_updateSlowMotion() {
        const overlay = document.getElementById('slow-motion-overlay');
        if (!overlay) return;
        if (this.isSlowMotion) {
            overlay.classList.remove('hidden');
            overlay.style.opacity = '1';
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    },

    ui_updateMetaCurrency() {
        const el = document.getElementById('meta-currency-value');
        if (el) el.innerText = this.saveData.currency || 0;
    },

    ui_updateRuneCountDisplay() {
        const el = document.getElementById('rune-count-value');
        if (el) el.innerText = (this.runeInventory || []).length;
    },

    ui_getSelectionRequirement() {
        return this.selectionRequiredCount || 3;
    },

    ui_isSelectionConfirmReady() {
        if (this.selectionMode === 'pure_essence') {
            return this.selectionPreviewState && this.selectionPreviewState.length > 0;
        }
        return (this.selectionPreviewState || []).length >= this.ui_getSelectionRequirement();
    },

    ui_getPureEssenceLegalElements(marbleDef) {
        if (!marbleDef) return [];
        const elements = ['pyro', 'cryo', 'lightning', 'laser', 'bounce', 'pierce', 'scatter', 'wind', 'flying_sword'];
        return elements.filter(el => (marbleDef[el] || 0) > 0);
    },

    ui_getPureEssenceRuneOptions(marbleDef) {
        if (!marbleDef) return [];
        const legalElements = this.ui_getPureEssenceLegalElements(marbleDef);
        return (this.runeInventory || []).filter(rune => {
            const runeData = RUNE_DB[rune.id];
            return runeData && legalElements.includes(runeData.element);
        });
    },

    ui_selectPureEssenceRune(selectionIndex, inventoryIndex) {
        if (!this.selectionPreviewState) this.selectionPreviewState = [];
        const rune = this.runeInventory[inventoryIndex];
        this.selectionPreviewState[selectionIndex] = { inventoryIndex, rune };
        this.ui_refreshSelectionModeUI();
    },

    ui_renderPureEssencePanel(marbleDef, selectionIndex) {
        const panel = document.getElementById('pure-essence-panel');
        if (!panel) return;
        panel.innerHTML = '';
        const options = this.ui_getPureEssenceRuneOptions(marbleDef);
        if (options.length === 0) {
            panel.innerHTML = '<div class="text-slate-500 text-center py-8">无匹配属性的符文</div>';
            return;
        }
        options.forEach((rune, idx) => {
            const runeData = RUNE_DB[rune.id];
            const el = document.createElement('div');
            el.className = 'pure-essence-option';
            el.innerHTML = `<span>${runeData.icon}</span><span>Lv.${rune.level}</span>`;
            el.onclick = () => this.ui_selectPureEssenceRune(selectionIndex, idx);
            panel.appendChild(el);
        });
    },

    ui_isFateMomentPhase() {
        return this.phase === 'selection' && this.fateMomentContext && this.fateMomentContext.active;
    },

    ui_renderReplaceAmmoUI() {
        const ctx = this.replaceAmmoContext;
        if (!ctx || !ctx.active) return;

        const gridEl = document.getElementById('marble-selection-grid');
        const labelEl = document.getElementById('selection-mode-label');
        const subtitleEl = document.getElementById('selection-mode-subtitle');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const skipGrindBtn = document.getElementById('skip-grind-btn');
        const countEl = document.getElementById('selected-count');
        const requiredEl = document.getElementById('selected-required-count');
        const recipeHud = document.getElementById('recipe-hud-container');
        const previewPanel = document.getElementById('marble-preview-panel');

        if (recipeHud) recipeHud.classList.add('hidden');
        if (skipGrindBtn) skipGrindBtn.style.display = 'none';
        if (previewPanel) previewPanel.className = 'marble-preview-hidden';

        const newRecipes = ctx.newRecipes || [];
        const chargedRecipes = ctx.chargedRecipes || [];
        const maxSelect = Math.max(newRecipes.length, chargedRecipes.length, 3);
        const selectedIndices = ctx.selectedIndices || [];

        if (labelEl) labelEl.innerText = '子弹替换';
        if (subtitleEl) {
            subtitleEl.style.display = 'block';
            subtitleEl.innerText = '选择最终进入战斗的 ' + maxSelect + ' 枚子弹';
        }
        if (countEl) countEl.innerText = String(selectedIndices.length);
        if (requiredEl) requiredEl.innerText = String(maxSelect);

        const _calcTier = (recipe) => {
            const mc = recipe.multicast || 0;
            const mcTier = mc >= 12 ? 3 : mc >= 6 ? 2 : mc >= 3 ? 1 : 0;
            const statKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
            let statSum = 0;
            statKeys.forEach(k => { if (recipe[k] > 0) statSum += recipe[k]; });
            const statTier = statSum >= 35 ? 3 : statSum >= 20 ? 2 : statSum >= 8 ? 1 : 0;
            return Math.max(mcTier, statTier);
        };

        const _calcDominant = (recipe) => {
            const statKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
            let statSum = 0;
            let maxKey = null, maxVal = 0;
            statKeys.forEach(k => {
                const v = recipe[k] || 0;
                if (v > 0) { statSum += v; if (v > maxVal) { maxVal = v; maxKey = k; } }
            });
            if (!maxKey || maxVal <= 5 || statSum === 0 || maxVal / statSum < 0.5) return null;
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

        const TIER_STYLES = [
            { label: 'C', labelColor: '#94a3b8', borderIdle: '#475569', bgIdle: 'rgba(30,41,59,0.75)', bgSelected: 'rgba(245,158,11,0.12)', pulseClass: '' },
            { label: 'B', labelColor: '#34d399', borderIdle: '#34d399', bgIdle: 'rgba(6,78,59,0.35)', bgSelected: 'rgba(245,158,11,0.15)', pulseClass: 'pulse-b' },
            { label: 'A', labelColor: '#c084fc', borderIdle: '#c084fc', bgIdle: 'rgba(88,28,135,0.35)', bgSelected: 'rgba(245,158,11,0.15)', pulseClass: 'pulse-a' },
            { label: 'S', labelColor: '#facc15', borderIdle: '#facc15', bgIdle: 'rgba(120,53,15,0.40)', bgSelected: 'rgba(245,158,11,0.22)', pulseClass: 'pulse-s' },
        ];

        if (gridEl) {
            const bottomBarH = 160;
            const topBarH = 86;
            const gridH = 'calc(100dvh - ' + (bottomBarH + topBarH) + 'px)';
            gridEl.style.cssText = 'display:flex;flex-direction:column;width:100%;height:' + gridH + ';min-height:200px;padding:0;max-width:none;margin:0;gap:0;overflow:hidden;';
            gridEl.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:20px 12px 4px;';

            const renderCard = (recipe, globalIdx) => {
                const isSelected = selectedIndices.includes(globalIdx);
                const tier = _calcTier(recipe);
                const ts = TIER_STYLES[tier];
                const dominant = _calcDominant(recipe);

                const cardWrap = document.createElement('div');
                cardWrap.style.cssText = 'position:relative;border-radius:12px;overflow:visible;height:100%;display:flex;flex-direction:column;box-sizing:border-box;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);';
                if (isSelected) {
                    cardWrap.style.margin = '0 6px';
                    cardWrap.style.transform = 'translateY(-8px) scale(1.05)';
                    cardWrap.style.boxShadow = '0 12px 32px rgba(0,0,0,0.6), 0 0 20px ' + (dominant ? dominant.theme[1] : ts.borderIdle) + '44';
                }

                const card = document.createElement('div');
                card.className = isSelected ? ts.pulseClass : '';
                if (dominant) {
                    const [bgGrad, accent, embossL, embossD] = dominant.theme;
                    const embossOverlay = 'linear-gradient(135deg,' + embossL + '22 0%,transparent 40%,transparent 60%,' + embossD + '44 100%)';
                    card.style.background = bgGrad;
                    const embossLayer = document.createElement('div');
                    embossLayer.style.cssText = 'position:absolute;inset:0;border-radius:12px;pointer-events:none;background:' + embossOverlay + ';';
                    cardWrap.appendChild(embossLayer);
                } else {
                    card.style.background = isSelected ? ts.bgSelected : ts.bgIdle;
                }

                const qualityBorder = dominant ? dominant.theme[1] : ts.borderIdle;
                card.style.cssText += [
                    'position:relative',
                    'display:flex',
                    'flex-direction:column',
                    'align-items:stretch',
                    'padding:24px 6px 8px',
                    'border-radius:12px',
                    'cursor:pointer',
                    'user-select:none',
                    'flex:1',
                    'height:100%',
                    'border:2px solid ' + qualityBorder,
                    isSelected ? 'outline:2px solid #f59e0b;outline-offset:3px;' : 'outline:none;',
                ].join(';');
                cardWrap.appendChild(card);

                const iconArea = document.createElement('div');
                iconArea.style.cssText = 'position:absolute;top:-16px;left:50%;transform:translateX(-50%);z-index:20;pointer-events:none;';
                if (isSelected) iconArea.className = 'card-floating';
                
                const attrIcons = (CONFIG.ui && CONFIG.ui.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
                const mainAttrKey = dominant ? dominant.key : (recipe.pyro > 0 ? 'pyro' : recipe.cryo > 0 ? 'cryo' : recipe.lightning > 0 ? 'lightning' : 'damage');
                const mainAttrInfo = attrIcons[mainAttrKey] || { icon: '🔮', color: '#94a3b8' };
                
                iconArea.innerHTML = `
                    <div style="width:36px;height:36px;background:rgba(15,23,42,0.9);border:2px solid ${mainAttrInfo.color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.5), 0 0 10px ${mainAttrInfo.color}88;">
                        ${mainAttrInfo.icon}
                    </div>
                `;
                cardWrap.appendChild(iconArea);

                const tierBadge = document.createElement('div');
                tierBadge.style.cssText = 'position:absolute;top:4px;left:6px;font-size:10px;font-weight:900;padding:1px 4px;border-radius:4px;z-index:12;color:' + (dominant ? dominant.theme[1] : ts.labelColor) + ';background:rgba(15,23,42,0.8);border:1px solid ' + (dominant ? dominant.theme[1] : ts.labelColor) + ';';
                tierBadge.innerText = tier === 3 ? '✦ S' : tier === 2 ? 'A' : tier === 1 ? 'B' : 'C';
                card.appendChild(tierBadge);

                const attrKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
                const sortedAttrs = attrKeys
                    .map(k => ({ key: k, val: recipe[k] || 0 }))
                    .filter(a => a.val > 0)
                    .sort((a, b) => b.val - a.val)
                    .slice(0, 3);

                const attrsContainer = document.createElement('div');
                attrsContainer.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:auto;width:100%;';
                
                sortedAttrs.forEach(attr => {
                    const info = attrIcons[attr.key] || {};
                    const row = document.createElement('div');
                    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;width:100%;padding:2px 6px;background:rgba(0,0,0,0.3);border-radius:4px;border-left:2px solid ${info.color || '#475569'};`;
                    row.innerHTML = `
                        <span style="font-size:10px;color:${info.color || '#94a3b8'};display:flex;align-items:center;gap:2px;">
                            <span style="font-size:11px;">${info.icon || '◆'}</span>
                            <span>${info.name || attr.key}</span>
                        </span>
                        <span style="font-size:11px;font-weight:800;color:#fff;">${attr.val}</span>
                    `;
                    attrsContainer.appendChild(row);
                });
                card.appendChild(attrsContainer);

                cardWrap.onclick = () => this.ui_toggleReplaceAmmoCard(globalIdx);
                return cardWrap;
            };

            const makeRow = (recipes, startIdx, headerText, headerColor) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;overflow:hidden;';
                const header = document.createElement('div');
                header.style.cssText = 'font-size:11px;color:' + headerColor + ';font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;';
                header.innerText = headerText;
                row.appendChild(header);
                const cards = document.createElement('div');
                cards.style.cssText = 'display:grid;gap:8px;width:100%;flex:1;min-height:0;align-content:stretch;';
                cards.style.gridTemplateColumns = 'repeat(' + recipes.length + ', 1fr)';
                cards.style.gridTemplateRows = '1fr';
                recipes.forEach((recipe, i) => {
                    cards.appendChild(renderCard(recipe, startIdx + i));
                });
                row.appendChild(cards);
                return row;
            };

            if (newRecipes.length > 0) wrapper.appendChild(makeRow(newRecipes, 0, '✨ NEW GRIND', '#38bdf8'));
            if (chargedRecipes.length > 0) wrapper.appendChild(makeRow(chargedRecipes, newRecipes.length, '⚡ CHARGED', '#fbbf24'));
            gridEl.appendChild(wrapper);
        }

        if (confirmBtn) {
            confirmBtn.disabled = selectedIndices.length !== maxSelect;
            confirmBtn.innerText = '确认（已选 ' + selectedIndices.length + '/' + maxSelect + '）';
            confirmBtn.onclick = () => { if (typeof this.sys_confirmReplaceAmmo === 'function') this.sys_confirmReplaceAmmo(); };
        }

        let skipBtn = document.getElementById('replace-ammo-skip-btn');
        if (!skipBtn) {
            skipBtn = document.createElement('button');
            skipBtn.id = 'replace-ammo-skip-btn';
            skipBtn.className = 'mt-2 flex items-center gap-1.5 px-4 py-2 bg-slate-800/80 border border-slate-600/60 rounded-lg text-xs text-slate-300 hover:bg-slate-700/80 hover:border-slate-400/80 hover:text-white transition-all duration-200';
            skipBtn.innerHTML = '<span>⏩</span><span>跳过，使用新研磨子弹</span>';
            if (confirmBtn && confirmBtn.parentNode) confirmBtn.parentNode.insertBefore(skipBtn, confirmBtn.nextSibling);
        }
        skipBtn.style.display = 'flex';
        skipBtn.onclick = () => { if (typeof this.sys_skipReplaceAmmo === 'function') this.sys_skipReplaceAmmo(); };
    },

    ui_toggleReplaceAmmoCard(globalIdx) {
        const ctx = this.replaceAmmoContext;
        if (!ctx || !ctx.active) return;
        const selectedIndices = ctx.selectedIndices || [];
        const maxSelect = Math.max((ctx.newRecipes || []).length, (ctx.chargedRecipes || []).length, 3);
        const idx = selectedIndices.indexOf(globalIdx);
        if (idx > -1) {
            selectedIndices.splice(idx, 1);
        } else if (selectedIndices.length < maxSelect) {
            selectedIndices.push(globalIdx);
        }
        ctx.selectedIndices = selectedIndices;
        this.ui_renderReplaceAmmoUI();
    },

    ui_selectReplaceAmmoTarget(ammoIdx) {
        if (this.replaceAmmoContext) this.replaceAmmoContext.selectedIndex = ammoIdx;
    },

    ui_refreshSelectionModeUI() {
        const labelEl = document.getElementById('selection-mode-label');
        const subtitleEl = document.getElementById('selection-mode-subtitle');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const countEl = document.getElementById('selected-count');
        const requiredEl = document.getElementById('selected-required-count');

        if (this.selectionMode === 'chaos_essence') {
            if (labelEl) labelEl.innerText = '混沌精华';
            if (subtitleEl) subtitleEl.innerText = '选择 3 个混沌精华注入弹珠';
        } else if (this.selectionMode === 'pure_essence') {
            if (labelEl) labelEl.innerText = '纯净精华';
            if (subtitleEl) subtitleEl.innerText = '选择 1 个符文进行同化';
        } else {
            if (labelEl) labelEl.innerText = '命运抉择';
            if (subtitleEl) subtitleEl.innerText = '选择 3 个遗物或属性';
        }

        if (countEl) countEl.innerText = String((this.selectionPreviewState || []).length);
        if (requiredEl) requiredEl.innerText = String(this.ui_getSelectionRequirement());
        if (confirmBtn) confirmBtn.disabled = !this.ui_isSelectionConfirmReady();
    },

    meta_getResourceCount(resourceId) {
        return this.saveData.resources ? (this.saveData.resources[resourceId] || 0) : 0;
    },

    meta_spendResource(resourceId, amount) {
        if (!this.saveData.resources) this.saveData.resources = {};
        const current = this.saveData.resources[resourceId] || 0;
        if (current >= amount) {
            this.saveData.resources[resourceId] = current - amount;
            this.sys_saveData();
            this.ui_updateMetaCurrency();
            return true;
        }
        return false;
    },

    ui_updateUI() {
        this.ui_updateMetaCurrency();
        this.ui_updateRuneCountDisplay();
        if (this.phase === 'selection') {
            if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
                this.ui_renderReplaceAmmoUI();
            } else {
                this.ui_refreshSelectionModeUI();
            }
        }
    },

    ui_updatePCLayout() {
        const isPC = window.innerWidth > 1024;
        document.body.classList.toggle('pc-mode', isPC);
        const leftSidebar = document.getElementById('pc-left-sidebar');
        const rightSidebar = document.getElementById('pc-right-sidebar');
        if (leftSidebar) leftSidebar.style.display = isPC ? 'flex' : 'none';
        if (rightSidebar) rightSidebar.style.display = isPC ? 'flex' : 'none';
    },

    _ui_updateLeftSidebarContent(phase, wasPC) {},
    _ui_migrateDrawerToLeftSidebar(toSidebar) {},
    _ui_migrateHUDToLeftSidebar(toSidebar) {},
    _ui_migrateRuneLauncherToSidebar(toSidebar) {},

    ui_confirmSelection() {
        if (!this.ui_isSelectionConfirmReady()) return;
        if (typeof this.sys_confirmSelection === 'function') this.sys_confirmSelection();
    },

    meta_applyUpgrades() {
        if (typeof this.sys_applyUpgrades === 'function') this.sys_applyUpgrades();
    },

    meta_addCurrency(amount) {
        this.saveData.currency = (this.saveData.currency || 0) + amount;
        this.sys_saveData();
        this.ui_updateMetaCurrency();
    },

    meta_startRun() {
        if (typeof this.sys_startRun === 'function') this.sys_startRun();
    },

    meta_continueRun() {
        if (typeof this.sys_continueRun === 'function') this.sys_continueRun();
    },

    meta_updateContinueButton() {
        const btn = document.getElementById('meta-continue-btn');
        if (btn) btn.style.display = this.sys_hasRunState() ? 'block' : 'none';
    },

    meta_openShop() {
        const shop = document.getElementById('meta-shop-overlay');
        if (shop) shop.classList.remove('hidden');
    },

    meta_calculateUpgradeCost(upgrade, level) {
        if (upgrade.cost.type === 'fixed') return upgrade.cost.values[level] || 0;
        return Math.floor(upgrade.cost.base * Math.pow(upgrade.cost.growth, level));
    },

    meta_buyUpgrade(upgradeId) {
        if (typeof this.sys_buyUpgrade === 'function') return this.sys_buyUpgrade(upgradeId);
        return false;
    },

    ui_onPhaseChange(newPhase) {
        this.ui_updateUI();
        if (newPhase === 'selection' && this.replaceAmmoContext && this.replaceAmmoContext.active) {
            this.ui_renderReplaceAmmoUI();
        }
    },

    ui_triggerScreenShake(duration = 200) {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.classList.add('shake-hard');
        setTimeout(() => container.classList.remove('shake-hard'), duration);
    },

    ui_initEventListeners() {
        const confirmBtn = document.getElementById('confirm-selection-btn');
        if (confirmBtn) confirmBtn.onclick = () => this.ui_confirmSelection();
        window.addEventListener('resize', () => this.ui_updatePCLayout());
    },

    ui_openPause() {
        const pause = document.getElementById('pause-overlay');
        if (pause) pause.classList.remove('hidden');
    },

    ui_closePause() {
        const pause = document.getElementById('pause-overlay');
        if (pause) pause.classList.add('hidden');
    },

    ui_syncPauseSettings() {},
    ui_renderPauseRelics() {}
};
