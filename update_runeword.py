import re

def update_rune_config():
    with open('src/rune_config.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 替换 RUNEWORD_DB
    old_runeword_db_start = content.find('const RUNEWORD_DB = [')
    old_runeword_db_end = content.find('];', old_runeword_db_start) + 2
    
    new_runeword_db = """const RUNEWORD_DB = [
    // ---- 元素专属词条 (7个) ----
    {
        id: 'runeword_meltdown',
        name: '熔毁',
        effectId: 'meltdown',
        pattern: ['rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1'],
        effect_desc: '【火焰系】火焰燃烧伤害与过热爆炸的最终伤害提升。',
        baseParams: { damageBonus: 0.50 },
        perLevelParams: { damageBonus: 0.25 }
    },
    {
        id: 'runeword_absolute_zero',
        name: '绝对零度',
        effectId: 'absolute_zero',
        pattern: ['rune_cryo_1', 'rune_cryo_2', 'rune_cryo_1'],
        effect_desc: '【冰霜系】敌人处于冰冻状态时，每次受到物理伤害，都会令该敌人本回合受到的所有伤害加深。',
        baseParams: { damageAmp: 0.01 },
        perLevelParams: { damageAmp: 0.005 }
    },
    {
        id: 'runeword_frost_nova',
        name: '冰霜新星',
        effectId: 'frost_nova',
        pattern: ['rune_cryo_1', 'rune_bounce_1', 'rune_cryo_2'],
        effect_desc: '【冰霜系】弹珠每弹跳数次，释放一次冰霜新星，造成冰属性伤害并降温。',
        baseParams: { requiredBounces: 5, radius: 80, tempDrop: 10, damageRatio: 0.30 },
        perLevelParams: { requiredBounces: -1, radius: 0, tempDrop: 0, damageRatio: 0.10 }
    },
    {
        id: 'runeword_thunderstorm',
        name: '雷暴之语',
        effectId: 'thunderstorm',
        pattern: ['rune_lightning_1', 'rune_lightning_2', 'rune_lightning_1'],
        effect_desc: '【闪电系】闪电链的伤害衰减系数提升。',
        baseParams: { decayBonus: 0.50 },
        perLevelParams: { decayBonus: 0.10 }
    },
    {
        id: 'runeword_thunder_scatter',
        name: '雷霆散射',
        effectId: 'thunder_scatter',
        pattern: ['rune_lightning_1', 'rune_scatter_1', 'rune_lightning_2'],
        effect_desc: '【闪电系】每次成功触发闪电链时，有概率额外释放一条同属性闪电链。',
        baseParams: { extraChains: 1 },
        perLevelParams: { extraChains: 1 }
    },
    {
        id: 'runeword_kinetic_surge',
        name: '动能激增',
        effectId: 'kinetic_surge',
        pattern: ['rune_bounce_1', 'rune_bounce_2', 'rune_bounce_1'],
        effect_desc: '【弹射系】本次发射的弹珠，后续的每一次弹射伤害固定增加。',
        baseParams: { flatDamage: 1 },
        perLevelParams: { flatDamage: 1 }
    },
    {
        id: 'runeword_irradiation',
        name: '照射',
        effectId: 'irradiation',
        pattern: ['rune_laser_1', 'rune_laser_2', 'rune_laser_1'],
        effect_desc: '【激光系】激光变为持续照射。累积照射同一个敌人，受到的伤害加深。',
        baseParams: { damageAmp: 0.15 },
        perLevelParams: { damageAmp: 0.05 }
    },

    // ---- 复合机制词条 (6个) ----
    {
        id: 'runeword_flame_sword',
        name: '炎光剑影',
        effectId: 'flame_sword',
        pattern: ['rune_pyro_1', 'rune_pierce_1', 'rune_pyro_2'],
        effect_desc: '【穿透系】穿透敌人时，有概率召唤一道火焰剑光。',
        baseParams: { triggerChance: 0.30, damageRatio: 0.60, tempDamageRatio: 0.10 },
        perLevelParams: { triggerChance: 0.10, damageRatio: 0, tempDamageRatio: 0.05 }
    },
    {
        id: 'runeword_armor_piercing_meteor',
        name: '穿甲流星',
        effectId: 'armor_piercing_meteor',
        pattern: ['rune_pierce_2', 'rune_scatter_1', 'rune_pierce_1'],
        effect_desc: '【穿透系】散射出的子弹丸继承 100% 的穿透层数。',
        baseParams: { damageBonus: 0 },
        perLevelParams: { damageBonus: 0.15 }
    },
    {
        id: 'runeword_blazing_beam',
        name: '炽热光线',
        effectId: 'blazing_beam',
        pattern: ['rune_pyro_1', 'rune_laser_1', 'rune_laser_2'],
        effect_desc: '【复合系】激光照射敌人时，除了造成伤害，每 0.5 秒还会额外提升敌人温度。',
        baseParams: { tempIncrease: 5 },
        perLevelParams: { tempIncrease: 2 }
    },
    {
        id: 'runeword_lightning_shield',
        name: '雷电护盾',
        effectId: 'lightning_shield',
        pattern: ['rune_lightning_2', 'rune_bounce_2', 'rune_bounce_1'],
        effect_desc: '【复合系】弹珠弹射时有概率在自身周围生成静电场。',
        baseParams: { triggerChance: 0.15, damageRatio: 0.20, shockStacks: 1 },
        perLevelParams: { triggerChance: 0.05, damageRatio: 0.10, shockStacks: 0 }
    },
    {
        id: 'runeword_blade_storm',
        name: '剑刃风暴',
        effectId: 'blade_storm',
        pattern: ['rune_pierce_1', 'rune_pierce_2', 'rune_scatter_1'],
        effect_desc: '【复合系】首个子弹定期对范围内所有敌人生成一次剑光斩击。',
        baseParams: { radius: 120, damageRatio: 0.60, interval: 0.5 },
        perLevelParams: { radius: 0, damageRatio: 0.20, interval: -0.1 }
    },
    {
        id: 'runeword_elemental_fusion',
        name: '元素聚变',
        effectId: 'elemental_fusion',
        pattern: ['rune_pyro_2', 'rune_cryo_2', 'rune_lightning_2'],
        effect_desc: '【复合系】当敌人同时承受火、冰、雷三种状态时，引发元素聚变爆炸。',
        baseParams: { trueDamageRatio: 0.10 },
        perLevelParams: { trueDamageRatio: 0.05 }
    }
];"""
    
    content = content[:old_runeword_db_start] + new_runeword_db + content[old_runeword_db_end:]
    
    with open('src/rune_config.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("rune_config.js 更新完成")

def update_rune_system():
    with open('src/rune_system.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 替换 parseRuneGrid 函数
    # 定位函数开始和结束
    func_start = content.find('function parseRuneGrid(grid, runewordDb) {')
    func_end = content.find('    return { activeStats, activatedRunewords, activatedCells };\n}') + len('    return { activeStats, activatedRunewords, activatedCells };\n}')
    
    new_func = """function parseRuneGrid(grid, runewordDb) {
    // 将网格条目统一转换为符文 ID 数组（兼容新旧格式）
    const idGrid = grid.map(entry => getRuneId(entry));

    // 定义 3x3 网格的所有路径（行、列、对角线）
    // 每条路径是格子索引的数组
    const PATHS = [
        // 3 行
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        // 3 列
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        // 2 条对角线
        [0, 4, 8], // 主对角线（左上到右下）
        [2, 4, 6], // 副对角线（右上到左下）
    ];

    // 提取每条路径上的符文 id 序列（过滤 null）
    const pathSequences = PATHS.map(path => ({
        indices: path,
        runes: path.map(i => idGrid[i]).filter(r => r !== null && r !== undefined),
    }));

    const activatedRunewords = [];
    const activatedCells = new Set();
    const activeStats = {};

    // 遍历每个词条，检查是否有路径匹配
    for (const runeword of runewordDb) {
        const pattern = runeword.pattern;
        if (!pattern || pattern.length === 0) continue;

        let matchCount = 0;
        let localMatchedCells = new Set();

        // 检查每条路径
        for (const { indices, runes } of pathSequences) {
            if (runes.length < pattern.length) continue;

            // 在路径的符文序列中查找正向或反向匹配
            const matched = findPatternInSequence(runes, pattern, indices, idGrid);
            if (matched) {
                matchCount++;
                matched.forEach(idx => localMatchedCells.add(idx));
            }
        }

        if (matchCount > 0) {
            // 复制 runeword 对象，并注入 level 字段
            const activatedRuneword = { ...runeword, level: matchCount };
            activatedRunewords.push(activatedRuneword);
            
            // 记录参与激活的格子索引
            localMatchedCells.forEach(idx => activatedCells.add(idx));
            
            // 合并 stats (如果新词条还有 stats 的话，兼容处理)
            if (runeword.stats) {
                for (const [key, val] of Object.entries(runeword.stats)) {
                    activeStats[key] = (activeStats[key] || 0) + (val * matchCount);
                }
            }
        }
    }

    return { activeStats, activatedRunewords, activatedCells };
}"""
    
    content = content[:func_start] + new_func + content[func_end:]
    
    with open('src/rune_system.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("rune_system.js 更新完成")

if __name__ == '__main__':
    update_rune_config()
    update_rune_system()
