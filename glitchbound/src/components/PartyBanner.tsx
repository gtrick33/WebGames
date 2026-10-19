import { Link } from '../router/router';
import { useT } from '../i18n';
import './PartyBanner.css';

/** Homepage pointer to Party Mode (pass-the-phone games live on their own page). */
export function PartyBanner() {
  const t = useT();
  return (
    <section className="wrap section">
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
    </section>
  );
}
