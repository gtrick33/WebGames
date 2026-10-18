import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest as middleware } from '../functions/api/_middleware';
import { onRequestPost as closeIt } from '../functions/api/challenges/[id]/close';
import { onRequestGet as status, onRequestPost as play } from '../functions/api/discord/play';
import { onRequestPost as token } from '../functions/api/discord/token';
import { challengeForCall, displayName, INSTANCE_KEEP_MS, playerKeyFor } from '../server/discord';
import type { Ctx, Env, RoomNamespace } from '../server/http';
import { sameOrigin } from '../server/http';
import { validKey } from '../src/games/unhinged/engine';
import { playerKey, setPlayerKey } from '../src/platform/challenges';
import { isDiscordLaunch } from '../src/platform/embed';
import { matchRoute } from '../src/router/router';
import { memoryD1 } from './d1';

const ORIGIN = 'https://glitchbound.test';
const CLIENT_ID = '123456789012345678';
const SECRET = 'test-client-secret';
const INSTANCE = 'i-1300000000000000000-gc-900000000000000001-900000000000000002';

/** A stand-in for the rooms worker: rooms exist from /init until `close(code)`. */
function fakeRooms() {
  const rooms = new Map<string, number>();
  const ns: RoomNamespace = {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: async (input) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        const code = String(id);
        if (url.pathname === '/init') {
          if (rooms.has(code)) return new Response('{}', { status: 409 });
          rooms.set(code, 0);
        } else if (!rooms.has(code)) return new Response('{}', { status: 404 });
        return new Response(JSON.stringify({ code, phase: 'lobby', players: rooms.get(code), host: '', full: false }));
      },
    }),
  };
  return { ns, rooms };
}

describe('Discord Activity: names and keys', () => {
  it('derives one key per Discord account that works for challenges and rooms', async () => {
    const a = await playerKeyFor(SECRET, '111111111111111111');
    expect(a).toBe(await playerKeyFor(SECRET, '111111111111111111'));
    expect(a).not.toBe(await playerKeyFor(SECRET, '222222222222222222'));
    expect(a).not.toBe(await playerKeyFor('another-secret', '111111111111111111'));
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(validKey(a)).toBe(true);
  });

  it('uses the Discord display name, else the username, cut to what games show', () => {
    expect(displayName({ global_name: 'Mira', username: 'mira_99' })).toBe('Mira');
    expect(displayName({ global_name: null, username: 'mira_99' })).toBe('mira_99');
    expect(displayName({ global_name: '  A\u0000very long display name  ' })).toBe('Avery long dis');
    // Never splits an emoji, and stays within what challenge names allow.
    expect(displayName({ global_name: `a${'🐸'.repeat(16)}` })).toBe(`a${'🐸'.repeat(9)}`);
    expect(displayName({ global_name: '\u0001  ', username: 'mira_99' })).toBe('mira_99');
    expect(displayName({})).toBe('Player');
  });
});

