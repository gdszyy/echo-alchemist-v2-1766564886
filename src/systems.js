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
 * - eventBus（来自 event_bus.js）
 */

import { CONFIG } from './config.js';
import { Enemy, Projectile, Particle, FloatingText, CloneSpore } from './entities.js';
import { eventBus } from './event_bus.js';
import { Vec2 } from './utils/math_utils.js';

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
                ${cfg.isLaser ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">🔦 LASER</span>` : ''}
            </div>
        `;
    }
}

// ==================== 试炼场系统 ====================

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
        { id: 'boss', name: 'Boss 機制' }
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
                <!-- 快捷操作按钮 (仅在面板收起时显示) -->
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
    }

    adjustBullet(key, delta) {
        if (key === 'isLaser' || key === 'isMatryoshka') {
            this.bulletConfig[key] = !this.bulletConfig[key];
        } else {
            this.bulletConfig[key] = Math.max(0, (this.bulletConfig[key] || 0) + delta);
        }
        this.renderAttributeControls();
        this.updateBulletPreview();
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

        // 4. 启用操作按钮
        const demoBtn = document.getElementById('train-demo-btn');
        const resetBtn = document.getElementById('train-reset-btn');
        if (demoBtn) demoBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;

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
     * 清空战场（敌人、子弹、粒子等）
     */
    _clearBattlefield() {
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
        this.game.sonSwordQueue = [];
        this.game.swordQis = [];
        this.game.windAnchors = [];
        this.game.activeWindMatrices = [];
        this.game.roundDamage = 0;
        this.stats.totalDamage = 0;
        this.stats.startTime = 0;
        this.stats.dps = 0;
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
        document.getElementById('phase-training').style.display = 'flex';
        document.getElementById('phase-training').classList.remove('hidden-phase');
        document.getElementById('phase-training').classList.add('active-phase');
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
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
        this.game.pendingFireVelocity = null;
        this.game.isReloading = false;
        this.game.reloadProgress = 0;
        this.game.isEnemyTurn = false;
        this.game.combat_runeCharge_init();
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
