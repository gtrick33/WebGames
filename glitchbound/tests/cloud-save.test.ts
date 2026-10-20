import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as getMe, onRequestDelete as deleteMe } from '../functions/api/me';
import { onRequestGet as getSaves, onRequestPost as postSaves } from '../functions/api/saves';
import type { Ctx, Env } from '../server/http';
import { signIn } from '../server/signin';
import { GAMES } from '../src/catalog/games';
import type { Me } from '../src/platform/apiTypes';
import { mergeJson, mergeSaveText } from '../src/platform/cloudMerge';
import { hashText, startCloudSave, stopCloudSave } from '../src/platform/cloudSave';
import { emptySave, mergeSaves, sanitizeSave, SAVE_KEY } from '../src/platform/save';
import { holdGame, savesReady, setSavesGate } from '../src/platform/syncGate';
import { isSyncedKey, MAX_SYNCED_SAVE, slugOfKey } from '../src/platform/syncKeys';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';
const TODAY = '2026-10-20';

describe('which saves sync', () => {
  it('takes the arcade save and each game’s own save, and nothing else', () => {
    for (const k of [SAVE_KEY, 'glitchbound.fussbox', 'glitchbound.memory-grid.v1', 'gb.mini-racer.v1', 'glitchbound.star-grid']) expect(isSyncedKey(k)).toBe(true);
    for (const k of ['glitchbound.sync', 'glitchbound.lastVisit', 'glitchbound.crass-act.adult', 'gb.mini-racer.ghost.sunny-bay', 'glitchbound.not-a-game', 'neonrush.save', 'theme'])
      expect(isSyncedKey(k)).toBe(false);
    expect(slugOfKey('gb.mini-racer.v1')).toBe('mini-racer');
    expect(slugOfKey(SAVE_KEY)).toBeNull();
  });
});

