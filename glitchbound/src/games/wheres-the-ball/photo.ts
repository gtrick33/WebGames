/**
 * Photo levels for Where's the Ball?: a real photograph (leaves, lawns, markets, beaches...) with one
 * tennis ball placed in it. Every library photo has a reviewed real-world scale (how big a tennis
 * ball looks in it) and a ground line (the ball never floats in a hedge or the sky). A level can show
 * the whole photo or a zoomed-in crop, so one photo gives several different-looking levels.
 *
 * Placement is plain data chosen from the photo's busy spots (precomputed in photos.ts): levels are
 * seeded, the daily is identical for everyone, and the hitbox is exact. Painting lives in photoPaint.ts.
 */
import { PHOTOS, type Photo } from './photos';
import { difficultyFor, H, rng, W, type Scene } from './scene';

/** Dailies from this day on use photos (earlier dailies were published with drawn scenes). */
export const PHOTO_FROM = '2026-10-19';

type R = () => number;

export interface PhotoScene {
  id: string;
  title: string;
  mirror: boolean;
  /** The visible window of the photo (scene units of the full frame): top-left and zoom (1 = whole photo). */
  crop: { x: number; y: number; s: number };
  /** Part of the ball tucked under texture cloned from nearby: direction (radians) and share covered (0-0.5). */
  cover: { a: number; amt: number } | null;
}

/** Fisher-Yates (a random sort comparator would shuffle differently in each browser). */
function shuffled<T>(list: readonly T[], r: R): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Zoom levels a photo can be shown at. */
const ZOOMS = [1, 0.8, 0.65];
/** Largest ball (scene units) a level may have; closer crops than this are skipped. */
const MAX_R = 48;

export type Bucket = 'big' | 'mid' | 'small';
export const bucketOf = (radius: number): Bucket => (radius >= 16 ? 'big' : radius >= 8 ? 'mid' : 'small');

export interface Variant {
  photo: Photo;
  zoom: number;
}

/** Every (photo, zoom) pair, by how big the ball looks: big balls for warm-ups, tiny ones for the finale. */
function variants(): Record<Bucket, Variant[]> {
  const out: Record<Bucket, Variant[]> = { big: [], mid: [], small: [] };
  for (const photo of PHOTOS)
    for (const zoom of ZOOMS) {
      const radius = photo.scale / zoom;
      if (radius > MAX_R) continue;
      out[bucketOf(radius)].push({ photo, zoom });
    }
  return out;
}

export function makePhotoScene(seed: number, difficulty: number, photo: Photo, zoom = 1): Scene {
  const r = rng(seed);
  const diff = difficultyFor(difficulty);
  // Never mirrored: market tags and signs would read backwards. (The draw keeps the seed sequence stable.)
  r();
  const mirror = false;
  const s = zoom;
  // The crop leans towards the bottom of the photo, where the ground is.
  const x0 = Math.round(r() * W * (1 - s));
  const groundPx = photo.ground * H;
  const yMin = Math.min(H * (1 - s), groundPx * 0.6);
  const y0 = Math.round(yMin + r() * (H * (1 - s) - yMin));
  const R0 = Math.round(Math.min(MAX_R, Math.max(4, photo.scale / s)) * 10) / 10;
  const groundY = Math.max(0, (groundPx - y0) / s);
  const margin = Math.max(30, R0 + 12);
  const pts = photo.pts
    .map(([x, y, detail, , lum]) => ({ x: ((mirror ? W - x : x) - x0) / s, y: (y - y0) / s, detail, lum }))
    .filter((p) => p.x > margin && p.x < W - margin && p.y > Math.max(margin, groundY + R0 * 1.5) && p.y < H - margin);
  // Easy levels hide the ball in calmer, well-lit spots; harder ones in the busiest, darkest corners.
  const hard = Math.min(1, difficulty / 4);
  const score = (p: (typeof pts)[number]): number => -Math.abs(p.detail - (35 + hard * 60)) - (p.lum < 18 || p.lum > 92 ? 40 : 0) + r() * 25;
  const best = shuffled(pts, r)
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s)[0]?.p ?? { x: W / 2, y: Math.max(H / 2, Math.min(H - margin, groundY + R0 * 2)), detail: 50, lum: 50 };
  const jitter = (v: number, lo: number, hi: number): number => Math.round(Math.min(hi, Math.max(lo, v + (r() - 0.5) * R0 * 2.5)));
  const x = jitter(best.x, margin, W - margin);
  const y = jitter(best.y, Math.max(margin, Math.min(H - margin, groundY + R0)), H - margin);
  const shade = Math.max(0, Math.min(0.45, (58 - best.lum) / 90));
  const cover = r() < diff.cover ? { a: r() * Math.PI * 2, amt: 0.2 + r() * 0.25 * Math.min(1, 0.5 + hard) } : null;
  return {
    env: 'lawn',
    seed,
    variant: 0,
    under: [],
    over: [],
    ball: { x, y, r: R0, rot: r() * Math.PI, shade, dust: 0 },
    difficulty,
    photo: { id: photo.id, title: photo.title, mirror, crop: { x: x0, y: y0, s }, cover },
  };
}

