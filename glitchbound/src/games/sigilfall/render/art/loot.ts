import { canvas, ctx2d, type Cnv } from '../pixel';

/**
 * Chests and what lies on the ground, painted smooth at the heroes' detail (LOOT_K art pixels a world pixel)
 * instead of flat squares: a banded wooden chest whose metal tells its tier, open with its coins showing;
 * coins, the health orb and the rift shard as small shaded shapes.
 */
export const LOOT_K = 4;

const INK = '#1b1428';
const BAND: Record<string, { band: string; hi: string; lock: string }> = {
  common: { band: '#6d7280', hi: '#a9aebb', lock: '#ffcf5a' },
  rare: { band: '#3f7fd0', hi: '#8cc4ff', lock: '#ffe08a' },
  epic: { band: '#8a4fd8', hi: '#d2a8ff', lock: '#ffcf5a' },
};

const cache = new Map<string, Cnv>();
const once = (key: string, make: () => Cnv): Cnv => {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
};

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A chest, 18 × 16 world pixels (its foot on the bottom row). */
export const CHEST_W = 18;
export const CHEST_H = 16;

export function chestArt(tier: string, open: boolean): Cnv {
  return once(`chest:${tier}:${open}`, () => {
    const k = LOOT_K;
    const c = canvas(CHEST_W * k, CHEST_H * k);
    const g = ctx2d(c);
    g.scale(k, k);
    const m = BAND[tier] ?? BAND.common!;
    // its shadow on the ground
    g.fillStyle = 'rgba(10,8,20,0.28)';
    g.beginPath();
    g.ellipse(9, 14.6, 8.4, 1.6, 0, 0, Math.PI * 2);
    g.fill();
    // the box: planks under an outline, darker at the bottom
    const body = g.createLinearGradient(0, 7, 0, 14);
    body.addColorStop(0, '#a8703f');
    body.addColorStop(1, '#6e4426');
    g.lineWidth = 1.1;
    g.strokeStyle = INK;
    roundRect(g, 1.5, 7, 15, 7.4, 1.2);
    g.fillStyle = body;
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(40,22,10,0.55)';
    g.lineWidth = 0.4;
    for (const y of [9.4, 11.8]) {
      g.beginPath();
      g.moveTo(2.4, y);
      g.lineTo(15.6, y);
      g.stroke();
    }
    if (open) {
      // the lid thrown back, its inside dark; inside, coins catching the light
      const lid = g.createLinearGradient(0, 1, 0, 7);
      lid.addColorStop(0, '#5a361c');
      lid.addColorStop(1, '#3a2212');
      g.lineWidth = 1.1;
      g.strokeStyle = INK;
      roundRect(g, 2, 1.2, 14, 6.2, 2.4);
      g.fillStyle = lid;
      g.fill();
      g.stroke();
      g.fillStyle = '#24140c';
      g.fillRect(2.6, 6.6, 12.8, 1.6);
      g.fillStyle = '#ffcf5a';
      for (const [x, y] of [[5.5, 7.2], [8.5, 6.8], [11.6, 7.3], [7, 7.6], [10, 7.7]] as const) {
        g.beginPath();
        g.ellipse(x, y, 1.3, 0.8, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fff2b0';
      g.fillRect(8.1, 6.4, 0.7, 0.4);
      g.fillStyle = m.band;
      g.fillRect(2, 3.6, 14, 0.9);
    } else {
      // an arched lid with a highlight along its top
      const lid = g.createLinearGradient(0, 2, 0, 8);
      lid.addColorStop(0, '#c28a52');
      lid.addColorStop(1, '#8a5a34');
      g.lineWidth = 1.1;
      g.strokeStyle = INK;
      g.beginPath();
      g.moveTo(1.5, 8);
      g.lineTo(1.5, 5.4);
      g.quadraticCurveTo(9, 0.6, 16.5, 5.4);
      g.lineTo(16.5, 8);
      g.closePath();
      g.fillStyle = lid;
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(255,230,190,0.45)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(3.4, 4.4);
      g.quadraticCurveTo(9, 1.8, 14.6, 4.4);
      g.stroke();
      g.fillStyle = m.band;
      g.fillRect(1.6, 7.2, 14.8, 1);
    }
    // metal bands and corners in the tier's color
    for (const x of [4.2, 12.6]) {
      g.fillStyle = m.band;
      g.fillRect(x, open ? 7.4 : 3.2, 1.4, open ? 6.8 : 11);
      g.fillStyle = m.hi;
      g.fillRect(x, open ? 7.4 : 3.2, 0.5, open ? 6.8 : 11);
    }
    // the lock
    g.lineWidth = 0.6;
    g.strokeStyle = INK;
    roundRect(g, 7.6, open ? 8.2 : 6.6, 2.8, 3.2, 0.6);
    g.fillStyle = m.lock;
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.fillRect(8.75, open ? 9.2 : 7.6, 0.6, 1.2);
    return c;
  });
}

/** A few coins, 7 × 5 world pixels. */
export function coinArt(shine: boolean): Cnv {
  return once(`coins:${shine}`, () => {
    const k = LOOT_K;
    const c = canvas(7 * k, 5 * k);
    const g = ctx2d(c);
    g.scale(k, k);
    for (const [x, y] of [[2.4, 3.2], [4.6, 3.4], [3.5, 2.1]] as const) {
      g.fillStyle = INK;
      g.beginPath();
      g.ellipse(x, y, 1.9, 1.3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8a83a';
      g.beginPath();
      g.ellipse(x, y, 1.5, 0.95, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffd86a';
      g.beginPath();
      g.ellipse(x - 0.2, y - 0.2, 1, 0.55, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (shine) {
      g.fillStyle = '#fffbe0';
      g.fillRect(3.1, 1.4, 0.7, 0.5);
    }
    return c;
  });
}

/** The health orb, 8 × 8 world pixels. */
export function orbArt(): Cnv {
  return once('orb', () => {
    const k = LOOT_K;
    const c = canvas(8 * k, 8 * k);
    const g = ctx2d(c);
    g.scale(k, k);
    const r = g.createRadialGradient(3.2, 3.2, 0.4, 4, 4, 3.4);
    r.addColorStop(0, '#ffd8e0');
    r.addColorStop(0.45, '#ff5a7a');
    r.addColorStop(1, '#a8203e');
    g.fillStyle = INK;
    g.beginPath();
    g.arc(4, 4, 3.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = r;
    g.beginPath();
    g.arc(4, 4, 2.9, 0, Math.PI * 2);
    g.fill();
    // a small cross of light in it
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(3.6, 2.6, 0.8, 2.6);
    g.fillRect(2.7, 3.5, 2.6, 0.8);
    return c;
  });
}

/** A rift shard, 6 × 10 world pixels. */
export function shardArt(): Cnv {
  return once('shard', () => {
    const k = LOOT_K;
    const c = canvas(6 * k, 10 * k);
    const g = ctx2d(c);
    g.scale(k, k);
    const pts: [number, number][] = [[3, 0.4], [5.4, 4], [3.6, 9.6], [0.8, 5.2]];
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    const f = g.createLinearGradient(0, 0, 6, 10);
    f.addColorStop(0, '#ffb0ee');
    f.addColorStop(0.5, '#ff3fd2');
    f.addColorStop(1, '#7a1a8a');
    g.fillStyle = f;
    g.fill();
    g.lineWidth = 0.8;
    g.strokeStyle = INK;
    g.stroke();
    g.strokeStyle = '#9bf3ff';
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(3, 1.6);
    g.lineTo(3.4, 8);
    g.stroke();
    return c;
  });
}
