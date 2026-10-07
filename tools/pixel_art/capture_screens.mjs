/**
 * capture_screens.mjs — 无头 Chrome 逐阶段截图（像素风 / 位图对比，零依赖：Node 内置 WebSocket + CDP）
 *
 *   node tools/pixel_art/capture_screens.mjs [--url http://localhost:3002/] [--out tmp/codex/REQ-20261006-pixel-art/shots]
 *        [--modes pixel,bitmap] [--width 430 --height 860 --dpr 2] [--chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"]
 *        [--set core|menus]   core：局内各阶段（默认）；menus：选弹珠 / 替换弹药 / 商店 / 炼金台 / 技能装配 / 结算
 *
 * 需要先有本地静态服务（npm start 或 python -m http.server 3002）。
 * 每个模式依次截：meta / relic / gathering / combat / pause / truth_book，并输出 report.json
 * （画布缓冲尺寸、Pixi 是否启用、资源 404 列表、下载的旧位图清单——像素模式应为空——、每阶段主循环耗时）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
    return acc;
}, []));
const URL_BASE = args.url || 'http://localhost:3002/';
const OUT = path.resolve(args.out || 'tmp/codex/REQ-20261006-pixel-art/shots');
const MODES = (args.modes || 'pixel,bitmap').split(',');
const W = Number(args.width || 430);
const H = Number(args.height || 860);
const DPR = Number(args.dpr || 2);
const CHROME = args.chrome || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(args.port || 9333);
const PXW = args.pxw ? `&pxw=${args.pxw}` : '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 50) {
    for (let i = 0; i < tries; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch (_) { /* not up yet */ }
        await sleep(200);
    }
    throw new Error(`no response from ${url}`);
}

