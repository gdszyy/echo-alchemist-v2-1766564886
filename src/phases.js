/**
 * phases.js - 游戏阶段逻辑层
 * 
 * 职责：
 * - 管理各个游戏阶段的具体逻辑
 * - 分离阶段相关方法，减轻core.js的负担
 * 
 * 核心类：
 * - PhaseBase: 阶段基类
 * - SelectionPhase: 命运抉择阶段
 * - GatheringPhase: 研磨阶段
 * - CombatPhase: 战斗阶段
 */

import { 
    Vec2, 
    MarbleDefinition, 
    SpecialSlot, 
    FortuneWheel, 
    Peg, 
    DropBall, 
    Enemy, 
    SwordQi, 
    SlashAnim, 
    SonSword, 
    Projectile, 
    CloneSpore, 
    Particle, 
    SlashEffect, 
    CollectionBeam, 
    Shockwave, 
    LaserBeam, 
    FloatingText, 
    EnergyOrb, 
    LightningBolt, 
    FireWave, 
    Player, 
    showToast, 
    rotateTowards,
    adjustColorBrightness, 
    lerpColor, 
    lerp, 
    hexToRgba 
} from './entities.js';

import { CONFIG, RELIC_DB, SKILL_DB } from './config.js';

// ==================== 阶段基类 ====================

/**
 * PhaseBase - 所有阶段的基类
 * 提供通用的生命周期方法
 */
class PhaseBase {
    /**
     * 构造函数
     * @param {Game} game - Game实例的引用
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * 初始化阶段
     * 子类应该重写此方法
     */
    init() {
        // 子类实现
    }

    /**
     * 更新阶段逻辑
     * 子类应该重写此方法
     */
    update(timeScale = 1) {
        // 子类实现
    }

    /**
     * 渲染阶段
     * 子类应该重写此方法
     */
    render() {
        // 子类实现
    }

    /**
     * 清理阶段资源
     * 子类可以重写此方法
     */
    cleanup() {
        // 默认不做任何事
    }
}

// ==================== 命运抉择阶段 ====================

/**
 * SelectionPhase - 命运抉择阶段
 * 玩家选择3个弹珠进行炼金
 */
class SelectionPhase extends PhaseBase {
    constructor(game) {
        super(game);
    }

    /**
     * 初始化命运抉择阶段
     */
    init() {
        this.game.phase = 'selection';
        this.generateMarbleOptions(); // 生成弹珠选项
        this.game.selectedMarbles = []; // 重置已选择弹珠
        document.getElementById('selected-count').innerText = '0'; 
        document.getElementById('confirm-selection-btn').disabled = true; 
        document.getElementById('recipe-hud-container').classList.add('hidden');
    }

    /**
     * 生成弹珠选项 (5个) 供玩家选择
     */
    generateMarbleOptions() { 
        const container = document.getElementById('marble-selection-grid'); 
        container.innerHTML = ''; 
        this.game.marblesPool = []; 
        
        // 定義屬性到彈珠定義的映射
        const typeMapping = {
            laser: () => new MarbleDefinition('laser'),
            white: () => new MarbleDefinition('white'),
            explosive: () => new MarbleDefinition('explosive'),
            rainbow: () => new MarbleDefinition('rainbow'),
            matryoshka: () => new MarbleDefinition('matryoshka'),
            resonance: () => new MarbleDefinition('resonance'),
            // 剩下的都是 colored 類型，但 subtype 不同
            bounce: () => new MarbleDefinition('bounce'),
            pierce: () => new MarbleDefinition('pierce'),
            scatter: () => new MarbleDefinition('scatter'),
            damage: () => new MarbleDefinition('damage'),
            cryo: () => new MarbleDefinition('cryo'),
            pyro: () => new MarbleDefinition('pyro')

        };

        for(let i=0; i < CONFIG.gameplay.selectionCount; i++) {
            let m;
            
            // 1. 保底機制
            if (this.game.guaranteedNextRound.length > 0) {
                const key = this.game.guaranteedNextRound.shift();
                if (typeMapping[key]) m = typeMapping[key]();
            } 
            
            // 2. 加權隨機機制
            if (!m) {
                // 計算總權重
                let total = 0;
                const keys = Object.keys(this.game.unlockedWeights);
                keys.forEach(k => total += this.game.unlockedWeights[k]);
                
                let r = Math.random() * total;
                for (const key of keys) {
                    r -= this.game.unlockedWeights[key];
                    if (r <= 0) {
                        if (typeMapping[key]) m = typeMapping[key]();
                        break;
                    }
                }
            }
            
            // 兜底防止出錯
            if (!m) m = new MarbleDefinition('white');
            
            this.game.marblesPool.push(m); 
            
            // 創建 UI 卡片
            const card = document.createElement('div'); 
            card.className = 'select-card'; 
            card.onclick = () => this.toggleMarbleSelection(i, card); 
            const icon = document.createElement('div'); 
            icon.className = 'select-icon flex-shrink-0'; 
            icon.style.background = m.getColor(); 
            const name = document.createElement('div'); 
            name.className = 'text-xs font-bold text-center text-slate-200 mt-2'; 
            name.innerText = m.getName(); 
            card.append(icon, name); 
            container.appendChild(card); 
        } 
    }