/* ------------------------------------------------------------------ which photo */

let pools: Record<Bucket, Variant[]> | null = null;
const orders = new Map<string, Variant[]>();

/** One bucket's variants in a fixed shuffled order per pass (every variant once before any repeats). */
function order(bucket: Bucket, cycle: number, salt = 0): Variant[] {
  const key = `${bucket}:${cycle}:${salt}`;
  let o = orders.get(key);
  if (!o) {
    pools ??= variants();
    const sorted = [...pools[bucket]].sort((a, b) => (a.photo.id < b.photo.id ? -1 : a.photo.id > b.photo.id ? 1 : a.zoom - b.zoom));
    o = shuffled(sorted, rng(0xba11 + cycle * 7919 + salt * 104729 + bucket.length * 31));
    orders.set(key, o);
  }
  return o;
}

function nth(bucket: Bucket, n: number, salt = 0): Variant | null {
  pools ??= variants();
  const len = pools[bucket].length;
  if (!len) return null;
  return order(bucket, Math.floor(n / len), salt)[n % len]!;
}

/** Ball size for each daily level: two warm-ups, two medium, one tiny finale. */
export const DAILY_BUCKETS: Bucket[] = ['big', 'big', 'mid', 'mid', 'small'];

/** The schedule before photos were rested (day 0, 2026-10-19, keeps the photos it was played with). */
function firstVariant(day: number, index: number): Variant | null {
  const bucket = DAILY_BUCKETS[index] ?? 'mid';
  const perDay = DAILY_BUCKETS.filter((b) => b === bucket).length;
  const slot = DAILY_BUCKETS.slice(0, index).filter((b) => b === bucket).length;
  // Never the same photo twice in one day: skip ahead past photos used by the day's earlier levels.
  const used = new Set<string>();
  for (let i = 0; i < index; i++) {
    const v = firstVariant(day, i);
    if (v) used.add(v.photo.id);
  }
  for (let k = 0; k < 50; k++) {
    const v = nth(bucket, day * perDay + slot + k * 997);
    if (v && !used.has(v.photo.id)) return v;
  }
  return nth(bucket, day * perDay + slot);
}

/**
 * A photo shown in a daily rests this many days before it comes back at any zoom (when the library
 * allows), so a returning player doesn't keep meeting the same picture. From day REST_FROM on.
 */
export const PHOTO_REST_DAYS = 21;
const REST_FROM = 1;

