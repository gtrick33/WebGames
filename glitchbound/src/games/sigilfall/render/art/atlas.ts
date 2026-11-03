import { ART_VERSION } from './artVersion';
import { canvas, ctx2d, type Cnv } from '../pixel';

/**
 * The packed art from the source packs (scripts/sigilfall-art.mjs builds it into
 * public/games/sigilfall/art): the Royal Keep ground tiles and props in three seasons (the whole outdoor
 * world), the few story pieces it lacks, and the spell effects. Everything is fetched once, when first
 * needed, and drawn from the atlas with a source rectangle.
 *
 * A land's look is a season plus a grade (a color treatment, see recipes.ts) applied to the tiles and
 * props, never to people: characters stay a readability tier above the world. Without a DOM or a
 * network (tests, a failed download) nothing loads, and the procedural art is drawn instead.
 */

export type Season = 'summer' | 'autumn' | 'winter';
/** x, y, w, h in the atlas. */
export type Rect = [number, number, number, number];

export interface PropInfo {
  r: Rect;
  /** The pixel that stands on the ground (bottom-left of the footprint for buildings). */
  o: [number, number];
  /** Footprint (width, depth) in pixels, for buildings and big props. */
  fp?: [number, number];
  /** Chimney points, for smoke. */
  smoke?: [number, number][];
}

export interface AnimInfo {
  r: Rect;
  n: number;
  w: number;
  h: number;
  ms: number;
  loop: boolean;
}

/** A color treatment: saturation and contrast multiply, brightness adds (-1..1), hue turns (degrees), tint colorizes. */
export interface Grade {
  sat?: number;
  contrast?: number;
  bright?: number;
  hue?: number;
  tint?: [string, number];
}

/** Extra ground sets made from existing ones at load (sand from dirt, ash, mud...). */
export interface Derived {
  name: string;
  from: string;
  grade: Grade;
}

export interface WorldArt {
  tiles: Cnv;
  props: Cnv;
  tile: Record<string, number>;
  /** Where each tile is in `tiles` (derived sets are appended below the pack's rows). */
  tileAt: (index: number) => [number, number];
  prop: Record<string, PropInfo>;
  anim: Record<string, AnimInfo>;
  /** Atlas px per world px: 2 for the pack's own 32 px art, 4 for its smoothed 64 px build. */
  k: number;
  /** Tile size in the atlas. */
  T: number;
}

export interface FxArt {
  img: Cnv;
  frame: number;
  fx: Record<string, { r: Rect; n: number; ms: number; loop: boolean }>;
}


const BASE = `${(import.meta.env?.BASE_URL as string | undefined) ?? '/'}games/sigilfall/art/`;
const url = (f: string): string => `${BASE}${f}?v=${ART_VERSION}`;

const canLoad = (): boolean => typeof document !== 'undefined' && typeof Image !== 'undefined' && typeof fetch === 'function' && !navigator.userAgent.includes('jsdom');

function image(file: string): Promise<Cnv> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const c = canvas(img.naturalWidth, img.naturalHeight);
      ctx2d(c).drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error(`could not load ${file}`));
    img.src = url(file);
  });
}

async function data<T>(file: string): Promise<T> {
  const r = await fetch(url(file));
  if (!r.ok) throw new Error(`could not load ${file}: ${r.status}`);
  return (await r.json()) as T;
}

/* --------------------------------------------------------------- grades */

const hexRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Applies a grade to a region of a canvas, in place. */
export function applyGrade(c: Cnv, gr: Grade, x = 0, y = 0, w = c.width, h = c.height): void {
  if (!gr.sat && !gr.contrast && !gr.bright && !gr.hue && !gr.tint) return;
  const g = ctx2d(c);
  const img = g.getImageData(x, y, w, h);
  const d = img.data;
  const sat = gr.sat ?? 1;
  const con = gr.contrast ?? 1;
  const bri = (gr.bright ?? 0) * 255;
  // hue rotation in YIQ
  const a = ((gr.hue ?? 0) * Math.PI) / 180;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const tint = gr.tint ? hexRgb(gr.tint[0]) : null;
  const tk = gr.tint ? gr.tint[1] : 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = d[i]!;
    let gg = d[i + 1]!;
    let b = d[i + 2]!;
    if (a) {
      const Y = 0.299 * r + 0.587 * gg + 0.114 * b;
      const I = 0.596 * r - 0.274 * gg - 0.322 * b;
      const Q = 0.211 * r - 0.523 * gg + 0.312 * b;
      const I2 = I * cosA - Q * sinA;
      const Q2 = I * sinA + Q * cosA;
      r = Y + 0.956 * I2 + 0.621 * Q2;
      gg = Y - 0.272 * I2 - 0.647 * Q2;
      b = Y - 1.106 * I2 + 1.703 * Q2;
    }
    const l = 0.299 * r + 0.587 * gg + 0.114 * b;
    r = l + (r - l) * sat;
    gg = l + (gg - l) * sat;
    b = l + (b - l) * sat;
    if (tint) {
      // colorize: the tint at the pixel's lightness
      const k = (l / 160) * 1.05;
      r += (tint[0] * k - r) * tk;
      gg += (tint[1] * k - gg) * tk;
      b += (tint[2] * k - b) * tk;
    }
    d[i] = (r - 128) * con + 128 + bri;
    d[i + 1] = (gg - 128) * con + 128 + bri;
    d[i + 2] = (b - 128) * con + 128 + bri;
  }
  g.putImageData(img, x, y);
}

/* -------------------------------------------------------------- loaders */

interface TilesJson {
  size: number;
  cols: number;
  tiles: Record<string, number>;
}

const cache = new Map<string, Promise<unknown>>();
const ready = new Map<string, unknown>();
const failed = new Set<string>();

function once<T>(key: string, load: () => Promise<T>): T | null {
  const hit = ready.get(key);
  if (hit) return hit as T;
  if (failed.has(key) || !canLoad()) return null;
  if (!cache.has(key)) {
    cache.set(
      key,
      load().then(
        (v) => {
          ready.set(key, v);
          for (const fn of listeners) fn();
          return v;
        },
        (err: unknown) => {
          failed.add(key);
          console.warn('[sigilfall] art', key, err);
        },
      ),
    );
  }
  return null;
}

/** Lets go of a loaded piece of art (a land left behind), so a long journey never holds every land's atlases at once. */
export function forgetArt(key: string): void {
  ready.delete(key);
  cache.delete(key);
}

const listeners = new Set<() => void>();
/** Called whenever another piece of art has finished loading. */
export function onArt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A land's look: its season with its grade, and any derived ground sets. */
export interface LookKey {
  season: Season;
  grade: Grade;
  /** A grade for the water tiles only (murk, lava, ice), over the main one. */
  water?: Grade;
  derived?: Derived[];
  /** The smoothed 64 px build (the world's 4 art px per world px). */
  hd?: boolean;
}

const lookId = (k: LookKey): string => JSON.stringify(k);
export const worldArtKey = (k: LookKey): string => `world:${lookId(k)}`;

