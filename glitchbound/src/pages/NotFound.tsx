import { latestGame } from '../catalog/catalog';
import { Icon } from '../components/Icon';
import { Dot, Ring, Tri } from '../components/Shapes';
import { usePageMeta } from '../platform/meta';
import { Link, useLocation } from '../router/router';
import './InfoPages.css';

export function NotFound() {
  const { pathname } = useLocation();
  usePageMeta({ title: 'Page not found', path: pathname });
  const game = latestGame();
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
      <h1 className="info-title">This level doesn&rsquo;t exist.</h1>
      <p className="info-lead">
        Nothing lives at <code>{pathname}</code>. Maybe the link was mistyped, or the game moved.
      </p>
      <div className="nf-actions">
        <Link href="/#arcade" className="btn btn-primary btn-lg">
          Back to the arcade <Icon name="arrowRight" />
        </Link>
        {game && (
          <Link href={`/games/${game.slug}`} className="btn btn-lg">
            <Icon name="play" /> Play {game.title}
          </Link>
        )}
      </div>
    </div>
  );
}
