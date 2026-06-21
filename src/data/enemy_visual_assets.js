/**
 * enemy_visual_assets.js — V2 敌人美术资源解析层
 *
 * 单一资源键来源（与 assets/sprites/enemies/enemy_sprite_manifest.json 同步）。
 *
 * 资源键格式：`<baseArchetype>:<cols>x<rows>:<sortedAffixSet>`
 *   - 1×1 普通残渣：`residue:1x1:`（affixSet 为空）
 *   - 3×1 装甲横梁：`bastion:3x1:heavyArmor`
 *   - 2×2 深渊胃囊：`maw:2x2:devour`
 *   - 3×2 攻城履带：`siege:3x2:siege`
 *
 * 解析顺序（resolveEnemyVisualAsset）：
 *   1) 命中 `composites[<assetKey>]`               → fallbackLevel='composite'
 *   2) 命中 `archetypes[<baseArchetype>]`          → fallbackLevel='archetype'
 *   3) 上述均未命中且仍提供 baseArchetype          → fallbackLevel='vector'（程序化绘制）
 *   4) 完全未提供 baseArchetype（普通 1×1）          → fallbackLevel='vector'
 *
 * 任何步骤的缺失原因都写入 `missingReasons`，方便试炼场 UI 显示资源命中状态。
 *
 * 该模块不应直接执行 fetch；manifest 通过静态 JSON 引入（顶层 import assertion 无法
 * 在浏览器原生 ESM 中保证可用，因此采用同步要求嵌入策略：项目通过 Vite/构建工具
 * 处理 JSON 模块时正常工作；运行环境支持原生 fetch 时由调用者负责预加载）。
 *
 * 实现采用 fetch + 缓存的延迟加载，并提供同步默认 manifest 兜底，
 * 使资源解析在 manifest 仍未加载完成时也能返回 archetype/vector 兜底数据。
 */

import { ENEMY_V2_BY_ARCHETYPE } from './enemy_v2_metadata.js';

const MANIFEST_PATH = 'assets/sprites/enemies/enemy_sprite_manifest.json';

/** @type {object|null} 已加载的 manifest（fetch 成功后填充） */
let _manifest = null;
/** @type {Promise<object>|null} 正在进行的 manifest 加载 Promise */
let _manifestPromise = null;

/**
 * 内嵌默认 manifest 索引：用于 manifest fetch 尚未完成时即时返回兜底数据。
 * 仅包含组合键、resourceId 与文件名映射，不含完整 metadata。
 * 与 enemy_sprite_manifest.json 的 composites 段保持一致，新增组合时同步更新。
 */
const _DEFAULT_DIRS = {
    archetypes: 'assets/sprites/enemies/archetypes/',
    composites: 'assets/sprites/enemies/composites/',
    overlays: 'assets/sprites/enemies/overlays/',
    frames: 'assets/sprites/enemies/frames/',
    archetypeIcons: 'assets/ui/icons/enemy_archetypes/',
    affixIcons: 'assets/ui/icons/enemy_affixes/',
};

const _DEFAULT_COMPOSITES = {
    'residue:1x1:':                     'enemy_residue_1x1_native_hollow_idle',
    'bastion:3x1:heavyArmor':           'enemy_bastion_heavyarmor_3x1_idle',
    'maw:2x2:devour':                   'enemy_maw_devour_2x2_native_hollow_idle',
    'siege:3x2:siege':                  'enemy_siege_siege_3x2_native_hollow_idle',
    'echoSpire:1x2:echoRelay':          'enemy_spire_echorelay_1x2_idle',
    'deflector:2x1:deflectionWard':     'enemy_ward_deflection_2x1_idle',
};

const _DEFAULT_ARCHETYPE_FILES = {
    bastion:     'enemy_bastion_3x1',
    maw:         'enemy_maw_2x2_native_hollow',
    deflector:   'enemy_deflector_2x1',
    echoSpire:   'enemy_echo_spire_1x2',
    prism:       'enemy_prism_1x3',
    hive:        'enemy_hive_2x3_native_hollow',
    siege:       'enemy_siege_3x2_native_hollow',
    gravityWell: 'enemy_gravity_core_3x3',
};

