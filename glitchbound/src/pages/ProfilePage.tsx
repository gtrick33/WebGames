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
import { Link } from '../router/router';
import './InfoPages.css';

export function ProfilePage() {
  usePageMeta({ title: 'Your profile', path: '/me' });
  const { me, status } = useAccount();
  const [editing, setEditing] = useState(false);
  const [nickMsg, setNickMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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

      <section aria-labelledby="bests-title">
        <h2 id="bests-title" className="profile-h2">
          Personal bests
        </h2>
        <div className="info-cols">
          {GAMES.map((g) => {
            const b = me.bests[g.slug];
            return (
              <div key={g.slug} className="panel info-block">
                <h3>{g.title}</h3>
                {b ? (
                  <dl className="bests">
                    <div>
                      <dt>Best score</dt>
                      <dd className="mono">{fmt(b.score)}</dd>
                    </div>
                    {g.stats
                      .filter((s) => s.key !== 'score' && b.stats[s.key] !== undefined)
                      .map((s) => (
                        <div key={s.key}>
                          <dt>{s.label}</dt>
                          <dd className="mono">
                            {fmt(b.stats[s.key]!)}
                            {s.unit ? ` ${s.unit}` : ''}
                          </dd>
                        </div>
                      ))}
                  </dl>
                ) : (
                  <p>No ranked round yet.</p>
                )}
                <Link href={`/games/${g.slug}`} className="quests-link">
                  Play {g.title} <Icon name="arrowRight" size={16} />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="favs-title">
        <h2 id="favs-title" className="profile-h2">
          Favorites
        </h2>
        {favorites.length ? (
          <div className="related-grid">
            {favorites.map((g, i) => (
              <GameTile key={g.slug} game={g} index={i} best={me.bests[g.slug]?.score} />
            ))}
          </div>
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
