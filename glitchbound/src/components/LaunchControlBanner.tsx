import { Link } from '../router/router';
import { useT } from '../i18n';
import './LaunchControlBanner.css';

/** Homepage spotlight for Launch Control, right under the hero: the garage game that keeps growing. */
export function LaunchControlBanner() {
  const t = useT();
  return (
    <section className="wrap section">
      <Link href="/games/launch-control" className="lcb">
        <span className="lcb-art" aria-hidden="true">
          <img src="/games/launch-control/wide.webp" alt="" width={1200} height={480} />
        </span>
        <span className="lcb-text">
          <span className="eyebrow">{t('New · Launch Control')}</span>
          <strong>{t('Build the fastest car on the strip.')}</strong>
          <span>{t('Head-to-head 3D drag races on Formula 1 start lights: 43 cars to tune, 40 rivals to beat and live races against your friends.')}</span>
        </span>
        <span className="lcb-go mono" aria-hidden="true">
          {t('Hit the strip →')}
        </span>
      </Link>
    </section>
  );
}
