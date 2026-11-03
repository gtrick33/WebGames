import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { Coach, useCoach } from '../../components/Coach';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { conflicts, DAILY_SIZES, fmtTime, nextMark, resultLine, solved, solvePoints, type Mark, type Puzzle, type Tool } from './logic';
import { dailyPuzzles, endlessPuzzle, prepare, seeded } from './prepare';
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
/** A friends' challenge round, saved as it goes: a reload or Restart picks it up, it never starts over. */
interface ChallengeRecord {
  i: number;
  marks: Mark[];
  times: number[];
  points: number;
  /** 'done': finished and reported. */
  phase: 'play' | 'solved' | 'done';
  secs: number;
}
interface Save {
  best: number;
  solved: number;
  size: number;
  daily: Record<string, DailyRecord>;
  progress?: Progress;
  /** By `${challenge id}:${round}`, the latest last. */
  challenges: Record<string, ChallengeRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, solved: 0, size: 7, daily: {}, challenges: {}, muted: false });
const CHALLENGES_KEPT = 20;

function parseSave(raw: string): Save {
  const o = JSON.parse(raw) as Partial<Save>;
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
  if (o.challenges && typeof o.challenges === 'object')
    for (const [k, v] of Object.entries(o.challenges).slice(-CHALLENGES_KEPT)) if (validRecord(v)) s.challenges[k] = v;
  return s;
}
/** The stored save, or null when there is none or it can't be read. */
function readStored(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : parseSave(raw);
  } catch {
    return null;
  }
}
const loadSave = (): Save => readStored() ?? emptySave();
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const seconds0 = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const validMarks = (marks: unknown, size?: number): marks is Mark[] =>
  Array.isArray(marks) && (size === undefined ? [36, 49, 64, 81].includes(marks.length) : marks.length === size * size) && marks.every((m) => m === 0 || m === 1 || m === 2);
function validProgress(p: Progress): boolean {
  const size = DAILY_SIZES[p.i];
  return (
    typeof p.day === 'string' &&
    size !== undefined &&
    (p.phase === 'play' || p.phase === 'solved') &&
    validMarks(p.marks, size) &&
    Array.isArray(p.times) &&
    p.times.length === p.i + (p.phase === 'solved' ? 1 : 0) &&
    p.times.every(seconds0) &&
    seconds0(p.points) &&
    seconds0(p.secs)
  );
}
function validRecord(v: unknown): v is ChallengeRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as ChallengeRecord;
  return (
    Number.isInteger(r.i) &&
    r.i >= 0 &&
    r.i < DAILY_SIZES.length &&
    (r.phase === 'play' || r.phase === 'solved' || r.phase === 'done') &&
    validMarks(r.marks) &&
    Array.isArray(r.times) &&
    r.times.length <= DAILY_SIZES.length &&
    r.times.every(seconds0) &&
    seconds0(r.points) &&
    seconds0(r.secs)
  );
}
/** The save with this challenge round's record (the oldest ones dropped). */
const withChallenge = (s: Save, key: string, rec: ChallengeRecord): Save => {
  const rest = Object.entries(s.challenges)
    .filter(([k]) => k !== key)
    .slice(-(CHALLENGES_KEPT - 1));
  return { ...s, challenges: { ...Object.fromEntries(rest), [key]: rec } };
};
const now = (): number => performance.now();
const sum = (times: number[]): number => times.reduce((a, b) => a + b, 0);

interface Round {
  puzzles: Puzzle[];
  i: number;
  marks: Mark[];
  times: number[];
  points: number;
  phase: 'play' | 'solved' | 'done';
  /** The daily this round plays and records (a challenge on "today's daily" too), else null. */
  day: string | null;
  /** The challenge round's key in the save, else null. */
  ch: string | null;
}

const roundFor = (puzzles: Puzzle[], day: string | null, ch: string | null): Round => ({ puzzles, i: 0, marks: new Array<Mark>(puzzles[0]!.size ** 2).fill(0), times: [], points: 0, phase: 'play', day, ch });
const newProgress = (day: string): Progress => ({ day, i: 0, marks: new Array<Mark>(DAILY_SIZES[0]! ** 2).fill(0), times: [], points: 0, phase: 'play', secs: 0 });

