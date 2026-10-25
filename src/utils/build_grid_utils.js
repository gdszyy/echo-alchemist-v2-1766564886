/**
 * build_grid_utils.js - [REQ-20261022-wave-loop · S3] 工厂网格数据结构 + 存档 v3→v4 迁移（纯函数）。
 *
 * 设计依据：docs/design/factory_grid_line_v1.md §6 分件 4（网格数据结构）与分件 12（迁移 8 条规则 ①–⑧）；
 *          已拍板项：§8 第 5 条「炼金收集器并入发电机、降 Lv1 且不补偿」、
 *                    §8 第 6 条 B 案「旧档存量电一律按满电池起步」。
 * 约束：本文件不得 import 任何大文件（config.js / game_*.js 等），node 可直接导入做单测；
 *       调用方把 CONFIG.gameplay.build 作为 cfg 传入（与 src/utils/build_economy_utils.js 同约定）。
 *       所有函数不修改入参；纯函数，无副作用（唯一的输出侧动作是迁移失败时 console.warn）。
 *
 * 本批（S3 第一分件组）**只提供数据结构与迁移函数，不接进载入流程**——game_system.js 的接线留给后续分件。
 *
 * 设备单元（cell 与 combatSlot 共用同一形状）：
 *   { type, level, buildSeq, enabled }
 *   - buildSeq：全局建造序（战斗槽与网格**共用一条序列**，D3「电不够就停最后建造的」是全局心智）；
 *               迁移后新建取 power.buildSeqNext++，换位保号，拆除重建取新号。
 *   - enabled：手动开关的**唯一**落点（不另存 power.switchMask 位图——同一状态两处存，读档必然读出不一致）。
 *
 * 实现期读法（设计稿/复验报告没写死、此处取的读法，逐条写在此处以备返工对照）：
 *   1. 复验 §7-1「键与设施键一一对应」不精确 → draw 里既保留 5 个战斗/后勤耗电键（turret/lightning/frost/
 *      shieldGen/workshop），又明写 generator/battery: 0；**collector 不进 draw**（并入发电机后它不再是独立设备）。
 *   2. 复验 §7-2「下标 ≥ 3 丢弃」与 ①「下标不参与定位」互斥 → 取字面读法：溢出**只看 v3 数组下标**（idx ≥ 3
 *      的元素丢弃并返料），下标**不参与** cells 的定位（定位只按类型分组后的相对出现顺序）。仅手改档会命中。
 *   3. 复验 §7-3「迁移写入的 enabled 初值未写」→ 一律 true（迁移出来的设备默认开机）。
 *   4. 复验 §7-4「兜底整表重排后未重述 buildSeqNext」→ 重排后 buildSeqNext = 重排后的台数（最大号 + 1）。
 *   5. 复验 §7-5（`s2:80` 断的是 6 键合取而非单键）→ 只登记，本批不动任何既有测试文件。
 *   6. 复验 §7-6「:472 现在稿里的默认走向」措辞 → 以 §8 第 6 条拍板的 B 案为准，分件 12 的「不预设」已被决策替代。
 *   7. 设计稿 v1.3 修正（规格缺陷回填）→ ⑦ 幂等判据＝**显式标记 `_v4Migrate.done === true`**；
 *      **废弃**「`grid.cells` 长度 > 0」与「网格里有设备」两种判据：合法的 v4 档可以网格全空、只有战斗设备
 *      （v3 最常见的形态＝只建了炮台），用后两种判据会把它判成没迁过而整份重迁（等级回退／设备消失／白送满电）。
 *      ⑥ 兜底的补跑不再靠版本号，而靠「done 不为真」；兜底本身也不置 done、不写版本 4。
 *   8. ③ 的溢出余数分配（设计稿 v1.3 补定）→ 先 50% 向下取整、再均分三色、**余数按 🔥 → ❄ → ⚡ 逐个 +1**。
 */

/** 存档版本：v3 → v4。 */
export const LOOP_VERSION_V4 = 4;

/** 战斗设备类型（进 combatSlots 的 4 个位）；其余类型一律视为后勤设备（进网格 cells）。 */
export const COMBAT_TYPES = ['turret', 'lightning', 'frost', 'shieldGen'];

