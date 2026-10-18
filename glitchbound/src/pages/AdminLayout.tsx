import { useMemo, useState } from 'react';
import { queryGames } from '../catalog/catalog';
import { GAMES } from '../catalog/games';
import { ACCENTS, applySettings, orderByLayout, settingsFor, STICKER_MAX, tileSizeFor, type HomeLayout, type TileSize } from '../catalog/settings';
import type { Accent, GameEntry } from '../catalog/types';
import type { AdminCatalog } from '../platform/apiTypes';
import './AdminLayout.css';

/**
 * Admin › Games › Home page banners: the arcade grid in miniature. Click a banner to move it, resize
 * it, recolour it or give it a sticker; presets restyle the whole grid in one click. Nothing changes
 * for players until "Publish".
 */

type Send = (body: Record<string, unknown>, done?: string) => Promise<boolean>;

const SIZE_LABEL: Record<TileSize | 'auto', string> = { auto: 'Auto', md: 'Small', wide: 'Wide', tall: 'Tall', xl: 'Big' };
const STICKERS = ['🔥 Hot', '✨ Updated', '⭐ Staff pick', '🎉 Event', '👑 Top rated'];

/** Whole-grid looks, applied to the games in their current order. */
const PRESETS: { id: string; label: string; hint: string; sizes: (i: number) => TileSize | null }[] = [
  { id: 'mosaic', label: 'Mosaic', hint: 'The automatic mix of big, tall and small banners', sizes: () => null },
  { id: 'even', label: 'Even grid', hint: 'Every banner the same size, four per row', sizes: () => 'md' },
  { id: 'hero', label: 'Big first', hint: 'One big banner, then even rows', sizes: (i) => (i === 0 ? 'xl' : 'md') },
  { id: 'wide', label: 'Wide rows', hint: 'Two wide banners per row', sizes: () => 'wide' },
];

const emptyLayout = (): HomeLayout => ({ order: [], sizes: {}, accents: {}, stickers: {} });

