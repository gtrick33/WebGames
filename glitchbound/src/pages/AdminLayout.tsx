import { useMemo, useState } from 'react';
import { autoNewSlugs, gameUrl, queryGames } from '../catalog/catalog';
import { GAMES } from '../catalog/games';
import { ACCENTS, applySettings, DEFAULT_SETTINGS, orderByLayout, settingsFor, STICKER_MAX, TEXT_LIMITS, tileSizeFor, type GameSettings, type HomeLayout, type NewBadge, type TileSize } from '../catalog/settings';
import type { Accent, GameEntry } from '../catalog/types';
import { Icon } from '../components/Icon';
import type { AdminCatalog } from '../platform/apiTypes';
import { dayKey } from '../platform/dates';
import { refreshCatalog } from '../platform/liveCatalog';
import { activeHoliday, autoHoliday, HOLIDAYS, type SeasonSetting } from '../platform/seasons';
import { Link } from '../router/router';
import { editableGames, emptyLayout, withBest, withGame, type HomeDraft } from './admin/homeDraft';
import './AdminLayout.css';

type Send = (body: Record<string, unknown>, done?: string) => Promise<boolean>;

/**
 * Admin › Home page › Arcade banners: the arcade grid in miniature. Click a banner to move, resize, recolor or
 * label it, and to change everything about its game: visible, pinned, today's pick, best game, NEW badge, the
 * daily rotation, its texts and a pause message. Presets restyle the whole grid in one click. It all edits the
 * home page's draft (admin/homeDraft.ts): nothing changes for players until Publish.
 */

const SIZE_LABEL: Record<TileSize | 'auto', string> = { auto: 'Auto', md: 'Small', wide: 'Wide', tall: 'Tall', xl: 'Big' };
const STICKERS = ['🔥 Hot', '✨ Updated', '⭐ Staff pick', '🎉 Event', '👑 Top rated'];

/** Whole-grid looks, applied to the games in their current order. */
const PRESETS: { id: string; label: string; hint: string; sizes: (i: number) => TileSize | null }[] = [
  { id: 'mosaic', label: 'Mosaic', hint: 'The automatic mix of big, tall and small banners', sizes: () => null },
  { id: 'even', label: 'Even grid', hint: 'Every banner the same size, four per row', sizes: () => 'md' },
  { id: 'hero', label: 'Big first', hint: 'One big banner, then even rows', sizes: (i) => (i === 0 ? 'xl' : 'md') },
  { id: 'wide', label: 'Wide rows', hint: 'Two wide banners per row', sizes: () => 'wide' },
];

/**
 * `catalog`: the draft as players would get it; `draft` and `onChange`: the home page's draft; `live`: what is
 * published (for the "custom layout live" note).
 */
