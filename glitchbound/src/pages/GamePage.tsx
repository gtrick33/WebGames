import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { relatedGames } from '../catalog/catalog';
import { CATEGORIES, type GameEntry } from '../catalog/types';
import { AdSlot } from '../components/AdSlot';
import { Burst } from '../components/Burst';
import { DailyCard } from '../components/DailyCard';
import { GameStage } from '../components/GameStage';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { reportError, track } from '../platform/analytics';
import { account, api, useAccount } from '../platform/account';
import type { RunEndResult } from '../platform/apiTypes';
import { FavoriteButton } from '../components/FavoriteButton';
import { MiniLeaderboard } from '../components/Leaderboard';
import { openSignIn } from '../components/SignIn';
import { setGuestName, usePlayerName } from '../platform/playerName';
import { music } from '../platform/music';
import { openFeedback } from '../platform/feedback';
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
  /** Server result for signed-in players (rank, verified new best). */
  server?: RunEndResult | null;
}

/** Stops pinch/double-tap zoom while a game fills the screen (restored afterwards). */
function lockZoom(on: boolean): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const base = 'width=device-width, initial-scale=1, viewport-fit=cover';
  meta.setAttribute('content', on ? `${base}, maximum-scale=1, user-scalable=no` : base);
}

/**
 * Real fullscreen where the browser allows it on an element; otherwise (iPhone Safari) an
 * "immersive" mode that pins the stage over the whole screen. Either way the page stops scrolling
 * and zooming while playing.
 */
function usePlayMode(ref: RefObject<HTMLElement | null>, onLeave?: () => void): { active: boolean; enter: () => void; exit: () => void } {
  const [mode, setMode] = useState<'none' | 'fullscreen' | 'immersive'>('none');
  const modeRef = useRef(mode);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });

  const apply = useCallback(
    (next: 'none' | 'fullscreen' | 'immersive') => {
      if (next === 'none' && modeRef.current !== 'none') onLeaveRef.current?.();
      modeRef.current = next;
      const el = ref.current;
      el?.classList.toggle('stage-immersive', next === 'immersive');
      document.documentElement.classList.toggle('game-focus', next !== 'none');
      lockZoom(next !== 'none');
      setMode(next);
    },
    [ref],
  );

  useEffect(() => {
    const onChange = (): void => {
      if (document.fullscreenElement === ref.current && ref.current) apply('fullscreen');
      else if (!document.fullscreenElement) apply('none');
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.documentElement.classList.remove('game-focus');
      lockZoom(false);
    };
  }, [ref, apply]);

  const enter = (): void => {
    const el = ref.current;
    if (!el) return;
    // Must run inside the click handler: browsers only allow fullscreen from a user gesture.
    if (document.fullscreenEnabled && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => apply('immersive'));
    } else {
      apply('immersive');
    }
  };
  const exit = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    apply('none');
  };

  useEffect(() => {
    if (mode !== 'immersive') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') apply('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, apply]);

  return { active: mode !== 'none', enter, exit };
}

/**
 * Full-screen controls as a small tab on the left edge, where game HUDs rarely sit: tap to open
 * Exit full screen / Exit game; it folds away again after a few seconds.
 */
function StageMenu({ onExitFullscreen, onExitGame }: { onExitFullscreen: () => void; onExitGame: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), 4000);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <div className={`stage-menu${open ? ' is-open' : ''}`}>
      <button className="stage-menu-tab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Game menu">
        <Icon name="menu" size={16} />
      </button>
      {open && (
        <div className="stage-menu-items">
          <button className="stage-exit" onClick={onExitFullscreen}>
            <Icon name="shrink" size={16} /> Exit full screen
          </button>
          <button className="stage-exit" onClick={onExitGame}>
            <Icon name="close" size={16} /> Exit game
          </button>
        </div>
      )}
    </div>
  );
}

