import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { ResultLine } from '../../components/ResultLine';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import { basicLang, type BasicLang } from '../../platform/contentLang';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { createRoom, roomInfo, seatedName } from '../../platform/rooms';
import { OnlinePlay } from '../../components/OnlinePlay';
import { shareOrCopy } from '../../platform/share';
import { choosePlay, LEVELS, type Level } from './ai';
import { Board, moveMs } from './Board';
import { LiveBoard } from './live';
import { bookGame, CHECKERS, endTurn, mustPass, newMatch, nextGame, passTurn, pips, planStep, posKey, rng, roll, step, TARGETS, turnDone, type Game as BgGame, type Match, type Pos, type Step } from './logic';
import { createSfx, type Sfx } from './sound';
import { WORDS, type Words } from './text';
import './Game.css';

const KEY = 'glitchbound.backgammon';
const EPOCH = '2026-10-21';
const SLUG = 'backgammon';

type Mode = 'match' | 'daily' | 'challenge';

interface Run {
  mode: Mode;
  level: Level;
  match: Match;
  /** 'start' was reported in this page visit (never kept: a resumed run reports it again, BG-03). */
  started: boolean;
  /** The game just finished (kept with the run so a resumed run shows it, never books it twice). */
  sheet: { winner: 0 | 1; points: number } | null;
  /** A daily's day (today's game, or a "Today's daily" challenge): it finishes as that day's game. */
  day?: string;
}

interface Result {
  mode: Mode;
  score: number;
  won: boolean;
  mine: number;
  theirs: number;
  line: string;
  best: boolean;
  kind: number;
  /** The daily it was (for its number). */
  day?: string;
  /** A "Today's daily" challenge that took the daily you had already played. */
  counts?: boolean;
}

/** A friends' challenge round: the run so far (a fresh round's; a daily one plays in the daily slot) and its result once done. */
interface ChallengeRec {
  run: Run | null;
  result: Result | null;
  at: number;
}

interface Save {
  best: number;
  runs: number;
  wins: number;
  daily: Record<string, { score: number; line: string; points?: number }>;
  level: Level;
  target: number;
  muted: boolean;
  musicOff: boolean;
  /** One run per mode, so starting one never throws the other away (BG-04). */
  current: { match: Run | null; daily: Run | null };
  challenges: Record<string, ChallengeRec>;
}