/** The world art for a look, or null while it loads (it calls onArt listeners when ready). */
export function worldArt(k: LookKey): WorldArt | null {
  return once(worldArtKey(k), async () => {
    const hd = k.hd ? '-hd' : '';
    const [tiles, json, props, pj] = await Promise.all([
      image(`rk-${k.season}${hd}.png`),
      data<TilesJson>('rk-tiles.json'),
      image(`rk-props-${k.season}${hd}.png`),
      data<{ props: Record<string, PropInfo>; anims: Record<string, AnimInfo> }>(`rk-props-${k.season}.json`),
    ]);
    // the smoothed build is the same layout at twice the size
    const m = k.hd ? 2 : 1;
    if (m !== 1) {
      for (const p of Object.values(pj.props)) {
        p.r = p.r.map((v) => v * m) as Rect;
        p.o = [p.o[0] * m, p.o[1] * m];
        if (p.fp) p.fp = [p.fp[0] * m, p.fp[1] * m];
        if (p.smoke) p.smoke = p.smoke.map(([x, y]) => [x * m, y * m]);
      }
      for (const a of Object.values(pj.anims)) {
        a.r = a.r.map((v) => v * m) as Rect;
        a.w *= m;
        a.h *= m;
      }
    }
    const T = json.size * m;
    const cols = json.cols;
    const rows0 = Math.ceil(Math.max(...Object.values(json.tiles)) / cols) + 1;
    const tile = { ...json.tiles };
    // derived sets go in new rows below the pack's
    const derived = k.derived ?? [];
    const extra: { name: string; src: number; grade: Grade }[] = [];
    for (const dv of derived) {
      for (const [name, idx] of Object.entries(json.tiles)) {
        if (name === dv.from || name.startsWith(`${dv.from}_`)) extra.push({ name: dv.name + name.slice(dv.from.length), src: idx, grade: dv.grade });
      }
    }
    const rows = rows0 + Math.ceil(extra.length / cols);
    const t = canvas(cols * T, rows * T);
    const tg = ctx2d(t);
    tg.drawImage(tiles, 0, 0);
    const at = (i: number): [number, number] => [(i % cols) * T, Math.floor(i / cols) * T];
    applyGrade(t, k.grade, 0, 0, t.width, rows0 * T);
    extra.forEach((e, j) => {
      const idx = rows0 * cols + j;
      const [sx, sy] = at(e.src);
      const [dx, dy] = at(idx);
      tg.drawImage(tiles, sx, sy, T, T, dx, dy, T, T);
      applyGrade(t, e.grade, dx, dy, T, T);
      applyGrade(t, k.grade, dx, dy, T, T);
      tile[e.name] = idx;
    });
    if (k.water) {
      for (const [name, idx] of Object.entries(tile)) {
        if (!name.startsWith('water_')) continue;
        const [x, y] = at(idx);
        applyGrade(t, k.water, x, y, T, T);
      }
    }
    applyGrade(props, k.grade);
    return { tiles: t, props, tile, tileAt: at, prop: pj.props, anim: pj.anims, k: 2 * m, T } satisfies WorldArt;
  });
}

export function fxArt(): FxArt | null {
  return once('fx', async () => {
    const [img, j] = await Promise.all([image('vfx.png'), data<Omit<FxArt, 'img'>>('vfx.json')]);
    return { img, ...j };
  });
}

const strips = new WeakMap<object, Cnv>();
/**
 * One effect's frames, side by side, cut out of the sheet the first time it plays. Drawing from the whole sheet costs
 * about 10 ms a time (the browser copies all of its 2048 × 5914 pixels), which a screen full of spells can't afford.
 */
export function stripOf(art: FxArt, s: FxArt['fx'][string]): Cnv {
  let c = strips.get(s);
  if (!c) {
    c = canvas(art.frame * s.n, art.frame);
    ctx2d(c).drawImage(art.img, s.r[0], s.r[1], art.frame * s.n, art.frame, 0, 0, art.frame * s.n, art.frame);
    strips.set(s, c);
  }
  return c;
}

export function circleArt(): FxArt | null {
  return once('circles', async () => {
    const [img, j] = await Promise.all([image('circles.png'), data<Omit<FxArt, 'img'>>('circles.json')]);
    return { img, ...j };
  });
}


/* ------------------------------------------------- story pieces */

/** Props at the world scale (k atlas px per world px), each with its ground point (Gloomvault's story pieces). */
export interface PropAtlas {
  img: Cnv;
  k: number;
  props: Record<string, { r: Rect; o: [number, number] }>;
}

export const propAtlasKey = (id: string, grade: Grade): string => `props:${id}:${JSON.stringify(grade)}`;

export function propAtlas(id: string, grade: Grade): PropAtlas | null {
  return once(propAtlasKey(id, grade), async () => {
    const [img, j] = await Promise.all([image(`props-${id}.png`), data<Omit<PropAtlas, 'img'>>(`props-${id}.json`)]);
    applyGrade(img, grade);
    return { ...j, img };
  });
}
