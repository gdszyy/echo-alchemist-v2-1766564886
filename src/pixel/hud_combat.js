/**
 * src/pixel/hud_combat.js — 像素模式局内 HUD（画布即时绘制，每帧直读游戏状态）
 *
 * 信息层级见 docs/design/pixel_art_mode.md §4：
 * - 顶栏（研磨 + 战斗）：回合 · 首领倒计时 · 商人 | 碎片 · 屏障（实时）· 倍速 · 暂停
 * - 战斗底部左：本发子弹（基础伤害、多重射击、属性与层数）+ 后续两发 + 剩余发数
 * - 战斗底部右：SP（显示容量）+ 下一点充能条 + 技能键（消耗晶）+ 药剂键（装药）
 * 可点区域登记到 hotspots，由 hud_hotspots.js 生成透明 DOM 按钮（键盘焦点 / 无障碍 / 复用原处理函数）。
 * @module pixel/hud_combat
 */
import { CONFIG, BOSS_DB, ENEMY_CURVE_CONFIG } from '../config.js';
import { getBossPreviewInfo, getBossShortName, normalizeBossKey } from '../utils/boss_schedule_utils.js';
import { getAmmoReadabilityProfile } from '../utils/ammo_readability.js';
import { RAMPS, INK, UI } from './palette.js';
import { getIcon, getAttributeIcon, ATTRIBUTE_STYLE, attributeColor } from './icons.js';
import { getPixelTextCanvas, measurePixelText } from './pixel_font.js';
import { stonePanel, insetWell, brassButton, bar, img, label, rect } from './hud_kit.js';
import { syncHotspots } from './hud_hotspots.js';

/** 顶栏高度（CSS 像素）。sys_resize 用它计算战斗网格顶部，二者必须一致。 */
export const PIXEL_HUD_TOP_CSS = 30;

const S = RAMPS.slate;

function num(g, text, x, y, color, o = {}) {
    const c = getPixelTextCanvas(String(text), { font: o.font || '5x7', color, outline: o.outline === undefined ? INK : o.outline });
    const scale = o.scale || 1;
    const w = c.width * scale;
    let px = x;
    if (o.align === 'right') px -= w;
    else if (o.align === 'center') px -= w >> 1;
    g.drawImage(c, px | 0, y | 0, w, c.height * scale);
    return w;
}

function bossThreat(game) {
    const active = (game.enemies || []).find((e) => e && !e.isDead && e.hp > 0 && e.type === 'boss');
    if (active) {
        const id = normalizeBossKey(active.bossType || active.bossId || active.id);
        return {
            state: 'active',
            text: getBossShortName(id, CONFIG.balance?.bossConfigs, BOSS_DB) || '首领',
            ratio: active.maxHp > 0 ? Math.max(0, Math.min(1, active.hp / active.maxHp)) : 1,
            hp: Math.ceil(active.hp),
        };
    }
    let info = null;
    try { info = getBossPreviewInfo(game, ENEMY_CURVE_CONFIG); } catch (_) { info = null; }
    if (!info) return null;
    const turns = Math.max(0, info.turnsUntil | 0);
    return { state: turns <= 1 ? 'soon' : 'countdown', turns };
}

// ─── 顶栏 ────────────────────────────────────────────────────

