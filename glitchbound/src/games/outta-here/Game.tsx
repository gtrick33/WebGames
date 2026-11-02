import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { Coach, useCoach } from '../../components/Coach';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { arrowAt, canLeave, DAILY_LEVELS, DC, DR, HEARTS, levelPoints, makeLevel, pathAhead, resultLine, type Arrow, type Level } from './logic';
import { createSfx, type Sfx } from './sound';
import { COACH } from './coach';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.outta-here';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  line: string;
  /** true: started, not finished (it resumes from `progress`); false: left, could not be resumed, settled. */
  open?: boolean;
}
/** Today's run so far, saved after every tap (`secs`: time spent on the current level). */
interface Progress {
  day: string;
  seed: number;
  n: number;
  gone: number[];
  mistakes: number;
  hearts: number;
  banked: number;
  history: { mistakes: number; cleared: boolean }[];
  phase: 'play' | 'cleared';
  gained: number;
  secs: number;
}
/** A friends' challenge round on this device (`id:round`): under way (`progress`) or done (reported once). */
interface ChallengeRecord {
  done: boolean;
  score: number;
  line: string;
  progress?: Progress;
}
interface Save {
  best: number;
  bestLevels: number;
  runs: number;
  daily: Record<string, DailyRecord>;
  progress?: Progress;
  challenges: Record<string, ChallengeRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, bestLevels: 0, runs: 0, daily: {}, challenges: {}, muted: false });
const LINE = /^[💨🟡💥]{0,40}$/u;
/** Challenge rounds follow endless rules: no level cap. */
const OPEN_ENDED = 9999;

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.bestLevels = n(o.bestLevels);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object')
          s.daily[d] = { best: n(v.best), tries: n(v.tries), line: typeof v.line === 'string' && LINE.test(v.line) ? v.line : '', ...(typeof v.open === 'boolean' ? { open: v.open } : {}) };
    const p = o.progress;
    if (p && typeof p.day === 'string' && runFrom(p, DAILY_LEVELS)) s.progress = p;
    if (o.challenges && typeof o.challenges === 'object')
      for (const [k, v] of Object.entries(o.challenges).slice(-30))
        if (/^[\w-]{1,64}:\d{1,3}$/.test(k) && v && typeof v === 'object') {
          const q = v.progress;
          s.challenges[k] = { done: v.done === true, score: n(v.score), line: typeof v.line === 'string' && LINE.test(v.line) ? v.line : '', ...(v.done !== true && q && typeof q.day === 'string' && runFrom(q, OPEN_ENDED) ? { progress: q } : {}) };
        }
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
const dailySeedOf = (day: string): number => hashString(`outta-here:${day}`);
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;
const now = (): number => performance.now();

const PALETTE = ['#ff5d73', '#ffb020', '#2fc46b', '#2f8cff', '#9b6bff', '#ff6bd0'];

interface Run {
  /** The day the round belongs to (a daily started before midnight stays that day's). */
  day: string;
  seed: number;
  n: number;
  level: Level;
  gone: Set<number>;
  /** Arrows flying off right now (removed from play, still drawn for the animation). */
  leaving: Set<number>;
  mistakes: number;
  hearts: number;
  /** Points banked from finished levels. */
  banked: number;
  history: { mistakes: number; cleared: boolean }[];
  phase: 'play' | 'cleared' | 'over';
  /** Points the last cleared level earned (for the banner). */
  gained: number;
}

const startRun = (seed: number, day: string): Run => ({ day, seed, n: 1, level: makeLevel(seed, 1), gone: new Set(), leaving: new Set(), mistakes: 0, hearts: HEARTS, banked: 0, history: [], phase: 'play', gained: 0 });

