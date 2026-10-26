/**
 * validate_build_screen_materials.mjs - [REQ-20261022-wave-loop 经济接线 v2 步 8]
 * 整备屏「本波弹药」四块信息的验收：现有料 / 预演发数（N + 四上限 + 一句原因）/ 弹药配方 / 本波将扣料。
 *
 * 覆盖（对任务书 §6 的 A–H）：
 *   A 四轴文案各自正确（四组唯一绑定数据）
 *   B 断电 ⇒ 逐字出现「弹药工坊断电（本波不造弹）」
 *   C 干回合 ⇒ 出现「沿用上波发数」
 *   D 预演缺失 / 抛错 / 返回 undefined ⇒ 不抛错且渲染占位，其余三块照常
 *   E spent 缺失 ⇒ 显示 0，不出现 undefined / NaN（数据源＝`sys_getWavePreview().plannedSpent`）
 *   F 配方按配置条数逐条渲染；blueprintRequired 未解锁 ⇒ 锁定态且点不进
 *   F2 成本 / 够打几发 / 默认配方挑选一律走运行时出口 `sys_getShotCostForRecipe`（实扣价，不是原价）
 *   G 静态：不含「装填」「打不满」「预弹」，不含水平 overflow-x / scrollLeft
 *   H 静态：不写死配方数值（1.25 / 1.6 / 347）
 *   K 设施弹层 `ui_openFacilityPicker`：8 件全渲染（synth 不出现）/ 料 0 置灰 + 「料不足」/ 料价串取自配置
 *   附加：断电文案与第 4 步的规范出处逐字一致（防漂移）；整备屏整屏渲染冒烟 + 面板顺序。
 *
 * 说明：本仓库无 jsdom，按 tests/validate_potion_c6_nesting_ui.mjs 的同款做法手搭最小 DOM 桩。
 *       桩的 `appendChild` 只接受节点（元素 / 文本），**收到 Array / null / undefined / 原始值即抛错**
 *       —— 与真 DOM 同一条判据，用来拦住「价格节点写成嵌套数组」那类在旧桩里静默通过的真缺陷。
 *       `sys_getWavePreview` 由另一施工方（第 6 步）实现，本测试**不依赖它存在**，只喂桩数据。
 *
 * Usage: node tests/validate_build_screen_materials.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------- 最小 DOM 桩（只为渲染断言服务，不复刻浏览器） ----------------
class FakeText {
    constructor(text) { this._text = String(text); }
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); }
}

class FakeElement {
    constructor(tag = 'div') {
        this.tagName = String(tag).toUpperCase();
        this.childNodes = [];
        this.attributes = Object.create(null);
        this.dataset = {};
        this.className = '';
        this._ownText = '';
        this.disabled = false;
        this.id = '';
        this.parentNode = null;
        this.scrollTop = 0;
        this._listeners = Object.create(null);
        const self = this;
        this.classList = {
            add(...names) {
                const set = new Set(String(self.className || '').split(/\s+/).filter(Boolean));
                names.forEach(n => set.add(n));
                self.className = Array.from(set).join(' ');
            },
            remove(...names) {
                const set = new Set(String(self.className || '').split(/\s+/).filter(Boolean));
                names.forEach(n => set.delete(n));
                self.className = Array.from(set).join(' ');
            },
            contains(name) { return String(self.className || '').split(/\s+/).includes(name); },
        };
    }

    get textContent() {
        return this._ownText + this.childNodes.map(c => (c && c.textContent) || '').join('');
    }

    set textContent(v) {
        this._ownText = String(v);
        this.childNodes = [];
    }

    set innerHTML(v) {
        this._ownText = '';
        this.childNodes = [];
        this._innerHTML = String(v);
    }

    get innerHTML() { return this._innerHTML || ''; }

    /**
     * 只接受**真节点**（元素或文本节点）。
     * 真 DOM 的 `appendChild(Array)` / `appendChild(null)` / `appendChild(undefined)` 一律抛错，
     * 旧桩把非对象包成文本、把 Array 当节点塞进去 ⇒ 「价格节点写成嵌套数组」那类真缺陷在桩里静默通过。
     * 现在桩与浏览器同一条判据：非节点就抛，让这类缺陷在测试里先炸。
     */
    appendChild(child) {
        if (!(child instanceof FakeElement) && !(child instanceof FakeText)) {
            const kind = Array.isArray(child) ? `Array(${child.length})` : (child === null ? 'null' : (typeof child));
            throw new TypeError(`FakeElement.appendChild 只接受节点（FakeElement / FakeText），实测 ${kind}：`
                + '真 DOM 下 appendChild(Array/null/undefined/原始值) 会抛错，桩不再兜底');
        }
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
    }

    /**
     * 真 DOM `ParentNode.append(...nodes)` 语义：逐参处理，字符串转文本节点；
     * **不扁平化 Array**（真 DOM 同样不接受 Array —— 传数组直接抛，由 `appendChild` 的判据兜住）。
     */
    append(...nodes) {
        nodes.forEach(n => {
            if (typeof n === 'string') this.appendChild(new FakeText(n));
            else this.appendChild(n);
        });
        return this;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
    }

    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }

    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }

    dispatch(type) {
        const evt = { type, stopPropagation() {} };
        (this._listeners[type] || []).forEach(fn => fn(evt));
    }

    remove() {
        if (!this.parentNode) return;
        const list = this.parentNode.childNodes;
        const i = list.indexOf(this);
        if (i >= 0) list.splice(i, 1);
    }

    /** 深度优先收集所有后代元素（不含文本节点）。 */
    collect(out = []) {
        this.childNodes.forEach(c => {
            if (c instanceof FakeElement) {
                out.push(c);
                c.collect(out);
            }
        });
        return out;
    }

    matches(selector) {
        if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
        if (selector.startsWith('#')) return this.id === selector.slice(1);
        return this.tagName === selector.toUpperCase();
    }

    querySelector(selector) {
        return this.collect().find(n => n.matches(selector)) || null;
    }

    querySelectorAll(selector) {
        return this.collect().filter(n => n.matches(selector));
    }
}

function mountBuildRoot() {
    const root = new FakeElement('div');
    root.id = 'build-screen-root';
    globalThis.document = {
        getElementById(id) { return id === 'build-screen-root' ? root : null; },
        createElement(tag) { return new FakeElement(tag); },
        createTextNode(text) { return new FakeText(text); },
    };
    return root;
}

globalThis.document = {
    getElementById() { return null; },
    createElement(tag) { return new FakeElement(tag); },
    createTextNode(text) { return new FakeText(text); },
};

const { CONFIG } = await import('../src/config.js');
const { build_screen_system } = await import('../src/ui/build_screen.js');
// 设施弹层（K 段）的期望值一律从这两个真表取：顺序表与中文名都不在测试里另写一份
const { FACILITY_IDS, getReveal } = await import('../src/utils/build_economy_utils.js');
const { FACILITY_LABELS } = await import('../src/build_system.js');
const {
    DRY_WAVE_TEXT,
    PREVIEW_UNAVAILABLE_TEXT,
    UNPOWERED_WORKSHOP_TEXT,
    MATERIAL_VIEWS,
    describeBindingReason,
    toCount,
} = await import('../src/ui/components/wave_ammo.js');
// 屏上料名的唯一真源（缺料提示一律用中文名，不许出现 pyro / cryo 这类键名）
const { MATERIAL_LABELS, MATERIAL_ORDER, pickRecipeByYield } = await import('../src/utils/shot_recipe_utils.js');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECIPES = CONFIG.gameplay.build.recipes;

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, message) {
    if (condition) { passed += 1; return; }
    failed += 1;
    failures.push(message);
    console.log(`  x ${message}`);
}

console.log('===================================================');
console.log('  Build screen materials panel validation (step 8)');
console.log('===================================================\n');

/** 造一个只有面板所需出口的 game 桩；`opts` 里显式给 undefined 就等于「没这个方法」。 */
function makeGame({ preview, previewMode = 'value', readout, selectedId = null, state, phaseCore } = {}) {
    const game = Object.assign({}, build_screen_system);
    game._selectedRecipeId = selectedId;
    game.ui_renderBuildScreen = () => { game._renderCalls = (game._renderCalls || 0) + 1; };
    if (readout !== undefined) game.sys_getMaterialReadout = () => readout;
    // 整备状态（⚡ 余额 / 射速轨等级）：只在用例显式给时才挂——不给就等于「这个出口缺失」，
    // 「改善路径」那两句必须因此退回原句，不许凭空生成提示（见 A2 段）。
    if (state !== undefined) game.sys_getBuildState = () => state;
    // 预演核心（`phase_wavePreviewCore`）：建工坊会同时改 `U` / `E` / `M` 三轴，`E` 那一轴要
    // 「战斗设施扣完之后的可用电力」（`restAfterCombat`）才算得出。只在用例显式给时才挂——
    // 不给就等于「拿不到电力基数」，三条改善子句必须全部不生成（宁可不说，不许猜）。
    if (phaseCore !== undefined) {
        game.phase_wavePreviewCore = typeof phaseCore === 'function' ? phaseCore : () => phaseCore;
    }
    if (previewMode === 'missing') {
        // 刻意不挂 sys_getWavePreview
    } else if (previewMode === 'throws') {
        game.sys_getWavePreview = () => { throw new Error('preview boom'); };
    } else {
        game.sys_getWavePreview = () => preview;
    }
    return game;
}

function panelOf(game) {
    return game.ui_buildWaveAmmoPanel();
}

function textOf(node) { return node.textContent; }

function itemsWith(node, key) {
    return node.collect().filter(n => n.dataset && Object.prototype.hasOwnProperty.call(n.dataset, key));
}

const readoutFull = { pyro: 9, cryo: 9, beast: 4, spent: { pyro: 3, cryo: 0 }, spentTotal: 3 };

