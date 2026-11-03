import { describe, expect, it } from 'vitest';
import * as auction from '../src/party/rooms/auctionRoom';

const KEYS = ['aaaaaaaaaaaaaaaa1', 'bbbbbbbbbbbbbbbb2', 'cccccccccccccccc3'];
const T0 = 1_800_000_000_000;

describe('Name Your Price room vote', () => {
  it('only takes votes for collections with something in them', () => {
    const s = auction.newRoom('ABCDE', T0, 7);
    KEYS.forEach((k, i) => auction.join(s, k, `P${i + 1}`, T0));
    auction.act(s, KEYS[0]!, { t: 'settings', settings: { rounds: 8, clock: 10 } }, T0);
    auction.act(s, KEYS[0]!, { t: 'start' }, T0);
    // Only P1 buys (the minimum bid whenever it is their turn); everyone else passes.
    let now = T0;
    for (let i = 0; i < 400 && s.phase === 'auction'; i++) {
      const a = s.auction!;
      const key = s.seats.find((x) => String(x.n) === a.active)?.key;
      if (a.phase === 'bidding' && key) auction.act(s, key, key === KEYS[0] && !a.leader ? { t: 'bid', amount: a.settings.increment } : { t: 'pass' }, now);
      else auction.act(s, KEYS[0]!, { t: 'next' }, now);
      now += 10;
    }
    expect(s.phase).toBe('vote');
    const items = (n: number) => s.auction!.players.find((p) => p.id === String(n))!.items.length;
    expect(items(1)).toBeGreaterThan(0);
    expect(items(2)).toBe(0);
    expect(auction.act(s, KEYS[2]!, { t: 'vote', seat: 2 }, now)).toMatch(/something in it/);
    // P1 has no other collection to vote for: the vote doesn't wait for them.
    expect(auction.viewFor(s, KEYS[1]!)!.players.find((p) => p.n === 1)!.done).toBe(true);
    auction.act(s, KEYS[1]!, { t: 'vote', seat: 1 }, now);
    auction.act(s, KEYS[2]!, { t: 'vote', seat: 1 }, now);
    expect(s.phase).toBe('result');
    expect(s.gained[1]).toBe(6 + items(1));
    expect(s.gained[2]).toBe(0);
  });
});
