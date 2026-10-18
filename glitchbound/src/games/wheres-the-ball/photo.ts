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

/** The daily's photo (and zoom) for level `index` on day number `day` (0 = PHOTO_FROM). */
export function dailyVariant(day: number, index: number): Variant | null {
  const bucket = DAILY_BUCKETS[index] ?? 'mid';
  const perDay = DAILY_BUCKETS.filter((b) => b === bucket).length;
  const slot = DAILY_BUCKETS.slice(0, index).filter((b) => b === bucket).length;
  // Never the same photo twice in one day: skip ahead past photos used by the day's earlier levels.
  const used = new Set<string>();
  for (let i = 0; i < index; i++) {
    const v = dailyVariant(day, i);
    if (v) used.add(v.photo.id);
  }
  for (let k = 0; k < 50; k++) {
    const v = nth(bucket, day * perDay + slot + k * 997);
    if (v && !used.has(v.photo.id)) return v;
  }
  return nth(bucket, day * perDay + slot);
}

/** Ball size for Endless level `index`: big balls first, then mostly medium and small. */
export const endlessBucket = (index: number): Bucket => (index < 2 ? 'big' : index < 5 ? 'mid' : index % 3 === 0 ? 'mid' : 'small');

/** The Endless run's photo for level `index`: each bucket walks its own shuffle, so no repeats in a run. */
export function runVariant(runSeed: number, index: number): Variant | null {
  const bucket = endlessBucket(index);
  let k = 0;
  for (let i = 0; i < index; i++) if (endlessBucket(i) === bucket) k++;
  return nth(bucket, k, 1 + (runSeed % 997));
}

export const hasPhotos = (): boolean => PHOTOS.length > 0;

/** Credit line for a library photo (all are CC0 or public domain; credit is a courtesy). */
export function photoCredit(id: string): { text: string; source: string } | null {
  const p = PHOTOS.find((x) => x.id === id);
  if (!p) return null;
  const by = p.creator && !/^(unknown|anonymous)$/i.test(p.creator) ? ` by ${p.creator}` : '';
  return { text: `Photo${by} · ${p.license === 'cc0' ? 'CC0' : 'Public domain'} · Wikimedia Commons`, source: p.source };
}
