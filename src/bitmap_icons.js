/**
 * bitmap_icons.js — 位图图标资源映射表
 * Phase 5A: Task 5.A5 (弹药法球) / Task 5.A6 (符文图标) / Task 5.A7 (遗物图标)
 *
 * 使用方式：
 *   import { AMMO_ICON_MAP, RUNE_ICON_MAP, RELIC_ICON_MAP } from './bitmap_icons.js';
 *   const src = AMMO_ICON_MAP['pyro'] ?? AMMO_ICON_MAP['default'];
 *
 * 路径约定：相对于 index.html 所在目录（项目根目录）
 */

// ============================================================
// Task 5.A5 — 弹药法球图标映射（属性 32×32）
// key 对应 recipe 中的属性名 / MarbleDefinition.type
// ============================================================
const BITMAP_ASSET_VERSION = '20260619-bitmap-v3';

function versionBitmapSrc(path) {
    if (!path) return path;
    return path.includes('?') ? `${path}&v=${BITMAP_ASSET_VERSION}` : `${path}?v=${BITMAP_ASSET_VERSION}`;
}

export const AMMO_ICON_MAP = {
    default:      'assets/icons/ammo/ammo_normal.png',
    normal:       'assets/icons/ammo/ammo_normal.png',
    white:        'assets/icons/ammo/ammo_normal.png',
    pyro:         'assets/icons/ammo/ammo_pyro.png',
    cryo:         'assets/icons/ammo/ammo_cryo.png',
    lightning:    'assets/icons/ammo/ammo_lightning.png',
    laser:        'assets/icons/ammo/ammo_laser.png',
    pierce:       'assets/icons/ammo/ammo_pierce.png',
    bounce:       'assets/icons/ammo/ammo_bounce.png',
    scatter:      'assets/icons/ammo/ammo_scatter.png',
    explosive:    'assets/icons/ammo/ammo_explosive.png',
    wind:         'assets/icons/ammo/ammo_wind.png',
    flying_sword: 'assets/icons/ammo/ammo_flying_sword.png',
    matryoshka:   'assets/icons/ammo/ammo_matryoshka.png',
    rainbow:      'assets/icons/ammo/ammo_rainbow.png',
    resonance:    'assets/icons/ammo/ammo_resonance.png',
    damage:       'assets/icons/ammo/ammo_normal.png',
    venom:        'assets/icons/ammo/ammo_venom.png',
    overcharge:   'assets/icons/ammo/ammo_overcharge.png',
    echo:         'assets/icons/ammo/ammo_echo.png',
};

// ============================================================
// Task 5.A6 — 符文图标映射（13 种符文 48×48）
// key 对应 RUNE_DB 中的 id 字段
// ============================================================
export const RUNE_ICON_MAP = {
    rune_pyro_1:      'assets/icons/rune/rune_pyro_1.png',
    rune_pyro_2:      'assets/icons/rune/rune_pyro_2.png',
    rune_cryo_1:      'assets/icons/rune/rune_cryo_1.png',
    rune_cryo_2:      'assets/icons/rune/rune_cryo_2.png',
    rune_lightning_1: 'assets/icons/rune/rune_lightning_1.png',
    rune_lightning_2: 'assets/icons/rune/rune_lightning_2.png',
    rune_bounce_1:    'assets/icons/rune/rune_bounce_1.png',
    rune_bounce_2:    'assets/icons/rune/rune_bounce_2.png',
    rune_pierce_1:    'assets/icons/rune/rune_pierce_1.png',
    rune_pierce_2:    'assets/icons/rune/rune_pierce_2.png',
    rune_scatter_1:   'assets/icons/rune/rune_scatter_1.png',
    rune_laser_1:     'assets/icons/rune/rune_laser_1.png',
    rune_laser_2:     'assets/icons/rune/rune_laser_2.png',
    rune_venom_1:     'assets/icons/rune/rune_venom_1.png',
    rune_venom_2:     'assets/icons/rune/rune_venom_2.png',
    rune_overcharge_1:'assets/icons/rune/rune_overcharge_1.png',
    rune_echo_1:      'assets/icons/rune/rune_echo_1.png',
};

