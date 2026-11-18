/**
 * The Ring's ranked ladder (the owner, 2026-11-18: "i want to do appropriate matchmaking, ranking system so that
 * players can enjoy a competitive environment ... make sure wintrading and exploiting is prohibited"). The rules
 * (arena/ranked.ts), the ladder the server keeps (server/ring.ts, functions/api/sigilfall/ring.ts), and the rooms
 * that tell it who played (rooms/worker.ts, net/ringRoom.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as getRing, onRequestPost as postRing } from '../functions/api/sigilfall/ring';
import { match, put, reserve, type Lobby } from '../rooms/lobby';
import { Room } from '../rooms/worker';
import type { Ctx, Env } from '../server/http';
import { openBotMatch, openPeopleMatch, readStandings, reportMatch, settleDue, type RingRoster, type RosterOf, type Settled } from '../server/ring';
import { signIn } from '../server/signin';
import { seekFacts } from '../src/games/sigilfall/arena/queue';
import { BOT_CEILING, factorOf, leaversOf, MIN_BOT_WIN_MS, MIN_PEOPLE_MS, moveStanding, outcomeOf, partyApart, partyRating, peopleMatchId, repeatFactor, seasonal, SETTLE_MS, TICKET_MS, verdictOf, VOID_MS, type RankedStanding, type Seat } from '../src/games/sigilfall/arena/ranked';
import { seasonOf, SEASON_LENGTH } from '../src/games/sigilfall/arena/ranks';
import { act, join, newRoom, roster, viewFor, type Action, type State, type View } from '../src/games/sigilfall/net/ringRoom';
import { Seek } from '../src/games/sigilfall/net/ringSeek';
import type { Link } from '../src/games/sigilfall/net/link';
import { memoryD1 } from './d1';

const T0 = Date.UTC(2026, 10, 20, 12);
const ORIGIN = 'http://localhost:8788';
const st = (rating: number, extra: Partial<RankedStanding> = {}): RankedStanding => ({ rating, mmr: rating, best: rating, wins: 20, losses: 20, streak: 0, season: seasonOf(T0), ...extra });

describe('The Ring ranked: the rules', () => {
  const seat = (user: string, team: 0 | 1, report: Seat['report'], at: number | null = T0 + 90_000): Seat => ({ user, team, report, at });

  it('a match stands when every report agrees, and counts for nothing when they disagree', () => {
    expect(verdictOf([seat('a', 0, 'won'), seat('b', 1, 'lost')], T0)).toMatchObject({ result: 0 });
    expect(verdictOf([seat('a', 0, 'won'), seat('b', 1, 'won')], T0)).toMatchObject({ result: 'void', note: 'disputed' });
    expect(verdictOf([seat('a', 0, 'draw'), seat('b', 1, 'draw')], T0)).toMatchObject({ result: 'draw' });
    // (one side's word is enough when the other said nothing; a loser's "someone left" is no claim against a win)
    expect(verdictOf([seat('a', 0, 'lost'), seat('b', 1, null, null)], T0)).toMatchObject({ result: 1 });
    expect(verdictOf([seat('a', 0, 'won'), seat('b', 1, 'void')], T0)).toMatchObject({ result: 0 });
    // (a win sooner than a fight can be won isn't believed)
    expect(verdictOf([seat('a', 0, 'won', T0 + MIN_PEOPLE_MS - 1), seat('b', 1, 'lost')], T0)).toMatchObject({ result: 'void', note: 'short' });
  });

  it('whoever leaves loses, half again a loss; when the match ended for someone leaving, the silent one is the leaver', () => {
    const v = verdictOf([seat('a', 0, 'void'), seat('b', 1, 'left')], T0);
    expect(outcomeOf(seat('a', 0, 'void'), v)).toMatchObject({ kind: 'none' });
    expect(outcomeOf(seat('b', 1, 'left'), v)).toMatchObject({ kind: 'loss', k: 1.5, leaver: true });
    const quiet = verdictOf([seat('a', 0, 'void'), seat('b', 1, null, null)], T0);
    expect(outcomeOf(seat('b', 1, null, null), quiet)).toMatchObject({ kind: 'loss', leaver: true });
    // (the side that won wins, reported or not)
    const won = verdictOf([seat('a', 0, 'won'), seat('c', 0, null, null), seat('b', 1, 'lost')], T0);
    expect(outcomeOf(seat('c', 0, null, null), won)).toMatchObject({ kind: 'win' });
  });

  it('a leaver is whoever the room saw drop out before the end, whatever anyone said; leaving while the gates are up is free', () => {
    const at = (s: number): number => T0 + s * 1000;
    // b dropped out at 70 s and the match ended with a's win at 95 s: b left
    expect([...leaversOf({ b: at(70), a: at(96) }, [seat('a', 0, 'won', at(95)), seat('b', 1, 'void', at(84))], T0)]).toEqual(['b']);
    // nobody won (the match ended for a because b left): the first to drop out left, a's own leaving after it doesn't count
    expect([...leaversOf({ b: at(70), a: at(84) }, [seat('a', 0, 'void', at(83)), seat('b', 1, 'void', at(71))], T0)]).toEqual(['b']);
    // a loser closing their game as it ends is no leaver
    expect([...leaversOf({ b: at(95) }, [seat('a', 0, 'won', at(95.5)), seat('b', 1, null, null)], T0)]).toEqual([]);
    // before the gates lift: free
    expect([...leaversOf({ b: at(12) }, [seat('a', 0, 'void', at(25)), seat('b', 1, 'void', at(12))], T0)]).toEqual([]);
    const v = { ...verdictOf([seat('a', 0, 'void'), seat('b', 1, 'void')], T0), leaversKnown: true };
    expect(outcomeOf(seat('b', 1, 'void'), v, true)).toMatchObject({ kind: 'loss', leaver: true });
    expect(outcomeOf(seat('a', 0, 'void'), v, false)).toMatchObject({ kind: 'none' });
  });

  it('against win trading: friends, one network, one account on both sides, a lopsided party: nothing; the same opponent: less, then nothing', () => {
    for (const f of [{ friends: true }, { network: true }, { dupe: true }, { spread: true }]) expect(factorOf(f).factor, JSON.stringify(f)).toBe(0);
    expect([0, 1, 2, 3, 4, 9].map(repeatFactor)).toEqual([1, 1, 0.5, 0.5, 0, 0]);
    expect(factorOf({ repeats: 2 })).toEqual({ factor: 0.5, note: 'repeat' });
    expect(factorOf({})).toEqual({ factor: 1 });
  });

  it('a leaver pays in full whatever else is true; anything else is scaled', () => {
    const s = st(1500);
    const half = moveStanding(s, { kind: 'win', k: 1 }, 1500, 1500, 0.5);
    const full = moveStanding(s, { kind: 'win', k: 1 }, 1500, 1500, 1);
    expect(half.change).toBe(Math.round(full.change / 2));
    expect(moveStanding(s, { kind: 'win', k: 1 }, 1500, 1500, 0).change).toBe(0);
    expect(moveStanding(s, { kind: 'loss', k: 1.5, leaver: true }, 1500, 1500, 0).change).toBeLessThan(0);
  });

  it('the computer moves no rating from the ceiling, and a win can’t carry anyone past it', () => {
    expect(moveStanding(st(BOT_CEILING), { kind: 'win', k: 1 }, BOT_CEILING, BOT_CEILING, 1, true)).toMatchObject({ change: 0, note: 'ceiling' });
    expect(moveStanding(st(BOT_CEILING + 50), { kind: 'loss', k: 1 }, BOT_CEILING, BOT_CEILING, 1, true)).toMatchObject({ change: 0, note: 'ceiling' });
    const up = moveStanding(st(BOT_CEILING - 4), { kind: 'win', k: 1 }, BOT_CEILING, BOT_CEILING, 1, true);
    expect(up.next.rating).toBe(BOT_CEILING);
    // (people move it as ever)
    expect(moveStanding(st(BOT_CEILING), { kind: 'win', k: 1 }, BOT_CEILING, BOT_CEILING).change).toBeGreaterThan(0);
  });

  it('a party searches above its mean, and can’t queue ranked more than 500 apart', () => {
    expect(partyRating([1200, 1600])).toBe(1500);
    expect(partyApart([1200, 1600])).toBe(false);
    expect(partyApart([1100, 1700])).toBe(true);
  });

  it('a new season brings both ratings halfway back toward 1000, and keeps the best', () => {
    const next = seasonal(st(1800, { best: 1900, streak: 4 }), seasonOf(T0) + 1);
    expect(next).toMatchObject({ rating: 1400, mmr: 1400, best: 1900, streak: 0, season: seasonOf(T0) + 1 });
    expect(seasonal(null, 3)).toMatchObject({ rating: 1000, mmr: 1000, season: 3 });
  });
});

describe('The Ring ranked: the ladder the server keeps', () => {
  let env: Env;
  let db: ReturnType<typeof memoryD1>;
  const ids: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  const rosters = new Map<string, RingRoster>();
  const rosterOf: RosterOf = async (code) => rosters.get(code) ?? null;

  beforeEach(async () => {
    db = memoryD1();
    env = { DB: db, NR_DB: {} as Env['NR_DB'], ADMIN_EMAILS: '' };
    rosters.clear();
    for (const who of ['ana', 'ben', 'cy', 'dee']) {
      const s = await signIn(env, new Request(ORIGIN), { sub: `dev:${who}@example.com`, email: `${who}@example.com`, name: who, givenName: '', picture: '', provider: 'email' });
      ids[who] = s.user.id;
      cookies[who] = s.cookie.split(';')[0]!;
    }
  });

  const setStanding = (who: string, format: number, rating: number): void => {
    db.sqlite.prepare('INSERT OR REPLACE INTO ring_standings (user_id, format, season, rating, mmr, best, wins, losses, streak, updated_at) VALUES (?, ?, ?, ?, ?, ?, 20, 20, 0, 0)').run(ids[who]!, format, seasonOf(T0), rating, rating, rating);
  };
  const rating = async (who: string, format: 1 | 2 | 3 = 1, now = T0): Promise<number> => (await readStandings(env, ids[who]!, now))[format].rating;
  /** A room's run: who sat where. */
  let runs = 0;
  const room = (format: number, seats: [string, 0 | 1, { net?: string; party?: boolean }?][], ranked = true): { code: string; run: number; id: string } => {
    const code = `ROOM${String.fromCharCode(65 + (runs++ % 26))}`;
    const run = 1;
    rosters.set(code, { run, seed: 77, format, at: T0, ranked, seats: seats.map(([who, team, o], n) => ({ n: n + 1, team, uid: ids[who] ?? '', net: o?.net ?? `net-${who}`, party: !!o?.party })) });
    return { code, run, id: peopleMatchId(code, run, 77) };
  };

  it('a match against the computer: a ticket with the computer’s rating drawn by the server, settled by the report', async () => {
    const t = await openBotMatch(env, ids.ana!, 1, T0, () => 0.5);
    expect(t.rival).toBe(1000);
    expect(t.stakes.win).toBeGreaterThan(0);
    const out = (await reportMatch(env, ids.ana!, t.match, 'won', T0 + 60_000, rosterOf)) as Settled;
    expect(out.change).toBe(t.stakes.win);
    expect(await rating('ana', 1, T0 + 60_000)).toBe(1000 + t.stakes.win);
    // (a ticket is reported once: the same report again changes nothing)
    await reportMatch(env, ids.ana!, t.match, 'won', T0 + 70_000, rosterOf);
    expect(await rating('ana', 1, T0 + 70_000)).toBe(1000 + t.stakes.win);
    // (and it is on the rankings, from the server)
    const board = await getRanksBoard(env, 'ring:solo');
    expect(board).toEqual([1000 + t.stakes.win]);
  });

  it('a win reported too soon is nothing; giving up before the gates is free, after them a leaver’s loss', async () => {
    const soon = await openBotMatch(env, ids.ana!, 1, T0);
    expect(await reportMatch(env, ids.ana!, soon.match, 'won', T0 + MIN_BOT_WIN_MS - 1000, rosterOf)).toMatchObject({ change: 0, note: 'short' });
    const early = await openBotMatch(env, ids.ana!, 1, T0 + 100_000);
    expect(await reportMatch(env, ids.ana!, early.match, 'void', T0 + 100_000 + VOID_MS - 1, rosterOf)).toMatchObject({ change: 0 });
    const late = await openBotMatch(env, ids.ana!, 1, T0 + 200_000);
    const lost = (await reportMatch(env, ids.ana!, late.match, 'void', T0 + 200_000 + VOID_MS + 5000, rosterOf)) as Settled;
    expect(lost.change).toBeLessThan(-late.stakes.lose);
  });

  it('a ticket never reported is a leaver’s loss; a new one started over it settles the old one', async () => {
    const t = await openBotMatch(env, ids.ben!, 2, T0);
    await settleDue(env, ids.ben!, T0 + TICKET_MS - 1000, rosterOf);
    expect(await rating('ben', 2)).toBe(1000);
    await settleDue(env, ids.ben!, T0 + TICKET_MS + 1000, rosterOf);
    expect(await rating('ben', 2, T0 + TICKET_MS + 1000)).toBe(1000 + Math.round(-t.stakes.lose * 1.5));
    const a = await openBotMatch(env, ids.cy!, 1, T0);
    await openBotMatch(env, ids.cy!, 1, T0 + 120_000);
    expect(await rating('cy', 1, T0 + 120_000)).toBe(1000 + Math.round(-a.stakes.lose * 1.5));
  });

  it('from the ceiling the computer is worth nothing, and the ticket says so before the match', async () => {
    setStanding('dee', 1, BOT_CEILING + 40);
    const t = await openBotMatch(env, ids.dee!, 1, T0);
    expect(t).toMatchObject({ stakes: { win: 0, lose: 0 }, note: 'ceiling' });
    await reportMatch(env, ids.dee!, t.match, 'lost', T0 + 60_000, rosterOf);
    expect(await rating('dee', 1, T0 + 60_000)).toBe(BOT_CEILING + 40);
  });

  it('a match against people: settled when both agree, and both move', async () => {
    const r = room(1, [
      ['ana', 0],
      ['ben', 1],
    ]);
    const open = await openPeopleMatch(env, ids.ana!, r.code, r.run, rosterOf, T0 + 1000);
    expect(open).toMatchObject({ match: r.id, rival: 1000, ours: 1000 });
    expect(await reportMatch(env, ids.ana!, r.id, 'won', T0 + 90_000, rosterOf)).toEqual({ pending: true });
    const ben = (await reportMatch(env, ids.ben!, r.id, 'lost', T0 + 91_000, rosterOf)) as Settled;
    expect(ben.change).toBeLessThan(0);
    expect(await rating('ana', 1, T0 + 92_000)).toBeGreaterThan(1000);
    // (a report is kept once: changing your mind later changes nothing)
    await reportMatch(env, ids.ben!, r.id, 'won', T0 + 93_000, rosterOf);
    expect(await rating('ben', 1, T0 + 93_000)).toBe(1000 + ben.change);
  });

  it('when the games disagree nobody moves; a match from a room of friends is never rated; nobody outside the match can report it', async () => {
    const r = room(1, [
      ['ana', 0],
      ['ben', 1],
    ]);
    await reportMatch(env, ids.ana!, r.id, 'won', T0 + 90_000, rosterOf);
    expect(await reportMatch(env, ids.ben!, r.id, 'won', T0 + 90_500, rosterOf)).toMatchObject({ change: 0, note: 'disputed' });
    expect(await rating('ana')).toBe(1000);
    const friendly = room(
      1,
      [
        ['ana', 0],
        ['ben', 1],
      ],
      false,
    );
    expect(await openPeopleMatch(env, ids.ana!, friendly.code, friendly.run, rosterOf, T0)).toEqual({ error: 'unranked' });
    const other = room(1, [
      ['ana', 0],
      ['ben', 1],
    ]);
    expect(await reportMatch(env, ids.cy!, other.id, 'won', T0 + 90_000, rosterOf)).toEqual({ error: 'not_in_match' });
  });

  it('one report and silence: settled after a while, the silent one taking their side’s result', async () => {
    const r = room(1, [
      ['ana', 0],
      ['ben', 1],
    ]);
    await reportMatch(env, ids.ana!, r.id, 'won', T0 + 90_000, rosterOf);
    await settleDue(env, ids.ben!, T0 + 90_000 + SETTLE_MS - 1, rosterOf);
    expect(await rating('ben')).toBe(1000);
    await settleDue(env, ids.ben!, T0 + 90_000 + SETTLE_MS, rosterOf);
    expect(await rating('ben', 1, T0 + 200_000)).toBeLessThan(1000);
  });

  it('a player who quits and says someone else left still takes the leaver’s loss: the room saw who left', async () => {
    const r = room(1, [
      ['ana', 0],
      ['ben', 1],
    ]);
    // ben drops out of the room 70 s in; both games say the match ended because someone left
    rosters.get(r.code)!.left = { 2: T0 + 70_000, 1: T0 + 84_000 };
    await reportMatch(env, ids.ben!, r.id, 'void', T0 + 71_000, rosterOf);
    await reportMatch(env, ids.ana!, r.id, 'void', T0 + 83_000, rosterOf);
    expect(await rating('ana')).toBe(1000);
    expect(await rating('ben')).toBeLessThan(1000);
  });

  it('friends, or one network, on opposite sides: the match counts for nothing; the same pair over and over: less, then nothing', async () => {
    db.sqlite.prepare('INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, 0), (?, ?, 0)').run(ids.ana!, ids.ben!, ids.ben!, ids.ana!);
    const f = room(1, [
      ['ana', 0],
      ['ben', 1],
    ]);
    expect(await openPeopleMatch(env, ids.ana!, f.code, f.run, rosterOf, T0)).toMatchObject({ stakes: { win: 0, lose: 0 }, note: 'friends' });
    await reportMatch(env, ids.ana!, f.id, 'won', T0 + 90_000, rosterOf);
    expect(await reportMatch(env, ids.ben!, f.id, 'lost', T0 + 90_000, rosterOf)).toMatchObject({ change: 0, note: 'friends' });
    const n = room(1, [
      ['cy', 0, { net: 'home' }],
      ['dee', 1, { net: 'home' }],
    ]);
    await reportMatch(env, ids.cy!, n.id, 'won', T0 + 90_000, rosterOf);
    expect(await reportMatch(env, ids.dee!, n.id, 'lost', T0 + 90_000, rosterOf)).toMatchObject({ change: 0, note: 'network' });
    // cy keeps beating dee, from different networks
    const gains: number[] = [];
    for (let i = 0; i < 5; i++) {
      const at = T0 + (i + 1) * 3_600_000;
      const r = room(1, [
        ['cy', 0],
        ['dee', 1],
      ]);
      rosters.get(r.code)!.at = at;
      await openPeopleMatch(env, ids.cy!, r.code, r.run, rosterOf, at);
      await reportMatch(env, ids.dee!, r.id, 'lost', at + 90_000, rosterOf);
      gains.push(((await reportMatch(env, ids.cy!, r.id, 'won', at + 90_000, rosterOf)) as Settled).change);
    }
    expect(gains[2]).toBeLessThan(gains[1]!);
    expect(gains[2]).toBeGreaterThan(0);
    expect(gains[4]).toBe(0);
  });

  it('a party whose ratings are too far apart counts for nothing; the strangers in the match count as ever', async () => {
    setStanding('ana', 2, 1900);
    setStanding('cy', 2, 1100);
    const r = room(2, [
      ['ana', 0, { party: true }],
      ['cy', 0, { party: true }],
      ['ben', 1],
      ['dee', 1],
    ]);
    expect(await openPeopleMatch(env, ids.ana!, r.code, r.run, rosterOf, T0)).toMatchObject({ note: 'spread' });
    for (const [who, rep] of [
      ['ana', 'won'],
      ['cy', 'won'],
      ['ben', 'lost'],
      ['dee', 'lost'],
    ] as const)
      await reportMatch(env, ids[who]!, r.id, rep, T0 + 90_000, rosterOf);
    expect(await rating('ana', 2)).toBe(1900);
    expect(await rating('ben', 2)).toBeLessThan(1000);
  });

  it('two settling at once change the ladder once', async () => {
    const r = room(1, [
      ['ana', 0],
      ['ben', 1],
    ]);
    await openPeopleMatch(env, ids.ana!, r.code, r.run, rosterOf, T0);
    await Promise.all([reportMatch(env, ids.ana!, r.id, 'won', T0 + 90_000, rosterOf), reportMatch(env, ids.ben!, r.id, 'lost', T0 + 90_000, rosterOf)]);
    const one = await rating('ana');
    await settleDue(env, ids.ana!, T0 + 10 * 60_000, rosterOf);
    expect(await rating('ana')).toBe(one);
    expect(one).toBeGreaterThan(1000);
    const rows = db.sqlite.prepare('SELECT COUNT(*) AS n FROM ring_matches WHERE settled_at IS NOT NULL').get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it('a season turning brings the stored rating halfway back as it is next read', async () => {
    setStanding('ana', 3, 1600);
    expect(await rating('ana', 3, T0 + SEASON_LENGTH)).toBe(1300);
  });

  it('the way in: guests are told to sign in; a format and a report are checked', async () => {
    const call = async (body: unknown, who: string | null) => {
      const headers: Record<string, string> = { origin: ORIGIN, ...(who ? { cookie: cookies[who]! } : {}) };
      const res = body === undefined ? await getRing({ request: new Request(`${ORIGIN}/api/sigilfall/ring`, { headers }), env, params: {} } as Ctx) : await postRing({ request: new Request(`${ORIGIN}/api/sigilfall/ring`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, params: {} } as Ctx);
      return { status: res.status, data: (await res.json()) as Record<string, unknown> };
    };
    expect((await call(undefined, null)).data).toEqual({ signedIn: false });
    expect((await call({ action: 'bots', format: 1 }, null)).status).toBe(401);
    expect((await call({ action: 'bots', format: 4 }, 'ana')).status).toBe(400);
    expect((await call({ action: 'report', match: 'b-x', report: 'won' }, 'ana')).status).toBe(400);
    expect((await call({ action: 'report', match: 'b-abcdefabcdefabcd', report: 'won!' }, 'ana')).status).toBe(400);
    const t = await call({ action: 'bots', format: 2 }, 'ana');
    expect(t.status).toBe(200);
    expect(t.data.match).toMatch(/^b-/);
    const me = await call(undefined, 'ana');
    expect(me.data).toMatchObject({ signedIn: true, standings: { 1: { rating: 1000 }, 2: { rating: 1000 }, 3: { rating: 1000 } } });
  });
});

async function getRanksBoard(env: Env, board: string): Promise<number[]> {
  const { onRequestGet } = await import('../functions/api/sigilfall/ranks');
  const res = await onRequestGet({ request: new Request(`${ORIGIN}/api/sigilfall/ranks?board=${board}`), env, params: {} } as Ctx);
  return ((await res.json()) as { rows: { score: number }[] }).rows.map((r) => r.score);
}

describe('The Ring ranked: a party in the queue', () => {
  const KEY = (i: number): string => String.fromCharCode(97 + i).repeat(20);
  const PICK = { cls: 'warrior', bar: ['w-strike', 'w-rend', 'w-charge', 'w-shout'], talents: [] };
  const party = (): State => {
    const s = newRoom('PARTY', T0, 5);
    for (const i of [0, 1]) {
      expect(join(s, KEY(i), `P${i}`, T0)).toBeNull();
      expect(act(s, KEY(i), { t: 'pick', pick: { ...PICK, team: 0 } }, T0)).toBeNull();
    }
    return s;
  };

  it('only a party on one side can queue, at its rating; it holds together and leaves the queue as its match begins', () => {
    const s = party();
    expect(act(s, KEY(1), { t: 'queue', on: true, rating: 1400 }, T0)).toBe('not_host');
    expect(act(s, KEY(0), { t: 'queue', on: true, rating: 1400 }, T0)).toBeNull();
    expect(s.queue).toMatchObject({ kind: '2', mmr: 1400 });
    expect(viewFor(s, KEY(1))).toMatchObject({ queued: T0, party: [1, 2] });
    // (a party member can't cross over, nor the format change, while it waits)
    expect(act(s, KEY(1), { t: 'pick', pick: { ...PICK, team: 1 } }, T0)).toBe('queued');
    expect(act(s, KEY(0), { t: 'setup', format: 3, map: 'sands' }, T0)).toBe('queued');
    // a stranger quick match sent joins, and is put on the other side: the party's seats never move
    expect(join(s, KEY(2), 'P2', T0)).toBeNull();
    const f = seekFacts(viewFor(s, KEY(1))!, 2);
    expect(f.side).toBe(0);
    expect(seekFacts(viewFor(s, KEY(2))!, 2).side).toBe(1);
    act(s, KEY(2), { t: 'pick', pick: { ...PICK, team: 1 } }, T0);
    expect(act(s, KEY(0), { t: 'start' }, T0)).toBeNull();
    expect(s).toMatchObject({ queue: null, ranked: true });
    expect(roster(s).map((x) => [x.n, x.team, x.party])).toEqual([
      [1, 0, true],
      [2, 0, true],
      [3, 1, false],
    ]);
  });

  it('a room of friends with both sides filled is a custom game: it can’t go into the ranked queue', () => {
    const s = party();
    expect(join(s, KEY(2), 'P2', T0)).toBeNull();
    act(s, KEY(2), { t: 'pick', pick: { ...PICK, team: 1 } }, T0);
    expect(act(s, KEY(0), { t: 'queue', on: true, rating: 1400 }, T0)).toBe('not_a_party');
    expect(s.queue ?? null).toBeNull();
  });

  it('a party member leaving takes the party out of the queue', () => {
    const s = party();
    act(s, KEY(0), { t: 'queue', on: true, rating: 1400 }, T0);
    act(s, KEY(1), { t: 'bye' }, T0);
    expect(s.queue).toBeNull();
  });

  it('a party’s search: the leader queues its room, the others wait in it, a stranger fills it, and the match begins for all of them', () => {
    vi.useFakeTimers();
    try {
      const s = party();
      const link = (i: number): Link<View, Action> => ({ code: 'PARTY', open: true, get view() { return viewFor(s, KEY(i)); }, send: (a: Action) => void act(s, KEY(i), a, Date.now()), close: () => undefined }) as unknown as Link<View, Action>;
      const runs: number[] = [];
      const h = (i: number) => ({ onLook: () => undefined, onRun: () => void runs.push(i), onBots: () => runs.push(-1), onRelay: () => undefined, onGone: () => undefined, onCancel: () => undefined });
      const lead = new Seek({ format: 2, map: 'sands', name: 'P0', pick: PICK, party: link(0), rating: 1400 }, h(0));
      vi.advanceTimersByTime(300);
      expect(s.queue).toMatchObject({ kind: '2', mmr: 1400 });
      const member = new Seek({ format: 2, map: 'sands', name: 'P1', pick: PICK, party: link(1) }, h(1));
      // a stranger quick match sent sits down across from them
      expect(join(s, KEY(2), 'P2', Date.now())).toBeNull();
      act(s, KEY(2), { t: 'pick', pick: { ...PICK, team: 1 } }, Date.now());
      vi.advanceTimersByTime(10_500);
      expect(s.phase).toBe('run');
      vi.advanceTimersByTime(500);
      expect(runs.sort()).toEqual([0, 1]);
      lead.stop();
      member.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a party the queue won’t take (people on both sides) gives up its search, and says why', () => {
    vi.useFakeTimers();
    try {
      const s = party();
      expect(join(s, KEY(2), 'P2', Date.now())).toBeNull();
      act(s, KEY(2), { t: 'pick', pick: { ...PICK, team: 1 } }, Date.now());
      const link = { code: 'PARTY', open: true, get view() { return viewFor(s, KEY(0)); }, send: (a: Action) => void act(s, KEY(0), a, Date.now()), close: () => undefined } as unknown as Link<View, Action>;
      let why: string | undefined;
      new Seek({ format: 2, map: 'sands', name: 'P0', pick: PICK, party: link, rating: 1400 }, { onLook: () => undefined, onRun: () => undefined, onBots: () => undefined, onRelay: () => undefined, onGone: () => undefined, onCancel: (w) => (why = w) });
      vi.advanceTimersByTime(4000);
      expect(why).toMatch(/one side/);
      expect(s.phase).toBe('lobby');
    } finally {
      vi.useRealTimers();
    }
  });

  it('quick match knows a party’s rating as it goes in, and hands out the door key with the code', () => {
    const lobby: Lobby = {};
    put(lobby, { code: 'PARTY', game: 'sigilfall-ring', phase: 'lobby', players: 2, max: 4, host: 'P0', full: false, matched: true, at: T0, kind: '2', mmr: 1500, rated: 2, since: T0, door: '0123456789abcdef' }, T0);
    const found = match(lobby, 'sigilfall-ring', T0 + 500, [], '2', 1550);
    expect(found).toMatchObject({ code: 'PARTY', door: '0123456789abcdef' });
    reserve(lobby, 'NEWRM', 'sigilfall-ring', 6, T0, '1', 1000, 'fedcba9876543210');
    expect(lobby.NEWRM!.door).toBe('fedcba9876543210');
  });
});

describe('The Ring ranked: the room knows who played', () => {
  class Sock {
    sent: string[] = [];
    att: unknown = null;
    send(m: string): void {
      this.sent.push(m);
    }
    closed = false;
    close(): void {
      this.closed = true;
    }
    serializeAttachment(v: unknown): void {
      this.att = v;
    }
    deserializeAttachment(): unknown {
      return this.att;
    }
  }
  afterEach(() => vi.unstubAllGlobals());

  it('takes each seat’s account and network from the site, keeps the roster as a ranked match begins, and keeps a waiting ranked room shut to a bare code', async () => {
    const pairs: Sock[] = [];
    vi.stubGlobal('WebSocketRequestResponsePair', class {});
    vi.stubGlobal(
      'WebSocketPair',
      class {
        0 = new Sock();
        1 = new Sock();
        constructor() {
          pairs.push(this[1]);
        }
      },
    );
    const store = new Map<string, unknown>();
    const socks: { ws: Sock; tags: string[] }[] = [];
    const ctx = {
      storage: { get: async (k: string) => structuredClone(store.get(k)), put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)), deleteAll: async () => store.clear(), setAlarm: async () => undefined, deleteAlarm: async () => undefined },
      acceptWebSocket: (ws: Sock, tags: string[] = []) => void socks.push({ ws, tags }),
      getWebSockets: (tag?: string) => socks.filter((x) => !x.ws.closed && (!tag || x.tags.includes(tag))).map((x) => x.ws),
      setWebSocketAutoResponse: () => undefined,
    };
    const room = new Room(ctx as never, {});
    const door = '00112233445566778899aabb';
    expect((await room.fetch(new Request(`https://room/init?code=QQQQQ&game=sigilfall-ring&matched=1&kind=1&door=${door}`, { method: 'POST' }))).ok).toBe(true);
    // (a socket's 101 can't be made outside a worker: the room has done its part by then)
    const connect = (key: string, q: string): Promise<unknown> => room.fetch(new Request(`https://room/ws?key=${key}&name=${key.slice(0, 3)}&${q}`, { headers: { Upgrade: 'websocket' } })).catch(() => null);
    await connect('a'.repeat(20), `uid=user-a&net=aaaaaaaaaaaaaaaa&door=${door}`);
    await connect('b'.repeat(20), 'uid=user-b&net=bbbbbbbbbbbbbbbb');
    expect(pairs[1]!.sent.some((m) => m.includes('"gone"'))).toBe(true);
    await connect('b'.repeat(20), `uid=user-b&net=bbbbbbbbbbbbbbbb&door=${door}`);
    const [a, b] = [pairs[0]!, pairs[2]!];
    const PICK = { cls: 'warrior', bar: ['w-strike', 'w-rend', 'w-charge', 'w-shout'], talents: [] };
    await room.webSocketMessage(a as never, JSON.stringify({ t: 'pick', pick: { ...PICK, team: 0 } }));
    await room.webSocketMessage(b as never, JSON.stringify({ t: 'pick', pick: { ...PICK, team: 1 } }));
    await room.webSocketMessage(a as never, JSON.stringify({ t: 'start' }));
    const run = (await (await room.fetch(new Request('https://room/ring-run'))).json()) as RingRoster;
    expect(run).toMatchObject({ run: 1, format: 2, ranked: true });
    expect(run.seats.map((x) => [x.team, x.uid, x.net])).toEqual([
      [0, 'user-a', 'aaaaaaaaaaaaaaaa'],
      [1, 'user-b', 'bbbbbbbbbbbbbbbb'],
    ]);
    // b drops out while it goes: the room notes when, for the ladder to find its leaver by
    b.close();
    await room.webSocketClose(b as never);
    const after = (await (await room.fetch(new Request('https://room/ring-run'))).json()) as RingRoster;
    expect(Object.keys(after.left ?? {})).toEqual(['2']);
  });
});