    /**
     * 切换指定索引弹珠的选中状态
     * @param {number} idx - 弹珠在 marblesPool 中的索引
     * @param {HTMLElement} cardEl - 弹珠对应的 UI 元素
     */
    toggleMarbleSelection(idx, cardEl) { 
        if (this.game.selectedMarbles.includes(idx)) {
            // 取消选择
            this.game.selectedMarbles = this.game.selectedMarbles.filter(i => i !== idx); 
            cardEl.classList.remove('selected'); 
        } else { 
            // 选择 (最多 3 个)
            if (this.game.selectedMarbles.length < 3) { 
                this.game.selectedMarbles.push(idx); 
                cardEl.classList.add('selected'); 
            } 
        } 
        const count = this.game.selectedMarbles.length; 
        document.getElementById('selected-count').innerText = count; 
        document.getElementById('confirm-selection-btn').disabled = count !== 3; // 只有选满 3 个才能确认
    }

    /**
     * 确认玩家选择的弹珠，并进入收集阶段
     */
    confirmSelection() { 
        if (this.game.selectedMarbles.length !== 3) return; 
        this.game.marbleQueue = this.game.selectedMarbles.map(i => this.game.marblesPool[i]); // 将选中的弹珠放入队列
        this.game.phase_switchPhase('gathering'); 
    }

    /**
     * 更新命运抉择阶段
     */
    update(timeScale = 1) {
        // 将在迁移时实现
    }

    /**
     * 渲染命运抉择阶段
     */
    render() {
        // 将在迁移时实现
    }
}

// ==================== 研磨阶段 ====================

/**
 * GatheringPhase - 研磨阶段
 * 弹珠机物理模拟和资源收集
 */
class GatheringPhase extends PhaseBase {
    constructor(game) {
        super(game);
    }



// ==================== 战斗阶段 ====================

/**
 * CombatPhase - 战斗阶段
 * 玩家与敌人的战斗逻辑
 */
class CombatPhase extends PhaseBase {
    constructor(game) {
        super(game);
    }

    /**
     * 初始化战斗阶段
     * 注意：该方法包含大量战斗逻辑，已从 core.js 的 phase_startCombatPhase 迁移
     */
    init() {
        // 由于 CombatPhase 包含约 70 个方法且代码量巨大（超过 3000 行），
        // 为了确保重构的安全性和可维护性，我们采用分阶段迁移策略。
        // 当前阶段：创建基础架构，保留方法在 Game 类中。
        // 后续阶段：逐步迁移具体方法到此类。
        
        // 调用 Game 类中的原有方法（临时方案）
        if (this.game.phase_startCombatPhase_impl) {
            this.game.phase_startCombatPhase_impl();
        }
    }

    /**
     * 更新战斗阶段
     * 注意：该方法包含大量战斗逻辑，已从 core.js 的 phase_combat_update 迁移
     */
    update(timeScale = 1) {
        // 调用 Game 类中的原有方法（临时方案）
        if (this.game.phase_combat_update_impl) {
            this.game.phase_combat_update_impl(timeScale);
        }
    }

    /**
     * 渲染战斗阶段
     * 注意：update方法已包含渲染逻辑，此方法为占位
     */
    render() {
        // 渲染逻辑已包含在 update 中
    }
}

// ==================== 导出 ====================

export { PhaseBase, SelectionPhase, GatheringPhase, CombatPhase };

