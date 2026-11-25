/**
 * Playtest numbers (POLISH_PLAN.md piece 28): where heroes fall and where players stop, sent through the arcade's own
 * first-party, cookieless analytics with nothing that says who.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as postEvents } from '../functions/api/events';
import type { Ctx, Env } from '../server/http';
import { signIn } from '../server/signin';
import { bugLine, counted, fallProps, modeStopProps, stopProps } from '../src/games/sigilfall/progress/telemetry';
import { bugContext, setBugContext } from '../src/platform/bugContext';
import { memoryD1 } from './d1';
import { readyHero } from './sigilfall-bot';

/** What /api/events keeps of an event's props (functions/api/events.ts): the rest is dropped there. */
const keeps = (props: Record<string, unknown>): boolean =>
  Object.keys(props).length <= 8 && Object.entries(props).every(([k, v]) => /^[a-z_]{1,20}$/.test(k) && (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'boolean' || (typeof v === 'string' && v.length <= 60)));

describe('Sigilfall: playtest numbers', () => {
  it('a fall says where, on which quest, at what level and to which boss, and nothing of who', () => {
    const h = readyHero('warrior', 6);
    h.name = 'Lady Somebody';
    h.quests['the-warden'] = { state: 'active', n: 0 };
    const p = fallProps(h, 'crypt', 'coffin-matron');
    expect(p).toEqual({ game: 'sigilfall', mode: 'story', key: 0, region: 'crypt', quest: 'the-warden', level: 6, boss: 'coffin-matron' });
    expect(keeps(p)).toBe(true);
    expect(JSON.stringify(p)).not.toContain('Somebody');
    expect(fallProps(h, 'whisperwood', null).boss).toBe('');
    // a Riftstone run says so, and which stone
    const run = fallProps(h, 'crypt', 'coffin-matron', 7);
    expect(run).toMatchObject({ mode: 'rift', key: 7 });
    expect(keeps(run)).toBe(true);
  });

  it('a stop says where and after how long', () => {
    const h = readyHero('mage', 12);
    const p = stopProps(h, 'whisperwood', 23.6);
    expect(p).toMatchObject({ game: 'sigilfall', mode: 'story', key: 0, region: 'whisperwood', level: 12, minutes: 24 });
    expect(keeps(p)).toBe(true);
    expect(stopProps(h, null, -3)).toMatchObject({ region: '', minutes: 0 });
    // the Ring and the Vigil draw themselves: a stop there says which and for how long, and has no hero in it
    const ring = modeStopProps('ring', 11.2);
    expect(ring).toEqual({ game: 'sigilfall', mode: 'ring', key: 0, region: '', quest: '', level: 0, minutes: 11 });
    expect(keeps(ring)).toBe(true);
    expect(modeStopProps('vigil', 3).mode).toBe('vigil');
  });

  it('a review hero and a Trial are test play: nothing is sent for them', () => {
    const h = readyHero('warrior', 6);
    expect(counted(h, false)).toBe(true);
    expect(counted(h, true)).toBe(false);
    expect(counted({ ...h, review: true }, false)).toBe(false);
    expect(counted(null, false)).toBe(false);
  });

  it('the arcade keeps the two events: the client may send them and the server stores them', () => {
    const client = readFileSync('src/platform/analytics.ts', 'utf8');
    const server = readFileSync('functions/api/events.ts', 'utf8');
    const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
    for (const name of ['game_fall', 'game_stop']) {
      expect(client).toContain(`'${name}'`);
      expect(server).toContain(`'${name}'`);
      expect(engine).toContain(`track('${name}'`);
    }
  });

  it('a stop is sent when the page is hidden, not only when it is left: a phone hides it and never leaves', () => {
    const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
    const hidden = engine.slice(engine.indexOf('private onVisibility'), engine.indexOf('private sittingFrom'));
    expect(hidden).toContain('this.reportStop()');
    // and the arcade's sender doesn't hold an event back once the page is hidden
    const sink = readFileSync('src/platform/analytics.ts', 'utf8');
    expect(sink).toMatch(/visibilityState === 'hidden'\) flush\(true\)/);
    for (const screen of ['RingScreen', 'VigilScreen']) expect(readFileSync(`src/games/sigilfall/ui/${screen}.tsx`, 'utf8')).toContain('usePlayedMode(engine,');
  });

  it('the arcade stores the two events without the member who sent them, and other events with them', async () => {
    const env: Env = { DB: memoryD1(), NR_DB: {} as Env['NR_DB'] };
    const { user, cookie } = await signIn(env, new Request('http://localhost'), { sub: 'dev:tester@example.test', email: 'tester@example.test', name: 'Tess', givenName: 'Tess', picture: '', provider: 'email' });
    const h = readyHero('warrior', 6);
    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json', cookie: cookie.split(';')[0]!, 'cf-connecting-ip': '203.0.113.9', 'user-agent': 'test' },
      body: JSON.stringify({
        events: [
          { name: 'game_fall', props: fallProps(h, 'crypt', 'coffin-matron') },
          { name: 'game_stop', props: stopProps(h, 'crypt', 12) },
          { name: 'game_stop', props: modeStopProps('ring', 9) },
          { name: 'game_view', props: { game: 'sigilfall' } },
        ],
      }),
    });
    // (one request in a hundred also clears old events, which the endpoint counts: not this one)
    const dice = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const res = await postEvents({ request, env, params: {}, waitUntil: () => undefined } as unknown as Ctx);
    dice.mockRestore();
    expect(await res.json()).toEqual({ ok: true, n: 4 });
    const rows = (await env.DB.prepare('SELECT name, game, user_id, visitor, props FROM events ORDER BY rowid').all<{ name: string; game: string; user_id: string | null; visitor: string; props: string }>()).results;
    expect(rows.map((r) => [r.name, r.user_id])).toEqual([
      ['game_fall', null],
      ['game_stop', null],
      ['game_stop', null],
      ['game_view', user.id],
    ]);
    // everything the game sent is kept as sent, under the game's name, with a visitor key to count players by
    expect(JSON.parse(rows[0]!.props)).toEqual(fallProps(h, 'crypt', 'coffin-matron'));
    expect(JSON.parse(rows[2]!.props)).toEqual(modeStopProps('ring', 9));
    expect(rows.every((r) => r.game === 'sigilfall' && r.visitor.length > 0)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('Tess');
    // and the queries the owner is given read them (docs/ANALYTICS.md): each runs, and finds what was sent
    const doc = readFileSync('docs/ANALYTICS.md', 'utf8');
    const queries = [...doc.matchAll(/^-- .*\n(SELECT[\s\S]*?;)/gm)].map((m) => m[1]!);
    expect(queries.length).toBe(3);
    const [falls, stops, modes] = await Promise.all(queries.map(async (q) => (await env.DB.prepare(q.replace(/;$/, '')).all<Record<string, unknown>>()).results));
    expect(falls).toEqual([{ mode: 'story', quest: fallProps(h, 'crypt', null).quest, boss: 'coffin-matron', falls: 1, players: 1 }]);
    expect(stops).toEqual([{ quest: stopProps(h, 'crypt', 0).quest, players: 1, avg_minutes: 12 }]);
    expect(modes).toEqual(expect.arrayContaining([{ mode: 'story', players: 1, visits: 1, minutes: 12 }, { mode: 'ring', players: 1, visits: 1, minutes: 9 }]));
  });
});

