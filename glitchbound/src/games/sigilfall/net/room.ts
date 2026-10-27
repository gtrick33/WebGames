/**
 * Sigilfall co-op: a party of up to four heroes in a live room (rooms/worker.ts runs it). The room keeps
 * only the party: who sits where, each hero's card (name, class, level, look), the host's plan (which
 * dungeon, which Riftstone level) and when a run starts. The fight itself never touches the room's
 * storage: the host's game runs the enemies and sends what everyone needs ten times a second, and every
 * player sends their own hero's place and hits, all through `relay` (net/coop.ts). Pure, and free of the
 * game's data, so the rooms worker stays small.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../../party/rooms/seats';

export { validKey } from '../../../party/rooms/seats';

export const MAX_PLAYERS = 4;
/** The level a Riftstone run needs (data/classes MAX_LEVEL; tests/sigilfall-coop checks they agree). */
export const COOP_LEVEL = 60;
/** The largest message a player's game sends (a host's frame with a room full of enemies). */
export const maxMessage = 24_000;
/** A hero's card, as JSON, at most this long. */
const CARD_MAX = 2_400;

export type Phase = 'lobby' | 'run';
/** What the party does together: a Riftstone run (level 60), or the open world (party questing). */
export type Mode = 'rift' | 'party';

/** A hero as the others see them: drawn from this, never trusted for anything but showing. */
export interface Card {
  name: string;
  cls: string;
  level: number;
  /** Paragon level. */
  para: number;
  /** The highest Riftstone level opened. */
  keystone: number;
  /** Main-story quests done: questing together, the hero furthest behind leads (and the others see their world). */
  story: number;
  /** The drawn look (render/sprites HeroLook) and held weapon, opaque to the room. */
  look: unknown;
  weapon: unknown;
}

/** The host's plan: where the party goes (a region id) and, for a Riftstone run, the level. */
export interface Plan {
  region: string;
  key: number;
}

export interface State extends RoomBase {
  game: 'sigilfall';
  phase: Phase;
  mode: Mode;
  cards: Record<string, Card>;
  plan: Plan | null;
  /** Counts the runs started in this room (each client starts a new one when it changes). */
  run: number;
  runSeed: number;
  /** The host's week (Riftstone affixes), fixed when the run starts so everyone fights the same ones. */
  week: number;
  /**
   * Whose game runs the world: the host for a Riftstone run; questing together, the hero furthest behind in
   * the story, so the others are phased into their world (and not the other way round).
   */
  lead: number;
  /** Questing together: counts the leader's travels (every game follows to `plan.region` when it changes). */
  trip: number;
}

export interface View {
  game: 'sigilfall';
  code: string;
  phase: Phase;
  mode: Mode;
  you: number;
  host: number;
  seats: (SeatView & { card: Card | null })[];
  plan: Plan | null;
  run: number;
  runSeed: number;
  week: number;
  lead: number;
  trip: number;
}

export type Action =
  | { t: 'card'; card: Card }
  | { t: 'mode'; mode: Mode }
  | { t: 'plan'; region: string; key: number }
  | { t: 'start'; week: number }
  | { t: 'end' }
  | { t: 'kick'; n: number }
  /** Questing together: the leader goes somewhere (a region, the tier for a dungeon) and the party follows. */
  | { t: 'go'; region: string; tier: number }
  | { t: 'r'; d: unknown };

export function newRoom(code: string, now: number, seed: number): State {
  return { game: 'sigilfall', code, created: now, updated: now, phase: 'lobby', mode: 'rift', seats: [], nextSeat: 1, host: 0, deadline: null, seed, cards: {}, plan: null, run: 0, runSeed: 0, week: 0, lead: 0, trip: 0 };
}

export function join(s: State, key: string, name: string, now: number): string | null {
  // a run under way takes nobody new (the enemies are already out); seats coming back are welcome
  if (s.phase === 'run' && !seatOf(s, key)) return 'full';
  return joinSeat(s, key, name, now, MAX_PLAYERS, false);
}

export function leave(s: State, key: string, now: number): void {
  const seat = leaveSeat(s, key, now);
  if (seat && !s.seats.some((x) => x.n === seat.n)) delete s.cards[seat.n];
  // nobody left to run with: back to the lobby (a leader who drops out for a moment is waited for)
  if (s.phase === 'run' && !s.seats.some((x) => x.online)) s.phase = 'lobby';
}

export function tick(): void {}