class Cdp {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 0;
        this.pending = new Map();
        this.listeners = [];
        this.ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
            } else if (msg.method) {
                this.listeners.forEach((fn) => fn(msg));
            }
        };
    }
    open() {
        return new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = reject;
        });
    }
    send(method, params = {}) {
        const id = ++this.id;
        this.ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    }
    async eval(expr, timeout = 20000) {
        const r = await this.send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout });
        if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text} ${JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description)}`);
        return r.result.value;
    }
    async shot(file) {
        const r = await this.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    }
}

const STEPS = {
    meta: `
        if (game.phase !== 'meta' && typeof game.phase_switchPhase === 'function') game.phase_switchPhase('meta');
        await new Promise(r => setTimeout(r, 900));
        return game.phase;`,
    relic: `
        game.meta_startRun();
        await new Promise(r => setTimeout(r, 1400));
        return game.phase + ':' + [...document.querySelectorAll('.relic-card')].filter(e => e.offsetParent).length;`,
    gathering: `
        const c = [...document.querySelectorAll('.relic-card')].filter(e => e.offsetParent)[0];
        if (c) { c.click(); await new Promise(r => setTimeout(r, 300)); c.click(); }
        await new Promise(r => setTimeout(r, 2600));
        return game.phase;`,
    combat: `
        game.phase_switchPhase('combat'); game.phase_startCombatPhase();
        await new Promise(r => setTimeout(r, 3800));
        return game.phase + ':' + game.enemies.length;`,
    aim: `
        const { Vec2 } = await import('/src/utils/math_utils.js');
        const ev = { preventDefault() {}, stopPropagation() {} };
        const sx = game.width / 2, sy = game.height - 160;
        game.input_handleInputStart(new Vec2(sx, sy), ev);
        game.input_handleInputMove(new Vec2(sx - 60, sy - 140), ev);
        await new Promise(r => setTimeout(r, 500));
        return game.isDragging ? 'dragging' : 'not-dragging';`,
    fire: `
        const { Vec2 } = await import('/src/utils/math_utils.js');
        const ev = { preventDefault() {}, stopPropagation() {} };
        game.input_handleInputEnd(new Vec2(game.width / 2 - 60, game.height - 300), ev);
        await new Promise(r => setTimeout(r, 450));
        return 'projectiles:' + (game.projectiles || []).length;`,
    boss: `
        await new Promise(r => setTimeout(r, 4000));
        try { game.spawn_spawnBoss('ignis', false); } catch (e) { return 'spawn-failed ' + e.message; }
        // 首领按回合从屏幕上方降入；截图时直接放进场内看造型与读数（仅验证用）
        const b = (game.enemies || []).find(e => e.type === 'boss');
        if (b) { b.pos.y = game.combatGridTopY + b.height / 2 + 4; b.entranceTimer = 0; }
        await new Promise(r => setTimeout(r, 1500));
        return 'boss:' + (game.enemies || []).filter(e => e.type === 'boss').length;`,
    pause: `
        const btn = document.getElementById('settings-btn'); if (btn) btn.click();
        await new Promise(r => setTimeout(r, 900));
        return game.phase;`,
    truth_book: `
        if (typeof game.ui_closePauseMenu === 'function') game.ui_closePauseMenu();
        const close = [...document.querySelectorAll('button')].find(b => b.offsetParent && /继续|繼續|返回游戏|Resume/.test(b.textContent)); if (close) close.click();
        await new Promise(r => setTimeout(r, 400));
        if (typeof game.ui_openTruthBook === 'function') game.ui_openTruthBook();
        else if (typeof game.phase_switchPhase === 'function') game.phase_switchPhase('truth_book');
        await new Promise(r => setTimeout(r, 1600));
        return game.phase;`,
};

// 菜单与弹层（--set menus）：开局 → 选遗物 → 依次打开各菜单
const closeOverlays = `
    try { if (typeof game.ui_hideRunShop === 'function') game.ui_hideRunShop(); } catch (e) {}
    try { if (typeof game.ui_closeRuneLauncher === 'function') game.ui_closeRuneLauncher(); } catch (e) {}
    try { if (typeof game.ui_closeSkillEditor === 'function') game.ui_closeSkillEditor(); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));`;
const MENU_STEPS = {
    meta: STEPS.meta,
    relic: STEPS.relic,
    select: `
        const c = [...document.querySelectorAll('.relic-card')].filter(e => e.offsetParent)[0];
        if (c) { c.click(); await new Promise(r => setTimeout(r, 300)); c.click(); }
        await new Promise(r => setTimeout(r, 1500));
        game.sys_initSelectionPhase();
        await new Promise(r => setTimeout(r, 1500));
        return game.phase + ':' + document.querySelectorAll('#marble-selection-grid > *').length;`,
    replace: `
        // 替换弹药需要弹药队列：先进一次战斗让研磨产物进入队列
        game.phase_switchPhase('combat'); game.phase_startCombatPhase();
        await new Promise(r => setTimeout(r, 2500));
        if (!(game.ammoQueue || []).length && game._chargedAmmoQueue && game._chargedAmmoQueue.length) game.ammoQueue = game._chargedAmmoQueue.slice(0, 3);
        game.sys_initReplaceAmmoPhase();
        await new Promise(r => setTimeout(r, 1500));
        return game.phase + ':' + document.querySelectorAll('.replace-ammo-card').length + ' queue:' + (game.ammoQueue || []).length;`,
    shop: `
        game.phase_switchPhase('gathering');
        await new Promise(r => setTimeout(r, 600));
        game.ui_showRunShop(() => {});
        await new Promise(r => setTimeout(r, 1200));
        return 'shop:' + !!document.querySelector('#run-shop-overlay:not(.hidden)');`,
    runes: closeOverlays + `
        game.ui_openRuneLauncher();
        await new Promise(r => setTimeout(r, 1500));
        return 'runes';`,
    skills: closeOverlays + `
        game.ui_openSkillEditor();
        await new Promise(r => setTimeout(r, 1200));
        return 'skills';`,
    truth_book: closeOverlays + STEPS.truth_book,
    pause: STEPS.pause,
    // 放最后：结算会清掉本局存档
    gameover: closeOverlays + `
        try { if (typeof game.ui_closePauseMenu === 'function') game.ui_closePauseMenu(); } catch (e) {}
        game.gameOver = true; // 结算阶段的进入条件（phase_switchPhase 守卫）
        game._gameover_triggerPhase();
        await new Promise(r => setTimeout(r, 2000));
        return game.phase;`,
};
// 首页子页面与结算（--set home）
const HOME_STEPS = {
    workshop: `
        game.meta_openShop();
        await new Promise(r => setTimeout(r, 1200));
        return game.phase;`,
    gameover: `
        if (typeof game.meta_closeShop === 'function') game.meta_closeShop();
        game.phase_switchPhase('meta');
        await new Promise(r => setTimeout(r, 500));
        game.meta_startRun();
        await new Promise(r => setTimeout(r, 1400));
        const c = [...document.querySelectorAll('.relic-card')].filter(e => e.offsetParent)[0];
        if (c) { c.click(); await new Promise(r => setTimeout(r, 300)); c.click(); }
        await new Promise(r => setTimeout(r, 1500));
        game.gameOver = true; // 结算阶段的进入条件（phase_switchPhase 守卫）
        game._gameover_triggerPhase();
        await new Promise(r => setTimeout(r, 2200));
        return game.phase;`,
    training: `
        game.phase_switchPhase('meta');
        await new Promise(r => setTimeout(r, 500));
        game.trainingGround.enter();
        await new Promise(r => setTimeout(r, 1800));
        return game.phase;`,
};
const STEP_SETS = { core: STEPS, menus: MENU_STEPS, home: HOME_STEPS };

async function frameStats(cdp, ms = 2000) {
    // 无头 Chrome 的 rAF 被限到 30Hz，帧间隔不可比；这里测主循环单帧 CPU 耗时（sys_loop 自身）
    return cdp.eval(`
        const orig = game.sys_loop;
        const t = [];
        game.sys_loop = function () { const s = performance.now(); const r = orig.apply(this, arguments); t.push(performance.now() - s); return r; };
        await new Promise(r => setTimeout(r, ${ms}));
        game.sys_loop = orig;
        t.sort((a, b) => a - b);
        const mean = t.reduce((a, b) => a + b, 0) / Math.max(1, t.length);
        return { frames: t.length, median: +(t[Math.floor(t.length / 2)] || 0).toFixed(2), p95: +(t[Math.floor(t.length * 0.95)] || 0).toFixed(2), mean: +mean.toFixed(2) };`);
}

async function runMode(browserWs, mode) {
    const { targetId } = await browserWs.send('Target.createTarget', { url: 'about:blank' });
    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const t = targets.find((x) => x.id === targetId);
    const cdp = new Cdp(t.webSocketDebuggerUrl);
    await cdp.open();
    const failed = [];
    cdp.listeners.push((msg) => {
        if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) failed.push(`${msg.params.response.status} ${msg.params.response.url}`);
    });
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
    const url = `${URL_BASE}?nosw&art=${mode}${PXW}`;
    await cdp.send('Page.navigate', { url });
    await cdp.eval(`
        const t0 = performance.now();
        while (!(window.game && game.canvas) && performance.now() - t0 < 15000) await new Promise(r => setTimeout(r, 100));
        try { localStorage.setItem('ea_tutorial_completed', 'true'); } catch (e) {}
        await (document.fonts ? document.fonts.ready : Promise.resolve());
        await new Promise(r => setTimeout(r, 1200));
        // 跳过首次教程
        const skip = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.includes('跳过教程'));
        if (skip) skip.click();
        return true;`, 30000);
    const report = { mode, url, steps: {}, failed };
    report.boot = await cdp.eval(`return {
        htmlClass: document.documentElement.className, pixelArtMode: !!game.pixelArtMode, pixi: !!game._pixiReady,
        canvas: [game.canvas.width, game.canvas.height], logical: [game.width, game.height], layout: game.pixelLayout,
        fontReady: document.fonts ? document.fonts.check('12px "Fusion Pixel 12px Proportional SC"') : null };`);
    for (const [name, script] of Object.entries(STEP_SETS[args.set || 'core'] || STEPS)) {
        let state;
        try { state = await cdp.eval(script); } catch (e) { state = 'ERROR ' + e.message; }
        const file = path.join(OUT, `${mode}_${args.set && args.set !== 'core' ? args.set + '_' : ''}${name}.png`);
        await cdp.shot(file);
        const perf = (name === 'gathering' || name === 'combat') ? await frameStats(cdp) : null;
        report.steps[name] = { state, file: path.relative(process.cwd(), file), perf };
        console.log(`[${mode}] ${name}: ${typeof state === 'string' ? state : JSON.stringify(state)}${perf ? ` loop cpu median ${perf.median}ms p95 ${perf.p95}ms mean ${perf.mean}ms` : ''}`);
    }
    report.assets = await cdp.eval(`
        const res = performance.getEntriesByType('resource').map(e => e.name);
        const imgs = res.filter(n => /\\/assets\\/.*\\.(png|webp|jpg)/.test(n));
        // 像素模式应为空：图标都是程序化像素图（data URL），不下载旧位图
        return { images: imgs.length, originals: imgs.map(n => n.replace(location.origin, '')) };`);
    await browserWs.send('Target.closeTarget', { targetId });
    return report;
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ea-cdp-'));
    const chrome = spawn(CHROME, [
        '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
        '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
        '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`, 'about:blank',
    ], { stdio: 'ignore' });
    try {
        const ver = await getJson(`http://127.0.0.1:${PORT}/json/version`);
        const browserWs = new Cdp(ver.webSocketDebuggerUrl);
        await browserWs.open();
        const reports = [];
        for (const mode of MODES) reports.push(await runMode(browserWs, mode));
        fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(reports, null, 2));
        console.log(`report: ${path.join(OUT, 'report.json')}`);
    } finally {
        chrome.kill();
        await sleep(500);
        try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (_) { /* locked */ }
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
