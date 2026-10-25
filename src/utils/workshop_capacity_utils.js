/**
 * workshop_capacity_utils.js - [REQ-20261022-wave-loop · 经济接线 v2 第 4 步] 弹药工坊产能 `U` 纯函数层。
 *
 * 施工依据（逐条对齐，不得自行改数）：
 *   - `docs/design/economy_wiring_spec_v2_corrections.md:56-66` **C1 订正后写法**：
 *     `N = min(A, U, E, M)`，其中 `U = 弹药工坊产能上限`、`[待标定]`、**取值域 `1..5`、初始值必须 `< 5`**；
 *     五段条文 ② 原文「`A` 决定『这回合最多打几发』、`U` 决定『这回合实际能造几发』，恒有 `N ≤ A`」。
 *   - 同件 `:69`（§8 那一行）：`弹药工坊产能 U 每级值` ｜ 已定（取值域 `1..5`、初始 `< 5`）｜
 *     **只有耗电键 `[盘上]`，无产能键** ｜ `[待标定]`。
 *   - 同件 `:294-303` 附录 C-3 **第 4 步**「弹药工坊产能 `U` 接线」，前置＝步 3（`U` 按通电与否取值），
 *     回滚口径「同上」（＝断开「读配置」一步）。⇒ 本文件只做**纯函数**，
 *     **不接线主循环、不读运行时状态、不改任何既有文件**（接线属第 6 步）。
 *   - `docs/design/economy_wiring_spec_v2.md:155-172`（§4.1）：`:167` 只把 `U` 定义为
 *     「由弹药工坊的等级与是否通电决定」，产能值 `[不可判]`，需新增键、值 `[待标定]`。
 *
 * 三条结构决策（本步的取舍都在这里，返工时逐条对照）：
 *
 *   ① **产能表是入参，不是本文件里的数**。盘上**没有**任何产能键：
 *      `src/config.js:983` 原文「该设施尚未落 facilities，先只给耗电键」（`[盘上]`），
 *      `facilities` 段（`:963-970`）里确实没有 `workshop` 条目（`[盘上]`）。
 *      而 `src/config.js` 此刻**不能动**（另一施工方正在其中插入 `recipes` 段）。
 *      ⇒ 每级产能表设计成入参 `capacityByLevel`（长度 3 的整数数组，下标 `lv-1`），
 *      本文件**不读 CONFIG、不写死任何产能现值**。落点建议见文件末「移交第 2／6 步」注释段。
 *
 *   ② **断电 ⇒ `U = 0`（该回合不造弹）**，但这是**运行时有效产能**，不是配置值。
 *      理由：`src/config.js:1006` 的「每波至少打得出 1 发」原文语境是**料**
 *      （「每波保底料 FLOOR := c = 3」），**不是电**；第 3 步已定「电力赤字 ⇒ `E = 0` ⇒ `E` 这条闸门给 0 发」。
 *      若断电时仍保 `U ≥ 1`，`N = min(A, U, E, M)` 里 `E` 与 `U` 两条闸门同时失效，电就成了摆设。
 *      ⇒ **两个概念在类型上分开**：`capacity`（配置产能值，域 `1..5`，恒 ≥ 1）与
 *      `effectiveU`（运行时有效产能，断电时为 `0`）。`0` **不许**混进配置取值域，
 *      否则第 1 步 `validateWorkshopCapacity`（`material_loadout_utils.js:195`）会被污染。
 *
 *   ③ **多座工坊取最高等级那一座**，**不求和**。产能是「上限」语义、不是叠乘；
 *      求和会把 `U` 顶过射速轨天花板、直接破坏 `N ≤ A`（C1 条文 ② 的恒等式），
 *      也会二次违反「不许有第二条抬高发数的路径」（订正 C1 ②、决策本 `unattended_decision_ledger_20261025.md:54-56`）。
 *      盘上 `facilities` 允许多个槽位放同类设施（`src/config.js:962` `slots.total: 3`、
 *      `:967` `shieldGen` 等均有「多座」语义 `[盘上]`）⇒ 必须显式给出被采纳的那一座 `{ slotIndex, lv }`，
 *      便于 UI 说明「用的是哪一座」。同等级并列时取 `slotIndex` 较小者（**只作确定性排序，不表达优先级**）。
 *
 * 复用纪律（不许另写一份）：
 *   - `U` 的取值域校验**一律转调第 1 步 `validateWorkshopCapacity`**（`material_loadout_utils.js:195`），
 *     本文件**不出现**取值域常量的字面量；上限／下限全部由该函数与它导出的常量给出。
 *   - 设施等级域**一律取第 3 步 `FACILITY_LEVELS`**（`power_budget_utils.js:52`，`[推导]` 1..3：
 *     四类战斗设施 `upCost` 长度 2 ⇒ `upCost.length + 1 = 3`；`workshop` 无 `facilities` 条目 ⇒ 按等级域长度取）。
 *     本文件不重定义等级域，也不靠 `upCost` 推。
 *   - 本文件**不重算电力**：`availablePower` 由第 3 步 `computeAvailablePower` 算好后传入，
 *     `powerDrawFor('workshop', lv, config)`（`power_budget_utils.js:116`，键名见 `WORKSHOP_DRAW_KEY`）同理。
 *
 * 纯函数约束：不读 `this`、不读全局、不做 IO、不吃随机数；`capacityByLevel` 一律显式传参；
 *   不修改任何入参（返回对象全部新建，被采纳工坊只回 `{ slotIndex, lv }` 快照，不回原对象引用）。
 *   本文件只 import 两个既有纯函数模块（`material_loadout_utils.js` / `power_budget_utils.js`），
 *   **不 import config、不 import game_\***，node 可直接跑单测。
 *
 * 命名纪律（附录 C-2「命名风险」）：`recipe` 一词盘上已指「单发子弹配方对象」，本文件不出现该词。
 */