// ---------------- A：四轴文案各自正确 ----------------
{
    const detail = { A: 5, U: 4, E: 9, M: 2 };
    const cases = [
        { bound: 'A', shots: 3, expect: '射速轨只能打 3 发', powered: true },
        { bound: 'U', shots: 3, expect: '弹药工坊产能只有 3 发', powered: true },
        { bound: 'E', shots: 3, expect: '电力只够打 3 发', powered: true },
        { bound: 'M', shots: 3, expect: '料只够装 3 发', powered: true },
    ];
    cases.forEach(c => {
        const game = makeGame({
            preview: { round: 7, shots: c.shots, bound: c.bound, ties: [], detail, dry: false, recipeId: null, powered: c.powered, shedOptions: [] },
            readout: readoutFull,   // 料够 ⇒ M 轴不带缺料后缀
        });
        const panel = panelOf(game);
        const boundNode = panel.collect().find(n => n.dataset && n.dataset.waveBound === c.bound);
        check(!!boundNode, `A/${c.bound}：原因行带 waveBound=${c.bound}`);
        check(textOf(panel).includes(c.expect), `A/${c.bound}：原因文案 =「${c.expect}」`);
        const others = ['A', 'U', 'E', 'M'].filter(k => k !== c.bound);
        const chips = itemsWith(panel, 'limit');
        check(chips.length === 4, `A/${c.bound}：四条上限各一格（实测 ${chips.length}）`);
        check(chips.every(chip => chip.dataset.active === (chip.dataset.limit === c.bound ? 'true' : 'false')),
            `A/${c.bound}：只有绑定那一轴高亮`);
        check(chips.filter(chip => chip.dataset.active === 'true').length === 1,
            `A/${c.bound}：高亮恰为一格（others=${others.join('/')}）`);
        check(chips.find(chip => chip.dataset.limit === 'A').dataset.value === '5', `A/${c.bound}：A 值读自 detail.A`);
        check(chips.find(chip => chip.dataset.limit === 'M').dataset.value === '2', `A/${c.bound}：M 值读自 detail.M`);
        check(itemsWith(panel, 'waveShots')[0].dataset.waveShots === String(c.shots), `A/${c.bound}：发数大字 = ${c.shots}`);
    });

    // M 轴缺料后缀：三色料全空 ⇒ 逐料点名缺谁（只点正数成本键）
    const broke = makeGame({
        preview: { round: 7, shots: 3, bound: 'M', ties: [], detail, dry: false, recipeId: null, powered: true, shedOptions: [] },
        readout: { pyro: 0, cryo: 0, beast: 0 },
    });
    const brokeText = textOf(panelOf(broke));
    check(/料只够装 3 发（缺 /.test(brokeText), 'A/M：缺料时带「（缺 …）」后缀');
    // 缺料必须点名**中文料名**且带差额（库存 0 ⇒ 差额 = 需要量），屏上不许出现 pyro / cryo 键名
    check(!/pyro|cryo|beast/.test(brokeText), 'A/M：缺料串不泄料键名（不出 pyro / cryo / beast）');
    // 选中配方按**这堆料能打几发**挑（`pickRecipeByYield`；三色料全空 ⇒ 每条 yield 都是 0 ⇒ 并列按 id 字典序）。
    // 【语义已变更 2026-10-25】旧写法是就地按「cost 总量最低」排序取第一条（单料档 `{pyro:3}` ⇒ 期望「缺 火料 9」）；
    //   挑法改为按发数后，本用例的基准配方随之落到 `ammo_pyro_cryo_dual`（期望「缺 火料 6」「缺 冰料 6」）。
    //   断言强度不变：仍是逐料精确差额串，只是基准配方换了（理由见 docs/review/recipe-yield-20261025.md）。
    //   这里直接调真函数求基准，不在测试里再写一份「按发数挑」的算法。
    const brokeIds = RECIPES.filter(r => !r.blueprintRequired).map(r => r.id);
    const defaultRecipe = pickRecipeByYield(CONFIG, brokeIds, { pyro: 0, cryo: 0, beast: 0 }, r => r.cost);
    // 期望缺料串按 `MATERIAL_ORDER`（火 → 冰 → 怪物）逐桶排，与 `describeMaterialShortfall` 的顺序一致；
    // 写成**整串**逐字比：`缺 火料 6、冰料 6`（第一桶带「缺 」，其余按「、」连），
    // 单料档时它就退化成旧期望 `缺 火料 9`。逐桶另各断一次，防止只点到一桶就算过。
    const needParts = MATERIAL_ORDER
        .filter(k => Number(defaultRecipe.cost && defaultRecipe.cost[k]) > 0)
        .map(k => `${MATERIAL_LABELS[k]} ${Number(defaultRecipe.cost[k]) * 3}`);   // 预演 3 发 × 每发该料量；库存 0 ⇒ 缺额即需要量
    const expectedShortfall = `缺 ${needParts.join('、')}`;
    check(brokeText.includes(expectedShortfall),
        `A/M：缺料点名整串「${expectedShortfall}」（差额 = 需要 − 现有）`);
    needParts.forEach(t => check(brokeText.includes(t), `A/M：缺料逐桶点名「${t}」`));

    // 千奇百怪的 bound 不产出空句（屏幕不许出现空原因行）
    check(describeBindingReason({ bound: 'Z', shots: 2 }).includes('2 发'), 'A：认不得的 bound 也给一句完整话（不留空行）');
    check(describeBindingReason({ bound: null, shots: 0 }).includes('0 发'), 'A：shots 缺失按 0 发显示，不出现 undefined');
}

// ---------------- A2：改善路径（建工坊 / 升射速轨「能多打几发」只在真能改善时出现）----------------
// 判据（**四轴取最小之后**严格变大才出现，任一条不成立一个字都不加；2026-10-25 返工）：
//   工坊：① 未建造 ② 付得起工坊料价 ③ 建后四轴全算（U 变 Lv1 容量 / E 变有限 / M 复配方原价 / A 不变）
//         ④ `min(四轴)` **严格大于**当前发数。
//   射速：① 射速轨没满级 ② 屏上 ⚡ 够付下一档 ③ `min(A+1, U, E, M)` **严格大于**当前发数。
//   组合：单步都无效、两件都做才有效时给「两件都做」那句（代价各自写明，末尾发数 = 四轴 min）。
// 电力基数从配置读（自然态：无发电机、无战斗设施 ⇒ `可用电力 = 电池底容量`），不写字面量。
{
    const WORKSHOP_TEXT = '建弹药工坊后可打';
    const RATE_TEXT = '升一级（';
    const COMBO_TEXT = '两件都做才打';
    const buildCfg = CONFIG.gameplay.build;
    const ratePrice = Number(buildCfg.cannon.ratePrices[0]);   // 下一档价一律从配置读，不写字面量
    const WS_CAP_LV1 = Number(buildCfg.workshop.capacityByLevel[0]);   // 建后即 Lv1（`src/config.js:1086`）
    const WS_DRAW_LV1 = Number(buildCfg.power.draw.workshop[0]);       // 工坊 Lv1 每波耗电（`src/config.js:1000`）
    const PER_SHOT = Number(buildCfg.power.powerPerShot);              // 每发耗电（`src/config.js:1011`）
    const REST_POWER = Number(buildCfg.power.battery.baseCapacity);    // 自然态可用电力 = 电池底容量（`src/config.js:1013`）
    const E_AFTER = Math.floor((REST_POWER - WS_DRAW_LV1) / PER_SHOT); // 建完工坊后的电力上限
    const WS_PRICE = buildCfg.facilities.workshop.materials;           // 工坊料价（火 4 / 冰 2 / 怪物料 3）
    // 兽料价（2026-10-25 起工坊料单含 beast：兽料唯一的物理出口）。
    // 下面所有「料够建工坊」的读数夹具一律取本值，**不写死 3** —— 否则该前提会退化成「料不够」，
    // 等于把断言测反（与 `validate_build_materials.mjs` 的 R10「料足 ⇒ 成交」同一条纪律）。
    const WS_BEAST = Number(WS_PRICE.beast) || 0;
    const phaseNatural = { restAfterCombat: REST_POWER };
    const noWorkshop = { workshopBuilt: false, powered: false };
    const previewM = (shots, extra = {}) => ({
        round: 7, shots, bound: 'M', ties: [],
        detail: { A: 2, U: null, E: null, M: shots },
        dry: false, recipeId: 'ammo_pyro_single', shedOptions: [], ...noWorkshop, ...extra,
    });
    const previewA = shots => ({
        round: 7, shots, bound: 'A', ties: [],
        detail: { A: shots, U: null, E: null, M: 9 },
        dry: false, recipeId: 'ammo_pyro_single', powered: false, shedOptions: [],
    });
    // 单料档 pyro 3：料够建工坊（pyro 4 / cryo 2）且建完 `13−4=9 ⇒ 9/3 = 3 发`（料那一轴）
    const richState = { energy: 0, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } };

    // ① 有料建工坊且建了真能多打 ⇒ 出现该句，且整句逐字可读
    // 【语义变更 2026-10-25】旧期望「建后 3 发」只按**料**那一轴算（13−4 ⇒ 9/3 = 3）；
    //   新期望「建后 2 发」= min(A=2, U=3, E=5, M_后=3) —— 这一局 A=2 才是真闸门，建了工坊也只到 2 发。
    //   旧数字属假承诺：玩家花料建完，屏上曾说 3，实际发数仍是 2（`docs/review/build-hint-20261025.md` §7）。
    const wsMAfter = Math.floor((13 - Number(WS_PRICE.pyro)) / 3);
    const wsExpected = Math.min(2, WS_CAP_LV1, E_AFTER, wsMAfter);
    const canBuild = makeGame({
        preview: previewM(1),
        readout: { pyro: 13, cryo: 2, beast: WS_BEAST },
        selectedId: 'ammo_pyro_single',
        state: richState,
        phaseCore: phaseNatural,
    });
    const canBuildText = textOf(panelOf(canBuild));
    check(canBuildText.includes(`料只够装 1 发；${WORKSHOP_TEXT} ${wsExpected} 发`),
        `A2/工坊①：料够建且四轴 min = ${wsExpected} 发 > 1 发 ⇒ 出现「${WORKSHOP_TEXT} ${wsExpected} 发」（实测段：${canBuildText.slice(0, 120)}）`);
    check(wsExpected === 2,
        `A2/工坊①：四轴 min 必须落在 A 轴 2（料一侧单独算会给 3）——算式 min(2, ${WS_CAP_LV1}, ${E_AFTER}, ${wsMAfter}) = ${wsExpected}`);
    check(!canBuildText.includes(`${WORKSHOP_TEXT} ${wsMAfter} 发`) || wsMAfter === wsExpected,
        `A2/工坊①：屏上不许出现「只按料算」的 ${wsMAfter} 发（A 卡住时那就是假承诺）`);
    check(!/pyro|cryo|beast/.test(canBuildText), 'A2/工坊①：新句子不泄料键名（不出 pyro / cryo / beast）');

    // ② 料不够建工坊（缺冰料）⇒ 不出现（不许骗玩家去建他建不起的东西）
    const cannotBuild = makeGame({
        preview: previewM(1),
        readout: { pyro: 13, cryo: 1, beast: WS_BEAST },
        selectedId: 'ammo_pyro_single',
        state: richState,
        phaseCore: phaseNatural,
    });
    const cannotBuildText = textOf(panelOf(cannotBuild));
    check(!cannotBuildText.includes(WORKSHOP_TEXT), 'A2/工坊②：冰料只够 1（工坊要 2）⇒ 不出现建工坊提示');
    check(cannotBuildText.includes('料只够装 1 发'), 'A2/工坊②：不可改善时原句照旧（只说现状）');

    // ③ 料够建但建完发数不变（建完只剩 pyro 1 ⇒ 0 发）⇒ 不出现
    const noPoint = makeGame({
        preview: previewM(1),
        readout: { pyro: 5, cryo: 2, beast: WS_BEAST },
        selectedId: 'ammo_pyro_single',
        state: richState,
        phaseCore: phaseNatural,
    });
    const noPointText = textOf(panelOf(noPoint));
    check(!noPointText.includes(WORKSHOP_TEXT), 'A2/工坊③：料够建但建后 0 发（不更多）⇒ 不出现建工坊提示');

    // ④ 已经建了工坊（通电）⇒ 不出现「建了能多打」（它已经不成立了）
    const built = makeGame({
        preview: previewM(1, { workshopBuilt: true, powered: true, detail: { A: 2, U: 4, E: 9, M: 1 } }),
        readout: { pyro: 13, cryo: 2, beast: WS_BEAST },
        selectedId: 'ammo_pyro_single',
        state: richState,
        phaseCore: phaseNatural,
    });
    const builtText = textOf(panelOf(built));
    check(!builtText.includes(WORKSHOP_TEXT), 'A2/工坊④：工坊已建造 ⇒ 不出现建工坊提示');

    // ⑤ 缺整备状态出口（⚡ / 射速轨等级读不到）⇒ 三句都不许凭空生成
    const noState = makeGame({
        preview: previewM(1),
        readout: { pyro: 13, cryo: 2, beast: WS_BEAST },
        selectedId: 'ammo_pyro_single',
    });
    const noStateText = textOf(panelOf(noState));
    check(!noStateText.includes(WORKSHOP_TEXT) && !noStateText.includes(RATE_TEXT),
        'A2：缺 sys_getBuildState ⇒ 不生成任何改善提示（不猜）');

    // ⑤b 缺预演核心（拿不到「战斗设施扣完后的可用电力」）⇒ 建工坊那一侧一个字都不加（不猜电力）
    const noCore = makeGame({
        preview: previewM(1),
        readout: { pyro: 13, cryo: 2, beast: WS_BEAST },
        selectedId: 'ammo_pyro_single',
        state: richState,
    });
    const noCoreText = textOf(panelOf(noCore));
    check(!noCoreText.includes(WORKSHOP_TEXT), 'A2/工坊⑤：缺 phase_wavePreviewCore ⇒ 不生成建工坊提示（电力基数读不到就不承诺）');

    // ⑥ 射速轨：⚡ 够付下一档、升一级后 min(A+1=3, U=∞, E=∞, M=9) = 3 > 当前 2 发 ⇒ 出现，价从配置读
    const rateCan = makeGame({
        preview: previewA(2),
        readout: readoutFull,
        state: { energy: ratePrice, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } },
    });
    const rateCanText = textOf(panelOf(rateCan));
    check(rateCanText.includes(`射速轨只能打 2 发；${RATE_TEXT}${ratePrice} 电）后打 3 发`),
        `A2/射速①：⚡ 正好够 ${ratePrice} ⇒ 出现「升一级（${ratePrice} 电）后打 3 发」`);

    // ⑦ ⚡ 差 1 度 ⇒ 不出现
    const ratePoor = makeGame({
        preview: previewA(2),
        readout: readoutFull,
        state: { energy: ratePrice - 1, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } },
    });
    const ratePoorText = textOf(panelOf(ratePoor));
    check(!ratePoorText.includes(RATE_TEXT), `A2/射速②：⚡ 只有 ${ratePrice - 1} ⇒ 不出现升级提示`);
    check(ratePoorText.includes('射速轨只能打 2 发'), 'A2/射速②：付不起时原句照旧');

    // ⑧ 射速轨满级（`ratePrices` 已用完 ⇒ getPrice 给 null）⇒ 不出现
    const rateMax = makeGame({
        preview: previewA(2),
        readout: readoutFull,
        state: {
            energy: 9999, crystal: 0,
            cannonLevels: { dmg: 0, rate: CONFIG.gameplay.build.cannon.ratePrices.length, bounce: 0 },
        },
    });
    check(!textOf(panelOf(rateMax)).includes(RATE_TEXT), 'A2/射速③：射速轨满级 ⇒ 不出现升级提示');

    // ⑨ 纯函数最后一道闸：调用方就算传了「同数」或「0 价」，也不许长出提示（防呆，不是新行为）
    check(!describeBindingReason({ bound: 'M', shots: 3, workshopGain: 3 }).includes(WORKSHOP_TEXT),
        'A2/闸：建后发数 == 当前发数 ⇒ 不追加（同数不许说「建了能多打」）');
    check(!describeBindingReason({ bound: 'M', shots: 3, workshopGain: null }).includes(WORKSHOP_TEXT),
        'A2/闸：没给建后发数 ⇒ 不追加');
    check(!describeBindingReason({ bound: 'A', shots: 3, rateGain: { shots: 3, price: ratePrice } }).includes(RATE_TEXT),
        'A2/闸：升后发数 == 当前发数 ⇒ 不追加');
    check(!describeBindingReason({ bound: 'A', shots: 2, rateGain: { shots: 3, price: 0 } }).includes(RATE_TEXT),
        'A2/闸：价格读成 0 ⇒ 整句不追加（不出现「升一级（）」半句话）');
    check(describeBindingReason({ bound: 'A', shots: 2, rateGain: { shots: 3, price: ratePrice } })
        === `射速轨只能打 2 发；升一级（${ratePrice} 电）后打 3 发`,
        'A2/闸：能改善时整句逐字 =「射速轨只能打 2 发；升一级（N 电）后打 3 发」');
}

