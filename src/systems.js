/**
 * systems.js - 游戏子系统 (UI, 试炼场, 真理之书)
 * 
 * 职责：
 * - UIManager: 处理非战斗 UI（抽屉、状态栏、词缀提示）
 * - TrainingGround: 自由测试模式，支持手动刷怪、调整属性
 * - TruthBook: 静态百科全书，提供词缀演示、属性说明
 * 
 * 依赖：
 * - CONFIG（来自 config.js）
 * - Enemy, Projectile（来自 entities.js）
 * - eventBus, EVENT_TYPES（来自 event_bus.js）
 */

import { CONFIG } from './config.js';
import { Enemy, Projectile, Particle, FloatingText, CloneSpore } from './entities.js';
import { eventBus, EVENT_TYPES } from './event_bus.js';
import { Vec2, adjustColorBrightness } from './utils/math_utils.js';
import { RUNEWORD_DB } from './rune_config.js';

// ==================== 真理之书数据 ====================

const TRUTH_BOOK_DATA = {
    enemies: [
        {
            id: 'shield',
            name: '護盾魔像',
            icon: '🛡️',
            tags: ['高防御', '反射激光'],
            desc: '全身覆蓋著強化合金，受到的傷害減少 50%。注意：它的護盾可以反射激光類攻擊。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 1) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 500, 500, 'normal', ['shield']));
            },
            loop: [
                { type: 'log', text: '檢測到護盾：傷害減免 50%' },
                { type: 'spawn_projectile', config: { damage: 20 } },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'clone',
            name: '分身魔像',
            icon: '🦠',
            tags: ['受擊分裂', '人海戰術'],
            desc: '每回合開始時，有 50% 概率分裂出一個複製體；受到攻擊時，有 20% 概率額外觸發分裂。複製體繼承本體的詞條，可迅速填滿戰場。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 1) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 300, 300, 'normal', ['clone']));
            },
            loop: [
                { type: 'log', text: '回合開始：嘗試分裂' },
                { type: 'enemy_turn' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '受擊觸發分裂' },
                { type: 'spawn_projectile', config: { damage: 10 } },
                { type: 'wait', frames: 150 },
                { type: 'reset' }
            ]
        },
        {
            id: 'haste',
            name: '極速魔像',
            icon: '⚡',
            tags: ['高速', '急速衝刺'],
            desc: '腿部裝有加速裝置，每回合在正常移動後額外追加一次衝刺移動。注意：加速僅作用於移動，不會重複結算其他詞條。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 1) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 200, 200, 'normal', ['haste']));
            },
            loop: [
                { type: 'log', text: '極速行動 (2x)' },
                { type: 'enemy_turn' }, 
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'berserk',
            name: '狂暴魔像',
            icon: '😡',
            tags: ['熱能轉化', '雙重結算'],
            desc: '每回合結束時自動升溫 +20°C，且溫度結算執行兩次。當處於過熱狀態時，有概率觸發狂暴，使本回合的非移動行動（如治癒、吞噬、增殖）額外結算一次。觸發概率隨溫度升高而增加。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 1) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                // 添加 healer 词条以演示狂暴下的双重行动
                const e = new Enemy(x, y, 60, 60, 300, 300, 'normal', ['berserk', 'healer']);
                e.temp = 150; 
                // 添加一个受伤的队友
                const ally = new Enemy(x - game.enemyWidth, y, 60, 60, 50, 200);
                game.enemies.push(e, ally);
            },
            loop: [
                { type: 'log', text: '當前溫度：150°C (過熱)' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '觸發狂暴判定...' },
                { type: 'enemy_turn' },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'healer',
            name: '治癒魔像',
            icon: '💖',
            tags: ['群體治療', '輔助'],
            desc: '戰場上的醫療兵。回合行動時會治療周圍的友軍單位。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 1.5, 2.5, 3.5, row: 1) - 靠近窗口中间
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const e1 = new Enemy(1.5 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 100, 200); 
                const healer = new Enemy(2.5 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 200, 200, 'normal', ['healer']);
                const e2 = new Enemy(3.5 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 100, 200); 
                game.enemies.push(e1, healer, e2);
            },
            loop: [
                { type: 'log', text: '隊友生命危急...' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '施放群體治癒' },
                { type: 'enemy_turn', targetIdx: 1 }, 
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'devour',
            name: '貪食魔像',
            icon: '👅',
            tags: ['吞噬友軍', '成長'],
            desc: '殘忍的同類相食者。每回合行動時，有概率吞噬相鄰的一個友軍單位，繼承其全部血量與所有詞條，被吞噬的單位立即死亡。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 2, 3, row: 1) - 靠近窗口中间
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                // 将食物改为分身魔像，增强视觉效果
                const food = new Enemy(2 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 100, 100, 'normal', ['clone']); 
                const eater = new Enemy(3 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 200, 500, 'normal', ['devour']);
                // [演示补丁] 确保吞噬概率为 100% 且范围足够
                if (game.CONFIG && game.CONFIG.balance && game.CONFIG.balance.affixes) {
                    game.CONFIG.balance.affixes.devourChance = 1.0;
                    game.CONFIG.balance.affixes.devourRange = 2.0;
                }
                game.enemies.push(food, eater);
            },
            loop: [
                { type: 'log', text: '發現獵物 (分身魔像)' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '吞噬！(繼承血量與詞條)' },
                { type: 'enemy_turn', targetIdx: 1 },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'jump',
            name: '跳躍魔像',
            icon: '🦘',
            tags: ['越過障礙', '突進'],
            desc: '腿部裝有彈簧裝置。當前方被阻擋時，可以直接跳過障礙物繼續前進。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 1, 0) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const blocker = new Enemy(x, game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2, 60, 60, 100, 100); 
                const jumper = new Enemy(x, game.combatGridTopY + 0 * game.enemyHeight + game.enemyHeight / 2, 60, 60, 200, 200, 'normal', ['jump']);
                // [演示补丁] 确保跳跃行数足够跨过一个敌人 (1行移动 + 1行阻挡 = 2行)
                if (game.CONFIG && game.CONFIG.balance && game.CONFIG.balance.affixes) {
                    game.CONFIG.balance.affixes.jumpRows = 2;
                }
                game.enemies.push(blocker, jumper);
            },
            loop: [
                { type: 'log', text: '前方道路被阻擋' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '發動跳躍！' },
                { type: 'enemy_turn', targetIdx: 1 },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        }
    ],
    attributes: [
        {
            id: 'bounce', name: '彈性', icon: '⤴️', tags: ['物理', '連擊'],
            desc: '增加彈珠在敵人之間彈射的次數，適合在密集怪群中製造混亂。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 1.5, 3.5, 2.5, 0.5, 4.5, row: 2, 2, 1, 0, 0) - 靠近窗口中间
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                game.enemies.push(
                    new Enemy(1.5 * w + w/2, top + 2 * h + h/2, 60, 60, 500),
                    new Enemy(3.5 * w + w/2, top + 2 * h + h/2, 60, 60, 500),
                    new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 500),
                    new Enemy(0.5 * w + w/2, top + 0 * h + h/2, 60, 60, 300),
                    new Enemy(4.5 * w + w/2, top + 0 * h + h/2, 60, 60, 300)
                );
            },
            loop: [
                { type: 'log', text: '發射高彈性彈珠' },
                { type: 'spawn_projectile', config: { damage: 15, bounce: 8 }, vel: {x: 2, y: -18} },
                { type: 'wait', frames: 240 }, { type: 'reset' }
            ]
        },
        {
            id: 'pierce', name: '穿透', icon: '↗️', tags: ['物理', '貫穿'],
            desc: '使彈珠能夠穿透敵人的身體，直接打擊後排目標。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 0-4) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                for(let i=0; i<5; i++) {
                    game.enemies.push(new Enemy(x, game.combatGridTopY + i * game.enemyHeight + game.enemyHeight / 2, 60, 60, 200));
                }
            },
            loop: [
                { type: 'log', text: '發射強力穿透彈' },
                { type: 'spawn_projectile', config: { damage: 20, pierce: 5 }, vel: {x: 0, y: -20} },
                { type: 'wait', frames: 120 }, { type: 'reset' }
            ]
        },
        {
            id: 'scatter', name: '散射', icon: '🔱', tags: ['物理', '分裂'],
            desc: '彈珠飛行時會向兩側分裂出小型子彈，擴大打擊覆蓋面。',
            setup: (game) => {
                // 统一尺寸 60x60，对齐网格 (中心 col: 2.5, row: 2; 周围 col: 0.5, 1.5, 3.5, 4.5, row: 1, 3) - 靠近窗口中间
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 2 * h + h/2, 60, 60, 1000));
                const positions = [
                    {c: 1.5, r: 1}, {c: 3.5, r: 1},
                    {c: 0.5, r: 2}, {c: 4.5, r: 2},
                    {c: 1.5, r: 3}, {c: 3.5, r: 3}
                ];
                positions.forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 100));
                });
            },
            loop: [
                { type: 'log', text: '發射分裂散射彈' },
                { type: 'spawn_projectile', config: { damage: 12, scatter: 8 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 180 }, { type: 'reset' }
            ]
        },
        {
            id: 'cryo', name: '冰霜', icon: '❄️', tags: ['元素', '控制'],
            desc: '降低敵人溫度。溫度 < 0°C 時觸發【易傷】，每降低 1°C 增加 0.5% 受到的傷害。達到 -100°C 時觸發【凍結】，敵人將無法行動。',
            setup: (game) => { 
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 1) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const e = new Enemy(x, y, 60, 60, 2000);
                e.temp = -100; // 預設凍結
                game.enemies.push(e); 
            },
            loop: [
                { type: 'log', text: '目標已處於【凍結】狀態' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '觸發【易傷】(傷害大幅提升)' },
                { type: 'spawn_projectile', config: { damage: 100, cryo: 0 }, vel: {x: 0, y: -15} }, 
                { type: 'wait', frames: 120 }, { type: 'reset' }
            ]
        },
        {
            id: 'pyro', name: '火焰', icon: '🔥', tags: ['元素', '範圍爆炸'],
            desc: '升高敵人溫度。溫度 ≥ 34°C 時觸發「燃燒」，造成額外傷害（公式：火屬性層數 × 溫度 / 200）。溫度 > 200°C 時有概率觸發「過熱爆炸」，對自身及半徑 120 內的敵人造成 AOE 傷害，並消耗 27% 熱量。爆炸概率從 200°C 的 15% 線性增至 800°C 的 90%。',
            setup: (game) => { 
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                // 中心目标 (col: 2.5, row: 1) - 靠近窗口中间
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1500)); 
                const positions = [
                    {c: 1.5, r: 0}, {c: 2.5, r: 0}, {c: 3.5, r: 0},
                    {c: 1.5, r: 1},                {c: 3.5, r: 1},
                    {c: 1.5, r: 2}, {c: 2.5, r: 2}, {c: 3.5, r: 2}
                ];
                positions.forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 300));
                });
            },
            loop: [
                { type: 'log', text: '第一步：施加火屬性使其【燃燒】' },
                { type: 'spawn_projectile', config: { damage: 10, pyro: 600 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 100 },
                { type: 'log', text: '第二步：擊殺燃燒中的敵人觸發爆炸' },
                { type: 'spawn_projectile', config: { damage: 2000 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 150 }, { type: 'reset' }
            ]
        },
        {
            id: 'lightning', name: '閃電', icon: '⚡', tags: ['元素', '連鎖'],
            desc: '命中時觸發連鎖閃電。閃電鏈可對重複敵人造成傷害，並對目標施加溫度。基礎連鎖概率 15%，目標溫度越低（冰凍狀態）概率越高（最高 100%）。連鎖傷害隨次數遞減，最多連鎖 100 次。',
            setup: (game) => {
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                // 3x4 矩阵 (col: 1.5-3.5, row: 0-3) - 靠近窗口中间
                for(let r=0; r<4; r++) {
                    for(let c=1; c<4; c++) {
                        const e = new Enemy((c+0.5) * w + w/2, top + r * h + h/2, 60, 60, 500);
                        e.temp = -100; 
                        game.enemies.push(e);
                    }
                }
            },
            loop: [
                { type: 'log', text: '打擊凍結目標 (啟動無限連鎖)' },
                { type: 'spawn_projectile', config: { damage: 15, lightning: 10 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 300 }, { type: 'reset' }
            ]
        },
        {
            id: 'laser', name: '光球', icon: '🔦', tags: ['特殊', '瞬時'],
            desc: '直接發射激光束，瞬間對路徑上的敵人造成傷害。激光可被護盾反射。',
            setup: (game) => {
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                // 2x3 矩阵 (col: 1.5, 3.5, row: 0-2) - 靠近窗口中间
                for(let i=0; i<6; i++) {
                    const col = i % 2 === 0 ? 1.5 : 3.5;
                    const row = Math.floor(i / 2);
                    game.enemies.push(new Enemy(col * w + w/2, top + row * h + h/2, 60, 60, 300));
                }
            },
            loop: [
                { type: 'log', text: '發射激光束 (isLaser=true)' },
                { type: 'spawn_projectile', config: { damage: 40, laser: 10, isLaser: true }, vel: {x: 2, y: -15} },
                { type: 'wait', frames: 150 }, { type: 'reset' }
            ]
        },
        {
            id: 'wind', name: '風', icon: '🌪️', tags: ['特殊', '法陣'],
            desc: '在命中點生成風暴法陣，持續發射風刃攻擊附近的敵人。',
            setup: (game) => { 
                // 统一尺寸 60x60，对齐网格 (col: 2.5, row: 1) - 靠近窗口中间
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 1000)); 
            },
            loop: [
                { type: 'spawn_projectile', config: { damage: 5, wind: 1, bounce: 4 }, vel: {x: 5, y: -15} },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '風暴法陣持續攻擊...' },
                { type: 'wait', frames: 180 }, { type: 'reset' }
            ]
        },
        {
            id: 'explosive', name: '爆破', icon: '🧨', tags: ['特殊', 'AOE'],
            desc: '接觸敵人時引發劇烈爆炸，造成大範圍傷害。',
            setup: (game) => {
                const w = game.enemyWidth;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                // 5列对齐 (col: 0.5-4.5, row: 1) - 靠近窗口中间
                for(let c=0; c<5; c++) {
                    game.enemies.push(new Enemy((c+0.5) * w + w/2, y, 60, 60, 100));
                }
            },
            loop: [
                { type: 'spawn_projectile', config: { damage: 30, explosive: true }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 120 }, { type: 'reset' }
            ]
        },
        {
            id: 'matryoshka', name: '套娃', icon: '🪆', tags: ['特殊', '連鎖'],
            desc: '子彈消失時會分裂出下一顆子彈。演示：散射子彈分裂出散射火屬性子彈。',
            setup: (game) => { 
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                // 中心目标 (col: 2.5, row: 0) - 靠近窗口中间
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 0 * h + h/2, 60, 60, 1500)); 
                for(let c=0; c<4; c++) {
                    game.enemies.push(new Enemy((c+1) * w + w/2, top + 2 * h + h/2, 60, 60, 300));
                }
            },
            loop: [
                { type: 'log', text: '發射套娃彈 (散射->火散射)' },
                { type: 'spawn_projectile', config: { 
                    damage: 10, 
                    scatter: 3,
                    nestedPayload: { damage: 10, scatter: 5, pyro: 100 }
                }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 240 }, { type: 'reset' }
            ]
        }
    ]
};

