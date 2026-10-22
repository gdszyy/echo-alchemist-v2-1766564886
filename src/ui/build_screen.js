/**
 * build_screen.js - [REQ-20261022-wave-loop S2 / R2] 整备界面（#phase-build）mixin。
 *
 * 一屏可见（§2 P3 / art §6.2）：⚡/💎 余额、主炮 3 轨（等级 / 价格 / 锁定）、设施位与冷却、道具位、
 * 挖矿升级（S2 只开「采集弹珠 +1」，其余显示锁定 S3）、弹匣与满匣单选卡、下一波预告、「开战」。
 * 只用 src/ui/components/* 组件 + src/styles/ui_components.css；同一份 DOM，不在侧栏间搬 DOM。
 * 图标全部是占位字形块（.ui-glyph--placeholder），等正式 24×24 像素图标替换。
 */
import { CONFIG } from '../config.js';
import { getWaveInfo } from '../utils/boss_schedule_utils.js';
import { getFacilityStats, getPrice, isActionRevealed, FACILITY_IDS, ITEM_IDS } from '../utils/build_economy_utils.js';
import { FACILITY_LABELS, ITEM_LABELS, BRANCH_LABELS } from '../build_system.js';
import { el, append } from './components/_dom.js';
import { createPanel } from './components/panel.js';
import { createButton } from './components/button.js';
import { createPriceTag } from './components/price_tag.js';
import { createUpgradeTrack } from './components/upgrade_track.js';
import { createSlotCard, createGlyphTile } from './components/slot_card.js';
import { createResourcePill } from './components/resource_pill.js';
import { createModal } from './components/modal.js';

/** 占位字形（PLACEHOLDER：正式像素图标到位后替换）与元素色底。 */
export const BUILD_GLYPHS = {
    dmg: ['伤', 'fire'], rate: ['速', 'bolt'], bounce: ['弹', 'echo'],
    turret: ['炮', 'fire'], lightning: ['雷', 'bolt'], frost: ['冰', 'ice'], shieldGen: ['盾', 'ice'], collector: ['金', 'energy'],
    bomb: ['爆', 'fire'], timestop: ['停', 'echo'], shield: ['护', 'ice'], extraDig: ['挖', 'energy'],
    mining: ['矿', 'energy'],
    pierce: ['穿', 'laser'], scatter: ['散', 'poison'], fire: ['火', 'fire'], ice: ['冰', 'ice'], branchLightning: ['雷', 'bolt'],
};

const FACILITY_DESC = {
    turret: lv => `每回合打最前 1 个敌人 ${lv.dmg}`,
    lightning: lv => `连锁 ${lv.targets} 个敌人，各 ${lv.dmg}`,
    frost: lv => `冻结前排血最高的 ${lv.count} 个`,
    shieldGen: lv => `+1 护盾（上限 ${lv.cap}）`,
    collector: lv => `每次挖掘 +${lv.perDig}⚡（全局 1 座）`,
};
const ITEM_DESC = {
    bomb: c => `最前敌人附近 ${c.radius}px 内各 ${c.dmg} 伤害`,
    timestop: () => '本回合敌人不下压、不补行',
    shield: c => `护盾 +${c.amount}`,
    extraDig: c => `下次挖掘采集弹珠 +${c.collectors}`,
};

function cfg() {
    return (CONFIG.gameplay && CONFIG.gameplay.build) || {};
}

/** 某个解锁键在第几波 / Boss 后解锁，用于锁定文案。 */
function unlockLabel(key) {
    const table = cfg().reveal || {};
    for (const [k, list] of Object.entries(table)) {
        if (!Array.isArray(list) || !list.includes(key)) continue;
        const m = /^boss(\d+)$/.exec(k);
        return m ? `Boss${m[1] === '1' ? '' : ` ×${m[1]}`}后` : `第${k}波`;
    }
    return '未开放';
}

function glyph(key) {
    const g = BUILD_GLYPHS[key] || ['?', ''];
    return { glyph: g[0], element: g[1] };
}

