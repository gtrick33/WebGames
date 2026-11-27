import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { refusal } from '../server/plausible';
import { challengeLevel, dailyLevel, loadSave } from '../src/games/prism-pals/store';
import { Cell, cellAt, parseLevel, type Level } from '../src/games/prism-pals/level';
import { LEVELS } from '../src/games/prism-pals/levels';
import { LEVEL_META, levelScore, MAX_LEVEL_SCORE, resultLine } from '../src/games/prism-pals/rules';
import { CH, CW, gemsTaken, IN_ACT, IN_JUMP, IN_LEFT, IN_RIGHT, JUMP_V, GRAV, newWorld, resetWorld, seconds, stepWorld, type World } from '../src/games/prism-pals/sim';

const lvOf = (rows: string[]): Level => parseLevel({ name: 'test', par: 10, map: rows });
const all = (w: World): boolean[] => w.cr.map(() => true);
/** Steps the world `n` times with the same buttons for critter `i` (the others stand still). */
function run(w: World, i: number, bits: number, n: number): ReturnType<typeof stepWorld> {
  const out: ReturnType<typeof stepWorld> = [];
  for (let k = 0; k < n; k++) out.push(...stepWorld(w, w.cr.map((_, j) => (j === i ? bits : 0)), all(w), true));
  return out;
}
const settle = (w: World): void => void run(w, 0, 0, 40);

/**
 * A simple pilot for one critter: run toward the exit side, jump at walls and before gaps. It plays the
 * first level for real, so the scoring and the clear are tested on a true run.
 */
function pilot(w: World, i: number, maxSteps = 900): void {
  for (let k = 0; k < maxSteps; k++) {
    const c = w.cr[i]!;
    const ahead = Math.floor(c.x + CW + 0.4);
    const feet = Math.floor(c.y + CH + 0.1);
    const row = Math.floor(c.y + CH / 2);
    const lv = w.lv;
    const wall = cellAt(lv, ahead, row) === Cell.Ground;
    const gap = cellAt(lv, ahead, feet) !== Cell.Ground;
    const home = cellAt(lv, Math.floor(c.x + CW / 2), row) === Cell.Exit && cellAt(lv, Math.floor(c.x + CW / 2) + 1, row) !== Cell.Exit;
    const bits = home ? 0 : IN_RIGHT | (c.ground && (wall || gap) ? IN_JUMP : 0) | (!c.ground && c.vy < 0 ? IN_JUMP : 0);
    stepWorld(w, w.cr.map((_, j) => (j === i ? bits : 0)), all(w), true);
    if (home && c.ground && Math.abs(c.vx) < 0.05) return;
  }
}

