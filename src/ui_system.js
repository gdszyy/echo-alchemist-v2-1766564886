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
            // gameover 阶段需要滚动，使用 block 布局
            activeEl.style.display = (this.phase === 'gameover') ? 'block' : 'flex';  // [Mixin 正常用法]
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
            unifiedTopBar.style.display = hideInPhases.includes(this.phase) ? 'none' : 'flex';  // [Mixin 正常用法：读取 Game 实例状态]
        }

        // G. 战斗充能符文 UI 显隐同步（已在 ui_onPhaseChange 处理，此处备用兼容）
        const runeChargeUi = document.getElementById('combat-rune-charge-ui');
        if (runeChargeUi) {
            runeChargeUi.style.display = (this.phase === 'combat') ? 'flex' : 'none';  // [Mixin 正常用法：读取 Game 实例状态]
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
        // [本局统计] 累计本局获得的符文碎片数
        this.runRuneFragmentsGained = (this.runRuneFragmentsGained || 0) + amount;
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
        const titleData = PHASE_TITLES[newPhase] || { text: '\u547d\u904b\u6289\u62e9', sub: '\u9078\u64c7\u4f60\u7684\u547d\u904b' };

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
            topPhaseLabel.textContent = SHORT_LABELS[newPhase] || '';
        }

        // ===== C. 战斗充能符文 UI 仅在战斗阶段显示 =====
        const runeChargeUi = document.getElementById('combat-rune-charge-ui');
        if (runeChargeUi) {
            runeChargeUi.style.display = (newPhase === 'combat') ? 'flex' : 'none';
        }
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
