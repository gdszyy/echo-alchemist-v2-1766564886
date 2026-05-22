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
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, TriangleSideWheel, GhostPeg, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, RuneLoot, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba,
    setAudioProvider
} from './entities.js';

import { UIManager, TrainingGround, TruthBook } from './systems.js';

// 导入事件总线
import { eventBus } from './event_bus.js';
import { spawnPromareBurst, spawnRadialImpact, ensurePromareGlobals } from './render/promare_burst.js';
import { spawnPromareKillExplosion, spawnPromareOnomatopoeia } from './render/promare_explosion.js';

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
import { run_shop } from './ui/run_shop.js';
import { rune_launcher_system } from './ui/rune_launcher.js';
import { calc_utils } from './calc_utils.js';
import { tutorial_system } from './tutorial_system.js';
import { game_over_mixin } from './ui/game_over.js';
import { preloadAllSprites } from './render/sprite_renderer.js'; // [Phase 5B] 预加载所有 Sprite Sheet
// [3D-Main M1] 引入 3D 渲染管线（仅背景层）。任何加载/初始化失败都会被静默降级到 2D-only。
import { Renderer3D } from './render3d/Renderer3D.js';

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
            calc_utils, tutorial_system, game_over_mixin,
            run_shop
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
        this._continuousLaserFiring = false;  // [照射词条] 持续照射状态标志
        this._continuousLaserState = null;    // [照射词条] 持续照射状态机数据
        this._laserFadeOutFrames = 0;         // [修复] 激光淡出等待帧计数（替代 setTimeout）
        this._roundFirstShotId = null;        // [剑刃风暴] 回合首发子弹ID
        this._bladeStormProjectile = null;    // [剑刃风暴] 绑定的首发子弹
        this._bladeStormTimer = 0;            // [剑刃风暴] 触发计时器
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
        // [Perf] 粒子分模式计数表 - 替代 this.particles.filter(p=>p.mode==='X').length 的 O(N) 扫描
        // 维护契约：所有 push 必走 spawn_createParticle / spawn_pushParticleWithLimit；
        // 所有删除必走 game_phase.js 的两指针压缩循环（同步 -- 计数）。
        this.particleCounts = {
            wind_slash: 0, line: 0, ember: 0, mist: 0, shard: 0, spark: 0, smoke: 0, venom: 0,
            // [Promare] 新 mode 计数器
            pyro_cone: 0, cryo_oct: 0, thunder_z: 0, pierce_lance: 0, bounce_hex: 0,
            scatter_star: 0, damage_diamond: 0, venom_tri: 0, echo_ring: 0, radial_spoke: 0,
        };
        // [Perf] 粒子对象池 - 复用 Particle 实例，规避每帧 50-100 次 new 触发的 GC 停顿
        this._particlePool = [];
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
        this.pendingRoundStartRewards = []; // 下一回合开始统一结算的延迟奖励队列
        this._roundStartResolverActive = false;
        this._roundStartBannerActive = false; // 回合开始横幅保护标志，横幅期间防止 phase_combat_update 触发敌人行动
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
        this.rewardDropEffects = []; // 遗物/精华掉落特效数组
        this.fortuneWheel = new FortuneWheel(this);
        // [triangle 布局专属] 底部左右倍率转盘（初始为空数组，在 phase_gathering_initPachinko 中根据布局初始化）
        this.triangleSideWheels = [];
        // [diamond 布局专属] 裂变回响虚影钉子数组
        this.ghostPegs = [];
        this.unlockedWeights = { ...CONFIG.probabilities };
        this.guaranteedNextRound = [];
        this.assimilationBoostRounds = {}; // { marbleType: roundsLeft }（旧字段，兼容保留）
        this.doubleAssimilationBoostRounds = {}; // { marbleType: roundsLeft }
        this.pendingSelectionMode = null;
        this.selectionMode = 'standard';
        this.selectionRequiredCount = CONFIG.gameplay.selectionReq || 3;
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        this.relicOverlayReturnState = null;
        this.fateMomentContext = null;
        this.replaceAmmoContext = null; // [tsk-668f3dba] 替换当前子弹阶段上下文
        this._chargedAmmoQueue = null; // [ammo-replace] 充能子弹（上回合 marbleQueue 编译的 recipe），用于研磨后替换界面
        // [bullet-charge-fix] 上一回合战斗实际使用的子弹快照（在 phase_startCombatPhase 中拍下），
        // 用作下回合「子弹充能」/「精华触发时充能子弹」的真实数据源，避免使用 marbleQueue 误用未发射的子弹。
        this._lastFiredAmmoSnapshot = null;
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
        // 实时伤害统计：滑窗 DPS + rAF 节流刷新
        this._damageRecentSamples = []; // [{t, amount}] 用于计算最近窗口 DPS
        this._dps = 0;                  // 当前瞬时 DPS（基于 _dpsWindowMs 滑窗）
        this._dpsWindowMs = 3000;       // DPS 滑窗大小（毫秒）
        this._damageStatsRafScheduled = false; // rAF 节流标志，避免每帧多次重建
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

        // ==================== [Promare] Hit Feedback 三件套字段 ====================
        // sys_loop 每帧读取，由 EventBus 监听器（见下文 _registerPromareHitFeedback）写入。
        // hitstopFrames > 0 时本帧 timeScale=0；flashOverlay 控制全屏白闪。
        this.hitstopFrames = 0;
        this.flashOverlay = null;
        this.saveData = { currency: 0, runeFragments: 0, upgrades: {}, temporaryUpgrades: {}, unlockedItems: [], highScore: 0 };
        this.runCurrency = 0;
        // ==================== 本局统计字段 ====================
        this.runKillCount = 0;          // 本局击杀数
        this.runRuneFragmentsGained = 0; // 本局获得的符文碎片数
        this.bossDefeatedLog = [];       // 本局击败的 Boss 记录 [{bossId, bossName, round, isBigBoss}]
        this.runewordKillCount = 0;      // [词条 Hook] 嗜血初锋: 本局击杀累计数，跨回合持久

        // ==================== [v2 钉板模块化] 模块系统状态 ====================
        this.unlockedModuleTypes = ['std_stagger', 'dense_stagger', 'bouncer', 'funnel'];
        this.unlockedModuleSlots = 12;
        this.currentModuleLayout = [
            'std_stagger', 'std_stagger', 'std_stagger', 'std_stagger',
            'std_stagger', 'std_stagger', 'std_stagger', 'std_stagger',
            'std_stagger', 'std_stagger', 'std_stagger', 'std_stagger',
        ];
        this.pendingFusions = [];

        // ==================== [v2 局内商店 + 符文碎片经济] ====================
        this.runFragments = 0;
        this.runShopInventory = [];
        this.runShopRefreshes = 0;
        this._runShopOpenedRound = -1;

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
        
        // [注意] 不在此处手动隐藏 .ui-overlay 元素。
        // 面板的显示/隐藏状态由 phase_switchPhase -> ui_updateUI 统一管理。
        // 手动隐藏会导致 phase-meta 在初始化时被隐藏后无法正确恢复（主页闪现消失 Bug）。
        
        // [Perf] 监听器具名化 + 重复注册保护
        // 之前匿名箭头闭包持有 game 实例，无法 GC；重启 / hot-reload 时也会重复注册。
        // 现在保存到实例字段，destroy() 时可以彻底清除。
        if (!this._onWindowResize) {
            this._onWindowResize = () => {
                this.ui_updatePCLayout();
                this.sys_resize();
                if (this.phase === 'gathering') this.phase_gathering_initPachinko();
            };
            window.addEventListener('resize', this._onWindowResize);
        }
        // [BUGFIX] 用 ResizeObserver 监听 game-container 尺寸变化，
        // 确保页面首次渲染后（CSS aspect-ratio 计算完成）canvas 尺寸能被正确设置。
        if (!this._resizeObserver) {
            this._resizeObserver = new ResizeObserver(() => {
                if (this.canvas.width !== Math.round(document.getElementById('game-container').getBoundingClientRect().width)) {
                    this.sys_resize();
                }
            });
            this._resizeObserver.observe(document.getElementById('game-container'));
        }
        // 初始化时立即执行一次 PC 布局检测
        this.ui_updatePCLayout();
        this.ui = new UIManager();
        this.truthBook = new TruthBook(this);
        this.trainingGround = new TrainingGround(this);

        // ==================== 注册事件总线监听器 ====================
        this._setupEventListeners();

        // 最后切换到 meta 阶段
        this.phase_switchPhase('meta');

        // ==================== 自适应性能监控状态 ====================
        // 当前特效等级：'high' | 'medium' | 'low'
        this.perfQualityLevel = 'high';
        // [Perf] shadowBlur 全局开关 - 由 perfQualityLevel 同步驱动；particles.js / entities.js 引用此布尔
        this.shadowBlurEnabled = CONFIG.performance.high.shadowBlurEnabled !== false;
        // FPS 滑动平均采样缓冲区（存储最近 N 帧的帧时间，单位 ms）
        this._fpsSamples = [];
        // 上一帧的时间戳（由 sys_loop 更新）
        this._lastFrameTime = 0;
        // 当前滑动平均 FPS（只读，由 sys_loop 计算）
        this.avgFps = 60;
        // 降级计时器（秒）：连续低帧时累加，达到阈值才真正降级
        this._perfDownTimer = 0;
        // 升级计时器（秒）：连续高帧时累加，达到阈值才真正升级
        this._perfUpTimer = 0;
        // 手动性能模式：null = 自动自适应；'high'|'medium'|'low' = 手动锁定
        this._perfManualMode = null;
        // [Phase 5B] 预加载所有 Sprite Sheet（在游戏循环开始前触发异步加载）
        preloadAllSprites();

        // ==================== [3D-Main M1] 初始化 3D 渲染管线 ====================
        // 设计契约：
        //   1. 任何初始化失败（Three.js CDN 拉取失败、WebGL 不支持、shader 编译错）→
        //      this.renderer3d = null，主循环 / resize 调用都用可选链跳过。
        //   2. 默认开启；可通过 localStorage.echo_3d_disabled = '1' 强制关闭。
        this.renderer3d = null;
        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('echo_3d_disabled') === '1') {
                console.info('[Renderer3D] disabled via localStorage.echo_3d_disabled');
            } else {
                const glCanvas = document.getElementById('gl-canvas');
                if (!glCanvas) {
                    console.warn('[Renderer3D] #gl-canvas not found, skipping 3D init');
                } else {
                    this.renderer3d = new Renderer3D(glCanvas, this.width, this.height, {
                        eventBus: this.eventBus,
                    });
                    this.renderer3d.resize(this.canvas.width, this.canvas.height);
                    console.info(`[Renderer3D] initialized @ ${this.canvas.width}x${this.canvas.height}`);
                }
            }
        } catch (err) {
            console.error('[Renderer3D] init failed, falling back to 2D-only:', err);
            this.renderer3d = null;
        }

        // ==================== [Promare] Dev Console 切换工具 ====================
        // 与 3D 视觉并行的另一套 2D 视觉模式。控制台 `window.__promare(true/false)` 切换。
        // 注意：3D 模式（body.render3d-debug）下 2D entities 整体被擦除，Promare 风格不可见；
        // 若想看 Promare 效果，需先在设置里关掉"3D 视觉"。
        if (typeof window !== 'undefined') {
            const _syncBodyClass = () => {
                document.body && document.body.classList.toggle('promare-mode', CONFIG.visualMode === 'promare');
            };
            _syncBodyClass();
            window.__promare = (on) => {
                CONFIG.visualMode = on ? 'promare' : 'classic';
                _syncBodyClass();
                console.log('[Promare] visualMode =', CONFIG.visualMode);
                return CONFIG.visualMode;
            };
            ensurePromareGlobals(this);
        }

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

            // [Promare] Hit Feedback 三件套：停帧 + 白闪 + 抖屏 + 几何 burst
            // 仅 visualMode==='promare' 启用，classic 模式完全跳过保持原行为。
            // @perf-impact: 监听器内只设字段 + 调 burst spawner（受 perf 档位限粒子数）。
            if (CONFIG.visualMode === 'promare') {
                // [视觉调优] 用户反馈"第一回合那个小破子弹打上去闪的厉害"——
                // 把命中反馈拆四档：tiny(<10) / normal(<30) / big(<60) / huge / kill。
                // tiny 完全跳过停帧 + 全屏闪，只给极轻屏抖 + burst；档位越高视觉冲击越大。
                const isKill = !!data.killed;
                const amt = (data.amount || 0);
                let severity;
                if      (isKill)    severity = 'kill';
                else if (amt >= 60) severity = 'huge';
                else if (amt >= 30) severity = 'big';
                else if (amt >= 10) severity = 'normal';
                else                severity = 'tiny';

                // hitstop
                const HITSTOP = { tiny: 0, normal: 0, big: 2, huge: 3, kill: 4 };
                this.hitstopFrames = HITSTOP[severity];

                // 全屏白闪：tiny 完全跳过，normal 极轻、big 中、huge/kill 重
                const FLASH = { tiny: 0, normal: 0.10, big: 0.22, huge: 0.40, kill: 0.50 };
                const flashAlpha = FLASH[severity];
                if (flashAlpha > 0) {
                    this.flashOverlay = { color: '#FFFFFF', alpha: flashAlpha, frames: severity === 'tiny' ? 2 : 4 };
                }

                // 屏抖：取 max，与原 triggerScreenShake 兼容
                const SHAKE = { tiny: 2, normal: 4, big: 8, huge: 12, kill: 14 };
                this.triggerScreenShake(SHAKE[severity]);

                // [Promare] 几何碎片爆发：方向锥沿入射反向，元素决定形状
                const hitX = data.hitX || (data.enemy ? data.enemy.pos.x : this.width / 2);
                const hitY = data.hitY || (data.enemy ? data.enemy.pos.y : this.height / 2);
                const elementType = data.type || (data.enemy && data.enemy._lastHitElement) || 'damage';
                const hitVel = (data.enemy && data.enemy._lastHitVel) || { x: 0, y: -1 };
                // spawnPromareBurst 只识别 normal/big/kill，把 tiny/huge 映射回去
                const burstSeverity = severity === 'tiny' ? 'normal' : (severity === 'huge' ? 'big' : severity);
                spawnPromareBurst(this, hitX, hitY, hitVel, elementType, burstSeverity);
                spawnRadialImpact(this, hitX, hitY, elementType);
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

            // [Promare T2.A] 击杀瞬间 — 叙事母题：□（秩序）被 △（Burnish）切开 → 碎成 △（自由）
            // hitstop / flashOverlay / screenShake 由这里设置；视觉时间线全部由 spawnPromareKillExplosion 编排
            //（5 帧切线 → 10 帧方块切片 → 15 帧 △ 碎片 → 20 帧金田光斑 → boss 末段 +○ 收束）。
            // 移除原 spawnPromareBurst + spawnRadialImpact —— 它们的圆 / spoke / 三层 ring 会与时间线打架。
            if (CONFIG.visualMode === 'promare') {
                const eKill = data.enemy;
                const isBoss = !!(eKill && eKill.type === 'boss');
                // hitstop：boss 6 帧、普通 4 帧
                this.hitstopFrames = Math.max(this.hitstopFrames || 0, isBoss ? 6 : 4);
                // 白闪：boss 强度更大
                this.flashOverlay  = { color: '#FFFFFF', alpha: isBoss ? 0.7 : 0.55, frames: isBoss ? 6 : 5 };
                this.triggerScreenShake(isBoss ? 24 : 18);
                if (eKill && eKill.pos) {
                    const hv = eKill._lastHitVel || { x: 0, y: -1 };
                    const elemType = (eKill._lastHitElement || data.type || 'damage');
                    // 击杀时间线（详见 promare_explosion.js + docs/promare_visual_design_v2.md §2.4）
                    spawnPromareKillExplosion(this, eKill.pos.x, eKill.pos.y, elemType, {
                        w: eKill.width,
                        h: eKill.height,
                        hitVel: hv,
                        isBoss,
                    });
                    // 拟声词视觉化（Boss 64px 大字 / Elite 44 / 普通 28）
                    spawnPromareOnomatopoeia(this, eKill.pos.x, eKill.pos.y - 8, elemType, eKill.type);
                }
            }

            // [本局统计] 累计击杀数
            this.runKillCount = (this.runKillCount || 0) + 1;
            // [延迟掉落] 非 Boss 敌人的遗物/精华不再立即结算，而是登记到下一回合开始统一解析。
            if (data && data.enemy && data.enemy.type !== 'boss' && typeof this.sys_tryQueueEnemyRoundReward === 'function') {
                this.sys_tryQueueEnemyRoundReward(data.enemy);
            }
        });

        // 音频就绪事件
        this.eventBus.on('audio:ready', (data) => {
            console.log('[Game] Audio system ready');
        });

        // [难度平衡] Boss 被击杀事件：触发战后高压因子
        this.eventBus.on('boss:defeated', (data) => {
            this.postBossMultiplier = 1.3;
            this.postBossSurgeRoundsLeft = 3;
            // [Task C.2] 战后高压期：3 回合内双词缀精英概率临时提升 25%
            this.postBossRoundsLeft = 3;
            console.log('[DifficultyBalance] Boss击杀，战后高压因子激活: x1.3，持续3回合，双词缀精英概率提升25%');
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

    /**
     * [Perf] 释放全局监听器，避免重启 / hot-reload 时旧 game 实例无法 GC。
     * 当前未在显式重启入口调用，但提供给开发者工具与未来重构使用。
     */
    destroy() {
        if (this._onWindowResize) {
            window.removeEventListener('resize', this._onWindowResize);
            this._onWindowResize = null;
        }
        if (this._resizeObserver) {
            try { this._resizeObserver.disconnect(); } catch (e) {}
            this._resizeObserver = null;
        }
        // [3D-Main M1] 释放 WebGL 资源
        if (this.renderer3d) {
            try { this.renderer3d.dispose(); } catch (e) {}
            this.renderer3d = null;
        }
    }
}

// [Task 3.3] 已移除 Object.assign(Game.prototype, ...) Mixin 模式。
// 各子系统方法现在通过构造函数中的 bind(this) 注入为实例方法（组合模式）。
// 详见 .cursor/rules/global.md 第 5 节「子系统扩展规范」。

export { SoundManager, Game, audio, eventBus, initAudio };
