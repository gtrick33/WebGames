import { describe, expect, it } from 'vitest';
import { DAILY_LEVELS, dailyLevel, ladderLevel, makeLevel, rng, specFor } from '../src/games/color-lab/levels';
import { endStats, pointsFor, reduceLevel, resultOf, shareText, starsFor, startLevel, isHidden, MAX_POINTS } from '../src/games/color-lab/rules';
import { boardKey, canPour, doneTubes, hint, isSolved, lowerBound, pour, solve, type Board } from '../src/games/color-lab/sort';
import { emptyClSave, recordLevel, sanitizeCl, clStats } from '../src/games/color-lab/store';

const b = (...tubes: [number, number[]][]): Board => tubes.map(([cap, layers]) => ({ cap, layers }));

describe('pouring rules', () => {
  it('pours the top run onto the same colour or into an empty tube, as much as fits', () => {
    const board = b([4, [0, 1, 1]], [4, [2, 1]], [4, []], [4, [0, 0, 0, 2]]);
    expect(canPour(board, 0, 1)).toBe(true);
    expect(canPour(board, 0, 2)).toBe(true);
    expect(canPour(board, 0, 3)).toBe(false); // full
    expect(canPour(board, 1, 0)).toBe(true);
    expect(canPour(board, 2, 0)).toBe(false); // empty source
    const next = pour(board, 0, 1);
    expect(next[0]!.layers).toEqual([0]);
    expect(next[1]!.layers).toEqual([2, 1, 1, 1]);
    // Only what fits moves.
    const partial = pour(b([4, [1, 1, 1]], [4, [0, 0, 1]]), 0, 1);
    expect(partial[0]!.layers).toEqual([1, 1]);
    expect(partial[1]!.layers).toEqual([0, 0, 1, 1]);
  });

  it('never changes the board for an illegal pour', () => {
    const board = b([3, [0, 1]], [3, [1, 0, 0]]);
    expect(pour(board, 0, 1)).toBe(board);
    expect(pour(board, 0, 0)).toBe(board);
  });

  it('is solved when every colour sits alone in one tube', () => {
    expect(isSolved(b([3, [0, 0, 0]], [3, [1, 1, 1]], [3, []]))).toBe(true);
    expect(isSolved(b([3, [0, 0]], [3, [0]], [3, [1, 1, 1]]))).toBe(false);
    expect(isSolved(b([3, [0, 1]], [3, []]))).toBe(false);
    expect(doneTubes(b([3, [0, 0, 0]], [3, [1, 1]], [3, [1]]))).toEqual([true, false, false]);
  });

  it('treats equal-sized tubes as interchangeable in the state key', () => {
    expect(boardKey(b([3, [0]], [3, [1]]))).toBe(boardKey(b([3, [1]], [3, [0]])));
  });
});

describe('solver', () => {
  it('finds the optimal solution of a small puzzle', () => {
    // 0 on top of 1 and 1 on top of 0: needs 3 pours with one spare tube.
    const board = b([2, [1, 0]], [2, [0, 1]], [2, []]);
    const sol = solve(board)!;
    expect(sol.optimal).toBe(true);
    expect(sol.moves.length).toBe(3);
    let cur = board;
    for (const m of sol.moves) cur = pour(cur, m.from, m.to);
    expect(isSolved(cur)).toBe(true);
    expect(lowerBound(board)).toBeLessThanOrEqual(3);
  });

  it('gives a hint that is a legal move, and none on a dead end', () => {
    const board = b([2, [1, 0]], [2, [0, 1]], [2, []]);
    const m = hint(board)!;
    expect(canPour(board, m.from, m.to)).toBe(true);
    expect(hint(b([2, [0, 1]], [2, [1, 0]]))).toBeNull();
  });
});

