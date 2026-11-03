import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { tGame, useT } from '../i18n';
import { gamePath, gameUrl, relatedGames } from '../catalog/catalog';
import { CATEGORIES, type GameEntry } from '../catalog/types';
import { AdSlot } from '../components/AdSlot';
import { Burst } from '../components/Burst';
import { DailyCard } from '../components/DailyCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GameStage } from '../components/GameStage';
import { GameTile } from '../components/GameTile';
import { HowTo, howToSeen, markHowToSeen } from '../components/HowTo';
import { Icon } from '../components/Icon';
import { reportError, track } from '../platform/analytics';
import { account, api, ApiError, useAccount } from '../platform/account';
import { useLiveCatalog } from '../platform/liveCatalog';
import { SCORES_EVENT } from '../platform/challenge';
import { challengeSpecOf, useChallengeRun, type ChallengeRunState } from '../platform/useChallengeRun';
import { ChallengeFriends, inviteToChallenge, startChallenge } from '../components/ChallengeFriends';

// The challenge dock and scoreboard load only on challenge links (/games/<slug>?challenge=<id>).
const ChallengeDock = lazy(fresh(() => import('../components/Challenge').then((m) => ({ default: m.ChallengeDock }))));
const ChallengeScores = lazy(fresh(() => import('../components/Challenge').then((m) => ({ default: m.ChallengeScores }))));
const ChallengeScoresChip = lazy(fresh(() => import('../components/Challenge').then((m) => ({ default: m.ChallengeScoresChip }))));
const ChallengeIntro = lazy(fresh(() => import('../components/Challenge').then((m) => ({ default: m.ChallengeIntro }))));
import type { RunEndResult } from '../platform/apiTypes';
import { FavoriteButton } from '../components/FavoriteButton';
import { LiveBadge } from '../components/LiveBadge';
import { nextStep } from '../platform/nextStep';
import { useFlagships } from '../platform/useFlagships';
import { recentSlugs } from '../platform/save';
// The leaderboard tab loads its data from the network anyway, so its code comes with it (its styles stay
// in the main sheet: admin tables share them).
import '../components/Leaderboard.css';
// Its code starts loading with the game page's own, so the board is there at the first paint instead of
// growing into the column a moment later and pushing everything under it down.
const MiniLeaderboard = lazyPage(() => import('../components/Leaderboard').then((m) => m.MiniLeaderboard));
void MiniLeaderboard.preload()?.catch(() => undefined);
const DailyCompare = lazy(fresh(() => import('../components/DailyCompare').then((m) => ({ default: m.DailyCompare }))));
import { openSignIn } from '../components/openSignIn';
import { setGuestName, usePlayerName } from '../platform/playerName';
import { isIos, isStandalone } from '../platform/install';
import { music } from '../platform/music';
import { openFeedback } from '../platform/feedback';
import type { EndEvent, GameEvent } from '../platform/contract';
import { challengeForDay, fmt } from '../platform/daily';
import { dayKey } from '../platform/dates';
import { SITE_URL } from '../platform/env';
import { usePageMeta } from '../platform/meta';
import type { GameRecord, RoundResult } from '../platform/save';
import { saveStore, useSave } from '../platform/store';
import { parseBeatParam, shareOrCopy } from '../platform/share';
import { GAMES } from '../catalog/games';
import { Link, navigate, useLocation } from '../router/router';
import { AdultLabel } from '../components/AdultLabel';
import './GamePage.css';
import { fresh } from '../platform/freshBuild';
import { lazyPage } from '../platform/lazyPage';

interface LastRound {
  event: EndEvent;
  result: RoundResult;
  n: number;
  /** Server result for signed-in players (rank, verified new best). */
  server?: RunEndResult | null;
}

/**
 * The open leaderboard run of this tab's round, per game (sessionStorage): a round resumed after a
 * reload keeps the run its first start opened, so the server times the whole round. As long as the
 * server keeps an unfinished run open (functions/api/runs/start.ts).
 */
const RUN_KEEP_MS = 12 * 3600_000;
const runKey = (slug: string): string => `gb:run:${slug}`;
function keptRun(slug: string): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(runKey(slug)) ?? 'null') as { runId?: unknown; startedAt?: unknown } | null;
    if (v && typeof v.runId === 'string' && typeof v.startedAt === 'number' && Date.now() - v.startedAt < RUN_KEEP_MS) return v.runId;
  } catch {
    /* storage blocked: the run lives in this page only */
  }
  return null;
}
function keepRun(slug: string, runId: string | null): void {
  try {
    if (runId) sessionStorage.setItem(runKey(slug), JSON.stringify({ runId, startedAt: Date.now() }));
    else sessionStorage.removeItem(runKey(slug));
  } catch {
    /* storage blocked */
  }
}

/** Why the server didn't rank a round, for "This round was not ranked (…)". */
const NOT_RANKED: Record<string, string> = {
  too_fast: 'too short to count',
  implausible_score: 'score too high for the time played',
  above_max: 'score above the game’s maximum',
  bad_stats: 'its stats don’t add up',
  no_run: 'its start wasn’t recorded, e.g. after a reload',
};

/** Stops pinch/double-tap zoom while a game fills the screen (restored afterwards). */
function lockZoom(on: boolean): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const base = 'width=device-width, initial-scale=1, viewport-fit=cover';
  meta.setAttribute('content', on ? `${base}, maximum-scale=1, user-scalable=no` : base);
}

type PlayModeState = 'none' | 'fullscreen' | 'immersive';

/** How long a full-screen request may take before the stage is pinned instead (it resolved without entering, or never settled). */
export const FULLSCREEN_WATCHDOG_MS = 800;
/** A full screen the browser leaves this soon after entering counts as one that doesn't hold. */
const QUICK_DROP_MS = 1000;
/** After this many requests that didn't hold, the stage stays pinned for the rest of the session. */
const MAX_FULLSCREEN_FAILS = 2;
const NO_FULLSCREEN_KEY = 'glitchbound.noFullscreen';