function drawTopBar(game, g, W, topH, hot) {
    stonePanel(g, -1, -1, W + 2, topH + 1);
    const cy = ((topH - 9) >> 1) + 0;
    let x = 4;
    // 回合
    x += label(g, '回合', x, cy - 2, UI.textSub);
    x += 2;
    x += num(g, game.round || 1, x, cy + 1, UI.textGold);
    x += 6;
    // 首领倒计时
    const th = bossThreat(game);
    if (th) {
        const danger = th.state !== 'countdown';
        const x0 = x;
        img(g, getIcon('crown', danger ? 'blood' : 'brass'), x, cy);
        x += 10;
        if (th.state === 'active') {
            // 交战中：首领名 + 血条（首领没有独立血条的老问题在这里补上）
            x += label(g, th.text, x, cy - 2, RAMPS.blood[5]) + 3;
            bar(g, x, cy + 2, 40, 5, th.ratio, 'blood');
            x += 42;
        } else {
            const nw = num(g, th.turns, x, cy + 1, danger ? RAMPS.blood[5] : UI.textMain);
            x += nw + 1;
            x += label(g, '回合', x, cy - 2, UI.textDim);
        }
        hot.push({ id: 'boss', x: x0, y: 0, w: x - x0, h: topH, label: th.state === 'active' ? `首领交战中：${th.text}` : `${th.turns} 回合后首领登场`, info: true });
        x += 6;
    }
    // 商人
    let shop = null;
    try { shop = typeof game.sys_getRunShopScheduleState === 'function' ? game.sys_getRunShopScheduleState() : null; } catch (_) { shop = null; }
    if (shop && !shop.hidden) {
        if (shop.isActive) {
            const c = brassButton(g, x, 2, 22, topH - 4, 'active');
            img(g, getIcon('bag', 'brass'), c.x + 2, c.y + ((c.h - 9) >> 1));
            num(g, shop.remainingRounds || 1, c.x + 13, c.y + ((c.h - 5) >> 1), UI.textMain, { font: '3x5' });
            hot.push({ id: 'shop', x, y: 2, w: 22, h: topH - 4, label: `商人已到访，${shop.remainingRounds || 1} 回合后离开，点击进入商店`, target: '#run-shop-status-open' });
            x += 24;
        } else {
            img(g, getIcon('bag', 'slate', { dim: true }), x, cy);
            x += 10;
            x += num(g, shop.roundsUntilArrival, x, cy + 1, UI.textSub);
            hot.push({ id: 'shopinfo', x: x - 16, y: 0, w: 16, h: topH, label: `商人 ${shop.roundsUntilArrival} 回合后到访`, info: true });
        }
    }

    // 右侧：暂停、倍速、屏障、碎片
    let rx = W - 2;
    const bh = topH - 4;
    rx -= bh;
    const pc = brassButton(g, rx, 2, bh, bh, 'normal');
    img(g, getIcon('pause', 'slate', { outline: false }), pc.x + ((pc.w - 7) >> 1), pc.y + ((pc.h - 7) >> 1));
    hot.push({ id: 'pause', x: rx, y: 2, w: bh, h: bh, label: '暂停与设置', target: '#settings-btn' });
    rx -= 2;
    const speed = game.baseTimeScale || 1;
    const speedText = speed === 0.42 ? '1/2' : `${Math.round(speed)}x`;
    const sw = Math.max(bh, measurePixelText(speedText, '3x5').w + 8);
    rx -= sw;
    const sc = brassButton(g, rx, 2, sw, bh, speed !== 1 ? 'active' : 'normal');
    num(g, speedText, sc.x + (sc.w >> 1), sc.y + ((sc.h - 5) >> 1), UI.textMain, { font: '3x5', outline: null, align: 'center' });
    hot.push({ id: 'speed', x: rx, y: 2, w: sw, h: bh, label: `当前速度 ${speedText}，点击切换`, target: '#speed-btn' });
    rx -= 5;
    // 屏障（实时）
    const shield = Math.max(0, game.playerShield | 0);
    const sTxt = String(shield);
    const sTw = measurePixelText(sTxt).w + 2;
    rx -= sTw;
    num(g, sTxt, rx, cy + 1, shield > 0 ? RAMPS.ice[5] : UI.textDim);
    rx -= 11;
    img(g, getIcon('shield', shield > 0 ? 'ice' : 'slate', { dim: shield <= 0 }), rx, cy);
    hot.push({ id: 'barrier', x: rx, y: 0, w: sTw + 11, h: topH, label: `屏障 ${shield} 层：敌人触碰防线时消耗`, info: true });
    rx -= 5;
    // 局内碎片
    const frags = Math.max(0, Math.floor(game.runFragments || 0));
    const fTxt = String(frags);
    const fTw = measurePixelText(fTxt).w + 2;
    rx -= fTw;
    num(g, fTxt, rx, cy + 1, RAMPS.fire[5]);
    rx -= 11;
    img(g, getIcon('shard', 'fire'), rx, cy);
    hot.push({ id: 'frags', x: rx, y: 0, w: fTw + 11, h: topH, label: `局内碎片 ${frags}（仅本局，在商人处使用）`, info: true });
}

// ─── 战斗底部 ─────────────────────────────────────────────────

