import { lazy, Suspense, useState } from 'react';
import { SECTION_GAMES } from '../../catalog/catalog';
import { settingsFor, type GameSettings, type PublicCatalog } from '../../catalog/settings';
import type { GameEntry } from '../../catalog/types';
import type { AdminCatalog } from '../../platform/apiTypes';
import { Switch } from '../AdminLayout';
import { useLocation } from '../../router/router';
import { Chip, GameEditor } from './shared';
import type { Send } from './useAdminCatalog';

// Sigilfall's data (items, quests, talents...) comes along with it: only an admin who opens this tab downloads that.
const SigilfallPlayers = lazy(() => import('./SigilfallPlayers').then((m) => ({ default: m.SigilfallPlayers })));

/**
 * Games with a section of their own (Sigilfall): one switch turns the whole section on or off (its tab
 * next to Arcade and Party, and its page), plus the pause message and texts every game has.
 */
export function SectionList({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const { search } = useLocation();
  const onePlayer = new URLSearchParams(search).has('player');
  return (
    <>
    {!onePlayer && (
    <section className="panel info-block" aria-labelledby="ag-sections">
      <div className="admin-row">
        <h2 id="ag-sections">{SECTION_GAMES.length === 1 ? 'On the site' : `Sections · ${SECTION_GAMES.length}`}</h2>
      </div>
      <p className="info-small">
        It has a tab of its own next to Arcade and Party, and the banner at the top of the home page. Switching it off hides both and closes its page to players (admins and QA can still open it to test).
        Players keep their saved progress either way.
      </p>
      <ul className="ag-games">
        {SECTION_GAMES.map((g) => (
          <SectionRow key={g.slug} game={g} cat={data} send={send} busy={busy} />
        ))}
      </ul>
    </section>
    )}
    <Suspense fallback={<p className="info-lead">Loading the players…</p>}>
      <SigilfallPlayers />
    </Suspense>
    </>
  );
}

function SectionRow({ game, cat, send, busy }: { game: GameEntry; cat: PublicCatalog; send: Send; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const s = settingsFor(cat, game.slug);
  const label = game.section!.label;
  const patch = (p: Partial<GameSettings>, msg = 'Saved'): void => void send({ action: 'game', slug: game.slug, patch: p }, msg);
  return (
    <li className={`ag-game${s.hidden ? ' is-hidden' : ''}`}>
      <div className="ag-game-head">
        <img src={game.art.tile} alt="" width={48} height={48} style={{ background: game.art.bg }} />
        <div className="ag-game-title">
          <b>{s.title || game.title}</b>
          <span className="ag-chips">
            {s.hidden ? <Chip tone="warn">Off</Chip> : <Chip tone="on">On</Chip>}
            {s.maintenance && <Chip tone="warn">Paused</Chip>}
            <Chip>{game.section!.path}</Chip>
          </span>
        </div>
        <button className="btn btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      <div className="ag-switches">
        <Switch
          on={!s.hidden}
          label={`${label} is on`}
          hint={`Off: the ${label} tab disappears for players and ${game.section!.path} shows “page not found”.`}
          disabled={busy}
          onChange={(v) => patch({ hidden: !v }, v ? `${label} is on` : `${label} is off`)}
        />
      </div>
      {open && <GameEditor game={game} s={s} send={send} busy={busy} />}
    </li>
  );
}
