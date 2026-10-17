import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type RefObject } from 'react';
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

interface Props {
  game: GameEntry;
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
export function GameStage({ game, autoStart = false, onEvent, onPhase, stageRef }: Props) {
  const [phase, setPhaseState] = useState<Phase>(() => (!autoStart ? 'poster' : game.runtime.kind === 'embed' ? 'loading' : 'ready'));
  const [attempt, setAttempt] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
    const origins = game.runtime.origins;
    const onMessage = (e: MessageEvent): void => {
      if (e.source !== iframeRef.current?.contentWindow || !origins.includes(e.origin)) return;
      const ev = parseGameMessage(e.data);
      if (ev) onEvent(ev);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [game.runtime, onEvent]);

  // Embedded games: give up waiting after a while and offer a retry.
  useEffect(() => {
    if (phase !== 'loading') return;
    const t = window.setTimeout(() => setPhase('error'), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, attempt, setPhase]);

  const host = useMemo(() => ({ report: onEvent }), [onEvent]);
  const Module = game.runtime.kind === 'module' ? LAZY_GAMES[game.slug] : undefined;

  const start = (): void => {
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
          {game.runtime.kind === 'embed' && <p className="stage-note mono">Loads from {new URL(game.runtime.url).host}</p>}
        </div>
      )}

      {phase === 'loading' && <StageLoading title={game.title} />}

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