describe('merging two copies of a save', () => {
  it('keeps every day either device finished; for a shared day, the record that got further', () => {
    const local = { best: 40, rounds: 3, daily: { '2026-10-18': { score: 40, open: false }, [TODAY]: { score: 0, open: true } }, muted: true };
    const remote = { best: 55, rounds: 5, daily: { '2026-10-19': { score: 55 }, [TODAY]: { score: 30, correct: 6 } }, muted: false };
    expect(mergeJson(local, remote)).toEqual({
      best: 55,
      rounds: 5,
      daily: { '2026-10-18': { score: 40, open: false }, '2026-10-19': { score: 55 }, [TODAY]: { score: 30, correct: 6 } },
      muted: true,
    });
    // Lists of results per day (Color Lab levels): the longer one.
    expect(mergeJson({ daily: { [TODAY]: [1] } }, { daily: { [TODAY]: [1, 2, 3] } })).toEqual({ daily: { [TODAY]: [1, 2, 3] } });
    // Solved beats settled beats in progress.
    expect(mergeJson({ daily: { [TODAY]: { done: false, score: 9 } } }, { daily: { [TODAY]: { done: true, score: 1 } } })).toEqual({ daily: { [TODAY]: { done: true, score: 1 } } });
  });

  it('never mixes two half-played rounds: the later day wins whole, then the one played further, then this device', () => {
    const mine = { day: TODAY, tests: [1, 2], phase: 'exam' };
    const theirs = { day: TODAY, tests: [5], phase: 'lab', marks: [true] };
    expect(mergeJson({ progress: mine }, { progress: theirs })).toEqual({ progress: mine });
    // A round just restarted here (nothing filled in) never replaces one played halfway elsewhere.
    const fresh = { day: TODAY, i: 0, marks: [0, 0, 0], points: 0, secs: 0 };
    const halfway = { day: TODAY, i: 1, marks: [1, 0, 2], points: 9, secs: 41 };
    expect(mergeJson({ progress: fresh }, { progress: halfway })).toEqual({ progress: halfway });
    expect(mergeJson({ daily: { [TODAY]: { best: 0, tries: 1, open: true } } }, { daily: { [TODAY]: { best: 4, tries: 1, open: true, times: [33] } } })).toEqual({
      daily: { [TODAY]: { best: 4, tries: 1, open: true, times: [33] } },
    });
    expect(mergeJson({ progress: { day: '2026-10-19', i: 4 } }, { progress: theirs })).toEqual({ progress: theirs });
    expect(mergeJson({}, { progress: theirs })).toEqual({ progress: theirs });
  });

  it('keeps the smaller "fastest" time that is set, and joins lists of seen words', () => {
    expect(mergeJson({ fastest: 0, best: 3 }, { fastest: 12, best: 1 })).toEqual({ fastest: 12, best: 3 });
    expect(mergeJson({ fastest: 9 }, { fastest: 12 })).toEqual({ fastest: 9 });
    expect(mergeJson({ seen: ['a', 'b'] }, { seen: ['b', 'c'] })).toEqual({ seen: ['a', 'b', 'c'] });
  });

  it('merges the arcade save field by field: rounds, bests in the right direction, dailies and game dailies', () => {
    const a = emptySave();
    a.games.fussbox = { plays: 4, best: { score: 50, tests: 6 }, last: 100 };
    a.daily[TODAY] = { best: 10, done: false };
    a.gameDailies[TODAY] = ['fussbox'];
    const b = emptySave();
    b.games.fussbox = { plays: 6, best: { score: 40, tests: 3 }, last: 50 };
    b.games.gloop = { plays: 1, best: { score: 9 }, last: 70 };
    b.daily[TODAY] = { best: 30, done: true };
    b.gameDailies[TODAY] = ['gloop', 'fussbox'];
    b.gameDailies['2026-10-19'] = ['whatsit'];
    const m = mergeSaves(a, b, GAMES, TODAY);
    expect(m.games.fussbox).toEqual({ plays: 6, best: { score: 50, tests: 3 }, last: 100 });
    expect(m.games.gloop?.plays).toBe(1);
    expect(m.daily[TODAY]).toEqual({ best: 30, done: true });
    expect(m.gameDailies[TODAY]?.sort()).toEqual(['fussbox', 'gloop']);
    expect(m.gameDailies['2026-10-19']).toEqual(['whatsit']);
    // Through the text merge too; a broken copy loses to the good one.
    const merged = sanitizeSave(JSON.parse(mergeSaveText(SAVE_KEY, JSON.stringify(a), JSON.stringify(b), TODAY)));
    expect(merged.gameDailies[TODAY]?.length).toBe(2);
    expect(mergeSaveText('glitchbound.gloop', '{broken', '{"best":1}')).toBe('{"best":1}');
  });
});

/* ------------------------------------------------------------------ the API and the engine */

type Handler = (ctx: Ctx) => Promise<Response>;

