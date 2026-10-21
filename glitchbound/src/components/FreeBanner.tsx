import { useT } from '../i18n';
import { useAccount } from '../platform/account';
import { Icon } from './Icon';
import { openSignIn } from './openSignIn';
import './FreeBanner.css';

/**
 * The promise, in big letters: everything is free and needs no account. Signing in is optional
 * and only adds things (synced progress, leaderboards, quests), which the right side spells out.
 * `mini` is the one-line version for the home page hero's side column.
 */
export function FreeBanner({ mini = false }: { mini?: boolean }) {
  const t = useT();
  const { me, status } = useAccount();
  // The small one: the three words in a row and, for guests, the optional sign-in.
  if (mini)
    return (
      <section className="free-mini" aria-label={`${t('100% free.')} ${t('No sign-up.')} ${t('No downloads.')}`}>
        <p className="free-mini-words" aria-hidden="true">
          <span className="free-w free-w1">{t('100% free.')}</span>
          <span className="free-w free-w2">{t('No sign-up.')}</span>
          <span className="free-w free-w3">{t('No downloads.')}</span>
        </p>
        {!me && (
          <button className="btn btn-sm btn-primary free-mini-cta" onClick={() => openSignIn()} disabled={status === 'loading'}>
            <Icon name="star" size={15} /> {t('Sign in free')}
          </button>
        )}
      </section>
    );
  const perks = [t('Your bests and streaks on every device'), t('Leaderboards and the Hall of Fame'), t('Daily quests, XP and levels'), t('Favorites that follow you')];
  return (
    <section className={`wrap free-band${me ? ' is-member' : ''}`} aria-labelledby="free-title">
      <div className="free-words">
        <h2 id="free-title" className="free-title">
          <span className="free-w free-w1">{t('100% free.')}</span>
          <span className="free-w free-w2">{t('No sign-up.')}</span>
          <span className="free-w free-w3">{t('No downloads.')}</span>
        </h2>
        <p className="free-sub">
          {t('Every game plays right here in your browser, on any device. No account, no paywalls, no catch.')}
          {me && <span className="free-member mono"> ✓ {t('You’re a member')}</span>}
        </p>
      </div>
      {/* Members already have the extras, so their banner is just the promise. */}
      {!me && (
        <div className="free-extra">
          <p className="free-kicker mono">{t('Want more? Sign in, optional')}</p>
          <ul className="free-perks">
            {perks.map((p) => (
              <li key={p}>
                <span className="free-check" aria-hidden="true">
                  +
                </span>
                {p}
              </li>
            ))}
          </ul>
          <button className="btn btn-sm btn-primary" onClick={() => openSignIn()} disabled={status === 'loading'}>
            <Icon name="star" size={16} /> {t('Sign in free')}
          </button>
        </div>
      )}
    </section>
  );
}
