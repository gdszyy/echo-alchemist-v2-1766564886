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
// 缺料一句话（`缺 火料 4`）与三色中文名走 `shot_recipe_utils` 的唯一真源：整备屏与运行期 toast 同一句。
import { formatMaterialShortfall } from './utils/shot_recipe_utils.js';
import {
    BRANCH_SHOT_PROPS,
    computeCannonStats,
    createBuildGrid,
    getCollectorPayout,
    getReveal,
    normalizeBuildState,
    tickFacilities,
    tryPurchase,
} from './utils/build_economy_utils.js';
import { buildCannonShots } from './utils/dig_loop_utils.js';

const PURCHASE_FAIL_TEXT = {
    locked: '尚未解锁',
    maxed: '已达上限',
    energy: '能量不足',
    crystal: '晶核不足',
    // `materials` 只是**没有价格明细时**的兜底三字（取不到 price / 取不到料账本）。
    // 有明细时一律走 `materialsFailText`，屏上给「料不足：缺 火料 4」——差额 = 需要 − 现有。
    materials: '料不足',
    branch_set: '分支已选定，不可更换',
    slot_closed: '设施位未开放',
    slot_full: '该设施位已占用',
    slot_empty: '该设施位为空',
    items_full: '道具位已满',
    invalid: '无法购买',
};

export const FACILITY_LABELS = {
    turret: '炮台', lightning: '雷击塔', frost: '冰霜塔', shieldGen: '结界发生器', collector: '炼金收集器',
    workshop: '弹药工坊', generator: '发电机', battery: '电池',
};
export const ITEM_LABELS = { bomb: '炸弹', timestop: '时停', shield: '急救结界', extraDig: '加挖' };
export const BRANCH_LABELS = { pierce: '穿透', scatter: '散射', fire: '元素·火', ice: '元素·冰', lightning: '元素·雷' };

/**
 * `unique` 失败的**通用**尾句（不带设施名）：只在取不到设施名时降级用，避免把 `undefined` 拼进句子。
 * 量词订正（2026-10-25）：旧句是「全局只能建 1 座」，而 8 件设施里只有 `collector` / `workshop` /
 * `generator` / `battery` 标了 `unique: true`（`config.js:975-982`），不点名时读起来像对所有设施都成立。
 * 现在改成「每局」＝一局之内，且**一律点名**（见 `uniqueFacilityText`）。
 */
const UNIQUE_FAIL_TEXT_GENERIC = '每局只能建 1 座';

/**
 * @function uniqueFacilityText
 * @description `unique`（每局 1 座）失败文案：**一律点名设施**，供运行期 toast 与整备弹层共用同一句
 *   （两个入口各写一句就是「同一规则两句话」，2026-10-25 验收 P1-5 的同类问题）。
 *   - 设施键登记在 `FACILITY_LABELS`：`<中文名>每局只能建 1 座`（如「弹药工坊每局只能建 1 座」）。
 *   - 取不到 / 没登记：降级成通用尾句（不带设施名），不抛错、不拼 `undefined`。
 *   ——旧实现对 `collector` 逐字沿用「收集器全局只能建 1 座」；本轮到 `collector` 也走同一条拼装，
 *   屏上从「收集器」变「炼金收集器」，是**刻意统一**，不是笔误（弹层/运行期必须同源同措辞）。
 */
export function uniqueFacilityText(facility) {
    const label = (facility && Object.prototype.hasOwnProperty.call(FACILITY_LABELS, facility))
        ? FACILITY_LABELS[facility]
        : null;
    return label ? `${label}${UNIQUE_FAIL_TEXT_GENERIC}` : UNIQUE_FAIL_TEXT_GENERIC;
}

/**
 * @function materialsFailText
 * @description 缺料失败文案：`料不足：缺 火料 4`（差额 = 需要 − 现有，中文名取自 `MATERIAL_LABELS`）。
 *   `price.materials` 是逐料需求、`ledger` 是当前料账本；任一缺失/为空 ⇒ 回落兜底三字，绝不猜数。
 */