const emptySave = (): Save => ({ best: 0, runs: 0, wins: 0, daily: {}, level: 'medium', target: 5, muted: false, musicOff: false, current: { match: null, daily: null }, challenges: {} });
const dailySeed = (day: string): number => hashString(`${SLUG}:${day}`);
const challengeKey = (c: ChallengeSpec): string => `${c.id}:${c.round}`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ---- a saved run is checked all the way down before it is played (a damaged one is dropped, BG-07)
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isSide = (v: unknown): v is 0 | 1 => v === 0 || v === 1;
const isPair = (v: unknown, lo: number, hi: number): boolean => Array.isArray(v) && v.length === 2 && isInt(v[0], lo, hi) && isInt(v[1], lo, hi);
function validPos(p: unknown): p is Pos {
  const o = p as Pos | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.pts) || o.pts.length !== 25 || !o.pts.every((n) => isInt(n, -CHECKERS, CHECKERS))) return false;
  if (!isPair(o.bar, 0, CHECKERS) || !isPair(o.off, 0, CHECKERS) || o.pts[0] !== 0) return false;
  let a = o.bar[0] + o.off[0];
  let b = o.bar[1] + o.off[1];
  for (let i = 1; i <= 24; i++) {
    if (o.pts[i]! > 0) a += o.pts[i]!;
    else b -= o.pts[i]!;
  }
  return a === CHECKERS && b === CHECKERS;
}
const validStep = (st: unknown): boolean => !!st && typeof st === 'object' && isInt((st as Step).from, 0, 25) && isInt((st as Step).to, 0, 25) && isInt((st as Step).die, 1, 6);
function validGame(g: unknown): g is BgGame {
  const o = g as BgGame | null;
  if (!o || typeof o !== 'object' || !isInt(o.seed, 0, 2 ** 32 - 1) || !validPos(o.pos) || !validPos(o.turnStart) || !isSide(o.turn)) return false;
  if (!['opening', 'roll', 'move', 'over'].includes(o.phase) || !(o.roll === null || isPair(o.roll, 1, 6))) return false;
  if (!Array.isArray(o.left) || o.left.length > 4 || !o.left.every((d) => isInt(d, 1, 6)) || !Array.isArray(o.steps) || o.steps.length > 4 || !o.steps.every(validStep)) return false;
  if (!isInt(o.rolls, 0, 100000) || !(o.winner === null || isSide(o.winner)) || !isInt(o.points, 0, 3)) return false;
  if (o.phase === 'move' && !o.roll) return false;
  const l = o.lastTurn;
  return l === null || l === undefined || (typeof l === 'object' && isSide(l.side) && (l.roll === null || isPair(l.roll, 1, 6)) && Array.isArray(l.steps) && l.steps.every(validStep));
}
function validRun(c: unknown): Run | null {
  const o = c as Run | null;
  if (!o || typeof o !== 'object' || !['match', 'daily', 'challenge'].includes(o.mode) || !LEVELS.includes(o.level)) return null;
  const m = o.match;
  if (!m || typeof m !== 'object' || !isInt(m.seed, 0, 2 ** 32 - 1) || !isInt(m.target, 1, 7) || !isPair(m.score, 0, 99) || !isInt(m.games, 1, 999) || !(m.winner === null || isSide(m.winner))) return null;
  if (!Array.isArray(m.results) || !m.results.every((x) => x && isSide(x.winner) && isInt(x.points, 1, 3)) || !validGame(m.game)) return null;
  const sh = o.sheet;
  const sheet = sh && typeof sh === 'object' && isSide(sh.winner) && isInt(sh.points, 1, 3) ? { winner: sh.winner, points: sh.points } : null;
  const day = typeof o.day === 'string' && DAY.test(o.day) ? o.day : undefined;
  return { mode: o.mode, level: o.level, match: { ...m, game: { ...m.game, lastTurn: m.game.lastTurn ?? null } }, started: false, sheet, ...(day ? { day } : {}) };
}
function validResult(r: unknown): Result | null {
  const o = r as Result | null;
  if (!o || typeof o !== 'object' || !['match', 'daily', 'challenge'].includes(o.mode) || !isInt(o.score, 0, 1e6)) return null;
  const n = (v: unknown): number => (isInt(v, 0, 99) ? v : 0);
  return { mode: o.mode, score: o.score, won: o.won === true, mine: n(o.mine), theirs: n(o.theirs), line: typeof o.line === 'string' ? o.line.slice(0, 40) : '', best: false, kind: n(o.kind), ...(typeof o.day === 'string' && DAY.test(o.day) ? { day: o.day } : {}), ...(o.counts ? { counts: true } : {}) };
}

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Omit<Save, 'current'>> & { current?: unknown };
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    if (!o || typeof o !== 'object') return s;
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.wins = n(o.wins);
    s.level = LEVELS.includes(o.level as Level) ? (o.level as Level) : 'medium';
    s.target = (TARGETS as readonly number[]).includes(o.target as number) ? (o.target as number) : 5;
    s.muted = o.muted === true;
    s.musicOff = o.musicOff === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (DAY.test(d) && v && typeof v === 'object') s.daily[d] = { score: n(v.score), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '', ...(isInt(v.points, 0, 99) ? { points: v.points } : {}) };
    const c = o.current as Record<string, unknown> | null | undefined;
    if (c && typeof c === 'object') {
      if ('mode' in c) {
        // the old single slot: it goes to its mode's (an old daily only when it is today's)
        const r = validRun(c);
        if (r?.mode === 'match') s.current.match = r;
        else if (r?.mode === 'daily' && r.match.seed === dailySeed(dayKey())) s.current.daily = { ...r, day: dayKey() };
      } else {
        const m = validRun(c.match);
        const d = validRun(c.daily);
        if (m?.mode === 'match') s.current.match = m;
        if (d && d.mode !== 'match' && d.day && d.match.seed === dailySeed(d.day)) s.current.daily = d;
      }
    }
    if (o.challenges && typeof o.challenges === 'object')
      for (const [k, v] of Object.entries(o.challenges as Record<string, ChallengeRec>)
        .filter(([, v]) => v && typeof v === 'object')
        .sort((a, b) => n(a[1].at) - n(b[1].at))
        .slice(-30)) {
        const run = validRun(v.run);
        s.challenges[k] = { run: run?.mode === 'challenge' ? run : null, result: validResult(v.result), at: n(v.at) };
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
    /* blocked storage */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

const Lang = createContext<{ w: Words; lang: BasicLang }>({ w: WORDS.en, lang: 'en' });
const useWords = (): Words => useContext(Lang).w;

const linkedRoom = (): string | null => {
  const c = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  return /^[A-HJKMNP-Z]{5}$/.test(c) ? c : null;
};
function setRoomInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(history.state, '', url);
}

