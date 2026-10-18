import { useT } from '../i18n';
import { useAccount } from '../platform/account';
import { Icon } from './Icon';
import { openSignIn } from './SignIn';
import './FreeBanner.css';

/**
 * The promise, in big letters: everything is free and needs no account. Signing in is optional
 * and only adds things (synced progress, leaderboards, quests), which the right side spells out.
 */
export function FreeBanner() {
  const t = useT();
  const { me, status } = useAccount();
  const perks = [t('Your bests and streaks on every device'), t('Leaderboards and the Hall of Fame'), t('Daily quests, XP and levels'), t('Favorites that follow you')];
  return (
    <section className="wrap free-band" aria-labelledby="free-title">
      <div className="free-words">
        <h2 id="free-title" className="free-title">
          <span className="free-w free-w1">{t('100% free.')}</span>
          <span className="free-w free-w2">{t('No sign-up.')}</span>
          <span className="free-w free-w3">{t('No downloads.')}</span>
        </h2>
        <p className="free-sub">{t('Every game plays right here in your browser, on any device. No account, no paywalls, no catch.')}</p>
      </div>
      <div className="free-extra">
        <p className="free-kicker mono">{me ? t('You’re a member') : t('Want more? Sign in, optional')}</p>
        <ul className="free-perks">
          {perks.map((p) => (
            <li key={p}>
              <span className="free-check" aria-hidden="true">
                {me ? '✓' : '+'}
              </span>
              {p}
            </li>
          ))}
        </ul>
        {!me && (
          <button className="btn btn-sm btn-primary" onClick={() => openSignIn()} disabled={status === 'loading'}>
            <Icon name="star" size={16} /> {t('Sign in free')}
          </button>
        )}
      </div>
    </section>
  );
}
