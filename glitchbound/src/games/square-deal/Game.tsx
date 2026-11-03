import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { fits, fromSaved, linesAfter, newGame, place, resultLine, SIZE, streakMultiplier, toSaved, type Piece, type Saved, type State } from './logic';
import { createSfx, type Sfx } from './sound';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.square-deal';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  lines: number;
  streak: number;
  /** true: started, not finished (it resumes from `progress`); false: left, could not be resumed, settled. */
  open?: boolean;
}
interface RoundResult {
  score: number;
  lines: number;
  streak: number;
}
/** A friends' challenge round, saved under `${id}:${round}`: one attempt, resumed after a reload or the menu. */
interface ChallengeRecord {
  /** The day it was first played (old ones are pruned). */
  day: string;
  game?: Saved;
  /** Set once the round ended: it was reported then, and only its result shows from now on. */
  result?: RoundResult;
}
interface Save {
  best: number;
  runs: number;
  lines: number;
  daily: Record<string, DailyRecord>;
  /** Today's deal so far, saved after every move. */
  progress?: { day: string; game: Saved };
  /** An endless game left for the menu (or a reload), saved after every move. */
  endless?: Saved;
  challenges: Record<string, ChallengeRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, runs: 0, lines: 0, daily: {}, challenges: {}, muted: false });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHALLENGES = 40;

function parseSave(raw: string): Save {
  try {
    const o = JSON.parse(raw) as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    if (!o || typeof o !== 'object') return s;
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.lines = n(o.lines);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (DAY.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries), lines: n(v.lines), streak: n(v.streak), ...(typeof v.open === 'boolean' ? { open: v.open } : {}) };
    const p = o.progress;
    const game = p && typeof p.day === 'string' ? fromSaved(p.game) : null;
    if (p && game) s.progress = { day: p.day, game: toSaved(game) };
    const endless = fromSaved(o.endless);
    if (endless && !endless.over) s.endless = toSaved(endless);
    if (o.challenges && typeof o.challenges === 'object')
      for (const [k, v] of Object.entries(o.challenges).slice(-MAX_CHALLENGES)) {
        if (!v || typeof v !== 'object' || typeof v.day !== 'string' || !DAY.test(v.day)) continue;
        const g = fromSaved(v.game);
        const r = v.result && typeof v.result === 'object' ? { score: n(v.result.score), lines: n(v.result.lines), streak: n(v.result.streak) } : undefined;
        s.challenges[k] = { day: v.day, ...(g ? { game: toSaved(g) } : {}), ...(r ? { result: r } : {}) };
      }
    return s;
  } catch {
    return emptySave();
  }
}
/** The stored save, or null when storage is blocked or holds nothing (then the in-memory copy stands). */
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
/** Keeps the newest challenge rounds only, like the dailies. */
const pruneChallenges = (c: Record<string, ChallengeRecord>): Record<string, ChallengeRecord> => Object.fromEntries(Object.entries(c).slice(-MAX_CHALLENGES));
/** The day's daily was played (finished, or left and settled): it never plays again. */
const isDone = (r: DailyRecord | undefined): boolean => r !== undefined && !r.open;
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const dailySeed = (day: string): number => hashString(`square-deal:${day}`);
const challengeKey = (c: ChallengeSpec): string => `${c.id}:${c.round}`;
/** "Today's daily" challenges play the game's own daily for that day (and count as it). */
const challengeDay = (c: ChallengeSpec): string | null => (c.mode === 'daily' && DAY.test(c.day) ? c.day : null);

/** A finished round for the result card: its last board when it was kept, and its numbers. */
function endedGame(saved: Saved | undefined, seed: number, r: RoundResult): State {
  const g = (saved && fromSaved(saved)) ?? newGame(seed);
  return { ...g, score: r.score, lines: r.lines, bestStreak: r.streak, over: true };
}

/**
 * Where a challenge round stands in this save: finished (its result, never played again), the day's
 * daily already played (that result counts), or the round to play, resumed exactly where it was.
 */
