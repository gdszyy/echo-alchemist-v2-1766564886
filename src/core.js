/**
 * core.js - 游戏核心引擎层 (重构版)
 */

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

// 导入拆分后的子系统
import { audio, SoundManager } from './audio.js';
import { game_system } from './game_system.js';
import { game_phase } from './game_phase.js';
import { combat_system } from './combat_system.js';
import { render_system } from './render_system.js';
import { spawn_system } from './spawn_system.js';
import { ui_system } from './ui_system.js';
import { calc_utils } from './calc_utils.js';

class Game {
    constructor() {
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
        this.saveData = { currency: 0, upgrades: {}, temporaryUpgrades: {}, unlockedItems: [], highScore: 0 };
        this.runCurrency = 0;   
        this.sys_loadSaveData(); // 必须先加载存档，才能应用升级
        this.sys_resize(); // 必须在加载存档后，才能确保 this.width/height 被正确设置
        this.sys_setupInputs(); 
        this.phase_switchPhase('meta'); 
        this.currentRows = CONFIG.gameplay.rows; 
        this.boardBottomY = 0;
        
        // [修复] 确保所有 UI 覆盖层在游戏开始时都被隐藏，防止状态残留
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
    }
}

Object.assign(Game.prototype, 
    game_system, game_phase, combat_system, render_system, spawn_system, ui_system, calc_utils
);

export { SoundManager, Game, audio };
