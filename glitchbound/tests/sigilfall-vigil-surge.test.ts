/**
 * The Vigil gets harder faster than its keeper gets stronger (the owner, after ten easy minutes with every spell at
 * its top: "i want it to become exponentially way harder"). The Host's health compounds by the minute, so what fell
 * the moment it came now lives long enough to close in; its blows keep their old, slower growth; a champion's health
 * compounds at half the pace; and the flood comes by the sixth minute.
 */
import { describe, expect, it } from 'vitest';
import { SURGE, SURGE_FROM, tideAt, TIDE_MAX, TIDE_START, Vigil, type Foe } from '../src/games/sigilfall/vigil/sim';

/** The Host as it comes this far into the night: one of the crowd, and the champion if one is due. */
function hostAt(seconds: number): { crowd: Foe; champion: Foe | undefined } {
  const v = new Vigil(5, 2000, 2000);
  v.t = seconds;
  for (let i = 0; i < 20; i++) {
    v.me.hp = 1e9;
    if (v.cards) v.choose(0);
    v.step(1 / 30, { mx: 0, my: 0 });
  }
  const crowd = v.foes.find((f) => !f.boss && !f.elite)!;
  expect(crowd, `someone has come by ${seconds}s`).toBeDefined();
  return { crowd, champion: v.foes.find((f) => !!f.boss) };
}
const grown = (m: number): number => 1 + m * 0.14 + (m * m) / 70;

describe('The Vigil: the Host compounds', () => {
  it('its health grows by a compounding share every minute, on top of what it grew by before', () => {
    expect(SURGE).toBeGreaterThanOrEqual(1.2);
    expect(SURGE_FROM).toBeLessThanOrEqual(1);
    for (const m of [1, 3, 5, 8, 10]) {
      const { crowd } = hostAt(m * 60);
      const tough = crowd.maxHp / crowd.def.hp;
      expect(tough / (grown(m) * SURGE ** (m - SURGE_FROM)), `at ${m} minutes`).toBeCloseTo(1, 1);
    }
    // ten minutes in, one of the crowd has ten times and more what the old growth alone gave it
    const late = hostAt(600).crowd;
    expect(late.maxHp / late.def.hp).toBeGreaterThan(grown(10) * 10);
    // and each minute is worse than the last by the same share: that is what compounding means
    const a = hostAt(420).crowd;
    const b = hostAt(480).crowd;
    const c = hostAt(540).crowd;
    const perMinute = (x: Foe, y: Foe, m: number): number => y.maxHp / y.def.hp / (x.maxHp / x.def.hp) / (grown(m + 1) / grown(m));
    expect(perMinute(a, b, 7)).toBeCloseTo(SURGE, 1);
    expect(perMinute(b, c, 8)).toBeCloseTo(SURGE, 1);
  });

  it('its blows keep their old growth: tougher, not deadlier at a touch', () => {
    for (const m of [2, 6, 10]) {
      const { crowd } = hostAt(m * 60);
      expect(crowd.dmg / crowd.def.dmg, `at ${m} minutes`).toBeCloseTo(1 + (grown(m) - 1) * 0.45, 1);
    }
  });

  it('a champion compounds at half the pace of the crowd', () => {
    const { crowd, champion } = hostAt(600);
    expect(champion).toBeDefined();
    const crowdTough = crowd.maxHp / crowd.def.hp;
    // (a champion's health is its kind's, or 90 at least, times its toughness, times 38)
    const champTough = champion!.maxHp / (Math.max(champion!.def.hp, 90) * 38);
    expect(champTough).toBeLessThan(crowdTough * 0.5);
    expect(champTough).toBeGreaterThan(grown(10) * 2);
    expect(champTough).toBeCloseTo(grown(10) * Math.sqrt(SURGE ** (10 - SURGE_FROM)), 0);
  });

  it('the flood comes by the sixth minute, and only ever rises', () => {
    expect(tideAt(0)).toBe(TIDE_START);
    expect(tideAt(360)).toBeGreaterThan(TIDE_MAX * 0.98);
    expect(tideAt(375)).toBe(TIDE_MAX);
    expect(tideAt(240)).toBeGreaterThan(TIDE_MAX * 0.55);
    for (let t = 0; t < 900; t += 10) expect(tideAt(t + 10)).toBeGreaterThanOrEqual(tideAt(t));
  });
});
