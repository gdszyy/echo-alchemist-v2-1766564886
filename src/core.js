/**
 * core.js - 游戏核心引擎层 (重构版 v2 - EventBus 架构)
 * 
 * 变更记录：
 * - 引入 EventBus 事件总线，挂载到 Game 实例
 * - 延迟初始化 SoundManager（首次用户交互后）
 * - 移除 window.audio 全局依赖
 * - 通过 _setAudioInstance 注入音频实例到 audio.js 的代理
 * - 通过 setAudioProvider 注入音频实例到 entities.js
 */

import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { RUNE_DB, RUNEWORD_DB, COUNTER_MAP } from './rune_config.js';

import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, RuneLoot, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba,
    setAudioProvider
} from './entities.js';

import { UIManager, TrainingGround, TruthBook } from './systems.js';

// 导入事件总线
import { eventBus } from './event_bus.js';

// 导入 SoundManager 类和音频代理
import { SoundManager, audio, _setAudioInstance } from './audio.js';

// 导入拆分后的子系统
import { game_system } from './game_system.js';
import { game_phase } from './game_phase.js';
import { combat_system } from './combat_system.js';
import { render_system } from './render_system.js';
import { spawn_system } from './spawn_system.js';
import { ui_system } from './ui_system.js';
// [Task 2.4] 导入拆分后的 UI 子模块
import { hud_system } from './ui/hud.js';
import { shop_system } from './ui/shop.js';
import { rune_launcher_system } from './ui/rune_launcher.js';
import { calc_utils } from './calc_utils.js';
import { tutorial_system } from './tutorial_system.js';
import { game_over_mixin } from './ui/game_over.js';

// ==================== 延迟音频初始化 ====================
let _audioInitialized = false;

/**
 * 初始化音频系统（应在首次用户交互后调用）
 * 解决浏览器 AudioContext 策略限制
 */
function initAudio() {
    if (_audioInitialized) return;
    _audioInitialized = true;
    
    const instance = new SoundManager();
    
    // 注入到 audio.js 的代理层（所有 import { audio } from './audio.js' 的模块自动生效）
    _setAudioInstance(instance);
    
    // 注入到 entities.js（替代旧的 window.audio Proxy 方案）
    setAudioProvider(instance);
    
    // 通过事件总线广播音频就绪
    eventBus.emit('audio:ready', { audio: instance });
    
    console.log('[Core] SoundManager initialized on user interaction');
    return instance;
}

// ==================== 首次交互监听 ====================
function setupAudioInitListener() {
    const handler = () => {
        if (!_audioInitialized) {
            initAudio();
            window.removeEventListener('click', handler);
            window.removeEventListener('touchstart', handler);
            window.removeEventListener('keydown', handler);
        }
    };
    window.addEventListener('click', handler);
    window.addEventListener('touchstart', handler);
    window.addEventListener('keydown', handler);
}

// 立即设置监听
setupAudioInitListener();