const ID = /^[a-z0-9-]{1,40}$/;
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** A card sent by a player's game, checked for shape and size (it is only ever drawn). */
export function cleanCard(v: unknown): Card | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  const level = int(c.level, 1, 99);
  const para = int(c.para, 0, 100_000);
  const keystone = int(c.keystone, 0, 999);
  const story = int(c.story, 0, 10_000) ?? 0;
  if (typeof c.cls !== 'string' || !ID.test(c.cls) || level === null || para === null || keystone === null) return null;
  if (typeof c.name !== 'string' || !c.look || typeof c.look !== 'object' || !c.weapon || typeof c.weapon !== 'object') return null;
  const card: Card = { name: c.name.slice(0, 20), cls: c.cls, level, para, keystone, story, look: c.look, weapon: c.weapon };
  return JSON.stringify(card).length <= CARD_MAX ? card : null;
}

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me || !a || typeof a !== 'object') return 'not_seated';
  const host = me.n === s.host;
  switch (a.t) {
    case 'card': {
      const card = cleanCard(a.card);
      if (!card) return 'bad_card';
      s.cards[me.n] = card;
      break;
    }
    case 'mode':
      if (!host || s.phase !== 'lobby' || (a.mode !== 'rift' && a.mode !== 'party')) return 'not_host';
      s.mode = a.mode;
      s.plan = null;
      break;
    case 'plan': {
      if (!host || s.phase !== 'lobby') return 'not_host';
      const key = int(a.key, 0, 999);
      if (typeof a.region !== 'string' || !ID.test(a.region) || key === null) return 'bad_plan';
      s.plan = { region: a.region, key };
      break;
    }
    case 'start': {
      if (!host || s.phase !== 'lobby') return 'not_host';
      if (s.mode === 'rift' && !s.plan) return 'no_plan';
      const here = s.seats.filter((x) => x.online);
      // everyone who is here has a hero chosen; a Riftstone run is for heroes at the level cap
      if (here.some((x) => !s.cards[x.n])) return 'no_hero';
      if (s.mode === 'rift' && here.some((x) => s.cards[x.n]!.level < COOP_LEVEL)) return 'level';
      s.phase = 'run';
      s.run += 1;
      s.runSeed = nextRandom(s);
      s.week = int(a.week, 0, 1e6) ?? 0;
      // questing together: the hero furthest behind in the story leads (the leader on a tie); their game
      // says where the party starts (`go`)
      s.lead = s.mode === 'rift' ? s.host : here.reduce((best, x) => (s.cards[x.n]!.story < s.cards[best]!.story || (s.cards[x.n]!.story === s.cards[best]!.story && x.n === s.host) ? x.n : best), here[0]!.n);
      if (s.mode === 'party') {
        s.plan = null;
        s.trip = 0;
      }
      break;
    }
    case 'go': {
      if (me.n !== s.lead || s.phase !== 'run' || s.mode !== 'party') return 'not_lead';
      const tier = int(a.tier, 0, 2);
      if (typeof a.region !== 'string' || !ID.test(a.region) || tier === null) return 'bad_plan';
      s.plan = { region: a.region, key: tier };
      s.trip += 1;
      break;
    }
    case 'end':
      if (!host) return 'not_host';
      s.phase = 'lobby';
      break;
    case 'kick':
      if (!kickSeat(s, me, a.n)) return 'not_host';
      delete s.cards[a.n];
      break;
    default:
      return 'bad_action';
  }
  s.updated = now;
  return null;
}

/** The fight's traffic: passed to everyone else as it is, tagged with the sender's seat, never stored. */
export function relay(s: State, key: string, a: Action): { others: unknown; save: false } | null {
  if (!a || typeof a !== 'object' || a.t !== 'r') return null;
  const me = seatOf(s, key);
  if (!me || s.phase !== 'run') return { others: undefined as unknown, save: false };
  return { others: { n: me.n, d: a.d }, save: false };
}

export function viewFor(s: State, key: string): View | null {
  const me = seatOf(s, key);
  if (!me) return null;
  return {
    game: 'sigilfall',
    code: s.code,
    phase: s.phase,
    mode: s.mode,
    you: me.n,
    host: s.host,
    seats: seatViews(s, me).map((v) => ({ ...v, card: s.cards[v.n] ?? null })),
    plan: s.plan,
    run: s.run,
    runSeed: s.runSeed,
    week: s.week,
    lead: s.lead,
    trip: s.trip,
  };
}

export const summary = (s: State): ReturnType<typeof summaryOf> => summaryOf(s, 'sigilfall', MAX_PLAYERS);
