import { useMemo, useState, type DragEvent } from 'react';
import { chosenFlagships, FLAGSHIP_FALLBACK, flagshipGames, flagshipSlugs } from '../catalog/flagships';
import { GAMES } from '../catalog/games';
import { applySettings, orderByLayout } from '../catalog/settings';
import type { GameEntry } from '../catalog/types';
import type { AdminCatalog } from '../platform/apiTypes';
import { dayKey } from '../platform/dates';
import { themeOf } from '../platform/themes';
import './AdminLayout.css';

/**
 * Admin › Home page › Our best games: the four big cards right under the hero, edited as a row of their own.
 * Drag a card onto another (or use the arrows) to reorder, pick any game from a card's menu to swap it in.
 * It edits the home page's draft (admin/homeDraft.ts): nothing changes for players until Publish.
 */

/** The arcade games players can see, in the banners' order (what the best games are picked from). */
export function bestPool(data: AdminCatalog): GameEntry[] {
  return orderByLayout(
    applySettings(GAMES, data).filter((g) => !g.partyOnly && !g.section),
    data.layout ?? null,
  );
}

/** The four best games as saved (the house picks fill in when none were chosen). */
export const savedBest = (data: AdminCatalog): string[] => {
  const pool = bestPool(data);
  return flagshipSlugs(pool, chosenFlagships(data, pool));
};


/**
 * `catalog`: the draft as players would get it (hidden games are not offered); `value` and `onChange`: the row
 * in the draft; `custom`: a list has been published (else the house picks show).
 */
export function BestGamesEditor({ catalog, value, onChange, custom, busy }: { catalog: AdminCatalog; value: string[]; onChange: (list: string[]) => void; custom: boolean; busy: boolean }) {
  const pool = useMemo(() => bestPool(catalog), [catalog]);
  const draft = value;
  const setDraft = (fn: (d: string[]) => string[]): void => onChange(fn(draft));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const house = flagshipSlugs(pool, []);
  const game = (slug: string): GameEntry | undefined => pool.find((g) => g.slug === slug);
  const theme = themeOf(dayKey());
  const today = flagshipGames(pool, draft, theme);
  const lead = today.find((f) => f.themed)?.game;

  const swap = (i: number, j: number): void =>
    setDraft((d) => {
      if (j < 0 || j >= d.length || i === j) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  // Picking a game already in another slot swaps the two; any other game simply takes the slot.
  const pick = (i: number, slug: string): void =>
    setDraft((d) => {
      const next = [...d];
      const at = next.indexOf(slug);
      if (at >= 0) next[at] = next[i]!;
      next[i] = slug;
      return next;
    });

  const onDrop = (i: number) => (e: DragEvent): void => {
    e.preventDefault();
    if (dragFrom !== null) swap(dragFrom, i);
    setDragFrom(null);
  };

  return (
    <section className="panel info-block" aria-labelledby="ag-best">
      <div className="admin-row">
        <h2 id="ag-best">Our best games</h2>
        <span className="mono info-small">{custom ? 'Your picks live' : 'House picks live'}</span>
      </div>
      <p className="info-small">The four big cards right under the hero. Drag a card onto another, or use the arrows, to change the order; pick any game from a card’s menu to swap it in.</p>

      <ol className="ab-row" aria-label="Our best games, in order">
        {draft.map((slug, i) => {
          const g = game(slug);
          if (!g) return null;
          const isHouse = FLAGSHIP_FALLBACK.includes(slug) && !custom && draft.join() === house.join();
          return (
            <li
              key={slug}
              className={`ab-card${dragFrom === i ? ' is-drag' : ''}`}
              draggable={!busy}
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', slug);
              }}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(i)}
            >
              <div className="ab-art" style={{ background: g.art.bg }}>
                <img src={g.art.tile} alt="" width={160} height={160} draggable={false} />
                <span className="al-n mono ab-n">{i + 1}</span>
                {lead?.slug === slug && (
                  <span className="ab-theme" title={`Today is ${theme.name}: this card moves to the front for players`}>
                    {theme.emoji} first today
                  </span>
                )}
              </div>
              <div className="ab-body">
                <b className="ab-title">{g.title}</b>
                {isHouse && <span className="al-best-tag mono">house pick</span>}
                <label className="ab-swap">
                  <span className="sr-only">Swap card {i + 1} for another game</span>
                  <select className="field" value={slug} disabled={busy} onChange={(e) => pick(i, e.target.value)}>
                    {pool.map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {draft.includes(o.slug) && o.slug !== slug ? `↔ ${o.title} (card ${draft.indexOf(o.slug) + 1})` : o.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="seg ab-move">
                  <button type="button" onClick={() => swap(i, i - 1)} disabled={busy || i === 0} aria-label={`Move ${g.title} earlier`}>
                    ←
                  </button>
                  <button type="button" onClick={() => swap(i, i + 1)} disabled={busy || i === draft.length - 1} aria-label={`Move ${g.title} later`}>
                    →
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {lead && (
        <p className="info-small">
          {theme.emoji} Today is {theme.name}: players see {lead.title} first, then the rest in this order.
        </p>
      )}

      <div className="reset-row">
        <button className="btn btn-sm btn-ghost" disabled={busy || draft.join() === house.join()} onClick={() => onChange(house)}>
          Use the house picks
        </button>
      </div>
    </section>
  );
}
