/**
 * The destructible ground: a W x H mask (1 = solid) built from a seed and one of the ten landforms,
 * then every crater blown into it so far. Pure and deterministic, so the room server and every phone
 * hold the same ground. Also finds where the crews start and where the scenery stands.
 */
import { clamp, fbm1, fbm2, hash01, noise1, rng, smoothstep } from './math';
import { TERRAINS, type Decor, type TerrainId } from './terrains';

export const W = 1800;
export const H = 900;
export type Mask = Uint8Array;

/**
 * A unit stands on (x, y), y being the row just above the ground: an 11 px wide body 20 px tall whose
 * bottom 6 rows are only its feet (one column), so it can stand on slopes up to about 50 degrees.
 */
export const HALF_W = 5;
export const BODY_H = 20;
const FEET = 6;

export const isSolid = (m: Mask, x: number, y: number): boolean => x >= 0 && x < W && y >= 0 && y < H && m[y * W + x] === 1;

function boxFree(m: Mask, x0: number, x1: number, y0: number, y1: number): boolean {
  x0 = Math.max(0, x0);
  x1 = Math.min(W - 1, x1);
  y0 = Math.max(0, y0);
  y1 = Math.min(H - 1, y1);
  for (let yy = y0; yy <= y1; yy++) {
    const row = yy * W;
    for (let xx = x0; xx <= x1; xx++) if (m[row + xx] === 1) return false;
  }
  return true;
}

/** Whether a unit fits at (x, y) (rounded). */
export function bodyFree(m: Mask, fx: number, fy: number): boolean {
  const x = Math.round(fx);
  const y = Math.round(fy);
  return boxFree(m, x - HALF_W, x + HALF_W, y - BODY_H + 1, y - FEET) && boxFree(m, x, x, y - FEET + 1, y);
}

/** Solid ground right under a unit's feet. */
export function grounded(m: Mask, fx: number, fy: number): boolean {
  const x = Math.round(fx);
  const y = Math.round(fy) + 1;
  for (let xx = x - 2; xx <= x + 2; xx++) if (isSolid(m, xx, y)) return true;
  return false;
}

/** Resting: on the ground, or wedged where it can't drop even a pixel. */
export const supported = (m: Mask, x: number, y: number): boolean => grounded(m, x, y) || !bodyFree(m, x, y + 1);

export function carve(m: Mask, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= H) continue;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    const x0 = Math.max(0, cx - half);
    const x1 = Math.min(W - 1, cx + half);
    if (x1 >= x0) m.fill(0, y * W + x0, y * W + x1 + 1);
  }
}

function fillEllipse(m: Mask, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++) {
    const t = (y - cy) / ry;
    // a flat-ish top and a craggy underside
    const bump = y > cy ? 1 - 0.35 * noise1(seed, y / 9) : 1;
    const half = rx * Math.sqrt(Math.max(0, 1 - t * t)) * bump;
    const x0 = Math.max(0, Math.round(cx - half));
    const x1 = Math.min(W - 1, Math.round(cx + half));
    if (x1 >= x0) m.fill(1, y * W + x0, y * W + x1 + 1);
  }
}

function fillRoundRect(m: Mask, x: number, y: number, w: number, h: number, r: number): void {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    const dy = yy < y + r ? y + r - yy : yy > y + h - 1 - r ? yy - (y + h - 1 - r) : 0;
    const inset = dy > 0 ? r - Math.sqrt(Math.max(0, r * r - dy * dy)) : 0;
    const x0 = Math.max(0, Math.round(x + inset));
    const x1 = Math.min(W - 1, Math.round(x + w - 1 - inset));
    if (x1 >= x0) m.fill(1, yy * W + x0, yy * W + x1 + 1);
  }
}

/** Fills every column from its surface down. */
function fillTops(m: Mask, top: Float64Array): void {
  for (let x = 0; x < W; x++) {
    const t = Math.max(0, Math.round(top[x]!));
    for (let y = t; y < H; y++) m[y * W + x] = 1;
  }
}

/** Sinks the ground near the map's ends under the liquid, so the battlefield ends in a shore. */
function shore(top: Float64Array, under: number, margin: number): void {
  for (let x = 0; x < W; x++) {
    const k = smoothstep(0, margin, x) * smoothstep(0, margin, W - 1 - x);
    top[x] = under - (under - top[x]!) * k;
  }
}

