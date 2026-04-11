/**
 * systems.js - 游戏系统层
 * 
 * 职责：
 * - 独立的功能模块和 UI 系统
 * - 游戏模式的覆盖层（真理之书、试炼场）
 * - 未来扩展：WorldMap（大地图）、TownShop（商店系统）
 * 
 * 包含的类：
 * - UIManager: UI 管理器
 * - TrainingGround: 试炼场系统
 * - TruthBook: 真理之书（图鉴系统）
 */

import { CONFIG, SKILL_DB } from './config.js';
import { audio } from './audio.js';
import { Vec2, Enemy, Projectile, Particle, Shockwave, LightningBolt, FloatingText, adjustColorBrightness, lerpColor, lerp, hexToRgba } from './entities.js';


// ==================== 真理之书数据 ====================
const TRUTH_BOOK_DATA = {
    enemies: [
        {
            id: 'normal',
            name: '普通魔像',
            icon: '🤖',
            tags: ['基礎', '測試對象'],
            desc: '標準的煉金生物。沒有特殊能力，是測試傷害的理想對象。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 200, 200));
            },
            loop: [
                { type: 'log', text: '生成測試彈幕...' },
                { type: 'spawn_projectile', config: { damage: 20, bounce: 2 } },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'shield',
            name: '護盾魔像',
            icon: '🛡️',
            tags: ['減傷', '激光反射'],
            desc: '擁有能量護盾，減少 50% 受到的傷害。護盾表面光滑，可以反射激光束。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['shield']));
            },
            loop: [
                { type: 'log', text: '護盾減傷測試' },
                { type: 'spawn_projectile', config: { damage: 20 } },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '激光反射測試' },
                { type: 'spawn_projectile', config: { damage: 10, isLaser: true, laser: 5 } },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'regen',
            name: '再生魔像',
            icon: '💚',
            tags: ['回血', '持久戰'],
            desc: '體內植入了生命水晶，每回合行動時會恢復最大生命值的 20%。',
            setup: (game) => {
                const e = new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['regen']);
                e.hp = 100; 
                game.enemies.push(e);
            },
            loop: [
                { type: 'log', text: '魔像受傷狀態...' },
                { type: 'wait', frames: 60 },
                { type: 'log', text: '觸發回合行動：再生' },
                { type: 'enemy_turn' },
                { type: 'wait', frames: 120 },
                { type: 'reset' }
            ]
        },
        {
            id: 'clone',
            name: '分身魔像',
            icon: '🦠',
            tags: ['受擊分裂', '人海戰術'],
            desc: '受到攻擊或每回合開始時，有概率分裂出較弱的複制體，迅速填滿戰場。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 300, 300, 'normal', ['clone']));
            },
            loop: [
                { type: 'log', text: '攻擊觸發分裂' },
                { type: 'spawn_projectile', config: { damage: 10 } },
                { type: 'wait', frames: 30 },
                { type: 'spawn_projectile', config: { damage: 10 } },
                { type: 'wait', frames: 150 },
                { type: 'reset' }
            ]
        },
        {
            id: 'haste',
            name: '極速魔像',
            icon: '⚡',
            tags: ['高速', '兩次行動'],
            desc: '神經反射極快，每回合可以進行兩次移動或攻擊。',
            setup: (game) => {
                game.enemies.push(new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['haste']));
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
            tags: ['熱能轉化', '升溫強化'],
            desc: '當前溫度：150°C (過熱)。當處於「過熱」狀態時，有高概率觸發狂暴，獲得額外行動機會。',
            setup: (game) => {
                const e = new Enemy(game.width/2, 150, 60, 60, 300, 300, 'normal', ['berserk']);
                e.temp = 150; 
                game.enemies.push(e);
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
                const e1 = new Enemy(game.width/2 - 70, 150, 60, 60, 100, 200); 
                const healer = new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['healer']);
                const e2 = new Enemy(game.width/2 + 70, 150, 60, 60, 100, 200); 
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
            desc: '殘忍的同類相食者。會吞噬相鄰的友軍以恢復自身生命並繼承其詞條。',
            setup: (game) => {
                const food = new Enemy(game.width/2 - 60, 150, 50, 50, 100, 100, 'normal', ['haste']); 
                const eater = new Enemy(game.width/2, 150, 70, 70, 200, 500, 'normal', ['devour']);
                game.enemies.push(food, eater);
            },
            loop: [
                { type: 'log', text: '發現獵物 (極速魔像)' },
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
                const blocker = new Enemy(game.width/2, 210, 60, 60, 100, 100); 
                const jumper = new Enemy(game.width/2, 150, 60, 60, 200, 200, 'normal', ['jump']);
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
                // 佈置一個三角形陣列，展示多次彈射
                game.enemies.push(
                    new Enemy(game.width/2 - 60, 220, 50, 50, 500),
                    new Enemy(game.width/2 + 60, 220, 50, 50, 500),
                    new Enemy(game.width/2, 140, 50, 50, 500),
                    new Enemy(game.width/2 - 100, 100, 40, 40, 300),
                    new Enemy(game.width/2 + 100, 100, 40, 40, 300)
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
                // 佈置一條直線上的敵人，展示一箭穿心
                for(let i=0; i<5; i++) {
                    game.enemies.push(new Enemy(game.width/2, 250 - i*50, 50, 40, 200));
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
                // 佈置一個大目標和周圍的小目標，展示分裂彈的覆蓋力
                game.enemies.push(new Enemy(game.width/2, 120, 80, 80, 1000));
                for(let i=0; i<6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    game.enemies.push(new Enemy(
                        game.width/2 + Math.cos(angle) * 120,
                        120 + Math.sin(angle) * 120,
                        30, 30, 100
                    ));
                }
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
                const e = new Enemy(game.width/2, 180, 90, 90, 2000);
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
            desc: '升高敵人溫度。溫度 >= 34°C 時觸发【燃燒】造成持續傷害（公式：温度/150）。溫度 > 200°C 時有概率觸发【過熱爆炸】，造成大範圍 AOE 傷害並消耗 10% 熱量。觸发概率隨溫度提升，600°C 時必爆。',
            setup: (game) => { 
                const boss = new Enemy(game.width/2, 180, 80, 80, 1500);
                game.enemies.push(boss); 
                for(let i=0; i<8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    game.enemies.push(new Enemy(
                        game.width/2 + Math.cos(angle) * 90,
                        180 + Math.sin(angle) * 90,
                        40, 40, 300
                    ));
                }
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
            desc: '命中時觸發連鎖閃電，提升等同於本次傷害的溫度。閃電鏈可對重複敵人造成傷害，隨機在範圍內索敵且距離越近概率越高。基礎連鎖概率 15%，目標溫度越低概率越高（最高 100%）。',
            setup: (game) => {
                // 佈置密集的敵群，展示 100 次連鎖的壯觀效果
                for(let i=0; i<12; i++) {
                    const x = game.width/2 + (Math.random()-0.5) * 200;
                    const y = 150 + (Math.random()-0.5) * 150;
                    const e = new Enemy(x, y, 40, 40, 500);
                    e.temp = -100; // [修復] 讓所有敵人都冰凍，確保瘋狂連鎖
                    game.enemies.push(e);
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
            desc: '發射彈珠，命中時觸發折射激光，瞬間對路徑上的敵人造成傷害。',
            setup: (game) => {
                for(let i=0; i<6; i++) {
                    game.enemies.push(new Enemy(
                        game.width/2 + (i%2 === 0 ? -80 : 80),
                        250 - i*40,
                        50, 50, 300
                    ));
                }
            },
            loop: [
                { type: 'log', text: '發射光學折射彈 (laser=true)' },
                { type: 'spawn_projectile', config: { damage: 40, laser: 10 }, vel: {x: 2, y: -15} },
                { type: 'wait', frames: 150 }, { type: 'reset' }
            ]
        },
        {
            id: 'wind', name: '風', icon: '🌪️', tags: ['特殊', '法陣'],
            desc: '在命中點生成風暴法陣，持續發射風刃攻擊附近的敵人。',
            setup: (game) => { game.enemies.push(new Enemy(game.width/2, 200, 80, 80, 1000)); },
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
                for(let i=0; i<5; i++) game.enemies.push(new Enemy(game.width/2 - 100 + i*50, 200, 40, 40, 100));
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
                game.enemies.push(new Enemy(game.width/2, 120, 80, 80, 1500)); 
                for(let i=0; i<4; i++) {
                    game.enemies.push(new Enemy(game.width/2 + (i-1.5)*80, 220, 40, 40, 300));
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
        // 词条字典
        // --- 在 UIManager constructor 中 ---
// --- 在 UIManager constructor 中 ---
this.affixDict = {
    'shield': { 
        name: '🛡️ 護盾', 
        desc: `受到的傷害減少 ${afx.shieldReduction * 100}%。(可反射激光)` 
    },
    'haste': { 
        name: '⚡ 極速', 
        desc: `每回合固定行移動 ${afx.hasteActions} 次。` 
    },
    'regen': { 
        name: '💚 再生', 
        desc: `每回合恢復 ${afx.regenPercent * 100}% 最大生命值。` 
    },
    'clone': { 
        name: '🦠 增殖', 
        desc: `每回合開始和受到攻击时，有 ${afx.cloneChanceHit * 100}% 概率产生分身` 
    },
    'berserk': { 
        name: '😡 狂暴', 
        desc: '有概率行动两次 (概率随温度升高)' 
    },
    'healer': { 
        name: '💖 治癒', 
        desc: `回合行動時，治療周圍友軍 (${afx.healerPercent * 100}% HP)。` 
    },
    'devour': { 
        name: '👅 吞噬', 
        desc: '隨機吞噬相鄰友軍，繼承其血量與詞條。' 
    },
    'jump': { 
        name: '🦘 跳躍', 
        desc: '移動受阻時，可跳過前方敵人前進。' 
    }
};

    }

    // 切换 Tab
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
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');
        
        // 如果切换到伤害统计标签，更新显示
        if (tabName === 'damage') {
            game.ui_updateDamageStats();
        }
    }
    updateSkillBar(currentSP) {
        const container = document.getElementById('skill-bar');
        if (!container) return;
        container.innerHTML = '';

        SKILL_DB.forEach(skill => {
            const btn = document.createElement('div');
            // 样式：圆形按钮，带冷却遮罩效果
            const isDisabled = currentSP < skill.cost;
            
            btn.className = `
                w-12 h-12 rounded-full border-2 flex items-center justify-center 
                text-xl shadow-lg transition-all duration-200 relative group
                ${isDisabled ? 'border-slate-600 bg-slate-800 opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer hover:scale-110 active:scale-95'}
            `;
            
            // 动态边框颜色
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

            // 点击事件
            if (!isDisabled) {
                // 1. 定义一个阻止冒泡的函数
                const stopProp = (e) => { e.stopPropagation(); };

                // 2. 关键：监听按下事件，防止它们穿透到 Canvas 触发瞄准拖拽
                btn.addEventListener('mousedown', stopProp);
                btn.addEventListener('touchstart', stopProp, { passive: false });

                // 3. 点击事件处理
                btn.onclick = (e) => {
                    e.stopPropagation(); // 防止触发其他逻辑
                    game.combat_activateSkill(skill);
                };
            }

            container.appendChild(btn);
        });
    }
    updateSkillPoints(current, max = null) {
        // 使用 CONFIG 中的 maxSkillPoints，如果没有传入 max 参数
        if (max === null) {
            max = Math.max(CONFIG.gameplay.maxSkillPoints, current);
        }
        this.spContainer.innerHTML = ''; // 清空当前

        for (let i = 0; i < max; i++) {
            // 1. 创建槽位
            const slot = document.createElement('div');
            slot.className = 'sp-slot';
            
            // 2. 创建宝石
            const gem = document.createElement('div');
            gem.className = 'sp-gem';
            
            // 3. 如果当前索引 < 拥有的点数，则点亮宝石
            if (i < current) {
                gem.classList.add('active');
                slot.style.borderColor = '#10b981'; // 亮绿色边框
                slot.style.boxShadow = '0 0 5px rgba(16, 185, 129, 0.3)';
            }

            slot.appendChild(gem);
            this.spContainer.appendChild(slot);
        }
    }
    // 打开/更新抽屉
    showEnemyInfo(enemy) {
        if (!enemy || !enemy.active) {
            this.closeDrawer();
            return;
        }

        this.hoveredEnemy = enemy;
        this.isOpen = true;
        this.drawer.classList.remove('translate-y-full'); // 滑入

        // --- Tab 1: 状态更新 ---
        
        // 标题与血量
        const typeName = enemy.type === 'boss' ? '💀 BOSS' : (enemy.type === 'elite' ? '⚠️ 精英魔像' : '普通魔像');
        document.getElementById('info-enemy-type').innerText = typeName;
        document.getElementById('info-enemy-type').className = enemy.type === 'boss' ? 'text-xl font-bold text-red-500' : (enemy.type === 'elite' ? 'text-lg font-bold text-yellow-400' : 'text-lg font-bold text-slate-200');
        document.getElementById('info-hp').innerText = `HP: ${Math.ceil(enemy.displayHp)}/${enemy.maxHp}`;

        // 温度条更新
        const tempBar = document.getElementById('info-temp-bar');
        const tempText = document.getElementById('info-temp-text');
        
        const tempPct = Math.min(100, Math.abs(enemy.temp));
        tempBar.style.width = `${tempPct/2}%`; // 0-100 映射到半边
        
        if (enemy.temp > 0) {
            tempBar.style.left = '50%';
            tempBar.style.transformOrigin = 'left';
            tempBar.style.background = '#f97316'; // Orange
            tempText.innerText = `溫度: +${enemy.temp.toFixed(0)}°C (過熱)`;
            tempText.style.color = '#fbbf24';
        } else if (enemy.temp < 0) {
            tempBar.style.left = `${50 - tempPct/2}%`;
            tempBar.style.transformOrigin = 'right';
            tempBar.style.background = '#06b6d4'; // Cyan
            tempText.innerText = `溫度: ${enemy.temp.toFixed(0)}°C (過冷)`;
            tempText.style.color = '#67e8f9';
        } else {
            tempBar.style.width = '0';
            tempText.innerText = `溫度: 0°C (穩定)`;
            tempText.style.color = '#94a3b8';
        }

        // 状态列表生成
        const statusList = document.getElementById('info-status-list');
        statusList.innerHTML = '';

        // 1. 冰冻判定
        if (enemy.isFrozenCurrentTurn || enemy.temp <= -100) {
             this.addStatusItem(statusList, '❄️ 深度凍結', '無法移動與行動。', 'text-cyan-300');
        } else if (enemy.temp < 0) {
            const freezeChance = Math.min(100, Math.abs(enemy.temp)) / 2;
            this.addStatusItem(statusList, '📉 低溫影響', `下回合有 ${freezeChance.toFixed(0)}% 概率被凍結。`, 'text-cyan-200');
        }

        // 2. 燃烧判定
        if (enemy.temp > 0) {
            if (enemy.temp >= 100) {
                const dmg = 5 + (enemy.temp - 100);
                 this.addStatusItem(statusList, '🔥 極限燃燒', `每回合受到 ${dmg.toFixed(0)} 點傷害，並向周圍擴散。`, 'text-orange-400');
            } else {
                 this.addStatusItem(statusList, '🌡️ 過熱狀態', '溫度 >100°C 時觸發燃燒傷害。', 'text-orange-200');
            }
            
            // 狂暴判定
            if (enemy.affixes.includes('berserk')) {
                const berserkChance = (enemy.temp / 100) * 0.5 * 100;
                this.addStatusItem(statusList, '😡 熱能狂暴', `因過熱，有 ${berserkChance.toFixed(0)}% 概率行動兩次。`, 'text-red-400');
            }
        }
        
        // 3. 导电判定 (如果有闪电机制)
        if (enemy.temp < 0) {
             // 假设：低温增加导电率
             const conductBonus = Math.min(100, 15 + Math.abs(enemy.temp) * 0.85);
             this.addStatusItem(statusList, '⚡ 導電體質', `低溫使連鎖閃電傳導概率提升至 ${(conductBonus).toFixed(0)}%。`, 'text-purple-300');
        } else {
             this.addStatusItem(statusList, '⚡ 導電體質', `基礎連鎖閃電傳導概率 15%。`, 'text-purple-300/50');
        }

        // --- Tab 2: 词条更新 ---
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

    closeDrawer() {
        this.isOpen = false;
        this.hoveredEnemy = null;
        this.drawer.classList.add('translate-y-full');
    }
}
// --- 主游戏控制器 ---

/**
 * Echo Alchemist - Training Ground Module
 * 试炼场模块：包含敌人配置器、子弹编辑器和战斗测试逻辑
 */


// ==================== 试炼场系统 ====================

class TrainingGround {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.enemyConfig = {
            hp: 100,
            maxHp: 100,
            affixes: []
        };
        this.bulletConfig = {
            damage: 10,
            bounce: 0,
            pierce: 0,
            scatter: 0,
            multicast: 0,
            pyro: 0,
            cryo: 0,
            lightning: 0,
            wind: 0,
            isLaser: false,
            isMatryoshka: false,
            type: 'normal'
        };
        this.stats = {
            totalDamage: 0,
            lastTotal: 0,
            dps: 0,
            startTime: 0
        };
        this.initUI();
    }

    initUI() {
        const ui = document.createElement('div');
        ui.id = 'phase-training';
        ui.className = 'ui-overlay hidden-phase';
        ui.style.cssText = 'display: none; z-index: 400; background: transparent; pointer-events: auto; flex-direction: column;';
        
        const style = document.createElement('style');
        style.innerHTML = `
            #train-control-panel {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(15, 23, 42, 0.95);
                backdrop-blur: 12px;
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
            }
        `;
        document.head.appendChild(style);

        ui.innerHTML = `
            <!-- 顶部状态栏 -->
            <div class="absolute top-0 left-0 right-0 h-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 z-20">
                <div class="text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Combat Simulation
                </div>
                <div id="train-stats" class="text-amber-400 font-mono text-xs">
                    DPS: 0 | TOTAL: 0
                </div>
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
                <button id="train-toggle-main" onclick="game.trainingGround.toggleMainPanel()">
                    ▲ 展开配置
                </button>
                
                <!-- Tab 导航 -->
                <div class="flex border-b border-slate-700 bg-slate-900/50">
                    <button onclick="game.trainingGround.switchTab('bullet')" id="tab-btn-bullet" class="train-tab-btn active">子弹编辑</button>
                    <button onclick="game.trainingGround.switchTab('enemy')" id="tab-btn-enemy" class="train-tab-btn">敌人配置</button>
                </div>

                <!-- 子弹编辑面板 -->
                <div id="panel-bullet" class="train-panel-content active">
                    <div class="flex flex-col md:flex-row gap-4">
                        <div class="flex gap-4 items-center md:items-start">
                            <div class="w-20 h-20 md:w-32 md:h-32 bg-slate-800 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center relative overflow-hidden shrink-0">
                                <div id="preview-bullet-render" class="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                            </div>
                            <div class="flex-1 md:hidden flex flex-col gap-2">
                                <button onclick="game.trainingGround.fireBullet()" class="py-3 bg-indigo-600 text-white rounded-lg font-bold active:scale-95">发射测试</button>
                                <button onclick="game.trainingGround.resetBullet()" class="py-1 bg-slate-800 text-slate-400 rounded-lg text-[10px]">重置</button>
                            </div>
                        </div>
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
                </div>

                <!-- 敌人配置面板 -->
                <div id="panel-enemy" class="train-panel-content">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="space-y-4">
                            <div>
                                <label class="text-[10px] text-slate-500 uppercase font-bold">基础血量</label>
                                <input type="number" id="train-enemy-hp" value="100" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white mt-1 text-sm">
                            </div>
                            <div class="flex gap-2">
                                <button onclick="game.trainingGround.spawnEnemy()" class="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors text-sm">召唤敌人</button>
                                <button onclick="game.trainingGround.clearEnemies()" class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold transition-colors text-sm">清空</button>
                            </div>
                            <button onclick="game.phase_enemy_startLogic()" class="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition-colors text-sm flex items-center justify-center gap-2">
                                <span>📡</span> 触发敌人行动
                            </button>
                        </div>
                        <div class="md:col-span-2">
                            <label class="text-[10px] text-slate-500 uppercase font-bold">词缀注入</label>
                            <div id="train-affix-list" class="grid grid-cols-3 md:grid-cols-4 gap-2 mt-2"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(ui);
        this.renderAffixButtons();
        this.renderAttributeControls();
    }

    renderAffixButtons() {
        const container = document.getElementById('train-affix-list');
        if (!container) return;
        
        // 定义有效的词条列表及其元数据
        // 这些 ID 必须与 Enemy 类中 includes() 判断的字符串一致
        const affixes = [
            { id: 'elite', name: '精英', icon: '💀' },
            { id: 'shield', name: '护盾', icon: '🛡️' },
            { id: 'haste', name: '极速', icon: '⚡' },
            { id: 'regen', name: '再生', icon: '💚' },
            { id: 'clone', name: '分身', icon: '🦠' },
            { id: 'berserk', name: '狂暴', icon: '😡' },
            { id: 'healer', name: '治疗', icon: '💖' },
            { id: 'devour', name: '吞噬', icon: '👅' },
            { id: 'jump', name: '跳跃', icon: '🦘' }
        ];
        
        container.innerHTML = affixes.map(afx => `
            <button onclick="game.trainingGround.toggleAffix('${afx.id}')" 
                id="affix-btn-${afx.id}"
                class="flex flex-col items-center justify-center p-2 rounded border-2 transition-all ${this.enemyConfig.affixes.includes(afx.id) ? 'border-indigo-500 bg-indigo-900/40' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}">
                <span class="text-lg">${afx.icon || ''}</span>
                <span class="text-[9px] mt-1">${afx.name}</span>
            </button>
        `).join('');
    }

    renderAttributeControls() {
        const attrs = [
            { id: 'damage', name: '伤害', icon: '⚔️', min: 1, max: 999 },
            { id: 'bounce', name: '弹跳', icon: '⤴️', min: 0, max: 20 },
            { id: 'pierce', name: '穿透', icon: '↗️', min: 0, max: 20 },
            { id: 'scatter', name: '散射', icon: '🔱', min: 0, max: 10 },
            { id: 'multicast', name: '连射', icon: '🔗', min: 0, max: 10 },
            { id: 'pyro', name: '火焰', icon: '🔥', min: 0, max: 50 },
            { id: 'cryo', name: '冰霜', icon: '❄️', min: 0, max: 50 },
            { id: 'lightning', name: '闪电', icon: '⚡', min: 0, max: 50 },
            { id: 'wind', name: '风暴', icon: '🌪️', min: 0, max: 50 },
            { id: 'wind_lv', name: '风等级', icon: '📊', min: 1, max: 3 },
            { id: 'flying_sword', name: '子母剑', icon: '🗡️', min: 0, max: 50 },
            { id: 'flying_sword_lv', name: '剑等级', icon: '📊', min: 1, max: 3 },
            { id: 'laser', name: '激光', icon: '🔦', min: 0, max: 10 },
            { id: 'explosive', name: '爆破', icon: '💥', type: 'bool' },
            { id: 'isMatryoshka', name: '套娃', icon: '🪆', type: 'bool' }
        ];
        
        const container = document.getElementById('train-attr-grid');
        container.innerHTML = attrs.map(a => `
            <div class="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[10px] text-slate-400">${a.icon} ${a.name}</span>
                    <span id="val-${a.id}" class="text-[10px] font-mono text-indigo-400">${a.type === 'bool' ? (this.bulletConfig[a.id] ? 'ON' : 'OFF') : (this.bulletConfig[a.id] || 0)}</span>
                </div>
                ${a.type === 'bool' ? `
                    <button onclick="game.trainingGround.toggleAttr('${a.id}')" class="w-full py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-slate-300">切换</button>
                ` : `
                    <input type="range" min="${a.min}" max="${a.max}" value="${this.bulletConfig[a.id] || 0}" 
                        oninput="game.trainingGround.updateBulletAttr('${a.id}', this.value)" 
                        class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500">
                `}
            </div>
        `).join('');
    }

    toggleAffix(id) {
        const idx = this.enemyConfig.affixes.indexOf(id);
        const btn = document.getElementById(`affix-btn-${id}`);
        if (idx === -1) {
            this.enemyConfig.affixes.push(id);
            btn.classList.add('border-indigo-500', 'bg-indigo-900/40');
            btn.classList.remove('border-slate-700', 'bg-slate-800');
        } else {
            this.enemyConfig.affixes.splice(idx, 1);
            btn.classList.remove('border-indigo-500', 'bg-indigo-900/40');
            btn.classList.add('border-slate-700', 'bg-slate-800');
        }
    }

    updateBulletAttr(id, val) {
        this.bulletConfig[id] = parseInt(val);
        document.getElementById(`val-${id}`).innerText = val;
        this.updateBulletPreview();
    }

    toggleAttr(id) {
        this.bulletConfig[id] = !this.bulletConfig[id];
        document.getElementById(`val-${id}`).innerText = this.bulletConfig[id] ? 'ON' : 'OFF';
        this.updateBulletPreview();
    }

    updateBulletPreview() {
        const preview = document.getElementById('preview-bullet-render');
        // 根据属性调整预览效果
        let color = '#ffffff';
        if (this.bulletConfig.pyro > 0) color = '#f97316';
        else if (this.bulletConfig.cryo > 0) color = '#06b6d4';
        else if (this.bulletConfig.lightning > 0) color = '#c084fc';
        else if (this.bulletConfig.wind > 0) color = '#34d399';
        
        preview.style.backgroundColor = color;
        preview.style.boxShadow = `0 0 ${10 + this.bulletConfig.damage/10}px ${color}`;
        preview.style.transform = `scale(${1 + this.bulletConfig.scatter/10})`;
    }

    spawnEnemy() {
        const hp = parseInt(document.getElementById('train-enemy-hp').value) || 100;
        const width = 60;
        const height = 60;
        
        // [优化] 寻找空位生成敌人
        let x, y;
        let attempts = 0;
        const margin = 80;
        do {
            x = margin + Math.random() * (this.game.width - margin * 2);
            y = margin + Math.random() * (this.game.height / 2); // 生成在屏幕上半部分
            attempts++;
        } while (this.game.enemies.some(e => e.pos.dist(new Vec2(x, y)) < 80) && attempts < 20);

        const enemy = new Enemy(x, y, width, height, hp, hp, 'normal', [...this.enemyConfig.affixes]);
        enemy.dropTargetY = y; 
        this.game.enemies.push(enemy);
        
        // 播放音效
        audio.playTone(400, 'square', 0.1, 0.2);
    }

    clearEnemies() {
        this.game.enemies = [];
    }

    fireBullet() {
        // 构造配方 (浅拷贝)
        const recipe = { ...this.bulletConfig };

        // --- [修复 1]：自动推导特殊属性的类型和标志位 ---
        // 游戏主逻辑依赖 recipe.type 和 recipe.isLaser，而不仅仅是数值
        
        // 1. 飞剑修复：如果有飞剑点数，强制设置类型为 flying_sword
        if (recipe.flying_sword > 0) {
            recipe.type = 'flying_sword';
            // 同步等级，确保生成的子剑等级正确
            recipe.level = this.bulletConfig.flying_sword_lv || 1;
        }

        // 2. 激光修复：如果有激光点数，强制开启 isLaser 开关
        if (recipe.laser > 0) {
            recipe.isLaser = true;
        }

        // 3. 风属性修复：确保等级传递
        if (recipe.wind > 0) {
            recipe.level = this.bulletConfig.wind_lv || 1;
            // 兼容性：某些逻辑可能检查 wind_lv
            recipe.wind_lv = recipe.level;
        }

        // 试炼场发射逻辑：从底部中央向上发射
        const x = this.game.width / 2;
        const y = this.game.height - 100;
        
        // [优化] 随机角度发射 (-30度 到 30度)，模拟真实散布
        const angle = (Math.random() - 0.5) * Math.PI / 3;
        const vel = new Vec2(0, -15).rotate(angle);

        // --- [修复 2]：修正参数传递顺序 ---
        // spawnBullet 定义: (x, y, vel, recipe, shotId, isLast)
        // 我们需要传递:
        // shotId: null (或生成的唯一ID，这里null即可)
        // isLast: true (关键！必须为 true 才能触发风属性锚点生成)
        this.game.spawn_spawnBullet(x, y, vel, recipe, null, true);

        // 记录开始时间用于计算 DPS
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
        
        // 更新伤害统计
        this.stats.totalDamage = this.game.roundDamage;
        
        // 简单的 DPS 计算 (每秒更新一次或每帧平滑)
        if (this.stats.totalDamage > 0 && this.stats.startTime === 0) {
            this.stats.startTime = Date.now();
        }
        
        if (this.stats.startTime > 0) {
            const duration = (Date.now() - this.stats.startTime) / 1000;
            if (duration > 0.5) {
                this.stats.dps = Math.floor(this.stats.totalDamage / duration);
            }
        }
        
        // 更新 UI
        const statsEl = document.getElementById('train-stats');
        if (statsEl) {
            statsEl.innerText = `DPS: ${this.stats.dps.toLocaleString()} | TOTAL: ${Math.floor(this.stats.totalDamage).toLocaleString()}`;
        }
    }

    enter() {
        this.active = true;
        this.game.hasCombatWall = true; // 试炼场强制开启底墙
        this.game.phase_switchPhase('training');
        document.getElementById('phase-training').style.display = 'flex';
        document.getElementById('phase-training').classList.remove('hidden-phase');
        document.getElementById('phase-training').classList.add('active-phase');
        
        // 清空当前战斗状态
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
        this.game.sonSwordQueue = [];
        this.game.swordQis = [];
        this.game.windAnchors = []; // [修复] 清空风锚点
        this.game.activeWindMatrices = []; // [修复] 清空风阵
        this.game.roundDamage = 0;
        this.stats.totalDamage = 0;
        this.stats.lastTotal = 0;
        this.stats.dps = 0;
        this.stats.startTime = 0;
    }

    exit() {
        this.active = false;
        this.game.hasCombatWall = false; // 退出时重置
        this.game.windAnchors = []; // [修复] 退出时清空
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
        
        // 切换快捷按钮的可见性
        if (quickActions) {
            quickActions.style.opacity = isCollapsed ? '1' : '0';
            quickActions.style.pointerEvents = isCollapsed ? 'auto' : 'none';
        }
    }

    switchTab(tab) {
        // 更新按钮状态
        document.querySelectorAll('.train-tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`tab-btn-${tab}`).classList.add('active');
        
        // 更新面板显示
        document.querySelectorAll('.train-panel-content').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${tab}`).classList.add('active');
    }
}


// ==================== 真理之书系统 ====================

class TruthBook {
    constructor(mainGame) {
        this.mainGame = mainGame;
        this.canvas = document.getElementById('truth-demo-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.active = false;
        this.currentEntry = null;
        this.demoGame = null;
        
        // 演示控制
        this.instructionIdx = 0;
        this.waitTimer = 0;
        this.simFrame = 0;
        
        // 視覺特效
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
                enemyList.appendChild(this.createListButton(entry));
            });
            TRUTH_BOOK_DATA.attributes.forEach(entry => {
                attrList.appendChild(this.createListButton(entry));
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
        document.getElementById('truth-empty-state').classList.add('hidden');
        document.getElementById('truth-content').classList.remove('hidden');
        document.getElementById('truth-item-icon').innerText = entry.icon;
        document.getElementById('truth-item-name').innerText = entry.name;
        document.getElementById('truth-item-desc').innerText = entry.desc;
        
        const tagsCont = document.getElementById('truth-item-tags');
        tagsCont.innerHTML = '';
        entry.tags.forEach(tag => {
            const s = document.createElement('span');
            s.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm tracking-wide';
            s.innerText = tag.toUpperCase();
            tagsCont.appendChild(s);
        });

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
        // --- 核心修復：構建全功能 Mock Game ---
        this.demoGame = {
            width: 600, height: 800,
            enemies: [], projectiles: [], particles: [], floatingTexts: [], 
            shockwaves: [], spores: [], fireWaves: [], sonSwords: [], 
            sonSwordQueue: [], swordQis: [], lightningBolts: [],
            activeWindMatrices: [], windAnchors: [],
            enemyHeight: 60, enemyWidth: 60, timeScale: 1.0,
            hasCombatWall: true, isDemo: true,
            roundDamage: 0, currentShotDamage: 0, currentShotDamageByAttr: {},
            shotDamageMap: new Map(),
            
            // 粒子與特效
            spawn_createParticle: (x, y, color, mode) => {
                // 確保粒子生成在模擬器區域內
                const p = new Particle(x, y, color, mode);
                this.demoGame.particles.push(p);
                return p;
            },
            spawn_createShockwave: (x, y, color) => {
                const sw = new Shockwave(x, y, color);
                this.demoGame.shockwaves.push(sw);
            },
            spawn_createFloatingText: (x, y, text, color) => {
                this.demoGame.floatingTexts.push(new FloatingText(x, y, text, color));
            },
            spawn_createExplosion: (x, y, color) => {
                this.demoGame.spawn_createShockwave(x, y, color);
                for(let i=0; i<10; i++) this.demoGame.spawn_createParticle(x, y, color, 'spark');
            },
            
            // 子彈生成
            spawn_spawnBullet: (arg1, arg2, arg3, arg4, arg5, arg6) => {
                let x, y, vel, config, id, isLast;
                if (typeof arg1 === 'object' && arg1.config) {
                    x = arg1.x; y = arg1.y; vel = arg1.vel; config = arg1.config;
                    id = arg1.id || null; isLast = arg1.isLast || false;
                } else {
                    x = arg1; y = arg2; vel = arg3; config = arg4; id = arg5; isLast = arg6;
                }
                
                // [修復] 確保 vel 是 Vec2 實例，防止 .len() 等方法報錯
                if (!(vel instanceof Vec2)) {
                    vel = new Vec2(vel.x, vel.y);
                }
                
                // [修復] 處理散射邏輯：如果 config 中有 scatter，則生成多個子彈
                if (config.scatter && !config._isScatterSub) {
                    const count = config.scatter;
                    const baseAngle = Math.atan2(vel.y, vel.x);
                    const spread = Math.PI / 4;
                    const speed = vel.len();
                    for (let i = 0; i < count; i++) {
                        const angle = baseAngle + (i - (count - 1) / 2) * (spread / count);
                        const newVel = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
                        const newConfig = { ...config, scatter: 0, _isScatterSub: true };
                        const p = new Projectile(x, y, newVel, newConfig, false, id, i === count - 1);
                        p.game = this.demoGame;
                        this.demoGame.projectiles.push(p);
                    }
                    return;
                }

                const p = new Projectile(x, y, vel, config, false, id, isLast);
                p.game = this.demoGame; 
                this.demoGame.projectiles.push(p);
            },
            
            // [核心重構] 傷害與戰鬥：直接調用主遊戲的戰鬥邏輯
            combat_damageEnemy: (enemy, proj, multiplier = 1.0) => {
                // 將當前上下文切換為 demoGame 並調用主遊戲的戰鬥方法
                this.mainGame.combat_damageEnemy.call(this.demoGame, enemy, proj, multiplier);
            },
            
            // 補充主遊戲邏輯依賴的其他方法
            combat_lightning_triggerChain: (enemy, dmg, history, level) => {
                this.mainGame.combat_lightning_triggerChain.call(this.demoGame, enemy, dmg, history, level);
            },
            
            combat_wind_addAnchor: (x, y, dmg, config) => {
                this.mainGame.combat_wind_addAnchor.call(this.demoGame, x, y, dmg, config);
            },
            
            combat_recordDamage: (amount, attrType = 'damage') => {
                this.demoGame.roundDamage += amount;
                if (!this.demoGame.currentShotDamageByAttr[attrType]) this.demoGame.currentShotDamageByAttr[attrType] = 0;
                this.demoGame.currentShotDamageByAttr[attrType] += amount;
            },
            
            combat_lightning_triggerChain: (currentEnemy, dmg, history, level) => {
                if (level <= 0) return;
                const range = 150; // 縮小閃電跳躍範圍，要求敵人靠得近
                let closest = null;
                let minDist = Infinity;
                this.demoGame.enemies.forEach(e => {
                    if (e !== currentEnemy && e.active && !history.includes(e)) {
                        const d = currentEnemy.pos.dist(e.pos);
                        if (d < range && d < minDist) { minDist = d; closest = e; }
                    }
                });
                if (closest) {
                    this.demoGame.lightningBolts.push(new LightningBolt(currentEnemy.pos, closest.pos));
                    const nextDmg = Math.floor(dmg * 0.8);
                    closest.takeDamage(nextDmg);
                    this.demoGame.spawn_createFloatingText(closest.pos.x, closest.pos.y, `-${nextDmg}`, '#c084fc');
                    history.push(closest);
                    // 遞歸跳躍
                    setTimeout(() => {
                        this.demoGame.combat_lightning_triggerChain(closest, nextDmg, history, level - 1);
                    }, 60);
                }
            },
            
            combat_wind_addAnchor: (x, y, bulletDamage, bulletConfig) => {
                this.demoGame.windAnchors.push({ x, y, life: 1.0, bulletDamage, bulletConfig });
                this.demoGame.spawn_createParticle(x, y, '#34d399', 'spark');
                if (this.demoGame.windAnchors.length >= 4) {
                    this.demoGame.spawn_createShockwave(x, y, '#34d399');
                    this.demoGame.windAnchors = []; // 簡化：滿4個直接重置
                }
            },

            spawn_triggerCloneSpawn: (parent) => {
                const cloneHp = Math.floor(parent.maxHp * 0.2);
                const clone = new Enemy(parent.pos.x + 60, parent.pos.y, 50, 50, cloneHp, cloneHp);
                clone.affixes = [];
                this.demoGame.enemies.push(clone);
                this.demoGame.spawn_createFloatingText(parent.pos.x, parent.pos.y, "CLONE!", "#a855f7");
            },

            spawn_addScore: (amt) => {},
            ui_updateRoundDamage: () => {},
            calc_isAreaOccupied: (x, y, w, h, exclude) => {
                return this.demoGame.enemies.some(e => e !== exclude && e.active && 
                    Math.abs(e.pos.x - x) < (e.width + w)/2 && 
                    Math.abs(e.pos.y - y) < (e.height + h)/2);
            }
        };

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
            this.demoGame.enemies.forEach(e => e.update(ts, this.demoGame));
            this.demoGame.projectiles.forEach(p => {
                // [修復] 模擬器牆壁反彈邏輯：完全同步主遊戲
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
                
                // [核心修復] 確保子彈更新時使用的是 demoGame 的上下文
                p.update(this.demoGame.width, this.demoGame.height, this.demoGame.enemies, this.demoGame.spawn_spawnBullet.bind(this.demoGame), ts);
            });
            this.demoGame.particles.forEach(p => p.update(ts));
            this.demoGame.floatingTexts.forEach(f => {
                f.update(ts);
                if (f instanceof FloatingText && f.life <= 0) f.active = false;
                else if (f.life !== undefined) { f.pos.y -= 0.5; f.life--; }
            });
            this.demoGame.shockwaves.forEach(s => s.update(ts));
            this.demoGame.lightningBolts.forEach(l => l.update(ts));
            this.demoGame.projectiles = this.demoGame.projectiles.filter(p => p.active);
            this.demoGame.particles = this.demoGame.particles.filter(p => p.active);
            this.demoGame.floatingTexts = this.demoGame.floatingTexts.filter(f => f.life > 0);
            this.demoGame.shockwaves = this.demoGame.shockwaves.filter(s => s.alpha > 0);
            this.demoGame.lightningBolts = this.demoGame.lightningBolts.filter(l => l.life > 0);
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
                if (actor) this.mainGame.phase_enemy_processTurn.call(this.demoGame, actor);
                break;
            case 'spawn_projectile':
                const px = inst.x || this.demoGame.width / 2;
                const py = inst.y || this.demoGame.height - 150;
                const angle = -Math.PI/2 + (Math.random()-0.5) * 0.1;
                const pvel = inst.vel ? new Vec2(inst.vel.x, inst.vel.y) : new Vec2(Math.cos(angle)*15, Math.sin(angle)*15);
                this.demoGame.spawn_spawnBullet(px, py, pvel, inst.config || {});
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
        this.gridOffset = (this.gridOffset + 0.5) % 40;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = this.gridOffset; y <= h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
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
        this.demoGame.shockwaves.forEach(s => s.draw(ctx));
        this.demoGame.lightningBolts.forEach(l => l.draw(ctx));
        this.demoGame.floatingTexts.forEach(f => f.draw(ctx));
        this.scanLineY = (this.scanLineY + 2) % gameH;
        ctx.fillStyle = `rgba(6, 182, 212, 0.1)`;
        ctx.fillRect(0, this.scanLineY, gameW, 2);
        ctx.restore();
    }
}

//// 注意：辅助函数（adjustColorBrightness, lerpColor, lerp, hexToRgba）已移动到 entities.js
// ==================== 导出系统类 ====================
export {
    UIManager,
    TrainingGround,
    TruthBook,
    TRUTH_BOOK_DATA
};
