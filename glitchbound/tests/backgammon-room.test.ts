import { describe, expect, it } from 'vitest';
import { ENGINES } from '../rooms/engines';
import { newGame, nextSteps, turnDone, type Pos } from '../src/games/backgammon/logic';
import { act, AWAY_MS, BOT_MS, CLOCK_MS, DONE_MS, join, leave, newRoom, SHEET_MS, STAND_IN_TURNS, STUCK_MS, summary, tick, viewFor, type State } from '../src/games/backgammon/room';

const A = 'player-key-aaaaaaaaaaaaaaaa';
const B = 'player-key-bbbbbbbbbbbbbbbb';

/** Plays whoever's turn it is for a human: roll, the first legal step until none, done. */
function humanTurn(s: State, key: string, t: number): number {
  const g = s.match!.game;
  if (g.phase === 'opening' || g.phase === 'roll') act(s, key, { t: 'roll' }, ++t);
  for (let i = 0; i < 6; i++) {
    const g2 = s.match!.game;
    if (g2.phase !== 'move') break;
    const st = nextSteps(g2)[0];
    if (!st) break;
    act(s, key, { t: 'step', from: st.from, to: st.to, die: st.die }, ++t);
  }
  if (s.match!.game.phase === 'move' && turnDone(s.match!.game)) act(s, key, { t: 'done' }, ++t);
  return t;
}