// ============================================================
// Task 5.A7 — 遗物图标映射（58 种遗物 64×64）
// key 对应 RELIC_DB 中的 id 字段
// ============================================================
export const RELIC_ICON_MAP = {
    gigantism_relic:           'assets/icons/relic/gigantism_relic.png',
    chaos_essence:             'assets/icons/relic/chaos_essence.png',
    pure_essence:              'assets/icons/relic/pure_essence.png',
    dimension_shard:           'assets/icons/relic/dimension_shard.png',
    dimension_crystal:         'assets/icons/relic/dimension_crystal.png',
    stars_shines:              'assets/icons/relic/stars_shines.png',
    optical_lens:              'assets/icons/relic/optical_lens.png',
    pink_slime:                'assets/icons/relic/pink_slime.png',
    energy_shield:             'assets/icons/relic/energy_shield.png',
    unlock_recall:             'assets/icons/relic/unlock_recall.png',
    unlock_multicast:          'assets/icons/relic/unlock_multicast.png',
    unlock_split:              'assets/icons/relic/unlock_split.png',
    slot_expander:             'assets/icons/relic/slot_expander.png',
    cryo_stone:                'assets/icons/relic/cryo_stone.png',
    pyro_stone:                'assets/icons/relic/pyro_stone.png',
    // lightning_stone 暂未生成位图：移除指向 cryo_stone 的错误 fallback，让 UI 走 emoji
    tactical_kit_pierce:       'assets/icons/relic/tactical_kit_pierce.png',
    tactical_kit_scatter:      'assets/icons/relic/tactical_kit_scatter.png',
    tactical_kit_damage:       'assets/icons/relic/tactical_kit_damage.png',
    explosive_ammo:            'assets/icons/relic/explosive_ammo.png',
    prism_shard:               'assets/icons/relic/prism_shard.png',
    russian_doll:              'assets/icons/relic/russian_doll.png',
    triangle_formation:        'assets/icons/relic/triangle_formation.png',
    diamond_formation:         'assets/icons/relic/diamond_formation.png',
    sparse_interval:           'assets/icons/relic/sparse_interval.png',
    mirror_sync:               'assets/icons/relic/mirror_sync.png',
    wide_narrow:               'assets/icons/relic/wide_narrow.png',
    surge_bounce:              'assets/icons/relic/surge_bounce.png',
    surge_pierce:              'assets/icons/relic/surge_pierce.png',
    surge_scatter:             'assets/icons/relic/surge_scatter.png',
    surge_damage:              'assets/icons/relic/surge_damage.png',
    surge_cryo:                'assets/icons/relic/surge_cryo.png',
    surge_pyro:                'assets/icons/relic/surge_pyro.png',
    rune_siphon:               'assets/icons/relic/rune_siphon.png',
    ammo_bandolier:            'assets/icons/relic/ammo_bandolier.png',
    opening_salvo:             'assets/icons/relic/opening_salvo.png',
    thunder_coil:              'assets/icons/relic/thunder_coil.png',
    ember_fuse:                'assets/icons/relic/ember_fuse.png',
    alchemist_powder_tube:     'assets/icons/relic/alchemist_powder_tube.png',
    smuggler_pouch_common:     'assets/icons/relic/smuggler_pouch_common.png',
    smuggler_chest_rare:       'assets/icons/relic/smuggler_chest_rare.png',
    smuggler_vault_epic:       'assets/icons/relic/smuggler_vault_epic.png',
    smuggler_sanctum_legendary:'assets/icons/relic/smuggler_sanctum_legendary.png',
    desperation_blade:         'assets/icons/relic/desperation_blade.png',
    skill_frost_prison:        'assets/icons/relic/skill_frost_prison.png',
    skill_thunder_call:        'assets/icons/relic/skill_thunder_call.png',
    skill_kinetic_burst:       'assets/icons/relic/skill_kinetic_burst.png',
    skill_meltdown_nova:       'assets/icons/relic/skill_meltdown_nova.png',
    skill_blade_rain:          'assets/icons/relic/skill_blade_rain.png',
    skill_prismatic_shot:      'assets/icons/relic/skill_prismatic_shot.png',
};

