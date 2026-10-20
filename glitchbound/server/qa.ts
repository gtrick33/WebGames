/**
 * What QA testers (and admins) can do to a player account: look it up, give coins for a game,
 * ban or unban it, and email the player from the site's address. Endpoints in functions/api/qa.
 */
import { getGame } from '../src/catalog/catalog';
import { GAMES } from '../src/catalog/games';
import type { QaPlayer, QaPlayerRow } from '../src/platform/apiTypes';
import { levelForXp } from '../src/platform/progression';
import { arcadeEmail } from './arcadeMail';
import { emailEnabled, sendBatch } from './email';
import type { Env } from './http';
import { isAdmin, type Role, type UserRow } from './session';

export const COIN_MAX = 100_000;
export const SUBJECT_MAX = 120;
export const MESSAGE_MAX = 5000;
export const REASON_MAX = 300;
/** QA testers can email this many players an hour (admins have no limit). */
export const QA_EMAILS_PER_HOUR = 30;

/** Games with a coin wallet (registry `wallet`), the ones QA can give coins for. */
export const WALLET_GAMES = GAMES.filter((g) => g.wallet).map((g) => g.slug);

type PlayerDb = UserRow & { staff_status: string | null };

function roleFor(env: Env, u: PlayerDb): Role | null {
  if (isAdmin(env, u)) return 'admin';
  return u.staff_status === 'active' ? 'qa' : null;
}

function row(env: Env, u: PlayerDb): QaPlayerRow {
  return { id: u.id, nickname: u.nickname, email: u.email, level: levelForXp(u.xp), createdAt: u.created_at, lastSeen: u.last_seen, banned: !!u.banned_at, role: roleFor(env, u) };
}

const PLAYER_SQL = `SELECT u.*, st.status AS staff_status FROM users u LEFT JOIN staff st ON st.user_id = u.id`;

export async function getPlayer(env: Env, id: string): Promise<PlayerDb | null> {
  if (!id || id.length > 64) return null;
  return env.DB.prepare(`${PLAYER_SQL} WHERE u.id = ?`).bind(id).first<PlayerDb>();
}

/** Players whose email, nickname or id matches (exact id or email first, then partial matches). */
export async function searchPlayers(env: Env, q: string): Promise<QaPlayerRow[]> {
  const term = q.trim().slice(0, 80);
  if (!term) {
    const recent = await env.DB.prepare(`${PLAYER_SQL} ORDER BY u.last_seen DESC LIMIT 20`).all<PlayerDb>();
    return recent.results.map((u) => row(env, u));
  }
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const res = await env.DB.prepare(
    `${PLAYER_SQL} WHERE u.id = ? OR u.email LIKE ? ESCAPE '\\' OR u.nickname LIKE ? ESCAPE '\\'
     ORDER BY (u.id = ? OR lower(u.email) = lower(?)) DESC, u.last_seen DESC LIMIT 25`,
  )
    .bind(term, like, like, term, term)
    .all<PlayerDb>();
  return res.results.map((u) => row(env, u));
}

