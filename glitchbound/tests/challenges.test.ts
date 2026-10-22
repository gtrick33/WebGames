import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as getView } from '../functions/api/challenges/[id]';
import { onRequestPost as closeIt } from '../functions/api/challenges/[id]/close';
import { onRequestPost as join } from '../functions/api/challenges/[id]/join';
import { onRequestGet as liveSocket } from '../functions/api/challenges/[id]/live';
import { onRequestPost as rematch } from '../functions/api/challenges/[id]/rematch';
import { onRequestPost as score } from '../functions/api/challenges/[id]/score';
import { onRequestGet as list, onRequestPost as create } from '../functions/api/challenges/index';
import type { Ctx, Env } from '../server/http';
import { signIn } from '../server/signin';
import { GAMES } from '../src/catalog/games';
import { CHALLENGE_IDLE_MS, CHALLENGE_LOBBY_MS, cleanName, dailySeed, NAME_MAX, roundSeed, roundWinners, type ChallengeListItem, type ChallengeView } from '../src/platform/challenge';
import { newsBetween } from '../src/platform/useChallengeRun';
import { decodeReplay, encodeReplay } from '../src/games/mini-racer/ghost';
import { challengeSpecOf } from '../src/platform/useChallengeRun';
import { memoryD1 } from './d1';

describe('friends challenges', () => {
  it('gives every round its own seed, the same for every player', () => {
    expect(roundSeed(1234, 1)).toBe(1234);
    expect(roundSeed(1234, 2)).toBe(roundSeed(1234, 2));
    const seeds = new Set(Array.from({ length: 25 }, (_, i) => roundSeed(1234, i + 1)));
    expect(seeds.size).toBe(25);
    expect(roundSeed(1234, 2)).not.toBe(roundSeed(4321, 2));
  });

  it('uses one daily seed per game and day', () => {
    expect(dailySeed('wing-it', '2026-10-18')).toBe(dailySeed('wing-it', '2026-10-18'));
    expect(dailySeed('wing-it', '2026-10-18')).not.toBe(dailySeed('wing-it', '2026-10-19'));
    expect(dailySeed('wing-it', '2026-10-18')).not.toBe(dailySeed('crosswire', '2026-10-18'));
  });

  it('picks round winners (ties share it; nobody wins alone)', () => {
    expect(roundWinners([{ name: 'A', score: 9 }])).toEqual([]);
    expect(roundWinners([{ name: 'A', score: 9 }, { name: 'B', score: 12 }])).toEqual(['B']);
    expect(roundWinners([{ name: 'A', score: 12 }, { name: 'B', score: 12 }, { name: 'C', score: 3 }])).toEqual(['A', 'B']);
    expect(roundWinners([{ name: 'A', score: 9.5 }, { name: 'B', score: 12 }], true)).toEqual(['A']);
  });

  it('cleans player names', () => {
    expect(cleanName('  Ana\u0000 \n  B  ')).toBe('Ana B');
    expect(cleanName('x'.repeat(50))).toHaveLength(NAME_MAX);
    expect(cleanName(42)).toBe('');
  });

  it('keeps the round in the game after the score is sent', () => {
    const spec = { id: 'abc12', round: 2, seed: 7, mode: 'fresh' as const, day: '2026-10-18' };
    expect(challengeSpecOf({ status: 'loading' })).toBeUndefined();
    expect(challengeSpecOf({ status: 'sent', view: {} as never, score: 3, spec })).toBe(spec);
    expect(challengeSpecOf({ status: 'error', message: 'x' })).toBeUndefined();
  });

  it('sends Mini Racer ghosts as compact text the server accepts', () => {
    const ghost = { time: 23.456, t0: 0.05, frames: Array.from({ length: 3 * 470 }, (_, i) => (i % 3 === 2 ? Math.round(Math.sin(i) * 3000) / 1000 : Math.round(i * 37.3) / 10)) };
    const text = encodeReplay(ghost);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text.length).toBeLessThan(20_000);
    const back = decodeReplay(text)!;
    expect(back.time).toBeCloseTo(ghost.time, 3);
    expect(back.frames).toHaveLength(ghost.frames.length);
    back.frames.forEach((v, i) => expect(v).toBeCloseTo(ghost.frames[i]!, 2));
    expect(decodeReplay('not base64!')).toBeNull();
    expect(decodeReplay('')).toBeNull();
  });

  it('offers challenges in every game but the live card game (it has rooms of its own) and Sigilfall (scores depend on a long-kept hero)', () => {
    expect(GAMES.filter((g) => !g.challenge).map((g) => g.slug)).toEqual(['crass-act', 'sigilfall']);
    for (const g of GAMES.filter((x) => x.challenge)) expect(g.challenge!.label.length).toBeGreaterThan(10);
  });
});

