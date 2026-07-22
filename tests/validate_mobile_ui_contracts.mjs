import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const indexHtml = read('index.html');
const bitmapCss = read('src/styles/bitmap_ui.css');
const systemsJs = read('src/systems.js');
const hudJs = read('src/ui/hud.js');
const uiSystemJs = read('src/ui_system.js');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
    if (condition) {
        passed += 1;
        console.log(`PASS ${label}`);
        return;
    }
    failed += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function containsAll(source, tokens) {
    return tokens.every(token => source.includes(token));
}

function extractBalancedBlock(source, marker, fromIndex = 0) {
    const markerIndex = source.indexOf(marker, fromIndex);
    if (markerIndex < 0) return '';
    const openIndex = source.indexOf('{', markerIndex);
    if (openIndex < 0) return '';
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(markerIndex, index + 1);
        }
    }
    return '';
}

function extractLastBalancedBlock(source, marker) {
    const markerIndex = source.lastIndexOf(marker);
    return markerIndex < 0 ? '' : extractBalancedBlock(source, marker, markerIndex);
}

const truthMobileCss = extractBalancedBlock(bitmapCss, '@media (max-width: 720px)');
const shopMobileCss = extractBalancedBlock(
    bitmapCss,
    '@media (max-width: 1024px)',
    bitmapCss.indexOf('§1.4 商店页')
);
const trainingClassIndex = systemsJs.indexOf('class TrainingGround');
const trainingMobileCss = extractBalancedBlock(systemsJs, '@media (max-width: 1024px)', trainingClassIndex);
const dockMobileCss = extractBalancedBlock(bitmapCss, '@media (max-width: 1024px)', bitmapCss.indexOf('combat console Pass12'));
const directSkillBlock = extractBalancedBlock(systemsJs, 'visibleSkills.forEach(skill =>');
const reducedMotionCss = extractBalancedBlock(bitmapCss, '@media (prefers-reduced-motion: reduce)');
const finalAmmoNameCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-name {');
const finalAmmoDamageCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-damage {');
const finalAmmoAttributeValueCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-attribute-chip .attribute-chip-value {');
const finalAmmoAttributeMoreCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-attribute-chip.is-more .attribute-chip-value {');
const finalQueueLabelCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-queue-chip::after {');
const finalQueueDamageCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-queue-chip b {');
const finalQueueAttributeValueCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-queue-attr-value {');
const finalQueueEmptyCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .combat-ammo-queue-empty {');
const finalSkillCostCss = extractLastBalancedBlock(bitmapCss, '#combat-bottom-dock .skill-cost-badge {');

console.log('\n[Pause dialog and touch policy]');
check('body no longer blocks every touch gesture', /body\s*\{[\s\S]*?touch-action:\s*manipulation;[\s\S]*?\}/.test(indexHtml));
check('combat canvas still owns raw gestures', /#gameCanvas\s*\{[\s\S]*?touch-action:\s*none;[\s\S]*?\}/.test(indexHtml));
check('pause is a labelled modal dialog', containsAll(indexHtml, [
    'id="phase-pause"', 'role="dialog"', 'aria-modal="true"', 'aria-labelledby="pause-title"'
]));
check('pause has stable real-coordinate targets', containsAll(indexHtml, [
    'id="pause-abandon-button"', 'id="pause-resume-button"', 'id="pause-scroll-region"'
]));
check('pause root is bounded and its child owns pan-y scrolling', /#phase-pause\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?touch-action:\s*pan-y;[\s\S]*?\}/.test(bitmapCss)
    && /#phase-pause \.pause-dialog-scroll\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?touch-action:\s*pan-y;[\s\S]*?\}/.test(bitmapCss));
check('pause primary controls meet 44px contract', /#phase-pause \.pause-close-button,[\s\S]*?min-height:\s*44px;/.test(bitmapCss));
check('pause entry is labelled and has a 44px target', containsAll(indexHtml, [
    'id="settings-btn"', 'aria-label="打开暂停菜单"', 'aria-haspopup="dialog"'
]) && /#settings-btn\s*\{[\s\S]*?width:\s*44px !important;[\s\S]*?min-height:\s*44px !important;/.test(bitmapCss));

console.log('\n[Shop mobile list ownership]');
check('shop shell and list have stable accessibility hooks', containsAll(indexHtml, [
    'class="shop-layout-shell', 'class="shop-topbar', 'class="shop-back-button',
    'id="shop-items-container" role="region" aria-label="商品列表" tabindex="0"'
]));
check('shop mobile shell is bounded without global clipping', /#phase-shop\s*\{[\s\S]*?overflow:\s*hidden;/.test(shopMobileCss)
    && /#phase-shop \.shop-layout-shell\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/.test(shopMobileCss));
check('shop list is the stable pan-y owner', /#phase-shop #shop-items-container\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;[\s\S]*?touch-action:\s*pan-y;/.test(shopMobileCss));
check('shop preview relinquishes nested mobile scrolling', /#phase-shop #shop-upgrade-preview\s*\{[\s\S]*?overflow:\s*visible;/.test(shopMobileCss));
check('shop back and category targets meet 44px contract', /#phase-shop \.shop-back-button\s*\{[\s\S]*?min-height:\s*44px;/.test(shopMobileCss)
    && /#phase-shop #shop-category-tabs > button\s*\{[\s\S]*?min-height:\s*44px;/.test(shopMobileCss));
check('shop purchase targets meet the mobile 44px contract', /#phase-shop \.shop-upgrade-card button\s*\{[\s\S]*?min-height:\s*44px;/.test(shopMobileCss));

console.log('\n[Truth Book one-axis layout and copy]');
check('Truth Book is a labelled modal dialog', containsAll(indexHtml, [
    'id="phase-truth-book"', 'aria-labelledby="truth-book-title"', 'aria-label="关闭真理之书"'
]));
check('mobile Truth Book has a vertical root scroller', truthMobileCss.includes('overflow-y: auto;')
    && truthMobileCss.includes('touch-action: pan-y;'));
check('mobile categories wrap into bounded columns', truthMobileCss.includes('repeat(2, minmax(0, 1fr))'));
check('mobile Truth Book removes nested horizontal scrollers', !truthMobileCss.includes('overflow-x: auto')
    && !truthMobileCss.includes('repeat(5, minmax(118px, 1fr))'));
check('mobile entry lists are vertical and width-bounded', /#truth-entry-list\s*\{[\s\S]*?flex-direction:\s*column !important;[\s\S]*?min-width:\s*0;/.test(truthMobileCss));
check('mobile detail navigation scrolls only the Truth Book root', containsAll(systemsJs, [
    "const truthRoot = document.getElementById('phase-truth-book');",
    'truthRoot.scrollTop += detailRect.top - rootRect.top;'
]) && !systemsJs.includes("document.getElementById('truth-detail-panel')?.scrollIntoView"));
check('Truth Book reopen resets root scroll and stale detail state', containsAll(systemsJs, [
    "if (truthRoot) truthRoot.scrollTop = 0;",
    "document.getElementById('truth-empty-state')?.classList.remove('hidden');",
    "document.getElementById('truth-content')?.classList.add('hidden');"
]));
check('Truth Book header stays reachable and search is 44px', /#phase-truth-book > \.flex\.flex-col\s*\{[\s\S]*?flex:\s*0 0 auto;/.test(truthMobileCss)
    && /#phase-truth-book > \.flex\.flex-col > \.flex\.justify-between\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/.test(truthMobileCss)
    && /#phase-truth-book \.truth-search\s*\{[\s\S]*?min-height:\s*44px;/.test(bitmapCss));
check('Truth Book copy matches runtime relic-only 2–4 contract', containsAll(systemsJs, [
    "title: '遗物线索保底'", "tags: ['动态 2–4 行'", '不再新增混沌或纯净精华'
]));
check('stale 5/13 pity copy is removed from active Truth Book data', !systemsJs.includes("tags: ['精华 5 行', '遗物 13 行'"));

console.log('\n[Training Ground responsive ownership]');
check('training overlay is mounted to game-container, not body', systemsJs.includes('gameContainer.appendChild(ui);')
    && !systemsJs.includes('document.body.appendChild(ui);'));
check('desktop training mounts exist in outer sidebars', containsAll(indexHtml, [
    'id="pc-left-training-controls-mount"', 'id="pc-right-training-scenes-mount"'
]));
check('desktop training control mount stacks narrow content without overlap', containsAll(systemsJs, [
    '#pc-left-training-controls-mount #panel-bullet > .flex',
    '#pc-left-training-controls-mount #train-attr-grid',
    'grid-template-columns: repeat(2, minmax(0, 1fr));'
]));
check('training keeps stable homes for reversible mounts', containsAll(systemsJs, [
    'id="train-control-home"', 'id="train-sidebar-home"', 'id="train-combat-status-mount"'
]));
check('training sidebar home extends the mobile sticky-header range', /<span id="train-sidebar-home" hidden aria-hidden="true"><\/span>\s*<\/div>\s*`;/s.test(systemsJs));
check('training status uses the unique shared status node', containsAll(systemsJs, [
    "_moveTrainingNode('combat-status-panel', 'train-combat-status-mount')",
    "_restoreTrainingNode('combat-status-panel', 'combat-status-home')"
]));
check('training resize lifecycle is named, bound, and unbound', containsAll(systemsJs, [
    '_bindTrainingLayoutResize()', '_unbindTrainingLayoutResize()',
    "window.addEventListener('resize', this._trainingLayoutResizeHandler)",
    "window.removeEventListener('resize', this._trainingLayoutResizeHandler)"
]));
check('non-PC training has one pan-y root owner', trainingMobileCss.includes('#phase-training')
    && trainingMobileCss.includes('overflow-y: auto;')
    && trainingMobileCss.includes('touch-action: pan-y;'));
check('training injected stylesheet keeps its column declaration parseable',
    /#train-control-panel\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/.test(systemsJs)
    && !systemsJs.includes('// @section:ui_hud_components'));
check('long training UI builder exposes valid JavaScript section markers', containsAll(systemsJs, [
    '// @section:training_responsive_styles - 训练场响应式布局样式',
    '// @section:training_accessible_markup - 训练场可达控制结构'
]));
check('mobile training keeps the exit bar sticky above scrolling controls',
    /\.train-top-bar\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?z-index:\s*520;[\s\S]*?flex:\s*0 0 44px;[\s\S]*?min-height:\s*44px;/.test(trainingMobileCss));
check('training exit target is not pulled outside its 44px bar',
    !systemsJs.includes('min-h-11 -my-1 flex items-center'));
check('training battlefield offset tracks the 40/44px responsive bar',
    systemsJs.includes('const trainTopBarHeight = isDesktop ? 40 : 44;')
    && systemsJs.includes('this.game.combatGridTopY = trainTopBarHeight + 8 + this.game.enemyHeight / 2;'));
check('nested training lists relinquish mobile y-scroll', /\.train-scenario-list,[\s\S]*?overflow:\s*visible;/.test(trainingMobileCss)
    && /\.train-panel-content\s*\{[\s\S]*?overflow:\s*visible;/.test(trainingMobileCss)
    && /\.train-skill-grid\s*\{[\s\S]*?overflow:\s*visible;/.test(trainingMobileCss));
check('training exit restores mounts and layout state', containsAll(systemsJs, [
    'this._restoreTrainingResponsiveLayout();', 'this._restoreTrainingCombatStatus();',
    'this._restoreTrainingLayoutState();'
]));

console.log('\n[Combat status, dock, and disabled reasons]');
check('phase logic still scopes status to combat/training', /this\.phase !== 'combat' && this\.phase !== 'training'/.test(uiSystemJs));
check('bitmap CSS no longer force-hides combat status', !/#unified-top-bar\.is-combat #combat-status-panel[\s\S]{0,120}display:\s*none\s*!important/.test(bitmapCss));
check('only one combat-status-panel is declared', (indexHtml.match(/id="combat-status-panel"/g) || []).length === 1);
check('mobile dock uses the 120px battlefield budget', dockMobileCss.includes('--combat-console-height: 120px !important;'));
check('mobile dock cancels the scaled ammo overhang', /\.combat-ammo-pane\s*\{[\s\S]*?transform:\s*none !important;/.test(dockMobileCss));
check('mobile skill and action targets are 44px', (dockMobileCss.match(/44px !important/g) || []).length >= 8);
check('skill buttons synchronize native and ARIA disabled state', systemsJs.includes("btn.setAttribute('aria-disabled', String(isDisabled));"));
check('direct skills mirror combat phase and turn rejection reasons', containsAll(directSkillBlock, [
    "if (currentSP < cost) disabledReason = 'SP不足';",
    "else if (!game || game.phase !== 'combat') disabledReason = '仅战斗可用';",
    "else if (game.isEnemyTurn) disabledReason = '敌方行动中';",
    "const isDisabled = disabledReason !== '';"
]));
check('skill availability follows real enemy-turn edges without changing turn flow', containsAll(systemsJs, [
    '_skillBarTurnWatchFrame', '_skillBarEnemyTurnSnapshot',
    '_stopSkillBarTurnWatch()', '_syncSkillBarTurnWatch()',
    'window.requestAnimationFrame(watchEnemyTurn)',
    'this.updateSkillBar(liveGame.skillPoints ?? 0, liveGame.activeSkills || [])'
]));
check('skill turn watcher is singleton and stops outside combat', containsAll(systemsJs, [
    'if (this._skillBarTurnWatchFrame) return;',
    "|| mainGame.phase !== 'combat'",
    "|| liveGame.phase !== 'combat'",
    'window.cancelAnimationFrame(this._skillBarTurnWatchFrame)'
]));
check('all expected disabled reasons are visible data', containsAll(systemsJs, [
    "SP不足", "disabledReason = '空槽'", "disabledReason = '空瓶'",
    "disabledReason = '仅战斗可用'", "disabledReason = '敌方行动中'"
]));
check('bitmap CSS exposes, rather than hides, disabled reason', /#combat-bottom-dock \.skill-button:disabled \.skill-disabled-reason\s*\{[\s\S]*?display:\s*block;/.test(bitmapCss)
    && !/#combat-bottom-dock \.skill-disabled-reason\s*\{[\s\S]*?display:\s*none\s*!important/.test(bitmapCss));
check('dock labels and disabled reasons meet the 10px readability floor',
    /#combat-bottom-dock \.skill-button:disabled \.skill-disabled-reason\s*\{[\s\S]*?font-size:\s*10px;/.test(bitmapCss)
    && /#combat-bottom-dock \.combat-ammo-label\s*\{[\s\S]*?font-size:\s*clamp\(10px, 2\.5vw, 11px\) !important;/.test(bitmapCss));
check('runtime ammo name, damage, attributes, and queue copy meet the final 10px floor',
    finalAmmoNameCss.includes('font-size: clamp(10px, 2vw, 11px) !important;')
    && finalAmmoDamageCss.includes('font-size: 10px !important;')
    && finalAmmoAttributeValueCss.includes('font-size: 10px !important;')
    && finalAmmoAttributeMoreCss.includes('font-size: 10px !important;')
    && finalQueueLabelCss.includes('font-size: 10px !important;')
    && finalQueueDamageCss.includes('font-size: 10px !important;')
    && finalQueueAttributeValueCss.includes('font: 900 10px/10px Cinzel, serif !important;')
    && finalQueueEmptyCss.includes('font: 900 10px/1 Cinzel, serif !important;')
    && finalSkillCostCss.includes('font-size: 10px !important;'));
check('runtime HUD creates every readability-tested ammo node', containsAll(hudJs, [
    "name.className = 'combat-ammo-name';",
    "damage.className = 'combat-ammo-damage';",
    "attributeRow.className = 'combat-ammo-attribute-row';",
    "chip.className = 'combat-ammo-queue-chip';",
    "count.className = 'combat-ammo-queue-attr-value';"
]));
check('mobile queue summarizes attributes instead of crushing four badges', containsAll(hudJs, [
    "window.matchMedia?.('(max-width: 1024px)').matches",
    ') ? 2 : 4;',
    '_buildCombatQueueAttributeIcons(profile, maxQueueAttributeIcons)'
]));
check('secondary combat controls and status copy meet mobile baselines', /\.skill-editor-open-btn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-height:\s*44px;/.test(bitmapCss)
    && /\.skill-editor-close-btn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-height:\s*44px;/.test(bitmapCss)
    && /\.run-shop-status-dock\.is-combat-top #run-shop-status-open\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?font-size:\s*10px;/.test(bitmapCss)
    && /@media \(max-width: 720px\)[\s\S]*?\.combat-status-main\s*\{[\s\S]*?font-size:\s*10px;/.test(indexHtml));

console.log('\n[Motion and red lines]');
check('scoped reduced-motion rules exist for core UI including shop', reducedMotionCss.includes('#phase-pause *')
    && reducedMotionCss.includes('#phase-shop *')
    && reducedMotionCss.includes('#phase-truth-book *')
    && systemsJs.includes('@media (prefers-reduced-motion: reduce)'));
check('no global important overflow clipping was introduced', !/(?:html|body|\*)\s*\{[^}]*overflow\s*:\s*hidden\s*!important/si.test(indexHtml + bitmapCss));
check('component overrides stay bounded', !/^\s*\*\s*\{[^}]*!important/ms.test(bitmapCss));

console.log(`\nMobile UI contracts: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
