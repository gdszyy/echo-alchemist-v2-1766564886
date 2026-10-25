/**
 * power_budget_utils.js - [REQ-20261022-wave-loop · 经济接线 v2 第 3 步] 电力预算纯函数层。
 *
 * 施工依据（逐条对齐，不得自行改数）：
 *   - `docs/design/economy_wiring_spec_v2.md:155-172`（§4.1 发数定义与 `E` 的三处口径）；
 *   - `docs/design/economy_wiring_spec_v2_corrections.md` **C7**（合成器产电订正：`E` 必须补产出项）
 *     与附录 C-3 第 3 步「电力接线（发电 + 电池 + 合成器产电 − 设施耗电）」。
 *     该步回滚口径＝「断开『读配置』一步」⇒ 本文件只做**纯函数 + 配置读取**，
 *     **不接线主循环、不读运行时状态、不改任何既有文件**（接线属第 6 步）。
 *
 * 公式（逐字照规格）：
 *   gross     = 本波发电 + 合成器本波实产电 + 电池存量
 *   available = gross − 设施本波耗电合计 − 合成器自身耗电
 *   E         = floor(available / 每发耗电)        ← 每发耗电盘上不存在，`[待标定]`，由调用方传入
 *
 * 六条口径（本文件的实现铁律，返工时逐条对照）：
 *   ① **电池存量用 `reserve`，不用 `capacity`**。`capacity` 是「单座在该等级的容量增量」
 *      （`src/config.js:993-994` 原文），总容量 = `baseCapacity + Σ 各座贡献`；开局 `reserve = 0`
 *      （`src/utils/build_grid_utils.js:120`）。把 `capacity` 当存量读 = Lv1 电池不增容，全表崩。
 *   ② **合成器产电计入 `gross`、耗电单列 `synthDraw`、不进 `facilityDraw`**（订正 C7 + `src/config.js:986` 唯一口径）。
 *      `facilityDraw` 的定义是「**不含 synth** 的设施耗电合计」，所以两者必须分开返回、分别扣减。
 *   ③ **`available` 允许为负，不许静默归 0**：赤字是 UI 要展示的状态（「本波电力赤字 X」`[待定]`）。
 *      「负 ⇒ `E = 0`」这件事由 `computePowerShots` 内部封底，不在本层改写 `available`。
 *   ④ **`power.draw` 数组长度必须 = `upCost.length + 1` = 3**，越界 `lv` 一律抛错，
 *      不许 `table[lv-1]` 静默取到末项（那会把 Lv4 当成 Lv3 免费供电）。
 *   ⑤ **料对合成器实产的约束不在本步建模**：本步只接受调用方算好的实产数，并校验它
 *      ≤ `power.synth.capPerWave[lv-1]`；「可用料投入能支撑多少产量」属料账本一侧，`[待标定]`。
 *   ⑥ **每发耗电全程 `[待标定]`**：本文件不出现任何具体数，只把它当入参透传给 `computePowerShots`。
 *
 * 纯函数约束：不读 `this`、不读全局、不做 IO、不吃随机数；`config` 一律显式传参；不修改任何入参。
 * 只 import 一个小纯函数模块（`material_loadout_utils.js` 的 `computePowerShots`），
 * **不另写除零逻辑**——`每发耗电 ≤ 0` / 非有限数的报错归第 1 步那一个函数管。
 *
 * `config` 形状（与 `src/utils/build_grid_utils.js:56-58` 同约定，两种都可）：
 *   - 传 `CONFIG.gameplay.build`（推荐，正式接线用这个）：读 `config.power.*`，
 *     并用 `config.facilities.*.upCost` 交叉校验 `power.draw` 的数组长度；
 *   - 传 `CONFIG.gameplay.build.power` 本身（测试构最小夹具用）：`power` 段即 `config`，跳过 `upCost` 交叉校验。
 */

import { computePowerShots } from './material_loadout_utils.js';

