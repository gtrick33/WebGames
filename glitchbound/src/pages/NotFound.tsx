import { latestGame } from '../catalog/catalog';
import { t as tr, useT } from '../i18n';
import { Icon } from '../components/Icon';
import { Dot, Ring, Tri } from '../components/Shapes';
import { useLiveCatalog } from '../platform/liveCatalog';
import { usePageMeta } from '../platform/meta';
import { Link, useLocation } from '../router/router';
import './InfoPages.css';

export function NotFound() {
  useT();
  const { pathname } = useLocation();
  usePageMeta({ title: tr('Page not found'), path: pathname });
  // The arcade's newest game as players see it (not a hidden or Party-only one).
  const game = latestGame(useLiveCatalog().games);
  return (
    <div className="wrap info-page notfound">
      <div className="nf-shapes" aria-hidden="true">
        <Tri className="nf-s nf-1" fill="#ff5a6c" />
        <Ring className="nf-s nf-2" fill="#12c6b3" />
        <Dot className="nf-s nf-3" fill="#ffd12e" />
      </div>
      <p className="nf-code glitch is-glitching" data-text="404" aria-hidden="true">
        404
      </p>
      <h1 className="info-title">{tr('This level doesn’t exist.')}</h1>
      <p className="info-lead">
        {tr('Nothing lives at {path}. Maybe the link was mistyped, or the game moved.', { path: pathname })}
      </p>
      <div className="nf-actions">
        <Link href="/#arcade" className="btn btn-primary btn-lg">
          {tr('Back to the arcade')} <Icon name="arrowRight" />
        </Link>
        {game && (
          <Link href={`/games/${game.slug}`} className="btn btn-lg">
            <Icon name="play" /> {tr('Play {game}', { game: game.title })}
          </Link>
        )}
      </div>
    </div>
  );
}
