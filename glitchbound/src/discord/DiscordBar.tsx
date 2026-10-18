import { useT } from '../i18n';
import { Link, useLocation } from '../router/router';
import './DiscordBar.css';

/** Inside the Discord Activity: a slim bar instead of the arcade header (Discord frames the page). */
export function DiscordBar() {
  const t = useT();
  const { pathname } = useLocation();
  return (
    <header className="dsc-bar">
      <Link href="/discord" className="dsc-bar-logo">
        GlitchBound
      </Link>
      {pathname !== '/discord' && (
        <Link href="/discord" className="btn btn-sm">
          {t('Pick a game')}
        </Link>
      )}
    </header>
  );
}