const _DEFAULT_ARCHETYPE_ICONS = {
    bastion:     'archetype_bastion.png',
    maw:         'archetype_maw.png',
    siege:       'archetype_siege.png',
    deflector:   'enemy_deflector_2x1.png',
    echoSpire:   'enemy_echo_spire_1x2.png',
    prism:       'enemy_prism_1x3.png',
    hive:        'enemy_hive_2x3.png',
    gravityWell: 'enemy_gravity_core_3x3.png',
};

const _DEFAULT_AFFIX_ICONS = {
    devour:     'affix_devour.png',
    heavyArmor: 'affix_heavyArmor.png',
    deflectionWard: 'affix_deflectionWard.png',
    echoRelay:  'affix_echoRelay.png',
    prism:      'affix_prism.png',
    hive:       'affix_hive.png',
    gravityWell:'affix_gravityWell.png',
    siege:      'affix_siege.png',
    shield:     'affix_shield.png',
    regen:      'affix_regen.png',
};

const _DEFAULT_OVERLAYS = {
    shield:  'overlay_affix_shield.png',
    regen:   'overlay_affix_regen.png',
    berserk: 'overlay_affix_berserk.png',
    haste:   'overlay_affix_haste.png',
    healer:  'overlay_affix_healer.png',
    clone:   'overlay_affix_clone.png',
};

const _DEFAULT_FRAMES = {
    'residue:1x1':   { spritePath: 'assets/sprites/enemies/frames/frame_residue_1x1.png', shape: 'aabb' },
    'bastion:3x1':   { spritePath: 'assets/sprites/enemies/frames/frame_bastion_3x1.png', shape: 'aabb' },
    'maw:2x2':       { spritePath: 'assets/sprites/enemies/frames/frame_maw_2x2.png', shape: 'polygon' },
    'deflector:2x1': { spritePath: 'assets/sprites/enemies/frames/frame_deflector_2x1.png', shape: 'polygon' },
    'echoSpire:1x2': { spritePath: 'assets/sprites/enemies/frames/frame_echo_spire_1x2.png', shape: 'polygon' },
    'prism:1x3':     { spritePath: 'assets/sprites/enemies/frames/frame_prism_1x3.png', shape: 'polygon' },
    'hive:2x3':      { spritePath: 'assets/sprites/enemies/frames/frame_hive_2x3.png', shape: 'aabb' },
    'siege:3x2':     { spritePath: 'assets/sprites/enemies/frames/frame_siege_3x2.png', shape: 'polygon' },
    'gravityWell:3x3': { spritePath: 'assets/sprites/enemies/frames/frame_gravity_core_3x3.png', shape: 'arc' },
};

/**
 * 异步加载 manifest 文件，返回 Promise<manifest>。
 * 浏览器环境使用 fetch；Node 环境（node --check / SSR）跳过 fetch，仅返回内嵌默认值。
 */
export function loadEnemyVisualAssetManifest() {
    if (_manifest) return Promise.resolve(_manifest);
    if (_manifestPromise) return _manifestPromise;

    if (typeof fetch !== 'function') {
        // Node / 测试环境：直接给出内嵌兜底，避免阻塞调用
        _manifest = _buildDefaultManifest();
        return Promise.resolve(_manifest);
    }

    _manifestPromise = fetch(MANIFEST_PATH)
        .then(r => r.ok ? r.json() : Promise.reject(new Error('manifest http ' + r.status)))
        .then(json => { _manifest = json; return _manifest; })
        .catch(err => {
            console.warn('[enemy_visual_assets] manifest 加载失败，使用内嵌默认值:', err.message);
            _manifest = _buildDefaultManifest();
            return _manifest;
        });
    return _manifestPromise;
}

