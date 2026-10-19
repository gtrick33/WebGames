import { NAME_MAX as CHALLENGE_NAME_MAX } from '../src/platform/challenge';
import { challengeRow, isClosed, newChallenge, startStatements, takeSeat, tooManyToday, type SEAT_ERRORS } from './challenges';
import type { Env } from './http';
import { openRoom, roomSummary } from './rooms';

/**
 * The Discord Activity (docs/discord-activity.md): signing players in with their Discord account,
 * and the one challenge or Crass Act room that everyone in a Discord call shares.
 */

const API = 'https://discord.com/api/v10';
/** Longest name the games take (src/platform/playerName.ts NAME_MAX). */
const NAME_MAX = 14;
/** A call's challenge or room is forgotten after this long without anyone picking it. */
export const INSTANCE_KEEP_MS = 2 * 86400_000;

export const ACTIVITY_GAMES = ['wait-what', 'crass-act'] as const;
export type ActivityGame = (typeof ACTIVITY_GAMES)[number];
export const isActivityGame = (v: unknown): v is ActivityGame => ACTIVITY_GAMES.includes(v as ActivityGame);

/** Both the client ID (public, wrangler.toml) and the client secret (a Pages secret) are set. */
export const discordReady = (env: Env): env is Env & { DISCORD_CLIENT_ID: string; DISCORD_CLIENT_SECRET: string } => /^\d{15,25}$/.test(env.DISCORD_CLIENT_ID ?? '') && !!env.DISCORD_CLIENT_SECRET;

/** Where the Activity runs: Discord's proxy for this application (see functions/api/_middleware.ts). */
export const activityOrigin = (clientId: string): string => `https://${clientId}.discordsays.com`;

/** Discord's instance ids are opaque; this only keeps them to a sane shape. */
export const validInstance = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(v);

/** A Discord name cleaned like challenge names, cut to what the games show without splitting an emoji. */
function fit(v: unknown): string {
  if (typeof v !== 'string') return '';
  const whole = [...v].filter((ch) => ch.charCodeAt(0) >= 32).join('').replace(/\s+/g, ' ').trim();
  let out = '';
  for (const ch of whole) {
    if ([...out].length >= NAME_MAX || out.length + ch.length > CHALLENGE_NAME_MAX) break;
    out += ch;
  }
  return out.trim();
}

/** The name players see: Discord's display name, else the username. */
export function displayName(u: { global_name?: unknown; username?: unknown }): string {
  return fit(u.global_name) || fit(u.username) || 'Player';
}

/**
 * The player's key for challenges and rooms: the same for a Discord account on every device, and
 * impossible to work out without the client secret. It is an ordinary guest key (`g:<key>`).
 */
export async function playerKeyFor(secret: string, discordId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`glitchbound-player:${discordId}`)));
  return `dc${btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 30)}`;
}

/** Thrown when Discord refuses the code or the token (the message is a short reason code). */
export class DiscordAuthError extends Error {}

/**
 * Exchanges the code from the Activity's `authorize` command for an access token, then asks Discord
 * whose token it is (the identity comes from Discord, never from the browser).
 */
export async function exchangeCode(clientId: string, secret: string, code: string, fetcher: typeof fetch = fetch): Promise<{ accessToken: string; user: { id: string; name: string } }> {
  const res = await fetcher('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: 'authorization_code', code }).toString(),
  });
  const token = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!res.ok || typeof token?.access_token !== 'string') throw new DiscordAuthError(res.status >= 500 ? 'discord_unavailable' : 'bad_code');
  const me = await fetcher(`${API}/users/@me`, { headers: { authorization: `Bearer ${token.access_token}` } });
  const user = (await me.json().catch(() => null)) as { id?: unknown; username?: unknown; global_name?: unknown } | null;
  if (!me.ok || typeof user?.id !== 'string' || !/^\d{5,25}$/.test(user.id)) throw new DiscordAuthError(me.status >= 500 ? 'discord_unavailable' : 'bad_token');
  return { accessToken: token.access_token, user: { id: user.id, name: displayName(user) } };
}

/* ------------------------------------------------- one game per call */

const refOf = async (env: Env, instance: string, game: ActivityGame): Promise<string | null> =>
  (await env.DB.prepare('SELECT ref FROM discord_instances WHERE instance_id = ? AND game = ?').bind(instance, game).first<{ ref: string }>())?.ref ?? null;

/**
 * Points the call at `ref`, unless someone else pointed it elsewhere since we read `was` (null: it
 * had nothing yet). Compare-and-swap, so two players starting at the same moment end up together.
 */