export default function Game({ host, restartKey, pauseKey, challenge, playerName, lang: site }: GameModuleProps) {
  const lang = basicLang(site);
  return (
    <Lang.Provider value={{ w: WORDS[lang], lang }}>
      <Backgammon key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />
    </Lang.Provider>
  );
}

/** Today's (and a challenge's) score: 100 a point won plus their pips left; a loss, 4 a checker borne off. */
export function setScore(m: Match): number {
  const g = m.game;
  if (g.winner === 0) return g.points * 100 + pips(g.pos, 1);
  return g.pos.off[0] * 4;
}

/** Where a run is kept: a match and a daily (today's game, or a "Today's daily" challenge) each in their own slot, a fresh challenge round under its id. */
function store(s: Save, r: Run, challenge: ChallengeSpec | undefined): Save {
  const clean: Run = { ...r, started: false };
  if (r.mode === 'match') return { ...s, current: { ...s.current, match: clean } };
  if (r.mode === 'daily' || r.day) return { ...s, current: { ...s.current, daily: clean } };
  if (!challenge) return s;
  const k = challengeKey(challenge);
  return { ...s, challenges: { ...s.challenges, [k]: { run: clean, result: s.challenges[k]?.result ?? null, at: Date.now() } } };
}

/**
 * A challenge round on opening: finished → its result (never played again); a "Today's daily" whose
 * daily you already finished → that result counts; one under way (here, or the day's daily you
 * started) → it goes on from there; otherwise a new one. The daily kind plays the game's own daily.
 */
function challengeRound(s: Save, c: ChallengeSpec): { run: Run; result: Result | null; counts: boolean } {
  const rec = s.challenges[challengeKey(c)];
  const day = c.mode === 'daily' && DAY.test(c.day) ? c.day : undefined;
  const fresh = (): Run => ({ mode: 'challenge', level: 'hard', match: newMatch(day ? dailySeed(day) : c.seed, 1), started: false, sheet: null, ...(day ? { day } : {}) });
  if (rec?.result) return { run: rec.run ?? fresh(), result: rec.result, counts: false };
  if (day) {
    const done = s.daily[day];
    if (done) return { run: fresh(), result: { mode: 'challenge', score: done.score, won: (done.points ?? 0) > 0, mine: 0, theirs: 0, line: done.line, best: false, kind: done.points ?? 0, day, counts: true }, counts: true };
    const d = s.current.daily;
    if (d && d.day === day) return { run: { ...d, mode: 'challenge' }, result: null, counts: false };
    return { run: fresh(), result: null, counts: false };
  }
  return { run: rec?.run ?? fresh(), result: null, counts: false };
}

