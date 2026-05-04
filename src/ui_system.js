import { eventBus, EVENT_TYPES } from './event_bus.js';
import { RUNE_DB } from './rune_config.js';
import { CONFIG, RELIC_DB } from './config.js';
import { getAmmoIconSrcByKey } from './bitmap_icons.js';

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
     * @description 播放掉落物开启 → 飞出「卡片」的 3D 动画。
     * [BUGFIX #8] 旧版本只是把图标整体放大并翻转，没有「卡片从掉落物中飞出」的实感。
     * 新版本分两段：
     *   1) 掉落物原地脉冲一下并迸发出 8 道光束（开启感）
     *   2) 一张带边框/标题/图标的「卡片」从掉落物位置弹出，缩小 → 沿弧线飞向屏幕中央
     *      并放大成最终展示卡片，再淡出移交给后续选择 UI。
     */
    ui_playLootToCardAnimation(startX, startY, type, callback) {
        const container = document.getElementById('game-container');
        if (!container) return callback && callback();

        let icon = '🏆';
        let glow = 'rgba(250, 204, 21, 0.85)';
        let cardBg = 'linear-gradient(160deg,#78350f 0%,#3b1f05 60%,#150b01 100%)';
        let cardBorder = '#fbbf24';
        let title = '遺物';
        if (type === 'chaos_essence') {
            icon = '🔮'; glow = 'rgba(168, 85, 247, 0.85)';
            cardBg = 'linear-gradient(160deg,#4a1d96 0%,#2e1065 60%,#0f0528 100%)';
            cardBorder = '#c084fc';
            title = '混沌精華';
        } else if (type === 'pure_essence') {
            icon = '💎'; glow = 'rgba(56, 189, 248, 0.85)';
            cardBg = 'linear-gradient(160deg,#0c4a6e 0%,#082f49 60%,#020f1a 100%)';
            cardBorder = '#38bdf8';
            title = '純淨精華';
        }

        // ---- A. 掉落物开启脉冲 + 光束迸发（保留原图标位置感） ----
        const burst = document.createElement('div');
        burst.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: 8px; height: 8px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            box-shadow: 0 0 0 0 ${glow};
            z-index: 1990;
            pointer-events: none;
            transition: box-shadow 0.35s ease-out, opacity 0.35s ease-out;
            opacity: 1;
        `;
        container.appendChild(burst);

        const ray = document.createElement('div');
        ray.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: 4px; height: 4px;
            transform: translate(-50%, -50%);
            z-index: 1991;
            pointer-events: none;
        `;
        for (let i = 0; i < 8; i++) {
            const beam = document.createElement('div');
            const angle = (i / 8) * 360;
            beam.style.cssText = `
                position: absolute;
                left: 0; top: 0;
                width: 2px; height: 60px;
                background: linear-gradient(to top, transparent, ${glow});
                transform-origin: 1px 0;
                transform: rotate(${angle}deg) translateY(0);
                opacity: 0;
                transition: transform 0.45s ease-out, opacity 0.45s ease-out;
            `;
            ray.appendChild(beam);
        }
        container.appendChild(ray);

        // ---- B. 创建「飞出的卡片」节点 ----
        const card = document.createElement('div');
        card.className = 'loot-fly-card';
        card.innerHTML = `
            <div class="loot-fly-card-icon">${icon}</div>
            <div class="loot-fly-card-title">${title}</div>
        `;
        card.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: 84px;
            height: 116px;
            transform: translate(-50%, -50%) scale(0.05) rotate(-12deg);
            opacity: 0;
            background: ${cardBg};
            border: 2px solid ${cardBorder};
            border-radius: 10px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.6), 0 0 18px ${glow};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #f8fafc;
            font-family: 'Cinzel', serif;
            z-index: 2000;
            pointer-events: none;
            transition: transform 0.7s cubic-bezier(0.22, 1.2, 0.36, 1), opacity 0.5s ease-out, left 0.7s cubic-bezier(0.22, 1.2, 0.36, 1), top 0.7s cubic-bezier(0.22, 1.2, 0.36, 1);
        `;
        const iconEl = card.querySelector('.loot-fly-card-icon');
        if (iconEl) iconEl.style.cssText = `font-size: 38px; text-shadow: 0 0 14px ${glow};`;
        const titleEl = card.querySelector('.loot-fly-card-title');
        if (titleEl) titleEl.style.cssText = `font-size: 12px; letter-spacing: 2px; color: ${cardBorder}; text-shadow: 0 0 6px ${glow};`;
        container.appendChild(card);

        const targetX = this.width / 2;
        const targetY = this.height * 0.4;

        // 触发开启脉冲
        requestAnimationFrame(() => {
            burst.style.boxShadow = `0 0 0 80px rgba(255,255,255,0)`;
            burst.style.opacity = '0';
            ray.querySelectorAll('div').forEach((beam) => {
                const angle = beam.style.transform.match(/rotate\(([-\d.]+)deg\)/);
                const a = angle ? parseFloat(angle[1]) : 0;
                beam.style.opacity = '0.9';
                beam.style.transform = `rotate(${a}deg) translateY(-40px)`;
            });

            // 卡片从掉落物中蹦出（先稍微停留一帧再起飞，强化「打开掉落物」的感觉）
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translate(-50%, -50%) scale(0.6) rotate(-6deg)';
            }, 80);

            // 沿弧线飞向中心，并放大
            setTimeout(() => {
                card.style.left = targetX + 'px';
                card.style.top = targetY + 'px';
                card.style.transform = 'translate(-50%, -50%) scale(1.4) rotate(0deg)';
            }, 220);

            // 抵达后短暂停留 → 淡出，触发后续 UI
            setTimeout(() => {
                card.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
                card.style.opacity = '0';
                card.style.transform = 'translate(-50%, -50%) scale(1.7) rotate(0deg)';
                setTimeout(() => {
                    if (card.parentNode) card.parentNode.removeChild(card);
                    if (burst.parentNode) burst.parentNode.removeChild(burst);
                    if (ray.parentNode) ray.parentNode.removeChild(ray);
                    if (callback) callback();
                }, 260);
            }, 920);
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

    ui_getPureEssenceRuneOptions(marbleDef) {
        // [feat] 纯净精华允许注入任意自己拥有的符文（不限定与弹珠属性一致），
        // 注入后将覆盖弹珠的元素属性。
        return (this.runeInventory || []).map((rune, inventoryIndex) => {
            const runeDef = (RUNE_DB || []).find(item => item.id === rune.id);
            if (!runeDef) return null;
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
            if (typeof showToast === 'function') showToast('找不到该符文。');
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
        const options = this.ui_getPureEssenceRuneOptions(marbleDef);
        const selectedIndex = (this.selectedMarbles || [])[0];
        const isSelected = selectedIndex === selectionIndex;
        const selectedRune = (isSelected && this.selectionInjectedRune && this.selectionInjectedRune.marbleIndex === selectionIndex)
            ? this.selectionInjectedRune
            : null;
        const attrDisplay = (typeof CONFIG !== 'undefined' && CONFIG.ui?.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
        const currentDisplay = attrDisplay[marbleDef.type] || {};
        const currentAttrHtml = `<span class="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">${currentDisplay.icon || '\u2726'} ${currentDisplay.name || marbleDef.type}</span>`;
        let optionsHtml = '';
        if (!isSelected) {
            optionsHtml = '<div class="text-xs text-slate-400">\u5148\u9078\u4e2d\u9019\u679a\u5f48\u73e0\uff0c\u518d\u5f9e\u4e0b\u65b9\u7b26\u6587\u4e2d\u6ce8\u5165\u3002</div>';
        } else if (options.length === 0) {
            optionsHtml = '<div class="text-xs text-rose-300">\u7576\u524d\u7b26\u6587\u5eab\u70ba\u7a7a\u3002\u53ef\u76f4\u63a5\u4ee5\u539f\u5c6c\u6027\u9032\u5165\u7814\u78e8\uff0c\u6216\u9ede\u300c\u8df3\u904e\u7814\u78e8\u300d\u7372\u5f97\u96a8\u6a5f\u7b26\u6587\u3002</div>';
        } else {
            optionsHtml = options.map(item => {
                const active = selectedRune && selectedRune.inventoryIndex === item.inventoryIndex;
                return `<button type="button" data-inventory-index="${item.inventoryIndex}" class="pure-essence-rune-btn px-2 py-1 rounded-lg border text-xs transition-all ${active ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:border-emerald-300 hover:text-white'}">${item.runeDef.icon || '\u2726'} ${item.runeDef.name} Lv.${item.rune.level || 1}</button>`;
            }).join('');
        }
        const selectedRuneText = selectedRune
            ? `\u5df2\u9078\u4e2d\u6ce8\u5165\u7b26\u6587\uff1a${selectedRune.icon || '\u2726'} ${selectedRune.name} \u2192 \u5f48\u73e0\u5c6c\u6027\u5c07\u88ab\u8986\u84cb\u70ba ${attrDisplay[selectedRune.element]?.name || selectedRune.element}`
            : '\u672a\u9078\u4e2d\u7b26\u6587\uff1a\u5c07\u4ee5\u539f\u5c6c\u6027\u9032\u5165\u7814\u78e8\u3002';
        host.innerHTML = `
            <div class="preview-divider"></div>
            <div class="preview-peg-label">\u7d14\u6de8\u7cbe\u83ef / \u7b26\u6587\u6ce8\u5165</div>
            <div class="text-xs text-slate-300 mb-2">\u53ef\u9078\u64c7\u4efb\u610f\u7b26\u6587\u6ce8\u5165\uff0c\u8986\u84cb\u5f48\u73e0\u5c6c\u6027\uff1b\u4e5f\u53ef\u4e0d\u6ce8\u5165\u4ee5\u539f\u5c6c\u6027\u9032\u5165\u7814\u78e8\u3002</div>
            <div class="flex flex-wrap gap-2 mb-2">\u5f48\u73e0\u539f\u5c6c\u6027\uff1a${currentAttrHtml}</div>
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

    /**
     * @method ui_showChaosBulletSlotMachine
     * @description [chaos-skip-upgrade] 渲染混沌精华跳过时的子弹老虎机覆盖层并播放动画。
     * @param {string[][]} slotAttrs 每个 slot 可用的属性列表（顺序）。
     * @param {string[]} finalPicks 每个 slot 最终命中的属性。
     * @param {Object<string,string>} ATTR_LABEL 属性 key -> 显示文本映射。
     * @param {boolean} allSame 是否三连同款。
     * @param {Function} onComplete 玩家点击「进入战斗」按钮后的回调。
     */
    ui_showChaosBulletSlotMachine(slotAttrs, finalPicks, ATTR_LABEL, allSame, onComplete) {
        const overlay = document.getElementById('chaos-slot-machine-overlay');
        const slotsEl = document.getElementById('chaos-slot-machine-slots');
        const resultEl = document.getElementById('chaos-slot-machine-result');
        const continueBtn = document.getElementById('chaos-slot-machine-continue');
        if (!overlay || !slotsEl || !resultEl || !continueBtn) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        slotsEl.innerHTML = '';
        resultEl.innerText = '';
        continueBtn.style.display = 'none';

        const ITEM_HEIGHT = 64;
        const slotElements = [];
        slotAttrs.forEach((attrs, idx) => {
            const slotEl = document.createElement('div');
            slotEl.className = 'chaos-slot';
            const win = document.createElement('div');
            win.className = 'chaos-slot-window';
            const inner = document.createElement('div');
            inner.className = 'chaos-slot-window-inner chaos-slot-spinning';
            // 构造一个滚动序列，反复循环 attrs，最后一项确保是 finalPicks[idx]
            const cycleCount = 22 + idx * 6;
            const sequence = [];
            for (let i = 0; i < cycleCount; i++) sequence.push(attrs[i % attrs.length]);
            sequence.push(finalPicks[idx]);
            sequence.push(finalPicks[idx]);
            sequence.forEach(attr => {
                const div = document.createElement('div');
                div.innerText = ATTR_LABEL[attr] || attr;
                inner.appendChild(div);
            });
            win.appendChild(inner);
            slotEl.appendChild(win);
            const labelEl = document.createElement('div');
            labelEl.className = 'chaos-slot-label';
            labelEl.innerText = `子弹 ${idx + 1}`;
            slotEl.appendChild(labelEl);
            slotsEl.appendChild(slotEl);
            slotElements.push({ slotEl, inner, sequenceLen: sequence.length });
        });

        overlay.style.display = 'flex';

        const baseSpinDuration = 1200;
        const stagger = 380;
        slotElements.forEach((s, idx) => {
            const targetIdx = s.sequenceLen - 2; // finalPicks 是倒数第二项（最后一项是缓冲）
            const totalDistance = targetIdx * ITEM_HEIGHT;
            s.inner.style.top = '0px';
            s.inner.style.transition = `top ${baseSpinDuration + idx * stagger}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
            requestAnimationFrame(() => {
                s.inner.style.top = `-${totalDistance}px`;
            });
            setTimeout(() => {
                s.inner.classList.remove('chaos-slot-spinning');
                s.slotEl.classList.add('chaos-slot-locked');
            }, baseSpinDuration + idx * stagger);
        });

        const totalDuration = baseSpinDuration + (slotElements.length - 1) * stagger + 250;
        setTimeout(() => {
            if (allSame) {
                slotElements.forEach(s => s.slotEl.classList.add('chaos-slot-jackpot'));
                const attr = finalPicks[0];
                resultEl.innerText = `🎉 三连同款【${ATTR_LABEL[attr] || attr}】：每枚子弹 ${ATTR_LABEL[attr] || attr} +5`;
            } else {
                const summary = finalPicks.map((p, i) => `子弹${i+1} ${ATTR_LABEL[p] || p} +2`).join(' ｜ ');
                resultEl.innerText = summary;
            }
            continueBtn.style.display = 'inline-flex';
            continueBtn.onclick = () => {
                overlay.style.display = 'none';
                if (typeof onComplete === 'function') onComplete();
            };
        }, totalDuration);
    },

    ui_renderReplaceAmmoUI() {
        // @section:replace_ammo_init - 初始化上下文、获取 DOM 元素并设置标题文字
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
        const _skipChaosBtnInReplace = document.getElementById('skip-chaos-btn');
        if (_skipChaosBtnInReplace) _skipChaosBtnInReplace.style.display = 'none';
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

        // @section:replace_ammo_tier_calc - 子弹等级与主属性计算函数（_calcTier / _calcDominant）
        // [tsk-bullet-ui] 稀有度同时考虑普通属性、连射倍率以及爆破/套娃/激光/共鸣/七彩等特殊属性。
        const _statKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
        const _calcSpecialBonus = (recipe) => {
            let bonus = 0;
            if (recipe.explosive) bonus += 8;            // 爆破：等同 1 张 A 级属性
            if (recipe.isMatryoshka) bonus += 6;         // 套娃：连锁载荷
            if (recipe.isLaser) bonus += 5;              // 激光本体
            if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow') bonus += 6;
            if (recipe.type === 'resonance' || recipe._marbleType === 'resonance') bonus += 4;
            return bonus;
        };
        const _calcTier = (recipe) => {
            const mc = recipe.multicast || 0;
            const mcTier = mc >= 12 ? 3 : mc >= 6 ? 2 : mc >= 3 ? 1 : 0;
            let statSum = 0;
            _statKeys.forEach(k => { if (recipe[k] > 0) statSum += recipe[k]; });
            statSum += _calcSpecialBonus(recipe);
            const statTier = statSum >= 35 ? 3 : statSum >= 20 ? 2 : statSum >= 8 ? 1 : 0;
            return Math.max(mcTier, statTier);
        };

        const _calcDominant = (recipe) => {
            let statSum = 0;
            let maxKey = null, maxVal = 0;
            _statKeys.forEach(k => {
                const v = recipe[k] || 0;
                if (v > 0) { statSum += v; if (v > maxVal) { maxVal = v; maxKey = k; } }
            });
            // [tsk-bullet-ui] 主题色优先取特殊属性（爆破/激光/飞剑/套娃），保证视觉与玩法对应
            if (recipe.explosive && (!maxKey || maxVal < 6)) maxKey = 'pyro';
            if (recipe.isLaser) { maxKey = 'laser'; maxVal = Math.max(maxVal, 8); }
            if (recipe.isMatryoshka && !maxKey) maxKey = 'lightning';
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

        // @section:replace_ammo_card_render - 子弹卡片 DOM 渲染：renderCard + makeRow + 将卡片添加到网格
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
                // [tsk-bullet-ui] 添加 .replace-ammo-card 类用于全局 hover 样式（鼠标悬浮时上抬+加亮）
                cardWrap.className = 'replace-ammo-card';
                cardWrap.style.cssText = 'position:relative;border-radius:12px;overflow:visible;height:100%;display:flex;flex-direction:column;box-sizing:border-box;transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;';
                cardWrap.dataset.dominantColor = dominant ? dominant.theme[1] : ts.borderIdle;
                // [bitmap-replace-ammo] 标记稀有度，CSS 用 [data-tier] 切换 9-Slice 边框
                cardWrap.dataset.tier = ['C','B','A','S'][tier] || 'C';
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
                // [tsk-bullet-ui] 顶部图标常驻：所有卡片都展示主属性图标（原来仅在 isSelected 时浮动）
                iconArea.style.cssText = 'position:absolute;top:-18px;left:50%;transform:translateX(-50%);z-index:20;pointer-events:none;';
                iconArea.className = isSelected ? 'card-floating' : 'card-icon-idle';

                const attrIcons = (typeof CONFIG !== 'undefined' && CONFIG.ui && CONFIG.ui.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
                // [tsk-bullet-ui] 主属性优先识别：爆破/激光/套娃/连射 等特殊属性优先显示，其次才是数值最高的元素属性
                let mainAttrKey;
                if (recipe.explosive) mainAttrKey = 'explosive';
                else if (recipe.isLaser) mainAttrKey = 'laser';
                else if (recipe.isMatryoshka) mainAttrKey = 'matryoshka';
                else if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow') mainAttrKey = 'rainbow';
                else if (recipe.type === 'resonance' || recipe._marbleType === 'resonance') mainAttrKey = 'resonance';
                else if (dominant) mainAttrKey = dominant.key;
                else mainAttrKey = recipe.pyro > 0 ? 'pyro' : recipe.cryo > 0 ? 'cryo' : recipe.lightning > 0 ? 'lightning' : 'damage';
                const mainAttrInfo = attrIcons[mainAttrKey] || { icon: '🔮', color: '#94a3b8' };
                const _iconBorderColor = (mainAttrInfo.color && mainAttrInfo.color.indexOf('gradient') === -1) ? mainAttrInfo.color : '#facc15';

                // [icon-fix] 替换子弹卡片：优先使用与命运选择卡片一致的 ammo 位图
                const ammoBitmapSrc = getAmmoIconSrcByKey(mainAttrKey);
                const iconInner = ammoBitmapSrc
                    ? `<img src="${ammoBitmapSrc}" alt="${mainAttrInfo.icon}" style="width:24px;height:24px;object-fit:contain;display:block;" loading="lazy" onerror="this.outerHTML='${(mainAttrInfo.icon || '').replace(/'/g, '&#39;')}';" />`
                    : (mainAttrInfo.icon || '');
                iconArea.innerHTML = `
                    <div style="width:38px;height:38px;background:rgba(15,23,42,0.92);border:2px solid ${_iconBorderColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.55), 0 0 10px ${_iconBorderColor}88;">
                        ${iconInner}
                    </div>
                `;
                cardWrap.appendChild(iconArea);

                const tierBadge = document.createElement('div');
                tierBadge.style.cssText = 'position:absolute;top:4px;left:6px;font-size:10px;font-weight:900;padding:1px 4px;border-radius:4px;z-index:12;color:' + (dominant ? dominant.theme[1] : ts.labelColor) + ';background:rgba(15,23,42,0.8);border:1px solid ' + (dominant ? dominant.theme[1] : ts.labelColor) + ';';
                tierBadge.innerText = tier === 3 ? '✦ S' : tier === 2 ? 'A' : tier === 1 ? 'B' : 'C';
                card.appendChild(tierBadge);

                // [tsk-bullet-ui] 显示数值属性 + 特殊属性（爆破/套娃/激光/连射/七彩/共鸣）
                const attrKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind'];
                const sortedAttrs = attrKeys
                    .map(k => ({ key: k, val: recipe[k] || 0 }))
                    .filter(a => a.val > 0)
                    .sort((a, b) => b.val - a.val);

                const specialAttrs = [];
                if (recipe.explosive) specialAttrs.push({ key: 'explosive', label: '✓' });
                if (recipe.isMatryoshka) specialAttrs.push({ key: 'matryoshka', label: '✓' });
                if (recipe.isLaser && (recipe.laser || 0) === 0) specialAttrs.push({ key: 'laser', label: '✓' });
                if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow') specialAttrs.push({ key: 'rainbow', label: '✓' });
                if (recipe.type === 'resonance' || recipe._marbleType === 'resonance') specialAttrs.push({ key: 'resonance', label: '✓' });
                if ((recipe.multicast || 0) > 0) specialAttrs.push({ key: 'multicast', label: 'x' + recipe.multicast });

                const attrsContainer = document.createElement('div');
                attrsContainer.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:auto;width:100%;';

                // 特殊属性优先显示在顶部（更醒目），数值属性补足到 4 行
                const allRows = specialAttrs.concat(sortedAttrs).slice(0, 4);
                allRows.forEach(attr => {
                    const info = attrIcons[attr.key] || {};
                    const isSpecial = attr.label !== undefined;
                    const valText = isSpecial ? attr.label : String(attr.val);
                    const borderColor = (info.color && info.color.indexOf('gradient') === -1) ? info.color : '#facc15';
                    const labelColor = borderColor;
                    const row = document.createElement('div');
                    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;width:100%;padding:2px 6px;background:rgba(0,0,0,${isSpecial ? '0.45' : '0.3'});border-radius:4px;border-left:2px solid ${borderColor};`;
                    row.innerHTML = `
                        <span style="font-size:10px;color:${labelColor};display:flex;align-items:center;gap:2px;">
                            <span style="font-size:11px;">${info.icon || '◆'}</span>
                            <span>${info.name || attr.key}</span>
                        </span>
                        <span style="font-size:11px;font-weight:800;color:#fff;">${valText}</span>
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

        // @section:replace_ammo_confirm_btn - 确认按鈕与跳过按鈕状态同步
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
        // [bullet-replace-fix] 纯净精华跳过研磨场景下没有「新研磨子弹」可回退，
        // 跳过将导致 ammoQueue 为空进入战斗死循环，因此仅在有新研磨子弹时显示该按钮。
        skipBtn.style.display = newRecipes.length > 0 ? 'flex' : 'none';
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
        // [chaos-skip-upgrade] \u6df7\u6c8c\u7cbe\u534e\u8df3\u8fc7\u6309\u94ae\uff1a\u4ec5\u5728\u6df7\u6c8c\u7cbe\u534e\u6a21\u5f0f\u4e0b\uff0c\u4e14\u5b58\u5728\u53ef\u5347\u7ea7\u7684\u5145\u80fd\u5b50\u5f39\u65f6\u663e\u793a
        const skipChaosBtn = document.getElementById('skip-chaos-btn');
        if (skipChaosBtn) {
            const hasChargedAmmo = Array.isArray(this._chargedAmmoQueue) && this._chargedAmmoQueue.length > 0;
            skipChaosBtn.style.display = (this.selectionMode === 'chaos_essence' && hasChargedAmmo) ? 'flex' : 'none';
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
                // [BUGFIX] 将 'training' 加入 needsAuto 列表：
                // 试炼场 #phase-training 是 DOM 驱动的（场景列表/属性 +/- 按钮/退出按钮等），
                // 默认 pointer-events:none 会让所有按钮失效（点击穿透到底层 canvas）。
                const needsAuto = ['meta', 'shop', 'truth_book', 'gameover', 'relic', 'pause', 'selection', 'training'].includes(this.phase);
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

        // [PC 布局 #3] 同步左侧栏「收集 / 战斗」内容显隐
        if (typeof this._ui_updateLeftSidebarContent === 'function') {
            this._ui_updateLeftSidebarContent(this.phase);
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
        const wasPC = document.body.classList.contains('pc-mode');
        document.body.classList.toggle('pc-mode', isPC);
        const leftSidebar = document.getElementById('pc-left-sidebar');
        const rightSidebar = document.getElementById('pc-right-sidebar');
        if (leftSidebar) leftSidebar.style.display = isPC ? 'flex' : 'none';
        if (rightSidebar) rightSidebar.style.display = isPC ? 'flex' : 'none';

        // [PC 布局恢复 #3] 实际把右侧符文发射器、左侧 info-drawer / 收集队列 / 配方 HUD
        // 迁移到 PC 侧边栏；离开 PC 模式时再迁回原始位置。
        this._ui_migrateRuneLauncherToSidebar(isPC);
        this._ui_migrateDrawerToLeftSidebar(isPC);
        this._ui_migrateHUDToLeftSidebar(isPC);
        this._ui_updateLeftSidebarContent(this.phase, wasPC);
    },

    _ui_updateLeftSidebarContent(phase /* , wasPC */) {
        const gatheringPane = document.getElementById('pc-left-gathering');
        const combatPane = document.getElementById('pc-left-combat');
        const isPC = document.body.classList.contains('pc-mode');
        if (!gatheringPane || !combatPane) return;
        if (!isPC) {
            gatheringPane.style.display = 'none';
            combatPane.style.display = 'none';
            return;
        }
        if (phase === 'gathering' || phase === 'selection') {
            gatheringPane.style.display = 'flex';
            combatPane.style.display = 'none';
        } else if (phase === 'combat') {
            gatheringPane.style.display = 'none';
            combatPane.style.display = 'flex';
        } else {
            gatheringPane.style.display = 'none';
            combatPane.style.display = 'none';
        }
    },

    /**
     * @description 在 PC / 移动模式之间迁移指定元素。第一次调用时记录原始 parent，
     * 之后通过 dataset 标志位把元素移入侧边栏挂载点 / 还原回原父节点。
     */
    _ui_movePanelTo(elId, mountId, toSidebar) {
        const el = document.getElementById(elId);
        const mount = document.getElementById(mountId);
        if (!el) return;
        if (toSidebar) {
            if (!mount) return;
            if (el.parentElement !== mount) {
                if (!el.dataset.originalParentId) {
                    const origParent = el.parentElement;
                    if (origParent) {
                        if (!origParent.id) origParent.id = '_orig_parent_' + elId;
                        el.dataset.originalParentId = origParent.id;
                    }
                }
                mount.appendChild(el);
            }
        } else {
            const origId = el.dataset.originalParentId;
            if (origId) {
                const origParent = document.getElementById(origId);
                if (origParent && el.parentElement !== origParent) {
                    origParent.appendChild(el);
                }
            }
        }
    },

    _ui_migrateDrawerToLeftSidebar(toSidebar) {
        this._ui_movePanelTo('info-drawer', 'pc-left-drawer-mount', toSidebar);
    },

    _ui_migrateHUDToLeftSidebar(toSidebar) {
        this._ui_movePanelTo('gathering-queue', 'pc-left-queue-mount', toSidebar);
        this._ui_movePanelTo('gathering-hud-mount', 'pc-left-recipe-mount', toSidebar);
    },

    _ui_migrateRuneLauncherToSidebar(toSidebar) {
        this._ui_movePanelTo('phase-rune-launcher', 'pc-right-rune-mount', toSidebar);
        // PC 模式下符文发射器常驻显示
        const launcher = document.getElementById('phase-rune-launcher');
        if (launcher && toSidebar) {
            launcher.style.display = 'flex';
        }
    },

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
                // [feat] 注入任意符文：覆盖弹珠的元素属性后进入研磨阶段
                if (injected.marbleIndex !== selectedIndex) {
                    if (typeof showToast === 'function') showToast('純淨精華尚未完成符文注入。');
                    return;
                }
                marble.type = injected.element;
                marble.collected = [];
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
                if (typeof showToast === 'function') showToast(`已為 ${marble.getName()} 覆蓋屬性並注入 ${injected.icon || '✦'} ${injected.name}，本輪同化率 x${multiplier}。`);
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
        // [BUGFIX] 移除多余的 ui_updateUI() 调用：
        // phase_switchPhase 已经调用过 ui_updateUI()，再在 ui_onPhaseChange 里重复调用
        // 会导致用旧的 selectionMode 重新渲染上一次的命运选择卡片。
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
        // [BUGFIX #5] 暂停/设置面板的 DOM id 是 `phase-pause`，原代码错把它当成 `pause-overlay` 处理，
        // 导致点击「⚙️」按鈕没有任何反应。这里改为正确的 id，并补上 hidden-phase / display 切换。
        const pause = document.getElementById('phase-pause');
        if (!pause) return;
        pause.classList.remove('hidden');
        pause.classList.remove('hidden-phase');
        pause.classList.add('active-phase');
        pause.style.display = 'flex';
        pause.style.zIndex = '900';
        pause.style.pointerEvents = 'auto';
        if (typeof this.ui_syncPauseSettings === 'function') this.ui_syncPauseSettings();
    },

    ui_closePause() {
        const pause = document.getElementById('phase-pause');
        if (!pause) return;
        pause.classList.add('hidden');
        pause.classList.add('hidden-phase');
        pause.classList.remove('active-phase');
        pause.style.display = 'none';
    },

    ui_syncPauseSettings() {
        if (typeof this.ui_renderPauseRelics === 'function') this.ui_renderPauseRelics();
    },
    ui_renderPauseRelics() {
        const list = document.getElementById('pause-relic-list');
        if (!list) return;
        const owned = (this.ownedRelics || []);
        if (owned.length === 0) {
            list.innerHTML = '<div class="pause-empty-relics">尚未获得任何遗物</div>';
            return;
        }
        // 统计每件遗物的拥有数量
        const counts = {};
        owned.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        const html = Object.entries(counts).map(([id, count]) => {
            const def = RELIC_DB.find(r => r.id === id) || { name: id, icon: '❓', desc: '' };
            const stack = count > 1 ? ` <span style="color:#fbbf24;font-weight:bold;">×${count}</span>` : '';
            return `
                <div style="display:flex;align-items:flex-start;gap:8px;padding:8px;margin-bottom:6px;background:rgba(30,41,59,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;">
                    <span style="font-size:20px;line-height:1;">${def.icon || '🔮'}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12px;font-weight:bold;color:#e2e8f0;">${def.name}${stack}</div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px;line-height:1.4;">${def.desc || ''}</div>
                    </div>
                </div>`;
        }).join('');
        list.innerHTML = html;
    }
};