// ==================== UI 管理器 ====================

class UIManager {
    constructor() {
        this.drawer = document.getElementById('info-drawer');
        this.currentTab = 'status';
        this.hoveredEnemy = null;
        this.isOpen = false;
        this.spContainer = document.getElementById('sp-panel');
        const afx = CONFIG.balance.affixes;
        
        this.affixDict = {
            'shield': { 
                name: '🛡️ 護盾', 
                desc: `受到的傷害減少 ${afx.shieldReduction * 100}%。(可反射激光)` 
            },
            'haste': { 
                name: '⚡ 極速', 
                desc: '每回合在正常移动后额外追加一次冲刺移动。加速仅作用于移动，不重复结算其他词条。' 
            },
            'regen': { 
                name: '💚 再生', 
                desc: `每回合恢復 ${afx.regenPercent * 100}% 最大生命值。` 
            },
            'clone': { 
                name: '🦠 增殖', 
                desc: `每回合開始有 ${afx.cloneChanceTurn * 100}% 概率分裂；受到攻擊時有 ${afx.cloneChanceHit * 100}% 概率額外分裂。` 
            },
            'berserk': { 
                name: '😡 狂暴', 
                desc: '每回合 +20°C，溫度結算執行兩次；有概率對非移动行動額外結算一次（概率隨溫度升高）。' 
            },
            'healer': { 
                name: '💖 治癒', 
                desc: `每回合治療周圍友軍 ${afx.healerPercent * 100}% 最大生命值。` 
            },
            'devour': { 
                name: '👅 吞噬', 
                desc: `有概率吞噬相鄰友軍，繼承其全部生命與詞條。` 
            },
            'jump': { 
                name: '🦘 跳躍', 
                desc: `前方被阻擋時，可直接跳過最多 ${afx.jumpRows} 行障礙。` 
            }
        };
    }