function ammoPrimaryRamp(recipe) {
    const p = getAmmoReadabilityProfile(recipe);
    const key = p.primary && p.primary.key;
    return (ATTRIBUTE_STYLE[key] && ATTRIBUTE_STYLE[key].ramp) || 'slate';
}

function drawAmmoOrb(g, x, y, r, rampName) {
    const R = RAMPS[rampName] || S;
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const d = dx * dx + dy * dy;
            if (d > r * r + r * 0.8) continue;
            let c = R[Math.min(R.length - 2, 3)];
            if (d > (r - 1) * (r - 1) + (r - 1) * 0.8) c = (dx + dy) < 0 ? R[Math.min(R.length - 1, 4)] : R[1];
            else if (dx + dy < -r * 0.4) c = R[R.length - 1];
            rect(g, x + dx, y + dy, 1, 1, c);
        }
    }
}

function drawAmmoPanel(game, g, x, y, w, h, hot) {
    stonePanel(g, x, y, w, h);
    const q = Array.isArray(game.ammoQueue) ? game.ammoQueue : [];
    const cur = !game.isEnemyTurn ? q[0] : null;
    let cy = y + 3;
    label(g, game.isEnemyTurn ? '敌方行动' : '本发', x + 4, cy - 1, game.isEnemyTurn ? RAMPS.blood[5] : UI.textSub);
    if (!cur) {
        if (!game.isEnemyTurn) label(g, q.length ? '' : '弹药耗尽', x + 4, cy + 14, UI.textDim);
        return;
    }
    const p = getAmmoReadabilityProfile(cur);
    // 基础伤害（开火时加成未计入，按规范标注"基础"）
    const ix = x + 30;
    img(g, getIcon('sword', 'arcane'), ix, cy);
    const dw = num(g, p.damage, ix + 11, cy + 1, UI.textMain);
    label(g, '基础', ix + 13 + dw, cy - 1, UI.textDim);
    hot.push({ id: 'dmg', x: ix, y: cy, w: w - (ix - x) - 2, h: 10, label: `本发基础伤害 ${p.damage}（未计入遗物与词条的开火加成）`, info: true });
    cy += 13;
    // 多重射击
    const mc = Math.max(1, Math.round(p.multicastCount || 1));
    // 属性层数
    let ax = x + 4;
    const entries = p.entries || [];
    const maxChips = Math.max(1, Math.floor((w - 8) / 20));
    entries.slice(0, maxChips).forEach((e) => {
        img(g, getAttributeIcon(e.key), ax, cy);
        num(g, Math.round(e.value), ax + 10, cy + 3, attributeColor(e.key, 'light'), { font: '3x5' });
        ax += 20;
    });
    if (entries.length > maxChips) num(g, `+${entries.length - maxChips}`, ax, cy + 3, UI.textSub, { font: '3x5' });
    if (!entries.length) label(g, '无属性', ax, cy - 2, UI.textDim);
    cy += 12;
    // 后续 + 剩余
    insetWell(g, x + 3, cy, w - 6, Math.max(11, y + h - cy - 3));
    const rowY = cy + 1;
    label(g, '后续', x + 5, rowY - 1, UI.textDim);
    let ox = x + 31;
    for (let i = 1; i <= 2; i++) {
        const nx = q[i];
        if (!nx) {
            rect(g, ox - 3, rowY + 4, 7, 1, S[3]);
        } else {
            drawAmmoOrb(g, ox, rowY + 4, 3, ammoPrimaryRamp(nx));
        }
        ox += 10;
    }
    const left = q.length;
    num(g, left, x + w - 6, rowY + 1, left <= 1 ? RAMPS.blood[5] : UI.textMain, { align: 'right' });
    label(g, '剩', x + w - 8 - measurePixelText(String(left)).w - 12, rowY - 1, UI.textDim);
    if (mc > 1) {
        const t = `×${mc}`;
        num(g, t, x + w - 5, y + 3, RAMPS.volt[4], { align: 'right' });
    }
    hot.push({ id: 'queue', x: x + 3, y: cy, w: w - 6, h: 12, label: `剩余 ${left} 发弹药`, info: true });
}

