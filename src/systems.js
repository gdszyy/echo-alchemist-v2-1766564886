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
import { RUNEWORD_DB, ELEMENT_RESONANCE_DB } from './rune_config.js';
import { ENEMY_V2_METADATA, ENEMY_V2_BY_ID } from './data/enemy_v2_metadata.js';
import { getEnemyV2IconSrc } from './bitmap_icons.js';
import { resolveEnemyVisualAsset, describeAssetHitStatus, buildEnemyAssetKey } from './data/enemy_visual_assets.js';
import { pixiCleanupAllEffects } from './render/pixi_effect_adapter.js';

// ==================== 真理之书数据 ====================

/**
 * [V2 资源协议] 由 ENEMY_V2_METADATA 构建图鉴条目，
 * 與試煉場 V2 矩陣共用同一份 metadata。
 */
function buildV2BestiaryEntries() {
    // V2 基底的視覺標識（圖鑒列表使用 emoji；正式美術上線後可改用 iconSrc）
    const ICON_GLYPH = {
        bastion: '🧱', maw: '🕳️', deflector: '🔷', echoSpire: '🔮',
        prism: '🌈', hive: '🥚', siege: '🚜', gravityCore: '🌀',
    };
    return ENEMY_V2_METADATA.map(meta => ({
        id: 'v2_' + meta.id,
        name: meta.name,
        icon: ICON_GLYPH[meta.id] || meta.footprint,
        iconSrc: meta.iconPath,                 // 後續可由 TruthBook 渲染為 <img>
        tags: [meta.footprint, meta.priority, ...meta.affixes],
        desc: `【${meta.name}・${meta.footprint}】基底=${meta.baseArchetype}，专属词条=${meta.affixes.join('/') || '无'}\n` +
              `登场阶段：${meta.stage}\n战术职责：${meta.role}\n针对提示：${meta.targeting}\n` +
              (meta.placeholder ? '※ 当前为占位资源，待正式美术替换。' : ''),
        // 圖鑒演示直接調用 V2 矩陣的單體場景
        setup: (game) => {
            const cx = 2.5 * game.enemyWidth + game.enemyWidth / 2;
            const cy = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
            const wPx = game.enemyWidth * meta.cols;
            const hPx = game.enemyHeight * meta.rows;
            const hp = Math.floor(200 * Math.max(1, meta.cols * meta.rows));
            const e = new Enemy(cx, cy, wPx, hPx, hp, hp,
                meta.affixes.length > 0 ? 'elite' : 'normal', meta.affixes.slice());
            e.baseArchetype = meta.baseArchetype;
            e.gridCols = meta.cols;
            e.gridRows = meta.rows;
            if (meta.cols >= 2) e.isWideEnemy = true;
            e._moveInterval = 9999;
            e._moveCooldown = 9999;
            e.hasActedThisTurn = true;
            if (typeof game.spawn_applyArchetypeShape === 'function') {
                game.spawn_applyArchetypeShape(e, meta.baseArchetype);
            }
            if (typeof e.initSprite === 'function') e.initSprite();
            game.enemies.push(e);
        },
        loop: [
            { type: 'log', text: `${meta.name}（${meta.footprint}）登場` },
            { type: 'wait', frames: 180 },
            { type: 'reset' }
        ]
    }));
}

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
        },
        // ── 敵人視覺 V2 基底圖鑒條目（來源：src/data/enemy_v2_metadata.js）──
        // 與試煉場 V2 矩陣共用同一份 metadata，避免重複維護。
        ...buildV2BestiaryEntries()
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
            id: 'venom', name: '毒素', icon: '☠️', tags: ['元素', 'DoT'],
            desc: '命中敵人時疊加毒素層數。每次敵人行動開始前結算一次毒素傷害（每層 0.8 傷害 × 共鳴倍率）。冰凍狀態下毒素暫停發作但保留層數，解凍當回合一次性結算；過熱（≥100°C）時每回合結算 2 次。毒素 DoT 不受護盾減傷影響。',
            setup: (game) => {
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1500));
            },
            loop: [
                { type: 'log', text: '疊加毒素層數' },
                { type: 'spawn_projectile', config: { damage: 5, venom: 6 }, vel: {x: 0, y: -15} },
                { type: 'wait', frames: 120 }, { type: 'reset' }
            ]
        },
        {
            id: 'overcharge', name: '超載', icon: '💥', tags: ['特殊', 'AOE'],
            desc: '子彈飛行中積累充能（彈跳 +1，穿透命中 +3）。代價：發射前 bounce/pierce 減半（共鳴可降低削減）。子彈銷毀時觸發 AoE 爆炸：傷害 = 充能數 × 超載層數 × 基礎傷害 × 0.3，半徑 = 60 + 充能數 × 4。',
            setup: (game) => {
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 4; c++) {
                        game.enemies.push(new Enemy((c+0.5) * w + w/2, top + r * h + h/2, 60, 60, 300));
                    }
                }
            },
            loop: [
                { type: 'log', text: '發射超載子彈（積累充能後爆炸）' },
                { type: 'spawn_projectile', config: { damage: 10, overcharge: 3, bounce: 4, pierce: 2 }, vel: {x: 2, y: -15} },
                { type: 'wait', frames: 240 }, { type: 'reset' }
            ]
        },
        {
            id: 'echo', name: '回響', icon: '🔁', tags: ['特殊', '分裂'],
            desc: '雙階段：研磨階段，弹珠碰撞 Peg 時按概率生成虛影 Peg（持續約 1 秒）。戰鬥階段，子弹弹跳時按 25% + echo×5% 概率向反方向鏡像生成回響子彈，繼承 50% 屬性（向下取整）。',
            setup: (game) => {
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 2 * h + h/2, 60, 60, 1000));
            },
            loop: [
                { type: 'log', text: '發射帶回響的彈跳子彈' },
                { type: 'spawn_projectile', config: { damage: 15, echo: 3, bounce: 6 }, vel: {x: 4, y: -15} },
                { type: 'wait', frames: 240 }, { type: 'reset' }
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

const TRUTH_BOOK_CATEGORIES = [
    { id: 'boss', name: 'Boss 机制', icon: '☠️', hint: '专属资源、破绽谱与狂暴变化' },
    { id: 'enemy_affix', name: '敌人词缀', icon: '◇', hint: '普通/精英敌人的行为规则' },
    { id: 'enemy_v2', name: 'V2 基底', icon: '▣', hint: '多格敌人与专属形体' },
    { id: 'attribute', name: '属性百科', icon: '✦', hint: '弹药属性、元素反应与演示' },
    { id: 'core', name: '核心机制', icon: '📘', hint: '充能、替换、保底与掉落' }
];

function setupTruthBookBossDemo(game, bossId, isBigBoss = false) {
    if (!game || typeof game.spawn_spawnBoss !== 'function') return;
    const boss = game.spawn_spawnBoss(bossId, isBigBoss);
    if (!boss) return;
    boss._pendingEntrance = false;
    boss.entranceTimer = 1;
    if (typeof boss.dropTargetY === 'number') boss.pos.y = boss.dropTargetY;
}

const TRUTH_BOOK_BOSS_ENTRIES = [
    {
        id: 'truth_boss_ignis',
        categoryId: 'boss',
        title: '熔炉守卫·伊格尼斯',
        icon: '🔥',
        tags: ['R5', '温压', '流彩护盾', '破绽: pierce/pyro'],
        trainingScenarioId: 'boss_ignis',
        content: '护盾、极速与流彩护盾构成第一段 Boss 教学。伊格尼斯不会把过热当作普通烧伤结算，100°C 以上的正温度会转化为温压；温压达到阈值时触发一次流彩护盾脉冲。狂暴后每回合额外升温，并对周围产生火焰溅射。穿透用于破甲，火焰用于推动炉心压力。试炼场入口：boss_ignis。',
        setup: (game) => setupTruthBookBossDemo(game, 'ignis', false),
        loop: [
            { type: 'log', text: '温压核心：过热转为炉压' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '破绽谱：pierce / pyro' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_boss_glacies',
        categoryId: 'boss',
        title: '霜晶缝合怪·格拉西斯',
        icon: '❄️',
        tags: ['R12', '霜缝', '减伤提示', '破绽: cryo/pierce'],
        trainingScenarioId: 'boss_glacies',
        content: '格拉西斯会在战斗场内缝合霜缝，给周围敌人短暂减伤、回血与护盾。被缝目标现在会有冰蓝缝线、外框与“减伤”状态提示，玩家能直接看到霜缝收益来源。cryo 会切断霜缝并冻结下一次机制 tick，pierce 会切断霜缝并在本次命中获得额外伤害。试炼场入口：boss_glacies。',
        setup: (game) => setupTruthBookBossDemo(game, 'glacies', false),
        loop: [
            { type: 'log', text: '霜缝：目标获得减伤与护盾' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '破绽谱：cryo / pierce' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_boss_mikro',
        categoryId: 'boss',
        title: '裂变母体·米克罗',
        icon: '🦠',
        tags: ['R19', '分身减伤', '治疗链', '破绽: lightning/scatter'],
        trainingScenarioId: 'boss_mikro',
        content: '米克罗把分身与治疗组合成群体压力。每个存活分身和入场裂变细胞都会为母体提供减伤，最高 50%；狂暴后分裂概率提升到 100%。lightning 适合过载分身链，scatter 适合清理复制体和治疗站位。试炼场入口：boss_mikro。',
        setup: (game) => setupTruthBookBossDemo(game, 'mikro', false),
        loop: [
            { type: 'log', text: '分身越多，母体越硬' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '破绽谱：lightning / scatter' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_boss_devourer',
        categoryId: 'boss',
        title: '贪婪之渊·噬神者',
        icon: '👅',
        tags: ['R26', '深渊胃域', '吞噬换盾', '破绽: bounce/laser'],
        trainingScenarioId: 'boss_devourer',
        content: 'Devourer 现在接管“胃域”机制。每回合先拉拽胃域范围内的非 Boss 敌人，并周期性召唤 maw_thrall 养料；消化时会吞噬胃域内所有非 Boss 目标，把吞噬次数与被吞护盾转化为自身护盾。狂暴后候选范围扩至全屏。bounce 用于胃袋反弹消耗，laser 用于精准灼穿。试炼场入口：boss_devourer。',
        setup: (game) => setupTruthBookBossDemo(game, 'devourer', false),
        loop: [
            { type: 'log', text: '胃域拉拽并召唤养料' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '吞噬转化为护盾' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_boss_viridis',
        categoryId: 'boss',
        title: '翠绿共生体·维里迪斯',
        icon: '🍃',
        tags: ['R33', '孢甲资源', '活体护甲', '破绽: pyro/venom'],
        trainingScenarioId: 'boss_viridis',
        content: '维里迪斯围绕孢子活甲循环展开。专属孢子侍体、再生和治疗会积累孢甲资源；资源达到阈值后，为自身或侍体补充活体护甲。非反制破甲会反哺孢甲，pyro 与 venom 会直接蚀甲、降低资源并留下腐蚀反馈。试炼场入口：boss_viridis。',
        setup: (game) => setupTruthBookBossDemo(game, 'viridis', true),
        loop: [
            { type: 'log', text: '孢甲资源积累中' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '破绽谱：pyro / venom' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_boss_tesla',
        categoryId: 'boss',
        title: '雷霆幻影·特斯拉',
        icon: '⚡',
        tags: ['R40', '导体网络', '场强', '破绽: cryo/bounce'],
        trainingScenarioId: 'boss_tesla',
        content: '特斯拉每回合电击敌人并制造导体，导体越多场强越高；场强会带来额外行动和召唤压力，但有上限与回合衰减。lightning 会给导体充能，反过来喂给特斯拉；cryo 能移除临时 haste 并泄场，bounce 能接地并压低网络收益。试炼场入口：boss_tesla。',
        setup: (game) => setupTruthBookBossDemo(game, 'tesla', true),
        loop: [
            { type: 'log', text: '导体网络提升场强' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '破绽谱：cryo / bounce' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_boss_chimera',
        categoryId: 'boss',
        title: '混沌融合体·奇美拉',
        icon: '◇',
        tags: ['R47', '热核吞噬', '冷热抵消', '破绽: venom/laser'],
        trainingScenarioId: 'boss_chimera',
        content: 'Chimera 现在是随机热核吞噬。每回合随机吞噬 1 个非 Boss 敌人，然后召唤一个 +100°C 或 -100°C 的热核养料。被吞目标温度达到阈值时，会按 100°C 为单位转成热层或寒层；冷热层互相抵消，并转化为流彩护盾。狂暴时本次吸收层数翻倍。试炼场入口：boss_chimera。',
        setup: (game) => setupTruthBookBossDemo(game, 'chimera', true),
        loop: [
            { type: 'log', text: '随机吞噬热核养料' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '冷热抵消转流彩护盾' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_boss_ouroboros',
        categoryId: 'boss',
        title: '永恒回声·奥罗波罗斯',
        icon: '🔄',
        tags: ['R54', '六附体', '动态破绽', '轮转封印'],
        trainingScenarioId: 'boss_ouroboros',
        content: '奥罗波罗斯携带六个附体槽，前位附体每回合轮转，并授予护盾、治疗、召唤、位移、吞噬、加速六类机制。当前附体决定动态破绽谱；打满正确属性会封印该附体若干回合，使后续轮转跳过它。附体槽美术验收入口：boss_ouroboros_attachment_slots。',
        setup: (game) => setupTruthBookBossDemo(game, 'ouroboros', true),
        loop: [
            { type: 'log', text: '六附体轮转中' },
            { type: 'wait', frames: 80 },
            { type: 'log', text: '破绽谱随前位附体变化' },
            { type: 'enemy_turn' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    }
];

const TRUTH_BOOK_CORE_ENTRIES = [
    {
        id: 'truth_core_skill_charge',
        categoryId: 'core',
        title: '技能/符文充能',
        icon: '🔋',
        tags: ['命中 3%', '击杀 10%', '实际条/临时条'],
        content: '旧“符文充能”已兼容为技能充能。战斗命中提供基础 3% 充能，击杀提供 10%；每次命中可能触发 2x/4x/8x 倍率。获得的充能按保留比例拆成实际条与临时条：实际条稳定保留，临时条会在战斗中衰减。总量达到 100% 时尝试发放 1 点 SP；若 SP 已满，满条会保留到玩家消耗 SP 后再转换。',
        loop: [
            { type: 'log', text: '命中：实际条 + 临时条' },
            { type: 'wait', frames: 90 },
            { type: 'log', text: '满条：尝试发放 1 SP' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_core_ammo_replace',
        categoryId: 'core',
        title: '子弹替换',
        icon: '🔁',
        tags: ['充能子弹', 'New Grind', 'Charged'],
        content: '当上一轮已有可保留弹药，而本轮又完成研磨时，系统会进入子弹替换阶段。左侧展示本轮新研磨子弹，右侧展示上轮保留下来的充能子弹；玩家最多选择子弹上限数量进入战斗。纯净精华跳过研磨时会只展示可保留的充能子弹，并隐藏“跳过”按钮，避免空弹药进入战斗。',
        loop: [
            { type: 'log', text: '上一轮弹药进入 Charged 队列' },
            { type: 'wait', frames: 90 },
            { type: 'log', text: '确认选择后合并为 ammoQueue' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_core_drop_pity',
        categoryId: 'core',
        title: '遗物/精华保底',
        icon: '🎁',
        tags: ['精华 5 行', '遗物 13 行', '密度限制'],
        content: '敌人奖励采用动态掉落与保底机制。连续 4 行未掉落精华时，第 5 行强制触发精华；连续 12 行未掉落遗物时，第 13 行强制触发遗物。若玩家战力碾压当前敌人，保底会暂停；若场上奖励敌人过多，掉落概率会衰减，达到硬上限后本行不再新增奖励。',
        loop: [
            { type: 'log', text: '保底计数随无掉落行推进' },
            { type: 'wait', frames: 90 },
            { type: 'log', text: '战力碾压/奖励密度会暂停保底' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    },
    {
        id: 'truth_core_smart_rune_drop',
        categoryId: 'core',
        title: '智能符文掉落',
        icon: '🧭',
        tags: ['Build Vector', '同属性加权', 'Boss 主题权重'],
        content: '符文掉落会读取最近 5 回合伤害构成，形成玩家当前套路向量。近期某属性伤害占比越高，同属性符文权重越高；Boss 还会注入独立主题权重。最终权重 = 基础掉落权重 + 同属性伤害占比 × 3.0 + Boss 主题额外权重。runeBearer 与 adaptiveRune 敌人可以覆写掉落池：前者必掉通用智能符文，后者按最近承受属性定向掉落。',
        loop: [
            { type: 'log', text: '读取最近 5 回合伤害构成' },
            { type: 'wait', frames: 90 },
            { type: 'log', text: '同属性符文权重上升' },
            { type: 'wait', frames: 120 },
            { type: 'reset' }
        ]
    }
];

function normalizeTruthBookEntry(entry, categoryId) {
    const title = entry.title || entry.name || entry.id;
    const content = entry.content || entry.desc || '';
    return {
        ...entry,
        categoryId: entry.categoryId || categoryId,
        title,
        content,
        name: entry.name || title,
        desc: entry.desc || content,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        loop: Array.isArray(entry.loop) ? entry.loop : []
    };
}

function buildTruthBookEntries() {
    const enemyEntries = (TRUTH_BOOK_DATA.enemies || []).map(entry => {
        const categoryId = entry.id && entry.id.startsWith('v2_') ? 'enemy_v2' : 'enemy_affix';
        return normalizeTruthBookEntry(entry, categoryId);
    });
    const attributeEntries = (TRUTH_BOOK_DATA.attributes || []).map(entry => normalizeTruthBookEntry(entry, 'attribute'));
    const bossEntries = TRUTH_BOOK_BOSS_ENTRIES.map(entry => normalizeTruthBookEntry(entry, 'boss'));
    const coreEntries = TRUTH_BOOK_CORE_ENTRIES.map(entry => normalizeTruthBookEntry(entry, 'core'));
    return [...bossEntries, ...enemyEntries, ...attributeEntries, ...coreEntries];
}

TRUTH_BOOK_DATA.categories = TRUTH_BOOK_CATEGORIES;
TRUTH_BOOK_DATA.bosses = TRUTH_BOOK_BOSS_ENTRIES.map(entry => normalizeTruthBookEntry(entry, 'boss'));
TRUTH_BOOK_DATA.core = TRUTH_BOOK_CORE_ENTRIES.map(entry => normalizeTruthBookEntry(entry, 'core'));
TRUTH_BOOK_DATA.entries = buildTruthBookEntries();

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
            'radiantAegis': {
                name: '✦ 流彩護盾',
                desc: `Boss 版：只要流彩盾未破，每回合生成最大生命 ${(afx.radiantAegisBossRegenPct || 0.02) * 100}% 的数值护盾；满 ${(afx.radiantAegisBossCapPct || 0.10) * 100}% 后再次获取会给周围一格敌人 +1 层护盾。精英版数值减半。`
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
            },
            // [V2 基底专属词条]
            'heavyArmor': {
                name: '🛡️ 重裝',
                desc: `占 3 列橫向裝甲：血量 ×${afx.heavyArmorHpMult || 2.0}，每 ${afx.heavyArmorMoveInterval || 2} 回合才能移動一次。`
            },
            'deflectionWard': {
                name: '🔷 偏折屏障',
                desc: `2×1 棱盾獸：擁有相當於最大生命值 ${(afx.deflectionWardBarrierPct || 0.10) * 100}% 的屏障，僅吸收反彈/穿透類傷害，未被打破則每回合恢復至滿值。`
            },
            'echoRelay': {
                name: '🔮 回響中繼',
                desc: `1×2 共振尖塔：每回合額外觸發一次周圍敵人的詞條效果（再生/治療/分身/極速）；自身最大生命值僅為標準精英的 ${(afx.echoRelayHpPct || 0.5) * 100}%。`
            },
            'prism': {
                name: '🌈 折光',
                desc: `1×3 折光棱柱：作為激光偏折面參與反射，命中後傷害衰減為原伤害的 ${(afx.prismLaserDeflect || 0.5) * 100}%，產生七色折射粒子。`
            },
            'hive': {
                name: '🥚 孵化',
                desc: `2×3 孵化巢：每 ${afx.hiveSpawnInterval || 2} 回合在周圍生成一隻血量為自身 ${(afx.hiveSpawnHpPct || 0.15) * 100}% 的低血量幼體。`
            },
            'siege': {
                name: '🚜 破陣',
                desc: `3×2 攻城履帶：無法被冰凍；移動時若被前方敵人阻擋，會嘗試將阻擋鏈條一起向前推進 1 行。`
            },
            'gravityWell': {
                name: '🌀 引力井',
                desc: `3×3 引力炉心：在 ${afx.gravityWellPullRadius || 220}px 半徑內對所有子彈施加微弱回拉，造成可預測的彈道偏折。`
            },
            'carrier': {
                name: '▱ 鑄巢母架',
                desc: `五格冂形母架：每 ${afx.carrierSpawnInterval || 1} 回合在第 5 格空艙投放一隻 haste+jump 小型敵人；若空艙被佔會先推出舊單位，推不出去則跳過本次投放。`
            },
            'livingArmor': {
                name: '🟢 活體護甲',
                desc: `獲得最大生命 ${(afx.livingArmorPct || 0.10) * 100}% 的活體護甲；每回合開始回滿，破裂後自身不再生效，可被護甲孢子重新掛甲。代承反彈傷害，穿透會同時打護甲與本體。`
            },
            'armorSpore': {
                name: '🍃 護甲孢子',
                desc: `每回合為一名隨機友軍添加活體護甲；若目標已有活體護甲，按 ${(afx.armorSporeStackPct || 0.50) * 100}% 數值疊加。`
            },
            'siegeBreaker': {
                name: '🏚️ 撞城者',
                desc: `撞擊防線屏障時造成占格數 ×${afx.siegeBreakerDamageMult || 2} 的屏障傷害。`
            },
            'deflectShell': {
                name: '🔄 偏折殼',
                desc: '僅 1×1 敵人攜帶；物理邊界持續旋轉，子彈反彈方向會被偏折。'
            },
            'energyArmor': {
                name: '🟡 蓄能甲',
                desc: `單次傷害超過最大生命 ${(afx.energyArmorThresholdPct || 0.20) * 100}% 時，只承受閾值部分，溢出轉化為臨時護盾。`
            },
            'phaseShield': {
                name: '🟣 相位護盾',
                desc: `初始與新增護盾層數 ×${afx.phaseShieldMult || 2}；每 ${afx.phaseShieldCycle || 3} 個敵方回合有 1 回合護盾失效。`
            },
            'overloadReactor': {
                name: '🔥 過量反應爐',
                desc: `本回合每累積受到最大生命 ${(afx.overloadStepPct || 0.20) * 100}% 的傷害，下次行動與移動次數 +1（最多 +${afx.overloadMaxBonus || 3}）。`
            },
            'lowDamageImmune': {
                name: '⬜ 低傷免疫',
                desc: `低於最大生命 ${(afx.lowDamageImmunePct || 0.05) * 100}% 的單次最終傷害無效。`
            },
            'runeBearer': {
                name: '通用符文掉落',
                desc: '死亡时必定掉落一个智能权重符文；每个敌方回合开始获得一个随机临时词条。'
            },
            'adaptiveRune': {
                name: '自适应符文',
                desc: '记录最近承受的属性伤害或状态效果，死亡时掉落该属性家族的符文。'
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
        currentSP = Math.max(0, Number(currentSP) || 0);
        container.innerHTML = '';
        // 仅渲染已解锁的技能，而非遍历全部 SKILL_DB
        const skillsToRender = activeSkills || [];
        const directSkillLimit = 4;
        const visibleSkills = skillsToRender.slice(0, directSkillLimit);
        const overflowCount = Math.max(0, skillsToRender.length - directSkillLimit);
        container.dataset.visibleSkillCount = String(visibleSkills.length);
        if (overflowCount > 0) {
            container.dataset.overflowSkillCount = String(overflowCount);
        } else {
            delete container.dataset.overflowSkillCount;
        }
        if (skillsToRender.length === 0) return;

        const maxVisibleSP = 5;
        const maxSP = Math.min(maxVisibleSP, Math.max(CONFIG.gameplay.maxSkillPoints || 0, currentSP));
        const spGems = Array.from({ length: maxSP }, (_, idx) => {
            const filled = idx < currentSP;
            return `<span class="skill-sp-gem ${filled ? 'is-full' : 'is-empty'}" aria-hidden="true"></span>`;
        }).join('');
        const head = document.createElement('div');
        head.className = 'skill-bar-head';
        head.innerHTML = `
            <span class="skill-bar-title">技能</span>
            <span class="skill-sp-readout" aria-label="SP ${currentSP}">${spGems}</span>
        `;
        container.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'skill-button-grid';
        // The Pass6 combat console reserves exactly four 40x40 touch targets.
        // Extra active skills need a later drawer/page pass; never shrink these buttons.
        visibleSkills.forEach(skill => {
            const cost = Math.max(0, Number(skill.cost) || 0);
            const btn = document.createElement('button');
            const isDisabled = currentSP < cost;
            const disabledReason = isDisabled ? `SP不足` : '';
            btn.type = 'button';
            btn.className = 'skill-button';
            btn.disabled = isDisabled;
            btn.title = `${skill.name} · ${skill.desc || ''}`;
            btn.setAttribute(
                'aria-label',
                isDisabled
                    ? `${skill.name}，需要 ${cost} SP，当前 ${currentSP} SP`
                    : `${skill.name}，消耗 ${cost} SP`
            );
            if (!isDisabled) {
                btn.style.borderColor = skill.color;
                btn.style.background = `linear-gradient(145deg, ${adjustColorBrightness(skill.color, 0.4)} 0%, rgba(15, 23, 42, 0.96) 78%)`;
                btn.style.boxShadow = `0 0 12px ${skill.color}66`;
            }
            btn.innerHTML = `
                <span class="skill-ready-mark" aria-hidden="true"></span>
                <span class="skill-button-icon" aria-hidden="true">${skill.icon}</span>
                <span class="skill-cost-badge" aria-hidden="true">${cost}</span>
                <span class="skill-disabled-reason" aria-hidden="true">${disabledReason}</span>
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
            grid.appendChild(btn);
        });
        container.appendChild(grid);
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
const BOSS_VULNERABILITY_VISUAL_BOSSES = [
    'ignis', 'glacies', 'mikro', 'devourer', 'viridis', 'tesla', 'chimera', 'ouroboros'
];

const BOSS_VULNERABILITY_VISUAL_STATES = [
    { id: 'vuln_0', label: '0%', ratio: 0, exposedTurns: 0, breakTimer: 0, recoverTimer: 0 },
    { id: 'vuln_25', label: '25%', ratio: 0.25, exposedTurns: 0, breakTimer: 0, recoverTimer: 0 },
    { id: 'vuln_50', label: '50%', ratio: 0.5, exposedTurns: 0, breakTimer: 0, recoverTimer: 0 },
    { id: 'vuln_75', label: '75%', ratio: 0.75, exposedTurns: 0, breakTimer: 0, recoverTimer: 0 },
    { id: 'break', label: '破绽爆开', ratio: 1, exposedTurns: 1, breakTimer: 34, recoverTimer: 0 },
    { id: 'exposed', label: '暴露停摆', ratio: 1, exposedTurns: 1, breakTimer: 0, recoverTimer: 0 },
    { id: 'recover', label: '恢复闭合', ratio: 0, exposedTurns: 0, breakTimer: 0, recoverTimer: 32 }
];

const BOSS_VULNERABILITY_EXPOSED_PARTS = {
    ignis: 'furnace_gate',
    glacies: 'frozen_joint',
    mikro: 'fission_core',
    devourer: 'maw_throat',
    viridis: 'symbiote_heart',
    tesla: 'phase_core',
    chimera: 'chaos_reactor',
    ouroboros: 'rotation_node'
};

function resolveBossVulnerabilityAttrs(bossId, rotationIndex = 0) {
    const cfg = CONFIG.balance.bossConfigs?.[bossId]?.vulnerability || {};
    if (cfg.dynamic) {
        const sets = cfg.rotationAttrs || [];
        return sets.length > 0 ? sets[Math.max(0, rotationIndex) % sets.length] || [] : [];
    }
    return cfg.attrs || [];
}

function setupBossVulnerabilityVisualState(boss, bossId, state, rotationIndex = 0) {
    if (!boss || !state) return;
    const threshold = Math.max(1, boss._bossVulnerabilityThreshold || 4);
    const ratio = Math.max(0, Math.min(1, state.ratio || 0));
    boss._bossVulnerabilityMode = 'visual_acceptance';
    boss._bossVulnerabilityThreshold = threshold;
    boss._bossVulnerabilityProgress = Math.floor(threshold * Math.min(0.99, ratio));
    boss._bossVulnerabilityVisualRatio = ratio;
    boss._bossVulnerabilityVisualAttrs = resolveBossVulnerabilityAttrs(bossId, rotationIndex).slice(0, 2);
    boss._bossVulnerabilityExposedTurns = state.exposedTurns || 0;
    boss._bossVulnerabilityExposedHits = 0;
    boss._bossVulnerabilityExposedPart = BOSS_VULNERABILITY_EXPOSED_PARTS[bossId] || 'core';
    boss._bossVulnerabilityBreakTimer = state.breakTimer || 0;
    boss._bossVulnerabilityRecoverTimer = state.recoverTimer || 0;
    boss._willMoveThisTurn = state.exposedTurns > 0 ? false : boss._willMoveThisTurn;
    if (bossId === 'ouroboros') {
        boss.rotationIndex = rotationIndex % 3;
    }
}

function getOuroborosOrbitAttachmentSlots() {
    const slots = CONFIG.balance.bossConfigs?.ouroboros?.orbitAttachments;
    return Array.isArray(slots) ? slots : [];
}

function clearOuroborosOrbitEchoes(game) {
    if (!game || !Array.isArray(game.enemies)) return;
    game.enemies = game.enemies.filter(enemy =>
        !(enemy?.bossOwnerId === 'ouroboros' && enemy?.bossMinionRole === 'orbit_echo')
    );
}

function setupOuroborosAttachmentSlotAcceptance(game, slotIndex = 0) {
    if (!game || typeof game.spawn_spawnBoss !== 'function') return null;
    const slots = getOuroborosOrbitAttachmentSlots();
    if (slots.length === 0) return null;

    const normalizedIndex = ((Math.floor(slotIndex) % slots.length) + slots.length) % slots.length;
    const slot = slots[normalizedIndex];
    let boss = game.enemies?.find(enemy => enemy?.type === 'boss' && enemy?.bossType === 'ouroboros');
    if (!boss) boss = game.spawn_spawnBoss('ouroboros', true);
    if (!boss) return null;

    clearOuroborosOrbitEchoes(game);
    boss._pendingEntrance = false;
    boss.entranceTimer = 1;
    if (typeof boss.dropTargetY === 'number') boss.pos.y = boss.dropTargetY;
    boss.rotationTurnCount = 0;
    boss._ouroborosOrbitInitialized = true;
    if (typeof boss._applyOuroborosAttachment === 'function') {
        boss._applyOuroborosAttachment(normalizedIndex, game, { feedback: false });
    }

    game._ouroborosAttachmentSlotAcceptance = { slotIndex: normalizedIndex };
    return { boss, slot, slotIndex: normalizedIndex };
}

function advanceOuroborosAttachmentSlotAcceptance(game) {
    const slots = getOuroborosOrbitAttachmentSlots();
    if (slots.length === 0) return null;
    const cursor = game?._ouroborosAttachmentSlotAcceptance || { slotIndex: -1 };
    const result = setupOuroborosAttachmentSlotAcceptance(game, (cursor.slotIndex || 0) + 1);

    const descEl = document.getElementById('train-scenario-desc');
    if (descEl && result?.slot) {
        descEl.textContent = `Ouroboros attachment slot: ${result.slot.id}. The six slot sprites are mounted on the boss ring; no orbit_echo minion is spawned in this acceptance scene.`;
    }
    return result;
}

const TRAINING_SCENARIOS = {
    categories: [
        { id: 'enemy', name: '敵人詞條' },
        { id: 'attribute', name: '屬性效果' },
        { id: 'boss', name: 'Boss 機制' },
        { id: 'runeword', name: '符文詞條' },
        { id: 'resonance', name: '屬性共鳴' },
        { id: 'relic', name: '遺物/精華' },
        { id: 'v2matrix', name: '敵人 V2 矩陣' },
        { id: 'enemy_v2', name: '敵人 V2 / 美術驗收' }
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
            id: 'enemy_radiant_aegis',
            categoryId: 'enemy',
            name: '流彩護盾',
            icon: '✦',
            desc: '超級精英詞條：流彩盾未破時每回合自增；满层后再次获取会为周围一格敌人增加 1 层护盾。此场景演示精英半强度版本。',
            setup: (game) => {
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                const core = new Enemy(2.5 * w + w / 2, top + h / 2, 60, 60, 600, 600, 'elite', ['radiantAegis']);
                if (typeof core._initRadiantAegis === 'function') core._initRadiantAegis();
                const left = new Enemy(1.5 * w + w / 2, top + h / 2, 60, 60, 220, 220);
                const right = new Enemy(3.5 * w + w / 2, top + h / 2, 60, 60, 220, 220);
                game.enemies.push(left, core, right);
            },
            bulletConfig: { damage: 80, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
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
            id: 'enemy_rune_bearer',
            categoryId: 'enemy',
            name: '通用符文敌人',
            icon: 'R',
            desc: '死亡时必掉通用智能符文；每个敌方回合开始随机获得一个临时词条。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 420, 420, 'elite', ['runeBearer']));
            },
            bulletConfig: { damage: 120, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'enemy_adaptive_rune',
            categoryId: 'enemy',
            name: '自适应符文敌人',
            icon: 'A',
            desc: '受到属性伤害或属性效果后切换当前符文家族；死亡时掉落该家族符文。',
            setup: (game) => {
                const x = 2.5 * game.enemyWidth + game.enemyWidth / 2;
                const y = game.combatGridTopY + 1 * game.enemyHeight + game.enemyHeight / 2;
                game.enemies.push(new Enemy(x, y, 60, 60, 520, 520, 'elite', ['adaptiveRune']));
            },
            bulletConfig: { damage: 80, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 1, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => {
                const target = game.enemies.find(e => e.active && (e.affixes || []).includes('adaptiveRune'));
                if (target) target.takeDamage(40, { config: { pyro: 1 }, pos: target.pos });
            }
        },
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
        {
            id: 'attr_venom',
            categoryId: 'attribute',
            name: '毒素 (Venom)',
            icon: '☠️',
            desc: '命中疊加毒層，造成持續傷害（DoT）。毒層越高，每秒傷害越高。適合高血量敵人。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 3000));
                [{c:1.5,r:1},{c:3.5,r:1}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 2000));
                });
            },
            bulletConfig: { damage: 8, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, venom: 15, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_overcharge',
            categoryId: 'attribute',
            name: '超載 (Overcharge)',
            icon: '💥',
            desc: '命中時引發超載爆炸，對命中點周圍敵人造成 AOE 傷害。適合密集怪群。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1200));
                [{c:1.5,r:0},{c:2.5,r:0},{c:3.5,r:0},{c:1.5,r:1},{c:3.5,r:1},{c:1.5,r:2},{c:2.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 300));
                });
            },
            bulletConfig: { damage: 15, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, overcharge: 15, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'attr_echo',
            categoryId: 'attribute',
            name: '回響 (Echo)',
            icon: '🔁',
            desc: '命中時有概率分裂出回響子彈，繼承部分屬性向附近敵人飛行。適合擴大打擊覆蓋面。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 4; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 400));
                    }
                }
            },
            bulletConfig: { damage: 15, bounce: 2, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, echo: 15, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(1, -16);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        // ── Boss 機制 ──────────────────────────────────────────────────
        {
            id: 'boss_ignis',
            categoryId: 'boss',
            name: '熔爐守衛·伊格尼斯',
            icon: '🔥',
            desc: '護盾+極速。狂暴後每回合升溫 +30°C 並對周圍敵人火焰濺射。破綻譜：穿透/火焰。',
            setup: (game) => { game.spawn_spawnBoss('ignis', false); },
            bulletConfig: { damage: 50, bounce: 0, pierce: 3, scatter: 0, multicast: 0, pyro: 200, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_glacies',
            categoryId: 'boss',
            name: '霜晶縫合怪·格拉西斯',
            icon: '❄️',
            desc: '跳躍+再生。回合與落地會在戰場內縫合霜縫，使敵人短暫減傷、回血並獲得護盾；冰霜可凍結下一次霜縫，穿透可切斷霜縫。破綻譜：冰霜/穿透。',
            setup: (game) => { game.spawn_spawnBoss('glacies', false); },
            bulletConfig: { damage: 50, bounce: 0, pierce: 3, scatter: 0, multicast: 0, pyro: 0, cryo: 200, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_mikro',
            categoryId: 'boss',
            name: '裂變母體·米克羅',
            icon: '🦠',
            desc: '分身+治療。每個存活分身提供 10% 減傷（上限 50%）。破綻譜：閃電/散射。',
            setup: (game) => { game.spawn_spawnBoss('mikro', false); },
            bulletConfig: { damage: 20, bounce: 0, pierce: 0, scatter: 5, multicast: 0, pyro: 0, cryo: 0, lightning: 8, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_devourer',
            categoryId: 'boss',
            name: '貪婪之淵·噬神者',
            icon: '👅',
            desc: '深渊胃域+护盾。每回合拉拽并召唤 maw_thrall 养料，吞噬胃域内所有非 Boss 敌人并转化为护盾；狂暴后吞噬范围扩至全屏。破绽谱：弹跳/激光。',
            setup: (game) => { game.spawn_spawnBoss('devourer', false); },
            bulletConfig: { damage: 40, bounce: 5, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: true, isMatryoshka: false, type: 'normal', laser: 8 },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_viridis',
            categoryId: 'boss',
            name: '翠绿共生体·维里迪斯',
            icon: '🍃',
            desc: '再生+治疗+活体护甲。专属孢子侍体和治疗会积累孢甲资源，资源达阈值为侍体/自身补活体护甲；非火毒破甲会反哺孢甲，火焰/毒素会蚀甲并削减资源。破绽谱：火焰/毒素。',
            setup: (game) => { game.spawn_spawnBoss('viridis', true); },
            bulletConfig: { damage: 45, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 180, cryo: 0, lightning: 0, wind: 0, venom: 6, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_tesla',
            categoryId: 'boss',
            name: '导体矩阵·特斯拉',
            icon: '⚡',
            desc: '导体网络+连锁电弧。进入战斗后以窄菱形导体核心承载电流，破绽谱：冰霜/弹跳。',
            setup: (game) => { game.spawn_spawnBoss('tesla', true); },
            bulletConfig: { damage: 42, bounce: 5, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 180, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_chimera',
            categoryId: 'boss',
            name: '缝合奇美拉·喀迈拉',
            icon: '◇',
            desc: '热核吞噬+流彩护盾。每回合随机吞噬 1 名敌人并召唤 +100°C 或 -100°C 热核养料；吞噬温度会转为热/寒层，冷热抵消时生成流彩护盾，狂暴时层数翻倍。破绽谱：毒素/激光。',
            setup: (game) => { game.spawn_spawnBoss('chimera', true); },
            bulletConfig: { damage: 46, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, venom: 6, isLaser: true, isMatryoshka: false, type: 'normal', laser: 8 },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_ouroboros',
            categoryId: 'boss',
            name: '永恆回聲·奧羅波羅斯',
            icon: '🔄',
            desc: '六附体轮转。每回合前位附体更换并授予护盾、治疗、召唤、位移、吞噬、加速六类机制；当前附体决定破绽谱，打满破绽会封印该附体并改变轮转节奏。',
            setup: (game) => { game.spawn_spawnBoss('ouroboros', true); },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
        {
            id: 'boss_ouroboros_attachment_slots',
            categoryId: 'boss',
            name: '奧羅波羅斯·附体槽验收',
            icon: '⬡',
            keepSidebarOpenOnDemo: true,
            desc: '使用真实 Ouroboros Boss 逐槽预览六个附体槽贴图。点击触发演示会依次切换 aegis / graft / brood / stride / maw / surge；槽位贴在 Boss 环上，不生成会移动的 orbit_echo 伴生敌。',
            setup: (game) => { setupOuroborosAttachmentSlotAcceptance(game, 0); },
            demoAction: (game) => { advanceOuroborosAttachmentSlotAcceptance(game); }
        },
        {
            id: 'boss_vulnerability_break',
            categoryId: 'boss',
            name: 'Boss 破綻逐档验收',
            icon: '🎯',
            keepSidebarOpenOnDemo: true,
            desc: '逐档预览 8 个 Boss 的身体破绽层：0/25/50/75/破绽爆开/暴露停摆/恢复闭合。点击触发演示切换到下一档。',
            setup: (game) => {
                game._bossVulnerabilityVisualAcceptance = { bossIndex: 0, stateIndex: 0 };
                const bossId = BOSS_VULNERABILITY_VISUAL_BOSSES[0];
                const state = BOSS_VULNERABILITY_VISUAL_STATES[0];
                const boss = game.spawn_spawnBoss(bossId, false);
                if (boss) {
                    boss._pendingEntrance = false;
                    boss.entranceTimer = 1;
                    setupBossVulnerabilityVisualState(boss, bossId, state, 0);
                }
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 3, scatter: 0, multicast: 0, pyro: 3, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const cursor = game._bossVulnerabilityVisualAcceptance || { bossIndex: 0, stateIndex: 0 };
                const nextStateIndex = (cursor.stateIndex + 1) % BOSS_VULNERABILITY_VISUAL_STATES.length;
                const nextBossIndex = nextStateIndex === 0
                    ? (cursor.bossIndex + 1) % BOSS_VULNERABILITY_VISUAL_BOSSES.length
                    : cursor.bossIndex;
                game._bossVulnerabilityVisualAcceptance = {
                    bossIndex: nextBossIndex,
                    stateIndex: nextStateIndex
                };

                if (typeof tg._clearBattlefield === 'function') tg._clearBattlefield();
                else game.enemies = [];

                const bossId = BOSS_VULNERABILITY_VISUAL_BOSSES[nextBossIndex];
                const state = BOSS_VULNERABILITY_VISUAL_STATES[nextStateIndex];
                const boss = game.spawn_spawnBoss(bossId, bossId === 'viridis' || bossId === 'tesla' || bossId === 'chimera' || bossId === 'ouroboros');
                if (boss) {
                    boss._pendingEntrance = false;
                    boss.entranceTimer = 1;
                    setupBossVulnerabilityVisualState(boss, bossId, state, nextBossIndex);
                }

                const descEl = document.getElementById('train-scenario-desc');
                if (descEl) {
                    const attrs = resolveBossVulnerabilityAttrs(bossId, boss?.rotationIndex || 0).join(' / ') || 'dynamic';
                    descEl.textContent = `视觉验收：${boss?.bossName || bossId} · ${state.label} · 破绽谱 ${attrs}。继续点击切换下一档。`;
                }
            }
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
            id: 'rw_toxic_bloom',
            categoryId: 'runeword',
            runewordId: 'runeword_toxic_bloom',
            runewordLevel: 1,
            name: '毒花綻放',
            icon: '🌿',
            desc: '[劇毒系] 劇毒命中時向半徑 90 內的鄰近敵人擴散少量毒層。建議讓子彈命中密集怪群的中心，觀察周圍敵人是否被附加毒層。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                // 3x3 密集怪群：子彈命中前排即可向四周擴散毒層
                [{c:1.5,r:0},{c:2.5,r:0},{c:3.5,r:0},
                 {c:1.5,r:1},{c:2.5,r:1},{c:3.5,r:1},
                 {c:1.5,r:2},{c:2.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 800));
                });
            },
            bulletConfig: { damage: 10, bounce: 0, pierce: 3, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, venom: 12, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_overload_core',
            categoryId: 'runeword',
            runewordId: 'runeword_overload_core',
            runewordLevel: 1,
            name: '超載核心',
            icon: '💥',
            desc: '[超載系] 超載爆炸半徑 +24、爆炸傷害 +20%。建議命中怪群中心，觀察更大的爆炸範圍與更高的 AOE 傷害。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1500));
                [{c:1.5,r:0},{c:2.5,r:0},{c:3.5,r:0},{c:1.5,r:1},{c:3.5,r:1},{c:1.5,r:2},{c:2.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 300));
                });
            },
            bulletConfig: { damage: 20, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, overcharge: 12, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_echo_chamber',
            categoryId: 'runeword',
            runewordId: 'runeword_echo_chamber',
            runewordLevel: 1,
            name: '回響腔體',
            icon: '🔁',
            desc: '[回響系] 回響觸發率 +10%，回響子彈繼承更多屬性。建議多次發射帶回響的子彈，觀察分裂子彈數量與屬性繼承。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 4; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 400));
                    }
                }
            },
            bulletConfig: { damage: 15, bounce: 2, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, echo: 12, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(1, -16);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'rw_son_sword_summon',
            categoryId: 'runeword',
            runewordId: 'runeword_son_sword_summon',
            runewordLevel: 1,
            name: '召劍之語',
            icon: '🗡️',
            desc: '[特殊系] 彈珠每次命中敵人時有 7% 概率在命中位置召喚一把三級子飛劍，子飛劍繼承彈珠屬性（火/冰/雷）。建議用高彈跳+元素子彈製造大量命中，觀察子飛劍召喚。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                // 密集怪群 + 高血量，製造大量命中以觸發召喚
                for (let r = 0; r < 4; r++) {
                    for (let c = 1; c < 4; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 1200));
                    }
                }
            },
            bulletConfig: { damage: 20, bounce: 10, pierce: 0, scatter: 0, multicast: 0, pyro: 200, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
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

        // ── 屬性共鳴（ELEMENT_RESONANCE_DB）────────────────────────────────────────────────
        //   每个场景注入对应元素的「三阶」共鸣（statCount 设为阈值），并配置对应属性子弹用于现场观察。
        //   切换 resonanceTier(1/2/3) 可验证不同阶位。引擎在 loadScenario 中自动注入到 activeElementResonances。
        {
            id: 'res_pyro',
            categoryId: 'resonance',
            resonanceElement: 'pyro',
            resonanceTier: 3,
            name: '炎焰共鳴·三階',
            icon: '🔥',
            desc: '[炎焰共鳴 T3] 火焰額外傷害觸發溫度降至 0°、爆燃閾值降至 100°、基礎火焰 +25、火焰傷害整體 +50%。建議連續命中觀察更快的燃燒/爆燃。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                const e = new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 2500);
                e.temp = 60;
                game.enemies.push(e);
                [{c:1.5,r:0},{c:3.5,r:0},{c:1.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 400));
                });
            },
            bulletConfig: { damage: 10, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 300, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'res_cryo',
            categoryId: 'resonance',
            resonanceElement: 'cryo',
            resonanceTier: 3,
            name: '冰霜共鳴·三階',
            icon: '❄️',
            desc: '[冰霜共鳴 T3] 凍結觸發溫度提升至 -20°（極易凍結）、基礎冰霜 +25、冰霜傷害 +50%、凍結狀態額外受傷 +30%。建議觀察敵人是否快速凍結。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                const e = new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 2000);
                e.temp = 0;
                game.enemies.push(e);
            },
            bulletConfig: { damage: 60, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 80, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'res_lightning',
            categoryId: 'resonance',
            resonanceElement: 'lightning',
            resonanceTier: 3,
            name: '雷霆共鳴·三階',
            icon: '⚡',
            desc: '[雷霆共鳴 T3] 閃電鏈觸發概率與額外鏈數大幅提升、基礎閃電 +25。建議布置密集敵群觀察連鎖閃電覆蓋。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 4; r++) {
                    for (let c = 1; c < 4; c++) {
                        const e = new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 400);
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
            id: 'res_bounce',
            categoryId: 'resonance',
            resonanceElement: 'bounce',
            resonanceTier: 3,
            name: '彈跳共鳴·三階',
            icon: '⤴️',
            desc: '[彈跳共鳴 T3] 彈跳相關加成達到最高階。建議布置分散怪群，觀察彈跳次數與連擊加成。',
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
            id: 'res_pierce',
            categoryId: 'resonance',
            resonanceElement: 'pierce',
            resonanceTier: 3,
            name: '穿透共鳴·三階',
            icon: '↗️',
            desc: '[穿透共鳴 T3] 穿透衰減率大幅降低（T3 -40%）、基礎穿透提升。建議布置縱列敵群，觀察穿透後排傷害衰減是否減緩。',
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
        {
            id: 'res_scatter',
            categoryId: 'resonance',
            resonanceElement: 'scatter',
            resonanceTier: 3,
            name: '散射共鳴·三階',
            icon: '🔱',
            desc: '[散射共鳴 T3] 散射分裂相關加成達到最高階。建議布置寬幅怪群，觀察分裂子彈覆蓋面。',
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
            id: 'res_venom',
            categoryId: 'resonance',
            resonanceElement: 'venom',
            resonanceTier: 3,
            name: '毒素共鳴·三階',
            icon: '☠️',
            desc: '[毒素共鳴 T3] 命中附加更多毒層（baseVenomBonus）、毒素傷害提升。建議用高血量敵人觀察 DoT 疊加速度。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 4000));
                [{c:1.5,r:1},{c:3.5,r:1}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 2000));
                });
            },
            bulletConfig: { damage: 8, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, venom: 10, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'res_overcharge',
            categoryId: 'resonance',
            resonanceElement: 'overcharge',
            resonanceTier: 3,
            name: '超載共鳴·三階',
            icon: '💥',
            desc: '[超載共鳴 T3] 超載爆炸範圍/傷害達到最高階。建議命中怪群中心觀察 AOE 範圍與傷害。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1200));
                [{c:1.5,r:0},{c:2.5,r:0},{c:3.5,r:0},{c:1.5,r:1},{c:3.5,r:1},{c:1.5,r:2},{c:2.5,r:2},{c:3.5,r:2}].forEach(p => {
                    game.enemies.push(new Enemy(p.c * w + w/2, top + p.r * h + h/2, 60, 60, 300));
                });
            },
            bulletConfig: { damage: 15, bounce: 0, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, overcharge: 10, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(0, -15);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'res_echo',
            categoryId: 'resonance',
            resonanceElement: 'echo',
            resonanceTier: 3,
            name: '回響共鳴·三階',
            icon: '🔁',
            desc: '[回響共鳴 T3] 回響觸發率與屬性繼承達到最高階。建議多次發射，觀察分裂子彈數量。',
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight, top = game.combatGridTopY;
                for (let r = 0; r < 3; r++) {
                    for (let c = 1; c < 4; c++) {
                        game.enemies.push(new Enemy((c + 0.5) * w + w/2, top + r * h + h/2, 60, 60, 400));
                    }
                }
            },
            bulletConfig: { damage: 15, bounce: 2, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, echo: 10, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const vel = new Vec2(1, -16);
                game.spawn_spawnBullet(game.width / 2, game.height - 100, vel, { ...tg.bulletConfig }, null, true);
            }
        },
        {
            id: 'res_laser',
            categoryId: 'resonance',
            resonanceElement: 'laser',
            resonanceTier: 3,
            name: '激光共鳴·三階',
            icon: '🔦',
            desc: '[激光共鳴 T3] 激光相關加成（持續/反射/傷害）達到最高階。建議布置縱列敵群觀察射線穿透與傷害。',
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
        },

        // ── 敵人 V2 美術驗收（逐場景单独验证基底 + 词条视觉）─────────────
        // 对应 docs/enemy_art_implementation_impact.md §试炼场验收说明。
        // 每个场景显式创建 Enemy 实例，字段与 spawn_trySpawnArchetypes 保持一致。
        ...buildEnemyV2Scenarios(),

        // ── 敵人 V2 矩陣（尺寸基底 + 專屬詞條可見性驗收）─────────────
        // 對應文檔 docs/enemy_visual_design_v2.md：
        // 9 種 V2 基底（1×1 / 2×1 / 1×2 / 2×2 / 3×1 / 1×3 / 2×3 / 3×2 / 3×3）
        // 字段命名與 spawn_trySpawnArchetypes 保持一致：
        //   - baseArchetype  基底 ID
        //   - gridCols/gridRows 占格尺寸
        //   - isWideEnemy    cols >= 2 時為 true
        //   - affixes        專屬詞條
        ...buildV2MatrixScenarios()
    ]
};

/**
 * [V2 可見性驗收] 構建敵人 V2 矩陣演示場景。
 * 一次性放置 9 種 V2 基底，字段寫法與 spawn_trySpawnArchetypes 保持一致。
 * 為避免大改 Enemy 構造函數，採用「先 new 後賦值」的兼容寫法。
 */
function buildV2MatrixScenarios() {
    // [V2 资源协议] 演示矩阵从 ENEMY_V2_METADATA 读取，避免演示页与图鉴重复维护。
    // 1×1 sludge 是矩阵基线对照（不属于正式 V2 基底），保留在演示文件本地。
    const SLUDGE = { id: 'sludge', name: '炼金残渣', footprint: '1×1', cols: 1, rows: 1,
                     baseArchetype: 'sludge', affixes: [], hpMult: 1.0 };
    const V2_BASES = [SLUDGE, ...ENEMY_V2_METADATA.map(m => ({
        id: m.id,
        name: m.name,
        footprint: m.footprint,
        cols: m.cols,
        rows: m.rows,
        baseArchetype: m.baseArchetype,
        affixes: m.affixes.slice(),
        hpMult: m.hpMult,
    }))];

    // 6 列 × 6 行的緊湊矩陣布局（與 enemyCols=6 對齊）：
    //   row 0       : 1×1 sludge | 2×1 deflector | 3×1 bastion
    //   row 1-2     : 1×2 echoSpire | 2×2 maw     | 3×2 siege
    //   row 3-5     : 1×3 prism     | 2×3 hive    | 3×3 gravityCore
    const LAYOUT = {
        sludge:      { col: 0, row: 0 },
        deflector:   { col: 1, row: 0 },
        bastion:     { col: 3, row: 0 },
        echoSpire:   { col: 0, row: 1 },
        maw:         { col: 1, row: 1 },
        siege:       { col: 3, row: 1 },
        prism:       { col: 0, row: 3 },
        hive:        { col: 1, row: 3 },
        gravityCore: { col: 3, row: 3 }
    };

    const setupMatrix = (game, onlyId = null) => {
        const tg = game.trainingGround;
        if (tg && typeof tg._clearV2MatrixOverlay === 'function') tg._clearV2MatrixOverlay();

        const w = game.enemyWidth;
        const h = game.enemyHeight;
        const top = game.combatGridTopY;
        const baseHP = 200;
        const afx = (CONFIG && CONFIG.balance && CONFIG.balance.affixes) || {};

        const labelData = [];

        for (const def of V2_BASES) {
            if (onlyId && def.id !== onlyId) continue;
            const place = LAYOUT[def.id];
            const centerX = (place.col + (def.cols - 1) / 2) * w + w / 2;
            const centerY = top + (place.row + (def.rows - 1) / 2) * h;
            const wPx = w * def.cols;
            const hPx = h * def.rows;
            const hp = Math.floor(baseHP * Math.max(1, def.cols * def.rows));

            const e = new Enemy(centerX, centerY, wPx, hPx, hp, hp,
                def.affixes.length > 0 ? 'elite' : 'normal',
                def.affixes.slice());

            // 與 spawn_trySpawnArchetypes 對齊的字段命名
            e.baseArchetype = def.baseArchetype;
            e.gridCols = def.cols;
            e.gridRows = def.rows;
            if (def.cols >= 2) e.isWideEnemy = true;

            // 凍結移動，保持矩陣穩定可視
            e._moveInterval = 9999;
            e._moveCooldown = 9999;
            e.hasActedThisTurn = true;

            // 專屬詞條的初始化（與 spawn_trySpawnArchetypes 對齊）
            if (def.affixes.includes('deflectionWard')) {
                const pct = afx.deflectionWardBarrierPct || 0.10;
                e.wardBarrierMax = Math.max(1, Math.floor(hp * pct));
                e.wardBarrier = e.wardBarrierMax;
                e.wardBrokenThisTurn = false;
            }
            if (def.affixes.includes('hive')) {
                e._hiveCooldown = afx.hiveSpawnInterval || 2;
            }

            // 異形輪廓（複用 spawn_system 的形狀映射）
            if (typeof game.spawn_applyArchetypeShape === 'function') {
                game.spawn_applyArchetypeShape(e, def.baseArchetype);
            }
            if (typeof e.initSprite === 'function') e.initSprite();

            game.enemies.push(e);
            labelData.push({ enemy: e, def, centerX, centerY, hPx });
        }

        // 渲染標籤（DOM overlay）
        if (tg && typeof tg._renderV2MatrixLabels === 'function') {
            tg._renderV2MatrixLabels(labelData);
        }
    };

    const triggerBehaviors = (game) => {
        const tg = game.trainingGround;
        // 1) deflectionWard：把屏障打掉一半，使副屏障條視覺差異可見
        // 2) hive：直接調 spawn_spawnEnemyClone 或減少冷卻
        // 3) gravityWell：在範圍內顯示一條引力環視覺（用 shockwave）
        // 4) echoRelay：以 floatingText 標出範圍
        const enemies = game.enemies;
        for (const e of enemies) {
            if (!e || !e.active) continue;
            const a = (e.affixes || [])[0];
            if (a === 'deflectionWard' && e.wardBarrier !== undefined) {
                e.wardBarrier = Math.max(0, Math.floor(e.wardBarrierMax * 0.5));
            } else if (a === 'hive') {
                e._hiveCooldown = 0;
            } else if (a === 'gravityWell') {
                if (typeof game.spawn_createShockwave === 'function') {
                    game.spawn_createShockwave(e.pos.x, e.pos.y, '#7c3aed');
                }
            } else if (a === 'echoRelay') {
                if (typeof game.spawn_createShockwave === 'function') {
                    game.spawn_createShockwave(e.pos.x, e.pos.y, '#f0abfc');
                }
            }
        }
        if (tg && tg.addLog) tg.addLog && tg.addLog('觸發 V2 行為演示（屏障 / 引力環 / 回響波）');
    };

    const all = {
        id: 'v2_matrix_all',
        categoryId: 'v2matrix',
        name: '🧩 V2 矩陣（全部 9 種）',
        icon: '🧩',
        desc: '一次性展示 9 種 V2 基底敵人（1×1 ~ 3×3）。每個敵人下方標籤顯示 footprint / baseArchetype / affixes。點「觸發演示」可看到代表性詞條視覺反饋。',
        setup: (game) => setupMatrix(game, null),
        demoAction: (game) => triggerBehaviors(game)
    };

    const singles = V2_BASES.map(def => ({
        id: 'v2_matrix_' + def.id,
        categoryId: 'v2matrix',
        name: `${def.footprint} ${def.name}`,
        icon: def.footprint,
        desc: `${def.name}（${def.footprint}）：baseArchetype=${def.baseArchetype}，affixes=${JSON.stringify(def.affixes)}。`,
        setup: (game) => setupMatrix(game, def.id),
        demoAction: (game) => triggerBehaviors(game)
    }));

    return [all, ...singles];
}

/**
 * [敌人 V2 美术验收] 构建 enemy_v2 分类下的验收场景列表。
 * 共 9 个场景（8 必选 + 1 可选 fallback），覆盖：
 *   1. 1×1 基准对照
 *   2. 2×2 maw/devour
 *   3. 3×1 bastion/heavyArmor
 *   4. 3×2 siege（静态展示）
 *   5. siege 前排阻挡链推挤
 *   6. 大型敌人 + 通用词条适配（maw + shield）
 *   7. 敌人针对词缀 Canvas fallback 集中验收
 *   8. 资源 fallback 展示（3×3 gravityWell）
 *   9. 导演预设波次生成入口
 *
 * 每个场景的 setup(game) 显式创建 Enemy 实例并赋值：
 *   baseArchetype, gridCols, gridRows, affixes, width, height, maxHp/hp
 * 这些字段与 spawn_trySpawnArchetypes 的命名保持一致。
 *
 * desc 字符串包含：尺寸 footprint / 基底 / 词条 / 行为摘要 / 资源状态。
 */
function buildEnemyV2Scenarios() {

    // @section:enemy_v2_asset_status - 资源命中状态文本
    // [资源命中状态] 直接从 enemy_sprite_manifest.json 解析，避免重复硬编码命名。
    // 同时保留 ENEMY_V2_BY_ID.placeholder 作为占位资源标记。
    const resourceStatusFor = ({ archetype, cols, rows, affixes, archetypeIdForPlaceholder }) => {
        const probe = {
            baseArchetype: archetype || null,
            gridCols: cols || 1,
            gridRows: rows || 1,
            affixes: (affixes || []).slice(),
        };
        const resolved = resolveEnemyVisualAsset(probe);
        const tagInfo = describeAssetHitStatus(resolved);
        const key = resolved.assetKey;
        // 占位资源标记（V2 metadata 内部为 placeholder=true 时附加 PH 标识）
        let placeholderNote = '';
        if (archetypeIdForPlaceholder) {
            const meta = ENEMY_V2_BY_ID[archetypeIdForPlaceholder];
            if (meta && meta.placeholder) placeholderNote = '（PH 占位 / placeholder=true）';
        }
        return {
            tag: tagInfo.tag,
            line: `[${tagInfo.tag}] ${tagInfo.detail}${placeholderNote}　key=${key}`,
            resolved,
        };
    };

    // 构造场景说明区域的标准文本
    const mkDesc = (footprint, archetype, affixList, behavior, resourceLine) => {
        const afxStr = affixList.length > 0 ? affixList.join(' + ') : '无';
        const archStr = archetype || '无';
        return [
            `📐 footprint：${footprint}　基底：${archStr}　词条：${afxStr}`,
            `⚙️ 行为：${behavior}`,
            `📦 资源：${resourceLine}`
        ].join('\n');
    };

    const lineFor = (opts) => resourceStatusFor(opts).line;
    const tagFor  = (opts) => resourceStatusFor(opts).tag;

    // @section:enemy_v2_targeting_fallback - 敌人针对兜底验收
    const setupTargetingFallbackAcceptance = (game) => {
        const tg = game.trainingGround;
        if (tg && typeof tg._clearV2MatrixOverlay === 'function') tg._clearV2MatrixOverlay();

        const w = game.enemyWidth;
        const h = game.enemyHeight;
        const top = game.combatGridTopY;
        const labelData = [];

        const placeEnemy = ({
            col,
            row,
            cols = 1,
            rows = 1,
            name,
            affixes = [],
            hp = 240,
            type = 'elite',
            baseArchetype = null,
            setup = null,
        }) => {
            const centerX = (col + (cols - 1) / 2) * w + w / 2;
            const centerY = top + (row + (rows - 1) / 2) * h;
            const e = new Enemy(centerX, centerY, w * cols, h * rows, hp, hp, type, affixes.slice());
            e.baseArchetype = baseArchetype;
            e.gridCols = cols;
            e.gridRows = rows;
            if (cols >= 2) e.isWideEnemy = true;
            e._moveInterval = 9999;
            e._moveCooldown = 9999;
            e.hasActedThisTurn = true;
            e.dropTargetY = e.pos.y;
            if (setup) setup(e);
            if (typeof game.spawn_applyArchetypeShape === 'function' && baseArchetype) {
                game.spawn_applyArchetypeShape(e, baseArchetype);
            }
            if (typeof e.initSprite === 'function') e.initSprite();
            game.enemies.push(e);
            labelData.push({
                enemy: e,
                centerX,
                centerY,
                hPx: h * rows,
                def: {
                    name,
                    footprint: `${cols}×${rows}`,
                    baseArchetype: baseArchetype || 'residue',
                    affixes: affixes.slice(),
                },
            });
            return e;
        };

        placeEnemy({
            col: 0, row: 0, name: '蓄能甲', affixes: ['energyArmor'],
            setup: (e) => { e.energyArmorShield = 70; },
        });
        placeEnemy({
            col: 1, row: 0, name: '相位护盾·启', affixes: ['phaseShield', 'shield'],
            setup: (e) => { e.shieldCharges = 4; e.phaseShieldDisabledThisTurn = false; },
        });
        placeEnemy({
            col: 2, row: 0, name: '相位护盾·断', affixes: ['phaseShield', 'shield'],
            setup: (e) => { e.shieldCharges = 4; e.phaseShieldDisabledThisTurn = true; },
        });
        placeEnemy({
            col: 3, row: 0, name: '过量炉+3', affixes: ['overloadReactor'],
            setup: (e) => { e._overloadDamageThisTurn = e.maxHp; e._overloadBonusThisTurn = 3; },
        });
        placeEnemy({ col: 4, row: 0, name: '低伤免疫', affixes: ['lowDamageImmune'] });
        placeEnemy({ col: 5, row: 0, name: '偏折壳', affixes: ['deflectShell'] });

        const livingArmorState = (hp, max, stacked = false) => (e) => {
            e.livingArmorMax = max;
            e.livingArmorHp = hp;
            e.livingArmorBaseMax = stacked ? Math.floor(max * 0.65) : max;
            e.livingArmorStacked = stacked;
            e.livingArmorBroken = false;
        };
        placeEnemy({ col: 0, row: 1, name: '活甲 >50%', affixes: ['livingArmor'], setup: livingArmorState(90, 100) });
        placeEnemy({ col: 1, row: 1, name: '活甲 <50%', affixes: ['livingArmor'], setup: livingArmorState(45, 100) });
        placeEnemy({ col: 2, row: 1, name: '活甲 <20%', affixes: ['livingArmor'], setup: livingArmorState(15, 100) });
        const sporeSource = placeEnemy({ col: 3, row: 1, name: '护甲孢子', affixes: ['armorSpore'], hp: 300 });
        const sporeTarget = placeEnemy({
            col: 4, row: 1, name: '孢子叠甲', affixes: [],
            setup: livingArmorState(125, 150, true),
        });
        sporeTarget._armorSporeTrailFromX = sporeSource.pos.x;
        sporeTarget._armorSporeTrailFromY = sporeSource.pos.y;
        sporeTarget._armorSporeTrailDuration = 120;
        sporeTarget._armorSporeTrailTimer = 120;
        placeEnemy({ col: 5, row: 1, name: '撞城者', cols: 1, rows: 1, affixes: ['siegeBreaker'] });

        placeEnemy({ col: 0, row: 2, name: '叠甲 >50%', affixes: ['livingArmor'], setup: livingArmorState(160, 180, true) });
        placeEnemy({ col: 1, row: 2, name: '叠甲 <50%', affixes: ['livingArmor'], setup: livingArmorState(70, 180, true) });
        placeEnemy({ col: 2, row: 2, name: '叠甲 <20%', affixes: ['livingArmor'], setup: livingArmorState(25, 180, true) });

        placeEnemy({
            col: 1, row: 3, cols: 3, rows: 2,
            name: '铸巢母架', affixes: ['carrier'], hp: 900, baseArchetype: 'carrier',
            setup: (e) => {
                e.footprintMask = [[1, 1, 1], [1, 0, 1]];
                e.footprintCells = 5;
                e._carrierCooldown = 1;
            },
        });

        if (tg && typeof tg._renderV2MatrixLabels === 'function') {
            tg._renderV2MatrixLabels(labelData);
        }
    };

    // @section:enemy_v2_targeting_footprints - 多尺寸 targeting overlay 验收
    const setupTargetingFootprintAcceptance = (game) => {
        const tg = game.trainingGround;
        if (tg && typeof tg._clearV2MatrixOverlay === 'function') tg._clearV2MatrixOverlay();

        const w = game.enemyWidth;
        const h = game.enemyHeight;
        const top = game.combatGridTopY;
        const labelData = [];

        const placeEnemy = ({
            col,
            row,
            cols,
            rows,
            name,
            affixes,
            hp = 800,
            baseArchetype = null,
            setup = null,
        }) => {
            const centerX = (col + (cols - 1) / 2) * w + w / 2;
            const centerY = top + (row + (rows - 1) / 2) * h;
            const e = new Enemy(centerX, centerY, w * cols, h * rows, hp, hp, 'elite', affixes.slice());
            e.baseArchetype = baseArchetype;
            e.gridCols = cols;
            e.gridRows = rows;
            if (cols >= 2) e.isWideEnemy = true;
            e._moveInterval = 9999;
            e._moveCooldown = 9999;
            e.hasActedThisTurn = true;
            e.dropTargetY = e.pos.y;
            if (setup) setup(e);
            if (typeof game.spawn_applyArchetypeShape === 'function' && baseArchetype) {
                game.spawn_applyArchetypeShape(e, baseArchetype);
            }
            if (typeof e.initSprite === 'function') e.initSprite();
            game.enemies.push(e);
            labelData.push({
                enemy: e,
                centerX,
                centerY,
                hPx: h * rows,
                def: {
                    name,
                    footprint: `${cols}x${rows}`,
                    baseArchetype: baseArchetype || 'residue',
                    affixes: affixes.slice(),
                },
            });
            return e;
        };

        const livingArmorState = (hp, max, stacked = false) => (e) => {
            e.livingArmorMax = max;
            e.livingArmorHp = hp;
            e.livingArmorBaseMax = stacked ? Math.floor(max * 0.65) : max;
            e.livingArmorStacked = stacked;
            e.livingArmorBroken = false;
        };

        placeEnemy({
            col: 0, row: 0, cols: 3, rows: 3,
            name: 'overload 3x3', affixes: ['overloadReactor'], hp: 1600, baseArchetype: 'gravityWell',
            setup: (e) => { e._overloadDamageThisTurn = e.maxHp; e._overloadBonusThisTurn = 3; },
        });
        placeEnemy({
            col: 3, row: 0, cols: 1, rows: 2,
            name: 'phase 1x2', affixes: ['phaseShield', 'shield'], hp: 700, baseArchetype: 'echoSpire',
            setup: (e) => { e.shieldCharges = 4; e.phaseShieldDisabledThisTurn = false; },
        });
        placeEnemy({
            col: 4, row: 0, cols: 2, rows: 1,
            name: 'energy 2x1', affixes: ['energyArmor'], hp: 700, baseArchetype: 'deflector',
            setup: (e) => { e.energyArmorShield = 85; },
        });
        placeEnemy({
            col: 3, row: 2, cols: 3, rows: 1,
            name: 'immune 3x1', affixes: ['lowDamageImmune'], hp: 1000, baseArchetype: 'bastion',
        });
        placeEnemy({
            col: 0, row: 3, cols: 2, rows: 3,
            name: 'living 2x3', affixes: ['livingArmor'], hp: 1300, baseArchetype: 'hive',
            setup: livingArmorState(170, 220, true),
        });
        placeEnemy({
            col: 3, row: 3, cols: 3, rows: 2,
            name: 'carrier 3x2', affixes: ['carrier'], hp: 1200, baseArchetype: 'carrier',
            setup: (e) => {
                e.footprintMask = [[1, 1, 1], [1, 0, 1]];
                e.footprintCells = 5;
                e._carrierCooldown = 1;
            },
        });
        placeEnemy({
            col: 3, row: 5, cols: 3, rows: 1,
            name: 'siege 3x1', affixes: ['siegeBreaker'], hp: 950, baseArchetype: 'bastion',
        });

        if (tg && typeof tg._renderV2MatrixLabels === 'function') {
            tg._renderV2MatrixLabels(labelData);
        }
    };

    // @section:enemy_v2_scene_list - 验收场景列表
    return [
        // ── 场景 1：普通 1×1 对照 ─────────────────────────────────────
        {
            id: 'ev2_ref_1x1',
            categoryId: 'enemy_v2',
            name: '1×1 基准对照',
            icon: '⬜',
            assetHitTag: tagFor({ archetype: null, cols: 1, rows: 1, affixes: [] }),
            desc: mkDesc('1×1', '无', [],
                '标准单格炼金残渣，无专属基底、无词条。用作视觉对比基线，验证 1×1 占格单位的尺寸与渲染。',
                lineFor({ archetype: null, cols: 1, rows: 1, affixes: [] })),
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight;
                const top = game.combatGridTopY;
                const e = new Enemy(2 * w + w / 2, top + h / 2, w, h, 200, 200, 'normal', []);
                e.baseArchetype = null;
                e.gridCols = 1;
                e.gridRows = 1;
                e._moveInterval = 9999;
                e._moveCooldown = 9999;
                e.hasActedThisTurn = true;
                if (typeof e.initSprite === 'function') e.initSprite();
                game.enemies.push(e);
                // 精英变体对比
                const elite = new Enemy(3 * w + w / 2, top + h / 2, w, h, 200, 200, 'elite', ['shield']);
                elite.baseArchetype = null;
                elite.gridCols = 1;
                elite.gridRows = 1;
                elite._moveInterval = 9999;
                elite._moveCooldown = 9999;
                elite.hasActedThisTurn = true;
                if (typeof elite.initSprite === 'function') elite.initSprite();
                game.enemies.push(elite);
            },
            bulletConfig: { damage: 20, bounce: 2, pierce: 0, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },

        // ── 场景 2：2×2 深渊胃囊 / devour ────────────────────────────
        {
            id: 'ev2_maw_2x2',
            categoryId: 'enemy_v2',
            name: '2×2 深渊胃囊',
            icon: '👁️',
            assetHitTag: tagFor({ archetype: 'maw', cols: 2, rows: 2, affixes: ['devour'], archetypeIdForPlaceholder: 'maw' }),
            desc: mkDesc('2×2', 'maw', ['devour'],
                'devour：每回合有概率吞噬相邻友军并继承其血量与词条。旁边放有 1×1 目标供吞噬触发测试。点「触发演示」执行一回合行动。',
                lineFor({ archetype: 'maw', cols: 2, rows: 2, affixes: ['devour'], archetypeIdForPlaceholder: 'maw' })),
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight;
                const top = game.combatGridTopY;
                const afx = (CONFIG && CONFIG.balance && CONFIG.balance.affixes) || {};
                const hp = Math.floor(200 * 2.0);
                const maw = new Enemy(w * 1 + w, top + h, w * 2, h * 2, hp, hp, 'elite', ['devour']);
                maw.baseArchetype = 'maw';
                maw.gridCols = 2;
                maw.gridRows = 2;
                maw.isWideEnemy = true;
                maw._moveInterval = 9999;
                maw._moveCooldown = 9999;
                maw.hasActedThisTurn = true;
                if (typeof game.spawn_applyArchetypeShape === 'function') game.spawn_applyArchetypeShape(maw, 'maw');
                if (typeof maw.initSprite === 'function') maw.initSprite();
                game.enemies.push(maw);
                // 1×1 相邻目标供吞噬
                const food = new Enemy(w * 3 + w / 2, top + h / 2, w, h, 100, 100, 'normal', []);
                food._moveInterval = 9999;
                food.hasActedThisTurn = true;
                if (typeof food.initSprite === 'function') food.initSprite();
                game.enemies.push(food);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },

        // ── 场景 3：3×1 装甲横梁 / heavyArmor ────────────────────────
        {
            id: 'ev2_bastion_3x1',
            categoryId: 'enemy_v2',
            name: '3×1 装甲横梁',
            icon: '🧱',
            assetHitTag: tagFor({ archetype: 'bastion', cols: 3, rows: 1, affixes: ['heavyArmor'], archetypeIdForPlaceholder: 'bastion' }),
            desc: mkDesc('3×1', 'bastion', ['heavyArmor'],
                'heavyArmor：血量 ×2.0，每 2 回合才移动一次，横向占满 3 列封锁通道。点「触发演示」观察迟缓移动节奏。',
                lineFor({ archetype: 'bastion', cols: 3, rows: 1, affixes: ['heavyArmor'], archetypeIdForPlaceholder: 'bastion' })),
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight;
                const top = game.combatGridTopY;
                const afx = (CONFIG && CONFIG.balance && CONFIG.balance.affixes) || {};
                const hpMult = afx.heavyArmorHpMult || 2.0;
                const hp = Math.floor(200 * hpMult);
                const e = new Enemy(w * 1.5 + w / 2, top + h / 2, w * 3, h, hp, hp, 'elite', ['heavyArmor']);
                e.baseArchetype = 'bastion';
                e.gridCols = 3;
                e.gridRows = 1;
                e.isWideEnemy = true;
                e._moveInterval = afx.heavyArmorMoveInterval || 2;
                e._moveCooldown = 0;
                e.hasActedThisTurn = true;
                if (typeof game.spawn_applyArchetypeShape === 'function') game.spawn_applyArchetypeShape(e, 'bastion');
                if (typeof e.initSprite === 'function') e.initSprite();
                game.enemies.push(e);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },

        // ── 场景 4：3×2 攻城履带 / siege（静态展示）─────────────────
        {
            id: 'ev2_siege_3x2',
            categoryId: 'enemy_v2',
            name: '3×2 攻城履带',
            icon: '🚛',
            assetHitTag: tagFor({ archetype: 'siege', cols: 3, rows: 2, affixes: ['siege'], archetypeIdForPlaceholder: 'siege' }),
            desc: mkDesc('3×2', 'siege', ['siege'],
                'siege：免疫冰冻（热管闪烁反馈），血量 ×3.5，每 2 回合移动一次，前排无阻挡时正常推进。冻结词条对其无效。',
                lineFor({ archetype: 'siege', cols: 3, rows: 2, affixes: ['siege'], archetypeIdForPlaceholder: 'siege' })),
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight;
                const top = game.combatGridTopY;
                const afx = (CONFIG && CONFIG.balance && CONFIG.balance.affixes) || {};
                const hp = Math.floor(200 * (afx.siegeHpMult || 3.5));
                const e = new Enemy(w * 1.5 + w / 2, top + h, w * 3, h * 2, hp, hp, 'elite', ['siege']);
                e.baseArchetype = 'siege';
                e.gridCols = 3;
                e.gridRows = 2;
                e.isWideEnemy = true;
                e._moveInterval = afx.siegeMoveInterval || 2;
                e._moveCooldown = 9999;
                e.hasActedThisTurn = true;
                if (typeof game.spawn_applyArchetypeShape === 'function') game.spawn_applyArchetypeShape(e, 'siege');
                if (typeof e.initSprite === 'function') e.initSprite();
                game.enemies.push(e);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },

        // ── 场景 5：siege 前排阻挡链推挤 ─────────────────────────────
        {
            id: 'ev2_siege_push',
            categoryId: 'enemy_v2',
            name: 'Siege 阻挡推挤',
            icon: '🏗️',
            assetHitTag: tagFor({ archetype: 'siege', cols: 3, rows: 2, affixes: ['siege'], archetypeIdForPlaceholder: 'siege' }),
            desc: mkDesc('3×2 + 1×1×3 阻挡链', 'siege', ['siege'],
                '前排 3 个 1×1 阻挡兵（col 1-3）+ 后排 3×2 siege（row 1-2）。点「触发演示」触发敌人行动：siege 移动被前排阻挡时会尝试将整条阻挡链向前推 1 行，验证链推挤逻辑与失败线判定。',
                lineFor({ archetype: 'siege', cols: 3, rows: 2, affixes: ['siege'], archetypeIdForPlaceholder: 'siege' })),
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight;
                const top = game.combatGridTopY;
                const afx = (CONFIG && CONFIG.balance && CONFIG.balance.affixes) || {};
                const hp = Math.floor(200 * (afx.siegeHpMult || 3.5));
                // 3×2 siege 放置在 row 1-2（center at row=1, rows=2）
                const siege = new Enemy(w * 1.5 + w / 2, top + h + h, w * 3, h * 2, hp, hp, 'elite', ['siege']);
                siege.baseArchetype = 'siege';
                siege.gridCols = 3;
                siege.gridRows = 2;
                siege.isWideEnemy = true;
                siege._moveInterval = afx.siegeMoveInterval || 2;
                siege._moveCooldown = 0;
                siege.hasActedThisTurn = false;
                if (typeof game.spawn_applyArchetypeShape === 'function') game.spawn_applyArchetypeShape(siege, 'siege');
                if (typeof siege.initSprite === 'function') siege.initSprite();
                game.enemies.push(siege);
                // 前排 3 个 1×1 阻挡兵 col 1, 2, 3（row 0）
                for (let c = 1; c <= 3; c++) {
                    const bx = c * w + w / 2;
                    const by = top + h / 2;
                    const blocker = new Enemy(bx, by, w, h, 150, 150, 'normal', []);
                    blocker.gridCols = 1;
                    blocker.gridRows = 1;
                    blocker._moveInterval = 9999;
                    blocker.hasActedThisTurn = false;
                    if (typeof blocker.initSprite === 'function') blocker.initSprite();
                    game.enemies.push(blocker);
                }
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },

        // ── 场景 6：大型敌人 + 通用词条适配（maw + shield / regen）──
        {
            id: 'ev2_large_generic_affix',
            categoryId: 'enemy_v2',
            name: '大型 + 通用词条',
            icon: '🧬',
            assetHitTag: tagFor({ archetype: 'maw', cols: 2, rows: 2, affixes: ['devour', 'shield'], archetypeIdForPlaceholder: 'maw' }),
            desc: mkDesc('2×2', 'maw', ['devour', 'shield'],
                '2×2 深渊胃囊叠加通用词条 shield：验证护盾特效能否覆盖完整 2×2 轮廓（而非只包住中心）。右侧 1×1 regen 精英用于对比同一通用词条在不同尺寸下的视觉缩放。',
                lineFor({ archetype: 'maw', cols: 2, rows: 2, affixes: ['devour', 'shield'], archetypeIdForPlaceholder: 'maw' })),
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight;
                const top = game.combatGridTopY;
                const hp = Math.floor(200 * 2.0);
                // 2×2 maw + devour + shield（左侧）
                const maw = new Enemy(w * 0 + w, top + h, w * 2, h * 2, hp, hp, 'elite', ['devour', 'shield']);
                maw.baseArchetype = 'maw';
                maw.gridCols = 2;
                maw.gridRows = 2;
                maw.isWideEnemy = true;
                maw._moveInterval = 9999;
                maw._moveCooldown = 9999;
                maw.hasActedThisTurn = true;
                if (typeof game.spawn_applyArchetypeShape === 'function') game.spawn_applyArchetypeShape(maw, 'maw');
                if (typeof maw.initSprite === 'function') maw.initSprite();
                game.enemies.push(maw);
                // 1×1 regen 精英（右侧对比）
                const ref = new Enemy(w * 3 + w / 2, top + h / 2, w, h, 200, 200, 'elite', ['regen']);
                ref.gridCols = 1;
                ref.gridRows = 1;
                ref._moveInterval = 9999;
                ref.hasActedThisTurn = true;
                if (typeof ref.initSprite === 'function') ref.initSprite();
                game.enemies.push(ref);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },

        // ── 场景 7：敌人针对词缀 Canvas fallback 集中验收 ────────────
        {
            id: 'ev2_enemy_targeting_fallback',
            categoryId: 'enemy_v2',
            name: '敌人针对 Fallback',
            icon: '🎯',
            assetHitTag: 'Vector fallback',
            keepSidebarOpenOnDemo: true,
            desc: [
                '📐 集中验收：九个保留的敌人针对词缀与铸巢母架空舱。',
                '⚙️ 行为：静态冻结敌人，展示蓄能甲、相位护盾启/断、过量炉计数、低伤硬壳、活甲三档、叠甲三档、孢子飞线、撞城者、1×1 偏折壳与铸巢母架第 5 格空舱。',
                '📦 资源：正式 PNG 未生成前必须保持 Canvas fallback 可读；点「触发演示」刷新孢子飞线与状态脉冲。'
            ].join('\n'),
            setup: (game) => setupTargetingFallbackAcceptance(game),
            bulletConfig: { damage: 45, bounce: 2, pierce: 1, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                const source = game.enemies.find(e => e && e.affixes && e.affixes.includes('armorSpore'));
                const target = game.enemies.find(e => e && e.livingArmorStacked && !(e.affixes || []).includes('livingArmor'));
                if (source && target) {
                    target._armorSporeTrailFromX = source.pos.x;
                    target._armorSporeTrailFromY = source.pos.y;
                    target._armorSporeTrailDuration = 120;
                    target._armorSporeTrailTimer = 120;
                }
                game.enemies.forEach(e => {
                    if (!e || !e.active) return;
                    if ((e.affixes || []).includes('overloadReactor')) e._overloadBonusThisTurn = 3;
                    if ((e.affixes || []).includes('energyArmor')) e.energyArmorShield = Math.max(e.energyArmorShield || 0, 70);
                    if ((e.affixes || []).includes('phaseShield') && e.pos.x > game.enemyWidth * 2) e.phaseShieldDisabledThisTurn = true;
                });
                if (typeof game.spawn_createFloatingText === 'function' && source) {
                    game.spawn_createFloatingText(source.pos.x, source.pos.y - 34, 'Fallback', '#bef264', 12);
                }
                if (tg && tg.addLog) tg.addLog('已刷新敌人针对 fallback：孢子飞线、相位断窗、炉心层数与蓄能甲。');
            }
        },

        // ── 场景 8（可选 fallback）：3×3 引力炉心资源降级渲染 ────────
        {
            id: 'ev2_enemy_targeting_footprints',
            categoryId: 'enemy_v2',
            name: 'Targeting Footprints',
            icon: '▣',
            assetHitTag: 'Overlay PNG',
            keepSidebarOpenOnDemo: true,
            desc: [
                '[enemy_v2] Footprint-aware targeting overlay acceptance.',
                'Layout: overloadReactor 3x3, phaseShield 1x2, energyArmor 2x1, lowDamageImmune 3x1, livingArmor 2x3, carrier 3x2, siegeBreaker 3x1.',
                'Expected: every targeting border follows the full grid footprint and does not collapse back to a centered 1x1 overlay.'
            ].join('\n'),
            setup: (game) => setupTargetingFootprintAcceptance(game),
            bulletConfig: { damage: 45, bounce: 2, pierce: 1, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game, tg) => {
                game.enemies.forEach(e => {
                    if (!e || !e.active) return;
                    if ((e.affixes || []).includes('overloadReactor')) e._overloadBonusThisTurn = 3;
                    if ((e.affixes || []).includes('energyArmor')) e.energyArmorShield = Math.max(e.energyArmorShield || 0, 85);
                    if ((e.affixes || []).includes('phaseShield')) e.phaseShieldDisabledThisTurn = !e.phaseShieldDisabledThisTurn;
                    if ((e.affixes || []).includes('livingArmor')) {
                        e.livingArmorHp = Math.max(1, Math.floor((e.livingArmorMax || 220) * 0.72));
                        e.livingArmorStacked = true;
                        e.livingArmorBroken = false;
                    }
                });
                if (tg && tg.addLog) tg.addLog('Refreshed footprint-aware targeting PNG overlays.');
            }
        },

        {
            id: 'ev2_fallback_large',
            categoryId: 'enemy_v2',
            name: '资源 Fallback（3×3）',
            icon: '🔧',
            assetHitTag: tagFor({ archetype: 'gravityWell', cols: 3, rows: 3, affixes: ['gravityWell'], archetypeIdForPlaceholder: 'gravityCore' }),
            desc: mkDesc('3×3', 'gravityWell', ['gravityWell'],
                '引力炉心 —— 验证当正式美术资源未接入时，是否正确回退到程序化矢量绘制（黑核 + 环形炉壁 + 向心网格）。同时验证 3×3 大体型的碰撞轮廓（arc 圆形）。',
                lineFor({ archetype: 'gravityWell', cols: 3, rows: 3, affixes: ['gravityWell'], archetypeIdForPlaceholder: 'gravityCore' })),
            setup: (game) => {
                const w = game.enemyWidth, h = game.enemyHeight;
                const top = game.combatGridTopY;
                const afx = (CONFIG && CONFIG.balance && CONFIG.balance.affixes) || {};
                const hp = Math.floor(200 * (afx.gravityWellHpMult || 6.0));
                const e = new Enemy(w * 1.5 + w / 2, top + h * 1.5, w * 3, h * 3, hp, hp, 'elite', ['gravityWell']);
                e.baseArchetype = 'gravityWell';
                e.gridCols = 3;
                e.gridRows = 3;
                e.isWideEnemy = true;
                e._moveInterval = afx.gravityWellMoveInterval || 3;
                e._moveCooldown = 9999;
                e.hasActedThisTurn = true;
                if (typeof game.spawn_applyArchetypeShape === 'function') game.spawn_applyArchetypeShape(e, 'gravityWell');
                if (typeof e.initSprite === 'function') e.initSprite();
                game.enemies.push(e);
            },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },

        // ── 场景 9：V2 大型基底 preset 生成入口验收 ────────────────
        {
            id: 'ev2_wave_preset_spawn',
            categoryId: 'enemy_v2',
            name: '预设波次生成',
            icon: '🎬',
            assetHitTag: 'PRESET',
            desc: [
                '📐 验证入口：spawn_trySpawnWavePreset()',
                '⚙️ 行为：临时固定 Round 12 与随机数，强制命中首个可用 preset，生成 2×1 deflector + 1×1 陪衬单位。',
                '📦 目的：确认大型基底能通过导演 preset 进入战场，而不是只依赖随机大型基底回退。'
            ].join('\n'),
            setup: (game) => {
                const oldRound = game.round;
                const oldUsage = game._wavePresetUsage;
                const oldIntroShown = game._wavePresetIntroShown;
                const oldRoundUsed = game._wavePresetRoundUsed;
                const oldRandom = Math.random;
                try {
                    game.round = 12;
                    game._wavePresetUsage = {};
                    game._wavePresetIntroShown = {};
                    game._wavePresetRoundUsed = null;
                    Math.random = () => 0;
                    const occupied = Array(CONFIG.gameplay.enemyCols).fill(false);
                    if (typeof game.spawn_trySpawnWavePreset === 'function') {
                        game.spawn_trySpawnWavePreset(game.combatGridTopY + game.enemyHeight / 2, 200, occupied, game.enemyWidth, {});
                    }
                } finally {
                    Math.random = oldRandom;
                    game.round = oldRound;
                    game._wavePresetUsage = oldUsage;
                    game._wavePresetIntroShown = oldIntroShown;
                    game._wavePresetRoundUsed = oldRoundUsed;
                }
            },
            bulletConfig: { damage: 35, bounce: 0, pierce: 2, scatter: 0, multicast: 0, pyro: 0, cryo: 0, lightning: 0, wind: 0, isLaser: false, isMatryoshka: false, type: 'normal' },
            demoAction: (game) => { game.phase_enemy_startLogic(); }
        },
    ];
}

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
        // 自定义敌人配置
        this.enemyConfig = { base: 'normal', hp: 1000, affixes: [] };
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
            body.pc-mode #phase-training {
                justify-content: center;
                background: #020617;
            }
            body.pc-mode #train-main-area {
                flex: 0 0 min(480px, calc(100dvh * 9 / 16));
                width: min(480px, calc(100dvh * 9 / 16));
                max-width: 480px;
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
            body.pc-mode #train-sidebar {
                flex: 0 0 220px;
                width: 220px;
                min-width: 220px;
                max-height: 100dvh;
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
            body.pc-mode #train-control-panel {
                max-width: 100%;
                overflow: hidden;
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
            /* 子弹属性卡片：输入框 + 滑块 + 步进 */
            .train-attr-card { display:flex; flex-direction:column; gap:5px; padding:7px 8px; background:rgba(30,41,59,0.6); border:1px solid #334155; border-radius:8px; }
            .train-attr-head { display:flex; align-items:center; justify-content:space-between; gap:6px; }
            .train-attr-label { font-size:10px; font-weight:bold; color:#94a3b8; text-transform:uppercase; letter-spacing:0.03em; }
            .train-attr-num { width:58px; background:#0f172a; border:1px solid #475569; border-radius:5px; color:#22d3ee; font-family:monospace; font-size:12px; text-align:right; padding:2px 5px; -moz-appearance:textfield; }
            .train-attr-num:focus { outline:none; border-color:#06b6d4; }
            .train-attr-num::-webkit-outer-spin-button, .train-attr-num::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
            .train-attr-range { width:100%; height:4px; accent-color:#06b6d4; cursor:pointer; }
            .train-attr-steps { display:flex; gap:4px; }
            .train-attr-step { flex:1; padding:2px 0; background:#334155; color:#cbd5e1; border-radius:4px; font-size:11px; line-height:1.4; transition:background .15s; cursor:pointer; }
            .train-attr-step:hover { background:#475569; }
            .train-attr-toggle { width:100%; padding:5px 0; border-radius:5px; font-size:11px; font-weight:bold; transition:background .15s; cursor:pointer; }
            /* 敌人配置面板 */
            .train-enemy-row { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:10px; }
            .train-enemy-label { font-size:11px; font-weight:bold; color:#94a3b8; min-width:48px; }
            .train-enemy-select, .train-enemy-num { background:#0f172a; border:1px solid #475569; border-radius:6px; color:#e2e8f0; font-size:12px; padding:4px 8px; }
            .train-enemy-num { width:84px; font-family:monospace; color:#fca5a5; text-align:right; -moz-appearance:textfield; }
            .train-enemy-num::-webkit-outer-spin-button, .train-enemy-num::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
            .train-enemy-range { flex:1; min-width:120px; height:4px; accent-color:#ef4444; cursor:pointer; }
            .train-affix-chip { padding:3px 9px; border-radius:999px; border:1px solid #475569; background:rgba(30,41,59,0.6); color:#94a3b8; font-size:11px; cursor:pointer; transition:all .15s; user-select:none; }
            .train-affix-chip:hover { border-color:#64748b; color:#e2e8f0; }
            .train-affix-chip.on { background:rgba(6,182,212,0.18); border-color:#06b6d4; color:#cffafe; }
            .train-affix-group-label { width:100%; font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin:6px 0 2px; }
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
                    <button onclick="game.trainingGround.spawnCustomEnemy()" class="w-12 h-12 rounded-full bg-red-600/80 backdrop-blur-md border border-red-400/50 text-white shadow-lg shadow-red-500/20 flex items-center justify-center active:scale-90 transition-transform">
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
                        <div id="train-enemy-config"></div>
                        <div class="flex gap-2 flex-wrap mt-3">
                            <button onclick="game.trainingGround.spawnCustomEnemy()" class="py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors text-sm">召唤敌人</button>
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
        this.renderEnemyControls();
    }

    clearEnemies() {
        // [持续特效残留修复] 清空敌人前先销毁其燃烧/电弧/毒液/风场等持续特效，防止 PixiJS Sprite 残留
        pixiCleanupAllEffects(this.game);
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
        if (this.game.particleCounts) { for (const k in this.game.particleCounts) this.game.particleCounts[k] = 0; }
    }

    // 子弹数值属性的滑块范围 / 步进 / 中文标签（输入框可超出 max 手动填入）
    static get BULLET_ATTR_META() {
        return {
            damage:    { label: '伤害',  max: 1000, step: 5,  big: 50 },
            bounce:    { label: '弹跳',  max: 30,   step: 1,  big: 5 },
            pierce:    { label: '穿透',  max: 30,   step: 1,  big: 5 },
            scatter:   { label: '分裂',  max: 30,   step: 1,  big: 5 },
            multicast: { label: '连射',  max: 20,   step: 1,  big: 5 },
            pyro:      { label: '火焰',  max: 1000, step: 10, big: 100 },
            cryo:      { label: '冰冻',  max: 1000, step: 10, big: 100 },
            lightning: { label: '闪电',  max: 1000, step: 10, big: 100 },
            wind:      { label: '风',    max: 30,   step: 1,  big: 5 },
            venom:     { label: '毒',    max: 30,   step: 1,  big: 5 },
            laser:     { label: '激光',  max: 30,   step: 1,  big: 5 },
        };
    }

    /**
     * 精确设置子弹属性数值（输入框 onchange / 滑块 oninput / 步进按钮调用）。
     * 轻量同步成对控件，不整表重建，避免拖动滑块时被打断。
     */
    setBullet(key, rawVal, opts = {}) {
        const cur = this.bulletConfig[key];
        if (typeof cur === 'boolean') {
            this.bulletConfig[key] = (typeof rawVal === 'boolean') ? rawVal : !cur;
        } else {
            let v = Math.round(Number(rawVal));
            if (!isFinite(v)) v = 0;
            this.bulletConfig[key] = Math.max(0, v);
        }
        const v = this.bulletConfig[key];
        const numEl = document.getElementById(`train-attr-num-${key}`);
        const rangeEl = document.getElementById(`train-attr-range-${key}`);
        // 不覆盖用户正在输入的输入框
        if (numEl && document.activeElement !== numEl) numEl.value = v;
        if (rangeEl) rangeEl.value = Math.min(v, Number(rangeEl.max) || v);
        this.updateBulletPreview();
        // [修复] 修改连射时同步更新 HUD
        if (key === 'multicast') {
            eventBus.emit(EVENT_TYPES.UI_MULTICAST_UPDATE, { total: 1 + (this.bulletConfig.multicast || 0), bonusAmount: 0 });
        }
        if (opts.rerender) this.renderAttributeControls();
    }

    adjustBullet(key, delta) {
        if (typeof this.bulletConfig[key] === 'boolean') {
            this.bulletConfig[key] = !this.bulletConfig[key];
            this.renderAttributeControls();
            this.updateBulletPreview();
        } else {
            this.setBullet(key, (this.bulletConfig[key] || 0) + delta);
        }
    }

    renderAttributeControls() {
        const container = document.getElementById('train-attr-grid');
        if (!container) return;
        container.innerHTML = '';
        
        const META = TrainingGround.BULLET_ATTR_META;

        Object.entries(this.bulletConfig).forEach(([key, val]) => {
            const item = document.createElement('div');
            item.className = 'train-attr-card';

            // 布尔属性（isLaser / isMatryoshka）：TOGGLE 按钮
            if (typeof val === 'boolean') {
                item.innerHTML = `
                    <div class="train-attr-head">
                        <span class="train-attr-label">${key}</span>
                        <span class="text-xs font-mono ${val ? 'text-emerald-400' : 'text-slate-500'}">${val ? 'ON' : 'OFF'}</span>
                    </div>
                    <button onclick="game.trainingGround.adjustBullet('${key}', 0)" class="train-attr-toggle ${val ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}">TOGGLE</button>
                `;
                container.appendChild(item);
                return;
            }

            // 非数值（如 type 字符串）：只展示
            if (typeof val !== 'number') {
                item.innerHTML = `
                    <div class="train-attr-head">
                        <span class="train-attr-label">${key}</span>
                        <span class="text-xs font-mono text-slate-400">${val}</span>
                    </div>`;
                container.appendChild(item);
                return;
            }

            // 数值属性：输入框 + 滑块 + 步进
            const meta = META[key] || { label: key, max: 100, step: 1, big: 10 };
            const sliderMax = Math.max(meta.max, val);
            item.innerHTML = `
                <div class="train-attr-head">
                    <span class="train-attr-label">${meta.label}<span class="text-slate-600 lowercase ml-1">${key}</span></span>
                    <input id="train-attr-num-${key}" type="number" min="0" value="${val}"
                        onchange="game.trainingGround.setBullet('${key}', this.value)"
                        onfocus="this.select()"
                        class="train-attr-num">
                </div>
                <input id="train-attr-range-${key}" type="range" min="0" max="${sliderMax}" step="${meta.step}" value="${Math.min(val, sliderMax)}"
                    oninput="game.trainingGround.setBullet('${key}', this.value)"
                    class="train-attr-range">
                <div class="train-attr-steps">
                    <button class="train-attr-step" onclick="game.trainingGround.setBullet('${key}', 0)">0</button>
                    <button class="train-attr-step" onclick="game.trainingGround.adjustBullet('${key}', ${-meta.step})">−${meta.step}</button>
                    <button class="train-attr-step" onclick="game.trainingGround.adjustBullet('${key}', ${meta.step})">+${meta.step}</button>
                    <button class="train-attr-step" onclick="game.trainingGround.adjustBullet('${key}', ${meta.big})">+${meta.big}</button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    // ── 自定义敌人面板（基座 / 血量 / 词缀）────────────────────────────
    // 词缀分组（id 与 enemy.js 中 affixes.includes 判定一致）
    static get ENEMY_AFFIX_OPTIONS() {
        return [
            { label: '防御', items: [
                { id: 'shield', name: '护盾' },
                { id: 'radiantAegis', name: '流彩护盾' },
                { id: 'energyArmor', name: '蓄能甲' },
                { id: 'phaseShield', name: '相位护盾' },
                { id: 'livingArmor', name: '活体护甲' },
                { id: 'deflectShell', name: '偏折壳' },
                { id: 'lowDamageImmune', name: '低伤免疫' },
                { id: 'overloadReactor', name: '过量炉' },
            ] },
            { label: '行为', items: [
                { id: 'regen', name: '再生' },
                { id: 'healer', name: '治疗' },
                { id: 'haste', name: '极速' },
                { id: 'clone', name: '分裂' },
                { id: 'jump', name: '跳跃' },
                { id: 'berserk', name: '狂暴' },
                { id: 'siegeBreaker', name: '撞城者' },
                { id: 'armorSpore', name: '护甲孢子' },
            ] },
            { label: '基底专属', items: [
                { id: 'heavyArmor', name: '重装' },
                { id: 'devour', name: '吞噬' },
                { id: 'deflectionWard', name: '偏折屏障' },
                { id: 'echoRelay', name: '回响中继' },
                { id: 'prism', name: '折光' },
                { id: 'hive', name: '孵化' },
                { id: 'siege', name: '攻城' },
                { id: 'carrier', name: '铸巢' },
                { id: 'gravityWell', name: '引力' },
            ] },
            { label: '符文', items: [
                { id: 'runeBearer', name: '符文携带' },
                { id: 'adaptiveRune', name: '自适应符文' },
            ] },
        ];
    }

    renderEnemyControls() {
        const container = document.getElementById('train-enemy-config');
        if (!container) return;
        const cfg = this.enemyConfig;

        const bases = [{ id: 'normal', name: '普通方块', footprint: '1×1' }]
            .concat(ENEMY_V2_METADATA.map(m => ({ id: m.id, name: m.name, footprint: m.footprint })));
        const baseOpts = bases.map(b =>
            `<option value="${b.id}" ${b.id === cfg.base ? 'selected' : ''}>${b.footprint} ${b.name}</option>`
        ).join('');

        const hp = cfg.hp;
        const hpMax = Math.max(20000, hp);

        const groups = TrainingGround.ENEMY_AFFIX_OPTIONS.map(g => {
            const chips = g.items.map(it => {
                const on = cfg.affixes.includes(it.id);
                return `<button class="train-affix-chip ${on ? 'on' : ''}" onclick="game.trainingGround.toggleEnemyAffix('${it.id}')">${it.name}</button>`;
            }).join('');
            return `<div class="train-affix-group-label">${g.label}</div><div class="flex flex-wrap gap-1 mb-1">${chips}</div>`;
        }).join('');

        container.innerHTML = `
            <div class="train-enemy-row">
                <span class="train-enemy-label">基座</span>
                <select class="train-enemy-select" onchange="game.trainingGround.setEnemyBase(this.value)">${baseOpts}</select>
            </div>
            <div class="train-attr-card mt-2">
                <div class="train-attr-head">
                    <span class="train-attr-label">血量<span class="text-slate-600 lowercase ml-1">hp</span></span>
                    <input id="train-enemy-hp-num" type="number" min="1" value="${hp}"
                        onchange="game.trainingGround.setEnemyHp(this.value)" onfocus="this.select()" class="train-attr-num">
                </div>
                <input id="train-enemy-hp-range" type="range" min="1" max="${hpMax}" step="50" value="${Math.min(hp, hpMax)}"
                    oninput="game.trainingGround.setEnemyHp(this.value)" class="train-attr-range">
                <div class="train-attr-steps">
                    <button class="train-attr-step" onclick="game.trainingGround.setEnemyHp(100)">100</button>
                    <button class="train-attr-step" onclick="game.trainingGround.adjustEnemyHp(-100)">−100</button>
                    <button class="train-attr-step" onclick="game.trainingGround.adjustEnemyHp(100)">+100</button>
                    <button class="train-attr-step" onclick="game.trainingGround.adjustEnemyHp(1000)">+1000</button>
                </div>
            </div>
            <div class="mt-2">
                <div class="flex items-center justify-between mb-1">
                    <span class="train-enemy-label">词缀</span>
                    <button class="train-affix-chip" onclick="game.trainingGround.clearEnemyAffixes()">清空词缀</button>
                </div>
                ${groups}
            </div>
        `;
    }

    // 切换基座：自动套用该基座的推荐血量与专属词条（仍可手动微调）
    setEnemyBase(id) {
        this.enemyConfig.base = id;
        const meta = ENEMY_V2_BY_ID[id];
        if (meta) {
            this.enemyConfig.hp = Math.round(1000 * (meta.hpMult || 1));
            this.enemyConfig.affixes = (meta.affixes || []).slice();
        } else {
            this.enemyConfig.hp = 1000;
            this.enemyConfig.affixes = [];
        }
        this.renderEnemyControls();
    }

    setEnemyHp(rawVal) {
        let v = Math.round(Number(rawVal));
        if (!isFinite(v)) v = 1;
        this.enemyConfig.hp = Math.max(1, v);
        const val = this.enemyConfig.hp;
        const numEl = document.getElementById('train-enemy-hp-num');
        const rangeEl = document.getElementById('train-enemy-hp-range');
        if (numEl && document.activeElement !== numEl) numEl.value = val;
        if (rangeEl) rangeEl.value = Math.min(val, Number(rangeEl.max) || val);
    }

    adjustEnemyHp(delta) {
        this.setEnemyHp((this.enemyConfig.hp || 0) + delta);
    }

    toggleEnemyAffix(id) {
        const arr = this.enemyConfig.affixes;
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1); else arr.push(id);
        this.renderEnemyControls();
    }

    clearEnemyAffixes() {
        this.enemyConfig.affixes = [];
        this.renderEnemyControls();
    }

    // 按勾选的词缀做最小必要初始化（口径对齐 spawn_system / 验收场景）
    _initCustomEnemyAffixes(e, hp) {
        const afx = (typeof CONFIG !== 'undefined' && CONFIG.balance && CONFIG.balance.affixes) || {};
        const A = e.affixes || [];
        if (A.includes('shield')) e.shieldCharges = 1 + (this.game.round || 0);
        if (A.includes('radiantAegis') && typeof e._initRadiantAegis === 'function') e._initRadiantAegis();
        if (A.includes('phaseShield')) {
            e.shieldCharges = Math.max(e.shieldCharges || 0, 4);
            e.phaseShieldDisabledThisTurn = false;
        }
        if (A.includes('energyArmor')) e.energyArmorShield = Math.max(70, Math.floor(hp * 0.3));
        if (A.includes('overloadReactor')) {
            e._overloadDamageThisTurn = e.maxHp;
            e._overloadBonusThisTurn = 3;
        }
        if (A.includes('livingArmor')) {
            const max = Math.max(50, Math.floor(hp * 0.5));
            e.livingArmorMax = max;
            e.livingArmorHp = max;
            e.livingArmorBaseMax = max;
            e.livingArmorStacked = false;
            e.livingArmorBroken = false;
        }
        if (A.includes('deflectionWard')) {
            const pct = afx.deflectionWardBarrierPct || 0.10;
            e.wardBarrierMax = Math.max(1, Math.floor(hp * pct));
            e.wardBarrier = e.wardBarrierMax;
            e.wardBrokenThisTurn = false;
        }
        if (A.includes('hive')) e._hiveCooldown = afx.hiveSpawnInterval || 2;
        if (A.includes('carrier')) e._carrierCooldown = afx.carrierSpawnInterval || 1;
    }

    // 按当前 enemyConfig 生成一个自定义敌人
    spawnCustomEnemy() {
        const game = this.game;
        const cfg = this.enemyConfig;
        const w = game.enemyWidth;
        const h = game.enemyHeight;
        const top = game.combatGridTopY;

        const meta = ENEMY_V2_BY_ID[cfg.base];
        const cols = meta ? meta.cols : 1;
        const rows = meta ? meta.rows : 1;
        const hp = Math.max(1, Math.round(cfg.hp || 1));
        const affixes = (cfg.affixes || []).slice();

        const totalCols = (typeof CONFIG !== 'undefined' && CONFIG.gameplay && CONFIG.gameplay.enemyCols) || 6;
        const startCol = Math.floor(Math.random() * Math.max(1, totalCols - cols + 1));
        const baseRow = 1;
        const centerX = (startCol + (cols - 1) / 2) * w + w / 2;
        const centerY = top + (baseRow + (rows - 1) / 2) * h;

        const type = (meta || affixes.length > 0) ? 'elite' : 'normal';
        const e = new Enemy(centerX, centerY, w * cols, h * rows, hp, hp, type, affixes);
        e.dropTargetY = e.pos.y;

        if (meta) {
            e.baseArchetype = meta.baseArchetype;
            e.gridCols = cols;
            e.gridRows = rows;
            if (cols >= 2) e.isWideEnemy = true;
        }

        this._initCustomEnemyAffixes(e, hp);

        if (meta && typeof game.spawn_applyArchetypeShape === 'function') {
            game.spawn_applyArchetypeShape(e, meta.baseArchetype);
        } else if (!meta && affixes.length > 0 && typeof game.spawn_applyMinionShape === 'function') {
            game.spawn_applyMinionShape(e);
        }
        if (typeof e.initSprite === 'function') e.initSprite();

        game.enemies.push(e);
        return e;
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
                <button onclick="game.trainingGround.switchCategory('resonance')" id="scat-btn-resonance" class="train-scat-btn" title="屬性共鳴 1/2/3 階驗證">共鳴</button>
                <button onclick="game.trainingGround.switchCategory('v2matrix')" id="scat-btn-v2matrix" class="train-scat-btn" title="敵人視覺 V2 基底矩陣">V2</button>
                <button onclick="game.trainingGround.switchCategory('enemy_v2')" id="scat-btn-enemy_v2" class="train-scat-btn" title="敵人 V2 美術驗收場景">驗收</button>
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
        // [V2 资源协议] 资源命中状态徽标颜色映射（与 describeAssetHitStatus.tag 对齐）
        const assetTagColor = (tag) => {
            if (!tag) return '#475569';
            if (tag.startsWith('Composite')) return '#10b981';
            if (tag.startsWith('Sprite'))    return '#3b82f6';
            if (tag.startsWith('Vector'))    return '#f59e0b';
            return '#ef4444';
        };
        listEl.innerHTML = scenarios.map(s => {
            const tagBadge = s.assetHitTag
                ? `<span class="train-scenario-asset-tag" style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:8px;font-size:10px;font-family:monospace;background:${assetTagColor(s.assetHitTag)};color:#fff;vertical-align:middle;">${s.assetHitTag}</span>`
                : '';
            return `
            <button onclick="game.trainingGround.loadScenario('${s.id}')"
                id="scenario-btn-${s.id}"
                class="train-scenario-btn ${this.currentScenario?.id === s.id ? 'active' : ''}">
                <span class="train-scenario-icon">${s.icon}</span>
                <span class="train-scenario-name">${s.name}</span>${tagBadge}
            </button>
        `;
        }).join('');
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
        // 0a-pre. 重置属性共鸣（切换场景时清空旧共鸣，避免泄漏到其他场景）
        this.game.activeElementResonances = {};

        // 0b. 根据分类动态调整 combatGridTopY
        // 符文词条分类有顶部横幅（约70px），需要让敵人在横幅下方居中偏上放置
        const trainTopBarH = 40;
        if (scenario.categoryId === 'runeword' || scenario.categoryId === 'resonance') {
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

        // 0a-res. 属性共鸣场景特殊处理：注入指定元素的共鸣阶位到 activeElementResonances
        //   战斗层（combat_system / projectile / collision 等）读取 game.activeElementResonances[element].params
        if (scenario.categoryId === 'resonance' && scenario.resonanceElement) {
            const resDef = ELEMENT_RESONANCE_DB[scenario.resonanceElement];
            if (resDef && Array.isArray(resDef.tiers) && resDef.tiers.length > 0) {
                const tierLevel = scenario.resonanceTier || resDef.tiers.length; // 默认取最高阶
                const tier = resDef.tiers[Math.max(0, Math.min(tierLevel, resDef.tiers.length) - 1)];
                this.game.activeElementResonances[scenario.resonanceElement] = {
                    label: tier.label,
                    desc: tier.desc,
                    threshold: tier.threshold,
                    statCount: tier.threshold,
                    params: tier.params,
                };
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
            } else if (scenario.categoryId === 'resonance' && scenario.resonanceElement) {
                const resDef = ELEMENT_RESONANCE_DB[scenario.resonanceElement];
                const active = this.game.activeElementResonances[scenario.resonanceElement];
                if (resDef && active) {
                    const iconEl = document.getElementById('rw-banner-icon');
                    const nameEl = document.getElementById('rw-banner-name');
                    const levelEl = document.getElementById('rw-banner-level');
                    const descBannerEl = document.getElementById('rw-banner-desc');
                    const paramsEl = document.getElementById('rw-banner-params');
                    if (iconEl) iconEl.textContent = resDef.icon || scenario.icon || '✨';
                    if (nameEl) nameEl.textContent = active.label || resDef.name;
                    if (levelEl) {
                        const tierLevel = scenario.resonanceTier || resDef.tiers.length;
                        levelEl.textContent = 'T' + tierLevel + ' (' + active.threshold + '层)';
                    }
                    if (descBannerEl) descBannerEl.textContent = active.desc || '';
                    if (paramsEl) {
                        paramsEl.innerHTML = Object.entries(active.params || {}).map(([key, val]) => {
                            const displayVal = (typeof val === 'number' && val % 1 !== 0 && Math.abs(val) < 10)
                                ? (val * 100).toFixed(0) + '%'
                                : val;
                            return `<span class="rw-banner-param-tag">${key}: ${displayVal}</span>`;
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
        // 触发演示时默认收起侧边栏，让战斗区域全屏展示；逐档视觉验收类场景需要保留说明。
        if (!this.currentScenario.keepSidebarOpenOnDemo) {
            this.collapseSidebar();
        }
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
     * [V2 可見性驗收] 清空 V2 矩陣的 DOM 標籤層
     */
    _clearV2MatrixOverlay() {
        const layer = document.getElementById('train-v2-matrix-layer');
        if (layer) layer.innerHTML = '';
    }

    /**
     * [V2 可見性驗收] 在每個 V2 基底下方繪製標籤（footprint / baseArchetype / affixes）。
     * 使用 DOM overlay 而非 canvas，避免侵入主渲染管線。
     */
    _renderV2MatrixLabels(labelData) {
        const host = document.getElementById('phase-training');
        if (!host) return;
        let layer = document.getElementById('train-v2-matrix-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'train-v2-matrix-layer';
            layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:25;';
            host.appendChild(layer);
        }
        layer.innerHTML = '';
        for (const item of labelData) {
            const { def, centerX, centerY, hPx } = item;
            const card = document.createElement('div');
            const top = centerY + hPx / 2 + 4;
            card.style.cssText = [
                'position:absolute',
                `left:${centerX}px`,
                `top:${top}px`,
                'transform:translateX(-50%)',
                'background:rgba(15,23,42,0.85)',
                'border:1px solid rgba(99,102,241,0.45)',
                'border-radius:6px',
                'padding:3px 6px',
                'font-size:10px',
                'line-height:1.35',
                'color:#e2e8f0',
                'font-family:monospace',
                'white-space:nowrap',
                'text-align:center',
                'box-shadow:0 2px 6px rgba(0,0,0,0.4)'
            ].join(';');
            const affixStr = def.affixes.length > 0 ? def.affixes.join(',') : '—';
            card.innerHTML = `
                <div style="color:#fbbf24;font-weight:bold;">${def.name}</div>
                <div style="color:#94a3b8;">${def.footprint} · ${def.baseArchetype}</div>
                <div style="color:#a5b4fc;">affix: ${affixStr}</div>
            `;
            layer.appendChild(card);
        }
    }

    /**
     * 清空战场（敌人、子弹、粒子等）
     */
    _clearBattlefield() {
        // [V2 可見性驗收] 同步清理矩陣標籤層
        this._clearV2MatrixOverlay();
        // [PixiJS 迁移] 销毁所有残留特效的 PixiJS 适配器，防止孤立 Sprite 残留
        pixiCleanupAllEffects(this.game);
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
        const trainSidebar = document.getElementById('train-sidebar');
        const trainSidebarToggle = document.getElementById('train-sidebar-toggle');
        const compactTrainingLayout = window.innerWidth <= 767;
        if (trainSidebar) trainSidebar.classList.toggle('collapsed', compactTrainingLayout);
        if (trainSidebarToggle) trainSidebarToggle.textContent = compactTrainingLayout ? '>' : '<';
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
        if (typeof this.game.combat_skillCharge_init === 'function') {
            this.game.combat_skillCharge_init();
        } else {
            this.game.combat_runeCharge_init();
        }
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
        this.selectedCategoryId = TRUTH_BOOK_DATA.categories?.[0]?.id || 'boss';
        this.searchQuery = '';
        this.initUI();
        window.addEventListener('resize', () => { if (this.active) this.resize(); });
    }

    initUI() {
        const searchInput = document.getElementById('truth-search');
        if (searchInput && !searchInput.dataset.truthBound) {
            searchInput.addEventListener('input', () => {
                this.searchQuery = searchInput.value.trim().toLowerCase();
                this.renderEntryList();
            });
            searchInput.dataset.truthBound = '1';
        }
        if (searchInput) searchInput.value = this.searchQuery;
        this.renderCategoryTabs();
        this.renderEntryList();
    }

    getEntries() {
        if (Array.isArray(TRUTH_BOOK_DATA.entries)) return TRUTH_BOOK_DATA.entries;
        const enemies = (TRUTH_BOOK_DATA.enemies || []).map(entry => normalizeTruthBookEntry(entry, 'enemy_affix'));
        const attributes = (TRUTH_BOOK_DATA.attributes || []).map(entry => normalizeTruthBookEntry(entry, 'attribute'));
        return [...enemies, ...attributes];
    }

    getCategories() {
        const categories = Array.isArray(TRUTH_BOOK_DATA.categories) ? TRUTH_BOOK_DATA.categories : [];
        if (categories.length > 0) return categories;
        return [
            { id: 'enemy_affix', name: '敌人词缀', icon: '◇', hint: '' },
            { id: 'attribute', name: '属性百科', icon: '✦', hint: '' }
        ];
    }

    renderCategoryTabs() {
        const categoryTabs = document.getElementById('truth-category-tabs');
        if (!categoryTabs) return;
        const entries = this.getEntries();
        const categories = this.getCategories();
        if (!categories.some(category => category.id === this.selectedCategoryId)) {
            this.selectedCategoryId = categories[0]?.id || 'boss';
        }
        categoryTabs.innerHTML = '';
        categories.forEach(category => {
            const count = entries.filter(entry => entry.categoryId === category.id).length;
            const btn = document.createElement('button');
            const active = category.id === this.selectedCategoryId;
            btn.className = `truth-category-btn ${active ? 'active' : ''}`;
            btn.type = 'button';
            btn.innerHTML = `
                <span class="truth-category-icon">${category.icon || '•'}</span>
                <span class="truth-category-text">
                    <span class="truth-category-name">${category.name}</span>
                    <span class="truth-category-hint">${category.hint || ''}</span>
                </span>
                <span class="truth-category-count">${count}</span>
            `;
            btn.onclick = () => {
                this.selectedCategoryId = category.id;
                this.renderCategoryTabs();
                this.renderEntryList();
            };
            categoryTabs.appendChild(btn);
        });
    }

    renderEntryList() {
        const entryList = document.getElementById('truth-entry-list') || document.getElementById('truth-enemy-list');
        const entryCount = document.getElementById('truth-entry-count');
        if (!entryList) return;
        const query = this.searchQuery || '';
        const entries = this.getEntries().filter(entry => {
            if (entry.categoryId !== this.selectedCategoryId) return false;
            if (!query) return true;
            const haystack = [
                entry.title,
                entry.name,
                entry.content,
                entry.desc,
                ...(entry.tags || [])
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
        entryList.innerHTML = '';
        if (entryCount) {
            const category = this.getCategories().find(item => item.id === this.selectedCategoryId);
            entryCount.textContent = `${category?.name || '条目'} · ${entries.length} 项`;
        }
        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'p-4 border border-slate-800 bg-slate-900/40 text-slate-500 text-xs leading-relaxed';
            empty.textContent = query ? '没有匹配的条目。' : '该分类暂无条目。';
            entryList.appendChild(empty);
            return;
        }
        entries.forEach(entry => {
            entryList.appendChild(this.createListButton(entry));
        });
    }

    createListButton(entry) {
        const btn = document.createElement('button');
        btn.className = 'truth-list-btn flex items-center gap-3 p-3 w-full bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all text-left group mb-2';
        btn.dataset.entryId = entry.id;
        const iconWrap = document.createElement('span');
        iconWrap.className = 'text-2xl group-hover:scale-110 transition-transform filter drop-shadow-md truth-list-icon';
        if (entry.iconSrc) {
            const img = document.createElement('img');
            img.src = entry.iconSrc;
            img.alt = entry.title || entry.name || '';
            img.loading = 'lazy';
            img.onerror = function() {
                this.replaceWith(document.createTextNode(entry.icon || '◇'));
            };
            iconWrap.appendChild(img);
        } else {
            iconWrap.textContent = entry.icon || '◇';
        }
        const textWrap = document.createElement('div');
        textWrap.className = 'flex flex-col min-w-0';
        const title = document.createElement('span');
        title.className = 'text-sm font-bold text-slate-300 group-hover:text-cyan-100 transition-colors truncate';
        title.textContent = entry.title || entry.name;
        const subtitle = document.createElement('span');
        subtitle.className = 'text-[9px] text-slate-500 uppercase tracking-wider group-hover:text-cyan-400/70 truncate';
        subtitle.textContent = (entry.tags && entry.tags[0]) || entry.categoryId || 'ENTITY';
        textWrap.append(title, subtitle);
        btn.append(iconWrap, textWrap);
        btn.onclick = () => this.showEntry(entry, btn);
        if (this.currentEntry && this.currentEntry.id === entry.id) {
            btn.classList.remove('border-slate-700/50', 'bg-slate-800/40');
            btn.classList.add('border-cyan-500', 'bg-cyan-900/30');
        }
        return btn;
    }

    showEntry(entry, btnElement) {
        this.currentEntry = entry;
        const emptyState = document.getElementById('truth-empty-state');
        if (emptyState) emptyState.classList.add('hidden');
        const content = document.getElementById('truth-content');
        if (content) content.classList.remove('hidden');
        const iconEl = document.getElementById('truth-item-icon');
        if (iconEl) {
            iconEl.innerHTML = '';
            if (entry.iconSrc) {
                const img = document.createElement('img');
                img.src = entry.iconSrc;
                img.alt = entry.title || entry.name || '';
                img.loading = 'lazy';
                img.onerror = function() {
                    this.replaceWith(document.createTextNode(entry.icon || '◇'));
                };
                iconEl.appendChild(img);
            } else {
                iconEl.textContent = entry.icon || '◇';
            }
        }
        const nameEl = document.getElementById('truth-item-name');
        if (nameEl) nameEl.innerText = entry.title || entry.name;
        const descEl = document.getElementById('truth-item-desc');
        if (descEl) descEl.innerText = entry.content || entry.desc || '';
        const tagsCont = document.getElementById('truth-item-tags');
        if (tagsCont) {
            tagsCont.innerHTML = '';
            const category = this.getCategories().find(item => item.id === entry.categoryId);
            const tags = [category?.name, ...(entry.tags || [])].filter(Boolean);
            tags.forEach(tag => {
                const s = document.createElement('span');
                s.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm tracking-wide';
                s.innerText = String(tag);
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
    // @section:demo_state_seed - 演示状态初始化
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
        bossHistory: [],
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
        skillPoints: 0,
        activeSkills: [],
        unlockedSkills: [],
        equippedSkillIds: [],
        purchasedSkillIds: [],
        skillChargeActualValue: 0,
        skillChargeTempValue: 0,
        skillChargeLevel: 0,
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

        // @section:demo_spawn_bridge - 生成与Boss转发
        sys_getCombatBounds() {
            if (typeof mainGame.sys_getCombatBounds === 'function') {
                return mainGame.sys_getCombatBounds.call(this);
            }
            return { left: 0, right: this.width, top: 0, bottom: this.height, width: this.width };
        },
        calc_getRecentAverageDamage(...args) {
            if (typeof mainGame.calc_getRecentAverageDamage === 'function') {
                return mainGame.calc_getRecentAverageDamage.call(this, ...args);
            }
            return 60;
        },
        combat_calculatePlayerExpectedDamage(...args) {
            if (typeof mainGame.combat_calculatePlayerExpectedDamage === 'function') {
                return mainGame.combat_calculatePlayerExpectedDamage.call(this, ...args);
            }
            return 60;
        },
        spawn_calculateBossHP(...args) {
            if (typeof mainGame.spawn_calculateBossHP === 'function') {
                return mainGame.spawn_calculateBossHP.call(this, ...args);
            }
            return args[0] ? 1200 : 700;
        },
        spawn_getBossMinionProfile(...args) {
            if (typeof mainGame.spawn_getBossMinionProfile === 'function') {
                return mainGame.spawn_getBossMinionProfile.call(this, ...args);
            }
            return null;
        },
        spawn_applyBossMinionMetadata(...args) {
            if (typeof mainGame.spawn_applyBossMinionMetadata === 'function') {
                return mainGame.spawn_applyBossMinionMetadata.call(this, ...args);
            }
        },
        spawn_applyMinionShape(...args) {
            if (typeof mainGame.spawn_applyMinionShape === 'function') {
                return mainGame.spawn_applyMinionShape.call(this, ...args);
            }
        },
        spawn_applyArchetypeShape(...args) {
            if (typeof mainGame.spawn_applyArchetypeShape === 'function') {
                return mainGame.spawn_applyArchetypeShape.call(this, ...args);
            }
        },
        spawn_spawnBoss(...args) {
            if (typeof mainGame.spawn_spawnBoss === 'function') {
                return mainGame.spawn_spawnBoss.call(this, ...args);
            }
            return null;
        },
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

        // @section:demo_combat_bridge - 战斗逻辑转发
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

        // @section:demo_charge_bridge - 充能兼容转发
        combat_skillCharge_onHit(...args) {
            return mainGame.combat_skillCharge_onHit.call(this, ...args);
        },
        combat_skillCharge_tryAward(...args) {
            return mainGame.combat_skillCharge_tryAward.call(this, ...args);
        },
        combat_skillCharge_updateUI(...args) {
            return mainGame.combat_skillCharge_updateUI.call(this, ...args);
        },
        combat_skillCharge_decay(...args) {
            return mainGame.combat_skillCharge_decay.call(this, ...args);
        },
        combat_skillCharge_syncLegacyState(...args) {
            return mainGame.combat_skillCharge_syncLegacyState.call(this, ...args);
        },
        combat_runeCharge_onHit(...args) {
            return this.combat_skillCharge_onHit(...args);
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
        spawn_addSkillPoint() {},
        combat_skillCharge_init(...args) {
            return mainGame.combat_skillCharge_init.call(this, ...args);
        },
        combat_runeCharge_init(...args) {
            return this.combat_skillCharge_init(...args);
        },
        combat_runeCharge_update() {},
        combat_runeCharge_draw() {}
    };
    return context;
}

export { UIManager, TrainingGround, TruthBook, TRUTH_BOOK_DATA };
