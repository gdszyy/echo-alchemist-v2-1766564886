/**
 * enemy_v2_metadata.js — 敌人视觉 V2 基底统一元数据
 *
 * 单一数据源（Single Source of Truth），用于：
 *   - 试炼场 V2 矩阵（systems.js → buildV2MatrixScenarios）
 *   - 真理之书 / 图鉴卡片
 *   - sprite_renderer 资源选择
 *   - bitmap_icons V2 图标映射
 *
 * 后续替换正式美术时，仅需：
 *   1) 替换 assets/sprites/enemies/v2/<resourceId>.png + .json
 *   2) 替换 assets/icons/enemies/<resourceId>.png
 *   3) 如尺寸 / 词条变化，更新本文件对应字段
 *
 * 不要在其它地方硬编码 V2 敌人的 footprint / affix / 中文名。
 */

/**
 * @typedef {Object} EnemyV2Meta
 * @property {string}   id              基底 ID（与 Enemy.baseArchetype 对齐）
 * @property {string}   resourceId      资源命名（sprite/icon 文件名前缀）
 * @property {string}   name            中文名
 * @property {string}   footprint       占格字符串，例如 "3×1"
 * @property {number}   cols            占列
 * @property {number}   rows            占行
 * @property {string}   baseArchetype   等同 Enemy.baseArchetype 的字符串
 * @property {string[]} affixes         专属词条 ID 列表
 * @property {string}   priority        资源优先级 P0/P1/P2/P3
 * @property {string}   stage           默认出现阶段提示
 * @property {string}   role            战术职责
 * @property {string}   targeting       针对提示
 * @property {string}   spritePath      Sprite Sheet PNG 路径
 * @property {string}   iconPath        UI 图标 PNG 路径
 * @property {number}   hpMult          设计参考 HP 倍率；实战/试炼场以 spawn_system 口径为准
 * @property {boolean}  placeholder     是否仍为占位资源（true=待美术替换）
 */