// ---------------- A3：单步无效、组合有效 ⇒ 「两件都做才多打」（2026-10-25 返工新增）----------------
// 真机自然态就是这一种：`detail={A:2,U:null,E:null,M:2}`、配方 `ammo_pyro_cryo_dual`（原价 `{pyro:2,cryo:2}`，
//   未建工坊按 `manualMaterialMultiplier: 2` ⇒ 实扣 `{4,4}` ⇒ M = min(17/4, 10/4) = 2）。
//   升一级射速轨：`min(A+1=3, ∞, ∞, M=2) = 2` ⇒ **一发不多**；建工坊：`min(A=2, U=3, E=5, M_后=4) = 2` ⇒ 同样不多；
//   两件都做：`min(3, 3, 5, 4) = 3` ⇒ 真的多 1 发。所以屏上必须说清「两件都要做」，且发数是四轴 min。
// 六行判据（派单 §3）逐行对应本段用例。
{
    const COMBO_TEXT = '两件都做才打';
    const SINGLE_WORKSHOP = '建弹药工坊后可打';
    const SINGLE_RATE = '；升一级（';       // 单步句的固定开头（组合句是「再升一级射速轨」，不含这个前缀）
    const buildCfg = CONFIG.gameplay.build;
    const ratePrice = Number(buildCfg.cannon.ratePrices[0]);
    const WS_CAP_LV1 = Number(buildCfg.workshop.capacityByLevel[0]);
    const WS_DRAW_LV1 = Number(buildCfg.power.draw.workshop[0]);
    const PER_SHOT = Number(buildCfg.power.powerPerShot);
    const REST_POWER = Number(buildCfg.power.battery.baseCapacity);
    const E_AFTER = Math.floor((REST_POWER - WS_DRAW_LV1) / PER_SHOT);
    const WS_PRICE = buildCfg.facilities.workshop.materials;
    const pyroNeed = Number(WS_PRICE.pyro);
    const cryoNeed = Number(WS_PRICE.cryo);
    const phaseNatural = { restAfterCombat: REST_POWER };
    const DUAL = 'ammo_pyro_cryo_dual';      // cost {pyro:2, cryo:2}
    const SINGLE = 'ammo_pyro_single';       // cost {pyro:3}
    const dualCost = reason => CONFIG.gameplay.build.recipes.find(r => r.id === reason).cost;
    // 自然态那份读数（真机 `readings/20261025-173228` 的 baseline-natural 逐字照抄）：料 17/10、⚡ 75
    const naturalPreview = (extra = {}) => ({
        round: 7, shots: 2, bound: 'A', ties: [],
        detail: { A: 2, U: null, E: null, M: 2 },
        dry: false, recipeId: DUAL, workshopBuilt: false, powered: false, shedOptions: [], ...extra,
    });
    const naturalState = { energy: 75, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } };
    // 料价串逐项 = 配置里 `materials` 的正数键（2026-10-25 起工坊料单含 beast ⇒ 屏上多一项「怪物料 3」）
    const WS_BEAST = Number(WS_PRICE.beast) || 0;
    // 屏上料名表（与 `src/utils/shot_recipe_utils.js` 的 MATERIAL_LABELS 同口径；测试里不 import 源文件）
    const WS_LABELS = { pyro: '火料', cryo: '冰料', beast: '怪物料' };
    const wsCostItems = [{ key: 'pyro', need: pyroNeed }, { key: 'cryo', need: cryoNeed }];
    if (WS_BEAST > 0) wsCostItems.push({ key: 'beast', need: WS_BEAST });
    const wsCostParts = wsCostItems.map(x => `${WS_LABELS[x.key]} ${x.need}`);
    const comboExpected = `射速轨只能打 2 发；建弹药工坊（${wsCostParts.join('、')}）再升一级射速轨（${ratePrice} 电），两件都做才打 3 发`;

    // 行 1：单步无效 + 组合无效 ⇒ 两句都不出（料只够 5 ⇒ 建完工坊剩 1 ⇒ M_后 = 0）
    const bothDead = makeGame({
        preview: naturalPreview({ detail: { A: 2, U: null, E: null, M: 2 } }),
        readout: { pyro: 5, cryo: 2, beast: WS_BEAST },
        selectedId: DUAL,
        state: naturalState,
        phaseCore: phaseNatural,
    });
    const bothDeadText = textOf(panelOf(bothDead));
    check(!bothDeadText.includes(COMBO_TEXT) && !bothDeadText.includes(SINGLE_WORKSHOP) && !bothDeadText.includes(SINGLE_RATE),
        `A3/行1：单步与组合都无效 ⇒ 任何改善句都不出（实测：${bothDeadText.slice(0, 80)}）`);
    check(bothDeadText.includes('射速轨只能打 2 发'), 'A3/行1：原句照旧（只说现状）');

    // 行 2：单步无效 + 组合有效 + 两件都付得起 ⇒ 只出组合句，数字 = 四轴 min（真机自然态同一形）
    const comboOk = makeGame({
        preview: naturalPreview(),
        readout: { pyro: 17, cryo: 10, beast: WS_BEAST },
        selectedId: DUAL,
        state: naturalState,
        phaseCore: phaseNatural,
    });
    const comboOkText = textOf(panelOf(comboOk));
    // 四轴 min 见 §A3 抬头注释；这里直接编码算式，不写死「3」
    const dualAfter = {
        pyro: 17 - pyroNeed, cryo: 10 - cryoNeed,
    };
    const dualCostNow = dualCost(DUAL);
    const mAfter = Math.min(
        Math.floor(dualAfter.pyro / Number(dualCostNow.pyro)),
        Math.floor(dualAfter.cryo / Number(dualCostNow.cryo)),
    );
    const comboShots = Math.min(3, WS_CAP_LV1, E_AFTER, mAfter);   // A+1 = 3
    check(comboShots === 3, `A3/行2：四轴 min 复算 = ${comboShots}（min(A+1=3, U=${WS_CAP_LV1}, E=${E_AFTER}, M_后=${mAfter})）`);
    check(comboOkText.includes(comboExpected),
        `A3/行2：出组合句且逐字「${comboExpected}」（实测：${comboOkText.slice(0, 160)}）`);
    check(!comboOkText.includes(SINGLE_WORKSHOP), 'A3/行2：单步建工坊句不出（那一件单独做没用）');
    check(!comboOkText.includes(SINGLE_RATE), 'A3/行2：单步升射速句不出（那一件单独做没用）');
    check(!/pyro|cryo|beast/.test(comboOkText), 'A3/行2：组合句不泄料键名（火料 / 冰料 才是屏上口径）');
    // 组合句必须点明「两件事」：两句动作都要在，且各自代价（料 / ⚡）都要在
    check(comboOkText.includes('建弹药工坊（') && comboOkText.includes(`再升一级射速轨（${ratePrice} 电）`),
        'A3/行2：两件事都点名，且 ⚡ 代价写在同一句里');
    check(comboOkText.includes(`火料 ${pyroNeed}`) && comboOkText.includes(`冰料 ${cryoNeed}`),
        'A3/行2：建工坊的料代价逐项写出（中文料名 + 数量）');
    check(WS_BEAST <= 0 || comboOkText.includes(`怪物料 ${WS_BEAST}`),
        `A3/行2：兽料代价也在同一句里（工坊料单已含 beast ${WS_BEAST}，屏上不许省掉——它是兽料的建造出口）`);

    // 行 3：单步无效 + 组合有效 + ⚡ 不够 ⇒ 不出组合句（差 1 度）
    const comboPoorEnergy = makeGame({
        preview: naturalPreview(),
        readout: { pyro: 17, cryo: 10, beast: WS_BEAST },
        selectedId: DUAL,
        state: { energy: ratePrice - 1, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } },
        phaseCore: phaseNatural,
    });
    const comboPoorEnergyText = textOf(panelOf(comboPoorEnergy));
    check(!comboPoorEnergyText.includes(COMBO_TEXT),
        `A3/行3：⚡ 只有 ${ratePrice - 1}（差 1 度）⇒ 不出组合句`);
    check(comboPoorEnergyText.includes('射速轨只能打 2 发'), 'A3/行3：退回原句，一个字不加');

    // 行 4：单步无效 + 组合有效 + 料不够建工坊 ⇒ 不出组合句（冰料差 1）
    const comboSickMaterial = makeGame({
        preview: naturalPreview(),
        readout: { pyro: 17, cryo: cryoNeed - 1, beast: WS_BEAST },
        selectedId: DUAL,
        state: naturalState,
        phaseCore: phaseNatural,
    });
    const comboSickMaterialText = textOf(panelOf(comboSickMaterial));
    check(!comboSickMaterialText.includes(COMBO_TEXT),
        `A3/行4：冰料只有 ${cryoNeed - 1}（工坊要 ${cryoNeed}）⇒ 不出组合句`);

    // 行 5：单步有效（料很多、只有 M 卡）⇒ 照旧出单步句，数字 = 四轴 min（不做组合句）
    const singleOk = makeGame({
        preview: {
            round: 7, shots: 1, bound: 'M', ties: [],
            detail: { A: 4, U: null, E: null, M: 1 },
            dry: false, recipeId: SINGLE, workshopBuilt: false, powered: false, shedOptions: [],
        },
        readout: { pyro: 13, cryo: 2, beast: WS_BEAST },
        selectedId: SINGLE,
        state: { energy: ratePrice, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } },
        phaseCore: phaseNatural,
    });
    const singleOkText = textOf(panelOf(singleOk));
    const singleMAfter = Math.floor((13 - pyroNeed) / Number(dualCost(SINGLE).pyro));
    const singleShots = Math.min(4, WS_CAP_LV1, E_AFTER, singleMAfter);   // A = 4（不升）
    check(singleShots === 3, `A3/行5：四轴 min 复算 = ${singleShots}（min(A=4, U=${WS_CAP_LV1}, E=${E_AFTER}, M_后=${singleMAfter})）`);
    check(singleOkText.includes(`料只够装 1 发；${SINGLE_WORKSHOP} ${singleShots} 发`),
        `A3/行5：单步有效 ⇒ 出单步句「${SINGLE_WORKSHOP} ${singleShots} 发」（实测：${singleOkText.slice(0, 120)}）`);
    check(!singleOkText.includes(COMBO_TEXT), 'A3/行5：单步已有效 ⇒ 不再给组合句（别让玩家为多发一发做两件事）');

    // 行 6：U 卡住（工坊建成后容量 ≤ 当前发数）⇒ 不出「升射速轨可多打」句
    const uCapBlocks = makeGame({
        preview: {
            round: 7, shots: 2, bound: 'A', ties: [],
            detail: { A: 2, U: 2, E: 9, M: 9 },
            dry: false, recipeId: null, workshopBuilt: true, powered: true, shedOptions: [],
        },
        readout: { pyro: 40, cryo: 20, beast: 0 },
        state: { energy: 999, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } },
        phaseCore: phaseNatural,
    });
    check(!textOf(panelOf(uCapBlocks)).includes(SINGLE_RATE),
        'A3/行6：U=2 卡住 ⇒ 不出现「升一级后可多打」（A+1=3 但产能只给 2）');
    // 反向对照：把 U 抬到 3（不再卡）⇒ 同一屏就出单步句，证明拦住它的确实是 U 轴
    const uCapFreed = makeGame({
        preview: {
            round: 7, shots: 2, bound: 'A', ties: [],
            detail: { A: 2, U: 3, E: 9, M: 9 },
            dry: false, recipeId: null, workshopBuilt: true, powered: true, shedOptions: [],
        },
        readout: { pyro: 40, cryo: 20, beast: 0 },
        state: { energy: 999, crystal: 0, cannonLevels: { dmg: 0, rate: 0, bounce: 0 } },
        phaseCore: phaseNatural,
    });
    check(textOf(panelOf(uCapFreed)).includes(`；升一级（${ratePrice} 电）后打 3 发`),
        'A3/行6 对照：U=3 不卡 ⇒ 单步句照旧出现（拦住上一条的是 U 轴，不是别的）');

    // 纯函数最后一道闸：组合句的三种「半句话」都不许出
    check(!describeBindingReason({ bound: 'A', shots: 2, comboGain: { shots: 3, price: ratePrice, materials: [] } })
        .includes(COMBO_TEXT), 'A3/闸：料价读不到（空数组）⇒ 不出组合句（不写「建弹药工坊（）」半句话）');
    check(!describeBindingReason({ bound: 'A', shots: 3, comboGain: { shots: 3, price: ratePrice, materials: [{ key: 'pyro', need: 4 }] } })
        .includes(COMBO_TEXT), 'A3/闸：组合后发数 == 当前发数 ⇒ 不追加');
    check(!describeBindingReason({ bound: 'A', shots: 2, comboGain: { shots: 3, price: 0, materials: [{ key: 'pyro', need: 4 }] } })
        .includes(COMBO_TEXT), 'A3/闸：⚡ 价读成 0 ⇒ 整句不追加（不出「射速轨（0 电）」）');
    check(describeBindingReason({
        bound: 'A', shots: 2,
        comboGain: { shots: 3, price: ratePrice, materials: wsCostItems },
    }) === comboExpected, `A3/闸：能改善时整句逐字 =「${comboExpected}」`);
}

