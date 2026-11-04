/**
 * How a card's picture loads. On the first page of a visit, as before: lazily unless `first` (a quick first
 * paint). After a tab switch (router.tsx marks the page) the pictures have been fetched already: the ones likely
 * in view (`again`) decode before the page shows, so a card never flashes empty and fills in a frame later.
 */
export function cardImg(first: boolean, again: boolean): { loading: 'eager' | 'lazy'; decoding: 'sync' | 'async' } {
  const paged = typeof document !== 'undefined' && document.documentElement.dataset.paged !== undefined;
  if (paged) return again ? { loading: 'eager', decoding: 'sync' } : { loading: 'lazy', decoding: 'async' };
  return { loading: first ? 'eager' : 'lazy', decoding: 'async' };
}

/** The 400px copy of a game's square art, for a picture that's blurred anyway. */
export const tileSmall = (tile: string): string => tile.replace(/\/tile\.webp$/, '/tile-400.webp');

/**
 * A game's square art at the size it's shown, so a thumbnail doesn't fetch an 800px picture: the browser picks from the
 * copies scripts/tile-sizes.mjs makes. `shown` is how wide it is on screen in CSS pixels, or a `sizes` list.
 */
export function tileImg(tile: string, shown: number | string): { src: string; srcSet?: string; sizes?: string } {
  if (!tile.endsWith('/tile.webp')) return { src: tile };
  const base = tile.slice(0, -'.webp'.length);
  return { src: tile, srcSet: `${base}-160.webp 160w, ${base}-400.webp 400w, ${tile} 800w`, sizes: typeof shown === 'number' ? `${shown}px` : shown };
}
