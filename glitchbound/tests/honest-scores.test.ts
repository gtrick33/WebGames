import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as start } from '../functions/api/challenges/[id]/start';
import { onRequestPost as score } from '../functions/api/challenges/[id]/score';
import { onRequestPost as create } from '../functions/api/challenges/index';
import { onRequestPost as endRun } from '../functions/api/runs/end';
import type { Ctx, Env } from '../server/http';
import { refusal } from '../server/plausible';
import { signIn } from '../server/signin';
import { getGame } from '../src/catalog/catalog';
import { GAMES } from '../src/catalog/games';
import type { RunEndResult } from '../src/platform/apiTypes';
import type { ChallengeView } from '../src/platform/challenge';
import { better, challengeForDay, dailyShareText, isDone, modeStats, progressOf, type DailyChallenge } from '../src/platform/daily';
import { applyRound, emptySave, mergeSaves } from '../src/platform/save';
import { BIRD_X, flap, gapCentre, H, HIT_R, newSim, PILLAR_W, runPoints, step, type Sim } from '../src/games/wing-it/sim';
import { levelPoints, makeLevel } from '../src/games/outta-here/logic';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';
const game = (slug: string) => getGame(slug)!;

describe('score limits', () => {
  it('refuses the impossible rounds QA forged (PS-01, CR-01, LP-10, CW-01, PS-05)', () => {
    expect(refusal(game('memory-grid'), 5000, { accuracy: 101 }, 0.7)).toBe('too_fast');
    expect(refusal(game('memory-grid'), 300, { accuracy: 101 }, 60)).toBe('bad_stats');
    expect(refusal(game('color-recall'), 5001, { accuracy: 90 }, 60)).toBe('above_max');
    expect(refusal(game('color-recall'), 4000, { bestColor: 1001 }, 60)).toBe('bad_stats');
    expect(refusal(game('letter-pinch'), 801, { spare: 5 }, 30)).toBe('above_max');
    expect(refusal(game('letter-pinch'), 700, { spare: 9 }, 30)).toBe('bad_stats');
    expect(refusal(game('color-lab'), 500, { stars: 999 }, 0.8)).toBe('too_fast');
    expect(refusal(game('color-lab'), 50, { stars: 999 }, 30)).toBe('bad_stats');
    expect(refusal(game('spot-the-glitch'), 5000, { found: 999 }, 1.6)).toBe('too_fast');
    expect(refusal(game('spot-the-glitch'), 1500, { found: 999 }, 30)).toBe('bad_stats');
    expect(refusal(game('wheres-the-ball'), 5001, {}, 5)).toBe('implausible_score');
    expect(refusal(game('wheres-the-ball'), 3000, { fastest: 0, found: 3 }, 60)).toBe('bad_stats');
    expect(refusal(game('crosswire'), 1251, { clean: 1 }, 300)).toBe('above_max');
    expect(refusal(game('crosswire'), 5000, {}, 1)).toBe('too_fast');
    expect(refusal(game('gut-check'), 52, {}, 1.5)).toBe('implausible_score');
    expect(refusal(game('gut-check'), 1234567, {}, 3600)).toBe('above_max');
    // A held-open run no longer allows any score: endless games still cap their stats by time.
    expect(refusal(game('wait-what'), 1600, { correct: 10, streak: 10 }, 120, true)).toBe('above_max');
    expect(refusal(game('wait-what'), 1600, { correct: 10 }, 120)).toBe('implausible_score');
    expect(refusal(game('to-scale'), 5001, { bullseyes: 5 }, 60, true)).toBe('above_max');
    expect(refusal(game('to-scale'), 4000, { bullseyes: 999 }, 60)).toBe('bad_stats');
    // Wing It: the score is gaps + 3 per feather (WI-11).
    expect(refusal(game('wing-it'), 40, { pillars: 10, feathers: 9 }, 60)).toBe('bad_stats');
    expect(refusal(game('wing-it'), 40, { pillars: 31, feathers: 3 }, 60)).toBe('');
    expect(refusal(game('wing-it'), 1e9 + 1, {}, 60)).toBe('bad_score');
  });

  it('lets the best real rounds through, with headroom (NR-01, SFS-02, CC-03, WH-01, GC-09, LP-10, GL-06)', () => {
    // [game, score, stats, seconds since the start report]: measured by QA or from the scoring rules,
    // some at twice the measured rate (the headroom the limits promise).
    const real: [string, number, Record<string, number>, number][] = [
      ['neon-rush', 45062, { meters: 6900, nearMisses: 165 }, 150],
      ['neon-rush', Math.round(323 * 120), { meters: 5500, nearMisses: 190 }, 120],
      ['sigilfall', 58215, { level: 100, bosses: 2, kills: 400 }, 135],
      ['sigilfall', 45757, { level: 100, bosses: 2 }, 108],
      ['crater-crew', 600, { damage: 100, kills: 1 }, 2.6],
      ['whatsit', 1000, { questions: 0 }, 0.4],
      ['gut-check', 0, {}, 0.1],
      ['gut-check', 300, {}, 200],
      ['letter-pinch', 800, { spare: 5, guesses: 1, seconds: 1 }, 0.1],
      ['gloop', Math.round(25.7 * 2 * 60), { biggest: 11, merges: 120 }, 60],
      ['color-recall', 5000, { accuracy: 100, bestColor: 1000, perfects: 5 }, 9],
      ['crosswire', 1250, { clean: 1, seconds: 15 }, 13],
      ['star-grid', 3000, { time: 30 }, 30],
      ['star-grid', 1150, {}, 1],
      ['wheres-the-ball', 4950, { found: 5, fastest: 1 }, 9],
      ['backgammon', 950, { points: 9 }, 600],
      ['to-scale', 5000, { bullseyes: 5 }, 8],
      ['wait-what', 1500, { correct: 10, streak: 10 }, 15],
      // The rest of the arcade: a strong real round each, so every game's limits are run here.
      ['memory-grid', 35 * 120, { longest: 14, patterns: 12, accuracy: 100 }, 120],
      ['mini-racer', 2900, { drift: 3500, cleanLaps: 3 }, 30],
      ['launch-control', 17000, { perfect: 4 }, 12],
      ['color-lab', 50, { stars: 15, underPar: 5 }, 20],
      ['spot-the-glitch', 125 * 2 * 60, { found: 60, pictures: 12, clean: 12 }, 60],
      ['square-deal', 1600, { lines: 25, streak: 10 }, 60],
      ['outta-here', 2544, { levels: 5, perfect: 5 }, 142],
      ['fussbox', 1000, { correct: 8, tests: 3 }, 20],
      ['belot', 220, { margin: 120 }, 300],
      ['crass-act', 10, { wins: 1 }, 600],
      ['wing-it', 70, { pillars: 40, feathers: 10 }, 50],
      // First Steps solo, every gem, both pals to the exit in 4 s (a real dash takes 6)
      ['prism-pals', 2100, { levels: 1, gems: 4 }, 4],
    ];
    for (const [slug, s, stats, seconds] of real) expect(refusal(game(slug), s, stats, seconds), `${slug} ${s} in ${seconds} s`).toBe('');
    // A new game adds its best real round here, so its limits are tested before it ships.
    expect(GAMES.map((g) => g.slug).filter((slug) => !real.some(([r]) => r === slug))).toEqual([]);
  });

  it('lets Outta Here’s Endless reach level 100 at 5 taps a second (OH-02)', () => {
    let total = 0;
    let seconds = 0;
    for (let n = 1; n <= 100; n++) {
      const level = makeLevel(99, n);
      const secs = level.arrows.length / 5;
      seconds += secs;
      total += levelPoints(level, n, 0, secs);
    }
    expect(refusal(game('outta-here'), total, { levels: 100, perfect: 100 }, seconds)).toBe('');
  });

  it('lets Wing It’s autopilot flights through', () => {
    const autopilot = (s: Sim): void => {
      const p = s.pillars.find((x) => x.x + PILLAR_W > BIRD_X - HIT_R);
      const target = p ? gapCentre(p, s.t + 0.2) + p.gapH / 2 - HIT_R - 16 : H / 2;
      if (s.y > target && s.vy > 0) flap(s);
    };
    for (const seed of [1, 7, 42]) {
      const s = newSim(seed);
      flap(s);
      for (let i = 0; i < 20_000 && !s.dead; i++) {
        autopilot(s);
        step(s);
      }
      expect(s.score).toBeGreaterThan(5);
      expect(refusal(game('wing-it'), runPoints(s), { pillars: s.score, feathers: s.feathers }, s.t)).toBe('');
    }
  });
});