const isInt = (v: unknown, min = 0, max = 2 ** 32): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Rebuilds a saved run (up to level `maxN`), or null when the data is not a valid one. */
function runFrom(p: Progress, maxN: number): Run | null {
  if (typeof p.day !== 'string' || !isInt(p.seed) || !isInt(p.n, 1, maxN) || !isInt(p.mistakes) || !isInt(p.hearts, 1, HEARTS) || !isInt(p.banked) || !isInt(p.gained)) return null;
  if (!(p.phase === 'play' || p.phase === 'cleared') || !(typeof p.secs === 'number' && p.secs >= 0)) return null;
  if (!Array.isArray(p.history) || p.history.length > maxN || !p.history.every((h) => h && isInt(h.mistakes) && typeof h.cleared === 'boolean')) return null;
  const level = makeLevel(p.seed, p.n);
  if (!Array.isArray(p.gone) || !p.gone.every((id) => isInt(id, 0, level.arrows.length - 1))) return null;
  return { day: p.day, seed: p.seed, n: p.n, level, gone: new Set(p.gone), leaving: new Set(), mistakes: p.mistakes, hearts: p.hearts, banked: p.banked, history: p.history.map((h) => ({ mistakes: h.mistakes, cleared: h.cleared })), phase: p.phase, gained: p.gained };
}
const liveScore = (r: Run): number => r.banked + (r.phase === 'play' ? r.gone.size * 10 : 0);
const progressOf = (r: Run, secs: number): Progress => ({ day: r.day, seed: r.seed, n: r.n, gone: [...r.gone], mistakes: r.mistakes, hearts: r.hearts, banked: r.banked, history: r.history, phase: r.phase === 'cleared' ? 'cleared' : 'play', gained: r.gained, secs });
/** Whether a saved run is the same point as the run on screen (another tab moved it on when not). */
const sameAs = (p: Progress | undefined, r: Run): boolean => !!p && p.day === r.day && p.n === r.n && p.gone.length === r.gone.size && p.hearts === r.hearts && p.mistakes === r.mistakes && p.phase === r.phase;
/** A finished round, shown again from its result (score and emoji line). */
function doneRun(seed: number, day: string, score: number, line: string): Run {
  const history = [...line].map((ch) => ({ mistakes: ch === '💨' ? 0 : 1, cleared: ch !== '💥' }));
  const n = Math.max(1, history.length);
  const level = makeLevel(seed, n);
  const all = new Set(level.arrows.map((a) => a.id));
  return { day, seed, n, level, gone: all, leaving: new Set(), mistakes: 0, hearts: 0, banked: score, history, phase: 'over', gained: 0 };
}
const statsOf = (history: { mistakes: number; cleared: boolean }[]) => ({ levels: history.filter((h) => h.cleared).length, perfect: history.filter((h) => h.cleared && h.mistakes === 0).length });