describe('prism pals simulation', () => {
  it('is deterministic: the same buttons give the same level', () => {
    const play = (): string => {
      const w = newWorld(parseLevel(LEVELS[0]!));
      run(w, 0, IN_RIGHT, 30);
      run(w, 0, IN_RIGHT | IN_JUMP, 20);
      run(w, 1, IN_RIGHT, 50);
      run(w, 1, IN_LEFT | IN_JUMP, 12);
      return JSON.stringify({ cr: w.cr, t: w.t, gems: w.gems });
    };
    expect(play()).toBe(play());
  });

  it('jumps a little over two tiles, and a spring a little over five', () => {
    expect((JUMP_V * JUMP_V) / (2 * GRAV)).toBeCloseTo(2.4, 5);
    const w = newWorld(lvOf(['........', '........', '........', '........', '........', '........', '........', '........', '.12..T..', '########']));
    settle(w);
    const floor = w.cr[0]!.y;
    let top = floor;
    for (let k = 0; k < 40; k++) {
      run(w, 0, IN_JUMP, 1);
      top = Math.min(top, w.cr[0]!.y);
    }
    expect(floor - top).toBeGreaterThan(2.2);
    expect(floor - top).toBeLessThan(2.5);
    // a short tap hops lower than a held jump
    settle(w);
    run(w, 0, IN_JUMP, 3);
    let hop = w.cr[0]!.y;
    for (let k = 0; k < 40; k++) {
      run(w, 0, 0, 1);
      hop = Math.min(hop, w.cr[0]!.y);
    }
    expect(floor - hop).toBeLessThan(1.6);
    // Sprig walks onto the spring
    let high = w.cr[1]!.y;
    const ev = run(w, 1, IN_RIGHT, 25);
    for (let k = 0; k < 40; k++) {
      run(w, 1, 0, 1);
      high = Math.min(high, w.cr[1]!.y);
    }
    expect(ev.some((e) => e.k === 'spring')).toBe(true);
    expect(floor - high).toBeGreaterThan(4.6);
  });

  it('lets color blocks hold up only their own pal, and goo spare only its own', () => {
    const w = newWorld(lvOf(['......', '......', '.12...', 'AAAA##', 'aaaa##', '######']));
    settle(w);
    expect(w.cr[0]!.ground && !w.cr[0]!.dead).toBe(true);
    // Sprig falls through the tangerine blocks into tangerine goo
    expect(w.cr[1]!.dead).toBe(true);
    const g = newWorld(lvOf(['......', '.12...', 'aaaa##', '######']));
    settle(g);
    expect(g.cr[0]!.dead).toBe(false);
    expect(g.cr[1]!.dead).toBe(true);
    // Tango wades through its own goo, slower than it walks
    const before = g.cr[0]!.x;
    run(g, 0, IN_RIGHT, 30);
    expect(g.cr[0]!.x - before).toBeGreaterThan(1);
    expect(g.cr[0]!.x - before).toBeLessThan((6.2 * 30) / 60);
  });

  it('kills on spikes and below the map, and starts the level over with one more try', () => {
    const w = newWorld(lvOf(['......', '.12...', '###^^#', '######']));
    settle(w);
    const ev = run(w, 0, IN_RIGHT, 60);
    expect(ev.some((e) => e.k === 'die' && e.i === 0)).toBe(true);
    expect(w.cr[0]!.dead).toBe(true);
    const t = w.t;
    resetWorld(w);
    expect([w.tries, w.cr[0]!.dead, w.t]).toEqual([1, false, t]);
    const pit = newWorld(lvOf(['......', '.12...', '###..#']));
    run(pit, 0, IN_RIGHT, 120);
    expect(pit.cr[0]!.dead).toBe(true);
  });

  it('opens a gate while a pal of its color stands on a plate of that color', () => {
    const w = newWorld(lvOf(['..E...', '..#...', '1e#.2.', '######']));
    settle(w);
    expect(w.gates[0]).toBe(false);
    run(w, 0, IN_RIGHT, 12);
    run(w, 0, 0, 10);
    expect(w.gates[0]).toBe(true);
    // Sprig on the plate does nothing
    const v = newWorld(lvOf(['..E...', '..#...', '2e#.1.', '######']));
    run(v, 1, IN_RIGHT, 12);
    run(v, 1, 0, 10);
    expect(v.gates[0]).toBe(false);
  });

  it('pushes crates, which drop into the first hole they reach', () => {
    const w = newWorld(lvOf(['........', '.12%....', '#####.##', '########']));
    settle(w);
    const ev = run(w, 1, IN_RIGHT, 90);
    expect(ev.some((e) => e.k === 'push')).toBe(true);
    run(w, 1, 0, 30);
    expect(w.crates[0]).toMatchObject({ x: 5, y: 2 });
    // and it bridges the hole: Sprig walks on over it
    run(w, 1, IN_RIGHT, 60);
    expect(w.cr[1]!.x).toBeGreaterThan(6);
    expect(w.cr[1]!.dead).toBe(false);
  });

  it('flips both kinds of lever gate with each pull', () => {
    const w = newWorld(lvOf(['.......', '1L.|!.2', '#######']));
    settle(w);
    const solid = (x: number): boolean => (w.leverOn ? cellAt(w.lv, x, 1) === Cell.LeverGateOpen : cellAt(w.lv, x, 1) === Cell.LeverGate);
    expect(w.leverOn).toBe(false);
    expect(solid(3)).toBe(true);
    run(w, 0, IN_RIGHT, 8);
    run(w, 0, IN_ACT, 2);
    run(w, 0, 0, 2);
    expect(w.levers[0]).toBe(true);
    expect(w.leverOn).toBe(true);
    run(w, 0, IN_ACT, 2);
    run(w, 0, 0, 2);
    expect(w.leverOn).toBe(false);
  });

  it('carries pals on lifts and on each other’s heads', () => {
    const lift = newWorld(lvOf(['........', '........', '........', '21......', '##--::::', '########']));
    run(lift, 0, IN_RIGHT, 14);
    run(lift, 0, 0, 30);
    expect(lift.cr[0]!.on).toBe(200);
    const x = lift.cr[0]!.x;
    run(lift, 0, 0, 30);
    expect(lift.cr[0]!.x).toBeGreaterThan(x + 0.5);
    expect(lift.cr[0]!.on).toBe(200);
    const stack = newWorld(lvOf(['.....', '.2...', '.1...', '#####']));
    settle(stack);
    expect(stack.cr[1]!.on).toBe(100);
  });

  it('clears only when every pal stands in the door together', () => {
    const lv = parseLevel(LEVELS[0]!);
    const w = newWorld(lv);
    pilot(w, 0);
    expect(w.cleared).toBe(false);
    pilot(w, 1);
    for (let k = 0; k < 30 && !w.cleared; k++) run(w, 0, 0, 1);
    expect(w.cleared).toBe(true);
    expect(w.cr.every((c) => !c.dead)).toBe(true);
    const score = levelScore(lv.par, seconds(w), gemsTaken(w), w.tries);
    expect(score).toBeGreaterThanOrEqual(1000);
    // a real solo dash through the first level stays inside the arcade's limits
    expect(refusal(getGame('prism-pals')!, score, { levels: 1, gems: gemsTaken(w) }, seconds(w))).toBe('');
  });
});

