import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, msUntilMidnight, parseDayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import {
  challengeScore,
  ENDLESS_SLACK,
  endStats,
  isHidden,
  LIVES,
  MAX_POINTS,
  reduceLevel,
  resultLine,
  resultOf,
  shareText,
  startLevel,
  stuck,
  totalPoints,
  totalStars,
  UNDER_PAR_BONUS,
  underParBonus,
  type LevelAction,
  type LevelResult,
  type LevelState,
  type Mode,
} from './rules';
import { DAILY_LEVELS, dailyNumber, type Level, type LevelReq } from './levels';
import { almostSolved, doneTubes, pourAmount, type Board, type Move } from './sort';
import { disposeSolver, hintAsync, levelAsync, levelNow, levelReady } from './solver';
import { createSfx, type Sfx } from './sound';
import { clStats, isComplete, loadCl, recordEndless, recordLevel, recordPrecision, STORE_KEY, updateCl, type ClSave, type PracticeSize } from './store';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

const PRACTICE: { id: PracticeSize; label: string; note: string; step: number }[] = [
  { id: 'small', label: 'Small', note: '4 colors', step: 1 },
  { id: 'medium', label: 'Medium', note: '5 colors', step: 3 },
  { id: 'large', label: 'Large', note: '7 colors', step: 5 },
  { id: 'huge', label: 'Huge', note: '9 colors', step: 8 },
];
/** Keys that pick tubes, in board order (U, H and Z stay undo, hint and undo; Shift+R restarts). */
export const TUBE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w', 'e', 'r', 't', 'y', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g'];
const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32);
const reducedMotion = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Pour animation beats, in ms: lift + tilt, pour, return. */
const TILT_MS = 240;
const POUR_MS = 300;

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <ColorLab key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

type Screen = 'menu' | 'play' | 'stats';

interface Run {
  mode: Mode;
  /** The day the run started: a daily started before midnight finishes as that day's. */
  day: string;
  /** Level number within the run (0-based). */
  step: number;
  results: LevelResult[];
  lives: number;
  seed: number;
  practiceStep: number;
  over: boolean;
  /**
   * A friends' challenge: five daily-style levels from the challenge's seed (mode stays 'daily'), or
   * with `daily` the real daily of `day` (one attempt for both).
   */
  challenge?: { id: string; round: number; daily: boolean };
}

const challengeKey = (c: { id: string; round: number }): string => `${c.id}:${c.round}`;

function levelReq(run: Run): LevelReq {
  if (run.challenge && !run.challenge.daily) return { kind: 'daily', day: `challenge-${run.seed}`, index: run.step };
  if (run.mode === 'daily') return { kind: 'daily', day: run.day, index: run.step };
  const seed = run.seed + run.step * 7919;
  if (run.mode === 'practice') return { kind: 'practice', seed, size: run.practiceStep };
  return { kind: 'ladder', seed, step: run.step };
}

/** Every pour counts in friends' challenges (undo can't buy a better score). */
const isStrict = (run: Run): boolean => !!run.challenge;

/** The level a run is on, with the help already paid for on it (left halfway, then resumed). */
function levelState(run: Run, s: ClSave): LevelState | null {
  if (run.over) return null;
  let st = startLevel(levelNow(levelReq(run)), run.mode, isStrict(run));
  const keyed = run.challenge && !run.challenge.daily ? s.challenges[challengeKey(run.challenge)]?.help : null;
  const daily = run.mode === 'daily' && (!run.challenge || run.challenge.daily) && s.help?.day === run.day && s.help.index === run.step ? s.help : null;
  const help = keyed ?? daily;
  if (help) {
    if (help.spare) st = reduceLevel(st, { type: 'spare' });
    st = { ...st, hints: help.hints };
  }
  return st;
}

/** Where a challenge round stands on this device (see checklist: one attempt, resumed after a reload). */
function challengeSetup(c: NonNullable<GameModuleProps['challenge']>, s: ClSave): { run: Run; done: boolean; endNow: boolean } {
  const daily = c.mode === 'daily' && !!c.day;
  const rec = s.challenges[challengeKey(c)];
  const day = daily ? c.day : (rec?.day ?? dayKey());
  const results = (daily ? s.daily[day] : rec?.results) ?? [];
  const full = results.length >= DAILY_LEVELS;
  const run: Run = { mode: 'daily', day, step: Math.min(results.length, DAILY_LEVELS - 1), results, lives: LIVES, seed: c.seed, practiceStep: 3, over: full, challenge: { id: c.id, round: c.round, daily } };
  return { run, done: !!rec?.done, endNow: full && !rec?.done };
}

