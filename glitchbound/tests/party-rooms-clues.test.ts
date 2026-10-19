import { describe, expect, it } from 'vitest';
import { dialPoints } from '../src/party/dial';
import { huePoints } from '../src/party/hues';
import * as dial from '../src/party/rooms/dialRoom';
import * as hues from '../src/party/rooms/huesRoom';
import * as unique from '../src/party/rooms/uniqueRoom';

const KEYS = ['aaaaaaaaaaaaaaaa1', 'bbbbbbbbbbbbbbbb2', 'cccccccccccccccc3', 'dddddddddddddddd4', 'eeeeeeeeeeeeeeee5'];
const T0 = 1_800_000_000_000;

/** Runs a room's timers forward until nothing is scheduled (or a step limit). */
function runClock<S extends { deadline: number | null }>(s: S, tick: (s: S, now: number) => void, until: (s: S) => boolean, max = 5000): void {
  let now = T0;
  for (let i = 0; i < max && !until(s) && s.deadline !== null; i++) {
    now = Math.max(now, s.deadline) + 1;
    tick(s, now);
  }
}

describe('One of a Kind room', () => {
  const room = (players = 4) => {
    const s = unique.newRoom('ABCDE', T0, 11);
    KEYS.slice(0, players).forEach((k, i) => unique.join(s, k, `P${i + 1}`, T0));
    unique.act(s, KEYS[0]!, { t: 'start' }, T0);
    return s;
  };

  it('keeps the word off the guesser’s phone and every clue secret while writing', () => {
    const s = room();
    expect(s.phase).toBe('write');
    expect(s.guesser).toBe(1);
    s.word = 'pineapple';
    const g = unique.viewFor(s, KEYS[0]!)!;
    expect(g.word).toBeNull();
    expect(g.canSwap).toBe(false);
    expect(unique.viewFor(s, KEYS[1]!)!.word).toBe('pineapple');
    expect(unique.act(s, KEYS[1]!, { t: 'clue', text: '   ' }, T0)).toMatch(/one-word/);
    unique.act(s, KEYS[1]!, { t: 'clue', text: 'Fruit salad' }, T0);
    const other = unique.viewFor(s, KEYS[2]!)!;
    expect(other.myClue).toBeNull();
    expect(JSON.stringify(other)).not.toContain('Fruit');
    expect(other.players.find((p) => p.n === 2)!.done).toBe(true);
    expect(unique.viewFor(s, KEYS[1]!)!.myClue).toBe('Fruit');
    // The guesser cannot write a clue.
    unique.act(s, KEYS[0]!, { t: 'clue', text: 'cheat' }, T0);
    expect(s.clues[1]).toBeUndefined();
  });

  it('cancels matching clues: the guesser sees only the survivors, the others see why', () => {
    const s = room();
    s.word = 'pineapple';
    unique.act(s, KEYS[1]!, { t: 'clue', text: 'fruit' }, T0);
    unique.act(s, KEYS[2]!, { t: 'clue', text: 'Fruits' }, T0);
    expect(s.phase).toBe('write');
    unique.act(s, KEYS[3]!, { t: 'clue', text: 'spiky' }, T0);
    expect(s.phase).toBe('guess');
    const g = unique.viewFor(s, KEYS[0]!)!;
    expect(g.clues).toEqual([{ n: 4, clue: 'spiky', out: null }]);
    // The guesser is told how many clues cancelled out (not what they were).
    expect(g.cancelled).toEqual({ twins: 2, other: 0 });
    expect(g.word).toBeNull();
    expect(JSON.stringify(g)).not.toMatch(/pineapple|fruit/i);
    const o = unique.viewFor(s, KEYS[1]!)!;
    expect(o.clues!.map((c) => c.out)).toEqual(['twin', 'twin', null]);
    // Only the guesser guesses.
    unique.act(s, KEYS[1]!, { t: 'guess', text: 'pineapple' }, T0);
    expect(s.phase).toBe('guess');
    unique.act(s, KEYS[0]!, { t: 'guess', text: 'Pineapples' }, T0);
    expect(s.phase).toBe('verdict');
    expect(s.outcome).toBe('right');
    expect(unique.viewFor(s, KEYS[0]!)!.word).toBe('pineapple');
    expect(s.score).toBe(1);
    expect(s.cardsLeft).toBe(12);
  });

  it('scores right / pass / wrong against the 13-card deck and passes the guesser role round', () => {
    const s = room(3);
    const play = (outcome: 'right' | 'pass' | 'wrong'): void => {
      unique.act(s, KEYS[0]!, { t: 'next' }, T0); // host: check the clues now
      const key = s.seats.find((x) => x.n === s.guesser)!.key;
      if (outcome === 'pass') unique.act(s, key, { t: 'pass' }, T0);
      else unique.act(s, key, { t: 'guess', text: outcome === 'right' ? s.word : 'zzzzzz' }, T0);
      unique.act(s, KEYS[0]!, { t: 'next' }, T0); // host: next card
    };
    const guessers: number[] = [s.guesser];
    play('right');
    guessers.push(s.guesser);
    play('wrong');
    guessers.push(s.guesser);
    play('pass');
    expect(guessers).toEqual([1, 2, 3]);
    expect(s.score).toBe(1);
    expect(s.cardsLeft).toBe(13 - 1 - 2 - 1);
    expect(s.history.map((h) => h.outcome)).toEqual(['right', 'wrong', 'pass']);
  });

  it('lets clue givers swap an unknown word only before the first clue is in', () => {
    const s = room();
    unique.act(s, KEYS[1]!, { t: 'swap' }, T0);
    unique.act(s, KEYS[1]!, { t: 'clue', text: 'hint' }, T0);
    expect(unique.act(s, KEYS[2]!, { t: 'swap' }, T0)).toMatch(/Too late/);
    expect(unique.viewFor(s, KEYS[2]!)!.canSwap).toBe(false);
  });

  it('plays the whole deck on timers alone, and every player shares the score', () => {
    const s = room();
    runClock(s, unique.tick, (x) => x.phase === 'result');
    expect(s.phase).toBe('result');
    expect(s.history).toHaveLength(13);
    expect(s.history.every((h) => h.outcome === 'pass')).toBe(true);
    const t = room(3);
    t.word = 'apple';
    unique.act(t, KEYS[1]!, { t: 'clue', text: 'red' }, T0);
    unique.act(t, KEYS[2]!, { t: 'clue', text: 'tree' }, T0);
    unique.act(t, KEYS[0]!, { t: 'guess', text: 'apple' }, T0);
    runClock(t, unique.tick, (x) => x.phase === 'result');
    expect(t.score).toBe(1);
    expect(t.seats.map((x) => x.score)).toEqual([1, 1, 1]);
  });

  it('brings mid-game joiners in as clue givers and goes back to the lobby when too few are left', () => {
    const s = room(3);
    unique.join(s, KEYS[3]!, 'Late', T0);
    expect(s.seats.find((x) => x.n === 4)!.waiting).toBe(true);
    unique.act(s, KEYS[0]!, { t: 'next' }, T0);
    unique.act(s, KEYS[0]!, { t: 'pass' }, T0);
    unique.act(s, KEYS[0]!, { t: 'next' }, T0);
    expect(s.playing).toContain(4);
    expect(unique.viewFor(s, KEYS[3]!)!.word).toBe(s.word);
    unique.leave(s, KEYS[1]!, T0);
    unique.leave(s, KEYS[2]!, T0);
    unique.leave(s, KEYS[3]!, T0);
    expect(s.phase).toBe('lobby');
  });
});

