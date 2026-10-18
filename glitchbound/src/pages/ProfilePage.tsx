import { useState, type FormEvent } from 'react';
import { GAMES } from '../catalog/games';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { NotifyForm } from '../components/Notify';
import { QuestBoard } from '../components/Quests';
import { Avatar, openSignIn } from '../components/SignIn';
import { account, ApiError, useAccount } from '../platform/account';
import { fmt } from '../platform/daily';
import { usePageMeta } from '../platform/meta';
import type { Me } from '../platform/apiTypes';
import { rankBests, topLabel } from '../platform/profile';
import { Link } from '../router/router';
import { ProfileTabs } from './BugReportPage';
import './InfoPages.css';

export function ProfilePage() {
  usePageMeta({ title: 'Your profile', path: '/me' });
  const { me, status } = useAccount();
  const [editing, setEditing] = useState(false);
  const [nickMsg, setNickMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [allFavs, setAllFavs] = useState(false);

  if (status === 'loading') {
    return (
      <div className="wrap info-page">
        <p className="info-lead">Loading your profile…</p>
      </div>
    );
  }
  if (!me) {
    return (
      <div className="wrap info-page">
        <h1 className="info-title">Your profile</h1>
        <p className="info-lead">Sign in to get daily quests, levels, badges, favorites on every device and your name on the leaderboards.</p>
        <div>
          <button className="btn btn-magenta btn-lg" onClick={() => openSignIn()}>
            <Icon name="user" /> Sign in
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
      setNickMsg('Saved.');
    } catch (err) {
      setNickMsg(err instanceof ApiError ? err.message : 'Could not save.');
    }
  };

  const favorites = GAMES.filter((g) => me.favorites.includes(g.slug));
  const pct = Math.round(((me.xp - me.levelFloor) / Math.max(1, me.levelNext - me.levelFloor)) * 100);

  return (
    <div className="wrap info-page profile">
      <ProfileTabs current="me" />
      <section className="profile-card panel" aria-label="Player card">
        <Avatar name={me.nickname} src={me.avatar} size={84} />
        <div className="profile-id">
          {editing ? (
            <form className="nick-form" onSubmit={(e) => void saveNick(e)}>
              <input className="field" name="nickname" defaultValue={me.nickname} minLength={3} maxLength={16} aria-label="Nickname" autoFocus />
              <button className="btn btn-primary btn-sm">Save</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <h1 className="profile-name">
              {me.nickname}
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                Edit
              </button>
            </h1>
          )}
          {nickMsg && <p className="info-small">{nickMsg}</p>}
          <p className="mono profile-sub">
            Level {me.level} · {fmt(me.xp)} XP · {fmt(me.rounds)} ranked rounds · {me.streak} day streak
          </p>
          <div className="xpbar profile-xp" aria-label={`${pct}% to level ${me.level + 1}`}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <QuestBoard />

      <section aria-labelledby="badges-title">
        <h2 id="badges-title" className="profile-h2">
          Badges
        </h2>
        <ul className="badges">
          {me.badges.map((b, i) => (
            <li key={b.id} className={`badge${b.earned ? ' is-earned' : ''}`} style={{ ['--i' as string]: i }} title={b.hint}>
              <span className="badge-icon">
                <Icon name={b.earned ? 'star' : 'bolt'} size={22} />
              </span>
              <strong>{b.label}</strong>
              <span className="info-small">{b.hint}</span>
            </li>
          ))}
        </ul>
      </section>

      <BestResults me={me} />

      <section aria-labelledby="favs-title">
        <h2 id="favs-title" className="profile-h2">
          Favorites
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
                {allFavs ? 'Show fewer' : `Show all ${favorites.length} favorites`}
              </button>
            )}
          </>
        ) : (
          <p className="info-lead">Tap the heart on any game to keep it here.</p>
        )}
      </section>

      <NotifyForm />

      <section className="panel info-block danger" aria-labelledby="account-title">
        <h2 id="account-title">Account</h2>
        <p>
          Signed in with Google as <b>{me.email}</b>. Leaderboards only show your nickname.
        </p>
        <div className="reset-row">
          <button className="btn" onClick={() => void account.signOut()}>
            <Icon name="logout" /> Sign out
          </button>
          {!confirmDelete ? (
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </button>
          ) : (
            <>
              <button className="btn btn-magenta" onClick={() => void account.deleteAccount()}>
                Yes, delete everything
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const HIGHLIGHTS = 4;

/**
 * Personal bests that scale to any number of games: the four most impressive results as cards, then
 * every other best in a compact, searchable list, and a nudge towards games not tried yet.
 */
function BestResults({ me }: { me: Me }) {
  const [query, setQuery] = useState('');
  const ranked = rankBests(me.bests, GAMES);
  const top = ranked.slice(0, HIGHLIGHTS);
  const rest = ranked.slice(HIGHLIGHTS).filter((e) => e.game.title.toLowerCase().includes(query.trim().toLowerCase()));
  const untried = GAMES.filter((g) => !me.bests[g.slug]);
  return (
    <section aria-labelledby="bests-title">
      <h2 id="bests-title" className="profile-h2">
        Your best results
      </h2>
      {top.length === 0 ? (
        <p className="info-lead">Finish a round while signed in and your records show up here.</p>
      ) : (
        <div className="best-cards">
          {top.map((e) => {
            const tag = topLabel(e);
            return (
              <Link key={e.game.slug} href={`/games/${e.game.slug}`} className="panel best-card best-card-link" data-accent={e.game.accent}>
                <span className="best-card-art" style={{ background: e.game.art.bg }} aria-hidden="true">
                  <img src={e.game.art.wide} alt="" loading="lazy" decoding="async" />
                  {tag && <span className={`best-tag mono${e.best.rank === 1 ? ' is-crown' : ''}`}>{e.best.rank === 1 ? '👑 #1' : tag}</span>}
                </span>
                <span className="best-card-body">
                  <strong className="best-card-title">{e.game.title}</strong>
                  <span className="best-score mono">{fmt(e.best.score)}</span>
                  <span className="info-small mono">
                    {e.best.rank && e.best.players ? `Rank ${e.best.rank} of ${fmt(e.best.players)}` : 'Personal best'} · {new Date(e.best.at).toLocaleDateString()}
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
            All personal bests <span className="mono">({ranked.length} games)</span>
          </summary>
          {ranked.length > 10 && (
            <input className="field all-bests-search" type="search" placeholder="Filter games" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter games" />
          )}
          <table className="bests-table">
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Best</th>
                <th scope="col">Rank</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((e) => (
                <tr key={e.game.slug}>
                  <td>
                    <Link href={`/games/${e.game.slug}`}>{e.game.title}</Link>
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
          <p className="info-small">Not tried yet:</p>
          {untried.slice(0, 6).map((g) => (
            <Link key={g.slug} href={`/games/${g.slug}`} className="untried-chip" data-accent={g.accent}>
              <img src={g.art.tile} alt="" width={28} height={28} style={{ background: g.art.bg }} />
              {g.title}
            </Link>
          ))}
          {untried.length > 6 && <span className="info-small">+{untried.length - 6} more</span>}
        </div>
      )}
    </section>
  );
}
