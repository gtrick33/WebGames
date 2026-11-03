import { describe, expect, it } from 'vitest';
import { onRequestGet as friendsGet, onRequestPost as friendsPost } from '../functions/api/friends';
import { onRequestGet as invitesGet } from '../functions/api/friends/invites';
import { onRequestGet as leaderboard } from '../functions/api/leaderboard';
import { onRequestDelete as deleteMe } from '../functions/api/me';
import { onRequestGet as pinsGet } from '../functions/api/pins';
import { onRequestPost as endRun } from '../functions/api/runs/end';
import type { Env } from '../server/http';
import { signIn } from '../server/signin';
import { ALL_PINS, earnedPins, GAME_PINS, PIN_BOARDS, pinPoints, RARITY_MIN_PLAYERS, shelfRank, type PinFacts } from '../src/catalog/pins';
import { GAMES } from '../src/catalog/games';
import type { FriendsView, LeaderRow, PinsView, RunEndResult } from '../src/platform/apiTypes';
import { isBlockedName, joinSeat } from '../src/party/rooms/seats';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';

async function setup() {
  const db = memoryD1();
  const env = { DB: db, NR_DB: {} as Env['NR_DB'] } as Env;
  const person = async (name: string) => {
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: `dev:${name}@example.com`, email: `${name}@example.com`, name, givenName: '', picture: '', provider: 'email' });
    const c = cookie.split(';')[0]!;
    const post = (body: unknown) => friendsPost({ request: new Request(`${ORIGIN}/api/friends`, { method: 'POST', headers: { origin: ORIGIN, cookie: c, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, params: {} });
    const view = async () => (await (await friendsGet({ request: new Request(`${ORIGIN}/api/friends`, { headers: { cookie: c } }), env, params: {} })).json()) as FriendsView;
    return { user, cookie: c, post, view };
  };
  return { db, env, person };
}

const facts = (over: Partial<PinFacts> = {}): PinFacts => ({ games: {}, totalRounds: 0, gamesPlayed: 0, streak: 0, level: 0, friends: 0, podium: false, crown: false, ...over });

describe('the pins', () => {
  it('every pin has a unique id, a name and a way to earn it', () => {
    expect(new Set(ALL_PINS.map((p) => p.id)).size).toBe(ALL_PINS.length);
    for (const p of ALL_PINS) expect(p.name && p.hint).toBeTruthy();
  });

  it('every game on a board has four pins, one per tier, asking for what the game reports', () => {
    for (const slug of PIN_BOARDS) {
      const game = GAMES.find((g) => g.slug === slug);
      expect(game, slug).toBeTruthy();
      const pins = GAME_PINS.filter((p) => p.board === slug);
      expect(pins.map((p) => p.tier)).toEqual(['bronze', 'silver', 'gold', 'rift']);
      for (const p of pins) {
        if ('stat' in p.need) expect(game!.stats.map((s) => s.key), p.id).toContain(p.need.stat);
        if ('score' in p.need && game!.limits.maxScore) expect(p.need.score, p.id).toBeLessThanOrEqual(game!.limits.maxScore);
        if ('stat' in p.need) {
          const max = game!.limits.stats?.[p.need.stat]?.max;
          if (max !== undefined) expect(p.need.min, p.id).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('each game’s pins get harder, so the first round earns exactly the bronze', () => {
    const earned = earnedPins(facts({ games: { 'gut-check': { rounds: 1, score: 3, stats: {} } }, totalRounds: 1, gamesPlayed: 1 }));
    expect(earned.map((p) => p.id)).toEqual(['gut-check:bronze']);
  });

  it('counts points and ranks a collection', () => {
    expect(pinPoints(['gut-check:bronze', 'gut-check:rift', 'nope'])).toBe(55);
    expect(shelfRank(0).title).toBe('Visitor');
    expect(shelfRank(100)).toMatchObject({ title: 'Curator', next: { title: 'Archivist' } });
    expect(shelfRank(9999).next).toBeNull();
  });
});

describe('earning pins on the server', () => {
  const round = async (env: Env, db: ReturnType<typeof memoryD1>, cookie: string, userId: string, id: string, game: string, score: number, stats: Record<string, number> = {}) => {
    db.sqlite.prepare(`INSERT INTO runs (id, user_id, game, started_at, status) VALUES (?, ?, ?, ?, 'open')`).run(id, userId, game, Date.now() - 600_000);
    const request = new Request(`${ORIGIN}/api/runs/end`, { method: 'POST', headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' }, body: JSON.stringify({ runId: id, score, stats }) });
    return (await (await endRun({ request, env, params: {} })).json()) as RunEndResult;
  };

  it('a round reports the pins it earned, once, and they stay', async () => {
    const { db, env, person } = await setup();
    const a = await person('ann');
    const first = await round(env, db, a.cookie, a.user.id, 'r1', 'gut-check', 16);
    expect(first.newPins).toEqual(expect.arrayContaining(['gut-check:bronze', 'gut-check:silver', 'gut-check:gold']));
    // A top score on an empty board earns the podium and the crown as well.
    expect(first.newPins).toEqual(expect.arrayContaining(['arcade:podium', 'arcade:crown']));
    const second = await round(env, db, a.cookie, a.user.id, 'r2', 'gut-check', 2);
    expect(second.newPins).toEqual([]);
    // Kept even when the record that earned it is gone.
    db.sqlite.prepare('DELETE FROM runs').run();
    db.sqlite.prepare('DELETE FROM bests').run();
    const view = (await (await pinsGet({ request: new Request(`${ORIGIN}/api/pins`, { headers: { cookie: a.cookie } }), env, params: {} })).json()) as PinsView;
    expect(view.pins.map((p) => p.id)).toContain('gut-check:gold');
    expect(view.points).toBeGreaterThan(0);
  });

  it('a stat pin reads the highest any one round reached, not only the best score’s round', async () => {
    const { db, env, person } = await setup();
    const a = await person('ann');
    await round(env, db, a.cookie, a.user.id, 'r1', 'wing-it', 23, { pillars: 20, feathers: 1 });
    const later = await round(env, db, a.cookie, a.user.id, 'r2', 'wing-it', 15, { pillars: 0, feathers: 5 });
    expect(later.newPins).toContain('wing-it:gold');
  });

  it('a guest sees an empty shelf, and rarity needs a crowd', async () => {
    const { db, env, person } = await setup();
    const a = await person('ann');
    await round(env, db, a.cookie, a.user.id, 'r1', 'gut-check', 3);
    const view = (await (await pinsGet({ request: new Request(`${ORIGIN}/api/pins`), env, params: {} })).json()) as PinsView;
    expect(view.pins).toEqual([]);
    expect(view.rarity.players).toBe(1);
    expect(view.rarity.players).toBeLessThan(RARITY_MIN_PLAYERS);
  });
});

describe('friends', () => {
  it('adds both ways by code, and earns the pin for both', async () => {
    const { person, db } = await setup();
    const [a, b] = [await person('ann'), await person('bob')];
    const { code } = await a.view();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    const res = await b.post({ action: 'add', code: code.toLowerCase() });
    expect(res.status).toBe(200);
    expect((await a.view()).friends.map((f) => f.nickname)).toEqual([b.user.nickname]);
    expect((await b.view()).friends.map((f) => f.nickname)).toEqual([a.user.nickname]);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM pins WHERE pin = 'arcade:buddy'`).get()).toEqual({ n: 2 });
  });

  it('refuses a bad code and your own', async () => {
    const { person } = await setup();
    const a = await person('ann');
    expect((await a.post({ action: 'add', code: 'NOPE2222' })).status).toBe(404);
    const { code } = await a.view();
    expect((await a.post({ action: 'add', code })).status).toBe(400);
  });

  it('a new code retires the old one', async () => {
    const { person } = await setup();
    const [a, b] = [await person('ann'), await person('bob')];
    const old = (await a.view()).code;
    await a.post({ action: 'new_code' });
    expect((await a.view()).code).not.toBe(old);
    expect((await b.post({ action: 'add', code: old })).status).toBe(404);
  });

  it('a block ends the friendship and looks like a dead code to the blocked player', async () => {
    const { person } = await setup();
    const [a, b] = [await person('ann'), await person('bob')];
    const code = (await a.view()).code;
    await b.post({ action: 'add', code });
    await a.post({ action: 'block', id: b.user.id });
    expect((await a.view()).friends).toEqual([]);
    expect((await a.view()).blocked.map((x) => x.id)).toEqual([b.user.id]);
    const res = await b.post({ action: 'add', code });
    expect(res.status).toBe(404);
    await a.post({ action: 'unblock', id: b.user.id });
    expect((await b.post({ action: 'add', code })).status).toBe(200);
  });

  it('the friends board shows only you and your friends', async () => {
    const { db, env, person } = await setup();
    const [a, b, c] = [await person('ann'), await person('bob'), await person('cat')];
    await b.post({ action: 'add', code: (await a.view()).code });
    const best = db.sqlite.prepare(`INSERT INTO bests (user_id, game, score, at) VALUES (?, 'gut-check', ?, 1)`);
    best.run(a.user.id, 5);
    best.run(b.user.id, 9);
    best.run(c.user.id, 50);
    const board = async (url: string, cookie?: string) => ((await (await leaderboard({ request: new Request(`${ORIGIN}/api/leaderboard?game=gut-check${url}`, { headers: cookie ? { cookie } : {} }), env, params: {} })).json()) as { rows: LeaderRow[] }).rows;
    expect((await board('', a.cookie)).length).toBe(3);
    const friends = await board('&scope=friends', a.cookie);
    expect(friends.map((r) => r.nickname)).toEqual([b.user.nickname, a.user.nickname]);
    expect(friends.map((r) => r.rank)).toEqual([1, 2]);
    expect(await board('&scope=friends')).toEqual([]);
  });

  it('a friend’s shelf is for friends only', async () => {
    const { env, person } = await setup();
    const [a, b, c] = [await person('ann'), await person('bob'), await person('cat')];
    await b.post({ action: 'add', code: (await a.view()).code });
    const shelf = (cookie: string) => pinsGet({ request: new Request(`${ORIGIN}/api/pins?friend=${a.user.id}`, { headers: { cookie } }), env, params: {} });
    expect((await shelf(b.cookie)).status).toBe(200);
    expect((await shelf(c.cookie)).status).toBe(403);
  });

  it('an invite reaches a friend, once, carries no text, and strangers can’t send one', async () => {
    const { env, person } = await setup();
    const [a, b, c] = [await person('ann'), await person('bob'), await person('cat')];
    await b.post({ action: 'add', code: (await a.view()).code });
    expect((await a.post({ action: 'invite', id: b.user.id, game: 'sigilfall', code: 'ABCDE' })).status).toBe(200);
    await a.post({ action: 'invite', id: b.user.id, game: 'sigilfall', code: 'FGHIJ' });
    const got = (await (await invitesGet({ request: new Request(`${ORIGIN}/api/friends/invites`, { headers: { cookie: b.cookie } }), env, params: {} })).json()) as { invites: { from: string; href: string }[] };
    expect(got.invites).toEqual([expect.objectContaining({ from: a.user.nickname, href: '/sigilfall?room=FGHIJ' })]);
    expect((await c.post({ action: 'invite', id: b.user.id, game: 'sigilfall', code: 'ABCDE' })).status).toBe(403);
    expect((await a.post({ action: 'invite', id: b.user.id, game: 'nope', code: 'ABCDE' })).status).toBe(400);
    expect((await a.post({ action: 'invite', id: b.user.id, game: 'sigilfall', code: '<script>' })).status).toBe(400);
  });

  it('deleting an account leaves no friends, blocks, invites or pins behind', async () => {
    const { db, env, person } = await setup();
    const [a, b] = [await person('ann'), await person('bob')];
    await b.post({ action: 'add', code: (await a.view()).code });
    await a.post({ action: 'invite', id: b.user.id, game: 'sigilfall', code: 'ABCDE' });
    const request = new Request(`${ORIGIN}/api/me`, { method: 'DELETE', headers: { origin: ORIGIN, cookie: a.cookie } });
    expect((await deleteMe({ request, env, params: {} })).status).toBe(200);
    for (const [table, col] of [['friends', 'friend_id'], ['friends', 'user_id'], ['friend_invites', 'from_id'], ['pins', 'user_id']] as const) {
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`).get(a.user.id)).toEqual({ n: 0 });
    }
    expect((await b.view()).friends).toEqual([]);
  });
});

describe('names in live rooms', () => {
  it('a blocked word falls back to Player, however it is dressed up', () => {
    expect(isBlockedName('f.u c-k you')).toBe(true);
    expect(isBlockedName('Lena')).toBe(false);
    const room = { seats: [], nextSeat: 1, phase: 'lobby' } as never;
    expect(joinSeat(room, 'k', 'sh1t.shit', 0, 4, false)).toBeNull();
    expect((room as { seats: { name: string }[] }).seats[0]!.name).toBe('Player');
  });
});