    renderAttributeControls() {
        const container = document.getElementById('train-attr-grid');
        if (!container) return;
        container.innerHTML = '';
        
        Object.entries(this.bulletConfig).forEach(([key, val]) => {
            if (typeof val !== 'number') return;
            const item = document.createElement('div');
            item.className = 'flex flex-col gap-1 p-2 bg-slate-800/60 border border-slate-700 rounded-lg';
            item.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="text-[10px] text-slate-400 uppercase font-bold">${key}</span>
                    <span class="text-xs font-mono text-cyan-400">${val}</span>
                </div>
                <div class="flex gap-1">
                    <button onclick="game.trainingGround.adjustBullet('${key}', -1)" class="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]">-</button>
                    <button onclick="game.trainingGround.adjustBullet('${key}', 1)" class="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]">+</button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    updateBulletPreview() {
        const preview = document.getElementById('train-bullet-preview');
        if (!preview) return;
        const cfg = this.bulletConfig;
        preview.innerHTML = `
            <div class="flex flex-wrap gap-1">
                ${cfg.damage > 10 ? `<span class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] border border-purple-500/30">⚔️ ATK ${cfg.damage}</span>` : ''}
                ${cfg.bounce > 0 ? `<span class="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] border border-green-500/30">⤴️ BNC ${cfg.bounce}</span>` : ''}
                ${cfg.pierce > 0 ? `<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] border border-red-500/30">↗️ PRC ${cfg.pierce}</span>` : ''}
                ${cfg.scatter > 0 ? `<span class="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px] border border-yellow-500/30">🔱 SCT ${cfg.scatter}</span>` : ''}
                ${cfg.pyro > 0 ? `<span class="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] border border-orange-500/30">🔥 PYRO ${cfg.pyro}</span>` : ''}
                ${cfg.cryo > 0 ? `<span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] border border-cyan-500/30">❄️ CRYO ${cfg.cryo}</span>` : ''}
                ${cfg.lightning > 0 ? `<span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] border border-blue-500/30">⚡ LGT ${cfg.lightning}</span>` : ''}
                ${cfg.multicast > 0 ? `<span class="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300 text-[10px] border border-slate-500/30">🔗 MULTI ${cfg.multicast}</span>` : ''}
                ${cfg.isLaser ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">🔦 LASER</span>` : ''}
            </div>
        `;
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        // 更新按钮样式
        document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
            const targets = ['status', 'affix', 'recipe', 'damage'];
            if (targets[idx] === tabName) {
                btn.classList.add('active', 'text-amber-400', 'border-b-2', 'border-amber-400');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('active', 'text-amber-400', 'border-b-2', 'border-amber-400');
                btn.classList.add('text-slate-400');
            }
        });
        // 切换内容显示
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        const tabEl = document.getElementById(`tab-${tabName}`);
        if (tabEl) tabEl.classList.remove('hidden');
        // 如果切换到伤害统计标签，更新显示
        if (tabName === 'damage') {
            game.ui_updateDamageStats();
        }
    }

    updateSkillBar(currentSP, activeSkills) {
        const container = document.getElementById('skill-bar');
        if (!container) return;
        container.innerHTML = '';
        // 仅渲染已解锁的技能，而非遍历全部 SKILL_DB
        const skillsToRender = activeSkills || [];
        skillsToRender.forEach(skill => {
            const btn = document.createElement('div');
            const isDisabled = currentSP < skill.cost;
            btn.className = `
                w-12 h-12 rounded-full border-2 flex items-center justify-center 
                text-xl shadow-lg transition-all duration-200 relative group
                ${isDisabled ? 'border-slate-600 bg-slate-800 opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer hover:scale-110 active:scale-95'}
            `;
            if (!isDisabled) {
                btn.style.borderColor = skill.color;
                btn.style.background = `radial-gradient(circle, ${adjustColorBrightness(skill.color, 0.5)} 0%, #0f172a 100%)`;
                btn.style.boxShadow = `0 0 10px ${skill.color}`;
            }
            btn.innerHTML = `
                <span>${skill.icon}</span>
                <div class="absolute -bottom-2 -right-2 bg-black border border-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full text-white font-bold">
                    ${skill.cost}
                </div>
            `;
            if (!isDisabled) {
                const stopProp = (e) => { e.stopPropagation(); };
                btn.addEventListener('mousedown', stopProp);
                btn.addEventListener('touchstart', stopProp, { passive: false });
                btn.onclick = (e) => {
                    e.stopPropagation();
                    game.combat_activateSkill(skill);
                };
            }
            container.appendChild(btn);
        });
    }

    updateSkillPoints(current, max = null) {
        if (max === null) {
            max = Math.max(CONFIG.gameplay.maxSkillPoints, current);
        }
        this.spContainer.innerHTML = '';
        for (let i = 0; i < max; i++) {
            const slot = document.createElement('div');
            slot.className = 'sp-slot';
            const gem = document.createElement('div');
            gem.className = 'sp-gem';
            if (i < current) {
                gem.classList.add('active');
                slot.style.borderColor = '#10b981';
                slot.style.boxShadow = '0 0 5px rgba(16, 185, 129, 0.3)';
            }
            slot.appendChild(gem);
            this.spContainer.appendChild(slot);
        }
    }

    showEnemyInfo(enemy) {
        if (!enemy || !enemy.active) {
            this.closeDrawer();
            return;
        }
        this.hoveredEnemy = enemy;
        this.isOpen = true;
        // PC 模式下 drawer 已迁移到左侧边栏常驻展开，无需操作 translate
        if (!this.drawer.dataset.pcDrawerMigrated) {
            this.drawer.classList.remove('translate-y-full');
        }
        const typeName = enemy.type === 'boss' ? '💀 BOSS' : (enemy.type === 'elite' ? '⚠️ 精英魔像' : '普通魔像');
        document.getElementById('info-enemy-type').innerText = typeName;
        document.getElementById('info-enemy-type').className = enemy.type === 'boss' ? 'text-xl font-bold text-red-500' : (enemy.type === 'elite' ? 'text-lg font-bold text-yellow-400' : 'text-lg font-bold text-slate-200');
        document.getElementById('info-hp').innerText = `HP: ${Math.ceil(enemy.displayHp)}/${enemy.maxHp}`;
        const tempBar = document.getElementById('info-temp-bar');
        const tempText = document.getElementById('info-temp-text');
        const tempPct = Math.min(100, Math.abs(enemy.temp));
        tempBar.style.width = `${tempPct/2}%`;
        if (enemy.temp > 0) {
            tempBar.style.left = '50%';
            tempBar.style.transformOrigin = 'left';
            tempBar.style.background = '#f97316';
            tempText.innerText = `溫度: +${enemy.temp.toFixed(0)}°C (過熱)`;
            tempText.style.color = '#fbbf24';
        } else if (enemy.temp < 0) {
            tempBar.style.left = `${50 - tempPct/2}%`;
            tempBar.style.transformOrigin = 'right';
            tempBar.style.background = '#06b6d4';
            tempText.innerText = `溫度: ${enemy.temp.toFixed(0)}°C (過冷)`;
            tempText.style.color = '#67e8f9';
        } else {
            tempBar.style.width = '0';
            tempText.innerText = `溫度: 0°C (穩定)`;
            tempText.style.color = '#94a3b8';
        }
        const statusList = document.getElementById('info-status-list');
        statusList.innerHTML = '';
        if (enemy.isFrozenCurrentTurn || enemy.temp <= -100) {
            this.addStatusItem(statusList, '❄️ 深度凍結', '無法移動與行動。', 'text-cyan-300');
        } else if (enemy.temp < 0) {
            const freezeChance = Math.min(100, Math.abs(enemy.temp)) / 2;
            this.addStatusItem(statusList, '📉 低溫影響', `下回合有 ${freezeChance.toFixed(0)}% 概率被凍結。`, 'text-cyan-200');
        }
        if (enemy.temp > 0) {
            if (enemy.temp >= 100) {
                const dmg = 5 + (enemy.temp - 100);
                this.addStatusItem(statusList, '🔥 極限燃燒', `每回合受到 ${dmg.toFixed(0)} 點傷害，並向周圍擴散。`, 'text-orange-400');
            } else {
                this.addStatusItem(statusList, '🌡️ 過熱狀態', '溫度 >100°C 時觸發燃燒傷害。', 'text-orange-200');
            }
            if (enemy.affixes.includes('berserk')) {
                const berserkChance = (enemy.temp / 100) * 0.5 * 100;
                this.addStatusItem(statusList, '😡 熱能狂暴', `因過熱，有 ${berserkChance.toFixed(0)}% 概率行動兩次。`, 'text-red-400');
            }
        }
        if (enemy.temp < 0) {
            const conductBonus = Math.min(100, 15 + Math.abs(enemy.temp) * 0.85);
            this.addStatusItem(statusList, '⚡ 導電體質', `低溫使連鎖閃電傳導概率提升至 ${(conductBonus).toFixed(0)}%。`, 'text-purple-300');
        } else {
            this.addStatusItem(statusList, '⚡ 導電體質', `基礎連鎖閃電傳導概率 15%。`, 'text-purple-300/50');
        }
        const affixContainer = document.getElementById('info-affix-list');
        affixContainer.innerHTML = '';
        if (enemy.affixes.length === 0) {
            affixContainer.innerHTML = '<p class="text-slate-500 text-center italic mt-4">該敵人無特殊詞條</p>';
        } else {
            enemy.affixes.forEach(affix => {
                const info = this.affixDict[affix];
                if (info) {
                    const div = document.createElement('div');
                    div.className = 'bg-slate-800 p-2 rounded border border-slate-700';
                    div.innerHTML = `<div class="font-bold text-amber-100 mb-1">${info.name}</div><div class="text-xs text-slate-400">${info.desc}</div>`;
                    affixContainer.appendChild(div);
                }
            });
        }
    }

    addStatusItem(container, title, desc, colorClass) {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-start';
        div.innerHTML = `<span class="font-bold ${colorClass}">${title}</span> <span class="text-right max-w-[70%]">${desc}</span>`;
        container.appendChild(div);
    }

    // @section:drawer_state_save - 关闭前状态保存与动画准备
    closeDrawer() {
        this.isOpen = false;
        this.hoveredEnemy = null;
        // PC 模式下 drawer 常驻展开，不隐藏
        if (!this.drawer.dataset.pcDrawerMigrated) {
            this.drawer.classList.add('translate-y-full');
        }
    }
}
// ==================== 试炼场系统 =====================

// ==================== 试炼场场景数据 ====================
// 每个场景包含：
//   setup(game)       — 初始敌人布置（必填）
//   bulletConfig      — 预设子弹配置（可选，不填则保留当前配置）
//   demoAction(game)  — 触发演示动作（可选，如自动发射子弹或触发敌人行动）
//   desc              — 场景说明文字（可选）
const TRAINING_SCENARIOS = {
    categories: [
        { id: 'enemy', name: '敵人詞條' },
        { id: 'attribute', name: '屬性效果' },
        { id: 'boss', name: 'Boss 機制' },
        { id: 'runeword', name: '符文詞條' },
        { id: 'relic', name: '遺物/精華' }
    ],
    scenarios: [
        // ── 敵人詞條 ──────────────────────────────────────────────────
        {
            id: 'enemy_shield',
            categoryId: 'enemy',
            name: '護盾魔像',
            icon: '🛡️',
            desc: '護盾減傷 50%，激光可被反射。建議用激光子彈測試反射效果。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 500, 500, 'normal', ['shield']));
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: true, isMatryoshka: false, type: 'normal', laser: 5 },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_clone',
            categoryId: 'enemy',
            name: '分身魔像',
            icon: '🦠',
            desc: '受擊有 20% 概率分裂，回合開始有 50% 概率分裂。可迅速填滿戰場。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 300, 300, 'normal', ['clone']));
            },
            bulletConfig: { damage: 10, bounce: 3, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_haste',
            categoryId: 'enemy',
            name: '極速魔像',
            icon: '⚡',
            desc: '每回合額外追加一次衝刺移動，速度是普通敵人的兩倍。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 0 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 200, 200, 'normal', ['haste']));
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_berserk',
            categoryId: 'enemy',
            name: '狂暴魔像',
            icon: '😡',
            desc: '每回合自動升溫 +20°C，溫度結算執行兩次。過熱時有概率觸發狂暴。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const e = new Enemy(x, y, 60, 60, 300, 300, 'normal', ['berserk', 'healer']);
                e.temp = 150;
                const ally = new Enemy(x - game.enemyWidth, y, 60, 60, 50, 200);
                game.enemies.push(e, ally);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_healer',
            categoryId: 'enemy',
            name: '治癒魔像',
            icon: '💖',
            desc: '回合行動時治療周圍友軍。優先消滅治療者，否則傷害難以積累。',
            setup: (game) => {
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const e1 = new Enemy(1.5 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 100, 200);
                const healer = new Enemy(2.5 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 200, 200, 'normal', ['healer']);
                const e2 = new Enemy(3.5 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 100, 200);
                game.enemies.push(e1, healer, e2);
            },
            // @section:drawer_rune_grid_finalize - 符文网格最终化与合成判断
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_devour',
            categoryId: 'enemy',
            name: '貪食魔像',
            icon: '👅',
            desc: '每回合有概率吞噬相鄰友軍，繼承其血量與詞條，被吞噬單位立即死亡。',
            setup: (game) => {
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const food = new Enemy(2 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 100, 100, 'normal', ['clone']);
                const eater = new Enemy(3 * game.enemyWidth + game.enemyWidth / 2, y, 60, 60, 200, 500, 'normal', ['devour']);
                game.enemies.push(food, eater);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_jump',
            categoryId: 'enemy',
            name: '跳躍魔像',
            icon: '🦘',
            desc: '前方被阻擋時可直接跳過障礙物繼續前進，無視阻擋。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const blocker = new Enemy(x, game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2, 60, 60, 100, 100);
                const jumper = new Enemy(x, game.combatGridTopY + 0 * game.enemyHeight + game.enemyHeight / 2, 60, 60, 200, 200, 'normal', ['jump']);
                game.enemies.push(blocker, jumper);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_regen',
            categoryId: 'enemy',
            name: '再生魔像',
            icon: '💚',
            desc: '每回合自動回復一定比例血量。需在回合間隙造成足夠傷害才能擊殺。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const e = new Enemy(x, y, 60, 60, 500, 500, 'normal', ['regen']);
                e.hp = 200;
                game.enemies.push(e);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        // ── 屬性效果 ──────────────────────────────────────────────────
        {
            id: 'attr_bounce',
            categoryId: 'attribute',
            name: '彈性 (Bounce)',
            icon: '⤴️',
            desc: '子彈在敵人間彈射，適合密集怪群。彈跳次數越多，連擊越多。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(
                    new Enemy(1.5 * w + w/2, top + 2 * h + h/2, 60, 60, 500),
                    new Enemy(3.5 * w + w/2, top + 2 * h + h/2, 60, 60, 500),
                    new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 500),
                    new Enemy(0.5 * w + w/2, top + 0 * h + h/2, 60, 60, 300),
                    new Enemy(4.5 * w + w/2, top + 0 * h + h/2, 60, 60, 300)
                );
            },
            bulletConfig: { damage: 15, bounce: 8, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(2, -18);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_pierce',
            categoryId: 'attribute',
            name: '穿透 (Pierce)',
            icon: '↗️',
            desc: '子彈穿透敵人身體，直接打擊後排目標，適合縱列排布的敵人。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                for (let i = 0; i < 5; i++) {
                    game.enemies.push(new Enemy(x, game.combatGridTopY + i * game.enemyHeight + game.enemyHeight / 2, 60, 60, 200));
                }
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 5, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -20);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_scatter',
            categoryId: 'attribute',
            name: '散射 (Scatter)',
            icon: '🔱',
            desc: '子彈飛行時向兩側分裂出小型子彈，擴大打擊覆蓋面。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 2 * h + h/2, 60, 60, 1000));
                [{c:1.5,r:1},{c:3.5,r:1},{c:0.5,r:2},{c:4.5,r:2},{c:1.5,r:3},{c:3.5,r:3}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 100));
                });
            },
            bulletConfig: { damage: 12, bounce: 0, pierce: 0, scatter: 8, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_cryo',
            categoryId: 'attribute',
            name: '冰霜 (Cryo)',
            icon: '❄️',
            desc: '降低敵人溫度。低溫觸發【易傷】，-100°C 觸發【凍結】使敵人無法行動。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const e = new Enemy(x, y, 60, 60, 2000);
                e.temp = -100;
                game.enemies.push(e);
            },
            bulletConfig: { damage: 100, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_pyro',
            categoryId: 'attribute',
            name: '火焰 (Pyro)',
            icon: '🔥',
            desc: '升高敵人溫度。高溫觸發【燃燒】持續傷害，過熱可引發【爆炸】AOE。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1500));
                [{c:1.5,r:0},{c:2.5,r:0},{c:3.5,r:0},{c:1.5,r:1},{c:3.5,r:1},{c:1.5,r:2},{c:2.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 300));
                });
            },
            bulletConfig: { damage: 10, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 600, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_lightning',
            categoryId: 'attribute',
            name: '閃電 (Lightning)',
            icon: '⚡',
            desc: '命中觸發連鎖閃電。目標溫度越低（冰凍狀態）連鎖概率越高，最多連鎖 100 次。',
            setup: (game) => {
                // @section:drawer_reward_calc - 奖励计算：属性汇总与等级提升
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 4; r++) {
                    for (let c = 1; c < 4; c++) {
                        const e = new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 500);
                        e.temp = -100;
                        game.enemies.push(e);
                    }
                }
            },
            bulletConfig: { damage: 15, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 10, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_laser',
            categoryId: 'attribute',
            name: '激光 (Laser)',
            icon: '🔦',
            desc: '瞬時射線，對路徑上所有敵人造成傷害。激光可被護盾反射，改變方向。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let i = 0; i < 6; i++) {
                    const col = i % 2 === 0 ? 1.5 : 3.5;
                    const row = Math.floor(i / 2);
                    game.enemies.push(new Enemy(col * w + w/2, top + row * h + h/2, 60, 60, 300));
                }
            },
            bulletConfig: { damage: 40, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: true, isMatryoshka: false, type: 'normal', laser: 10 },
            demoAction: (game, tg) => {
                const recipe = { ...tg.bulletConfig };
                if (recipe.laser > 0) recipe.isLaser = true;
                const vel = new Vec2(2, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, recipe, null, true);
            }
        },
        {
            id: 'attr_wind',
            categoryId: 'attribute',
            name: '風暴 (Wind)',
            icon: '🌪️',
            desc: '命中點生成風暴法陣，持續發射風刃攻擊附近敵人。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 1000));
            },
            bulletConfig: { damage: 5, bounce: 4, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 1, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const recipe = { ...tg.bulletConfig };
                if (recipe.wind > 0) { recipe.level = 1; recipe.wind_lv = 1; }
                const vel = new Vec2(5, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, recipe, null, true);
            }
        },
        // ── Boss 機制 ──────────────────────────────────────────────────
        {
            id: 'boss_ignis',
            categoryId: 'boss',
            name: '熔爐守衛·伊格尼斯',
            icon: '🔥',
            desc: '護盾+極速。狂暴後每回合升溫 +30°C 並對周圍敵人火焰濺射。弱點：穿透/火焰。',
            setup: (game) => { game.spawn_spawnBoss('ignis', false); },
            bulletConfig: { damage: 50, bounce: 0, pierce: 3, scatter: 0, multicast: 0, pyro: 200, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_glacies',
            categoryId: 'boss',
            name: '霜晶縫合怪·格拉西斯',
            icon: '❄️',
            desc: '跳躍+再生。狂暴後跳躍行數增加，落地冰凍周圍鋼釘。弱點：冰霜/穿透。',
            setup: (game) => { game.spawn_spawnBoss('glacies', false); },
            bulletConfig: { damage: 50, bounce: 0, pierce: 3, scatter: 0, multicast: 0, pyro: 0, cryo: 200, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_mikro',
            categoryId: 'boss',
            name: '裂變母體·米克羅',
            icon: '🦠',
            desc: '分身+治療。每個存活分身提供 10% 減傷（上限 50%）。弱點：閃電/散射。',
            setup: (game) => { game.spawn_spawnBoss('mikro', false); },
            bulletConfig: { damage: 20, bounce: 0, pierce: 0, scatter: 5, multicast: 0, pyro: 0, cryo: 0, lightning: 8, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_devourer',
            categoryId: 'boss',
            name: '貪婪之淵·噬神者',
            icon: '👅',
            desc: '吞噬+護盾。狂暴後全屏吞噬。弱點：彈跳/激光。',
            setup: (game) => { game.spawn_spawnBoss('devourer', false); },
            bulletConfig: { damage: 40, bounce: 5, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: true, isMatryoshka: false, type: 'normal', laser: 8 },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_ouroboros',
            categoryId: 'boss',
            name: '永恆回聲·奧羅波羅斯',
            icon: '🔄',
            desc: '詞條每 3 回合輪轉（護盾/極速 → 再生/治療 → 分身/跳躍）。狂暴後每回合輪轉。',
            setup: (game) => { game.spawn_spawnBoss('ouroboros', true); },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        // ── 符文詞條 ──────────────────────────────────────────────────────────────────
        {
            id: 'rw_meltdown',
            categoryId: 'runeword',
            runewordId: 'runeword_meltdown',
            runewordLevel: 1,
            name: '燔毀',
            icon: '🌋',
            desc: '[炸毒系] 火焰燃燒傷害與過熱爆炸最終傷害提升 50%。建議將敵人溫度提升至爆燃閾値再觸發演示。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                // 中心一个高血量敌人，初始温度设为 160°C（接近爆燃閾値 200°C）
                const e = new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 3000, 3000);
                e.temp = 160;
                game.enemies.push(e);
                // 周围小怪用于演示爆炸 AOE
                [{c:1.5,r:0},{c:3.5,r:0},{c:1.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 500));
                });
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 800, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_absolute_zero',
            categoryId: 'runeword',
            runewordId: 'runeword_absolute_zero',
            runewordLevel: 1,
            name: '絕對零度',
            icon: '❄️',
            desc: '[冰霜系] 散人處於凍結狀態時，每次受到物理傷害都會令該散人本回合受到的所有傷害加深。建議先用冰霜將敵人凍結再改用穿透子彈測試。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                const e = new Enemy(x, y, 60, 60, 5000, 5000);
                e.temp = -120; // 已凍結
                game.enemies.push(e);
            },
            bulletConfig: { damage: 50, bounce: 0, pierce: 5, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                // @section:drawer_session_commit - 会话数据提交与存档写入
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_frost_nova',
            categoryId: 'runeword',
            runewordId: 'runeword_frost_nova',
            runewordLevel: 1,
            name: '冰霜新星',
            icon: '💠',
            desc: '[冰霜系] 彈珠每彈跳 5 次，釋放一次冰霜新星，造成冰屬性傷害並降溫；被冰霜新星击中的敌人按当前冻结概率链式触发新一轮新星，每次链式概率减半。建議配合高彈跳与低温敵人測試链式触发。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 5; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 800));
                    }
                }
            },
            bulletConfig: { damage: 15, bounce: 10, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 200, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(3, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_thunderstorm',
            categoryId: 'runeword',
            runewordId: 'runeword_thunderstorm',
            runewordLevel: 1,
            name: '雷暴之語',
            icon: '🌩️',
            desc: '[閃電系] 閃電鏈的傷害衰減係數提升 50%，連鎖傷害更高。建護將敵人先凍結再用閃電以激發更高連鎖機率。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 5; c++) {
                        const e = new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 600);
                        e.temp = -100; // 凍結狀態，提高閃電連鎖機率
                        game.enemies.push(e);
                    }
                }
            },
            bulletConfig: { damage: 10, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 15, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_kinetic_surge',
            categoryId: 'runeword',
            runewordId: 'runeword_kinetic_surge',
            runewordLevel: 1,
            name: '動能激増',
            icon: '💥',
            desc: '[彈射系] 本次發射的彈珠，後續的每一次彈射傷害固定增加 +1。彈跳次數越多，總傷害越高。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(
                    new Enemy(1.5 * w + w/2, top + 2 * h + h/2, 60, 60, 1000),
                    new Enemy(3.5 * w + w/2, top + 2 * h + h/2, 60, 60, 1000),
                    new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1000),
                    new Enemy(0.5 * w + w/2, top + 0 * h + h/2, 60, 60, 600),
                    new Enemy(4.5 * w + w/2, top + 0 * h + h/2, 60, 60, 600)
                );
            },
            bulletConfig: { damage: 10, bounce: 12, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(3, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_focused_fire',
            categoryId: 'runeword',
            runewordId: 'runeword_focused_fire',
            runewordLevel: 1,
            name: '專注射擊',
            icon: '🎯',
            desc: '[專注系] 符文配方已改为「寒冰 + 穿刺」（不再依赖激光）。將所有彈跳和連射層數轉化為基礎傷害；傷害有 20% 機率暴擊，造成 200% 傷害。建議配合高彈跳屬性測試。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 3000, 3000));
            },
            bulletConfig: { damage: 10, bounce: 8, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 使用 fireBulletWithEffects 而非直接 spawn_spawnBullet，
                // 确保经由 combat_fireNextShot 应用 focused_fire 词条效果：
                // bounce=8 会被转化为 +8 基础伤害，子弹不再弹跳，并获得 20% 暴击概率
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_mass_collapse',
            categoryId: 'runeword',
            runewordId: 'runeword_mass_collapse',
            runewordLevel: 1,
            name: '質量崩塌',
            icon: '💣',
            desc: '[爆炸系] 強制獲得爆炸屬性（範圍減半）。仅清空所有散射層數（連射保留），每清空 1 層散射爆炸範圍 +10%。建議配合高散射屬性測試。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 5; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 500));
                    }
                }
            },
            bulletConfig: { damage: 15, bounce: 0, pierce: 0, scatter: 6, multicast: 4, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 使用 fireBulletWithEffects 确保 mass_collapse 词条效果被应用：
                // scatter=6 + multicast=4 将被清空，子弹获得爆炸属性，爆炸范围 = 0.5 + 10 * 0.10 = 1.5倍
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_kinetic_decay',
            categoryId: 'runeword',
            runewordId: 'runeword_kinetic_decay',
            runewordLevel: 1,
            name: '動能衰變',
            icon: '📉',
            desc: '[衰變系] 子彈初始獲得 25% 傷害加成。但每次命中敵人後，此加成會衰減 7%。建護配合高穿透屬性測試傷害逐次降低。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                for (let i = 0; i < 5; i++) {
                    game.enemies.push(new Enemy(x, game.combatGridTopY + i * game.enemyHeight + game.enemyHeight / 2, 60, 60, 500));
                }
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 6, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 使用 fireBulletWithEffects 确保 kinetic_decay 词条效果被应用：
                // _kineticDecayBonus=0.25 和 _kineticDecayRate=0.07 将被写入配方
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_echo_shot',
            categoryId: 'runeword',
            runewordId: 'runeword_echo_shot',
            runewordLevel: 1,
            name: '回響射擊',
            icon: '🔄',
            desc: '[回響系] 子彈首次擊中敵人時，有 25% 機率按原角度額外發射一顆單發子彈。建護用多次發射測試回響觸發機率。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(
                    new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 2000),
                    // @section:drawer_ui_transition - UI 过渡动画与阶段切换触发
                    new Enemy(1.5 * w + w/2, top + 0 * h + h/2, 60, 60, 500),
                    new Enemy(3.5 * w + w/2, top + 0 * h + h/2, 60, 60, 500)
                );
            },
            bulletConfig: { damage: 25, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 使用 fireBulletWithEffects 确保 echo_shot 词条效果被应用：
                // _echoShotChance=0.25 将被写入配方，子弹命中时有 25% 概率额外发射
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => { tg.fireBulletWithEffects(tg.bulletConfig); }, i * 300);
                }
            }
        },
        {
            id: 'rw_bloodthirst_edge',
            categoryId: 'runeword',
            runewordId: 'runeword_bloodthirst_edge',
            runewordLevel: 1,
            name: '嗜血初锋',
            icon: '🗡️',
            desc: '[成長系] 每次擊殺敵人，本局全局基礎傷害永久 +1。但冰霜與火焰屬性層數降低 30%。建護先擊殺小怪累積傷害加成再汋試精英怪。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                // 低血量小怪：第一排 15 血，第二排 31 血
                for (let c = 0; c < 5; c++) {
                    game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + 0 * h + h/2, 60, 60, 15));
                    game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + 1 * h + h/2, 60, 60, 31));
                }
                // 一個高血量精英怪
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 2 * h + h/2, 60, 60, 2000, 2000, 'normal', ['shield']));
            },
            bulletConfig: { damage: 15, bounce: 0, pierce: 2, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 使用 fireBulletWithEffects 确保 bloodthirst_growth 词条效果被应用：
                // 击杀累计加伤和属性惩罚将被应用到配方
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_scatter_matrix',
            categoryId: 'runeword',
            runewordId: 'runeword_scatter_matrix',
            runewordLevel: 1,
            name: '散射矩陣',
            icon: '🔱',
            desc: '[轉化系] 連射次數全部轉化為散射層數。基礎傷害降低 25%，散射子彈的發射夾角縮小 70%。建護配合高連射屬性測試。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 5; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 400));
                    }
                }
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 0, scatter: 0, multicast: 8, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 使用 fireBulletWithEffects 确保 scatter_matrix 词条效果被应用：
                // multicast=8 将被转化为 scatter=8，子弹以收紧夹角散射而非连射
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_flame_sword',
            categoryId: 'runeword',
            runewordId: 'runeword_flame_sword',
            runewordLevel: 1,
            name: '炎光劍影',
            icon: '🔥',
            desc: '[穿透系] 子母飞剑/普通子彈穿透敵人時，有 30% 機率在命中位置生成一道剑光 AOE 伤害（非爆炸），并对范围内敌人额外升温。建議配合高穿透與高伤害子彈測試。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                for (let i = 0; i < 4; i++) {
                    game.enemies.push(new Enemy(x, game.combatGridTopY + i * game.enemyHeight + game.enemyHeight / 2, 60, 60, 600));
                }
            },
            bulletConfig: { damage: 25, bounce: 0, pierce: 5, scatter: 0, multicast: 0, pyro: 200, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_elemental_fusion',
            categoryId: 'runeword',
            runewordId: 'runeword_elemental_fusion',
            runewordLevel: 1,
            name: '元素聚變',
            icon: '⚗️',
            desc: '[元素系] 當敵人同時承受火、冰、雷三種狀態時，引發元素聚變爆炸。建護先用冰霜+閃電將敵人凍結，再用火焰觸發聚變。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                // 中心目標敵人，初始狀態設為冰電共存
                // [修复] 同时设置 temp=-100 和 _cryoHitThisRound=true，确保冰状态标记有效
                const e = new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 4000, 4000);
                e.temp = -100; // 凍結
                e._cryoHitThisRound = true;      // [修复] 预设冰元素标记，供聚变触发条件使用
                e._lightningHitThisRound = true; // [修复] 预设雷元素标记，模拟已被闪电命中状态
                game.enemies.push(e);
                // 周围小怪用于演示爆炸 AOE
                [{c:1.5,r:0},{c:3.5,r:0},{c:1.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 300));
                });
            },
            // [修复] bulletConfig 加入 cryo 和 lightning 属性，确保每次发射都能重新积累三元素状态
            // pyro=5 触发火状态，cryo=5 触发冰状态，lightning=5 触发雷状态，三者共存即引爆聚变
            bulletConfig: { damage: 20, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 5, cryo: 5, lightning: 5, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 改用 fireBulletWithEffects，确保子弹经由 combat_fireNextShot 完整走词条流程
                // 子弹携带 pyro+cryo+lightning 三属性，命中后自动设置三元素标记并触发聚变
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_thunder_scatter',
            categoryId: 'runeword',
            runewordId: 'runeword_thunder_scatter',
            runewordLevel: 1,
            name: '雷霖散射',
            icon: '⚡',
            desc: '[閃電系] 每次成功觸發閃電鏈時，額外釋放一條同屬性閃電鏈。建護配合凍結狀態的密集敵人測試連鎖暴發。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 5; c++) {
                        const e = new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 600);
                        e.temp = -100;
                        game.enemies.push(e);
                    }
                }
            },
            bulletConfig: { damage: 10, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 12, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_irradiation',
            categoryId: 'runeword',
            runewordId: 'runeword_irradiation',
            runewordLevel: 1,
            name: '照射',
            icon: '☀️',
            desc: '[激光系] 激光變為持續照射。累積照射同一個敵人，受到的傷害加深 15%。建護對單一敵人持續照射測試傷害累加效果。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 8000, 8000));
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 4, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: true, isMatryoshka: false, type: 'normal', laser: 10 },
            // @section:drawer_event_emit - 事件总线通知与后续流程触发
            demoAction: (game, tg) => {
                const recipe = { ...tg.bulletConfig };
                if (recipe.laser > 0) recipe.isLaser = true;
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, recipe, null, true);
            }
        },
        {
            id: 'rw_armor_piercing_meteor',
            categoryId: 'runeword',
            runewordId: 'runeword_armor_piercing_meteor',
            runewordLevel: 1,
            name: '穿甲流星',
            icon: '💨',
            desc: '[穿透系] 散射出的子彈丸繼承 100% 的穿透層數。建護配合高穿透+高散射屬性測試。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 4; r++) {
                    for (let c = 1; c < 5; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 400));
                    }
                }
            },
            bulletConfig: { damage: 15, bounce: 0, pierce: 4, scatter: 5, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(2, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_blazing_beam',
            categoryId: 'runeword',
            runewordId: 'runeword_blazing_beam',
            runewordLevel: 1,
            name: '炽熱光線',
            icon: '🔥',
            desc: '[復合系] 激光照射敵人時，除了造成傷害，每 0.5 秒還會額外提升敵人溫度 +5°C。建議配合火焰屬性持續照射高血量敵人，觀察升溫→燃燒觸發的完整鏈路。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 6000, 6000));
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 0, scatter: 0, multicast: 4, pyro: 3, cryo: 0, lightning: 0, wind: 0, isLaser: true, isMatryoshka: false, type: 'normal', laser: 8 },
            demoAction: (game, tg) => {
                const recipe = { ...tg.bulletConfig };
                if (recipe.laser > 0) recipe.isLaser = true;
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, recipe, null, true);
            }
        },
        {
            id: 'rw_lightning_shield',
            categoryId: 'runeword',
            runewordId: 'runeword_lightning_shield',
            runewordLevel: 1,
            name: '雷電護盾',
            icon: '🛡️',
            desc: '[復合系] 彈珠彈射時有 15% 機率在自身周圍生成靜電場；被靜電場击中的敌人 100% 觸發闪电链。建議配合高彈跳/低层闪电属性測試。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(
                    new Enemy(1.5 * w + w/2, top + 2 * h + h/2, 60, 60, 800),
                    new Enemy(3.5 * w + w/2, top + 2 * h + h/2, 60, 60, 800),
                    new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 800),
                    new Enemy(0.5 * w + w/2, top + 0 * h + h/2, 60, 60, 500),
                    new Enemy(4.5 * w + w/2, top + 0 * h + h/2, 60, 60, 500)
                );
            },
            bulletConfig: { damage: 15, bounce: 10, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 5, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(3, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_blade_storm',
            categoryId: 'runeword',
            runewordId: 'runeword_blade_storm',
            runewordLevel: 1,
            name: '劍刃風暴',
            icon: '🌀',
            desc: '[復合系] 首個子彈定期對範圍內所有敵人生成一次劍光斬擊。建護將子彈射入敵人堆中測試周期性傷害。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 5; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 1000));
                    }
                }
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 3, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // [修复] 使用 fireBulletWithEffects 走正规的 ammoQueue + combat_fireNextShot 流程，
                // 确保 _roundFirstShotId 被正确注册，blade_storm 词条效果才能触发。
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_sword_resonance',
            categoryId: 'runeword',
            runewordId: 'runeword_sword_resonance',
            runewordLevel: 1,
            name: '劍意共鳴',
            icon: '⚔️',
            desc: '[特殊系] 解鎖飛劍變異。穿透彈珠碰撞穿透鉤釘時，有 70% 機率使其變異為飛劍鉤釘。該場景需在收集階段測試，此處僅展示詞條激活狀態。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 2000, 2000));
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 5, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_storm_resonance',
            categoryId: 'runeword',
            runewordId: 'runeword_storm_resonance',
            runewordLevel: 1,
            name: '風暴共鳴',
            icon: '🌪️',
            desc: '[特殊系] 解鎖風屬性變異。反彈彈珠碰撞反彈鉤釘時，有 70% 機率使其變異為風屬性鉤釘。該場景需在收集階段測試，此處僅展示詞條激活狀態。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 2000, 2000));
            },
            bulletConfig: { damage: 20, bounce: 8, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(3, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_bullet_to_sword',
            categoryId: 'runeword',
            runewordId: 'runeword_bullet_to_sword',
            runewordLevel: 1,
            name: '化彈為劍',
            icon: '⚔️',
            desc: '[穿透系] 首輪發射的子彈被替換為一把子飛劍（取消連射），原連射層數轉為子飛劍攻擊次數；詞條等級對應子飛劍等級（Lv1/Lv2/Lv3）。建議搭配高連射屬性測試攻擊次數。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 5; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 600));
                    }
                }
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 1, scatter: 0, multicast: 4, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // 通过 fireBulletWithEffects 走正规流程，确保 bullet_to_sword 词条 hook 被应用：
                // 子弹被替换为一把子飞剑，maxAttacks = multicast + 1 = 5
                tg.fireBulletWithEffects(tg.bulletConfig);
            }
        },
        {
            id: 'rw_pierce_decay',
            categoryId: 'attribute',
            name: '穿透衰減',
            icon: '📉',
            desc: '[平衡] 穿透子弹每次穿透命中后伤害衰减 35%（最低保留 15% 基础伤害）；穿透共鸣 T2/T3 可降低衰减率（T2 -20%，T3 -40%）。建议配合高穿透层数子弹测试逐次衰减。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                for (let i = 0; i < 6; i++) {
                    game.enemies.push(new Enemy(x, game.combatGridTopY + i * game.enemyHeight + game.enemyHeight / 2, 60, 60, 800));
                }
            },
            bulletConfig: { damage: 100, bounce: 0, pierce: 8, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },

        // ── 遺物/精華 测试场景 ────────────────────────────────────────────────────────────────────────────────

        // 場景 1：遺物保底计数器验证
        {
            id: 'relic_pity_essence',
            categoryId: 'relic',
            name: '精華保底验证',
            icon: '✨',
            desc: '[保底测试] 重置精華保底计数器为 0，展示当前保底进度。连续击杀 4 行普通敌人后，第 5 行应强制触发精华掌落。点击「模拟击杀」按钮逐行进行验证。',
            setup: (game) => {
                // 展示 5 行普通敌人，每行 1 个，共 5 个
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 5; r++) {
                    game.enemies.push(new Enemy(2.5 * w + w/2, top + r * h + h/2, 60, 60, 100, 100, 'normal', []));
                }
                // 重置保底计数器
                if (game.dropPity) {
                    game.dropPity.essence = 0;
                    game.dropPity.relic = 0;
                }
                // 展示当前保底状态
                const banner = document.getElementById('train-runeword-banner');
                if (banner) {
                    banner.classList.add('visible');
                    const nameEl = document.getElementById('rw-banner-name');
                    const descEl = document.getElementById('rw-banner-desc');
                    if (nameEl) nameEl.textContent = '保底计数器';
                    if (descEl) descEl.textContent = `精華保底: ${game.dropPity ? game.dropPity.essence : 'N/A'} / 4 行 | 遗物保底: ${game.dropPity ? game.dropPity.relic : 'N/A'} / 12 行`;
                }
            },
            bulletConfig: { damage: 200, bounce: 0, pierce: 5, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // 模拟击杀一行敌人，观察保底计数器变化
                const living = game.enemies.filter(e => e.active && e.hp > 0);
                if (living.length > 0) {
                    const target = living[0];
                    target.hp = 0;
                    target.active = false;
                    // 触发 enemy:killed 事件以更新保底计数器
                    if (typeof game.sys_tryQueueEnemyRoundReward === 'function') {
                        game.sys_tryQueueEnemyRoundReward(target);
                    }
                }
                // 更新展示
                const descEl = document.getElementById('rw-banner-desc');
                if (descEl && game.dropPity) {
                    descEl.textContent = `精華保底: ${game.dropPity.essence} / 4 行 | 遗物保底: ${game.dropPity.relic} / 12 行 | 待结算奖励: ${(game.pendingRoundStartRewards || []).length} 个`;
                }
            }
        },

        // 場景 2：遗物选择界面验证（保底强制触发）
        {
            id: 'relic_selection_ui',
            categoryId: 'relic',
            name: '遗物选择界面',
            icon: '🎁',
            desc: '[遗物 UI 验证] 直接向 pendingRoundStartRewards 压入一个遗物奖励，然后触发 resolver。验证遗物选择界面能否正常弹出，以及关闭后是否能正确返回试炼场。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 500, 500));
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // 向队列压入遗物奖励，并记录返回目标为 training
                if (!game.pendingRoundStartRewards) game.pendingRoundStartRewards = [];
                game.pendingRoundStartRewards.push({ type: 'relic', source: 'test_training' });
                // 设置返回目标：遗物界面关闭后应返回试炼场（而不是进入研磨阶段）
                if (typeof game.ui_showRelicSelection === 'function') {
                    game.ui_showRelicSelection({ resumeTarget: 'training' });
                }
            }
        },

        // 場景 3：混沌精华（Chaos Essence）命运抗决验证
        {
            id: 'relic_chaos_essence',
            categoryId: 'relic',
            name: '混沌精华命运',
            icon: '🎡',
            desc: '[混沌精华] 向奖励队列压入 chaos_essence，触发命运抗决界面。验证：底栏是否显示 0/3、选择 3 枚弹珠后确认按鈕是否可用。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 500, 500));
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                if (!game.pendingRoundStartRewards) game.pendingRoundStartRewards = [];
                game.pendingRoundStartRewards.push({ type: 'chaos_essence', source: 'test_training' });
                if (typeof game.sys_startRoundStartResolver === 'function') {
                    game.sys_startRoundStartResolver();
                }
            }
        },

        // 場景 4：纯净精华（Pure Essence）全链路验证
        {
            id: 'relic_pure_essence',
            categoryId: 'relic',
            name: '纯净精华全链路',
            icon: '🕊️',
            desc: '[纯净精华] 向奖励队列压入 pure_essence，触发纯净精华界面。验证：底栏是否显示 0/1、符文注入面板是否展示、fateMomentContext.active 是否为 true。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 500, 500));
                // 预先向 marbleQueue 写入一个占位弹珠，模拟上一回合已研磨的状态
                if (!game.marbleQueue || game.marbleQueue.length === 0) {
                    game.marbleQueue = [{ type: 'bounce', collected: [], source: 'test' }];
                }
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                if (!game.pendingRoundStartRewards) game.pendingRoundStartRewards = [];
                game.pendingRoundStartRewards.push({ type: 'pure_essence', source: 'test_training' });
                if (typeof game.sys_startRoundStartResolver === 'function') {
                    game.sys_startRoundStartResolver();
                }
            }
        },

        // 場景 5：纯净精华——跳过研磨分支验证
        {
            id: 'relic_pure_essence_skip_grind',
            categoryId: 'relic',
            name: '精华跳过研磨',
            icon: '⚡',
            desc: '[跳过研磨] 触发纯净精华后，直接点击「跳过研磨」按鈕。验证关键点：\n1. ammoQueue 是否被正确充能（优先用 _chargedAmmoQueue，其次编译 marbleQueue）\n2. 进入战斗后不会显示「弹药耗尽」\n3. 是否获得随机符文',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let c = 0; c < 5; c++) {
                    game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + 1 * h + h/2, 60, 60, 300, 300));
                }
                // 模拟上一回合已有充能子弹
                game._chargedAmmoQueue = [{ type: 'bounce', damage: 20, bounce: 5, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false }];
                game.marbleQueue = [{ type: 'bounce', collected: [], source: 'test' }];
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                if (!game.pendingRoundStartRewards) game.pendingRoundStartRewards = [];
                game.pendingRoundStartRewards.push({ type: 'pure_essence', source: 'test_training' });
                if (typeof game.sys_startRoundStartResolver === 'function') {
                    game.sys_startRoundStartResolver();
                }
                // 提示测试人员操作步骤
                const descEl = document.getElementById('rw-banner-desc');
                const banner = document.getElementById('train-runeword-banner');
                if (banner && descEl) {
                    banner.classList.add('visible');
                    const nameEl = document.getElementById('rw-banner-name');
                    if (nameEl) nameEl.textContent = '操作步骤';
                    descEl.textContent = '界面弹出后：点击「跳过研磨」→ 检查控制台 game.ammoQueue.length > 0 且 game.phase === \'combat\'';
                }
            }
        },

        // 場景 6：同化涌潮遗物（surge_bounce）验证
        {
            id: 'relic_surge_bounce',
            categoryId: 'relic',
            name: '弹性涌潮遗物',
            icon: '🔵',
            desc: '[同化涌潮] 模拟获得「弹性涌潮」遗物后的状态。验证：\n1. doubleAssimilationBoostRounds[bounce] 是否被设为 2\n2. guaranteedNextRound 是否包含 2 个 bounce 弹珠\n3. 发射 bounce 弹珠后，同化概率是否为基础值 × 2',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                // 布置带弹性钉子的敌人（模拟已同化的钉盘）
                for (let c = 0; c < 5; c++) {
                    game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + 1 * h + h/2, 60, 60, 500, 500));
                }
                // 模拟遗物效果：手动设置涌潮状态
                if (!game.doubleAssimilationBoostRounds) game.doubleAssimilationBoostRounds = {};
                game.doubleAssimilationBoostRounds['bounce'] = 2;
                if (!game.assimilationBoostRounds) game.assimilationBoostRounds = {};
                game.assimilationBoostRounds['bounce'] = 2;
                if (!game.guaranteedNextRound) game.guaranteedNextRound = [];
                game.guaranteedNextRound.push({ type: 'bounce' }, { type: 'bounce' });
                // 展示状态
                const banner = document.getElementById('train-runeword-banner');
                if (banner) {
                    banner.classList.add('visible');
                    const nameEl = document.getElementById('rw-banner-name');
                    const descEl = document.getElementById('rw-banner-desc');
                    if (nameEl) nameEl.textContent = '涌潮状态已激活';
                    if (descEl) descEl.textContent = `doubleAssimilationBoostRounds.bounce = ${game.doubleAssimilationBoostRounds['bounce']} | guaranteedNextRound 包含 ${game.guaranteedNextRound.length} 个弹珠`;
                }
            },
            bulletConfig: { damage: 20, bounce: 8, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'bounce' },
            demoAction: (game, tg) => {
                // 发射弹性弹珠，观察同化概率加成是否生效
                tg.fireBulletWithEffects({ ...tg.bulletConfig, type: 'bounce' });
                // 更新展示
                const descEl = document.getElementById('rw-banner-desc');
                if (descEl && game.doubleAssimilationBoostRounds) {
                    const bounceBoost = game.doubleAssimilationBoostRounds['bounce'] || 0;
                    const multiplier = (typeof game.CONFIG !== 'undefined' && game.CONFIG.gameplay) ? game.CONFIG.gameplay.assimilationDoubleMultiplier : 2;
                    descEl.textContent = `弹性弹珠已发射 | 涌潮剩余回合: ${bounceBoost} | 同化应为基础值 ×${multiplier}`;
                }
            }
        },

        // 場景 7：钉盘形态遗物互斥验证
        {
            id: 'relic_board_exclusion',
            categoryId: 'relic',
            name: '钉盘形态互斥',
            icon: '🔺',
            desc: '[鑉盘形态遗物互斥] 模拟玩家已拥有 triangle_formation，验证遗物选择界面是否正确排除其他鑉盘结构遗物。展示候选遗物列表，确认不包含 diamond_formation、sparse_interval、mirror_sync、wide_narrow、dimension_shard。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 500, 500));
                // 模拟玩家已拥有三角鑉盘遗物
                if (!game.ownedRelics) game.ownedRelics = [];
                if (!game.ownedRelics.includes('triangle_formation')) {
                    game.ownedRelics.push('triangle_formation');
                }
                game.boardLayout = 'triangle';
                // 展示当前鑉盘布局
                const banner = document.getElementById('train-runeword-banner');
                if (banner) {
                    banner.classList.add('visible');
                    const nameEl = document.getElementById('rw-banner-name');
                    const descEl = document.getElementById('rw-banner-desc');
                    if (nameEl) nameEl.textContent = '当前鑉盘布局';
                    if (descEl) descEl.textContent = `boardLayout = '${game.boardLayout}' | ownedRelics 包含: ${game.ownedRelics.filter(r => ['triangle_formation','diamond_formation','sparse_interval','mirror_sync','wide_narrow','dimension_shard'].includes(r)).join(', ')}`;
                }
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // 触发遗物选择界面，观察候选遗物列表
                if (typeof game.ui_showRelicSelection === 'function') {
                    game.ui_showRelicSelection({ resumeTarget: 'training' });
                }
                // 展示候选遗物中是否包含互斥遗物
                const descEl = document.getElementById('rw-banner-desc');
                if (descEl) {
                    const BOARD_STRUCTURE = ['triangle_formation', 'diamond_formation', 'sparse_interval', 'mirror_sync', 'wide_narrow', 'dimension_shard'];
                    const owned = game.ownedRelics || [];
                    const hasBoard = BOARD_STRUCTURE.some(r => owned.includes(r));
                    descEl.textContent = `已拥有鑉盘结构遗物: ${hasBoard} | 遗物界面已弹出，请确认候选列表不包含其他鑉盘形态遗物`;
                }
            }
        },

        // 場景 8：存档与恢复验证
        {
            id: 'relic_save_restore',
            categoryId: 'relic',
            name: '存档恢复验证',
            icon: '💾',
            desc: '[存档测试] 向奖励队列压入一个遗物 + 一个精华，然后触发存档。验证 localStorage 中 pendingRoundStartRewards 是否被持久化。刷新页面后验证奖励队列是否正确恢复。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 500, 500));
            },
            bulletConfig: { damage: 30, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                // 向奖励队列压入多个奖励
                if (!game.pendingRoundStartRewards) game.pendingRoundStartRewards = [];
                game.pendingRoundStartRewards.push(
                    { type: 'relic', source: 'test_save' },
                    { type: 'chaos_essence', source: 'test_save' }
                );
                // 触发存档
                if (typeof game.sys_saveRunState === 'function') {
                    game.sys_saveRunState();
                }
                // 验证存档内容
                const saved = localStorage.getItem('echo_alchemist_run_state');
                let parsed = null;
                try { parsed = saved ? JSON.parse(saved) : null; } catch(e) {}
                const banner = document.getElementById('train-runeword-banner');
                if (banner) {
                    banner.classList.add('visible');
                    const nameEl = document.getElementById('rw-banner-name');
                    const descEl = document.getElementById('rw-banner-desc');
                    if (nameEl) nameEl.textContent = '存档验证结果';
                    if (descEl) {
                        const pendingInSave = parsed && parsed.pendingRoundStartRewards ? parsed.pendingRoundStartRewards.length : 0;
                        descEl.textContent = `localStorage 中 pendingRoundStartRewards 数量: ${pendingInSave} (预期 2) | 内容: ${parsed ? JSON.stringify(parsed.pendingRoundStartRewards) : '未找到'}`;
                    }
                }
            }
        }
    ]
};