function openChallenge(cur: Save, c: ChallengeSpec): { game: State; settle?: RoundResult } {
  const day = challengeDay(c);
  const seed = day ? dailySeed(day) : c.seed;
  const rec = cur.challenges[challengeKey(c)];
  if (rec?.result) return { game: endedGame(rec.game, seed, rec.result) };
  if (day) {
    const d = cur.daily[day];
    const going = d?.open && cur.progress?.day === day ? fromSaved(cur.progress.game) : null;
    if (going) return { game: going };
    if (d) {
      const settle = { score: d.best, lines: d.lines, streak: d.streak };
      return { game: endedGame(undefined, seed, settle), settle };
    }
  }
  const kept = rec?.game ? fromSaved(rec.game) : null;
  return { game: kept && kept.seed === seed ? kept : newGame(seed) };
}

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * The top-left that centers a piece on a cell, kept on the board: taps and the key cursor aim the
 * same way, and at an edge the piece lines up with it instead of hanging off.
 */
const centeredOn = (p: Piece, row: number, col: number): { row: number; col: number } => ({
  row: Math.max(0, Math.min(SIZE - p.h, row - Math.floor((p.h - 1) / 2))),
  col: Math.max(0, Math.min(SIZE - p.w, col - Math.floor((p.w - 1) / 2))),
});

/** Where a dragged or selected piece would land, and whether it fits there. */
interface Aim {
  slot: number;
  row: number;
  col: number;
  ok: boolean;
}
interface Drag {
  slot: number;
  x: number;
  y: number;
  /** Pointer offset inside the piece, in cells, and how far the piece floats above a finger. */
  gx: number;
  gy: number;
  lift: number;
  cell: number;
  moved: boolean;
  aim: Aim | null;
}