describe('lower-is-better Daily Challenge stats (PS-02)', () => {
  // Star Grid's "Solve all three Star Grid dailies in under {n} seconds".
  const sg = game('star-grid');
  const c = { day: '2027-01-12', number: 88, game: sg, metric: 'time', target: 180, unit: 's', label: 'Solve all three Star Grid dailies in under 180 seconds', template: '' } satisfies DailyChallenge;

  it('clears at or under the target and keeps the fastest time', () => {
    expect([95, 179, 180, 181, 600, 0].map((v) => isDone(c, v))).toEqual([true, true, true, false, false, false]);
    expect(better(c, 0, 600)).toBe(600);
    expect(better(c, 600, 95)).toBe(95);
    expect(better(c, 95, 0)).toBe(95);
    expect(progressOf(c, 0)).toBe(0);
    expect(progressOf(c, 360)).toBe(0.5);
    expect(progressOf(c, 95)).toBe(1);
    expect(dailyShareText(c, 95, 1, [true], 'https://x')).toContain('Cleared: 95 s (target under 180 s)');
    // Higher-is-better metrics are unchanged.
    const score = { ...c, metric: 'score', target: 1200 };
    expect([isDone(score, 1200), isDone(score, 1199), better(score, 3, 5)]).toEqual([true, false, 5]);
  });

  it('records it in the save and merges two devices’ days', () => {
    const day = Array.from({ length: 4000 }, (_, i) => new Date(Date.UTC(2027, 0, 1) + i * 86400_000).toISOString().slice(0, 10)).find((d) => challengeForDay(d, GAMES, null)?.metric === 'time');
    expect(day).toBeDefined();
    const at = new Date(`${day}T12:00:00`);
    const save = emptySave();
    expect(applyRound(save, sg, { type: 'end', score: 2000, stats: { time: 600 } }, GAMES, at).dailyCompleted).toBe(false);
    const target = challengeForDay(day!, GAMES, null)!.target;
    expect(applyRound(save, sg, { type: 'end', score: 2400, stats: { time: 95 } }, GAMES, at).dailyCompleted).toBe(true);
    expect(save.daily[day!]).toEqual({ best: 95, done: true });
    const other = emptySave();
    other.daily[day!] = { best: target + 50, done: false };
    expect(mergeSaves(other, save, GAMES, day!).daily[day!]).toEqual({ best: 95, done: true });
  });
});