class TrainingGround {
    constructor(game) {
        this.game = game;
        this.active = false;
        // 当前场景状态
        this.currentScenario = null;
        this.currentCategory = 'enemy';
        // 子弹配置
        this.bulletConfig = {
            damage: 10, bounce: 0, pierce: 0, scatter: 0, multicast: 0,
            pyro: 0, cryo: 0, lightning: 0, wind: 0,
            isLaser: false, isMatryoshka: false, type: 'normal'
        };
        this.stats = {
            totalDamage: 0,
            lastTotal: 0,
            dps: 0,
            startTime: 0
        };
        this.initUI();
    }

    /**
     * 动态创建 #phase-training DOM 结构（含底部控制面板和右侧边栏）
     */
    // @section:ui_canvas_setup - Canvas 尺寸与 DPI 初始化
    initUI() {
        if (document.getElementById('phase-training')) return; // 防止重复初始化
        const ui = document.createElement('div');
        ui.id = 'phase-training';
        ui.className = 'ui-overlay hidden-phase';
        ui.style.cssText = 'display: none; z-index: 400; background: transparent; pointer-events: auto; flex-direction: row;';

        const style = document.createElement('style');
        style.innerHTML = `
            #phase-training {
                position: absolute;
                inset: 0;
                display: flex;
                flex-direction: row;
                padding-top: 0 !important; /* 覆盖 .ui-overlay 的 70px padding-top */
                padding-bottom: 0 !important;
            }
            /* 主战斗区域（占据左侧剩余空间） */
            #train-main-area {
                flex: 1;
                position: relative;
                min-width: 0;
                display: flex;
                flex-direction: column;
            }
            /* 右侧边栏 */
            #train-sidebar {
                width: 200px;
                min-width: 200px;
                background: rgba(10, 15, 28, 0.97);
                border-left: 1px solid #1e293b;
                display: flex;
                flex-direction: column;
                z-index: 500;
                transition: width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s;
                overflow: hidden;
            }
            #train-sidebar.collapsed {
                width: 32px;
                min-width: 32px;
            }
            #train-sidebar.collapsed #train-sidebar-tabs,
            #train-sidebar.collapsed #train-scenario-list,
            #train-sidebar.collapsed #train-scenario-desc,
            #train-sidebar.collapsed .train-sidebar-actions {
                display: none;
            }
            .train-sidebar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 10px 6px;
                border-bottom: 1px solid #1e293b;
                flex-shrink: 0;
            }
            .train-sidebar-tabs {
                display: flex;
                border-bottom: 1px solid #1e293b;
                flex-shrink: 0;
            }
            .train-scat-btn {
                flex: 1;
                padding: 5px 2px;
                font-size: 10px;
                font-weight: bold;
                color: #64748b;
                border-bottom: 2px solid transparent;
                // @section:ui_event_binding - 鼠标/触摸/键盘事件绑定
                transition: all 0.2s;
                background: transparent;
                white-space: nowrap;
            }
            .train-scat-btn.active {
                color: #e2e8f0;
                border-bottom-color: #06b6d4;
                background: rgba(6,182,212,0.08);
            }
            .train-scenario-list {
                flex: 1;
                overflow-y: auto;
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .train-scenario-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 8px;
                border-radius: 8px;
                border: 1px solid transparent;
                background: rgba(30,41,59,0.5);
                color: #94a3b8;
                font-size: 11px;
                text-align: left;
                transition: all 0.15s;
                cursor: pointer;
                width: 100%;
            }
            .train-scenario-btn:hover {
                background: rgba(6,182,212,0.1);
                border-color: rgba(6,182,212,0.3);
                color: #e2e8f0;
            }
            .train-scenario-btn.active {
                background: rgba(6,182,212,0.15);
                border-color: #06b6d4;
                color: #cffafe;
            }
            .train-scenario-icon { font-size: 14px; flex-shrink: 0; }
            .train-scenario-name { font-size: 11px; line-height: 1.3; }
            .train-scenario-desc {
                padding: 8px 10px;
                font-size: 10px;
                color: #64748b;
                line-height: 1.5;
                border-top: 1px solid #1e293b;
                flex-shrink: 0;
                min-height: 60px;
                max-height: 90px;
                overflow-y: auto;
            }
            .train-sidebar-actions {
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                border-top: 1px solid #1e293b;
                flex-shrink: 0;
            }
            .train-demo-btn {
                width: 100%;
                padding: 7px;
                background: #0e7490;
                color: #cffafe;
                border-radius: 6px;
                font-size: 11px;
                font-weight: bold;
                transition: background 0.15s;
                cursor: pointer;
            }
            .train-demo-btn:hover:not(:disabled) { background: #0891b2; }
            .train-demo-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .train-reset-btn {
                width: 100%;
                padding: 5px;
                background: #1e293b;
                color: #94a3b8;
                border-radius: 6px;
                font-size: 10px;
                transition: background 0.15s;
                cursor: pointer;
            }
            .train-reset-btn:hover:not(:disabled) { background: #334155; color: #e2e8f0; }
            .train-reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            /* 底部控制面板 */
            #train-control-panel {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(12px);
                border-top: 1px solid #334155;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 500;
                display: flex;
                // @section:ui_hud_components - HUD 组件初始化（血条/弹药/符文槽）
                flex-direction: column;
            }
            #train-control-panel.collapsed {
                transform: translateY(calc(100% - 40px));
            }
            .train-tab-btn {
                padding: 8px 16px;
                font-size: 12px;
                font-weight: bold;
                color: #94a3b8;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
            }
            .train-tab-btn.active {
                color: #f8fafc;
                border-bottom-color: #3b82f6;
                background: rgba(59, 130, 246, 0.1);
            }
            .train-panel-content {
                display: none;
                padding: 16px;
                overflow-y: auto;
                max-height: 40vh;
            }
            .train-panel-content.active {
                display: block;
            }
            #train-toggle-main {
                background: #1e293b;
                border: 1px solid #334155;
                border-bottom: none;
                border-radius: 8px 8px 0 0;
                padding: 4px 12px;
                font-size: 10px;
                color: #94a3b8;
                position: absolute;
                top: -24px;
                left: 50%;
                transform: translateX(-50%);
                cursor: pointer;
            }
            /* 符文词条效果横幅 */
            #train-runeword-banner {
                position: absolute;
                top: 40px; /* 顶部状态栏高度 */
                left: 0;
                right: 0;
                z-index: 30;
                background: linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,27,75,0.97) 100%);
                border-bottom: 1px solid rgba(139,92,246,0.4);
                padding: 8px 16px;
                display: none;
                flex-direction: column;
                gap: 4px;
                backdrop-filter: blur(8px);
                box-shadow: 0 4px 24px rgba(139,92,246,0.15);
            }
            #train-runeword-banner.visible {
                display: flex;
            }
            .rw-banner-header {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .rw-banner-icon {
                font-size: 18px;
                line-height: 1;
            }
            .rw-banner-name {
                font-size: 13px;
                font-weight: 800;
                color: #c4b5fd;
                letter-spacing: 0.05em;
            }
            .rw-banner-level {
                font-size: 10px;
                color: #7c3aed;
                background: rgba(139,92,246,0.15);
                border: 1px solid rgba(139,92,246,0.3);
                border-radius: 4px;
                padding: 1px 6px;
                font-weight: bold;
            }
            .rw-banner-desc {
                font-size: 11px;
                color: #a5b4fc;
                line-height: 1.6;
                padding-left: 26px;
            }
            .rw-banner-params {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                padding-left: 26px;
            }
            .rw-banner-param-tag {
                font-size: 10px;
                color: #818cf8;
                background: rgba(99,102,241,0.12);
                // @section:ui_overlay_panels - Overlay 面板初始化（商店/命运/设置）
                border: 1px solid rgba(99,102,241,0.25);
                border-radius: 4px;
                padding: 1px 7px;
                font-family: monospace;
            }
            @media (max-width: 767px) {
                .train-panel-content { max-height: 50vh; }
                #train-attr-grid { grid-template-columns: repeat(2, 1fr) !important; }
                #train-sidebar { width: 160px; min-width: 160px; }
            }
        `;
        document.head.appendChild(style);

        ui.innerHTML = `
                <!-- 左侧主战斗区域 -->
            <div id="train-main-area">
                <!-- 顶部状态栏 -->
                <div class="absolute top-0 left-0 right-0 h-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 z-20">
                    <div class="text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        Combat Simulation
                    </div>
                    <div id="train-stats" class="text-amber-400 font-mono text-xs">DPS: 0 | TOTAL: 0</div>
                    <button onclick="game.trainingGround.exit()" class="text-slate-400 hover:text-white text-sm">退出</button>
                </div>
                <!-- 符文词条效果横幅 -->
                <div id="train-runeword-banner">
                    <div class="rw-banner-header">
                        <span class="rw-banner-icon" id="rw-banner-icon"></span>
                        <span class="rw-banner-name" id="rw-banner-name"></span>
                        <span class="rw-banner-level" id="rw-banner-level"></span>
                    </div>
                    <div class="rw-banner-desc" id="rw-banner-desc"></div>
                    <div class="rw-banner-params" id="rw-banner-params"></div>
                </div>
                <!-- 快捷操作按鈕 (仅在面板收起时显示) -->
                <div id="train-quick-actions" class="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 z-[450] transition-opacity duration-300">
                    <button onclick="game.trainingGround.fireBullet()" class="w-12 h-12 rounded-full bg-indigo-600/80 backdrop-blur-md border border-indigo-400/50 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center active:scale-90 transition-transform">
                        <span class="text-xl">🔥</span>
                    </button>
                    <button onclick="game.trainingGround.spawnEnemy()" class="w-12 h-12 rounded-full bg-red-600/80 backdrop-blur-md border border-red-400/50 text-white shadow-lg shadow-red-500/20 flex items-center justify-center active:scale-90 transition-transform">
                        <span class="text-xl">👾</span>
                    </button>
                </div>
                <!-- 底部控制面板 -->
                <div id="train-control-panel" class="collapsed">
                    <button id="train-toggle-main" onclick="game.trainingGround.toggleMainPanel()">▲ 展开配置</button>
                    <div class="flex border-b border-slate-700 bg-slate-900/50">
                        <button onclick="game.trainingGround.switchTab('bullet')" id="tab-btn-bullet" class="train-tab-btn active">子弹编辑</button>
                        <button onclick="game.trainingGround.switchTab('enemy')" id="tab-btn-enemy" class="train-tab-btn">敌人配置</button>
                    </div>
                    <!-- 子弹编辑面板 -->
                    <div id="panel-bullet" class="train-panel-content active">
                        <div class="flex flex-col md:flex-row gap-4">
                            <div class="flex-1">
                                <div id="train-attr-grid" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2"></div>
                            </div>
                            <div class="hidden md:flex w-32 shrink-0 flex-col gap-2">
                                <button onclick="game.trainingGround.fireBullet()" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex flex-col items-center justify-center transition-all active:scale-95">
                                    <span class="text-xl">🔥</span>
                                    <span class="text-sm">发射测试</span>
                                </button>
                                <button onclick="game.trainingGround.resetBullet()" class="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px]">重置配方</button>
                            </div>
                        </div>
                        <div id="train-bullet-preview" class="mt-2"></div>
                    </div>
                    <!-- 敌人配置面板 -->
                    <div id="panel-enemy" class="train-panel-content">
                        <div class="flex gap-2 flex-wrap">
                            <button onclick="game.trainingGround.spawnEnemy()" class="py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors text-sm">召唤敌人</button>
                            <button onclick="game.trainingGround.clearEnemies()" class="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold transition-colors text-sm">清空</button>
                            <button onclick="game.phase_enemy_startLogic()" class="py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition-colors text-sm">触发敌人行动</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(ui);
        this.initSidebar();
        this.renderAttributeControls();
        this.updateBulletPreview();
    }

    clearEnemies() {
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
        if (this.game.particleCounts) { for (const k in this.game.particleCounts) this.game.particleCounts[k] = 0; }
    }

    adjustBullet(key, delta) {
        if (key === 'isLaser' || key === 'isMatryoshka') {
            this.bulletConfig[key] = !this.bulletConfig[key];
        } else {
            this.bulletConfig[key] = Math.max(0, (this.bulletConfig[key] || 0) + delta);
        }
        this.renderAttributeControls();
        this.updateBulletPreview();
        // [修复] 如果修改了连射，同步更新 HUD
        if (key === 'multicast') {
            eventBus.emit(EVENT_TYPES.UI_MULTICAST_UPDATE, { total: 1 + (this.bulletConfig.multicast || 0), bonusAmount: delta > 0 ? 1 : 0 });
        }
    }

    renderAttributeControls() {
        const container = document.getElementById('train-attr-grid');
        if (!container) return;
        container.innerHTML = '';
        
        Object.entries(this.bulletConfig).forEach(([key, val]) => {
            const item = document.createElement('div');
            item.className = 'flex flex-col gap-1 p-2 bg-slate-800/60 border border-slate-700 rounded-lg';
            
            let displayVal = val;
            if (typeof val === 'boolean') displayVal = val ? 'ON' : 'OFF';

            item.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="text-[10px] text-slate-400 uppercase font-bold">${key}</span>
                    <span class="text-xs font-mono text-cyan-400">${displayVal}</span>
                </div>
                <div class="flex gap-1">
                    <button onclick="game.trainingGround.adjustBullet('${key}', ${typeof val === 'boolean' ? '0' : '-1'})" class="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]">${typeof val === 'boolean' ? 'TOGGLE' : '-'}</button>
                    ${typeof val === 'number' ? `<button onclick="game.trainingGround.adjustBullet('${key}', 1)" class="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]">+</button>` : ''}
                </div>
            `;
            container.appendChild(item);
        });
    }

    updateBulletPreview() {
        const preview = document.getElementById('train-bullet-preview');
        if (!preview) return;
        const cfg = this.bulletConfig;
        preview.innerHTML = `
            <div class="flex flex-wrap gap-1">
                <span class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] border border-purple-500/30">⚔️ ATK ${cfg.damage}</span>
                ${cfg.bounce > 0 ? `<span class="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] border border-green-500/30">⤴️ BNC ${cfg.bounce}</span>` : ''}
                ${cfg.pierce > 0 ? `<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] border border-red-500/30">↗️ PRC ${cfg.pierce}</span>` : ''}
                ${cfg.scatter > 0 ? `<span class="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px] border border-yellow-500/30">🔱 SCT ${cfg.scatter}</span>` : ''}
                ${cfg.pyro > 0 ? `<span class="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] border border-orange-500/30">🔥 PYRO ${cfg.pyro}</span>` : ''}
                ${cfg.cryo > 0 ? `<span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] border border-cyan-500/30">❄️ CRYO ${cfg.cryo}</span>` : ''}
                ${cfg.lightning > 0 ? `<span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] border border-blue-500/30">⚡ LGT ${cfg.lightning}</span>` : ''}
                ${cfg.multicast > 0 ? `<span class="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300 text-[10px] border border-slate-500/30">🔗 MULTI ${cfg.multicast}</span>` : ''}
                ${cfg.isLaser ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">🔦 LASER</span>` : ''}
            </div>
        `;
    }

    // ── 场景化配置方法 ────────────────────────────────────────────

    /**
     * 初始化右侧边栏 DOM（由 initUI 调用）
     */
    initSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'train-sidebar';
        sidebar.innerHTML = `
            <!-- 侧边栏标题 -->
            <div class="train-sidebar-header">
                <span class="text-xs font-bold tracking-widest text-cyan-400 uppercase">場景配置</span>
                <button id="train-sidebar-toggle" onclick="game.trainingGround.toggleSidebar()" title="收起側邊欄" class="text-slate-500 hover:text-slate-300 text-xs transition-colors">◀</button>
            </div>
            <!-- 分类 Tab -->
            <div class="train-sidebar-tabs" id="train-sidebar-tabs">
                <button onclick="game.trainingGround.switchCategory('enemy')" id="scat-btn-enemy" class="train-scat-btn active">敵人</button>
                <button onclick="game.trainingGround.switchCategory('attribute')" id="scat-btn-attribute" class="train-scat-btn">屬性</button>
                <button onclick="game.trainingGround.switchCategory('boss')" id="scat-btn-boss" class="train-scat-btn">Boss</button>
                <button onclick="game.trainingGround.switchCategory('runeword')" id="scat-btn-runeword" class="train-scat-btn">符文</button>
            </div>
            <!-- 场景列表 -->
            <div id="train-scenario-list" class="train-scenario-list"></div>
            <!-- 场景说明 -->
            <div id="train-scenario-desc" class="train-scenario-desc">← 選擇一個場景開始演示</div>
            <!-- 操作按钮 -->
            <div class="train-sidebar-actions">
                <button onclick="game.trainingGround.triggerScenarioAction()" id="train-demo-btn" class="train-demo-btn" disabled>▶ 觸發演示</button>
                <button onclick="game.trainingGround.resetCurrentScenario()" id="train-reset-btn" class="train-reset-btn" disabled>⟳ 重置場景</button>
            </div>
        `;
        document.getElementById('phase-training').appendChild(sidebar);
        this.renderScenarioList();
    }

    /**
     * 切换场景分类
     */
    switchCategory(categoryId) {
        this.currentCategory = categoryId;
        document.querySelectorAll('.train-scat-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`scat-btn-${categoryId}`);
        if (btn) btn.classList.add('active');
        this.renderScenarioList();
    }

    /**
     * 渲染场景列表
     */
    renderScenarioList() {
        const listEl = document.getElementById('train-scenario-list');
        if (!listEl) return;
        const scenarios = TRAINING_SCENARIOS.scenarios.filter(s => s.categoryId === this.currentCategory);
        listEl.innerHTML = scenarios.map(s => `
            <button onclick="game.trainingGround.loadScenario('${s.id}')"
                id="scenario-btn-${s.id}"
                class="train-scenario-btn ${this.currentScenario?.id === s.id ? 'active' : ''}">
                <span class="train-scenario-icon">${s.icon}</span>
                <span class="train-scenario-name">${s.name}</span>
            </button>
        `).join('');
    }

    /**
     * 加载指定场景
     * @param {string} scenarioId
     */
    loadScenario(scenarioId) {
        const scenario = TRAINING_SCENARIOS.scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;
        this.currentScenario = scenario;

        // 更新列表选中状态
        this.renderScenarioList();

        // 清理战场
        this._clearBattlefield();

        // 0. 重置符文词条效果（切换场景时清空旧词条）
        this.game.activeRunewordEffects = {};
        this.game.activeRunewordStats = {};

        // 0b. 根据分类动态调整 combatGridTopY
        // 符文词条分类有顶部横幅（约70px），需要让敵人在横幅下方居中偏上放置
        const trainTopBarH = 40;
        if (scenario.categoryId === 'runeword') {
            // 横幅高度约70px，在其下方保留 8px 间距
            const bannerH = 70;
            this.game.combatGridTopY = trainTopBarH + bannerH + 8 + this.game.enemyHeight / 2;
        } else {
            // 其他分类恢复标准高度
            this.game.combatGridTopY = trainTopBarH + 8 + this.game.enemyHeight / 2;
        }

        // 0a. 符文词条场景特殊处理：模拟词条激活状态
        if (scenario.categoryId === 'runeword' && scenario.runewordId) {
            const rwDef = RUNEWORD_DB.find(rw => rw.id === scenario.runewordId);
            if (rwDef && rwDef.effectId) {
                const level = scenario.runewordLevel || 1;
                const baseParams = rwDef.baseParams || {};
                const perLevelParams = rwDef.perLevelParams || {};
                const params = {};
                for (const key of Object.keys(baseParams)) {
                    params[key] = (baseParams[key] || 0) + (level - 1) * (perLevelParams[key] || 0);
                }
                this.game.activeRunewordEffects[rwDef.effectId] = { level, params };
            }
        }

        // 1. 应用子弹配置（如果场景有预设）
        if (scenario.bulletConfig) {
            this.bulletConfig = { ...scenario.bulletConfig };
            this.renderAttributeControls();
            this.updateBulletPreview();
        }

        // 2. 执行初始敌人布置
        if (scenario.setup) {
            try {
                scenario.setup(this.game);
            } catch (e) {
                console.warn('[TrainingGround] scenario.setup error:', e);
            }
        }
        // 3a. Boss 场景特殊处理：激活入场动画（试炼场不走 phase_startCombatPhase）
        if (scenario.categoryId === 'boss') {
            this.game.enemies.forEach(e => {
                if (e.type === 'boss' && e._pendingEntrance) {
                    e._pendingEntrance = false;
                    e.entranceTimer = 1; // 激活入场动画
                }
            });
        }

        // 3. 更新场景说明
        const descEl = document.getElementById('train-scenario-desc');
        if (descEl) descEl.textContent = scenario.desc || '';

        // 3b. 符文词条横幅：显示/隐藏并填充词条效果信息
        const banner = document.getElementById('train-runeword-banner');
        if (banner) {
            if (scenario.categoryId === 'runeword' && scenario.runewordId) {
                const rwDef = RUNEWORD_DB.find(rw => rw.id === scenario.runewordId);
                if (rwDef) {
                    const level = scenario.runewordLevel || 1;
                    const iconEl = document.getElementById('rw-banner-icon');
                    const nameEl = document.getElementById('rw-banner-name');
                    const levelEl = document.getElementById('rw-banner-level');
                    const descBannerEl = document.getElementById('rw-banner-desc');
                    const paramsEl = document.getElementById('rw-banner-params');

                    if (iconEl) iconEl.textContent = scenario.icon || '🔮';
                    if (nameEl) nameEl.textContent = rwDef.name;
                    if (levelEl) levelEl.textContent = 'Lv.' + level;
                    if (descBannerEl) descBannerEl.textContent = rwDef.effect_desc || '';

                    // 生成参数标签
                    if (paramsEl) {
                        const baseParams = rwDef.baseParams || {};
                        const perLevelParams = rwDef.perLevelParams || {};
                        const paramLabels = {
                            damageBonus: '伤害加成', damageAmp: '伤害加深/次',
                            decayBonus: '衰减系数加成', flatDamage: '每弹跳固定加伤',
                            triggerChance: '触发概率', critChance: '暴击概率',
                            critDamage: '暴击倍率', initialBonus: '初始加成',
                            decayPerHit: '每次命中衰减', requiredBounces: '触发弹跳次数',
                            radius: '范围', tempDrop: '降温', tempIncrease: '升温/次',
                            damagePenalty: '伤害惩罚', angleMultiplier: '夹角倍率',
                            baseRadiusRatio: '爆炸范围基础倍率', radiusBonusPerLayer: '每层范围加成',
                            extraChains: '额外闪电链', mutationChance: '变异概率',
                            damagePerKill: '每次击杀加伤', elementPenalty: '属性惩罚',
                            damageRatio: '伤害倍率', interval: '触发间隔(s)',
                            trueDamageRatio: '真实伤害比例'
                        };
                        paramsEl.innerHTML = Object.entries(baseParams).map(([key, val]) => {
                            const perLv = perLevelParams[key];
                            const computedVal = val + (level - 1) * (perLv || 0);
                            const label = paramLabels[key] || key;
                            const displayVal = typeof computedVal === 'number'
                                ? (computedVal % 1 !== 0 ? (computedVal * 100).toFixed(0) + '%' : computedVal)
                                : computedVal;
                            return `<span class="rw-banner-param-tag">${label}: ${displayVal}</span>`;
                        }).join('');
                    }

                    banner.classList.add('visible');
                } else {
                    banner.classList.remove('visible');
                }
            } else {
                banner.classList.remove('visible');
            }
        }

        // 4. 启用操作按钮
        const demoBtn = document.getElementById('train-demo-btn');
        const resetBtn = document.getElementById('train-reset-btn');
        if (demoBtn) demoBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;

        // 4. 同步连射倍率 UI（试炼场环境下强制使用 bulletConfig.multicast）
        eventBus.emit(EVENT_TYPES.UI_MULTICAST_UPDATE, { total: 1 + (this.bulletConfig.multicast || 0), bonusAmount: 0 });

        // 5. 重置伤害统计
        this.game.roundDamage = 0;
        this.stats.totalDamage = 0;
        this.stats.startTime = 0;
        this.stats.dps = 0;
    }

    /**
     * 触发当前场景的演示动作
     */
    triggerScenarioAction() {
        if (!this.currentScenario) return;
        // 触发演示时自动收起侧边栏，让战斗区域全屏展示
        this.collapseSidebar();
        if (this.currentScenario.demoAction) {
            try {
                this.currentScenario.demoAction(this.game, this);
            } catch (e) {
                console.warn('[TrainingGround] demoAction error:', e);
            }
        } else {
            // 默认：发射一颗子弹
            this.fireBullet();
        }
    }

    /**
     * 重置当前场景（重新执行 setup）
     */
    resetCurrentScenario() {
        if (this.currentScenario) {
            this.loadScenario(this.currentScenario.id);
        } else {
            this._clearBattlefield();
        }
    }

    /**
     * 切换侧边栏展开/收起
     */
    toggleSidebar() {
        const sidebar = document.getElementById('train-sidebar');
        const toggleBtn = document.getElementById('train-sidebar-toggle');
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.toggle('collapsed');
        if (toggleBtn) toggleBtn.textContent = isCollapsed ? '▶' : '◀';
    }

    /**
     * 将侧边栏收起（仅收起，不切换）
     */
    collapseSidebar() {
        const sidebar = document.getElementById('train-sidebar');
        const toggleBtn = document.getElementById('train-sidebar-toggle');
        if (!sidebar) return;
        sidebar.classList.add('collapsed');
        if (toggleBtn) toggleBtn.textContent = '▶';
    }

    /**
     * 清空战场（敌人、子弹、粒子等）
     */
    _clearBattlefield() {
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
        if (this.game.particleCounts) { for (const k in this.game.particleCounts) this.game.particleCounts[k] = 0; }
        this.game.sonSwordQueue = [];
        this.game.swordQis = [];
        this.game.windAnchors = [];
        this.game.activeWindMatrices = [];
        this.game.roundDamage = 0;
        this.stats.totalDamage = 0;
        this.stats.startTime = 0;
        this.stats.dps = 0;
        // [修复] 清理 blade_storm 状态，避免切换场景时残留首发子弹绑定
        this.game._roundFirstShotId = null;
        this.game._bladeStormProjectile = null;
        this.game._bladeStormTimer = 0;
    }

    // ── 原有方法（保持不变）────────────────────────────────────────

    spawnEnemy() {
        const w = this.game.enemyWidth;
        const h = this.game.enemyHeight;
        const top = this.game.combatGridTopY;
        const col = Math.floor(Math.random() * 6);
        const x = col * w + w/2;
        const y = top + 1 * h + h/2;
        this.game.enemies.push(new Enemy(x, y, 60, 60, 1000));
    }

    fireBullet() {
        const angle = -Math.PI/2;
        const vel = new Vec2(Math.cos(angle)*15, Math.sin(angle)*15);
        // [修复] 将 bulletConfig 推入 ammoQueue，确保 combat_fireNextShot 中的词条效果能被正确应用
        const recipe = { ...this.bulletConfig };
        this.game.ammoQueue = [recipe];
        // [修复] 每次手动发射在试炼场中都视为新回合的首发，重置 blade_storm 绑定状态
        this.game._roundFirstShotId = null;
        this.game._bladeStormProjectile = null;
        this.game._bladeStormTimer = 0;
        this.game.pendingFireVelocity = vel;
        this.game.isChargingShot = true;
        this.game.chargeProgress = 0;

        if (this.stats.startTime === 0) this.stats.startTime = Date.now();
    }

    /**
     * 通过完整的词条应用流程发射一颗子弹（供词条场景 demoAction 使用）
     * 将 recipe 推入 ammoQueue，经由 combat_fireNextShot 应用所有激活的词条效果后发射
     * @param {Object} recipe - 子弹配方（通常为 tg.bulletConfig 的浅拷贝）
     */
    fireBulletWithEffects(recipe) {
        const angle = -Math.PI/2;
        const vel = new Vec2(Math.cos(angle)*15, Math.sin(angle)*15);
        this.game.ammoQueue = [{ ...recipe }];
        // [修复] 每次通过词条流程发射也重置 blade_storm 绑定状态（视为新回合首发）
        this.game._roundFirstShotId = null;
        this.game._bladeStormProjectile = null;
        this.game._bladeStormTimer = 0;
        this.game.pendingFireVelocity = vel;
        this.game.isChargingShot = true;
        this.game.chargeProgress = 0;

        if (this.stats.startTime === 0) this.stats.startTime = Date.now();
    }

    resetBullet() {
        this.bulletConfig = {
            damage: 10, bounce: 0, pierce: 0, scatter: 0, multicast: 0,
            pyro: 0, cryo: 0, lightning: 0, wind: 0,
            isLaser: false, isMatryoshka: false, type: 'normal'
        };
        this.renderAttributeControls();
        this.updateBulletPreview();
    }

    update() {
        if (!this.active) return;
        this.stats.totalDamage = this.game.roundDamage;
        if (this.stats.totalDamage > 0 && this.stats.startTime === 0) {
            this.stats.startTime = Date.now();
        }
        if (this.stats.startTime > 0) {
            const duration = (Date.now() - this.stats.startTime) / 1000;
            if (duration > 0.5) {
                this.stats.dps = Math.floor(this.stats.totalDamage / duration);
            }
        }
        const statsEl = document.getElementById('train-stats');
        if (statsEl) {
            statsEl.innerText = `DPS: ${this.stats.dps.toLocaleString()} | TOTAL: ${Math.floor(this.stats.totalDamage).toLocaleString()}`;
        }
    }

    enter() {
        this.active = true;
        this.game.hasCombatWall = true; 
        this.game.phase_switchPhase('training');
        // 试炼场顶部栏高度为 40px（h-10），重新计算 combatGridTopY
        // 避免使用 unified-top-bar（52px）导致的顶部空档
        const trainTopBarH = 40;
        this.game.combatGridTopY = trainTopBarH + 8 + this.game.enemyHeight / 2;
        document.getElementById('phase-training').style.display = 'flex';
        document.getElementById('phase-training').classList.remove('hidden-phase');
        document.getElementById('phase-training').classList.add('active-phase');
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
        if (this.game.particleCounts) { for (const k in this.game.particleCounts) this.game.particleCounts[k] = 0; }
        this.game.sonSwordQueue = [];
        this.game.swordQis = [];
        this.game.windAnchors = []; 
        this.game.activeWindMatrices = []; 
        this.game.roundDamage = 0;
        this.stats.totalDamage = 0;
        this.stats.lastTotal = 0;
        this.stats.dps = 0;
        this.stats.startTime = 0;
        this.game.ammoQueue = [];
        this.game.burstQueue = [];
        this.game.isChargingShot = false;
        this.game.chargeProgress = 0;
        this.game.isReloading = false;
        this.game.reloadProgress = 0;
        this.game.isEnemyTurn = false;
        this.game.combat_runeCharge_init();
        // [修复] 进入试炼场时，同步初始连射倍率（默认为 1）
        eventBus.emit(EVENT_TYPES.UI_MULTICAST_UPDATE, { total: 1 + (this.bulletConfig.multicast || 0), bonusAmount: 0 });
    }

    exit() {
        this.active = false;
        this.game.hasCombatWall = false; 
        this.game.windAnchors = []; 
        this.game.activeWindMatrices = [];
        document.getElementById('phase-training').style.display = 'none';
        document.getElementById('phase-training').classList.remove('active-phase');
        document.getElementById('phase-training').classList.add('hidden-phase');
        this.game.phase_switchPhase('meta');
    }

    toggleMainPanel() {
        const panel = document.getElementById('train-control-panel');
        const btn = document.getElementById('train-toggle-main');
        const quickActions = document.getElementById('train-quick-actions');
        const isCollapsed = panel.classList.toggle('collapsed');
        btn.innerText = isCollapsed ? '▲ 展开配置' : '▼ 收起配置';
        if (quickActions) {
            quickActions.style.opacity = isCollapsed ? '1' : '0';
            quickActions.style.pointerEvents = isCollapsed ? 'auto' : 'none';
        }
    }

    switchTab(tab) {
        document.querySelectorAll('.train-tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`tab-btn-${tab}`).classList.add('active');
        document.querySelectorAll('.train-panel-content').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${tab}`).classList.add('active');
    }
}