type Gen = (m: Mask, seed: number) => void;

const GENS: Record<TerrainId, Gen> = {
  meadow(m, s) {
    const top = new Float64Array(W);
    for (let x = 0; x < W; x++) top[x] = 520 + (fbm1(s, x / 300, 4) - 0.5) * 560 + (noise1(s + 7, x / 900) - 0.5) * 180;
    shore(top, 900, 150);
    fillTops(m, top);
    const r = rng(s ^ 0x51);
    for (let i = 0; i < 2; i++) {
      const cx = 300 + r() * (W - 600);
      const ground = top[Math.round(cx)]!;
      if (ground > 420) fillEllipse(m, cx, ground - 170 - r() * 60, 70 + r() * 40, 16 + r() * 8, s + i);
    }
  },
  dunes(m, s) {
    const top = new Float64Array(W);
    for (let x = 0; x < W; x++) top[x] = 610 + (fbm1(s, x / 450, 3) - 0.5) * 400 + (noise1(s + 3, x / 110) - 0.5) * 36;
    const r = rng(s ^ 0xd0);
    for (let i = 0; i < 3; i++) {
      const c = 220 + ((i + r() * 0.6) / 3) * (W - 440);
      const hw = 60 + r() * 70;
      const mesa = 340 + r() * 110 + (noise1(s + 11, i) - 0.5) * 20;
      for (let x = Math.max(0, Math.floor(c - hw - 40)); x <= Math.min(W - 1, Math.ceil(c + hw + 40)); x++) {
        const k = smoothstep(hw + 34, hw, Math.abs(x - c));
        const flat = mesa + (noise1(s + 13, x / 22) - 0.5) * 8;
        if (flat < top[x]!) top[x] = top[x]! * (1 - k) + flat * k;
      }
    }
    shore(top, 900, 170);
    fillTops(m, top);
  },
  peaks(m, s) {
    const top = new Float64Array(W);
    for (let x = 0; x < W; x++) {
      const ridge = 1 - Math.abs(2 * fbm1(s, x / 380, 5) - 1);
      top[x] = 780 - Math.pow(ridge, 1.6) * 560 + (noise1(s + 9, x / 14) - 0.5) * 12;
    }
    shore(top, 900, 120);
    fillTops(m, top);
  },
  magma(m, s) {
    const r = rng(s ^ 0x3a);
    const cones = [
      { c: W * (0.28 + r() * 0.12), h: 330 + r() * 80, w: 330 },
      { c: W * (0.68 + r() * 0.14), h: 200 + r() * 70, w: 250 },
    ];
    const top = new Float64Array(W);
    for (let x = 0; x < W; x++) {
      let t = 650 + (fbm1(s, x / 260, 4) - 0.5) * 220;
      for (const k of cones) {
        const d = Math.abs(x - k.c);
        const c = Math.max(0, 1 - d / k.w);
        t -= Math.pow(c, 1.35) * k.h;
        if (d < 46) t += (1 - d / 46) * (1 - d / 46) * 80;
      }
      top[x] = t;
    }
    shore(top, 900, 130);
    fillTops(m, top);
  },
  atoll(m, s) {
    const r = rng(s ^ 0xa7);
    const n = 4 + Math.floor(r() * 2);
    const top = new Float64Array(W).fill(H + 10);
    for (let i = 0; i < n; i++) {
      const c = ((i + 0.5) / n) * W + (r() - 0.5) * 80;
      const hw = 120 + r() * 70;
      const h = 150 + r() * 160;
      for (let x = Math.max(0, Math.floor(c - hw)); x <= Math.min(W - 1, Math.ceil(c + hw)); x++) {
        const d = (x - c) / hw;
        const t = 830 - h * Math.pow(Math.max(0, 1 - d * d), 0.65) + (fbm1(s + i, x / 90, 3) - 0.5) * 50;
        top[x] = Math.min(top[x]!, t);
      }
    }
    fillTops(m, top);
  },
  moon(m, s) {
    const top = new Float64Array(W);
    for (let x = 0; x < W; x++) top[x] = 560 + (fbm1(s, x / 380, 4) - 0.5) * 380;
    shore(top, 900, 160);
    fillTops(m, top);
    const r = rng(s ^ 0x6e);
    for (let i = 0; i < 7; i++) {
      const cx = Math.round(160 + r() * (W - 320));
      const rad = Math.round(30 + r() * 46);
      carve(m, cx, Math.round(top[cx]! - rad * 0.3), rad);
    }
  },
  sugar(m, s) {
    const r = rng(s ^ 0x5c);
    const top = new Float64Array(W);
    let x = 0;
    let last = -1;
    while (x < W) {
      const w = 70 + Math.floor(r() * 90);
      const raw = 600 + (fbm1(s, (x + w / 2) / 340, 3) - 0.5) * 460;
      let h = Math.round(raw / 34) * 34;
      if (last >= 0) h = clamp(h, last - 68, last + 68);
      for (let xx = x; xx < Math.min(W, x + w); xx++) top[xx] = h;
      last = h;
      x += w;
    }
    shore(top, 900, 130);
    fillTops(m, top);
    for (let i = 0; i < 3; i++) {
      const w = 120 + Math.floor(r() * 70);
      const cx = Math.round(((i + 0.5) / 3) * W + (r() - 0.5) * 200);
      const y = Math.round(Math.min(top[clamp(cx, 0, W - 1)]! - 150, 220 + r() * 170));
      fillRoundRect(m, cx - Math.round(w / 2), y, w, 44 + Math.floor(r() * 14), 14);
    }
  },
  hollow(m, s) {
    const top = new Float64Array(W);
    for (let x = 0; x < W; x++) top[x] = 210 + (fbm1(s, x / 240, 4) - 0.5) * 220;
    shore(top, 900, 190);
    fillTops(m, top);
    const tunnels = [430, 640].map((base, i) => (x: number) => base + (noise1(s + 21 + i, x / 300) - 0.5) * 170);
    for (let y = 0; y < 845; y++) {
      for (let x = 0; x < W; x++) {
        if (y < top[x]! + 55) continue;
        let open = fbm2(s, x / 170, y / 95, 3) > 0.6;
        if (!open && x > 150 && x < W - 150)
          for (const t of tunnels) if (Math.abs(y - t(x)) < 24 + 10 * noise1(s + 5, x / 60)) open = true;
        if (open) m[y * W + x] = 0;
      }
    }
  },
  graves(m, s) {
    const top = new Float64Array(W);
    for (let x = 0; x < W; x++) top[x] = 520 + (fbm1(s, x / 280, 4) - 0.5) * 460;
    shore(top, 900, 150);
    fillTops(m, top);
    for (let x = 0; x < W; x++) {
      const t = Math.round(top[x]!);
      for (let y = t + 16; y < Math.min(H, t + 150); y++) if (fbm2(s + 5, x / 70, y / 40, 2) > 0.67) m[y * W + x] = 0;
    }
  },
  scrap(m, s) {
    const r = rng(s ^ 0x5e);
    const top = new Float64Array(W);
    let x = 0;
    let last = -1;
    while (x < W) {
      const w = 60 + Math.floor(r() * 100);
      let h = Math.round((560 + (fbm1(s, (x + w / 2) / 320, 3) - 0.5) * 440) / 30) * 30;
      if (last >= 0) h = clamp(h, last - 30, last + 30);
      for (let xx = x; xx < Math.min(W, x + w); xx++) top[xx] = h;
      last = h;
      x += w;
    }
    for (let i = 0; i < 2; i++) {
      const c = Math.round(300 + r() * (W - 600));
      for (let xx = c - 18; xx <= c + 18; xx++) top[xx] = top[xx]! - 90;
    }
    shore(top, 900, 110);
    fillTops(m, top);
    let minTop = H;
    for (let xx = 0; xx < W; xx++) minTop = Math.min(minTop, top[xx]!);
    for (let i = 0; i < 4; i++) {
      const w = 110 + Math.floor(r() * 50);
      const cx = Math.round(((i + 0.5) / 4) * W + (r() - 0.5) * 160);
      const y = Math.round(clamp(top[clamp(cx, 0, W - 1)]! - 120 - r() * 90, 160, 700));
      fillRoundRect(m, cx - Math.round(w / 2), y, w, 14, 3);
    }
  },
};