/** 合成器类型键：**不在** `power.draw` 内（`src/config.js:986` 原文「雷能合成器**不进 draw**」）。 */
export const SYNTH_TYPE = 'synth';

/**
 * 设施等级域 `[推导]`：1..3。
 * 推导链：四类战斗设施 `upCost` 长度均为 2（`src/config.js:964-967` `[盘上]`）⇒ `upCost.length + 1 = 3`；
 * `power.draw` 六个数组键的长度也都是 3（`:979-983` `[盘上]`）。
 * `workshop` 没有 `facilities` 条目（`:983` 原文「该设施尚未落 facilities，先只给耗电键」），
 * 因此它的等级域与长度下限按本常量取，而不是按 `upCost` 推。
 */
export const FACILITY_LEVELS = [1, 2, 3];

function _isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function _list(v) {
    return Array.isArray(v) ? v : [];
}

/** 取 `power` 段：传 build 级 config 就取 `.power`，传 power 段本身就原样用。 */
function _powerCfg(config) {
    if (!_isPlainObject(config)) return {};
    if (_isPlainObject(config.power)) return config.power;
    return config;
}

/** 取 `facilities` 段（只用于 `upCost` 交叉校验；power 段级夹具下为空对象）。 */
function _facilityCfg(config) {
    return _isPlainObject(config) && _isPlainObject(config.facilities) ? config.facilities : {};
}

/**
 * 等级校验：必须是 1..3 的整数。非 1..3 一律抛错（口径 ④：不许静默取末项）。
 * @returns {number} 整数化的等级
 */
function _requireLevel(lv, fnName, type, maxLevel) {
    const n = Number(lv);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new TypeError(`[${fnName}] 设施 "${type}" 的等级必须是整数，实测 ${String(lv)}`);
    }
    if (n < 1 || n > maxLevel) {
        throw new RangeError(`[${fnName}] 设施 "${type}" 的等级越界：合法域 1..${maxLevel}（= upCost.length + 1），实测 ${n}；越界不得回落到末项`);
    }
    return n;
}

/**
 * `power.draw[type]` 的长度校验（口径 ④）。
 * 有 `facilities[type].upCost` ⇒ 期望长度 = `upCost.length + 1`；没有（`workshop` / `generator` / `battery`）
 * ⇒ 期望长度 = `FACILITY_LEVELS.length`（3，见常量注释）。
 * 标量条目（`generator: 0` / `battery: 0`）没有长度，只校验它的值。
 */
function _assertDrawLength(type, entry, facilityCfg, fnName) {
    const upCost = facilityCfg && _isPlainObject(facilityCfg[type]) ? facilityCfg[type].upCost : undefined;
    const expected = Array.isArray(upCost) ? upCost.length + 1 : FACILITY_LEVELS.length;
    if (Array.isArray(entry) && entry.length !== expected) {
        throw new RangeError(`[${fnName}] power.draw["${type}"] 的长度必须 = ${expected}（upCost.length + 1；无 upCost 时取等级域长度 ${FACILITY_LEVELS.length}），实测 ${entry.length}`);
    }
    return expected;
}

/**
 * 单设施**每波耗电**（`power.draw[type][lv-1]`，`src/config.js:976-987` `[盘上]`）。
 *
 * **`synth` 一律抛错并指向 `synthDrawFor`**：合成器耗电 = `electricPerUnit × 本波实产数`，
 * 是「产量相关」而非「按波固定」，混进本函数就会和单算口径重复计费（`src/config.js:986`）。
 *
 * @param {string} type - `power.draw` 的键：`turret` / `frost` / `lightning` / `shieldGen` / `workshop` / `generator` / `battery`
 * @param {number} lv - 设施等级，必须是 1..3 的整数
 * @param {object} config - `CONFIG.gameplay.build` 或 `CONFIG.gameplay.build.power`
 * @returns {number} 每波耗电（`generator` / `battery` 恒 0：后勤设备不耗电，`:984-985`）
 * @throws {TypeError|RangeError} 未知类型 / `synth` / 等级非法 / 配置值非法
 */