describe('prism pals scoring and modes', () => {
  it('scores 1000 + 150 a gem + time vs par − 50 a restart, never under 100', () => {
    expect(levelScore(30, 30, 0, 0)).toBe(1500);
    expect(levelScore(30, 10, 4, 0)).toBe(2100);
    expect(levelScore(30, 45, 2, 1)).toBe(1000 + 300 + 250 - 50);
    expect(levelScore(30, 60, 0, 0)).toBe(1000);
    expect(levelScore(30, 600, 0, 99)).toBe(100);
    expect(MAX_LEVEL_SCORE).toBe(1000 + 500 + 150 * Math.max(...LEVEL_META.map((m) => m[2])));
    expect(MAX_LEVEL_SCORE).toBeLessThanOrEqual(getGame('prism-pals')!.limits!.maxScore!);
    expect(resultLine(41.6, 3, 4, 0)).toBe('⏱ 42s 💎 3/4');
    expect(resultLine(80, 1, 4, 2)).toBe('⏱ 80s 💎 1/4 🔁 2');
  });

  it('picks the same daily level for everyone on a day, and a challenge level from its seed', () => {
    expect(dailyLevel('2026-11-27')).toBe(dailyLevel('2026-11-27'));
    const days = Array.from({ length: 60 }, (_, i) => dailyLevel(`2026-12-${String((i % 28) + 1).padStart(2, '0')}`));
    expect(days.every((d) => d >= 0 && d < LEVELS.length)).toBe(true);
    expect(new Set(days).size).toBeGreaterThan(8);
    expect(challengeLevel(7)).toBe(7);
    expect(challengeLevel(4_000_000_000)).toBeLessThan(LEVELS.length);
  });

  it('checks every field of a stored save', () => {
    expect(loadSave(null)).toMatchObject({ best: 0, levels: {}, color: 0, pack: 2 });
    expect(loadSave('not json').best).toBe(0);
    const s = loadSave(JSON.stringify({ best: 1e12, runs: -3, color: 7, pack: 9, muted: 'yes', levels: { 3: { best: 1800, gems: 2, secs: 31 }, 99: { best: 1 }, x: {} }, daily: { '2026-11-27': { best: 1500, tries: 2, line: '⏱ 9s' }, bad: {} }, ch: { 'a:1': { score: 900, line: 'x', gems: 1 } } }));
    expect(s.best).toBe(10_000);
    expect(s.runs).toBe(0);
    expect([s.color, s.pack, s.muted]).toEqual([0, 2, false]);
    expect(Object.keys(s.levels)).toEqual(['3']);
    expect(Object.keys(s.daily)).toEqual(['2026-11-27']);
    expect(s.ch['a:1']).toEqual({ score: 900, line: 'x', gems: 1 });
  });
});