/** 战斗槽位数量：v4 起手 3 位、上限 4 位（第 4 位由扩建解锁，迁移时恒 null）。 */
export const COMBAT_SLOT_TOTAL = 4;

/** 旧存档里「已退役/被并入」的设备类型 → 迁移后的设备类型。 */
const MERGED_TYPES = { collector: 'generator' };

function _int(v, fallback = 0) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : fallback;
}

function _list(v) {
    return Array.isArray(v) ? v : [];
}

/**
 * `build.slots.openAtStart`（设施位开局格数）——迁移侧的**下限**来源。
 * 不复用 `_int` 的静默回落：配置缺键 ⇒ 按 1 并 `console.warn` 留痕（静默会把「配置没接上」藏成「开局 1 格」，
 * 也就是本条修补要防的那种漂移）。本文件仍不 import 任何大文件，`cfg` 由调用方传入（约定见文件头）。
 */
function _slotsOpenAtStart(cfg) {
    const slots = (cfg && cfg.slots) || null;
    const raw = slots ? slots.openAtStart : undefined;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1) {
        console.warn('[migrate] cfg.slots.openAtStart 缺失或非正整数，设施位下限按 1 处理 | value=', String(raw));
        return 1;
    }
    return n;
}

function _powerCfg(cfg) {
    return (cfg && cfg.power) || {};
}

function _gridCfg(cfg) {
    const power = _powerCfg(cfg);
    return power.grid || {};
}

/** 网格列数（默认 3）与起手行数（默认 1）。 */
export function getGridShape(cfg = {}) {
    const g = _gridCfg(cfg);
    return {
        cols: Math.max(1, _int(g.cols, 3)),
        rowsStart: Math.max(1, _int(g.rowsStart, 1)),
        rowsMax: Math.max(Math.max(1, _int(g.rowsStart, 1)), _int(g.rowsMax, 5)),
    };
}

/** 一台设备（cell 与 combatSlot 共用形状）。level 从 1 起、buildSeq 必须是全局发号器给的号。 */
export function makeDevice(type, level, buildSeq = 0, enabled = true) {
    if (!type) return null;
    return {
        type,
        level: Math.max(1, _int(level, 1)),
        buildSeq: Math.max(0, _int(buildSeq, 0)),
        enabled: enabled !== false,
    };
}

/** 空的战斗槽数组（长度 COMBAT_SLOT_TOTAL，全 null）。 */
export function createCombatSlots() {
    return new Array(COMBAT_SLOT_TOTAL).fill(null);
}

/**
 * 总电力容量 = 底容量（不建电池就有）+ Σ 各电池座贡献。
 * 注意 battery.capacity 是**单座增量**、不是绝对值（把 Lv1 读成 15 而非 15+15=30 会让 §3.2 三格全崩）。
 * @param {Array<null|{type,level}>} cells
 * @param {object} cfg - CONFIG.gameplay.build
 */
export function getPowerCapacity(cells, cfg = {}) {
    const batt = _powerCfg(cfg).battery || {};
    const base = Math.max(0, _int(batt.baseCapacity, 15));
    const table = _list(batt.capacity);
    let total = base;
    for (const cell of _list(cells)) {
        if (!cell || cell.type !== 'battery') continue;
        const lv = Math.max(1, _int(cell.level, 1));
        total += Math.max(0, _int(table[Math.min(lv, table.length) - 1], 0));
    }
    return total;
}

/**
 * 新开局的 v4 状态字段默认值（分件 4）：起手 1 行 3 格 = 3 个 null cell。
 * @param {object} cfg - CONFIG.gameplay.build
 * @returns {{ grid:{cols,rows,cells}, power:{capacity,reserve,buildSeqNext}, materials:{pyro,cryo,lightning} }}
 */
export function createGridState(cfg = {}) {
    const { cols, rowsStart } = getGridShape(cfg);
    const cells = new Array(cols * rowsStart).fill(null);
    return {
        grid: { cols, rows: rowsStart, cells },
        power: { capacity: getPowerCapacity(cells, cfg), reserve: 0, buildSeqNext: 0 },
        materials: { pyro: 0, cryo: 0, lightning: 0 },
    };
}