describe('levels', () => {
  it('builds the same daily for everyone and every level is solvable in par', () => {
    for (const day of ['2026-10-18', '2026-11-03', '2027-02-14']) {
      for (let i = 0; i < DAILY_LEVELS; i++) {
        const a = dailyLevel(day, i);
        expect(dailyLevel(day, i).board).toEqual(a.board);
        expect(a.par).toBeGreaterThan(0);
        expect(isSolved(a.board)).toBe(false);
        const sol = solve(a.board, { weight: 1.6, maxNodes: 200_000 })!;
        expect(sol).not.toBeNull();
        // Par was found by a solver, so it is achievable: a weighted search may need a few more moves, never fewer than optimal.
        if (a.parOptimal) expect(sol.moves.length).toBeGreaterThanOrEqual(a.par);
      }
    }
  });

  it('gets bigger as the ladder climbs and keeps colours fair in odd layouts', () => {
    const small = specFor(0, rng(1));
    const big = specFor(12, rng(1));
    expect(big.colors).toBeGreaterThan(small.colors);
    for (let seed = 1; seed < 30; seed++) {
      const lv = makeLevel(rng(seed), { colors: 4, cap: 4, empty: 2, odd: true });
      const counts = new Map<number, number>();
      for (const t of lv.board) for (const c of t.layers) counts.set(c, (counts.get(c) ?? 0) + 1);
      const maxCap = Math.max(...lv.board.map((t) => t.cap));
      for (const n of counts.values()) expect(n).toBeLessThanOrEqual(maxCap);
    }
  });

  it('makes endless levels from a seed', () => {
    expect(ladderLevel(42, 3).board).toEqual(ladderLevel(42, 3).board);
    expect(ladderLevel(42, 7).mystery).toBe(false);
    expect(ladderLevel(42, 10).mystery).toBe(true);
  });
});

describe('level reducer', () => {
  const level = { spec: { colors: 2, cap: 2, empty: 1, odd: false }, board: b([2, [1, 0]], [2, [0, 1]], [2, []]), par: 3, parOptimal: true, palette: [0, 1], mystery: false };

  it('counts moves, undoes and restarts', () => {
    let s = startLevel(level, 'daily');
    s = reduceLevel(s, { type: 'pour', from: 0, to: 2 });
    expect(s.moves).toBe(1);
    expect(reduceLevel(s, { type: 'pour', from: 0, to: 0 })).toBe(s);
    s = reduceLevel(s, { type: 'undo' });
    expect(s.moves).toBe(0);
    expect(s.board).toEqual(level.board);
    s = reduceLevel(reduceLevel(s, { type: 'pour', from: 0, to: 2 }), { type: 'restart' });
    expect(s.moves).toBe(0);
  });

  it('wins at par for full points and fails at the Precision limit', () => {
    let s = startLevel(level, 'daily');
    for (const m of solve(level.board)!.moves) s = reduceLevel(s, { type: 'pour', ...m });
    expect(s.status).toBe('won');
    expect(resultOf(s)).toMatchObject({ solved: true, moves: 3, points: MAX_POINTS, stars: 3 });
    expect(reduceLevel(s, { type: 'pour', from: 0, to: 1 })).toBe(s);
    // A solved level can't be restarted and solved (and recorded) again.
    expect(reduceLevel(s, { type: 'restart' })).toBe(s);

    let p = startLevel({ ...level, par: 1 }, 'precision');
    p = reduceLevel(p, { type: 'pour', from: 0, to: 2 });
    expect(p.status).toBe('failed');
    expect(reduceLevel(p, { type: 'restart' })).toBe(p);
  });

  it('adds one spare tube for a cost', () => {
    let s = startLevel(level, 'practice');
    s = reduceLevel(s, { type: 'spare' });
    expect(s.board.length).toBe(4);
    expect(reduceLevel(s, { type: 'spare' })).toBe(s);
    expect(pointsFor(true, 3, 3, 0, true)).toBe(MAX_POINTS - 3);
  });

  it('hides mystery layers until they reach the top', () => {
    const mystery = { ...level, board: b([3, [1, 0, 0]], [3, [0, 1, 1]], [3, []]), mystery: true };
    let s = startLevel(mystery, 'daily');
    expect(isHidden(s, 0, 0)).toBe(true);
    expect(isHidden(s, 0, 1)).toBe(false); // part of the top run
    s = reduceLevel(s, { type: 'pour', from: 0, to: 2 });
    expect(isHidden(s, 0, 0)).toBe(false);
  });
});

