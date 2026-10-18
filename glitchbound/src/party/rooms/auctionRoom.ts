/**
 * Name Your Price in a live room: the same auction rules as the one-phone game (../auction.ts), with
 * each player bidding from their own phone. A shot clock keeps it moving (no decision = pass), away
 * players pass automatically, and the game ends with everyone voting for their favourite collection.
 *
 * Phases: lobby → auction (bidding, then a short "sold" moment per item) → vote → result.
 * All money is fictional.
 */
import { canBid, minBid, reduceAuction, startAuction, type AuctionState } from '../auction';
import { AUCTION_ITEMS, AUCTION_THEMES } from '../content/auction';
import { rng, shuffle } from '../engine';
import type { AuctionTheme } from '../types';
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const BUDGETS = [10, 20, 50, 100] as const;
export const LIMITS = [3, 5, 7] as const;
export const ROUNDS = [8, 12, 16, 24] as const;
export const INCREMENTS = [1, 2, 5] as const;
export const CLOCKS = [10, 20, 30] as const;
const SOLD_SECONDS = 4;
const VOTE_SECONDS = 60;
const THEME_IDS = AUCTION_THEMES.map((t) => t.id);

export type Phase = 'lobby' | 'auction' | 'vote' | 'result';

export interface Settings {
  budget: (typeof BUDGETS)[number];
  limit: (typeof LIMITS)[number];
  rounds: (typeof ROUNDS)[number];
  increment: (typeof INCREMENTS)[number];
  themes: AuctionTheme[];
  /** Seconds to bid or pass before it passes for you. */
  clock: (typeof CLOCKS)[number];
}

export interface State extends RoomBase {
  game: 'auction';
  phase: Phase;
  settings: Settings;
  /** Player ids inside are seat numbers as strings. */
  auction: AuctionState | null;
  /** Voter seat → favourite collection's seat. */
  votes: Record<string, number>;
  gained: Record<string, number>;
  used: string[];
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'auction',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    settings: { budget: 20, limit: 5, rounds: 12, increment: 1, themes: ['heroes', 'villains', 'gaming', 'screen'], clock: 20 },
    auction: null,
    votes: {},
    gained: {},
    used: [],
  };
}

const inGame = (s: State): boolean => s.phase === 'auction' || s.phase === 'vote';
const here = (s: State, id: string | null): boolean => !!id && s.seats.some((x) => String(x.n) === id && x.online);
const playing = (s: State): number[] => (s.auction?.players ?? []).map((p) => Number(p.id));

export function join(s: State, key: string, name: string, now: number): string | null {
  return joinSeat(s, key, name, now, MAX_PLAYERS, inGame(s));
}

export function leave(s: State, key: string, now: number): void {
  if (!leaveSeat(s, key, now)) return;
  settle(s, now);
}

/** After any change: away players pass, and the clock is set for whatever comes next. */
function settle(s: State, now: number): void {
  if (!inGame(s) || !s.auction) return;
  if (playing(s).filter((n) => s.seats.some((x) => x.n === n && x.online)).length < 2) {
    s.phase = 'lobby';
    s.deadline = null;
    return;
  }
  if (s.phase === 'auction') {
    for (let guard = 0; guard < 64 && s.auction.phase === 'bidding' && s.auction.active && !here(s, s.auction.active); guard++) s.auction = reduceAuction(s.auction, { type: 'pass' });
    const a = s.auction;
    if (a.phase === 'bidding') s.deadline = now + s.settings.clock * 1000;
    else if (a.phase === 'sold' || a.phase === 'unsold') s.deadline = now + SOLD_SECONDS * 1000;
    else {
      s.phase = 'vote';
      s.votes = {};
      s.deadline = now + VOTE_SECONDS * 1000;
    }
  }
  if (s.phase === 'vote' && playing(s).filter((n) => s.seats.some((x) => x.n === n && x.online)).every((n) => String(n) in s.votes)) tally(s);
}

function tally(s: State): void {
  if (!s.auction) return;
  const got: Record<string, number> = {};
  for (const to of Object.values(s.votes)) got[to] = (got[to] ?? 0) + 1;
  s.gained = Object.fromEntries(s.auction.players.map((p) => [p.id, (got[p.id] ?? 0) * 3 + p.items.length]));
  for (const x of s.seats) x.score += s.gained[x.n] ?? 0;
  s.phase = 'result';
  s.deadline = null;
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline || !s.auction) return;
  if (s.phase === 'auction') {
    const a = s.auction;
    s.auction = a.phase === 'bidding' ? reduceAuction(a, { type: 'pass' }) : reduceAuction(a, { type: 'next' });
    settle(s, now);
  } else if (s.phase === 'vote') tally(s);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'bid'; amount: number }
  | { t: 'pass' }
  | { t: 'next' }
  | { t: 'vote'; seat: number }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number };