// ---------------- B：断电逐字文案 ----------------
{
    const detail = { A: 5, U: 0, E: 9, M: 9 };
    const boundU = makeGame({
        preview: { round: 7, shots: 0, bound: 'U', ties: [], detail, dry: false, recipeId: null, powered: false, shedOptions: [] },
        readout: readoutFull,
    });
    const panelU = panelOf(boundU);
    check(textOf(panelU).includes(UNPOWERED_WORKSHOP_TEXT), 'B：bind=U 且断电 ⇒ 逐字「弹药工坊断电（本波不造弹）」');
    check(panelU.textContent.split(UNPOWERED_WORKSHOP_TEXT).length === 2, 'B：断电文案只出现一次（原因行与提示行不重复写）');

    const boundA = makeGame({
        preview: { round: 7, shots: 2, bound: 'A', ties: [], detail: { A: 2, U: 0, E: 9, M: 9 }, dry: false, recipeId: null, powered: false, shedOptions: [] },
        readout: readoutFull,
    });
    check(textOf(panelOf(boundA)).includes(UNPOWERED_WORKSHOP_TEXT), 'B：bind=A 但工坊断电 ⇒ 仍提示断电文案');

    // 断电文案与第 4 步规范出处逐字一致（谁改了字，这里先红）
    const workshopSrc = fs.readFileSync(path.join(repoRoot, 'src/utils/workshop_capacity_utils.js'), 'utf8');
    check(workshopSrc.includes(`'${UNPOWERED_WORKSHOP_TEXT}'`), 'B：UI 断电文案与 workshop_capacity_utils 的既定串逐字相同（防漂移）');
}

// ---------------- C：干回合 ----------------
{
    const game = makeGame({
        preview: {
            round: 7, shots: 2, bound: 'A', ties: [], detail: { A: 2, U: 4, E: 9, M: 9 },
            dry: true, recipeId: null, powered: true, shedOptions: [],
        },
        readout: readoutFull,
    });
    const text = textOf(panelOf(game));
    check(text.includes('沿用上波发数'), 'C：干回合露出「沿用上波发数」提示');
    check(text.includes(DRY_WAVE_TEXT), 'C：干回合提示与常量一致');
}

