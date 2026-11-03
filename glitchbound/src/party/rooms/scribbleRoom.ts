/**
 * Scribble Scramble in a live room: one player at a time draws a word on their phone while everyone
 * else watches the picture appear live and types guesses. The drawer chooses from three words, Easy,
 * Medium and Hard; a harder word is worth more. The sooner you guess, the more you score, and the
 * drawer scores for every player who gets it. Letters of the word show as hints while the clock runs.
 *
 * The strokes stream through the room without a new view for everyone (`relay`, see rooms/engines.ts):
 * the drawing is a log of ops (../scribble.ts) a phone that joins late asks for in one go (`sync`).
 *
 * Phases: lobby → choose → draw → reveal → choose … → result.
 */
import { TIERS, type Tier } from '../content/scribble';
import { drawerPoints, guessPoints, hintCount, isHit, isNear, mask, validOp, type Op } from '../scribble';
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
/** How many times everyone draws. */
export const LAPS = [1, 2, 3] as const;
/** Seconds to draw. */
export const CLOCKS = [60, 80, 100] as const;
export const CHOOSE_SECONDS = 15;
export const REVEAL_SECONDS = 7;
/** Hints show at these shares of the clock gone. */
const HINT_AT = [0.45, 0.65, 0.8];
/** The most a drawing may hold (numbers across its ops), so a room's state stays small. */
export const INK_MAX = 40_000;
const OPS_PER_MESSAGE = 80;
const CHAT_KEEP = 40;
export const CHAT_MAX = 60;
/** The least time between one player's messages. */
export const CHAT_GAP_MS = 350;

export type Phase = 'lobby' | 'choose' | 'draw' | 'reveal' | 'result';

export interface Settings {
  laps: (typeof LAPS)[number];
  clock: (typeof CLOCKS)[number];
  /** Letters of the word show as the clock runs. */
  hints: boolean;
}

export interface Msg {
  id: number;
  /** Who wrote it (0: the room). */
  n: number;
  text: string;
  /** chat: a guess or a remark; hit: got it (text is empty); near: close (to the guesser alone); note: from the room. */
  kind: 'chat' | 'hit' | 'near' | 'note';
  /** Only these seats see it (after you get the word, you chat with those who have it too); null: everyone. */
  to: number[] | null;
}

export interface Turn {
  drawer: number;
  /** Easy, Medium and Hard. */
  offer: [string, string, string];
  word: string | null;
  tier: Tier | null;
  /** When drawing began and when it ends. */
  start: number;
  end: number;
  /** Right guesses, in order. */
  hits: { n: number; points: number }[];
  /** Letters shown so far (indexes in the word). */
  shown: number[];
  gained: Record<string, number>;
}

export interface State extends RoomBase {
  game: 'scribble';
  phase: Phase;
  settings: Settings;
  playing: number[];
  /** Where in `playing` to look for the next drawer. */
  next: number;
  count: number;
  total: number;
  turn: Turn | null;
  ink: Op[];
  /** Numbers across the ink's ops. */
  inkSize: number;
  chat: Msg[];
  msgId: number;
  lastMsg: Record<string, number>;
  /** Words already drawn in this room (none comes back until the list runs low). */
  used: string[];
  /** Seat → points this game. */
  points: Record<string, number>;
  games: number;
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'scribble',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    settings: { laps: 1, clock: 80, hints: true },
    playing: [],
    next: 0,
    count: 0,
    total: 0,
    turn: null,
    ink: [],
    inkSize: 0,
    chat: [],
    msgId: 0,
    lastMsg: {},
    used: [],
    points: {},
    games: 0,
  };
}

const inGame = (s: State): boolean => s.phase === 'choose' || s.phase === 'draw' || s.phase === 'reveal';
const isHere = (s: State, n: number): boolean => s.seats.some((x) => x.n === n && x.online);
/** Everyone here but the drawer guesses (players who joined mid-game too). */
const guessers = (s: State): number[] => s.seats.filter((x) => x.online && x.n !== s.turn?.drawer).map((x) => x.n);
const hasWord = (t: Turn, n: number): boolean => n === t.drawer || t.hits.some((h) => h.n === n);

