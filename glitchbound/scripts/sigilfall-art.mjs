#!/usr/bin/env node
/**
 * Builds Sigilfall's runtime art from the source packs in assets/sigilfall/ (which are never shipped).
 *
 *   node scripts/sigilfall-art.mjs
 *
 * Writes packed atlases and their JSON indexes to public/games/sigilfall/art/:
 *
 *   rk-<season>-hd.png     Royal Keep's tiles (summer, autumn, winter) smoothed to 64 px (EPX): the ground
 *                          of every outdoor land; rk-tiles.json names them (the same for every season)
 *   rk-props-<season>-hd.png  its props and animated props, packed and smoothed; rk-props-<season>.json
 *                          holds their 32 px rects, origins, footprints and chimney points (doubled at load)
 *   vfx.png                the Magic Spells effects (64 px frames), one strip per effect; + .json
 *   circles.png            the Magic Circles (96 px frames); + .json
 *   props-gc               the few story pieces Royal Keep lacks (sigilfall-art-world.mjs)
 *
 * Only what the game draws goes in, losslessly recompressed. The art direction and what each pack is
 * allowed to do are in src/games/sigilfall/VISUAL_BIBLE.md; sources and licenses in ASSET_AUDIT.md.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildWorld } from './sigilfall-art-world.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/sigilfall');
const OUT = path.join(ROOT, 'public/games/sigilfall/art');
const RK = path.join(SRC, 'royal_keep_tileset_v1');
const SEASONS = { summer: RK, autumn: path.join(SRC, 'royal_keep_seasons_v1/autumn'), winter: path.join(SRC, 'royal_keep_seasons_v1/winter') };
const VFX = path.join(SRC, 'magic-spells-vfx');
const CIRCLES = path.join(SRC, 'magic-circles-vfx-lite');

const PAD = 1;

if (!fs.existsSync(SRC)) {
  console.error(`No source packs at ${SRC}. They are kept outside the repository's shipped files; see ASSET_AUDIT.md.`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
// the folder holds only this build's output: what the game no longer draws goes with the rebuild
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f));

/** Lossless PNG, as small as sharp makes it. */
const png = (img) => img.png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true });

/**
 * Shelf-packs pictures (tallest first) into an atlas `width` wide. Each entry: { key, buf, w, h }.
 * Returns the atlas buffer and key -> [x, y, w, h].
 */
async function pack(entries, width) {
  const sorted = [...entries].sort((a, b) => b.h - a.h || b.w - a.w || (a.key < b.key ? -1 : 1));
  const rects = {};
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const e of sorted) {
    if (e.w > width) throw new Error(`${e.key} is wider (${e.w}) than the atlas (${width})`);
    if (x + e.w > width) {
      x = 0;
      y += shelf + PAD;
      shelf = 0;
    }
    rects[e.key] = [x, y, e.w, e.h];
    x += e.w + PAD;
    shelf = Math.max(shelf, e.h);
  }
  const height = y + shelf;
  const comps = sorted.map((e) => ({ input: e.buf, left: rects[e.key][0], top: rects[e.key][1] }));
  const buf = await png(sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps)).toBuffer();
  return { buf, rects, width, height };
}

async function entry(key, file, k = 1) {
  const img = sharp(file);
  const m = await img.metadata();
  const w = m.width * k;
  const h = m.height * k;
  const buf = k === 1 ? await img.png().toBuffer() : await img.resize(w, h, { kernel: 'nearest' }).png().toBuffer();
  return { key, buf, w, h };
}

const write = (name, data) => fs.writeFileSync(path.join(OUT, name), typeof data === 'string' ? data : Buffer.from(data));
const json = (name, obj) => write(name, `${JSON.stringify(obj)}\n`);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const report = [];

/**
 * Scale2x (EPX) on raw RGBA: each pixel becomes four, and a corner takes its neighbours' color where two
 * of them agree, so Royal Keep's diagonals come out smooth on the 64 px grid instead of as 2x2 blocks
 * (the normalization its pixel art needs beside CraftPix's vector edges, VISUAL_BIBLE.md §2).
 */
async function epx(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const src = new Uint32Array(data.buffer, data.byteOffset, w * h);
  const out = new Uint32Array(w * h * 4);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const E = at(x, y);
      const B = at(x, y - 1);
      const D = at(x - 1, y);
      const F = at(x + 1, y);
      const H = at(x, y + 1);
      let e0 = E;
      let e1 = E;
      let e2 = E;
      let e3 = E;
      if (B !== H && D !== F) {
        if (D === B) e0 = D;
        if (B === F) e1 = F;
        if (D === H) e2 = D;
        if (H === F) e3 = F;
      }
      const i = y * 2 * w * 2 + x * 2;
      out[i] = e0;
      out[i + 1] = e1;
      out[i + w * 2] = e2;
      out[i + w * 2 + 1] = e3;
    }
  }
  return png(sharp(Buffer.from(out.buffer), { raw: { width: w * 2, height: h * 2, channels: 4 } })).toBuffer();
}