// ==================== 真理之书系统 ====================

class TruthBook {
    constructor(mainGame) {
        this.mainGame = mainGame;
        this.canvas = document.getElementById('truth-demo-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.active = false;
        this.currentEntry = null;
        this.demoGame = null;
        this.instructionIdx = 0;
        this.waitTimer = 0;
        this.simFrame = 0;
        this.scanLineY = 0;
        this.gridOffset = 0;
        this.initUI();
        window.addEventListener('resize', () => { if (this.active) this.resize(); });
    }

    initUI() {
        const enemyList = document.getElementById('truth-enemy-list');
        const attrList = document.getElementById('truth-attr-list');
        if(enemyList) enemyList.innerHTML = '';
        if(attrList) attrList.innerHTML = '';
        if (typeof TRUTH_BOOK_DATA !== 'undefined') {
            TRUTH_BOOK_DATA.enemies.forEach(entry => {
                if (enemyList) enemyList.appendChild(this.createListButton(entry));
            });
            TRUTH_BOOK_DATA.attributes.forEach(entry => {
                if (attrList) attrList.appendChild(this.createListButton(entry));
            });
        }
    }

    createListButton(entry) {
        const btn = document.createElement('button');
        btn.className = 'truth-list-btn flex items-center gap-3 p-3 w-full bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all text-left group mb-2';
        btn.innerHTML = `
            <span class="text-2xl group-hover:scale-110 transition-transform filter drop-shadow-md">${entry.icon}</span>
            <div class="flex flex-col">
                <span class="text-sm font-bold text-slate-300 group-hover:text-cyan-100 transition-colors">${entry.name}</span>
                <span class="text-[9px] text-slate-500 uppercase tracking-wider group-hover:text-cyan-400/70">${entry.tags[0] || 'ENTITY'}</span>
            </div>
        `;
        btn.onclick = () => this.showEntry(entry, btn);
        return btn;
    }

    showEntry(entry, btnElement) {
        this.currentEntry = entry;
        const emptyState = document.getElementById('truth-empty-state');
        if (emptyState) emptyState.classList.add('hidden');
        const content = document.getElementById('truth-content');
        if (content) content.classList.remove('hidden');
        const iconEl = document.getElementById('truth-item-icon');
        if (iconEl) iconEl.innerText = entry.icon;
        const nameEl = document.getElementById('truth-item-name');
        if (nameEl) nameEl.innerText = entry.name;
        const descEl = document.getElementById('truth-item-desc');
        if (descEl) descEl.innerText = entry.desc;
        const tagsCont = document.getElementById('truth-item-tags');
        if (tagsCont) {
            tagsCont.innerHTML = '';
            entry.tags.forEach(tag => {
                const s = document.createElement('span');
                s.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm tracking-wide';
                s.innerText = tag.toUpperCase();
                tagsCont.appendChild(s);
            });
        }
        document.querySelectorAll('.truth-list-btn').forEach(b => {
            b.classList.remove('border-cyan-500', 'bg-cyan-900/30');
            b.classList.add('border-slate-700/50', 'bg-slate-800/40');
        });
        if (btnElement) {
            btnElement.classList.remove('border-slate-700/50', 'bg-slate-800/40');
            btnElement.classList.add('border-cyan-500', 'bg-cyan-900/30');
        }
        this.startDemo(entry);
    }

    resetDemo() { if (this.currentEntry) this.startDemo(this.currentEntry); }

    startDemo(entry) {
        this.demoGame = createCombatContext(this.mainGame, this.canvas);
        if (this.canvas && this.canvas.width > 0) {
            this.demoGame.width = this.viewWidth || this.canvas.width;
            this.demoGame.height = this.viewHeight || this.canvas.height;
        }
        if (entry.setup) entry.setup(this.demoGame);
        this.instructionIdx = 0;
        this.waitTimer = 0;
        this.simFrame = 0;
        this.scanLineY = 0;
        document.getElementById('truth-demo-log').innerHTML = '';
        this.active = true;
        this.resize();
        this.addLog("SIMULATION_INIT... OK", "text-green-400");
    }

    resize() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (parent) {
            const rect = parent.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.ctx.scale(dpr, dpr);
            this.viewWidth = rect.width;
            this.viewHeight = rect.height;
        }
    }

