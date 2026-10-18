import { isNewLive, useLiveCatalog } from '../platform/liveCatalog';
import { CATEGORIES, type GameEntry } from '../catalog/types';
import { fmt } from '../platform/daily';
import { recentSlugs } from '../platform/save';
import { useSave } from '../platform/store';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { Star } from './Shapes';
import './Sections.css';

/** Editorial spread for the most recent release. */
export function LatestRelease({ game }: { game: GameEntry }) {
  const fresh = isNewLive(useLiveCatalog(), game);
  const released = new Date(`${game.released}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <section className="section latest" aria-labelledby="latest-title" data-accent={game.accent}>
      <div className="wrap latest-grid">
        <Link href={`/games/${game.slug}`} className="latest-art" tabIndex={-1} aria-hidden="true">
          <img src={game.art.wide} alt="" loading="lazy" decoding="async" width={1000} height={400} style={{ background: game.art.bg }} />
          <img src={game.art.tile} alt="" loading="lazy" decoding="async" className="latest-art-tile" width={512} height={512} />
          {fresh && <span className="sticker latest-sticker">New release</span>}
        </Link>
        <div className="latest-copy">
          <p className="eyebrow">
            Latest release · <time dateTime={game.released}>{released}</time>
          </p>
          <h2 id="latest-title" className="latest-title">
            {game.title}
          </h2>
          <p className="latest-desc">{game.description}</p>
          {game.highlights && (
            <ul className="latest-list">
              {game.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          <div className="latest-ctas">
            <Link href={`/games/${game.slug}`} className="btn btn-primary btn-lg">
              <Icon name="play" /> Play now
            </Link>
            <span className="chip" data-accent="yellow">
              {CATEGORIES[game.categories[0]].label}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Your arcade": only rendered when this device has actually played something. */
export function YourArcade() {
  const save = useSave();
  const { games } = useLiveCatalog();
  const recent = recentSlugs(save)
    .map((slug) => games.find((g) => g.slug === slug))
    .filter((g): g is GameEntry => !!g)
    .slice(0, 3);
  if (recent.length === 0) return null;
  return (
    <section className="section yours" aria-labelledby="yours-title">
      <div className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow">Saved on this device</p>
            <h2 id="yours-title">Continue playing</h2>
          </div>
        </div>
        <div className="yours-row">
          {recent.map((g) => {
            const rec = save.games[g.slug]!;
            return (
              <Link key={g.slug} href={`/games/${g.slug}`} className="yours-card" data-accent={g.accent}>
                <img src={g.art.tile} alt="" width={96} height={96} style={{ background: g.art.bg }} />
                <span className="yours-text">
                  <strong>{g.title}</strong>
                  <span className="mono">
                    Best {fmt(rec.best.score ?? 0)} · {rec.plays} {rec.plays === 1 ? 'round' : 'rounds'}
                  </span>
                  <span className="mono yours-when">Last played {timeAgo(rec.last)}</span>
                </span>
                <span className="yours-go" aria-hidden="true">
                  <Icon name="play" size={22} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function timeAgo(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** An energetic ticker between sections. Decorative; the words are repeated for the loop. */
export function Marquee({ words }: { words: string[] }) {
  const items = [...words, ...words];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((k) => (
          <span key={k} className="marquee-group">
            {items.map((w, i) => (
              <span key={i} className="marquee-item">
                {w}
                <Star className="marquee-star" fill={['#ffd12e', '#c4f034', '#ff5a6c', '#12c6b3'][i % 4]} />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
