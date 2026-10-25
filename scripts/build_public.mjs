#!/usr/bin/env node
/**
 * Stage a minimal, publishable copy of the game into ./public.
 *
 * Why this exists: `npm start` used to be `npx serve . -l 3002`, which served
 * the repository root. That exposed internal material (AGENTS.md, TODO.md,
 * docs/, tests/, .cursor/, ...) on the public URL. Railway now builds this
 * service straight from a GitHub branch, so the only thing that may ever be
 * reachable is the whitelist staged here.
 *
 * Invoked automatically by `npm start` (via the `prestart` script), and safe
 * to run repeatedly: ./public is wiped and re-copied on every run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');

/**
 * Everything the static game loads at runtime. Nothing else gets published.
 * `optional: true` entries are skipped when absent instead of failing.
 */
const COPY_PLAN = [
  { from: 'index.html', to: 'index.html' },
  { from: 'serve.json', to: 'serve.json' },
  { from: 'sw.js', to: 'sw.js', optional: true },
  { from: 'favicon.ico', to: 'favicon.ico', optional: true },
  { from: 'src', to: 'src' },
  { from: 'assets', to: 'assets' },
  // src/music_clip_packs.js does `new URL('../docs/architecture/music_processing/clip_pack.json',
  // import.meta.url)`, which resolves to /docs/architecture/music_processing/clip_pack.json
  // at runtime. Without it the clip pack fails to load and logs a warning.
  {
    from: 'docs/architecture/music_processing/clip_pack.json',
    to: 'docs/architecture/music_processing/clip_pack.json',
  },
];

/** Internal paths that must never be reachable from the published root. */
const FORBIDDEN = [
  'AGENTS.md',
  'CLAUDE.md',
  'TODO.md',
  'README.md',
  'package.json',
  'tests',
  'scripts',
  'tools',
  'tasks',
  'skills',
  'artifacts',
  'architecture-graph',
  '.cursor',
  '.git',
  '.railwayignore',
  'docs/work_items',
];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyEntry(entry) {
  const src = path.join(ROOT, entry.from);
  const dest = path.join(PUBLIC_ROOT, entry.to);

  if (!fs.existsSync(src)) {
    if (entry.optional) {
      console.log(`  skip   ${entry.from} (absent, optional)`);
      return { skipped: true, excludedFiles: 0, excludedBytes: 0 };
    }
    throw new Error(`Required publish input is missing: ${entry.from}`);
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const isDir = fs.statSync(src).isDirectory();
  const excluded = { excludedFiles: 0, excludedBytes: 0 };
  const options = { recursive: isDir, force: true };
  if (isDir) {
    options.filter = (from) => {
      const name = path.basename(from);
      if (!isPublishExcluded(name)) return true;
      excluded.excludedFiles += 1;
      try {
        excluded.excludedBytes += fs.statSync(from).size;
      } catch {
        // 统计失败不影响发布：仍然排除该文件
      }
      return false;
    };
  }
  fs.cpSync(src, dest, options);
  console.log(`  copy   ${entry.from} -> ${toPosix(entry.to)}`);
  if (excluded.excludedFiles > 0) {
    console.log(`  drop   ${entry.from}: ${excluded.excludedFiles} files / ${excluded.excludedBytes} bytes (*_raw* source art, not referenced at runtime)`);
  }
  return { skipped: false, ...excluded };
}

/**
 * Art that is never fetched at runtime and must not be published.
 *
 * `assets/**` carries 154 `*_raw.png` (290,248,293 B) + 7 `*_raw_original.png`
 * (10,944,916 B) of source art. Nothing loads them: the only reference anywhere
 * in `src/` is the definition of `getBossSpriteRawConceptPath` in
 * `src/data/boss_sprite_assets.js:86-89`, and that export has zero call sites
 * (likewise `getBossSpriteLegacySheetPath` / `BaseDraftPath` /
 * `HpTranslucencyMaskPath`). Dropping them keeps the published site at the
 * runtime-whitelist intent of this script instead of shipping 300 MB of drafts.
 *
 * Matching is on the file name suffix only, so every non-`_raw` asset under
 * `assets/` (sprites, pixel art, composites, redraw drafts, JSON configs) is
 * still copied byte-for-byte.
 */
const PUBLISH_EXCLUDE = [/_raw\.png$/i, /_raw_original\.png$/i];

function isPublishExcluded(name) {
  return PUBLISH_EXCLUDE.some((re) => re.test(name));
}

/** Recursively collect { files, bytes } for a directory. */
function measure(dir) {
  let files = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const dirent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, dirent.name);
      if (dirent.isDirectory()) {
        stack.push(full);
      } else if (dirent.isFile()) {
        files += 1;
        bytes += fs.statSync(full).size;
      }
    }
  }
  return { files, bytes };
}

function assertNoLeaks() {
  const leaked = FORBIDDEN.filter((rel) => fs.existsSync(path.join(PUBLIC_ROOT, rel)));
  if (leaked.length > 0) {
    throw new Error(
      `Refusing to publish: internal paths present under public/ -> ${leaked.join(', ')}`,
    );
  }
}

function main() {
  // Guard the destructive step: only ever wipe <repo>/public.
  if (PUBLIC_ROOT === ROOT || !PUBLIC_ROOT.startsWith(ROOT + path.sep)) {
    throw new Error(`Unsafe public directory resolved to: ${PUBLIC_ROOT}`);
  }

  console.log('[build_public] staging publishable copy');
  rmrf(PUBLIC_ROOT);
  fs.mkdirSync(PUBLIC_ROOT, { recursive: true });

  const dropped = { files: 0, bytes: 0 };
  for (const entry of COPY_PLAN) {
    const result = copyEntry(entry);
    if (result.excludedFiles) {
      dropped.files += result.excludedFiles;
      dropped.bytes += result.excludedBytes;
    }
  }

  assertNoLeaks();

  const assets = measure(path.join(PUBLIC_ROOT, 'assets'));
  const clipPack = path.join(PUBLIC_ROOT, 'docs/architecture/music_processing/clip_pack.json');
  if (!fs.existsSync(clipPack)) {
    throw new Error('clip_pack.json was not staged; the music clip pack would fail to load');
  }

  const total = measure(PUBLIC_ROOT);
  console.log('[build_public] done');
  console.log(`  assets  ${assets.files} files / ${assets.bytes} bytes`);
  console.log(`  dropped ${dropped.files} files / ${dropped.bytes} bytes (excluded by PUBLISH_EXCLUDE)`);
  console.log(`  total   ${total.files} files / ${total.bytes} bytes`);
  console.log(`  output  ${PUBLIC_ROOT}`);
}

try {
  main();
} catch (error) {
  console.error(`[build_public] FAILED: ${error.message}`);
  process.exitCode = 1;
}