    update() {
        if (!this.active || !this.demoGame) return;
        const _realGame = window.game;
        window.game = this.demoGame;
        try {
            this.simFrame++;
            const timeDisplay = document.getElementById('truth-sim-time');
            if (timeDisplay && this.simFrame % 5 === 0) {
                timeDisplay.innerText = `T: ${this.simFrame.toString().padStart(4, '0')}`;
            }
            if (this.waitTimer > 0) {
                this.waitTimer--;
            } else {
                const loop = this.currentEntry.loop;
                if (loop && loop.length > 0) {
                    const inst = loop[this.instructionIdx];
                    this.executeInstruction(inst);
                    this.instructionIdx = (this.instructionIdx + 1) % loop.length;
                }
            }
            const ts = 1.0;
            this.demoGame.enemies.forEach(e => {
                e.update(ts, this.demoGame);
            });
            this.demoGame.projectiles.forEach(p => {
                const margin = 20;
                if (p.pos.x < margin || p.pos.x > this.demoGame.width - margin) {
                    p.vel.x *= -1;
                    p.pos.x = p.pos.x < margin ? margin : this.demoGame.width - margin;
                    if (p.config.bounce) p.config.bounce--;
                }
                if (p.pos.y < margin) {
                    p.vel.y *= -1;
                    p.pos.y = margin;
                    if (p.config.bounce) p.config.bounce--;
                }
                p.update(this.demoGame.width, this.demoGame.height, this.demoGame.enemies, this.demoGame.spawn_spawnBullet.bind(this.demoGame), ts);
            });
            this.demoGame.particles.forEach(p => p.update(ts));
            // [修复] 更新分身孢子，确保分身逻辑正常触发
            this.demoGame.spores.forEach(s => s.update(ts, this.demoGame));
            this.demoGame.floatingTexts.forEach(f => {
                f.update(ts);
                if (f instanceof FloatingText && f.life <= 0) f.active = false;
                else if (f.life !== undefined) { f.pos.y -= 0.5; f.life--; }
            });
            this.demoGame.shockwaves.forEach(s => s.update(ts));
            this.demoGame.lightningBolts.forEach(l => l.update(ts));
            this.demoGame.fireWaves.forEach(f => f.update(ts));
            this.demoGame.healWaves.forEach(h => h.update(ts, this.demoGame));
            
            this.demoGame.projectiles = this.demoGame.projectiles.filter(p => p.active);
            this.demoGame.particles = this.demoGame.particles.filter(p => p.active);
            this.demoGame.spores = this.demoGame.spores.filter(s => s.active);
            this.demoGame.floatingTexts = this.demoGame.floatingTexts.filter(f => f.life > 0);
            this.demoGame.shockwaves = this.demoGame.shockwaves.filter(s => s.alpha > 0);
            this.demoGame.lightningBolts = this.demoGame.lightningBolts.filter(l => l.life > 0);
            this.demoGame.fireWaves = this.demoGame.fireWaves.filter(f => f.active);
            this.demoGame.healWaves = this.demoGame.healWaves.filter(h => h.active);
            this.draw();
        } finally {
            window.game = _realGame;
        }
    }

