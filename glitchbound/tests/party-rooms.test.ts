import { describe, expect, it } from 'vitest';
import { onRequestGet as invite } from '../functions/r/[code]';
import { ENGINES, engineFor, isGameId } from '../rooms/engines';
import type { Env } from '../server/http';
import * as auction from '../src/party/rooms/auctionRoom';
import * as board from '../src/party/rooms/boardRoom';
import * as nhie from '../src/party/rooms/nhieRoom';
import * as rps from '../src/party/rooms/rpsRoom';

const KEYS = ['aaaaaaaaaaaaaaaa1', 'bbbbbbbbbbbbbbbb2', 'cccccccccccccccc3', 'dddddddddddddddd4'];
const T0 = 1_800_000_000_000;

/** Runs a room's timers forward until nothing is scheduled (or a step limit). */
function runClock<S extends { deadline: number | null }>(s: S, tick: (s: S, now: number) => void, until: (s: S) => boolean, max = 5000): number {
  let now = T0;
  for (let i = 0; i < max && !until(s) && s.deadline !== null; i++) {
    now = Math.max(now, s.deadline) + 1;
    tick(s, now);
  }
  return now;
}

describe('room engines registry', () => {
  it('knows every room game and falls back to Crass Act for old rooms', () => {
    for (const g of ['crass-act', 'impostor', 'nhie', 'auction', 'board', 'rps', 'dial', 'unique', 'hues']) expect(isGameId(g)).toBe(true);
    expect(isGameId('toString')).toBe(false);
    expect(engineFor({ game: 'nhie', updated: 0, deadline: null })).toBe(ENGINES.nhie);
    expect(engineFor({ updated: 0, deadline: null })).toBe(ENGINES['crass-act']);
  });
});

