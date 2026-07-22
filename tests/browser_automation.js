'use strict';

const fs = require('fs');

function tryRequire(name) {
    try {
        return require(name);
    } catch (_error) {
        return null;
    }
}

function findChromeExecutable() {
    const candidates = [
        process.env.CHROME_PATH,
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean);
    return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

const EXTERNAL_FONT_URL = /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//;
const PIXI_CDN_URL = 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js';
const PIXI_CANVAS_FALLBACK = '/* UI regression: exercise the application\'s documented Canvas 2D fallback. */';

async function installPuppeteerExternalFallbacks(page) {
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (EXTERNAL_FONT_URL.test(request.url())) {
            request.respond({ status: 204, contentType: 'text/css', body: '' });
            return;
        }
        if (request.url() === PIXI_CDN_URL) {
            request.respond({ status: 200, contentType: 'application/javascript', body: PIXI_CANVAS_FALLBACK });
            return;
        }
        request.continue();
    });
}

async function installPlaywrightExternalFallbacks(page) {
    await page.route(EXTERNAL_FONT_URL, route => route.fulfill({ status: 204, contentType: 'text/css', body: '' }));
    await page.route(PIXI_CDN_URL, route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: PIXI_CANVAS_FALLBACK,
    }));
}

function adaptPlaywrightPage(rawPage) {
    return new Proxy(rawPage, {
        get(target, property) {
            if (property === 'waitForFunction') {
                return (pageFunction, options = {}, ...args) => target.waitForFunction(
                    pageFunction,
                    args.length > 0 ? args[0] : undefined,
                    options
                );
            }
            if (property === 'setViewport') {
                return viewport => target.setViewportSize({
                    width: viewport.width,
                    height: viewport.height,
                });
            }
            if (property === 'goto') {
                return (url, options = {}) => target.goto(url, {
                    ...options,
                    waitUntil: options.waitUntil === 'networkidle0' ? 'networkidle' : options.waitUntil,
                });
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}

async function createBrowserSession({ headless, defaultViewport }) {
    const puppeteer = tryRequire('puppeteer');
    let puppeteerLaunchError = null;
    if (puppeteer) {
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: headless ? 'new' : false,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
                defaultViewport,
            });
            const page = await browser.newPage();
            return {
                browser,
                page,
                driverName: 'puppeteer',
                installOfflineExternalFallbacks: () => installPuppeteerExternalFallbacks(page),
                close: () => browser.close(),
            };
        } catch (error) {
            puppeteerLaunchError = error;
            await browser?.close().catch(() => {});
        }
    }

    const playwright = tryRequire('playwright');
    if (!playwright?.chromium) {
        throw new Error(
            `未找到可启动的浏览器驱动。请安装 puppeteer，或提供可解析的 playwright（Codex 可通过 NODE_PATH 复用 bundled runtime）。${puppeteerLaunchError ? ` Puppeteer: ${puppeteerLaunchError.message}` : ''}`
        );
    }

    const launchOptions = {
        headless: !!headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    };
    let browser;
    try {
        browser = await playwright.chromium.launch(launchOptions);
    } catch (error) {
        const executablePath = findChromeExecutable();
        if (!executablePath || !/Executable doesn't exist|browser.*not found/i.test(String(error?.message || error))) {
            throw error;
        }
        browser = await playwright.chromium.launch({ ...launchOptions, executablePath });
    }
    const context = await browser.newContext({ viewport: defaultViewport });
    const rawPage = await context.newPage();
    return {
        browser,
        context,
        page: adaptPlaywrightPage(rawPage),
        driverName: 'playwright',
        installOfflineExternalFallbacks: () => installPlaywrightExternalFallbacks(rawPage),
        close: () => browser.close(),
    };
}

module.exports = { createBrowserSession };