describe('Discord Activity: API', () => {
  let db: ReturnType<typeof memoryD1>;
  let env: Env;
  let rooms: ReturnType<typeof fakeRooms>;
  let now = 0;

  beforeEach(() => {
    db = memoryD1();
    rooms = fakeRooms();
    env = { DB: db, NR_DB: {} as Env['NR_DB'], ROOMS: rooms.ns, DISCORD_CLIENT_ID: CLIENT_ID, DISCORD_CLIENT_SECRET: SECRET };
    now = Date.UTC(2026, 9, 18, 12);
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  type Handler = (ctx: Ctx) => Promise<Response>;
  async function call<T>(handler: Handler, path: string, body?: Record<string, unknown>, origin = ORIGIN): Promise<{ status: number; data: T }> {
    const init: RequestInit = body ? { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) } : { headers: { origin } };
    const id = /\/api\/challenges\/([^/]+)/.exec(path)?.[1];
    const res = await handler({ request: new Request(`${ORIGIN}${path}`, init), env, params: id ? { id } : {} });
    return { status: res.status, data: (await res.json()) as T };
  }
  const pick = (game: string, key: string, name: string) => call<{ challenge?: string; room?: string; error?: string; message?: string }>(play, '/api/discord/play', { instanceId: INSTANCE, game, key, name });
  const keyOf = (n: number): string => `discord-test-key-${String(n).padStart(8, '0')}`;
  const rows = (sql: string) => db.sqlite.prepare(sql).all().map((r) => ({ ...r }));

  describe('sign-in', () => {
    const discord = (tokenStatus = 200, meStatus = 200) => {
      const calls: { url: string; body: string; auth: string }[] = [];
      const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, body: String(init?.body ?? ''), auth: new Headers(init?.headers).get('authorization') ?? '' });
        if (url.endsWith('/oauth2/token')) return new Response(JSON.stringify(tokenStatus === 200 ? { access_token: 'tok-abc', token_type: 'Bearer' } : { error: 'invalid_grant' }), { status: tokenStatus });
        return new Response(JSON.stringify(meStatus === 200 ? { id: '111111111111111111', username: 'mira_99', global_name: 'Mira' } : { message: '401: Unauthorized' }), { status: meStatus });
      });
      vi.stubGlobal('fetch', fetcher);
      return calls;
    };

    it('exchanges the code with Discord and returns the token, the Discord name and the player key', async () => {
      const calls = discord();
      const { status: code, data } = await call<{ access_token: string; user: { id: string; name: string }; key: string }>(token, '/api/discord/token', { code: 'authcode123' });
      expect(code).toBe(200);
      expect(data).toEqual({ access_token: 'tok-abc', user: { id: '111111111111111111', name: 'Mira' }, key: await playerKeyFor(SECRET, '111111111111111111') });
      const sent = new URLSearchParams(calls[0]!.body);
      expect(calls[0]!.url).toBe('https://discord.com/api/oauth2/token');
      expect(Object.fromEntries(sent)).toEqual({ client_id: CLIENT_ID, client_secret: SECRET, grant_type: 'authorization_code', code: 'authcode123' });
      expect(calls[1]).toMatchObject({ url: 'https://discord.com/api/v10/users/@me', auth: 'Bearer tok-abc' });
      expect(JSON.stringify(data)).not.toContain(SECRET);
    });

    it('refuses codes Discord rejects, and says so when Discord is down', async () => {
      discord(400);
      expect(await call(token, '/api/discord/token', { code: 'authcode123' })).toEqual({ status: 401, data: { error: 'bad_code' } });
      discord(200, 401);
      expect(await call(token, '/api/discord/token', { code: 'authcode123' })).toEqual({ status: 401, data: { error: 'bad_token' } });
      discord(503);
      expect((await call(token, '/api/discord/token', { code: 'authcode123' })).status).toBe(502);
    });

    it('checks the request before calling Discord', async () => {
      const calls = discord();
      expect((await call(token, '/api/discord/token', { code: 'no spaces!' })).status).toBe(400);
      expect((await call(token, '/api/discord/token', { code: 'authcode123' }, 'https://evil.example')).status).toBe(403);
      env.DISCORD_CLIENT_SECRET = undefined;
      expect(await call(token, '/api/discord/token', { code: 'authcode123' })).toEqual({ status: 503, data: { error: 'discord_not_configured' } });
      expect(calls).toHaveLength(0);
    });
  });

  describe('one Wait, What? challenge per call', () => {
    it('lets the first player start it and seats everyone after in the same one', async () => {
      const a = await pick('wait-what', keyOf(1), 'Mira');
      const b = await pick('wait-what', keyOf(2), 'Theo');
      expect(a.status).toBe(200);
      expect(b.data.challenge).toBe(a.data.challenge);
      expect(rows('SELECT game, mode, host FROM challenges')).toEqual([{ game: 'wait-what', mode: 'fresh', host: `g:${keyOf(1)}` }]);
      expect(rows('SELECT player, name FROM challenge_players ORDER BY joined_at')).toEqual([
        { player: `g:${keyOf(1)}`, name: 'Mira' },
        { player: `g:${keyOf(2)}`, name: 'Theo' },
      ]);
      // Picking again keeps the seat.
      expect((await pick('wait-what', keyOf(2), 'Theo')).data.challenge).toBe(a.data.challenge);
      expect(rows('SELECT COUNT(*) AS n FROM challenge_players')).toEqual([{ n: 2 }]);
      const st = await call<{ games: Record<string, { ref: string; players: number } | null> }>(status, `/api/discord/play?instanceId=${INSTANCE}`);
      expect(st.data.games).toEqual({ 'wait-what': { ref: a.data.challenge, players: 2 }, unhinged: null });
    });

    it('keeps two players who pick at the same moment together', async () => {
      const [a, b] = await Promise.all([challengeForCall(env, INSTANCE, `g:${keyOf(1)}`, 'Mira'), challengeForCall(env, INSTANCE, `g:${keyOf(2)}`, 'Theo')]);
      expect(a).toEqual(b);
      expect(rows('SELECT COUNT(*) AS n FROM challenges')).toEqual([{ n: 1 }]);
      expect(rows('SELECT COUNT(*) AS n FROM challenge_players')).toEqual([{ n: 2 }]);
    });

    it('starts a new one when the call’s challenge has ended', async () => {
      const first = (await pick('wait-what', keyOf(1), 'Mira')).data.challenge!;
      await pick('wait-what', keyOf(2), 'Theo');
      await call(closeIt, `/api/challenges/${first}/close`, { key: keyOf(1) });
      const next = await pick('wait-what', keyOf(2), 'Theo');
      expect(next.data.challenge).toBeTruthy();
      expect(next.data.challenge).not.toBe(first);
      expect(rows(`SELECT host FROM challenges WHERE id = '${next.data.challenge}'`)).toEqual([{ host: `g:${keyOf(2)}` }]);
    });

    it('tells the 7th player the challenge is full', async () => {
      for (let i = 1; i <= 6; i++) expect((await pick('wait-what', keyOf(i), `P${i}`)).status).toBe(200);
      expect(await pick('wait-what', keyOf(7), 'P7')).toMatchObject({ status: 409, data: { error: 'full', message: 'This challenge already has 6 players.' } });
    });

    it('needs a valid call, game and player', async () => {
      expect((await call(play, '/api/discord/play', { instanceId: 'bad id!', game: 'wait-what', key: keyOf(1), name: 'Mira' })).status).toBe(400);
      expect((await call(play, '/api/discord/play', { instanceId: INSTANCE, game: 'neon-rush', key: keyOf(1), name: 'Mira' })).status).toBe(400);
      expect((await pick('wait-what', 'short', 'Mira')).data.error).toBe('name_required');
      env.DISCORD_CLIENT_ID = undefined;
      expect((await pick('wait-what', keyOf(1), 'Mira')).status).toBe(503);
    });
  });

  describe('one Unhinged room per call', () => {
    it('opens a room for the first player and hands everyone the same code', async () => {
      const a = await pick('unhinged', keyOf(1), 'Mira');
      const b = await pick('unhinged', keyOf(2), 'Theo');
      expect(a.data.room).toMatch(/^[A-HJKMNP-Z]{5}$/);
      expect(b.data.room).toBe(a.data.room);
      expect(rooms.rooms.size).toBe(1);
    });

    it('opens a new room once the call’s room has closed', async () => {
      const a = (await pick('unhinged', keyOf(1), 'Mira')).data.room!;
      rooms.rooms.delete(a);
      const b = (await pick('unhinged', keyOf(1), 'Mira')).data.room!;
      expect(b).not.toBe(a);
      expect(rows('SELECT ref FROM discord_instances')).toEqual([{ ref: b }]);
    });

    it('says so when rooms are unavailable', async () => {
      env.ROOMS = undefined;
      expect(await pick('unhinged', keyOf(1), 'Mira')).toEqual({ status: 503, data: { error: 'rooms_unavailable' } });
    });
  });

  it('forgets calls nobody has used for two days', async () => {
    await pick('wait-what', keyOf(1), 'Mira');
    db.sqlite.prepare("INSERT INTO discord_instances (instance_id, game, ref, updated_at) VALUES ('old-call', 'unhinged', 'ABCDE', ?)").run(now - INSTANCE_KEEP_MS - 5000);
    await pick('wait-what', keyOf(2), 'Theo');
    expect(rows('SELECT instance_id FROM discord_instances')).toEqual([{ instance_id: INSTANCE }]);
  });

  describe('origin of requests through Discord’s proxy', () => {
    const through = async (origin: string): Promise<Request> => {
      let seen: Request | undefined;
      await middleware({
        request: new Request(`${ORIGIN}/api/challenges`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{"a":1}' }),
        env,
        next: async (r) => {
          seen = r;
          return new Response('ok');
        },
      });
      return seen ?? new Request(`${ORIGIN}/api/challenges`, { method: 'POST', headers: { origin } });
    };

    it('treats this app’s discordsays.com origin as the site itself', async () => {
      const r = await through(`https://${CLIENT_ID}.discordsays.com`);
      expect(sameOrigin(r)).toBe(true);
      expect(await r.text()).toBe('{"a":1}');
    });

    it('leaves other origins alone, other Discord apps included', async () => {
      expect(sameOrigin(await through('https://999999999999999999.discordsays.com'))).toBe(false);
      expect(sameOrigin(await through('https://evil.example'))).toBe(false);
      env.DISCORD_CLIENT_ID = undefined;
      expect(sameOrigin(await through(`https://${CLIENT_ID}.discordsays.com`))).toBe(false);
    });
  });
});

describe('Discord Activity: in the browser', () => {
  it('recognises Discord’s launch address', () => {
    expect(isDiscordLaunch('?instance_id=i-1&frame_id=f-2&platform=desktop&guild_id=3')).toBe(true);
    expect(isDiscordLaunch('?frame_id=f-2&platform=desktop')).toBe(false);
    expect(isDiscordLaunch('')).toBe(false);
    expect(matchRoute('/discord')).toEqual({ name: 'discord' });
  });

  it('plays challenges and rooms with the key the server handed out', () => {
    const own = playerKey();
    setPlayerKey('not a key!');
    expect(playerKey()).toBe(own);
    setPlayerKey('dcAbCdEfGhIjKlMnOpQrStUvWxYz0123');
    expect(playerKey()).toBe('dcAbCdEfGhIjKlMnOpQrStUvWxYz0123');
  });
});
