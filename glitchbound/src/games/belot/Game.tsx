import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { ResultLine } from '../../components/ResultLine';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import { basicLang, type BasicLang } from '../../platform/contentLang';
import type { EndEvent, GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { createRoom, roomInfo } from '../../platform/rooms';
import { OnlinePlay } from '../../components/OnlinePlay';
import { shareOrCopy } from '../../platform/share';
import { LEVELS, type Level } from './ai';
import { CardDefs, CardFace, SuitIcon } from './cards';
import { keyForGame } from './keys';
import { LiveTable } from './live';
import { applyCall, bookDeal, cardOf, newMatch, nextDeal, playCard, type Call, type Card, type DealScore, type Match } from './logic';
import { createSfx, type Sfx } from './sound';
import { DealSheet, Table, TRICK_HOLD_MS, TRICK_SLIDE_MS } from './Table';
import { think } from './thinker';
import { WORDS, type Words } from './text';
import './Game.css';

const KEY = 'glitchbound.belot';
const EPOCH = '2026-10-21';
const SLUG = 'belot';
/** Deals in today's set and in a friends' challenge. */
export const SET_DEALS = 4;
/** The share line's mark for a thrown-in deal of the set (four passes: it counts, with 0 points). */
export const THROWN_MARK = '⚪';
/** Friends' challenge rounds kept in the save (the oldest go first). */
const ROUNDS_KEPT = 20;

type Mode = 'match' | 'daily' | 'challenge';

export interface Run {
  mode: Mode;
  level: Level;
  match: Match;
  /** Deals of the set played so far (in today's deals and a challenge a thrown-in deal counts too). */
  booked: number;
  /** One emoji per scored deal, for the share line. */
  line: string;
  /** Reported `start` in this page session (never saved: a resumed run reports it again). */
  started: boolean;
  /** The score sheet of the deal just booked (kept with the run, so a resumed run shows it, never books twice). */
  sheet: { score: DealScore; taken: number } | null;
  /** The day of a day's deals (today's set, or a "today's daily" challenge): it finishes as that day's. */
  day?: string;
  /** A friends' challenge round: `${id}:${round}`. */
  round?: string;
}

interface DayRecord {
  score: number;
  line: string;
  done: boolean;
  /** The other team's points (older saves do not have them). */
  theirs?: number;
}

interface RoundRecord {
  /** The round in progress (one attempt: it is picked up again, never dealt anew). */
  run: Run | null;
  done: boolean;
  score: number;
  ours: number;
  theirs: number;
  line: string;
}

export interface Save {
  /** The most points in any finished run (kept from older versions). */
  best: number;
  /** The best match score: the table's level plus the winning margin (see matchScore). */
  bestMatch: number;
  runs: number;
  wins: number;
  daily: Record<string, DayRecord>;
  level: Level;
  muted: boolean;
  musicOff: boolean;
  fourColor: boolean;
  /** A match left unfinished, to pick up again. */
  current: Run | null;
  /** Today's set in progress (its own slot, so a match and the day's deals never replace each other). */
  dailyRun: Run | null;
  rounds: Record<string, RoundRecord>;
}

const emptySave = (): Save => ({ best: 0, bestMatch: 0, runs: 0, wins: 0, daily: {}, level: 'medium', muted: false, musicOff: false, fourColor: false, current: null, dailyRun: null, rounds: {} });

/** The seed of a day's four deals (the same for everyone that day). */
export const daySeed = (day: string): number => hashString(`${SLUG}:${day}`);

/** A won match scores its table plus the margin (capped), so a hard-won Expert match ranks above an easy one. */
const LEVEL_POINTS: Record<Level, number> = { easy: 100, medium: 200, hard: 300, expert: 400 };
export const matchScore = (won: boolean, margin: number, level: Level): number => (won ? LEVEL_POINTS[level] + Math.min(150, Math.max(0, Math.floor(margin))) : 0);

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const isInt = (v: unknown, lo: number, hi: number): boolean => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isDay = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** A saved run, checked closely enough that the table can always draw it (the rules refuse anything else). */
export function cleanRun(v: unknown): Run | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Partial<Run>;
  const m = c.match as Partial<Match> | undefined;
  const d = m?.deal;
  if (c.mode !== 'match' && c.mode !== 'daily' && c.mode !== 'challenge') return null;
  if (!LEVELS.includes(c.level as Level) || !m || !d) return null;
  if (!isInt(m.seed, 0, 2 ** 32) || !isInt(m.dealNo, 0, 10_000) || !Array.isArray(m.scores) || m.scores.length !== 2 || !m.scores.every((x) => isInt(x, 0, 100_000))) return null;
  if (!isInt(m.hanging, 0, 100_000) || !Array.isArray(m.history) || !(m.winner === null || m.winner === 0 || m.winner === 1)) return null;
  if (!Array.isArray(d.hands) || d.hands.length !== 4 || !d.hands.every((h) => Array.isArray(h) && h.length <= 8 && h.every((x) => isInt(x, 0, 31)))) return null;
  if (!['bidding', 'playing', 'done', 'thrown'].includes(d.phase) || !isInt(d.turn, 0, 3) || !isInt(d.dealer, 0, 3)) return null;
  if (!Array.isArray(d.calls) || !Array.isArray(d.tricks) || !Array.isArray(d.trick) || !Array.isArray(d.stock) || !Array.isArray(d.declared) || d.declared.length !== 4 || !Array.isArray(d.belotes)) return null;
  const sheet = c.sheet && typeof c.sheet === 'object' && c.sheet.score && typeof c.sheet.score === 'object' ? { score: c.sheet.score, taken: num(c.sheet.taken) } : null;
  return {
    mode: c.mode,
    level: c.level as Level,
    match: m as Match,
    booked: Math.min(num(c.booked), 10_000),
    line: typeof c.line === 'string' ? c.line.slice(0, 80) : '',
    started: false,
    sheet,
    ...(isDay(c.day) ? { day: c.day } : {}),
    ...(typeof c.round === 'string' ? { round: c.round.slice(0, 80) } : {}),
  };
}