/**
 * 全局 buildSeq 发号（分件 12 ② a–d，唯一规则）：
 *   a) 先按战斗槽槽位序 combatSlots[0]→[3] 逐个 +1，起点号 = 0；
 *   b) 再按网格行优先（行 0 列 0→列 2，再行 1…）接着往后编号；
 *   c) 空档位不占号（null 的战斗槽与空格 cell 都不发号，所以号连续、无跳号）；
 *   d) buildSeqNext = 已分配的最大号 + 1（一台设备都没有 → 0）。
 * @returns {{ combatSlots:Array, cells:Array, buildSeqNext:number }} 新数组，不改入参
 */
export function assignBuildSeq(combatSlots, cells) {
    let seq = 0;
    const cs = _list(combatSlots).map(dev => {
        if (!dev || !dev.type) return null;
        return { ...dev, buildSeq: seq++, enabled: dev.enabled !== false };
    });
    const cl = _list(cells).map(dev => {
        if (!dev || !dev.type) return null;
        return { ...dev, buildSeq: seq++, enabled: dev.enabled !== false };
    });
    return { combatSlots: cs, cells: cl, buildSeqNext: seq };
}

/** 收集一台设备的 buildSeq（战斗槽在前、网格在后，与发号顺序一致）。 */
function _collectDevices(state) {
    const out = [];
    for (const dev of _list(state && state.combatSlots)) if (dev && dev.type) out.push(dev);
    for (const dev of _list(state && state.grid && state.grid.cells)) if (dev && dev.type) out.push(dev);
    return out;
}

/** 任意两台的 buildSeq 相同、或为空/非整数 → true（分件 12 ② 的兜底判据）。 */
export function hasDuplicateBuildSeq(state) {
    const seen = new Set();
    for (const dev of _collectDevices(state)) {
        const seq = dev.buildSeq;
        if (!Number.isInteger(seq) || seq < 0) return true;
        if (seen.has(seq)) return true;
        seen.add(seq);
    }
    return false;
}

/**
 * 整表重排一次（分件 12 ② 兜底）：按「先战斗槽 0→3、再网格行优先、同行左→右」重新发 0,1,2…，
 * 并把 power.buildSeqNext 置为台数（复验 §7-4 的读法）。不改入参。
 */
export function repairBuildSeq(state = {}, cfg = {}) {
    const out = _shallowClone(state);
    const { combatSlots, cells, buildSeqNext } = assignBuildSeq(state.combatSlots, state.grid && state.grid.cells);
    const { cols, rowsStart } = getGridShape(cfg);
    out.combatSlots = combatSlots.length ? combatSlots : createCombatSlots();
    out.grid = { ...(state.grid || {}), cols: _int(state.grid && state.grid.cols, cols), rows: _int(state.grid && state.grid.rows, rowsStart), cells };
    out.power = { ...(state.power || {}), capacity: _int(state.power && state.power.capacity, getPowerCapacity(cells, cfg)), reserve: _int(state.power && state.power.reserve, 0), buildSeqNext };
    out.materials = { ...(state.materials || { pyro: 0, cryo: 0, lightning: 0 }) };
    return out;
}

/** 单键克隆（数组逐元素浅拷贝 / 对象浅拷贝 / 标量原样）；兜底路径用它避免与入参别名。 */
function _cloneValue(v) {
    if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object' ? { ...x } : x));
    if (v && typeof v === 'object') return { ...v };
    return v;
}

/**
 * 逐键深拷贝（对畸形/抛错的存档逐键容错——兜底路径本身就是要救坏档，不能再被坏档打死）。
 *
 * `skipKeys`（v1.4 新增）：命中的键**不读、不写**——`continue` 必须放在读取**之前**。
 * 用途：迁移成功路径已经读过一次 `facilities`（守卫判据那一次），这里再读会在非幂等 getter 上读到
 * 第二个值（落档值与实迁值不一致）或直接抛（产物丢掉 `facilities` 键）。成功路径传 `['facilities']`；
 * 兜底路径不传——兜底就是要尽量多救，读几次都无所谓。
 */
