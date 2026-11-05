// Prints raw and gzip/brotli sizes of the production build, checks the size budget, and checks that every page only
// asks for build files that exist (a page asking for a missing one logs an error for every visitor).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const DIST = 'dist';
// Raised from 120 KB on 2026-11-05, the owner's choice, so the header can wear a member's border and banner.
const BUDGET_INITIAL_JS_GZIP = 121 * 1024;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const files = walk(DIST);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let initialJs = 0;
let total = 0;
const rows = [];
// The game photo library is summarised on one line (images don't compress and there are hundreds).
let photos = 0;
let photoBytes = 0;
for (const f of files) {
  if (relative(DIST, f).startsWith('photos/')) {
    photos++;
    photoBytes += statSync(f).size;
    continue;
  }
  const buf = readFileSync(f);
  const gz = gzipSync(buf, { level: 9 }).length;
  const br = brotliCompressSync(buf).length;
  const rel = relative(DIST, f);
  const initial = html.includes(rel) && rel.endsWith('.js');
  if (initial) initialJs += gz;
  total += gz;
  rows.push([rel, buf.length, gz, br, initial]);
}
rows.sort((a, b) => b[2] - a[2]);
console.log('\nBuild size report (gzip -9 / brotli):');
for (const [rel, raw, gz, br, initial] of rows) {
  console.log(`  ${initial ? '*' : ' '} ${rel.padEnd(56)} ${kb(raw).padStart(10)} raw ${kb(gz).padStart(10)} gz ${kb(br).padStart(10)} br`);
}
if (photos) console.log(`    photos/ (${photos} game photos, loaded one at a time while playing) ${kb(photoBytes).padStart(10)} raw`);
console.log(`\n  * = loaded by index.html at startup`);
console.log(`  Initial JS (gzip): ${kb(initialJs)}  (budget ${kb(BUDGET_INITIAL_JS_GZIP)})`);
console.log(`  All files  (gzip): ${kb(total)}\n`);
if (initialJs > BUDGET_INITIAL_JS_GZIP) {
  console.error('Initial JS exceeds the size budget!');
  process.exit(1);
}
const missing = new Set();
for (const page of walk(DIST).filter((f) => f.endsWith('.html'))) {
  for (const m of readFileSync(page, 'utf8').matchAll(/(?:href|src)="(\/assets\/[^"?#]+)/g)) {
    if (!existsSync(join(DIST, m[1]))) missing.add(`${relative(DIST, page)} asks for ${m[1]}`);
  }
}
if (missing.size) {
  console.error(`Pages ask for build files that don't exist:\n  ${[...missing].slice(0, 12).join('\n  ')}`);
  process.exit(1);
}