import { validateWorkshopCapacity } from './material_loadout_utils.js';
import { FACILITY_LEVELS } from './power_budget_utils.js';

/**
 * 弹药工坊的耗电键名（`src/config.js:983` `workshop: [4, 6, 8]`，`[盘上]` 键名；数值是 `[提案]`）。
 * 本文件**只用这个名字**，不读数值：耗电由 `powerDrawFor(WORKSHOP_DRAW_KEY, lv, config)` 算。
 */
export const WORKSHOP_DRAW_KEY = 'workshop';

/** `reason` 的固定取值（UI 与第 8 步按压这三种分支，不要新增同义串）。 */
export const WORKSHOP_REASONS = Object.freeze({
    /** 没有工坊：`capacity = 0`、`effectiveU = 0`。 */
    NO_WORKSHOP: 'no-workshop',
    /** 有工坊但断电：`capacity` 仍是配置值、`effectiveU = 0`（本波不造弹）。 */
    UNPOWERED: 'unpowered',
    /** 有工坊且通电：`effectiveU === capacity`。 */
    OK: 'ok',
});

/**
 * 设施等级域的两个派生量：一律从第 3 步 `FACILITY_LEVELS` 派生，**不写死 1 / 3**。
 * `LEVEL_COUNT` 同时是 `capacityByLevel` 的期望长度（每个等级一项）。
 */
const LEVEL_MIN = FACILITY_LEVELS[0];
const LEVEL_MAX = FACILITY_LEVELS[FACILITY_LEVELS.length - 1];
const LEVEL_COUNT = FACILITY_LEVELS.length;

function _isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 报错用：把任意实测值压成可读串（`undefined` 不吞成空白）。 */
function _show(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return `[${v.map(_show).join(', ')}]`;
    try {
        return JSON.stringify(v);
    } catch (e) {
        return String(v);
    }
}

/**
 * 等级校验：必须是 `LEVEL_MIN..LEVEL_MAX` 的整数（口径与第 3 步 `_requireLevel` 同向：越界不许回落）。
 * 报错点名**具体槽位与实测值**。
 * @returns {number} 整数化的等级
 */
function _requireLevel(lv, fnName, label) {
    const n = Number(lv);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < LEVEL_MIN || n > LEVEL_MAX) {
        throw new RangeError(
            `[${fnName}] 工坊 lv 必须是 ${LEVEL_MIN}..${LEVEL_MAX} 的整数（等级域取 power_budget_utils.FACILITY_LEVELS），实测 ${label} 的 lv = ${_show(lv)}`
        );
    }
    return n;
}