describe('per-mode bests', () => {
  it('keeps Star Grid’s and Spot the Glitch’s daily and endless bests apart', () => {
    const save = emptySave();
    const sg = game('star-grid');
    applyRound(save, sg, { type: 'end', score: 2400, stats: { time: 120 }, daily: true }, GAMES);
    const grid = applyRound(save, sg, { type: 'end', score: 1100, stats: {} }, GAMES);
    expect(save.games['star-grid']!.best).toEqual({ score: 2400, time: 120, dailyScore: 2400, gridScore: 1100 });
    // A single grid can't beat the overall best, but it is a best of its own kind.
    expect(grid.newBests).toEqual([]);
    expect(applyRound(save, sg, { type: 'end', score: 1150, stats: {} }, GAMES).newBests).toEqual(['gridScore']);
    // Challenge rounds count toward neither.
    applyRound(save, sg, { type: 'end', score: 3000, stats: {}, challenge: { id: 'abc12', round: 1 } }, GAMES);
    expect(save.games['star-grid']!.best).toMatchObject({ score: 3000, dailyScore: 2400, gridScore: 1150 });
    const sp = game('spot-the-glitch');
    applyRound(save, sp, { type: 'end', score: 9000, stats: { found: 60, pictures: 12 } }, GAMES);
    applyRound(save, sp, { type: 'end', score: 2500, stats: { found: 15, clean: 2 }, daily: true }, GAMES);
    expect(save.games['spot-the-glitch']!.best).toMatchObject({ score: 9000, rush: 9000, daily: 2500 });
    // The daily's own stat feeds the Daily Challenge whether the game reports it or not; Rush never does.
    expect(modeStats(sp, 9000, { found: 60 }, 'other')).toEqual({ found: 60, rush: 9000 });
    expect(modeStats(sp, 2500, {}, 'daily')).toEqual({ daily: 2500 });
    expect(modeStats(sp, 2500, { daily: 2400 }, 'daily')).toEqual({ daily: 2400 });
    expect(modeStats(sp, 3000, { daily: 3000 }, 'challenge')).toEqual({});
  });
});