interface Opening {
  round: Round;
  /** Seconds already on the current grid's clock. */
  secs: number;
  /** A round nobody has started: its clock starts now. */
  fresh: boolean;
  /** Over already but never reported (the day's daily played before): report it once now. */
  report?: boolean;
  note?: string;
}

/** The grid with its stars in place (shown under a result that was reached elsewhere). */
const solution = (p: Puzzle): Mark[] => {
  const marks = new Array<Mark>(p.size * p.size).fill(0);
  p.stars.forEach((col, row) => (marks[row * p.size + col] = 2));
  return marks;
};

/** Where a challenge round opens: as saved (finished, or part-way), the day's daily played before, or new. */
function openChallenge(s: Save, c: ChallengeSpec): Opening {
  const ch = `${c.id}:${c.round}`;
  // "Today's daily" plays the real daily of its day: the same three grids.
  const day = c.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(c.day) ? c.day : null;
  const puzzles = day ? dailyPuzzles(day) : [seeded(c.seed, 8)];
  const d = day ? s.daily[day] : undefined;
  const going = day && d?.open && s.progress?.day === day ? s.progress : null;
  // Playing it records that day's daily too while it is still to play (not while another day's is under way).
  const asDaily = day && (going || (!d && !(s.progress && s.daily[s.progress.day]?.open))) ? day : null;
  const last = puzzles.length - 1;
  const over = (points: number, times: number[], note: string): Opening => ({
    round: { puzzles, i: last, marks: solution(puzzles[last]!), times, points, phase: 'done', day: null, ch },
    secs: 0,
    fresh: false,
    report: true,
    note,
  });
  const rec = s.challenges[ch];
  if (rec) {
    if (rec.i <= last && rec.marks.length === puzzles[rec.i]!.size ** 2)
      return { round: { puzzles, i: rec.i, marks: rec.marks.slice(), times: rec.times.slice(), points: rec.points, phase: rec.phase, day: asDaily, ch }, secs: rec.secs, fresh: false };
    return over(rec.points, rec.times.slice(), 'This round was already started, so it ends as it stood.');
  }
  if (going) return { round: { puzzles, i: going.i, marks: going.marks.slice(), times: going.times.slice(), points: going.points, phase: going.phase, day, ch }, secs: going.secs, fresh: false };
  if (d) return over(d.best, d.times.slice(), 'You already played this daily: your daily result counts here.');
  return { round: roundFor(puzzles, asDaily, ch), secs: 0, fresh: true };
}

