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
import { Vec2, showToast, RuneLoot, Enemy } from './entities.js';
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
        // 暂停时跳过物理更新，但继续请求下一帧以保持 rAF 循环活跃
        if (this.isPaused) {
            requestAnimationFrame(() => this.sys_loop());
            return;
        }
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

        // 动态计算战斗网格第一行敌人的中心 Y（避免被顶部半透明栏遮挡）
        // 语义：combatGridTopY = 第一行敌人中心点 Y
        // 计算：顶部栏高度 + 8px 安全间距 + 半个敌人高度（中心点偏移）
        // 这样第一行上边界 = topBarH + 8，恰好在顶部栏下方，且与后续行网格完全对齐
        const topBarEl = document.getElementById('unified-top-bar');
        const topBarH = topBarEl ? topBarEl.getBoundingClientRect().height : 52;
        this.combatGridTopY = topBarH + 8 + this.enemyHeight / 2;

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

        // ==================== [爽游模式] 新手教程专属配置注入 ====================
        // 仅在新手教程局（_tutorialActive === true）时生效，不影响正常局
        // 在此处根据 _tutorialActive 设置 _isTutorialRun，确保整个 5 回合内爽游配置持续生效
        if (this._tutorialActive) {
            this._isTutorialRun = true;
        }
        if (this._isTutorialRun) {
            // 1. 符文钉：3 个三级风属性 + 3 个三级飞剑属性
            //    使用专属字段存储教程局钉子数量，避免直接修改全局 CONFIG（防止影响正常局）
            //    game_phase.js 的 phase_gathering_initPachinko 会在 round===1 时读取这两个字段
            this._tutorialInitWindPegs = 3;
            this._tutorialInitSwordPegs = 3;

            // 2. 解锁所有弹珠类型（向 unlockedWeights 注入全部权重）
            const allMarbleTypes = ['explosive', 'rainbow', 'resonance', 'matryoshka',
                                    'laser', 'bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro'];
            allMarbleTypes.forEach(type => {
                if (!this.unlockedWeights[type] || this.unlockedWeights[type] === 0) {
                    this.unlockedWeights[type] = 10;
                }
            });

            // 3. 添加倍化遗物（gigantism_relic）
            if (!this.ownedRelics.includes('gigantism_relic')) {
                this.ownedRelics.push('gigantism_relic');
                // 应用倍化遗物效果：弹珠体积增大（与 shop.js 中 permanent_size_up 效果保持一致）
                this.marbleSizeBonus = (this.marbleSizeBonus || 0) + 2.5;
            }

            // 4. 添加三层炼金火药管（flat_damage_up，每层 +2 基础伤害）
            const tubesToAdd = 3;
            for (let i = 0; i < tubesToAdd; i++) {
                this.ownedRelics.push('alchemist_powder_tube');
                this.flatDamageBonus = (this.flatDamageBonus || 0) + 2;
            }

            console.log('[TutorialRun] 爽游配置已注入：wind×3, sword×3, 所有弹珠解锁, 倍化遗物, 炼金火药管×3');
        }
        // ==================== [爽游模式] 结束 ====================

        // 生成初始敌人（使用 combatGridTopY 确保不被顶部半透明栏遮挡）
        const startY = this.combatGridTopY;
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
        // 重置暂停状态
        this.isPaused = false;
        this._pausedFromPhase = null;
        const pauseOverlay = document.getElementById('phase-pause');
        if (pauseOverlay) {
            pauseOverlay.style.display = 'none';
            pauseOverlay.classList.remove('active-phase');
            pauseOverlay.classList.add('hidden-phase');
        }

        // 清空临时增强
        this.saveData.temporaryUpgrades = {};
        this.sys_saveData();

        this.round = 1;
        this.score = 0;
        this.scoreMultiplier = 1.0;

        // 重置解锁权重回初始状态
        this.unlockedWeights = { ...CONFIG.probabilities };
        this.guaranteedNextRound = [];
        this.assimilationBoostRounds = {}; // { marbleType: roundsLeft }
        this.ownedRelics = [];
        
        // 补充遗物相关的重置字段
        this.pinkPegCount = 0;
        this.hasCombatWall = false;
        this.unlockedSlots = ['multicast']; // 初始特殊槽：仅连击槽
        this.slotCount = 1; // 初始1个槽位
        this.activeSkills = []; // 重置已解锁技能列表
        this.marbleSizeBonus = 0;

        // 清空实体
        this.enemies = [];
        this.projectiles = [];
        this.dropBalls = [];
        this.ammoQueue = [];
        this.marbleQueue = [];
        this.energyOrbs = [];
        this.spores = [];
        this.currentRows = CONFIG.gameplay.rows;
        // 钉盘形态遗物状态重置
        this.boardLayout = 'default';

        // Task 1: 数据结构升级 - 局内重置时清空符文库存和网格
        // runeInventory 和 runeGrid 属于局内状态，每局开始时重置
        this.runeInventory = [];
        this.runeGrid = Array(9).fill(null);
        this.activeRunewordStats = {};
        this.activeElementResonances = {};  // [属性共鸣] 重置属性共鸣状态
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
        // [Boss 调度] 重置动态间隔调度状态
        this._nextBossRound = null;      // 下一个 Boss 预定回合
        this._lastBossSpawnRound = null; // 上一个 Boss 生成回合
        this._bossSpawnCount = 0;        // 已生成 Boss 数量
        // 重置 遗物串行标志
        this._pendingBossRelic = false;
        this._pendingRelicEvent = false;
        // [爽游模式] 重置爽游胜利标志（防止下一局正常局也显示胜利标题）
        this._isTutorialRunCleared = false;
        // [爽游模式] 重置爽游局标志（新开一局时始终清除，在 sys_initGameStart 中根据 _tutorialActive 重新设置）
        this._isTutorialRun = false;
        // [爽游模式] 重置教程局钉子数量临时字段
        this._tutorialInitWindPegs = 0;
        this._tutorialInitSwordPegs = 0;
        // 重置 遗物选择计数器（用于前三次推荐逻辑）
        this.relicSelectionCount = 0;
        // 重置 炼金火药管平坦伤害加成
        this.flatDamageBonus = 0;
        // 重置 敌人动作后符文领取标志
        this._runeClaimPending = false;
        // [难度平衡] 重置战后高压因子
        this.postBossMultiplier = 1.0;
        this.postBossSurgeRoundsLeft = 0;
        // [清屏奖励] 重置清屏标志位
        this._prevRoundCleared = false;
        
        // [剑刃风暴] 重置首发子弹相关状态
        this._roundFirstShotId = null;
        this._bladeStormProjectile = null;
        this._bladeStormTimer = 0;
        
        // [本局统计] 重置本局统计字段
        this.runKillCount = 0;
        this.runRuneFragmentsGained = 0;
        this.bossDefeatedLog = [];
        // [词条 Hook] 嗜血初锋 (bloodthirst_growth) - 每局重置击杀计数（跨回合持久）
        this.runewordKillCount = 0;
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
                // 确保 tutorialCompleted 字段存在（存档升级兼容：老存档默认视为已完成，不重复触发教程）
                if (this.saveData.tutorialCompleted === undefined) this.saveData.tutorialCompleted = true;
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
        // 通知教程系统：已选中3枚弹珠
        if (count === 3) eventBus.emit('tutorial:marbles_ready');
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

    // ==================== [局内存档] ====================

    /**
     * @method sys_saveRunState
     * @description 将当前局内关键状态序列化到 localStorage，供刷新后恢复。
     * 应在每回合结算完毕（phase_finalizeRound 末尾）调用。
     */
    sys_saveRunState() {
        try {
            // --- 序列化 enemies ---
            const enemiesData = (this.enemies || []).map(e => {
                const d = {
                    x: e.pos.x, y: e.pos.y,
                    width: e.width, height: e.height,
                    hp: e.hp, maxHp: e.maxHp,
                    type: e.type, affixes: e.affixes ? [...e.affixes] : [],
                    shieldCharges: e.shieldCharges || 0,
                    temp: e.temp || 0,
                    frozenCount: e.frozenCount || 0,
                    berserked: e.berserked || false,
                    rotationIndex: e.rotationIndex || 0,
                    rotationTurnCount: e.rotationTurnCount || 0,
                    swordMarks: e.swordMarks || 0,
                    markTimer: e.markTimer || 0,
                    collisionShape: e.collisionShape || 'aabb',
                    collisionData: null,
                    // Boss 专属
                    bossType: e.bossType,
                    bossName: e.bossName,
                    isBigBoss: e.isBigBoss || false,
                    devourState: e.devourState,
                    devourTimer: e.devourTimer,
                    gapAngle: e.gapAngle,
                    _moveInterval: e._moveInterval,
                    _moveCooldown: e._moveCooldown,
                };
                // 序列化 collisionData（将 Vec2 转为 {x,y}）
                if (e.collisionData) {
                    if (e.collisionShape === 'polygon') {
                        d.collisionData = {
                            vertices: (e.collisionData.vertices || []).map(v => ({ x: v.x, y: v.y }))
                        };
                    } else if (e.collisionShape === 'arc') {
                        d.collisionData = {
                            radius: e.collisionData.radius,
                            startAngle: e.collisionData.startAngle,
                            endAngle: e.collisionData.endAngle,
                            thickness: e.collisionData.thickness,
                        };
                    }
                }
                return d;
            });

            // --- 序列化 pegs（仅保存 type/level/frozenTurns/row/col，坐标由 initPachinko 重建）---
            const pegsData = (this.pegs || []).map(p => ({
                type: p.type,
                level: p.level || 1,
                frozenTurns: p.frozenTurns || 0,
                row: p.row,
                col: p.col,
            }));

            // --- 序列化 marbleQueue（MarbleDefinition 对象）---
            const marbleQueueData = (this.marbleQueue || []).map(m => ({
                type: m.type,
                collected: m.collected ? [...m.collected] : [],
                compiled: m.compiled || false,
                recipe: m.recipe ? { ...m.recipe } : null,
                multicast: m.multicast || 0,
                finalHits: m.finalHits || 0,
            }));

            const state = {
                // 基础
                round: this.round,
                score: this.score,
                scoreMultiplier: this.scoreMultiplier || 1.0,
                // 实体
                enemies: enemiesData,
                pegs: pegsData,
                marbleQueue: marbleQueueData,
                activeMarbleIndex: this.activeMarbleIndex || 0,
                // 遗物
                ownedRelics: (this.ownedRelics || []).slice(),
                pinkPegCount: this.pinkPegCount || 0,
                hasCombatWall: this.hasCombatWall || false,
                unlockedSlots: (this.unlockedSlots || []).slice(),
                slotCount: this.slotCount || 1,
                marbleSizeBonus: this.marbleSizeBonus || 0,
                flatDamageBonus: this.flatDamageBonus || 0,
                // 符文
                runeInventory: (this.runeInventory || []).slice(),
                runeGrid: (this.runeGrid || Array(9).fill(null)).slice(),
                // 弹珠解锁
                unlockedWeights: { ...(this.unlockedWeights || {}) },
                guaranteedNextRound: (this.guaranteedNextRound || []).slice(),
                assimilationBoostRounds: { ...(this.assimilationBoostRounds || {}) },
                // Boss 系统
                bossHistory: (this.bossHistory || []).slice(),
                _pendingBossSpawn: this._pendingBossSpawn ? { ...this._pendingBossSpawn } : null,
                _nextBossRound: this._nextBossRound || null,
                _lastBossSpawnRound: this._lastBossSpawnRound || null,
                _bossSpawnCount: this._bossSpawnCount || 0,
                _pendingBossRelic: this._pendingBossRelic || false,
                _pendingRelicEvent: this._pendingRelicEvent || false,
                // 难度
                postBossMultiplier: this.postBossMultiplier || 1.0,
                postBossSurgeRoundsLeft: this.postBossSurgeRoundsLeft || 0,
                nextRoundHpMultiplier: this.nextRoundHpMultiplier || 1,
                difficultyGrowthFactor: this.difficultyGrowthFactor || 1.0,
                variantLevels: { ...(this.variantLevels || {}) },
                // 钉盘形态
                currentRows: this.currentRows || 0,
                boardLayout: this.boardLayout || 'default',
                // 技能
                skillPoints: this.skillPoints || 0,
                activeSkills: (this.activeSkills || []).map(sk => sk.id || sk),
                // 统计
                runKillCount: this.runKillCount || 0,
                runRuneFragmentsGained: this.runRuneFragmentsGained || 0,
                bossDefeatedLog: (this.bossDefeatedLog || []).slice(),
                roundDamageHistory: (this.roundDamageHistory || []).slice(),
                prevRoundDamage: this.prevRoundDamage || 0,
                // 遗物选择计数
                relicSelectionCount: this.relicSelectionCount || 0,
                // 时间戳
                savedAt: Date.now(),
            };
            localStorage.setItem('echo_alchemist_run_state', JSON.stringify(state));
            console.log(`[RunSave] 回合 ${this.round} 存档成功`);
        } catch (e) {
            console.error('[RunSave] 存档失败:', e);
        }
    },

    /**
     * @method sys_clearRunState
     * @description 清除局内存档（游戏结束或新开一局时调用）。
     */
    sys_clearRunState() {
        localStorage.removeItem('echo_alchemist_run_state');
        console.log('[RunSave] 局内存档已清除');
    },

    /**
     * @method sys_hasRunState
     * @description 检查是否存在可恢复的局内存档。
     * @returns {boolean}
     */
    sys_hasRunState() {
        return !!localStorage.getItem('echo_alchemist_run_state');
    },

    /**
     * @method sys_loadRunState
     * @description 从 localStorage 读取局内存档并恢复游戏状态，然后进入选牌阶段。
     * 由 meta_continueRun() 调用。
     */
    sys_loadRunState() {
        const raw = localStorage.getItem('echo_alchemist_run_state');
        if (!raw) {
            console.warn('[RunSave] 无局内存档可恢复');
            return false;
        }
        try {
            const state = JSON.parse(raw);

            // --- 先重置游戏（清空实体、重置 UI）---
            this.sys_resetGame();
            // 注入局外升级（确保 CONFIG 参数正确）
            this.meta_applyUpgrades();

            // --- 恢复基础字段 ---
            this.round = state.round || 1;
            this.score = state.score || 0;
            this.scoreMultiplier = state.scoreMultiplier || 1.0;

            // --- 恢复遗物 ---
            this.ownedRelics = (state.ownedRelics || []).slice();
            this.pinkPegCount = state.pinkPegCount || 0;
            this.hasCombatWall = state.hasCombatWall || false;
            this.unlockedSlots = (state.unlockedSlots || ['multicast']).slice();
            this.slotCount = state.slotCount || 1;
            this.marbleSizeBonus = state.marbleSizeBonus || 0;
            this.flatDamageBonus = state.flatDamageBonus || 0;

            // --- 恢复符文 ---
            this.runeInventory = (state.runeInventory || []).slice();
            this.runeGrid = (state.runeGrid || Array(9).fill(null)).slice();

            // --- 恢复弹珠解锁 ---
            this.unlockedWeights = { ...(state.unlockedWeights || {}) };
            this.guaranteedNextRound = (state.guaranteedNextRound || []).slice();
            this.assimilationBoostRounds = { ...(state.assimilationBoostRounds || {}) };

            // --- 恢复 Boss 系统 ---
            this.bossHistory = (state.bossHistory || []).slice();
            this._pendingBossSpawn = state._pendingBossSpawn ? { ...state._pendingBossSpawn } : null;
            this._nextBossRound = state._nextBossRound || null;
            this._lastBossSpawnRound = state._lastBossSpawnRound || null;
            this._bossSpawnCount = state._bossSpawnCount || 0;
            this._pendingBossRelic = state._pendingBossRelic || false;
            this._pendingRelicEvent = state._pendingRelicEvent || false;

            // --- 恢复难度 ---
            this.postBossMultiplier = state.postBossMultiplier || 1.0;
            this.postBossSurgeRoundsLeft = state.postBossSurgeRoundsLeft || 0;
            this.nextRoundHpMultiplier = state.nextRoundHpMultiplier || 1;
            this.difficultyGrowthFactor = state.difficultyGrowthFactor || 1.0;
            this.variantLevels = { ...(state.variantLevels || { flying_sword: 1 }) };

            // --- 恢复钉盘形态 ---
            this.currentRows = state.currentRows || 0;
            this.boardLayout = state.boardLayout || 'default';

            // --- 恢复技能 ---
            this.skillPoints = state.skillPoints || 0;
            this.ui.updateSkillPoints(this.skillPoints);

            // --- 恢复统计 ---
            this.runKillCount = state.runKillCount || 0;
            this.runRuneFragmentsGained = state.runRuneFragmentsGained || 0;
            this.bossDefeatedLog = (state.bossDefeatedLog || []).slice();
            this.roundDamageHistory = (state.roundDamageHistory || []).slice();
            this.prevRoundDamage = state.prevRoundDamage || 0;
            this.relicSelectionCount = state.relicSelectionCount || 0;

            // --- 恢复 enemies ---
            this.enemies = (state.enemies || []).map(d => {
                const e = new Enemy(d.x, d.y, d.width, d.height, d.hp, d.maxHp, d.type, d.affixes || []);
                e.shieldCharges = d.shieldCharges || 0;
                e.temp = d.temp || 0;
                e.frozenCount = d.frozenCount || 0;
                e.berserked = d.berserked || false;
                e.rotationIndex = d.rotationIndex || 0;
                e.rotationTurnCount = d.rotationTurnCount || 0;
                e.swordMarks = d.swordMarks || 0;
                e.markTimer = d.markTimer || 0;
                e.collisionShape = d.collisionShape || 'aabb';
                // 恢复 collisionData（将 {x,y} 还原为 Vec2）
                if (d.collisionData) {
                    if (d.collisionShape === 'polygon') {
                        e.collisionData = {
                            vertices: (d.collisionData.vertices || []).map(v => new Vec2(v.x, v.y))
                        };
                    } else if (d.collisionShape === 'arc') {
                        e.collisionData = { ...d.collisionData };
                    }
                }
                // Boss 专属
                if (d.bossType) {
                    e.bossType = d.bossType;
                    e.bossName = d.bossName;
                    e.isBigBoss = d.isBigBoss || false;
                }
                if (d.devourState !== undefined) e.devourState = d.devourState;
                if (d.devourTimer !== undefined) e.devourTimer = d.devourTimer;
                if (d.gapAngle !== undefined) e.gapAngle = d.gapAngle;
                if (d._moveInterval !== undefined) e._moveInterval = d._moveInterval;
                if (d._moveCooldown !== undefined) e._moveCooldown = d._moveCooldown;
                e.justSpawned = false; // 恢复时不播放入场动画
                return e;
            });

            // --- 恢复 marbleQueue（重建 MarbleDefinition 对象）---
            // 注意：恢复后进入 selection 阶段，marbleQueue 会被重新生成
            // 此处恢复是为了保证 UI 一致性（如果需要显示上回合队列）
            this.marbleQueue = [];
            this.activeMarbleIndex = 0;

            // --- 恢复 pegs（通过 initPachinko 重建，然后覆盖 type/level/frozenTurns）---
            // 先初始化钉盘（生成正确数量的钉子）
            this.phase_gathering_initPachinko(false);
            // 再将存档中的 type/level/frozenTurns 覆盖到对应钉子
            if (state.pegs && state.pegs.length > 0 && this.pegs) {
                const minLen = Math.min(state.pegs.length, this.pegs.length);
                for (let i = 0; i < minLen; i++) {
                    const saved = state.pegs[i];
                    const peg = this.pegs[i];
                    if (peg && saved) {
                        if (saved.type !== 'pink') {
                            peg.type = saved.type || 'normal';
                        }
                        peg.level = saved.level || 1;
                        peg.frozenTurns = saved.frozenTurns || 0;
                    }
                }
            }

            // --- 更新 UI ---
            document.getElementById('round-num').innerText = this.round;
            this.ui_updateRuneCountDisplay();
            this.ui_updateMetaCurrency();

            // --- 恢复符文词条效果（activeRunewordStats / activeRunewordEffects / activeSkills）---
            // ui_updateRuneGrid 需要 DOM 中的 rune-cell-* 元素存在
            // 这些元素在 ui_openRuneLauncher 时才会创建，此处用 setTimeout 延迟执行
            setTimeout(() => {
                if (typeof this.ui_initRuneGrid === 'function') this.ui_initRuneGrid();
                if (typeof this.ui_updateRuneGrid === 'function') this.ui_updateRuneGrid();
            }, 100);

            // --- 进入选牌阶段 ---
            this.sys_initSelectionPhase();

            showToast(`✅ 已恢復 Round ${this.round} 的進度！`);
            console.log(`[RunSave] 成功恢復回合 ${this.round} 的存档`);
            return true;
        } catch (e) {
            console.error('[RunSave] 恢复存档失败:', e);
            this.sys_clearRunState();
            return false;
        }
    },

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

    /**
     * @method _calcDesperationMult
     * @description [绝境之刃] 计算当前最近敌人距离失败线的格数，返回伤害倍率。
     * 距离 0 格: x1.5，距离 1 格: x1.25，距离 2 格: x1.125，距离 3 格以上: x1.0
     * @returns {number} 伤害倍率（最小为 1.0）
     */
    _calcDesperationMult() {
        if (!this.enemies || this.enemies.length === 0) return 1.0;
        const viewShiftY = this.boardTilt ? this.boardTilt.current.y * -20 : 0;
        const defeatY = this.defeatLineY || (this.height - 120);
        const enemyH = this.enemyHeight || 50;

        // 找到最靠近失败线的活跃敌人
        let minDist = Infinity;
        for (const e of this.enemies) {
            if (!e.active) continue;
            const ey = e.pos.y + viewShiftY;
            const dist = defeatY - ey; // 距离失败线的像素距离
            if (dist < minDist) minDist = dist;
        }

        // 将像素距离转换为格数（以 enemyHeight 为一格）
        const gridDist = minDist / enemyH;

        // 按格数返回倍率：0格 +50%, 1格 +25%, 2格 +12.5%, 3格以上无加成
        if (gridDist < 0.5)       return 1.50;  // 0 格（几乎贴着失败线）
        else if (gridDist < 1.5)  return 1.25;  // 1 格
        else if (gridDist < 2.5)  return 1.125; // 2 格
        else if (gridDist < 3.5)  return 1.0625;// 3 格（轻微加成，让玩家感知到效果）
        return 1.0; // 3 格以上：无加成
    },
};