describe('Never Have I Ever room', () => {
  const room = (players = 3) => {
    const s = nhie.newRoom('ABCDE', T0, 42);
    KEYS.slice(0, players).forEach((k, i) => nhie.join(s, k, `P${i + 1}`, T0));
    return s;
  };

  it('keeps answers secret until the reveal, then fingers go down together', () => {
    const s = room();
    expect(nhie.act(s, KEYS[1]!, { t: 'start' }, T0)).toMatch(/host/);
    expect(nhie.act(s, KEYS[0]!, { t: 'start' }, T0)).toBeNull();
    expect(s.phase).toBe('answer');
    nhie.act(s, KEYS[0]!, { t: 'answer', have: true }, T0);
    nhie.act(s, KEYS[1]!, { t: 'answer', have: false }, T0);
    const other = nhie.viewFor(s, KEYS[2]!)!;
    expect(other.haves).toBeNull();
    expect(other.myAnswer).toBeNull();
    expect(JSON.stringify(other)).not.toContain(KEYS[0]!);
    expect(other.players.filter((p) => p.done).length).toBe(2);
    nhie.act(s, KEYS[2]!, { t: 'answer', have: true }, T0);
    expect(s.phase).toBe('reveal');
    const v = nhie.viewFor(s, KEYS[1]!)!;
    expect(v.haves).toEqual([1, 3]);
    expect(v.fingers).toEqual({ 1: 4, 2: 5, 3: 4 });
  });

  it('moves on by itself and ends with the last one standing', () => {
    const s = room();
    nhie.act(s, KEYS[0]!, { t: 'settings', settings: { fingers: 3, length: 60 } }, T0);
    nhie.act(s, KEYS[0]!, { t: 'start' }, T0);
    // Players 1 and 2 have done everything; player 3 nothing (no answer counts as never).
    let now = T0;
    while (s.phase !== 'result' && now < T0 + 3_600_000) {
      if (s.phase === 'answer') {
        nhie.act(s, KEYS[0]!, { t: 'answer', have: true }, now);
        nhie.act(s, KEYS[1]!, { t: 'answer', have: true }, now);
      }
      now = Math.max(now, s.deadline ?? now) + 1;
      nhie.tick(s, now);
    }
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([3]);
    expect(s.seats.find((x) => x.n === 3)!.score).toBe(1);
    expect(nhie.viewFor(s, KEYS[0]!)!.result!.have).toEqual({ 1: 3, 2: 3 });
  });

  it('never deals adult statements unless the host confirmed 18+', () => {
    const s = room();
    nhie.act(s, KEYS[0]!, { t: 'settings', settings: { categories: ['adults'] } }, T0);
    expect(s.settings.categories).not.toContain('adults');
    nhie.act(s, KEYS[0]!, { t: 'settings', settings: { adult: true, categories: ['adults'] } }, T0);
    expect(s.settings.categories).toEqual(['adults']);
  });

  it('hands the host role over and returns to the lobby when too few are left', () => {
    const s = room();
    nhie.act(s, KEYS[0]!, { t: 'start' }, T0);
    nhie.leave(s, KEYS[0]!, T0);
    expect(s.host).toBe(2);
    nhie.leave(s, KEYS[1]!, T0);
    expect(s.phase).toBe('lobby');
  });

  it('lets the last ones standing share the win when one statement takes them all out', () => {
    const s = room(4);
    nhie.act(s, KEYS[0]!, { t: 'settings', settings: { fingers: 3, length: 60 } }, T0);
    nhie.act(s, KEYS[0]!, { t: 'start' }, T0);
    // Player 4 says "I have" three times and is out; then players 1 to 3 go down together.
    for (let i = 0; i < 6; i++) {
      KEYS.forEach((k, j) => nhie.act(s, k, { t: 'answer', have: i < 3 ? j === 3 : j < 3 }, T0));
      nhie.tick(s, s.deadline! + 1);
    }
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([1, 2, 3]);
    expect(s.seats.find((x) => x.n === 4)!.score).toBe(0);
  });

  it('tells a player who is already out that their "I have" was just for fun', () => {
    const s = room(3);
    nhie.act(s, KEYS[0]!, { t: 'settings', settings: { fingers: 3, length: 60 } }, T0);
    nhie.act(s, KEYS[0]!, { t: 'start' }, T0);
    for (let i = 0; i < 4; i++) {
      KEYS.slice(0, 3).forEach((k, j) => nhie.act(s, k, { t: 'answer', have: j === 2 }, T0));
      expect(s.phase).toBe('reveal');
      // Their third "I have" took the last finger; the fourth was just for fun.
      expect(nhie.viewFor(s, KEYS[2]!)!.wasIn).toBe(i < 3);
      nhie.tick(s, s.deadline! + 1);
    }
  });
});

describe('room seats', () => {
  it('frees the seat and the name of someone who leaves the lobby before scoring anything', () => {
    const s = rps.newRoom('ABCDE', T0, 1);
    rps.join(s, KEYS[0]!, 'Ann', T0);
    rps.join(s, KEYS[1]!, 'Bo', T0);
    rps.leave(s, KEYS[1]!, T0);
    expect(s.seats.map((x) => x.name)).toEqual(['Ann']);
    rps.join(s, KEYS[2]!, 'Bo', T0);
    expect(s.seats.map((x) => x.name)).toEqual(['Ann', 'Bo']);
    // Someone with points keeps their seat (and their points) while away.
    s.seats[1]!.score = 2;
    rps.leave(s, KEYS[2]!, T0);
    expect(s.seats.map((x) => [x.name, x.online])).toEqual([
      ['Ann', true],
      ['Bo', false],
    ]);
  });
});