export function powerDrawFor(type, lv, config) {
    if (typeof type !== 'string' || type.length === 0) {
        throw new TypeError(`[powerDrawFor] type 必须是 power.draw 的键名，实测 ${String(type)}`);
    }
    if (type === SYNTH_TYPE) {
        throw new TypeError(`[powerDrawFor] 设施 "synth" 不进 power.draw 合计：合成器耗电走 synthDrawFor（electricPerUnit × 本波实产数，src/config.js:986 唯一口径）`);
    }
    const power = _powerCfg(config);
    const draw = _isPlainObject(power.draw) ? power.draw : null;
    if (!draw) {
        throw new TypeError(`[powerDrawFor] 配置缺少 power.draw 段（实测 ${JSON.stringify(power.draw)}）：无法读取每波耗电`);
    }
    const keys = Object.keys(draw);
    if (!keys.includes(type)) {
        throw new TypeError(`[powerDrawFor] 未知设施类型 "${type}"：power.draw 的合法键为 ${keys.join(' / ')}；合成器不在其中，须用 synthDrawFor`);
    }
    const entry = draw[type];
    const maxLevel = _assertDrawLength(type, entry, _facilityCfg(config), 'powerDrawFor');
    const lvInt = _requireLevel(lv, 'powerDrawFor', type, maxLevel);
    const raw = Array.isArray(entry) ? entry[lvInt - 1] : entry;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
        throw new RangeError(`[powerDrawFor] power.draw["${type}"] 在 Lv${lvInt} 必须是非负有限数，实测 ${String(raw)}`);
    }
    return n;
}

/**
 * 取 `power.synth` 的两张表并校验长度（`src/config.js:996-1001` `[盘上]` `[提案]`）。
 * @returns {{ per:number[], cap:number[] }}
 */
function _synthTables(config, fnName) {
    const power = _powerCfg(config);
    const synth = _isPlainObject(power.synth) ? power.synth : null;
    if (!synth) {
        throw new TypeError(`[${fnName}] 配置缺少 power.synth 段（实测 ${JSON.stringify(power.synth)}）：合成器耗电只能由 electricPerUnit × 实产数 单算`);
    }
    const per = _list(synth.electricPerUnit);
    const cap = _list(synth.capPerWave);
    if (per.length !== FACILITY_LEVELS.length) {
        throw new RangeError(`[${fnName}] power.synth.electricPerUnit 长度必须 = ${FACILITY_LEVELS.length}，实测 ${per.length}`);
    }
    if (cap.length !== FACILITY_LEVELS.length) {
        throw new RangeError(`[${fnName}] power.synth.capPerWave 长度必须 = ${FACILITY_LEVELS.length}，实测 ${cap.length}`);
    }
    return { per, cap };
}

/**
 * 合成器自身**每波耗电** = `electricPerUnit[lv-1] × 本波实产数`（`src/config.js:986` / `:999` `[盘上]`）。
 *
 * 实产数由调用方给出（料对产量的约束**本步不建模**，口径 ⑤），本函数只校验：
 * 非负整数、且 ≤ `capPerWave[lv-1]`（`[盘上]` `[提案]` 2/3/4）——超上限即配置/调用缺陷，不静默截断。
 *
 * 参考量级（**不是现值，别照抄**）：`electricPerUnit [5,4,3]` × `capPerWave [2,3,4]` ⇒ 满产 10/12/12（`:999` 原文）。
 *
 * @param {number} lv - 合成器等级 1..3
 * @param {number} producedUnits - 本波实产电数（单位 ⚡，`electricPerUnit` 的单位是「每产 1⚡ 的耗电」⇒ 1 单位 = 1⚡）
 * @param {object} config
 * @returns {number} 每波耗电
 * @throws {TypeError|RangeError} 等级非法 / 实产数非整数、负数、超上限
 */
