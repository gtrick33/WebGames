import { useState, type ReactNode } from 'react';
import { gameUrl } from '../../catalog/catalog';
import { TEXT_LIMITS, type GameSettings } from '../../catalog/settings';
import type { GameEntry } from '../../catalog/types';
import { Icon } from '../../components/Icon';
import { Link } from '../../router/router';
import type { Send } from './useAdminCatalog';

/** A small status label on a row (Hidden, Paused, Featured…). */
export function Chip({ children, tone }: { children: ReactNode; tone?: 'warn' | 'on' }) {
  return <span className={`ag-chip${tone ? ` is-${tone}` : ''}`}>{children}</span>;
}

/**
 * A game's pause message and page texts, saved as soon as you press the button (Sigilfall, and Crass Act's own
 * page; the arcade games' texts are edited in Admin › Home page with everything else, and published together).
 */
export function GameEditor({ game, s, send, busy }: { game: GameEntry; s: GameSettings; send: Send; busy: boolean }) {
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
          <Link href={gameUrl(game.slug)} className="btn btn-sm btn-ghost">
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
