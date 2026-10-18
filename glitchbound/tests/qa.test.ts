import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest as middleware } from '../functions/api/_middleware';
import { onRequestGet as auditTrail } from '../functions/api/admin/qa-audit';
import { onRequestGet as staffList, onRequestPost as staffChange } from '../functions/api/admin/staff';
import { onRequestPost as devSignIn } from '../functions/api/auth/dev';
import { onRequestPost as claimCoins } from '../functions/api/coins/claim';
import { onRequestGet as leaderboard } from '../functions/api/leaderboard';
import { onRequestGet as getMe } from '../functions/api/me';
import { onRequestPost as accept } from '../functions/api/qa/accept';
import { onRequestPost as ban } from '../functions/api/qa/ban';
import { onRequestPost as giveCoins } from '../functions/api/qa/coins';
import { onRequestPost as emailPlayer } from '../functions/api/qa/email';
import { onRequestGet as inviteInfo } from '../functions/api/qa/invite';
import { onRequestPost as qaLog } from '../functions/api/qa/log';
import { onRequestGet as findPlayers } from '../functions/api/qa/players';
import { onRequestGet as openPlayer } from '../functions/api/qa/players/[id]';
import { onRequestPost as resetProgress } from '../functions/api/qa/reset';
import { redactQuery } from '../server/audit';
import type { Ctx, Env } from '../server/http';
import { maskEmail } from '../server/staff';
import { signIn } from '../server/signin';
import type { AuditRow, LeaderRow, Me, QaPlayer, QaPlayerRow, StaffRow } from '../src/platform/apiTypes';
import { deviceKeysFor } from '../src/platform/qa';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';
const ADMIN = 'boss@example.com';
type Handler = (ctx: Ctx) => Promise<Response>;