/** The save as stored, or null when there is none (or storage is blocked). */
function readStored(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : parseSave(raw);
  } catch {
    return null;
  }
}

export function parseSave(raw: string): Save {
  const s = emptySave();
  let o: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return s;
    o = parsed as Record<string, unknown>;
  } catch {
    return s;
  }
  s.best = num(o.best);
  s.bestMatch = num(o.bestMatch);
  s.runs = num(o.runs);
  s.wins = num(o.wins);
  s.level = LEVELS.includes(o.level as Level) ? (o.level as Level) : 'medium';
  s.muted = o.muted === true;
  s.musicOff = o.musicOff === true;
  s.fourColor = o.fourColor === true;
  if (o.daily && typeof o.daily === 'object')
    for (const [d, v] of Object.entries(o.daily as Record<string, unknown>).slice(-60))
      if (isDay(d) && v && typeof v === 'object') {
        const r = v as Record<string, unknown>;
        s.daily[d] = { score: num(r.score), line: typeof r.line === 'string' ? r.line.slice(0, 20) : '', done: r.done === true, ...(typeof r.theirs === 'number' ? { theirs: num(r.theirs) } : {}) };
      }
  const cur = cleanRun(o.current);
  if (cur?.mode === 'match') s.current = cur;
  // older saves kept today's set in the one slot: it moves to its own (its day comes from its seed)
  else if (cur?.mode === 'daily') {
    const day = cur.day ?? [dayKey()].find((x) => daySeed(x) === cur.match.seed);
    if (day) s.dailyRun = { ...cur, day };
  }
  const dr = cleanRun(o.dailyRun);
  if (dr?.mode === 'daily' && dr.day) s.dailyRun = dr;
  if (o.rounds && typeof o.rounds === 'object')
    for (const [k, v] of Object.entries(o.rounds as Record<string, unknown>).slice(-ROUNDS_KEPT))
      if (v && typeof v === 'object') {
        const r = v as Record<string, unknown>;
        s.rounds[k.slice(0, 80)] = { run: cleanRun(r.run), done: r.done === true, score: num(r.score), ours: num(r.ours), theirs: num(r.theirs), line: typeof r.line === 'string' ? r.line.slice(0, 20) : '' };
      }
  return s;
}

