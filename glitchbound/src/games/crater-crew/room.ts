/**
 * Crater Crew live: a room on the rooms worker (rooms/worker.ts) where 2 to 6 crews fight on their own
 * phones. In the lobby everyone picks a critter, and the host picks the terrain, crew size and turn
 * time and can add computer crews. In battle the room is the referee: the player whose turn it is
 * walks on their own phone (their position streams to the others through `relay`), then sends the
 * whole turn (every step's input and the shot); the room replays it through the same physics
 * (match.ts), keeps the result, and every phone replays it to show it. The room plays the computer
 * crews, passes the turn of anyone who has left, and gives the next turn its clock once the shot has
 * had time to play out. Pure: the worker's alarm calls tick() at `deadline`.
 *
 * Phases: lobby → play → over → (rematch) play, or (lobby) lobby.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../party/rooms/seats';
import { botTurn } from './ai';
import { CHAR_IDS, freeChar, isCharId, type CharId } from './characters';
import { cleanInput, CREW_SIZES, isLevel, MAX_CREWS, newMatch, playTurn, TURN_TIMES, type CrewSpec, type Level, type Match } from './match';
import { STEP } from './sim';
import { isTerrainId, TERRAIN_IDS, type TerrainId } from './terrains';

export { validKey } from '../../party/rooms/seats';

/** Six crews, and a couple more can watch (and join the next battle). */
export const MAX_PLAYERS = 8;
/** A computer crew thinks this long once its turn starts (the phones show it aiming). */
export const BOT_MS = 1600;
/** The turn of someone who has left passes after this long. */
export const AWAY_MS = 5000;
/** A turn's clock gets this much more on the server, for the phone's own turn message to arrive. */
export const GRACE_MS = 4000;
/** After a shot: the time the phones need to show the aim, and the pause once everything is still. */
export const AIM_MS = 900;
export const SETTLE_MS = 1400;
/** The longest a turn's replay is waited for. */
const MAX_REPLAY_MS = 30_000;

export type Phase = 'lobby' | 'play' | 'over';
export type TerrainPick = TerrainId | 'random';

export interface State extends RoomBase {
  game: 'crater-crew';
  phase: Phase;
  /** Who plays, in crew order: seat numbers with their critter. */
  picks: { n: number; char: CharId }[];
  bots: { char: CharId; level: Level }[];
  terrain: TerrainPick;
  crewSize: number;
  turnSecs: number;
  match: Match | null;
  /** When the current turn's clock starts (the last shot has played out by then). */
  turnAt: number;
  /** When the computer moves, or an absent player's turn passes. */
  moveAt: number | null;
  /** When the crew to play started waiting on a player who has left. */
  awaySince: number | null;
  battles: number;
  /** Seats that chose to watch: a rematch or the lobby leaves them out until they join (older rooms: none). */
  watching?: number[];
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'crater-crew',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    picks: [],
    bots: [],
    terrain: 'random',
    crewSize: 2,
    turnSecs: 30,
    match: null,
    turnAt: 0,
    moveAt: null,
    awaySince: null,
    battles: 0,
    watching: [],
  };
}

const watches = (s: State, n: number): boolean => !!s.watching?.includes(n);
/** Every seat here that hasn't chosen to watch takes a place again (a rematch, or back to the lobby). */
function reseat(s: State): void {
  for (const seat of s.seats) if (seat.online && !watches(s, seat.n)) seatIn(s, seat.n);
  s.picks = s.picks.filter((p) => seatByN(s, p.n)?.online);
}

const taken = (s: State): CharId[] => [...s.picks.map((p) => p.char), ...s.bots.map((b) => b.char)];
const crewCount = (s: State): number => s.picks.length + s.bots.length;

/** A seat takes a place in the lobby (when there is room for one more crew). */
function seatIn(s: State, n: number): void {
  if (s.picks.some((p) => p.n === n) || crewCount(s) >= MAX_CREWS) return;
  s.picks.push({ n, char: freeChar(taken(s), CHAR_IDS[(n - 1) % CHAR_IDS.length]) });
}

export function join(s: State, key: string, name: string, now: number): string | null {
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, s.phase === 'play');
  if (err) return err;
  const n = seatOf(s, key)!.n;
  if (s.phase !== 'play' && !watches(s, n)) seatIn(s, n);
  schedule(s, now);
  return null;
}

export function leave(s: State, key: string, now: number): void {
  const seat = leaveSeat(s, key, now);
  if (!seat) return;
  if (s.phase !== 'play') s.picks = s.picks.filter((p) => p.n !== seat.n);
  schedule(s, now);
}

/** The crew whose turn it is, and who plays it. */
function actor(s: State): { crew: number; bot: Level | null; away: boolean } | null {
  const m = s.match;
  if (s.phase !== 'play' || !m || m.over) return null;
  const c = m.crews[m.crewTurn];
  if (!c) return null;
  const seat = c.seat !== null ? seatByN(s, c.seat) : undefined;
  return { crew: m.crewTurn, bot: c.bot, away: !c.bot && (!seat || !seat.online) };
}