describe('scoring and saves', () => {
  it('scores by moves over par and help used', () => {
    expect(pointsFor(true, 10, 10, 0, false)).toBe(10);
    expect(pointsFor(true, 12, 10, 0, false)).toBe(9);
    expect(pointsFor(true, 40, 10, 0, false)).toBe(4);
    expect(pointsFor(true, 10, 10, 2, false)).toBe(6);
    expect(pointsFor(false, 3, 10, 0, false)).toBe(0);
    expect(starsFor(true, 10, 10, 0, false)).toBe(3);
    expect(starsFor(true, 12, 10, 0, false)).toBe(2);
    expect(starsFor(true, 10, 10, 1, false)).toBe(2);
  });

  it('reports runs and shares without spoilers', () => {
    const r = { solved: true, moves: 9, par: 8, hints: 0, spare: false, points: 9, stars: 2 };
    expect(endStats('daily', [r, r])).toEqual({ score: 18, stats: { stars: 4, underPar: 0 } });
    expect(endStats('endless', [r]).stats.levels).toBe(1);
    const text = shareText({ label: '#3', results: [r], url: 'https://x.test/games/color-lab' });
    expect(text).toContain('Color Lab #3');
    expect(text).toContain('9/8');
  });

  it('keeps help paid on an unfinished daily puzzle until it is recorded', () => {
    const s = sanitizeCl({ v: 2, help: { day: '2026-10-18', index: 9, hints: 2, spare: true } });
    expect(s.help).toEqual({ day: '2026-10-18', index: DAILY_LEVELS - 1, hints: 2, spare: true });
    expect(sanitizeCl({ v: 2, help: { day: 'x' } }).help).toBeNull();
    const r = { solved: true, moves: 8, par: 8, hints: 2, spare: true, points: 3, stars: 2 };
    expect(recordLevel(s, r, '2026-10-18').help).toBeNull();
    expect(recordLevel(s, r, null).help).toEqual(s.help);
  });

  it('records dailies, streaks and repairs bad saves', () => {
    const r = { solved: true, moves: 8, par: 8, hints: 0, spare: false, points: 10, stars: 3 };
    let s = emptyClSave();
    for (let i = 0; i < DAILY_LEVELS; i++) s = recordLevel(s, r, '2026-10-18');
    expect(clStats(s, '2026-10-18')).toMatchObject({ dailyPlayed: 1, streak: 1, bestDaily: 50 });
    expect(s.underPar).toBe(5);
    expect(sanitizeCl({ v: 2, daily: { bad: [], '2026-10-18': [{ solved: true, moves: -3, points: 99 }] }, patterns: false })).toMatchObject({
      daily: { '2026-10-18': [{ moves: 0, points: 10 }] },
      patterns: false,
    });
    expect(sanitizeCl('nope')).toEqual(emptyClSave());
  });
});

describe('hints', () => {
  it('following hints from the start solves a daily level in par', () => {
    for (const i of [0, 1, 2, 3]) {
      const lv = dailyLevel('2026-10-18', i);
      let board = lv.board;
      let moves = 0;
      while (!isSolved(board) && moves < 60) {
        const m = hint(board)!;
        board = pour(board, m.from, m.to);
        moves++;
      }
      expect(isSolved(board)).toBe(true);
      if (lv.parOptimal) expect(moves).toBe(lv.par);
    }
  });
});

describe('odd-sized tubes', () => {
  it('gives every colour exactly enough layers to fill a tube, and only counts full tubes as solved', () => {
    for (let seed = 1; seed < 40; seed++) {
      const lv = makeLevel(rng(seed), { colors: 4 + (seed % 3), cap: 4, empty: 2, odd: true });
      const counts = new Map<number, number>();
      for (const t of lv.board) for (const c of t.layers) counts.set(c, (counts.get(c) ?? 0) + 1);
      for (const n of counts.values()) expect(lv.board.some((t) => t.cap === n)).toBe(true);
    }
    // Two blues in a three-high tube is not done.
    expect(isSolved(b([3, [1, 1]], [3, [0, 0, 0]], [3, [1]]))).toBe(false);
    expect(isSolved(b([3, [1, 1, 1]], [3, [0, 0, 0]], [3, []]))).toBe(true);
    expect(doneTubes(b([3, [1, 1]], [2, [1]]))).toEqual([false, false]);
  }, 30_000);
});

describe('more variety', () => {
  it('keeps the first published daily on the original 12 colours', () => {
    for (let i = 0; i < DAILY_LEVELS; i++) expect(Math.max(...dailyLevel('2026-10-18', i).palette)).toBeLessThan(12);
  });

  it('changes the last two daily recipes from day to day, and every one is solvable', () => {
    const recipes = new Set<string>();
    let colors = 0;
    for (let d = 19; d <= 31; d++) {
      for (const i of [3, 4]) {
        const lv = dailyLevel(`2026-10-${d}`, i);
        expect(lv.par).toBeGreaterThan(0);
        recipes.add(JSON.stringify(lv.spec));
        colors = Math.max(colors, ...lv.palette);
      }
    }
    expect(recipes.size).toBeGreaterThanOrEqual(4);
    expect(colors).toBeGreaterThanOrEqual(12);
  }, 60_000);

  it('varies tube height past the ladder in Endless', () => {
    const caps = new Set(Array.from({ length: 10 }, (_, k) => specFor(9 + k, rng(k)).cap));
    expect(caps.size).toBeGreaterThanOrEqual(3);
  });
});
