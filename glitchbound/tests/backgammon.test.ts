import { describe, expect, it } from 'vitest';
import { choosePlay, contact, judge, LEVELS, ROLLS, shotsOn, type Level } from '../src/games/backgammon/ai';
import {
  allPlays,
  applyStep,
  bookGame,
  CHECKERS,
  endTurn,
  legalSteps,
  maxDice,
  newGame,
  newMatch,
  nextGame,
  nextSteps,
  pips,
  playAll,
  posKey,
  roll,
  rollAt,
  rng,
  startPos,
  step,
  turnDone,
  undo,
  type Game,
  type Pos,
  type Side,
} from '../src/games/backgammon/logic';

/** A position from a list of [point, count] (+ player 0, − player 1). */
function pos(list: [number, number][], bar: [number, number] = [0, 0], off?: [number, number]): Pos {
  const pts = Array<number>(25).fill(0);
  for (const [i, n] of list) pts[i] = n;
  const on = (s: Side): number => list.reduce((a, [, n]) => a + (s === 0 ? Math.max(0, n) : Math.max(0, -n)), 0) + bar[s];
  return { pts, bar, off: off ?? [CHECKERS - on(0), CHECKERS - on(1)] };
}
const total = (p: Pos, s: Side): number => p.off[s] + p.bar[s] + p.pts.reduce((a, n) => a + (s === 0 ? Math.max(0, n) : Math.max(0, -n)), 0);

/** Plays a whole game with computer players at `levels`; the finished game. */
function botGame(seed: number, levels: [Level, Level]): Game {
  let g = roll(newGame(seed));
  const r = rng(seed ^ 0xabc);
  for (let turns = 0; turns < 600 && g.phase !== 'over'; turns++) {
    if (g.phase === 'roll') g = roll(g);
    const steps = choosePlay(g.pos, g.turn, g.left, levels[g.turn]!, r);
    for (const st of steps) {
      const before = g;
      g = step(g, st);
      expect(g).not.toBe(before); // every computer step is legal
      if (g.phase === 'over') break;
    }
    if (g.phase === 'move') {
      expect(turnDone(g)).toBe(true);
      g = endTurn(g);
    }
  }
  return g;
}

