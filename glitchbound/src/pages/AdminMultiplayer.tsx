import { useMemo, useState, type DragEvent } from 'react';
import { multiplayerSlugs, MULTIPLAYER_MAX } from '../catalog/multiplayer';
import type { GameEntry } from '../catalog/types';
import type { AdminCatalog } from '../platform/apiTypes';
import { bestPool } from './AdminBest';
import './AdminLayout.css';

/**
 * Admin › Games › Live multiplayer games: the home page's row of games friends play together live,
 * right under Our best games. Same tools as that row (drag or arrows to reorder, a card's menu to swap
 * a game in), plus add and remove. Without a saved list every game with a live room shows; publishing
 * an empty list hides the section. Nothing changes for players until "Publish".
 */

type Send = (body: Record<string, unknown>, done?: string) => Promise<boolean>;

/** The list as saved (every live game when none was). */
export const savedMultiplayer = (data: AdminCatalog): string[] => multiplayerSlugs(bestPool(data), data.multiplayer);

export function MultiplayerEditor({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  // live games first in the menus: they are the ones that belong here
  const pool = useMemo(() => {
    const all = bestPool(data);
    return [...all.filter((g) => g.live), ...all.filter((g) => !g.live)];
  }, [data]);
  const saved = useMemo(() => savedMultiplayer(data), [data]);
  const custom = Array.isArray(data.multiplayer);
  const [draft, setDraft] = useState<string[]>(saved);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const dirty = draft.join() !== saved.join();
  const game = (slug: string): GameEntry | undefined => pool.find((g) => g.slug === slug);
  const label = (g: GameEntry): string => (g.live ? `${g.title} · live` : g.title);
  const status = !custom ? 'Every live game' : saved.length ? 'Your list live' : 'Hidden on the home page';

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
        <h2 id="ag-multiplayer">Live multiplayer games</h2>
        <span className="mono info-small">{status}</span>
      </div>
      <p className="info-small">
        The row of games friends play together live, right under Our best games on the home page. Drag a card onto another, or use the arrows, to change the order. Pick a game from a card’s menu to swap it in, add one with the
        menu at the end, or remove one. Remove them all and publish to hide the row. Players see the change after you publish.
      </p>

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
        <button className="btn btn-sm btn-primary" disabled={busy || !dirty} onClick={() => void send({ action: 'multiplayer', list: draft }, draft.length ? 'Live multiplayer games published' : 'Live multiplayer games hidden')}>
          Publish
        </button>
        <button className="btn btn-sm btn-ghost" disabled={busy || !dirty} onClick={() => setDraft(saved)}>
          Undo changes
        </button>
        {custom && (
          <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void send({ action: 'multiplayer', list: null }, 'Live multiplayer games: back to every live game')}>
            Back to every live game
          </button>
        )}
      </div>
    </section>
  );
}