export function GamePage({ game }: { game: GameEntry }) {
  const { search } = useLocation();
  const beat = parseBeatParam(search);
  const save = useSave();
  const record = save.games[game.slug];
  const stageRef = useRef<HTMLDivElement>(null);
  // Leaving full screen (Escape, the browser's own exit, or the menu) pauses the game and its music.
  const [pauseSignal, setPauseSignal] = useState(0);
  const play = usePlayMode(stageRef, () => setPauseSignal((n) => n + 1));
  const frameRef = useRef<HTMLIFrameElement>(null);
  const player = usePlayerName();
  const [renaming, setRenaming] = useState(false);
  const [renameMsg, setRenameMsg] = useState('');
  // Remounting the stage resets the game: autoStart restarts it, otherwise it closes back to the poster.
  const [stageRun, setStageRun] = useState({ key: 0, autoStart: false });
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<LastRound | null>(null);
  const [burst, setBurst] = useState(0);

  const [shareMsg, setShareMsg] = useState('');
  const related = relatedGames(game);
  const isDailyGame = challengeForDay(dayKey(), GAMES)?.game.slug === game.slug;
  const { me } = useAccount();
  const runRef = useRef<Promise<string | null> | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  usePageMeta({ title: `Play ${game.title}`, description: `${game.tagline} Free to play in your browser on GlitchBound.`, path: `/games/${game.slug}`, image: `/games/${game.slug}/og.jpg` });

  useEffect(() => {
    track('game_view', { game: game.slug });
  }, [game.slug]);

  // The lobby music steps aside while a game is loaded on this page.
  useEffect(() => {
    music.setGameActive(playing);
    return () => music.setGameActive(false);
  }, [playing]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      const signedIn = !!account.state.me;
      if (e.type === 'ready') return;
      if (e.type === 'start') {
        track('game_start', { game: game.slug });
        // Members: the server timestamps the start so the finished score can be checked.
        runRef.current = signedIn
          ? api<{ runId: string }>('/api/runs/start', { body: { game: game.slug } })
              .then((r) => r.runId)
              .catch(() => null)
          : null;
        return;
      }
      const result = saveStore.record(game, e);
      let n = 0;
      setLast((prev) => {
        n = (prev?.n ?? 0) + 1;
        return { event: e, result, n, server: signedIn ? undefined : null };
      });
      const pending = runRef.current;
      runRef.current = null;
      if (pending) {
        void pending.then(async (runId) => {
          if (!runId) return;
          try {
            const server = await api<RunEndResult>('/api/runs/end', { body: { runId, score: e.score, stats: e.stats ?? {}, day: dayKey() } });
            account.setQuests(server.quests);
            setLast((prev) => (prev && prev.n === n ? { ...prev, server } : prev));
            setBoardKey((k) => k + 1);
            if (server.newBest) setBurst((b) => b + 1);
          } catch {
            setLast((prev) => (prev && prev.n === n ? { ...prev, server: null } : prev));
          }
        });
      }
      track('game_end', { game: game.slug, score: e.score });
      if (result.dailyCompleted) track('daily_complete', { game: game.slug, day: dayKey() });
      if (result.gameDailyCompleted) track('daily_complete', { game: game.slug, day: dayKey(), kind: 'game' });
      if (result.dailyCompleted || result.gameDailyCompleted || result.newBests.includes('score') || (beat !== null && e.score > beat)) setBurst((b) => b + 1);
    },
    [game, beat],
  );

  const restart = (): void => {
    track('replay_click', { game: game.slug, where: 'toolbar' });
    setStageRun((r) => ({ key: r.key + 1, autoStart: true }));
  };

  /** Closes the game and unloads everything it loaded (iframe or module chunk state, canvases, sounds). */
  const close = (): void => {
    track('game_close', { game: game.slug });
    play.exit();
    setPlaying(false);
    setStageRun((r) => ({ key: r.key + 1, autoStart: false }));
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
        <Link href="/#arcade" className="btn btn-sm btn-ghost back-link" aria-label="Back to the arcade">
          <Icon name="arrowLeft" size={18} /> <span className="hide-sm">Arcade</span>
        </Link>
        <div className="game-heading">
          <h1>{game.title}</h1>
          <span className="chip">{CATEGORIES[game.categories[0]].label}</span>
        </div>
        <div className="game-actions">
          <FavoriteButton slug={game.slug} title={game.title} />
          {playing && (
            <button className="btn btn-sm" onClick={restart} title="Reload the game">
              <Icon name="restart" size={18} /> <span className="hide-sm">Restart</span>
            </button>
          )}
          {playing && (
            <button className="btn btn-sm btn-icon" onClick={play.enter} aria-label="Fullscreen" title="Fullscreen">
              <Icon name="expand" size={18} />
            </button>
          )}
          {playing && (
            <button className="btn btn-sm" onClick={close} title="Close the game and free its memory">
              <Icon name="close" size={18} /> <span className="hide-sm">Exit game</span>
            </button>
          )}
          <button className="btn btn-sm btn-icon" onClick={() => void share('game')} aria-label={`Share ${game.title}`} title="Share">
            <Icon name="share" size={18} />
          </button>
        </div>
      </div>

      <div className="wrap game-layout">
        <div className="game-stage-col">
          <GameStage
            key={stageRun.key}
            autoStart={stageRun.autoStart}
            pauseSignal={pauseSignal}
            game={game}
            onEvent={onEvent}
            stageRef={stageRef}
            frameRef={frameRef}
            playerName={player.name}
            onPlayClick={play.enter}
            overlay={
              play.active ? (
                <StageMenu onExitFullscreen={play.exit} onExitGame={close} />
              ) : null
            }
            onPhase={(p) => {
              setPlaying(p === 'loading' || p === 'ready');
              if (p === 'error') {
                track('game_error', { game: game.slug });
                reportError('game_load_failed', `${game.title} did not load`, game.slug);
              }
            }}
          />
          {burst > 0 && <Burst key={burst} />}
        </div>

        <aside className="game-side" aria-label={`${game.title} details`}>
          <p className="game-share-msg" role="status">
            {shareMsg}
          </p>

          <div className="panel player-name">
            <span className="mono">Playing as</span>
            {renaming && !player.member ? (
              <form
                className="rename-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const err = setGuestName(String(new FormData(e.currentTarget).get('name') ?? ''));
                  setRenameMsg(err ?? '');
                  if (!err) setRenaming(false);
                }}
              >
                <input className="field" name="name" defaultValue={player.name} maxLength={14} aria-label="Player name" autoFocus />
                <button className="btn btn-primary btn-sm">Save</button>
              </form>
            ) : (
              <div className="player-row">
                <strong>{player.name}</strong>
                {player.member ? (
                  <Link href="/me" className="link-btn">
                    Change
                  </Link>
                ) : (
                  <button className="link-btn" onClick={() => setRenaming(true)}>
                    Change
                  </button>
                )}
              </div>
            )}
            {renameMsg && <p className="side-muted">{renameMsg}</p>}
            {!player.member && (
              <p className="side-muted">
                Guest name. <button className="link-btn" onClick={() => openSignIn('Sign in to keep your name and scores on every device.')}>Sign in</button> to keep it
                on every device.
              </p>
            )}
          </div>

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
                {last.server?.rank && (
                  <li className="sticker" data-tone="cyan">
                    Rank #{last.server.rank}
                  </li>
                )}
                {last.result.newBests.includes('score') && <li className="sticker" data-tone="lime">New best</li>}
                {last.result.firstPlay && <li className="sticker">First record</li>}
                {last.result.dailyCompleted && <li className="sticker" data-tone="orange">Daily cleared</li>}
                {last.result.gameDailyCompleted && <li className="sticker" data-tone="orange">{game.ownDaily?.label ?? 'Daily'} done</li>}
              </ul>
              {!me && (
                <button className="last-signin" onClick={() => openSignIn('Sign in to put your scores on the leaderboard.')}>
                  <Icon name="crown" size={16} /> Sign in to put scores like this on the leaderboard
                </button>
              )}
              {me && last.server === undefined && <p className="mono last-saving">Saving to the leaderboard…</p>}
              {me && last.server && !last.server.ok && <p className="mono last-saving">This round was not ranked ({last.server.error}).</p>}
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

          <MiniLeaderboard game={game} refreshKey={boardKey} />

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

          <div className="game-help">
            <button className="game-help-btn" onClick={() => openFeedback(game.slug)}>
              <Icon name="star" size={16} /> Rate this game
            </button>
            <Link href={`/me/bugs?game=${game.slug}`} className="game-help-btn">
              <Icon name="bug" size={16} /> Report a bug
            </Link>
          </div>

          <AdSlot placement="game" />
        </aside>
      </div>

      <section className="wrap game-about" aria-labelledby="about-title">
        <div className="game-about-copy">
          <p className="eyebrow">About the game</p>
          <h2 id="about-title">{game.title}</h2>
          <p>{game.description}</p>
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