export const build_screen_system = {
    /**
     * @method ui_renderBuildScreen
     * @description 重绘整备界面（每次购买 / 满匣处理后调用）。保留滚动位置。
     */
    ui_renderBuildScreen() {
        if (typeof document === 'undefined') return;
        const root = document.getElementById('build-screen-root');
        if (!root) return;
        const scroller = root.querySelector('.build-scroll');
        const scrollTop = scroller ? scroller.scrollTop : 0;
        root.innerHTML = '';

        const state = this.sys_getBuildState();
        const reveal = this.sys_getBuildReveal();
        const have = { energy: Math.floor(state.energy), crystal: state.crystal };
        const buy = action => () => this.sys_buildPurchase(action);
        const priceOf = action => getPrice(state, action, cfg());
        const revealed = action => isActionRevealed(action, reveal);

        // ---------- 头部：标题 + 余额 + 下一波预告 ----------
        const head = el('header', 'build-head');
        const info = getWaveInfo(this, CONFIG.balance?.waveCycle?.normalWavesPerBoss);
        append(head, el('h2', 'build-head__title', { text: `整备 · 第 ${this.digCount || 1} 波` }));
        const pills = el('div', 'build-head__pills');
        append(pills, createResourcePill({ kind: 'energy', value: state.energy, id: 'build-energy' }),
            createResourcePill({ kind: 'crystal', value: state.crystal, id: 'build-crystal' }));
        head.appendChild(pills);
        const foes = (this.enemies || []).filter(e => e && e.active && !e.isDead && e.hp > 0);
        const hasBoss = info.isBossWave || foes.some(e => e.type === 'boss') || !!this._pendingBossSpawn;
        const elites = foes.filter(e => e.type !== 'boss' && Array.isArray(e.affixes) && e.affixes.length >= 2).length;
        append(head, el('div', `build-head__wave${hasBoss ? ' is-boss' : ''}`, {
            id: 'build-wave-preview',
            text: hasBoss ? `下一波：Boss · 敌 ${foes.length}` : `下一波：敌 ${foes.length}${elites ? ` · 精英 ${elites}` : ''}${info.wavesUntilBoss === 1 ? ' · 再下一波 Boss' : ''}`,
        }));
        root.appendChild(head);

        const scroll = el('div', 'build-scroll');
        root.appendChild(scroll);

        // ---------- 主炮 ----------
        const stats = this.sys_getCannonStats();
        const cc = cfg().cannon || {};
        const tracks = [
            { track: 'dmg', label: '伤害', value: `单发 ${stats.damage}`, max: (cc.damagePrices || []).length },
            { track: 'rate', label: '射速', value: `${stats.shots} 发/回合`, max: (cc.ratePrices || []).length },
            { track: 'bounce', label: '弹道', value: `反弹 ${stats.bounce}`, max: (cc.bouncePrices || []).length },
        ].map(t => {
            const action = { type: 'cannon', track: t.track };
            const locked = !revealed(action);
            return createUpgradeTrack({
                ...glyph(t.track), icon: glyph(t.track).glyph,
                label: t.label, value: t.value, level: state.cannonLevels[t.track], max: t.max,
                price: priceOf(action), have, locked, lockedText: unlockLabel(t.track),
                onBuy: buy(action), id: `build-cannon-${t.track}`,
            });
        });
        const branchRow = el('div', 'build-branch');
        if (state.cannonBranch) {
            append(branchRow, el('span', 'build-branch__chosen', { text: `分支：${BRANCH_LABELS[state.cannonBranch] || state.cannonBranch}` }));
        } else if (!revealed({ type: 'branch' })) {
            append(branchRow, el('span', 'build-branch__locked', { text: `分支：${unlockLabel('branch')}解锁（1💎 三选一，选定不可换）` }));
        } else {
            append(branchRow, el('span', 'build-branch__label', { text: '分支（1💎，选定不可换）' }));
            const opts = el('div', 'build-branch__opts');
            (cc.branches || []).forEach(b => {
                const action = { type: 'branch', branch: b };
                const p = priceOf(action);
                const g = glyph(b === 'lightning' ? 'branchLightning' : b);
                append(opts, createButton({
                    variant: 'default', className: 'build-branch__btn',
                    disabled: !p || state.crystal < p.crystal,
                    title: `主炮分支：${BRANCH_LABELS[b]}`,
                    children: [createGlyphTile({ ...g, size: 'hud' }), el('span', 'ui-btn__label', { text: BRANCH_LABELS[b] })],
                    onClick: buy(action), dataset: { buy: `branch-${b}` },
                }));
            });
            branchRow.appendChild(opts);
        }
        scroll.appendChild(createPanel({ title: '主炮', hint: '无限弹药 · 限射速', children: [...tracks, branchRow], id: 'build-cannon' }));

        // ---------- 设施 ----------
        const facPanelChildren = [];
        const slotsRevealed = revealed({ type: 'slot' });
        if (!slotsRevealed) {
            facPanelChildren.push(el('p', 'build-locked-note', { text: `设施位：${unlockLabel('slots')}解锁` }));
        } else {
            const grid = el('div', 'build-slots');
            const pulse = (this._facilityPulse && Array.isArray(this._facilityPulse.slots)) ? this._facilityPulse.slots : [];
            state.facilities.forEach((f, i) => {
                if (i >= state.facilitySlotsOpen) {
                    const action = { type: 'slot' };
                    const p = priceOf(action);
                    const canOpen = i === state.facilitySlotsOpen && !!p;
                    grid.appendChild(createSlotCard({
                        state: 'locked', glyph: '锁', title: `设施位 ${i + 1}`, slotIndex: i,
                        actions: canOpen ? [createButton({
                            variant: state.crystal >= p.crystal ? 'default' : 'ghost', className: 'build-slot__btn',
                            disabled: state.crystal < p.crystal, title: '开放设施位',
                            children: [el('span', 'ui-btn__label', { text: '开位' }), createPriceTag({ crystal: p.crystal, haveCrystal: state.crystal })],
                            onClick: buy(action), dataset: { buy: `slot-${i}` },
                        })] : [],
                    }));
                    return;
                }
                if (!f) {
                    grid.appendChild(createSlotCard({
                        state: 'empty', glyph: '+', title: '空位', slotIndex: i,
                        actions: [createButton({
                            label: '建造', variant: 'default', className: 'build-slot__btn',
                            onClick: () => this.ui_openFacilityPicker(i), dataset: { buy: `build-${i}` },
                        })],
                    }));
                    return;
                }
                const lv = getFacilityStats(f.type, f.level, cfg());
                const up = { type: 'upgrade', slot: i };
                const p = priceOf(up);
                grid.appendChild(createSlotCard({
                    state: 'built', ...glyph(f.type), title: FACILITY_LABELS[f.type] || f.type, level: f.level,
                    cooldown: lv.cooldown ? Math.max(0, f.cd) : null, cooldownMax: lv.cooldown, slotIndex: i,
                    pulse: pulse.includes(i),
                    footer: el('span', 'ui-slot__desc', { text: FACILITY_DESC[f.type] ? FACILITY_DESC[f.type](lv) : '' }),
                    actions: [createButton({
                        variant: p && have.energy >= p.energy && have.crystal >= p.crystal ? 'default' : 'ghost',
                        className: 'build-slot__btn',
                        disabled: !p || have.energy < p.energy || have.crystal < p.crystal,
                        title: p ? `升到 Lv${f.level + 1}` : '已满级',
                        children: p ? [el('span', 'ui-btn__label', { text: '升级' }), createPriceTag({ energy: p.energy, crystal: p.crystal, haveEnergy: have.energy, haveCrystal: have.crystal })] : [createPriceTag({ text: '已满' })],
                        onClick: buy(up), dataset: { buy: `upgrade-${i}` },
                    })],
                }));
            });
            facPanelChildren.push(grid);
        }
        scroll.appendChild(createPanel({ title: '设施', hint: '敌人回合前按冷却自动触发', children: facPanelChildren, id: 'build-facilities' }));

        // ---------- 道具 ----------
        const itemsCfg = cfg().items || {};
        const itemChildren = [];
        if (!reveal.has('items')) {
            itemChildren.push(el('p', 'build-locked-note', { text: `道具位：${unlockLabel('items')}解锁` }));
        } else {
            const owned = el('div', 'build-items-owned');
            for (let i = 0; i < (itemsCfg.slots || 2); i++) {
                const id = state.items[i];
                owned.appendChild(createSlotCard({
                    state: id ? 'built' : 'empty', ...(id ? glyph(id) : { glyph: '·' }), size: 'hud',
                    title: id ? ITEM_LABELS[id] : '空道具位', slotIndex: i,
                }));
            }
            itemChildren.push(owned);
            const shop = el('div', 'build-items-shop');
            ITEM_IDS.forEach(id => {
                const action = { type: 'item', item: id };
                const locked = !revealed(action);
                const p = priceOf(action);
                const full = state.items.length >= (itemsCfg.slots || 2);
                shop.appendChild(createButton({
                    variant: locked || full || !p || have.energy < p.energy ? 'ghost' : 'default',
                    className: 'build-item-btn',
                    disabled: locked || full || !p || have.energy < p.energy,
                    title: locked ? `${unlockLabel(id)}解锁` : (ITEM_DESC[id] ? ITEM_DESC[id](itemsCfg[id] || {}) : ''),
                    children: [
                        createGlyphTile({ ...(locked ? { glyph: '?' } : glyph(id)), size: 'hud' }),
                        el('span', 'ui-btn__label', { text: ITEM_LABELS[id] }),
                        locked ? createPriceTag({ text: unlockLabel(id) }) : createPriceTag({ energy: p ? p.energy : 0, haveEnergy: have.energy }),
                    ],
                    onClick: buy(action), dataset: { buy: `item-${id}` },
                }));
            });
            itemChildren.push(shop);
        }
        scroll.appendChild(createPanel({ title: '道具', hint: '一次性 · 战斗中使用', children: itemChildren, id: 'build-items' }));

        // ---------- 挖矿升级 ----------
        const miningAction = { type: 'mining', key: 'collector' };
        const miningLocked = !revealed(miningAction);
        const miningRows = [createUpgradeTrack({
            ...glyph('mining'), icon: glyph('mining').glyph,
            label: '采集弹珠 +1', value: `${((CONFIG.gameplay.dig && CONFIG.gameplay.dig.collectorCount) || 5) + (state.miningLevels.collector || 0)} 颗/次`,
            level: state.miningLevels.collector || 0, max: ((cfg().mining && cfg().mining.collector && cfg().mining.collector.prices) || []).length,
            price: priceOf(miningAction), have, locked: miningLocked, lockedText: unlockLabel('mining'),
            onBuy: buy(miningAction), id: 'build-mining-collector',
        })];
        // 其余 3 项挖矿升级（§6）留 S3：只占一行锁定说明，不占三条轨
        miningRows.push(el('p', 'build-locked-note', { text: '宽口能量桶 · 磁力钉 · 咽喉加宽：S3 开放' }));
        scroll.appendChild(createPanel({ title: '挖矿', hint: '投资后期', children: miningRows, id: 'build-mining' }));

        // ---------- 弹匣 ----------
        const magCap = (CONFIG.gameplay.alchemy && CONFIG.gameplay.alchemy.magazineCap) || 3;
        const mag = Array.isArray(this.alchemyMagazine) ? this.alchemyMagazine : [];
        const magRow = el('div', 'build-mag');
        for (let i = 0; i < magCap; i++) {
            const r = mag[i];
            magRow.appendChild(el('span', `build-mag__slot${r ? ' is-full' : ''}`, {
                text: r && typeof this._hud_formatAlchemyLabel === 'function' ? this._hud_formatAlchemyLabel(r) : '空',
            }));
        }
        const magChildren = [magRow];
        if (this._pendingAlchemyOverflow) {
            magChildren.push(createButton({
                label: '弹匣已满：处理新炼成弹', variant: 'danger', className: 'build-mag__resolve',
                onClick: () => this.ui_renderBuildScreen(),
            }));
        }
        scroll.appendChild(createPanel({ title: '炼成弹匣', hint: `上限 ${magCap} · 战斗中可替换下一发主炮`, children: magChildren, id: 'build-magazine' }));

        // ---------- 底部：开战 ----------
        const foot = el('footer', 'build-foot');
        foot.appendChild(createButton({
            id: 'build-fight-btn', label: '开战', variant: 'primary', className: 'build-fight',
            disabled: !!this._pendingAlchemyOverflow,
            title: this._pendingAlchemyOverflow ? '先处理满匣' : '提交整备，进入战斗',
            onClick: () => this.sys_commitBuild(),
        }));
        root.appendChild(foot);

        // ---------- 满匣单选卡（§5.3） ----------
        if (this._pendingAlchemyOverflow) {
            const fmt = r => (typeof this._hud_formatAlchemyLabel === 'function' ? this._hud_formatAlchemyLabel(r) : String(r.damage || ''));
            const actions = mag.map((r, i) => createButton({
                label: `替换第 ${i + 1} 发`, sub: fmt(r), variant: 'default', className: 'build-overflow__btn',
                onClick: () => this.sys_resolveAlchemyOverflow({ replace: i }), dataset: { overflow: String(i) },
            }));
            actions.push(createButton({
                label: '丢弃新弹', variant: 'ghost', className: 'build-overflow__btn',
                onClick: () => this.sys_resolveAlchemyOverflow('discard'), dataset: { overflow: 'discard' },
            }));
            root.appendChild(createModal({
                id: 'build-overflow-modal', title: '弹匣已满',
                body: [el('p', '', { text: `新炼成弹：${fmt(this._pendingAlchemyOverflow)}。替换哪一发，或丢弃新弹？` })],
                actions,
            }));
        }

        const newScroll = root.querySelector('.build-scroll');
        if (newScroll) newScroll.scrollTop = scrollTop;
    },

    /**
     * @method ui_openFacilityPicker
     * @description 空设施位「建造」→ 选择设施的弹层（未解锁项显示解锁时机）。
     */
    ui_openFacilityPicker(slot) {
        const root = document.getElementById('build-screen-root');
        if (!root) return;
        const old = document.getElementById('build-facility-picker');
        if (old) old.remove();
        const state = this.sys_getBuildState();
        const reveal = this.sys_getBuildReveal();
        const close = () => { const m = document.getElementById('build-facility-picker'); if (m) m.remove(); };
        const list = FACILITY_IDS.map(type => {
            const action = { type: 'build', slot, facility: type };
            const locked = !isActionRevealed(action, reveal);
            const p = getPrice(state, action, cfg());
            const unique = type === 'collector' && state.facilities.some(f => f && f.type === 'collector');
            const lv = getFacilityStats(type, 1, cfg());
            const ok = !locked && !unique && p && state.energy >= p.energy;
            return createButton({
                variant: ok ? 'default' : 'ghost', className: 'build-picker__btn', disabled: !ok,
                title: locked ? `${unlockLabel(type)}解锁` : (unique ? '全局只能建 1 座' : ''),
                children: [
                    createGlyphTile(locked ? { glyph: '?' } : glyph(type)),
                    el('span', 'build-picker__text', {}),
                    locked ? createPriceTag({ text: unlockLabel(type) }) : createPriceTag({ energy: p ? p.energy : 0, haveEnergy: state.energy }),
                ],
                onClick: () => { close(); this.sys_buildPurchase(action); },
                dataset: { facility: type },
            });
        });
        list.forEach((btn, i) => {
            const type = FACILITY_IDS[i];
            const text = btn.querySelector('.build-picker__text');
            const lv = getFacilityStats(type, 1, cfg());
            append(text, el('b', '', { text: FACILITY_LABELS[type] }),
                el('small', '', { text: `${FACILITY_DESC[type](lv)}${lv.cooldown ? ` · 冷却 ${lv.cooldown}` : ''}` }));
        });
        root.appendChild(createModal({
            id: 'build-facility-picker', title: `建造设施 · 位 ${slot + 1}`,
            body: list,
            actions: [createButton({ label: '取消', variant: 'ghost', onClick: close })],
        }));
    },
};
