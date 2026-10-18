import { isNewLive, useLiveCatalog } from '../platform/liveCatalog';
import { t, tGame, useLang, useT } from '../i18n';
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
  const t = useT();
  const lang = useLang();
  const fresh = isNewLive(useLiveCatalog(), game);
  const released = new Date(`${game.released}T12:00:00Z`).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <section className="section latest" aria-labelledby="latest-title" data-accent={game.accent}>
      <div className="wrap latest-grid">
        <Link href={`/games/${game.slug}`} className="latest-art" tabIndex={-1} aria-hidden="true">
          <img src={game.art.wide} alt="" loading="lazy" decoding="async" width={1000} height={400} style={{ background: game.art.bg }} />
          <img src={game.art.tile} alt="" loading="lazy" decoding="async" className="latest-art-tile" width={512} height={512} />
          {fresh && <span className="sticker latest-sticker">{t('New release')}</span>}
        </Link>
        <div className="latest-copy">
          <p className="eyebrow">
            {t('Latest release')} · <time dateTime={game.released}>{released}</time>
          </p>
          <h2 id="latest-title" className="latest-title">
            {game.title}
          </h2>
          <p className="latest-desc">{tGame(game.description)}</p>
          {game.highlights && (
            <ul className="latest-list">
              {game.highlights.map((h) => (
                <li key={h}>{tGame(h)}</li>
              ))}
            </ul>
          )}
          <div className="latest-ctas">
            <Link href={`/games/${game.slug}`} className="btn btn-primary btn-lg">
              <Icon name="play" /> {t('Play now')}
            </Link>
            <span className="chip" data-accent="yellow">
              {t(CATEGORIES[game.categories[0]].label)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Your arcade": only rendered when this device has actually played something. */
export function YourArcade() {
  const t = useT();
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
            <p className="eyebrow">{t('Saved on this device')}</p>
            <h2 id="yours-title">{t('Continue playing')}</h2>
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
                    {t('Best {n}', { n: fmt(rec.best.score ?? 0) })} · {rec.plays === 1 ? t('1 round') : t('{n} rounds', { n: rec.plays })}
                  </span>
                  <span className="mono yours-when">{t('Last played {when}', { when: timeAgo(rec.last) })}</span>
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
  if (s < 90) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  const d = Math.round(s / 86400);
  return d === 1 ? t('yesterday') : t('{n} days ago', { n: d });
}

/** An energetic ticker between sections. Decorative; the words are repeated for the loop. */
export function Marquee({ words }: { words: string[] }) {
  useT();
  const items = [...words, ...words];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((k) => (
          <span key={k} className="marquee-group">
            {items.map((w, i) => (
              <span key={i} className="marquee-item">
                {t(w)}
                <Star className="marquee-star" fill={['#ffd12e', '#c4f034', '#ff5a6c', '#12c6b3'][i % 4]} />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
