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
import { calc_utils } from './calc_utils.js';

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
        // ==================== 事件总线挂载 ====================
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
        this.unlockedSlots = ['skill_point','wheel'];
        this.slotCount = 1;
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
        this.spores = []; 
        this.fireWaves = []; 
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
        this.isDragging = false; 
        this.dragStart = new Vec2(0,0); 
        this.dragCurrent = new Vec2(0,0); 
        this.lastMousePos = new Vec2(0,0); 
        this.currentSession = null; 
        this.isTiltingGrip = false;
        this.gripStartPos = new Vec2(0, 0); 
        this.gameOver = false; 
        this.defeatLineY = 570; 
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

        // ==================== 符文词条系统状态变量 ====================
        // Task 1: 数据结构升级 - runeInventory 和 runeGrid 存储对象格式 { id: string, level: number }
        // 例如: { id: 'rune_pyro_1', level: 1 }
        this.runeInventory = [];
        this.runeGrid = Array(9).fill(null);
        this.activeRunewordStats = {};
        this.runeLootItems = [];

        this.sys_loadSaveData();
        this.sys_resize();
        this.sys_setupInputs(); 
        this.currentRows = CONFIG.gameplay.rows; 
        this.boardBottomY = 0;
        
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
        });

        // 波次推进事件
        this.eventBus.on('wave:advance', (data) => {
            // 可用于触发波次相关的 UI 更新
        });

        // 敌人死亡事件
        this.eventBus.on('enemy:killed', (data) => {
            // 可用于成就系统、掉落系统等
        });

        // 音频就绪事件
        this.eventBus.on('audio:ready', (data) => {
            console.log('[Game] Audio system ready');
        });
    }
}

Object.assign(Game.prototype, 
    game_system, game_phase, combat_system, render_system, spawn_system, ui_system, calc_utils
);

export { SoundManager, Game, audio, eventBus, initAudio };
