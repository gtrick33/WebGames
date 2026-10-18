import { useEffect, useState } from 'react';
import { getGame } from '../catalog/catalog';
import type { GameEntry } from '../catalog/types';
import { Icon } from '../components/Icon';
import { useT } from '../i18n';
import { ApiError } from '../platform/account';
import { MAX_PLAYERS, type ChallengeListItem, type ChallengeMode } from '../platform/challenge';
import { closeChallenge, createChallenge, getChallenge, myChallenges } from '../platform/challenges';
import { dayKey } from '../platform/dates';
import { useLiveCatalog } from '../platform/liveCatalog';
import { usePageMeta } from '../platform/meta';
import { usePlayerName } from '../platform/playerName';
import { Link, navigate } from '../router/router';
import './InfoPages.css';
import './ChallengePage.css';

/**
 * An invite link (/c/<id>): challenges live inside their game, so this opens the game with the
 * challenge on it. (The link itself stays short and has its own preview card for chat apps.)
 */
export function ChallengePage({ id }: { id: string }) {
  const t = useT();
  usePageMeta({ title: t('Challenge'), path: `/c/${id}` });
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    getChallenge(id).then(
      (v) => live && navigate(`/games/${v.game}?challenge=${v.id}`, { replace: true }),
      (e: unknown) => live && setError(e instanceof ApiError && e.status === 404 ? 'gone' : 'failed'),
    );
    return () => {
      live = false;
    };
  }, [id]);
  if (error === 'gone')
    return (
      <div className="wrap info-page">
        <h1 className="info-title">{t('This challenge has closed.')}</h1>
        <p className="info-lead">{t('Challenges nobody joins close after a day. Start a new one and send the link.')}</p>
        <Link href="/c" className="btn btn-primary">
          {t('Your challenges')}
        </Link>
      </div>
    );
  return (
    <div className="wrap info-page">
      <p className="info-lead">{error ? t('Could not load the challenge. Check your connection.') : t('Loading the challenge…')}</p>
    </div>
  );
}

const leftText = (ms: number, t: ReturnType<typeof useT>): string => {
  const h = Math.max(1, Math.round((ms - Date.now()) / 3600_000));
  return h < 48 ? t('closes in {n} h', { n: h }) : t('closes in {n} days', { n: Math.round(h / 24) });
};

/* ----------------------------------------------------------- your list */

export function ChallengesPage() {
  const t = useT();
  usePageMeta({ title: t('Your challenges'), path: '/c' });
  const live = useLiveCatalog();
  const [list, setList] = useState<ChallengeListItem[] | null>(null);
  const [picking, setPicking] = useState<GameEntry | null>(null);
  const player = usePlayerName();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    myChallenges().then(
      (r) => setList(r.challenges),
      () => setList([]),
    );
  }, []);
  const games = live.games.filter((g) => g.challenge && !live.settings(g.slug).maintenance);
  const start = async (game: GameEntry, mode: ChallengeMode): Promise<void> => {
    setBusy(true);
    try {
      const v = await createChallenge(game.slug, mode, player.name, dayKey());
      navigate(`/games/${game.slug}?challenge=${v.id}`);
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.message !== e.code ? e.message : t('Could not start a challenge.')) : t('Network error. Try again.'));
      setBusy(false);
    }
  };
  const remove = async (c: ChallengeListItem): Promise<void> => {
    if (!window.confirm(c.host ? t('End this challenge for everyone? The results stay readable.') : t('Leave this challenge? Your scores stay on the board.'))) return;
    setBusy(true);
    try {
      await closeChallenge(c.id);
      setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
    } catch {
      setMsg(t('Network error. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wrap info-page chal">
      <p className="eyebrow">⚔️ {t('Up to {n} players, same round for everyone.', { n: MAX_PLAYERS })}</p>
      <h1 className="info-title">{t('Challenges')}</h1>
      <section className="panel info-block" aria-labelledby="chal-mine">
        <h2 id="chal-mine">{t('Your challenges')}</h2>
        {list === null ? (
          <p className="info-small">{t('Loading…')}</p>
        ) : list.length === 0 ? (
          <p className="info-small">{t('None open. Start one below and send the link to your friends.')}</p>
        ) : (
          <ul className="chal-list">
            {list.map((c) => {
              const g = getGame(c.game, live.all);
              return (
                <li key={c.id} className="chal-item">
                  <Link href={`/games/${c.game}?challenge=${c.id}`} className="chal-row" data-accent={g?.accent}>
                    {g && <img src={g.art.tile} alt="" width={48} height={48} style={{ background: g.art.bg }} />}
                    <span className="chal-row-main">
                      <b>{g?.title ?? c.game}</b>
                      <span className="info-small">
                        {t('round {n}', { n: c.round })} · {t('{a}/{b} players', { a: c.players, b: MAX_PLAYERS })}
                        {c.leader ? ` · ${t('{name} leads', { name: c.leader })}` : ''} · {leftText(c.closesAt, t)}
                      </span>
                    </span>
                    {c.yourTurn ? (
                      <span className="chal-badge is-turn">{t('Your turn')}</span>
                    ) : (
                      <span className="chal-badge">{c.lobby ? t('Waiting for friends') : c.waitingFor.length ? t('Waiting for {names}', { names: c.waitingFor.slice(0, 2).join(', ') }) : t('Everyone has played.')}</span>
                    )}
                  </Link>
                  <button className="btn btn-sm btn-icon chal-end" disabled={busy} onClick={() => void remove(c)} aria-label={c.host ? t('End challenge') : t('Leave challenge')} title={c.host ? t('End challenge') : t('Leave challenge')}>
                    <Icon name="close" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="info-small">{t('Challenges nobody joins close after a day; the rest close after a week without play.')}</p>
      </section>

      <section className="panel info-block" aria-labelledby="chal-new">
        <h2 id="chal-new">{t('Start a challenge')}</h2>
        <p className="info-small">{t('Pick a game. You play first (or not), then send the link: friends join with one tap, no sign-up.')}</p>
        <ul className="chal-games">
          {games.map((g) => (
            <li key={g.slug}>
              <button className={`chal-game${picking?.slug === g.slug ? ' is-on' : ''}`} onClick={() => setPicking(picking?.slug === g.slug ? null : g)} data-accent={g.accent}>
                <img src={g.art.tile} alt="" width={64} height={64} style={{ background: g.art.bg }} />
                <span>{g.title}</span>
              </button>
            </li>
          ))}
        </ul>
        {picking && (
          <div className="chal-modes">
            <div className="reset-row">
              {picking.ownDaily && (
                <button className="btn btn-primary" disabled={busy} onClick={() => void start(picking, 'daily')}>
                  <Icon name="calendar" /> {t('Today’s daily')}
                </button>
              )}
              <button className={`btn${picking.ownDaily ? '' : ' btn-primary'}`} disabled={busy} onClick={() => void start(picking, 'fresh')}>
                <Icon name="bolt" /> {t('Fresh round')}
              </button>
            </div>
          </div>
        )}
        {msg && <p className="chal-msg">{msg}</p>}
      </section>
    </div>
  );
}
