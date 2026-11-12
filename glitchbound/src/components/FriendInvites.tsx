import { useEffect, useState, useSyncExternalStore } from 'react';
import { getGame } from '../catalog/catalog';
import { useT } from '../i18n';
import { api } from '../platform/account';
import type { FriendInvite } from '../platform/apiTypes';
import { anyInvitesClaimed, inviteClaimsVersion, invitesClaimed, watchInviteClaims } from '../platform/friends';
import { Link } from '../router/router';
import './Pins.css';

/** How often a signed-in player's open tab asks whether a friend wants them. */
const CHECK_MS = 45_000;

/** "Lena wants you in Sigilfall": a friend's invitation, with Join. Quiet while a game fills the screen. */
export function FriendInvites() {
  const t = useT();
  const [invites, setInvites] = useState<FriendInvite[]>([]);
  useEffect(() => {
    let cancelled = false;
    const check = (): void => {
      // (a game open in this tab asks for itself, and says its player is in it: the bar asking too would say, every
      // other time, that they are only on the site)
      if (document.hidden || anyInvitesClaimed()) return;
      api<{ invites: FriendInvite[] }>('/api/friends/invites')
        .then((r) => !cancelled && setInvites(r.invites))
        .catch(() => undefined);
    };
    check();
    const id = window.setInterval(check, CHECK_MS);
    // (the game closed: the bar takes over at once, not up to 45 seconds later)
    const stop = watchInviteClaims(check);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      stop();
    };
  }, []);
  // (a game that shows its invitations inside itself keeps them while it is open: platform/friends.ts)
  useSyncExternalStore(watchInviteClaims, inviteClaimsVersion, inviteClaimsVersion);
  const invite = invites.find((i) => !invitesClaimed(i.game));
  if (!invite) return null;
  const done = (): void => {
    setInvites((list) => list.filter((i) => i.id !== invite.id));
    void api('/api/friends/invites', { body: { id: invite.id } }).catch(() => undefined);
  };
  return (
    <div className="friend-invite-bar" role="status">
      <strong>{t('{name} wants you in {game}', { name: invite.from, game: getGame(invite.game)?.title ?? invite.game })}</strong>
      <Link href={invite.href} className="btn btn-primary btn-sm" onClick={done}>
        {t('Join')}
      </Link>
      <button className="link-btn" onClick={done}>
        {t('Not now')}
      </button>
    </div>
  );
}