describe('Dial It In room', () => {
  const room = (players: number, teams = false) => {
    const s = dial.newRoom('ABCDE', T0, 5);
    KEYS.slice(0, players).forEach((k, i) => dial.join(s, k, `P${i + 1}`, T0));
    dial.act(s, KEYS[0]!, { t: 'settings', settings: { teams } }, T0);
    dial.act(s, KEYS[0]!, { t: 'start' }, T0);
    return s;
  };

  it('shows the target on the reader’s phone only, until the reveal', () => {
    const s = room(3);
    expect(s.phase).toBe('clue');
    expect(s.round!.reader).toBe(1);
    expect(dial.viewFor(s, KEYS[0]!)!.round!.target).toBe(s.round!.target);
    expect(dial.viewFor(s, KEYS[1]!)!.round!.target).toBeNull();
    dial.act(s, KEYS[1]!, { t: 'clue', text: 'not mine' }, T0);
    expect(s.phase).toBe('clue');
    expect(dial.act(s, KEYS[0]!, { t: 'clue', text: '  ' }, T0)).toMatch(/clue/);
    dial.act(s, KEYS[0]!, { t: 'clue', text: '  a   cup of  tea ' }, T0);
    expect(s.phase).toBe('guess');
    expect(s.round!.clue).toBe('a cup of tea');
    expect(dial.viewFor(s, KEYS[2]!)!.round!.target).toBeNull();
  });

  it('shares one needle: the last move wins, the reader cannot touch it, the captain locks it in', () => {
    const s = room(3);
    dial.act(s, KEYS[0]!, { t: 'clue', text: 'tea' }, T0);
    dial.act(s, KEYS[1]!, { t: 'needle', at: 30 }, T0);
    dial.act(s, KEYS[2]!, { t: 'needle', at: 71.6 }, T0);
    dial.act(s, KEYS[0]!, { t: 'needle', at: 5 }, T0);
    dial.act(s, KEYS[2]!, { t: 'needle', at: Number.NaN }, T0);
    expect(s.round!.needle).toBe(72);
    expect(s.round!.movedBy).toBe(3);
    const v = dial.viewFor(s, KEYS[1]!)!;
    expect(v.round!.captain).toBe(2);
    expect(dial.act(s, KEYS[2]!, { t: 'lock' }, T0)).toMatch(/captain/);
    s.round!.needle = s.round!.target;
    dial.act(s, KEYS[1]!, { t: 'lock' }, T0);
    expect(s.phase).toBe('reveal');
    expect(s.round!.points).toBe(4);
    expect(dial.viewFor(s, KEYS[2]!)!.round!.target).toBe(s.round!.target);
    expect(s.points[1]).toBe(4);
    expect(s.seats.find((x) => x.n === 1)!.score).toBe(4);
  });

  it('plays teams: only the reader’s team turns the needle, and the rival captain calls the steal', () => {
    const s = room(4, true);
    expect(s.sides).toEqual([
      [1, 3],
      [2, 4],
    ]);
    dial.act(s, KEYS[0]!, { t: 'clue', text: 'tea' }, T0);
    expect(dial.viewFor(s, KEYS[1]!)!.round!.guessers).toEqual([3]);
    dial.act(s, KEYS[1]!, { t: 'needle', at: 10 }, T0);
    expect(s.round!.movedBy).toBeNull();
    s.round!.target = 60;
    dial.act(s, KEYS[2]!, { t: 'needle', at: 20 }, T0);
    dial.act(s, KEYS[2]!, { t: 'lock' }, T0);
    expect(s.phase).toBe('steal');
    expect(dial.viewFor(s, KEYS[3]!)!.round!.rivalCaptain).toBe(2);
    expect(dial.act(s, KEYS[3]!, { t: 'call', side: 'right' }, T0)).toMatch(/captain/);
    dial.act(s, KEYS[1]!, { t: 'call', side: 'right' }, T0);
    expect(s.phase).toBe('reveal');
    expect(s.round!.steal).toBe(true);
    expect(s.team).toEqual([dialPoints(60, 20), 1]);
    // Next round the other team reads, and a bullseye can't be stolen.
    dial.act(s, KEYS[0]!, { t: 'next' }, T0);
    expect(s.round!.reader).toBe(2);
    dial.act(s, KEYS[1]!, { t: 'clue', text: 'x' }, T0);
    s.round!.needle = s.round!.target;
    dial.act(s, KEYS[3]!, { t: 'lock' }, T0);
    dial.act(s, KEYS[2]!, { t: 'call', side: 'left' }, T0);
    expect(s.round!.steal).toBe(false);
    expect(s.team[1]).toBe(1 + 4);
  });

  it('plays two teams only with enough players, and a whole game on timers alone', () => {
    expect(dial.teamsOn(room(3, true))).toBe(false);
    const s = room(4, true);
    runClock(s, dial.tick, (x) => x.phase === 'result');
    expect(s.phase).toBe('result');
    expect(s.count).toBe(s.total);
    expect(s.team).toEqual([0, 0]);
  });

  it('goes back to the lobby when too few are left, and skips a reader who has gone', () => {
    const s = room(3);
    dial.leave(s, KEYS[0]!, T0);
    expect(s.host).toBe(2);
    dial.act(s, KEYS[1]!, { t: 'next' }, T0);
    expect(s.phase).toBe('reveal');
    expect(s.round!.points).toBe(0);
    dial.act(s, KEYS[1]!, { t: 'next' }, T0);
    expect(s.round!.reader).toBe(2);
    dial.leave(s, KEYS[2]!, T0);
    expect(s.phase).toBe('lobby');
  });
});