/** `slotIndex` 校验：缺省取数组下标（盘上槽位号与数组下标同序）；给了就必须是非负整数。 */
function _requireSlotIndex(slotIndex, fallbackIndex, fnName, label) {
    if (slotIndex === undefined) return fallbackIndex;
    const n = Number(slotIndex);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        throw new TypeError(`[${fnName}] 工坊槽位号必须是非负整数，实测 ${label} 的 slotIndex = ${_show(slotIndex)}`);
    }
    return n;
}

/** `workshops` 数组校验：`undefined` / `null` 视为未建（空数组），其它非数组一律抛错（不静默吞）。 */
function _requireWorkshopList(workshops, fnName) {
    if (workshops === undefined || workshops === null) return [];
    if (!Array.isArray(workshops)) {
        throw new TypeError(`[${fnName}] workshops 必须是数组（形如 [{ slotIndex, lv, powered }]），实测 ${_show(workshops)}`);
    }
    return workshops;
}

/**
 * 校验并复制产能表（**核心校验函数**，`pickWorkshop` / `resolveWorkshopCapacity` 都转调它）。
 *
 * 六条硬约束，违反即抛错并**点名是哪一级**：
 *   ① 必须是数组；
 *   ② 长度 = 等级域长度（`FACILITY_LEVELS.length`，即 `LEVEL_COUNT`，当前 3）；
 *   ③ 每项必须是整数（非整数抛错，不四舍五入）；
 *   ④ 每项必须落在第 1 步 `validateWorkshopCapacity` 的取值域内（域内常量**不在此处复制**）；
 *   ⑤ **`capacityByLevel[0]`（Lv1＝一建即得的等级）还必须满足第 1 步的「初始值 < 上限」那条**
 *      ⇒ 用 `validateWorkshopCapacity(v, { initial: true })` 校验首项、其余用 `{ initial: false }`。
 *      依据：C1 ③「初始值必须 < 5」，`U ≥ 5` **一建**就把射速轨架空（`:66` 原文）；
 *      盘上新建设施一律从 Lv1 起（`facilities.*.upCost` 是「从 Lv1 往上升」的第二级起价，
 *      `src/config.js:964-967` `[盘上]`）⇒ 首项即「初始 U」的约束对象（**本推导见回执偏离表**）。
 *   ⑥ **单调不减**：低等级产能不得高于高等级（产能是等级上限，升了级反而更少＝配置错误）。
 *
 * @param {number[]} capacityByLevel - 每级产能值，下标 `lv - 1`；**不含任何现值，由调用方给**
 * @returns {{ ok:true, errors:string[], table:number[] }} `table` 是**副本**（不改入参）
 * @throws {TypeError|RangeError} 结构非法 / 某项越域 / 非单调
 */
export function validateCapacityTable(capacityByLevel) {
    const FN = 'validateCapacityTable';
    if (!Array.isArray(capacityByLevel)) {
        throw new TypeError(`[${FN}] capacityByLevel 必须是数组（长度 = ${LEVEL_COUNT}，下标 lv-1），实测 ${_show(capacityByLevel)}`);
    }
    if (capacityByLevel.length !== LEVEL_COUNT) {
        throw new RangeError(
            `[${FN}] capacityByLevel 的长度必须 = ${LEVEL_COUNT}（= 设施等级域 lv ${LEVEL_MIN}..${LEVEL_MAX}，每级一项），实测 ${capacityByLevel.length}`
        );
    }
    const table = [];
    for (let i = 0; i < capacityByLevel.length; i++) {
        const lv = LEVEL_MIN + i;
        const raw = capacityByLevel[i];
        // ④⑤ 取值域与「初始值 < 上限」全部转调第 1 步，本文件不复制常量字面量。
        //    首项（i === 0，一建即得的等级）按「初始配置」从严校验，其余按「已建成」校验。
        const check = validateWorkshopCapacity(raw, { initial: i === 0 });
        if (!check.ok) {
            throw new RangeError(`[${FN}] capacityByLevel[${i}]（Lv${lv}）不合规：${check.errors.join('；')}`);
        }
        // ⑥ 单调不减（前一项已通过校验，必为整数）。
        if (i > 0 && check.value < table[i - 1]) {
            throw new RangeError(
                `[${FN}] capacityByLevel 必须单调不减：Lv${lv - 1} = ${table[i - 1]} > Lv${lv} = ${check.value}（产能是等级上限，升一级不得更低）`
            );
        }
        table.push(check.value);
    }
    return { ok: true, errors: [], table };
}