const loadSave = (): Save => readStored() ?? emptySave();
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works */
  }
};
const pruneRounds = (r: Record<string, RoundRecord>): Record<string, RoundRecord> => Object.fromEntries(Object.entries(r).slice(-ROUNDS_KEPT));
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

const Lang = createContext<{ w: Words; lang: BasicLang }>({ w: WORDS.en, lang: 'en' });
const useWords = (): Words => useContext(Lang).w;

/** The room code from an invite link (?room=ABCDE). */
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
      <Belot key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />
    </Lang.Provider>
  );
}

/** The emoji for a scored deal: won it, lost it, hanging; a star on a valat. */
const dealEmoji = (s: DealScore, us: 0 | 1): string => (s.valat === us ? '⭐' : s.winner === null ? '🟡' : s.winner === us ? '🟢' : '🔴');

type Result = { mode: Mode; score: number; ours: number; theirs: number | null; won: boolean; line: string; best: boolean; counted?: boolean };

const freshRun = (mode: Mode, level: Level, seed: number, extra: Partial<Run> = {}): Run => ({ mode, level, match: newMatch(seed), booked: 0, line: '', started: false, sheet: null, ...extra });

/**
 * Where a friends' challenge round starts: its result when it was finished (never replayed), the round
 * in progress, or a new one. "Today's daily" plays that day's own deals: a day already played counts
 * as it is, and today's set in progress is the same attempt.
 */
export function challengeStart(save: Save, ch: ChallengeSpec, today: string): { run: Run | null; result: Result | null; counts: boolean } {
  const key = `${ch.id}:${ch.round}`;
  const rec = save.rounds[key];
  const show = (score: number, ours: number, theirs: number | null, line: string, counted: boolean): Result => ({ mode: 'challenge', score, ours, theirs, won: theirs !== null && ours > theirs, line, best: false, counted });
  if (rec?.done) return { run: null, result: show(rec.score, rec.ours, rec.theirs, rec.line, false), counts: false };
  if (ch.mode === 'daily' && isDay(ch.day)) {
    const d = save.daily[ch.day];
    if (d?.done) return { run: null, result: show(d.score, d.score, d.theirs ?? null, d.line, true), counts: true };
    if (ch.day === today) return { run: save.dailyRun?.day === ch.day ? save.dailyRun : freshRun('daily', 'hard', daySeed(ch.day), { day: ch.day }), result: null, counts: false };
    return { run: rec?.run ?? freshRun('challenge', 'hard', daySeed(ch.day), { day: ch.day, round: key }), result: null, counts: false };
  }
  return { run: rec?.run ?? freshRun('challenge', 'hard', ch.seed, { round: key }), result: null, counts: false };
}

