import { useState, type FormEvent } from 'react';
import { useGames, useLiveCatalog } from '../platform/liveCatalog';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { NotifyForm } from '../components/Notify';
import { QuestBoard } from '../components/Quests';
import { Banner, LookAvatar } from '../components/Looks';
import { WEARS_NOTHING, type LookKind } from '../catalog/looks';
import { PRODUCTS } from '../catalog/shop';
import { useMoney } from '../platform/money';
import { ChallengeHistoryList, useChallengeHistory } from '../components/ChallengeHistory';
import { openSignIn } from '../components/openSignIn';
import { account, ApiError, useAccount } from '../platform/account';
import { fmt } from '../platform/daily';
import { usePageMeta } from '../platform/meta';
import type { Me } from '../platform/apiTypes';
import { rankBests, topLabel } from '../platform/profile';
import { Link } from '../router/router';
import { getLang, useT } from '../i18n';
import { ProfileTabs } from './BugReportPage';
import './InfoPages.css';
import { gameUrl } from '../catalog/catalog';

export function ProfilePage() {
  usePageMeta({ title: 'Your profile', path: '/me' });
  const t = useT();
  const { me, status } = useAccount();
  const [editing, setEditing] = useState(false);
  const [nickMsg, setNickMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Shown on the signed-out page right after the account was deleted.
  const [deleted, setDeleted] = useState(false);
  const [allFavs, setAllFavs] = useState(false);
  const games = useGames();

  if (status === 'loading') {
    return (
      <div className="wrap info-page">
        <p className="info-lead">{t('Loading your profile…')}</p>
      </div>
    );
  }
  if (!me) {
    return (
      <div className="wrap info-page">
        <h1 className="info-title">{t('Your profile')}</h1>
        {deleted && (
          <p className="panel info-block" role="status">
            {t('Your account and everything saved with it were deleted.')}
          </p>
        )}
        <p className="info-lead">{t('Sign in to get daily quests, levels, badges, favorites on every device and your name on the leaderboards.')}</p>
        <div>
          <button className="btn btn-magenta btn-lg" onClick={() => openSignIn()}>
            <Icon name="user" /> {t('Sign in')}
          </button>
        </div>
      </div>
    );
  }

  const saveNick = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const nickname = String(new FormData(e.currentTarget).get('nickname') ?? '');
    try {
      await account.update({ nickname });
      setEditing(false);
      setNickMsg(t('Saved.'));
    } catch (err) {
      setNickMsg(err instanceof ApiError ? t(err.message) : t('Could not save.'));
    }
  };
  const editNick = (on: boolean): void => {
    setEditing(on);
    setNickMsg('');
  };

  const deleteAccount = async (): Promise<void> => {
    setDeleting(true);
    setDeleteError('');
    try {
      await account.deleteAccount();
      setDeleted(true);
      setConfirmDelete(false);
    } catch {
      setDeleteError(t('Could not delete your account right now. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const favorites = games.filter((g) => me.favorites.includes(g.slug));
  const pct = Math.round(((me.xp - me.levelFloor) / Math.max(1, me.levelNext - me.levelFloor)) * 100);

  return (
    <div className="wrap info-page profile">
      <ProfileTabs current="me" />
      <section className={`profile-card panel${me.looks?.banner ? ' has-banner' : ''}`} aria-label={t('Player card')}>
        {me.looks?.banner && <Banner id={me.looks.banner} className="profile-banner" />}
        <LookAvatar name={me.nickname} src={me.avatar} size={84} border={me.looks?.border} icon={me.looks?.icon} />
        <div className="profile-id">
          {editing ? (
            <form className="nick-form" onSubmit={(e) => void saveNick(e)}>
              <input className="field" name="nickname" defaultValue={me.nickname} minLength={3} maxLength={14} aria-label={t('Nickname')} autoFocus />
              <button className="btn btn-primary btn-sm">{t('Save')}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => editNick(false)}>
                {t('Cancel')}
              </button>
            </form>
          ) : (
            <h1 className="profile-name">
              {me.nickname}
              <button className="btn btn-ghost btn-sm" onClick={() => editNick(true)} aria-label={t('Edit nickname')}>
                {t('Edit')}
              </button>
            </h1>
          )}
          {nickMsg && <p className="info-small">{nickMsg}</p>}
          <p className="mono profile-sub">
            {t('Level {n}', { n: me.level })} · {fmt(me.xp)} XP · {t('{n} ranked rounds', { n: fmt(me.rounds) })} · {t('{n} day streak', { n: me.streak })}
          </p>
          <div className="xpbar profile-xp" aria-label={t('{pct}% to level {n}', { pct, n: me.level + 1 })}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <LooksSection me={me} />

      <QuestBoard />

      <section aria-labelledby="badges-title">
        <h2 id="badges-title" className="profile-h2">
          {t('Badges')}
        </h2>
        <ul className="badges">
          {me.badges.map((b, i) => (
            <li key={b.id} className={`badge${b.earned ? ' is-earned' : ''}`} style={{ ['--i' as string]: i }} title={t(b.hint)}>
              <span className="badge-icon">
                <Icon name={b.earned ? 'star' : 'bolt'} size={22} />
              </span>
              <strong>{t(b.label)}</strong>
              <span className="info-small">{t(b.hint)}</span>
            </li>
          ))}
        </ul>
      </section>

      <BestResults me={me} />

      <ChallengeHistorySection />

      <section aria-labelledby="favs-title">
        <h2 id="favs-title" className="profile-h2">
          {t('Favorites')}
        </h2>
        {favorites.length ? (
          <>
            <div className="related-grid">
              {(allFavs ? favorites : favorites.slice(0, 6)).map((g, i) => (
                <GameTile key={g.slug} game={g} index={i} best={me.bests[g.slug]?.score} />
              ))}
            </div>
            {favorites.length > 6 && (
              <button className="btn btn-ghost show-more" onClick={() => setAllFavs((v) => !v)}>
                {allFavs ? t('Show fewer') : t('Show all {n} favorites', { n: favorites.length })}
              </button>
            )}
          </>
        ) : (
          <p className="info-lead">{t('Tap the heart on any game to keep it here.')}</p>
        )}
      </section>

      <NotifyForm />

      <section className="panel info-block danger" aria-labelledby="account-title">
        <h2 id="account-title">{t('Account')}</h2>
        <p>
          {t('Signed in as')} <b>{me.email}</b>. {t('Leaderboards only show your nickname.')}
        </p>
        {confirmDelete && <p className="info-small">{t('Your nickname, XP, levels, bests, rounds, favorites, quest progress and saves are deleted for good. This can’t be undone.')}</p>}
        <div className="reset-row">
          <button className="btn" onClick={() => void account.signOut()}>
            <Icon name="logout" /> {t('Sign out')}
          </button>
          {!confirmDelete ? (
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
              {t('Delete my account')}
            </button>
          ) : (
            <>
              <button className="btn btn-magenta" disabled={deleting} onClick={() => void deleteAccount()}>
                {t('Yes, delete everything')}
              </button>
              <button className="btn btn-ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                {t('Cancel')}
              </button>
            </>
          )}
        </div>
        {deleteError && (
          <p className="info-small" role="alert">
            {deleteError}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * The borders, banners and icons this member owns, to wear one of each or none. They show on the player card above, in
 * the header and on every board. With nothing bought, it's only a pointer to the shop, and only while the shop is open.
 */
function LooksSection({ me }: { me: Me }) {
  const t = useT();
  const money = useMoney();
  const items = useLiveCatalog().raw.shopItems ?? PRODUCTS;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // every look the member owns, the built-in ones and those an admin made, as the shop's list says
  const owned = items.flatMap((p) => (p.look && me.owned?.includes(p.id) ? [{ id: p.id, kind: p.look.kind }] : []));
  const worn = me.looks ?? WEARS_NOTHING;
  const shopOpen = money.shop || me.isAdmin;
  if (!owned.length && !shopOpen) return null;
  const nameOf = (id: string): string => items.find((p) => p.id === id)?.name ?? id;
  const wear = (kind: LookKind, id: string): void => {
    setBusy(true);
    setError('');
    account
      .update({ [kind]: id })
      .catch(() => setError(t('Could not save.')))
      .finally(() => setBusy(false));
  };
  const group = (kind: LookKind, title: string) => {
    const mine = owned.filter((l) => l.kind === kind);
    if (!mine.length) return null;
    return (
      <div className="look-group" role="group" aria-labelledby={`looks-${kind}`}>
        <h3 id={`looks-${kind}`} className="look-group-title">
          {title}
        </h3>
        <div className="look-picks">
          <button className="look-pick" aria-pressed={!worn[kind]} disabled={busy} onClick={() => wear(kind, '')}>
            <span className={`look-pick-art look-pick-none is-${kind}`}>
              {kind === 'banner' ? <span className="look-pick-blank" /> : <LookAvatar name={me.nickname} src={me.avatar} size={64} border={kind === 'icon' ? worn.border : undefined} icon={kind === 'border' ? worn.icon : undefined} />}
            </span>
            <span className="look-pick-name">{kind === 'border' ? t('No border') : kind === 'banner' ? t('No banner') : t('No icon')}</span>
          </button>
          {mine.map((l) => (
            <button key={l.id} className="look-pick" aria-pressed={worn[kind] === l.id} disabled={busy} onClick={() => wear(kind, l.id)}>
              <span className={`look-pick-art is-${kind}`}>
                {kind === 'banner' ? (
                  <Banner id={l.id} className="look-pick-banner" />
                ) : (
                  <LookAvatar name={me.nickname} src={me.avatar} size={64} border={kind === 'border' ? l.id : worn.border} icon={kind === 'icon' ? l.id : worn.icon} />
                )}
              </span>
              <span className="look-pick-name">{nameOf(l.id)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <section id="looks" aria-labelledby="looks-title">
      <h2 id="looks-title" className="profile-h2">
        {t('Your looks')}
      </h2>
      {owned.length > 0 && <p className="info-small looks-lead">{t('Pick what shows around your picture and behind your name, here and on the leaderboards.')}</p>}
      {group('border', t('Border'))}
      {group('banner', t('Banner'))}
      {group('icon', t('Icon'))}
      {error && (
        <p className="info-small" role="alert">
          {error}
        </p>
      )}
      {shopOpen && (
        <Link href="/shop" className="quests-link">
          {t('See borders and banners in the shop')} <Icon name="arrowRight" size={16} />
        </Link>
      )}
    </section>
  );
}

/** The latest friends' challenges with their results; the full list is on /c. */
function ChallengeHistorySection() {
  const t = useT();
  const list = useChallengeHistory();
  return (
    <section aria-labelledby="chal-history-title">
      <h2 id="chal-history-title" className="profile-h2">
        {t('Your challenges')}
      </h2>
      {list === null ? (
        <p className="info-small">{t('Loading…')}</p>
      ) : list.length === 0 ? (
        <p className="info-lead">{t('No challenges yet. Challenge friends from any game: same round, one try each.')}</p>
      ) : (
        <ChallengeHistoryList items={list.slice(0, 5)} />
      )}
      <p>
        <Link href="/c" className="btn btn-ghost btn-sm">
          {t('All your challenges')}
        </Link>
      </p>
    </section>
  );
}

const HIGHLIGHTS = 4;

/**
 * Personal bests that scale to any number of games: the four most impressive results as cards, then
 * every other best in a compact, searchable list, and a nudge towards games not tried yet.
 */
function BestResults({ me }: { me: Me }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const games = useGames();
  const ranked = rankBests(me.bests, games);
  const top = ranked.slice(0, HIGHLIGHTS);
  // The list holds the bests below the cards; a search looks through all of them.
  const q = query.trim().toLowerCase();
  const rest = q ? ranked.filter((e) => e.game.title.toLowerCase().includes(q)) : ranked.slice(HIGHLIGHTS);
  const untried = games.filter((g) => !me.bests[g.slug]);
  return (
    <section aria-labelledby="bests-title">
      <h2 id="bests-title" className="profile-h2">
        {t('Your best results')}
      </h2>
      {top.length === 0 ? (
        <p className="info-lead">{t('Finish a round while signed in and your records show up here.')}</p>
      ) : (
        <div className="best-cards">
          {top.map((e) => {
            const tag = topLabel(e);
            return (
              <Link key={e.game.slug} href={gameUrl(e.game.slug)} className="panel best-card best-card-link" data-accent={e.game.accent}>
                <span className="best-card-art" style={{ background: e.game.art.bg }} aria-hidden="true">
                  <img src={e.game.art.wide} alt="" loading="lazy" decoding="async" />
                  {tag && <span className={`best-tag mono${e.best.rank === 1 ? ' is-crown' : ''}`}>{e.best.rank === 1 ? '👑 #1' : tag}</span>}
                </span>
                <span className="best-card-body">
                  <strong className="best-card-title">{e.game.title}</strong>
                  <span className="best-score mono">{fmt(e.best.score)}</span>
                  <span className="info-small mono">
                    {e.best.rank && e.best.players ? t('Rank {rank} of {n}', { rank: e.best.rank, n: fmt(e.best.players) }) : t('Personal best')} · {new Date(e.best.at).toLocaleDateString(getLang())}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {ranked.length > HIGHLIGHTS && (
        <details className="panel all-bests">
          <summary>
            {t('All personal bests')} <span className="mono">({t('{n} games', { n: ranked.length })})</span>
          </summary>
          {ranked.length > 10 && (
            <input className="field all-bests-search" type="search" placeholder={t('Filter games')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('Filter games')} />
          )}
          <table className="bests-table">
            <thead>
              <tr>
                <th scope="col">{t('Game')}</th>
                <th scope="col">{t('Best')}</th>
                <th scope="col">{t('Rank')}</th>
              </tr>
            </thead>
            <tbody>
              {rest.length === 0 && (
                <tr>
                  <td colSpan={3} className="info-small">
                    {t('No game matches “{q}”.', { q: query.trim() })}
                  </td>
                </tr>
              )}
              {rest.map((e) => (
                <tr key={e.game.slug}>
                  <td>
                    <Link href={gameUrl(e.game.slug)}>{e.game.title}</Link>
                  </td>
                  <td className="mono">{fmt(e.best.score)}</td>
                  <td className="mono">{e.best.rank ? `#${e.best.rank}${e.best.players ? ` / ${fmt(e.best.players)}` : ''}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {untried.length > 0 && (
        <div className="untried">
          <p className="info-small">{t('Not tried yet:')}</p>
          {untried.slice(0, 6).map((g) => (
            <Link key={g.slug} href={gameUrl(g.slug)} className="untried-chip" data-accent={g.accent}>
              <img src={g.art.tile} alt="" width={28} height={28} style={{ background: g.art.bg }} />
              {g.title}
            </Link>
          ))}
          {untried.length > 6 && <span className="info-small">{t('+{n} more', { n: untried.length - 6 })}</span>}
        </div>
      )}
    </section>
  );
}