function skillRamp(color) {
    // 技能色只用于选择最接近的元素色阶
    const map = { '#67e8f9': 'ice', '#a78bfa': 'arcane', '#f97316': 'fire', '#ef4444': 'blood', '#34d399': 'mint', '#4ade80': 'venom', '#facc15': 'volt', '#fbbf24': 'brass' };
    if (map[color]) return map[color];
    const c = String(color || '').toLowerCase();
    const r = parseInt(c.slice(1, 3), 16) || 0;
    const gg = parseInt(c.slice(3, 5), 16) || 0;
    const b = parseInt(c.slice(5, 7), 16) || 0;
    if (r > gg && r > b) return gg > 120 ? 'fire' : 'blood';
    if (gg > r && gg > b) return b > 150 ? 'mint' : 'venom';
    if (b > r && b > gg) return r > 120 ? 'arcane' : 'ice';
    return 'cyan';
}

function drawSkillPanel(game, g, x, y, w, h, hot) {
    stonePanel(g, x, y, w, h);
    const sp = Math.max(0, game.skillPoints | 0);
    const cap = Math.max(sp, CONFIG.gameplay.maxSkillPoints || 0, 1);
    let cy = y + 3;
    label(g, 'SP', x + 4, cy - 1, RAMPS.cyan[4]);
    // SP 晶（显示容量）
    let gx = x + 18;
    const showCap = Math.min(cap, Math.floor((w - 22) / 9));
    for (let i = 0; i < showCap; i++) {
        img(g, getIcon(i < sp ? 'gem' : 'gemEmpty', i < sp ? 'cyan' : 'slate', { outline: i < sp }), gx + (i < sp ? 0 : 1), cy + (i < sp ? 0 : 1));
        gx += 9;
    }
    if (cap > showCap) num(g, `${sp}/${cap}`, x + w - 4, cy + 2, UI.textSub, { font: '3x5', align: 'right' });
    hot.push({ id: 'sp', x: x + 2, y: cy, w: w - 4, h: 10, label: `技能点 ${sp}/${cap}`, info: true });
    cy += 11;
    // 下一点 SP 充能
    const full = sp >= cap;
    const charge = full ? 1 : Math.max(0, Math.min(1, game.skillChargeActualValue || 0));
    const temp = full ? 0 : Math.max(0, Math.min(1 - charge, game.skillChargeTempValue || 0));
    bar(g, x + 4, cy, w - 8, 4, charge, full ? 'brass' : 'cyan', { secondary: temp });
    hot.push({ id: 'charge', x: x + 4, y: cy - 1, w: w - 8, h: 6, label: full ? 'SP 已满' : `下一点 SP 充能 ${Math.round(charge * 100)}%`, info: true });
    cy += 7;
    // 技能键
    const skills = Array.isArray(game.activeSkills) ? game.activeSkills : [];
    const potionUnlocked = !!(game.potionAlchemyUnlocked || (game.ownedRelics || []).includes('relic_sage_apothecary'));
    const slots = potionUnlocked ? 3 : 4;
    const bs = Math.min(22, Math.floor((w - 8 - (slots + (potionUnlocked ? 1 : 0) - 1) * 2) / (slots + (potionUnlocked ? 1 : 0))));
    let bx = x + 4;
    const by = cy;
    const usableTurn = game.phase === 'combat' && !game.isEnemyTurn;
    skills.slice(0, slots).forEach((skill, i) => {
        const cost = Math.max(0, Number(skill.cost) || 0);
        const ok = usableTurn && sp >= cost;
        const c = brassButton(g, bx, by, bs, bs, ok ? 'normal' : 'disabled');
        const ramp = skillRamp(skill.color);
        const glyph = String(skill.name || '?').slice(0, 1);
        label(g, glyph, c.x + (c.w >> 1), c.y + ((c.h - 12) >> 1) - 1, ok ? RAMPS[ramp][RAMPS[ramp].length - 1] : UI.textDim, { align: 'center' });
        // 消耗晶（底边）
        for (let k = 0; k < Math.min(cost, 5); k++) {
            const px = c.x + 1 + k * 3;
            rect(g, px, c.y + c.h - 3, 2, 2, k < sp ? RAMPS.cyan[5] : S[3]);
        }
        const reason = ok ? '' : (game.isEnemyTurn ? '敌方行动中' : (sp < cost ? 'SP不足' : '仅战斗可用'));
        hot.push({ id: `skill${i}`, x: bx, y: by, w: bs, h: bs, label: `${skill.name}，消耗 ${cost} SP${reason ? `，不可用：${reason}` : ''}。${skill.desc || ''}`, disabled: !ok, action: () => game.combat_activateSkill(skill) });
        bx += bs + 2;
    });
    for (let i = skills.length; i < slots; i++) {
        insetWell(g, bx, by, bs, bs);
        bx += bs + 2;
    }
    if (potionUnlocked) {
        const pot = game.preparedPotionSpell;
        const charges = Math.max(0, Number(pot?.charges) || 0);
        const maxCharges = Math.max(charges, Number(pot?.maxCharges) || 0);
        const ok = usableTurn && !!pot && charges > 0;
        const c = brassButton(g, bx, by, bs, bs, ok ? 'normal' : 'disabled');
        img(g, getIcon('flask', ok ? 'rose' : 'slate', { dim: !ok }), c.x + ((c.w - 9) >> 1), c.y + 1);
        num(g, maxCharges ? `${charges}/${maxCharges}` : '0', c.x + (c.w >> 1), c.y + c.h - 6, UI.textMain, { font: '3x5', align: 'center' });
        hot.push({ id: 'potion', x: bx, y: by, w: bs, h: bs, label: pot ? `药剂，剩余 ${charges}/${maxCharges} 装药` : '药剂槽为空', disabled: !ok, action: () => game.combat_activatePotionSpell && game.combat_activatePotionSpell() });
    }
}

