/**
 * wave_ammo.js - [REQ-20261022-wave-loop · 经济接线 v2 步 8] 整备屏「本波弹药」面板的渲染件。
 *
 * 四块信息（订正件 §C-3 第 8 步：发数 N + 四条上限 A/U/E/M + 卡在哪条 + 每料余额 + 配方选择行）：
 *   ① 现有料（三色）② 本波发数（N + 四上限 + 一句绑定原因 + 断电/干回合提示）
 *   ③ 弹药配方（逐条 displayName / 单发成本 / 够打几发 / 选中态 / 锁定态；**无倍率**）④ **本波将扣料**（开战时才从库存扣走）
 *
 * 约束：只读 src/styles/ui_tokens.css 的变量与既有 .ui-* / .build-* 类，**不新增配色、不新增样式文件**
 *   （步 8 的写权限只有 src/ui/ 下的组件文件，css 归另一线）；数字一律来自调用方传入的运行时读数或配置，
 *   本文件不含任何配方数值。组件无全局状态、不读 Game 实例，事件回调由 props 传入（同 components/ 其余件）。
 */
import { el, append } from './_dom.js';
import { createGlyphTile } from './slot_card.js';
import { createButton } from './button.js';
import { createPriceTag } from './price_tag.js';
import { createPanel } from './panel.js';
import { MATERIAL_LABELS, materialLabel } from '../../utils/shot_recipe_utils.js';

/** 断电文案：第 4 步已定死（`src/utils/workshop_capacity_utils.js:325` 逐字），不许改字。 */
export const UNPOWERED_WORKSHOP_TEXT = '弹药工坊断电（本波不造弹）';
/** 未建造文案：没建工坊就谈不上断电（`detail.U === null` / `workshopBuilt === false`）。 */
export const UNBUILT_WORKSHOP_TEXT = '弹药工坊未建造（本波靠料）';
/** 四上限格里「该轴不参与取最小」的显示词：**不是 0**（0 是真实上限，必须照原样显示）。 */
export const UNBUILT_LIMIT_TEXT = '未建造';
/** 预演不可用占位（第 6 步的 `sys_getWavePreview` 缺失 / 抛错 / 返回空时显示）。 */
export const PREVIEW_UNAVAILABLE_TEXT = '预演不可用';
/** 干回合提示：本波不挖料，发数沿用上一波。 */
export const DRY_WAVE_TEXT = '本波不挖料，沿用上波发数';
/** 三色料的显示口径（键名与账本 / 存档字段同名，见 `material_economy_utils.MATERIAL_KEYS`）。
 *  `label` 一律取自 `shot_recipe_utils.MATERIAL_LABELS`（屏上中文名的唯一真源），此处不写字面量。 */
export const MATERIAL_VIEWS = [
    { key: 'pyro', label: MATERIAL_LABELS.pyro, glyph: '火', element: 'fire' },
    { key: 'cryo', label: MATERIAL_LABELS.cryo, glyph: '冰', element: 'ice' },
    { key: 'beast', label: MATERIAL_LABELS.beast, glyph: '兽', element: 'bolt' },
];
/** 四条上限的显示口径（顺序恒为 A/U/E/M，与预演契约 `bound` 的取值一致）。 */
export const LIMIT_VIEWS = [
    { key: 'A', label: '射速' },
    { key: 'U', label: '产能' },
    { key: 'E', label: '电力' },
    { key: 'M', label: '料' },
];

