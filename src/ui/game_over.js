/**
 * game_over.js - 每局结束结算页面 UI 子系统
 *
 * 职责：
 * - 渲染横向回合节点图（标注 Boss 回合）
 * - 展示本局统计：总伤害、击杀数、持有遗物
 * - 展示本局收获：结算符文碎片数量、获得的符文列表
 * - 提供三个操作按钮：前往商店 / 再来一局 / 返回首页
 *
 * Mixin 规范：
 * - 所有方法挂载在 game_over_mixin 对象上，通过 core.js 的 bind(this) 注入
 * - 读取 Game 实例状态时使用 this.xxx（Mixin 正常用法）
 * - 不直接修改 Game 实例状态，仅读取并渲染
 */

import { RUNE_DB } from '../rune_config.js';
import { RELIC_DB } from '../config.js';

// ==================== Boss 元数据（用于节点图标注） ====================
const BOSS_META = {
    // Mini-Boss
    ignis:    { name: '炎核', icon: '🔥', color: '#f97316', isBig: false },
    glacies:  { name: '冰晶', icon: '❄️', color: '#06b6d4', isBig: false },
    mikro:    { name: '微核', icon: '⚡', color: '#c084fc', isBig: false },
    devourer: { name: '噬界', icon: '🌑', color: '#6b7280', isBig: false },
    // Big-Boss
    viridis:  { name: '翠毒', icon: '☠️', color: '#22c55e', isBig: true },
    tesla:    { name: '雷皇', icon: '⚡', color: '#a855f7', isBig: true },
    chimera:  { name: '奇美拉', icon: '🐉', color: '#ef4444', isBig: true },
    ouroboros:{ name: '衔尾蛇', icon: '🐍', color: '#f59e0b', isBig: true },
};