function say(s: State, n: number, text: string, kind: Msg['kind'], to: number[] | null = null): void {
  s.chat.push({ id: ++s.msgId, n, text, kind, to });
  if (s.chat.length > CHAT_KEEP) s.chat.splice(0, s.chat.length - CHAT_KEEP);
}

export function join(s: State, key: string, name: string, now: number): string | null {
  return joinSeat(s, key, name, now, MAX_PLAYERS, inGame(s));
}

export function leave(s: State, key: string, now: number): void {
  if (!leaveSeat(s, key, now)) return;
  advance(s, now);
}

/** A word nobody has drawn here yet, for each tier. */
function offer(s: State): [string, string, string] {
  const pick = (tier: number): string => {
    const all = TIERS[tier]!;
    let pool = all.filter((w) => !s.used.includes(w));
    if (pool.length < 3) {
      s.used = s.used.filter((w) => !all.includes(w));
      pool = [...all];
    }
    return pool[nextRandom(s) % pool.length]!;
  };
  return [pick(0), pick(1), pick(2)];
}

function deal(s: State, now: number): void {
  if (s.count >= s.total) return finish(s);
  for (const x of s.seats)
    if (x.waiting && x.online) {
      x.waiting = false;
      s.playing.push(x.n);
    }
  const count = s.playing.length;
  // Someone who isn't here misses their turn (it is used up, not handed to the next player, so
  // "everyone draws once" stays once each).
  let pick = s.next % count;
  while (s.count < s.total && !isHere(s, s.playing[pick]!)) {
    s.count++;
    pick = (pick + 1) % count;
  }
  if (s.count >= s.total) return finish(s);
  s.next = pick + 1;
  s.turn = { drawer: s.playing[pick]!, offer: offer(s), word: null, tier: null, start: 0, end: 0, hits: [], shown: [], gained: {} };
  s.ink = [];
  s.inkSize = 0;
  s.count++;
  s.phase = 'choose';
  s.deadline = now + CHOOSE_SECONDS * 1000;
}

function choose(s: State, tier: Tier, now: number): void {
  const t = s.turn!;
  t.tier = tier;
  t.word = t.offer[tier];
  s.used.push(t.word);
  t.start = now;
  t.end = now + s.settings.clock * 1000;
  s.phase = 'draw';
  s.deadline = nextEvent(s);
  say(s, 0, `${seatByN(s, t.drawer)?.name ?? 'Someone'} is drawing`, 'note');
}

/** The next hint, or the end of the turn. */
function nextEvent(s: State): number {
  const t = s.turn!;
  if (s.settings.hints && t.word && t.shown.length < hintCount(t.word)) return Math.min(t.end, t.start + HINT_AT[t.shown.length]! * (t.end - t.start));
  return t.end;
}

function hint(s: State): void {
  const t = s.turn!;
  const hidden = [...t.word!].map((ch, i) => (ch !== ' ' && !t.shown.includes(i) ? i : -1)).filter((i) => i >= 0);
  // Never the whole word: at least two letters stay blank.
  if (hidden.length > 2) t.shown.push(hidden[nextRandom(s) % hidden.length]!);
}

function reveal(s: State, now: number): void {
  const t = s.turn!;
  const g: Record<string, number> = {};
  for (const h of t.hits) g[h.n] = h.points;
  if (t.tier !== null) {
    const d = drawerPoints(t.tier, t.hits.length, Math.max(t.hits.length, guessers(s).length));
    if (d > 0) g[t.drawer] = d;
  }
  t.gained = g;
  for (const [n, p] of Object.entries(g)) {
    s.points[n] = (s.points[n] ?? 0) + p;
    const seat = seatByN(s, Number(n));
    if (seat) seat.score += p;
  }
  if (t.word) say(s, 0, `The word was “${t.word}”`, 'note');
  s.phase = 'reveal';
  s.deadline = now + REVEAL_SECONDS * 1000;
}

