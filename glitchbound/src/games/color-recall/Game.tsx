import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, msUntilMidnight, parseDayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { feedback, hexToRgb, hsbToRgb, inkOn, MAX_POINTS, rgbToHex, rgbToHsb, verdictFor, verdictText, type Hsb, type Rgb } from './color';
import { Glyph } from './Glyph';
import {
  DAILY_DIFFICULTY,
  dailyNumber,
  dailyRounds,
  endStats,
  MAX_SCORE,
  newGame,
  PEEK_MS,
  practiceRounds,
  reduce,
  rng,
  resultLine,
  resultTarget,
  ROUNDS,
  shareText,
  totalScore,
  type Difficulty,
  pickRounds,
  type GameState,
  type RoundResult,
  type RoundSpec,
} from './logic';
import { createSfx, type Sfx } from './sound';
import { crStats, isComplete, latestCr, loadCr, markDailySeen, markRunSeen, recordColor, recordPracticeGame, runKey, seenDailyRound, STORE_KEY, updateCr, type CrSave } from './store';
import { ACTIVE_TARGETS } from './targets';
import type { ChallengeSpec } from '../../platform/challenge';
import { useAccount } from '../../platform/account';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: 'easy', label: 'Easy', note: '5 s peek' },
  { id: 'normal', label: 'Normal', note: '3 s peek' },
  { id: 'hard', label: 'Hard', note: '1.2 s peek' },
  { id: 'memory', label: 'Recall', note: 'No peek' },
];
const isDifficulty = (v: string): v is Difficulty => v in PEEK_MS;

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  // Restart = a fresh mount: back to the menu, all timers and sounds released (a challenge round resumes from the save).
  return <ColorRecall key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

type Screen = 'menu' | 'play' | 'stats';

/** Where the game in play is saved: the daily it counts as (if any) and its challenge round (if any). */
interface Track {
  day: string | null;
  run: string | null;
}
const NO_TRACK: Track = { day: null, run: null };

/** The saved progress of a tracked game: its results so far and the last color already shown. */
function progress(s: CrSave, t: Track): { results: RoundResult[]; seen: number } {
  const run = t.run ? s.runs[t.run] : undefined;
  const daily = t.day ? s.daily[t.day] : undefined;
  const results = (daily?.length ?? 0) >= (run?.results.length ?? 0) ? daily ?? [] : run!.results;
  return { results, seen: Math.max(run?.seen ?? -1, t.day ? seenDailyRound(s, t.day) : -1) };
}

/** Builds a tracked game from the save: resumes at the next color, with no second look at one already shown. */
function resumeGame(s: CrSave, mode: GameState['mode'], rounds: RoundSpec[], t: Track): GameState {
  const p = progress(s, t);
  const g = newGame(mode, rounds, PEEK_MS[DAILY_DIFFICULTY], p.results);
  return g.phase === 'peek' && p.seen >= g.index ? { ...g, phase: 'guess' } : g;
}

/** A friends' challenge round: "Today's daily" plays that day's daily, a fresh round its own seed. */
function challengeSetup(challenge: ChallengeSpec): { rounds: RoundSpec[]; track: Track } {
  const day = challenge.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(challenge.day) ? challenge.day : null;
  return { rounds: day ? dailyRounds(day) : practiceRounds(rng(challenge.seed)), track: { day, run: runKey(challenge) } };
}

