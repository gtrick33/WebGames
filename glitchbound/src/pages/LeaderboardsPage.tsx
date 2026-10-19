import { useState } from 'react';
import { useLiveCatalog } from '../platform/liveCatalog';
import { getGame } from '../catalog/catalog';
import { BoardEmpty, BoardError, HallTable, LeaderTable, useBoard, useHall } from '../components/Leaderboard';
import { Icon } from '../components/Icon';
import { usePageMeta } from '../platform/meta';
import { navigate, useLocation } from '../router/router';
import './InfoPages.css';

type Tab = 'hall' | string;

/** Below this many players the Hall of Fame invites people to claim the empty spots. */
const EARLY_DAYS = 10;

function GameBoard({ slug }: { slug: string }) {
  const [period, setPeriod] = useState<'all' | '24h'>('all');
  const board = useBoard(slug, period);
  const game = getGame(slug, useLiveCatalog().all)!;
  return (
    <div className="panel info-block">
      <div className="board-head">
        <h2 className="board-game-title">
          <img src={game.art.tile} alt="" width={44} height={44} style={{ background: game.art.bg }} />
          {game.title}
        </h2>
        <div className="seg" role="group" aria-label="Period">
          <button className={period === 'all' ? 'is-on' : ''} aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>
            All time
          </button>
          <button className={period === '24h' ? 'is-on' : ''} aria-pressed={period === '24h'} onClick={() => setPeriod('24h')}>
            Last 24 hours
          </button>
        </div>
      </div>
      {board.status === 'loading' && <p className="info-small">Loading…</p>}
      {board.status === 'error' && <BoardError text="The leaderboard is offline right now." onRetry={board.retry} />}
      {board.status === 'ok' && (board.rows.length ? <LeaderTable rows={board.rows} mine={board.mine} /> : <BoardEmpty text="No ranked scores in this period yet." />)}
      <p className="info-small">Best score per member. Scores are checked against real play time; rounds played as a guest are not ranked.</p>
    </div>
  );
}

function Hall() {
  const hall = useHall();
  return (
    <div className="panel info-block">
      <div className="board-head">
        <h2>
          <Icon name="crown" /> Hall of Fame
        </h2>
      </div>
      <p className="info-small">
        Across every game: <b>crowns</b> are #1 spots, <b>podiums</b> are top-3 spots, <b>records</b> are personal bests a player has beaten.
      </p>
      {hall.status === 'loading' && <p className="info-small">Loading…</p>}
      {hall.status === 'error' && <BoardError text="The Hall of Fame is offline right now." onRetry={hall.retry} />}
      {hall.status === 'ok' && (hall.rows.length ? <HallTable rows={hall.rows} /> : <BoardEmpty text="Nobody is in the Hall of Fame yet. Sign in and set the first record." />)}
      {/* A young arcade: say the thin board is an opening, not a ghost town. */}
      {hall.status === 'ok' && hall.rows.length > 0 && hall.rows.length < EARLY_DAYS && (
        <p className="info-small board-early">
          <b>Early days.</b> The boards are still fresh, so a crown is well within reach. Sign in, set a best and claim one.
        </p>
      )}
    </div>
  );
}

export function LeaderboardsPage() {
  const live = useLiveCatalog();
  usePageMeta({ title: 'Leaderboards', description: 'GlitchBound leaderboards: top scores for every game and the Hall of Fame of record holders.', path: '/leaderboards' });
  const { search } = useLocation();
  const param = new URLSearchParams(search).get('game');
  const tab: Tab = param && getGame(param) ? param : 'hall';
  const setTab = (t: Tab): void => navigate(t === 'hall' ? '/leaderboards' : `/leaderboards?game=${t}`, { replace: true, scroll: false });

  return (
    <div className="wrap info-page">
      <p className="eyebrow">
        <Icon name="crown" size={16} /> Members compete, everyone can look
      </p>
      <h1 className="info-title">Leaderboards</h1>
      {/* Hall of Fame is the home board; single games are picked from a dropdown, which scales to any number of games. */}
      <div className="board-picker">
        <button className={`board-hall-btn${tab === 'hall' ? ' is-on' : ''}`} aria-pressed={tab === 'hall'} onClick={() => setTab('hall')}>
          <Icon name="crown" size={18} /> Hall of Fame
        </button>
        <label className={`board-select${tab !== 'hall' ? ' is-on' : ''}`}>
          <span className="mono">Game</span>
          <select value={tab === 'hall' ? '' : tab} onChange={(e) => setTab(e.target.value || 'hall')} aria-label="Game leaderboard">
            <option value="">Choose a game…</option>
            {[...live.games]
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      {tab === 'hall' ? <Hall /> : <GameBoard key={tab} slug={tab} />}
    </div>
  );
}