export function LayoutEditor({ catalog, draft, onChange, live, busy }: { catalog: AdminCatalog; draft: HomeDraft; onChange: (d: HomeDraft) => void; live: AdminCatalog; busy: boolean }) {
  // Every arcade game, newest first (the arcade's order before any layout). Hidden games stay in the
  // editor, dimmed, so they can be switched back on from here; players never see them.
  const editable = useMemo(() => editableGames(catalog), [catalog]);
  const layout = draft.layout ?? emptyLayout();
  const [sel, setSel] = useState<string | null>(null);

  // What the arcade will show: draft order, with pinned games still first.
  const shown = useMemo(() => {
    const ordered = orderByLayout(editable, layout);
    const pinned = (g: GameEntry): boolean => !!draft.games[g.slug]?.pinned;
    return [...ordered.filter(pinned), ...ordered.filter((g) => !pinned(g))];
  }, [editable, layout, draft.games]);
  const selected = shown.find((g) => g.slug === sel) ?? null;
  const flags = (slug: string): GameSettings => draft.games[slug] ?? settingsFor(catalog, slug);

  // any change to the order or looks makes the layout an explicit one (from the automatic order it showed)
  const update = (fn: (l: HomeLayout) => HomeLayout): void => {
    const base = { ...layout, order: orderByLayout(editable, layout).map((g) => g.slug) };
    onChange({ ...draft, layout: fn({ ...base, sizes: { ...base.sizes }, accents: { ...base.accents }, stickers: { ...base.stickers }, order: [...base.order] }) });
  };

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
        <h2 id="ag-layout">Arcade banners · {shown.length}</h2>
        <span className="mono info-small">{live.layout ? 'Custom layout live' : 'Automatic layout live'}</span>
      </div>
      <p className="info-small">The arcade grid on the home page, in order. Click a banner to arrange it and to change anything about its game. On phones banners show two per row in this order; big and wide ones take the whole row.</p>

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
        {draft.layout && (
          <button className="btn btn-sm btn-ghost" onClick={() => onChange({ ...draft, layout: null })} disabled={busy}>
            Back to automatic
          </button>
        )}
      </div>

      <div className="al-grid" role="listbox" aria-label="Arcade banners in order">
        {shown.map((g, i) => {
          const size = tileSizeFor(layout, g.slug, i);
          const accent = layout.accents[g.slug] ?? g.accent;
          const sticker = layout.stickers[g.slug];
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
              {f.hidden ? <span className="al-badge">Hidden</span> : f.maintenance ? <span className="al-badge">Paused</span> : sticker && <span className="al-sticker">{sticker}</span>}
              <span className="al-name">
                {f.pinned && '📌 '}
                {f.spotlight && '🔦 '}
                {draft.flagships.includes(g.slug) && '⭐ '}
                {f.title || g.title}
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
          layout={layout}
          settings={flags(selected.slug)}
          autoNew={autoNewSlugs(applySettings(GAMES, catalog)).has(selected.slug)}
          best={draft.flagships.includes(selected.slug)}
          busy={busy}
          onBest={(on) => onChange(withBest(live, draft, selected.slug, on))}
          onSettings={(patch) => onChange(withGame(draft, selected.slug, patch))}
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
    </section>
  );
}

function TileTools(props: {
  game: GameEntry;
  index: number;
  count: number;
  layout: HomeLayout;
  settings: GameSettings;
  /** The automatic NEW badge would show now. */
  autoNew: boolean;
  /** In Our best games (the four big cards under the hero). */
  best: boolean;
  onBest: (on: boolean) => void;
  busy: boolean;
  /** Changes the game's settings in the draft. */
  onSettings: (patch: Partial<GameSettings>) => void;
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
  const set = props.onSettings;
  return (
    <div className="al-tools">
      <div className="al-tools-head">
        <img src={game.art.tile} alt="" width={40} height={40} />
        <b>{s.title || game.title}</b>
        <span className="mono info-small">
          #{index + 1} of {count}
        </span>
        <Link href={gameUrl(game.slug)} className="btn btn-sm btn-ghost al-open">
          <Icon name="external" size={14} /> Open page
        </Link>
      </div>

      <div className="al-row">
        <span className="al-label">Show</span>
        <div className="al-flags">
          <Switch on={!s.hidden} label="Visible" hint="Hidden games disappear from the arcade, search and dailies; the page is closed to players." disabled={props.busy} onChange={(v) => set({ hidden: !v })} />
          <Switch on={s.pinned} label="Pinned" hint="Shown first in the arcade grid." disabled={props.busy} onChange={(v) => set({ pinned: v })} />
          <Switch on={s.spotlight} label="Today’s pick" hint="The Today’s pick button in the hero (one game at a time)." disabled={props.busy || s.hidden} onChange={(v) => set({ spotlight: v })} />
          <Switch on={props.best} label="Best game" hint="One of the four big cards under the hero. Switching one on takes the last card." disabled={props.busy || s.hidden} onChange={props.onBest} />
          {game.daily?.length ? <Switch on={s.inDaily} label="In daily rotation" hint="May be picked as Today’s challenge." disabled={props.busy} onChange={(v) => set({ inDaily: v })} /> : null}
        </div>
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
        {s.pinned && <span className="info-small">📌 Pinned games always come first (unpin it to move it freely).</span>}
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
            aria-label="Your own sticker"
            onChange={(e) => {
              setCustom(e.target.value);
              props.onSticker(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="al-row">
        <span className="al-label">NEW badge</span>
        <select className="field al-select" aria-label="NEW badge" value={s.newBadge} disabled={props.busy} onChange={(e) => set({ newBadge: e.target.value as NewBadge })}>
          <option value="auto">Automatic ({props.autoNew ? 'new now' : 'not new'})</option>
          <option value="on">Always show</option>
          <option value="off">Never show</option>
        </select>
      </div>

      <div className="al-texts">
        <label className="ag-field">
          <span>Title</span>
          <input className="field" value={s.title} onChange={(e) => set({ title: e.target.value })} maxLength={TEXT_LIMITS.title} placeholder={game.title} />
        </label>
        <label className="ag-field ag-wide">
          <span>Tagline (cards and search)</span>
          <input className="field" value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={TEXT_LIMITS.tagline} placeholder={game.tagline} />
        </label>
        <label className="ag-field ag-wide">
          <span>Description (game page)</span>
          <textarea className="field" rows={3} value={s.description} onChange={(e) => set({ description: e.target.value })} maxLength={TEXT_LIMITS.description} placeholder={game.description} />
        </label>
        <label className="ag-field ag-wide">
          <span>Pause message (players see it instead of the game; empty = playable)</span>
          <input className="field" value={s.maintenance} onChange={(e) => set({ maintenance: e.target.value })} maxLength={TEXT_LIMITS.maintenance} placeholder="We’re fixing a bug in this game. Back very soon!" />
        </label>
        <p className="info-small ag-wide">Leave a text empty to use the original. Search pages for crawlers keep the original until the next deploy.</p>
        <div className="reset-row ag-wide">
          <button type="button" className="btn btn-sm btn-ghost" disabled={props.busy} onClick={() => set({ ...DEFAULT_SETTINGS, flagship: s.flagship })}>
            Reset this game’s settings
          </button>
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
 * Admin › Notice & holidays › Holiday look: one click switches the site's holiday touches (greeting, logo
 * sticker, colors, card art, scenery and its little events). Automatic follows the calendar.
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
      <p className="info-small">
        A greeting on the home page, a sticker on the logo, festive colors, the holiday’s art on every card (cobwebs, snow…), scenery behind the page (a moon, lanterns, lamps…) and now and then a little event crossing it (bats and a witch,
        a sleigh, fireworks…). It never covers text or takes a click, and stays out of games. Automatic switches it on around Halloween, Diwali, the winter holidays, Lunar New Year, Valentine’s Day and Easter.
      </p>
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