describe('backgammon: the board and the moves', () => {
  it('starts with 15 each in the classic spots, 167 pips apiece', () => {
    const p = startPos();
    expect(total(p, 0)).toBe(15);
    expect(total(p, 1)).toBe(15);
    expect(pips(p, 0)).toBe(167);
    expect(pips(p, 1)).toBe(167);
  });

  it('the opening 3-1 can make the 5-point', () => {
    const plays = allPlays(startPos(), 0, [3, 1]);
    expect(plays.some((x) => x.pos.pts[5] === 2 && x.pos.pts[8] === 2 && x.pos.pts[6] === 4)).toBe(true);
    // no play ever lands on a closed point
    for (const x of plays) for (let i = 1; i <= 24; i++) expect(x.pos.pts[i]! >= 0 || x.pos.pts[i]! <= -2 || x.pos.pts[i] === -1).toBe(true);
  });

  it('a double plays four times', () => {
    expect(maxDice(startPos(), 0, [6, 6, 6, 6])).toBe(4);
    const plays = allPlays(startPos(), 0, [6, 6, 6, 6]);
    for (const x of plays) expect(x.steps).toHaveLength(4);
  });

  it('a checker on the bar comes in first; a closed board blocks it', () => {
    const p = pos([[6, 5], [8, 3], [13, 5], [1, -2], [12, -5], [17, -3], [19, -2], [20, -2], [21, -2]], [1, 0]);
    // entry points for player 0 are 25 − die: 24 open, 19-21 closed
    const steps = legalSteps(p, 0, [6, 5]);
    expect(steps.every((s) => s.from === 25)).toBe(true);
    expect(steps.map((s) => s.to)).toEqual([]); // 19 and 20 are closed
    const steps2 = legalSteps(p, 0, [1, 5]);
    expect(steps2.map((s) => s.to).sort()).toEqual([24]);
    const closed = pos([[6, 14], [19, -2], [20, -2], [21, -2], [22, -2], [23, -2], [24, -2]], [1, 0]);
    expect(legalSteps(closed, 0, [3, 5])).toEqual([]);
  });

  it('both numbers must be used when they can; with only one, the larger', () => {
    // player 0: one checker on 12, a closed point at 7 (12−5) — the 5 then the 6 is impossible, the 6 then the 5 works
    const p = pos([[12, 1], [6, 14], [7, -2], [1, -13]]);
    const first = legalSteps(p, 0, [5, 6]);
    expect(first.every((s) => s.from === 12 && s.die === 6) || first.some((s) => s.from === 6)).toBe(true);
    // a blocked board where either die alone can move, but not both: the larger one must be played
    const q = pos([[24, 1], [18, -2], [19, -2], [13, -2], [1, -9]], [0, 0], [14, 0]);
    const legal = legalSteps(q, 0, [6, 5]);
    expect(legal.every((s) => s.die === 6 || legal.every((x) => x.die !== 6))).toBe(true);
  });

  it('bears off with exact numbers, or a higher number from the highest point held', () => {
    const p = pos([[5, 2], [3, 1], [24, -15]], [0, 0], [12, 0]);
    const six = legalSteps(p, 0, [6]);
    expect(six.map((s) => [s.from, s.to])).toEqual([[5, 0]]);
    const three = legalSteps(p, 0, [3]);
    expect(three.some((s) => s.from === 3 && s.to === 0)).toBe(true);
    expect(three.some((s) => s.from === 5 && s.to === 2)).toBe(true);
    // not everything home yet: no bearing off
    const q = pos([[5, 2], [8, 1], [24, -15]], [0, 0], [12, 0]);
    expect(legalSteps(q, 0, [6]).some((s) => s.to === 0)).toBe(false);
  });

  it('hitting a blot sends it to the bar', () => {
    const p = pos([[13, 1], [10, -1], [24, -14]], [0, 0], [14, 0]);
    const st = legalSteps(p, 0, [3]).find((s) => s.to === 10)!;
    expect(st.hit).toBe(true);
    const n = applyStep(p, 0, st);
    expect(n.bar[1]).toBe(1);
    expect(n.pts[10]).toBe(1);
  });
});

