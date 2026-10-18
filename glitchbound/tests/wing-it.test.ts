import { describe, expect, it } from 'vitest';
import { BIRD_X, HIT_R, biomeFor, flap, gapCentre, GROUND, H, medalFor, newSim, PILLAR_W, runPoints, step, type Sim } from '../src/games/wing-it/sim';

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
