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
