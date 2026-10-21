import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { Coach, useCoach } from '../../components/Coach';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { conflicts, DAILY_SIZES, fmtTime, makePuzzle, nextMark, resultLine, solved, solvePoints, type Mark, type Puzzle, type Tool } from './logic';
import { createSfx, type Sfx } from './sound';
import { COACH } from './coach';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.star-grid';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  times: number[];
  /** true: started, not finished (it resumes from `progress`); false: left, could not be resumed, settled. */
  open?: boolean;
}
/** Today's grids so far, saved as you go (`secs`: time on the current grid). */
interface Progress {
  day: string;
  i: number;
  marks: Mark[];
  times: number[];
  points: number;
  phase: 'play' | 'solved';
  secs: number;
}
interface Save {
  best: number;
  solved: number;
  size: number;
  daily: Record<string, DailyRecord>;
  progress?: Progress;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, solved: 0, size: 7, daily: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.solved = n(o.solved);
    s.size = [6, 7, 8, 9].includes(n(o.size)) ? n(o.size) : 7;
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object')
          s.daily[d] = { best: n(v.best), tries: n(v.tries), times: Array.isArray(v.times) ? v.times.slice(0, 3).map(n) : [], ...(typeof v.open === 'boolean' ? { open: v.open } : {}) };
    if (o.progress && validProgress(o.progress)) s.progress = o.progress;
    return s;
  } catch {
    return emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const seconds0 = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function validProgress(p: Progress): boolean {
  const size = DAILY_SIZES[p.i];
  return (
    typeof p.day === 'string' &&
    size !== undefined &&
    (p.phase === 'play' || p.phase === 'solved') &&
    Array.isArray(p.marks) &&
    p.marks.length === size * size &&
    p.marks.every((m) => m === 0 || m === 1 || m === 2) &&
    Array.isArray(p.times) &&
    p.times.length === p.i + (p.phase === 'solved' ? 1 : 0) &&
    p.times.every(seconds0) &&
    seconds0(p.points) &&
    seconds0(p.secs)
  );
}
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;
const now = (): number => performance.now();

interface Round {
  puzzles: Puzzle[];
  i: number;
  marks: Mark[];
  times: number[];
  points: number;
  phase: 'play' | 'solved' | 'done';
}

const roundFor = (puzzles: Puzzle[]): Round => ({ puzzles, i: 0, marks: new Array<Mark>(puzzles[0]!.size ** 2).fill(0), times: [], points: 0, phase: 'play' });

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <StarGrid key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function StarGrid({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood (0), so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const cur = saveRef.current;
    const rec = cur.daily[today];
    if (!rec?.open || cur.progress?.day === today) return;
    commit({ ...cur, daily: { ...cur.daily, [today]: { ...rec, open: false } } });
    host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [round, setRound] = useState<Round | null>(() => (challenge ? roundFor([makePuzzle(challenge.seed, 8)]) : null));
  const roundRef = useRef(round);
  const [cursor, setCursor] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [paused, setPaused] = useState(false);
  const [newBest, setNewBest] = useState(false);
  // Time: seconds banked on this puzzle, plus the running stretch since `since` (null = stopped).
  // The clock starts as soon as a grid is on screen, so nobody can solve it before the first tap.
  const banked = useRef(0);
  const since = useRef<number | null>(null);
  const started = useRef(false);
  const paint = useRef<{ to: Mark; from: Mark } | null>(null);
  const [tool, setTool] = useState<Tool>('star');
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  // A friends' challenge opens straight on its grid: its clock starts now.
  useEffect(() => {
    if (roundRef.current && since.current === null) since.current = now();
  }, []);

  const show = (r: Round | null): void => {
    roundRef.current = r;
    setRound(r);
  };
  const seconds = (): number => banked.current + (since.current === null ? 0 : (now() - since.current) / 1000);

  const begin = (m: Mode, size = saveRef.current.size): void => {
    // Today's daily is one try: starting it uses the try up. Leaving it halfway (pause, reload) is
    // fine, it carries on with the same marks and clock, but it can never be started over.
    const cur = saveRef.current;
    const kept = m === 'daily' && cur.daily[today]?.open && cur.progress?.day === today ? cur.progress : null;
    if (m === 'daily' && !kept) {
      if (cur.daily[today]) return;
      commit({ ...cur, daily: { ...cur.daily, [today]: { best: 0, tries: 1, times: [], open: true } }, progress: { day: today, i: 0, marks: new Array<Mark>(DAILY_SIZES[0]! ** 2).fill(0), times: [], points: 0, phase: 'play', secs: 0 } });
    }
    const puzzles =
      m === 'challenge' && challenge
        ? [makePuzzle(challenge.seed, 8)]
        : m === 'daily'
          ? DAILY_SIZES.map((s) => makePuzzle(hashString(`star-grid:${today}:${s}`), s))
          : [makePuzzle(randomSeed(), size)];
    if (m === 'endless' && size !== saveRef.current.size) commit({ ...saveRef.current, size });
    started.current = false;
    banked.current = kept?.phase === 'play' ? kept.secs : 0;
    since.current = !kept || kept.phase === 'play' ? now() : null;
    setClock(banked.current);
    setPaused(false);
    setMode(m);
    setNewBest(false);
    setCursor(null);
    show(kept ? { puzzles, i: kept.i, marks: kept.marks.slice(), times: kept.times.slice(), points: kept.points, phase: kept.phase } : roundFor(puzzles));
  };

  /** Saves today's grids as they go, so leaving (pause, reload) carries on from here. */
  const keep = (r: Round): void => {
    if (mode !== 'daily' || r.phase === 'done') return;
    commit({ ...saveRef.current, progress: { day: today, i: r.i, marks: r.marks, times: r.times, points: r.points, phase: r.phase, secs: r.phase === 'play' ? Math.round(seconds() * 10) / 10 : 0 } });
  };

  const finish = (r: Round): void => {
    const total = r.times.reduce((a, b) => a + b, 0);
    const cur = saveRef.current;
    setNewBest(r.points > cur.best);
    commit({
      ...cur,
      best: Math.max(cur.best, r.points),
      solved: cur.solved + r.puzzles.length,
      daily: mode === 'daily' ? { ...cur.daily, [today]: { best: r.points, tries: 1, times: r.times.map(Math.round) } } : cur.daily,
      progress: mode === 'daily' ? undefined : cur.progress,
    });
    const stats: Record<string, number> = mode === 'daily' ? { time: Math.round(total) } : {};
    const end = { type: 'end' as const, score: r.points, stats };
    host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
  };

  /** Sets one cell's mark; checks for a finished grid. */
  const setMark = (i: number, m: Mark): void => {
    const r = roundRef.current;
    if (!r || r.phase !== 'play' || r.marks[i] === m) return;
    if (!started.current) {
      started.current = true;
      host.report({ type: 'start' });
    }
    if (since.current === null && !paused) since.current = now();
    const marks = r.marks.slice();
    marks[i] = m;
    const p = r.puzzles[r.i]!;
    if (m === 2) {
      if (conflicts(p, marks).has(i)) sfx().clash();
      else sfx().star();
    } else sfx().mark();
    if (!solved(p, marks)) {
      const next: Round = { ...r, marks };
      show(next);
      return keep(next);
    }
    // Solved: stop the clock, score it.
    const secs = seconds();
    banked.current = 0;
    since.current = null;
    setClock(0);
    const times = [...r.times, secs];
    const points = r.points + solvePoints(p.size, secs);
    sfx().solved();
    const last = r.i + 1 >= r.puzzles.length;
    const next: Round = { ...r, marks, times, points, phase: last ? 'done' : 'solved' };
    show(next);
    if (last) finish(next);
    else keep(next);
  };

  const nextPuzzle = (): void => {
    const r = roundRef.current;
    if (!r || r.phase !== 'solved') return;
    const size = r.puzzles[r.i + 1]!.size;
    setCursor(null);
    since.current = now();
    const next: Round = { ...r, i: r.i + 1, marks: new Array<Mark>(size * size).fill(0), phase: 'play' };
    show(next);
    keep(next);
  };

  // Today's grids also save the clock every few seconds.
  const ticking = mode === 'daily' && round?.phase === 'play' && !paused;
  useEffect(() => {
    if (!ticking) return;
    const t = window.setInterval(() => roundRef.current && keep(roundRef.current), 2000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticking]);

  // The running clock on screen.
  useEffect(() => {
    if (round?.phase !== 'play' || paused) return;
    const t = window.setInterval(() => setClock(seconds()), 250);
    return () => window.clearInterval(t);
  }, [round?.phase, round?.i, paused]);

  const pauseNow = (): void => setPaused(true);
  // Pausing banks the running stretch, so the clock stands still.
  useEffect(() => {
    if (!paused || since.current === null) return;
    banked.current = seconds();
    since.current = null;
    if (roundRef.current) keep(roundRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  const resume = (): void => {
    setPaused(false);
    if (roundRef.current?.phase === 'play') since.current = now();
  };
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (round?.phase === 'play' && !paused) setPaused(true);
  }

  // A tap puts a star down or takes it back; with the ✕ tool (or a right-click) it crosses the square out
  // instead, and dragging crosses out (or clears) more squares. Stars are never painted by a drag.
  const cellAt = (x: number, y: number): number | null => {
    // The star or ✕ glyph can be the element under the pointer: look up to its square.
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-cell]');
    const i = el?.dataset.cell;
    return i === undefined ? null : Number(i);
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>): void => {
    const r = roundRef.current;
    const i = cellAt(e.clientX, e.clientY);
    if (!r || r.phase !== 'play' || i === null || paused) return;
    e.preventDefault();
    const use: Tool = e.button === 2 ? 'cross' : tool;
    const to = nextMark(r.marks[i]!, use);
    paint.current = use === 'cross' ? { from: to === 1 ? 0 : 1, to } : null;
    setMark(i, to);
    // A release outside the grid still ends the drag.
    window.addEventListener(
      'pointerup',
      () => {
        paint.current = null;
      },
      { once: true },
    );
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>): void => {
    const p = paint.current;
    if (!p || (e.pointerType === 'mouse' && e.buttons === 0)) return;
    const i = cellAt(e.clientX, e.clientY);
    const r = roundRef.current;
    if (i !== null && r && r.marks[i] === p.from) setMark(i, p.to);
  };
  const onUp = (): void => {
    paint.current = null;
  };

  useEffect(() => {
    if (!round) return;
    const onKey = (e: KeyboardEvent): void => {
      const r = roundRef.current;
      if (!r) return;
      const size = r.puzzles[r.i]!.size;
      if (r.phase === 'play' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        e.preventDefault();
        return paused ? resume() : pauseNow();
      }
      // While paused the grid is hidden: no moves until play resumes.
      if (paused) return;
      if (r.phase === 'solved' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        return nextPuzzle();
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const c = cursor ?? 0;
        const row = Math.floor(c / size) + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
        const col = (c % size) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
        setCursor(Math.max(0, Math.min(size - 1, row)) * size + Math.max(0, Math.min(size - 1, col)));
        return;
      }
      if (cursor === null || r.phase !== 'play') return;
      if (e.key === ' ') setMark(cursor, nextMark(r.marks[cursor]!, tool));
      else if (e.key === 'x' || e.key === 'X') setMark(cursor, r.marks[cursor] === 1 ? 0 : 1);
      else if (e.key === 'Enter' || e.key === 's' || e.key === 'S') setMark(cursor, r.marks[cursor] === 2 ? 0 : 2);
      else if (e.key === 'Backspace' || e.key === 'Delete') setMark(cursor, 0);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!round) return <Menu save={save} today={today} onPlay={begin} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />;

  const p = round.puzzles[round.i]!;
  const bad = conflicts(p, round.marks);
  const daily = save.daily[today];
  const shown = round.phase === 'play' ? clock : round.times[round.times.length - 1] ?? 0;
  const border = (i: number, j: number): boolean => j < 0 || j >= p.size * p.size || p.regions[i] !== p.regions[j];

  return (
    <div className="sgd">
      <div className="sgd-hud" aria-live="polite">
        <span className="game-menu-pair">
        <button className="sgd-icon" onClick={() => (round.phase === 'done' ? show(null) : paused ? resume() : pauseNow())} aria-label={round.phase === 'done' ? 'Menu' : paused ? 'Resume' : 'Pause'}>
          {round.phase === 'done' ? '☰' : paused ? '▶' : 'II'}
        </button>
        <GameMenuButton className="sgd-icon" />
        </span>
        <div className="sgd-mid">
          <b>{fmtTime(shown)}</b>
          <span>
            {mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : mode === 'daily' ? `Daily #${dailyNumber(today)} · ${round.i + 1} of ${round.puzzles.length}` : `Endless · ${p.size}×${p.size}`}
          </span>
        </div>
        <div className="sgd-count" aria-label={`${round.marks.filter((m) => m === 2).length} of ${p.size} stars`}>
          ⭐ {round.marks.filter((m) => m === 2).length}/{p.size}
        </div>
      </div>
      <div
        className={`sgd-board${round.phase !== 'play' ? ' is-solved' : ''}`}
        style={{ ['--n' as string]: p.size }}
        role="grid"
        aria-label={`${p.size} by ${p.size} star grid`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {round.marks.map((m, i) => {
          const row = Math.floor(i / p.size);
          const col = i % p.size;
          const cls = [
            'sgd-cell',
            `is-r${p.regions[i]}`,
            border(i, i - p.size) || row === 0 ? 'b-t' : '',
            border(i, i + p.size) || row === p.size - 1 ? 'b-b' : '',
            col === 0 || border(i, i - 1) ? 'b-l' : '',
            col === p.size - 1 || border(i, i + 1) ? 'b-r' : '',
            m === 2 && bad.has(i) ? 'is-bad' : '',
            cursor === i ? 'is-cursor' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={i} data-cell={i} className={cls} role="gridcell" aria-label={`Row ${row + 1}, column ${col + 1}: ${m === 2 ? 'star' : m === 1 ? 'crossed out' : 'empty'}`}>
              {m === 2 ? <i className="sgd-star">★</i> : m === 1 ? <i className="sgd-x">✕</i> : null}
            </div>
          );
        })}
      </div>
      <div className="sgd-tools" role="radiogroup" aria-label="What a tap does">
        <button className={`sgd-tool${tool === 'star' ? ' is-on' : ''}`} role="radio" aria-checked={tool === 'star'} onClick={() => setTool('star')}>
          ⭐ Star
        </button>
        <button className={`sgd-tool${tool === 'cross' ? ' is-on' : ''}`} role="radio" aria-checked={tool === 'cross'} onClick={() => setTool('cross')}>
          ✕ Cross out
        </button>
      </div>
      <p className="sgd-help">
        One ⭐ in every row, column and color, and stars can’t touch, not even at the corners. {tool === 'star' ? 'Tap a square for a star, tap again to take it back.' : 'Tap or drag to cross out squares that can’t hold a star.'}
        <span className="sgd-mouse"> Right-click crosses out too.</span>
      </p>
      {paused && round.phase === 'play' && (
        <button className="sgd-overlay" onClick={resume}>
          Paused · tap to continue
        </button>
      )}
      {round.phase === 'solved' && (
        <button className="sgd-banner" onClick={nextPuzzle} autoFocus>
          <b>Solved in {fmtTime(round.times[round.times.length - 1]!)}!</b>
          <span>Next: {round.puzzles[round.i + 1]!.size}×{round.puzzles[round.i + 1]!.size} →</span>
        </button>
      )}
      {round.phase === 'done' && (
        <div className="sgd-over">
          <h2>{round.times.every((t) => t < 60) ? 'Star player!' : 'All stars in place'}</h2>
          <p className="sgd-big">{round.points}</p>
          <p className="sgd-muted">
            {round.puzzles.length > 1 ? `${round.puzzles.length} grids in ${fmtTime(round.times.reduce((a, b) => a + b, 0))}` : `Solved in ${fmtTime(round.times[0]!)}`} {newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={resultLine(round.times)} label={`Solved in ${round.times.map(fmtTime).join(', ')}`} />
          {mode === 'daily' && daily && (
            <p className="sgd-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="sgd-row">
            {mode === 'challenge' && challenge ? (
              <a className="sgd-btn sgd-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="sgd-btn sgd-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Another grid'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Star Grid #${dailyNumber(today)} ⭐\n${resultLine(daily.times)}\nScore: ${daily.best}\n${window.location.origin}/games/star-grid`} />}
            <button className="sgd-btn" onClick={() => show(null)}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="sgd-btn" onClick={() => void shareOrCopy({ title: 'Star Grid', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode, size?: number) => void; onMute: () => void }) {
  // First time on the menu: a short walkthrough of the rules (the ? button brings it back).
  const coach = useCoach('star-grid');
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today ? save.progress : null;
  return (
    <div className="sgd sgd-menu">
      <div className="sgd-menu-top">
        <button className="sgd-icon" onClick={coach.show} aria-label="How to play">
          ?
        </button>
        <button className="sgd-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="sgd-icon" />
      </div>
      <div className="sgd-logo" aria-hidden="true">
        {[2, 0, 3, 1].map((c, row) => (
          <span key={row}>
            {[0, 1, 2, 3].map((col) => (
              <i key={col} className={`is-r${(row + col * 2) % 4}`}>
                {col === c ? '★' : ''}
              </i>
            ))}
          </span>
        ))}
      </div>
      <h1 className="sgd-title">
        Star <span>Grid</span>
      </h1>
      <p className="sgd-tag">One star in every row, column and color, and no two stars touching. Pure logic, no guessing needed.</p>
      <section className="sgd-card">
        <div className="sgd-card-head">
          <b>Daily #{dailyNumber(today)}</b>
          <span>{going ? `In progress · grid ${going.i + 1} of ${DAILY_SIZES.length}` : daily?.open !== undefined ? 'Left unfinished · one try a day' : daily ? `Today: ${daily.best}` : 'Three grids, 6×6 to 8×8, the same for everyone · one try a day'}</span>
        </div>
        {going ? (
          <button className="sgd-btn sgd-btn-go sgd-btn-big" onClick={() => onPlay('daily')}>
            Continue today’s grids
          </button>
        ) : daily ? (
          <div className="sgd-done">
            {daily.best > 0 && <ShareButton text={`Star Grid #${dailyNumber(today)} ⭐\n${resultLine(daily.times)}\nScore: ${daily.best}\n${window.location.origin}/games/star-grid`} />}
            <NextDaily className="sgd-muted" />
          </div>
        ) : (
          <button className="sgd-btn sgd-btn-go sgd-btn-big" onClick={() => onPlay('daily')}>
            Play today’s grids
          </button>
        )}
      </section>
      <section className="sgd-card">
        <div className="sgd-card-head">
          <b>Endless</b>
          <span>A brand-new grid every time. Pick a size:</span>
        </div>
        <div className="sgd-sizes">
          {[6, 7, 8, 9].map((s) => (
            <button key={s} className={`sgd-btn${save.size === s ? ' is-on' : ''}`} onClick={() => onPlay('endless', s)}>
              {s}×{s}
            </button>
          ))}
        </div>
      </section>
      <p className="sgd-muted">
        Best {save.best} · {save.solved} {save.solved === 1 ? 'grid' : 'grids'} solved
      </p>
      {coach.open && <Coach steps={COACH} onClose={coach.close} />}
    </div>
  );
}
