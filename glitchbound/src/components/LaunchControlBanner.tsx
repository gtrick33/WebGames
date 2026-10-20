import { Link } from '../router/router';
import { useT } from '../i18n';
import './LaunchControlBanner.css';

/** Homepage spotlight for Launch Control: the garage game that keeps growing. */
export function LaunchControlBanner() {
  const t = useT();
  return (
    <section className="wrap section">
      <Link href="/games/launch-control" className="lcb">
        <span className="lcb-art" aria-hidden="true">
          <span className="lcb-sun" />
          <span className="lcb-road" />
          <span className="lcb-car lcb-car-a">🏎️</span>
          <span className="lcb-car lcb-car-b">🚗</span>
          <span className="lcb-flag">🏁</span>
        </span>
        <span className="lcb-text">
          <span className="eyebrow">{t('New · Launch Control')}</span>
          <strong>{t('Build the fastest car on the strip.')}</strong>
          <span>{t('33 low-poly cars, six parts to tune, a ladder of 40 rivals and wagers on your own odds. Your sponsor pays while you’re away.')}</span>
        </span>
        <span className="lcb-go mono" aria-hidden="true">
          {t('Hit the strip →')}
        </span>
      </Link>
    </section>
  );
}