function materialsFailText(price, ledger) {
    const need = (price && typeof price === 'object' && price.materials) ? price.materials : null;
    const have = ledger && typeof ledger === 'object' ? ledger : null;
    if (!need || !have) return PURCHASE_FAIL_TEXT.materials;
    const detail = formatMaterialShortfall(need, have);
    return detail ? `${PURCHASE_FAIL_TEXT.materials}：${detail}` : PURCHASE_FAIL_TEXT.materials;
}

/**
 * @function purchaseFailText
 * @description 购买失败 ⇒ 玩家可见文案。`unique` 要点名设施、`materials` 要给差额，故各走一次现拼；
 *   其余 reason 仍查 `PURCHASE_FAIL_TEXT` 表，表里没有则回落到「无法购买」。
 *   `ledger` 是当前料账本（`materials` 用；缺它只影响差额，不影响兜底三字）。
 */
function purchaseFailText(res, action, ledger) {
    if (!res) return '无法购买';
    if (res.reason === 'unique') return uniqueFacilityText(action && action.facility);
    if (res.reason === 'materials') return materialsFailText(res.price, ledger);
    return PURCHASE_FAIL_TEXT[res.reason] || '无法购买';
}

function buildCfg() {
    return (CONFIG.gameplay && CONFIG.gameplay.build) || {};
}

/** 主炮三条轨的中文名（成功提示用；与整备屏的轨名同口径）。 */
const CANNON_TRACK_LABELS = { dmg: '伤害', rate: '射速', bounce: '弹道' };

/**
 * @function purchaseOkText
 * @description 成交后的一句确认（2026-10-25 验收 P1-6：成功分支此前完全没有反馈）。
 *   逐动作给具体名字与结果，让「盖上了 / 升级了 / 选定分支了」有事件感：
 *   建 / 升级设施点名，主炮写轨名 + 新等级，分支写选定的分支名。
 *   取不到名字时回落「已建成」，**不编造**名字也不抛错。
 * @param {{type:string, track?:string, facility?:string, item?:string, branch?:string, slot?:number}} action
 * @param {{facilities?:Array, cannonLevels?:object}} state - `res.state`（已应用的新状态）
 */
