import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, msUntilMidnight, parseDayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import {
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
  type LevelAction,
  type LevelResult,
  type LevelState,
  type Mode,
} from './rules';
import { DAILY_LEVELS, dailyLevel, dailyNumber, ladderLevel, makeLevel, rng, specFor, type Level } from './levels';
import { doneTubes, hint, pourAmount, type Move } from './sort';
import { createSfx, type Sfx } from './sound';
import { clStats, isComplete, loadCl, recordEndless, recordLevel, recordPrecision, saveCl, type ClSave, type PracticeSize } from './store';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';

const PRACTICE: { id: PracticeSize; label: string; note: string; step: number }[] = [
  { id: 'small', label: 'Small', note: '4 colors', step: 1 },
  { id: 'medium', label: 'Medium', note: '5 colors', step: 3 },
  { id: 'large', label: 'Large', note: '7 colors', step: 5 },
  { id: 'huge', label: 'Huge', note: '9 colors', step: 8 },
];
const TUBE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w', 'e', 'r'];
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
  /** Level number within the run (0-based). */
  step: number;
  results: LevelResult[];
  lives: number;
  seed: number;
  practiceStep: number;
  over: boolean;
  /** A friends' challenge: five daily-style levels from the challenge's seed (mode stays 'daily'). */
  challenge?: { id: string; round: number };
}

function levelFor(run: Run, today: string): Level {
  if (run.challenge) return dailyLevel(`challenge-${run.seed}`, run.step);
  if (run.mode === 'daily') return dailyLevel(today, run.step);
  if (run.mode === 'practice') {
    const r = rng(run.seed + run.step * 7919);
    return makeLevel(r, specFor(run.practiceStep, r));
  }
  return ladderLevel(run.seed + run.step * 7919, run.step);
}

function ColorLab({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: GameModuleProps['challenge'] }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<ClSave>(loadCl);
  const [firstRun] = useState<Run | null>(() =>
    challenge ? { mode: 'daily', step: 0, results: [], lives: LIVES, seed: challenge.seed, practiceStep: 3, over: false, challenge: { id: challenge.id, round: challenge.round } } : null,
  );
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  const [run, setRun] = useState<Run | null>(firstRun);
  const [level, setLevel] = useState<LevelState | null>(() => (firstRun ? startLevel(levelFor(firstRun, today), 'daily') : null));
  useEffect(() => {
    if (challenge) host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rootRef = useRef<HTMLDivElement>(null);

  const saveRef = useRef(save);
  const commit = useCallback(
    (next: ClSave) => {
      saveRef.current = next;
      setSave(next);
      saveCl(next, today);
    },
    [today],
  );

  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  useEffect(() => {
    rootRef.current?.scrollTo?.({ top: 0 });
  }, [screen, run?.step, run?.over]);

  const begin = (r: Run): void => {
    setRun(r);
    setLevel(r.over ? null : startLevel(levelFor(r, today), r.mode));
    setScreen('play');
  };

  const start = (mode: Mode): void => {
    const base: Run = { mode, step: 0, results: [], lives: LIVES, seed: randomSeed(), practiceStep: 3, over: false };
    if (mode === 'daily') {
      const done = save.daily[today] ?? [];
      begin({ ...base, step: done.length, results: done, over: isComplete(done) });
      if (!isComplete(done)) host.report({ type: 'start' });
      return;
    }
    if (mode === 'practice') {
      begin({ ...base, practiceStep: PRACTICE.find((p) => p.id === save.practice.size)?.step ?? 3 });
      return;
    }
    host.report({ type: 'start' });
    begin(base);
  };

  /** A level was won (or failed in Precision): record it and work out what the run does next. */
  const finishLevel = (lv: LevelState): void => {
    if (!run) return;
    const result = resultOf(lv);
    let s = recordLevel(saveRef.current, result, run.mode === 'daily' && !run.challenge ? today : null, run.mode === 'practice');
    let next: Run;
    if (run.mode === 'daily') {
      next = { ...run, results: [...run.results, result] };
      if (next.results.length >= DAILY_LEVELS) {
        next = { ...next, over: true };
        reportEnd(host, 'daily', next.results, run.challenge);
      }
    } else if (run.mode === 'endless') {
      const lost = result.moves > result.par + ENDLESS_SLACK ? 1 : 0;
      next = { ...run, results: [...run.results, result], lives: run.lives - lost };
      if (next.lives <= 0) {
        next = { ...next, over: true };
        reportEnd(host, 'endless', next.results);
        s = recordEndless(s, next.results);
      }
    } else if (run.mode === 'precision') {
      if (result.solved) next = { ...run, results: [...run.results, result] };
      else {
        next = { ...run, lives: run.lives - 1 };
        if (next.lives <= 0) {
          next = { ...next, over: true };
          reportEnd(host, 'precision', next.results);
          s = recordPrecision(s, next.results);
        }
      }
    } else next = { ...run, results: [...run.results, result] };
    commit(s);
    setRun(next);
  };

  const nextLevel = (): void => {
    if (!run || !level) return;
    if (run.over) {
      setLevel(null);
      return;
    }
    // Precision failure: try the same level again.
    if (run.mode === 'precision' && level.status === 'failed') {
      setLevel(startLevel(level.level, 'precision'));
      return;
    }
    const r = { ...run, step: run.step + 1 };
    setRun(r);
    setLevel(startLevel(levelFor(r, today), r.mode));
  };

  return (
    <div className="cl" data-screen={screen} ref={rootRef}>
      {screen === 'menu' && (
        <Menu
          today={today}
          save={save}
          onStart={start}
          onStats={() => setScreen('stats')}
          onSize={(size) => commit({ ...saveRef.current, practice: { ...saveRef.current.practice, size } })}
          onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })}
          onPatterns={() => commit({ ...saveRef.current, patterns: !saveRef.current.patterns })}
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
              today={today}
              save={save}
              sfx={sfx}
              pauseKey={pauseKey}
              onChange={setLevel}
              onFinish={finishLevel}
              onNext={nextLevel}
              onMenu={() => setScreen('menu')}
            />
          ) : (
            <Summary run={run} today={today} save={save} onMenu={() => setScreen('menu')} onAgain={() => start(run.mode)} />
          )}
        </>
      )}
    </div>
  );
}