    executeInstruction(inst) {
        if (!inst) return;
        switch(inst.type) {
            case 'log': this.addLog(inst.text); break;
            case 'wait': this.waitTimer = inst.frames; break;
            case 'enemy_turn': 
                const actor = this.demoGame.enemies[inst.targetIdx || 0];
                if (actor) {
                    actor.hasActedThisTurn = false;
                    this.mainGame.phase_enemy_processTurn.call(this.demoGame, actor);
                }
                break;
            case 'spawn_projectile':
                const px = inst.x || this.demoGame.width / 2;
                const py = inst.y || this.demoGame.height - 150;
                const angle = -Math.PI/2 + (Math.random()-0.5) * 0.1;
                const pvel = inst.vel ? new Vec2(inst.vel.x, inst.vel.y) : new Vec2(Math.cos(angle)*15, Math.sin(angle)*15);
                const config = inst.config || {};
                if (config.isLaser && config.laser > 0) {
                    const bullet = this.demoGame.spawn_spawnBullet(px, py, pvel, config);
                    if (this.demoGame.combat_laser_fire) {
                        this.demoGame.combat_laser_fire(bullet, config.laser);
                    }
                } else {
                    this.demoGame.spawn_spawnBullet(px, py, pvel, config);
                }
                break;
            case 'reset':
                this.waitTimer = inst.delay || 60;
                this.addLog("--- RESET ---", "text-slate-600");
                this.startDemo(this.currentEntry);
                break;
        }
    }