describe('Name Your Price room', () => {
  const room = (players = 3) => {
    const s = auction.newRoom('ABCDE', T0, 7);
    KEYS.slice(0, players).forEach((k, i) => auction.join(s, k, `P${i + 1}`, T0));
    auction.act(s, KEYS[0]!, { t: 'settings', settings: { rounds: 8, clock: 10 } }, T0);
    auction.act(s, KEYS[0]!, { t: 'start' }, T0);
    return s;
  };
  const activeKey = (s: auction.State): string => s.seats.find((x) => String(x.n) === s.auction!.active)!.key;

  it('only lets the player whose turn it is bid, within their budget', () => {
    const s = room();
    const a = s.auction!;
    const wrong = KEYS.find((k) => k !== activeKey(s))!;
    auction.act(s, wrong, { t: 'bid', amount: 1 }, T0);
    expect(s.auction).toBe(a);
    expect(auction.act(s, activeKey(s), { t: 'bid', amount: 999 }, T0)).toMatch(/Bid between/);
    expect(auction.act(s, activeKey(s), { t: 'bid', amount: 3 }, T0)).toBeNull();
    expect(s.auction!.bid).toBe(3);
  });

  it('passes for away players and runs a whole game to the vote and the result', () => {
    const s = room();
    auction.leave(s, KEYS[2]!, T0);
    expect(s.auction!.active).not.toBe('3');
    // Everyone else lets the clock run out: items go unsold, then the vote times out too.
    runClock(s, auction.tick, (x) => x.phase === 'result');
    expect(s.phase).toBe('result');
    for (const p of s.auction!.players) expect(p.budget).toBeGreaterThanOrEqual(0);
  });

  it('scores 3 per vote plus 1 per item', () => {
    const s = room(3);
    // Player whose turn it is buys every item they can by bidding the minimum; others pass.
    let now = T0;
    for (let i = 0; i < 400 && s.phase === 'auction'; i++) {
      const a = s.auction!;
      if (a.phase === 'bidding' && a.active) {
        if (!a.leader) auction.act(s, activeKey(s), { t: 'bid', amount: a.settings.increment }, now);
        else auction.act(s, activeKey(s), { t: 'pass' }, now);
      } else auction.act(s, KEYS[0]!, { t: 'next' }, now);
      now += 10;
    }
    expect(s.phase).toBe('vote');
    auction.act(s, KEYS[0]!, { t: 'vote', seat: 2 }, now);
    auction.act(s, KEYS[1]!, { t: 'vote', seat: 1 }, now);
    expect(auction.act(s, KEYS[2]!, { t: 'vote', seat: 3 }, now)).toMatch(/someone else/);
    auction.act(s, KEYS[2]!, { t: 'vote', seat: 2 }, now);
    expect(s.phase).toBe('result');
    const items = (n: number) => s.auction!.players.find((p) => p.id === String(n))!.items.length;
    expect(s.gained[2]).toBe(6 + items(2));
    expect(s.gained[1]).toBe(3 + items(1));
    expect(s.gained[3]).toBe(items(3));
  });
});

describe('Dice Adventure room', () => {
  const room = (players = 3, seed = 3) => {
    const s = board.newRoom('ABCDE', T0, seed);
    KEYS.slice(0, players).forEach((k, i) => board.join(s, k, `P${i + 1}`, T0));
    board.act(s, KEYS[0]!, { t: 'settings', settings: { size: 'short' } }, T0);
    board.act(s, KEYS[0]!, { t: 'start' }, T0);
    return s;
  };
  const keyOf = (s: board.State, n: number): string => s.seats.find((x) => x.n === n)!.key;

  it('only the player whose turn it is rolls, and the room rolls the die', () => {
    const s = room();
    const cur = board.viewFor(s, KEYS[0]!)!.board!.current!;
    const other = s.seats.find((x) => x.n !== cur)!.key;
    board.act(s, other, { t: 'roll' }, T0);
    expect(s.rolls).toBe(0);
    board.act(s, keyOf(s, cur), { t: 'roll' }, T0);
    expect(s.rolls).toBe(1);
    expect(s.board!.lastRoll).toBeGreaterThanOrEqual(1);
    expect(s.board!.lastRoll).toBeLessThanOrEqual(6);
  });

  it('keeps the trivia answer hidden until the player picks one', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = room(2, seed);
      for (let i = 0; i < 200 && s.phase === 'play' && s.event?.kind !== 'trivia'; i++) {
        const cur = s.board!.phase === 'done' ? null : board.viewFor(s, KEYS[0]!)!.board!.current;
        if (cur === null) break;
        if (s.board!.phase === 'roll') board.act(s, keyOf(s, cur), { t: 'roll' }, T0);
        else board.tick(s, s.deadline! + 1);
      }
      if (s.event?.kind !== 'trivia') continue;
      const v = board.viewFor(s, KEYS[0]!)!;
      expect(v.event!.trivia!.right).toBeNull();
      const cur = v.board!.current!;
      board.act(s, keyOf(s, cur), { t: 'answer', i: 0 }, T0);
      expect(board.viewFor(s, KEYS[1]!)!.event!.trivia!.right).toBe(s.event!.trivia!.right);
      return;
    }
    throw new Error('no trivia tile reached');
  });

  it('plays a whole game on timers alone, with a winner and awards', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = room(3, seed);
      runClock(s, board.tick, (x) => x.phase === 'result');
      expect(s.phase).toBe('result');
      expect(s.result!.standings[0]).toBe(s.result!.winner);
      expect(s.seats.find((x) => x.n === s.result!.winner)!.score).toBe(1);
    }
  });

  it('plays for away players so the game keeps going', () => {
    const s = room(3);
    board.leave(s, KEYS[1]!, T0);
    board.leave(s, KEYS[2]!, T0);
    expect(s.phase).toBe('lobby');
    const t = room(3);
    board.leave(t, KEYS[2]!, T0);
    const cur = board.viewFor(t, KEYS[0]!)!.board!.current;
    expect(cur).not.toBe(3);
  });
});