export function synthDrawFor(lv, producedUnits, config) {
    const { per, cap } = _synthTables(config, 'synthDrawFor');
    const lvInt = _requireLevel(lv, 'synthDrawFor', SYNTH_TYPE, FACILITY_LEVELS.length);
    const units = Number(producedUnits);
    if (!Number.isFinite(units) || !Number.isInteger(units)) {
        throw new TypeError(`[synthDrawFor] producedUnits（本波实产数）必须是整数，实测 ${String(producedUnits)}`);
    }
    if (units < 0) {
        throw new RangeError(`[synthDrawFor] producedUnits 不得为负（产量不是负的），实测 ${units}`);
    }
    const capHere = Number(cap[lvInt - 1]);
    const perHere = Number(per[lvInt - 1]);
    if (!Number.isFinite(capHere) || capHere < 0) {
        throw new RangeError(`[synthDrawFor] power.synth.capPerWave[${lvInt - 1}] 必须是非负有限数，实测 ${String(cap[lvInt - 1])}`);
    }
    if (!Number.isFinite(perHere) || perHere < 0) {
        throw new RangeError(`[synthDrawFor] power.synth.electricPerUnit[${lvInt - 1}] 必须是非负有限数，实测 ${String(per[lvInt - 1])}`);
    }
    if (units > capHere) {
        throw new RangeError(`[synthDrawFor] producedUnits 超 Lv${lvInt} 上限：capPerWave[${lvInt - 1}] = ${capHere}，实测 ${units}；超上限不得静默截断`);
    }
    return perHere * units;
}

/**
 * 设施**每波耗电合计** = `Σ power.draw[type][lv-1]`（`src/config.js:976-987` `[盘上]`）。
 *
 * 列表里出现 `synth` **必须抛错**：合成器耗电走单算口径，混进来就会与 `synthDrawFor` 重复计费
 * （`src/config.js:986`）。`generator` / `battery` 允许出现且贡献恒 0（后勤设备，`:984-985`）。
 *
 * @param {Array<{type:string, lv:number}>} facilities - 无耗电设施时传 `[]`
 * @param {object} config
 * @returns {number} 合计（`[]` ⇒ 0）
 * @throws {TypeError} 非数组 / 元素缺 `type` 或 `lv` / 含 `synth` / 未知类型（由 `powerDrawFor` 抛出）
 */
export function totalFacilityDraw(facilities, config) {
    if (!Array.isArray(facilities)) {
        throw new TypeError(`[totalFacilityDraw] facilities 必须是 [{ type, lv }] 数组（无耗电设施时传 []），实测 ${String(facilities)}`);
    }
    let total = 0;
    for (let i = 0; i < facilities.length; i++) {
        const item = facilities[i];
        if (!_isPlainObject(item) || typeof item.type !== 'string') {
            throw new TypeError(`[totalFacilityDraw] facilities[${i}] 必须是 { type, lv }，实测 ${JSON.stringify(item)}`);
        }
        if (item.type === SYNTH_TYPE) {
            throw new TypeError(`[totalFacilityDraw] facilities[${i}] 出现 "synth"：合成器耗电不进设施耗电合计（走 synthDrawFor 单算，src/config.js:986），否则与单算口径重复计费`);
        }
        if (item.lv === undefined || item.lv === null) {
            throw new TypeError(`[totalFacilityDraw] facilities[${i}]（类型 "${item.type}"）缺少 lv：等级必须显式给出，不得默认按 Lv1 计`);
        }
        total += powerDrawFor(item.type, item.lv, config);
    }
    return total;
}

/**
 * 本波**发电量** = `power.generate.generator[lv-1]`（`src/config.js:989` `[盘上]` `[提案]` 现值 `[10, 15, 20]`）。
 * @param {number} lv - 发电机等级 1..3
 * @param {object} config
 * @returns {number} 本波发电（多座发电机由调用方**先各自取值再相加**：本函数只管单座）
 * @throws {TypeError|RangeError} 等级非法 / 配置缺失或值非法
 */
