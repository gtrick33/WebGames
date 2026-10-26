/**
 * The world art for Sigilfall's 64 px grid (ASSET_AUDIT.md, VISUAL_BIBLE.md), called by sigilfall-art.mjs:
 *
 *   cp-<set>.png/.json     CraftPix ground (Level A): every tile at 64 px with its blob mask, read from the
 *                          pixels (which neighbours continue the inside ground), so it auto-tiles like a
 *                          47-piece set. Tiles whose middle is the outside ground form the inverse set.
 *   wb-ground.png/.json    Worlds-bundle textures (Level B) as transparent overlays: from each pack's
 *                          corner (Wang) transitions only the target ground is kept (water, cobbles, soil,
 *                          planks...), softened toward the CraftPix look, to lie on CraftPix ground.
 *   props-<pack>.png/.json props at the world scale, each with its ground point.
 *
 * Every piece is drawn at 4 atlas px per world px (`k: 4`).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const T = 64;

/** CraftPix ground sets: which side of each tile is "inside" is read from color. */
const CP_GROUND = [
  { id: 'cp-summer', dir: 'craftpix-net-381103-free-simple-summer-top-down-vector-tileset/PNG', inside: 'sand', outside: 'grass', test: (r, g) => r > g },
  { id: 'cp-swamp', dir: 'craftpix-net-734372-free-poison-swamp-game-tileset-and-environment-pack/PNG', inside: 'moss', outside: 'bog', test: (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b > 125 },
];

/** Worlds-bundle overlays: [pack, from texture, to texture, our name, grade]. */
const WB_OVERLAYS = [
  ['Greenvale_Meadows', 'green_grass', 'pond_water', 'water', { saturation: 0.95, blur: 0.6 }],
  ['Greenvale_Meadows', 'green_grass', 'cobblestone_pavement', 'cobble', { saturation: 0.9, blur: 0.5 }],
  ['Greenvale_Meadows', 'green_grass', 'soil_rows', 'soil', { saturation: 0.95, blur: 0.5 }],
  ['Greenvale_Meadows', 'green_grass', 'floor_planks', 'planks', { saturation: 0.95, blur: 0.4 }],
  ['Mirefen_Bog', 'mud_ground', 'swamp_water', 'swampwater', { saturation: 0.9, blur: 0.6 }],
  ['Mirefen_Bog', 'mud_ground', 'boardwalk_planks', 'boardwalk', { saturation: 0.9, blur: 0.4 }],
  ['Mirefen_Bog', 'mud_ground', 'green_moss', 'greenmoss', { saturation: 0.95, blur: 0.6 }],
  ['Sylvanreach_Grove', 'forest_floor', 'stream_water', 'stream', { saturation: 0.95, blur: 0.6 }],
  ['Sylvanreach_Grove', 'forest_floor', 'teal_moss', 'tealmoss', { saturation: 0.95, blur: 0.6 }],
  ['Sylvanreach_Grove', 'forest_floor', 'moonstone_path', 'moonstone', { saturation: 0.9, blur: 0.5 }],
  ['Gloomvault_Crypt', 'floor_tiles', 'old_flagstones', 'flagstones', { saturation: 0.9, blur: 0.4 }],
  ['Gloomvault_Crypt', 'floor_tiles', 'rubble_gravel', 'rubble', { saturation: 0.9, blur: 0.4 }],
  ['Gloomvault_Crypt', 'floor_tiles', 'slime_pool', 'slime', { saturation: 0.95, blur: 0.5 }],
  ['Gloomvault_Crypt', 'floor_tiles', 'red_carpet', 'carpet', { saturation: 0.9, blur: 0.4 }],
  ['Gloomvault_Crypt', 'floor_tiles', 'cave_floor', 'cavefloor', { saturation: 0.9, blur: 0.5 }],
];
/** Worlds-bundle textures used as a whole ground (indoor floors). */
const WB_FILLS = [
  ['Gloomvault_Crypt', 'floor_tiles', 'cryptfloor', { saturation: 0.9, blur: 0.4 }],
  ['Gloomvault_Crypt', 'cave_floor', 'cavefloor', { saturation: 0.9, blur: 0.5 }],
  ['Gloomvault_Crypt', 'stone_floor', 'stonefloor', { saturation: 0.9, blur: 0.4 }],
];

/** Prop packs: CraftPix at one world scale (0.4 of their 256 px-per-tile art), Worlds-bundle art at 1. */
const CP_PROPS = [
  { id: 'cps', dir: 'craftpix-net-381103-free-simple-summer-top-down-vector-tileset/PNG', prefix: 'Top-Down Simple Summer_Prop - ', scale: 0.4 },
  { id: 'cpw', dir: 'craftpix-net-734372-free-poison-swamp-game-tileset-and-environment-pack/PNG', prefix: 'Top-Down Poisonous Swamp_Prop - ', scale: 0.4 },
  { id: 'cpt', dir: 'craftpix-net-849532-free-fantasy-guard-magic-towers-pack-for-defense-games/PNG', prefix: 'Watchtower and Magic Tower_', scale: 0.6 },
];
/** Pieces scaled to the tile instead (fences and walkway planks join tile to tile). */
const TILE_SCALED = { 'wooden-fence-horizontal': 64 / 220, 'wooden-fence-vertical': 64 / 220, 'wooden-floor-horizontal': 64 / 220, 'wooden-floor-vertical': 64 / 140 };
/**
 * Foliage recolors of the CraftPix trees and bushes (§3.6: variety from recolors, not from another pack):
 * only leaf-green pixels move, so trunks, rocks and outlines keep their colors.
 */
const FOLIAGE = ['tree-medium', 'tree-small', 'bushes-large', 'bushes-medium', 'bushes-small', 'bushes-1', 'bushes-2', 'bushes-3', 'shrub-swamp-1', 'shrub-swamp-2', 'shrub-swamp-3', 'tree-tower-short', 'tree-tower-tall'];
const VARIANTS = {
  dark: { hue: 8, sat: 0.95, val: 0.78 },
  teal: { hue: 32, sat: 0.9, val: 0.9 },
  mint: { hue: 22, sat: 0.75, val: 1.08 },
  amber: { hue: -55, sat: 1.05, val: 1.05 },
  coral: { hue: -95, sat: 0.95, val: 1.05 },
  blossom: { hue: -140, sat: 0.55, val: 1.18 },
  dead: { hue: -70, sat: 0.25, val: 0.72 },
  snow: { hue: 40, sat: 0.18, val: 1.35 },
};

function recolorFoliage(data, v) {
  const out = Buffer.from(data);
  for (let o = 0; o < out.length; o += 4) {
    if (out[o + 3] === 0) continue;
    const r = out[o] / 255;
    const g = out[o + 1] / 255;
    const b = out[o + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 0.08) continue;
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    // leaves only: yellow-green through green to teal
    if (h < 65 || h > 175) continue;
    const s = max === 0 ? 0 : d / max;
    const nh = (h + v.hue + 360) % 360;
    const ns = Math.min(1, s * v.sat);
    const nv = Math.min(1, max * v.val);
    const c = nv * ns;
    const x = c * (1 - Math.abs(((nh / 60) % 2) - 1));
    const m = nv - c;
    const [rr, gg, bb] = nh < 60 ? [c, x, 0] : nh < 120 ? [x, c, 0] : nh < 180 ? [0, c, x] : nh < 240 ? [0, x, c] : nh < 300 ? [x, 0, c] : [c, 0, x];
    out[o] = Math.round((rr + m) * 255);
    out[o + 1] = Math.round((gg + m) * 255);
    out[o + 2] = Math.round((bb + m) * 255);
  }
  return out;
}

const WB_PROPS = ['Greenvale_Meadows', 'Gloomvault_Crypt', 'Mirefen_Bog', 'Sylvanreach_Grove', 'Blossom_Shrine'];
const WB_ID = { Greenvale_Meadows: 'gv', Gloomvault_Crypt: 'gc', Mirefen_Bog: 'mf', Sylvanreach_Grove: 'sr', Blossom_Shrine: 'bs' };

const slug = (s) => s.toLowerCase().replace(/\.png$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ------------------------------------------------------------- helpers */

async function rgba(file, w, h, kernel = 'lanczos3') {
  const img = sharp(file).ensureAlpha();
  const r = w ? img.resize(w, h, { kernel, fit: 'fill' }) : img;
  return r.raw().toBuffer({ resolveWithObject: true });
}

const toPng = (data, w, h) => sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

/** A grid atlas of same-size tiles, `cols` wide. */
async function grid(bufs, cols, png) {
  const rows = Math.ceil(bufs.length / cols);
  const comps = bufs.map((input, i) => ({ input, left: (i % cols) * T, top: Math.floor(i / cols) * T }));
  return png(sharp({ create: { width: cols * T, height: rows * T, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps)).toBuffer();
}

/** A softening pass: a light blur and saturation trim, so a painted texture sits closer to flat vector art. */
async function soften(buf, grade) {
  let img = sharp(buf);
  if (grade.blur) img = img.blur(grade.blur);
  if (grade.saturation && grade.saturation !== 1) img = img.modulate({ saturation: grade.saturation });
  return img.png().toBuffer();
}

/* ---------------------------------------------------------------- build */

export async function buildWorld({ SRC, write, json, png, pack, report }) {
  /* CraftPix ground: blob masks from the pixels */
  for (const set of CP_GROUND) {
    const dir = path.join(SRC, set.dir);
    const files = fs.readdirSync(dir).filter((f) => f.includes('Ground')).sort();
    const tiles = [];
    const sets = { [set.inside]: {}, [set.outside]: {} };
    const fill = { [set.inside]: [], [set.outside]: [] };
    for (const [i, f] of files.entries()) {
      const file = path.join(dir, f);
      tiles.push(await sharp(file).resize(T, T, { kernel: 'lanczos3' }).png().toBuffer());
      const N = 32;
      const { data } = await rgba(file, N, N, 'cubic');
      const at = (x, y) => {
        const o = (y * N + x) * 4;
        return set.test(data[o], data[o + 1], data[o + 2]) ? 1 : 0;
      };
      const line = (pts) => pts.reduce((a, [x, y]) => a + at(x, y), 0) / pts.length;
      const mid = Array.from({ length: 12 }, (_, k) => k + 10);
      const inside = line([[15, 15], [16, 16], [15, 16], [16, 15]]) > 0.5;
      const edges = [line(mid.map((k) => [k, 0])), line(mid.map((k) => [N - 1, k])), line(mid.map((k) => [k, N - 1])), line(mid.map((k) => [0, k]))].map((v) => v > 0.5);
      const corners = [at(N - 1, 0), at(N - 1, N - 1), at(0, N - 1), at(0, 0)].map((v) => v === 1);
      // seen from the tile's own middle ground: a side "continues" when it is the same ground as the middle
      const same = (b) => (inside ? b : !b);
      const [n, e, s, w] = edges.map(same);
      const [ne, se, sw, nw] = corners.map(same);
      const mask = [n, e, s, w, ne && n && e, se && s && e, sw && s && w, nw && n && w].map((b) => (b ? '1' : '0')).join('');
      const name = inside ? set.inside : set.outside;
      if (mask === '11111111') fill[name].push(i);
      (sets[name][mask] ??= []).push(i);
    }
    const buf = await grid(tiles, 8, png);
    write(`${set.id}.png`, buf);
    report.push([`${set.id}.png`, buf.length]);
    json(`${set.id}.json`, { size: T, cols: 8, inside: set.inside, outside: set.outside, sets, fill });
  }

  /* Worlds-bundle overlays: the target ground cut out of each corner transition */
  {
    const bufs = [];
    const index = {};
    const meanOf = async (file) => {
      const { data } = await rgba(file, 16, 16);
      const m = [0, 0, 0];
      for (let i = 0; i < 256; i++) for (let c = 0; c < 3; c++) m[c] += data[i * 4 + c] / 256;
      return m;
    };
    const texDir = (p, tex) => path.join(SRC, p, 'Tiles/Game', tex);
    for (const [p, from, to, name, grade] of WB_OVERLAYS) {
      const fromM = await meanOf(path.join(texDir(p, from), `${from}_1.png`));
      const toM = await meanOf(path.join(texDir(p, to), `${to}_1.png`));
      const tdir = path.join(SRC, p, 'Tiles/Game/transitions', `${from}_to_${to}`);
      index[name] = { wang: [], full: [] };
      for (let i = 0; i < 16; i++) {
        const f = path.join(tdir, `${from}_to_${to}_${String(i).padStart(2, '0')}.png`);
        const { data, info } = await rgba(f, T, T);
        for (let o = 0; o < data.length; o += 4) {
          const d = (m) => Math.hypot(data[o] - m[0], data[o + 1] - m[1], data[o + 2] - m[2]);
          const df = d(fromM);
          const dt = d(toM);
          // soft edge: fully the target near its color, gone near the grass's, a short ramp between
          const t = Math.min(1, Math.max(0, (df - dt) / Math.max(1, df + dt) * 3 + 0.5));
          data[o + 3] = Math.round(data[o + 3] * (t * t * (3 - 2 * t)));
        }
        index[name].wang.push(bufs.length);
        bufs.push(await soften(await toPng(data, info.width, info.height), grade));
      }
      // the inside: the pack's seamless 4 x 4 texture cut into 16 tiles, laid by position so it never repeats in a grid
      const seamless = path.join(texDir(p, to), `${to}_seamless_4x4.png`);
      const soft = await soften(await sharp(seamless).resize(T * 4, T * 4).png().toBuffer(), grade);
      for (let q = 0; q < 16; q++) {
        index[name].full.push(bufs.length);
        bufs.push(await sharp(soft).extract({ left: (q % 4) * T, top: Math.floor(q / 4) * T, width: T, height: T }).png().toBuffer());
      }
    }
    const fills = {};
    for (const [p, tex, name, grade] of WB_FILLS) {
      fills[name] = [];
      const soft = await soften(await sharp(path.join(texDir(p, tex), `${tex}_seamless_4x4.png`)).resize(T * 4, T * 4).png().toBuffer(), grade);
      for (let q = 0; q < 16; q++) {
        fills[name].push(bufs.length);
        bufs.push(await sharp(soft).extract({ left: (q % 4) * T, top: Math.floor(q / 4) * T, width: T, height: T }).png().toBuffer());
      }
    }
    const buf = await grid(bufs, 16, png);
    write('wb-ground.png', buf);
    report.push(['wb-ground.png', buf.length]);
    json('wb-ground.json', { size: T, cols: 16, overlays: index, fills, wang: 'index = 8*TL + 4*TR + 2*BL + 1*BR; a corner is 1 where the overlay ground is; full and fills are a seamless 4 x 4 texture, row by row' });
  }

  /* props */
  const solidBox = (data, w, h) => {
    // the opaque body (baked soft shadows are see-through): its bottom middle stands on the ground
    let x0 = w;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 200) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? [Math.round(w / 2), h] : [Math.round((x0 + x1) / 2), y1 + 1];
  };
  const propAtlas = async (id, entries) => {
    const packed = await pack(entries, 2048);
    write(`props-${id}.png`, packed.buf);
    report.push([`props-${id}.png`, packed.buf.length]);
    const props = {};
    for (const e of entries) props[e.key] = { r: packed.rects[e.key], o: e.o };
    json(`props-${id}.json`, { k: 4, props });
  };
  for (const pk of CP_PROPS) {
    const dir = path.join(SRC, pk.dir);
    const entries = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(pk.prefix)).sort()) {
      const key = slug(f.slice(pk.prefix.length));
      const meta = await sharp(path.join(dir, f)).metadata();
      const k = TILE_SCALED[key] ?? pk.scale;
      const w = Math.max(1, Math.round(meta.width * k));
      const h = Math.max(1, Math.round(meta.height * k));
      const { data } = await rgba(path.join(dir, f), w, h);
      const buf = await toPng(data, w, h);
      const o = solidBox(data, w, h);
      entries.push({ key, buf, w, h, o });
      if (FOLIAGE.includes(key)) for (const [vn, v] of Object.entries(VARIANTS)) entries.push({ key: `${key}~${vn}`, buf: await toPng(recolorFoliage(data, v), w, h), w, h, o });
    }
    await propAtlas(pk.id, entries);
  }
  for (const p of WB_PROPS) {
    const cat = JSON.parse(fs.readFileSync(path.join(SRC, p, 'Data/catalog.json'), 'utf8'));
    const entries = [];
    for (const group of ['props', 'buildings']) {
      for (const [name, def] of Object.entries(cat[group])) {
        const file = path.join(SRC, p, def.file.replace('{size}', 'Game'));
        if (!fs.existsSync(file)) continue;
        const meta = await sharp(file).metadata();
        const pivot = def.sizes?.Game?.pivot ?? [Math.round(meta.width / 2), meta.height];
        entries.push({ key: name, buf: await sharp(file).png().toBuffer(), w: meta.width, h: meta.height, o: pivot });
      }
    }
    await propAtlas(WB_ID[p], entries);
  }
}