/** The ground as the map starts (cached: the room server and the phones ask for it often). */
const baseCache = new Map<string, Mask>();
export function baseMask(seed: number, terrain: TerrainId): Mask {
  const key = `${seed}:${terrain}`;
  let m = baseCache.get(key);
  if (!m) {
    m = new Uint8Array(W * H);
    GENS[terrain](m, seed >>> 0);
    if (baseCache.size >= 3) baseCache.delete(baseCache.keys().next().value!);
    baseCache.set(key, m);
  }
  return m;
}

/** The ground after `craters` (flat x, y, r triples): always a fresh copy the caller may change. */
const lastCache: { key: string; craters: number; mask: Mask } = { key: '', craters: 0, mask: new Uint8Array(0) };
export function maskFor(seed: number, terrain: TerrainId, craters: readonly number[]): Mask {
  const key = `${seed}:${terrain}`;
  const n = craters.length;
  let m: Mask;
  if (lastCache.key === key && lastCache.craters <= n && lastCache.mask.length === W * H) {
    m = lastCache.mask.slice();
    for (let i = lastCache.craters; i + 2 < n; i += 3) carve(m, craters[i]!, craters[i + 1]!, craters[i + 2]!);
  } else {
    m = baseMask(seed, terrain).slice();
    for (let i = 0; i + 2 < n; i += 3) carve(m, craters[i]!, craters[i + 1]!, craters[i + 2]!);
  }
  lastCache.key = key;
  lastCache.craters = n;
  lastCache.mask = m.slice();
  return m;
}