describe('a guest who signs in keeps their challenges', () => {
  const ORIGIN = 'https://glitchbound.test';
  const ANA = 'ana-device-key-0000000001';
  const BO = 'bo-device-key-00000000002';
  let db: ReturnType<typeof memoryD1>;
  let env: Env;
  let now = 0;

  beforeEach(() => {
    db = memoryD1();
    env = { DB: db, NR_DB: {} as Env['NR_DB'] };
    // A clock that moves on every reading, so join and score times never tie.
    now = Date.UTC(2026, 9, 18, 12);
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
  });
  afterEach(() => vi.restoreAllMocks());

  type Handler = (ctx: Ctx) => Promise<Response>;
  async function call<T>(handler: Handler, path: string, opts: { id?: string; key?: string; cookie?: string; body?: Record<string, unknown> } = {}): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (opts.cookie) headers.cookie = opts.cookie;
    const url = opts.body ? `${ORIGIN}${path}` : `${ORIGIN}${path}?key=${opts.key ?? ''}`;
    const init: RequestInit = opts.body ? { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ ...opts.body, key: opts.key }) } : { headers };
    const res = await handler({ request: new Request(url, init), env, params: opts.id ? { id: opts.id } : {} });
    return { status: res.status, data: (await res.json()) as T };
  }
  const view = (id: string, key: string, cookie?: string) => call<ChallengeView>(getView, `/api/challenges/${id}`, { id, key, cookie });
  const signInAs = async (email: string): Promise<{ cookie: string; player: string }> => {
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: `dev:${email}`, email, name: 'Ana', givenName: 'Ana', picture: '', provider: 'email' });
    return { cookie: cookie.split(';')[0]!, player: `u:${user.id}` };
  };
  const rows = (sql: string, ...v: string[]) => db.sqlite.prepare(sql).all(...v).map((r) => ({ ...r }));

  /** Ana (guest) starts a challenge, Bo (guest) joins, and both play round 1. */
  async function playedAsGuests(): Promise<string> {
    const { data } = await call<ChallengeView>(create, '/api/challenges', { key: ANA, body: { game: 'wing-it', mode: 'fresh', name: 'Ana' } });
    await call(join, `/api/challenges/${data.id}/join`, { id: data.id, key: BO, body: { name: 'Bo' } });
    await call(score, `/api/challenges/${data.id}/score`, { id: data.id, key: ANA, body: { round: 1, score: 40 } });
    await call(score, `/api/challenges/${data.id}/score`, { id: data.id, key: BO, body: { round: 1, score: 30 } });
    return data.id;
  }

  it('keeps the seat, the scores and the hosting after signing in', async () => {
    const id = await playedAsGuests();
    const ana = await signInAs('ana@example.com');
    const { data } = await view(id, ANA, ana.cookie);
    expect(data.joined).toBe(true);
    expect(data.yourTurn).toBe(false);
    expect(data.players.map((p) => [p.name, p.you])).toEqual([['Ana', true], ['Bo', false]]);
    expect(data.rounds[0]!.scores.map((s) => [s.name, s.score, s.you])).toEqual([['Ana', 40, true], ['Bo', 30, false]]);
    const mine = await call<{ challenges: ChallengeListItem[] }>(list, '/api/challenges', { key: ANA, cookie: ana.cookie });
    expect(mine.data.challenges.map((c) => [c.id, c.yourTurn])).toEqual([[id, false]]);
    // Everything of the device key moved to the account; the friend's guest seat is untouched.
    expect(rows('SELECT player FROM challenge_players ORDER BY joined_at')).toEqual([{ player: ana.player }, { player: `g:${BO}` }]);
    expect(rows('SELECT player FROM challenge_scores WHERE player LIKE ?', `g:${ANA}`)).toEqual([]);
    expect(rows('SELECT host FROM challenges')).toEqual([{ host: ana.player }]);
    // Signed in on any device (no guest key of their own), the challenge is still theirs.
    expect((await view(id, '', ana.cookie)).data.players[0]!.you).toBe(true);
    // As the host they can start the rematch.
    expect((await call<ChallengeView>(rematch, `/api/challenges/${id}/rematch`, { id, key: ANA, cookie: ana.cookie, body: { round: 1 } })).data.round).toBe(2);
  });

  it('counts a round that was started as a guest and finished signed in', async () => {
    const { data } = await call<ChallengeView>(create, '/api/challenges', { key: ANA, body: { game: 'wing-it', mode: 'fresh', name: 'Ana' } });
    const ana = await signInAs('ana@example.com');
    const sent = await call<ChallengeView>(score, `/api/challenges/${data.id}/score`, { id: data.id, key: ANA, cookie: ana.cookie, body: { round: 1, score: 55 } });
    expect(sent.status).toBe(200);
    expect(sent.data.rounds[0]!.scores).toMatchObject([{ name: 'Ana', score: 55, you: true }]);
  });

  it('does not give a second seat when they join again after signing in', async () => {
    const id = await playedAsGuests();
    const ana = await signInAs('ana@example.com');
    const { data } = await call<ChallengeView>(join, `/api/challenges/${id}/join`, { id, key: ANA, cookie: ana.cookie, body: { name: 'Ana' } });
    expect(data.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
    expect(data.yourTurn).toBe(false);
  });

  it('merges a second seat taken before signing in was recognised, keeping the first score of each round', async () => {
    const id = await playedAsGuests();
    const ana = await signInAs('ana@example.com');
    // What happened before this fix: signed in, Ana was a stranger, so she joined as "Ana 2" and
    // played round 1 again; then round 2 was played only by the account.
    const ins = (sql: string, ...v: (string | number)[]) => db.sqlite.prepare(sql).run(...v);
    ins('INSERT INTO challenge_players (challenge_id, player, name, joined_at) VALUES (?, ?, ?, ?)', id, ana.player, 'Ana 2', Date.now());
    ins('INSERT INTO challenge_scores (challenge_id, round, player, score, at) VALUES (?, 1, ?, 90, ?)', id, ana.player, Date.now());
    ins('UPDATE challenges SET round = 2');
    ins('INSERT INTO challenge_scores (challenge_id, round, player, score, at) VALUES (?, 2, ?, 70, ?)', id, ana.player, Date.now());
    const { data } = await view(id, ANA, ana.cookie);
    expect(data.players.map((p) => [p.name, p.you])).toEqual([['Ana', true], ['Bo', false]]);
    const byRound = Object.fromEntries(data.rounds.map((r) => [r.round, r.scores.filter((s) => s.you).map((s) => s.score)]));
    expect(byRound).toEqual({ 1: [40], 2: [70] });
    expect(rows('SELECT COUNT(*) AS n FROM challenge_players WHERE challenge_id = ?', id)).toEqual([{ n: 2 }]);
  });

  it("keeps the account's own seat when it joined first", async () => {
    const ana = await signInAs('ana@example.com');
    const { data } = await call<ChallengeView>(create, '/api/challenges', { key: 'ana-laptop-key-0000000003', cookie: ana.cookie, body: { game: 'wing-it', mode: 'fresh', name: 'Ana' } });
    // Later, signed out on another device, she joined the same challenge as a guest.
    await call(join, `/api/challenges/${data.id}/join`, { id: data.id, key: ANA, body: { name: 'Annie' } });
    await call(score, `/api/challenges/${data.id}/score`, { id: data.id, key: ANA, body: { round: 1, score: 12 } });
    const after = (await view(data.id, ANA, ana.cookie)).data;
    expect(after.players.map((p) => [p.name, p.you])).toEqual([['Ana', true]]);
    expect(after.rounds[0]!.scores).toMatchObject([{ name: 'Ana', score: 12, you: true }]);
  });

  it("never shows anyone's device key", async () => {
    const id = await playedAsGuests();
    const text = JSON.stringify((await view(id, BO)).data);
    expect(text).not.toContain(ANA);
    expect(text).not.toContain(BO);
  });

  /* ------------------------------------------------ live updates and ending */

  const start = async (key = ANA, name = 'Ana'): Promise<string> => (await call<ChallengeView>(create, '/api/challenges', { key, body: { game: 'wing-it', mode: 'fresh', name } })).data.id;
  const poll = async (id: string, key: string, since: number): Promise<number> =>
    (await getView({ request: new Request(`${ORIGIN}/api/challenges/${id}?key=${key}&since=${since}`, { headers: { origin: ORIGIN } }), env, params: { id } })).status;
  const mine = async (key: string) => (await call<{ challenges: ChallengeListItem[] }>(list, '/api/challenges', { key })).data.challenges;

  it('answers an unchanged challenge with an empty 204, and a join changes it', async () => {
    const id = await start();
    const first = (await view(id, ANA)).data;
    expect(await poll(id, ANA, first.updatedAt)).toBe(204);
    await call(join, `/api/challenges/${id}/join`, { id, key: BO, body: { name: 'Bo' } });
    expect(await poll(id, ANA, first.updatedAt)).toBe(200);
    const next = (await view(id, ANA)).data;
    expect(next.players.map((p) => [p.name, p.played])).toEqual([['Ana', false], ['Bo', false]]);
    expect(newsBetween(first, next)).toBe('Bo joined');
  });

  it('pokes the challenge channel on every change, so open pages fetch once instead of polling', async () => {
    const pokes: string[] = [];
    env.ROOMS = {
      idFromName: (name: string) => name,
      get: (name: unknown) => ({ fetch: async (input: Request | string) => (pokes.push(`${String(name)} ${new URL(typeof input === 'string' ? input : input.url).pathname}`), new Response('{}')) }),
    };
    const id = await start();
    await call(join, `/api/challenges/${id}/join`, { id, key: BO, body: { name: 'Bo' } });
    await call(join, `/api/challenges/${id}/join`, { id, key: BO, body: { name: 'Bo' } });
    await call(score, `/api/challenges/${id}/score`, { id, key: ANA, body: { round: 1, score: 40 } });
    await call(rematch, `/api/challenges/${id}/rematch`, { id, key: ANA, body: { round: 1 } });
    await call(closeIt, `/api/challenges/${id}/close`, { id, key: BO, body: {} });
    // Join, score, rematch and leave each poke it once; joining again with the same name changes nothing.
    expect(pokes.filter((p) => p.endsWith('/notify')).length).toBeGreaterThanOrEqual(4);
    expect(new Set(pokes.map((p) => p.split(' ')[0]))).toEqual(new Set([`challenge:${id}`]));
    // Pages watch the same channel over a socket.
    const res = await liveSocket({ request: new Request(`${ORIGIN}/api/challenges/${id}/live`, { headers: { origin: ORIGIN, upgrade: 'websocket' } }), env, params: { id } });
    expect(res.status).toBe(200);
    expect(pokes.at(-1)).toBe(`challenge:${id} /watch`);
    expect((await liveSocket({ request: new Request(`${ORIGIN}/api/challenges/nope/live`, { headers: { upgrade: 'websocket' } }), env, params: { id: 'nope' } })).status).toBe(404);
  });

  it('lets the host delete a challenge nobody else joined', async () => {
    const id = await start();
    expect((await call<{ gone?: boolean }>(closeIt, `/api/challenges/${id}/close`, { id, key: ANA, body: {} })).data).toEqual({ gone: true });
    expect((await view(id, ANA)).status).toBe(404);
    expect(await mine(ANA)).toEqual([]);
  });

  it('lets the host end a challenge for everyone: results stay, play stops', async () => {
    const id = await playedAsGuests();
    const ended = (await call<ChallengeView>(closeIt, `/api/challenges/${id}/close`, { id, key: ANA, body: {} })).data;
    expect(ended).toMatchObject({ closed: true, closesAt: 0, yourTurn: false, host: true });
    expect(ended.rounds[0]!.scores.map((s) => s.score)).toEqual([40, 30]);
    expect((await call(rematch, `/api/challenges/${id}/rematch`, { id, key: BO, body: { round: 1 } })).status).toBe(409);
    expect((await call(join, `/api/challenges/${id}/join`, { id, key: 'cy-device-key-00000000003', body: { name: 'Cy' } })).status).toBe(409);
    expect(await mine(BO)).toEqual([]);
  });

  it('lets a player leave: the seat frees up, the score stays, the last one out ends it', async () => {
    const id = await playedAsGuests();
    const left = (await call<ChallengeView>(closeIt, `/api/challenges/${id}/close`, { id, key: BO, body: {} })).data;
    expect(left).toMatchObject({ joined: false, closed: false, host: false });
    expect(left.players.map((p) => p.name)).toEqual(['Ana']);
    expect(left.rounds[0]!.scores.map((s) => s.name)).toEqual(['Ana', 'Bo']);
    expect(await mine(BO)).toEqual([]);
    // Coming back takes a seat again.
    expect((await call<ChallengeView>(join, `/api/challenges/${id}/join`, { id, key: BO, body: { name: 'Bo' } })).data.joined).toBe(true);
    await call(closeIt, `/api/challenges/${id}/close`, { id, key: BO, body: {} });
    // The host is a player too: when the host is the only one left, ending works as usual.
    expect((await call<ChallengeView>(closeIt, `/api/challenges/${id}/close`, { id, key: ANA, body: {} })).data.closed).toBe(true);
  });

  it('closes a lobby nobody joined after a day, and a quiet challenge after a week', async () => {
    const lobby = await start();
    const busy = await playedAsGuests();
    const before = (await mine(ANA)).find((c) => c.id === lobby)!;
    expect(before).toMatchObject({ lobby: true, host: true });
    expect(before.closesAt - before.updatedAt).toBe(CHALLENGE_LOBBY_MS);
    now += CHALLENGE_LOBBY_MS + 60_000;
    // The lobby is swept away; the played one is still open.
    expect((await mine(ANA)).map((c) => c.id)).toEqual([busy]);
    expect((await view(lobby, ANA)).status).toBe(404);
    now += CHALLENGE_IDLE_MS;
    const quiet = (await view(busy, ANA)).data;
    expect(quiet.closed).toBe(true);
    expect(await mine(ANA)).toEqual([]);
    expect((await call(score, `/api/challenges/${busy}/score`, { id: busy, key: ANA, body: { round: 1, score: 99 } })).status).toBe(409);
  });
});
