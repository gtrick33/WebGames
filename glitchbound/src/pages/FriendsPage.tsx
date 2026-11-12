import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CONTACT_PATH } from './infoText';
import { Icon } from '../components/Icon';
import { openSignIn } from '../components/openSignIn';
import '../components/Pins.css';
import { getGame } from '../catalog/catalog';
import { useT } from '../i18n';
import { api, ApiError, useAccount } from '../platform/account';
import type { FriendsView } from '../platform/apiTypes';
import { usePageMeta } from '../platform/meta';
import { shareOrCopy } from '../platform/share';
import { Link, useLocation } from '../router/router';
import { ProfileTabs } from './BugReportPage';
import './InfoPages.css';
import { Banner, LookAvatar } from '../components/Looks';

const ERRORS: Record<string, string> = {
  unknown_code: 'That code doesn’t work. Check it with your friend.',
  own_code: 'That’s your own code.',
  too_many: 'That friends list is full.',
};

/** "2 hours ago", in the page's language. */
function useAgo(): (at: number) => string {
  const t = useT();
  return (at) => {
    const mins = Math.floor((Date.now() - at) / 60_000);
    if (mins < 60) return t('just now');
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('{n} h ago', { n: hours });
    return t('{n} d ago', { n: Math.floor(hours / 24) });
  };
}

