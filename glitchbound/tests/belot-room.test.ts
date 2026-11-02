import { describe, expect, it } from 'vitest';
import { ENGINES } from '../rooms/engines';
import { applyCall, dealSeed, legalCalls, legalCards, newDeal, newMatch, type Deal, type Seat } from '../src/games/belot/logic';
import { act, AWAY_MS, BID_MS, BOT_MS, DEAL_MS, join, leave, maskDeal, newRoom, SHEET_MS, THROWN_MS, tick, TURN_MS, viewFor, type State } from '../src/games/belot/room';

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
    expect(maskDeal(fake, 0).declared[1]![0]).toEqual({ kind: 'tierce', points: 20, rank: 0, suit: null, cards: [] });
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
          expect(act(s, KEYS[0]!, { t: 'play', card: bad, declare: true }, ++t)).toBe('card');
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
    // taking a computer player's place sends the computer away
    act(s, KEYS[0]!, { t: 'sit', place: 0 }, 2);
    expect(s.places[0]).toBe(1);
    expect(s.bots[0]).toBeNull();
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

  it('no view lets newDeal rebuild another hand: the seed never leaves the room', () => {
    for (const seed of [3, 77, 1234567]) {
      const s = newRoom('ABCDE', 0, seed);
      join(s, KEYS[0]!, 'Ana', 1);
      join(s, KEYS[1]!, 'Bo', 2);
      act(s, KEYS[0]!, { t: 'start' }, 3);
      for (const [i, key] of [KEYS[0]!, KEYS[1]!].entries()) {
        const v = viewFor(s, key)!;
        const m = v.match!;
        const you = v.you;
        expect(m.seed).toBe(0);
        expect(JSON.stringify(v)).not.toContain(String(s.match!.seed));
        // every number in the view tried as a seed: none deals the hands this phone must not see
        const nums = new Set<number>();
        JSON.stringify(v, (_k, x: unknown) => (typeof x === 'number' && nums.add(x), x));
        const others = [0, 1, 2, 3].filter((p) => p !== you).map((p) => [...s.match!.deal.hands[p]!].sort().join());
        for (const n of nums)
          for (const dealer of [0, 1, 2, 3] as Seat[]) {
            const d = newDeal(dealSeed(n, m.dealNo), dealer);
            for (const h of d.hands) expect(others).not.toContain([...h].sort().join());
          }
        expect(i >= 0).toBe(true);
      }
    }
  });

  it('a player still at the table who does not move is played for when the turn clock runs out', () => {
    const s = newRoom('ABCDE', 0, 51);
    join(s, KEYS[0]!, 'Ana', 1);
    join(s, KEYS[1]!, 'Bo', 2);
    act(s, KEYS[0]!, { t: 'start' }, 3);
    run(s, 4, (x) => x.match!.deal.phase === 'bidding' && [0, 2].includes(x.match!.deal.turn));
    const before = s.match!.deal.calls.length;
    const t = s.turnSince!;
    expect(s.deadline).toBe(t + BID_MS);
    expect(viewFor(s, KEYS[0]!)!.deadline).toBe(t + BID_MS);
    // other actions do not restart the clock
    act(s, KEYS[1]!, { t: 'stand' }, t + 1000);
    expect(s.deadline).toBe(t + BID_MS);
    tick(s, t + BID_MS - 1);
    expect(s.match!.deal.calls.length).toBe(before);
    tick(s, t + BID_MS);
    expect(s.match!.deal.calls.length === before + 1 || s.match!.deal.phase !== 'bidding' || s.match!.dealNo > 0).toBe(true);
    expect(TURN_MS).toBeLessThan(BID_MS);
  });

  it('a thrown-in deal stays on the table with the fourth pass before it is dealt again', () => {
    const s = newRoom('ABCDE', 0, 61);
    join(s, KEYS[0]!, 'Ana', 1);
    act(s, KEYS[0]!, { t: 'start' }, 2);
    // dealer at place 0: Ana calls fourth; three passes before her
    const m = newMatch(5, 0);
    let d = m.deal;
    for (let i = 0; i < 3; i++) d = applyCall(d, { k: 'pass' });
    expect(d.turn).toBe(0);
    s.match = { ...m, deal: d };
    const at = 10;
    expect(act(s, KEYS[0]!, { t: 'call', call: { k: 'pass' } }, at)).toBeNull();
    expect(s.match!.deal.phase).toBe('thrown');
    expect(viewFor(s, KEYS[0]!)!.match!.deal.calls).toHaveLength(4);
    tick(s, at + THROWN_MS - 1);
    expect(s.match!.dealNo).toBe(0);
    tick(s, at + THROWN_MS);
    expect(s.match!.dealNo).toBe(1);
    expect(s.match!.deal.phase).toBe('bidding');
  });

  it('between matches places change hands; the host stays with a seated player; watchers do not move the sheet', () => {
    const s = newRoom('ABCDE', 0, 71);
    join(s, KEYS[0]!, 'Ana', 1);
    join(s, KEYS[1]!, 'Bo', 2);
    act(s, KEYS[0]!, { t: 'start' }, 3);
    // a friend arrives mid-match: watches, cannot sit yet
    join(s, KEYS[2]!, 'Cy', 4);
    expect(viewFor(s, KEYS[2]!)!.you).toBe(-1);
    act(s, KEYS[2]!, { t: 'sit', place: 1 }, 5);
    expect(s.places[1]).toBeNull();
    // the seated players drop: the host goes to nobody at the table, never to the watcher
    leave(s, KEYS[0]!, 6);
    leave(s, KEYS[1]!, 6);
    expect(s.host).not.toBe(3);
    expect([1, 2]).toContain(s.host);
    join(s, KEYS[1]!, 'Bo', 7);
    expect(s.host).toBe(2);
    if (s.phase === 'deal') {
      run(s, 8, (x) => x.phase === 'dealEnd');
      act(s, KEYS[2]!, { t: 'next' }, s.updated + 1);
      expect(s.ready).not.toContain(3);
    }
    // to the end of the match
    leave(s, KEYS[1]!, 9);
    run(s, 10, (x) => x.phase === 'over', 8000);
    expect(s.phase).toBe('over');
    join(s, KEYS[1]!, 'Bo', 20_000_000);
    // the watcher takes a computer player's place, then the place of Ana who left
    expect(act(s, KEYS[2]!, { t: 'sit', place: 1 }, 20_000_001)).toBeNull();
    expect(s.places[1]).toBe(3);
    expect(s.bots[1]).toBeNull();
    expect(act(s, KEYS[2]!, { t: 'sit', place: 0 }, 20_000_002)).toBeNull();
    expect(s.places[0]).toBe(3);
    // Bo is here: his place is taken
    expect(act(s, KEYS[2]!, { t: 'sit', place: 2 }, 20_000_003)).toBe('taken');
    // the host (Bo) starts the next match: the free place gets a computer player
    expect(s.host).toBe(2);
    act(s, KEYS[1]!, { t: 'again' }, 20_000_004);
    expect(s.phase).toBe('deal');
    expect(s.matches).toBe(2);
    expect(s.places).toEqual([3, null, 2, null]);
    expect(s.bots[1]).not.toBeNull();
    expect(viewFor(s, KEYS[2]!)!.you).toBe(0);
  }, 60_000);
});