describe('cloud saves', () => {
  let env: Env;
  let db: ReturnType<typeof memoryD1>;
  let cookie = '';
  let userId = '';
  // The engine watches storage writes for the whole page (it is installed once); this writes around it.
  const protoSet = Storage.prototype.setItem;
  let requests: { method: string; path: string; body: unknown }[];

  async function call<T>(handler: Handler, path: string, body?: unknown, who = cookie): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { origin: ORIGIN, cookie: who };
    const init: RequestInit = body === undefined ? { headers } : { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) };
    const res = await handler({ request: new Request(`${ORIGIN}${path}`, init), env, params: {} });
    return { status: res.status, data: (await res.json()) as T };
  }
  const row = (key: string) => db.sqlite.prepare('SELECT data, updated_at AS at FROM game_saves WHERE user_id = ? AND key = ?').get(userId, key) as { data: string; at: number } | undefined;

  beforeEach(async () => {
    db = memoryD1();
    env = { DB: db, NR_DB: {} as Env['NR_DB'], ADMIN_EMAILS: '' };
    const s = await signIn(env, new Request(ORIGIN), { sub: 'dev:p@example.com', email: 'p@example.com', name: 'p', givenName: '', picture: '', provider: 'email' });
    cookie = s.cookie.split(';')[0]!;
    userId = s.user.id;
    requests = [];
    // The browser's fetch, answered by the real handlers.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init: RequestInit = {}) => {
        const method = init.method ?? 'GET';
        requests.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
        const handler = method === 'POST' ? postSaves : getSaves;
        const headers = { origin: ORIGIN, cookie, 'content-type': 'application/json' };
        return handler({ request: new Request(`${ORIGIN}${path}`, { method, headers, body: init.body }), env, params: {} });
      }),
    );
    localStorage.clear();
  });
  afterEach(() => {
    stopCloudSave();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('the API', () => {
    it('stores a save, returns it, and refuses an older device’s copy as a conflict', async () => {
      const first = await call<{ saved: { key: string; at: number }[] }>(postSaves, '/api/saves', { items: [{ key: 'glitchbound.gloop', data: '{"best":1}', base: 0 }] });
      expect(first.status).toBe(200);
      const at = first.data.saved[0]!.at;
      expect(row('glitchbound.gloop')).toEqual({ data: '{"best":1}', at });
      // A device that grew from that version may replace it.
      const second = await call<{ saved: { at: number }[] }>(postSaves, '/api/saves', { items: [{ key: 'glitchbound.gloop', data: '{"best":2}', base: at }] });
      const at2 = second.data.saved[0]!.at;
      expect(at2).toBeGreaterThan(at);
      // One still on the first version may not: it gets the newer copy back to merge.
      const stale = await call<{ saved: unknown[]; conflicts: { key: string; data: string; at: number }[] }>(postSaves, '/api/saves', {
        items: [{ key: 'glitchbound.gloop', data: '{"best":9}', base: at }],
      });
      expect(stale.data.saved).toEqual([]);
      expect(stale.data.conflicts).toEqual([{ key: 'glitchbound.gloop', data: '{"best":2}', at: at2 }]);
      expect(row('glitchbound.gloop')!.data).toBe('{"best":2}');
      const all = await call<{ saves: { key: string }[] }>(getSaves, '/api/saves?since=0');
      expect(all.data.saves.map((s) => s.key)).toEqual(['glitchbound.gloop']);
      expect((await call<{ saves: unknown[] }>(getSaves, `/api/saves?since=${at2}`)).data.saves).toEqual([]);
    });

    it('deletes, guards keys, sizes and sign-in, and tells /api/me when saves last changed', async () => {
      expect((await call(postSaves, '/api/saves', { items: [{ key: 'glitchbound.sync', data: '{}', base: 0 }] })).status).toBe(400);
      expect((await call(postSaves, '/api/saves', { items: [{ key: 'glitchbound.gloop', data: '{oops', base: 0 }] })).status).toBe(400);
      expect((await call(postSaves, '/api/saves', { items: [{ key: 'glitchbound.gloop', data: `"${'x'.repeat(MAX_SYNCED_SAVE)}"`, base: 0 }] })).status).toBe(413);
      expect((await call(postSaves, '/api/saves', { items: [{ key: 'glitchbound.gloop', data: '{}', base: 0 }] }, '')).status).toBe(401);
      const saved = await call<{ saved: { at: number }[] }>(postSaves, '/api/saves', { items: [{ key: SAVE_KEY, data: '{"v":1}', base: 0 }] });
      const me = await call<{ user: Me }>(getMe, '/api/me');
      expect(me.data.user.savesAt).toBe(saved.data.saved[0]!.at);
      await call(postSaves, '/api/saves', { items: [{ key: SAVE_KEY, data: null, base: saved.data.saved[0]!.at }] });
      expect(row(SAVE_KEY)).toBeUndefined();
      expect((await call<{ user: Me }>(getMe, '/api/me')).data.user.savesAt).toBe(0);
    });

    it('clears saves nobody touched for half a year, and deleting the account deletes them', async () => {
      db.sqlite.prepare('INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)').run(userId, 'glitchbound.whatsit', '{}', Date.now() - 200 * 86_400_000);
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await call(postSaves, '/api/saves', { items: [{ key: 'glitchbound.gloop', data: '{}', base: 0 }] });
      expect(row('glitchbound.whatsit')).toBeUndefined();
      expect(row('glitchbound.gloop')).toBeDefined();
      const del = await handlerWithMethod(deleteMe, 'DELETE');
      expect(del).toBe(200);
      expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM game_saves').get()).toEqual({ n: 0 });
    });

    async function handlerWithMethod(handler: Handler, method: string): Promise<number> {
      const res = await handler({ request: new Request(`${ORIGIN}/api/me`, { method, headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' }, body: '{}' }), env, params: {} });
      return res.status;
    }
  });

  describe('the engine', () => {
    /** Switches "device": this browser's storage is swapped for another device's. */
    const devices = new Map<string, Record<string, string>>();
    let current = 'A';
    function snapshot(): Record<string, string> {
      const out: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) out[localStorage.key(i)!] = localStorage.getItem(localStorage.key(i)!)!;
      return out;
    }
    async function useDevice(name: string): Promise<void> {
      stopCloudSave();
      devices.set(current, snapshot());
      localStorage.clear();
      for (const [k, v] of Object.entries(devices.get(name) ?? {})) protoSet.call(localStorage, k, v);
      current = name;
      await startCloudSave(userId, savesAt());
    }
    const savesAt = (): number => (db.sqlite.prepare('SELECT MAX(updated_at) AS at FROM game_saves WHERE user_id = ?').get(userId) as { at: number | null }).at ?? 0;
    /** Lets the engine's 8-second timers fire and its requests finish (sign-in checks hash with real async crypto). */
    async function settle(): Promise<void> {
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(10_000);
        for (let j = 0; j < 20; j++) await new Promise((r) => setImmediate(r));
      }
    }

    beforeEach(() => {
      devices.clear();
      current = 'A';
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('a daily half-played on one device carries on on another, and a cleared browser gets it back', async () => {
      await startCloudSave(userId, 0);
      const progress = JSON.stringify({ best: 0, daily: { [TODAY]: { best: 0, tries: 1, times: [], open: true } }, progress: { day: TODAY, i: 1, marks: [1, 0], times: [41], points: 9, phase: 'play', secs: 12 } });
      localStorage.setItem('glitchbound.star-grid', progress);
      const arcade = emptySave();
      arcade.gameDailies[TODAY] = ['fussbox'];
      localStorage.setItem(SAVE_KEY, JSON.stringify(arcade));
      await settle();
      expect(row('glitchbound.star-grid')!.data).toBe(progress);
      // Only changes are sent, after the player paused for a moment: one request for both saves.
      expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);

      await useDevice('B');
      expect(localStorage.getItem('glitchbound.star-grid')).toBe(progress);
      expect(sanitizeSave(JSON.parse(localStorage.getItem(SAVE_KEY)!)).gameDailies[TODAY]).toEqual(['fussbox']);

      // The browser throws its storage away (not the game or the player): the next visit restores it all.
      stopCloudSave();
      localStorage.clear();
      await startCloudSave(userId, savesAt());
      expect(localStorage.getItem('glitchbound.star-grid')).toBe(progress);
    });

    it('downloads only when the account has something newer, and sends only real changes', async () => {
      await startCloudSave(userId, 0);
      localStorage.setItem('glitchbound.gloop', '{"best":3}');
      await settle();
      stopCloudSave();
      await startCloudSave(userId, savesAt());
      await settle();
      requests = [];
      // A visit with nothing new on the account: no download.
      stopCloudSave();
      await startCloudSave(userId, savesAt());
      // A game writing the same save again: nothing to send.
      localStorage.setItem('glitchbound.gloop', '{"best":3}');
      await settle();
      expect(requests).toEqual([]);
    });

    it('two devices that both played merge instead of overwriting each other', async () => {
      await startCloudSave(userId, 0);
      localStorage.setItem('glitchbound.whatsit', JSON.stringify({ best: 10, daily: { '2026-10-19': { score: 10, solved: true } } }));
      await settle();
      await useDevice('B');
      await useDevice('A');
      // A plays today while B, still on yesterday's copy, finishes something else offline.
      localStorage.setItem('glitchbound.whatsit', JSON.stringify({ best: 30, daily: { '2026-10-19': { score: 10, solved: true }, [TODAY]: { score: 30, solved: true } } }));
      await settle();
      const atA = row('glitchbound.whatsit')!.at;
      devices.set('A', snapshot());
      stopCloudSave();
      localStorage.clear();
      for (const [k, v] of Object.entries(devices.get('B')!)) protoSet.call(localStorage, k, v);
      current = 'B';
      await startCloudSave(userId, 0); // offline at start: no download, so B pushes from its old version
      localStorage.setItem('glitchbound.whatsit', JSON.stringify({ best: 12, rounds: 7, daily: { '2026-10-19': { score: 10, solved: true }, '2026-10-18': { score: 12, solved: true } } }));
      await settle();
      const merged = JSON.parse(row('glitchbound.whatsit')!.data) as { best: number; rounds: number; daily: Record<string, unknown> };
      expect(row('glitchbound.whatsit')!.at).toBeGreaterThan(atA);
      expect(merged.best).toBe(30);
      expect(merged.rounds).toBe(7);
      expect(Object.keys(merged.daily).sort()).toEqual(['2026-10-18', '2026-10-19', TODAY]);
      expect(JSON.parse(localStorage.getItem('glitchbound.whatsit')!)).toEqual(merged);
    });

    it('a copy from another device waits until the running game closes, then merges', async () => {
      await startCloudSave(userId, 0);
      localStorage.setItem('glitchbound.gut-check', JSON.stringify({ best: 2, daily: {} }));
      await settle();
      // Another device saves a newer copy.
      const at = row('glitchbound.gut-check')!.at;
      await call(postSaves, '/api/saves', { items: [{ key: 'glitchbound.gut-check', data: JSON.stringify({ best: 8, daily: { [TODAY]: { best: 8, tries: 1 } } }), base: at }] });
      const release = holdGame('gut-check');
      stopCloudSave();
      await startCloudSave(userId, savesAt());
      // Not written under the running game...
      expect(JSON.parse(localStorage.getItem('glitchbound.gut-check')!).best).toBe(2);
      localStorage.setItem('glitchbound.gut-check', JSON.stringify({ best: 3, daily: {}, muted: true }));
      await settle();
      expect(JSON.parse(row('glitchbound.gut-check')!.data).best).toBe(8);
      // ...and joined with what the game saved once it closes.
      release();
      await settle();
      const local = JSON.parse(localStorage.getItem('glitchbound.gut-check')!) as { best: number; muted: boolean; daily: Record<string, unknown> };
      expect(local).toEqual({ best: 8, daily: { [TODAY]: { best: 8, tries: 1 } }, muted: true });
      expect(JSON.parse(row('glitchbound.gut-check')!.data)).toEqual(local);
    });

    it('guest progress joins the account at the first sign-in; deleting data in the app deletes the copy', async () => {
      localStorage.setItem('glitchbound.fussbox', JSON.stringify({ best: 5, daily: { [TODAY]: { score: 5, open: false } } }));
      await call(postSaves, '/api/saves', { items: [{ key: 'glitchbound.fussbox', data: JSON.stringify({ best: 9, daily: { '2026-10-19': { score: 9 } } }), base: 0 }] });
      await startCloudSave(userId, savesAt());
      await settle();
      const both = JSON.parse(row('glitchbound.fussbox')!.data) as { best: number; daily: Record<string, unknown> };
      expect(both.best).toBe(9);
      expect(Object.keys(both.daily).sort()).toEqual(['2026-10-19', TODAY]);
      localStorage.removeItem('glitchbound.fussbox');
      await settle();
      expect(row('glitchbound.fussbox')).toBeUndefined();
      expect(hashText('abc')).not.toBe(hashText('abd'));
    });
  });
});

describe('the save gate', () => {
  it('lets games start at once without an account, and waits for a member’s download', async () => {
    let ready = false;
    await savesReady(50);
    let finish: () => void = () => undefined;
    setSavesGate(new Promise<void>((r) => (finish = r)));
    const waiting = savesReady(5000).then(() => (ready = true));
    await Promise.resolve();
    expect(ready).toBe(false);
    finish();
    await waiting;
    expect(ready).toBe(true);
  });
});
