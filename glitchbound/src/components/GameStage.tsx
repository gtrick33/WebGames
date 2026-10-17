import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react';
import { GAME_MODULES } from '../catalog/modules';
import type { GameEntry } from '../catalog/types';
import { parseGameMessage, type GameEvent, type GameModuleProps } from '../platform/contract';
import { ErrorBoundary } from './ErrorBoundary';
import { Icon } from './Icon';
import './GameStage.css';

type Phase = 'poster' | 'loading' | 'ready' | 'error';

const LOAD_TIMEOUT_MS = 20_000;

/** One lazy component per module game, created once (a failed import is replaced on retry). */
const LAZY_GAMES: Record<string, ComponentType<GameModuleProps>> = Object.fromEntries(Object.entries(GAME_MODULES).map(([slug, load]) => [slug, lazy(load)]));

/** Resolves registry origins ('self' = this site) to concrete origins. */
export function allowedOrigins(origins: string[]): string[] {
  return origins.map((o) => (o === 'self' ? window.location.origin : o));
}

/** Sends a command to an embedded game (see neon-rush/src/analytics/embed.ts listenToHost). */
export function postToGame(frame: HTMLIFrameElement | null, game: GameEntry, message: { type: 'identity'; name: string } | { type: 'pause' }): void {
  if (!frame?.contentWindow || game.runtime.kind !== 'embed') return;
  const target = game.runtime.url.startsWith('/') ? window.location.origin : new URL(game.runtime.url).origin;
  try {
    frame.contentWindow.postMessage({ source: 'glitchbound-host', version: 1, ...message }, target);
  } catch {
    /* the game may be navigating */
  }
}

interface Props {
  game: GameEntry;
  /** The player's name; sent to the game so it never asks for one. */
  playerName?: string;
  /** Called synchronously inside the Play click (so the page can enter fullscreen). */
  onPlayClick?: () => void;
  /** Exposes the game iframe (embedded games). */
  frameRef?: RefObject<HTMLIFrameElement | null>;
  /** Extra UI drawn on top of the stage (e.g. the full-screen Exit button). */
  overlay?: ReactNode;
  /** Skip the poster (used when the stage is remounted by Restart). */
  autoStart?: boolean;
  onEvent: (e: GameEvent) => void;
  onPhase?: (p: Phase) => void;
  /** Exposes the stage element (for fullscreen). */
  stageRef: RefObject<HTMLDivElement | null>;
}

/**
 * The game viewport. Nothing game-related loads until the player presses Play, so the page itself
 * stays fast. Each game is isolated: an iframe for embedded games, an error boundary for modules.
 */
export function GameStage({ game, autoStart = false, onEvent, onPhase, stageRef, playerName, onPlayClick, frameRef, overlay }: Props) {
  const [phase, setPhaseState] = useState<Phase>(() => (!autoStart ? 'poster' : game.runtime.kind === 'embed' ? 'loading' : 'ready'));
  const [attempt, setAttempt] = useState(0);
  const ownFrame = useRef<HTMLIFrameElement>(null);
  const iframeRef = frameRef ?? ownFrame;
  const onPhaseRef = useRef(onPhase);
  useEffect(() => {
    onPhaseRef.current = onPhase;
  });
  const setPhase = useCallback((p: Phase) => {
    setPhaseState(p);
    onPhaseRef.current?.(p);
  }, []);

  // Embedded games: accept messages only from this iframe and the registry's origins.
  useEffect(() => {
    if (game.runtime.kind !== 'embed') return;
    const origins = allowedOrigins(game.runtime.origins);
    const onMessage = (e: MessageEvent): void => {
      if (e.source !== iframeRef.current?.contentWindow || !origins.includes(e.origin)) return;
      const ev = parseGameMessage(e.data);
      if (ev) onEvent(ev);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [game.runtime, onEvent, iframeRef]);

  // Keep the game's racer name in sync with the arcade (sent again whenever it changes).
  useEffect(() => {
    if (phase === 'ready' && playerName) postToGame(iframeRef.current, game, { type: 'identity', name: playerName });
  }, [phase, playerName, game, iframeRef]);

  // Pause the game (and its sound) when it is scrolled mostly out of view.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || phase !== 'ready') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio < 0.4) postToGame(iframeRef.current, game, { type: 'pause' });
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phase, game, stageRef, iframeRef]);

  // Embedded games: give up waiting after a while and offer a retry.
  useEffect(() => {
    if (phase !== 'loading') return;
    const t = window.setTimeout(() => setPhase('error'), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, attempt, setPhase]);

  const host = useMemo(() => ({ report: onEvent }), [onEvent]);
  const Module = game.runtime.kind === 'module' ? LAZY_GAMES[game.slug] : undefined;

  const start = (): void => {
    onPlayClick?.();
    if (game.runtime.kind === 'module' && !Module) {
      setPhase('error');
      return;
    }
    setPhase(game.runtime.kind === 'embed' ? 'loading' : 'ready');
  };

  const retry = (): void => {
    const loader = GAME_MODULES[game.slug];
    if (loader) LAZY_GAMES[game.slug] = lazy(loader); // a failed lazy() import stays failed; make a fresh one
    setAttempt((a) => a + 1);
    start();
  };

  const playing = phase === 'loading' || phase === 'ready';

  return (
    <div ref={stageRef} className={`stage stage-${game.aspect}`} style={{ background: game.art.bg }} data-phase={phase}>
      {game.runtime.kind === 'embed' && playing && (
        <iframe
          key={attempt}
          ref={iframeRef}
          className="stage-frame"
          src={game.runtime.url}
          title={`${game.title} game`}
          allow="fullscreen; autoplay; gamepad; screen-wake-lock"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            setPhase('ready');
            iframeRef.current?.focus();
            if (playerName) postToGame(iframeRef.current, game, { type: 'identity', name: playerName });
          }}
        />
      )}

      {game.runtime.kind === 'module' && phase === 'ready' && Module && (
        <ErrorBoundary key={attempt} onError={() => setPhase('error')} fallback={() => null}>
          <Suspense fallback={<StageLoading title={game.title} />}>
            <div className="stage-module">
              <Module host={host} restartKey={attempt} />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}

      {phase === 'poster' && (
        <div className="stage-poster">
          <img src={game.art.tile} alt="" className="stage-poster-art" />
          <button className="stage-play" onClick={start} autoFocus={false}>
            <span className="stage-play-disc" aria-hidden="true">
              <Icon name="play" size={40} />
            </span>
            <span className="stage-play-text">Play {game.title}</span>
          </button>
          {game.runtime.kind === 'embed' && !game.runtime.url.startsWith('/') && <p className="stage-note mono">Loads from {new URL(game.runtime.url).host}</p>}
        </div>
      )}

      {phase === 'loading' && <StageLoading title={game.title} />}
      {overlay}

      {phase === 'error' && (
        <div className="stage-error" role="alert">
          <p className="stage-error-code mono">Signal lost</p>
          <h2>{game.title} didn&rsquo;t load.</h2>
          <p>Check your connection and try again. The rest of GlitchBound still works.</p>
          <div className="stage-error-actions">
            <button className="btn btn-lime" onClick={retry}>
              <Icon name="restart" /> Try again
            </button>
            {game.homepage && (
              <a className="btn" href={game.homepage} target="_blank" rel="noopener">
                Open on its own site <Icon name="external" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StageLoading({ title }: { title: string }) {
  return (
    <div className="stage-loading" role="status">
      <span className="stage-loader" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="mono">Loading {title}</span>
    </div>
  );
}
