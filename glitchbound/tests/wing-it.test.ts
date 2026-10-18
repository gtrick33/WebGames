import { describe, expect, it } from 'vitest';
import { BIRD_X, HIT_R, biomeFor, flap, flightLine, gapCentre, GROUND, H, medalFor, newSim, PILLAR_W, runPoints, step, type Sim } from '../src/games/wing-it/sim';

/** A simple autopilot: flap when falling near the bottom of the next gap (a flap rises ~88 units). */
function autopilot(s: Sim): void {
  const p = s.pillars.find((x) => x.x + PILLAR_W > BIRD_X - HIT_R);
  const target = p ? gapCentre(p, s.t + 0.2) + p.gapH / 2 - HIT_R - 16 : H / 2;
  if (s.y > target && s.vy > 0) flap(s);
}

describe('Wing It', () => {
  it('is deterministic for a seed (the daily course is the same for everyone)', () => {
    const a = newSim(42);
    const b = newSim(42);
    expect(a.pillars).toEqual(b.pillars);
    for (let i = 0; i < 600; i++) {
      autopilot(a);
      autopilot(b);
      step(a);
      step(b);
    }
    expect(a.y).toBe(b.y);
    expect(a.score).toBe(b.score);
  });

  it('hovers until the first flap, then falls and crashes on the ground', () => {
    const s = newSim(1);
    for (let i = 0; i < 300; i++) step(s);
    expect(s.started).toBe(false);
    expect(s.dead).toBe(false);
    flap(s);
    const events = [];
    for (let i = 0; i < 2000 && !s.dead; i++) events.push(...step(s));
    expect(s.dead).toBe(true);
    expect(events).toContain('crash');
    for (let i = 0; i < 400; i++) step(s);
    expect(s.y).toBeLessThanOrEqual(GROUND);
  });

  it('every course is passable: an autopilot clears 150 gaps on many seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = newSim(seed * 7919);
      flap(s);
      for (let i = 0; i < 120 * 300 && !s.dead && s.score < 150; i++) {
        autopilot(s);
        step(s);
      }
      expect(s.score, `seed ${seed}`).toBeGreaterThanOrEqual(150);
    }
  });

  it('scores gaps, feathers, medals and worlds', () => {
    expect(runPoints({ score: 10, feathers: 2 })).toBe(16);
    expect(medalFor(9)).toBeNull();
    expect(medalFor(10)).toBe('bronze');
    expect(medalFor(55)).toBe('gold');
    expect(medalFor(120)).toBe('platinum');
    expect(biomeFor(0)).toBe('meadow');
    expect(biomeFor(16)).toBe('sunset');
    expect(biomeFor(61)).toBe('meadow');
  });
});

describe('Wing It smooth drawing', () => {
  /** A canvas whose 2D context records bird positions and ignores everything else. */
  function fakeCanvas() {
    const calls: { translate: number[][] } = { translate: [] };
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'createLinearGradient' ? () => ({ addColorStop: () => undefined }) : k === 'translate' ? (x: number, y: number) => calls.translate.push([x, y]) : () => undefined),
      set: () => true,
    });
    const canvas = { width: 0, height: 0, clientWidth: 400, clientHeight: 640, getContext: () => ctx } as unknown as HTMLCanvasElement;
    return { canvas, calls };
  }

  it('remembers the last step so frames can be drawn between steps', () => {
    const s = newSim(7);
    flap(s);
    step(s);
    expect(s.prevY).not.toBe(s.y);
    expect(s.lastDx).toBeGreaterThan(0);
  });

  it('draws the bird between its last two positions', async () => {
    const { drawFrame, newView } = await import('../src/games/wing-it/render');
    const s = newSim(7);
    flap(s);
    for (let i = 0; i < 5; i++) step(s);
    const { canvas, calls } = fakeCanvas();
    const view = { ...newView(), cw: 400, ch: 640 };
    drawFrame(canvas, view, s, 0, 0.5);
    const bird = calls.translate.find(([x]) => x === BIRD_X)!;
    expect(bird[1]).toBeCloseTo((s.prevY + s.y) / 2, 5);
    // The canvas is sized once and keeps its size between frames.
    const w = canvas.width;
    drawFrame(canvas, view, s, 0, 1);
    expect(canvas.width).toBe(w);
  });
});

describe('wing it share line', () => {
  it('fills a square per 10 gaps, marks the crash, and adds the medal and feathers', () => {
    expect(flightLine(0, 0)).toBe('💥⬛⬛⬛⬛⬛⬛⬛⬛⬛');
    expect(flightLine(37, 2)).toBe('🟩🟩🟩💥⬛⬛⬛⬛⬛⬛ 🥈 🪶2');
    expect(flightLine(140, 0)).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 💎');
  });
});