export function LayoutEditor({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  // The games players see, newest first: the arcade's order before any layout.
  const visible = useMemo(() => queryGames({ sort: 'newest' }, applySettings(GAMES, data)), [data]);
  const saved = data.layout ?? null;
  const [draft, setDraft] = useState<HomeLayout>(() => {
    const base = saved ?? emptyLayout();
    return { ...base, order: orderByLayout(visible, base).map((g) => g.slug) };
  });
  const [sel, setSel] = useState<string | null>(null);

  // What the arcade will show: draft order, with pinned games still first.
  const shown = useMemo(() => {
    const ordered = orderByLayout(visible, draft);
    const pinned = (g: GameEntry): boolean => settingsFor(data, g.slug).pinned;
    return [...ordered.filter(pinned), ...ordered.filter((g) => !pinned(g))];
  }, [visible, draft, data]);
  const selected = shown.find((g) => g.slug === sel) ?? null;
  const dirty = JSON.stringify(normal(draft, visible)) !== JSON.stringify(normal(saved ?? emptyLayout(), visible));

  const update = (fn: (l: HomeLayout) => HomeLayout): void => setDraft((l) => fn({ ...l, sizes: { ...l.sizes }, accents: { ...l.accents }, stickers: { ...l.stickers }, order: [...l.order] }));

  const move = (slug: string, to: 'first' | 'up' | 'down' | 'last'): void =>
    update((l) => {
      const order = shown.map((g) => g.slug);
      const i = order.indexOf(slug);
      order.splice(i, 1);
      const j = to === 'first' ? 0 : to === 'last' ? order.length : to === 'up' ? Math.max(0, i - 1) : Math.min(order.length, i + 1);
      order.splice(j, 0, slug);
      return { ...l, order };
    });

  const setSize = (slug: string, size: TileSize | 'auto'): void =>
    update((l) => {
      if (size === 'auto') delete l.sizes[slug];
      else l.sizes[slug] = size;
      return l;
    });

  const preset = (p: (typeof PRESETS)[number]): void =>
    update((l) => {
      const sizes: HomeLayout['sizes'] = {};
      shown.forEach((g, i) => {
        const s = p.sizes(i);
        if (s) sizes[g.slug] = s;
      });
      return { ...l, sizes };
    });

  const sortBy = (how: 'newest' | 'az'): void => update((l) => ({ ...l, order: queryGames({ sort: how }, visible).map((g) => g.slug) }));

  return (
    <section className="panel info-block" aria-labelledby="ag-layout">
      <div className="admin-row">
        <h2 id="ag-layout">Home page banners</h2>
        <span className="mono info-small">{saved ? 'Custom layout live' : 'Automatic'}</span>
      </div>
      <p className="info-small">Click a banner to move, resize, recolour or label it. Players see it after you publish. On phones every banner is full width, in this order.</p>

      <div className="al-presets">
        <span className="al-label">Look</span>
        {PRESETS.map((p) => (
          <button key={p.id} className="btn btn-sm" title={p.hint} onClick={() => preset(p)} disabled={busy}>
            {p.label}
          </button>
        ))}
        <span className="al-label">Order</span>
        <button className="btn btn-sm" onClick={() => sortBy('newest')} disabled={busy}>
          Newest first
        </button>
        <button className="btn btn-sm" onClick={() => sortBy('az')} disabled={busy}>
          A to Z
        </button>
      </div>

      <div className="al-grid" role="listbox" aria-label="Arcade banners in order">
        {shown.map((g, i) => {
          const size = tileSizeFor(draft, g.slug, i);
          const accent = draft.accents[g.slug] ?? g.accent;
          const sticker = draft.stickers[g.slug];
          const art = size === 'xl' || size === 'wide' ? g.art.wide : g.art.tile;
          return (
            <button
              key={g.slug}
              role="option"
              aria-selected={sel === g.slug}
              className={`al-tile al-${size}${sel === g.slug ? ' is-sel' : ''}`}
              style={{ ['--acc' as string]: `var(--${accent})`, backgroundImage: `url(${art})`, backgroundColor: g.art.bg }}
              onClick={() => setSel(sel === g.slug ? null : g.slug)}
            >
              <span className="al-n mono">{i + 1}</span>
              {sticker && <span className="al-sticker">{sticker}</span>}
              <span className="al-name">
                {settingsFor(data, g.slug).pinned && '📌 '}
                {g.title}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <TileTools
          key={selected.slug}
          game={selected}
          index={shown.indexOf(selected)}
          count={shown.length}
          layout={draft}
          pinned={settingsFor(data, selected.slug).pinned}
          onMove={(to) => move(selected.slug, to)}
          onSize={(s) => setSize(selected.slug, s)}
          onAccent={(a) =>
            update((l) => {
              if (a) l.accents[selected.slug] = a;
              else delete l.accents[selected.slug];
              return l;
            })
          }
          onSticker={(t) =>
            update((l) => {
              const v = t.trim().slice(0, STICKER_MAX);
              if (v) l.stickers[selected.slug] = v;
              else delete l.stickers[selected.slug];
              return l;
            })
          }
        />
      ) : (
        <p className="info-small al-hint">Pick a banner above to change it.</p>
      )}

      <div className="reset-row">
        <button className="btn btn-sm btn-primary" disabled={busy || !dirty} onClick={() => void send({ action: 'layout', layout: normal(draft, visible) }, 'Banners published')}>
          Publish
        </button>
        <button
          className="btn btn-sm btn-ghost"
          disabled={busy || !dirty}
          onClick={() => {
            const base = saved ?? emptyLayout();
            setDraft({ ...base, order: orderByLayout(visible, base).map((g) => g.slug) });
          }}
        >
          Undo changes
        </button>
        {saved && (
          <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void send({ action: 'layout', layout: null }, 'Back to the automatic layout')}>
            Back to automatic
          </button>
        )}
      </div>
    </section>
  );
}

/** The stored form: the full order of the games shown, and only real choices in the maps. */
function normal(l: HomeLayout, visible: GameEntry[]): HomeLayout {
  return { order: orderByLayout(visible, l).map((g) => g.slug), sizes: l.sizes, accents: l.accents, stickers: l.stickers };
}

function TileTools(props: {
  game: GameEntry;
  index: number;
  count: number;
  layout: HomeLayout;
  pinned: boolean;
  onMove: (to: 'first' | 'up' | 'down' | 'last') => void;
  onSize: (s: TileSize | 'auto') => void;
  onAccent: (a: Accent | null) => void;
  onSticker: (t: string) => void;
}) {
  const { game, index, count, layout } = props;
  const size = layout.sizes[game.slug] ?? 'auto';
  const accent = layout.accents[game.slug] ?? null;
  const sticker = layout.stickers[game.slug] ?? '';
  const [custom, setCustom] = useState(STICKERS.includes(sticker) ? '' : sticker);
  return (
    <div className="al-tools">
      <div className="al-tools-head">
        <img src={game.art.tile} alt="" width={40} height={40} />
        <b>{game.title}</b>
        <span className="mono info-small">
          #{index + 1} of {count}
        </span>
      </div>
      <div className="al-row">
        <span className="al-label">Position</span>
        <div className="seg">
          <button onClick={() => props.onMove('first')} disabled={index === 0} aria-label="Move to the front">
            ⇤ First
          </button>
          <button onClick={() => props.onMove('up')} disabled={index === 0}>
            ← Earlier
          </button>
          <button onClick={() => props.onMove('down')} disabled={index === count - 1}>
            Later →
          </button>
          <button onClick={() => props.onMove('last')} disabled={index === count - 1} aria-label="Move to the end">
            Last ⇥
          </button>
        </div>
        {props.pinned && <span className="info-small">📌 Pinned games always come first (switch it off below to move it freely).</span>}
      </div>
      <div className="al-row">
        <span className="al-label">Size</span>
        <div className="seg">
          {(['auto', 'md', 'wide', 'tall', 'xl'] as const).map((s) => (
            <button key={s} className={size === s ? 'is-on' : ''} aria-pressed={size === s} onClick={() => props.onSize(s)}>
              <i className={`al-shape al-shape-${s}`} aria-hidden="true" />
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="al-row">
        <span className="al-label">Colour</span>
        <div className="al-swatches">
          <button className={`al-swatch is-default${accent === null ? ' is-on' : ''}`} style={{ ['--acc' as string]: `var(--${game.accent})` }} onClick={() => props.onAccent(null)} title="The game's own colour" aria-label="Default colour">
            ↺
          </button>
          {ACCENTS.map((a) => (
            <button key={a} className={`al-swatch${accent === a ? ' is-on' : ''}`} style={{ ['--acc' as string]: `var(--${a})` }} onClick={() => props.onAccent(a)} title={a} aria-label={a} />
          ))}
        </div>
      </div>
      <div className="al-row">
        <span className="al-label">Sticker</span>
        <div className="al-stickers">
          <button className={`btn btn-sm${!sticker ? ' btn-primary' : ''}`} onClick={() => props.onSticker('')}>
            None
          </button>
          {STICKERS.map((t) => (
            <button key={t} className={`btn btn-sm${sticker === t ? ' btn-primary' : ''}`} onClick={() => props.onSticker(t)}>
              {t}
            </button>
          ))}
          <input
            className="field al-custom"
            value={custom}
            maxLength={STICKER_MAX}
            placeholder="Your own…"
            onChange={(e) => {
              setCustom(e.target.value);
              props.onSticker(e.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
}
