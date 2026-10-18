import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isNew } from '../catalog/catalog';
import { GAMES } from '../catalog/games';
import { dailyRules, settingsFor, TEXT_LIMITS, type DailyPick, type GameSettings, type NewBadge, type NoticeTone, type PublicCatalog } from '../catalog/settings';
import type { GameEntry } from '../catalog/types';
import { Icon } from '../components/Icon';
import { api, ApiError } from '../platform/account';
import type { AdminCatalog } from '../platform/apiTypes';
import { challengeForDay, fmt } from '../platform/daily';
import { addDays, dayKey } from '../platform/dates';
import { setCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';

/**
 * Admin › Games: what players see, without a rebuild. Show or hide games, pin them, choose the home
 * spotlight and NEW badges, pause a broken game, edit texts, hand-pick daily challenges and post a
 * site notice. Every change is saved at once and written to the change log.
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

  const load = useCallback(
    () =>
      api<AdminCatalog>('/api/admin/catalog')
        .then((d) => {
          setData(d);
          setError('');
          // The rest of the site (open in this tab) follows the change right away.
          setCatalog({ settings: d.settings, picks: d.picks, notice: d.notice });
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
      <DailyPlanner data={data} send={send} busy={busy} />
      <GamesList data={data} send={send} busy={busy} />
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
  const list = GAMES.filter((g) => {
    const s = data.settings[g.slug];
    return filter === 'all' || (filter === 'hidden' ? s?.hidden : s && Object.keys(s).length > 0);
  });
  return (
    <section className="panel info-block" aria-labelledby="ag-games">
      <div className="admin-row">
        <h2 id="ag-games">Games · {GAMES.length}</h2>
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
          <GameRow key={g.slug} game={g} cat={data} send={send} busy={busy} open={open === g.slug} onToggle={() => setOpen(open === g.slug ? null : g.slug)} />
        ))}
      </ul>
    </section>
  );
}

function Switch({ on, label, hint, disabled, onChange }: { on: boolean; label: string; hint?: string; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`ag-switch${on ? ' is-on' : ''}`} role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} title={hint}>
      <span className="ag-knob" aria-hidden="true" />
      {label}
    </button>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: 'warn' | 'on' }) {
  return <span className={`ag-chip${tone ? ` is-${tone}` : ''}`}>{children}</span>;
}

function GameRow({ game, cat, send, busy, open, onToggle }: { game: GameEntry; cat: PublicCatalog; send: Send; busy: boolean; open: boolean; onToggle: () => void }) {
  const s = settingsFor(cat, game.slug);
  const patch = (p: Partial<GameSettings>, msg = 'Saved'): void => void send({ action: 'game', slug: game.slug, patch: p }, msg);
  const autoNew = isNew(game);
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
        <Switch on={s.spotlight} label="Spotlight" hint="The big featured game on the home page (one at a time)." disabled={busy} onChange={(v) => patch({ spotlight: v })} />
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
