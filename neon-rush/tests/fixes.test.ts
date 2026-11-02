import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { Autopilot } from '../src/game/autopilot';
import { HAZARD_SIZES, PLAYER, SIM_DT, laneCenter } from '../src/game/config';
import { checkClaim, maxNearMissBonus, metersAt, racerNameFrom, rowsBy } from '../src/backend/leaderboard-rules';
import { MAX_CHALLENGE_ROUNDS, createProfile, mergeChallengeRounds, putChallengeRound, sanitizeProfile } from '../src/progression/profile';
import { finishRun } from '../src/progression/run';
import { runStats } from './fixtures';

const claimOf = (w: World) => ({
  score: w.stats.score,
  meters: Math.floor(w.stats.meters),
  coins: w.stats.coins,
  nearMisses: w.stats.nearMisses,
  durationMs: Math.round(w.stats.time * 1000),
});

/** Rows whose front reached the player's bumper (the most rows a near miss can come from). */
function rowsReached(w: World, seen: Set<object>): void {
  const pTop = w.player.y - PLAYER.hitH / 2;
  for (const r of w.rows) if (r.top + r.len >= pTop) seen.add(r);
}

describe('NEON RUSH leaderboard checks (NR-11)', () => {
  it('distance follows the real speed curve', () => {
    const w = new World({ seed: 5, viewHeight: 760 });
    for (let i = 0; i < 90 / SIM_DT; i++) {
      w.crashed = false;
      w.hazards.length = 0;
      w.update(SIM_DT);
    }
    expect(Math.abs(w.meters - metersAt(w.stats.time))).toBeLessThan(1);
    expect(metersAt(4 * 3600)).toBeGreaterThan(800_000);
  });

  it('refuses the forged 55,800 in 20 s and other impossible runs', () => {
    expect(checkClaim({ score: 55_800, meters: 1200, coins: 460, nearMisses: 250, durationMs: 20_000 }, 21_000)).not.toBeNull();
    const m = Math.floor(metersAt(20));
    expect(checkClaim({ score: m + 40, meters: m, coins: 4, nearMisses: 0, durationMs: 20_000 }, 21_000)).toBeNull();
    expect(checkClaim({ score: 1300, meters: 1200, coins: 10, nearMisses: 0, durationMs: 20_000 }, 21_000)).toBe('distance_high');
    expect(checkClaim({ score: 30 * m, meters: m, coins: 4, nearMisses: 120, durationMs: 20_000 }, 21_000)).toBe('near_misses');
    const n = rowsBy(m);
    expect(checkClaim({ score: m + 40 + maxNearMissBonus(n) + 25, meters: m, coins: 4, nearMisses: n, durationMs: 20_000 }, 21_000)).toBe('score');
    expect(checkClaim({ score: m + 40, meters: m, coins: 4, nearMisses: 3, durationMs: 20_000 }, 21_000)).toBe('score');
  });

  it('the bonus ceiling climbs the combo to x8', () => {
    expect(maxNearMissBonus(1)).toBe(25);
    expect(maxNearMissBonus(8)).toBe(25 * 36);
    expect(maxNearMissBonus(10)).toBe(25 * 36 + 400);
  });

  it('accepts genuine runs on every screen shape, and rows never outrun the bound', () => {
    for (const viewHeight of [760, 924, 1125]) {
      for (let seed = 1; seed <= 6; seed++) {
        const w = new World({ seed: seed * 97, viewHeight });
        const p = new Autopilot(0.04);
        const seen = new Set<object>();
        for (let i = 0; i < 120 / SIM_DT && !w.crashed; i++) {
          p.update(w, SIM_DT);
          w.update(SIM_DT);
          rowsReached(w, seen);
        }
        const c = claimOf(w);
        expect(checkClaim(c, c.durationMs), `${viewHeight}/${seed}`).toBeNull();
        expect(seen.size).toBeLessThanOrEqual(rowsBy(c.meters + 20));
      }
    }
  });
});

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

describe('arcade names (NR-06, NR-07)', () => {
  it('fits names the board would reject, or gives up on them', () => {
    expect(racerNameFrom('Zoë')).toBe('Zoe');
    expect(racerNameFrom('Jo')).toBe('Jo_');
    expect(racerNameFrom('Neon Night Rider 3000')).toBe('Neon Night Rid');
    expect(racerNameFrom('Ана')).toBeNull();
    expect(racerNameFrom('Admin')).toBeNull();
  });

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
    const src = readFileSync(new URL('../scripts/sw-template.js', import.meta.url), 'utf8').replace('__VERSION__', 't').replace('__PRECACHE__', '[]');
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