describe('QA role', () => {
  let db: ReturnType<typeof memoryD1>;
  let env: Env;
  let mails: { from: string; to: string[]; subject: string; text: string }[];

  beforeEach(() => {
    db = memoryD1();
    env = { DB: db, NR_DB: {} as Env['NR_DB'], ADMIN_EMAILS: ADMIN, RESEND_API_KEY: 'test-key', MAIL_FROM: 'GlitchBound <hello@glitchboundstudio.com>', DEV_LOGIN: '1' };
    mails = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        mails.push(...(JSON.parse(String(init.body)) as typeof mails));
        return new Response('{}');
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** One API call, through the /api middleware like on Cloudflare (so the audit trail is written). */
  async function call<T>(handler: Handler, path: string, opts: { cookie?: string; body?: unknown; id?: string } = {}): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { origin: ORIGIN, 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'QA-Test-Browser/1.0' };
    if (opts.cookie) headers.cookie = opts.cookie;
    const init: RequestInit = opts.body === undefined ? { headers } : { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(opts.body) };
    const request = new Request(`${ORIGIN}${path}`, init);
    const params: Record<string, string> = opts.id ? { id: opts.id } : {};
    const res = await middleware({ request, env, params, next: (r?: Request) => handler({ request: r ?? request, env, params }) });
    const text = await res.text();
    return { status: res.status, data: (text.startsWith('{') ? JSON.parse(text) : text) as T };
  }
  const signInAs = async (email: string): Promise<{ cookie: string; id: string }> => {
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: `dev:${email}`, email, name: email.split('@')[0]!, givenName: '', picture: '', provider: 'email' });
    return { cookie: cookie.split(';')[0]!, id: user.id };
  };
  const audit = () => db.sqlite.prepare('SELECT * FROM qa_audit ORDER BY id').all() as unknown as { actor_email: string; kind: string; action: string; target_id: string | null; detail: string; status: number; ip: string; user_agent: string }[];
  const inviteToken = (to: string): string => {
    const mail = [...mails].reverse().find((m) => m.to[0] === to)!;
    return decodeURIComponent(/join=([^\s"&<]+)/.exec(mail.text)![1]!);
  };

  /** An admin, a QA tester who accepted their invitation and a regular player. */
  async function team() {
    const admin = await signInAs(ADMIN);
    const qa = await signInAs('tester@example.com');
    const player = await signInAs('player@example.com');
    await call(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'invite', email: 'Tester@Example.com' } });
    const joined = await call<{ user: Me }>(accept, '/api/qa/accept', { cookie: qa.cookie, body: { token: inviteToken('tester@example.com') } });
    expect(joined.data.user.role).toBe('qa');
    return { admin, qa, player };
  }

  it('invites a tester by email; the link works once, and only for that address', async () => {
    const admin = await signInAs(ADMIN);
    const sent = await call<{ sent: boolean; staff: StaffRow[] }>(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'invite', email: 'tester@example.com' } });
    expect(sent.status).toBe(200);
    expect(sent.data.sent).toBe(true);
    expect(sent.data.staff.map((s) => [s.email, s.status])).toEqual([['tester@example.com', 'invited']]);
    expect(mails[0]!.to).toEqual(['tester@example.com']);
    expect(mails[0]!.text).toContain('/admin?join=');
    expect(mails[0]!.text).toMatch(/recorded/);
    const token = inviteToken('tester@example.com');
    expect(db.sqlite.prepare('SELECT invite_hash FROM staff').get()).not.toEqual({ invite_hash: token });

    expect((await call<{ valid: boolean; email: string }>(inviteInfo, `/api/qa/invite?token=${encodeURIComponent(token)}`)).data).toMatchObject({ valid: true, email: maskEmail('tester@example.com') });
    const stranger = await signInAs('someone@example.com');
    const wrong = await call<{ error: string; message: string }>(accept, '/api/qa/accept', { cookie: stranger.cookie, body: { token } });
    expect(wrong.status).toBe(403);
    expect(wrong.data.message).toContain('t*****@example.com');

    const tester = await signInAs('tester@example.com');
    expect((await call(accept, '/api/qa/accept', { cookie: tester.cookie, body: { token } })).status).toBe(200);
    expect((await call<{ user: Me }>(getMe, '/api/me', { cookie: tester.cookie })).data.user.role).toBe('qa');
    expect((await call(accept, '/api/qa/accept', { cookie: tester.cookie, body: { token } })).status).toBe(404);
    expect((await call<{ staff: StaffRow[] }>(staffList, '/api/admin/staff', { cookie: admin.cookie })).data.staff[0]).toMatchObject({ status: 'active', nickname: 'tester' });
    // Admins already have every tool; QA can't manage the team.
    expect((await call(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'invite', email: ADMIN } })).status).toBe(409);
    expect((await call(staffChange, '/api/admin/staff', { cookie: tester.cookie, body: { action: 'invite', email: 'x@example.com' } })).status).toBe(403);
  });

  it('hands the invitation link back only in local development without email', async () => {
    const admin = await signInAs(ADMIN);
    env.RESEND_API_KEY = undefined;
    const local = await call<{ sent: boolean; devLink?: string }>(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'invite', email: 'tester@example.com' } });
    expect(local.data).toMatchObject({ sent: false, devLink: expect.stringContaining('/admin?join=') });
    env.DEV_LOGIN = undefined;
    const live = await call<{ sent: boolean; devLink?: string }>(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'invite', email: 'other@example.com' } });
    expect(live.data.sent).toBe(false);
    expect(live.data.devLink).toBeUndefined();
  });

  it('opens the QA tools to admins and QA testers only', async () => {
    const { admin, qa, player } = await team();
    expect((await call(findPlayers, '/api/qa/players')).status).toBe(401);
    expect((await call(findPlayers, '/api/qa/players', { cookie: player.cookie })).status).toBe(403);
    expect((await call(findPlayers, '/api/qa/players', { cookie: admin.cookie })).status).toBe(200);
    const found = await call<{ players: QaPlayerRow[] }>(findPlayers, '/api/qa/players?q=player@', { cookie: qa.cookie });
    expect(found.data.players.map((p) => p.email)).toEqual(['player@example.com']);
    expect((await call<{ user: Me }>(getMe, '/api/me', { cookie: player.cookie })).data.user.role).toBeNull();
    expect((await call<{ user: Me }>(getMe, '/api/me', { cookie: admin.cookie })).data.user.role).toBe('admin');
  });

  it('gives coins for a game with a wallet; the game collects them exactly once', async () => {
    const { qa, player } = await team();
    expect((await call(giveCoins, '/api/qa/coins', { cookie: qa.cookie, body: { userId: player.id, game: 'wing-it', amount: 100 } })).status).toBe(400);
    expect((await call(giveCoins, '/api/qa/coins', { cookie: qa.cookie, body: { userId: player.id, game: 'mini-racer', amount: 0 } })).status).toBe(400);
    const given = await call<{ player: QaPlayer }>(giveCoins, '/api/qa/coins', { cookie: qa.cookie, body: { userId: player.id, game: 'mini-racer', amount: 500, note: 'Refund' } });
    expect(given.data.player.grants).toMatchObject([{ game: 'mini-racer', amount: 500, note: 'Refund', by: 'tester@example.com', claimedAt: null }]);
    await call(giveCoins, '/api/qa/coins', { cookie: qa.cookie, body: { userId: player.id, game: 'mini-racer', amount: 250 } });
    await call(giveCoins, '/api/qa/coins', { cookie: qa.cookie, body: { userId: player.id, game: 'neon-rush', amount: 40 } });

    expect((await call(claimCoins, '/api/coins/claim', { body: { game: 'mini-racer' } })).status).toBe(401);
    expect((await call(claimCoins, '/api/coins/claim', { cookie: player.cookie, body: { game: 'mini-racer' } })).data).toEqual({ amount: 750, notes: ['Refund'] });
    expect((await call(claimCoins, '/api/coins/claim', { cookie: player.cookie, body: { game: 'mini-racer' } })).data).toEqual({ amount: 0, notes: [] });
    expect((await call(claimCoins, '/api/coins/claim', { cookie: player.cookie, body: { game: 'neon-rush' } })).data).toMatchObject({ amount: 40 });
  });

  it('bans: signed out everywhere, no sign-in, off the leaderboards; unbanning undoes it', async () => {
    const { admin, qa, player } = await team();
    db.sqlite.prepare(`INSERT INTO bests (user_id, game, score, stats, at) VALUES (?, 'wing-it', 42, '{}', 1)`).run(player.id);
    const board = async (cookie?: string) => (await call<{ rows: LeaderRow[]; mine: LeaderRow | null }>(leaderboard, '/api/leaderboard?game=wing-it', { cookie })).data;
    expect((await board()).rows.map((r) => r.score)).toEqual([42]);

    expect((await call(ban, '/api/qa/ban', { cookie: qa.cookie, body: { userId: player.id, banned: true } })).status).toBe(400);
    const banned = await call<{ player: QaPlayer }>(ban, '/api/qa/ban', { cookie: qa.cookie, body: { userId: player.id, banned: true, reason: 'Impossible scores' } });
    expect(banned.data.player.ban).toMatchObject({ reason: 'Impossible scores', by: 'tester@example.com' });
    expect((await call<{ user: Me | null }>(getMe, '/api/me', { cookie: player.cookie })).data.user).toBeNull();
    const again = await call<{ error: string; message: string }>(devSignIn, '/api/auth/dev', { body: { email: 'player@example.com', name: 'Player' } });
    expect(again.status).toBe(403);
    expect(again.data.error).toBe('banned');
    expect((await board()).rows).toEqual([]);

    // Nobody bans an admin, QA can't ban QA, and you can't ban yourself.
    const adminId = (db.sqlite.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN) as { id: string }).id;
    const qaId = (db.sqlite.prepare('SELECT id FROM users WHERE email = ?').get('tester@example.com') as { id: string }).id;
    expect((await call(ban, '/api/qa/ban', { cookie: qa.cookie, body: { userId: adminId, banned: true, reason: 'x' } })).status).toBe(403);
    expect((await call(ban, '/api/qa/ban', { cookie: qa.cookie, body: { userId: qaId, banned: true, reason: 'x' } })).status).toBe(400);
    const second = await signInAs('second@example.com');
    await call(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'invite', email: 'second@example.com' } });
    await call(accept, '/api/qa/accept', { cookie: second.cookie, body: { token: inviteToken('second@example.com') } });
    expect((await call(ban, '/api/qa/ban', { cookie: qa.cookie, body: { userId: second.id, banned: true, reason: 'x' } })).status).toBe(403);
    expect(audit().at(-2)).toMatchObject({ action: 'player.ban', target_id: second.id, status: 403 });
    expect((await call(ban, '/api/qa/ban', { cookie: admin.cookie, body: { userId: adminId, banned: true, reason: 'x' } })).status).toBe(400);

    expect((await call(ban, '/api/qa/ban', { cookie: admin.cookie, body: { userId: player.id, banned: false, reason: 'Appeal accepted' } })).status).toBe(200);
    expect((await call(devSignIn, '/api/auth/dev', { body: { email: 'player@example.com', name: 'Player' } })).status).toBe(200);
    expect((await board()).rows.map((r) => r.score)).toEqual([42]);
  });

  it('emails a player from hello@glitchboundstudio.com and keeps a copy on their record', async () => {
    const { qa, player } = await team();
    mails = [];
    const sent = await call<{ player: QaPlayer }>(emailPlayer, '/api/qa/email', { cookie: qa.cookie, body: { userId: player.id, subject: 'About your car', message: 'Your coins are back.\n\nSorry!' } });
    expect(sent.status).toBe(200);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ from: 'GlitchBound <hello@glitchboundstudio.com>', to: ['player@example.com'], subject: 'About your car' });
    expect(mails[0]!.text).toContain('Your coins are back.');
    expect(sent.data.player.emails).toMatchObject([{ subject: 'About your car', by: 'tester@example.com', ok: true }]);
    expect((await call(emailPlayer, '/api/qa/email', { cookie: qa.cookie, body: { userId: player.id, subject: '', message: 'x' } })).status).toBe(400);
  });

  it('records every QA request and action (with IP and browser), never the admins’, and never forgets', async () => {
    const { admin, qa, player } = await team();
    const before = audit().length;
    await call(findPlayers, '/api/qa/players?q=player', { cookie: admin.cookie });
    await call(giveCoins, '/api/qa/coins', { cookie: admin.cookie, body: { userId: player.id, game: 'mini-racer', amount: 5 } });
    expect(audit()).toHaveLength(before);

    await call(openPlayer, `/api/qa/players/${player.id}`, { cookie: qa.cookie, id: player.id });
    await call(giveCoins, '/api/qa/coins', { cookie: qa.cookie, body: { userId: player.id, game: 'mini-racer', amount: 7 } });
    await call(qaLog, '/api/qa/log', { cookie: qa.cookie, body: { action: 'clear_device_game', detail: { game: 'wing-it', token: 'secret-123' } } });
    await call(getMe, '/api/me', { cookie: qa.cookie });
    const rows = audit().slice(before);
    expect(rows.every((r) => r.actor_email === 'tester@example.com' && r.ip === '203.0.113.7' && r.user_agent === 'QA-Test-Browser/1.0')).toBe(true);
    expect(rows.map((r) => `${r.kind} ${r.action} ${r.status ?? ''}`.trim())).toEqual([
      `action player.view`,
      `request GET /api/qa/players/${player.id} 200`,
      'action coins.grant',
      'request POST /api/qa/coins 200',
      'action tool.clear_device_game',
      'request POST /api/qa/log 200',
      'request GET /api/me 200',
    ]);
    expect(rows.find((r) => r.action === 'coins.grant')).toMatchObject({ target_id: player.id });
    expect(rows.map((r) => r.detail).join('')).not.toContain('secret-123');
    // The sign-in that joined the team is on record too.
    expect(audit().some((r) => r.kind === 'auth' && r.action === 'qa.joined')).toBe(true);
    // Append-only.
    expect(() => db.sqlite.exec('DELETE FROM qa_audit')).toThrow(/append-only/);
    expect(() => db.sqlite.exec(`UPDATE qa_audit SET action = 'nothing'`)).toThrow(/append-only/);

    // Admins read it (QA can't), filtered and as a spreadsheet-safe CSV.
    expect((await call(auditTrail, '/api/admin/qa-audit', { cookie: qa.cookie })).status).toBe(403);
    const actions = await call<{ rows: AuditRow[] }>(auditTrail, '/api/admin/qa-audit?kind=action&actor=tester@example.com', { cookie: admin.cookie });
    expect(actions.data.rows.map((r) => r.action)).toEqual(['tool.clear_device_game', 'coins.grant', 'player.view']);
    await call(emailPlayer, '/api/qa/email', { cookie: qa.cookie, body: { userId: player.id, subject: '=HYPERLINK("x")', message: 'Hi' } });
    const csv = await call<string>(auditTrail, '/api/admin/qa-audit?format=csv', { cookie: admin.cookie });
    expect(csv.data.split('\n')[0]).toBe('id,time_utc,qa_email,kind,action,target_id,target_email,status,ip,user_agent,detail');
    expect(csv.data).toContain('email.send');
    expect(csv.data).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('blocking takes QA access away at once (and keeps recording); removing ends both', async () => {
    const { admin, qa } = await team();
    await call(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'block', email: 'tester@example.com' } });
    const blocked = await call(findPlayers, '/api/qa/players', { cookie: qa.cookie });
    expect(blocked.status).toBe(403);
    expect(audit().at(-1)).toMatchObject({ kind: 'request', action: 'GET /api/qa/players', status: 403 });
    await call(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'unblock', email: 'tester@example.com' } });
    expect((await call(findPlayers, '/api/qa/players', { cookie: qa.cookie })).status).toBe(200);
    await call(staffChange, '/api/admin/staff', { cookie: admin.cookie, body: { action: 'remove', email: 'tester@example.com' } });
    const count = audit().length;
    expect((await call(findPlayers, '/api/qa/players', { cookie: qa.cookie })).status).toBe(403);
    expect(audit()).toHaveLength(count);
  });

  it('keeps QA test scores off the public boards, and resets only the tester’s own progress', async () => {
    const { qa, player } = await team();
    const qaId = (db.sqlite.prepare('SELECT id FROM users WHERE email = ?').get('tester@example.com') as { id: string }).id;
    for (const [id, score] of [
      [qaId, 999],
      [player.id, 50],
    ] as const) {
      db.sqlite.prepare(`INSERT INTO bests (user_id, game, score, stats, at) VALUES (?, 'wing-it', ?, '{}', 1)`).run(id, score);
      db.sqlite.prepare(`INSERT INTO runs (id, user_id, game, started_at, status, score) VALUES (?, ?, 'wing-it', 1, 'ok', ?)`).run(`run-${id}`, id, score);
    }
    const seenBy = async (cookie: string) => (await call<{ rows: LeaderRow[]; mine: LeaderRow | null }>(leaderboard, '/api/leaderboard?game=wing-it', { cookie })).data;
    expect((await seenBy(player.cookie)).rows.map((r) => r.score)).toEqual([50]);
    expect((await seenBy(qa.cookie)).mine).toMatchObject({ score: 999, rank: 1 });
    expect((await call<{ user: Me }>(getMe, '/api/me', { cookie: player.cookie })).data.user.bests['wing-it']).toMatchObject({ rank: 1, players: 1 });

    await call(resetProgress, '/api/qa/reset', { cookie: qa.cookie, body: { scope: 'game', game: 'wing-it' } });
    expect(db.sqlite.prepare('SELECT user_id FROM bests').all()).toEqual([{ user_id: player.id }]);
    expect(db.sqlite.prepare('SELECT user_id FROM runs').all()).toEqual([{ user_id: player.id }]);
    expect((await call(resetProgress, '/api/qa/reset', { cookie: player.cookie, body: { scope: 'all' } })).status).toBe(403);
  });

  it('keeps secrets out of the trail and finds a game’s keys on this device', () => {
    expect(redactQuery('?token=abc&game=wing-it')).toBe('?token=%5Bredacted%5D&game=wing-it');
    expect(redactQuery('')).toBeUndefined();
    const keys = ['gb.mini-racer.v1', 'gb.mini-racer.ghost.sunny-bay', 'glitchbound.save', 'glitchbound.wing-it', 'neonrush.save', 'other.mini-racer'];
    expect(deviceKeysFor('mini-racer', keys)).toEqual(['gb.mini-racer.v1', 'gb.mini-racer.ghost.sunny-bay']);
    expect(deviceKeysFor('neon-rush', keys)).toEqual(['neonrush.save']);
  });
});