// ============================================================
// 敵人視覺 V2 — 基底圖標映射（圖鑒 / 試煉場 / 結算頁引用）
// key 為 baseArchetype（與 Enemy.baseArchetype 對齊）
// 來源 metadata：src/data/enemy_v2_metadata.js（單一資料源）
// ============================================================
import { ENEMY_V2_METADATA, ENEMY_V2_BY_ARCHETYPE } from './data/enemy_v2_metadata.js';

export const ENEMY_V2_ICON_MAP = ENEMY_V2_METADATA.reduce((acc, m) => {
    acc[m.baseArchetype] = m.iconPath;
    acc[m.id] = m.iconPath;
    acc[m.resourceId] = m.iconPath;
    return acc;
}, {});

/**
 * 通过 baseArchetype / id / resourceId 获取 V2 敵人圖標路徑。
 * 找不到返回 null（UI 應 fallback 到 emoji 或文字標籤）。
 * @param {string} key
 * @returns {string|null}
 */
export function getEnemyV2IconSrc(key) {
    if (!key) return null;
    return ENEMY_V2_ICON_MAP[key] ?? null;
}

/**
 * 获取弹药图标路径
 * @param {object} recipe - 弹药配方对象
 * @returns {string} 图标路径
 */
function getAmmoIconSrcRaw(recipe) {
    if (!recipe) return AMMO_ICON_MAP.default;
    // [icon-fix] 优先识别特殊弹种（套娃 / 七彩 / 共鸣 / 飞剑 / 风），
    // 然后是 isLaser / explosive，最后才是元素/伤害属性。
    if (recipe.isMatryoshka)                                       return AMMO_ICON_MAP.matryoshka;
    if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow')     return AMMO_ICON_MAP.rainbow;
    if (recipe.type === 'resonance' || recipe._marbleType === 'resonance') return AMMO_ICON_MAP.resonance;
    if (recipe.type === 'venom' || recipe._marbleType === 'venom') return AMMO_ICON_MAP.venom;
    if (recipe.type === 'overcharge' || recipe._marbleType === 'overcharge') return AMMO_ICON_MAP.overcharge;
    if (recipe.type === 'echo' || recipe._marbleType === 'echo') return AMMO_ICON_MAP.echo;
    if (recipe.type === 'flying_sword' || recipe.flying_sword)     return AMMO_ICON_MAP.flying_sword;
    if (recipe.wind)                                               return AMMO_ICON_MAP.wind;
    if (recipe.isLaser)    return AMMO_ICON_MAP.laser;
    if (recipe.explosive)  return AMMO_ICON_MAP.explosive;
    if (recipe.pyro)       return AMMO_ICON_MAP.pyro;
    if (recipe.cryo)       return AMMO_ICON_MAP.cryo;
    if (recipe.lightning)  return AMMO_ICON_MAP.lightning;
    if (recipe.pierce)     return AMMO_ICON_MAP.pierce;
    if (recipe.bounce)     return AMMO_ICON_MAP.bounce;
    if (recipe.scatter)    return AMMO_ICON_MAP.scatter;
    if (recipe.venom)      return AMMO_ICON_MAP.venom;
    if (recipe.overcharge) return AMMO_ICON_MAP.overcharge;
    if (recipe.echo)       return AMMO_ICON_MAP.echo;
    return AMMO_ICON_MAP.default;
}

export function getAmmoIconSrc(recipe) {
    return versionBitmapSrc(getAmmoIconSrcRaw(recipe));
}

/**
 * 通过单个属性 key（marble.type 或 recipe 属性名）直接获取弹药图标路径。
 * 用于命运选择卡片、替换子弹卡片等需要按"主属性"展示图标的场景。
 * @param {string} key
 * @returns {string|null}
 */
export function getAmmoIconSrcByKey(key) {
    if (!key) return null;
    return versionBitmapSrc(AMMO_ICON_MAP[key] ?? null);
}

/**
 * 获取符文图标路径
 * @param {string} runeId - RUNE_DB 中的 id
 * @returns {string|null} 图标路径，null 表示无位图（fallback 到 emoji）
 */
export function getRuneIconSrc(runeId) {
    return versionBitmapSrc(RUNE_ICON_MAP[runeId] ?? null);
}

/**
 * 获取遗物图标路径
 * @param {string} relicId - RELIC_DB 中的 id
 * @returns {string|null} 图标路径，null 表示无位图（fallback 到 emoji）
 */