// ---------------- D：预演不可用三种情形都不炸 ----------------
{
    const modes = [
        { mode: 'missing', label: '方法缺失' },
        { mode: 'throws', label: '抛错' },
        { mode: 'undefined', label: '返回 undefined' },
    ];
    modes.forEach(({ mode, label }) => {
        let panel = null;
        let threw = null;
        try {
            panel = panelOf(makeGame({ previewMode: mode, preview: undefined, readout: readoutFull }));
        } catch (err) { threw = err; }
        check(threw === null, `D/${label}：面板渲染不抛错（${threw && threw.message}）`);
        if (!panel) return;
        const text = textOf(panel);
        check(text.includes(PREVIEW_UNAVAILABLE_TEXT), `D/${label}：渲染出「${PREVIEW_UNAVAILABLE_TEXT}」占位`);
        check(text.includes('现有料') && text.includes('本波将扣料'), `D/${label}：其余三块照常渲染`);
        check(itemsWith(panel, 'recipe').length === RECIPES.length, `D/${label}：配方行照常逐条渲染`);
        check(itemsWith(panel, 'material').length === MATERIAL_VIEWS.length, `D/${label}：三色料照常渲染`);
    });

    // 返回非对象（字符串 / 数组）同样视为不可用
    const weird = makeGame({ preview: 'oops', readout: readoutFull });
    check(textOf(panelOf(weird)).includes(PREVIEW_UNAVAILABLE_TEXT), 'D：返回非对象 ⇒ 也走占位');
}

// ---------------- E：spent 缺失显示 0 ----------------
{
    const noSpent = makeGame({
        preview: { round: 7, shots: 2, bound: 'A', ties: [], detail: { A: 2, U: 4, E: 9, M: 9 }, dry: false, recipeId: null, powered: true, shedOptions: [] },
        readout: { pyro: 4, cryo: 2, beast: 1 },
    });
    const panel = panelOf(noSpent);
    const text = textOf(panel);
    check(itemsWith(panel, 'spentTotal')[0].dataset.spentTotal === '0', 'E：spent 缺失 ⇒ spentTotal 显示 0');
    check(text.includes('0 料'), 'E：显示「0 料」，不显示 undefined');
    check(!text.includes('undefined') && !text.includes('NaN'), 'E：整块不出现 undefined / NaN');

    // plannedSpent 缺 total、逐桶在 ⇒ 按桶相加（结构性恒等，与本块「料」的口径一致）
    // 注：数据源随口径迁移到 `sys_getWavePreview().plannedSpent`（整备屏在开战前，`readout.spent` 此刻恒 0）
    const partial = makeGame({
        preview: {
            round: 7, shots: 2, bound: 'A', ties: [], detail: { A: 2, U: 4, E: 9, M: 9 },
            dry: false, recipeId: null, powered: true, shedOptions: [],
            plannedSpent: { pyro: 3 },
        },
        readout: { pyro: 1, cryo: 0, beast: 0 },
    });
    const partialPanel = panelOf(partial);
    check(itemsWith(partialPanel, 'spentTotal')[0].dataset.spentTotal === '3', 'E：plannedSpent 缺 total ⇒ 用两桶相加（pyro 3 + cryo 0）');
    check(!textOf(partialPanel).includes('undefined'), 'E：缺 cryo 键也不出现 undefined');

    // 数据源已切到 plannedSpent：账本 `readout.spent` 再大也不许驱动本块（否则又会显示恒 0 的旧口径）
    const switched = makeGame({
        preview: {
            round: 7, shots: 2, bound: 'A', ties: [], detail: { A: 2, U: 4, E: 9, M: 9 },
            dry: false, recipeId: null, powered: true, shedOptions: [],
            plannedSpent: { pyro: 4, cryo: 2, beast: 0, total: 6 },
        },
        readout: { pyro: 9, cryo: 9, beast: 0, spent: { pyro: 3, cryo: 0 }, spentTotal: 3 },
    });
    check(itemsWith(panelOf(switched), 'spentTotal')[0].dataset.spentTotal === '6',
        'E：将扣料读 plannedSpent.total（6），不读账本 spentTotal（3）');

    // 脏值：NaN / 负数 / 字符串
    const dirty = makeGame({
        preview: null, previewMode: 'missing',
        readout: { pyro: NaN, cryo: -5, beast: 'x', spent: { pyro: 'abc', cryo: -1 }, spentTotal: NaN },
    });
    const dirtyPanel = panelOf(dirty);
    const dirtyText = textOf(dirtyPanel);
    check(!dirtyText.includes('NaN') && !dirtyText.includes('undefined'), 'E：脏读数不落 NaN / undefined');
    check(itemsWith(dirtyPanel, 'spentTotal')[0].dataset.spentTotal === '0', 'E：脏 spent ⇒ 显示 0');
    check(itemsWith(dirtyPanel, 'material').every(n => n.dataset.value === '0'), 'E：脏料量 ⇒ 三色料都显示 0');
}

// ---------------- F：配方逐条 + 锁定态不可选 ----------------
{
    const game = makeGame({ preview: null, previewMode: 'missing', readout: readoutFull, selectedId: null });
    const panel = panelOf(game);
    const rows = itemsWith(panel, 'recipe');
    check(rows.length === RECIPES.length, `F：配方行数 = 配置条数（${rows.length}/${RECIPES.length}）`);

    RECIPES.forEach(recipe => {
        const row = rows.find(r => r.dataset.recipe === recipe.id);
        check(!!row, `F：配方 ${recipe.id} 有自己的一行`);
        if (!row) return;
        check(textOf(row).includes(recipe.displayName), `F：${recipe.id} 显示 displayName`);
        Object.keys(recipe.cost || {}).forEach(key => {
            const amount = Number(recipe.cost[key]);
            // 屏上料名一律中文（`火料 3`），键名不许上屏（与缺料提示同一张 `MATERIAL_LABELS` 表）
            if (!(amount > 0)) {
                check(!textOf(row).includes(`${MATERIAL_LABELS[key]} 0`), `F：${recipe.id} 不显示 ${MATERIAL_LABELS[key]} 0（0 需求不列）`);
                return;
            }
            check(textOf(row).includes(`${MATERIAL_LABELS[key]} ${amount}`), `F：${recipe.id} 单发成本显示为「${MATERIAL_LABELS[key]} ${amount}」`);
        });
        // 倍率位已删（`damageMult` 判死）：配方行只许有「成本 · 够几发」，不允许出现 ×N
        check(!textOf(row).includes('×'), `F：${recipe.id} 不显示单发倍率（无 ×N）`);
        check(!Object.prototype.hasOwnProperty.call(recipe, 'damageMult'), `F：配置里 ${recipe.id} 已无 damageMult 字段`);
        // 够哪一档：以现有料逐料取最小（readoutFull 是 pyro 9 / cryo 9）
        const stock = { pyro: 9, cryo: 9 };
        const affordable = Math.min(...Object.keys(recipe.cost || {})
            .filter(key => Number(recipe.cost[key]) > 0)
            .map(key => Math.floor(stock[key] / Number(recipe.cost[key]))));
        if (recipe.blueprintRequired) {
            check(!textOf(row).includes('够 '), `F：${recipe.id} 锁定行不显示「够几发」（选了也用不上）`);
        } else {
            check(textOf(row).includes(`够 ${affordable} 发`), `F：${recipe.id} 显示「够 ${affordable} 发」`);
        }
        if (recipe.blueprintRequired) {
            check(row.dataset.recipeState === 'locked', `F：${recipe.id}（需设计图）为锁定态`);
            check(row.disabled === true, `F：${recipe.id} 锁定 ⇒ 按钮 disabled，点不进去`);
            check(textOf(row).includes('需设计图'), `F：${recipe.id} 锁定 ⇒ 明示「需设计图」`);
        } else {
            check(row.dataset.recipeState !== 'locked', `F：${recipe.id} 已解锁 ⇒ 不是锁定态`);
            check(row.disabled === false, `F：${recipe.id} 已解锁 ⇒ 可点`);
        }
    });

    // 选中态：未手选 ⇒ 默认落在已解锁里成本最低那条
    const selectedRows = rows.filter(r => r.dataset.recipeState === 'selected');
    check(selectedRows.length === 1, `F：恰有一行处于选中态（实测 ${selectedRows.length}）`);
    check(textOf(selectedRows[0]).includes('已选'), 'F：选中行标「已选」');

    // 点锁定行：不写状态、不重绘；点可选行：写入并重绘
    const lockedRecipe = RECIPES.find(r => r.blueprintRequired);
    if (lockedRecipe) {
        const lockedRow = rows.find(r => r.dataset.recipe === lockedRecipe.id);
        lockedRow.dispatch('click');
        check(game._selectedRecipeId === null, `F：点锁定配方 ${lockedRecipe.id} 不写入选择`);
        game.ui_selectAmmoRecipe(lockedRecipe.id);
        check(game._selectedRecipeId === null, `F：程序化选锁定配方 ${lockedRecipe.id} 也被拒`);
        check(!game._renderCalls, 'F：被拒的选择不触发重绘');
    }
    const pickable = RECIPES.filter(r => !r.blueprintRequired && r.id !== selectedRows[0].dataset.recipe);
    if (pickable.length) {
        const target = pickable[0];
        rows.find(r => r.dataset.recipe === target.id).dispatch('click');
        check(game._selectedRecipeId === target.id, `F：点可选配方 ${target.id} ⇒ 写入 _selectedRecipeId`);
        check(game._renderCalls === 1, 'F：选择后重绘一次');
        const after = panelOf(makeGame({ preview: null, previewMode: 'missing', readout: readoutFull, selectedId: target.id }));
        check(itemsWith(after, 'recipe').find(r => r.dataset.recipe === target.id).dataset.recipeState === 'selected',
            'F：重绘后选中态跟到新配方');
    }
}

