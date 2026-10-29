import { useEffect, useState } from 'react';
import { t, useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import type { HallRow, LeaderRow } from '../platform/apiTypes';
import { api, useAccount } from '../platform/account';
import { fmt } from '../platform/daily';
import { useSave } from '../platform/store';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { openSignIn } from './openSignIn';
import './Leaderboard.css';

type Period = 'all' | '24h';

interface BoardState<T> {
  status: 'loading' | 'ok' | 'error';
  rows: T[];
  mine: T | null;
  /** Asks again after an error. */
  retry: () => void;
}

/** A board request that gives up after 12 s: a stalled connection ends in the offline message (with Retry), not "Loading…" forever. */
function load<T>(path: string): Promise<T> {
  return Promise.race([api<T>(path), new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 12_000))]);
}

function useRequest<T>(path: string, deps: unknown[], pick: (data: unknown) => { rows: T[]; mine: T | null }): BoardState<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<BoardState<T>, 'retry'>>({ status: 'loading', rows: [], mine: null });
  useEffect(() => {
    let cancelled = false;
    load<unknown>(path)
      .then((r) => !cancelled && setState({ status: 'ok', ...pick(r) }))
      .catch(() => !cancelled && setState({ status: 'error', rows: [], mine: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, attempt, ...deps]);
  const retry = (): void => {
    setState({ status: 'loading', rows: [], mine: null });
    setAttempt((a) => a + 1);
  };
  return { ...state, retry };
}

/** The most rows a board holds (the server sends the top 50). */
const BOARD_ROWS = 50;

/** A game's board: the members' best scores, ranked by the server. */
export function useBoard(game: string, period: Period, refreshKey = 0): BoardState<LeaderRow> {
  const { me } = useAccount();
  return useRequest<LeaderRow>(`/api/leaderboard?game=${encodeURIComponent(game)}&period=${period}`, [refreshKey, me?.id], (r) => r as { rows: LeaderRow[]; mine: LeaderRow | null });
}

/** The Hall of Fame: the members with the most crowns, podiums and records across every game. */
export function useHall(): BoardState<HallRow> {
  const { me } = useAccount();
  return useRequest<HallRow>('/api/hall', [me?.id], (r) => ({ rows: (r as { rows: HallRow[] }).rows, mine: null }));
}

/** Where a guest's best would land among the members' rows on the board (null: below the rows it holds). */
function guestRank(rows: readonly LeaderRow[], best: number): number | null {
  const ahead = rows.filter((r) => r.score > best).length;
  return ahead < BOARD_ROWS ? ahead + 1 : null;
}

/** The offline message under a board, with a way to ask again. */
export function BoardError({ text, onRetry }: { text: string; onRetry: () => void }) {
  const t = useT();
  return (
    <p className="side-muted board-error">
      {t(text)}{' '}
      <button className="link-btn" onClick={onRetry}>
        {t('Try again')}
      </button>
    </p>
  );
}

function Medal({ rank }: { rank: number }) {
  return <span className={`medal medal-${rank <= 3 ? rank : 'n'}`}>{rank}</span>;
}

export function LeaderTable({ rows, mine, unit = '', compact = false }: { rows: LeaderRow[]; mine: LeaderRow | null; unit?: string; compact?: boolean }) {
  return (
    <ol className={`board${compact ? ' board-compact' : ''}`}>
      {rows.map((r, i) => (
        <li key={i} className={`board-row${r.you ? ' is-you' : ''}`} style={{ ['--i' as string]: i + 1 }}>
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
            <th scope="col">{t('Player')}</th>
            <th scope="col" title={t('Number one in a game')}>
              <Icon name="crown" size={16} /> {t('Crowns')}
            </th>
            <th scope="col" title={t('Top three in a game')}>
              {t('Podiums')}
            </th>
            <th scope="col" title={t('Personal bests beaten')}>
              {t('Records')}
            </th>
            <th scope="col">{t('Games')}</th>
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
              <td className="mono hall-crowns hall-stat" data-label={t('Crowns')}>
                {r.crowns}
              </td>
              <td className="mono hall-stat" data-label={t('Podiums')}>
                {r.podiums}
              </td>
              <td className="mono hall-stat" data-label={t('Records')}>
                {r.records}
              </td>
              <td className="mono hall-stat" data-label={t('Games')}>
                {r.games}
              </td>
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

/** Top 5 for a game page side panel; a guest with a best on this device sees where it would land. */
export function MiniLeaderboard({ game, refreshKey, embedded = false }: { game: GameEntry; refreshKey: number; embedded?: boolean }) {
  const t = useT();
  const { me } = useAccount();
  const board = useBoard(game.slug, 'all', refreshKey);
  const best = useSave().games[game.slug]?.best.score ?? 0;
  const top = board.rows.slice(0, 5);
  const rank = !me && best > 0 && board.status === 'ok' && top.length > 0 ? guestRank(board.rows, best) : null;
  const body = (
    <>
      {board.status === 'loading' && !top.length && <p className="side-muted">{t('Loading…')}</p>}
      {top.length ? (
        <LeaderTable rows={top} mine={top.some((r) => r.you) ? null : (board.rows.find((r) => r.you) ?? board.mine)} compact />
      ) : (
        board.status === 'ok' && <BoardEmpty text="No ranked scores yet. The first one takes the crown." />
      )}
      {board.status === 'error' && <BoardError text="The leaderboard is offline right now. Your game still works." onRetry={board.retry} />}
      {rank !== null && (
        <button className="board-claim" onClick={() => openSignIn(t('Sign in to put your scores on the leaderboard.'))}>
          <Icon name="crown" size={16} /> {t('Your best, {n}, would be #{rank} here. Sign in to claim it.', { n: fmt(best), rank: fmt(rank) })}
        </button>
      )}
      <Link href={`/leaderboards?game=${game.slug}`} className="quests-link">
        {t('Full leaderboard')} <Icon name="arrowRight" size={16} />
      </Link>
    </>
  );
  // Inside the game page's tabs the tab itself is the heading.
  if (embedded) return <div className="mini-board">{body}</div>;
  return (
    <section className="panel side-block mini-board" aria-labelledby="mini-board-title">
      <h2 id="mini-board-title" className="side-title">
        <Icon name="crown" /> {t('Leaderboard')}
      </h2>
      {body}
    </section>
  );
}
