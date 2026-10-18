#!/usr/bin/env node
/**
 * Photo library for Where's the Ball? (CC0 and public-domain photos only, from
 * Wikimedia Commons, filtered by the files' structured licence data).
 *
 *   node scripts/photos.mjs fetch <set> <rawDir>     search Wikimedia Commons and download 1280px copies into rawDir
 *   node scripts/photos.mjs build <set> <rawDir>     resize to WebP in public/photos/<set>/, analyse, write the manifest
 *   node scripts/photos.mjs sheet <set> <outDir>     contact sheets of the built photos (for a visual review)
 *   node scripts/photos.mjs review <set> <rawDir> <outDir>   sheets of downloads not yet annotated or rejected
 *
 * <set> is "ball". Downloads stay outside the repo (rawDir); only the processed WebP files
 * and the manifest (src/games/<game>/photos.ts, with source and licence per photo) are committed.
 * A photo listed in scripts/photos-rejected.json is skipped by `build` (after a visual review).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;

const SETS = {
  ball: {
    out: 'public/photos/ball',
    manifest: 'src/games/wheres-the-ball/photos.ts',
    size: [1440, 1080],
    quality: 52,
    /** Scene units of the game (Where's the Ball? scenes are 800 x 600). */
    scene: [800, 600],
    queries: [
      'fallen autumn leaves', 'leaves on ground', 'forest floor', 'grass lawn', 'meadow flowers', 'dandelion field', 'clover', 'pebbles beach', 'gravel stones', 'river rocks',
      'flower bed', 'garden plants', 'park grass', 'tennis court', 'playground', 'toys on floor', 'fruit market', 'lemons', 'limes fruit', 'oranges pile',
      'vegetable market', 'pumpkin patch', 'hay field', 'moss forest', 'ivy leaves', 'fern', 'tulip field', 'sunflower field', 'golf course', 'football pitch',
      'picnic park', 'beach towels', 'seashells beach', 'backyard garden', 'hedge bush', 'garden path', 'wildflowers', 'woodland path', 'apples orchard', 'pine cones',
      // Ground-level scenes at walking distance (where a real tennis ball would look the right size).
      'lawn grass texture', 'fallen leaves ground', 'leaf litter', 'gravel path', 'shingle beach', 'pine needles ground', 'forest floor moss', 'wood chips mulch', 'garden soil seedlings', 'vegetable patch',
      'strawberry plants', 'daisies lawn', 'dandelions lawn', 'buttercups meadow', 'autumn leaves grass', 'acorns ground', 'chestnuts ground', 'windfall apples', 'squash harvest', 'potatoes harvest',
      'onions market', 'oranges market', 'melons market', 'vegetables crates', 'seaweed beach', 'rock pool', 'cobblestones', 'heather moorland', 'bluebells woodland', 'crocus lawn',
      'fallen petals ground', 'mossy rocks', 'tree roots forest', 'firewood pile', 'leaves on path', 'grass meadow close', 'stones riverbed', 'garden border plants', 'flower bed tulips', 'lawn with leaves',
    ],
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = 'GlitchBoundPhotoScript/1.0 (https://glitchboundstudio.com; builds a small public-domain photo library)';

/** Wikimedia Commons search limited to CC0 or public-domain files (structured data), with 1280px thumbnails. */
async function search(q, offset) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  u.searchParams.set('action', 'query');
  u.searchParams.set('format', 'json');
  u.searchParams.set('generator', 'search');
  u.searchParams.set('gsrnamespace', '6');
  u.searchParams.set('gsrlimit', '40');
  u.searchParams.set('gsroffset', String(offset));
  u.searchParams.set('gsrsearch', `${q} filetype:bitmap haswbstatement:P275=Q6938433|P6216=Q19652`);
  u.searchParams.set('prop', 'imageinfo');
  u.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  u.searchParams.set('iiurlwidth', process.env.THUMB ?? '1280');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(u, { headers: { 'user-agent': UA } });
    if (res.status === 429 || res.status >= 500) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`search ${q}: ${res.status}`);
    const pages = Object.values((await res.json()).query?.pages ?? {});
    return pages.map((p) => {
      const ii = p.imageinfo?.[0] ?? {};
      const m = ii.extmetadata ?? {};
      const strip = (v) => String(v ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return {
        id: String(p.pageid),
        title: strip(m.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        creator: strip(m.Artist?.value).slice(0, 80),
        license: /cc0/i.test(m.LicenseShortName?.value ?? '') ? 'cc0' : 'pdm',
        licenseName: strip(m.LicenseShortName?.value),
        width: ii.width,
        height: ii.height,
        mime: ii.mime,
        url: ii.thumburl ?? ii.url,
        landing: ii.descriptionurl,
        restrictions: strip(m.Restrictions?.value),
      };
    });
  }
  return [];
}