// ---------------- I：null 不许当 0 显示（与「0 照常显示 0」成对断言）----------------
{
    // 真机实测那组（1280×1600 截图）：U / E 是 null（未建造），不是 0；bound = M，ties 把 bound 自己列了进去
    const real = {
        shots: 1, bound: 'M', ties: ['M'],
        detail: { A: 2, U: null, E: null, M: 1 },
        powered: false,
    };
    const game = makeGame({ preview: real, readout: { pyro: 0, cryo: 0, beast: 0, spent: { pyro: 3, cryo: 0 }, spentTotal: 3 } });
    const panel = panelOf(game);
    const text = textOf(panel);
    const chips = itemsWith(panel, 'limit');
    const chip = key => chips.find(c => c.dataset.limit === key);

    // ① null ⇒ 未建造（不许显示 0）
    check(chip('U').dataset.built === 'false', 'I：detail.U = null ⇒ 该格标记为未建造');
    check(chip('E').dataset.built === 'false', 'I：detail.E = null ⇒ 该格标记为未建造');
    check(chip('U').textContent.includes('未建造') && chip('E').textContent.includes('未建造'),
        'I：产能 / 电力两格显示「未建造」');
    check(chip('U').dataset.value === undefined && chip('E').dataset.value === undefined,
        'I：未建造的格不带数值（不出现「产能 0、电力 0」这种自相矛盾的屏）');
    check(!/产能\s*0/.test(text) && !/电力\s*0/.test(text), 'I：整屏不出现「产能 0」「电力 0」');
    // ② 真数字照原样（含 1 / 2）
    check(chip('A').dataset.value === '2' && chip('A').dataset.built === 'true', 'I：射速 2 照原样显示');
    check(chip('M').dataset.value === '1' && chip('M').dataset.built === 'true', 'I：料 1 照原样显示');
    // ③ 绑定态只落在真数字那格上
    check(chips.filter(c => c.dataset.active === 'true').length === 1 && chip('M').dataset.active === 'true',
        'I：绑定态只给 M（未建造的轴不进绑定态）');
    // ④ 未建造 ⇒ 说「未建造」，不许说「断电」
    check(text.includes('弹药工坊未建造（本波靠料）'), 'I：工坊未建造走「弹药工坊未建造（本波靠料）」');
    check(!text.includes('断电'), 'I：未建造时整屏不出现「断电」');
    // ⑤ 原因句与发数仍然正确
    check(text.includes('料只够装 1 发'), 'I：绑定原因仍是「料只够装 1 发」');
    check(itemsWith(panel, 'waveShots')[0].dataset.waveShots === '1', 'I：发数大字仍为 1 发');
    // ⑥ ties 把 bound 自己列进去 ⇒ 不显示并列
    check(!text.includes('并列'), 'I：ties=["M"] 且 bound=M ⇒ 不显示并列提示');
}

{
    // 成对：同样是「已建造但为 0」，必须照常显示 0 且走断电文案（这一对断言防止改一处弄坏另一处）
    const zero = {
        shots: 0, bound: 'U', ties: [],
        detail: { A: 2, U: 0, E: 0, M: 5 },
        powered: false, workshopBuilt: true,
    };
    const panel = panelOf(makeGame({ preview: zero, readout: readoutFull }));
    const chips = itemsWith(panel, 'limit');
    const chip = key => chips.find(c => c.dataset.limit === key);
    check(chip('U').dataset.built === 'true' && chip('U').dataset.value === '0', 'I：detail.U = 0（已建造）⇒ 显示 0，不是未建造');
    check(chip('U').textContent.includes('0') && !chip('U').textContent.includes('未建造'), 'I：0 那格写成 0');
    check(chip('E').dataset.built === 'true' && chip('E').dataset.value === '0', 'I：detail.E = 0（已建造）⇒ 显示 0');
    check(chip('U').dataset.active === 'true', 'I：已建造的 U=0 仍可进绑定态（0 是真的卡点）');
    check(textOf(panel).includes(UNPOWERED_WORKSHOP_TEXT), 'I：已建造 + 断电 ⇒ 逐字断电文案');
    check(!textOf(panel).includes('未建造'), 'I：已建造时不说「未建造」');
}

// ---------------- J：工坊三态判定（未建造 / 断电 / 通电，缺字段不臆断）----------------
{
    const base = { shots: 1, bound: 'M', ties: [], detail: { A: 2, U: 3, E: 9, M: 1 }, powered: true };
    const t = preview => textOf(panelOf(makeGame({ preview: { ...base, ...preview }, readout: readoutFull })));

    // 已建造 + 通电 ⇒ 三句都不出现
    const ok = t({ workshopBuilt: true, powered: true });
    check(!ok.includes('断电') && !ok.includes('未建造'), 'J：已建造且通电 ⇒ 不给任何工坊提示');

    // 已建造 + 断电 ⇒ 断电（逐字）
    check(t({ workshopBuilt: true, powered: false }).includes(UNPOWERED_WORKSHOP_TEXT), 'J：workshopBuilt=true + powered=false ⇒ 逐字断电文案');

    // 明确未建造（即使 powered=false）⇒ 未建造，不说断电
    const unbuilt = t({ workshopBuilt: false, powered: false });
    check(unbuilt.includes('弹药工坊未建造（本波靠料）'), 'J：workshopBuilt=false ⇒ 未建造文案');
    check(!unbuilt.includes('断电'), 'J：workshopBuilt=false 时不说断电');

    // workshopBuilt 缺失 ⇒ 用 detail.U === null 推断未建造
    const inferred = t({ workshopBuilt: undefined, detail: { A: 2, U: null, E: 9, M: 1 }, powered: false });
    check(inferred.includes('弹药工坊未建造（本波靠料）'), 'J：workshopBuilt 缺失 + detail.U=null ⇒ 推断未建造');

    // workshopBuilt 缺失 + detail.U 是数字 ⇒ 视为已建造
    const inferredBuilt = t({ workshopBuilt: undefined, detail: { A: 2, U: 3, E: 9, M: 1 }, powered: false });
    check(inferredBuilt.includes(UNPOWERED_WORKSHOP_TEXT), 'J：workshopBuilt 缺失 + detail.U 数字 ⇒ 视为已建造，走断电文案');

    // 两者都拿不到 ⇒ 一句都不说（宁可不说，不许说错）
    const unknown = t({ workshopBuilt: undefined, detail: { A: 2, M: 1 }, powered: false });
    check(!unknown.includes('弹药工坊'), 'J：既无 workshopBuilt 又无 detail.U ⇒ 不显示任何工坊提示句');
    check(!unknown.includes('断电'), 'J：工坊状态未知时也不许说「断电」');

    // bound=U 且 U 未建造 ⇒ 原因行说未建造、该格不高亮、且不重复写
    const boundUnbuilt = panelOf(makeGame({
        preview: { shots: 0, bound: 'U', ties: ['U'], detail: { A: 2, U: null, E: 9, M: 5 }, powered: false },
        readout: readoutFull,
    }));
    const buText = textOf(boundUnbuilt);
    check(buText.includes('弹药工坊未建造（本波靠料）'), 'J：bound=U 且未建造 ⇒ 原因行给未建造文案');
    check(buText.split('弹药工坊未建造（本波靠料）').length === 2, 'J：未建造文案只出现一次（原因行与提示行不重复）');
    check(itemsWith(boundUnbuilt, 'limit').find(c => c.dataset.limit === 'U').dataset.active === 'false',
        'J：未建造的 U 即使在 bound 里也不高亮');
    check(!buText.includes('并列'), 'J：ties 只含未建造轴 ⇒ 不显示并列');
}

// ---------------- F2：形成本走运行时出口（实扣价，未建工坊含手工溢价）----------------
// 这一节守的是本轮主修：屏上成本 / 够打几发 / 默认配方挑选都必须与开战实扣同源，
// 不许再按配方原价算（否则屏上印 3 料、账上扣 6 料，够打几发还高估一倍）。
{
    const unlocked = RECIPES.filter(r => !r.blueprintRequired);
    const single = unlocked.find(r => r.id === 'ammo_pyro_single') || unlocked[0];
    const other = unlocked.find(r => r.id !== single.id) || null;
    // 手工溢价口径的换算结果由运行时出口给（本测试只喂「已换算好的成本」，不在测试里算倍率）
    const doubled = id => {
        const r = RECIPES.find(x => x.id === id);
        if (!r) return null;
        const perShotCost = {};
        Object.keys(r.cost || {}).forEach(k => {
            const n = Number(r.cost[k]);
            if (n > 0) perShotCost[k] = n * (Number(CONFIG.gameplay.build.workshop.manualMaterialMultiplier) || 1);
        });
        return { recipeId: id, perShotCost, workshopBuilt: false };
    };
    const game = makeGame({ preview: null, previewMode: 'missing', readout: { pyro: 9, cryo: 9, beast: 9 }, selectedId: null });
    game.sys_getShotCostForRecipe = doubled;
    const rows = itemsWith(panelOf(game), 'recipe');

    const singleRow = rows.find(r => r.dataset.recipe === single.id);
    check(!!singleRow, `F2：${single.id} 有自己的一行`);
    if (singleRow) {
        Object.keys(single.cost || {}).filter(k => Number(single.cost[k]) > 0).forEach(key => {
            const raw = Number(single.cost[key]);
            const per = raw * (Number(CONFIG.gameplay.build.workshop.manualMaterialMultiplier) || 1);
            check(textOf(singleRow).includes(`${MATERIAL_LABELS[key]} ${per}`), `F2：${single.id} 成本显示实扣价「${MATERIAL_LABELS[key]} ${per}」`);
            if (per !== raw) {
                check(!textOf(singleRow).includes(`${MATERIAL_LABELS[key]} ${raw}`), `F2：${single.id} 不再显示配方原价「${MATERIAL_LABELS[key]} ${raw}」`);
            }
        });
        // 够打几发同样按实扣价：料 9 / (原价 × 倍率) 向下取整
        const perKey = Object.keys(single.cost).filter(k => Number(single.cost[k]) > 0);
        const mult = Number(CONFIG.gameplay.build.workshop.manualMaterialMultiplier) || 1;
        const afford = Math.min(...perKey.map(k => Math.floor(9 / (Number(single.cost[k]) * mult))));
        check(textOf(singleRow).includes(`够 ${afford} 发`), `F2：${single.id} 够打几发按实扣价算（「够 ${afford} 发」）`);
    }

    // 默认配方按**实扣价**总量挑（不是原价）：把实扣价扭成「另一条更便宜」，选中态必须跟着实扣价走
    if (other) {
        const forced = makeGame({ preview: null, previewMode: 'missing', readout: { pyro: 9, cryo: 9, beast: 9 }, selectedId: null });
        forced.sys_getShotCostForRecipe = id => ({
            recipeId: id,
            perShotCost: id === other.id ? { pyro: 1, cryo: 1 } : { pyro: 9, cryo: 9 },
            workshopBuilt: false,
        });
        const forcedRows = itemsWith(panelOf(forced), 'recipe');
        const selected = forcedRows.filter(r => r.dataset.recipeState === 'selected');
        check(selected.length === 1 && selected[0].dataset.recipe === other.id,
            `F2：默认配方按实扣价取最低（期望 ${other.id}，实测 ${selected.map(r => r.dataset.recipe).join('/') || '无'}）`);
    }
}