const pick = <T>(list: readonly T[], v: unknown): T | undefined => (list as readonly unknown[]).includes(v) ? (v as T) : undefined;

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const isHost = me.n === s.host;
  const id = String(me.n);
  s.updated = now;
  switch (a?.t) {
    case 'settings': {
      if (!isHost) return 'Only the host can change the settings.';
      if (inGame(s)) return 'Change settings between games.';
      const p = a.settings ?? {};
      s.settings.budget = pick(BUDGETS, p.budget) ?? s.settings.budget;
      s.settings.limit = pick(LIMITS, p.limit) ?? s.settings.limit;
      s.settings.rounds = pick(ROUNDS, p.rounds) ?? s.settings.rounds;
      s.settings.increment = pick(INCREMENTS, p.increment) ?? s.settings.increment;
      s.settings.clock = pick(CLOCKS, p.clock) ?? s.settings.clock;
      if (Array.isArray(p.themes)) {
        const themes = THEME_IDS.filter((t) => (p.themes as unknown[]).includes(t));
        if (themes.length) s.settings.themes = themes;
      }
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the auction.';
      if (inGame(s)) return null;
      const seats = online(s);
      if (seats.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      const pool = AUCTION_ITEMS.filter((i) => s.settings.themes.includes(i.theme));
      if (pool.length < s.settings.rounds) return 'Pick more themes.';
      // Items from earlier games in this room come last, so a rematch feels new.
      const r = rng(nextRandom(s));
      const fresh = shuffle(pool.filter((i) => !s.used.includes(i.id)), r);
      const seen = shuffle(pool.filter((i) => s.used.includes(i.id)), r);
      const items = [...fresh, ...seen].slice(0, s.settings.rounds);
      s.used = [...s.used, ...items.map((i) => i.id)].slice(-300);
      for (const x of s.seats) x.waiting = false;
      const { budget, limit, increment, rounds } = s.settings;
      s.auction = startAuction({ budget, limit, increment, rounds }, seats.map((x) => String(x.n)), items);
      s.votes = {};
      s.gained = {};
      s.phase = 'auction';
      settle(s, now);
      return null;
    }
    case 'bid':
    case 'pass': {
      const auc = s.auction;
      if (s.phase !== 'auction' || !auc || auc.phase !== 'bidding' || auc.active !== id) return null;
      if (a.t === 'bid') {
        const amount = Math.floor(Number(a.amount));
        const mine = auc.players.find((p) => p.id === id)!;
        if (!canBid(auc, id) || !(amount >= minBid(auc)) || amount > mine.budget) return `Bid between $${minBid(auc)} and $${mine.budget}.`;
        s.auction = reduceAuction(auc, { type: 'bid', amount });
      } else s.auction = reduceAuction(auc, { type: 'pass' });
      settle(s, now);
      return null;
    }
    case 'next':
      if (s.phase === 'auction' && s.auction && isHost && (s.auction.phase === 'sold' || s.auction.phase === 'unsold')) {
        s.auction = reduceAuction(s.auction, { type: 'next' });
        settle(s, now);
      }
      return null;
    case 'vote':
      if (s.phase !== 'vote' || !playing(s).includes(me.n)) return null;
      if (a.seat === me.n || !playing(s).includes(a.seat)) return 'Vote for someone else’s collection.';
      s.votes[id] = a.seat;
      settle(s, now);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) settle(s, now);
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface Wallet {
  n: number;
  budget: number;
  items: { name: string; emoji: string; rarity: 1 | 2 | 3; paid: number }[];
}

export interface RoomView {
  game: 'auction';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  /** Auction, vote and result. */
  sale: {
    index: number;
    total: number;
    item: { name: string; emoji: string; rarity: 1 | 2 | 3; theme: AuctionTheme } | null;
    state: 'bidding' | 'sold' | 'unsold' | 'done';
    bid: number;
    leader: number | null;
    active: number | null;
    passed: number[];
    minBid: number;
    /** Whether you may bid right now. */
    canBid: boolean;
    wallets: Wallet[];
  } | null;
  myVote: number | null;
  /** Result: votes each collection got and the points from this game. */
  result: { votes: Record<string, number>; gained: Record<string, number> } | null;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const a = s.auction;
  const id = String(me.n);
  const item = a && a.phase !== 'done' ? a.queue[a.index] : undefined;
  const votes: Record<string, number> = {};
  for (const to of Object.values(s.votes)) votes[to] = (votes[to] ?? 0) + 1;
  return {
    game: 'auction',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me, (n) => s.phase === 'vote' && String(n) in s.votes),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    sale:
      a && s.phase !== 'lobby'
        ? {
            index: a.index,
            total: Math.min(a.settings.rounds, a.queue.length),
            item: item ? { name: item.name, emoji: item.emoji, rarity: item.rarity, theme: item.theme } : null,
            state: a.phase,
            bid: a.bid,
            leader: a.leader ? Number(a.leader) : null,
            active: a.active ? Number(a.active) : null,
            passed: a.passed.map(Number),
            minBid: minBid(a),
            canBid: a.phase === 'bidding' && a.active === id && canBid(a, id),
            wallets: a.players.map((p) => ({ n: Number(p.id), budget: p.budget, items: p.items.map((x) => ({ name: x.item.name, emoji: x.item.emoji, rarity: x.item.rarity, paid: x.paid })) })),
          }
        : null,
    myVote: s.votes[id] ?? null,
    result: s.phase === 'result' ? { votes, gained: s.gained } : null,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'auction', MAX_PLAYERS);
}