/** 取校验后的表副本；表非法时把 `validateCapacityTable` 的报错原样抛出（函数名前缀换成调用方）。 */
function _table(fnName, capacityByLevel) {
    try {
        return validateCapacityTable(capacityByLevel).table;
    } catch (e) {
        const msg = String((e && e.message) || e).replace('[validateCapacityTable]', `[${fnName}] capacityByLevel`);
        const Err = e instanceof TypeError ? TypeError : RangeError;
        throw new Err(msg);
    }
}

/**
 * 选出「被采纳的那一座」工坊（内部口径，`entry` 只给本文件用）。
 * 选择序：**等级最高者**；同等级 → `slotIndex` 较小者（只作确定性排序）。**不求和**（见文件头决策 ③）。
 * @returns {{ slotIndex:number, lv:number, capacity:number, entry:object }|null}
 */
function _pickEntry(workshops, capacityByLevel, fnName) {
    const list = _requireWorkshopList(workshops, fnName);
    if (list.length === 0) return null;
    const table = _table(fnName, capacityByLevel);
    let best = null;
    for (let i = 0; i < list.length; i++) {
        const w = list[i];
        if (!_isPlainObject(w)) {
            throw new TypeError(`[${fnName}] workshops[${i}] 必须是对象（形如 { slotIndex, lv, powered }），实测 ${_show(w)}`);
        }
        const label = Number.isInteger(Number(w.slotIndex)) ? `slot ${w.slotIndex}` : `workshops[${i}]`;
        const lv = _requireLevel(w.lv, fnName, label);
        const slotIndex = _requireSlotIndex(w.slotIndex, i, fnName, label);
        if (best === null || lv > best.lv || (lv === best.lv && slotIndex < best.slotIndex)) {
            best = { slotIndex, lv, capacity: table[lv - LEVEL_MIN], entry: w };
        }
    }
    return best;
}

/**
 * 挑出被采纳的那一座工坊（公开口径，**不含原对象引用**，可直接交给 UI）。
 * @param {Array<{slotIndex?:number, lv:number, powered?:boolean}>} workshops
 * @param {number[]} capacityByLevel
 * @returns {{ slotIndex:number, lv:number, capacity:number }|null} 空数组 ⇒ `null`
 * @throws {TypeError|RangeError} `lv` 非 1..3 整数 / `slotIndex` 非法 / 产能表非法
 */
export function pickWorkshop(workshops, capacityByLevel) {
    const picked = _pickEntry(workshops, capacityByLevel, 'pickWorkshop');
    if (picked === null) return null;
    return { slotIndex: picked.slotIndex, lv: picked.lv, capacity: picked.capacity };
}

/**
 * 通电判定（**只做比较，不重算电力**）。
 * 电力由第 3 步 `computeAvailablePower` 算好后传入；工坊耗电由 `powerDrawFor(WORKSHOP_DRAW_KEY, lv, config)` 给出。
 * 口径：`availablePower >= workshopDraw` ⇒ `true`（**等号算通电**：刚好付得起就该造得出弹）。
 *   负的 `availablePower`（赤字，第 3 步口径 ③ 允许为负）自然落到 `false`，不做封底改写。
 * @param {{ availablePower:number, workshopDraw:number }} input
 * @returns {boolean}
 * @throws {TypeError} 参数缺失 / 非数 / 非有限数（报错点名字段与实测值；**不静默当 0**）
 */
