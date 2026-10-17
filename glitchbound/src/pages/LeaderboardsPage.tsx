import { useState } from 'react';
import { GAMES } from '../catalog/games';
import { getGame } from '../catalog/catalog';
import { BoardEmpty, HallTable, LeaderTable, useBoard, useHall } from '../components/Leaderboard';
import { Icon } from '../components/Icon';
import { usePageMeta } from '../platform/meta';
import { navigate, useLocation } from '../router/router';
import './InfoPages.css';

type Tab = 'hall' | string;

function GameBoard({ slug }: { slug: string }) {
  const [period, setPeriod] = useState<'all' | '24h'>('all');
  const board = useBoard(slug, period);
  const game = getGame(slug)!;
  return (
    <div className="panel info-block">
      <div className="board-head">
        <h2>{game.title}</h2>
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
      {board.status === 'error' && <p>The leaderboard is offline right now. Please try again later.</p>}
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
      {hall.status === 'error' && <p>The Hall of Fame is offline right now.</p>}
      {hall.status === 'ok' && (hall.rows.length ? <HallTable rows={hall.rows} /> : <BoardEmpty text="Nobody is in the Hall of Fame yet. Sign in and set the first record." />)}
    </div>
  );
}

export function LeaderboardsPage() {
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
      <div className="seg seg-lg" role="tablist" aria-label="Leaderboard">
        <button role="tab" aria-selected={tab === 'hall'} className={tab === 'hall' ? 'is-on' : ''} onClick={() => setTab('hall')}>
          Hall of Fame
        </button>
        {GAMES.map((g) => (
          <button key={g.slug} role="tab" aria-selected={tab === g.slug} className={tab === g.slug ? 'is-on' : ''} onClick={() => setTab(g.slug)}>
            {g.title}
          </button>
        ))}
      </div>
      {tab === 'hall' ? <Hall /> : <GameBoard key={tab} slug={tab} />}
    </div>
  );
}