async function fetchSet(setName, rawDir) {
  const set = SETS[setName];
  mkdirSync(rawDir, { recursive: true });
  const metaPath = join(rawDir, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const want = Number(process.env.PER_QUERY ?? 8);
  // NEW_ONLY=1: only search topics that have no downloads yet (topping up the library).
  const done = new Set(Object.values(meta).map((m) => m.query));
  for (const q of set.queries) {
    if (process.env.NEW_ONLY && done.has(q)) continue;
    let got = 0;
    for (const offset of [0, 40]) {
      let results = [];
      try {
        results = await search(q, offset);
      } catch (e) {
        console.warn(String(e));
      }
      for (const r of results) {
        if (got >= want) break;
        if (meta[r.id] || !r.url || !/jpeg|png|webp/.test(r.mime ?? '')) continue;
        if ((r.width ?? 0) < 1200 || (r.height ?? 0) < 800) continue;
        const ratio = (r.width ?? 0) / Math.max(1, r.height ?? 1);
        if (ratio < 1.2 || ratio > 1.9) continue; // landscape photos that crop well to 4:3
        if (/trademark|personality|insignia/i.test(r.restrictions)) continue;
        if (/map|diagram|logo|scan|drawing|painting|poster|chart|svg/i.test(r.title)) continue;
        try {
          const res = await fetch(r.url, { headers: { 'user-agent': UA } });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const info = await sharp(buf).metadata();
          if (!info.width || !info.height) continue;
          const file = `${r.id}.${info.format}`;
          writeFileSync(join(rawDir, file), buf);
          meta[r.id] = { file, query: q, title: r.title, creator: r.creator, license: r.license, licenseName: r.licenseName, source: r.landing };
          got++;
          await sleep(250);
        } catch {
          /* skip broken downloads */
        }
      }
      writeFileSync(metaPath, JSON.stringify(meta, null, 1));
      if (got >= want) break;
    }
    console.log(`${q}: +${got} (total ${Object.keys(meta).length})`);
  }
}

/** Detail analysis: points (scene units) where the picture is busy, with local saturation and brightness. */
async function analyse(file, scene) {
  const AW = 160;
  const AH = 120;
  const { data } = await sharp(file).resize(AW, AH, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lum = new Float32Array(AW * AH);
  const sat = new Float32Array(AW * AH);
  for (let i = 0; i < AW * AH; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sat[i] = mx === 0 ? 0 : (mx - mn) / mx;
  }
  // Gradient energy, then a box blur so "busy" means a neighbourhood full of edges, not one edge.
  const grad = new Float32Array(AW * AH);
  for (let y = 1; y < AH - 1; y++)
    for (let x = 1; x < AW - 1; x++) {
      const i = y * AW + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + AW] - lum[i - AW];
      grad[i] = Math.sqrt(gx * gx + gy * gy);
    }
  const R = 5;
  const busy = new Float32Array(AW * AH);
  const satAvg = new Float32Array(AW * AH);
  const lumAvg = new Float32Array(AW * AH);
  for (let y = 0; y < AH; y++)
    for (let x = 0; x < AW; x++) {
      let s = 0;
      let ss = 0;
      let ll = 0;
      let n = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= AW || yy >= AH) continue;
          const j = yy * AW + xx;
          s += grad[j];
          ss += sat[j];
          ll += lum[j];
          n++;
        }
      busy[y * AW + x] = s / n;
      satAvg[y * AW + x] = ss / n;
      lumAvg[y * AW + x] = ll / n;
    }
  // Candidate points: local maxima of busyness, well apart, away from the borders.
  const cands = [];
  for (let y = 8; y < AH - 8; y += 2) for (let x = 8; x < AW - 8; x += 2) cands.push([x, y, busy[y * AW + x]]);
  cands.sort((a, b) => b[2] - a[2]);
  const pts = [];
  const minGap = 13;
  for (const c of cands) {
    if (pts.length >= 48) break;
    if (pts.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < minGap)) continue;
    pts.push(c);
  }
  const max = pts[0]?.[2] || 1;
  const kx = scene[0] / AW;
  const ky = scene[1] / AH;
  const mean = busy.reduce((a, b) => a + b, 0) / busy.length;
  return {
    busy: Math.round((mean / 0.06) * 100) / 100,
    pts: pts.map(([x, y, b]) => [Math.round(x * kx), Math.round(y * ky), Math.round((b / max) * 100), Math.round(satAvg[y * AW + x] * 100), Math.round(lumAvg[y * AW + x] * 100)]),
  };
}