/** The one place a finished run is reported (`daily: true` only for today's daily). */
function reportEnd(host: GameHost, mode: Mode, rs: readonly LevelResult[], challenge?: Run['challenge']): void {
  const end = endStats(mode, rs);
  host.report(challenge ? { type: 'end', ...end, challenge } : mode === 'daily' ? { type: 'end', ...end, daily: true } : { type: 'end', ...end });
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
      </div>
      <Wordmark />
      <p className="cl-tagline">Pour the colors until every tube holds just one. Fewer moves, more points.</p>

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

function runLabel(run: Run, today: string): string {
  if (run.challenge) return `⚔️ Challenge · ${run.step + 1}/${DAILY_LEVELS}`;
  if (run.mode === 'daily') return `Daily #${dailyNumber(today)} · ${run.step + 1}/${DAILY_LEVELS}`;
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
        const u = Math.min(tw * 0.9, (h / rows - 44) / maxCap, 60);
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

function Play(props: {
  run: Run;
  state: LevelState;
  today: string;
  save: ClSave;
  sfx: () => Sfx;
  pauseKey?: number;
  onChange: (s: LevelState) => void;
  onFinish: (s: LevelState) => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const { run, state, sfx, onChange, onFinish } = props;
  const [selected, setSelected] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [hinted, setHinted] = useState<Move | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const tubeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (ms: number, f: () => void): void => {
    timers.current.push(window.setTimeout(f, ms));
  };

  const maxCap = Math.max(...state.board.map((t) => t.cap));
  const layout = useBoardLayout(boardRef, state.board.length, maxCap);
  const done = doneTubes(state.board);

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
      // Tapping another tube with colour in it picks that one up instead.
      setSelected(s.board[i]?.layers.length ? i : null);
      return;
    }
    const from = selected;
    setSelected(null);
    setHinted(null);
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
    setHinted(null);
    apply({ type: 'restart' });
  };
  const spare = (): void => {
    if (busy.current || state.spare) return;
    apply({ type: 'spare' });
    sfx().lift();
  };
  const askHint = (): void => {
    if (busy.current || stateRef.current.status !== 'play') return;
    const m = hint(stateRef.current.board);
    if (!m) {
      setHinted({ from: -1, to: -1 });
      return;
    }
    apply({ type: 'hint' });
    setSelected(null);
    setHinted(m);
  };

  // Keyboard: number keys pick tubes, U / Backspace undo, R restart, H hint, Enter next.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const onKeyNow = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const s = stateRef.current;
    if (e.key === 'Enter' && s.status !== 'play') {
      e.preventDefault();
      props.onNext();
      return;
    }
    if (s.status !== 'play') return;
    if (e.key === 'Backspace' || e.key === 'u') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') setSelected(null);
    else if (e.key === 'h') askHint();
    else if (e.key === 'R') restart();
    else {
      const i = TUBE_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && i < s.board.length) tap(i);
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

  return (
    <div className="cl-play">
      <div className="cl-top">
        <button className="cl-icon-btn" onClick={props.onMenu} aria-label="Back to menu">
          ←
        </button>
        <span className="cl-kicker">{runLabel(run, props.today)}</span>
        {run.mode === 'endless' || run.mode === 'precision' ? (
          <span className="cl-lives" aria-label={`${run.lives} of ${LIVES} lives left`}>
            {Array.from({ length: LIVES }, (_, i) => (
              <i key={i} className={i < run.lives ? 'is-on' : ''} />
            ))}
          </span>
        ) : run.mode === 'daily' ? (
          <ol className="cl-pips" aria-hidden="true">
            {Array.from({ length: DAILY_LEVELS }, (_, i) => (
              <li key={i} className={i === run.step ? 'is-now' : i < run.results.length ? 'is-done' : ''} />
            ))}
          </ol>
        ) : null}
      </div>

      <div className="cl-toolbar">
        <button className="cl-tool cl-tool-hint" onClick={askHint} aria-label="Hint (costs 2 points)" title="Hint (−2)" disabled={state.status !== 'play'}>
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

      <div className={`cl-board${props.save.patterns ? ' has-patterns' : ''}`} ref={boardRef} style={layout} role="group" aria-label="Tubes">
        {state.board.map((tube, i) => {
          const a = anim && anim.from === i ? anim : null;
          const style: CSSProperties = { '--cap': tube.cap } as CSSProperties;
          if (a && a.phase !== 'back') style.transform = `translate(${a.dx}px, ${a.dy}px) rotate(${a.tilt}deg)`;
          const isHint = hinted && (hinted.from === i || hinted.to === i);
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
                isHint ? (hinted!.from === i ? 'is-hint-from' : 'is-hint-to') : '',
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
            </button>
          );
        })}
      </div>

      {props.save.solved < 3 && state.status === 'play' && !hinted && !isStuck && (
        <p className="cl-coach" aria-live="polite">
          {selected === null
            ? 'Tap a tube to pick up its top color.'
            : 'Now tap where to pour: onto the same color, or into an empty tube.'}
        </p>
      )}
      {hinted && hinted.from < 0 && <p className="cl-note">No way forward from here. Undo a few moves or restart.</p>}
      {isStuck && !hinted && <p className="cl-note">No moves left. Undo or restart.</p>}
      {state.level.mystery && state.status === 'play' && <p className="cl-note cl-note-soft">Mystery puzzle: hidden layers show once they reach the top.</p>}

      {state.status !== 'play' && <LevelDone run={run} state={state} onNext={props.onNext} />}
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

function LevelDone({ run, state, onNext }: { run: Run; state: LevelState; onNext: () => void }) {
  const r = resultOf(state);
  const won = state.status === 'won';
  const btn =
    run.over || (run.mode === 'daily' && run.results.length >= DAILY_LEVELS)
      ? 'See results'
      : !won
        ? 'Try again'
        : run.mode === 'practice'
          ? 'Next puzzle →'
          : 'Next level →';
  const lostLife = run.mode === 'endless' && won && r.moves > r.par + ENDLESS_SLACK;
  return (
    <div className="cl-done" role="dialog" aria-label={won ? 'Puzzle solved' : 'Out of moves'}>
      {won ? (
        <>
          <Stars n={r.stars} size="lg" />
          <h2>{r.moves < r.par ? 'Under par!' : r.moves === r.par ? (r.hints || r.spare ? 'Solved at par' : 'Par! Perfect.') : 'Solved!'}</h2>
          <p className="cl-done-line cl-mono">
            {r.moves} moves · par {r.par}
            {state.level.parOptimal ? '' : '*'}
          </p>
          {run.mode !== 'practice' && (
            <p className="cl-done-points">
              <b className="cl-mono">+{r.points}</b> / {MAX_POINTS}
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
      <button className="cl-btn cl-btn-go cl-btn-big" onClick={onNext} autoFocus>
        {btn}
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- summary */

function Summary({ run, today, save, onMenu, onAgain }: { run: Run; today: string; save: ClSave; onMenu: () => void; onAgain: () => void }) {
  const total = totalPoints(run.results);
  const streak = clStats(save, today).streak;
  const solved = run.results.filter((r) => r.solved).length;
  const title =
    run.challenge ? '⚔️ Challenge round complete' : run.mode === 'daily' ? `Daily #${dailyNumber(today)} complete` : run.mode === 'endless' ? 'Endless run over' : run.mode === 'precision' ? 'Par Challenge over' : 'Practice';
  return (
    <div className="cl-summary">
      <span className="cl-kicker">{title}</span>
      {run.mode === 'daily' ? (
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
          <ShareButton label={`#${dailyNumber(today)}`} results={run.results} streak={streak} />
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