function _shallowClone(obj, skipKeys = []) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const key of Object.keys(obj)) {
        if (skipKeys.indexOf(key) !== -1) continue;   // 不读不写：读取会破坏「成功路径只读一次」的判据
        try {
            out[key] = _cloneValue(obj[key]);
        } catch (err) {
            // 单个字段读不出来就跳过，其余字段照旧保留
        }
    }
    return out;
}

/**
 * 迁移闸门（分件 12 ⑦，v1.3 修正）：**唯一主判据 = 显式迁移标记 `_v4Migrate.done === true`**。
 *
 * 为什么不看 `grid.cells`：合法的 v4 存档完全可以**网格全空、只有战斗设备**（玩家只建了炮台、没建收集器
 * ——这是 v3 最常见的形态）。用「cells 长度 > 0」或「网格里有没有设备」都会把这类档判成「没迁过」而整份重迁：
 * 炮台等级回退、已建设备变 null、每次读档白送满电、拆掉的发电机复活。
 *
 * 所以：迁移成功时必须落 `done: true`；闸门只看这个标记。
 * `loopVersion >= 4` 只作**二次保险**，而且方向是「宁可不迁、也不重迁」——重迁才是抹掉玩家进度的那个方向。
 * 因此 ⑥ 的兜底路径**不写 done、也不写版本 4**，下次载入自然会重试（见 _fallbackState）。
 */
export function shouldMigrateV3ToV4(state = {}) {
    const mark = state && typeof state === 'object' ? state._v4Migrate : null;
    if (mark && mark.done === true) return false;                    // 主判据：显式迁移标记
    if (Number(state && state.loopVersion) >= LOOP_VERSION_V4) return false;   // 二次保险：版本已是 4 却缺标记（手改档/旧实现残留）按已迁处理
    return true;
}

/**
 * 50% 建造成本折三色料平均返还（分件 12 ③）：先取 50% 向下取整，再三色均分；
 * **余数分配（v1.3 补定）＝按 🔥 → ❄ → ⚡ 顺序逐个 +1 消化**，不足一轮即停。
 * 判据例：炮台 cost 40 → half 20 → 均分 6/6/6、余 2 → **🔥7 ❄7 ⚡6**（三色合计恒 = half，不少不多）。
 */
function _addOverflowRefund(refund, type, cfg) {
    const facilities = (cfg && cfg.facilities) || {};
    const cost = Math.max(0, _int((facilities[type] || {}).cost, 0));
    const half = Math.floor(cost * 0.5);
    const base = Math.floor(half / 3);
    let rest = half - base * 3;
    refund.pyro += base;
    refund.cryo += base;
    refund.lightning += base;
    for (const key of ['pyro', 'cryo', 'lightning']) {   // 余数按 🔥 → ❄ → ⚡ 逐个 +1
        if (rest <= 0) break;
        refund[key] += 1;
        rest -= 1;
    }
}

/**
 * 存档 v3 → v4 迁移（**纯函数**：输入旧 state，输出结果对象；不修改入参、不读写任何外部状态）。
 *
 * 输入：v3 存档对象（`{ loopVersion:3, energy, crystal, facilities:[null|{type,level,cd}], facilitySlotsOpen,
 *       cannonLevels, cannonBranch, digCount, items, miningLevels, ... }`）
 * 输出：`{ ok, migrated, fallback, state, toasts, version }`
 *       - migrated=false 且 fallback=false → 已有 `_v4Migrate.done === true`（⑦ 幂等，state 为入参的拷贝）
 *       - fallback=true → ⑥ 兜底：**旧键一个都不删**（facilities / crystal / cannonLevels / cannonBranch / digCount / energy），
 *         grid 取起手 3 格空、materials 归 0、power.reserve 归 0，并且**不置 done、不写 loopVersion 4**——
 *         这样下次载入闸门仍判「需要迁」而重试；置了 done 就等于把这次失败钉成永久状态。
 *
 * 迁移规则严格按分件 12 的 ①–⑧ 与 ② 的 a–e 执行，本函数不另择口径。
 * @param {object} state - v3 存档
 * @param {object} cfg - CONFIG.gameplay.build
 */