// ---------------- G / H：静态红线 ----------------
{
    const files = ['src/ui/build_screen.js', 'src/ui/components/wave_ammo.js'];
    const banned = ['装填', '打不满', '预弹'];
    const horizontal = [/overflow-x/i, /overflowX/, /scrollLeft/];
    const hardNumbers = ['1.25', '1.6', '347'];
    files.forEach(rel => {
        const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
        banned.forEach(word => check(!src.includes(word), `G：${rel} 不含「${word}」`));
        horizontal.forEach(re => check(!re.test(src), `G：${rel} 无水平滚动写法 ${re}`));
        hardNumbers.forEach(num => check(!src.includes(num), `H：${rel} 不写死配方数值 ${num}`));
        check(!/grid-template-columns:\s*repeat\(\s*\d+\s*,\s*minmax\(0,\s*1fr\)\s*\)\s*;[^\n]*overflow/.test(src),
            `G：${rel} 没有「横向网格 + 溢出」组合写法`);
    });
    // 倍率已删（`damageMult` 判死）：面板侧**不许**再有倍率读取点，也不许留倍率格式化函数
    const compSrc = fs.readFileSync(path.join(repoRoot, 'src/ui/components/wave_ammo.js'), 'utf8');
    check(!/CONFIG/.test(compSrc), 'H：渲染件不读 CONFIG（数值一律由 build_screen 从配置读后传入）');
    check(!/export\s+function\s+formatMultiplier/.test(compSrc), 'H：渲染件已无倍率格式化函数（倍率随 damageMult 一起删）');
    check(!/multText/.test(compSrc), 'H：渲染件不再收倍率位（createRecipeRow 无 multText 参数）');
    const buildSrc = fs.readFileSync(path.join(repoRoot, 'src/ui/build_screen.js'), 'utf8');
    check(!/\.damageMult\b/.test(buildSrc), 'H：整备屏源码不读 damageMult 字段（该字段已从配置删除）');
    check(!/formatMultiplier/.test(buildSrc), 'H：整备屏不调倍率格式化函数');
    check(/cfg\(\)\.recipes/.test(buildSrc), 'H：配方表一律从 CONFIG.gameplay.build.recipes 读');
}

// ---------------- 附加：整备屏整屏渲染冒烟 + 面板位置 ----------------
{
    const root = mountBuildRoot();
    const game = Object.assign({}, build_screen_system, {
        digCount: 3,
        round: 3,
        enemies: [],
        _pendingBossSpawn: false,
        _facilityPulse: null,
        sys_getBuildState: () => ({
            energy: 120, crystal: 2,
            cannonLevels: { dmg: 0, rate: 0, bounce: 0 },
            cannonBranch: null,
            facilities: [null, null, null],
            facilitySlotsOpen: 1,
            items: [],
            miningLevels: { collector: 0 },
        }),
        sys_getBuildReveal: () => new Set(),
        sys_getCannonStats: () => ({ damage: 1, shots: 2, bounce: 0 }),
        sys_buildPurchase: () => {},
        sys_commitBuild: () => {},
        sys_getMaterialReadout: () => ({ pyro: 6, cryo: 3, beast: 2, spent: { pyro: 3, cryo: 0 }, spentTotal: 3 }),
        sys_getWavePreview: () => ({
            round: 3, shots: 2, bound: 'M', ties: [], detail: { A: 4, U: 3, E: 9, M: 2 },
            dry: false, recipeId: null, powered: true, shedOptions: [{ key: 'frost', draw: 6 }],
            plannedSpent: { pyro: 3, cryo: 0, beast: 0, total: 3 },
        }),
    });
    let threw = null;
    try { game.ui_renderBuildScreen(); } catch (err) { threw = err; }
    check(threw === null, `冒烟：整备屏整屏渲染不抛错（${threw && threw.message}）`);
    const scroll = root.querySelector('.build-scroll');
    check(!!scroll, '冒烟：渲染出 .build-scroll');
    const panels = scroll ? scroll.collect().filter(n => String(n.className).split(/\s+/).includes('ui-panel')) : [];
    // 2026-10-26 改（第 2 步收口）：原断言是 `panels[0].id === 'build-ammo'` 与 `panels[1].id === 'build-cannon'`，
    //   它守的真实意图是「新增的『本波弹药』块不许被挤到既有『主炮』之下」。本轮整备屏首屏重排
    //   （依据 `src/ui/build_screen.js:716-727`：落位改为「设施 → 工厂网格 → 本波弹药 → 主炮」）把这个
    //   **索引前提**改掉了 —— `build-ammo` 不再排第 0；而收集用的是深度优先 `collect()`，嵌套或置顶容器都绕不开，
    //   所以旧断言与新顺序结构性互斥，只能改写法、不能弱化意图。
    //   改为断言**精确 id 全序**：同守「弹药块紧随两处建造面、不落到主炮之下」，且更严 ——
    //   任意两块互换、或中间插进 / 少掉任何一块都会红；下面再单独留一条相对序断言把意图写死。
    const panelIds = panels.map(n => n.id).join(',');
    check(panelIds === 'build-facilities,build-grid,build-ammo,build-cannon,build-items,build-mining',
        `冒烟：滚动区面板全序为「设施→工厂网格→本波弹药→主炮→道具→挖矿」（实测：${panelIds}）`);
    const ammoAt = panels.findIndex(n => n.id === 'build-ammo');
    const cannonAt = panels.findIndex(n => n.id === 'build-cannon');
    check(ammoAt >= 0 && cannonAt >= 0 && ammoAt < cannonAt,
        `冒烟：「本波弹药」仍在「主炮」之上（本波弹药 #${ammoAt}、主炮 #${cannonAt}）`);
    check(root.textContent.includes('本波弹药') && root.textContent.includes('主炮'), '冒烟：新旧两块都在屏上');
    check(root.textContent.includes('料只够装 2 发'), '冒烟：预演原因串进到整屏');
    check(root.textContent.includes('3 料'), '冒烟：本波已扣料读数进到整屏');
}

// ---------------- 附加 2：真机那组数据的整屏冒烟（null 未建造 + 未建造不说断电） ----------------
{
    const root = mountBuildRoot();
    const game = Object.assign({}, build_screen_system, {
        digCount: 1,
        round: 1,
        enemies: [],
        _pendingBossSpawn: false,
        _facilityPulse: null,
        sys_getBuildState: () => ({
            energy: 60, crystal: 0,
            cannonLevels: { dmg: 0, rate: 0, bounce: 0 },
            cannonBranch: null,
            facilities: [null],
            facilitySlotsOpen: 1,
            items: [],
            miningLevels: { collector: 0 },
        }),
        sys_getBuildReveal: () => new Set(),
        sys_getCannonStats: () => ({ damage: 1, shots: 2, bounce: 0 }),
        sys_buildPurchase: () => {},
        sys_commitBuild: () => {},
        sys_getMaterialReadout: () => ({ pyro: 0, cryo: 0, beast: 0, spent: { pyro: 3, cryo: 0 }, spentTotal: 3 }),
        // 取证驱动器实测的那一屏（逐字）：U / E 为 null，ties 把 bound 自己列了进去
        sys_getWavePreview: () => ({
            shots: 1, bound: 'M', ties: ['M'],
            detail: { A: 2, U: null, E: null, M: 1 },
            powered: false,
        }),
    });
    let threw = null;
    try { game.ui_renderBuildScreen(); } catch (err) { threw = err; }
    check(threw === null, `冒烟2：真机那组数据整屏渲染不抛错（${threw && threw.message}）`);
    const text = root.textContent;
    check(text.includes('1 发'), '冒烟2：发数「1 发」上屏');
    check(text.includes('未建造'), '冒烟2：产能 / 电力两格显示「未建造」');
    check(!text.includes('断电'), '冒烟2：第 1 波没建工坊，全屏不出现「断电」');
    check(!/产能\s*0/.test(text) && !/电力\s*0/.test(text), '冒烟2：不出现「产能 0」「电力 0」与 1 发的矛盾组合');
    check(text.includes('料只够装 1 发'), '冒烟2：绑定原因仍是「料只够装 1 发」');
}

