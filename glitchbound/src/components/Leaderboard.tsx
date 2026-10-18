import { useEffect, useState } from 'react';
import { t, useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import type { HallRow, LeaderRow } from '../platform/apiTypes';
import { api, useAccount } from '../platform/account';
import { fmt } from '../platform/daily';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { openSignIn } from './openSignIn';
import './Leaderboard.css';

type Period = 'all' | '24h';

interface BoardState<T> {
  status: 'loading' | 'ok' | 'error';
  rows: T[];
  mine: T | null;
}

export function useBoard(game: string, period: Period, refreshKey = 0): BoardState<LeaderRow> {
  const [state, setState] = useState<BoardState<LeaderRow>>({ status: 'loading', rows: [], mine: null });
  const { me } = useAccount();
  useEffect(() => {
    let cancelled = false;
    api<{ rows: LeaderRow[]; mine: LeaderRow | null }>(`/api/leaderboard?game=${encodeURIComponent(game)}&period=${period}`)
      .then((r) => !cancelled && setState({ status: 'ok', rows: r.rows, mine: r.mine }))
      .catch(() => !cancelled && setState({ status: 'error', rows: [], mine: null }));
    return () => {
      cancelled = true;
    };
  }, [game, period, refreshKey, me?.id]);
  return state;
}

export function useHall(): BoardState<HallRow> {
  const [state, setState] = useState<BoardState<HallRow>>({ status: 'loading', rows: [], mine: null });
  const { me } = useAccount();
  useEffect(() => {
    let cancelled = false;
    api<{ rows: HallRow[] }>('/api/hall')
      .then((r) => !cancelled && setState({ status: 'ok', rows: r.rows, mine: null }))
      .catch(() => !cancelled && setState({ status: 'error', rows: [], mine: null }));
    return () => {
      cancelled = true;
    };
  }, [me?.id]);
  return state;
}

function Medal({ rank }: { rank: number }) {
  return <span className={`medal medal-${rank <= 3 ? rank : 'n'}`}>{rank}</span>;
}

export function LeaderTable({ rows, mine, unit = '', compact = false }: { rows: LeaderRow[]; mine: LeaderRow | null; unit?: string; compact?: boolean }) {
  return (
    <ol className={`board${compact ? ' board-compact' : ''}`}>
      {rows.map((r) => (
        <li key={r.rank} className={`board-row${r.you ? ' is-you' : ''}`} style={{ ['--i' as string]: r.rank }}>
          <Medal rank={r.rank} />
          <span className="board-name">
            <span className="board-nick">{r.nickname}</span>
            {r.you && <span className="board-you mono">{t('you')}</span>}
          </span>
          {!compact && <span className="board-lvl mono">LV {r.level}</span>}
          <span className="board-score mono">
            {fmt(r.score)}
            {unit}
          </span>
        </li>
      ))}
      {mine && (
        <li className="board-row is-you board-mine">
          <Medal rank={mine.rank} />
          <span className="board-name">
            <span className="board-nick">{mine.nickname}</span> <span className="board-you mono">{t('you')}</span>
          </span>
          {!compact && <span className="board-lvl mono">LV {mine.level}</span>}
          <span className="board-score mono">{fmt(mine.score)}</span>
        </li>
      )}
    </ol>
  );
}

export function HallTable({ rows }: { rows: HallRow[] }) {
  return (
    <div className="hall-wrap">
      <table className="hall">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Player</th>
            <th scope="col" title="Number one in a game">
              <Icon name="crown" size={16} /> Crowns
            </th>
            <th scope="col" title="Top three in a game">Podiums</th>
            <th scope="col" title="Personal bests beaten">Records</th>
            <th scope="col">Games</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} className={r.you ? 'is-you' : ''}>
              <td>
                <Medal rank={r.rank} />
              </td>
              <td>
                <span className="board-name">
                  <span className="board-nick">{r.nickname}</span> <span className="board-lvl mono">LV {r.level}</span>
                  {r.you && <span className="board-you mono">{t('you')}</span>}
                </span>
              </td>
              <td className="mono hall-crowns hall-stat" data-label="Crowns">{r.crowns}</td>
              <td className="mono hall-stat" data-label="Podiums">{r.podiums}</td>
              <td className="mono hall-stat" data-label="Records">{r.records}</td>
              <td className="mono hall-stat" data-label="Games">{r.games}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoardEmpty({ text }: { text: string }) {
  const t = useT();
  const { me } = useAccount();
  return (
    <div className="board-empty">
      <Icon name="crown" size={28} />
      <p>{t(text)}</p>
      {!me && (
        <button className="btn btn-magenta btn-sm" onClick={() => openSignIn(t('Sign in to claim a spot on the leaderboard.'))}>
          {t('Sign in to compete')}
        </button>
      )}
    </div>
  );
}

/** Top 5 for a game page side panel. */
export function MiniLeaderboard({ game, refreshKey }: { game: GameEntry; refreshKey: number }) {
  const t = useT();
  const board = useBoard(game.slug, 'all', refreshKey);
  return (
    <section className="panel side-block mini-board" aria-labelledby="mini-board-title">
      <h2 id="mini-board-title" className="side-title">
        <Icon name="crown" /> {t('Leaderboard')}
      </h2>
      {board.status === 'loading' && <p className="side-muted">{t('Loading…')}</p>}
      {board.status === 'error' && <p className="side-muted">{t('The leaderboard is offline right now. Your game still works.')}</p>}
      {board.status === 'ok' &&
        (board.rows.length ? (
          <LeaderTable rows={board.rows.slice(0, 5)} mine={board.rows.slice(0, 5).some((r) => r.you) ? null : (board.rows.find((r) => r.you) ?? board.mine)} compact />
        ) : (
          <BoardEmpty text="No ranked scores yet. The first one takes the crown." />
        ))}
      <Link href={`/leaderboards?game=${game.slug}`} className="quests-link">
        {t('Full leaderboard')} <Icon name="arrowRight" size={16} />
      </Link>
    </section>
  );
}