function Backgammon({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
  const w = useWords();
  // read again on the menu, on coming back to the tab and for each new round (never frozen at mount)
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((fn: (s: Save) => Save) => {
    // read-modify-write: another tab may have saved since this one loaded
    let base = saveRef.current;
    try {
      if (localStorage.getItem(KEY) !== null) base = loadSave();
    } catch {
      /* blocked storage: this tab's copy */
    }
    const next = fn(base);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted, () => saveRef.current.musicOff)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);

  const [initial] = useState(() => (challenge ? challengeRound(save, challenge) : null));
  const [room, setRoom] = useState<string | null>(() => (challenge ? null : linkedRoom()));
  const [run, setRun] = useState<Run | null>(() => initial?.run ?? null);
  const [result, setResult] = useState<Result | null>(() => initial?.result ?? null);
  const [paused, setPaused] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'rules'>('menu');
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  // a "Today's daily" challenge whose daily is already played: that result is the round's score (once)
  useEffect(() => {
    if (!initial?.counts || !challenge || !initial.result) return;
    const k = challengeKey(challenge);
    if (loadSave().challenges[k]?.result) return;
    const res = initial.result;
    commit((s) => ({ ...s, challenges: { ...s.challenges, [k]: { run: null, result: res, at: Date.now() } } }));
    host.report({ type: 'start' });
    host.report({ type: 'end', score: res.score, stats: { points: res.won ? res.kind : 0 }, challenge: { id: challenge.id, round: challenge.round } });
  }, [initial, challenge, commit, host]);

  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (run && !result) setPaused(true);
  }
  const atBoard = !!run || !!room;
  useEffect(() => {
    sfx().music(atBoard && !paused);
  }, [atBoard, paused, sfx]);

  // a hidden tab pauses; coming back (or a new day) reads the date again
  useEffect(() => {
    const onVis = (): void => {
      setToday(dayKey());
      if (document.visibilityState === 'hidden' && run && !result) setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [run, result]);

  // another tab saved: take its save; a daily it finished leaves this tab's (stale) board for the menu
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY) return;
      const fresh = loadSave();
      saveRef.current = fresh;
      setSave(fresh);
      const r = runRef.current;
      if (r && !result && (r.mode === 'daily' || (r.mode === 'challenge' && r.day && !challenge)) && r.day && fresh.daily[r.day]) {
        runRef.current = null;
        setRun(null);
        setPaused(false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [result, challenge]);

  const keep = useCallback((r: Run) => commit((s) => store(s, r, challenge)), [commit, challenge]);
  const update = useCallback(
    (fn: (r: Run) => Run) => {
      const r = runRef.current;
      if (!r) return;
      const next = fn(r);
      runRef.current = next;
      setRun(next);
      keep(next);
    },
    [keep],
  );

  const play = (r: Run): void => {
    setResult(null);
    setPaused(false);
    runRef.current = r;
    setRun(r);
  };
  const begin = (mode: 'match' | 'daily', level: Level, target: number): void => {
    sfx().unlock();
    const day = dayKey();
    setToday(day);
    if (mode === 'daily') {
      const s = loadSave();
      if (s.daily[day]) return;
      // today's game is one attempt: once started it is only ever continued
      const d = s.current.daily;
      if (d && d.day === day) return play({ ...d, mode: 'daily' });
    }
    const seed = mode === 'daily' ? dailySeed(day) : (Math.random() * 2 ** 32) >>> 0;
    const r: Run = { mode, level, match: newMatch(seed, mode === 'match' ? target : 1), started: false, sheet: null, ...(mode === 'daily' ? { day } : {}) };
    play(r);
    keep(r);
    // the daily's fixed Hard is not your match level
    if (mode === 'match') commit((s) => ({ ...s, level, target }));
  };
  const resume = (mode: 'match' | 'daily'): void => {
    const r = saveRef.current.current[mode];
    if (r) play(mode === 'daily' ? { ...r, mode: 'daily' } : r);
  };

  const withGame = (r: Run, fn: (g: Match['game']) => Match['game']): Run => {
    let next = r;
    if (!r.started) {
      host.report({ type: 'start' });
      next = { ...r, started: true };
    }
    return { ...next, match: { ...next.match, game: fn(next.match.game) } };
  };
  const onRoll = (): void => update((r) => withGame(r, roll));
  const onStep = (st: Step): void => update((r) => withGame(r, (g) => step(g, st)));
  const onDone = (): void => update((r) => withGame(r, endTurn));

  // the computer's turns (one checker at a time), a roll you cannot play, and the end of a game
  const plan = useRef<{ key: string; steps: Step[] } | null>(null);
  useEffect(() => {
    if (!run || run.sheet || paused || result) return;
    const g = run.match.game;
    if (g.phase === 'over') {
      const t = window.setTimeout(() => {
        const r = runRef.current!;
        const booked = bookGame(r.match);
        update(() => ({ ...r, match: booked, sheet: { winner: r.match.game.winner!, points: r.match.game.points } }));
      }, 1300);
      return () => window.clearTimeout(t);
    }
    // shut out (a checker on the bar, the board closed): no roll, the turn passes once that has been said
    if (mustPass(g)) {
      const t = window.setTimeout(() => update((r) => ({ ...r, match: { ...r.match, game: passTurn(r.match.game) } })), 1800);
      return () => window.clearTimeout(t);
    }
    if (g.turn === 0 && g.phase === 'move' && !g.steps.length && turnDone(g)) {
      const t = window.setTimeout(() => update((r) => ({ ...r, match: { ...r.match, game: endTurn(r.match.game) } })), 1600);
      return () => window.clearTimeout(t);
    }
    if (g.turn !== 1 || g.phase === 'opening') return;
    const level = run.mode === 'match' ? run.level : 'hard';
    if (g.phase === 'roll') {
      const t = window.setTimeout(() => update((r) => ({ ...r, match: { ...r.match, game: roll(r.match.game) } })), 700);
      return () => window.clearTimeout(t);
    }
    // a move: plan the whole play once, then make it step by step. The plan belongs to this game's roll:
    // a match started after going back to the menu has its own (an old plan for the same roll count
    // left the computer stuck on a step it could not make, issue #26). It is worked out when the first
    // step is due (after the dice have landed), not while the board renders.
    const k = `${g.seed}:${g.rolls}:${posKey(g.turnStart)}`;
    const t = window.setTimeout(
      () => {
        if (plan.current?.key !== k) plan.current = { key: k, steps: choosePlay(g.turnStart, 1, g.roll![0] === g.roll![1] ? [g.roll![0], g.roll![0], g.roll![0], g.roll![0]] : [g.roll![0], g.roll![1]], level, rng(hashString(`${g.seed}:${g.rolls}`))) };
        const next = plan.current.steps[g.steps.length];
        update((r) => ({ ...r, match: { ...r.match, game: planStep(r.match.game, next) } }));
      },
      // each step once the one before has bounced its way there
      g.steps.length === 0 ? 900 : moveMs(1, g.steps[g.steps.length - 1]!) + 260,
    );
    return () => window.clearTimeout(t);
  }, [run, paused, result, update]);

  const finish = (r: Run): void => {
    const m = r.match;
    const won = m.winner === 0 || (r.mode !== 'match' && m.game.winner === 0);
    const score = r.mode === 'match' ? m.score[0] * 100 + (won ? 50 : 0) : setScore(m);
    const isBest = score > saveRef.current.best;
    const g = m.game;
    const line = r.mode === 'match' ? m.results.map((x) => (x.winner === 0 ? ['', '🟢', '⭐', '🏆'][x.points] : '🔴')).join('') : won ? `${['', '🟢', '⭐', '🏆'][g.points]} ${w.win[g.points as 1 | 2 | 3]}` : `🔴 ${g.pos.off[0]}/15`;
    const points = won ? (r.mode === 'match' ? m.score[0] : g.points) : 0;
    // a daily (today's game, or a "Today's daily" challenge) finishes as its own day's, even after midnight
    const day = r.mode === 'daily' || r.mode === 'challenge' ? r.day : undefined;
    const res: Result = { mode: r.mode, score, won, mine: m.score[0], theirs: m.score[1], line, best: isBest, kind: g.points, ...(day ? { day } : {}) };
    commit((s) => ({
      ...s,
      best: Math.max(s.best, score),
      runs: s.runs + 1,
      wins: s.wins + (r.mode === 'match' && won ? 1 : 0),
      daily: day && !s.daily[day] ? { ...s.daily, [day]: { score, line, points } } : s.daily,
      current: { match: r.mode === 'match' ? null : s.current.match, daily: day && s.current.daily?.day === day ? null : s.current.daily },
      // the round's result is kept before it is reported: it is reported once, and never played again
      challenges: r.mode === 'challenge' && challenge ? { ...s.challenges, [challengeKey(challenge)]: { run: { ...r, started: false }, result: res, at: Date.now() } } : s.challenges,
    }));
    const end = { type: 'end' as const, score, stats: { points } };
    host.report(r.mode === 'daily' ? { ...end, daily: true } : r.mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    setResult(res);
  };

  const afterSheet = (): void => {
    const r = runRef.current;
    if (!r) return;
    sfx().click();
    if (r.match.winner !== null || r.mode !== 'match') {
      update((x) => ({ ...x, sheet: null }));
      return finish(r);
    }
    update((x) => ({ ...x, sheet: null, match: nextGame(x.match) }));
  };

  const quit = (): void => {
    setRun(null);
    runRef.current = null;
    setResult(null);
    setPaused(false);
    setToday(dayKey());
    sfx().click();
  };

  const openRoom = async (listed: boolean): Promise<string | null> => {
    sfx().unlock();
    try {
      const code = await createRoom('backgammon', listed);
      setRoomInUrl(code);
      setRoom(code);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : w.noRoom;
    }
  };
  const joinRoom = async (code: string): Promise<string | null> => {
    sfx().unlock();
    const info = await roomInfo(code);
    if (!info || info.game !== 'backgammon') return w.noRoom;
    setRoomInUrl(code);
    setRoom(code);
    return null;
  };

  // Escape pauses, when the key is meant for the game (not a field, not the arcade's own dialogs)
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!run || result) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t && t !== document.body && t !== document.documentElement && (t.closest('input, textarea, select, [contenteditable]') || !rootRef.current?.contains(t))) return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, result]);

  const tools = (
    <>
      <SoundMenu save={save} commit={commit} sfx={sfx} />
      {run && !result && (
        <button className="tb-icon" onClick={() => setPaused(true)} aria-label={w.paused}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      )}
      <GameMenuButton className="tb-icon" />
    </>
  );

  if (room)
    return (
      <div className="tb" onPointerDown={() => sfx().unlock()}>
        <LiveBoard
          key={room}
          w={w}
          code={room}
          name={seatedName(room) ?? (playerName || '')}
          sfx={sfx}
          tools={tools}
          onLeave={() => {
            setRoomInUrl(null);
            setRoom(null);
          }}
          onRoom={(code) => {
            setRoomInUrl(code);
            setRoom(code);
          }}
        />
      </div>
    );

  if (run) {
    const r = run;
    const g = r.match.game;
    const canAct = !paused && !r.sheet && !result && g.phase !== 'over' && (g.phase === 'opening' || g.turn === 0);
    const opp = r.mode === 'match' ? r.level : 'hard';
    const oppName = `${w.computer} · ${w.level[opp]}`;
    return (
      <div className="tb" ref={rootRef} onPointerDown={() => sfx().unlock()}>
        <Board
          w={w}
          game={g}
          me={0}
          names={[playerName || w.you, w.computer]}
          bots={[null, opp]}
          canAct={canAct}
          onRoll={onRoll}
          onStep={onStep}
          onDone={onDone}
          sfx={sfx}
          score={r.match.score}
          target={r.match.target}
          note={r.mode === 'match' ? undefined : r.mode === 'daily' ? `#${dailyNumber(r.day ?? today)}` : ''}
          tools={tools}
          overlay={
            <>
              {g.phase === 'opening' && !paused && !result && <p className="tb-toast">{w.rollFirst}</p>}
              {g.phase === 'move' && g.steps.length === 0 && r.match.game.rolls > 0 && g.roll && r.match.game.lastTurn === null && <p className="tb-toast is-soft">{w.opening(g.roll[0], g.roll[1], g.turn === 0)}</p>}
              {r.sheet && (
                <div className="tb-sheet-wrap" role="dialog">
                  <div className={`tb-sheet${r.sheet.winner === 0 ? ' is-win' : ''}`}>
                    <h2>{r.sheet.winner === 0 ? w.youWonGame(w.win[r.sheet.points as 1 | 2 | 3], r.sheet.points) : w.theyWonGame(oppName, w.win[r.sheet.points as 1 | 2 | 3], r.sheet.points)}</h2>
                    {r.mode === 'match' && (
                      <p className="tb-sheet-score mono">
                        <b>{r.match.score[0]}</b> – <b>{r.match.score[1]}</b> · {w.to(r.match.target)}
                      </p>
                    )}
                    <button className="tb-btn is-go" onClick={afterSheet} autoFocus>
                      {r.match.winner !== null || r.mode !== 'match' ? w.menu : w.nextGame}
                    </button>
                  </div>
                </div>
              )}
              {result && <ResultScreen w={w} res={result} day={dailyNumber(result.day ?? today)} challenge={challenge} onAgain={() => begin('match', saveRef.current.level, saveRef.current.target)} onMenu={quit} />}
              {paused && !result && (
                <div className="tb-sheet-wrap" role="dialog" aria-label={w.paused} onClick={() => setPaused(false)}>
                  <div className="tb-sheet" onClick={(e) => e.stopPropagation()}>
                    <h2>{w.paused}</h2>
                    <button className="tb-btn is-go" autoFocus onClick={() => setPaused(false)}>
                      {w.resumeBtn}
                    </button>
                    {/* a challenge round is one attempt: no way out of it from here */}
                    {r.mode !== 'challenge' && (
                      <button className="tb-btn" onClick={quit}>
                        {w.quit}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          }
        />
      </div>
    );
  }

  if (screen === 'rules')
    return (
      <div className="tb tb-scroll">
        <div className="tb-menu">
          <div className="tb-top-row">
            <button className="tb-btn is-small" onClick={() => setScreen('menu')}>
              ← {w.back}
            </button>
            <div className="tb-tools">{tools}</div>
          </div>
          <h2 className="tb-h">{w.howTo}</h2>
          <ol className="tb-rules">
            {w.rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </div>
    );

  return <Menu w={w} save={save} today={today} tools={tools} onBegin={begin} onResume={resume} onRules={() => setScreen('rules')} onOpenRoom={openRoom} onJoinRoom={joinRoom} />;
}

function SoundMenu({ save, commit, sfx }: { save: Save; commit: (fn: (s: Save) => Save) => void; sfx: () => Sfx }) {
  const w = useWords();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent): void => {
      if (!(e.target as Element | null)?.closest('.tb-sound')) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="tb-sound">
      <button className="tb-icon" onClick={() => setOpen((o) => !o)} aria-label={w.sound} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {!(save.muted && save.musicOff) && <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <div className="tb-sound-menu" role="group" aria-label={w.sound}>
          {(
            [
              ['music', w.music, !save.musicOff],
              ['fx', w.sound, !save.muted],
            ] as const
          ).map(([k, label, on]) => (
            <button
              key={k}
              className="tb-switch"
              role="switch"
              aria-checked={on}
              onClick={() => {
                commit((s) => (k === 'music' ? { ...s, musicOff: !s.musicOff } : { ...s, muted: !s.muted }));
                sfx().refresh();
              }}
            >
              {label} <span className="tb-knob" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Menu({
  w,
  save,
  today,
  tools,
  onBegin,
  onResume,
  onRules,
  onOpenRoom,
  onJoinRoom,
}: {
  w: Words;
  save: Save;
  today: string;
  tools: React.ReactNode;
  onBegin: (m: 'match' | 'daily', l: Level, target: number) => void;
  onResume: (m: 'match' | 'daily') => void;
  onRules: () => void;
  onOpenRoom: (listed: boolean) => Promise<string | null>;
  onJoinRoom: (code: string) => Promise<string | null>;
}) {
  const [level, setLevel] = useState<Level>(save.level);
  const [target, setTarget] = useState(save.target);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  /** Asking before a new match replaces the one you have going. */
  const [replace, setReplace] = useState(false);
  const daily = save.daily[today];
  const resumeDaily = save.current.daily?.day === today;
  const resumeMatch = !!save.current.match;
  return (
    <div className="tb tb-scroll">
      <div className="tb-menu">
        <div className="tb-top-row">
          <span />
          <div className="tb-tools">{tools}</div>
        </div>
        <div className="tb-hero" aria-hidden="true">
          <span className="tb-hero-die">⚄</span>
          <span className="tb-hero-checker side-me" />
          <span className="tb-hero-checker side-them" />
          <span className="tb-hero-die is-b">⚂</span>
        </div>
        <h2 className="tb-title">{w.title}</h2>
        <p className="tb-tagline">{w.tagline}</p>

        <section className="tb-mode is-daily">
          <div>
            <b>{w.daily}</b>
            <small>{w.dailySub(dailyNumber(today))}</small>
            {daily && (
              <span className="tb-done mono">
                {w.dailyDone} · {daily.score} · {daily.line}
              </span>
            )}
          </div>
          {!daily && (
            <button className="tb-btn is-go" onClick={() => (resumeDaily ? onResume('daily') : onBegin('daily', 'hard', 1))}>
              {resumeDaily ? w.resumeBtn : w.start}
            </button>
          )}
        </section>

        <section className="tb-mode">
          <div>
            <b>{w.match}</b>
            <small>{w.matchSub}</small>
          </div>
          {resumeMatch && (
            <button className="tb-btn is-go" onClick={() => onResume('match')}>
              {w.resume}
            </button>
          )}
          <div className="tb-levels" role="radiogroup" aria-label={w.match}>
            {LEVELS.map((l) => (
              <button key={l} role="radio" aria-checked={level === l} className={`tb-level${level === l ? ' is-on' : ''}`} onClick={() => setLevel(l)}>
                <b>{w.level[l]}</b>
                <small>{w.levelHint[l]}</small>
              </button>
            ))}
          </div>
          <div className="tb-lengths" role="radiogroup" aria-label={w.length}>
            <span className="tb-label">{w.length}</span>
            {TARGETS.map((n) => (
              <button key={n} role="radio" aria-checked={target === n} className={`tb-chip-btn${target === n ? ' is-on' : ''}`} onClick={() => setTarget(n)}>
                {n}
              </button>
            ))}
          </div>
          {replace && resumeMatch ? (
            <div className="tb-confirm" role="alertdialog" aria-label={w.replaceMatch}>
              <p>{w.replaceMatch}</p>
              <button className="tb-btn" onClick={() => onBegin('match', level, target)}>
                {w.replaceYes}
              </button>
              <button className="tb-btn is-go" onClick={() => setReplace(false)} autoFocus>
                {w.replaceNo}
              </button>
            </div>
          ) : (
            <button className={`tb-btn${resumeMatch ? '' : ' is-go'}`} onClick={() => (resumeMatch ? setReplace(true) : onBegin('match', level, target))}>
              {w.start} · {w.level[level]} · {w.to(target)}
            </button>
          )}
        </section>

        <section className="tb-mode">
          <div>
            <b>{w.friends}</b>
            <small>{w.friendsSub}</small>
          </div>
          <OnlinePlay game="backgammon" className="tb-online" busyLabel={w.opening2} onCreate={onOpenRoom} onJoin={(c) => onJoinRoom(c)} />
          <form
            className="tb-join"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^[A-HJKMNP-Z]{5}$/.test(code)) return setErr(w.noRoom);
              setBusy(true);
              setErr((await onJoinRoom(code)) ?? '');
              setBusy(false);
            }}
          >
            <input className="tb-input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))} placeholder={w.joinCode} aria-label={w.joinCode} autoComplete="off" />
            <button className="tb-btn" disabled={busy || code.length !== 5}>
              {w.join}
            </button>
          </form>
          {err && <p className="tb-err">{err}</p>}
        </section>

        <button className="tb-btn is-ghost" onClick={onRules}>
          {w.howTo}
        </button>
        <p className="tb-stats mono">
          {w.best} {save.best} · {w.wins} {save.wins}
        </p>
      </div>
    </div>
  );
}

function ResultScreen({
  w,
  res,
  day,
  challenge,
  onAgain,
  onMenu,
}: {
  w: Words;
  res: Result;
  day: number;
  challenge?: ChallengeSpec;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const [msg, setMsg] = useState('');
  const share = `${res.mode === 'daily' ? w.shareDaily(day, res.line, res.score) : w.shareMatch(res.mine, res.theirs, res.line)}\n${window.location.origin}/games/backgammon`;
  return (
    <div className="tb-sheet-wrap" role="dialog" aria-label={res.won ? w.matchWon : w.matchLost}>
      <div className={`tb-sheet${res.won ? ' is-win' : ''}`}>
        <h2>{res.mode === 'match' ? (res.won ? w.matchWon : w.matchLost) : w.dailyScore}</h2>
        <p className="tb-sheet-score mono">
          {res.mode === 'match' ? (
            <>
              <b>{res.mine}</b> – {res.theirs}
            </>
          ) : (
            <b>{res.score}</b>
          )}
        </p>
        {res.best && <p className="tb-newbest">{w.newBest}</p>}
        {res.counts && <p className="tb-tagline">{w.dailyCounts}</p>}
        <ResultLine line={res.line || '🎲'} label={w.scoreLabel(res.mine, res.theirs)} />
        <div className="tb-sheet-actions">
          {res.mode === 'challenge' && challenge ? (
            <a className="tb-btn is-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
              {w.seeScores}
            </a>
          ) : (
            <>
              <button className="tb-btn is-go" onClick={onAgain} autoFocus>
                {w.playAgain}
              </button>
              <button className="tb-btn" onClick={() => void shareOrCopy({ title: 'Backgammon', text: share }).then((o) => setMsg(o === 'copied' ? w.copied : ''))}>
                {msg || w.share}
              </button>
            </>
          )}
          <button className="tb-btn is-ghost" onClick={onMenu}>
            {w.menu}
          </button>
        </div>
      </div>
    </div>
  );
}
