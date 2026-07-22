import assert from 'node:assert/strict';
import fs from 'node:fs';

let passed = 0;
let failed = 0;

function check(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${message}`);
        return;
    }
    failed++;
    console.error(`  ✗ ${message}`);
}

const elements = new Map();
globalThis.document = {
    getElementById(id) { return elements.get(id) || null; },
    querySelector() { return { dataset: { entryId: 'truth_core_alchemy_table' } }; },
    querySelectorAll() { return []; },
    createElement() {
        return {
            className: '',
            classList: { add() {}, remove() {} },
            dataset: {},
            style: {},
            append() {},
            appendChild() {},
            replaceWith() {},
        };
    },
    createTextNode(text) { return { textContent: text }; },
};
globalThis.window = {
    addEventListener() {},
    matchMedia() { return { matches: false }; },
};

const { TruthBook, TRUTH_BOOK_DATA, UI_TERMINOLOGY } = await import('../src/systems.js');

console.log('\n── 玩家可见术语映射 ──');
assert.ok(Object.isFrozen(UI_TERMINOLOGY), '术语映射必须冻结，避免运行时漂移');
check(UI_TERMINOLOGY.alchemyTable === '炼金台', '页面名称统一为“炼金台”');
check(UI_TERMINOLOGY.runeConfiguration === '符文配置', '3×3 页签统一为“符文配置”');
check(UI_TERMINOLOGY.combatRuneLauncher === '符文发射器', '战斗装置保留“符文发射器”');
check(UI_TERMINOLOGY.runeWarehouse === '符文仓库', '持久符文集合统一为“符文仓库”');
check(UI_TERMINOLOGY.runFragments === '局内碎片（仅本局）', '局内货币明确生命周期');
check(UI_TERMINOLOGY.metaRuneFragments === '局外符文碎片（跨局保留）', '持久货币明确跨局保留');
check(TRUTH_BOOK_DATA.terminology === UI_TERMINOLOGY, 'Truth Book 暴露同一术语对象，不维护副本');

console.log('\n── Truth Book 主解释入口 ──');
const guide = TRUTH_BOOK_DATA.entries.find(entry => entry.id === 'truth_core_alchemy_table');
check(Boolean(guide), '核心机制分类包含炼金台主解释条目');
check(guide?.title === '炼金台与符文配置', '主解释标题使用页面与页签的规范名称');
check(guide?.action?.id === 'open_alchemy_table' && guide.action.label === '打开炼金台', '主解释条目声明可执行的炼金台跳转');
for (const term of Object.values(UI_TERMINOLOGY)) {
    check(guide?.content.includes(term), `主解释正文覆盖“${term}”`);
}

console.log('\n── 炼金台 → Truth Book 跳转 ──');
const events = [];
const fateMomentContext = { source: 'test' };
const game = {
    phase: 'combat',
    selectionMode: 'marble_pack',
    fateMomentContext,
    ui_closeRuneLauncher(options) {
        events.push({ type: 'close-table', options });
        return true;
    },
    ui_openTruthBook(options) {
        events.push({ type: 'open-book', options });
    },
    ui_closeTruthBook() {
        events.push({ type: 'close-book' });
    },
    ui_openRuneLauncher() {
        events.push({ type: 'open-table' });
    },
};
const book = new TruthBook(game);
let selectedEntry = null;
book.renderCategoryTabs = () => {};
book.renderEntryList = () => {};
book.showEntry = entry => { selectedEntry = entry; };

check(book.openEntryFromAlchemyTable() === true, '从炼金台打开主解释入口成功');
check(events[0]?.type === 'close-table' && events[1]?.type === 'open-book', '先关闭炼金台，再打开 Truth Book');
check(events[0]?.options?.restoreFocus === false, '跨页面跳转不把焦点恢复到即将隐藏的炼金台入口');
check(events[1]?.options?.returnState?.phase === 'combat', '跳转保留来源阶段');
check(events[1]?.options?.returnState?.fateMomentContext !== fateMomentContext, '跳转复制命运上下文，避免共享可变引用');
check(selectedEntry?.id === 'truth_core_alchemy_table', '打开后按稳定 ID 选择主解释条目');

events.length = 0;
selectedEntry = null;
game.ui_closeRuneLauncher = () => false;
check(book.openEntryFromAlchemyTable() === false, '炼金中断被用户取消时放弃跨页面跳转');
check(events.length === 0 && selectedEntry === null, '取消关闭后不打开 Truth Book、不改变条目');

console.log('\n── Truth Book → 炼金台跳转 ──');
game.ui_closeRuneLauncher = () => true;
check(book.openAlchemyTableFromTruthBook() === true, '从主解释入口打开炼金台成功');
check(events.at(-2)?.type === 'close-book' && events.at(-1)?.type === 'open-table', '先恢复 Truth Book 来源阶段，再打开炼金台');

console.log('\n── 数据驱动操作渲染 ──');
const actionButton = { hidden: true, style: {}, textContent: '', onclick: null };
elements.set('truth-entry-action', actionButton);
book.startDemo = () => {};
book.openAlchemyTableFromTruthBook = () => { events.push({ type: 'action-open-table' }); return true; };
TruthBook.prototype.showEntry.call(book, guide, null);
check(actionButton.hidden === false && actionButton.style.display === 'inline-flex', '主解释条目显示数据驱动操作按钮');
check(actionButton.textContent === '打开炼金台' && typeof actionButton.onclick === 'function', '操作按钮采用条目声明的文案与处理器');
actionButton.onclick();
check(events.at(-1)?.type === 'action-open-table', '操作按钮调用安全跳转方法');
TruthBook.prototype.showEntry.call(book, TRUTH_BOOK_DATA.entries.find(entry => entry.id !== guide.id), null);
check(actionButton.hidden === true && actionButton.onclick === null, '普通条目隐藏并解绑炼金台操作');

console.log('\n── 页面可见文案与双向入口 ──');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const launcherStart = indexHtml.indexOf('id="phase-rune-launcher"');
const launcherEnd = indexHtml.indexOf('id="rune-picker-overlay"', launcherStart);
const launcherMarkup = indexHtml.slice(launcherStart, launcherEnd);
check(launcherMarkup.includes('⚡ 符文配置') && launcherMarkup.includes('⚗️ 仓库管理'), '炼金台页签使用符文配置与仓库管理');
check((launcherMarkup.match(/符文仓库/g) || []).length >= 3, '同一持久 runeInventory 在配置、管理和药剂页统一称为符文仓库');
check(!/(符文庫存|符文倉庫|圖鑑|點擊|暫無)/.test(launcherMarkup), '炼金台可见文案不残留繁体或库存/仓库混称');
check(indexHtml.includes('id="alchemy-truth-entry-link"')
    && indexHtml.includes('game.truthBook.openEntryFromAlchemyTable()'),
'炼金台图鉴提供主解释入口');
check(indexHtml.includes('id="truth-entry-action"'), 'Truth Book 提供数据驱动的反向炼金台入口');
check(indexHtml.includes('局外符文碎片</span>')
    && (indexHtml.match(/title="炼金台"/g) || []).length >= 1,
'局外货币与炼金台入口使用规范名称');

console.log(`\n术语与知识入口契约：${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
