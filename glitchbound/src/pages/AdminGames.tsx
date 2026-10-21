import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { autoNewSlugs } from '../catalog/catalog';
import { GAMES } from '../catalog/games';
import { applySettings, dailyRules, partySettingsFor, settingsFor, STICKER_MAX, TEXT_LIMITS, type DailyPick, type GameSettings, type NewBadge, type NoticeTone, type PartySettings, type PublicCatalog } from '../catalog/settings';
import type { GameEntry } from '../catalog/types';
import { Icon } from '../components/Icon';
import { api, ApiError } from '../platform/account';
import type { AdminCatalog } from '../platform/apiTypes';
import { challengeForDay, fmt } from '../platform/daily';
import { addDays, dayKey } from '../platform/dates';
import { setCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';
import { BestGamesEditor, savedBest, sendBestToggle } from './AdminBest';
import { LayoutEditor, SeasonPicker, Switch } from './AdminLayout';
import { DEFAULT_FEATURED, PARTY_GAMES, type PartyGame } from '../party/catalog';

/**
 * Admin › Games: what players see, without a rebuild. Show or hide games, pin them, choose the home
 * spotlight, the four best games and NEW badges, pause a broken game, edit texts, hand-pick daily
 * challenges, lay out the home page banners and post a site notice. Every change is written to the
 * change log.
 */

type Send = (body: Record<string, unknown>, done?: string) => Promise<boolean>;

const when = (ts: number): string => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const dayLabel = (d: string, today: string): string =>
  d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function AdminGames() {
  const [data, setData] = useState<AdminCatalog | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [view, setView] = useState<'arcade' | 'party'>('arcade');

  const load = useCallback(
    () =>
      api<AdminCatalog>('/api/admin/catalog')
        .then((d) => {
          setData(d);
          setError('');
          // The rest of the site (open in this tab) follows the change right away.
          setCatalog({ settings: d.settings, picks: d.picks, notice: d.notice, layout: d.layout ?? null, season: d.season, party: d.party, flagships: d.flagships ?? null });
        })
        .catch((e: unknown) => setError(e instanceof ApiError && e.status === 403 ? 'Only admins can change games.' : 'Could not load the game settings.')),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const send: Send = useCallback(
    async (body, done = 'Saved') => {
      setBusy(true);
      try {
        await api('/api/admin/catalog', { body });
        await load();
        setToast(done);
        return true;
      } catch (e) {
        setToast(e instanceof ApiError ? `Not saved: ${e.message ?? e.code}` : 'Not saved: network error');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (error) return <p className="info-lead">{error}</p>;
  if (!data) return <p className="info-lead">Loading game settings…</p>;
  return (
    <div className="ag" aria-busy={busy}>
      <p className="ag-toast" role="status" aria-live="polite">
        {toast}
      </p>
      <NoticeEditor data={data} send={send} busy={busy} />
      <SeasonPicker data={data} send={send} busy={busy} />
      <div className="seg ag-views" role="tablist" aria-label="Which games">
        <button role="tab" aria-selected={view === 'arcade'} className={view === 'arcade' ? 'is-on' : ''} onClick={() => setView('arcade')}>
          🕹️ Arcade
        </button>
        <button role="tab" aria-selected={view === 'party'} className={view === 'party' ? 'is-on' : ''} onClick={() => setView('party')}>
          🎉 Party Mode
        </button>
      </div>
      {view === 'arcade' ? (
        <>
          <DailyPlanner data={data} send={send} busy={busy} />
          <BestGamesEditor key={JSON.stringify(savedBest(data))} data={data} send={send} busy={busy} />
          <LayoutEditor key={JSON.stringify(data.layout ?? null)} data={data} send={send} busy={busy} />
          <GamesList data={data} send={send} busy={busy} />
        </>
      ) : (
        <PartyList data={data} send={send} busy={busy} />
      )}
      <ChangeLog log={data.log} />
    </div>
  );
}

/* ------------------------------------------------------------------ notice */

function NoticeEditor({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const n = data.notice;
  const [text, setText] = useState(n?.text ?? '');
  const [link, setLink] = useState(n?.link ?? '');
  const [tone, setTone] = useState<NoticeTone>(n?.tone ?? 'info');
  return (
    <section className="panel info-block" aria-labelledby="ag-notice">
      <div className="admin-row">
        <h2 id="ag-notice">Site notice</h2>
        <span className="mono info-small">{n ? 'Showing to everyone' : 'Off'}</span>
      </div>
      <p className="info-small">A banner under the header on every page, e.g. a new game, an event or planned maintenance. Players can dismiss it; editing it shows it again.</p>
      <form
        className="ag-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ action: 'notice', notice: { text, link, tone } }, 'Notice published');
        }}
      >
        <label className="ag-field ag-wide">
          <span>Message</span>
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={TEXT_LIMITS.notice} placeholder="🎉 Wing It is live: one tap to flap!" required />
        </label>
        <label className="ag-field">
          <span>Link (optional)</span>
          <input className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/games/wing-it or https://…" />
        </label>
        <label className="ag-field">
          <span>Style</span>
          <select className="field" value={tone} onChange={(e) => setTone(e.target.value as NoticeTone)}>
            <option value="info">Info (yellow)</option>
            <option value="party">Celebration (rainbow)</option>
            <option value="warning">Heads-up (coral)</option>
          </select>
        </label>
        <div className="reset-row ag-wide">
          <button className="btn btn-sm btn-primary" disabled={busy || !text.trim()}>
            {n ? 'Update notice' : 'Publish notice'}
          </button>
          {n && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() => {
                setText('');
                setLink('');
                void send({ action: 'notice', notice: null }, 'Notice removed');
              }}
            >
              Remove
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------- daily */

function DailyPlanner({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const rules = useMemo(() => dailyRules(data), [data]);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="panel info-block" aria-labelledby="ag-daily">
      <h2 id="ag-daily">Today’s challenge · next 14 days</h2>
      <p className="info-small">
        The arcade’s daily challenge rotates automatically through games that have one. Pick a game (and optionally the goal) for any day; hidden, paused or excluded games are skipped by the rotation.
      </p>
      <ul className="ag-days">
        {days.map((d) => {
          const c = challengeForDay(d, GAMES, rules);
          const pick = data.picks[d];
          return (
            <li key={d} className={pick ? 'is-picked' : ''}>
              <div className="ag-day-row">
                <span className="ag-day mono">{dayLabel(d, today)}</span>
                <span className="ag-day-game">
                  {c ? (
                    <>
                      <b>{c.game.title}</b> · {c.label}
                    </>
                  ) : (
                    'No challenge'
                  )}
                </span>
                {pick && <span className="ag-chip is-on">Hand-picked</span>}
                <button className="btn btn-sm" onClick={() => setEditing(editing === d ? null : d)} aria-expanded={editing === d}>
                  {editing === d ? 'Close' : 'Change'}
                </button>
              </div>
              {editing === d && <DailyEditor day={d} current={c?.game.slug ?? ''} pick={pick} send={send} busy={busy} onDone={() => setEditing(null)} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DailyEditor({ day, current, pick, send, busy, onDone }: { day: string; current: string; pick: DailyPick | undefined; send: Send; busy: boolean; onDone: () => void }) {
  const choices = GAMES.filter((g) => g.daily?.length);
  const [slug, setSlug] = useState(pick?.slug ?? current ?? choices[0]?.slug ?? '');
  const game = choices.find((g) => g.slug === slug);
  const [template, setTemplate] = useState<number | null>(pick?.template ?? null);
  const [target, setTarget] = useState(pick?.target ? String(pick.target) : '');
  const tpl = game && template !== null ? game.daily![template] : undefined;
  return (
    <form
      className="ag-form ag-sub"
      onSubmit={(e) => {
        e.preventDefault();
        const t = Number(target);
        void send({ action: 'daily', day, pick: { slug, template, target: target && t > 0 ? t : null } }, 'Daily challenge set').then((ok) => ok && onDone());
      }}
    >
      <label className="ag-field">
        <span>Game</span>
        <select
          className="field"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setTemplate(null);
            setTarget('');
          }}
        >
          {choices.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.title}
            </option>
          ))}
        </select>
      </label>
      <label className="ag-field">
        <span>Goal</span>
        <select className="field" value={template ?? ''} onChange={(e) => setTemplate(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Automatic</option>
          {game?.daily?.map((d, i) => (
            <option key={i} value={i}>
              {d.label.replace('{n}', '…')}
            </option>
          ))}
        </select>
      </label>
      <label className="ag-field">
        <span>Target (optional)</span>
        <input className="field" type="number" min={1} step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={tpl ? `e.g. ${fmt(tpl.targets[0]!)}` : 'Automatic'} />
      </label>
      <div className="reset-row ag-wide">
        <button className="btn btn-sm btn-primary" disabled={busy || !slug}>
          Save for {day}
        </button>
        {pick && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void send({ action: 'daily', day, pick: null }, 'Back to automatic').then((ok) => ok && onDone())}>
            Use automatic
          </button>
        )}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------- games */

function GamesList({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'changed' | 'hidden'>('all');
  const arcade = GAMES.filter((g) => !g.partyOnly);
  const best = savedBest(data);
  const list = arcade.filter((g) => {
    const s = data.settings[g.slug];
    return filter === 'all' || (filter === 'hidden' ? s?.hidden : s && Object.keys(s).length > 0);
  });
  return (
    <section className="panel info-block" aria-labelledby="ag-games">
      <div className="admin-row">
        <h2 id="ag-games">Arcade games · {arcade.length}</h2>
        <div className="seg" role="group" aria-label="Filter games">
          {(['all', 'changed', 'hidden'] as const).map((f) => (
            <button key={f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'changed' ? 'Changed' : 'Hidden'}
            </button>
          ))}
        </div>
      </div>
      <p className="info-small">Switches save immediately. Games stay in the code; these settings only change what players see.</p>
      {list.length === 0 && <p className="info-small">Nothing here.</p>}
      <ul className="ag-games">
        {list.map((g) => (
          <GameRow key={g.slug} game={g} cat={data} best={best.includes(g.slug)} onBest={(on) => sendBestToggle(data, send, g, on)} send={send} busy={busy} open={open === g.slug} onToggle={() => setOpen(open === g.slug ? null : g.slug)} />
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- party mode */

function PartyList({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const anyFeatured = PARTY_GAMES.some((g) => partySettingsFor(data, g.id).featured);
  return (
    <section className="panel info-block" aria-labelledby="ag-party">
      <div className="admin-row">
        <h2 id="ag-party">Party Mode games · {PARTY_GAMES.length}</h2>
      </div>
      <p className="info-small">
        What the party page shows. Switches save immediately. Featured games get the big cards at the top
        {anyFeatured ? '.' : ` (none chosen, so it shows ${DEFAULT_FEATURED.map((id) => PARTY_GAMES.find((g) => g.id === id)?.title).join(' and ')}).`}
      </p>
      <ul className="ag-games">
        {PARTY_GAMES.map((g) => (
          <PartyRow key={g.id} g={g} cat={data} send={send} busy={busy} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} />
        ))}
      </ul>
    </section>
  );
}

function PartyRow({ g, cat, send, busy, open, onToggle }: { g: PartyGame; cat: PublicCatalog; send: Send; busy: boolean; open: boolean; onToggle: () => void }) {
  const s = partySettingsFor(cat, g.id);
  const patch = (p: Partial<PartySettings> | null, msg = 'Saved'): void => void send({ action: 'party', id: g.id, patch: p }, msg);
  const entry = g.id === 'crass-act' ? GAMES.find((x) => x.slug === 'crass-act') : undefined;
  const ways = [g.onePhone && '📱 One phone', g.room && '🌐 Live room'].filter(Boolean).join(' · ');
  return (
    <li className={`ag-game${s.hidden ? ' is-hidden' : ''}`}>
      <div className="ag-game-head">
        {entry ? (
          <img src={entry.art.tile} alt="" width={48} height={48} style={{ background: entry.art.bg }} />
        ) : (
          <span className="ag-party-art" style={{ background: g.color }} aria-hidden="true">
            {g.emoji}
          </span>
        )}
        <div className="ag-game-title">
          <b>{s.title || g.title}</b>
          <span className="ag-chips">
            {s.hidden ? <Chip tone="warn">Hidden</Chip> : <Chip>Visible</Chip>}
            <Chip>{ways}</Chip>
            {s.featured && <Chip tone="on">Featured</Chip>}
            {g.room && !s.room && <Chip tone="warn">Room off</Chip>}
            {s.sticker && <Chip tone="on">{s.sticker}</Chip>}
            {(s.title || s.blurb) && <Chip>Edited text</Chip>}
          </span>
        </div>
        <button className="btn btn-sm" onClick={onToggle} aria-expanded={open}>
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      <div className="ag-switches">
        <Switch on={!s.hidden} label="In Party Mode" hint="Hidden games disappear from the party page (and their room cards)." disabled={busy} onChange={(v) => patch({ hidden: !v }, v ? `${g.title} is back in Party Mode` : `${g.title} is hidden`)} />
        <Switch on={s.featured} label="Featured" hint="A big card at the top of the party page." disabled={busy} onChange={(v) => patch({ featured: v })} />
        {g.room && g.id !== 'crass-act' && <Switch on={s.room} label="Live room" hint="Players can open a room for it (everyone on their own phone)." disabled={busy} onChange={(v) => patch({ room: v })} />}
      </div>
      {open && <PartyEditor key={JSON.stringify(s)} g={g} s={s} patch={patch} busy={busy} />}
      {open && entry && (
        <div className="ag-sub">
          <p className="info-small">Crass Act also has its own game page. Pause it or change its page texts here:</p>
          <GameEditor game={entry} s={settingsFor(cat, 'crass-act')} send={send} busy={busy} />
        </div>
      )}
    </li>
  );
}

function PartyEditor({ g, s, patch, busy }: { g: PartyGame; s: PartySettings; patch: (p: Partial<PartySettings> | null, msg?: string) => void; busy: boolean }) {
  const [sticker, setSticker] = useState(s.sticker);
  const [title, setTitle] = useState(s.title);
  const [blurb, setBlurb] = useState(s.blurb);
  return (
    <form
      className="ag-form ag-sub"
      onSubmit={(e) => {
        e.preventDefault();
        patch({ sticker, title, blurb }, `${g.title} updated`);
      }}
    >
      <label className="ag-field">
        <span>Sticker (e.g. Hot, New; empty = none)</span>
        <input className="field" value={sticker} onChange={(e) => setSticker(e.target.value)} maxLength={STICKER_MAX} placeholder={g.sticker ?? 'Hot'} />
      </label>
      <label className="ag-field">
        <span>Title</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TEXT_LIMITS.title} placeholder={g.title} />
      </label>
      <label className="ag-field ag-wide">
        <span>Card text</span>
        <input className="field" value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={TEXT_LIMITS.tagline} placeholder={g.blurb} />
      </label>
      <div className="reset-row ag-wide">
        <button className="btn btn-sm" disabled={busy || (sticker === s.sticker && title === s.title && blurb === s.blurb)}>
          Save texts
        </button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => patch(null, `${g.title}: back to defaults`)}>
          Reset to defaults
        </button>
      </div>
    </form>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: 'warn' | 'on' }) {
  return <span className={`ag-chip${tone ? ` is-${tone}` : ''}`}>{children}</span>;
}

function GameRow({ game, cat, best, onBest, send, busy, open, onToggle }: { game: GameEntry; cat: PublicCatalog; best: boolean; onBest: (on: boolean) => void; send: Send; busy: boolean; open: boolean; onToggle: () => void }) {
  const s = settingsFor(cat, game.slug);
  const patch = (p: Partial<GameSettings>, msg = 'Saved'): void => void send({ action: 'game', slug: game.slug, patch: p }, msg);
  const autoNew = autoNewSlugs(applySettings(GAMES, cat)).has(game.slug);
  const badgeOn = s.newBadge === 'on' || (s.newBadge === 'auto' && autoNew);
  return (
    <li className={`ag-game${s.hidden ? ' is-hidden' : ''}`}>
      <div className="ag-game-head">
        <img src={game.art.tile} alt="" width={48} height={48} style={{ background: game.art.bg }} />
        <div className="ag-game-title">
          <b>{s.title || game.title}</b>
          <span className="ag-chips">
            {s.hidden ? <Chip tone="warn">Hidden</Chip> : <Chip>Visible</Chip>}
            {s.maintenance && <Chip tone="warn">Paused</Chip>}
            {badgeOn && <Chip tone="on">NEW</Chip>}
            {s.pinned && <Chip tone="on">Pinned</Chip>}
            {s.spotlight && <Chip tone="on">Spotlight</Chip>}
            {best && <Chip tone="on">Best game</Chip>}
            {game.daily?.length ? !s.inDaily && <Chip>Not in daily</Chip> : null}
            {(s.title || s.tagline || s.description) && <Chip>Edited text</Chip>}
          </span>
        </div>
        <button className="btn btn-sm" onClick={onToggle} aria-expanded={open}>
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      <div className="ag-switches">
        <Switch on={!s.hidden} label="Visible" hint="Hidden games disappear from the arcade, search and dailies; the page is closed to players." disabled={busy} onChange={(v) => patch({ hidden: !v }, v ? `${game.title} is visible` : `${game.title} is hidden`)} />
        <Switch on={s.pinned} label="Pinned" hint="Shown first in the arcade grid." disabled={busy} onChange={(v) => patch({ pinned: v })} />
        <Switch on={s.spotlight} label="Spotlight" hint="Today’s pick in the hero (one game at a time)." disabled={busy} onChange={(v) => patch({ spotlight: v })} />
        {!game.partyOnly && <Switch on={best} label="Best game" hint="One of the four Start here cards under the hero. Switching one on takes the last card; order them in Our best games." disabled={busy || s.hidden} onChange={onBest} />}
        {game.daily?.length ? <Switch on={s.inDaily} label="In daily rotation" hint="May be picked as Today’s challenge." disabled={busy} onChange={(v) => patch({ inDaily: v })} /> : null}
        <label className="ag-inline">
          NEW badge
          <select className="field" value={s.newBadge} disabled={busy} onChange={(e) => patch({ newBadge: e.target.value as NewBadge })}>
            <option value="auto">Automatic ({autoNew ? 'new now' : 'not new'})</option>
            <option value="on">Always show</option>
            <option value="off">Never show</option>
          </select>
        </label>
      </div>
      {open && <GameEditor game={game} s={s} send={send} busy={busy} />}
    </li>
  );
}

function GameEditor({ game, s, send, busy }: { game: GameEntry; s: GameSettings; send: Send; busy: boolean }) {
  const [maintenance, setMaintenance] = useState(s.maintenance);
  const [title, setTitle] = useState(s.title);
  const [tagline, setTagline] = useState(s.tagline);
  const [description, setDescription] = useState(s.description);
  return (
    <div className="ag-sub">
      <form
        className="ag-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ action: 'game', slug: game.slug, patch: { maintenance } }, maintenance ? `${game.title} is paused` : `${game.title} is playable again`);
        }}
      >
        <label className="ag-field ag-wide">
          <span>Pause message (players see it instead of the game; empty = playable)</span>
          <input className="field" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} maxLength={TEXT_LIMITS.maintenance} placeholder="We’re fixing a bug in this game. Back very soon!" />
        </label>
        <div className="reset-row ag-wide">
          <button className="btn btn-sm" disabled={busy || maintenance === s.maintenance}>
            {maintenance ? 'Pause game' : 'Resume game'}
          </button>
        </div>
      </form>
      <form
        className="ag-form"
        onSubmit={(e) => {
          e.preventDefault();
          // Only the boxes that changed, so the change log stays readable.
          const patch: Partial<GameSettings> = {};
          if (title !== s.title) patch.title = title;
          if (tagline !== s.tagline) patch.tagline = tagline;
          if (description !== s.description) patch.description = description;
          void send({ action: 'game', slug: game.slug, patch }, 'Text saved');
        }}
      >
        <label className="ag-field">
          <span>Title</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TEXT_LIMITS.title} placeholder={game.title} />
        </label>
        <label className="ag-field ag-wide">
          <span>Tagline (tiles and search)</span>
          <input className="field" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={TEXT_LIMITS.tagline} placeholder={game.tagline} />
        </label>
        <label className="ag-field ag-wide">
          <span>Description (game page)</span>
          <textarea className="field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={TEXT_LIMITS.description} placeholder={game.description} />
        </label>
        <p className="info-small ag-wide">Leave a box empty to use the original text. Search pages for crawlers keep the original until the next deploy.</p>
        <div className="reset-row ag-wide">
          <button className="btn btn-sm btn-primary" disabled={busy || (title === s.title && tagline === s.tagline && description === s.description)}>
            Save text
          </button>
          <Link href={`/games/${game.slug}`} className="btn btn-sm btn-ghost">
            <Icon name="external" size={14} /> Open page
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Reset every setting for ${game.title} to the defaults?`)) return;
              setMaintenance('');
              setTitle('');
              setTagline('');
              setDescription('');
              void send({ action: 'reset', slug: game.slug }, `${game.title} reset`);
            }}
          >
            Reset everything
          </button>
        </div>
      </form>
    </div>
  );
}

/* --------------------------------------------------------------------- log */

function ChangeLog({ log }: { log: AdminCatalog['log'] }) {
  return (
    <section className="panel info-block" aria-labelledby="ag-log">
      <h2 id="ag-log">Change log</h2>
      {log.length === 0 ? (
        <p className="info-small">No changes yet.</p>
      ) : (
        <ul className="err-list">
          {log.map((l, i) => (
            <li key={`${l.ts}-${i}`}>
              <span className="err-msg">{l.detail}</span>
              <span className="mono info-small">
                {when(l.ts)} · {l.admin}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