function finish(s: State): void {
  s.phase = 'result';
  s.deadline = null;
  s.turn = null;
  s.ink = [];
  s.inkSize = 0;
}

function advance(s: State, now: number): void {
  if (!inGame(s)) return;
  if (online(s).length < MIN_PLAYERS) {
    s.phase = 'lobby';
    s.deadline = null;
    s.turn = null;
    s.ink = [];
    s.inkSize = 0;
    return;
  }
  const t = s.turn;
  if (!t) return;
  // The drawer left: show the word and move on.
  if ((s.phase === 'choose' || s.phase === 'draw') && !isHere(s, t.drawer)) return reveal(s, now);
  if (s.phase === 'draw' && guessers(s).every((n) => hasWord(t, n))) reveal(s, now);
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  const t = s.turn;
  if (s.phase === 'choose' && t) choose(s, (nextRandom(s) % 3) as Tier, now);
  else if (s.phase === 'draw' && t) {
    if (now >= t.end) reveal(s, now);
    else {
      hint(s);
      s.deadline = nextEvent(s);
    }
  } else if (s.phase === 'reveal') deal(s, now);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'pick'; tier: number }
  | { t: 'say'; text: string }
  | { t: 'ink'; turn: number; ops: Op[] }
  | { t: 'sync' }
  | { t: 'next' }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number };

const chooseFrom = <T>(list: readonly T[], v: unknown): T | undefined => ((list as readonly unknown[]).includes(v) ? (v as T) : undefined);

/** A message as kept: no control characters, one line, CHAT_MAX characters at most. */
export const cleanText = (raw: unknown): string =>
  typeof raw === 'string'
    ? [...raw]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, CHAT_MAX)
    : '';

function guess(s: State, n: number, raw: unknown, now: number): string | null {
  const text = cleanText(raw);
  if (!text) return null;
  if (now - (s.lastMsg[n] ?? 0) < CHAT_GAP_MS) return 'Too fast: send that again.';
  s.lastMsg[n] = now;
  const t = s.turn;
  if (s.phase !== 'draw' || !t?.word || t.tier === null) {
    say(s, n, text, 'chat');
    return null;
  }
  // The drawer and those who have the word chat among themselves (no spoilers for the rest).
  if (hasWord(t, n)) {
    if (n === t.drawer && isHit(text, t.word)) return 'No giving it away!';
    say(s, n, text, 'chat', [t.drawer, ...t.hits.map((h) => h.n)]);
    return null;
  }
  if (isHit(text, t.word)) {
    const points = guessPoints(t.tier, t.end - now, t.end - t.start, t.hits.length);
    t.hits.push({ n, points });
    say(s, n, '', 'hit');
    advance(s, now);
    return null;
  }
  say(s, n, text, 'chat');
  if (isNear(text, t.word)) say(s, 0, `“${text}” is close!`, 'near', [n]);
  return null;
}

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const isHost = me.n === s.host;
  const t = s.turn;
  s.updated = now;
  switch (a?.t) {
    case 'settings': {
      if (!isHost) return 'Only the host can change the settings.';
      if (inGame(s)) return 'Change settings between games.';
      const p = a.settings ?? {};
      s.settings.laps = chooseFrom(LAPS, p.laps) ?? s.settings.laps;
      s.settings.clock = chooseFrom(CLOCKS, p.clock) ?? s.settings.clock;
      if (typeof p.hints === 'boolean') s.settings.hints = p.hints;
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the game.';
      if (inGame(s)) return null;
      const here = online(s);
      if (here.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      for (const x of s.seats) x.waiting = false;
      s.playing = here.map((x) => x.n);
      s.next = 0;
      s.count = 0;
      s.total = s.playing.length * s.settings.laps;
      s.points = {};
      s.games++;
      deal(s, now);
      return null;
    }
    case 'pick': {
      if (s.phase !== 'choose' || !t || t.drawer !== me.n) return null;
      const tier = Number(a.tier);
      if (tier !== 0 && tier !== 1 && tier !== 2) return null;
      choose(s, tier, now);
      return null;
    }
    case 'say':
      return guess(s, me.n, a.text, now);
    case 'next':
      if (!isHost || !t) return null;
      if (s.phase === 'draw' || s.phase === 'choose') reveal(s, now);
      else if (s.phase === 'reveal') deal(s, now);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      s.turn = null;
      s.ink = [];
      s.inkSize = 0;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) {
        s.playing = s.playing.filter((n) => n !== a.seat);
        if (t?.drawer === a.seat && (s.phase === 'choose' || s.phase === 'draw')) reveal(s, now);
        advance(s, now);
      }
      return null;
    default:
      return 'Unknown action.';
  }
}

