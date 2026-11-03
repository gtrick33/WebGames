import { useState } from 'react';
import { useLiveCatalog } from '../platform/liveCatalog';
import { getGame } from '../catalog/catalog';
import { BoardEmpty, BoardError, FriendsEmpty, HallTable, LeaderTable, ScopeSwitch, useBoard, useHall, type Scope } from '../components/Leaderboard';
import { Icon } from '../components/Icon';
import { usePageMeta } from '../platform/meta';
import { navigate, useLocation } from '../router/router';
import { useT } from '../i18n';
import './InfoPages.css';

type Tab = 'hall' | string;

function GameBoard({ slug }: { slug: string }) {
  const [period, setPeriod] = useState<'all' | '24h'>('all');
  const t = useT();
  const [scope, setScope] = useState<Scope>('all');
  const board = useBoard(slug, period, 0, scope);
  const game = getGame(slug, useLiveCatalog().all)!;
  const unit = game.stats.find((s) => s.key === 'score')?.unit;
  return (
    <div className="panel info-block">
      <div className="board-head">
        <h2 className="board-game-title">
          <img src={game.art.tile} alt="" width={44} height={44} style={{ background: game.art.bg }} />
          {game.title}
        </h2>
        <ScopeSwitch scope={scope} onChange={setScope} />
        <div className="seg" role="group" aria-label={t('Period')}>
          <button className={period === 'all' ? 'is-on' : ''} aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>
            {t('All time')}
          </button>
          <button className={period === '24h' ? 'is-on' : ''} aria-pressed={period === '24h'} onClick={() => setPeriod('24h')}>
            {t('Last 24 hours')}
          </button>
        </div>
      </div>
      {board.status === 'loading' && <p className="info-small">{t('Loading…')}</p>}
      {board.rows.length ? (
        <LeaderTable rows={board.rows} mine={board.mine} unit={unit ? ` ${t(unit)}` : ''} />
      ) : (
        board.status === 'ok' && (scope === 'friends' ? <FriendsEmpty /> : <BoardEmpty text={t('No ranked scores in this period yet.')} />)
      )}
      {board.status === 'error' && <BoardError text={t('The leaderboard is offline right now.')} onRetry={board.retry} />}
      <p className="info-small">{t('Best score per member. Scores are checked against real play time; rounds played as a guest are not ranked.')}</p>
    </div>
  );
}

function Hall() {
  const t = useT();
  const hall = useHall();
  // a young arcade: few members have a crown yet
  const early = hall.status === 'ok' && hall.rows.length < 10;
  return (
    <div className="panel info-block">
      <div className="board-head">
        <h2>
          <Icon name="crown" /> {t('Hall of Fame')}
        </h2>
      </div>
      <p className="info-small">
        {t('Across every game: crowns are #1 spots, podiums top-3 spots, records the personal bests beaten.')}
      </p>
      {hall.status === 'loading' && <p className="info-small">{t('Loading…')}</p>}
      {hall.rows.length ? <HallTable rows={hall.rows} /> : hall.status === 'ok' && <BoardEmpty text={t('Nobody is in the Hall of Fame yet. Sign in and set the first record.')} />}
      {hall.status === 'error' && <BoardError text={t('The Hall of Fame is offline right now.')} onRetry={hall.retry} />}
      {early && (
        <p className="info-small board-early">
          <b>{t('Early days.')}</b> {t('The boards are still fresh, so a crown is well within reach. Sign in, set a best and claim one.')}
        </p>
      )}
    </div>
  );
}

export function LeaderboardsPage() {
  const live = useLiveCatalog();
  const t = useT();
  usePageMeta({ title: 'Leaderboards', description: 'GlitchBound leaderboards: top scores for every game and the Hall of Fame of record holders.', path: '/leaderboards' });
  const { search } = useLocation();
  const param = new URLSearchParams(search).get('game');
  const tab: Tab = param && getGame(param) ? param : 'hall';
  const setTab = (next: Tab): void => navigate(next === 'hall' ? '/leaderboards' : `/leaderboards?game=${next}`, { replace: true, scroll: false });

  return (
    <div className="wrap info-page">
      <p className="eyebrow">
        <Icon name="crown" size={16} /> {t('Members compete, everyone can look')}
      </p>
      <h1 className="info-title">{t('Leaderboards')}</h1>
      {/* Hall of Fame is the home board; single games are picked from a dropdown, which scales to any number of games. */}
      <div className="board-picker">
        <button className={`board-hall-btn${tab === 'hall' ? ' is-on' : ''}`} aria-pressed={tab === 'hall'} onClick={() => setTab('hall')}>
          <Icon name="crown" size={18} /> {t('Hall of Fame')}
        </button>
        <label className={`board-select${tab !== 'hall' ? ' is-on' : ''}`}>
          <span className="mono">{t('Game')}</span>
          <select value={tab === 'hall' ? '' : tab} onChange={(e) => setTab(e.target.value || 'hall')} aria-label={t('Game leaderboard')}>
            <option value="">{t('Choose a game…')}</option>
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