function _buildDefaultManifest() {
    const composites = {};
    for (const [key, baseName] of Object.entries(_DEFAULT_COMPOSITES)) {
        const [arch, foot, affix] = key.split(':');
        composites[key] = {
            resourceId: baseName.replace(/_idle$/, ''),
            spritePath: _DEFAULT_DIRS.composites + baseName + '.png',
            manifestPath: _DEFAULT_DIRS.composites + baseName + '.json',
            baseArchetype: arch,
            footprint: foot,
            affixes: affix ? affix.split('+') : [],
            placeholder: false,
        };
    }
    const archetypes = {};
    for (const [arch, baseName] of Object.entries(_DEFAULT_ARCHETYPE_FILES)) {
        archetypes[arch] = {
            spritePath: _DEFAULT_DIRS.archetypes + baseName + '.png',
            manifestPath: _DEFAULT_DIRS.archetypes + baseName + '.json',
            placeholder: false,
        };
    }
    return {
        version: 1,
        directories: { ..._DEFAULT_DIRS },
        archetypeIcons: { ..._DEFAULT_ARCHETYPE_ICONS },
        affixIcons:    { ..._DEFAULT_AFFIX_ICONS },
        overlays:      { ..._DEFAULT_OVERLAYS },
        frames:        { ..._DEFAULT_FRAMES },
        archetypes,
        composites,
    };
}

