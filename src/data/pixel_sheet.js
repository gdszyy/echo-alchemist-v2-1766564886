/**
 * src/data/pixel_sheet.js — 敌人像素 sheet（`pixel-sheet@1`）运行时加载层
 *
 * 职责：把敌人渲染源从 `enemy_visual_assets`（旧涂抹风位图清单）切到
 * `assets/pixel/enemies/` 下的原生像素 sheet。旧清单**不删除、不改动**，
 * 未接线的 archetype 继续走旧路径。
 *
 * 设计口径（与 `docs/review/art-20261025.md` A-01 一致）：
 *   - 帧坐标、帧尺寸、网格、碰撞数据**一律运行时从 JSON 读取**，
 *     不在本文件写死任何像素值。本文件只保存「archetype → 文件名」这层目录表。
 *   - 绘制尺寸按 sheet 自己的 `collision_mapping` 口径：
 *       w,h = canvas (cols*26-2, rows*26-2)，origin at canvas centre
 *     即像素画布宽高比 = (cols*26-2) : (rows*26-2)，绘制时按该长宽比等比适配目标框。
 *
 * 分批接线：`PIXEL_SHEET_WIRED_ARCHETYPES` 是白名单。
 * 命中白名单且 sheet 加载成功 → 用像素 sheet 绘制；否则（含加载失败）→ 回退旧位图。
 *
 * @module data/pixel_sheet
 */

export const PIXEL_SHEET_SCHEMA = 'echo-alchemist/pixel-sheet@1';

/** 敌人像素 sheet 目录（相对站点根） */
export const PIXEL_SHEET_BASE_DIR = 'assets/pixel/enemies/';

/** collision_mapping 口径里的格宽（px）：w,h = cols*26-2, rows*26-2 */
export const PIXEL_SHEET_CELL_PX = 26;
/** collision_mapping 口径里的格间隙（px），两端各扣 1 */
export const PIXEL_SHEET_CELL_GAP_PX = 2;

/** 自转 idle 帧交替周期（秒）。像素敌人 idle 只要「呼吸感」，不需要高帧率 */
export const PIXEL_SHEET_IDLE_FRAME_SEC = 0.4;

/**
 * archetype → sheet 文件名（不含扩展名）。
 * 只记文件名，不记任何帧/尺寸数值；与磁盘文件的一致性由
 * `tools/verify/pixel_wire_matrix.mjs` 逐条校验（比对 JSON 内 `archetype` 字段）。
 *
 * 命名差异说明：3×3 引力炉心在 sheet 里叫 `gravityCore`，游戏侧 archetype 叫
 * `gravityWell`（`src/wave_presets.js`），两者未对齐，故此处不建立重力炉心的映射。
 */
export const PIXEL_SHEET_BY_ARCHETYPE = Object.freeze({
    bastion:    'elite_bastion_3x1',
    carrier:    'elite_carrier_3x2',
    deflector:  'elite_deflector_2x1',
    echoSpire:  'elite_echoSpire_1x2',
    hive:       'elite_hive_2x3',
    maw:        'elite_maw_2x2',
    prism:      'elite_prism_1x3',
    siege:      'elite_siege_3x2',
});

/**
 * 已接线白名单（分批铺开）。只有列在这里的 archetype 会走像素 sheet，
 * 其余一律回退旧位图。
 *
 * 第一批只开 `bastion`（3×1 / collision.shape=aabb，最简单），
 * 落盘取证通过后再铺开到其余 7 个「sheet 与游戏侧 archetype 一一对齐」的基底：
 * carrier / deflector / echoSpire / hive / maw / prism / siege。
 *
 * 未列入的（本批不接，见 docs/review/art-wire-20261025.md §4）：
 *   - `gravityWell`：sheet 侧 archetype 字段叫 `gravityCore`，两边命名未对齐，不硬凑。
 *   - 1×1 普通杂兵（无 baseArchetype）与 45 个「按词条命名」的 sheet
 *     （elite_residue_<affix>_1x1 / enemy_minion_<boss>_1x1 / 18 个 overlay）：
 *     游戏侧键不是 archetype，需另一套（affix → sheet）映射，不在本批。
 */
