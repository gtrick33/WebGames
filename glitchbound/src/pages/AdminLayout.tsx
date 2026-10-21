import { useMemo, useState } from 'react';
import { queryGames } from '../catalog/catalog';
import { flagshipGames } from '../catalog/flagships';
import { GAMES } from '../catalog/games';
import { ACCENTS, applySettings, orderByLayout, settingsFor, STICKER_MAX, tileSizeFor, type GameSettings, type HomeLayout, type TileSize } from '../catalog/settings';
import type { Accent, GameEntry } from '../catalog/types';
import type { AdminCatalog } from '../platform/apiTypes';
import { dayKey } from '../platform/dates';
import { refreshCatalog } from '../platform/liveCatalog';
import { activeHoliday, autoHoliday, HOLIDAYS, type SeasonSetting } from '../platform/seasons';
import './AdminLayout.css';

/**
 * Admin › Games › Home page banners: the arcade grid in miniature. Click a banner to move it, resize
 * it, recolor it, give it a sticker, or flip its switches (visible, pinned, spotlight, best game);
 * presets restyle the whole grid in one click. The order and looks go live on "Publish"; the switches
 * save right away. The "Start here" strip previews the four best games this order and the switches
 * give the home page.
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
  // Every arcade game, newest first (the arcade's order before any layout). Hidden games stay in the
  // editor, dimmed, so they can be switched back on from here; players never see them.
  const editable = useMemo(() => queryGames({ sort: 'newest' }, applySettings(GAMES, data, true).filter((g) => !g.partyOnly)), [data]);
  const saved = data.layout ?? null;
  const [draft, setDraft] = useState<HomeLayout>(() => {
    const base = saved ?? emptyLayout();
    return { ...base, order: orderByLayout(editable, base).map((g) => g.slug) };
  });
  const [sel, setSel] = useState<string | null>(null);

  // What the arcade will show: draft order, with pinned games still first.
  const shown = useMemo(() => {
    const ordered = orderByLayout(editable, draft);
    const pinned = (g: GameEntry): boolean => settingsFor(data, g.slug).pinned;
    return [...ordered.filter(pinned), ...ordered.filter((g) => !pinned(g))];
  }, [editable, draft, data]);
  const selected = shown.find((g) => g.slug === sel) ?? null;
  const flags = (slug: string): GameSettings => settingsFor(data, slug);
  // The "Start here" row this order and the Best game switches give players (the day's theme may still move one first).
  const best = flagshipGames(
    shown.filter((g) => !flags(g.slug).hidden),
    (slug) => flags(slug).flagship,
  );
  const dirty = JSON.stringify(normal(draft, editable)) !== JSON.stringify(normal(saved ?? emptyLayout(), editable));

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

  const sortBy = (how: 'newest' | 'az'): void => update((l) => ({ ...l, order: queryGames({ sort: how }, editable).map((g) => g.slug) }));

  return (
    <section className="panel info-block" aria-labelledby="ag-layout">
      <div className="admin-row">
        <h2 id="ag-layout">Home page banners</h2>
        <span className="mono info-small">{saved ? 'Custom layout live' : 'Automatic'}</span>
      </div>
      <p className="info-small">Click a banner to move, resize, recolor or label it, or to switch it on or off, pin it, spotlight it or make it a best game. Order and looks go live when you publish; the switches save right away. On phones banners show two per row in this order; big and wide ones take the whole row.</p>

      <div className="al-best" role="group" aria-label="Start here: the best games">
        <span className="al-label">Start here</span>
        <ol className="al-best-list">
          {best.map(({ game: g }, i) => {
            const chosen = flags(g.slug).flagship;
            return (
              <li key={g.slug} className={`al-best-card${chosen ? '' : ' is-default'}${sel === g.slug ? ' is-sel' : ''}`}>
                <button type="button" aria-pressed={sel === g.slug} onClick={() => setSel(sel === g.slug ? null : g.slug)} title={chosen ? 'A best game: click to change it' : 'A house pick, filling in: switch Best game on a banner to choose your own'}>
                  <span className="al-n mono">{i + 1}</span>
                  <img src={g.art.tile} alt="" width={36} height={36} style={{ background: g.art.bg }} />
                  <span className="al-best-name">{g.title}</span>
                  {!chosen && <span className="al-best-tag mono">default</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <span className="info-small">The four big cards under the hero, in banner order. Switch “Best game” on a banner to choose them; with fewer than four, the house picks fill in. The day’s theme may move one of them to the front.</span>
      </div>

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
          const f = flags(g.slug);
          return (
            <button
              key={g.slug}
              role="option"
              aria-selected={sel === g.slug}
              className={`al-tile al-${size}${sel === g.slug ? ' is-sel' : ''}${f.hidden ? ' is-hidden' : ''}`}
              style={{ ['--acc' as string]: `var(--${accent})`, backgroundImage: `url(${art})`, backgroundColor: g.art.bg }}
              onClick={() => setSel(sel === g.slug ? null : g.slug)}
            >
              <span className="al-n mono">{i + 1}</span>
              {f.hidden ? <span className="al-badge">Hidden</span> : sticker && <span className="al-sticker">{sticker}</span>}
              <span className="al-name">
                {f.pinned && '📌 '}
                {f.spotlight && '🔦 '}
                {f.flagship && '⭐ '}
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
          settings={flags(selected.slug)}
          busy={busy}
          onFlag={(patch, msg) => void send({ action: 'game', slug: selected.slug, patch }, msg)}
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
        <button className="btn btn-sm btn-primary" disabled={busy || !dirty} onClick={() => void send({ action: 'layout', layout: normal(draft, editable) }, 'Banners published')}>
          Publish
        </button>
        <button
          className="btn btn-sm btn-ghost"
          disabled={busy || !dirty}
          onClick={() => {
            const base = saved ?? emptyLayout();
            setDraft({ ...base, order: orderByLayout(editable, base).map((g) => g.slug) });
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
function normal(l: HomeLayout, editable: GameEntry[]): HomeLayout {
  return { order: orderByLayout(editable, l).map((g) => g.slug), sizes: l.sizes, accents: l.accents, stickers: l.stickers };
}

function TileTools(props: {
  game: GameEntry;
  index: number;
  count: number;
  layout: HomeLayout;
  settings: GameSettings;
  busy: boolean;
  /** Flips one of the game's switches (saved right away, unlike the layout). */
  onFlag: (patch: Partial<GameSettings>, msg?: string) => void;
  onMove: (to: 'first' | 'up' | 'down' | 'last') => void;
  onSize: (s: TileSize | 'auto') => void;
  onAccent: (a: Accent | null) => void;
  onSticker: (t: string) => void;
}) {
  const { game, index, count, layout, settings: s } = props;
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
        {s.pinned && <span className="info-small">📌 Pinned games always come first (switch it off below to move it freely).</span>}
      </div>
      <div className="al-row">
        <span className="al-label">Show as</span>
        <div className="al-flags">
          <Switch on={!s.hidden} label="Visible" hint="Hidden games disappear from the arcade, search and dailies; the page is closed to players." disabled={props.busy} onChange={(v) => props.onFlag({ hidden: !v }, v ? `${game.title} is visible` : `${game.title} is hidden`)} />
          <Switch on={s.pinned} label="Pinned" hint="Shown first in the arcade grid." disabled={props.busy} onChange={(v) => props.onFlag({ pinned: v })} />
          <Switch on={s.spotlight} label="Spotlight" hint="Today’s pick in the hero (one game at a time)." disabled={props.busy} onChange={(v) => props.onFlag({ spotlight: v })} />
          <Switch on={s.flagship} label="Best game" hint="One of the four Start here cards under the hero, in banner order." disabled={props.busy} onChange={(v) => props.onFlag({ flagship: v }, v ? `${game.title} is a best game` : `${game.title} is no longer a best game`)} />
        </div>
        <span className="info-small">Saved right away, no publish needed.</span>
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
        <span className="al-label">Color</span>
        <div className="al-swatches">
          <button className={`al-swatch is-default${accent === null ? ' is-on' : ''}`} style={{ ['--acc' as string]: `var(--${game.accent})` }} onClick={() => props.onAccent(null)} title="The game's own color" aria-label="Default color">
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

/** An on/off switch with a label, as used across the admin's Games tab. */
export function Switch({ on, label, hint, disabled, onChange }: { on: boolean; label: string; hint?: string; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`ag-switch${on ? ' is-on' : ''}`} role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} title={hint}>
      <span className="ag-knob" aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Admin › Games › Holiday look: one click switches the site's holiday touches (greeting, logo
 * sticker, floating decorations, highlight colors). Automatic follows the calendar.
 */