function schedule(s: State, now: number): void {
  s.moveAt = null;
  s.deadline = null;
  const a = actor(s);
  if (!a?.away) s.awaySince = null;
  // nobody here to watch: the battle waits for them
  if (!a || online(s).length === 0) return;
  if (a.bot) s.moveAt = s.turnAt + BOT_MS;
  else if (a.away) {
    s.awaySince ??= now;
    s.moveAt = Math.max(s.turnAt, s.awaySince) + AWAY_MS;
  }
  s.deadline = s.moveAt ?? s.turnAt + s.match!.turnSecs * 1000 + GRACE_MS;
}

function startBattle(s: State, now: number): void {
  const crews: CrewSpec[] = [
    ...s.picks.map((p) => ({ name: seatByN(s, p.n)?.name ?? 'Player', char: p.char, bot: null, seat: p.n })),
    ...s.bots.map((b) => ({ name: botName(b.char), char: b.char, bot: b.level, seat: null })),
  ];
  const terrain = s.terrain === 'random' ? TERRAIN_IDS[nextRandom(s) % TERRAIN_IDS.length]! : s.terrain;
  s.match = newMatch({ seed: nextRandom(s), terrain, crewSize: s.crewSize, turnSecs: s.turnSecs, crews });
  s.phase = 'play';
  s.turnAt = now + 2500;
  s.battles++;
  for (const seat of s.seats) seat.waiting = false;
  s.updated = now;
}

const BOT_NAMES: Record<CharId, string> = { frog: 'Hopper', fox: 'Rusty', penguin: 'Waddles', robot: 'Bolt', slime: 'Gloop', owl: 'Hoot', bunny: 'Clover', duck: 'Quackers' };
export const botName = (c: CharId): string => `${BOT_NAMES[c]} (CPU)`;

/** Plays a turn into the battle and gives the next one its clock once this one has played out. */
function apply(s: State, input: Parameters<typeof playTurn>[1], now: number): void {
  const m = s.match!;
  const { match, walkSteps, shotSteps } = playTurn(m, input);
  // the phones that watched the walk live only replay the shot; the bot's turn also shows its aim
  const replay = Math.min(MAX_REPLAY_MS, (shotSteps + Math.min(walkSteps, 240)) * STEP * 1000 + AIM_MS + SETTLE_MS);
  s.match = match;
  s.turnAt = now + replay;
  s.awaySince = null;
  if (match.over) {
    s.phase = 'over';
    const w = match.winner !== null && match.winner >= 0 ? match.crews[match.winner] : undefined;
    const seat = w?.seat !== null && w?.seat !== undefined ? seatByN(s, w.seat) : undefined;
    if (seat) seat.score++;
  }
}

export function tick(s: State, now: number): void {
  if (s.moveAt !== null && now >= s.moveAt && s.match && s.phase === 'play') {
    const a = actor(s);
    if (a?.bot) apply(s, botTurn(s.match, a.bot, nextRandom(s)), now);
    else if (a?.away) apply(s, { walk: [], fire: null }, now);
  } else if (s.phase === 'play' && s.match && !s.match.over && s.moveAt === null && now >= s.turnAt + s.match.turnSecs * 1000 + GRACE_MS) {
    // the clock ran out and the phone never sent its turn: the turn passes where it began
    apply(s, { walk: [], fire: null }, now);
  }
  schedule(s, now);
}

export type Action =
  | { t: 'char'; char: CharId }
  | { t: 'bot'; op: 'add' }
  | { t: 'bot'; op: 'remove'; i: number }
  | { t: 'bot'; op: 'level'; i: number; level: Level }
  | { t: 'terrain'; id: TerrainPick }
  | { t: 'size'; n: number }
  | { t: 'time'; n: number }
  | { t: 'play' }
  | { t: 'watch' }
  | { t: 'start' }
  | { t: 'turn'; turn: number; walk: unknown; fire: unknown; run?: unknown }
  | { t: 'again' }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number }
  | { t: 'pos'; x: number; y: number; f: number; a: number; w: string; p: number; mv: number; tx: number };