const claim = (env: Env, instance: string, game: ActivityGame, ref: string, was: string | null, now: number) =>
  env.DB.prepare(
    `INSERT INTO discord_instances (instance_id, game, ref, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (instance_id, game) DO UPDATE SET ref = excluded.ref, updated_at = excluded.updated_at WHERE discord_instances.ref = ?5`,
  ).bind(instance, game, ref, now, was ?? '');

const touch = (env: Env, instance: string, game: ActivityGame, now: number) => env.DB.prepare('UPDATE discord_instances SET updated_at = ? WHERE instance_id = ? AND game = ?').bind(now, instance, game).run();

/** Forgets calls nobody has picked a game in for a while. */
export const sweepInstances = (env: Env, now = Date.now()) => env.DB.prepare('DELETE FROM discord_instances WHERE updated_at < ?').bind(now - INSTANCE_KEEP_MS).run();

/**
 * The call's Wait, What? challenge, with this player seated: the first player starts a fresh one
 * (and hosts it), everyone after joins it; one that has ended is replaced by a new one.
 */
export async function challengeForCall(env: Env, instance: string, player: string, name: string, now = Date.now()): Promise<{ id: string } | { error: keyof typeof SEAT_ERRORS | 'too_many' | 'try_again' }> {
  const game = 'wait-what';
  for (let attempt = 0; attempt < 3; attempt++) {
    const was = await refOf(env, instance, game);
    const row = was ? await challengeRow(env, was) : null;
    if (row && !(await isClosed(env, row, now))) {
      const seat = await takeSeat(env, row, player, name);
      if (!('error' in seat)) {
        await touch(env, instance, game, now);
        return { id: row.id };
      }
      if (seat.error === 'full') return seat;
      continue; // it ended just now: start the next one
    }
    if (await tooManyToday(env, player, now)) return { error: 'too_many' };
    const c = newChallenge(game, 'fresh', null, player, name, now);
    // One transaction: the call points at the new challenge and it is created, or neither happens.
    const ours = { sql: 'EXISTS (SELECT 1 FROM discord_instances WHERE instance_id = ? AND game = ? AND ref = ?)', values: [instance, game, c.id] };
    await env.DB.batch([claim(env, instance, game, c.id, was, now), ...startStatements(env, c, ours)]);
    if ((await refOf(env, instance, game)) === c.id) return { id: c.id };
    // Someone in the call started one at the same moment: join theirs.
  }
  return { error: 'try_again' };
}

/** The call's Crass Act room: the first player opens it, everyone after gets the same code. */
export async function roomForCall(env: Env, instance: string, now = Date.now()): Promise<{ code: string } | { error: 'rooms_unavailable' }> {
  const game = 'crass-act';
  const was = await refOf(env, instance, game);
  if (was && (await roomSummary(env, was))) {
    await touch(env, instance, game, now);
    return { code: was };
  }
  const room = await openRoom(env);
  if (!room) return { error: 'rooms_unavailable' };
  await claim(env, instance, game, room.code, was, now).run();
  // Lost a race: the other room wins (ours is never used and closes by itself).
  return { code: (await refOf(env, instance, game)) ?? room.code };
}

export type CallGames = Record<ActivityGame, { ref: string; players: number } | null>;

/** What is already running in a call, for the picker ("Wait, What? · 3 playing"). */
export async function callGames(env: Env, instance: string): Promise<CallGames> {
  const { results } = await env.DB.prepare('SELECT game, ref FROM discord_instances WHERE instance_id = ?').bind(instance).all<{ game: string; ref: string }>();
  const ref = (g: ActivityGame): string | null => results.find((r) => r.game === g)?.ref ?? null;
  const challenge = async (id: string | null): Promise<CallGames['wait-what']> => {
    const row = id ? await challengeRow(env, id) : null;
    if (!row || (await isClosed(env, row))) return null;
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM challenge_players WHERE challenge_id = ? AND left_at IS NULL').bind(row.id).first<{ n: number }>();
    return { ref: row.id, players: n?.n ?? 0 };
  };
  const room = async (code: string | null): Promise<CallGames['crass-act']> => {
    const s = code ? await roomSummary(env, code) : null;
    return s && code ? { ref: code, players: s.players } : null;
  };
  const [w, u] = await Promise.all([challenge(ref('wait-what')), room(ref('crass-act'))]);
  return { 'wait-what': w, 'crass-act': u };
}