export const PIXEL_SHEET_WIRED_ARCHETYPES = Object.freeze([
    'bastion',
    'carrier',
    'deflector',
    'echoSpire',
    'hive',
    'maw',
    'prism',
    'siege',
]);

/**
 * 状态帧语义：游戏侧状态 → sheet `frames` 里的候选帧名（按顺序取第一个存在的）。
 * 触发条件见 `pickStateFrame`。
 */
export const PIXEL_SHEET_STATE_FRAMES = Object.freeze({
    idle:    Object.freeze(['idle_a', 'idle_b']),
    hit:     Object.freeze(['hit_flash']),
    frozen:  Object.freeze(['frozen']),
    burning: Object.freeze(['burning']),
    hp75:    Object.freeze(['hp_75']),
    hp50:    Object.freeze(['hp_50']),
    hp25:    Object.freeze(['hp_25']),
    death:   Object.freeze(['death_1', 'death_2']),
});

// ─── 读取通道 ────────────────────────────────────────────────────────────────
// 浏览器：fetch。离线取证脚本：注入 reader（读盘），保证同一套解析/校验逻辑。

/** @type {((url: string) => Promise<any>|any)|null} */
let _reader = null;

/** @type {Map<string, object|null>} stem → 已解析的 sheet 元数据（失败记 null） */
const _sheetCache = new Map();
/** @type {Map<string, Promise<object|null>>} stem → 进行中的加载 */
const _sheetPromises = new Map();

/**
 * 注入自定义读取通道（离线验证 / 单测用）。传 null 恢复默认 fetch。
 * @param {((url: string) => Promise<any>|any)|null} reader
 */
export function setPixelSheetReader(reader) {
    _reader = typeof reader === 'function' ? reader : null;
    _sheetCache.clear();
    _sheetPromises.clear();
}

/** 清空缓存（热重载 / 验证脚本重置用） */
export function clearPixelSheetCache() {
    _sheetCache.clear();
    _sheetPromises.clear();
}

async function _readJson(url) {
    if (_reader) return _reader(url);
    if (typeof fetch !== 'function') {
        throw new Error(`pixel_sheet: 运行环境无 fetch 且未注入 reader → ${url}`);
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res || !res.ok) {
        throw new Error(`pixel_sheet: HTTP ${res ? res.status : 'n/a'} → ${url}`);
    }
    return res.json();
}

/** sheet 的 JSON / PNG 相对路径 */
export function getPixelSheetPaths(stem) {
    return {
        jsonPath: `${PIXEL_SHEET_BASE_DIR}${stem}.json`,
        pngPath: `${PIXEL_SHEET_BASE_DIR}${stem}.png`,
    };
}

// ─── 校验与解析 ──────────────────────────────────────────────────────────────