export function isWorkshopPowered(input) {
    const FN = 'isWorkshopPowered';
    if (!_isPlainObject(input)) {
        throw new TypeError(`[${FN}] 入参必须是对象（形如 { availablePower, workshopDraw }），实测 ${_show(input)}`);
    }
    const avail = input.availablePower;
    const draw = input.workshopDraw;
    if (typeof avail !== 'number' || !Number.isFinite(avail)) {
        throw new TypeError(`[${FN}] availablePower 必须是有穷数（由第 3 步 computeAvailablePower 算好后传入，可为负），实测 ${_show(avail)}`);
    }
    if (typeof draw !== 'number' || !Number.isFinite(draw)) {
        throw new TypeError(`[${FN}] workshopDraw 必须是有穷数（由 powerDrawFor('${WORKSHOP_DRAW_KEY}', lv, config) 给出），实测 ${_show(draw)}`);
    }
    return avail >= draw;
}

/** `powered` 字段校验：必须是布尔（`[推导]` 缺省不猜——断电判定已有专门函数，猜错会让电变成摆设）。 */
function _requirePowered(v, fnName, slotIndex) {
    if (typeof v !== 'boolean') {
        throw new TypeError(
            `[${fnName}] 工坊 slot ${slotIndex} 的 powered 必须是布尔（断电判定由 isWorkshopPowered 算好后传入），实测 ${_show(v)}`
        );
    }
    return v;
}

/**
 * 核心入口：解析本波弹药工坊产能。
 *
 * 返回的两个字段**语义不同、不许合并**（见文件头决策 ②）：
 *   - `capacity`：被采纳那座工坊的**配置产能值**（域 `1..5`，恒 ≥ 1；断电时**保持原值**，不被 0 污染）；
 *   - `effectiveU`：**运行时有效产能** = `powered ? capacity : 0` ⇒ 这才是 `N = min(A, U, E, M)` 里的 `U`。
 *
 * @param {{ workshops?:Array<{slotIndex?:number, lv:number, powered:boolean}>, capacityByLevel:number[] }} input
 * @returns {{
 *   capacity:number,       // 配置产能值；无工坊 ⇒ 0
 *   effectiveU:number,     // 运行时有效产能；断电或无工坊 ⇒ 0
 *   powered:boolean,       // 被采纳那座是否通电；无工坊 ⇒ false
 *   source:{slotIndex:number, lv:number}|null,  // 用的是哪一座；无工坊 ⇒ null
 *   reason:'no-workshop'|'unpowered'|'ok'
 * }}
 * @throws {TypeError|RangeError} 入参结构 / lv / 产能表 / powered 非法（报错点名字段与实测值）
 */
export function resolveWorkshopCapacity(input) {
    const FN = 'resolveWorkshopCapacity';
    if (!_isPlainObject(input)) {
        throw new TypeError(`[${FN}] input 必须是对象（形如 { workshops, capacityByLevel }），实测 ${_show(input)}`);
    }
    // 产能表先校验：即便本波没建工坊，表非法也要当场判红（配置错误不许等到建好才发现）。
    const picked = _pickEntry(input.workshops, input.capacityByLevel, FN);
    if (picked === null) {
        return {
            capacity: 0,
            effectiveU: 0,
            powered: false,
            source: null,
            reason: WORKSHOP_REASONS.NO_WORKSHOP,
        };
    }
    const powered = _requirePowered(picked.entry.powered, FN, picked.slotIndex);
    return {
        capacity: picked.capacity,
        effectiveU: powered ? picked.capacity : 0,
        powered,
        source: { slotIndex: picked.slotIndex, lv: picked.lv },
        reason: powered ? WORKSHOP_REASONS.OK : WORKSHOP_REASONS.UNPOWERED,
    };
}

/**
 * 给 UI 的一句话（文案与订正件口径一致，**不含被标定的产能现值**，数值一律来自入参）。
 * @param {ReturnType<typeof resolveWorkshopCapacity>} result
 * @returns {string} 通电 `'弹药工坊 Lv2 · 产能 3 发'` ／ 断电 `'弹药工坊断电（本波不造弹）'` ／ 未建 `'未建弹药工坊'`
 * @throws {TypeError|RangeError} 非 `resolveWorkshopCapacity` 的返回值 / 未知 `reason`
 */