function drawUtilityButtons(game, g, x, y, hot) {
    // 炼金台、伤害分析：小黄铜键，挂在弹药面板左上角外侧
    const s = 14;
    let c = brassButton(g, x, y, s, s, 'normal');
    img(g, getIcon('runestone', 'arcane', { outline: false }), c.x + ((c.w - 7) >> 1), c.y + ((c.h - 7) >> 1));
    hot.push({ id: 'runes', x, y, w: s, h: s, label: '打开炼金台（符文与药剂）', target: '.combat-rune-config-btn' });
    c = brassButton(g, x, y + s + 2, s, s, 'normal');
    img(g, getIcon('chart', 'brass', { outline: false }), c.x + ((c.w - 7) >> 1), c.y + ((c.h - 7) >> 1));
    hot.push({ id: 'stats', x, y: y + s + 2, w: s, h: s, label: '伤害分析', target: '#damage-stats-btn' });
    // 技能装配：显隐沿用原按钮（combat_system 每次刷新技能池时写它的 display），原按钮所在底栏在像素模式隐藏
    const edit = typeof document !== 'undefined' ? document.getElementById('skill-editor-open-btn') : null;
    if (edit && edit.style.display !== 'none') {
        const ey = y + (s + 2) * 2;
        c = brassButton(g, x, ey, s, s, 'normal');
        img(g, getIcon('gem', 'cyan', { outline: false }), c.x + ((c.w - 7) >> 1), c.y + ((c.h - 7) >> 1));
        const count = String(edit.textContent || '').replace(/[^\d/]/g, '');
        hot.push({ id: 'skilledit', x, y: ey, w: s, h: s, label: `技能装配${count ? `（已装备 ${count}）` : ''}`, target: '#skill-editor-open-btn' });
    }
}

// ─── 研磨底部：三颗弹珠各自的收集结果 ─────────────────────────

function marbleLabel(model) {
    const type = model.marble && model.marble.type;
    const st = ATTRIBUTE_STYLE[type];
    if (st) return st.name;
    const raw = model.marble && typeof model.marble.getName === 'function' ? model.marble.getName() : '';
    return String(raw || '弹珠').replace(/弹珠|弹珠/g, '').slice(0, 3) || '弹珠';
}