/** 非负整数化：`0` / `null` / `undefined` / `NaN` / 负数 一律给 0（屏上不许出现 NaN / undefined）。 */
export function toCount(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 倍率显示函数已于 2026-10-25 删除（与配方字段 `damageMult` 一起）。
 * 原 `formatMultiplier(damageMult)` 把「×倍率」画在配方行上，而战斗侧从未读该字段——
 * 多付 1 料不加伤，屏上写 ×N 就是说谎（`docs\review\gameplay-20261025.md` C-1）。
 * 料只决定「打几发」，**屏上不许再出现任何单发倍率**。
 */

/**
 * 一条上限值的显示三态（**`null` 不许当 0**）：
 *   - 显式 `null` / 缺键 / `undefined` / `NaN` ⇒ `{ built:false, text:'未建造' }`——该轴不参与本波取最小；
 *   - 真数字（**含 0**）⇒ `{ built:true, text:'0' }`——已建造但为 0（如断电），是真实上限，必须照原样显示。
 * 这两种状态在屏上必须可区分：把 null 兜成 0 会出现「产能 0、电力 0，却还能打 1 发」这种自相矛盾的屏。
 * @param {*} value - 预演 `detail[axis]`
 * @returns {{ built:boolean, text:string, value:(number|null) }}
 */
export function toLimitDisplay(value) {
    if (value === null || value === undefined) return { built: false, text: UNBUILT_LIMIT_TEXT, value: null };
    const n = Number(value);
    if (!Number.isFinite(n)) return { built: false, text: UNBUILT_LIMIT_TEXT, value: null };
    const clamped = Math.max(0, Math.floor(n));
    return { built: true, text: String(clamped), value: clamped };
}

/**
 * 工坊状态三态（「未建造」与「断电」是两件事，不许说错）：
 *   ① 明确未建造 ⇒ `弹药工坊未建造（本波靠料）`；
 *   ② 已建造但断电 ⇒ 第 4 步定死的 `弹药工坊断电（本波不造弹）`（逐字）；
 *   ③ 已建造且通电 ⇒ 不给任何工坊提示（返回空文案）。
 * 判定顺序：`workshopBuilt`（专字段，优先）→ 缺失时用 `detail.U === null` 推断未建造 →
 * 两者都拿不到 ⇒ `unknown` + 空文案（**宁可不说，也不许说错**）。
 * @param {{ workshopBuilt:(boolean|undefined), powered:(boolean|undefined), detailU:* }} props
 * @returns {{ kind:'unbuilt'|'unpowered'|'ok'|'unknown', text:string }}
 */
export function describeWorkshopStatus({ workshopBuilt, powered = true, detailU } = {}) {
    let built = typeof workshopBuilt === 'boolean' ? workshopBuilt : null;
    if (built === null) {
        if (detailU === null) built = false;                 // U 上限不参与取最小 ⇒ 本波没有工坊
        else if (Number.isFinite(Number(detailU)) && detailU !== undefined) built = true;
    }
    if (built === null) return { kind: 'unknown', text: '' };
    if (built === false) return { kind: 'unbuilt', text: UNBUILT_WORKSHOP_TEXT };
    return powered === false ? { kind: 'unpowered', text: UNPOWERED_WORKSHOP_TEXT } : { kind: 'ok', text: '' };
}

/**
 * 把「缺哪几桶料」统一成人话：`缺 火料 4、冰料 1`。
 * 两种入参都收（调用方有明细就给明细，只有键名时至少翻成中文）：
 *   - `{key,label,lock}` 明细（`shot_recipe_utils.describeMaterialShortfall` 的返回）⇒ 带差额；
 *   - 裸键名 `'pyro'` ⇒ 翻成「火料」、不带数字（**绝不把 `pyro` 这种键名打到屏上**）。
 * 空 / 非法项直接丢掉，不产生「缺 」这种半句话。
 */
function normalizeMissing(missing) {
    const list = Array.isArray(missing) ? missing : [];
    const parts = [];
    list.forEach(item => {
        if (typeof item === 'string') {
            if (item) parts.push(materialLabel(item));
            return;
        }
        if (!item || typeof item !== 'object') return;
        const key = typeof item.key === 'string' ? item.key : '';
        if (!key) return;
        const label = typeof item.label === 'string' && item.label ? item.label : materialLabel(key);
        const lack = Math.max(0, Math.floor(Number(item.lack) || 0));
        parts.push(lack > 0 ? `${label} ${lack}` : label);
    });
    return parts.length ? `缺 ${parts.join('、')}` : '';
}

/**
 * 「建弹药工坊能多打几发」的追加子句——**只在真能改善时返回非空**（`after > 当前发数`）。
 * 这是组件侧的最后一道闸：调用方已判过「未建造 + 付得起 + 建完真的更多」，这里再按
 * `after > shots` 拦一次——同数还说「建了能多打」就是在骗玩家花料，宁可不给。
 * @param {*} afterShots - 建工坊后的发数（`null` / 脏值按 0）
 * @param {number} shots - 当前发数
 * @returns {string} `；建弹药工坊后可打 N 发`，或空串
 */
function workshopGainClause(afterShots, shots) {
    const after = toCount(afterShots);
    if (after <= toCount(shots)) return '';
    return `；建弹药工坊后可打 ${after} 发`;
}

/**
 * 「升一级射速轨能多打几发」的追加子句——同样**只在真能改善时返回非空**。
 * 价格缺省 / 为 0 / 升后发数不更大 ⇒ 空串（不出现「升一级（）后打」这种半句话）。
 * @param {{ shots:number, price:number }|null} gain - 升后发数与这一档的 ⚡ 价
 * @param {number} shots - 当前发数
 * @returns {string} `；升一级（N 电）后打 M 发`，或空串
 */
function rateUpgradeClause(gain, shots) {
    const after = toCount(gain && gain.shots);
    const price = toCount(gain && gain.price);
    if (!price || after <= toCount(shots)) return '';
    return `；升一级（${price} 电）后打 ${after} 发`;
}

/**
 * 「两件都做才多打」的组合子句——**单做任一件都不变、两件都做才变多**时才给
 * （2026-10-25 返工：上一批按单轴判据承诺「升一级后打 3 发」，而 A 升到 3 仍被料按在 2，
 *  玩家花 60⚡ 一发不多；见 `docs/review/build-hint-20261025.md` §7）。
 * 硬要求：**两件事都点名 + 各自代价 + 末尾发数必须是四轴取最小后的数**；料一律走中文料名，
 * 不许出现 `pyro` / `cryo` 裸键名；料价读不到（空数组）就整句不给——宁可不说，也不出半句话。
 * @param {{ shots:number, price:number, materials:Array<{key:string,need:number}> }|null} gain
 *        `shots` = 两件都做完后的发数（调用方已按 min(A+1,U,E,M) 算好）；`price` = 升一级的 ⚡ 价；
 *        `materials` = 建工坊的料价（逐项 `{key,need}`，键名只在此处翻成中文）
 * @param {number} shots - 当前发数
 * @returns {string} `；建弹药工坊（火料 4、冰料 2）再升一级射速轨（60 电），两件都做才打 3 发`，或空串
 */
function comboGainClause(gain, shots) {
    if (!gain || typeof gain !== 'object') return '';
    const after = toCount(gain.shots);
    const price = toCount(gain.price);
    if (!price || after <= toCount(shots)) return '';
    const parts = (Array.isArray(gain.materials) ? gain.materials : [])
        .map(m => (m && m.key && toCount(m.need) > 0 ? `${materialLabel(m.key)} ${toCount(m.need)}` : ''))
        .filter(Boolean);
    if (!parts.length) return '';
    return `；建弹药工坊（${parts.join('、')}）再升一级射速轨（${price} 电），两件都做才打 ${after} 发`;
}

/**
 * 一句人话解释「这一波为什么只打得出 N 发」——只给**绑定那一轴**的一句（四轴各一句话，按 `bound` 取）。
 * `A` / `M` 两句可以各带一句**改善路径**（「升一级…后打 N 发」／「建工坊后可打 N 发」），
 * 单步无效、两件组合才有效时改带**组合句**（「建工坊（料…）再升一级射速轨（⚡…），两件都做才打 N 发」）：
 *   这三类子句都由调用方判过「真的能变多」才传进来，本函数再按同一条判据拦一次；
 *   判据不成立（或调用方没传）时就退回原来那句，**一个字都不加**。
 * @param {{ bound:(string|null), shots:number, powered?:boolean, workshop?:{kind:string,text:string}|null,
 *           missing?:(Array<{key:string,label?:string,lack?:number}>|string[]),
 *           workshopGain?:(number|null), rateGain?:(null|{shots:number,price:number}),
 *           comboGain?:(null|{shots:number,price:number,materials:Array<{key:string,need:number}>}) }} props
 *        `workshop` 由 `describeWorkshopStatus` 给出；它为「未建造 / 断电」时 `U` 轴改用那两句定死文案。
 *        `missing` 给 `M` 轴用：优先收 `describeMaterialShortfall` 的明细（带差额），只给键名也认。
 *        `workshopGain` = 建工坊后的发数（由 `build_screen` 用同一个 yield 算式算好）；`rateGain` = 升一级后的
 *        发数与 ⚡ 价；`comboGain` = **两件都做**之后的发数与两项代价。三者都**只收已判定「真能改善」的值**，
 *        本函数只做格式与最后一道拦截，不重算发数。
 * @returns {string} 认不出 `bound` 时给通用句，不返回空串
 */
export function describeBindingReason({
    bound = null, shots = 0, powered = true, workshop = null, missing = [],
    workshopGain = null, rateGain = null, comboGain = null,
} = {}) {
    const n = toCount(shots);
    if (bound === 'A') return `射速轨只能打 ${n} 发${rateUpgradeClause(rateGain, n)}${comboGainClause(comboGain, n)}`;
    if (bound === 'U') {
        const status = workshop || describeWorkshopStatus({ powered });
        // 未建造 / 断电 各有定死说法；只有「已建造且通电」才回到产能句
        if (status && status.text) return status.text;
        return `弹药工坊产能只有 ${n} 发`;
    }
    if (bound === 'E') return `电力只够打 ${n} 发`;
    if (bound === 'M') {
        const lack = normalizeMissing(missing);
        return `料只够装 ${n} 发${lack.length ? `（${lack}）` : ''}${workshopGainClause(workshopGain, n)}${comboGainClause(comboGain, n)}`;
    }
    return `四项上限取最小：本波 ${n} 发`;
}

/** 四上限键名 → 中文短名（并列提示用）。 */
export function limitLabel(key) {
    const hit = LIMIT_VIEWS.find(v => v.key === key);
    return hit ? hit.label : String(key || '');
}

/** 小块标题（复用既有 .build-branch__label，不新建样式）。 */
function sectionLabel(text) {
    return el('span', 'build-branch__label', { text });
}

/**
 * 单色料的存量卡（复用 .build-mag__slot.is-full 的实心卡形态：图标 + 名称 + 数字三行居中）。
 * @param {{ key:string, label:string, glyph:string, element:string, value:number }} props
 */
export function createMaterialCard({ key = '', label = '', glyph = '?', element = '', value = 0 } = {}) {
    const n = toCount(value);
    const card = el('div', 'build-mag__slot is-full', { dataset: { material: key, value: String(n) } });
    append(card, createGlyphTile({ glyph, element, size: 'hud' }),
        el('span', '', { text: label }),
        el('b', '', { text: String(n), style: 'font-family:var(--font-pixel);font-size:var(--fs-md);' }));
    return card;
}

/**
 * 一条上限的小格：绑定那一轴用 `.is-full`（实心）与其余区分开，不新造选中色。
 * 值走 `toLimitDisplay` 的三态：数字照原样（含 0），未建造写「未建造」并用既有 `--c-text-locked` 压暗，
 * 玩家一眼能分出「这轴是 0」和「这轴还没有」。
 * @param {{ key:string, label:string, display:{built:boolean,text:string,value:(number|null)}, active:boolean }} props
 */
export function createLimitChip({ key = '', label = '', display = null, active = false } = {}) {
    const d = (display && typeof display === 'object') ? display : toLimitDisplay(null);
    const dataset = { limit: key, built: d.built ? 'true' : 'false', active: active ? 'true' : 'false' };
    if (d.built) dataset.value = String(d.value);
    const title = !d.built
        ? `${label}：本波未建造，不参与取最小`
        : (active ? `${label}是这一波的瓶颈` : `${label} ${d.text}`);
    const chip = el('div', `build-mag__slot${active ? ' is-full' : ''}`, { dataset, title });
    append(chip, el('span', '', { text: label }),
        el('b', '', d.built
            ? { text: d.text, style: 'font-family:var(--font-pixel);' }
            : { text: d.text, style: 'font-size:var(--fs-xs);color:var(--c-text-locked);' }));
    return chip;
}

/**
 * 一条弹药配方（复用 .build-picker__btn 的行形态：图标 + 两行文字 + 右侧状态标签）。
 * 副信息一行给「单发成本 · 够打几发」（够打几发 = §C-3「够哪一档」的逐档落点：
 * 某档够 0 发就是这个档打不出来，不必再排一张表）。
 * **不再有倍率位**（`damageMult` 与战斗读取一起判死，见 `formatMultiplier` 处的说明）。
 * 锁定态（`blueprintRequired` 且未解锁）**按钮 disabled 且不挂 onClick**，玩家点不进去。
 * @param {{ id:string, displayName:string, costText:string, affordText:string,
 *           state:'selected'|'idle'|'locked', onSelect:Function|null }} props
 */
export function createRecipeRow({ id = '', displayName = '', costText = '', affordText = '', state = 'idle', onSelect = null } = {}) {
    const locked = state === 'locked';
    const selected = state === 'selected';
    const text = el('span', 'build-picker__text');
    append(text, el('b', '', { text: displayName || id }));
    const sub = [costText, locked ? '' : affordText].filter(Boolean).join(' · ');
    if (sub) append(text, el('small', '', { text: sub }));
    const tagText = locked ? '需设计图' : (selected ? '已选' : '');
    const children = [createGlyphTile({ glyph: locked ? '锁' : '弹', element: locked ? '' : 'fire', size: 'hud' }), text];
    if (tagText) children.push(createPriceTag({ text: tagText }));
    const btn = createButton({
        variant: selected ? 'primary' : (locked ? 'ghost' : 'default'),
        className: 'build-picker__btn',
        disabled: locked,
        title: locked ? '需设计图' : (selected ? '当前弹药配方' : `选「${displayName || id}」`),
        children,
        onClick: locked ? null : () => { if (typeof onSelect === 'function') onSelect(id); },
        dataset: { recipe: id, recipeState: state },
    });
    if (selected) btn.setAttribute('aria-pressed', 'true');
    return btn;
}

/**
 * 「本波将扣料」一块：数值是**开战时将从库存扣掉的料**（`sys_getWavePreview().plannedSpent`），
 * 既不是现有量，也不是「已经扣了」——整备屏在开战前，真实扣料发生在开战时刻，所以标题与提示都要点明「将」。
 * `beast`（怪物料）只用于建设、不参与造弹，预演里 `plannedSpent.beast` 恒 0：单列一句说明，
 * 不并进「料」的总口径，否则玩家会以为建设用的怪物料也被造弹扣走了。
 * @param {{ total:number, pyro:number, cryo:number, beast:number }} props
 */
export function createSpentBlock({ total = 0, pyro = 0, cryo = 0, beast = 0 } = {}) {
    const sum = toCount(total);
    const row = el('div', 'build-branch', { dataset: { spentTotal: String(sum) } });
    const pill = el('span', 'ui-pill', { title: '本波开战时将从库存扣掉的料（此刻尚未扣）' });
    append(pill, el('b', 'ui-pill__value', { text: `${sum} 料` }));
    append(row, pill);
    append(row, el('span', 'build-branch__label', { text: `火 ${toCount(pyro)} · 冰 ${toCount(cryo)}` }));
    const bone = toCount(beast);
    append(row, el('span', 'build-branch__label', {
        text: bone > 0 ? `怪物料 ${bone}（只用于建设，不参与造弹）` : '怪物料不参与造弹（只用于建设）',
    }));
    return row;
}

/**
 * 组装「本波弹药」面板。四块顺序固定：现有料 → 本波发数 → 弹药配方 → **本波将扣料**（开战时才扣）。
 * `preview = null` ⇒ 只在「本波发数」位置渲染一行「预演不可用」，其余三块照常渲染。
 * @param {{ materials:Array, preview:(object|null), recipes:Array, onSelect:Function|null,
 *           spent:{total:number,pyro:number,cryo:number,beast:number} }} props
 *        `spent` 的值来自 `sys_getWavePreview().plannedSpent`（本波**将**扣料），prop 名保持不变。
 */
export function createWaveAmmoPanel({ materials = [], preview = null, recipes = [], onSelect = null, spent = { total: 0, pyro: 0, cryo: 0, beast: 0 } } = {}) {
    const children = [];

    // ① 现有料
    children.push(sectionLabel('现有料'));
    const matGrid = el('div', 'build-mag');
    append(matGrid, materials.map(m => createMaterialCard(m)));
    children.push(matGrid);

    // ② 本波发数（预演）
    children.push(sectionLabel('本波发数'));
    if (preview) {
        const shots = toCount(preview.shots);
        const box = el('div', 'build-branch');
        append(box, el('b', '', {
            text: `${shots} 发`,
            dataset: { waveShots: String(shots) },
            style: 'display:block;font-family:var(--font-pixel);font-size:var(--fs-lg);color:var(--c-energy);',
        }));
        const chips = el('div', 'build-mag');
        append(chips, (preview.limitChips || []).map(c => createLimitChip(c)));
        append(box, chips);
        append(box, el('span', 'build-branch__chosen', {
            text: preview.reason || describeBindingReason({ bound: preview.bound, shots }),
            dataset: { waveBound: preview.bound || '' },
        }));
        if (preview.ties) append(box, el('p', 'build-locked-note', { text: preview.ties }));
        (preview.notes || []).forEach(note => append(box, el('p', 'build-locked-note', { text: note })));
        children.push(box);
    } else {
        children.push(el('p', 'build-locked-note', { text: PREVIEW_UNAVAILABLE_TEXT, dataset: { previewState: 'unavailable' } }));
    }

    // ③ 弹药配方
    children.push(sectionLabel('弹药配方'));
    if (recipes.length) {
        const list = el('div', 'build-slots');
        append(list, recipes.map(r => createRecipeRow({ ...r, onSelect })));
        children.push(list);
    } else {
        children.push(el('p', 'build-locked-note', { text: '暂无可用弹药配方' }));
    }

    // ④ 本波将扣料（开战时刻才从库存扣走，整备屏此刻尚未扣）
    children.push(sectionLabel('本波将扣料'));
    children.push(createSpentBlock(spent || { total: 0, pyro: 0, cryo: 0, beast: 0 }));

    // 面板 hint 兼作**回合口径**的落点：「一波 = 一个回合」（2026-10-25 定，取代「消灭所有敌人
    // 才进下一波」的旧说法）——所以这里写「本波 = 本回合」，且不出现「清完 / 清场」这类目标词。
    return createPanel({ title: '本波弹药', hint: '本波 = 本回合 · 料 → 弹 · 每发扣料', children, id: 'build-ammo' });
}
