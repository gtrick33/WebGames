import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { flushSync } from 'react-dom';
import { categoryCounts, isCategory, queryGames, SORTS, type SortId } from '../catalog/catalog';
import { orderByLayout, tileSizeFor } from '../catalog/settings';
import { useLiveCatalog } from '../platform/liveCatalog';
import type { CategoryId } from '../catalog/types';
import { track } from '../platform/analytics';
import { useSave } from '../platform/store';
import { useAccount } from '../platform/account';
import { navigate, useLocation } from '../router/router';
import { GameTile } from './GameTile';
import { Icon } from './Icon';
import { Dot, Ring, Tri } from './Shapes';
import './Arcade.css';

/** Wraps a state change in a View Transition so tiles glide to their new spots (where supported). */
function withTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(() => flushSync(update));
  else update();
}

/** The library: search, category filter and sort. State lives in the URL so filtered views are shareable. */
export function Arcade() {
  const t = useT();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const urlCat = params.get('category');
  const category: CategoryId | null = isCategory(urlCat) ? urlCat : null;
  const live = useLiveCatalog();
  // With an admin layout the default view is "Featured" (their order); Newest and A to Z stay one click away.
  const featuredOn = !!live.layout?.order.length;
  const sortParam = params.get('sort');
  const sort: SortId | 'featured' = sortParam === 'az' ? 'az' : sortParam === 'newest' || !featuredOn ? 'newest' : 'featured';
  const defaultSort = featuredOn ? 'featured' : 'newest';
  const favOnly = params.get('fav') === '1';
  const acct = useAccount();
  const favorites = acct.me ? acct.me.favorites : acct.guestFavorites;
  const [q, setQ] = useState(params.get('q') ?? '');
  const save = useSave();
  const games = live.games;
  const cats = categoryCounts(games);
  const all = useMemo(() => {
    const hits = queryGames({ q, category, sort: sort === 'featured' ? 'newest' : sort }, live.games);
    // Games an admin pinned come first (unless the player is searching).
    if (q.trim()) return hits;
    const ordered = sort === 'featured' ? orderByLayout(hits, live.layout) : hits;
    return [...ordered.filter((g) => live.settings(g.slug).pinned), ...ordered.filter((g) => !live.settings(g.slug).pinned)];
  }, [q, category, sort, live]);
  const results = favOnly ? all.filter((g) => favorites.includes(g.slug)) : all;
  const filtered = q.trim() !== '' || category !== null || favOnly;
  const firstRender = useRef(true);

  const setParam = (key: string, value: string | null): void => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    navigate(`${window.location.pathname}${qs ? `?${qs}` : ''}#arcade`, { replace: true, scroll: false });
  };

  // Keep ?q= in sync (debounced) and report searches.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      if ((new URLSearchParams(window.location.search).get('q') ?? '') === q.trim()) return;
      setParam('q', q.trim() || null);
      if (q.trim()) track('search', { q: q.trim().slice(0, 40).toLowerCase(), results: results.length, where: 'arcade' });
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pickCategory = (id: CategoryId | null): void => {
    if (id) track('category_select', { category: id });
    withTransition(() => {
      setParam('fav', null);
      setParam('category', id);
    });
  };

  const pickFavorites = (): void => {
    withTransition(() => {
      setParam('category', null);
      setParam('fav', favOnly ? null : '1');
    });
  };

  const clear = (): void => {
    withTransition(() => {
      setQ('');
      navigate('/#arcade', { replace: true, scroll: false });
    });
  };

  return (
    <section id="arcade" className="section arcade" aria-labelledby="arcade-title">
      <div className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              <Icon name="bolt" size={16} /> {t('Explore')}
            </p>
            <h2 id="arcade-title">{t('The arcade')}</h2>
          </div>
          <p>
            {t('Every game is original and plays right here in the browser.')} {games.length === 1 ? t('One game so far, with more on the way.') : t('{n} games and counting.', { n: games.length })}
          </p>
        </div>

        <div className="arcade-controls">
          <label className="arcade-search">
            <Icon name="search" size={20} />
            <span className="sr-only">{t('Search the arcade')}</span>
            <input type="search" value={q} placeholder={t('Search games, e.g. racing')} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </label>

          <div className="arcade-cats" role="group" aria-label={t('Filter by category')}>
            <button className={`cat-btn${category === null && !favOnly ? ' is-on' : ''}`} aria-pressed={category === null && !favOnly} onClick={() => pickCategory(null)}>
              {t('All')} <span className="mono">{games.length}</span>
            </button>
            {cats.map((c) => (
              <button key={c.id} className={`cat-btn${category === c.id ? ' is-on' : ''}`} aria-pressed={category === c.id} onClick={() => pickCategory(c.id)}>
                {t(c.label)} <span className="mono">{c.count}</span>
              </button>
            ))}
            <button className={`cat-btn cat-fav${favOnly ? ' is-on' : ''}`} aria-pressed={favOnly} onClick={pickFavorites}>
              <Icon name="heart" size={16} /> {t('Favorites')} <span className="mono">{favorites.length}</span>
            </button>
          </div>

          <label className="arcade-sort">
            <span className="mono">{t('Sort')}</span>
            <select value={sort} onChange={(e) => withTransition(() => setParam('sort', e.target.value === defaultSort ? null : e.target.value))}>
              {featuredOn && <option value="featured">{t('Featured')}</option>}
              {(Object.keys(SORTS) as SortId[]).map((s) => (
                <option key={s} value={s}>
                  {t(SORTS[s])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {results.length === 1 ? t('1 game shown') : t('{n} games shown', { n: results.length })}
        </p>

        {results.length > 0 ? (
          <div className="arcade-grid">
            {results.map((g, i) => (
              <GameTile key={g.slug} game={g} index={i} size={tileSizeFor(live.layout, g.slug, i)} best={save.games[g.slug]?.best.score} />
            ))}
            {!filtered && games.length < 4 && (
              <aside className="workshop pop-in" style={{ ['--i' as string]: results.length }} aria-label="About upcoming games">
                <div className="workshop-shapes" aria-hidden="true">
                  <Tri className="ws ws-1" />
                  <Dot className="ws ws-2" fill="#12c6b3" />
                  <Ring className="ws ws-3" fill="#ff3fd2" />
                </div>
                <p className="eyebrow">{t('In the workshop')}</p>
                <p className="workshop-text">{t('The next games are being built. New releases land here first, and the daily challenge grows with them.')}</p>
              </aside>
            )}
          </div>
        ) : (
          <div className="arcade-empty panel">
            <div className="empty-shapes" aria-hidden="true">
              <Tri className="es es-1" fill="#ff5a6c" />
              <Dot className="es es-2" fill="#ffd12e" />
            </div>
            <h3>{favOnly && !q.trim() ? t('No favorites yet.') : t('Nothing here. Yet.')}</h3>
            <p>
              {favOnly && !q.trim()
                ? t('Tap the heart on any game to keep it here.')
                : q.trim()
                  ? t('No game matches “{q}”. Try another word or browse everything.', { q: q.trim() })
                  : t('No game matches that filter. Try another or browse everything.')}
            </p>
            <button className="btn btn-primary" onClick={clear}>
              {t('Show all games')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