function ColorRecall({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today, setToday] = useState(() => dayKey());
  // Everything a challenge round needs at mount, read from the save once.
  const [init] = useState(() => {
    const s = loadCr();
    const setup = challenge ? challengeSetup(challenge) : null;
    return {
      save: s,
      setup,
      // A friends' challenge starts straight away (and resumes where it was after a reload or Restart).
      game: setup ? resumeGame(s, 'challenge', setup.rounds, setup.track) : null,
      // A "Today's daily" challenge whose daily was already finished: that result is the challenge score.
      dailyCounts: !!setup?.track.day && isComplete(s.daily[setup.track.day]) && !isComplete(s.runs[setup.track.run!]?.results),
    };
  });
  const { setup, dailyCounts } = init;
  const [save, setSave] = useState<CrSave>(init.save);
  const saveRef = useRef(save);
  const [track, setTrack] = useState<Track>(() => setup?.track ?? NO_TRACK);
  const trackRef = useRef(track);
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  const [game, setGame] = useState<GameState | null>(init.game);
  const gameRef = useRef(game);
  useEffect(() => {
    trackRef.current = track;
    gameRef.current = game;
  }, [track, game]);
  const rootRef = useRef<HTMLDivElement>(null);
  // Each new screen and color (and its reveal) starts at the top of the (scrollable) stage.
  const view = `${screen}:${game?.mode ?? ''}:${game?.index ?? ''}:${game?.phase ?? ''}`;
  useEffect(() => {
    rootRef.current?.scrollTo?.({ top: 0 });
  }, [view]);
  /** Read-modify-write: the change applies to the latest stored save, so another tab's progress is kept. */
  const commit = useCallback((change: (s: CrSave) => CrSave) => {
    const next = updateCr(saveRef.current, change, dayKey());
    saveRef.current = next;
    setSave(next);
  }, []);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current || !challenge || !setup) return;
    mounted.current = true;
    const s = saveRef.current;
    if (dailyCounts) {
      const results = s.daily[setup.track.day!]!;
      host.report({ type: 'start' });
      reportEnd(host, results, false, challenge);
      commit((x) => ({ ...x, runs: { ...x.runs, [setup.track.run!]: { results, seen: ROUNDS - 1 } } }));
    } else if (!isComplete(progress(s, setup.track).results)) host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Picks up what another tab saved. */
  const refresh = useCallback((): CrSave => {
    const next = latestCr(saveRef.current);
    saveRef.current = next;
    setSave(next);
    return next;
  }, []);

  // The day moves on at midnight: re-read it while the menu shows, when the tab comes back, and at every start.
  useEffect(() => {
    if (screen !== 'menu') return;
    const t = window.setInterval(() => setToday(dayKey()), 1000);
    return () => window.clearInterval(t);
  }, [screen]);

  // Another tab saved: refresh, and leave (or rebuild) a play screen that is now behind.
  const syncFromOtherTab = useCallback(() => {
    const s = refresh();
    setToday(dayKey());
    const g = gameRef.current;
    const t = trackRef.current;
    if (!g || (!t.day && !t.run)) return;
    if (progress(s, t).results.length <= g.results.length) return;
    if (g.mode === 'challenge' && setup) setGame(resumeGame(s, 'challenge', setup.rounds, t));
    else {
      setGame(null);
      setScreen('menu');
    }
  }, [refresh, setup]);
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === STORE_KEY || e.key === null) syncFromOtherTab();
    };
    const onBack = (): void => {
      if (document.visibilityState === 'visible') syncFromOtherTab();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, [syncFromOtherTab]);

  // Sounds are created on first use (always inside a tap) and released on unmount.
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  const difficulty: Difficulty = isDifficulty(save.difficulty) ? save.difficulty : 'normal';
  const todays = save.daily[today];

  const startDaily = (): void => {
    const day = dayKey();
    setToday(day);
    const s = refresh();
    const t: Track = { day, run: null };
    const g = resumeGame(s, 'daily', dailyRounds(day), t);
    setTrack(t);
    setGame(g);
    setScreen('play');
    if (!isComplete(s.daily[day])) host.report({ type: 'start' });
  };
  const startPractice = (): void => {
    setToday(dayKey());
    setTrack(NO_TRACK);
    // Recall (no peek) shows only the name and shape, so it uses curated colors only: a wild card has no name to recall.
    setGame(newGame('practice', difficulty === 'memory' ? pickRounds(Math.random, ROUNDS, ACTIVE_TARGETS) : practiceRounds(Math.random, ACTIVE_TARGETS), PEEK_MS[difficulty]));
    setScreen('play');
    host.report({ type: 'start' });
  };

  // Remember each tracked color as soon as it is actually shown, so leaving and resuming can't show it again.
  const onShown = useCallback(
    (index: number) => {
      const { day, run } = track;
      if (day) commit((s) => markDailySeen(s, day, index));
      if (run) commit((s) => markRunSeen(s, run, index));
    },
    [commit, track],
  );

  const onHide = useCallback(() => setGame((g) => (g ? reduce(g, { type: 'hide' }) : g)), []);
  const onNext = useCallback(() => {
    sfx().tick();
    setGame((g) => (g ? reduce(g, { type: 'next' }) : g));
  }, [sfx]);

  const onSubmit = (guess: Rgb): void => {
    if (!game || game.phase !== 'guess') return;
    // Another tab already locked in this color: don't record it twice, catch up instead.
    if ((track.day || track.run) && progress(refresh(), track).results.length !== game.results.length) {
      syncFromOtherTab();
      return;
    }
    const next = reduce(game, { type: 'submit', guess });
    const result = next.results[next.results.length - 1]!;
    setGame(next);
    sfx().reveal(result.points);
    if (result.points >= 900) navigator.vibrate?.(30);
    const finished = next.results.length >= next.rounds.length;
    // A daily counts for the arcade's daily only on its own day (a round started before midnight finishes as yesterday's).
    const countsAsToday = !!track.day && track.day === dayKey() && !isComplete(saveRef.current.daily[track.day]);
    const end = finished ? reportEnd(host, next.results, countsAsToday, game.mode === 'challenge' ? challenge : undefined) : null;
    commit((s) => {
      const x = recordColor(s, result, track.day, track.run);
      return end && game.mode === 'practice' ? recordPracticeGame(x, end.score) : x;
    });
  };

  const unfinishedChallenge = game?.mode === 'challenge' && game.phase !== 'done';
  return (
    <div className="cr" data-screen={screen} ref={rootRef}>
      {screen === 'menu' && (
        <Menu
          today={today}
          todays={todays}
          save={save}
          difficulty={difficulty}
          onDifficulty={(d) => commit((s) => ({ ...s, difficulty: d }))}
          onDaily={startDaily}
          onPractice={startPractice}
          onStats={() => setScreen('stats')}
          onMute={() => commit((s) => ({ ...s, muted: !s.muted }))}
        />
      )}
      {screen === 'stats' && <Stats save={save} today={today} onBack={() => setScreen('menu')} />}
      {screen === 'play' && game && (
        <Play
          game={game}
          day={track.day ?? today}
          today={today}
          save={save}
          seenUpTo={progress(save, track).seen}
          pauseKey={pauseKey}
          onShown={onShown}
          onHide={onHide}
          onSubmit={onSubmit}
          onNext={onNext}
          onSliders={(m) => commit((s) => ({ ...s, sliders: m }))}
          onMute={() => commit((s) => ({ ...s, muted: !s.muted }))}
          onMenu={
            unfinishedChallenge
              ? undefined
              : () => {
                  setGame(null);
                  setScreen('menu');
                }
          }
          onAgain={startPractice}
          challengeId={challenge?.id}
          dailyCounts={dailyCounts}
        />
      )}
    </div>
  );
}