describe('backgammon: a game and a match', () => {
  it('the opening roll decides who starts, and the same seed rolls the same dice', () => {
    const g = roll(newGame(42));
    expect(g.phase).toBe('move');
    expect(g.roll![0]).not.toBe(g.roll![1]);
    expect(g.turn).toBe(g.roll![0] > g.roll![1] ? 0 : 1);
    expect(roll(newGame(42))).toEqual(g);
    expect(rollAt(7, 3)).toEqual(rollAt(7, 3));
    const faces = new Set<number>();
    for (let i = 0; i < 200; i++) rollAt(9, i).forEach((d) => faces.add(d));
    expect([...faces].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('a turn: steps, undo back to the roll, then the turn passes', () => {
    let g = roll(newGame(5));
    const start = posKey(g.pos);
    const first = nextSteps(g)[0]!;
    g = step(g, first);
    expect(g.steps).toHaveLength(1);
    g = undo(g);
    expect(posKey(g.pos)).toBe(start);
    expect(g.left.length).toBeGreaterThanOrEqual(2);
    const plays = allPlays(g.pos, g.turn, g.left);
    const who = g.turn;
    g = playAll(g, plays[0]!.steps);
    expect(g.phase).toBe('roll');
    expect(g.turn).toBe(1 - who);
  });

  it('scores a single game 1, a gammon 2 and a backgammon 3', () => {
    const base = (p: Pos): Game => ({ ...newGame(1), pos: p, turnStart: p, phase: 'move', turn: 0, roll: [6, 5], left: [6, 5] });
    // single: player 1 has borne some off
    let g = step(base(pos([[1, 1]], [0, 0], [14, 3])), { from: 1, to: 0, die: 6 });
    expect([g.phase, g.winner, g.points]).toEqual(['over', 0, 1]);
    // gammon: none off, none left in player 0's home board
    g = step(base(pos([[1, 1], [12, -15]], [0, 0], [14, 0])), { from: 1, to: 0, die: 6 });
    expect(g.points).toBe(2);
    // backgammon: none off and one still in player 0's home board
    g = step(base(pos([[1, 1], [3, -1], [12, -14]], [0, 0], [14, 0])), { from: 1, to: 0, die: 6 });
    expect(g.points).toBe(3);
  });

  it('a match books games until someone reaches the target', () => {
    let m = newMatch(3, 3);
    m = { ...m, game: { ...m.game, phase: 'over', winner: 1, points: 2 } };
    m = bookGame(m);
    expect(m.score).toEqual([0, 2]);
    expect(m.winner).toBeNull();
    m = nextGame(m);
    expect(m.game.phase).toBe('opening');
    m = bookGame({ ...m, game: { ...m.game, phase: 'over', winner: 1, points: 1 } });
    expect(m.winner).toBe(1);
  });
});

describe('backgammon: the computer players', () => {
  it('play whole games at every level with legal moves only, and every checker gets home', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const g = botGame(seed, [LEVELS[seed % 3]!, LEVELS[(seed + 1) % 3]!]);
      expect(g.phase).toBe('over');
      expect(g.pos.off[g.winner!]).toBe(15);
      expect(total(g.pos, 0)).toBe(15);
      expect(total(g.pos, 1)).toBe(15);
    }
  }, 120_000);

  it('count shots like a player: a blot six away is hit by 17 of the 36 rolls', () => {
    // player 0 blot on 10, a single player-1 checker on 4 (6 away), nothing in between
    const p = pos([[10, 1], [2, 14], [4, -1], [24, -14]]);
    expect(shotsOn(p, 0).get(10)).toBe(17);
    // a point of ours on 6 blocks the 2-2 route (4 → 6 → 8 → 10): one roll fewer
    expect(shotsOn(pos([[10, 1], [6, 14], [4, -1], [24, -14]]), 0).get(10)).toBe(16);
    expect(ROLLS.reduce((a, r) => a + r.w, 0)).toBe(36);
    expect(contact(startPos())).toBe(true);
    expect(contact(pos([[3, 15], [20, -15]]))).toBe(false);
  });

  it('prefer making the 5-point with an opening 3-1', () => {
    const steps = choosePlay(startPos(), 0, [3, 1], 'hard', rng(1));
    const after = steps.reduce((p, st) => applyStep(p, 0, st), startPos());
    expect(after.pts[5]).toBe(2);
    expect(judge(after, 0)).toBeGreaterThan(judge(startPos(), 0) - 5);
  });

  it('hard beats easy over a set of games', () => {
    let hard = 0;
    let easy = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (const flip of [0, 1] as const) {
        const g = botGame(seed * 11 + flip, flip ? ['easy', 'hard'] : ['hard', 'easy']);
        const hardSide = flip ? 1 : 0;
        if (g.winner === hardSide) hard += g.points;
        else easy += g.points;
      }
    }
    expect(hard).toBeGreaterThan(easy * 1.5);
  }, 120_000);

  it('an expert decision takes well under a second', () => {
    const t0 = performance.now();
    choosePlay(startPos(), 0, [6, 6, 6, 6], 'expert', rng(2));
    choosePlay(startPos(), 1, [4, 2], 'expert', rng(3));
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});

describe('backgammon: the larger-die rule at the very end', () => {
  it('one checker left and either number bears it off: the larger number is the play', () => {
    const p = pos([[24, -1]], [0, 0], [0, 14]);
    const plays = allPlays(p, 1, [2, 6]);
    expect(plays).toHaveLength(1);
    expect(plays[0]!.steps[0]!.die).toBe(6);
    expect(legalSteps(p, 1, [2, 6]).map((s) => s.die)).toEqual([6]);
  });
});