const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  s.updated = now;
  const host = me.n === s.host;
  const lobby = s.phase === 'lobby';
  const done = (): null => {
    schedule(s, now);
    return null;
  };
  switch (a?.t) {
    case 'char': {
      if (s.phase === 'play' || !isCharId(a.char)) return null;
      const mine = s.picks.find((p) => p.n === me.n);
      if (!mine) return null;
      if (mine.char !== a.char && taken(s).includes(a.char)) return 'Someone already picked that critter.';
      mine.char = a.char;
      return done();
    }
    case 'bot': {
      if (!host || s.phase === 'play') return null;
      if (a.op === 'add') {
        if (crewCount(s) >= MAX_CREWS) return 'Six crews is the most a battle takes.';
        s.bots.push({ char: freeChar(taken(s), 'robot'), level: 'normal' });
      } else if (a.op === 'remove' && int(a.i, 0, s.bots.length - 1)) s.bots.splice(a.i, 1);
      else if (a.op === 'level' && int(a.i, 0, s.bots.length - 1) && isLevel(a.level)) s.bots[a.i]!.level = a.level;
      return done();
    }
    case 'terrain':
      if (!host || s.phase === 'play' || !(a.id === 'random' || isTerrainId(a.id))) return null;
      s.terrain = a.id;
      return done();
    case 'size':
      if (!host || s.phase === 'play' || !(CREW_SIZES as readonly number[]).includes(a.n)) return null;
      s.crewSize = a.n;
      return done();
    case 'time':
      if (!host || s.phase === 'play' || !(TURN_TIMES as readonly number[]).includes(a.n)) return null;
      s.turnSecs = a.n;
      return done();
    case 'play':
      s.watching = (s.watching ?? []).filter((n) => n !== me.n);
      // during a battle it only says "count me in for the next one"
      if (s.phase === 'play') return done();
      if (crewCount(s) >= MAX_CREWS && !s.picks.some((p) => p.n === me.n)) return 'All six crews are taken.';
      seatIn(s, me.n);
      return done();
    case 'watch':
      if (!watches(s, me.n)) (s.watching ??= []).push(me.n);
      if (s.phase === 'play') return done();
      s.picks = s.picks.filter((p) => p.n !== me.n);
      return done();
    case 'start':
    case 'again':
      if (!host || (a.t === 'start' ? !lobby : s.phase !== 'over')) return null;
      if (a.t === 'again') reseat(s);
      else s.picks = s.picks.filter((p) => seatByN(s, p.n)?.online);
      if (crewCount(s) < 2) return 'Two crews are needed: invite a friend or add a computer crew.';
      startBattle(s, now);
      return done();
    case 'lobby':
      if (!host || s.phase !== 'over') return null;
      s.phase = 'lobby';
      s.match = null;
      reseat(s);
      return done();
    case 'turn': {
      const m = s.match;
      if (s.phase !== 'play' || !m || m.over || a.turn !== m.turn) return null;
      if (m.crews[m.crewTurn]?.seat !== me.n) return 'It isn’t your turn.';
      // no longer a walk than the turn's clock (and the room's grace) allows
      const input = cleanInput(a, Math.round((m.turnSecs * 1000 + GRACE_MS) / 1000 / STEP));
      if (!input) return 'That turn didn’t make sense.';
      apply(s, input, now);
      return done();
    }
    case 'kick':
      if (!lobby) return null;
      if (kickSeat(s, me, a.seat)) s.picks = s.picks.filter((p) => p.n !== a.seat);
      return done();
    default:
      return 'Unknown action.';
  }
}

/** The active player's live position and aim, streamed to the others (no new view for anyone). */
export function relay(s: State, key: string, a: Action): { others?: unknown; save?: boolean } | null {
  if (a?.t !== 'pos') return null;
  const m = s.match;
  const me = seatOf(s, key);
  if (!me || s.phase !== 'play' || !m || m.crews[m.crewTurn]?.seat !== me.n) return { save: false };
  const num = (v: unknown, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : 0);
  return {
    others: { t: 'pos', turn: m.turn, unit: m.active, x: num(a.x, -400, 2200), y: num(a.y, -400, 1000), f: a.f === -1 ? -1 : 1, a: num(a.a, -850, 850), w: typeof a.w === 'string' ? a.w.slice(0, 12) : 'rocket', p: num(a.p, 0, 100), mv: num(a.mv, 0, 3), tx: num(a.tx, 0, 1800) },
    save: false,
  };
}

/** The most a turn message can carry (every step's input, run-length coded). */
export const maxMessage = 16_384;

// ---------------------------------------------------------------- what each phone sees

export interface RoomView {
  game: 'crater-crew';
  code: string;
  phase: Phase;
  /** Your seat number. */
  me: number;
  host: boolean;
  players: SeatView[];
  picks: { n: number; char: CharId }[];
  bots: { char: CharId; level: Level }[];
  terrain: TerrainPick;
  crewSize: number;
  turnSecs: number;
  match: Match | null;
  turnAt: number;
  deadline: number | null;
  /** You chose to watch: the next battle leaves you out until you join. */
  watching: boolean;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  return {
    game: 'crater-crew',
    code: s.code,
    phase: s.phase,
    me: me.n,
    host: me.n === s.host,
    players: seatViews(s, me, (n) => s.picks.some((p) => p.n === n)),
    picks: s.picks,
    bots: s.bots,
    terrain: s.terrain,
    crewSize: s.crewSize,
    turnSecs: s.turnSecs,
    match: s.match,
    turnAt: s.turnAt,
    deadline: s.deadline,
    watching: watches(s, me.n),
  };
}

export function summary(s: State) {
  return summaryOf(s, 'crater-crew', MAX_PLAYERS);
}
