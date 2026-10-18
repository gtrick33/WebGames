import { useState } from 'react';
import { t as tr, useT } from '../i18n';
import { account, useAccount } from '../platform/account';
import { track } from '../platform/analytics';
import { Icon } from './Icon';

/** Heart toggle. Guests keep favorites on this device; members keep them on their account. */
export function FavoriteButton({ slug, title, className = '' }: { slug: string; title: string; className?: string }) {
  useT();
  const state = useAccount();
  const on = state.me ? state.me.favorites.includes(slug) : state.guestFavorites.includes(slug);
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      className={`fav-btn ${on ? 'is-on' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? tr('Remove {game} from favorites', { game: title }) : tr('Add {game} to favorites', { game: title })}
      title={on ? tr('Favorite') : tr('Add to favorites')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!on) setPop((p) => p + 1);
        track('favorite', { game: slug, on: !on });
        void account.toggleFavorite(slug, !on);
      }}
    >
      <Icon name="heart" size={20} />
      {pop > 0 && <span key={pop} className="fav-burst" aria-hidden="true" />}
    </button>
  );
}