/** Keys belong to the game only when meant for it: not typed into a field or a dialog, not on another part of the page. */
function ownsKey(e: KeyboardEvent, root: HTMLElement | null): boolean {
  const t = e.target instanceof Element ? e.target : null;
  if (!t || t === document.body || t === document.documentElement) return true;
  if (t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [aria-modal="true"]')) return false;
  if (!root?.contains(t)) return false;
  // A button reached with the keyboard keeps Enter and Space.
  if ((e.key === 'Enter' || e.key === ' ') && t.closest('button, a[href]')) {
    try {
      return !t.matches(':focus-visible');
    } catch {
      return false;
    }
  }
  return true;
}

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <OuttaHere key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function OuttaHere({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  // Re-read on every menu, round start and return to the tab: a game left open over midnight moves on.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  /** Writes a change on top of what is stored now (another tab may have saved since). */
  const commit = useCallback((change: (s: Save) => Save) => {
    const s = change(loadSave());
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood (0), so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const rec = saveRef.current.daily[today];
    if (!rec?.open || saveRef.current.progress?.day === today) return;
    commit((s) => ({ ...s, daily: { ...s.daily, [today]: { ...rec, open: false } } }));
    host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A friends' challenge round is `id:round` in the save. A "Today's daily" challenge plays that day's daily.
  const chKey = challenge ? `${challenge.id}:${challenge.round}` : '';
  const chDay = challenge?.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(challenge.day) ? challenge.day : null;
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  /** A round of today's daily rules: the daily itself, or a challenge on a day's daily. */
  const dayRun = (m: Mode): boolean => m === 'daily' || (m === 'challenge' && !!chDay);
  /** Where a challenge round stands on this device: done (its result), under way (resume) or new. */
  const challengeStart = (s: Save): { run: Run; note: string; secs?: number; settle?: { score: number; line: string } } | null => {
    if (!challenge) return null;
    const rec = s.challenges[chKey];
    if (chDay) {
      const seed = dailySeedOf(chDay);
      const d = s.daily[chDay];
      const kept = d?.open && s.progress?.day === chDay ? runFrom(s.progress, DAILY_LEVELS) : null;
      if (kept) return { run: kept, note: '', secs: s.progress!.secs };
      if (rec?.done) return { run: doneRun(seed, chDay, rec.score, rec.line), note: 'This round is already played.' };
      if (d) return { run: doneRun(seed, chDay, d.best, d.line), note: 'Your daily result counts here.', settle: { score: d.best, line: d.line } };
      return { run: startRun(seed, chDay), note: '' };
    }
    if (rec?.done) return { run: doneRun(challenge.seed, today, rec.score, rec.line), note: 'This round is already played.' };
    const kept = rec?.progress ? runFrom(rec.progress, OPEN_ENDED) : null;
    return kept ? { run: kept, note: '', secs: rec!.progress!.secs } : { run: startRun(challenge.seed, today), note: '' };
  };
  const [opening] = useState(() => challengeStart(save));
  const [run, setRun] = useState<Run | null>(() => opening?.run ?? null);
  const [note, setNote] = useState(opening?.note ?? '');
  const runRef = useRef(run);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const goRef = useRef<HTMLElement | null>(null);
  const [cursor, setCursor] = useState(0);
  // The keyboard cursor only shows once someone uses the keys.
  const [keys, setKeys] = useState(false);
  const [blocked, setBlocked] = useState<{ arrow: number; cell: number; key: number } | null>(null);
  /** The last blocked tap: the same arrow tapped again while it still bounces costs nothing more. */
  const lastBump = useRef({ arrow: -1, at: 0 });
  const [newBest, setNewBest] = useState(false);
  const started = useRef(false);
  /** The round whose start the arcade holds (it times the round from there), until its end is reported. */
  const hostRound = useRef<string | null>(null);
  const roundId = (m: Mode, day: string): string => (m === 'challenge' ? `challenge:${chKey}` : `${m}:${day}`);
  const levelStart = useRef(0);
  const combo = useRef(0);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  const overTune = useRef(0);
  // First time here and straight into a friend's challenge: the walkthrough comes first, before the clock.
  const coach = useCoach('outta-here');
  const intro = mode === 'challenge' && coach.open && run?.phase === 'play';
  useEffect(
    () => () => {
      window.clearTimeout(overTune.current);
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  // Each level's speed bonus is timed from when it appears. The bonus is small and generous, so the
  // clock keeps running through an arcade pause request.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) setPauseSeen(pauseKey);
  // A friends' challenge opens straight on its first level (or where it was left).
  useEffect(() => {
    const o = opening;
    if (!o) return;
    levelStart.current = now() - (o.secs ?? 0) * 1000;
    if (o.settle) {
      // That day's daily was already played: its result is this round's score, reported once.
      const { score, line } = o.settle;
      const s = loadSave();
      saveRef.current = { ...s, challenges: { ...s.challenges, [chKey]: { done: true, score, line } } };
      writeSave(saveRef.current);
      const history = o.run.history;
      host.report({ type: 'end', score, stats: statsOf(history), challenge: { id: challenge!.id, round: challenge!.round } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = (r: Run | null): void => {
    runRef.current = r;
    setRun(r);
    if (!r) setToday(dayKey());
  };

  // Back to the tab (maybe on another day): the menu shows the day it is now.
  useEffect(() => {
    const onBack = (): void => {
      if (document.visibilityState !== 'hidden') setToday(dayKey());
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, []);

  /** Saves the round as it goes, so leaving (menu, reload) carries on from here. */
  const keep = (r: Run): void => {
    if (r.phase === 'over' || mode === 'endless') return;
    const secs = r.phase === 'play' ? Math.round((now() - levelStart.current) / 100) / 10 : 0;
    const p = progressOf(r, secs);
    // Playing a day's daily as a challenge uses that day's one try too (from the first tap).
    if (dayRun(mode)) commit((s) => (s.daily[r.day]?.open ? { ...s, progress: p } : mode === 'challenge' && !s.daily[r.day] ? { ...s, daily: { ...s.daily, [r.day]: { best: 0, tries: 1, line: '', open: true } }, progress: p } : s));
    else commit((s) => (s.challenges[chKey]?.done ? s : { ...s, challenges: { ...s.challenges, [chKey]: { done: false, score: 0, line: '', progress: p } } }));
  };

  const begin = (m: Mode): void => {
    // Today's daily is one try: starting it uses the try up. Leaving it halfway (menu, reload) is
    // fine, it carries on where it was, but it can never be started over.
    const day = dayKey();
    setToday(day);
    const cur = loadSave();
    const kept = m === 'daily' && cur.daily[day]?.open && cur.progress?.day === day ? runFrom(cur.progress, DAILY_LEVELS) : null;
    if (m === 'daily' && !kept) {
      if (cur.daily[day]) return;
      commit((s) => {
        // A daily left open on an earlier day (over midnight) can't be picked up any more.
        const old = s.progress && s.progress.day !== day && s.daily[s.progress.day]?.open ? { [s.progress.day]: { ...s.daily[s.progress.day]!, open: false } } : {};
        return { ...s, daily: { ...s.daily, ...old, [day]: { best: 0, tries: 1, line: '', open: true } }, progress: { day, seed: dailySeedOf(day), n: 1, gone: [], mistakes: 0, hearts: HEARTS, banked: 0, history: [], phase: 'play', gained: 0, secs: 0 } };
      });
    }
    // Picking today's daily up again in this visit: the arcade still holds its start, so its clock keeps running.
    started.current = !!kept && hostRound.current === roundId(m, day);
    levelStart.current = now() - (kept ? cur.progress!.secs * 1000 : 0);
    combo.current = 0;
    setMode(m);
    setNote('');
    setNewBest(false);
    setBlocked(null);
    setCursor(0);
    show(kept ?? startRun(m === 'challenge' && challenge ? challenge.seed : m === 'daily' ? dailySeedOf(day) : randomSeed(), day));
  };

  const finish = (r: Run): void => {
    const score = r.banked;
    const { levels, perfect } = statsOf(r.history);
    const line = resultLine(r.history);
    const isDay = dayRun(mode);
    setNewBest(score > saveRef.current.best);
    commit((s) => ({
      ...s,
      best: Math.max(s.best, score),
      bestLevels: Math.max(s.bestLevels, levels),
      runs: s.runs + 1,
      daily: isDay ? { ...s.daily, [r.day]: { best: score, tries: 1, line } } : s.daily,
      progress: isDay && s.progress?.day === r.day ? undefined : s.progress,
      challenges: mode === 'challenge' ? { ...s.challenges, [chKey]: { done: true, score, line } } : s.challenges,
    }));
    hostRound.current = null;
    const end = { type: 'end' as const, score, stats: { levels, perfect } };
    // A daily finished after midnight is still the earlier day's: the arcade only counts today's as today's.
    const daily = isDay && r.day === dayKey() ? { daily: true } : {};
    host.report(mode === 'challenge' && challenge ? { ...end, ...daily, challenge: { id: challenge.id, round: challenge.round } } : { ...end, ...daily });
    overTune.current = window.setTimeout(() => sfx().over(), 200);
  };

  const tapArrow = (a: Arrow): void => {
    const r = runRef.current;
    if (!r || r.phase !== 'play' || r.gone.has(a.id)) return;
    if (!started.current) {
      started.current = true;
      hostRound.current = roundId(mode, r.day);
      host.report({ type: 'start' });
    }
    if (!canLeave(r.level, r.gone, a)) {
      // A second tap on the arrow still bouncing from the first is the same mistake.
      if (lastBump.current.arrow === a.id && now() - lastBump.current.at < 600) return;
      lastBump.current = { arrow: a.id, at: now() };
      // Show what is in the way, and pay a heart.
      const occupied = new Set(r.level.arrows.filter((x) => !r.gone.has(x.id) && x.id !== a.id).flatMap((x) => x.cells));
      const wall = pathAhead(r.level.size, a.cells[a.cells.length - 1]!, a.dir).find((i) => occupied.has(i)) ?? -1;
      setBlocked({ arrow: a.id, cell: wall, key: (blocked?.key ?? 0) + 1 });
      sfx().bump();
      navigator.vibrate?.(50);
      combo.current = 0;
      const hearts = r.hearts - 1;
      const next: Run = { ...r, hearts, mistakes: r.mistakes + 1 };
      if (hearts <= 0) {
        const over: Run = { ...next, phase: 'over', banked: r.banked + r.gone.size * 10, history: [...r.history, { mistakes: r.mistakes + 1, cleared: false }] };
        show(over);
        finish(over);
      } else {
        show(next);
        keep(next);
      }
      return;
    }
    sfx().whoosh(combo.current++);
    const gone = new Set(r.gone).add(a.id);
    const leaving = new Set(r.leaving).add(a.id);
    if (gone.size < r.level.arrows.length) {
      const next: Run = { ...r, gone, leaving };
      show(next);
      return keep(next);
    }
    // Level cleared.
    const secs = (now() - levelStart.current) / 1000;
    const gained = levelPoints(r.level, r.n, r.mistakes, secs);
    const history = [...r.history, { mistakes: r.mistakes, cleared: true }];
    const done: Run = { ...r, gone, leaving, banked: r.banked + gained, gained, history, phase: 'cleared', hearts: !dayRun(mode) && r.mistakes === 0 ? Math.min(HEARTS, r.hearts + 1) : r.hearts };
    sfx().level();
    if (dayRun(mode) && r.n >= DAILY_LEVELS) {
      const over: Run = { ...done, phase: 'over' };
      show(over);
      finish(over);
    } else {
      show(done);
      keep(done);
    }
  };

  const nextLevel = (): void => {
    const r = runRef.current;
    if (!r || r.phase !== 'cleared') return;
    levelStart.current = now();
    combo.current = 0;
    setBlocked(null);
    setCursor(0);
    const next: Run = { ...r, n: r.n + 1, level: makeLevel(r.seed, r.n + 1), gone: new Set(), leaving: new Set(), mistakes: 0, phase: 'play' };
    show(next);
    keep(next);
  };

  // The round also saves the level clock every few seconds.
  const playing = mode !== 'endless' && run?.phase === 'play';
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => runRef.current && keep(runRef.current), 2000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Another tab saved: take its save. If it moved this round on (or finished it), this screen is stale.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = loadSave();
      saveRef.current = s;
      setSave(s);
      const r = runRef.current;
      if (!r || r.phase === 'over' || mode === 'endless') return;
      if (mode === 'challenge') {
        const o = challengeStart(s);
        const p = chDay ? s.progress : s.challenges[chKey]?.progress;
        if (o && (o.run.phase === 'over' || (p && !sameAs(p, r)))) {
          levelStart.current = now() - (o.secs ?? 0) * 1000;
          setNote(o.note);
          show(o.run);
        }
      } else if (!s.daily[r.day]?.open || !sameAs(s.progress, r)) show(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  // Flying arrows are dropped from the drawing once their animation is over.
  useEffect(() => {
    if (!run || run.leaving.size === 0) return;
    const t = window.setTimeout(() => {
      const r = runRef.current;
      if (r && r.leaving.size) show({ ...r, leaving: new Set() });
    }, 420);
    return () => window.clearTimeout(t);
  }, [run]);

  useEffect(() => {
    if (!blocked) return;
    const t = window.setTimeout(() => setBlocked(null), 600);
    return () => window.clearTimeout(t);
  }, [blocked]);

  // A cleared level moves on by itself after a moment.
  useEffect(() => {
    if (run?.phase !== 'cleared') return;
    const t = window.setTimeout(nextLevel, 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.phase, run?.n]);

  // The end screen's first button takes the focus, unless the player is busy elsewhere on the page.
  const over = run?.phase === 'over';
  useEffect(() => {
    if (!over) return;
    const a = document.activeElement;
    if (!a || a === document.body || rootRef.current?.contains(a)) goRef.current?.focus();
  }, [over]);

  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent): void => {
      const r = runRef.current;
      // (Once the run is over, Enter and Space are left to the focused end-screen button.)
      if (!r || r.phase === 'over' || intro || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !ownsKey(e, rootRef.current)) return;
      const size = r.level.size;
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        setKeys(true);
        const d = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(e.key) as 0 | 1 | 2 | 3;
        setCursor((c) => {
          const row = Math.max(0, Math.min(size - 1, Math.floor(c / size) + DR[d]));
          const col = Math.max(0, Math.min(size - 1, (c % size) + DC[d]));
          return row * size + col;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // A held key sends once.
        if (e.repeat) return;
        if (r.phase === 'cleared') return nextLevel();
        // The first press shows the cursor, so nobody sends an arrow they can't see.
        if (!keys) return setKeys(true);
        const a = arrowAt(r.level, r.gone, cursor);
        if (a) tapArrow(a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!run) return <Menu save={save} today={today} onPlay={begin} onMute={() => commit((s) => ({ ...s, muted: !s.muted }))} />;

  const { level } = run;
  const U = 10;
  const size = level.size;
  const daily = save.daily[run.day];
  const score = liveScore(run);
  const levels = run.history.filter((h) => h.cleared).length;
  const target = keys && run.phase === 'play' ? arrowAt(level, run.gone, cursor) : null;
  const goRefSet = (el: HTMLElement | null): void => {
    goRef.current = el;
  };

  return (
    <div className="oh" ref={rootRef}>
      <div className="oh-play">
        <div className="oh-hud" aria-live="polite">
          <span className="game-menu-pair">
            {/* A challenge round is one attempt: no menu that would drop it (the arcade's own menu still leaves). */}
            {!(mode === 'challenge' && run.phase !== 'over') && (
              <button className="oh-icon" onClick={() => show(null)} aria-label="Menu">
                ☰
              </button>
            )}
            <GameMenuButton className="oh-icon" />
          </span>
          <div className="oh-mid">
            <b>{score}</b>
            <span>
              {mode === 'challenge' ? `⚔️ Round ${challenge?.round ?? 1} · ` : mode === 'daily' ? `Daily #${dailyNumber(run.day)} · ` : ''}Level {run.n}
              {dayRun(mode) ? `/${DAILY_LEVELS}` : ''}
            </span>
          </div>
          <div className="oh-hearts" aria-label={`${run.hearts} ${run.hearts === 1 ? 'heart' : 'hearts'} left`}>
            {Array.from({ length: HEARTS }, (_, i) => (
              <i key={i} className={i < run.hearts ? 'is-on' : ''}>
                {i < run.hearts ? '❤️' : '🤍'}
              </i>
            ))}
          </div>
        </div>
        <div className="oh-board-wrap">
          <svg className={`oh-board${blocked ? ' is-hit' : ''}`} viewBox={`-2 -2 ${size * U + 4} ${size * U + 4}`} role="grid" aria-label={`Level ${run.n}: ${level.arrows.length - run.gone.size} arrows left`}>
            {Array.from({ length: size * size }, (_, i) => (
              <rect key={i} className={`oh-dot${blocked?.cell === i ? ' is-wall' : ''}`} x={(i % size) * U + 1} y={Math.floor(i / size) * U + 1} width={U - 2} height={U - 2} rx={2.4} />
            ))}
            {level.arrows.map((a) => {
              const isGone = run.gone.has(a.id);
              if (isGone && !run.leaving.has(a.id)) return null;
              const shake = blocked?.arrow === a.id ? blocked.key : 0;
              return <ArrowShape key={`${run.n}:${a.id}:${shake}`} a={a} size={size} gone={isGone} shake={shake} target={target?.id === a.id} onTap={() => tapArrow(a)} />;
            })}
            {/* The keyboard cursor, drawn over the arrows so it shows on any color. */}
            {keys && run.phase === 'play' && (
              <g className="oh-cursor">
                <rect x={(cursor % size) * U} y={Math.floor(cursor / size) * U} width={U} height={U} rx={3} />
                <rect className="oh-cursor-in" x={(cursor % size) * U} y={Math.floor(cursor / size) * U} width={U} height={U} rx={3} />
              </g>
            )}
          </svg>
          {run.phase === 'cleared' && (
            <button className="oh-banner" onClick={nextLevel}>
              <b>Level {run.n} clear!</b>
              <span>+{run.gained}{run.mistakes === 0 ? ' · flawless' : ''}</span>
            </button>
          )}
        </div>
        <p className="oh-help">Tap an arrow to send it off. Blocked arrows cost a heart.</p>
      </div>
      {run.phase === 'over' && (
        <div className="oh-over">
          <h2>{dayRun(mode) && levels >= DAILY_LEVELS ? 'All clear!' : 'Out of hearts'}</h2>
          {note && <p className="oh-muted">{note}</p>}
          <p className="oh-big">{run.banked}</p>
          <p className="oh-muted">
            {levels} level{levels === 1 ? '' : 's'} cleared {newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={resultLine(run.history)} label={`${levels} levels cleared, ${run.banked} points`} />
          {mode === 'daily' && daily && (
            <p className="oh-muted">
              That was {run.day === dayKey() ? 'today’s' : 'the day’s'} one try. <NextDaily />
            </p>
          )}
          <div className="oh-row">
            {mode === 'challenge' && challenge ? (
              <a className="oh-btn oh-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} ref={goRefSet}>
                See the scoreboard
              </a>
            ) : (
              <button className="oh-btn oh-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} ref={goRefSet}>
                {mode === 'daily' ? 'Play endless' : 'Play again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Outta Here #${dailyNumber(run.day)} ➡️\n${daily.line}\nScore: ${daily.best}\n${window.location.origin}/games/outta-here`} />}
            <button className="oh-btn" onClick={() => show(null)}>
              Menu
            </button>
          </div>
        </div>
      )}
      {intro && (
        <Coach
          steps={COACH}
          onClose={() => {
            coach.close();
            // The level's speed clock starts when the board is really in view.
            if (runRef.current && runRef.current.gone.size === 0 && runRef.current.mistakes === 0) levelStart.current = now();
          }}
        />
      )}
    </div>
  );
}

/** One arrow: an outlined capsule from tail to head with a pointed tip, plus a tap area over its cells. */
function ArrowShape({ a, size, gone, shake, target, onTap }: { a: Arrow; size: number; gone: boolean; shake: number; target: boolean; onTap: () => void }) {
  const U = 10;
  const at = (i: number): [number, number] => [(i % size) * U + U / 2, Math.floor(i / size) * U + U / 2];
  const [tx, ty] = at(a.cells[0]!);
  const [hx, hy] = at(a.cells[a.cells.length - 1]!);
  const dx = DC[a.dir];
  const dy = DR[a.dir];
  // The tip pokes a little past the head cell's center; the body starts a little before the tail's.
  const sx = tx - dx * 2.6;
  const sy = ty - dy * 2.6;
  const bx = hx + dx * 0.6;
  const by = hy + dy * 0.6;
  const tip = `${hx + dx * 4.4},${hy + dy * 4.4} ${hx - dy * 3.6 + dx * 0.2},${hy + dx * 3.6 + dy * 0.2} ${hx + dy * 3.6 + dx * 0.2},${hy - dx * 3.6 + dy * 0.2}`;
  const minX = Math.min(tx, hx) - U / 2;
  const minY = Math.min(ty, hy) - U / 2;
  const fly = size * U + 20;
  return (
    <g
      className={`oh-arrow${gone ? ' is-gone' : ''}${shake ? ' is-shake' : ''}${target ? ' is-target' : ''}`}
      style={{ ['--c' as string]: PALETTE[a.color], ...(gone ? { transform: `translate(${dx * fly}px, ${dy * fly}px)` } : {}) }}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
    >
      <rect className="oh-hit" x={minX} y={minY} width={Math.abs(hx - tx) + U} height={Math.abs(hy - ty) + U} />
      <line className="oh-ink" x1={sx} y1={sy} x2={bx} y2={by} />
      <polygon className="oh-ink-tip" points={tip} />
      <line className="oh-body" x1={sx} y1={sy} x2={bx} y2={by} />
      <polygon className="oh-tip" points={tip} />
      <line className="oh-shine" x1={sx - dy * 1.1} y1={sy + dx * 1.1} x2={bx - dy * 1.1 - dx * 1.5} y2={by + dx * 1.1 - dy * 1.5} />
    </g>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="oh-btn" onClick={() => void shareOrCopy({ title: 'Outta Here', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode) => void; onMute: () => void }) {
  // First time on the menu: a short walkthrough of the rules (the ? button brings it back).
  const coach = useCoach('outta-here');
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today ? save.progress : null;
  return (
    <div className="oh oh-menu">
      <div className="oh-menu-top">
        <button className="oh-icon" onClick={coach.show} aria-label="How to play">
          ?
        </button>
        <button className="oh-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="oh-icon" />
      </div>
      <div className="oh-logo" aria-hidden="true">
        <span>⬆</span>
        <span>➡</span>
        <span>⬅</span>
      </div>
      <h1 className="oh-title">
        Outta <span>Here</span>
      </h1>
      <p className="oh-tag">Every arrow wants out. Tap them in the right order: one in the way costs a heart.</p>
      <section className="oh-card">
        <div className="oh-card-head">
          <b>Daily #{dailyNumber(today)}</b>
          <span>{going ? `In progress · level ${going.n} of ${DAILY_LEVELS}` : daily?.open !== undefined ? 'Left unfinished · one try a day' : daily ? `Today: ${daily.best}` : `${DAILY_LEVELS} levels, the same for everyone · one try a day`}</span>
        </div>
        {going ? (
          <button className="oh-btn oh-btn-go oh-btn-big" onClick={() => onPlay('daily')}>
            Continue today’s levels
          </button>
        ) : daily ? (
          <div className="oh-done">
            {daily.best > 0 && <ShareButton text={`Outta Here #${dailyNumber(today)} ➡️\n${daily.line}\nScore: ${daily.best}\n${window.location.origin}/games/outta-here`} />}
            <NextDaily className="oh-muted" />
          </div>
        ) : (
          <button className="oh-btn oh-btn-go oh-btn-big" onClick={() => onPlay('daily')}>
            Play today’s levels
          </button>
        )}
      </section>
      <section className="oh-card">
        <div className="oh-card-head">
          <b>Endless</b>
          <span>Bigger boards as you go · a flawless level gives a heart back</span>
        </div>
        <button className="oh-btn oh-btn-big" onClick={() => onPlay('endless')}>
          Play endless
        </button>
      </section>
      <p className="oh-muted">
        Best {save.best} · most levels {save.bestLevels} · {save.runs} {save.runs === 1 ? 'game' : 'games'}
      </p>
      {coach.open && <Coach steps={COACH} onClose={coach.close} />}
    </div>
  );
}
