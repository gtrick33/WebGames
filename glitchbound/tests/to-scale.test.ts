import { describe, expect, it } from 'vitest';
import { accuracy, makeShot, makeShots, mark, MAX_POINTS, partners, pointsFor, ratioText, rng, SHOTS } from '../src/games/to-scale/logic';
import { sizeText, THINGS } from '../src/games/to-scale/objects';

describe('to-scale objects', () => {
  it('every thing has a name, a positive size, a fact and a partner', () => {
    const names = new Set<string>();
    for (const [i, t] of THINGS.entries()) {
      expect(t.size, t.name).toBeGreaterThan(0);
      expect(t.fact.length, t.name).toBeGreaterThan(10);
      expect(t.fact.length, t.name).toBeLessThan(140);
      expect(names.has(t.name), t.name).toBe(false);
      names.add(t.name);
      expect(partners(i).length, t.name).toBeGreaterThan(0);
    }
  });
  it('sizes read well', () => {
    expect(sizeText(0.006)).toBe('6 mm');
    expect(sizeText(0.067)).toBe('6.7 cm');
    expect(sizeText(1.7)).toBe('1.7 m');
    expect(sizeText(333)).toBe('333 m');
    expect(sizeText(12_742_000)).toBe('12,742 km');
  });
});

describe('to-scale shots', () => {
  it('the same seed gives the same five shots', () => {
    expect(makeShots(1234)).toEqual(makeShots(1234));
    expect(makeShots(1234)).not.toEqual(makeShots(4321));
  });
  it('shots are fair: the answer is inside the range and the start is well off', () => {
    for (let seed = 0; seed < 400; seed++) {
      const shots = makeShots(seed);
      expect(shots).toHaveLength(SHOTS);
      expect(new Set(shots.map((s) => s.target)).size).toBe(SHOTS);
      for (const s of shots) {
        expect(s.ref).not.toBe(s.target);
        const off = Math.max(s.ratio, 1 / s.ratio);
        expect(off).toBeGreaterThanOrEqual(1.8 - 1e-9);
        expect(off).toBeLessThanOrEqual(8 + 1e-9);
        expect(s.min).toBeLessThan(s.ratio);
        expect(s.max).toBeGreaterThan(s.ratio);
        expect(s.start).toBeGreaterThanOrEqual(s.min);
        expect(s.start).toBeLessThanOrEqual(s.max);
        expect(1 / accuracy(s.start, s.ratio)).toBeGreaterThanOrEqual(1.7 - 1e-9);
      }
    }
  });
  it('endless shots avoid used targets', () => {
    const r = rng(7);
    const used = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 0; i < 50; i++) expect(used.has(makeShot(r, used).target)).toBe(false);
  });
  it('always guessing the middle of the slider scores badly', () => {
    let total = 0;
    let n = 0;
    for (let seed = 0; seed < 300; seed++)
      for (const s of makeShots(seed)) {
        total += pointsFor(1, s.ratio);
        n++;
      }
    expect(total / n).toBeLessThan(250);
  });
});

describe('to-scale scoring', () => {
  it('exact is 1000, half and double are equal, 2.8x off is 0', () => {
    expect(pointsFor(3, 3)).toBe(MAX_POINTS);
    expect(pointsFor(1.5, 3)).toBe(pointsFor(6, 3));
    expect(pointsFor(3 * 2.83, 3)).toBe(0);
    expect(pointsFor(3 / 100, 3)).toBe(0);
    expect(pointsFor(3.2, 3)).toBeGreaterThan(900);
  });
  it('marks and ratios read well', () => {
    expect(mark(1000)).toBe('🎯');
    expect(mark(0)).toBe('🟥');
    expect(ratioText(2.44)).toBe('2.4×');
    expect(ratioText(15.4)).toBe('15×');
    expect(ratioText(1 / 3)).toBe('1/3');
    expect(ratioText(1 / 1.4)).toBe('0.71×');
  });
});
