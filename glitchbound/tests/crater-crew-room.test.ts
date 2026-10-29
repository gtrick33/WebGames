import { describe, expect, it } from 'vitest';
import { ENGINES, QUICK } from '../rooms/engines';
import { botTurn } from '../src/games/crater-crew/ai';
import { playTurn } from '../src/games/crater-crew/match';
import { act, AWAY_MS, BOT_MS, GRACE_MS, join, leave, maxMessage, newRoom, relay, tick, viewFor, type State } from '../src/games/crater-crew/room';
import { IN_JUMP, IN_LEFT, IN_RIGHT } from '../src/games/crater-crew/sim';

const A = 'player-key-aaaaaaaaaaaaaaaa';
const B = 'player-key-bbbbbbbbbbbbbbbb';
const C = 'player-key-cccccccccccccccc';

const keyOf = (s: State, n: number | null): string => s.seats.find((x) => x.n === n)!.key;

/** Plays the current turn the way a phone does: a few steps of walking, then a computer-chosen shot. */
function phoneTurn(s: State, at: number): string | null {
  const m = s.match!;
  const crew = m.crews[m.crewTurn]!;
  const shot = botTurn(m, 'normal', m.turn + 7).fire;
  return act(s, keyOf(s, crew.seat), { t: 'turn', turn: m.turn, walk: [[IN_RIGHT, 12], [0, 4]], fire: shot }, at);
}

