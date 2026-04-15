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

class TrainingGround {
    constructor(game) {
        this.game = game;
        this.active = false;
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
