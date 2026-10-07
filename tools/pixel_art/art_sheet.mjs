/**
 * art_sheet.mjs — 把程序化像素物件渲染成一张预览图（Node 直跑，零依赖 PNG 编码）
 *
 *   node tools/pixel_art/art_sheet.mjs [--out tmp/codex/REQ-20261006-pixel-art/art_sheet.png] [--scale 4]
 *
 * 用于人工审图：所有遗物、弹珠、属性徽记、条签、词条徽记、符文、技能印记、胶囊、首领封印。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Raster } from '../../src/pixel/raster.js';
import * as A from '../../src/pixel/art_objects.js';
import { ATTRIBUTE_STYLE, AFFIX_STYLE } from '../../src/pixel/icons.js';
import { SKILL_GLYPH, skillRampOf } from '../../src/pixel/art_registry_data.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
    return acc;
}, []));
const OUT = path.resolve(args.out || 'tmp/codex/REQ-20261006-pixel-art/art_sheet.png');
const SCALE = Number(args.scale || 4);

function crc32(buf) {
    let c;
    const table = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        return c >>> 0;
    }));
    let crc = 0xffffffff;
    for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}

export function encodePng(w, h, rgba) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = 0;
        rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const groups = [];
groups.push(['relics', A.RELIC_OBJECT_IDS.map((id) => A.drawRelic(id))]);
const marbleTypes = ['white', 'pyro', 'cryo', 'lightning', 'venom', 'wind', 'laser', 'pierce', 'bounce', 'scatter', 'damage', 'explosive', 'resonance', 'echo', 'overcharge', 'flying_sword', 'matryoshka', 'rainbow'];
groups.push(['marbles', marbleTypes.map((t) => A.drawMarble(t))]);
groups.push(['attr badges', Object.entries(ATTRIBUTE_STYLE).map(([, s]) => A.drawAttributeBadge(s.icon, s.ramp)).concat([A.drawAttributeBadge('hollow', 'slate', true)])]);
groups.push(['attr chips', Object.entries(ATTRIBUTE_STYLE).map(([, s]) => A.drawAttributeChip(s.icon, s.ramp))]);
groups.push(['affixes', Object.entries(AFFIX_STYLE).map(([, s]) => A.drawAffixBadge(s.icon, s.ramp))]);
const runeAttrs = ['pyro', 'cryo', 'lightning', 'bounce', 'pierce', 'scatter', 'laser', 'venom', 'overcharge', 'echo'];
groups.push(['runes', runeAttrs.flatMap((k, i) => [1, 2].map((lvl) => A.drawRune(ATTRIBUTE_STYLE[k].icon, ATTRIBUTE_STYLE[k].ramp, lvl, i + 1)))]);
groups.push(['skills', Object.keys(SKILL_GLYPH).map((id) => A.drawSkillSigil(SKILL_GLYPH[id], skillRampOf(id)))]);
groups.push(['misc', [A.drawCapsule('arcane'), A.drawCapsule('slate'), A.drawCapsule('brass'), A.drawPlaque(), A.drawUnknownSeal()]]);

const PAD = 4;
const COLS = 12;
const cell = 34;
let H = 0;
const rows = [];
for (const [name, list] of groups) {
    const n = Math.ceil(list.length / COLS);
    rows.push({ name, list, y: H });
    H += n * (cell + PAD) + PAD;
}
const W = COLS * (cell + PAD) + PAD;
const sheet = new Raster(W, H);
sheet.rect(0, 0, W, H, '#1b1e26');
for (const row of rows) {
    row.list.forEach((r, i) => {
        const cx = PAD + (i % COLS) * (cell + PAD);
        const cy = row.y + PAD + Math.floor(i / COLS) * (cell + PAD);
        sheet.rect(cx, cy, cell, cell, (i % 2) ? '#262a33' : '#2c303a');
        sheet.blit(r, cx + ((cell - r.w) >> 1), cy + ((cell - r.h) >> 1));
    });
}
const big = Buffer.alloc(W * SCALE * H * SCALE * 4);
const src = Buffer.from(sheet.px.buffer);
for (let y = 0; y < H * SCALE; y++) {
    for (let x = 0; x < W * SCALE; x++) {
        const si = ((Math.floor(y / SCALE) * W) + Math.floor(x / SCALE)) * 4;
        src.copy(big, (y * W * SCALE + x) * 4, si, si + 4);
    }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodePng(W * SCALE, H * SCALE, big));
console.log(`wrote ${OUT} (${W * SCALE}x${H * SCALE}); groups: ${groups.map(([n, l]) => `${n}=${l.length}`).join(', ')}`);