function purchaseOkText(action, state) {
    const a = (action && typeof action === 'object') ? action : {};
    const s = (state && typeof state === 'object') ? state : {};
    const facilities = Array.isArray(s.facilities) ? s.facilities : [];
    const facilityAt = idx => (Number.isInteger(idx) && facilities[idx]) ? facilities[idx] : null;
    if (a.type === 'build') {
        const label = FACILITY_LABELS[a.facility];
        return label ? `已建成：${label}` : '已建成';
    }
    if (a.type === 'upgrade') {
        const f = facilityAt(a.slot);
        const label = f ? FACILITY_LABELS[f.type] : null;
        return label ? `${label}升到 Lv${f.level}` : '已升级';
    }
    if (a.type === 'cannon') {
        const lv = s.cannonLevels ? s.cannonLevels[a.track] : null;
        const label = CANNON_TRACK_LABELS[a.track];
        return (label && Number.isFinite(Number(lv))) ? `主炮${label}升到 Lv${Number(lv)}` : '主炮已升级';
    }
    if (a.type === 'branch') {
        const label = BRANCH_LABELS[a.branch];
        return label ? `分支已选定：${label}` : '分支已选定';
    }
    if (a.type === 'item') {
        const label = ITEM_LABELS[a.item];
        return label ? `已获得：${label}` : '已获得道具';
    }
    if (a.type === 'mining') return '采集升级完成';
    if (a.type === 'slot') return `设施位已开放 ${Number(s.facilitySlotsOpen) || 0} 个`;
    // [批次 3] 扩建一行：报出新行数与新总格数（不点名「扩建」，玩家看到的是盘面变大）。
    // [批次 4] 同时报出新的设施位数——扩建的**产能后果**就是这一条，只报格数等于没说清玩家买到了什么。
    //   位数直接读归一化后的 `s.facilities.length`（容量由 getFacilitySlotCapacity 派生），不在这里另算。
    if (a.type === 'expand' && s && s.buildGrid) {
        const slotCount = Array.isArray(s.facilities) ? s.facilities.length : 0;
        return `工厂扩建：${s.buildGrid.rows} 行 · ${s.buildGrid.rows * s.buildGrid.cols} 格 · 设施位 ${slotCount}`;
    }
    return '已建成';
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
        // [批次 1] 工厂网格：新局按 config 起手（cols 列 × rowsStart 行），设备本体仍只在 this.facilities。
        this.buildGrid = createBuildGrid(cfg);
        this.items = [];
        this.miningLevels = s.miningLevels;
        this._extraDigPending = 0;
        this._timeStopPending = false;
        this._enemyDescentSuppressed = false;
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
            // [批次 1] 网格随状态进出纯函数层：扩建（rows +1 / cells +cols）就在这一层落地。
            buildGrid: this.buildGrid,
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
        // [批次 1] 网格写回：只拷 `{ cols, rows, cells }` 三键（纯函数层归一后的 `dropped` 计数不入运行时状态）。
        this.buildGrid = {
            cols: s.buildGrid.cols,
            rows: s.buildGrid.rows,
            cells: s.buildGrid.cells.map(c => (c ? { ...c } : null)),
        };
        // 归一化丢弃计数只用于日志（旧档 / 坏档的非法 slot 会被置空，这里留一条可追的痕）。
        if (s.buildGrid.dropped > 0) {
            console.warn(`[build_system] 工厂网格归一化丢弃 ${s.buildGrid.dropped} 个非法格子内容（已置空）`);
        }
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
        // [REQ-20261022-wave-loop 料闭环] 波末结算料入（冻结单 v3 §13-1 / §13-13 的消费点）：
        // M = FLOOR(basicFloorPerWave) + floor(coloredHits / perHitsPerMaterial)。本波只在这里入一次账；
        // 同一 round 由 mat_settleWaveMaterials 内部去重。
        if (typeof this.mat_settleWaveMaterials === 'function') this.mat_settleWaveMaterials();
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
        // 料账本：工坊 / 发电机 / 电池是 `cost: 0` 的料付设施，`tryPurchase` 要按料扣费。
        // 账本可能尚未初始化（读档 / 直接进整备的路径）⇒ 先按运行时既有入口建一份，不自己造形状。
        if (!this.materialLedger && typeof this.sys_initMaterialLedger === 'function') this.sys_initMaterialLedger();
        const res = tryPurchase(this.sys_getBuildState(), action, buildCfg(), this.sys_getBuildReveal(), this.materialLedger);
        if (!res.ok) {
            // `unique` 要按设施点名、`materials` 要给差额（见 purchaseFailText）；其余 reason 仍查表。
            showToast(purchaseFailText(res, action, this.materialLedger));
            return { ok: false, reason: res.reason };
        }
        this.sys_applyBuildState(res.state);
        // 扣料后的账本写回运行时（只在成交且拿到新账本时写；失败路径绝不改账本）。
        if (res.ledger) this.materialLedger = res.ledger;
        try { if (audio && typeof audio.playEffect === 'function') audio.playEffect('bump'); } catch (e) { /* 音效可缺省 */ }
        // 成功也要有事件感（2026-10-25 验收 P1-6：本分支此前只有 pulse，全分支无一句确认）。
        // 文案按动作分三种，全部用已登记的中文名；取不到名字就不编，回落成不带名字的「已建成」。
        showToast(purchaseOkText(action, res.state));
        if (typeof this.ui_renderBuildScreen === 'function') this.ui_renderBuildScreen();
        if (typeof this.ui_updateResourceHud === 'function') this.ui_updateResourceHud({ pulse: true });
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        return { ok: true, reason: null };
    },

    /**
     * @method sys_commitBuild
     * @description 「开战」：记 _buildCommittedRound 后进入战斗。
     */
    sys_commitBuild() {
        if (this.phase !== 'build') return false;
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

    /**
     * 道具使用条件（原转调「换炼成弹」守卫；该机制已下线，规则本身保留、语义逐条不变）：
     *   玩家回合、非回合开始横幅、场上无飞行子弹 / 无待发连射、且本回合还有可打的射击次数。
     */
    sys_canUseItem() {
        if (this.phase !== 'combat' || this.gameOver || this.isPaused) return false;
        if (this.isEnemyTurn || this._roundStartBannerActive) return false;
        if ((this.projectiles || []).length > 0 || (this.burstQueue || []).length > 0) return false;
        return Array.isArray(this.ammoQueue) && this.ammoQueue.length > 0;
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