/**
 * The one place a finished 5-color game is reported to the arcade. `isDaily` marks the arcade's
 * own daily for today (never practice, never a daily finished after its day).
 */
function reportEnd(host: GameHost, results: RoundResult[], isDaily: boolean, challenge?: ChallengeSpec): ReturnType<typeof endStats> {
  const end = endStats(results);
  host.report({ type: 'end', ...end, ...(isDaily ? { daily: true } : {}), ...(challenge ? { challenge: { id: challenge.id, round: challenge.round } } : {}) });
  return end;
}

/* ------------------------------------------------------------------ menu */

function Wordmark() {
  const letters = 'COLOR'.split('');
  const colors = ['#ff5a6c', '#ffb020', '#12c6b3', '#3d5bff', '#a45cff'];
  return (
    <h1 className="cr-wordmark" aria-label="Color Recall">
      <span className="cr-wordmark-chips" aria-hidden="true">
        {letters.map((l, i) => (
          <span key={i} style={{ background: colors[i], transform: `rotate(${[-6, 4, -3, 5, -4][i]}deg)` }}>
            {l}
          </span>
        ))}
      </span>
      <span className="cr-wordmark-sub" aria-hidden="true">
        Recall
      </span>
    </h1>
  );
}

function Countdown() {
  const [ms, setMs] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="cr-mono">{formatCountdown(ms)}</span>;
}

function Menu(props: {
  today: string;
  todays: RoundResult[] | undefined;
  save: CrSave;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onDaily: () => void;
  onPractice: () => void;
  onStats: () => void;
  onMute: () => void;
}) {
  const { today, todays, save } = props;
  const stats = crStats(save, today);
  const done = isComplete(todays);
  const started = !done && (todays?.length ?? 0) > 0;
  const date = parseDayKey(today).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="cr-menu">
      <div className="cr-menu-top">
        <MuteButton muted={save.muted} onClick={props.onMute} />
        {stats.streak > 0 && <span className="cr-chip cr-chip-fire">🔥 {stats.streak}-day streak</span>}
        <GameMenuButton className="cr-icon-btn" />
      </div>
      <Wordmark />
      <p className="cr-tagline">See a color. Hold it in your head. Mix it back.</p>

      <section className="cr-card cr-card-daily">
        <div className="cr-card-head">
          <span className="cr-kicker">Daily #{dailyNumber(today)}</span>
          <span className="cr-muted">{date}</span>
        </div>
        {done ? (
          <>
            <ResultStrip results={todays!} />
            <p className="cr-daily-score">
              <b>{fmt(totalScore(todays!))}</b> / {fmt(MAX_SCORE)}
            </p>
            <div className="cr-row">
              <ShareButton today={today} results={todays!} streak={stats.streak} />
              <button className="cr-btn cr-btn-ghost" onClick={props.onDaily}>
                Review
              </button>
            </div>
            <p className="cr-muted cr-small">
              Next daily in <Countdown />
            </p>
          </>
        ) : (
          <>
            <p className="cr-card-text">Five colors, the same for everyone today. You get one look at each.</p>
            <button className="cr-btn cr-btn-go" onClick={props.onDaily}>
              {started ? `Resume (${todays!.length}/${ROUNDS})` : 'Play today’s colors'}
            </button>
          </>
        )}
      </section>

      <section className="cr-card">
        <div className="cr-card-head">
          <span className="cr-kicker">Practice</span>
          <span className="cr-muted">Unlimited</span>
        </div>
        <div className="cr-seg" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} role="radio" aria-checked={props.difficulty === d.id} className="cr-seg-btn" onClick={() => props.onDifficulty(d.id)}>
              <b>{d.label}</b>
              <small>{d.note}</small>
            </button>
          ))}
        </div>
        <button className="cr-btn" onClick={props.onPractice}>
          Practice 5 colors
        </button>
      </section>

      <button className="cr-link" onClick={props.onStats}>
        Your stats →
      </button>
    </div>
  );
}