export function generatorOutputFor(lv, config) {
    const power = _powerCfg(config);
    const gen = _isPlainObject(power.generate) ? power.generate.generator : undefined;
    if (!Array.isArray(gen)) {
        throw new TypeError(`[generatorOutputFor] 配置缺少 power.generate.generator 数组，实测 ${JSON.stringify(gen)}`);
    }
    if (gen.length !== FACILITY_LEVELS.length) {
        throw new RangeError(`[generatorOutputFor] power.generate.generator 长度必须 = ${FACILITY_LEVELS.length}，实测 ${gen.length}`);
    }
    const lvInt = _requireLevel(lv, 'generatorOutputFor', 'generator', FACILITY_LEVELS.length);
    const raw = gen[lvInt - 1];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
        throw new RangeError(`[generatorOutputFor] power.generate.generator[${lvInt - 1}] 必须是非负有限数，实测 ${String(raw)}`);
    }
    return n;
}

/**
 * 电池存量校验（口径 ①）。
 * **只接存量 `reserve`**：`capacity` 是「单座容量增量」（`src/config.js:993-994`），
 * 总容量由 `baseCapacity + Σ 各座贡献`（`src/utils/build_grid_utils.js:97-107`）另行计算，**不是本函数的入参**。
 * @returns {number} 整数化的存量
 * @throws {TypeError|RangeError} 非有限数（含漏传）/ 负数
 */
function _requireBatteryReserve(v, fnName) {
    const n = Number(v);
    if (!Number.isFinite(n)) {
        throw new TypeError(`[${fnName}] batteryReserve 必须是有穷数（电池**存量** reserve，不是 capacity），实测 ${String(v)}`);
    }
    if (n < 0) {
        throw new RangeError(`[${fnName}] batteryReserve 不得为负（存量是已存下的电；赤字应是设施耗电超过供给的结果，不是负存量），实测 ${n}`);
    }
    // `[推导]`：存量按整数 ⚡ 记账（迁移写档 `build_grid_utils.js:371` 是 capacity 整数），小数按向下取整。
    return Math.floor(n);
}

/**
 * 合成器输入归一（口径 ②⑤）：`null` / `undefined` ⇒ 不建合成器，产出与耗电均为 0。
 * @returns {{ lv:number, producedUnits:number, produced:number, draw:number }}
 */
function _normalizeSynth(synth, config, fnName) {
    if (synth === null || synth === undefined) {
        return { lv: 0, producedUnits: 0, produced: 0, draw: 0 };
    }
    if (!_isPlainObject(synth)) {
        throw new TypeError(`[${fnName}] synth 必须是 { lv, producedUnits } 或 null，实测 ${JSON.stringify(synth)}`);
    }
    if (synth.lv === undefined || synth.lv === null) {
        throw new TypeError(`[${fnName}] synth 缺少 lv（形如 { lv, producedUnits }）：等级必须显式给出`);
    }
    if (synth.producedUnits === undefined || synth.producedUnits === null) {
        throw new TypeError(`[${fnName}] synth 缺少 producedUnits（本波实产电数；料约束本步不建模，由调用方算好传入）`);
    }
    const units = Number(synth.producedUnits);
    if (!Number.isFinite(units) || !Number.isInteger(units) || units < 0) {
        throw new TypeError(`[${fnName}] synth.producedUnits 必须是 ≥ 0 的整数，实测 ${String(synth.producedUnits)}`);
    }
    const lvInt = _requireLevel(synth.lv, fnName, SYNTH_TYPE, FACILITY_LEVELS.length);
    // 1 单位产出 = 1⚡（`electricPerUnit` 的单位是「每产 1⚡ 的耗电」，src/config.js:997 `[盘上]` `[提案]`）
    const draw = synthDrawFor(lvInt, units, config);
    return { lv: lvInt, producedUnits: units, produced: units, draw };
}

