import swTemplate from '../scripts/sw-template.js?raw';
import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { HAZARD_SIZES, SIM_DT, laneCenter } from '../src/game/config';
import { MAX_CHALLENGE_ROUNDS, createProfile, mergeChallengeRounds, putChallengeRound, sanitizeProfile } from '../src/progression/profile';
import { finishRun } from '../src/progression/run';
import { runStats } from './fixtures';

describe('the same run on every screen (NR-03)', () => {
  it('a seed plays out identically on a tablet, a desktop stage and a tall phone', () => {
    const results = [760, 924, 1125].map((viewHeight) => {
      const w = new World({ seed: 2654435761 | 0, viewHeight });
      let t = 0;
      while (!w.crashed && t < 60) {
        w.update(SIM_DT);
        t += SIM_DT;
      }
      return { score: w.stats.score, time: w.stats.time.toFixed(3) };
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
});

describe('shield grace (NR-09)', () => {
  it('a car driven straight through right after a shield save is no near miss', () => {
    const w = new World({ seed: 1, viewHeight: 800 });
    w.active.shield = 5;
    const lane = w.player.lane;
    for (const dy of [200, 330]) {
      w.hazards.push({
        active: true, kind: 'car', lane, x: laneCenter(lane), y: w.player.y - dy, ...HAZARD_SIZES.car, variant: 0,
        danger: false, passed: false, row: null, changeTo: -1, changeT: 0, telegraph: 0, phase: 0,
      });
    }
    for (let i = 0; i < 1 / SIM_DT; i++) w.update(SIM_DT);
    expect(w.crashed).toBe(false);
    expect(w.stats.shieldSaves).toBe(1);
    expect(w.stats.nearMisses).toBe(0);
  });
});

describe('runs played (NR-10)', () => {
  it('a run quit from the pause menu after a few seconds pays its coins but is not a run played', () => {
    const p = createProfile();
    const coins = p.coins;
    finishRun(p, 'quit', runStats({ meters: 90, coins: 5, time: 3 }), '2026-11-02', 1, true);
    expect(p.gamesPlayed).toBe(0);
    expect(p.coins).toBe(coins + 5);
    finishRun(p, 'crash', runStats({ meters: 90, coins: 0, time: 3 }), '2026-11-02', 1);
    expect(p.gamesPlayed).toBe(1);
    finishRun(p, 'long', runStats({ meters: 400, coins: 0, time: 14 }), '2026-11-02', 1, true);
    expect(p.gamesPlayed).toBe(2);
  });
});

describe('old saves (NR-06)', () => {
  it('old saves load with no chosen name and no challenge rounds', () => {
    const old = sanitizeProfile({ version: 3, playerName: 'Racer' });
    expect(old.nameChosen).toBe(false);
    expect(old.challengeRounds).toEqual({});
    expect(sanitizeProfile({ nameChosen: true }).nameChosen).toBe(true);
  });
});

describe('challenge rounds in the save (NR-04, NR-05)', () => {
  it('keeps the newest rounds, clamps bad data and survives another tab', () => {
    const p = createProfile();
    for (let i = 0; i < MAX_CHALLENGE_ROUNDS + 5; i++) putChallengeRound(p, `s${i}`, { score: i, meters: 0, coins: 0, nearMisses: 0, done: true });
    expect(Object.keys(p.challengeRounds)).toHaveLength(MAX_CHALLENGE_ROUNDS);
    expect(p.challengeRounds.s0).toBeUndefined();
    const loaded = sanitizeProfile(JSON.parse(JSON.stringify({ ...p, challengeRounds: { ...p.challengeRounds, bad: 1, s7: { score: -5, done: 'x' } } })));
    expect(loaded.challengeRounds.bad).toBeUndefined();
    expect(loaded.challengeRounds.s7).toEqual({ score: 0, meters: 0, coins: 0, nearMisses: 0, done: false });

    const other = createProfile();
    mergeChallengeRounds(other, p);
    expect(other.challengeRounds.s24?.done).toBe(true);
  });
});

describe('offline copy (NR-08)', () => {
  type Handler = (e: { request: Request; respondWith: (p: Promise<Response>) => void; waitUntil: (p: Promise<unknown>) => void }) => void;

  function loadWorker(network: (url: string) => Response) {
    const stored = new Map<string, Response>();
    const handlers: Record<string, Handler> = {};
    const cache = { put: async (key: string, res: Response) => void stored.set(key, res), addAll: async () => undefined };
    const scope = {
      location: new URL('https://example.test/play/neon-rush/sw.js'),
      addEventListener: (type: string, h: Handler) => (handlers[type] = h),
      caches: { open: async () => cache, match: async (key: string | Request) => stored.get(typeof key === 'string' ? key : '?'), keys: async () => [] },
      fetch: async (req: Request) => network(req.url),
    };
    const src = swTemplate.replace('__VERSION__', 't').replace('__PRECACHE__', '[]');
    new Function('self', 'caches', 'fetch', 'Response', src)(scope, scope.caches, scope.fetch, Response);
    const navigate = async (url: string) => {
      let out: Promise<Response> | undefined;
      const request = { url, method: 'GET', mode: 'navigate' } as unknown as Request;
      handlers.fetch?.({ request, respondWith: (p) => (out = p), waitUntil: () => undefined });
      await out;
      await new Promise((r) => setTimeout(r, 0));
    };
    return { stored, navigate };
  }

  const page = (body: string, status = 200) => {
    const res = new Response(body, { status });
    Object.defineProperty(res, 'type', { value: 'basic' });
    return res;
  };

  it('keeps only a good copy of the game itself', async () => {
    const sw = loadWorker((url) => (url.endsWith('privacy.html') ? page('privacy') : url.includes('broken') ? page('oops', 500) : page('game')));
    await sw.navigate('https://example.test/play/neon-rush/');
    expect(await sw.stored.get('./index.html')?.clone().text()).toBe('game');
    await sw.navigate('https://example.test/play/neon-rush/privacy.html');
    expect(await sw.stored.get('./index.html')?.clone().text()).toBe('game');
    const failing = loadWorker(() => page('oops', 500));
    await failing.navigate('https://example.test/play/neon-rush/');
    expect(failing.stored.size).toBe(0);
  });
});
