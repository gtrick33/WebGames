import type { CSSProperties } from 'react';
import { isNew } from '../catalog/catalog';
import { CATEGORIES, type GameEntry } from '../catalog/types';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './GameTile.css';

export type TileSize = 'xl' | 'tall' | 'md' | 'wide';

/** Shape rhythm for the arcade grid, so the library never looks like rows of identical boxes. */
export const TILE_RHYTHM: TileSize[] = ['xl', 'tall', 'md', 'md', 'wide', 'md', 'tall', 'md'];

export function GameTile({ game, size = 'md', index = 0, best }: { game: GameEntry; size?: TileSize; index?: number; best?: number }) {
  const style = { '--i': index, viewTransitionName: `tile-${game.slug}` } as CSSProperties;
  const art = size === 'xl' || size === 'wide' ? game.art.wide : game.art.tile;
  return (
    <article className={`tile tile-${size} pop-in`} data-accent={game.accent} style={style}>
      <div className="tile-art" style={{ background: game.art.bg }}>
        <picture>
          {art !== game.art.tile && <source media="(max-width: 640px)" srcSet={game.art.tile} />}
          <img src={art} alt={game.art.alt} loading="lazy" decoding="async" />
        </picture>
      </div>
      <div className="tile-body">
        <div className="tile-meta">
          {game.categories.map((c) => (
            <span key={c} className="chip">
              {CATEGORIES[c].label}
            </span>
          ))}
        </div>
        <h3 className="tile-title">
          <Link href={`/games/${game.slug}`} className="tile-link">
            {game.title}
          </Link>
        </h3>
        <p className="tile-tagline">{game.tagline}</p>
        <div className="tile-foot">
          {best !== undefined ? <span className="mono tile-best">Your best {best.toLocaleString('en-US')}</span> : <span />}
          <span className="tile-play" aria-hidden="true">
            Play <Icon name="arrowRight" size={18} />
          </span>
        </div>
      </div>
      {isNew(game) && (
        <span className="sticker tile-sticker" data-tone="yellow">
          New
        </span>
      )}
    </article>
  );
}