describe('the servers refuse impossible rounds', () => {
  afterEach(() => vi.restoreAllMocks());

  it('/api/runs/end answers 422 with the reason and ranks nothing', async () => {
    const db = memoryD1();
    const env = { DB: db, NR_DB: {} as Env['NR_DB'] } as Env;
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: 'dev:ana@example.com', email: 'ana@example.com', name: 'Ana', givenName: '', picture: '', provider: 'email' });
    const end = async (runId: string, slug: string, s: number, stats: Record<string, number>): Promise<{ status: number; data: RunEndResult }> => {
      db.sqlite.prepare(`INSERT INTO runs (id, user_id, game, started_at, status) VALUES (?, ?, ?, ?, 'open')`).run(runId, user.id, slug, Date.now() - 60_000);
      const request = new Request(`${ORIGIN}/api/runs/end`, { method: 'POST', headers: { origin: ORIGIN, cookie: cookie.split(';')[0]!, 'content-type': 'application/json' }, body: JSON.stringify({ runId, score: s, stats }) });
      const res = await endRun({ request, env, params: {} });
      return { status: res.status, data: (await res.json()) as RunEndResult };
    };
    expect(await end('a', 'letter-pinch', 801, {})).toMatchObject({ status: 422, data: { ok: false, error: 'above_max' } });
    expect(await end('b', 'memory-grid', 300, { accuracy: 101 })).toMatchObject({ status: 422, data: { error: 'bad_stats' } });
    expect(await end('c', 'letter-pinch', 800, { spare: 5, guesses: 1, seconds: 4 })).toMatchObject({ status: 200, data: { ok: true, rank: 1 } });
    expect(db.sqlite.prepare(`SELECT id, status FROM runs ORDER BY id`).all()).toEqual([
      { id: 'a', status: 'rejected' },
      { id: 'b', status: 'rejected' },
      { id: 'c', status: 'ok' },
    ]);
  });

  it('times a challenge score from the player’s first start (PS-05, LP-17, PS-08)', async () => {
    const env = { DB: memoryD1(), NR_DB: {} as Env['NR_DB'] } as Env;
    let now = Date.UTC(2026, 9, 18, 12);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const KEY = 'ana-device-key-0000000000';
    const call = async <T>(handler: (ctx: Ctx) => Promise<Response>, path: string, body: Record<string, unknown>, id?: string): Promise<{ status: number; data: T }> => {
      const request = new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ ...body, key: KEY }) });
      const res = await handler({ request, env, params: id ? { id } : {} });
      return { status: res.status, data: (await res.json()) as T };
    };
    // A date far from today is replaced by today's.
    const made = await call<ChallengeView>(create, '/api/challenges', { game: 'letter-pinch', mode: 'daily', day: '2031-05-05', name: 'Ana' });
    expect(made.data.day).toBe('2026-10-18');
    const id = made.data.id;
    now += 3600_000;
    const first = await call<{ startedAt: number }>(start, `/api/challenges/${id}/start`, { round: 1 }, id);
    expect(first).toMatchObject({ status: 200, data: { startedAt: now } });
    now += 200;
    // Starting again (a reload) keeps the first start.
    expect((await call<{ startedAt: number }>(start, `/api/challenges/${id}/start`, { round: 1 }, id)).data.startedAt).toBe(first.data.startedAt);
    expect(await call(score, `/api/challenges/${id}/score`, { round: 1, score: 99999 }, id)).toMatchObject({ status: 422, data: { error: 'above_max' } });
    expect((await call<ChallengeView>(score, `/api/challenges/${id}/score`, { round: 1, score: 700, stats: { spare: 4 } }, id)).status).toBe(200);
    // One score per player and round: the first one counts.
    const again = await call<ChallengeView>(score, `/api/challenges/${id}/score`, { round: 1, score: 800 }, id);
    expect(again.data.rounds[0]!.scores.map((s) => s.score)).toEqual([700]);
    // A "Today's daily" round already played: the game reports the saved result at once, with no start.
    // Only the caps apply then.
    const daily = (await call<ChallengeView>(create, '/api/challenges', { game: 'wait-what', mode: 'daily', name: 'Ana' })).data.id;
    now += 500;
    expect(await call(score, `/api/challenges/${daily}/score`, { round: 1, score: 1600, stats: { correct: 10 } }, daily)).toMatchObject({ status: 422, data: { error: 'above_max' } });
    expect((await call(score, `/api/challenges/${daily}/score`, { round: 1, score: 1320, stats: { correct: 9, streak: 6 } }, daily)).status).toBe(200);
  });
});
