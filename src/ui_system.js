// [Task 2.4] UI 渲染逻辑已按区域拆分到独立模块
// - src/ui/hud.js: HUD 渲染（弹药、配方、伤害统计等）
// - src/ui/shop.js: 商店/遗物选择界面渲染
// - src/ui/rune_launcher.js: 符文发射器界面渲染
// 这些模块通过 Object.assign 混入 Game 实例，在 core.js 中完成

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
        // 1. 基础：隐藏所有阶段的主容器 (.ui-overlay)
        document.querySelectorAll('.ui-overlay').forEach(el => { 
            el.style.display = 'none'; 
            el.classList.add('hidden-phase'); 
            el.classList.remove('active-phase'); 
        });
        // 2. 显示当前阶段的主容器
        // [META] 兼容 phase-meta, shop, truth_book
        const activeEl = document.getElementById(`phase-${this.phase}`);  // [Mixin 正常用法：读取 Game 实例状态]
        if(activeEl) { 
            activeEl.style.display = 'flex'; 
            // 微小延迟以触发 CSS transition (如果有)
            setTimeout(() => { 
                activeEl.classList.remove('hidden-phase'); 
                activeEl.classList.add('active-phase'); 
            }, 10); 
        }
        
        // [META] 切换到主界面或商店时更新货币显示
        if (this.phase === 'meta' || this.phase === 'shop') {  // [Mixin 正常用法：读取 Game 实例状态]
            this.ui_updateMetaCurrency();
        }

        // 1. 底部面板 (.bottom-panel) 只在收集阶段 (gathering) 显示
        const bottomPanel = document.querySelector('.bottom-panel');
        if (bottomPanel) {
            if (this.phase === 'gathering') {  // [Mixin 正常用法：读取 Game 实例状态]
                bottomPanel.style.display = 'flex';
            } else {
                bottomPanel.style.display = 'none'; // 战斗阶段隐藏底部面板
            }
        }

        // A. 技能栏 (Skill Bar) - 仅在战斗且非敌人回合显示
        const skillBar = document.getElementById('skill-bar');
        if (skillBar) {
            // 只有在 combat 阶段才显示，其他阶段强制隐藏
            skillBar.style.display = (this.phase === 'combat') ? 'flex' : 'none';  // [Mixin 正常用法：读取 Game 实例状态]
        }

        // B. 连击倍率显示 (Multiplier)
        const multiplierEl = document.getElementById('multiplier-display');
        if (multiplierEl) {
            multiplierEl.style.opacity = (this.phase === 'combat') ? '1' : '0';  // [Mixin 正常用法：读取 Game 实例状态]
        }

        // C. 技能点面板 (SP Panel)
        // 逻辑：在 gathering 和 combat 显示，在选择阶段隐藏
        const spPanel = document.getElementById('sp-panel');
        if (spPanel) {
            if (this.phase === 'gathering' || this.phase === 'combat') {  // [Mixin 正常用法：读取 Game 实例状态]
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
        this.phase_startGatheringPhase();  // [Mixin 正常用法：读取 Game 实例状态]
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

        // ── 全屏闪光特效 ────────────────────────────────────────────────
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
    },
};
