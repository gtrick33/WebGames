import { describe, expect, it } from 'vitest';
import { Cell, parseLevel } from '../src/games/prism-pals/level';
import { LEVELS } from '../src/games/prism-pals/levels';
import { levelProblems, reach } from '../src/games/prism-pals/reach';
import { LEVEL_META, packLevels } from '../src/games/prism-pals/rules';

describe('prism pals levels', () => {
  const parsed = LEVELS.map(parseLevel);

  it('has 24 levels: 8 each for two, three and four pals, ramping in that order', () => {
    expect(parsed).toHaveLength(24);
    expect(parsed.map((l) => l.n)).toEqual([...Array(8).fill(2), ...Array(8).fill(3), ...Array(8).fill(4)]);
    expect(new Set(LEVELS.map((d) => d.name)).size).toBe(24);
    for (const n of [2, 3, 4]) expect(packLevels(n)).toHaveLength(8);
  });

  it('parses every map with matching spawns, doors, gems and room to fit a phone', () => {
    for (const lv of parsed) {
      expect(lv.w, lv.name).toBeLessThanOrEqual(32);
      expect(lv.h, lv.name).toBeLessThanOrEqual(16);
      expect(lv.spawns, lv.name).toHaveLength(lv.n);
      expect(lv.exits.length, lv.name).toBeGreaterThanOrEqual(lv.n);
      expect(lv.gems.length, lv.name).toBeGreaterThanOrEqual(2);
      expect(lv.gems.every((g) => g.color < lv.n), lv.name).toBe(true);
      // every color with a gate has a plate of that color
      for (let c = 0; c < 4; c++) if (lv.gated[c]) expect([...lv.cells].some((k, i) => k === Cell.Plate && lv.tint[i] === c), `${lv.name} plate ${c}`).toBe(true);
      // lever gates come with a lever
      if ([...lv.cells].some((k) => k === Cell.LeverGate || k === Cell.LeverGateOpen)) expect(lv.levers.length, lv.name).toBeGreaterThan(0);
      expect(lv.par, lv.name).toBeGreaterThan(5);
    }
  });

  it('agrees with the room’s copy of the critter counts, pars and gems', () => {
    expect(LEVEL_META).toEqual(parsed.map((l) => [l.n, l.par, l.gems.length]));
  });

  it('refuses broken maps', () => {
    expect(() => parseLevel({ name: 'x', par: 9, map: ['..', '...'] })).toThrow(/length/);
    expect(() => parseLevel({ name: 'x', par: 9, map: ['1..', '###'] })).toThrow(/spawns/);
    expect(() => parseLevel({ name: 'x', par: 9, map: ['1.3', '###'] })).toThrow(/spawns/);
    expect(() => parseLevel({ name: 'x', par: 9, map: ['12?', '###'] })).toThrow(/unknown/);
    expect(() => parseLevel({ name: 'x', par: 9, map: ['12-', '###'] })).toThrow(/track/);
  });

  it('the checker finds no way across a 7-tile gap or up a 3-tile wall', () => {
    const gap = parseLevel({ name: 'gap', par: 9, map: ['................', '12...........@@.', '####.......#####', '####^^^^^^^#####', '################'] });
    expect(levelProblems(gap)).toContain("critter 0 can't reach the exit");
    const wall = parseLevel({ name: 'wall', par: 9, map: ['..........', '.......@@.', '......####', '......####', '12....####', '##########'] });
    expect([...reach(wall, 0).stands].some((k) => wall.cells[k] === Cell.Exit)).toBe(false);
    const step = parseLevel({ name: 'step', par: 9, map: ['..........', '.......@@.', '......####', '12....####', '##########'] });
    expect(levelProblems(step)).toEqual([]);
  });

  // The real check: every pal can reach the door and each of its gems, with the real jump (sim.ts),
  // gates counted as openable, lifts along their track, crates where they start or pushed along.
  for (const [i, lv] of parsed.entries())
    it(`level ${i + 1} (${lv.name}): every pal reaches the door and its gems`, () => {
      expect(levelProblems(lv)).toEqual([]);
    }, 120_000);
});
