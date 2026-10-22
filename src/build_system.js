/**
 * build_system.js - [REQ-20261022-wave-loop · S2] 整备阶段运行时（mixin，注册在 core.js `_subsystems`）。
 *
 * 流程（docs/design/dig_build_defend_loop_v1.md §3 / §7）：
 *   挖掘落定 → sys_onDigComplete（digCount++、收集器付款）→ sys_startBuildPhase（#phase-build）
 *   → 玩家买 / 升 / 处理满匣 → sys_commitBuild（「开战」）→ phase_startCombatPhase。
 *   Boss 存活的后续回合不挖，因此也不整备（resolver → 横幅 → 战斗）。
 * 守卫：敌人回合开始前 sys_triggerFacilities（设施按冷却自动触发）；战斗中 sys_useItem 使用道具。
 * 纯逻辑（价格 / 解锁 / 冷却 / 满匣）在 src/utils/build_economy_utils.js，本文件只负责把结果落到 Game 实例与战场。
 */

import { CONFIG } from './config.js';
import { showToast, LightningBolt } from './entities.js';
import { audio } from './audio.js';
import {
    BRANCH_SHOT_PROPS,
    computeCannonStats,
    getCollectorPayout,
    getReveal,
    normalizeBuildState,
    resolveMagazineOverflow,
    tickFacilities,
    tryPurchase,
} from './utils/build_economy_utils.js';
import { buildCannonShots } from './utils/dig_loop_utils.js';

const PURCHASE_FAIL_TEXT = {
    locked: '尚未解锁',
    maxed: '已达上限',
    energy: '能量不足',
    crystal: '晶核不足',
    branch_set: '分支已选定，不可更换',
    slot_closed: '设施位未开放',
    slot_full: '该设施位已占用',
    slot_empty: '该设施位为空',
    unique: '收集器全局只能建 1 座',
    items_full: '道具位已满',
    invalid: '无法购买',
};

export const FACILITY_LABELS = {
    turret: '炮台', lightning: '雷击塔', frost: '冰霜塔', shieldGen: '结界发生器', collector: '炼金收集器',
};
export const ITEM_LABELS = { bomb: '炸弹', timestop: '时停', shield: '急救结界', extraDig: '加挖' };
export const BRANCH_LABELS = { pierce: '穿透', scatter: '散射', fire: '元素·火', ice: '元素·冰', lightning: '元素·雷' };

function buildCfg() {
    return (CONFIG.gameplay && CONFIG.gameplay.build) || {};
}