    /**
     * 初始化研磨阶段
     */
    init() {
        // 保存上一回合的伤害数据
        if (this.game.shotDamageHistory.length > 0) {
            this.game.roundDamageHistory.push({
                round: this.game.round,
                shots: JSON.parse(JSON.stringify(this.game.shotDamageHistory))
            });
        }
        
        this.game.phase = 'gathering';
        requestAnimationFrame(() => {
            this.game.ui_updateUICache();
        });
        if (this.game.pegs.length === 0) {
            this.initPachinko(); 
        }
        
        // 初始化持久阈值变量
        this.game.persistentThreshold = CONFIG.gameplay.initTriggerThreshold; 
        this.game.ui.updateSkillPoints(this.game.skillPoints);
        this.game.ammoQueue = []; 
        this.game.dropBalls = []; 
        this.game.activeMarbleIndex = 0; 
        this.game.combat_updateHitProgress(0, this.game.persistentThreshold); 
        this.game.ui_updateGatheringQueueUI(); 
        this.game.ui_renderRecipeHUD(); 
        this.game.combat_updateMulticastDisplay(0);
        this.game.ui_renderRecipeHUD();
    }

    /**
     * 初始化弹珠台布局
     * @param {boolean} shouldInherit - 是否继承上一轮的钉子状态
     */
    initPachinko(shouldInherit = false) {
        // 使用动态行数
        const rows = this.game.currentRows || CONFIG.gameplay.rows;
        // 获取间距配置
        const spacingX = CONFIG.gameplay.spacingX || 45;
        const spacingY = CONFIG.gameplay.spacingY || 45;
        
        // 修正 width 引用
        const offsetX = (this.game.width - (CONFIG.gameplay.cols - 1) * spacingX) / 2;
        const offsetY = 120;

        const previousPegs = [...this.game.pegs];
        this.game.pegs = [];
        this.game.specialSlots = [];
        let pegIndex = 0;
        let maxPegY = 0;

        for (let r = 0; r < rows; r++) {
            const isOddRow = r % 2 !== 0;
            const cols = isOddRow ? CONFIG.gameplay.cols - 1 : CONFIG.gameplay.cols;
            const rowOffsetX = isOddRow ? spacingX / 2 : 0;

            for (let c = 0; c < cols; c++) {
                const x = offsetX + rowOffsetX + c * spacingX;
                const y = offsetY + r * spacingY;
                maxPegY = Math.max(maxPegY, y);

                let type = 'normal';
                let level = 1;

                // 继承逻辑
                if (shouldInherit && previousPegs[pegIndex]) {
                    const prevPeg = previousPegs[pegIndex];
                    // 排除粉色钉子（假设它是临时Buff）
                    if (prevPeg.type !== 'pink') {
                        type = prevPeg.type;
                        level = prevPeg.level || 1;
                    } else {
                        type = this.getRandomPegType();
                    }
                } else {
                    type = this.getRandomPegType();
                }

                let p = new Peg(x, y, type);
                p.level = level;
                // 继承逻辑：如果继承，保留当前的冷却状态
                if (shouldInherit && previousPegs[pegIndex]) {
                     p.cooldownTimer = previousPegs[pegIndex].cooldownTimer;
                }
                
                this.game.pegs.push(p);
                pegIndex++;
            }
        }

        if (this.game.round === 1 && !shouldInherit) {
            const replaceWithSpecial = (count, type) => {
                if (!count || count <= 0) return;
                const normalPegs = this.game.pegs.filter(p => p.type === 'normal');
                for (let i = normalPegs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [normalPegs[i], normalPegs[j]] = [normalPegs[j], normalPegs[i]];
                }
                for (let i = 0; i < Math.min(count, normalPegs.length); i++) {
                    normalPegs[i].type = type;
                    normalPegs[i].level = 1;
                }
            };
            replaceWithSpecial(CONFIG.gameplay.initWindPegs, 'wind');
            replaceWithSpecial(CONFIG.gameplay.initSwordPegs, 'flying_sword');
        }

        this.game.boardBottomY = maxPegY;
        const pinkCount = this.game.pinkPegCount;
        for (let i = 0; i < pinkCount; i++) {
            if (this.game.pegs.length > 0) {
                const idx = Math.floor(Math.random() * this.game.pegs.length);
                this.game.pegs[idx].type = 'pink';
            }
        }

        if (this.game.unlockedSlots.length > 0 && this.game.slotCount > 0) {
            const slotTypes = this.game.unlockedSlots;
            let attempts = 0;
            while (this.game.specialSlots.length < this.game.slotCount && attempts < 100) {
                attempts++;
                const r = Math.floor(Math.random() * rows);
                const isOddRow = r % 2 !== 0;
                const cols = isOddRow ? CONFIG.gameplay.cols - 1 : CONFIG.gameplay.cols;
                const c = Math.floor(Math.random() * cols);
                const pegIdx = this.game.pegs.findIndex(p => 
                    Math.abs(p.y - (offsetY + r * spacingY)) < 1 && 
                    Math.abs(p.x - (offsetX + (isOddRow ? spacingX / 2 : 0) + c * spacingX)) < 1
                );
                if (pegIdx !== -1 && this.game.pegs[pegIdx].type !== 'pink' && !this.game.specialSlots.some(s => s.pegIndex === pegIdx)) {
                    const type = slotTypes[Math.floor(Math.random() * slotTypes.length)];
                    this.game.specialSlots.push({ pegIndex: pegIdx, type: type });
                }
            }
        }
        this.game.ui_updateGatheringQueueUI();
        this.game.ui_renderRecipeHUD();
    }