/** @type {EnemyV2Meta[]} */
export const ENEMY_V2_METADATA = [
    {
        id: 'bastion',
        resourceId: 'enemy_bastion_3x1',
        name: '装甲横梁',
        footprint: '3×1',
        cols: 3, rows: 1,
        baseArchetype: 'bastion',
        affixes: ['heavyArmor'],
        priority: 'P0',
        stage: '中段（第 4 回合起）',
        role: '横向阻挡 / 高生命阵地',
        targeting: '用穿透或激光处理装甲面，避免短弹道反弹堆叠。',
        spritePath: 'assets/sprites/enemies/v2/enemy_bastion_3x1.png',
        iconPath:   'assets/icons/enemies/enemy_bastion_3x1.png',
        hpMult: 2.0,
        placeholder: false,
    },
    {
        id: 'maw',
        resourceId: 'enemy_maw_2x2',
        name: '深渊胃囊',
        footprint: '2×2',
        cols: 2, rows: 2,
        baseArchetype: 'maw',
        affixes: ['devour'],
        priority: 'P0',
        stage: '中段（第 5 回合起）',
        role: '吞噬周围友军继承词条',
        targeting: '优先清场避免吞噬触发；高伤害单点击破。',
        spritePath: 'assets/sprites/enemies/v2/enemy_maw_2x2.png',
        iconPath:   'assets/icons/enemies/enemy_maw_2x2.png',
        hpMult: 2.0,
        placeholder: false,
    },
    {
        id: 'deflector',
        resourceId: 'enemy_deflector_2x1',
        name: '棱盾兽',
        footprint: '2×1',
        cols: 2, rows: 1,
        baseArchetype: 'deflector',
        affixes: ['deflectionWard'],
        priority: 'P1',
        stage: '前中段（第 3 回合起）',
        role: '吸收弹反 / 穿透类伤害',
        targeting: '直击、爆炸或燃烧可以绕过偏折屏障；穿透会被拦下。',
        spritePath: 'assets/sprites/enemies/v2/enemy_deflector_2x1.png',
        iconPath:   'assets/icons/enemies/enemy_deflector_2x1.png',
        hpMult: 1.0,
        placeholder: false,
    },
    {
        id: 'echoSpire',
        resourceId: 'enemy_echo_spire_1x2',
        name: '共振尖塔',
        footprint: '1×2',
        cols: 1, rows: 2,
        baseArchetype: 'echoSpire',
        affixes: ['echoRelay'],
        priority: 'P1',
        stage: '中段（第 4 回合起）',
        role: '为周围敌人转发词条结算',
        targeting: '低血量，优先点掉以瓦解词条联动。',
        spritePath: 'assets/sprites/enemies/v2/enemy_echo_spire_1x2.png',
        iconPath:   'assets/icons/enemies/enemy_echo_spire_1x2.png',
        hpMult: 0.5,
        placeholder: false,
    },
    {
        id: 'prism',
        resourceId: 'enemy_prism_1x3',
        name: '折光棱柱',
        footprint: '1×3',
        cols: 1, rows: 3,
        baseArchetype: 'prism',
        affixes: ['prism'],
        priority: 'P2',
        stage: '中后段（第 6 回合起）',
        role: '激光偏折 / 折射路径制造',
        targeting: '改用动能或元素弹避开折射，或绕侧打。',
        spritePath: 'assets/sprites/enemies/v2/enemy_prism_1x3.png',
        iconPath:   'assets/icons/enemies/enemy_prism_1x3.png',
        hpMult: 1.4,
        placeholder: false,
    },
    {
        id: 'hive',
        resourceId: 'enemy_hive_2x3',
        name: '孵化巢',
        footprint: '2×3',
        cols: 2, rows: 3,
        baseArchetype: 'hive',
        affixes: ['hive'],
        priority: 'P2',
        stage: '中后段（第 6 回合起）',
        role: '周期孵化幼体填场',
        targeting: '尽快单点击破母体；范围伤害清理幼体。',
        spritePath: 'assets/sprites/enemies/v2/enemy_hive_2x3.png',
        iconPath:   'assets/icons/enemies/enemy_hive_2x3.png',
        hpMult: 2.5,
        placeholder: false,
    },
    {
        id: 'siege',
        resourceId: 'enemy_siege_3x2',
        name: '攻城履带',
        footprint: '3×2',
        cols: 3, rows: 2,
        baseArchetype: 'siege',
        affixes: ['siege'],
        priority: 'P3',
        stage: '末段（第 8 回合起）',
        role: '推进型大型敌人，挤压战线',
        targeting: '不可冰冻，需依靠正面输出与位移规避。',
        spritePath: 'assets/sprites/enemies/v2/enemy_siege_3x2.png',
        iconPath:   'assets/icons/enemies/enemy_siege_3x2.png',
        hpMult: 3.5,
        placeholder: false,
    },
    {
        id: 'carrier',
        resourceId: 'enemy_carrier_3x2',
        name: '铸巢母架',
        footprint: '5格冂形（3×2 外框，底部中格空）',
        cols: 3, rows: 2,
        baseArchetype: 'carrier',
        affixes: ['carrier'],
        priority: 'P3',
        stage: '末段（第 9 回合起）',
        role: '第 5 格空舱投放急速跳跃小型敌人',
        targeting: '优先击杀母体；用范围伤害清理投放物，避免拖成突进链。',
        spritePath: 'assets/sprites/enemies/v2/enemy_carrier_3x2.png',
        iconPath:   'assets/icons/enemies/enemy_carrier_3x2.png',
        hpMult: 3.2,
        placeholder: false,
    },
    {
        id: 'gravityCore',
        resourceId: 'enemy_gravity_core_3x3',
        name: '引力炉心',
        footprint: '3×3',
        cols: 3, rows: 3,
        baseArchetype: 'gravityWell',
        affixes: ['gravityWell'],
        priority: 'P3',
        stage: '末段 / Boss 前压力位（第 9 回合起）',
        role: '场控大型敌人，扭曲弹道',
        targeting: '近距离贴脸或使用直线高速弹减少偏折影响。',
        spritePath: 'assets/sprites/enemies/v2/enemy_gravity_core_3x3.png',
        iconPath:   'assets/icons/enemies/enemy_gravity_core_3x3.png',
        hpMult: 6.0,
        placeholder: false,
    },
];

/** baseArchetype → meta 的快速索引 */
export const ENEMY_V2_BY_ARCHETYPE = ENEMY_V2_METADATA.reduce((acc, m) => {
    acc[m.baseArchetype] = m;
    return acc;
}, {});

/** id → meta 的快速索引 */
export const ENEMY_V2_BY_ID = ENEMY_V2_METADATA.reduce((acc, m) => {
    acc[m.id] = m;
    return acc;
}, {});

/**
 * 由 Enemy 实例选择 V2 元数据（兼容 baseArchetype 与 affix 推断）。
 * 若不是 V2 基底返回 null —— 调用方应继续走原有的 normal/elite/boss 流程。
 *
 * @param {object} enemy - 至少包含 baseArchetype/affixes 的对象
 * @returns {EnemyV2Meta|null}
 */
export function selectV2Meta(enemy) {
    if (!enemy) return null;
    if (enemy.baseArchetype && ENEMY_V2_BY_ARCHETYPE[enemy.baseArchetype]) {
        return ENEMY_V2_BY_ARCHETYPE[enemy.baseArchetype];
    }
    // affix 反查（容错：spawn 系统可能仅写 affix）
    const affixes = enemy.affixes || [];
    for (const m of ENEMY_V2_METADATA) {
        if (m.affixes.length && affixes.includes(m.affixes[0])) {
            // 还需 footprint 匹配，避免 1×1 普通敌人误判
            if ((enemy.gridCols || 1) === m.cols && (enemy.gridRows || 1) === m.rows) {
                return m;
            }
        }
    }
    return null;
}
