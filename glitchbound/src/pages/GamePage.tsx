import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { relatedGames } from '../catalog/catalog';
import { CATEGORIES, type GameEntry } from '../catalog/types';
import { AdSlot } from '../components/AdSlot';
import { Burst } from '../components/Burst';
import { DailyCard } from '../components/DailyCard';
import { GameStage } from '../components/GameStage';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { track } from '../platform/analytics';
import type { EndEvent, GameEvent } from '../platform/contract';
import { challengeForDay, fmt } from '../platform/daily';
import { dayKey } from '../platform/dates';
import { SITE_URL } from '../platform/env';
import { usePageMeta } from '../platform/meta';
import type { RoundResult } from '../platform/save';
import { saveStore, useSave } from '../platform/store';
import { parseBeatParam, shareOrCopy } from '../platform/share';
import { GAMES } from '../catalog/games';
import { Link, useLocation } from '../router/router';
import './GamePage.css';

interface LastRound {
  event: EndEvent;
  result: RoundResult;
  n: number;
}

function useFullscreen(ref: RefObject<HTMLElement | null>): { supported: boolean; active: boolean; toggle: () => void } {
  const [active, setActive] = useState(false);
  const supported = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  useEffect(() => {
    const on = (): void => setActive(document.fullscreenElement === ref.current && !!ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, [ref]);
  const toggle = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void ref.current?.requestFullscreen().catch(() => undefined);
  };
  return { supported, active, toggle };
}

export function GamePage({ game }: { game: GameEntry }) {
  const { search } = useLocation();
  const beat = parseBeatParam(search);
  const save = useSave();
  const record = save.games[game.slug];
  const stageRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stageRef);
  const [restartKey, setRestartKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<LastRound | null>(null);
  const [burst, setBurst] = useState(0);
  const [shareMsg, setShareMsg] = useState('');
  const related = relatedGames(game);
  const isDailyGame = challengeForDay(dayKey(), GAMES)?.game.slug === game.slug;

  usePageMeta({ title: `Play ${game.title}`, description: `${game.tagline} Free to play in your browser on GlitchBound.`, path: `/games/${game.slug}`, image: `/games/${game.slug}/og.jpg` });

  useEffect(() => {
    track('game_view', { game: game.slug });
  }, [game.slug]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      if (e.type === 'start') {
        track('game_start', { game: game.slug });
        return;
      }
      const result = saveStore.record(game, e);
      setLast((prev) => ({ event: e, result, n: (prev?.n ?? 0) + 1 }));
      track('game_end', { game: game.slug, score: e.score });
      if (result.dailyCompleted) track('daily_complete', { game: game.slug, day: dayKey() });
      if (result.dailyCompleted || result.newBests.includes('score') || (beat !== null && e.score > beat)) setBurst((b) => b + 1);
    },
    [game, beat],
  );

  const restart = (): void => {
    track('replay_click', { game: game.slug, where: 'toolbar' });
    setRestartKey((k) => k + 1);
  };

  const share = async (kind: 'game' | 'score' | 'challenge'): Promise<void> => {
    track('share_click', { game: game.slug, what: kind });
    const score = last?.event.score ?? 0;
    const url = kind === 'challenge' ? `${SITE_URL}/games/${game.slug}?beat=${score}` : `${SITE_URL}/games/${game.slug}`;
    const text =
      kind === 'game'
        ? `${game.title}: ${game.tagline}`
        : kind === 'score'
          ? `I scored ${fmt(score)} in ${game.title} on GlitchBound.`
          : `I scored ${fmt(score)} in ${game.title}. Can you beat it?`;
    const outcome = await shareOrCopy({ title: game.title, text, url });
    setShareMsg(outcome === 'copied' ? 'Link copied to your clipboard.' : outcome === 'shared' ? 'Shared!' : outcome === 'failed' ? 'Could not share from this browser.' : '');
    window.setTimeout(() => setShareMsg(''), 4000);
  };

  return (
    <div className="game-page" data-accent={game.accent}>
      <div className="wrap game-toolbar">
        <Link href="/#arcade" className="btn btn-sm btn-ghost back-link">
          <Icon name="arrowLeft" size={18} /> Arcade
        </Link>
        <div className="game-heading">
          <h1>{game.title}</h1>
          <span className="chip">{CATEGORIES[game.categories[0]].label}</span>
        </div>
        <div className="game-actions">
          {playing && (
            <button className="btn btn-sm" onClick={restart} title="Reload the game">
              <Icon name="restart" size={18} /> <span className="hide-sm">Restart</span>
            </button>
          )}
          {fs.supported && (
            <button className="btn btn-sm btn-icon" onClick={fs.toggle} aria-label={fs.active ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen">
              <Icon name={fs.active ? 'shrink' : 'expand'} size={18} />
            </button>
          )}
          <button className="btn btn-sm btn-icon" onClick={() => void share('game')} aria-label={`Share ${game.title}`} title="Share">
            <Icon name="share" size={18} />
          </button>
        </div>
      </div>

      <div className="wrap game-layout">
        <div className="game-stage-col">
          <GameStage key={restartKey} autoStart={restartKey > 0} game={game} onEvent={onEvent} stageRef={stageRef} onPhase={(p) => setPlaying(p === 'loading' || p === 'ready')} />
          {burst > 0 && <Burst key={burst} />}
        </div>

        <aside className="game-side" aria-label={`${game.title} details`}>
          <p className="game-share-msg" role="status">
            {shareMsg}
          </p>

          {beat !== null && (
            <div className={`panel friend ${last && last.event.score > beat ? 'is-beaten' : ''}`}>
              <p className="eyebrow">Friend challenge</p>
              {last && last.event.score > beat ? (
                <p className="friend-text">
                  You beat <b>{fmt(beat)}</b> with <b>{fmt(last.event.score)}</b>. Send it back!
                </p>
              ) : (
                <p className="friend-text">
                  A friend scored <b>{fmt(beat)}</b>. Beat it.
                </p>
              )}
            </div>
          )}

          {last && (
            <div key={last.n} className="panel last-round">
              <p className="eyebrow">Last round</p>
              <p className="last-score">
                {fmt(last.event.score)} <span>points</span>
              </p>
              <ul className="last-tags">
                {last.result.newBests.includes('score') && <li className="sticker" data-tone="lime">New best</li>}
                {last.result.firstPlay && <li className="sticker">First record</li>}
                {last.result.dailyCompleted && <li className="sticker" data-tone="orange">Daily cleared</li>}
              </ul>
              <div className="last-actions">
                <button className="btn btn-primary btn-sm" onClick={() => void share('challenge')}>
                  <Icon name="link" size={18} /> Challenge a friend
                </button>
                <button className="btn btn-sm" onClick={() => void share('score')}>
                  <Icon name="share" size={18} /> Share score
                </button>
              </div>
            </div>
          )}

          {isDailyGame && <DailyCard variant="compact" headingLevel={2} />}

          <section className="panel side-block" aria-labelledby="bests-title">
            <h2 id="bests-title" className="side-title">
              <Icon name="trophy" /> Your bests
            </h2>
            {record ? (
              <dl className="bests">
                {game.stats.map((s) => (
                  <div key={s.key}>
                    <dt>{s.label}</dt>
                    <dd className="mono">
                      {record.best[s.key] !== undefined ? fmt(record.best[s.key]!) : '–'}
                      {s.unit && record.best[s.key] !== undefined ? ` ${s.unit}` : ''}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>Rounds played here</dt>
                  <dd className="mono">{fmt(record.plays)}</dd>
                </div>
              </dl>
            ) : (
              <p className="side-muted">Finish a round to set your first record. Bests are saved on this device only.</p>
            )}
          </section>

          <section className="panel side-block" aria-labelledby="how-title">
            <h2 id="how-title" className="side-title">
              How to play
            </h2>
            {game.controls.keyboard && (
              <div className="controls">
                <p className="controls-head">
                  <Icon name="keyboard" /> Keyboard
                </p>
                <ul>
                  {game.controls.keyboard.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {game.controls.touch && (
              <div className="controls">
                <p className="controls-head">
                  <Icon name="touch" /> Touch
                </p>
                <ul>
                  {game.controls.touch.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <AdSlot placement="game" />
        </aside>
      </div>

      <section className="wrap game-about" aria-labelledby="about-title">
        <div className="game-about-copy">
          <p className="eyebrow">About the game</p>
          <h2 id="about-title">{game.title}</h2>
          <p>{game.description}</p>
          {game.homepage && (
            <a href={game.homepage} className="ext-link" target="_blank" rel="noopener">
              Also playable at {new URL(game.homepage).host} <Icon name="external" size={16} />
            </a>
          )}
        </div>
        {game.highlights && (
          <ul className="latest-list game-highlights">
            {game.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="wrap section" aria-labelledby="related-title">
          <div className="section-head">
            <h2 id="related-title">Play next</h2>
          </div>
          <div className="related-grid">
            {related.map((g, i) => (
              <GameTile key={g.slug} game={g} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