const touchScreen = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function fullscreenGivenUp(): boolean {
  try {
    return sessionStorage.getItem(NO_FULLSCREEN_KEY) === '1';
  } catch {
    return false;
  }
}

export interface PlayMode {
  active: boolean;
  immersive: boolean;
  /** Into play mode: real full screen where the browser gives it, else the stage pinned over the screen. */
  enter: () => void;
  /** From a tap while pinned: asks for real full screen again after the browser left it by itself. */
  retryFullscreen: () => void;
  /** The player's own way out (Exit full screen, Exit game): the only thing that ends play mode on a phone. */
  exit: () => void;
}

/**
 * Real fullscreen where the browser allows it on an element; otherwise (iPhone Safari, the Home Screen
 * app) an "immersive" mode that pins the stage over the whole screen. Either way the page stops scrolling
 * and zooming while playing.
 *
 * On a touch screen play mode is one state that only the player ends: when the browser leaves full screen
 * by itself (a system gesture, a rotation, a sheet, a request it never honored) the stage stays pinned,
 * the game pauses (`onPause`), and the next tap asks for full screen again. On a desktop Escape leaves.
 */
export function usePlayMode(ref: RefObject<HTMLElement | null>, onLeave?: () => void, landscape = false, onPause?: () => void): PlayMode {
  const [mode, setMode] = useState<PlayModeState>('none');
  const modeRef = useRef(mode);
  const onLeaveRef = useRef(onLeave);
  const onPauseRef = useRef(onPause);
  useEffect(() => {
    onLeaveRef.current = onLeave;
    onPauseRef.current = onPause;
  });
  // real full screen is wanted (asked for, or left by the browser itself), and since when it last held
  const wantFull = useRef(false);
  const enteredAt = useRef(0);
  const fails = useRef(0);
  // each request (and the player's exit) gets a number: a late answer to an older one changes nothing
  const attempt = useRef(0);
  const asked = useRef(-1);
  // the request came from a tap after the browser left: the game stays paused when full screen comes back
  const pauseOnEnter = useRef(false);
  const watchdog = useRef(0);
  // a request is out and hasn't been answered yet: taps meanwhile don't ask again (each miss must count)
  const waiting = useRef(false);

  const apply = useCallback(
    (next: PlayModeState) => {
      const was = modeRef.current;
      if (next === 'none' && was !== 'none') onLeaveRef.current?.();
      modeRef.current = next;
      const el = ref.current;
      el?.classList.toggle('stage-immersive', next === 'immersive');
      document.documentElement.classList.toggle('game-focus', next !== 'none');
      // iPhone Safari can't hide its bars for a website: the page under the pinned stage stays
      // scrollable, so a swipe on the game lets Safari tuck them away
      document.documentElement.classList.toggle('game-scroll', next === 'immersive' && isIos() && !isStandalone());
      lockZoom(next !== 'none');
      setMode(next);
      // The page may have moved under the pinned stage (iPhone Safari): come back to the top, where
      // the game's toolbar and the way back to the arcade are (issue #21).
      if (was === 'immersive' && next === 'none') window.scrollTo(0, 0);
    },
    [ref],
  );

  const failed = useCallback((): void => {
    fails.current += 1;
    if (fails.current < MAX_FULLSCREEN_FAILS) return;
    wantFull.current = false;
    try {
      sessionStorage.setItem(NO_FULLSCREEN_KEY, '1');
    } catch {
      /* storage blocked: given up for this page only */
    }
  }, []);

  // A restart remounts the stage: the new one is pinned over the screen too while immersive.
  useLayoutEffect(() => {
    ref.current?.classList.toggle('stage-immersive', mode === 'immersive');
  });

  useEffect(() => {
    const onChange = (): void => {
      const el = ref.current;
      if (el && document.fullscreenElement === el) {
        window.clearTimeout(watchdog.current);
        waiting.current = false;
        // a request the player's own exit overtook: leave again
        if (asked.current !== attempt.current) {
          void document.exitFullscreen().catch(() => undefined);
          return;
        }
        enteredAt.current = Date.now();
        apply('fullscreen');
        if (pauseOnEnter.current) onPauseRef.current?.();
        pauseOnEnter.current = false;
        return;
      }
      if (document.fullscreenElement || modeRef.current !== 'fullscreen') return;
      // the browser left full screen by itself (the player's own exit has already set 'none')
      if (!touchScreen()) {
        apply('none');
        return;
      }
      if (Date.now() - enteredAt.current < QUICK_DROP_MS) failed();
      else wantFull.current = !fullscreenGivenUp();
      apply('immersive');
      onPauseRef.current?.();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      // the watchdog goes, so nothing would ever answer a request still out
      window.clearTimeout(watchdog.current);
      waiting.current = false;
      document.documentElement.classList.remove('game-focus', 'game-scroll');
      lockZoom(false);
    };
  }, [ref, apply, failed]);

  const request = (el: HTMLElement): void => {
    if (waiting.current) return;
    waiting.current = true;
    const n = ++attempt.current;
    asked.current = n;
    wantFull.current = true;
    let missedOnce = false;
    const missed = (): void => {
      if (missedOnce || n !== attempt.current || document.fullscreenElement === el) return;
      missedOnce = true;
      waiting.current = false;
      window.clearTimeout(watchdog.current);
      pauseOnEnter.current = false;
      failed();
      if (modeRef.current === 'none') apply('immersive');
    };
    window.clearTimeout(watchdog.current);
    watchdog.current = window.setTimeout(missed, FULLSCREEN_WATCHDOG_MS);
    let pending: Promise<void> | undefined;
    try {
      pending = el.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      missed();
      return;
    }
    Promise.resolve(pending)
      .then(() => {
        // a landscape game on a phone held upright: turn the screen (Android; an iPhone can't be turned,
        // and a game may turn itself instead)
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (landscape && touchScreen()) o?.lock?.('landscape').catch(() => undefined);
      })
      .catch(missed);
  };

  const canAskFull = (el: HTMLElement): boolean => !!document.fullscreenEnabled && typeof el.requestFullscreen === 'function' && !fullscreenGivenUp();

  const enter = (): void => {
    const el = ref.current;
    if (!el || modeRef.current === 'fullscreen') return;
    // Must run inside the click handler: browsers only allow fullscreen from a user gesture.
    const ask = canAskFull(el);
    if (ask) request(el);
    // on a phone the stage is pinned at once, whatever the browser does with the request
    // (a browser that enters at once has already set 'fullscreen' inside the request)
    if ((!ask || touchScreen()) && (modeRef.current as PlayModeState) !== 'fullscreen') apply('immersive');
  };
  const retryFullscreen = (): void => {
    const el = ref.current;
    if (!el || modeRef.current !== 'immersive' || !wantFull.current || !canAskFull(el)) return;
    pauseOnEnter.current = true;
    request(el);
  };
  const exit = (): void => {
    attempt.current += 1;
    window.clearTimeout(watchdog.current);
    waiting.current = false;
    wantFull.current = false;
    pauseOnEnter.current = false;
    // 'none' first, so the fullscreenchange that follows reads as the player's own exit
    apply('none');
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };

  const exitRef = useRef(exit);
  useEffect(() => {
    exitRef.current = exit;
  });
  useEffect(() => {
    if (mode !== 'immersive') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') exitRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  return { active: mode !== 'none', immersive: mode === 'immersive', enter, retryFullscreen, exit };
}

/**
 * iPhone Safari while a game is pinned over the screen: as long as Safari's bar is showing, a handle
 * at the bottom. A swipe up on it scrolls the page under the stage and Safari tucks its bar away, in
 * every game, even ones that keep swipes for themselves (or run in a frame). It goes as the bar goes.
 */
function SafariBarsHandle() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('glitchbound.barsHandle') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    // the large viewport (bars tucked away) against the visible one tells whether the bar is out
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const check = (): void => setOpen(window.innerHeight < probe.offsetHeight - 24);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('scroll', check, { passive: true });
    window.visualViewport?.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('scroll', check);
      window.visualViewport?.removeEventListener('resize', check);
      probe.remove();
    };
  }, []);
  if (!open || dismissed) return null;
  return (
    <div className="stage-handle" role="note">
      <Icon name="arrowUp" size={18} />
      <span>{t('Swipe up here to hide Safari’s bar')}</span>
      <button
        className="stage-handle-x"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem('glitchbound.barsHandle', '1');
          } catch {
            /* storage blocked */
          }
        }}
        aria-label={t('Close')}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/** Tab and Shift+Tab go round a dialog's buttons instead of leaving it for the page behind (PU-10). */