describe('Rock Paper Scissors room', () => {
  const room = (players = 3, mode: 'knockout' | 'points' = 'knockout') => {
    const s = rps.newRoom('ABCDE', T0, 9);
    KEYS.slice(0, players).forEach((k, i) => rps.join(s, k, `P${i + 1}`, T0));
    rps.act(s, KEYS[0]!, { t: 'settings', settings: { mode, target: 3 } }, T0);
    rps.act(s, KEYS[0]!, { t: 'start' }, T0);
    return s;
  };

  it('keeps throws secret until everyone has thrown', () => {
    const s = room();
    rps.act(s, KEYS[0]!, { t: 'throw', hand: 'rock' }, T0);
    const other = rps.viewFor(s, KEYS[1]!)!;
    expect(other.myThrow).toBeNull();
    expect(other.last).toBeNull();
    expect(JSON.stringify(other)).not.toContain('rock');
    expect(other.players.find((p) => p.n === 1)!.done).toBe(true);
  });

  it('knocks out the losing hand, and a draw means throw again', () => {
    const s = room(3);
    rps.act(s, KEYS[0]!, { t: 'throw', hand: 'rock' }, T0);
    rps.act(s, KEYS[1]!, { t: 'throw', hand: 'paper' }, T0);
    rps.act(s, KEYS[2]!, { t: 'throw', hand: 'scissors' }, T0);
    expect(s.last!.draw).toBe(true);
    expect(s.alive).toEqual([1, 2, 3]);
    rps.tick(s, s.deadline! + 1);
    rps.act(s, KEYS[0]!, { t: 'throw', hand: 'rock' }, T0);
    rps.act(s, KEYS[1]!, { t: 'throw', hand: 'rock' }, T0);
    rps.act(s, KEYS[2]!, { t: 'throw', hand: 'scissors' }, T0);
    expect(s.last!.out).toEqual([3]);
    rps.tick(s, s.deadline! + 1);
    rps.act(s, KEYS[0]!, { t: 'throw', hand: 'paper' }, T0);
    rps.act(s, KEYS[1]!, { t: 'throw', hand: 'rock' }, T0);
    rps.tick(s, s.deadline! + 1);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([1]);
    expect(s.seats.find((x) => x.n === 1)!.score).toBe(1);
  });

  it('throws for slow players and always finishes, in both modes', () => {
    for (const mode of ['knockout', 'points'] as const) {
      const s = room(4, mode);
      runClock(s, rps.tick, (x) => x.phase === 'result');
      expect(s.phase).toBe('result');
      expect(s.winners.length).toBeGreaterThan(0);
    }
  });

  it('scores a point per beaten player in a points race', () => {
    const s = room(3, 'points');
    rps.act(s, KEYS[0]!, { t: 'throw', hand: 'rock' }, T0);
    rps.act(s, KEYS[1]!, { t: 'throw', hand: 'scissors' }, T0);
    rps.act(s, KEYS[2]!, { t: 'throw', hand: 'scissors' }, T0);
    expect(s.points).toEqual({ 1: 2, 2: 0, 3: 0 });
  });

  it('keeps a player whose phone drops out for a moment in the game, throwing for them', () => {
    const s = room(3);
    rps.leave(s, KEYS[2]!, T0);
    expect(s.phase).toBe('throw');
    expect(s.alive).toEqual([1, 2, 3]);
    // The two still here throw: no waiting out the clock for the one who dropped out.
    rps.act(s, KEYS[0]!, { t: 'throw', hand: 'rock' }, T0 + 1000);
    rps.act(s, KEYS[1]!, { t: 'throw', hand: 'rock' }, T0 + 1000);
    expect(s.phase).toBe('reveal');
    expect(s.auto).toEqual([3]);
    // Only their (random) hand can knock them out, not being away.
    expect(s.alive.includes(3)).toBe(!s.last!.out.includes(3));
    // Back within the grace period (a reload): the seat is theirs again.
    rps.join(s, KEYS[2]!, 'P3', T0 + 5000);
    expect(s.away).toEqual({});
    expect(rps.viewFor(s, KEYS[2]!)!.players.find((p) => p.you)!.online).toBe(true);
  });

  it('counts a player gone longer than the grace period as out, so nobody plays as a ghost', () => {
    const s = room(3);
    rps.leave(s, KEYS[2]!, T0);
    // Nobody throws; the clock is only looked at again once the grace period is over.
    const now = T0 + rps.AWAY_GRACE_MS + 1;
    rps.tick(s, now);
    expect(s.alive).not.toContain(3);
    expect(s.last!.throws[3]).toBeUndefined();
    // Coming back after that does not put them back in.
    rps.join(s, KEYS[2]!, 'P3', now);
    expect(s.alive).not.toContain(3);
  });

  it('goes back to the lobby only once a 2-player game has lost someone for good', () => {
    const s = room(2, 'points');
    rps.leave(s, KEYS[1]!, T0);
    expect(s.phase).toBe('throw');
    rps.tick(s, s.deadline! + 1);
    expect(s.phase).toBe('reveal');
    rps.tick(s, T0 + rps.AWAY_GRACE_MS + 1);
    expect(s.phase).toBe('lobby');
  });
});

