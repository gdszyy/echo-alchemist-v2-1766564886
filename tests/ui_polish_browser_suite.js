'use strict';

const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
    { label: 'mobile-360x800', width: 360, height: 800 },
    { label: 'mobile-390x844', width: 390, height: 844 },
    { label: 'mobile-480x854', width: 480, height: 854 },
    { label: 'desktop-1440x900', width: 1440, height: 900 },
];

async function collectMetrics(page, ids) {
    return page.evaluate(targetIds => {
        const readNode = id => {
            const node = document.getElementById(id);
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return {
                display: style.display,
                visibility: style.visibility,
                role: node.getAttribute('role'),
                ariaModal: node.getAttribute('aria-modal'),
                ariaHidden: node.getAttribute('aria-hidden'),
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                scrollWidth: node.scrollWidth,
                scrollHeight: node.scrollHeight,
                clientWidth: node.clientWidth,
                clientHeight: node.clientHeight,
                scrollTop: node.scrollTop,
                maxScrollTop: Math.max(0, node.scrollHeight - node.clientHeight),
            };
        };
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            document: {
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
                clientWidth: document.documentElement.clientWidth,
                clientHeight: document.documentElement.clientHeight,
            },
            activeElement: document.activeElement?.id || document.activeElement?.tagName || null,
            nodes: Object.fromEntries(targetIds.map(id => [id, readNode(id)])),
        };
    }, ids);
}

