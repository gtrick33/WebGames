import { describe, expect, it } from 'vitest';
import { ENGINES } from '../rooms/engines';
import { nextSteps, turnDone } from '../src/games/backgammon/logic';
import { act, AWAY_MS, BOT_MS, DONE_MS, join, leave, newRoom, SHEET_MS, tick, viewFor, type State } from '../src/games/backgammon/room';

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

  it('the computer plays the second place on its clock; someone who leaves is played for', () => {
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
    // from here Ana leaves: the stand-in finishes the match
    leave(s, A, t + 1);
    for (let i = 0; i < 6000 && s.phase !== 'over'; i++) {
      t = Math.max(t + 50, s.deadline ?? t + 50);
      tick(s, t + SHEET_MS);
    }
    expect(s.phase).toBe('over');
    expect(AWAY_MS).toBeGreaterThan(0);
  }, 120_000);
});
