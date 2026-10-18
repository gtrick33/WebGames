import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { t as tr, tGame, useT } from '../i18n';
import { queryGames } from '../catalog/catalog';
import { CATEGORIES } from '../catalog/types';
import { track } from '../platform/analytics';
import { navigate } from '../router/router';
import { Icon } from './Icon';
import './SearchDialog.css';

/** Command-palette style search over the registry. Opens with "/" or the header button. */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useT();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => queryGames({ q }), [q]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  // Report searches once the user pauses typing.
  useEffect(() => {
    if (!q.trim()) return;
    const t = window.setTimeout(() => track('search', { q: q.trim().slice(0, 40).toLowerCase(), results: results.length, where: 'dialog' }), 800);
    return () => window.clearTimeout(t);
  }, [q, results.length]);

  const close = (): void => {
    setQ('');
    setActive(0);
    onClose();
  };

  const go = (slug: string): void => {
    close();
    navigate(`/games/${slug}`);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      // type="search" inputs swallow the first Escape (to clear); close right away instead.
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const hit = results[active];
      if (hit) {
        e.preventDefault();
        go(hit.slug);
      }
    }
  };

  return (
    <dialog
      ref={ref}
      className="search-dialog"
      aria-label={tr('Search games')}
      onClose={close}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="search-box panel">
        <div className="search-field">
          <Icon name="search" size={24} />
          <input
            ref={inputRef}
            type="search"
            value={q}
            placeholder={tr('Search by name, category or vibe')}
            aria-label={tr('Search games')}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].slug}` : undefined}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <button className="btn btn-icon btn-sm" onClick={close} aria-label={tr('Close search')}>
            <Icon name="close" />
          </button>
        </div>
        <ul id={listId} role="listbox" className="search-results" aria-label={tr('Results')}>
          {results.map((g, i) => (
            <li
              key={g.slug}
              id={`${listId}-${g.slug}`}
              role="option"
              aria-selected={i === active}
              className="search-hit"
              data-accent={g.accent}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(g.slug)}
            >
              <img src={g.art.tile} alt="" width={56} height={56} style={{ background: g.art.bg }} />
              <span className="search-hit-text">
                <strong>{g.title}</strong>
                <span>{tGame(g.tagline)}</span>
              </span>
              <span className="chip">{tr(CATEGORIES[g.categories[0]].label)}</span>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p className="search-empty">
            {tr('No game matches “{q}”. Try a category like racing or arcade.', { q: q.trim() })}
          </p>
        )}
        <p className="search-foot mono" aria-hidden="true">
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> {tr('to move')} · <span className="kbd">Enter</span> {tr('to play')} · <span className="kbd">Esc</span> {tr('to close')}
        </p>
      </div>
    </dialog>
  );
}
