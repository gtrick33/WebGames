import type { CSSProperties } from 'react';
import { tGame, useT } from '../i18n';
import { isNewLive, useLiveCatalog } from '../platform/liveCatalog';
import type { TileSize } from '../catalog/settings';
import { CATEGORIES, type GameEntry } from '../catalog/types';
import { Link } from '../router/router';
import { FavoriteButton } from './FavoriteButton';
import { GamePreview, hasPreview } from './GamePreview';
import { Icon } from './Icon';
import './GameTile.css';

/**
 * A game "cabinet" in the catalogue: artwork with a live looping preview (it runs only while the
 * tile is on screen), title, categories, favorite heart and play action.
 */
export function GameTile({ game, size = 'md', index = 0, best }: { game: GameEntry; size?: TileSize; index?: number; best?: number }) {
  const live = useLiveCatalog();
  const t = useT();
  const style = { '--i': index, viewTransitionName: `tile-${game.slug}` } as CSSProperties;
  const preview = hasPreview(game.slug);
  // Wide tiles with a preview split into artwork + live screen, so neither covers the other.
  const art = (size === 'xl' || size === 'wide') && !preview ? game.art.wide : game.art.tile;
  // Admins can recolour a banner and give it a sticker (which takes the place of NEW).
  const accent = live.layout?.accents[game.slug] ?? game.accent;
  const sticker = live.layout?.stickers[game.slug];
  return (
    <article
      className={`tile tile-${size} pop-in${preview ? ' has-preview' : ''}`}
      data-accent={accent}
      style={style}
    >
      <div className="tile-art" style={{ background: game.art.bg }}>
        <picture>
          {art !== game.art.tile && <source media="(max-width: 640px)" srcSet={game.art.tile} />}
          <img src={art} alt={game.art.alt} loading="lazy" decoding="async" />
        </picture>
        {preview && <GamePreview slug={game.slug} className="tile-preview" />}
        {preview && (
          <span className="tile-live mono" aria-hidden="true">
            <i /> {t('Live preview')}
          </span>
        )}
        <span className="tile-scan" aria-hidden="true" />
      </div>
      <div className="tile-body">
        <div className="tile-meta">
          {game.categories.map((c) => (
            <span key={c} className="chip">
              {t(CATEGORIES[c].label)}
            </span>
          ))}
        </div>
        <h3 className="tile-title">
          <Link href={`/games/${game.slug}`} className="tile-link">
            {game.title}
          </Link>
        </h3>
        <p className="tile-tagline">{tGame(game.tagline)}</p>
        <div className="tile-foot">
          {best !== undefined ? <span className="mono tile-best">{t('Your best {n}', { n: best.toLocaleString('en-US') })}</span> : <span />}
          <span className="tile-play" aria-hidden="true">
            <Icon name="play" size={16} /> {t('Play')}
          </span>
        </div>
      </div>
      <FavoriteButton slug={game.slug} title={game.title} className="tile-fav" />
      {sticker ? (
        <span className="sticker tile-sticker" data-tone="magenta">
          {sticker}
        </span>
      ) : (
        isNewLive(live, game) && (
          <span className="sticker tile-sticker" data-tone="yellow">
            {t('New')}
          </span>
        )
      )}
    </article>
  );
}
