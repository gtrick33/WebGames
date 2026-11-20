/**
 * Admin › Sigilfall: the Ring, the Campaign and the Vigil (server/sigilfallAdmin.ts). The owner, 2026-11-20: "update
 * the admin dashboard for the campaign, the ring and the vigil in sigilfall please, make sure i can manage everything
 * through there, rating, see matches, length, dmg stats, for the ring, etc for campaign as well".
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequestPost as postRanks } from '../functions/api/sigilfall/ranks';
import type { Ctx, Env } from '../server/http';
import { signIn } from '../server/signin';
import { openBotMatch, readStandings, reportMatch, type RosterOf } from '../server/ring';
import { boardRows, campaignOverview, playerBoards, removeRank, resetStanding, ringLadder, ringMatch, ringMatches, ringOverview, ringPlayer, setRank, setStanding, unholdRank, vigilOverview, voidMatch } from '../server/sigilfallAdmin';
import { SAVE_KEY } from '../server/sigilfallGm';
import { statsOf, MIN_BOT_WIN_MS } from '../src/games/sigilfall/arena/ranked';
import { seasonOf } from '../src/games/sigilfall/arena/ranks';
import { memoryD1 } from './d1';

const T0 = Date.UTC(2026, 10, 20, 12);
const noRoster: RosterOf = async () => null;
const STATS = { cls: 'mage', secs: 94, dmg: 41234.4, heal: 120, cc: 9, kicks: 2, combos: 5, supers: 1 };

describe('a ranked report’s numbers', () => {
  it('are kept as whole numbers in range, and a report without a class keeps none', () => {
    expect(statsOf(STATS)).toEqual({ cls: 'mage', secs: 94, dmg: 41234, heal: 120, cc: 9, kicks: 2, combos: 5, supers: 1 });
    expect(statsOf({ ...STATS, secs: 99_999, dmg: -5, heal: 'x' })).toMatchObject({ secs: 3600, dmg: 0, heal: 0 });
    expect(statsOf({ ...STATS, cls: 'Robert); DROP' })).toBeNull();
    expect(statsOf(null)).toBeNull();
  });
});

describe('the admin’s Ring, Campaign and Vigil', () => {
  let db: ReturnType<typeof memoryD1>;
  let env: Env;

  const addUser = (id: string, nickname: string): void => {
    db.sqlite.prepare('INSERT INTO users (id, google_sub, email, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run(id, id, `${id}@example.test`, nickname, T0 - 1000, T0);
  };
  /** A match against the computer, won or lost, `secs` after its ticket. */
  const botMatch = async (user: string, won: boolean, at: number, stats = STATS): Promise<string> => {
    const t = await openBotMatch(env, user, 1, at, () => 0.5);
    await reportMatch(env, user, t.match, won ? 'won' : 'lost', at + MIN_BOT_WIN_MS + 60_000, noRoster, statsOf(stats));
    return t.match;
  };

  beforeEach(() => {
    db = memoryD1();
    env = { DB: db, NR_DB: {} } as unknown as Env;
    addUser('u1', 'Ada');
    addUser('u2', 'Bo');
  });

  it('keeps each match’s length and damage, and shows them in the matches and the overview', async () => {
    const id = await botMatch('u1', true, T0);
    await botMatch('u2', false, T0 + 1000, { ...STATS, cls: 'warrior', dmg: 9000, secs: 120 });
    const m = await ringMatch(env, id);
    expect(m).toMatchObject({ kind: 'bots', result: 't0', secs: 94, measured: true });
    expect(m!.players[0]).toMatchObject({ nickname: 'Ada', report: 'won', stats: { cls: 'mage', dmg: 41234 } });
    expect(m!.players[0]!.change).toBeGreaterThan(0);

    const list = await ringMatches(env, { format: 1 }, 0);
    expect(list.total).toBe(2);
    expect((await ringMatches(env, { user: 'u2' }, 0)).rows.map((r) => r.players[0]!.nickname)).toEqual(['Bo']);
    expect((await ringMatches(env, { result: 't1' }, 0)).total).toBe(1);

    const o = await ringOverview(env, T0 + 60_000 * 5);
    expect(o.season).toBe(seasonOf(T0));
    expect(o.formats[0]).toMatchObject({ format: 1, players: 2, matches: 2, withStats: 2, avgSecs: 107 });
    expect(o.results).toMatchObject({ t0: 1, t1: 1 });
    const mage = o.classes.find((c) => c.cls === 'mage')!;
    expect(mage).toMatchObject({ played: 1, wins: 1, decided: 1, avgDmg: 41234 });
    expect(o.classes.find((c) => c.cls === 'warrior')).toMatchObject({ wins: 0, decided: 1 });
  });

  it('a match reported without numbers is measured from its start to the report', async () => {
    const t = await openBotMatch(env, 'u1', 1, T0, () => 0.5);
    await reportMatch(env, 'u1', t.match, 'lost', T0 + 75_000, noRoster);
    expect(await ringMatch(env, t.match)).toMatchObject({ secs: 75, measured: false });
  });

  it('sets a rating, hidden rating and record by hand, and the boards follow it', async () => {
    const out = await setStanding(env, 'u1', 2, { rating: 1850, mmr: 1900, wins: 30, losses: 12 }, T0);
    expect(typeof out).not.toBe('string');
    const s = (await readStandings(env, 'u1', T0))[2];
    expect(s).toMatchObject({ rating: 1850, mmr: 1900, best: 1850, wins: 30, losses: 12 });
    expect((await boardRows(env, 'ring:duo', '', 0)).rows[0]).toMatchObject({ nickname: 'Ada', score: 1850 });
    expect((await boardRows(env, 'ring', '', 0)).rows[0]).toMatchObject({ score: 1850 });
    // lowered: the best comes down with it when asked, and so do the boards
    await setStanding(env, 'u1', 2, { rating: 1200, best: 1200 }, T0);
    expect((await boardRows(env, 'ring:duo', '', 0)).rows[0]).toMatchObject({ score: 1200 });
    expect(await setStanding(env, 'u1', 2, { rating: 'lots' }, T0)).toBeTypeOf('string');

    const ladder = await ringLadder(env, 2, '', 0, T0);
    expect(ladder.rows.map((r) => r.nickname)).toEqual(['Ada']);
    expect((await ringLadder(env, 2, 'nobody', 0, T0)).total).toBe(0);

    await resetStanding(env, 'u1', 2, T0);
    expect((await readStandings(env, 'u1', T0))[2]).toMatchObject({ rating: 1000, wins: 0 });
    expect((await boardRows(env, 'ring:duo', '', 0)).total).toBe(0);
    expect((await boardRows(env, 'ring', '', 0)).total).toBe(0);
  });

  it('a player’s page has a standing in every format, played or not, and their matches', async () => {
    await botMatch('u1', true, T0);
    const p = await ringPlayer(env, 'u1', T0 + 120_000);
    expect(p!.standings.map((s) => s.format)).toEqual([1, 2, 3]);
    expect(p!.standings[1]).toMatchObject({ rating: 1000, stored: null });
    expect(p!.matches).toHaveLength(1);
    expect(await ringPlayer(env, 'nobody')).toBeNull();
  });

  it('takes a match back: the rating and the win it gave are returned, once', async () => {
    const before = (await readStandings(env, 'u1', T0))[1];
    const id = await botMatch('u1', true, T0);
    const after = (await readStandings(env, 'u1', T0 + 200_000))[1];
    expect(after.rating).toBeGreaterThan(before.rating);
    const out = await voidMatch(env, id, T0 + 300_000);
    expect(out).toMatchObject({ undone: [{ userId: 'u1', change: after.rating - before.rating }] });
    const back = (await readStandings(env, 'u1', T0 + 300_000))[1];
    expect(back).toMatchObject({ rating: before.rating, wins: 0, losses: 0, streak: 0 });
    expect(await ringMatch(env, id)).toMatchObject({ result: 'void', note: 'admin' });
    expect(await voidMatch(env, id)).toBeTypeOf('string');
  });

  it('takes a row off a board and keeps it off, until the player is let back on', async () => {
    await setRank(env, 'u1', 'vigil:whisperwood', 900);
    await setRank(env, 'u2', 'vigil:whisperwood', 400);
    expect((await boardRows(env, 'vigil:whisperwood', '', 0)).rows.map((r) => [r.nickname, r.rank])).toEqual([
      ['Ada', 1],
      ['Bo', 2],
    ]);
    await removeRank(env, 'u1', 'vigil:whisperwood', true, 'impossible night', 'admin@example.test', T0);
    const b = await boardRows(env, 'vigil:whisperwood', '', 0);
    expect(b.rows.map((r) => r.nickname)).toEqual(['Bo']);
    expect(b.held).toMatchObject([{ nickname: 'Ada', reason: 'impossible night' }]);
    expect(await playerBoards(env, 'u1')).toEqual([{ board: 'vigil:whisperwood', score: 0, at: 0, rank: 0, held: true }]);
    expect(await setRank(env, 'u1', 'vigil:whisperwood', 999_999)).toBeTypeOf('string');
    expect(await setRank(env, 'u1', 'nonsense', 5)).toBeTypeOf('string');
    expect(await unholdRank(env, 'u1', 'vigil:whisperwood')).toBe(true);
    expect(await unholdRank(env, 'u1', 'vigil:whisperwood')).toBe(false);
  });

  it('a player kept off a board can’t put themselves back on it from their device', async () => {
    const ORIGIN = 'http://localhost:8788';
    const s = await signIn(env, new Request(ORIGIN), { sub: 'dev:cat@example.com', email: 'cat@example.com', name: 'cat', givenName: '', picture: '', provider: 'email' });
    const cookie = s.cookie.split(';')[0]!;
    const cat = (await db.prepare('SELECT id FROM users WHERE email = ?').bind('cat@example.com').first<{ id: string }>())!.id;
    const post = (entries: unknown) => postRanks({ request: new Request(`${ORIGIN}/api/sigilfall/ranks`, { method: 'POST', headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' }, body: JSON.stringify({ entries }) }), env, params: {} } as Ctx);
    await removeRank(env, cat, 'vigil', true, '', 'admin', T0);
    expect(await (await post([{ board: 'vigil', score: 800 }, { board: 'vigil:mire', score: 800 }])).json()).toMatchObject({ kept: 1 });
    expect((await playerBoards(env, cat)).map((r) => [r.board, r.score, r.held])).toEqual([
      ['vigil', 0, true],
      ['vigil:mire', 800, false],
    ]);
    await unholdRank(env, cat, 'vigil');
    expect(await (await post([{ board: 'vigil', score: 800 }])).json()).toMatchObject({ kept: 1 });
  });

  it('counts the Campaign across every hero, and the Vigil across every land', async () => {
    const hero = (level: number, extra: Record<string, unknown> = {}) => ({
      name: 'H',
      cls: 'warrior',
      level,
      tier: level >= 60 ? 2 : 0,
      keystone: level >= 60 ? 12 : 0,
      para: { l: level >= 60 ? 40 : 0 },
      stats: { kills: 100, deaths: 3, time: 3600, runs: 0, bestRun: 0 },
      quests: { 'q-one': { state: 'done', n: 1 }, 'q-two': { state: 'active', n: 0 } },
      bosses: { 'old-king': 2 },
      at: { region: 'whisperwood' },
      ...extra,
    });
    db.sqlite.prepare('INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)').run('u1', SAVE_KEY, JSON.stringify({ heroes: [hero(60), null, hero(14)], rift: { warrior: 7 } }), T0);
    db.sqlite.prepare('INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)').run('u2', SAVE_KEY, JSON.stringify({ heroes: [hero(3, { quests: { 'q-one': { state: 'active', n: 0 } }, at: { region: 'briarhollow' } })] }), T0 - 3 * 86_400_000);
    const c = await campaignOverview(env, T0);
    expect(c).toMatchObject({ players: 2, playedToday: 1, heroes: 3, maxed: 1, topParagon: 40, stoneHeroes: 1, topStone: 12, hoursPlayed: 3, deaths: 9 });
    expect(c.levels).toEqual([
      { from: 1, to: 9, heroes: 1 },
      { from: 10, to: 19, heroes: 1 },
      { from: 60, to: 60, heroes: 1 },
    ]);
    expect(c.tiers).toEqual([
      { tier: 0, heroes: 2 },
      { tier: 2, heroes: 1 },
    ]);
    expect(c.lands[0]).toMatchObject({ land: 'whisperwood', heroes: 2 });
    expect(c.quests.find((q) => q.id === 'q-one')).toEqual({ id: 'q-one', done: 2, active: 1 });
    expect(c.bosses).toEqual([{ id: 'old-king', kills: 6, heroes: 3 }]);
    expect(c.trials).toEqual([{ cls: 'warrior', players: 1, top: 7, avg: 7 }]);

    db.sqlite.prepare('INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)').run('u1', 'sigilfall.vigil.bests', JSON.stringify({ whisperwood: 700, mire: 120 }), T0);
    db.sqlite.prepare('INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)').run('u2', 'sigilfall.vigil.bests', JSON.stringify({ whisperwood: 300 }), T0 - 30 * 86_400_000);
    await setRank(env, 'u1', 'vigil', 700);
    const v = await vigilOverview(env, T0);
    expect(v).toMatchObject({ players: 2, active7d: 1 });
    expect(v.lands[0]).toEqual({ land: 'whisperwood', players: 2, top: 700, avg: 500, tenMinutes: 1, active7d: 1 });
    expect(v.boards).toEqual([{ board: 'vigil', players: 1, top: 700, avg: 700 }]);
  });
});