/** Daily photos from REST_FROM on, worked out day by day (each day needs the days before it). */
const rested: (Variant | null)[][] = [];
/** Per bucket: how far along its shuffled order the schedule is, and the slots taken out of turn. */
const cursor: Record<Bucket, number> = { big: 0, mid: 0, small: 0 };
const taken: Record<Bucket, Set<number>> = { big: new Set(), mid: new Set(), small: new Set() };
/** From this day number on (2026-12-01; earlier dailies keep their photos), the fallback rests photos too. */
const RELAX_FROM = 43;
/** The last day each photo was shown in a daily (days from REST_FROM on). */
const lastShown = new Map<string, number>();

function dayVariants(day: number): (Variant | null)[] {
  if (day < REST_FROM) return DAILY_BUCKETS.map((_, i) => firstVariant(day, i));
  pools ??= variants();
  while (rested.length <= day - REST_FROM) {
    const d = REST_FROM + rested.length;
    if (rested.length === 0) for (const b of ['big', 'mid', 'small'] as const) cursor[b] = d * DAILY_BUCKETS.filter((x) => x === b).length;
    const recent = new Set<string>();
    for (let back = 1; back <= PHOTO_REST_DAYS && d - back >= 0; back++) for (const v of dayVariants(d - back)) if (v) recent.add(v.photo.id);
    const today: (Variant | null)[] = [];
    for (const bucket of DAILY_BUCKETS) {
      const len = pools[bucket].length;
      if (!len) {
        today.push(null);
        continue;
      }
      while (taken[bucket].has(cursor[bucket])) taken[bucket].delete(cursor[bucket]++);
      const fresh = (v: Variant | null): boolean => !!v && !today.some((t) => t?.photo.id === v.photo.id);
      // The next variant in turn whose photo has rested.
      let pick = -1;
      for (let k = 0; k < len && pick < 0; k++) {
        const n = cursor[bucket] + k;
        const v = nth(bucket, n);
        if (!taken[bucket].has(n) && fresh(v) && !recent.has(v!.photo.id)) pick = n;
      }
      // Failing that (a small library), the next in turn that rested at least two weeks, then one week
      // (from RELAX_FROM on), then any not shown today.
      const rests = d >= RELAX_FROM ? [14, 7, 0] : [0];
      for (const rest of rests)
        for (let k = 0; k < len && pick < 0; k++) {
          const n = cursor[bucket] + k;
          const v = nth(bucket, n);
          if (!taken[bucket].has(n) && fresh(v) && (rest === 0 || (lastShown.get(v!.photo.id) ?? -Infinity) <= d - rest)) pick = n;
        }
      if (pick < 0) pick = cursor[bucket];
      if (pick === cursor[bucket]) cursor[bucket]++;
      else taken[bucket].add(pick);
      today.push(nth(bucket, pick));
    }
    for (const v of today) if (v) lastShown.set(v.photo.id, d);
    rested.push(today);
  }
  return rested[day - REST_FROM]!;
}

/** The daily's photo (and zoom) for level `index` on day number `day` (0 = PHOTO_FROM). */
export function dailyVariant(day: number, index: number): Variant | null {
  return dayVariants(day)[index] ?? null;
}

/** Ball size for Endless level `index`: big balls first, then mostly medium and small. */
export const endlessBucket = (index: number): Bucket => (index < 2 ? 'big' : index < 5 ? 'mid' : index % 3 === 0 ? 'mid' : 'small');

/** Each run order's photos so far (a run's order depends only on `runSeed % 997`). */
const runs = new Map<number, (Variant | null)[]>();

/**
 * The Endless run's (and a challenge's) photo for level `index`. Each bucket walks its own shuffle; a
 * photo already shown in the run (at any zoom) is skipped for the next one in that bucket, so a photo
 * comes back only once the bucket has no new one left. Levels that never met a repeat keep their photo.
 */