export const game_over_mixin = {

    /**
     * @method _gameover_triggerPhase
     * @description 触发游戏结束阶段切换，由 game_phase.js 中 gameOver 设为 true 后调用。
     * 使用 setTimeout 延迟一帧，确保渲染循环安全退出后再切换阶段。
     */
    _gameover_triggerPhase() {
        // 延迟一帧，确保当前渲染帧安全完成
        setTimeout(() => {
            this.phase_switchPhase('gameover');
            this.gameover_show();
        }, 50);
    },

    /**
     * @method gameover_show
     * @description 进入 gameover 阶段时调用，收集统计数据并渲染结算页面。
     */
    gameover_show() {
        // 收集本局统计数据快照（在 sys_resetGame 之前调用）
        const snapshot = this._gameover_collectSnapshot();
        // 渲染页面
        this._gameover_render(snapshot);
    },

    /**
     * @method _gameover_collectSnapshot
     * @description 从当前 Game 实例状态中收集本局所有统计数据。
     * @returns {Object} 统计数据快照
     */
    _gameover_collectSnapshot() {
        // --- 回合数 ---
        const totalRounds = Math.max(1, this.round - 1); // round 在 finalizeRound 中已 ++，减 1 得实际回合数

        // --- Boss 出现记录 ---
        // bossDefeatedLog: [{ bossId, bossName, round, isBigBoss }]
        const bossLog = (this.bossDefeatedLog || []).slice();

        // --- 总伤害（汇总 roundDamageHistory） ---
        let totalDamage = 0;
        if (this.roundDamageHistory && this.roundDamageHistory.length > 0) {
            for (const rec of this.roundDamageHistory) {
                if (rec.shots && Array.isArray(rec.shots)) {
                    for (const shot of rec.shots) {
                        totalDamage += (shot.total || 0);
                    }
                }
            }
        }
        // 加上当前回合尚未入历史的伤害
        totalDamage += (this.roundDamage || 0);

        // --- 击杀数 ---
        const killCount = this.runKillCount || 0;

        // --- 遗物列表 ---
        const relics = (this.ownedRelics || []).map(relicId => {
            const def = RELIC_DB.find(r => r.id === relicId);
            return def ? { id: relicId, name: def.name, icon: def.icon, rarity: def.rarity } : null;
        }).filter(Boolean);

        // --- 符文碎片（本局新增量） ---
        const runeFragmentsGained = this.runRuneFragmentsGained || 0;

        // --- 符文列表（本局获得） ---
        const runesGained = (this.runeInventory || []).map(runeObj => {
            const def = RUNE_DB.find(r => r.id === runeObj.id);
            return def ? { id: runeObj.id, name: def.name, icon: def.icon, rarity: def.rarity, level: runeObj.level || 1 } : null;
        }).filter(Boolean);

        return {
            totalRounds,
            bossLog,
            totalDamage,
            killCount,
            relics,
            runeFragmentsGained,
            runesGained,
        };
    },

    /**
     * @method _gameover_render
     * @description 将统计快照渲染到 #phase-gameover 容器中。
     * @param {Object} snapshot
     */
    _gameover_render(snapshot) {
        const container = document.getElementById('gameover-content');
        if (!container) return;

        container.innerHTML = `
            ${this._gameover_renderHeader()}
            ${this._gameover_renderRoundTimeline(snapshot)}
            ${this._gameover_renderStats(snapshot)}
            ${this._gameover_renderHarvest(snapshot)}
            ${this._gameover_renderButtons()}
        `;
    },

    /**
     * @method _gameover_renderHeader
     * @description 渲染顶部标题区域。
     */
    _gameover_renderHeader() {
        return `
        <div class="gameover-header text-center mb-6 pt-8">
            <div class="text-6xl mb-3 animate-pulse-slow">💀</div>
            <h1 class="text-4xl font-bold text-red-400 font-[Cinzel] tracking-widest drop-shadow-[0_0_20px_rgba(248,113,113,0.5)] mb-1">
                防線失守
            </h1>
            <p class="text-slate-500 text-sm tracking-[0.4em] uppercase">Run Over</p>
        </div>
        `;
    },

    /**
     * @method _gameover_renderRoundTimeline
     * @description 渲染横向回合节点图。
     * @param {Object} snapshot
     */
    _gameover_renderRoundTimeline(snapshot) {
        const { totalRounds, bossLog } = snapshot;

        // 构建 Boss 回合索引 Map: round -> bossInfo
        const bossRoundMap = {};
        for (const b of bossLog) {
            bossRoundMap[b.round] = b;
        }

        // 生成节点列表
        const nodes = [];
        for (let r = 1; r <= totalRounds; r++) {
            const boss = bossRoundMap[r];
            nodes.push({ round: r, boss: boss || null });
        }

        // 每行最多显示 N 个节点（避免单行过长）
        const MAX_PER_ROW = 10;
        const rows = [];
        for (let i = 0; i < nodes.length; i += MAX_PER_ROW) {
            rows.push(nodes.slice(i, i + MAX_PER_ROW));
        }

        const rowsHtml = rows.map((row, rowIdx) => {
            const nodesHtml = row.map((node, nodeIdx) => {
                const isLast = rowIdx === rows.length - 1 && nodeIdx === row.length - 1;
                const isFirst = rowIdx === 0 && nodeIdx === 0;

                if (node.boss) {
                    const meta = BOSS_META[node.boss.bossId] || { name: node.boss.bossName || 'Boss', icon: '👹', color: '#ef4444', isBig: false };
                    const sizeClass = meta.isBig ? 'w-12 h-12 text-xl' : 'w-9 h-9 text-base';
                    const ringClass = meta.isBig
                        ? 'ring-2 ring-offset-1 ring-offset-slate-900'
                        : 'ring-1 ring-offset-1 ring-offset-slate-900';
                    return `
                    <div class="gameover-node flex flex-col items-center gap-1 relative">
                        <div class="gameover-node-boss ${sizeClass} rounded-full flex items-center justify-center ${ringClass} shadow-lg transition-transform hover:scale-110 cursor-default"
                             style="background: ${meta.color}22; border: 2px solid ${meta.color}; box-shadow: 0 0 10px ${meta.color}44;"
                             title="Round ${node.round}: ${meta.name}">
                            <span>${meta.icon}</span>
                        </div>
                        <span class="text-[9px] font-bold" style="color: ${meta.color};">${meta.name}</span>
                        <span class="text-[8px] text-slate-600">R${node.round}</span>
                    </div>
                    `;
                } else {
                    const dotClass = isLast
                        ? 'w-3 h-3 bg-red-500 ring-2 ring-red-400 ring-offset-1 ring-offset-slate-900'
                        : isFirst
                            ? 'w-3 h-3 bg-indigo-500 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900'
                            : 'w-2.5 h-2.5 bg-slate-600 hover:bg-slate-400';
                    return `
                    <div class="gameover-node flex flex-col items-center gap-1 relative">
                        <div class="gameover-node-dot ${dotClass} rounded-full transition-colors cursor-default" title="Round ${node.round}"></div>
                        <span class="text-[8px] text-slate-700">R${node.round}</span>
                    </div>
                    `;
                }
            }).join(`
                <div class="gameover-connector flex-1 h-px bg-gradient-to-r from-slate-700 to-slate-600 self-center mb-4 min-w-[8px] max-w-[24px]"></div>
            `);

            return `
            <div class="gameover-timeline-row flex items-end justify-center gap-0 flex-wrap">
                ${nodesHtml}
            </div>
            `;
        }).join('<div class="h-2"></div>');

        return `
        <section class="gameover-section mb-6 px-4">
            <div class="gameover-section-title flex items-center gap-2 mb-3">
                <div class="w-1 h-4 bg-indigo-500 rounded-full"></div>
                <span class="text-xs font-bold text-slate-400 tracking-widest uppercase">回合历程</span>
                <span class="ml-auto text-xs text-slate-600">共 ${totalRounds} 回合</span>
            </div>
            <div class="gameover-timeline bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
                <div class="flex flex-col gap-3 min-w-max mx-auto">
                    ${rowsHtml}
                </div>
                <div class="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800 flex-wrap">
                    <div class="flex items-center gap-1.5">
                        <div class="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                        <span class="text-[10px] text-slate-500">起始</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                        <span class="text-[10px] text-slate-500">普通回合</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="w-3 h-3 rounded-full bg-orange-500/30 border border-orange-500 flex items-center justify-center text-[8px]">👹</div>
                        <span class="text-[10px] text-slate-500">Mini-Boss</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="w-4 h-4 rounded-full bg-red-500/30 border-2 border-red-500 flex items-center justify-center text-[8px]">👹</div>
                        <span class="text-[10px] text-slate-500">大 Boss</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="w-3 h-3 rounded-full bg-red-500"></div>
                        <span class="text-[10px] text-slate-500">失守回合</span>
                    </div>
                </div>
            </div>
        </section>
        `;
    },

    /**
     * @method _gameover_renderStats
     * @description 渲染本局统计模块。
     * @param {Object} snapshot
     */
    _gameover_renderStats(snapshot) {
        const { totalDamage, killCount, relics } = snapshot;

        const relicsHtml = relics.length > 0
            ? relics.map(r => {
                const rarityColor = {
                    common: '#94a3b8',
                    rare: '#60a5fa',
                    legendary: '#f59e0b',
                    cursed: '#a855f7',
                }[r.rarity] || '#94a3b8';
                return `
                <div class="flex items-center gap-2 bg-slate-800/60 rounded-lg px-2.5 py-1.5 border border-slate-700/50 hover:border-slate-600 transition-colors cursor-default"
                     title="${r.name}">
                    <span class="text-lg">${r.icon}</span>
                    <span class="text-xs font-medium" style="color: ${rarityColor};">${r.name}</span>
                </div>
                `;
            }).join('')
            : `<span class="text-xs text-slate-600 italic">本局未获得遗物</span>`;

        return `
        <section class="gameover-section mb-6 px-4">
            <div class="gameover-section-title flex items-center gap-2 mb-3">
                <div class="w-1 h-4 bg-purple-500 rounded-full"></div>
                <span class="text-xs font-bold text-slate-400 tracking-widest uppercase">本局统计</span>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <!-- 总伤害 -->
                <div class="gameover-stat-card bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center gap-1 hover:border-red-500/30 transition-colors">
                    <span class="text-2xl">⚔️</span>
                    <span class="text-xl font-bold text-red-400 tabular-nums">${Math.floor(totalDamage).toLocaleString()}</span>
                    <span class="text-[10px] text-slate-500 tracking-wider uppercase">总伤害</span>
                </div>
                <!-- 击杀数 -->
                <div class="gameover-stat-card bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center gap-1 hover:border-amber-500/30 transition-colors">
                    <span class="text-2xl">💀</span>
                    <span class="text-xl font-bold text-amber-400 tabular-nums">${killCount.toLocaleString()}</span>
                    <span class="text-[10px] text-slate-500 tracking-wider uppercase">击杀数</span>
                </div>
            </div>
            <!-- 遗物 -->
            <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div class="text-[10px] text-slate-500 tracking-wider uppercase mb-2">选用遗物 (${relics.length})</div>
                <div class="flex flex-wrap gap-2">
                    ${relicsHtml}
                </div>
            </div>
        </section>
        `;
    },

    /**
     * @method _gameover_renderHarvest
     * @description 渲染本局收获模块（符文碎片 + 符文）。
     * @param {Object} snapshot
     */
    _gameover_renderHarvest(snapshot) {
        const { runeFragmentsGained, runesGained } = snapshot;

        const runesHtml = runesGained.length > 0
            ? runesGained.map(r => {
                const rarityColor = {
                    common: '#94a3b8',
                    rare: '#60a5fa',
                    epic: '#a855f7',
                    legendary: '#f59e0b',
                }[r.rarity] || '#94a3b8';
                const rarityBg = {
                    common: 'rgba(148,163,184,0.08)',
                    rare: 'rgba(96,165,250,0.08)',
                    epic: 'rgba(168,85,247,0.08)',
                    legendary: 'rgba(245,158,11,0.08)',
                }[r.rarity] || 'rgba(148,163,184,0.08)';
                return `
                <div class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border transition-colors cursor-default"
                     style="background: ${rarityBg}; border-color: ${rarityColor}33;"
                     title="${r.name} Lv.${r.level}">
                    <span class="text-base">${r.icon}</span>
                    <div class="flex flex-col">
                        <span class="text-xs font-medium leading-tight" style="color: ${rarityColor};">${r.name}</span>
                        <span class="text-[9px] text-slate-600">Lv.${r.level}</span>
                    </div>
                </div>
                `;
            }).join('')
            : `<span class="text-xs text-slate-600 italic">本局未获得符文</span>`;

        return `
        <section class="gameover-section mb-6 px-4">
            <div class="gameover-section-title flex items-center gap-2 mb-3">
                <div class="w-1 h-4 bg-cyan-500 rounded-full"></div>
                <span class="text-xs font-bold text-slate-400 tracking-widest uppercase">本局收获</span>
            </div>
            <!-- 符文碎片 -->
            <div class="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3 mb-3 hover:border-cyan-500/30 transition-colors">
                <span class="text-2xl">🔮</span>
                <div class="flex flex-col">
                    <span class="text-lg font-bold text-cyan-400 tabular-nums">+${runeFragmentsGained.toLocaleString()}</span>
                    <span class="text-[10px] text-slate-500 tracking-wider uppercase">符文碎片</span>
                </div>
            </div>
            <!-- 符文列表 -->
            <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div class="text-[10px] text-slate-500 tracking-wider uppercase mb-2">获得符文 (${runesGained.length})</div>
                <div class="flex flex-wrap gap-2">
                    ${runesHtml}
                </div>
            </div>
        </section>
        `;
    },

    /**
     * @method _gameover_renderButtons
     * @description 渲染底部操作按钮区域。
     */
    _gameover_renderButtons() {
        return `
        <section class="gameover-buttons px-4 pb-10 flex flex-col gap-3">
            <!-- 前往商店 -->
            <button onclick="game.gameover_goToShop()"
                    class="w-full py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-200
                           bg-amber-900/20 border border-amber-500/40 text-amber-300
                           hover:bg-amber-900/40 hover:border-amber-400 hover:text-amber-100 hover:scale-[1.02]
                           active:scale-[0.98] shadow-lg">
                <span class="text-lg mr-2">⚒️</span>前往商店
            </button>
            <!-- 再来一局 -->
            <button onclick="game.gameover_playAgain()"
                    class="w-full py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-200
                           bg-indigo-900/30 border border-indigo-500/50 text-indigo-300
                           hover:bg-indigo-900/50 hover:border-indigo-400 hover:text-indigo-100 hover:scale-[1.02]
                           active:scale-[0.98] shadow-lg">
                <span class="text-lg mr-2">🔄</span>再来一局
            </button>
            <!-- 返回首页 -->
            <button onclick="game.gameover_goHome()"
                    class="w-full py-3 rounded-xl font-medium text-sm tracking-wider transition-all duration-200
                           bg-transparent border border-slate-700 text-slate-500
                           hover:border-slate-500 hover:text-slate-300 hover:bg-slate-800/30
                           active:scale-[0.98]">
                <span class="text-base mr-2">🏠</span>返回首页
            </button>
        </section>
        `;
    },

    // ==================== 按钮回调 ====================

    /**
     * @method gameover_goToShop
     * @description 前往商店按钮回调。
     */
    gameover_goToShop() {
        this.meta_openShop();
    },

    /**
     * @method gameover_playAgain
     * @description 再来一局按钮回调。
     */
    gameover_playAgain() {
        this.meta_startRun();
    },

    /**
     * @method gameover_goHome
     * @description 返回首页按钮回调。
     */
    gameover_goHome() {
        this.phase_switchPhase('meta');
    },
};
