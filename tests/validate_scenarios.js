/**
 * validate_scenarios.js — TRAINING_SCENARIOS 静态结构校验
 *
 * 无需浏览器，直接在 Node.js 中解析 systems.js 源码，
 * 验证所有场景的必填字段、分类合法性、bulletConfig 完整性。
 *
 * 用法：
 *   node tests/validate_scenarios.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── 读取并提取 TRAINING_SCENARIOS ──────────────────────────────────────────

const systemsPath = path.resolve(__dirname, '../src/systems.js');
const source = fs.readFileSync(systemsPath, 'utf8');

// 提取 TRAINING_SCENARIOS 对象字面量（简单方式：eval 沙盒）
// 注意：需要 mock 掉 Enemy、Vec2 等依赖
let TRAINING_SCENARIOS;
try {
    // 构造最小 mock 环境
    const mockEnv = `
        class Enemy { constructor() {} }
        class Vec2 { constructor(x, y) { this.x = x; this.y = y; } }
        const game = {};
        const eventBus = { emit: () => {} };
        const EVENT_TYPES = {};
        const CONFIG = { gameplay: {}, balance: {} };
    `;
    // 提取 TRAINING_SCENARIOS 定义
    const match = source.match(/const TRAINING_SCENARIOS\s*=\s*(\{[\s\S]*?\n\};)/);
    if (!match) throw new Error('未找到 TRAINING_SCENARIOS 定义');

    // 使用 Function 构造器在隔离作用域中执行
    const fn = new Function('Enemy', 'Vec2', `
        ${mockEnv}
        const TRAINING_SCENARIOS = ${match[1].replace(/\n\};$/, '\n}')};
        return TRAINING_SCENARIOS;
    `);
    TRAINING_SCENARIOS = fn(class Enemy {}, class Vec2 {});
} catch (e) {
    // 降级：使用正则提取 categories 和 scenarios 的 id/categoryId
    console.warn(`[警告] 无法 eval TRAINING_SCENARIOS，使用正则降级解析: ${e.message}`);
    TRAINING_SCENARIOS = extractFallback(source);
}

function extractFallback(src) {
    const categories = [];
    // 提取 categories 数组中的条目
    const catRe = /\{ id: '(\w+)', name: '[^']+' \}/g;
    let m;
    while ((m = catRe.exec(src)) !== null) {
        categories.push({ id: m[1] });
    }

    const scenarios = [];
    // 提取每个场景块：id + categoryId + name + desc
    // 匹配形如：id: 'xxx', categoryId: 'yyy', name: 'zzz', ... desc: 'aaa'
    const blockRe = /id:\s*'([\w_]+)'[\s\S]{1,200}?categoryId:\s*'(\w+)'[\s\S]{1,500}?name:\s*'([^']+)'[\s\S]{1,1000}?desc:\s*'([^']{1,200})/g;
    while ((m = blockRe.exec(src)) !== null) {
        // 过滤掉 runewordId 等非场景 id
        if (m[1].startsWith('runeword_') || m[1].startsWith('skill_')) continue;
        scenarios.push({ id: m[1], categoryId: m[2], name: m[3], desc: m[4] });
    }
    return { categories, scenarios };
}

// ─── 校验逻辑 ────────────────────────────────────────────────────────────────

const REQUIRED_BULLET_KEYS = ['damage', 'bounce', 'pierce', 'scatter', 'multicast',
                               'pyro', 'cryo', 'lightning', 'wind', 'isLaser', 'isMatryoshka', 'type'];

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(message);
        console.log(`  ✗ ${message}`);
    }
}

console.log('═══════════════════════════════════════════════════');
console.log('  TRAINING_SCENARIOS 静态结构校验');
console.log('═══════════════════════════════════════════════════\n');

// 1. 分类校验
console.log('── 分类校验 ──');
const validCategoryIds = (TRAINING_SCENARIOS.categories || []).map(c => c.id);
check(validCategoryIds.includes('enemy'),    '分类 enemy 存在');
check(validCategoryIds.includes('attribute'),'分类 attribute 存在');
check(validCategoryIds.includes('boss'),     '分类 boss 存在');
check(validCategoryIds.includes('runeword'), '分类 runeword 存在');
check(validCategoryIds.includes('relic'),    '分类 relic 存在 ✦ 新增');

// 2. 场景总数
console.log('\n── 场景总数校验 ──');
const scenarios = TRAINING_SCENARIOS.scenarios || [];
check(scenarios.length >= 30, `场景总数 >= 30（实际: ${scenarios.length}）`);

// 3. relic 场景数量
const relicScenarios = scenarios.filter(s => s.categoryId === 'relic');
check(relicScenarios.length >= 8, `relic 场景数量 >= 8（实际: ${relicScenarios.length}）`);

// 4. 每个场景的必填字段
console.log('\n── 场景字段校验 ──');
const requiredRelicIds = [
    'relic_pity_essence',
    'relic_selection_ui',
    'relic_chaos_essence',
    'relic_pure_essence',
    'relic_pure_essence_skip_grind',
    'relic_surge_bounce',
    'relic_board_exclusion',
    'relic_save_restore'
];

requiredRelicIds.forEach(id => {
    const sc = scenarios.find(s => s.id === id);
    check(!!sc, `场景 ${id} 存在`);
    if (sc) {
        check(sc.categoryId === 'relic', `${id}.categoryId === 'relic'`);
        if (sc.bulletConfig) {
            const missingKeys = REQUIRED_BULLET_KEYS.filter(k => !(k in sc.bulletConfig));
            check(missingKeys.length === 0, `${id}.bulletConfig 包含所有必填键（缺少: ${missingKeys.join(', ')}）`);
        }
        check(typeof sc.name === 'string' && sc.name.length > 0, `${id}.name 非空`);
        check(typeof sc.desc === 'string' && sc.desc.length > 0, `${id}.desc 非空`);
    }
});

const requiredBossIds = [
    'boss_ignis',
    'boss_glacies',
    'boss_mikro',
    'boss_devourer',
    'boss_viridis',
    'boss_tesla',
    'boss_chimera',
    'boss_ouroboros',
    'boss_vulnerability_break'
];

requiredBossIds.forEach(id => {
    const sc = scenarios.find(s => s.id === id);
    check(!!sc, `Boss 场景 ${id} 存在`);
    if (sc) {
        check(sc.categoryId === 'boss', `${id}.categoryId === 'boss'`);
        if (sc.bulletConfig) {
            const missingKeys = REQUIRED_BULLET_KEYS.filter(k => !(k in sc.bulletConfig));
            check(missingKeys.length === 0, `${id}.bulletConfig 包含所有必填键（缺少: ${missingKeys.join(', ')}）`);
        }
        check(typeof sc.name === 'string' && sc.name.length > 0, `${id}.name 非空`);
        check(typeof sc.desc === 'string' && sc.desc.length > 0, `${id}.desc 非空`);
    }
});

// 5. 所有场景的 categoryId 合法性
console.log('\n── 分类合法性校验 ──');
const invalidCat = scenarios.filter(s => !validCategoryIds.includes(s.categoryId));
check(invalidCat.length === 0,
    `所有场景的 categoryId 合法（非法场景: ${invalidCat.map(s => s.id).join(', ')}）`);

// 6. 场景 ID 唯一性
console.log('\n── ID 唯一性校验 ──');
const idSet = new Set();
const dupIds = [];
scenarios.forEach(s => {
    if (idSet.has(s.id)) dupIds.push(s.id);
    idSet.add(s.id);
});
check(dupIds.length === 0, `场景 ID 无重复（重复: ${dupIds.join(', ')}）`);

// ─── 报告 ─────────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log('\n═══════════════════════════════════════════════════');
console.log(`  校验结果: ${passed}/${total} 通过`);
if (failures.length > 0) {
    console.log('\n  失败项目:');
    failures.forEach(f => console.log(`    ✗ ${f}`));
}
console.log('═══════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
