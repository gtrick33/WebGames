import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { canDrop, drop, H, newSim, nextTier, POINTS, RADII, resultLine, setAim, step, STEP, tierAt, TIERS, W, type Sim } from '../src/games/gloop/sim';

/** Autopilot: drop on top of a blob of the same size when there is one, else spread along the jar. */
function autoplay(seed: number, seconds: number): Sim {
  const s = newSim(seed);
  let k = 0;
  for (let i = 0; i < seconds / STEP && !s.over; i++) {
    if (canDrop(s)) {
      const t = nextTier(s);
      const twin = s.blobs.filter((b) => b.tier === t).sort((a, b) => a.y - b.y)[0];
      setAim(s, twin ? twin.x : ((k++ * 97) % (W - 60)) + 30);
      drop(s);
    }
    step(s);
    // Checked by hand: an expect() per blob per step would make the test crawl.
    for (const b of s.blobs) {
      const inside = Number.isFinite(b.x) && Number.isFinite(b.y) && b.x >= b.r - 0.01 && b.x <= W - b.r + 0.01 && b.y <= H - b.r + 0.01;
      if (!inside) throw new Error(`blob ${b.id} left the jar at ${b.x}, ${b.y} (seed ${seed})`);
    }
  }
  return s;
}

describe('Gloop', () => {
  it('deals the same blobs for the same seed, only the five smallest sizes', () => {
    const a = Array.from({ length: 40 }, (_, n) => tierAt(7, n));
    expect(a).toEqual(Array.from({ length: 40 }, (_, n) => tierAt(7, n)));
    expect(a).not.toEqual(Array.from({ length: 40 }, (_, n) => tierAt(8, n)));
    expect(Math.max(...a)).toBeLessThan(5);
    expect(RADII).toHaveLength(TIERS);
    expect(POINTS).toHaveLength(TIERS);
  });

  it('merges two touching blobs of the same size into the next size', () => {
    const s = newSim(1);
    s.blobs.push({ id: 1, tier: 2, x: 100, y: H - RADII[2]!, vx: 0, vy: 0, r: RADII[2]!, age: 2, high: 0, pop: 0 });
    s.blobs.push({ id: 2, tier: 2, x: 100 + RADII[2]! * 2 - 1, y: H - RADII[2]!, vx: 0, vy: 0, r: RADII[2]!, age: 2, high: 0, pop: 0 });
    const events = step(s);
    expect(events.some((e) => e.type === 'merge' && e.tier === 3)).toBe(true);
    expect(s.blobs).toHaveLength(1);
    expect(s.blobs[0]!.tier).toBe(3);
    expect(s.score).toBe(POINTS[3]);
    expect(s.biggest).toBe(3);
  });

  it('keeps every blob inside the jar and merges a lot over long autoplay', () => {
    for (const seed of [1, 2, 3]) {
      const s = autoplay(seed, 75);
      expect(s.merges).toBeGreaterThan(10);
      expect(s.biggest).toBeGreaterThanOrEqual(4);
    }
  }, 20_000);

  it('ends the round when the jar overflows', () => {
    const s = newSim(5);
    // Drop everything in the same spot as fast as allowed.
    for (let i = 0; i < 120 / STEP && !s.over; i++) {
      setAim(s, 30);
      drop(s);
      step(s);
    }
    expect(s.over).toBe(true);
  });

  it('scores within the limits', () => {
    const limits = getGame('gloop')!.limits!;
    for (const seed of [11, 12]) {
      const s = autoplay(seed, 90);
      expect(s.score / Math.max(1, s.t)).toBeLessThan(limits.scorePerSecond);
    }
    expect(resultLine(3)).toMatch(/^⚪🟡🟠🔴(▫️){7}$/u);
  }, 20_000);
});