class Game {
    constructor() {
        // ==================== [Task 3.3] 组合模式：将子系统方法绑定到实例 ====================
        // 替代原有的 Object.assign(Game.prototype, ...) Mixin 模式。
        // 通过 bind(this) 将各子系统的方法作为实例方法注入，保持 this 指向正确。
        // 各子系统仍以对象字面量形式维护，无需修改子系统文件。
        const _subsystems = [
            game_system, game_phase, combat_system, render_system, spawn_system,
            ui_system, hud_system, shop_system, rune_launcher_system,
            calc_utils, tutorial_system, game_over_mixin
        ];
        for (const subsystem of _subsystems) {
            for (const [key, val] of Object.entries(subsystem)) {
                if (typeof val === 'function') {
                    // 函数：绑定到当前实例，确保 this 指向正确
                    this[key] = val.bind(this);
                } else if (typeof val !== 'undefined') {
                    // 非函数属性（如 _flyEffectPool、_flyEffectMaxNodes）：
                    // 直接赋值到实例（数组/对象会居于实例上，而非原型链）
                    this[key] = Array.isArray(val) ? [...val] : val;
                }
            }
        }

        // ==================== 事件总线挂载 =====================
        this.eventBus = eventBus;
        
        this.variantLevels = { flying_sword: 1 };
        this.marbleSizeBonus=0;
        this.isVisualEffectActive = false;
        this.isWheelSpinning = false;
        this.canvas = document.getElementById('gameCanvas'); 
        this.ctx = this.canvas.getContext('2d');
        this.boardTilt = { current: { x: 0, y: 0 }, target: { x: 0, y: 0 }, enabled: false };
        this.phase = 'meta'; 
        this.marblesPool = []; 
        this.selectedMarbles = []; 
        this.marbleQueue = []; 
        this.ammoQueue = []; 
        this.collectionBeams = [];
        this.skillPoints = 0;
        this.difficultyGrowthFactor = 1.0; 
        this.currentPlayerPower = 0;
        this.pinkPegCount = 0;      
        this.hasCombatWall = false; 
        this.unlockedSlots = ['multicast']; // 初始特殊槽：仅连击槽（技能点槽由符文词条解锁后动态加入）
        this.slotCount = 1; // 初始1个槽位
        this.activeSkills = []; // 当前局内已解锁的技能列表（由符文词条激活驱动）
        this.pegs = []; 
        this.enemies = []; 
        this.specialSlots = []; 
        this.dropBalls = []; 
        this.projectiles = []; 
        this.particles = []; 
        this.shockwaves = []; 
        this.floatingTexts = []; 
        this.rainbowBuffer = []; 
        this.lightningBolts = []; 
        this.pendingShots = []; 
        this.burstQueue = []; 
        this.sonSwordQueue = []; 
        this.swordQis = []; 
        this.ownedRelics = [];
        this.relicSelectionCount = 0; // 遗物选择计数器（用于前三次推荐逻辑）
        this.spores = []; 
        this.fireWaves = []; 
        this.healWaves = []; // 扩散治疗波特效数组
        this.sonSwords = [];
        this.windAnchors = []; 
        this.activeWindMatrices = []; 
        this.windMatrixDuration = 40; 
        this.screenShake = 0; 
        this.isChargingShot = false;    
        this.chargeProgress = 0;        
        this.pendingFireVelocity = null;
        this.isReloading = false;       
        this.reloadProgress = 0;        
        this.orbitalAngle = 0;          
        this.spinBoost = 0;             
        this.showDamageNumbers = true;  
        this.energyOrbs = []; 
        this.fortuneWheel = new FortuneWheel(this);
        this.unlockedWeights = { ...CONFIG.probabilities };
        this.guaranteedNextRound = [];
        this.assimilationBoostRounds = {}; // { marbleType: roundsLeft }
        this.isDragging = false; 
        this.dragStart = new Vec2(0,0); 
        this.dragCurrent = new Vec2(0,0); 
        this.lastMousePos = new Vec2(0,0); 
        this.currentSession = null; 
        this.isTiltingGrip = false;
        this.gripStartPos = new Vec2(0, 0); 
        this.gameOver = false; 
        this.defeatLineY = 570; 
        this.combatGridTopY = 90; // 战斗网格第一行敌人中心 Y（由 sys_resize 动态计算并覆盖）
        this.timeScale = 1.0; 
        this.round = 1; 
        this.score = 0; 
        this.scoreMultiplier = 1.0; 
        this.hudExpanded = false; 
        this.roundDamage = 0; 
        this.prevRoundDamage = 0; 
        this.currentShotDamage = 0; 
        this.currentShotDamageByAttr = {}; 
        this.shotDamageHistory = []; 
        this.shotIdCounter = 0; 
        this.shotDamageMap = new Map(); 
        this.roundDamageHistory = []; 
        this.currentViewingRound = 0; 
        this.isEnemyTurn = false;      
        this.enemyTurnTimer = 0;       
        this.enemyWaveY = 0;       
        this.enemyWaveActive = false; 
        this.waveSpeed = 4;        
        this.waveMomentumTimer = 0;
        this.nextRoundHpMultiplier = 1; 
        this.baseTimeScale = 1.0;
        this.frameDamageAccumulator = 0; 
        this.slowMotionTimer = 0;        
        this.slowMotionThreshold = 100;  
        this.saveData = { currency: 0, runeFragments: 0, upgrades: {}, temporaryUpgrades: {}, unlockedItems: [], highScore: 0 };
        this.runCurrency = 0;   
        // ==================== 本局统计字段 ====================
        this.runKillCount = 0;          // 本局击杀数
        this.runRuneFragmentsGained = 0; // 本局获得的符文碎片数
        this.bossDefeatedLog = [];       // 本局击败的 Boss 记录 [{bossId, bossName, round, isBigBoss}]

        // ==================== 符文词条系统状态变量 ====================
        // Task 1: 数据结构升级 - runeInventory 和 runeGrid 存储对象格式 { id: string, level: number }
        // 例如: { id: 'rune_pyro_1', level: 1 }
        this.runeInventory = [];
        this.runeGrid = Array(9).fill(null);
        this.activeRunewordStats = {};
        this.activeRunewordEffects = {}; // [词条 Hook] effectId -> { level, params } 的映射，供战斗层读取
        this.runeLootItems = [];

        this.sys_loadSaveData();
        this.sys_resize();
        this.sys_setupInputs(); 
        this.currentRows = CONFIG.gameplay.rows; 
        this.boardBottomY = 0;
        // ==================== 钉盘形态遗物状态字段 ====================
        // boardLayout: 异型布局枚举，可选値：
        //   'default'         - 标准交错矩形（默认）
        //   'triangle'        - 三角形布局（顶行最宽，每行递减1列）
        //   'diamond'         - 菱形布局（前半扩展，后半收缩）
        //   'sparse'          - 稀疏间隔（偶数行正常，奇数行减4列居中）
        //   'mirror_sync'     - 镜像同步（列数减2，奇偶行对齐不交错）
        //   'wide_narrow'     - 宽窄交替（偶数行+2列，奇数行-2列）
        this.boardLayout = 'default';
        // [概率分析] 当前布局类型（由 phase_gathering_initPachinko 存储）
        this.currentLayout = 'default';
        // [概率分析] 落点分布缓存（由 _updateDropDistribution 更新）
        this._dropDistribution = null;
        this._heatmapData = null;
        
        // [修复] 确保所有 UI 覆盖层在游戏开始时都被隐藏
        document.querySelectorAll('.ui-overlay').forEach(el => { 
            el.style.display = 'none'; 
            el.classList.add('hidden-phase'); 
            el.classList.remove('active-phase'); 
        });
        
        window.addEventListener('resize', () => { 
            this.sys_resize(); 
            if (this.phase === 'gathering') this.phase_gathering_initPachinko(); 
        });
        this.ui = new UIManager();
        this.truthBook = new TruthBook(this);
        this.trainingGround = new TrainingGround(this);

        // ==================== 注册事件总线监听器 ====================
        this._setupEventListeners();

        // 最后切换到 meta 阶段
        this.phase_switchPhase('meta');

        // 启动游戏主循环
        this.sys_loop();
    }

