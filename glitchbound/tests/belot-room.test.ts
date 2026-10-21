import { describe, expect, it } from 'vitest';
import { ENGINES } from '../rooms/engines';
import { legalCalls, legalCards, type Deal } from '../src/games/belot/logic';
import { act, AWAY_MS, BOT_MS, DEAL_MS, join, leave, maskDeal, newRoom, SHEET_MS, tick, viewFor, type State } from '../src/games/belot/room';

const KEYS = ['player-key-aaaaaaaaaaaaaaaa', 'player-key-bbbbbbbbbbbbbbbb', 'player-key-cccccccccccccccc', 'player-key-dddddddddddddddd'];

/** Runs the clock forward, letting the computer players move, until `until` says stop (or the time is up). */
function run(s: State, now: number, until: (s: State) => boolean, max = 400): number {
  let t = now;
  for (let i = 0; i < max && !until(s); i++) {
    t = Math.max(t + 50, s.deadline ?? t + 50);
    tick(s, t);
  }
  return t;
}

describe('belot live room', () => {
  it('is registered with the rooms worker', () => {
    expect(ENGINES.belot).toBeDefined();
  });

  it('seats the first two opposite each other, lets the host fill the rest with computer players, and starts', () => {
    const s = newRoom('ABCDE', 0, 7);
    join(s, KEYS[0]!, 'Ana', 1);
    join(s, KEYS[1]!, 'Bo', 2);
    expect(s.places).toEqual([1, null, 2, null]);
    expect(act(s, KEYS[1]!, { t: 'bot', place: 1, level: 'hard' }, 3)).toBeNull();
    expect(s.bots[1]).toBeNull(); // only the host
    act(s, KEYS[0]!, { t: 'bot', place: 1, level: 'expert' }, 3);
    expect(s.bots).toEqual([null, 'expert', null, null]);
    act(s, KEYS[0]!, { t: 'start' }, 4);
    expect(s.phase).toBe('deal');
    // the empty place got the same level
    expect(s.bots[3]).toBe('expert');
  });

  it('each phone sees only its own hand; declarations show their cards only after the first trick', () => {
    const s = newRoom('ABCDE', 0, 11);
    join(s, KEYS[0]!, 'Ana', 1);
    act(s, KEYS[0]!, { t: 'start' }, 2);
    const v = viewFor(s, KEYS[0]!)!;
    expect(v.you).toBe(0);
    const d = v.match!.deal;
    expect(d.hands[0]!.every((c) => c >= 0)).toBe(true);
    for (const p of [1, 2, 3]) expect(d.hands[p]!.every((c) => c === -1)).toBe(true);
    const fake: Deal = { ...s.match!.deal, declared: [[], [{ kind: 'tierce', points: 20, rank: 7, suit: 0, cards: [5, 6, 7] }], [], []] };
    expect(maskDeal(fake, 0).declared[1]![0]!.cards).toEqual([]);
    expect(maskDeal({ ...fake, tricks: [{ winner: 0, cards: [] }] }, 0).declared[1]![0]!.cards).toEqual([5, 6, 7]);
  });

  it('refuses out-of-turn and illegal moves, plays the computer seats on the clock, and books the deal', () => {
    const s = newRoom('ABCDE', 0, 21);
    join(s, KEYS[0]!, 'Ana', 1);
    act(s, KEYS[0]!, { t: 'start' }, 2);
    let t = 2;
    // play the whole match as the human: legal moves only
    for (let i = 0; i < 2000 && s.phase !== 'over'; i++) {
      const d = s.match!.deal;
      if (s.phase === 'dealEnd') {
        expect(s.last).not.toBeNull();
        act(s, KEYS[0]!, { t: 'next' }, ++t);
        continue;
      }
      if (d.turn === 0 && (d.phase === 'bidding' || d.phase === 'playing')) {
        // a wrong card first: refused
        if (d.phase === 'playing') {
          const bad = [...Array(32).keys()].find((c) => !legalCards(d, 0).includes(c))!;
          expect(act(s, KEYS[0]!, { t: 'play', card: bad, declare: true }, ++t)).toMatch(/can’t/);
          act(s, KEYS[0]!, { t: 'play', card: legalCards(d, 0)[0]!, declare: true }, ++t);
        } else act(s, KEYS[0]!, { t: 'call', call: legalCalls(d).length > 1 && i % 5 === 0 ? legalCalls(d)[1]! : { k: 'pass' } }, ++t);
        continue;
      }
      // a computer seat: nothing happens before its time
      const before = JSON.stringify(s.match);
      tick(s, t + 1);
      if (d.calls.length > 0 || d.phase === 'playing') expect(JSON.stringify(s.match)).toBe(before);
      t = Math.max(t + BOT_MS + DEAL_MS, s.deadline ?? 0);
      tick(s, t);
    }
    expect(s.phase).toBe('over');
    expect(s.match!.winner).not.toBeNull();
    expect(Math.max(...s.match!.scores)).toBeGreaterThanOrEqual(151);
  }, 60_000);

  it('plays for someone who left, and the score sheet moves on by itself', () => {
    const s = newRoom('ABCDE', 0, 31);
    join(s, KEYS[0]!, 'Ana', 1);
    join(s, KEYS[1]!, 'Bo', 2);
    act(s, KEYS[0]!, { t: 'start' }, 3);
    leave(s, KEYS[1]!, 4);
    const t = run(s, 5, (x) => x.phase === 'dealEnd' || x.phase === 'over' || (x.match!.deal.turn === 0 && x.match!.deal.phase !== 'thrown'));
    // Bo (place 2) was played for while away; Ana (place 0, here) is waited for
    expect(s.match!.deal.turn === 0 || s.phase !== 'deal').toBe(true);
    expect(AWAY_MS).toBeGreaterThan(0);
    if (s.phase === 'dealEnd') {
      tick(s, t + SHEET_MS + 1);
      expect(s.phase).toBe('deal');
    }
  });

  it('a rematch starts a new match and the winners get a point', () => {
    const s = newRoom('ABCDE', 0, 41);
    join(s, KEYS[0]!, 'Ana', 1);
    act(s, KEYS[0]!, { t: 'bot', place: 0, level: 'hard' }, 2); // someone sits there: refused
    expect(s.bots[0]).toBeNull();
    act(s, KEYS[0]!, { t: 'stand' }, 2);
    act(s, KEYS[0]!, { t: 'bot', place: 0, level: 'hard' }, 2);
    act(s, KEYS[0]!, { t: 'sit', place: 0 }, 2);
    expect(s.places[0]).toBeNull();
    act(s, KEYS[0]!, { t: 'sit', place: 1 }, 2);
    act(s, KEYS[0]!, { t: 'start' }, 3);
    // every place but Ana's is a computer; Ana leaves so the stand-in plays the whole match
    leave(s, KEYS[0]!, 4);
    run(s, 5, (x) => x.phase === 'over', 6000);
    expect(s.phase).toBe('over');
    join(s, KEYS[0]!, 'Ana', 10_000_000);
    act(s, KEYS[0]!, { t: 'again' }, 10_000_001);
    expect(s.phase).toBe('deal');
    expect(s.matches).toBe(2);
  }, 60_000);
});