export function migrateV3ToV4(state = {}, cfg = {}) {
    const src = state && typeof state === 'object' ? state : {};
    const toasts = [];
    if (!shouldMigrateV3ToV4(src)) {
        return { ok: true, migrated: false, fallback: false, state: _shallowClone(src), toasts, version: LOOP_VERSION_V4 };
    }
    try {
        const next = _migrateBody(src, cfg, toasts);
        return { ok: true, migrated: true, fallback: false, state: next, toasts, version: LOOP_VERSION_V4 };
    } catch (err) {
        // ⑥ 载入失败兜底：不回退到新开局（回退＝删号）；不置 done、不写版本 4 → 下次载入自然重试
        console.warn('[migrate] v3→v4 fallback', err && err.message ? err.message : err);
        return { ok: true, migrated: false, fallback: true, state: _fallbackState(src, cfg, toasts, err && err.message ? err.message : err), toasts, version: Number(src.loopVersion) || 3 };
    }
}

/**
 * 迁移主体（①–⑤＋⑧；⑧ 的版本号在末尾写）。
 */
function _migrateBody(src, cfg, toasts) {
    // facilities 的形态分流（v1.4）：**按「读一次是否抛」判，不按值的形状一刀切**。
    //   ① 键在、读一次抛异常 → 不在这里拦，直接冒到外层 catch 走兜底（不置 done、不写版本 4，下次重试）。
    //   ② 键在、值是 `undefined` → 这是**兜底路径留下的痕迹**（_fallbackState 把读不出的值写成 undefined）。
    //      若当成「本来没设备」迁空成功并置 done，就是 H1 那个永久删号，所以照旧判坏档、抛给外层兜底重试。
    //   ③ 键在、值是 `null` 或其它非数组（string/number/boolean/普通对象）→ 值**读得出来**、只是不带设备信息，
    //      不携带任何已付费内容，按「空设备」正常迁移（置 done、给玩家一句可见提示）。
    //      若这里也判坏档，本来没设备的档会每次载入都重试、永不成功＝把玩家锁在门外（复验 M1）。
    // **成功路径全程只读一次**（L2）：本行判据读 1 次，下面 `_shallowClone(src, ['facilities'])` 的克隆阶段
    // 用 `skipKeys` 跳过该键，产物里的
    // `facilities` 由那一次读取的结果归一而来。为什么必须只读一次：getter 不保证幂等，反复读会把
    // 「读一次是否抛」这个判据搞乱，也会让落档值与实迁值不一致（或把该键整个丢掉）。
    const facilitiesKeyPresent = Object.prototype.hasOwnProperty.call(src, 'facilities');
    const rawFacilities = facilitiesKeyPresent ? src.facilities : undefined;   // getter 抛错时直接冒到外层 catch → 兜底
    if (facilitiesKeyPresent && rawFacilities === undefined) {
        throw new Error('facilities 是 undefined（兜底档未修复，不能当成没有设备）');
    }
    if (facilitiesKeyPresent && !Array.isArray(rawFacilities)) {
        toasts.push('存档里的工厂布局无法识别，已按初始布局恢复');
        console.warn('[migrate] v3→v4 facilities 形态不可识别，按空设备迁移 | typeof=', typeof rawFacilities,
            '| value=', String(rawFacilities).slice(0, 40));
    }
    const { cols, rowsStart } = getGridShape(cfg);
    const legacy = _list(rawFacilities);           // v3 的 3 位数组（含 null）；非数组由 _list 归一成 []
    const refund = { pyro: 0, cryo: 0, lightning: 0 };

    // ① 第一步：按**类型**分派。战斗设备 → 战斗槽；其余 → 后勤设备。
    //    （v3 数组下标**不参与**定位；同一类内部才看相对出现顺序。）
    const combat = [];
    const logistics = [];
    legacy.forEach((raw, idx) => {
        if (!raw || !raw.type) return;
        // ③ 溢出：仅防手改档——v3 数组下标 ≥ 3 的设施丢弃，按 cost 的 50% 折三色料平均返还（💎 按 D5 不返）
        if (idx >= 3) {
            _addOverflowRefund(refund, raw.type, cfg);
            return;
        }
        const level = Math.max(1, _int(raw.level, 1));
        if (COMBAT_TYPES.includes(raw.type)) {
            combat.push({ type: raw.type, level });
            return;
        }
        // ⑤ 收集器并入发电机（§8 第 5 条已拍板）：设备本身不消失，但**等级压成 Lv1、产能按 Lv1 计**，
        //    perDig[8,12,16] 与 generate[10,15,20] 不同轴，超出 Lv1 的部分不补偿（Lv2 收集器 +12/挖 → Lv1 发电机 +10/波）。
        if (MERGED_TYPES[raw.type]) {
            logistics.push({ type: MERGED_TYPES[raw.type], level: 1 });
            toasts.push('炼金收集器已并入发电机');
            return;
        }
        logistics.push({ type: raw.type, level });
    });

    // ④ 3→4 位战斗槽：保持相对顺序、空位补 null、第 4 位恒 null 直到扩建
    const draftSlots = createCombatSlots();
    combat.slice(0, COMBAT_SLOT_TOTAL).forEach((dev, i) => { draftSlots[i] = dev; });

    // ① 第二步：后勤设备按相对出现顺序、行优先左到右填 cells（0-0,0-1,0-2,1-0…）
    const rows = Math.max(rowsStart, Math.ceil(logistics.length / cols));
    const draftCells = new Array(rows * cols).fill(null);
    logistics.forEach((dev, i) => { if (i < draftCells.length) draftCells[i] = dev; });

    // ② 全局发号（战斗槽 0→3 先、网格行优先接着、空档不占号、buildSeqNext = 最大号 + 1）
    const numbered = assignBuildSeq(draftSlots, draftCells);
    const combatSlots = numbered.combatSlots;
    const cells = numbered.cells;

    const capacity = getPowerCapacity(cells, cfg);
    const materials = src.materials && typeof src.materials === 'object' ? src.materials : {};
    const legacyEnergy = Math.max(0, _int(src.energy, 0));

    // 其余字段（crystal / cannonLevels / cannonBranch / digCount / items…）原样保留；`facilities` **跳过不读**——
    // 该键的**唯一来源**是上面那一次 `rawFacilities`（L2：成功路径全程只读一次），下面按数组归一重写。
    const out = _shallowClone(src, ['facilities']);
    // **产物归一（v1.4 M2-2）**：畸形原值（`'oops'` / `0` / `true` / `{}` / `null`）**不得**原样进迁移产物，
    // `facilities` 一律是合法数组（非数组 → `[]`）。理由：落盘侧 `src/game_system.js:3224` 是
    // `facilities: (this.facilities || []).map(...)`，对非数组抛 TypeError —— 不归一，接线写档即炸。
    // 元素逐个 `_cloneValue`（不用 `slice()`）：纯函数判据要求「改返回值不回渗入参」，`slice()` 只复制外层数组。
    out.facilities = Array.isArray(rawFacilities) ? rawFacilities.map((f) => _cloneValue(f)) : [];
    out.loopVersion = LOOP_VERSION_V4;          // ⑧ 版本标记
    out.combatSlots = combatSlots;
    // ④ facilitySlotsOpen 1..3 → combatSlotsOpen 1..3。
    // [旧档迁移] 下限从配置 `slots.openAtStart` 读，**不再写死 1**（`src/config.js:967` 已由 1 → 2；写死会在下次改
    //   配置时再漂一次）。语义是**迁移不是重置**——**只抬不压**：只有「非正整数 / 小于 openAtStart」才抬到
    //   openAtStart，玩家靠晶核开出来的更高格数（未来第 3 格）原样保留；上限仍是 3（战斗槽总数未改）。
    const slotsOpenAtStart = _slotsOpenAtStart(cfg);
    out.combatSlotsOpen = Math.min(3, Math.max(slotsOpenAtStart, _int(src.facilitySlotsOpen, slotsOpenAtStart)));
    out.grid = { cols, rows, cells };
    out.power = {
        capacity,
        // §8 第 6 条 **B 案（已拍板）**：旧档存量电一律按「满电池起步」迁——无电池给底容量 15、已有电池给满容量。
        // 为什么不按原值折算：盘上 energy 是购买货币（旧档实测可达 920），新账里 power.reserve 只是「电池存电」，
        // 照直搬再按容量截断等于把 920 压成 15＝资产清零；而按比例折料要新开一条「电↔料」汇率，与本稿反对
        // 「多开兑换通道」自相矛盾。B 案不引新汇率、不引新平衡参数，代价是攒下的电不兑现（版本说明里要写明）。
        reserve: capacity,
        buildSeqNext: numbered.buildSeqNext,
    };
    out.materials = {
        pyro: Math.max(0, _int(materials.pyro, 0)) + refund.pyro,
        cryo: Math.max(0, _int(materials.cryo, 0)) + refund.cryo,
        lightning: Math.max(0, _int(materials.lightning, 0)) + refund.lightning,
    };
    // energy 字段保留（现在是「本波可用电力」这个派生量）；B 案下先置为保底 reserve，等电力结算纯函数（分件 5）重算。
    out.energy = capacity;
    // 迁移标记（**只在顶层 `_v4Migrate`，不进 power**——power 的形状定死 capacity/reserve/buildSeqNext 三键）：
    //   done: true 是 ⑦ 幂等的唯一主判据（见 shouldMigrateV3ToV4；不许再用 cells 长度或「网格有设备」）。
    // 接线期用 toasts 播一次提示（收集器并入 + 存量电按保底处理），播完即可丢弃；保存时按白名单过滤，别让它落盘。
    out._v4Migrate = {
        done: true,
        migFrom: 3,
        migTo: LOOP_VERSION_V4,
        legacyEnergy,
        legacyEnergyPolicy: 'battery-floor',   // B 案：满电池起步
        overflowRefund: refund,
        toasts: toasts.slice(),
    };
    toasts.push(`旧档存量 ${legacyEnergy}⚡ 已按「满电池起步」处理（容量 ${capacity}）`);

    if (hasDuplicateBuildSeq(out)) {
        // ② 的兜底：正常迁移的号是构造性连续的，此分支只为畸形档兜底（整表重排一次并立即落档，不保留重复号）
        return repairBuildSeq(out, cfg);
    }
    return out;
}

