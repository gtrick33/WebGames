import { useState } from 'react';
import { GAMES } from '../../catalog/games';
import { partySettingsFor, settingsFor, STICKER_MAX, TEXT_LIMITS, type PartySettings, type PublicCatalog } from '../../catalog/settings';
import type { AdminCatalog } from '../../platform/apiTypes';
import { DEFAULT_FEATURED, PARTY_GAMES, type PartyGame } from '../../party/catalog';
import { Switch } from '../AdminLayout';
import { Chip, GameEditor } from './shared';
import type { Send } from './useAdminCatalog';

/** Admin › Party Mode: what the party page shows, game by game (switches save right away). */
export function PartyList({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
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