export function getRelicIconSrc(relicId) {
    return versionBitmapSrc(RELIC_ICON_MAP[relicId] ?? null);
}

// ============================================================
// UI Sprite 资源（Canvas 绘制用）— 发射器 / 属性球轨道
// 通过 getUiBitmap(path) 获取已加载的 Image，未就绪时返回 null
// ============================================================

const _uiBitmapCache = new Map();

/**
 * 获取 UI 位图（Canvas 用）。首次访问时异步加载，未就绪返回 null（调用方应 fallback）。
 * @param {string} path
 * @returns {HTMLImageElement|null}
 */
export function getUiBitmap(path) {
    if (!path) return null;
    let img = _uiBitmapCache.get(path);
    if (!img) {
        img = new Image();
        img.src = path;
        _uiBitmapCache.set(path, img);
    }
    return (img.complete && img.naturalWidth > 0) ? img : null;
}

// 属性轨道球底座（recipe 关键字 → 7 元素 socket 贴图，覆盖率不全则保持 fallback）
export const ORBITAL_SOCKET_MAP = {
    pyro:      'assets/ui/sprites/orbital_socket_pyro.png',
    cryo:      'assets/ui/sprites/orbital_socket_cryo.png',
    lightning: 'assets/ui/sprites/orbital_socket_electro.png',
    laser:     'assets/ui/sprites/orbital_socket_hydro.png',
    bounce:    'assets/ui/sprites/orbital_socket_dendro.png',
    pierce:    'assets/ui/sprites/orbital_socket_anemo.png',
    damage:    'assets/ui/sprites/orbital_socket_geo.png',
};

export const ORBITAL_LINK_STRIP   = 'assets/ui/sprites/orbital_link_strip.png';
export const ORBITAL_LINK_CAP     = 'assets/ui/sprites/orbital_link_cap.png';
export const ORBITAL_LINK_FLOW    = [
    'assets/ui/sprites/orbital_link_flow_0.png',
    'assets/ui/sprites/orbital_link_flow_1.png',
    'assets/ui/sprites/orbital_link_flow_2.png',
    'assets/ui/sprites/orbital_link_flow_3.png',
];
export const ORBITAL_INTAKE = [
    'assets/ui/sprites/orbital_intake_0.png',
    'assets/ui/sprites/orbital_intake_1.png',
    'assets/ui/sprites/orbital_intake_2.png',
    'assets/ui/sprites/orbital_intake_3.png',
];

export const EMITTER_BASE_SRC = 'assets/ui/sprites/emitter_base_v3.png';
export const EMITTER_DRAW_SIZE = 128;
export const EMITTER_PORT_OFFSET_Y = 44;
export const EMITTER_CHARGING_SRCS = [
    'assets/ui/sprites/emitter_charging_v3_0.png',
    'assets/ui/sprites/emitter_charging_v3_1.png',
    'assets/ui/sprites/emitter_charging_v3_2.png',
    'assets/ui/sprites/emitter_charging_v3_3.png',
    'assets/ui/sprites/emitter_charging_v3_4.png',
    'assets/ui/sprites/emitter_charging_v3_5.png',
];

// Canvas 背景位图（战斗 / 研磨阶段共用主底图，发射区单独叠加炼金台层）
export const BG_MAIN_CANVAS_SRC   = versionBitmapSrc('assets/ui/backgrounds/bg_main_canvas.png');
export const BG_EMITTER_ZONE_SRC  = versionBitmapSrc('assets/ui/backgrounds/bg_emitter_zone.png');

/**
 * 预热 UI 位图（在游戏启动早期调用，避免战斗首帧卡顿）。
 */
export function preloadUiBitmaps() {
    const paths = [
        EMITTER_BASE_SRC,
        ...EMITTER_CHARGING_SRCS,
        ...Object.values(ORBITAL_SOCKET_MAP),
        ORBITAL_LINK_STRIP,
        ORBITAL_LINK_CAP,
        ...ORBITAL_LINK_FLOW,
        ...ORBITAL_INTAKE,
        BG_MAIN_CANVAS_SRC,
        BG_EMITTER_ZONE_SRC,
    ];
    paths.forEach(p => getUiBitmap(p));
}
