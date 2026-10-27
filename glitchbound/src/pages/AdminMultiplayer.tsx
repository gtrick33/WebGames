import { useMemo, useState, type DragEvent } from 'react';
import { multiplayerSlugs, MULTIPLAYER_MAX } from '../catalog/multiplayer';
import type { GameEntry } from '../catalog/types';
import type { AdminCatalog } from '../platform/apiTypes';
import { bestPool } from './AdminBest';
import './AdminLayout.css';

/**
 * Admin › Home page › Live games: the home page's row of games friends play together live ("Better with
 * friends"). Same tools as Our best games (drag or arrows to reorder, a card's menu to swap a game in), plus
 * add and remove. Without a published list every game with a live room shows; an empty list hides the row.
 * It edits the home page's draft (admin/homeDraft.ts): nothing changes for players until Publish.
 */

/** The list as published (every live game when none was). */
export const savedMultiplayer = (data: AdminCatalog): string[] => multiplayerSlugs(bestPool(data), data.multiplayer);

/** `catalog`: the draft as players would get it; `value` and `onChange`: the row in the draft; `custom`: a list has been published. */
export function MultiplayerEditor({ catalog, value, onChange, custom, busy }: { catalog: AdminCatalog; value: string[]; onChange: (list: string[]) => void; custom: boolean; busy: boolean }) {
  // live games first in the menus: they are the ones that belong here
  const pool = useMemo(() => {
    const all = bestPool(catalog);
    return [...all.filter((g) => g.live), ...all.filter((g) => !g.live)];
  }, [catalog]);
  const draft = value;
  const setDraft = (fn: (d: string[]) => string[]): void => onChange(fn(draft));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const everyLive = multiplayerSlugs(bestPool(catalog), null);
  const game = (slug: string): GameEntry | undefined => pool.find((g) => g.slug === slug);
  const label = (g: GameEntry): string => (g.live ? `${g.title} · live` : g.title);
  const status = !draft.length ? 'Hidden on the home page' : custom ? 'Your list live' : 'Every live game';

  const swap = (i: number, j: number): void =>
    setDraft((d) => {
      if (j < 0 || j >= d.length || i === j) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  // Picking a game already on another card swaps the two; any other game simply takes the card.
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

  const addable = pool.filter((g) => !draft.includes(g.slug));

  return (
    <section className="panel info-block" aria-labelledby="ag-multiplayer">
      <div className="admin-row">
        <h2 id="ag-multiplayer">Live games · Better with friends</h2>
        <span className="mono info-small">{status}</span>
      </div>
      <p className="info-small">The games friends play together live, in the home page’s Better with friends section. Reorder, swap, add or remove cards; remove them all to hide the row.</p>

      <ol className="ab-row am-row" aria-label="Live multiplayer games, in order">
        {draft.map((slug, i) => {
          const g = game(slug);
          if (!g) return null;
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
                {!g.live && (
                  <span className="ab-theme am-warn" title="This game has no live room: friends can't play it together">
                    not live
                  </span>
                )}
              </div>
              <div className="ab-body">
                <b className="ab-title">{g.title}</b>
                <label className="ab-swap">
                  <span className="sr-only">Swap card {i + 1} for another game</span>
                  <select className="field" value={slug} disabled={busy} onChange={(e) => pick(i, e.target.value)}>
                    {pool.map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {draft.includes(o.slug) && o.slug !== slug ? `↔ ${o.title} (card ${draft.indexOf(o.slug) + 1})` : label(o)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="am-tools">
                  <div className="seg ab-move">
                    <button type="button" onClick={() => swap(i, i - 1)} disabled={busy || i === 0} aria-label={`Move ${g.title} earlier`}>
                      ←
                    </button>
                    <button type="button" onClick={() => swap(i, i + 1)} disabled={busy || i === draft.length - 1} aria-label={`Move ${g.title} later`}>
                      →
                    </button>
                  </div>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => d.filter((s) => s !== slug))} disabled={busy} aria-label={`Remove ${g.title}`}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {draft.length < MULTIPLAYER_MAX && addable.length > 0 && (
          <li className="am-add">
            <label>
              <span className="mono info-small">Add a game</span>
              <select
                className="field"
                value=""
                disabled={busy}
                onChange={(e) => {
                  const slug = e.target.value;
                  if (slug) setDraft((d) => [...d, slug]);
                }}
              >
                <option value="">Choose…</option>
                {addable.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {label(o)}
                  </option>
                ))}
              </select>
            </label>
          </li>
        )}
      </ol>

      <div className="reset-row">
        <button className="btn btn-sm btn-ghost" disabled={busy || draft.join() === everyLive.join()} onClick={() => onChange(everyLive)}>
          Every live game
        </button>
      </div>
    </section>
  );
}
