/**
 * A private room for The Ring: friends take seats on two teams, each picks a class and a bar, and the host's game runs
 * the match (empty places go to the computer). The room only keeps the seating and each player's choices; the fight
 * goes through `relay`, host to everyone and everyone to host (see ui/RingScreen.tsx). Pure, and free of the game's
 * data, so the rooms worker stays small.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../../party/rooms/seats';

export { validKey } from '../../../party/rooms/seats';

export const MAX_PLAYERS = 6;
export const maxMessage = 12_000;

export type Phase = 'lobby' | 'run';

/** One player's choices, only ever drawn or passed to the host's match, which checks them against the game's data. */
export interface Pick {
  team: 0 | 1;
  cls: string;
  bar: string[];
  talents: string[];
  /** Which of their class's supers (the match checks it is one of theirs). */
  ult?: string;
  /** Their matchmaking rating in the room's format, when a search brought them (arena/queue.ts): what a win over them is worth. */
  rating?: number;
  /**
   * What the computer brings to this player's side for each place no person takes (arena/teammates.ts `choiceWord`:
   * `priest-0`, or `random`), when they are the first on it.
   */
  mates?: string[];
  /** The title they wear, shown over their head to everyone in the match: its words and its light (catalog/titleFx.ts). */
  title?: { text: string; fx: string; before?: boolean };
  /** The nameplate frame they wear, by its id (the game checks it against its own list when it draws it). */
  frame?: string;
}

/**
 * A title as a room keeps it: its words without control or invisible characters, folded and cut to 40, and the id of
 * its light. (The game itself checks the light against its own list when it draws it: this stays free of that list.)
 */
function cleanRoomTitle(v: unknown): Pick['title'] | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;
  if (typeof t.text !== 'string' || typeof t.fx !== 'string' || !ID.test(t.fx)) return null;
  const text = [...t.text]
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c >= 0x20 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && !(c >= 0x2066 && c <= 0x2069);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .trim();
  return text ? { text, fx: t.fx, ...(typeof t.before === 'boolean' ? { before: t.before } : {}) } : null;
}

/**
 * A party in the ranked queue (the owner, 2026-11-18: "in the partner section where you choose a partner, there should
 * be option to invite a friend"): friends who sat down together on one side of a room put it in the queue of its
 * format, at the rating they search at, and quick match sends players to fill it (rooms/worker.ts lists it while it
 * waits). Taken off as the match begins.
 */
export interface Queue {
  kind: string;
  mmr: number;
  since: number;
}

export interface State extends RoomBase {
  game: 'sigilfall-ring';
  phase: Phase;
  format: 1 | 2 | 3;
  map: string;
  picks: Record<string, Pick>;
  run: number;
  runSeed: number;
  /** In the ranked queue, while it waits. */
  queue?: Queue | null;
  /** The party's seats: those seated when it went into the queue. They stay on their side, together. */
  party?: number[];
  /** The run that is going was found by the ranked queue. */
  ranked?: boolean;
}

export interface View {
  game: 'sigilfall-ring';
  code: string;
  phase: Phase;
  you: number;
  host: number;
  format: 1 | 2 | 3;
  map: string;
  seats: (SeatView & { pick: Pick | null })[];
  run: number;
  runSeed: number;
  /** In the ranked queue: since when. */
  queued: number | null;
  /** The party's seats, while it is in the queue. */
  party: number[];
}

export type Action =
  | { t: 'pick'; pick: Pick }
  | { t: 'setup'; format: number; map: string }
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'bye' }
  | { t: 'kick'; n: number }
  /** The host puts the party in the ranked queue, at the rating it searches at, or takes it out. */
  | { t: 'queue'; on: boolean; rating?: number }
  | { t: 'r'; d: unknown };

export function newRoom(code: string, now: number, seed: number): State {
  return { game: 'sigilfall-ring', code, created: now, updated: now, phase: 'lobby', seats: [], nextSeat: 1, host: 0, deadline: null, seed, format: 2, map: 'sands', picks: {}, run: 0, runSeed: 0 };
}