/**
 * Strokes: only the drawer, only while drawing this turn. Everyone else gets the new ops with where they
 * go in the log (`at`), so a phone that missed some asks for the whole drawing instead (`sync`).
 */
export function relay(s: State, key: string, a: Action, now: number): { others?: unknown; self?: unknown; save?: boolean } | null {
  if (a?.t === 'sync') return { self: { turn: s.count, at: 0, ops: s.ink, sync: true } };
  if (a?.t !== 'ink') return null;
  const me = seatOf(s, key);
  const t = s.turn;
  if (!me || !t || s.phase !== 'draw' || t.drawer !== me.n || a.turn !== s.count || now > t.end) return {};
  const ops = Array.isArray(a.ops) ? a.ops.slice(0, OPS_PER_MESSAGE).filter(validOp) : [];
  const size = ops.reduce((sum, op) => sum + op.length, 0);
  if (!ops.length) return {};
  if (s.inkSize + size > INK_MAX) return { self: { full: true } };
  const at = s.ink.length;
  s.ink.push(...ops);
  s.inkSize += size;
  s.updated = now;
  return { others: { turn: s.count, at, ops }, save: ops.some((op) => op[0]! >= 2) };
}

export interface RoomView {
  game: 'scribble';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  playing: number[];
  count: number;
  total: number;
  turn: {
    drawer: number;
    /** The three words, on the drawer's phone while they choose. */
    offer: [string, string, string] | null;
    tier: Tier | null;
    /** The word, for the drawer and those who have guessed it (everyone at the reveal). */
    word: string | null;
    /** Blanks and hinted letters, for the rest. */
    mask: string | null;
    end: number;
    hits: { n: number; points: number }[];
    gained: Record<string, number> | null;
  } | null;
  /** How many ops the drawing holds (a phone that has fewer asks for them). */
  ink: number;
  chat: Msg[];
  points: Record<string, number>;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const t = s.turn;
  const shown = s.phase === 'reveal';
  return {
    game: 'scribble',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me, (n) => !!t && s.phase === 'draw' && hasWord(t, n) && n !== t.drawer),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    playing: s.playing,
    count: s.count,
    total: s.total,
    turn:
      t && inGame(s)
        ? {
            drawer: t.drawer,
            offer: s.phase === 'choose' && me.n === t.drawer ? t.offer : null,
            tier: t.tier,
            word: t.word && (shown || hasWord(t, me.n)) ? t.word : null,
            mask: t.word ? mask(t.word, t.shown) : null,
            end: t.end,
            hits: t.hits,
            gained: shown ? t.gained : null,
          }
        : null,
    ink: s.ink.length,
    chat: s.chat.filter((m) => m.to === null || m.to.includes(me.n)),
    points: s.points,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'scribble', MAX_PLAYERS);
}