/** Spots where a unit can stand: air with ground right below and room for its body. */
function standSpots(m: Mask, maxY: number, step: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let x = 40; x < W - 40; x += step) {
    for (let y = 30; y < maxY; y++) {
      if (m[y * W + x] === 0 && m[(y + 1) * W + x] === 1 && grounded(m, x, y) && bodyFree(m, x, y) && bodyFree(m, x, y - 16)) out.push({ x, y });
    }
  }
  return out;
}

/** Where `n` units start: spread out, above the liquid, the same for every seed. */
export function findSpawns(m: Mask, terrain: TerrainId, n: number, seed: number): { x: number; y: number }[] {
  const maxY = TERRAINS[terrain].liquidY - 40;
  const spots = standSpots(m, maxY, 6);
  const r = rng(seed ^ 0x5a7);
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [spots[i], spots[j]] = [spots[j]!, spots[i]!];
  }
  let gap = (W / (n + 1)) * 0.9;
  for (;;) {
    const picked: { x: number; y: number }[] = [];
    for (const p of spots) {
      if (picked.every((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) * 0.5 >= gap)) picked.push(p);
      if (picked.length === n) return picked;
    }
    if (gap < 4) {
      // a map with almost nowhere to stand: put the rest just above the ground, spread out
      for (let k = 0; picked.length < n; k++) {
        const x = Math.round(((k + 1) / (n + 1)) * W);
        let y = 30;
        while (y < maxY && !isSolid(m, x, y + 1)) y++;
        while (y > 30 && !bodyFree(m, x, y)) y--;
        picked.push({ x, y });
      }
      return picked;
    }
    gap *= 0.85;
  }
}

export interface DecorSpot {
  kind: Decor;
  x: number;
  y: number;
  /** Size, 0.8..1.25. */
  s: number;
  flip: boolean;
}

/** The scenery on a map (only drawn; it never blocks a shot). */
export function decorSpots(m: Mask, terrain: TerrainId, seed: number): DecorSpot[] {
  const def = TERRAINS[terrain];
  const spots = standSpots(m, def.liquidY - 6, 9);
  const out: DecorSpot[] = [];
  let lastX = -999;
  let i = 0;
  for (const p of spots) {
    i++;
    const h = hash01(seed ^ 0xdec0, i);
    if (h > 0.55) continue;
    if (Math.abs(p.x - lastX) < 34 && out.some((o) => Math.abs(o.x - p.x) < 34 && Math.abs(o.y - p.y) < 40)) continue;
    // something to stand on across the whole base
    if (!isSolid(m, p.x - 4, p.y + 5) || !isSolid(m, p.x + 4, p.y + 5)) continue;
    const kind = def.decor[Math.floor(hash01(seed ^ 0xbeef, i) * def.decor.length)]!;
    out.push({ kind, x: p.x, y: p.y + 2, s: 0.8 + hash01(seed ^ 0x51ce, i) * 0.45, flip: hash01(seed ^ 0xf11b, i) < 0.5 });
    lastX = p.x;
  }
  return out;
}