/**
 * 校验一份 sheet 元数据是否满足 `pixel-sheet@1` 的运行时必需字段。
 * @param {object} meta
 * @param {string} [expectedStem]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function validatePixelSheet(meta, expectedStem) {
    const reasons = [];
    if (!meta || typeof meta !== 'object') return { ok: false, reasons: ['元数据不是对象'] };
    if (meta.schema !== PIXEL_SHEET_SCHEMA) reasons.push(`schema 不符: ${String(meta.schema)}`);
    if (expectedStem && meta.asset !== expectedStem) {
        reasons.push(`asset 与文件名不符: ${String(meta.asset)} != ${expectedStem}`);
    }
    if (!Number.isFinite(meta.frame_w) || meta.frame_w <= 0) reasons.push('frame_w 非法');
    if (!Number.isFinite(meta.frame_h) || meta.frame_h <= 0) reasons.push('frame_h 非法');
    if (!Array.isArray(meta.grid) || meta.grid.length !== 2) {
        reasons.push('grid 非法');
    } else if (!(meta.grid[0] > 0) || !(meta.grid[1] > 0)) {
        reasons.push('grid 非正数');
    }
    if (!Array.isArray(meta.order) || meta.order.length === 0) {
        reasons.push('order 为空');
    }
    if (!meta.frames || typeof meta.frames !== 'object') {
        reasons.push('frames 缺失');
    } else {
        if (Array.isArray(meta.order)) {
            for (const name of meta.order) {
                const rect = meta.frames[name];
                if (!rect) {
                    reasons.push(`order 帧缺失: ${name}`);
                } else if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)) {
                    reasons.push(`帧坐标非法: ${name}`);
                }
            }
        }
    }
    return { ok: reasons.length === 0, reasons };
}

/**
 * 读取并缓存一份 sheet 元数据。失败返回 null（调用方据此回退旧位图）。
 * @param {string} stem
 * @returns {Promise<object|null>}
 */
export function loadPixelSheet(stem) {
    if (!stem) return Promise.resolve(null);
    if (_sheetCache.has(stem)) return Promise.resolve(_sheetCache.get(stem));
    if (_sheetPromises.has(stem)) return _sheetPromises.get(stem);

    const { jsonPath } = getPixelSheetPaths(stem);
    const promise = Promise.resolve()
        .then(() => _readJson(jsonPath))
        .then(meta => {
            const check = validatePixelSheet(meta, stem);
            if (!check.ok) {
                console.warn(`[pixel_sheet] ${jsonPath} 校验失败，回退旧位图: ${check.reasons.join('; ')}`);
                _sheetCache.set(stem, null);
                return null;
            }
            _sheetCache.set(stem, meta);
            return meta;
        })
        .catch(err => {
            console.warn(`[pixel_sheet] 加载失败，回退旧位图: ${jsonPath} → ${err && err.message}`);
            _sheetCache.set(stem, null);
            return null;
        });

    _sheetPromises.set(stem, promise);
    return promise;
}

/**
 * 取已缓存的 sheet 元数据（同步）。未加载 / 失败返回 null。
 * @param {string} stem
 */
export function getPixelSheet(stem) {
    return _sheetCache.get(stem) || null;
}

/**
 * 取某个帧的源矩形（直接来自 JSON `frames[name]`）。
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function getFrameRect(meta, name) {
    const rect = meta && meta.frames ? meta.frames[name] : null;
    if (!rect) return null;
    if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)) return null;
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

/**
 * 按 `collision_mapping` 口径算像素画布尺寸：
 *   w,h = cols*26-2, rows*26-2
 * 若 sheet 自带 `collision_box_px`，以它为准并校验两者一致。
 * @returns {{w:number,h:number,aspect:number}|null}
 */
export function getSheetCanvasSize(meta) {
    if (!meta || !Array.isArray(meta.grid)) return null;
    const cols = meta.grid[0];
    const rows = meta.grid[1];
    const derivedW = cols * PIXEL_SHEET_CELL_PX - PIXEL_SHEET_CELL_GAP_PX;
    const derivedH = rows * PIXEL_SHEET_CELL_PX - PIXEL_SHEET_CELL_GAP_PX;
    const box = Array.isArray(meta.collision_box_px) ? meta.collision_box_px : null;
    if (box && (box[0] !== derivedW || box[1] !== derivedH)) {
        console.warn(`[pixel_sheet] collision_box_px 与 grid 口径不一致: ${box.join('x')} vs ${derivedW}x${derivedH}`);
    }
    const w = box ? box[0] : derivedW;
    const h = box ? box[1] : derivedH;
    if (!(w > 0) || !(h > 0)) return null;
    return { w, h, aspect: w / h };
}

/**
 * 该 archetype 是否有 sheet 且已在白名单内（纯查表，不需要加载）。
 * @param {string} archetype
 */