async function buildSet(setName, rawDir) {
  const set = SETS[setName];
  const meta = JSON.parse(readFileSync(join(rawDir, 'meta.json'), 'utf8'));
  const rejectedPath = join(ROOT, 'scripts/photos-rejected.json');
  const rejected = new Set(existsSync(rejectedPath) ? (JSON.parse(readFileSync(rejectedPath, 'utf8'))[setName] ?? []) : []);
  // Ball photos need a reviewed real-world scale (ball radius at full frame) and ground line; others are left out.
  const annPath = join(ROOT, 'scripts/photos-annotations.json');
  const ann = existsSync(annPath) ? (JSON.parse(readFileSync(annPath, 'utf8'))[setName] ?? null) : null;
  const outDir = join(ROOT, set.out);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const entries = [];
  const seenHashes = new Set();
  for (const [id, m] of Object.entries(meta)) {
    // Review sheets label photos with their first 8 characters: shorter entries match exactly.
    if ([...rejected].some((r) => r === id || (r.length === 8 && id.startsWith(r)))) continue;
    if (ann && !ann[id]) continue;
    const short = id;
    const src = join(rawDir, m.file);
    try {
      const out = join(outDir, `${short}.webp`);
      const img = sharp(src).rotate().resize(set.size[0], set.size[1], { fit: 'cover', position: 'attention' });
      const buf = await img.webp({ quality: set.quality, effort: 5 }).toBuffer();
      // Drop exact duplicates (the same photo uploaded twice).
      const tiny = await sharp(buf).resize(16, 12, { fit: 'fill' }).greyscale().raw().toBuffer();
      const h = createHash('sha1').update(tiny.map((v) => v >> 4)).digest('hex');
      if (seenHashes.has(h)) continue;
      seenHashes.add(h);
      writeFileSync(out, buf);
      const a = await analyse(out, set.scene);
      // Pictures with too little detail make poor puzzles.
      if (a.pts.length < 18 || a.busy < 0.5) {
        rmSync(out);
        continue;
      }
      const extra = ann ? { scale: ann[id][0], ground: ann[id][1] } : {};
      entries.push({ id: short, title: cleanTitle(m.title, m.query), creator: m.creator, license: m.license, source: m.source, ...extra, kb: Math.round(buf.length / 1024), busy: a.busy, pts: a.pts });
    } catch (e) {
      console.warn('skip', id, String(e));
    }
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const total = entries.reduce((n, e) => n + e.kb, 0);
  const header = `/**
 * Photo library (generated by scripts/photos.mjs, do not edit by hand). Public-domain (PDM) and CC0
 * photos from Wikimedia Commons; source and licence are kept for every photo. Files live in
 * ${set.out}/<id>.webp at ${set.size[0]} x ${set.size[1]}.
 *
 * pts: busy spots in scene units, [x, y, detail 0-100, saturation 0-100, brightness 0-100].
 */
`;
  const body = `export interface Photo {
  id: string;
  title: string;
  creator: string;
  license: string;
  source: string;
  pts: [number, number, number, number, number][];${ann ? `
  /** Ball radius (scene units) that matches the photo's real-world scale at full frame. */
  scale: number;
  /** Where the ground starts, as a fraction of the height (the ball never floats above it). */
  ground: number;` : ''}
}

export const PHOTO_DIR = '/${set.out.replace(/^public\//, '')}';

export const PHOTOS: Photo[] = ${JSON.stringify(entries.map((e) => ({ id: e.id, title: e.title, creator: e.creator, license: e.license, source: e.source, ...(ann ? { scale: e.scale, ground: e.ground } : {}), pts: e.pts })))};
`;
  writeFileSync(join(ROOT, set.manifest), header + body);
  console.log(`${setName}: ${entries.length} photos, ${(total / 1024).toFixed(1)} MB`);
}

function cleanTitle(title, query) {
  const t = String(title || '')
    .replace(/\.(jpe?g|png|webp|tiff?)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Camera file names ("IMG 2041", "DSC01234") and very long titles fall back to the search topic.
  if (!t || /^(img|dsc|dscn|p\d|pict|photo|image)[\s\d-]*$/i.test(t) || /\d{4,}/.test(t) || t.length > 48) return query.replace(/^./, (c) => c.toUpperCase());
  return t;
}

async function sheet(setName, outDir) {
  const set = SETS[setName];
  const dir = join(ROOT, set.out);
  const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
  mkdirSync(outDir, { recursive: true });
  const cols = 6;
  const tw = 240;
  const th = 180;
  for (let s = 0; s * 30 < files.length; s++) {
    const chunk = files.slice(s * 30, s * 30 + 30);
    const rows = Math.ceil(chunk.length / cols);
    const tiles = await Promise.all(
      chunk.map(async (f, i) => ({
        input: await sharp(join(dir, f))
          .resize(tw, th)
          .composite([{ input: Buffer.from(`<svg width="${tw}" height="${th}"><line x1="0" y1="${th / 4}" x2="${tw}" y2="${th / 4}" stroke="red" stroke-opacity="0.6"/><line x1="0" y1="${th / 2}" x2="${tw}" y2="${th / 2}" stroke="red" stroke-opacity="0.6"/><rect x="0" y="0" width="96" height="20" fill="black" opacity="0.7"/><text x="4" y="15" font-size="14" fill="white" font-family="monospace">${f.replace(/\.webp$/, '')}</text></svg>`), top: 0, left: 0 }])
          .toBuffer(),
        left: (i % cols) * tw,
        top: Math.floor(i / cols) * th,
      })),
    );
    await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#222' } })
      .composite(tiles)
      .jpeg({ quality: 70 })
      .toFile(join(outDir, `${setName}-${s + 1}.jpg`));
  }
  console.log(`${Math.ceil(files.length / 30)} sheets in ${outDir}`);
}

/** Contact sheets of downloaded photos that are neither annotated nor rejected yet (for review). */
async function review(setName, rawDir, outDir) {
  const meta = JSON.parse(readFileSync(join(rawDir, 'meta.json'), 'utf8'));
  const rejected = new Set(JSON.parse(readFileSync(join(ROOT, 'scripts/photos-rejected.json'), 'utf8'))[setName] ?? []);
  const annPath = join(ROOT, 'scripts/photos-annotations.json');
  const ann = existsSync(annPath) ? (JSON.parse(readFileSync(annPath, 'utf8'))[setName] ?? {}) : {};
  const ids = Object.keys(meta)
    .filter((id) => !ann[id] && ![...rejected].some((r) => r === id || (r.length === 8 && id.startsWith(r))))
    .sort();
  mkdirSync(outDir, { recursive: true });
  const cols = 6;
  const tw = 240;
  const th = 180;
  for (let s = 0; s * 30 < ids.length; s++) {
    const chunk = ids.slice(s * 30, s * 30 + 30);
    const tiles = [];
    for (const [i, id] of chunk.entries()) {
      try {
        const lines = `<line x1="0" y1="${th / 4}" x2="${tw}" y2="${th / 4}" stroke="red" stroke-opacity="0.6"/><line x1="0" y1="${th / 2}" x2="${tw}" y2="${th / 2}" stroke="red" stroke-opacity="0.6"/>`;
        const label = `<rect x="0" y="0" width="96" height="20" fill="black" opacity="0.7"/><text x="4" y="15" font-size="14" fill="white" font-family="monospace">${id}</text>`;
        const input = await sharp(join(rawDir, meta[id].file)).rotate().resize(tw, th, { fit: 'cover', position: 'attention' }).composite([{ input: Buffer.from(`<svg width="${tw}" height="${th}">${lines}${label}</svg>`), top: 0, left: 0 }]).toBuffer();
        tiles.push({ input, left: (i % cols) * tw, top: Math.floor(i / cols) * th });
      } catch {
        /* unreadable file */
      }
    }
    await sharp({ create: { width: cols * tw, height: Math.ceil(chunk.length / cols) * th, channels: 3, background: '#222' } })
      .composite(tiles)
      .jpeg({ quality: 70 })
      .toFile(join(outDir, `review-${setName}-${s + 1}.jpg`));
  }
  console.log(`${ids.length} photos to review in ${Math.ceil(ids.length / 30)} sheets`);
}

const [cmd, setName, dir, outDir] = process.argv.slice(2);
if (!SETS[setName] || !dir) {
  console.error('usage: node scripts/photos.mjs fetch|build|sheet|review ball <dir> [outDir]');
  process.exit(1);
}
if (cmd === 'fetch') await fetchSet(setName, dir);
else if (cmd === 'build') await buildSet(setName, dir);
else if (cmd === 'sheet') await sheet(setName, dir);
else if (cmd === 'review') await review(setName, dir, outDir);