/** 读取当前 manifest（同步），未加载时返回内嵌默认值。 */
export function getEnemyVisualAssetManifest() {
    if (_manifest) return _manifest;
    return _buildDefaultManifest();
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

/**
 * 排序并归一化 affix 集合，作为资源键末段。
 * 例如：['shield','regen']  → 'regen+shield'
 *      []                  → ''
 */
export function normalizeAffixSet(affixes) {
    if (!affixes || affixes.length === 0) return '';
    return [...affixes].map(String).sort().join('+');
}

/**
 * 根据 enemy 信息计算资源键。
 *   <baseArchetype>:<cols>x<rows>:<sortedAffixSet>
 *
 * baseArchetype 缺省时使用 'residue'（1×1 普通敌人基线）。
 */
export function buildEnemyAssetKey(enemy) {
    const cols = (enemy && enemy.gridCols) || 1;
    const rows = (enemy && enemy.gridRows) || 1;
    let arch = enemy && enemy.baseArchetype;
    if (!arch) arch = (cols === 1 && rows === 1) ? 'residue' : 'unknown';
    const affixKey = normalizeAffixSet((enemy && enemy.affixes) || []);
    return `${arch}:${cols}x${rows}:${affixKey}`;
}

// ─── 主解析函数 ────────────────────────────────────────────────────────────

/**
 * 解析敌人当前可用的美术资源。
 *
 * @param {object} enemy - 至少包含 baseArchetype/gridCols/gridRows/affixes 的对象
 * @returns {{
 *   assetKey: string,
 *   spritePath: string|null,
 *   manifestPath: string|null,
 *   fallbackLevel: 'composite'|'archetype'|'vector',
 *   missingReasons: string[],
 *   archetypeIcon: string|null,
 *   affixIcons: Array<{ affix: string, path: string|null }>,
 *   overlayPaths: Array<{ affix: string, path: string }>,
 *   frameKey: string|null,
 *   framePath: string|null,
 *   frameShape: string|null
 * }}
 */
export function resolveEnemyVisualAsset(enemy) {
    const manifest = getEnemyVisualAssetManifest();
    const dirs = manifest.directories || _DEFAULT_DIRS;

    const assetKey = buildEnemyAssetKey(enemy);
    const cols = (enemy && enemy.gridCols) || 1;
    const rows = (enemy && enemy.gridRows) || 1;
    const baseArchetype = (enemy && enemy.baseArchetype) || ((cols === 1 && rows === 1) ? 'residue' : null);
    const affixes = (enemy && enemy.affixes) || [];
    const frameKey = baseArchetype ? `${baseArchetype}:${cols}x${rows}` : null;

    const missingReasons = [];

    // 1) Composite hit
    let spritePath = null;
    let manifestPath = null;
    let fallbackLevel = 'vector';

    const compositeHit = (manifest.composites || {})[assetKey];
    if (compositeHit && compositeHit.spritePath) {
        spritePath = compositeHit.spritePath;
        manifestPath = compositeHit.manifestPath || null;
        fallbackLevel = 'composite';
    } else {
        if (assetKey) missingReasons.push(`未命中组合资源: ${assetKey}`);

        // 2) Archetype hit
        if (baseArchetype) {
            const archHit = (manifest.archetypes || {})[baseArchetype];
            if (archHit && archHit.spritePath) {
                spritePath = archHit.spritePath;
                manifestPath = archHit.manifestPath || null;
                fallbackLevel = 'archetype';
            } else {
                missingReasons.push(`未命中基底资源: ${baseArchetype}`);
            }
        } else {
            missingReasons.push('无 baseArchetype（按 1×1 残渣处理，回退到矢量）');
        }
    }

    // 3) Archetype UI icon（按基底）
    let archetypeIcon = null;
    if (baseArchetype && manifest.archetypeIcons && manifest.archetypeIcons[baseArchetype]) {
        archetypeIcon = (dirs.archetypeIcons || _DEFAULT_DIRS.archetypeIcons) + manifest.archetypeIcons[baseArchetype];
    } else if (baseArchetype) {
        missingReasons.push(`无基底 UI 图标: ${baseArchetype}`);
    }

    // 4) Affix UI icons + overlays（按词条）
    const affixIcons = [];
    const overlayPaths = [];
    const affixIconMap = manifest.affixIcons || {};
    const overlayMap = manifest.overlays || {};
    for (const a of affixes) {
        const iconFile = affixIconMap[a];
        affixIcons.push({
            affix: a,
            path: iconFile ? (dirs.affixIcons || _DEFAULT_DIRS.affixIcons) + iconFile : null,
        });
        if (!iconFile) missingReasons.push(`无词条 UI 图标: ${a}`);

        const overlayFile = overlayMap[a];
        if (overlayFile) {
            overlayPaths.push({
                affix: a,
                path: (dirs.overlays || _DEFAULT_DIRS.overlays) + overlayFile,
            });
        }
    }

    let framePath = null;
    let frameShape = null;
    if (frameKey) {
        const frameHit = (manifest.frames || {})[frameKey];
        if (frameHit) {
            if (typeof frameHit === 'string') {
                framePath = (dirs.frames || _DEFAULT_DIRS.frames) + frameHit;
            } else {
                framePath = frameHit.spritePath || (frameHit.file ? (dirs.frames || _DEFAULT_DIRS.frames) + frameHit.file : null);
                frameShape = frameHit.shape || null;
            }
        }
    }

    return {
        assetKey,
        spritePath,
        manifestPath,
        fallbackLevel,
        missingReasons,
        archetypeIcon,
        affixIcons,
        overlayPaths,
        frameKey,
        framePath,
        frameShape,
    };
}

/**
 * 把 fallbackLevel 翻译为试炼场场景卡片可显示的中文标签。
 * 命中状态：Sprite / Composite Sprite / Overlay / Vector fallback / Missing asset。
 */
export function describeAssetHitStatus(resolved) {
    if (!resolved) return { tag: 'Missing asset', detail: '无法解析资源' };
    const overlays = resolved.overlayPaths && resolved.overlayPaths.length;
    if (resolved.fallbackLevel === 'composite') {
        return {
            tag: overlays ? 'Composite Sprite + Overlay' : 'Composite Sprite',
            detail: `命中组合资源 ${resolved.assetKey}` + (overlays ? `（叠加 ${overlays} 个词条覆盖层）` : ''),
        };
    }
    if (resolved.fallbackLevel === 'archetype') {
        return {
            tag: overlays ? 'Sprite + Overlay' : 'Sprite',
            detail: `命中基底资源（${resolved.assetKey}）` + (overlays ? `，叠加 ${overlays} 个词条覆盖层` : ''),
        };
    }
    if (resolved.spritePath) {
        return { tag: 'Sprite', detail: `命中资源 ${resolved.assetKey}` };
    }
    if (resolved.fallbackLevel === 'vector') {
        return { tag: 'Vector fallback', detail: '回退到 Canvas 程序化绘制' };
    }
    return { tag: 'Missing asset', detail: (resolved.missingReasons || []).join(' / ') };
}

// 启动时主动尝试加载 manifest（不阻塞调用）
loadEnemyVisualAssetManifest();
