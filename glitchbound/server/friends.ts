import type { D1Database } from './http';

/** The games a friend can be invited into, and where the invite leads. */
export const INVITE_PATHS: Record<string, string> = { sigilfall: '/sigilfall?room=' };

export const invitePath = (game: string, code: string): string | null => (INVITE_PATHS[game] ? `${INVITE_PATHS[game]}${encodeURIComponent(code)}` : null);

/**
 * Presence: a player counts as online for this long after their open tab last said it was there. The tab asks for
 * invitations every 45 seconds (src/components/FriendInvites.tsx), Sigilfall every 20 (its engine), and a hidden tab
 * asks for nothing: so "online" means a tab in front of someone in the last two and a half minutes.
 */
export const ONLINE_MS = 150_000;
/** Presence is written at most this often (most asks change nothing worth a write), or at once when the place changes. */
const STAMP_MS = 60_000;

/** Where a player can say they are: a game friends can be invited into, or '' for the site itself. */
export const presencePlace = (v: unknown): string => (typeof v === 'string' && Object.hasOwn(INVITE_PATHS, v) ? v : '');

/** Notes that a signed-in player is here now. Returns whether it wrote. */
export async function stampPresence(env: { DB: D1Database }, user: { id: string; online_at?: number | null; online_in?: string | null }, place: string, now = Date.now()): Promise<boolean> {
  if (now - (user.online_at ?? 0) < STAMP_MS && (user.online_in ?? '') === place) return false;
  await env.DB.prepare('UPDATE users SET online_at = ?, online_in = ? WHERE id = ?').bind(now, place, user.id).run();
  return true;
}

/** What a friend is told: online or not, and the game they are in while they are. */
export const presenceOf = (row: { online_at?: number | null; online_in?: string | null }, now = Date.now()): { online: boolean; onlineIn: string | null } => {
  const online = now - (row.online_at ?? 0) < ONLINE_MS;
  return { online, onlineIn: online && row.online_in ? row.online_in : null };
};