async function capture(page, artifactDir, viewportLabel, surface) {
    const file = path.join(artifactDir, `${viewportLabel}-${surface}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
}

async function controlledGoto(page, baseUrl, setControlledNavigation) {
    setControlledNavigation(true);
    try {
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(resolve => setTimeout(resolve, 50));
                return;
            } catch (error) {
                lastError = error;
                if (attempt > 0 || !/Timeout .* exceeded/i.test(String(error?.message || error))) throw error;
                await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
            }
        }
        throw lastError;
    } finally {
        setControlledNavigation(false);
    }
}

async function prepareViewport(page, baseUrl, viewport, setControlledNavigation) {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    try {
        await page.evaluate(() => localStorage.clear());
    } catch (_error) {
        await controlledGoto(page, baseUrl, setControlledNavigation);
        await page.evaluate(() => localStorage.clear());
    }
    await controlledGoto(page, baseUrl, setControlledNavigation);
    await page.waitForFunction(() => typeof game !== 'undefined', { timeout: 20000 });
    await page.evaluate(() => game.ui_updatePCLayout?.());
    const actualViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    if (actualViewport.width !== viewport.width || actualViewport.height !== viewport.height) {
        throw new Error(`实际 viewport 与请求不一致: requested=${viewport.width}x${viewport.height}, actual=${actualViewport.width}x${actualViewport.height}`);
    }
    return actualViewport;
}

async function runUiPolishSuite(options) {
    const {
        page,
        baseUrl,
        artifactDir,
        viewportFilter,
        runTest,
        assert,
        browserIssues,
        classifiedBrowserIssues,
        expectDialog,
        verifyExpectedDialog,
        setDiagnosticContext,
        setControlledNavigation,
    } = options;
    fs.mkdirSync(artifactDir, { recursive: true });
    const reports = [];
    const selectedViewports = viewportFilter
        ? VIEWPORTS.filter(viewport => viewport.label === viewportFilter)
        : VIEWPORTS;
    if (selectedViewports.length === 0) throw new Error(`未知 ui-polish viewport: ${viewportFilter}`);

    for (const viewport of selectedViewports) {
        const report = { ...viewport, flows: {}, screenshots: [], issues: [], classifiedIssues: [] };
        const issueStart = browserIssues.length;
        const classifiedStart = classifiedBrowserIssues.length;
        reports.push(report);
        setDiagnosticContext(`${viewport.label}:bootstrap`);

        await runTest(`${viewport.label}: 首局教程启动与一次性完成`, async () => {
            report.actualViewport = await prepareViewport(page, baseUrl, viewport, setControlledNavigation);
            await page.waitForFunction(() => game._tutorialActive && document.getElementById('tutorial-card'), { timeout: 5000 });
            const state = await page.evaluate(() => {
                const card = document.getElementById('tutorial-card');
                const saved = JSON.parse(localStorage.getItem('echo_alchemist_save') || '{}');
                return {
                    phase: game.phase,
                    active: game._tutorialActive,
                    completed: game.saveData?.tutorialCompleted,
                    persistedCompleted: saved.tutorialCompleted,
                    cardVisible: !!card && getComputedStyle(card).display !== 'none',
                };
            });
            assert(state.phase === 'meta' && state.active && state.cardVisible, '首次加载应在 meta 显示教程卡');
            assert(state.completed !== true && state.persistedCompleted !== true, '首局完成标记不得提前写入');
            report.flows.tutorial = await collectMetrics(page, ['phase-meta', 'tutorial-card', 'tutorial-overlay']);
            report.screenshots.push(await capture(page, artifactDir, viewport.label, 'tutorial'));
            await page.click('#tutorial-next-btn');
            await page.waitForFunction(() => game._tutorialStepIndex === 1, { timeout: 5000 });
            const startTarget = await page.evaluate(() => {
                const button = document.querySelector('button[onclick="game.meta_startRun()"]');
                const rect = button.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                const hit = document.elementFromPoint(x, y);
                return {
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    centerHit: hit === button || button.contains(hit),
                };
            });
            assert(startTarget.rect.width >= 44 && startTarget.rect.height >= 44 && startTarget.centerHit, '首局真实开始按钮必须可命中且不被教程卡遮挡');
            await page.click('button[onclick="game.meta_startRun()"]');
            await page.waitForFunction(() => game._tutorialStepIndex === 2 && game._relicOverlaySession?.active, { timeout: 5000 });
            await page.focus('#relic-container .relic-card');
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => game.phase === 'gathering' && game._tutorialStepIndex === 3, { timeout: 10000 });
            await page.evaluate(() => game.phase_switchPhase('combat'));
            await page.waitForFunction(() => game._tutorialStepIndex === 4, { timeout: 5000 });
            await page.evaluate(() => game.eventBus.emit('ui:ammo_fired', {}));
            await page.waitForFunction(() => game._tutorialStepIndex === 5, { timeout: 5000 });
            await page.click('#tutorial-next-btn');
            const completed = await page.evaluate(() => {
                const saved = JSON.parse(localStorage.getItem('echo_alchemist_save') || '{}');
                return game.saveData?.tutorialCompleted === true
                    && saved.tutorialCompleted === true
                    && !document.getElementById('tutorial-card');
            });
            assert(completed, '真实首局教程必须完成、持久化并清理教程 DOM');
            report.flows.tutorial.startTarget = startTarget;
        });

        setDiagnosticContext(`${viewport.label}:pause`);
        await runTest(`${viewport.label}: pause lease 嵌套顺序`, async () => {
            await page.evaluate(() => {
                game.sys_resetGame();
                game.phase_switchPhase('gathering');
                game.__uiPolishPauseParent = game.sys_acquirePauseLease('ui_polish_parent');
            });
            await page.click('#settings-btn');
            await page.waitForFunction(() => getComputedStyle(document.getElementById('phase-pause')).display !== 'none', { timeout: 5000 });
            const opened = await page.evaluate(() => {
                const overlay = document.getElementById('phase-pause');
                const measure = node => {
                    const rect = node.getBoundingClientRect();
                    return {
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        clientWidth: node.clientWidth,
                        clientHeight: node.clientHeight,
                        scrollWidth: node.scrollWidth,
                        scrollHeight: node.scrollHeight,
                    };
                };
                return {
                    count: game._pauseLeases.size,
                    owners: [...game._pauseLeases.values()],
                    paused: game.isPaused,
                    visible: getComputedStyle(overlay).display !== 'none',
                    role: overlay.getAttribute('role'),
                    ariaModal: overlay.getAttribute('aria-modal'),
                    labelledBy: overlay.getAttribute('aria-labelledby'),
                    surface: measure(overlay),
                    scrollRegion: measure(document.getElementById('pause-scroll-region')),
                };
            });
            const openedMetrics = await collectMetrics(page, ['phase-pause', 'pause-scroll-region', 'pause-resume-button']);
            await page.click('#pause-resume-button');
            const states = await page.evaluate(() => {
                const childClosed = { count: game._pauseLeases.size, paused: game.isPaused };
                const parent = game.__uiPolishPauseParent;
                game.__uiPolishPauseParent = null;
                game.sys_releasePauseLease(parent);
                return {
                    opened: null,
                    childClosed,
                    released: { count: game._pauseLeases.size, paused: game.isPaused },
                };
            });
            states.opened = opened;
            assert(states.opened.count === 2 && states.opened.paused && states.opened.visible, 'pause 必须叠加而非覆盖父 lease');
            assert(states.opened.role === 'dialog' && states.opened.ariaModal === 'true' && states.opened.labelledBy, 'pause dialog 必须有可访问名称');
            assert(states.opened.surface.rect.width > 0 && states.opened.surface.rect.height > 0 && states.opened.scrollRegion.clientHeight > 0, 'pause 可见态必须记录真实 surface/scroll 尺寸');
            assert(states.childClosed.count === 1 && states.childClosed.paused, '关闭 pause 只能释放自己的 lease');
            assert(states.released.count === 0 && !states.released.paused, '最后 owner 释放后才恢复运行');
            report.flows.pause = {
                states,
                openedMetrics,
                cleanupMetrics: await collectMetrics(page, ['phase-pause', 'settings-btn', 'unified-top-bar']),
            };
        });

        setDiagnosticContext(`${viewport.label}:continue-abandon`);
        await runTest(`${viewport.label}: save/continue 与确认放弃`, async () => {
            const saved = await page.evaluate(() => {
                game.sys_resetGame();
                game.phase_switchPhase('gathering');
                game.round = 4;
                game.projectiles = [];
                game.burstQueue = [];
                game.pendingShots = [];
                game.dropBalls = [];
                game.energyOrbs = [];
                game.gatheringSessions = [];
                game.ammoQueue = [];
                game.marbleQueue = [{ type: 'normal', collected: [], runeSlots: [] }];
                game.marblesPool = game.marbleQueue.map(marble => ({ ...marble, collected: [], runeSlots: [] }));
                game.selectedMarbles = [];
                return game.sys_saveRunState();
            });
            assert(saved, 'Round 4 gathering 安全点必须成功写入');
            await controlledGoto(page, baseUrl, setControlledNavigation);
            await page.waitForFunction(() => typeof game !== 'undefined' && game.phase === 'meta', { timeout: 20000 });
            const saveState = await page.evaluate(() => {
                const button = document.getElementById('meta-continue-btn');
                return {
                    visible: getComputedStyle(button).display !== 'none',
                    disabled: button.disabled,
                    ariaDisabled: button.getAttribute('aria-disabled'),
                    label: button.getAttribute('aria-label'),
                };
            });
            assert(saveState.visible && !saveState.disabled, `刷新后安全点存档必须暴露可用 Continue: ${JSON.stringify(saveState)}`);
            assert(saveState.ariaDisabled === 'false' && /Round 4/.test(saveState.label), 'Continue 的 ARIA 状态必须同步 Round');
            await page.click('#meta-continue-btn');
            await page.waitForFunction(() => game.phase === 'gathering', { timeout: 10000 });
            await page.click('#settings-btn');
            const abandonDialog = expectDialog(/确定放弃本局并返回主界面/, 'accept');
            await page.click('#pause-abandon-button');
            await page.waitForFunction(() => game.phase === 'meta' && !localStorage.getItem('echo_alchemist_run_state'), { timeout: 5000 });
            assert(verifyExpectedDialog(abandonDialog), '放弃本局必须真实弹出并消费预期确认框');
            await new Promise(resolve => setTimeout(resolve, 2600));
            const abandoned = await page.evaluate(() => ({
                phase: game.phase,
                leases: game._pauseLeases.size,
                paused: game.isPaused,
                continueVisible: getComputedStyle(document.getElementById('meta-continue-btn')).display !== 'none',
                pauseVisible: getComputedStyle(document.getElementById('phase-pause')).display !== 'none',
                launcherVisible: (() => {
                    const panel = document.getElementById('phase-rune-launcher');
                    const rect = panel.getBoundingClientRect();
                    return getComputedStyle(panel).display !== 'none' && rect.width > 0 && rect.height > 0;
                })(),
            }));
            assert(abandoned.phase === 'meta' && abandoned.leases === 0 && !abandoned.paused && !abandoned.continueVisible, '放弃必须稳定停留 meta 并清理存档、lease 与 Continue');
            assert(!abandoned.pauseVisible && !abandoned.launcherVisible, '放弃后的延迟 callback 不得复活旧 overlay');
            report.flows.continueAbandon = {
                saveState,
                abandoned,
                metrics: await collectMetrics(page, ['phase-meta', 'meta-continue-btn', 'phase-pause']),
            };
        });

        setDiagnosticContext(`${viewport.label}:shop-resolver`);
        await runTest(`${viewport.label}: 商店状态与 round-start resolver`, async () => {
            await page.evaluate(() => {
                if (game.phase !== 'meta') game.phase_switchPhase('meta');
            });
            await page.click('button[onclick="game.meta_openShop()"]');
            await page.waitForFunction(() => game.phase === 'shop', { timeout: 5000 });
            const shopState = await page.evaluate(() => {
                const measure = node => {
                    const rect = node.getBoundingClientRect();
                    return {
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        clientWidth: node.clientWidth,
                        clientHeight: node.clientHeight,
                        scrollWidth: node.scrollWidth,
                        scrollHeight: node.scrollHeight,
                    };
                };
                const surface = document.getElementById('phase-shop');
                const region = document.getElementById('shop-items-container');
                const cards = Array.from(document.querySelectorAll('.shop-upgrade-card'));
                return {
                    phase: game.phase,
                    visible: getComputedStyle(surface).display !== 'none',
                    regionRole: region?.getAttribute('role'),
                    regionLabel: region?.getAttribute('aria-label'),
                    cards: cards.length,
                    surface: measure(surface),
                    region: measure(region),
                };
            });
            assert(shopState.phase === 'shop' && shopState.visible && shopState.cards > 0, '局外商店必须渲染可见商品');
            assert(shopState.regionRole === 'region' && shopState.regionLabel, '商品列表必须有命名 region');
            assert(shopState.surface.rect.width > 0 && shopState.surface.rect.height > 0 && shopState.region.clientHeight > 0, '局外商店必须记录可见 surface/列表尺寸');
            const openedMetrics = await collectMetrics(page, ['phase-shop', 'shop-items-container']);

            const runShopState = await page.evaluate(() => {
                game.sys_resetGame();
                game.phase_switchPhase('gathering');
                game.runFragments = 0;
                game.__uiPolishShopClosed = 0;
                const opened = game.ui_showRunShop(() => { game.__uiPolishShopClosed++; }, { reason: 'ui_polish' });
                const sessionId = game._runShopSession?.id;
                const overlay = document.getElementById('run-shop-overlay');
                const items = Array.from(overlay.querySelectorAll('.run-shop-item'));
                const itemStatesValid = items.every(button =>
                    button.getAttribute('aria-disabled') === String(button.disabled));
                const disabledItemsHaveReason = items.filter(button => button.disabled).every(button =>
                    /还差/.test(button.title) && /还差/.test(button.getAttribute('aria-label') || ''));
                const rect = overlay.getBoundingClientRect();
                const dialogRect = overlay.firstElementChild?.getBoundingClientRect();
                const snapshot = {
                    opened,
                    sessionId,
                    leases: game._pauseLeases.size,
                    role: overlay.getAttribute('role'),
                    ariaModal: overlay.getAttribute('aria-modal'),
                    itemCount: items.length,
                    disabledCount: items.filter(button => button.disabled).length,
                    itemStatesValid,
                    disabledItemsHaveReason,
                    surface: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    dialog: dialogRect ? { x: dialogRect.x, y: dialogRect.y, width: dialogRect.width, height: dialogRect.height } : null,
                };
                const firstClose = game.ui_hideRunShop({ sessionId });
                const repeatClose = game.ui_hideRunShop({ sessionId });
                return { ...snapshot, firstClose, repeatClose, closes: game.__uiPolishShopClosed, leasesAfter: game._pauseLeases.size };
            });
            assert(runShopState.opened && runShopState.role === 'dialog' && runShopState.ariaModal === 'true', '局内商店必须是 owned dialog');
            assert(runShopState.itemCount > 0 && runShopState.disabledCount > 0 && runShopState.itemStatesValid && runShopState.disabledItemsHaveReason, '局内商店必须渲染商品并同步 disabled/ARIA/可读缺额原因');
            assert(runShopState.leases === 1 && runShopState.surface.width > 0 && runShopState.dialog?.height > 0, '局内商店必须记录可见 dialog 与 pause ownership');
            assert(runShopState.firstClose && !runShopState.repeatClose && runShopState.closes === 1 && runShopState.leasesAfter === 0, '商店 session 只能结算一次');

            const resolver = await page.evaluate(() => {
                game.sys_resetGame();
                game.phase_switchPhase('gathering');
                game.pendingRoundStartRewards = [{ id: 'ui-polish-resource', type: 'run_resource_pack', fragmentAmount: 17 }];
                game.runFragments = 0;
                const originals = {
                    animation: game.ui_playLootToCardAnimation,
                    banner: game.sys_showRoundStartBanner,
                    drop: game.spawn_dropRuneFragments,
                };
                game.__uiPolishBannerCount = 0;
                game.ui_playLootToCardAnimation = (_x, _y, _type, done) => done();
                game.spawn_dropRuneFragments = (_x, _y, amount) => {
                    game.runFragments += amount;
                    game.runRuneFragmentsGained += amount;
                };
                game.sys_showRoundStartBanner = () => { game.__uiPolishBannerCount++; return true; };
                const started = game.sys_startRoundStartResolver();
                const result = {
                    started,
                    fragments: game.runFragments,
                    pending: game.pendingRoundStartRewards.length,
                    bannerCount: game.__uiPolishBannerCount,
                    active: game._roundStartResolverActive,
                };
                game.ui_playLootToCardAnimation = originals.animation;
                game.sys_showRoundStartBanner = originals.banner;
                game.spawn_dropRuneFragments = originals.drop;
                return result;
            });
            assert(resolver.started && resolver.fragments === 17 && resolver.pending === 0, 'resolver 必须原子消费并授予局内资源');
            assert(resolver.bannerCount === 1 && !resolver.active, 'resolver 终点只能继续一次');
            report.flows.shopResolver = {
                shopState,
                openedMetrics,
                runShopState,
                resolver,
                metrics: await collectMetrics(page, ['phase-shop', 'shop-items-container', 'run-shop-overlay']),
            };
        });

        setDiagnosticContext(`${viewport.label}:training-truth`);
        await runTest(`${viewport.label}: 训练场与真理之书返回链`, async () => {
            await page.evaluate(() => {
                game.sys_resetGame();
                game.phase_switchPhase('meta');
            });
            await page.click('button[onclick="game.trainingGround.enter()"]');
            await page.waitForFunction(() => game.phase === 'training' && game.trainingGround.active, { timeout: 5000 });
            const training = await collectMetrics(page, ['phase-training', 'train-control-panel', 'train-exit-button']);
            assert(training.nodes['phase-training']?.display !== 'none', '训练场必须可见');
            let resizeRoundTrip = null;
            if (viewport.label === 'mobile-390x844') {
                await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
                await page.waitForFunction(() => document.body.classList.contains('pc-mode')
                    && document.getElementById('train-control-panel')?.parentElement?.id === 'pc-left-training-controls-mount'
                    && document.getElementById('train-sidebar')?.parentElement?.id === 'pc-right-training-scenes-mount', { timeout: 5000 });
                const desktop = await page.evaluate(() => ({
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    phase: game.phase,
                    active: game.trainingGround.active,
                    pcMode: document.body.classList.contains('pc-mode'),
                    leftTrainingDisplay: getComputedStyle(document.getElementById('pc-left-training')).display,
                    rightTrainingDisplay: getComputedStyle(document.getElementById('pc-right-training')).display,
                    runeMountInlineDisplay: document.getElementById('pc-right-rune-mount').style.display,
                    controlParent: document.getElementById('train-control-panel')?.parentElement?.id || null,
                    sidebarParent: document.getElementById('train-sidebar')?.parentElement?.id || null,
                }));
                assert(desktop.viewport.width === 1440 && desktop.viewport.height === 900 && desktop.phase === 'training' && desktop.active && desktop.pcMode, '同会话移动→桌面后必须保留 training 生命周期与实际视口');
                assert(desktop.leftTrainingDisplay === 'flex' && desktop.rightTrainingDisplay === 'flex' && desktop.runeMountInlineDisplay === 'none', '桌面训练态必须独占两侧 training pane');
                assert(desktop.controlParent === 'pc-left-training-controls-mount' && desktop.sidebarParent === 'pc-right-training-scenes-mount', '桌面训练节点必须迁移到左右挂载点');

                await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
                await page.waitForFunction(() => !document.body.classList.contains('pc-mode')
                    && document.getElementById('train-control-panel')?.parentElement?.id === 'train-main-area'
                    && document.getElementById('train-sidebar')?.parentElement?.id === 'train-main-area', { timeout: 5000 });
                const mobile = await page.evaluate(() => ({
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    phase: game.phase,
                    active: game.trainingGround.active,
                    pcMode: document.body.classList.contains('pc-mode'),
                    leftTrainingDisplay: getComputedStyle(document.getElementById('pc-left-training')).display,
                    rightTrainingDisplay: getComputedStyle(document.getElementById('pc-right-training')).display,
                    runeMountInlineDisplay: document.getElementById('pc-right-rune-mount').style.display,
                    controlParent: document.getElementById('train-control-panel')?.parentElement?.id || null,
                    sidebarParent: document.getElementById('train-sidebar')?.parentElement?.id || null,
                }));
                assert(mobile.viewport.width === viewport.width && mobile.viewport.height === viewport.height && mobile.phase === 'training' && mobile.active && !mobile.pcMode, '同会话桌面→移动后必须保留 training 生命周期并恢复目标视口');
                assert(mobile.leftTrainingDisplay === 'none' && mobile.rightTrainingDisplay === 'none' && mobile.runeMountInlineDisplay !== 'none', '恢复移动训练态必须清除桌面 training pane');
                assert(mobile.controlParent === 'train-main-area' && mobile.sidebarParent === 'train-main-area', '恢复移动训练态必须把训练节点送回 home');
                resizeRoundTrip = { desktop, mobile };
            }
            await page.evaluate(() => game.ui_openTruthBook());
            await page.waitForFunction(() => game.phase === 'truth_book', { timeout: 5000 });
            const truth = await page.evaluate(() => {
                const selected = game.truthBook.selectEntryById('truth_core_alchemy_table');
                const panel = document.getElementById('phase-truth-book');
                const action = document.getElementById('truth-entry-action');
                return {
                    selected,
                    trainingActive: game.trainingGround.active,
                    role: panel.getAttribute('role'),
                    ariaModal: panel.getAttribute('aria-modal'),
                    actionVisible: !action.hidden && getComputedStyle(action).display !== 'none',
                    text: document.getElementById('truth-item-name')?.textContent || '',
                };
            });
            assert(truth.selected && !truth.trainingActive && truth.role === 'dialog' && truth.ariaModal === 'true', '真理之书必须接管训练场并保持 dialog 语义');
            assert(truth.actionVisible && /炼金台/.test(truth.text), '主解释条目必须提供炼金台动作');
            const truthMetrics = await collectMetrics(page, ['phase-truth-book', 'truth-entry-action', 'truth-detail-panel']);
            await page.evaluate(() => game.ui_closeTruthBook());
            const restored = await page.evaluate(() => {
                game.ui_updatePCLayout?.();
                const leftTraining = document.getElementById('pc-left-training');
                const rightTraining = document.getElementById('pc-right-training');
                const runeMount = document.getElementById('pc-right-rune-mount');
                return {
                    phase: game.phase,
                    leftTrainingDisplay: getComputedStyle(leftTraining).display,
                    rightTrainingDisplay: getComputedStyle(rightTraining).display,
                    runeMountInlineDisplay: runeMount.style.display,
                    controlParent: document.getElementById('train-control-panel')?.parentElement?.id || null,
                    sidebarParent: document.getElementById('train-sidebar')?.parentElement?.id || null,
                };
            });
            assert(restored.phase === 'meta', '从训练场进入真理之书后应返回 meta');
            if (viewport.width > 1024) {
                assert(restored.leftTrainingDisplay === 'none' && restored.rightTrainingDisplay === 'none', '离开桌面训练场必须清除两侧训练 pane');
                assert(restored.runeMountInlineDisplay !== 'none' && restored.controlParent === 'train-main-area' && restored.sidebarParent === 'train-main-area', '离开训练场必须恢复符文挂载点与训练节点 home');
            }
            report.flows.trainingTruth = { training, resizeRoundTrip, truth, truthMetrics, restored };
        });

        setDiagnosticContext(`${viewport.label}:launcher`);
        await runTest(`${viewport.label}: launcher 键盘/触控/codex/知识双向入口`, async () => {
            const isMobile = viewport.width <= 1024;
            await page.evaluate(mobile => {
                game.sys_resetGame();
                game.phase_switchPhase('gathering');
                game.ui_updatePCLayout?.();
                const opener = document.getElementById('settings-btn');
                opener?.focus();
                game.__uiPolishLauncherParent = mobile ? game.sys_acquirePauseLease('ui_polish_launcher_parent') : null;
                if (!mobile) game.ui_openRuneLauncher();
            }, isMobile);
            if (isMobile) await page.click('.rune-launcher-float-btn');
            await page.waitForFunction(() => {
                const panel = document.getElementById('phase-rune-launcher');
                const rect = panel.getBoundingClientRect();
                return getComputedStyle(panel).display !== 'none' && rect.width > 0 && rect.height > 0;
            }, { timeout: 5000 });
            const launcher = await page.evaluate(mobile => {
                const panel = document.getElementById('phase-rune-launcher');
                const rect = panel.getBoundingClientRect();
                let touchBubbled = false;
                if (mobile) {
                    window.addEventListener('touchmove', () => { touchBubbled = true; }, { once: true });
                    panel.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true }));
                }
                return {
                    role: panel.getAttribute('role'),
                    ariaModal: panel.getAttribute('aria-modal'),
                    labelled: panel.getAttribute('aria-label'),
                    leases: game._pauseLeases.size,
                    display: getComputedStyle(panel).display,
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    parent: panel.parentElement?.id || null,
                    gatheringDisplay: getComputedStyle(document.getElementById('pc-left-gathering')).display,
                    leftTrainingDisplay: getComputedStyle(document.getElementById('pc-left-training')).display,
                    rightTrainingDisplay: getComputedStyle(document.getElementById('pc-right-training')).display,
                    runeMountDisplay: getComputedStyle(document.getElementById('pc-right-rune-mount')).display,
                    focusedInside: panel.contains(document.activeElement),
                    touchBubbled,
                };
            }, isMobile);
            assert(launcher.labelled && launcher.display !== 'none' && launcher.rect.width > 0 && launcher.rect.height > 0, 'launcher 必须真实挂载并具有可见尺寸');
            if (isMobile) {
                assert(launcher.role === 'dialog' && launcher.ariaModal === 'true' && launcher.leases === 2, '移动 launcher 必须叠加自己的 modal lease');
                assert(launcher.focusedInside && !launcher.touchBubbled, '移动 launcher 必须接管焦点且 touchmove 不得穿透到底层 Canvas');
            } else {
                assert(launcher.role === 'region' && launcher.ariaModal == null && launcher.leases === 0, '桌面 launcher 必须是非 modal 常驻 region');
                assert(launcher.parent === 'pc-right-rune-mount' && launcher.gatheringDisplay === 'flex', '桌面 launcher 与 gathering pane 必须挂载到正确侧栏');
                assert(launcher.leftTrainingDisplay === 'none' && launcher.rightTrainingDisplay === 'none' && launcher.runeMountDisplay !== 'none', '桌面 gathering 必须清除训练 pane 并恢复符文挂载点');
            }

            let focusTrap = null;
            let touchCases = null;
            let reentry = null;
            if (isMobile) {
                await page.evaluate(() => {
                    const panel = document.getElementById('phase-rune-launcher');
                    const focusable = game._ui_getDialogFocusable(panel);
                    focusable[focusable.length - 1]?.focus();
                });
                await page.keyboard.press('Tab');
                const forwardWrapped = await page.evaluate(() => {
                    const panel = document.getElementById('phase-rune-launcher');
                    return document.activeElement === game._ui_getDialogFocusable(panel)[0];
                });
                await page.evaluate(() => game._ui_getDialogFocusable(document.getElementById('phase-rune-launcher'))[0]?.focus());
                await page.keyboard.press('Shift+Tab');
                const backwardWrapped = await page.evaluate(() => {
                    const panel = document.getElementById('phase-rune-launcher');
                    const focusable = game._ui_getDialogFocusable(panel);
                    return document.activeElement === focusable[focusable.length - 1];
                });
                focusTrap = { forwardWrapped, backwardWrapped };
                assert(forwardWrapped && backwardWrapped, '移动 launcher 的 Tab 与 Shift+Tab 必须精确首尾闭环');

                const exerciseTouch = mode => page.evaluate(async touchMode => {
                    game.ui_closeRunePicker({ restoreFocus: false });
                    game.runeGrid = Array(9).fill(null);
                    game.runeInventory = [{ id: 'rune_pyro_1', level: 1, uid: `ui-polish-${touchMode}` }];
                    game.ui_updateRuneGrid();
                    game.ui_openRunePicker(0);
                    const overlay = document.getElementById('rune-picker-overlay');
                    const button = document.querySelector('#rune-picker-list > button');
                    const dispatch = type => button.dispatchEvent(new TouchEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        touches: [],
                        changedTouches: [],
                    }));
                    dispatch('touchstart');
                    if (touchMode === 'long') await new Promise(resolve => setTimeout(resolve, 560));
                    if (touchMode === 'cancel') dispatch('touchcancel');
                    dispatch('touchend');
                    await new Promise(resolve => setTimeout(resolve, 20));
                    const outcome = {
                        inventory: game.runeInventory.length,
                        placed: game.runeGrid.filter(Boolean).length,
                        pickerOpen: !overlay.classList.contains('hidden'),
                    };
                    if (outcome.pickerOpen) game.ui_closeRunePicker({ restoreFocus: false });
                    return outcome;
                }, mode);
                const short = await exerciseTouch('short');
                const long = await exerciseTouch('long');
                const cancel = await exerciseTouch('cancel');
                touchCases = { short, long, cancel };
                assert(short.placed === 1 && short.inventory === 0, '静止短按必须恰好放置一颗符文');
                assert(long.placed === 0 && long.inventory === 1, '长按预览后的 touchend 不得放置符文');
                assert(cancel.placed === 0 && cancel.inventory === 1, 'touchcancel 后迟到 touchend 不得放置符文');

                reentry = await page.evaluate(() => {
                    const oldToken = game._runeLauncherPauseToken;
                    const token = game.sys_captureLifecycleToken();
                    const deferred = game.sys_runOrDeferLifecycleContinuation(
                        'ui-polish-launcher-reentry',
                        () => game.ui_openRuneLauncher(),
                        { token, expectedPhase: 'gathering' }
                    );
                    game.ui_closeRuneLauncher({ restoreFocus: false });
                    const afterChildClose = { leases: game._pauseLeases.size, token: game._runeLauncherPauseToken };
                    const parent = game.__uiPolishLauncherParent;
                    game.__uiPolishLauncherParent = null;
                    game.sys_releasePauseLease(parent);
                    const replacementToken = game._runeLauncherPauseToken;
                    const replacement = {
                        leases: game._pauseLeases.size,
                        tokenChanged: replacementToken != null && replacementToken !== oldToken,
                        visible: game._isRuneLauncherOpen(),
                    };
                    game.ui_closeRuneLauncher({ restoreFocus: false });
                    game.__uiPolishLauncherParent = game.sys_acquirePauseLease('ui_polish_launcher_parent');
                    game.ui_openRuneLauncher();
                    return {
                        deferred,
                        afterChildClose,
                        replacement,
                        reopened: { leases: game._pauseLeases.size, token: game._runeLauncherPauseToken != null },
                    };
                });
                assert(reentry.deferred === 'deferred' && reentry.afterChildClose.leases === 1 && reentry.afterChildClose.token == null, '关闭 launcher 时必须先清空本地 token，并保留父 lease');
                assert(reentry.replacement.leases === 1 && reentry.replacement.tokenChanged && reentry.replacement.visible, '最后 lease 释放时的同步 continuation 必须保留替代 launcher token');
                assert(reentry.reopened.leases === 2 && reentry.reopened.token, '同步重入验证后必须恢复父/子双 lease 场景');
            }

            const codex = await page.evaluate(() => {
                game.runeGrid = [
                    { id: 'rune_pyro_1', level: 1 }, null, null,
                    null, { id: 'rune_pyro_2', level: 1 }, null,
                    null, null, { id: 'rune_pyro_1', level: 1 },
                ];
                game.runeInventory = [
                    { id: 'rune_cryo_1', level: 1 },
                    { id: 'rune_cryo_2', level: 1 },
                    { id: 'rune_cryo_1', level: 1 },
                ];
                game.saveData.discoveredRunewords = ['runeword_meltdown', 'runeword_absolute_zero', 'runeword_thunderstorm'];
                game.ui_updateRuneGrid();
                game.ui_switchRuneTab('codex');
                const panel = document.getElementById('phase-rune-launcher');
                const codexPanel = document.getElementById('rune-codex-panel');
                const codexTab = document.getElementById('rune-tab-codex');
                const states = [...codexPanel.querySelectorAll('[data-codex-state]')].map(card => card.dataset.codexState);
                return {
                    states: [...new Set(states)],
                    selected: codexTab.getAttribute('aria-selected'),
                    active: codexTab.dataset.active,
                    activeClass: codexTab.classList.contains('bg-purple-700/60') && !codexTab.classList.contains('bg-slate-800/60'),
                    leaksInternalId: /runeword_/.test(codexPanel.innerText),
                    visible: panel.getBoundingClientRect().width > 0 && codexPanel.getBoundingClientRect().height > 0,
                };
            });
            assert(['active', 'activatable', 'insufficient', 'undiscovered'].every(state => codex.states.includes(state)), `codex 四态必须齐全: ${JSON.stringify(codex.states)}`);
            assert(codex.selected === 'true' && codex.active === 'true' && codex.activeClass && codex.visible, 'codex Tab 的 ARIA、data-active 与 CSS 激活态必须一致');
            assert(!codex.leaksInternalId, 'codex 可见文案不得泄漏 runeword_ 内部 ID');

            if (isMobile) {
                await page.evaluate(() => {
                    game.ui_switchRuneTab('launcher');
                    game.runeGrid = Array(9).fill(null);
                    game.runeInventory = [{ id: 'rune_pyro_1', level: 1, uid: 'ui-polish-escape' }];
                    game.ui_updateRuneGrid();
                    game.ui_openRunePicker(0);
                });
                await page.keyboard.press('Escape');
                const pickerEscape = await page.evaluate(() => ({
                    pickerHidden: document.getElementById('rune-picker-overlay').classList.contains('hidden'),
                    launcherVisible: game._isRuneLauncherOpen(),
                    focusedInside: document.getElementById('phase-rune-launcher').contains(document.activeElement),
                }));
                assert(pickerEscape.pickerHidden && pickerEscape.launcherVisible && pickerEscape.focusedInside, 'picker Escape 只能关闭 picker 并把焦点留在 launcher');
                await page.evaluate(() => game.ui_switchRuneTab('codex'));
            }

            report.flows.launcherCodex = {
                launcher,
                focusTrap,
                touchCases,
                reentry,
                codex,
                metrics: await collectMetrics(page, ['phase-rune-launcher', 'rune-tab-codex', 'rune-codex-panel']),
            };
            report.screenshots.push(await capture(page, artifactDir, viewport.label, 'launcher-codex'));

            const truthOpened = await page.evaluate(() => game.truthBook.openEntryFromAlchemyTable());
            assert(truthOpened, '炼金台必须能打开真理之书主解释');
            await page.waitForFunction(() => game.phase === 'truth_book', { timeout: 5000 });
            await page.click('#truth-entry-action');
            await page.waitForFunction(() => game.phase === 'gathering', { timeout: 5000 });
            if (isMobile) {
                await page.keyboard.press('Escape');
                await page.waitForFunction(() => document.getElementById('phase-rune-launcher').style.display === 'none', { timeout: 5000 });
                const closed = await page.evaluate(() => {
                    const parent = game.__uiPolishLauncherParent;
                    const childClosed = { leases: game._pauseLeases.size, token: game._runeLauncherPauseToken };
                    game.sys_releasePauseLease(parent);
                    return { childClosed, finalLeases: game._pauseLeases.size, paused: game.isPaused };
                });
                assert(closed.childClosed.leases === 1 && closed.childClosed.token == null, 'Escape 只能释放 launcher lease');
                assert(closed.finalLeases === 0 && !closed.paused, '父 lease 最后释放后恢复运行');
            } else {
                await page.evaluate(() => {
                    document.getElementById('rune-tab-launcher')?.focus();
                });
                await page.keyboard.press('Escape');
                const desktopState = await page.evaluate(() => ({
                    role: document.getElementById('phase-rune-launcher').getAttribute('role'),
                    leases: game._pauseLeases.size,
                }));
                assert(desktopState.role === 'region' && desktopState.leases === 0, '桌面 Escape 不得把常驻 region 变成 modal owner');
                await page.evaluate(() => game.ui_closeRuneLauncher({ force: true, restoreFocus: false }));
            }
        });

        setDiagnosticContext(`${viewport.label}:gameover`);
        await runTest(`${viewport.label}: gameover 结算与滚动`, async () => {
            const before = await page.evaluate(() => {
                game.sys_resetGame();
                game.phase_switchPhase('gathering');
                game.ui_updatePCLayout?.();
                game.ui_openPause();
                game.ui_openRuneLauncher();
                localStorage.setItem('echo_alchemist_run_state', JSON.stringify({ version: 3, uiPolishFixture: true }));
                const transient = {
                    leases: game._pauseLeases.size,
                    pauseVisible: getComputedStyle(document.getElementById('phase-pause')).display !== 'none',
                    launcherVisible: (() => {
                        const panel = document.getElementById('phase-rune-launcher');
                        const rect = panel.getBoundingClientRect();
                        return getComputedStyle(panel).display !== 'none' && rect.width > 0 && rect.height > 0;
                    })(),
                };
                game.gameOver = true;
                game.round = 6;
                game.runFragments = 11;
                game.runRuneFragmentsGained = 20;
                game.runKillCount = 3;
                game.roundDamageHistory = [100, 150, 220];
                game.roundDamage = 50;
                game.bossDefeatedLog = [];
                game.ownedRelics = [];
                game.runeInventory = [];
                const metaBefore = game.meta_getResourceCount('rune_fragments');
                game._gameover_triggerPhase();
                return { metaBefore, transient };
            });
            await page.waitForFunction(() => game.phase === 'gameover' && document.getElementById('gameover-content')?.children.length > 0, { timeout: 5000 });
            const state = await page.evaluate(metaBefore => {
                const phase = document.getElementById('phase-gameover');
                const text = document.getElementById('gameover-content')?.textContent || '';
                return {
                    visible: getComputedStyle(phase).display !== 'none',
                    text,
                    settled: game.meta_getResourceCount('rune_fragments') - metaBefore,
                    runFragments: game.runFragments,
                    leases: game._pauseLeases.size,
                    pauseVisible: getComputedStyle(document.getElementById('phase-pause')).display !== 'none',
                    launcherVisible: (() => {
                        const panel = document.getElementById('phase-rune-launcher');
                        const rect = panel.getBoundingClientRect();
                        return getComputedStyle(panel).display !== 'none' && rect.width > 0 && rect.height > 0;
                    })(),
                    launcherToken: game._runeLauncherPauseToken,
                    runSavePresent: localStorage.getItem('echo_alchemist_run_state') != null,
                    scrollable: phase.scrollHeight >= phase.clientHeight,
                    overflowY: getComputedStyle(phase).overflowY,
                };
            }, before.metaBefore);
            assert(before.transient.leases >= 1 && before.transient.pauseVisible && before.transient.launcherVisible, '终局夹具必须先真实打开 pause 与 launcher');
            assert(state.visible && state.settled === 3 && state.runFragments === 0, 'gameover 必须按 30% 结算一次');
            assert(['本局获得', '结算前剩余', '30% 可带出', '已结算', '局内碎片', '局外符文碎片'].every(label => state.text.includes(label)), '结算术语必须完整且无歧义');
            assert(state.leases === 0 && !state.pauseVisible && !state.launcherVisible && state.launcherToken == null && !state.runSavePresent, '终局必须清空存档、overlay 与 pause lease');
            assert(state.scrollable && ['auto', 'scroll'].includes(state.overflowY), '终局页面必须由明确的纵向滚动根承载');
            const controls = await page.evaluate(async () => {
                const phase = document.getElementById('phase-gameover');
                const previousScrollBehavior = phase.style.scrollBehavior;
                phase.style.scrollBehavior = 'auto';
                phase.scrollTop = phase.scrollHeight;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const buttons = [...phase.querySelectorAll('.gameover-buttons button')].map(button => {
                    const rect = button.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;
                    const hit = document.elementFromPoint(x, y);
                    return {
                        label: button.textContent.trim().replace(/\s+/g, ' '),
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        centerHit: hit === button || button.contains(hit),
                    };
                });
                const result = {
                    scrollTop: phase.scrollTop,
                    maxScrollTop: Math.max(0, phase.scrollHeight - phase.clientHeight),
                    buttons,
                };
                phase.scrollTop = 0;
                phase.style.scrollBehavior = previousScrollBehavior;
                return result;
            });
            assert(controls.maxScrollTop > 0 && Math.abs(controls.scrollTop - controls.maxScrollTop) <= 1, `终局滚动根必须能真实滚到底: ${JSON.stringify(controls)}`);
            assert(controls.buttons.length === 3 && controls.buttons.every(button => button.rect.height >= 44 && button.centerHit), '终局三个 CTA 必须满足 44px 且中心坐标可命中');
            report.flows.gameover = {
                state,
                controls,
                metrics: await collectMetrics(page, ['phase-gameover', 'gameover-content']),
            };
            report.screenshots.push(await capture(page, artifactDir, viewport.label, 'gameover'));
        });

        setDiagnosticContext(`${viewport.label}:diagnostics`);
        await runTest(`${viewport.label}: 控制台/pageerror/dialog 零红线`, async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            report.issues = browserIssues.slice(issueStart);
            report.classifiedIssues = classifiedBrowserIssues.slice(classifiedStart);
            const overflowSources = {
                tutorial: report.flows.tutorial.document,
                pause: report.flows.pause.openedMetrics.document,
                shop: report.flows.shopResolver.openedMetrics.document,
                training: report.flows.trainingTruth.training.document,
                truth: report.flows.trainingTruth.truthMetrics.document,
                launcher: report.flows.launcherCodex.metrics.document,
                gameover: report.flows.gameover.metrics.document,
            };
            report.layoutOverflowChecks = Object.fromEntries(Object.entries(overflowSources).map(([name, metrics]) => [name, {
                scrollWidth: metrics.scrollWidth,
                clientWidth: metrics.clientWidth,
                overflow: Math.max(0, metrics.scrollWidth - metrics.clientWidth),
            }]));
            for (const [name, metrics] of Object.entries(overflowSources)) {
                assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${name} 不得产生页面级横向溢出: ${metrics.scrollWidth}/${metrics.clientWidth}`);
            }
            assert(report.issues.length === 0, `发现未归类浏览器错误: ${JSON.stringify(report.issues.slice(0, 3))}`);
            assert(report.screenshots.length === 3, '每档视口必须产出教程、launcher/codex、gameover 三张截图');
        });
    }

    const reportPath = path.join(artifactDir, 'ui-polish-report.json');
    fs.writeFileSync(reportPath, `${JSON.stringify({ baseUrl, viewports: reports }, null, 2)}\n`, 'utf8');
    console.log(`\n  UI polish 证据: ${reportPath}`);
    return { reportPath, reports };
}

module.exports = { runUiPolishSuite, VIEWPORTS };
