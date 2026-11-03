import { describe, expect, it } from 'vitest';
import { DAILY_LEVELS, dailyLevel, ladderLevel, makeLevel, MYSTERY_SLACK, ORDERED_FROM, rng, specFor } from '../src/games/color-lab/levels';
import { challengeScore, endStats, pointsFor, reduceLevel, resultOf, shareText, starsFor, startLevel, isHidden, MAX_POINTS, UNDER_PAR_BONUS } from '../src/games/color-lab/rules';
import { almostSolved, usefulMoves, boardKey, canPour, doneTubes, hint, isSolved, lowerBound, pour, solve, type Board } from '../src/games/color-lab/sort';
import { emptyClSave, loadCl, recordLevel, sanitizeCl, clStats, STORE_KEY, updateCl } from '../src/games/color-lab/store';
import { TUBE_KEYS } from '../src/games/color-lab/Game';
import { COLOR_COUNT } from '../src/games/color-lab/levels';

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
        if (a.parOptimal) expect(sol.moves.length).toBeGreaterThanOrEqual(a.par - (a.parSlack ?? 0));
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

describe('fixes from QA', () => {
  const r = (moves: number, par: number) => ({ solved: true, moves, par, hints: 0, spare: false, points: pointsFor(true, moves, par, 0, false), stars: starsFor(true, moves, par, 0, false) });

  it('CL-04: notices when every color is gathered but one sits in a tube too tall for it', () => {
    // 4 purple in a 5-tall tube, the 4-tall tube empty.
    expect(almostSolved(b([5, [0, 0, 0, 0]], [4, []], [3, [1, 1, 1]]))).toEqual({ tube: 0, target: 1 });
    expect(almostSolved(b([5, [0, 0, 0, 0, 0]], [3, [1, 1, 1]]))).toBeNull(); // solved
    expect(almostSolved(b([4, [0, 0]], [4, [0, 0]], [4, []]))).toBeNull(); // a color still split
    expect(almostSolved(b([4, [0, 1]], [4, []]))).toBeNull();
  });

  it('CL-05: has a key for every tube a board can have, and none of them is a command key', () => {
    expect(TUBE_KEYS.length).toBeGreaterThanOrEqual(COLOR_COUNT + 2 + 1);
    expect(new Set(TUBE_KEYS).size).toBe(TUBE_KEYS.length);
    for (const k of ['u', 'h', 'z']) expect(TUBE_KEYS).not.toContain(k);
  });

  it('CL-06: puzzle 5 is the harder twist from ORDERED_FROM, and earlier dailies stay as published', () => {
    // Pars reported by QA for 2026-10-25: 5/11/14/27/14 (puzzle 5 easier than 4, kept as it was).
    expect([3, 4].map((i) => dailyLevel('2026-10-25', i).par)).toEqual([27, 14]);
    for (let d = 0; d < 4; d++) {
      const day = `2026-12-0${d + 1}`;
      expect(day >= ORDERED_FROM).toBe(true);
      const four = dailyLevel(day, 3);
      const five = dailyLevel(day, 4);
      expect(five.par - (five.parSlack ?? 0)).toBeGreaterThanOrEqual(four.par);
    }
  }, 60_000);

  it('CL-08: hints follow the par route for free and are remembered', () => {
    const lv = dailyLevel('2026-11-03', 2);
    expect(lv.solution?.length).toBe(lv.par - (lv.parSlack ?? 0));
    let board = lv.board;
    for (const m of lv.solution!) {
      expect(hint(board, lv)).toEqual(m);
      board = pour(board, m.from, m.to);
    }
    expect(isSolved(board)).toBe(true);
    // Off the route: searched once, then answered from memory with the same move.
    const s0 = lv.solution![0]!;
    const other = usefulMoves(lv.board).find((m) => m.from !== s0.from || m.to !== s0.to)!;
    const off = pour(lv.board, other.from, other.to);
    const first = hint(off);
    expect(first && canPour(off, first.from, first.to)).toBe(true);
    expect(hint(off)).toEqual(first);
  });

  it('CL-09: a challenge keeps counting below par', () => {
    expect(challengeScore([r(10, 10), r(10, 10)])).toBe(2 * MAX_POINTS);
    expect(challengeScore([r(8, 10), r(10, 10)])).toBe(2 * MAX_POINTS + 2 * UNDER_PAR_BONUS);
    expect(endStats('daily', [r(8, 10)], true).score).toBe(MAX_POINTS + 2 * UNDER_PAR_BONUS);
    expect(endStats('daily', [r(8, 10)]).score).toBe(MAX_POINTS);
  });

  it('every pour counts in the Par Challenge: undo and restart put colors back, not moves', () => {
    const level = { spec: { colors: 2, cap: 2, empty: 1, odd: false }, board: b([2, [1, 0]], [2, [0, 1]], [2, []]), par: 3, parOptimal: true, palette: [0, 1], mystery: false };
    let p = startLevel(level, 'precision');
    p = reduceLevel(reduceLevel(p, { type: 'pour', from: 0, to: 2 }), { type: 'undo' });
    expect(p.board).toEqual(level.board);
    expect(p.moves).toBe(1);
    p = reduceLevel(reduceLevel(p, { type: 'pour', from: 0, to: 2 }), { type: 'restart' });
    expect(p.moves).toBe(2);
    expect(reduceLevel(p, { type: 'pour', from: 0, to: 2 }).status).toBe('failed');
    // Elsewhere undo still gives the move back, and counts the undo.
    const d = reduceLevel(reduceLevel(startLevel(level, 'daily'), { type: 'pour', from: 0, to: 2 }), { type: 'undo' });
    expect(d).toMatchObject({ moves: 0, undos: 1 });
  });

  it('Endless and the Par Challenge score the levels solved; mystery pars allow for the hidden layers', () => {
    expect(endStats('endless', [r(12, 10), r(30, 10)])).toMatchObject({ score: 2, stats: { levels: 2 } });
    expect(endStats('precision', [r(10, 10)])).toMatchObject({ score: 1, stats: { parLevels: 1 } });
    const m = ladderLevel(42, 10);
    expect(m.mystery).toBe(true);
    expect(m.parSlack).toBe(MYSTERY_SLACK);
    expect(m.par).toBe(m.solution!.length + MYSTERY_SLACK);
    expect(shareText({ label: 'Daily #3', results: [r(10, 10)], url: 'u' })).toContain('Color Lab Daily #3');
  });

  it('two tabs: a write goes on top of the stored save, and a daily puzzle is recorded once', () => {
    localStorage.clear();
    const day = '2026-11-03';
    const mine = updateCl((s) => s, day);
    // The other tab records the first daily puzzle and an Endless best.
    localStorage.setItem(STORE_KEY, JSON.stringify(recordLevel({ ...mine, endless: { runs: 1, bestLevels: 7, bestScore: 70 } }, r(5, 5), day, false, 0)));
    // This tab (stale) records the same puzzle and toggles mute: nothing of the other tab is lost.
    const next = updateCl((s) => ({ ...recordLevel(s, r(9, 5), day, false, 0), muted: true }), day);
    expect(next.endless.bestLevels).toBe(7);
    expect(next.daily[day]).toHaveLength(1);
    expect(next.daily[day]![0]!.moves).toBe(5);
    expect(loadCl()).toMatchObject({ muted: true });
  });

  it('keeps challenge rounds in the save, cleaned and pruned', () => {
    const s = sanitizeCl({ v: 2, challenges: { 'abc:1': { day: '2026-11-03', results: [{ solved: true, moves: 3, par: 3, points: 99 }], help: { hints: 1 }, done: false }, 'bad:1': { day: 'x' } } });
    expect(s.challenges).toEqual({ 'abc:1': { day: '2026-11-03', results: [{ solved: true, moves: 3, par: 3, hints: 0, spare: false, points: MAX_POINTS, stars: 0 }], help: { hints: 1, spare: false }, done: false } });
    expect(sanitizeCl({ v: 2 }).challenges).toEqual({});
  });
});