    addLog(text, colorClass = 'text-cyan-400') {
        const logCont = document.getElementById('truth-demo-log');
        if (!logCont) return;
        const div = document.createElement('div');
        div.className = `flex items-center gap-2 ${colorClass}`;
        div.innerHTML = `<span class="text-slate-600 text-[8px]">[${this.simFrame}]</span> <span>${text}</span>`;
        logCont.appendChild(div);
        if (logCont.childNodes.length > 6) logCont.removeChild(logCont.firstChild);
        logCont.scrollTop = logCont.scrollHeight;
    }

    draw() {
        const ctx = this.ctx;
        const w = this.viewWidth;
        const h = this.viewHeight;
        const gameW = this.demoGame.width;
        const gameH = this.demoGame.height;
        ctx.clearRect(0, 0, w, h);
        const gridSize = 60;
        this.gridOffset = (this.gridOffset + 0.5) % gridSize;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = this.gridOffset; y <= h; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
        ctx.save();
        const padding = 20;
        const scale = Math.min((w - padding) / gameW, (h - padding) / gameH);
        const offsetX = (w - gameW * scale) / 2;
        const offsetY = (h - gameH * scale) / 2;
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, gameW, gameH);
        this.demoGame.enemies.forEach(e => e.draw(ctx));
        this.demoGame.projectiles.forEach(p => p.draw(ctx));
        this.demoGame.particles.forEach(p => p.draw ? p.draw(ctx) : null);
        // [修复] 绘制分身孢子
        this.demoGame.spores.forEach(s => s.draw(ctx));
        this.demoGame.shockwaves.forEach(s => s.draw(ctx));
        this.demoGame.lightningBolts.forEach(l => l.draw(ctx));
        this.demoGame.fireWaves.forEach(f => f.draw(ctx));
        this.demoGame.healWaves.forEach(h => h.draw(ctx));
        this.demoGame.floatingTexts.forEach(f => f.draw(ctx));
        this.scanLineY = (this.scanLineY + 2) % gameH;
        ctx.fillStyle = `rgba(6, 182, 212, 0.1)`;
        ctx.fillRect(0, this.scanLineY, gameW, 2);
        ctx.restore();
    }
}

// ==================== createCombatContext 工厂函数 ====================
/**
 * 创建演示用的战斗上下文对象。
 *
 * 通过 .call(context, ...) 借用 mainGame 的真实战斗方法，避免手动 Mock 带来的
 * 逻辑漂移问题。UI 类方法统一屏蔽为空函数，不影响演示逻辑。
 *
 * @param {object} mainGame - 主游戏实例（已混入所有 Mixin 方法）
 * @param {HTMLCanvasElement} canvas - 演示画布（供 combat_wind 系列方法读取尺寸）
 * @returns {object} 包含完整战斗状态与方法的演示上下文
 */
function createCombatContext(mainGame, canvas) {
    const context = {
        // ── 全局配置引用（演示环境需要访问 CONFIG）────────────────────────────
        CONFIG: CONFIG,
        
        // ── 画布与尺寸 ────────────────────────────────────────────────────────
        canvas: canvas,
        ctx: canvas ? canvas.getContext('2d') : null,
        width: canvas ? (canvas.width || 600) : 600,
        height: canvas ? (canvas.height || 800) : 800,
        enemyWidth: 60,
        enemyHeight: 60,
        combatGridTopY: 90, 
        enemies: [],
        projectiles: [],
        particles: [],
        // [Perf] 与主 game 实例保持字段一致，避免 spawn_createParticle 访问 undefined
        particleCounts: { wind_slash: 0, line: 0, ember: 0, mist: 0, shard: 0, spark: 0, smoke: 0 },
        _particlePool: [],
        floatingTexts: [],
        shockwaves: [],
        lightningBolts: [],
        spores: [],
        fireWaves: [],
        healWaves: [],
        sonSwords: [],
        sonSwordQueue: [],
        swordQis: [],
        runeLootItems: [],
        windAnchors: [],
        activeWindMatrices: [],
        windMatrixDuration: 40,
        butterflyCircles: [],
        butterflyBlades: [],
        stormCores: [],
        phase: 'combat',
        isEnemyTurn: false,
        hasCombatWall: true,
        isDemo: true,
        round: 1,
        timeScale: 1.0,
        slowMotionTimer: 0,
        screenShake: 0,
        waveMomentumTimer: 0,
        defeatLineY: 570,
        roundDamage: 0,
        currentShotDamage: 0,
        currentShotDamageByAttr: {},
        shotDamageHistory: [],
        shotIdCounter: 0,
        shotDamageMap: new Map(),
        frameDamageAccumulator: 0,
        runeGrid: Array(9).fill(null),
        runeInventory: [],
        activeRunewordEffects: {},
        activeRunewordStats: {},
        runeChargeValue: 0,
        runeChargeLevel: 0,
        runeChargeCurrentRune: null,
        runeChargeCurrentLevel: 1,
        ammoQueue: [],
        burstQueue: [],
        ownedRelics: [],
        score: 0,
        scoreMultiplier: 1.0,
        spawnedEnemiesInRound: 0,
        postBossMultiplier: 1.0,
        uiCache: null,
        triggerScreenShake(amount) {
            this.screenShake = amount;
        },
        ui_triggerScreenShake() {},
        spawn_createParticle(...args) {
            return mainGame.spawn_createParticle.call(this, ...args);
        },
        spawn_pushParticleWithLimit(...args) {
            return mainGame.spawn_pushParticleWithLimit.call(this, ...args);
        },
        spawn_createShockwave(...args) {
            return mainGame.spawn_createShockwave.call(this, ...args);
        },
        spawn_createFloatingText(...args) {
            return mainGame.spawn_createFloatingText.call(this, ...args);
        },
        spawn_createExplosion(...args) {
            return mainGame.spawn_createExplosion.call(this, ...args);
        },
        spawn_smallWhirlwind(...args) {
            return mainGame.spawn_smallWhirlwind.call(this, ...args);
        },
        spawn_createHealWave(...args) {
            return mainGame.spawn_createHealWave.call(this, ...args);
        },
        spawn_createFireWave(...args) {
            return mainGame.spawn_createFireWave.call(this, ...args);
        },
        spawn_createHitFeedback() {},
        spawn_spawnBullet(...args) {
            return mainGame.spawn_spawnBullet.call(this, ...args);
        },
        spawn_triggerCloneSpawn(...args) {
            return mainGame.spawn_triggerCloneSpawn.call(this, ...args);
        },
        spawn_stormCore(...args) {
            return mainGame.spawn_stormCore.call(this, ...args);
        },
        combat_wind_updateStormCores(...args) {
            return mainGame.combat_wind_updateStormCores.call(this, ...args);
        },
        combat_wind_drawStormCores(...args) {
            return mainGame.combat_wind_drawStormCores.call(this, ...args);
        },
        combat_damageEnemy(...args) {
            return mainGame.combat_damageEnemy.call(this, ...args);
        },
        combat_lightning_triggerChain(...args) {
            return mainGame.combat_lightning_triggerChain.call(this, ...args);
        },
        combat_wind_addAnchor(...args) {
            return mainGame.combat_wind_addAnchor.call(this, ...args);
        },
        combat_wind_triggerSmallWhirlwindDamage(...args) {
            return mainGame.combat_wind_triggerSmallWhirlwindDamage.call(this, ...args);
        },
        combat_wind_triggerMagicCircle(...args) {
            return mainGame.combat_wind_triggerMagicCircle.call(this, ...args);
        },
        combat_wind_triggerButterflyCircle(...args) {
            return mainGame.combat_wind_triggerButterflyCircle.call(this, ...args);
        },
        combat_wind_updateButterflyCircles(...args) {
            return mainGame.combat_wind_updateButterflyCircles.call(this, ...args);
        },
        combat_wind_updateButterflyBlades(...args) {
            return mainGame.combat_wind_updateButterflyBlades.call(this, ...args);
        },
        combat_flyingSword_assignTarget(...args) {
            return mainGame.combat_flyingSword_assignTarget.call(this, ...args);
        },
        combat_flyingSword_addSon(...args) {
            return mainGame.combat_flyingSword_addSon.call(this, ...args);
        },
        combat_laser_fire(...args) {
            return mainGame.combat_laser_fire.call(this, ...args);
        },
        combat_recordDamage(...args) {
            return mainGame.combat_recordDamage.call(this, ...args);
        },
        combat_reportDamage(...args) {
            return mainGame.combat_reportDamage.call(this, ...args);
        },
        combat_runeCharge_onHit(...args) {
            return mainGame.combat_runeCharge_onHit.call(this, ...args);
        },
        combat_checkBossPhaseChange(...args) {
            return mainGame.combat_checkBossPhaseChange.call(this, ...args);
        },
        combat_tryMoveEnemy(...args) {
            return mainGame.combat_tryMoveEnemy.call(this, ...args);
        },
        calc_isAreaOccupied(...args) {
            return mainGame.calc_isAreaOccupied.call(this, ...args);
        },
        spawn_addScore() {},
        combat_runeCharge_init() {},
        combat_runeCharge_update() {},
        combat_runeCharge_draw() {}
    };
    return context;
}

export { UIManager, TrainingGround, TruthBook, TRUTH_BOOK_DATA };
