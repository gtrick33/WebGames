import { useT } from '../i18n';
import { useAccount } from '../platform/account';
import { bannersOn, rewardedOn, useMoney } from '../platform/money';
import { Icon } from './Icon';
import { openSignIn } from './openSignIn';
import './FreeBanner.css';

/**
 * The promise, in big letters: everything is free and needs no account. An account is optional and only
 * adds things (synced progress, leaderboards, quests), which the right side spells out; its button says
 * what it does ("Save my progress") so it never reads as the sign-up the promise says isn't needed.
 */
export function FreeBanner() {
  const t = useT();
  const { me, status } = useAccount();
  const money = useMoney();
  const perks = [t('Your bests and streaks on every device'), t('Leaderboards and the Hall of Fame'), t('Pins on your Trophy Shelf, friends and friend boards'), t('Daily quests, XP and levels'), t('Favorites that follow you')];
  return (
    <section className={`wrap free-band${me ? ' is-member' : ''}`} aria-labelledby="free-title">
      <div className="free-words">
        <h2 id="free-title" className="free-title">
          <span className="free-w free-w1">{t('100% free.')}</span>
          <span className="free-w free-w2">{t('No sign-up.')}</span>
          <span className="free-w free-w3">{t('No downloads.')}</span>
        </h2>
        <p className="free-sub">
          {bannersOn(money) || rewardedOn(money) || money.shop ? t('Every game plays right here in your browser, on any device. No account and no paywalls.') : t('Every game plays right here in your browser, on any device. No account, no paywalls, no catch.')}
          {me && <span className="free-member mono"> ✓ {t('You’re a member')}</span>}
        </p>
      </div>
      {/* Members already have the extras, so their banner is just the promise. */}
      {!me && (
        <div className="free-extra">
          <p className="free-kicker mono">{t('Optional: your streaks on every device')}</p>
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
            <Icon name="star" size={16} /> {t('Save my progress')}
          </button>
        </div>
      )}
    </section>
  );
}
