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
import { Vec2, showToast, RuneLoot, Enemy, RewardDropEffect, FieldLootItem } from './entities.js';
import { CONFIG } from './config.js';
import { audio } from './audio.js';
import { loot_calcRuneDrop } from './loot_system.js';
import { COUNTER_MAP, RUNE_DB } from './rune_config.js';
import { eventBus, EVENT_TYPES } from './event_bus.js';

export const game_system = {

    /**
     * @method sys_loop
     * @description 游戏主循环，由 requestAnimationFrame 驱动。
     */
    sys_loop() {
        // ==================== [自适应性能] FPS 采样与等级调整 ====================
        const _now = performance.now();
        if (this._lastFrameTime > 0) {
            const _dt = _now - this._lastFrameTime;
            // 只记录合理范围内的帧时间（5ms ~ 200ms），过滤标签页切换等异常
            if (_dt > 5 && _dt < 200) {
                const _perfCfg = CONFIG.performance;
                const _samples = this._fpsSamples;
                _samples.push(_dt);
                if (_samples.length > _perfCfg.fpsSampleWindow) _samples.shift();
                // 计算滑动平均 FPS
                const _avgDt = _samples.reduce((a, b) => a + b, 0) / _samples.length;
                this.avgFps = Math.round(1000 / _avgDt);

                // 仅在采样窗口满后才开始评估等级（避免启动时误判）
                // 手动模式下跳过自适应调整
                if (_samples.length >= _perfCfg.fpsSampleWindow && !this._perfManualMode) {
                    const _dtSec = _dt / 1000; // 本帧时长（秒），用于计时器累加
                    const _level = this.perfQualityLevel;

                    if (this.avgFps < _perfCfg.fpsThresholdDown && _level !== 'low') {
                        // 连续低帧：累加降级计时器
                        this._perfDownTimer += _dtSec;
                        this._perfUpTimer = 0;
                        if (this._perfDownTimer >= _perfCfg.downgradeHoldSec) {
                            this._perfDownTimer = 0;
                            const _prev = _level;
                            this.perfQualityLevel = _level === 'high' ? 'medium' : 'low';
                            this.shadowBlurEnabled = _perfCfg[this.perfQualityLevel].shadowBlurEnabled !== false;
                            if (CONFIG.debug) console.info(`[Perf] 特效等级降级: ${_prev} → ${this.perfQualityLevel}（平均 FPS: ${this.avgFps}）`);
                        }
                    } else if (this.avgFps > _perfCfg.fpsThresholdUp && _level !== 'high') {
                        // 连续高帧：累加升级计时器
                        this._perfUpTimer += _dtSec;
                        this._perfDownTimer = 0;
                        if (this._perfUpTimer >= _perfCfg.upgradeHoldSec) {
                            this._perfUpTimer = 0;
                            const _prev = _level;
                            this.perfQualityLevel = _level === 'low' ? 'medium' : 'high';
                            this.shadowBlurEnabled = _perfCfg[this.perfQualityLevel].shadowBlurEnabled !== false;
                            if (CONFIG.debug) console.info(`[Perf] 特效等级升级: ${_prev} → ${this.perfQualityLevel}（平均 FPS: ${this.avgFps}）`);
                        }
                    } else {
                        // FPS 处于正常区间，重置两个计时器
                        this._perfDownTimer = 0;
                        this._perfUpTimer = 0;
                    }
                }
            }
        }
        this._lastFrameTime = _now;
        // ==================== [自适应性能] END ====================

        // 暂停时跳过物理更新，但继续请求下一帧以保持 rAF 循环活跃
        if (this.isPaused) {
            requestAnimationFrame(() => this.sys_loop());
            return;
        }

        // [修复-bullet-time] 子弹时间倒计时与恢复
        // combat_system.js 的风系技能（旋风/风道）会把 timeScale 强制设为慢动作并将 slowMotionTimer 设为 5，
        // 但此前没有任何地方倒计时该计时器、也没有任何地方把 timeScale 恢复为 baseTimeScale，
        // 一旦风系特效短时间内连续触发（每 3 tick 重置一次），timeScale 就会永久卡在慢动作上。
        // 这里使用「真实帧」倒计时（不乘 timeScale），到期后强制还原为玩家选择的 baseTimeScale。
        if (this.slowMotionTimer > 0) {
            this.slowMotionTimer -= 1;
            if (this.slowMotionTimer <= 0) {
                this.slowMotionTimer = 0;
                this.timeScale = this.baseTimeScale;
            }
        }
        // 同步 UI 蒙版状态（ui_updateSlowMotion 读取此 flag 控制 #slow-motion-overlay 显隐）
        this.isSlowMotion = this.slowMotionTimer > 0;

        // [promare-hitstop] Hit-feedback 三件套之停帧
        // 由 EventBus(COMBAT_DAMAGE_DEALT/COMBAT_ENEMY_KILLED) 在 core.js 写入 this.hitstopFrames。
        // 停帧期间将本帧 timeScale 强制为 0，让物理与动画全部冻结，仅 UI 层渲染继续。
        // 与 slowMotionTimer 不叠乘——后者按比例缩放、前者按帧暂停，逻辑上正交。
        let effectiveTimeScale = this.timeScale;
        if (this.hitstopFrames && this.hitstopFrames > 0) {
            effectiveTimeScale = 0;
            this.hitstopFrames -= 1;
        }
        const timeScale = effectiveTimeScale;

        // 处理震动衰减
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }
        // [打击感] 高频持续震动（穿透类）：幅度随剩余时间衰减
        if (this._shakeHighFreq && this._shakeHighFreq.duration > 0) {
            const hf = this._shakeHighFreq;
            const ratio = hf.duration / hf.totalDuration;  // 1→0 线性衰减
            const amp = hf.amplitude * ratio;
            shakeX += (Math.random() - 0.5) * amp;
            shakeY += (Math.random() - 0.5) * amp;
            hf.duration--;
            if (hf.duration <= 0) this._shakeHighFreq = null;
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

        // 6. 战场掉落物更新与渲染
        // [BUGFIX] fieldLootItems 已移入 phase_combat_update 的 LAYER 2（实体层）内渲染，
        // 原因：此处无阶段限制，会导致宝石在 selection 等非战斗阶段泄漏显示。
        // 现在由 phase_combat_update 负责 fieldLootItems 的 update 和 draw。

        // 7. 特效与文字层渲染
        this.render_floatingTexts(timeScale);

        // 8. 风属性法阵渲染（仅战斗/试炼阶段）
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

        // 9. [自适应性能] FPS 和性能等级指示层
        this.render_perfOverlay();

        // [promare-flash] Hit-feedback 三件套之全屏白闪
        // 由 EventBus 写入 this.flashOverlay = {color, alpha, frames}。
        // 每帧叠加 fillRect，alpha 衰减；衰减至 <0.02 时清空。
        // @perf-impact: 单次 fillRect 全屏覆盖，<0.1ms / 帧，无 shadowBlur。
        if (this.flashOverlay && this.flashOverlay.alpha > 0.02) {
            const f = this.flashOverlay;
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.globalAlpha = f.alpha;
            this.ctx.fillStyle = f.color || '#FFFFFF';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.restore();
            f.alpha *= 0.7;
            f.frames -= 1;
            if (f.frames <= 0 || f.alpha < 0.02) this.flashOverlay = null;
        }

        // 10. 下一帧请求
        this.ctx.restore();
        requestAnimationFrame(() => this.sys_loop());
    },

    /**
     * @method sys_resize
     * @description 响应窗口大小变化，调整 Canvas 尺寸和游戏布局参数。
     */
     sys_resize() {
        const container = document.getElementById('game-container');
        // [CSS 等比缩放] 宽高均由 CSS 控制：
        //   width: min(100vw, calc(100dvh*9/16), 480px)
        //   aspect-ratio: 9/16  (height 由 CSS 自动计算)
        //   max-height: 100dvh
        // 不再通过 JS 覆盖 height，避免与 aspect-ratio 冲突。
        // 用 getBoundingClientRect() 读取 CSS 计算后的实际尺寸。
        const rect = container.getBoundingClientRect();
        // [BUGFIX] 若 rect.width/height 为 0（CSS 布局未完成），跳过本次 resize，
        // 等待下一帧由 ResizeObserver 或 window.resize 重新触发。
        if (!rect.width || !rect.height) return;
        this.width = this.canvas.width = Math.round(rect.width);
        this.height = this.canvas.height = Math.round(rect.height);

        // 动态调整失败判定线
        // PC 模式下底部面板隐藏，可以缩小安全边距
        const isPCMode = document.body.classList.contains('pc-mode');
        this.defeatLineY = this.height - (isPCMode ? 20 : 120);

        this.enemyWidth = (this.width / CONFIG.gameplay.enemyCols);
        this.enemyHeight = this.enemyWidth;

        // 动态计算战斗网格第一行敌人的中心 Y（避免被顶部半透明栏遮挡）
        // 语义：combatGridTopY = 第一行敌人中心点 Y
        // 计算：顶部栏高度 + 8px 安全间距 + 半个敌人高度（中心点偏移）
        // 这样第一行上边界 = topBarH + 8，恰好在顶部栏下方，且与后续行网格完全对齐
        const topBarEl = document.getElementById('unified-top-bar');
        const topBarH = topBarEl ? topBarEl.getBoundingClientRect().height : 64;
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
                                    'laser', 'bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro', 'echo', 'venom'];
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

        // 新局首个遗物也走 round-start resolver，避免再依赖固定入口。
        this.sys_queueRoundStartReward({ type: 'relic', source: 'run_start', round: this.round });
        // [开局命运选择] 遗物选完后，触发一次标准命运选择（3 枚弹珠），作为开局弹珠配置入口。
        // 使用 chaos_essence 类型复用现有命运选择流程，source 标记为 'run_start' 以便区分来源。
        this.sys_queueRoundStartReward({ type: 'chaos_essence', source: 'run_start', round: this.round });
        this.sys_startRoundStartResolver();
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
        this.assimilationBoostRounds = {}; // { marbleType: roundsLeft }（旧字段，兼容保留）
        this.doubleAssimilationBoostRounds = {};
        this.pendingSelectionMode = null;
        this.selectionMode = 'standard';
        this.bulletCapBonus = 0;
        this.selectionRequiredCount = CONFIG.gameplay.selectionReq || 3;
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        this.relicOverlayReturnState = null;
        this.fateMomentContext = null;
        this.replaceAmmoContext = null; // [tsk-668f3dba] 替换当前子弹阶段上下文
        this._chargedAmmoQueue = null; // [ammo-replace] 充能子弹
        this._lastFiredAmmoSnapshot = null; // [bullet-charge-fix] 上回合实际发射的子弹快照
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
        
        // [动态掉落与保底系统 V2] 重置计数器
        this.essenceSpawnMissCount = 0;  // 连续生成未命中精华的行数
        this.relicSpawnMissCount = 0;    // 连续生成未命中遗物的行数
        this.emergencyCooldown = 0;      // 紧急救援冷却回合计数器
        // [V3 动态遗物保底] 初始化随机阈值：2~4 行（每行=每回合）
        this.nextRelicPityThreshold = 2 + Math.floor(Math.random() * 3);
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
        this.pendingRoundStartRewards = [];
        this._roundStartResolverActive = false;
        this.fieldLootItems = []; // 重置战场持久掉落物，防止跨局残留
        this._roundStartBannerActive = false; // 重置横幅保护标志
        // 重置 炼金火药管平坦伤害加成
        this.flatDamageBonus = 0;
        // [v2 即时感重塑] 重置 混沌契约伤害倍率
        this.chaosPactDamageMult = 1;
        // 重置 敌人动作后符文领取标志
        this._runeClaimPending = false;
        // [难度平衡] 重置战后高压因子
        this.postBossMultiplier = 1.0;
        this.postBossSurgeRoundsLeft = 0;
        // [Task C.2] 重置战后高压期双词缀精英概率提升计数器
        this.postBossRoundsLeft = 0;
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

        // ==================== [v2 钉板模块化] 模块系统状态 ====================
        // 钉板由 4×3 = 12 个模块槽组成，按 row-major 顺序解锁
        // 默认开放全部 12 个槽，预填 std_stagger
        this.unlockedModuleTypes = ['std_stagger', 'dense_stagger', 'bouncer', 'funnel'];
        this.unlockedModuleSlots = CONFIG.gameplay.moduleDefaultSlots || 12;
        this.currentModuleLayout = new Array(
            (CONFIG.gameplay.moduleCols || 4) * (CONFIG.gameplay.moduleRows || 3)
        ).fill('std_stagger');
        // pendingFusions: 模块编辑器关闭时写入；phase_gathering_initPachinko 末尾消费
        // 形如 [{ element: 'pyro', count: 1, runeUid: '...' }]
        this.pendingFusions = [];

        // ==================== [v2 局内商店 + 符文碎片经济] ====================
        this.runFragments = 0;          // 局内当前持有符文碎片
        this.runShopInventory = [];     // 当前刷新结果
        this.runShopRefreshes = 0;      // 已刷新次数
        this._runShopOpenedRound = -1;  // 防止同回合重复打开
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
     * 手动设置渲染性能等级
     * @param {'low'|'medium'|'high'|'auto'} level
     */
    sys_setPerfQuality(level) {
        const perfCfg = CONFIG.performance;
        if (level === 'auto') {
            this._perfManualMode = null;
            this._perfDownTimer = 0;
            this._perfUpTimer = 0;
        } else if (perfCfg[level]) {
            this._perfManualMode = level;
            this.perfQualityLevel = level;
            this.shadowBlurEnabled = perfCfg[level].shadowBlurEnabled !== false;
            this._perfDownTimer = 0;
            this._perfUpTimer = 0;
        }
        if (typeof this.ui_syncPauseSettings === 'function') this.ui_syncPauseSettings();
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
                // [修复-bullet-time] 基于 baseTimeScale（玩家选择的速度）循环，
                // 而不是基于当前 timeScale —— 否则在子弹时间生效期间点击会读到 0.2/0.02 等慢动作值，
                // 导致循环卡到「⏩ x1.0」并把玩家原本选择的 2x/3x 设置丢失。
                if (this.baseTimeScale === 1.0) this.baseTimeScale = 2.0;
                else if (this.baseTimeScale === 2.0) this.baseTimeScale = 3.0;
                else if (this.baseTimeScale === 3.0) this.baseTimeScale = 0.42;
                else this.baseTimeScale = 1.0;
                // 立即生效：强制结束当前的子弹时间，避免风系技能 tick 又把 timeScale 拉回慢动作。
                this.timeScale = this.baseTimeScale;
                this.slowMotionTimer = 0;
                this.isSlowMotion = false;
                speedBtn.innerText = `⏩ x${this.baseTimeScale}`;
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
     * [tsk-668f3dba] 命运时刻（chaos_essence / pure_essence）触发时，如果 ammoQueue 非空，
     * 先进入「替换当前子弹」阶段；否则直接进入原有选择流程。
     */
    sys_initSelectionPhase() {
        const pendingMode = this.pendingSelectionMode;
        const mode = pendingMode?.mode || 'standard';
        if (CONFIG.debug) console.log('[DEBUG][sys_initSelectionPhase] 进入', {
            mode,
            pendingMode: JSON.stringify(pendingMode),
            ammoQueueLen: (this.ammoQueue || []).length,
            phase: this.phase,
            fateMomentContext: JSON.stringify(this.fateMomentContext),
        });

        // [ammo-replace] 已移除命运选择前的替换阶段检测。
        // 替换阶段现在在研磨全部完成后触发（phase_gathering_attemptComplete 中），
        // 展示新研磨的子弹 vs 充能子弹，让玩家选择。

        // [BUGFIX] 先设置 selectionMode / fateMomentContext，再调用 phase_switchPhase，
        // 确保 phase_switchPhase 内部触发的 ui_updateUI 能读到正确状态，
        // 避免渲染出旧的命运选择界面（如上一次的 chaos_essence / pure_essence 卡片）。
        this.selectionMode = mode;
        this.selectionRequiredCount = Math.max(1, pendingMode?.requiredCount || (CONFIG.gameplay.selectionReq || 3) + (this.bulletCapBonus || 0));
        this.fateMomentContext = this.selectionMode === 'standard'
            ? null
            : {
                active: true,
                type: this.selectionMode,
                source: pendingMode?.source || 'unknown',
                round: pendingMode?.round || this.round || 1,
                enemyType: pendingMode?.enemyType || null,
                sourceRewardType: pendingMode?.sourceRewardType || this.selectionMode,
            };
        this.pendingSelectionMode = null;
        // [BUGFIX #7] 在 phase_switchPhase 触发 ui_updateUI 前预先清空 marble grid，
        // 否则 ui_refreshSelectionModeUI 会用新的 selectionMode 文案搭配上一轮残留的卡片
        // DOM，造成「先闪一帧另一种精华内容」的体验问题。
        const _initGridEl = document.getElementById('marble-selection-grid');
        if (_initGridEl) {
            _initGridEl.style.cssText = '';
            _initGridEl.innerHTML = '';
        }
        // 同步清掉旧的 marblesPool / 已选索引，防止 ui_refreshSelectionModeUI 读取到过期数据
        this.marblesPool = [];
        this.selectedMarbles = [];
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;

        this.phase_switchPhase('selection');
        this.spawn_generateMarbleOptions();
        this.selectedMarbles = [];
        const countEl = document.getElementById('selected-count');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const recipeHud = document.getElementById('recipe-hud-container');
        if (countEl) countEl.innerText = '0';
        if (confirmBtn) {
            confirmBtn.disabled = true;
            // [BUGFIX] 上一轮 sys_initReplaceAmmoPhase / ui_renderReplaceAmmoUI 把 confirmBtn.onclick
            // 覆盖为 sys_confirmReplaceAmmo。如果不在新一轮命运时刻强制恢复，
            // 第二/三次触发精华或潮涌类遗物触发的混沌精华时，
            // 玩家点击「接受命运开始炼金」会触发 sys_confirmReplaceAmmo（输出
            // "[sys_confirmReplaceAmmo] replaceAmmoContext 未激活"）而无任何反应。
            confirmBtn.onclick = () => {
                if (typeof this.ui_confirmSelection === 'function') this.ui_confirmSelection();
            };
        }
        if (recipeHud) recipeHud.classList.add('hidden');
        if (typeof this.ui_refreshSelectionModeUI === 'function') this.ui_refreshSelectionModeUI();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    /**
     * @method sys_initReplaceAmmoPhase
     * @description [ammo-replace] 初始化「研磨完成后子弹替换」阶段。
     * 研磨全部完成后触发，展示 6 张卡片：
     *   - 左侧 3 张：新研磨的 recipe（ammoQueue）
     *   - 右侧 3 张：充能子弹（_chargedAmmoQueue）
     * 默认选中右侧 3 张（保持充能子弹），玩家可切换选中。
     * 确认后将选中的子弹写入 ammoQueue，进入战斗。
     */
    sys_initReplaceAmmoPhase() {
        const newRecipes = (this.ammoQueue || []).slice();
        const chargedRecipes = (this._chargedAmmoQueue || []).slice();
        if (CONFIG.debug) console.log('[ammo-replace][sys_initReplaceAmmoPhase] 进入', {
            newRecipes: newRecipes.length,
            chargedRecipes: chargedRecipes.length,
            phase: this.phase,
        });

        // [tsk-bullet-ui] 继承玩家上回合的选择偏好：
        // 1. 通过 _lastReplaceAmmoSignatures 记录玩家上回合实际选中子弹的「特征签名」
        //    （主弹珠类型 + 主属性 + multicast 等级），作为本回合 default 选中的依据。
        // 2. 若签名匹配不到（首次进入或弹珠彻底改变），回退到原默认逻辑：选中所有充能子弹。
        const allRecipes = newRecipes.concat(chargedRecipes);
        const _signatureOf = (r) => {
            if (!r) return '';
            const main = r._marbleType || r.type || 'normal';
            const flags = `${r.explosive ? 'E' : ''}${r.isMatryoshka ? 'M' : ''}${r.isLaser ? 'L' : ''}`;
            const mc = (r.multicast || 0) >= 3 ? 'm' : '';
            const stats = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind']
                .map(k => r[k] || 0).join('-');
            return `${main}|${flags}|${mc}|${stats}`;
        };
        const lastSigs = Array.isArray(this._lastReplaceAmmoSignatures) ? this._lastReplaceAmmoSignatures.slice() : [];
        let defaultSelected;
        if (lastSigs.length > 0) {
            const usedIdx = new Set();
            defaultSelected = [];
            lastSigs.forEach(sig => {
                for (let i = 0; i < allRecipes.length; i++) {
                    if (usedIdx.has(i)) continue;
                    if (_signatureOf(allRecipes[i]) === sig) {
                        defaultSelected.push(i);
                        usedIdx.add(i);
                        break;
                    }
                }
            });
            // 数量不足时用充能子弹补齐
            const maxSelect = Math.max(newRecipes.length, chargedRecipes.length, 3);
            for (let j = 0; j < chargedRecipes.length && defaultSelected.length < maxSelect; j++) {
                const idx = newRecipes.length + j;
                if (!usedIdx.has(idx)) { defaultSelected.push(idx); usedIdx.add(idx); }
            }
        } else {
            // 首次进入：默认选中右侧（充能子弹），索引 newRecipes.length 起
            defaultSelected = chargedRecipes.map((_, i) => newRecipes.length + i);
        }

        this.replaceAmmoContext = {
            active: true,
            newRecipes,          // 新研磨的 recipe（左侧）
            chargedRecipes,      // 充能子弹（右侧）
            selectedIndices: defaultSelected, // 继承上回合或默认选中右侧
        };
        // [tsk-bullet-ui] 修复闪烁：先清空 grid DOM，再切阶段，再渲染 replace UI。
        // 之前顺序是 switch → render，导致 ui_updateUI() 用 ui_refreshSelectionModeUI
        // 闪一帧标准命运选择内容，再被 ui_renderReplaceAmmoUI 覆盖。
        const _gridElPre = document.getElementById('marble-selection-grid');
        if (_gridElPre) {
            _gridElPre.style.cssText = '';
            _gridElPre.innerHTML = '';
        }
        this.phase_switchPhase('selection');
        if (typeof this.ui_renderReplaceAmmoUI === 'function') {
            this.ui_renderReplaceAmmoUI();
        }
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    /**
     * @method sys_confirmReplaceAmmo
     * @description [ammo-replace] 确认子弹替换选择。
     * 将 replaceAmmoContext.selectedIndices 中选中的子弹写入 ammoQueue，然后进入战斗。
     * 卡片索引规则：0~(newRecipes.length-1) 为新研磨，newRecipes.length~ 为充能子弹。
     */
    sys_confirmReplaceAmmo() {
        if (!this.replaceAmmoContext || !this.replaceAmmoContext.active) {
            console.warn('[sys_confirmReplaceAmmo] replaceAmmoContext 未激活');
            return;
        }
        const ctx = this.replaceAmmoContext;
        const newRecipes = ctx.newRecipes || [];
        const chargedRecipes = ctx.chargedRecipes || [];
        const allRecipes = [...newRecipes, ...chargedRecipes];
        const selectedIndices = ctx.selectedIndices || [];

        // 按选中索引构建最终 ammoQueue
        const finalAmmo = selectedIndices
            .filter(i => i >= 0 && i < allRecipes.length)
            .map(i => allRecipes[i]);

        if (CONFIG.debug) console.log('[ammo-replace][sys_confirmReplaceAmmo] 确认替换', {
            selectedIndices,
            finalAmmoCount: finalAmmo.length,
        });

        // [tsk-bullet-ui] 记录玩家本回合实际选中子弹的特征签名，下回合用于继承默认选择。
        const _sigOf = (r) => {
            if (!r) return '';
            const main = r._marbleType || r.type || 'normal';
            const flags = `${r.explosive ? 'E' : ''}${r.isMatryoshka ? 'M' : ''}${r.isLaser ? 'L' : ''}`;
            const mc = (r.multicast || 0) >= 3 ? 'm' : '';
            const stats = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind']
                .map(k => r[k] || 0).join('-');
            return `${main}|${flags}|${mc}|${stats}`;
        };
        this._lastReplaceAmmoSignatures = finalAmmo.map(_sigOf);

        this.ammoQueue = finalAmmo;
        this.replaceAmmoContext = null;
        this._chargedAmmoQueue = null;
        // 恢复滚动容器样式（子弹替换阶段修改过）
        const _gridEl1 = document.getElementById('marble-selection-grid');
        if (_gridEl1) {
            // [BUGFIX] ui_renderReplaceAmmoUI 用 cssText 覆盖了 gridEl 的 display:grid，
            // 必须在此处清空，否则下一轮「接受命运后开始炼金」会继承 flex 布局，导致卡片竖排且高度极小。
            _gridEl1.style.cssText = '';
        }
        if (_gridEl1 && _gridEl1.parentElement) {
            const _p1 = _gridEl1.parentElement;
            _p1.style.overflow = '';
            _p1.style.display = '';
            _p1.style.flexDirection = '';
            _p1.style.flex = '';
            _p1.style.minHeight = '';
            _p1.style.alignItems = '';
            _p1.style.position = ''; // [BUGFIX v2] 清除绝对定位方案设置的 position:relative
        }
        if (typeof this.ui_updateAmmoUI === 'function') this.ui_updateAmmoUI();
        if (typeof this.ui_renderRecipeHUD === 'function') this.ui_renderRecipeHUD();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        // 进入战斗阶段
        if (typeof this.phase_startCombatPhase === 'function') {
            this.phase_startCombatPhase();
        } else {
            this.phase_switchPhase('combat');
        }
    },

    /**
     * @method sys_skipReplaceAmmo
     * @description [ammo-replace] 跳过替换阶段，直接使用新研磨的子弹进入战斗。
     */
    sys_skipReplaceAmmo() {
        if (!this.replaceAmmoContext) return;
        const ctx = this.replaceAmmoContext;
        const newRecipes = ctx.newRecipes || [];
        // 跳过：直接使用新研磨的子弹
        this.ammoQueue = newRecipes.slice();
        // [tsk-bullet-ui] 跳过时也记录签名（取新研磨子弹）以便下次继承
        const _sigOf = (r) => {
            if (!r) return '';
            const main = r._marbleType || r.type || 'normal';
            const flags = `${r.explosive ? 'E' : ''}${r.isMatryoshka ? 'M' : ''}${r.isLaser ? 'L' : ''}`;
            const mc = (r.multicast || 0) >= 3 ? 'm' : '';
            const stats = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind']
                .map(k => r[k] || 0).join('-');
            return `${main}|${flags}|${mc}|${stats}`;
        };
        this._lastReplaceAmmoSignatures = this.ammoQueue.map(_sigOf);
        this.replaceAmmoContext = null;
        this._chargedAmmoQueue = null;
        // 恢复滚动容器样式（子弹替换阶段修改过）
        const _gridEl2 = document.getElementById('marble-selection-grid');
        if (_gridEl2) {
            // [BUGFIX] 同 sys_confirmReplaceAmmo：清空 gridEl 的 inline cssText，恢复 CSS grid 布局。
            _gridEl2.style.cssText = '';
        }
        if (_gridEl2 && _gridEl2.parentElement) {
            const _p2 = _gridEl2.parentElement;
            _p2.style.overflow = '';
            _p2.style.display = '';
            _p2.style.flexDirection = '';
            _p2.style.flex = '';
            _p2.style.minHeight = '';
            _p2.style.alignItems = '';
            _p2.style.position = ''; // [BUGFIX v2] 清除绝对定位方案设置的 position:relative
        }
        if (typeof this.ui_updateAmmoUI === 'function') this.ui_updateAmmoUI();
        if (typeof this.ui_renderRecipeHUD === 'function') this.ui_renderRecipeHUD();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        // 进入战斗阶段
        if (typeof this.phase_startCombatPhase === 'function') {
            this.phase_startCombatPhase();
        } else {
            this.phase_switchPhase('combat');
        }
    },

    /**
     * @method _proceedToFateMomentSelection
     * @description [tsk-668f3dba] 内部辅助：替换阶段完成后进入原有命运时刻选择流程。
     */
    _proceedToFateMomentSelection() {
        const pendingMode = this.pendingSelectionMode;
        const mode = pendingMode?.mode || (this.replaceAmmoContext?.fateMomentMode) || 'chaos_essence';
        if (CONFIG.debug) console.log('[DEBUG][_proceedToFateMomentSelection] 进入', {
            mode,
            pendingMode: JSON.stringify(pendingMode),
            replaceAmmoContext: JSON.stringify(this.replaceAmmoContext),
            phase: this.phase,
        });
        this.selectionMode = mode;
        this.selectionRequiredCount = Math.max(1, pendingMode?.requiredCount || (CONFIG.gameplay.selectionReq || 3) + (this.bulletCapBonus || 0));
        this.fateMomentContext = {
            type: mode,
            source: pendingMode?.source || 'unknown',
            round: pendingMode?.round || this.round || 1,
            enemyType: pendingMode?.enemyType || null,
            sourceRewardType: pendingMode?.sourceRewardType || mode,
        };
        this.pendingSelectionMode = null;
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        this.spawn_generateMarbleOptions();
        this.selectedMarbles = [];
        const countEl = document.getElementById('selected-count');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const recipeHud = document.getElementById('recipe-hud-container');
        if (countEl) countEl.innerText = '0';
        if (confirmBtn) {
            confirmBtn.disabled = true;
            // [tsk-668f3dba 修复] 从替换阶段跳过后，confirmBtn.onclick 被 ui_renderReplaceAmmoUI
            // 覆盖为 sys_confirmReplaceAmmo，必须在此处恢复为 ui_confirmSelection，
            // 否则玩家点击「注入後開始煉金」时会触发错误的处理函数，导致 marbleQueue 为空、
            // 无法进入研磨阶段，直接循环敌人回合。
            confirmBtn.onclick = () => {
                if (typeof this.ui_confirmSelection === 'function') this.ui_confirmSelection();
            };
        }
        if (recipeHud) recipeHud.classList.add('hidden');
        if (typeof this.ui_refreshSelectionModeUI === 'function') this.ui_refreshSelectionModeUI();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    /**
     * @method sys_skipGrindGetRune
     * @description 纯净精华命运时刻「跳过研磨」逻辑：随机获取一个符文，然后进入「单个子弹替换」阶段。
     * 符文等级基于当前回合数：Round 1-5 → Lv1，Round 6-15 → Lv2，Round 16+ → Lv3。
     * 跳过后不得触发 sys_initSelectionPhase() 或 phase_gathering_initPachinko()。
     * [bullet-replace-fix] 不再直接进入战斗：若存在充能子弹（_chargedAmmoQueue 或可由 marbleQueue 编译），
     * 必须调用 sys_initReplaceAmmoPhase 进入替换阶段，让玩家选择保留哪些子弹；仅当没有任何可用子弹时才直接进战斗。
     */
    sys_skipGrindGetRune() {
        if (this.selectionMode !== 'pure_essence') {
            console.warn('[sys_skipGrindGetRune] 只允许在 pure_essence 模式下调用');
            return;
        }
        // 根据回合数确定符文等级
        const round = this.round || 1;
        let forcedLevel = 1;
        if (round >= 16) {
            forcedLevel = 3;
        } else if (round >= 6) {
            forcedLevel = 2;
        }
        // 调用 loot_calcRuneDrop 生成随机符文
        const drop = loot_calcRuneDrop(this, { forcedLevel });
        if (drop && drop.runeId) {
            const runeDef = (RUNE_DB || []).find(r => r.id === drop.runeId);
            const runeName = runeDef ? runeDef.name : drop.runeId;
            const runeIcon = runeDef ? (runeDef.icon || '✦') : '✦';
            this.runeInventory.push({ id: drop.runeId, level: drop.level || forcedLevel });
            if (this.saveData) this.saveData.runeInventory = (this.runeInventory || []).slice();
            showToast(`跳过研磨！获得 ${runeIcon} ${runeName} Lv.${drop.level || forcedLevel}`);
        } else {
            showToast('跳过研磨！（未获得符文）');
        }
        // [bullet-replace-fix] 纯净精华跳过研磨时，应进入「单个子弹替换」阶段（仅展示充能子弹），
        // 让玩家自主决定要保留哪些上回合的子弹，而不是直接拿着这些子弹去发射。
        // 准备右侧（充能子弹）：优先使用 _chargedAmmoQueue，否则把当前 marbleQueue 编译进去。
        if (!this._chargedAmmoQueue || this._chargedAmmoQueue.length === 0) {
            if (this.marbleQueue && this.marbleQueue.length > 0) {
                this._chargedAmmoQueue = this.marbleQueue.map(marbleDef => {
                    const collected = Array.isArray(marbleDef.collected) ? marbleDef.collected : [];
                    const recipe = this.calc_compileCollectionToRecipe(marbleDef, collected, (marbleDef.multicast || 0) > 0);
                    recipe.finalHits = 0;
                    recipe.multicast = marbleDef.multicast || 0;
                    recipe._marbleType = marbleDef.type;
                    return recipe;
                });
            }
        }
        // 跳过研磨没有「新研磨子弹」，左侧 ammoQueue 必须清空
        this.ammoQueue = [];
        // 清理命运时刻上下文和弹珠队列
        this.marbleQueue = [];
        this.activeMarbleIndex = 0;
        this.selectionMode = 'standard';
        this.selectionRequiredCount = (CONFIG.gameplay.selectionReq || 3) + (this.bulletCapBonus || 0);
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        this.fateMomentContext = null;
        this.pendingSelectionMode = null;
        // 存档
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        // [bullet-replace-fix] 有充能子弹时进入「子弹替换」阶段；否则才直接进入战斗。
        if (this._chargedAmmoQueue && this._chargedAmmoQueue.length > 0
            && typeof this.sys_initReplaceAmmoPhase === 'function') {
            this.sys_initReplaceAmmoPhase();
            return;
        }
        // 无充能子弹兜底：清理替换上下文并直接进入战斗
        this._chargedAmmoQueue = null;
        this.replaceAmmoContext = null;
        if (typeof this.phase_startCombatPhase === 'function') {
            this.phase_startCombatPhase();
        } else {
            this.phase_switchPhase('combat');
        }
    },

    /**
     * @method sys_skipChaosEssenceUpgrade
     * @description [chaos-skip-upgrade] 混沌精华命运时刻「跳过 + 子弹老虎机升级」逻辑。
     * 玩家点击「跳过混沌，升级当前子弹」后：
     *   - 三个 slot 对应三枚充能子弹（_chargedAmmoQueue），每个 slot 内容是该子弹「当前拥有的所有属性」（含 multicast）。
     *   - 老虎机滚动随机选中各 slot 的属性。
     *   - 若三个 slot 全部相同，则三枚子弹的对应属性各 +5；否则每枚子弹各自命中的属性 +2。
     *   - 升级后跳过研磨阶段，直接以升级后的子弹进入战斗。
     */
    sys_skipChaosEssenceUpgrade() {
        if (this.selectionMode !== 'chaos_essence') {
            console.warn('[sys_skipChaosEssenceUpgrade] 仅在 chaos_essence 模式下可调用');
            return;
        }
        if (this._chaosSlotMachineActive) {
            return; // 防止动画进行中重复触发
        }
        const charged = Array.isArray(this._chargedAmmoQueue) ? this._chargedAmmoQueue : [];
        if (charged.length === 0) {
            console.warn('[sys_skipChaosEssenceUpgrade] 没有可升级的充能子弹');
            return;
        }
        this._chaosSlotMachineActive = true;

        const STAT_KEYS = ['damage','bounce','pierce','scatter','multicast','cryo','pyro','lightning','laser','flying_sword','wind'];
        const ATTR_LABEL = {
            damage: '伤害', bounce: '反弹', pierce: '穿透', scatter: '散射',
            multicast: '连射', cryo: '冰', pyro: '火', lightning: '雷',
            laser: '激光', flying_sword: '飞剑', wind: '风',
        };

        // 每枚子弹当前拥有（>0）的属性集合
        const slotAttrs = charged.map(recipe => {
            const avail = STAT_KEYS.filter(k => (recipe[k] || 0) > 0);
            return avail.length > 0 ? avail : ['damage'];
        });

        // 预先随机选定每个 slot 的最终命中属性
        const finalPicks = slotAttrs.map(arr => arr[Math.floor(Math.random() * arr.length)]);

        const allSame = finalPicks.length >= 3 && finalPicks.every(p => p === finalPicks[0]);
        const incVal = allSame ? 5 : 1;

        const applyUpgrade = () => {
            if (allSame) {
                const attr = finalPicks[0];
                charged.forEach(r => { r[attr] = (r[attr] || 0) + incVal; });
            } else {
                charged.forEach((r, i) => {
                    const attr = finalPicks[i];
                    r[attr] = (r[attr] || 0) + incVal;
                });
            }
            // 重新生效衍生标记（如 laser>0 时 isLaser 必须为 true）
            charged.forEach(r => { if ((r.laser || 0) > 0) r.isLaser = true; });

            // 升级后的充能子弹直接作为本回合 ammoQueue
            this.ammoQueue = charged.map(r => {
                const recipe = { ...r };
                recipe.finalHits = 0;
                recipe.multicast = r.multicast || 0;
                return recipe;
            });

            // 清理命运时刻 / 替换 / 选择阶段相关上下文，跳过研磨直接进战斗
            this._chargedAmmoQueue = null;
            this.replaceAmmoContext = null;
            this.fateMomentContext = null;
            this.pendingSelectionMode = null;
            this.selectionMode = 'standard';
            this.selectionRequiredCount = ((typeof CONFIG !== 'undefined' && CONFIG.gameplay.selectionReq) || 3) + (this.bulletCapBonus || 0);
            this.selectionInjectedRune = null;
            this.selectionPreviewState = null;
            this.marbleQueue = [];
            this.activeMarbleIndex = 0;

            if (typeof this.ui_updateAmmoUI === 'function') this.ui_updateAmmoUI();
            if (typeof this.ui_renderRecipeHUD === 'function') this.ui_renderRecipeHUD();
            if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();

            this._chaosSlotMachineActive = false;
            if (typeof this.phase_startCombatPhase === 'function') {
                this.phase_startCombatPhase();
            } else {
                this.phase_switchPhase('combat');
            }
        };

        if (typeof this.ui_showChaosBulletSlotMachine === 'function') {
            this.ui_showChaosBulletSlotMachine(slotAttrs, finalPicks, ATTR_LABEL, allSame, applyUpgrade);
        } else {
            applyUpgrade();
        }
    },

    /**
     * @method sys_runInWallClearLottery
     * @description [in-wall-clear-lottery] 围墙内敌人全灭时触发的子弹老虎机抽奖。
     * 复用 `ui_showChaosBulletSlotMachine` 的视觉与命中规则（与跳过混沌精华的抽奖一致），
     * 但额外按「剩余子弹数量」放大每个 slot 的提升幅度（incVal = base + bonusCount）。
     * 抽奖结束后将升级后的子弹携带到下回合（_carryOverAmmo），解除暂停标志，并触发精英援军刷新。
     * @param {Array<Object>} chargedSnapshot 用于抽奖的子弹快照（每个元素是 recipe 副本）。
     * @param {number} [bonusCount=0] 抽奖结算时叠加到 incVal 的剩余子弹数量。
     * @param {Function} [onComplete] 抽奖动画 + 升级应用全部完成后触发的回调。
     */
    sys_runInWallClearLottery(chargedSnapshot, bonusCount = 0, onComplete) {
        const STAT_KEYS = ['damage','bounce','pierce','scatter','multicast','cryo','pyro','lightning','laser','flying_sword','wind'];
        const ATTR_LABEL = {
            damage: '伤害', bounce: '反弹', pierce: '穿透', scatter: '散射',
            multicast: '连射', cryo: '冰', pyro: '火', lightning: '雷',
            laser: '激光', flying_sword: '飞剑', wind: '风',
        };

        const charged = Array.isArray(chargedSnapshot) ? chargedSnapshot.map(r => ({ ...r })) : [];
        if (charged.length === 0) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        const slotAttrs = charged.map(recipe => {
            const avail = STAT_KEYS.filter(k => (recipe[k] || 0) > 0);
            return avail.length > 0 ? avail : ['damage'];
        });
        const finalPicks = slotAttrs.map(arr => arr[Math.floor(Math.random() * arr.length)]);
        const allSame = finalPicks.length >= 3 && finalPicks.every(p => p === finalPicks[0]);
        const baseInc = allSame ? 5 : 1;
        const incVal = baseInc + Math.max(0, bonusCount | 0);

        const applyUpgrade = () => {
            if (allSame) {
                const attr = finalPicks[0];
                charged.forEach(r => { r[attr] = (r[attr] || 0) + incVal; });
            } else {
                charged.forEach((r, i) => {
                    const attr = finalPicks[i];
                    r[attr] = (r[attr] || 0) + incVal;
                });
            }
            charged.forEach(r => { if ((r.laser || 0) > 0) r.isLaser = true; });

            // 把升级后的子弹携带到下一回合（与 perfect-clear-upgrade 同一通道）
            this._carryOverAmmo = charged.map(r => {
                const recipe = { ...r };
                recipe.finalHits = 0;
                recipe.multicast = r.multicast || 0;
                return recipe;
            });

            if (typeof this.ui_updateAmmoUI === 'function') this.ui_updateAmmoUI();
            if (typeof this.ui_renderRecipeHUD === 'function') this.ui_renderRecipeHUD();
            if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();

            if (typeof onComplete === 'function') onComplete();
        };

        if (typeof this.ui_showChaosBulletSlotMachine === 'function') {
            this.ui_showChaosBulletSlotMachine(slotAttrs, finalPicks, ATTR_LABEL, allSame, applyUpgrade);
        } else {
            applyUpgrade();
        }
    },

    /**
     * @method sys_queueRoundStartReward
     * @description 将下一回合开始需要统一结算的奖励写入队列。
     */
    sys_queueRoundStartReward(reward = {}) {
        if (!this.pendingRoundStartRewards) this.pendingRoundStartRewards = [];

        const legacyEssenceType = reward.essenceType || reward.essenceKind || reward.mode || null;
        const requestedType = ['relic', 'chaos_essence', 'pure_essence'].includes(reward.type)
            ? reward.type
            : reward.type === 'essence'
                ? (legacyEssenceType === 'pure_essence' ? 'pure_essence' : 'chaos_essence')
                : 'relic';

        if (requestedType === 'relic' && this.pendingRoundStartRewards.some(item => item && item.type === 'relic')) {
            const fallbackType = reward.fallbackRewardType === 'pure_essence'
                ? 'pure_essence'
                : reward.fallbackRewardType === 'chaos_essence'
                    ? 'chaos_essence'
                    : (Math.random() < 0.35 ? 'pure_essence' : 'chaos_essence');
            return this.sys_queueRoundStartReward({ ...reward, type: fallbackType });
        }

        const normalized = {
            type: requestedType,
            source: reward.source || 'unknown',
            round: reward.round || this.round || 1,
            enemyType: reward.enemyType || null,
            enemyMaxHp: reward.enemyMaxHp || 0,
            sourceRelicId: reward.sourceRelicId || null,
            sourceRelicName: reward.sourceRelicName || null,
        };
        this.pendingRoundStartRewards.push(normalized);
        eventBus.emit(EVENT_TYPES.ROUND_START_REWARD_QUEUED, {
            reward: { ...normalized },
            pendingCount: this.pendingRoundStartRewards.length,
        });
        return normalized;
    },

    /**
     * @method sys_preCalcEnemyRewardType
     * @description 敌人生成时预先计算掉落奖励类型并标记到 _pendingRewardType，
     *              供渲染管线在敌人存活期间显示专属视觉光晕。
     *              注意：此方法只做概率计算和标记，不排队奖励（排队在死亡时进行）。
     */
    /**
     * @method sys_determineEnemyReward
     * @description [V3] 回合生成时判定掉落类型。
     *   将所有概率计算、保底判定、战力碾压判定、密度控制、紧急救援全部在此完成。
     *   命中时将 rewardType 写入 enemy.rewardType，死亡时由 sys_tryQueueEnemyRoundReward 直接读取。
     *   保底计数器在此处统一累加和重置，不再在死亡时操作。
     *
     *   [V3 保底算法] 保底触发新增前置条件：
     *   - 计算三回合滑动平均伤害 avgDamage3（via calc_getRecentAverageDamage(3)）
     *   - 计算当前场上所有活跃敌人总 HP（currentTotalHP）
     *   - 计算最近敌人距失败线的格数 x（via defeatLineY / enemyHeight）
     *   - 估算未来 x 行敌人总 HP（futureXRowsHP，使用与 spawn_spawnEnemyRowAt 相同的 HP 公式）
     *   - 仅当 avgDamage3 < (currentTotalHP + futureXRowsHP) 时，保底计数器才触发掉落
     *   - 即玩家伤害不足以清场时才给予保底，战力碾压时不触发保底
     * @param {Enemy} enemy - 当前生成的敌人实体
     * @param {boolean} [isRowRepresentative=false] - 是否为该行的代表敌人（只有代表敌人才进行保底判定）
     */
    sys_determineEnemyReward(enemy, isRowRepresentative = false) {
        if (!enemy || enemy.type === 'boss') return;

        const affixCount = Array.isArray(enemy.affixes) ? enemy.affixes.length : 0;
        const gameplayCfg = CONFIG.gameplay || {};
        const pityCfg = gameplayCfg.dropPity || {};

        // @section:field_reward_density - 第一步：统计场上奖励数量，达硬上限时直接返回
        // --- 1. 场上奖励密度统计 ---
        let fieldRewardCount = 0;
        if (this.enemies) {
            this.enemies.forEach(e => {
                if (e !== enemy && e.active && e.rewardType) fieldRewardCount++;
            });
        }
        if (this.pendingRoundStartRewards) {
            fieldRewardCount += this.pendingRoundStartRewards.length;
        }

        // 硬上限：场上奖励达到硬上限时，强制归零且暂停保底累加
        const hardCap = pityCfg.fieldRewardHardCap || 5;
        if (fieldRewardCount >= hardCap) {
            enemy.rewardType = null;
            return; // 已达硬上限，不进行任何判定也不累加保底
        }

        // @section:power_pressure_eval - 第二步：计算玩家战力比和踪迹血量，评估生存压力
        // --- 2. 战力与生存压力评估 ---
        let powerRatio = 1.0;
        let isPowerCrushing = false;
        let traceRatio = 1.0;

        if (typeof this.combat_calculatePlayerExpectedDamage === 'function') {
            const playerPower = this.combat_calculatePlayerExpectedDamage();
            const b = CONFIG.balance || {};
            const expectedEnemyHp = (b.enemyBaseHp || 30) + (this.round * (b.enemyHpPerRound || 10));
            powerRatio = playerPower / (expectedEnemyHp || 1);
            if (powerRatio >= (pityCfg.powerCrushThreshold || 2.0)) {
                isPowerCrushing = true;
            }
        }

        if (this.traceHp !== undefined && this.traceMaxHp) {
            traceRatio = this.traceHp / this.traceMaxHp;
        }

        // 生存压力公式：战力越弱、踪迹越低则压力越大
        const survivalPressure = Math.max(0, (1.0 - powerRatio) * 0.6 + (1.0 - traceRatio) * 0.4);

        // @section:emergency_relief - 第三步：生存压力超阈时强制标记精华（紧急救援）
        // --- 3. 紧急救援判定（预测性提前送出）---
        // 只有行代表敌人才进行紧急救援判定，防止同一行多个敌人重复触发
        if (isRowRepresentative && !isPowerCrushing && this.emergencyCooldown <= 0) {
            const emergencyThreshold = pityCfg.emergencyReliefThreshold || 0.7;
            if (survivalPressure >= emergencyThreshold) {
                // 紧急救援：强制标记为精华，并启动冷却
                const essenceType = Math.random() < (gameplayCfg.enemyDropPureEssenceChance || 0.35) ? 'pure_essence' : 'chaos_essence';
                enemy.rewardType = essenceType;
                this.emergencyCooldown = pityCfg.emergencyReliefCooldown || 3;
                this.essenceSpawnMissCount = 0;
                console.log(`[DropV2] 紧急救援触发 (pressure=${survivalPressure.toFixed(2)})，标记 ${essenceType}`);
                return;
            }
        }

        // @section:base_drop_chance - 第四步：基础概率 = 基础值 + 回合加成 + 词缀加成
        // --- 4. 基础概率计算 ---
        let baseDropChance = (gameplayCfg.enemyDropBaseChance || 0.04)
            + Math.min(this.round || 1, gameplayCfg.enemyDropRoundBonusCap || 20) * (gameplayCfg.enemyDropRoundBonus || 0.004)
            + affixCount * (gameplayCfg.enemyDropAffixBonus || 0.03);

        // @section:dynamic_multiplier - 第五步：战力/血量/密度四维动态倍率修正
        // --- 5. 动态倍率修正 ---
        let dynamicMult = 1.0;

        // A. 玩家战力（战力越低，掉率越高）
        if (powerRatio < 1) {
            dynamicMult += (1 - powerRatio) * (pityCfg.playerPowerWeight || 0.5);
        }

        // B. 敌人血量（血量越高，掉率越高）
        const hpBonus = Math.min(1.0, (enemy.maxHp || 0) / (gameplayCfg.enemyDropRelicHighHpThreshold || 120));
        dynamicMult += hpBonus * (pityCfg.enemyHpWeight || 0.3);

        // C. 踪迹血量（踪迹越低，掉率越高）
        if (traceRatio < 0.5) {
            dynamicMult += (0.5 - traceRatio) * 2 * (pityCfg.traceHpWeight || 0.4);
        }

        // D. 场上奖励密度衰减
        const fieldLimit = pityCfg.fieldRewardLimit || 3;
        if (fieldRewardCount >= fieldLimit) {
            const excess = fieldRewardCount - fieldLimit + 1;
            dynamicMult *= Math.pow(pityCfg.fieldRewardDecay || 0.4, excess);
        }

        dynamicMult = Math.max(pityCfg.minChanceMult || 0.5, Math.min(pityCfg.maxChanceMult || 2.5, dynamicMult));
        const finalDropChance = Math.min(gameplayCfg.enemyDropMaxChance || 0.24, baseDropChance * dynamicMult);

        // @section:pity_guarantee - 第六步：三回合平均伤害 vs 威胁HP保底判定（V3算法）
        // --- 6. 保底判定（仅对行代表敌人生效）---
        // 新算法：用三回合平均伤害与（当前敌人总HP + x行敌人总HP）比较
        // x = 最近敌人距玩家（失败线）的格数距离
        let forceDrop = false;
        let forcedType = null;

        if (isRowRepresentative && !isPowerCrushing) {
            // 6a. 计算三回合平均伤害
            const avgDamage3 = typeof this.calc_getRecentAverageDamage === 'function'
                ? this.calc_getRecentAverageDamage(3)
                : 0;

            // 6b. 计算当前场上所有活跃敌人的总 HP
            let currentTotalHP = 0;
            if (this.enemies) {
                for (const e of this.enemies) {
                    if (e.active && !e.isDead && e.hp > 0) {
                        currentTotalHP += e.hp;
                    }
                }
            }

            // 6c. 计算最近敌人距玩家（失败线）的格数 x
            let nearestGridDist = 3; // 默认 3 格（无压力时的保守估算）
            if (this.enemies && this.enemies.length > 0) {
                const defeatY = this.defeatLineY || (this.height - 120);
                const enemyH = this.enemyHeight || 50;
                const viewShiftY = this.boardTilt ? this.boardTilt.current.y * -20 : 0;
                let minPixelDist = Infinity;
                for (const e of this.enemies) {
                    if (!e.active) continue;
                    const ey = e.pos.y + viewShiftY;
                    const dist = defeatY - ey;
                    if (dist < minPixelDist) minPixelDist = dist;
                }
                if (minPixelDist !== Infinity) {
                    nearestGridDist = Math.max(0, Math.round(minPixelDist / enemyH));
                }
            }
            const x = nearestGridDist;

            // 6d. 估算未来 x 行的敌人总 HP
            // 使用与 spawn_spawnEnemyRowAt 相同的公式：(baseHp + round*hpPerRound) * expFactor * diffFactor
            // 每行敌人数量估算为 enemyCols（满列）
            let futureXRowsHP = 0;
            if (x > 0) {
                const b = CONFIG.balance || {};
                const hpExponent = b.hpExponent || 1.08;
                const effectiveRound = this.round || 1;
                const exponentialFactor = Math.pow(hpExponent, Math.max(0, effectiveRound - 5));
                const linearHP = (b.enemyBaseHp || 5) + (effectiveRound * (b.enemyHpPerRound || 4));
                const baseHpPerEnemy = linearHP * exponentialFactor * (this.difficultyGrowthFactor || 1.0);
                const colsPerRow = CONFIG.gameplay.enemyCols || 6;
                futureXRowsHP = baseHpPerEnemy * colsPerRow * x;
            }

            // 6e. 保底触发条件：三回合平均伤害 < (当前总HP + 未来x行总HP) 时才允许保底
            // 即玩家伤害不足以清场，才需要给予保底奖励
            const totalThreatHP = currentTotalHP + futureXRowsHP;
            const isPityEligible = avgDamage3 < totalThreatHP || avgDamage3 === 0;

            if (isPityEligible) {
                // 遗物保底：使用动态随机阈值（2.5~4 回合），不存在则回退到 config 固定值
                const relicPityThreshold = this.nextRelicPityThreshold || (pityCfg.relicSpawnMiss || 12);
                if (this.relicSpawnMissCount >= relicPityThreshold) {
                    forceDrop = true;
                    forcedType = 'relic';
                } else if (this.essenceSpawnMissCount >= (pityCfg.essenceSpawnMiss || 4)) {
                    forceDrop = true;
                    forcedType = Math.random() < (gameplayCfg.enemyDropPureEssenceChance || 0.35) ? 'pure_essence' : 'chaos_essence';
                }
            }

            console.log(`[PityV3] avgDmg3=${avgDamage3.toFixed(1)}, currentHP=${currentTotalHP}, x=${x}, futureHP=${futureXRowsHP.toFixed(1)}, totalThreat=${totalThreatHP.toFixed(1)}, eligible=${isPityEligible}, relic=${this.relicSpawnMissCount}, essence=${this.essenceSpawnMissCount}`);
        }

        // @section:final_reward_type - 第七步：随机抗成判定奖励类型（遗物/混沌/纯净精华）
        // --- 7. 最终判定 ---
        let rewardType = null;

        if (forceDrop) {
            rewardType = forcedType;
        } else if (Math.random() < finalDropChance) {
            const relicChance = Math.min(
                (gameplayCfg.enemyDropRelicBaseChance || 0.12)
                    + affixCount * (gameplayCfg.enemyDropRelicAffixBonus || 0.12)
                    + ((enemy.maxHp || 0) >= (gameplayCfg.enemyDropRelicHighHpThreshold || 120) ? (gameplayCfg.enemyDropRelicHighHpBonus || 0.08) : 0),
                gameplayCfg.enemyDropRelicMaxChance || 0.45
            );
            const essenceType = Math.random() < (gameplayCfg.enemyDropPureEssenceChance || 0.35) ? 'pure_essence' : 'chaos_essence';
            rewardType = Math.random() < relicChance ? 'relic' : essenceType;
        }

        enemy.rewardType = rewardType;

        // --- 8. 保底计数器更新（仅行代表敌人更新）---
        if (isRowRepresentative) {
            if (rewardType === 'relic') {
                this.relicSpawnMissCount = 0;
                this.essenceSpawnMissCount = 0;
                // 遗物掉落后重新随机生成下一次保底阈值（2~4 行，每行=每回合）
                this.nextRelicPityThreshold = 2 + Math.floor(Math.random() * 3);
                console.log(`[PityV3] 遗物掉落，下一次保底阈值设为 ${this.nextRelicPityThreshold} 行`);
            } else if (rewardType === 'pure_essence' || rewardType === 'chaos_essence') {
                this.essenceSpawnMissCount = 0;
                // 精华不重置遗物计数，遗物保底继续累加
                if (!isPowerCrushing) this.relicSpawnMissCount++;
            } else {
                // 未命中：两个计数器都累加（不在碾压和硬上限状态下）
                if (!isPowerCrushing) {
                    this.essenceSpawnMissCount++;
                    this.relicSpawnMissCount++;
                }
            }
        }
    },

    // 兼容别名，防止其他地方调用旧名称
    sys_preCalcEnemyRewardType(enemy) {
        return this.sys_determineEnemyReward(enemy, false);
    },

    /**
     * @method sys_tryQueueEnemyRoundReward
     * @description 敌人死亡后，为下一回合开始登记遗物、混沌精华或纯净精华奖励。
     *              若敌人已有 _pendingRewardType（由生成时预计算），则直接使用该类型排队，
     *              否则重新计算（兼容未经预计算的敌人，如分身）。
     */
    sys_tryQueueEnemyRoundReward(enemy) {
        if (!enemy || enemy.type === 'boss' || enemy._roundStartRewardQueued) return null;
        enemy._roundStartRewardQueued = true;

        // [V2] 优先读取 V2 字段 rewardType，其次兼容旧字段 _pendingRewardType
        let rewardType = enemy.rewardType !== undefined ? enemy.rewardType : (enemy._pendingRewardType || null);

        if (!rewardType) {
            // 分身克隆在生成时跳过了预计算，在死亡时走兼容路径重新计算
            if (!enemy.isClone) return null;

            const affixCount = Array.isArray(enemy.affixes) ? enemy.affixes.length : 0;
            const gameplayCfg = CONFIG.gameplay || {};
            const dropChance = Math.min(
                (gameplayCfg.enemyDropBaseChance || 0.04)
                    + Math.min(this.round || 1, gameplayCfg.enemyDropRoundBonusCap || 20) * (gameplayCfg.enemyDropRoundBonus || 0.004)
                    + affixCount * (gameplayCfg.enemyDropAffixBonus || 0.03),
                gameplayCfg.enemyDropMaxChance || 0.24
            );
            if (Math.random() >= dropChance) return null;

            const relicChance = Math.min(
                (gameplayCfg.enemyDropRelicBaseChance || 0.12)
                    + affixCount * (gameplayCfg.enemyDropRelicAffixBonus || 0.12)
                    + ((enemy.maxHp || 0) >= (gameplayCfg.enemyDropRelicHighHpThreshold || 120) ? (gameplayCfg.enemyDropRelicHighHpBonus || 0.08) : 0),
                gameplayCfg.enemyDropRelicMaxChance || 0.45
            );
            const essenceType = Math.random() < (gameplayCfg.enemyDropPureEssenceChance || 0.35) ? 'pure_essence' : 'chaos_essence';
            rewardType = Math.random() < relicChance ? 'relic' : essenceType;
        }

        const essenceTypeFallback = Math.random() < ((CONFIG.gameplay || {}).enemyDropPureEssenceChance || 0.35) ? 'pure_essence' : 'chaos_essence';
        const queuedReward = this.sys_queueRoundStartReward(
            rewardType === 'relic'
                ? {
                    type: 'relic',
                    source: 'enemy_drop',
                    round: this.round,
                    enemyType: enemy.type || 'normal',
                    enemyMaxHp: enemy.maxHp || 0,
                    fallbackRewardType: essenceTypeFallback,
                }
                : {
                    type: rewardType,
                    source: 'enemy_drop',
                    round: this.round,
                    enemyType: enemy.type || 'normal',
                    enemyMaxHp: enemy.maxHp || 0,
                }
        );

        if (!queuedReward) return null;
        // 同步最终确认的奖励类型（sys_queueRoundStartReward 可能因遗物已满而降级为精华）
        enemy._pendingRewardType = queuedReward.type;

        // [RewardDropEffect] 在敌人死亡位置播放对应类型的掉落特效，并生成持久掉落物实体
        if (enemy.pos) {
            if (!this.rewardDropEffects) this.rewardDropEffects = [];
            this.rewardDropEffects.push(new RewardDropEffect(enemy.pos.x, enemy.pos.y, queuedReward.type));
            
            // 生成持久掉落物实体
            if (!this.fieldLootItems) this.fieldLootItems = [];
            const lootItem = new FieldLootItem(enemy.pos.x, enemy.pos.y, queuedReward.type);
            this.fieldLootItems.push(lootItem);
            
            // 将掉落物坐标存入奖励对象，供后续飞行动画使用
            queuedReward.dropX = enemy.pos.x;
            queuedReward.dropY = enemy.pos.y;
            queuedReward.lootItemId = lootItem.id; // FieldLootItem 构造时已生成唯一 id
        }

        if (queuedReward.type === 'relic') {
            showToast('✨ 敌人掉落了遗物線索，將在下回合開始結算');
        } else if (queuedReward.type === 'pure_essence') {
            showToast('🕊️ 敌人掉落了純淨精華，將在下回合開始觸發命運時刻');
        } else {
            showToast('🎪 敌人掉落了混沌精華，將在下回合開始觸發命運時刻');
        }

        // --- [遗物 Hook] 混沌爆发 (chaos_burst) ---
        // 当掉落物为混沌精华时，对全场所有敌人造成 (回合数 × 2) 的固定真实伤害
        if (queuedReward.type === 'chaos_essence' && this.ownedRelics && this.ownedRelics.includes('chaos_burst')) {
            const burstDmg = (this.round || 1) * 2;
            for (const e of (this.enemies || [])) {
                if (!e || !e.active || e === enemy) continue;
                const r = e.takeDamage(burstDmg);
                if (typeof this.spawn_createFloatingText === 'function') {
                    this.spawn_createFloatingText(e.pos.x, e.pos.y - 18, `混沌爆发 ${burstDmg}`, '#a855f7');
                }
                if (r && r.killed && typeof this.spawn_addScore === 'function') this.spawn_addScore(e.maxHp, e);
            }
            if (typeof this.triggerScreenShake === 'function') this.triggerScreenShake(8);
        }

        return queuedReward;
    },

    /**
     * @method sys_startRoundStartResolver
     * @description 在回合开始前统一结算遗物/精华，再决定是否进入选择阶段。
     */
    sys_startRoundStartResolver() {
        if (CONFIG.debug) console.log('[DEBUG][sys_startRoundStartResolver] 进入', {
            _roundStartResolverActive: this._roundStartResolverActive,
            pendingRoundStartRewards: JSON.stringify(this.pendingRoundStartRewards || []),
            phase: this.phase,
            round: this.round,
        });
        if (this._roundStartResolverActive) return;
        if (!this.pendingRoundStartRewards) this.pendingRoundStartRewards = [];

        // [BUGFIX] 切换到 selection 前先将 selectionMode 重置为 standard，
        // 防止 phase_switchPhase 内部触发的 ui_updateUI 读取上一次的 selectionMode
        // 渲染出旧的命运选择卡片（如 chaos_essence / pure_essence 界面）。
        this.selectionMode = 'standard';
        this.fateMomentContext = null;
        // [tsk-bullet-ui] 修复闪烁：仅当下一个奖励是精华时才切到 selection 阶段。
        // 遗物奖励使用 #phase-relic overlay（z-index:200）覆盖当前阶段，无需切到 selection；
        // 之前无条件 phase_switchPhase('selection') 会让 phase-selection 面板先闪一帧
        // 旧/空的弹珠选择内容，再被 phase-relic overlay 覆盖。
        const _nextRewardType = (() => {
            const r = (this.pendingRoundStartRewards || [])[0];
            if (!r) return null;
            return r.type === 'essence'
                ? (r.essenceType === 'pure_essence' ? 'pure_essence' : 'chaos_essence')
                : r.type;
        })();
        if ((_nextRewardType === 'chaos_essence' || _nextRewardType === 'pure_essence') && this.phase !== 'selection') {
            // 同步预先清空残留的弹珠卡片，避免 ui_updateUI 渲染出旧 DOM 闪一帧
            const _earlyGridEl = document.getElementById('marble-selection-grid');
            if (_earlyGridEl) {
                _earlyGridEl.style.cssText = '';
                _earlyGridEl.innerHTML = '';
            }
            this.phase_switchPhase('selection');
        }
        this._roundStartResolverActive = true;
        eventBus.emit(EVENT_TYPES.ROUND_START_RESOLUTION_STARTED, {
            round: this.round || 1,
            pendingCount: this.pendingRoundStartRewards.length,
        });

        while (this.pendingRoundStartRewards.length > 0) {
            const reward = this.pendingRoundStartRewards.shift();
            if (!reward) continue;

            const rewardType = reward.type === 'essence'
                ? (reward.essenceType === 'pure_essence' ? 'pure_essence' : 'chaos_essence')
                : reward.type;

            if (rewardType === 'relic') {
                const startSelection = () => {
                    // [BUGFIX tsk-agnet-stage] 必须在 loot 飞行动画 callback 内才清除 resolver 标志，
                    // 而不是动画播放前。否则在动画播放（300~600ms）期间 _roundStartResolverActive=false
                    // 且遗物 overlay 尚未挂上 active-phase，phase_combat_update 在 ammoQueue 为空时
                    // 会误触发敌人回合，表现为「打出最后一发子弹后下一个阶段不进入」。
                    this._roundStartResolverActive = false;
                    if (typeof this.ui_showRelicSelection === 'function') {
                        this.ui_showRelicSelection({ resumeTarget: 'round_start_resolver', source: reward.source || 'unknown' });
                    }
                };

                // 检查是否有掉落坐标，播放飞行动画
                if (reward.dropX !== undefined && reward.dropY !== undefined) {
                    // 移除场上的掉落物实体
                    if (this.fieldLootItems) {
                        const item = this.fieldLootItems.find(i => i.id === reward.lootItemId);
                        if (item) item.active = false;
                    }
                    this.ui_playLootToCardAnimation(reward.dropX, reward.dropY, 'relic', startSelection);
                } else {
                    startSelection();
                }
                return;
            }

            if (rewardType === 'chaos_essence' || rewardType === 'pure_essence') {
                const startSelection = () => {
                    this.pendingSelectionMode = {
                        mode: rewardType,
                        requiredCount: rewardType === 'pure_essence' ? 1 : (CONFIG.gameplay.selectionReq || 3),
                        sourceRewardType: rewardType,
                        source: reward.source || 'unknown',
                        round: reward.round || this.round || 1,
                        enemyType: reward.enemyType || null,
                    };
                    this.fateMomentContext = {
                        active: true,
                        type: rewardType,
                        source: reward.source || 'unknown',
                        round: reward.round || this.round || 1,
                        enemyType: reward.enemyType || null,
                        sourceRewardType: rewardType,
                    };
                    // [bullet-charge-fix] 精华触发时，优先使用「上回合实际发射的子弹快照」
                    // 作为充能子弹源（_lastFiredAmmoSnapshot），保证子弹替换后玩家保留的子弹
                    // 在下回合精华触发时仍能正确充能；只有在快照不存在时才回退到 marbleQueue 编译。
                    if (Array.isArray(this._lastFiredAmmoSnapshot) && this._lastFiredAmmoSnapshot.length > 0) {
                        this._chargedAmmoQueue = this._lastFiredAmmoSnapshot.map(r => {
                            const recipe = { ...r };
                            recipe.finalHits = 0;
                            recipe.multicast = r.multicast || 0;
                            return recipe;
                        });
                    } else if (this.marbleQueue && this.marbleQueue.length > 0) {
                        this._chargedAmmoQueue = this.marbleQueue.map(marbleDef => {
                            const collected = Array.isArray(marbleDef.collected) ? marbleDef.collected : [];
                            const recipe = this.calc_compileCollectionToRecipe(marbleDef, collected, (marbleDef.multicast || 0) > 0);
                            recipe.finalHits = 0;
                            recipe.multicast = marbleDef.multicast || 0;
                            recipe._marbleType = marbleDef.type;
                            return recipe;
                        });
                    } else {
                        this._chargedAmmoQueue = null;
                    }
                    this._roundStartResolverActive = false;
                    eventBus.emit(EVENT_TYPES.ROUND_START_RESOLUTION_FINISHED, {
                        round: this.round || 1,
                        pendingCount: this.pendingRoundStartRewards.length,
                    });
                    showToast(rewardType === 'pure_essence' ? '🕊️ 命運時刻：純淨精華' : '🎡 命運時刻：混沌精华');
                    this.sys_initSelectionPhase();
                };

                // 检查是否有掉落坐标，播放飞行动画
                if (reward.dropX !== undefined && reward.dropY !== undefined) {
                    // 移除场上的掉落物实体
                    if (this.fieldLootItems) {
                        const item = this.fieldLootItems.find(i => i.id === reward.lootItemId);
                        if (item) item.active = false;
                    }
                    this.ui_playLootToCardAnimation(reward.dropX, reward.dropY, rewardType, startSelection);
                } else {
                    startSelection();
                }
                return;
            }
        }

        this._roundStartResolverActive = false;
        eventBus.emit(EVENT_TYPES.ROUND_START_RESOLUTION_FINISHED, {
            round: this.round || 1,
            pendingCount: 0,
        });
        // [tsk-f35c6d10] 队列为空时不再进入普通命运选择，改为显示回合开始提示后直接进入研磨阶段
        this.sys_showRoundStartBanner();
    },

    /**
     * @method sys_continueRoundStartResolver
     * @description 遗物选择关闭后继续处理剩余的下一回合开始奖励。
     */
    sys_continueRoundStartResolver() {
        this.sys_startRoundStartResolver();
    },

    /**
     * @method sys_showRoundStartBanner
     * @description 无精华奖励时，在直接进入战斗前显示「第 X 回合开始」大字提示（约 1.5 秒），
     * 同时触发左侧子弹属性面板充能特效。特效等级接入 CONFIG.performance 三档预算。
     * 横幅结束后直接进入战斗阶段（跳过研磨）。
     * 有精华奖励时由 ui_confirmSelection 直接调用 phase_startGatheringPhase。
     * @perf-impact: CSS keyframe 动画（无 Canvas 开销），low 档降级为简单淡入
     */
    sys_showRoundStartBanner() {
        const round = this.round || 1;
        const banner = document.getElementById('round-start-banner');
        const bannerText = document.getElementById('round-start-banner-text');

        // [BUGFIX] 切换到 combat 阶段前，显式重置敌人回合状态。
        // 根因：phase_switchPhase('combat') 会让主循环 sys_loop 立即开始执行
        // phase_combat_update()；若 isEnemyTurn/enemyWaveActive 未清零，
        // combat_update 中的 playerTurnFinished 条件（弹药为空）在横幅期间仍然
        // 满足，会再次调用 phase_enemy_startLogic()，导致敌人在回合开始时
        // 重复行动（与上一回合结束时的行动重复）。
        // [BUGFIX 2] 设置横幅保护标志，阻止 phase_combat_update 在横幅期间触发敌人行动。
        // 该标志在 setTimeout 回调结束、phase_startCombatPhase() 调用前清除。
        this._roundStartBannerActive = true;
        this.isEnemyTurn = false;
        this.enemyWaveActive = false;
        this.enemyTurnTimer = 0;
        this._runeClaimPending = false;

        // 切换到 combat 阶段作为横幅背景，避免残留 selection 界面
        if (this.phase !== 'combat') {
            this.phase_switchPhase('combat');
        }

        // 更新文本
        if (bannerText) bannerText.textContent = `第 ${round} 回合開始`;

        // 根据性能档位选择特效级别
        const perfLevel = this.perfQualityLevel || 'high';
        const perfBudget = CONFIG.performance[perfLevel] || CONFIG.performance.high;
        const useGlow = perfBudget.roundStartBannerGlow !== false; // low 档为 false

        // 显示横幅
        if (banner) {
            banner.classList.remove('round-banner-hide');
            banner.classList.add('round-banner-show');
            if (useGlow) {
                banner.classList.add('round-banner-glow');
            } else {
                banner.classList.remove('round-banner-glow');
            }
        }

        // 触发左侧面板充能特效
        const leftSidebar = document.getElementById('pc-left-sidebar');
        if (leftSidebar) {
            leftSidebar.classList.remove('ammo-panel-charging');
            // 强制重排以重新触发动画
            void leftSidebar.offsetWidth;
            if (useGlow) {
                leftSidebar.classList.add('ammo-panel-charging');
            } else {
                leftSidebar.classList.add('ammo-panel-charging-simple');
            }
        }

        // 1.5 秒后隐藏横幅并直接进入战斗阶段（无精华时跳过研磨）
        setTimeout(() => {
            if (banner) {
                banner.classList.remove('round-banner-show', 'round-banner-glow');
                banner.classList.add('round-banner-hide');
            }
            if (leftSidebar) {
                leftSidebar.classList.remove('ammo-panel-charging', 'ammo-panel-charging-simple');
            }
            // [充能] 每回合开始检查 ammoQueue：若为空则尝试充能，保留上回合实际发射子弹的属性，
            // 实现"子弹充能"效果。
            // [bullet-charge-fix] 优先使用「上回合实际发射的子弹快照」作为充能源；
            // 这样子弹替换阶段保留下来的上上回合充能子弹也能正确接续，
            // 否则会用本回合 marbleQueue（玩家未选择/未发射的新研磨子弹）覆盖，导致充能混乱。
            const ammoIsEmpty = !this.ammoQueue || this.ammoQueue.length === 0;
            const hasFiredSnapshot = Array.isArray(this._lastFiredAmmoSnapshot) && this._lastFiredAmmoSnapshot.length > 0;
            const hasMarbleQueue = this.marbleQueue && this.marbleQueue.length > 0;
            if (ammoIsEmpty && (hasFiredSnapshot || hasMarbleQueue)) {
                this.ammoQueue = [];
                if (hasFiredSnapshot) {
                    this._lastFiredAmmoSnapshot.forEach(r => {
                        const recipe = { ...r };
                        recipe.finalHits = 0;
                        recipe.multicast = r.multicast || 0;
                        this.ammoQueue.push(recipe);
                    });
                } else {
                    this.marbleQueue.forEach(marbleDef => {
                        const collected = Array.isArray(marbleDef.collected) ? marbleDef.collected : [];
                        const recipe = this.calc_compileCollectionToRecipe(marbleDef, collected, (marbleDef.multicast || 0) > 0);
                        recipe.finalHits = 0;
                        recipe.multicast = marbleDef.multicast || 0;
                        this.ammoQueue.push(recipe);
                    });
                }
                this.ui_updateAmmoUI && this.ui_updateAmmoUI();
                this.ui_renderRecipeHUD && this.ui_renderRecipeHUD();

                // [Bug 修复] 回合开始充能子弹时，触发充能符文系统特效。
                // 根因：充能子弹是直接重用上回合的 marbleQueue 编译，跳过了研磨阶段，
                // 因此 combat_runeCharge_init() 在 phase_startCombatPhase() 中才会被调用，
                // 而充能特效需要在子弹展示时即时播放，所以在此提前触发。
                // @perf-impact: CSS keyframe 动画（charge-burst / charge-full-flash），无 Canvas 开销
                if (this.combat_runeCharge_levelUp) {
                    // 使用充能升级特效：充能条闪光脱去 + 外壳发光 + 符文槽刷新
                    // 先重置充能状态（避免与上一回合的充能状态混淆）
                    this.runeChargeValue = 0;
                    this.runeChargeLevel = 0;
                    // 触发充能升级特效（会自动抽取并展示当前充能符文）
                    this.combat_runeCharge_levelUp();
                }
            }
            // [BUGFIX 2] 横幅结束，清除保护标志，再进入战斗阶段
            this._roundStartBannerActive = false;
            this.phase_startCombatPhase();
        }, 1500);
    },

    /**
     * @method sys_toggleMarbleSelection
     * @description 切换指定索引弹珠的选中状态（最多 3 个）。
     * @param {number} idx - 弹珠在 marblesPool 中的索引。
     * @param {HTMLElement} cardEl - 弹珠对应的 UI 元素。
     */
    sys_toggleMarbleSelection(idx, cardEl) {
        const required = Math.max(1, this.selectionRequiredCount || CONFIG.gameplay.selectionReq || 3);
        if (this.selectedMarbles.includes(idx)) {
            this.selectedMarbles = this.selectedMarbles.filter(i => i !== idx);
            if (cardEl) cardEl.classList.remove('selected');
            if (this.selectionInjectedRune && this.selectionInjectedRune.marbleIndex === idx) {
                this.selectionInjectedRune = null;
            }
        } else {
            if (required === 1) {
                document.querySelectorAll('#marble-selection-grid .select-card.selected').forEach(el => el.classList.remove('selected'));
                this.selectedMarbles = [idx];
                if (cardEl) cardEl.classList.add('selected');
                if (this.selectionInjectedRune && this.selectionInjectedRune.marbleIndex !== idx) {
                    this.selectionInjectedRune = null;
                }
            } else if (this.selectedMarbles.length < required) {
                this.selectedMarbles.push(idx);
                if (cardEl) cardEl.classList.add('selected');
            }
        }
        const count = this.selectedMarbles.length;
        const countEl = document.getElementById('selected-count');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        if (countEl) countEl.innerText = count;
        if (typeof this.ui_refreshSelectionModeUI === 'function') this.ui_refreshSelectionModeUI();
        else if (confirmBtn) confirmBtn.disabled = count !== required;
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        // 通知教程系统：已选中足够弹珠
        if (count === required) eventBus.emit('tutorial:marbles_ready');
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
        // 取最大值，避免小震动覆盖大震动
        this.screenShake = Math.max(this.screenShake, amount);
    },

    /**
     * @method triggerScreenShakeAdvanced
     * @description 触发高频持续屏幕震动（适用于穿透类效果）。
     *   震动幅度随持续时间线性衰减，与 screenShake 叠加。
     * @param {number} amplitude - 初始震动幅度（像素）
     * @param {number} duration  - 持续帧数
     */
    triggerScreenShakeAdvanced(amplitude, duration) {
        if (!this._shakeHighFreq || amplitude > this._shakeHighFreq.amplitude) {
            this._shakeHighFreq = { amplitude, duration, totalDuration: duration };
        }
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
     * @method _isRuneLauncherOpen
     * @description 判断符文发射器面板当前是否处于「全屏遮罩」状态（即移动端打开浮层）。
     * 兼容两种模式：
     * - 移动端模式：面板为 .ui-overlay 全屏浮层，打开时 style.display = 'flex'，关闭时 = 'none'
     * - PC 模式：面板已被 _ui_migrateRuneLauncherToSidebar 迁入 #pc-right-sidebar 常驻显示，
     *   位于 canvas 之外的独立容器，不会遮挡 canvas，必须返回 false。
     * @returns {boolean} 发射器是否处于全屏遮罩状态
     */
    _isRuneLauncherOpen() {
        const panel = document.getElementById('phase-rune-launcher');
        if (!panel) return false;
        // [BUGFIX tsk-pc-click-block] 通过 DOM 父级直接判断 PC 迁移状态。
        // 旧实现依赖 panel.dataset.pcMigrated === 'true'，但 _ui_movePanelTo 从未写入该标记，
        // 导致 PC 模式下函数永远 fallback 到 style.display 检查。而 _ui_migrateRuneLauncherToSidebar
        // 在迁入侧边栏后会把 style.display 强制设为 'flex'（让发射器常驻），
        // 综合作用使本函数在 PC 模式下永远返回 true，连锁导致：
        //   1) input_handleInputStart/Move/End 全部提前 return —— 主屏幕点击全部被吞；
        //   2) ui_updateUI 中 `if (!launcherVisible)` 分支被跳过 —— 当前阶段的 .ui-overlay
        //      永远不会被重新激活，主屏幕显示为空。
        if (panel.closest('#pc-right-sidebar')) return false;
        // 移动端模式：面板为全屏浮层，通过 style.display 判断
        return panel.style.display !== '' && panel.style.display !== 'none';
    },

    /**
     * @method input_handleInputStart
     * @description 处理输入开始（鼠标按下/触摸开始）。
     */
    input_handleInputStart(pos, e) {
        // [BUGFIX] 符文发射器打开时，屏蔽所有 canvas 输入事件，
        // 防止点击发射器面板穿透到底层 canvas，误触发弹珠发射并推进到战斗阶段。
        if (this._isRuneLauncherOpen()) return;

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
        // [BUGFIX] 符文发射器打开时，屏蔽 canvas 活动输入，防止鼠标移动导致倒斜或甄准逻辑干扰。
        if (this._isRuneLauncherOpen()) return;

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
        // [BUGFIX] 符文发射器打开时，屏蔽 canvas 输入结束事件，防止误触发射。
        if (this._isRuneLauncherOpen()) return;

        if (this.isDragging) {
            this.isDragging = false;
            // [emitter-port] 发射方向必须以发射口为原点（Y 轴上移 22px），
            // 与瞄准引导线（game_phase.js:1812）和子弹生成位置（game_phase.js:1457）一致，
            // 否则瞄准线与实际发射角度会因 22px 视差产生偏差。
            const cannonPos = new Vec2(this.width / 2, this.height - 102);
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
                // [v2 即时感重塑] 混沌契约伤害倍率（持久化避免存档读档后丢失）
                chaosPactDamageMult: this.chaosPactDamageMult || 1,
                // 符文
                runeInventory: (this.runeInventory || []).slice(),
                runeGrid: (this.runeGrid || Array(9).fill(null)).slice(),
                // 弹珠解锁
                unlockedWeights: { ...(this.unlockedWeights || {}) },
                guaranteedNextRound: (this.guaranteedNextRound || []).slice(),
                assimilationBoostRounds: { ...(this.assimilationBoostRounds || {}) },
                doubleAssimilationBoostRounds: { ...(this.doubleAssimilationBoostRounds || {}) },
                pendingSelectionMode: this.pendingSelectionMode ? { ...this.pendingSelectionMode } : null,
                selectionMode: this.selectionMode || 'standard',
                selectionRequiredCount: this.selectionRequiredCount || (CONFIG.gameplay.selectionReq || 3),
                bulletCapBonus: this.bulletCapBonus || 0,
                selectionInjectedRune: this.selectionInjectedRune ? { ...this.selectionInjectedRune } : null,
                selectionPreviewState: this.selectionPreviewState ? { ...this.selectionPreviewState } : null,
                relicOverlayReturnState: this.relicOverlayReturnState ? { ...this.relicOverlayReturnState } : null,
                fateMomentContext: this.fateMomentContext ? { ...this.fateMomentContext } : null,
                replaceAmmoContext: this.replaceAmmoContext ? JSON.parse(JSON.stringify(this.replaceAmmoContext)) : null, // [ammo-replace]
                _chargedAmmoQueue: this._chargedAmmoQueue ? this._chargedAmmoQueue.map(r => ({ ...r })) : null, // [ammo-replace]
                _lastFiredAmmoSnapshot: this._lastFiredAmmoSnapshot ? this._lastFiredAmmoSnapshot.map(r => ({ ...r })) : null, // [bullet-charge-fix]
                // Boss 系统
                bossHistory: (this.bossHistory || []).slice(),
                _pendingBossSpawn: this._pendingBossSpawn ? { ...this._pendingBossSpawn } : null,
                _nextBossRound: this._nextBossRound || null,
                _lastBossSpawnRound: this._lastBossSpawnRound || null,
                _bossSpawnCount: this._bossSpawnCount || 0,
                _pendingBossRelic: this._pendingBossRelic || false,
                _pendingRelicEvent: this._pendingRelicEvent || false,
                pendingRoundStartRewards: (this.pendingRoundStartRewards || []).map(item => ({ ...item })),
                // 难度
                postBossMultiplier: this.postBossMultiplier || 1.0,
                postBossSurgeRoundsLeft: this.postBossSurgeRoundsLeft || 0,
                postBossRoundsLeft: this.postBossRoundsLeft || 0,
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
                // [动态掉落与保底系统 V2] 存档计数器
                essenceSpawnMissCount: this.essenceSpawnMissCount || 0,
                relicSpawnMissCount: this.relicSpawnMissCount || 0,
                emergencyCooldown: this.emergencyCooldown || 0,
                // [V3 动态遗物保底] 存档动态阈值
                nextRelicPityThreshold: this.nextRelicPityThreshold || 15,
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
            this.chaosPactDamageMult = state.chaosPactDamageMult || 1;

            // --- 恢复符文 ---
            this.runeInventory = (state.runeInventory || []).slice();
            this.runeGrid = (state.runeGrid || Array(9).fill(null)).slice();

            // --- 恢复弹珠解锁 ---
            this.unlockedWeights = { ...(state.unlockedWeights || {}) };
            this.guaranteedNextRound = (state.guaranteedNextRound || []).slice();
            this.assimilationBoostRounds = { ...(state.assimilationBoostRounds || {}) };
            this.doubleAssimilationBoostRounds = { ...(state.doubleAssimilationBoostRounds || state.assimilationBoostRounds || {}) };
            this.pendingSelectionMode = state.pendingSelectionMode ? { ...state.pendingSelectionMode } : null;
            this.selectionMode = state.selectionMode || 'standard';
            this.bulletCapBonus = state.bulletCapBonus || 0;
            this.selectionRequiredCount = state.selectionRequiredCount || ((CONFIG.gameplay.selectionReq || 3) + (this.bulletCapBonus || 0));
            this.selectionInjectedRune = state.selectionInjectedRune ? { ...state.selectionInjectedRune } : null;
            this.selectionPreviewState = state.selectionPreviewState ? { ...state.selectionPreviewState } : null;
            this.relicOverlayReturnState = state.relicOverlayReturnState ? { ...state.relicOverlayReturnState } : null;
            this.fateMomentContext = state.fateMomentContext ? { ...state.fateMomentContext } : null;
            this.replaceAmmoContext = state.replaceAmmoContext ? JSON.parse(JSON.stringify(state.replaceAmmoContext)) : null; // [ammo-replace]
            this._chargedAmmoQueue = state._chargedAmmoQueue ? state._chargedAmmoQueue.map(r => ({ ...r })) : null; // [ammo-replace]
            this._lastFiredAmmoSnapshot = state._lastFiredAmmoSnapshot ? state._lastFiredAmmoSnapshot.map(r => ({ ...r })) : null; // [bullet-charge-fix]

            // --- 恢复 Boss 系统 ---
            this.bossHistory = (state.bossHistory || []).slice();
            this._pendingBossSpawn = state._pendingBossSpawn ? { ...state._pendingBossSpawn } : null;
            this._nextBossRound = state._nextBossRound || null;
            this._lastBossSpawnRound = state._lastBossSpawnRound || null;
            this._bossSpawnCount = state._bossSpawnCount || 0;
            this._pendingBossRelic = state._pendingBossRelic || false;
            this._pendingRelicEvent = state._pendingRelicEvent || false;
            this.pendingRoundStartRewards = (state.pendingRoundStartRewards || []).map(item => ({ ...item }));
            if ((state._pendingRelicEvent || state._pendingBossRelic) && !this.pendingRoundStartRewards.some(item => item && item.type === 'relic')) {
                this.pendingRoundStartRewards.push({ type: 'relic', amount: 0, source: 'legacy_save', round: state.round || 1, enemyType: null, enemyMaxHp: 0 });
            }

            // --- 恢复难度 ---
            this.postBossMultiplier = state.postBossMultiplier || 1.0;
            this.postBossSurgeRoundsLeft = state.postBossSurgeRoundsLeft || 0;
            this.postBossRoundsLeft = state.postBossRoundsLeft || 0;
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
            // [动态掉落与保底系统 V2] 恢复计数器
            this.essenceSpawnMissCount = state.essenceSpawnMissCount || 0;
            this.relicSpawnMissCount = state.relicSpawnMissCount || 0;
            this.emergencyCooldown = state.emergencyCooldown || 0;
            // [V3 动态遗物保底] 恢复动态阈值，旧存档没有则随机生成一个
            this.nextRelicPityThreshold = state.nextRelicPityThreshold || (2 + Math.floor(Math.random() * 3));

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
            // [ammo-replace 修复] 必须从存档恢复 marbleQueue，否则精华触发时
            // _chargedAmmoQueue 无法从 marbleQueue 编译（因为 marbleQueue 为空），
            // 导致研磨完成后子弹分配卡片不显示。
            if (state.marbleQueue && state.marbleQueue.length > 0) {
                this.marbleQueue = state.marbleQueue.map(m => ({
                    type: m.type || 'bounce',
                    collected: Array.isArray(m.collected) ? [...m.collected] : [],
                    compiled: m.compiled || false,
                    recipe: m.recipe ? { ...m.recipe } : null,
                    multicast: m.multicast || 0,
                    finalHits: m.finalHits || 0,
                }));
            } else {
                this.marbleQueue = [];
            }
            this.activeMarbleIndex = state.activeMarbleIndex || 0;

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

            // --- 下一回合开始统一结算（包括遗物/精华） ---
            // [tsk-668f3dba] 如果存档时正处于替换阶段，恢复替换 UI
            if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
                this.phase_switchPhase('selection');
                if (typeof this.ui_renderReplaceAmmoUI === 'function') {
                    this.ui_renderReplaceAmmoUI();
                }
            } else {
                this.sys_startRoundStartResolver();
            }

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