export function isPixelSheetArchetypeWired(archetype) {
    if (!archetype) return false;
    if (!Object.prototype.hasOwnProperty.call(PIXEL_SHEET_BY_ARCHETYPE, archetype)) return false;
    return PIXEL_SHEET_WIRED_ARCHETYPES.includes(archetype);
}

/**
 * 给敌人信息解析像素 sheet 描述符（同步、纯查表；不含帧数据）。
 * 返回 null 表示「不接线」→ 调用方走旧位图。
 *
 * @param {{type?:string, baseArchetype?:string, gridCols?:number, gridRows?:number}} enemy
 * @returns {{archetype:string, stem:string, jsonPath:string, pngPath:string, cols:number, rows:number}|null}
 */
export function resolvePixelSheetArchetype(enemy) {
    if (!enemy) return null;
    if (enemy.type === 'boss') return null;
    const archetype = enemy.baseArchetype;
    if (!isPixelSheetArchetypeWired(archetype)) return null;
    const stem = PIXEL_SHEET_BY_ARCHETYPE[archetype];
    const paths = getPixelSheetPaths(stem);
    return {
        archetype,
        stem,
        jsonPath: paths.jsonPath,
        pngPath: paths.pngPath,
        cols: enemy.gridCols || 1,
        rows: enemy.gridRows || 1,
    };
}

/**
 * 敌人状态 → sheet 帧名。
 *
 * 优先级（高 → 低）：frozen > hit > burning > hp 三档 > idle。
 * 触发条件：
 *   frozen   : enemy.isFrozen（冻结回合 / temp<=-34）
 *   hit      : enemy.hitTimer > 0（受击闪白计时）
 *   burning  : enemy.temp >= 34（与 BurnEffect 触发阈值同源，enemy.js:1014）
 *   hp75/50/25: hp/maxHp ≤ 0.75 / 0.50 / 0.25
 *   idle     : 其余（idle_a / idle_b 交替）
 *
 * @param {object} meta
 * @param {{hpRatio?:number, hit?:boolean, frozen?:boolean, burning?:boolean, death?:boolean}} state
 * @returns {string|null}
 */
export function pickStateFrame(meta, state) {
    if (!meta || !meta.frames) return null;
    const has = (name) => !!getFrameRect(meta, name);
    const firstOf = (key) => {
        const candidates = PIXEL_SHEET_STATE_FRAMES[key] || [];
        for (const name of candidates) if (has(name)) return name;
        return null;
    };

    if (state && state.death) {
        const f = firstOf('death');
        if (f) return f;
    }
    if (state && state.frozen) {
        const f = firstOf('frozen');
        if (f) return f;
    }
    if (state && state.hit) {
        const f = firstOf('hit');
        if (f) return f;
    }
    if (state && state.burning) {
        const f = firstOf('burning');
        if (f) return f;
    }
    const ratio = state && Number.isFinite(state.hpRatio) ? state.hpRatio : 1;
    if (ratio <= 0.25) {
        const f = firstOf('hp25');
        if (f) return f;
    } else if (ratio <= 0.5) {
        const f = firstOf('hp50');
        if (f) return f;
    } else if (ratio <= 0.75) {
        const f = firstOf('hp75');
        if (f) return f;
    }
    return firstOf('idle');
}

/**
 * 该 sheet 的碰撞数据（供后续把命中判定切到像素口径用）。
 * 本批未接命中判定，仅解析出来备查。
 * @returns {{shape:string|null, vertices_canvas:Array<[number,number]>|null, box:number[]|null}}
 */
export function getSheetCollision(meta) {
    const collision = (meta && meta.collision) || {};
    return {
        shape: typeof collision.shape === 'string' ? collision.shape : null,
        vertices_canvas: Array.isArray(collision.vertices_canvas) ? collision.vertices_canvas : null,
        box: Array.isArray(meta && meta.collision_box_px) ? meta.collision_box_px : null,
    };
}
