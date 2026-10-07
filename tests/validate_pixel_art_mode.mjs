/**
 * validate_pixel_art_mode.mjs — 像素风模式（REQ-20261006-pixel-art）契约与单元校验
 *
 * Usage: node tests/validate_pixel_art_mode.mjs
 * 覆盖：模式判定与图标解析（含反向断言）、像素布局整数倍、像素字体/图标字形、
 * 程序化敌人精灵与菜单图标（确定性、描边、无越界色、覆盖全部遗物/技能/图标路径）、
 * 生成样式（无 url()、调色板映射最新）、繁简/乱码/转义清零、
 * 关键接线（入口顺序、HUD 顶栏常量、各绘制入口的像素分支、旧 DOM HUD 隐藏、图标解析与 emoji 替换启动）。
 * 画面效果本身由 tools/pixel_art/capture_screens.mjs 的无头截图验收（不在本脚本）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

let passed = 0;
let failed = 0;
function check(cond, msg) {
    if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); }
}

function pngSize(rel) {
    const buf = fs.readFileSync(path.join(repoRoot, rel));
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

console.log('== 模式判定与图标解析 ==');
const art = await import('../src/render/art_mode.js');
const sample = '/assets/icons/relic/pink_slime.png?v=1';
art._setArtModeForTest('pixel');
check(art.resolveArtSrc(sample) === sample, '像素模式、未注册解析器：路径原样返回（不会指向任何旧位图副本）');
art.setArtSrcResolver((src) => (src.includes('icons/relic/') ? 'data:image/png;base64,PIXEL' : null));
check(art.resolveArtSrc(sample) === 'data:image/png;base64,PIXEL', '像素模式：图标路径交给程序化图标解析器');
check(art.resolveArtSrc('/assets/sprites/bosses/boss_ignis.png') === '/assets/sprites/bosses/boss_ignis.png', '解析器不认识的路径原样返回');
art._setArtModeForTest('bitmap');
// 反向断言：位图模式必须原样返回（若解析漏了模式判断，这条会红）
check(art.resolveArtSrc(sample) === sample, '位图模式：即使注册了解析器也原样返回');
art._setArtModeForTest('pixel');
art.setArtSrcResolver(null);
check(!fs.existsSync(path.join(repoRoot, 'assets/px')) && !fs.existsSync(path.join(repoRoot, 'src/data/pixel_asset_manifest.js')), '旧位图的自动像素化副本已删除（assets/px 与其清单）');

console.log('== 像素布局 ==');
const pc = await import('../src/render/pixel_canvas.js');
for (const [w, h, dpr] of [[430, 765, 2], [430, 765, 3], [480, 853, 1], [375, 667, 2], [480, 853, 1.25]]) {
    const L = pc.computePixelLayout(w, h, dpr, 288);
    const devW = w * dpr;
    check(Number.isInteger(L.k) && L.k >= 1, `${w}x${h}@${dpr}: k=${L.k} 为整数`);
    check(Math.abs(L.bufW * L.k - devW) <= L.k, `${w}x${h}@${dpr}: 缓冲 ${L.bufW}×${L.k} ≈ 设备宽 ${devW}`);
    check(L.bufW >= 200 && L.bufW <= 360, `${w}x${h}@${dpr}: 美术像素宽 ${L.bufW} 在目标区间`);
    check(Math.abs(L.sx * w - L.bufW) < 1e-6, `${w}x${h}@${dpr}: sx 把逻辑宽精确映射到缓冲宽`);
}

console.log('== 像素字体与图标字形 ==');
const font = await import('../src/pixel/pixel_font.js');
for (const [name, f] of Object.entries(font.PIXEL_FONTS)) {
    let ok = true;
    for (const [ch, rows] of Object.entries(f.glyphs)) {
        if (rows.length !== f.h || rows.some((r) => r.length !== rows[0].length) || rows.some((r) => /[^#.]/.test(r))) { ok = false; console.log(`    bad glyph ${name} '${ch}'`); }
    }
    check(ok, `${name}：每个字形行数=${f.h}、行宽一致、只含 #/.`);
    check('0123456789'.split('').every((d) => f.glyphs[d]), `${name}：数字齐全`);
}
const icons = await import('../src/pixel/icons.js');
const palette = await import('../src/pixel/palette.js');
check(Object.values(icons.ICON_ROWS).every((rows) => rows.length === 7 && rows.every((r) => r.length === 7 && /^[.bcd]+$/.test(r))), '图标全部为 7×7 且只含 . b c d');
check(Object.values(icons.ATTRIBUTE_STYLE).every((s) => palette.RAMPS[s.ramp] && icons.ICON_ROWS[s.icon]), '属性样式引用的色阶与图标都存在');
check(Object.values(icons.AFFIX_STYLE).every((s) => palette.RAMPS[s.ramp] && icons.ICON_ROWS[s.icon]), '词条样式引用的色阶与图标都存在');
check(Object.values(palette.RAMPS).flat().every((hex) => /^#[0-9a-f]{6}$/.test(hex)), '调色板全部为 #rrggbb');
const { CONFIG } = await import('../src/config.js');
const display = CONFIG.ui.attributeDisplay;
check(Object.keys(icons.ATTRIBUTE_STYLE).filter((k) => display[k]).every((k) => display[k].name === icons.ATTRIBUTE_STYLE[k].name), '像素属性名与配置 attributeDisplay 名称一致（唯一术语）');

console.log('== 程序化敌人精灵 ==');
const es = await import('../src/pixel/enemy_sprites.js');
const allowed = new Set(Object.values(palette.RAMPS).flat().concat([palette.INK]).map((h) => h.toLowerCase()));
const unpack = (v) => '#' + [v & 255, (v >>> 8) & 255, (v >>> 16) & 255].map((n) => n.toString(16).padStart(2, '0')).join('');
for (const arch of es.ENEMY_ARCHETYPE_IDS) {
    const sizes = arch === 'boss' ? [[112, 74]] : [[38, 38], [76, 38], [114, 76]];
    for (const [w, h] of sizes) {
        const a = es.buildEnemyRaster(arch, w, h, 7, arch === 'residue', arch === 'boss' ? 'fire' : undefined);
        const b = es.buildEnemyRaster(arch, w, h, 7, arch === 'residue', arch === 'boss' ? 'fire' : undefined);
        let solid = 0;
        let off = 0;
        let ink = 0;
        for (const v of a.px) {
            if (!(v >>> 24)) continue;
            solid++;
            const hex = unpack(v);
            if (hex === palette.INK) ink++;
            if (!allowed.has(hex)) off++;
        }
        check(Buffer.compare(Buffer.from(a.px.buffer), Buffer.from(b.px.buffer)) === 0, `${arch} ${w}x${h}：同参数逐字节一致`);
        check(solid > w * h * 0.25, `${arch} ${w}x${h}：主体占比 ${(solid / (w * h) * 100).toFixed(0)}%`);
        check(ink > 0, `${arch} ${w}x${h}：有 INK 描边`);
        check(off === 0, `${arch} ${w}x${h}：所有像素都来自调色板（越界 ${off}）`);
    }
}

console.log('== 程序化图标（取代旧位图） ==');
const A = await import('../src/pixel/art_objects.js');
const reg = await import('../src/pixel/art_registry.js');
const regData = await import('../src/pixel/art_registry_data.js');
const bi = await import('../src/bitmap_icons.js');
const { RELIC_DB, SKILL_DB } = await import('../src/config.js');
const rasterOk = (r, label) => {
    let solid = 0;
    let off = 0;
    let ink = 0;
    for (const v of r.px) {
        if (!(v >>> 24)) continue;
        solid++;
        const hex = unpack(v);
        if (hex === palette.INK) ink++;
        if (!allowed.has(hex)) off++;
    }
    return { solid, off, ink, ok: solid > r.w * r.h * 0.12 && off === 0 && ink > 0 };
};
const missingRelics = RELIC_DB.filter((r) => !A.hasRelicSpec(r.id)).map((r) => r.id);
check(missingRelics.length === 0, `全部 ${RELIC_DB.length} 件遗物都有程序化图标（缺：${missingRelics.join(',') || '无'}）`);
const missingMapped = Object.keys(bi.RELIC_ICON_MAP).filter((id) => !A.hasRelicSpec(id) && !id.startsWith('skill_'));
check(missingMapped.length === 0, `旧遗物图标表里的条目都有程序化图标（缺：${missingMapped.join(',') || '无'}）`);
const missingSkills = SKILL_DB.filter((sk) => !regData.SKILL_GLYPH[sk.id]).map((sk) => sk.id);
check(missingSkills.length === 0, `全部 ${SKILL_DB.length} 个技能都有像素印记（缺：${missingSkills.join(',') || '无'}）`);
let relicBad = [];
for (const id of A.RELIC_OBJECT_IDS) {
    const a = A.drawRelic(id);
    const b = A.drawRelic(id);
    const q = rasterOk(a, id);
    if (!q.ok || Buffer.compare(Buffer.from(a.px.buffer), Buffer.from(b.px.buffer)) !== 0) relicBad.push(`${id}(实心${q.solid} 越界色${q.off} 描边${q.ink})`);
}
check(relicBad.length === 0, `遗物物件：确定性、只用调色板色、有 INK 描边、主体非空（问题：${relicBad.join(' ') || '无'}）`);
const marbleBad = Object.keys(bi.AMMO_ICON_MAP).filter((k) => !rasterOk(A.drawMarble(k === 'normal' || k === 'default' ? 'white' : k)).ok);
check(marbleBad.length === 0, `弹珠图标覆盖全部弹药类型且只用调色板色（问题：${marbleBad.join(',') || '无'}）`);
const pathsToCover = [
    ...Object.values(bi.AMMO_ICON_MAP), ...Object.values(bi.ATTRIBUTE_ICON_MAP), ...Object.values(bi.RUNE_ICON_MAP),
    ...Object.values(bi.RELIC_ICON_MAP), ...Object.values(bi.ENEMY_AFFIX_ICON_MAP), ...Object.values(bi.LOOT_CAPSULE_MAP),
    ...Object.values(bi.ENEMY_V2_ICON_MAP),
    ...Object.values(bi.BOSS_PREVIEW_ICON_MAP).flatMap((e) => [e.preview, e.tiny]),
].filter(Boolean);
const uncovered = [...new Set(pathsToCover.filter((p) => !reg.isArtPath(p)))];
check(uncovered.length === 0, `代码里引用的 ${new Set(pathsToCover).size} 个图标路径都由程序化图标接管（未接管：${uncovered.slice(0, 6).join(', ') || '无'}）`);
const badEmoji = Object.entries(regData.EMOJI_ICON).filter(([, [g, r]]) => !icons.ICON_ROWS[g] || !palette.RAMPS[r]).map(([k]) => k);
check(badEmoji.length === 0, `emoji → 点阵图标映射引用的字形与色阶都存在（问题：${badEmoji.join(' ') || '无'}）`);
check(regData.emojiIconSpec('⚡️') && regData.emojiIconSpec('🛡️') && !regData.emojiIconSpec('→'), 'emoji 规范化（去变体符）；单色文字符号不替换');
{
    const sys = read('src/systems.js');
    const wrong = Object.entries(icons.AFFIX_STYLE).filter(([id, st]) => {
        const m = new RegExp(`'${id}':\\s*\\{\\s*name:\\s*'([^']*)'`).exec(sys);
        return m && !m[1].endsWith(st.name);
    }).map(([id]) => id);
    check(wrong.length === 0, `词条名称与玩家可见词条说明（affixDict）逐字一致（不一致：${wrong.join(',') || '无'}）`);
}
const pxCss = read('src/styles/pixel_assets.css');
check(!/url\(/.test(pxCss.replace(/\/\*[\s\S]*?\*\//g, '')) && pxCss.includes('var(--pxa-'), '像素模式样式覆盖层不含任何 url()：图标走 --pxa- 变量，框体为 none');
try {
    execFileSync('python', ['tools/pixel_art/gen_palette_css.py', '--check'], { cwd: repoRoot, stdio: 'pipe' });
    check(true, 'gen_palette_css.py --check：Tailwind 颜色 → 像素调色板映射是最新的');
} catch (e) {
    check(false, `gen_palette_css.py --check 失败：${String(e.stdout || e.message).slice(0, 200)}`);
}
try {
    execFileSync('python', ['tools/pixel_art/unescape_cjk.py', '--scan'], { cwd: repoRoot, stdio: 'pipe' });
    const out = String(execFileSync('python', ['tools/pixel_art/unescape_cjk.py', '--scan'], { cwd: repoRoot, stdio: 'pipe' })).trim();
    check(out === '', '源码里没有 \\u 转义的中文（转义会躲过繁简与乱码检查）');
} catch (e) {
    check(false, `unescape_cjk.py --scan 失败：${String(e.message).slice(0, 200)}`);
}
try {
    execFileSync('python', ['tools/pixel_art/gen_pixel_css.py', '--check'], { cwd: repoRoot, stdio: 'pipe' });
    check(true, 'gen_pixel_css.py --check：生成的 CSS 覆盖层是最新的');
} catch (e) {
    check(false, `gen_pixel_css.py --check 失败：${String(e.stdout || e.message).slice(0, 200)}`);
}
try {
    const out = execFileSync('python', ['tools/pixel_art/t2s.py', '--scan'], { cwd: repoRoot, stdio: 'pipe' });
    check(String(out).trim() === '', '繁体对照表内字符、已知乱码与 GB2312 外汉字在 index.html / src / tests 中均已清零');
} catch (e) {
    check(false, `t2s.py --scan 失败：${String(e.message).slice(0, 200)}`);
}

console.log('== 接线契约 ==');
const indexHtml = read('index.html');
const headScript = indexHtml.indexOf("classList.add('art-' + mode)");
check(headScript > 0 && headScript < indexHtml.indexOf('cdn.tailwindcss.com'), '<head> 首帧前写入 art-pixel / art-bitmap 类');
const bootIdx = indexHtml.indexOf("import './src/render/art_boot.js';");
check(bootIdx > 0 && bootIdx < indexHtml.indexOf("from './src/core.js';"), '入口先 import art_boot 再 import core（图片路径兜底先就位）');
check(indexHtml.includes('pixel_theme.css') && indexHtml.includes('pixel_assets.css'), '像素主题与资源覆盖样式已链接');
check(indexHtml.includes('pixel_palette.css'), '像素模式链接 Tailwind 颜色 → 调色板映射');
{
    const boot = read('src/render/art_boot.js');
    check(/setArtSrcResolver\(artUrlForPath\)/.test(boot) && /installEmojiIcons/.test(boot) && /pixelCssVarName/.test(boot), 'art_boot：注册图标解析器、设置 --pxa- 变量、启动 emoji → 像素图标');
    check(/artCanvasForSrc/.test(read('src/render/pixel_canvas.js')), '画布 drawImage 遇到程序化图标时换回美术分辨率画布（不被平滑缩放）');
    check(/if \(this\.pixelArtMode\) \{[\s\S]{0,200}buildPixelAmmoCard\(/.test(read('src/ui_system.js')), '替换弹药页在像素模式使用重做的子弹卡');
    const leftovers = ['src/bitmap_icons.js', 'src/render/art_mode.js', 'src/render/pixel_canvas.js', 'index.html'].filter((f) => read(f).includes('assets/px'));
    check(leftovers.length === 0, `运行时代码不再引用 assets/px（残留：${leftovers.join(',') || '无'}）`);
}
check(indexHtml.includes('id="pause-art-mode-row"') && indexHtml.includes('game.sys_toggleArtMode'), '暂停菜单提供像素画风开关');
const gs = read('src/game_system.js');
check(/this\.pixelArtMode\s*\?\s*PIXEL_HUD_TOP_CSS/.test(gs), 'sys_resize 用 PIXEL_HUD_TOP_CSS 计算战斗网格顶部（与画布顶栏一致）');
check(/if \(this\.pixelArtMode\) drawPixelHud\(this, this\.ctx\)/.test(gs), '主循环在像素模式下绘制画布 HUD');
check(/this\.canvas\.width = this\.pixelLayout\.bufW/.test(gs), '像素模式后备缓冲 = 美术像素网格');
const core = read('src/core.js');
check(/this\._pixiReady = this\.pixelArtMode \? false : pixiInit\(\)/.test(core), '像素模式不初始化 PixiJS（全部走 Canvas 2D）');
check(/applyPixelPaletteToConfig\(CONFIG\)/.test(core), '像素模式启动时统一配置色到调色板');
const enemyJs = read('src/entities/enemy.js');
check(/if \(isPixelArtMode\(\)\) \{\s*pxDrawEnemy\(ctx, this\);/.test(enemyJs), 'Enemy.draw 像素分支');
check(/function _getAffixOverlayImage\(src\) \{\s*if \(!src \|\| typeof Image === 'undefined'\) return null;\s*(\/\/[^\n]*\n\s*)?if \(isPixelArtMode\(\)\) return null;/.test(enemyJs),
    '像素模式不下载敌人位图（框体/词缀叠层/弱点/护盾膜/防御图标共用的加载口已拦截）');
{
    const i = enemyJs.indexOf('initSprite() {');
    const body = enemyJs.slice(i, enemyJs.indexOf('createSpriteRenderer(', i));
    check(i > 0 && /if \(isPixelArtMode\(\)\) return;/.test(body), '像素模式 initSprite 不创建位图 SpriteRenderer（不加载敌人/首领精灵表）');
}
{
    const hc = read('src/pixel/hud_combat.js');
    check(hc.includes("target: '#skill-editor-open-btn'") && indexHtml.includes('id="skill-editor-open-btn"'),
        '画布 HUD 提供「技能装配」入口（原按钮所在底栏在像素模式隐藏）');
}
try {
    const out = String(execFileSync('python', ['-c',
        "import sys; sys.path.insert(0, 'tools/pixel_art'); import t2s; print('\u9f63' in t2s.TABLE, ''.join(sorted(t2s.outside_gb2312('连续获取\u9f63'))))"],
        { cwd: repoRoot, stdio: 'pipe', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })).trim();
    check(out === 'False ' + String.fromCharCode(0x9f63), `t2s 的 GB2312 外字检测独立于对照表（表外繁体字 U+9F63 也会被报出）：${out}`);
} catch (e) {
    check(false, `t2s 外字检测自检失败：${String(e.message).slice(0, 200)}`);
}
check(/if \(isPixelArtMode\(\)\) \{\s*pxDrawProjectile\(ctx, this\);/.test(read('src/entities/projectile.js')), 'Projectile.draw 像素分支');
check(/isPixelArtMode\(\) && pxDrawPeg\(ctx, this, baseRadius\)/.test(read('src/entities.js')), 'Peg.draw 像素分支');
const rs = read('src/render_system.js');
check(rs.includes('pxDrawBackground(this, this.ctx)') && rs.includes('pxDrawCombatWalls(this, ctx') && rs.includes('pxDrawDefeatLine(this, ctx)') && rs.includes('pxDrawLauncher('), '场景层（背景/墙/防线/发射器）像素分支');
const theme = read('src/styles/pixel_theme.css');
check(/html\.art-pixel #unified-top-bar,[\s\S]{0,200}#combat-bottom-dock[\s\S]{0,200}display: none !important;/.test(theme), '像素模式隐藏旧 DOM HUD（避免两处数值）');
check(/html\.art-pixel #round-start-banner-card::before,\s*html\.art-pixel \.round-start-threat \{\s*background-image: none !important;/.test(theme), '回合横幅旧位图在像素模式首帧即关闭（不依赖 px-kit-ready，不会先下载）');
for (const k of ['canvas.width', 'canvas.height']) {
    const hits = (read('src/combat_system.js').match(new RegExp(`this\\.${k.replace('.', '\\.')}`, 'g')) || []).length;
    check(hits === 0, `combat_system.js 不再用 this.${k} 当逻辑尺寸（像素模式下它是缓冲尺寸）`);
}

console.log(`\nResult: ${passed}/${passed + failed} passed`);
if (failed) process.exit(1);
