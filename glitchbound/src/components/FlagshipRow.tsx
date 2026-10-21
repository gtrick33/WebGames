import type { CSSProperties } from 'react';
import { tGame, useT } from '../i18n';
import { useFlagships } from '../platform/useFlagships';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { LiveBadge } from './LiveBadge';
import './FlagshipRow.css';

/**
 * Four big cards right under the hero: the games we would show a friend first, each with its art,
 * its one-line mechanic and Play. On a themed day ("Word Wednesday") the matching one comes first.
 */
export function FlagshipRow() {
  const t = useT();
  const { list, theme } = useFlagships();
  if (list.length === 0) return null;
  return (
    <section className="wrap flagships" aria-labelledby="flagships-title">
      <div className="flagships-head">
        <div>
          <p className="eyebrow">
            <Icon name="star" size={16} /> {t('Start here')}
          </p>
          <h2 id="flagships-title" className="flagships-title">
            {t('Our best games')}
          </h2>
        </div>
        <p className="flagships-sub">{t('Four to get hooked on. Each one has a fresh puzzle every day.')}</p>
      </div>
      <ul className="flagship-row">
        {list.map(({ game: g, themed }, i) => (
          <li key={g.slug} className="flagship pop-in" data-accent={g.accent} style={{ '--i': i } as CSSProperties}>
            <div className="flagship-art" style={{ background: g.art.bg }}>
              <img src={g.art.tile} alt="" width={512} height={512} decoding="async" loading={i < 2 ? 'eager' : 'lazy'} />
              <LiveBadge game={g} className="on-art" />
            </div>
            {themed && (
              <span className="sticker flagship-sticker" data-tone="magenta">
                <span aria-hidden="true">{theme.emoji}</span> {t(theme.name)}
              </span>
            )}
            <div className="flagship-body">
              <h3 className="flagship-title">
                <Link href={`/games/${g.slug}`} className="flagship-link">
                  {g.title}
                </Link>
              </h3>
              <p className="flagship-tag">{tGame(g.tagline)}</p>
              <span className="btn btn-primary btn-sm flagship-play" aria-hidden="true">
                <Icon name="play" size={16} /> {t('Play')}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