describe('Hue Knew? room', () => {
  const room = (players = 3, second = true) => {
    const s = hues.newRoom('ABCDE', T0, 8);
    KEYS.slice(0, players).forEach((k, i) => hues.join(s, k, `P${i + 1}`, T0));
    hues.act(s, KEYS[0]!, { t: 'settings', settings: { second } }, T0);
    hues.act(s, KEYS[0]!, { t: 'start' }, T0);
    return s;
  };

  it('lets only the cue giver pick from their four colours, and keeps the colour on their phone', () => {
    const s = room();
    const r = s.round!;
    expect(r.cue).toBe(1);
    expect(r.offer).toHaveLength(4);
    expect(hues.viewFor(s, KEYS[1]!)!.round!.offer).toBeNull();
    expect(hues.act(s, KEYS[0]!, { t: 'clue', text: 'ketchup' }, T0)).toMatch(/colour first/);
    const notOffered = [...Array(180).keys()].find((i) => !r.offer.includes(i))!;
    hues.act(s, KEYS[0]!, { t: 'pick', cell: notOffered }, T0);
    expect(r.target).toBeNull();
    hues.act(s, KEYS[1]!, { t: 'pick', cell: r.offer[0]! }, T0);
    expect(r.target).toBeNull();
    hues.act(s, KEYS[0]!, { t: 'pick', cell: r.offer[2]! }, T0);
    expect(hues.viewFor(s, KEYS[0]!)!.round!.target).toBe(r.offer[2]);
    expect(hues.viewFor(s, KEYS[1]!)!.round!.target).toBeNull();
    hues.act(s, KEYS[0]!, { t: 'clue', text: 'tomato sauce' }, T0);
    expect(r.clue).toBe('tomato');
    expect(s.phase).toBe('guess');
  });

  it('hides guesses until everyone has placed one, then scores both clues by how alike the colours look', () => {
    const s = room(3);
    const r = s.round!;
    hues.act(s, KEYS[0]!, { t: 'pick', cell: r.offer[0]! }, T0);
    hues.act(s, KEYS[0]!, { t: 'clue', text: 'sky' }, T0);
    const target = r.target!;
    const far = [...Array(180).keys()].find((i) => huePoints(target, i) === 0)!;
    hues.act(s, KEYS[1]!, { t: 'mark', cell: far }, T0);
    hues.act(s, KEYS[0]!, { t: 'mark', cell: target }, T0); // the cue giver can't guess
    hues.act(s, KEYS[1]!, { t: 'mark', cell: target }, T0); // changed their mind
    const other = hues.viewFor(s, KEYS[2]!)!;
    expect(other.round!.marks).toBeNull();
    expect(other.round!.myMark).toBeNull();
    expect(other.players.find((p) => p.n === 2)!.done).toBe(true);
    expect(hues.viewFor(s, KEYS[1]!)!.round!.myMark).toBe(target);
    expect(hues.viewFor(s, KEYS[0]!)!.round!.marks).toBeNull();
    hues.act(s, KEYS[2]!, { t: 'mark', cell: far }, T0);
    expect(s.phase).toBe('clue2');
    expect(hues.viewFor(s, KEYS[2]!)!.round!.marks).toEqual({ 2: target, 3: far });
    expect(hues.viewFor(s, KEYS[2]!)!.round!.target).toBeNull();
    hues.act(s, KEYS[0]!, { t: 'clue', text: 'clear summer day' }, T0);
    expect(r.clue2).toBe('clear summer');
    expect(s.phase).toBe('guess');
    expect(r.pass).toBe(2);
    hues.act(s, KEYS[1]!, { t: 'mark', cell: target }, T0);
    expect(hues.viewFor(s, KEYS[2]!)!.round!.marks2).toBeNull();
    hues.act(s, KEYS[2]!, { t: 'mark', cell: target }, T0);
    expect(s.phase).toBe('reveal');
    // Guesser 2: 3 + 3; guesser 3: 0 + 3; cue giver: one point per close guess (three of them).
    expect(r.gained).toEqual({ 1: 3, 2: 6, 3: 3 });
    expect(s.seats.map((x) => x.score)).toEqual([3, 6, 3]);
    expect(hues.viewFor(s, KEYS[1]!)!.round!.target).toBe(target);
  });

  it('skips the second clue when the cue giver says so, or when it is switched off', () => {
    const s = room(3);
    hues.act(s, KEYS[0]!, { t: 'pick', cell: s.round!.offer[1]! }, T0);
    hues.act(s, KEYS[0]!, { t: 'clue', text: 'grass' }, T0);
    hues.act(s, KEYS[1]!, { t: 'mark', cell: 0 }, T0);
    hues.act(s, KEYS[2]!, { t: 'mark', cell: 1 }, T0);
    hues.act(s, KEYS[0]!, { t: 'done' }, T0);
    expect(s.phase).toBe('reveal');
    const t = room(2, false);
    hues.act(t, KEYS[0]!, { t: 'pick', cell: t.round!.offer[0]! }, T0);
    hues.act(t, KEYS[0]!, { t: 'clue', text: 'grass' }, T0);
    hues.act(t, KEYS[1]!, { t: 'mark', cell: 5 }, T0);
    expect(t.phase).toBe('reveal');
  });

  it('plays a whole game on timers alone and passes the cue round the table', () => {
    const s = room(3);
    const cues: number[] = [];
    let now = T0;
    for (let i = 0; i < 200 && s.phase !== 'result'; i++) {
      if (s.phase === 'pick' && !cues.includes(s.round!.cue)) cues.push(s.round!.cue);
      now = Math.max(now, s.deadline!) + 1;
      hues.tick(s, now);
    }
    expect(s.phase).toBe('result');
    expect(cues).toEqual([1, 2, 3]);
    expect(s.count).toBe(3);
  });

  it('goes back to the lobby when too few are left', () => {
    const s = room(2);
    hues.leave(s, KEYS[1]!, T0);
    expect(s.phase).toBe('lobby');
  });
});