/**
 * ⑥ 兜底状态（H1 修正后的三条硬约束）：
 *   ① **不得删除任何旧键**——尤其 `facilities`：保留键逐个确认存在，读不出来（getter 抛错）时**键仍在**、值落
 *      undefined，绝不整个键消失。键都没了 + 下次「迁空成功」＝ 等于永久删号。
 *   ② **不得置 `done: true`、不得把 `loopVersion` 写成 4**——标记不置真，下次载入才会真去重试。
 *   ③ 允许留 `lastError` 诊断字段，但不得把 done 置真。
 */
function _fallbackState(src, cfg, toasts, lastError) {
    const { cols, rowsStart } = getGridShape(cfg);
    const out = _shallowClone(src);     // 兜底路径**不传 skipKeys**：这里就是要尽量多救，`facilities` 读几次都无所谓（补键逻辑见下）
    // ① 保留键逐个补（拷贝值，不留原引用——输出与入参不得别名）
    for (const key of ['facilities', 'crystal', 'cannonLevels', 'cannonBranch', 'digCount', 'energy']) {
        if (Object.prototype.hasOwnProperty.call(out, key)) continue;
        try {
            out[key] = _cloneValue(src[key]);
        } catch (err) {
            out[key] = undefined;   // 键必须仍在（重试与排查都依赖它），只是读不出来
        }
    }
    out.grid = { cols, rows: rowsStart, cells: new Array(cols * rowsStart).fill(null) };
    out.power = { capacity: getPowerCapacity(out.grid.cells, cfg), reserve: 0, buildSeqNext: 0 };
    out.materials = { pyro: 0, cryo: 0, lightning: 0 };
    out._v4Migrate = {          // ② 不置 done；③ 只留诊断
        done: false,
        fallback: true,
        migFrom: 3,
        lastError: String(lastError || 'unknown'),
        toasts: toasts.slice(),
    };
    return out;
}