function ColorLab({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: GameModuleProps['challenge'] }) {
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<ClSave>(loadCl);
  const [setup] = useState(() => (challenge ? challengeSetup(challenge, save) : null));
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  const [run, setRun] = useState<Run | null>(setup?.run ?? null);
  const [level, setLevel] = useState<LevelState | null>(() => (setup ? levelState(setup.run, save) : null));
  /** Set when a challenge round's score is the daily already played (shown on the summary). */
  const [fromDaily] = useState(() => !!setup?.endNow && !!setup.run.challenge?.daily);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const saveRef = useRef(save);
  const runRef = useRef(run);
  useLayoutEffect(() => {
    runRef.current = run;
  }, [run]);
  /** Every write re-reads the stored save and changes that, so two open tabs never undo each other. */
  const commit = useCallback((change: (s: ClSave) => ClSave): ClSave => {
    const next = updateCl(change, dayKey());
    saveRef.current = next;
    setSave(next);
    return next;
  }, []);

  /** Reports a challenge round's end, once: the record says it was sent, so a reload shows the result instead. */
  const endChallenge = (r: Run, results: readonly LevelResult[], write: (change: (s: ClSave) => ClSave) => ClSave = commit): void => {
    if (!r.challenge) return;
    const key = challengeKey(r.challenge);
    let already = false;
    write((s) => {
      already = !!s.challenges[key]?.done;
      return { ...s, challenges: { ...s.challenges, [key]: { day: s.challenges[key]?.day ?? r.day, results: [...results], help: null, done: true } } };
    });
    if (!already) reportEnd(host, 'daily', results, r.challenge);
  };

  useEffect(() => {
    if (!challenge || !setup || setup.done) return;
    const r = setup.run;
    // Nothing on screen depends on these writes, so they skip the re-render.
    const write = (change: (s: ClSave) => ClSave): ClSave => (saveRef.current = updateCl(change, dayKey()));
    if (setup.endNow) {
      // A "Today's daily" round whose daily is already finished here: that result is the score.
      endChallenge(r, r.results, write);
      return;
    }
    host.report({ type: 'start' });
    // Mark the round as started (the record is what makes it one attempt).
    const key = challengeKey(challenge);
    write((s) => (s.challenges[key] ? s : { ...s, challenges: { ...s.challenges, [key]: { day: r.day, results: [...r.results], help: null, done: false } } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
      disposeSolver();
    },
    [],
  );
  useEffect(() => {
    rootRef.current?.scrollTo?.({ top: 0 });
  }, [screen, run?.step, run?.over]);

  // Midnight: the menu shows the new day's daily once the date changes (checked when the tab comes back too).
  useEffect(() => {
    const check = (): void => setToday(dayKey());
    const onVis = (): void => {
      if (document.visibilityState === 'visible') check();
    };
    const t = screen === 'menu' ? window.setInterval(check, 30_000) : 0;
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', check);
    check();
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', check);
    };
  }, [screen]);

  const begin = (r: Run, s: ClSave = saveRef.current): void => {
    setRun(r);
    runRef.current = r;
    setLevel(levelState(r, s));
    setScreen('play');
  };

  // Another tab changed the save: take its version, and leave a daily puzzle it already finished.
  const onStorageRef = useRef<(e: StorageEvent) => void>(() => undefined);
  useLayoutEffect(() => {
    onStorageRef.current = (e) => {
      if (e.key !== null && e.key !== STORE_KEY) return;
      const fresh = loadCl();
      saveRef.current = fresh;
      setSave(fresh);
      const r = runRef.current;
      if (!r || r.mode !== 'daily' || r.over || (r.challenge && !r.challenge.daily)) return;
      const stored = fresh.daily[r.day] ?? [];
      if (stored.length <= r.results.length) return;
      const full = isComplete(stored);
      begin({ ...r, step: Math.min(stored.length, DAILY_LEVELS - 1), results: stored, over: full }, fresh);
      if (full && r.challenge) endChallenge(r, stored);
    };
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => onStorageRef.current(e);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Remember help used on a daily or challenge puzzle in progress (see levelState).
  useEffect(() => {
    if (!run || run.mode !== 'daily' || !level || level.status !== 'play' || (!level.hints && !level.spare)) return;
    const help = { hints: level.hints, spare: level.spare };
    if (run.challenge && !run.challenge.daily) {
      const key = challengeKey(run.challenge);
      const h = saveRef.current.challenges[key]?.help;
      if (h?.hints === help.hints && h.spare === help.spare) return;
      commit((s) => (s.challenges[key] && !s.challenges[key]!.done ? { ...s, challenges: { ...s.challenges, [key]: { ...s.challenges[key]!, help } } } : s));
      return;
    }
    const h = saveRef.current.help;
    if (h?.day === run.day && h.index === run.step && h.hints === help.hints && h.spare === help.spare) return;
    commit((s) => ({ ...s, help: { day: run.day, index: run.step, ...help } }));
  }, [run, level, commit]);

  // Make the next level in the background while this one is played.
  useEffect(() => {
    if (!run || run.over || (run.mode === 'daily' && run.step >= DAILY_LEVELS - 1)) return;
    void levelAsync(levelReq({ ...run, step: run.step + 1 }));
  }, [run]);

  /**
   * Ends an Endless or Par Challenge run on purpose (End run, the back arrow, closing the game):
   * recorded and reported once, when at least one level was played.
   */
  const endRun = useCallback(
    (r: Run | null): Run | null => {
      if (!r || r.over || (r.mode !== 'endless' && r.mode !== 'precision')) return r;
      const over = { ...r, over: true };
      runRef.current = over;
      if (r.results.length) {
        commit((s) => (r.mode === 'endless' ? recordEndless(s, r.results) : recordPrecision(s, r.results)));
        reportEnd(host, r.mode, r.results);
      }
      return over;
    },
    [commit, host],
  );
  const endRunRef = useRef(endRun);
  useLayoutEffect(() => {
    endRunRef.current = endRun;
  });
  useEffect(() => () => void endRunRef.current(runRef.current), []);

  const start = (mode: Mode): void => {
    const day = dayKey();
    setToday(day);
    const base: Run = { mode, day, step: 0, results: [], lives: LIVES, seed: randomSeed(), practiceStep: 3, over: false };
    if (mode === 'daily') {
      const done = saveRef.current.daily[day] ?? [];
      begin({ ...base, step: Math.min(done.length, DAILY_LEVELS - 1), results: done, over: isComplete(done) });
      if (!isComplete(done)) host.report({ type: 'start' });
      return;
    }
    if (mode === 'practice') {
      begin({ ...base, practiceStep: PRACTICE.find((p) => p.id === saveRef.current.practice.size)?.step ?? 3 });
      return;
    }
    host.report({ type: 'start' });
    begin(base);
  };

  /** A level was won (or failed in Precision): record it and work out what the run does next. */
  const finishLevel = (lv: LevelState): void => {
    if (!run) return;
    const result = resultOf(lv);
    const asDaily = run.mode === 'daily' && (!run.challenge || run.challenge.daily);
    const record = (s: ClSave): ClSave => recordLevel(s, result, asDaily ? run.day : null, run.mode === 'practice', asDaily ? run.step : undefined);
    let next: Run;
    let then: ((s: ClSave) => ClSave) | null = null;
    let report: (() => void) | null = null;
    if (run.mode === 'daily') {
      next = { ...run, results: [...run.results, result] };
      if (next.results.length >= DAILY_LEVELS) {
        next = { ...next, over: true };
        const done = next;
        // A daily finished after midnight is still that day's daily, but it is not today's any more.
        report = done.challenge ? () => endChallenge(done, done.results) : () => reportEnd(host, 'daily', done.results, undefined, done.day === dayKey());
      } else if (run.challenge && !run.challenge.daily) {
        const key = challengeKey(run.challenge);
        const results = next.results;
        then = (s) => ({ ...s, challenges: { ...s.challenges, [key]: { day: s.challenges[key]?.day ?? run.day, results, help: null, done: false } } });
      }
    } else if (run.mode === 'endless') {
      const lost = result.moves > result.par + ENDLESS_SLACK ? 1 : 0;
      next = { ...run, results: [...run.results, result], lives: run.lives - lost };
      if (next.lives <= 0) {
        next = { ...next, over: true };
        const rs = next.results;
        then = (s) => recordEndless(s, rs);
        report = () => reportEnd(host, 'endless', rs);
      }
    } else if (run.mode === 'precision') {
      if (result.solved) next = { ...run, results: [...run.results, result] };
      else {
        next = { ...run, lives: run.lives - 1 };
        if (next.lives <= 0) {
          next = { ...next, over: true };
          const rs = next.results;
          then = (s) => recordPrecision(s, rs);
          report = () => reportEnd(host, 'precision', rs);
        }
      }
    } else next = { ...run, results: [...run.results, result] };
    commit((s) => (then ? then(record(s)) : record(s)));
    setRun(next);
    runRef.current = next;
    report?.();
  };

  const nextLevel = (): void => {
    if (!run || !level || loading) return;
    if (run.over) {
      setLevel(null);
      return;
    }
    // Precision failure: try the same level again.
    if (run.mode === 'precision' && level.status === 'failed') {
      setLevel(startLevel(level.level, 'precision', false));
      return;
    }
    const r = { ...run, step: run.step + 1 };
    const show = (lv: Level): void => {
      setRun(r);
      runRef.current = r;
      setLevel(startLevel(lv, r.mode, isStrict(r)));
    };
    const ready = levelReady(levelReq(r));
    if (ready) return show(ready);
    // Big levels take a moment to make: off the main thread, with the button saying so.
    setLoading(true);
    void levelAsync(levelReq(r)).then((lv) => {
      setLoading(false);
      if (runRef.current === run) show(lv);
    });
  };

  const toSummary = (): void => {
    const over = endRun(run);
    setRun(over);
    setLevel(null);
  };
  const toMenu = (): void => {
    setRun(endRun(run));
    setScreen('menu');
  };

  return (
    <div className="cl" data-screen={screen} ref={rootRef}>
      {screen === 'menu' && (
        <Menu
          today={today}
          save={save}
          onStart={start}
          onStats={() => setScreen('stats')}
          onSize={(size) => commit((s) => ({ ...s, practice: { ...s.practice, size } }))}
          onMute={() => commit((s) => ({ ...s, muted: !s.muted }))}
          onPatterns={() => commit((s) => ({ ...s, patterns: !s.patterns }))}
        />
      )}
      {screen === 'stats' && <Stats save={save} today={today} onBack={() => setScreen('menu')} />}
      {screen === 'play' && run && (
        <>
          {level && !(run.over && level.status === 'play') ? (
            <Play
              key={`${run.step}:${run.lives}`}
              run={run}
              state={level}
              save={save}
              sfx={sfx}
              pauseKey={pauseKey}
              loading={loading}
              onChange={setLevel}
              onFinish={finishLevel}
              onNext={nextLevel}
              onMenu={toMenu}
              onEndRun={toSummary}
            />
          ) : (
            <Summary run={run} save={save} fromDaily={fromDaily} onMenu={() => setScreen('menu')} onAgain={() => start(run.mode)} />
          )}
        </>
      )}
    </div>
  );
}

/** The one place a finished run is reported (`daily: true` only for today's daily). */
function reportEnd(host: GameHost, mode: Mode, rs: readonly LevelResult[], challenge?: Run['challenge'], today = true): void {
  const end = endStats(mode, rs, !!challenge);
  host.report(challenge ? { type: 'end', ...end, challenge: { id: challenge.id, round: challenge.round } } : mode === 'daily' && today ? { type: 'end', ...end, daily: true } : { type: 'end', ...end });
}

/* ------------------------------------------------------------------ menu */

function Wordmark() {
  const tubes = [
    [0, 1, 0],
    [3, 3, 3],
    [1, 0, 2],
  ];
  return (
    <h1 className="cl-wordmark" aria-label="Color Lab">
      <span aria-hidden="true" className="cl-wordmark-tubes">
        {tubes.map((t, i) => (
          <span key={i} className="cl-mini-tube">
            {t.map((c, j) => (
              <i key={j} className={`cl-c${c} cl-pat`} />
            ))}
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="cl-wordmark-text">
        Color <b>Lab</b>
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
  return <span className="cl-mono">{formatCountdown(ms)}</span>;
}

function Menu(props: {
  today: string;
  save: ClSave;
  onStart: (m: Mode) => void;
  onStats: () => void;
  onSize: (s: PracticeSize) => void;
  onMute: () => void;
  onPatterns: () => void;
}) {
  const { today, save } = props;
  const todays = save.daily[today];
  const stats = clStats(save, today);
  const done = isComplete(todays);
  const started = !done && (todays?.length ?? 0) > 0;
  const date = parseDayKey(today).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="cl-menu">
      <div className="cl-menu-top">
        <div className="cl-row cl-row-start">
          <MuteButton muted={save.muted} onClick={props.onMute} />
          <button className="cl-icon-btn" onClick={props.onPatterns} aria-pressed={save.patterns} aria-label={save.patterns ? 'Hide color patterns' : 'Show color patterns'} title="Color patterns">
            <span className={`cl-pat-icon${save.patterns ? '' : ' is-off'}`} aria-hidden="true" />
          </button>
        </div>
        {stats.streak > 0 && <span className="cl-chip cl-chip-fire">🔥 {stats.streak}-day streak</span>}
        <GameMenuButton className="cl-icon-btn" />
      </div>
      <Wordmark />
      <p className="cl-tagline">Pour the colors until each one fills a tube of its own. Fewer moves, more points.</p>

      <section className="cl-card cl-card-daily">
        <div className="cl-card-head">
          <span className="cl-kicker">Daily #{dailyNumber(today)}</span>
          <span className="cl-muted">{date}</span>
        </div>
        {done ? (
          <>
            <ResultStrip results={todays!} />
            <p className="cl-daily-score">
              <b className="cl-mono">{totalPoints(todays!)}</b> / {DAILY_LEVELS * MAX_POINTS}
            </p>
            <div className="cl-row">
              <ShareButton label={`#${dailyNumber(today)}`} results={todays!} streak={stats.streak} />
              <button className="cl-btn cl-btn-ghost" onClick={() => props.onStart('daily')}>
                Review
              </button>
            </div>
            <p className="cl-muted cl-small">
              Next daily in <Countdown />
            </p>
          </>
        ) : (
          <>
            <p className="cl-card-text">Five puzzles, the same for everyone today, from warm-up to brain-bender. Beat par for 10 points each.</p>
            <button className="cl-btn cl-btn-go" onClick={() => props.onStart('daily')}>
              {started ? `Resume (${todays!.length}/${DAILY_LEVELS})` : 'Play today’s puzzles'}
            </button>
          </>
        )}
      </section>

      <div className="cl-mode-grid">
        <section className="cl-card cl-card-mode">
          <span className="cl-kicker">Endless</span>
          <p className="cl-card-text">A new puzzle every level, a little bigger each time. Finish {ENDLESS_SLACK + 1}+ over par three times and it’s over.</p>
          {save.endless.bestLevels > 0 && <p className="cl-muted cl-small">Best: {save.endless.bestLevels} levels</p>}
          <button className="cl-btn" onClick={() => props.onStart('endless')}>
            Start Endless
          </button>
        </section>
        <section className="cl-card cl-card-mode">
          <span className="cl-kicker">Par Challenge</span>
          <p className="cl-card-text">Solve each puzzle in par moves or fewer. Run out of moves three times and you’re done.</p>
          {save.precision.bestLevels > 0 && <p className="cl-muted cl-small">Best: {save.precision.bestLevels} levels</p>}
          <button className="cl-btn" onClick={() => props.onStart('precision')}>
            Start challenge
          </button>
        </section>
      </div>

      <section className="cl-card">
        <div className="cl-card-head">
          <span className="cl-kicker">Practice</span>
          <span className="cl-muted">Unlimited, no pressure</span>
        </div>
        <div className="cl-seg" role="radiogroup" aria-label="Puzzle size">
          {PRACTICE.map((d) => (
            <button key={d.id} role="radio" aria-checked={save.practice.size === d.id} className="cl-seg-btn" onClick={() => props.onSize(d.id)}>
              <b>{d.label}</b>
              <small>{d.note}</small>
            </button>
          ))}
        </div>
        <button className="cl-btn" onClick={() => props.onStart('practice')}>
          Practice
        </button>
      </section>

      <button className="cl-link" onClick={props.onStats}>
        Your stats →
      </button>
    </div>
  );
}

function MuteButton({ muted, onClick }: { muted: boolean; onClick: () => void }) {
  return (
    <button className="cl-icon-btn" onClick={onClick} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

function Stars({ n, size = 'sm' }: { n: number; size?: 'sm' | 'lg' }) {
  return (
    <span className={`cl-stars cl-stars-${size}`} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? 'is-on' : ''} aria-hidden="true">
          ★
        </i>
      ))}
    </span>
  );
}

function ResultStrip({ results }: { results: readonly LevelResult[] }) {
  return (
    <ol className="cl-strip">
      {results.map((r, i) => (
        <li key={i} title={`Puzzle ${i + 1}: ${r.points} points, ${r.moves} moves (par ${r.par})`}>
          <Stars n={r.stars} />
          <b className="cl-mono">{r.points}</b>
        </li>
      ))}
    </ol>
  );
}

function ShareButton({ label, results, streak }: { label: string; results: readonly LevelResult[]; streak?: number }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  const share = async (): Promise<void> => {
    const url = `${window.location.origin}/games/color-lab`;
    const outcome = await shareOrCopy({ title: 'Color Lab', text: shareText({ label, results, streak, url }) });
    setMsg(outcome === 'copied' ? 'Copied!' : outcome === 'failed' ? 'Could not copy' : '');
  };
  return (
    <button className="cl-btn cl-btn-go" onClick={() => void share()}>
      {msg || 'Share result'}
    </button>
  );
}

/* ----------------------------------------------------------------- stats */

function Stats({ save, today, onBack }: { save: ClSave; today: string; onBack: () => void }) {
  const s = clStats(save, today);
  const tiles: [string, string][] = [
    ['Dailies played', String(s.dailyPlayed)],
    ['Current streak', String(s.streak)],
    ['Best streak', String(s.bestStreak)],
    ['Best daily', s.bestDaily ? `${s.bestDaily}/50` : '–'],
    ['Average daily', s.avgDaily ? String(s.avgDaily) : '–'],
    ['Puzzles solved', String(save.solved)],
    ['At or under par', String(save.underPar)],
    ['Endless best', save.endless.bestLevels ? `${save.endless.bestLevels} levels` : '–'],
    ['Par Challenge best', save.precision.bestLevels ? `${save.precision.bestLevels} levels` : '–'],
  ];
  const hist = save.history.slice(-30);
  const max = Math.max(4, ...hist);
  return (
    <div className="cl-stats">
      <div className="cl-top">
        <button className="cl-icon-btn" onClick={onBack} aria-label="Back to menu">
          ←
        </button>
        <h2>Your stats</h2>
        <GameMenuButton className="cl-icon-btn" style={{ marginLeft: 'auto' }} />
      </div>
      <div className="cl-stat-grid">
        {tiles.map(([k, v]) => (
          <div key={k} className="cl-stat">
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <h3 className="cl-kicker">Moves over par, last {hist.length || 30} puzzles</h3>
      {hist.length ? (
        <>
          <div className="cl-spark" role="img" aria-label={`Recent average ${s.recentOver ?? 0} moves over par`}>
            {hist.map((a, i) => (
              <i key={i} style={{ height: `${Math.max(6, (a / max) * 100)}%` }} className={a === 0 ? 'is-par' : ''} />
            ))}
          </div>
          <p className="cl-muted cl-small">
            Last 10: <b>{s.recentOver ?? 0}</b> moves over par on average
            {s.previousOver !== null && s.recentOver !== null && ` (${s.recentOver <= s.previousOver ? 'better than' : 'up from'} ${s.previousOver} before)`}
          </p>
        </>
      ) : (
        <p className="cl-muted cl-small">Solve a few puzzles to see your trend. Green bars are at par or better.</p>
      )}
      <p className="cl-muted cl-small">Saved on this device only.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ play */

function runLabel(run: Run): string {
  if (run.challenge) return `⚔️ Challenge · ${run.step + 1}/${DAILY_LEVELS}`;
  if (run.mode === 'daily') return `Daily #${dailyNumber(run.day)} · ${run.step + 1}/${DAILY_LEVELS}`;
  if (run.mode === 'endless') return `Endless · level ${run.step + 1}`;
  if (run.mode === 'precision') return `Par Challenge · level ${run.step + 1}`;
  return 'Practice';
}

interface Anim {
  from: number;
  to: number;
  dx: number;
  dy: number;
  tilt: number;
  color: number;
  phase: 'tilt' | 'pour' | 'back';
}

/** Chooses tube width and layer height so the whole board fits the available space. */
function useBoardLayout(ref: RefObject<HTMLDivElement | null>, count: number, maxCap: number): CSSProperties {
  const [vars, setVars] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = (): void => {
      const w = el.clientWidth;
      const h = Math.max(220, el.clientHeight);
      let best = { u: 0, tw: 0, per: count };
      for (let per = 1; per <= count; per++) {
        const rows = Math.ceil(count / per);
        const tw = Math.min(70, w / per - 12);
        if (tw < 30) continue;
        const u = Math.min(tw * 0.9, (h / rows - 52) / maxCap, 60);
        if (u > best.u) best = { u, tw, per };
      }
      setVars({ '--u': `${Math.max(14, Math.floor(best.u))}px`, '--tw': `${Math.floor(best.tw)}px`, '--per': best.per } as CSSProperties);
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref, count, maxCap]);
  return vars;
}

/** Keys typed into a field, a dialog over the game, or outside the game are not meant for it. */
function keyIsForGame(e: KeyboardEvent, root: HTMLElement | null): boolean {
  const t = e.target instanceof Element ? e.target : null;
  if (!t || t === document.body || t === document.documentElement) return true;
  if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return false;
  if (!root?.contains(t)) return false;
  // A dialog of the game's own (the result card) still takes Enter.
  const dialog = t.closest('[role=dialog], [aria-modal=true]');
  if (dialog && !dialog.classList.contains('cl-done')) return false;
  // A keyboard-focused button keeps Enter and Space for itself.
  if ((e.key === 'Enter' || e.key === ' ') && t.closest('button, a') && t.matches(':focus-visible')) return false;
  return true;
}

function Play(props: {
  run: Run;
  state: LevelState;
  save: ClSave;
  sfx: () => Sfx;
  pauseKey?: number;
  loading: boolean;
  onChange: (s: LevelState) => void;
  onFinish: (s: LevelState) => void;
  onNext: () => void;
  onMenu: () => void;
  onEndRun: () => void;
}) {
  const { run, state, sfx, onChange, onFinish } = props;
  const [selected, setSelected] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  /** The last hint and the board it was made for: it shows only while that board is still on screen. */
  const [hinted, setHinted] = useState<{ move: Move; board: Board } | null>(null);
  const [thinking, setThinking] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const tubeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);
  const later = (ms: number, f: () => void): void => {
    timers.current.push(window.setTimeout(f, ms));
  };

  const maxCap = Math.max(...state.board.map((t) => t.cap));
  const layout = useBoardLayout(boardRef, state.board.length, maxCap);
  const done = doneTubes(state.board);
  const hint = hinted && hinted.board === state.board && state.status === 'play' ? hinted.move : null;
  const almost = state.status === 'play' ? almostSolved(state.board) : null;
  const oddSizes = state.level.board.some((t) => t.cap !== state.level.board[0]!.cap);

  const apply = useCallback(
    (a: LevelAction) => {
      const prev = stateRef.current;
      const next = reduceLevel(prev, a);
      if (next === prev) return next;
      stateRef.current = next;
      onChange(next);
      if (prev.status === 'play' && next.status !== 'play') {
        if (next.status === 'won') sfx().win();
        else sfx().fail();
        onFinish(next);
      }
      return next;
    },
    [onChange, onFinish, sfx],
  );

  // Leaving full screen or scrolling away cancels a half-made selection.
  const [pauseSeen, setPauseSeen] = useState(props.pauseKey);
  if (pauseSeen !== props.pauseKey) {
    setPauseSeen(props.pauseKey);
    setSelected(null);
  }

  const tap = (i: number): void => {
    if (busy.current || stateRef.current.status !== 'play') return;
    const s = stateRef.current;
    if (selected === null) {
      if (!s.board[i]?.layers.length) return;
      setSelected(i);
      sfx().lift();
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    const amount = pourAmount(s.board, selected, i);
    if (!amount) {
      setShake(i);
      later(380, () => setShake(null));
      sfx().nope();
      // Tapping another tube with color in it picks that one up instead.
      setSelected(s.board[i]?.layers.length ? i : null);
      return;
    }
    const from = selected;
    setSelected(null);
    const color = s.board[from]!.layers[s.board[from]!.layers.length - 1]!;
    const a = tubeRefs.current[from]?.getBoundingClientRect();
    const b = tubeRefs.current[i]?.getBoundingClientRect();
    if (reducedMotion() || !a || !b) {
      apply({ type: 'pour', from, to: i });
      sfx().pour(amount);
      return;
    }
    busy.current = true;
    const left = b.left < a.left;
    const dx = b.left - a.left + (left ? b.width * 0.55 : -b.width * 0.55);
    const dy = b.top - a.top - a.height * 0.42;
    setAnim({ from, to: i, dx, dy, tilt: left ? -62 : 62, color, phase: 'tilt' });
    later(TILT_MS, () => {
      setAnim((x) => (x ? { ...x, phase: 'pour' } : x));
      apply({ type: 'pour', from, to: i });
      sfx().pour(amount);
    });
    later(TILT_MS + POUR_MS, () => setAnim((x) => (x ? { ...x, phase: 'back' } : x)));
    later(TILT_MS * 2 + POUR_MS, () => {
      setAnim(null);
      busy.current = false;
    });
  };

  const undo = (): void => {
    if (busy.current) return;
    setSelected(null);
    const prev = stateRef.current;
    if (apply({ type: 'undo' }) !== prev) sfx().undo();
  };
  const restart = (): void => {
    if (busy.current || stateRef.current.status !== 'play') return;
    setSelected(null);
    apply({ type: 'restart' });
  };
  const spare = (): void => {
    if (busy.current || state.spare) return;
    apply({ type: 'spare' });
    sfx().lift();
  };
  const askHint = (): void => {
    if (busy.current || thinking || stateRef.current.status !== 'play') return;
    const board = stateRef.current.board;
    setThinking(true);
    void hintAsync(board, stateRef.current.level).then((m) => {
      if (!alive.current) return;
      setThinking(false);
      // The board changed while the hint was worked out: it no longer applies (and costs nothing).
      if (stateRef.current.board !== board || stateRef.current.status !== 'play') return;
      if (!m) {
        setHinted({ move: { from: -1, to: -1 }, board });
        return;
      }
      apply({ type: 'hint' });
      setSelected(null);
      setHinted({ move: m, board: stateRef.current.board });
    });
  };

  // Keyboard: tube keys pick tubes, U / Z / Backspace undo, Shift+R restart, H hint, Enter next.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const onKeyNow = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || !keyIsForGame(e, rootRef.current)) return;
    const s = stateRef.current;
    // Caps Lock gives capitals: compare in lower case; restart is Shift+R only.
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'Enter' && s.status !== 'play') {
      e.preventDefault();
      props.onNext();
      return;
    }
    if (s.status !== 'play') return;
    if (key === 'Backspace' || key === 'u' || key === 'z') {
      e.preventDefault();
      undo();
    } else if (key === 'Escape') setSelected(null);
    else if (key === 'h') askHint();
    else if (key === 'r' && e.shiftKey) restart();
    else {
      const i = TUBE_KEYS.indexOf(key);
      if (i >= 0 && i < s.board.length) {
        e.preventDefault();
        tap(i);
      }
    }
  };
  useLayoutEffect(() => {
    keyRef.current = onKeyNow;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isStuck = stuck(state);
  const limitLeft = state.limit !== null ? state.limit - state.moves : null;
  const runMode = run.mode === 'endless' || run.mode === 'precision';
  const note = hint && hint.from < 0 ? (
    <p className="cl-note">No way forward from here. Undo a few moves or restart.</p>
  ) : isStuck && !hint ? (
    <p className="cl-note">No moves left. Undo or restart.</p>
  ) : almost ? (
    <p className="cl-note">
      Almost! Each color must fill a tube to the top.{almost.target >= 0 ? ` Pour tube ${almost.tube + 1} into tube ${almost.target + 1}, which is its size.` : ' Move it into a tube of its size.'}
    </p>
  ) : null;
  // One quiet line at a time: what is special about this puzzle.
  const soft =
    state.status !== 'play' || note
      ? null
      : state.level.mystery
        ? `Mystery puzzle: hidden layers show once they reach the top.${state.level.parSlack ? ` Par allows ${state.level.parSlack} extra moves for them.` : ''}`
        : state.strict && state.moves < 3
          ? `Every pour counts here: undo puts the colors back, not the moves.${run.challenge ? ` Par or better is 10 points, and each move under par adds ${UNDER_PAR_BONUS}.` : ''}`
          : oddSizes
            ? 'Tubes come in sizes: a color is done when it fills a tube to the top.'
            : null;

  return (
    <div className="cl-play" ref={rootRef}>
      <div className="cl-top">
        {/* A friends' challenge is one attempt: no way out of it from here. */}
        {!run.challenge && (
          <button className="cl-icon-btn" onClick={props.onMenu} aria-label={runMode ? 'End the run and go back to the menu' : 'Back to menu'}>
            ←
          </button>
        )}
        <span className="cl-kicker">{runLabel(run)}</span>
        {runMode ? (
          <>
            <span className="cl-lives" aria-label={`${run.lives} of ${LIVES} lives left`}>
              {Array.from({ length: LIVES }, (_, i) => (
                <i key={i} className={i < run.lives ? 'is-on' : ''} />
              ))}
            </span>
            {state.status === 'play' && (
              <button className="cl-chip-btn" onClick={props.onEndRun}>
                End run
              </button>
            )}
          </>
        ) : run.mode === 'daily' ? (
          <ol className="cl-pips" aria-hidden="true">
            {Array.from({ length: DAILY_LEVELS }, (_, i) => (
              <li key={i} className={i === run.step ? 'is-now' : i < run.results.length ? 'is-done' : ''} />
            ))}
          </ol>
        ) : null}
        <GameMenuButton className="cl-icon-btn" style={{ marginLeft: 'auto' }} />
      </div>

      <div className="cl-toolbar">
        <button
          className={`cl-tool cl-tool-hint${thinking ? ' is-busy' : ''}`}
          onClick={askHint}
          aria-label={thinking ? 'Working out a hint' : 'Hint (costs 2 points)'}
          aria-busy={thinking}
          title="Hint (H, −2)"
          disabled={state.status !== 'play'}
        >
          ?
        </button>
        <button className="cl-tool cl-tool-spare" onClick={spare} aria-label="Add a spare tube (costs 3 points)" title="Spare tube (−3)" disabled={state.spare || state.status !== 'play'}>
          +
        </button>
        <div className={`cl-moves${limitLeft !== null && limitLeft <= 2 ? ' is-tight' : ''}`} aria-live="polite">
          <small>{limitLeft !== null ? 'Moves left' : 'Moves'}</small>
          <b className="cl-mono">{limitLeft !== null ? limitLeft : state.moves}</b>
          <small>par {state.level.par}</small>
        </div>
        <button className="cl-tool cl-tool-restart" onClick={restart} aria-label="Restart puzzle" title="Restart (Shift+R)" disabled={state.status !== 'play'}>
          ↻
        </button>
        <button className="cl-tool cl-tool-undo" onClick={undo} aria-label="Undo" title="Undo (U)" disabled={!state.history.length || state.status !== 'play'}>
          ↶
        </button>
      </div>

      <div className={`cl-board${props.save.patterns ? ' has-patterns' : ''}${hint && hint.from >= 0 ? ' has-hint' : ''}`} ref={boardRef} style={layout} role="group" aria-label="Tubes">
        {state.board.map((tube, i) => {
          const a = anim && anim.from === i ? anim : null;
          const style: CSSProperties = { '--cap': tube.cap } as CSSProperties;
          if (a && a.phase !== 'back') style.transform = `translate(${a.dx}px, ${a.dy}px) rotate(${a.tilt}deg)`;
          const isHint = hint && (hint.from === i || hint.to === i);
          return (
            <button
              key={i}
              ref={(el) => {
                tubeRefs.current[i] = el;
              }}
              className={[
                'cl-tube',
                selected === i ? 'is-up' : '',
                shake === i ? 'is-shake' : '',
                a ? 'is-pouring' : '',
                done[i] ? 'is-done' : '',
                isHint ? (hint!.from === i ? 'is-hint-from' : 'is-hint-to') : '',
                almost?.target === i ? 'is-target' : '',
              ].join(' ')}
              style={style}
              onClick={() => tap(i)}
              aria-label={tubeLabel(state, i, done[i]!)}
              aria-pressed={selected === i}
              aria-keyshortcuts={TUBE_KEYS[i]}
            >
              <span className="cl-glass">
                {tube.layers.map((c, j) =>
                  isHidden(state, i, j) ? (
                    <i key={j} className="cl-layer is-hidden">
                      ?
                    </i>
                  ) : (
                    <i key={j} className={`cl-layer cl-c${state.level.palette[c]} cl-pat`} />
                  ),
                )}
              </span>
              {anim && anim.to === i && anim.phase === 'pour' && <span className={`cl-stream cl-c${state.level.palette[anim.color]}`} aria-hidden="true" />}
              {done[i] && <span className="cl-cork" aria-hidden="true" />}
              {almost?.target === i && <span className="cl-cork is-ghost" aria-hidden="true" />}
              {TUBE_KEYS[i] && (
                <kbd className="cl-key" aria-hidden="true">
                  {TUBE_KEYS[i]!.toUpperCase()}
                </kbd>
              )}
            </button>
          );
        })}
      </div>

      {props.save.solved < 3 && state.status === 'play' && !hint && !note && (
        <p className="cl-coach" aria-live="polite">
          {selected === null
            ? 'Tap a tube to pick up its top color.'
            : 'Now tap where to pour: onto the same color, or into an empty tube.'}
        </p>
      )}
      {note}
      {soft && <p className="cl-note cl-note-soft">{soft}</p>}

      {state.status !== 'play' && <LevelDone run={run} state={state} loading={props.loading} onNext={props.onNext} onEndRun={props.onEndRun} />}
    </div>
  );
}

function tubeLabel(s: LevelState, i: number, done: boolean): string {
  const t = s.board[i]!;
  if (!t.layers.length) return `Tube ${i + 1}, empty, holds ${t.cap}`;
  const shown = t.layers.map((c, j) => (isHidden(s, i, j) ? 'hidden' : COLOR_NAMES[s.level.palette[c]!] ?? 'color'));
  return `Tube ${i + 1}${done ? ', complete' : ''}: ${shown.join(', ')} (bottom to top), ${t.layers.length} of ${t.cap}`;
}

const COLOR_NAMES = ['red', 'yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'sky blue', 'lime', 'brown', 'teal', 'white', 'charcoal', 'maroon', 'lavender', 'gold'];

function LevelDone({ run, state, loading, onNext, onEndRun }: { run: Run; state: LevelState; loading: boolean; onNext: () => void; onEndRun: () => void }) {
  const r = resultOf(state);
  const won = state.status === 'won';
  const btn = loading
    ? 'Mixing the next puzzle…'
    : run.over || (run.mode === 'daily' && run.results.length >= DAILY_LEVELS)
      ? 'See results'
      : !won
        ? 'Try again'
        : run.mode === 'practice'
          ? 'Next puzzle →'
          : 'Next level →';
  const lostLife = run.mode === 'endless' && won && r.moves > r.par + ENDLESS_SLACK;
  const bonus = run.challenge ? underParBonus([r]) : 0;
  const quick = !state.level.parOptimal && !state.level.parSlack;
  return (
    <div className="cl-done" role="dialog" aria-label={won ? 'Puzzle solved' : 'Out of moves'}>
      {won ? (
        <>
          <Stars n={r.stars} size="lg" />
          <h2>{r.moves < r.par ? 'Under par!' : r.moves === r.par ? (r.hints || r.spare ? 'Solved at par' : 'Par! Perfect.') : 'Solved!'}</h2>
          <p className="cl-done-line cl-mono">
            {r.moves} moves · par {r.par}
            {quick && <abbr title="Par found by a quick search: you may beat it">*</abbr>}
          </p>
          {quick && <p className="cl-muted cl-small">* Par found by a quick search: you may beat it.</p>}
          {state.level.parSlack ? <p className="cl-muted cl-small">Par includes {state.level.parSlack} extra moves for the hidden layers.</p> : null}
          {run.mode !== 'practice' && (
            <p className="cl-done-points">
              <b className="cl-mono">+{r.points}</b> / {MAX_POINTS}
              {bonus ? ` · +${bonus} for moves under par` : ''}
              {r.hints ? ` · ${r.hints} hint${r.hints > 1 ? 's' : ''}` : ''}
              {r.spare ? ' · spare tube' : ''}
            </p>
          )}
          {lostLife && <p className="cl-warn">More than {ENDLESS_SLACK} over par: one life lost.</p>}
        </>
      ) : (
        <>
          <h2>Out of moves</h2>
          <p className="cl-done-line">Par was {r.par}. {run.lives > 0 ? 'One life lost. Try it again.' : 'That was your last life.'}</p>
        </>
      )}
      <div className="cl-row cl-done-row">
        {(run.mode === 'endless' || run.mode === 'precision') && !run.over && (
          <button className="cl-btn cl-btn-ghost" onClick={onEndRun} disabled={loading}>
            End run
          </button>
        )}
        <button className="cl-btn cl-btn-go cl-btn-big" onClick={onNext} disabled={loading} autoFocus>
          {btn}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- summary */

function Summary({ run, save, fromDaily, onMenu, onAgain }: { run: Run; save: ClSave; fromDaily: boolean; onMenu: () => void; onAgain: () => void }) {
  const total = totalPoints(run.results);
  const streak = clStats(save, run.day).streak;
  const solved = run.results.filter((r) => r.solved).length;
  const bonus = run.challenge ? underParBonus(run.results) : 0;
  const title =
    run.challenge ? '⚔️ Challenge round complete' : run.mode === 'daily' ? `Daily #${dailyNumber(run.day)} complete` : run.mode === 'endless' ? 'Endless run over' : run.mode === 'precision' ? 'Par Challenge over' : 'Practice';
  return (
    <div className="cl-summary">
      <span className="cl-kicker">{title}</span>
      {fromDaily && <p className="cl-note cl-note-soft">You already played this daily: your daily result counts here.</p>}
      {run.challenge ? (
        <p className="cl-summary-score">
          <b className="cl-mono">{challengeScore(run.results)}</b>
          <span>points</span>
        </p>
      ) : run.mode === 'daily' ? (
        <p className="cl-summary-score">
          <b className="cl-mono">{total}</b>
          <span>/ {DAILY_LEVELS * MAX_POINTS}</span>
        </p>
      ) : (
        <p className="cl-summary-score">
          <b className="cl-mono">{solved}</b>
          <span>{solved === 1 ? 'level' : 'levels'}</span>
        </p>
      )}
      <p className="cl-muted">
        {totalStars(run.results)} ★ · {total} points
        {bonus ? ` + ${bonus} for moves under par` : ''}
        {run.mode === 'daily' && !run.challenge && streak > 0 ? ` · 🔥 ${streak}` : ''}
        {run.mode === 'endless' ? ` · best ${save.endless.bestLevels}` : run.mode === 'precision' ? ` · best ${save.precision.bestLevels}` : ''}
      </p>
      {(run.mode === 'daily' || run.challenge) && <ResultLine line={resultLine(run.results)} label={`${totalStars(run.results)} of ${run.results.length * 3} stars`} />}
      <ul className="cl-summary-list">
        {run.results.map((r, i) => (
          <li key={i}>
            <span className="cl-summary-n cl-mono">{i + 1}</span>
            <Stars n={r.stars} />
            <span className="cl-summary-moves cl-mono">
              {r.solved ? `${r.moves} moves` : 'not solved'} <small className="cl-muted">par {r.par}</small>
            </span>
            <b className="cl-mono">{r.points}</b>
          </li>
        ))}
      </ul>
      <div className="cl-row">
        {run.challenge ? (
          <a className="cl-btn cl-btn-go" href={`/c/${run.challenge.id}`} onClick={openChallengeScores}>
            See the scoreboard
          </a>
        ) : run.mode === 'daily' ? (
          <ShareButton label={`#${dailyNumber(run.day)}`} results={run.results} streak={streak} />
        ) : (
          <button className="cl-btn cl-btn-go" onClick={onAgain}>
            Play again
          </button>
        )}
        <button className="cl-btn cl-btn-ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
