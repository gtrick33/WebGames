import { lazy, Suspense } from 'react';
import { Link } from '../router/router';
import { useT } from '../i18n';
import { fresh } from '../platform/freshBuild';
import './PartyBanner.css';

// The two featured party games (and the party catalog they need) load after the first paint.
const PartyCards = lazy(fresh(() => import('./PartyCards').then((m) => ({ default: m.PartyCards }))));

/**
 * Homepage pointer to Party Mode (pass-the-phone games live on their own page), with the two featured
 * party games as cards so friends-over visitors see a game, not just a promise.
 */
export function PartyBanner() {
  const t = useT();
  return (
    <section className="wrap section party-home" aria-label={t('Party Mode')}>
      <Link href="/party" className="party-banner">
        <span className="party-banner-emoji" aria-hidden="true">
          🎉🃏🎲
        </span>
        <span className="party-banner-text">
          <span className="eyebrow">{t('New · Party Mode')}</span>
          <strong>{t('Got friends over? Pass the phone.')}</strong>
          <span>{t('Impostor, charades, Never Have I Ever and more. Pass one phone around, or everyone plays on their own.')}</span>
        </span>
        <span className="party-banner-go mono" aria-hidden="true">
          {t('Let’s party →')}
        </span>
      </Link>
      <Suspense fallback={null}>
        <PartyCards />
      </Suspense>
    </section>
  );
}