export async function playerDetail(env: Env, u: PlayerDb): Promise<QaPlayer> {
  const [rounds, bests, runs, grants, emails] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM runs WHERE user_id = ? AND status = 'ok'`).bind(u.id).first<{ n: number }>(),
    env.DB.prepare('SELECT game, score, at FROM bests WHERE user_id = ? ORDER BY at DESC').bind(u.id).all<{ game: string; score: number; at: number }>(),
    env.DB.prepare('SELECT game, score, status, COALESCE(ended_at, started_at) AS at FROM runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 15').bind(u.id).all<{ game: string; score: number | null; status: string; at: number }>(),
    env.DB.prepare('SELECT * FROM coin_grants WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(u.id).all<{ id: string; game: string; amount: number; note: string; granted_by: string; created_at: number; claimed_at: number | null }>(),
    env.DB.prepare('SELECT subject, body, sent_by, sent_at, ok FROM player_emails WHERE user_id = ? ORDER BY sent_at DESC LIMIT 30').bind(u.id).all<{ subject: string; body: string; sent_by: string; sent_at: number; ok: number }>(),
  ]);
  return {
    ...row(env, u),
    xp: u.xp,
    rounds: rounds?.n ?? 0,
    ban: u.banned_at ? { at: u.banned_at, reason: u.ban_reason ?? '', by: u.banned_by ?? '' } : null,
    bests: bests.results,
    runs: runs.results,
    grants: grants.results.map((g) => ({ id: g.id, game: g.game, amount: g.amount, note: g.note, by: g.granted_by, at: g.created_at, claimedAt: g.claimed_at })),
    emails: emails.results.map((e) => ({ subject: e.subject, body: e.body, by: e.sent_by, at: e.sent_at, ok: !!e.ok })),
  };
}

/** Admins and QA testers can't be banned (or emailed a ban) by QA; admins can't be banned at all. */
export function protectedFrom(env: Env, actorRole: Role, target: PlayerDb): string | null {
  const role = roleFor(env, target);
  if (role === 'admin') return 'Admins can’t be banned.';
  if (role === 'qa' && actorRole !== 'admin') return 'QA testers can’t ban other QA accounts. Ask an admin.';
  return null;
}

export async function setBan(env: Env, target: PlayerDb, banned: boolean, reason: string, by: string, now = Date.now()): Promise<void> {
  if (banned) {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET banned_at = ?, ban_reason = ?, banned_by = ? WHERE id = ?').bind(now, reason, by, target.id),
      // Signed out everywhere, straight away.
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id),
    ]);
  } else {
    await env.DB.prepare(`UPDATE users SET banned_at = NULL, ban_reason = '', banned_by = '' WHERE id = ?`).bind(target.id).run();
  }
}

export interface CoinGrantInput {
  game: string;
  amount: number;
  note: string;
}

/** Checks a grant; returns the clean grant or an error message. */
export function checkGrant(body: Record<string, unknown> | null): CoinGrantInput | string {
  const game = typeof body?.game === 'string' ? getGame(body.game) : undefined;
  if (!game || !game.wallet) return 'Pick a game that has coins.';
  const amount = typeof body?.amount === 'number' && Number.isInteger(body.amount) ? body.amount : NaN;
  if (!(amount >= 1 && amount <= COIN_MAX)) return `Give between 1 and ${COIN_MAX.toLocaleString('en')} coins.`;
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : '';
  return { game: game.slug, amount, note };
}

export async function grantCoins(env: Env, target: PlayerDb, grant: CoinGrantInput, by: string, now = Date.now()): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO coin_grants (id, user_id, game, amount, note, granted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, target.id, grant.game, grant.amount, grant.note, by, now).run();
  return id;
}

/** Collects every waiting grant for one game, once: the game adds the total to its wallet. */
export async function claimCoins(env: Env, userId: string, game: string, now = Date.now()): Promise<{ amount: number; notes: string[] }> {
  const res = await env.DB.prepare('UPDATE coin_grants SET claimed_at = ? WHERE user_id = ? AND game = ? AND claimed_at IS NULL RETURNING amount, note')
    .bind(now, userId, game)
    .all<{ amount: number; note: string }>();
  return { amount: res.results.reduce((n, g) => n + g.amount, 0), notes: res.results.map((g) => g.note).filter(Boolean) };
}

export function playerMail(target: Pick<UserRow, 'email' | 'nickname'>, subject: string, message: string) {
  const { html, text } = arcadeEmail({
    kicker: 'A MESSAGE FROM GLITCHBOUND',
    title: subject,
    intro: [`Hi ${target.nickname},`, ...message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)],
    signoff: 'The GlitchBound team',
    footer: `You got this because ${target.email} has a GlitchBound account. Questions? Open a ticket under Report a bug on GlitchBound (replies to this email are not read).`,
  });
  return { to: target.email, subject, html, text };
}

export function checkEmail(body: Record<string, unknown> | null): { subject: string; message: string } | string {
  const subject = typeof body?.subject === 'string' ? body.subject.replace(/\s+/g, ' ').trim() : '';
  const message = typeof body?.message === 'string' ? body.message.replace(/\r\n/g, '\n').trim() : '';
  if (!subject || subject.length > SUBJECT_MAX) return `Write a subject (up to ${SUBJECT_MAX} characters).`;
  if (!message || message.length > MESSAGE_MAX) return `Write a message (up to ${MESSAGE_MAX} characters).`;
  return { subject, message };
}

/** Sends the email (from MAIL_FROM, hello@glitchboundstudio.com) and keeps a copy on the player's record. */
export async function emailPlayer(env: Env, target: PlayerDb, subject: string, message: string, by: string, now = Date.now()): Promise<{ ok: boolean; error?: string }> {
  let result: { ok: boolean; error?: string };
  if (!emailEnabled(env)) result = { ok: false, error: 'email_not_configured' };
  else {
    try {
      await sendBatch(env, [playerMail(target, subject, message)]);
      result = { ok: true };
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'send_failed' };
    }
  }
  await env.DB.prepare('INSERT INTO player_emails (id, user_id, to_email, subject, body, sent_by, sent_at, ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), target.id, target.email, subject, message, by, now, result.ok ? 1 : 0)
    .run();
  return result;
}

/**
 * Resets the tester's OWN server-side progress so a flow can be tested again from the start:
 * a game's bests and rounds, or today's daily and quests, or everything.
 */
export async function resetOwnProgress(env: Env, user: UserRow, scope: 'game' | 'today' | 'all', game: string | null, day: string): Promise<void> {
  const db = env.DB;
  if (scope === 'game' && game) {
    await db.batch([
      db.prepare('DELETE FROM bests WHERE user_id = ? AND game = ?').bind(user.id, game),
      db.prepare('DELETE FROM runs WHERE user_id = ? AND game = ?').bind(user.id, game),
      // The game's cloud save ("glitchbound.<slug>", "gb.<slug>.v1"...), so the next device doesn't bring it back.
      db.prepare("DELETE FROM game_saves WHERE user_id = ? AND (key IN (?, ?) OR key LIKE ? OR key LIKE ?)").bind(user.id, `glitchbound.${game}`, `gb.${game}`, `glitchbound.${game}.v%`, `gb.${game}.v%`),
    ]);
  } else if (scope === 'today') {
    await db.batch([
      db.prepare('DELETE FROM dailies WHERE user_id = ? AND day = ?').bind(user.id, day),
      db.prepare('DELETE FROM quest_claims WHERE user_id = ? AND day = ?').bind(user.id, day),
      db.prepare('DELETE FROM runs WHERE user_id = ? AND day = ?').bind(user.id, day),
    ]);
  } else if (scope === 'all') {
    await db.batch(['bests', 'runs', 'dailies', 'quest_claims', 'game_saves'].map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(user.id)).concat([db.prepare('UPDATE users SET xp = 0 WHERE id = ?').bind(user.id)]));
  }
}
