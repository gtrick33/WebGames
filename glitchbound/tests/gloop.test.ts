import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { canDrop, culprit, drop, H, LINE, newSim, nextTier, POINTS, RADII, resultLine, setAim, simFrom, step, STEP, tierAt, TIERS, W, type Blob, type Sim } from '../src/games/gloop/sim';

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
    expect(resultLine(3)).toMatch(/^⚪🟡🟠🔴(⚫){7}$/u);
  }, 20_000);

  const blob = (id: number, tier: number, x: number, y: number, more: Partial<Blob> = {}): Blob => ({ id, tier, x, y, vx: 0, vy: 0, r: RADII[tier]!, age: 2, high: 0, pop: 0, ...more });

  it('holds the overflow clock while merges are still going on', () => {
    const s = newSim(1);
    s.blobs.push(blob(1, 0, 100, 60, { high: 1.6 - STEP / 2 }));
    s.sinceMerge = 0;
    for (let i = 0; i < 0.3 / STEP; i++) step(s);
    expect(s.over).toBe(false);
    s.blobs[0]!.y = 60;
    s.blobs[0]!.vy = 0;
    for (let i = 0; i < 0.2 / STEP && !s.over; i++) step(s);
    expect(s.over).toBe(true);
  });

  it('points at the blob closest to ending the jar, for the warning ring', () => {
    const s = newSim(1);
    expect(culprit(s)).toBeNull();
    s.blobs.push(blob(1, 0, 100, 60, { high: 0.4 }), blob(2, 1, 200, 60, { high: 0.9 }), blob(3, 2, 300, 500));
    expect(culprit(s)?.id).toBe(2);
  });

  it('counts a blob as over the line only past the line’s stroke', () => {
    const at = (top: number): boolean => {
      const s = newSim(1);
      s.blobs.push(blob(1, 0, 100, top + RADII[0]!, { high: 1.6 - STEP / 2 }));
      step(s);
      return s.over;
    };
    expect(at(LINE - 2)).toBe(false);
    expect(at(LINE - 6)).toBe(true);
  });

  it('pushes a small blob crushed in a corner back out from under a big one', () => {
    // A late jar from a real round: a Drip (third) pinned in the bottom-left corner, deep inside a Glob (fifth).
    const jar = [[1, 340, 550], [0, 345, 585], [0, 15, 585], [0, 127, 521], [4, 44, 559], [4, 318, 498], [7, 207, 533], [3, 114, 567], [3, 300, 567], [3, 264, 449], [0, 345, 450], [1, 315, 438], [2, 26, 498], [0, 62, 478], [0, 217, 457], [2, 87, 510], [1, 20, 456], [6, 59, 391], [4, 293, 382], [6, 197, 388], [0, 345, 367], [0, 127, 405], [4, 40, 296], [4, 129, 460], [1, 99, 286], [3, 126, 332], [1, 340, 267], [0, 173, 320], [4, 232, 298], [3, 312, 312]] as const;
    const s = newSim(1);
    jar.forEach(([tier, x, y], i) => s.blobs.push(blob(i + 1, tier, x, y, { age: 60 })));
    s.nextId = 99;
    for (let i = 0; i < 5 / STEP; i++) step(s);
    const [drip, glob] = [s.blobs.find((b) => b.id === 3)!, s.blobs.find((b) => b.id === 5)!];
    expect(drip.r + glob.r - Math.hypot(glob.x - drip.x, glob.y - drip.y)).toBeLessThan(3);
  });

  it('keeps the next blob inside the jar after a drop at the wall', () => {
    let seed = 1;
    // A seed whose second blob is bigger than its first.
    while (RADII[tierAt(seed, 1)]! <= RADII[tierAt(seed, 0)]!) seed++;
    const s = newSim(seed);
    setAim(s, 0);
    drop(s);
    expect(s.aim).toBe(RADII[nextTier(s)]! + 2);
  });

  it('loads a jar saved before the merge hold was added', () => {
    const old: Partial<Sim> = newSim(9);
    delete old.sinceMerge;
    expect(simFrom(JSON.parse(JSON.stringify(old)))?.sinceMerge).toBeGreaterThan(0);
    expect(simFrom({ ...old, sinceMerge: 'x' })).toBeNull();
  });
});
