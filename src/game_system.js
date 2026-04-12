/**
 * game_system.js - 游戏核心系统
 * 
 * 职责：
 * - 游戏主循环 (sys_loop)
 * - 输入管理 (input_xxx)
 * - 视差偏移计算
 * - 存档读写 (sys_saveData / sys_loadSaveData)
 * - 游戏重置与初始化 (sys_resetGame / sys_initGameStart)
 * - 窗口尺寸响应 (sys_resize)
 * - 输入事件绑定 (sys_setupInputs)
 * - 选择阶段初始化 (sys_initSelectionPhase)
 * - 弹珠选择切换 (sys_toggleMarbleSelection)
 * - 分数乘数重置 (sys_resetMultiplier)
 */
import { Vec2, showToast, RuneLoot } from './entities.js';
import { CONFIG } from './config.js';
import { audio } from './audio.js';
import { loot_calcRuneDrop } from './loot_system.js';
import { COUNTER_MAP } from './rune_config.js';
import { eventBus } from './event_bus.js';

export const game_system = {

    /**
     * @method sys_loop
     * @description 游戏主循环，由 requestAnimationFrame 驱动。
     */
    sys_loop() {
        const timeScale = this.timeScale;

        // 处理震动衰减
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        this.ctx.save();

        // 应用震动偏移
        this.ctx.translate(shakeX, shakeY);

        // 1. 基础渲染准备
        this.render_clearCanvas();

        // 2. 全局状态更新（平滑倾斜插值）
        const smoothSpeed = 0.05 * timeScale;
        this.boardTilt.current.x += (this.boardTilt.target.x - this.boardTilt.current.x) * smoothSpeed;
        this.boardTilt.current.y += (this.boardTilt.target.y - this.boardTilt.current.y) * smoothSpeed;

        // 3. 背景层渲染
        if (this.phase !== 'combat' && this.phase !== 'training') {
            this.render_background();
        }

        // 4. 特殊阶段更新
        if (this.phase === 'truth_book') {
            this.truthBook.update();
        }
        if (this.phase === 'training') {
            this.trainingGround.update();
        }

        // 5. 阶段逻辑与渲染分发
        switch (this.phase) {
            case 'gathering':
                this.phase_gathering_update(timeScale);
                break;
            case 'training':
            case 'combat':
                this.phase_combat_update(timeScale);
                break;
        }

        // 6. 特效与文字层渲染
        this.render_floatingTexts(timeScale);

        // 7. 风属性法阵渲染（仅战斗/试炼阶段）
        if (this.phase === 'combat' || this.phase === 'training') {
            this.render_windAnchors();
            for (let i = this.activeWindMatrices.length - 1; i >= 0; i--) {
                const matrix = this.activeWindMatrices[i];
                if (matrix.active) {
                    matrix.timer--;
                    this.render_singleWindMatrix(matrix);
                    if (matrix.timer <= 0) {
                        matrix.active = false;
                        if (matrix.onComplete) matrix.onComplete();
                        this.activeWindMatrices.splice(i, 1);
                    }
                }
            }
        }

        // 8. 下一帧请求
        this.ctx.restore();
        requestAnimationFrame(() => this.sys_loop());
    },

    /**
     * @method sys_resize
     * @description 响应窗口大小变化，调整 Canvas 尺寸和游戏布局参数。
     */
    sys_resize() {
        const container = document.getElementById('game-container');

        // 强制 JS 同步窗口高度，解决部分安卓浏览器兼容问题
        container.style.height = `${window.innerHeight}px`;
        container.style.width = `${window.innerWidth}px`;

        this.width = this.canvas.width = container.clientWidth;
        this.height = this.canvas.height = container.clientHeight;

        // 动态调整失败判定线
        this.defeatLineY = this.height - 120;

        this.enemyWidth = (this.width / CONFIG.gameplay.enemyCols);
        this.enemyHeight = this.enemyWidth;
        this.ui_updateUICache();

        if (this.phase === 'gathering') {
            this.phase_gathering_initPachinko(true);
        }
    },

    /**
     * @method sys_initGameStart
     * @description 初始化游戏开始状态（注入局外升级、生成初始敌人、进入遗物选择）。
     */
    sys_initGameStart() {
        // 注入局外升级效果
        this.meta_applyUpgrades();

        // 生成初始敌人
        const startY = 80;
        for (let i = 0; i < CONFIG.gameplay.startRows; i++) {
            this.spawn_spawnEnemyRowAt(startY + i * this.enemyHeight);
        }

        // 进入遗物选择阶段
        this.ui_showRelicSelection();
    },

    /**
     * @method sys_resetGame
     * @description 重置游戏状态（清空实体、重置回合/分数/货币、清空临时升级）。
     */
    sys_resetGame() {
        this.runCurrency = 0;
        this.gameOver = false;

        // 清空临时增强
        this.saveData.temporaryUpgrades = {};
        this.sys_saveData();

        this.round = 1;
        this.score = 0;
        this.scoreMultiplier = 1.0;

        // 重置解锁权重回初始状态
        this.unlockedWeights = { ...CONFIG.probabilities };
        this.guaranteedNextRound = [];
        this.ownedRelics = [];

        // 清空实体
        this.enemies = [];
        this.projectiles = [];
        this.dropBalls = [];
        this.ammoQueue = [];
        this.marbleQueue = [];
        this.energyOrbs = [];
        this.spores = [];
        this.currentRows = CONFIG.gameplay.rows;

        // Task 1: 数据结构升级 - 局内重置时清空符文库存和网格
        // runeInventory 和 runeGrid 属于局内状态，每局开始时重置
        this.runeInventory = [];
        this.runeGrid = Array(9).fill(null);
        this.activeRunewordStats = {};
        this.runeLootItems = [];
        this.skillPoints = 0;
        this.ui.updateSkillPoints(this.skillPoints);

        // 重置 UI
        document.getElementById('combat-message').innerHTML = '';
        document.getElementById('round-num').innerText = '1';
        // 更新符文数量显示
        this.ui_updateRuneCountDisplay();

        // 重置 Boss 系统状态
        this.bossHistory = [];
        this._pendingBossSpawn = null;
        // [难度平衡] 重置战后高压因子
        this.postBossMultiplier = 1.0;
        this.postBossSurgeRoundsLeft = 0;
    },

    /**
     * @method sys_loadSaveData
     * @description 从 localStorage 读取存档数据并应用到游戏状态。
     */
    sys_loadSaveData() {
        const saved = localStorage.getItem('echo_alchemist_save');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // 合并而非覆盖，确保新字段有默认值
                this.saveData = Object.assign(
                    { currency: 0, runeFragments: 0, upgrades: {}, temporaryUpgrades: {}, unlockedItems: [], highScore: 0, runeInventory: [], discoveredRunewords: [] },
                    parsed
                );
                // 确保 runeInventory 字段存在
                if (!this.saveData.runeInventory) this.saveData.runeInventory = [];
                // 确保 discoveredRunewords 字段存在（存档升级兼容）
                if (!this.saveData.discoveredRunewords) this.saveData.discoveredRunewords = [];
            } catch (e) {
                console.error('[sys_loadSaveData] Save load failed:', e);
            }
        }
        this.ui_updateMetaCurrency();
    },

    /**
     * @method sys_saveData
     * @description 将当前存档数据持久化到 localStorage。
     */
    sys_saveData() {
        try {
            localStorage.setItem('echo_alchemist_save', JSON.stringify(this.saveData));
        } catch (e) {
            console.error('[sys_saveData] Save failed:', e);
        }
    },

    /**
     * @method sys_setupInputs
     * @description 设置所有输入事件监听器（鼠标/触摸、按钮点击、陀螺仪）。
     */
    sys_setupInputs() {
        // 辅助函数：获取鼠标/触摸在 Canvas 上的相对位置
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            let x = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
            let y = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
            return new Vec2(x - rect.left, y - rect.top);
        };

        // 绑定输入事件
        this.canvas.addEventListener('mousedown', e => this.input_handleInputStart(getPos(e), e));
        this.canvas.addEventListener('touchstart', e => this.input_handleInputStart(getPos(e), e), { passive: false });
        window.addEventListener('mousemove', e => this.input_handleInputMove(getPos(e), e));
        window.addEventListener('touchmove', e => this.input_handleInputMove(getPos(e), e), { passive: false });
        window.addEventListener('mouseup', e => this.input_handleInputEnd(getPos(e), e));
        window.addEventListener('touchend', e => this.input_handleInputEnd(getPos(e), e));

        // 确认选择按钮
        const confirmBtn = document.getElementById('confirm-selection-btn');
        if (confirmBtn) confirmBtn.onclick = () => this.ui_confirmSelection();

        // 速度控制按钮
        const speedBtn = document.getElementById('speed-btn');
        if (speedBtn) {
            speedBtn.onclick = () => {
                if (this.timeScale === 1.0) this.timeScale = 2.0;
                else if (this.timeScale === 2.0) this.timeScale = 3.0;
                else if (this.timeScale === 3.0) this.timeScale = 0.42;
                else this.timeScale = 1.0;
                this.baseTimeScale = this.timeScale;
                speedBtn.innerText = `⏩ x${this.timeScale}`;
            };
        }

        // 静音按钮（已迁移到设置面板，此处保留兼容处理）
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            muteBtn.onclick = () => {
                if (this.sys_toggleMute) this.sys_toggleMute();
                else {
                    audio.resume();
                    audio.toggleMute();
                }
            };
        }

        // 伤害数字开关按钮（已迁移到设置面板，此处保留兼容处理）
        const damageNumbersBtn = document.getElementById('damage-numbers-btn');
        if (damageNumbersBtn) {
            damageNumbersBtn.onclick = () => {
                if (this.sys_toggleDamageNumbers) this.sys_toggleDamageNumbers();
                else {
                    this.showDamageNumbers = !this.showDamageNumbers;
                    showToast(this.showDamageNumbers ? '伤害数字：开启' : '伤害数字：关闭');
                }
            };
        }

        // 陀螺仪权限申请（iOS 13+ 需要用户交互）
        const enableGyro = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        this.boardTilt.enabled = true;
                        window.addEventListener('deviceorientation', e => this.input_handleOrientation(e));
                    }
                } catch (e) {
                    console.log('[sys_setupInputs] Gyro permission failed:', e);
                }
            } else if ('ondeviceorientation' in window) {
                this.boardTilt.enabled = true;
                window.addEventListener('deviceorientation', e => this.input_handleOrientation(e));
            }
        };

        // 将陀螺仪权限申请绑定到第一次用户交互
        const initialClickHandler = () => {
            enableGyro();
            window.removeEventListener('click', initialClickHandler);
            window.removeEventListener('touchstart', initialClickHandler);
        };
        window.addEventListener('click', initialClickHandler);
        window.addEventListener('touchstart', initialClickHandler);
    },

    /**
     * @method sys_initSelectionPhase
     * @description 初始化弹珠选择阶段。
     */
    sys_initSelectionPhase() {
        this.phase_switchPhase('selection');
        this.spawn_generateMarbleOptions();
        this.selectedMarbles = [];
        const countEl = document.getElementById('selected-count');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const recipeHud = document.getElementById('recipe-hud-container');
        if (countEl) countEl.innerText = '0';
        if (confirmBtn) confirmBtn.disabled = true;
        if (recipeHud) recipeHud.classList.add('hidden');
    },

    /**
     * @method sys_toggleMarbleSelection
     * @description 切换指定索引弹珠的选中状态（最多 3 个）。
     * @param {number} idx - 弹珠在 marblesPool 中的索引。
     * @param {HTMLElement} cardEl - 弹珠对应的 UI 元素。
     */
    sys_toggleMarbleSelection(idx, cardEl) {
        if (this.selectedMarbles.includes(idx)) {
            this.selectedMarbles = this.selectedMarbles.filter(i => i !== idx);
            cardEl.classList.remove('selected');
        } else {
            if (this.selectedMarbles.length < 3) {
                this.selectedMarbles.push(idx);
                cardEl.classList.add('selected');
            }
        }
        const count = this.selectedMarbles.length;
        const countEl = document.getElementById('selected-count');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        if (countEl) countEl.innerText = count;
        if (confirmBtn) confirmBtn.disabled = count !== 3;
    },

    /**
     * @method sys_resetMultiplier
     * @description 重置分数乘数为 1.0。
     */
    sys_resetMultiplier() {
        this.scoreMultiplier = 1.0;
        this.ui_updateMultiplierUI(); // 内部已有 null 检查，安全
        const display = document.getElementById('multiplier-display');
        if (display) {
            display.classList.remove('opacity-100');
            display.classList.add('opacity-0');
        }
    },

    /**
     * @method sys_initRecipeHUD
     * @description 初始化配方 HUD（隐藏状态）。
     */
    sys_initRecipeHUD() {
        this.ui_renderRecipeHUD();
        const container = document.getElementById('recipe-hud-container');
        if (container) container.classList.add('hidden');
    },

    /**
     * @method sys_toggleHud
     * @description 切换 HUD 展开/折叠状态。
     */
    sys_toggleHud() {
        this.hudExpanded = !this.hudExpanded;
        this.ui_renderRecipeHUD();
    },

    /**
     * @method data_clearProjectiles
     * @description 清除所有现存的投射物和爆发队列。
     */
    data_clearProjectiles() {
        this.sonSwords = [];
        this.projectiles = [];
        this.burstQueue = [];
        this.spores = [];
        this.fireWaves = [];
    },

    /**
     * @method triggerScreenShake
     * @description 触发屏幕震动。
     * @param {number} amount - 震动强度。
     */
    triggerScreenShake(amount) {
        this.screenShake = amount;
    },

    /**
     * @method drawWindTunnelFlow
     * @description 绘制风道流速底色。
     */
    drawWindTunnelFlow(rect, isHorizontal) {
        const offset = (Date.now() / 15) % 80;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 2;
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;
        if (isHorizontal) {
            for (let x = -80; x < canvasW + 80; x += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(x + offset, rect.y);
                this.ctx.lineTo(x + offset - 30, rect.y + rect.h);
                this.ctx.stroke();
            }
        } else {
            for (let y = -80; y < canvasH + 80; y += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(rect.x, y + offset);
                this.ctx.lineTo(rect.x + rect.w, y + offset - 30);
                this.ctx.stroke();
            }
        }
        this.ctx.restore();
    },

    /**
     * @method checkLineIntersection
     * @description 检测线段 AB 和 CD 是否相交。
     */
    checkLineIntersection(a, b, c, d) {
        const cross = (x, y, z) => (y.x - x.x) * (z.y - x.y) - (y.y - x.y) * (z.x - x.x);
        if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
            Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) {
            return false;
        }
        return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
    },

    /**
     * @method isBowtieShape
     * @description 检测四边形是否自相交（蝴蝶形/沙漏形）。
     */
    isBowtieShape(anchors) {
        if (anchors.length < 4) return false;
        const p = anchors;
        return this.checkLineIntersection(p[0], p[1], p[2], p[3]) ||
               this.checkLineIntersection(p[1], p[2], p[3], p[0]);
    },

    /**
     * @method getLineIntersectionPoint
     * @description 获取两线段的交点坐标。
     */
    getLineIntersectionPoint(a, b, c, d) {
        const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
        if (Math.abs(denom) < 0.001) return null;
        const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
        return new Vec2(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
    },

    /**
     * @method input_getTiltOffset
     * @description 获取当前视差偏移量（用于修正鼠标点击坐标）。
     */
    input_getTiltOffset() {
        if (this.phase === 'combat') {
            const tilt = this.boardTilt.current;
            return new Vec2(tilt.x * -25, tilt.y * -20);
        }
        return new Vec2(0, 0);
    },

    /**
     * @method input_handleOrientation
     * @description 处理设备陀螺仪输入。
     */
    input_handleOrientation(e) {
        if (!this.boardTilt.enabled) return;
        const maxTilt = 30;
        let x = e.gamma || 0;
        let y = e.beta || 0;
        y = y - CONFIG.gameplay.deviceTiltBaseAngle;
        x = Math.max(-maxTilt, Math.min(maxTilt, x));
        y = Math.max(-maxTilt, Math.min(maxTilt, y));
        this.boardTilt.target.x = x / maxTilt;
        this.boardTilt.target.y = y / maxTilt;
    },

    /**
     * @method input_handleInputStart
     * @description 处理输入开始（鼠标按下/触摸开始）。
     */
    input_handleInputStart(pos, e) {
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset);
        this.lastMousePos = logicPos;

        if (this.phase === 'meta') {
            // [fix] 移除幽灵调用 this.meta_handleClick(pos)
            // meta 阶段的 UI 是基于 HTML DOM 的（#phase-meta z-index:200 pointer-events:auto）
            // DOM 层会拦截所有点击，canvas 的 mousedown 在此阶段不会被触发
            // meta_handleClick 从未在任何历史版本中实现，是 AI 重构时引入的幽灵调用
            return;
        }

        if (this.phase === 'selection') {
            // [fix] 移除幽灵调用 this.ui_handleSelectionClick(pos)
            // selection 阶段的弹珠选择通过 DOM 事件处理（card.onclick -> sys_toggleMarbleSelection）
            // ui_handleSelectionClick 从未在任何历史版本中实现，是 AI 重构时引入的幽灵调用
            return;
        }

        if (this.phase === 'gathering') {
            if (this.fortuneWheel.active && this.fortuneWheel.isPointInside(logicPos)) {
                this.fortuneWheel.spin();
                return;
            }
            const gripPos = new Vec2(this.width / 2, this.height - 40);
            if (pos.dist(gripPos) < 40) {
                this.isTiltingGrip = true;
                this.gripStartPos = pos;
                return;
            }
            // [BUGFIX] 将点击事件转发给 phase_handleInputStart 以触发球的发射
            this.phase_handleInputStart(logicPos);
            return;
        }

        if (this.phase === 'combat') {
            this.phase_handleInputStart(logicPos);
        }
    },

    /**
     * @method input_handleInputMove
     * @description 处理输入移动（鼠标移动/触摸移动）。
     */
    input_handleInputMove(pos, e) {
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset);
        this.lastMousePos = logicPos;

        // 战斗拖拽瞄准
        if (this.isDragging) {
            this.dragCurrent = logicPos;
            e.preventDefault();
            return;
        }

        // 收集阶段 - 手动拖拽倾斜
        if (this.phase === 'gathering' && this.isTiltingGrip && !this.boardTilt.enabled) {
            e.preventDefault();
            const deltaX = pos.x - this.gripStartPos.x;
            const deltaY = pos.y - this.gripStartPos.y;
            const sensitivity = 0.005;
            this.boardTilt.target.x = Math.max(-1, Math.min(1, deltaX * sensitivity));
            this.boardTilt.target.y = Math.max(-1, Math.min(1, deltaY * sensitivity));
            return;
        }

        // 鼠标悬停倾斜（PC 端体验优化）
        if ((this.phase === 'gathering' || this.phase === 'combat') && !this.isTiltingGrip && !this.boardTilt.enabled) {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            this.boardTilt.target.x = ((pos.x - centerX) / centerX) * 0.3;
            this.boardTilt.target.y = ((pos.y - centerY) / centerY) * 0.3;
        }

        // 战斗阶段悬浮检测
        if (this.phase === 'combat' && !this.ui.isOpen) {
            this.input_checkEnemyHover(logicPos);
        }
    },

    /**
     * @method input_handleInputEnd
     * @description 处理输入结束（松手发射）。
     */
    input_handleInputEnd(pos, e) {
        if (this.isDragging) {
            this.isDragging = false;
            const cannonPos = new Vec2(this.width / 2, this.height - 80);
            const targetPos = this.lastMousePos;
            const aimVector = targetPos.sub(cannonPos);
            if (aimVector.y < -20) {
                this.sys_resetMultiplier();
                this.pendingFireVelocity = aimVector.norm().mult(12);
                this.isChargingShot = true;
                this.chargeProgress = 0;
                audio.playTone(800, 'sine', 0.1, 0.1);
            }
        }

        if (this.isTiltingGrip) {
            this.isTiltingGrip = false;
            if (!this.boardTilt.enabled) {
                this.boardTilt.target = { x: 0, y: 0 };
            }
        }
    },

    /**
     * @method input_checkDefeat
     * @description 检查是否有敌人越过失败线。
     * @returns {boolean} 是否失败。
     */
    input_checkDefeat() {
        const viewShiftY = this.boardTilt.current.y * -20;
        for (let e of this.enemies) {
            if (e.active && (e.pos.y + viewShiftY) > this.defeatLineY) {
                // [难度平衡] Boss 越线：触发怜悯掉落
                if (e.type === 'boss') {
                    this._triggerPityDrop(e);
                }
                return true;
            }
        }
        return false;
    },

    /**
     * @method _triggerPityDrop
     * @description [难度平衡] Boss 越线时触发怜悯掉落，生成一个克制属性符文。
     * @param {Enemy} bossEnemy - 越线的 Boss 实体
     */
    _triggerPityDrop(bossEnemy) {
        try {
            // 1. 找到玩家当前 buildVector 中占比最高的属性
            // 直接使用导入的 loot_calcRuneDrop 函数，它内部会调用 _calcBuildVector
            // 这里我们手动计算 buildVector，以便找到主属性
            const attrTotals = {};
            const history = this.roundDamageHistory;
            if (history && history.length > 0) {
                const recentHistory = history.slice(-5);
                for (const roundRecord of recentHistory) {
                    if (roundRecord.shots && Array.isArray(roundRecord.shots)) {
                        for (const shot of roundRecord.shots) {
                            if (shot.byAttr) {
                                for (const [attr, dmg] of Object.entries(shot.byAttr)) {
                                    attrTotals[attr] = (attrTotals[attr] || 0) + (typeof dmg === 'number' ? dmg : 0);
                                }
                            }
                        }
                    }
                }
            }
            const grandTotal = Object.values(attrTotals).reduce((a, b) => a + b, 0);
            const buildVector = {};
            if (grandTotal > 0) {
                for (const [attr, dmg] of Object.entries(attrTotals)) {
                    buildVector[attr] = dmg / grandTotal;
                }
            }
            let dominantAttr = null;
            let maxWeight = -1;
            for (const attr of Object.keys(buildVector)) {
                if (buildVector[attr] > maxWeight) {
                    maxWeight = buildVector[attr];
                    dominantAttr = attr;
                }
            }
            if (!dominantAttr) return;

            // 2. 找到克制属性（COUNTER_MAP 中权重最高的 tag 对应的元素）
            let counterElement = null;
            if (COUNTER_MAP && COUNTER_MAP[dominantAttr]) {
                const counterMap = COUNTER_MAP[dominantAttr];
                let maxCounterWeight = -1;
                for (const [tag, weight] of Object.entries(counterMap)) {
                    if (weight > maxCounterWeight) {
                        maxCounterWeight = weight;
                        counterElement = tag;
                    }
                }
            }

            // 3. 调用 loot_calcRuneDrop 生成1个怜悯符文
            const themeWeights = counterElement ? { [counterElement]: 10.0 } : {};
            const drop = loot_calcRuneDrop(this, { forcedLevel: 1, themeWeights });
            if (drop && drop.runeId) {
                const loot = new RuneLoot(bossEnemy.pos.x, bossEnemy.pos.y, drop.runeId);
                loot.level = drop.level || 1;
                this.runeLootItems.push(loot);
                // 4. 通过 EventBus 显示提示
                eventBus.emit('ui:toast', { message: '💔 怜悯掉落：获得克制符文' });
                showToast('💔 怜悯掉落：获得克制符文');
            }
        } catch (err) {
            console.warn('[_triggerPityDrop] 怜悯掉落失败:', err);
        }
    },

    /**
     * @method input_checkEnemyHover
     * @description 检测鼠标/触摸位置是否悬浮在敌人上。
     */
    input_checkEnemyHover(pos) {
        if (this.phase !== 'combat' || this.isEnemyTurn) return null;
        let hit = null;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.active) continue;
            const halfW = e.width / 2;
            const halfH = e.height / 2;
            if (pos.x >= e.pos.x - halfW && pos.x <= e.pos.x + halfW &&
                pos.y >= e.pos.y - halfH && pos.y <= e.pos.y + halfH) {
                hit = e;
                break;
            }
        }
        if (hit) {
            this.ui.showEnemyInfo(hit);
        }
        return hit;
    },

};
