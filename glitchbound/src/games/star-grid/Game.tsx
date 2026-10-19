import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { conflicts, DAILY_SIZES, fmtTime, makePuzzle, nextMark, resultLine, solved, solvePoints, type Mark, type Puzzle, type Tool } from './logic';
import { createSfx, type Sfx } from './sound';
import './Game.css';

const KEY = 'glitchbound.star-grid';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  times: number[];
}
interface Save {
  best: number;
  solved: number;
  size: number;
  daily: Record<string, DailyRecord>;
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
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries), times: Array.isArray(v.times) ? v.times.slice(0, 3).map(n) : [] };
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
    // Today's daily is one try; starting it uses the try up (even if it is abandoned).
    if (m === 'daily') {
      if (saveRef.current.daily[today]) return;
      commit({ ...saveRef.current, daily: { ...saveRef.current.daily, [today]: { best: 0, tries: 1, times: [] } } });
    }
    const puzzles =
      m === 'challenge' && challenge
        ? [makePuzzle(challenge.seed, 8)]
        : m === 'daily'
          ? DAILY_SIZES.map((s) => makePuzzle(hashString(`star-grid:${today}:${s}`), s))
          : [makePuzzle(randomSeed(), size)];
    if (m === 'endless' && size !== saveRef.current.size) commit({ ...saveRef.current, size });
    started.current = false;
    banked.current = 0;
    since.current = now();
    setClock(0);
    setPaused(false);
    setMode(m);
    setNewBest(false);
    setCursor(null);
    show(roundFor(puzzles));
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
    if (!solved(p, marks)) return show({ ...r, marks });
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
  };

  const nextPuzzle = (): void => {
    const r = roundRef.current;
    if (!r || r.phase !== 'solved') return;
    const size = r.puzzles[r.i + 1]!.size;
    setCursor(null);
    since.current = now();
    show({ ...r, i: r.i + 1, marks: new Array<Mark>(size * size).fill(0), phase: 'play' });
  };

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
    <div className="sg">
      <div className="sg-hud" aria-live="polite">
        <button className="sg-icon" onClick={() => (round.phase === 'done' ? show(null) : paused ? resume() : pauseNow())} aria-label={round.phase === 'done' ? 'Menu' : paused ? 'Resume' : 'Pause'}>
          {round.phase === 'done' ? '☰' : paused ? '▶' : 'II'}
        </button>
        <div className="sg-mid">
          <b>{fmtTime(shown)}</b>
          <span>
            {mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : mode === 'daily' ? `Daily #${dailyNumber(today)} · ${round.i + 1} of ${round.puzzles.length}` : `Endless · ${p.size}×${p.size}`}
          </span>
        </div>
        <div className="sg-count" aria-label={`${round.marks.filter((m) => m === 2).length} of ${p.size} stars`}>
          ⭐ {round.marks.filter((m) => m === 2).length}/{p.size}
        </div>
      </div>
      <div
        className={`sg-board${round.phase !== 'play' ? ' is-solved' : ''}`}
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
            'sg-cell',
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
              {m === 2 ? <i className="sg-star">★</i> : m === 1 ? <i className="sg-x">✕</i> : null}
            </div>
          );
        })}
      </div>
      <div className="sg-tools" role="radiogroup" aria-label="What a tap does">
        <button className={`sg-tool${tool === 'star' ? ' is-on' : ''}`} role="radio" aria-checked={tool === 'star'} onClick={() => setTool('star')}>
          ⭐ Star
        </button>
        <button className={`sg-tool${tool === 'cross' ? ' is-on' : ''}`} role="radio" aria-checked={tool === 'cross'} onClick={() => setTool('cross')}>
          ✕ Cross out
        </button>
      </div>
      <p className="sg-help">
        One ⭐ in every row, column and colour, and stars can’t touch, not even at the corners. {tool === 'star' ? 'Tap a square for a star, tap again to take it back.' : 'Tap or drag to cross out squares that can’t hold a star.'}
        <span className="sg-mouse"> Right-click crosses out too.</span>
      </p>
      {paused && round.phase === 'play' && (
        <button className="sg-overlay" onClick={resume}>
          Paused · tap to continue
        </button>
      )}
      {round.phase === 'solved' && (
        <button className="sg-banner" onClick={nextPuzzle} autoFocus>
          <b>Solved in {fmtTime(round.times[round.times.length - 1]!)}!</b>
          <span>Next: {round.puzzles[round.i + 1]!.size}×{round.puzzles[round.i + 1]!.size} →</span>
        </button>
      )}
      {round.phase === 'done' && (
        <div className="sg-over">
          <h2>{round.times.every((t) => t < 60) ? 'Star player!' : 'All stars in place'}</h2>
          <p className="sg-big">{round.points}</p>
          <p className="sg-muted">
            {round.puzzles.length > 1 ? `${round.puzzles.length} grids in ${fmtTime(round.times.reduce((a, b) => a + b, 0))}` : `Solved in ${fmtTime(round.times[0]!)}`} {newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={resultLine(round.times)} label={`Solved in ${round.times.map(fmtTime).join(', ')}`} />
          {mode === 'daily' && daily && (
            <p className="sg-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="sg-row">
            {mode === 'challenge' && challenge ? (
              <a className="sg-btn sg-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="sg-btn sg-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Another grid'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Star Grid #${dailyNumber(today)} ⭐\n${resultLine(daily.times)}\nScore: ${daily.best}\n${window.location.origin}/games/star-grid`} />}
            <button className="sg-btn" onClick={() => show(null)}>
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
    <button className="sg-btn" onClick={() => void shareOrCopy({ title: 'Star Grid', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode, size?: number) => void; onMute: () => void }) {
  const daily = save.daily[today];
  return (
    <div className="sg sg-menu">
      <div className="sg-menu-top">
        <button className="sg-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="sg-logo" aria-hidden="true">
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
      <h1 className="sg-title">
        Star <span>Grid</span>
      </h1>
      <p className="sg-tag">One star in every row, column and colour, and no two stars touching. Pure logic, no guessing needed.</p>
      <section className="sg-card">
        <div className="sg-card-head">
          <b>Daily #{dailyNumber(today)}</b>
          <span>{daily ? `Today: ${daily.best}` : 'Three grids, 6×6 to 8×8, the same for everyone · one try a day'}</span>
        </div>
        {daily ? (
          <div className="sg-done">
            {daily.best > 0 && <ShareButton text={`Star Grid #${dailyNumber(today)} ⭐\n${resultLine(daily.times)}\nScore: ${daily.best}\n${window.location.origin}/games/star-grid`} />}
            <NextDaily className="sg-muted" />
          </div>
        ) : (
          <button className="sg-btn sg-btn-go sg-btn-big" onClick={() => onPlay('daily')}>
            Play today’s grids
          </button>
        )}
      </section>
      <section className="sg-card">
        <div className="sg-card-head">
          <b>Endless</b>
          <span>A brand-new grid every time. Pick a size:</span>
        </div>
        <div className="sg-sizes">
          {[6, 7, 8, 9].map((s) => (
            <button key={s} className={`sg-btn${save.size === s ? ' is-on' : ''}`} onClick={() => onPlay('endless', s)}>
              {s}×{s}
            </button>
          ))}
        </div>
      </section>
      <p className="sg-muted">
        Best {save.best} · {save.solved} {save.solved === 1 ? 'grid' : 'grids'} solved
      </p>
    </div>
  );
}