/** The streak where the multiplier tops out (×4). */
const MAX_STREAK = 7;
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <SquareDeal key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function SquareDeal({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  // Re-read whenever the menu shows, the tab comes back or a round starts, so a page left open past
  // midnight deals the new day. A round keeps the day it started on (`roundDay`).
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  // Every write merges into the stored save (another tab may have written since), never the stale copy.
  const update = useCallback((fn: (cur: Save) => Save): Save => {
    const next = fn(readStored() ?? saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
    return next;
  }, []);
  // A friends' challenge skips the menu: its round, resumed where it was, or its result.
  const [boot] = useState(() => (challenge ? openChallenge(save, challenge) : null));
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood (0), so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const rec = saveRef.current.daily[today];
    if (rec?.open && saveRef.current.progress?.day !== today) {
      update((cur) => ({ ...cur, daily: { ...cur.daily, [today]: { ...rec, open: false } } }));
      host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    }
    // The day's daily was already played: that result is this challenge round's score, reported once.
    if (challenge && boot?.settle) settleChallenge(boot.settle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const roundDay = useRef(today);
  const [note, setNote] = useState(boot?.settle ? 'Your daily result counts here.' : '');
  const [game, setGame] = useState<State | null>(boot?.game ?? null);
  const gameRef = useRef(game);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState({ row: 3, col: 3 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [fx, setFx] = useState<{ cells: Set<number>; text: string; key: number; lost?: boolean } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** The player used the keys: the help line shows the key controls. */
  const [keyHints, setKeyHints] = useState(false);
  const started = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  const overTune = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(overTune.current);
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  // Nothing runs on a clock, so the arcade's pause request only needs to drop a drag in progress.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (drag) setDrag(null);
  }

  const show = (g: State | null): void => {
    gameRef.current = g;
    setGame(g);
    setLeaving(false);
    if (!g) setToday(dayKey());
  };

  function settleChallenge(r: RoundResult): void {
    if (!challenge) return;
    const key = challengeKey(challenge);
    if (readStored()?.challenges[key]?.result) return;
    update((cur) => ({ ...cur, challenges: pruneChallenges({ ...cur.challenges, [key]: { day: cur.challenges[key]?.day ?? dayKey(), result: r } }) }));
    host.report({ type: 'end', score: r.score, stats: { lines: r.lines, streak: r.streak }, challenge: { id: challenge.id, round: challenge.round } });
  }

  const begin = (m: Mode, fresh = false): void => {
    const now = dayKey();
    setToday(now);
    const cur = readStored() ?? saveRef.current;
    // Today's deal while today's daily challenge is open is the same one attempt: play it as the challenge.
    const play: Mode = m === 'daily' && challenge && challengeDay(challenge) === now ? 'challenge' : m;
    let next: State;
    let day = now;
    if (play === 'challenge' && challenge) {
      const opened = openChallenge(cur, challenge);
      next = opened.game;
      day = cur.challenges[challengeKey(challenge)]?.day ?? now;
      setNote(opened.settle ? 'Your daily result counts here.' : '');
      if (opened.settle) settleChallenge(opened.settle);
    } else if (play === 'daily') {
      // Today's daily is one try: starting it uses the try up. Leaving it halfway (menu, reload) is
      // fine, it carries on from the last move, but it can never be started over.
      const kept = cur.daily[now]?.open && cur.progress?.day === now ? fromSaved(cur.progress.game) : null;
      if (!kept) {
        if (cur.daily[now]) {
          saveRef.current = cur;
          setSave(cur);
          return;
        }
        update((c) => ({ ...c, daily: { ...c.daily, [now]: { best: 0, tries: 1, lines: 0, streak: 0, open: true } }, progress: { day: now, game: toSaved(newGame(dailySeed(now))) } }));
      }
      next = kept ?? newGame(dailySeed(now));
    } else {
      const kept = !fresh && cur.endless ? fromSaved(cur.endless) : null;
      if (fresh && cur.endless) update((c) => ({ ...c, endless: undefined }));
      next = kept && !kept.over ? kept : newGame(randomSeed());
    }
    roundDay.current = day;
    // A resumed round already reported its start (the arcade handles resumed runs).
    started.current = next.moves > 0;
    setMode(play);
    setSelected(null);
    setDrag(null);
    setFx(null);
    setNewBest(false);
    show(next);
  };

  const finish = (s: State): void => {
    const day = roundDay.current;
    const cday = mode === 'challenge' && challenge ? challengeDay(challenge) : null;
    const asDaily = mode === 'daily' ? day : cday;
    const key = mode === 'challenge' && challenge ? challengeKey(challenge) : '';
    const stored = readStored();
    // Another tab already ended this round: show its result, never report it twice.
    if (key && stored?.challenges[key]?.result) {
      show(endedGame(stored.challenges[key].game, s.seed, stored.challenges[key].result));
      return;
    }
    if (asDaily && !key && isDone(stored?.daily[asDaily])) {
      show(null);
      return;
    }
    setNewBest(s.score > (stored ?? saveRef.current).best);
    const result = { score: s.score, lines: s.lines, streak: s.bestStreak };
    update((cur) => ({
      ...cur,
      best: Math.max(cur.best, s.score),
      runs: cur.runs + 1,
      lines: cur.lines + s.lines,
      daily: asDaily ? { ...cur.daily, [asDaily]: { best: s.score, tries: 1, lines: s.lines, streak: s.bestStreak } } : cur.daily,
      progress: asDaily && cur.progress?.day === asDaily ? undefined : cur.progress,
      endless: mode === 'endless' ? undefined : cur.endless,
      challenges: key ? pruneChallenges({ ...cur.challenges, [key]: { day: cur.challenges[key]?.day ?? day, game: toSaved(s), result } }) : cur.challenges,
    }));
    const end = { type: 'end' as const, score: s.score, stats: { lines: s.lines, streak: s.bestStreak } };
    host.report(mode === 'daily' ? { ...end, daily: true } : key && challenge ? { ...end, ...(cday && cday === dayKey() ? { daily: true } : {}), challenge: { id: challenge.id, round: challenge.round } } : end);
    overTune.current = window.setTimeout(() => sfx().over(), 250);
  };

  // A round saved before it ended (an old save, or a crash between moves) ends now, once.
  useEffect(() => {
    if (boot && !boot.settle && boot.game.over && !(challenge && saveRef.current.challenges[challengeKey(challenge)]?.result)) finish(boot.game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves the round after a move, so the menu or a reload never loses it. */
  const keep = (state: State): void => {
    const day = roundDay.current;
    if (mode === 'daily') update((cur) => ({ ...cur, progress: { day, game: toSaved(state) } }));
    else if (mode === 'endless') update((cur) => ({ ...cur, endless: toSaved(state) }));
    else if (challenge) {
      const key = challengeKey(challenge);
      const cday = challengeDay(challenge);
      update((cur) => ({
        ...cur,
        challenges: pruneChallenges({ ...cur.challenges, [key]: { day: cur.challenges[key]?.day ?? day, game: toSaved(state) } }),
        // Today's daily challenge is the day's daily too: its first move uses the daily's one try.
        ...(cday ? { daily: { ...cur.daily, [cday]: cur.daily[cday] ?? { best: 0, tries: 1, lines: 0, streak: 0, open: true } }, progress: { day: cday, game: toSaved(state) } } : {}),
      }));
    }
  };

  const tryPlace = (slot: number, row: number, col: number): boolean => {
    const s = gameRef.current;
    if (!s || s.over) return false;
    const { state, result } = place(s, slot, row, col);
    if (!result.ok) {
      sfx().nope();
      return false;
    }
    // This tab's daily was finished in another tab meanwhile: leave the stale round.
    const stored = readStored();
    if (stored && mode === 'daily' && isDone(stored.daily[roundDay.current])) {
      saveRef.current = stored;
      setSave(stored);
      show(null);
      return false;
    }
    if (!started.current) {
      started.current = true;
      host.report({ type: 'start' });
    }
    sfx().place();
    if (result.lines) {
      sfx().clear(result.lines, state.streak);
      navigator.vibrate?.(20);
      setFx({ cells: new Set(result.cleared), text: `+${result.points}${state.streak > 1 ? ` · 🔥×${streakMultiplier(state.streak)}` : ''}`, key: state.moves });
    } else if (s.streak > 1) setFx({ cells: new Set(), text: 'Streak lost', key: state.moves, lost: true }); // a move that cleared nothing ends it
    setSelected(null);
    show(state);
    if (state.over) finish(state);
    else keep(state);
    return true;
  };

  // Another tab wrote the save: take its numbers, and leave a round it already finished.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = loadSave();
      saveRef.current = s;
      setSave(s);
      const g = gameRef.current;
      if (!g || g.over) return;
      const rec = challenge && mode === 'challenge' ? s.challenges[challengeKey(challenge)] : undefined;
      if (rec?.result) show(endedGame(rec.game, g.seed, rec.result));
      else if (mode === 'daily' && isDone(s.daily[roundDay.current])) show(null);
    };
    const onBack = (): void => {
      if (document.visibilityState !== 'hidden') setToday(dayKey());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  });

  // Board cell under a dragged piece: snap its top-left to the nearest cell.
  const aimFor = (d: Omit<Drag, 'aim'>): Aim | null => {
    const s = gameRef.current;
    const b = boardRef.current?.getBoundingClientRect();
    const piece = s?.tray[d.slot];
    if (!s || !b || !piece) return null;
    const cell = (b.width - 12) / SIZE;
    const left = d.x - d.gx * d.cell;
    const top = d.y - d.gy * d.cell - d.lift;
    const col = Math.round((left - b.left - 6) / cell);
    const row = Math.round((top - b.top - 6) / cell);
    if (row < -1 || col < -1 || row > SIZE || col > SIZE) return null;
    return { slot: d.slot, row, col, ok: fits(s.board, piece, row, col) };
  };

  // Drag state lives in a ref for the window listeners; React state only mirrors it for drawing.
  const dragRef = useRef<Drag | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  // When a pointer last let go: the click that follows it was handled already (tap select, tap place).
  const lastUp = useRef(-Infinity);
  const dragPointer = useRef(0);
  const fromPointer = (): boolean => performance.now() - lastUp.current < 600;

  const onTrayDown = (e: RPointerEvent<HTMLButtonElement>, slot: number): void => {
    const s = gameRef.current;
    const piece = s?.tray[slot];
    const b = boardRef.current?.getBoundingClientRect();
    if (!s || s.over || !piece || !b || dragRef.current) return;
    e.preventDefault();
    sfx().pick();
    const cell = (b.width - 12) / SIZE;
    dragStart.current = { x: e.clientX, y: e.clientY };
    // Hold the piece by its middle. On a phone it floats with its bottom edge just above the finger,
    // so the whole piece (and the ghost under it) stays visible, however tall it is.
    const touch = e.pointerType === 'touch';
    dragRef.current = { slot, x: e.clientX, y: e.clientY, gx: piece.w / 2, gy: touch ? piece.h : piece.h / 2, lift: touch ? cell * 0.9 : 0, cell, moved: false, aim: null };
    dragPointer.current = e.pointerId;
    setDrag(dragRef.current);
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent): void => {
      const d = dragRef.current;
      if (!d || e.pointerId !== dragPointer.current) return;
      const moved = d.moved || Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 6;
      const next = { ...d, x: e.clientX, y: e.clientY, moved };
      dragRef.current = { ...next, aim: moved ? aimFor(next) : null };
      setDrag(dragRef.current);
    };
    const up = (e: PointerEvent): void => {
      const d = dragRef.current;
      if (!d || e.pointerId !== dragPointer.current) return;
      dragRef.current = null;
      setDrag(null);
      lastUp.current = performance.now();
      if (e.type === 'pointercancel') return;
      if (d.moved) {
        const aim = aimFor({ ...d, x: e.clientX, y: e.clientY });
        if (aim?.ok) tryPlace(aim.slot, aim.row, aim.col);
        else if (aim) sfx().nope(); // dropped on the board where it doesn't fit: it goes back
      } else setSelected((cur) => (cur === d.slot ? null : d.slot)); // a tap selects (then tap a cell, or use the keys)
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // A tray piece activated without a pointer (Enter / Space on it, a screen reader's double tap):
  // select it and move focus to the board, where the arrows aim it and Enter places it.
  const onTrayClick = (slot: number): void => {
    if (fromPointer() || !gameRef.current?.tray[slot]) return;
    setKeyHints(true);
    setSelected((cur) => (cur === slot ? null : slot));
    if (selected !== slot) boardRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  };

  // A selected piece goes where the player taps, centered on the tapped cell (as on the key cursor).
  const onCellTap = (i: number): void => {
    const s = gameRef.current;
    if (selected === null || !s) return;
    const piece = s.tray[selected];
    if (!piece) return;
    const at = centeredOn(piece, Math.floor(i / SIZE), i % SIZE);
    tryPlace(selected, at.row, at.col);
  };

  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent): void => {
      const s = gameRef.current;
      if (!s || s.over || leaving) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const root = rootRef.current;
      if (target) {
        // Keys for a field or a dialog are not for the board, nor are keys for the page around the game.
        if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [aria-modal="true"]')) return;
        if (root && target !== document.body && !root.contains(target) && !target.contains(root)) return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const act = e.key === 'Enter' || e.key === ' ';
      // A keyboard-focused button keeps Enter / Space.
      if (act && target?.closest('button, a') && focusVisible(target)) return;
      if (e.key.length === 1 && e.key >= '1' && e.key <= '3') {
        if (e.repeat) return;
        const slot = Number(e.key) - 1;
        setKeyHints(true);
        if (s.tray[slot]) setSelected((cur) => (cur === slot ? null : slot));
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        setKeyHints(true);
        const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        setCursor((c) => ({ row: Math.max(0, Math.min(SIZE - 1, c.row + dr)), col: Math.max(0, Math.min(SIZE - 1, c.col + dc)) }));
      } else if (act && selected !== null) {
        e.preventDefault();
        const piece = s.tray[selected];
        const at = piece ? centeredOn(piece, cursor.row, cursor.col) : cursor;
        if (!e.repeat) tryPlace(selected, at.row, at.col);
      } else if (e.key === 'Escape' && selected !== null) setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The board's focus follows the cursor (one cell is in the tab order: a roving tabindex).
  useEffect(() => {
    const b = boardRef.current;
    const a = document.activeElement;
    if (b && a instanceof HTMLElement && a.classList.contains('sd-cell') && b.contains(a)) b.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [cursor]);

  useEffect(() => {
    if (!fx) return;
    const t = window.setTimeout(() => setFx(null), 900);
    return () => window.clearTimeout(t);
  }, [fx]);

  if (!game) return <Menu save={save} today={today} challenge={challenge} onPlay={begin} onMute={() => update((cur) => ({ ...cur, muted: !cur.muted }))} />;

  const s = game;
  // The aim: from a drag, else from the keyboard cursor while a piece is selected.
  const selPiece = selected !== null ? s.tray[selected] : null;
  const keyAt = selPiece ? centeredOn(selPiece, cursor.row, cursor.col) : null;
  const aim: Aim | null = drag ? drag.aim : selected !== null && selPiece && keyAt ? { slot: selected, ...keyAt, ok: fits(s.board, selPiece, keyAt.row, keyAt.col) } : null;
  const aimPiece = aim ? s.tray[aim.slot] : null;
  const ghost = new Set<number>();
  const blocked = new Set<number>();
  const willClear = new Set<number>();
  if (aim && aimPiece) {
    // Where it doesn't fit, its footprint (the part on the board) shows in the "blocked" style.
    for (const [y, x] of aimPiece.cells) {
      const r = aim.row + y;
      const c = aim.col + x;
      if (r >= 0 && c >= 0 && r < SIZE && c < SIZE) (aim.ok ? ghost : blocked).add(r * SIZE + c);
    }
    if (aim.ok) {
      const { rows, cols } = linesAfter(s.board, aimPiece, aim.row, aim.col);
      for (const r of rows) for (let c = 0; c < SIZE; c++) willClear.add(r * SIZE + c);
      for (const c of cols) for (let r = 0; r < SIZE; r++) willClear.add(r * SIZE + c);
    }
  }
  const daily = mode === 'daily' ? save.daily[roundDay.current] : undefined;
  const dragPiece = drag ? s.tray[drag.slot] : null;
  const onMenu = (): void => {
    // A challenge round is one attempt: ask before leaving it (it is kept, and the menu leads back).
    if (mode === 'challenge' && !s.over) setLeaving(true);
    else show(null);
  };

  return (
    <div className="sd" ref={rootRef}>
      <div className="sd-play">
        <div className="sd-hud" aria-live="polite">
          <span className="game-menu-pair">
            <button className="sd-icon" onClick={onMenu} aria-label="Menu">
              ☰
            </button>
            <GameMenuButton className="sd-icon" />
          </span>
          <div className={`sd-score${String(s.score).length > 5 ? ' is-long' : ''}`}>
            <b>{s.score}</b>
            <span>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : mode === 'daily' ? `Daily #${dailyNumber(roundDay.current)}` : `Best ${save.best}`}</span>
          </div>
          <div className={`sd-streak-box${fx?.lost ? ' is-lost' : ''}`} aria-label={`Streak ${s.streak}: line points ×${streakMultiplier(s.streak)}${s.streak < MAX_STREAK ? `, the next clear ×${streakMultiplier(s.streak + 1)}` : ''}`}>
            <div className={`sd-streak${s.streak > 1 ? ' is-on' : ''}`}>🔥 ×{streakMultiplier(s.streak)}</div>
            {/* What the streak is and what the next clear is worth; any move that clears nothing ends it. */}
            <small aria-hidden="true">
              <span>{s.streak > 0 ? `${s.streak} in a row` : 'clear lines'}</span>
              <span>{s.streak === 0 ? 'back to back' : s.streak < MAX_STREAK ? `next ×${streakMultiplier(s.streak + 1)}` : 'max ×4'}</span>
            </small>
          </div>
        </div>
        <div className="sd-board" ref={boardRef} role="grid" aria-label="Board, 8 by 8">
          {Array.from({ length: SIZE }, (_, r) => (
            <div key={r} className="sd-brow" role="row">
              {s.board.slice(r * SIZE, r * SIZE + SIZE).map((v, c) => {
                const i = r * SIZE + c;
                const here = r === cursor.row && c === cursor.col;
                const isCursor = !drag && selected !== null && here;
                const cls = ['sd-cell', v >= 0 ? `is-filled is-c${v}` : '', ghost.has(i) && aimPiece ? `is-ghost is-g${aimPiece.color}` : '', blocked.has(i) ? 'is-blocked' : '', willClear.has(i) ? 'is-clear' : '', fx?.cells.has(i) ? 'is-burst' : '', isCursor ? 'is-cursor' : ''].filter(Boolean).join(' ');
                return (
                  <div
                    key={fx?.cells.has(i) ? `${i}:${fx.key}` : i}
                    className={cls}
                    role="gridcell"
                    aria-label={`Row ${r + 1}, column ${c + 1}, ${v >= 0 ? 'filled' : 'empty'}`}
                    tabIndex={here ? 0 : -1}
                    onFocus={() => setCursor((cur) => (cur.row === r && cur.col === c ? cur : { row: r, col: c }))}
                    onPointerUp={() => {
                      if (drag) return;
                      lastUp.current = performance.now();
                      onCellTap(i);
                    }}
                    onClick={() => !fromPointer() && onCellTap(i)}
                  />
                );
              })}
            </div>
          ))}
          {fx && (
            <span key={fx.key} className={`sd-pop${fx.lost ? ' is-lost' : ''}`}>
              {fx.text}
            </span>
          )}
        </div>
        <div className="sd-tray">
          {s.tray.map((p, slot) => (
            <button
              key={p ? p.id : `empty${slot}`}
              className={`sd-slot${selected === slot ? ' is-selected' : ''}${drag?.slot === slot ? ' is-dragging' : ''}`}
              onPointerDown={(e) => p && onTrayDown(e, slot)}
              onClick={() => onTrayClick(slot)}
              disabled={!p || s.over}
              aria-pressed={selected === slot}
              aria-label={p ? `Piece ${slot + 1}: ${p.cells.length} squares, ${p.w} wide, ${p.h} tall` : 'Used'}
            >
              {p && <Shape piece={p} unit="var(--sd-mini)" />}
            </button>
          ))}
        </div>
        <p className="sd-help">
          {keyHints ? (
            selected !== null ? 'Arrows aim · Enter places · Esc drops it' : '1–3 pick a piece · arrows aim · Enter places'
          ) : selected !== null ? (
            'Tap a square to place it, or drag it on'
          ) : (
            <>
              Drag a piece onto the board<span className="sd-keys"> · or press 1–3</span>
            </>
          )}
        </p>
      </div>
      {drag && dragPiece && drag.moved && (
        <div className="sd-float" style={{ left: drag.x - drag.gx * drag.cell, top: drag.y - drag.gy * drag.cell - drag.lift, ['--sd-unit' as string]: `${drag.cell - 3}px` }}>
          <Shape piece={dragPiece} unit="var(--sd-unit)" />
        </div>
      )}
      {leaving && (
        <div className="sd-over" role="dialog" aria-modal="true" aria-labelledby="sd-leave-title">
          <h2 id="sd-leave-title">Leave the challenge?</h2>
          <p className="sd-muted">This round is your one try. It’s saved: come back to it from the menu or the challenge link.</p>
          <div className="sd-row">
            <button className="sd-btn sd-btn-go" onClick={() => setLeaving(false)} autoFocus>
              Keep playing
            </button>
            <button className="sd-btn" onClick={() => show(null)}>
              Leave
            </button>
          </div>
        </div>
      )}
      {s.over && (
        <div className="sd-over">
          <h2>{s.score >= 1500 ? 'What a deal!' : 'No room left'}</h2>
          <p className="sd-big">{s.score}</p>
          <p className="sd-muted">
            {s.lines} {s.lines === 1 ? 'line' : 'lines'}
            {s.bestStreak > 1 ? ` · best streak ${s.bestStreak} (×${streakMultiplier(s.bestStreak)})` : ''} {newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={resultLine(s.score, s.lines, s.bestStreak)} label={`${s.score} points, ${s.lines} ${s.lines === 1 ? 'line' : 'lines'}`} />
          {note && <p className="sd-muted">{note}</p>}
          {mode === 'daily' && daily && (
            <p className="sd-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="sd-row">
            {mode === 'challenge' && challenge ? (
              <a className="sd-btn sd-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="sd-btn sd-btn-go" onClick={() => begin('endless')} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Play again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={shareText(roundDay.current, daily)} />}
            <button className="sd-btn" onClick={() => show(null)}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Shape({ piece, unit }: { piece: Piece; unit: string }) {
  return (
    <span className="sd-shape" style={{ gridTemplateColumns: `repeat(${piece.w}, ${unit})`, gridTemplateRows: `repeat(${piece.h}, ${unit})` }}>
      {piece.cells.map(([y, x]) => (
        <i key={`${y}:${x}`} className={`is-c${piece.color}`} style={{ gridRow: y + 1, gridColumn: x + 1 }} />
      ))}
    </span>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="sd-btn" onClick={() => void shareOrCopy({ title: 'Square Deal', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

const shareText = (day: string, d: DailyRecord): string => `Square Deal #${dailyNumber(day)} 🟧\n${resultLine(d.best, d.lines, d.streak)}\nScore: ${d.best}\n${window.location.origin}/games/square-deal`;

function Menu({ save, today, challenge, onPlay, onMute }: { save: Save; today: string; challenge?: ChallengeSpec; onPlay: (m: Mode, fresh?: boolean) => void; onMute: () => void }) {
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today ? save.progress.game : null;
  const round = challenge ? save.challenges[challengeKey(challenge)] : undefined;
  return (
    <div className="sd sd-menu">
      <div className="sd-menu-top">
        <button className="sd-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="sd-icon" />
      </div>
      <div className="sd-logo" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <i key={i} className={`is-c${[3, 3, 1, 3, 5, 1, 0, 0, 1][i]}`} />
        ))}
      </div>
      <h1 className="sd-title">
        Square <span>Deal</span>
      </h1>
      <p className="sd-tag">Drop the blocks, fill a row or a column, watch it clear. Chain clears for a streak.</p>
      <div className="sd-cards">
        {challenge && (
          <section className="sd-card">
            <div className="sd-card-head">
              <b>⚔️ Challenge · round {challenge.round}</b>
              <span>{round?.result ? `Your score: ${round.result.score}` : round?.game ? `In progress · ${round.game.score} so far` : 'One try, the same pieces for everyone'}</span>
            </div>
            <button className="sd-btn sd-btn-go sd-btn-big" onClick={() => onPlay('challenge')}>
              {round?.result ? 'See your result' : 'Back to the challenge'}
            </button>
          </section>
        )}
        <section className="sd-card">
          <div className="sd-card-head">
            <b>Daily deal #{dailyNumber(today)}</b>
            <span>{going ? `In progress · ${going.score} so far` : daily?.open !== undefined ? 'Left unfinished · one try a day' : daily ? `Today: ${daily.best}` : 'The same pieces for everyone · one try a day'}</span>
          </div>
          {going ? (
            <button className="sd-btn sd-btn-go sd-btn-big" onClick={() => onPlay('daily')}>
              Continue today’s deal
            </button>
          ) : daily ? (
            <div className="sd-done">
              {daily.best > 0 && <ShareButton text={shareText(today, daily)} />}
              <NextDaily className="sd-muted" />
            </div>
          ) : (
            <button className="sd-btn sd-btn-go sd-btn-big" onClick={() => onPlay('daily')}>
              Play today’s deal
            </button>
          )}
        </section>
        <section className="sd-card">
          <div className="sd-card-head">
            <b>Endless</b>
            <span>{save.endless ? `In progress · ${save.endless.score} so far` : 'A fresh shuffle every game'}</span>
          </div>
          {save.endless ? (
            <div className="sd-row sd-row-fill">
              <button className="sd-btn sd-btn-big" onClick={() => onPlay('endless')}>
                Continue endless
              </button>
              <button className="sd-btn" onClick={() => onPlay('endless', true)}>
                New game
              </button>
            </div>
          ) : (
            <button className="sd-btn sd-btn-big" onClick={() => onPlay('endless')}>
              Play endless
            </button>
          )}
        </section>
      </div>
      <p className="sd-muted">
        Best {save.best} · {save.runs} {save.runs === 1 ? 'game' : 'games'} · {save.lines} {save.lines === 1 ? 'line' : 'lines'} cleared
      </p>
    </div>
  );
}