export function describeWorkshopCapacity(result) {
    const FN = 'describeWorkshopCapacity';
    if (!_isPlainObject(result)) {
        throw new TypeError(`[${FN}] result 必须是 resolveWorkshopCapacity(...) 的返回值，实测 ${_show(result)}`);
    }
    if (result.reason === WORKSHOP_REASONS.NO_WORKSHOP) return '未建弹药工坊';
    if (result.reason === WORKSHOP_REASONS.UNPOWERED) return '弹药工坊断电（本波不造弹）';
    if (result.reason === WORKSHOP_REASONS.OK) {
        if (!_isPlainObject(result.source) || !Number.isInteger(result.source.lv)) {
            throw new TypeError(`[${FN}] reason='ok' 时必须带 source.lv（用的是哪一座），实测 ${_show(result.source)}`);
        }
        return `弹药工坊 Lv${result.source.lv} · 产能 ${result.effectiveU} 发`;
    }
    throw new RangeError(
        `[${FN}] 未知 reason ${_show(result.reason)}（合法值：${WORKSHOP_REASONS.NO_WORKSHOP} / ${WORKSHOP_REASONS.UNPOWERED} / ${WORKSHOP_REASONS.OK}）`
    );
}

/*
 * ============================================================================
 * 移交第 2 步（配置层）：产能表的落点建议
 * ----------------------------------------------------------------------------
 * 位置：`CONFIG.gameplay.build` 下**与 `power` 段平级**的一个新键，建议 `build.workshop = { capacityByLevel: [...] }`。
 *   - 为什么不放进 `build.power.draw` 旁边：`power` 段的口径是「耗电」，`:972` 原文「位置与 facilities 同段族，便于并排读」；
 *     产能不是耗电，混进 `power` 会让「耗电合计」那一层的读者误以为它参与 `facilityDraw` 求和。
 *   - 为什么不放进 `build.facilities.workshop`：`:983` 原文「该设施尚未落 facilities，先只给耗电键」——
 *     一旦补 `facilities.workshop`，就得同时补 `cost` / `upCost` / `cd` 等整套设施字段（`:964-967` 四类的形状），
 *     那是第 2 步的设施表活，不是本步的单键活；而且 `:977` 要求 `power.draw` 数组长度 = `upCost.length + 1`，
 *     补 `upCost` 会反过来绑住耗电数组长度 `[4,6,8]`（正好 3，合法但属于额外约束）。
 *   - 键名：`capacityByLevel`（与本文件入参同名，接线时**零改名**透传：`resolveWorkshopCapacity({ workshops, capacityByLevel: CONFIG.gameplay.build.workshop.capacityByLevel })`）。
 *   - 段族约定原文（`src/config.js:972`）：「键名与 docs/design/factory_grid_line_v1.md §6 分件 11 逐字一致，不得另起别名；
 *     位置与 facilities 同段族，便于并排读。」⇒ 键名一旦定，须同步写进那份设计稿的分件 11，否则段族约定被破坏。
 * 三个等级的建议约束（本文件已硬编码校验，配置层照抄即可）：
 *   ① 长度 = 等级域长度（3，来自 `FACILITY_LEVELS`）；
 *   ② 每项整数、落在第 1 步 `WORKSHOP_CAPACITY_MIN..WORKSHOP_CAPACITY_MAX`（`1..5`）内；
 *   ③ **单调不减**，且 **Lv1 项还须满足「初始值 < 上限」**（C1 ③）；
 *   ④ 数值本身全部 `[待标定]`——本文件与本次测试**不提供任何现值**。
 *
 * ============================================================================
 * 移交第 6 步（接线）：本层需要上游给什么
 * ----------------------------------------------------------------------------
 *   - `workshops`：本波**每一座**工坊的 `{ slotIndex, lv, powered }`（`slotIndex` 取盘上槽位号 `src/utils/build_grid_utils.js`）；
 *   - `powered`：由 `isWorkshopPowered({ availablePower, workshopDraw })` 逐座算，
 *     `availablePower` = 第 3 步 `computeAvailablePower(...).available`，
 *     `workshopDraw` = `powerDrawFor(WORKSHOP_DRAW_KEY, lv, CONFIG.gameplay.build)`；
 *   - `capacityByLevel`：`CONFIG.gameplay.build.workshop.capacityByLevel`（第 2 步落位后）；
 *   - 回滚口径（C-3 第 4 步「同上」）：把 `N` 的合成改回 `min(A, E, M)`、断开这一次 `U` 的读取即可，本文件可整份删掉。
 */
