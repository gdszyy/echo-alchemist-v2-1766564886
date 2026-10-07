/**
 * shot.mjs — 单页无头截图（零依赖 CDP）。用于 sprite_lab.html 等工具页。
 *   node tools/pixel_art/shot.mjs <url> <out.png> [width] [height] [dpr]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, out, w = '960', h = '1000', dpr = '1'] = process.argv.slice(2);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(u) {
    for (let i = 0; i < 50; i++) {
        try { const r = await fetch(u); if (r.ok) return r.json(); } catch (_) { /* wait */ }
        await sleep(200);
    }
    throw new Error('chrome did not start');
}

const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ea-shot-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
try {
    const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => { ws.onopen = r; });
    let id = 0;
    const pending = new Map();
    const logs = [];
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('ERR ' + m.params.args.map((a) => a.value || a.description).join(' '));
    };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: false });
    await send('Page.navigate', { url });
    for (let i = 0; i < 60; i++) {
        const r = await send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true });
        if (r.result?.result?.value) break;
        await sleep(200);
    }
    await sleep(300);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    if (logs.length) console.log(logs.join('\n'));
    console.log('saved', out);
    ws.close();
} finally {
    chrome.kill();
    await sleep(300);
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (_) { /* locked */ }
}
