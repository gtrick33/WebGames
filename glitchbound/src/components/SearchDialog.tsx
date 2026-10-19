import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { t as tr, tGame, useT } from '../i18n';
import { partySettingsFor } from '../catalog/settings';
import { CATEGORIES } from '../catalog/types';
import { PARTY_GAMES } from '../party/catalog';
import { account, useAccount } from '../platform/account';
import { track } from '../platform/analytics';
import { openFeedback } from '../platform/feedback';
import { useLiveCatalog } from '../platform/liveCatalog';
import { partyHref, siteSearch, type PageAction, type SearchGroup } from '../platform/siteSearch';
import { setTheme } from '../platform/theme';
import { navigate } from '../router/router';
import { AdultLabel } from './AdultLabel';
import { Icon } from './Icon';
import { openSignIn } from './openSignIn';
import './SearchDialog.css';

/** One row of the results, whatever it is. */
interface Hit {
  key: string;
  run: () => void;
  view: ReactNode;
  accent?: string;
}

const ACTIONS: Record<PageAction, () => void> = {
  signin: () => openSignIn(),
  signout: () => void account.signOut(),
  feedback: () => openFeedback(),
  night: () => setTheme('dark'),
  day: () => setTheme('light'),
};

/**
 * Command-palette style search over the whole site (platform/siteSearch.ts): arcade games, Party Mode
 * games and pages or features ("my profile", "leaderboard", "dark mode"). Opens with "/" or the header button.
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useT();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const live = useLiveCatalog();
  const { me } = useAccount();
  const role = me?.role ?? null;

  const groups = useMemo<SearchGroup[]>(() => {
    // Hidden games stay hidden (staff can still find them); party games use the admins' texts.
    const games = live.all.filter((g) => !live.settings(g.slug).hidden || role);
    const party = PARTY_GAMES.filter((g) => !partySettingsFor(live.raw, g.id).hidden).map((g) => {
      const s = partySettingsFor(live.raw, g.id);
      return { ...g, title: s.title || g.title, blurb: s.blurb || g.blurb };
    });
    return siteSearch(q, { member: !!me, role, games, party, translate: tr });
  }, [q, live, me, role]);

  const close = (): void => {
    setQ('');
    setActive(0);
    onClose();
  };
  const go = (href: string): void => {
    close();
    navigate(href);
  };

  // One flat list for the keyboard, in the order the groups are shown.
  const sectionOf = (group: SearchGroup): { label: string; hits: Hit[] } => {
    if (group.kind === 'games')
      return {
        label: tr('Games'),
        hits: group.items.map((g) => ({
          key: `g:${g.slug}`,
          accent: g.accent,
          run: () => go(`/games/${g.slug}`),
          view: (
            <>
              <img src={g.art.tile} alt="" width={56} height={56} style={{ background: g.art.bg }} />
              <span className="search-hit-text">
                <strong>{g.title}</strong>
                <span>{tGame(g.tagline)}</span>
              </span>
              {g.adult ? <AdultLabel text={tr('Adults only')} /> : <span className="chip">{tr(CATEGORIES[g.categories[0]].label)}</span>}
            </>
          ),
        })),
      };
    if (group.kind === 'party')
      return {
        label: tr('Party games'),
        hits: group.items.map((g) => ({
          key: `p:${g.id}`,
          run: () => go(partyHref(g)),
          view: (
            <>
              <span className="search-hit-art" style={{ ['--mc' as string]: g.color }} aria-hidden="true">
                {g.emoji}
              </span>
              <span className="search-hit-text">
                <strong>{g.title}</strong>
                <span>{g.blurb}</span>
              </span>
              <span className="chip">{tr('Party')}</span>
            </>
          ),
        })),
      };
    return {
      label: tr('Go to'),
      hits: group.items.map((p) => ({
        key: `s:${p.id}`,
        run: () => {
          if (p.href) return go(p.href);
          close();
          if (p.action) ACTIONS[p.action]();
        },
        view: (
          <>
            <span className="search-hit-icon" aria-hidden="true">
              <Icon name={p.icon} size={22} />
            </span>
            <span className="search-hit-text">
              <strong>{p.action === 'night' || p.action === 'day' ? `${tr('Theme')}: ${tr(p.title)}` : tr(p.title)}</strong>
            </span>
          </>
        ),
      })),
    };
  };
  const sections = groups.map((group) => ({ kind: group.kind, ...sectionOf(group) }));
  const flat = sections.flatMap((s) => s.hits);
  const count = flat.length;
  // Where each group starts in the flat list.
  const starts = sections.map((_, i) => sections.slice(0, i).reduce((n, s) => n + s.hits.length, 0));

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
    const t = window.setTimeout(() => track('search', { q: q.trim().slice(0, 40).toLowerCase(), results: count, where: 'dialog' }), 800);
    return () => window.clearTimeout(t);
  }, [q, count]);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      // type="search" inputs swallow the first Escape (to clear); close right away instead.
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(count - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const hit = flat[active];
      if (hit) {
        e.preventDefault();
        hit.run();
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
            placeholder={tr('Search games, party games or pages')}
            aria-label={tr('Search games')}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[active] ? `${listId}-${flat[active].key}` : undefined}
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
          {sections.map((s, si) => (
            <li key={s.kind} role="presentation" className="search-group">
              <p className="search-group-label mono" aria-hidden="true">
                {s.label}
              </p>
              <ul role="group" aria-label={s.label}>
                {s.hits.map((h, hi) => {
                  const i = starts[si]! + hi;
                  return (
                    <li key={h.key} id={`${listId}-${h.key}`} role="option" aria-selected={i === active} className="search-hit" data-accent={h.accent} onMouseEnter={() => setActive(i)} onClick={h.run}>
                      {h.view}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        {count === 0 && <p className="search-empty">{tr('Nothing matches “{q}”. Try a game, a category or a page like “profile”.', { q: q.trim() })}</p>}
        <p className="search-foot mono" aria-hidden="true">
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> {tr('to move')} · <span className="kbd">Enter</span> {tr('to open')} · <span className="kbd">Esc</span> {tr('to close')}
        </p>
      </div>
    </dialog>
  );
}