// ---------------- 附加 3：第 1 波整备屏的设施面板（料付设施可见 / 开位仍锁 / 升级给锁定态）----------------
// 依据 `src/config.js:1174`（原注释逐字）：「第 1 波就能看见料付设施（当波买不起，第 2 波凑够）」。
// 旧行为缺陷：面板按 `!revealed({type:'slot'})` 整块吞掉 ⇒ 第 1 波只留一行「设施位：第2波解锁」，
//   玩家连「弹药工坊」四个字都看不到，更无从用料买它。面板该按「有没有已解锁设施」决定渲染。
{
    const BUILD = CONFIG.gameplay.build;
    const wave1Reveal = getReveal({ wave: 1, bossKills: 0 }, BUILD);
    const wave2Reveal = getReveal({ wave: 2, bossKills: 0 }, BUILD);
    check(wave1Reveal.has('workshop') && wave1Reveal.has('generator') && !wave1Reveal.has('slots'),
        '第 1 波：reveal 含 workshop / generator、不含 slots（与盘上 config.js:1174-1175 一致）');

    /** 渲染整屏并返回设施面板 + 屏上按钮（`dataset.buy` 前缀 `build-` / `slot-` / `upgrade-`）。 */
    function renderFacPanel({ wave, reveal, facilities, slotsOpen, energy = 120, stock = { pyro: 9, cryo: 9, beast: 9 } }) {
        const root = mountBuildRoot();
        const game = Object.assign({}, build_screen_system, {
            digCount: wave,
            round: wave,
            enemies: [],
            _pendingBossSpawn: false,
            _facilityPulse: null,
            sys_getBuildState: () => ({
                energy, crystal: 0,
                cannonLevels: { dmg: 0, rate: 0, bounce: 0 },
                cannonBranch: null,
                facilities,
                facilitySlotsOpen: slotsOpen,
                items: [],
                miningLevels: { collector: 0 },
            }),
            sys_getBuildReveal: () => reveal,
            sys_getCannonStats: () => ({ damage: 1, shots: 2, bounce: 0 }),
            sys_buildPurchase: () => {},
            sys_commitBuild: () => {},
            sys_getMaterialReadout: () => stock,
        });
        let threw = null;
        try { game.ui_renderBuildScreen(); } catch (err) { threw = err; }
        const panel = root.querySelector('#build-facilities');
        const btns = panel ? panel.collect().filter(n => n.dataset && typeof n.dataset.buy === 'string') : [];
        const byPrefix = p => btns.filter(b => b.dataset.buy.startsWith(p));
        return { threw, root, panel, byPrefix };
    }

    // ① `facilitySlotsOpen = 2` + `digCount = 1`：已开格照常渲染，空位给「建造」，无「开位」，无整块提示
    {
        const { threw, panel, byPrefix } = renderFacPanel({
            wave: 1, reveal: wave1Reveal, facilities: [null, null, null], slotsOpen: 2,
        });
        check(threw === null, `设施面板/w1：整屏渲染不抛错（${threw && threw.message}）`);
        check(!!panel, '设施面板/w1：#build-facilities 面板存在');
        if (panel) {
            check(!!panel.querySelector('.build-slots'), '设施面板/w1：设施网格 .build-slots 已渲染（整块不再被吞）');
            check(byPrefix('build-').length === 2,
                `设施面板/w1：两个已开空位各有一颗「建造」按钮（实测 ${byPrefix('build-').length}）`);
            check(byPrefix('build-').every(b => String(b.textContent).includes('建造')),
                '设施面板/w1：「建造」按钮的标签就是「建造」');
            check(byPrefix('slot-').length === 0,
                `设施面板/w1：slots 未解锁 ⇒ 不渲染「开位」按钮（实测 ${byPrefix('slot-').length}）`);
            check(!String(panel.textContent).includes('设施位：第2波解锁'),
                '设施面板/w1：不出现「设施位：第2波解锁」整块提示（那行只在「一座设施都没解锁」时退回）');
        }
    }

    // ② 一座设施都没解锁（空 reveal）⇒ 才退回整块提示（防「把闸门拆成全放开」的另一侧）
    {
        const { threw, panel, byPrefix } = renderFacPanel({
            wave: 1, reveal: new Set(), facilities: [null, null, null], slotsOpen: 2,
        });
        check(threw === null, `设施面板/无解锁：整屏渲染不抛错（${threw && threw.message}）`);
        if (panel) {
            check(String(panel.textContent).includes('设施位：第2波解锁'),
                '设施面板/无解锁：一座设施都没解锁时才退回整块提示文案');
            check(byPrefix('build-').length === 0, '设施面板/无解锁：没有「建造」按钮（无从建起）');
        }
    }

    // ③ 升级按钮补锁定态：第 1 波刚建好的工坊，升级必须置灰 + title 写解锁时机（口径同设施弹层）
    {
        const built = [ { type: 'workshop', level: 1, cd: 0 }, null, null ];
        const w1 = renderFacPanel({ wave: 1, reveal: wave1Reveal, facilities: built, slotsOpen: 2 });
        const up1 = w1.byPrefix('upgrade-')[0];
        check(!!up1, '设施面板/w1：已建成工坊的卡片上有「升级」按钮');
        if (up1) {
            check(up1.disabled === true, '设施面板/w1：slots 未解锁 ⇒ 升级按钮置灰（不再「能点却弹 locked 报错」）');
            check(String(up1.getAttribute('title')) === '第2波解锁',
                `设施面板/w1：升级按钮 title 写解锁时机（实测「${up1.getAttribute('title')}」）`);
        }
        // 成对：第 2 波（slots 已解锁 + 料够 Lv1→Lv2 的 {pyro:6,cryo:3,beast:3}）⇒ 升级可用，title 不再是解锁文案
        const w2 = renderFacPanel({ wave: 2, reveal: wave2Reveal, facilities: built, slotsOpen: 2 });
        const up2 = w2.byPrefix('upgrade-')[0];
        check(!!up2, '设施面板/w2：工坊卡片上仍有「升级」按钮');
        if (up2) {
            check(!String(up2.getAttribute('title')).includes('第2波'),
                `设施面板/w2：slots 已解锁 ⇒ title 不再是解锁文案（实测「${up2.getAttribute('title')}」）`);
            check(up2.disabled === false, '设施面板/w2：料够 ⇒ 升级按钮可点');
        }
    }

    // ④ 第 1 波的建造弹层：工坊 / 发电机按名字可见且**不是锁定态**（锁的是料，不是解锁），炮台仍锁
    {
        const root = mountBuildRoot();
        const game = Object.assign({}, build_screen_system, {
            sys_getBuildState: () => ({
                energy: 52, crystal: 0,
                cannonLevels: { dmg: 0, rate: 0, bounce: 0 },
                cannonBranch: null,
                facilities: [null, null, null],
                facilitySlotsOpen: 2,
                items: [],
                miningLevels: { collector: 0 },
            }),
            sys_getBuildReveal: () => wave1Reveal,
            sys_buildPurchase: () => {},
            // 第 1 波刚挖完：料还是 0（「当波买不起」）⇒ 弹层里这两个键靠**料不足**置灰，不靠解锁
            sys_getMaterialReadout: () => ({ pyro: 0, cryo: 0, beast: 0 }),
        });
        let threw = null;
        try { game.ui_openFacilityPicker(0); } catch (err) { threw = err; }
        check(threw === null, `设施弹层/w1：ui_openFacilityPicker 不抛错（${threw && threw.message}）`);
        const btn = type => root.collect().find(n => n.dataset && n.dataset.facility === type);
        const ws = btn('workshop');
        const gen = btn('generator');
        check(!!ws && !!gen, '设施弹层/w1：工坊与发电机各有一颗按钮（第 1 波就看得见料付设施）');
        check(root.textContent.includes('弹药工坊') && root.textContent.includes('发电机'),
            '设施弹层/w1：屏上出现「弹药工坊」「发电机」两个名字');
        if (ws) {
            check(!String(ws.getAttribute('title')).includes('第2波'),
                `设施弹层/w1：工坊不再按解锁拒绝（实测「${ws.getAttribute('title')}」）`);
            check(String(ws.getAttribute('title')).includes('料不足'),
                `设施弹层/w1：料 0 ⇒ 工坊靠「料不足」置灰（实测「${ws.getAttribute('title')}」）`);
        }
        if (gen) {
            check(!String(gen.getAttribute('title')).includes('第2波'),
                `设施弹层/w1：发电机不再按解锁拒绝（实测「${gen.getAttribute('title')}」）`);
        }
        const turretBtn = btn('turret');
        check(!!turretBtn && String(turretBtn.getAttribute('title')).includes('第2波'),
            `设施弹层/w1：炮台仍按解锁锁定（实测「${turretBtn && turretBtn.getAttribute('title')}」）`);
    }
}

// ---------------- K：设施弹层 ui_openFacilityPicker（8 件全渲染 / 料 0 置灰 / 料价串）----------------
// 背景：上一批的真缺陷是「弹层价格节点写成嵌套数组 ⇒ 真 DOM appendChild(Array) 抛错」，旧桩完全没报错。
// 本节三条用例跑在已加固的桩上（appendChild 收非节点即抛），"不抛错" 才开始有拦截力。
{
    const BUILD = CONFIG.gameplay.build;
    const FAC_CFG = BUILD.facilities || {};
    // 解锁集合一律从配置取（`build` 动作要 'slots' + 设施键，见 build_economy_utils 的 _revealKeysFor）
    const allReveal = new Set(Object.values(BUILD.reveal || {}).flat());
    const RICH = { pyro: 999, cryo: 999, beast: 999 };
    const NONE = { pyro: 0, cryo: 0, beast: 0 };
    const NEW_FACILITIES = ['workshop', 'generator', 'battery'];

    function openPicker({ stock = RICH, energy = 9999 } = {}) {
        const root = mountBuildRoot();
        const game = Object.assign({}, build_screen_system, {
            sys_getBuildState: () => ({
                energy, crystal: 9,
                cannonLevels: { dmg: 0, rate: 0, bounce: 0 },
                cannonBranch: null,
                facilities: [null, null, null],
                facilitySlotsOpen: 1,
                items: [],
                miningLevels: { collector: 0 },
            }),
            sys_getBuildReveal: () => allReveal,
            sys_buildPurchase: () => {},
            sys_getMaterialReadout: () => stock,
        });
        let threw = null;
        try { game.ui_openFacilityPicker(0); } catch (err) { threw = err; }
        const modal = root.querySelector('#build-facility-picker');
        const buttons = root.collect().filter(n => n.dataset && typeof n.dataset.facility === 'string');
        return { threw, modal, buttons, root };
    }

    // a. 8 件设施全渲染，各出现一次，synth 不出现
    {
        const { threw, modal, buttons, root } = openPicker();
        check(threw === null, `K/a：料充足时 ui_openFacilityPicker 不抛错（${threw && threw.message}）`);
        check(!!modal, 'K/a：弹层节点挂上（#build-facility-picker）');
        check(buttons.length === FACILITY_IDS.length,
            `K/a：设施按钮数 = FACILITY_IDS 条数（实测 ${buttons.length}/${FACILITY_IDS.length}）`);
        FACILITY_IDS.forEach(type => {
            const hits = buttons.filter(b => b.dataset.facility === type);
            check(hits.length === 1, `K/a：${type} 恰好出现一次（实测 ${hits.length}）`);
            const label = FACILITY_LABELS[type];
            check(!!label && root.textContent.includes(label), `K/a：${type} 显示中文名「${label}」`);
        });
        check(!buttons.some(b => b.dataset.facility === 'synth'), 'K/a：本轮不开放的 synth 不出现');
        check(!root.textContent.includes('synth'), 'K/a：屏上不出现 synth 字样');
    }

    // b. 料 0 ⇒ 三件新设施置灰（disabled）+ 文案点明「料不足」
    {
        const { threw, buttons } = openPicker({ stock: NONE });
        check(threw === null, `K/b：料 0 时也不抛错（${threw && threw.message}）`);
        NEW_FACILITIES.forEach(type => {
            const btn = buttons.find(b => b.dataset.facility === type);
            check(!!btn, `K/b：${type} 有一颗按钮`);
            if (!btn) return;
            check(btn.disabled === true, `K/b：料 0 ⇒ ${type} 置灰（disabled）`);
            check(String(btn.getAttribute('title') || '').includes('料不足'),
                `K/b：料 0 ⇒ ${type} 的 title 点明「料不足」（实测「${btn.getAttribute('title')}」）`);
        });
    }

    // c. 料价串出现：新设施的可见文本里含它在配置里的 `materials` 计价数字（期望值一律读 CONFIG）
    {
        const { buttons } = openPicker();
        NEW_FACILITIES.forEach(type => {
            const btn = buttons.find(b => b.dataset.facility === type);
            const materials = (FAC_CFG[type] && FAC_CFG[type].materials) || {};
            const keys = Object.keys(materials).filter(k => Number(materials[k]) > 0);
            check(keys.length > 0, `K/c：${type} 在配置里确有料价（${keys.join('/') || '无'}）`);
            if (!btn) { check(false, `K/c：${type} 缺按钮，无法读料价`); return; }
            const matTag = btn.querySelector('.ui-price--materials');
            check(!!matTag, `K/c：${type} 有料价标签（.ui-price--materials）`);
            keys.forEach(key => {
                const need = Number(materials[key]);
                const part = (matTag ? matTag.collect() : [])
                    .find(n => String(n.className).split(/\s+/).includes(`ui-price__part--${key}`));
                check(!!part, `K/c：${type} 的料价里含 ${key} 一项`);
                const shown = part ? Number(String(part.textContent).replace(/\D+/g, '')) : NaN;
                check(shown === need, `K/c：${type} 的 ${key} 计价显示 ${need}（实测 ${shown}）`);
            });
        });
    }
}

// ---------------- 汇总 ----------------
console.log(`\n----- ${passed} passed / ${failed} failed -----`);
if (failed) {
    console.log('Failures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exitCode = 1;
} else {
    console.log('All build-screen materials checks passed.');
}
