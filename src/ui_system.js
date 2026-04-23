import { eventBus, EVENT_TYPES } from './event_bus.js';
import { RUNE_DB } from './rune_config.js';
import { CONFIG } from './config.js';

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

    /**
     * @method ui_playLootToCardAnimation
     * @description 播放掉落物飞向 UI 卡片的 3D 动画
     */
    ui_playLootToCardAnimation(startX, startY, type, callback) {
        const container = document.getElementById('game-container');
        if (!container) return callback && callback();

        const node = document.createElement('div');
        node.className = 'loot-fly-proxy';
        
        let icon = '🏆';
        let glow = 'rgba(250, 204, 21, 0.8)';
        if (type === 'chaos_essence') { icon = '🔮'; glow = 'rgba(168, 85, 247, 0.8)'; }
        else if (type === 'pure_essence') { icon = '💎'; glow = 'rgba(56, 189, 248, 0.8)'; }

        node.innerHTML = icon;
        node.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            font-size: 32px;
            z-index: 2000;
            pointer-events: none;
            text-shadow: 0 0 20px ${glow};
            transform: translate(-50%, -50%) scale(0.5) rotateX(0deg) rotateY(0deg);
            transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;
        container.appendChild(node);

        // 终点位置：屏幕中心偏上（卡片生成位置）
        const targetX = this.width / 2;
        const targetY = this.height * 0.4;

        requestAnimationFrame(() => {
            node.style.left = targetX + 'px';
            node.style.top = targetY + 'px';
            node.style.transform = 'translate(-50%, -50%) scale(2.5) rotateX(360deg) rotateY(720deg)';
            
            setTimeout(() => {
                node.style.opacity = '0';
                node.style.transform = 'translate(-50%, -50%) scale(4) rotateX(450deg) rotateY(900deg)';
                setTimeout(() => {
                    if (node.parentNode) node.parentNode.removeChild(node);
                    if (callback) callback();
                }, 200);
            }, 650);
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
        const required = this.ui_getSelectionRequirement();
        if ((this.selectedMarbles || []).length !== required) return false;
        if (this.selectionMode === 'pure_essence') {
            // [feat] 纯净精华允许不注入符文直接进入研磨（只有一个弹珠）
            // 有符文注入时仍需校验 marbleIndex 匹配；无符文时直接放行
            if (!this.selectionInjectedRune) return true;
            return !!(this.selectionInjectedRune.marbleIndex === this.selectedMarbles[0]);
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
            if (typeof showToast === 'function') showToast('請先選中這枚彈珠，再注入符文。');
            return;
        }
        const marbleDef = this.marblesPool?.[selectionIndex];
        const option = this.ui_getPureEssenceRuneOptions(marbleDef).find(item => item.inventoryIndex === inventoryIndex);
        if (!option) {
            if (typeof showToast === 'function') showToast('符文屬性不合法，無法注入。');
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
        const attrDisplay = (typeof CONFIG !== 'undefined' && CONFIG.ui?.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
        const legalHtml = legalElements.length > 0
            ? legalElements.map(element => {
                const display = attrDisplay[element] || {};
                return `<span class="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">${display.icon || '\u2726'} ${display.name || element}</span>`;
            }).join('')
            : '<span class="inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200">\u7121\u5408\u6cd5\u5c6c\u6027</span>';
        let optionsHtml = '';
        if (!isSelected) {
            optionsHtml = '<div class="text-xs text-slate-400">\u5148\u9078\u4e2d\u9019\u679a\u5f48\u73e0\uff0c\u518d\u5f9e\u4e0b\u65b9\u5408\u6cd5\u7b26\u6587\u4e2d\u6ce8\u5165\u3002</div>';
        } else if (options.length === 0) {
            optionsHtml = '<div class="text-xs text-rose-300">\u7576\u524d\u7b26\u6587\u5eab\u4e2d\u6c92\u6709\u8207\u6b64\u5f48\u73e0\u5c6c\u6027\u5339\u914d\u7684\u5408\u6cd5\u7b26\u6587\u3002</div>';
        } else {
            optionsHtml = options.map(item => {
                const active = selectedRune && selectedRune.inventoryIndex === item.inventoryIndex;
                return `<button type="button" data-inventory-index="${item.inventoryIndex}" class="pure-essence-rune-btn px-2 py-1 rounded-lg border text-xs transition-all ${active ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:border-emerald-300 hover:text-white'}">${item.runeDef.icon || '\u2726'} ${item.runeDef.name} Lv.${item.rune.level || 1}</button>`;
            }).join('');
        }
        const selectedRuneText = selectedRune
            ? `\u5df2\u9078\u4e2d\u6ce8\u5165\u7b26\u6587\uff1a${selectedRune.icon || '\u2726'} ${selectedRune.name} \u2192 ${attrDisplay[selectedRune.element]?.name || selectedRune.element}`
            : '\u5c1a\u672a\u9078\u4e2d\u6ce8\u5165\u7b26\u6587\u3002';
        host.innerHTML = `
            <div class="preview-divider"></div>
            <div class="preview-peg-label">\u7d14\u6de8\u7cbe\u83ef / \u7b26\u6587\u6ce8\u5165</div>
            <div class="text-xs text-slate-300 mb-2">\u53ea\u5141\u8a31\u6ce8\u5165\u5f48\u73e0\u539f\u672c\u5df2\u5177\u5099\u7684\u5c6c\u6027\uff1b\u4e0d\u5408\u6cd5\u5c6c\u6027\u6703\u88ab\u6514\u622a\u3002</div>
            <div class="flex flex-wrap gap-2 mb-2">${legalHtml}</div>
            <div class="flex flex-wrap gap-2">${optionsHtml}</div>
            <div class="text-xs ${selectedRune ? 'text-amber-200' : 'text-slate-500'} mt-2">${selectedRuneText}</div>
        `;
        host.querySelectorAll('.pure-essence-rune-btn').forEach(btn => {
            btn.onclick = () => this.ui_selectPureEssenceRune(selectionIndex, Number(btn.dataset.inventoryIndex));
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
            // [BUGFIX v2] 改用绝对定位方案，彻底绕开多层 flex 高度链传递问题。
            // 原方案依赖 flex:1 逐层传递高度（phase-selection→parentEl→gridEl→wrapper→row→cards），
            // 任何一层的 padding/items-center/justify-content:space-between 都可能导致高度塌陷。
            // 新方案：parentEl 设为 position:relative，gridEl 绝对定位充满 parentEl，
            // 完全绕开 flex 高度传递，gridEl 的高度 = parentEl 的实际高度（由 flex:1 正确分配）。
            const parentEl = gridEl.parentElement;
            if (parentEl) {
                parentEl.style.position = 'relative';
                parentEl.style.overflow = 'hidden';
            }
            gridEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:0;max-width:none;margin:0;gap:0;overflow:hidden;';
            gridEl.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'width:100%;flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:20px 12px 4px;';

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
                
                const attrIcons = (typeof CONFIG !== 'undefined' && CONFIG.ui && CONFIG.ui.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
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
        // [ammo-replace] \u5982\u679c\u5f53\u524d\u5904\u4e8e\u66ff\u6362\u9636\u6bb5\uff0c\u8df3\u8fc7\u666e\u901a\u9009\u62e9 UI \u5237\u65b0\uff0c\u6539\u7531 ui_renderReplaceAmmoUI \u63a7\u5236
        if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
            this.ui_renderReplaceAmmoUI();
            return;
        }
        const countEl = document.getElementById('selected-count');
        const requiredEl = document.getElementById('selected-required-count');
        const labelEl = document.getElementById('selection-mode-label');
        const subtitleEl = document.getElementById('selection-mode-subtitle');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const selectedCount = (this.selectedMarbles || []).length;
        const required = this.ui_getSelectionRequirement();
        // [pure_essence \u4fee\u590d] \u7eaf\u51c0\u7cbe\u534e\u6a21\u5f0f\u4e0b\u5c55\u793a\u5355\u5361\u5c45\u4e2d\u5e03\u5c40
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
        // [pure_essence] \u63a7\u5236\u300c\u8df3\u8fc7\u7814\u78e8\u300d\u6309\u9215\u7684\u663e\u793a/\u9690\u85cf
        const skipGrindBtn = document.getElementById('skip-grind-btn');
        if (skipGrindBtn) {
            skipGrindBtn.style.display = (this.selectionMode === 'pure_essence') ? 'flex' : 'none';
        }
        // [tsk-668f3dba] \u8fdb\u5165\u6b63\u5e38\u9009\u62e9\u9636\u6bb5\u65f6\u9690\u85cf\u66ff\u6362\u8df3\u8fc7\u6309\u9215
        const replaceSkipBtn = document.getElementById('replace-ammo-skip-btn');
        if (replaceSkipBtn) replaceSkipBtn.style.display = 'none';
        if (countEl) countEl.innerText = String(selectedCount);
        if (requiredEl) requiredEl.innerText = String(required);
        if (labelEl) {
            labelEl.innerText = this.selectionMode === 'pure_essence'
                ? '\u7d14\u6de8\u7cbe\u83ef'
                : this.selectionMode === 'chaos_essence'
                    ? '\u6df7\u6c8c\u7cbe\u83ef'
                    : '\u547d\u904b\u6289\u64c7';
        }
        if (subtitleEl) {
            if (this.selectionMode === 'pure_essence') {
                const injected = this.selectionInjectedRune
                    ? `\u5df2\u9078\uff1a${this.selectionInjectedRune.icon || '\u2726'} ${this.selectionInjectedRune.name}`
                    : '\u5c1a\u672a\u6ce8\u5165\u7b26\u6587';
                subtitleEl.style.display = 'block';
                subtitleEl.classList.remove('hidden');
                subtitleEl.innerText = `\u9078\u64c7 1 \u679a\u5f48\u73e0\u4e26\u6ce8\u5165 1 \u500b\u5408\u6cd5\u7b26\u6587\u3002${injected}`;
            } else if (this.selectionMode === 'chaos_essence') {
                subtitleEl.style.display = 'block';
                subtitleEl.classList.remove('hidden');
                subtitleEl.innerText = `\u547d\u904b\u6642\u523b\u5df2\u958b\u555f\uff0c\u8acb\u9078\u64c7 ${required} \u679a\u5f48\u73e0\u5f8c\u9032\u5165\u7df4\u91d1\u3002`;
            } else {
                subtitleEl.style.display = 'none';
                subtitleEl.classList.add('hidden');
                subtitleEl.innerText = '';
            }
        }
        if (confirmBtn) {
            confirmBtn.disabled = !this.ui_isSelectionConfirmReady();
            confirmBtn.innerText = this.selectionMode === 'pure_essence'
                ? '\u6ce8\u5165\u5f8c\u958b\u59cb\u7df4\u91d1'
                : this.selectionMode === 'chaos_essence'
                    ? '\u63a5\u53d7\u547d\u904b\u5f8c\u958b\u59cb\u7df4\u91d1'
                    : '\u958b\u59cb\u7df4\u91d1';
        }
        if (this.selectionPreviewState) {
            this.ui_renderPureEssencePanel(this.selectionPreviewState.marble, this.selectionPreviewState.selectionIndex);
        } else {
            this.ui_renderPureEssencePanel(null, -1);
        }
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
        // [BUGFIX] 使用 _isRuneLauncherOpen() 兼容 PC 模式和移动端模式
        const runeLauncherEl = document.getElementById('phase-rune-launcher');
        const launcherVisible = this._isRuneLauncherOpen ? this._isRuneLauncherOpen()
            : (runeLauncherEl && runeLauncherEl.style.display !== 'none');

        // 1. 隐藏所有阶段的主容器 (.ui-overlay)
        // [BUGFIX] 符文发射器打开时跳过隐藏，防止每次调用将其强制关闭
        document.querySelectorAll('.ui-overlay').forEach(el => {
            if (el === runeLauncherEl && launcherVisible) return;
            el.style.display = 'none';
            el.classList.add('hidden-phase');
            el.classList.remove('active-phase');
            el.style.pointerEvents = 'none';
        });

        // 2. 显示当前阶段的主容器
        // [BUGFIX] 符文发射器打开期间，跳过底层阶段面板的重新激活，
        // 防止 #marble-selection-grid 等子元素（pointer-events: auto）遮挡发射器 Tab 按钮
        if (!launcherVisible) {
            const activeEl = document.getElementById(`phase-${this.phase}`);
            if (activeEl) {
                activeEl.style.display = (this.phase === 'gameover') ? 'block' : 'flex';
                // [BUGFIX] 将 'selection' 加入 needsAuto 列表：
                // phase-selection 的父容器 pointer-events 必须为 auto，
                // 否则底部「開始煉金」按钮无法响应点击（父容器 none 会阻断事件传递）。
                const needsAuto = ['meta', 'shop', 'truth_book', 'gameover', 'relic', 'pause', 'selection'].includes(this.phase);
                activeEl.style.pointerEvents = needsAuto ? 'auto' : 'none';
                setTimeout(() => {
                    activeEl.classList.remove('hidden-phase');
                    activeEl.classList.add('active-phase');
                }, 10);
            }
        }

        // 3. 各阶段专属 UI 更新
        this.ui_updateMetaCurrency();
        this.ui_updateRuneCountDisplay();
        if (this.phase === 'meta') {
            this.meta_updateContinueButton();
        }
        if (this.phase === 'selection') {
            if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
                this.ui_renderReplaceAmmoUI();
            } else {
                this.ui_refreshSelectionModeUI();
            }
        }

        // 4. 底部面板：仅在收集阶段且非 PC 模式下显示
        const bottomPanel = document.querySelector('.bottom-panel');
        if (bottomPanel) {
            const isPCMode = document.body.classList.contains('pc-mode');
            bottomPanel.style.display = (this.phase === 'gathering' && !isPCMode) ? 'flex' : 'none';
        }

        // 5. 技能栏：仅在战斗阶段且有已解锁技能时显示
        const skillBar = document.getElementById('skill-bar');
        if (skillBar) {
            const hasSkills = this.activeSkills && this.activeSkills.length > 0;
            skillBar.style.display = (this.phase === 'combat' && hasSkills) ? 'flex' : 'none';
        }

        // 6. 连击倍率显示
        const multiplierEl = document.getElementById('multiplier-display');
        if (multiplierEl) {
            multiplierEl.style.opacity = (this.phase === 'combat') ? '1' : '0';
        }

        // 7. 统一顶部栏：在全屏阶段隐藏
        const unifiedTopBar = document.getElementById('unified-top-bar');
        if (unifiedTopBar) {
            const hideInPhases = ['meta', 'shop', 'truth_book', 'training', 'relic', 'selection', 'gameover'];
            const shouldHideTopBar = hideInPhases.includes(this.phase) && !(typeof this.ui_isFateMomentPhase === 'function' && this.ui_isFateMomentPhase());
            unifiedTopBar.style.display = shouldHideTopBar ? 'none' : 'flex';
        }

        // 8. 战斗充能符文 UI
        const runeChargeUi = document.getElementById('combat-rune-charge-ui');
        if (runeChargeUi) {
            runeChargeUi.style.display = (this.phase === 'combat') ? 'flex' : 'none';
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

    /**
     * @method ui_confirmSelection
     * @description 确认玩家选择的弹珠，将 selectedMarbles 映射为 marbleQueue，
     * 处理 pure_essence 注入逻辑，清理选择状态，并进入收集（研磨）阶段。
     * [BUGFIX] 原实现调用不存在的 sys_confirmSelection，导致点击"开始炼金"无响应。
     */
    ui_confirmSelection() {
        // [BUGFIX] 如果当前处于子弹替换阶段，应由 sys_confirmReplaceAmmo 处理，
        // 防止 ui_initEventListeners 绑定的 onclick 在替换阶段被误触发导致进入研磨阶段。
        if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
            console.warn('[ui_confirmSelection] 检测到 replaceAmmoContext 激活，转发到 sys_confirmReplaceAmmo');
            if (typeof this.sys_confirmReplaceAmmo === 'function') this.sys_confirmReplaceAmmo();
            return;
        }
        const required = this.ui_getSelectionRequirement();
        if ((this.selectedMarbles || []).length !== required) {
            console.warn('[DEBUG] ui_confirmSelection: 选中的弹珠数量不符合要求，当前为:', (this.selectedMarbles || []).length, '要求为:', required);
            return;
        }
        this.marbleQueue = this.selectedMarbles.map(i => this.marblesPool[i]);

        if (this.selectionMode === 'pure_essence') {
            const injected = this.selectionInjectedRune;
            const selectedIndex = this.selectedMarbles[0];
            const marble = this.marbleQueue[0];
            if (injected) {
                // [feat] 有符文注入时走原有注入流程
                if (injected.marbleIndex !== selectedIndex) {
                    if (typeof showToast === 'function') showToast('純淨精華尚未完成符文注入。');
                    return;
                }
                const legalElements = new Set(this.ui_getPureEssenceLegalElements(marble));
                if (!legalElements.has(injected.element)) {
                    if (typeof showToast === 'function') showToast('注入失敗：符文屬性與彈珠原有屬性不匹配。');
                    return;
                }
                marble.collected = Array.isArray(marble.collected) ? marble.collected : [];
                const injectCount = Math.max(1, injected.level || 1) * Math.max(1, injected.baseStatPerLevel || 1);
                for (let i = 0; i < injectCount; i++) marble.collected.push(injected.element);
                marble.source = 'pure_essence';
                marble.infusedRuneId = injected.runeId;
                marble.infusedAttribute = injected.element;
                marble.assimilationMultiplier = Math.max(1, (typeof CONFIG !== 'undefined' && CONFIG.gameplay.assimilationDoubleMultiplier) || 2);
                if (!this.doubleAssimilationBoostRounds) this.doubleAssimilationBoostRounds = {};
                this.doubleAssimilationBoostRounds[marble.type] = Math.max(this.doubleAssimilationBoostRounds[marble.type] || 0, 1);
                if (Array.isArray(this.runeInventory) && injected.inventoryIndex >= 0) {
                    this.runeInventory.splice(injected.inventoryIndex, 1);
                    if (this.saveData) this.saveData.runeInventory = (this.runeInventory || []).slice();
                }
                this.ui_updateRuneCountDisplay();
                const multiplier = (typeof CONFIG !== 'undefined' && CONFIG.gameplay.assimilationDoubleMultiplier) || 2;
                if (typeof showToast === 'function') showToast(`已為 ${marble.getName()} 注入 ${injected.icon || '✦'} ${injected.name}，本輪同化率 x${multiplier}。`);
            } else {
                // [feat] 无符文注入时直接进入研磨（纯净精华单弹珠，无同化加成）
                marble.source = 'pure_essence';
                if (typeof showToast === 'function') showToast(`純淨精華：未注入符文，直接進入研磨。`);
            }
        }

        // 清理替换上下文（如果存在）
        this.replaceAmmoContext = null;

        this.selectionMode = 'standard';
        this.selectionRequiredCount = (typeof CONFIG !== 'undefined' && CONFIG.gameplay.selectionReq) || 3;
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        this.fateMomentContext = null;
        this.phase_startGatheringPhase();
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
        // [局内存档] 新开一局时清除旧存档
        this.sys_clearRunState();
        this.sys_resetGame();
        this.sys_initGameStart();
        // sys_initGameStart 内部已经调用了 ui_showRelicSelection
    },

    meta_continueRun() {
        const ok = this.sys_loadRunState();
        if (!ok) {
            if (typeof showToast === 'function') showToast('⚠️ 存档读取失败，请开始新游戏');
        }
    },

    meta_updateContinueButton() {
        const btn = document.getElementById('meta-continue-btn');
        if (btn) btn.style.display = this.sys_hasRunState() ? 'block' : 'none';
    },

    meta_openShop() {
        this.phase_switchPhase('shop');
        // meta_currentShopCategory 初始化由 ui_renderShop 内部处理（META_SHOP_CONFIG 在 shop_system 中导入）
        if (!this.meta_currentShopCategory) {
            this.meta_currentShopCategory = 'attribute';
        }
        this.ui_renderShop();
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
