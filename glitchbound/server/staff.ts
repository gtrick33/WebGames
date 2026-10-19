/**
 * The QA team: admins invite testers by email, block, unblock or remove them (table staff). An
 * invitation is a one-time link; it only works for an account signed in with the invited address.
 */
import type { StaffRow } from '../src/platform/apiTypes';
import { arcadeEmail } from './arcadeMail';
import { emailEnabled, sendBatch } from './email';
import { randomToken, sha256, siteUrl, type Env } from './http';
import type { UserRow } from './session';

export const INVITE_DAYS = 7;

export interface StaffDb {
  email: string;
  role: string;
  status: 'invited' | 'active' | 'blocked';
  user_id: string | null;
  invite_hash: string | null;
  invite_expires: number | null;
  invited_by: string;
  invited_at: number;
  accepted_at: number | null;
  updated_by: string;
  updated_at: number;
}

/**
 * SQL that keeps a users row (alias `u`) on the public boards: not banned, not a QA account (testers'
 * scores are test scores) and not an admin (the boards are for players; a studio account holding
 * most of the crowns makes a young arcade look like a private one). Their own rows still show to them.
 */
export function listed(env: Pick<Env, 'ADMIN_EMAILS'>): string {
  const base = `u.banned_at IS NULL AND NOT EXISTS (SELECT 1 FROM staff st WHERE st.user_id = u.id)`;
  const admins = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((e) => `'${e.replace(/'/g, "''")}'`);
  return admins.length ? `${base} AND lower(u.email) NOT IN (${admins.join(', ')})` : base;
}

/** a***@example.com, for showing which address an invitation is for without spelling it out. */
export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(6, name.length - 1)))}@${domain}`;
}

export function inviteMail(base: string, email: string, token: string, by: string) {
  const url = `${base}/admin?join=${encodeURIComponent(token)}`;
  const { html, text } = arcadeEmail({
    kicker: 'QA TEAM INVITE',
    title: 'You’re invited to test GlitchBound',
    intro: [
      `${by} added you to the GlitchBound QA team. As a tester you can play hidden and unreleased games, look up players, give coins, ban cheaters and email players from hello@glitchboundstudio.com.`,
      `Open the link below and sign in with this address (${email}). The invitation works once and expires in ${INVITE_DAYS} days.`,
    ],
    outro: ['Please note: everything you do as a QA tester (every request and every action) is recorded and kept for legal and safety reasons.'],
    link: { label: 'JOIN THE QA TEAM', url },
    signoff: 'Thanks for helping,\nThe GlitchBound team',
    footer: 'You got this because a GlitchBound admin invited this address to the QA team. If it was not meant for you, just ignore it.',
  });
  return { to: email, subject: 'You’re invited to the GlitchBound QA team', html, text };
}

/**
 * Creates (or renews) an invitation and emails it. The token only ever exists in the email (local
 * development without email gets the link back instead, see functions/api/admin/staff.ts).
 */
export async function inviteStaff(env: Env, request: Request, email: string, admin: UserRow, now = Date.now()): Promise<{ sent: boolean; link: string }> {
  const token = randomToken(24);
  const by = admin.nickname || admin.email;
  await env.DB.prepare(
    `INSERT INTO staff (email, role, status, user_id, invite_hash, invite_expires, invited_by, invited_at, accepted_at, updated_by, updated_at)
     VALUES (?, 'qa', 'invited', NULL, ?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT (email) DO UPDATE SET invite_hash = excluded.invite_hash, invite_expires = excluded.invite_expires, invited_by = excluded.invited_by,
       invited_at = excluded.invited_at, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  )
    .bind(email, await sha256(token), now + INVITE_DAYS * 86400_000, admin.email, now, admin.email, now)
    .run();
  const mail = inviteMail(siteUrl(env, request), email, token, by);
  const link = `${siteUrl(env, request)}/admin?join=${encodeURIComponent(token)}`;
  if (!emailEnabled(env)) return { sent: false, link };
  await sendBatch(env, [mail]);
  return { sent: true, link };
}

export async function findInvite(env: Env, token: string, now = Date.now()): Promise<StaffDb | null> {
  if (!token || token.length > 100) return null;
  const row = await env.DB.prepare(`SELECT * FROM staff WHERE invite_hash = ?`).bind(await sha256(token)).first<StaffDb>();
  return row && row.status === 'invited' && (row.invite_expires ?? 0) > now ? row : null;
}

/** Accepts an invitation for the signed-in user. Their email must be the invited one. */
export async function acceptInvite(env: Env, token: string, user: UserRow, now = Date.now()): Promise<'ok' | 'invalid' | 'wrong_account' | 'taken'> {
  const invite = await findInvite(env, token, now);
  if (!invite) return 'invalid';
  if (invite.email !== user.email.toLowerCase()) return 'wrong_account';
  const other = await env.DB.prepare('SELECT email FROM staff WHERE user_id = ? AND email != ?').bind(user.id, invite.email).first();
  if (other) return 'taken';
  await env.DB.prepare(`UPDATE staff SET status = 'active', user_id = ?, invite_hash = NULL, invite_expires = NULL, accepted_at = ?, updated_by = ?, updated_at = ? WHERE email = ?`)
    .bind(user.id, now, user.email.toLowerCase(), now, invite.email)
    .run();
  return 'ok';
}

/** The QA team for the admin's QA team tab, with each tester's latest activity. */
export async function listStaff(env: Env, now = Date.now()): Promise<StaffRow[]> {
  const rows = await env.DB.prepare(
    `SELECT st.*, u.nickname AS nickname,
       (SELECT MAX(ts) FROM qa_audit a WHERE a.actor_id = st.user_id) AS last_activity,
       (SELECT COUNT(*) FROM qa_audit a WHERE a.actor_id = st.user_id AND a.kind = 'action' AND a.ts > ?) AS actions_30d
     FROM staff st LEFT JOIN users u ON u.id = st.user_id ORDER BY st.invited_at DESC`,
  )
    .bind(now - 30 * 86400_000)
    .all<StaffDb & { nickname: string | null; last_activity: number | null; actions_30d: number }>();
  return rows.results.map((r) => ({
    email: r.email,
    status: r.status === 'invited' && (r.invite_expires ?? 0) <= now ? 'expired' : r.status,
    userId: r.user_id,
    nickname: r.nickname,
    invitedBy: r.invited_by,
    invitedAt: r.invited_at,
    acceptedAt: r.accepted_at,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
    lastActivity: r.last_activity,
    actions30d: r.actions_30d,
  }));
}