describe('backgammon live room', () => {
  it('is registered with the rooms worker', () => {
    expect(ENGINES.backgammon).toBeDefined();
  });

  it('seats two, lets the host pick the length, and never shows the dice seeds', () => {
    const s = newRoom('ABCDE', 0, 5);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    expect(s.places).toEqual([1, 2]);
    act(s, B, { t: 'target', n: 7 }, 3);
    expect(s.target).toBe(5); // only the host
    act(s, A, { t: 'target', n: 7 }, 3);
    expect(s.target).toBe(7);
    act(s, A, { t: 'start' }, 4);
    expect(s.phase).toBe('play');
    const v = viewFor(s, B)!;
    expect(v.you).toBe(1);
    expect(v.match!.seed).toBe(0);
    expect(v.match!.game.seed).toBe(0);
    expect(s.match!.seed).not.toBe(0);
  });

  it('refuses moves out of turn and illegal steps, and plays a whole match between two phones', () => {
    const s = newRoom('ABCDE', 0, 9);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    act(s, A, { t: 'target', n: 3 }, 3);
    act(s, A, { t: 'start' }, 4);
    let t = 5;
    act(s, A, { t: 'roll' }, ++t); // the opening: either may roll
    const g = s.match!.game;
    const other = g.turn === 0 ? B : A;
    expect(act(s, other, { t: 'roll' }, ++t)).toBeNull();
    expect(s.match!.game).toBe(g);
    const mover = g.turn === 0 ? A : B;
    expect(act(s, mover, { t: 'step', from: 13, to: 1, die: 6 }, ++t)).toMatch(/allowed/);
    for (let i = 0; i < 4000 && s.phase !== 'over'; i++) {
      if (s.phase === 'gameEnd') {
        act(s, A, { t: 'next' }, ++t);
        act(s, B, { t: 'next' }, ++t);
        continue;
      }
      const turn = s.match!.game.turn;
      t = humanTurn(s, turn === 0 ? A : B, t);
      tick(s, t + 5000);
    }
    expect(s.phase).toBe('over');
    expect(Math.max(...s.match!.score)).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it("a played-out turn passes by itself if the player's 'done' never arrives", () => {
    const s = newRoom('ABCDE', 0, 9);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    act(s, A, { t: 'start' }, 4);
    let t = 5;
    act(s, A, { t: 'roll' }, ++t);
    // play the opening move to the end, without 'done'
    for (let i = 0; i < 6; i++) {
      const g = s.match!.game;
      const st = g.phase === 'move' ? nextSteps(g)[0] : undefined;
      if (!st) break;
      act(s, g.turn === 0 ? A : B, { t: 'step', from: st.from, to: st.to, die: st.die }, ++t);
    }
    const g = s.match!.game;
    expect(g.phase === 'move' && g.steps.length > 0 && turnDone(g)).toBe(true);
    expect(s.deadline).toBe(t + DONE_MS);
    tick(s, t + DONE_MS);
    expect(s.match!.game.turn).not.toBe(g.turn);
    expect(s.match!.game.phase).toBe('roll');
  });

  it('a player shut out (on the bar, the board closed) does not roll: the turn passes for both phones to see (#25)', () => {
    const s = newRoom('ABCDE', 0, 9);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    act(s, A, { t: 'start' }, 4);
    // Ana (place 0) has a checker on the bar; Bo holds every point she could come in on
    const pts = Array<number>(25).fill(0);
    pts[6] = 14;
    for (const i of [19, 20, 21, 22, 23, 24]) pts[i] = -2;
    pts[1] = -3;
    const closed: Pos = { pts, bar: [1, 0], off: [0, 0] };
    s.match!.game = { ...newGame(1), pos: closed, turnStart: closed, turn: 0, phase: 'roll', roll: [3, 1], rolls: 8 };
    expect(act(s, B, { t: 'roll' }, 9)).toBeNull(); // not Bo's turn: nothing happens
    expect(s.match!.game.turn).toBe(0);
    tick(s, 10); // sets the room's clock again
    expect(s.deadline).toBe(10 + STUCK_MS);
    tick(s, 10 + STUCK_MS);
    // the pass uses up Ana's roll, so every roll number keeps belonging to the same side
    expect(s.match!.game).toMatchObject({ turn: 1, phase: 'roll', rolls: 9, lastTurn: { side: 0, roll: null, steps: [] } });
    expect(viewFor(s, A)!.match!.game.turn).toBe(1);
    // Bo plays on as usual
    act(s, B, { t: 'roll' }, 11 + STUCK_MS);
    expect(s.match!.game).toMatchObject({ turn: 1, phase: 'move', rolls: 10 });
  });

  it('a computer that is shut out passes too, after the same pause', () => {
    const s = newRoom('ABCDE', 0, 13);
    join(s, A, 'Ana', 1);
    act(s, A, { t: 'bot', level: 'hard' }, 3);
    act(s, A, { t: 'start' }, 4);
    const pts = Array<number>(25).fill(0);
    for (const i of [1, 2, 3, 4, 5, 6]) pts[i] = 2;
    pts[13] = 3;
    pts[24] = -14;
    const closed: Pos = { pts, bar: [0, 1], off: [0, 0] };
    s.match!.game = { ...newGame(1), pos: closed, turnStart: closed, turn: 1, phase: 'roll', roll: [3, 1], rolls: 8 };
    tick(s, 5); // sets the clock again
    expect(s.deadline).toBe(5 + STUCK_MS);
    tick(s, 5 + STUCK_MS);
    expect(s.match!.game).toMatchObject({ turn: 0, phase: 'roll', rolls: 9 });
  });

  it('the computer plays the second place on its clock; with its only player gone, the match waits', () => {
    const s = newRoom('ABCDE', 0, 13);
    join(s, A, 'Ana', 1);
    expect(act(s, A, { t: 'start' }, 2)).toMatch(/Two players/);
    act(s, A, { t: 'bot', level: 'hard' }, 3);
    act(s, A, { t: 'target', n: 3 }, 3);
    act(s, A, { t: 'start' }, 4);
    act(s, A, { t: 'roll' }, 5);
    let t = 5;
    for (let i = 0; i < 3000 && s.phase === 'play'; i++) {
      const g = s.match!.game;
      if (g.turn === 0 && g.phase !== 'over') t = humanTurn(s, A, t);
      else {
        t = Math.max(t + BOT_MS, s.deadline ?? t);
        tick(s, t);
      }
    }
    expect(['gameEnd', 'over']).toContain(s.phase);
    // from here Ana leaves: nobody is at the table, so nothing moves (the computer does not play on alone)
    leave(s, A, t + 1);
    const frozen = JSON.stringify(s.match);
    for (let i = 0; i < 50; i++) tick(s, t + 2 + i * (SHEET_MS + AWAY_MS));
    expect(JSON.stringify(s.match)).toBe(frozen);
    expect(s.deadline).toBeNull();
  }, 120_000);
});

/** A room with Ana and Bo seated and a match to 3 started at t=4. */
function twoPlayers(seed = 9): State {
  const s = newRoom('ABCDE', 0, seed);
  join(s, A, 'Ana', 1);
  join(s, B, 'Bo', 2);
  act(s, A, { t: 'target', n: 3 }, 3);
  act(s, A, { t: 'start' }, 4);
  return s;
}

describe('backgammon live room: players who drop (BG-01)', () => {
  it('with both players offline the match waits: nothing is rolled or played, the result sheet waits too', () => {
    const s = twoPlayers();
    act(s, A, { t: 'roll' }, 5);
    leave(s, A, 6);
    leave(s, B, 7);
    const before = JSON.stringify(s.match);
    expect(s.deadline).toBeNull();
    for (let t = 8; t < 10 * 60_000; t += 5000) tick(s, t);
    expect(JSON.stringify(s.match)).toBe(before);
    // Bo is back: the match goes on (Ana is away, so after her grace the computer plays her move)
    join(s, B, 'Bo', 600_000);
    expect(s.deadline).toBe(600_000 + AWAY_MS);
  });

  it('one player away: a grace, then the computer plays at most a couple of their turns, then waits for them', () => {
    const s = twoPlayers();
    let t = 5;
    // Bo drops before the opening roll
    leave(s, B, t);
    // Ana rolls the opening; whoever starts, Bo's turns come
    for (let i = 0; i < 400; i++) {
      const g = s.match!.game;
      if (s.phase !== 'play') break;
      if (g.phase === 'opening' || g.turn === 0) {
        t = humanTurn(s, A, t);
        tick(s, ++t);
        continue;
      }
      if (s.deadline === null) break;
      // each of Bo's turns starts with a fresh grace
      if (g.phase === 'roll') expect(s.deadline - t).toBeGreaterThanOrEqual(AWAY_MS - 2);
      t = s.deadline;
      tick(s, t);
    }
    expect(s.match!.game.turn).toBe(1);
    expect(s.match!.game.phase).toBe('roll');
    expect(s.covered).toEqual([0, STAND_IN_TURNS]);
    // the match waits for Bo: no deadline, and ticks change nothing
    expect(s.deadline).toBeNull();
    const view = viewFor(s, A)!;
    expect(view.away).toEqual({ place: 1, at: null });
    // Bo comes back and is told what the computer did; once he plays, the count starts again
    join(s, B, 'Bo', t + 1);
    expect(viewFor(s, B)!.covered).toBe(STAND_IN_TURNS);
    act(s, B, { t: 'roll' }, t + 2);
    expect(viewFor(s, B)!.covered).toBe(0);
  });
});

describe('backgammon live room: the turn clock', () => {
  it('off by default; when the host turns it on, an idle player gets CLOCK_MS, then the computer plays for them', () => {
    const s = newRoom('ABCDE', 0, 9);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    act(s, B, { t: 'clock', on: true }, 3);
    expect(s.clock).toBe(false); // only the host
    act(s, A, { t: 'start' }, 4);
    expect(s.deadline).toBeNull(); // no clock: a present player is never hurried
    const c = newRoom('ABCDE', 0, 9);
    join(c, A, 'Ana', 1);
    join(c, B, 'Bo', 2);
    act(c, A, { t: 'clock', on: true }, 3);
    act(c, A, { t: 'start' }, 4);
    expect(c.deadline).toBe(4 + CLOCK_MS);
    expect(viewFor(c, B)!.clockAt).toBe(4 + CLOCK_MS);
    tick(c, 4 + CLOCK_MS);
    expect(c.match!.game.phase).toBe('move'); // the opening was rolled for them
    const g = c.match!.game;
    expect(c.deadline).toBe(4 + 2 * CLOCK_MS);
    tick(c, 4 + 2 * CLOCK_MS);
    // and the roll played: the turn is over, the other side rolls
    expect(c.match!.game).toMatchObject({ turn: 1 - g.turn, phase: 'roll', lastTurn: { side: g.turn } });
  });
});

describe('backgammon live room: the room list (BG-05)', () => {
  it('counts the two places, not watchers, and is full once both are taken', () => {
    const s = newRoom('ABCDE', 0, 9);
    join(s, A, 'Ana', 1);
    expect(summary(s)).toMatchObject({ players: 1, full: false });
    join(s, B, 'Bo', 2);
    expect(summary(s)).toMatchObject({ players: 2, full: true });
    join(s, 'player-key-cccccccccccccccc', 'Cy', 3);
    expect(summary(s)).toMatchObject({ players: 2, full: true });
    expect(viewFor(s, 'player-key-cccccccccccccccc')!.you).toBe(-1);
    const b = newRoom('BCDEF', 0, 9);
    join(b, A, 'Ana', 1);
    act(b, A, { t: 'bot', level: 'easy' }, 2);
    expect(summary(b)).toMatchObject({ players: 2, full: true });
  });
});