/** True when a key press is meant for something else on the page (a field, a dialog, the site around the game). */
function notForGame(e: KeyboardEvent, root: Element | null): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  const el = e.target instanceof Element ? e.target : null;
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.closest('[role=dialog],[aria-modal=true]') || !root?.contains(el)) return true;
  if ((el instanceof HTMLElement && el.isContentEditable) || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  // A button reached with the keyboard keeps Enter and Space.
  try {
    return (e.key === 'Enter' || e.key === ' ') && el.matches('button:focus-visible, a:focus-visible');
  } catch {
    return false;
  }
}

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <StarGrid key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function StarGrid({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  // The day is read again when the menu shows, when the tab comes back and when a round starts.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  /** Every write re-reads the stored save first, so another open tab's progress is never overwritten. */
  const update = useCallback((fn: (cur: Save) => Save) => {
    const cur = readStored() ?? saveRef.current;
    const next = fn(cur);
    saveRef.current = next;
    setSave(next);
    if (next !== cur) writeSave(next);
  }, []);
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood (0), so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const cur = saveRef.current;
    const rec = cur.daily[today];
    if (!rec?.open || cur.progress?.day === today) return;
    update((c) => ({ ...c, daily: { ...c.daily, [today]: { ...rec, open: false } } }));
    host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [opening] = useState<Opening | null>(() => (challenge ? openChallenge(save, challenge) : null));
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [round, setRound] = useState<Round | null>(opening?.round ?? null);
  const roundRef = useRef(round);
  const [note, setNote] = useState(opening?.note ?? '');
  const [cursor, setCursor] = useState<number | null>(null);
  const [clock, setClock] = useState(opening?.round.phase === 'play' ? opening.secs : 0);
  // A round picked up again waits behind the pause card, so its clock runs only once the player is back.
  const [paused, setPaused] = useState(!!opening && !opening.fresh && opening.round.phase === 'play');
  const [newBest, setNewBest] = useState(false);
  // Time: seconds banked on this puzzle, plus the running stretch since `since` (null = stopped).
  // The clock starts as soon as a grid is on screen, so nobody can solve it before the first tap.
  const banked = useRef(opening?.round.phase === 'play' ? opening.secs : 0);
  const since = useRef<number | null>(null);
  /** Whether this round's start was reported (when its clock first runs). */
  const started = useRef(false);
  const paint = useRef<{ to: Mark; from: Mark } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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

  const show = (r: Round | null): void => {
    roundRef.current = r;
    setRound(r);
  };
  const seconds = (): number => banked.current + (since.current === null ? 0 : (now() - since.current) / 1000);
  /** Runs the clock; the first time in a round, that is the round's start. */
  const tick = (): void => {
    since.current = now();
    if (started.current) return;
    started.current = true;
    host.report({ type: 'start' });
  };
  /** Back to the menu, showing the day it is now (an open tab carries on past midnight). */
  const toMenu = (): void => {
    since.current = null;
    banked.current = 0;
    setToday(dayKey());
    setNote('');
    show(null);
  };

  const begin = (m: 'daily' | 'endless', size = saveRef.current.size): void => {
    // Today's daily is one try: starting it uses the try up. Leaving it halfway (pause, reload) is
    // fine, it carries on with the same marks and clock, but it can never be started over.
    const day = dayKey();
    setToday(day);
    const cur = readStored() ?? saveRef.current;
    saveRef.current = cur;
    setSave(cur);
    const kept = m === 'daily' && cur.daily[day]?.open && cur.progress?.day === day ? cur.progress : null;
    if (m === 'daily' && !kept) {
      if (cur.daily[day]) return;
      update((c) => ({ ...c, daily: { ...c.daily, [day]: { best: 0, tries: 1, times: [], open: true } }, progress: newProgress(day) }));
    }
    const puzzles = m === 'daily' ? dailyPuzzles(day) : [endlessPuzzle(size)];
    if (m === 'endless' && size !== cur.size) update((c) => ({ ...c, size }));
    started.current = false;
    banked.current = kept?.phase === 'play' ? kept.secs : 0;
    since.current = null;
    // Pressing Play is the start: the clock runs from here (a grid solved before a reload waits for its banner).
    if (!kept || kept.phase === 'play') tick();
    setClock(banked.current);
    setPaused(false);
    setMode(m);
    setNewBest(false);
    setNote('');
    setCursor(null);
    const d = m === 'daily' ? day : null;
    show(kept ? { puzzles, i: kept.i, marks: kept.marks.slice(), times: kept.times.slice(), points: kept.points, phase: kept.phase, day: d, ch: null } : roundFor(puzzles, d, null));
  };

  /** Saves the grids as they go (a daily, a challenge round), so leaving (pause, reload) carries on from here. */
  const keep = (r: Round): void => {
    if (r.phase === 'done' || (!r.day && !r.ch)) return;
    const at = { i: r.i, marks: r.marks, times: r.times, points: r.points, phase: r.phase, secs: r.phase === 'play' ? Math.round(seconds() * 10) / 10 : 0 };
    update((cur) => {
      let next = cur;
      // Finished in another tab meanwhile: leave it be.
      if (r.day && cur.daily[r.day]?.open) next = { ...next, progress: { day: r.day, ...at } };
      if (r.ch && cur.challenges[r.ch]?.phase !== 'done') next = withChallenge(next, r.ch, at);
      return next;
    });
  };

  const finish = (r: Round): void => {
    // The times are whole seconds already, so every place that shows them adds up the same.
    const total = sum(r.times);
    let best = false;
    let countsAsDaily = false;
    update((cur) => {
      best = r.points > cur.best;
      let next: Save = { ...cur, best: Math.max(cur.best, r.points), solved: cur.solved + r.puzzles.length };
      const d = r.day ? cur.daily[r.day] : undefined;
      if (r.day && (!d || d.open)) {
        // A daily started before midnight finishes as that day's: it no longer counts as today's.
        countsAsDaily = r.day === dayKey();
        next = { ...next, daily: { ...cur.daily, [r.day]: { best: r.points, tries: 1, times: r.times } }, progress: cur.progress?.day === r.day ? undefined : cur.progress };
      }
      if (r.ch) next = withChallenge(next, r.ch, { i: r.i, marks: r.marks, times: r.times, points: r.points, phase: 'done', secs: 0 });
      return next;
    });
    setNewBest(best);
    const stats: Record<string, number> = r.puzzles.length > 1 ? { time: total } : {};
    host.report({ type: 'end', score: r.points, stats, ...(countsAsDaily ? { daily: true } : {}), ...(r.ch && challenge ? { challenge: { id: challenge.id, round: challenge.round } } : {}) });
  };

  /** Sets one cell's mark; checks for a finished grid. */
  const setMark = (i: number, m: Mark): void => {
    const r = roundRef.current;
    if (!r || r.phase !== 'play' || r.marks[i] === m) return;
    if (since.current === null && !paused) tick();
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
    // Solved: stop the clock, score it. The time is kept in whole seconds (the score uses the exact time).
    const exact = seconds();
    banked.current = 0;
    since.current = null;
    setClock(0);
    const times = [...r.times, Math.round(exact)];
    const points = r.points + solvePoints(p.size, exact);
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
    setPaused(false);
    banked.current = 0;
    tick();
    const next: Round = { ...r, i: r.i + 1, marks: new Array<Mark>(size * size).fill(0), phase: 'play' };
    show(next);
    keep(next);
  };

  // A challenge round opens on its grid: a new one starts its clock now and is saved at once (so a
  // reload picks it up, never starts it over); one already over counts its score now, once.
  useEffect(() => {
    const o = opening;
    if (!o || !challenge) return;
    const r = o.round;
    if (o.report) {
      update((c) => withChallenge(c, r.ch!, { i: r.i, marks: r.marks, times: r.times, points: r.points, phase: 'done', secs: 0 }));
      host.report({ type: 'end', score: r.points, stats: r.puzzles.length > 1 ? { time: sum(r.times) } : {}, challenge: { id: challenge.id, round: challenge.round } });
      return;
    }
    if (!o.fresh) return;
    if (r.day) update((c) => (c.daily[r.day!] ? c : { ...c, daily: { ...c.daily, [r.day!]: { best: 0, tries: 1, times: [], open: true } }, progress: newProgress(r.day!) }));
    tick();
    keep(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The grids also save the clock every few seconds.
  const ticking = (!!round?.day || !!round?.ch) && round?.phase === 'play' && !paused;
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
    if (roundRef.current?.phase === 'play') tick();
  };
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (round?.phase === 'play' && !paused) setPaused(true);
  }
  // A hidden tab or app pauses the grid (the time away isn't counted); coming back reads the day again.
  useEffect(() => {
    const onShow = (): void => {
      if (document.hidden) {
        if (roundRef.current?.phase === 'play') setPaused(true);
      } else setToday(dayKey());
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, []);

  // Another tab changed the save: show it, and leave grids that were finished over there.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const cur = loadSave();
      saveRef.current = cur;
      setSave(cur);
      const r = roundRef.current;
      if (!r || r.phase === 'done') return;
      const c = r.ch ? cur.challenges[r.ch] : undefined;
      if (c?.phase === 'done' && validMarks(c.marks, r.puzzles[c.i]?.size)) {
        since.current = null;
        setPaused(false);
        return show({ ...r, i: c.i, marks: c.marks, times: c.times, points: c.points, phase: 'done' });
      }
      const d = r.day ? cur.daily[r.day] : undefined;
      if (!r.ch && d && !d.open) toMenu();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On a result, the next endless grid of that size is made in idle time.
  const spareSize = mode === 'endless' && round?.phase === 'done' ? round.puzzles[0]!.size : 0;
  useEffect(() => (spareSize ? prepare([spareSize]) : undefined), [spareSize]);

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
      if (!r || notForGame(e, rootRef.current)) return;
      // A held key moves the cursor on, but never repeats an action.
      if (e.repeat && !e.key.startsWith('Arrow')) return;
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
        // The first press shows the cursor on the first square.
        if (cursor === null) return setCursor(0);
        const row = Math.floor(cursor / size) + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
        const col = (cursor % size) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
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

  if (!round) return <Menu save={save} today={today} onPlay={begin} onMute={() => update((c) => ({ ...c, muted: !c.muted }))} />;

  const p = round.puzzles[round.i]!;
  const bad = conflicts(p, round.marks);
  const day = round.day ?? today;
  const daily = save.daily[day];
  const shown = round.phase === 'play' ? clock : round.times[round.times.length - 1] ?? 0;
  const border = (i: number, j: number): boolean => j < 0 || j >= p.size * p.size || p.regions[i] !== p.regions[j];
  const grids = round.puzzles.length;

  return (
    <div className="sgd sgd-play" ref={rootRef}>
      <div className="sgd-layout">
        <div className="sgd-hud" aria-live="polite">
          <span className="game-menu-pair">
            <button
              className="sgd-icon"
              onClick={() => (round.phase === 'done' ? toMenu() : paused ? resume() : pauseNow())}
              // Between grids the clock is stopped already: nothing to pause.
              disabled={round.phase === 'solved'}
              aria-label={round.phase === 'done' ? 'Menu' : paused ? 'Resume' : 'Pause'}
            >
              {round.phase === 'done' ? '☰' : paused ? '▶' : 'II'}
            </button>
            <GameMenuButton className="sgd-icon" />
          </span>
          <div className="sgd-mid">
            <b>{fmtTime(shown)}</b>
            <span>
              {mode === 'challenge'
                ? `⚔️ Challenge · round ${challenge?.round ?? 1}${grids > 1 ? ` · ${round.i + 1} of ${grids}` : ''}`
                : mode === 'daily'
                  ? `Daily #${dailyNumber(day)} · ${round.i + 1} of ${grids}`
                  : `Endless · ${p.size}×${p.size}`}
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
      </div>
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
          <h2>{round.times.length < grids ? 'Round over' : round.times.every((t) => t < 60) ? 'Star player!' : 'All stars in place'}</h2>
          {note && <p className="sgd-muted">{note}</p>}
          <p className="sgd-big">{round.points}</p>
          <p className="sgd-muted">
            {grids > 1 ? `${grids} grids in ${fmtTime(sum(round.times))}` : round.times.length ? `Solved in ${fmtTime(round.times[0]!)}` : 'Not solved'} {newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          {round.times.length > 0 && <ResultLine line={resultLine(round.times)} label={`Solved in ${round.times.map(fmtTime).join(', ')}`} />}
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
              <button className="sgd-btn sgd-btn-go" onClick={() => begin('endless')} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Another grid'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Star Grid #${dailyNumber(day)} ⭐\n${resultLine(daily.times)}\nScore: ${daily.best}\n${window.location.origin}/games/star-grid`} />}
            <button className="sgd-btn" onClick={toMenu}>
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

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: 'daily' | 'endless', size?: number) => void; onMute: () => void }) {
  // First time on the menu: a short walkthrough of the rules (the ? button brings it back).
  const coach = useCoach('star-grid');
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today ? save.progress : null;
  // While the player reads the menu, the grids they may pick next are made in idle time.
  const toPlay = !daily || !!going;
  useEffect(() => prepare([save.size, ...[6, 7, 8, 9].filter((s) => s !== save.size)], toPlay ? today : undefined), [save.size, toPlay, today]);
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