export function join(s: State, key: string, name: string, now: number): string | null {
  if (s.phase === 'run' && !seatOf(s, key)) return s.seats.length >= MAX_PLAYERS ? 'full' : 'in_run';
  const host = s.host;
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, false);
  if (!err && s.phase === 'run' && s.seats.some((x) => x.n === host)) s.host = host;
  return err;
}

export function leave(s: State, key: string, now: number): void {
  const host = s.host;
  const seat = leaveSeat(s, key, now);
  if (seat && !s.seats.some((x) => x.n === seat.n)) delete s.picks[seat.n];
  if (s.phase === 'run' && s.seats.some((x) => x.n === host)) s.host = host;
  if (s.phase === 'run' && !s.seats.some((x) => x.online)) s.phase = 'lobby';
}

export function tick(): void {}

const ID = /^[a-z0-9-]{1,24}$/;

/** A player's choices, checked for shape and size. */
export function cleanPick(v: unknown): Pick | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  // (an oath and the Swift Step's place were chosen too until 2026-11-15: a game from before still sends them, unread)
  if ((p.team !== 0 && p.team !== 1) || typeof p.cls !== 'string' || !ID.test(p.cls)) return null;
  if (!Array.isArray(p.bar) || p.bar.length > 6 || !p.bar.every((b) => typeof b === 'string' && ID.test(b))) return null;
  const talents = Array.isArray(p.talents) && p.talents.length <= 4 && p.talents.every((b) => typeof b === 'string' && ID.test(b)) ? (p.talents as string[]) : [];
  const rating = typeof p.rating === 'number' && Number.isFinite(p.rating) ? { rating: Math.max(0, Math.min(9999, Math.round(p.rating))) } : {};
  const ult = typeof p.ult === 'string' && ID.test(p.ult) ? { ult: p.ult } : {};
  const mates = Array.isArray(p.mates) && p.mates.length <= 2 && p.mates.every((b) => typeof b === 'string' && ID.test(b)) ? { mates: p.mates as string[] } : {};
  const t = cleanRoomTitle(p.title);
  const title = t ? { title: t } : {};
  const frame = typeof p.frame === 'string' && ID.test(p.frame) ? { frame: p.frame } : {};
  return { team: p.team, cls: p.cls, bar: p.bar as string[], talents, ...ult, ...rating, ...mates, ...title, ...frame };
}

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me || !a || typeof a !== 'object') return 'not_seated';
  const host = me.n === s.host;
  switch (a.t) {
    case 'pick': {
      if (s.phase !== 'lobby') return 'not_lobby';
      const pick = cleanPick(a.pick);
      if (!pick) return 'bad_pick';
      // (a party in the queue stays on its side, together)
      if (s.queue && s.party?.includes(me.n) && s.picks[me.n] && s.picks[me.n]!.team !== pick.team) return 'queued';
      // a side can't hold more than the format seats
      const taken = s.seats.filter((x) => x.n !== me.n && s.picks[x.n]?.team === pick.team).length;
      if (taken >= s.format) return 'team_full';
      s.picks[me.n] = pick;
      break;
    }
    case 'setup': {
      if (!host || s.phase !== 'lobby') return 'not_host';
      if (s.queue && a.format !== s.format) return 'queued';
      if ((a.format !== 1 && a.format !== 2 && a.format !== 3) || typeof a.map !== 'string' || !ID.test(a.map)) return 'bad_setup';
      s.format = a.format;
      s.map = a.map;
      // when the format shrinks, whoever no longer fits on a side comes off it
      for (const team of [0, 1] as const) {
        const on = s.seats.filter((x) => s.picks[x.n]?.team === team);
        for (const x of on.slice(s.format)) delete s.picks[x.n];
      }
      break;
    }
    case 'start':
      if (!host || s.phase !== 'lobby') return 'not_host';
      if (!s.picks[me.n]) return 'no_pick';
      s.phase = 'run';
      s.run++;
      s.runSeed = nextRandom(s);
      // (a party's search ends as its match begins: the room leaves the queue, and the run is a ranked one)
      s.ranked = !!s.queue;
      s.queue = null;
      break;
    case 'queue': {
      if (!host || s.phase !== 'lobby') return 'not_host';
      if (!a.on) {
        s.queue = null;
        s.party = [];
        break;
      }
      // only a party can queue: everyone seated on one side, no more than the format holds. (A room of friends with
      // both sides filled is a custom game: it never goes into the ranked queue.)
      const seated = s.seats.filter((x) => s.picks[x.n]);
      const teams = new Set(seated.map((x) => s.picks[x.n]!.team));
      if (!s.picks[me.n] || teams.size !== 1 || seated.length > s.format) return 'not_a_party';
      const r = typeof a.rating === 'number' && Number.isFinite(a.rating) ? Math.max(0, Math.min(9999, Math.round(a.rating))) : 1000;
      s.queue = { kind: String(s.format), mmr: r, since: now };
      s.party = seated.map((x) => x.n);
      break;
    }
    case 'end':
      if (!host || s.phase !== 'run') return 'not_host';
      s.phase = 'lobby';
      s.ranked = false;
      break;
    case 'bye': {
      const gone = me.n;
      s.seats = s.seats.filter((x) => x.n !== gone);
      delete s.picks[gone];
      // (a party that loses one of its own while it waits leaves the queue: the leader puts it back as it is now)
      if (s.queue && s.party?.includes(gone)) {
        s.queue = null;
        s.party = [];
      }
      if (s.host === gone) s.host = s.seats.find((x) => x.online)?.n ?? s.seats[0]?.n ?? s.host;
      if (s.phase === 'run' && !s.seats.some((x) => x.online)) s.phase = 'lobby';
      break;
    }
    case 'kick': {
      if (!host) return 'not_host';
      if (!kickSeat(s, me, a.n)) return 'not_host';
      delete s.picks[a.n];
      break;
    }
    default:
      return 'bad_action';
  }
  s.updated = now;
  return null;
}