/* ------------------------------------------------------------ Royal Keep */

// tile names -> atlas index (tiles.txt: id column row name)
const tiles = {};
for (const line of fs.readFileSync(path.join(RK, 'tileset/tiles.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [id, , , name] = line.split('\t');
  tiles[name] = Number(id);
}
json('rk-tiles.json', { size: 32, cols: 16, tiles });

const propsMeta = JSON.parse(fs.readFileSync(path.join(RK, 'props/props.json'), 'utf8'));
const animated = [];
for (const line of fs.readFileSync(path.join(RK, 'animated/frames.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [name, frames, w, h, ms, loops] = line.split('\t');
  if (name.includes('<')) continue;
  animated.push({ name, frames: +frames, w: +w, h: +h, ms: +ms, loop: loops === 'yes' });
}

for (const [season, dir] of Object.entries(SEASONS)) {
  // Royal Keep ships only in its smoothed 64 px build (the world's one art language, ASSET_AUDIT.md)
  const atlas = await png(sharp(path.join(dir, 'tileset/royal_keep_tiles.png'))).toBuffer();
  const atlasHd = await epx(atlas);
  write(`rk-${season}-hd.png`, atlasHd);
  report.push([`rk-${season}-hd.png`, atlasHd.length]);

  const entries = [];
  for (const [name, m] of Object.entries(propsMeta)) {
    const f = path.join(dir, 'props', m.group, `${name}.png`);
    entries.push(await entry(name, fs.existsSync(f) ? f : path.join(RK, 'props', m.group, `${name}.png`)));
  }
  for (const a of animated) {
    const f = path.join(dir, 'animated', `${a.name}_strip.png`);
    entries.push(await entry(`anim:${a.name}`, fs.existsSync(f) ? f : path.join(RK, 'animated', `${a.name}_strip.png`)));
  }
  const packed = await pack(entries, 1024);
  const propsHd = await epx(packed.buf);
  write(`rk-props-${season}-hd.png`, propsHd);
  report.push([`rk-props-${season}-hd.png`, propsHd.length]);
  const props = {};
  for (const [name, m] of Object.entries(propsMeta)) {
    props[name] = { r: packed.rects[name], o: m.origin, ...(m.footprint ? { fp: m.footprint } : {}), ...(m.smoke ? { smoke: m.smoke } : {}) };
  }
  const anims = {};
  for (const a of animated) anims[a.name] = { r: packed.rects[`anim:${a.name}`], n: a.frames, w: a.w, h: a.h, ms: a.ms, loop: a.loop };
  json(`rk-props-${season}.json`, { props, anims });
}

/* ------------------------------------------------------------------ VFX */

{
  const man = JSON.parse(fs.readFileSync(path.join(VFX, 'manifest.json'), 'utf8')).effects_list;
  const entries = [];
  const fx = {};
  for (const [name, e] of Object.entries(man)) {
    if (name.startsWith('white')) continue;
    const f = path.join(VFX, e.sheet);
    if (!fs.existsSync(f)) continue;
    entries.push(await entry(name, f));
    fx[name] = { n: e.frames, ms: e.frame_ms, loop: !!e.loop };
  }
  const packed = await pack(entries, 2048);
  write('vfx.png', packed.buf);
  report.push(['vfx.png', packed.buf.length]);
  for (const k of Object.keys(fx)) fx[k].r = packed.rects[k];
  json('vfx.json', { frame: 64, fx });
}

{
  const man = JSON.parse(fs.readFileSync(path.join(CIRCLES, 'manifest.json'), 'utf8')).animations;
  const entries = [];
  const fx = {};
  for (const [name, e] of Object.entries(man)) {
    if (!name.startsWith('color/')) continue;
    const key = name.slice('color/'.length);
    entries.push(await entry(key, path.join(CIRCLES, e.sheet)));
    fx[key] = { n: e.frames, ms: e.frame_ms, loop: !!e.loop };
  }
  const packed = await pack(entries, 2048);
  write('circles.png', packed.buf);
  report.push(['circles.png', packed.buf.length]);
  for (const k of Object.keys(fx)) fx[k].r = packed.rects[k];
  json('circles.json', { frame: 96, fx });
}

await buildWorld({ SRC, write, json, png, pack, report });

// the game asks for every file with this version, so a rebuilt atlas is never mixed with an old index
const hash = crypto.createHash('sha256');
for (const f of fs.readdirSync(OUT).sort()) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const version = hash.digest('hex').slice(0, 10);
fs.writeFileSync(
  path.join(ROOT, 'src/games/sigilfall/render/art/artVersion.ts'),
  `/** Written by scripts/sigilfall-art.mjs: the build of the art in public/games/sigilfall/art (for cache-busting). */\nexport const ART_VERSION = '${version}';\n`,
);
console.log(`art version ${version}`);

let total = 0;
for (const [name, n] of report) {
  total += n;
  console.log(`${name.padEnd(24)} ${kb(n)}`);
}
console.log(`${'total'.padEnd(24)} ${kb(total)}`);