    /**
     * 获取随机钉子类型
     * @returns {string} 钉子类型
     */
    getRandomPegType() { 
        // 定义所有可能的钉子类型（包含普通钉子）
        const pegTypes = ['bounce'];
        // 1. 获取 normal 的基础权重
        // 我们手动从 unlockedWeights 中取 white 作为普通钉子的权重基准（默认 100）
        const normalWeight = this.game.unlockedWeights['white'] || 100; 

        // 2. 计算当前所有"已解锁"类型的总权重
        let totalWeight = normalWeight;
        pegTypes.forEach(t => {
            totalWeight += (this.game.unlockedWeights[t] || 0);
        });
        
        // 3. 生成 0 到 totalWeight 之间的随机数
        let r = Math.random() * totalWeight;
        
        // 4. 区间判定：首先判定是否落在 normal 区间
        if (r < normalWeight) return 'normal';
        r -= normalWeight;
        
        // 5. 依次判定落在哪个特殊属性区间
        for (const t of pegTypes) {
            const w = this.game.unlockedWeights[t] || 0;
            if (w > 0) {
                if (r < w) return t; // 落在当前属性的权重区间内
                r -= w;
            }
        }
        
        return 'normal'; // 兜底返回
    }

    /**
     * 尝试完成研磨阶段
     */
    attemptComplete() {
        if (this.game.isWheelSpinning) return;
        // 解决方法：只计算 active 为 true 的能量球。
        const activeOrbsCount = this.game.energyOrbs.filter(orb => orb.active).length;

        // 1. 基础检查：如果还有东西在动，绝对不能结算
        console.log('[DEBUG] attemptComplete - dropBalls:', this.game.dropBalls.length, 'activeOrbs:', activeOrbsCount, 'activeBalls:', this.game.currentSession?.activeBalls);
        if (this.game.dropBalls.length > 0 || activeOrbsCount > 0 || this.game.currentSession.activeBalls > 0) {
            console.log('[DEBUG] 不能结算，还有东西在动');
            return;
        }

        // 2. 状态检查：防止重复结算
        // 如果当前 session 已经被标记为"已结算"或不存在，则直接返回
        if (!this.game.currentSession || this.game.currentSession.isFinished) return;

        // 3. 执行结算
        this.game.currentSession.isFinished = true; // 立即上锁

        const marbleDef = this.game.marbleQueue[this.game.activeMarbleIndex];
        // 兜底检查：如果此时 marbleDef 不存在（防止数组越界），直接停止
        if (!marbleDef) {
            this.game.currentSession = null;
            return;
        }
        marbleDef.collected = [...this.game.currentSession.collected];
        // 觸發倍率轉移特效
        // 計算當前倍率 (1 + 額外)
        const totalMulticast = 1 + this.game.currentSession.multicast;
        // 只有倍率大於 1 時才播放特效，或者你想每次都播也可以
        if (totalMulticast > 0) {
            this.game.combat_playMulticastTransferEffect(totalMulticast);
        }
        const recipe = this.game.calc_compileCollectionToRecipe(marbleDef, this.game.currentSession.collected, this.game.currentSession.multicast > 0);
        recipe.finalHits = this.game.currentSession.totalHits;
        recipe.multicast = this.game.currentSession.multicast;
        this.game.ammoQueue.push(recipe);
        
        marbleDef.multicast = this.game.currentSession.multicast;
        marbleDef.finalHits = this.game.currentSession.totalHits;

        this.game.activeMarbleIndex++;
        this.game.ui_updateGatheringQueueUI();
        
        // 弹珠结算时，重置所有钉子的冷却
        this.game.pegs.forEach(p => p.resetCooldown());
        
        // 4. 状态流转
        if (this.game.activeMarbleIndex >= this.game.marbleQueue.length) {
            // 所有弹珠都扔完了，进入战斗
            setTimeout(() => this.game.phase_switchPhase('combat'), 500);
        } else {
             // 准备下一回合，清空当前 session，允许玩家再次点击
             this.game.currentSession = null; 
        }
    }