/** The fight's traffic: straight on to everyone else, never stored. */
export function relay(s: State, key: string, a: Action): { others: unknown; save: boolean } | null {
  if (a?.t !== 'r') return null;
  const me = seatOf(s, key);
  if (!me || s.phase !== 'run') return { others: undefined, save: false };
  return { others: { n: me.n, d: a.d }, save: false };
}

export function viewFor(s: State, key: string): View | null {
  const me = seatOf(s, key);
  if (!me) return null;
  return {
    game: 'sigilfall-ring',
    code: s.code,
    phase: s.phase,
    you: me.n,
    host: s.host,
    format: s.format,
    map: s.map,
    seats: seatViews(s, me).map((x) => ({ ...x, pick: s.picks[x.n] ?? null })),
    run: s.run,
    runSeed: s.runSeed,
    queued: s.queue ? s.queue.since : null,
    party: s.queue ? [...(s.party ?? [])] : [],
  };
}

/**
 * Who is in the run that is going, as the room keeps it once it begins (rooms/worker.ts adds each seat's account and
 * network, and the ranked ladder settles the match by it: server/ring.ts).
 */
export function roster(s: State): { n: number; key: string; team: 0 | 1; party: boolean }[] {
  return s.seats.filter((x) => s.picks[x.n]).map((x) => ({ n: x.n, key: x.key, team: s.picks[x.n]!.team, party: !!s.party?.includes(x.n) }));
}

/** (`max`: what a search fills, both sides of its format; a room of friends still seats six) */
export const summary = (s: State): ReturnType<typeof summaryOf> => ({ ...summaryOf(s, 'sigilfall-ring', MAX_PLAYERS), max: s.format * 2 });