describe('room invite links (/r/CODE)', () => {
  const page = '<html><head><title>GlitchBound</title></head><body></body></html>';
  const env = (rooms: Record<string, object>) =>
    ({
      DB: {},
      NR_DB: {},
      ASSETS: { fetch: async () => new Response(page) },
      ROOMS: { idFromName: (code: string) => code, get: (code: unknown) => ({ fetch: async () => (rooms[String(code)] ? Response.json(rooms[String(code)]) : new Response('{}', { status: 404 })) }) },
    }) as unknown as Env;
  const open = async (code: string, rooms: Record<string, object> = {}): Promise<{ title: string; to: string }> => {
    const html = await (await invite({ request: new Request(`https://glitchboundstudio.com/r/${code}`), env: env(rooms), params: { code } })).text();
    return { title: /<title>([^<]*)<\/title>/.exec(html)![1]!, to: /replaceState\(null, '', "([^"]*)"/.exec(html)![1]! };
  };

  it('sends each room to its own page, with who is waiting', async () => {
    expect(await open('KQTRA', { KQTRA: { game: 'nhie', host: 'Ann', players: 3 } })).toEqual({ title: 'Ann wants you in a Never Have I Ever room 🙊', to: '/party?room=KQTRA' });
    expect(await open('KQTRA', { KQTRA: { host: 'Bo', players: 3 } })).toEqual({ title: 'Bo wants you in a Crass Act room 😈', to: '/games/crass-act?room=KQTRA' });
  });

  it('never sends a closed or mistyped room to the 18+ game', async () => {
    expect(await open('KQTRA')).toEqual({ title: 'Join my party room 🎉', to: '/party?room=KQTRA' });
    expect(await open('nope!')).toEqual({ title: 'Join my party room 🎉', to: '/party' });
  });
});
