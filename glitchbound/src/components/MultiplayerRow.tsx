import type { CSSProperties } from 'react';
import { multiplayerGames } from '../catalog/multiplayer';
import { orderByLayout } from '../catalog/settings';
import { tGame, useT } from '../i18n';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { LiveBadge } from './LiveBadge';
import './FlagshipRow.css';

/**
 * "Live multiplayer games", right under Our best games and in the same big cards: the games friends
 * play together at the same moment, each on their own device (the admins' list, else every live game).
 */
export function MultiplayerRow() {
  const t = useT();
  const live = useLiveCatalog();
  const games = orderByLayout(live.games, live.layout).filter((g) => !live.settings(g.slug).maintenance);
  const list = multiplayerGames(games, live.raw.multiplayer);
  if (list.length === 0) return null;
  return (
    <section className="wrap flagships multiplayer" aria-labelledby="multiplayer-title">
      <div className="flagships-head">
        <div>
          <p className="eyebrow">
            <Icon name="gamepad" size={16} /> {t('Play together')}
          </p>
          <h2 id="multiplayer-title" className="flagships-title">
            {t('Live multiplayer games')}
          </h2>
        </div>
        <p className="flagships-sub">{t('Play with friends at the same moment, each on their own device.')}</p>
      </div>
      <ul className="flagship-row">
        {list.map((g, i) => (
          <li key={g.slug} className="flagship pop-in" data-accent={g.accent} style={{ '--i': i } as CSSProperties}>
            <div className="flagship-art" style={{ background: g.art.bg }}>
              <img src={g.art.tile} alt="" width={512} height={512} decoding="async" loading="lazy" />
              <LiveBadge game={g} className="on-art" />
            </div>
            <div className="flagship-body">
              <h3 className="flagship-title">
                <Link href={`/games/${g.slug}`} className="flagship-link">
                  {g.title}
                </Link>
              </h3>
              <p className="flagship-tag">{tGame(g.tagline)}</p>
              {g.live && <p className="mono flagship-players">{t('{n} players', { n: g.live.players })}</p>}
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