export function runVariant(runSeed: number, index: number): Variant | null {
  const salt = 1 + (runSeed % 997);
  let list = runs.get(salt);
  if (!list) runs.set(salt, (list = []));
  pools ??= variants();
  while (list.length <= index) {
    const i = list.length;
    const bucket = endlessBucket(i);
    let k = 0;
    for (let j = 0; j < i; j++) if (endlessBucket(j) === bucket) k++;
    const used = new Set(list.map((v) => v?.photo.id));
    let pick = nth(bucket, k, salt);
    for (let t = 0; t < pools[bucket].length && pick && used.has(pick.photo.id); t++) {
      const v = nth(bucket, k + t, salt);
      if (v && !used.has(v.photo.id)) pick = v;
    }
    list.push(pick);
  }
  return list[index] ?? null;
}

export const hasPhotos = (): boolean => PHOTOS.length > 0;

/**
 * Short English place names for photos whose Commons title is in another language, carries file-name
 * noise or doesn't describe the picture. Shown in the top bar; the scene keeps the original title.
 */
const TITLES: Record<string, string> = {
  '103768424': 'Towels on shelves',
  '129127730': 'Moss between paving stones',
  '132005334': 'Grassland',
  '144245060': 'Wildflowers in Bahar',
  '144245061': 'Wildflowers in Bahar',
  '144245066': 'Wildflowers in Bahar',
  '148242086': 'Buttercup meadow',
  '15399221': 'Melon market',
  '167827431': 'Meadow',
  '19211487': 'Harvested lemons',
  '23381076': 'Seashell beach',
  '27780102': 'Orange bell peppers',
  '31171848': 'Cones on a path',
  '31401382': 'Forest floor',
  '38253301': 'Onion market',
  '39933530': 'Fallen leaves',
  '40319468': 'Flower bed',
  '45607455': 'Cobblestone street, Pompeii',
  '48818996': 'Pebble beach',
  '52106516': 'Tulip garden',
  '57022609': 'Dry leaves',
  '57350744': 'Jack Nicklaus Park',
  '57356573': 'Pumpkin patch',
  '58282353': 'Seedlings in garden soil',
  '58306535': 'Seedlings in garden soil',
  '58790422': 'Misty forest path',
  '58818579': 'Dandelion field',
  '59046141': 'Melon market',
  '59046151': 'Melon market',
  '59046163': 'Melon market',
  '59842108': 'Seedlings in garden soil',
  '37686351': 'Seedlings in garden soil',
  '62013770': 'Buttress roots',
  '68794263': 'Tall buttercups, Bozeman',
  '71589942': 'Rocky shore',
  '77444674': 'Daisy lawn',
  '78161136': 'Wildflowers on Cape Lisburne',
  '79608658': 'Wildflower meadow',
  '79634669': 'Log decks',
  '89593472': 'Buttercup meadow',
  '29513238': 'Leaves on a path',
};

/** The place name shown for a library photo. */
export const photoTitle = (id: string, title: string): string => TITLES[id] ?? title;

/**
 * A photo's creator as a credit: Commons creators are clipped at 80 characters, so a clipped one ends at
 * its last whole sentence; a trailing period and an account handle repeated after the name go.
 */
export function creatorName(creator: string): string {
  let c = creator.trim();
  if (c.length >= 80) {
    const end = c.lastIndexOf('. ');
    c = end > 0 ? c.slice(0, end) : c.slice(0, c.lastIndexOf(' ')).replace(/[,;:]$/, '');
  }
  c = c.replace(/\.$/, '');
  const words = c.split(' ');
  if (words.length > 2 && /^[a-z0-9_]+$/.test(words[words.length - 1]!)) c = words.slice(0, -1).join(' ');
  return /^(unknown|anonymous|unknown photographer|free for commercial use)$/i.test(c) ? '' : c;
}

/** Credit line for a library photo (all are CC0 or public domain; credit is a courtesy). */
export function photoCredit(id: string): { text: string; source: string } | null {
  const p = PHOTOS.find((x) => x.id === id);
  if (!p) return null;
  const name = creatorName(p.creator ?? '');
  const by = name ? ` by ${name}` : '';
  return { text: `Photo${by} · ${p.license === 'cc0' ? 'CC0' : 'Public domain'} · Wikimedia Commons`, source: p.source };
}
