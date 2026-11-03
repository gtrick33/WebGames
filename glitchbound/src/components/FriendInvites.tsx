import { useEffect, useState } from 'react';
import { getGame } from '../catalog/catalog';
import { useT } from '../i18n';
import { api } from '../platform/account';
import type { FriendInvite } from '../platform/apiTypes';
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
      if (document.hidden) return;
      api<{ invites: FriendInvite[] }>('/api/friends/invites')
        .then((r) => !cancelled && setInvites(r.invites))
        .catch(() => undefined);
    };
    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  const invite = invites[0];
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