export function SeasonPicker({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const current: SeasonSetting = data.season ?? 'auto';
  const today = dayKey();
  const now = activeHoliday(current, today);
  const auto = autoHoliday(today);
  const pick = (season: SeasonSetting): void => {
    if (season === current) return;
    const label = season === 'auto' ? 'Holiday look: automatic' : season === 'off' ? 'Holiday look: off' : `Holiday look: ${HOLIDAYS.find((h) => h.id === season)?.name}`;
    // Show the new look in this browser straight away too.
    void send({ action: 'season', season }, label).then(async (ok) => {
      if (ok) await refreshCatalog();
    });
  };
  return (
    <section className="panel info-block" aria-labelledby="ag-season">
      <div className="admin-row">
        <h2 id="ag-season">Holiday look</h2>
        <span className="mono info-small">{now ? `Live now: ${now.emoji} ${now.name}` : 'No holiday look live'}</span>
      </div>
      <p className="info-small">A greeting on the home page, a sticker on the logo, a few floating decorations and festive colors. Automatic switches them on around Halloween, Diwali, the winter holidays, Lunar New Year, Valentine’s Day and Easter.</p>
      <div className="as-grid" role="radiogroup" aria-label="Holiday look">
        <button role="radio" aria-checked={current === 'auto'} className={`as-card${current === 'auto' ? ' is-on' : ''}`} style={{ ['--c1' as string]: '#2ad1f0', ['--c2' as string]: '#b6e62c' }} onClick={() => pick('auto')} disabled={busy}>
          <span className="as-emoji">🗓️</span>
          Automatic
          <span className="as-note">{auto ? `today: ${HOLIDAYS.find((h) => h.id === auto)?.name}` : 'today: none'}</span>
        </button>
        {HOLIDAYS.map((h) => (
          <button key={h.id} role="radio" aria-checked={current === h.id} className={`as-card${current === h.id ? ' is-on' : ''}`} style={{ ['--c1' as string]: h.colors[0], ['--c2' as string]: h.colors[1] }} onClick={() => pick(h.id)} disabled={busy}>
            <span className="as-emoji">{h.emoji}</span>
            {h.name}
            <span className="as-note">{h.decor.slice(0, 3).join(' ')}</span>
          </button>
        ))}
        <button role="radio" aria-checked={current === 'off'} className={`as-card${current === 'off' ? ' is-on' : ''}`} style={{ ['--c1' as string]: '#888', ['--c2' as string]: '#555' }} onClick={() => pick('off')} disabled={busy}>
          <span className="as-emoji">🚫</span>
          Off
          <span className="as-note">never</span>
        </button>
      </div>
    </section>
  );
}