export function keepTabInside(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'Tab') return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const at = document.activeElement;
  if (e.shiftKey ? at === first || !e.currentTarget.contains(at) : at === last || !e.currentTarget.contains(at)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}

/**
 * In full screen: a menu button on the left edge (where game HUDs rarely sit) that pauses the game and
 * opens a pop-up with the ways out: continue, how to play, leave full screen, close the game, report a bug. It used
 * to be a faint tab that folded away, which players on phones couldn't find (issues #21, #22).
 */
function StageMenu({ slug, title, placement, open, setOpen, onOpen, onExitFullscreen, onExitGame, onHowTo }: { slug: string; title: string; placement: GameEntry['menu']; open: boolean; setOpen: (open: boolean) => void; onOpen: () => void; onExitFullscreen: () => void; onExitGame: () => void; onHowTo?: () => void }) {
  const t = useT();
  // games draw the button in their own UI (the default); a corner in the registry makes the arcade draw one instead
  const spot = placement && placement !== 'own' ? placement : null;
  useEffect(() => {
    if (!open) return;
    // Escape closes the pop-up first, before it would leave full screen.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, setOpen]);
  return (
    <>
      {spot && (
        <button
          className="stage-menu-btn"
          data-corner={spot.corner}
          style={{ '--menu-x': `${spot.x ?? 0}px`, '--menu-y': `${spot.y ?? 0}px` } as CSSProperties}
          onClick={() => {
            onOpen();
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-label={t('Game menu')}
          title={t('Game menu')}
        >
          <Icon name="menu" size={20} />
        </button>
      )}
      {open && (
        <div className="stage-menu-backdrop" onClick={() => setOpen(false)}>
          <div className="stage-menu-sheet" role="dialog" aria-modal="true" aria-label={t('Game menu')} onClick={(e) => e.stopPropagation()} onKeyDown={keepTabInside}>
            <p className="stage-menu-title">{title}</p>
            <button className="btn btn-primary" onClick={() => setOpen(false)} autoFocus>
              <Icon name="play" size={18} /> {t('Continue')}
            </button>
            {onHowTo && (
              <button
                className="btn"
                onClick={() => {
                  setOpen(false);
                  onHowTo();
                }}
              >
                <Icon name="gamepad" size={18} /> {t('How to play')}
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                setOpen(false);
                onExitFullscreen();
              }}
            >
              <Icon name="shrink" size={18} /> {t('Exit full screen')}
            </button>
            <button
              className="btn"
              onClick={() => {
                setOpen(false);
                onExitGame();
              }}
            >
              <Icon name="close" size={18} /> {t('Exit game')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setOpen(false);
                onExitFullscreen();
                navigate(`/me/bugs?game=${slug}`);
              }}
            >
              <Icon name="bug" size={18} /> {t('Report a bug')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * What the stage's challenge scoreboard does when the challenge's status changes: your score is in
 * (a chip while the game still shows its own result, else the scoreboard), the challenge ended
 * (the scoreboard), a new round is yours (closed, unless the stage still plays the last round:
 * then it stays open with "Play round N").
 */
export function scoreboardOnStatus(status: ChallengeRunState['status'], { open, playing, stageOld }: { open: boolean; playing: boolean; stageOld: boolean }): { open: boolean; chip: boolean } {
  if (status === 'sent') return playing ? { open, chip: true } : { open: true, chip: false };
  if (status === 'closed' || status === 'gone') return { open: true, chip: false };
  if (status === 'ready') return { open: open && stageOld, chip: false };
  return { open, chip: false };
}

export function GamePage({ game }: { game: GameEntry }) {
  const t = useT();
  const { search } = useLocation();
  const beat = parseBeatParam(search);
  const challengeId = game.challenge ? new URLSearchParams(search).get('challenge') : null;
  const save = useSave();
  const record = save.games[game.slug];
  const stageRef = useRef<HTMLDivElement>(null);
  // Leaving play mode (Escape, or the menu) pauses the game and its music, and closes the game menu (left
  // open, it would come back over the game the next time it went full screen). On a phone the browser leaving
  // full screen by itself only pauses: the stage stays pinned over the screen.
  const [pauseSignal, setPauseSignal] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const play = usePlayMode(
    stageRef,
    () => {
      setPauseSignal((n) => n + 1);
      setMenuOpen(false);
    },
    game?.aspect === 'landscape',
    () => setPauseSignal((n) => n + 1),
  );
  // On a phone a game plays full screen. One playing in the page (it started without a tap that could take it
  // there) goes there at the next touch on it, and a pinned one the browser took out of full screen asks for it
  // again; only the player's own "Exit full screen" leaves it in the page.
  const keptInPage = useRef(false);
  const goFull = (): void => {
    keptInPage.current = false;
    play.enter();
  };
  const stayInPage = (): void => {
    keptInPage.current = true;
    play.exit();
  };
  const openMenu = useCallback(() => {
    setPauseSignal((n) => n + 1);
    setMenuOpen(true);
  }, []);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const player = usePlayerName();
  const chal = useChallengeRun(challengeId, game, player.name);
  const finishChallenge = useRef(chal.finish);
  const beginChallenge = useRef(chal.begin);
  // Layout effects: current before a game mounting in the same render reports its start (see useChallengeRun).
  useLayoutEffect(() => {
    finishChallenge.current = chal.finish;
    beginChallenge.current = chal.begin;
  });
  // The challenge scoreboard on the stage: opens by itself when your score is in, or from the dock.
  const [scoresOpen, setScoresOpen] = useState(false);
  // The games' own "See the scoreboard" buttons open it too.
  useEffect(() => {
    const open = (): void => setScoresOpen(true);
    window.addEventListener(SCORES_EVENT, open);
    return () => window.removeEventListener(SCORES_EVENT, open);
  }, []);
  const [renaming, setRenaming] = useState(false);
  const [renameMsg, setRenameMsg] = useState('');
  // Remounting the stage resets the game: autoStart restarts it, otherwise it closes back to the poster.
  // With a mouse and keyboard a module game opens straight on its own menu (one click fewer; full screen
  // stays a button away). Phones keep the Play poster: that tap is what takes the game full screen.
  // Embeds and challenge rounds keep it too.
  const [arrival] = useState(() => {
    const ownMenu = game.runtime.kind === 'module' && !challengeId && typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
    // A banner's Play (/games/<slug>?play=1, catalog playPath) already was the press on the poster (issue #24).
    const pressedPlay = !ownMenu && !challengeId && new URLSearchParams(search).get('play') === '1';
    return { ownMenu, pressedPlay };
  });
  const [stageRun, setStageRun] = useState(() => ({ key: 0, autoStart: arrival.ownMenu || arrival.pressedPlay }));
  const [playing, setPlaying] = useState(stageRun.autoStart);

  // How to play (issue #27): a short wizard over the game, only when the player asks for it (the info
  // button in the toolbar, or the game menu in full screen). Nothing pops up by itself: Play means play.
  // Until this device has opened it once, the info button glows. Sigilfall teaches itself throughout, so
  // a game with a section of its own has none.
  const hasHowTo = !game.section;
  const [howTo, setHowTo] = useState(false);
  const [howToNew, setHowToNew] = useState(() => hasHowTo && !game.ownTutorial && !howToSeen(game.slug));
  const startPlay = useRef<(() => void) | null>(null);
  const openHowTo = (): void => {
    setPauseSignal((n) => n + 1);
    setHowTo(true);
    setHowToNew(false);
    stageRef.current?.scrollIntoView?.({ block: 'nearest' });
  };
  const closeHowTo = (): void => {
    markHowToSeen(game.slug);
    setHowTo(false);
  };
  const [last, setLast] = useState<LastRound | null>(null);
  const [burst, setBurst] = useState(0);
  // The round the stage plays. Before Play it follows the challenge; a running game keeps its round
  // (a rematch shows "Play round N" in the dock instead of yanking the game away).
  const liveSpec = challengeSpecOf(chal.state);
  const [stageSpec, setStageSpec] = useState(liveSpec);
  if (stageSpec !== liveSpec && liveSpec && (!playing || !stageSpec)) {
    setStageSpec(liveSpec);
    // Play was pressed before the challenge loaded: restart the game straight in the challenge round.
    if (playing) setStageRun((r) => ({ key: r.key + 1, autoStart: true }));
  }
  // When your score is in and the game still shows its own last result or reveal, the scoreboard
  // waits as a chip on the stage (the game's "See the scoreboard" or the chip opens it). A new round
  // keeps an open scoreboard while the stage shows the last one: its "Play round N" is the way on.
  const chalStatus = chal.state.status;
  const [lastStatus, setLastStatus] = useState(chalStatus);
  const [scoresChip, setScoresChip] = useState(false);
  if (lastStatus !== chalStatus) {
    setLastStatus(chalStatus);
    const next = scoreboardOnStatus(chalStatus, { open: scoresOpen, playing, stageOld: playing && !!stageSpec && !!liveSpec && stageSpec.round !== liveSpec.round });
    setScoresOpen(next.open);
    setScoresChip(next.chip);
  }
  if (scoresChip && scoresOpen) setScoresChip(false);
  const stageSpecRef = useRef(stageSpec);
  useLayoutEffect(() => {
    stageSpecRef.current = stageSpec;
  }, [stageSpec]);
  const playRound = (): void => {
    setStageSpec(liveSpec);
    setScoresOpen(false);
    setScoresChip(false);
    setStageRun((r) => ({ key: r.key + 1, autoStart: true }));
  };

  const [shareMsg, setShareMsg] = useState('');
  // Most scores are points; a game can name its own (Gut Check counts answers in a row).
  const scoreUnit = game.stats.find((s) => s.key === 'score')?.unit;
  const live = useLiveCatalog();
  const related = relatedGames(game, 4, live.games);
  const todayKey = dayKey();
  const todayChallenge = challengeForDay(todayKey, GAMES);
  const isDailyGame = todayChallenge?.game.slug === game.slug;
  const { list: flagships, theme } = useFlagships();
  const { me } = useAccount();
  const settings = live.settings(game.slug);
  // An admin paused the game: players see the message instead of the stage (admins and QA can still test it).
  const paused = !!settings.maintenance && !me?.role;
  const runRef = useRef<Promise<string | null> | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  usePageMeta({ title: `Play ${game.title}`, description: `${game.tagline} Free to play in your browser on GlitchBound.`, path: gamePath(game), image: `/games/${game.slug}/og.jpg` });

  useEffect(() => {
    track('game_view', { game: game.slug });
  }, [game.slug]);

  // Arrived from a banner's Play: the game is already starting; it goes full screen as the poster's Play
  // takes it, while the tap that brought the player here still counts (a link opened in a new tab just plays
  // in the page). The address loses `play`, so a refresh or a shared link shows the poster again.
  const enterPlay = useRef(play.enter);
  useEffect(() => {
    enterPlay.current = play.enter;
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    // An old address (/games/wait-what) shows the game's own one (/games/quizbelief), so it is what gets shared.
    const own = game.section ? null : gameUrl(game.slug);
    if (url.searchParams.has('play') || (own && url.pathname !== own)) {
      url.searchParams.delete('play');
      if (own) url.pathname = own;
      window.history.replaceState(window.history.state, '', url);
    }
    if (!arrival.pressedPlay) return;
    const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
    if (!activation || activation.isActive) enterPlay.current();
  }, [arrival, game.section, game.slug]);

  useEffect(() => {
    const el = stageRef.current;
    if (!playing || !el || typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return;
    // (a touch's pointerup is a gesture full screen may be asked from; its pointerdown is not)
    const onUp = (e: PointerEvent): void => {
      // (taps in the game menu or a dialog over the game are the player's own choices, never a way back in)
      if (e.pointerType === 'mouse' || keptInPage.current || (e.target instanceof Element && e.target.closest('.stage-menu-backdrop, [role="dialog"]'))) return;
      if (play.active) play.retryFullscreen();
      else play.enter();
    };
    el.addEventListener('pointerup', onUp, true);
    return () => el.removeEventListener('pointerup', onUp, true);
  });

  // The lobby music steps aside while a game is loaded on this page.
  useEffect(() => {
    music.setGameActive(playing);
    return () => music.setGameActive(false);
  }, [playing]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      const signedIn = !!account.state.me;
      if (e.type === 'ready') {
        // Coins from GlitchBound (QA or an admin) for an embedded game's wallet: handed over once it listens.
        if (signedIn && game.wallet) void import('../platform/coins').then((m) => m.handOver(game, frameRef.current));
        return;
      }
      if (e.type === 'start') {
        track('game_start', { game: game.slug });
        // A friends' challenge round: the server times its score from the first start.
        if (stageSpecRef.current) beginChallenge.current();
        // Members: the server timestamps the start so the finished score can be checked. A round resumed
        // after a reload reports start again and keeps the run its first start opened.
        const kept = signedIn && !runRef.current ? keptRun(game.slug) : null;
        runRef.current = !signedIn
          ? null
          : kept
            ? Promise.resolve(kept)
            : api<{ runId: string }>('/api/runs/start', { body: { game: game.slug } })
                .then((r) => {
                  keepRun(game.slug, r.runId);
                  return r.runId;
                })
                .catch(() => null);
        return;
      }
      // the game's menu button is handled by the stage; it is never a round
      if (e.type === 'menu') return;
      // A friends' challenge round: send the score to the challenge too. Embedded games (NEON RUSH)
      // only know the seed, so the page names the round for them.
      const round = stageSpecRef.current;
      const ended = !e.challenge && round && game.runtime.kind === 'embed' ? { ...e, challenge: { id: round.id, round: round.round } } : e;
      if (ended.challenge) finishChallenge.current(ended);
      const result = saveStore.record(game, e);
      // A round resumed after a reload that didn't report start again still ends the run it opened.
      const kept = signedIn && !runRef.current ? keptRun(game.slug) : null;
      const pending = runRef.current ?? (kept ? Promise.resolve(kept) : null);
      runRef.current = null;
      keepRun(game.slug, null);
      const noRun = { ok: false, error: 'no_run' } as RunEndResult;
      let n = 0;
      setLast((prev) => {
        n = (prev?.n ?? 0) + 1;
        return { event: e, result, n, server: signedIn ? (pending ? undefined : ended.challenge ? null : noRun) : null };
      });
      if (pending) {
        void pending.then(async (runId) => {
          if (!runId) {
            setLast((prev) => (prev && prev.n === n ? { ...prev, server: noRun } : prev));
            return;
          }
          try {
            const day = dayKey();
            const server = await api<RunEndResult>('/api/runs/end', { body: { runId, score: e.score, stats: e.stats ?? {}, day, daily: !!e.daily, challenge: !!ended.challenge } });
            account.setQuests(server.quests);
            // the streak counts the server's record: a cleared challenge it just stored counts now
            if (server.dailyCompleted) account.addDailyDay(day);
            setLast((prev) => (prev && prev.n === n ? { ...prev, server } : prev));
            setBoardKey((k) => k + 1);
            if (server.newBest) setBurst((b) => b + 1);
          } catch (err) {
            // A round the server refuses (too short, implausible score) comes back as a 422 with the reason.
            const server = err instanceof ApiError && err.status === 422 ? ({ ok: false, error: err.code } as RunEndResult) : null;
            setLast((prev) => (prev && prev.n === n ? { ...prev, server } : prev));
          }
        });
      }
      // A game's own daily also carries its (local) day, so today's players can be compared (DailyCompare).
      track('game_end', e.daily ? { game: game.slug, score: e.score, daily: true, dday: dayKey() } : { game: game.slug, score: e.score });
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
    const url = kind === 'challenge' ? `${SITE_URL}${gamePath(game)}?beat=${score}` : `${SITE_URL}${gamePath(game)}`;
    const text =
      kind === 'game'
        ? `${game.title}: ${tGame(game.tagline)}`
        : kind === 'score'
          ? t('I scored {score} in {game} on GlitchBound.', { score: fmt(score), game: game.title })
          : t('I scored {score} in {game}. Can you beat it?', { score: fmt(score), game: game.title });
    const outcome = await shareOrCopy({ title: game.title, text, url });
    flashShare(outcome === 'copied' ? t('Link copied to your clipboard.') : outcome === 'shared' ? t('Shared!') : outcome === 'failed' ? t('Could not share from this browser.') : '');
  };
  const flashShare = (msg: string): void => {
    setShareMsg(msg);
    window.setTimeout(() => setShareMsg(''), 4000);
  };

  /**
   * After a round: a real friends' challenge (a fresh round for everyone, played right here) and its
   * invite sheet. In an open challenge it invites to that one; games without challenges keep the
   * old ?beat=<score> link.
   */
  const [challenging, setChallenging] = useState(false);
  const challengeFriend = async (): Promise<void> => {
    if (!game.challenge) return share('challenge');
    const view = 'view' in chal.state ? chal.state.view : undefined;
    if (challengeId && view && !view.closed) {
      track('share_click', { game: game.slug, what: 'challenge_invite' });
      return inviteToChallenge(game, view, t);
    }
    track('share_click', { game: game.slug, what: 'challenge_new' });
    setChallenging(true);
    const err = await startChallenge(game, 'fresh', player.name, t);
    setChallenging(false);
    if (err) flashShare(err);
  };

  // After a round: where to go next, so one game leads to another (today's challenge first).
  const next = last
    ? nextStep({
        game,
        games: live.games.filter((g) => !live.settings(g.slug).maintenance),
        daily: todayChallenge ? { game: todayChallenge.game, done: save.daily[todayKey]?.done ?? false } : null,
        flagships: flagships.map((f) => f.game),
        played: new Set(recentSlugs(save)),
        theme,
      })
    : null;

  return (
    <div className="game-page" data-accent={game.accent} data-world={game.section ? game.slug : undefined}>
      <div className="wrap game-toolbar">
        {/* A party-only game (Crass Act) is reached from Party Mode, so that is the way back. */}
        <Link href={game.partyOnly ? '/party' : '/#arcade'} className="btn btn-sm btn-ghost back-link" aria-label={t(game.partyOnly ? 'Back to Party Mode' : 'Back to the arcade')}>
          <Icon name="arrowLeft" size={18} /> <span className="hide-sm">{t(game.partyOnly ? 'Party' : 'Arcade')}</span>
        </Link>
        <div className="game-heading">
          <h1>{game.title}</h1>
          {/* a game with its own section isn't filed under an arcade category */}
          {!game.section && <span className="chip">{t(CATEGORIES[game.categories[0]].label)}</span>}
          {game.adult && <AdultLabel text={t('Adults only')} />}
          <LiveBadge game={game} />
        </div>
        <div className={`game-actions${playing ? ' is-playing' : ''}`}>
          <FavoriteButton slug={game.slug} title={game.title} />
          {hasHowTo && (
            <button className={`btn btn-sm btn-icon game-info-btn${howToNew ? ' is-new' : ''}`} onClick={openHowTo} aria-label={t('How to play')} title={t('How to play')}>
              <Icon name="info" size={18} />
            </button>
          )}
          {/* a restart remounts the game, which would drop a party-only game's player out of their live room */}
          {playing && !game.partyOnly && (
            <button className="btn btn-sm" onClick={restart} title={t('Reload the game')}>
              <Icon name="restart" size={18} /> <span className="hide-sm">{t('Restart')}</span>
            </button>
          )}
          {playing && (
            <button className="btn btn-sm btn-icon" onClick={goFull} aria-label={t('Fullscreen')} title={t('Fullscreen')}>
              <Icon name="expand" size={18} />
            </button>
          )}
          {playing && (
            <button className="btn btn-sm" onClick={close} title={t('Close the game and free its memory')}>
              <Icon name="close" size={18} /> <span className="hide-sm">{t('Exit game')}</span>
            </button>
          )}
          <button className="btn btn-sm btn-icon share-btn" onClick={() => void share('game')} aria-label={t('Share {game}', { game: game.title })} title={t('Share')}>
            <Icon name="share" size={18} />
          </button>
        </div>
      </div>

      <div className="wrap game-layout">
        <div className="game-stage-col">
          {me?.role && (settings.hidden || settings.maintenance) && (
            <p className="admin-preview" role="note">
              <Icon name="crown" size={16} /> Preview: {settings.hidden ? 'this game is hidden from players.' : `players see "${settings.maintenance}" instead of the game.`}{' '}
              {me.isAdmin && <Link href="/admin?tab=games">Edit in Admin</Link>}
            </p>
          )}
          {challengeId && (
            <Suspense fallback={null}>
              <ChallengeDock run={chal} game={game} stageRound={playing ? (stageSpec?.round ?? null) : null} onPlayRound={playRound} onScores={() => setScoresOpen((o) => !o)} scoresOpen={scoresOpen} />
            </Suspense>
          )}
          {paused ? (
            <div className="stage stage-paused" style={{ background: game.art.bg }}>
              <img src={game.art.tile} alt="" className="stage-poster-art" />
              <div className="stage-paused-msg">
                <strong>{t('Taking a short break')}</strong>
                <span>{settings.maintenance}</span>
                <Link href="/" className="btn btn-primary">
                  {t('Play something else')}
                </Link>
              </div>
            </div>
          ) : (
          <GameStage
            key={stageRun.key}
            autoStart={stageRun.autoStart}
            pauseSignal={pauseSignal}
            game={game}
            challenge={stageSpec}
            onEvent={onEvent}
            stageRef={stageRef}
            frameRef={frameRef}
            playerName={player.name}
            onPlayClick={goFull}
            openMenu={play.active && (game.menu ?? 'own') === 'own' ? openMenu : undefined}
            playRef={startPlay}
            overlay={
              <>
                {howTo && <HowTo game={game} onClose={closeHowTo} onPlay={() => startPlay.current?.()} />}
                {challengeId && !playing && !howTo && (
                  <Suspense fallback={null}>
                    <ChallengeIntro run={chal} game={game} onPlay={() => startPlay.current?.()} onHowTo={hasHowTo ? openHowTo : undefined} />
                  </Suspense>
                )}
                {challengeId && scoresOpen && (
                  <Suspense fallback={null}>
                    <ChallengeScores run={chal} game={game} onClose={() => setScoresOpen(false)} stageRound={playing ? (stageSpec?.round ?? null) : null} onPlayRound={playRound} />
                  </Suspense>
                )}
                {challengeId && scoresChip && !scoresOpen && chal.state.status === 'sent' && (
                  <Suspense fallback={null}>
                    <ChallengeScoresChip score={chal.state.score} onOpen={() => setScoresOpen(true)} onDismiss={() => setScoresChip(false)} />
                  </Suspense>
                )}
                {play.immersive && <SafariBarsHandle />}
                {play.active && <StageMenu slug={game.slug} title={game.title} placement={game.menu} open={menuOpen} setOpen={setMenuOpen} onOpen={() => setPauseSignal((n) => n + 1)} onExitFullscreen={stayInPage} onExitGame={close} onHowTo={hasHowTo ? openHowTo : undefined} />}
              </>
            }
            onPhase={(p) => {
              setPlaying(p === 'loading' || p === 'ready');
              if (p === 'error') {
                track('game_error', { game: game.slug });
                reportError('game_load_failed', `${game.title} did not load`, game.slug);
              }
            }}
          />
          )}
          {burst > 0 && <Burst key={burst} />}
        </div>

        <aside className="game-side" aria-label={t('{game} details', { game: game.title })}>
          <p className="game-share-msg" role="status">
            {shareMsg}
          </p>

          {beat !== null && (
            <div className={`panel friend ${last && last.event.score > beat ? 'is-beaten' : ''}`}>
              <p className="eyebrow">{t('Friend challenge')}</p>
              {last && last.event.score > beat ? (
                <p className="friend-text">{t('You beat {a} with {b}. Send it back!', { a: fmt(beat), b: fmt(last.event.score) })}</p>
              ) : (
                <p className="friend-text">{t('A friend scored {n}. Beat it.', { n: fmt(beat) })}</p>
              )}
            </div>
          )}

          {last && (
            <div key={last.n} className="panel last-round">
              <p className="eyebrow">{t('Last round')}</p>
              <p className="last-score">
                {fmt(last.event.score)} <span>{scoreUnit ? t(scoreUnit) : t('points')}</span>
              </p>
              <ul className="last-tags">
                {last.server?.rank && (
                  <li className="sticker" data-tone="cyan">
                    {t('Rank #{n}', { n: last.server.rank })}
                  </li>
                )}
                {/* a round the server refused gets no record badges */}
                {!(last.server && !last.server.ok) && last.result.newBests.some((k) => k === 'score' || game.stats.find((s) => s.key === k)?.of === 'score') && <li className="sticker" data-tone="lime">{t('New best')}</li>}
                {!(last.server && !last.server.ok) && last.result.firstPlay && <li className="sticker">{t('First record')}</li>}
                {last.result.dailyCompleted && <li className="sticker" data-tone="orange">{t('Daily cleared')}</li>}
                {last.result.gameDailyCompleted && <li className="sticker" data-tone="orange">{t('{label} done', { label: t(game.ownDaily?.label ?? 'Daily') })}</li>}
              </ul>
              {last.event.daily && (
                <Suspense fallback={null}>
                  <DailyCompare game={game.slug} day={dayKey()} score={last.event.score} />
                </Suspense>
              )}
              {!me && (
                <button className="last-signin" onClick={() => openSignIn(t('Sign in to put your scores on the leaderboard.'))}>
                  <Icon name="crown" size={16} /> {t('Sign in to put scores like this on the leaderboard')}
                </button>
              )}
              {me && last.server === undefined && <p className="mono last-saving">{t('Saving to the leaderboard…')}</p>}
              {me && last.server && !last.server.ok && <p className="mono last-saving">{t('This round was not ranked ({reason}).', { reason: t(NOT_RANKED[last.server.error ?? ''] ?? 'score too high for the time played') })}</p>}
              {/* a judged party game has no score to beat or brag about, and its rounds are played in a room */}
              {!game.partyOnly && (
                <div className="last-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => void challengeFriend()} disabled={challenging}>
                    <Icon name={game.challenge ? 'bolt' : 'link'} size={18} /> {t('Challenge a friend')}
                  </button>
                  <button className="btn btn-sm" onClick={() => void share('score')}>
                    <Icon name="share" size={18} /> {t('Share score')}
                  </button>
                </div>
              )}
              {next && !(game.partyOnly && next.kind === 'again') && (
                <div className="next-up">
                  <p className="eyebrow">{t('Next up')}</p>
                  {next.kind === 'again' ? (
                    <button className="btn btn-sm btn-ink" onClick={restart}>
                      <Icon name="restart" size={18} /> {next.daily ? t('One more try at today’s challenge') : t('Play again')}
                    </button>
                  ) : (
                    <Link href={gameUrl(next.game.slug)} className="next-up-link" data-accent={next.game.accent} onClick={() => track('next_up', { from: game.slug, to: next.game.slug, why: next.kind })}>
                      <img src={next.game.art.tile} alt="" width={48} height={48} style={{ background: next.game.art.bg }} />
                      <span className="next-up-text">
                        <strong>{next.game.title}</strong>
                        <span>
                          {next.kind === 'daily'
                            ? t('Today’s challenge is waiting')
                            : next.kind === 'flagship'
                              ? t('One of our best, and new to you')
                              : next.kind === 'theme'
                                ? t('{theme} pick', { theme: t(next.theme.name) })
                                : t('More like {game}', { game: game.title })}
                        </span>
                      </span>
                      <Icon name="play" size={20} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {game.challenge && !challengeId && <ChallengeFriends game={game} />}

          {isDailyGame && <DailyCard variant="compact" headingLevel={2} />}

          <GameInfo game={game} record={record} boardKey={boardKey} />

          <div className="player-line">
            <span className="mono">{t('Playing as')}</span>
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
                <input className="field" name="name" defaultValue={player.name} maxLength={14} aria-label={t('Player name')} autoFocus />
                <button className="btn btn-primary btn-sm">{t('Save')}</button>
              </form>
            ) : (
              <>
                <strong>{player.name}</strong>
                {player.member ? (
                  <Link href="/me" className="link-btn">
                    {t('Change')}
                  </Link>
                ) : (
                  <button className="link-btn" onClick={() => setRenaming(true)}>
                    {t('Change')}
                  </button>
                )}
                {!player.member && (
                  <button className="link-btn player-keep" onClick={() => openSignIn(t('Sign in to keep your name and scores on every device.'))}>
                    {t('Sign in to keep it on every device.')}
                  </button>
                )}
              </>
            )}
            {renameMsg && <p className="side-muted">{renameMsg}</p>}
          </div>

          <div className="game-help">
            <button className="game-help-btn" onClick={() => openFeedback(game.slug)}>
              <Icon name="star" size={16} /> {t('Rate this game')}
            </button>
            <Link href={`/me/bugs?game=${game.slug}`} className="game-help-btn">
              <Icon name="bug" size={16} /> {t('Report a bug')}
            </Link>
          </div>

          <AdSlot placement="game" />
        </aside>
      </div>

      <section className="wrap game-about" aria-labelledby="about-title">
        <div className="game-about-copy">
          <p className="eyebrow">{t('About the game')}</p>
          <h2 id="about-title">{game.title}</h2>
          <p>{tGame(game.description)}</p>
        </div>
        {game.highlights && (
          <ul className="latest-list game-highlights">
            {game.highlights.map((h) => (
              <li key={h}>{tGame(h)}</li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="wrap section" aria-labelledby="related-title">
          <div className="section-head">
            <h2 id="related-title">{t('Play next')}</h2>
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

type InfoTab = 'board' | 'bests';

/**
 * The leaderboard and your bests share one panel with tabs, so the column next to the game stays short.
 * How to play is a wizard over the game (components/HowTo.tsx), not text here (issue #27).
 */
function GameInfo({ game, record, boardKey }: { game: GameEntry; record: GameRecord | undefined; boardKey: number }) {
  const t = useT();
  const [tab, setTab] = useState<InfoTab>('board');
  const tabs: { id: InfoTab; icon: 'crown' | 'trophy'; label: string }[] = [
    { id: 'board', icon: 'crown', label: t('Leaderboard') },
    { id: 'bests', icon: 'trophy', label: t('Your bests') },
  ];
  return (
    <section className="panel side-block game-info" aria-labelledby={`gi-${tab}`}>
      <div className="gi-tabs" role="tablist" aria-label={t('{game} details', { game: game.title })}>
        {tabs.map((x) => (
          <button key={x.id} id={`gi-${x.id}`} role="tab" aria-selected={tab === x.id} aria-controls={`gi-panel-${x.id}`} className={`gi-tab${tab === x.id ? ' is-on' : ''}`} onClick={() => setTab(x.id)}>
            <Icon name={x.icon} size={16} /> {x.label}
          </button>
        ))}
      </div>
      {/* Both panels share one spot, so the box is as tall as the taller one and switching tabs moves nothing under it. */}
      <div className="gi-panels">
        <div id="gi-panel-board" role="tabpanel" aria-labelledby="gi-board" aria-hidden={tab !== 'board'} inert={tab !== 'board'} className={`gi-panel${tab === 'board' ? ' is-on' : ''}`}>
          {/* If the board's code can't load (offline), only this tab says so: the game keeps running. */}
          <ErrorBoundary fallback={() => <p className="side-muted">{t('The leaderboard is offline right now. Your game still works.')}</p>}>
            <Suspense fallback={<p className="side-muted">{t('Loading…')}</p>}>
              <MiniLeaderboard game={game} refreshKey={boardKey} embedded />
            </Suspense>
          </ErrorBoundary>
        </div>
        <div id="gi-panel-bests" role="tabpanel" aria-labelledby="gi-bests" aria-hidden={tab !== 'bests'} inert={tab !== 'bests'} className={`gi-panel${tab === 'bests' ? ' is-on' : ''}`}>
          {record ? (
            <dl className="bests">
              {game.stats.map((st) => (
                <div key={st.key}>
                  <dt>{t(st.label)}</dt>
                  <dd className="mono">
                    {record.best[st.key] !== undefined ? fmt(record.best[st.key]!) : '–'}
                    {st.unit && record.best[st.key] !== undefined ? ` ${t(st.unit)}` : ''}
                  </dd>
                </div>
              ))}
              <div>
                <dt>{t('Rounds played here')}</dt>
                <dd className="mono">{fmt(record.plays)}</dd>
              </div>
            </dl>
          ) : (
            <p className="side-muted">{t('Finish a round to set your first record. Bests are saved on this device only.')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
