import { api } from './account';
import type { FriendInvite, FriendRow, FriendsView } from './apiTypes';

/**
 * The friends list for anything that isn't the Friends page: a game that shows friends inside itself (Sigilfall's
 * party panel) asks through here, so the requests are written once (functions/api/friends.ts has the rules).
 */
export const friendsApi = {
  /** Your code, your friends (with who is online) and your blocks. Signed-in players only. */
  list: (): Promise<FriendsView> => api<FriendsView>('/api/friends'),
  /** Adds whoever gave you this code, both ways and at once. Throws an ApiError with `unknown_code`, `own_code` or `too_many`. */
  add: (code: string): Promise<FriendsView> => api<FriendsView>('/api/friends', { body: { action: 'add', code } }),
  /** Asks a friend into your room. A second ask replaces the first. */
  invite: (id: string, game: string, code: string): Promise<unknown> => api('/api/friends', { body: { action: 'invite', id, game, code } }),
  /**
   * What friends are asking you right now. Asking is also how this tab says its player is here (and, with `where`,
   * in which game): friends see them as online for a couple of minutes after.
   */
  invites: (where = ''): Promise<FriendInvite[]> => api<{ invites: FriendInvite[] }>(`/api/friends/invites${where ? `?in=${encodeURIComponent(where)}` : ''}`).then((r) => r.invites),
  /** Done with an invitation: joined, or turned down. */
  done: (id: number): Promise<unknown> => api('/api/friends/invites', { body: { id } }),
};

/** Online in a game first, then online, then everyone else; by name within each. */
export function byPresence(friends: readonly FriendRow[], game: string): FriendRow[] {
  const rank = (f: FriendRow): number => (f.online ? (f.onlineIn === game ? 0 : 1) : 2);
  return [...friends].sort((a, b) => rank(a) - rank(b) || a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' }));
}

/**
 * A game that shows its own invitations inside itself says so here while it is open, and the site's bar
 * (components/FriendInvites.tsx) leaves those to it: the player is asked once, where they are looking.
 */
const claimed = new Map<string, number>();
const watchers = new Set<() => void>();
let version = 0;
const changed = (): void => {
  version++;
  watchers.forEach((fn) => fn());
};

/** Takes a game's invitations for as long as it is open. Returns how to give them back. */
export function claimInvites(game: string): () => void {
  claimed.set(game, (claimed.get(game) ?? 0) + 1);
  changed();
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    const n = (claimed.get(game) ?? 1) - 1;
    if (n > 0) claimed.set(game, n);
    else claimed.delete(game);
    changed();
  };
}
export const invitesClaimed = (game: string): boolean => claimed.has(game);
/** Is any game asking for itself right now? The site's bar then asks nothing: one tab says where its player is, not two. */
export const anyInvitesClaimed = (): boolean => claimed.size > 0;
export const watchInviteClaims = (fn: () => void): (() => void) => {
  watchers.add(fn);
  return () => void watchers.delete(fn);
};
export const inviteClaimsVersion = (): number => version;