describe('Sigilfall: what a bug report carries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the build, the mode, the land, the quest, the level and the class; never the hero\'s name', () => {
    const h = readyHero('ranger', 14);
    h.name = 'Lady Somebody';
    h.quests['the-warden'] = { state: 'active', n: 0 };
    const line = bugLine('abc1234', h, 'crypt');
    expect(line).toBe('Sigilfall build abc1234 · story · land crypt · quest the-warden · level 14 · ranger');
    expect(line).not.toContain('Somebody');
    expect(bugLine('abc1234', h, 'crypt', 9)).toContain('Riftstone +9');
    expect(bugLine('abc1234', null, null)).toBe('Sigilfall build abc1234 · title screen');
    expect(bugLine('abc1234', h, 'crypt', 0, 'ring')).toBe('Sigilfall build abc1234 · the Ring');
    expect(bugLine('', null, null, 0, 'vigil')).toBe('Sigilfall build dev · the Vigil');
  });

  it('is left on the device for the report page, for that game only, and not for long', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    setBugContext('sigilfall', 'Sigilfall build abc1234 · story · land crypt · level 6 · warrior');
    expect(bugContext('sigilfall')).toBe('Sigilfall build abc1234 · story · land crypt · level 6 · warrior');
    expect(bugContext('quizbelief')).toBe('');
    expect(bugContext('sigilfall', Date.now() + 31 * 60_000)).toBe('');
    // (a line is cut to a length a report can carry)
    setBugContext('sigilfall', 'x'.repeat(500));
    expect(bugContext('sigilfall').length).toBe(160);
    // the page shows it to the player and sends it with what they wrote; the game leaves it whenever it saves
    const page = readFileSync('src/pages/BugReportPage.tsx', 'utf8');
    expect(page).toContain('bugContext(game)');
    expect(page).toContain('In the game: ${where}');
    expect(readFileSync('src/games/sigilfall/engine.ts', 'utf8')).toContain("setBugContext('sigilfall', bugLine(");
  });
});