describe('crater crew live room', () => {
  it('is registered with the rooms worker, quick match included', () => {
    expect(ENGINES['crater-crew']).toBeDefined();
    expect(QUICK['crater-crew'].min).toBe(2);
    expect(maxMessage).toBeGreaterThan(8000);
  });

  it('gives everyone their own critter, and only the host changes the settings', () => {
    const s = newRoom('ABCDE', 0, 5);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    expect(s.picks.map((p) => p.n)).toEqual([1, 2]);
    expect(new Set(s.picks.map((p) => p.char)).size).toBe(2);
    const bo = s.picks[1]!.char;
    expect(act(s, A, { t: 'char', char: bo }, 3)).toMatch(/already/);
    act(s, B, { t: 'terrain', id: 'moon' }, 3);
    expect(s.terrain).toBe('random');
    act(s, A, { t: 'terrain', id: 'moon' }, 3);
    act(s, A, { t: 'size', n: 3 }, 3);
    act(s, A, { t: 'time', n: 45 }, 3);
    act(s, A, { t: 'size', n: 9 }, 3);
    expect([s.terrain, s.crewSize, s.turnSecs]).toEqual(['moon', 3, 45]);
    act(s, A, { t: 'bot', op: 'add' }, 4);
    expect(s.bots).toHaveLength(1);
    expect(taken(s)).toBe(3);
    act(s, A, { t: 'bot', op: 'level', i: 0, level: 'hard' }, 4);
    expect(s.bots[0]!.level).toBe('hard');
    act(s, A, { t: 'start' }, 5);
    expect(s.phase).toBe('play');
    expect(s.match!.terrain).toBe('moon');
    expect(s.match!.units).toHaveLength(9);
    expect(s.match!.crews.map((c) => c.name)).toEqual(['Ana', 'Bo', expect.stringContaining('CPU')]);
    // nobody's key ever leaves the server
    expect(JSON.stringify(viewFor(s, B))).not.toContain(A);
  });

  it('needs two crews to start, and seats at most six', () => {
    const s = newRoom('ABCDE', 0, 5);
    join(s, A, 'Ana', 1);
    expect(act(s, A, { t: 'start' }, 2)).toMatch(/Two crews/);
    for (let i = 0; i < 7; i++) act(s, A, { t: 'bot', op: 'add' }, 3);
    expect(s.picks.length + s.bots.length).toBe(6);
    join(s, B, 'Bo', 4);
    expect(s.picks.some((p) => p.n === 2)).toBe(false);
    act(s, A, { t: 'bot', op: 'remove', i: 0 }, 5);
    expect(act(s, B, { t: 'play' }, 6)).toBeNull();
    expect(s.picks.some((p) => p.n === 2)).toBe(true);
  });

  it('takes turns only from the crew to play, replays them like the phone, and plays the computer', () => {
    const s = newRoom('ABCDE', 0, 21);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    act(s, A, { t: 'bot', op: 'add' }, 3);
    act(s, A, { t: 'size', n: 1 }, 3);
    act(s, A, { t: 'start' }, 4);
    let t = s.turnAt;
    for (let turn = 0; turn < 40 && s.phase === 'play'; turn++) {
      const m = s.match!;
      const crew = m.crews[m.crewTurn]!;
      t = Math.max(t, s.turnAt) + 10;
      if (crew.bot) {
        tick(s, t);
        expect(s.match).toBe(m); // still thinking
        t = s.turnAt + BOT_MS;
        tick(s, t);
        expect(s.match!.turn).toBe(m.turn + 1);
        continue;
      }
      const other = crew.seat === 1 ? B : A;
      expect(act(s, other, { t: 'turn', turn: m.turn, walk: [], fire: null }, t)).toMatch(/your turn/);
      expect(act(s, keyOf(s, crew.seat), { t: 'turn', turn: m.turn - 1, walk: [], fire: null }, t)).toBeNull();
      expect(s.match).toBe(m);
      const expected = playTurn(m, { walk: [[IN_RIGHT, 12], [0, 4]], fire: botTurn(m, 'normal', m.turn + 7).fire }).match;
      expect(phoneTurn(s, t)).toBeNull();
      expect(JSON.stringify(s.match)).toBe(JSON.stringify(expected));
      expect(s.turnAt).toBeGreaterThan(t);
    }
    expect(s.match!.turn).toBeGreaterThan(5);
  }, 60_000);

  it('takes the run after dropped dynamite with the turn, and keeps it for every phone to replay', () => {
    const s = newRoom('ABCDE', 0, 33);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    act(s, A, { t: 'start' }, 4);
    const m = s.match!;
    const dyn = { w: 'dynamite' as const, aim: 0, dir: 1 as const, power: 0, tx: 0 };
    const run: [number, number][] = [[IN_LEFT, 120], [IN_LEFT | IN_JUMP, 1], [IN_LEFT, 400]];
    const expected = playTurn(m, { walk: [], fire: dyn, run: [[IN_LEFT, 120], [IN_LEFT | IN_JUMP, 1], [IN_LEFT, 59]] }).match;
    expect(act(s, keyOf(s, m.crews[m.crewTurn]!.seat), { t: 'turn', turn: m.turn, walk: [], fire: dyn, run }, s.turnAt + 10)).toBeNull();
    expect(JSON.stringify(s.match)).toBe(JSON.stringify(expected));
    expect(s.match!.last!.input.run).toEqual([[IN_LEFT, 120], [IN_LEFT | IN_JUMP, 1], [IN_LEFT, 59]]);
  });

  it('passes the turn of a player who left, and of one whose clock ran out', () => {
    const s = newRoom('ABCDE', 0, 3);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    join(s, C, 'Cy', 3);
    act(s, A, { t: 'start' }, 4);
    const m = s.match!;
    const key = keyOf(s, m.crews[m.crewTurn]!.seat);
    leave(s, key, 10);
    const t = Math.max(s.turnAt, 10);
    tick(s, t + AWAY_MS - 1);
    expect(s.match).toBe(m);
    tick(s, t + AWAY_MS + 1);
    expect(s.match!.turn).toBe(1);
    const m2 = s.match!;
    const end = s.turnAt + m2.turnSecs * 1000 + GRACE_MS;
    tick(s, end - 5);
    expect(s.match).toBe(m2);
    tick(s, end + 1);
    expect(s.match!.turn).toBe(2);
  });

  it('streams only the active player’s position, and never stores it', () => {
    const s = newRoom('ABCDE', 0, 3);
    join(s, A, 'Ana', 1);
    join(s, B, 'Bo', 2);
    act(s, A, { t: 'start' }, 4);
    const m = s.match!;
    const mine = keyOf(s, m.crews[m.crewTurn]!.seat);
    const other = mine === A ? B : A;
    const pos = { t: 'pos' as const, x: 100, y: 200, f: 1, a: 300, w: 'rocket', p: 0, mv: 1, tx: 0 };
    expect(relay(s, mine, pos)).toMatchObject({ others: { t: 'pos', unit: m.active, x: 100, y: 200 }, save: false });
    expect(relay(s, other, pos)?.others).toBeUndefined();
    expect(relay(s, mine, { t: 'start' })).toBeNull();
  });

  it('ends with a winner, a point for their seat, and a rematch or a way back to the lobby', () => {
    const s = newRoom('ABCDE', 0, 8);
    join(s, A, 'Ana', 1);
    act(s, A, { t: 'bot', op: 'add' }, 2);
    act(s, A, { t: 'size', n: 1 }, 2);
    act(s, A, { t: 'start' }, 3);
    let t = 10;
    for (let i = 0; i < 300 && s.phase === 'play'; i++) {
      const m = s.match!;
      t = Math.max(t, s.turnAt) + BOT_MS + 1;
      if (m.crews[m.crewTurn]!.bot) tick(s, t);
      else act(s, A, { t: 'turn', turn: m.turn, walk: [], fire: botTurn(m, 'hard', i).fire }, t);
    }
    expect(s.phase).toBe('over');
    const w = s.match!.winner!;
    expect(s.seats[0]!.score).toBe(w === 0 ? 1 : 0);
    expect(act(s, A, { t: 'again' }, t + 1)).toBeNull();
    expect(s.phase).toBe('play');
    expect(s.battles).toBe(2);
  }, 60_000);
});

const taken = (s: State): number => s.picks.length + s.bots.length;
