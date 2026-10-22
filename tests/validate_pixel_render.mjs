/**
 * tests/validate_pixel_render.mjs — R1 像素渲染底座校验
 * 运行：node tests/validate_pixel_render.mjs
 *
 * - computePixelScale：DPR 1 / 2 / 2.625 / 3 × 宽 375 / 390 / 430 / 480（9:16 容器）
 * - getDamageTier 档位边界（§4.3）
 * - 像素字体字符表完整性与点阵尺寸
 * - 源码契约：resize 后关闭平滑、Pixi 无 LINEAR、CRT 默认关、世界 pass 走低清缓冲
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computePixelScale } from '../src/render/pixel_scale.js';
import {
    PIXEL_GLYPHS_3x5, PIXEL_GLYPHS_5x7, PIXEL_FONT_REQUIRED_CHARS,
    getDamageTier, canRenderPixelText, parseDamageValue, layoutPixelText,
} from '../src/render/pixel_font.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

let passed = 0, failed = 0;
const failures = [];
function check(cond, name) {
    if (cond) passed++;
    else { failed++; failures.push(name); }
}

console.log('R1 pixel render validation');

// ── computePixelScale ──────────────────────────────────────────
for (const dpr of [1, 2, 2.625, 3]) {
    for (const cssW of [375, 390, 430, 480]) {
        const cssH = Math.round(cssW * 16 / 9);
        const s = computePixelScale({ cssW, cssH, dpr });
        const tag = `dpr ${dpr} w ${cssW}`;
        check(Number.isInteger(s.k) && s.k >= 2, `${tag}: k is integer >= 2`);
        check(s.k === Math.max(2, Math.round(2 * dpr)), `${tag}: k = max(2, round(2*dpr))`);
        check(s.backingW === s.logicalW * s.k && s.backingH === s.logicalH * s.k, `${tag}: backing == logical * k`);
        check(Math.abs(s.artPerCss - dpr / s.k) < 1e-12, `${tag}: artPerCss = dpr / k`);
        check(s.cssW <= cssW + 1e-9 && s.cssH <= cssH + 1e-9, `${tag}: CSS size fits container`);
        check((cssW - s.cssW) * dpr < s.k && (cssH - s.cssH) * dpr < s.k, `${tag}: letterbox < k device px`);
        // 1 美术像素 ≈ 2 CSS px（A1）
        const cssPerArt = 1 / s.artPerCss;
        check(cssPerArt >= 1.6 && cssPerArt <= 2.4, `${tag}: art pixel ≈ 2 CSS px (${cssPerArt.toFixed(3)})`);
    }
}
{
    const s = computePixelScale({ cssW: 375, cssH: 667, dpr: 2 });
    check(s.k === 4 && s.logicalW === 187 && s.logicalH === 333, 'spec example: 375 @ DPR2 → k4, 187×333');
    const s3 = computePixelScale({ cssW: 480, cssH: 853, dpr: 1 });
    check(s3.k === 2 && s3.logicalW === 240, 'spec example: PC 480 → 240 wide');
    const bad = computePixelScale({ cssW: 0, cssH: NaN, dpr: 0 });
    check(bad.logicalW >= 1 && bad.logicalH >= 1 && bad.k === 2, 'degenerate input stays safe');
}

// ── getDamageTier ─────────────────────────────────────────────
const tierOf = (v) => getDamageTier(v).tier;
check(tierOf(0) === 1 && tierOf(14) === 1 && tierOf(14.9) === 1, 'T1: < 15');
check(tierOf(15) === 2 && tierOf(44) === 2, 'T2: 15–44');
check(tierOf(45) === 3 && tierOf(99) === 3, 'T3: 45–99');
check(tierOf(100) === 4 && tierOf(99999) === 4, 'T4: >= 100');
check(tierOf(-120) === 4, 'tier uses absolute value');
check(tierOf(NaN) === 1, 'non-finite falls back to T1');
check(getDamageTier(50).outline8 && !getDamageTier(20).outline8, 'T3+ uses heavy outline');
check(getDamageTier(150).bump && !getDamageTier(60).bump, 'only T4 bumps');
check(getDamageTier(60).scale === 2 && getDamageTier(30).scale === 1, 'T3+ is large (integer scale 2)');

// ── glyph tables ──────────────────────────────────────────────
for (const [name, table, w, h] of [['3x5', PIXEL_GLYPHS_3x5, 3, 5], ['5x7', PIXEL_GLYPHS_5x7, 5, 7]]) {
    for (const ch of PIXEL_FONT_REQUIRED_CHARS) {
        const g = table[ch];
        check(Array.isArray(g) && g.length === h, `${name}: '${ch}' has ${h} rows`);
        check(g && g.every(row => row.length === w && /^[01]+$/.test(row)), `${name}: '${ch}' rows are ${w} wide binary`);
        check(g && g.some(row => row.includes('1')), `${name}: '${ch}' is not empty`);
    }
}
check(canRenderPixelText('-37') && canRenderPixelText('−12') && canRenderPixelText('+5%') && canRenderPixelText('x3'), 'damage-like texts render with pixel font');
check(!canRenderPixelText('暴击!') && !canRenderPixelText('Burn 12'), 'non-numeric texts keep legacy rendering');
check(parseDamageValue('-37') === 37 && parseDamageValue('1.2k') === 1200, 'parseDamageValue');
{
    const l = layoutPixelText('-37', 'medium');
    check(l.w === 17 && l.h === 7 && l.mask.length === 17 * 7, 'layout width = glyphs + 1px spacing');
}

// ── 源码契约 ──────────────────────────────────────────────────
const gameSystem = read('src/game_system.js');
const pixiBridge = read('src/render/pixi_bridge.js');
const coreJs = read('src/core.js');
const indexHtml = read('index.html');
const uiSystem = read('src/ui_system.js');
check(/sys_resize\s*\(\)\s*\{[\s\S]{0,2400}this\.canvas\.width\s*=\s*pixelScale\.backingW[\s\S]{0,800}imageSmoothingEnabled\s*=\s*false/.test(gameSystem), 'imageSmoothingEnabled = false re-asserted after resize');
check(/this\.width\s*=\s*pixelScale\.cssW/.test(gameSystem), 'game.width stays in CSS px');
check(/setTransform\(_a,\s*0,\s*0,\s*_a,\s*0,\s*0\)/.test(gameSystem), 'world pass draws into buffer with artPerCss transform');
check(/sys_blitPixelBuffer\s*\(\)\s*\{[\s\S]{0,600}imageSmoothingEnabled\s*=\s*false[\s\S]{0,300}drawImage\(buffer,\s*0,\s*0,\s*backingW,\s*backingH\)/.test(gameSystem), 'single nearest blit buffer → screen');
check(/this\.screenCtx\s*=\s*this\.ctx;[\s\S]{0,200}this\.ctx\s*=\s*this\.pixelBufferCanvas\.getContext\('2d'\)/.test(coreJs), 'this.ctx points to low-res buffer, screenCtx keeps main canvas');
check(!/SCALE_MODES\.LINEAR/.test(pixiBridge) && !/SCALE_MODES\.LINEAR/.test(read('src/render/pixi_effect_adapter.js')), 'no SCALE_MODES.LINEAR left in Pixi layer');
check(/autoDensity:\s*false/.test(pixiBridge) && /resolution:\s*1,/.test(pixiBridge), 'Pixi renders at logical resolution (res 1, no autoDensity)');
check(/stage\.scale\.set\(s\.artPerCss\)/.test(pixiBridge), 'Pixi stage uses same artPerCss transform');
check(/image-rendering:\s*pixelated/.test(indexHtml), 'CSS image-rendering: pixelated');
check(/isCrtOn\s*=\s*localStorage\.getItem\('ea_crt_enabled'\)\s*===\s*'true'/.test(indexHtml), 'CRT default off (index.html)');
check(/isCrtOn\s*=\s*localStorage\.getItem\('ea_crt_enabled'\)\s*===\s*'true'/.test(uiSystem), 'CRT default off (pause settings sync)');
check(!/ea_crt_enabled'\)\s*!==\s*'false'/.test(indexHtml + uiSystem), 'no legacy CRT default-on check left');
check(!/this\.canvas\.(width|height)/.test(read('src/combat_system.js') + read('src/spawn_system.js')), 'gameplay code reads CSS size via this.width/height, not backing size');

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length) {
    console.log('\n  Failed checks:');
    failures.forEach(f => console.log(`    - ${f}`));
}
console.log('===================================================');
process.exit(failed > 0 ? 1 : 0);