function MuteButton({ muted, onClick }: { muted: boolean; onClick: () => void }) {
  return (
    <button className="cr-icon-btn" onClick={onClick} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

function ResultStrip({ results }: { results: RoundResult[] }) {
  return (
    <ol className="cr-strip">
      {results.map((r, i) => {
        const t = resultTarget(r);
        return (
          <li key={i} title={`${t?.name ?? ''}: ${fmt(r.points)} points`}>
            <span className="cr-strip-pair">
              <i style={{ background: t?.hex }} />
              <i style={{ background: r.guess }} />
            </span>
            <b className={`cr-v-${verdictFor(r.points)}`}>{fmt(r.points)}</b>
          </li>
        );
      })}
    </ol>
  );
}

function ShareButton({ today, results, streak }: { today: string; results: RoundResult[]; streak: number }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  const share = async (): Promise<void> => {
    const url = `${window.location.origin}/games/color-recall`;
    const outcome = await shareOrCopy({ title: 'Color Recall', text: shareText(today, results, streak, url) });
    setMsg(outcome === 'copied' ? 'Copied!' : outcome === 'failed' ? 'Could not copy' : '');
  };
  return (
    <button className="cr-btn cr-btn-go" onClick={() => void share()}>
      {msg || 'Share result'}
    </button>
  );
}

/* ----------------------------------------------------------------- stats */

function Stats({ save, today, onBack }: { save: CrSave; today: string; onBack: () => void }) {
  const s = crStats(save, today);
  const signedIn = !!useAccount().me;
  const max = Math.max(1, ...s.histogram);
  const tiles: [string, string][] = [
    ['Dailies played', fmt(s.dailyPlayed)],
    ['Current streak', fmt(s.streak)],
    ['Best streak', fmt(s.bestStreak)],
    ['Best daily', s.bestDaily ? fmt(s.bestDaily) : '–'],
    ['Average daily', s.avgDaily ? fmt(s.avgDaily) : '–'],
    ['Practice games', fmt(s.practiceGames)],
    ['Best practice', s.practiceBest ? fmt(s.practiceBest) : '–'],
    ['Best single color', s.bestColor ? fmt(s.bestColor) : '–'],
    ['Perfect colors (980+)', fmt(s.perfects)],
  ];
  return (
    <div className="cr-stats">
      <div className="cr-top">
        <button className="cr-icon-btn" onClick={onBack} aria-label="Back to menu">
          ←
        </button>
        <h2>Your stats</h2>
        <GameMenuButton className="cr-icon-btn" />
      </div>
      <div className="cr-stat-grid">
        {tiles.map(([k, v]) => (
          <div key={k} className="cr-stat">
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <h3 className="cr-kicker">Daily scores</h3>
      <div className="cr-hist">
        {s.histogram.map((n, i) => (
          <div key={i} className="cr-hist-row">
            <span className="cr-mono">{i === 4 ? '4k+' : `${i}k`}</span>
            <span className="cr-hist-bar" style={{ width: `${Math.max(4, (n / max) * 100)}%` }}>
              {n}
            </span>
          </div>
        ))}
      </div>
      <p className="cr-muted cr-small">{signedIn ? 'Saved to your account.' : 'Saved on this device. Sign in to keep it on every device.'}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ play */

type SliderMode = 'hsb' | 'rgb';

interface Mix {
  hsb: Hsb;
  rgb: Rgb;
}

const mixFromHsb = (hsb: Hsb): Mix => ({ hsb, rgb: hsbToRgb(hsb) });

/** After a screen changes, Enter is ignored this long, so a quick double press can't skip ahead. */
const ENTER_GRACE_MS = 400;

/** True when a key press is meant for something else on the page (a field, a dialog, the site around the game). */
function notForGame(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  const el = e.target instanceof Element ? e.target : null;
  if (!el || el === document.body) return false;
  if (el.closest('[role=dialog],[aria-modal=true]')) return true;
  if (!el.closest('.cr')) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'BUTTON' || tag === 'A' || tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && (el as HTMLInputElement).type !== 'range');
}

function Play(props: {
  game: GameState;
  /** The day of the daily in play (or today). */
  day: string;
  today: string;
  save: CrSave;
  /** The last tracked color already shown (in this or another tab), or -1. */
  seenUpTo: number;
  pauseKey?: number;
  onShown: (index: number) => void;
  onHide: () => void;
  onSubmit: (guess: Rgb) => void;
  onNext: () => void;
  onSliders: (m: SliderMode) => void;
  onMute: () => void;
  /** Undefined while a challenge round is unfinished: it has one attempt, so there is no way out of it. */
  onMenu?: () => void;
  onAgain: () => void;
  challengeId?: string;
  dailyCounts?: boolean;
}) {
  const { game, onHide, onShown, seenUpTo } = props;
  const round = game.rounds[game.index];
  const [mix, setMix] = useState<Mix>(() => mixFromHsb(round ? round.start : { h: 0, s: 50, b: 50 }));
  const [roundIndex, setRoundIndex] = useState(game.index);
  // The peek: compared rounds (daily, challenge) wait for "Show color N" so the player is looking when
  // it starts; a pause hides the color and keeps the time left for when the player comes back.
  const gated = game.mode !== 'practice';
  const [peek, setPeek] = useState(() => ({ index: game.index, showing: !gated, left: game.peekMs, shownHere: !gated, since: 0 }));
  // New round: move the sliders to that round's (seeded) starting color, and reset the peek.
  if (roundIndex !== game.index) {
    setRoundIndex(game.index);
    if (round) setMix(mixFromHsb(round.start));
    setPeek({ index: game.index, showing: !gated, left: game.peekMs, shownHere: !gated, since: 0 });
  }
  const peeking = game.phase === 'peek';
  const showing = peeking && peek.index === game.index && peek.showing;

  // Another tab already showed this color: no second look here either.
  useEffect(() => {
    if (peeking && !peek.shownHere && gated && seenUpTo >= game.index) onHide();
  }, [peeking, peek.shownHere, gated, seenUpTo, game.index, onHide]);

  // Record the color as seen the moment it is on screen.
  useEffect(() => {
    if (showing) onShown(game.index);
  }, [showing, game.index, onShown]);

  // Show the target for the time left, then hide it.
  const startedAt = useRef(0);
  useEffect(() => {
    if (!showing) return;
    startedAt.current = performance.now();
    const t = window.setTimeout(onHide, peek.left);
    return () => window.clearTimeout(t);
  }, [showing, peek.left, onHide]);
  const show = useCallback(() => setPeek((p) => ({ ...p, showing: true, shownHere: true, since: p.since || performance.now() })), []);
  const pause = useCallback(() => {
    setPeek((p) => (p.showing ? { ...p, showing: false, left: Math.max(300, p.left - (performance.now() - startedAt.current)) } : p));
  }, []);
  // The arcade's menu or How to play opened (pauseKey), or the tab was hidden: stop the peek.
  const [pauseSeen, setPauseSeen] = useState(props.pauseKey);
  if (pauseSeen !== props.pauseKey) {
    setPauseSeen(props.pauseKey);
    if (showing) pause();
  }
  useEffect(() => {
    const onVis = (): void => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause]);

  // A seconds-left count for the peek (the only timer cue with reduced motion).
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!showing) return;
    const t0 = performance.now();
    const tick = (): void => setSecs(Math.max(1, Math.ceil((peek.left - (performance.now() - t0)) / 1000)));
    tick();
    const t = window.setInterval(tick, 200);
    return () => window.clearInterval(t);
  }, [showing, peek.left]);

  const { onSubmit, onNext } = props;
  const submit = useCallback(() => onSubmit(mix.rgb), [onSubmit, mix.rgb]);

  // Enter: show the color / lock in / next color. Never during a peek (Got it or Space on it skips),
  // and not right after the screen changed, so a double press can't skip a look or lock in an untouched mix.
  const phaseAt = useRef(0);
  const phaseKey = `${game.index}:${game.phase}:${showing}`;
  useEffect(() => {
    phaseAt.current = performance.now();
  }, [phaseKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.repeat || notForGame(e)) return;
      if (showing) {
        e.preventDefault();
        return;
      }
      if (performance.now() - phaseAt.current < ENTER_GRACE_MS) {
        e.preventDefault();
        return;
      }
      if (game.phase === 'peek') show();
      else if (game.phase === 'guess') submit();
      else if (game.phase === 'reveal') onNext();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.phase, showing, show, submit, onNext]);

  // Leaving a practice game with colors played asks first.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const onBack = (): void => {
    if (game.mode === 'practice' && (game.results.length > 0 || game.phase !== 'peek') && !confirmLeave) setConfirmLeave(true);
    else props.onMenu?.();
  };

  if (game.phase === 'done' || !round) return <Summary {...props} />;

  const target = round.target;
  const targetRgb = hexToRgb(target.hex);
  const result = game.phase === 'reveal' ? game.results[game.index] : undefined;
  const mode: SliderMode = props.save.sliders;
  const resumed = peek.left < game.peekMs;

  return (
    <div className="cr-play">
      <div className="cr-top">
        {props.onMenu ? (
          <button className="cr-icon-btn" onClick={onBack} aria-label="Back to menu">
            ←
          </button>
        ) : (
          <MuteButton muted={props.save.muted} onClick={props.onMute} />
        )}
        <span className="cr-kicker">{game.mode === 'daily' ? `Daily #${dailyNumber(props.day)}` : game.mode === 'challenge' ? '⚔️ Challenge round' : 'Practice'}</span>
        <ol className="cr-pips" aria-label={`Color ${game.index + 1} of ${game.rounds.length}`}>
          {game.rounds.map((_, i) => {
            const r = game.results[i];
            return <li key={i} className={i === game.index ? 'is-now' : ''} style={r ? { background: r.guess } : undefined} />;
          })}
        </ol>
        <span className="cr-total cr-mono">{fmt(totalScore(game.results))}</span>
        {props.onMenu && <MuteButton muted={props.save.muted} onClick={props.onMute} />}
        <GameMenuButton className="cr-icon-btn" />
      </div>

      {confirmLeave && (
        <div className="cr-confirm" role="alert">
          <span>Leave this practice game?</span>
          <button className="cr-btn cr-btn-ghost" onClick={() => setConfirmLeave(false)}>
            Keep playing
          </button>
          <button className="cr-btn" onClick={() => props.onMenu?.()}>
            Leave
          </button>
        </div>
      )}

      <div className="cr-body">
        <div className="cr-side">
          <div className={`cr-hero cr-hero-${game.phase}`}>
            {peeking && showing && (
              <>
                <Glyph id={target.glyph} fill={target.hex} className="cr-glyph cr-pop" />
                <span className="cr-peek-bar" style={{ animationDuration: `${game.peekMs}ms`, animationDelay: `${peek.left - game.peekMs}ms` }} />
                <span className="cr-peek-count cr-mono" aria-hidden="true">
                  {secs}
                </span>
                <button className="cr-peek-skip" onClick={onHide}>
                  Got it
                </button>
              </>
            )}
            {peeking && !showing && (
              <button className="cr-peek-gate" onClick={show}>
                <b>{resumed ? 'Paused' : `Ready? Color ${game.index + 1} of ${game.rounds.length}`}</b>
                <span>{resumed ? `Show the color again (${(peek.left / 1000).toFixed(1)} s left)` : `Tap to see it for ${game.peekMs / 1000} s`}</span>
              </button>
            )}
            {game.phase === 'guess' && (
              <>
                <Glyph id={target.glyph} fill={rgbToHex(mix.rgb)} className="cr-glyph" />
                <span className="cr-hero-label">Your mix</span>
              </>
            )}
            {game.phase === 'reveal' && result && <Reveal targetHex={target.hex} result={result} />}
          </div>

          <div className="cr-name">
            <h2>{target.name}</h2>
            <p>{peeking ? (showing ? 'Memorize this color!' : 'One look only: be ready.') : target.hint}</p>
          </div>
        </div>

        <div className="cr-side">
          {game.phase === 'reveal' && result ? (
            <Feedback target={targetRgb} result={result} />
          ) : (
            <div className="cr-mixer-wrap" aria-hidden={peeking} inert={peeking}>
              <Mixer mix={mix} mode={mode} onChange={setMix} onMode={props.onSliders} />
            </div>
          )}

          {game.phase === 'reveal' ? (
            <>
              <Mixer mix={mix} mode={mode} onChange={setMix} onMode={props.onSliders} target={targetRgb} readOnly />
              <button className="cr-btn cr-btn-go cr-btn-big" onClick={onNext} autoFocus>
                {game.index + 1 >= game.rounds.length ? 'See results' : 'Next color →'}
              </button>
            </>
          ) : (
            <button className="cr-btn cr-btn-go cr-btn-big" onClick={submit} disabled={game.phase !== 'guess'}>
              {peeking ? 'Look closely…' : 'Lock it in'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Reveal({ targetHex, result }: { targetHex: string; result: RoundResult }) {
  const shown = useCountUp(result.points);
  const v = verdictFor(result.points);
  return (
    <div className="cr-reveal">
      <div className="cr-compare">
        <span className="cr-swatch" style={{ background: targetHex, color: inkOn(hexToRgb(targetHex)) }}>
          <small>Target</small>
          <b className="cr-mono">{targetHex}</b>
        </span>
        <span className="cr-swatch" style={{ background: result.guess, color: inkOn(hexToRgb(result.guess)) }}>
          <small>Yours</small>
          <b className="cr-mono">{result.guess}</b>
        </span>
      </div>
      <div className={`cr-verdict cr-v-${v}`}>
        <b className="cr-points cr-mono">{fmt(shown)}</b>
        <span>{verdictText(result.points)}</span>
      </div>
    </div>
  );
}

/** Counts up to `to` over ~0.7 s (instantly with reduced motion). The rAF loop stops on unmount. */
function useCountUp(to: number): number {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / 700);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, reduced]);
  return n;
}

function Feedback({ target, result }: { target: Rgb; result: RoundResult }) {
  const tips = feedback(target, hexToRgb(result.guess));
  return (
    <div className="cr-feedback" aria-live="polite">
      <span className="cr-chip">ΔE {result.dE.toFixed(1)}</span>
      {tips.map((t) => (
        <span key={t} className="cr-chip cr-chip-tip">
          {t}
        </span>
      ))}
      {!tips.length && <span className="cr-chip cr-chip-tip">Spot on</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- sliders */

interface Channel {
  key: string;
  label: string;
  name: string;
  max: number;
  value: number;
  /** Target marker shown after the reveal. */
  mark?: number;
  track: string;
  /** Hue wraps around (359 + 1 = 0). */
  wrap?: boolean;
  set: (v: number) => Mix;
}

function channels(mix: Mix, mode: SliderMode, target?: Rgb): Channel[] {
  const { hsb, rgb } = mix;
  const css = (c: Rgb): string => `rgb(${c.r} ${c.g} ${c.b})`;
  if (mode === 'hsb') {
    const t = target ? rgbToHsb(target, hsb.h) : undefined;
    const hueStops = [0, 60, 120, 180, 240, 300, 360].map((h) => css(hsbToRgb({ h, s: Math.max(hsb.s, 55), b: Math.max(hsb.b, 70) }))).join(',');
    return [
      { key: 'h', label: 'H', name: 'Hue', max: 359, value: hsb.h, mark: t?.h, track: `linear-gradient(90deg,${hueStops})`, wrap: true, set: (h) => mixFromHsb({ ...hsb, h }) },
      { key: 's', label: 'S', name: 'Saturation', max: 100, value: hsb.s, mark: t?.s, track: `linear-gradient(90deg,${css(hsbToRgb({ ...hsb, s: 0 }))},${css(hsbToRgb({ ...hsb, s: 100 }))})`, set: (s) => mixFromHsb({ ...hsb, s }) },
      { key: 'b', label: 'B', name: 'Brightness', max: 100, value: hsb.b, mark: t?.b, track: `linear-gradient(90deg,#000,${css(hsbToRgb({ ...hsb, b: 100 }))})`, set: (b) => mixFromHsb({ ...hsb, b }) },
    ];
  }
  const fromRgb = (c: Rgb): Mix => ({ rgb: c, hsb: rgbToHsb(c, hsb.h) });
  return (['r', 'g', 'b'] as const).map((k) => ({
    key: k,
    label: k.toUpperCase(),
    name: { r: 'Red', g: 'Green', b: 'Blue' }[k],
    max: 255,
    value: rgb[k],
    mark: target?.[k],
    track: `linear-gradient(90deg,${css({ ...rgb, [k]: 0 })},${css({ ...rgb, [k]: 255 })})`,
    set: (v: number) => fromRgb({ ...rgb, [k]: v }),
  }));
}

function Mixer({ mix, mode, onChange, onMode, target, readOnly }: { mix: Mix; mode: SliderMode; onChange: (m: Mix) => void; onMode: (m: SliderMode) => void; target?: Rgb; readOnly?: boolean }) {
  const list = channels(mix, mode, target);
  return (
    <div className={`cr-mixer${readOnly ? ' is-readonly' : ''}`}>
      {!readOnly && (
        <div className="cr-mixer-head">
          <div className="cr-toggle" role="radiogroup" aria-label="Slider type">
            {(['hsb', 'rgb'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => onMode(m)}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="cr-hex cr-mono">
            <i style={{ background: rgbToHex(mix.rgb) }} />
            {rgbToHex(mix.rgb)}
          </span>
        </div>
      )}
      {list.map((c) => (
        <div key={c.key} className="cr-slider">
          <span className="cr-slider-label" aria-hidden="true">
            {c.label}
          </span>
          {!readOnly && (
            <button className="cr-nudge" aria-label={`Less ${c.name.toLowerCase()}`} onClick={() => onChange(c.set(c.wrap ? (c.value + c.max) % (c.max + 1) : Math.max(0, c.value - 1)))}>
              −
            </button>
          )}
          <div className="cr-track" style={{ background: c.track }}>
            <input
              type="range"
              min={0}
              max={c.max}
              step={1}
              value={c.value}
              aria-label={c.name}
              disabled={readOnly}
              onChange={(e) => onChange(c.set(Number(e.target.value)))}
              onKeyDown={
                c.wrap
                  ? (e) => {
                      // Hue is a circle: the arrow keys wrap around at the ends (red sits at both).
                      const up = e.key === 'ArrowRight' || e.key === 'ArrowUp';
                      const down = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
                      if ((up && c.value >= c.max) || (down && c.value <= 0)) {
                        e.preventDefault();
                        onChange(c.set(up ? 0 : c.max));
                      }
                    }
                  : undefined
              }
              style={{ '--thumb': rgbToHex(mix.rgb) } as CSSProperties}
            />
            {c.mark !== undefined && <i className="cr-mark" style={{ '--at': c.mark / c.max } as CSSProperties} title={`Target ${c.name}: ${c.mark}`} />}
          </div>
          {!readOnly && (
            <button className="cr-nudge" aria-label={`More ${c.name.toLowerCase()}`} onClick={() => onChange(c.set(c.wrap ? (c.value + 1) % (c.max + 1) : Math.min(c.max, c.value + 1)))}>
              +
            </button>
          )}
          <output className="cr-slider-value cr-mono">{c.mark !== undefined ? `${c.value}→${c.mark}` : c.value}</output>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- summary */

function Summary({ game, day, today, save, onMenu, onAgain, challengeId, dailyCounts }: { game: GameState; day: string; today: string; save: CrSave; onMenu?: () => void; onAgain: () => void; challengeId?: string; dailyCounts?: boolean }) {
  const score = totalScore(game.results);
  const streak = crStats(save, today).streak;
  const best = game.results.reduce((a, r) => Math.max(a, r.points), 0);
  return (
    <div className="cr-summary">
      <span className="cr-kicker">{game.mode === 'daily' ? `Daily #${dailyNumber(day)} complete` : game.mode === 'challenge' ? '⚔️ Challenge round complete' : 'Practice complete'}</span>
      {dailyCounts && <p className="cr-muted">You already played Daily #{dailyNumber(day)}: your daily result counts here.</p>}
      <p className="cr-summary-score">
        <b className="cr-mono">{fmt(score)}</b>
        <span>/ {fmt(MAX_SCORE)}</span>
      </p>
      <p className="cr-muted">
        {Math.round((score / (game.results.length * MAX_POINTS)) * 100)}% accuracy · best color {fmt(best)}
        {game.mode === 'daily' && streak > 0 ? ` · 🔥 ${streak}` : ''}
      </p>
      <ResultLine line={resultLine(game.results)} label={`${game.results.filter((r) => verdictFor(r.points) === 'perfect').length} perfect of ${game.results.length} colors`} />
      <ul className="cr-summary-list">
        {game.results.map((r, i) => {
          const t = resultTarget(r);
          return (
            <li key={i}>
              {t && <Glyph id={t.glyph} fill={t.hex} className="cr-summary-glyph" />}
              <span className="cr-summary-name">{t?.name}</span>
              <span className="cr-strip-pair">
                <i style={{ background: t?.hex }} />
                <i style={{ background: r.guess }} />
              </span>
              <b className={`cr-mono cr-v-${verdictFor(r.points)}`}>{fmt(r.points)}</b>
            </li>
          );
        })}
      </ul>
      <div className="cr-row">
        {game.mode === 'daily' ? (
          <ShareButton today={day} results={game.results} streak={streak} />
        ) : game.mode === 'challenge' && challengeId ? (
          <a className="cr-btn cr-btn-go" href={`/c/${challengeId}`} onClick={openChallengeScores}>
            See the scoreboard
          </a>
        ) : (
          <button className="cr-btn cr-btn-go" onClick={onAgain}>
            Play again
          </button>
        )}
        {onMenu && (
          <button className="cr-btn cr-btn-ghost" onClick={onMenu}>
            Menu
          </button>
        )}
      </div>
    </div>
  );
}