    /**
     * 注册核心事件监听器
     * 将事件总线与游戏子系统连接
     * @private
     */
    _setupEventListeners() {
        // 阶段变化事件
        this.eventBus.on('phase:change', (data) => {
            // 其他子系统可以监听此事件来响应阶段变化
            // 例如：音频系统可以根据阶段切换背景音乐
        });

        // 伤害事件
        this.eventBus.on('damage:dealt', (data) => {
            // 可用于伤害统计面板的实时更新
            // [充能符文系统] 子弹击中敌人时充能（仅战斗阶段）
            if (this.phase === 'combat' && !data.killed) {
                const hitX = data.hitX || (data.enemy ? data.enemy.pos.x : this.width / 2);
                const hitY = data.hitY || (data.enemy ? data.enemy.pos.y : this.height / 2);
                this.combat_runeCharge_onHit(hitX, hitY, false);
            }
        });

        // 波次推进事件
        this.eventBus.on('wave:advance', (data) => {
            // 可用于触发波次相关的 UI 更新
        });

        // 敌人死亡事件
        this.eventBus.on('enemy:killed', (data) => {
            // 可用于成就系统、掉落系统等
            // [充能符文系统] 击杀敌人时额外充能（仅战斗阶段）
            if (this.phase === 'combat') {
                const hitX = data.hitX || (data.enemy ? data.enemy.pos.x : this.width / 2);
                const hitY = data.hitY || (data.enemy ? data.enemy.pos.y : this.height / 2);
                this.combat_runeCharge_onHit(hitX, hitY, true);
            }
            // [本局统计] 累计击杀数
            this.runKillCount = (this.runKillCount || 0) + 1;
        });

        // 音频就绪事件
        this.eventBus.on('audio:ready', (data) => {
            console.log('[Game] Audio system ready');
        });

        // [难度平衡] Boss 被击杀事件：触发战后高压因子
        this.eventBus.on('boss:defeated', (data) => {
            this.postBossMultiplier = 1.3;
            this.postBossSurgeRoundsLeft = 3;
            console.log('[DifficultyBalance] Boss击杀，战后高压因子激活: x1.3，持续3回合');
            // [本局统计] 记录 Boss 击败日志
            if (!this.bossDefeatedLog) this.bossDefeatedLog = [];
            this.bossDefeatedLog.push({
                bossId:    data.bossId || (data.boss && data.boss.bossType) || 'unknown',
                bossName:  data.bossName || (data.boss && data.boss.bossName) || 'Boss',
                round:     this.round,
                isBigBoss: !!(data.isBigBoss || (data.boss && data.boss.isBigBoss) || false),
            });
            // [Boss 调度] 根据击杀用时计算延期回合数，并预定下一个 Boss
            const cfg = CONFIG.balance.bossRounds;
            const spawnCount = this._bossSpawnCount || 0;
            const delayMaxBossIndex = (cfg && cfg.delayMaxBossIndex) || 3;
            let extraDelay = 0;
            // 第三个 Boss 之后（已生成数量 >= delayMaxBossIndex）不再延期
            if (spawnCount < delayMaxBossIndex) {
                const spawnRound = this._lastBossSpawnRound || this.round;
                const killDuration = this.round - spawnRound; // 击杀用了多少回合
                const fastThreshold = (cfg && cfg.delayFastKillThreshold) || 2;
                const midThreshold  = (cfg && cfg.delayMidKillThreshold)  || 3;
                const fastDelay     = (cfg && cfg.delayFastKillRounds)    || 2;
                const midDelay      = (cfg && cfg.delayMidKillRounds)     || 1;
                if (killDuration <= fastThreshold) {
                    extraDelay = fastDelay;
                } else if (killDuration <= midThreshold) {
                    extraDelay = midDelay;
                }
                if (extraDelay > 0) {
                    console.log(`[BossSchedule] Boss 击杀用时 ${killDuration} 回合，延期 ${extraDelay} 回合`);
                }
            } else {
                console.log(`[BossSchedule] 第 ${spawnCount} 个 Boss 已超过延期限制（${delayMaxBossIndex}），不延期`);
            }
            this.spawn_scheduleNextBoss(extraDelay);
        });

        // [Task 3.2] 注册 UI 层 EventBus 监听器
        // ui_initEventListeners: 全局 UI 事件（色差特效、全屏闪光）
        // hud_initEventListeners: HUD 事件（弹药动画、命中进度、充能符文）
        this.ui_initEventListeners();
        this.hud_initEventListeners();
        // [新手教程] 检测是否为首次游玩，触发教程
        this.tutorial_checkAndStart();
    }
}

// [Task 3.3] 已移除 Object.assign(Game.prototype, ...) Mixin 模式。
// 各子系统方法现在通过构造函数中的 bind(this) 注入为实例方法（组合模式）。
// 详见 .cursor/rules/global.md 第 5 节「子系统扩展规范」。

export { SoundManager, Game, audio, eventBus, initAudio };