function drawGatheringPanels(game, g, W, H, hot) {
    let models = [];
    try { models = typeof game._hud_getGatheringSessionViewModels === 'function' ? game._hud_getGatheringSessionViewModels() : []; } catch (_) { models = []; }
    models = models.slice(0, 3);
    if (!models.length) return;
    const gap = 3;
    const cw = Math.floor((W - 4 - gap * (models.length - 1)) / models.length);
    const ch = 46;
    const y = H - ch - 2;
    const anyActive = models.some((m) => m.active);
    if (!anyActive && !models.some((m) => m.finished)) {
        // 提示放在钉盘上方——它说的正是"点这里"
        const sy = game.pixelLayout ? game.pixelLayout.sy : 1;
        label(g, '点击这一带放出弹珠', W >> 1, Math.round(PIXEL_HUD_TOP_CSS * sy) + 3, UI.textSub, { align: 'center', outline: true });
    }
    models.forEach((m, i) => {
        const x = 2 + i * (cw + gap);
        stonePanel(g, x, y, cw, ch, { trim: m.active });
        const ramp = m.marble ? (ATTRIBUTE_STYLE[m.marble.type] ? ATTRIBUTE_STYLE[m.marble.type].ramp : 'slate') : 'slate';
        drawAmmoOrb(g, x + 7, y + 8, 3, ramp);
        const lw = label(g, `弹${i + 1}`, x + 13, y + 2, UI.textDim);
        label(g, marbleLabel(m), x + 15 + lw, y + 2, UI.textMain);
        // 收集结果：按层数合计（唯一口径）
        const counts = new Map();
        for (const item of m.collection || []) {
            const type = typeof item === 'string' ? item : (item && item.type);
            if (!type || !ATTRIBUTE_STYLE[type]) continue;
            const amount = Math.max(1, Math.floor((item && typeof item === 'object' && item.level) ? item.level : 1));
            counts.set(type, (counts.get(type) || 0) + amount);
        }
        const ay = y + 17;
        if (!counts.size) {
            label(g, '待收集', x + 5, ay - 2, UI.textDim);
        } else {
            let ax = x + 4;
            const maxChips = Math.max(1, Math.floor((cw - 8) / 19));
            const list = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
            list.slice(0, maxChips).forEach(([k, v]) => {
                img(g, getAttributeIcon(k), ax, ay);
                num(g, v, ax + 10, ay + 3, attributeColor(k, 'light'), { font: '3x5' });
                ax += 19;
            });
            if (list.length > maxChips) num(g, `+${list.length - maxChips}`, x + cw - 4, ay + 3, UI.textSub, { font: '3x5', align: 'right' });
        }
        // 多重射击进度：命中达到目标 → 本颗弹珠多发射 1 发
        const by = y + ch - 10;
        const mcText = `×${1 + (m.multicast || 0)}`;
        const mw = measurePixelText(mcText).w + 3;
        bar(g, x + 4, by + 1, cw - 10 - mw, 5, m.target > 0 ? m.currentHits / m.target : 0, 'volt');
        num(g, mcText, x + cw - 4, by, (m.multicast || 0) > 0 ? RAMPS.volt[4] : UI.textSub, { align: 'right' });
        hot.push({ id: `marble${i}`, x, y, w: cw, h: ch, label: `弹${i + 1}：${marbleLabel(m)}，命中 ${m.currentHits}/${m.target} 后多发射 1 发，当前每次发射 ${1 + (m.multicast || 0)} 发`, info: true });
    });
}

// @perf-impact: 每帧约 60–120 次 fillRect/drawImage（面板、图标、数字均缓存为小画布）；DOM 热区仅在位置或文案变化时写入。
/**
 * 每帧调用（在世界层之后）。只在研磨 / 战斗阶段绘制。
 */
export function drawPixelHud(game, ctx) {
    const phase = game.phase;
    if (phase !== 'combat' && phase !== 'gathering') {
        syncHotspots(game, []);
        return;
    }
    const W = game.canvas.width;
    const H = game.canvas.height;
    const sy = game.pixelLayout ? game.pixelLayout.sy : 1;
    const topH = Math.round(PIXEL_HUD_TOP_CSS * sy);
    const hot = [];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    drawTopBar(game, ctx, W, topH, hot);
    if (phase === 'gathering') drawGatheringPanels(game, ctx, W, H, hot);
    if (phase === 'combat') {
        const dockTop = Math.round(((game.defeatLineY || (game.height - 120)) + 6) * sy);
        const launcherX = W >> 1;
        const gap = Math.round(36 * game.pixelLayout.sx);
        const leftW = launcherX - gap - 2;
        const rightX = launcherX + gap;
        const panelH = H - dockTop - 2;
        drawAmmoPanel(game, ctx, 2, dockTop, leftW, panelH, hot);
        drawSkillPanel(game, ctx, rightX, dockTop, W - rightX - 2, panelH, hot);
        drawUtilityButtons(game, ctx, leftW + 4, dockTop + 2, hot);
    }
    ctx.restore();
    syncHotspots(game, hot);
}