function Belot({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
  const w = useWords();
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  // every write starts from the stored save (another tab may have changed it), not this tab's copy
  const commit = useCallback((fn: (s: Save) => Save) => {
    const next = fn(readStored() ?? saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted, () => saveRef.current.musicOff)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);
  const rootRef = useRef<HTMLDivElement>(null);

  const [start] = useState(() => (challenge ? challengeStart(save, challenge, today) : null));
  const [room, setRoom] = useState<string | null>(() => (challenge ? null : linkedRoom()));
  const [run, setRun] = useState<Run | null>(() => start?.run ?? null);
  const sheet = run?.sheet ?? null;
  const [result, setResult] = useState<Result | null>(() => start?.result ?? null);
  const [paused, setPaused] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'rules'>('menu');
  const [thrown, setThrown] = useState(false);
  const runRef = useRef(run);
  const resultRef = useRef(result);
  useEffect(() => {
    runRef.current = run;
    resultRef.current = result;
  });

  // the arcade asks for a pause (left full screen, scrolled away)
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (run && !result) setPaused(true);
  }

  // music while a table is open (a match, today's set, a live table)
  const atTable = !!run || !!room;
  useEffect(() => {
    sfx().music(atTable && !paused);
  }, [atTable, paused, sfx]);

  // the computer players' names: friendly, short, and the same in every language
  const names = [playerName || w.you, 'Niko', 'Mila', 'Tom'];

  /** Keeps an unfinished run in its own slot: a match, the day's set, or a challenge round. */
  const keep = useCallback(
    (r: Run) => {
      const stored = { ...r, started: false };
      commit((s) => {
        if (r.mode === 'match') return { ...s, current: stored };
        if (r.mode === 'daily') return { ...s, dailyRun: stored };
        const key = r.round;
        if (!key || s.rounds[key]?.done) return s;
        return { ...s, rounds: pruneRounds({ ...s.rounds, [key]: { run: stored, done: false, score: 0, ours: 0, theirs: 0, line: '' } }) };
      });
    },
    [commit],
  );

  // a challenge round is one attempt from the moment its cards are shown: it is saved at once,
  // and a day already played reports its result as the round's score (once)
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !challenge || !start) return;
    opened.current = true;
    if (start.run) keep(start.run);
    if (start.counts && start.result) {
      const key = `${challenge.id}:${challenge.round}`;
      if (saveRef.current.rounds[key]?.done) return;
      const res = start.result;
      commit((s) => ({ ...s, rounds: pruneRounds({ ...s.rounds, [key]: { run: null, done: true, score: res.score, ours: res.ours, theirs: res.theirs ?? 0, line: res.line } }) }));
      host.report({ type: 'end', score: res.score, stats: { margin: res.theirs === null ? 0 : Math.max(0, res.ours - res.theirs) }, challenge: { id: challenge.id, round: challenge.round } });
    }
  }, [challenge, start, keep, commit, host]);

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

  const begin = (mode: 'match' | 'daily', level: Level): void => {
    sfx().unlock();
    const day = dayKey();
    setToday(day);
    if (mode === 'daily') {
      const s = saveRef.current;
      // one attempt: a day's set is never dealt anew (it carries on where it was)
      if (s.daily[day]?.done) return;
      if (s.dailyRun?.day === day) return play(s.dailyRun);
    }
    const r = mode === 'daily' ? freshRun('daily', 'hard', daySeed(day), { day }) : freshRun('match', level, (Math.random() * 2 ** 32) >>> 0);
    play(r);
    keep(r);
    // the level picked for matches stays (the day's set is always played against Hard)
    if (mode === 'match') commit((s) => ({ ...s, level }));
  };

  const markStart = (r: Run): Run => {
    if (r.started) return r;
    host.report({ type: 'start' });
    return { ...r, started: true };
  };
  const onCall = (c: Call): void => update((r) => ({ ...markStart(r), match: { ...r.match, deal: applyCall(r.match.deal, c) } }));
  const onPlay = (card: Card, declare: boolean): void => update((r) => ({ ...markStart(r), match: { ...r.match, deal: playCard(r.match.deal, card, declare ? undefined : []) } }));

  const finish = (r: Run): void => {
    const [ours, theirs] = r.match.scores;
    const won = ours > theirs;
    const margin = Math.max(0, ours - theirs);
    const score = r.mode === 'match' ? matchScore(won, margin, r.level) : ours;
    const cur = saveRef.current;
    const isBest = r.mode === 'match' && score > cur.bestMatch;
    // the round this run plays for a challenge: its own, or "today's daily" played as the day's set
    const roundKey = challenge && (r.round === `${challenge.id}:${challenge.round}` || (challenge.mode === 'daily' && r.day && r.day === challenge.day)) ? `${challenge.id}:${challenge.round}` : null;
    const record = { score, ours, theirs, line: r.line };
    commit((s) => ({
      ...s,
      best: Math.max(s.best, ours),
      bestMatch: r.mode === 'match' ? Math.max(s.bestMatch, score) : s.bestMatch,
      runs: s.runs + 1,
      wins: s.wins + (r.mode === 'match' && won ? 1 : 0),
      daily: r.day ? { ...s.daily, [r.day]: { score, line: r.line, done: true, theirs } } : s.daily,
      current: r.mode === 'match' ? null : s.current,
      dailyRun: r.mode === 'daily' ? null : s.dailyRun,
      rounds: roundKey ? pruneRounds({ ...s.rounds, [roundKey]: { run: null, done: true, ...record } }) : s.rounds,
    }));
    const end: EndEvent = { type: 'end', score, stats: { margin } };
    // a day's set counts as the arcade's daily only on its own day (one started yesterday finishes as yesterday's)
    if (r.mode === 'daily' && r.day === dayKey()) end.daily = true;
    if (roundKey && challenge) end.challenge = { id: challenge.id, round: challenge.round };
    host.report(end);
    if (won) sfx().win();
    else sfx().lose();
    setResult({ mode: roundKey ? 'challenge' : r.mode, score, ours, theirs, won, line: r.line, best: isBest });
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  // the computer players, a thrown-in deal, and a finished deal's score sheet
  useEffect(() => {
    if (!run || sheet || paused || result) return;
    const d = run.match.deal;
    if (d.phase === 'thrown') {
      const a = window.setTimeout(() => setThrown(true), 0);
      const b = window.setTimeout(() => {
        setThrown(false);
        const r = runRef.current!;
        if (r.mode === 'match') return update((x) => ({ ...x, match: nextDeal(x.match) }));
        // in the set a thrown-in deal is one of the four (0 points), so deal n is the same cards for everyone
        const n = { ...r, booked: r.booked + 1, line: r.line + THROWN_MARK };
        if (n.booked >= SET_DEALS) {
          update(() => n);
          return finishRef.current(n);
        }
        update(() => ({ ...n, match: nextDeal(n.match) }));
      }, 1700);
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
      };
    }
    if (d.phase === 'done' && !run.sheet) {
      const t = window.setTimeout(() => {
        const r = runRef.current!;
        const { match, score, taken } = bookDeal(r.match);
        const s = sfx();
        if (score.valat !== null) s.valat();
        else s.tally(Math.max(score.game[0], score.game[1]));
        update(() => ({ ...r, match, booked: r.booked + 1, line: r.line + dealEmoji(score, 0), sheet: { score, taken } }));
      }, TRICK_HOLD_MS + TRICK_SLIDE_MS + 150);
      return () => window.clearTimeout(t);
    }
    if (d.turn === 0) return;
    const delay = d.phase === 'bidding' ? (d.calls.length === 0 ? 1500 : 750) : d.trick.length === 0 && d.tricks.length > 0 ? TRICK_HOLD_MS + TRICK_SLIDE_MS : 650;
    let live = true;
    const t = window.setTimeout(() => {
      const r = runRef.current!;
      const md = r.match.deal;
      // the computer's choices are seeded by the position, so today's deals play the same for everyone
      const seed = hashString(`${r.match.seed}:${r.match.dealNo}:${md.calls.length}:${md.tricks.length}:${md.trick.length}`);
      // the expert thinks off the page's thread; its answer counts only if the table is still where it asked
      think(md, r.mode === 'match' ? r.level : 'hard', seed, (deal) => {
        if (live && runRef.current === r) update(() => ({ ...r, match: { ...r.match, deal } }));
      });
    }, delay);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [run, sheet, paused, result, update, sfx]);

  const afterSheet = (): void => {
    const r = runRef.current;
    if (!r) return;
    sfx().click();
    const set = r.mode !== 'match';
    if ((set && r.booked >= SET_DEALS) || (!set && r.match.winner !== null)) {
      update((x) => ({ ...x, sheet: null }));
      return finish(r);
    }
    update((x) => ({ ...x, sheet: null, match: nextDeal(x.match) }));
  };

  const quit = (): void => {
    setRun(null);
    runRef.current = null;
    setResult(null);
    setPaused(false);
    setToday(dayKey());
    sfx().click();
  };

  // another tab changed the save: take it; a day's set already finished there leaves this table
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY) return;
      const fresh = loadSave();
      saveRef.current = fresh;
      setSave(fresh);
      const r = runRef.current;
      if (r?.day && r.mode === 'daily' && fresh.daily[r.day]?.done && !resultRef.current) {
        runRef.current = null;
        setRun(null);
        setPaused(false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  // midnight: the menu follows the day (when the page comes back, and once a minute)
  useEffect(() => {
    const check = (): void => setToday(dayKey());
    const onVis = (): void => {
      if (document.visibilityState === 'visible') check();
      // a hidden page pauses the table (nothing here is timed, so nothing is lost)
      else if (runRef.current && !resultRef.current) setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', check);
    const id = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', check);
      window.clearInterval(id);
    };
  }, []);

  const openRoom = async (listed: boolean): Promise<string | null> => {
    sfx().unlock();
    try {
      const code = await createRoom('belot', listed);
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
    if (!info || info.game !== 'belot') return w.noRoom;
    setRoomInUrl(code);
    setRoom(code);
    return null;
  };

  const tools = (
    <>
      <SoundMenu save={save} commit={commit} sfx={sfx} />
      {run && !result && (
        <button className="bl-icon" onClick={() => setPaused(true)} aria-label={w.pause}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      )}
      <GameMenuButton className="bl-icon" />
    </>
  );

  // Escape pauses
  useEffect(() => {
    if (!run || result) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.repeat || !keyForGame(e, rootRef.current)) return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, result]);

  const rootClass = `bl${save.fourColor ? ' is-four' : ''}`;

  if (room)
    return (
      <div ref={rootRef} className={rootClass} onPointerDown={() => sfx().unlock()}>
        <LiveTable
          w={w}
          code={room}
          name={playerName || ''}
          sfx={sfx}
          tools={tools}
          onLeave={() => {
            setRoomInUrl(null);
            setRoom(null);
          }}
        />
      </div>
    );

  if (run || (result && challenge)) {
    const r = run ?? freshRun('challenge', 'hard', challenge?.seed ?? 0);
    const setMode = r.mode !== 'match';
    const note = setMode ? w.dailyDeal(Math.min(SET_DEALS, r.booked + (sheet ? 0 : 1))) : undefined;
    // a challenge round has one attempt: no way out of it but to finish (it is saved and picked up again)
    const inRound = !!challenge && (r.mode === 'challenge' || (challenge.mode === 'daily' && r.day === challenge.day));
    return (
      <div ref={rootRef} className={rootClass} onPointerDown={() => sfx().unlock()}>
        <Table
          w={w}
          match={r.match}
          me={0}
          names={names}
          bots={[null, r.mode === 'match' ? r.level : 'hard', r.mode === 'match' ? r.level : 'hard', r.mode === 'match' ? r.level : 'hard']}
          onCall={onCall}
          onPlay={onPlay}
          sfx={sfx}
          locked={paused || !!sheet || !!result}
          tools={tools}
          note={note}
          overlay={
            <>
              {thrown && <p className="bl-toast">{setMode ? w.thrownSet : w.thrown}</p>}
              {sheet && !result && (
                <DealSheet w={w} score={sheet.score} taken={sheet.taken} scores={r.match.scores} me={0} names={names}>
                  <button className="bl-btn is-go" onClick={afterSheet} autoFocus>
                    {(setMode && r.booked >= SET_DEALS) || (!setMode && r.match.winner !== null) ? w.total : w.nextDeal}
                  </button>
                </DealSheet>
              )}
              {result && <ResultScreen w={w} res={result} day={dailyNumber(r.day ?? today)} challenge={challenge} onAgain={() => begin('match', saveRef.current.level)} onMenu={quit} />}
              {paused && !result && (
                <div className="bl-pause" role="dialog" aria-label={w.paused} onClick={() => setPaused(false)}>
                  <div className="bl-panel" onClick={(e) => e.stopPropagation()}>
                    <h2>{w.paused}</h2>
                    <button className="bl-btn is-go" autoFocus onClick={() => setPaused(false)}>
                      {w.resumeBtn}
                    </button>
                    {!inRound && (
                      <button className="bl-btn" onClick={quit}>
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
      <div ref={rootRef} className={`${rootClass} bl-scroll`}>
        <div className="bl-menu">
          <div className="bl-top-row">
            <button className="bl-btn is-small" onClick={() => setScreen('menu')}>
              ← {w.back}
            </button>
            <div className="bl-tools">{tools}</div>
          </div>
          <h2 className="bl-h">{w.howTo}</h2>
          <ol className="bl-rules">
            {w.rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </div>
    );

  return (
      <Menu
        rootRef={rootRef}
        rootClass={rootClass}
        w={w}
        save={save}
        today={today}
        tools={tools}
        onBegin={begin}
        onResume={() => {
          const r = saveRef.current.current;
          if (r) play(r);
        }}
        onRules={() => setScreen('rules')}
        onOpenRoom={openRoom}
        onJoinRoom={joinRoom}
      />
  );
}

function SoundMenu({ save, commit, sfx }: { save: Save; commit: (fn: (s: Save) => Save) => void; sfx: () => Sfx }) {
  const w = useWords();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent): void => {
      if (!(e.target as Element | null)?.closest('.bl-sound')) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="bl-sound">
      <button className="bl-icon" onClick={() => setOpen((o) => !o)} aria-label={w.settings} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {!(save.muted && save.musicOff) && <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <div className="bl-sound-menu" role="group" aria-label={w.settings}>
          {(
            [
              ['music', w.music, !save.musicOff],
              ['fx', w.sound, !save.muted],
              ['four', w.fourColor, save.fourColor],
            ] as const
          ).map(([k, label, on]) => (
            <button
              key={k}
              className="bl-switch"
              role="switch"
              aria-checked={on}
              onClick={() => {
                commit((s) => (k === 'music' ? { ...s, musicOff: !s.musicOff } : k === 'four' ? { ...s, fourColor: !s.fourColor } : { ...s, muted: !s.muted }));
                sfx().refresh();
                if (k === 'fx' && on === false) window.setTimeout(() => sfx().click(), 0);
              }}
            >
              {label} <span className="bl-knob" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Menu({
  rootRef,
  rootClass,
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
  rootRef: React.RefObject<HTMLDivElement | null>;
  rootClass: string;
  w: Words;
  save: Save;
  today: string;
  tools: React.ReactNode;
  onBegin: (m: 'match' | 'daily', l: Level) => void;
  onResume: () => void;
  onRules: () => void;
  onOpenRoom: (listed: boolean) => Promise<string | null>;
  onJoinRoom: (code: string) => Promise<string | null>;
}) {
  const [level, setLevel] = useState<Level>(save.level);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const daily = save.daily[today];
  // the day's set has its own slot: started, it can only be continued
  const resumeDaily = save.dailyRun?.day === today;
  const resumeMatch = save.current?.mode === 'match';
  return (
    <div ref={rootRef} className={`${rootClass} bl-scroll`}>
      <CardDefs />
      <div className="bl-menu">
        <div className="bl-top-row">
          <span />
          <div className="bl-tools">{tools}</div>
        </div>
        <div className="bl-hero" aria-hidden="true">
          {[cardOf(2, 6), cardOf(3, 4), cardOf(1, 7), cardOf(0, 5)].map((c, i) => (
            <span key={c} className="bl-hero-card" style={{ '--i': i } as React.CSSProperties}>
              <CardFace card={c} />
            </span>
          ))}
        </div>
        <h1 className="bl-title">{w.title}</h1>
        <p className="bl-tagline">{w.tagline}</p>

        <section className="bl-mode is-daily">
          <div>
            <b>{w.daily}</b>
            <small>{w.dailySub(dailyNumber(today))}</small>
            {daily?.done && (
              <span className="bl-done mono">
                {w.dailyDone} · {daily.score} · {daily.line}
              </span>
            )}
          </div>
          {!daily?.done && (
            <button className="bl-btn is-go" onClick={() => onBegin('daily', 'hard')}>
              {resumeDaily ? w.resumeBtn : w.start}
            </button>
          )}
        </section>

        <section className="bl-mode">
          <div>
            <b>{w.match}</b>
            <small>{w.matchSub}</small>
          </div>
          {resumeMatch && (
            <button className="bl-btn is-go" onClick={onResume}>
              {w.resume}
            </button>
          )}
          <div className="bl-levels" role="radiogroup" aria-label={w.pickLevel}>
            {LEVELS.map((l) => (
              <button key={l} role="radio" aria-checked={level === l} className={`bl-level${level === l ? ' is-on' : ''}`} onClick={() => setLevel(l)}>
                <b>{w.level[l]}</b>
                <small>{w.levelHint[l]}</small>
              </button>
            ))}
          </div>
          <button className={`bl-btn${resumeMatch ? '' : ' is-go'}`} onClick={() => onBegin('match', level)}>
            {w.start} · {w.level[level]}
          </button>
        </section>

        <section className="bl-mode">
          <div>
            <b>{w.friends}</b>
            <small>{w.friendsSub}</small>
          </div>
          <OnlinePlay game="belot" className="bl-online" busyLabel={w.opening} onCreate={onOpenRoom} onJoin={(c) => onJoinRoom(c)} />
          <form
            className="bl-join"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^[A-HJKMNP-Z]{5}$/.test(code)) return setErr(w.noRoom);
              setBusy(true);
              setErr((await onJoinRoom(code)) ?? '');
              setBusy(false);
            }}
          >
            <input className="bl-input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))} placeholder={w.joinCode} aria-label={w.joinCode} autoComplete="off" />
            <button className="bl-btn" disabled={busy || code.length !== 5}>
              {w.join}
            </button>
          </form>
          {err && <p className="bl-err">{err}</p>}
        </section>

        <button className="bl-btn is-ghost" onClick={onRules}>
          <SuitIcon suit={2} size={16} /> {w.howTo}
        </button>
        <p className="bl-stats mono" title={w.bestMatchHint}>
          {w.bestMatch} {save.bestMatch} · {w.wins} {save.wins}
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
  const share =
    res.mode === 'daily'
      ? `🃏 Belot #${day}\n${res.line}\n${res.ours}–${res.theirs ?? ''}\n${window.location.origin}/games/belot`
      : `🃏 Belot ${res.ours}–${res.theirs ?? ''}\n${res.line}\n${window.location.origin}/games/belot`;
  return (
    <div className="bl-sheet-wrap" role="dialog" aria-label={res.won ? w.matchWon : w.matchLost}>
      <div className={`bl-sheet bl-result${res.won ? ' is-win' : ''}`}>
        {res.won && <Confetti />}
        <h2 className="bl-result-title">{res.mode === 'match' ? (res.won ? w.matchWon : w.matchLost) : w.dailyScore}</h2>
        <p className="bl-result-score mono">
          <b>{res.ours}</b>
          {res.theirs !== null && <> – {res.theirs}</>}
        </p>
        {res.mode === 'match' && (
          <p className="bl-result-note mono" title={w.bestMatchHint}>
            {w.bestMatch}: {res.score}
          </p>
        )}
        {res.counted && <p className="bl-result-note">{w.dailyCounts}</p>}
        {res.best && <p className="bl-newbest">{w.newBest}</p>}
        <ResultLine line={res.line || '🃏'} label={res.theirs !== null ? w.scoreLine(res.ours, res.theirs) : String(res.ours)} />
        <div className="bl-sheet-actions">
          {res.mode === 'challenge' && challenge ? (
            <a className="bl-btn is-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
              {w.scoreboard}
            </a>
          ) : (
            <>
              <button className="bl-btn is-go" onClick={onAgain} autoFocus>
                {w.playAgain}
              </button>
              <button className="bl-btn" onClick={() => void shareOrCopy({ title: 'Belot', text: share }).then((o) => setMsg(o === 'copied' ? w.copied : ''))}>
                {msg || w.share}
              </button>
            </>
          )}
          <button className="bl-btn is-ghost" onClick={onMenu}>
            {w.menu}
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="bl-confetti" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--c': ['#ffd12e', '#ff4fa3', '#22e4ff', '#c4f034'][i % 4] } as React.CSSProperties} />
      ))}
    </div>
  );
}