export function FriendsPage() {
  usePageMeta({ title: 'Friends', path: '/me/friends' });
  const t = useT();
  const ago = useAgo();
  const { me, status } = useAccount();
  const fromLink = new URLSearchParams(useLocation().search).get('add')?.toUpperCase() ?? '';
  const [view, setView] = useState<FriendsView | null>(null);
  const [linkOwner, setLinkOwner] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; what: 'remove' | 'block' } | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!fromLink) return;
    api<{ nickname: string }>(`/api/friends?code=${encodeURIComponent(fromLink)}`)
      .then((r) => setLinkOwner(r.nickname))
      .catch(() => setNote({ text: t(ERRORS.unknown_code!), error: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLink]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    api<FriendsView>('/api/friends')
      .then((v) => !cancelled && setView(v))
      .catch(() => !cancelled && setNote({ text: t('Friends are offline right now.'), error: true }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const act = useCallback(async (body: Record<string, unknown>, done?: string): Promise<boolean> => {
    setNote(null);
    setConfirm(null);
    try {
      setView(await api<FriendsView>('/api/friends', { body }));
      if (done) setNote({ text: done, error: false });
      return true;
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setNote({ text: t(ERRORS[code ?? ''] ?? 'Could not save.'), error: true });
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFromLink = async (): Promise<void> => {
    if (await act({ action: 'add', code: fromLink }, t('{name} is now your friend.', { name: linkOwner ?? '' }))) setLinkOwner(null);
  };
  const addByCode = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (draft.trim() && (await act({ action: 'add', code: draft }, t('Friend added.')))) setDraft('');
  };
  const shareCode = async (): Promise<void> => {
    if (!view) return;
    const url = `${location.origin}/me/friends?add=${view.code}`;
    const outcome = await shareOrCopy({ title: 'GlitchBound', text: t('Add me on GlitchBound and let’s compare scores.'), url });
    setNote({ text: outcome === 'copied' ? t('Link copied to your clipboard.') : outcome === 'shared' ? t('Shared!') : view.code, error: false });
  };

  const invitedBy = linkOwner && !view?.friends.some((f) => f.nickname === linkOwner) && (
    <section className="panel info-block friend-from-link">
      <strong>{t('{name} wants to compare scores with you.', { name: linkOwner })}</strong>
      {me ? (
        <button className="btn btn-primary" onClick={() => void addFromLink()}>
          {t('Add {name}', { name: linkOwner })}
        </button>
      ) : (
        <button className="btn btn-magenta" onClick={() => openSignIn(t('Sign in to add your friend.'))}>
          {t('Sign in to add')}
        </button>
      )}
    </section>
  );

  if (!me) {
    return (
      <div className="wrap info-page">
        <h1 className="info-title">{t('Friends')}</h1>
        {invitedBy}
        {note && <p className={`friend-note${note.error ? ' is-error' : ''}`}>{note.text}</p>}
        {status !== 'loading' && !invitedBy && (
          <>
            <p className="info-lead">{t('Add friends with a code, beat them on the friends boards and pull them into your games.')}</p>
            <div>
              <button className="btn btn-magenta btn-lg" onClick={() => openSignIn(t('Sign in to add your friends.'))}>
                <Icon name="user" /> {t('Sign in')}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="wrap info-page">
      <ProfileTabs current="friends" />
      <header>
        <h1 className="info-title">{t('Friends')}</h1>
        <p className="info-lead">{t('Friends find you only through your code. Nobody can search for you, and there are no messages.')}</p>
      </header>
      {invitedBy}
      {note && (
        <p className={`friend-note${note.error ? ' is-error' : ''}`} role="status">
          {note.text}
        </p>
      )}

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="f-code">
          <h2 id="f-code">{t('Your code')}</h2>
          <div className="friend-code">
            <strong>{view?.code ?? '········'}</strong>
            <button className="btn btn-primary btn-sm" onClick={() => void shareCode()} disabled={!view}>
              <Icon name="share" size={16} /> {t('Share')}
            </button>
          </div>
          <p className="friend-note">
            {t('Anyone with your code can add you.')}{' '}
            <button className="link-btn" onClick={() => void act({ action: 'new_code' }, t('Your old code no longer works.'))}>
              {t('Get a new code')}
            </button>
          </p>
        </section>
        <section className="panel info-block" aria-labelledby="f-add">
          <h2 id="f-add">{t('Add a friend')}</h2>
          <form className="friend-add" onSubmit={(e) => void addByCode(e)}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={12} placeholder={t('Their code')} aria-label={t('Their code')} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
            <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
              {t('Add')}
            </button>
          </form>
        </section>
      </div>

      <section aria-labelledby="f-list">
        <h2 id="f-list" className="profile-h2">
          {t('Your friends')} {view ? `(${view.friends.length})` : ''}
        </h2>
        {view && view.friends.length === 0 && <p className="friend-note">{t('No friends yet. Share your code, and you’ll see each other on the friends boards.')}</p>}
        <ul className="friend-list">
          {view?.friends.map((f) => {
            const game = f.lastGame ? getGame(f.lastGame) : undefined;
            return (
              <li key={f.id} className={`friend-row${f.banner ? ' has-banner' : ''}`}>
                {f.banner && <Banner id={f.banner} row />}
                <LookAvatar name={f.nickname} size={40} border={f.border} icon={f.icon} />
                <span className="friend-who">
                  <strong>
                    {f.nickname} <span className="board-lvl mono">LV {f.level}</span>
                  </strong>
                  <span>
                    {t(f.rank)} · {t('{n} points', { n: f.points })}
                    {/* here right now (and in which game), else what they last played and when */}
                    {f.online ? (
                      <b className="friend-online"> · {f.onlineIn && getGame(f.onlineIn) ? t('in {game}', { game: getGame(f.onlineIn)!.title }) : t('online now')}</b>
                    ) : game && f.lastAt ? (
                      ` · ${t('played {game} {when}', { game: game.title, when: ago(f.lastAt) })}`
                    ) : (
                      ''
                    )}
                  </span>
                </span>
                <span className="friend-actions">
                  <Link href={`/trophies?friend=${encodeURIComponent(f.id)}`} className="btn btn-sm">
                    {t('Their shelf')}
                  </Link>
                  {confirm?.id === f.id ? (
                    <>
                      <button className="btn btn-sm btn-magenta" onClick={() => void act({ action: confirm.what, id: f.id })}>
                        {confirm.what === 'block' ? t('Yes, block') : t('Yes, remove')}
                      </button>
                      <button className="btn btn-sm" onClick={() => setConfirm(null)}>
                        {t('Cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm" onClick={() => setConfirm({ id: f.id, what: 'remove' })}>
                        {t('Remove')}
                      </button>
                      <button className="btn btn-sm" onClick={() => setConfirm({ id: f.id, what: 'block' })}>
                        {t('Block')}
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {view && view.blocked.length > 0 && (
        <section aria-labelledby="f-blocked">
          <h2 id="f-blocked" className="profile-h2">
            {t('Blocked')}
          </h2>
          <ul className="friend-list">
            {view.blocked.map((b) => (
              <li key={b.id} className="friend-row">
                <span className="friend-who">
                  <strong>{b.nickname}</strong>
                </span>
                <button className="btn btn-sm" onClick={() => void act({ action: 'unblock', id: b.id })}>
                  {t('Unblock')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="info-small">
        {t('Someone bothering you? Block them, and tell us:')} <Link href={CONTACT_PATH}>{t('Open a ticket')}</Link>
      </p>
    </div>
  );
}