/**
 * 本波**可用电力**分项可核（口径 ①②③⑤）：
 *   `gross = generator + synthProduced + battery`
 *   `available = gross − facilityDraw − synthDraw`
 *
 * `facilityDraw` **不含** `synth`（合成器耗电在 `synthDraw` 单列），因此 `available` 扣了两次不同名目：
 * 固定设施耗电 + 合成器产量相关耗电。
 *
 * **`available` 可以是负数**（耗电超过发电 + 存量）。负值原样返回，**不归 0**——
 * 「负 ⇒ E = 0」由 `computePowerShots` 负责，UI 要拿这个负数显示「本波电力赤字 X」`[待定]`。
 *
 * @param {{
 *   generatorLv?:number|null,
 *   batteryReserve:number,
 *   synth?:{lv:number, producedUnits:number}|null,
 *   facilities?:Array<{type:string, lv:number}>
 * }} input - `generatorLv` 缺省/`null` 视为未建发电机（本波发电 0 `[假设]`）
 * @param {object} config
 * @returns {{ generator:number, synthProduced:number, battery:number, facilityDraw:number, synthDraw:number, gross:number, available:number }}
 * @throws {TypeError|RangeError} 各分项校验失败（错误信息点名字段与实值）
 */
export function computeAvailablePower(input, config) {
    if (!_isPlainObject(input)) {
        throw new TypeError(`[computeAvailablePower] input 必须是对象，实测 ${String(input)}`);
    }
    const generatorLv = input.generatorLv;
    const generator = (generatorLv === null || generatorLv === undefined)
        ? 0 // `[假设]` 未建发电机 ⇒ 本波发电 0（不是「免费给 Lv1 发电」）
        : generatorOutputFor(generatorLv, config);
    const battery = _requireBatteryReserve(input.batteryReserve, 'computeAvailablePower');
    const synth = _normalizeSynth(input.synth, config, 'computeAvailablePower');
    const facilityDraw = totalFacilityDraw(input.facilities === undefined ? [] : input.facilities, config);
    const gross = generator + synth.produced + battery;
    const available = gross - facilityDraw - synth.draw;
    return {
        generator,
        synthProduced: synth.produced,
        battery,
        facilityDraw,
        synthDraw: synth.draw,
        gross,
        available,
    };
}

/**
 * 电力一侧的发数 `E`（`spec_v2 §4.1:161` 逐字：`E = floor(可用电力 / 每发耗电)`）。
 * 取整与除零**一律复用第 1 步的 `computePowerShots`**（`src/utils/material_loadout_utils.js:176`）：
 * 它已负责「可用电力为负按 0」「每发耗电 ≤ 0 或非有限数抛 `RangeError`」，
 * 本层不重写这两条（口径 ③ ⑥）。
 *
 * @param {{ generatorLv?:number|null, batteryReserve:number, synth?:object|null, facilities?:Array, powerPerShot:number }} input
 *        `powerPerShot` 是盘上**不存在**的新键，值 `[待标定]`，**必须由调用方传入**，本文件不写任何具体数。
 * @param {object} config
 * @returns {{ available:number, powerPerShot:number, shots:number, budget:ReturnType<typeof computeAvailablePower> }}
 *          `available` 保留负值（赤字展示要用），`shots` 已按 `computePowerShots` 封底为 ≥ 0
 * @throws {TypeError|RangeError} `powerPerShot` ≤ 0 / 非有限数（由 `computePowerShots` 抛出）/ 其余同 `computeAvailablePower`
 */
export function resolvePowerShots(input, config) {
    if (!_isPlainObject(input)) {
        throw new TypeError(`[resolvePowerShots] input 必须是对象，实测 ${String(input)}`);
    }
    const budget = computeAvailablePower(input, config);
    const shots = computePowerShots(budget.available, input.powerPerShot);
    return {
        available: budget.available,
        powerPerShot: Number(input.powerPerShot),
        shots,
        budget,
    };
}
