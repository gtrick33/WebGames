import { useT } from '../i18n';
import { dayKey } from '../platform/dates';
import { useNow } from '../platform/hooks';
import { useLiveCatalog } from '../platform/liveCatalog';
import { themeGames, themeOf } from '../platform/themes';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './ThemeStrip.css';

/**
 * "Today is Trivia Tuesday": the day's theme, its games, and what to do about it. `embedded` renders
 * it as the header of a larger section (no page gutter of its own, one heading level down).
 */
export function ThemeStrip({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const live = useLiveCatalog();
  const day = dayKey(useNow(60_000));
  const theme = themeOf(day);
  const games = themeGames(theme, live.games.filter((g) => !live.settings(g.slug).maintenance)).slice(0, 3);
  const first = games[0];
  const Name = embedded ? 'h3' : 'h2';
  return (
    <section className={`${embedded ? '' : 'wrap '}theme-strip${embedded ? ' is-embedded' : ''}`} data-theme-day={theme.id} aria-label={t('Today’s theme')}>
      <span className="theme-emoji" aria-hidden="true">
        {theme.emoji}
      </span>
      <div className="theme-copy">
        <p className="theme-kicker mono">{t('Today is')}</p>
        <Name className="theme-name">{t(theme.name)}</Name>
        <p className="theme-tag">{t(theme.tagline)}</p>
      </div>
      {games.length > 0 && (
        <ul className="theme-games">
          {games.map((g) => (
            <li key={g.slug}>
              <Link href={`/games/${g.slug}`} title={g.title}>
                <img src={g.art.tile} alt={g.title} width={52} height={52} loading="lazy" style={{ background: g.art.bg }} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {theme.cta === 'challenge' ? (
        <Link href="/c" className="btn btn-primary theme-cta">
          ⚔️ {t('Challenge a friend')}
        </Link>
      ) : theme.cta === 'party' ? (
        <Link href="/party" className="btn btn-primary theme-cta">
          🎉 {t('Party mode')}
        </Link>
      ) : (
        first && (
          <Link href={`/games/${first.slug}`} className="btn btn-primary theme-cta">
            <Icon name="play" size={18} /> {t('Play {game}', { game: first.title })}
          </Link>
        )
      )}
    </section>
  );
}