export const build_system = {
    /**
     * @method sys_initBuildState
     * @description 新局重置整备状态（sys_resetGame 调用）。
     */
    sys_initBuildState() {
        const cfg = buildCfg();
        const s = normalizeBuildState({}, cfg);
        this.digCount = 0;
        this.cannonLevels = s.cannonLevels;
        this.cannonBranch = null;
        this.facilities = s.facilities;
        this.facilitySlotsOpen = s.facilitySlotsOpen;
        this.items = [];
        this.miningLevels = s.miningLevels;
        this._extraDigPending = 0;
        this._timeStopPending = false;
        this._enemyDescentSuppressed = false;
        this._pendingAlchemyOverflow = null;
        this._buildCommittedRound = null;
        this._facilityPulse = null;
        this.cannonShotsPerTurn = this.sys_getCannonStats().shots;
    },

    /** 当前整备状态快照（喂给纯函数）。 */
    sys_getBuildState() {
        return normalizeBuildState({
            energy: this.energy,
            crystal: this.crystal,
            cannonLevels: this.cannonLevels,
            cannonBranch: this.cannonBranch,
            facilities: this.facilities,
            facilitySlotsOpen: this.facilitySlotsOpen,
            items: this.items,
            miningLevels: this.miningLevels,
        }, buildCfg());
    },

    /** 把纯函数返回的状态写回实例。 */
    sys_applyBuildState(s) {
        this.energy = s.energy;
        this.crystal = s.crystal;
        this.cannonLevels = { ...s.cannonLevels };
        this.cannonBranch = s.cannonBranch;
        this.facilities = s.facilities.map(f => (f ? { ...f } : null));
        this.facilitySlotsOpen = s.facilitySlotsOpen;
        this.items = s.items.slice();
        this.miningLevels = { ...s.miningLevels };
        // S1 存档兼容：cannonShotsPerTurn 只是 sys_getCannonStats().shots 的派生镜像
        this.cannonShotsPerTurn = this.sys_getCannonStats().shots;
    },

    /** §8 逐波解锁：wave = 第几次挖掘，bossKills = 已击败 Boss 数。 */
    sys_getBuildReveal() {
        return getReveal({
            wave: this.digCount || 0,
            bossKills: Array.isArray(this.bossDefeatedLog) ? this.bossDefeatedLog.length : 0,
        }, buildCfg());
    },

    /**
     * @method sys_getCannonStats
     * @returns {{ shots:number, damage:number, bounce:number, branch:(string|null) }}
     */
    sys_getCannonStats() {
        const cannonCfg = (CONFIG.gameplay && CONFIG.gameplay.cannon) || {};
        const cfg = buildCfg();
        const stats = computeCannonStats(this.cannonLevels || {}, {
            baseShots: cannonCfg.shotsPerTurn || 2,
            baseDamage: cannonCfg.damage || 10,
            damageBonus: (CONFIG.gameplay.baseDamage || 1) - 1,
            baseBounce: cannonCfg.bounce || 0,
            damagePerLv: (cfg.cannon && cfg.cannon.damagePerLv) || 4,
        });
        return { ...stats, branch: this.cannonBranch || null };
    },

    /**
     * @method sys_buildCannonShots
     * @description 生成 n 发主炮射击（含分支属性）。damageOverride 用于设施 / 道具伤害：此时不带分支、反弹 0
     *   （§5.2：设施不吃分支和主炮类遗物）。
     */
    sys_buildCannonShots(n, damageOverride = null) {
        const stats = this.sys_getCannonStats();
        if (damageOverride !== null && damageOverride !== undefined) {
            return buildCannonShots(n, damageOverride, 0);
        }
        const shots = buildCannonShots(n, stats.damage, stats.bounce);
        const props = stats.branch ? BRANCH_SHOT_PROPS[stats.branch] : null;
        if (props) shots.forEach(s => Object.assign(s, props, { _cannonBranch: stats.branch }));
        return shots;
    },

    /**
     * @method sys_onDigComplete
     * @description 挖掘两批都落定后调用（phase_gathering_attemptComplete）：digCount++、收集器按挖掘付款、进入整备。
     */
    sys_onDigComplete() {
        this.digCount = (this.digCount || 0) + 1;
        const payout = getCollectorPayout(this.facilities, buildCfg());
        if (payout > 0) {
            this.energy = (this.energy || 0) + payout;
            showToast(`炼金收集器：+${payout}⚡`);
        }
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        setTimeout(() => this.sys_startBuildPhase(), 500);
    },

    /** 读档恢复：本回合已挖、尚未点「开战」→ 回到整备。 */
    sys_shouldResumeBuild() {
        return Number.isFinite(this._digDoneRound)
            && this._digDoneRound === this.round && this._buildCommittedRound !== this.round;
    },

    /**
     * @method sys_startBuildPhase
     * @description 进入整备（#phase-build）。无时限；所有价格、余额、下一波预告一屏可见（§2 P3）。
     */
    sys_startBuildPhase() {
        if (this.gameOver) return;
        this._digState = null;
        this.phase_switchPhase('build');
        if (typeof this.ui_renderBuildScreen === 'function') this.ui_renderBuildScreen();
        if (typeof this.ui_updateResourceHud === 'function') this.ui_updateResourceHud();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    /**
     * @method sys_buildPurchase
     * @param {object} action - 见 build_economy_utils.js 顶部说明
     * @returns {{ ok:boolean, reason:(string|null) }}
     */
    sys_buildPurchase(action) {
        if (this.phase !== 'build') return { ok: false, reason: 'invalid' };
        const res = tryPurchase(this.sys_getBuildState(), action, buildCfg(), this.sys_getBuildReveal());
        if (!res.ok) {
            showToast(PURCHASE_FAIL_TEXT[res.reason] || '无法购买');
            return { ok: false, reason: res.reason };
        }
        this.sys_applyBuildState(res.state);
        try { if (audio && typeof audio.playEffect === 'function') audio.playEffect('bump'); } catch (e) { /* 音效可缺省 */ }
        if (typeof this.ui_renderBuildScreen === 'function') this.ui_renderBuildScreen();
        if (typeof this.ui_updateResourceHud === 'function') this.ui_updateResourceHud({ pulse: true });
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        return { ok: true, reason: null };
    },

    /**
     * @method sys_resolveAlchemyOverflow
     * @param {{replace:number}|'discard'} choice
     */
    sys_resolveAlchemyOverflow(choice) {
        const pending = this._pendingAlchemyOverflow;
        if (!pending) return false;
        const next = resolveMagazineOverflow(this.alchemyMagazine || [], pending, choice);
        if (!next) return false;
        this.alchemyMagazine = next;
        this._pendingAlchemyOverflow = null;
        showToast(choice === 'discard' ? '已丢弃新炼成弹' : '已替换弹匣中的炼成弹');
        if (typeof this.ui_renderBuildScreen === 'function') this.ui_renderBuildScreen();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        return true;
    },

    /**
     * @method sys_commitBuild
     * @description 「开战」：满匣未处理时阻止；记 _buildCommittedRound 后进入战斗。
     */
    sys_commitBuild() {
        if (this.phase !== 'build') return false;
        if (this._pendingAlchemyOverflow) {
            showToast('弹匣已满：先选择替换哪一发或丢弃新弹');
            if (typeof this.ui_renderBuildScreen === 'function') this.ui_renderBuildScreen();
            return false;
        }
        this._buildCommittedRound = this.round;
        this.cannonShotsPerTurn = this.sys_getCannonStats().shots;
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        this.phase_startCombatPhase();
        return true;
    },

    // ==================== 守卫：设施 ====================

    /** 战场上可被设施 / 道具命中的敌人。 */
    _build_targetableEnemies() {
        return (this.enemies || []).filter(e => e && e.active && !e.isDead && e.hp > 0
            && (typeof this.phase_isEnemyClearable !== 'function' || this.phase_isEnemyClearable(e)));
    },

    /** 设施 / 道具伤害：走 combat_damageEnemy，配方带 _facility 标记（不吃分支与主炮类遗物）。 */
    _build_damage(enemy, dmg, kind) {
        if (!enemy || !enemy.active || typeof this.combat_damageEnemy !== 'function') return;
        const config = { ...this.sys_buildCannonShots(1, dmg)[0], _shotKind: kind || 'facility', _facility: true };
        this.combat_damageEnemy(enemy, {
            config,
            pos: enemy.pos,
            isCopy: false,
            shotId: `facility_${kind || 'x'}_${this.round}_${Math.random().toString(36).slice(2, 7)}`,
        });
    },

    /**
     * @method sys_triggerFacilities
     * @description 敌人回合开始前（phase_enemy_startLogic 顶部、isEnemyTurn=true 之前）推进设施冷却并结算触发。
     *   冰霜塔在扫描波温度结算之前写入低温，因此当回合即冻结。
     */
    sys_triggerFacilities() {
        if (this.phase !== 'combat' || this.gameOver) return [];
        if (!Array.isArray(this.facilities) || !this.facilities.some(Boolean)) return [];
        const { facilities, triggers } = tickFacilities(this.facilities, buildCfg());
        this.facilities = facilities;
        const fired = [];
        for (const t of triggers) {
            const ok = this._build_fireFacility(t);
            if (ok) fired.push(t.slot);
        }
        this._facilityPulse = { slots: fired, at: Date.now() };
        if (typeof this.ui_renderDefendHud === 'function') this.ui_renderDefendHud({ pulseSlots: fired });
        return triggers;
    },

    _build_fireFacility(t) {
        const s = t.stats || {};
        const foes = this._build_targetableEnemies();
        const limit = CONFIG.performance[this.perfQualityLevel || 'high'] || {};
        if (t.type === 'shieldGen') {
            const before = this.playerShield || 0;
            this.playerShield = Math.min(Math.max(before, s.cap || 3), before + 1);
            if (this.playerShield > before && typeof this.ui_updateShieldPill === 'function') this.ui_updateShieldPill();
            if (this.playerShield > before) this.spawn_createFloatingText(this.width / 2, this.height - 150, '结界 +1', '#7dd3fc');
            return this.playerShield > before;
        }
        if (foes.length === 0) return false;
        if (t.type === 'turret') {
            // 炮台：打最前（y 最大）的敌人
            const target = foes.reduce((a, b) => (b.pos.y > a.pos.y ? b : a));
            this._build_damage(target, s.dmg || 6, 'turret');
            this.spawn_createParticle && this.spawn_createParticle(target.pos.x, target.pos.y, '#fde68a', 'spark');
            return true;
        }
        if (t.type === 'lightning') {
            // 雷击塔：从最前敌人起，依次跳到最近的未命中敌人，共 N 个
            const hops = Math.max(1, s.targets || 3);
            let cur = foes.reduce((a, b) => (b.pos.y > a.pos.y ? b : a));
            const hit = new Set();
            let prev = { x: cur.pos.x, y: this.height - 110 };
            for (let i = 0; i < hops && cur; i++) {
                hit.add(cur);
                if (!this.lightningBolts) this.lightningBolts = [];
                if (this.lightningBolts.length < (limit.lightningLimit || 8)) {
                    this.lightningBolts.push(new LightningBolt(prev.x, prev.y, cur.pos.x, cur.pos.y));
                }
                prev = { x: cur.pos.x, y: cur.pos.y };
                this._build_damage(cur, s.dmg || 7, 'lightning_tower');
                const from = prev;
                cur = foes.filter(e => !hit.has(e) && e.active)
                    .sort((a, b) => Math.hypot(a.pos.x - from.x, a.pos.y - from.y) - Math.hypot(b.pos.x - from.x, b.pos.y - from.y))[0] || null;
            }
            return true;
        }
        if (t.type === 'frost') {
            // 冰霜塔：前排（y 最大的一行）血量最高的 N 个，温度压到冻结阈值以下
            const frontY = Math.max(...foes.map(e => e.pos.y));
            const rowTol = (this.enemyHeight || 40) * 0.5;
            const front = foes.filter(e => frontY - e.pos.y <= rowTol).sort((a, b) => b.hp - a.hp);
            const picked = front.slice(0, Math.max(1, s.count || 1));
            picked.forEach(e => {
                e.temp = Math.min(e.temp || 0, -100);
                if (typeof this.spawn_createSkillIgnition === 'function') this.spawn_createSkillIgnition(e.pos.x, e.pos.y, '#67e8f9');
                this.spawn_createFloatingText(e.pos.x, e.pos.y - 24, '冻结', '#67e8f9');
            });
            return picked.length > 0;
        }
        return false;
    },

    // ==================== 守卫：道具 ====================

    /** 道具使用条件与「换炼成弹」一致：玩家回合、非横幅、无飞行子弹、还有射击次数。 */
    sys_canUseItem() {
        return typeof this.sys_canSwapAlchemyShot === 'function' ? this.sys_canSwapAlchemyShot() : false;
    },

    /**
     * @method sys_useItem
     * @param {number} index - this.items 下标
     */
    sys_useItem(index) {
        if (!this.sys_canUseItem()) return false;
        const items = Array.isArray(this.items) ? this.items : [];
        const id = items[index];
        if (!id) return false;
        const itemsCfg = buildCfg().items || {};
        if (id === 'bomb') {
            const cfg = itemsCfg.bomb || {};
            const foes = this._build_targetableEnemies();
            if (foes.length === 0) { showToast('没有可炸的目标'); return false; }
            const target = foes.reduce((a, b) => (b.pos.y > a.pos.y ? b : a));
            const cx = target.pos.x;
            const cy = target.pos.y;
            const r2 = Math.pow(cfg.radius || 100, 2);
            foes.filter(e => Math.pow(e.pos.x - cx, 2) + Math.pow(e.pos.y - cy, 2) <= r2)
                .forEach(e => {
                    if (!e.active) return;
                    this.combat_damageEnemy(e, {
                        config: { ...this.sys_buildCannonShots(1, cfg.dmg || 30)[0], _shotKind: 'item', _facility: true },
                        pos: e.pos, isCopy: false, shotId: `item_bomb_${this.round}`,
                    }, cfg.dmg || 30);
                });
            if (typeof this.spawn_createShockwave === 'function') this.spawn_createShockwave(cx, cy, '#fb923c');
        } else if (id === 'timestop') {
            this._timeStopPending = true;
            showToast('时停：本回合敌人不下压');
        } else if (id === 'shield') {
            this.playerShield = (this.playerShield || 0) + ((itemsCfg.shield && itemsCfg.shield.amount) || 2);
            if (typeof this.ui_updateShieldPill === 'function') this.ui_updateShieldPill();
            showToast(`急救结界：护盾 +${(itemsCfg.shield && itemsCfg.shield.amount) || 2}`);
        } else if (id === 'extraDig') {
            this._extraDigPending = (this._extraDigPending || 0) + ((itemsCfg.extraDig && itemsCfg.extraDig.collectors) || 2);
            showToast(`加挖：下次挖掘采集弹珠 +${(itemsCfg.extraDig && itemsCfg.extraDig.collectors) || 2}`);
        } else {
            return false;
        }
        this.items = items.filter((_, i) => i !== index);
        if (typeof this.ui_renderDefendHud === 'function') this.ui_renderDefendHud();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        return true;
    },
};
